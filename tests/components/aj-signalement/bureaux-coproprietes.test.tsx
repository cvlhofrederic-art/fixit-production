// tests/components/aj-signalement/bureaux-coproprietes.test.tsx
//
// Bureaux des cabinets clients (PR 2 : écrans du super admin, BROUILLON soumis avant fusion) — écrans E5, E6 et E7 du
// plan des bureaux :
//   - E5 fenêtre d'une copropriété (super admin, création et modification) : liste « Bureau (facultatif) » dès que le
//     cabinet a un bureau ouvert (ou que la copropriété en a un) ; « Aucun bureau » permis (null en modification, envoyé
//     seulement s'il change) ; bureaux fermés jamais proposés, sauf l'actuel ; 207 bureau_non_pose à la création expliqué
//     (la copropriété est créée, sans bureau) ; 409 bureau_ferme à la réactivation expliqué ;
//   - E6 carte d'une copropriété : ligne « Bureau : … » quand elle a un bureau, rien sinon ; jamais sur la carte vue par
//     un gestionnaire ;
//   - E7 vues « Copropriétés » et « Signalements » du super admin : filtre « Bureau » (bureaux des copropriétés, partagé
//     par les deux vues), qui relit le tableau par ?bureau=<id> ; absent tant qu'aucune copropriété n'a de bureau ;
//     jamais dans la vue d'un gestionnaire ni sur le tableau de bord ;
//   - tant qu'aucun bureau n'existe (aucune clé nbBureaux, nbBureauxOuverts ni bureau dans les réponses) : écrans
//     identiques à avant, aucun libellé de bureau, aucune requête nouvelle ; la fenêtre du gestionnaire ne change pas.
// Données fictives : « Cabinet Exemple », « Autre Exemple », bureaux « Nord », « Sud » et « Est », adresses @exemple.test.

import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEXTES_GESTION_QR as G } from '@/lib/aj-signalement/affichage-gestion'
import { TEXTES_TABLEAU_QR as T } from '@/lib/aj-signalement/affichage'
import type { VueEspaceQr } from '@/lib/aj-signalement/acces-espace'
import { gestionCoproprieteQrVide, type CabinetQr, type CoproprieteQr, type SignalementQr, type TableauQr } from '@/lib/aj-signalement/types'

const simul = vi.hoisted(() => ({ toastErreur: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: simul.toastErreur, success: vi.fn() } }))

const { default: ModaleCoproprieteQr } = await import('@/components/aj-signalement/ModaleCoproprieteQr')
const { default: CarteCoproprieteQr } = await import('@/components/aj-signalement/CarteCoproprieteQr')
const { default: TableauSignalementsQr } = await import('@/components/aj-signalement/TableauSignalementsQr')

const B = G.bureaux
const BC = G.bureaux.copropriete
const BF = G.bureaux.filtre

const K1 = 'a0000000-0000-4000-8000-0000000000a1'
const K2 = 'a0000000-0000-4000-8000-0000000000a2'
const B1 = 'b0000000-0000-4000-8000-0000000000b1'
const B2 = 'b0000000-0000-4000-8000-0000000000b2'
const B3 = 'b0000000-0000-4000-8000-0000000000b3'
const B4 = 'b0000000-0000-4000-8000-0000000000b4'
const C1 = 'c0000000-0000-4000-8000-000000000001'
const C2 = 'c0000000-0000-4000-8000-000000000002'
const C3 = 'c0000000-0000-4000-8000-000000000003'
const C4 = 'c0000000-0000-4000-8000-000000000004'
const C9 = 'c0000000-0000-4000-8000-000000000009'
const URL_BUREAUX = `/api/aj-signalement/cabinets/${K1}/bureaux`
const URL_TABLEAU = '/api/aj-signalement/tableau'
const URL_NORD = `${URL_TABLEAU}?bureau=${B1}`

const RESUME_K1 = { id: K1, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }
const RESUME_K2 = { id: K2, nom: 'Autre Exemple', identifiant: 'autre-exemple' }
/** Cabinet tel que les réponses le rendent tant qu'il n'a aucun bureau (ou sans la migration) : aucune clé de bureau. */
const cabinetSans: CabinetQr = { ...RESUME_K1, langue: 'fr', domaines: ['exemple.test'], identifiantFige: true, nbCoproprietes: 3, nbGestionnaires: 0 }
/** Le même avec ses bureaux : Est et Nord (ouverts), Sud (fermé). */
const cabinetAvec: CabinetQr = { ...cabinetSans, nbBureaux: 3, nbBureauxOuverts: 2 }
const autre: CabinetQr = { ...RESUME_K2, langue: 'fr', domaines: ['autre.exemple.test'], identifiantFige: true, nbCoproprietes: 1, nbGestionnaires: 0 }

type Bureau = { id: string; nom: string; ferme: boolean; cabinetId: string; fermeLe: string | null; creeLe: string; nbGestionnaires: number; nbCoproprietes: number }
const bureau = (id: string, nom: string, ferme = false): Bureau => ({
  id, nom, ferme, cabinetId: K1, fermeLe: ferme ? '2026-11-19T09:00:00+00:00' : null, creeLe: '2026-11-19T08:00:00+00:00', nbGestionnaires: 0, nbCoproprietes: 0,
})
const est = bureau(B3, 'Est')
const nord = bureau(B1, 'Nord')
const sud = bureau(B2, 'Sud', true)
const resumeBureau = (b: Bureau) => ({ id: b.id, nom: b.nom, ferme: b.ferme })

const copro = (id: string, nom: string, extra: Partial<CoproprieteQr> = {}): CoproprieteQr => ({
  id, nom, adresse: '1 rue Exemple', jeton: id.replaceAll('-', ''), emailsDestinataires: [], actif: true, creeLe: '2026-11-01T10:00:00.000Z',
  nbSignalements: 0, nbEnAttente: 0, derniereAdresseProposee: null, ...gestionCoproprieteQrVide(), cabinet: RESUME_K1, ...extra,
})
const une = copro(C1, 'Résidence Une', { bureau: resumeBureau(nord) })
const deux = copro(C2, 'Résidence Deux', { bureau: resumeBureau(sud) })
const trois = copro(C3, 'Résidence Trois')
const quatre = copro(C4, 'Résidence Quatre', { bureau: resumeBureau(nord) })

const signalement = (id: string, copropriete: CoproprieteQr, creeLe: string, typeIntervention: string): SignalementQr => ({
  id, coproprieteId: copropriete.id, coproprieteNom: copropriete.nom, prenom: 'Alex', nom: 'Exemple', telephone: '06 00 00 00 00',
  email: 'alex@exemple.test', batiment: 'A', etage: '1', numLot: '1', estPartieCommune: false, zoneSignalee: '', typeIntervention,
  description: 'Description fictive', priorite: 'normale', statut: 'en_attente', langue: 'fr', emailEnvoyeLe: null, emailErreur: null,
  confirmationEnvoyeeLe: null, confirmationErreur: null, qualiteDeclarant: null, adresseProposee: '', signalementLieId: null, creeLe, misAJourLe: creeLe,
})
const fuite = signalement('5a000000-0000-4000-8000-000000000001', une, '2026-11-18T10:00:00.000Z', 'Plomberie (fuite, colonne, robinetterie)')
const porte = signalement('5a000000-0000-4000-8000-000000000002', deux, '2026-11-17T10:00:00.000Z', 'Serrurerie')
const lampe = signalement('5a000000-0000-4000-8000-000000000003', trois, '2026-11-16T10:00:00.000Z', 'Électricité')
/** Signalement ancien du bureau Nord : absent du tableau complet (trop ancien), rendu par le filtre ?bureau=. */
const ancien = signalement('5a000000-0000-4000-8000-000000000004', quatre, '2026-01-05T10:00:00.000Z', 'Ascenseur')

// ── Réseau simulé ────────────────────────────────────────────────────────────

type Appel = { url: string; methode: string; corps: Record<string, unknown> | null }
let appels: Appel[] = []
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

/** Bureaux du cabinet Exemple rendus par GET /cabinets/[id]/bureaux (triés par nom, comme le serveur). */
let bureaux: Bureau[] = []
let refusLecture: { code: string; status: number } | null = null
/** Réponse refusée à la prochaine écriture (POST, PATCH). */
let refus: { code: string; status: number } | null = null
/** Création : 207 bureau_non_pose. */
let bureauNonPose = false
/** Tableau complet (GET /tableau) et tableaux filtrés par bureau (GET /tableau?bureau=<id>). */
let tableauComplet: TableauQr = { coproprietes: [], signalements: [] }
let parBureau: Record<string, TableauQr> = {}
let refusFiltre: { code: string; status: number } | null = null
/** Copropriété rendue par un PATCH réussi (sinon : celle du tableau complet, avec le corps appliqué). */
let modifiee: CoproprieteQr | null = null

const reponseRefusee = (r: { code: string; status: number }) => json({ error: r.code }, r.status)
/** Valeur gardée, puis effacée (refus à usage unique). */
function prendre<V>(valeur: V, effacer: () => void): V {
  effacer()
  return valeur
}

function lectureTableau(url: string): Response {
  const filtre = new URL(url, 'https://vitfix.io').searchParams.get('bureau')
  if (filtre === null) return json({ tableau: tableauComplet })
  if (refusFiltre) return reponseRefusee(prendre(refusFiltre, () => { refusFiltre = null }))
  return json({ tableau: parBureau[filtre] ?? { coproprietes: [], signalements: [] } })
}

function ecriture(a: Appel): Response {
  if (refus) return reponseRefusee(prendre(refus, () => { refus = null }))
  if (a.url === '/api/aj-signalement/coproprietes') {
    const creee = copro(C9, String(a.corps?.nom ?? ''), { cabinet: a.corps?.cabinetId ? RESUME_K1 : null })
    return bureauNonPose ? json({ copropriete: creee, error: 'bureau_non_pose' }, 207) : json({ copropriete: creee }, 201)
  }
  const connue = [...tableauComplet.coproprietes, une, deux, trois, quatre].find((c) => a.url.endsWith(`/coproprietes/${c.id}`))
  return json({ copropriete: modifiee ?? { ...connue, ...a.corps } })
}

function routeur(a: Appel): Response {
  if (a.url === URL_BUREAUX) return refusLecture ? reponseRefusee(prendre(refusLecture, () => { refusLecture = null })) : json({ bureaux })
  if (a.methode !== 'GET') return ecriture(a)
  if (a.url.startsWith(URL_TABLEAU)) return lectureTableau(a.url)
  return json({ error: 'introuvable' }, 404)
}

beforeEach(() => {
  vi.clearAllMocks()
  bureaux = [est, nord, sud]
  refusLecture = null
  refus = null
  bureauNonPose = false
  tableauComplet = { coproprietes: [], signalements: [] }
  parBureau = {}
  refusFiltre = null
  modifiee = null
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const appel = { url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null }
    appels.push(appel)
    return routeur(appel)
  }))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const options = (liste: HTMLElement) => within(liste).getAllByRole('option').map((o) => o.textContent)
const lecturesBureaux = () => appels.filter((a) => a.url.includes('/bureaux'))
const ecritures = () => appels.filter((a) => a.methode !== 'GET')
const lecturesFiltrees = () => appels.filter((a) => a.url.startsWith(`${URL_TABLEAU}?`))

// ── E5 fenêtre d'une copropriété (super admin) ───────────────────────────────

const rappels = { onFermer: vi.fn(), onEnregistre: vi.fn(), onSupprimee: vi.fn(), onOuvrir: vi.fn() }
const rendreCreation = (cabinets: CabinetQr[]) =>
  render(<ModaleCoproprieteQr copropriete={null} jeton={null} cabinets={cabinets} gestionnaires={[]} {...rappels} />)
const rendreModification = (c: CoproprieteQr, cabinets: CabinetQr[] = [cabinetAvec]) =>
  render(<ModaleCoproprieteQr copropriete={c} jeton={null} cabinets={cabinets} gestionnaires={[]} {...rappels} />)
const nommer = (nom = 'Villa Exemple') => fireEvent.change(screen.getByLabelText(T.formulaire.nom), { target: { value: nom } })
const choisirCabinet = (id: string) => fireEvent.change(screen.getByLabelText(G.copropriete.cabinet), { target: { value: id } })
const creer = () => fireEvent.click(screen.getByRole('button', { name: T.formulaire.creerBouton }))
const enregistrer = () => fireEvent.click(screen.getByRole('button', { name: T.formulaire.enregistrer }))
const CORPS_CREATION = { nom: 'Villa Exemple', adresse: '', emailsDestinataires: [], cabinetId: K1 }
const corpsModification = (c: CoproprieteQr, actif = c.actif) => ({ nom: c.nom, adresse: c.adresse, emailsDestinataires: [], actif })

describe('E5 fenêtre d’une copropriété : création', () => {
  it('cabinet sans bureau : aucune liste « Bureau », aucun libellé de bureau, aucune requête ; le corps reste celui d’avant', async () => {
    rendreCreation([cabinetSans])
    nommer()
    choisirCabinet(K1)
    expect(screen.queryByLabelText(BC.champ)).toBeNull()
    expect(screen.queryByText(/bureau/i)).toBeNull()
    creer()
    await waitFor(() => expect(rappels.onEnregistre).toHaveBeenCalled())
    expect(ecritures()[0].corps).toEqual(CORPS_CREATION)
    expect(rappels.onEnregistre.mock.calls[0]).toHaveLength(1)
    expect(lecturesBureaux()).toEqual([])
  })

  it('cabinet dont tous les bureaux sont fermés : aucune liste, aucune requête des bureaux', async () => {
    rendreCreation([{ ...cabinetSans, nbBureaux: 1, nbBureauxOuverts: 0 }])
    nommer()
    choisirCabinet(K1)
    expect(screen.queryByLabelText(BC.champ)).toBeNull()
    creer()
    await waitFor(() => expect(rappels.onEnregistre).toHaveBeenCalled())
    expect(ecritures()[0].corps).toEqual(CORPS_CREATION)
    expect(lecturesBureaux()).toEqual([])
  })

  it('cabinet avec un bureau ouvert : liste facultative (« Aucun bureau » d’abord, bureaux ouverts seulement) ; sans choix : aucun bureauId', async () => {
    rendreCreation([cabinetAvec])
    nommer()
    expect(screen.queryByLabelText(BC.champ)).toBeNull()
    choisirCabinet(K1)
    const liste = await screen.findByLabelText(BC.champ)
    expect(liste).not.toBeRequired()
    expect(liste).toHaveValue('')
    expect(options(liste)).toEqual([BC.aucun, 'Est', 'Nord'])
    expect(lecturesBureaux().map((a) => a.url)).toEqual([URL_BUREAUX])
    creer()
    await waitFor(() => expect(rappels.onEnregistre).toHaveBeenCalled())
    expect(ecritures()[0].corps).toEqual(CORPS_CREATION)
  })

  it('bureau choisi : envoyé avec la création (bureauId) ; copropriété créée sans autre message', async () => {
    rendreCreation([cabinetAvec])
    nommer()
    choisirCabinet(K1)
    fireEvent.change(await screen.findByLabelText(BC.champ), { target: { value: B1 } })
    creer()
    await waitFor(() => expect(rappels.onEnregistre).toHaveBeenCalled())
    expect(ecritures()[0].corps).toEqual({ ...CORPS_CREATION, bureauId: B1 })
    expect(rappels.onEnregistre.mock.calls[0]).toHaveLength(1)
  })

  it('autre cabinet, ou « sans cabinet » : la liste disparaît et le choix est effacé', async () => {
    rendreCreation([cabinetAvec, autre])
    nommer()
    choisirCabinet(K1)
    fireEvent.change(await screen.findByLabelText(BC.champ), { target: { value: B1 } })
    choisirCabinet(K2)
    expect(screen.queryByLabelText(BC.champ)).toBeNull()
    choisirCabinet(K1)
    expect(await screen.findByLabelText(BC.champ)).toHaveValue('')
    choisirCabinet('')
    expect(screen.queryByLabelText(BC.champ)).toBeNull()
    creer()
    await waitFor(() => expect(rappels.onEnregistre).toHaveBeenCalled())
    expect(ecritures()[0].corps).toEqual({ nom: 'Villa Exemple', adresse: '', emailsDestinataires: [] })
  })

  it('207 bureau_non_pose : la copropriété est créée, sans bureau ; l’écran le dit (avertissement)', async () => {
    bureauNonPose = true
    rendreCreation([cabinetAvec])
    nommer()
    choisirCabinet(K1)
    fireEvent.change(await screen.findByLabelText(BC.champ), { target: { value: B1 } })
    creer()
    await waitFor(() => expect(rappels.onEnregistre).toHaveBeenCalled())
    expect(rappels.onEnregistre).toHaveBeenCalledWith(expect.objectContaining({ id: C9, nom: 'Villa Exemple' }), BC.bureauNonPose, true)
  })

  it('bureaux pas encore disponibles (503 base_absente) : « Fonction pas encore disponible » ; la création reste possible, sans bureau', async () => {
    refusLecture = { code: 'base_absente', status: 503 }
    rendreCreation([cabinetAvec])
    nommer()
    choisirCabinet(K1)
    expect(await screen.findByText(B.indisponible)).toBeInTheDocument()
    expect(screen.queryByLabelText(BC.champ)).toBeNull()
    creer()
    await waitFor(() => expect(rappels.onEnregistre).toHaveBeenCalled())
    expect(ecritures()[0].corps).toEqual(CORPS_CREATION)
  })
})

describe('E5 fenêtre d’une copropriété : modification', () => {
  it('copropriété d’un cabinet sans bureau : aucune liste, aucune requête des bureaux ; le corps reste celui d’avant', async () => {
    rendreModification(trois, [cabinetSans])
    expect(screen.queryByLabelText(BC.champ)).toBeNull()
    expect(screen.queryByText(/bureau/i)).toBeNull()
    enregistrer()
    await waitFor(() => expect(rappels.onEnregistre).toHaveBeenCalled())
    expect(ecritures()[0].corps).toEqual(corpsModification(trois))
    expect(lecturesBureaux()).toEqual([])
  })

  it('copropriété sans cabinet : aucune liste', () => {
    rendreModification(copro(C3, 'Résidence Trois', { cabinet: null }))
    expect(screen.queryByLabelText(BC.champ)).toBeNull()
    expect(lecturesBureaux()).toEqual([])
  })

  it('bureau actuel choisi ; inchangé : rien n’est envoyé pour le bureau', async () => {
    tableauComplet = { coproprietes: [une], signalements: [] }
    rendreModification(une)
    const liste = await screen.findByLabelText(BC.champ)
    expect(liste).toHaveValue(B1)
    expect(options(liste)).toEqual([BC.aucun, 'Est', 'Nord'])
    enregistrer()
    await waitFor(() => expect(rappels.onEnregistre).toHaveBeenCalled())
    expect(ecritures()[0].corps).toEqual(corpsModification(une))
  })

  it('« Aucun bureau » : bureauId null (le bureau est retiré) ; un autre bureau : son id', async () => {
    tableauComplet = { coproprietes: [une], signalements: [] }
    const { unmount } = rendreModification(une)
    fireEvent.change(await screen.findByLabelText(BC.champ), { target: { value: '' } })
    enregistrer()
    await waitFor(() => expect(rappels.onEnregistre).toHaveBeenCalled())
    expect(ecritures()[0].corps).toEqual({ ...corpsModification(une), bureauId: null })
    unmount()

    rendreModification(une)
    fireEvent.change(await screen.findByLabelText(BC.champ), { target: { value: B3 } })
    enregistrer()
    await waitFor(() => expect(ecritures()).toHaveLength(2))
    expect(ecritures()[1].corps).toEqual({ ...corpsModification(une), bureauId: B3 })
  })

  it('copropriété sans bureau d’un cabinet qui a des bureaux : liste sur « Aucun bureau » ; un bureau choisi est envoyé', async () => {
    tableauComplet = { coproprietes: [trois], signalements: [] }
    rendreModification(trois)
    const liste = await screen.findByLabelText(BC.champ)
    expect(liste).toHaveValue('')
    fireEvent.change(liste, { target: { value: B1 } })
    enregistrer()
    await waitFor(() => expect(rappels.onEnregistre).toHaveBeenCalled())
    expect(ecritures()[0].corps).toEqual({ ...corpsModification(trois), bureauId: B1 })
  })

  it('copropriété restée dans un bureau fermé : « Sud (fermé) » gardé ; réactivation refusée (409 bureau_ferme) : la marche à suivre, bureaux relus', async () => {
    const desactivee = { ...deux, actif: false }
    tableauComplet = { coproprietes: [desactivee], signalements: [] }
    refus = { code: 'bureau_ferme', status: 409 }
    rendreModification(desactivee)
    const liste = await screen.findByLabelText(BC.champ)
    expect(liste).toHaveValue(B2)
    expect(options(liste)).toEqual([BC.aucun, 'Est', 'Nord', 'Sud (fermé)'])
    fireEvent.click(screen.getByLabelText(T.formulaire.actif))
    enregistrer()
    expect(await screen.findByText(BC.reactivationBureauFerme)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(BC.reactivationBureauFerme)
    expect(ecritures()[0].corps).toEqual(corpsModification(desactivee, true))
    expect(rappels.onEnregistre).not.toHaveBeenCalled()
    await waitFor(() => expect(lecturesBureaux()).toHaveLength(2))
  })

  it('bureau choisi fermé entre-temps (409 bureau_ferme) : message du bureau fermé, bureaux relus, il n’est plus proposé et le choix est à refaire', async () => {
    tableauComplet = { coproprietes: [trois], signalements: [] }
    refus = { code: 'bureau_ferme', status: 409 }
    rendreModification(trois)
    fireEvent.change(await screen.findByLabelText(BC.champ), { target: { value: B1 } })
    bureaux = [est, { ...nord, ferme: true }, sud]
    enregistrer()
    expect(await screen.findByText(T.erreurs.bureau_ferme)).toBeInTheDocument()
    await waitFor(() => expect(options(screen.getByLabelText(BC.champ))).toEqual([BC.aucun, 'Est']))
    expect(screen.getByLabelText(BC.champ)).toHaveValue('')
    expect(rappels.onEnregistre).not.toHaveBeenCalled()
  })

  it('bureau choisi disparu ou d’un autre cabinet (409 a_reverifier) : « les bureaux ont changé », bureaux relus', async () => {
    tableauComplet = { coproprietes: [trois], signalements: [] }
    refus = { code: 'a_reverifier', status: 409 }
    rendreModification(trois)
    fireEvent.change(await screen.findByLabelText(BC.champ), { target: { value: B1 } })
    enregistrer()
    expect(await screen.findByText(B.aReverifier)).toBeInTheDocument()
    await waitFor(() => expect(lecturesBureaux()).toHaveLength(2))
  })

  it('réseau coupé : message à l’écran et toast, comme les autres refus de la fenêtre', async () => {
    tableauComplet = { coproprietes: [une], signalements: [] }
    rendreModification(une)
    await screen.findByLabelText(BC.champ)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    enregistrer()
    expect(await screen.findByText(T.erreurs.reseau)).toBeInTheDocument()
    expect(simul.toastErreur).toHaveBeenCalledWith(T.erreurs.reseau)
  })
})

// ── E6 carte d'une copropriété ───────────────────────────────────────────────

describe('E6 carte d’une copropriété', () => {
  it('avec un bureau : « Bureau : Nord » ; bureau fermé signalé', () => {
    const { unmount } = render(<CarteCoproprieteQr copropriete={une} origine="https://vitfix.io" onModifier={vi.fn()} />)
    expect(screen.getByText('Bureau : Nord')).toBeInTheDocument()
    unmount()
    render(<CarteCoproprieteQr copropriete={deux} origine="https://vitfix.io" onModifier={vi.fn()} />)
    expect(screen.getByText('Bureau : Sud (fermé)')).toBeInTheDocument()
  })

  it('sans bureau : aucune ligne, aucun libellé de bureau (la carte d’avant)', () => {
    render(<CarteCoproprieteQr copropriete={trois} origine="https://vitfix.io" onModifier={vi.fn()} />)
    expect(screen.queryByText(/bureau/i)).toBeNull()
  })

  it('carte vue par un gestionnaire : jamais de ligne « Bureau », même si la copropriété en portait un', () => {
    render(<CarteCoproprieteQr copropriete={{ ...une, modifiable: true }} origine="https://vitfix.io" onModifier={vi.fn()} vueGestionnaire />)
    expect(screen.queryByText(/bureau/i)).toBeNull()
  })
})

// ── E7 filtre « Bureau » des vues Copropriétés et Signalements ───────────────

/** Monte le tableau du super admin sur une vue et attend le chargement ; `afficher` change de vue sur la même instance. */
async function rendreTableau(vue: VueEspaceQr, cabinets: CabinetQr[] = [cabinetAvec]) {
  const gestion = { cabinets, gestionnaires: [] }
  const { rerender } = render(<TableauSignalementsQr jeton={null} vue={vue} gestion={gestion} />)
  await waitFor(() => expect(screen.getByRole('button', { name: T.mettreAJour })).toBeInTheDocument())
  return { afficher: (autre: VueEspaceQr) => rerender(<TableauSignalementsQr jeton={null} vue={autre} gestion={gestion} />) }
}
const titresCartes = () => within(screen.getByRole('group', { name: T.coproprietes })).getAllByRole('heading').map((h) => h.textContent)
const lignesSignalements = () => within(screen.getByRole('list', { name: T.signalements })).getAllByRole('listitem')

describe('E7 filtre « Bureau » (vues Copropriétés et Signalements du super admin)', () => {
  it('aucun bureau nulle part : ni filtre ni libellé de bureau dans les trois vues, un seul chargement', async () => {
    tableauComplet = { coproprietes: [copro(C1, 'Résidence Une'), trois], signalements: [fuite, lampe] }
    const { afficher } = await rendreTableau('coproprietes', [cabinetSans])
    expect(screen.queryByLabelText(BF.libelle)).toBeNull()
    expect(screen.queryByText(/bureau/i)).toBeNull()
    afficher('signalements')
    expect(screen.queryByLabelText(BF.libelle)).toBeNull()
    afficher('tableau-de-bord')
    expect(screen.queryByLabelText(BF.libelle)).toBeNull()
    expect(appels.map((a) => a.url)).toEqual([URL_TABLEAU])
  })

  it('options : « Tous les bureaux », puis les bureaux des copropriétés (fermé signalé) ; aucune requête tant qu’aucun n’est choisi', async () => {
    tableauComplet = { coproprietes: [une, deux, trois], signalements: [fuite, porte, lampe] }
    await rendreTableau('coproprietes')
    const filtre = screen.getByLabelText(BF.libelle)
    expect(filtre).toHaveValue('')
    expect(options(filtre)).toEqual([BF.tous, 'Nord', 'Sud (fermé)'])
    expect(appels.map((a) => a.url)).toEqual([URL_TABLEAU])
  })

  it('un bureau choisi : le tableau relu par ?bureau= ; cartes de ce bureau ; même choix dans la vue Signalements (lignes rendues par le serveur, plus anciennes comprises), sans autre lecture', async () => {
    tableauComplet = { coproprietes: [une, deux, trois, quatre], signalements: [fuite, porte, lampe] }
    parBureau = { [B1]: { coproprietes: [une, quatre], signalements: [fuite, ancien] } }
    const { afficher } = await rendreTableau('coproprietes')
    fireEvent.change(screen.getByLabelText(BF.libelle), { target: { value: B1 } })
    await waitFor(() => expect(titresCartes()).toEqual(['Résidence Une', 'Résidence Quatre']))
    expect(lecturesFiltrees().map((a) => a.url)).toEqual([URL_NORD])

    afficher('signalements')
    expect(screen.getByLabelText(BF.libelle)).toHaveValue(B1)
    expect(lignesSignalements()).toHaveLength(2)
    expect(lignesSignalements()[1]).toHaveTextContent('Ascenseur')
    // Filtre par copropriété : les copropriétés du bureau seulement.
    expect(options(screen.getByLabelText(T.filtrerCopro))).toEqual([T.toutesCopros, 'Résidence Une', 'Résidence Quatre'])
    // Détail d'un signalement que seul le filtre rend.
    fireEvent.click(within(lignesSignalements()[1]).getByRole('button', { name: T.voirDetail }))
    expect(within(screen.getByRole('dialog')).getByText('Description fictive')).toBeInTheDocument()
    expect(lecturesFiltrees()).toHaveLength(1)
  })

  it('tableau de bord : jamais le filtre « Bureau », tous les signalements même si un bureau est choisi ailleurs', async () => {
    tableauComplet = { coproprietes: [une, deux, trois], signalements: [fuite, porte, lampe] }
    parBureau = { [B1]: { coproprietes: [une], signalements: [fuite] } }
    const { afficher } = await rendreTableau('signalements')
    fireEvent.change(screen.getByLabelText(BF.libelle), { target: { value: B1 } })
    await waitFor(() => expect(lignesSignalements()).toHaveLength(1))
    afficher('tableau-de-bord')
    expect(screen.queryByLabelText(BF.libelle)).toBeNull()
    expect(lignesSignalements()).toHaveLength(3)
  })

  it('« Tous les bureaux » : le tableau complet, sans nouvelle lecture', async () => {
    tableauComplet = { coproprietes: [une, deux, trois], signalements: [fuite, porte, lampe] }
    parBureau = { [B1]: { coproprietes: [une], signalements: [fuite] } }
    await rendreTableau('signalements')
    fireEvent.change(screen.getByLabelText(BF.libelle), { target: { value: B1 } })
    await waitFor(() => expect(lignesSignalements()).toHaveLength(1))
    fireEvent.change(screen.getByLabelText(BF.libelle), { target: { value: '' } })
    expect(lignesSignalements()).toHaveLength(3)
    expect(appels.map((a) => a.url)).toEqual([URL_TABLEAU, URL_NORD])
  })

  it('bureau sans signalement : « Aucun signalement pour ce filtre » ; sans copropriété affichée : « Aucune copropriété pour ce filtre »', async () => {
    tableauComplet = { coproprietes: [une, deux, trois], signalements: [fuite, porte, lampe] }
    parBureau = { [B2]: { coproprietes: [], signalements: [] } }
    const { afficher } = await rendreTableau('signalements')
    fireEvent.change(screen.getByLabelText(BF.libelle), { target: { value: B2 } })
    expect(await screen.findByText(T.aucunSignalementFiltre)).toBeInTheDocument()
    afficher('coproprietes')
    expect(screen.getByText(G.copropriete.aucuneFiltre)).toBeInTheDocument()
  })

  it('plusieurs cabinets avec des bureaux : « Cabinet · Bureau », par ordre alphabétique', async () => {
    const nordAutre = { id: B4, nom: 'Nord', ferme: false }
    tableauComplet = { coproprietes: [une, copro(C2, 'Résidence Deux', { cabinet: RESUME_K2, bureau: nordAutre })], signalements: [] }
    await rendreTableau('coproprietes', [cabinetAvec, { ...autre, nbBureaux: 1, nbBureauxOuverts: 1 }])
    expect(options(screen.getByLabelText(BF.libelle))).toEqual([BF.tous, 'Autre Exemple · Nord', 'Cabinet Exemple · Nord'])
  })

  it('lecture du bureau en échec : message et « Réessayer », qui la relit', async () => {
    tableauComplet = { coproprietes: [une, trois], signalements: [fuite, lampe] }
    parBureau = { [B1]: { coproprietes: [une], signalements: [fuite] } }
    refusFiltre = { code: 'serveur', status: 500 }
    await rendreTableau('signalements')
    fireEvent.change(screen.getByLabelText(BF.libelle), { target: { value: B1 } })
    expect(await screen.findByText(T.erreurs.serveur)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: G.reessayer }))
    await waitFor(() => expect(lignesSignalements()).toHaveLength(1))
    expect(lecturesFiltrees()).toHaveLength(2)
  })

  it('sous un filtre, une copropriété modifiée : le tableau du bureau est relu (la carte suit la réponse du serveur)', async () => {
    tableauComplet = { coproprietes: [une, trois, quatre], signalements: [] }
    parBureau = { [B1]: { coproprietes: [une, quatre], signalements: [] } }
    await rendreTableau('coproprietes')
    fireEvent.change(screen.getByLabelText(BF.libelle), { target: { value: B1 } })
    await waitFor(() => expect(titresCartes()).toEqual(['Résidence Une', 'Résidence Quatre']))
    // Bureau retiré : le serveur ne rend plus Résidence Une dans le bureau Nord.
    modifiee = copro(C1, 'Résidence Une')
    parBureau = { [B1]: { coproprietes: [quatre], signalements: [] } }
    fireEvent.click(within(screen.getByRole('heading', { name: 'Résidence Une' }).closest('section') ?? document.body).getAllByRole('button', { name: T.modifier })[0])
    const dialogue = screen.getByRole('dialog')
    fireEvent.change(await within(dialogue).findByLabelText(BC.champ), { target: { value: '' } })
    fireEvent.click(within(dialogue).getByRole('button', { name: T.formulaire.enregistrer }))
    await waitFor(() => expect(titresCartes()).toEqual(['Résidence Quatre']))
    expect(lecturesFiltrees()).toHaveLength(2)
    expect(screen.getByLabelText(BF.libelle)).toHaveValue(B1)
  })

  it('copropriété créée sans son bureau (207) : avertissement dans la vue, la fenêtre se ferme, la carte est ajoutée', async () => {
    tableauComplet = { coproprietes: [une], signalements: [] }
    bureauNonPose = true
    await rendreTableau('coproprietes')
    fireEvent.click(screen.getByRole('button', { name: T.ajouterCopro }))
    const dialogue = screen.getByRole('dialog')
    fireEvent.change(within(dialogue).getByLabelText(T.formulaire.nom), { target: { value: 'Villa Exemple' } })
    fireEvent.change(within(dialogue).getByLabelText(G.copropriete.cabinet), { target: { value: K1 } })
    fireEvent.change(await within(dialogue).findByLabelText(BC.champ), { target: { value: B1 } })
    fireEvent.click(within(dialogue).getByRole('button', { name: T.formulaire.creerBouton }))
    expect(await screen.findByText(BC.bureauNonPose)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Villa Exemple' })).toBeInTheDocument()
  })

  it('vue d’un gestionnaire : jamais de filtre « Bureau » ni de ligne « Bureau », aucune requête par bureau ; sa fenêtre de copropriété est celle d’avant', async () => {
    tableauComplet = { coproprietes: [{ ...une, modifiable: true }, { ...quatre, modifiable: true }], signalements: [fuite] }
    const gestionnaire = { domaines: ['exemple.test'] }
    const { rerender } = render(<TableauSignalementsQr jeton={null} vue="coproprietes" gestionnaire={gestionnaire} />)
    await waitFor(() => expect(screen.getByRole('button', { name: T.mettreAJour })).toBeInTheDocument())
    expect(screen.queryByLabelText(BF.libelle)).toBeNull()
    expect(screen.queryByText(/bureau/i)).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: T.modifier })[0])
    expect(within(screen.getByRole('dialog')).queryByText(/bureau/i)).toBeNull()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: T.fermerFenetre }))
    rerender(<TableauSignalementsQr jeton={null} vue="signalements" gestionnaire={gestionnaire} />)
    expect(screen.queryByLabelText(BF.libelle)).toBeNull()
    expect(appels.map((a) => a.url)).toEqual([URL_TABLEAU])
  })
})
