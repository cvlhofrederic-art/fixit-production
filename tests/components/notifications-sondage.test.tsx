// tests/components/notifications-sondage.test.tsx — lot 8 Sentry du 28/10/2026 : useNotifications ne lance qu'un
// sondage à la fois par endpoint, rien tant que l'onglet est caché, et annule ses requêtes au démontage sans
// avertissement « compteur de messages non lus non rechargé ».

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { POLL_MISSIONS, POLL_NOTIFICATIONS } from '@/lib/constants'

vi.mock('@/lib/supabase', () => {
  const canal: Record<string, unknown> = {}
  canal.on = () => canal
  return { supabase: { channel: vi.fn(() => canal), removeChannel: vi.fn() } }
})
vi.mock('@/lib/realtime-reconnect', () => ({ subscribeWithReconnect: vi.fn() }))

import { useNotifications, sonderQuandVisible } from '@/hooks/useNotifications'

const reponse = (data: unknown) => new Response(JSON.stringify(data), { status: 200 })
const rappels = { onNavigate: vi.fn(), onNewBooking: vi.fn(), getAuthToken: async () => 'tok', t: (k: string) => k, isPt: false }

let cache: boolean
let signaux: Array<AbortSignal | null | undefined>

function definirCache(valeur: boolean) {
  cache = valeur
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  cache = false
  signaux = []
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => cache })
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    signaux.push(init?.signal)
    const u = String(_url)
    if (u.startsWith('/api/pro/messagerie')) return reponse({ conversations: [{ unread_count: 1 }] })
    return reponse({ notifications: [] })
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, 'hidden')
})

const appels = (motif: string) => vi.mocked(fetch).mock.calls.filter(([u]) => String(u).includes(motif)).length

describe('sonderQuandVisible', () => {
  it('appel immédiat puis périodique, un seul intervalle, pause onglet caché, arrêt annule le contrôleur', async () => {
    const action = vi.fn()
    const controleur = new AbortController()
    const arreter = sonderQuandVisible(action, 1000, controleur)
    expect(action).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2000)
    expect(action).toHaveBeenCalledTimes(3)

    definirCache(true)
    await vi.advanceTimersByTimeAsync(3000)
    expect(action).toHaveBeenCalledTimes(3)

    // Deux événements « visible » de suite ne créent pas deux intervalles.
    definirCache(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(action).toHaveBeenCalledTimes(4)
    await vi.advanceTimersByTimeAsync(1000)
    expect(action).toHaveBeenCalledTimes(5)

    arreter()
    expect(controleur.signal.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(5000)
    expect(action).toHaveBeenCalledTimes(5)
  })

  it('monté onglet caché : rien jusqu’au retour au premier plan', async () => {
    cache = true
    const action = vi.fn()
    const arreter = sonderQuandVisible(action, 1000, new AbortController())
    await vi.advanceTimersByTimeAsync(3000)
    expect(action).not.toHaveBeenCalled()
    definirCache(false)
    expect(action).toHaveBeenCalledTimes(1)
    arreter()
  })
})

describe('useNotifications — sondages', () => {
  it('une paire messagerie et une requête notifications au montage, puis une par période, sans doublon', async () => {
    renderHook(() => useNotifications('user-1', 'artisan-1', rappels))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(appels('/api/pro/messagerie')).toBe(2)
    expect(appels('/api/syndic/notify-artisan')).toBe(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MISSIONS) })
    expect(appels('/api/pro/messagerie')).toBe(4)
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_NOTIFICATIONS - POLL_MISSIONS) })
    expect(appels('/api/syndic/notify-artisan')).toBe(2)
  })

  it('démontage : requêtes annulées, aucun avertissement', async () => {
    let liberer: () => void = () => {}
    vi.mocked(fetch).mockImplementation((_url, init) => new Promise((resoudre, rejeter) => {
      signaux.push(init?.signal)
      init?.signal?.addEventListener('abort', () => rejeter(new DOMException('aborted', 'AbortError')))
      liberer = () => resoudre(reponse({ conversations: [] }))
    }))
    const { unmount } = renderHook(() => useNotifications('user-1', 'artisan-1', rappels))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(signaux.length).toBeGreaterThan(0)
    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    expect(signaux.every((s) => s?.aborted)).toBe(true)
    expect(console.warn).not.toHaveBeenCalled()
    liberer()
  })
})
