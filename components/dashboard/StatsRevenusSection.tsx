'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { useThemeVars } from './useThemeVars'
import ResumeActivite from '@/components/stats/ResumeActivite'

async function downloadCsv(type: 'clients' | 'bookings' | 'revenue', errorMsg = 'Erreur lors de l\'export') {
  const res = await fetch(`/api/user/export-csv?type=${type}`)
  if (!res.ok) {
    toast.error(errorMsg)
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

/* ═══════════════════════════════════════════════════════
   Pilotage banner — monthly financial summary
   Fetches BTP rentability + charges fixes via /api/btp
   ═══════════════════════════════════════════════════════ */
interface PilotageData {
  caTotal: number
  chargesTotal: number
  netPoche: number
  margePct: number
  alertes: string[]
}

function usePilotageData() {
  const [pilotageData, setPilotageData] = useState<PilotageData | null>(null)

  useEffect(() => {
    async function fetchPilotage() {
      try {
        const [rentaRes, chargesRes] = await Promise.all([
          fetch('/api/btp?table=rentabilite'),
          fetch('/api/btp?table=charges_fixes'),
        ])

        if (!rentaRes.ok || !chargesRes.ok) return

        const rentaJson = await rentaRes.json() as { rentabilite?: Array<{ ca_reel?: number; benefice_net?: number; chantier_nom?: string; nom?: string }> }
        const chargesJson = await chargesRes.json() as { charges_fixes?: Array<{ montant_mensuel?: number; montant?: number }> }

        const rentabilite = rentaJson.rentabilite || []
        const chargesFixes = chargesJson.charges_fixes || []

        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()

        // Try to filter by current month if rows have a date field; fall back to all rows
        const rentaRows = rentabilite.filter((r) => {
          const d = (r as Record<string, unknown>).mois || (r as Record<string, unknown>).date || (r as Record<string, unknown>).created_at
          if (!d || typeof d !== 'string') return true // no date column — include all
          const parsed = new Date(d)
          return parsed.getMonth() === currentMonth && parsed.getFullYear() === currentYear
        })
        const rowsToUse = rentaRows.length > 0 ? rentaRows : rentabilite

        const caTotal = rowsToUse.reduce((s, r) => s + (r.ca_reel || 0), 0)
        const chargesFromView = rowsToUse.reduce((s, r) => {
          const b = r.benefice_net ?? 0
          const ca = r.ca_reel ?? 0
          return s + Math.max(ca - b, 0)
        }, 0)
        const chargesFixesMonthly = chargesFixes.reduce((s, c) => s + (c.montant_mensuel ?? c.montant ?? 0), 0)
        const chargesTotal = chargesFromView + chargesFixesMonthly
        const netPoche = caTotal - chargesTotal
        const margePct = caTotal > 0 ? (netPoche / caTotal) * 100 : 0

        const alertes: string[] = rowsToUse
          .filter((r) => (r.benefice_net ?? 0) < 0)
          .map((r) => {
            const nom = r.chantier_nom || r.nom || 'Chantier'
            return `${nom} — marge négative (${formatPrice(r.benefice_net ?? 0)})`
          })

        setPilotageData({ caTotal, chargesTotal, netPoche, margePct, alertes })
      } catch {
        // Silent — don't show broken banner
      }
    }

    fetchPilotage()
  }, [])

  return pilotageData
}

function PilotageBanner() {
  const { t } = useTranslation()
  const locale = useLocale()
  const pilotageData = usePilotageData()

  if (!pilotageData) return null

  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const monthLabel = new Date().toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-500 mb-3 capitalize">{monthLabel}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-gray-500">{t('proDash.stats.caFacture')}</div>
          <div className="text-lg font-bold">{formatPrice(pilotageData.caTotal)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">{t('proDash.stats.chargesTotales')}</div>
          <div className="text-lg font-bold text-red-600">{formatPrice(pilotageData.chargesTotal)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">{t('proDash.stats.netPoche')}</div>
          <div className="text-lg font-bold text-green-600">{formatPrice(pilotageData.netPoche)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">{t('proDash.stats.marge')}</div>
          <div className={`text-lg font-bold ${
            pilotageData.margePct > 15 ? 'text-green-600' :
            pilotageData.margePct >= 5 ? 'text-orange-500' : 'text-red-600'
          }`}>
            {pilotageData.margePct.toFixed(1)}%
          </div>
        </div>
      </div>
      {pilotageData.alertes.length > 0 && (
        <div className="mt-3 space-y-1">
          {pilotageData.alertes.map((alerte, i) => (
            <div key={i} className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
              ⚠️ {alerte}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
    return <RevenusV5 bookings={bookings} completedBookings={completedBookings} pendingBookings={pendingBookings} totalRevenue={totalRevenue} locale={locale} t={t} artisan={artisan} />
  }

  /* ═══════════════════════════════════════════
     V22 layout — artisan and other roles
     ═══════════════════════════════════════════ */
  if (activePage === 'stats') {
    return (
      <div>
        <PilotageBanner />
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
      <PilotageBanner />
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
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const handleExport = async (type: 'clients' | 'bookings' | 'revenue') => {
    setLoading(type)
    setOpen(false)
    await downloadCsv(type, locale === 'pt' ? 'Erro ao exportar' : 'Erreur lors de l\'export')
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
   Uses Supabase bookings when available, falls back to
   localStorage documents/chantiers for demo accounts.
   ═══════════════════════════════════════════════════════ */
interface LocalDoc { docType: string; docDate?: string; status?: string; total_ht_cents?: number; total_ttc_cents?: number; docTitle?: string; clientName?: string }
interface LocalExpense { amount?: string | number; date?: string; category?: string }

function useLocalStats(artisanId: string) {
  const [docs, setDocs] = useState<LocalDoc[]>([])
  const [expenses, setExpenses] = useState<LocalExpense[]>([])
  const [chantierCount, setChantierCount] = useState(0)

  useState(() => {
    try {
      const raw = localStorage.getItem(`fixit_documents_${artisanId}`)
      if (raw) setDocs(JSON.parse(raw))
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(`fixit_expenses_${artisanId}`)
      if (raw) setExpenses(JSON.parse(raw))
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(`chantiers_${artisanId}`)
      if (raw) setChantierCount(JSON.parse(raw).length)
    } catch { /* ignore */ }
  })

  return { docs, expenses, chantierCount }
}

function StatsV5({ bookings, totalRevenue, services, artisan, locale }: {
  bookings: import('@/lib/types').Booking[]
  totalRevenue: number
  services: import('@/lib/types').Service[]
  artisan: import('@/lib/types').Artisan
  locale: string
}) {
  const isPt = locale === 'pt'
  const aid = artisan?.user_id || artisan?.id || ''
  const { docs, expenses, chantierCount } = useLocalStats(aid)

  // Merge data: prefer Supabase bookings, fall back to localStorage documents
  const hasBookings = bookings.length > 0
  const devis = docs.filter(d => d.docType === 'devis')
  const factures = docs.filter(d => d.docType === 'facture')
  const signedDevis = devis.filter(d => d.status === 'signed')
  const paidFactures = factures.filter(d => d.status === 'paid')

  // KPIs — computed from best available source
  const caTotal = hasBookings
    ? totalRevenue
    : paidFactures.reduce((s, f) => s + (f.total_ttc_cents || 0) / 100, 0)
  const activeChantiers = hasBookings
    ? bookings.filter(b => b.status === 'confirmed' || b.status === 'pending').length
    : chantierCount || signedDevis.length
  const totalOffers = hasBookings ? bookings.length : devis.length
  const signedCount = hasBookings
    ? bookings.filter(b => b.status === 'completed').length
    : signedDevis.length
  const tauxTransformation = totalOffers > 0 ? Math.round((signedCount / totalOffers) * 100) : 0
  const panierMoyen = signedCount > 0 ? Math.round((hasBookings ? totalRevenue : signedDevis.reduce((s, d) => s + (d.total_ht_cents || 0) / 100, 0)) / signedCount) : 0

  // Monthly revenue for last 6 months
  const now = new Date()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const months: { label: string; value: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthLabel = d.toLocaleDateString(dateLocale, { month: 'short' })
    let rev = 0
    if (hasBookings) {
      rev = bookings.filter(b => {
        if (!b.booking_date) return false
        const bd = new Date(b.booking_date)
        return bd.getMonth() === d.getMonth() && bd.getFullYear() === d.getFullYear()
      }).reduce((s, b) => s + (b.price_ttc || 0), 0)
    } else {
      rev = factures.filter(f => {
        if (!f.docDate) return false
        const fd = new Date(f.docDate)
        return fd.getMonth() === d.getMonth() && fd.getFullYear() === d.getFullYear()
      }).reduce((s, f) => s + (f.total_ttc_cents || 0) / 100, 0)
    }
    months.push({ label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), value: rev })
  }
  const maxMonthly = Math.max(...months.map(m => m.value), 1)

  // Pie chart data — from devis by client/project
  const pieColors = ['#FFC107', '#FF9800', '#4CAF50', '#2196F3', '#9C27B0', '#E91E63']
  const pieData: { label: string; value: number }[] = []
  if (hasBookings && services.length > 0) {
    services.filter(s => s.active).slice(0, 6).forEach(s => {
      const sRev = bookings.filter(b => b.services?.name === s.name).reduce((sum, b) => sum + (b.price_ttc || 0), 0)
      pieData.push({ label: s.name, value: sRev })
    })
  } else {
    signedDevis.slice(0, 6).forEach(d => {
      pieData.push({ label: d.docTitle?.replace(/^.*?—\s*/, '') || (isPt ? 'Obra' : 'Chantier'), value: (d.total_ht_cents || 0) / 100 })
    })
  }
  const pieTotal = pieData.reduce((s, p) => s + p.value, 0) || 1

  // Total dépenses
  const totalExpenses = expenses.reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0)

  // Build conic-gradient from real data
  let gradientCss = ''
  let cumPct = 0
  pieData.forEach((p, i) => {
    const pct = Math.round((p.value / pieTotal) * 100)
    const start = cumPct
    cumPct += pct
    gradientCss += `${pieColors[i % pieColors.length]} ${start}% ${cumPct}%${i < pieData.length - 1 ? ',' : ''}`
  })
  if (!gradientCss) gradientCss = '#e0e0e0 0% 100%'

  return (
    <div className="v5-fade">
      <PilotageBanner />
      <div className="v5-pg-t"><h1>{isPt ? 'Estatísticas' : 'Statistiques'}</h1><p>{isPt ? 'Análise da atividade BTP' : 'Analyse de l\'activité BTP'}</p></div>

      {/* 4 KPIs */}
      <div className="v5-kpi-g">
        <div className="v5-kpi hl">
          <div className="v5-kpi-l">{isPt ? 'Faturação total' : 'CA facturé'}</div>
          <div className="v5-kpi-v">{formatPrice(caTotal, locale)}</div>
          <div className="v5-kpi-s">{paidFactures.length + factures.filter(f => f.status === 'envoye').length} {isPt ? 'faturas emitidas' : 'factures émises'}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{isPt ? 'Obras ativas' : 'Chantiers actifs'}</div>
          <div className="v5-kpi-v">{activeChantiers}</div>
          <div className="v5-kpi-s">{devis.length} {isPt ? 'orçamentos no total' : 'devis au total'}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{isPt ? 'Taxa de conversão' : 'Taux transformation'}</div>
          <div className="v5-kpi-v">{tauxTransformation}%</div>
          <div className="v5-kpi-s">{signedCount}/{totalOffers} {isPt ? 'orçamentos assinados' : 'devis signés'}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{isPt ? 'Valor médio' : 'Panier moyen'}</div>
          <div className="v5-kpi-v">{formatPrice(panierMoyen, locale)}</div>
          <div className="v5-kpi-s">{isPt ? 'por obra assinada' : 'par chantier signé'}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="v5-sg2">
        {/* Bar chart — CA mensuel 6 mois */}
        <div className="v5-card">
          <div className="v5-st">{isPt ? 'Faturação mensal — 6 últimos meses' : 'CA mensuel — 6 derniers mois'}</div>
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

        {/* Pie chart — Répartition CA par chantier */}
        <div className="v5-card">
          <div className="v5-st">{isPt ? 'Distribuição da faturação por obra' : 'Répartition CA par chantier'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem 0' }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: `conic-gradient(${gradientCss})`,
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>
                {formatPrice(pieTotal, locale).replace(/\s/g, '')}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
              {pieData.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: pieColors[i % pieColors.length], flexShrink: 0 }} />
                  <span style={{ color: '#666' }}>{p.label} — {formatPrice(p.value, locale)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dépenses + marges */}
      {totalExpenses > 0 && (
        <div className="v5-card" style={{ marginTop: 16 }}>
          <div className="v5-st">{isPt ? 'Síntese financeira' : 'Synthèse financière'}</div>
          <div style={{ display: 'flex', gap: 16, padding: '12px 0', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140, padding: '12px 16px', background: '#f0fdf4', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#666' }}>{isPt ? 'Faturação total' : 'CA facturé'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#2E7D32' }}>{formatPrice(caTotal, locale)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 140, padding: '12px 16px', background: '#fff7ed', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#666' }}>{isPt ? 'Despesas' : 'Dépenses'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#E65100' }}>{formatPrice(totalExpenses, locale)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 140, padding: '12px 16px', background: caTotal - totalExpenses > 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#666' }}>{isPt ? 'Margem bruta' : 'Marge brute'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: caTotal - totalExpenses > 0 ? '#2E7D32' : '#C62828' }}>
                {formatPrice(caTotal - totalExpenses, locale)} ({caTotal > 0 ? Math.round(((caTotal - totalExpenses) / caTotal) * 100) : 0}%)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   V5 sub-component — Revenus for pro_societe
   ═══════════════════════════════════════════════════════ */
function RevenusV5({ bookings, completedBookings, pendingBookings, totalRevenue, locale, t, artisan }: {
  bookings: import('@/lib/types').Booking[]
  completedBookings: import('@/lib/types').Booking[]
  pendingBookings: import('@/lib/types').Booking[]
  totalRevenue: number
  locale: string
  t: (k: string) => string
  artisan: import('@/lib/types').Artisan
}) {
  const aid = artisan?.user_id || artisan?.id || ''
  const { docs } = useLocalStats(aid)
  const hasBookings = completedBookings.length > 0 || pendingBookings.length > 0

  const factures = docs.filter(d => d.docType === 'facture')
  const paidFactures = factures.filter(d => d.status === 'paid')
  const pendingFactures = factures.filter(d => d.status === 'envoye')

  const caYear = hasBookings ? totalRevenue : paidFactures.reduce((s, f) => s + (f.total_ttc_cents || 0) / 100, 0)
  const pendingAmount = hasBookings
    ? pendingBookings.reduce((s, b) => s + (b.price_ttc || 0), 0)
    : pendingFactures.reduce((s, f) => s + (f.total_ttc_cents || 0) / 100, 0)

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  let monthlyEncaissements = 0
  let monthlyCount = 0
  if (hasBookings) {
    const monthlyBk = completedBookings.filter(b => {
      if (!b.booking_date) return false
      const bd = new Date(b.booking_date)
      return bd.getMonth() === currentMonth && bd.getFullYear() === currentYear
    })
    monthlyEncaissements = monthlyBk.reduce((s, b) => s + (b.price_ttc || 0), 0)
    monthlyCount = monthlyBk.length
  } else {
    const monthlyFac = paidFactures.filter(f => {
      if (!f.docDate) return false
      const fd = new Date(f.docDate)
      return fd.getMonth() === currentMonth && fd.getFullYear() === currentYear
    })
    monthlyEncaissements = monthlyFac.reduce((s, f) => s + (f.total_ttc_cents || 0) / 100, 0)
    monthlyCount = monthlyFac.length
  }

  const totalBilled = hasBookings
    ? bookings.reduce((s, b) => s + (b.price_ttc || 0), 0)
    : factures.reduce((s, f) => s + (f.total_ttc_cents || 0) / 100, 0)
  const totalPaid = hasBookings ? totalRevenue : paidFactures.reduce((s, f) => s + (f.total_ttc_cents || 0) / 100, 0)
  const recouvrementPct = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 100

  // Recent encaissements — from bookings or factures
  type EncRow = { date: string; client: string; chantier: string; amount: number }
  const recentRows: EncRow[] = []
  if (hasBookings) {
    completedBookings.filter(b => b.price_ttc && b.price_ttc > 0)
      .sort((a, b) => new Date(b.booking_date || '').getTime() - new Date(a.booking_date || '').getTime())
      .slice(0, 10)
      .forEach(b => recentRows.push({ date: b.booking_date || '', client: b.client_name || b.client_email || 'Client', chantier: b.services?.name || 'Service', amount: b.price_ttc || 0 }))
  } else {
    factures.sort((a, b) => new Date(b.docDate || '').getTime() - new Date(a.docDate || '').getTime())
      .slice(0, 10)
      .forEach(f => recentRows.push({ date: f.docDate || '', client: f.clientName || 'Client', chantier: f.docTitle || 'Facture', amount: (f.total_ttc_cents || 0) / 100 }))
  }

  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  return (
    <div className="v5-fade">
      <PilotageBanner />
      <div className="v5-pg-t"><h1>{t('proDash.stats.revenusTitle')}</h1><p>{t('proDash.stats.revenusSubtitle')}</p></div>

      {/* 4 KPIs */}
      <div className="v5-kpi-g">
        <div className="v5-kpi hl">
          <div className="v5-kpi-l">{t('proDash.stats.ca')} {currentYear}</div>
          <div className="v5-kpi-v">{formatPrice(caYear, locale)}</div>
          <div className="v5-kpi-s">{t('proDash.stats.cumule')}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{t('proDash.stats.encaissementsMois')} {now.toLocaleDateString(dateLocale, { month: 'long' })}</div>
          <div className="v5-kpi-v">{formatPrice(monthlyEncaissements, locale)}</div>
          <div className="v5-kpi-s">{monthlyCount} {monthlyCount > 1 ? t('proDash.stats.operations') : t('proDash.stats.operation')}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{t('proDash.stats.facturesEnAttente')}</div>
          <div className="v5-kpi-v">{formatPrice(pendingAmount, locale)}</div>
          <div className="v5-kpi-s">{hasBookings ? pendingBookings.length : pendingFactures.length} {(hasBookings ? pendingBookings.length : pendingFactures.length) > 1 ? t('proDash.stats.factures') : t('proDash.stats.facture')}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{t('proDash.stats.recouvrement')}</div>
          <div className="v5-kpi-v">{recouvrementPct}%</div>
          <div className="v5-kpi-s">{recouvrementPct >= 80 ? t('proDash.stats.bon') : recouvrementPct >= 60 ? t('proDash.stats.moyen') : t('proDash.stats.faible')}</div>
        </div>
      </div>

      {/* Encaissements récents table */}
      <div className="v5-card">
        <div className="v5-st">{t('proDash.stats.encaissementsRecents')}</div>
        <table className="v5-dt">
          <thead>
            <tr>
              <th>{t('proDash.stats.date')}</th>
              <th>{t('proDash.stats.client')}</th>
              <th>{t('proDash.stats.chantier')}</th>
              <th>{t('proDash.stats.montant')}</th>
            </tr>
          </thead>
          <tbody>
            {recentRows.length > 0 ? recentRows.map((r, i) => (
              <tr key={`v5-enc-${i}`}>
                <td>{r.date ? new Date(r.date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' }) : '-'}</td>
                <td>{r.client}</td>
                <td>{r.chantier}</td>
                <td style={{ fontWeight: 600, color: '#2E7D32' }}>+{formatPrice(r.amount, locale)}</td>
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
