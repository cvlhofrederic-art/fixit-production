/**
 * Providers installe l'écoute du retour de « Continuer avec Google » dans l'appli Vitfix Pro.
 *
 * Ce que ce fichier protège : l'écouteur est bien posé avec la langue de la page, et ce qu'il appelle au
 * retour emmène VRAIMENT la WebView sur le chemin reçu. Un rappel vidé laisserait l'appli sur le formulaire
 * de connexion après un aller-retour chez Google, sans que rien ne le signale.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@/lib/storage-sync', () => ({
  installStorageSync: vi.fn(),
  hydrateStorageFromServer: vi.fn().mockResolvedValue({ count: 0 }),
  pushAllLocalToServer: vi.fn().mockResolvedValue({ count: 0 }),
}))
vi.mock('@/lib/document-sync', () => ({ importLocalStorageDocsToSupabase: vi.fn().mockResolvedValue(0) }))
vi.mock('@/lib/i18n/context', () => ({ LanguageProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('sonner', () => ({ Toaster: () => null }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) } },
}))

const simul = vi.hoisted(() => ({ installer: vi.fn(), desinstaller: vi.fn() }))
vi.mock('@/lib/auth/google-app-mobile', () => ({ installerRetourGoogleAppMobile: simul.installer }))

import Providers from '@/components/common/Providers'

let navigations: string[] = []
let descripteurLocation: PropertyDescriptor | undefined

const laisserTourner = () => new Promise((r) => setTimeout(r, 5))

beforeEach(() => {
  vi.clearAllMocks()
  simul.installer.mockResolvedValue(simul.desinstaller)
  navigations = []
  descripteurLocation = Object.getOwnPropertyDescriptor(window, 'location')
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      origin: 'https://vitfix.io',
      get href() { return 'https://vitfix.io/fr/auth/login/' },
      set href(destination: string) { navigations.push(destination) },
    },
  })
})

afterEach(() => {
  if (descripteurLocation) Object.defineProperty(window, 'location', descripteurLocation)
})

describe('Providers — retour de Google dans l’appli', () => {
  it('installe l’écoute avec la langue de la page, et le retour emmène la WebView', async () => {
    render(<Providers locale="pt">{null}</Providers>)
    await laisserTourner()

    expect(simul.installer).toHaveBeenCalledTimes(1)
    const [langue, naviguer] = simul.installer.mock.calls[0] as [string, (chemin: string) => void]
    expect(langue).toBe('pt')

    naviguer('/pt/auth/callback/?code=abc&app=1')
    expect(navigations).toEqual(['/pt/auth/callback/?code=abc&app=1'])
  })

  it('le démontage retire l’écoute', async () => {
    const { unmount } = render(<Providers locale="fr">{null}</Providers>)
    await laisserTourner()
    unmount()
    expect(simul.desinstaller).toHaveBeenCalledTimes(1)
  })

  it('une installation impossible laisse le site intact et le dit', async () => {
    simul.installer.mockRejectedValue(new Error('chunk non chargé'))
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => render(<Providers locale="fr">{null}</Providers>)).not.toThrow()
    await laisserTourner()

    expect(avertir).toHaveBeenCalled()
    avertir.mockRestore()
  })
})
