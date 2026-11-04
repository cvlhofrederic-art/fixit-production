/**
 * Navigateur qui bloque le stockage du site (réglage « bloquer les données des sites », navigation privée stricte,
 * iframe sandboxée, certaines webviews) : la simple lecture de window.localStorage ou window.sessionStorage lève une
 * SecurityError « Failed to read the 'localStorage' property from 'Window': Access is denied for this document. »
 * (Sentry VITFIX-PRODUCTION-T, G, S, sur des pages SEO publiques : l'erreur venait du code client global).
 *
 * Le site doit rester utilisable (lot 5 de l'analyse Sentry du 28/10/2026) :
 * - ni le miroir posé par Providers sur chaque page, ni le bandeau cookies ne lèvent d'erreur ;
 * - le choix du bandeau est gardé en mémoire pour la visite : le bandeau se ferme, ne revient pas tant que la page
 *   n'est pas rechargée, et la mesure d'audience s'active après « Tout accepter » ;
 * - le suivi d'événements (sessionStorage) et la migration du localStorage vers le serveur n'échouent pas.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/pt/precos/canalizador/',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'jeton' } } }) } },
}))

const MESSAGE = "Failed to read the 'localStorage' property from 'Window': Access is denied for this document."
const descripteurs: Partial<Record<'localStorage' | 'sessionStorage', PropertyDescriptor | undefined>> = {}

function bloquerStockage() {
  for (const nom of ['localStorage', 'sessionStorage'] as const) {
    descripteurs[nom] = Object.getOwnPropertyDescriptor(window, nom)
    Object.defineProperty(window, nom, {
      configurable: true,
      get() {
        throw new DOMException(MESSAGE.replace('localStorage', nom), 'SecurityError')
      },
    })
  }
}

function retablirStockage() {
  for (const nom of ['localStorage', 'sessionStorage'] as const) {
    const d = descripteurs[nom]
    if (d) Object.defineProperty(window, nom, d)
    else delete (window as unknown as Record<string, unknown>)[nom]
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  bloquerStockage()
})

afterEach(() => {
  retablirStockage()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// Après vi.resetModules(), le provider i18n et le bandeau doivent venir du même registre de modules.
async function monterBandeau() {
  const { LanguageProvider } = await import('@/lib/i18n/context')
  const { default: CookieConsent } = await import('@/components/common/CookieConsent')
  return render(
    <LanguageProvider initialLocale="fr">
      <CookieConsent />
    </LanguageProvider>,
  )
}

describe('stockage du navigateur bloqué', () => {
  it('le miroir localStorage (installé sur chaque page par Providers) ne lève pas d’erreur', async () => {
    expect(() => window.localStorage).toThrow(MESSAGE)
    const { installStorageSync } = await import('@/lib/storage-sync')
    expect(() => installStorageSync()).not.toThrow()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[storage-sync]'), expect.anything())
  })

  it('l’hydratation et la migration vers le serveur ne touchent pas le stockage et ne lèvent pas', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { hydrateStorageFromServer, pushAllLocalToServer } = await import('@/lib/storage-sync')
    await expect(hydrateStorageFromServer()).resolves.toEqual({ count: 0 })
    await expect(pushAllLocalToServer()).resolves.toEqual({ count: 0 })
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('le bandeau cookies enregistre le choix sans erreur, se ferme, et le choix vaut pour la visite', async () => {
    vi.useFakeTimers()
    const { isAnalyticsAllowed } = await import('@/lib/consentement-cookies')
    const premier = await monterBandeau()
    await act(async () => {
      vi.advanceTimersByTime(1600)
    })
    const accepter = screen.getByText('Tout accepter')
    expect(() => fireEvent.click(accepter)).not.toThrow()
    expect(screen.queryByText('Tout accepter')).toBeNull()
    expect(isAnalyticsAllowed()).toBe(true)
    premier.unmount()

    // Nouveau montage sans rechargement (navigation interne) : le bandeau ne revient pas.
    await monterBandeau()
    await act(async () => {
      vi.advanceTimersByTime(1600)
    })
    expect(screen.queryByText('Tout accepter')).toBeNull()
  })

  it('« Tout refuser » se ferme aussi sans erreur et laisse la mesure d’audience désactivée', async () => {
    vi.useFakeTimers()
    const { isAnalyticsAllowed } = await import('@/lib/consentement-cookies')
    await monterBandeau()
    await act(async () => {
      vi.advanceTimersByTime(1600)
    })
    expect(() => fireEvent.click(screen.getByText('Tout refuser'))).not.toThrow()
    expect(screen.queryByText('Tout refuser')).toBeNull()
    expect(isAnalyticsAllowed()).toBe(false)
  })

  it('le suivi d’événements (sessionStorage) ne lève pas une fois le consentement donné', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    const { memoriserConsentement } = await import('@/lib/consentement-cookies')
    memoriserConsentement({ performance: true, personalization: false, advertising: false, date: new Date().toISOString() })
    const { trackPageView, trackEvent, AnalyticsEventType } = await import('@/lib/analytics')
    expect(() => trackPageView()).not.toThrow()
    expect(() => trackEvent(AnalyticsEventType.SEARCH_PERFORMED, { q: 'x' })).not.toThrow()
    vi.unstubAllGlobals()
  })
})
