'use client'

import React from 'react'
import { formatPrice } from '@/lib/utils'
import { Artisan, Service, Booking, Notification } from '@/lib/types'

const formatDateLocale = (dateStr: string, locale: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const loc = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  return d.toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' })
}

interface BookingCardProps {
  booking: Booking
  onProof: () => void
  onStatusChange: (id: string, status: string) => void
  onMessages: () => void
  trackingToken?: string
  onStartTracking: () => void
  onStopTracking: () => void
  onCopyLink: () => void
  linkCopied: boolean
}

interface QuickBtnProps {
  icon: string
  label: string
  onClick: () => void
}

interface MobileHomeSectionProps {
  artisan: Artisan
  bookings: Booking[]
  services: Service[]
  initials: string
  locale: string
  dateFmtLocale: string
  t: (key: string) => string
  todayBookings: Booking[]
  tomorrowBookings: Booking[]
  pendingBookings: Booking[]
  confirmedBookings: Booking[]
  completedBookings: Booking[]
  totalRevenue: number
  activeTrackings: Record<string, string>
  trackingCopied: string | null
  artisanNotifs: Notification[]
  serviceRanges: Record<string, { priceMin: number; priceMax: number; durationEstimate?: string; pricingUnit?: string }>
  isModuleEnabled: (key: string) => boolean
  setActiveTab: (tab: string) => void
  setShowNewRdv: (v: boolean) => void
  setMotifModal: (v: boolean) => void
  setShowDevisModal: (v: boolean) => void
  setProofBooking: (v: Booking) => void
  updateBookingStatus: (id: string, status: string) => void
  openArtisanMessages: (booking: Booking) => void
  startTracking: (booking: Booking) => void
  stopTracking: (bookingId: string) => void
  copyTrackingLink: (bookingId: string) => void
  markNotifRead: (id: string) => void
  BookingCard: React.ComponentType<BookingCardProps>
  QuickBtn: React.ComponentType<QuickBtnProps>
}

export default function MobileHomeSection({
  artisan,
  bookings,
  services,
  initials,
  locale,
  t,
  todayBookings,
  tomorrowBookings,
  pendingBookings,
  confirmedBookings,
  completedBookings,
  totalRevenue,
  activeTrackings,
  trackingCopied,
  serviceRanges,
  isModuleEnabled,
  setActiveTab,
  setShowNewRdv,
  setMotifModal,
  setShowDevisModal,
  setProofBooking,
  updateBookingStatus,
  openArtisanMessages,
  startTracking,
  stopTracking,
  copyTrackingLink,
  BookingCard,
  QuickBtn,
}: MobileHomeSectionProps) {
  return (
        <div>
          {/* Hero header */}
          <div className="bg-gradient-to-br from-[#FFC107] to-[#FFD54F] px-5 pt-12 pb-6 safe-area-pt">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-2xl font-black text-gray-900">FIXIT <span className="text-sm font-bold bg-gray-900 text-[#FFC107] px-2 py-0.5 rounded-full ml-1">PRO</span></div>
                <div className="text-sm font-medium text-gray-800 mt-0.5">{t('mob.hello')}, {artisan?.company_name?.split(' ')[0]} 👋</div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center text-[#FFC107] font-bold text-lg shadow-lg">
                {initials}
              </div>
            </div>

            {/* Today alert */}
            {todayBookings.length > 0 && (
              <div className="bg-white/80 backdrop-blur rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <div>
                  <div className="font-bold text-gray-900 text-sm">{todayBookings.length} {t('mob.rdvToday')}</div>
                  <div className="text-xs text-gray-600">{t('mob.next')} : {todayBookings[0]?.booking_time?.substring(0, 5)} — {todayBookings[0]?.services?.name}</div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="text-2xl font-black text-gray-900">{pendingBookings.length}</div>
                <div className="text-xs text-gray-500 mt-0.5">{t('mob.pendingRdv')}</div>
                {pendingBookings.length > 0 && <div className="text-[10px] text-red-500 font-semibold mt-1">{t('mob.actionRequired')}</div>}
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="text-2xl font-black text-green-600">{formatPrice(totalRevenue)}</div>
                <div className="text-xs text-gray-500 mt-0.5">{t('mob.revenue')}</div>
                <div className="text-[10px] text-gray-500 mt-1">{completedBookings.length} {t('mob.completedPlural')}</div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="text-2xl font-black text-blue-600">{confirmedBookings.length}</div>
                <div className="text-xs text-gray-500 mt-0.5">{t('mob.confirmedPlural')}</div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="text-2xl font-black text-amber-500">⭐ {artisan?.rating_avg || '5.0'}</div>
                <div className="text-xs text-gray-500 mt-0.5">{t('mob.averageRating')}</div>
                <div className="text-[10px] text-gray-500 mt-1">{artisan?.rating_count || 0} {t('mob.reviews')}</div>
              </div>
            </div>

            {/* Score de ponctualité */}
            {isModuleEnabled('ponctualite') && (() => {
              const total = bookings.filter(b => ['completed', 'confirmed', 'cancelled'].includes(b.status)).length
              const rate = total > 0 ? Math.round((completedBookings.length / total) * 100) : 0
              if (total < 3) return null
              const isGood = rate >= 90
              const isMedium = rate >= 70 && rate < 90
              return (
                <div className={`rounded-2xl p-4 flex items-center gap-4 ${isGood ? 'bg-green-50 border border-green-200' : isMedium ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isGood ? 'bg-green-100' : isMedium ? 'bg-amber-100' : 'bg-red-100'}`}>
                    <span className={`text-2xl font-black ${isGood ? 'text-green-700' : isMedium ? 'text-amber-700' : 'text-red-700'}`}>{rate}%</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-800">⏱️ {t('mob.punctualityScore')}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{completedBookings.length}/{total} {t('mob.interventionsDone')}</div>
                    {isGood && <div className="text-[10px] text-green-600 font-semibold mt-1">🏅 {t('mob.excellent')}</div>}
                    {isMedium && <div className="text-[10px] text-amber-600 font-semibold mt-1">⚡ {t('mob.goodScore')}</div>}
                    {!isGood && !isMedium && <div className="text-[10px] text-red-600 font-semibold mt-1">⚠️ {t('mob.toImprove')}</div>}
                  </div>
                </div>
              )
            })()}

            {/* Quick actions */}
            <div>
              <div className="text-sm font-bold text-gray-700 mb-3">{t('mob.quickActions')}</div>
              <div className="grid grid-cols-4 gap-2">
                <QuickBtn icon="📅" label={t('mob.newRdv')} onClick={() => setShowNewRdv(true)} />
                <QuickBtn icon="🔧" label={t('mob.motif')} onClick={() => setMotifModal(true)} />
                <QuickBtn icon="📝" label={t('mob.quote')} onClick={() => setShowDevisModal(true)} />
                <QuickBtn icon="💬" label={t('mob.requests')} onClick={() => setActiveTab('interventions')} />
              </div>
            </div>

            {/* Revenus du mois */}
            {isModuleEnabled('revenus') && (() => {
              const now = new Date()
              const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
              const lastMonth = now.getMonth() === 0
                ? `${now.getFullYear() - 1}-12`
                : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`
              const completedThisMonth = bookings.filter(b => b.status === 'completed' && b.booking_date?.startsWith(thisMonth))
              const completedLastMonth = bookings.filter(b => b.status === 'completed' && b.booking_date?.startsWith(lastMonth))
              const revThisMonth = completedThisMonth.reduce((s: number, b) => s + (b.services?.price_ttc || 0), 0)
              const revLastMonth = completedLastMonth.reduce((s: number, b) => s + (b.services?.price_ttc || 0), 0)
              const diff = revLastMonth > 0 ? Math.round(((revThisMonth - revLastMonth) / revLastMonth) * 100) : 0
              const topServices = services
                .map(s => ({ ...s, count: bookings.filter(b => b.service_id === s.id && b.status === 'completed').length }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 3)
              return (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-gray-700">💰 {t('mob.revenueTitle')}</div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${diff >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {diff >= 0 ? '↑' : '↓'} {Math.abs(diff)}% vs {t('mob.prevMonth')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-green-50 rounded-xl p-3">
                      <div className="text-xs text-gray-500 mb-0.5">{t('mob.thisMonth')}</div>
                      <div className="text-xl font-black text-green-600">{formatPrice(revThisMonth)}</div>
                      <div className="text-[10px] text-gray-500">{completedThisMonth.length} interv.</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-xs text-gray-500 mb-0.5">{t('mob.prevMonth')}</div>
                      <div className="text-xl font-black text-gray-600">{formatPrice(revLastMonth)}</div>
                      <div className="text-[10px] text-gray-500">{completedLastMonth.length} interv.</div>
                    </div>
                  </div>
                  {topServices.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500 font-medium mb-2">{t('mob.topServices')}</div>
                      <div className="space-y-1.5">
                        {topServices.map((s, i) => (
                          <div key={s.id} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 w-4">{i + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-gray-800 truncate">{s.name}</div>
                            </div>
                            <span className="text-xs text-gray-500 flex-shrink-0">{s.count} fois · {serviceRanges[s.id] ? `${serviceRanges[s.id].priceMin}€ - ${serviceRanges[s.id].priceMax}€` : formatPrice(s.price_ttc ?? 0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {topServices.length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-2">
                      {t('mob.completeForStats')}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Pending bookings alert */}
            {pendingBookings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">⏳</span>
                  <span className="font-bold text-amber-800 text-sm">{pendingBookings.length} {t('mob.pendingRequests')}</span>
                </div>
                {pendingBookings.slice(0, 2).map(b => {
                  const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'
                  return (
                    <div key={b.id} className="bg-white rounded-xl p-3 mb-2 border border-amber-100 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-gray-900">{clientName}</div>
                        <div className="text-xs text-gray-500">{b.services?.name} · {formatDateLocale(b.booking_date ?? '', locale)}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateBookingStatus(b.id, 'confirmed')} className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">✓</button>
                        <button onClick={() => updateBookingStatus(b.id, 'cancelled')} className="bg-red-100 text-red-500 px-3 py-1.5 rounded-lg text-xs font-semibold">✕</button>
                      </div>
                    </div>
                  )
                })}
                {pendingBookings.length > 2 && (
                  <button onClick={() => setActiveTab('interventions')} className="text-amber-600 text-xs font-semibold mt-1">
                    {t('mob.seeAll')} ({pendingBookings.length}) →
                  </button>
                )}
              </div>
            )}

            {/* Today's bookings */}
            {todayBookings.length > 0 && (
              <div>
                <div className="text-sm font-bold text-gray-700 mb-3">{t('mob.today')}</div>
                <div className="space-y-2">
                  {todayBookings.map(b => (
                    <BookingCard key={b.id} booking={b} onProof={() => setProofBooking(b)} onStatusChange={updateBookingStatus} onMessages={() => openArtisanMessages(b)} trackingToken={activeTrackings[b.id]} onStartTracking={() => startTracking(b)} onStopTracking={() => stopTracking(b.id)} onCopyLink={() => copyTrackingLink(b.id)} linkCopied={trackingCopied === b.id} />
                  ))}
                </div>
              </div>
            )}

            {/* Tomorrow */}
            {tomorrowBookings.length > 0 && (
              <div>
                <div className="text-sm font-bold text-gray-700 mb-3">{t('mob.tomorrow')}</div>
                <div className="space-y-2">
                  {tomorrowBookings.map(b => (
                    <BookingCard key={b.id} booking={b} onProof={() => setProofBooking(b)} onStatusChange={updateBookingStatus} onMessages={() => openArtisanMessages(b)} trackingToken={activeTrackings[b.id]} onStartTracking={() => startTracking(b)} onStopTracking={() => stopTracking(b.id)} onCopyLink={() => copyTrackingLink(b.id)} linkCopied={trackingCopied === b.id} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
  )
}
