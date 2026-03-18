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
    <div className="p-6 lg:p-8 animate-fadeIn">
      {/* -- Banniere adaptative -- */}
      {orgRole === 'artisan' && (
        <div className="bg-gradient-to-r from-[#FFC107] to-[#FFD54F] p-6 lg:p-8 rounded-2xl text-gray-900 mb-8 shadow-lg">
          <h1 className="text-3xl lg:text-4xl font-bold mb-2">{'👋'} {t('proDash.home.bonjour')} {firstName} !</h1>
          <p className="text-lg opacity-95">{pendingBookings.length} {t('proDash.home.interventionsEnAttente')}</p>
        </div>
      )}
      {orgRole === 'pro_societe' && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-400 p-6 lg:p-8 rounded-2xl text-white mb-8 shadow-lg">
          <h1 className="text-3xl lg:text-4xl font-bold mb-2">{'🏗️'} {t('proDash.home.bonjour')} {firstName} !</h1>
          <p className="text-lg opacity-95">{t('proDash.home.dashSocieteBTP')} — {pendingBookings.length} {t('proDash.home.chantiersEnAttente')}</p>
        </div>
      )}
      {orgRole === 'pro_conciergerie' && (
        <div className="bg-gradient-to-r from-purple-600 to-purple-400 p-6 lg:p-8 rounded-2xl text-white mb-8 shadow-lg">
          <h1 className="text-3xl lg:text-4xl font-bold mb-2">{'🗝️'} {t('proDash.home.bonjour')} {firstName} !</h1>
          <p className="text-lg opacity-95">{t('proDash.home.conciergerie')} — {pendingBookings.length} {t('proDash.home.demandesEnAttente')}</p>
        </div>
      )}
      {orgRole === 'pro_gestionnaire' && (
        <div className="bg-gradient-to-r from-green-600 to-green-400 p-6 lg:p-8 rounded-2xl text-white mb-8 shadow-lg">
          <h1 className="text-3xl lg:text-4xl font-bold mb-2">{'🏢'} {t('proDash.home.bonjour')} {firstName} !</h1>
          <p className="text-lg opacity-95">{t('proDash.home.gestionnaireImmeubles')} — {pendingBookings.length} {t('proDash.home.ordresEnAttente')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard icon="📅" iconBg="bg-blue-50" iconColor="text-blue-500" value={bookings.length.toString()} label={orgRole === 'pro_societe' ? t('proDash.home.chantiersCeMois') : orgRole === 'pro_gestionnaire' ? t('proDash.home.ordresDeMission') : t('proDash.home.interventionsCeMois')} change={`${pendingBookings.length} ${t('proDash.home.enAttente')}`} positive onClick={() => navigateTo('calendar')} />
        <StatCard icon="💰" iconBg="bg-green-50" iconColor="text-green-500" value={formatPrice(totalRevenue)} label={t('proDash.home.chiffreAffaires')} change={`${completedBookings.length} ${t('proDash.home.terminees')}`} positive onClick={() => navigateTo('revenus')} />
        <StatCard icon="🔧" iconBg="bg-amber-50" iconColor="text-orange-500" value={services.filter(s => s.active).length.toString()} label={orgRole === 'pro_societe' ? t('proDash.home.equipesActives') : orgRole === 'pro_gestionnaire' ? t('proDash.home.immeublesGeres') : t('proDash.home.motifsActifs')} change={`${services.length} ${t('proDash.home.auTotal')}`} onClick={() => navigateTo(orgRole === 'pro_societe' ? 'equipes' : orgRole === 'pro_gestionnaire' ? 'immeubles' : 'motifs')} />
        <StatCard icon="⭐" iconBg="bg-pink-50" iconColor="text-pink-500" value={`${artisan?.rating_avg || '5.0'}/5`} label={t('proDash.home.noteMoyenne')} change={`${artisan?.rating_count || 0} ${t('proDash.home.avis')}`} positive onClick={() => navigateTo('stats')} />
      </div>

      <h2 className="text-xl font-bold mb-4">{t('proDash.home.actionsRapides')}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-5">{t('proDash.home.activiteRecente')}</h2>
        {bookings.length === 0 ? (
          <p className="text-gray-500 text-center py-6">{t('proDash.home.aucuneActivite')}</p>
        ) : (
          bookings.slice(0, 5).map((b) => (
            <ActivityItem
              key={b.id}
              icon={b.status === 'completed' ? '✓' : b.status === 'confirmed' ? '📅' : b.status === 'pending' ? '⏳' : '✕'}
              iconBg={b.status === 'completed' ? 'bg-green-50' : b.status === 'confirmed' ? 'bg-blue-50' : b.status === 'pending' ? 'bg-amber-50' : 'bg-red-50'}
              iconColor={b.status === 'completed' ? 'text-green-500' : b.status === 'confirmed' ? 'text-blue-500' : b.status === 'pending' ? 'text-orange-500' : 'text-red-500'}
              title={`${b.services?.name || 'RDV'} - ${b.status === 'completed' ? t('proDash.home.termine') : b.status === 'confirmed' ? t('proDash.home.confirme') : b.status === 'pending' ? t('proDash.home.enAttenteStat') : t('proDash.home.annule')}`}
              time={`${b.booking_date} ${t('proDash.common.a')} ${b.booking_time?.substring(0, 5) || '?'}`}
            />
          ))
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, iconBg, iconColor, value, label, change, positive, onClick }: {
  icon: string; iconBg: string; iconColor: string; value: string; label: string; change: string; positive?: boolean; onClick?: () => void
}) {
  return (
    <div onClick={onClick}
      className="bg-white p-6 rounded-2xl shadow-sm cursor-pointer hover:-translate-y-1.5 hover:shadow-lg transition-all">
      <div className={`w-14 h-14 ${iconBg} rounded-xl flex items-center justify-center text-2xl mb-4`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-gray-500">{label}</div>
      <div className={`text-sm mt-2 font-semibold ${positive ? 'text-green-500' : 'text-gray-500'}`}>{change}</div>
    </div>
  )
}

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <div onClick={onClick}
      className="bg-white p-6 rounded-2xl border-2 border-gray-200 cursor-pointer text-center hover:border-[#FFC107] hover:-translate-y-1 hover:shadow-lg transition-all">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="font-semibold text-gray-900">{label}</div>
    </div>
  )
}

function ActivityItem({ icon, iconBg, iconColor, title, time }: {
  icon: string; iconBg: string; iconColor: string; title: string; time: string
}) {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer rounded-lg transition">
      <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center text-xl flex-shrink-0`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="flex-1">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-gray-500">{time}</div>
      </div>
    </div>
  )
}
