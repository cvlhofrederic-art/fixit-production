'use client'

import { useState } from 'react'
import { formatPrice } from '@/lib/utils'
import { useTranslation, useLocale } from '@/lib/i18n/context'

async function downloadCsv(type: 'clients' | 'bookings' | 'revenue') {
  const res = await fetch(`/api/user/export-csv?type=${type}`)
  if (!res.ok) {
    alert('Erreur lors de l\'export')
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

interface StatsRevenusSectionProps {
  artisan: any
  bookings: any[]
  services: any[]
  pendingBookings: any[]
  completedBookings: any[]
  totalRevenue: number
  activePage: string
}

export default function StatsRevenusSection({
  artisan, bookings, services, pendingBookings, completedBookings, totalRevenue, activePage,
}: StatsRevenusSectionProps) {
  const { t } = useTranslation()
  const locale = useLocale()

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
        <div className="v22-stats" style={{ marginBottom: '20px' }}>
          <div className="v22-stat">
            <div className="v22-stat-label">{t('proDash.stats.totalEncaisse')}</div>
            <div className="v22-stat-val" style={{ color: 'var(--v22-green)' }}>{formatPrice(totalRevenue, locale)}</div>
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
                        color: b.status === 'completed' ? 'var(--v22-green)' : b.status === 'pending' ? 'var(--v22-amber)' : 'var(--v22-text-muted)'
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
            <span style={{ color: 'var(--v22-text-muted)', fontSize: '12px' }}>{t('proDash.home.aucuneActivite')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ExportHeader({ t }: { t: (k: string) => string }) {
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
                  color: 'var(--v22-text)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--v22-bg)')}
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
                  color: 'var(--v22-text)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--v22-bg)')}
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
                  color: 'var(--v22-text)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--v22-bg)')}
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
