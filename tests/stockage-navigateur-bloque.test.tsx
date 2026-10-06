/**
 * Navigateur qui bloque le stockage du site (réglage « bloquer les données des sites », iframe sandboxée, certaines
 * webviews) : la simple lecture de window.localStorage lève une SecurityError
 * « Failed to read the 'localStorage' property from 'Window': Access is denied for this document. »
 * (Sentry VITFIX-PRODUCTION-T, sur /pt/precos/:slug, page serveur sans stockage : l'erreur venait du code client global).
 * Le site doit rester utilisable : ni le miroir posé par Providers sur chaque page, ni le bandeau cookies ne doivent
 * lever d'erreur.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { LanguageProvider } from '@/lib/i18n/context'
import CookieConsent from '@/components/common/CookieConsent'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/pt/precos/canalizador/',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

const MESSAGE = "Failed to read the 'localStorage' property from 'Window': Access is denied for this document."
let descripteurOrigine: PropertyDescriptor | undefined

function bloquerStockage() {
  descripteurOrigine = Object.getOwnPropertyDescriptor(window, 'localStorage')
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException(MESSAGE, 'SecurityError')
    },
  })
}

function retablirStockage() {
  if (descripteurOrigine) Object.defineProperty(window, 'localStorage', descripteurOrigine)
  else delete (window as unknown as { localStorage?: Storage }).localStorage
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

describe('stockage du navigateur bloqué', () => {
  it('le miroir localStorage (installé sur chaque page par Providers) ne lève pas d’erreur', async () => {
    expect(() => window.localStorage).toThrow(MESSAGE)
    const { installStorageSync } = await import('@/lib/storage-sync')
    expect(() => installStorageSync()).not.toThrow()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[storage-sync]'), expect.anything())
  })

  it('le bandeau cookies enregistre le choix sans erreur et se ferme', async () => {
    vi.useFakeTimers()
    render(
      <LanguageProvider initialLocale="fr">
        <CookieConsent />
      </LanguageProvider>,
    )
    await act(async () => {
      vi.advanceTimersByTime(1600)
    })
    const accepter = screen.getByText('Tout accepter')
    expect(() => fireEvent.click(accepter)).not.toThrow()
    expect(screen.queryByText('Tout accepter')).toBeNull()
  })
})
