'use client'

import { Suspense } from 'react'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Star, Check, Home, Send, MessageSquare } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

function getArtisanInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

function ConfirmationContent() {
  const { t, locale } = useTranslation()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const searchParams = useSearchParams()
  const bookingId = searchParams.get('id')

  const [booking, setBooking] = useState<any>(null)
  const [artisan, setArtisan] = useState<any>(null)
  const [service, setService] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [myRole, setMyRole] = useState<string>('')

  function formatLocalDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString(dateFmtLocale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  function formatTime(timeStr: string): string {
    if (!timeStr) return '-'
    return timeStr.substring(0, 5)
  }

  function getEndTime(timeStr: string, durationMinutes: number): string {
    if (!timeStr) return '-'
    const parts = timeStr.substring(0, 5).split(':')
    const totalMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1]) + durationMinutes
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  useEffect(() => {
    if (bookingId) {
      fetchBookingData()
    } else {
      setError(true)
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId])

  const fetchBookingData = async () => {
    // Validate JWT with Supabase server (getUser), then get token for API calls
    const { data: { user: authUser } } = await supabase.auth.getUser()
    let token = ''
    if (authUser) {
      const { data: { session } } = await supabase.auth.getSession()
      token = session?.access_token || ''
    }
    const authHeaders: HeadersInit = token
      ? { Authorization: `Bearer ${token}` }
      : {}

    // Fetch booking via API route (auth requise)
    try {
      const res = await fetch(`/api/booking-detail?id=${bookingId}`, {
        headers: authHeaders,
      })
      const json = await res.json()

      if (json.error || !json.data) {
        console.error('[confirmation] booking-detail error:', json.error)
        setError(true)
        setLoading(false)
        return
      }

      const bookingData = json.data
      setBooking(bookingData)

      // Fetch artisan (public read works with anon key)
      if (bookingData.artisan_id) {
        const { data: artisanData } = await supabase
          .from('profiles_artisan')
          .select('*')
          .eq('id', bookingData.artisan_id)
          .single()

        setArtisan(artisanData)
      }

      // Fetch service (public read works with anon key)
      if (bookingData.service_id) {
        const { data: serviceData } = await supabase
          .from('services')
          .select('*')
          .eq('id', bookingData.service_id)
          .single()

        setService(serviceData)
      }
    } catch (err) {
      console.error('Error fetching booking data:', err)
      setError(true)
    }

    setLoading(false)

    // Fetch messages for this booking (auth requise)
    try {
      const msgRes = await fetch(`/api/booking-messages?booking_id=${bookingId}`, {
        headers: authHeaders,
      })
      const msgJson = await msgRes.json()
      if (msgJson.data) {
        setMessages(msgJson.data)
        setMyRole(msgJson.role || '')
      }
    } catch (msgErr) {
      console.warn('[confirmation] messages fetch failed:', msgErr)
    }
  }

  // Realtime subscription for new messages
  useEffect(() => {
    if (!bookingId || !booking) return
    const channel = supabase
      .channel(`booking_msgs_${bookingId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'booking_messages',
        filter: `booking_id=eq.${bookingId}`,
      }, (payload) => {
        const msg = payload.new as any
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[confirmation] Realtime channel error:', err?.message)
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [bookingId, booking])

  const sendMessage = async () => {
    if (!newMessage.trim() || !bookingId || sendingMessage) return
    setSendingMessage(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch('/api/booking-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ booking_id: bookingId, content: newMessage.trim() }),
      })
      const json = await res.json()
      if (json.data) {
        setMessages(prev => [...prev, json.data])
        setNewMessage('')
      }
    } catch (sendErr) {
      console.warn('[confirmation] send message failed:', sendErr)
    }
    setSendingMessage(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-gray">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-500">{t('confirmation.loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-gray">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">{'❌'}</span>
          </div>
          <h1 className="font-display text-2xl font-black text-dark mb-3 tracking-[-0.03em]">{t('confirmation.notFound.title')}</h1>
          <p className="text-text-muted mb-8">
            {t('confirmation.notFound.desc')}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-yellow hover:bg-yellow-light text-gray-900 px-6 py-3 rounded-lg font-semibold transition"
          >
            <Home className="w-5 h-5" />
            {t('confirmation.backHome')}
          </Link>
        </div>
      </div>
    )
  }

  const initials = artisan ? getArtisanInitials(artisan.company_name || '') : '?'
  const duration = booking.duration_minutes || 60
  const startTime = formatTime(booking.booking_time)
  const endTime = getEndTime(booking.booking_time, duration)

  return (
    <div className="min-h-screen py-12 px-4 bg-warm-gray">
      <div className="max-w-lg mx-auto">
        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border-[1.5px] border-[#EFEFEF] overflow-hidden">
          {/* Success header */}
          <div className="pt-10 pb-6 text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-5">
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-black text-dark mb-1 tracking-[-0.03em]">
              {t('confirmation.success.title')}
            </h1>
            <p className="text-text-muted text-sm">
              {t('confirmation.success.subtitle')}
            </p>
          </div>

          {/* Artisan card */}
          {artisan && (
            <div className="mx-6 mb-6">
              <div className="border-[1.5px] border-yellow rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-dark truncate">{artisan.company_name}</h3>
                  <p className="text-xs text-text-muted truncate">
                    {artisan.categories?.join(' \u00B7 ') || t('confirmation.artisan.defaultCategory')}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="w-3.5 h-3.5 fill-[#FFC107] text-yellow" />
                    <span className="text-sm font-semibold text-yellow">
                      {artisan.rating_avg || '5.0'}
                    </span>
                    <span className="text-xs text-gray-500">({artisan.rating_count || 0} {t('confirmation.artisan.reviews')})</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Booking details - table style */}
          <div className="mx-6 mb-6">
            <div className="border-[1.5px] border-[#EFEFEF] rounded-2xl overflow-hidden">
              {/* Date row */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <span className="flex items-center gap-2 text-text-muted text-sm">
                  <span className="text-base">{'📅'}</span>
                  {t('confirmation.details.date')}
                </span>
                <span className="font-semibold text-dark text-sm capitalize">
                  {booking.booking_date ? formatLocalDate(booking.booking_date) : '-'}
                </span>
              </div>

              {/* Time row */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <span className="flex items-center gap-2 text-text-muted text-sm">
                  <span className="text-base">{'⏰'}</span>
                  {t('confirmation.details.time')}
                </span>
                <span className="font-semibold text-dark text-sm">
                  {startTime} - {endTime}
                </span>
              </div>

              {/* Motif row */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <span className="flex items-center gap-2 text-text-muted text-sm">
                  <span className="text-base">{'🔧'}</span>
                  {t('confirmation.details.reason')}
                </span>
                <span className="font-semibold text-dark text-sm text-right max-w-[60%]">
                  {service?.name || t('confirmation.details.customService')}
                </span>
              </div>

              {/* Address row */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <span className="flex items-center gap-2 text-text-muted text-sm">
                  <span className="text-base">{'📍'}</span>
                  {t('confirmation.details.address')}
                </span>
                <span className="font-semibold text-dark text-sm text-right max-w-[60%]">
                  {booking.address || t('confirmation.details.toDefine')}
                </span>
              </div>

              {/* Estimate row */}
              {booking.price_ht > 0 && booking.price_ttc > 0 && (
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-gray-500 text-sm">
                      <span className="text-base">{'💰'}</span>
                      {t('confirmation.details.estimate')}
                    </span>
                    <span className="font-bold text-yellow text-sm">
                      {booking.price_ht === booking.price_ttc
                        ? `${Number(booking.price_ttc).toLocaleString(dateFmtLocale)} \u20AC`
                        : `${Number(booking.price_ht).toLocaleString(dateFmtLocale)} \u20AC \u2013 ${Number(booking.price_ttc).toLocaleString(dateFmtLocale)} \u20AC`
                      }
                      <span className="text-xs font-normal text-gray-500 ml-1">TTC</span>
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    {t('confirmation.details.estimateNote')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 48h deadline info */}
          {booking.status === 'pending' && booking.expires_at && (
            <div className="mx-6 mb-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                <p className="text-amber-800">
                  {'⏳'} <strong>{t('confirmation.pending.deadline')}</strong>
                  {' '}{t('confirmation.pending.expiresOn')}{' '}{new Date(booking.expires_at).toLocaleDateString(dateFmtLocale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )}

          {booking.status === 'confirmed' && (
            <div className="mx-6 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
                <p className="text-green-800">
                  {'✅'} <strong>{t('confirmation.confirmed.message')}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Messaging section */}
          <div className="mx-6 mb-6">
            <div className="border-[1.5px] border-[#EFEFEF] rounded-2xl overflow-hidden">
              <div className="bg-warm-gray px-4 py-3 border-b border-border flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-text-muted" />
                <h3 className="font-semibold text-sm text-mid">{t('confirmation.messaging.title')}</h3>
              </div>

              {/* Messages list */}
              <div className="max-h-64 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-4">
                    {t('confirmation.messaging.empty')}
                  </p>
                )}
                {messages.map((msg) => {
                  const isMe = msg.sender_role === myRole || (myRole === '' && msg.sender_role === 'client')
                  const isAutoReply = msg.type === 'auto_reply'
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        isAutoReply
                          ? 'bg-blue-50 border border-blue-200 text-blue-800'
                          : isMe
                            ? 'bg-yellow text-gray-900'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {!isMe && (
                          <p className="text-xs font-semibold mb-0.5 opacity-70">
                            {isAutoReply ? t('confirmation.messaging.autoReply') : msg.sender_name || t('confirmation.messaging.artisan')}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-[10px] opacity-50 mt-1">
                          {new Date(msg.created_at).toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Input */}
              <div className="border-t border-border p-3 flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={t('confirmation.messaging.placeholder')}
                  className="flex-1 text-sm border-[1.5px] border-[#E0E0E0] rounded-full px-4 py-2 focus:border-yellow focus:outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                  className="bg-yellow hover:bg-yellow-light text-dark w-9 h-9 rounded-full flex items-center justify-center transition disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Info box */}
          <div className="mx-6 mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm space-y-1.5">
              <p className="text-blue-800">
                {'🔔'} <strong>{t('confirmation.info.reminder')}</strong>
              </p>
              <p className="text-blue-700">
                {'📱'} {t('confirmation.info.contact30min')}
              </p>
              <p className="text-amber-700">
                {'⚠️'} {t('confirmation.info.cancelWarning')}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-6 pb-8 flex gap-3">
            <Link
              href="/"
              className="flex-1 bg-white border-[1.5px] border-[#E0E0E0] text-mid hover:bg-warm-gray py-3 rounded-xl font-semibold transition text-center text-sm"
            >
              {t('confirmation.backHome')}
            </Link>
            <button
              onClick={() => window.print()}
              className="flex-1 bg-yellow hover:bg-yellow-light text-dark py-3 rounded-xl font-semibold transition text-center text-sm hover:-translate-y-px"
            >
              {t('confirmation.print')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmationPage() {
  const { t } = useTranslation()

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-warm-gray">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow border-t-transparent mx-auto"></div>
            <p className="mt-4 text-gray-500">{t('common.loading')}</p>
          </div>
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  )
}
