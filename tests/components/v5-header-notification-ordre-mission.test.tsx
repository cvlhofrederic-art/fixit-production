// tests/components/v5-header-notification-ordre-mission.test.tsx
//
// Cloche du tableau de bord V5 (Artisan et BTP) : une notification 'new_mission' qui
// accompagne un ordre de mission (validation dans le Syndic v54) ouvre la Messagerie, où
// l'ordre s'accepte ; une mission de planning sans ordre reste sur l'Agenda.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Notification } from '@/lib/types'

vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr' }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { default: V5Header } = await import('@/components/dashboard/V5Header')

const notif = (n: Partial<Notification>): Notification => ({
  id: 'n1',
  user_id: 'u1',
  type: 'new_mission',
  title: '📅 Nouvelle mission — Plomberie',
  read: true,
  created_at: new Date().toISOString(),
  ...n,
})

function afficher(n: Notification) {
  const navigateTo = vi.fn()
  render(
    <V5Header
      artisan={{ user_id: 'u1', company_name: 'Plomberie Fred' }}
      initials="PF"
      notifications={[n]}
      showNotifDropdown
      setShowNotifDropdown={vi.fn()}
      unreadNotifCount={0}
      setUnreadNotifCount={vi.fn()}
      setNotifications={vi.fn()}
      notifLoading={false}
      setNotifLoading={vi.fn()}
      getDashAuthToken={async () => 'tok'}
      bookings={[]}
      setSelectedBooking={vi.fn()}
      setShowBookingDetail={vi.fn()}
      navigateTo={navigateTo}
      sidebarOpen={false}
      setSidebarOpen={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByText(String(n.title)))
  return navigateTo
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
})

describe('V5Header — clic sur une notification de mission', () => {
  it('ordre de mission (conversation_id + message_type ordre_mission) → Messagerie', async () => {
    const navigateTo = afficher(notif({ data_json: { conversation_id: 'conv-1', message_type: 'ordre_mission', booking_id: null } }))
    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith('messages'))
    expect(navigateTo).not.toHaveBeenCalledWith('calendar')
  })

  it('data_json en texte JSON (colonne texte) → Messagerie aussi', async () => {
    const navigateTo = afficher(notif({ data_json: JSON.stringify({ conversation_id: 'conv-1', message_type: 'ordre_mission' }) }))
    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith('messages'))
  })

  it('mission de planning sans ordre de mission → Agenda (comportement historique)', async () => {
    const navigateTo = afficher(notif({ data_json: { booking_id: 'b-1' } }))
    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith('calendar'))
  })
})
