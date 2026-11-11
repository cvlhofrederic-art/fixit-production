// tests/components/aj-signalement/connexion.test.tsx
//
// Page de connexion professionnelle de l'espace « AJ Signalement » (/fr/aj-signalement/connexion/), demande de Hugo du
// 11/11/2026 : « je ne veux pas que l'on puisse taper Particulier […] il faut taper professionnel avec le mail et mot de
// passe pour se connecter ».
// - e-mail + mot de passe, « Mot de passe oublié ? » ; ni Particulier / Artisan / Pro, ni Google, ni « Créer un compte » ;
// - saisie vérifiée avant tout appel, erreurs reliées aux champs (aria-invalid, aria-describedby), focus sur le
//   premier champ en erreur ;
// - compte admis : arrivée dans l'espace (ancre d'une vue comprise) ; compte sans accès : message neutre, session que
//   la page vient d'ouvrir fermée (portée locale), aucune navigation ;
// - erreurs de Supabase : trois messages qui ne disent jamais si l'adresse existe ; journal sans e-mail ni mot de passe ;
// - au chargement (secours sans middleware) : session admise → espace ; session sans accès → message neutre ;
// - réutilisable pour l'espace d'un cabinet (PR 2) : contexte en paramètre.
// Supabase et sonner sont simulés : aucune requête réelle, e-mails en @exemple.test, mot de passe fictif.

import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONTEXTE_CONNEXION_GLOBAL_QR, type ContexteConnexionQr } from '@/lib/aj-signalement/connexion-espace'

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
      assign: (destination: string) => { navigations.push(destination) },
      replace: (destination: string) => { navigations.push(destination) },
      reload: () => { navigations.push('rechargement') },
    },
  })
}

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
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' })).toHaveAttribute('href', '/fr/auth/reset-password/')
  })

  it('ni Particulier / Artisan / Pro, ni Google, ni « Créer un compte », ni « Se souvenir de moi »', async () => {
    await rendre()
    const texte = document.body.textContent?.toLowerCase() ?? ''
    for (const mot of ['particulier', 'artisan', 'google', 'créer un compte', 'se souvenir', 'super']) expect(texte).not.toContain(mot)
    expect(screen.queryByRole('button', { name: /pro$/i })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    // Deux boutons seulement : afficher le mot de passe et se connecter.
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('en portugais (/pt/…) : « Mot de passe oublié ? » vers /pt/auth/reset-password/', async () => {
    simulerLocation('/pt/aj-signalement/connexion/')
    await rendre()
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' })).toHaveAttribute('href', '/pt/auth/reset-password/')
  })

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
    ['« vue en tant que »', '/fr/aj-signalement/connexion/', '', { role: 'coproprio', _original_role: 'super_admin' }, '/fr/aj-signalement/'],
  ])('%s : remplacement de l’adresse (« retour » ne ramène pas au formulaire)', async (_cas, chemin, ancre, app, destination) => {
    simulerLocation(chemin, ancre)
    simul.signInWithPassword.mockResolvedValue(connexionReussie(app))
    await rendre()
    saisir(EMAIL, MOT_DE_PASSE)
    envoyer()
    await waitFor(() => expect(navigations).toEqual([destination]))
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
    await waitFor(() => expect(navigations).toEqual(['/fr/aj-signalement/']))
  })
})

describe('compte sans accès : message neutre, session fermée (portée locale), aucune navigation', () => {
  it.each([
    ['copropriétaire', { role: 'coproprio' }, {}],
    ['syndic', { role: 'syndic' }, {}],
    ['copropriétaire au user_metadata trafiqué', { role: 'coproprio' }, { role: 'super_admin', _original_role: 'super_admin' }],
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
    await waitFor(() => expect(navigations).toEqual(['/fr/aj-signalement/']))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('au chargement : session déjà ouverte dans ce navigateur (secours sans middleware)', () => {
  it('session admise : arrivée dans l’espace, ancre comprise, sans saisie', async () => {
    simulerLocation('/fr/aj-signalement/connexion/', '#signalements')
    simul.getUser.mockResolvedValue({ data: { user: compte({ role: 'super_admin' }) }, error: null })
    render(<ConnexionEspaceQr contexte={CONTEXTE_CONNEXION_GLOBAL_QR} />)
    await waitFor(() => expect(navigations).toEqual(['/fr/aj-signalement/#signalements']))
    expect(simul.signInWithPassword).not.toHaveBeenCalled()
  })

  it('session sans accès : message neutre au-dessus du formulaire, session laissée telle quelle (ouverte ailleurs)', async () => {
    simul.getUser.mockResolvedValue({ data: { user: compte({ role: 'syndic' }) }, error: null })
    await rendre()
    expect(await screen.findByText('Cet espace n’est pas accessible avec votre compte.')).toBeInTheDocument()
    expect(champEmail()).toBeInTheDocument()
    expect(simul.signOut).not.toHaveBeenCalled()
    expect(navigations).toEqual([])
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

describe('réutilisable pour l’espace d’un cabinet (PR 2) : contexte en paramètre', () => {
  const cabinet: ContexteConnexionQr = { nom: 'Cabinet Exemple', espace: { fr: '/cabinet-exemple/', pt: '/cabinet-exemple/' } }

  it('nom du cabinet affiché, même titre, arrivée dans l’espace du cabinet', async () => {
    simul.signInWithPassword.mockResolvedValue(connexionReussie({ role: 'super_admin' }))
    await rendre(cabinet)
    expect(screen.getByText('Cabinet Exemple')).toBeInTheDocument()
    expect(screen.queryByText('AJ Signalement')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Connexion professionnelle')
    saisir(EMAIL, MOT_DE_PASSE)
    envoyer()
    await waitFor(() => expect(navigations).toEqual(['/cabinet-exemple/']))
  })
})
