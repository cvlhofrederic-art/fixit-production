// tests/components/aj-signalement/gestionnaires.test.tsx
//
// Vues « Gestionnaires » de l'espace AJ Signalement (super admin ; demandes de Hugo du 10/11/2026 : « chaque gestionnaire
// doit avoir sa page de suivi des signalements par copropriété ») :
// - liste : état de chaque fiche, adresse contestée en tête, domaine forcé, compteurs ; « Ajouter un gestionnaire »
//   (adresse hors des domaines du cabinet : avertissement puis « Créer quand même » ; cabinet sans domaine : renvoi vers
//   ses domaines ; adresse déjà en fiche : « Ouvrir la fiche ») ; renvoi de la confirmation ; réactivation ;
// - page profil : en-tête, envois, « Sa page de suivi » (GET tableau?gestionnaire=, puis les signalements d'une
//   copropriété, paginés), attributions (retrait), « communes à tous », activité, export RGPD, départ (une succession
//   par copropriété exigée), effacement réservé à une fiche désactivée.

import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIBELLE_ETAT_GESTIONNAIRE_QR as ETAT, TEXTES_GESTION_QR as G } from '@/lib/aj-signalement/affichage-gestion'
import { TEXTES_TABLEAU_QR as T } from '@/lib/aj-signalement/affichage'
import { remplir } from '@/lib/coproprietaire/textes'
import {
  gestionCoproprieteQrVide, type CabinetQr, type CoproprieteQr, type FicheGestionnaireDetailQr, type GestionnaireQr, type SignalementQr,
} from '@/lib/aj-signalement/types'

const simul = vi.hoisted(() => ({ telecharger: vi.fn(), toastErreur: vi.fn(), toastSucces: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: simul.toastErreur, success: simul.toastSucces } }))
vi.mock('@/lib/aj-signalement/qr', async (original) => ({ ...(await original<typeof import('@/lib/aj-signalement/qr')>()), telechargerFichier: simul.telecharger }))

const { default: ListeGestionnairesQr } = await import('@/components/aj-signalement/ListeGestionnairesQr')
const { default: FicheGestionnaireQr } = await import('@/components/aj-signalement/FicheGestionnaireQr')

const K1 = 'a0000000-0000-4000-8000-0000000000a1'
const G1 = '11111111-1111-4111-8111-111111111111'
const G2 = '22222222-2222-4222-8222-222222222222'
const G3 = '33333333-3333-4333-8333-333333333333'
const C1 = 'c0000000-0000-4000-8000-000000000001'
const C2 = 'c0000000-0000-4000-8000-000000000002'
const C3 = 'c0000000-0000-4000-8000-000000000003'

const cabinet: CabinetQr = { id: K1, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr', domaines: ['exemple.test'], identifiantFige: true, nbCoproprietes: 3, nbGestionnaires: 3 }
const resume = { id: K1, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }

const fiche = (id: string, nom: string, etat: GestionnaireQr['etat'], extra: Partial<GestionnaireQr> = {}): GestionnaireQr => ({
  id, nom, cabinet: resume, email: `${nom.toLowerCase().replace(/\s+/g, '.')}@exemple.test`, etat, domaineForce: false,
  coproprietes: 1, ouverts: 2, urgents: 1, creeLe: '2026-11-01T09:00:00.000Z', confirmeeLe: null, ...extra,
})
const marie = fiche(G1, 'Marie Exemple', 'adresse_confirmee', { confirmeeLe: '2026-11-02T09:00:00.000Z', coproprietes: 2 })
const paul = fiche(G2, 'Paul Exemple', 'adresse_contestee', { domaineForce: true })
const lea = fiche(G3, 'Léa Exemple', 'confirmation_expiree')

const copro = (id: string, nom: string, gestion: Partial<CoproprieteQr> = {}): CoproprieteQr => ({
  id, nom, adresse: '', jeton: '0'.repeat(32), emailsDestinataires: [], actif: true, creeLe: '2026-11-01T00:00:00Z', nbSignalements: 0,
  nbEnAttente: 0, derniereAdresseProposee: null, ...gestionCoproprieteQrVide(), cabinet: resume, ...gestion,
})
const coproprietes = [
  copro(C1, 'Résidence Une', { gestionnaires: [{ id: G1, nom: 'Marie Exemple' }], ville: 'Exempleville' }),
  copro(C2, 'Résidence Deux', { gestionnaires: [{ id: G1, nom: 'Marie Exemple' }, { id: G3, nom: 'Léa Exemple' }] }),
  copro(C3, 'Parc Belle Ombre', { attribueeATous: true }),
]

type Appel = { url: string; methode: string; corps: unknown }
let appels: Appel[] = []
const json = (corps: unknown, status = 200, entetes: Record<string, string> = {}) =>
  new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json', ...entetes } })

function simulerFetch(routeur: (appel: Appel) => Response) {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const appel = { url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) : null }
    appels.push(appel)
    return routeur(appel)
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  simulerFetch(() => json({}))
})
afterEach(() => vi.unstubAllGlobals())

// ── Liste ────────────────────────────────────────────────────────────────────

const rappelsListe = { onOuvrir: vi.fn(), onModifie: vi.fn(), onReessayer: vi.fn(), onCabinets: vi.fn() }
const rendreListe = (gestionnaires: GestionnaireQr[] | null = [paul, marie, lea], cabinets: CabinetQr[] = [cabinet]) =>
  render(<ListeGestionnairesQr gestionnaires={gestionnaires} cabinets={cabinets} erreur={null} coproprietes={coproprietes} {...rappelsListe} />)
const ligne = (nom: string) => screen.getByText(nom, { selector: 'h2, h3, strong, span, p' }).closest('li') as HTMLElement

describe('liste des gestionnaires', () => {
  it('ordre du serveur (contestée en tête), état, domaine forcé, compteurs, adresse', () => {
    rendreListe()
    const lignes = within(screen.getByRole('list', { name: G.gestionnaires.liste })).getAllByRole('listitem')
    expect(lignes.map((l) => within(l).getByRole('heading').textContent)).toEqual(['Paul Exemple', 'Marie Exemple', 'Léa Exemple'])
    expect(within(lignes[0]).getByText(ETAT.adresse_contestee)).toBeInTheDocument()
    expect(within(lignes[0]).getByText(G.gestionnaires.domaineForce)).toBeInTheDocument()
    expect(within(lignes[1]).getByText('marie.exemple@exemple.test')).toBeInTheDocument()
    expect(within(lignes[1]).getByText(remplir(G.gestionnaires.compteurs, { copros: 2, ouverts: 2, urgents: 1 }))).toBeInTheDocument()
    expect(within(lignes[1]).queryByText(G.gestionnaires.domaineForce)).toBeNull()
  })

  it('Ouvrir : la page profil ; « Renvoyer la confirmation » seulement pour une confirmation en attente ou expirée', async () => {
    simulerFetch(() => json({ emailEnvoye: true }))
    rendreListe()
    fireEvent.click(within(ligne('Marie Exemple')).getByRole('button', { name: G.gestionnaires.ouvrir }))
    expect(rappelsListe.onOuvrir).toHaveBeenCalledWith(G1)
    expect(within(ligne('Marie Exemple')).queryByRole('button', { name: G.gestionnaires.renvoyer })).toBeNull()
    expect(within(ligne('Paul Exemple')).queryByRole('button', { name: G.gestionnaires.renvoyer })).toBeNull()
    fireEvent.click(within(ligne('Léa Exemple')).getByRole('button', { name: G.gestionnaires.renvoyer }))
    await waitFor(() => expect(appels).toEqual([{ url: `/api/aj-signalement/gestionnaires/${G3}/confirmation`, methode: 'POST', corps: null }]))
    expect(await screen.findByText(remplir(G.gestionnaires.renvoye, { email: 'léa.exemple@exemple.test' }))).toBeInTheDocument()
    expect(rappelsListe.onModifie).toHaveBeenCalled()
  })

  it('fiche désactivée : « Réactiver » (PATCH { actif: true })', async () => {
    simulerFetch(() => json({ gestionnaire: { ...lea, etat: 'confirmation_expiree' } }))
    rendreListe([fiche(G3, 'Léa Exemple', 'desactive')])
    fireEvent.click(within(ligne('Léa Exemple')).getByRole('button', { name: G.gestionnaires.reactiver }))
    await waitFor(() => expect(appels).toEqual([{ url: `/api/aj-signalement/gestionnaires/${G3}`, methode: 'PATCH', corps: { actif: true } }]))
    await waitFor(() => expect(rappelsListe.onModifie).toHaveBeenCalled())
  })
})

describe('ajout d’un gestionnaire', () => {
  const ouvrir = () => {
    fireEvent.click(screen.getByRole('button', { name: G.gestionnaires.ajouter }))
    return screen.getByRole('dialog')
  }
  const remplirFenetre = (fenetre: HTMLElement, email: string) => {
    fireEvent.change(within(fenetre).getByLabelText(G.gestionnaires.nom), { target: { value: 'Jean Exemple' } })
    fireEvent.change(within(fenetre).getByLabelText(G.gestionnaires.email), { target: { value: email } })
  }

  it('cabinet unique choisi d’office, copropriétés de ce cabinet à attribuer, POST strict, message d’envoi', async () => {
    simulerFetch(() => json({ gestionnaire: fiche('44444444-4444-4444-8444-444444444444', 'Jean Exemple', 'confirmation_envoyee'), emailEnvoye: true, coproprietesAvecAdresseSaisie: 0 }, 201))
    rendreListe()
    const fenetre = ouvrir()
    expect(within(fenetre).getByText(G.gestionnaires.aide)).toBeInTheDocument()
    remplirFenetre(fenetre, 'Jean.Exemple@exemple.test')
    fireEvent.click(within(fenetre).getByRole('checkbox', { name: /Résidence Une/ }))
    fireEvent.click(within(fenetre).getByRole('button', { name: G.gestionnaires.creer }))
    await waitFor(() => expect(rappelsListe.onModifie).toHaveBeenCalled())
    expect(appels).toEqual([{
      url: '/api/aj-signalement/gestionnaires', methode: 'POST',
      corps: { nom: 'Jean Exemple', email: 'jean.exemple@exemple.test', cabinetId: K1, coproprieteIds: [C1], forcerDomaine: false },
    }])
    expect(screen.getByText(remplir(G.gestionnaires.cree, { email: 'jean.exemple@exemple.test' }))).toBeInTheDocument()
  })

  it('adresse hors des domaines du cabinet : avertissement d’abord (aucun appel), puis « Créer quand même » (forcerDomaine)', async () => {
    simulerFetch(() => json({ gestionnaire: fiche('44444444-4444-4444-8444-444444444444', 'Jean Exemple', 'confirmation_envoyee'), emailEnvoye: true, coproprietesAvecAdresseSaisie: 0 }, 201))
    rendreListe()
    const fenetre = ouvrir()
    remplirFenetre(fenetre, 'jean@autre-exemple.test')
    fireEvent.click(within(fenetre).getByRole('button', { name: G.gestionnaires.creer }))
    expect(within(fenetre).getByText(remplir(G.gestionnaires.horsDomaine, { domaines: 'exemple.test' }))).toBeInTheDocument()
    expect(appels).toEqual([])
    fireEvent.click(within(fenetre).getByRole('button', { name: G.gestionnaires.creerQuandMeme }))
    await waitFor(() => expect(appels).toHaveLength(1))
    expect(appels[0].corps).toMatchObject({ email: 'jean@autre-exemple.test', forcerDomaine: true })
  })

  it('« Corriger » referme l’avertissement sans rien envoyer', () => {
    rendreListe()
    const fenetre = ouvrir()
    remplirFenetre(fenetre, 'jean@autre-exemple.test')
    fireEvent.click(within(fenetre).getByRole('button', { name: G.gestionnaires.creer }))
    fireEvent.click(within(fenetre).getByRole('button', { name: G.gestionnaires.corriger }))
    expect(within(fenetre).queryByText(remplir(G.gestionnaires.horsDomaine, { domaines: 'exemple.test' }))).toBeNull()
    expect(appels).toEqual([])
  })

  it('cabinet sans domaine : renvoi vers ses domaines, aucun appel', () => {
    rendreListe([marie], [{ ...cabinet, domaines: [] }])
    const fenetre = ouvrir()
    expect(within(fenetre).getByText(G.gestionnaires.domainesARenseigner)).toBeInTheDocument()
    fireEvent.click(within(fenetre).getByRole('button', { name: G.gestionnaires.versCabinets }))
    expect(rappelsListe.onCabinets).toHaveBeenCalled()
    expect(appels).toEqual([])
  })

  it('adresse déjà en fiche : « Ouvrir la fiche » existante', async () => {
    simulerFetch(() => json({ error: 'existe_deja', id: G1 }, 409))
    rendreListe()
    const fenetre = ouvrir()
    remplirFenetre(fenetre, 'marie.exemple@exemple.test')
    fireEvent.click(within(fenetre).getByRole('button', { name: G.gestionnaires.creer }))
    fireEvent.click(await within(fenetre).findByRole('button', { name: G.gestionnaires.ouvrirFiche }))
    expect(rappelsListe.onOuvrir).toHaveBeenCalledWith(G1)
  })

  it('e-mail non parti : la fiche est créée, l’écran le dit ; adresse déjà saisie sur des copropriétés : rappel', async () => {
    simulerFetch(() => json({ gestionnaire: fiche('44444444-4444-4444-8444-444444444444', 'Jean Exemple', 'confirmation_expiree'), emailEnvoye: false, coproprietesAvecAdresseSaisie: 2 }, 201))
    rendreListe()
    const fenetre = ouvrir()
    remplirFenetre(fenetre, 'jean.exemple@exemple.test')
    fireEvent.click(within(fenetre).getByRole('button', { name: G.gestionnaires.creer }))
    expect(await screen.findByText(G.gestionnaires.creeSansEmail)).toBeInTheDocument()
    expect(screen.getByText(remplir(G.gestionnaires.dejaDestinataire, { n: 2 }))).toBeInTheDocument()
  })
})

// ── Page profil ──────────────────────────────────────────────────────────────

const detail = (gestionnaire: GestionnaireQr = marie): FicheGestionnaireDetailQr => ({
  gestionnaire,
  envois: [{ objet: 'confirmation_adresse', creeLe: '2026-11-01T09:00:00.000Z', envoyeLe: '2026-11-01T09:00:05.000Z', accepteLe: '2026-11-02T09:00:00.000Z', refus: null }],
  attributions: [
    { coproprieteId: C1, nom: 'Résidence Une', origine: 'super_admin', creeLe: '2026-11-01T09:00:00.000Z' },
    { coproprieteId: C2, nom: 'Résidence Deux', origine: 'import', creeLe: '2026-11-01T09:00:00.000Z' },
  ],
  creations: [],
  journal: [{
    id: '7', creeLe: '2026-11-02T09:00:00.000Z', cabinetId: K1, action: 'gestionnaire.adresse_confirmee', acteur: { profil: 'gestionnaire', nom: 'Marie Exemple' },
    coproprieteId: null, coproprieteNom: null, gestionnaireId: G1, gestionnaireNom: 'Marie Exemple', signalementId: null, operationId: null, champs: [], details: {},
  }],
})

const signalement = (id: string, type: string): SignalementQr => ({
  id, coproprieteId: C1, coproprieteNom: 'Résidence Une', prenom: 'Jeanne', nom: 'Exemple', telephone: '06 00 00 00 00', email: 'jeanne@exemple.test',
  batiment: 'A', etage: '1', numLot: '3', estPartieCommune: false, zoneSignalee: '', typeIntervention: type, description: 'Fuite constatée hier soir',
  priorite: 'urgente', statut: 'en_attente', langue: 'fr', emailEnvoyeLe: null, emailErreur: null, confirmationEnvoyeeLe: null, confirmationErreur: null,
  qualiteDeclarant: 'locataire', adresseProposee: '', signalementLieId: null, creeLe: '2026-11-03T08:00:00.000Z', misAJourLe: '2026-11-03T08:00:00.000Z',
})

function routeurFiche(options: { fiche?: FicheGestionnaireDetailQr } = {}) {
  const f = options.fiche ?? detail()
  return (a: Appel): Response => {
    if (a.url === `/api/aj-signalement/gestionnaires/${f.gestionnaire.id}` && a.methode === 'GET') return json(f)
    if (a.url.startsWith('/api/aj-signalement/tableau?gestionnaire=')) {
      return json({ tableau: {
        coproprietes: [
          copro(C1, 'Résidence Une', { ouverts: 2, urgentsOuverts: 1, attente48h: 1, dernier: '2026-11-03T08:00:00.000Z' }),
          copro(C3, 'Parc Belle Ombre', { attribueeATous: true }),
        ],
        signalements: [],
        gestionnaire: { id: f.gestionnaire.id, nom: f.gestionnaire.nom, actif: true, cabinet: resume },
      } })
    }
    if (a.url.startsWith(`/api/aj-signalement/coproprietes/${C1}/signalements`)) {
      return a.url.includes('avant=')
        ? json({ signalements: [signalement('5f2c9a1e-2222-4222-8333-444444444444', 'Électricité')], suite: null })
        : json({ signalements: [signalement('5f2c9a1e-1111-4222-8333-444444444444', 'Plomberie')], suite: { avant: '2026-11-03T08:00:00.123456+00:00', avantId: '5f2c9a1e-1111-4222-8333-444444444444' } })
    }
    if (a.url.endsWith('/coproprietes') && a.methode === 'PUT') return json({ coproprietes: [C2], adressesRetirees: 0 })
    if (a.url.endsWith('/export')) return json({ exporteLe: '2026-11-11T00:00:00Z' }, 200, { 'content-disposition': `attachment; filename="gestionnaire-${G1}.json"` })
    if (a.url.endsWith('/depart')) return json({ deplacees: 1, laisseesSansGestionnaire: 0, adressesRetirees: 0 })
    if (a.methode === 'PATCH') return json({ gestionnaire: f.gestionnaire })
    return json({ error: 'introuvable' }, 404)
  }
}

const rappelsFiche = { onRetour: vi.fn(), onModifie: vi.fn() }
async function rendreFiche(f: FicheGestionnaireDetailQr = detail()) {
  simulerFetch(routeurFiche({ fiche: f }))
  render(<FicheGestionnaireQr id={f.gestionnaire.id} coproprietes={coproprietes} gestionnaires={[marie, paul, lea]} {...rappelsFiche} />)
  await screen.findByRole('heading', { name: f.gestionnaire.nom ?? G.fiche.ancien })
}

describe('page profil d’un gestionnaire', () => {
  it('en-tête, envois, attributions (origine), communes à tous, activité', async () => {
    await rendreFiche()
    expect(screen.getByText('marie.exemple@exemple.test')).toBeInTheDocument()
    expect(screen.getAllByText(ETAT.adresse_confirmee).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: G.fiche.envois })).toBeInTheDocument()
    const attribuees = screen.getByRole('heading', { name: remplir(G.fiche.attribuees, { n: 2 }) }).closest('section') as HTMLElement
    expect(within(attribuees).getByText('Résidence Une')).toBeInTheDocument()
    expect(within(attribuees).getByText('importée', { exact: false })).toBeInTheDocument()
    const communes = screen.getByRole('heading', { name: remplir(G.fiche.communes, { n: 1 }) }).closest('section') as HTMLElement
    expect(within(communes).getByText('Parc Belle Ombre')).toBeInTheDocument()
    const activite = screen.getByRole('heading', { name: G.fiche.activite }).closest('section') as HTMLElement
    expect(within(activite).getByText('Adresse confirmée', { exact: false })).toBeInTheDocument()
    expect(appels[0].url).toBe(`/api/aj-signalement/gestionnaires/${G1}`)
  })

  it('« Sa page de suivi » : ses copropriétés et leurs compteurs (tableau?gestionnaire=), puis les signalements, paginés', async () => {
    await rendreFiche()
    const suivi = screen.getByRole('heading', { name: G.fiche.suivi }).closest('section') as HTMLElement
    await waitFor(() => expect(within(suivi).getByText('Résidence Une')).toBeInTheDocument())
    expect(appels.some((a) => a.url === `/api/aj-signalement/tableau?gestionnaire=${G1}`)).toBe(true)
    expect(within(suivi).getByText(remplir(G.suivi.compteurs, { ouverts: 2, urgents: 1, attente: 1 }))).toBeInTheDocument()
    const une = within(suivi).getByText('Résidence Une').closest('li') as HTMLElement
    fireEvent.click(within(une).getByRole('button', { name: G.suivi.voir }))
    expect(await within(une).findByText('Plomberie', { exact: false })).toBeInTheDocument()
    expect(appels.at(-1)?.url).toBe(`/api/aj-signalement/coproprietes/${C1}/signalements?statut=ouverts`)
    fireEvent.click(within(une).getByRole('button', { name: G.suivi.voirPlus }))
    expect(await within(une).findByText('Électricité', { exact: false })).toBeInTheDocument()
    expect(appels.at(-1)?.url).toContain('avant=2026-11-03T08%3A00%3A00.123456%2B00%3A00')
    expect(within(une).getByText('Plomberie', { exact: false })).toBeInTheDocument()
    expect(within(une).queryByRole('button', { name: G.suivi.voirPlus })).toBeNull()
  })

  it('retirer une attribution : PUT des copropriétés restantes, puis rechargement', async () => {
    await rendreFiche()
    const attribuees = screen.getByRole('heading', { name: remplir(G.fiche.attribuees, { n: 2 }) }).closest('section') as HTMLElement
    const une = within(attribuees).getByText('Résidence Une').closest('li') as HTMLElement
    fireEvent.click(within(une).getByRole('button', { name: G.fiche.retirer }))
    await waitFor(() => expect(appels.some((a) => a.methode === 'PUT')).toBe(true))
    expect(appels.find((a) => a.methode === 'PUT')).toEqual({ url: `/api/aj-signalement/gestionnaires/${G1}/coproprietes`, methode: 'PUT', corps: { coproprieteIds: [C2] } })
    await waitFor(() => expect(rappelsFiche.onModifie).toHaveBeenCalled())
  })

  it('export RGPD : le fichier du serveur est téléchargé sous son nom', async () => {
    await rendreFiche()
    fireEvent.click(screen.getByRole('button', { name: G.fiche.exporter }))
    await waitFor(() => expect(simul.telecharger).toHaveBeenCalledTimes(1))
    expect(simul.telecharger.mock.calls[0][0]).toBe(`gestionnaire-${G1}.json`)
    expect(simul.telecharger.mock.calls[0][1]).toBeInstanceOf(Blob)
  })

  it('effacement : seulement pour une fiche désactivée', async () => {
    await rendreFiche()
    expect(screen.queryByRole('button', { name: G.fiche.effacer })).toBeNull()
  })

  it('« Retour à la liste »', async () => {
    await rendreFiche()
    fireEvent.click(screen.getByRole('button', { name: G.fiche.retour }))
    expect(rappelsFiche.onRetour).toHaveBeenCalled()
  })
})

describe('départ d’un gestionnaire', () => {
  it('deux groupes ; une succession exigée par copropriété dont il est le seul gestionnaire ; puis l’appel', async () => {
    await rendreFiche()
    fireEvent.click(screen.getByRole('button', { name: G.fiche.depart }))
    const fenetre = screen.getByRole('dialog')
    expect(within(fenetre).getByRole('heading', { name: remplir(G.depart.titre, { nom: 'Marie Exemple' }) })).toBeInTheDocument()
    expect(within(fenetre).getByText(remplir(G.depart.seul, { n: 1 }))).toBeInTheDocument()
    expect(within(fenetre).getByText(remplir(G.depart.partages, { n: 1 }))).toBeInTheDocument()
    expect(within(fenetre).getByText(G.depart.avertissement)).toBeInTheDocument()

    fireEvent.click(within(fenetre).getByRole('button', { name: G.depart.confirmer }))
    expect(within(fenetre).getByText(remplir(G.depart.manquantes, { noms: 'Résidence Une' }))).toBeInTheDocument()
    expect(appels.some((a) => a.url.endsWith('/depart'))).toBe(false)

    const choix = within(fenetre).getByLabelText(remplir(G.depart.successeur, { nom: 'Résidence Une' })) as HTMLSelectElement
    // Successeurs : fiches actives du même cabinet, sauf lui-même et une adresse contestée (elle ne reçoit rien).
    expect([...choix.options].map((o) => o.textContent)).toEqual([G.depart.choisir, G.depart.sansGestionnaire, 'Léa Exemple'])
    fireEvent.change(choix, { target: { value: G3 } })
    fireEvent.click(within(fenetre).getByRole('button', { name: G.depart.confirmer }))
    await waitFor(() => expect(appels.some((a) => a.url.endsWith('/depart'))).toBe(true))
    expect(appels.find((a) => a.url.endsWith('/depart'))?.corps).toEqual({
      successions: [{ coproprieteId: C1, versGestionnaireId: G3 }, { coproprieteId: C2, versGestionnaireId: null }],
    })
    await waitFor(() => expect(rappelsFiche.onModifie).toHaveBeenCalled())
    expect(await screen.findByText(remplir(G.depart.fait, { deplacees: 1, sans: 0 }))).toBeInTheDocument()
  })

  it('« Laisser sans gestionnaire » : succession null', async () => {
    await rendreFiche()
    fireEvent.click(screen.getByRole('button', { name: G.fiche.depart }))
    const fenetre = screen.getByRole('dialog')
    fireEvent.change(within(fenetre).getByLabelText(remplir(G.depart.successeur, { nom: 'Résidence Une' })), { target: { value: 'sans' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: G.depart.confirmer }))
    await waitFor(() => expect(appels.some((a) => a.url.endsWith('/depart'))).toBe(true))
    expect(appels.find((a) => a.url.endsWith('/depart'))?.corps).toEqual({
      successions: [{ coproprieteId: C1, versGestionnaireId: null }, { coproprieteId: C2, versGestionnaireId: null }],
    })
  })

  it('refus du serveur : message dans la fenêtre, rien n’est rechargé', async () => {
    await rendreFiche()
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      appels.push({ url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) : null })
      return json({ error: 'a_reverifier' }, 409)
    }))
    fireEvent.click(screen.getByRole('button', { name: G.fiche.depart }))
    const fenetre = screen.getByRole('dialog')
    fireEvent.change(within(fenetre).getByLabelText(remplir(G.depart.successeur, { nom: 'Résidence Une' })), { target: { value: 'sans' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: G.depart.confirmer }))
    expect(await within(fenetre).findByText(T.erreurs.a_reverifier)).toBeInTheDocument()
    expect(rappelsFiche.onModifie).not.toHaveBeenCalled()
  })
})

describe('fiche désactivée', () => {
  it('« Réactiver » et « Effacer ses données » (confirmation, puis PATCH { pseudonymiser: true })', async () => {
    await rendreFiche(detail(fiche(G1, 'Marie Exemple', 'desactive')))
    expect(screen.queryByRole('button', { name: G.fiche.depart })).toBeNull()
    expect(screen.getByRole('button', { name: G.gestionnaires.reactiver })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: G.fiche.effacer }))
    expect(screen.getByText(G.fiche.effacerAvertissement)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: G.fiche.confirmerEffacer }))
    await waitFor(() => expect(appels.some((a) => a.methode === 'PATCH')).toBe(true))
    expect(appels.find((a) => a.methode === 'PATCH')?.corps).toEqual({ pseudonymiser: true })
  })
})
