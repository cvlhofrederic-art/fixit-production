// tests/components/gantt-sous-taches.test.tsx — Planning Gantt : l'avancement des sous-tâches ne revient plus en
// arrière (constat donnees-btp-8 de l'audit du 11/11/2026).
//
// Avant : les sous-tâches s'écrivaient directement en base sans passer par le hook ; sa copie en mémoire des chantiers
// gardait l'ancien avancement, et au retour sur le Gantt (moins de 5 minutes plus tard) cette copie l'emportait : les
// avancements saisis revenaient en arrière, puis l'ancien état était réécrit à la modification suivante. L'échec d'une
// écriture était ignoré. Maintenant : l'enregistrement passe par le hook (modification partielle, copie en mémoire
// tenue à jour), seul le chantier modifié est écrit, un échec est annoncé, et une sous-tâche exige un chantier.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    // devis : lecture du titulaire (formulaire « Nouvelle sous-tâche »), filtres appliqués comme PostgREST.
    // Autres tables : ancienne écriture directe, qui modifiait bien la base (comme en production) sans prévenir le hook.
    from: (table: string) => (table === 'devis'
      ? lectureDevis()
      : { update: (valeurs: { sous_taches: unknown }) => ({ eq: async (_colonne: string, id: string) => { ecrireSousTaches(id, valeurs.sous_taches); return { data: null, error: null } } }) }),
    auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) },
  },
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr', useTranslation: () => ({ t: (cle: string) => cle }) }))

import { toast } from 'sonner'
import { GanttSection } from '@/components/dashboard/btp/GanttSection'

const VILLA = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const ECOLE = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })

const sousTache = (id: string, chantierId: string, avancement: number) =>
  ({ id, nom: `Tâche ${id}`, chantierId, responsable: '', debut: '2026-11-01', fin: '2027-01-31', avancement, couleur: '#3B82F6' })

let base: Record<string, Array<Record<string, unknown>>>
let envois: Array<{ table: string; action: string; id?: string; data?: Record<string, unknown> }>
/** Pour chaque envoi : parti en keepalive (requête qui survit à la fermeture de la page). */
let keepalives: boolean[]
let ecritureRefusee: boolean
/** Durée de l'écriture côté serveur (réseau de chantier lent), en millisecondes. */
let delaiEcriture: number

function ecrireSousTaches(id: string, sousTaches: unknown) {
  base.chantiers = base.chantiers.map(c => (c.id === id ? { ...c, sous_taches: sousTaches } : c))
}

// ── Devis de la société (formulaire « Nouvelle sous-tâche ») ──
const DEVIS_VILLA = 'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f'
const DEVIS_ECOLE = 'd4e5f6a7-b8c9-4d0e-9f1a-3b4c5d6e7f8a'
const DEVIS_LIBRE = 'e5f6a7b8-c9d0-4e1f-8a2b-4c5d6e7f8a9b'
let devisEnBase: Array<Record<string, unknown>>
/** Filtres de chaque lecture de devis faite depuis le navigateur. */
let lecturesDevis: Array<Record<string, unknown>>
let lectureDevisRefusee: boolean
/** Durée de la lecture des devis d'une obra (réseau lent), par chantier, en millisecondes. */
let delaisDevis: Record<string, number>
/** Réponse de /api/pro/documents/chantiers (compte invité). */
let reponseDocumentsSociete: () => Response

function lectureDevis() {
  const filtres: Record<string, unknown> = {}
  const chaine = {
    select: () => chaine,
    eq: (colonne: string, valeur: unknown) => { filtres[colonne] = valeur; return chaine },
    is: (colonne: string, valeur: unknown) => { filtres[colonne] = valeur; return chaine },
    order: () => chaine,
    then: (resoudre: (v: unknown) => unknown, rejeter?: (e: unknown) => unknown) => {
      lecturesDevis.push({ ...filtres })
      const delai = delaisDevis[String(filtres.chantier_id)] ?? 0
      const reponse = lectureDevisRefusee
        ? { data: null, error: { message: 'lecture refusée' } }
        : { data: devisEnBase.filter(d => Object.entries(filtres).every(([colonne, valeur]) => colonne === 'artisan_id' || (d[colonne] ?? null) === valeur)), error: null }
      return new Promise(r => setTimeout(r, delai)).then(() => reponse).then(resoudre, rejeter)
    },
  }
  return chaine
}

beforeEach(() => {
  localStorage.clear()
  envois = []
  keepalives = []
  ecritureRefusee = false
  delaiEcriture = 0
  lecturesDevis = []
  lectureDevisRefusee = false
  delaisDevis = {}
  devisEnBase = [
    {
      id: DEVIS_VILLA, numero: 'DEV-2026-014', chantier_id: VILLA, deleted_at: null, created_at: '2026-11-02T10:00:00Z',
      items: [
        { id: 1711, description: 'Démolition des cloisons', qty: 25, unit: 'm2', priceHT: 18, totalHT: 450 },
        { id: 1712, description: 'Enduit intérieur', qty: 60, unit: 'm2', priceHT: 12, totalHT: 720 },
      ],
    },
    {
      id: DEVIS_ECOLE, numero: 'DEV-2026-020', chantier_id: ECOLE, deleted_at: null, created_at: '2026-11-05T10:00:00Z',
      items: [{ id: 2001, description: 'Peinture des classes', qty: 4, unit: 'u', priceHT: 900, totalHT: 3600 }],
    },
  ]
  reponseDocumentsSociete = () => json({ devis: devisEnBase, factures: [] })
  vi.mocked(toast.error).mockClear()
  base = {
    chantiers: [
      { id: VILLA, titre: 'Villa Dupré', client: 'Mme Dupré', statut: 'En cours', date_debut: '2026-10-01', date_fin: '2027-03-31', sous_taches: [sousTache('t1', VILLA, 10)] },
      { id: ECOLE, titre: 'École', client: 'Commune', statut: 'En cours', date_debut: '2026-10-01', date_fin: '2027-03-31', sous_taches: [sousTache('t2', ECOLE, 30)] },
    ],
  }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'POST') {
      const corps = JSON.parse(String(init.body))
      envois.push(corps)
      keepalives.push(init.keepalive === true)
      if (delaiEcriture > 0) await new Promise(resolve => setTimeout(resolve, delaiEcriture))
      if (ecritureRefusee) return json({ error: 'Les données n\'ont pas pu être enregistrées.' }, 500)
      ecrireSousTaches(corps.id, corps.data.sous_taches)
      return json({ row: base.chantiers.find(c => c.id === corps.id) })
    }
    if (String(url).startsWith('/api/pro/documents/chantiers')) return reponseDocumentsSociete()
    const table = new URL(String(url), 'https://vitfix.io').searchParams.get('table') ?? ''
    return json({ [table]: base[table] ?? [] })
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

let comptes = 0
const nouveauCompte = () => { comptes += 1; return { userId: `fiche-gantt-${comptes}`, authUserId: `compte-gantt-${comptes}` } }
/** Premier rendu (chargement des chantiers) : plus d'une seconde sur un poste lent, d'où un faux rouge. */
const ATTENTE_RENDU = { timeout: 5000 }
const curseurs = () => screen.getAllByRole('slider') as HTMLInputElement[]
/** Avancement de chaque sous-tâche d'un chantier, tel qu'enregistré en base. */
const avancementsEnBase = (id: string) => Object.fromEntries(
  ((base.chantiers.find(c => c.id === id)?.sous_taches ?? []) as Array<{ id: string; avancement: number }>).map(st => [st.id, st.avancement]),
)

describe('Gantt — avancement des sous-tâches', () => {
  it('un avancement saisi reste après un aller-retour sur une autre page', async () => {
    const compte = nouveauCompte()
    const premier = render(<GanttSection {...compte} orgRole="pro_societe" />)
    await waitFor(() => expect(curseurs()).toHaveLength(2), ATTENTE_RENDU)
    fireEvent.change(curseurs()[0], { target: { value: '50' } })
    // L'écriture part (directe ou par le hook) avant qu'on quitte la page.
    await waitFor(() => expect((base.chantiers[0].sous_taches as Array<{ avancement: number }>)[0].avancement).toBe(50), { timeout: 3000 })
    premier.unmount()

    render(<GanttSection {...compte} orgRole="pro_societe" />)
    await waitFor(() => expect(curseurs()).toHaveLength(2), ATTENTE_RENDU)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(curseurs()[0].value).toBe('50')
  })

  it('seul le chantier modifié est écrit, en une fois, par la route /api/btp', async () => {
    render(<GanttSection {...nouveauCompte()} orgRole="pro_societe" />)
    await waitFor(() => expect(curseurs()).toHaveLength(2), ATTENTE_RENDU)
    fireEvent.change(curseurs()[0], { target: { value: '40' } })
    fireEvent.change(curseurs()[0], { target: { value: '60' } })

    await waitFor(() => expect(envois).toHaveLength(1), { timeout: 3000 })
    expect(envois[0]).toEqual({ table: 'chantiers_btp', action: 'update', id: VILLA, data: { sous_taches: [sousTache('t1', VILLA, 60)] } })
    await new Promise(resolve => setTimeout(resolve, 900))
    expect(envois).toHaveLength(1)
  })

  // Relecture adverse du 15/11/2026 : la liste de référence n'était mise à jour qu'après l'affichage ; un changement fait
  // dès l'apparition des sous-tâches la trouvait encore vide, et tous les chantiers étaient réécrits (échec intermittent
  // du test suivant).
  it('un changement fait dès l’affichage des sous-tâches n’écrit que le chantier modifié', async () => {
    const { container } = render(<GanttSection {...nouveauCompte()} orgRole="pro_societe" />)
    await new Promise<void>(resolve => {
      const observateur = new MutationObserver(() => {
        const affiches = container.querySelectorAll('input[type="range"]')
        if (affiches.length !== 2) return
        observateur.disconnect()
        fireEvent.change(affiches[1], { target: { value: '80' } })
        resolve()
      })
      observateur.observe(container, { childList: true, subtree: true })
    })

    await waitFor(() => expect(envois).toHaveLength(1), { timeout: 3000 })
    await new Promise(resolve => setTimeout(resolve, 900))
    expect(envois).toEqual([{ table: 'chantiers_btp', action: 'update', id: ECOLE, data: { sous_taches: [sousTache('t2', ECOLE, 80)] } }])
  })

  it('quitter la page juste après un changement l’enregistre quand même', async () => {
    const vue = render(<GanttSection {...nouveauCompte()} orgRole="pro_societe" />)
    await waitFor(() => expect(curseurs()).toHaveLength(2), ATTENTE_RENDU)
    fireEvent.change(curseurs()[1], { target: { value: '80' } })
    vue.unmount()

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toMatchObject({ id: ECOLE, data: { sous_taches: [sousTache('t2', ECOLE, 80)] } })
  })

  it('écriture refusée : un message le dit', async () => {
    ecritureRefusee = true
    render(<GanttSection {...nouveauCompte()} orgRole="pro_societe" />)
    await waitFor(() => expect(curseurs()).toHaveLength(2), ATTENTE_RENDU)
    fireEvent.change(curseurs()[0], { target: { value: '70' } })

    await waitFor(() => expect(toast.error).toHaveBeenCalled(), { timeout: 3000 })
  })

  // Relecture adverse du 15/11/2026 : l'écriture part quand on quitte la page. Revenir avant la fin de l'écriture et de
  // sa relecture reprenait la copie en mémoire des chantiers, encore à l'état d'avant : l'ancien avancement s'affichait,
  // puis était réécrit en base à la modification suivante d'une autre sous-tâche du même chantier.
  it('retour sur le Gantt pendant l’écriture (réseau lent) : l’avancement saisi reste et n’est pas réécrit ensuite', async () => {
    base.chantiers[0].sous_taches = [sousTache('t1', VILLA, 10), sousTache('t3', VILLA, 20)]
    delaiEcriture = 300
    const compte = nouveauCompte()
    const premier = render(<GanttSection {...compte} orgRole="pro_societe" />)
    await waitFor(() => expect(curseurs()).toHaveLength(3), ATTENTE_RENDU)
    fireEvent.change(curseurs()[0], { target: { value: '50' } })
    premier.unmount()

    render(<GanttSection {...compte} orgRole="pro_societe" />)
    await waitFor(() => expect(curseurs()).toHaveLength(3), ATTENTE_RENDU)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(curseurs()[0].value).toBe('50')

    fireEvent.change(curseurs()[1], { target: { value: '70' } })
    await waitFor(() => expect(envois).toHaveLength(2), { timeout: 3000 })
    await waitFor(() => expect(avancementsEnBase(VILLA)).toEqual({ t1: 50, t3: 70 }), { timeout: 3000 })
  })

  // Relecture adverse du 15/11/2026 : les écritures sont regroupées (0,6 s) et ne partaient en avance qu'au démontage de
  // la page. Un rechargement, une fermeture d'onglet ou le passage à une autre application ne démonte rien : la
  // modification restait dans le navigateur, et la base l'emportait au chargement suivant.
  it.each([
    ['rechargement ou fermeture de l’onglet', () => { window.dispatchEvent(new Event('pagehide')) }],
    ['passage à une autre application', () => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
    }],
  ])('%s juste après un changement : l’écriture part tout de suite, en keepalive', async (_cas, quitter) => {
    render(<GanttSection {...nouveauCompte()} orgRole="pro_societe" />)
    await waitFor(() => expect(curseurs()).toHaveLength(2), ATTENTE_RENDU)
    // Rien en attente : rien ne part.
    quitter()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(envois).toEqual([])

    fireEvent.change(curseurs()[0], { target: { value: '45' } })
    quitter()
    // Bien avant la fin du délai de regroupement (0,6 s).
    await waitFor(() => expect(envois).toHaveLength(1), { timeout: 300 })
    expect(envois[0]).toMatchObject({ id: VILLA, data: { sous_taches: [sousTache('t1', VILLA, 45)] } })
    expect(keepalives).toEqual([true])
    await new Promise(resolve => setTimeout(resolve, 800))
    expect(envois).toHaveLength(1)
  })
})

// Une tâche avec horaire n'est en retard qu'après l'heure de fin de son dernier jour ; une sous-tâche d'avant (sans
// horaire) garde le calcul d'avant.
describe('Gantt — retard d’une tâche', () => {
  afterEach(() => { vi.useRealTimers() })
  const statutDe = (nom: string) => screen.getAllByRole('row').find(r => r.textContent?.includes(nom))?.textContent ?? ''

  it.each([
    ['à midi le dernier jour : en cours', 12, 'proDash.btp.gantt.enCours'],
    ['après l’heure de fin : en retard', 18, 'proDash.btp.gantt.enRetard'],
  ])('%s', async (_cas, heure, statut) => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 11, 3, heure, 0, 0) })
    base.chantiers[0].sous_taches = [
      { ...sousTache('t1', VILLA, 20), nom: 'Enduit planifié', debut: '2026-12-01', fin: '2026-12-03', heureDebut: '08:00', heureFin: '17:00' },
      { ...sousTache('t3', VILLA, 20), nom: 'Ancienne tâche', debut: '2026-12-01', fin: '2026-12-03' },
    ]
    render(<GanttSection {...nouveauCompte()} orgRole="pro_societe" />)
    await waitFor(() => expect(curseurs()).toHaveLength(3), ATTENTE_RENDU)
    expect(statutDe('Enduit planifié')).toContain(statut)
    expect(statutDe('Ancienne tâche')).toContain('proDash.btp.gantt.enRetard')
  })
})

// Demande de Frédéric du 28/11/2026 : chaque tâche correspond à une ligne du devis de l'obra choisie, avec ses jours et
// son horaire.
describe('Gantt — nouvelle sous-tâche', () => {
  const champ = (libelle: string) => screen.getByLabelText(libelle) as HTMLInputElement & HTMLSelectElement
  const ajouter = () => screen.getByRole('button', { name: 'Ajouter' })
  const optionsLignes = () => [...champ('Ligne du devis').querySelectorAll('option')].map(o => o.textContent)

  async function ouvrirFormulaire(props: Partial<Parameters<typeof GanttSection>[0]> = {}) {
    const compte = nouveauCompte()
    render(<GanttSection {...compte} orgRole="pro_societe" {...props} />)
    await waitFor(() => expect(curseurs()).toHaveLength(2), ATTENTE_RENDU)
    fireEvent.click(screen.getByRole('button', { name: '+ Sous-tâche' }))
    return compte
  }
  const remplirPeriode = (debut: string, fin: string, heureDebut: string, heureFin: string) => {
    fireEvent.change(champ('Jour de début'), { target: { value: debut } })
    fireEvent.change(champ('Jour de fin'), { target: { value: fin } })
    fireEvent.change(champ('Heure de début'), { target: { value: heureDebut } })
    fireEvent.change(champ('Heure de fin'), { target: { value: heureFin } })
  }

  it('sans chantier choisi, elle ne peut pas être ajoutée (elle n’apparaîtrait nulle part)', async () => {
    await ouvrirFormulaire()
    remplirPeriode('2026-12-01', '2026-12-15', '08:00', '17:00')

    expect(champ('Ligne du devis')).toBeDisabled()
    expect(optionsLignes()).toEqual(['Choisissez d’abord le chantier'])
    expect(ajouter()).toBeDisabled()
  })

  it('la tâche est une ligne du devis de l’obra, avec ses jours et son horaire, enregistrés en base', async () => {
    const compte = await ouvrirFormulaire()
    fireEvent.change(champ('Chantier'), { target: { value: VILLA } })
    await waitFor(() => expect(optionsLignes()).toContain('Démolition des cloisons (25 m2)'))
    // Seules les lignes des devis de cette obra, sous le numéro de leur devis.
    expect(optionsLignes()).toEqual(['Sélectionner...', 'Démolition des cloisons (25 m2)', 'Enduit intérieur (60 m2)'])
    expect(champ('Ligne du devis').querySelector('optgroup')?.getAttribute('label')).toBe('Devis DEV-2026-014')
    expect(lecturesDevis).toEqual([{ artisan_id: compte.userId, chantier_id: VILLA, deleted_at: null }])
    // Jours et horaire remplis, mais pas de ligne du devis : rien à ajouter.
    remplirPeriode('2026-12-01', '2026-12-05', '08:00', '12:30')
    expect(ajouter()).toBeDisabled()
    // Ligne choisie, mais jours effacés : rien à ajouter non plus.
    fireEvent.change(champ('Ligne du devis'), { target: { value: `${DEVIS_VILLA}::0` } })
    fireEvent.change(champ('Jour de fin'), { target: { value: '' } })
    expect(ajouter()).toBeDisabled()

    fireEvent.change(champ('Jour de fin'), { target: { value: '2026-12-05' } })
    expect(ajouter()).toBeEnabled()
    fireEvent.change(champ('Responsable'), { target: { value: ' João ' } })
    fireEvent.click(ajouter())

    await waitFor(() => expect(envois).toHaveLength(1), { timeout: 3000 })
    const enregistrees = envois[0].data?.sous_taches as Array<Record<string, unknown>>
    expect(envois[0]).toMatchObject({ table: 'chantiers_btp', action: 'update', id: VILLA })
    // La sous-tâche existante est réécrite telle quelle, la nouvelle porte sa ligne de devis et son horaire.
    expect(enregistrees[0]).toEqual(sousTache('t1', VILLA, 10))
    expect(enregistrees[1]).toEqual({
      id: expect.any(String), nom: 'Démolition des cloisons', chantierId: VILLA, responsable: 'João',
      debut: '2026-12-01', fin: '2026-12-05', heureDebut: '08:00', heureFin: '12:30', avancement: 0, couleur: '#3B82F6',
      devisId: DEVIS_VILLA, devisNumero: 'DEV-2026-014', ligneId: '1711', ligneIndex: 0,
    })
    // Le tableau d'avancement dit le devis, les jours et l'horaire.
    const ligneTableau = screen.getAllByRole('row').find(r => r.textContent?.includes('Démolition des cloisons'))
    expect(ligneTableau?.textContent).toContain('Devis DEV-2026-014')
    expect(ligneTableau?.textContent).toContain('01/12/2026 → 05/12/2026')
    expect(ligneTableau?.textContent).toContain('de 08:00 à 12:30')

    // Rouvrir le formulaire : la ligne est signalée comme déjà planifiée (sans relire les devis).
    fireEvent.click(screen.getByRole('button', { name: '+ Sous-tâche' }))
    fireEvent.change(champ('Chantier'), { target: { value: VILLA } })
    await waitFor(() => expect(optionsLignes()).toContain('Démolition des cloisons (25 m2) · déjà planifiée'))
    expect(optionsLignes()).toContain('Enduit intérieur (60 m2)')
    expect(lecturesDevis).toHaveLength(1)
  })

  it('un devis non rattaché à l’obra n’est pas proposé', async () => {
    devisEnBase.push({ id: DEVIS_LIBRE, numero: 'DEV-2026-003', chantier_id: null, deleted_at: null, items: [{ id: 3, description: 'Charpente', qty: 1, unit: 'ens' }] })
    await ouvrirFormulaire({ devisParLeServeur: true })
    fireEvent.change(champ('Chantier'), { target: { value: VILLA } })
    await waitFor(() => expect(optionsLignes()).toContain('Démolition des cloisons (25 m2)'))
    expect(optionsLignes()).not.toContain('Charpente (1 ens)')
  })

  it('changer d’obra change les lignes ; une réponse dépassée est ignorée', async () => {
    delaisDevis = { [VILLA]: 200 }
    await ouvrirFormulaire()
    fireEvent.change(champ('Chantier'), { target: { value: VILLA } })
    fireEvent.change(champ('Chantier'), { target: { value: ECOLE } })
    await waitFor(() => expect(optionsLignes()).toContain('Peinture des classes (4 u)'))
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(optionsLignes()).toEqual(['Sélectionner...', 'Peinture des classes (4 u)'])
  })

  it('obra sans devis lié : le formulaire le dit et rien ne peut être ajouté', async () => {
    devisEnBase = devisEnBase.filter(d => d.chantier_id !== ECOLE)
    await ouvrirFormulaire()
    fireEvent.change(champ('Chantier'), { target: { value: ECOLE } })
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Ce chantier n’a aucun devis lié'))
    remplirPeriode('2026-12-01', '2026-12-05', '08:00', '17:00')
    expect(champ('Ligne du devis')).toBeDisabled()
    expect(ajouter()).toBeDisabled()
  })

  it('heure de fin avant l’heure de début, ou jour de fin avant le jour de début : message, rien ne part', async () => {
    await ouvrirFormulaire()
    fireEvent.change(champ('Chantier'), { target: { value: VILLA } })
    await waitFor(() => expect(optionsLignes()).toContain('Enduit intérieur (60 m2)'))
    fireEvent.change(champ('Ligne du devis'), { target: { value: `${DEVIS_VILLA}::1` } })

    remplirPeriode('2026-12-01', '2026-12-01', '14:00', '09:00')
    expect(screen.getByRole('alert').textContent).toBe('L’heure de fin doit suivre l’heure de début.')
    expect(ajouter()).toBeDisabled()

    remplirPeriode('2026-12-05', '2026-12-01', '08:00', '17:00')
    expect(screen.getByRole('alert').textContent).toBe('Le jour de fin précède le jour de début.')
    expect(ajouter()).toBeDisabled()

    remplirPeriode('2026-12-01', '2026-12-01', '08:00', '17:00')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(ajouter()).toBeEnabled()
    await new Promise(resolve => setTimeout(resolve, 700))
    expect(envois).toEqual([])
  })

  it('lecture des devis en échec : le message le dit, « Réessayer » relit', async () => {
    lectureDevisRefusee = true
    await ouvrirFormulaire()
    fireEvent.change(champ('Chantier'), { target: { value: VILLA } })
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Les devis de ce chantier n’ont pas pu être lus.'))
    expect(ajouter()).toBeDisabled()

    lectureDevisRefusee = false
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(optionsLignes()).toContain('Démolition des cloisons (25 m2)'))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('compte invité : les devis de la société sont lus par le serveur, une fois pour l’écran, ceux de l’obra seulement', async () => {
    const lecturesServeur = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url) === '/api/pro/documents/chantiers').length
    await ouvrirFormulaire({ devisParLeServeur: true })
    fireEvent.change(champ('Chantier'), { target: { value: ECOLE } })
    await waitFor(() => expect(optionsLignes()).toEqual(['Sélectionner...', 'Peinture des classes (4 u)']))
    fireEvent.change(champ('Chantier'), { target: { value: VILLA } })
    await waitFor(() => expect(optionsLignes()).toContain('Démolition des cloisons (25 m2)'))
    expect(optionsLignes()).not.toContain('Peinture des classes (4 u)')
    // La route rend tous les devis de la société (limite de 30 lectures par minute, partagée avec Obras et Météo).
    expect(lecturesServeur()).toBe(1)
    expect(lecturesDevis).toEqual([])
  })

  it('compte invité, refus du serveur : son message, dans la langue de l’écran ; « Réessayer » relit', async () => {
    reponseDocumentsSociete = () => json({ error: 'Too many requests' }, 429)
    await ouvrirFormulaire({ devisParLeServeur: true })
    fireEvent.change(champ('Chantier'), { target: { value: VILLA } })
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Trop de demandes en peu de temps.'))
    reponseDocumentsSociete = () => json({ devis: devisEnBase, factures: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(optionsLignes()).toContain('Démolition des cloisons (25 m2)'))
  })

  it('compte invité sans accès aux devis : le formulaire le dit', async () => {
    reponseDocumentsSociete = () => json({ error: 'Accès refusé', code: 'aucun_droit' }, 403)
    await ouvrirFormulaire({ devisParLeServeur: true })
    fireEvent.change(champ('Chantier'), { target: { value: VILLA } })
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Votre rôle dans l’entreprise ne donne pas accès aux devis'))
    expect(ajouter()).toBeDisabled()
  })
})
