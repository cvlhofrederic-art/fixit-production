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
      <div className="animate-fadeIn">
        <div className="bg-white px-6 lg:px-10 h-20 border-b border-[#34495E] flex items-center">
          <div>
            <h1 className="text-xl font-semibold leading-tight">{'📊'} {t('proDash.stats.title')}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{t('proDash.stats.subtitle')}</p>
          </div>
        </div>
        <div className="p-6 lg:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <StatCard icon="📅" iconBg="bg-blue-50" iconColor="text-blue-500" value={bookings.length.toString()} label={t('proDash.stats.interventionsTotales')} change={`${completedBookings.length} ${t('proDash.home.terminees')}`} positive />
            <StatCard icon="💰" iconBg="bg-green-50" iconColor="text-green-500" value={formatPrice(totalRevenue, locale)} label={t('proDash.stats.chiffreAffaires')} change={`${bookings.length} ${t('proDash.clients.interventions')}`} positive />
            <StatCard icon="⭐" iconBg="bg-orange-50" iconColor="text-orange-500" value={`${artisan?.rating_avg || '5.0'}/5`} label={t('proDash.stats.noteMoyenne')} change={`${artisan?.rating_count || 0} ${t('proDash.home.avis')}`} positive />
            <StatCard icon="🔧" iconBg="bg-pink-50" iconColor="text-pink-500" value={services.filter(s => s.active).length.toString()} label={t('proDash.stats.motifsActifs')} change={`${services.length} ${t('proDash.stats.auTotal')}`} />
          </div>
        </div>
      </div>
    )
  }

  // activePage === 'revenus'
  return (
    <div className="animate-fadeIn">
      <ExportHeader t={t} />
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <div className="text-gray-500 mb-1">{t('proDash.stats.totalEncaisse')}</div>
            <div className="text-3xl font-bold text-green-500">{formatPrice(totalRevenue, locale)}</div>
            <div className="text-sm text-green-500 font-semibold mt-2">{completedBookings.length} {t('proDash.stats.interventionsTerminees')}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <div className="text-gray-500 mb-1">{t('proDash.stats.enAttenteEncaissement')}</div>
            <div className="text-3xl font-bold text-orange-500">{formatPrice(pendingBookings.reduce((s, b) => s + (b.price_ttc || 0), 0), locale)}</div>
            <div className="text-sm text-gray-500 font-semibold mt-2">{pendingBookings.length} {t('proDash.home.enAttente')}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <div className="text-gray-500 mb-1">{t('proDash.stats.ticketMoyen')}</div>
            <div className="text-3xl font-bold">{formatPrice(bookings.reduce((s, b) => s + (b.price_ttc || 0), 0), locale)}</div>
            <div className="text-sm text-gray-500 font-semibold mt-2">{bookings.length} {t('proDash.clients.interventions')} {t('proDash.stats.auTotal')}</div>
          </div>
        </div>

        {bookings.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#2C3E50] text-white">
                  <th className="text-left p-4 font-semibold text-sm">{t('proDash.calendar.date')}</th>
                  <th className="text-left p-4 font-semibold text-sm">Service</th>
                  <th className="text-left p-4 font-semibold text-sm">{t('proDash.calendar.montantTTC')}</th>
                  <th className="text-left p-4 font-semibold text-sm">{t('proDash.motifs.colStatut')}</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="p-4">{b.booking_date}</td>
                    <td className="p-4">{b.services?.name || 'Service'}</td>
                    <td className="p-4 font-bold text-lg" style={{ color: b.status === 'completed' ? '#4CAF50' : b.status === 'pending' ? '#FF9800' : '#999' }}>
                      {b.status !== 'cancelled' ? `+${formatPrice(b.price_ttc || 0, locale)}` : '-'}
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${b.status === 'completed' ? 'bg-green-50 text-green-700' : b.status === 'confirmed' ? 'bg-blue-50 text-blue-700' : b.status === 'pending' ? 'bg-amber-50 text-orange-700' : 'bg-red-50 text-red-700'}`}>
                        {b.status === 'completed' ? t('proDash.home.termine') : b.status === 'confirmed' ? t('proDash.home.confirme') : b.status === 'pending' ? t('proDash.home.enAttenteStat') : t('proDash.home.annule')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white p-12 rounded-2xl text-center shadow-sm">
            <p className="text-gray-500">{t('proDash.home.aucuneActivite')}</p>
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
    <div className="bg-white px-6 lg:px-10 h-20 border-b border-[#34495E] flex justify-between items-center">
      <div>
        <h1 className="text-xl font-semibold leading-tight">{'💰'} {t('proDash.stats.revenusTitle')}</h1>
        <p className="text-xs text-gray-400 mt-0.5">{t('proDash.stats.revenusTitle')}</p>
      </div>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          disabled={loading !== null}
          className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm disabled:opacity-50"
        >
          {loading ? '⏳ ...' : `📊 ${t('proDash.stats.exporter')}`}
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-12 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-2 w-56">
              <button onClick={() => handleExport('clients')} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm flex items-center gap-2">
                <span>{'👥'}</span> {t('proDash.export.clients')}
              </button>
              <button onClick={() => handleExport('bookings')} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm flex items-center gap-2">
                <span>{'📋'}</span> {t('proDash.export.bookings')}
              </button>
              <button onClick={() => handleExport('revenue')} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm flex items-center gap-2">
                <span>{'💰'}</span> {t('proDash.export.revenue')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, iconBg, iconColor, value, label, change, positive }: {
  icon: string; iconBg: string; iconColor: string; value: string; label: string; change: string; positive?: boolean
}) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm">
      <div className={`w-14 h-14 ${iconBg} rounded-xl flex items-center justify-center text-2xl mb-4`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-gray-500">{label}</div>
      <div className={`text-sm mt-2 font-semibold ${positive ? 'text-green-500' : 'text-gray-500'}`}>{change}</div>
    </div>
  )
}

function PageHeader({ title, subtitle, actionLabel, onAction }: { title: string; subtitle: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="bg-white px-6 lg:px-10 h-20 border-b border-[#34495E] flex justify-between items-center">
      <div>
        <h1 className="text-xl font-semibold leading-tight">{title}</h1>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      <button onClick={onAction}
        className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm">
        {actionLabel}
      </button>
    </div>
  )
}
