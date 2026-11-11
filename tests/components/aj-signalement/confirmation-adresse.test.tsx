// tests/components/aj-signalement/confirmation-adresse.test.tsx
//
// Page publique de confirmation d'adresse d'un gestionnaire (vitfix.io/<identifiant>/confirmation-adresse/#<jeton>,
// SPEC § 1.7.4) : le jeton du lien est lu dans l'ancre puis EFFACÉ de l'adresse avant tout appel ; l'ouverture ne fait
// qu'une lecture sans effet (un antivirus qui ouvre le lien ne confirme rien) ; « C'est moi » confirme ; « Ce n'est pas
// moi » demande une confirmation puis conteste ; messages 404 / 409 / 410 ; réseau coupé → message et toast.

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEXTES_CONFIRMATION_QR as C } from '@/lib/aj-signalement/affichage-gestion'
import { remplir } from '@/lib/coproprietaire/textes'

const simul = vi.hoisted(() => ({ toastErreur: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: simul.toastErreur, success: vi.fn() } }))

const { default: ConfirmationAdresseQr } = await import('@/components/aj-signalement/ConfirmationAdresseQr')

const TOKEN = `${'a'.repeat(48)}.${'b'.repeat(64)}`
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

const lectureOk = () => json({ nomCourt: 'Marie M.', cabinet: 'Cabinet Exemple', email: 'ma***@exemple.test' })

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', `/cabinet-exemple/confirmation-adresse/#${TOKEN}`)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ouverture du lien', () => {
  it('l’ancre est effacée AVANT tout appel ; seule la lecture (sans effet) part, avec le cabinet du chemin', async () => {
    simulerFetch(() => lectureOk())
    render(<ConfirmationAdresseQr identifiant="cabinet-exemple" />)
    expect(await screen.findByText(remplir(C.presentation, { nomCourt: 'Marie M.', cabinet: 'Cabinet Exemple', email: 'ma***@exemple.test' }))).toBeInTheDocument()
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/cabinet-exemple/confirmation-adresse/')
    expect(appels).toHaveLength(1)
    expect(appels[0].url).toBe('/api/aj-signalement/confirmation/lecture')
    expect(appels[0].corps).toEqual({ token: TOKEN, cabinet: 'cabinet-exemple' })
    expect(appels[0].ancreAuMomentDeLAppel).toBe('')
    expect(screen.getByRole('heading', { level: 1, name: C.titre })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: C.cestMoi })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: C.pasMoi })).toBeInTheDocument()
  })

  it('sans ancre (ou ancre hors format) : « Ce lien n’est pas valable », aucun appel', async () => {
    simulerFetch(() => lectureOk())
    window.history.replaceState(null, '', '/cabinet-exemple/confirmation-adresse/#pas-un-jeton')
    render(<ConfirmationAdresseQr identifiant="cabinet-exemple" />)
    expect(await screen.findByText(C.invalide)).toBeInTheDocument()
    expect(window.location.hash).toBe('')
    expect(appels).toEqual([])
  })

  it.each([
    [404, { error: 'introuvable' }, C.invalide],
    [409, { error: 'deja_confirmee' }, C.dejaConfirmee],
    [410, { error: 'expire' }, C.expire],
  ])('lecture %i : message adapté, aucun bouton', async (status, corps, message) => {
    simulerFetch(() => json(corps, status))
    render(<ConfirmationAdresseQr identifiant="cabinet-exemple" />)
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: C.cestMoi })).toBeNull()
  })

  it('réseau coupé : message, toast et « Réessayer » (le jeton reste en mémoire)', async () => {
    let premier = true
    simulerFetch(() => {
      if (premier) { premier = false; throw new TypeError('Failed to fetch') }
      return lectureOk()
    })
    render(<ConfirmationAdresseQr identifiant="cabinet-exemple" />)
    expect(await screen.findByText(C.reseau)).toBeInTheDocument()
    expect(simul.toastErreur).toHaveBeenCalledWith(C.reseau)
    fireEvent.click(screen.getByRole('button', { name: C.reessayer }))
    expect(await screen.findByRole('button', { name: C.cestMoi })).toBeInTheDocument()
    expect(appels.map((a) => a.corps)).toEqual([{ token: TOKEN, cabinet: 'cabinet-exemple' }, { token: TOKEN, cabinet: 'cabinet-exemple' }])
  })

  it('React.StrictMode (effets joués deux fois en développement) : le jeton lu une fois, une seule lecture, jamais « pas valable »', async () => {
    simulerFetch(() => lectureOk())
    render(<React.StrictMode><ConfirmationAdresseQr identifiant="cabinet-exemple" /></React.StrictMode>)
    expect(await screen.findByRole('button', { name: C.cestMoi })).toBeInTheDocument()
    expect(screen.queryByText(C.invalide)).toBeNull()
    expect(new Set(appels.map((a) => JSON.stringify(a.corps)))).toEqual(new Set([JSON.stringify({ token: TOKEN, cabinet: 'cabinet-exemple' })]))
  })
})

describe('rendu serveur puis hydratation (relecture 5 et 6)', () => {
  it('HTML du serveur neutre (« vérification », jamais « pas valable ») ; hydratation SANS erreur avec une ancre valable', async () => {
    simulerFetch(() => lectureOk())
    const { renderToString } = await import('react-dom/server')
    const { hydrateRoot } = await import('react-dom/client')
    // Rendu serveur (Next, OpenNext) : aucun window, comme sur le Worker.
    const fenetre = globalThis.window
    Reflect.deleteProperty(globalThis, 'window')
    let html = ''
    try {
      html = renderToString(<ConfirmationAdresseQr identifiant="cabinet-exemple" />)
    } finally {
      globalThis.window = fenetre
    }
    expect(html).toContain(C.verification)
    expect(html).not.toContain(C.invalide)

    // Navigateur : l'adresse porte un jeton valable ; le HTML du serveur est hydraté.
    const conteneur = document.createElement('div')
    conteneur.innerHTML = html
    document.body.appendChild(conteneur)
    const erreurs: string[] = []
    const ancien = (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
    const racine = await React.act(async () => hydrateRoot(conteneur, <ConfirmationAdresseQr identifiant="cabinet-exemple" />, {
      onRecoverableError: (e) => { erreurs.push(e instanceof Error ? e.message.slice(0, 120) : String(e)) },
    }))
    try {
      await waitFor(() => expect(conteneur.textContent).toContain('Marie M.'))
      expect(erreurs).toEqual([])
      expect(window.location.hash).toBe('')
      expect(appels.map((a) => a.ancreAuMomentDeLAppel)).toEqual([''])
    } finally {
      await React.act(async () => racine.unmount())
      conteneur.remove()
      ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = ancien
    }
  })
})

describe('réponse de la personne', () => {
  it('« C’est moi » : confirmation, puis le message de succès', async () => {
    simulerFetch((url) => (url.endsWith('/lecture') ? lectureOk() : json({ confirmee: true })))
    render(<ConfirmationAdresseQr identifiant="cabinet-exemple" />)
    fireEvent.click(await screen.findByRole('button', { name: C.cestMoi }))
    expect(await screen.findByText(C.confirmee)).toBeInTheDocument()
    expect(appels.map((a) => a.url)).toEqual(['/api/aj-signalement/confirmation/lecture', '/api/aj-signalement/confirmation'])
    expect(appels[1].corps).toEqual({ token: TOKEN, cabinet: 'cabinet-exemple' })
    expect(screen.queryByRole('button', { name: C.pasMoi })).toBeNull()
  })

  it('« Ce n’est pas moi » : une confirmation d’abord (rien n’est envoyé), puis la contestation', async () => {
    simulerFetch((url) => (url.endsWith('/lecture') ? lectureOk() : json({ contestee: true })))
    render(<ConfirmationAdresseQr identifiant="cabinet-exemple" />)
    fireEvent.click(await screen.findByRole('button', { name: C.pasMoi }))
    expect(screen.getByText(C.pasMoiAvertissement)).toBeInTheDocument()
    expect(appels).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: C.annuler }))
    expect(screen.getByRole('button', { name: C.cestMoi })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: C.pasMoi }))
    fireEvent.click(screen.getByRole('button', { name: C.confirmerPasMoi }))
    expect(await screen.findByText(C.contestee)).toBeInTheDocument()
    expect(appels.map((a) => a.url)).toEqual(['/api/aj-signalement/confirmation/lecture', '/api/aj-signalement/confirmation/refus'])
    expect(appels[1].corps).toEqual({ token: TOKEN, cabinet: 'cabinet-exemple' })
  })

  it.each([
    [404, 'introuvable', C.invalide],
    [409, 'deja_confirmee', C.dejaConfirmee],
    [410, 'expire', C.expire],
  ])('confirmation refusée (%i %s) : message adapté', async (status, code, message) => {
    simulerFetch((url) => (url.endsWith('/lecture') ? lectureOk() : json({ error: code }, status)))
    render(<ConfirmationAdresseQr identifiant="cabinet-exemple" />)
    fireEvent.click(await screen.findByRole('button', { name: C.cestMoi }))
    await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument())
  })
})
