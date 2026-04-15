'use client'

import { toast } from 'sonner'
import { useLocale } from '@/lib/i18n/context'
import type { Notification, Booking } from '@/lib/types'

interface V5HeaderProps {
  artisan: { user_id?: string; company_name?: string } | null
  initials: string
  notifications: Notification[]
  showNotifDropdown: boolean
  setShowNotifDropdown: (v: boolean) => void
  unreadNotifCount: number
  setUnreadNotifCount: (fn: (prev: number) => number) => void
  setNotifications: (fn: (prev: Notification[]) => Notification[]) => void
  notifLoading: boolean
  setNotifLoading: (v: boolean) => void
  getDashAuthToken: () => Promise<string | null>
  bookings: Booking[]
  setSelectedBooking: (b: Booking) => void
  setShowBookingDetail: (v: boolean) => void
  navigateTo: (page: string) => void
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
}

export default function V5Header({
  artisan, initials, notifications,
  showNotifDropdown, setShowNotifDropdown,
  unreadNotifCount, setUnreadNotifCount,
  setNotifications, notifLoading, setNotifLoading,
  getDashAuthToken, bookings,
  setSelectedBooking, setShowBookingDetail,
  navigateTo, sidebarOpen, setSidebarOpen,
}: V5HeaderProps) {

  const locale = useLocale()
  const isPt = locale === 'pt'

  const markAllRead = async () => {
    setNotifLoading(true)
    try {
      const token = await getDashAuthToken()
      await fetch('/api/syndic/notify-artisan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ mark_all_read: true, artisan_id: artisan?.user_id }),
      })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadNotifCount(() => 0)
    } catch {
      toast.error(isPt ? 'Impossível marcar as notificações como lidas' : 'Impossible de marquer les notifications comme lues')
    } finally {
      setNotifLoading(false)
    }
  }

  const handleNotifClick = async (n: Notification) => {
    if (!n.read) {
      setNotifLoading(true)
      try {
        const token = await getDashAuthToken()
        await fetch('/api/syndic/notify-artisan', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ notification_id: n.id, artisan_id: artisan?.user_id }),
        })
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
        setUnreadNotifCount(prev => Math.max(0, prev - 1))
      } catch {
        toast.error(isPt ? 'Impossível marcar a notificação como lida' : 'Impossible de marquer la notification comme lue')
      } finally {
        setNotifLoading(false)
      }
    }
    setShowNotifDropdown(false)

    // Navigation by type
    if (n.type === 'message' || n.type === 'booking_message') {
      navigateTo('messages')
    } else if (n.type === 'new_booking') {
      const dataJson = typeof n.data_json === 'string' ? JSON.parse(n.data_json || '{}') : (n.data_json || {})
      const bookingId = dataJson.booking_id
      const found = bookingId ? bookings.find((b: Booking) => b.id === bookingId) : null
      if (found) {
        setSelectedBooking(found)
        setShowBookingDetail(true)
        navigateTo('calendar')
      } else {
        navigateTo('calendar')
      }
    } else if (n.type === 'new_mission' || n.type === 'planning_change') {
      navigateTo('calendar')
    } else if (n.type === 'devis_signed') {
      navigateTo('devis')
    } else if (n.type === 'tva_threshold') {
      navigateTo('comptabilite')
    } else if (n.type?.startsWith('marketplace_')) {
      navigateTo('marketplace_btp')
    } else {
      navigateTo('home')
    }
  }

  const getNotifIcon = (type?: string) => {
    if (type === 'message' || type === 'booking_message') return '💬'
    if (type === 'new_booking') return '📅'
    if (type === 'devis_signed') return '📄'
    if (type === 'tva_threshold') return '🧮'
    if (type === 'new_mission' || type === 'planning_change') return '📋'
    if (type?.startsWith('marketplace_')) return '🏪'
    return '🔔'
  }

  const getRelativeTime = (dateStr?: string) => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return isPt ? 'agora mesmo' : "à l'instant"
    if (mins < 60) return `${mins}min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}j`
  }

  return (
    <header className="v5-hdr">
      {/* Mobile menu button */}
      <button
        className="md:hidden"
        style={{ position: 'absolute', left: 16, background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#333' }}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Menu"
      >
        ☰
      </button>

      {/* Notifications */}
      <div className="v5-notif-wrap">
        <button className="v5-notif-btn" onClick={() => setShowNotifDropdown(!showNotifDropdown)} aria-label={unreadNotifCount > 0 ? (isPt ? `Notificações (${unreadNotifCount} não lidas)` : `Notifications (${unreadNotifCount} non lues)`) : (isPt ? 'Notificações' : 'Notifications')}>
          Notifications
          {unreadNotifCount > 0 && (
            <span style={{ background: '#fff', color: '#F57C00', borderRadius: 8, padding: '0 5px', fontSize: 10, fontWeight: 700, marginLeft: 4 }}>
              {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
            </span>
          )}
          <span style={{ fontSize: 14, marginLeft: 3 }}>▾</span>
        </button>

        {showNotifDropdown && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowNotifDropdown(false)} />
            <div className="v5-notif-dd" style={{ zIndex: 100, maxWidth: 'calc(100vw - 20px)' }}>
              <div className="v5-notif-dd-hdr">
                <span className="v5-notif-dd-title">{isPt ? 'Notificações' : 'Notifications'}</span>
                {unreadNotifCount > 0 && (
                  <button className="v5-notif-dd-link" onClick={markAllRead} type="button">
                    {isPt ? 'Marcar tudo como lido' : 'Tout marquer comme lu'}
                  </button>
                )}
              </div>
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: '#999' }}>
                    {isPt ? 'Sem notificações' : 'Aucune notification'}
                  </div>
                ) : (
                  notifications.slice(0, 20).map((n: Notification) => (
                    <div
                      key={n.id}
                      className={`v5-notif-item${!n.read ? ' unread' : ''}`}
                      style={{ cursor: notifLoading ? 'wait' : 'pointer' }}
                      onClick={() => handleNotifClick(n)}
                    >
                      <div
                        className="v5-notif-av"
                        style={{ background: !n.read ? '#FFF8E1' : '#F5F5F5' }}
                      >
                        {getNotifIcon(n.type)}
                      </div>
                      <div className="v5-notif-body">
                        <div className="v5-notif-text">
                          <strong>{n.title}</strong>
                        </div>
                        {n.body && (
                          <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                            {n.body}
                          </div>
                        )}
                        <div className="v5-notif-time">
                          {getRelativeTime(n.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Avatar */}
      <div className="v5-hdr-avatar" title={artisan?.company_name || 'Pro'}>
        {initials}
      </div>
    </header>
  )
}
