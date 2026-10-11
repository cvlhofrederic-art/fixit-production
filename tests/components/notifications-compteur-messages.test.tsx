// tests/components/notifications-compteur-messages.test.tsx
//
// useNotifications (tableaux de bord Artisan ET BTP) — compteur de messages non lus de la sidebar :
// une réponse en erreur de /api/pro/messagerie (429 quand la limite de débit est atteinte, 500) ne
// remet plus le compteur à 0 ; il reste à sa dernière valeur jusqu'à la prochaine réponse valide.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const h = vi.hoisted(() => ({ enErreur: false }))

vi.mock('@/lib/supabase', () => {
  const canal: Record<string, unknown> = {}
  canal.on = () => canal
  return { supabase: { channel: vi.fn(() => canal), removeChannel: vi.fn() } }
})
vi.mock('@/lib/realtime-reconnect', () => ({ subscribeWithReconnect: vi.fn() }))

import { useNotifications } from '@/hooks/useNotifications'

const reponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

beforeEach(() => {
  h.enErreur = false
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url)
    if (!u.startsWith('/api/pro/messagerie')) return reponse({ notifications: [] })
    if (h.enErreur) return reponse({ error: 'rate' }, 429)
    return u.includes('contact_type=pro')
      ? reponse({ conversations: [{ unread_count: 2 }] })
      : reponse({ conversations: [{ unread_count: 1 }] })
  })
})
afterEach(() => { vi.restoreAllMocks() })

const rappels = { onNavigate: vi.fn(), onNewBooking: vi.fn(), getAuthToken: async () => 'tok', t: (k: string) => k, isPt: false }

describe('useNotifications — compteur de messages non lus', () => {
  it('3 non lus, puis réponse 429 : le compteur reste à 3', async () => {
    const { result } = renderHook(() => useNotifications('compte-1', 'profil-1', rappels))
    await waitFor(() => expect(result.current.unreadMsgCount).toBe(3))

    h.enErreur = true
    await act(async () => { await result.current.refreshUnreadMsgCount() })
    expect(result.current.unreadMsgCount).toBe(3)

    h.enErreur = false
    await act(async () => { await result.current.refreshUnreadMsgCount() })
    expect(result.current.unreadMsgCount).toBe(3)
  })
})
