'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { useThemeVars } from './useThemeVars'
import ResumeActivite from '@/components/stats/ResumeActivite'

async function downloadCsv(type: 'clients' | 'bookings' | 'revenue') {
  const res = await fetch(`/api/user/export-csv?type=${type}`)
  if (!res.ok) {
    toast.error('Erreur lors de l\'export')
    return
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || `${type}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface StatsRevenusSectionProps {
  artisan: import('@/lib/types').Artisan
  bookings: import('@/lib/types').Booking[]
  services: import('@/lib/types').Service[]
  pendingBookings: import('@/lib/types').Booking[]
  completedBookings: import('@/lib/types').Booking[]
  totalRevenue: number
  activePage: string
  orgRole?: OrgRole
}

export default function StatsRevenusSection({
  artisan, bookings, services, pendingBookings, completedBookings, totalRevenue, activePage, orgRole,
}: StatsRevenusSectionProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)

  /* ═══════════════════════════════════════════
     V5 layout — pro_societe only
     ═══════════════════════════════════════════ */
  if (isV5 && activePage === 'stats') {
    return <StatsV5 bookings={bookings} totalRevenue={totalRevenue} services={services} artisan={artisan} locale={locale} />
  }
  if (isV5 && activePage === 'revenus') {
    return <RevenusV5 bookings={bookings} completedBookings={completedBookings} pendingBookings={pendingBookings} totalRevenue={totalRevenue} locale={locale} t={t} />
  }

  /* ═══════════════════════════════════════════
     V22 layout — artisan and other roles
     ═══════════════════════════════════════════ */
  if (activePage === 'stats') {
    return (
      <div>
        <div className="v22-page-header">
          <div>
            <div className="v22-page-title">{'📊'} {t('proDash.stats.title')}</div>
            <div className="v22-page-sub">{t('proDash.stats.subtitle')}</div>
          </div>
        </div>
        <div style={{ padding: '20px' }}>
          <ResumeActivite />
          <div className="v22-stats">
            <div className="v22-stat">
              <div className="v22-stat-label">{t('proDash.stats.interventionsTotales')}</div>
              <div className="v22-stat-val">{bookings.length}</div>
              <div className="v22-stat-delta v22-up">{'📅'} {completedBookings.length} {t('proDash.home.terminees')}</div>
            </div>
            <div className="v22-stat v22-stat-yellow">
              <div className="v22-stat-label">{t('proDash.stats.chiffreAffaires')}</div>
              <div className="v22-stat-val">{formatPrice(totalRevenue, locale)}</div>
              <div className="v22-stat-delta">{'💰'} {bookings.length} {t('proDash.clients.interventions')}</div>
            </div>
            <div className="v22-stat">
              <div className="v22-stat-label">{t('proDash.stats.noteMoyenne')}</div>
              <div className="v22-stat-val">{artisan?.rating_avg || '5.0'}/5</div>
              <div className="v22-stat-delta v22-up">{'⭐'} {artisan?.rating_count || 0} {t('proDash.home.avis')}</div>
            </div>
            <div className="v22-stat">
              <div className="v22-stat-label">{t('proDash.stats.motifsActifs')}</div>
              <div className="v22-stat-val">{services.filter(s => s.active).length}</div>
              <div className="v22-stat-delta">{'🔧'} {services.length} {t('proDash.stats.auTotal')}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // activePage === 'revenus'
  return (
    <div>
      <ExportHeader t={t} />
      <div style={{ padding: '20px' }}>
        <ResumeActivite />
        <div className="v22-stats" style={{ marginBottom: '20px' }}>
          <div className="v22-stat">
            <div className="v22-stat-label">{t('proDash.stats.totalEncaisse')}</div>
            <div className="v22-stat-val" style={{ color: tv.green }}>{formatPrice(totalRevenue, locale)}</div>
            <div className="v22-stat-delta v22-up">{completedBookings.length} {t('proDash.stats.interventionsTerminees')}</div>
          </div>
          <div className="v22-stat v22-stat-yellow">
            <div className="v22-stat-label">{t('proDash.stats.enAttenteEncaissement')}</div>
            <div className="v22-stat-val">{formatPrice(pendingBookings.reduce((s, b) => s + (b.price_ttc || 0), 0), locale)}</div>
            <div className="v22-stat-delta">{pendingBookings.length} {t('proDash.home.enAttente')}</div>
          </div>
          <div className="v22-stat">
            <div className="v22-stat-label">{t('proDash.stats.ticketMoyen')}</div>
            <div className="v22-stat-val">{formatPrice(bookings.reduce((s, b) => s + (b.price_ttc || 0), 0), locale)}</div>
            <div className="v22-stat-delta">{bookings.length} {t('proDash.clients.interventions')} {t('proDash.stats.auTotal')}</div>
          </div>
        </div>

        {bookings.length > 0 ? (
          <div className="v22-card">
            <div className="v22-card-head">
              <div className="v22-card-title">{'💰'} {t('proDash.stats.revenusTitle')}</div>
              <div className="v22-card-meta">{bookings.length} {t('proDash.clients.interventions')}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t('proDash.calendar.date')}</th>
                  <th>Service</th>
                  <th>{t('proDash.calendar.montantTTC')}</th>
                  <th>{t('proDash.motifs.colStatut')}</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>{b.booking_date}</td>
                    <td>{b.services?.name || 'Service'}</td>
                    <td>
                      <span className="v22-amount" style={{
                        color: b.status === 'completed' ? tv.green : b.status === 'pending' ? tv.primary : tv.textMuted
                      }}>
                        {b.status !== 'cancelled' ? `+${formatPrice(b.price_ttc || 0, locale)}` : '-'}
                      </span>
                    </td>
                    <td>
                      <span className={`v22-tag ${
                        b.status === 'completed' ? 'v22-tag-green' :
                        b.status === 'confirmed' ? 'v22-tag-yellow' :
                        b.status === 'pending' ? 'v22-tag-amber' :
                        'v22-tag-red'
                      }`}>
                        {b.status === 'completed' ? t('proDash.home.termine') :
                         b.status === 'confirmed' ? t('proDash.home.confirme') :
                         b.status === 'pending' ? t('proDash.home.enAttenteStat') :
                         t('proDash.home.annule')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="v22-card" style={{ padding: '40px', textAlign: 'center' }}>
            <span style={{ color: tv.textMuted, fontSize: '12px' }}>{t('proDash.home.aucuneActivite')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ExportHeader({ t }: { t: (k: string) => string }) {
  const tv = useThemeVars(false)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const handleExport = async (type: 'clients' | 'bookings' | 'revenue') => {
    setLoading(type)
    setOpen(false)
    await downloadCsv(type)
    setLoading(null)
  }

  return (
    <div className="v22-page-header" style={{ justifyContent: 'space-between' }}>
      <div>
        <div className="v22-page-title">{'💰'} {t('proDash.stats.revenusTitle')}</div>
        <div className="v22-page-sub">{t('proDash.stats.revenusTitle')}</div>
      </div>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(!open)}
          disabled={loading !== null}
          className="v22-btn v22-btn-primary"
          style={{ opacity: loading ? 0.5 : 1 }}
        >
          {loading ? '⏳ ...' : `📊 ${t('proDash.stats.exporter')}`}
        </button>
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
            <div className="v22-card" style={{
              position: 'absolute',
              right: 0,
              top: '40px',
              zIndex: 50,
              width: '220px',
              padding: '4px 0',
            }}>
              <button
                onClick={() => handleExport('clients')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 14px',
                  fontSize: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: tv.text,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = tv.bg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span>{'👥'}</span> {t('proDash.export.clients')}
              </button>
              <button
                onClick={() => handleExport('bookings')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 14px',
                  fontSize: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: tv.text,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = tv.bg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span>{'📋'}</span> {t('proDash.export.bookings')}
              </button>
              <button
                onClick={() => handleExport('revenue')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 14px',
                  fontSize: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: tv.text,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = tv.bg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span>{'💰'}</span> {t('proDash.export.revenue')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PageHeader({ title, subtitle, actionLabel, onAction }: { title: string; subtitle: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="v22-page-header" style={{ justifyContent: 'space-between' }}>
      <div>
        <div className="v22-page-title">{title}</div>
        <div className="v22-page-sub">{subtitle}</div>
      </div>
      <button onClick={onAction} className="v22-btn v22-btn-primary">
        {actionLabel}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   V5 sub-component — Stats for pro_societe
   ═══════════════════════════════════════════════════════ */
function StatsV5({ bookings, totalRevenue, services, artisan, locale }: {
  bookings: import('@/lib/types').Booking[]
  totalRevenue: number
  services: import('@/lib/types').Service[]
  artisan: import('@/lib/types').Artisan
  locale: string
}) {
  const activeChantiers = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending').length
  const completedCount = bookings.filter(b => b.status === 'completed').length
  const totalOffers = bookings.length
  const signedCount = completedCount
  const tauxTransformation = totalOffers > 0 ? Math.round((signedCount / totalOffers) * 100) : 0
  const panierMoyen = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0

  // Monthly revenue for last 6 months
  const now = new Date()
  const months: { label: string; value: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthLabel = d.toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { month: 'short' })
    const monthBookings = bookings.filter(b => {
      if (!b.booking_date) return false
      const bd = new Date(b.booking_date)
      return bd.getMonth() === d.getMonth() && bd.getFullYear() === d.getFullYear()
    })
    const rev = monthBookings.reduce((s, b) => s + (b.price_ttc || 0), 0)
    months.push({ label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), value: rev })
  }
  const maxMonthly = Math.max(...months.map(m => m.value), 1)

  return (
    <div className="v5-fade">
      <div className="v5-pg-t"><h1>Statistiques</h1><p>Analyse de l&apos;activité BTP</p></div>

      {/* 4 KPIs */}
      <div className="v5-kpi-g">
        <div className="v5-kpi hl">
          <div className="v5-kpi-l">CA mensuel</div>
          <div className="v5-kpi-v">{formatPrice(months[months.length - 1]?.value || 0, locale)}</div>
          <div className="v5-kpi-s">{months[months.length - 1]?.label || ''} {now.getFullYear()}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">Chantiers actifs</div>
          <div className="v5-kpi-v">{activeChantiers}</div>
          <div className="v5-kpi-s">ce mois</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">Taux transformation</div>
          <div className="v5-kpi-v">{tauxTransformation}%</div>
          <div className="v5-kpi-s">offres → signées</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">Panier moyen</div>
          <div className="v5-kpi-v">{formatPrice(panierMoyen, locale)}</div>
          <div className="v5-kpi-s">par chantier</div>
        </div>
      </div>

      {/* Charts */}
      <div className="v5-sg2">
        {/* Bar chart — CA mensuel 6 mois */}
        <div className="v5-card">
          <div className="v5-st">CA mensuel — 6 derniers mois</div>
          <div className="ch-bar-c" style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, padding: '0 8px' }}>
            {months.map((m, i) => {
              const pct = maxMonthly > 0 ? Math.round((m.value / maxMonthly) * 100) : 0
              return (
                <div key={i} className="ch-bar-i" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="ch-bar" style={{
                    height: `${Math.max(pct, 5)}%`,
                    width: '100%',
                    maxWidth: 40,
                    background: 'var(--v5-primary-yellow)',
                    borderRadius: '3px 3px 0 0',
                    position: 'relative',
                    minHeight: 4,
                  }}>
                    <span className="ch-bar-v" style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {m.value >= 1000 ? `${Math.round(m.value / 1000)}k` : m.value > 0 ? `${m.value}` : ''}
                    </span>
                  </div>
                  <div className="ch-bar-lb" style={{ fontSize: 10, color: '#999', marginTop: 4 }}>{m.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pie chart — Répartition CA par service */}
        <div className="v5-card">
          <div className="v5-st">Répartition CA par service</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem 0' }}>
            {/* Pie placeholder */}
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: `conic-gradient(
                #FFC107 0% 32%,
                #FF9800 32% 52%,
                #4CAF50 52% 68%,
                #2196F3 68% 82%,
                #9C27B0 82% 92%,
                #E91E63 92% 100%
              )`,
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>
                100%
              </div>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
              {services.filter(s => s.active).slice(0, 6).map((s, i) => {
                const colors = ['#FFC107', '#FF9800', '#4CAF50', '#2196F3', '#9C27B0', '#E91E63']
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
                    <span style={{ color: '#666' }}>{s.name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   V5 sub-component — Revenus for pro_societe
   ═══════════════════════════════════════════════════════ */
function RevenusV5({ bookings, completedBookings, pendingBookings, totalRevenue, locale, t }: {
  bookings: import('@/lib/types').Booking[]
  completedBookings: import('@/lib/types').Booking[]
  pendingBookings: import('@/lib/types').Booking[]
  totalRevenue: number
  locale: string
  t: (k: string) => string
}) {
  const pendingAmount = pendingBookings.reduce((s, b) => s + (b.price_ttc || 0), 0)
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const monthlyEncaissements = completedBookings.filter(b => {
    if (!b.booking_date) return false
    const bd = new Date(b.booking_date)
    return bd.getMonth() === currentMonth && bd.getFullYear() === currentYear
  }).reduce((s, b) => s + (b.price_ttc || 0), 0)

  // Recouvrement rate
  const totalBilled = bookings.reduce((s, b) => s + (b.price_ttc || 0), 0)
  const recouvrementPct = totalBilled > 0 ? Math.round((totalRevenue / totalBilled) * 100) : 100

  // Recent encaissements (completed bookings sorted by date desc)
  const recentEncaissements = completedBookings
    .filter(b => b.price_ttc && b.price_ttc > 0)
    .sort((a, b) => new Date(b.booking_date || '').getTime() - new Date(a.booking_date || '').getTime())
    .slice(0, 10)

  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  return (
    <div className="v5-fade">
      <div className="v5-pg-t"><h1>Revenus</h1><p>Flux de trésorerie et encaissements</p></div>

      {/* 4 KPIs */}
      <div className="v5-kpi-g">
        <div className="v5-kpi hl">
          <div className="v5-kpi-l">CA {currentYear}</div>
          <div className="v5-kpi-v">{formatPrice(totalRevenue, locale)}</div>
          <div className="v5-kpi-s">cumulé</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">Encaissements {now.toLocaleDateString(dateLocale, { month: 'long' })}</div>
          <div className="v5-kpi-v">{formatPrice(monthlyEncaissements, locale)}</div>
          <div className="v5-kpi-s">{completedBookings.filter(b => {
            if (!b.booking_date) return false
            const bd = new Date(b.booking_date)
            return bd.getMonth() === currentMonth && bd.getFullYear() === currentYear
          }).length} opérations</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">Factures en attente</div>
          <div className="v5-kpi-v">{formatPrice(pendingAmount, locale)}</div>
          <div className="v5-kpi-s">{pendingBookings.length} facture{pendingBookings.length > 1 ? 's' : ''}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">Recouvrement</div>
          <div className="v5-kpi-v">{recouvrementPct}%</div>
          <div className="v5-kpi-s">{recouvrementPct >= 80 ? 'bon' : recouvrementPct >= 60 ? 'moyen' : 'faible'}</div>
        </div>
      </div>

      {/* Encaissements récents table */}
      <div className="v5-card">
        <div className="v5-st">Encaissements récents</div>
        <table className="v5-dt">
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Chantier</th>
              <th>Montant</th>
            </tr>
          </thead>
          <tbody>
            {recentEncaissements.length > 0 ? recentEncaissements.map((b, i) => (
              <tr key={`v5-enc-${i}`}>
                <td>{b.booking_date ? new Date(b.booking_date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' }) : '-'}</td>
                <td>{b.client_name || b.client_email || 'Client'}</td>
                <td>{b.services?.name || 'Service'}</td>
                <td style={{ fontWeight: 600, color: '#2E7D32' }}>+{formatPrice(b.price_ttc || 0, locale)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                  {t('proDash.home.aucuneActivite')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
