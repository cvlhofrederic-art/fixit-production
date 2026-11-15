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
    // Ancienne écriture directe : elle modifiait bien la base (comme en production), sans prévenir le hook.
    from: () => ({ update: (valeurs: { sous_taches: unknown }) => ({ eq: async (_colonne: string, id: string) => { ecrireSousTaches(id, valeurs.sous_taches); return { data: null, error: null } } }) }),
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

beforeEach(() => {
  localStorage.clear()
  envois = []
  keepalives = []
  ecritureRefusee = false
  delaiEcriture = 0
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
const curseurs = () => screen.getAllByRole('slider') as HTMLInputElement[]
/** Avancement de chaque sous-tâche d'un chantier, tel qu'enregistré en base. */
const avancementsEnBase = (id: string) => Object.fromEntries(
  ((base.chantiers.find(c => c.id === id)?.sous_taches ?? []) as Array<{ id: string; avancement: number }>).map(st => [st.id, st.avancement]),
)

describe('Gantt — avancement des sous-tâches', () => {
  it('un avancement saisi reste après un aller-retour sur une autre page', async () => {
    const compte = nouveauCompte()
    const premier = render(<GanttSection {...compte} orgRole="pro_societe" />)
    await waitFor(() => expect(curseurs()).toHaveLength(2))
    fireEvent.change(curseurs()[0], { target: { value: '50' } })
    // L'écriture part (directe ou par le hook) avant qu'on quitte la page.
    await waitFor(() => expect((base.chantiers[0].sous_taches as Array<{ avancement: number }>)[0].avancement).toBe(50), { timeout: 3000 })
    premier.unmount()

    render(<GanttSection {...compte} orgRole="pro_societe" />)
    await waitFor(() => expect(curseurs()).toHaveLength(2))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(curseurs()[0].value).toBe('50')
  })

  it('seul le chantier modifié est écrit, en une fois, par la route /api/btp', async () => {
    render(<GanttSection {...nouveauCompte()} orgRole="pro_societe" />)
    await waitFor(() => expect(curseurs()).toHaveLength(2))
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
    await waitFor(() => expect(curseurs()).toHaveLength(2))
    fireEvent.change(curseurs()[1], { target: { value: '80' } })
    vue.unmount()

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toMatchObject({ id: ECOLE, data: { sous_taches: [sousTache('t2', ECOLE, 80)] } })
  })

  it('écriture refusée : un message le dit', async () => {
    ecritureRefusee = true
    render(<GanttSection {...nouveauCompte()} orgRole="pro_societe" />)
    await waitFor(() => expect(curseurs()).toHaveLength(2))
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
    await waitFor(() => expect(curseurs()).toHaveLength(3))
    fireEvent.change(curseurs()[0], { target: { value: '50' } })
    premier.unmount()

    render(<GanttSection {...compte} orgRole="pro_societe" />)
    await waitFor(() => expect(curseurs()).toHaveLength(3))
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
    await waitFor(() => expect(curseurs()).toHaveLength(2))
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

describe('Gantt — nouvelle sous-tâche', () => {
  it('sans chantier choisi, elle ne peut pas être ajoutée (elle n’apparaîtrait nulle part)', async () => {
    const { container } = render(<GanttSection {...nouveauCompte()} orgRole="pro_societe" />)
    await waitFor(() => expect(curseurs()).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: '+ Sous-tâche' }))
    fireEvent.change(screen.getByPlaceholderText('Ex: Démolition'), { target: { value: 'Peinture' } })
    const dates = container.querySelectorAll('input[type="date"]')
    fireEvent.change(dates[0], { target: { value: '2026-12-01' } })
    fireEvent.change(dates[1], { target: { value: '2026-12-15' } })

    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeDisabled()
  })
})
