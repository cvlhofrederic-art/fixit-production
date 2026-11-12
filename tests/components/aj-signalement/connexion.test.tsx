// tests/components/aj-signalement/connexion.test.tsx
//
// Page de connexion professionnelle de l'espace « AJ Signalement » (/fr/aj-signalement/connexion/), demande de Hugo du
// 11/11/2026 : « je ne veux pas que l'on puisse taper Particulier […] il faut taper professionnel avec le mail et mot de
// passe pour se connecter ».
// - e-mail + mot de passe, « Mot de passe oublié ? » ; ni Particulier / Artisan / Pro, ni Google, ni « Créer un compte » ;
// - saisie vérifiée avant tout appel, erreurs reliées aux champs (aria-invalid, aria-describedby), focus sur le
//   premier champ en erreur ;
// - compte admis : arrivée dans l'espace (ancre d'une vue comprise), adresse REMPLACÉE ; compte sans accès : message
//   neutre annoncé (role=alert) et focalisé, session que la page vient d'ouvrir fermée (portée locale), aucune navigation ;
// - erreurs de Supabase : trois messages qui ne disent jamais si l'adresse existe ; journal sans e-mail ni mot de passe ;
// - au chargement (secours sans middleware) : session admise → espace ; session sans accès → message neutre (status) ;
// - « Mot de passe oublié » dans la page (POST /api/auth/reset-password), aucun lien vers les pages communes /auth/… ;
// - réutilisable pour l'espace d'un cabinet (PR 2) : contexte en paramètre.
// Supabase, sonner et fetch sont simulés : aucune requête réelle, e-mails en @exemple.test, mot de passe fictif.

import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONTEXTE_CONNEXION_GLOBAL_QR, contexteConnexionCabinetQr, type ContexteConnexionQr } from '@/lib/aj-signalement/connexion-espace'

const simul = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  toastErreur: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: simul.getUser,
      signInWithPassword: simul.signInWithPassword,
      signOut: simul.signOut,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))
vi.mock('sonner', () => ({ toast: { error: simul.toastErreur, success: vi.fn() } }))

const { default: ConnexionEspaceQr } = await import('@/components/aj-signalement/espace/ConnexionEspaceQr')

const EMAIL = 'gestion@exemple.test'
const MOT_DE_PASSE = 'mot-de-passe-fictif'

// Chaque navigation est notée avec sa méthode (« replace … », « assign … », « reload ») : un test d'arrivée prouve que
// l'adresse est REMPLACÉE (« retour » ne ramène pas au formulaire), et non ajoutée à l'historique par assign().
let navigations: string[] = []
let descripteurLocation: PropertyDescriptor | undefined
function simulerLocation(pathname: string, hash = '') {
  navigations = []
  // Le descripteur d'origine seulement (un second appel dans le même test ne doit pas l'écraser).
  descripteurLocation ??= Object.getOwnPropertyDescriptor(window, 'location')
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

const compte = (app_metadata: Record<string, unknown>, user_metadata: Record<string, unknown> = {}) =>
  ({ id: 'u1', email: EMAIL, app_metadata, user_metadata })
const connexionReussie = (app_metadata: Record<string, unknown>, user_metadata: Record<string, unknown> = {}) =>
  ({ data: { user: compte(app_metadata, user_metadata), session: { access_token: 'jeton-fictif' } }, error: null })
const connexionRefusee = (erreur: unknown) => ({ data: { user: null, session: null }, error: erreur })

/** Promesse réglée à la main (vérification de session ou connexion encore en cours). */
function enAttente<T>() {
  let regler: (valeur: T) => void = () => {}
  const promesse = new Promise<T>((resoudre) => { regler = resoudre })
  return { promesse, regler }
}

const champEmail = () => screen.getByLabelText('Adresse e-mail professionnelle') as HTMLInputElement
const champMotDePasse = () => screen.getByLabelText('Mot de passe') as HTMLInputElement
const boutonConnexion = () => screen.getByRole('button', { name: /Se connecter|Connexion…/ })
const boutonOubli = () => screen.getByRole('button', { name: 'Mot de passe oublié ?' })
/** Liens de la page vers les pages communes de VitFix (/auth/login/, /auth/reset-password/…). */
const liensVersPagesCommunes = () =>
  Array.from(document.querySelectorAll('a[href]')).map((lien) => lien.getAttribute('href')).filter((href) => href?.includes('/auth'))

/** Le focus est sur ce message (ou sur son cadre focalisable) : ni perdu sur la page (body), ni ailleurs. */
const aLeFocus = (element: HTMLElement) => {
  const actif = document.activeElement
  return actif !== null && actif !== document.body && actif.contains(element)
}

/** Élément focalisable suivant dans l'ordre du clavier (Tab), après l'élément qui a le focus. */
function focalisableSuivant(): Element | undefined {
  const depart = document.activeElement
  if (!depart) return undefined
  return Array.from(document.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .find((element) => (depart.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 && !depart.contains(element))
}

function saisir(email: string, motDePasse: string) {
  fireEvent.change(champEmail(), { target: { value: email } })
  fireEvent.change(champMotDePasse(), { target: { value: motDePasse } })
}

const envoyer = () => fireEvent.submit(champEmail().closest('form') as HTMLFormElement)

/** Rend la page et attend la fin de la vérification de session du chargement. */
async function rendre(contexte: ContexteConnexionQr = CONTEXTE_CONNEXION_GLOBAL_QR) {
  render(<ConnexionEspaceQr contexte={contexte} />)
  await waitFor(() => expect(simul.getUser).toHaveBeenCalled())
  await act(async () => { await Promise.resolve() })
}

let avertissements: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  simul.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() })
  simul.signOut.mockResolvedValue({ error: null })
  simulerLocation('/fr/aj-signalement/connexion/')
  avertissements = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  avertissements.mockRestore()
  if (descripteurLocation) Object.defineProperty(window, 'location', descripteurLocation)
  descripteurLocation = undefined
})

describe('écran : connexion professionnelle, e-mail et mot de passe seulement', () => {
  it('un seul h1 « Connexion professionnelle », nom de l’espace, champs e-mail et mot de passe, « Mot de passe oublié ? »', async () => {
    await rendre()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Connexion professionnelle')
    expect(screen.getByText('AJ Signalement')).toBeInTheDocument()
    for (const [champ, attendus] of [
      [champEmail(), { type: 'email', name: 'email', autocomplete: 'email', inputmode: 'email', autocapitalize: 'none' }],
      [champMotDePasse(), { type: 'password', name: 'password', autocomplete: 'current-password' }],
    ] as const) {
      for (const [attribut, valeur] of Object.entries(attendus)) expect(champ).toHaveAttribute(attribut, valeur)
      expect(champ).toBeRequired()
    }
    expect(boutonConnexion()).toHaveAttribute('type', 'submit')
    expect(boutonConnexion()).toHaveTextContent('Se connecter')
    // « Mot de passe oublié ? » s'ouvre dans la page (relecture du 11/11/2026) : plus de lien vers la page commune.
    expect(boutonOubli()).toHaveAttribute('type', 'button')
  })

  it('ni Particulier / Artisan / Pro, ni Google, ni « Créer un compte », ni « Se souvenir de moi »', async () => {
    await rendre()
    const texte = document.body.textContent?.toLowerCase() ?? ''
    for (const mot of ['particulier', 'artisan', 'google', 'créer un compte', 'se souvenir', 'super']) expect(texte).not.toContain(mot)
    expect(screen.queryByRole('button', { name: /pro$/i })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    // Trois boutons seulement : afficher le mot de passe, mot de passe oublié, se connecter.
    expect(screen.getAllByRole('button').map((bouton) => bouton.textContent || bouton.getAttribute('aria-label')))
      .toEqual(['Afficher le mot de passe', 'Mot de passe oublié ?', 'Se connecter'])
  })

  it.each(['/fr/aj-signalement/connexion/', '/pt/aj-signalement/connexion/'])(
    '%s : aucun lien vers les pages communes de connexion (/auth/…), qui proposent Particulier / Artisan / Pro et Google',
    async (chemin) => {
      simulerLocation(chemin)
      await rendre()
      expect(liensVersPagesCommunes()).toEqual([])
    },
  )

  it('afficher / masquer le mot de passe (bouton qui n’envoie pas le formulaire)', async () => {
    await rendre()
    const bouton = screen.getByRole('button', { name: 'Afficher le mot de passe' })
    expect(bouton).toHaveAttribute('type', 'button')
    fireEvent.click(bouton)
    expect(champMotDePasse()).toHaveAttribute('type', 'text')
    fireEvent.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }))
    expect(champMotDePasse()).toHaveAttribute('type', 'password')
    expect(simul.signInWithPassword).not.toHaveBeenCalled()
  })
})

describe('saisie vérifiée avant tout appel', () => {
  it('rien de saisi : deux messages reliés aux champs, focus sur l’e-mail, aucun appel', async () => {
    await rendre()
    envoyer()
    expect(champEmail()).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById(champEmail().getAttribute('aria-describedby') ?? '')).toHaveTextContent('Indiquez votre adresse e-mail.')
    expect(champMotDePasse()).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById(champMotDePasse().getAttribute('aria-describedby') ?? '')).toHaveTextContent('Indiquez votre mot de passe.')
    expect(document.activeElement).toBe(champEmail())
    expect(simul.signInWithPassword).not.toHaveBeenCalled()
  })

  it('e-mail mal formé : message, focus sur l’e-mail, aucun appel ; mot de passe seul manquant : focus sur lui', async () => {
    await rendre()
    saisir('gestion@exemple', MOT_DE_PASSE)
    envoyer()
    expect(document.getElementById(champEmail().getAttribute('aria-describedby') ?? '')).toHaveTextContent('Adresse e-mail invalide.')
    expect(champMotDePasse()).not.toHaveAttribute('aria-invalid')
    expect(document.activeElement).toBe(champEmail())
    saisir(EMAIL, '')
    envoyer()
    expect(champEmail()).not.toHaveAttribute('aria-invalid')
    expect(document.activeElement).toBe(champMotDePasse())
    expect(simul.signInWithPassword).not.toHaveBeenCalled()
  })

  it('e-mail rogné à l’envoi, mot de passe tel quel', async () => {
    simul.signInWithPassword.mockResolvedValue(connexionReussie({ role: 'super_admin' }))
    await rendre()
    saisir(`  ${EMAIL} `, MOT_DE_PASSE)
    envoyer()
    await waitFor(() => expect(simul.signInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: MOT_DE_PASSE }))
  })
})

describe('compte admis : arrivée dans l’espace', () => {
  it.each([
    ['super admin', '/fr/aj-signalement/connexion/', '', { role: 'super_admin' }, '/fr/aj-signalement/'],
    ['super admin arrivé par le lien de l’e-mail', '/fr/aj-signalement/connexion/', '#signalements', { role: 'super_admin' }, '/fr/aj-signalement/#signalements'],
    ['super admin, ancre qui ne désigne aucune vue', '/fr/aj-signalement/connexion/', '#admin', { role: 'super_admin' }, '/fr/aj-signalement/'],
    ['super admin en portugais', '/pt/aj-signalement/connexion/', '', { role: 'super_admin' }, '/pt/aj-signalement/'],
  ])('%s : remplacement de l’adresse (« retour » ne ramène pas au formulaire)', async (_cas, chemin, ancre, app, destination) => {
    simulerLocation(chemin, ancre)
    simul.signInWithPassword.mockResolvedValue(connexionReussie(app))
    await rendre()
    saisir(EMAIL, MOT_DE_PASSE)
    envoyer()
    await waitFor(() => expect(navigations).toEqual([remplacement(destination)]))
    expect(simul.signOut).not.toHaveBeenCalled()
  })

  it('double envoi pendant l’attente : un seul appel, bouton désactivé « Connexion… »', async () => {
    const attente = enAttente<ReturnType<typeof connexionReussie>>()
    simul.signInWithPassword.mockReturnValue(attente.promesse)
    await rendre()
    saisir(EMAIL, MOT_DE_PASSE)
    envoyer()
    envoyer()
    expect(simul.signInWithPassword).toHaveBeenCalledTimes(1)
    expect(boutonConnexion()).toBeDisabled()
    expect(boutonConnexion()).toHaveTextContent('Connexion…')
    await act(async () => { attente.regler(connexionReussie({ role: 'super_admin' })) })
    await waitFor(() => expect(navigations).toEqual([remplacement('/fr/aj-signalement/')]))
  })
})

describe('compte sans accès : message neutre, session fermée (portée locale), aucune navigation', () => {
  it.each([
    ['copropriétaire', { role: 'coproprio' }, {}],
    ['syndic', { role: 'syndic' }, {}],
    ['copropriétaire au user_metadata trafiqué', { role: 'coproprio' }, { role: 'super_admin', _original_role: 'super_admin' }],
    ['« vue en tant que » ouverte par un super admin', { role: 'coproprio', _original_role: 'super_admin' }, {}],
  ])('compte %s', async (_cas, app, user) => {
    simul.signInWithPassword.mockResolvedValue(connexionReussie(app, user))
    await rendre()
    saisir(EMAIL, MOT_DE_PASSE)
    envoyer()
    expect(await screen.findByText('Cet espace n’est pas accessible avec votre compte.')).toBeInTheDocument()
    expect(screen.getByText('Connectez-vous avec un autre compte.')).toBeInTheDocument()
    await waitFor(() => expect(boutonConnexion()).toBeEnabled())
    expect(simul.signOut).toHaveBeenCalledTimes(1)
    expect(simul.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(navigations).toEqual([])
    expect(champMotDePasse()).toHaveValue('')
    expect(champEmail()).toHaveValue(EMAIL)
    expect(document.body.textContent?.toLowerCase()).not.toContain('super')
    expect(simul.toastErreur).not.toHaveBeenCalled()
  })

  it('lecteur d’écran : message annoncé (role=alert, comme les erreurs), focus posé sur lui, puis le champ e-mail au clavier', async () => {
    simul.signInWithPassword.mockResolvedValue(connexionReussie({ role: 'coproprio' }))
    await rendre()
    expect(screen.queryByRole('alert')).toBeNull()
    saisir(EMAIL, MOT_DE_PASSE)
    envoyer()
    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent('Cet espace n’est pas accessible avec votre compte.')
    expect(alerte).toHaveTextContent('Connectez-vous avec un autre compte.')
    // Le focus ne se perd pas (le bouton désactivé pendant l'envoi l'aurait rendu à la page) : il est sur le message,
    // qui est lu en entier ; Tab mène ensuite au champ e-mail.
    await waitFor(() => expect(aLeFocus(alerte)).toBe(true))
    expect(document.activeElement).toHaveAttribute('tabindex', '-1')
    await waitFor(() => expect(boutonConnexion()).toBeEnabled())
    expect(focalisableSuivant()).toBe(champEmail())
  })

  it('second refus de suite : le message est de nouveau annoncé et reçoit de nouveau le focus', async () => {
    simul.signInWithPassword.mockResolvedValue(connexionReussie({ role: 'coproprio' }))
    await rendre()
    saisir(EMAIL, MOT_DE_PASSE)
    envoyer()
    await screen.findByRole('alert')
    await waitFor(() => expect(boutonConnexion()).toBeEnabled())
    champEmail().focus()
    saisir('autre@exemple.test', MOT_DE_PASSE)
    envoyer()
    await waitFor(() => expect(simul.signOut).toHaveBeenCalledTimes(2))
    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent('Cet espace n’est pas accessible avec votre compte.')
    await waitFor(() => expect(aLeFocus(alerte)).toBe(true))
  })

  it.each([
    ['erreur renvoyée', () => simul.signOut.mockResolvedValue({ error: new Error('réseau') })],
    ['exception', () => simul.signOut.mockRejectedValue(new Error('réseau'))],
  ])('fermeture de la session en échec (%s) : toast, le message neutre reste', async (_cas, preparer) => {
    preparer()
    simul.signInWithPassword.mockResolvedValue(connexionReussie({ role: 'coproprio' }))
    await rendre()
    saisir(EMAIL, MOT_DE_PASSE)
    envoyer()
    await waitFor(() => expect(simul.toastErreur).toHaveBeenCalledWith('La déconnexion a échoué. Réessayez.'))
    expect(screen.getByText('Cet espace n’est pas accessible avec votre compte.')).toBeInTheDocument()
    expect(navigations).toEqual([])
  })
})

describe('erreurs de connexion : trois messages, jamais la fermeture d’une session', () => {
  it.each([
    ['identifiants refusés (400)', () => simul.signInWithPassword.mockResolvedValue(connexionRefusee(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'))), 'E-mail ou mot de passe incorrect.'],
    ['trop de tentatives (429)', () => simul.signInWithPassword.mockResolvedValue(connexionRefusee(new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit'))), 'Trop de tentatives. Réessayez dans quelques minutes.'],
    ['serveur indisponible (503)', () => simul.signInWithPassword.mockResolvedValue(connexionRefusee(new AuthRetryableFetchError('Service Unavailable', 503))), 'Connexion impossible pour le moment. Réessayez dans un instant.'],
    ['réseau coupé (exception)', () => simul.signInWithPassword.mockRejectedValue(new TypeError('Failed to fetch')), 'Connexion impossible pour le moment. Réessayez dans un instant.'],
  ])('%s : message d’erreur (role=alert), formulaire de nouveau utilisable', async (_cas, preparer, message) => {
    preparer()
    await rendre()
    saisir(EMAIL, MOT_DE_PASSE)
    envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(boutonConnexion()).toBeEnabled()
    expect(boutonConnexion()).toHaveTextContent('Se connecter')
    expect(simul.signOut).not.toHaveBeenCalled()
    expect(navigations).toEqual([])
    // Journal : jamais l'e-mail ni le mot de passe.
    expect(avertissements).toHaveBeenCalled()
    const journal = JSON.stringify(avertissements.mock.calls)
    expect(journal).not.toContain(EMAIL)
    expect(journal).not.toContain(MOT_DE_PASSE)
  })

  it('nouvel essai : l’erreur précédente disparaît à l’envoi', async () => {
    simul.signInWithPassword.mockResolvedValueOnce(connexionRefusee(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials')))
    await rendre()
    saisir(EMAIL, MOT_DE_PASSE)
    envoyer()
    await screen.findByRole('alert')
    simul.signInWithPassword.mockResolvedValueOnce(connexionReussie({ role: 'super_admin' }))
    envoyer()
    await waitFor(() => expect(navigations).toEqual([remplacement('/fr/aj-signalement/')]))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('au chargement : session déjà ouverte dans ce navigateur (secours sans middleware)', () => {
  it('session admise : arrivée dans l’espace, ancre comprise, sans saisie', async () => {
    simulerLocation('/fr/aj-signalement/connexion/', '#signalements')
    simul.getUser.mockResolvedValue({ data: { user: compte({ role: 'super_admin' }) }, error: null })
    render(<ConnexionEspaceQr contexte={CONTEXTE_CONNEXION_GLOBAL_QR} />)
    await waitFor(() => expect(navigations).toEqual([remplacement('/fr/aj-signalement/#signalements')]))
    expect(simul.signInWithPassword).not.toHaveBeenCalled()
  })

  it('session sans accès : message neutre au-dessus du formulaire, session laissée telle quelle (ouverte ailleurs)', async () => {
    simul.getUser.mockResolvedValue({ data: { user: compte({ role: 'syndic' }) }, error: null })
    await rendre()
    expect(await screen.findByText('Cet espace n’est pas accessible avec votre compte.')).toBeInTheDocument()
    expect(champEmail()).toBeInTheDocument()
    expect(simul.signOut).not.toHaveBeenCalled()
    expect(navigations).toEqual([])
    // Au chargement, sans action de la personne : zone d'état (role=status), le focus n'est pas déplacé.
    expect(screen.getByRole('status')).toHaveTextContent('Cet espace n’est pas accessible avec votre compte.')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.activeElement).toBe(document.body)
  })

  it('session indisponible (réseau) : formulaire seul, ni message ni navigation', async () => {
    simul.getUser.mockRejectedValue(new Error('réseau coupé'))
    await rendre()
    expect(champEmail()).toBeInTheDocument()
    expect(screen.queryByText('Cet espace n’est pas accessible avec votre compte.')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(navigations).toEqual([])
  })

  it('connexion lancée avant la fin de la vérification : la vérification tardive ne décide plus rien', async () => {
    const verification = enAttente<{ data: { user: ReturnType<typeof compte> }; error: null }>()
    simul.getUser.mockReturnValue(verification.promesse)
    simul.signInWithPassword.mockResolvedValue(connexionReussie({ role: 'coproprio' }))
    render(<ConnexionEspaceQr contexte={CONTEXTE_CONNEXION_GLOBAL_QR} />)
    saisir(EMAIL, MOT_DE_PASSE)
    envoyer()
    await waitFor(() => expect(simul.signOut).toHaveBeenCalledWith({ scope: 'local' }))
    // Réponse tardive, d'avant la fermeture de la session : elle ne doit pas ouvrir l'espace.
    await act(async () => { verification.regler({ data: { user: compte({ role: 'super_admin' }) }, error: null }) })
    await act(async () => { await Promise.resolve() })
    expect(navigations).toEqual([])
    expect(screen.getByText('Cet espace n’est pas accessible avec votre compte.')).toBeInTheDocument()
  })
})

// Relecture du 11/11/2026 : le lien vers la page commune /fr/auth/reset-password/ ramenait le professionnel sur la page
// de connexion générale (« Retour à la connexion », bouton du message « Email envoyé ») : choix Particulier / Artisan /
// Pro et Google. Le lien se demande donc dans la page, par la route existante POST /api/auth/reset-password.
describe('mot de passe oublié : demande du lien dans la page, sans passer par la page générale', () => {
  let appels: Array<{ url: string; init: RequestInit | undefined }> = []
  function simulerRoute(reponse: () => Response | Promise<Response>) {
    appels = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      appels.push({ url, init })
      return reponse()
    }))
  }
  const reponseJson = (statut: number, corps: Record<string, unknown>) =>
    new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json' } })
  const MESSAGE_ENVOYE = 'Si un compte existe avec cette adresse, vous recevrez dans quelques minutes un lien pour choisir un nouveau mot de passe.'
  const titreOubli = () => screen.getByRole('heading', { level: 2, name: 'Mot de passe oublié' })
  const boutonEnvoyerLien = () => screen.getByRole('button', { name: /Envoyer le lien|Envoi…/ })
  const boutonRetour = () => screen.getByRole('button', { name: 'Retour à la connexion professionnelle' })
  const aideEmail = () => document.getElementById(champEmail().getAttribute('aria-describedby') ?? '')

  /** Page rendue, étape « Mot de passe oublié » ouverte, e-mail saisi. */
  async function ouvrirOubli(email = EMAIL) {
    await rendre()
    fireEvent.click(boutonOubli())
    fireEvent.change(champEmail(), { target: { value: email } })
  }

  beforeEach(() => simulerRoute(() => reponseJson(200, { message: 'Email envoyé' })))

  it('ouverture : étape « Mot de passe oublié » (h2 qui reçoit le focus), e-mail déjà saisi repris, un seul h1, aucun appel', async () => {
    await rendre()
    saisir(EMAIL, MOT_DE_PASSE)
    fireEvent.click(boutonOubli())
    expect(document.activeElement).toBe(titreOubli())
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Connexion professionnelle')
    expect(champEmail()).toHaveValue(EMAIL)
    expect(screen.queryByLabelText('Mot de passe')).toBeNull()
    expect(boutonEnvoyerLien()).toHaveAttribute('type', 'submit')
    expect(liensVersPagesCommunes()).toEqual([])
    expect(appels).toEqual([])
    expect(simul.signInWithPassword).not.toHaveBeenCalled()
  })

  it('envoi : POST /api/auth/reset-password { email } rogné, message neutre qui reçoit le focus, toujours aucun lien vers les pages communes', async () => {
    await ouvrirOubli(`  ${EMAIL} `)
    envoyer()
    const message = await screen.findByText(MESSAGE_ENVOYE)
    expect(appels).toHaveLength(1)
    expect(appels[0].url).toBe('/api/auth/reset-password')
    expect(appels[0].init?.method).toBe('POST')
    expect(new Headers(appels[0].init?.headers).get('content-type')).toBe('application/json')
    expect(JSON.parse(String(appels[0].init?.body))).toEqual({ email: EMAIL })
    // Le formulaire (et son bouton, qui avait le focus) disparaît : le focus va au message, lu en entier.
    await waitFor(() => expect(aLeFocus(message)).toBe(true))
    expect(screen.queryByRole('button', { name: /Envoyer le lien/ })).toBeNull()
    expect(boutonRetour()).toBeInTheDocument()
    expect(liensVersPagesCommunes()).toEqual([])
    expect(simul.signInWithPassword).not.toHaveBeenCalled()
    expect(simul.signOut).not.toHaveBeenCalled()
  })

  it('e-mail vide puis mal formé : message relié au champ, focus sur lui, aucun appel', async () => {
    await ouvrirOubli('')
    envoyer()
    expect(champEmail()).toHaveAttribute('aria-invalid', 'true')
    expect(aideEmail()).toHaveTextContent('Indiquez votre adresse e-mail.')
    expect(document.activeElement).toBe(champEmail())
    fireEvent.change(champEmail(), { target: { value: 'gestion@exemple' } })
    envoyer()
    expect(aideEmail()).toHaveTextContent('Adresse e-mail invalide.')
    expect(appels).toEqual([])
  })

  it('adresse refusée par le serveur (400) : « Adresse e-mail invalide. » sous le champ, focus sur lui, message du serveur jamais montré', async () => {
    simulerRoute(() => reponseJson(400, { error: 'Email invalide : un domaine avec TLD est requis (ex: nom@domaine.fr)' }))
    await ouvrirOubli()
    envoyer()
    await waitFor(() => expect(champEmail()).toHaveAttribute('aria-invalid', 'true'))
    expect(aideEmail()).toHaveTextContent('Adresse e-mail invalide.')
    expect(document.activeElement).toBe(champEmail())
    expect(screen.queryByText(/TLD/)).toBeNull()
    expect(boutonEnvoyerLien()).toBeEnabled()
  })

  it.each([
    ['trop de demandes (429)', () => reponseJson(429, { error: 'Too many requests. Please wait before retrying.' }), 'Trop de demandes. Réessayez dans quelques minutes.'],
    ['serveur en échec (500)', () => reponseJson(500, { error: 'Erreur lors de l’envoi' }), 'Envoi impossible pour le moment. Réessayez dans un instant.'],
    ['réseau coupé (exception)', (): Response => { throw new TypeError('Failed to fetch') }, 'Envoi impossible pour le moment. Réessayez dans un instant.'],
  ])('%s : message d’erreur (role=alert), formulaire de nouveau utilisable, journal sans l’e-mail', async (_cas, reponse, texte) => {
    simulerRoute(reponse)
    await ouvrirOubli()
    envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent(texte)
    expect(boutonEnvoyerLien()).toBeEnabled()
    expect(boutonEnvoyerLien()).toHaveTextContent('Envoyer le lien')
    expect(screen.queryByText(MESSAGE_ENVOYE)).toBeNull()
    expect(avertissements).toHaveBeenCalled()
    expect(JSON.stringify(avertissements.mock.calls)).not.toContain(EMAIL)
  })

  it('double envoi pendant l’attente : un seul appel, bouton désactivé « Envoi… »', async () => {
    const attente = enAttente<Response>()
    simulerRoute(() => attente.promesse)
    await ouvrirOubli()
    envoyer()
    envoyer()
    expect(appels).toHaveLength(1)
    expect(boutonEnvoyerLien()).toBeDisabled()
    expect(boutonEnvoyerLien()).toHaveTextContent('Envoi…')
    await act(async () => { attente.regler(reponseJson(200, { message: 'Email envoyé' })) })
    expect(await screen.findByText(MESSAGE_ENVOYE)).toBeInTheDocument()
  })

  it('« Retour à la connexion professionnelle » : formulaire de connexion de nouveau, e-mail repris, focus sur lui', async () => {
    await ouvrirOubli()
    fireEvent.click(boutonRetour())
    expect(screen.queryByRole('heading', { level: 2, name: 'Mot de passe oublié' })).toBeNull()
    expect(champMotDePasse()).toBeInTheDocument()
    expect(champEmail()).toHaveValue(EMAIL)
    expect(document.activeElement).toBe(champEmail())
    expect(appels).toEqual([])
  })

  it('après une erreur de connexion : l’ancien message ne suit ni dans l’étape ni au retour', async () => {
    simul.signInWithPassword.mockResolvedValue(connexionRefusee(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials')))
    await rendre()
    saisir(EMAIL, MOT_DE_PASSE)
    envoyer()
    await screen.findByRole('alert')
    fireEvent.click(boutonOubli())
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(boutonRetour())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('E-mail ou mot de passe incorrect.')).toBeNull()
  })
})

// Connexion professionnelle d'un cabinet (vitfix.io/<identifiant>/connexion/, PR 2 lot 4) : le contexte porte le nom du
// cabinet, son espace (/<identifiant>/suivi/) ET son identifiant, passé à la décision d'accès. Seul un gestionnaire de
// CE cabinet (rôle serveur + repère de routage) y entre ; le super admin est renvoyé vers son espace global ; tout autre
// compte, gestionnaire d'un autre cabinet compris, reçoit le message neutre (rien ne dit que l'autre cabinet existe).
describe('connexion d’un cabinet (PR 2) : contexte avec le cabinet', () => {
  const cabinet = contexteConnexionCabinetQr({ identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple' })
  const gestionnaire = (repere: string) => ({ role: 'gestionnaire_signalement', aj_signalement_cabinet: repere })

  it('contexte : nom du cabinet, espace /<id>/suivi/ en fr comme en pt, identifiant ; sérialisable', () => {
    expect(cabinet).toEqual({
      nom: 'Cabinet Exemple', espace: { fr: '/cabinet-exemple/suivi/', pt: '/cabinet-exemple/suivi/' }, cabinet: { identifiant: 'cabinet-exemple' },
    })
    expect(JSON.parse(JSON.stringify(cabinet))).toEqual(cabinet)
  })

  it('nom du cabinet affiché, même titre, même formulaire (ni Google ni choix Particulier / Artisan / Pro)', async () => {
    simulerLocation('/cabinet-exemple/connexion/')
    await rendre(cabinet)
    expect(screen.getByText('Cabinet Exemple')).toBeInTheDocument()
    expect(screen.queryByText('AJ Signalement')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Connexion professionnelle')
    expect(screen.queryByText(/Google/)).toBeNull()
    expect(screen.queryByText(/Particulier/)).toBeNull()
    expect(liensVersPagesCommunes()).toEqual([])
  })

  it.each([
    ['sans ancre', '', '/cabinet-exemple/suivi/'],
    ['lien de l’e-mail (#signalements)', '#signalements', '/cabinet-exemple/suivi/#signalements'],
    ['ancre d’une vue du super admin', '#journal', '/cabinet-exemple/suivi/'],
  ])('gestionnaire de CE cabinet, %s : arrivée dans l’espace du cabinet, adresse remplacée', async (_cas, ancre, destination) => {
    simulerLocation('/cabinet-exemple/connexion/', ancre)
    simul.signInWithPassword.mockResolvedValue(connexionReussie(gestionnaire('cabinet-exemple')))
    await rendre(cabinet)
    saisir(EMAIL, MOT_DE_PASSE)
    envoyer()
    await waitFor(() => expect(navigations).toEqual([remplacement(destination)]))
    expect(simul.signOut).not.toHaveBeenCalled()
  })

  it('super admin : renvoyé vers son espace global, jamais l’espace du cabinet', async () => {
    simulerLocation('/cabinet-exemple/connexion/', '#signalements')
    simul.signInWithPassword.mockResolvedValue(connexionReussie({ role: 'super_admin' }))
    await rendre(cabinet)
    saisir(EMAIL, MOT_DE_PASSE)
    envoyer()
    await waitFor(() => expect(navigations).toEqual([remplacement('/fr/aj-signalement/#signalements')]))
  })

  it.each([
    ['gestionnaire d’un autre cabinet', gestionnaire('autre-cabinet'), {}],
    ['gestionnaire sans repère', { role: 'gestionnaire_signalement' }, {}],
    ['client', { role: 'client' }, {}],
    ['repère dans user_metadata seulement', { role: 'client' }, gestionnaire('cabinet-exemple')],
  ])('%s : message neutre (role=alert), session fermée en portée locale, aucune navigation', async (_cas, app, user) => {
    simulerLocation('/cabinet-exemple/connexion/')
    simul.signInWithPassword.mockResolvedValue(connexionReussie(app, user))
    await rendre(cabinet)
    saisir(EMAIL, MOT_DE_PASSE)
    envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent('Cet espace n’est pas accessible avec votre compte.')
    expect(screen.queryByText(/autre-cabinet/)).toBeNull()
    await waitFor(() => expect(simul.signOut).toHaveBeenCalledWith({ scope: 'local' }))
    expect(navigations).toEqual([])
  })

  it('au chargement : session du gestionnaire de CE cabinet → l’espace (ancre comprise), sans saisie', async () => {
    simulerLocation('/cabinet-exemple/connexion/', '#coproprietes')
    simul.getUser.mockResolvedValue({ data: { user: compte(gestionnaire('cabinet-exemple')) }, error: null })
    render(<ConnexionEspaceQr contexte={cabinet} />)
    await waitFor(() => expect(navigations).toEqual([remplacement('/cabinet-exemple/suivi/#coproprietes')]))
    expect(simul.signInWithPassword).not.toHaveBeenCalled()
  })

  it('au chargement : session d’un gestionnaire d’un autre cabinet → message neutre (status), session laissée', async () => {
    simulerLocation('/cabinet-exemple/connexion/')
    simul.getUser.mockResolvedValue({ data: { user: compte(gestionnaire('autre-cabinet')) }, error: null })
    await rendre(cabinet)
    expect(await screen.findByRole('status')).toHaveTextContent('Cet espace n’est pas accessible avec votre compte.')
    expect(simul.signOut).not.toHaveBeenCalled()
    expect(navigations).toEqual([])
  })

  it('page globale (/fr/aj-signalement/connexion/) : un gestionnaire avec repère est envoyé vers l’espace de SON cabinet', async () => {
    simulerLocation('/fr/aj-signalement/connexion/', '#signalements')
    simul.signInWithPassword.mockResolvedValue(connexionReussie(gestionnaire('cabinet-exemple')))
    await rendre(CONTEXTE_CONNEXION_GLOBAL_QR)
    saisir(EMAIL, MOT_DE_PASSE)
    envoyer()
    await waitFor(() => expect(navigations).toEqual([remplacement('/cabinet-exemple/suivi/#signalements')]))
    expect(simul.signOut).not.toHaveBeenCalled()
  })

  it('« Mot de passe oublié ? » : même étape dans la page du cabinet (route commune, aucun lien vers les pages communes)', async () => {
    simulerLocation('/cabinet-exemple/connexion/')
    await rendre(cabinet)
    fireEvent.click(boutonOubli())
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Connexion professionnelle')
    expect(screen.getByText('Cabinet Exemple')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Envoyer le lien' })).toBeInTheDocument()
    expect(liensVersPagesCommunes()).toEqual([])
  })
})
