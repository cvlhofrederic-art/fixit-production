import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionErrorBoundary } from '@/components/common/SectionErrorBoundary'

const RELOAD_MARKER_KEY = 'vitfix:chunk-reload-at'
const reloadMock = vi.fn()

function Thrower({ error }: { error: Error }): never {
  throw error
}

function chunkError() {
  const e = new Error('Failed to load chunk /_next/static/chunks/09~w6vph~7w6y.js from module 802068')
  e.name = 'ChunkLoadError'
  return e
}

describe('SectionErrorBoundary — récupération ChunkLoadError (bundle périmé après déploiement)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    reloadMock.mockClear()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: Object.assign(new URL('https://vitfix.io/fr/pro/dashboard?p=factures'), { reload: reloadMock }),
    })
    window.sessionStorage.clear()
    // React logge l'erreur capturée par la boundary : on le tait pour garder la sortie test lisible.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    window.sessionStorage.clear()
  })

  it('recharge la page une fois sur ChunkLoadError, sans afficher la boîte rouge', () => {
    render(
      <SectionErrorBoundary fallbackTitle="Erreur dans les factures">
        <Thrower error={chunkError()} />
      </SectionErrorBoundary>
    )
    expect(reloadMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Erreur dans les factures')).not.toBeInTheDocument()
  })

  it('affiche le fallback rouge sur une erreur runtime normale, sans recharger', () => {
    render(
      <SectionErrorBoundary fallbackTitle="Erreur dans les factures">
        <Thrower error={new Error('boom runtime')} />
      </SectionErrorBoundary>
    )
    expect(reloadMock).not.toHaveBeenCalled()
    expect(screen.getByText('Erreur dans les factures')).toBeInTheDocument()
    expect(screen.getByText('Réessayer')).toBeInTheDocument()
  })

  it('ne boucle pas : si un reload récent a déjà eu lieu, affiche le fallback au lieu de recharger', () => {
    window.sessionStorage.setItem(RELOAD_MARKER_KEY, String(Date.now()))
    render(
      <SectionErrorBoundary fallbackTitle="Erreur dans les factures">
        <Thrower error={chunkError()} />
      </SectionErrorBoundary>
    )
    expect(reloadMock).not.toHaveBeenCalled()
    expect(screen.getByText('Erreur dans les factures')).toBeInTheDocument()
  })
})
