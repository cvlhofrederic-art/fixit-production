// tests/components/aj-signalement/invitation-acces.test.tsx
//
// Page publique d'ouverture de l'accès d'un gestionnaire (vitfix.io/<identifiant>/invitation/#<jeton>, PR 2 lot 3,
// SPEC § 2.3.2, plan § 2.3) : le jeton est lu dans l'ancre puis EFFACÉ de l'adresse avant tout appel ; l'ouverture ne
// fait qu'une lecture sans effet ; deux champs de mot de passe (règle de « mot de passe oublié »), case « politique de
// confidentialité » ; contrôles AVANT tout envoi ; succès → « Accès ouvert. Connectez-vous. » et lien vers la connexion
// du cabinet (/<identifiant>/connexion/) ; aucune session ouverte ici ; « Ce n'est pas moi » avec confirmation ; messages
// 404 / 409 / 410 / 207 ; réseau coupé → toast. Données fictives en @exemple.test.

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEXTES_INVITATION_ACCES_QR as T } from '@/lib/aj-signalement/affichage-gestion'
import { remplir } from '@/lib/coproprietaire/textes'

const simul = vi.hoisted(() => ({ toastErreur: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: simul.toastErreur, success: vi.fn() } }))

const { default: InvitationAccesQr } = await import('@/components/aj-signalement/InvitationAccesQr')

const TOKEN = `${'a'.repeat(48)}.${'b'.repeat(64)}`
const MOT_DE_PASSE = 'Bonjour2026'
type Appel = { url: string; corps: unknown; ancreAuMomentDeLAppel: string }
let appels: Appel[] = []

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

function simulerFetch(routeur: (url: string) => Response | Promise<Response>) {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, corps: init?.body ? JSON.parse(String(init.body)) : null, ancreAuMomentDeLAppel: window.location.hash })
    return routeur(url)
  }))
}

const lectureOk = () => json({ nomCourt: 'Marie E.', cabinet: 'Cabinet Exemple', email: 'ma***@exemple.test' })
const routeur = (acceptation: () => Response) => (url: string) => (url.endsWith('/lecture') ? lectureOk() : acceptation())

async function remplirFormulaire(motDePasse = MOT_DE_PASSE, confirmation = motDePasse, cocher = true) {
  fireEvent.change(await screen.findByLabelText(T.motDePasse), { target: { value: motDePasse } })
  fireEvent.change(screen.getByLabelText(T.confirmation), { target: { value: confirmation } })
  if (cocher) fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: T.ouvrir }))
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', `/cabinet-exemple/invitation/#${TOKEN}`)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ouverture du lien', () => {
  it('l’ancre est effacée AVANT tout appel ; seule la lecture (sans effet) part, avec le cabinet du chemin', async () => {
    simulerFetch(() => lectureOk())
    render(<InvitationAccesQr identifiant="cabinet-exemple" />)
    expect(await screen.findByText(remplir(T.presentation, { nomCourt: 'Marie E.', cabinet: 'Cabinet Exemple', email: 'ma***@exemple.test' }))).toBeInTheDocument()
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/cabinet-exemple/invitation/')
    expect(appels).toHaveLength(1)
    expect(appels[0].url).toBe('/api/aj-signalement/invitation/lecture')
    expect(appels[0].corps).toEqual({ token: TOKEN, cabinet: 'cabinet-exemple' })
    expect(appels[0].ancreAuMomentDeLAppel).toBe('')
    expect(screen.getByRole('heading', { level: 1, name: T.titre })).toBeInTheDocument()
    expect(screen.getByLabelText(T.motDePasse)).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText(T.motDePasse)).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText(T.confirmation)).toHaveAttribute('type', 'password')
    expect(screen.getByText(T.regle)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByRole('link', { name: T.politiqueLien })).toHaveAttribute('href', '/fr/confidentialite/')
    expect(screen.getByRole('button', { name: T.pasMoi })).toBeInTheDocument()
  })

  it('sans ancre (ou ancre hors format) : « Ce lien n’est pas valable », aucun appel', async () => {
    simulerFetch(() => lectureOk())
    window.history.replaceState(null, '', '/cabinet-exemple/invitation/#pas-un-jeton')
    render(<InvitationAccesQr identifiant="cabinet-exemple" />)
    expect(await screen.findByText(T.invalide)).toBeInTheDocument()
    expect(window.location.hash).toBe('')
    expect(appels).toEqual([])
  })

  it.each([
    [404, { error: 'introuvable' }, T.invalide],
    [410, { error: 'expire' }, T.expire],
  ])('lecture %i : message adapté, aucun formulaire', async (status, corps, message) => {
    simulerFetch(() => json(corps, status))
    render(<InvitationAccesQr identifiant="cabinet-exemple" />)
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByLabelText(T.motDePasse)).toBeNull()
  })

  it('lecture 409 deja_ouvert : message et lien vers la connexion du cabinet', async () => {
    simulerFetch(() => json({ error: 'deja_ouvert' }, 409))
    render(<InvitationAccesQr identifiant="cabinet-exemple" />)
    expect(await screen.findByText(T.dejaOuvert)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: T.seConnecter })).toHaveAttribute('href', '/cabinet-exemple/connexion/')
  })

  it('React.StrictMode : le jeton lu une fois, jamais « pas valable »', async () => {
    simulerFetch(() => lectureOk())
    render(<React.StrictMode><InvitationAccesQr identifiant="cabinet-exemple" /></React.StrictMode>)
    expect(await screen.findByRole('button', { name: T.ouvrir })).toBeInTheDocument()
    expect(screen.queryByText(T.invalide)).toBeNull()
    expect(new Set(appels.map((a) => JSON.stringify(a.corps)))).toEqual(new Set([JSON.stringify({ token: TOKEN, cabinet: 'cabinet-exemple' })]))
  })
})

describe('choix du mot de passe : contrôles AVANT tout envoi', () => {
  it('la règle du mot de passe est toujours reliée au champ (aria-describedby), avant toute erreur', async () => {
    simulerFetch(routeur(() => json({ acces: 'ouvert' })))
    render(<InvitationAccesQr identifiant="cabinet-exemple" />)
    const champ = await screen.findByLabelText(T.motDePasse)
    const aide = champ.getAttribute('aria-describedby')
    expect(aide).toBeTruthy()
    expect(document.getElementById(String(aide))).toHaveTextContent(T.regle)
    expect(champ).not.toHaveAttribute('aria-invalid')
  })

  it.each([
    ['mot de passe non conforme', 'bonjour', 'bonjour', true, T.erreurs.regle],
    ['deux saisies différentes', MOT_DE_PASSE, 'Bonjour2027', true, T.erreurs.differents],
    ['case non cochée', MOT_DE_PASSE, MOT_DE_PASSE, false, T.erreurs.politique],
  ])('%s : message, aucun envoi', async (_cas, motDePasse, confirmation, cocher, message) => {
    simulerFetch(routeur(() => json({ acces: 'ouvert' })))
    render(<InvitationAccesQr identifiant="cabinet-exemple" />)
    await remplirFormulaire(motDePasse, confirmation, cocher)
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(appels.map((a) => a.url)).toEqual(['/api/aj-signalement/invitation/lecture'])
  })
})

describe('acceptation', () => {
  it('succès : « Accès ouvert. Connectez-vous. », lien vers /<identifiant>/connexion/ ; corps envoyé ; mot de passe jamais dans l’adresse', async () => {
    simulerFetch(routeur(() => json({ acces: 'ouvert' })))
    render(<InvitationAccesQr identifiant="cabinet-exemple" />)
    await remplirFormulaire()
    expect(await screen.findByText(T.ouvert)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: T.seConnecter })).toHaveAttribute('href', '/cabinet-exemple/connexion/')
    expect(appels.map((a) => a.url)).toEqual(['/api/aj-signalement/invitation/lecture', '/api/aj-signalement/invitation'])
    expect(appels[1].corps).toEqual({ token: TOKEN, cabinet: 'cabinet-exemple', password: MOT_DE_PASSE, politiqueLue: true })
    expect(window.location.href).not.toContain(MOT_DE_PASSE)
    expect(screen.queryByLabelText(T.motDePasse)).toBeNull()
  })

  it('207 liaison incomplète : le compte existe, message dédié (le cabinet est prévenu)', async () => {
    simulerFetch(routeur(() => json({ error: 'liaison_incomplete' }, 207)))
    render(<InvitationAccesQr identifiant="cabinet-exemple" />)
    await remplirFormulaire()
    expect(await screen.findByText(T.liaisonIncomplete)).toBeInTheDocument()
  })

  it.each([
    [409, 'compte_autre_espace', T.autreEspace],
    [409, 'deja_ouvert', T.dejaOuvert],
    [410, 'expire', T.expire],
    [404, 'introuvable', T.invalide],
  ])('refus %i %s : message définitif, formulaire retiré', async (status, code, message) => {
    simulerFetch(routeur(() => json({ error: code }, status)))
    render(<InvitationAccesQr identifiant="cabinet-exemple" />)
    await remplirFormulaire()
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByLabelText(T.motDePasse)).toBeNull()
  })

  it.each([400, 422])('%i (mot de passe refusé par le serveur ou par la politique de Supabase Auth) : message, formulaire gardé', async (status) => {
    simulerFetch(routeur(() => json({ error: 'invalide' }, status)))
    render(<InvitationAccesQr identifiant="cabinet-exemple" />)
    await remplirFormulaire()
    expect(await screen.findByText(T.erreurs.refuse)).toBeInTheDocument()
    expect(screen.getByLabelText(T.motDePasse)).toBeInTheDocument()
  })

  it('relecture 5 du lot 6 : compte existant dont le mot de passe n’a pas changé : message dédié et lien vers la connexion', async () => {
    simulerFetch(routeur(() => json({ acces: 'ouvert', compte: 'existant' })))
    render(<InvitationAccesQr identifiant="cabinet-exemple" />)
    await remplirFormulaire()
    expect(await screen.findByText(T.ouvertCompteExistant)).toBeInTheDocument()
    expect(screen.queryByText(T.ouvert)).toBeNull()
    expect(screen.getByRole('link', { name: T.seConnecter })).toHaveAttribute('href', '/cabinet-exemple/connexion/')
  })

  it('réseau coupé : toast et message, formulaire gardé (on peut réessayer)', async () => {
    simulerFetch((url) => {
      if (url.endsWith('/lecture')) return lectureOk()
      throw new TypeError('Failed to fetch')
    })
    render(<InvitationAccesQr identifiant="cabinet-exemple" />)
    await remplirFormulaire()
    await waitFor(() => expect(simul.toastErreur).toHaveBeenCalledWith(T.reseau))
    expect(screen.getByText(T.reseau)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: T.ouvrir })).toBeInTheDocument()
  })
})

describe('« Ce n’est pas moi »', () => {
  it('une confirmation d’abord (rien n’est envoyé), puis la contestation', async () => {
    simulerFetch(routeur(() => json({ contestee: true })))
    render(<InvitationAccesQr identifiant="cabinet-exemple" />)
    fireEvent.click(await screen.findByRole('button', { name: T.pasMoi }))
    expect(screen.getByText(T.pasMoiAvertissement)).toBeInTheDocument()
    expect(appels).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: T.annuler }))
    expect(screen.getByRole('button', { name: T.ouvrir })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: T.pasMoi }))
    fireEvent.click(screen.getByRole('button', { name: T.confirmerPasMoi }))
    expect(await screen.findByText(T.contestee)).toBeInTheDocument()
    expect(appels.map((a) => a.url)).toEqual(['/api/aj-signalement/invitation/lecture', '/api/aj-signalement/invitation/refus'])
    expect(appels[1].corps).toEqual({ token: TOKEN, cabinet: 'cabinet-exemple' })
  })
})
