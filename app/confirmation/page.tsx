'use client'

import { Suspense } from 'react'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import { Star, Check, Home, Printer, Send, MessageSquare } from 'lucide-react'

function getArtisanInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

function formatFrenchDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('fr-FR', {
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

function ConfirmationContent() {
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
    // Fetch booking via API route to bypass RLS
    try {
      const res = await fetch(`/api/booking-detail?id=${bookingId}`)
      const json = await res.json()

      if (json.error || !json.data) {
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

    // Fetch messages for this booking
    try {
      const msgRes = await fetch(`/api/booking-messages?booking_id=${bookingId}`)
      const msgJson = await msgRes.json()
      if (msgJson.data) {
        setMessages(msgJson.data)
        setMyRole(msgJson.role || '')
      }
    } catch {}
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
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [bookingId, booking])

  const sendMessage = async () => {
    if (!newMessage.trim() || !bookingId || sendingMessage) return
    setSendingMessage(true)
    try {
      const res = await fetch('/api/booking-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, content: newMessage.trim() }),
      })
      const json = await res.json()
      if (json.data) {
        setMessages(prev => [...prev, json.data])
        setNewMessage('')
      }
    } catch {}
    setSendingMessage(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFF8E7' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FFC107] border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-500">Chargement de la confirmation...</p>
        </div>
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFF8E7' }}>
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#10060;</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">R&eacute;servation introuvable</h1>
          <p className="text-gray-500 mb-8">
            Nous n&apos;avons pas pu trouver cette r&eacute;servation. Veuillez v&eacute;rifier le lien ou effectuer une nouvelle r&eacute;servation.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-3 rounded-lg font-semibold transition"
          >
            <Home className="w-5 h-5" />
            Retour &agrave; l&apos;accueil
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
    <div className="min-h-screen py-12 px-4" style={{ background: '#FFF8E7' }}>
      <div className="max-w-lg mx-auto">
        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Success header */}
          <div className="pt-10 pb-6 text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-5">
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
              Rendez-vous confirm&eacute; !
            </h1>
            <p className="text-gray-500 text-sm">
              Vous recevrez une confirmation par SMS et email
            </p>
          </div>

          {/* Artisan card */}
          {artisan && (
            <div className="mx-6 mb-6">
              <div className="border-2 border-[#FFC107] rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-[#FFC107] rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 truncate">{artisan.company_name}</h3>
                  <p className="text-xs text-gray-500 truncate">
                    {artisan.categories?.join(' \u00B7 ') || 'Artisan professionnel'}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="w-3.5 h-3.5 fill-[#FFC107] text-[#FFC107]" />
                    <span className="text-sm font-semibold text-[#FFC107]">
                      {artisan.rating_avg || '5.0'}
                    </span>
                    <span className="text-xs text-gray-500">({artisan.rating_count || 0} avis)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Booking details - table style */}
          <div className="mx-6 mb-6">
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Date row */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <span className="flex items-center gap-2 text-gray-500 text-sm">
                  <span className="text-base">{'📅'}</span>
                  Date
                </span>
                <span className="font-semibold text-gray-900 text-sm capitalize">
                  {booking.booking_date ? formatFrenchDate(booking.booking_date) : '-'}
                </span>
              </div>

              {/* Time row */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <span className="flex items-center gap-2 text-gray-500 text-sm">
                  <span className="text-base">{'⏰'}</span>
                  Heure
                </span>
                <span className="font-semibold text-gray-900 text-sm">
                  {startTime} - {endTime}
                </span>
              </div>

              {/* Motif row */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <span className="flex items-center gap-2 text-gray-500 text-sm">
                  <span className="text-base">{'🔧'}</span>
                  Motif
                </span>
                <span className="font-semibold text-gray-900 text-sm text-right max-w-[60%]">
                  {service?.name || 'Intervention personnalis\u00E9e'}
                </span>
              </div>

              {/* Address row */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <span className="flex items-center gap-2 text-gray-500 text-sm">
                  <span className="text-base">{'📍'}</span>
                  Adresse
                </span>
                <span className="font-semibold text-gray-900 text-sm text-right max-w-[60%]">
                  {booking.address || '\u00C0 d\u00E9finir'}
                </span>
              </div>

              {/* Estimate row */}
              {booking.price_ht > 0 && booking.price_ttc > 0 && (
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-gray-500 text-sm">
                      <span className="text-base">{'💰'}</span>
                      Devis estim&eacute;
                    </span>
                    <span className="font-bold text-[#FFC107] text-sm">
                      {booking.price_ht === booking.price_ttc
                        ? `${Number(booking.price_ttc).toLocaleString('fr-FR')} €`
                        : `${Number(booking.price_ht).toLocaleString('fr-FR')} € – ${Number(booking.price_ttc).toLocaleString('fr-FR')} €`
                      }
                      <span className="text-xs font-normal text-gray-500 ml-1">TTC</span>
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    * Estimation indicative. Le montant final d&eacute;pendra des conditions d&apos;acc&egrave;s au chantier, de la complexit&eacute; des travaux et d&apos;autres d&eacute;tails &agrave; clarifier avec l&apos;artisan. Des frais suppl&eacute;mentaires peuvent &ecirc;tre appliqu&eacute;s.
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
                  {'⏳'} <strong>L&apos;artisan a 48h pour confirmer votre RDV.</strong>
                  {' '}Expiration le {new Date(booking.expires_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )}

          {booking.status === 'confirmed' && (
            <div className="mx-6 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
                <p className="text-green-800">
                  {'✅'} <strong>RDV confirm&eacute; par l&apos;artisan !</strong>
                </p>
              </div>
            </div>
          )}

          {/* Messaging section */}
          <div className="mx-6 mb-6">
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-sm text-gray-700">Messagerie avec l&apos;artisan</h3>
              </div>

              {/* Messages list */}
              <div className="max-h-64 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-4">
                    Aucun message pour le moment. Posez une question &agrave; l&apos;artisan ci-dessous.
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
                            ? 'bg-[#FFC107] text-gray-900'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {!isMe && (
                          <p className="text-xs font-semibold mb-0.5 opacity-70">
                            {isAutoReply ? '🤖 R\u00E9ponse automatique' : msg.sender_name || 'Artisan'}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-[10px] opacity-50 mt-1">
                          {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Input */}
              <div className="border-t border-gray-200 p-3 flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="&Eacute;crivez un message..."
                  className="flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 focus:border-[#FFC107] focus:outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                  className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 w-9 h-9 rounded-full flex items-center justify-center transition disabled:opacity-40"
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
                {'🔔'} <strong>Un rappel vous sera envoy&eacute; 24h avant.</strong>
              </p>
              <p className="text-blue-700">
                {'📱'} L&apos;artisan vous contactera 30 minutes avant son arriv&eacute;e.
              </p>
              <p className="text-amber-700">
                {'⚠️'} En cas d&apos;emp&ecirc;chement, annulez au moins 24h &agrave; l&apos;avance.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-6 pb-8 flex gap-3">
            <Link
              href="/"
              className="flex-1 bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 py-3 rounded-xl font-semibold transition text-center text-sm"
            >
              Retour &agrave; l&apos;accueil
            </Link>
            <button
              onClick={() => window.print()}
              className="flex-1 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-xl font-semibold transition text-center text-sm"
            >
              Imprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFF8E7' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FFC107] border-t-transparent mx-auto"></div>
            <p className="mt-4 text-gray-500">Chargement...</p>
          </div>
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  )
}
