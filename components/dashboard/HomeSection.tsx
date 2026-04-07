'use client'

import { useState, useEffect } from 'react'
import { formatPrice } from '@/lib/utils'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import type { Artisan, Booking, Service, SavedDocument } from '@/lib/types'

interface HomeSectionProps {
  artisan: Artisan
  orgRole: 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'
  bookings: Booking[]
  services: Service[]
  pendingBookings: Booking[]
  completedBookings: Booking[]
  totalRevenue: number
  firstName: string
  navigateTo: (page: string) => void
  setShowNewRdv: (v: boolean) => void
  setShowDevisForm: (v: boolean) => void
  setShowFactureForm: (v: boolean) => void
  setActivePage: (page: string) => void
  setSidebarOpen: (v: boolean) => void
  openNewMotif: () => void
}

function extractClientName(booking: Booking): string {
  const notes = booking.notes || ''
  // Pattern: "Client: Name|..." or "Client: Name."
  const match = notes.match(/Client:\s*([^|.]+)/)
  if (match) return match[1].trim()
  // Fallback: use service name or generic
  return booking.client_name || booking.services?.name || 'Client'
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return '??'
}

function getWeekNumber(d: Date): number {
  const oneJan = new Date(d.getFullYear(), 0, 1)
  const days = Math.floor((d.getTime() - oneJan.getTime()) / 86400000)
  return Math.ceil((days + oneJan.getDay() + 1) / 7)
}

function formatRelativeTime(dateStr: string, locale: string): string {
  if (!dateStr) return ''
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return locale === 'pt' ? 'Hoje' : "Aujourd'hui"
  if (diffDays === 1) return locale === 'pt' ? 'Ontem' : 'Hier'
  if (diffDays < 7) return locale === 'pt' ? `${diffDays}d atrás` : `il y a ${diffDays}j`
  return date.toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: '2-digit' })
}

export default function HomeSection({
  artisan,
  orgRole,
  bookings,
  services,
  pendingBookings,
  completedBookings,
  totalRevenue,
  firstName,
  navigateTo,
  setShowNewRdv,
  setShowDevisForm,
  setShowFactureForm,
  setActivePage,
  setSidebarOpen,
  openNewMotif,
}: HomeSectionProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  const now = new Date()
  const weekNum = getWeekNumber(now)
  const monthYear = now.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })

  // Today's bookings for agenda
  const todayStr = now.toISOString().split('T')[0]
  const todayBookings = bookings.filter(b => b.booking_date === todayStr)

  // Conversion rate
  const totalReceived = pendingBookings.length + completedBookings.length
  const conversionRate = totalReceived > 0 ? Math.round((completedBookings.length / totalReceived) * 100) : 0

  // Devis from localStorage
  const [recentDevis, setRecentDevis] = useState<SavedDocument[]>([])
  const [alerts, setAlerts] = useState<Array<{ type: string; title: string; sub: string; time: string }>>([])

  useEffect(() => {
    if (typeof window === 'undefined' || !artisan?.id) return
    try {
      const raw = localStorage.getItem(`fixit_docs_${artisan.id}`)
      if (raw) {
        const docs = JSON.parse(raw)
        const devisList = (docs || [])
          .filter((d: SavedDocument) => d.type === 'devis')
          .sort((a: SavedDocument, b: SavedDocument) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime())
          .slice(0, 5)
        setRecentDevis(devisList)

        // Generate alerts from data
        const alertItems: Array<{ type: string; title: string; sub: string; time: string }> = []
        // Unpaid invoices
        const unpaidInvoices = (docs || []).filter((d: SavedDocument) => d.type === 'facture' && d.status !== 'paid' && d.status !== 'payée')
        unpaidInvoices.slice(0, 2).forEach((inv: SavedDocument) => {
          alertItems.push({
            type: 'red',
            title: `${locale === 'pt' ? 'Fatura não paga' : 'Facture impayée'} — ${inv.client || inv.clientName || 'Client'}`,
            sub: `${inv.ref || inv.number || '—'} · ${formatPrice(inv.total || inv.amount || 0)}`,
            time: formatRelativeTime(inv.date || inv.created_at || '', locale),
          })
        })
        // Pending devis without response
        const pendingDevis = (docs || []).filter((d: SavedDocument) => d.type === 'devis' && (!d.status || d.status === 'pending' || d.status === 'en_attente'))
        pendingDevis.slice(0, 2).forEach((dv: SavedDocument) => {
          alertItems.push({
            type: 'amber',
            title: `${locale === 'pt' ? 'Orçamento pendente' : 'Devis en attente'} — ${dv.client || dv.clientName || 'Client'}`,
            sub: `${dv.ref || dv.number || '—'} · ${locale === 'pt' ? 'sem resposta' : 'sans réponse'}`,
            time: formatRelativeTime(dv.date || dv.created_at || '', locale),
          })
        })
        setAlerts(alertItems)
      }
    } catch {
      // ignore parse errors
    }
  }, [artisan?.id, locale])

  // ═══════════════════════════════════════════════════════
  // V5 RENDER — pro_societe uses the v5 design system
  // ═══════════════════════════════════════════════════════
  if (orgRole === 'pro_societe') {
    const urgentCount = pendingBookings.filter(b => b.notes?.toLowerCase().includes('urgent')).length
    return (
      <div className="v5-fade">
        <div className="v5-pg-t" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <h1>{locale === 'pt' ? 'Painel' : 'Tableau de bord'}</h1>
            <p>{artisan?.company_name || 'Entreprise'} — {locale === 'pt' ? 'Semana' : 'Semaine'} {weekNum}, {monthYear}</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="v5-btn v5-btn-sm" onClick={() => navigateTo('stats')}>{locale === 'pt' ? 'Exportar' : 'Exporter'}</button>
            <button className="v5-btn v5-btn-p v5-btn-sm" onClick={() => { setShowDevisForm(true); setActivePage('devis'); setSidebarOpen(false) }}>+ {locale === 'pt' ? 'Novo orçamento' : 'Nouveau devis'}</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="v5-kpi-g">
          <div className="v5-kpi hl" style={{ cursor: 'pointer' }} onClick={() => navigateTo('chantiers')}>
            <div className="v5-kpi-l">{locale === 'pt' ? 'Obras ativas' : 'Chantiers actifs'}</div>
            <div className="v5-kpi-v">{bookings.filter(b => b.status === 'confirmed').length}</div>
            <div className="v5-kpi-s">{urgentCount > 0 ? `dont ${urgentCount} ${locale === 'pt' ? 'urgentes' : 'en retard'}` : (locale === 'pt' ? 'em dia' : 'à jour')}</div>
          </div>
          <div className="v5-kpi" style={{ cursor: 'pointer' }} onClick={() => navigateTo('revenus')}>
            <div className="v5-kpi-l">{locale === 'pt' ? 'Faturação mensal' : 'CA ce mois'}</div>
            <div className="v5-kpi-v">{formatPrice(totalRevenue)}</div>
            <div className="v5-kpi-s">↑ {completedBookings.length} {locale === 'pt' ? 'terminadas' : 'chantiers livrés'}</div>
          </div>
          <div className="v5-kpi" style={{ cursor: 'pointer' }} onClick={() => navigateTo('stats')}>
            <div className="v5-kpi-l">{locale === 'pt' ? 'Nota média' : 'Note moyenne'}</div>
            <div className="v5-kpi-v">{artisan?.rating_avg || '5.0'} ★</div>
            <div className="v5-kpi-s">{locale === 'pt' ? 'em' : 'sur'} {artisan?.rating_count || 0} {locale === 'pt' ? 'avaliações' : 'avis'}</div>
          </div>
          <div className="v5-kpi" style={{ cursor: 'pointer' }} onClick={() => navigateTo('stats')}>
            <div className="v5-kpi-l">{locale === 'pt' ? 'Taxa conversão' : 'Taux conversion'}</div>
            <div className="v5-kpi-v">{conversionRate}%</div>
            <div className="v5-kpi-s">{completedBookings.length}/{totalReceived}</div>
          </div>
        </div>

        {/* Main grid: Chantiers en cours + Planning + Alertes */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.2fr', gap: '.75rem', marginBottom: '1.25rem' }}>
          {/* Demandes / Chantiers */}
          <div className="v5-card">
            <div className="v5-st" style={{ display: 'flex', alignItems: 'center' }}>
              {locale === 'pt' ? 'Pedidos recebidos' : 'Demandes reçues'}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#999', cursor: 'pointer' }} onClick={() => navigateTo('calendar')}>{locale === 'pt' ? 'Ver tudo →' : 'Voir tout →'}</span>
            </div>
            {pendingBookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: 12, color: '#BBB' }}>{locale === 'pt' ? 'Nenhum pedido pendente' : 'Aucune demande en attente'}</div>
            ) : (
              <table className="v5-dt">
                <thead><tr><th>{locale === 'pt' ? 'Cliente' : 'Client'}</th><th>Service</th><th>{locale === 'pt' ? 'Estado' : 'Statut'}</th></tr></thead>
                <tbody>
                  {pendingBookings.slice(0, 5).map(b => {
                    const clientName = extractClientName(b)
                    const isUrgent = b.notes?.toLowerCase().includes('urgent')
                    return (
                      <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => navigateTo('calendar')}>
                        <td style={{ fontWeight: 600 }}>{clientName}</td>
                        <td>{b.services?.name || 'Intervention'}</td>
                        <td><span className={`v5-badge ${isUrgent ? 'v5-badge-red' : 'v5-badge-orange'}`}>{isUrgent ? 'Urgent' : (locale === 'pt' ? 'Pendente' : 'En attente')}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Planning semaine */}
          <div className="v5-card">
            <div className="v5-st">{locale === 'pt' ? 'Agenda de hoje' : 'Planning semaine'}</div>
            {todayBookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: 12, color: '#BBB' }}>{locale === 'pt' ? 'Nada agendado para hoje' : "Rien de prévu aujourd'hui"}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {todayBookings.slice(0, 5).map(b => {
                  const clientName = extractClientName(b)
                  const dayName = new Date(b.booking_date || '').toLocaleDateString(dateLocale, { weekday: 'short' })
                  return (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => navigateTo('calendar')}>
                      <div style={{ background: '#E3F2FD', color: '#1565C0', padding: '3px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: 'capitalize' as const }}>{dayName}</div>
                      <div style={{ fontSize: 11 }}>{b.services?.name || 'RDV'} — {clientName}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Alertes */}
          <div className="v5-card">
            <div className="v5-st">{locale === 'pt' ? 'Alertas BTP' : 'Alertes BTP'}</div>
            {alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: 12, color: '#BBB' }}>{locale === 'pt' ? 'Nenhum alerta' : 'Aucune alerte'}</div>
            ) : (
              alerts.map((a, i) => (
                <div key={i} className={`v5-al ${a.type === 'red' ? 'err' : 'warn'}`}>{a.title}</div>
              ))
            )}
          </div>
        </div>

        {/* Bottom: 3 summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.75rem', marginBottom: '1.25rem' }}>
          <div className="v5-card" style={{ textAlign: 'center', padding: '.85rem' }}>
            <div className="v5-st">{locale === 'pt' ? 'Últimas avaliações' : 'Derniers avis'}</div>
            <div style={{ fontSize: 13, fontWeight: 600, margin: '.4rem 0' }}>{artisan?.rating_avg || '5.0'} / 5</div>
            <div style={{ fontSize: 11, color: '#888' }}>{artisan?.rating_count || 0} {locale === 'pt' ? 'avaliações' : 'avis'}</div>
          </div>
          <div className="v5-card" style={{ textAlign: 'center', padding: '.85rem', cursor: 'pointer' }} onClick={() => navigateTo('messages')}>
            <div className="v5-st">{locale === 'pt' ? 'Mensagens' : 'Messagerie'}</div>
            <div style={{ fontSize: 18, fontWeight: 700, margin: '.4rem 0' }}>{pendingBookings.length}</div>
            <div style={{ fontSize: 11, color: '#888' }}>conversations</div>
          </div>
          <div className="v5-card" style={{ textAlign: 'center', padding: '.85rem', cursor: 'pointer' }} onClick={() => navigateTo('devis')}>
            <div className="v5-st">{locale === 'pt' ? 'Orçamentos recentes' : 'Devis récents'}</div>
            <div style={{ fontSize: 12, fontWeight: 600, margin: '.4rem 0' }}>{recentDevis.length > 0 ? (recentDevis[0].ref || recentDevis[0].number || '—') : '—'}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{recentDevis.length > 0 ? `${recentDevis[0].client || recentDevis[0].clientName || ''} — ${formatPrice(recentDevis[0].total || recentDevis[0].amount || 0)}` : (locale === 'pt' ? 'Nenhum orçamento' : 'Aucun devis')}</div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="v5-st" style={{ marginBottom: '.5rem' }}>{t('proDash.home.actionsRapides')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.75rem' }}>
          <button className="v5-act-btn primary" onClick={() => navigateTo('equipes')}><span style={{ fontSize: 18 }}>👷</span><span>{t('proDash.home.nouvelleEquipe')}</span></button>
          <button className="v5-act-btn" onClick={() => navigateTo('chantiers')}><span style={{ fontSize: 18 }}>🏗️</span><span>{t('proDash.home.nouveauChantier')}</span></button>
          <button className="v5-act-btn" onClick={() => { setShowDevisForm(true); setActivePage('devis'); setSidebarOpen(false) }}><span style={{ fontSize: 18 }}>📄</span><span>{t('proDash.home.creerDevis')}</span></button>
          <button className="v5-act-btn" onClick={() => { setShowFactureForm(true); setActivePage('factures'); setSidebarOpen(false) }}><span style={{ fontSize: 18 }}>💰</span><span>{t('proDash.home.nouvelleFacture')}</span></button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════
  // V22 RENDER — artisan, conciergerie, gestionnaire
  // ═══════════════════════════════════════════════════════
  return (
    <div className="animate-fadeIn">
      {/* ── Page Header ── */}
      <div className="v22-page-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div className="v22-page-title">{locale === 'pt' ? 'Painel' : 'Tableau de bord'}</div>
          <div className="v22-page-sub">{locale === 'pt' ? 'Semana' : 'Semaine'} {weekNum} · {monthYear}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="v22-btn v22-btn-sm" onClick={() => navigateTo('stats')}>
            {locale === 'pt' ? 'Exportar' : 'Exporter'}
          </button>
          <button className="v22-btn v22-btn-primary v22-btn-sm" onClick={() => { setShowDevisForm(true); setActivePage('devis'); setSidebarOpen(false) }}>
            + {locale === 'pt' ? 'Novo orçamento' : 'Nouveau devis'}
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="v22-stats">
        <div className="v22-stat v22-stat-yellow" style={{ cursor: 'pointer' }} onClick={() => navigateTo('calendar')}>
          <div className="v22-stat-label">{locale === 'pt' ? 'Pedidos pendentes' : 'Demandes en attente'}</div>
          <div className="v22-stat-val">{pendingBookings.length}</div>
          <div className="v22-stat-delta">→ {pendingBookings.filter(b => b.notes?.toLowerCase().includes('urgent')).length} {locale === 'pt' ? 'urgentes' : 'urgentes'}</div>
        </div>
        <div className="v22-stat" style={{ cursor: 'pointer' }} onClick={() => navigateTo('revenus')}>
          <div className="v22-stat-label">{locale === 'pt' ? 'Faturação mensal' : 'CA ce mois'}</div>
          <div className="v22-stat-val">{formatPrice(totalRevenue)}</div>
          <div className="v22-stat-delta v22-up">↑ {completedBookings.length} {locale === 'pt' ? 'terminadas' : t('proDash.home.terminees')}</div>
        </div>
        <div className="v22-stat" style={{ cursor: 'pointer' }} onClick={() => navigateTo('stats')}>
          <div className="v22-stat-label">{locale === 'pt' ? 'Nota média' : 'Note moyenne'}</div>
          <div className="v22-stat-val">{artisan?.rating_avg || '5.0'} ★</div>
          <div className="v22-stat-delta" style={{ color: 'var(--v22-text-muted)' }}>{locale === 'pt' ? 'em' : 'sur'} {artisan?.rating_count || 0} {locale === 'pt' ? 'avaliações' : 'avis'}</div>
        </div>
        <div className="v22-stat" style={{ cursor: 'pointer' }} onClick={() => navigateTo('stats')}>
          <div className="v22-stat-label">{locale === 'pt' ? 'Taxa conversão' : 'Taux conversion'}</div>
          <div className="v22-stat-val">{conversionRate}%</div>
          <div className="v22-stat-delta v22-up">{completedBookings.length}/{totalReceived}</div>
        </div>
      </div>

      {/* ── Grid Main: Demandes + (Agenda + Alertes) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', marginBottom: '16px' }}>
        {/* LEFT: Demandes reçues */}
        <div className="v22-card">
          <div className="v22-card-head" style={{ display: 'flex', alignItems: 'center' }}>
            <div className="v22-card-title">{locale === 'pt' ? 'Pedidos recebidos' : 'Demandes reçues'}</div>
            <span className="v22-tag v22-tag-yellow" style={{ marginLeft: 'auto' }}>{pendingBookings.length} {locale === 'pt' ? 'pendentes' : 'en attente'}</span>
            <button className="v22-btn v22-btn-sm" style={{ marginLeft: '8px', border: 'none', background: 'none', color: 'var(--v22-text-muted)', cursor: 'pointer', fontSize: '11px' }} onClick={() => navigateTo('calendar')}>
              {locale === 'pt' ? 'Ver tudo →' : 'Voir tout →'}
            </button>
          </div>
          <div className="v22-card-body" style={{ padding: 0 }}>
            {pendingBookings.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--v22-text-muted)' }}>
                {locale === 'pt' ? 'Nenhum pedido pendente' : 'Aucune demande en attente'}
              </div>
            ) : (
              pendingBookings.slice(0, 6).map((b) => {
                const clientName = extractClientName(b)
                const initials = getInitials(clientName)
                const isUrgent = b.notes?.toLowerCase().includes('urgent')
                const desc = b.services?.name || (b as unknown as { service_name?: string }).service_name || 'Intervention'
                const time = b.booking_time?.substring(0, 5) || formatRelativeTime(b.created_at || b.booking_date || '', locale)
                return (
                  <div
                    key={b.id}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderBottom: '1px solid var(--v22-border)', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF7')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                    onClick={() => navigateTo('calendar')}
                  >
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--v22-yellow-light)', border: '1px solid var(--v22-yellow-border)', color: '#7A6000', fontSize: '10px', fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '12px', color: 'var(--v22-text)' }}>{clientName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--v22-text-muted)', marginTop: '1px' }}>{desc}{b.address ? ` · ${b.address}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                      <span className="v22-ref">{time}</span>
                      <span className={`v22-tag ${isUrgent ? 'v22-tag-red' : 'v22-tag-amber'}`}>{isUrgent ? (locale === 'pt' ? 'Urgente' : 'Urgente') : (locale === 'pt' ? 'Pendente' : 'En attente')}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* RIGHT: Agenda + Alertes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Agenda du jour */}
          <div className="v22-card">
            <div className="v22-card-head" style={{ display: 'flex', alignItems: 'center' }}>
              <div className="v22-card-title">{locale === 'pt' ? 'Agenda de hoje' : 'Agenda du jour'}</div>
              <button className="v22-btn v22-btn-sm" style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--v22-text-muted)', cursor: 'pointer', fontSize: '11px' }} onClick={() => navigateTo('calendar')}>
                {locale === 'pt' ? 'Ver tudo →' : 'Voir tout →'}
              </button>
            </div>
            <div className="v22-card-body">
              {todayBookings.length === 0 ? (
                <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--v22-text-muted)', padding: '12px 0' }}>
                  {locale === 'pt' ? 'Nada agendado para hoje' : "Rien de prévu aujourd'hui"}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--v22-text-muted)', marginBottom: '6px' }}>
                    {locale === 'pt' ? 'Hoje' : "Aujourd'hui"} — {now.toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                  {todayBookings.slice(0, 4).map((b, i) => {
                    const clientName = extractClientName(b)
                    const isCompleted = b.status === 'completed'
                    return (
                      <div
                        key={b.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '2px',
                          borderLeft: `2px solid ${isCompleted ? 'var(--v22-green)' : 'var(--v22-yellow)'}`,
                          background: isCompleted ? 'var(--v22-green-light)' : 'var(--v22-yellow-light)',
                          marginBottom: '4px', cursor: 'pointer',
                        }}
                        onClick={() => navigateTo('calendar')}
                      >
                        <span className="v22-ref">{b.booking_time?.substring(0, 5) || '—'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: '12px', color: 'var(--v22-text)' }}>{b.services?.name || 'RDV'} — {clientName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--v22-text-muted)' }}>{b.address || ''}{ (b as unknown as { duration?: string | number }).duration ? ` · ${(b as unknown as { duration?: string | number }).duration}` : ''}</div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>

          {/* Alertes */}
          <div className="v22-card">
            <div className="v22-card-head">
              <div className="v22-card-title">{locale === 'pt' ? 'Alertas' : 'Alertes'}</div>
              <div className="v22-card-meta">{alerts.length} {locale === 'pt' ? 'ativas' : 'actives'}</div>
            </div>
            <div style={{ padding: '10px' }}>
              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--v22-text-muted)', padding: '8px 0' }}>
                  {locale === 'pt' ? 'Nenhum alerta' : 'Aucune alerte'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {alerts.map((a, i) => (
                    <div key={i} className={`v22-alert v22-alert-${a.type}`}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: '12px', color: 'var(--v22-text)' }}>{a.title}</div>
                        <div className="v22-ref" style={{ marginTop: '2px' }}>{a.sub}</div>
                      </div>
                      <div className="v22-ref" style={{ flexShrink: 0 }}>{a.time}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Grid 3: Avis + Messagerie + Devis récents ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        {/* Derniers avis */}
        <div className="v22-card">
          <div className="v22-card-head">
            <div className="v22-card-title">{locale === 'pt' ? 'Últimas avaliações' : 'Derniers avis'}</div>
            <div className="v22-card-meta">{artisan?.rating_avg || '5.0'} / 5</div>
          </div>
          <div className="v22-card-body" style={{ padding: 0 }}>
            {/* Placeholder: no avis data in props */}
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--v22-text-muted)' }}>
              {locale === 'pt' ? 'Nenhuma avaliação ainda' : 'Aucun avis pour le moment'}
            </div>
          </div>
        </div>

        {/* Messagerie */}
        <div className="v22-card">
          <div className="v22-card-head">
            <div className="v22-card-title">{locale === 'pt' ? 'Mensagens' : 'Messagerie'}</div>
            <div className="v22-card-meta" style={{ color: 'var(--v22-red)' }}>
              {/* Placeholder count */}
            </div>
          </div>
          <div className="v22-card-body" style={{ padding: 0 }}>
            {pendingBookings.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--v22-text-muted)' }}>
                {locale === 'pt' ? 'Nenhuma mensagem' : 'Aucun message'}
              </div>
            ) : (
              pendingBookings.slice(0, 4).map((b) => {
                const clientName = extractClientName(b)
                const initials = getInitials(clientName)
                return (
                  <div
                    key={b.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid var(--v22-border)', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF7')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                    onClick={() => navigateTo('messages')}
                  >
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--v22-yellow-light)', border: '1px solid var(--v22-yellow-border)', color: '#7A6000', fontSize: '9px', fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '12px', color: 'var(--v22-text)' }}>{clientName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--v22-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.services?.name || (locale === 'pt' ? 'Nova mensagem...' : 'Nouveau message...')}
                      </div>
                    </div>
                    <span className="v22-ref" style={{ flexShrink: 0 }}>
                      {b.booking_time?.substring(0, 5) || formatRelativeTime(b.created_at || '', locale)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Devis récents */}
        <div className="v22-card">
          <div className="v22-card-head" style={{ display: 'flex', alignItems: 'center' }}>
            <div className="v22-card-title">{locale === 'pt' ? 'Orçamentos recentes' : 'Devis récents'}</div>
            <button className="v22-btn v22-btn-sm" style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--v22-text-muted)', cursor: 'pointer', fontSize: '11px' }} onClick={() => navigateTo('devis')}>
              {locale === 'pt' ? 'Ver tudo →' : 'Voir tout →'}
            </button>
          </div>
          <div className="v22-card-body" style={{ padding: 0 }}>
            {recentDevis.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--v22-text-muted)' }}>
                {locale === 'pt' ? 'Nenhum orçamento' : 'Aucun devis'}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: 'var(--v22-text-muted)', textAlign: 'left', borderBottom: '1px solid var(--v22-border)' }}>{locale === 'pt' ? 'Réf.' : 'Réf.'}</th>
                    <th style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: 'var(--v22-text-muted)', textAlign: 'left', borderBottom: '1px solid var(--v22-border)' }}>Client</th>
                    <th style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: 'var(--v22-text-muted)', textAlign: 'right', borderBottom: '1px solid var(--v22-border)' }}>{locale === 'pt' ? 'Valor' : 'Montant'}</th>
                    <th style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: 'var(--v22-text-muted)', textAlign: 'left', borderBottom: '1px solid var(--v22-border)' }}>{locale === 'pt' ? 'Estado' : 'Statut'}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDevis.map((d, i) => {
                    const statusClass = d.status === 'accepted' || d.status === 'accepté' ? 'v22-tag-green' : d.status === 'rejected' || d.status === 'refusé' ? 'v22-tag-red' : 'v22-tag-amber'
                    const statusLabel = d.status === 'accepted' || d.status === 'accepté' ? (locale === 'pt' ? 'Aceite' : 'Accepté') : d.status === 'rejected' || d.status === 'refusé' ? (locale === 'pt' ? 'Recusado' : 'Refusé') : (locale === 'pt' ? 'Pendente' : 'Attente')
                    return (
                      <tr
                        key={d.id || i}
                        style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseEnter={e => { e.currentTarget.querySelectorAll('td').forEach(td => (td as HTMLElement).style.background = '#FAFAF7') }}
                        onMouseLeave={e => { e.currentTarget.querySelectorAll('td').forEach(td => (td as HTMLElement).style.background = '') }}
                        onClick={() => navigateTo('devis')}
                      >
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--v22-border)', fontSize: '12px' }}><span className="v22-ref">{d.ref || d.number || `${i + 1}`}</span></td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--v22-border)', fontSize: '12px', fontWeight: 500 }}>{d.client || d.clientName || '—'}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--v22-border)', fontSize: '12px', textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{formatPrice(d.total || d.amount || 0)}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--v22-border)', fontSize: '12px' }}><span className={`v22-tag ${statusClass}`}>{statusLabel}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Actions (kept, role-based) ── */}
      <div className="v22-card" style={{ marginTop: '16px' }}>
        <div className="v22-card-head"><div className="v22-card-title">{t('proDash.home.actionsRapides')}</div></div>
        <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {orgRole === 'artisan' && <>
          <QuickAction icon="📅" label={t('proDash.home.nouvelRdv')} onClick={() => { setShowNewRdv(true); navigateTo('calendar') }} />
          <QuickAction icon="📄" label={t('proDash.home.creerDevis')} onClick={() => { setShowDevisForm(true); setActivePage('devis'); setSidebarOpen(false) }} />
          <QuickAction icon="🧾" label={t('proDash.home.nouvelleFacture')} onClick={() => { setShowFactureForm(true); setActivePage('factures'); setSidebarOpen(false) }} />
          <QuickAction icon="🔧" label={t('proDash.home.nouveauMotif')} onClick={() => { openNewMotif(); navigateTo('motifs') }} />
        </>}
        {orgRole === 'pro_conciergerie' && <>
          <QuickAction icon="🏠" label={t('proDash.home.nouvellePropriete')} onClick={() => navigateTo('proprietes')} />
          <QuickAction icon="📅" label={t('proDash.home.planifierVisite')} onClick={() => { setShowNewRdv(true); navigateTo('calendar') }} />
          <QuickAction icon="📄" label={t('proDash.home.creerDevis')} onClick={() => { setShowDevisForm(true); setActivePage('devis'); setSidebarOpen(false) }} />
          <QuickAction icon="🔑" label={t('proDash.home.gererAcces')} onClick={() => navigateTo('acces')} />
        </>}
        {orgRole === 'pro_gestionnaire' && <>
          <QuickAction icon="📋" label={t('proDash.home.ordreDeMission')} onClick={() => navigateTo('missions')} />
          <QuickAction icon="🏢" label={t('proDash.home.gererImmeuble')} onClick={() => navigateTo('immeubles')} />
          <QuickAction icon="📄" label={t('proDash.home.creerDevis')} onClick={() => { setShowDevisForm(true); setActivePage('devis'); setSidebarOpen(false) }} />
          <QuickAction icon="🧾" label={t('proDash.home.nouvelleFacture')} onClick={() => { setShowFactureForm(true); setActivePage('factures'); setSidebarOpen(false) }} />
        </>}
        </div>
      </div>
    </div>
  )
}

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <div onClick={onClick}
      className="v22-card cursor-pointer text-center hover:shadow-md transition-shadow"
      style={{ padding: '16px 10px' }}>
      <div style={{ fontSize: '24px', marginBottom: '6px' }}>{icon}</div>
      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--v22-text)' }}>{label}</div>
    </div>
  )
}
