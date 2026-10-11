// tests/components/messagerie-artisan-polling.test.tsx
//
// Messagerie (tableaux de bord Artisan ET BTP) — clignotement de la liste :
//   - le polling silencieux des messages (5 s) ne relance plus la liste des conversations, les
//     compteurs ni la cloche du parent (avant : 4 requêtes de plus toutes les 5 s → 429) ;
//   - une réponse en erreur (429, 500) ne remplace jamais la liste, les messages ni le cache ;
//   - une seule paire de requêtes pour la liste ET les compteurs non-lus (polling 8 s).

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'

const h = vi.hoisted(() => ({
  appels: [] as Array<{ url: string; method: string }>,
  enErreur: { listes: false, messages: false },
}))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'fr' }),
  useLocale: () => 'fr',
}))
vi.mock('@/lib/supabase', () => {
  const canal: Record<string, unknown> = {}
  canal.on = () => canal
  return {
    supabase: {
      auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })) },
      channel: vi.fn(() => canal),
      removeChannel: vi.fn(),
      from: vi.fn(),
    },
  }
})
vi.mock('@/lib/realtime-reconnect', () => ({ subscribeWithReconnect: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import MessagerieArtisan from '@/components/dashboard/MessagerieArtisan'

const MOI = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const CONV = '55555555-5555-4555-8555-555555555555'
const ARTISAN = { id: 'profil-1', user_id: MOI, company_name: 'Plomberie Fred' }
const CLE_CACHE = `fixit_messagerie_convs_${ARTISAN.id}`

const conversationPro = {
  id: CONV, artisan_id: MOI, contact_id: MOI, contact_type: 'pro', contact_name: 'Cabinet Frédéric',
  contact_avatar: '', last_message_at: '2026-10-11T09:00:00Z', last_message_preview: 'Ordre de mission', unread_count: 2, created_at: '2026-10-11T08:00:00Z',
}
const MESSAGE = {
  id: 'm1', conversation_id: CONV, sender_id: MOI, type: 'text', content: 'Merci de passer avant midi',
  metadata: { cote: 'donneur_ordre' }, read: false, created_at: '2026-10-11T09:00:00Z',
}

const reponse = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response

// Intervalles du composant (5 s messages, 8 s conversations) déclenchés à la main ; les autres
// (waitFor de Testing Library) restent réels.
type Minuterie = { fn: () => void; ms: number }
let minuteries: Minuterie[] = []
const declencher = async (ms: number) => {
  await act(async () => {
    for (const m of minuteries.filter((x) => x.ms === ms)) m.fn()
  })
}

beforeEach(() => {
  localStorage.clear()
  h.appels.length = 0
  h.enErreur.listes = false
  h.enErreur.messages = false
  minuteries = []
  Element.prototype.scrollIntoView = vi.fn()
  const intervalleReel = globalThis.setInterval
  vi.spyOn(globalThis, 'setInterval').mockImplementation(((fn: () => void, ms?: number) => {
    if (ms === 5000 || ms === 8000) {
      minuteries.push({ fn, ms })
      return 0 as unknown as ReturnType<typeof setInterval>
    }
    return intervalleReel(fn, ms)
  }) as typeof setInterval)
  globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url)
    const method = init?.method || 'GET'
    h.appels.push({ url: u, method })
    if (method !== 'GET') return reponse({ success: true })
    if (u.includes('conversation_id=')) return h.enErreur.messages ? reponse({ error: 'rate' }, 429) : reponse({ messages: [MESSAGE] })
    if (h.enErreur.listes) return reponse({ error: 'rate' }, 429)
    if (u.includes('contact_type=pro')) return reponse({ conversations: [conversationPro] })
    return reponse({ conversations: [] })
  }) as typeof fetch
})

afterEach(() => { vi.restoreAllMocks() })

const getsListe = () => h.appels.filter((a) => a.method === 'GET' && a.url.includes('contact_type='))
const getsMessages = () => h.appels.filter((a) => a.method === 'GET' && a.url.includes('conversation_id='))

async function ouvrir(onConversationRead = vi.fn()) {
  render(<MessagerieArtisan artisan={ARTISAN} orgRole="artisan" onConversationRead={onConversationRead} />)
  fireEvent.click(await screen.findByText('Cabinet Frédéric'))
  await screen.findByText('Merci de passer avant midi')
  await waitFor(() => expect(onConversationRead).toHaveBeenCalledTimes(1))
  return onConversationRead
}

describe('MessagerieArtisan — polling sans clignotement', () => {
  it('liste et compteurs non-lus : une seule paire de requêtes par rafraîchissement', async () => {
    render(<MessagerieArtisan artisan={ARTISAN} orgRole="pro_societe" />)
    await screen.findByText('Cabinet Frédéric')
    await waitFor(() => expect(getsListe()).toHaveLength(2))
    // Compteur de l'onglet Pro calculé depuis la même réponse.
    await waitFor(() => expect(screen.getByRole('button', { name: /proDash\.messagerie\.tabPro/ })).toHaveTextContent('proDash.messagerie.tabPro2'))

    h.appels.length = 0
    await declencher(8000)
    await waitFor(() => expect(getsListe()).toHaveLength(2))
  })

  it('polling silencieux des messages (5 s) : ni liste, ni compteurs, ni cloche du parent', async () => {
    const lu = await ouvrir()
    await waitFor(() => expect(getsMessages()).toHaveLength(1))
    // Ouverture : un seul chargement (plus de double appel clic + effet).
    h.appels.length = 0

    await declencher(5000)
    await waitFor(() => expect(getsMessages()).toHaveLength(1))
    expect(getsListe()).toHaveLength(0)
    expect(lu).toHaveBeenCalledTimes(1)
  })

  it('réponse 429 sur la liste : conversations affichées et cache conservés', async () => {
    await ouvrir()
    await waitFor(() => expect(localStorage.getItem(CLE_CACHE)).toContain('Cabinet Frédéric'))

    h.enErreur.listes = true
    h.appels.length = 0
    await declencher(8000)
    await waitFor(() => expect(getsListe()).toHaveLength(2))
    expect(screen.getAllByText('Cabinet Frédéric').length).toBeGreaterThan(0)
    expect(localStorage.getItem(CLE_CACHE)).toContain('Cabinet Frédéric')
  })

  it('réponse 429 sur les messages : fil conservé', async () => {
    await ouvrir()
    h.enErreur.messages = true
    h.appels.length = 0
    await declencher(5000)
    await waitFor(() => expect(getsMessages()).toHaveLength(1))
    expect(screen.getByText('Merci de passer avant midi')).toBeInTheDocument()
    expect(localStorage.getItem(`fixit_messagerie_msgs_${ARTISAN.id}_${CONV}`)).toContain('Merci de passer avant midi')
  })

  it('réponse identique au polling : fil non re-rendu (pas de défilement relancé)', async () => {
    await ouvrir()
    const defilement = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>
    await waitFor(() => expect(getsMessages()).toHaveLength(1))
    defilement.mockClear()
    h.appels.length = 0
    await declencher(5000)
    await waitFor(() => expect(getsMessages()).toHaveLength(1))
    expect(defilement).not.toHaveBeenCalled()
  })
})
