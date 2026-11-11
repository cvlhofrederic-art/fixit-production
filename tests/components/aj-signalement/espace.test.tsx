// tests/components/aj-signalement/espace.test.tsx
//
// Espace indépendant « AJ Signalement » (/fr/aj-signalement/, demandes de Hugo du 10 et du 11/11/2026), côté navigateur :
// - garde : session validée auprès de Supabase (getUser) puis decisionAccesEspaceQr(app_metadata) ; aucune donnée
//   chargée avant (fetch jamais appelé en chargement, sans session, en refus ni en session indisponible) ;
// - sans session ou autre compte : renvoi vers la page de connexion professionnelle de l'espace
//   (/fr/aj-signalement/connexion/, ancre comprise ; message neutre là-bas), sans menu ni donnée, jamais la page de
//   connexion générale ; session indisponible : message et Réessayer, sans redirection ni rechargement ;
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
import { gestionCoproprieteQrVide, type TableauQr } from '@/lib/aj-signalement/types'

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
    creeLe: '2026-11-04T10:00:00.000Z', nbSignalements: 0, nbEnAttente: 0, derniereAdresseProposee: null, ...gestionCoproprieteQrVide(),
  }],
  signalements: [],
})

const GESTIONNAIRE_ID = '11111111-1111-4111-8111-111111111111'
const CABINET = { id: 'a0000000-0000-4000-8000-0000000000a1', nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }
const marie = {
  id: GESTIONNAIRE_ID, nom: 'Marie Exemple', cabinet: CABINET, email: 'marie.exemple@exemple.test', etat: 'adresse_confirmee', domaineForce: false,
  coproprietes: 0, ouverts: 0, urgents: 0, creeLe: '2026-11-01T09:00:00.000Z', confirmeeLe: '2026-11-02T09:00:00.000Z',
}

/** Réponses des routes de l'espace (tableau, cabinets, fiches, page profil). */
function reponseSimulee(url: string): unknown {
  if (url.startsWith('/api/aj-signalement/tableau')) return { tableau: tableau() }
  if (url === '/api/aj-signalement/cabinets') return { cabinets: [{ ...CABINET, langue: 'fr', domaines: ['exemple.test'], identifiantFige: true, nbCoproprietes: 0, nbGestionnaires: 1 }] }
  if (url.startsWith('/api/aj-signalement/gestionnaires?')) return { gestionnaires: [marie] }
  if (url === `/api/aj-signalement/gestionnaires/${GESTIONNAIRE_ID}`) return { gestionnaire: marie, envois: [], attributions: [], creations: [], journal: [] }
  if (url.startsWith('/api/aj-signalement/journal')) return { evenements: [], suite: null }
  return {}
}

let appelsFetch: string[] = []
const appelsTableau = () => appelsFetch.filter((u) => u === '/api/aj-signalement/tableau')
const utilisateur = (app_metadata: Record<string, unknown>, user_metadata: Record<string, unknown> = {}) =>
  ({ data: { user: { id: 'u1', email: 'admin@example.com', app_metadata, user_metadata } }, error: null })

// Navigation simulée (redirections vers la connexion, déconnexion) : jsdom ne navigue pas. Chaque navigation est notée
// avec sa méthode (« replace … », « assign … », « reload ») : les renvois doivent REMPLACER l'adresse (« retour » ne
// ramène ni sur la garde ni dans l'espace d'une session fermée), et non l'ajouter à l'historique par assign().
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
      assign: (destination: string) => { navigations.push(`assign ${destination}`) },
      replace: (destination: string) => { navigations.push(`replace ${destination}`) },
      reload: () => { navigations.push('reload') },
    },
  })
}
/** Navigation attendue : l'adresse remplacée par window.location.replace. */
const remplacement = (destination: string) => `replace ${destination}`

const menuLateral = () => screen.getAllByRole('navigation', { name: 'Menu AJ Signalement' })[0]
const titre = () => screen.getByRole('heading', { level: 1 })
// La session arrive de façon asynchrone : la coquille s'affiche hors act et son effet (écoute de popstate) peut être
// encore en attente quand le titre apparaît. On laisse les effets s'exécuter avant de simuler le bouton Retour, sinon
// l'événement peut partir avant l'écoute (échec intermittent sous charge, vu dès le lot 1).
const effetsPoses = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

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
    return new Response(JSON.stringify(reponseSimulee(url)), { status: 200, headers: { 'content-type': 'application/json' } })
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

  it('sans session : renvoi vers la connexion professionnelle de l’espace (ancre comprise), aucun appel', async () => {
    simulerLocation('/fr/aj-signalement/', '#signalements')
    simul.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() })
    render(<EspaceAjSignalement />)
    await waitFor(() => expect(navigations).toEqual([remplacement('/fr/aj-signalement/connexion/#signalements')]))
    expect(screen.getByRole('status')).toHaveTextContent('Redirection vers la page de connexion…')
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/fr/aj-signalement/connexion/')
    expect(appelsFetch).toEqual([])
  })

  it('sans session, en portugais : connexion de l’espace sous /pt/', async () => {
    simulerLocation('/pt/aj-signalement/')
    simul.getUser.mockResolvedValue({ data: { user: null }, error: null })
    render(<EspaceAjSignalement />)
    await waitFor(() => expect(navigations).toEqual([remplacement('/pt/aj-signalement/connexion/')]))
  })

  it.each([
    ['syndic', { role: 'syndic' }, {}],
    ['copropriétaire', { role: 'coproprio' }, {}],
    ['copropriétaire au user_metadata trafiqué', { role: 'coproprio' }, { role: 'super_admin', _original_role: 'super_admin' }],
  ])('compte %s : renvoi vers la connexion de l’espace (message neutre là-bas), sans menu ni donnée', async (_cas, app, user) => {
    simulerLocation('/fr/aj-signalement/', '#signalements')
    simul.getUser.mockResolvedValue(utilisateur(app, user))
    render(<EspaceAjSignalement />)
    await waitFor(() => expect(navigations).toEqual([remplacement('/fr/aj-signalement/connexion/#signalements')]))
    expect(screen.getByRole('status')).toHaveTextContent('Redirection vers la page de connexion…')
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.queryByText('Accès réservé')).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(document.body.textContent?.toLowerCase()).not.toContain('super')
    expect(appelsFetch).toEqual([])
    // La session n'est pas fermée ici : la page de connexion affiche le message neutre et propose un autre compte.
    expect(simul.signOut).not.toHaveBeenCalled()
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
  it('en-tête « AJ Signalement », menu à six entrées (cinq dans la barre du bas), vue Tableau de bord par défaut, un seul chargement', async () => {
    simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
    render(<EspaceAjSignalement />)
    await waitFor(() => expect(titre()).toHaveTextContent('Tableau de bord'))
    expect(screen.getAllByText('AJ Signalement').length).toBeGreaterThan(0)
    const entrees = within(menuLateral()).getAllByRole('link')
    expect(entrees.map((e) => e.textContent)).toEqual(['Tableau de bord', 'Copropriétés', 'Signalements', 'Gestionnaires', 'Cabinets', 'Journal'])
    expect(entrees.map((e) => e.getAttribute('href'))).toEqual(['#tableau-de-bord', '#coproprietes', '#signalements', '#gestionnaires', '#cabinets', '#journal'])
    expect(entrees[0]).toHaveAttribute('aria-current', 'page')
    expect(entrees[1]).not.toHaveAttribute('aria-current')
    const barreDuBas = screen.getAllByRole('navigation', { name: 'Menu AJ Signalement' })[1]
    expect(within(barreDuBas).getAllByRole('link').map((e) => e.textContent)).toEqual(['Tableau de bord', 'Copropriétés', 'Signalements', 'Gestionnaires', 'Cabinets'])
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
    // Un seul chargement du tableau ; la vue Copropriétés charge en plus, une fois, les cabinets et les fiches (fenêtre).
    expect(appelsTableau()).toEqual(['/api/aj-signalement/tableau'])
  })

  it('Gestionnaires : cabinets et fiches chargés une fois à la première visite ; la page profil par son ancre ; retour', async () => {
    simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
    render(<EspaceAjSignalement />)
    await waitFor(() => expect(screen.getByRole('region', { name: T.indicateurs })).toBeInTheDocument())
    await effetsPoses()
    fireEvent.click(within(menuLateral()).getByRole('link', { name: 'Gestionnaires' }))
    expect(window.location.hash).toBe('#gestionnaires')
    expect(titre()).toHaveTextContent('Gestionnaires')
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir' }))
    expect(window.location.hash).toBe(`#gestionnaire/${GESTIONNAIRE_ID}`)
    expect(await screen.findByRole('heading', { name: 'Marie Exemple', level: 2 })).toBeInTheDocument()
    expect(within(menuLateral()).getByRole('link', { name: 'Gestionnaires' })).toHaveAttribute('aria-current', 'page')
    expect(appelsFetch.filter((u) => u === '/api/aj-signalement/cabinets')).toHaveLength(1)
    expect(appelsFetch.filter((u) => u === '/api/aj-signalement/gestionnaires?etat=tous')).toHaveLength(1)
    expect(appelsFetch).toContain(`/api/aj-signalement/gestionnaires/${GESTIONNAIRE_ID}`)
    expect(appelsTableau()).toEqual(['/api/aj-signalement/tableau'])

    window.history.replaceState(null, '', '/fr/aj-signalement/#gestionnaires')
    await act(async () => { window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(await screen.findByRole('button', { name: 'Ouvrir' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Marie Exemple', level: 2 })).toBeNull()
  })

  it('ouverture sur #gestionnaire/<uuid> (lien de l’alerte « adresse contestée ») : la page profil', async () => {
    window.history.replaceState(null, '', `/fr/aj-signalement/#gestionnaire/${GESTIONNAIRE_ID}`)
    simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
    render(<EspaceAjSignalement />)
    expect(await screen.findByRole('heading', { name: 'Marie Exemple', level: 2 })).toBeInTheDocument()
    expect(titre()).toHaveTextContent('Gestionnaires')
  })

  it('Cabinets puis Journal : chaque vue s’affiche dans la même coquille', async () => {
    simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
    render(<EspaceAjSignalement />)
    await waitFor(() => expect(titre()).toHaveTextContent('Tableau de bord'))
    fireEvent.click(within(menuLateral()).getByRole('link', { name: 'Cabinets' }))
    expect(await screen.findByRole('heading', { name: 'Cabinet Exemple' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Voir le journal' }))
    expect(window.location.hash).toBe('#journal')
    expect(titre()).toHaveTextContent('Journal')
    await waitFor(() => expect(appelsFetch).toContain('/api/aj-signalement/journal'))
    expect(screen.queryByRole('region', { name: T.indicateurs })).toBeNull()
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

  it('« vue en tant que » ouverte par un super admin : refusée (même règle que les routes, 11/11/2026), renvoi vers la connexion, aucune donnée', async () => {
    simulerLocation('/fr/aj-signalement/')
    simul.getUser.mockResolvedValue(utilisateur({ role: 'coproprio', _original_role: 'super_admin' }))
    render(<EspaceAjSignalement />)
    await waitFor(() => expect(navigations).toEqual([remplacement('/fr/aj-signalement/connexion/')]))
    expect(appelsFetch).toEqual([])
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
  it('« Se déconnecter » : fermeture de la session puis page de connexion de l’espace', async () => {
    simulerLocation('/fr/aj-signalement/')
    simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
    render(<EspaceAjSignalement />)
    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))
    await waitFor(() => expect(navigations).toEqual([remplacement('/fr/aj-signalement/connexion/')]))
    expect(simul.signOut).toHaveBeenCalledTimes(1)
  })

  it('« Se déconnecter » en portugais : connexion de l’espace sous /pt/', async () => {
    simulerLocation('/pt/aj-signalement/')
    simul.getUser.mockResolvedValue(utilisateur({ role: 'super_admin' }))
    render(<EspaceAjSignalement />)
    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))
    await waitFor(() => expect(navigations).toEqual([remplacement('/pt/aj-signalement/connexion/')]))
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
    await waitFor(() => expect(navigations).toEqual([remplacement('/fr/aj-signalement/connexion/')]))
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})

// ── PR 2, lot 4 : garde de l'espace d'un cabinet (vitfix.io/<identifiant>/suivi/) ───────────────────────────────────
// La garde reçoit le cabinet de la page : seul un gestionnaire de CE cabinet (rôle serveur + repère de routage) entre ;
// tout autre cas renvoie vers la connexion DU CABINET (/<identifiant>/connexion/, ancre comprise), jamais vers celle de
// l'espace global (sinon boucle avec l'aiguillage du middleware). Les écrans propres au gestionnaire viennent au lot 5 :
// ici, la coquille à trois entrées et aucun appel aux routes réservées au super admin (cabinets, fiches).
describe('espace d’un cabinet : garde et coquille du gestionnaire', () => {
  const CABINET_PAGE = { identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple' }
  const gestionnaire = (repere: string) => utilisateur({ role: 'gestionnaire_signalement', aj_signalement_cabinet: repere })

  it('gestionnaire de CE cabinet : coquille à trois entrées (barre du bas comprise), tableau seul chargé, ni panneau admin ni import', async () => {
    window.history.replaceState(null, '', '/cabinet-exemple/suivi/')
    simul.getUser.mockResolvedValue(gestionnaire('cabinet-exemple'))
    render(<EspaceAjSignalement cabinet={CABINET_PAGE} />)
    await waitFor(() => expect(titre()).toHaveTextContent('Tableau de bord'))
    expect(within(menuLateral()).getAllByRole('link').map((e) => e.textContent)).toEqual(['Tableau de bord', 'Copropriétés', 'Signalements'])
    const barreDuBas = screen.getAllByRole('navigation', { name: 'Menu AJ Signalement' })[1]
    expect(within(barreDuBas).getAllByRole('link').map((e) => e.textContent)).toEqual(['Tableau de bord', 'Copropriétés', 'Signalements'])
    expect(screen.queryByRole('link', { name: 'Panneau admin' })).toBeNull()
    await waitFor(() => expect(screen.getByRole('region', { name: T.indicateurs })).toBeInTheDocument())
    fireEvent.click(within(menuLateral()).getByRole('link', { name: 'Copropriétés' }))
    expect(await screen.findByRole('heading', { name: 'Parc Belle Ombre' })).toBeInTheDocument()
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    // Aucune route du super admin (cabinets, fiches des gestionnaires) : 403 pour un gestionnaire.
    expect(appelsFetch).toEqual(['/api/aj-signalement/tableau'])
    expect(screen.queryByRole('button', { name: /Importer/ })).toBeNull()
  })

  it('ancre d’une vue du super admin (#journal) : la vue par défaut du gestionnaire', async () => {
    window.history.replaceState(null, '', '/cabinet-exemple/suivi/#journal')
    simul.getUser.mockResolvedValue(gestionnaire('cabinet-exemple'))
    render(<EspaceAjSignalement cabinet={CABINET_PAGE} />)
    await waitFor(() => expect(titre()).toHaveTextContent('Tableau de bord'))
    expect(appelsFetch.filter((u) => u.startsWith('/api/aj-signalement/journal'))).toEqual([])
  })

  it.each([
    ['sans session', null],
    ['gestionnaire d’un autre cabinet', { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'autre-cabinet' }],
    ['gestionnaire sans repère', { role: 'gestionnaire_signalement' }],
    ['super admin (son espace est global : la connexion du cabinet l’y renvoie)', { role: 'super_admin' }],
    ['client', { role: 'client' }],
  ])('%s : renvoi vers la connexion du cabinet (ancre comprise), aucune donnée', async (_cas, app) => {
    simulerLocation('/cabinet-exemple/suivi/', '#signalements')
    simul.getUser.mockResolvedValue(app ? utilisateur(app) : { data: { user: null }, error: new AuthSessionMissingError() })
    render(<EspaceAjSignalement cabinet={CABINET_PAGE} />)
    await waitFor(() => expect(navigations).toEqual([remplacement('/cabinet-exemple/connexion/#signalements')]))
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/cabinet-exemple/connexion/')
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(appelsFetch).toEqual([])
  })

  it('« Se déconnecter » : fermeture de la session puis connexion du cabinet', async () => {
    simulerLocation('/cabinet-exemple/suivi/')
    simul.getUser.mockResolvedValue(gestionnaire('cabinet-exemple'))
    render(<EspaceAjSignalement cabinet={CABINET_PAGE} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))
    await waitFor(() => expect(navigations).toEqual([remplacement('/cabinet-exemple/connexion/')]))
    expect(simul.signOut).toHaveBeenCalledTimes(1)
  })

  it('espace global : un gestionnaire, même avec repère, n’entre pas (renvoi vers la connexion globale, qui l’aiguille)', async () => {
    simulerLocation('/fr/aj-signalement/')
    simul.getUser.mockResolvedValue(gestionnaire('cabinet-exemple'))
    render(<EspaceAjSignalement />)
    await waitFor(() => expect(navigations).toEqual([remplacement('/fr/aj-signalement/connexion/')]))
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(appelsFetch).toEqual([])
  })
})
