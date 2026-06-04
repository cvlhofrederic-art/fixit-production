// tests/components/syndic-v54-batch7.test.tsx
//
// Primitive batch 7 : Toast (ToastProvider + useToast). On teste la mécanique
// (kinds, durées auto, cap 3 FIFO, dismiss, pause hover/focus, value stable,
// noop hors provider) en jsdom avec fake timers ; le rendu visuel + l'inert
// pendant Modal sont en Playwright.

import React, { useState } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react'
import { ToastProvider, useToast, type ToastApi } from '@/components/syndic-dashboard/v54/primitives/toast'

let latestApi: ToastApi | null = null
function Capture() {
  latestApi = useToast()
  return null
}

beforeEach(() => {
  vi.useFakeTimers()
  latestApi = null
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const renderProvider = () => render(<ToastProvider><Capture /></ToastProvider>)
const push = (input: Parameters<ToastApi['push']>[0]) => {
  let id = -1
  act(() => { id = latestApi!.push(input) })
  return id
}
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

describe('syndic v54 — Toast', () => {
  it('1. provider monte : viewport role=region + aria-label', () => {
    renderProvider()
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toBe('Notificações')
  })

  it('2. useToast hors provider : no-op safe (push -> -1, pas de throw)', () => {
    render(<Capture />)
    expect(latestApi!.push({ kind: 'info', title: 'X' })).toBe(-1)
    expect(() => latestApi!.dismiss(1)).not.toThrow()
  })

  it('3. push success : visible + role=status + aria-live polite', () => {
    renderProvider()
    push({ kind: 'success', title: 'Criada', desc: 'ok' })
    const toast = screen.getByRole('status')
    expect(toast.getAttribute('aria-live')).toBe('polite')
    expect(screen.getByText('Criada')).toBeTruthy()
    expect(screen.getByText('ok')).toBeTruthy()
  })

  it('4. push error : role=alert + aria-live assertive + persistant (pas d\'auto-dismiss)', () => {
    renderProvider()
    push({ kind: 'error', title: 'Falha' })
    const toast = screen.getByRole('alert')
    expect(toast.getAttribute('aria-live')).toBe('assertive')
    advance(20000)
    expect(screen.queryByText('Falha')).toBeTruthy() // toujours là (duration 0)
  })

  it('5. durées auto par kind : success disparaît à 4s', () => {
    renderProvider()
    push({ kind: 'success', title: 'S' })
    expect(screen.queryByText('S')).toBeTruthy()
    advance(3999)
    expect(screen.queryByText('S')).toBeTruthy()
    advance(2)
    expect(screen.queryByText('S')).toBeNull()
  })

  it('6. cap 3 FIFO : push 4 -> le plus ancien tombe', () => {
    renderProvider()
    push({ kind: 'error', title: 'T1' })
    push({ kind: 'error', title: 'T2' })
    push({ kind: 'error', title: 'T3' })
    push({ kind: 'error', title: 'T4' })
    expect(screen.queryByText('T1')).toBeNull() // drop du plus vieux
    expect(screen.queryByText('T2')).toBeTruthy()
    expect(screen.queryByText('T3')).toBeTruthy()
    expect(screen.queryByText('T4')).toBeTruthy()
  })

  it('7. dismiss(id) retire le toast', () => {
    renderProvider()
    const id = push({ kind: 'error', title: 'Bye' })
    expect(screen.queryByText('Bye')).toBeTruthy()
    act(() => { latestApi!.dismiss(id) })
    expect(screen.queryByText('Bye')).toBeNull()
  })

  it('8. pause au survol : mouseEnter fige le timer, mouseLeave le relance', () => {
    renderProvider()
    push({ kind: 'success', title: 'Hov' })
    const toast = screen.getByRole('status')
    fireEvent.mouseEnter(toast)
    advance(10000) // timer figé → toujours là
    expect(screen.queryByText('Hov')).toBeTruthy()
    fireEvent.mouseLeave(toast)
    advance(4000) // relancé pour la durée pleine
    expect(screen.queryByText('Hov')).toBeNull()
  })

  it('9. pause au focus-within : focus fige, blur relance', () => {
    renderProvider()
    push({ kind: 'success', title: 'Foc' })
    const toast = screen.getByRole('status')
    fireEvent.focus(toast)
    advance(10000)
    expect(screen.queryByText('Foc')).toBeTruthy()
    fireEvent.blur(toast)
    advance(4000)
    expect(screen.queryByText('Foc')).toBeNull()
  })

  it('10. close : bouton focusable + aria-label, clic dismiss', () => {
    renderProvider()
    push({ kind: 'error', title: 'Cl' })
    const close = screen.getByRole('button', { name: 'Fechar notificação' })
    fireEvent.click(close)
    expect(screen.queryByText('Cl')).toBeNull()
  })

  it('11. value du Context stable entre re-renders du provider (useMemo)', () => {
    const seen: ToastApi[] = []
    function Probe() {
      seen.push(useToast())
      return null
    }
    function App() {
      const [n, setN] = useState(0)
      return (
        <>
          <button data-testid="rr" onClick={() => setN(n + 1)}>{n}</button>
          <ToastProvider><Probe /></ToastProvider>
        </>
      )
    }
    render(<App />)
    fireEvent.click(screen.getByTestId('rr')) // re-render du provider
    expect(seen.length).toBeGreaterThanOrEqual(2)
    expect(seen.every((a) => a === seen[0])).toBe(true) // même référence
  })
})
