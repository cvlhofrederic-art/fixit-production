'use client'

import { formatPrice } from '@/lib/utils'
import { useTranslation, useLocale } from '@/lib/i18n/context'

interface HomeSectionProps {
  artisan: any
  orgRole: 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'
  bookings: any[]
  services: any[]
  pendingBookings: any[]
  completedBookings: any[]
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
  return (
    <div className="animate-fadeIn">
      {/* -- V22 Page header -- */}
      <div className="v22-page-header">
        <div className="v22-page-title">{t('proDash.home.bonjour')} {firstName}</div>
        <div className="v22-page-sub">{pendingBookings.length} {t('proDash.home.interventionsEnAttente')}</div>
      </div>

      {/* -- V22 Stats row -- */}
      <div className="v22-stats">
        <div className="v22-stat v22-stat-yellow" style={{ cursor: 'pointer' }} onClick={() => navigateTo('calendar')}>
          <div className="v22-stat-label">{orgRole === 'pro_societe' ? t('proDash.home.chantiersCeMois') : orgRole === 'pro_gestionnaire' ? t('proDash.home.ordresDeMission') : t('proDash.home.interventionsCeMois')}</div>
          <div className="v22-stat-val">{bookings.length}</div>
          <div className="v22-stat-delta">→ {pendingBookings.length} {t('proDash.home.enAttente')}</div>
        </div>
        <div className="v22-stat" style={{ cursor: 'pointer' }} onClick={() => navigateTo('revenus')}>
          <div className="v22-stat-label">{t('proDash.home.chiffreAffaires')}</div>
          <div className="v22-stat-val">{formatPrice(totalRevenue)}</div>
          <div className="v22-stat-delta v22-up">↑ {completedBookings.length} {t('proDash.home.terminees')}</div>
        </div>
        <div className="v22-stat" style={{ cursor: 'pointer' }} onClick={() => navigateTo(orgRole === 'pro_societe' ? 'equipes' : orgRole === 'pro_gestionnaire' ? 'immeubles' : 'motifs')}>
          <div className="v22-stat-label">{orgRole === 'pro_societe' ? t('proDash.home.equipesActives') : orgRole === 'pro_gestionnaire' ? t('proDash.home.immeublesGeres') : t('proDash.home.motifsActifs')}</div>
          <div className="v22-stat-val">{services.filter(s => s.active).length}</div>
          <div className="v22-stat-delta">{services.length} {t('proDash.home.auTotal')}</div>
        </div>
        <div className="v22-stat" style={{ cursor: 'pointer' }} onClick={() => navigateTo('stats')}>
          <div className="v22-stat-label">{t('proDash.home.noteMoyenne')}</div>
          <div className="v22-stat-val">{artisan?.rating_avg || '5.0'} ★</div>
          <div className="v22-stat-delta">{artisan?.rating_count || 0} {t('proDash.home.avis')}</div>
        </div>
      </div>

      {/* -- V22 Quick actions -- */}
      <div className="v22-card" style={{ marginBottom: '16px' }}>
        <div className="v22-card-head"><div className="v22-card-title">{t('proDash.home.actionsRapides')}</div></div>
        <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {orgRole === 'artisan' && <>
          <QuickAction icon="📅" label={t('proDash.home.nouvelRdv')} onClick={() => { setShowNewRdv(true); navigateTo('calendar') }} />
          <QuickAction icon="📄" label={t('proDash.home.creerDevis')} onClick={() => { setShowDevisForm(true); setActivePage('devis'); setSidebarOpen(false) }} />
          <QuickAction icon="🧾" label={t('proDash.home.nouvelleFacture')} onClick={() => { setShowFactureForm(true); setActivePage('factures'); setSidebarOpen(false) }} />
          <QuickAction icon="🔧" label={t('proDash.home.nouveauMotif')} onClick={() => { openNewMotif(); navigateTo('motifs') }} />
        </>}
        {orgRole === 'pro_societe' && <>
          <QuickAction icon="👷" label={t('proDash.home.nouvelleEquipe')} onClick={() => navigateTo('equipes')} />
          <QuickAction icon="📋" label={t('proDash.home.nouveauChantier')} onClick={() => navigateTo('chantiers')} />
          <QuickAction icon="📄" label={t('proDash.home.creerDevis')} onClick={() => { setShowDevisForm(true); setActivePage('devis'); setSidebarOpen(false) }} />
          <QuickAction icon="🧾" label={t('proDash.home.nouvelleFacture')} onClick={() => { setShowFactureForm(true); setActivePage('factures'); setSidebarOpen(false) }} />
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

      {/* -- V22 Activity -- */}
      <div className="v22-card">
        <div className="v22-card-head">
          <div className="v22-card-title">{t('proDash.home.activiteRecente')}</div>
          <div className="v22-card-meta">{bookings.length} total</div>
        </div>
        {bookings.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--v22-text-muted)' }}>{t('proDash.home.aucuneActivite')}</div>
        ) : (
          bookings.slice(0, 8).map((b) => {
            const statusTag = b.status === 'completed' ? 'v22-tag-green' : b.status === 'confirmed' ? 'v22-tag-yellow' : b.status === 'pending' ? 'v22-tag-amber' : 'v22-tag-red'
            const statusLabel = b.status === 'completed' ? t('proDash.home.termine') : b.status === 'confirmed' ? t('proDash.home.confirme') : b.status === 'pending' ? t('proDash.home.enAttenteStat') : t('proDash.home.annule')
            return (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', borderBottom: '1px solid #F0F0EE', fontSize: '12px', cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF7')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <span className="v22-ref">{b.booking_date}</span>
                <span style={{ fontWeight: 500, color: 'var(--v22-text)', flex: 1 }}>{b.services?.name || 'RDV'}</span>
                <span className="v22-ref">{b.booking_time?.substring(0, 5) || '—'}</span>
                <span className={`v22-tag ${statusTag}`}>{statusLabel}</span>
              </div>
            )
          })
        )}
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
