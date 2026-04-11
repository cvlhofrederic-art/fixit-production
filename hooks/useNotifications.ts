import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { subscribeWithReconnect } from '@/lib/realtime-reconnect'
import { POLL_NOTIFICATIONS, POLL_MISSIONS, TOAST_LONG, TOAST_DEFAULT } from '@/lib/constants'
import type { Notification } from '@/lib/types'

type RealtimeCallbacks = {
  onNavigate: (page: string) => void
  onNewBooking: (booking: any) => void
  getAuthToken: () => Promise<string | null>
  t: (key: string) => string
  isPt: boolean
}

export function useNotifications(
  userId: string | undefined,
  artisanId: string | undefined,
  callbacks: RealtimeCallbacks
) {
  const { onNavigate, onNewBooking, getAuthToken, t, isPt } = callbacks
  // Refs stables pour éviter les closures stale dans le channel Realtime
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const [unreadMsgCount, setUnreadMsgCount] = useState(0)
  // Browser notifications helper
  const sendBrowserNotif = useCallback((title: string, body: string, onClick?: () => void) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    if (document.visibilityState === 'visible') return
    try {
      const notif = new window.Notification(title, {
        body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: `vitfix-${Date.now()}`,
      })
      if (onClick) notif.onclick = () => { window.focus(); onClick(); notif.close() }
      setTimeout(() => notif.close(), TOAST_LONG)
    } catch {}
  }, [])

  // Request browser notification permission on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (window.Notification.permission === 'default') {
      const timer = setTimeout(() => { window.Notification.requestPermission() }, TOAST_DEFAULT)
      return () => clearTimeout(timer)
    }
  }, [])

  // Load notifications from API — paused when tab is hidden
  useEffect(() => {
    if (!userId) return
    const loadNotifs = async () => {
      try {
        const token = await getAuthToken()
        const res = await fetch(`/api/syndic/notify-artisan?artisan_id=${userId}&limit=30`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (res.ok) {
          const data = await res.json()
          if (data.notifications) {
            setNotifications(data.notifications)
            setUnreadNotifCount(data.notifications.filter((n: Notification) => !n.read).length)
          }
        }
      } catch {}
    }
    loadNotifs()
    let interval = setInterval(loadNotifs, POLL_NOTIFICATIONS)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(interval)
      } else {
        loadNotifs()
        interval = setInterval(loadNotifs, POLL_NOTIFICATIONS)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [userId])

  // Load unread message count — paused when tab is hidden
  const refreshUnreadMsgCount = useCallback(async () => {
    if (!userId) return
    try {
      const token = await getAuthToken()
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const [clientsRes, proRes] = await Promise.all([
        fetch(`/api/pro/messagerie?artisan_user_id=${userId}&contact_type=particulier`, { headers }),
        fetch(`/api/pro/messagerie?artisan_user_id=${userId}&contact_type=pro`, { headers }),
      ])
      const [cd, pd] = await Promise.all([clientsRes.json(), proRes.json()])
      const total = (cd.conversations || []).reduce((s: number, c: any) => s + (c.unread_count || 0), 0) +
                    (pd.conversations || []).reduce((s: number, c: any) => s + (c.unread_count || 0), 0)
      setUnreadMsgCount(total)
    } catch {}
  }, [userId, getAuthToken])

  useEffect(() => {
    if (!userId) return
    refreshUnreadMsgCount()
    let interval = setInterval(refreshUnreadMsgCount, POLL_MISSIONS)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(interval)
      } else {
        refreshUnreadMsgCount()
        interval = setInterval(refreshUnreadMsgCount, POLL_MISSIONS)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [userId])

  // Realtime subscription for notifications + bookings + messages
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notifs_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'artisan_notifications',
        filter: `artisan_id=eq.${userId}`,
      }, (payload) => {
        const n = payload.new as any
        const { t: _t, isPt: _isPt, onNavigate: _onNav } = callbacksRef.current
        if (n.artisan_id === userId) {
          setNotifications(prev => [n, ...prev].slice(0, 30))
          setUnreadNotifCount(prev => prev + 1)
          const typeLabels: Record<string, string> = {
            new_mission: `📋 ${_t('proDash.notifs.newMission')}`,
            mission_update: `🔄 ${_t('proDash.notifs.missionUpdate')}`,
            planning_change: `📅 ${_t('proDash.notifs.planningChange')}`,
            message: `💬 ${_t('proDash.notifs.message')}`,
            new_booking: `📅 ${_t('proDash.notifs.newBooking')}`,
            marche_new: _isPt ? '🏛️ Novo mercado disponível' : '🏛️ Nouveau marché disponible',
            marche_message: _isPt ? '💬 Mensagem no mercado' : '💬 Message sur un marché',
            marche_won: _isPt ? '🎉 Candidatura aceite!' : '🎉 Candidature acceptée !',
            marche_rejected: _isPt ? '❌ Candidatura recusada' : '❌ Candidature refusée',
            tva_threshold: _isPt ? '🧾 Alerta de IVA' : '🧾 Alerte TVA',
            marketplace_demande: _isPt ? '🏗️ Nova solicitação — Marketplace BTP' : '🏗️ Nouvelle demande — Marketplace BTP',
            marketplace_accepte: _isPt ? '✅ Solicitação aceite — Marketplace BTP' : '✅ Demande acceptée — Marketplace BTP',
            marketplace_refuse: _isPt ? '❌ Solicitação recusada — Marketplace BTP' : '❌ Demande refusée — Marketplace BTP',
          }
          sendBrowserNotif(
            typeLabels[n.type] || '🔔 Notification Vitfix',
            n.message || n.title || _t('proDash.notifs.newNotif'),
            () => {
              if (n.type === 'new_mission') _onNav('missions')
              else if (n.type === 'message') _onNav('messages')
              else if (n.type === 'new_booking') _onNav('calendar')
              else if (n.type?.startsWith('marche_')) _onNav('marches')
              else if (n.type?.startsWith('marketplace_')) _onNav('marketplace_btp')
            }
          )
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_messages',
      }, (payload) => {
        const msg = payload.new as any
        const { t: _t, onNavigate: _onNav } = callbacksRef.current
        if (msg.sender_id !== userId) {
          setUnreadMsgCount(prev => prev + 1)
          sendBrowserNotif(
            '💬 Nouveau message',
            msg.content ? (msg.content.length > 80 ? msg.content.substring(0, 80) + '…' : msg.content) : _t('proDash.notifs.newMsgReceived'),
            () => _onNav('messages')
          )
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bookings',
        filter: `artisan_id=eq.${artisanId}`,
      }, (payload) => {
        const b = payload.new as any
        const { isPt: _isPt, onNavigate: _onNav, onNewBooking: _onNew } = callbacksRef.current
        if (b.artisan_id === artisanId) {
          _onNew(b)
          sendBrowserNotif(
            _isPt ? '📅 Nova marcação' : '📅 Nouveau rendez-vous',
            `${b.booking_date || (_isPt ? 'Data a confirmar' : 'Date à confirmer')} — ${b.client_name || (_isPt ? 'Novo cliente' : 'Nouveau client')}`,
            () => _onNav('calendar')
          )
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'booking_messages',
      }, (payload) => {
        const msg = payload.new as any
        if (msg.sender_role === 'client') {
          sendBrowserNotif(
            '💬 ' + (msg.sender_name || 'Client'),
            msg.content ? (msg.content.length > 80 ? msg.content.substring(0, 80) + '…' : msg.content) : 'Nouveau message',
            () => onNavigate('calendar')
          )
        }
      })

    subscribeWithReconnect(channel, (status, err) => {
      console.error(`[pro/dashboard] Realtime ${status}:`, err)
    })
    return () => { supabase.removeChannel(channel) }
  }, [userId, artisanId, sendBrowserNotif])

  return {
    notifications,
    setNotifications,
    showNotifDropdown,
    setShowNotifDropdown,
    unreadNotifCount,
    setUnreadNotifCount,
    unreadMsgCount,
    setUnreadMsgCount,
    refreshUnreadMsgCount,
    sendBrowserNotif,
  }
}
