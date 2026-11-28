// tests/components/aj-signalement/espace-diffusion-suivi.test.tsx
//
// AJ Signalement, PR 3 — relecture 3 : fenêtre de diffusion ouverte depuis le SUIVI d'un gestionnaire (page profil du
// super admin, #gestionnaire/<id> → « Sa page de suivi » → détail → « Informer les déclarants de ce signalement »).
// Cahier § 7.1 : la fenêtre est protégée au changement de vue de l'espace, comme dans le tableau — pendant la saisie,
// « Abandonner ce message ? » (la saisie reste) ; pendant l'envoi, aucune fermeture (« L'envoi continue »), la reprise
// automatique continue. Avant la correction, la fiche du gestionnaire (démontée au changement d'ancre) emportait la
// fenêtre : saisie perdue sans question, envoi abandonné (le filet D-C1 est inactif par défaut).
// Témoin : même harnais, fenêtre ouverte depuis la carte d'une copropriété (TableauSignalementsQr), déjà protégée.
// Simulés : Supabase (session du super admin), les routes de l'espace et de la diffusion. Aucune donnée réelle.

import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gestionCoproprieteQrVide } from '@/lib/aj-signalement/types'

type Rappel = (evenement: string, session: unknown) => void
const simul = vi.hoisted(() => ({ getUser: vi.fn(), signOut: vi.fn(), rappels: [] as Array<(e: string, s: unknown) => void> }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: simul.getUser,
      signOut: simul.signOut,
      onAuthStateChange: (rappel: Rappel) => {
        simul.rappels.push(rappel)
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
    },
  },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { default: EspaceAjSignalement } = await import('@/components/aj-signalement/espace/EspaceAjSignalement')
const { TEXTES_ECRAN_DIFFUSION_QR: TD } = await import('@/lib/aj-signalement/affichage-ecran-diffusion')
const { TEXTES_GESTION_QR: G } = await import('@/lib/aj-signalement/affichage-gestion')
const { remplir } = await import('@/lib/coproprietaire/textes')

const GESTIONNAIRE_ID = '11111111-1111-4111-8111-111111111111'
const CABINET = { id: 'a0000000-0000-4000-8000-0000000000a1', nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }
const COPRO = 'c0000000-0000-4000-8000-0000000000d1'
const SIG = 'a1000000-0000-4000-8000-0000000000d1'
const DIFF = 'df000000-0000-4000-8000-0000000000d1'
const BASE = `/api/aj-signalement/coproprietes/${COPRO}/diffusions`
const marie = {
  id: GESTIONNAIRE_ID, nom: 'Marie Exemple', cabinet: CABINET, email: 'marie.exemple@exemple.test', etat: 'adresse_confirmee', domaineForce: false,
  coproprietes: 1, ouverts: 1, urgents: 0, creeLe: '2026-11-01T09:00:00.000Z', confirmeeLe: '2026-11-02T09:00:00.000Z',
}
const copro = {
  id: COPRO, nom: 'Résidence Exemple', adresse: '1 rue Exemple', jeton: '0123456789abcdef0123456789abcdef', emailsDestinataires: [], actif: true,
  creeLe: '2026-11-04T10:00:00.000Z', nbSignalements: 1, nbEnAttente: 1, derniereAdresseProposee: null, ...gestionCoproprieteQrVide(),
  cabinet: CABINET, ouverts: 1,
}
const signalement = {
  id: SIG, coproprieteId: COPRO, coproprieteNom: 'Résidence Exemple', prenom: 'Paul', nom: 'Exemple', telephone: '06 00 00 00 00',
  email: 'paul@exemple.test', batiment: 'B', etage: '3', numLot: '12', estPartieCommune: false, zoneSignalee: '', typeIntervention: 'Plomberie',
  description: 'Fuite', priorite: 'normale', statut: 'en_attente', langue: 'fr', emailEnvoyeLe: null, emailErreur: null,
  confirmationEnvoyeeLe: null, confirmationErreur: null, qualiteDeclarant: null, adresseProposee: '', signalementLieId: null,
  creeLe: '2026-11-04T14:05:00.000Z', misAJourLe: '2026-11-04T14:05:00.000Z',
}

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })
const simulEnvoi = { premier: null as Promise<Response> | null, reprises: [] as Array<Promise<Response> | Response> }
let appels: Array<{ url: string; methode: string }> = []
const reprises = () => appels.filter((a) => a.url.endsWith('/reprendre'))

function reponse(url: string, init?: RequestInit): Response | Promise<Response> {
  if (url.startsWith('/api/aj-signalement/tableau')) return json({ tableau: { coproprietes: [copro], signalements: [signalement] } })
  if (url === '/api/aj-signalement/cabinets') return json({ cabinets: [{ ...CABINET, langue: 'fr', domaines: ['exemple.test'], identifiantFige: true, nbCoproprietes: 1, nbGestionnaires: 1 }] })
  if (url.startsWith('/api/aj-signalement/gestionnaires?')) return json({ gestionnaires: [marie] })
  if (url === `/api/aj-signalement/gestionnaires/${GESTIONNAIRE_ID}`) return json({ gestionnaire: marie, envois: [], attributions: [], creations: [], journal: [] })
  if (url.startsWith(`/api/aj-signalement/coproprietes/${COPRO}/signalements`)) return json({ signalements: [signalement], suite: null })
  if (url === `${BASE}/valeurs`) {
    return json({ possible: true, raison: null, langue: 'fr', batiments: [], sansBatiment: 0, porteeParDefaut: 'copropriete', ceMois: { nb: 0, dernierLe: null }, nbNonAnnonces: 0, finMissionLe: null })
  }
  if (url === `${BASE}/apercu`) {
    return json({ nbDestinataires: 3, nbExclusOpposition: 0, libellePerimetre: 'Déclarants du signalement', libelleASaisir: false, instant: '2026-11-12T10:00:00.000+00:00', possible: true, raison: null })
  }
  if (url === BASE && init?.method === 'POST') {
    return simulEnvoi.premier ?? json({ diffusionId: DIFF, nbDestinataires: 3, envoyes: 3, refuses: 0, reste: 0, arret: null, rejeu: false }, 201)
  }
  if (url.endsWith('/reprendre')) return simulEnvoi.reprises.shift() ?? json({ envoyes: 3, refuses: 0, reste: 0, arret: null })
  return json({})
}

const effetsPoses = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
/** Bouton Retour du navigateur (ou ancre changée à la main) : popstate vers une autre vue de l'espace. */
async function revenirA(adresse: string) {
  window.history.replaceState(null, '', adresse)
  await act(async () => { window.dispatchEvent(new PopStateEvent('popstate')) })
}
const superAdmin = () => simul.getUser.mockResolvedValue({
  data: { user: { id: 'u1', email: 'admin@example.com', app_metadata: { role: 'super_admin' }, user_metadata: {} } }, error: null,
})
const fenetreSignalement = () => screen.queryByRole('dialog', { name: TD.titres.signalement })

/** Page profil du gestionnaire → Suivi → « Voir les signalements » → « Détail » → « Informer les déclarants de ce signalement ». */
async function ouvrirDiffusionDepuisSuivi() {
  window.history.replaceState(null, '', `/fr/aj-signalement/#gestionnaire/${GESTIONNAIRE_ID}`)
  superAdmin()
  render(<EspaceAjSignalement />)
  await screen.findByRole('heading', { name: 'Marie Exemple', level: 2 })
  await effetsPoses()
  fireEvent.click(await screen.findByRole('button', { name: G.suivi.voir }))
  fireEvent.click(await screen.findByRole('button', { name: G.suivi.voirDetail }))
  fireEvent.click(await screen.findByRole('button', { name: TD.detail.informer }))
  await screen.findByRole('dialog', { name: TD.titres.signalement })
  await screen.findByRole('button', { name: TD.boutons.verifier })
}

function saisirMessage() {
  fireEvent.change(screen.getByLabelText(TD.formulaire.objet), { target: { value: 'Coupure d’eau demain' } })
  fireEvent.change(screen.getByLabelText(TD.formulaire.texte), { target: { value: 'L’eau sera coupée demain de 9 h à 10 h.' } })
  fireEvent.change(screen.getByLabelText(TD.instruction.reference), { target: { value: 'Courriel du cabinet du 01/11/2026' } })
  fireEvent.change(screen.getByLabelText(TD.instruction.date), { target: { value: '2026-11-01' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  simul.rappels = []
  simul.signOut.mockResolvedValue({ error: null })
  simulEnvoi.premier = null
  simulEnvoi.reprises = []
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, methode: init?.method ?? 'GET' })
    return reponse(url, init)
  }))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('témoin — fenêtre ouverte depuis la carte (TableauSignalementsQr), même harnais', () => {
  it('pendant la saisie, Retour du navigateur : « Abandonner ce message ? », la saisie reste', async () => {
    window.history.replaceState(null, '', '/fr/aj-signalement/#coproprietes')
    superAdmin()
    render(<EspaceAjSignalement />)
    fireEvent.click(await screen.findByRole('button', { name: TD.carte.diffuser }, { timeout: 5000 }))
    await screen.findByRole('dialog', { name: remplir(TD.titres.message, { copropriete: 'Résidence Exemple' }) })
    await screen.findByRole('button', { name: TD.boutons.verifier })
    await effetsPoses()
    fireEvent.change(screen.getByLabelText(TD.formulaire.objet), { target: { value: 'Coupure d’eau demain' } })
    await effetsPoses()
    await revenirA('/fr/aj-signalement/#signalements')
    await effetsPoses()
    expect(screen.getByText(TD.fermeture.question)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Coupure d’eau demain')).toBeInTheDocument()
  })
})

describe('relecture 3 — suivi d’un gestionnaire : la fenêtre de diffusion est protégée au changement de vue (§ 7.1)', () => {
  it('pendant la saisie, Retour : « Abandonner ce message ? », la saisie reste ; « Abandonner » ferme, la vue choisie s’affiche', async () => {
    await ouvrirDiffusionDepuisSuivi()
    fireEvent.change(screen.getByLabelText(TD.formulaire.objet), { target: { value: 'Coupure d’eau demain' } })
    await effetsPoses()
    await revenirA('/fr/aj-signalement/#coproprietes')
    await effetsPoses()
    expect(fenetreSignalement()).not.toBeNull()
    expect(screen.getByText(TD.fermeture.question)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Coupure d’eau demain')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: TD.fermeture.abandonner }))
    await waitFor(() => expect(fenetreSignalement()).toBeNull())
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Copropriétés')
  })

  it('pendant l’envoi, Retour : la fenêtre reste (« L’envoi continue »), la reprise automatique va au bout', async () => {
    let resoudre!: (r: Response) => void
    simulEnvoi.premier = new Promise<Response>((r) => { resoudre = r })
    await ouvrirDiffusionDepuisSuivi()
    saisirMessage()
    fireEvent.click(screen.getByRole('button', { name: TD.boutons.verifier }))
    fireEvent.click(await screen.findByRole('button', { name: 'Envoyer à 3 personnes' }))
    await screen.findByText(TD.envoi.enCours)
    await revenirA('/fr/aj-signalement/#coproprietes')
    await effetsPoses()
    expect(fenetreSignalement()).not.toBeNull()
    expect(screen.getByText(TD.fermeture.envoiContinue)).toBeInTheDocument()
    await act(async () => { resoudre(json({ diffusionId: DIFF, nbDestinataires: 3, envoyes: 1, refuses: 0, reste: 2, arret: null, rejeu: false }, 201)) })
    expect(await screen.findByText('Message envoyé à 3 personnes.', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(reprises()).toHaveLength(1)
  })

  it('sans saisie, Retour : la fenêtre se ferme avec la vue quittée', async () => {
    await ouvrirDiffusionDepuisSuivi()
    await effetsPoses()
    await revenirA('/fr/aj-signalement/#coproprietes')
    await effetsPoses()
    await waitFor(() => expect(fenetreSignalement()).toBeNull())
  })
})
