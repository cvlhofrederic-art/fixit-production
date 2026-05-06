import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('@/lib/i18n/context', () => ({
  useLocale: () => 'fr',
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}))

import V5Header from '@/components/dashboard/V5Header'
import type { Notification, Booking } from '@/lib/types'

type Props = React.ComponentProps<typeof V5Header>

function buildProps(overrides: Partial<Props> = {}): Props {
  return {
    artisan: { user_id: 'u1', company_name: 'ACME' },
    initials: 'AC',
    notifications: [],
    showNotifDropdown: false,
    setShowNotifDropdown: vi.fn(),
    unreadNotifCount: 0,
    setUnreadNotifCount: vi.fn(),
    setNotifications: vi.fn(),
    notifLoading: false,
    setNotifLoading: vi.fn(),
    getDashAuthToken: vi.fn().mockResolvedValue('jwt-token'),
    bookings: [] as Booking[],
    setSelectedBooking: vi.fn(),
    setShowBookingDetail: vi.fn(),
    navigateTo: vi.fn(),
    sidebarOpen: false,
    setSidebarOpen: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
})

describe('V5Header', () => {
  it('renders the artisan initials and a Notifications trigger', () => {
    render(<V5Header {...buildProps()} />)
    expect(screen.getByText('AC')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument()
  })

  it('shows the unread count badge when > 0 and the 99+ cap', () => {
    const { rerender } = render(<V5Header {...buildProps({ unreadNotifCount: 4 })} />)
    expect(screen.getByText('4')).toBeInTheDocument()
    rerender(<V5Header {...buildProps({ unreadNotifCount: 145 })} />)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('toggling the notif button calls setShowNotifDropdown(true)', () => {
    const setShow = vi.fn()
    render(<V5Header {...buildProps({ setShowNotifDropdown: setShow, showNotifDropdown: false })} />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(setShow).toHaveBeenCalledWith(true)
  })

  it('renders the empty-state copy in the dropdown when there are no notifications', () => {
    render(<V5Header {...buildProps({ showNotifDropdown: true })} />)
    expect(screen.getByText('Aucune notification')).toBeInTheDocument()
  })

  it('"Tout marquer comme lu" PATCHes the API and clears unread count', async () => {
    const setUnread = vi.fn()
    const setNotifs = vi.fn()
    const notifs: Notification[] = [
      { id: 'n1', title: 'X', body: '', read: false, type: 'message', created_at: new Date().toISOString() } as unknown as Notification,
    ]
    render(
      <V5Header
        {...buildProps({
          showNotifDropdown: true,
          unreadNotifCount: 1,
          notifications: notifs,
          setUnreadNotifCount: setUnread,
          setNotifications: setNotifs,
        })}
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tout marquer comme lu/i }))
    })

    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/syndic/notify-artisan',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-token' }),
      })
    )
    expect(setUnread).toHaveBeenCalled()
    expect(setNotifs).toHaveBeenCalled()
  })

  it('mobile menu button toggles the sidebar', () => {
    const setSidebar = vi.fn()
    render(<V5Header {...buildProps({ sidebarOpen: false, setSidebarOpen: setSidebar })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(setSidebar).toHaveBeenCalledWith(true)
  })
})
