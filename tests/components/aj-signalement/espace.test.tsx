// tests/components/aj-signalement/espace.test.tsx
//
// Espace indépendant « AJ Signalement » (/fr/aj-signalement/, demande de Hugo du 10/11/2026), côté navigateur :
// - garde : session validée auprès de Supabase (getUser) puis decisionAccesEspaceQr(app_metadata) ; aucune donnée
//   chargée avant (fetch jamais appelé en chargement, sans session, en refus ni en session indisponible) ;
// - sans session : renvoi vers la page de connexion avec retour vers l'espace (ancre comprise) ;
// - autre compte : message neutre, sans menu ni donnée ; session indisponible : message et Réessayer, sans
//   redirection ni rechargement ;
// - super admin : en-tête « AJ Signalement », menu Tableau de bord / Copropriétés / Signalements (aria-current, ancres,
//   un h1 par vue, focus sur le titre, titre d'onglet), un seul chargement du tableau malgré les changements de vue ;
// - retour du navigateur : la vue suit l'ancre (sans ancre : Tableau de bord) ; une ancre qui ne désigne aucune vue
//   (lien d'évitement #main-content) laisse la vue en cours ; une fenêtre ouverte se ferme ;
// - aucune lecture des sélecteurs de copropriété de l'AJ ni du portail (stockage du navigateur) ;
// - déconnexion (SIGNED_OUT d'un autre onglet compris) : retour à la page de connexion.

import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AuthSessionMissingError } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEXTES_TABLEAU_QR as T } from '@/lib/aj-signalement/affichage'
import type { TableauQr } from '@/lib/aj-signalement/types'

type Rappel = (evenement: string, session: unknown) => void

const simul = vi.hoisted(() => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
  rappels: [] as Array<(evenement: string, session: unknown) => void>,
  toastErreur: vi.fn(),
}))

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
vi.mock('sonner', () => ({ toast: { error: simul.toastErreur, success: vi.fn() } }))

const { default: EspaceAjSignalement } = await import('@/components/aj-signalement/espace/EspaceAjSignalement')

const tableau = (): TableauQr => ({
  coproprietes: [{
    id: 'c1', nom: 'Parc Belle Ombre', adresse: 'Marseille', jeton: '0123456789abcdef0123456789abcdef', emailsDestinataires: [], actif: true,
    creeLe: '2026-11-04T10:00:00.000Z', nbSignalements: 0, nbEnAttente: 0, derniereAdresseProposee: null,
  }],
  signalements: [],
})

let appelsFetch: string[] = []
const utilisateur = (app_metadata: Record<string, unknown>, user_metadata: Record<string, unknown> = {}) =>
  ({ data: { user: { id: 'u1', email: 'admin@example.com', app_metadata, user_metadata } }, error: null })

// Navigation simulée (redirections vers la connexion, déconnexion) : jsdom ne navigue pas.
let navigations: string[] = []
let descripteurLocation: PropertyDescriptor | undefined
function simulerLocation(pathname: string, hash = '') {
  navigations = []
  descripteurLocation = Object.getOwnPropertyDescriptor(window, 'location')
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      origin: 'https://vitfix.io', pathname, search: '', hash,
      href: `https://vitfix.io${pathname}${hash}`,
      assign: (destination: string) => { navigations.push(destination) },
      replace: (destination: string) => { navigations.push(destination) },
      reload: () => { navigations.push('rechargement') },
    },
  })
}

const menuLateral = () => screen.getAllByRole('navigation', { name: 'Menu AJ Signalement' })[0]
const titre = () => screen.getByRole('heading', { level: 1 })

/** Retour du navigateur : l'adresse change, puis popstate. */
async function revenirA(adresse: string) {
  window.history.replaceState(null, '', adresse)
  await act(async () => { window.dispatchEvent(new PopStateEvent('popstate')) })
}

/**
 * Super admin arrivé par le lien de l'e-mail (#signalements), vue Signalements affichée. Le titre d'onglet est posé
 * par l'effet qui suit celui de l'écoute de popstate : l'attendre garantit que le retour du navigateur sera entendu
 * (sinon, sur une machine chargée, popstate partait parfois avant l'effet et le test échouait au hasard).
 */
async function ouvrirSurSignalements() {
  window.history.replaceState(null, '', '/fr/aj-signalement/#signalements')
  document.title = ''
  simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
  render(<EspaceAjSignalement />)
  await waitFor(() => expect(titre()).toHaveTextContent('Signalements'))
  await waitFor(() => expect(document.title).toBe('Signalements — AJ Signalement'))
}

beforeEach(() => {
  vi.clearAllMocks()
  simul.rappels = []
  simul.signOut.mockResolvedValue({ error: null })
  appelsFetch = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    appelsFetch.push(url)
    return new Response(JSON.stringify({ tableau: tableau() }), { status: 200, headers: { 'content-type': 'application/json' } })
  }))
  window.history.replaceState(null, '', '/fr/aj-signalement/')
})

afterEach(() => {
  vi.unstubAllGlobals()
  if (descripteurLocation) Object.defineProperty(window, 'location', descripteurLocation)
  descripteurLocation = undefined
})

describe('garde de l’espace : aucune donnée avant le contrôle de rôle', () => {
  it('vérification en cours : message d’attente (role=status), aucun appel, aucun menu', async () => {
    simul.getUser.mockReturnValue(new Promise(() => {}))
    render(<EspaceAjSignalement />)
    expect(screen.getByRole('status')).toHaveTextContent('Vérification de l’accès…')
    // Zone d'état native : <output> (rôle status implicite) affiché en bloc, comme l'ancien div.
    expect(screen.getByRole('status').tagName).toBe('OUTPUT')
    expect(screen.getByRole('status')).toHaveClass('block', 'text-center')
    expect(screen.queryByRole('navigation')).toBeNull()
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    expect(appelsFetch).toEqual([])
  })

  it('sans session : renvoi vers la connexion avec retour vers l’espace (ancre comprise), aucun appel', async () => {
    simulerLocation('/fr/aj-signalement/', '#signalements')
    simul.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() })
    render(<EspaceAjSignalement />)
    await waitFor(() => expect(navigations).toEqual(['/fr/auth/login/?retour=%2Ffr%2Faj-signalement%2F#signalements']))
    expect(screen.getByRole('status')).toHaveTextContent('Redirection vers la page de connexion…')
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/fr/auth/login/?retour=%2Ffr%2Faj-signalement%2F')
    expect(appelsFetch).toEqual([])
  })

  it('sans session, en portugais : page de connexion /pt/ et retour vers /pt/aj-signalement/', async () => {
    simulerLocation('/pt/aj-signalement/')
    simul.getUser.mockResolvedValue({ data: { user: null }, error: null })
    render(<EspaceAjSignalement />)
    await waitFor(() => expect(navigations).toEqual(['/pt/auth/login/?retour=%2Fpt%2Faj-signalement%2F']))
  })

  it.each([
    ['syndic', { role: 'syndic' }, {}],
    ['copropriétaire', { role: 'coproprio' }, {}],
    ['copropriétaire au user_metadata trafiqué', { role: 'coproprio' }, { role: 'super_admin', _original_role: 'super_admin' }],
  ])('compte %s : message neutre, sans menu ni donnée ni redirection', async (_cas, app, user) => {
    simulerLocation('/fr/aj-signalement/')
    simul.getUser.mockResolvedValue(utilisateur(app, user))
    render(<EspaceAjSignalement />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Accès réservé' })).toBeInTheDocument()
    expect(screen.getByText('Cet espace n’est pas accessible avec votre compte.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(document.body.textContent?.toLowerCase()).not.toContain('super')
    expect(appelsFetch).toEqual([])
    expect(navigations).toEqual([])
  })

  it('session indisponible (réseau) : message et Réessayer, ni redirection ni rechargement ; Réessayer relance la vérification', async () => {
    simulerLocation('/fr/aj-signalement/')
    simul.getUser.mockRejectedValueOnce(new Error('réseau coupé'))
    render(<EspaceAjSignalement />)
    expect(await screen.findByText(/n’a pas pu être vérifiée/)).toBeInTheDocument()
    expect(navigations).toEqual([])
    expect(appelsFetch).toEqual([])
    simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(titre()).toHaveTextContent('Tableau de bord'))
    expect(navigations).toEqual([])
  })
})

describe('super admin : coquille de l’espace', () => {
  it('en-tête « AJ Signalement », menu à trois entrées, vue Tableau de bord par défaut, un seul chargement', async () => {
    simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
    render(<EspaceAjSignalement />)
    await waitFor(() => expect(titre()).toHaveTextContent('Tableau de bord'))
    expect(screen.getAllByText('AJ Signalement').length).toBeGreaterThan(0)
    const entrees = within(menuLateral()).getAllByRole('link')
    expect(entrees.map((e) => e.textContent)).toEqual(['Tableau de bord', 'Copropriétés', 'Signalements'])
    expect(entrees.map((e) => e.getAttribute('href'))).toEqual(['#tableau-de-bord', '#coproprietes', '#signalements'])
    expect(entrees[0]).toHaveAttribute('aria-current', 'page')
    expect(entrees[1]).not.toHaveAttribute('aria-current')
    expect(screen.queryByText('Gestionnaires')).toBeNull()
    await waitFor(() => expect(screen.getByRole('region', { name: T.indicateurs })).toBeInTheDocument())
    expect(document.title).toBe('Tableau de bord — AJ Signalement')
    expect(appelsFetch).toEqual(['/api/aj-signalement/tableau'])
  })

  it('changement de vue : ancre, aria-current, h1 et focus sur le titre, titre d’onglet ; toujours un seul chargement', async () => {
    simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
    render(<EspaceAjSignalement />)
    await waitFor(() => expect(screen.getByRole('region', { name: T.indicateurs })).toBeInTheDocument())

    fireEvent.click(within(menuLateral()).getByRole('link', { name: 'Signalements' }))
    expect(window.location.hash).toBe('#signalements')
    expect(titre()).toHaveTextContent('Signalements')
    expect(document.activeElement).toBe(titre())
    expect(within(menuLateral()).getByRole('link', { name: 'Signalements' })).toHaveAttribute('aria-current', 'page')
    expect(document.title).toBe('Signalements — AJ Signalement')
    // Filtre par copropriété toujours visible, même avec une seule copropriété.
    expect(screen.getByLabelText(T.filtrerCopro)).toBeInTheDocument()

    fireEvent.click(within(menuLateral()).getByRole('link', { name: 'Copropriétés' }))
    expect(window.location.hash).toBe('#coproprietes')
    expect(titre()).toHaveTextContent('Copropriétés')
    expect(screen.getByRole('heading', { name: 'Parc Belle Ombre' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: T.ajouterCopro })).toBeInTheDocument()

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(appelsFetch).toEqual(['/api/aj-signalement/tableau'])
  })

  it('ancre à l’ouverture (#signalements, lien de l’e-mail) : vue Signalements ; retour du navigateur suivi', async () => {
    await ouvrirSurSignalements()
    await revenirA('/fr/aj-signalement/#coproprietes')
    expect(titre()).toHaveTextContent('Copropriétés')
  })

  it('ancre qui ne désigne aucune vue (lien d’évitement #main-content) : la vue en cours reste', async () => {
    await ouvrirSurSignalements()
    await revenirA('/fr/aj-signalement/#main-content')
    expect(titre()).toHaveTextContent('Signalements')
    expect(document.title).toBe('Signalements — AJ Signalement')
    expect(within(menuLateral()).getByRole('link', { name: 'Signalements' })).toHaveAttribute('aria-current', 'page')
    expect(document.activeElement).not.toBe(titre())
  })

  it('retour du navigateur sans ancre (/fr/aj-signalement/) : Tableau de bord', async () => {
    await ouvrirSurSignalements()
    await revenirA('/fr/aj-signalement/')
    expect(titre()).toHaveTextContent('Tableau de bord')
  })

  it('retour du navigateur avec une fenêtre ouverte : la fenêtre se ferme, le focus va au titre de la nouvelle vue', async () => {
    simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
    render(<EspaceAjSignalement />)
    await waitFor(() => expect(screen.getByRole('region', { name: T.indicateurs })).toBeInTheDocument())
    fireEvent.click(within(menuLateral()).getByRole('link', { name: 'Copropriétés' }))
    fireEvent.click(await screen.findByRole('button', { name: T.ajouterCopro }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await revenirA('/fr/aj-signalement/#tableau-de-bord')
    expect(titre()).toHaveTextContent('Tableau de bord')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(titre())
  })

  it('« vue en tant que » ouverte par un super admin : espace ouvert', async () => {
    simul.getUser.mockResolvedValue(utilisateur({ role: 'coproprio', _original_role: 'super_admin' }))
    render(<EspaceAjSignalement />)
    await waitFor(() => expect(titre()).toHaveTextContent('Tableau de bord'))
  })

  it('n’utilise ni le sélecteur de copropriété de l’AJ ni celui du portail', async () => {
    localStorage.setItem('vitfix.aj.dossierEnCours', JSON.stringify('BELLE-OMBRE'))
    localStorage.setItem('vitfix.liaison.copro-aj.source', 'aj')
    const lectures = vi.spyOn(Storage.prototype, 'getItem')
    simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
    render(<EspaceAjSignalement />)
    await waitFor(() => expect(screen.getByRole('region', { name: T.indicateurs })).toBeInTheDocument())
    const cles = lectures.mock.calls.map(([cle]) => cle)
    expect(cles.filter((cle) => cle.startsWith('vitfix.aj.') || cle.startsWith('vitfix.liaison.'))).toEqual([])
    lectures.mockRestore()
    localStorage.clear()
  })
})

describe('déconnexion', () => {
  it('« Se déconnecter » : fermeture de la session puis page de connexion', async () => {
    simulerLocation('/fr/aj-signalement/')
    simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
    render(<EspaceAjSignalement />)
    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))
    await waitFor(() => expect(navigations).toEqual(['/fr/auth/login/']))
    expect(simul.signOut).toHaveBeenCalledTimes(1)
  })

  it('échec de la déconnexion : message (toast), on reste dans l’espace', async () => {
    simulerLocation('/fr/aj-signalement/')
    simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
    simul.signOut.mockResolvedValue({ error: new Error('réseau') })
    render(<EspaceAjSignalement />)
    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))
    await waitFor(() => expect(simul.toastErreur).toHaveBeenCalledWith('La déconnexion a échoué. Réessayez.'))
    expect(navigations).toEqual([])
  })

  it('déconnexion depuis un autre onglet (SIGNED_OUT) : renvoi vers la connexion', async () => {
    simulerLocation('/fr/aj-signalement/')
    simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
    render(<EspaceAjSignalement />)
    await waitFor(() => expect(titre()).toHaveTextContent('Tableau de bord'))
    await act(async () => { simul.rappels.forEach((rappel) => rappel('SIGNED_OUT', null)) })
    await waitFor(() => expect(navigations).toEqual(['/fr/auth/login/?retour=%2Ffr%2Faj-signalement%2F']))
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})
