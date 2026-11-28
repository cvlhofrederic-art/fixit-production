// tests/components/vitfixsignal/bureaux-gestionnaires.test.tsx
//
// Bureaux des cabinets clients (PR 2 : écrans du super admin, BROUILLON soumis avant fusion) — écrans E2, E3 et E4 du plan
// des bureaux, et l'étape de l'assistant d'import qui crée les fiches des gestionnaires inconnus (ajout de la PR 1,
// section Risques : sans bureau, chaque création y recevrait 409 bureau_requis) :
//   - E2 « Ajouter un gestionnaire » : liste « Bureau » OBLIGATOIRE dès que le cabinet choisi a un bureau ouvert, ABSENTE
//     sinon ; bureaux fermés jamais proposés ; bureauId envoyé seulement s'il est choisi ; 409 bureau_requis, bureau_ferme
//     et a_reverifier expliqués, la liste des bureaux relue ;
//   - E3 liste des gestionnaires : « Cabinet · Bureau » sur chaque ligne ; badge « Bureau à compléter » ; filtre
//     « Bureau » (tous, chaque bureau du cabinet, « Bureau à compléter ») qui passe par ?bureau= ;
//   - E4 page profil : sous le nom, deux lignes « Cabinet : … » puis « Bureau : … » (forme de la carte d'une copropriété,
//     E6 ; point e-11 validé le 20/11/2026), la ligne « Cabinet : … » seule sans bureau ; « Changer de
//     bureau » (bureaux ouverts du cabinet sauf l'actuel, jamais « aucun » : PATCH { bureauId } seul) ; aucun bureau à
//     proposer : « Aucun autre bureau ouvert… » pour une fiche qui a un bureau, « Aucun bureau ouvert… » pour une fiche
//     qui n'en a pas (point e-12) ; réactivation refusée 409 bureau_ferme expliquée ;
//   - import : un bureau pour toutes les fiches créées, obligatoire dès que le cabinet a un bureau ouvert ;
//   - tant qu'aucun bureau n'existe (aucune clé nbBureaux, nbBureauxOuverts ni bureau dans les réponses) : écrans
//     identiques à avant, aucun libellé de bureau, aucune requête nouvelle ; l'espace d'un gestionnaire ne change pas.
// Données fictives : « Cabinet Exemple », bureaux « Nord », « Sud » et « Est », adresses @exemple.test.

import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEXTES_GESTION_QR as G, dateParisQr } from '@/lib/vitfixsignal/affichage-gestion'
import { TEXTES_TABLEAU_QR as T } from '@/lib/vitfixsignal/affichage'
import { TEXTES_IMPORT_QR as I } from '@/lib/vitfixsignal/import/textes'
import { remplir } from '@/lib/coproprietaire/textes'
import type { CabinetQr, FicheGestionnaireDetailQr, GestionnaireQr, VerificationImportQr } from '@/lib/vitfixsignal/types'

type Rappel = (evenement: string, session: unknown) => void
const simul = vi.hoisted(() => ({ getUser: vi.fn(), signOut: vi.fn(), toastErreur: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: simul.getUser,
      signOut: simul.signOut,
      onAuthStateChange: (_rappel: Rappel) => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))
vi.mock('sonner', () => ({ toast: { error: simul.toastErreur, success: vi.fn() } }))

const { default: ListeGestionnairesQr } = await import('@/components/vitfixsignal/ListeGestionnairesQr')
const { default: FicheGestionnaireQr } = await import('@/components/vitfixsignal/FicheGestionnaireQr')
const { default: AssistantImportQr } = await import('@/components/vitfixsignal/AssistantImportQr')
const { default: EspaceVitfixSignal } = await import('@/components/vitfixsignal/espace/EspaceVitfixSignal')

const B = G.bureaux
const BG = G.bureaux.gestionnaire
const BF = G.bureaux.filtre

const K1 = 'a0000000-0000-4000-8000-0000000000a1'
const K2 = 'a0000000-0000-4000-8000-0000000000a2'
const B1 = 'b0000000-0000-4000-8000-0000000000b1'
const B2 = 'b0000000-0000-4000-8000-0000000000b2'
const B3 = 'b0000000-0000-4000-8000-0000000000b3'
const G1 = '11111111-1111-4111-8111-111111111111'
const G2 = '22222222-2222-4222-8222-222222222222'
const G3 = '33333333-3333-4333-8333-333333333333'
const G4 = '44444444-4444-4444-8444-444444444444'
const G9 = '99999999-9999-4999-8999-999999999999'
const URL_BUREAUX = `/api/vitfixsignal/cabinets/${K1}/bureaux`

const RESUME_K1 = { id: K1, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }
const RESUME_K2 = { id: K2, nom: 'Autre Exemple', identifiant: 'autre-exemple' }
/** Cabinet tel que les réponses le rendent tant qu'il n'a aucun bureau (ou sans la migration) : aucune clé de bureau. */
const cabinetSans: CabinetQr = { ...RESUME_K1, langue: 'fr', domaines: ['exemple.test'], identifiantFige: true, nbCoproprietes: 0, nbGestionnaires: 3 }
/** Le même avec ses bureaux : Nord (ouvert) et Sud (fermé). */
const cabinetAvec: CabinetQr = { ...cabinetSans, nbBureaux: 2, nbBureauxOuverts: 1 }
const autre: CabinetQr = { ...RESUME_K2, langue: 'fr', domaines: ['autre.exemple.test'], identifiantFige: true, nbCoproprietes: 0, nbGestionnaires: 1 }

type Bureau = { id: string; nom: string; ferme: boolean; cabinetId: string; fermeLe: string | null; creeLe: string; nbGestionnaires: number; nbCoproprietes: number }
const bureau = (id: string, nom: string, ferme = false): Bureau => ({
  id, nom, ferme, cabinetId: K1, fermeLe: ferme ? '2026-11-19T09:00:00+00:00' : null, creeLe: '2026-11-19T08:00:00+00:00', nbGestionnaires: 0, nbCoproprietes: 0,
})
const nord = bureau(B1, 'Nord')
const sud = bureau(B2, 'Sud', true)
const est = bureau(B3, 'Est')
const resumeBureau = (b: Bureau) => ({ id: b.id, nom: b.nom, ferme: b.ferme })

const fiche = (id: string, nom: string, extra: Partial<GestionnaireQr> = {}): GestionnaireQr => ({
  id, nom, cabinet: RESUME_K1, email: `${nom.toLowerCase().replace(/\s+/g, '.')}@exemple.test`, etat: 'adresse_confirmee', domaineForce: false,
  coproprietes: 0, ouverts: 0, urgents: 0, creeLe: '2026-11-01T09:00:00.000Z', confirmeeLe: null, ...extra,
})
const marie = fiche(G1, 'Marie Exemple', { bureau: resumeBureau(nord) })
const lea = fiche(G2, 'Léa Exemple', { bureau: resumeBureau(sud), etat: 'desactive' })
const paul = fiche(G3, 'Paul Exemple')
const jean = fiche(G4, 'Jean Exemple', { cabinet: RESUME_K2, email: 'jean.exemple@autre.exemple.test' })
const AJOUTE = remplir(G.gestionnaires.ajouteLe, { date: dateParisQr('2026-11-01T09:00:00.000Z') })

// ── Réseau simulé ────────────────────────────────────────────────────────────

type Appel = { url: string; methode: string; corps: Record<string, unknown> | null }
let appels: Appel[] = []
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

/** Bureaux du cabinet Exemple rendus par GET /cabinets/[id]/bureaux (triés par nom, comme le serveur). */
let bureaux: Bureau[] = []
/**
 * Réponse refusée à la prochaine écriture (POST, PATCH) ; `refusLecture` : à la prochaine lecture des bureaux (code
 * « reseau » : l'appel lui-même échoue, comme un réseau coupé).
 */
let refus: { code: string; status: number } | null = null
let refusLecture: { code: string; status: number } | null = null
/** Fiches rendues par GET /gestionnaires?bureau=<valeur>. */
let parBureau: Record<string, GestionnaireQr[]> = {}
let refusFiltre: { code: string; status: number } | null = null
/** Page profil servie (GET /gestionnaires/[id]) ; un changement de bureau réussi y pose le nouveau bureau. */
let ficheServie: FicheGestionnaireDetailQr | null = null
let verifications = 0
let verificationServie: (n: number) => VerificationImportQr = () => ({ diagnostics: [], gestionnairesInconnus: [], horsDomaine: false })

const reponseRefusee = (r: { code: string; status: number }) => json({ error: r.code }, r.status)

function lectureBureaux(): Response {
  if (refusLecture) {
    const r = refusLecture
    refusLecture = null
    if (r.code === 'reseau') throw new TypeError('Failed to fetch')
    return reponseRefusee(r)
  }
  return json({ bureaux })
}

function listeFiltree(url: string): Response {
  if (refusFiltre) {
    const r = refusFiltre
    refusFiltre = null
    return reponseRefusee(r)
  }
  const bureauFiltre = new URL(url, 'https://vitfix.io').searchParams.get('bureau')
  return json({ gestionnaires: bureauFiltre === null ? [marie, lea, paul] : parBureau[bureauFiltre] ?? [] })
}

function ecriture(a: Appel): Response {
  if (refus) {
    const r = refus
    refus = null
    return reponseRefusee(r)
  }
  if (a.url === '/api/vitfixsignal/gestionnaires') {
    return json({ gestionnaire: fiche(G9, String(a.corps?.nom ?? '')), emailEnvoye: true, coproprietesAvecAdresseSaisie: 0 }, 201)
  }
  if (a.url.endsWith('/coproprietes/import')) {
    verifications += 1
    return json(verificationServie(verifications))
  }
  const choisi = bureaux.find((b) => b.id === a.corps?.bureauId)
  if (ficheServie && choisi) ficheServie = { ...ficheServie, gestionnaire: { ...ficheServie.gestionnaire, bureau: resumeBureau(choisi) } }
  return json({ gestionnaire: ficheServie?.gestionnaire ?? null })
}

const MOI = { profil: 'gestionnaire', nom: 'Marie Exemple', cabinet: { identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple', domaines: ['exemple.test'] } }

function routeur(a: Appel): Response {
  if (a.url === URL_BUREAUX) return lectureBureaux()
  if (a.methode !== 'GET') return ecriture(a)
  if (a.url.startsWith('/api/vitfixsignal/gestionnaires?')) return listeFiltree(a.url)
  if (ficheServie && a.url === `/api/vitfixsignal/gestionnaires/${ficheServie.gestionnaire.id}`) return json(ficheServie)
  if (a.url.startsWith('/api/vitfixsignal/tableau')) return json({ tableau: { coproprietes: [], signalements: [] } })
  if (a.url === '/api/vitfixsignal/cabinets') return json({ cabinets: [cabinetAvec] })
  if (a.url === '/api/vitfixsignal/moi') return json(MOI)
  return json({ error: 'introuvable' }, 404)
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  bureaux = [nord, sud]
  refus = null
  refusLecture = null
  refusFiltre = null
  parBureau = {}
  ficheServie = null
  verifications = 0
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const appel = { url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null }
    appels.push(appel)
    return routeur(appel)
  }))
})
afterEach(() => vi.unstubAllGlobals())

const options = (liste: HTMLElement) => within(liste).getAllByRole('option').map((o) => o.textContent)
const lecturesBureaux = () => appels.filter((a) => a.url.includes('/bureaux'))
const posts = () => appels.filter((a) => a.url === '/api/vitfixsignal/gestionnaires' && a.methode === 'POST')

// ── E2 « Ajouter un gestionnaire » ───────────────────────────────────────────

const rappelsListe = { onOuvrir: vi.fn(), onModifie: vi.fn(async () => {}), onReessayer: vi.fn(), onCabinets: vi.fn() }
const rendreListe = (gestionnaires: GestionnaireQr[], cabinets: CabinetQr[]) =>
  render(<ListeGestionnairesQr gestionnaires={gestionnaires} cabinets={cabinets} erreur={null} coproprietes={[]} {...rappelsListe} />)

describe('E2 « Ajouter un gestionnaire » : liste « Bureau »', () => {
  /**
   * La liste, puis, quand un cabinet a des bureaux, la lecture des options de son filtre « Bureau » (E3) attendue : les
   * appels comptés ensuite sont ceux de la fenêtre seule.
   */
  async function rendreListe(gestionnaires: GestionnaireQr[], cabinets: CabinetQr[]) {
    render(<ListeGestionnairesQr gestionnaires={gestionnaires} cabinets={cabinets} erreur={null} coproprietes={[]} {...rappelsListe} />)
    if (!cabinets.some((c) => (c.nbBureaux ?? 0) > 0)) return
    await waitFor(() => expect(options(screen.getByLabelText(BF.libelle)).length).toBeGreaterThan(2))
    appels = []
  }
  const ouvrir = () => {
    fireEvent.click(screen.getByRole('button', { name: G.gestionnaires.ajouter }))
    return screen.getByRole('dialog')
  }
  const saisir = (f: HTMLElement) => {
    fireEvent.change(within(f).getByLabelText(G.gestionnaires.nom), { target: { value: 'Jean Exemple' } })
    fireEvent.change(within(f).getByLabelText(G.gestionnaires.email), { target: { value: 'jean.exemple@exemple.test' } })
  }
  const creer = (f: HTMLElement) => fireEvent.click(within(f).getByRole('button', { name: G.gestionnaires.creer }))
  const CORPS_AVANT = { nom: 'Jean Exemple', email: 'jean.exemple@exemple.test', cabinetId: K1, coproprieteIds: [], forcerDomaine: false }

  it('cabinet sans bureau : aucune liste « Bureau », aucun libellé de bureau, aucune requête ; le corps envoyé reste celui d’avant', async () => {
    await rendreListe([], [cabinetSans])
    const f = ouvrir()
    expect(within(f).queryByLabelText(BG.champ)).toBeNull()
    expect(within(f).queryByText(/bureau/i)).toBeNull()
    saisir(f)
    creer(f)
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0].corps).toEqual(CORPS_AVANT)
    expect(lecturesBureaux()).toEqual([])
  })

  it('cabinet dont tous les bureaux sont fermés : aucune liste, aucune requête des bureaux, aucun bureau exigé', async () => {
    await rendreListe([], [{ ...cabinetSans, nbBureaux: 1, nbBureauxOuverts: 0 }])
    const f = ouvrir()
    expect(within(f).queryByLabelText(BG.champ)).toBeNull()
    saisir(f)
    creer(f)
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0].corps).toEqual(CORPS_AVANT)
    expect(lecturesBureaux()).toEqual([])
  })

  it('cabinet avec un bureau ouvert : liste obligatoire (aide), bureaux ouverts seulement ; sans choix : refus sans envoi ; choisi : bureauId', async () => {
    await rendreListe([], [cabinetAvec])
    const f = ouvrir()
    const liste = await within(f).findByLabelText(BG.champ)
    expect(liste).toBeRequired()
    expect(within(f).getByText(BG.aide)).toBeInTheDocument()
    expect(options(liste)).toEqual([B.choisir, 'Nord'])
    expect(appels.map((a) => a.url)).toEqual([URL_BUREAUX])

    saisir(f)
    creer(f)
    expect(within(f).getByText(BG.requis)).toBeInTheDocument()
    expect(posts()).toEqual([])

    fireEvent.change(liste, { target: { value: B1 } })
    creer(f)
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0].corps).toEqual({ ...CORPS_AVANT, bureauId: B1 })
    await waitFor(() => expect(rappelsListe.onModifie).toHaveBeenCalled())
  })

  it('plusieurs cabinets : liste présente pour celui qui a un bureau ouvert, absente pour l’autre ; un autre cabinet efface le choix', async () => {
    await rendreListe([], [cabinetAvec, autre])
    const f = ouvrir()
    expect(within(f).queryByLabelText(BG.champ)).toBeNull()
    fireEvent.change(within(f).getByLabelText(G.gestionnaires.cabinet), { target: { value: K1 } })
    fireEvent.change(await within(f).findByLabelText(BG.champ), { target: { value: B1 } })
    fireEvent.change(within(f).getByLabelText(G.gestionnaires.cabinet), { target: { value: K2 } })
    expect(within(f).queryByLabelText(BG.champ)).toBeNull()
    fireEvent.change(within(f).getByLabelText(G.gestionnaires.cabinet), { target: { value: K1 } })
    expect(await within(f).findByLabelText(BG.champ)).toHaveValue('')
  })

  it('409 bureau_requis (un bureau ouvert entre-temps) : expliqué ; bureaux relus, la liste apparaît ; puis l’envoi part avec le bureau', async () => {
    refus = { code: 'bureau_requis', status: 409 }
    await rendreListe([], [cabinetSans])
    const f = ouvrir()
    saisir(f)
    creer(f)
    expect(await within(f).findByText(T.erreurs.bureau_requis)).toBeInTheDocument()
    const liste = await within(f).findByLabelText(BG.champ)
    expect(lecturesBureaux().map((a) => a.url)).toEqual([URL_BUREAUX])
    fireEvent.change(liste, { target: { value: B1 } })
    creer(f)
    await waitFor(() => expect(posts()).toHaveLength(2))
    expect(posts()[1].corps).toEqual({ ...CORPS_AVANT, bureauId: B1 })
  })

  it('409 bureau_ferme (fermé entre-temps) : expliqué ; bureaux relus : le bureau fermé n’est plus proposé, le choix est à refaire', async () => {
    await rendreListe([], [cabinetAvec])
    const f = ouvrir()
    saisir(f)
    fireEvent.change(await within(f).findByLabelText(BG.champ), { target: { value: B1 } })
    refus = { code: 'bureau_ferme', status: 409 }
    bureaux = [est, { ...nord, ferme: true }, sud]
    creer(f)
    expect(await within(f).findByText(T.erreurs.bureau_ferme)).toBeInTheDocument()
    await waitFor(() => expect(options(within(f).getByLabelText(BG.champ))).toEqual([B.choisir, 'Est']))
    expect(within(f).getByLabelText(BG.champ)).toHaveValue('')
    expect(lecturesBureaux()).toHaveLength(2)
  })

  it('409 a_reverifier avec un bureau choisi : « les bureaux ont changé », bureaux relus', async () => {
    await rendreListe([], [cabinetAvec])
    const f = ouvrir()
    saisir(f)
    fireEvent.change(await within(f).findByLabelText(BG.champ), { target: { value: B1 } })
    refus = { code: 'a_reverifier', status: 409 }
    creer(f)
    expect(await within(f).findByText(B.aReverifier)).toBeInTheDocument()
    await waitFor(() => expect(lecturesBureaux()).toHaveLength(2))
  })

  it('lecture des bureaux en échec : message et « Réessayer » ; création impossible tant que la liste n’est pas lue', async () => {
    await rendreListe([], [cabinetAvec])
    refusLecture = { code: 'serveur', status: 500 }
    const f = ouvrir()
    expect(await within(f).findByText(B.fenetre.erreurLecture)).toBeInTheDocument()
    expect(within(f).getByRole('button', { name: G.gestionnaires.creer })).toBeDisabled()
    fireEvent.click(within(f).getByRole('button', { name: G.reessayer }))
    expect(await within(f).findByLabelText(BG.champ)).toBeInTheDocument()
    expect(within(f).getByRole('button', { name: G.gestionnaires.creer })).not.toBeDisabled()
    expect(simul.toastErreur).not.toHaveBeenCalled()
  })

  it('lecture des bureaux, réseau coupé : le message et « Réessayer » dans la fenêtre, et un toast (une fois)', async () => {
    await rendreListe([], [cabinetAvec])
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    refusLecture = { code: 'reseau', status: 0 }
    const f = ouvrir()
    expect(await within(f).findByText(T.erreurs.reseau)).toBeInTheDocument()
    expect(within(f).getByRole('button', { name: G.reessayer })).toBeInTheDocument()
    expect(simul.toastErreur).toHaveBeenCalledTimes(1)
    expect(simul.toastErreur).toHaveBeenCalledWith(T.erreurs.reseau)
  })
})

// ── E3 Liste des gestionnaires ───────────────────────────────────────────────

const ligne = (nom: string) => screen.getByRole('heading', { name: nom, level: 3 }).closest('li') as HTMLElement
const noms = () => within(screen.getByRole('list', { name: G.gestionnaires.liste })).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

describe('E3 liste des gestionnaires', () => {
  it('aucun bureau nulle part : ligne « Cabinet · Ajouté le … » d’avant, ni filtre, ni badge, ni libellé de bureau, aucune requête', () => {
    rendreListe([fiche(G1, 'Marie Exemple'), paul], [cabinetSans])
    expect(within(ligne('Marie Exemple')).getByText(`Cabinet Exemple · ${AJOUTE}`)).toBeInTheDocument()
    expect(screen.queryByLabelText(BF.libelle)).toBeNull()
    expect(screen.queryByText(/bureau/i)).toBeNull()
    expect(appels).toEqual([])
  })

  it('« Cabinet · Bureau » par ligne (bureau fermé signalé) ; badge « Bureau à compléter » sur une fiche sans bureau d’un cabinet qui a un bureau ouvert, seulement', () => {
    rendreListe([marie, lea, paul, jean], [cabinetAvec, autre])
    expect(within(ligne('Marie Exemple')).getByText(`Cabinet Exemple · Nord · ${AJOUTE}`)).toBeInTheDocument()
    expect(within(ligne('Léa Exemple')).getByText(`Cabinet Exemple · Sud (fermé) · ${AJOUTE}`)).toBeInTheDocument()
    expect(within(ligne('Paul Exemple')).getByText(`Cabinet Exemple · ${AJOUTE}`)).toBeInTheDocument()
    expect(within(ligne('Paul Exemple')).getByText(BG.aCompleter)).toBeInTheDocument()
    expect(within(ligne('Marie Exemple')).queryByText(BG.aCompleter)).toBeNull()
    expect(within(ligne('Léa Exemple')).queryByText(BG.aCompleter)).toBeNull()
    expect(within(ligne('Jean Exemple')).queryByText(BG.aCompleter)).toBeNull()
  })

  it('filtre « Bureau » : tous, chaque bureau du cabinet (fermé signalé), « Bureau à compléter » ; un choix passe par ?bureau=', async () => {
    parBureau = { [B1]: [marie], aucun: [paul] }
    rendreListe([marie, lea, paul], [cabinetAvec])
    const filtre = screen.getByLabelText(BF.libelle)
    await waitFor(() => expect(options(filtre)).toEqual([BF.tous, 'Nord', 'Sud (fermé)', BF.aCompleter]))
    expect(filtre).toHaveValue('')

    fireEvent.change(filtre, { target: { value: B1 } })
    await waitFor(() => expect(noms()).toEqual(['Marie Exemple']))
    expect(appels.at(-1)?.url).toBe(`/api/vitfixsignal/gestionnaires?etat=tous&bureau=${B1}`)

    fireEvent.change(filtre, { target: { value: 'aucun' } })
    await waitFor(() => expect(noms()).toEqual(['Paul Exemple']))
    expect(appels.at(-1)?.url).toBe('/api/vitfixsignal/gestionnaires?etat=tous&bureau=aucun')

    const avant = appels.length
    fireEvent.change(filtre, { target: { value: '' } })
    expect(noms()).toEqual(['Marie Exemple', 'Léa Exemple', 'Paul Exemple'])
    expect(appels).toHaveLength(avant)
  })

  it('aucune fiche pour ce filtre : le dit', async () => {
    rendreListe([marie], [cabinetAvec])
    const filtre = screen.getByLabelText(BF.libelle)
    await waitFor(() => expect(options(filtre)).toContain('Nord'))
    fireEvent.change(filtre, { target: { value: B1 } })
    expect(await screen.findByText(BF.aucunGestionnaire)).toBeInTheDocument()
  })

  it('filtre « Cabinet » : un autre cabinet remet « Bureau » à « Tous » ; un cabinet sans bureau masque le filtre « Bureau »', async () => {
    parBureau = { [B1]: [marie] }
    rendreListe([marie, paul, jean], [cabinetAvec, autre])
    const filtreBureau = screen.getByLabelText(BF.libelle)
    await waitFor(() => expect(options(filtreBureau)).toContain('Nord'))
    fireEvent.change(filtreBureau, { target: { value: B1 } })
    await waitFor(() => expect(noms()).toEqual(['Marie Exemple']))

    fireEvent.change(screen.getByLabelText(G.gestionnaires.filtreCabinet), { target: { value: K2 } })
    expect(screen.queryByLabelText(BF.libelle)).toBeNull()
    expect(noms()).toEqual(['Jean Exemple'])

    fireEvent.change(screen.getByLabelText(G.gestionnaires.filtreCabinet), { target: { value: '' } })
    expect(screen.getByLabelText(BF.libelle)).toHaveValue('')
    expect(noms()).toEqual(['Marie Exemple', 'Paul Exemple', 'Jean Exemple'])
  })

  it('sous un filtre « Bureau », une action relit aussi la liste filtrée avant d’annoncer son succès', async () => {
    parBureau = { [B2]: [lea] }
    rendreListe([marie, lea, paul], [cabinetAvec])
    const filtre = screen.getByLabelText(BF.libelle)
    await waitFor(() => expect(options(filtre)).toContain('Sud (fermé)'))
    fireEvent.change(filtre, { target: { value: B2 } })
    await waitFor(() => expect(noms()).toEqual(['Léa Exemple']))
    fireEvent.click(within(ligne('Léa Exemple')).getByRole('button', { name: G.gestionnaires.reactiver }))
    expect(await screen.findByText(G.gestionnaires.reactive)).toBeInTheDocument()
    expect(rappelsListe.onModifie).toHaveBeenCalled()
    expect(appels.filter((a) => a.url === `/api/vitfixsignal/gestionnaires?etat=tous&bureau=${B2}`)).toHaveLength(2)
  })

  it('réactivation d’une fiche restée dans un bureau fermé : 409 bureau_ferme expliqué', async () => {
    refus = { code: 'bureau_ferme', status: 409 }
    rendreListe([lea], [cabinetAvec])
    fireEvent.click(within(ligne('Léa Exemple')).getByRole('button', { name: G.gestionnaires.reactiver }))
    expect(await screen.findByText(BG.reactivationBureauFerme)).toBeInTheDocument()
    expect(rappelsListe.onModifie).not.toHaveBeenCalled()
  })

  it('liste filtrée en échec : message et « Réessayer », qui la relit', async () => {
    parBureau = { [B1]: [marie] }
    rendreListe([marie, paul], [cabinetAvec])
    const filtre = screen.getByLabelText(BF.libelle)
    await waitFor(() => expect(options(filtre)).toContain('Nord'))
    refusFiltre = { code: 'serveur', status: 500 }
    fireEvent.change(filtre, { target: { value: B1 } })
    expect(await screen.findByText(T.erreurs.serveur)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: G.reessayer }))
    await waitFor(() => expect(noms()).toEqual(['Marie Exemple']))
  })

  it('fiche effacée (« Ancien gestionnaire ») sans bureau d’un cabinet qui a un bureau ouvert : aucun badge « Bureau à compléter » (aucun bureau ne peut lui être posé)', () => {
    const effacee: GestionnaireQr = { ...fiche(G4, 'Fiche Effacee'), nom: null, email: null, etat: 'desactive' }
    rendreListe([effacee, paul], [cabinetAvec])
    expect(within(ligne(G.fiche.ancien)).queryByText(BG.aCompleter)).toBeNull()
    expect(within(ligne('Paul Exemple')).getByText(BG.aCompleter)).toBeInTheDocument()
  })

  it('options du filtre « Bureau » en cours de lecture : « Chargement des bureaux… » annoncé, puis les bureaux', async () => {
    rendreListe([marie, paul], [cabinetAvec])
    expect(screen.getByText(B.fenetre.chargement).closest('[role="status"]')).not.toBeNull()
    await waitFor(() => expect(options(screen.getByLabelText(BF.libelle))).toContain('Nord'))
    expect(screen.queryByText(B.fenetre.chargement)).toBeNull()
  })

  it('options du filtre « Bureau » en échec (500) : message annoncé et « Réessayer », qui les relit ; aucun toast', async () => {
    refusLecture = { code: 'serveur', status: 500 }
    rendreListe([marie, paul], [cabinetAvec])
    const message = await screen.findByText(B.fenetre.erreurLecture)
    expect(message.closest('[role="alert"]')).not.toBeNull()
    expect(options(screen.getByLabelText(BF.libelle))).toEqual([BF.tous, BF.aCompleter])
    fireEvent.click(screen.getByRole('button', { name: G.reessayer }))
    await waitFor(() => expect(options(screen.getByLabelText(BF.libelle))).toEqual([BF.tous, 'Nord', 'Sud (fermé)', BF.aCompleter]))
    expect(screen.queryByText(B.fenetre.erreurLecture)).toBeNull()
    expect(lecturesBureaux()).toHaveLength(2)
    expect(simul.toastErreur).not.toHaveBeenCalled()
  })

  it('options du filtre « Bureau », réseau coupé : le message, « Réessayer » et un toast (une fois)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    refusLecture = { code: 'reseau', status: 0 }
    rendreListe([marie, paul], [cabinetAvec])
    expect(await screen.findByText(T.erreurs.reseau)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: G.reessayer })).toBeInTheDocument()
    expect(simul.toastErreur).toHaveBeenCalledTimes(1)
    expect(simul.toastErreur).toHaveBeenCalledWith(T.erreurs.reseau)
  })

  it('filtre « Bureau » : un nom long ne déborde pas de l’écran (liste rétrécie dans son étiquette, bornée à la barre)', async () => {
    rendreListe([marie, paul], [cabinetAvec])
    const filtre = screen.getByLabelText(BF.libelle)
    await waitFor(() => expect(options(filtre)).toContain('Nord'))
    // La liste rétrécit dans son étiquette (min-w-0) ; sans max-w-full, qui ferait d'elle un contrôle « compressible »
    // (largeur minimale de contenu nulle selon le navigateur) : le groupe des filtres garde sa largeur naturelle (ci-dessous).
    expect(filtre).toHaveClass('min-w-0')
    expect(filtre).not.toHaveClass('max-w-full')
    const etiquette = filtre.closest('label') as HTMLElement
    expect(etiquette).toHaveClass('min-w-0', 'max-w-full')
    expect(etiquette.parentElement).toHaveClass('max-w-full')
  })

  it('barre des filtres, ordinateur : les boutons restent à droite, sur la ligne du filtre « Cabinet » ; « Bureau » passe à la ligne dans le groupe des filtres', async () => {
    rendreListe([marie, paul], [cabinetAvec, autre])
    const filtre = screen.getByLabelText(BF.libelle)
    await waitFor(() => expect(options(filtre)).toContain('Nord'))
    const groupe = (filtre.closest('label') as HTMLElement).parentElement as HTMLElement
    expect(groupe).toContainElement(screen.getByLabelText(G.gestionnaires.filtreCabinet))
    // flex-1 : le groupe prend la place laissée par les boutons et y passe à la ligne ; sa largeur minimale est celle de son
    // filtre le plus large (sans min-w-0), bornée à la barre (max-w-full) : les boutons ne passent dessous que s'il ne tient pas.
    expect(groupe).toHaveClass('flex', 'flex-1', 'flex-wrap', 'max-w-full')
    expect(groupe).not.toHaveClass('min-w-0')
    const boutons = screen.getByRole('button', { name: G.gestionnaires.ajouter }).parentElement as HTMLElement
    expect(boutons.parentElement).toBe(groupe.parentElement)
    // En haut de la barre (sur la ligne du filtre « Cabinet »), pas au milieu des deux lignes de filtres.
    expect(boutons).toHaveClass('flex', 'flex-wrap', 'gap-2', 'self-start')
  })

  it('barre des filtres sans bureau : celle d’avant (filtre « Cabinet » directement dans la barre, boutons sans classe nouvelle)', () => {
    rendreListe([fiche(G1, 'Marie Exemple'), paul, jean], [cabinetSans, autre])
    const etiquette = screen.getByLabelText(G.gestionnaires.filtreCabinet).closest('label') as HTMLElement
    const barre = etiquette.parentElement as HTMLElement
    expect(barre.className).toBe('flex flex-wrap items-center justify-between gap-3')
    const boutons = screen.getByRole('button', { name: G.gestionnaires.ajouter }).parentElement as HTMLElement
    expect(boutons.parentElement).toBe(barre)
    expect(boutons.className).toBe('flex flex-wrap gap-2')
  })
})

// ── E4 Page profil ───────────────────────────────────────────────────────────

const detail = (gestionnaire: GestionnaireQr): FicheGestionnaireDetailQr => ({ gestionnaire, envois: [], attributions: [], creations: [], journal: [] })
const rappelsFiche = { onRetour: vi.fn(), onModifie: vi.fn(async () => {}) }
async function rendreFiche(g: GestionnaireQr, cabinets?: CabinetQr[] | null) {
  ficheServie = detail(g)
  render(<FicheGestionnaireQr id={g.id} coproprietes={[]} gestionnaires={[g]} cabinets={cabinets} {...rappelsFiche} />)
  await screen.findByRole('heading', { name: g.nom ?? G.fiche.ancien, level: 2 })
}
const entete = (nom: string) => screen.getByRole('heading', { name: nom, level: 2 }).closest('section') as HTMLElement
/** Sous-titre de la page profil (paragraphe sous le nom) ; ses lignes : une par élément enfant, ou son texte seul. */
const sousTitre = (nom: string) => screen.getByRole('heading', { name: nom, level: 2 }).nextElementSibling as HTMLElement
const lignesSousTitre = (nom: string): string[] => {
  const p = sousTitre(nom)
  return p.children.length > 0 ? [...p.children].map((e) => e.textContent ?? '') : [p.textContent ?? '']
}

describe('E4 page profil d’un gestionnaire', () => {
  it('cabinet sans bureau (ou cabinets non transmis) : « Cabinet : Cabinet Exemple » d’avant, aucun bouton ni libellé de bureau, aucune requête', async () => {
    await rendreFiche(fiche(G1, 'Marie Exemple'), [cabinetSans])
    const e = entete('Marie Exemple')
    expect(within(e).getByText('Cabinet : Cabinet Exemple')).toBeInTheDocument()
    // Le sous-titre d'avant : le texte seul, sans élément ajouté.
    expect(sousTitre('Marie Exemple').children).toHaveLength(0)
    expect(lignesSousTitre('Marie Exemple')).toEqual(['Cabinet : Cabinet Exemple'])
    expect(within(e).queryByText(/bureau/i)).toBeNull()
    expect(screen.queryByRole('button', { name: BG.changer })).toBeNull()
    expect(lecturesBureaux()).toEqual([])
  })

  it('cabinets non transmis (appel d’avant) : la page reste celle d’avant', async () => {
    await rendreFiche(fiche(G1, 'Marie Exemple'))
    expect(within(entete('Marie Exemple')).getByText('Cabinet : Cabinet Exemple')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: BG.changer })).toBeNull()
  })

  it('e-11 : sous le nom, deux lignes « Cabinet : … » puis « Bureau : … » (forme de la carte d’une copropriété), plus « Cabinet : … · Nord »', async () => {
    await rendreFiche(marie, [cabinetAvec])
    expect(lignesSousTitre('Marie Exemple')).toEqual(['Cabinet : Cabinet Exemple', remplir(BG.ligne, { bureau: 'Nord' })])
    expect(BG.ligne).toBe(B.copropriete.ligne)
    // Deux lignes : chaque partie est un bloc (le sous-titre reste un seul paragraphe de la carte).
    for (const ligne of sousTitre('Marie Exemple').children) expect(ligne).toHaveClass('block')
    expect(within(entete('Marie Exemple')).queryByText(/Cabinet Exemple · Nord/)).toBeNull()
  })

  it('« Changer de bureau » : bureaux ouverts sauf l’actuel, jamais « aucun » ; PATCH { bureauId } seul ; fiche relue avant l’annonce', async () => {
    bureaux = [est, nord, sud]
    await rendreFiche(marie, [{ ...cabinetAvec, nbBureaux: 3, nbBureauxOuverts: 2 }])
    expect(lignesSousTitre('Marie Exemple')).toEqual(['Cabinet : Cabinet Exemple', 'Bureau : Nord'])
    // Bureaux lus seulement à l'ouverture du panneau.
    expect(lecturesBureaux()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: BG.changer }))
    const liste = await screen.findByLabelText(BG.nouveauBureau)
    expect(options(liste)).toEqual([B.choisir, 'Est'])
    expect(screen.getByText(BG.changerAide)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: G.enregistrer })).toBeDisabled()

    fireEvent.change(liste, { target: { value: B3 } })
    fireEvent.click(screen.getByRole('button', { name: G.enregistrer }))
    expect(await screen.findByText(remplir(BG.change, { bureau: 'Est' }))).toBeInTheDocument()
    expect(appels.filter((a) => a.methode === 'PATCH')).toEqual([{ url: `/api/vitfixsignal/gestionnaires/${G1}`, methode: 'PATCH', corps: { bureauId: B3 } }])
    expect(rappelsFiche.onModifie).toHaveBeenCalled()
    expect(lignesSousTitre('Marie Exemple')).toEqual(['Cabinet : Cabinet Exemple', 'Bureau : Est'])
    expect(screen.queryByLabelText(BG.nouveauBureau)).toBeNull()
  })

  it('fiche à compléter (sans bureau, cabinet avec un bureau ouvert) : « Changer de bureau » propose les bureaux ouverts', async () => {
    await rendreFiche(paul, [cabinetAvec])
    expect(lignesSousTitre('Paul Exemple')).toEqual(['Cabinet : Cabinet Exemple'])
    expect(sousTitre('Paul Exemple').children).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: BG.changer }))
    expect(options(await screen.findByLabelText(BG.nouveauBureau))).toEqual([B.choisir, 'Nord'])
  })

  it('aucun autre bureau ouvert (fiche qui a un bureau) : « Aucun autre bureau ouvert… », sans liste ni enregistrement possible', async () => {
    await rendreFiche(marie, [cabinetAvec])
    fireEvent.click(screen.getByRole('button', { name: BG.changer }))
    expect(await screen.findByText(BG.aucunAutre)).toBeInTheDocument()
    expect(screen.queryByText(BG.aucunOuvert)).toBeNull()
    expect(screen.queryByLabelText(BG.nouveauBureau)).toBeNull()
    expect(screen.getByRole('button', { name: G.enregistrer })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: G.annuler }))
    expect(screen.queryByText(BG.aucunAutre)).toBeNull()
  })

  it('e-12 : fiche sans bureau, aucun bureau ouvert dans le cabinet : « Aucun bureau ouvert… » (sans « autre »), sans liste ni enregistrement possible', async () => {
    expect(BG.aucunOuvert).toBe('Aucun bureau ouvert dans ce cabinet : ouvrez-en un depuis la vue Cabinets.')
    expect(BG.aucunAutre).toBe('Aucun autre bureau ouvert dans ce cabinet : ouvrez-en un depuis la vue Cabinets.')
    bureaux = [sud]
    await rendreFiche(paul, [{ ...cabinetAvec, nbBureaux: 1, nbBureauxOuverts: 0 }])
    fireEvent.click(screen.getByRole('button', { name: BG.changer }))
    expect(await screen.findByText(BG.aucunOuvert)).toBeInTheDocument()
    expect(screen.queryByText(BG.aucunAutre)).toBeNull()
    expect(screen.queryByLabelText(BG.nouveauBureau)).toBeNull()
    expect(screen.getByRole('button', { name: G.enregistrer })).toBeDisabled()
  })

  it('e-12 : fiche restée dans un bureau fermé, aucun autre ouvert : « Aucun autre bureau ouvert… » (elle a un bureau)', async () => {
    bureaux = [sud]
    await rendreFiche(lea, [{ ...cabinetAvec, nbBureaux: 1, nbBureauxOuverts: 0 }])
    fireEvent.click(screen.getByRole('button', { name: BG.changer }))
    expect(await screen.findByText(BG.aucunAutre)).toBeInTheDocument()
    expect(screen.queryByText(BG.aucunOuvert)).toBeNull()
  })

  it('409 bureau_ferme au changement (fermé entre-temps) : expliqué ; bureaux relus', async () => {
    bureaux = [est, nord, sud]
    await rendreFiche(marie, [{ ...cabinetAvec, nbBureaux: 3, nbBureauxOuverts: 2 }])
    fireEvent.click(screen.getByRole('button', { name: BG.changer }))
    fireEvent.change(await screen.findByLabelText(BG.nouveauBureau), { target: { value: B3 } })
    refus = { code: 'bureau_ferme', status: 409 }
    bureaux = [{ ...est, ferme: true }, nord, sud]
    fireEvent.click(screen.getByRole('button', { name: G.enregistrer }))
    expect(await screen.findByText(T.erreurs.bureau_ferme)).toBeInTheDocument()
    expect(await screen.findByText(BG.aucunAutre)).toBeInTheDocument()
    expect(lecturesBureaux()).toHaveLength(2)
  })

  it('bureau fermé de la fiche signalé ; réactivation refusée (409 bureau_ferme) : la marche à suivre, rien de réactivé', async () => {
    await rendreFiche(lea, [cabinetAvec])
    expect(lignesSousTitre('Léa Exemple')).toEqual(['Cabinet : Cabinet Exemple', 'Bureau : Sud (fermé)'])
    refus = { code: 'bureau_ferme', status: 409 }
    fireEvent.click(screen.getByRole('button', { name: G.gestionnaires.reactiver }))
    expect(await screen.findByText(BG.reactivationBureauFerme)).toBeInTheDocument()
    expect(rappelsFiche.onModifie).not.toHaveBeenCalled()
    // Fiche désactivée : « Changer de bureau » reste proposé (la route le permet), pour la rattacher à un bureau ouvert.
    expect(screen.getByRole('button', { name: BG.changer })).toBeInTheDocument()
  })
})

// ── Import : création des fiches des gestionnaires inconnus ─────────────────

const CSV = [
  'Nom de la copropriété;Code postal;Ville;Gestionnaire(s)',
  'Villa Exemple;13002;Exempleville;nina.exemple@exemple.test',
].join('\r\n')
const INCONNUE = { email: 'nina.exemple@exemple.test', nomPropose: 'Nina Exemple', dansDomaines: true, lignes: [2] }
const verificationAvecInconnue = (n: number): VerificationImportQr => ({
  diagnostics: [{ numeroLigne: 2, nom: 'Villa Exemple', etat: 'a_creer', action: 'creer', messages: [], doublon: null, gestionnaires: [], emailsDestinataires: [], emailsHorsDomaine: [] }],
  gestionnairesInconnus: n === 1 ? [INCONNUE] : [],
  horsDomaine: false,
})

async function jusquAuxInconnus(cabinets: CabinetQr[]) {
  verificationServie = verificationAvecInconnue
  render(<AssistantImportQr cabinets={cabinets} origine="https://vitfix.io" onFermer={vi.fn()} onImporte={vi.fn()} />)
  fireEvent.change(screen.getByLabelText(I.fichier), { target: { files: [new File([CSV], 'coproprietes.csv', { type: 'text/csv' })] } })
  await screen.findByText(I.correspondance)
  fireEvent.click(screen.getByRole('button', { name: I.verifier }))
  return (await screen.findByText(remplir(I.inconnus, { n: 1 }))).closest('section') as HTMLElement
}

describe('import : fiches des gestionnaires inconnus', () => {
  it('cabinet sans bureau : aucune liste « Bureau », aucune requête des bureaux ; le corps envoyé reste celui d’avant', async () => {
    const carte = await jusquAuxInconnus([cabinetSans])
    expect(within(carte).queryByLabelText(B.import.champ)).toBeNull()
    expect(within(carte).queryByText(/bureau/i)).toBeNull()
    fireEvent.click(within(carte).getByRole('button', { name: I.creerFiches }))
    await screen.findByText(remplir(I.fichesCreees, { n: 1 }))
    expect(posts().map((a) => a.corps)).toEqual([{ nom: 'Nina Exemple', email: INCONNUE.email, cabinetId: K1, coproprieteIds: [], forcerDomaine: false }])
    expect(lecturesBureaux()).toEqual([])
  })

  it('cabinet avec un bureau ouvert : « Bureau des fiches à créer » obligatoire (aide) ; sans choix : refus sans envoi ; choisi : envoyé avec la fiche', async () => {
    const carte = await jusquAuxInconnus([cabinetAvec])
    const liste = await within(carte).findByLabelText(B.import.champ)
    expect(liste).toBeRequired()
    expect(within(carte).getByText(B.import.aide)).toBeInTheDocument()
    expect(options(liste)).toEqual([B.choisir, 'Nord'])
    fireEvent.click(within(carte).getByRole('button', { name: I.creerFiches }))
    expect(await screen.findByText(B.import.requis)).toBeInTheDocument()
    expect(posts()).toEqual([])

    fireEvent.change(liste, { target: { value: B1 } })
    fireEvent.click(within(carte).getByRole('button', { name: I.creerFiches }))
    await screen.findByText(remplir(I.fichesCreees, { n: 1 }))
    expect(posts().map((a) => a.corps)).toEqual([{ nom: 'Nina Exemple', email: INCONNUE.email, cabinetId: K1, coproprieteIds: [], forcerDomaine: false, bureauId: B1 }])
  })

  it('409 bureau_ferme (fermé entre-temps) : échec de la fiche expliqué ; bureaux relus', async () => {
    const carte = await jusquAuxInconnus([cabinetAvec])
    fireEvent.change(await within(carte).findByLabelText(B.import.champ), { target: { value: B1 } })
    refus = { code: 'bureau_ferme', status: 409 }
    verificationServie = () => verificationAvecInconnue(1)
    fireEvent.click(within(carte).getByRole('button', { name: I.creerFiches }))
    expect(await screen.findByText(remplir(I.fichesEchec, { email: INCONNUE.email, raison: T.erreurs.bureau_ferme }), { exact: false })).toBeInTheDocument()
    await waitFor(() => expect(lecturesBureaux()).toHaveLength(2))
  })
})

// ── Dans l'espace ────────────────────────────────────────────────────────────

const utilisateur = (app_metadata: Record<string, unknown>) =>
  ({ data: { user: { id: 'u1', email: 'admin@exemple.test', app_metadata, user_metadata: {} } }, error: null })
const PREMIER_RENDU = { timeout: 5000 }

describe('dans l’espace', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('super admin : la page profil reçoit les cabinets de l’espace (lignes « Cabinet : … » et « Bureau : … », « Changer de bureau »)', async () => {
    ficheServie = detail(marie)
    simul.signOut.mockResolvedValue({ error: null })
    simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
    window.history.replaceState(null, '', `/fr/vitfixsignal/#gestionnaire/${G1}`)
    render(<EspaceVitfixSignal />)
    expect(await screen.findByRole('heading', { name: 'Marie Exemple', level: 2 }, PREMIER_RENDU)).toBeInTheDocument()
    expect(lignesSousTitre('Marie Exemple')).toEqual(['Cabinet : Cabinet Exemple', 'Bureau : Nord'])
    expect(await screen.findByRole('button', { name: BG.changer })).toBeInTheDocument()
  })

  it('espace d’un gestionnaire : inchangé — /moi et /tableau seulement, aucune route des bureaux ni du super admin, aucun libellé de bureau', async () => {
    simul.signOut.mockResolvedValue({ error: null })
    simul.getUser.mockResolvedValue(utilisateur({ role: 'gestionnaire_signalement', vitfixsignal_cabinet: 'cabinet-exemple' }))
    window.history.replaceState(null, '', '/cabinet-exemple/suivi/')
    render(<EspaceVitfixSignal cabinet={{ identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple' }} />)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tableau de bord'), PREMIER_RENDU)
    const menu = screen.getAllByRole('navigation', { name: 'Menu Vitfix Signal' })[0]
    for (const vue of ['Copropriétés', 'Signalements']) {
      fireEvent.click(within(menu).getByRole('link', { name: vue }))
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(vue))
      await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
      expect(screen.queryByText(/bureau/i)).toBeNull()
    }
    expect(within(menu).getAllByRole('link').map((e) => e.textContent)).toEqual(['Tableau de bord', 'Copropriétés', 'Signalements'])
    expect(appels.map((a) => a.url)).toEqual(['/api/vitfixsignal/moi', '/api/vitfixsignal/tableau'])
  })
})
