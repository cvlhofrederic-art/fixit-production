'use client'

import './dashboard-v5.css'
import './dashboard-v5-overrides.css'
import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/lib/i18n/context'
import { SectionErrorBoundary } from '@/components/common/SectionErrorBoundary'
import { useDashboardMessaging } from '@/hooks/useDashboardMessaging'
import { useModulesConfig } from '@/hooks/useModulesConfig'
import { useModuleCategories } from '@/hooks/useModuleCategories'
import { prefetchBTPTables } from '@/lib/hooks/use-btp-data'
import { seedDemoLocalStorage } from '@/lib/seed-demo-localStorage'
import { usePermissions } from '@/hooks/usePermissions'
import { useNotifications } from '@/hooks/useNotifications'
import { useServices, useAbsences, useAvailability, useCalendar, useSettings, useBookings } from '@/hooks/dashboard'
import { getPriceRangeLabel, getPricingUnit, getCleanDescription } from '@/lib/service-utils'
import type { Artisan, Service, Booking, Notification, ChatMessage } from '@/lib/types'
import type { User } from '@supabase/supabase-js'
import { toast } from 'sonner'

// Section loading spinner — shown while JS chunks load
const SectionLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
    <div style={{ width: 24, height: 24, border: '3px solid #E0E0E0', borderTopColor: '#FFC107', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  </div>
)

// dynamic() WITHOUT ssr:false — code-splits without creating Suspense boundaries
// ssr:false was causing React hydration error #419 that broke all button handlers
// webpackPrefetch: true on high-priority sections — browser downloads them during idle time
const HomeSection = dynamic(() => import(/* webpackPrefetch: true */ '@/components/dashboard/HomeSection'), { loading: SectionLoader })
const CalendarSection = dynamic(() => import(/* webpackPrefetch: true */ '@/components/dashboard/CalendarSection'), { loading: SectionLoader })
const HorairesSection = dynamic(() => import('@/components/dashboard/HorairesSection'), { loading: SectionLoader })
const MotifsSection = dynamic(() => import('@/components/dashboard/MotifsSection'), { loading: SectionLoader })
const DevisSection = dynamic(() => import(/* webpackPrefetch: true */ '@/components/dashboard/DevisSection'), { loading: SectionLoader })
const FacturesSection = dynamic(() => import(/* webpackPrefetch: true */ '@/components/dashboard/FacturesSection'), { loading: SectionLoader })
const StatsRevenusSection = dynamic(() => import('@/components/dashboard/StatsRevenusSection'), { loading: SectionLoader })
const SettingsSection = dynamic(() => import('@/components/dashboard/SettingsSection'), { loading: SectionLoader })

const ComptabiliteSection = dynamic(() => import('@/components/dashboard/ComptabiliteSection'), { loading: SectionLoader })
const MateriauxSection = dynamic(() => import('@/components/dashboard/MateriauxSection'), { loading: SectionLoader })
const ClientsSection = dynamic(() => import(/* webpackPrefetch: true */ '@/components/dashboard/ClientsSection'), { loading: SectionLoader })
const RapportsSection = dynamic(() => import('@/components/dashboard/RapportsSection'), { loading: SectionLoader })
const RFQSection = dynamic(() => import('@/components/dashboard/RFQSection'), { loading: SectionLoader })
const CanalProSection = dynamic(() => import('@/components/dashboard/CanalProSection'), { loading: SectionLoader })
const MessagerieArtisan = dynamic(() => import(/* webpackPrefetch: true */ '@/components/dashboard/MessagerieArtisan'), { loading: SectionLoader })
const AiChatBot = dynamic(() => import('@/components/chat/AiChatBot'))

const WalletConformiteSection = dynamic(() => import('@/components/dashboard/WalletConformiteSection'), { loading: SectionLoader })
const CarnetDeVisiteSection = dynamic(() => import('@/components/dashboard/CarnetDeVisiteSection'), { loading: SectionLoader })
const PhotosChantierSection = dynamic(() => import('@/components/dashboard/PhotosChantierSection'), { loading: SectionLoader })
const BourseAuxMarchesSection = dynamic(() => import('@/components/marches/BourseAuxMarchesSection'), { loading: SectionLoader })
const MarketplaceProBTPSection = dynamic(() => import('@/components/dashboard/MarketplaceProBTPSection'), { loading: SectionLoader })

// V22 new sections
const ChantiersV22Section = dynamic(() => import('@/components/dashboard/ChantiersSection'), { loading: SectionLoader })
const PipelineSection = dynamic(() => import('@/components/dashboard/PipelineSection'), { loading: SectionLoader })
const BibliothequeSection = dynamic(() => import('@/components/dashboard/BibliothequeSection'), { loading: SectionLoader })
const PrestationsBTPSection = dynamic(() => import('@/components/dashboard/PrestationsBTPSection'), { loading: SectionLoader })
const ParrainageSection = dynamic(() => import('@/components/dashboard/ParrainageSection'), { loading: SectionLoader })
const AideSection = dynamic(() => import('@/components/dashboard/AideSection'), { loading: SectionLoader })
const ModulesSection = dynamic(() => import('@/components/dashboard/ModulesSection'), { loading: SectionLoader })

// BTP sections — direct imports (no barrel) for proper tree-shaking
const EquipesBTPV2 = dynamic(() => import(/* webpackPrefetch: true */ '@/components/dashboard/EquipesBTPV2'), { loading: SectionLoader })
const ChantiersBTPSection = dynamic(() => import(/* webpackPrefetch: true */ '@/components/dashboard/btp/ChantiersBTPSection').then(mod => mod.ChantiersBTPSection), { loading: SectionLoader })
const GanttSection = dynamic(() => import(/* webpackPrefetch: true */ '@/components/dashboard/btp/GanttSection').then(mod => mod.GanttSection), { loading: SectionLoader })
const SituationsTravaux = dynamic(() => import('@/components/dashboard/btp/SituationsTravaux').then(mod => mod.SituationsTravaux), { loading: SectionLoader })
const RetenuesGarantieSection = dynamic(() => import('@/components/dashboard/btp/RetenuesGarantieSection').then(mod => mod.RetenuesGarantieSection), { loading: SectionLoader })
const PointageEquipesSection = dynamic(() => import(/* webpackPrefetch: true */ '@/components/dashboard/btp/PointageEquipesSection').then(mod => mod.PointageEquipesSection), { loading: SectionLoader })
const SousTraitanceDC4Section = dynamic(() => import('@/components/dashboard/btp/SousTraitanceDC4Section').then(mod => mod.SousTraitanceDC4Section), { loading: SectionLoader })
const DPGFSection = dynamic(() => import('@/components/dashboard/btp/DPGFSection').then(mod => mod.DPGFSection), { loading: SectionLoader })
const PortailClientSection = dynamic(() => import('@/components/dashboard/btp/PortailClientSection'), { loading: SectionLoader })
const SousTraitanceOffresSection = dynamic(() => import('@/components/dashboard/SousTraitanceOffresSection'), { loading: SectionLoader })
const RentabiliteChantierSection = dynamic(() => import('@/components/dashboard/RentabiliteChantierSection'), { loading: SectionLoader })
const ChantiersBTPV2 = dynamic(() => import('@/components/dashboard/ChantiersBTPV2').then(mod => mod.ChantiersBTPV2), { loading: SectionLoader })
const PointageGeoSection = dynamic(() => import('@/components/dashboard/PointageGeoSection').then(mod => mod.PointageGeoSection), { loading: SectionLoader })
const ComptaBTPSection = dynamic(() => import('@/components/dashboard/ComptaBTPSection').then(mod => mod.ComptaBTPSection), { loading: SectionLoader })
const CompteUtilisateursSection = dynamic(() => import(/* webpackPrefetch: true */ '@/components/dashboard/CompteUtilisateursSection'), { loading: SectionLoader })
const MeteoChantierSection = dynamic(() => import('@/components/dashboard/btp/MeteoChantierSection').then(mod => mod.MeteoChantierSection), { loading: SectionLoader })

// V5 layout components
const V5Sidebar = dynamic(() => import('@/components/dashboard/V5Sidebar'), { loading: SectionLoader })
const V5SidebarArtisan = dynamic(() => import('@/components/dashboard/V5SidebarArtisan'), { loading: SectionLoader })
const V5Header = dynamic(() => import('@/components/dashboard/V5Header'), { loading: SectionLoader })

// Conciergerie sections — NO ssr:false (causes React #419 hydration error)
const ProprietesConciergerieSection = dynamic(() => import('@/components/dashboard/ConciergerieSections').then(mod => mod.ProprietesConciergerieSection), { loading: SectionLoader })
const AccesConciergerieSection = dynamic(() => import('@/components/dashboard/ConciergerieSections').then(mod => mod.AccesConciergerieSection), { loading: SectionLoader })
const ChannelManagerSection = dynamic(() => import('@/components/dashboard/ConciergerieSections').then(mod => mod.ChannelManagerSection), { loading: SectionLoader })
const TarificationSection = dynamic(() => import('@/components/dashboard/ConciergerieSections').then(mod => mod.TarificationSection), { loading: SectionLoader })
const CheckinOutSection = dynamic(() => import('@/components/dashboard/ConciergerieSections').then(mod => mod.CheckinOutSection), { loading: SectionLoader })
const LivretAccueilSection = dynamic(() => import('@/components/dashboard/ConciergerieSections').then(mod => mod.LivretAccueilSection), { loading: SectionLoader })
const PlanningMenageSection = dynamic(() => import('@/components/dashboard/ConciergerieSections').then(mod => mod.PlanningMenageSection), { loading: SectionLoader })
const RevPARSection = dynamic(() => import('@/components/dashboard/ConciergerieSections').then(mod => mod.RevPARSection), { loading: SectionLoader })

// Gestionnaire sections — NO ssr:false (causes React #419 hydration error)
const ImmeublesGestionnaireSection = dynamic(() => import('@/components/dashboard/GestionnaireSections').then(mod => mod.ImmeublesGestionnaireSection), { loading: SectionLoader })
const MissionsGestionnaireSection = dynamic(() => import('@/components/dashboard/GestionnaireSections').then(mod => mod.MissionsGestionnaireSection), { loading: SectionLoader })
const ContratsSection = dynamic(() => import('@/components/dashboard/GestionnaireSections').then(mod => mod.ContratsSection), { loading: SectionLoader })


type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface DevisLine {
  id: number
  description: string
  qty: number
  unit: string
  priceHT: number
  tvaRate: number
  totalHT: number
}

function SuspenseFallback() {
  // Neutral spinner — pure inline styles, safe for SSR hydration, no V22/V5 leak
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2F2F0' }}>
      <div style={{ width: 28, height: 28, border: '3px solid #E0E0E0', borderTopColor: '#FFC107', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}

export default function DashboardPageWrapper() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <DashboardPage />
    </Suspense>
  )
}

function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, locale } = useTranslation()
  const isPt = locale === 'pt'
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  // ── Core auth state (kept here — loadDashboardData initializes all hooks) ──
  const [artisan, setArtisan] = useState<Artisan | null>(null)
  // Always start as 'artisan' to match SSR — loadDashboardData sets the real role
  const [orgRole, setOrgRole] = useState<OrgRole>('artisan')
  const [loading, setLoading] = useState(true)
  const [showAdminBtn, setShowAdminBtn] = useState(false)
  const [adminLoading, setAdminLoading] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [activePage, setActivePage] = useState(() => searchParams?.get('p') || 'home')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ── Sync URL → state on browser back/forward ──
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search)
      setActivePage(params.get('p') || 'home')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // ── Dynamic tab title: show company name (reset on unmount) ──
  useEffect(() => {
    if (artisan?.company_name) {
      document.title = `Vitfix — ${artisan.company_name}`
      return () => { document.title = 'Vitfix' }
    }
  }, [artisan?.company_name])

  // ── Custom hooks (state + logic extracted) ──
  const svcHook = useServices(artisan?.id, t)
  const { services, setServices, showMotifModal, setShowMotifModal, editingMotif, motifForm, setMotifForm, savingMotif, openNewMotif, openEditMotif, saveMotif, toggleMotifActive, deleteMotif } = svcHook

  const absHook = useAbsences(artisan?.id, isPt)
  const { absences, setAbsences, showAbsenceModal, setShowAbsenceModal, newAbsence, setNewAbsence, createAbsence, deleteAbsence, isDateAbsent } = absHook

  const availHook = useAvailability(artisan, setArtisan)
  const { availability, setAvailability, dayServices, setDayServices, autoAccept, setAutoAccept, savingAvail, toggleAutoAccept, toggleDayAvailability, updateAvailabilityTime, toggleDayService, loadCalendarData, getCalendarHours } = availHook

  const bkHook = useBookings(artisan, services, isPt)
  const {
    bookings, setBookings, showNewRdv, setShowNewRdv, newRdv, setNewRdv,
    selectedBooking, setSelectedBooking, showBookingDetail, setShowBookingDetail,
    convertingDevis, setConvertingDevis, showDevisForm, setShowDevisForm,
    showFactureForm, setShowFactureForm, savedDocuments, setSavedDocuments,
    completedBookings, pendingBookings, totalRevenue,
    autoAddClientFromBooking, createRdvManual, updateBookingStatus,
    handleEmptyCellClick, handleBookingClick, transformBookingToDevis, convertDevisToFacture,
  } = bkHook

  const calHook = useCalendar(bookings, availability, dateFmtLocale, t)
  const { calendarView, setCalendarView, selectedDay, setSelectedDay, getBookingsForDate, getWorkingWeekDates, getCalendarTitle, navigateCalendar, getMonthDays } = calHook

  const setHook = useSettings(artisan, setArtisan, dayServices, isPt, t)
  const { settingsForm, setSettingsForm, savingSettings, profilePhotoFile, setProfilePhotoFile, profilePhotoPreview, setProfilePhotoPreview, profilePhotoUploading, setProfilePhotoUploading, uploadMsg, setUploadMsg, saveSettings, uploadDocument, initSettingsForm } = setHook

  // ── Modules config ──
  const { ALL_MODULES, modulesConfig, setModulesConfig: saveModulesConfig, isModuleEnabled, moveModule, categoriesOrder, saveCategoriesOrder, moveCategory, reorderModuleTo, reorderCategoryTo, CATEGORIES_DEFAULT } = useModulesConfig(artisan?.id, t)
  // Shared sidebar/modules categories (single source of truth for V5Sidebar + ModulesSection)
  const { categories: moduleCategories, setCategories: setModuleCategories } = useModuleCategories(ALL_MODULES)

  // ── Pro team permissions (RBAC for pro_societe sub-accounts) ──
  const { permissions: proPermissions, isGerant: isProGerant, canAccess: proCanAccess } = usePermissions(orgRole, artisan)

  // ── Messagerie artisan dashboard ──
  const messaging = useDashboardMessaging({ artisan, isPt, dateFmtLocale })
  const {
    dashMsgModal, setDashMsgModal,
    dashMsgList, setDashMsgList,
    dashMsgText, setDashMsgText,
    dashMsgSending, dashMsgUploading, dashMsgRecording,
    dashMsgBlockingAgenda,
    dashMsgFullscreenImg, setDashMsgFullscreenImg,
    openDashMessages, sendDashMessage, sendDashPhotoMessage,
    startDashVoiceRecording, stopDashVoiceRecording,
    handleBlockAgendaFromDevis, uploadDashAttachment, getDashAuthToken,
  } = messaging

  // ── Notifications ── (refs to break circular dependency with navigateTo)
  const navigateRef = useRef<(page: string) => void>(() => {})
  const notifCallbacks = useMemo(() => ({
    onNavigate: (page: string) => navigateRef.current(page),
    onNewBooking: (b: Booking) => { setBookings(prev => [b, ...prev]); if (b.status === 'confirmed') autoAddClientFromBooking(b) },
    getAuthToken: getDashAuthToken,
    t, isPt,
  }), [getDashAuthToken, t, isPt, setBookings, autoAddClientFromBooking])
  const {
    notifications, setNotifications,
    showNotifDropdown, setShowNotifDropdown,
    unreadNotifCount, setUnreadNotifCount,
    unreadMsgCount, refreshUnreadMsgCount,
  } = useNotifications(artisan?.user_id, artisan?.id, notifCallbacks)

  // ── Day names for calendar/horaires (memoized to avoid re-renders) ──
  const DAY_NAMES = useMemo(() => [t('proDash.days.sunday'), t('proDash.days.monday'), t('proDash.days.tuesday'), t('proDash.days.wednesday'), t('proDash.days.thursday'), t('proDash.days.friday'), t('proDash.days.saturday')], [t])
  const DAY_SHORT = useMemo(() => [t('proDash.days.sunShort'), t('proDash.days.monShort'), t('proDash.days.tueShort'), t('proDash.days.wedShort'), t('proDash.days.thuShort'), t('proDash.days.friShort'), t('proDash.days.satShort')], [t])

  // ══════════ AUTH INIT + DATA LOAD ══════════
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    let didLoad = false

    const initAuth = async () => {
      // getSession suffit côté client — getUser (round-trip réseau) n'est nécessaire
      // que si la session locale est corrompue, ce qui est géré par onAuthStateChange
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) { didLoad = true; loadDashboardData(session.user) }
      // Si pas de session, on attend INITIAL_SESSION de onAuthStateChange
      // qui va soit fournir un user, soit on redirige après un timeout
      else { setTimeout(() => { if (!didLoad) window.location.href = '/auth/login' }, 3000) }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') window.location.href = '/auth/login'
      if (!didLoad && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {
        didLoad = true; loadDashboardData(session.user)
      }
    })
    return () => { isMountedRef.current = false; subscription.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Central data loader — initializes state across all hooks */
  const loadDashboardData = async (user: User) => {
    if (!user) { router.push('/auth/login'); return }

    const role = user.user_metadata?.role || 'artisan'
    if (['pro_societe', 'pro_conciergerie', 'pro_gestionnaire'].includes(role)) {
      setOrgRole(role as OrgRole)
      try { sessionStorage.setItem('fixit_org_role', role) } catch { /* private browsing */ }
    }

    // Store pro team role in localStorage for usePermissions hook
    if (role === 'pro_societe') {
      try {
        const teamRole = user.user_metadata?.pro_team_role
        const companyId = user.user_metadata?.company_id
        if (teamRole) localStorage.setItem('fixit_pro_team_role', teamRole)
        else localStorage.removeItem('fixit_pro_team_role')
        if (companyId) localStorage.setItem('fixit_pro_company_id', companyId)
        else localStorage.removeItem('fixit_pro_company_id')
      } catch { /* private browsing */ }
    }

    const { data: artisanData } = await supabase.from('profiles_artisan').select('*').eq('user_id', user.id).single()
    if (user.user_metadata?._admin_override) setShowAdminBtn(true)
    const isProOrgRole = ['pro_societe', 'pro_conciergerie', 'pro_gestionnaire'].includes(role)
    if (!artisanData && !user.user_metadata?._admin_override && !isProOrgRole) { router.push('/auth/login'); return }
    if (!artisanData) {
      setArtisan({ id: user.id, company_name: user.user_metadata?.company_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Mon entreprise', email: user.email, phone: user.user_metadata?.phone || '', bio: '', user_id: user.id })
      seedDemoLocalStorage(user.id, !!user.user_metadata?._admin_override)
      prefetchBTPTables(['chantiers', 'membres', 'equipes', 'pointages', 'situations', 'retenues', 'dc4', 'dpgf'], user.id)
      setLoading(false); return
    }

    setArtisan(artisanData)
    supabase.from('profiles_artisan').update({ last_seen_at: new Date().toISOString() }).eq('id', artisanData.id).then()
    initSettingsForm(artisanData, user.email || '')
    if (artisanData.auto_accept !== undefined) setAutoAccept(!!artisanData.auto_accept)

    const aid = artisanData.id

    // Seed demo localStorage data for super admin demo account (no-op for other accounts)
    seedDemoLocalStorage(aid, !!user.user_metadata?._admin_override)

    // Load localStorage data first (instant) — unblocks UI immediately
    try { setAbsences(JSON.parse(localStorage.getItem(`fixit_absences_${aid}`) || '[]')) } catch { setAbsences([]) }
    try { const s = localStorage.getItem(`fixit_availability_services_${aid}`); if (s) setDayServices(JSON.parse(s)) } catch { console.warn('fixit_availability_services: JSON.parse failed (private browsing?)') }
    try {
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${aid}`) || '[]')
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${aid}`) || '[]')
      setSavedDocuments([...docs, ...drafts])
    } catch { console.warn('fixit_documents/drafts: JSON.parse failed (private browsing?)') }

    setLoading(false)

    // Prefetch BTP data in parallel (fills cache for Chantiers, Équipes, Membres, Pointages)
    prefetchBTPTables(['chantiers', 'membres', 'equipes', 'pointages', 'situations', 'retenues', 'dc4', 'dpgf'], artisanData.user_id || artisanData.id)

    // Parallel fetch: bookings + services (non-blocking, UI already visible)
    const [bookingsRes, servicesRes] = await Promise.all([
      supabase.from('bookings').select('*, services(name)').eq('artisan_id', aid).order('booking_date', { ascending: false }).limit(20),
      supabase.from('services').select('*').eq('artisan_id', aid),
    ])
    if (!isMountedRef.current) return // Composant démonté pendant le fetch
    setBookings(bookingsRes.data || [])
    setServices(servicesRes.data || [])

    // Auto-add clients from bookings (deferred, non-blocking)
    const confirmed = (bookingsRes.data || []).filter((b: Booking) => b.status === 'confirmed' || b.status === 'completed')
    requestAnimationFrame(() => { for (const b of confirmed) autoAddClientFromBooking(b) })
  }

  // Lazy-load calendar/horaires data when first visited
  useEffect(() => {
    if ((activePage === 'calendar' || activePage === 'horaires') && artisan?.id) {
      loadCalendarData(artisan.id).then((apiAbsences) => {
        if (apiAbsences && apiAbsences.length > 0) setAbsences(apiAbsences)
      })
    }
  }, [activePage, artisan?.id, loadCalendarData, setAbsences])

  // ── Navigation — syncs state + URL (bookmarkable, back/forward works) ──
  const navigateTo = useCallback((page: string) => {
    window.scrollTo(0, 0)
    setActivePage(page)
    setSidebarOpen(false)
    if (page === 'devis') setShowDevisForm(false)
    if (page === 'factures') setShowFactureForm(false)
    // Push URL without full page reload — enables back/forward + bookmarks
    const url = page === 'home' ? '/pro/dashboard' : `/pro/dashboard?p=${page}`
    window.history.pushState({}, '', url)
    // Update tab title with current section name
    const sectionName = page === 'home' ? 'Accueil' : page.charAt(0).toUpperCase() + page.slice(1).replace(/_/g, ' ')
    document.title = `Vitfix — ${sectionName}`
  }, [setShowDevisForm, setShowFactureForm])

  // Keep ref in sync for notification callbacks
  navigateRef.current = navigateTo

  // ── Wrap transformBookingToDevis to also navigate ──
  const handleTransformBookingToDevis = useCallback((booking: Booking) => {
    transformBookingToDevis(booking)
    navigateTo('devis')
    setSidebarOpen(false)
  }, [transformBookingToDevis, navigateTo])

  // ── Wrap convertDevisToFacture to also navigate ──
  const handleConvertDevisToFacture = useCallback((devis: Record<string, unknown>) => {
    convertDevisToFacture(devis)
    navigateTo('factures')
  }, [convertDevisToFacture, navigateTo])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = `/${locale}/`
  }

  const firstName = artisan?.company_name?.split(' ')[0] || 'Pro'
  const initials = artisan?.company_name
    ? artisan.company_name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'PR'
    : 'PR'

  // V5 layout applies to pro_societe AND artisan
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'

  if (loading) {
    // Neutral loading screen — no V22 or V5 styling to prevent flash
    // orgRole is always 'artisan' initially so we can't branch on isV5 here
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2F2F0' }}>
        <div style={{ width: 28, height: 28, border: '3px solid #E0E0E0', borderTopColor: '#FFC107', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div id={isV5 ? 'artisan-dashboard-v5' : 'artisan-dashboard-v22'} className={isV5 ? 'v5-app' : 'h-screen flex flex-col overflow-hidden'}>

      {/* ── BOUTON RETOUR ADMIN (mode override) ── */}
      {showAdminBtn && (
        <div className="fixed top-1 right-16 z-[9999]">
          <button
            onClick={async () => {
              setAdminLoading(true)
              try {
                const { data: { user: u } } = await supabase.auth.getUser()
                if (u?.user_metadata?._admin_override) {
                  await supabase.auth.updateUser({ data: { ...u.user_metadata, role: 'super_admin', _admin_override: false } })
                  await supabase.auth.refreshSession()
                  window.location.href = '/admin/dashboard'
                }
              } finally {
                setAdminLoading(false)
              }
            }}
            disabled={adminLoading}
            className="v22-btn v22-btn-primary text-[10px] px-3 py-1"
          >
            ⚡ Retour Admin
          </button>
        </div>
      )}

      {/* ══════════ V5 SIDEBAR ═══════��══ */}
      {isV5 && orgRole === 'pro_societe' && (
        <V5Sidebar
          activePage={activePage} navigateTo={navigateTo} handleLogout={handleLogout}
          isProGerant={isProGerant} proCanAccess={proCanAccess} isModuleEnabled={isModuleEnabled}
          isPt={isPt} pendingBookings={pendingBookings} unreadMsgCount={unreadMsgCount}
          dynamicCategories={moduleCategories}
        />
      )}
      {isV5 && orgRole === 'artisan' && (
        <V5SidebarArtisan
          activePage={activePage} navigateTo={navigateTo} handleLogout={handleLogout}
          isModuleEnabled={isModuleEnabled} isPt={isPt} pendingBookings={pendingBookings}
          unreadMsgCount={unreadMsgCount}
        />
      )}

      {/* ══════════ V22 TOPBAR — non pro_societe ══════════ */}
      {!isV5 && (
      <header className="h-14 flex-shrink-0 flex items-center px-5 gap-4" style={{ background: 'var(--v22-text)', borderBottom: '2px solid var(--v22-yellow)' }}>
        <button className="lg:hidden text-white text-lg" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
        <a href="#" className="v22-mono text-xs font-medium tracking-wider uppercase no-underline" onClick={(e) => { e.preventDefault(); navigateTo('home') }}>
          <span style={{ color: 'var(--v22-yellow)' }}>VIT</span><span className="text-white">FIX</span>
        </a>
        <span className="v22-mono text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-sm" style={{ background: 'var(--v22-yellow)', color: 'var(--v22-text)' }}>Espace Pro</span>
        {/* ── Bouton Notifications ── */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded v22-mono text-xs transition hover:bg-white/10"
            style={{ border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}
            aria-label="Notifications"
          >
            <span>Notifications</span>
            {unreadNotifCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold" style={{ background: 'var(--v22-red, #ef4444)', color: '#fff' }}>
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </span>
            )}
            <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
          </button>
          {showNotifDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifDropdown(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 overflow-hidden v22-card" style={{ width: 360, maxHeight: 480 }}>
                <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid var(--v22-border)' }}>
                  <span className="text-xs font-semibold" style={{ color: 'var(--v22-text)' }}>Notifications</span>
                  {unreadNotifCount > 0 && (
                    <button
                      onClick={async () => {
                        setNotifLoading(true)
                        try {
                          const token = await getDashAuthToken()
                          await fetch('/api/syndic/notify-artisan', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                            body: JSON.stringify({ mark_all_read: true, artisan_id: artisan?.user_id || '' }),
                          })
                          setNotifications(prev => prev.map(n => ({ ...n, read: true })))
                          setUnreadNotifCount(0)
                        } catch { toast.error('Impossible de marquer les notifications comme lues') }
                        finally { setNotifLoading(false) }
                      }}
                      disabled={notifLoading}
                      className="text-[10px] v22-mono hover:underline" style={{ color: 'var(--v22-yellow)' }}
                    >
                      Tout marquer lu
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs" style={{ color: 'var(--v22-text-muted)' }}>
                      Aucune notification
                    </div>
                  ) : (
                    notifications.slice(0, 20).map((n: Notification) => (
                      <button
                        key={n.id}
                        disabled={notifLoading}
                        onClick={async () => {
                          // Marquer comme lue
                          if (!n.read) {
                            setNotifLoading(true)
                            try {
                              const token = await getDashAuthToken()
                              await fetch('/api/syndic/notify-artisan', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                body: JSON.stringify({ notification_id: n.id, artisan_id: artisan?.user_id }),
                              })
                              setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
                              setUnreadNotifCount(prev => Math.max(0, prev - 1))
                            } catch { toast.error('Impossible de marquer la notification comme lue') }
                            finally { setNotifLoading(false) }
                          }
                          setShowNotifDropdown(false)
                          // Navigation selon le type
                          if (n.type === 'message' || n.type === 'booking_message') navigateTo('messages')
                          else if (n.type === 'new_booking') {
                            // Ouvrir le booking detail directement
                            let dataJson: Record<string, unknown> = {}
                            try { dataJson = typeof n.data_json === 'string' ? JSON.parse(n.data_json || '{}') : (n.data_json || {}) } catch { /* malformed JSON */ }
                            const bookingId = dataJson.booking_id
                            const found = bookingId ? bookings.find((b: Booking) => b.id === bookingId) : null
                            if (found) {
                              setSelectedBooking(found)
                              setShowBookingDetail(true)
                              navigateTo('calendar')
                            } else {
                              navigateTo('calendar')
                            }
                          }
                          else if (n.type === 'new_mission' || n.type === 'planning_change') navigateTo('calendar')
                          else if (n.type === 'devis_signed') navigateTo('devis')
                          else if (n.type === 'tva_threshold') navigateTo('comptabilite')
                          else if (n.type?.startsWith('marketplace_')) navigateTo('marketplace_btp')
                          else navigateTo('home')
                        }}
                        className="w-full px-3 py-2.5 text-left flex items-start gap-2.5 transition text-xs hover:bg-[var(--v22-bg)]"
                        style={{ background: n.read ? 'transparent' : 'rgba(250, 204, 21, 0.04)', borderBottom: '1px solid var(--v22-border)' }}
                      >
                        <span style={{ fontSize: 8, marginTop: 4, color: n.read ? 'var(--v22-text-muted)' : 'var(--v22-yellow)' }}>
                          {n.read ? '○' : '●'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate" style={{ color: 'var(--v22-text)' }}>{n.title}</div>
                          {n.body && <div className="truncate mt-0.5" style={{ color: 'var(--v22-text-muted)', fontSize: 11 }}>{n.body}</div>}
                          <div className="mt-1 v22-mono" style={{ color: 'var(--v22-text-muted)', fontSize: 10 }}>
                            {(() => {
                              const diff = Date.now() - new Date(n.created_at || '').getTime()
                              const mins = Math.floor(diff / 60000)
                              if (mins < 1) return 'à l\'instant'
                              if (mins < 60) return `${mins}min`
                              const hours = Math.floor(mins / 60)
                              if (hours < 24) return `${hours}h`
                              return `${Math.floor(hours / 24)}j`
                            })()}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold v22-mono" style={{ background: 'var(--v22-yellow)', color: 'var(--v22-text)' }}>
          {initials}
        </div>
      </header>
      )}

      {/* ══════════ BODY ══════════ */}
      <div className={isV5 ? 'v5-main' : 'flex flex-1 overflow-hidden'}>

      {/* ── V5 header (inside v5-main column) ── */}
      {isV5 && (
        <V5Header
          artisan={artisan} initials={initials} notifications={notifications}
          showNotifDropdown={showNotifDropdown} setShowNotifDropdown={setShowNotifDropdown}
          unreadNotifCount={unreadNotifCount} setUnreadNotifCount={setUnreadNotifCount}
          setNotifications={setNotifications} notifLoading={notifLoading} setNotifLoading={setNotifLoading}
          getDashAuthToken={getDashAuthToken} bookings={bookings}
          setSelectedBooking={setSelectedBooking} setShowBookingDetail={setShowBookingDetail}
          navigateTo={navigateTo} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        />
      )}

      {/* ══════════ V22 SIDEBAR — conciergerie & gestionnaire only ══════════ */}
      {!isV5 && (
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static z-40 w-[220px] h-[calc(100vh-48px)] overflow-y-auto transition-transform duration-200 v22-sidebar flex flex-col flex-shrink-0`} style={{ borderRight: '1px solid var(--v22-yellow)' }}>
        <div className="flex-1 pt-5">
          {/* Principal */}
          <div className="mb-5">
            <div className="v22-sidebar-label">{t('proDash.sidebar.main')}</div>
            <V22SidebarItem label={t('proDash.modules.home')} active={activePage === 'home'} onClick={() => navigateTo('home')} />
            {orgRole === 'pro_conciergerie' && <>
              <V22SidebarItem label={t('proDash.conciergerie.properties')} active={activePage === 'proprietes'} onClick={() => navigateTo('proprietes')} />
              <V22SidebarItem label={t('proDash.modules.planning')} active={activePage === 'calendar'} onClick={() => navigateTo('calendar')} />
              <V22SidebarItem label={t('proDash.conciergerie.access')} active={activePage === 'acces'} onClick={() => navigateTo('acces')} />
              <V22SidebarItem label={t('proDash.conciergerie.channelManager')} active={activePage === 'channel_manager'} onClick={() => navigateTo('channel_manager')} />
              <V22SidebarItem label={t('proDash.conciergerie.pricing')} active={activePage === 'tarification'} onClick={() => navigateTo('tarification')} />
              <V22SidebarItem label={t('proDash.conciergerie.checkinout')} active={activePage === 'checkinout'} onClick={() => navigateTo('checkinout')} />
              <V22SidebarItem label={t('proDash.conciergerie.welcomeBook')} active={activePage === 'livret'} onClick={() => navigateTo('livret')} />
              <V22SidebarItem label={t('proDash.conciergerie.cleaningSchedule')} active={activePage === 'menage'} onClick={() => navigateTo('menage')} />
              <V22SidebarItem label={t('proDash.conciergerie.revpar')} active={activePage === 'revpar'} onClick={() => navigateTo('revpar')} />
            </>}
            {orgRole === 'pro_gestionnaire' && <>
              <V22SidebarItem label={t('proDash.gestionnaire.buildings')} active={activePage === 'immeubles'} onClick={() => navigateTo('immeubles')} />
              <V22SidebarItem label={t('proDash.gestionnaire.missions')} active={activePage === 'missions'} onClick={() => navigateTo('missions')} />
              <V22SidebarItem label={t('proDash.modules.planning')} active={activePage === 'calendar'} onClick={() => navigateTo('calendar')} />
            </>}
          </div>
          {/* Communication */}
          <div className="mb-5">
            <div className="v22-sidebar-label">{t('proDash.sidebar.communication')}</div>
            {isModuleEnabled('messages') && <V22SidebarItem label={t('proDash.modules.messaging')} active={activePage === 'messages' || activePage === 'comm_pro'} badge={(unreadMsgCount + pendingBookings.length) || undefined} badgeRed onClick={() => navigateTo('messages')} />}
            {isModuleEnabled('clients') && <V22SidebarItem label={t('proDash.modules.clients')} active={activePage === 'clients'} onClick={() => navigateTo('clients')} />}
          </div>
          {/* Facturation */}
          <div className="mb-5">
            <div className="v22-sidebar-label">{t('proDash.sidebar.facturation')}</div>
            {isModuleEnabled('devis') && <V22SidebarItem label={t('proDash.modules.quotes')} active={activePage === 'devis'} onClick={() => navigateTo('devis')} />}
            {isModuleEnabled('factures') && <V22SidebarItem label={t('proDash.modules.invoices')} active={activePage === 'factures'} onClick={() => navigateTo('factures')} />}
            {isModuleEnabled('rapports') && <V22SidebarItem label={t('proDash.modules.reports')} active={activePage === 'rapports'} onClick={() => navigateTo('rapports')} />}
            <V22SidebarItem label={t('proDash.modules.sitePhotos', 'Photos Chantier')} active={activePage === 'photos_chantier'} onClick={() => navigateTo('photos_chantier')} />
            {isModuleEnabled('contrats') && orgRole === 'pro_gestionnaire' && (
              <V22SidebarItem label={t('proDash.modules.contracts')} active={activePage === 'contrats'} onClick={() => navigateTo('contrats')} />
            )}
          </div>
          {/* Analyse */}
          <div className="mb-5">
            <div className="v22-sidebar-label">{t('proDash.sidebar.analyse')}</div>
            {isModuleEnabled('stats') && <V22SidebarItem label={t('proDash.modules.stats')} active={activePage === 'stats'} onClick={() => navigateTo('stats')} />}
            {isModuleEnabled('revenus') && <V22SidebarItem label={t('proDash.modules.revenue')} active={activePage === 'revenus'} onClick={() => navigateTo('revenus')} />}
            {isModuleEnabled('comptabilite') && <V22SidebarItem label={t('proDash.modules.accounting')} active={activePage === 'comptabilite'} onClick={() => navigateTo('comptabilite')} />}
            {isModuleEnabled('marches') && (
              <V22SidebarItem label={t('proDash.modules.marches', 'Bourse aux Marchés')} active={activePage === 'marches'} onClick={() => navigateTo('marches')} />
            )}
            {isModuleEnabled('marketplace_btp') && <V22SidebarItem label="🏗️ Marketplace BTP" active={activePage === 'marketplace_btp'} onClick={() => navigateTo('marketplace_btp')} />}
          </div>
        </div>
        {/* Compte (bottom) */}
        <div className="flex-shrink-0 pt-3 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="v22-sidebar-label">{t('proDash.sidebar.compte')}</div>
          <V22SidebarItem label={t('proDash.myProfile')} active={activePage === 'settings'} onClick={() => navigateTo('settings')} />
          <V22SidebarItem label="Modules" active={activePage === 'modules'} onClick={() => navigateTo('modules')} />
          <V22SidebarItem label={t('proDash.modules.help')} active={activePage === 'help'} onClick={() => navigateTo('help')} />
          <V22SidebarItem label={t('proDash.logout')} active={false} onClick={async () => { await supabase.auth.signOut(); window.location.href = `/${locale}/` }} />
        </div>
      </aside>
      )}

      {sidebarOpen && (
        <div className={`fixed inset-0 z-30 ${isV5 ? '' : 'lg:hidden'} bg-black/50`} onClick={() => setSidebarOpen(false)} />
      )}

      {/* ══════════ CONTENT ══════════ */}
      <main className={isV5 ? 'v5-ct' : 'flex-1 overflow-y-auto p-6'} style={isV5 ? undefined : { background: 'var(--v22-bg)' }}>

          {/* ────── HOME ────── */}
          {activePage === 'home' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro no painel' : 'Erreur dans le tableau de bord'}>
            <HomeSection
              artisan={artisan!} orgRole={orgRole} bookings={bookings} services={services}
              pendingBookings={pendingBookings} completedBookings={completedBookings}
              totalRevenue={totalRevenue} firstName={firstName}
              navigateTo={navigateTo} setShowNewRdv={setShowNewRdv}
              setShowDevisForm={setShowDevisForm} setShowFactureForm={setShowFactureForm}
              setActivePage={navigateTo} setSidebarOpen={setSidebarOpen}
              openNewMotif={openNewMotif}
            />
            </SectionErrorBoundary>
          )}

          {/* ────── AGENDA ────── */}
          {activePage === 'calendar' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro na agenda' : "Erreur dans l'agenda"}>
            <CalendarSection
              artisan={artisan!} bookings={bookings} services={services}
              pendingBookings={pendingBookings} completedBookings={completedBookings} totalRevenue={totalRevenue}
              calendarView={calendarView} setCalendarView={setCalendarView}
              selectedDay={selectedDay} setSelectedDay={setSelectedDay}
              showNewRdv={showNewRdv} setShowNewRdv={setShowNewRdv}
              newRdv={newRdv} setNewRdv={setNewRdv}
              showAbsenceModal={showAbsenceModal} setShowAbsenceModal={setShowAbsenceModal}
              newAbsence={newAbsence} setNewAbsence={setNewAbsence}
              showBookingDetail={showBookingDetail} setShowBookingDetail={setShowBookingDetail}
              selectedBooking={selectedBooking} setSelectedBooking={setSelectedBooking}
              getCalendarTitle={getCalendarTitle} navigateCalendar={navigateCalendar}
              getCalendarHours={getCalendarHours} getBookingsForDate={getBookingsForDate}
              isDateAbsent={isDateAbsent} getWorkingWeekDates={getWorkingWeekDates}
              getMonthDays={getMonthDays}
              handleEmptyCellClick={handleEmptyCellClick} handleBookingClick={handleBookingClick}
              createRdvManual={createRdvManual} createAbsence={createAbsence}
              deleteAbsence={deleteAbsence} updateBookingStatus={updateBookingStatus}
              transformBookingToDevis={handleTransformBookingToDevis} openDashMessages={openDashMessages}
              DAY_NAMES={DAY_NAMES} DAY_SHORT={DAY_SHORT}
              orgRole={orgRole}
            />
            </SectionErrorBoundary>
          )}

          {/* ────── HORAIRES D'OUVERTURE ────── */}
          {activePage === 'horaires' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro nos horários' : "Erreur dans les horaires"}>
            <HorairesSection
              artisan={artisan!} services={services} availability={availability}
              dayServices={dayServices} autoAccept={autoAccept} savingAvail={savingAvail}
              toggleAutoAccept={toggleAutoAccept} toggleDayAvailability={toggleDayAvailability}
              updateAvailabilityTime={updateAvailabilityTime} toggleDayService={toggleDayService}
              DAY_NAMES={DAY_NAMES} orgRole={orgRole}
            />
            </SectionErrorBoundary>
          )}

          {/* ────── MOTIFS / PRESTATIONS - FULL CRUD ────── */}
          {(activePage === 'motifs' || activePage === 'prestations') && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro nos serviços' : 'Erreur dans les services'}>
            {orgRole === 'pro_societe' ? (
              <PrestationsBTPSection artisan={artisan!} orgRole={orgRole} navigateTo={navigateTo} />
            ) : (
              <MotifsSection
                services={services}
                showMotifModal={showMotifModal} setShowMotifModal={setShowMotifModal}
                editingMotif={editingMotif} motifForm={motifForm} setMotifForm={setMotifForm}
                savingMotif={savingMotif} openNewMotif={openNewMotif} openEditMotif={openEditMotif}
                saveMotif={saveMotif} toggleMotifActive={toggleMotifActive} deleteMotif={deleteMotif}
                getPriceRangeLabel={(s: Service) => getPriceRangeLabel(s, t('proDash.onQuote'))} getPricingUnit={getPricingUnit} getCleanDescription={getCleanDescription}
                orgRole={orgRole}
              />
            )}
            </SectionErrorBoundary>
          )}

          {/* ────── MESSAGERIE V2 ────── */}
          {(activePage === 'messages' || activePage === 'comm_pro') && artisan && (
            <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
              {!isV5 && (
              <div className="v22-page-header" style={{ flexShrink: 0 }}>
                <div className="v22-page-title">💬 {t('proDash.modules.messaging')}</div>
                <div className="v22-page-sub">{t('proDash.messaging.subtitle')}</div>
              </div>
              )}
              <div style={{ flex: 1, minHeight: 0, padding: isV5 ? '0' : '12px' }}>
            <MessagerieArtisan
              artisan={artisan!}
              orgRole={orgRole}
              onConversationRead={refreshUnreadMsgCount}
              onProposerDevis={(missionData) => {
                // ── Matching intelligent : motif mission → service catalogue (prix) ──
                const motif = (missionData.description || missionData.titre || '').toLowerCase()
                const matchedService = services.find((s: Service) => {
                  const sName = (s.name || '').toLowerCase()
                  return motif.includes(sName) || sName.includes(motif) || motif.split(' ').some((w: string) => w.length > 3 && sName.includes(w))
                })

                // Extraire prix et unité du service trouvé dans le catalogue
                let linePrice = 0
                let lineUnit = 'forfait'
                if (matchedService) {
                  linePrice = matchedService.price_ttc || matchedService.price_ht || 0
                  const unitMatch = (matchedService.description || '').match(/\[unit:([^|]+)\|/)
                  if (unitMatch) {
                    const unitMap: Record<string, string> = { 'm2': 'm²', 'ml': 'ml', 'm3': 'm³', 'heure': 'h', 'forfait': 'forfait', 'unite': 'u', 'arbre': 'u', 'tonne': 'kg', 'kg': 'kg', 'lot': 'lot' }
                    lineUnit = unitMap[unitMatch[1]] || 'u'
                  }
                }

                // ── Matching client : chercher email/téléphone dans bookings existants ──
                const contactLower = (missionData.contactName || '').toLowerCase()
                const matchedBooking = contactLower.length > 2 ? bookings.find((b: Booking) => (b.notes || '').toLowerCase().includes(contactLower)) : null
                const clientEmail = matchedBooking?.client_email || ''
                const clientPhone = matchedBooking?.client_phone || ''

                // ── Pré-remplir le devis avec TOUTES les données de la mission ──
                setConvertingDevis({
                  docType: 'devis',
                  docTitle: matchedService?.name || missionData.titre || missionData.description || '',
                  clientName: missionData.contactName || '',
                  clientEmail,
                  clientPhone,
                  clientAddress: missionData.contactName || '',
                  interventionAddress: missionData.adresse || '',
                  prestationDate: missionData.date_souhaitee || '',
                  notes: `Mission : ${missionData.description || missionData.titre || ''}${missionData.adresse ? '\nLieu d\'intervention : ' + missionData.adresse : ''}${missionData.date_souhaitee ? '\nDate souhaitée : ' + new Date(missionData.date_souhaitee + 'T12:00:00').toLocaleDateString(dateFmtLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}`,
                  lines: [{
                    description: matchedService?.name || missionData.description || missionData.titre || '',
                    quantity: 1,
                    unit: lineUnit,
                    priceHT: linePrice,
                    tvaRate: 0,
                    totalHT: linePrice,
                  }],
                })
                setShowDevisForm(true)
                navigateTo('devis')
              }}
            />
              </div>
            </div>
          )}


          {/* ────── DEVIS ────── */}
          {activePage === 'devis' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro nos orçamentos' : 'Erreur dans les devis'}>
            <DevisSection
              artisan={artisan!} services={services} bookings={bookings}
              /* eslint-disable @typescript-eslint/no-explicit-any */
              savedDocuments={savedDocuments as any} setSavedDocuments={setSavedDocuments as any}
              showDevisForm={showDevisForm} setShowDevisForm={setShowDevisForm}
              convertingDevis={convertingDevis as any} setConvertingDevis={setConvertingDevis as any}
              convertDevisToFacture={handleConvertDevisToFacture as any}
              /* eslint-enable @typescript-eslint/no-explicit-any */
              orgRole={orgRole}
            />
            </SectionErrorBoundary>
          )}

          {/* ────── FACTURES ────── */}
          {activePage === 'factures' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro nas faturas' : 'Erreur dans les factures'}>
            <FacturesSection
              artisan={artisan!} services={services} bookings={bookings}
              /* eslint-disable @typescript-eslint/no-explicit-any */
              savedDocuments={savedDocuments as any} setSavedDocuments={setSavedDocuments as any}
              showFactureForm={showFactureForm} setShowFactureForm={setShowFactureForm}
              convertingDevis={convertingDevis as any} setConvertingDevis={setConvertingDevis as any}
              /* eslint-enable @typescript-eslint/no-explicit-any */
              orgRole={orgRole}
            />
            </SectionErrorBoundary>
          )}

          {/* ────── STATISTIQUES ────── */}
          {activePage === 'stats' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro nas estatísticas' : 'Erreur dans les statistiques'}>
            <StatsRevenusSection artisan={artisan!} bookings={bookings} services={services} pendingBookings={pendingBookings} completedBookings={completedBookings} totalRevenue={totalRevenue} activePage="stats" orgRole={orgRole} />
            </SectionErrorBoundary>
          )}

          {/* ────── REVENUS ────── */}
          {activePage === 'revenus' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro nas receitas' : 'Erreur dans les revenus'}>
            <StatsRevenusSection artisan={artisan!} bookings={bookings} services={services} pendingBookings={pendingBookings} completedBookings={completedBookings} totalRevenue={totalRevenue} activePage="revenus" orgRole={orgRole} />
            </SectionErrorBoundary>
          )}

          {/* ────── PARAMETRES ────── */}
          {activePage === 'settings' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro nas definições' : 'Erreur dans les paramètres'}>
            <SettingsSection
              artisan={artisan!}
              orgRole={orgRole}
              initials={initials}
              settingsForm={settingsForm}
              setSettingsForm={setSettingsForm}
              savingSettings={savingSettings}
              saveSettings={saveSettings}
              autoAccept={autoAccept}
              toggleAutoAccept={toggleAutoAccept}
              profilePhotoPreview={profilePhotoPreview}
              setProfilePhotoPreview={setProfilePhotoPreview}
              profilePhotoFile={profilePhotoFile}
              setProfilePhotoFile={setProfilePhotoFile}
              profilePhotoUploading={profilePhotoUploading}
              uploadDocument={uploadDocument}
              setProfilePhotoUploading={setProfilePhotoUploading}
              uploadMsg={uploadMsg}
              setUploadMsg={setUploadMsg}
            />
            </SectionErrorBoundary>
          )}

          {/* ────── MODULES ────── */}
          {activePage === 'modules' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro nos módulos' : 'Erreur dans les modules'}>
            <ModulesSection
              orgRole={orgRole}
              ALL_MODULES={ALL_MODULES}
              modulesConfig={modulesConfig}
              saveModulesConfig={saveModulesConfig}
              moveModule={moveModule}
              categoriesOrder={categoriesOrder}
              saveCategoriesOrder={saveCategoriesOrder}
              moveCategory={moveCategory}
              reorderModuleTo={reorderModuleTo}
              reorderCategoryTo={reorderCategoryTo}
              CATEGORIES_DEFAULT={CATEGORIES_DEFAULT}
              categories={moduleCategories}
              setCategories={setModuleCategories}
            />
            </SectionErrorBoundary>
          )}

          {/* ────── COMPTABILITÉ ────── */}
          {activePage === 'comptabilite' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro na contabilidade' : 'Erreur dans la comptabilité'}>
              <ComptabiliteSection
                bookings={bookings}
                artisan={artisan!}
                services={services}
                orgRole={orgRole}
              />
            </SectionErrorBoundary>
          )}

          {/* ────── MATÉRIAUX & PRIX ────── */}
          {activePage === 'materiaux' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro nos materiais' : 'Erreur dans les matériaux'}>
              <MateriauxSection
                artisan={artisan!}
                orgRole={orgRole}
                onExportDevis={(lines: DevisLine[]) => {
                  setConvertingDevis({ docType: 'devis', lines })
                  setShowDevisForm(true)
                  navigateTo('devis')
                }}
              />
            </SectionErrorBoundary>
          )}



          {/* ────── BOURSE AUX MARCHÉS ────── */}
          {activePage === 'marches' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro na bolsa de mercados' : 'Erreur dans la bourse aux marchés'}>
              <BourseAuxMarchesSection artisan={artisan!} orgRole={orgRole} navigateTo={navigateTo} />
            </SectionErrorBoundary>
          )}

          {/* ────── MARKETPLACE PRO BTP ────── */}
          {activePage === 'marketplace_btp' && artisan && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro no Marketplace BTP' : 'Erreur dans le Marketplace BTP'}>
              <MarketplaceProBTPSection artisan={artisan!} orgRole={orgRole} />
            </SectionErrorBoundary>
          )}

          {/* ────── DEVIS PRO BTP ────── */}
          {activePage === 'rfq_btp' && orgRole === 'pro_societe' && artisan && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro nos orçamentos' : 'Erreur dans les devis pro'}>
              <RFQSection artisan={artisan!} orgRole={orgRole} />
            </SectionErrorBoundary>
          )}

          {/* ────── WALLET CONFORMITÉ ────── */}
          {activePage === 'wallet' && (
            <div className="animate-fadeIn">
              <WalletConformiteSection artisan={artisan!} orgRole={orgRole} />
            </div>
          )}

          {/* ────── CARNET DE VISITE / PORTFOLIO ────── */}
          {activePage === 'portfolio' && (
            <div className="animate-fadeIn">
              <CarnetDeVisiteSection artisan={artisan!} orgRole={orgRole} />
            </div>
          )}

          {/* ────── BASE CLIENTS ────── */}
          {activePage === 'clients' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro na secção de clientes' : 'Erreur dans la section clients'}>
              <ClientsSection
                artisan={artisan!}
                bookings={bookings}
                services={services}
                orgRole={orgRole}
                onNewRdv={(clientName: string) => {
                  setNewRdv({ client_name: clientName, service_id: '', date: '', time: '', address: '', notes: '', phone: '', duration: '' })
                  setShowNewRdv(true)
                  navigateTo('calendar')
                }}
                onNewDevis={(clientName: string) => {
                  setConvertingDevis({ client_name: clientName, docType: 'devis' })
                  setShowDevisForm(true)
                  navigateTo('devis')
                }}
              />
            </SectionErrorBoundary>
          )}

          {/* ────── ÉQUIPES (Société BTP) ────── */}
          {activePage === 'equipes' && (
            <EquipesBTPV2 artisan={artisan!} orgRole={orgRole} />
          )}

          {/* ────── CHANTIERS V2 (Société BTP) — Supabase + GPS ────── */}
          {activePage === 'chantiers' && (
            <ChantiersBTPV2 artisan={artisan!} orgRole={orgRole} />
          )}

          {/* ────── GANTT (Société BTP) ────── */}
          {activePage === 'gantt' && (
            <div className="p-4 lg:p-5 animate-fadeIn">
              <GanttSection userId={artisan?.id || ''} orgRole={orgRole} />
            </div>
          )}

          {/* ────── SITUATIONS DE TRAVAUX (Société BTP) ────── */}
          {activePage === 'situations' && (
            <div className="p-4 lg:p-5 animate-fadeIn">
              <SituationsTravaux userId={artisan?.id || ''} orgRole={orgRole} />
            </div>
          )}

          {/* ────── RETENUES DE GARANTIE (Société BTP) ────── */}
          {activePage === 'garanties' && (
            <div className="p-4 lg:p-5 animate-fadeIn">
              <RetenuesGarantieSection userId={artisan?.id || ''} orgRole={orgRole} />
            </div>
          )}

          {/* ────── POINTAGE GÉO V2 (Société BTP) — GPS + Manuel ────── */}
          {activePage === 'pointage' && (
            <div className="p-4 lg:p-5 animate-fadeIn">
              <PointageGeoSection artisan={artisan!} orgRole={orgRole} />
            </div>
          )}

          {/* ────── SOUS-TRAITANCE DC4 (Société BTP) ────── */}
          {activePage === 'sous_traitance' && (
            <div className="p-4 lg:p-5 animate-fadeIn">
              <SousTraitanceDC4Section userId={artisan?.id || ''} orgRole={orgRole} />
            </div>
          )}

          {/* ────── RENTABILITÉ CHANTIER (Société BTP) ────── */}
          {activePage === 'rentabilite' && (
            <div className="p-4 lg:p-5 animate-fadeIn">
              <RentabiliteChantierSection artisan={artisan!} orgRole={orgRole} />
            </div>
          )}

          {/* ────── COMPTA INTELLIGENTE BTP ────── */}
          {activePage === 'compta_btp' && (
            <div className="p-4 lg:p-5 animate-fadeIn">
              <ComptaBTPSection artisan={artisan!} orgRole={orgRole} />
            </div>
          )}

          {/* ────── RECRUTEMENT SOUS-TRAITANTS (Société BTP) ────── */}
          {activePage === 'sous_traitance_offres' && (
            <div className="p-4 lg:p-5 animate-fadeIn">
              <SousTraitanceOffresSection artisan={artisan!} orgRole={orgRole} />
            </div>
          )}

          {/* ────── DPGF APPELS D'OFFRES (Société BTP) ────── */}
          {activePage === 'dpgf' && (
            <div className="p-4 lg:p-5 animate-fadeIn">
              <DPGFSection userId={artisan?.id || ''} orgRole={orgRole} />
            </div>
          )}

          {/* ────── PROPRIÉTÉS (Conciergerie) ────── */}
          {activePage === 'proprietes' && (
            <SectionErrorBoundary fallbackTitle="Erreur dans les propriétés">
            <ProprietesConciergerieSection artisan={artisan!} />
            </SectionErrorBoundary>
          )}

          {/* ────── ACCÈS & CLÉS (Conciergerie) ────── */}
          {activePage === 'acces' && (
            <SectionErrorBoundary fallbackTitle="Erreur dans les accès">
            <AccesConciergerieSection artisan={artisan!} />
            </SectionErrorBoundary>
          )}

          {/* ────── CHANNEL MANAGER (Conciergerie) ────── */}
          {activePage === 'channel_manager' && (
            <SectionErrorBoundary fallbackTitle="Erreur dans le channel manager">
            <div className="p-4 lg:p-5 animate-fadeIn">
              <ChannelManagerSection userId={artisan?.id || ''} />
            </div>
            </SectionErrorBoundary>
          )}

          {/* ────── TARIFICATION (Conciergerie) ────── */}
          {activePage === 'tarification' && (
            <SectionErrorBoundary fallbackTitle="Erreur dans la tarification">
            <div className="p-4 lg:p-5 animate-fadeIn">
              <TarificationSection userId={artisan?.id || ''} />
            </div>
            </SectionErrorBoundary>
          )}

          {/* ────── CHECK-IN / CHECK-OUT (Conciergerie) ────── */}
          {activePage === 'checkinout' && (
            <SectionErrorBoundary fallbackTitle="Erreur dans le check-in/out">
            <div className="p-4 lg:p-5 animate-fadeIn">
              <CheckinOutSection userId={artisan?.id || ''} />
            </div>
            </SectionErrorBoundary>
          )}

          {/* ────── LIVRET D'ACCUEIL (Conciergerie) ────── */}
          {activePage === 'livret' && (
            <SectionErrorBoundary fallbackTitle="Erreur dans le livret d'accueil">
            <div className="p-4 lg:p-5 animate-fadeIn">
              <LivretAccueilSection userId={artisan?.id || ''} />
            </div>
            </SectionErrorBoundary>
          )}

          {/* ────── PLANNING MÉNAGE (Conciergerie) ────── */}
          {activePage === 'menage' && (
            <SectionErrorBoundary fallbackTitle="Erreur dans le planning ménage">
            <div className="p-4 lg:p-5 animate-fadeIn">
              <PlanningMenageSection userId={artisan?.id || ''} />
            </div>
            </SectionErrorBoundary>
          )}

          {/* ────── REVPAR (Conciergerie) ────── */}
          {activePage === 'revpar' && (
            <SectionErrorBoundary fallbackTitle="Erreur dans le RevPAR">
            <div className="p-4 lg:p-5 animate-fadeIn">
              <RevPARSection userId={artisan?.id || ''} />
            </div>
            </SectionErrorBoundary>
          )}

          {/* ────── IMMEUBLES (Gestionnaire) ────── */}
          {activePage === 'immeubles' && (
            <SectionErrorBoundary fallbackTitle="Erreur dans les immeubles">
            <ImmeublesGestionnaireSection artisan={artisan!} />
            </SectionErrorBoundary>
          )}

          {/* ────── ORDRES DE MISSION (Gestionnaire) ────── */}
          {activePage === 'missions' && (
            <SectionErrorBoundary fallbackTitle="Erreur dans les missions">
            <MissionsGestionnaireSection artisan={artisan!} bookings={bookings} />
            </SectionErrorBoundary>
          )}

          {/* ────── CONTRATS ────── */}
          {activePage === 'contrats' && (
            <SectionErrorBoundary fallbackTitle="Erreur dans les contrats">
            <ContratsSection artisan={artisan!} />
            </SectionErrorBoundary>
          )}

          {/* ────── RAPPORTS D'INTERVENTION ────── */}
          {activePage === 'rapports' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro nos relatórios' : 'Erreur dans les rapports'}>
              <RapportsSection artisan={artisan!} bookings={bookings} services={services} onNavigate={navigateTo} orgRole={orgRole} />
            </SectionErrorBoundary>
          )}

          {/* ────── PHOTOS CHANTIER ────── */}
          {activePage === 'photos_chantier' && (
            <PhotosChantierSection artisan={artisan!} bookings={bookings} orgRole={orgRole} />
          )}

          {/* ────── CHANTIERS V22 (Artisan) ────── */}
          {activePage === 'chantiers_v22' && (
            <SectionErrorBoundary fallbackTitle="Erreur dans les chantiers">
              <ChantiersV22Section artisan={artisan!} navigateTo={navigateTo} orgRole={orgRole} />
            </SectionErrorBoundary>
          )}

          {/* ────── PIPELINE KANBAN ────── */}
          {activePage === 'pipeline' && (
            <SectionErrorBoundary fallbackTitle="Erreur dans le pipeline">
              <PipelineSection artisan={artisan!} orgRole={orgRole} navigateTo={navigateTo} />
            </SectionErrorBoundary>
          )}

          {/* ────── BIBLIOTHÈQUE D'OUVRAGES ────── */}
          {/* pro_societe : la bibliothèque est fusionnée dans Prestations (PrestationsBTPSection) */}
          {activePage === 'bibliotheque' && (
            <SectionErrorBoundary fallbackTitle="Erreur dans la bibliothèque">
              {orgRole === 'pro_societe' ? (
                <PrestationsBTPSection artisan={artisan!} orgRole={orgRole} navigateTo={navigateTo} />
              ) : (
                <BibliothequeSection artisan={artisan!} orgRole={orgRole} navigateTo={navigateTo} />
              )}
            </SectionErrorBoundary>
          )}

          {/* ────── PARRAINAGE ────── */}
          {activePage === 'parrainage' && (
            <SectionErrorBoundary fallbackTitle="Erreur dans le module parrainage">
              <ParrainageSection artisan={artisan!} orgRole={orgRole} />
            </SectionErrorBoundary>
          )}

          {/* ────── CANAL PRO ────── */}
          {activePage === 'canal' && (
            <CanalProSection artisan={artisan!} orgRole={orgRole} />
          )}

          {/* ────── GESTION COMPTES (Société BTP — gérant ou permission accordée) ────── */}
          {activePage === 'gestion_comptes' && orgRole === 'pro_societe' && (isProGerant || proCanAccess('gestion_comptes')) && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro na gestão de contas' : 'Erreur dans la gestion des comptes'}>
              <CompteUtilisateursSection artisan={artisan!} isGerant={isProGerant} />
            </SectionErrorBoundary>
          )}

          {/* ────── METEO CHANTIERS (pro_societe v5) ────── */}
          {activePage === 'meteo' && isV5 && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro na meteorologia' : 'Erreur météo'}>
              <MeteoChantierSection userId={artisan?.id || ''} authUserId={artisan?.user_id || ''} isPt={isPt} />
            </SectionErrorBoundary>
          )}

          {/* ────── PORTAIL CLIENT (pro_societe v5) ────── */}
          {activePage === 'portail_client' && isV5 && (
            <SectionErrorBoundary fallbackTitle="Erreur dans le portail client">
              <PortailClientSection userId={artisan?.user_id || artisan?.id || ''} artisanId={artisan?.id || ''} orgRole={orgRole} />
            </SectionErrorBoundary>
          )}

          {/* ────── AIDE ────── */}
          {activePage === 'help' && (
            <AideSection navigateTo={navigateTo} orgRole={orgRole} />
          )}

      </main>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease;
        }
      `}</style>

      {/* AI ChatBot */}
      {artisan && (
        <AiChatBot
          artisan={artisan!}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          bookings={bookings as any}
          services={services}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          availability={availability as any}
          dayServices={dayServices}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          absences={absences as any}
          onCreateRdv={async (data) => {
            const service = data.service_id ? services.find((s: Service) => s.id === data.service_id) : services[0]
            const status = autoAccept ? 'confirmed' : 'pending'
            const { data: newBooking, error } = await supabase.from('bookings').insert({
              artisan_id: artisan.id,
              service_id: service?.id || services[0]?.id,
              status,
              booking_date: data.date,
              booking_time: data.time,
              duration_minutes: service?.duration_minutes || 60,
              address: data.address || 'A definir',
              notes: data.client_name ? `Client: ${data.client_name}. ${data.notes || ''}` : data.notes || '',
              price_ht: service?.price_ht || 0,
              price_ttc: service?.price_ttc || 0,
            }).select('*, services(name)').single()
            if (!error && newBooking) {
              setBookings(prev => [newBooking, ...prev])
            }
          }}
          onCreateDevis={(data) => {
            setConvertingDevis(data)
            if (data.docType === 'facture') {
              setShowFactureForm(true)
              navigateTo('factures')
            } else {
              setShowDevisForm(true)
              navigateTo('devis')
            }
          }}
          onNavigate={navigateTo}
          onDataRefresh={async () => {
            // Refresh all data after Fixy executes server-side actions
            const [availRes, svcRes, bkRes, dsRes, absRes] = await Promise.all([
              fetch(`/api/availability?artisan_id=${artisan.id}`),
              supabase.from('services').select('*').eq('artisan_id', artisan.id).order('created_at'),
              supabase.from('bookings').select('*, services(name)').eq('artisan_id', artisan.id).order('booking_date', { ascending: false }).limit(50),
              fetch(`/api/availability-services?artisan_id=${artisan.id}`),
              fetch(`/api/artisan-absences?artisan_id=${artisan.id}`),
            ])
            const availJson = await availRes.json()
            setAvailability(availJson.data || [])
            if (svcRes.data) setServices(svcRes.data)
            if (bkRes.data) setBookings(bkRes.data)
            try {
              const dsJson = await dsRes.json()
              if (dsJson.dayServices) setDayServices(dsJson.dayServices)
            } catch { toast.error('Erreur lors du chargement des disponibilités') }
            try {
              const absJson = await absRes.json()
              if (absJson.data) setAbsences(absJson.data)
            } catch { toast.error('Erreur lors du chargement des absences') }
          }}
        />
      )}

      {/* ── Fullscreen Image Viewer (artisan) ── */}
      {dashMsgFullscreenImg && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setDashMsgFullscreenImg(null)}>
          <Image src={dashMsgFullscreenImg} alt="Photo" width={1200} height={800} className="max-w-full max-h-full object-contain rounded-lg" sizes="100vw" />
          <button onClick={() => setDashMsgFullscreenImg(null)} className="absolute top-4 right-4 text-white text-base bg-black/50 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
        </div>
      )}

      {/* ── Modal Messagerie Artisan Dashboard ── */}
      {dashMsgModal && (
        <div className="v22-modal-overlay" onClick={() => setDashMsgModal(null)}>
          <div className="v22-modal" style={{ width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="v22-modal-head">
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>💬 {t('proDash.msg.title')}</div>
                <div className="v22-ref" style={{ marginTop: 2 }}>{dashMsgModal.services?.name || 'Service'} · {dashMsgModal.booking_date} à {dashMsgModal.booking_time?.substring(0, 5)}</div>
              </div>
              <button onClick={() => setDashMsgModal(null)} className="v22-btn v22-btn-sm">✕</button>
            </div>
            <div className="v22-modal-body" style={{ flex: 1, overflowY: 'auto', minHeight: 200, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dashMsgList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 14px', fontSize: 12, color: 'var(--v22-text-muted)' }}>
                  {t('proDash.msg.noMessages')}
                </div>
              ) : (
                dashMsgList.map((msg: ChatMessage) => {
                  const isMe = msg.sender_role === 'artisan'
                  const time = new Date(msg.created_at || '').toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' })

                  // ── Photo message ──
                  if (msg.type === 'photo' && msg.attachment_url) {
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div style={{ maxWidth: '75%', borderRadius: 4, padding: 6, background: isMe ? 'var(--v22-yellow-light)' : 'var(--v22-bg)', border: `1px solid ${isMe ? 'var(--v22-yellow-border)' : 'var(--v22-border)'}` }}>
                          {!isMe && <div className="text-xs font-semibold text-gray-500 px-2 mb-1">{msg.sender_name || 'Client'}</div>}
                          <img
                            src={msg.attachment_url}
                            alt="Photo"
                            className="rounded-md max-w-[220px] max-h-[220px] object-cover cursor-pointer"
                            onClick={() => setDashMsgFullscreenImg(msg.attachment_url ?? null)}
                          />
                          {msg.content && <p className="text-xs mt-1 px-2">{msg.content}</p>}
                          <p className={`text-[10px] px-2 mt-0.5 ${isMe ? 'text-gray-700' : 'text-gray-500'}`}>{time}</p>
                        </div>
                      </div>
                    )
                  }

                  // ── Voice message ──
                  if (msg.type === 'voice' && msg.attachment_url) {
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div style={{ maxWidth: '75%', borderRadius: 4, padding: '8px 12px', background: isMe ? 'var(--v22-yellow-light)' : 'var(--v22-bg)', border: `1px solid ${isMe ? 'var(--v22-yellow-border)' : 'var(--v22-border)'}` }}>
                          {!isMe && <div className="text-xs font-semibold text-gray-500 mb-1">{msg.sender_name || 'Client'}</div>}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">🎤</span>
                            <span className="text-xs font-medium">{t('proDash.msg.voiceMessage')}</span>
                          </div>
                          <audio controls src={msg.attachment_url} className="max-w-[200px] h-8" style={{ filter: 'sepia(20%) saturate(70%) grayscale(1) contrast(99%) invert(12%)' }} />
                          <p className={`text-[10px] mt-1 ${isMe ? 'text-gray-700' : 'text-gray-500'}`}>{time}</p>
                        </div>
                      </div>
                    )
                  }

                  // ── Devis sent (côté artisan = carte informative) ──
                  if (msg.type === 'devis_sent' && msg.metadata) {
                    const m = msg.metadata as { signed?: boolean; docNumber?: string; totalStr?: string; docTitle?: string; signer_name?: string }
                    const isSigned = m.signed === true
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-md border overflow-hidden ${isSigned ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
                          <div className="px-3 py-2.5">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm">{isSigned ? '✅' : '📄'}</span>
                              <span className="font-semibold text-xs text-gray-900">{isSigned ? t('proDash.msg.quotesSigned') : t('proDash.msg.quotesSent')}</span>
                            </div>
                            <p className="text-xs text-gray-700">N°{m.docNumber} — {m.totalStr}</p>
                            {m.docTitle && <p className="text-xs text-gray-600 mt-0.5">{m.docTitle}</p>}
                            {!isSigned && <p className="text-xs text-amber-600 mt-1 italic">⏳ {t('proDash.msg.awaitingSignature')}</p>}
                            {isSigned && <p className="text-xs text-green-700 mt-1 font-semibold">✅ Signé par {m.signer_name || 'le client'}</p>}
                          </div>
                          <p className="text-[10px] text-gray-500 px-4 pb-2">{time}</p>
                        </div>
                      </div>
                    )
                  }

                  // ── Devis signed (artisan voit avec bouton bloquer agenda) ──
                  if (msg.type === 'devis_signed' && msg.metadata) {
                    const m = msg.metadata as { docNumber?: string; totalStr?: string; signer_name?: string; signed_at?: string; prestationDate?: string }
                    return (
                      <div key={msg.id} className="flex justify-start">
                        <div className="max-w-[85%] rounded-md border border-green-400 bg-green-50 overflow-hidden">
                          <div className="px-3 py-2.5">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm">✅</span>
                              <span className="font-semibold text-xs text-green-800">{t('proDash.msg.clientSigned')}</span>
                            </div>
                            <p className="text-xs text-green-700">N°{m.docNumber} — {m.totalStr}</p>
                            {m.signer_name && <p className="text-xs text-green-600 mt-0.5">Signé par {m.signer_name}</p>}
                            {m.signed_at && <p className="text-xs text-green-600">le {new Date(m.signed_at).toLocaleDateString(dateFmtLocale)} à {new Date(m.signed_at).toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' })}</p>}
                          </div>
                          {m.prestationDate && (
                            <div className="border-t border-green-200 px-3 py-2">
                              <button
                                onClick={() => handleBlockAgendaFromDevis(msg)}
                                disabled={dashMsgBlockingAgenda === msg.id}
                                className="w-full py-1.5 rounded bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                              >
                                {dashMsgBlockingAgenda === msg.id ? (
                                  <><span className="animate-spin">⏳</span> {t('proDash.msg.blocking')}</>
                                ) : (
                                  <><span>📅</span> {t('proDash.msg.blockCalendar')}</>
                                )}
                              </button>
                            </div>
                          )}
                          <p className="text-[10px] text-gray-500 px-4 pb-2">{time}</p>
                        </div>
                      </div>
                    )
                  }

                  // ── Default text / auto_reply ──
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div style={{
                        maxWidth: '75%', borderRadius: 4, padding: '8px 14px',
                        background: isMe ? 'var(--v22-yellow-light)' : msg.type === 'auto_reply' ? '#E8F0FE' : 'var(--v22-bg)',
                        border: `1px solid ${isMe ? 'var(--v22-yellow-border)' : msg.type === 'auto_reply' ? '#B3D4FC' : 'var(--v22-border)'}`,
                        color: 'var(--v22-text)'
                      }}>
                        {msg.type === 'auto_reply' && <div className="text-[10px] font-semibold opacity-70 mb-1">{t('proDash.msg.autoReply')}</div>}
                        {!isMe && msg.sender_role === 'client' && <div className="text-xs font-semibold text-gray-500 mb-1">{msg.sender_name || 'Client'}</div>}
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? 'text-gray-700' : 'text-gray-500'}`}>{time}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* ── Input bar with photo & voice (artisan) ── */}
            <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex-shrink-0">
              {dashMsgUploading && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg mb-2">
                  <span className="animate-spin">⏳</span> {t('proDash.msg.sending')}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                {/* Photo button */}
                <label className="cursor-pointer p-2 rounded-lg hover:bg-gray-100 transition text-gray-500 hover:text-gray-700 flex-shrink-0">
                  <span className="text-lg">📷</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) sendDashPhotoMessage(f)
                      e.target.value = ''
                    }}
                  />
                </label>
                {/* Voice button */}
                <button
                  onMouseDown={startDashVoiceRecording}
                  onMouseUp={stopDashVoiceRecording}
                  onMouseLeave={() => { if (dashMsgRecording) stopDashVoiceRecording() }}
                  onTouchStart={startDashVoiceRecording}
                  onTouchEnd={stopDashVoiceRecording}
                  className={`p-2 rounded-lg transition flex-shrink-0 ${dashMsgRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
                  title={t('proDash.msg.holdToRecord')}
                >
                  <span className="text-lg">{dashMsgRecording ? '⏹️' : '🎤'}</span>
                </button>
                {/* Text input */}
                <input
                  type="text"
                  value={dashMsgText}
                  onChange={e => setDashMsgText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendDashMessage()}
                  placeholder={dashMsgRecording ? `🔴 ${t('proDash.msg.recording')}` : t('proDash.msg.placeholder')}
                  aria-label="Écrire un message"
                  disabled={dashMsgRecording}
                  className="flex-1 border border-[#E0E0E0] rounded px-3 py-2 text-xs focus:outline-none focus:border-[#FFC107] disabled:bg-gray-50"
                />
                {/* Send button */}
                <button
                  onClick={sendDashMessage}
                  disabled={dashMsgSending || !dashMsgText.trim() || dashMsgRecording}
                  className="v22-btn v22-btn-primary" style={{ flexShrink: 0 }}
                >
                  {t('common.send')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ SUB-COMPONENTS ══════════ */

function V22SidebarItem({ label, active, badge, badgeRed, onClick }: {
  label: string; active?: boolean; badge?: number; badgeRed?: boolean; onClick: () => void
}) {
  return (
    <div onClick={onClick} className={`v22-sidebar-item ${active ? 'active' : ''}`}>
      <div className="v22-sidebar-dot" />
      <span>{label}</span>
      {badge && badge > 0 && (
        <span className={`v22-badge-count ${badgeRed ? 'red' : ''}`}>{badge}</span>
      )}
    </div>
  )
}


