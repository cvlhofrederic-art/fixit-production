// tests/components/notifications-messages-societe.test.tsx
//
// useNotifications (tableaux de bord Artisan ET BTP) — message reçu en temps réel (relecture du 26/11/2026).
// Depuis le lot 2 des comptes invités, un co-gérant ou une secrétaire répond au nom de la société : son message porte
// SON compte en expéditeur et le côté du prestataire (`metadata.cote = 'artisan'`). Le tableau de bord du gérant le
// comptait comme un message reçu et envoyait la notification « Nouveau message » pour un message de sa propre société.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

type Rappel = (charge: { new: Record<string, unknown> }) => void
const h = vi.hoisted(() => ({ ecouteurs: [] as Array<{ table?: string; rappel: Rappel }> }))

vi.mock('@/lib/supabase', () => {
  const canal: Record<string, unknown> = {}
  canal.on = (_evenement: string, filtre: { table?: string }, rappel: Rappel) => {
    h.ecouteurs.push({ table: filtre?.table, rappel })
    return canal
  }
  return { supabase: { channel: vi.fn(() => canal), removeChannel: vi.fn() } }
})
vi.mock('@/lib/realtime-reconnect', () => ({ subscribeWithReconnect: vi.fn() }))

import { useNotifications } from '@/hooks/useNotifications'

const reponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
let notificationsDuNavigateur: string[]

beforeEach(() => {
  h.ecouteurs.length = 0
  notificationsDuNavigateur = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url)
    if (!u.startsWith('/api/pro/messagerie')) return reponse({ notifications: [] })
    return u.includes('contact_type=pro')
      ? reponse({ conversations: [{ unread_count: 2 }] })
      : reponse({ conversations: [{ unread_count: 1 }] })
  })
  // Notifications autorisées, onglet en arrière-plan : la seule situation où le hook en envoie une.
  class NotificationEssai {
    static permission = 'granted'
    onclick: unknown = null
    constructor(titre: string) { notificationsDuNavigateur.push(titre) }
    close() { /* rien à fermer */ }
  }
  vi.stubGlobal('Notification', NotificationEssai)
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, 'visibilityState')
})

const rappels = { onNavigate: vi.fn(), onNewBooking: vi.fn(), getAuthToken: async () => 'tok', t: (k: string) => k, isPt: true }

/** Tableau de bord ouvert (société BTP par défaut), compteur chargé (3 non lus), puis un message inséré en base. */
async function recevoir(message: Record<string, unknown>, estSociete = true) {
  const rendu = renderHook(() => useNotifications('compte-gerant', 'fiche-societe', { ...rappels, estSociete }))
  await waitFor(() => expect(rendu.result.current.unreadMsgCount).toBe(3))
  act(() => {
    for (const e of h.ecouteurs.filter(x => x.table === 'conversation_messages')) e.rappel({ new: message })
  })
  return rendu.result
}

describe('useNotifications — message reçu en temps réel', () => {
  it('message d’un collègue de la société (côté prestataire) : ni compteur ni notification chez le gérant', async () => {
    const resultat = await recevoir({ sender_id: 'compte-secretaire', content: 'Bem recebido', metadata: { cote: 'artisan' } })

    expect(resultat.current.unreadMsgCount).toBe(3)
    expect(notificationsDuNavigateur).toEqual([])
  })

  it('message du contact : compté et notifié, comme avant', async () => {
    const resultat = await recevoir({ sender_id: 'compte-syndic', content: 'Pode vir amanhã?', metadata: { cote: 'donneur_ordre' } })

    expect(resultat.current.unreadMsgCount).toBe(4)
    expect(notificationsDuNavigateur).toEqual(['💬 Nova mensagem'])
  })

  it('message du contact sans côté (particulier) : compté, comme avant', async () => {
    const resultat = await recevoir({ sender_id: 'compte-client', content: 'Olá', metadata: null })

    expect(resultat.current.unreadMsgCount).toBe(4)
  })

  // Règle n° 1 : le filtre du côté prestataire ne vise que la société BTP.
  it('artisan : un message marqué côté prestataire mais d’un autre compte reste compté, comme avant', async () => {
    const resultat = await recevoir({ sender_id: 'compte-client', content: 'Olá', metadata: { cote: 'artisan' } }, false)

    expect(resultat.current.unreadMsgCount).toBe(4)
  })

  it('son propre message : ignoré, comme avant', async () => {
    const resultat = await recevoir({ sender_id: 'compte-gerant', content: 'Até amanhã', metadata: { cote: 'artisan' } })

    expect(resultat.current.unreadMsgCount).toBe(3)
    expect(notificationsDuNavigateur).toEqual([])
  })
})
