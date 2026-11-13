// tests/components/aj-signalement/listes-rafraichies.test.tsx
//
// Correctif du 13/11/2026 (Hugo : « les listes ne se rafraîchissent pas »). En production, chaque appel
// /api/aj-signalement/* répond en ≈ 2,4 s : après une création ou une modification, le message de succès s'affichait
// tout de suite et la liste n'arrivait que 2 à 5 s plus tard. Désormais l'espace rend une PROMESSE de rechargement
// (cabinets, fiches, tableau), la page profil relit aussi sa fiche, et chaque action attend la liste à jour avant de
// fermer sa fenêtre et d'annoncer son succès :
// - pendant l'attente, l'état « occupé » existant reste (bouton désactivé, aria-busy du formulaire), sans double envoi ;
// - rechargement en échec : le succès reste annoncé (l'action est faite) et l'erreur de chargement existante s'affiche.
// Rechargements lents simulés par des promesses différées : le message n'apparaît qu'après la liste.
// Actions couvertes (espace du super admin) : cabinets (création, modification, rattachement) ; liste des gestionnaires
// (création, renvoi de la confirmation, réactivation, ouverture et renvoi de l'accès, accès groupé) ; page profil
// (retrait et ajout d'attributions, nom, renvoi de la confirmation, accès, réactivation, effacement, blocage, déblocage,
// suppression du compte, départ).

import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIBELLE_ETAT_GESTIONNAIRE_QR as ETAT, TEXTES_GESTION_QR as G } from '@/lib/aj-signalement/affichage-gestion'
import { messageErreurTableauQr } from '@/lib/aj-signalement/affichage'
import { remplir } from '@/lib/coproprietaire/textes'
import {
  gestionCoproprieteQrVide, type CabinetQr, type CoproprieteQr, type FicheGestionnaireDetailQr, type GestionnaireQr,
} from '@/lib/aj-signalement/types'

const simul = vi.hoisted(() => ({ getUser: vi.fn(), toastErreur: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: simul.getUser,
      signOut: vi.fn(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))
vi.mock('sonner', () => ({ toast: { error: simul.toastErreur, success: vi.fn() } }))

const { default: EspaceAjSignalement } = await import('@/components/aj-signalement/espace/EspaceAjSignalement')
const { default: CabinetsQr } = await import('@/components/aj-signalement/CabinetsQr')
const { default: ListeGestionnairesQr } = await import('@/components/aj-signalement/ListeGestionnairesQr')
const { default: FicheGestionnaireQr } = await import('@/components/aj-signalement/FicheGestionnaireQr')

// ── Outils ───────────────────────────────────────────────────────────────────

/** Promesse tenue à la demande : un rechargement lent (≈ 2,4 s en production). */
interface Differe { promesse: Promise<void>; resoudre: () => void }
function differe(): Differe {
  let resoudre: () => void = () => undefined
  const promesse = new Promise<void>((r) => { resoudre = r })
  return { promesse, resoudre }
}

type Appel = { url: string; methode: string; corps: unknown }
let appels: Appel[] = []
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

function simulerFetch(routeur: (appel: Appel) => Response | Promise<Response>) {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const appel = { url, methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) : null }
    appels.push(appel)
    return routeur(appel)
  }))
}
/** Appels qui modifient (tout sauf les lectures). */
const envois = () => appels.filter((a) => a.methode !== 'GET')
const lectures = (url: string) => appels.filter((a) => a.methode === 'GET' && a.url === url)

// ── Données ──────────────────────────────────────────────────────────────────

const K1 = 'a0000000-0000-4000-8000-0000000000a1'
const K2 = 'a0000000-0000-4000-8000-0000000000a2'
const G1 = '11111111-1111-4111-8111-111111111111'
const G2 = '22222222-2222-4222-8222-222222222222'
const G3 = '33333333-3333-4333-8333-333333333333'
const C1 = 'c0000000-0000-4000-8000-000000000001'
const C2 = 'c0000000-0000-4000-8000-000000000002'
const C3 = 'c0000000-0000-4000-8000-000000000003'

const cabinetExemple: CabinetQr = {
  id: K1, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr', domaines: ['exemple.test'], identifiantFige: true,
  nbCoproprietes: 1, nbGestionnaires: 1,
}
const RESUME = { id: K1, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }

const copro = (id: string, nom: string, gestion: Partial<CoproprieteQr> = {}): CoproprieteQr => ({
  id, nom, adresse: '', jeton: '0'.repeat(32), emailsDestinataires: [], actif: true, creeLe: '2026-11-01T00:00:00Z', nbSignalements: 0,
  nbEnAttente: 0, derniereAdresseProposee: null, ...gestionCoproprieteQrVide(), cabinet: RESUME, ...gestion,
})

/** Champs d'accès (migration 20261112) : fiche sans compte relié. */
const ACCES = { accesOuvertLe: null, connexionBloquee: false, effacementDemandeLe: null, compteRelie: false }

const fiche = (id: string, nom: string | null, etat: GestionnaireQr['etat'], extra: Partial<GestionnaireQr> = {}): GestionnaireQr => ({
  id, nom, cabinet: RESUME, email: nom ? `${nom.toLowerCase().replace(/\s+/g, '.')}@exemple.test` : null, etat, domaineForce: false,
  coproprietes: 1, ouverts: 0, urgents: 0, creeLe: '2026-11-01T09:00:00.000Z', confirmeeLe: null, ...extra,
})

const detail = (g: GestionnaireQr): FicheGestionnaireDetailQr => ({
  gestionnaire: g,
  envois: [],
  attributions: [
    { coproprieteId: C1, nom: 'Résidence Une', origine: 'super_admin', creeLe: '2026-11-01T09:00:00.000Z' },
    { coproprieteId: C2, nom: 'Résidence Deux', origine: 'import', creeLe: '2026-11-01T09:00:00.000Z' },
  ],
  creations: [],
  journal: [],
})

const coproprietesFiche = [
  copro(C1, 'Résidence Une', { gestionnaires: [{ id: G1, nom: 'Marie Exemple' }] }),
  copro(C2, 'Résidence Deux', { gestionnaires: [{ id: G1, nom: 'Marie Exemple' }, { id: G3, nom: 'Léa Exemple' }] }),
  copro(C3, 'Parc Belle Ombre'),
]

beforeEach(() => {
  vi.clearAllMocks()
  simulerFetch(() => json({}))
})
afterEach(() => vi.unstubAllGlobals())

// ── 1. L'espace : rafraichir rend la promesse des listes rechargées ─────────────

describe('espace du super admin : la liste à jour avant le message', () => {
  interface Serveur { cabinets: CabinetQr[]; gestionnaires: GestionnaireQr[]; coproprietes: CoproprieteQr[] }
  let serveur: Serveur
  /** Lectures retenues jusqu'à l'ouverture de la barrière (rechargements lents). */
  let barriere: { retient: (url: string) => boolean; ouverte: Promise<void> } | null = null
  /** Lecture des cabinets en échec (après l'action). */
  let panneCabinets: 'serveur' | 'reseau' | null = null
  let panneGestionnaires: 'serveur' | null = null

  const estTableau = (url: string) => url.startsWith('/api/aj-signalement/tableau')
  const estCabinets = (url: string) => url === '/api/aj-signalement/cabinets'
  const estFiches = (url: string) => url.startsWith('/api/aj-signalement/gestionnaires?')
  const retenir = (retient: (url: string) => boolean): (() => Promise<void>) => {
    const d = differe()
    barriere = { retient, ouverte: d.promesse }
    return () => act(async () => { d.resoudre() })
  }

  async function routeur(a: Appel): Promise<Response> {
    if (a.methode === 'GET') {
      if (barriere?.retient(a.url)) await barriere.ouverte
      if (estTableau(a.url)) return json({ tableau: { coproprietes: serveur.coproprietes, signalements: [] } })
      if (estCabinets(a.url)) {
        if (panneCabinets === 'reseau') throw new TypeError('Failed to fetch')
        if (panneCabinets === 'serveur') return json({ error: 'serveur' }, 500)
        return json({ cabinets: serveur.cabinets })
      }
      if (estFiches(a.url)) return panneGestionnaires ? json({ error: 'serveur' }, 500) : json({ gestionnaires: serveur.gestionnaires })
      return json({})
    }
    if (a.url === '/api/aj-signalement/cabinets' && a.methode === 'POST') {
      const saisie = a.corps as Pick<CabinetQr, 'nom' | 'identifiant' | 'langue' | 'domaines'>
      const cabinet: CabinetQr = { id: K2, ...saisie, identifiantFige: false, nbCoproprietes: 0, nbGestionnaires: 0 }
      serveur.cabinets = [...serveur.cabinets, cabinet]
      return json({ cabinet, fichesHorsDomaines: [] }, 201)
    }
    if (a.url === `/api/aj-signalement/cabinets/${K1}/rattachement`) {
      serveur.coproprietes = serveur.coproprietes.map((c) => ({ ...c, cabinet: RESUME }))
      return json({ rattachees: 1 })
    }
    if (a.url === `/api/aj-signalement/gestionnaires/${G1}/acces`) {
      serveur.gestionnaires = serveur.gestionnaires.map((g) => (g.id === G1 ? { ...g, etat: 'acces_envoye' as const } : g))
      return json({ emailEnvoye: true })
    }
    return json({ error: 'introuvable' }, 404)
  }

  async function ouvrirEspace(ancre: 'cabinets' | 'gestionnaires') {
    window.history.replaceState(null, '', `/fr/aj-signalement/#${ancre}`)
    simul.getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'admin@example.com', app_metadata: { role: 'super_admin' }, user_metadata: {} } }, error: null })
    render(<EspaceAjSignalement />)
    // Garde, puis cabinets, fiches et tableau affichés (lents sous la charge de la suite complète).
    const prets = ancre === 'cabinets' ? ['Cabinet Exemple', remplir(G.cabinets.sansCabinet, { n: 1 })] : ['Marie Exemple']
    await waitFor(() => { for (const nom of prets) expect(screen.getByRole('heading', { name: nom })).toBeInTheDocument() }, { timeout: 10_000 })
  }

  beforeEach(() => {
    serveur = {
      cabinets: [cabinetExemple],
      gestionnaires: [fiche(G1, 'Marie Exemple', 'adresse_confirmee', { ...ACCES })],
      coproprietes: [copro(C1, 'Parc Belle Ombre', { cabinet: null })],
    }
    barriere = null
    panneCabinets = null
    panneGestionnaires = null
    simulerFetch(routeur)
  })
  afterEach(() => window.history.replaceState(null, '', '/fr/aj-signalement/'))

  async function creerCabinet() {
    fireEvent.click(await screen.findByRole('button', { name: G.cabinets.nouveau }))
    const fenetre = screen.getByRole('dialog')
    fireEvent.change(within(fenetre).getByLabelText(G.cabinets.nom), { target: { value: 'Cabinet Neuf' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: G.cabinets.creer }))
    return fenetre
  }

  it('« Créer le cabinet » : fenêtre ouverte et occupée tant que cabinets, fiches et tableau ne sont pas relus ; puis la liste et « Cabinet créé. »', async () => {
    await ouvrirEspace('cabinets')
    expect(await screen.findByRole('heading', { name: 'Cabinet Exemple' })).toBeInTheDocument()
    const relacher = retenir((url) => estTableau(url) || estCabinets(url) || estFiches(url))
    const fenetre = await creerCabinet()

    await waitFor(() => expect(lectures('/api/aj-signalement/cabinets')).toHaveLength(2))
    await waitFor(() => expect(appels.filter((a) => estTableau(a.url))).toHaveLength(2))
    // Pendant le rechargement : rien d'annoncé, la fenêtre reste ouverte, occupée, et ne renvoie rien.
    expect(screen.queryByText(G.cabinets.cree)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Cabinet Neuf' })).toBeNull()
    expect(screen.getByRole('dialog')).toBe(fenetre)
    const bouton = within(fenetre).getByRole('button', { name: G.cabinets.creer })
    expect(bouton).toBeDisabled()
    expect(fenetre.querySelector('form')).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(bouton)
    fireEvent.submit(fenetre.querySelector('form') as HTMLFormElement)
    expect(envois()).toHaveLength(1)

    await relacher()
    expect(await screen.findByText(G.cabinets.cree)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cabinet Neuf' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(envois()).toHaveLength(1)
  })

  it('rattachement : le message attend aussi le TABLEAU relu (la copropriété quitte « sans cabinet »)', async () => {
    await ouvrirEspace('cabinets')
    const bloc = (await screen.findByRole('heading', { name: remplir(G.cabinets.sansCabinet, { n: 1 }) })).closest('section') as HTMLElement
    fireEvent.click(within(bloc).getByRole('checkbox', { name: /Parc Belle Ombre/ }))
    fireEvent.change(within(bloc).getByLabelText(G.cabinets.rattacherA), { target: { value: K1 } })
    fireEvent.click(within(bloc).getByRole('button', { name: G.cabinets.rattacher }))
    const relacher = retenir(estTableau)
    fireEvent.click(within(bloc).getByRole('button', { name: G.cabinets.confirmerRattachement }))

    await waitFor(() => expect(appels.filter((a) => estTableau(a.url))).toHaveLength(2))
    // Cabinets et fiches relus, le tableau pas encore : toujours rien d'annoncé, confirmation occupée.
    await waitFor(() => expect(lectures('/api/aj-signalement/cabinets')).toHaveLength(2))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(screen.queryByText(remplir(G.cabinets.rattachees, { n: 1 }))).toBeNull()
    expect(within(bloc).getByRole('button', { name: G.cabinets.confirmerRattachement })).toBeDisabled()

    await relacher()
    expect(await screen.findByText(remplir(G.cabinets.rattachees, { n: 1 }))).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: remplir(G.cabinets.sansCabinet, { n: 1 }) })).toBeNull()
    expect(envois()).toHaveLength(1)
  })

  it.each([
    ['serveur', false],
    ['reseau', true],
  ] as const)('rechargement des cabinets en échec (%s) : « Cabinet créé. » reste annoncé, l’erreur de chargement s’affiche', async (code, toast) => {
    await ouvrirEspace('cabinets')
    expect(await screen.findByRole('heading', { name: 'Cabinet Exemple' })).toBeInTheDocument()
    panneCabinets = code
    await creerCabinet()
    expect(await screen.findByText(messageErreurTableauQr(code))).toBeInTheDocument()
    expect(await screen.findByText(G.cabinets.cree)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    if (toast) expect(simul.toastErreur).toHaveBeenCalledWith(messageErreurTableauQr('reseau'))
    expect(envois()).toHaveLength(1)
  })

  it('« Ouvrir l’accès à son suivi » (liste des gestionnaires) : la ligne passe à « Accès envoyé » avant le message', async () => {
    await ouvrirEspace('gestionnaires')
    const ligne = () => screen.getByText('Marie Exemple', { selector: 'h3' }).closest('li') as HTMLElement
    const premiere = await waitFor(() => ligne())
    const relacher = retenir((url) => estTableau(url) || estCabinets(url) || estFiches(url))
    fireEvent.click(within(premiere).getByRole('button', { name: G.acces.ouvrir }))
    await waitFor(() => expect(lectures('/api/aj-signalement/gestionnaires?etat=tous')).toHaveLength(2))
    const message = remplir(G.acces.envoye, { email: 'marie.exemple@exemple.test' })
    expect(screen.queryByText(message)).toBeNull()
    const bouton = within(ligne()).getByRole('button', { name: G.acces.ouvrir })
    expect(bouton).toBeDisabled()
    fireEvent.click(bouton)
    expect(envois()).toHaveLength(1)

    await relacher()
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(within(ligne()).getByText(ETAT.acces_envoye)).toBeInTheDocument()
    expect(within(ligne()).getByRole('button', { name: G.acces.renvoyer })).toBeInTheDocument()
  })

  it('rechargement des fiches en échec après l’envoi d’accès : le message reste, l’erreur de chargement s’affiche', async () => {
    await ouvrirEspace('gestionnaires')
    const ligne = await waitFor(() => screen.getByText('Marie Exemple', { selector: 'h3' }).closest('li') as HTMLElement)
    panneGestionnaires = 'serveur'
    fireEvent.click(within(ligne).getByRole('button', { name: G.acces.ouvrir }))
    expect(await screen.findByText(messageErreurTableauQr('serveur'))).toBeInTheDocument()
    expect(await screen.findByText(remplir(G.acces.envoye, { email: 'marie.exemple@exemple.test' }))).toBeInTheDocument()
  })
})

// ── 2. Cabinets : chaque action attend onModifie ───────────────────────────────

describe('vue Cabinets : chaque action attend la liste à jour', () => {
  let attente: Differe
  const onModifie = vi.fn(() => attente.promesse)
  const rendre = () => render(
    <CabinetsQr
      cabinets={[cabinetExemple]} erreur={null} coproprietes={[copro(C1, 'Parc Belle Ombre', { cabinet: null })]}
      onModifie={onModifie} onReessayer={vi.fn()} onJournal={vi.fn()}
    />,
  )
  beforeEach(() => { attente = differe() })

  it('création : fenêtre ouverte et occupée, aucun double envoi, puis fermée avec « Cabinet créé. »', async () => {
    simulerFetch(() => json({ cabinet: { ...cabinetExemple, id: K2 }, fichesHorsDomaines: [] }, 201))
    rendre()
    fireEvent.click(screen.getByRole('button', { name: G.cabinets.nouveau }))
    const fenetre = screen.getByRole('dialog')
    fireEvent.change(within(fenetre).getByLabelText(G.cabinets.nom), { target: { value: 'Cabinet Neuf' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: G.cabinets.creer }))
    await waitFor(() => expect(onModifie).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(G.cabinets.cree)).toBeNull()
    expect(within(fenetre).getByRole('button', { name: G.cabinets.creer })).toBeDisabled()
    expect(within(fenetre).getByRole('button', { name: G.annuler })).toBeDisabled()
    expect(fenetre.querySelector('form')).toHaveAttribute('aria-busy', 'true')
    fireEvent.submit(fenetre.querySelector('form') as HTMLFormElement)
    expect(envois()).toHaveLength(1)

    await act(async () => { attente.resoudre() })
    expect(screen.getByText(G.cabinets.cree)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(envois()).toHaveLength(1)
  })

  it('modification : « Cabinet enregistré. » seulement après la liste relue', async () => {
    simulerFetch(() => json({ cabinet: cabinetExemple, fichesHorsDomaines: [] }))
    rendre()
    fireEvent.click(screen.getByRole('button', { name: G.cabinets.modifier }))
    const fenetre = screen.getByRole('dialog')
    fireEvent.change(within(fenetre).getByLabelText(G.cabinets.nom), { target: { value: 'Cabinet Exemple Bis' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: G.enregistrer }))
    await waitFor(() => expect(onModifie).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(G.cabinets.modifie)).toBeNull()
    expect(within(fenetre).getByRole('button', { name: G.enregistrer })).toBeDisabled()

    await act(async () => { attente.resoudre() })
    expect(screen.getByText(G.cabinets.modifie)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(envois()).toHaveLength(1)
  })

  it('rattachement : confirmation occupée, aucun double envoi, puis le message', async () => {
    simulerFetch(() => json({ rattachees: 1 }))
    rendre()
    const bloc = screen.getByRole('heading', { name: remplir(G.cabinets.sansCabinet, { n: 1 }) }).closest('section') as HTMLElement
    fireEvent.click(within(bloc).getByRole('checkbox', { name: /Parc Belle Ombre/ }))
    fireEvent.change(within(bloc).getByLabelText(G.cabinets.rattacherA), { target: { value: K1 } })
    fireEvent.click(within(bloc).getByRole('button', { name: G.cabinets.rattacher }))
    fireEvent.click(within(bloc).getByRole('button', { name: G.cabinets.confirmerRattachement }))
    await waitFor(() => expect(onModifie).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(remplir(G.cabinets.rattachees, { n: 1 }))).toBeNull()
    const confirmer = within(bloc).getByRole('button', { name: G.cabinets.confirmerRattachement })
    expect(confirmer).toBeDisabled()
    fireEvent.click(confirmer)
    expect(envois()).toHaveLength(1)

    await act(async () => { attente.resoudre() })
    expect(screen.getByText(remplir(G.cabinets.rattachees, { n: 1 }))).toBeInTheDocument()
    expect(envois()).toHaveLength(1)
  })

  it('liste en échec après l’action (erreur passée par l’espace) : le succès reste affiché au-dessus de l’erreur', async () => {
    simulerFetch(() => json({ cabinet: { ...cabinetExemple, id: K2 }, fichesHorsDomaines: [] }, 201))
    const proprietes = { cabinets: [cabinetExemple], coproprietes: [], onModifie, onReessayer: vi.fn(), onJournal: vi.fn() }
    const { rerender } = render(<CabinetsQr {...proprietes} erreur={null} />)
    fireEvent.click(screen.getByRole('button', { name: G.cabinets.nouveau }))
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText(G.cabinets.nom), { target: { value: 'Cabinet Neuf' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: G.cabinets.creer }))
    await waitFor(() => expect(onModifie).toHaveBeenCalledTimes(1))
    rerender(<CabinetsQr {...proprietes} erreur="serveur" />)
    await act(async () => { attente.resoudre() })
    expect(screen.getByText(G.cabinets.cree)).toBeInTheDocument()
    expect(screen.getByText(messageErreurTableauQr('serveur'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: G.reessayer })).toBeInTheDocument()
  })
})

// ── 3. Liste des gestionnaires ───────────────────────────────────────────────

describe('liste des gestionnaires : chaque action attend la liste à jour', () => {
  let attente: Differe
  const onModifie = vi.fn(() => attente.promesse)
  const rendre = (gestionnaires: GestionnaireQr[]) => render(
    <ListeGestionnairesQr
      gestionnaires={gestionnaires} cabinets={[cabinetExemple]} erreur={null} coproprietes={coproprietesFiche}
      onOuvrir={vi.fn()} onModifie={onModifie} onReessayer={vi.fn()} onCabinets={vi.fn()}
    />,
  )
  const ligne = (nom: string) => screen.getByText(nom, { selector: 'h3' }).closest('li') as HTMLElement
  beforeEach(() => { attente = differe() })

  it.each([
    ['renvoi de la confirmation', fiche(G3, 'Léa Exemple', 'confirmation_expiree'), G.gestionnaires.renvoyer, { emailEnvoye: true },
      remplir(G.gestionnaires.renvoye, { email: 'léa.exemple@exemple.test' })],
    ['réactivation', fiche(G3, 'Léa Exemple', 'desactive'), G.gestionnaires.reactiver, { gestionnaire: fiche(G3, 'Léa Exemple', 'adresse_confirmee') },
      G.gestionnaires.reactive],
    ['ouverture de l’accès', fiche(G3, 'Léa Exemple', 'adresse_confirmee', { ...ACCES }), G.acces.ouvrir, { emailEnvoye: true },
      remplir(G.acces.envoye, { email: 'léa.exemple@exemple.test' })],
    ['renvoi de l’accès', fiche(G3, 'Léa Exemple', 'acces_envoye', { ...ACCES }), G.acces.renvoyer, { emailEnvoye: true },
      remplir(G.acces.envoye, { email: 'léa.exemple@exemple.test' })],
  ])('%s : boutons désactivés, aucun double envoi, message après la liste', async (_cas, g, bouton, reponse, message) => {
    simulerFetch(() => json(reponse))
    rendre([g])
    fireEvent.click(within(ligne('Léa Exemple')).getByRole('button', { name: bouton }))
    await waitFor(() => expect(onModifie).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(message)).toBeNull()
    const actif = within(ligne('Léa Exemple')).getByRole('button', { name: bouton })
    expect(actif).toBeDisabled()
    fireEvent.click(actif)
    expect(envois()).toHaveLength(1)

    await act(async () => { attente.resoudre() })
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(within(ligne('Léa Exemple')).getByRole('button', { name: bouton })).toBeEnabled()
    expect(envois()).toHaveLength(1)
  })

  it('accès groupé : confirmation occupée jusqu’à la liste relue, puis le bilan', async () => {
    simulerFetch(() => json({ envoyes: 1, echecs: [] }))
    rendre([fiche(G1, 'Marie Exemple', 'adresse_confirmee', { ...ACCES })])
    fireEvent.click(screen.getByRole('button', { name: remplir(G.acces.groupe, { n: 1 }) }))
    fireEvent.click(screen.getByRole('button', { name: remplir(G.acces.confirmerGroupe, { n: 1 }) }))
    await waitFor(() => expect(onModifie).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(remplir(G.acces.groupeEnvoye, { n: 1 }))).toBeNull()
    expect(screen.getByRole('button', { name: remplir(G.acces.groupe, { n: 1 }) })).toBeDisabled()

    await act(async () => { attente.resoudre() })
    expect(screen.getByText(remplir(G.acces.groupeEnvoye, { n: 1 }))).toBeInTheDocument()
    expect(envois()).toHaveLength(1)
  })

  it('création d’une fiche : fenêtre ouverte et occupée, aucun double envoi, puis fermée avec « Fiche créée… »', async () => {
    simulerFetch(() => json({ gestionnaire: fiche(G2, 'Jean Exemple', 'confirmation_envoyee'), emailEnvoye: true, coproprietesAvecAdresseSaisie: 0 }, 201))
    rendre([fiche(G1, 'Marie Exemple', 'adresse_confirmee')])
    fireEvent.click(screen.getByRole('button', { name: G.gestionnaires.ajouter }))
    const fenetre = screen.getByRole('dialog')
    fireEvent.change(within(fenetre).getByLabelText(G.gestionnaires.nom), { target: { value: 'Jean Exemple' } })
    fireEvent.change(within(fenetre).getByLabelText(G.gestionnaires.email), { target: { value: 'jean.exemple@exemple.test' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: G.gestionnaires.creer }))
    await waitFor(() => expect(onModifie).toHaveBeenCalledTimes(1))
    const message = remplir(G.gestionnaires.cree, { email: 'jean.exemple@exemple.test' })
    expect(screen.queryByText(message)).toBeNull()
    expect(within(fenetre).getByRole('button', { name: G.gestionnaires.creer })).toBeDisabled()
    expect(fenetre.querySelector('form')).toHaveAttribute('aria-busy', 'true')
    fireEvent.submit(fenetre.querySelector('form') as HTMLFormElement)
    expect(envois()).toHaveLength(1)

    await act(async () => { attente.resoudre() })
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(envois()).toHaveLength(1)
  })

  it('liste en échec après l’action (erreur passée par l’espace) : le succès reste affiché au-dessus de l’erreur', async () => {
    simulerFetch(() => json({ emailEnvoye: true }))
    const g = fiche(G3, 'Léa Exemple', 'confirmation_expiree')
    const proprietes = {
      gestionnaires: [g], cabinets: [cabinetExemple], coproprietes: coproprietesFiche, onOuvrir: vi.fn(), onModifie, onReessayer: vi.fn(), onCabinets: vi.fn(),
    }
    const { rerender } = render(<ListeGestionnairesQr {...proprietes} erreur={null} />)
    fireEvent.click(within(ligne('Léa Exemple')).getByRole('button', { name: G.gestionnaires.renvoyer }))
    await waitFor(() => expect(onModifie).toHaveBeenCalledTimes(1))
    rerender(<ListeGestionnairesQr {...proprietes} erreur="serveur" />)
    await act(async () => { attente.resoudre() })
    expect(screen.getByText(remplir(G.gestionnaires.renvoye, { email: 'léa.exemple@exemple.test' }))).toBeInTheDocument()
    expect(screen.getByText(messageErreurTableauQr('serveur'))).toBeInTheDocument()
  })
})

// ── 4. Page profil : la fiche relue ET les listes de l'espace ─────────────────

describe('page profil d’un gestionnaire : chaque action attend la fiche relue et les listes', () => {
  let attente: Differe
  /** Relecture de la fiche retenue (après le premier chargement). */
  let relecture: Differe | null
  let panneFiche = false
  const onModifie = vi.fn(() => attente.promesse)

  function routeurFiche(f: FicheGestionnaireDetailQr) {
    return async (a: Appel): Promise<Response> => {
      if (a.methode === 'GET' && a.url === `/api/aj-signalement/gestionnaires/${f.gestionnaire.id}`) {
        if (relecture) await relecture.promesse
        return panneFiche ? json({ error: 'serveur' }, 500) : json(f)
      }
      if (a.url.startsWith('/api/aj-signalement/tableau?gestionnaire=')) {
        return json({ tableau: { coproprietes: [], signalements: [], gestionnaire: { id: f.gestionnaire.id, nom: f.gestionnaire.nom, actif: true, cabinet: RESUME } } })
      }
      if (a.methode === 'PUT') return json({ coproprietes: [C2], adressesRetirees: 0 })
      if (a.methode === 'PATCH') return json({ gestionnaire: f.gestionnaire })
      if (a.url.endsWith('/bloquer')) return json({ connexionBloquee: true })
      if (a.url.endsWith('/depart')) return json({ deplacees: 0, laisseesSansGestionnaire: 1, adressesRetirees: 0 })
      if (a.methode === 'POST') return json({ emailEnvoye: true })
      return json({ error: 'introuvable' }, 404)
    }
  }

  async function rendreFiche(g: GestionnaireQr) {
    const f = detail(g)
    simulerFetch(routeurFiche(f))
    render(<FicheGestionnaireQr id={g.id} coproprietes={coproprietesFiche} gestionnaires={[g, fiche(G3, 'Léa Exemple', 'adresse_confirmee')]} onRetour={vi.fn()} onModifie={onModifie} />)
    await screen.findByRole('heading', { name: g.nom ?? G.fiche.ancien, level: 2 })
    relecture = differe()
  }

  beforeEach(() => {
    attente = differe()
    relecture = null
    panneFiche = false
  })

  const marie = fiche(G1, 'Marie Exemple', 'adresse_confirmee')
  const desactivee = fiche(G1, 'Marie Exemple', 'desactive')
  const COMPTE = { accesOuvertLe: '2026-11-03T09:00:00.000Z', connexionBloquee: false, effacementDemandeLe: null, compteRelie: true }
  const cliquer = (nom: string) => () => fireEvent.click(screen.getByRole('button', { name: nom }))
  const attributions = () => screen.getByRole('heading', { name: remplir(G.fiche.attribuees, { n: 2 }) }).closest('section') as HTMLElement

  /** [cas, fiche, gestes avant l'envoi, bouton de l'envoi (désactivé pendant l'attente), message]. */
  const CAS: ReadonlyArray<readonly [string, GestionnaireQr, () => void, () => HTMLElement, string]> = [
    ['retrait d’une attribution', marie, () => undefined,
      () => within(within(attributions()).getByText('Résidence Une').closest('li') as HTMLElement).getByRole('button', { name: G.fiche.retirer }),
      G.fiche.attributionsEnregistrees],
    ['ajout d’attributions', marie, () => {
      fireEvent.click(screen.getByRole('button', { name: G.fiche.ajouterCopros }))
      fireEvent.click(screen.getByRole('checkbox', { name: /Parc Belle Ombre/ }))
    }, () => screen.getByRole('button', { name: G.fiche.attribuer }), G.fiche.attributionsEnregistrees],
    ['nom modifié', marie, () => {
      fireEvent.click(screen.getByRole('button', { name: G.fiche.modifierNom }))
      fireEvent.change(screen.getByLabelText(G.fiche.nouveauNom), { target: { value: 'Marie Exemple-Martin' } })
    }, () => screen.getByRole('button', { name: G.enregistrer }), G.fiche.nomEnregistre],
    ['renvoi de la confirmation', fiche(G1, 'Marie Exemple', 'confirmation_expiree'), () => undefined,
      () => screen.getByRole('button', { name: G.gestionnaires.renvoyer }), remplir(G.gestionnaires.renvoye, { email: 'marie.exemple@exemple.test' })],
    ['ouverture de l’accès', fiche(G1, 'Marie Exemple', 'adresse_confirmee', { ...ACCES }), () => undefined,
      () => screen.getByRole('button', { name: G.acces.ouvrir }), remplir(G.acces.envoye, { email: 'marie.exemple@exemple.test' })],
    ['réactivation', desactivee, () => undefined, () => screen.getByRole('button', { name: G.gestionnaires.reactiver }), G.gestionnaires.reactive],
    ['effacement', desactivee, cliquer(G.fiche.effacer), () => screen.getByRole('button', { name: G.fiche.confirmerEffacer }), G.fiche.efface],
    ['blocage de la connexion', fiche(G1, 'Marie Exemple', 'desactive', COMPTE), () => undefined,
      () => screen.getByRole('button', { name: G.compte.bloquer }), G.compte.bloquee],
    ['déblocage de la connexion', fiche(G1, 'Marie Exemple', 'adresse_confirmee', { ...COMPTE, connexionBloquee: true }), () => undefined,
      () => screen.getByRole('button', { name: G.compte.debloquer }), G.compte.debloquee],
    ['suppression du compte', fiche(G1, null, 'desactive', COMPTE), () => undefined,
      () => screen.getByRole('button', { name: G.compte.supprimerCompte }), G.compte.compteSupprime],
  ]

  it.each(CAS)('%s : bouton désactivé, aucun double envoi ; message après les listes ET la fiche relue', async (_cas, g, preparer, bouton, message) => {
    await rendreFiche(g)
    preparer()
    fireEvent.click(bouton())
    await waitFor(() => expect(onModifie).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(lectures(`/api/aj-signalement/gestionnaires/${G1}`)).toHaveLength(2))
    expect(screen.queryByText(message)).toBeNull()
    expect(bouton()).toBeDisabled()
    fireEvent.click(bouton())
    expect(envois()).toHaveLength(1)

    // Listes de l'espace à jour, fiche pas encore relue : toujours rien d'annoncé.
    await act(async () => { attente.resoudre() })
    expect(screen.queryByText(message)).toBeNull()
    await act(async () => { relecture?.resoudre() })
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(envois()).toHaveLength(1)
  })

  it('départ : fenêtre ouverte et occupée jusqu’aux listes et à la fiche relues, puis fermée avec le bilan', async () => {
    await rendreFiche(marie)
    fireEvent.click(screen.getByRole('button', { name: G.fiche.depart }))
    const fenetre = screen.getByRole('dialog')
    fireEvent.change(within(fenetre).getByLabelText(remplir(G.depart.successeur, { nom: 'Résidence Une' })), { target: { value: 'sans' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: G.depart.confirmer }))
    await waitFor(() => expect(onModifie).toHaveBeenCalledTimes(1))
    const bilan = remplir(G.depart.fait, { deplacees: 0, sans: 1 })
    expect(screen.queryByText(bilan)).toBeNull()
    expect(screen.getByRole('dialog')).toBe(fenetre)
    const confirmer = within(fenetre).getByRole('button', { name: G.depart.confirmer })
    expect(confirmer).toBeDisabled()
    fireEvent.click(confirmer)
    expect(envois()).toHaveLength(1)

    await act(async () => { attente.resoudre() })
    await act(async () => { relecture?.resoudre() })
    expect(await screen.findByText(bilan)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(envois()).toHaveLength(1)
  })

  it('fiche relue en échec : le succès reste annoncé, l’erreur de chargement et « Réessayer » s’affichent', async () => {
    await rendreFiche(fiche(G1, 'Marie Exemple', 'confirmation_expiree'))
    relecture = null
    panneFiche = true
    attente.resoudre()
    fireEvent.click(screen.getByRole('button', { name: G.gestionnaires.renvoyer }))
    expect(await screen.findByText(messageErreurTableauQr('serveur'))).toBeInTheDocument()
    expect(screen.getByText(remplir(G.gestionnaires.renvoye, { email: 'marie.exemple@exemple.test' }))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: G.reessayer })).toBeInTheDocument()
  })
})
