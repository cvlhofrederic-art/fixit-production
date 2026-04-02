'use client'

import React from 'react'
import { MessageSquare } from 'lucide-react'

type Booking = {
  id: string; booking_date: string; booking_time: string; status: string; address: string
  notes: string; price_ttc: number; duration_minutes: number; artisan_id?: string
  confirmed_at?: string; completed_at?: string; expires_at?: string
  services?: { name: string } | null
  profiles_artisan?: { company_name: string; rating_avg: number; rating_count?: number } | null
}

interface ClientMessagesSectionProps {
  conversations: { bookingId: string; lastMessage: string; lastDate: string; unread: number; hasDevis: boolean }[]
  conversationsLoading: boolean
  bookings: Booking[]
  locale: string
  t: (key: string) => string
  fetchConversations: () => void
  openMessages: (booking: Booking) => void
  formatDateLocal: (dateStr: string) => string
}

export default function ClientMessagesSection(props: ClientMessagesSectionProps) {
  const {
    conversations, conversationsLoading, bookings, locale, t,
    fetchConversations, openMessages, formatDateLocal,
  } = props

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-display font-black tracking-[-0.02em] text-dark flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-purple-600" /> Messagerie
        </h2>
        <button
          onClick={fetchConversations}
          disabled={conversationsLoading}
          className="text-xs text-text-muted hover:text-[#FFC107] transition"
        >
          {conversationsLoading ? (locale === 'pt' ? 'A carregar...' : 'Chargement...') : (locale === 'pt' ? 'Atualizar' : 'Actualiser')}
        </button>
      </div>

      {conversationsLoading && conversations.length === 0 ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-warm-gray rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-12 text-center">
          <div className="text-5xl mb-4">💬</div>
          <h3 className="text-lg font-display font-bold text-dark mb-2">{locale === 'pt' ? 'Nenhuma conversa' : 'Aucune conversation'}</h3>
          <p className="text-text-muted mb-4">{locale === 'pt' ? 'As suas trocas com os profissionais aparecerão aqui.' : 'Vos échanges avec les artisans apparaîtront ici.'}</p>
          <p className="text-sm text-gray-400">{locale === 'pt' ? 'Clique no botão "Mensagens" numa reserva para iniciar uma conversa.' : 'Cliquez sur le bouton "Messages" sur une réservation pour démarrer une conversation.'}</p>
        </div>
      ) : (
        conversations.map(conv => {
          const booking = bookings.find(b => b.id === conv.bookingId)
          if (!booking) return null
          const artisanInitials = (booking.profiles_artisan?.company_name || 'A').substring(0, 2).toUpperCase()
          return (
            <div
              key={conv.bookingId}
              onClick={() => openMessages(booking)}
              className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-5 hover:shadow-lg transition cursor-pointer border-l-4 border-transparent hover:border-[#FFC107]"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-sm flex-shrink-0">
                  {artisanInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-dark truncate">{booking.profiles_artisan?.company_name || 'Artisan'}</h4>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">
                      {new Date(conv.lastDate).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted truncate">{booking.services?.name || 'Service'} — {formatDateLocal(booking.booking_date)}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className={`text-sm truncate ${conv.unread > 0 ? 'font-semibold text-dark' : 'text-text-muted'}`}>
                      {conv.lastMessage}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {conv.hasDevis && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">📄 Devis</span>}
                      {conv.unread > 0 && (
                        <span className="bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">{conv.unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
