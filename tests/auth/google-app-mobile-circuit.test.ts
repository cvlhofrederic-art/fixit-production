// tests/auth/google-app-mobile-circuit.test.ts — câblage réel de « Continuer avec Google » dans l'appli.
// Les plugins Capacitor sont simulés : on vérifie ce que le code leur demande, pas ce qu'ils font.
// Ce qui est en jeu : perdre `redirectTo` ou `skipBrowserRedirect` ne casse rien de visible en local, mais
// renvoie la connexion vers la Site URL, donc dans le navigateur du téléphone — l'impasse du 12/11/2026.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  RETOUR_GOOGLE_APP_MOBILE,
  installerRetourGoogleAppMobile,
  ouvrirConnexionGoogleAppMobile,
} from '@/lib/auth/google-app-mobile'

const h = vi.hoisted(() => ({
  ouvrir: vi.fn(),
  fermer: vi.fn(),
  ecouter: vi.fn(),
  retirer: vi.fn(),
}))

vi.mock('@capacitor/browser', () => ({ Browser: { open: h.ouvrir, close: h.fermer } }))
vi.mock('@capacitor/app', () => ({ App: { addListener: h.ecouter } }))

type FenetreTest = Window & { Capacitor?: unknown }

const URL_GOOGLE = 'https://projet.supabase.co/auth/v1/authorize?provider=google&code_challenge=abc'

const dansLAppli = () => { (window as FenetreTest).Capacitor = { isNativePlatform: () => true } }

const auth = (reponse: { data: { url: string | null }; error: { message: string } | null }) => ({
  signInWithOAuth: vi.fn().mockResolvedValue(reponse),
})

beforeEach(() => {
  h.ouvrir.mockReset().mockResolvedValue(undefined)
  h.fermer.mockReset().mockResolvedValue(undefined)
  h.retirer.mockReset().mockResolvedValue(undefined)
  h.ecouter.mockReset().mockResolvedValue({ remove: h.retirer })
})

afterEach(() => {
  delete (window as FenetreTest).Capacitor
  vi.restoreAllMocks()
})

describe('ouvrirConnexionGoogleAppMobile', () => {
  it('demande l’adresse de retour de l’appli, sans laisser Supabase rediriger', async () => {
    const client = auth({ data: { url: URL_GOOGLE }, error: null })
    await ouvrirConnexionGoogleAppMobile(client)

    expect(client.signInWithOAuth).toHaveBeenCalledTimes(1)
    expect(client.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: RETOUR_GOOGLE_APP_MOBILE, skipBrowserRedirect: true },
    })
    expect(RETOUR_GOOGLE_APP_MOBILE).toBe('io.vitfix.pro://auth/callback')
  })

  it('ouvre cette adresse-là dans la fenêtre du système', async () => {
    await ouvrirConnexionGoogleAppMobile(auth({ data: { url: URL_GOOGLE }, error: null }))
    expect(h.ouvrir).toHaveBeenCalledTimes(1)
    expect(h.ouvrir).toHaveBeenCalledWith({ url: URL_GOOGLE })
  })

  it('refuse d’ouvrir une fenêtre si Supabase ne rend pas une adresse web', async () => {
    // Le refus de Supabase est repris tel quel : « provider is not enabled » se lit dans la console du
    // téléphone, au lieu d'une erreur générique qui enverrait chercher la panne ailleurs.
    await expect(ouvrirConnexionGoogleAppMobile(auth({ data: { url: null }, error: { message: 'provider is not enabled' } })))
      .rejects.toThrow('provider is not enabled')

    for (const reponse of [
      { data: { url: null }, error: null },
      // Si une version future rendait le corps JSON au lieu de l'adresse : erreur, pas de charabia à l'écran.
      { data: { url: '{"url":"https://projet.supabase.co/..."}' }, error: null },
    ]) {
      await expect(ouvrirConnexionGoogleAppMobile(auth(reponse))).rejects.toThrow()
    }
    expect(h.ouvrir).not.toHaveBeenCalled()
  })
})

describe('installerRetourGoogleAppMobile', () => {
  it('hors de l’appli : aucun plugin chargé, rien à désinstaller', async () => {
    const naviguer = vi.fn()
    const desinstaller = await installerRetourGoogleAppMobile('fr', naviguer)
    desinstaller()

    expect(h.ecouter).not.toHaveBeenCalled()
    expect(naviguer).not.toHaveBeenCalled()
  })

  it('referme la fenêtre AVANT de quitter la page, sinon elle reste au-dessus de l’appli', async () => {
    dansLAppli()
    const ordre: string[] = []
    h.fermer.mockImplementation(async () => { ordre.push('fermeture') })
    const naviguer = vi.fn(() => { ordre.push('navigation') })

    await installerRetourGoogleAppMobile('fr', naviguer)
    const ecouteur = h.ecouter.mock.calls[0][1] as (d: { url: string }) => void
    ecouteur({ url: `${RETOUR_GOOGLE_APP_MOBILE}?code=abc` })
    await vi.waitFor(() => expect(naviguer).toHaveBeenCalled())

    expect(ordre).toEqual(['fermeture', 'navigation'])
    expect(naviguer).toHaveBeenCalledWith('/fr/auth/callback/?code=abc&app=1')
    expect(h.ecouter).toHaveBeenCalledWith('appUrlOpen', expect.any(Function))
  })

  it('une fenêtre déjà fermée n’empêche pas la connexion d’aboutir', async () => {
    dansLAppli()
    h.fermer.mockRejectedValue(new Error('no browser to close'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const naviguer = vi.fn()

    await installerRetourGoogleAppMobile('pt', naviguer)
    const ecouteur = h.ecouter.mock.calls[0][1] as (d: { url: string }) => void
    ecouteur({ url: `${RETOUR_GOOGLE_APP_MOBILE}?code=xyz` })
    await vi.waitFor(() => expect(naviguer).toHaveBeenCalledWith('/pt/auth/callback/?code=xyz&app=1'))

    expect(console.warn).toHaveBeenCalled()
  })

  it('un lien profond étranger ne fait rien du tout', async () => {
    dansLAppli()
    const naviguer = vi.fn()
    await installerRetourGoogleAppMobile('fr', naviguer)
    const ecouteur = h.ecouter.mock.calls[0][1] as (d: { url: string }) => void

    for (const url of ['io.vitfix.pro://autre?code=x', 'https://vitfix.io/auth/callback?code=x', 'cassé']) {
      ecouteur({ url })
    }
    await Promise.resolve()

    expect(naviguer).not.toHaveBeenCalled()
    expect(h.fermer).not.toHaveBeenCalled()
  })

  it('le démontage retire l’écouteur', async () => {
    dansLAppli()
    const desinstaller = await installerRetourGoogleAppMobile('fr', vi.fn())
    desinstaller()
    expect(h.retirer).toHaveBeenCalledTimes(1)
  })
})
