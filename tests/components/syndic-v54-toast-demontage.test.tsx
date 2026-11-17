import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider, useToast, type ToastInput } from '@/components/syndic-dashboard/v54/primitives/toast'

/**
 * Régression : le `ToastProvider` v54 ne coupait pas ses minuteurs d'auto-fermeture au démontage.
 * Un minuteur restant appelait `dismiss` → `setToasts` après coup ; en CI, ce rappel tombait après
 * la fermeture de jsdom (`ReferenceError: window is not defined`, Toast.tsx:98 puis :91) et Vitest
 * sortait en code 1 alors que tous les tests passaient.
 */

function Declencheur({ toasts }: { toasts: ToastInput[] }) {
  const { push } = useToast()
  return (
    <button type="button" onClick={() => toasts.forEach((toast) => push(toast))}>
      Notifier
    </button>
  )
}

const TOASTS: ToastInput[] = [
  { kind: 'success', title: 'Mission créée', duration: 3000 },
  { kind: 'info', title: 'Relance programmée' }, // durée par défaut du kind info (5 s)
]

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ToastProvider v54 — minuteurs au démontage', () => {
  it('coupe les minuteurs d’auto-fermeture quand le provider est démonté', () => {
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(
      <ToastProvider>
        <Declencheur toasts={TOASTS} />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Notifier' }))
    expect(screen.getByText('Mission créée')).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(2)

    unmount()
    expect(vi.getTimerCount()).toBe(0)

    // Comme à la fin d'un fichier de test en CI : plus de `window` quand le minuteur aurait expiré.
    // Un `setToasts` tardif passerait par React, qui lit `window.event`, et lèverait ici.
    vi.stubGlobal('window', undefined)
    expect(() => vi.advanceTimersByTime(10_000)).not.toThrow()
    vi.unstubAllGlobals()

    expect(erreurs).not.toHaveBeenCalled()
  })

  it('garde l’auto-fermeture tant que le provider est monté (StrictMode, nouveau rendu)', () => {
    const { rerender } = render(
      <StrictMode>
        <ToastProvider>
          <Declencheur toasts={TOASTS.slice(0, 1)} />
        </ToastProvider>
      </StrictMode>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Notifier' }))
    expect(screen.getByText('Mission créée')).toBeInTheDocument()

    // Un nouveau rendu du provider ne doit pas déclencher le nettoyage.
    rerender(
      <StrictMode>
        <ToastProvider closeLabel="Fermer">
          <Declencheur toasts={TOASTS.slice(0, 1)} />
        </ToastProvider>
      </StrictMode>,
    )
    expect(vi.getTimerCount()).toBe(1)

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.queryByText('Mission créée')).not.toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)
  })
})
