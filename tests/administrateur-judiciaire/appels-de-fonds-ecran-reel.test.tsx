import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentType, ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Écran « Appels de fonds » EN MODE DONNÉES RÉELLES (plan des écrans, § 5.5 à 5.10) : échéancier, avis par
 * copropriétaire calculé sur les tables D2 (identités, positions, comptes, clés, échéances), écriture de l'appel et
 * passage « Appelé », lot de prélèvements SEPA affiché (jamais transmis). Le mode est lu au chargement des modules : il
 * est posé dans le stockage, puis les modules sont rechargés (comme comptes-bancaires-ecran-reel). Jour figé au
 * 01/12/2026 (seule la date est simulée : la base locale garde ses minuteries). Données fictives ; IBAN d'exemple déjà
 * utilisés par les tests du dépôt.
 */

const CLE_STOCKAGE_MODE = 'vitfix.aj.mode'
const IBAN_DEBITEUR = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_FAUX = 'FR76 3000 6000 0112 3456 7890 188'
const ICS = 'FR12ZZZ123456'

type Push = (options: { kind?: string; title?: ReactNode; desc?: ReactNode }) => number | undefined

let AppelsDeFondsModule: ComponentType
let ToastContext: typeof import('@/components/administrateur-judiciaire/ui/toast').ToastContext
let useDonneesStore: typeof import('@/lib/administrateur-judiciaire/db/donnees-store').useDonneesStore
let useSelectionDossier: typeof import('@/lib/administrateur-judiciaire/selection').useSelectionDossier
let ajDb: typeof import('@/lib/administrateur-judiciaire/db/schema').ajDb
let viderBaseLocale: () => Promise<void>
let appelsDb: typeof import('@/lib/administrateur-judiciaire/db/appels-de-fonds')
let repos: typeof import('@/lib/administrateur-judiciaire/db/repositories')
let d2: typeof import('@/lib/administrateur-judiciaire/domain/identites-positions')
let segmentComptableSyndicat: typeof import('@/lib/administrateur-judiciaire/domain/journal-traitements').segmentComptableSyndicat
let nouvelleFicheCopropriete: typeof import('@/lib/administrateur-judiciaire/domain/fiche-copropriete').nouvelleFicheCopropriete
let statutEcran: typeof import('@/components/administrateur-judiciaire/modules/registry').statutEcran

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 11, 1, 10, 0, 0))
  localStorage.setItem(CLE_STOCKAGE_MODE, 'reel')
  vi.resetModules()
  ;({ AppelsDeFondsModule } = await import('@/components/administrateur-judiciaire/modules/finances/AppelsDeFondsModule'))
  ;({ ToastContext } = await import('@/components/administrateur-judiciaire/ui/toast'))
  ;({ useDonneesStore } = await import('@/lib/administrateur-judiciaire/db/donnees-store'))
  ;({ useSelectionDossier } = await import('@/lib/administrateur-judiciaire/selection'))
  ;({ ajDb } = await import('@/lib/administrateur-judiciaire/db/schema'))
  ;({ viderBaseLocale } = await import('@/lib/administrateur-judiciaire/db/reset'))
  appelsDb = await import('@/lib/administrateur-judiciaire/db/appels-de-fonds')
  repos = await import('@/lib/administrateur-judiciaire/db/repositories')
  d2 = await import('@/lib/administrateur-judiciaire/domain/identites-positions')
  ;({ segmentComptableSyndicat } = await import('@/lib/administrateur-judiciaire/domain/journal-traitements'))
  ;({ nouvelleFicheCopropriete } = await import('@/lib/administrateur-judiciaire/domain/fiche-copropriete'))
  ;({ statutEcran } = await import('@/components/administrateur-judiciaire/modules/registry'))
  const { MODE_ACTIF, AUJOURDHUI_ISO } = await import('@/lib/administrateur-judiciaire/mode')
  expect(MODE_ACTIF).toBe('reel')
  expect(AUJOURDHUI_ISO).toBe('2026-12-01')
})

afterAll(() => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  vi.useRealTimers()
})

const SAISIE_COPRO = { nom: 'Résidence des Acacias', adresse: '1 rue de l’Exemple, 75000 Paris', nbLots: 3, rg: '26/00001', fondement: 'L. 1965 art. 29-1' }
let copro: Awaited<ReturnType<ReturnType<typeof useDonneesStore.getState>['createCopropriete']>>
let segment: string

beforeEach(async () => {
  await viderBaseLocale()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
  useDonneesStore.setState({ loaded: false, loading: false, erreur: null, coproprietes: [], mandats: [], lots: [], coproprietaires: [] })
  await useDonneesStore.getState().loadAll()
  copro = await useDonneesStore.getState().createCopropriete(SAISIE_COPRO)
  await useDonneesStore.getState().updateCopropriete(copro.id, { ...SAISIE_COPRO, fiche: nouvelleFicheCopropriete({ ics: ICS }) })
  useSelectionDossier.setState({ code: copro.code, coproprietaireId: null })
  segment = segmentComptableSyndicat(copro.code)
  const suivi = { createdAt: '2026-12-01T09:00:00.000Z', updatedAt: '2026-12-01T09:00:00.000Z', createdBy: null, updatedBy: null }
  await ajDb.lots.bulkAdd(
    [
      ['L1', '1', 450],
      ['L2', '2', 350],
      ['L3', '3', 200],
    ].map(([id, numero, numerateur]) => ({ id: String(id), coproprieteId: copro.id, numero: String(numero), tantiemes: { numerateur: Number(numerateur), denominateur: 1000 }, ...suivi })),
  )
})

afterEach(() => cleanup())

/** Identités, comptes et positions fictifs : un compte par lot, sauf le lot 3 si `sansLot3`. */
async function donneesD2({ sansLot3 = false } = {}) {
  for (const n of ['1', '2', '3']) {
    if (sansLot3 && n === '3') continue
    const { id: _i, ...identite } = d2.creerIdentite({ id: `i${n}`, nature: 'physique', civilite: '', nom: `Personne ${n}`, prenom: null, telecoms: [] })
    await repos.repoIdentites.create(identite, { id: `i${n}` })
    const { id: _c, ...compte } = d2.creerCompteCoproprietaire({ id: `c${n}`, coproprieteId: copro.id, serie: n, libelle: `Copropriétaire ${n} (fictif)` })
    await repos.repoComptesCoproprietaires.create(compte, { id: `c${n}` })
    const { id: _p, ...position } = d2.creerPosition({
      id: `p${n}`,
      identiteId: `i${n}`,
      lotId: `L${n}`,
      compteId: `c${n}`,
      qualite: 'Copropriétaire',
      part: { numerateur: 1, denominateur: 1 },
      statut: 'En place',
      dateEntree: '2020-01-01',
      dateSortie: null,
    })
    await repos.repoPositions.create(position, { id: `p${n}` })
  }
}

const SAISIE_APPEL = { libelle: 'Provisions T1 2027', nature: 'budget' as const, exigibilite: '2027-01-01', montantCentimes: 100_001, cleId: null }

/** Laisse s'écouler un délai réel (fake-indexeddb planifie ses requêtes hors des microtâches). */
const patienter = () =>
  act(async () => {
    await new Promise((resoudre) => setTimeout(resoudre, 30))
  })

let pushCourant: ReturnType<typeof vi.fn<Push>> | null = null

async function rendre() {
  const push = vi.fn<Push>(() => undefined)
  pushCourant = push
  await act(async () => {
    render(
      <ToastContext.Provider value={{ push, dismiss: vi.fn() }}>
        <AppelsDeFondsModule />
      </ToastContext.Provider>,
    )
  })
  await patienter()
  await waitFor(() => expect(screen.queryByText('Chargement…')).toBeNull())
  return { push }
}

const panneau = (titre: string): HTMLElement => screen.getByRole('heading', { level: 3, name: titre }).closest('.panel') as HTMLElement
const avis = () => within(panneau('Avis d’appel par copropriétaire'))
const dialogue = () => within(screen.getByRole('dialog'))
const dernierToast = () => pushCourant?.mock.calls.at(-1)?.[0]
const texteDe = (element: HTMLElement) => element.textContent ?? ''
/**
 * Lecture de l'écran réussie : l'échéancier n'est rendu qu'avec des données lues, et rien n'est « illisible ». À vérifier
 * avant une assertion d'absence (bandeau, bouton) : une lecture en erreur garde le titre du panneau des avis et la
 * passerait aussi.
 */
const lectureReussie = () => {
  expect(screen.queryByText(/Données illisibles/)).toBeNull()
  expect(panneau('Échéancier des appels')).toBeTruthy()
}

/** Clique et attend le toast de l'écriture (succès ou refus), puis la relecture. */
async function cliquerEtAttendre(bouton: HTMLElement) {
  const toasts = pushCourant?.mock.calls.length ?? 0
  await act(async () => {
    fireEvent.click(bouton)
  })
  await waitFor(() => expect(pushCourant?.mock.calls.length ?? 0).toBeGreaterThan(toasts))
  await patienter()
}

describe('Appels de fonds en mode réel — écran', () => {
  it('statut « reel » en données réelles, « demo » en démonstration (enregistrement simulé)', () => {
    expect(statutEcran('appels', 'reel')).toBe('reel')
    expect(statutEcran('appels', 'demo')).toBe('demo')
  })

  it('sans échéance : panneaux réels, ni onglets ni tableau de démonstration', async () => {
    await rendre()
    const titres = screen.getAllByRole('heading', { level: 3 }).map((t) => t.textContent)
    expect(titres).toEqual(['Avis d’appel par copropriétaire', 'Échéancier des appels'])
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.queryByText('Quotes-parts par copropriété')).toBeNull()
    expect(avis().getByText(/Aucune échéance à appeler/)).toBeTruthy()
    expect(within(panneau('Échéancier des appels')).getByText('Aucune échéance')).toBeTruthy()
  })

  it('« Nouvel appel de fonds » crée l’échéance « Prévu », sur la clé générale tirée des tantièmes', async () => {
    await rendre()
    fireEvent.click(screen.getByRole('button', { name: /Émettre un appel/ }))
    const boite = dialogue()
    expect(boite.getByRole('heading', { name: 'Nouvel appel de fonds' })).toBeTruthy()
    // Défaut 1 du 22/11/2026 : libellé court, « à créer » lisible ; champs en pleine largeur, comme le formulaire de main.
    expect((boite.getByLabelText('Clé de répartition') as HTMLSelectElement).selectedOptions[0].textContent).toBe('001 — Charges générales (à créer)')
    for (const libelle of ['Libellé', 'Nature', 'Clé de répartition', 'Date d’exigibilité', 'Montant'])
      expect(boite.getByLabelText(libelle).closest('.field')?.classList.contains('field-full')).toBe(true)
    fireEvent.change(boite.getByLabelText('Libellé'), { target: { value: 'Provisions T1 2027' } })
    fireEvent.change(boite.getByLabelText('Date d’exigibilité'), { target: { value: '2027-01-01' } })
    fireEvent.change(boite.getByLabelText('Montant'), { target: { value: '1 000,01' } })
    await cliquerEtAttendre(boite.getByRole('button', { name: 'Enregistrer' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Échéance enregistrée' })
    expect(screen.queryByRole('dialog')).toBeNull()
    // relecture de la base après l'écriture (elle lit aussi le plan de la reprise des fiches)
    await waitFor(() => expect(within(panneau('Échéancier des appels')).queryAllByRole('row')).toHaveLength(2))
    const lignes = within(panneau('Échéancier des appels')).getAllByRole('row').slice(1).map(texteDe)
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toContain('Provisions T1 2027')
    expect(lignes[0]).toMatch(/1\s000,01/)
    expect(lignes[0]).toContain('Prévu')
    expect(await ajDb.clesRepartition.count()).toBe(1)
  })

  it('montant illisible : refusé par un toast, la modale reste ouverte, rien n’est écrit', async () => {
    await rendre()
    fireEvent.click(screen.getByRole('button', { name: /Émettre un appel/ }))
    const boite = dialogue()
    fireEvent.change(boite.getByLabelText('Libellé'), { target: { value: 'Provisions T1 2027' } })
    fireEvent.change(boite.getByLabelText('Date d’exigibilité'), { target: { value: '2027-01-01' } })
    fireEvent.change(boite.getByLabelText('Montant'), { target: { value: '12,345' } })
    await cliquerEtAttendre(boite.getByRole('button', { name: 'Enregistrer' }))
    expect(dernierToast()).toMatchObject({ kind: 'warn', title: 'Enregistrement impossible' })
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(await ajDb.echeancesAppel.count()).toBe(0)
  })

  it('avis calculé sur les données réelles, droits sur les lots, écriture ; « Écrire l’appel » enregistre la pièce et « Appelé »', async () => {
    await donneesD2()
    await appelsDb.ouvrirExercice(copro.id, { ouverture: '2027-01-01', cloture: '2027-12-31' })
    await appelsDb.enregistrerNouvelAppel(copro.id, SAISIE_APPEL)
    await rendre()
    expect((avis().getByRole('combobox', { name: 'Appel' }) as HTMLSelectElement).value).toBe('2027-01-01')
    expect(avis().getByRole('heading', { level: 4, name: 'Droits sur les lots au 01/01/2027' })).toBeTruthy()
    expect(avis().getByText('Personne 1 — Copropriétaire 1/1 · compte 00001')).toBeTruthy()
    const texte = texteDe(panneau('Avis d’appel par copropriétaire'))
    expect(texte).toContain('Copropriétaire 1 (fictif)')
    expect(texte).toContain(`${segment}.45000.00001.0`)
    expect(texte).toMatch(/Appelé 450,01\s€/)
    expect(texte).toContain(`${segment}.70100.00000.0`)
    expect(texte).toMatch(/Débit = crédit : 1\s000,01\s€/)
    // ap-04 du 22/11/2026 : ce qui est bloqué est la diffusion de l'avis, pas l'écriture de l'appel.
    expect(texte).toContain('Bloque la diffusion de l’avis : Compte')
    expect(texte).not.toContain('Bloquant')
    const ecrire = avis().getByRole('button', { name: 'Écrire l’appel' })
    expect((ecrire as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(ecrire)
    expect(dialogue().getByText(/1 échéance/)).toBeTruthy()
    await cliquerEtAttendre(dialogue().getByRole('button', { name: 'Écrire l’appel' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Appel écrit' })
    expect(String(dernierToast()?.desc)).toMatch(/pièce n° 1/)
    const pieces = await ajDb.traitements.toArray()
    expect(pieces.map((p) => [p.famille, p.statut, p.mandatId])).toEqual([['Appel de fonds', 'Produit', copro.mandatId]])
    expect((await ajDb.echeancesAppel.toArray()).map((e) => e.statut)).toEqual(['Appelé'])
    // relecture de la base après l'écriture (elle lit aussi le plan de la reprise des fiches)
    await waitFor(() => expect(texteDe(within(panneau('Échéancier des appels')).getAllByRole('row')[1])).toContain('Appelé'))
    const ligne = texteDe(within(panneau('Échéancier des appels')).getAllByRole('row')[1])
    expect(ligne).toContain('Appelé')
    expect(ligne).toContain('n° 1')
    // Défaut 5 du 22/11/2026 : Statut et Montant juste après Exigibilité, lisibles sur téléphone sans défiler.
    const entetes = within(panneau('Échéancier des appels')).getAllByRole('columnheader').map(texteDe)
    expect(entetes).toEqual(['Exigibilité', 'Statut', 'Montant', 'Clé', 'Libellé', 'Nature', 'Pièce'])
    const cellules = within(within(panneau('Échéancier des appels')).getAllByRole('row')[1]).getAllByRole('cell').map(texteDe)
    expect(cellules.slice(0, 2)).toEqual(['01/01/2027', 'Appelé'])
    expect(cellules[2]).toMatch(/1\s000,01\s€/)
    expect(avis().getByText(/Aucune échéance à appeler/)).toBeTruthy()
  })

  it('deux échéances : la confirmation écrit « Les échéances passent « Appelé » » (défaut 4 du 22/11/2026)', async () => {
    await donneesD2()
    await appelsDb.ouvrirExercice(copro.id, { ouverture: '2027-01-01', cloture: '2027-12-31' })
    const { cle } = await appelsDb.enregistrerNouvelAppel(copro.id, SAISIE_APPEL)
    await appelsDb.enregistrerNouvelAppel(copro.id, { ...SAISIE_APPEL, libelle: 'Fonds de travaux T1 2027', nature: 'fonds_travaux', montantCentimes: 5_000, cleId: cle.id })
    await rendre()
    fireEvent.click(avis().getByRole('button', { name: 'Écrire l’appel' }))
    const texte = texteDe(screen.getByRole('dialog'))
    expect(texte).toContain('2 échéances')
    expect(texte).toContain('Les échéances passent « Appelé ».')
    expect(texte).not.toContain('L’échéances')
  })

  it('lot vendu le jour de l’exigibilité : la carte nomme le vendeur appelé et son compte (défaut 7 du 22/11/2026)', async () => {
    await donneesD2()
    await ajDb.positions.update('p2', { statut: 'Sorti', dateSortie: '2027-01-01' })
    const { id: _i, ...acquereur } = d2.creerIdentite({ id: 'i4', nature: 'physique', civilite: '', nom: 'Personne 4', prenom: null, telecoms: [] })
    await repos.repoIdentites.create(acquereur, { id: 'i4' })
    const { id: _c, ...compte } = d2.creerCompteCoproprietaire({ id: 'c4', coproprieteId: copro.id, serie: '4', libelle: 'Copropriétaire 4 (fictif)' })
    await repos.repoComptesCoproprietaires.create(compte, { id: 'c4' })
    const { id: _p, ...entree } = d2.creerPosition({
      id: 'p4',
      identiteId: 'i4',
      lotId: 'L2',
      compteId: 'c4',
      qualite: 'Copropriétaire',
      part: { numerateur: 1, denominateur: 1 },
      statut: 'En place',
      dateEntree: '2027-01-01',
      dateSortie: null,
    })
    await repos.repoPositions.create(entree, { id: 'p4' })
    await appelsDb.ouvrirExercice(copro.id, { ouverture: '2027-01-01', cloture: '2027-12-31' })
    await appelsDb.enregistrerNouvelAppel(copro.id, SAISIE_APPEL)
    await rendre()
    const carte = avis().getByText('Lot 2').parentElement as HTMLElement
    expect(texteDe(carte)).toContain('Vente ce jour : appel au vendeur')
    expect(texteDe(carte)).toContain('Vendeur appelé : Personne 2 — Copropriétaire 1/1 · compte 00002')
    expect(texteDe(carte)).toContain('Personne 4 — Copropriétaire 1/1 · compte 00004')
  })

  it('lot sans compte : anomalie affichée, écriture bloquée', async () => {
    await donneesD2({ sansLot3: true })
    await appelsDb.ouvrirExercice(copro.id, { ouverture: '2027-01-01', cloture: '2027-12-31' })
    await appelsDb.enregistrerNouvelAppel(copro.id, SAISIE_APPEL)
    await rendre()
    expect(avis().getByText('Lot 3 : aucun compte copropriétaire en place au 01/01/2027 (« Provisions T1 2027 »).')).toBeTruthy()
    expect((avis().getByRole('button', { name: 'Écrire l’appel' }) as HTMLButtonElement).disabled).toBe(true)
    expect(avis().getByText("Appel non écrit : 1 anomalie de répartition à lever d'abord.")).toBeTruthy()
    // Pastille du lot sans propriétaire : sans point final (défaut 8 du 22/11/2026).
    expect(avis().getByText('Lot sans propriétaire en place')).toBeTruthy()
  })

  it('exercice absent : « Ouvrir l’exercice », puis l’appel peut être écrit', async () => {
    await donneesD2()
    await appelsDb.enregistrerNouvelAppel(copro.id, SAISIE_APPEL)
    await rendre()
    expect((avis().getByRole('button', { name: 'Écrire l’appel' }) as HTMLButtonElement).disabled).toBe(true)
    // Défaut 3 du 22/11/2026 : une phrase, avec le libellé de l'échéance, sans identifiant interne.
    expect(avis().getByText('Exercice à ouvrir : aucun exercice du syndicat ne comprend l’exigibilité de « Provisions T1 2027 ».')).toBeTruthy()
    expect(texteDe(panneau('Avis d’appel par copropriétaire'))).not.toMatch(/A-2027/)
    fireEvent.click(avis().getByRole('button', { name: 'Ouvrir l’exercice' }))
    // Exercice qui ne comprend pas l'exigibilité (année erronée) : refusé, rien n'est écrit, la modale reste ouverte.
    fireEvent.change(dialogue().getByLabelText('Ouverture'), { target: { value: '2026-01-01' } })
    fireEvent.change(dialogue().getByLabelText('Clôture'), { target: { value: '2026-12-31' } })
    await cliquerEtAttendre(dialogue().getByRole('button', { name: 'Enregistrer' }))
    expect(dernierToast()).toMatchObject({ kind: 'warn', title: 'Exercice non ouvert' })
    expect(String(dernierToast()?.desc)).toMatch(/ne comprend pas l'exigibilité du 01\/01\/2027/)
    expect(await ajDb.exercices.count()).toBe(0)
    fireEvent.change(dialogue().getByLabelText('Ouverture'), { target: { value: '2027-01-01' } })
    fireEvent.change(dialogue().getByLabelText('Clôture'), { target: { value: '2027-12-31' } })
    await cliquerEtAttendre(dialogue().getByRole('button', { name: 'Enregistrer' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Exercice ouvert' })
    await waitFor(() => expect((avis().getByRole('button', { name: 'Écrire l’appel' }) as HTMLButtonElement).disabled).toBe(false))
  })

  it('prélèvements SEPA : IBAN invalide et contentieux exclus, débit possible en attente de la diffusion ; préavis de 14 jours', async () => {
    await donneesD2()
    await appelsDb.ouvrirExercice(copro.id, { ouverture: '2027-01-01', cloture: '2027-12-31' })
    await appelsDb.enregistrerNouvelAppel(copro.id, SAISIE_APPEL)
    const mandat = (n: string, iban: string) => ({
      rum: `RUM-FICTIF-0000${n}`,
      dateSignature: '2024-03-01',
      debiteur: `Personne ${n}`,
      debiteurIdentiteId: `i${n}`,
      iban,
      bic: 'EXEMFRPP',
      dernierPrelevementLe: '2026-10-05',
      natures: { budget: true, autres: true },
      maxiCentimes: null,
    })
    await ajDb.comptesCoproprietaires.update('c1', { reglement: { mode: 'Prélèvement', mandat: mandat('1', IBAN_FAUX) } })
    await ajDb.comptesCoproprietaires.update('c2', {
      reglement: { mode: 'Prélèvement', mandat: mandat('2', IBAN_DEBITEUR) },
      reprise: { coproprietaireId: 'f2', soldeDuCentimes: 0, statutFiche: 'Contentieux', releveLe: '2026-11-01' },
    })
    await ajDb.impayes.add({ id: 'imp-1', coproprietaireId: 'f2', montant: 100, statut: 'procedure:2026-10-01', createdAt: '', updatedAt: '', createdBy: null, updatedBy: null })
    await ajDb.comptesCoproprietaires.update('c3', { reglement: { mode: 'Prélèvement', mandat: mandat('3', IBAN_DEBITEUR) } })
    await rendre()
    const sepa = () => texteDe(avis().getByRole('heading', { level: 4, name: 'Prélèvements SEPA' }).parentElement as HTMLElement)
    expect((avis().getByLabelText('Date du prélèvement') as HTMLInputElement).value).toBe('2027-01-01')
    expect(sepa()).toContain('Copropriétaire 1 (fictif) exclu : IBAN du mandat invalide')
    expect(sepa()).toContain('Copropriétaire 2 (fictif) exclu : Compte en contentieux : prélèvement suspendu')
    expect(sepa()).toMatch(/Copropriétaire 3 \(fictif\) : 200,00\s€, en attente de la diffusion de l’avis/)
    expect(sepa()).toContain('0 prélèvement retenu')
    await act(async () => {
      fireEvent.change(avis().getByLabelText('Date du prélèvement'), { target: { value: '2026-12-10' } })
    })
    expect(sepa()).toMatch(/Copropriétaire 3 \(fictif\) exclu : .*14 jours calendaires/)
  })

  it('fiches non reprises : « Reprendre les fiches de toutes les copropriétés » crée identités, comptes et positions (D2)', async () => {
    await ajDb.coproprietaires.add({ id: 'f1', lotId: 'L1', nom: 'Ancienne fiche (fictive)', tel: '', mail: '', solde: 0, statut: 'À jour', createdAt: '', updatedAt: '', createdBy: null, updatedBy: null })
    await rendre()
    expect(avis().getByText(/1 fiche copropriétaire non reprise/)).toBeTruthy()
    // Décision du 22/11/2026 (point 10) : le bouton dit qu'il agit sur toutes les copropriétés.
    await cliquerEtAttendre(avis().getByRole('button', { name: 'Reprendre les fiches de toutes les copropriétés' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Fiches reprises' })
    await waitFor(() => expect(avis().queryByText(/fiche copropriétaire non reprise/)).toBeNull())
    expect(avis().getByText(/Ancienne fiche \(fictive\) — Copropriétaire 1\/1/)).toBeTruthy()
    expect(await ajDb.positions.count()).toBe(1)
  })

  const ancienneFiche = (id: string, lotId: string, nom: string) => ({
    id,
    lotId,
    nom,
    tel: '',
    mail: '',
    solde: 0,
    statut: 'À jour',
    createdAt: '',
    updatedAt: '',
    createdBy: null,
    updatedBy: null,
  })

  it('fiche écartée non comptée, nommée avec son motif ; après la reprise, le bandeau disparaît et le message donne le motif (décision du 22/11/2026)', async () => {
    await ajDb.coproprietaires.bulkAdd([ancienneFiche('f1', 'L1', 'Ancienne fiche (fictive)'), ancienneFiche('f2', 'L2', '  ')])
    await rendre()
    expect(avis().getByText('1 fiche copropriétaire non reprise en identités, comptes et positions (D2)')).toBeTruthy()
    expect(avis().getByText('1 fiche écartée par la reprise :')).toBeTruthy()
    expect(avis().getByText("Lot 2, fiche sans nom — Nom de l'identité manquant.")).toBeTruthy()
    await cliquerEtAttendre(avis().getByRole('button', { name: 'Reprendre les fiches de toutes les copropriétés' }))
    expect(dernierToast()).toMatchObject({ kind: 'success', title: 'Fiches reprises' })
    const message = String(dernierToast()?.desc)
    expect(message).toContain('1 fiche écartée(s)')
    expect(message).toContain(`Fiche écartée : ${copro.code} · Lot 2, fiche sans nom — Nom de l'identité manquant.`)
    // relecture réussie (la fiche reprise est sur son lot), puis plus de bandeau : une lecture en erreur n'y suffirait pas
    await waitFor(() => expect(avis().getByText(/Ancienne fiche \(fictive\) — Copropriétaire 1\/1/)).toBeTruthy())
    lectureReussie()
    expect(avis().queryByText(/fiche copropriétaire non reprise/)).toBeNull()
    expect(avis().queryByRole('button', { name: /Reprendre les fiches/ })).toBeNull()
    expect(avis().queryByText(/écartée par la reprise/)).toBeNull()
    expect(await ajDb.positions.count()).toBe(1)
  })

  it('seules des fiches écartées ou déjà reprises : aucun bandeau ni bouton (constat du 22/11/2026)', async () => {
    await ajDb.coproprietaires.bulkAdd([ancienneFiche('f2', 'L2', '  '), ancienneFiche('f3', 'L3', 'Fiche déjà reprise (fictive)')])
    const { id: _i, ...identite } = d2.creerIdentite({ id: 'id-f3', nature: 'physique', civilite: '', nom: 'Fiche déjà reprise (fictive)', prenom: null, telecoms: [] })
    await repos.repoIdentites.create(identite, { id: 'id-f3' })
    await rendre()
    lectureReussie()
    expect(avis().queryByText(/fiche copropriétaire non reprise/)).toBeNull()
    expect(avis().queryByRole('button', { name: /Reprendre les fiches/ })).toBeNull()
  })
})
