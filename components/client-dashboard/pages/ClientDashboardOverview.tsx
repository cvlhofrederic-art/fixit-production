'use client'

import React, { useState } from 'react'
import { Calendar, Search, ChevronRight, MessageSquare, FileText, FileSearch, Calculator, Wrench, Zap, Paintbrush, Hammer, Snowflake, BrickWall } from 'lucide-react'
import LocaleLink from '@/components/common/LocaleLink'

type Booking = {
  id: string; booking_date: string; booking_time: string; status: string; address: string
  notes: string; price_ttc: number; duration_minutes: number; artisan_id?: string
  confirmed_at?: string; completed_at?: string; expires_at?: string
  services?: { name: string } | null
  profiles_artisan?: { company_name: string; rating_avg: number; rating_count?: number } | null
}

interface ClientDashboardOverviewProps {
  bookings: Booking[]
  upcomingBookings: Booking[]
  pastBookings: Booking[]
  pendingCount: number
  totalUnread: number
  firstName: string
  todayFormatted: string
  locale: string
  t: (key: string) => string
  setActiveTab: (tab: string) => void
  formatDateLocal: (dateStr: string) => string
  getStatusBadge: (status: string) => React.ReactNode
  formatPrice: (n: number, locale?: string) => string
}

export default function ClientDashboardOverview(props: ClientDashboardOverviewProps) {
  const {
    bookings, upcomingBookings, pastBookings, pendingCount, totalUnread,
    firstName, todayFormatted, locale, t, setActiveTab, formatDateLocal, getStatusBadge,
  } = props

  const [dashSubTab, setDashSubTab] = useState<'upcoming' | 'history'>('upcoming')

  return (
    <>
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-8">
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1A1A1A', lineHeight: 1.2 }}>
            {t('clientDash.welcome.hello')} {firstName} {'\uD83D\uDC4B'}
          </h1>
          <p style={{ fontSize: 14, color: '#999999', marginTop: 4 }}>{t('clientDash.welcome.subtitle')}</p>
        </div>
        <p className="hidden sm:block" style={{ fontSize: 13, color: '#999999', textTransform: 'capitalize' }}>{todayFormatted}</p>
      </div>

      {/* Stats grid - 4 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
        {[
          { label: t('clientDash.stats.reservations'), value: bookings.length, icon: '\uD83D\uDCCB', barColor: '#3B82F6' },
          { label: t('clientDash.stats.upcoming'), value: upcomingBookings.length, icon: '\uD83D\uDD50', barColor: '#FFC107' },
          { label: t('clientDash.stats.completed'), value: pastBookings.filter(b => b.status === 'completed').length, icon: '\u2705', barColor: '#22C55E' },
          { label: t('clientDash.stats.pending'), value: pendingCount, icon: '\u23F3', barColor: '#F97316' },
        ].map((stat, i) => (
          <div key={i} className="bg-white relative overflow-hidden" style={{ borderRadius: 16, padding: '20px 20px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>{stat.icon}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#1A1A1A', lineHeight: 1 }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: '#999999', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, marginTop: 6 }}>{stat.label}</div>
            <div className="absolute bottom-0 left-0 right-0" style={{ height: 4, background: stat.barColor }} />
          </div>
        ))}
      </div>

      {/* Promo banner */}
      <LocaleLink
        href="/recherche"
        className="flex items-center justify-between no-underline group mb-8"
        style={{ background: '#FFC107', borderRadius: 16, padding: '24px 28px' }}
      >
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1A1A1A', marginBottom: 8 }}>{t('clientDash.quickAction.title')}</h3>
          <div className="flex flex-wrap gap-2">
            {['Plomberie', 'Électricité', 'Serrurerie', 'Peinture'].map(m => (
              <span key={m} style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 9999, padding: '4px 12px', fontSize: 12, fontWeight: 500, color: '#1A1A1A' }}>{m}</span>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center justify-center group-hover:translate-x-1 transition-transform" style={{ width: 44, height: 44, borderRadius: '50%', background: '#1A1A1A' }}>
          <ChevronRight className="w-5 h-5" style={{ color: 'white' }} />
        </div>
      </LocaleLink>

      {/* Bottom grid: reservations panel + actions */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Left: Reservations panel */}
        <div className="bg-white" style={{ borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          {/* Sub-tabs */}
          <div className="flex" style={{ borderBottom: '1px solid #E8E8E8' }}>
            <button
              onClick={() => setDashSubTab('upcoming')}
              className="flex-1 text-center transition-colors"
              style={{
                padding: '14px 0',
                fontSize: 14,
                fontWeight: dashSubTab === 'upcoming' ? 700 : 400,
                color: dashSubTab === 'upcoming' ? '#1A1A1A' : '#999999',
                borderBottom: dashSubTab === 'upcoming' ? '2px solid #FFC107' : '2px solid transparent',
                background: 'transparent',
                border: 'none',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                borderBottomColor: dashSubTab === 'upcoming' ? '#FFC107' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {t('clientDash.tabs.upcoming')} ({upcomingBookings.length})
            </button>
            <button
              onClick={() => setDashSubTab('history')}
              className="flex-1 text-center transition-colors"
              style={{
                padding: '14px 0',
                fontSize: 14,
                fontWeight: dashSubTab === 'history' ? 700 : 400,
                color: dashSubTab === 'history' ? '#1A1A1A' : '#999999',
                background: 'transparent',
                border: 'none',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                borderBottomColor: dashSubTab === 'history' ? '#FFC107' : 'transparent',
                cursor: 'pointer',
              }}
            >
              Historique ({pastBookings.length})
            </button>
          </div>

          {/* Booking cards (max 3) */}
          <div style={{ padding: 20 }}>
            {(dashSubTab === 'upcoming' ? upcomingBookings : pastBookings).length === 0 ? (
              <div className="text-center" style={{ padding: '32px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{dashSubTab === 'upcoming' ? '\uD83D\uDCC5' : '\u2705'}</div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>
                  {dashSubTab === 'upcoming' ? t('clientDash.bookings.noUpcoming') : t('clientDash.bookings.noHistory')}
                </p>
                <p style={{ fontSize: 13, color: '#999999' }}>
                  {dashSubTab === 'upcoming' ? t('clientDash.bookings.noUpcomingDesc') : t('clientDash.bookings.noHistoryDesc')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {(dashSubTab === 'upcoming' ? upcomingBookings : pastBookings).slice(0, 3).map(booking => (
                  <div
                    key={booking.id}
                    className="flex items-center gap-4 cursor-pointer transition-colors"
                    style={{ padding: '14px 16px', borderRadius: 12, background: '#F5F5F5' }}
                    onClick={() => setActiveTab(dashSubTab === 'upcoming' ? 'upcoming' : 'past')}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#EBEBEB'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = '#F5F5F5'}
                  >
                    <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 42, height: 42, borderRadius: 10, background: 'white' }}>
                      <Calendar className="w-5 h-5" style={{ color: '#FFC107' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
                        {booking.services?.name || 'Service'}
                      </p>
                      <p className="truncate" style={{ fontSize: 12, color: '#999999' }}>
                        {booking.profiles_artisan?.company_name || 'Artisan'} &bull; {formatDateLocal(booking.booking_date)}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(booking.status)}
                    </div>
                  </div>
                ))}

                {(dashSubTab === 'upcoming' ? upcomingBookings : pastBookings).length > 3 && (
                  <button
                    onClick={() => setActiveTab(dashSubTab === 'upcoming' ? 'upcoming' : 'past')}
                    className="w-full text-center transition-colors"
                    style={{ padding: '10px 0', fontSize: 13, fontWeight: 600, color: '#FFC107', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    Voir tout ({(dashSubTab === 'upcoming' ? upcomingBookings : pastBookings).length})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quick actions */}
          <div className="bg-white" style={{ borderRadius: 16, padding: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', marginBottom: 16 }}>{locale === 'pt' ? 'Ações rápidas' : 'Actions rapides'}</p>
            <div className="space-y-2">
              {[
                { label: t('clientDash.findArtisan'), icon: <Search className="w-4 h-4" />, onClick: () => {}, href: '/recherche' },
                { label: locale === 'pt' ? 'Mensagens' : 'Messages', icon: <MessageSquare className="w-4 h-4" />, onClick: () => setActiveTab('messages'), badge: totalUnread },
                { label: locale === 'pt' ? 'Documentos' : 'Documents', icon: <FileText className="w-4 h-4" />, onClick: () => setActiveTab('documents') },
                { label: t('clientDash.tabs.analyseDevis'), icon: <FileSearch className="w-4 h-4" />, onClick: () => setActiveTab('analyse') },
                { label: locale === 'pt' ? 'Simulador de orçamento' : 'Simulateur de devis', icon: <Calculator className="w-4 h-4" />, onClick: () => setActiveTab('simulateur') },
              ].map((action, i) => (
                action.href ? (
                  <LocaleLink
                    key={i}
                    href={action.href}
                    className="flex items-center gap-3 w-full no-underline transition-colors"
                    style={{ padding: '10px 12px', borderRadius: 10, fontSize: 14, color: '#444444', background: '#F5F5F5' }}
                  >
                    <span style={{ color: '#999999' }}>{action.icon}</span>
                    <span className="flex-1">{action.label}</span>
                    <ChevronRight className="w-4 h-4" style={{ color: '#999999' }} />
                  </LocaleLink>
                ) : (
                  <button
                    key={i}
                    onClick={action.onClick}
                    className="flex items-center gap-3 w-full text-left transition-colors"
                    style={{ padding: '10px 12px', borderRadius: 10, fontSize: 14, color: '#444444', background: '#F5F5F5', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#EBEBEB'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#F5F5F5'}
                  >
                    <span style={{ color: '#999999' }}>{action.icon}</span>
                    <span className="flex-1">{action.label}</span>
                    {action.badge && action.badge > 0 ? (
                      <span className="flex items-center justify-center" style={{ minWidth: 20, height: 20, borderRadius: 9999, background: '#EF4444', color: 'white', fontSize: 11, fontWeight: 700, padding: '0 5px' }}>{action.badge}</span>
                    ) : (
                      <ChevronRight className="w-4 h-4" style={{ color: '#999999' }} />
                    )}
                  </button>
                )
              ))}
            </div>
          </div>

          {/* Métiers populaires */}
          <div className="bg-white" style={{ borderRadius: 16, padding: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', marginBottom: 16 }}>Métiers populaires</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Plomberie', icon: <Wrench className="w-4 h-4" />, service: 'plomberie' },
                { label: 'Électricité', icon: <Zap className="w-4 h-4" />, service: 'electricite' },
                { label: 'Peinture', icon: <Paintbrush className="w-4 h-4" />, service: 'peinture' },
                { label: 'Menuiserie', icon: <Hammer className="w-4 h-4" />, service: 'menuiserie' },
                { label: 'Climatisation', icon: <Snowflake className="w-4 h-4" />, service: 'climatisation' },
                { label: 'Maçonnerie', icon: <BrickWall className="w-4 h-4" />, service: 'maconnerie' },
              ].map((m, i) => (
                <LocaleLink
                  key={i}
                  href={`/recherche?service=${m.service}`}
                  className="flex items-center gap-2 no-underline transition-colors"
                  style={{ padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#444444', background: '#F5F5F5' }}
                >
                  <span style={{ color: '#FFC107' }}>{m.icon}</span>
                  {m.label}
                </LocaleLink>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
