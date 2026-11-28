import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentType, ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Écran « Banque et recouvrement », panneau « Comptes bancaires du mandat », EN MODE DONNÉES RÉELLES : comptes lus et
 * écrits dans la table locale « banques », mode de tenue du cabinet (« cabinets ») et du mandat
 * (Mandat.modeComptesBancaires), contrôles du domaine (D-BANQUE, J67 R95, J71). Le mode est lu au chargement des
 * modules : il est posé dans le stockage, puis les modules sont rechargés (comme sinistres-ecran-reel).
 */

const CLE_STOCKAGE_MODE = 'vitfix.aj.mode'
// IBAN de test publiés (exemples déjà utilisés par les tests D-BANQUE) : clés valides, aucun compte réel.
const IBAN_A = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_B = 'FR14 2004 1010 0505 0001 3M02 606'
const IBAN_FAUX = 'FR76 3000 6000 0112 3456 7890 188'
// BIC visiblement fictif (« EXEM » pour exemple) : aucun établissement réel.
const BIC_FICTIF = 'EXEMFRPP'

type Push = (options: { kind?: string; title?: ReactNode; desc?: ReactNode }) => number | undefined

let TresorerieModule: ComponentType
let ToastContext: typeof import('@/components/administrateur-judiciaire/ui/toast').ToastContext
let useDonneesStore: typeof import('@/lib/administrateur-judiciaire/db/donnees-store').useDonneesStore
let useSelectionDossier: typeof import('@/lib/administrateur-judiciaire/selection').useSelectionDossier
let ajDb: typeof import('@/lib/administrateur-judiciaire/db/schema').ajDb
let viderBaseLocale: () => Promise<void>
let comptesDb: typeof import('@/lib/administrateur-judiciaire/db/comptes-bancaires')
let rapprochementsDb: typeof import('@/lib/administrateur-judiciaire/db/rapprochements')
let relevesDb: typeof import('@/lib/administrateur-judiciaire/db/releves-bancaires')

beforeAll(async () => {
  localStorage.setItem(CLE_STOCKAGE_MODE, 'reel')
  vi.resetModules()
  ;({ TresorerieModule } = await import('@/components/administrateur-judiciaire/modules/finances/TresorerieModule'))
  ;({ ToastContext } = await import('@/components/administrateur-judiciaire/ui/toast'))
  ;({ useDonneesStore } = await import('@/lib/administrateur-judiciaire/db/donnees-store'))
  ;({ useSelectionDossier } = await import('@/lib/administrateur-judiciaire/selection'))
  ;({ ajDb } = await import('@/lib/administrateur-judiciaire/db/schema'))
  ;({ viderBaseLocale } = await import('@/lib/administrateur-judiciaire/db/reset'))
  comptesDb = await import('@/lib/administrateur-judiciaire/db/comptes-bancaires')
  rapprochementsDb = await import('@/lib/administrateur-judiciaire/db/rapprochements')
  relevesDb = await import('@/lib/administrateur-judiciaire/db/releves-bancaires')
  const { MODE_ACTIF } = await import('@/lib/administrateur-judiciaire/mode')
  expect(MODE_ACTIF).toBe('reel')
})

afterAll(() => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
})

/** Crée une copropriété et son mandat, puis la choisit dans le sélecteur du haut de page. */
async function creerCopro(nom: string, fondement = 'art. 46 — carence') {
  const vue = await useDonneesStore.getState().createCopropriete({
    nom,
    adresse: '1 rue de l’Exemple, 75000 Paris',
    nbLots: 10,
    rg: '26/00001',
    fondement,
  })
  useSelectionDossier.setState({ code: vue.code, coproprietaireId: null })
  return vue
}

let copro: Awaited<ReturnType<typeof creerCopro>>

async function reinitialiserStore() {
  useDonneesStore.setState({ loaded: false, loading: false, erreur: null, coproprietes: [], mandats: [], journaux: [], ecritures: [] })
  await useDonneesStore.getState().loadAll()
}

beforeEach(async () => {
  await viderBaseLocale()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
  await reinitialiserStore()
  copro = await creerCopro('Résidence des Acacias')
})

afterEach(() => cleanup())

/** Laisse s'écouler un délai réel (fake-indexeddb planifie ses requêtes hors des microtâches). */
const patienter = () =>
  act(async () => {
    await new Promise((resoudre) => setTimeout(resoudre, 30))
  })

/** Toasts de l'écran rendu en dernier : chaque enregistrement en émet un (succès ou refus), signe que l'écriture est finie. */
let pushCourant: ReturnType<typeof vi.fn<Push>> | null = null

/** `lectureFinie: false` : pour les tests qui gardent exprès la lecture en attente. */
async function rendre({ lectureFinie = true }: { lectureFinie?: boolean } = {}) {
  const push = vi.fn<Push>(() => undefined)
  pushCourant = push
  await act(async () => {
    render(
      <ToastContext.Provider value={{ push, dismiss: vi.fn() }}>
        <TresorerieModule />
      </ToastContext.Provider>,
    )
  })
  await patienter()
  // Première lecture finie (base froide : plus de 30 ms), sans délai fixe.
  if (lectureFinie) await waitFor(() => expect(screen.queryByText('Chargement…')).toBeNull())
  return { push }
}

/** Panneau « Comptes bancaires du mandat ». */
function panneau(): HTMLElement {
  const titre = screen.getByRole('heading', { level: 3, name: 'Comptes bancaires du mandat' })
  return titre.closest('.panel') as HTMLElement
}
const dansPanneau = () => within(panneau())
const lignesComptes = () => within(panneau()).queryAllByRole('row').slice(1)
const dialogue = () => within(screen.getByRole('dialog'))
const dernierToast = (push: ReturnType<typeof vi.fn<Push>>) => push.mock.calls.at(-1)?.[0]

/** Ouvre « Nouveau compte », remplit les champs donnés, enregistre. */
async function saisirCompte(champs: { nature?: string; libelle?: string; iban?: string; bic?: string; etablissement?: string }) {
  fireEvent.click(dansPanneau().getByRole('button', { name: /Nouveau compte/ }))
  const boite = dialogue()
  if (champs.nature) fireEvent.change(boite.getByLabelText('Nature'), { target: { value: champs.nature } })
  if (champs.libelle !== undefined) fireEvent.change(boite.getByLabelText('Libellé'), { target: { value: champs.libelle } })
  if (champs.iban !== undefined) fireEvent.change(boite.getByLabelText('IBAN'), { target: { value: champs.iban } })
  if (champs.bic !== undefined) fireEvent.change(boite.getByLabelText('BIC'), { target: { value: champs.bic } })
  if (champs.etablissement !== undefined)
    fireEvent.change(boite.getByLabelText('Établissement'), { target: { value: champs.etablissement } })
}

async function enregistrer() {
  const toasts = pushCourant?.mock.calls.length ?? 0
  await act(async () => {
    fireEvent.click(dialogue().getByRole('button', { name: 'Enregistrer' }))
  })
  // Écriture finie quand son toast est émis (sans délai fixe : la base froide peut dépasser 30 ms), puis relecture.
  await waitFor(() => expect(pushCourant?.mock.calls.length ?? 0).toBeGreaterThan(toasts))
  await patienter()
}

/**
 * Clique « Clôturer » sur une ligne et attend la confirmation : elle ne s'ouvre qu'après le contrôle des arrêtés du
 * compte, lus dans la base (réponse du référent métier du 28/11/2026, point #857 · 1, choix A).
 */
async function demanderCloture(bouton: HTMLElement) {
  await act(async () => {
    fireEvent.click(bouton)
  })
  await screen.findByRole('dialog')
}

/** Comptes écrits directement par le module d'écriture (avant le rendu). */
const ajouter = (saisie: Partial<import('@/lib/administrateur-judiciaire/db/comptes-bancaires').SaisieCompteBancaire>) =>
  comptesDb.enregistrerCompteBancaire(copro.id, { nature: 'courant', libelle: '', iban: IBAN_A, bic: '', etablissement: '', ...saisie })

const titresAlertes = () => Array.from(panneau().querySelectorAll('.alert b')).map((b) => b.textContent ?? '')

describe('Comptes bancaires en mode réel — affichage et contrôles', () => {
  it('panneau inséré entre les indicateurs et « Importer un relevé »', async () => {
    await rendre()
    const titres = screen.getAllByRole('heading', { level: 3 }).map((titre) => titre.textContent)
    expect(titres.indexOf('Comptes bancaires du mandat')).toBe(0)
    // Puis le rapprochement (maquette : ses deux panneaux avant l'import), puis l'import du relevé.
    expect(titres.indexOf('Rapprochement bancaire')).toBe(1)
    expect(titres.indexOf('Importer un relevé')).toBe(2)
    expect(screen.queryByRole('combobox', { name: 'Exemple' })).toBeNull()
  })

  it('base sans compte : compte courant à ouvrir (mode du cabinet par défaut), pastille « Réglage du cabinet »', async () => {
    await rendre()
    expect(dansPanneau().getByText('Aucun compte enregistré pour cette copropriété.')).toBeInTheDocument()
    expect(panneau().textContent).toContain('Mode appliqué : Compte séparé au nom du syndicat')
    expect(dansPanneau().getByText('Réglage du cabinet')).toBeInTheDocument()
    expect(dansPanneau().getByLabelText('Ce mandat')).toHaveDisplayValue('Comme le cabinet')
    expect(dansPanneau().getByLabelText('Réglage du cabinet (mode par défaut)')).toHaveDisplayValue('Compte séparé au nom du syndicat')
    expect(titresAlertes()).toContain(
      'Compte courant au nom du syndicat : compte à ouvrir, requis par le mode retenu (Compte séparé au nom du syndicat).',
    )
    // Sans tableau, pas de colonne « Solde » : la phrase qui l'explique n'a rien à expliquer.
    expect(panneau().textContent).not.toContain('Solde par compte')
  })

  it('« Nouveau compte » : écrit en base, affiché (IBAN groupé, solde « — »), comptes conformes au mode', async () => {
    const { push } = await rendre()
    await saisirCompte({ libelle: 'Compte principal', iban: IBAN_A, bic: BIC_FICTIF, etablissement: 'Banque d’exemple' })
    await enregistrer()
    const lignes = await ajDb.banques.toArray()
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({ coproprieteId: copro.id, nature: 'courant', iban: 'FR7630006000011234567890189', actif: true })
    expect(dernierToast(push)).toMatchObject({ kind: 'success', title: 'Compte enregistré' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(lignesComptes()).toHaveLength(1)
    const ligne = lignesComptes()[0]
    expect(ligne.textContent).toContain('Compte courant au nom du syndicat')
    expect(ligne.textContent).toContain('Compte principal')
    expect(ligne.textContent).toContain('FR76 3000 6000 0112 3456 7890 189')
    // IBAN jamais renvoyé à la ligne (relu chiffre à chiffre) : sur téléphone, le tableau défile dans son cadre .tbl-wrap.
    expect(within(ligne).getByText('FR76 3000 6000 0112 3456 7890 189')).toHaveStyle({ whiteSpace: 'nowrap' })
    // Largeur minimale de 640 px (style en ligne) : la colonne « Nature » reste lisible, le cadre défile.
    expect(ligne.closest('table')).toHaveStyle({ minWidth: '640px' })
    expect(ligne.textContent).toContain(`${BIC_FICTIF} · Banque d’exemple`)
    expect(within(ligne).getByText('—')).toBeInTheDocument()
    // Actions de la ligne nommées avec le compte visé (le texte visible reste en tête du nom, WCAG 2.5.3).
    expect(within(ligne).getByRole('button', { name: 'Modifier Compte principal' })).toBeInTheDocument()
    expect(within(ligne).getByRole('button', { name: 'Clôturer Compte principal' })).toBeInTheDocument()
    expect(panneau().textContent).toContain('Solde par compte')
    expect(titresAlertes()).toContain('Comptes conformes au mode appliqué.')
  })

  it('IBAN invalide : refus par toast, formulaire ouvert, rien n’est écrit', async () => {
    const { push } = await rendre()
    await saisirCompte({ iban: IBAN_FAUX })
    await enregistrer()
    expect(dernierToast(push)).toMatchObject({ kind: 'warn', title: 'Enregistrement impossible' })
    expect(String(dernierToast(push)?.desc)).toMatch(/IBAN invalide/)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(await ajDb.banques.count()).toBe(0)
  })

  it('échec d’écriture de la base : toast d’avertissement, formulaire ouvert', async () => {
    const { push } = await rendre()
    await saisirCompte({ iban: IBAN_A })
    const espion = vi.spyOn(ajDb.banques, 'add').mockRejectedValueOnce(new Error('Quota dépassé'))
    await enregistrer()
    espion.mockRestore()
    expect(dernierToast(push)).toMatchObject({ kind: 'warn', title: 'Enregistrement impossible', desc: 'Quota dépassé' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('fonds de travaux sur le même IBAN que le compte courant : alerte bloquante et son fondement', async () => {
    await ajouter({ nature: 'courant', iban: IBAN_A })
    await ajouter({ nature: 'fonds_travaux', iban: 'FR7630006000011234567890189' })
    await rendre()
    const alerte = Array.from(panneau().querySelectorAll('.alert.rust')).find((element) =>
      element.textContent?.includes("Fonds de travaux : même IBAN qu'un autre compte du mandat."),
    )
    expect(alerte).toBeDefined()
    expect(alerte?.textContent).toContain('Fondement : L. 1965 art. 18, II, al. 4')
    expect(titresAlertes()).not.toContain('Comptes conformes au mode appliqué.')
  })

  it('compte à la Caisse des dépôts : information sans blocage (J67, R95)', async () => {
    await ajouter({ nature: 'courant', iban: IBAN_A })
    await ajouter({ nature: 'caisse_depots', iban: '' })
    await rendre()
    expect(panneau().textContent).toContain(
      "Compte à la Caisse des dépôts : compte au nom de l'administrateur (C. com. R. 814-41) ; compte séparé au nom du syndicat (L. 1965 art. 18, II, al. 3) : articulation non établie.",
    )
    expect(titresAlertes()).toContain('Comptes conformes au mode appliqué.')
    // Sans IBAN propre : « — » dans la colonne IBAN.
    const ligneCdc = lignesComptes().find((ligne) => ligne.textContent?.includes('Compte à la Caisse des dépôts'))
    expect(ligneCdc?.querySelector('.mono')?.textContent).toBe('—')
  })

  it('obligation du fonds de travaux non établie : motif du domaine affiché, pas d’anomalie « fonds manquant »', async () => {
    await ajouter({ nature: 'courant', iban: IBAN_A })
    await rendre()
    expect(titresAlertes()).toContain('Obligation du fonds de travaux non établie')
    expect(panneau().textContent).toContain("Destination de l'immeuble à renseigner")
    expect(panneau().textContent).not.toContain('Fonds de travaux : ouvrir un compte séparé')
  })

  it('obligation du fonds de travaux non établie : le bandeau dit que la saisie de la destination n’existe pas encore', async () => {
    await rendre()
    const bandeau = Array.from(panneau().querySelectorAll('.alert')).find(
      (alerte) => alerte.querySelector('b')?.textContent === 'Obligation du fonds de travaux non établie',
    )
    // Décision du 19/11 (#758, point 6) : dit dans le bandeau, sans créer la saisie ici (aucun champ dans le panneau).
    expect(bandeau?.textContent).toContain(
      "Destination de l'immeuble à renseigner : le fonds n'est obligatoire que si l'immeuble est, même en partie, à usage d'habitation. La saisie de la destination de l'immeuble n'existe pas encore. Le contrôle « fonds de travaux à ouvrir » n'est donc pas lancé.",
    )
    expect(dansPanneau().queryByLabelText(/Destination/)).toBeNull()
  })

  it('compte repris de l’ancien gestionnaire : marque « tenait le fonds », pastille, solde inconnu signalé', async () => {
    await rendre()
    await saisirCompte({ nature: 'repris_ancien_gestionnaire', iban: IBAN_B })
    expect(dialogue().queryByLabelText('Réservé au fonds de travaux')).toBeNull()
    fireEvent.click(dialogue().getByLabelText('Tenait le fonds de travaux'))
    await enregistrer()
    expect((await ajDb.banques.toArray())[0]).toMatchObject({ nature: 'repris_ancien_gestionnaire', tenaitFondsTravaux: true })
    const ligne = lignesComptes()[0]
    expect(within(ligne).getByText('Tient le fonds de travaux')).toBeInTheDocument()
    // Même libellé que la nature du compte, dans le tableau et dans le bandeau.
    expect(titresAlertes()).toContain("Compte repris de l'ancien syndic ou administrateur : solde inconnu ici.")
    expect(panneau().textContent).not.toContain('ancien gestionnaire')
    expect(panneau().textContent).not.toContain('non soldé')
  })

  it('placement : seule la marque « réservé au fonds de travaux » est proposée', async () => {
    await rendre()
    await saisirCompte({ nature: 'placement', iban: IBAN_B })
    expect(dialogue().queryByLabelText('Tenait le fonds de travaux')).toBeNull()
    fireEvent.click(dialogue().getByLabelText('Réservé au fonds de travaux'))
    await enregistrer()
    expect((await ajDb.banques.toArray())[0]).toMatchObject({ nature: 'placement', reserveAuFondsTravaux: true })
    expect(within(lignesComptes()[0]).getByText('Tient le fonds de travaux')).toBeInTheDocument()
  })

  it('lecture des comptes impossible : toast et alerte, aucun contrôle affiché, « Nouveau compte » inactif', async () => {
    const espion = vi.spyOn(ajDb.banques, 'toArray').mockRejectedValueOnce(new Error('Base verrouillée'))
    const { push } = await rendre()
    espion.mockRestore()
    expect(push).toHaveBeenCalledWith({ kind: 'warn', title: 'Comptes bancaires illisibles', desc: 'Base verrouillée' })
    expect(titresAlertes()).toEqual(['Comptes bancaires illisibles'])
    expect(dansPanneau().getByRole('button', { name: /Nouveau compte/ })).toBeDisabled()
    // Réglage du cabinet non lu : ni « Mode appliqué » ni le défaut du domaine présenté comme le réglage enregistré.
    expect(panneau().textContent).not.toContain('Mode appliqué')
    expect(dansPanneau().queryByText('Réglage du cabinet')).toBeNull()
    const reglage = dansPanneau().getByLabelText('Réglage du cabinet (mode par défaut)')
    expect(reglage).toHaveDisplayValue('—')
    expect(reglage).toBeDisabled()
  })

  it('lecture en cours : « Chargement… », ni « Mode appliqué » ni réglage du cabinet présenté comme lu', async () => {
    // Lecture jamais terminée : le panneau reste dans l'état « Chargement… ».
    const espion = vi.spyOn(ajDb.banques, 'toArray').mockReturnValueOnce(new Promise<never>(() => undefined) as never)
    await rendre({ lectureFinie: false })
    espion.mockRestore()
    expect(dansPanneau().getByText('Chargement…')).toBeInTheDocument()
    expect(panneau().textContent).not.toContain('Mode appliqué')
    expect(dansPanneau().queryByText('Réglage du cabinet')).toBeNull()
    expect(dansPanneau().getByLabelText('Réglage du cabinet (mode par défaut)')).toHaveDisplayValue('—')
  })

  it('ligne sans nature écrite hors de l’écran : comptée et signalée, hors des contrôles', async () => {
    await ajDb.banques.add({
      id: 'banque-externe',
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      createdBy: null,
      updatedBy: null,
      coproprieteId: copro.id,
    })
    await rendre()
    expect(titresAlertes()).toContain('1 compte de la base non affiché')
    expect(lignesComptes()).toHaveLength(0)
    // La base a une ligne : « Aucun compte enregistré » la contredirait.
    expect(dansPanneau().queryByText('Aucun compte enregistré pour cette copropriété.')).toBeNull()
  })

  it('deux anomalies de même message (IBAN invalides écrits hors de l’écran) : toutes deux affichées, sans clé React en double', async () => {
    const ligneExterne = (id: string) => ({
      id,
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      createdBy: null,
      updatedBy: null,
      coproprieteId: copro.id,
      nature: 'courant' as const,
      iban: 'FR7630006000011234567890188',
      actif: true,
    })
    await ajDb.banques.bulkAdd([ligneExterne('banque-externe-1'), ligneExterne('banque-externe-2')])
    const espion = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await rendre()
    const messages = espion.mock.calls.map((appel) => appel.map(String).join(' '))
    espion.mockRestore()
    expect(titresAlertes().filter((titre) => titre === 'Compte courant au nom du syndicat : IBAN invalide (format ou clé).')).toHaveLength(2)
    expect(messages.filter((message) => /same key/.test(message))).toEqual([])
  })

  it('aucune copropriété choisie : message, « Nouveau compte » inactif, aucune liste de mode', async () => {
    useSelectionDossier.setState({ code: 'ZZ-INCONNUE', coproprietaireId: null })
    await rendre()
    expect(dansPanneau().getByText('Aucune copropriété choisie.')).toBeInTheDocument()
    expect(dansPanneau().getByRole('button', { name: /Nouveau compte/ })).toBeDisabled()
    expect(dansPanneau().queryByLabelText('Ce mandat')).toBeNull()
  })
})

describe('Comptes bancaires en mode réel — modifier et clôturer', () => {
  it('« Modifier » : formulaire prérempli, même ligne en base', async () => {
    const cree = await ajouter({ libelle: 'Compte principal', iban: IBAN_A })
    const { push } = await rendre()
    fireEvent.click(within(lignesComptes()[0]).getByRole('button', { name: /^Modifier/ }))
    expect(dialogue().getByLabelText('Libellé')).toHaveValue('Compte principal')
    expect(dialogue().getByLabelText('IBAN')).toHaveValue('FR76 3000 6000 0112 3456 7890 189')
    fireEvent.change(dialogue().getByLabelText('Libellé'), { target: { value: 'Compte de gestion' } })
    await enregistrer()
    const lignes = await ajDb.banques.toArray()
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({ id: cree.id, libelle: 'Compte de gestion' })
    expect(dernierToast(push)).toMatchObject({ kind: 'success', title: 'Compte modifié' })
    expect(lignesComptes()[0].textContent).toContain('Compte de gestion')
  })

  it('« Clôturer » : confirmation, compte inactif en base, marqué « Clôturé », retiré des contrôles', async () => {
    const cree = await ajouter({ iban: IBAN_A })
    const { push } = await rendre()
    expect(titresAlertes()).toContain('Comptes conformes au mode appliqué.')
    await demanderCloture(within(lignesComptes()[0]).getByRole('button', { name: /^Clôturer/ }))
    await act(async () => {
      fireEvent.click(dialogue().getByRole('button', { name: 'Clôturer le compte' }))
    })
    await patienter()
    expect((await ajDb.banques.get(cree.id))?.actif).toBe(false)
    expect(dernierToast(push)).toMatchObject({ kind: 'success', title: 'Compte clôturé' })
    expect(within(lignesComptes()[0]).getByText('Clôturé')).toBeInTheDocument()
    expect(within(lignesComptes()[0]).queryByRole('button', { name: /^Clôturer/ })).toBeNull()
    expect(titresAlertes()).toContain(
      'Compte courant au nom du syndicat : compte à ouvrir, requis par le mode retenu (Compte séparé au nom du syndicat).',
    )
  })

  it('compte du fonds de travaux clôturé : « Clôturé », sans la pastille « Tient le fonds de travaux »', async () => {
    await ajouter({ nature: 'courant', iban: IBAN_A })
    await ajouter({ nature: 'fonds_travaux', iban: IBAN_B })
    await rendre()
    const ligneFonds = () => lignesComptes().find((ligne) => ligne.textContent?.includes('Compte séparé du fonds de travaux')) as HTMLElement
    expect(within(ligneFonds()).getByText('Tient le fonds de travaux')).toBeInTheDocument()
    await demanderCloture(within(ligneFonds()).getByRole('button', { name: /^Clôturer/ }))
    await act(async () => {
      fireEvent.click(dialogue().getByRole('button', { name: 'Clôturer le compte' }))
    })
    await patienter()
    expect(within(ligneFonds()).getByText('Clôturé')).toBeInTheDocument()
    expect(within(ligneFonds()).queryByText('Tient le fonds de travaux')).toBeNull()
  })

  it('confirmation « Clôturer » : dit qu’il n’y a pas de retour depuis cet écran, et aucune action ne rouvre le compte', async () => {
    await ajouter({ iban: IBAN_A })
    await rendre()
    await demanderCloture(within(lignesComptes()[0]).getByRole('button', { name: /^Clôturer/ }))
    // Décision du 19/11 (#758, point 2) : la confirmation le dit avant le clic.
    expect(screen.getByRole('dialog').textContent).toContain('Sans retour depuis cet écran.')
    await act(async () => {
      fireEvent.click(dialogue().getByRole('button', { name: 'Clôturer le compte' }))
    })
    await patienter()
    expect(within(lignesComptes()[0]).getByText('Clôturé')).toBeInTheDocument()
    expect(dansPanneau().queryByRole('button', { name: /Rouvrir/ })).toBeNull()
  })

  /** Clique « Clôturer le compte » dans la confirmation et attend le toast qui confirme ou refuse l'écriture. */
  async function confirmerCloture() {
    const toasts = pushCourant?.mock.calls.length ?? 0
    await act(async () => {
      fireEvent.click(dialogue().getByRole('button', { name: 'Clôturer le compte' }))
    })
    await waitFor(() => expect(pushCourant?.mock.calls.length ?? 0).toBeGreaterThan(toasts))
    await patienter()
  }

  // Réponse du référent métier du 28/11/2026, point #857 · 1, choix A.
  it('« Clôturer » un compte dont un arrêté est en cours : refus dès le clic, par un toast qui dit quoi faire, sans confirmation ; compte toujours actif', async () => {
    const cree = await ajouter({ libelle: 'Compte principal', iban: IBAN_A })
    const arrete = await rapprochementsDb.ouvrirArreteCompte(cree.id, { dateArrete: '2026-10-31', soldeBanqueCentimes: 0 })
    const { push } = await rendre()
    const toasts = push.mock.calls.length
    await act(async () => {
      fireEvent.click(within(lignesComptes()[0]).getByRole('button', { name: /^Clôturer/ }))
    })
    await waitFor(() => expect(push.mock.calls.length).toBeGreaterThan(toasts))
    expect(dernierToast(push)).toEqual({
      kind: 'warn',
      title: 'Clôture impossible',
      desc: 'Un arrêté est en cours sur ce compte : le clôturer ou l’abandonner d’abord.',
    })
    // Aucune confirmation : le message reste lisible, rien n'est à confirmer.
    await patienter()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((await ajDb.banques.get(cree.id))?.actif).toBe(true)
    expect(within(lignesComptes()[0]).queryByText('Clôturé')).toBeNull()

    // L'arrêté abandonné (ou clôturé), « Clôturer » ouvre la confirmation et le compte se clôture.
    await rapprochementsDb.abandonnerArreteCompte(arrete.id)
    await demanderCloture(within(lignesComptes()[0]).getByRole('button', { name: /^Clôturer/ }))
    await confirmerCloture()
    expect(dernierToast(push)).toMatchObject({ kind: 'success', title: 'Compte clôturé' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((await ajDb.banques.get(cree.id))?.actif).toBe(false)
  })

  it('arrêté ouvert pendant que la confirmation est affichée : l’écriture refuse encore, compte toujours actif', async () => {
    const cree = await ajouter({ libelle: 'Compte principal', iban: IBAN_A })
    const { push } = await rendre()
    await demanderCloture(within(lignesComptes()[0]).getByRole('button', { name: /^Clôturer/ }))
    await rapprochementsDb.ouvrirArreteCompte(cree.id, { dateArrete: '2026-10-31', soldeBanqueCentimes: 0 })
    await confirmerCloture()
    expect(dernierToast(push)).toEqual({
      kind: 'warn',
      title: 'Clôture impossible',
      desc: 'Un arrêté est en cours sur ce compte : le clôturer ou l’abandonner d’abord.',
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect((await ajDb.banques.get(cree.id))?.actif).toBe(true)
  })

  it('arrêté illisible sur le compte (écrit hors de l’écran) : refus dès le clic, sans confirmation', async () => {
    const cree = await ajouter({ libelle: 'Compte principal', iban: IBAN_A })
    await ajDb.rapprochements.add({
      id: 'arrete-externe',
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      createdBy: null,
      updatedBy: null,
      bancaireId: cree.id,
      statut: 'En cours',
    })
    const { push } = await rendre()
    const toasts = push.mock.calls.length
    await act(async () => {
      fireEvent.click(within(lignesComptes()[0]).getByRole('button', { name: /^Clôturer/ }))
    })
    await waitFor(() => expect(push.mock.calls.some((appel, rang) => rang >= toasts && appel[0].title === 'Clôture impossible')).toBe(true))
    const refus = push.mock.calls.map((appel) => appel[0]).find((toast) => toast.title === 'Clôture impossible')
    expect(String(refus?.desc)).toMatch(/1 arrêté illisible sur ce compte/)
    await patienter()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((await ajDb.banques.get(cree.id))?.actif).toBe(true)
  })

  // Réponse du référent métier du 28/11/2026, point #857 · 5, choix A.
  it('confirmation « Clôturer » d’un compte au solde non nul : avertissement qui donne le solde du tableau, sans bloquer la clôture', async () => {
    const cree = await ajouter({ libelle: 'Ancien compte', iban: IBAN_A })
    await relevesDb.importerReleveSurCompte(copro.id, cree.id, [{ date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 }])
    const { push } = await rendre()
    // Solde du tableau des comptes (comptes-bancaires-vue.ts) : le même montant dans la confirmation.
    expect(lignesComptes()[0].textContent).toContain('450,00\u00a0€')
    await demanderCloture(within(lignesComptes()[0]).getByRole('button', { name: /^Clôturer/ }))
    const alerte = screen.getByRole('dialog').querySelector('.alert.warn') as HTMLElement
    expect(alerte.querySelector('b')?.textContent).toBe('Solde du compte non nul : 450,00\u00a0€')
    expect(alerte.textContent).toContain('Avertissement, sans blocage : la clôture reste possible. Vérifier qu’aucun relevé ne manque.')
    expect(dialogue().getByRole('button', { name: 'Clôturer le compte' })).toBeEnabled()
    await confirmerCloture()
    expect(dernierToast(push)).toMatchObject({ kind: 'success', title: 'Compte clôturé' })
    expect((await ajDb.banques.get(cree.id))?.actif).toBe(false)
    expect(within(lignesComptes()[0]).getByText('Clôturé')).toBeInTheDocument()
  })

  it('confirmation « Clôturer » d’un compte à découvert : avertissement avec le solde négatif', async () => {
    const cree = await ajouter({ libelle: 'Ancien compte', iban: IBAN_A })
    await relevesDb.importerReleveSurCompte(copro.id, cree.id, [{ date: '2026-05-20', libelle: 'PRLV EAU', montant: -120.5 }])
    await rendre()
    await demanderCloture(within(lignesComptes()[0]).getByRole('button', { name: /^Clôturer/ }))
    expect(screen.getByRole('dialog').querySelector('.alert.warn b')?.textContent).toBe('Solde du compte non nul : -120,50\u00a0€')
  })

  it('confirmation « Clôturer » : aucun avertissement de solde pour un solde nul, ni pour un solde inconnu (aucune ligne importée)', async () => {
    const solde = await ajouter({ libelle: 'Compte soldé', iban: IBAN_A })
    await relevesDb.importerReleveSurCompte(copro.id, solde.id, [
      { date: '2026-05-10', libelle: 'VIR CHARGES', montant: 450 },
      { date: '2026-05-20', libelle: 'VIR VERS NOUVEAU COMPTE', montant: -450 },
    ])
    await ajouter({ nature: 'fonds_travaux', libelle: 'Sans ligne', iban: IBAN_B })
    await rendre()
    for (const nom of ['Clôturer Compte soldé', 'Clôturer Sans ligne']) {
      await demanderCloture(dansPanneau().getByRole('button', { name: nom }))
      expect(screen.getByRole('dialog').textContent).toContain('Sans retour depuis cet écran.')
      expect(screen.getByRole('dialog').querySelector('.alert')).toBeNull()
      expect(screen.getByRole('dialog').textContent).not.toContain('Solde du compte non nul')
      fireEvent.click(dialogue().getByRole('button', { name: 'Annuler' }))
    }
  })

  it('« Clôturer » puis « Annuler » : rien ne change', async () => {
    const cree = await ajouter({ iban: IBAN_A })
    await rendre()
    await demanderCloture(within(lignesComptes()[0]).getByRole('button', { name: /^Clôturer/ }))
    fireEvent.click(dialogue().getByRole('button', { name: 'Annuler' }))
    await patienter()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((await ajDb.banques.get(cree.id))?.actif).toBe(true)
  })
})

describe('Comptes bancaires en mode réel — modes de tenue et leur origine', () => {
  it('choix du mandat : pastille « Choix du mandat », écrit sur le mandat ; « Comme le cabinet » le retire', async () => {
    const { push } = await rendre()
    await act(async () => {
      fireEvent.change(dansPanneau().getByLabelText('Ce mandat'), { target: { value: 'caisse_depots' } })
    })
    await patienter()
    expect((await ajDb.mandats.get(copro.mandatId))?.modeComptesBancaires).toBe('caisse_depots')
    expect(dernierToast(push)).toMatchObject({ kind: 'success', title: 'Mode du mandat enregistré' })
    expect(panneau().textContent).toContain('Mode appliqué : Compte à la Caisse des dépôts')
    expect(dansPanneau().getByText('Choix du mandat')).toBeInTheDocument()
    expect(dansPanneau().queryByText('Réglage du cabinet')).toBeNull()

    await act(async () => {
      fireEvent.change(dansPanneau().getByLabelText('Ce mandat'), { target: { value: '' } })
    })
    await patienter()
    expect((await ajDb.mandats.get(copro.mandatId))?.modeComptesBancaires).toBeNull()
    expect(dansPanneau().getByText('Réglage du cabinet')).toBeInTheDocument()
  })

  it('réglage du cabinet changé dans le panneau : écrit dans « cabinets », appliqué au mandat sans choix', async () => {
    const { push } = await rendre()
    await act(async () => {
      fireEvent.change(dansPanneau().getByLabelText('Réglage du cabinet (mode par défaut)'), {
        target: { value: 'banque_et_caisse_depots' },
      })
    })
    await patienter()
    expect((await ajDb.cabinets.toArray()).map((cabinet) => cabinet.modeComptesBancaires)).toEqual(['banque_et_caisse_depots'])
    expect(dernierToast(push)).toMatchObject({ kind: 'success', title: 'Réglage du cabinet enregistré' })
    expect(panneau().textContent).toContain('Mode appliqué : Compte en banque et dépôt à la Caisse des dépôts')
    expect(dansPanneau().getByText('Réglage du cabinet')).toBeInTheDocument()
    expect(titresAlertes()).toEqual(
      expect.arrayContaining([
        'Compte courant au nom du syndicat : compte à ouvrir, requis par le mode retenu (Compte en banque et dépôt à la Caisse des dépôts).',
        'Compte à la Caisse des dépôts : compte à ouvrir, requis par le mode retenu (Compte en banque et dépôt à la Caisse des dépôts).',
      ]),
    )
  })

  it('administrateur provisoire : la pratique du cabinet est proposée, jamais imposée (J37)', async () => {
    cleanup()
    copro = await creerCopro('Villa Bleue', 'Administrateur provisoire (art. 47)')
    await rendre()
    const choix = dansPanneau().getByLabelText('Ce mandat')
    expect(choix).toHaveDisplayValue('Comme le cabinet')
    expect(choix.closest('.field')?.querySelector('.field-hint')?.textContent).toContain(
      'Pratique du cabinet pour un administrateur provisoire : Compte à la Caisse des dépôts. Proposée, jamais imposée.',
    )
    expect(panneau().textContent).toContain('Mode appliqué : Compte séparé au nom du syndicat')
    expect((await ajDb.mandats.get(copro.mandatId))?.modeComptesBancaires ?? null).toBeNull()
  })

  it('syndic judiciaire : aucune pratique d’administrateur provisoire affichée', async () => {
    await rendre()
    expect(panneau().textContent).not.toContain('administrateur provisoire')
  })

  it('copropriété sans mandat chargé : indication, liste « Ce mandat » inactive, le réglage du cabinet s’applique', async () => {
    useDonneesStore.setState({ mandats: [] })
    await rendre()
    const choix = dansPanneau().getByLabelText('Ce mandat')
    expect(choix).toBeDisabled()
    expect(choix.closest('.field')?.querySelector('.field-hint')?.textContent).toBe('Aucun mandat enregistré pour cette copropriété.')
    expect(dansPanneau().getByText('Réglage du cabinet')).toBeInTheDocument()
    expect((await ajDb.mandats.get(copro.mandatId))?.modeComptesBancaires ?? null).toBeNull()
  })

  it('mode du mandat illisible (écrit hors de l’écran) : alerte, la liste montre ce mode ; un mode valide le remplace', async () => {
    await ajDb.mandats.update(copro.mandatId, { modeComptesBancaires: 'livret' as never })
    await reinitialiserStore()
    useSelectionDossier.setState({ code: copro.code, coproprietaireId: null })
    const { push } = await rendre()
    expect(titresAlertes()).toContain('Mode du mandat illisible')
    expect(panneau().textContent).toContain('Mode de tenue inconnu : « livret ».')
    expect(panneau().textContent).not.toContain('Mode appliqué')
    // Les contrôles dépendent du mode : masqués. Les comptes, eux, restent affichés (ici : aucun).
    expect(titresAlertes()).not.toContain('Comptes conformes au mode appliqué.')
    expect(titresAlertes().filter((titre) => titre.includes('compte à ouvrir'))).toEqual([])
    expect(dansPanneau().getByText('Aucun compte enregistré pour cette copropriété.')).toBeInTheDocument()
    // La liste ne doit pas afficher « Comme le cabinet », que le bandeau contredirait.
    expect(dansPanneau().getByLabelText('Ce mandat')).toHaveDisplayValue('Mode illisible : « livret »')

    await act(async () => {
      fireEvent.change(dansPanneau().getByLabelText('Ce mandat'), { target: { value: 'caisse_depots' } })
    })
    await patienter()
    expect(dernierToast(push)).toMatchObject({ kind: 'success', title: 'Mode du mandat enregistré' })
    expect((await ajDb.mandats.get(copro.mandatId))?.modeComptesBancaires).toBe('caisse_depots')
    expect(titresAlertes()).not.toContain('Mode du mandat illisible')
    expect(dansPanneau().getByText('Choix du mandat')).toBeInTheDocument()
  })

  it('mode du mandat illisible : un compte créé reste visible dans le tableau, contrôles masqués', async () => {
    await ajDb.mandats.update(copro.mandatId, { modeComptesBancaires: 'livret' as never })
    await reinitialiserStore()
    useSelectionDossier.setState({ code: copro.code, coproprietaireId: null })
    const { push } = await rendre()
    await saisirCompte({ libelle: 'Compte principal', iban: IBAN_A })
    await enregistrer()
    expect(dernierToast(push)).toMatchObject({ kind: 'success', title: 'Compte enregistré' })
    expect(lignesComptes()).toHaveLength(1)
    expect(lignesComptes()[0].textContent).toContain('Compte principal')
    expect(dansPanneau().queryByText('Aucun compte enregistré pour cette copropriété.')).toBeNull()
    expect(panneau().textContent).toContain('Solde par compte')
    // Bandeau gardé ; « Mode appliqué » et contrôles (qui dépendent du mode) masqués.
    expect(titresAlertes()).toContain('Mode du mandat illisible')
    expect(panneau().textContent).not.toContain('Mode appliqué')
    expect(titresAlertes()).not.toContain('Comptes conformes au mode appliqué.')
  })

  it('mode du mandat illisible et lecture impossible : les deux bandeaux, sans « Mode appliqué »', async () => {
    await ajDb.mandats.update(copro.mandatId, { modeComptesBancaires: 'livret' as never })
    await reinitialiserStore()
    useSelectionDossier.setState({ code: copro.code, coproprietaireId: null })
    const espion = vi.spyOn(ajDb.banques, 'toArray').mockRejectedValueOnce(new Error('Base verrouillée'))
    await rendre()
    espion.mockRestore()
    // Le refus du mode par le domaine ne dépend pas du réglage du cabinet : le bandeau reste, réglage non lu.
    expect(titresAlertes()).toContain('Comptes bancaires illisibles')
    expect(titresAlertes()).toContain('Mode du mandat illisible')
    expect(panneau().textContent).toContain('Mode de tenue inconnu : « livret ».')
    expect(panneau().textContent).not.toContain('Mode appliqué')
  })

  it('mode du mandat illisible pendant la première lecture : bandeau affiché, sans « Mode appliqué »', async () => {
    await ajDb.mandats.update(copro.mandatId, { modeComptesBancaires: 'livret' as never })
    await reinitialiserStore()
    useSelectionDossier.setState({ code: copro.code, coproprietaireId: null })
    // Lecture jamais terminée : le réglage du cabinet n'est pas lu.
    const espion = vi.spyOn(ajDb.banques, 'toArray').mockReturnValueOnce(new Promise<never>(() => undefined) as never)
    await rendre({ lectureFinie: false })
    espion.mockRestore()
    expect(dansPanneau().getByText('Chargement…')).toBeInTheDocument()
    expect(titresAlertes()).toContain('Mode du mandat illisible')
    expect(panneau().textContent).not.toContain('Mode appliqué')
  })
})

describe('Comptes bancaires en mode réel — données relues', () => {
  it('après rechargement du store et remontage : comptes, choix du mandat et réglage du cabinet relus de la base', async () => {
    await rendre()
    await saisirCompte({ libelle: 'Compte principal', iban: IBAN_A })
    await enregistrer()
    await act(async () => {
      fireEvent.change(dansPanneau().getByLabelText('Ce mandat'), { target: { value: 'banque_et_caisse_depots' } })
    })
    await patienter()
    await act(async () => {
      fireEvent.change(dansPanneau().getByLabelText('Réglage du cabinet (mode par défaut)'), { target: { value: 'caisse_depots' } })
    })
    await patienter()

    cleanup()
    await reinitialiserStore()
    useSelectionDossier.setState({ code: copro.code, coproprietaireId: null })
    await rendre()
    expect(lignesComptes()).toHaveLength(1)
    expect(lignesComptes()[0].textContent).toContain('Compte principal')
    expect(dansPanneau().getByLabelText('Ce mandat')).toHaveValue('banque_et_caisse_depots')
    expect(dansPanneau().getByLabelText('Réglage du cabinet (mode par défaut)')).toHaveValue('caisse_depots')
    expect(dansPanneau().getByText('Choix du mandat')).toBeInTheDocument()
    expect(panneau().textContent).toContain('Mode appliqué : Compte en banque et dépôt à la Caisse des dépôts')
  })

  it('changement de copropriété : les comptes de la nouvelle copropriété sont lus', async () => {
    await ajouter({ libelle: 'Compte des Acacias', iban: IBAN_A })
    const autre = await useDonneesStore.getState().createCopropriete({
      nom: 'Villa Bleue',
      adresse: '2 rue de l’Exemple, 75000 Paris',
      nbLots: 4,
      rg: '26/00002',
      fondement: 'art. 46 — carence',
    })
    await rendre()
    expect(lignesComptes()[0].textContent).toContain('Compte des Acacias')
    await act(async () => {
      useSelectionDossier.getState().choisirCopro(autre.code)
    })
    await patienter()
    expect(lignesComptes()).toHaveLength(0)
    expect(dansPanneau().getByText('Aucun compte enregistré pour cette copropriété.')).toBeInTheDocument()
  })
})

describe('Rapprochement en mode réel', () => {
  it('« Nouvel arrêté » : date du jour réelle proposée, arrêté écrit dans « rapprochements » sur le compte créé', async () => {
    const { AUJOURDHUI_ISO } = await import('@/lib/administrateur-judiciaire/mode')
    const cree = await ajouter({ libelle: 'Compte principal', iban: IBAN_A })
    const { push } = await rendre()
    const rapprochement = screen.getByRole('heading', { level: 3, name: 'Rapprochement bancaire' }).closest('.panel') as HTMLElement
    fireEvent.click(within(rapprochement).getByRole('button', { name: /Nouvel arrêté/ }))
    expect(dialogue().getByLabelText('Date de l’arrêté')).toHaveValue(AUJOURDHUI_ISO)
    fireEvent.change(dialogue().getByLabelText('Solde banque'), { target: { value: '0' } })
    await enregistrer()
    expect(dernierToast(push)).toMatchObject({ kind: 'success', title: 'Arrêté ouvert' })
    expect(await ajDb.rapprochements.toArray()).toEqual([
      expect.objectContaining({ bancaireId: cree.id, dateArrete: AUJOURDHUI_ISO, soldeBanqueCentimes: 0, soldeComptaCentimes: 0, statut: 'En cours' }),
    ])
  })
})
