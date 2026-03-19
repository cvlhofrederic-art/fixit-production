'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { POLL_NOTIFICATIONS, POLL_MISSIONS, TOAST_LONG, TOAST_DEFAULT } from '@/lib/constants'
import { useTranslation } from '@/lib/i18n/context'
import AiChatBot from '@/components/chat/AiChatBot'
import { DashboardSkeleton } from '@/components/dashboard'
import ComptabiliteSection from '@/components/dashboard/ComptabiliteSection'
import ClientsSection from '@/components/dashboard/ClientsSection'
import MateriauxSection from '@/components/dashboard/MateriauxSection'
import RapportsSection from '@/components/dashboard/RapportsSection'
import CanalProSection from '@/components/dashboard/CanalProSection'
import MessagerieArtisan from '@/components/dashboard/MessagerieArtisan'
import { SectionErrorBoundary } from '@/components/common/SectionErrorBoundary'

const HomeSection = dynamic(() => import('@/components/dashboard/HomeSection'), { ssr: false })
const CalendarSection = dynamic(() => import('@/components/dashboard/CalendarSection'), { ssr: false })
const HorairesSection = dynamic(() => import('@/components/dashboard/HorairesSection'), { ssr: false })
const MotifsSection = dynamic(() => import('@/components/dashboard/MotifsSection'), { ssr: false })
const DevisSection = dynamic(() => import('@/components/dashboard/DevisSection'), { ssr: false })
const FacturesSection = dynamic(() => import('@/components/dashboard/FacturesSection'), { ssr: false })
const StatsRevenusSection = dynamic(() => import('@/components/dashboard/StatsRevenusSection'), { ssr: false })
const SettingsSection = dynamic(() => import('@/components/dashboard/SettingsSection'), { ssr: false })

const WalletConformiteSection = dynamic(() => import('@/components/dashboard/WalletConformiteSection'), { ssr: false })
const CarnetDeVisiteSection = dynamic(() => import('@/components/dashboard/CarnetDeVisiteSection'), { ssr: false })
const PhotosChantierSection = dynamic(() => import('@/components/dashboard/PhotosChantierSection'), { ssr: false })
const BourseAuxMarchesSection = dynamic(() => import('@/components/marches/BourseAuxMarchesSection'), { ssr: false })

// BTP sections
const EquipesBTPSection = dynamic(() => import('@/components/dashboard/BTPSections').then(mod => mod.EquipesBTPSection), { ssr: false })
const ChantiersBTPSection = dynamic(() => import('@/components/dashboard/BTPSections').then(mod => mod.ChantiersBTPSection), { ssr: false })
const GanttSection = dynamic(() => import('@/components/dashboard/BTPSections').then(mod => mod.GanttSection), { ssr: false })
const SituationsTravaux = dynamic(() => import('@/components/dashboard/BTPSections').then(mod => mod.SituationsTravaux), { ssr: false })
const RetenuesGarantieSection = dynamic(() => import('@/components/dashboard/BTPSections').then(mod => mod.RetenuesGarantieSection), { ssr: false })
const PointageEquipesSection = dynamic(() => import('@/components/dashboard/BTPSections').then(mod => mod.PointageEquipesSection), { ssr: false })
const SousTraitanceDC4Section = dynamic(() => import('@/components/dashboard/BTPSections').then(mod => mod.SousTraitanceDC4Section), { ssr: false })
const DPGFSection = dynamic(() => import('@/components/dashboard/BTPSections').then(mod => mod.DPGFSection), { ssr: false })

// Conciergerie sections
const ProprietesConciergerieSection = dynamic(() => import('@/components/dashboard/ConciergerieSections').then(mod => mod.ProprietesConciergerieSection), { ssr: false })
const AccesConciergerieSection = dynamic(() => import('@/components/dashboard/ConciergerieSections').then(mod => mod.AccesConciergerieSection), { ssr: false })
const ChannelManagerSection = dynamic(() => import('@/components/dashboard/ConciergerieSections').then(mod => mod.ChannelManagerSection), { ssr: false })
const TarificationSection = dynamic(() => import('@/components/dashboard/ConciergerieSections').then(mod => mod.TarificationSection), { ssr: false })
const CheckinOutSection = dynamic(() => import('@/components/dashboard/ConciergerieSections').then(mod => mod.CheckinOutSection), { ssr: false })
const LivretAccueilSection = dynamic(() => import('@/components/dashboard/ConciergerieSections').then(mod => mod.LivretAccueilSection), { ssr: false })
const PlanningMenageSection = dynamic(() => import('@/components/dashboard/ConciergerieSections').then(mod => mod.PlanningMenageSection), { ssr: false })
const RevPARSection = dynamic(() => import('@/components/dashboard/ConciergerieSections').then(mod => mod.RevPARSection), { ssr: false })

// Gestionnaire sections
const ImmeublesGestionnaireSection = dynamic(() => import('@/components/dashboard/GestionnaireSections').then(mod => mod.ImmeublesGestionnaireSection), { ssr: false })
const MissionsGestionnaireSection = dynamic(() => import('@/components/dashboard/GestionnaireSections').then(mod => mod.MissionsGestionnaireSection), { ssr: false })
const ContratsSection = dynamic(() => import('@/components/dashboard/GestionnaireSections').then(mod => mod.ContratsSection), { ssr: false })


export default function DashboardPage() {
  const router = useRouter()
  const { t, locale } = useTranslation()
  const isPt = locale === 'pt'
  const [artisan, setArtisan] = useState<any>(null)
  const [orgRole, setOrgRole] = useState<'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'>('artisan')
  const [bookings, setBookings] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activePage, setActivePage] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showDevisForm, setShowDevisForm] = useState(false)
  const [showAdminBtn, setShowAdminBtn] = useState(false)
  const [showFactureForm, setShowFactureForm] = useState(false)
  const [savedDocuments, setSavedDocuments] = useState<any[]>([])
  const [availability, setAvailability] = useState<any[]>([])
  const [autoAccept, setAutoAccept] = useState(false)
  const [showNewRdv, setShowNewRdv] = useState(false)
  const [newRdv, setNewRdv] = useState({ client_name: '', service_id: '', date: '', time: '', address: '', notes: '', phone: '', duration: '' })
  // ── Absences ──
  const [absences, setAbsences] = useState<any[]>([])
  const [showAbsenceModal, setShowAbsenceModal] = useState(false)
  const [newAbsence, setNewAbsence] = useState({ start_date: '', end_date: '', reason: isPt ? 'Férias' : 'Vacances', label: '' })
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [showBookingDetail, setShowBookingDetail] = useState(false)
  const [convertingDevis, setConvertingDevis] = useState<any>(null)
  const [savingAvail, setSavingAvail] = useState(false)
  // ── Notifications temps réel ──
  const [notifications, setNotifications] = useState<any[]>([])
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const [unreadMsgCount, setUnreadMsgCount] = useState(0)

  // ── Messagerie artisan dashboard ──
  const [dashMsgModal, setDashMsgModal] = useState<any>(null)
  const [dashMsgList, setDashMsgList] = useState<any[]>([])
  const [dashMsgText, setDashMsgText] = useState('')
  const [dashMsgSending, setDashMsgSending] = useState(false)
  // ── Messagerie enrichie artisan ──
  const [dashMsgUploading, setDashMsgUploading] = useState(false)
  const [dashMsgRecording, setDashMsgRecording] = useState(false)
  const [dashMsgRecorderRef, setDashMsgRecorderRef] = useState<MediaRecorder | null>(null)
  const [dashMsgFullscreenImg, setDashMsgFullscreenImg] = useState<string | null>(null)
  const [dashMsgBlockingAgenda, setDashMsgBlockingAgenda] = useState<string | null>(null) // message_id
  const [dayServices, setDayServices] = useState<Record<string, string[]>>({})
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('week')
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(now.setDate(diff)).toISOString().split('T')[0]
  })
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Motifs state
  const [showMotifModal, setShowMotifModal] = useState(false)
  const [editingMotif, setEditingMotif] = useState<any>(null)
  const [motifForm, setMotifForm] = useState<{
    name: string; description: string; duration_minutes: number | ''; price_min: number | ''; price_max: number | ''; pricing_unit: string
  }>({
    name: '', description: '', duration_minutes: '', price_min: '', price_max: '', pricing_unit: 'forfait'
  })
  const [savingMotif, setSavingMotif] = useState(false)

  // Settings state
  const [settingsForm, setSettingsForm] = useState({ company_name: '', email: '', phone: '', bio: '', auto_reply_message: '', auto_block_duration_minutes: 240, zone_radius_km: 30 })
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'profil' | 'modules'>('profil')

  // ── Modules config (toggle + order) — memoized pour éviter recréation à chaque render ──
  const ALL_MODULES = useMemo(() => [
    { id: 'home', icon: '🏠', label: t('proDash.modules.home'), description: t('proDash.modules.homeDesc'), category: t('proDash.categories.activity'), locked: true },
    { id: 'calendar', icon: '📅', label: t('proDash.modules.calendar'), description: t('proDash.modules.calendarDesc'), category: t('proDash.categories.activity') },
    { id: 'motifs', icon: '🔧', label: t('proDash.modules.motifs'), description: t('proDash.modules.motifsDesc'), category: t('proDash.categories.activity') },
    { id: 'horaires', icon: '🕐', label: t('proDash.modules.hours'), description: t('proDash.modules.hoursDesc'), category: t('proDash.categories.activity') },
    { id: 'messages', icon: '💬', label: t('proDash.modules.messaging'), description: t('proDash.modules.messagingDesc'), category: t('proDash.categories.communication') },
    { id: 'clients', icon: '👥', label: t('proDash.modules.clients'), description: t('proDash.modules.clientsDesc'), category: t('proDash.categories.communication') },
    { id: 'devis', icon: '📄', label: t('proDash.modules.quotes'), description: t('proDash.modules.quotesDesc'), category: t('proDash.categories.billing') },
    { id: 'factures', icon: '🧾', label: t('proDash.modules.invoices'), description: t('proDash.modules.invoicesDesc'), category: t('proDash.categories.billing') },
    { id: 'rapports', icon: '📋', label: t('proDash.modules.reports'), description: t('proDash.modules.reportsDesc'), category: t('proDash.categories.billing') },
    { id: 'contrats', icon: '📑', label: t('proDash.modules.contracts'), description: t('proDash.modules.contractsDesc'), category: t('proDash.categories.billing') },
    { id: 'stats', icon: '📊', label: t('proDash.modules.stats'), description: t('proDash.modules.statsDesc'), category: t('proDash.categories.analysis') },
    { id: 'revenus', icon: '💰', label: t('proDash.modules.revenue'), description: t('proDash.modules.revenueDesc'), category: t('proDash.categories.analysis') },
    { id: 'comptabilite', icon: '🧮', label: t('proDash.modules.accounting'), description: t('proDash.modules.accountingDesc'), category: t('proDash.categories.analysis') },
    { id: 'materiaux', icon: '🛒', label: t('proDash.modules.materials'), description: t('proDash.modules.materialsDesc'), category: t('proDash.categories.analysis') },
    { id: 'marches', icon: '🏛️', label: t('proDash.modules.marches') || 'Bourse aux Marchés', description: t('proDash.modules.marchesDesc') || 'Appels d\'offres et candidatures', category: t('proDash.categories.activity') },
    { id: 'wallet', icon: '🗂️', label: t('proDash.modules.wallet'), description: t('proDash.modules.walletDesc'), category: t('proDash.categories.proProfil') },
    { id: 'portfolio', icon: '📸', label: t('proDash.modules.portfolio'), description: t('proDash.modules.portfolioDesc'), category: t('proDash.categories.proProfil') },
    { id: 'settings', icon: '⚙️', label: t('proDash.modules.settings'), description: t('proDash.modules.settingsDesc'), category: t('proDash.categories.account'), locked: true },
  ], [t])

  const MODULES_STORAGE_KEY = useMemo(() => `fixit_modules_config_${artisan?.id || 'default'}`, [artisan?.id])

  const [modulesConfig, setModulesConfig] = useState<{ id: string; enabled: boolean; order: number }[]>([])

  // Load modules config from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = JSON.parse(localStorage.getItem(MODULES_STORAGE_KEY) || '[]')
      if (saved.length > 0) {
        // Merge saved config with ALL_MODULES (in case new modules were added)
        const merged = ALL_MODULES.map(m => {
          const s = saved.find((x: any) => x.id === m.id)
          return s ? { id: m.id, enabled: m.locked ? true : s.enabled, order: s.order } : { id: m.id, enabled: true, order: 999 }
        }).sort((a, b) => a.order - b.order)
        setModulesConfig(merged)
      } else {
        setModulesConfig(ALL_MODULES.map((m, i) => ({ id: m.id, enabled: true, order: i })))
      }
    } catch {
      setModulesConfig(ALL_MODULES.map((m, i) => ({ id: m.id, enabled: true, order: i })))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artisan?.id])

  const saveModulesConfig = (config: { id: string; enabled: boolean; order: number }[]) => {
    setModulesConfig(config)
    try { localStorage.setItem(MODULES_STORAGE_KEY, JSON.stringify(config)) } catch {}
  }

  const isModuleEnabled = (moduleId: string): boolean => {
    if (modulesConfig.length === 0) return true // Default: all enabled
    const m = modulesConfig.find(x => x.id === moduleId)
    return m ? m.enabled : true
  }

  const moveModule = (moduleId: string, direction: 'up' | 'down') => {
    const sorted = [...modulesConfig].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(x => x.id === moduleId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    // Swap orders
    const temp = sorted[idx].order
    sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order }
    sorted[swapIdx] = { ...sorted[swapIdx], order: temp }
    saveModulesConfig(sorted)
  }

  // ── Communication tabs ──
  const [commTab, setCommTab] = useState<'particuliers' | 'pro'>('particuliers')

  // Upload documents / photo de profil
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null)
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string>('')
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let didLoad = false

    const initAuth = async () => {
      // Try getSession first (reads from storage, faster) then validate with getUser
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        didLoad = true
        await loadDashboardData(session.user)
        return
      }

      // Fallback: try getUser (validates with server)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        didLoad = true
        await loadDashboardData(currentUser)
      } else {
        window.location.href = '/pro/login'
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/pro/login'
      }
      // TOKEN_REFRESHED : Supabase a silencieusement renouvelé le token → on met à jour le token stocké
      if (event === 'TOKEN_REFRESHED' && session?.access_token) {
        // Rien de spécial à faire — supabase.auth.getSession() retournera automatiquement le nouveau token
      }
      // Only reload data if initAuth hasn't already loaded it
      if (!didLoad && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {
        didLoad = true
        await loadDashboardData(session.user)
      }
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadDashboardData = async (user: any) => {
    if (!user) { router.push('/pro/login'); return }

    // Lire le rôle depuis user_metadata
    const role = user.user_metadata?.role || 'artisan'
    if (['pro_societe', 'pro_conciergerie', 'pro_gestionnaire'].includes(role)) {
      setOrgRole(role as any)
    }

    const { data: artisanData } = await supabase
      .from('profiles_artisan').select('*').eq('user_id', user.id).single()
    // Mode admin override : pas besoin de profil artisan réel
    // Détecter le mode admin override (affiche le bouton retour admin)
    if (user.user_metadata?._admin_override) setShowAdminBtn(true)
    if (!artisanData && !user.user_metadata?._admin_override) { router.push('/pro/login'); return }
    if (!artisanData) {
      // Données factices pour la navigation admin
      setArtisan({ id: user.id, company_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Admin', email: user.email, phone: '', bio: '', user_id: user.id })
      setLoading(false)
      return
    }

    setArtisan(artisanData)
    const cleanBioForDisplay = (artisanData.bio || '').replace(/\s*<!--DS:[\s\S]*?-->/, '').trim()
    setSettingsForm({
      company_name: artisanData.company_name || '',
      email: user.email || '',
      phone: artisanData.phone || '06 51 46 66 98',
      bio: cleanBioForDisplay,
      auto_reply_message: artisanData.auto_reply_message || '',
      auto_block_duration_minutes: artisanData.auto_block_duration_minutes || 240,
      zone_radius_km: artisanData.zone_radius_km || 30,
    })
    if (artisanData.auto_accept !== undefined) setAutoAccept(!!artisanData.auto_accept)

    // Parallel fetch: all 5 data sources depend only on artisanData.id
    const aid = artisanData.id
    const [bookingsRes, servicesRes, availRes, absRes, dsRes] = await Promise.all([
      supabase.from('bookings').select('*, services(name)').eq('artisan_id', aid).order('booking_date', { ascending: false }).limit(20),
      supabase.from('services').select('*').eq('artisan_id', aid),
      fetch(`/api/availability?artisan_id=${aid}`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/artisan-absences?artisan_id=${aid}`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/availability-services?artisan_id=${aid}`).then(r => r.json()).catch(() => ({ data: null })),
    ])
    setBookings(bookingsRes.data || [])
    setServices(servicesRes.data || [])
    setAvailability(availRes.data || [])
    setAbsences(absRes.data || [])
    if (dsRes.data) {
      setDayServices(dsRes.data)
    } else {
      const savedDayServices = localStorage.getItem(`fixit_availability_services_${aid}`)
      if (savedDayServices) setDayServices(JSON.parse(savedDayServices))
    }

    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisanData.id}`) || '[]')
    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisanData.id}`) || '[]')
    setSavedDocuments([...docs, ...drafts])

    setLoading(false)
  }

  const DAY_NAMES = [t('proDash.days.sunday'), t('proDash.days.monday'), t('proDash.days.tuesday'), t('proDash.days.wednesday'), t('proDash.days.thursday'), t('proDash.days.friday'), t('proDash.days.saturday')]
  const DAY_SHORT = [t('proDash.days.sunShort'), t('proDash.days.monShort'), t('proDash.days.tueShort'), t('proDash.days.wedShort'), t('proDash.days.thuShort'), t('proDash.days.friShort'), t('proDash.days.satShort')]

  const toggleAutoAccept = async () => {
    const newVal = !autoAccept
    setAutoAccept(newVal)
    if (artisan) {
      await supabase.from('profiles_artisan').update({ auto_accept: newVal }).eq('id', artisan.id)
    }
  }

  // ═══ AVAILABILITY - Toggle via API route (bypasses RLS) ═══
  const toggleDayAvailability = async (dayOfWeek: number) => {
    if (!artisan) return
    setSavingAvail(true)
    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artisan_id: artisan.id, day_of_week: dayOfWeek })
      })
      const result = await res.json()
      if (result.error) {
        console.error('Toggle error:', result.error)
        setSavingAvail(false)
        return
      }
      // Refresh all availability from server
      const res2 = await fetch(`/api/availability?artisan_id=${artisan.id}`)
      const { data } = await res2.json()
      setAvailability(data || [])
    } catch (e) {
      console.error('Network error:', e)
    }
    setSavingAvail(false)
  }

  const updateAvailabilityTime = async (dayOfWeek: number, field: 'start_time' | 'end_time', value: string) => {
    if (!artisan) return
    const existing = availability.find((a) => a.day_of_week === dayOfWeek)
    if (existing) {
      // Optimistic UI update
      setAvailability(availability.map((a) => a.id === existing.id ? { ...a, [field]: value } : a))
      try {
        await fetch('/api/availability', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ availability_id: existing.id, field, value })
        })
      } catch (e) {
        console.error('Time update error:', e)
      }
    }
  }

  const toggleDayService = async (dayOfWeek: number, serviceId: string) => {
    const key = String(dayOfWeek)
    const current = dayServices[key] || []
    const updated = current.includes(serviceId)
      ? current.filter(id => id !== serviceId)
      : [...current, serviceId]
    const newDayServices = { ...dayServices, [key]: updated }
    setDayServices(newDayServices)
    if (artisan) {
      localStorage.setItem(`fixit_availability_services_${artisan.id}`, JSON.stringify(newDayServices))
      // Persist via API route (saves in bio marker for client-side reading)
      try {
        const res = await fetch('/api/availability-services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
          body: JSON.stringify({ artisan_id: artisan.id, dayServices: newDayServices })
        })
        const result = await res.json()
        if (result.bio) setArtisan({ ...artisan, bio: result.bio })
      } catch (e) {
        console.error('DayService save error:', e)
      }
    }
  }

  const createRdvManual = async () => {
    if (!artisan || !newRdv.date || !newRdv.time || !newRdv.service_id) return
    const service = services.find((s) => s.id === newRdv.service_id)
    // RDV manuels = auto-confirmés (l'artisan crée son propre RDV)
    const status = 'confirmed'
    // Durée : priorité au dropdown manuel, sinon durée du service, sinon 60min
    const durationMap: Record<string, number> = {
      '30': 30, '45': 45, '60': 60, '90': 90, '120': 120, '180': 180, '240': 240, '480': 480
    }
    const manualDuration = newRdv.duration ? durationMap[newRdv.duration] : null
    const durationMinutes = manualDuration || service?.duration_minutes || 60
    // Notes enrichies avec téléphone si renseigné
    let notesStr = ''
    if (newRdv.client_name) notesStr += `Client: ${newRdv.client_name}`
    if (newRdv.phone) notesStr += ` | Tél: ${newRdv.phone}`
    if (newRdv.notes) notesStr += notesStr ? ` | ${newRdv.notes}` : newRdv.notes
    const { data, error } = await supabase.from('bookings').insert({
      artisan_id: artisan.id,
      service_id: newRdv.service_id,
      status,
      confirmed_at: new Date().toISOString(),
      booking_date: newRdv.date,
      booking_time: newRdv.time,
      duration_minutes: durationMinutes,
      address: newRdv.address || 'A definir',
      notes: notesStr,
      price_ht: service?.price_ht,
      price_ttc: service?.price_ttc,
    }).select('*, services(name)').single()
    if (!error && data) {
      setBookings([data, ...bookings])
      setShowNewRdv(false)
      setNewRdv({ client_name: '', service_id: '', date: '', time: '', address: '', notes: '', phone: '', duration: '' })
    }
  }

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    const updates: any = { status: newStatus }
    if (newStatus === 'confirmed') updates.confirmed_at = new Date().toISOString()
    if (newStatus === 'cancelled') updates.cancelled_at = new Date().toISOString()
    if (newStatus === 'completed') updates.completed_at = new Date().toISOString()
    await supabase.from('bookings').update(updates).eq('id', bookingId)
    setBookings(bookings.map((b) => b.id === bookingId ? { ...b, ...updates } : b))
    setShowBookingDetail(false)
    setSelectedBooking(null)
  }

  // Clic sur une case vide de l'agenda → ouvrir nouveau RDV pré-rempli
  const handleEmptyCellClick = (date: Date, hour: string) => {
    const dateStr = date.toISOString().split('T')[0]
    setNewRdv({ client_name: '', service_id: '', date: dateStr, time: hour, address: '', notes: '', phone: '', duration: '' })
    setShowNewRdv(true)
  }

  // Clic sur un RDV existant → ouvrir détail
  const handleBookingClick = (booking: any) => {
    setSelectedBooking(booking)
    setShowBookingDetail(true)
  }

  // Convertir un booking en devis pré-rempli
  const transformBookingToDevis = (booking: any) => {
    const serviceName = booking.services?.name || (isPt ? 'Serviço' : 'Prestation')
    const priceHT = booking.price_ht || 0
    // Extract client name from notes if stored as "Client: X."
    let clientName = ''
    const notesStr = booking.notes || ''
    const clientMatch = notesStr.match(/Client:\s*([^.]+)/i)
    if (clientMatch) clientName = clientMatch[1].trim()

    // Récupérer l'unité du motif lié au booking
    const linkedService = services.find(s => s.id === booking.service_id)
    let lineUnit = 'u'
    if (linkedService) {
      const { unit: svcUnit } = parseServiceRange(linkedService)
      const unitMap: Record<string, string> = {
        'm2': 'm²', 'ml': 'ml', 'm3': 'm³', 'heure': 'h',
        'forfait': 'forfait', 'unite': 'u', 'arbre': 'u',
        'tonne': 'kg', 'kg': 'kg', 'lot': 'lot',
      }
      lineUnit = unitMap[svcUnit] || 'u'
    }

    const defaultTvaRate = isPt ? 23 : 10  // IVA normal PT 23% / TVA réduit FR 10% (rénovation)
    const lines = priceHT > 0
      ? [{ id: 1, description: serviceName, qty: 1, unit: lineUnit, priceHT, tvaRate: defaultTvaRate, totalHT: priceHT }]
      : [{ id: 1, description: serviceName, qty: 1, unit: lineUnit, priceHT: 0, tvaRate: defaultTvaRate, totalHT: 0 }]

    const devisData = {
      docType: 'devis' as const,
      docTitle: serviceName,
      clientName,
      clientAddress: booking.address || '',
      prestationDate: booking.booking_date || '',
      lines,
      notes: [
        `Demande du ${booking.booking_date || ''}${booking.booking_time ? ' à ' + booking.booking_time.substring(0, 5) : ''}`,
        notesStr && !notesStr.match(/Client:/i) ? notesStr : '',
      ].filter(Boolean).join(' — '),
    }
    setConvertingDevis(devisData)
    setShowDevisForm(true)
    navigateTo('devis')
    setSidebarOpen(false)
  }

  // Convertir un devis en facture
  const convertDevisToFacture = (devis: any) => {
    setConvertingDevis(devis)
    setShowFactureForm(true)
    setActivePage('factures')
    setSidebarOpen(false)
  }

  const getWeekDates = useCallback(() => {
    const start = new Date(selectedWeekStart)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [selectedWeekStart])

  const getBookingsForDate = useCallback((date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return bookings.filter((b) => b.booking_date === dateStr)
  }, [bookings])

  const isDateAbsent = useCallback((date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    const match = absences.find((a: any) => dateStr >= a.start_date && dateStr <= a.end_date)
    return match ? { absent: true, reason: match.reason || '', label: match.label || '', source: match.source || 'manual', id: match.id } : { absent: false, reason: '', label: '', source: '', id: '' }
  }, [absences])

  // Feature 3: Only working days for week view
  const getWorkingWeekDates = useCallback(() => {
    const allDates = getWeekDates()
    if (availability.length === 0) return allDates.filter(d => d.getDay() !== 0 && d.getDay() !== 6)
    const workingDows = availability.filter((a: any) => a.is_available).map((a: any) => a.day_of_week)
    if (workingDows.length === 0) return allDates.filter(d => d.getDay() !== 0 && d.getDay() !== 6)
    return allDates.filter(d => workingDows.includes(d.getDay()))
  }, [getWeekDates, availability])

  const createAbsence = async () => {
    if (!artisan || !newAbsence.start_date || !newAbsence.end_date) return
    try {
      const res = await fetch('/api/artisan-absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artisan_id: artisan.id, ...newAbsence })
      })
      const json = await res.json()
      if (json.data) setAbsences([...absences, json.data])
      setShowAbsenceModal(false)
      setNewAbsence({ start_date: '', end_date: '', reason: isPt ? 'Férias' : 'Vacances', label: '' })
    } catch (err) { console.error('Erreur création absence:', err) }
  }

  const deleteAbsence = async (absenceId: string) => {
    try {
      await fetch(`/api/artisan-absences?id=${absenceId}`, { method: 'DELETE' })
      setAbsences(absences.filter((a: any) => a.id !== absenceId))
    } catch (err) { console.error('Erreur suppression absence:', err) }
  }

  const changeWeek = (direction: number) => {
    const d = new Date(selectedWeekStart)
    d.setDate(d.getDate() + direction * 7)
    setSelectedWeekStart(d.toISOString().split('T')[0])
  }

  const changeDay = (direction: number) => {
    const d = new Date(selectedDay)
    d.setDate(d.getDate() + direction)
    setSelectedDay(d.toISOString().split('T')[0])
  }

  const changeMonth = (direction: number) => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + direction, 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const getMonthDays = () => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const firstDay = new Date(y, m - 1, 1)
    const lastDay = new Date(y, m, 0)
    // Commence le lundi avant le 1er du mois
    let startDay = firstDay.getDay() - 1
    if (startDay < 0) startDay = 6
    const days: Date[] = []
    const start = new Date(firstDay)
    start.setDate(start.getDate() - startDay)
    // 6 semaines max (42 jours)
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push(d)
    }
    return { days, firstDay, lastDay }
  }

  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  const getCalendarTitle = () => {
    if (calendarView === 'day') {
      const d = new Date(selectedDay)
      return d.toLocaleDateString(dateFmtLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }
    if (calendarView === 'month') {
      const [y, m] = selectedMonth.split('-').map(Number)
      const d = new Date(y, m - 1, 1)
      return d.toLocaleDateString(dateFmtLocale, { month: 'long', year: 'numeric' })
    }
    // week
    const dates = getWeekDates()
    const start = dates[0]
    const end = dates[6]
    return `${t('proDash.weekOf')} ${start.getDate()} ${t('proDash.to')} ${end.getDate()} ${end.toLocaleDateString(dateFmtLocale, { month: 'long', year: 'numeric' })}`
  }

  const navigateCalendar = (direction: number) => {
    if (calendarView === 'day') changeDay(direction)
    else if (calendarView === 'week') changeWeek(direction)
    else changeMonth(direction)
  }

  // ═══ DYNAMIC CALENDAR HOURS from availability ═══
  const getCalendarHours = (): string[] => {
    const activeSlots = availability.filter((a) => a.is_available)
    if (activeSlots.length === 0) {
      return ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']
    }
    let minHour = 23
    let maxHour = 0
    for (const slot of activeSlots) {
      const startH = parseInt((slot.start_time || '08:00').substring(0, 2))
      const endH = parseInt((slot.end_time || '17:00').substring(0, 2))
      const endM = parseInt((slot.end_time || '17:00').substring(3, 5))
      if (startH < minHour) minHour = startH
      const effectiveEnd = endM > 0 ? endH + 1 : endH
      if (effectiveEnd > maxHour) maxHour = effectiveEnd
    }
    // Add 1 hour padding on each side
    minHour = Math.max(0, minHour - 1)
    maxHour = Math.min(23, maxHour + 1)
    const hours: string[] = []
    for (let h = minHour; h < maxHour; h++) {
      hours.push(`${String(h).padStart(2, '0')}:00`)
    }
    return hours.length > 0 ? hours : ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']
  }

  // ═══ MOTIFS CRUD ═══
  // ─── Helpers fourchette de prix ───────────────────────────────────
  const parseServiceRange = (service: any): { min: number; max: number; unit: string } => {
    const desc = service.description || ''
    const match = desc.match(/\[unit:([^|]+)\|min:([\d.]+)\|max:([\d.]+)\]/)
    if (match) {
      return { unit: match[1], min: parseFloat(match[2]), max: parseFloat(match[3]) }
    }
    // Fallback : ancien format
    const unit = desc.includes('[m²]') ? 'm2' : desc.includes('[heure]') ? 'heure' : desc.includes('[unité]') ? 'unite' : 'forfait'
    return { unit, min: service.price_ht || 0, max: service.price_ttc || 0 }
  }

  const getPriceRangeLabel = (service: any): string => {
    const { min, max, unit } = parseServiceRange(service)
    if (min === 0 && max === 0) return t('proDash.onQuote')
    const suffix: Record<string, string> = { m2: '€/m²', ml: '€/ml', m3: '€/m³', heure: '€/h', forfait: '€', unite: '€/u', arbre: '€/u', kg: '€/kg', tonne: '€/t', lot: '€/lot' }
    const s = suffix[unit] || '€'
    if (min === max) return `${min}${s}`
    return `${min} – ${max}${s}`
  }
  // ──────────────────────────────────────────────────────────────────

  const openNewMotif = () => {
    setEditingMotif(null)
    setMotifForm({ name: '', description: '', duration_minutes: '', price_min: '', price_max: '', pricing_unit: 'forfait' })
    setShowMotifModal(true)
  }

  const openEditMotif = (service: any) => {
    const { min, max, unit } = parseServiceRange(service)
    const cleanDesc = (service.description || '')
      .replace(/\s*\[unit:[^\]]+\]\s*/g, '')
      .replace(/\s*\[(m²|heure|unité|forfait|ml)\]\s*/g, '')
      .trim()
    setEditingMotif(service)
    setMotifForm({
      name: service.name || '',
      description: cleanDesc,
      duration_minutes: service.duration_minutes || '',
      price_min: min || '',
      price_max: max || '',
      pricing_unit: unit,
    })
    setShowMotifModal(true)
  }

  const saveMotif = async () => {
    if (!artisan || !motifForm.name) return
    setSavingMotif(true)

    const priceMin = motifForm.price_min === '' ? 0 : Number(motifForm.price_min)
    const priceMax = motifForm.price_max === '' ? 0 : Number(motifForm.price_max)
    const durationMins = motifForm.duration_minutes === '' ? null : Number(motifForm.duration_minutes)
    const rangeTag = `[unit:${motifForm.pricing_unit}|min:${priceMin}|max:${priceMax}]`
    const description = `${motifForm.description || ''} ${rangeTag}`.trim()

    const payload = {
      artisan_id: artisan.id,
      name: motifForm.name,
      description,
      duration_minutes: durationMins,
      price_ht: priceMin,
      price_ttc: priceMax,
      active: true,
    }

    if (editingMotif) {
      const { data } = await supabase.from('services').update(payload).eq('id', editingMotif.id).select().single()
      if (data) setServices(services.map((s) => s.id === editingMotif.id ? data : s))
    } else {
      const { data } = await supabase.from('services').insert(payload).select().single()
      if (data) setServices([...services, data])
    }

    setShowMotifModal(false)
    setSavingMotif(false)
  }

  const toggleMotifActive = async (serviceId: string, currentActive: boolean) => {
    await supabase.from('services').update({ active: !currentActive }).eq('id', serviceId)
    setServices(services.map((s) => s.id === serviceId ? { ...s, active: !currentActive } : s))
  }

  const deleteMotif = async (serviceId: string) => {
    if (!confirm(t('proDash.alerts.confirmDeleteMotif'))) return
    await supabase.from('services').delete().eq('id', serviceId)
    setServices(services.filter((s) => s.id !== serviceId))
  }

  const getPricingUnit = (service: any) => {
    const { unit } = parseServiceRange(service)
    const labels: Record<string, string> = { m2: '/m²', ml: '/ml', m3: '/m³', heure: '/h', forfait: 'forfait', unite: '/u', arbre: '/u', kg: '/kg', tonne: '/t', lot: '/lot' }
    return labels[unit] || 'forfait'
  }

  const getCleanDescription = (service: any) => {
    return (service.description || '')
      .replace(/\s*\[unit:[^\]]+\]\s*/g, '')
      .replace(/\s*\[(m²|heure|unité|forfait|ml)\]\s*/g, '')
      .trim()
  }

  // ═══ SETTINGS SAVE ═══
  const saveSettings = async () => {
    if (!artisan) return
    setSavingSettings(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { alert(t('proDash.alerts.sessionExpired')); setSavingSettings(false); return }

      const res = await fetch('/api/artisan-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          company_name: settingsForm.company_name,
          bio: settingsForm.bio,
          phone: settingsForm.phone,
          email: settingsForm.email,
          auto_reply_message: settingsForm.auto_reply_message,
          auto_block_duration_minutes: settingsForm.auto_block_duration_minutes,
          zone_radius_km: settingsForm.zone_radius_km,
        })
      })
      const json = await res.json()
      if (!res.ok) { alert(`❌ ${t('proDash.alerts.error')}: ${json.error || t('proDash.alerts.cantSave')}`); setSavingSettings(false); return }

      setArtisan({
        ...artisan,
        company_name: settingsForm.company_name,
        bio: settingsForm.bio,
        phone: settingsForm.phone,
        email: settingsForm.email,
        auto_reply_message: settingsForm.auto_reply_message,
        auto_block_duration_minutes: settingsForm.auto_block_duration_minutes,
        zone_radius_km: settingsForm.zone_radius_km,
        ...(json.slug ? { slug: json.slug } : {}),
      })
      // Re-save dayServices marker after bio update
      if (Object.values(dayServices).some(arr => arr.length > 0)) {
        try {
          await fetch('/api/availability-services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
            body: JSON.stringify({ artisan_id: artisan.id, dayServices })
          })
        } catch {}
      }
      if (json.partial && json.warning) {
        alert(`⚠️ ${t('proDash.alerts.partialSave')}: ${json.warning}`)
      } else {
        alert(t('proDash.alerts.profileUpdated'))
      }
    } catch {
      alert(t('proDash.alerts.networkError'))
    } finally {
      setSavingSettings(false)
    }
  }

  // ═══ MESSAGERIE ARTISAN DASHBOARD ═══
  const openDashMessages = async (booking: any) => {
    setDashMsgModal(booking)
    setDashMsgList([])
    setDashMsgText('')
    try {
      const res = await fetch(`/api/booking-messages?booking_id=${booking.id}`, {
        headers: { 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` }
      })
      const json = await res.json()
      if (json.data) setDashMsgList(json.data)
    } catch (e) { console.error('Error fetching messages:', e) }
  }

  const sendDashMessage = async () => {
    if (!dashMsgModal || !dashMsgText.trim() || dashMsgSending) return
    setDashMsgSending(true)
    try {
      const res = await fetch('/api/booking-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ booking_id: dashMsgModal.id, content: dashMsgText.trim() }),
      })
      const json = await res.json()
      if (json.data) {
        setDashMsgList(prev => [...prev, json.data])
        setDashMsgText('')
      }
    } catch (e) { console.error('Error sending message:', e) }
    setDashMsgSending(false)
  }

  // ═══ MESSAGERIE ENRICHIE ARTISAN — helpers ═══
  // Utilise getSession() qui déclenche un refresh automatique si le token est expiré
  const getDashAuthToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) return session.access_token
    // Fallback : forcer un refresh via getUser() qui valide côté serveur
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/pro/login'; return '' }
    const { data: { session: s2 } } = await supabase.auth.getSession()
    return s2?.access_token || ''
  }

  const uploadDashAttachment = async (file: File): Promise<string | null> => {
    setDashMsgUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'booking-attachments')
      formData.append('folder', 'messages')
      const token = await getDashAuthToken()
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })
      const json = await res.json()
      return json.url || null
    } catch (e) { console.error('Upload error:', e); return null }
    finally { setDashMsgUploading(false) }
  }

  const sendDashPhotoMessage = async (file: File) => {
    if (!dashMsgModal) return
    const url = await uploadDashAttachment(file)
    if (!url) { alert(t('proDash.alerts.uploadError')); return }
    try {
      const token = await getDashAuthToken()
      const res = await fetch('/api/booking-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ booking_id: dashMsgModal.id, content: '', type: 'photo', attachment_url: url }),
      })
      const json = await res.json()
      if (json.data) setDashMsgList(prev => [...prev, json.data])
    } catch (e) { console.error('Error sending photo:', e) }
  }

  const startDashVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: recorder.mimeType })
        if (blob.size < 1000) return
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: recorder.mimeType })
        if (!dashMsgModal) return
        const url = await uploadDashAttachment(file)
        if (!url) { alert(isPt ? '❌ Erro ao enviar áudio' : '❌ Erreur upload vocal'); return }
        try {
          const token = await getDashAuthToken()
          const res = await fetch('/api/booking-messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ booking_id: dashMsgModal.id, content: '🎤 Message vocal', type: 'voice', attachment_url: url }),
          })
          const json = await res.json()
          if (json.data) setDashMsgList(prev => [...prev, json.data])
        } catch (e) { console.error('Error sending voice:', e) }
      }
      recorder.start()
      setDashMsgRecorderRef(recorder)
      setDashMsgRecording(true)
    } catch (e) {
      console.error('Microphone error:', e)
      alert(t('proDash.alerts.micError'))
    }
  }

  const stopDashVoiceRecording = () => {
    if (dashMsgRecorderRef && dashMsgRecorderRef.state !== 'inactive') {
      dashMsgRecorderRef.stop()
    }
    setDashMsgRecording(false)
    setDashMsgRecorderRef(null)
  }

  const handleBlockAgendaFromDevis = async (msg: any) => {
    if (!msg.metadata || !artisan) return
    const m = msg.metadata
    setDashMsgBlockingAgenda(msg.id)
    try {
      const prDate = m.prestationDate
      if (!prDate) {
        alert(isPt ? '⚠️ Sem data de prestação indicada neste orçamento' : '⚠️ Pas de date de prestation renseignée sur ce devis')
        setDashMsgBlockingAgenda(null)
        return
      }
      // Calculer la date de fin
      let endDate = prDate
      const delayDays = m.executionDelayDays || 0
      if (delayDays > 0) {
        const start = new Date(prDate)
        if (m.executionDelayType === 'calendaires') {
          const end = new Date(start)
          end.setDate(end.getDate() + delayDays - 1)
          endDate = end.toISOString().split('T')[0]
        } else {
          let count = 0
          const current = new Date(start)
          while (count < delayDays - 1) {
            current.setDate(current.getDate() + 1)
            const dow = current.getDay()
            if (dow >= 1 && dow <= 5) count++
          }
          endDate = current.toISOString().split('T')[0]
        }
      }
      const label = `${m.signer_name || 'Client'}${m.docTitle ? ' - ' + m.docTitle : ''}`
      const token = await getDashAuthToken()
      const res = await fetch('/api/artisan-absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          artisan_id: artisan.id,
          start_date: prDate,
          end_date: endDate,
          reason: isPt ? 'Intervenção do orçamento' : 'Intervention devis',
          label,
          source: 'devis',
        }),
      })
      if (!res.ok) throw new Error('Erreur création absence')
      alert(isPt
        ? `✅ Agenda bloqueado de ${new Date(prDate).toLocaleDateString(dateFmtLocale)} a ${new Date(endDate).toLocaleDateString(dateFmtLocale)}\n📅 ${label}`
        : `✅ Agenda bloqué du ${new Date(prDate).toLocaleDateString(dateFmtLocale)} au ${new Date(endDate).toLocaleDateString(dateFmtLocale)}\n📅 ${label}`)
    } catch (err) {
      console.error('Erreur blocage agenda:', err)
      alert(isPt ? '❌ Erro ao bloquear a agenda' : '❌ Erreur lors du blocage de l\'agenda')
    } finally {
      setDashMsgBlockingAgenda(null)
    }
  }

  // ═══ UPLOAD DOCUMENT (photo profil, kbis, assurance) ═══
  const uploadDocument = async (
    file: File,
    folder: 'profiles' | 'kbis' | 'insurance',
    field: 'profile_photo_url' | 'kbis_url' | 'insurance_url',
    setUploading: (v: boolean) => void
  ) => {
    if (!artisan) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('bucket', folder === 'profiles' ? 'profile-photos' : 'artisan-documents')
      fd.append('folder', folder)
      fd.append('artisan_id', artisan.id)
      fd.append('field', field)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur upload')
      setArtisan({ ...artisan, [field]: data.url })
      setUploadMsg({ type: 'success', text: isPt ? '✅ Documento atualizado com sucesso!' : '✅ Document mis à jour avec succès !' })
    } catch (err: any) {
      setUploadMsg({ type: 'error', text: `❌ ${err.message}` })
    } finally {
      setUploading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    // Hard navigation — router.push triggers middleware which redirects to /pro/login before / loads
    window.location.href = `/${locale}/`
  }

  // ═══ NOTIFICATIONS TEMPS RÉEL ═══
  // Load notifications from API — paused when tab is hidden to reduce server load
  useEffect(() => {
    if (!artisan?.user_id) return
    const loadNotifs = async () => {
      try {
        const token = await getDashAuthToken()
        const res = await fetch(`/api/syndic/notify-artisan?artisan_id=${artisan.user_id}&limit=30`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (res.ok) {
          const data = await res.json()
          if (data.notifications) {
            setNotifications(data.notifications)
            setUnreadNotifCount(data.notifications.filter((n: any) => !n.read).length)
          }
        }
      } catch {}
    }
    loadNotifs()
    let interval = setInterval(loadNotifs, POLL_NOTIFICATIONS)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(interval)
      } else {
        loadNotifs()
        interval = setInterval(loadNotifs, POLL_NOTIFICATIONS)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [artisan?.user_id])

  // Load unread message count — paused when tab is hidden
  useEffect(() => {
    if (!artisan?.user_id) return
    const loadUnread = async () => {
      try {
        const token = await getDashAuthToken()
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const [clientsRes, proRes] = await Promise.all([
          fetch(`/api/pro/messagerie?artisan_user_id=${artisan.user_id}&contact_type=particulier`, { headers }),
          fetch(`/api/pro/messagerie?artisan_user_id=${artisan.user_id}&contact_type=pro`, { headers }),
        ])
        const [cd, pd] = await Promise.all([clientsRes.json(), proRes.json()])
        const total = (cd.conversations || []).reduce((s: number, c: any) => s + (c.unread_count || 0), 0) +
                      (pd.conversations || []).reduce((s: number, c: any) => s + (c.unread_count || 0), 0)
        setUnreadMsgCount(total)
      } catch {}
    }
    loadUnread()
    let interval = setInterval(loadUnread, POLL_MISSIONS)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(interval)
      } else {
        loadUnread()
        interval = setInterval(loadUnread, POLL_MISSIONS)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [artisan?.user_id])

  // ── Browser notifications helper ──
  const sendBrowserNotif = useCallback((title: string, body: string, onClick?: () => void) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    // Don't send if tab is focused
    if (document.visibilityState === 'visible') return
    try {
      const notif = new Notification(title, {
        body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: `vitfix-${Date.now()}`,
      })
      if (onClick) notif.onclick = () => { window.focus(); onClick(); notif.close() }
      setTimeout(() => notif.close(), TOAST_LONG)
    } catch {}
  }, [])

  // ── Request browser notification permission on mount ──
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      // Ask after 3s so it doesn't feel intrusive
      const timer = setTimeout(() => { Notification.requestPermission() }, TOAST_DEFAULT)
      return () => clearTimeout(timer)
    }
  }, [])

  // Realtime subscription for notifications + bookings + messages
  useEffect(() => {
    if (!artisan?.user_id) return
    const channel = supabase
      .channel(`notifs_${artisan.user_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'artisan_notifications',
        filter: `artisan_id=eq.${artisan.user_id}`,
      }, (payload) => {
        const n = payload.new as any
        if (n.artisan_id === artisan.user_id) {
          setNotifications(prev => [n, ...prev].slice(0, 30))
          setUnreadNotifCount(prev => prev + 1)
          // Browser notification
          const typeLabels: Record<string, string> = {
            new_mission: `📋 ${t('proDash.notifs.newMission')}`,
            mission_update: `🔄 ${t('proDash.notifs.missionUpdate')}`,
            planning_change: `📅 ${t('proDash.notifs.planningChange')}`,
            message: `💬 ${t('proDash.notifs.message')}`,
            new_booking: `📅 ${t('proDash.notifs.newBooking')}`,
          }
          sendBrowserNotif(
            typeLabels[n.type] || '🔔 Notification Vitfix',
            n.message || n.title || t('proDash.notifs.newNotif'),
            () => {
              if (n.type === 'new_mission') setActivePage('missions')
              else if (n.type === 'message') setActivePage('messages')
              else if (n.type === 'new_booking') setActivePage('calendar')
            }
          )
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_messages',
      }, (payload) => {
        const msg = payload.new as any
        // Only notify if message is NOT from this user
        if (msg.sender_id !== artisan.user_id) {
          setUnreadMsgCount(prev => prev + 1)
          sendBrowserNotif(
            '💬 Nouveau message',
            msg.content ? (msg.content.length > 80 ? msg.content.substring(0, 80) + '…' : msg.content) : t('proDash.notifs.newMsgReceived'),
            () => setActivePage('messages')
          )
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bookings',
        filter: `artisan_id=eq.${artisan.id}`,
      }, (payload) => {
        const b = payload.new as any
        if (b.artisan_id === artisan.id) {
          // Add to bookings list
          setBookings(prev => [b, ...prev])
          sendBrowserNotif(
            isPt ? '📅 Nova marcação' : '📅 Nouveau rendez-vous',
            `${b.booking_date || (isPt ? 'Data a confirmar' : 'Date à confirmer')} — ${b.client_name || (isPt ? 'Novo cliente' : 'Nouveau client')}`,
            () => setActivePage('calendar')
          )
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'booking_messages',
      }, (payload) => {
        const msg = payload.new as any
        // Only notify if someone else sent the message (not the artisan)
        if (msg.sender_role === 'client') {
          sendBrowserNotif(
            '💬 ' + (msg.sender_name || 'Client'),
            msg.content ? (msg.content.length > 80 ? msg.content.substring(0, 80) + '…' : msg.content) : 'Nouveau message',
            () => setActivePage('calendar')
          )
        }
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[pro/dashboard] Realtime channel error:', err?.message)
        }
      })
    return () => { supabase.removeChannel(channel) }
  }, [artisan?.user_id, artisan?.id, sendBrowserNotif])

  // Mark all notifications as read
  // ═══ NAVIGATION - reset form states ═══
  const navigateTo = useCallback((page: string) => {
    setActivePage(page)
    setSidebarOpen(false)
    // Reset form views when navigating via sidebar
    if (page === 'devis') setShowDevisForm(false)
    if (page === 'factures') setShowFactureForm(false)
  }, [])

  const firstName = artisan?.company_name?.split(' ')[0] || 'Pro'
  const initials = artisan?.company_name
    ? artisan.company_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'PR'

  const completedBookings = useMemo(() => bookings.filter((b) => b.status === 'completed'), [bookings])
  const pendingBookings = useMemo(() => bookings.filter((b) => b.status === 'pending'), [bookings])
  const totalRevenue = useMemo(() => completedBookings.reduce((sum, b) => sum + (b.price_ttc || 0), 0), [completedBookings])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <DashboardSkeleton />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans">

      {/* ── BOUTON RETOUR ADMIN (mode override) ── */}
      {showAdminBtn && (
        <div className="fixed top-3 right-3 z-[9999]">
          <button
            onClick={async () => {
              const { data: { user: u } } = await supabase.auth.getUser()
              if (u?.user_metadata?._admin_override) {
                await supabase.auth.updateUser({ data: { ...u.user_metadata, role: 'super_admin', _admin_override: false } })
                await supabase.auth.refreshSession()
                window.location.href = '/admin/dashboard'
              }
            }}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold text-xs px-4 py-2 rounded-full shadow-lg transition"
          >
            ⚡ Retour Admin
          </button>
        </div>
      )}

      {/* ══════════ MOBILE TOP BAR (hidden on desktop) ══════════ */}
      <div className="lg:hidden bg-[#2C3E50] px-4 py-3 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <button className="text-2xl text-white" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <div className="text-xl font-display font-extrabold cursor-pointer" onClick={() => navigateTo('home')}>
            <span className="text-yellow">VIT</span><span className="text-white">FIX</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowProfileMenu(!showProfileMenu)}>
              <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-[#FFC107] to-[#FFD54F] flex items-center justify-center text-white font-bold text-xs shadow-md">
                {initials}
              </div>
            </div>
            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  <button onClick={() => { setShowProfileMenu(false); navigateTo('settings') }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition">
                    <span>⚙️</span> {t('proDash.myProfile')}
                  </button>
                  <div className="border-t border-gray-100" />
                  <button onClick={async () => { setShowProfileMenu(false); await supabase.auth.signOut(); window.location.href = `/${locale}/` }}
                    className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition">
                    <span>🚪</span> {t('proDash.logout')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══════════ MAIN LAYOUT ══════════ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ══════════ SIDEBAR ══════════ */}
        <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static z-40 w-[250px] bg-[#2C3E50] text-white h-full overflow-y-auto transition-transform duration-300`}>
          {/* Logo + Profile — h-20 aligné avec les headers de contenu */}
          <div className="px-5 h-20 border-b border-[#34495E] flex items-center">
            <div className="relative flex items-center gap-3 w-full">
              <div className="w-[36px] h-[36px] rounded-full bg-gradient-to-br from-[#FFC107] to-[#FFD54F] flex items-center justify-center text-white font-bold text-xs shadow-md flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigateTo('home')}>
                <div className="text-xl font-display font-extrabold leading-tight"><span className="text-yellow">VIT</span><span className="text-white">FIX</span></div>
                <div className="text-[10px] text-[#95A5A6] truncate">{artisan?.company_name}</div>
              </div>
            </div>
          </div>
          <div className="mb-6 pt-4">
            <div className="px-6 text-[0.7rem] uppercase text-[#95A5A6] mb-3 font-semibold tracking-widest">{t('proDash.sidebar.main')}</div>
            <SidebarItem icon="🏠" label={t('proDash.modules.home')} active={activePage === 'home'} onClick={() => navigateTo('home')} />
            {orgRole === 'artisan' && <>
              <SidebarItem icon="📅" label={t('proDash.modules.calendar')} active={activePage === 'calendar'} onClick={() => navigateTo('calendar')} />
              <SidebarItem icon="🔧" label={t('proDash.modules.motifs')} active={activePage === 'motifs'} onClick={() => navigateTo('motifs')} />
              <SidebarItem icon="🕐" label={t('proDash.modules.hours')} active={activePage === 'horaires'} onClick={() => navigateTo('horaires')} />
            </>}
            {orgRole === 'pro_societe' && <>
              <SidebarItem icon="👷" label={t('proDash.btp.teams')} active={activePage === 'equipes'} onClick={() => navigateTo('equipes')} />
              <SidebarItem icon="📋" label={t('proDash.btp.sites')} active={activePage === 'chantiers'} onClick={() => navigateTo('chantiers')} />
              <SidebarItem icon="📅" label={t('proDash.modules.planning')} active={activePage === 'calendar'} onClick={() => navigateTo('calendar')} />
              <SidebarItem icon="📅" label={t('proDash.btp.gantt')} active={activePage === 'gantt'} onClick={() => navigateTo('gantt')} />
              <SidebarItem icon="📊" label={t('proDash.btp.situations')} active={activePage === 'situations'} onClick={() => navigateTo('situations')} />
              <SidebarItem icon="🔒" label={t('proDash.btp.guarantees')} active={activePage === 'garanties'} onClick={() => navigateTo('garanties')} />
              <SidebarItem icon="⏱️" label={t('proDash.btp.timeTracking')} active={activePage === 'pointage'} onClick={() => navigateTo('pointage')} />
              <SidebarItem icon="🤝" label={t('proDash.btp.subcontracting')} active={activePage === 'sous_traitance'} onClick={() => navigateTo('sous_traitance')} />
              <SidebarItem icon="📋" label={t('proDash.btp.tenders')} active={activePage === 'dpgf'} onClick={() => navigateTo('dpgf')} />
            </>}
            {orgRole === 'pro_conciergerie' && <>
              <SidebarItem icon="🏠" label={t('proDash.conciergerie.properties')} active={activePage === 'proprietes'} onClick={() => navigateTo('proprietes')} />
              <SidebarItem icon="📅" label={t('proDash.modules.planning')} active={activePage === 'calendar'} onClick={() => navigateTo('calendar')} />
              <SidebarItem icon="🔑" label={t('proDash.conciergerie.access')} active={activePage === 'acces'} onClick={() => navigateTo('acces')} />
              <SidebarItem icon="🌐" label={t('proDash.conciergerie.channelManager')} active={activePage === 'channel_manager'} onClick={() => navigateTo('channel_manager')} />
              <SidebarItem icon="💰" label={t('proDash.conciergerie.pricing')} active={activePage === 'tarification'} onClick={() => navigateTo('tarification')} />
              <SidebarItem icon="✅" label={t('proDash.conciergerie.checkinout')} active={activePage === 'checkinout'} onClick={() => navigateTo('checkinout')} />
              <SidebarItem icon="📖" label={t('proDash.conciergerie.welcomeBook')} active={activePage === 'livret'} onClick={() => navigateTo('livret')} />
              <SidebarItem icon="🧹" label={t('proDash.conciergerie.cleaningSchedule')} active={activePage === 'menage'} onClick={() => navigateTo('menage')} />
              <SidebarItem icon="📈" label={t('proDash.conciergerie.revpar')} active={activePage === 'revpar'} onClick={() => navigateTo('revpar')} />
            </>}
            {orgRole === 'pro_gestionnaire' && <>
              <SidebarItem icon="🏢" label={t('proDash.gestionnaire.buildings')} active={activePage === 'immeubles'} onClick={() => navigateTo('immeubles')} />
              <SidebarItem icon="📋" label={t('proDash.gestionnaire.missions')} active={activePage === 'missions'} onClick={() => navigateTo('missions')} />
              <SidebarItem icon="📅" label={t('proDash.modules.planning')} active={activePage === 'calendar'} onClick={() => navigateTo('calendar')} />
            </>}
          </div>
          <div className="mb-6">
            <div className="px-6 text-[0.7rem] uppercase text-[#95A5A6] mb-3 font-semibold tracking-widest">{t('proDash.sidebar.communication')}</div>
            {isModuleEnabled('messages') && <SidebarItem icon="💬" label={t('proDash.modules.messaging')} active={activePage === 'messages' || activePage === 'comm_pro'} badge={(unreadMsgCount + pendingBookings.length) || undefined} onClick={() => navigateTo('messages')} />}
            {isModuleEnabled('clients') && <SidebarItem icon="👥" label={t('proDash.modules.clients')} active={activePage === 'clients'} onClick={() => navigateTo('clients')} />}
          </div>
          <div className="mb-6">
            <div className="px-6 text-[0.7rem] uppercase text-[#95A5A6] mb-3 font-semibold tracking-widest">{t('proDash.sidebar.facturation')}</div>
            {isModuleEnabled('devis') && <SidebarItem icon="📄" label={t('proDash.modules.quotes')} active={activePage === 'devis'} onClick={() => navigateTo('devis')} />}
            {isModuleEnabled('factures') && <SidebarItem icon="🧾" label={t('proDash.modules.invoices')} active={activePage === 'factures'} onClick={() => navigateTo('factures')} />}
            {isModuleEnabled('rapports') && <SidebarItem icon="📋" label={t('proDash.modules.reports')} active={activePage === 'rapports'} onClick={() => navigateTo('rapports')} />}
            <SidebarItem icon="📸" label={t('proDash.modules.sitePhotos')} active={activePage === 'photos_chantier'} onClick={() => navigateTo('photos_chantier')} />
            {isModuleEnabled('contrats') && (orgRole === 'pro_societe' || orgRole === 'pro_gestionnaire') && (
              <SidebarItem icon="📑" label={t('proDash.modules.contracts')} active={activePage === 'contrats'} onClick={() => navigateTo('contrats')} />
            )}
          </div>
          <div className="mb-6">
            <div className="px-6 text-[0.7rem] uppercase text-[#95A5A6] mb-3 font-semibold tracking-widest">{t('proDash.sidebar.analyse')}</div>
            {isModuleEnabled('stats') && <SidebarItem icon="📊" label={t('proDash.modules.stats')} active={activePage === 'stats'} onClick={() => navigateTo('stats')} />}
            {isModuleEnabled('revenus') && <SidebarItem icon="💰" label={t('proDash.modules.revenue')} active={activePage === 'revenus'} onClick={() => navigateTo('revenus')} />}
            {isModuleEnabled('comptabilite') && <SidebarItem icon="🧮" label={t('proDash.modules.accounting')} active={activePage === 'comptabilite'} onClick={() => navigateTo('comptabilite')} />}
            {isModuleEnabled('materiaux') && orgRole === 'artisan' && (
              <SidebarItem icon="🛒" label={t('proDash.modules.materials')} active={activePage === 'materiaux'} onClick={() => navigateTo('materiaux')} />
            )}
            {isModuleEnabled('marches') && (
              <SidebarItem icon="🏛️" label={t('proDash.modules.marches') || 'Bourse aux Marchés'} active={activePage === 'marches'} onClick={() => navigateTo('marches')} />
            )}
          </div>
          {orgRole === 'artisan' && (isModuleEnabled('wallet') || isModuleEnabled('portfolio')) && (
            <div className="mb-6">
              <div className="px-6 text-[0.7rem] uppercase text-[#95A5A6] mb-3 font-semibold tracking-widest">{t('proDash.sidebar.profilPro')}</div>
              {isModuleEnabled('wallet') && <SidebarItem icon="🗂️" label={t('proDash.modules.wallet')} active={activePage === 'wallet'} onClick={() => navigateTo('wallet')} />}
              {isModuleEnabled('portfolio') && <SidebarItem icon="📸" label={t('proDash.modules.portfolio')} active={activePage === 'portfolio'} onClick={() => navigateTo('portfolio')} />}
            </div>
          )}
          <div className="mb-6">
            <div className="px-6 text-[0.7rem] uppercase text-[#95A5A6] mb-3 font-semibold tracking-widest">{t('proDash.sidebar.compte')}</div>
            <SidebarItem icon="⚙️" label={t('proDash.modules.settings')} active={activePage === 'settings' && settingsTab !== 'modules'} onClick={() => { navigateTo('settings'); setSettingsTab('profil') }} />
            <SidebarItem icon="🧩" label={t('proDash.modules.modules')} active={activePage === 'settings' && settingsTab === 'modules'} onClick={() => { navigateTo('settings'); setSettingsTab('modules') }} />
            <SidebarItem icon="❓" label={t('proDash.modules.help')} active={activePage === 'help'} onClick={() => navigateTo('help')} />
            <div onClick={handleLogout} className="flex items-center gap-3 px-6 py-4 cursor-pointer text-red-400 hover:bg-red-500/10 hover:pl-8 transition-all text-[0.95rem]">
              <span>🚪</span><span>{t('proDash.logout')}</span>
            </div>
          </div>
        </div>

        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ══════════ CONTENT ══════════ */}
        <div className="flex-1 overflow-y-auto bg-[#F8F9FA]">

          {/* ────── HOME ────── */}
          {activePage === 'home' && (
            <HomeSection
              artisan={artisan} orgRole={orgRole} bookings={bookings} services={services}
              pendingBookings={pendingBookings} completedBookings={completedBookings}
              totalRevenue={totalRevenue} firstName={firstName}
              navigateTo={navigateTo} setShowNewRdv={setShowNewRdv}
              setShowDevisForm={setShowDevisForm} setShowFactureForm={setShowFactureForm}
              setActivePage={setActivePage} setSidebarOpen={setSidebarOpen}
              openNewMotif={openNewMotif}
            />
          )}

          {/* ────── AGENDA ────── */}
          {activePage === 'calendar' && (
            <CalendarSection
              artisan={artisan} bookings={bookings} services={services}
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
              transformBookingToDevis={transformBookingToDevis} openDashMessages={openDashMessages}
              DAY_NAMES={DAY_NAMES} DAY_SHORT={DAY_SHORT}
            />
          )}

          {/* ────── HORAIRES D'OUVERTURE ────── */}
          {activePage === 'horaires' && (
            <HorairesSection
              artisan={artisan} services={services} availability={availability}
              dayServices={dayServices} autoAccept={autoAccept} savingAvail={savingAvail}
              toggleAutoAccept={toggleAutoAccept} toggleDayAvailability={toggleDayAvailability}
              updateAvailabilityTime={updateAvailabilityTime} toggleDayService={toggleDayService}
              DAY_NAMES={DAY_NAMES}
            />
          )}

          {/* ────── MOTIFS (Services) - FULL CRUD ────── */}
          {activePage === 'motifs' && (
            <MotifsSection
              services={services}
              showMotifModal={showMotifModal} setShowMotifModal={setShowMotifModal}
              editingMotif={editingMotif} motifForm={motifForm} setMotifForm={setMotifForm}
              savingMotif={savingMotif} openNewMotif={openNewMotif} openEditMotif={openEditMotif}
              saveMotif={saveMotif} toggleMotifActive={toggleMotifActive} deleteMotif={deleteMotif}
              getPriceRangeLabel={getPriceRangeLabel} getPricingUnit={getPricingUnit} getCleanDescription={getCleanDescription}
            />
          )}

          {/* ────── MESSAGERIE V2 ────── */}
          {(activePage === 'messages' || activePage === 'comm_pro') && artisan && (
            <div className="animate-fadeIn flex flex-col h-[calc(100vh-64px)]">
              <div className="bg-white px-6 lg:px-10 h-20 border-b border-[#34495E] flex items-center flex-shrink-0">
                <div>
                  <h1 className="text-xl font-semibold leading-tight">💬 {t('proDash.modules.messaging')}</h1>
                  <p className="text-xs text-gray-400 mt-0.5">{t('proDash.messaging.subtitle')}</p>
                </div>
              </div>
              <div className="flex-1 min-h-0 p-3">
            <MessagerieArtisan
              artisan={artisan}
              onProposerDevis={(missionData) => {
                // ── Matching intelligent : motif mission → service catalogue (prix) ──
                const motif = (missionData.description || missionData.titre || '').toLowerCase()
                const matchedService = services.find((s: any) => {
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
                const matchedBooking = contactLower.length > 2 ? bookings.find((b: any) => (b.notes || '').toLowerCase().includes(contactLower)) : null
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

          {/* ────── MESSAGERIE LEGACY (hidden) ────── */}
          {false && (
            <div className="animate-fadeIn">
              <div className="bg-white px-6 lg:px-10 h-20 border-b border-[#34495E] flex items-center">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-2xl font-semibold">💬 Messagerie</h1>
                  </div>
                  {commTab === 'particuliers' && pendingBookings.length > 0 && (
                    <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-sm font-semibold">{pendingBookings.length} en attente</span>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setCommTab('particuliers')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${commTab === 'particuliers' ? 'bg-[#FFC107] text-gray-900 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {isPt ? '🏠 Particulares' : '🏠 Particuliers'}
                  </button>
                  <button
                    onClick={() => setCommTab('pro')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${commTab === 'pro' ? 'bg-[#FFC107] text-gray-900 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    🏢 Pro
                  </button>
                </div>
              </div>

              {/* ── Onglet Particuliers ── */}
              {commTab === 'particuliers' && (
                <div className="p-6 lg:p-8">
                  {pendingBookings.length > 0 ? (
                    <div className="space-y-4">
                      {pendingBookings.map((b) => (
                        <div key={b.id} className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-[#FFC107]">
                          <div className="flex flex-col sm:flex-row justify-between gap-3">
                            <div>
                              <div className="font-bold text-lg">{b.services?.name || 'Demande de RDV'}</div>
                              <div className="text-sm text-gray-600 mt-1">📅 {b.booking_date} à {b.booking_time?.substring(0, 5)}</div>
                              <div className="text-sm text-gray-500">📍 {b.address}</div>
                              {b.notes && <div className="text-sm text-gray-500 mt-2 bg-gray-50 p-2 rounded">{b.notes}</div>}
                            </div>
                            <div className="flex flex-wrap gap-2 self-start">
                              <button onClick={() => openDashMessages(b)} className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-4 py-2 rounded-lg font-semibold text-sm transition">💬</button>
                              <button onClick={() => transformBookingToDevis(b)} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition flex items-center gap-1">📄 Devis</button>
                              <button onClick={() => updateBookingStatus(b.id, 'confirmed')} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition">✓ Accepter</button>
                              <button onClick={() => updateBookingStatus(b.id, 'cancelled')} className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold text-sm transition">✕ Refuser</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white p-12 rounded-2xl text-center shadow-sm">
                      <div className="text-6xl mb-4">✅</div>
                      <h3 className="text-2xl font-bold mb-3">{isPt ? 'Nenhum pedido pendente' : 'Aucune demande en attente'}</h3>
                      <p className="text-gray-500 text-lg">{isPt ? 'Todos os pedidos de clientes foram tratados' : 'Toutes les demandes clients ont été traitées'}</p>
                    </div>
                  )}

                  {/* Historique conversations clients */}
                  {bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length > 0 && (
                    <div className="mt-8">
                      <h3 className="font-bold text-gray-700 mb-3">{isPt ? '📨 Conversas de clientes ativas' : '📨 Conversations clients actives'}</h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').slice(0, 12).map(b => {
                          const rawNotes = b.notes || ''
                          const hasPipes = rawNotes.includes('|')
                          const clientNameMatch = hasPipes ? rawNotes.match(/Client:\s*([^|\n]+)/i) : rawNotes.match(/Client:\s*([^.\n]+)/i)
                          const clientLabel = clientNameMatch ? clientNameMatch[1].trim() : 'Client'
                          return (
                            <button key={b.id} onClick={() => openDashMessages(b)}
                              className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-[#FFC107] hover:shadow-md transition text-left">
                              <div className="font-semibold text-sm text-gray-900 truncate">{clientLabel}</div>
                              <div className="text-xs text-gray-500 mt-1">{b.services?.name || 'Intervention'} — {b.booking_date}</div>
                              <div className="text-xs text-gray-300 mt-1">💬 Ouvrir la conversation</div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Onglet Pro ── */}
              {commTab === 'pro' && (
                <div className="p-6 lg:p-8">
                  {/* Canal Pro */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-blue-900 text-lg mb-1">📡 Canal Pro</h3>
                        <p className="text-sm text-blue-600">{isPt ? 'Mensagens diretas com os seus contactos profissionais' : 'Messagerie directe avec vos contacts professionnels'}</p>
                      </div>
                      <button onClick={() => navigateTo('canal')} className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm">
                        {isPt ? 'Abrir o canal →' : 'Ouvrir le canal →'}
                      </button>
                    </div>
                  </div>

                  {/* Ordres de mission */}
                  <div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-2xl p-6 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-purple-900 text-lg mb-1">{isPt ? '📋 Ordens de trabalho' : '📋 Ordres de mission'}</h3>
                        <p className="text-sm text-purple-600">{isPt ? 'Missões recebidas de condomínios e gestores' : 'Missions reçues des syndics et gestionnaires'}</p>
                      </div>
                      <button onClick={() => navigateTo('messages')} className="bg-purple-500 hover:bg-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm">
                        {isPt ? 'Ver na mensagem →' : 'Voir dans la messagerie →'}
                      </button>
                    </div>
                  </div>

                  {/* Types de contacts pro */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {(isPt ? [
                      { icon: '🏛️', label: 'Condomínios', desc: 'Propriedades em condomínio' },
                      { icon: '🏗️', label: 'Empresas de Construção', desc: 'Subcontratação' },
                      { icon: '🏠', label: 'Proprietários Sociais', desc: 'Habitação social' },
                      { icon: '🔑', label: 'Gestão de Propriedades', desc: 'Aluguéis de curta duração' },
                    ] : [
                      { icon: '🏛️', label: 'Syndics', desc: 'Copropriétés' },
                      { icon: '🏗️', label: 'Entreprises BTP', desc: 'Sous-traitance' },
                      { icon: '🏠', label: 'Bailleurs sociaux', desc: 'Logements sociaux' },
                      { icon: '🔑', label: 'Conciergeries', desc: 'Locations courtes' },
                    ]).map((t) => (
                      <div key={t.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                        <div className="text-2xl mb-2">{t.icon}</div>
                        <div className="font-semibold text-sm text-gray-900">{t.label}</div>
                        <div className="text-xs text-gray-500">{t.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}


          {/* ────── DEVIS ────── */}
          {activePage === 'devis' && (
            <DevisSection
              artisan={artisan} services={services} bookings={bookings}
              savedDocuments={savedDocuments} setSavedDocuments={setSavedDocuments}
              showDevisForm={showDevisForm} setShowDevisForm={setShowDevisForm}
              convertingDevis={convertingDevis} setConvertingDevis={setConvertingDevis}
              convertDevisToFacture={convertDevisToFacture}
            />
          )}

          {/* ────── FACTURES ────── */}
          {activePage === 'factures' && (
            <FacturesSection
              artisan={artisan} services={services} bookings={bookings}
              savedDocuments={savedDocuments} setSavedDocuments={setSavedDocuments}
              showFactureForm={showFactureForm} setShowFactureForm={setShowFactureForm}
              convertingDevis={convertingDevis} setConvertingDevis={setConvertingDevis}
            />
          )}

          {/* ────── STATISTIQUES ────── */}
          {activePage === 'stats' && (
            <StatsRevenusSection artisan={artisan} bookings={bookings} services={services} pendingBookings={pendingBookings} completedBookings={completedBookings} totalRevenue={totalRevenue} activePage="stats" />
          )}

          {/* ────── REVENUS ────── */}
          {activePage === 'revenus' && (
            <StatsRevenusSection artisan={artisan} bookings={bookings} services={services} pendingBookings={pendingBookings} completedBookings={completedBookings} totalRevenue={totalRevenue} activePage="revenus" />
          )}

          {/* ────── PARAMETRES ────── */}
          {activePage === 'settings' && (
            <SettingsSection
              artisan={artisan}
              initials={initials}
              settingsTab={settingsTab}
              setSettingsTab={setSettingsTab}
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
              ALL_MODULES={ALL_MODULES}
              modulesConfig={modulesConfig}
              saveModulesConfig={saveModulesConfig}
              moveModule={moveModule}
            />
          )}

          {/* ────── COMPTABILITÉ ────── */}
          {activePage === 'comptabilite' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro na contabilidade' : 'Erreur dans la comptabilité'}>
              <ComptabiliteSection
                bookings={bookings}
                artisan={artisan}
                services={services}
              />
            </SectionErrorBoundary>
          )}

          {/* ────── MATÉRIAUX & PRIX ────── */}
          {activePage === 'materiaux' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro nos materiais' : 'Erreur dans les matériaux'}>
              <MateriauxSection
                artisan={artisan}
                onExportDevis={(lines: any[]) => {
                  setConvertingDevis({ docType: 'devis', lines })
                  setShowDevisForm(true)
                  setActivePage('devis')
                  setSidebarOpen(false)
                }}
              />
            </SectionErrorBoundary>
          )}



          {/* ────── BOURSE AUX MARCHÉS ────── */}
          {activePage === 'marches' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro na bolsa de mercados' : 'Erreur dans la bourse aux marchés'}>
              <BourseAuxMarchesSection artisan={artisan} navigateTo={navigateTo} />
            </SectionErrorBoundary>
          )}

          {/* ────── WALLET CONFORMITÉ ────── */}
          {activePage === 'wallet' && (
            <div className="animate-fadeIn">
              <div className="bg-white px-6 lg:px-10 h-20 border-b border-[#34495E] flex items-center">
                <div>
                  <h1 className="text-xl font-semibold leading-tight">🗂️ {t('proDash.modules.wallet')}</h1>
                  <p className="text-xs text-gray-400 mt-0.5">{t('proDash.modules.walletDesc')}</p>
                </div>
              </div>
              <WalletConformiteSection artisan={artisan} />
            </div>
          )}

          {/* ────── CARNET DE VISITE / PORTFOLIO ────── */}
          {activePage === 'portfolio' && (
            <div className="animate-fadeIn">
              <div className="bg-white px-6 lg:px-10 h-20 border-b border-[#34495E] flex items-center">
                <div>
                  <h1 className="text-xl font-semibold leading-tight">📸 {t('proDash.modules.portfolio')}</h1>
                  <p className="text-xs text-gray-400 mt-0.5">{t('proDash.modules.portfolioDesc')}</p>
                </div>
              </div>
              <CarnetDeVisiteSection artisan={artisan} />
            </div>
          )}

          {/* ────── BASE CLIENTS ────── */}
          {activePage === 'clients' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro na secção de clientes' : 'Erreur dans la section clients'}>
              <ClientsSection
                artisan={artisan}
                bookings={bookings}
                services={services}
                onNewRdv={(clientName: string) => {
                  setNewRdv({ client_name: clientName, service_id: '', date: '', time: '', address: '', notes: '', phone: '', duration: '' })
                  setShowNewRdv(true)
                  setActivePage('calendar')
                }}
                onNewDevis={(clientName: string) => {
                  setConvertingDevis({ client_name: clientName, docType: 'devis' })
                  setShowDevisForm(true)
                  setActivePage('devis')
                  setSidebarOpen(false)
                }}
              />
            </SectionErrorBoundary>
          )}

          {/* ────── ÉQUIPES (Société BTP) ────── */}
          {activePage === 'equipes' && (
            <EquipesBTPSection artisan={artisan} />
          )}

          {/* ────── CHANTIERS (Société BTP) ────── */}
          {activePage === 'chantiers' && (
            <ChantiersBTPSection artisan={artisan} bookings={bookings} />
          )}

          {/* ────── GANTT (Société BTP) ────── */}
          {activePage === 'gantt' && (
            <div className="p-6 lg:p-8 animate-fadeIn">
              <GanttSection userId={artisan?.id || ''} />
            </div>
          )}

          {/* ────── SITUATIONS DE TRAVAUX (Société BTP) ────── */}
          {activePage === 'situations' && (
            <div className="p-6 lg:p-8 animate-fadeIn">
              <SituationsTravaux userId={artisan?.id || ''} />
            </div>
          )}

          {/* ────── RETENUES DE GARANTIE (Société BTP) ────── */}
          {activePage === 'garanties' && (
            <div className="p-6 lg:p-8 animate-fadeIn">
              <RetenuesGarantieSection userId={artisan?.id || ''} />
            </div>
          )}

          {/* ────── POINTAGE ÉQUIPES (Société BTP) ────── */}
          {activePage === 'pointage' && (
            <div className="p-6 lg:p-8 animate-fadeIn">
              <PointageEquipesSection userId={artisan?.id || ''} />
            </div>
          )}

          {/* ────── SOUS-TRAITANCE DC4 (Société BTP) ────── */}
          {activePage === 'sous_traitance' && (
            <div className="p-6 lg:p-8 animate-fadeIn">
              <SousTraitanceDC4Section userId={artisan?.id || ''} />
            </div>
          )}

          {/* ────── DPGF APPELS D'OFFRES (Société BTP) ────── */}
          {activePage === 'dpgf' && (
            <div className="p-6 lg:p-8 animate-fadeIn">
              <DPGFSection userId={artisan?.id || ''} />
            </div>
          )}

          {/* ────── PROPRIÉTÉS (Conciergerie) ────── */}
          {activePage === 'proprietes' && (
            <ProprietesConciergerieSection artisan={artisan} />
          )}

          {/* ────── ACCÈS & CLÉS (Conciergerie) ────── */}
          {activePage === 'acces' && (
            <AccesConciergerieSection artisan={artisan} />
          )}

          {/* ────── CHANNEL MANAGER (Conciergerie) ────── */}
          {activePage === 'channel_manager' && (
            <div className="p-6 lg:p-8 animate-fadeIn">
              <ChannelManagerSection userId={artisan?.id || ''} />
            </div>
          )}

          {/* ────── TARIFICATION (Conciergerie) ────── */}
          {activePage === 'tarification' && (
            <div className="p-6 lg:p-8 animate-fadeIn">
              <TarificationSection userId={artisan?.id || ''} />
            </div>
          )}

          {/* ────── CHECK-IN / CHECK-OUT (Conciergerie) ────── */}
          {activePage === 'checkinout' && (
            <div className="p-6 lg:p-8 animate-fadeIn">
              <CheckinOutSection userId={artisan?.id || ''} />
            </div>
          )}

          {/* ────── LIVRET D'ACCUEIL (Conciergerie) ────── */}
          {activePage === 'livret' && (
            <div className="p-6 lg:p-8 animate-fadeIn">
              <LivretAccueilSection userId={artisan?.id || ''} />
            </div>
          )}

          {/* ────── PLANNING MÉNAGE (Conciergerie) ────── */}
          {activePage === 'menage' && (
            <div className="p-6 lg:p-8 animate-fadeIn">
              <PlanningMenageSection userId={artisan?.id || ''} />
            </div>
          )}

          {/* ────── REVPAR (Conciergerie) ────── */}
          {activePage === 'revpar' && (
            <div className="p-6 lg:p-8 animate-fadeIn">
              <RevPARSection userId={artisan?.id || ''} />
            </div>
          )}

          {/* ────── IMMEUBLES (Gestionnaire) ────── */}
          {activePage === 'immeubles' && (
            <ImmeublesGestionnaireSection artisan={artisan} />
          )}

          {/* ────── ORDRES DE MISSION (Gestionnaire) ────── */}
          {activePage === 'missions' && (
            <MissionsGestionnaireSection artisan={artisan} bookings={bookings} />
          )}

          {/* ────── CONTRATS ────── */}
          {activePage === 'contrats' && (
            <ContratsSection artisan={artisan} />
          )}

          {/* ────── RAPPORTS D'INTERVENTION ────── */}
          {activePage === 'rapports' && (
            <SectionErrorBoundary fallbackTitle={isPt ? 'Erro nos relatórios' : 'Erreur dans les rapports'}>
              <RapportsSection artisan={artisan} bookings={bookings} services={services} />
            </SectionErrorBoundary>
          )}

          {/* ────── PHOTOS CHANTIER ────── */}
          {activePage === 'photos_chantier' && (
            <PhotosChantierSection artisan={artisan} bookings={bookings} />
          )}

          {/* ────── CANAL PRO ────── */}
          {activePage === 'canal' && (
            <CanalProSection artisan={artisan} orgRole={orgRole} />
          )}

          {/* ────── AIDE ────── */}
          {activePage === 'help' && (
            <div className="animate-fadeIn">
              <div className="bg-white px-6 lg:px-10 h-20 border-b border-[#34495E] flex items-center">
                <div>
                  <h1 className="text-xl font-semibold leading-tight">❓ {t('proDash.help.title')}</h1>
                  <p className="text-xs text-gray-400 mt-0.5">{t('proDash.help.subtitle')}</p>
                </div>
              </div>
              <div className="p-6 lg:p-8 max-w-3xl mx-auto">
                <div className="bg-white p-8 rounded-2xl shadow-sm mb-6">
                  <h2 className="text-xl font-bold mb-4">🚀 {t('proDash.help.quickStart')}</h2>
                  <p className="text-gray-500 mb-4 text-lg">{t('proDash.help.welcome')}</p>
                  <ol className="list-decimal pl-6 text-gray-600 space-y-3 text-lg leading-relaxed">
                    <li>{t('proDash.help.step1')}</li>
                    <li>{t('proDash.help.step2')}</li>
                    <li>{t('proDash.help.step3')}</li>
                    <li>{t('proDash.help.step4')}</li>
                  </ol>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-sm mb-6">
                  <h2 className="text-xl font-bold mb-4">📚 {t('proDash.help.guides')}</h2>
                  <div className="space-y-3">
                    <button onClick={() => { setShowDevisForm(true); setActivePage('devis'); setSidebarOpen(false) }} className="w-full text-left bg-white text-gray-600 border-2 border-gray-200 px-5 py-4 rounded-lg font-semibold hover:bg-gray-50 hover:border-[#FFC107] transition">📄 {t('proDash.help.createQuote')}</button>
                    <button onClick={() => { setShowFactureForm(true); setActivePage('factures'); setSidebarOpen(false) }} className="w-full text-left bg-white text-gray-600 border-2 border-gray-200 px-5 py-4 rounded-lg font-semibold hover:bg-gray-50 hover:border-[#FFC107] transition">🧾 {t('proDash.help.createInvoice')}</button>
                    <button onClick={() => navigateTo('calendar')} className="w-full text-left bg-white text-gray-600 border-2 border-gray-200 px-5 py-4 rounded-lg font-semibold hover:bg-gray-50 hover:border-[#FFC107] transition">📅 {t('proDash.help.configCalendar')}</button>
                    <button onClick={() => navigateTo('motifs')} className="w-full text-left bg-white text-gray-600 border-2 border-gray-200 px-5 py-4 rounded-lg font-semibold hover:bg-gray-50 hover:border-[#FFC107] transition">🔧 {t('proDash.help.manageMotifs')}</button>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-sm">
                  <h2 className="text-xl font-bold mb-4">💬 {t('proDash.help.support')}</h2>
                  <p className="text-gray-500 mb-5 text-lg">{t('proDash.help.supportDesc')}</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl text-center cursor-pointer hover:-translate-y-1 transition-transform">
                      <div className="text-4xl mb-3">📧</div>
                      <div className="font-bold text-lg mb-1">{t('proDash.help.email')}</div>
                      <div className="text-gray-500">support@fixit.fr</div>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl text-center cursor-pointer hover:-translate-y-1 transition-transform">
                      <div className="text-4xl mb-3">💬</div>
                      <div className="font-bold text-lg mb-1">{t('proDash.help.chat')}</div>
                      <div className="text-gray-500">{t('proDash.help.chatHours')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
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
          artisan={artisan}
          bookings={bookings}
          services={services}
          availability={availability}
          dayServices={dayServices}
          absences={absences}
          onCreateRdv={async (data) => {
            const service = data.service_id ? services.find((s: any) => s.id === data.service_id) : services[0]
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
              setBookings([newBooking, ...bookings])
            }
          }}
          onCreateDevis={(data) => {
            setConvertingDevis(data)
            if (data.docType === 'facture') {
              setShowFactureForm(true)
              setActivePage('factures')
            } else {
              setShowDevisForm(true)
              setActivePage('devis')
            }
          }}
          onNavigate={(page) => setActivePage(page)}
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
            } catch {}
            try {
              const absJson = await absRes.json()
              if (absJson.data) setAbsences(absJson.data)
            } catch {}
          }}
        />
      )}

      {/* ── Fullscreen Image Viewer (artisan) ── */}
      {dashMsgFullscreenImg && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setDashMsgFullscreenImg(null)}>
          <Image src={dashMsgFullscreenImg} alt="Photo" width={1200} height={800} className="max-w-full max-h-full object-contain rounded-lg" sizes="100vw" />
          <button onClick={() => setDashMsgFullscreenImg(null)} className="absolute top-4 right-4 text-white text-2xl bg-black/50 rounded-full w-10 h-10 flex items-center justify-center">✕</button>
        </div>
      )}

      {/* ── Modal Messagerie Artisan Dashboard ── */}
      {dashMsgModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDashMsgModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">💬 {t('proDash.msg.title')}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{dashMsgModal.services?.name || 'Service'} &bull; {dashMsgModal.booking_date} à {dashMsgModal.booking_time?.substring(0, 5)}</p>
              </div>
              <button onClick={() => setDashMsgModal(null)} className="text-gray-500 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {dashMsgList.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  {t('proDash.msg.noMessages')}
                </div>
              ) : (
                dashMsgList.map((msg: any) => {
                  const isMe = msg.sender_role === 'artisan'
                  const time = new Date(msg.created_at).toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' })

                  // ── Photo message ──
                  if (msg.type === 'photo' && msg.attachment_url) {
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl p-1.5 ${isMe ? 'bg-[#FFC107]' : 'bg-gray-100'}`}>
                          {!isMe && <div className="text-xs font-semibold text-gray-500 px-2 mb-1">{msg.sender_name || 'Client'}</div>}
                          <img
                            src={msg.attachment_url}
                            alt="Photo"
                            className="rounded-xl max-w-[220px] max-h-[220px] object-cover cursor-pointer"
                            onClick={() => setDashMsgFullscreenImg(msg.attachment_url)}
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
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${isMe ? 'bg-[#FFC107]' : 'bg-gray-100'}`}>
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
                    const m = msg.metadata
                    const isSigned = m.signed === true
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl border-2 overflow-hidden ${isSigned ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
                          <div className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{isSigned ? '✅' : '📄'}</span>
                              <span className="font-bold text-sm text-gray-900">{isSigned ? t('proDash.msg.quotesSigned') : t('proDash.msg.quotesSent')}</span>
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
                    const m = msg.metadata
                    return (
                      <div key={msg.id} className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl border-2 border-green-400 bg-green-50 overflow-hidden">
                          <div className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">✅</span>
                              <span className="font-bold text-sm text-green-800">{t('proDash.msg.clientSigned')}</span>
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
                                className="w-full py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
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
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        isMe
                          ? 'bg-[#FFC107] text-gray-900'
                          : msg.type === 'auto_reply'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
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
                  disabled={dashMsgRecording}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#FFC107] disabled:bg-gray-50"
                />
                {/* Send button */}
                <button
                  onClick={sendDashMessage}
                  disabled={dashMsgSending || !dashMsgText.trim() || dashMsgRecording}
                  className="bg-[#FFC107] hover:bg-amber-500 text-gray-900 px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition flex-shrink-0"
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

function SidebarItem({ icon, label, active, badge, onClick }: {
  icon: string; label: string; active?: boolean; badge?: number; onClick: () => void
}) {
  return (
    <div onClick={onClick}
      className={`flex items-center gap-3 px-6 py-4 cursor-pointer transition-all text-[0.95rem] ${
        active ? 'bg-[#FFC107]/25 border-l-4 border-[#FFC107]' : 'hover:bg-[#FFC107]/15 hover:pl-8'
      }`}>
      <span>{icon}</span>
      <span>{label}</span>
      {badge && badge > 0 && (
        <span className="ml-auto bg-red-500 text-white px-2.5 py-0.5 rounded-full text-xs font-bold">{badge}</span>
      )}
    </div>
  )
}

