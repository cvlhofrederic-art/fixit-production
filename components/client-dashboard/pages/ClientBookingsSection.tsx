'use client'

import React from 'react'
import { Calendar, Clock, MapPin, Star, User, MessageSquare } from 'lucide-react'
import { AlertTriangle, CheckCircle, Shield } from 'lucide-react'
import LocaleLink from '@/components/common/LocaleLink'

type Booking = {
  id: string; booking_date: string; booking_time: string; status: string; address: string
  notes: string; price_ttc: number; duration_minutes: number; artisan_id?: string
  confirmed_at?: string; completed_at?: string; expires_at?: string
  services?: { name: string } | null
  profiles_artisan?: { company_name: string; rating_avg: number; rating_count?: number } | null
}

interface ClientBookingsSectionProps {
  activeTab: 'upcoming' | 'past'
  upcomingBookings: Booking[]
  pastBookings: Booking[]
  ratings: Record<string, { stars: number; comment: string }>
  favoris: string[]
  unreadCounts: Record<string, number>
  locale: string
  t: (key: string) => string
  setActiveTab: (tab: string) => void
  openMessages: (booking: Booking) => void
  toggleFavori: (artisanId: string) => void
  loadTracking: (booking: Booking) => void
  setCancelConfirm: (id: string | null) => void
  setRatingModal: (booking: Booking | null) => void
  setRatingVal: (val: number) => void
  setRatingComment: (comment: string) => void
  getStatusBadge: (status: string) => React.ReactNode
  formatPrice: (n: number, locale?: string) => string
  formatDateLocal: (dateStr: string) => string
  getPonctualiteScore: (artisanId: string | undefined) => number | null
}

export default function ClientBookingsSection(props: ClientBookingsSectionProps) {
  const {
    activeTab, upcomingBookings, pastBookings, ratings, favoris, unreadCounts,
    locale, t, openMessages, toggleFavori, loadTracking,
    setCancelConfirm, setRatingModal, setRatingVal, setRatingComment,
    getStatusBadge, formatPrice, formatDateLocal, getPonctualiteScore,
  } = props

  return (
    <div className="space-y-4">
      {(activeTab === 'upcoming' ? upcomingBookings : pastBookings).length === 0 ? (
        <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-12 text-center">
          <div className="text-5xl mb-4">{activeTab === 'upcoming' ? '\uD83D\uDCC5' : '\u2705'}</div>
          <h3 className="text-lg font-display font-bold text-dark mb-2">
            {activeTab === 'upcoming' ? t('clientDash.bookings.noUpcoming') : t('clientDash.bookings.noHistory')}
          </h3>
          <p className="text-text-muted mb-6">
            {activeTab === 'upcoming'
              ? t('clientDash.bookings.noUpcomingDesc')
              : t('clientDash.bookings.noHistoryDesc')
            }
          </p>
          {activeTab === 'upcoming' && (
            <LocaleLink
              href="/recherche"
              className="inline-block bg-[#FFC107] hover:bg-[#FFD54F] text-dark px-8 py-3 rounded-lg font-semibold transition"
            >
              {t('clientDash.bookings.findArtisan')}
            </LocaleLink>
          )}
        </div>
      ) : (
        (activeTab === 'upcoming' ? upcomingBookings : pastBookings).map((booking) => {
          const myRating = ratings[booking.id]
          const isUpcoming = activeTab === 'upcoming'
          const canCancel = isUpcoming && !['cancelled'].includes(booking.status)
          const canRate = !isUpcoming && booking.status === 'completed' && !myRating && booking.price_ttc > 0
          const artisanId = booking.artisan_id || ''
          const isFavori = favoris.includes(artisanId)
          return (
          <div key={booking.id} className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] p-6 hover:shadow-lg hover:-translate-y-px transition">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-dark truncate">
                    {booking.services?.name || 'Service'}
                  </h3>
                  {getStatusBadge(booking.status)}
                  {/* Favori */}
                  {artisanId && (
                    <button
                      onClick={() => toggleFavori(artisanId)}
                      className={`text-lg transition-transform hover:scale-110 ${isFavori ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
                      title={isFavori ? t('clientDash.bookings.removeFromFavorites') : t('clientDash.bookings.addToFavorites')}
                    >
                      ❤️
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 text-sm text-text-muted">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{booking.profiles_artisan?.company_name || 'Artisan'}</span>
                    {booking.profiles_artisan?.rating_avg && (
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {booking.profiles_artisan.rating_avg}
                      </span>
                    )}
                    {/* Badge assurance live */}
                    {booking.profiles_artisan?.rating_count && booking.profiles_artisan.rating_count > 0 && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">{t('clientDash.bookings.insured')}</span>
                    )}
                    {/* Score ponctualité */}
                    {(() => {
                      const score = getPonctualiteScore(booking.artisan_id)
                      if (score === null) return null
                      return (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${
                          score >= 90 ? 'bg-green-100 text-green-700' : score >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          ⏱️ {score}%
                        </span>
                      )
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>{formatDateLocal(booking.booking_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span>{booking.booking_time?.substring(0, 5)} &bull; {booking.duration_minutes || 60} min</span>
                  </div>
                  {booking.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{booking.address}</span>
                    </div>
                  )}
                  {/* 48h countdown */}
                  {booking.status === 'pending' && booking.expires_at && (
                    <div className="flex items-center gap-2 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <span className="text-xs text-amber-600 font-medium">
                        {t('clientDash.bookings.pendingConfirmation')} &bull; {t('clientDash.bookings.expiresOn')} {new Date(booking.expires_at).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                  {/* Confirmed date */}
                  {booking.confirmed_at && (booking.status === 'confirmed' || booking.status === 'completed') && (
                    <div className="flex items-center gap-2 mt-1">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-xs text-green-600 font-medium">
                        Confirmé le {new Date(booking.confirmed_at).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} à {new Date(booking.confirmed_at).toLocaleTimeString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                  {/* Completed date */}
                  {booking.completed_at && booking.status === 'completed' && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <Shield className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span className="text-xs text-blue-600 font-medium">
                        Terminé le {new Date(booking.completed_at).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} à {new Date(booking.completed_at).toLocaleTimeString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                  {/* Notes affichées */}
                  {booking.notes && (
                    <div className="flex items-start gap-2 mt-2 bg-warm-gray rounded-lg px-3 py-2">
                      <span className="text-xs">📝</span>
                      <span className="text-xs text-text-muted">{booking.notes}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xl font-bold text-[#FFC107]">{formatPrice(booking.price_ttc || 0, locale)}</div>
                <div className="text-xs text-text-muted mt-1">{t('clientDash.bookings.ttc')}</div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#EFEFEF]">
              {/* Messages */}
              {booking.status !== 'cancelled' && (
                <button
                  onClick={() => openMessages(booking)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition relative"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> {t('clientDash.bookings.messages')}
                  {unreadCounts[booking.id] > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{unreadCounts[booking.id]}</span>
                  )}
                </button>
              )}
              {/* Suivre GPS */}
              {isUpcoming && booking.status === 'confirmed' && (
                <button
                  onClick={() => loadTracking(booking)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
                >
                  {t('clientDash.bookings.trackArtisan')}
                </button>
              )}
              {/* Annuler */}
              {canCancel && (
                <button
                  onClick={() => setCancelConfirm(booking.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition"
                >
                  {t('clientDash.bookings.cancel')}
                </button>
              )}
              {/* Noter */}
              {canRate && (
                <button
                  onClick={() => { setRatingModal(booking); setRatingVal(5); setRatingComment('') }}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition"
                >
                  {t('clientDash.bookings.leaveReview')}
                </button>
              )}
              {/* Note déjà donnée */}
              {myRating && (
                <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-green-50 text-green-700 border border-green-200">
                  {'⭐'.repeat(myRating.stars)} {t('clientDash.bookings.yourReview')}
                </div>
              )}
              {/* Notation verrouillée (post-facture) */}
              {!isUpcoming && booking.status === 'completed' && !myRating && !(booking.price_ttc > 0) && (
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted px-3 py-2">
                  {t('clientDash.bookings.reviewLockedAfterBilling')}
                </div>
              )}
              {/* Re-réserver */}
              {!isUpcoming && booking.status === 'completed' && (
                <a
                  href={`/recherche?artisan=${artisanId}`}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-[#FFC107]/10 text-amber-700 hover:bg-[#FFC107]/20 border border-amber-200 transition"
                >
                  {t('clientDash.bookings.rebook')}
                </a>
              )}
            </div>
          </div>
          )
        })
      )}
    </div>
  )
}
