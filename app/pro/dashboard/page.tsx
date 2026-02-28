'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import DevisFactureForm from '@/components/DevisFactureForm'
import AiChatBot from '@/components/AiChatBot'
import { DashboardSkeleton } from '@/components/dashboard'
import ComptabiliteSection from '@/components/dashboard/ComptabiliteSection'
import ClientsSection from '@/components/dashboard/ClientsSection'
import MateriauxSection from '@/components/dashboard/MateriauxSection'
import RapportsSection from '@/components/dashboard/RapportsSection'
import CanalProSection from '@/components/dashboard/CanalProSection'

export default function DashboardPage() {
  const router = useRouter()
  const [artisan, setArtisan] = useState<any>(null)
  const [orgRole, setOrgRole] = useState<'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'>('artisan')
  const [orgUser, setOrgUser] = useState<any>(null)
  const [bookings, setBookings] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activePage, setActivePage] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showDevisForm, setShowDevisForm] = useState(false)
  const [showFactureForm, setShowFactureForm] = useState(false)
  const [savedDocuments, setSavedDocuments] = useState<any[]>([])
  const [availability, setAvailability] = useState<any[]>([])
  const [autoAccept, setAutoAccept] = useState(false)
  const [showNewRdv, setShowNewRdv] = useState(false)
  const [newRdv, setNewRdv] = useState({ client_name: '', service_id: '', date: '', time: '', address: '', notes: '', phone: '', duration: '' })
  // ── Absences ──
  const [absences, setAbsences] = useState<any[]>([])
  const [showAbsenceModal, setShowAbsenceModal] = useState(false)
  const [newAbsence, setNewAbsence] = useState({ start_date: '', end_date: '', reason: 'Vacances', label: '' })
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [showBookingDetail, setShowBookingDetail] = useState(false)
  const [convertingDevis, setConvertingDevis] = useState<any>(null)
  const [savingAvail, setSavingAvail] = useState(false)
  // ── Messagerie artisan dashboard ──
  const [dashMsgModal, setDashMsgModal] = useState<any>(null)
  const [dashMsgList, setDashMsgList] = useState<any[]>([])
  const [dashMsgText, setDashMsgText] = useState('')
  const [dashMsgSending, setDashMsgSending] = useState(false)
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

  // ── Modules config (toggle + order) ──
  const ALL_MODULES = [
    { id: 'home', icon: '🏠', label: 'Accueil', category: 'Principal', locked: true },
    { id: 'calendar', icon: '📅', label: 'Agenda', category: 'Principal' },
    { id: 'motifs', icon: '🔧', label: 'Motifs', category: 'Principal' },
    { id: 'horaires', icon: '🕐', label: 'Horaires', category: 'Principal' },
    { id: 'messages', icon: '💬', label: 'Messages Clients', category: 'Communication' },
    { id: 'ordres_mission', icon: '📋', label: 'Ordres de mission', category: 'Communication' },
    { id: 'canal', icon: '📡', label: 'Canal Pro', category: 'Communication' },
    { id: 'clients', icon: '👥', label: 'Clients', category: 'Communication' },
    { id: 'devis', icon: '📄', label: 'Devis', category: 'Facturation' },
    { id: 'factures', icon: '🧾', label: 'Factures', category: 'Facturation' },
    { id: 'rapports', icon: '📋', label: 'Rapports', category: 'Facturation' },
    { id: 'contrats', icon: '📑', label: 'Contrats', category: 'Facturation' },
    { id: 'stats', icon: '📊', label: 'Statistiques', category: 'Analyse' },
    { id: 'revenus', icon: '💰', label: 'Revenus', category: 'Analyse' },
    { id: 'comptabilite', icon: '🧮', label: 'Comptabilité', category: 'Analyse' },
    { id: 'materiaux', icon: '🛒', label: 'Matériaux', category: 'Analyse' },
    { id: 'wallet', icon: '🗂️', label: 'Wallet Conformité', category: 'Profil Pro' },
    { id: 'portfolio', icon: '📸', label: 'Carnet de Visite', category: 'Profil Pro' },
    { id: 'settings', icon: '⚙️', label: 'Paramètres', category: 'Compte', locked: true },
  ]

  const MODULES_STORAGE_KEY = `fixit_modules_config_${artisan?.id || 'default'}`

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
  const [kbisFile, setKbisFile] = useState<File | null>(null)
  const [kbisUploading, setKbisUploading] = useState(false)
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null)
  const [insuranceUploading, setInsuranceUploading] = useState(false)
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
      // Only reload data if initAuth hasn't already loaded it
      if (!didLoad && event === 'INITIAL_SESSION' && session?.user) {
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
      setOrgUser(user)
    }

    const { data: artisanData } = await supabase
      .from('profiles_artisan').select('*').eq('user_id', user.id).single()
    // Mode admin override : pas besoin de profil artisan réel
    if (!artisanData && !user.user_metadata?._admin_override) { router.push('/pro/login'); return }
    if (!artisanData) {
      // Données factices pour la navigation admin
      setArtisan({ id: user.id, company_name: 'Admin Vitfix', email: user.email, phone: '', bio: '', user_id: user.id })
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

    const { data: bookingsData } = await supabase
      .from('bookings').select('*, services(name)')
      .eq('artisan_id', artisanData.id)
      .order('booking_date', { ascending: false }).limit(20)
    setBookings(bookingsData || [])

    const { data: servicesData } = await supabase
      .from('services').select('*').eq('artisan_id', artisanData.id)
    setServices(servicesData || [])

    // Load availability via API route (bypasses RLS with service_role key)
    try {
      const availRes = await fetch(`/api/availability?artisan_id=${artisanData.id}`)
      const availJson = await availRes.json()
      setAvailability(availJson.data || [])
    } catch {
      setAvailability([])
    }

    // Load absences
    try {
      const absRes = await fetch(`/api/artisan-absences?artisan_id=${artisanData.id}`)
      const absJson = await absRes.json()
      setAbsences(absJson.data || [])
    } catch { setAbsences([]) }

    // Load dayServices from API (stored in bio marker, shared with client)
    try {
      const dsRes = await fetch(`/api/availability-services?artisan_id=${artisanData.id}`)
      const dsJson = await dsRes.json()
      if (dsJson.data) setDayServices(dsJson.data)
    } catch {
      // Fallback localStorage
      const savedDayServices = localStorage.getItem(`fixit_availability_services_${artisanData.id}`)
      if (savedDayServices) setDayServices(JSON.parse(savedDayServices))
    }

    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
    setSavedDocuments([...docs, ...drafts])

    setLoading(false)
  }

  const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artisan_id: artisan.id, dayServices: newDayServices })
        })
        const result = await res.json()
        if (result.bio) setArtisan({ ...artisan, bio: result.bio })
      } catch (e) {
        console.error('DayService save error:', e)
      }
    }
  }

  const getDayServiceCount = (dayOfWeek: number) => {
    return (dayServices[String(dayOfWeek)] || []).length
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
    const serviceName = booking.services?.name || 'Prestation'
    const priceHT = booking.price_ht || 0
    // Extract client name from notes if stored as "Client: X."
    let clientName = ''
    const notesStr = booking.notes || ''
    const clientMatch = notesStr.match(/Client:\s*([^.]+)/i)
    if (clientMatch) clientName = clientMatch[1].trim()

    const lines = priceHT > 0
      ? [{ id: 1, description: serviceName, qty: 1, unit: 'u', priceHT, tvaRate: 10, totalHT: priceHT }]
      : [{ id: 1, description: serviceName, qty: 1, unit: 'u', priceHT: 0, tvaRate: 10, totalHT: 0 }]

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
      setNewAbsence({ start_date: '', end_date: '', reason: 'Vacances', label: '' })
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

  const getCalendarTitle = () => {
    if (calendarView === 'day') {
      const d = new Date(selectedDay)
      return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }
    if (calendarView === 'month') {
      const [y, m] = selectedMonth.split('-').map(Number)
      const d = new Date(y, m - 1, 1)
      return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    }
    // week
    const dates = getWeekDates()
    const start = dates[0]
    const end = dates[6]
    return `Semaine du ${start.getDate()} au ${end.getDate()} ${end.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
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
    if (match) return { unit: match[1], min: parseFloat(match[2]), max: parseFloat(match[3]) }
    // Fallback : ancien format
    const unit = desc.includes('[m²]') ? 'm2' : desc.includes('[heure]') ? 'heure' : desc.includes('[unité]') ? 'unite' : 'forfait'
    return { unit, min: service.price_ht || 0, max: service.price_ttc || 0 }
  }

  const getPriceRangeLabel = (service: any): string => {
    const { min, max, unit } = parseServiceRange(service)
    if (min === 0 && max === 0) return 'Sur devis'
    const suffix: Record<string, string> = { m2: '€/m²', ml: '€/ml', m3: '€/m³', arbre: '€/arbre', tonne: '€/t', heure: '€/h', forfait: '€', unite: '€/u' }
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
    if (!confirm('Supprimer ce motif définitivement ?')) return
    await supabase.from('services').delete().eq('id', serviceId)
    setServices(services.filter((s) => s.id !== serviceId))
  }

  const getPricingUnit = (service: any) => {
    const { unit } = parseServiceRange(service)
    const labels: Record<string, string> = { m2: '/m²', ml: '/ml', m3: '/m³', arbre: '/arbre', tonne: '/t', heure: '/h', forfait: 'forfait', unite: '/unité' }
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
      if (!token) { alert('❌ Session expirée, veuillez vous reconnecter.'); setSavingSettings(false); return }

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
      if (!res.ok) { alert(`❌ Erreur : ${json.error || 'Impossible de sauvegarder'}`); setSavingSettings(false); return }

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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artisan_id: artisan.id, dayServices })
          })
        } catch {}
      }
      if (json.partial && json.warning) {
        alert(`⚠️ Sauvegarde partielle : ${json.warning}`)
      } else {
        alert('✅ Profil mis à jour avec succès !')
      }
    } catch {
      alert('❌ Erreur réseau, veuillez réessayer.')
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
      setUploadMsg({ type: 'success', text: '✅ Document mis à jour avec succès !' })
    } catch (err: any) {
      setUploadMsg({ type: 'error', text: `❌ ${err.message}` })
    } finally {
      setUploading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

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

  const isAdminOverride = artisan?.user_id && (supabase.auth as any)._currentSession?.user?.user_metadata?._admin_override

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" }}>

      {/* ── BOUTON RETOUR ADMIN (mode override) ── */}
      {orgRole && (
        <div className="fixed top-3 right-3 z-[9999]" id="admin-back-btn" style={{ display: 'none' }}>
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
      <script dangerouslySetInnerHTML={{ __html: `
        (async function() {
          // Vérifier si mode admin override
          const session = JSON.parse(localStorage.getItem('sb-irluhepekbqgquveaett-auth-token') || '{}')
          const meta = session?.user?.user_metadata || {}
          if (meta._admin_override) {
            const btn = document.getElementById('admin-back-btn')
            if (btn) btn.style.display = 'block'
          }
        })()
      `}} />

      {/* ══════════ TOP BAR ══════════ */}
      <div className="bg-white border-b-2 border-[#FFC107] px-4 lg:px-6 py-3 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <button className="lg:hidden text-2xl" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <div className="text-2xl font-bold text-[#FFC107] cursor-pointer hover:scale-105 transition-transform" onClick={() => navigateTo('home')}>
            VITFIX
          </div>
        </div>
        <div className="flex items-center gap-4 lg:gap-6">
          <div className="relative cursor-pointer text-xl hover:scale-110 transition-transform" onClick={() => navigateTo('messages')}>
            🔔
            {pendingBookings.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-[18px] h-[18px] flex items-center justify-center text-[0.7rem] font-bold">{pendingBookings.length}</span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[#F8F9FA] transition" onClick={() => navigateTo('settings')}>
            <div>
              <div className="font-semibold text-sm">{artisan?.company_name}</div>
              <div className="text-xs text-gray-500">Paysagiste Pro</div>
            </div>
            <div className="w-[42px] h-[42px] rounded-full bg-gradient-to-br from-[#FFC107] to-[#FFD54F] flex items-center justify-center text-white font-bold shadow-md">
              {initials}
            </div>
          </div>
          <span className="bg-gradient-to-r from-[#FFC107] to-[#FFD54F] text-gray-900 px-3 py-1 rounded-full text-xs font-bold shadow-md">
            PRO
          </span>
        </div>
      </div>

      {/* ══════════ MAIN LAYOUT ══════════ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ══════════ SIDEBAR ══════════ */}
        <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static z-40 w-[250px] bg-[#2C3E50] text-white h-full overflow-y-auto transition-transform duration-300`}>
          <div className="mb-6 pt-6">
            <div className="px-6 text-[0.7rem] uppercase text-[#95A5A6] mb-3 font-semibold tracking-widest">Principal</div>
            <SidebarItem icon="🏠" label="Accueil" active={activePage === 'home'} onClick={() => navigateTo('home')} />
            {orgRole === 'artisan' && <>
              <SidebarItem icon="📅" label="Agenda" active={activePage === 'calendar'} onClick={() => navigateTo('calendar')} />
              <SidebarItem icon="🔧" label="Motifs" active={activePage === 'motifs'} onClick={() => navigateTo('motifs')} />
              <SidebarItem icon="🕐" label="Horaires" active={activePage === 'horaires'} onClick={() => navigateTo('horaires')} />
            </>}
            {orgRole === 'pro_societe' && <>
              <SidebarItem icon="👷" label="Équipes" active={activePage === 'equipes'} onClick={() => navigateTo('equipes')} />
              <SidebarItem icon="📋" label="Chantiers" active={activePage === 'chantiers'} onClick={() => navigateTo('chantiers')} />
              <SidebarItem icon="📅" label="Planning" active={activePage === 'calendar'} onClick={() => navigateTo('calendar')} />
              <SidebarItem icon="📅" label="Planning Gantt" active={activePage === 'gantt'} onClick={() => navigateTo('gantt')} />
              <SidebarItem icon="📊" label="Situations Travaux" active={activePage === 'situations'} onClick={() => navigateTo('situations')} />
              <SidebarItem icon="🔒" label="Retenues Garantie" active={activePage === 'garanties'} onClick={() => navigateTo('garanties')} />
              <SidebarItem icon="⏱️" label="Pointage Équipes" active={activePage === 'pointage'} onClick={() => navigateTo('pointage')} />
              <SidebarItem icon="🤝" label="Sous-traitance DC4" active={activePage === 'sous_traitance'} onClick={() => navigateTo('sous_traitance')} />
              <SidebarItem icon="📋" label="Appels d'offres" active={activePage === 'dpgf'} onClick={() => navigateTo('dpgf')} />
            </>}
            {orgRole === 'pro_conciergerie' && <>
              <SidebarItem icon="🏠" label="Propriétés" active={activePage === 'proprietes'} onClick={() => navigateTo('proprietes')} />
              <SidebarItem icon="📅" label="Planning" active={activePage === 'calendar'} onClick={() => navigateTo('calendar')} />
              <SidebarItem icon="🔑" label="Accès & clés" active={activePage === 'acces'} onClick={() => navigateTo('acces')} />
              <SidebarItem icon="🌐" label="Channel Manager" active={activePage === 'channel_manager'} onClick={() => navigateTo('channel_manager')} />
              <SidebarItem icon="💰" label="Tarification" active={activePage === 'tarification'} onClick={() => navigateTo('tarification')} />
              <SidebarItem icon="✅" label="Check-in / Check-out" active={activePage === 'checkinout'} onClick={() => navigateTo('checkinout')} />
              <SidebarItem icon="📖" label="Livret d'accueil" active={activePage === 'livret'} onClick={() => navigateTo('livret')} />
              <SidebarItem icon="🧹" label="Planning ménage" active={activePage === 'menage'} onClick={() => navigateTo('menage')} />
              <SidebarItem icon="📈" label="Reporting RevPAR" active={activePage === 'revpar'} onClick={() => navigateTo('revpar')} />
            </>}
            {orgRole === 'pro_gestionnaire' && <>
              <SidebarItem icon="🏢" label="Immeubles" active={activePage === 'immeubles'} onClick={() => navigateTo('immeubles')} />
              <SidebarItem icon="📋" label="Ordres de mission" active={activePage === 'missions'} onClick={() => navigateTo('missions')} />
              <SidebarItem icon="📅" label="Planning" active={activePage === 'calendar'} onClick={() => navigateTo('calendar')} />
            </>}
          </div>
          <div className="mb-6">
            <div className="px-6 text-[0.7rem] uppercase text-[#95A5A6] mb-3 font-semibold tracking-widest">Communication</div>
            {(isModuleEnabled('messages') || isModuleEnabled('canal')) && <SidebarItem icon="💬" label="Messagerie" active={activePage === 'messages' || activePage === 'comm_pro'} badge={pendingBookings.length || undefined} onClick={() => navigateTo('messages')} />}
            {isModuleEnabled('clients') && <SidebarItem icon="👥" label="Base clients" active={activePage === 'clients'} onClick={() => navigateTo('clients')} />}
          </div>
          <div className="mb-6">
            <div className="px-6 text-[0.7rem] uppercase text-[#95A5A6] mb-3 font-semibold tracking-widest">Facturation</div>
            {isModuleEnabled('devis') && <SidebarItem icon="📄" label="Devis" active={activePage === 'devis'} onClick={() => navigateTo('devis')} />}
            {isModuleEnabled('factures') && <SidebarItem icon="🧾" label="Factures" active={activePage === 'factures'} onClick={() => navigateTo('factures')} />}
            {isModuleEnabled('rapports') && <SidebarItem icon="📋" label="Rapports" active={activePage === 'rapports'} onClick={() => navigateTo('rapports')} />}
            {isModuleEnabled('contrats') && (orgRole === 'pro_societe' || orgRole === 'pro_gestionnaire') && (
              <SidebarItem icon="📑" label="Contrats" active={activePage === 'contrats'} onClick={() => navigateTo('contrats')} />
            )}
          </div>
          <div className="mb-6">
            <div className="px-6 text-[0.7rem] uppercase text-[#95A5A6] mb-3 font-semibold tracking-widest">Analyse</div>
            {isModuleEnabled('stats') && <SidebarItem icon="📊" label="Statistiques" active={activePage === 'stats'} onClick={() => navigateTo('stats')} />}
            {isModuleEnabled('revenus') && <SidebarItem icon="💰" label="Revenus" active={activePage === 'revenus'} onClick={() => navigateTo('revenus')} />}
            {isModuleEnabled('comptabilite') && <SidebarItem icon="🧮" label="Comptabilité" active={activePage === 'comptabilite'} onClick={() => navigateTo('comptabilite')} />}
            {isModuleEnabled('materiaux') && orgRole === 'artisan' && (
              <SidebarItem icon="🛒" label="Matériaux" active={activePage === 'materiaux'} onClick={() => navigateTo('materiaux')} />
            )}
          </div>
          {orgRole === 'artisan' && (isModuleEnabled('wallet') || isModuleEnabled('portfolio')) && (
            <div className="mb-6">
              <div className="px-6 text-[0.7rem] uppercase text-[#95A5A6] mb-3 font-semibold tracking-widest">Profil Pro</div>
              {isModuleEnabled('wallet') && <SidebarItem icon="🗂️" label="Wallet Conformité" active={activePage === 'wallet'} onClick={() => navigateTo('wallet')} />}
              {isModuleEnabled('portfolio') && <SidebarItem icon="📸" label="Carnet de Visite" active={activePage === 'portfolio'} onClick={() => navigateTo('portfolio')} />}
            </div>
          )}
          <div className="mb-6">
            <div className="px-6 text-[0.7rem] uppercase text-[#95A5A6] mb-3 font-semibold tracking-widest">Compte</div>
            <SidebarItem icon="⚙️" label="Paramètres" active={activePage === 'settings' && settingsTab !== 'modules'} onClick={() => { navigateTo('settings'); setSettingsTab('profil') }} />
            <SidebarItem icon="🧩" label="Modules" active={activePage === 'settings' && settingsTab === 'modules'} onClick={() => { navigateTo('settings'); setSettingsTab('modules') }} />
            <SidebarItem icon="❓" label="Aide" active={activePage === 'help'} onClick={() => navigateTo('help')} />
            <div onClick={handleLogout} className="flex items-center gap-3 px-6 py-4 cursor-pointer text-red-400 hover:bg-red-500/10 hover:pl-8 transition-all text-[0.95rem]">
              <span>🚪</span><span>Déconnexion</span>
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
            <div className="p-6 lg:p-8 animate-fadeIn">
              {/* ── Bannière adaptative ── */}
              {orgRole === 'artisan' && (
                <div className="bg-gradient-to-r from-[#FFC107] to-[#FFD54F] p-6 lg:p-8 rounded-2xl text-gray-900 mb-8 shadow-lg">
                  <h1 className="text-3xl lg:text-4xl font-bold mb-2">👋 Bonjour {firstName} !</h1>
                  <p className="text-lg opacity-95">Vous avez {pendingBookings.length} intervention(s) en attente</p>
                </div>
              )}
              {orgRole === 'pro_societe' && (
                <div className="bg-gradient-to-r from-blue-600 to-blue-400 p-6 lg:p-8 rounded-2xl text-white mb-8 shadow-lg">
                  <h1 className="text-3xl lg:text-4xl font-bold mb-2">🏗️ Bonjour {firstName} !</h1>
                  <p className="text-lg opacity-95">Tableau de bord Société BTP — {pendingBookings.length} chantier(s) en attente</p>
                </div>
              )}
              {orgRole === 'pro_conciergerie' && (
                <div className="bg-gradient-to-r from-purple-600 to-purple-400 p-6 lg:p-8 rounded-2xl text-white mb-8 shadow-lg">
                  <h1 className="text-3xl lg:text-4xl font-bold mb-2">🗝️ Bonjour {firstName} !</h1>
                  <p className="text-lg opacity-95">Conciergerie — {pendingBookings.length} demande(s) en attente</p>
                </div>
              )}
              {orgRole === 'pro_gestionnaire' && (
                <div className="bg-gradient-to-r from-green-600 to-green-400 p-6 lg:p-8 rounded-2xl text-white mb-8 shadow-lg">
                  <h1 className="text-3xl lg:text-4xl font-bold mb-2">🏢 Bonjour {firstName} !</h1>
                  <p className="text-lg opacity-95">Gestionnaire d'immeubles — {pendingBookings.length} ordre(s) de mission en attente</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                <StatCard icon="📅" iconBg="bg-blue-50" iconColor="text-blue-500" value={bookings.length.toString()} label={orgRole === 'pro_societe' ? 'Chantiers ce mois' : orgRole === 'pro_gestionnaire' ? 'Ordres de mission' : 'Interventions ce mois'} change={`${pendingBookings.length} en attente`} positive onClick={() => navigateTo('calendar')} />
                <StatCard icon="💰" iconBg="bg-green-50" iconColor="text-green-500" value={formatPrice(totalRevenue)} label="Chiffre d'affaires" change={`${completedBookings.length} terminées`} positive onClick={() => navigateTo('revenus')} />
                <StatCard icon="🔧" iconBg="bg-amber-50" iconColor="text-orange-500" value={services.filter(s => s.active).length.toString()} label={orgRole === 'pro_societe' ? 'Équipes actives' : orgRole === 'pro_gestionnaire' ? 'Immeubles gérés' : 'Motifs actifs'} change={`${services.length} au total`} onClick={() => navigateTo(orgRole === 'pro_societe' ? 'equipes' : orgRole === 'pro_gestionnaire' ? 'immeubles' : 'motifs')} />
                <StatCard icon="⭐" iconBg="bg-pink-50" iconColor="text-pink-500" value={`${artisan?.rating_avg || '5.0'}/5`} label="Note moyenne" change={`${artisan?.rating_count || 0} avis`} positive onClick={() => navigateTo('stats')} />
              </div>

              <h2 className="text-xl font-bold mb-4">Actions rapides</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {orgRole === 'artisan' && <>
                  <QuickAction icon="📅" label="Nouvel RDV" onClick={() => { setShowNewRdv(true); navigateTo('calendar') }} />
                  <QuickAction icon="📄" label="Créer devis" onClick={() => { setShowDevisForm(true); setActivePage('devis'); setSidebarOpen(false) }} />
                  <QuickAction icon="🧾" label="Nouvelle facture" onClick={() => { setShowFactureForm(true); setActivePage('factures'); setSidebarOpen(false) }} />
                  <QuickAction icon="🔧" label="Nouveau motif" onClick={() => { openNewMotif(); navigateTo('motifs') }} />
                </>}
                {orgRole === 'pro_societe' && <>
                  <QuickAction icon="👷" label="Nouvelle équipe" onClick={() => navigateTo('equipes')} />
                  <QuickAction icon="📋" label="Nouveau chantier" onClick={() => navigateTo('chantiers')} />
                  <QuickAction icon="📄" label="Créer devis" onClick={() => { setShowDevisForm(true); setActivePage('devis'); setSidebarOpen(false) }} />
                  <QuickAction icon="🧾" label="Nouvelle facture" onClick={() => { setShowFactureForm(true); setActivePage('factures'); setSidebarOpen(false) }} />
                </>}
                {orgRole === 'pro_conciergerie' && <>
                  <QuickAction icon="🏠" label="Nouvelle propriété" onClick={() => navigateTo('proprietes')} />
                  <QuickAction icon="📅" label="Planifier visite" onClick={() => { setShowNewRdv(true); navigateTo('calendar') }} />
                  <QuickAction icon="📄" label="Créer devis" onClick={() => { setShowDevisForm(true); setActivePage('devis'); setSidebarOpen(false) }} />
                  <QuickAction icon="🔑" label="Gérer accès" onClick={() => navigateTo('acces')} />
                </>}
                {orgRole === 'pro_gestionnaire' && <>
                  <QuickAction icon="📋" label="Ordre de mission" onClick={() => navigateTo('missions')} />
                  <QuickAction icon="🏢" label="Gérer immeuble" onClick={() => navigateTo('immeubles')} />
                  <QuickAction icon="📄" label="Créer devis" onClick={() => { setShowDevisForm(true); setActivePage('devis'); setSidebarOpen(false) }} />
                  <QuickAction icon="🧾" label="Nouvelle facture" onClick={() => { setShowFactureForm(true); setActivePage('factures'); setSidebarOpen(false) }} />
                </>}
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-5">Activité récente</h2>
                {bookings.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">Aucune activité récente</p>
                ) : (
                  bookings.slice(0, 5).map((b) => (
                    <ActivityItem
                      key={b.id}
                      icon={b.status === 'completed' ? '✓' : b.status === 'confirmed' ? '📅' : b.status === 'pending' ? '⏳' : '✕'}
                      iconBg={b.status === 'completed' ? 'bg-green-50' : b.status === 'confirmed' ? 'bg-blue-50' : b.status === 'pending' ? 'bg-amber-50' : 'bg-red-50'}
                      iconColor={b.status === 'completed' ? 'text-green-500' : b.status === 'confirmed' ? 'text-blue-500' : b.status === 'pending' ? 'text-orange-500' : 'text-red-500'}
                      title={`${b.services?.name || 'RDV'} - ${b.status === 'completed' ? 'Terminé' : b.status === 'confirmed' ? 'Confirmé' : b.status === 'pending' ? 'En attente' : 'Annulé'}`}
                      time={`${b.booking_date} à ${b.booking_time?.substring(0, 5) || '?'}`}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* ────── AGENDA ────── */}
          {activePage === 'calendar' && (
            <div className="animate-fadeIn">
              <PageHeader title="📅 Agenda" actionLabel="+ Nouveau RDV" onAction={() => setShowNewRdv(true)} />
              <div className="p-6 lg:p-8">

                {/* Stats cards row */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-400">
                    <div className="text-sm text-gray-600 mb-1">RDV aujourd&apos;hui</div>
                    <div className="text-2xl font-bold text-gray-900">{getBookingsForDate(new Date()).length}</div>
                    <div className="text-xs text-green-600 font-semibold mt-1">{getBookingsForDate(new Date()).filter(b => b.status === 'confirmed').length} confirm&eacute;(s)</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-[#FFC107]">
                    <div className="text-sm text-gray-600 mb-1">Taux de remplissage</div>
                    <div className="text-2xl font-bold text-gray-900">{bookings.length > 0 ? Math.round((bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length / bookings.length) * 100) : 0}%</div>
                    <div className="text-xs text-blue-600 font-semibold mt-1">cette semaine</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-400">
                    <div className="text-sm text-gray-600 mb-1">Revenus du mois</div>
                    <div className="text-2xl font-bold text-gray-900">{formatPrice(totalRevenue)}</div>
                    <div className="text-xs text-green-600 font-semibold mt-1">{completedBookings.length} termin&eacute;e(s)</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-amber-400">
                    <div className="text-sm text-gray-600 mb-1">Note moyenne</div>
                    <div className="text-2xl font-bold text-gray-900">{artisan?.rating_avg || '5.0'}/5</div>
                    <div className="text-xs text-amber-600 font-semibold mt-1">{artisan?.rating_count || 0} avis</div>
                  </div>
                </div>

                {/* Calendar header */}
                <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => navigateCalendar(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition text-lg">◀</button>
                      <h3 className="font-bold text-lg capitalize">{getCalendarTitle()}</h3>
                      <button onClick={() => navigateCalendar(1)} className="p-2 hover:bg-gray-100 rounded-lg transition text-lg">▶</button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex bg-gray-100 rounded-lg overflow-hidden">
                        {(['day', 'week', 'month'] as const).map((v) => (
                          <button key={v} onClick={() => setCalendarView(v)}
                            className={`px-3 py-1.5 text-sm transition ${calendarView === v ? 'bg-[#FFC107] text-gray-900 font-semibold' : 'text-gray-500 hover:bg-gray-200'}`}>
                            {v === 'day' ? 'Jour' : v === 'week' ? 'Semaine' : 'Mois'}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setShowAbsenceModal(true)} className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-1.5 rounded-lg font-semibold text-sm transition-all">
                        Absence
                      </button>
                      <button onClick={() => setShowNewRdv(true)} className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-4 py-1.5 rounded-lg font-semibold text-sm shadow-sm transition-all">
                        + Nouveau rendez-vous
                      </button>
                    </div>
                  </div>

                  {/* ═══ VUE JOUR ═══ */}
                  {calendarView === 'day' && (() => {
                    const dayDate = new Date(selectedDay)
                    const dayBookings = getBookingsForDate(dayDate)
                    const absenceInfo = isDateAbsent(dayDate)
                    return (
                      <div>
                        <div className="p-3 text-center border-b border-gray-200 bg-gray-50">
                          <div className={`text-sm uppercase tracking-wide ${dayDate.toDateString() === new Date().toDateString() ? 'text-[#FFC107] font-bold' : 'text-gray-500'}`}>
                            {DAY_NAMES[dayDate.getDay()]}
                          </div>
                          <div className={`text-2xl font-bold mt-0.5 ${dayDate.toDateString() === new Date().toDateString() ? 'bg-[#FFC107] text-white w-10 h-10 rounded-full flex items-center justify-center mx-auto' : 'text-gray-800'}`}>
                            {dayDate.getDate()}
                          </div>
                        </div>
                        {absenceInfo.absent && (
                          <div className={`p-4 border-l-4 ${absenceInfo.source === 'devis' ? 'bg-red-200 border-red-600' : 'bg-red-100 border-red-400'} flex items-center justify-between`}>
                            <div>
                              <div className="font-bold text-red-800 text-sm">{absenceInfo.source === 'devis' ? `🔧 ${absenceInfo.label}` : `🚫 Absent — ${absenceInfo.reason}`}</div>
                              {absenceInfo.source === 'devis' && <div className="text-xs text-red-600">{absenceInfo.reason}</div>}
                            </div>
                            <button onClick={() => deleteAbsence(absenceInfo.id)} className="text-red-400 hover:text-red-600 text-xs">Supprimer</button>
                          </div>
                        )}
                        {getCalendarHours().map((hour) => {
                          const hourBookings = dayBookings.filter((b) => b.booking_time?.substring(0, 5) === hour)
                          const isEmpty = hourBookings.length === 0
                          return (
                            <div key={hour} className="grid grid-cols-[70px_1fr] border-b border-gray-100 last:border-b-0">
                              <div className="p-2 text-right pr-3 text-xs text-gray-500 font-medium border-r border-gray-100 flex items-start justify-end pt-1">
                                {hour}
                              </div>
                              <div
                                onClick={() => isEmpty && handleEmptyCellClick(dayDate, hour)}
                                className={`min-h-[70px] p-2 transition-colors group relative ${isEmpty ? 'cursor-pointer hover:bg-[#FFF9E6]' : ''}`}
                              >
                                {isEmpty && (
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[#FFC107] text-xl font-bold">+</span>
                                  </div>
                                )}
                                {hourBookings.map((b) => {
                                  const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'
                                  const motif = b.services?.name || 'RDV'
                                  const statusColors = b.status === 'confirmed' ? 'bg-[#E8F5E9] border-l-4 border-[#4CAF50]' : b.status === 'pending' ? 'bg-[#FFF3E0] border-l-4 border-[#FF9800]' : b.status === 'completed' ? 'bg-[#E3F2FD] border-l-4 border-[#2196F3]' : 'bg-red-50 border-l-4 border-red-400'
                                  return (
                                    <div key={b.id} onClick={() => handleBookingClick(b)}
                                      className={`${statusColors} rounded-r-lg p-3 mb-1 cursor-pointer hover:shadow-md transition-all flex items-center gap-3`}>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm">{clientName}</div>
                                        <div className="text-xs text-gray-600">{motif}</div>
                                      </div>
                                      <div className="text-right text-xs text-gray-500 shrink-0">
                                        <div>{b.booking_time?.substring(0, 5)}</div>
                                        {b.duration_minutes && <div>{b.duration_minutes} min</div>}
                                      </div>
                                      {b.price_ttc && <div className="font-bold text-sm text-green-700 shrink-0">{formatPrice(b.price_ttc)}</div>}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}

                  {/* ═══ VUE SEMAINE ═══ */}
                  {calendarView === 'week' && (() => {
                    const weekDates = getWorkingWeekDates()
                    const colCount = weekDates.length
                    return (
                    <div className="overflow-x-auto">
                      <div className="min-w-[800px]">
                        {/* Day headers */}
                        <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: `70px repeat(${colCount}, 1fr)` }}>
                          <div className="p-2 text-center text-xs text-gray-500 border-r border-gray-100"></div>
                          {weekDates.map((date, i) => {
                            const isToday = date.toDateString() === new Date().toDateString()
                            const absenceInfo = isDateAbsent(date)
                            return (
                              <div key={i} onClick={() => { setSelectedDay(date.toISOString().split('T')[0]); setCalendarView('day') }}
                                className={`p-3 text-center border-r border-gray-100 last:border-r-0 cursor-pointer hover:bg-amber-50 transition ${absenceInfo.absent ? 'bg-red-50' : ''}`}>
                                <div className={`text-xs uppercase tracking-wide ${isToday ? 'text-[#FFC107] font-bold' : absenceInfo.absent ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                                  {DAY_SHORT[date.getDay()]}
                                </div>
                                <div className={`text-lg font-bold mt-0.5 ${isToday ? 'bg-[#FFC107] text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto' : absenceInfo.absent ? 'text-red-600' : 'text-gray-800'}`}>
                                  {date.getDate()}
                                </div>
                                {absenceInfo.absent && (
                                  <div className="text-[9px] text-red-500 font-semibold truncate mt-0.5">{absenceInfo.source === 'devis' ? `🔧 ${absenceInfo.label}` : `🚫 ${absenceInfo.reason}`}</div>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Time grid rows */}
                        {getCalendarHours().map((hour) => (
                          <div key={hour} className="grid border-b border-gray-100 last:border-b-0" style={{ gridTemplateColumns: `70px repeat(${colCount}, 1fr)` }}>
                            <div className="p-2 text-right pr-3 text-xs text-gray-500 font-medium border-r border-gray-100 flex items-start justify-end pt-1">
                              {hour}
                            </div>
                            {weekDates.map((date, i) => {
                              const absenceInfo = isDateAbsent(date)
                              const dayBookings = getBookingsForDate(date)
                              const hourBookings = dayBookings.filter((b) => b.booking_time?.substring(0, 5) === hour)
                              const isEmpty = hourBookings.length === 0
                              if (absenceInfo.absent) {
                                return (
                                  <div key={i} className={`min-h-[70px] border-r border-gray-100 last:border-r-0 p-1 ${absenceInfo.source === 'devis' ? 'bg-red-100' : 'bg-red-50'}`}>
                                    {hour === getCalendarHours()[0] && (
                                      <div className={`text-[10px] font-semibold px-1 py-0.5 rounded ${absenceInfo.source === 'devis' ? 'text-red-800 bg-red-200' : 'text-red-600 bg-red-100'}`}>
                                        {absenceInfo.source === 'devis' ? `🔧 ${absenceInfo.label}` : `🚫 ${absenceInfo.reason}`}
                                      </div>
                                    )}
                                  </div>
                                )
                              }
                              return (
                                <div
                                  key={i}
                                  onClick={() => isEmpty && handleEmptyCellClick(date, hour)}
                                  className={`min-h-[70px] border-r border-gray-100 last:border-r-0 p-1 transition-colors group relative ${isEmpty ? 'cursor-pointer hover:bg-[#FFF9E6]' : ''}`}
                                >
                                  {isEmpty && (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <span className="text-[#FFC107] text-xl font-bold">+</span>
                                    </div>
                                  )}
                                  {hourBookings.map((b) => {
                                    const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'
                                    const motif = b.services?.name || 'RDV'
                                    const statusColors = b.status === 'confirmed' ? 'bg-[#E8F5E9] border-l-4 border-[#4CAF50]' : b.status === 'pending' ? 'bg-[#FFF3E0] border-l-4 border-[#FF9800]' : b.status === 'completed' ? 'bg-[#E3F2FD] border-l-4 border-[#2196F3]' : 'bg-red-50 border-l-4 border-red-400'
                                    return (
                                      <div key={b.id} onClick={(e) => { e.stopPropagation(); handleBookingClick(b) }} className={`${statusColors} rounded-r-lg p-1.5 mb-1 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all overflow-hidden max-h-[62px]`}>
                                        <div className="font-semibold text-xs truncate">{clientName}</div>
                                        <div className="text-xs text-gray-600 truncate">{motif}</div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                    )
                  })()}

                  {/* ═══ VUE MOIS ═══ */}
                  {calendarView === 'month' && (() => {
                    const { days, firstDay, lastDay } = getMonthDays()
                    const currentMonth = firstDay.getMonth()
                    return (
                      <div>
                        {/* Day name headers */}
                        <div className="grid grid-cols-7 border-b border-gray-200">
                          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                            <div key={d} className="p-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              {d}
                            </div>
                          ))}
                        </div>
                        {/* Day cells - 6 rows */}
                        {Array.from({ length: 6 }, (_, weekIdx) => (
                          <div key={weekIdx} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
                            {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((date, i) => {
                              const isCurrentMonth = date.getMonth() === currentMonth
                              const isToday = date.toDateString() === new Date().toDateString()
                              const isWeekend = date.getDay() === 0 || date.getDay() === 6
                              const dayBookings = getBookingsForDate(date)
                              const absenceInfo = isDateAbsent(date)
                              return (
                                <div key={i}
                                  onClick={() => { setSelectedDay(date.toISOString().split('T')[0]); setCalendarView('day') }}
                                  className={`min-h-[90px] p-1.5 border-r border-gray-100 last:border-r-0 cursor-pointer transition group
                                    ${absenceInfo.absent ? (absenceInfo.source === 'devis' ? 'bg-red-100' : 'bg-red-50') : !isCurrentMonth ? 'bg-gray-50/50' : isWeekend ? 'bg-[#FAFAFA]' : 'bg-white'}
                                    hover:bg-[#FFF9E6]`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full
                                      ${isToday ? 'bg-[#FFC107] text-white' : absenceInfo.absent ? 'bg-red-500 text-white' : !isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}`}>
                                      {date.getDate()}
                                    </span>
                                    {absenceInfo.absent && isCurrentMonth ? (
                                      <span className="text-[9px] text-red-600 font-bold">{absenceInfo.source === 'devis' ? '🔧' : '🚫'}</span>
                                    ) : dayBookings.length > 0 && isCurrentMonth ? (
                                      <span className="text-xs text-gray-500 font-semibold">{dayBookings.length}</span>
                                    ) : null}
                                  </div>
                                  {absenceInfo.absent && isCurrentMonth && (
                                    <div className={`text-[9px] font-semibold truncate px-1 py-0.5 rounded mb-0.5 ${absenceInfo.source === 'devis' ? 'text-red-800 bg-red-200' : 'text-red-600 bg-red-100'}`}>
                                      {absenceInfo.source === 'devis' ? absenceInfo.label : absenceInfo.reason || 'Absent'}
                                    </div>
                                  )}
                                  <div className="space-y-0.5">
                                    {dayBookings.slice(0, absenceInfo.absent ? 1 : 3).map((b) => {
                                      const statusColor = b.status === 'confirmed' ? 'bg-green-400' : b.status === 'pending' ? 'bg-orange-400' : b.status === 'completed' ? 'bg-blue-400' : 'bg-red-400'
                                      return (
                                        <div key={b.id} onClick={(e) => { e.stopPropagation(); handleBookingClick(b) }}
                                          className="flex items-center gap-1 hover:opacity-80 transition">
                                          <div className={`w-1.5 h-1.5 rounded-full ${statusColor} shrink-0`} />
                                          <span className={`text-[10px] truncate ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-600'}`}>
                                            {b.booking_time?.substring(0, 5)} {b.services?.name || 'RDV'}
                                          </span>
                                        </div>
                                      )
                                    })}
                                    {dayBookings.length > (absenceInfo.absent ? 1 : 3) && (
                                      <div className="text-[10px] text-gray-500 font-semibold pl-2.5">+{dayBookings.length - (absenceInfo.absent ? 1 : 3)} de plus</div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>

                {/* RDV en attente */}
                {pendingBookings.length > 0 && (
                  <div className="bg-white p-6 rounded-2xl shadow-sm">
                    <h3 className="font-bold text-lg mb-4">⏳ RDV en attente de validation ({pendingBookings.length})</h3>
                    <div className="space-y-3">
                      {pendingBookings.map((b) => (
                        <div key={b.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                          <div>
                            <div className="font-semibold">{b.services?.name || 'Service'}</div>
                            <div className="text-sm text-gray-600">{b.booking_date} à {b.booking_time?.substring(0, 5)}</div>
                            <div className="text-sm text-gray-500">{b.address}</div>
                            {b.notes && <div className="text-xs text-gray-500 mt-1">{b.notes}</div>}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => openDashMessages(b)} className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-4 py-2 rounded-lg font-semibold text-sm transition">💬 Messages</button>
                            <button onClick={() => updateBookingStatus(b.id, 'confirmed')} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition">✓ Accepter</button>
                            <button onClick={() => updateBookingStatus(b.id, 'cancelled')} className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold text-sm transition">✕ Refuser</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ═══ Modal Nouveau RDV — style Jobber/Calendly ═══ */}
                {showNewRdv && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowNewRdv(false)}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                      <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
                        <h2 className="text-lg font-bold flex items-center gap-2">📅 Nouveau rendez-vous</h2>
                        <button onClick={() => setShowNewRdv(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                      </div>
                      <div className="p-6 space-y-4">
                        {/* Client */}
                        <div>
                          <label className="block text-sm font-semibold mb-1 text-gray-700">👤 Client</label>
                          <input type="text" value={newRdv.client_name} onChange={(e) => setNewRdv({...newRdv, client_name: e.target.value})} placeholder="Nom du client" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#FFC107] focus:outline-none transition" />
                        </div>
                        {/* Service */}
                        <div>
                          <label className="block text-sm font-semibold mb-1 text-gray-700">🔧 Prestation *</label>
                          <select value={newRdv.service_id} onChange={(e) => setNewRdv({...newRdv, service_id: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#FFC107] focus:outline-none bg-white transition">
                            <option value="">Choisir une prestation...</option>
                            {services.filter(s => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} — {formatPrice(s.price_ttc)}</option>)}
                          </select>
                        </div>
                        {/* Date + Heure + Durée — 3 colonnes */}
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-sm font-semibold mb-1 text-gray-700">📅 Date *</label>
                            <input type="date" value={newRdv.date} onChange={(e) => setNewRdv({...newRdv, date: e.target.value})} min={new Date().toISOString().split('T')[0]} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#FFC107] focus:outline-none transition" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold mb-1 text-gray-700">🕐 Heure *</label>
                            <input type="time" value={newRdv.time} onChange={(e) => setNewRdv({...newRdv, time: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#FFC107] focus:outline-none transition" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold mb-1 text-gray-700">⏱️ Durée</label>
                            <select value={newRdv.duration} onChange={(e) => setNewRdv({...newRdv, duration: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#FFC107] focus:outline-none bg-white transition">
                              <option value="">Auto</option>
                              <option value="30">30 min</option>
                              <option value="45">45 min</option>
                              <option value="60">1h</option>
                              <option value="90">1h30</option>
                              <option value="120">2h</option>
                              <option value="180">3h</option>
                              <option value="240">Demi-journée</option>
                              <option value="480">Journée</option>
                            </select>
                          </div>
                        </div>
                        {/* Téléphone + Adresse */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-semibold mb-1 text-gray-700">📞 Téléphone</label>
                            <input type="tel" value={newRdv.phone} onChange={(e) => setNewRdv({...newRdv, phone: e.target.value})} placeholder="06 12 34 56 78" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#FFC107] focus:outline-none transition" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold mb-1 text-gray-700">📍 Adresse</label>
                            <input type="text" value={newRdv.address} onChange={(e) => setNewRdv({...newRdv, address: e.target.value})} placeholder="Adresse intervention" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#FFC107] focus:outline-none transition" />
                          </div>
                        </div>
                        {/* Notes */}
                        <div>
                          <label className="block text-sm font-semibold mb-1 text-gray-700">📝 Notes</label>
                          <textarea value={newRdv.notes} onChange={(e) => setNewRdv({...newRdv, notes: e.target.value})} rows={2} placeholder="Détails, accès, infos utiles..." className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#FFC107] focus:outline-none resize-none transition" />
                        </div>
                      </div>
                      {/* Actions sticky bottom */}
                      <div className="p-6 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white rounded-b-2xl">
                        <button onClick={createRdvManual} disabled={!newRdv.service_id || !newRdv.date || !newRdv.time} className="flex-1 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-xl font-bold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm">
                          ✓ Créer le rendez-vous
                        </button>
                        <button onClick={() => setShowNewRdv(false)} className="px-5 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition text-sm">
                          Annuler
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══ Modal Absence — style Calendly/Cal.com ═══ */}
                {showAbsenceModal && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAbsenceModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-lg font-bold flex items-center gap-2">🚫 Ajouter une absence</h2>
                        <button onClick={() => setShowAbsenceModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                      </div>
                      <div className="p-6 space-y-4">
                        {/* Type d'absence — boutons radio visuels */}
                        <div>
                          <label className="block text-sm font-semibold mb-2 text-gray-700">Motif</label>
                          <div className="grid grid-cols-3 gap-2">
                            {['Congé', 'Maladie', 'Formation', 'Personnel', 'Férié', 'Autre'].map(reason => (
                              <button key={reason} onClick={() => setNewAbsence({...newAbsence, reason})}
                                className={`p-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${newAbsence.reason === reason ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                                {reason === 'Congé' ? '🏖️' : reason === 'Maladie' ? '🤒' : reason === 'Formation' ? '📚' : reason === 'Personnel' ? '🏠' : reason === 'Férié' ? '🎉' : '📌'} {reason}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-semibold mb-1 text-gray-700">Du *</label>
                            <input type="date" value={newAbsence.start_date} onChange={(e) => setNewAbsence({...newAbsence, start_date: e.target.value, end_date: newAbsence.end_date || e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none transition" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold mb-1 text-gray-700">Au *</label>
                            <input type="date" value={newAbsence.end_date} onChange={(e) => setNewAbsence({...newAbsence, end_date: e.target.value})} min={newAbsence.start_date} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none transition" />
                          </div>
                        </div>
                        {newAbsence.start_date && newAbsence.end_date && (
                          <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-xl text-center">
                            {(() => {
                              const start = new Date(newAbsence.start_date)
                              const end = new Date(newAbsence.end_date)
                              const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
                              return `📅 ${days} jour${days > 1 ? 's' : ''} d'absence`
                            })()}
                          </div>
                        )}
                        {/* Libellé optionnel */}
                        <div>
                          <label className="block text-sm font-semibold mb-1 text-gray-700">Libellé <span className="text-gray-400 font-normal">(optionnel)</span></label>
                          <input type="text" value={newAbsence.label} onChange={(e) => setNewAbsence({...newAbsence, label: e.target.value})} placeholder="Ex: Vacances d'été, RDV médical..." className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none transition" />
                        </div>
                      </div>
                      <div className="p-6 border-t border-gray-100 flex gap-3">
                        <button onClick={createAbsence} disabled={!newAbsence.start_date || !newAbsence.end_date} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm">
                          🚫 Bloquer ces dates
                        </button>
                        <button onClick={() => setShowAbsenceModal(false)} className="px-5 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition text-sm">
                          Annuler
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal Détail RDV */}
                {showBookingDetail && selectedBooking && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowBookingDetail(false); setSelectedBooking(null) }}>
                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
                      {/* Header avec statut */}
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <h2 className="text-xl font-bold">📋 Détail du rendez-vous</h2>
                          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-semibold ${
                            selectedBooking.status === 'confirmed' ? 'bg-green-50 text-green-700' :
                            selectedBooking.status === 'pending' ? 'bg-amber-50 text-orange-700' :
                            selectedBooking.status === 'completed' ? 'bg-blue-50 text-blue-700' :
                            'bg-red-50 text-red-700'
                          }`}>
                            {selectedBooking.status === 'confirmed' ? '✅ Confirmé' :
                             selectedBooking.status === 'pending' ? '⏳ En attente' :
                             selectedBooking.status === 'completed' ? '✓ Terminé' : '✕ Annulé'}
                          </span>
                        </div>
                        <button onClick={() => { setShowBookingDetail(false); setSelectedBooking(null) }} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">&times;</button>
                      </div>

                      {/* Infos */}
                      <div className="space-y-4 mb-6">
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <span className="text-xl">🔧</span>
                          <div>
                            <div className="text-xs text-gray-500">Motif</div>
                            <div className="font-semibold">{selectedBooking.services?.name || 'Service'}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <span className="text-xl">📅</span>
                            <div>
                              <div className="text-xs text-gray-500">Date</div>
                              <div className="font-semibold">{new Date(selectedBooking.booking_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <span className="text-xl">🕐</span>
                            <div>
                              <div className="text-xs text-gray-500">Heure</div>
                              <div className="font-semibold">{selectedBooking.booking_time?.substring(0, 5)}</div>
                            </div>
                          </div>
                        </div>
                        {selectedBooking.duration_minutes && (
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <span className="text-xl">⏱️</span>
                            <div>
                              <div className="text-xs text-gray-500">Durée</div>
                              <div className="font-semibold">{Math.floor(selectedBooking.duration_minutes / 60)}h{selectedBooking.duration_minutes % 60 > 0 ? String(selectedBooking.duration_minutes % 60).padStart(2, '0') : '00'}</div>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <span className="text-xl">📍</span>
                          <div>
                            <div className="text-xs text-gray-500">Adresse</div>
                            <div className="font-semibold">{selectedBooking.address || 'Non renseignée'}</div>
                          </div>
                        </div>
                        {selectedBooking.notes && (
                          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                            <span className="text-xl">📝</span>
                            <div>
                              <div className="text-xs text-gray-500">Notes</div>
                              <div className="text-sm text-gray-700">{selectedBooking.notes}</div>
                            </div>
                          </div>
                        )}
                        {selectedBooking.price_ttc && (
                          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                            <span className="text-xl">💰</span>
                            <div>
                              <div className="text-xs text-gray-500">Montant TTC</div>
                              <div className="font-bold text-lg text-green-700">{formatPrice(selectedBooking.price_ttc)}</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions selon le statut */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                        {selectedBooking.status === 'pending' && (
                          <>
                            <button onClick={() => { setShowBookingDetail(false); transformBookingToDevis(selectedBooking) }}
                              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2">
                              📄 Transformer en devis
                            </button>
                            <button onClick={() => updateBookingStatus(selectedBooking.id, 'confirmed')}
                              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition">
                              ✓ Confirmer
                            </button>
                            <button onClick={() => updateBookingStatus(selectedBooking.id, 'cancelled')}
                              className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 py-3 rounded-lg font-semibold border-2 border-red-200 transition">
                              ✕ Refuser
                            </button>
                          </>
                        )}
                        {selectedBooking.status === 'confirmed' && (
                          <>
                            <button onClick={() => { setShowBookingDetail(false); transformBookingToDevis(selectedBooking) }}
                              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2">
                              📄 Transformer en devis
                            </button>
                            <button onClick={() => updateBookingStatus(selectedBooking.id, 'completed')}
                              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold transition">
                              ✓ Marquer terminé
                            </button>
                            <button onClick={() => { if (confirm('Annuler ce rendez-vous ?')) updateBookingStatus(selectedBooking.id, 'cancelled') }}
                              className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 py-3 rounded-lg font-semibold border-2 border-red-200 transition">
                              ✕ Annuler le RDV
                            </button>
                          </>
                        )}
                        {selectedBooking.status === 'completed' && (
                          <div className="w-full text-center text-gray-500 py-2 text-sm">Ce RDV est terminé</div>
                        )}
                        {selectedBooking.status === 'cancelled' && (
                          <button onClick={() => updateBookingStatus(selectedBooking.id, 'pending')}
                            className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 py-3 rounded-lg font-semibold border-2 border-amber-200 transition">
                            🔄 Remettre en attente
                          </button>
                        )}
                        <button onClick={() => { setShowBookingDetail(false); setSelectedBooking(null) }}
                          className="w-full mt-1 px-6 py-2.5 bg-white text-gray-500 border-2 border-gray-200 rounded-lg font-semibold hover:bg-gray-50 transition text-sm">
                          Fermer
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ────── HORAIRES D'OUVERTURE ────── */}
          {activePage === 'horaires' && (
            <div className="animate-fadeIn">
              <PageHeader title="🕐 Horaires d'ouverture" actionLabel="" onAction={() => {}} />
              <div className="p-6 lg:p-8">

                {/* Mode validation */}
                <div className="bg-white p-4 rounded-2xl shadow-sm mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold">Mode de validation</h3>
                    <p className="text-sm text-gray-500">
                      {autoAccept ? '✅ Les RDV clients sont confirmés automatiquement' : '⏳ Vous validez manuellement chaque demande'}
                    </p>
                  </div>
                  <button onClick={toggleAutoAccept} className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${autoAccept ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                    {autoAccept ? '🟢 Automatique' : '🟡 Manuel'}
                  </button>
                </div>

                {/* Plages d'ouverture */}
                <div className="bg-white p-6 rounded-2xl shadow-sm mb-6">
                  <h3 className="font-bold text-lg mb-4">🕐 Plages d&apos;ouverture</h3>
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                      const avail = availability.find((a) => a.day_of_week === day)
                      const dayServiceIds = dayServices[String(day)] || []
                      const activeServices = services.filter(s => s.active)
                      return (
                        <div key={day} className="p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <div className="w-24 font-semibold">{DAY_NAMES[day]}</div>
                            <div className="flex items-center gap-2 flex-1">
                              <button
                                onClick={() => toggleDayAvailability(day)}
                                className={`w-12 h-6 rounded-full relative transition-colors ${avail?.is_available ? 'bg-green-400' : 'bg-gray-300'}`}
                              >
                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${avail?.is_available ? 'translate-x-6' : 'translate-x-0.5'}`} />
                              </button>
                              {avail?.is_available ? (
                                <div className="flex items-center gap-2">
                                  <input type="time" value={avail.start_time?.substring(0, 5) || '08:00'}
                                    onChange={(e) => updateAvailabilityTime(day, 'start_time', e.target.value)}
                                    className="px-2 py-1 border-2 border-gray-200 rounded-lg text-sm focus:border-[#FFC107] focus:outline-none" />
                                  <span className="text-gray-500">à</span>
                                  <input type="time" value={avail.end_time?.substring(0, 5) || '17:00'}
                                    onChange={(e) => updateAvailabilityTime(day, 'end_time', e.target.value)}
                                    className="px-2 py-1 border-2 border-gray-200 rounded-lg text-sm focus:border-[#FFC107] focus:outline-none" />
                                  <span className="text-xs text-gray-500 ml-2">
                                    {dayServiceIds.length > 0 ? `${dayServiceIds.length} motif(s)` : 'Tous les motifs'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-500 text-sm">Fermé</span>
                              )}
                            </div>
                          </div>
                          {avail?.is_available && activeServices.length > 0 && (
                            <div className="mt-3 ml-0 sm:ml-24 pl-4 border-l-2 border-[#FFC107]">
                              <p className="text-xs text-gray-500 mb-2 font-semibold">Motifs disponibles ce jour :</p>
                              <div className="flex flex-wrap gap-2">
                                {activeServices.map((service) => {
                                  const isAssigned = dayServiceIds.includes(service.id)
                                  return (
                                    <label
                                      key={service.id}
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition text-sm ${
                                        isAssigned
                                          ? 'bg-[#FFC107]/20 border border-[#FFC107] text-gray-900'
                                          : 'bg-white border border-gray-200 text-gray-600 hover:border-[#FFC107]'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isAssigned}
                                        onChange={() => toggleDayService(day, service.id)}
                                        className="w-3.5 h-3.5 accent-[#FFC107] rounded"
                                      />
                                      <span>{service.name}</span>
                                    </label>
                                  )
                                })}
                              </div>
                              {dayServiceIds.length === 0 && (
                                <p className="text-xs text-amber-600 mt-1">Aucun motif coch&eacute; = tous les motifs sont disponibles</p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {savingAvail && <p className="text-sm text-[#FFC107] mt-2 font-medium">Sauvegarde...</p>}
                </div>

              </div>
            </div>
          )}

          {/* ────── MOTIFS (Services) - FULL CRUD ────── */}
          {activePage === 'motifs' && (
            <div className="animate-fadeIn">
              <PageHeader title="🔧 Motifs de rendez-vous" actionLabel="+ Nouveau motif" onAction={openNewMotif} />
              <div className="p-6 lg:p-8">

                {/* Info box */}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-6">
                  <p className="text-sm text-blue-800">
                    <strong>💡 Astuce :</strong> Les motifs sont les services que vos clients peuvent réserver.
                    Configurez le prix au forfait, au m², à l&apos;heure ou à l&apos;unité.
                  </p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#2C3E50] text-white">
                        <th className="text-left p-4 font-semibold text-sm">Motif</th>
                        <th className="text-left p-4 font-semibold text-sm">Durée</th>
                        <th className="text-left p-4 font-semibold text-sm">Fourchette tarifaire</th>
                        <th className="text-left p-4 font-semibold text-sm">Unité</th>
                        <th className="text-left p-4 font-semibold text-sm">Statut</th>
                        <th className="text-left p-4 font-semibold text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((service) => (
                        <tr key={service.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                          <td className="p-4">
                            <div className="font-bold">🌿 {service.name}</div>
                            {getCleanDescription(service) && (
                              <div className="text-xs text-gray-500 mt-1">{getCleanDescription(service)}</div>
                            )}
                          </td>
                          <td className="p-4">{service.duration_minutes ? `${Math.floor(service.duration_minutes / 60)}h${service.duration_minutes % 60 > 0 ? String(service.duration_minutes % 60).padStart(2, '0') : '00'}` : <span className="text-gray-500 text-xs">—</span>}</td>
                          <td className="p-4 font-bold text-[#FFC107]">{getPriceRangeLabel(service)}</td>
                          <td className="p-4">
                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold">{getPricingUnit(service)}</span>
                          </td>
                          <td className="p-4">
                            <button onClick={() => toggleMotifActive(service.id, service.active)}
                              className={`px-3 py-1 rounded-full text-sm font-semibold cursor-pointer transition ${service.active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                              {service.active ? '✅ Actif' : '⏸ Inactif'}
                            </button>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <button onClick={() => openEditMotif(service)} className="bg-white text-gray-600 border-2 border-gray-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-gray-50 hover:-translate-y-0.5 transition-all text-sm">
                                ✏️ Modifier
                              </button>
                              <button onClick={() => deleteMotif(service.id)} className="bg-red-50 text-red-600 border-2 border-red-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-red-100 transition-all text-sm">
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {services.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-gray-500">
                            <div className="text-4xl mb-3">🔧</div>
                            <p className="font-semibold text-lg mb-2">Aucun motif configuré</p>
                            <p className="text-sm mb-4">Créez votre premier motif pour que vos clients puissent réserver</p>
                            <button onClick={openNewMotif} className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2 rounded-lg font-semibold text-sm transition">
                              + Créer un motif
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Motif */}
              {showMotifModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowMotifModal(false)}>
                  <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    <h2 className="text-xl font-bold mb-6">{editingMotif ? '✏️ Modifier le motif' : '🔧 Nouveau motif'}</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold mb-1">Nom du motif *</label>
                        <input type="text" value={motifForm.name} onChange={(e) => setMotifForm({...motifForm, name: e.target.value})}
                          placeholder="Ex: Entretien jardin, Élagage, Tonte pelouse..."
                          className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Description</label>
                        <textarea value={motifForm.description} onChange={(e) => setMotifForm({...motifForm, description: e.target.value})}
                          rows={2} placeholder="Description détaillée du service..."
                          className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none resize-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Durée estimée <span className="text-gray-500 font-normal">(optionnel, en minutes)</span></label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            value={motifForm.duration_minutes}
                            onChange={(e) => setMotifForm({...motifForm, duration_minutes: e.target.value === '' ? '' : parseInt(e.target.value)})}
                            min={5} step={5}
                            placeholder="Ex: 60"
                            className="w-32 p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none"
                          />
                          {motifForm.duration_minutes !== '' && Number(motifForm.duration_minutes) > 0 && (
                            <span className="text-gray-500 text-sm">
                              = {Math.floor(Number(motifForm.duration_minutes) / 60)}h{Number(motifForm.duration_minutes) % 60 > 0 ? String(Number(motifForm.duration_minutes) % 60).padStart(2, '0') : '00'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2">Unité de tarification *</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'forfait', label: '💰 Forfait', desc: 'Prix fixe par prestation' },
                            { value: 'm2', label: '📐 Au m²', desc: 'Prix au mètre carré' },
                            { value: 'ml', label: '📏 Au ml', desc: 'Prix au mètre linéaire' },
                            { value: 'm3', label: '🧊 Au m³', desc: 'Prix au mètre cube' },
                            { value: 'heure', label: '🕐 À l\'heure', desc: 'Prix horaire' },
                            { value: 'arbre', label: '🌳 Par arbre', desc: 'Prix par arbre/palmier' },
                            { value: 'tonne', label: '♻️ Par tonne', desc: 'Prix par tonne de déchets' },
                          ].map((opt) => (
                            <button key={opt.value}
                              onClick={() => setMotifForm({...motifForm, pricing_unit: opt.value})}
                              className={`p-3 rounded-xl border-2 text-left transition ${motifForm.pricing_unit === opt.value ? 'border-[#FFC107] bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                              <div className="font-semibold text-sm">{opt.label}</div>
                              <div className="text-xs text-gray-500">{opt.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">
                          Fourchette de prix{motifForm.pricing_unit !== 'forfait' ? ` (€${motifForm.pricing_unit === 'm2' ? '/m²' : motifForm.pricing_unit === 'ml' ? '/ml' : motifForm.pricing_unit === 'm3' ? '/m³' : motifForm.pricing_unit === 'heure' ? '/h' : motifForm.pricing_unit === 'arbre' ? '/arbre' : motifForm.pricing_unit === 'tonne' ? '/t' : ''})` : ' (€)'}
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Prix minimum</label>
                            <input
                              type="number"
                              value={motifForm.price_min}
                              onChange={(e) => setMotifForm({...motifForm, price_min: e.target.value === '' ? '' : parseFloat(e.target.value)})}
                              step="0.01" min="0" placeholder="Laisser vide = sur devis"
                              className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Prix maximum</label>
                            <input
                              type="number"
                              value={motifForm.price_max}
                              onChange={(e) => setMotifForm({...motifForm, price_max: e.target.value === '' ? '' : parseFloat(e.target.value)})}
                              step="0.01" min="0" placeholder="Laisser vide = sur devis"
                              className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Laissez vide pour afficher "Sur devis"</p>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button onClick={saveMotif} disabled={!motifForm.name || savingMotif}
                          className="flex-1 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-lg font-semibold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                          {savingMotif ? 'Sauvegarde...' : editingMotif ? '💾 Modifier' : '+ Créer le motif'}
                        </button>
                        <button onClick={() => setShowMotifModal(false)} className="px-6 py-3 bg-white text-gray-600 border-2 border-gray-200 rounded-lg font-semibold hover:bg-gray-50 transition">
                          Annuler
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ────── COMMUNICATION (Particuliers) ────── */}
          {(activePage === 'messages' || activePage === 'comm_pro') && (
            <div className="animate-fadeIn">
              <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-[#FFC107] shadow-sm">
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
                    🏠 Particuliers
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
                      <h3 className="text-2xl font-bold mb-3">Aucune demande en attente</h3>
                      <p className="text-gray-500 text-lg">Toutes les demandes clients ont été traitées</p>
                    </div>
                  )}

                  {/* Historique conversations clients */}
                  {bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length > 0 && (
                    <div className="mt-8">
                      <h3 className="font-bold text-gray-700 mb-3">📨 Conversations clients actives</h3>
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
                        <p className="text-sm text-blue-600">Messagerie directe avec vos contacts professionnels</p>
                      </div>
                      <button onClick={() => navigateTo('canal')} className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm">
                        Ouvrir le canal →
                      </button>
                    </div>
                  </div>

                  {/* Ordres de mission */}
                  <div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-2xl p-6 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-purple-900 text-lg mb-1">📋 Ordres de mission</h3>
                        <p className="text-sm text-purple-600">Missions reçues des syndics et gestionnaires</p>
                      </div>
                      <button onClick={() => navigateTo('ordres_mission')} className="bg-purple-500 hover:bg-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm">
                        Voir les ordres →
                      </button>
                    </div>
                  </div>

                  {/* Types de contacts pro */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { icon: '🏛️', label: 'Syndics', desc: 'Copropriétés' },
                      { icon: '🏗️', label: 'Entreprises BTP', desc: 'Sous-traitance' },
                      { icon: '🏠', label: 'Bailleurs sociaux', desc: 'Logements sociaux' },
                      { icon: '🔑', label: 'Conciergeries', desc: 'Locations courtes' },
                    ].map((t) => (
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

          {/* ────── ORDRES DE MISSION SYNDIC ────── */}
          {activePage === 'ordres_mission' && (
            <OrdresMissionPage artisan={artisan} />
          )}

          {/* ────── DEVIS ────── */}
          {activePage === 'devis' && (
            showDevisForm ? (
              <DevisFactureForm artisan={artisan} services={services} bookings={bookings} initialDocType="devis"
                initialData={convertingDevis}
                onBack={() => { setShowDevisForm(false); setConvertingDevis(null); const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]'); const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]'); setSavedDocuments([...docs, ...drafts]) }}
                onSave={() => { setConvertingDevis(null); const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]'); const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]'); setSavedDocuments([...docs, ...drafts]) }}
              />
            ) : (
              <div className="animate-fadeIn">
                <PageHeader title="📄 Devis" actionLabel="+ Nouveau devis" onAction={() => setShowDevisForm(true)} />
                <div className="p-6 lg:p-8">
                  {/* Compteurs */}
                  {savedDocuments.filter(d => d.docType === 'devis').length > 0 && (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                        <div className="text-2xl font-black text-[#2C3E50]">{savedDocuments.filter(d => d.docType === 'devis').length}</div>
                        <div className="text-xs text-gray-500">Total devis</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                        <div className="text-2xl font-black text-blue-600">{savedDocuments.filter(d => d.docType === 'devis' && d.status === 'envoye').length}</div>
                        <div className="text-xs text-gray-500">Envoyés</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                        <div className="text-2xl font-black text-amber-600">{savedDocuments.filter(d => d.docType === 'devis' && d.status === 'brouillon').length}</div>
                        <div className="text-xs text-gray-500">Brouillons</div>
                      </div>
                    </div>
                  )}

                  {/* Liste des devis */}
                  <div className="space-y-3">
                    {savedDocuments.filter(d => d.docType === 'devis').sort((a, b) => new Date(b.savedAt || b.docDate).getTime() - new Date(a.savedAt || a.docDate).getTime()).map((doc, i) => {
                      const totalHT = doc.lines?.reduce((s: number, l: any) => s + (l.totalHT || 0), 0) || 0
                      return (
                        <div key={`saved-dev-${i}`} className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition border border-gray-100">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="bg-[#FFC107] text-gray-900 text-xs font-bold px-2.5 py-1 rounded-lg">{doc.docNumber}</span>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${doc.status === 'envoye' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-orange-700'}`}>
                                  {doc.status === 'envoye' ? '✓ Envoyé' : '✏️ Brouillon'}
                                </span>
                              </div>
                              {doc.docTitle && <p className="font-semibold text-[#2C3E50] mb-1">{doc.docTitle}</p>}
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                                <span>👤 {doc.clientName || 'Client non renseigné'}</span>
                                <span>📅 {doc.docDate ? new Date(doc.docDate).toLocaleDateString('fr-FR') : '-'}</span>
                                {doc.docValidity && <span>⏱️ Validité : {doc.docValidity}j</span>}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-black text-[#2C3E50]">{totalHT.toFixed(2)} €</div>
                              <div className="text-xs text-gray-500">HT</div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
                            <button onClick={() => { setConvertingDevis(doc); setShowDevisForm(true) }}
                              className="bg-white text-gray-600 border-2 border-gray-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-gray-50 transition text-sm">
                              ✏️ Modifier
                            </button>
                            <button onClick={() => convertDevisToFacture(doc)}
                              className="bg-[#FFC107] text-gray-900 px-3 py-1.5 rounded-lg font-semibold hover:bg-[#FFD54F] shadow-sm transition text-sm">
                              🧾 Convertir en facture
                            </button>
                            <button onClick={() => {
                              if (!confirm(`Supprimer le devis ${doc.docNumber} ?`)) return
                              const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                              const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                              const updDocs = docs.filter((d: any) => d.docNumber !== doc.docNumber)
                              const updDrafts = drafts.filter((d: any) => d.docNumber !== doc.docNumber)
                              localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(updDocs))
                              localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(updDrafts))
                              setSavedDocuments([...updDocs, ...updDrafts])
                            }}
                              className="bg-white text-red-500 border-2 border-red-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-red-50 transition text-sm ml-auto">
                              🗑️
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    {savedDocuments.filter(d => d.docType === 'devis').length === 0 && (
                      <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                        <div className="text-5xl mb-4">📄</div>
                        <p className="font-semibold text-lg text-gray-700 mb-2">Aucun devis</p>
                        <p className="text-sm text-gray-500 mb-5">Créez votre premier devis conforme aux normes françaises</p>
                        <button onClick={() => setShowDevisForm(true)} className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm">
                          + Créer un devis
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          )}

          {/* ────── FACTURES ────── */}
          {activePage === 'factures' && (
            showFactureForm ? (
              <DevisFactureForm artisan={artisan} services={services} bookings={bookings} initialDocType="facture"
                initialData={convertingDevis}
                onBack={() => { setShowFactureForm(false); setConvertingDevis(null); const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]'); const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]'); setSavedDocuments([...docs, ...drafts]) }}
                onSave={() => { setConvertingDevis(null); const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]'); const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]'); setSavedDocuments([...docs, ...drafts]) }}
              />
            ) : (
              <div className="animate-fadeIn">
                <PageHeader title="🧾 Factures" actionLabel="+ Nouvelle facture" onAction={() => setShowFactureForm(true)} />
                <div className="p-6 lg:p-8">
                  {/* Compteurs */}
                  {savedDocuments.filter(d => d.docType === 'facture').length > 0 && (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                        <div className="text-2xl font-black text-[#2C3E50]">{savedDocuments.filter(d => d.docType === 'facture').length}</div>
                        <div className="text-xs text-gray-500">Total factures</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                        <div className="text-2xl font-black text-green-600">
                          {savedDocuments.filter(d => d.docType === 'facture').reduce((s, d) => s + (d.lines?.reduce((t: number, l: any) => t + (l.totalHT || 0), 0) || 0), 0).toFixed(2)} €
                        </div>
                        <div className="text-xs text-gray-500">CA HT total</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                        <div className="text-2xl font-black text-blue-600">{savedDocuments.filter(d => d.docType === 'facture' && d.status === 'envoye').length}</div>
                        <div className="text-xs text-gray-500">Envoyées</div>
                      </div>
                    </div>
                  )}

                  {/* Liste des factures */}
                  <div className="space-y-3">
                    {savedDocuments.filter(d => d.docType === 'facture').sort((a, b) => new Date(b.savedAt || b.docDate).getTime() - new Date(a.savedAt || a.docDate).getTime()).map((doc, i) => {
                      const totalHT = doc.lines?.reduce((s: number, l: any) => s + (l.totalHT || 0), 0) || 0
                      const isOverdue = doc.paymentDue && new Date(doc.paymentDue) < new Date()
                      return (
                        <div key={`saved-fact-${i}`} className={`bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition border ${isOverdue ? 'border-red-200' : 'border-gray-100'}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="bg-[#2C3E50] text-white text-xs font-bold px-2.5 py-1 rounded-lg">{doc.docNumber}</span>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${doc.status === 'envoye' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-orange-700'}`}>
                                  {doc.status === 'envoye' ? '✓ Envoyée' : '✏️ Brouillon'}
                                </span>
                                {isOverdue && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600">⚠️ Échue</span>}
                              </div>
                              {doc.docTitle && <p className="font-semibold text-[#2C3E50] mb-1">{doc.docTitle}</p>}
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                                <span>👤 {doc.clientName || 'Client non renseigné'}</span>
                                <span>📅 {doc.docDate ? new Date(doc.docDate).toLocaleDateString('fr-FR') : '-'}</span>
                                {doc.paymentDue && <span>⏰ Échéance : {new Date(doc.paymentDue).toLocaleDateString('fr-FR')}</span>}
                                {doc.paymentMode && <span>💳 {doc.paymentMode}</span>}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-black text-[#2C3E50]">{totalHT.toFixed(2)} €</div>
                              <div className="text-xs text-gray-500">HT</div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
                            <button onClick={() => { setConvertingDevis(doc); setShowFactureForm(true) }}
                              className="bg-white text-gray-600 border-2 border-gray-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-gray-50 transition text-sm">
                              ✏️ Modifier
                            </button>
                            <button onClick={() => {
                              if (!confirm(`Supprimer la facture ${doc.docNumber} ?`)) return
                              const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                              const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                              const updDocs = docs.filter((d: any) => d.docNumber !== doc.docNumber)
                              const updDrafts = drafts.filter((d: any) => d.docNumber !== doc.docNumber)
                              localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(updDocs))
                              localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(updDrafts))
                              setSavedDocuments([...updDocs, ...updDrafts])
                            }}
                              className="bg-white text-red-500 border-2 border-red-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-red-50 transition text-sm ml-auto">
                              🗑️
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    {savedDocuments.filter(d => d.docType === 'facture').length === 0 && (
                      <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                        <div className="text-5xl mb-4">🧾</div>
                        <p className="font-semibold text-lg text-gray-700 mb-2">Aucune facture</p>
                        <p className="text-sm text-gray-500 mb-5">Créez votre première facture conforme</p>
                        <button onClick={() => setShowFactureForm(true)} className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm">
                          + Créer une facture
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          )}

          {/* ────── STATISTIQUES ────── */}
          {activePage === 'stats' && (
            <div className="animate-fadeIn">
              <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-[#FFC107] shadow-sm">
                <h1 className="text-2xl font-semibold">📊 Statistiques</h1>
              </div>
              <div className="p-6 lg:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                  <StatCard icon="📅" iconBg="bg-blue-50" iconColor="text-blue-500" value={bookings.length.toString()} label="Interventions totales" change={`${completedBookings.length} terminées`} positive />
                  <StatCard icon="💰" iconBg="bg-green-50" iconColor="text-green-500" value={formatPrice(totalRevenue)} label="Chiffre d'affaires" change={`${bookings.length} interventions`} positive />
                  <StatCard icon="⭐" iconBg="bg-orange-50" iconColor="text-orange-500" value={`${artisan?.rating_avg || '5.0'}/5`} label="Note moyenne" change={`${artisan?.rating_count || 0} avis`} positive />
                  <StatCard icon="🔧" iconBg="bg-pink-50" iconColor="text-pink-500" value={services.filter(s => s.active).length.toString()} label="Motifs actifs" change={`${services.length} au total`} />
                </div>
              </div>
            </div>
          )}

          {/* ────── REVENUS ────── */}
          {activePage === 'revenus' && (
            <div className="animate-fadeIn">
              <PageHeader title="💰 Revenus" actionLabel="📊 Exporter" onAction={() => alert('Export PDF en cours de développement')} />
              <div className="p-6 lg:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                  <div className="bg-white p-6 rounded-2xl shadow-sm">
                    <div className="text-gray-500 mb-1">Total encaissé</div>
                    <div className="text-3xl font-bold text-green-500">{formatPrice(totalRevenue)}</div>
                    <div className="text-sm text-green-500 font-semibold mt-2">{completedBookings.length} interventions terminées</div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm">
                    <div className="text-gray-500 mb-1">En attente</div>
                    <div className="text-3xl font-bold text-orange-500">{formatPrice(pendingBookings.reduce((s, b) => s + (b.price_ttc || 0), 0))}</div>
                    <div className="text-sm text-gray-500 font-semibold mt-2">{pendingBookings.length} en attente</div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm">
                    <div className="text-gray-500 mb-1">Total RDV</div>
                    <div className="text-3xl font-bold">{formatPrice(bookings.reduce((s, b) => s + (b.price_ttc || 0), 0))}</div>
                    <div className="text-sm text-gray-500 font-semibold mt-2">{bookings.length} interventions au total</div>
                  </div>
                </div>

                {bookings.length > 0 ? (
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#2C3E50] text-white">
                          <th className="text-left p-4 font-semibold text-sm">Date</th>
                          <th className="text-left p-4 font-semibold text-sm">Service</th>
                          <th className="text-left p-4 font-semibold text-sm">Montant</th>
                          <th className="text-left p-4 font-semibold text-sm">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map((b) => (
                          <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                            <td className="p-4">{b.booking_date}</td>
                            <td className="p-4">{b.services?.name || 'Service'}</td>
                            <td className="p-4 font-bold text-lg" style={{ color: b.status === 'completed' ? '#4CAF50' : b.status === 'pending' ? '#FF9800' : '#999' }}>
                              {b.status !== 'cancelled' ? `+${formatPrice(b.price_ttc || 0)}` : '-'}
                            </td>
                            <td className="p-4">
                              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${b.status === 'completed' ? 'bg-green-50 text-green-700' : b.status === 'confirmed' ? 'bg-blue-50 text-blue-700' : b.status === 'pending' ? 'bg-amber-50 text-orange-700' : 'bg-red-50 text-red-700'}`}>
                                {b.status === 'completed' ? 'Payé' : b.status === 'confirmed' ? 'Confirmé' : b.status === 'pending' ? 'En attente' : 'Annulé'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-white p-12 rounded-2xl text-center shadow-sm">
                    <p className="text-gray-500">Aucun revenu enregistré</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ────── PARAMETRES ────── */}
          {activePage === 'settings' && (
            <div className="animate-fadeIn">
              <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-[#FFC107] shadow-sm">
                <h1 className="text-2xl font-semibold">⚙️ Paramètres</h1>
              </div>

              {/* ─── Profil ─── */}
              {(
              <div className="p-6 lg:p-8">
                <div className="bg-white p-8 lg:p-10 rounded-2xl shadow-sm max-w-2xl">
                  <h3 className="text-xl font-bold mb-6">Profil professionnel</h3>

                  {/* Message upload */}
                  {uploadMsg && (
                    <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
                      uploadMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {uploadMsg.text}
                      <button onClick={() => setUploadMsg(null)} className="ml-auto text-gray-500 hover:text-gray-600">✕</button>
                    </div>
                  )}

                  <div className="space-y-5">
                    {/* Photo de profil */}
                    <div>
                      <label className="block mb-2 font-semibold text-sm">Photo de profil</label>
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0 bg-gray-100 flex items-center justify-center">
                          {profilePhotoPreview ? (
                            <img src={profilePhotoPreview} alt="Aperçu" className="w-full h-full object-cover" />
                          ) : (artisan as any)?.profile_photo_url ? (
                            <img src={(artisan as any).profile_photo_url} alt="Photo profil" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-3xl font-bold text-gray-500">{initials}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <label className="cursor-pointer inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition">
                            📷 Choisir une photo
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (!f) return
                              setProfilePhotoFile(f)
                              const reader = new FileReader()
                              reader.onload = (ev) => setProfilePhotoPreview(ev.target?.result as string)
                              reader.readAsDataURL(f)
                            }} />
                          </label>
                          {profilePhotoFile && (
                            <button
                              onClick={() => {
                                uploadDocument(profilePhotoFile, 'profiles', 'profile_photo_url', setProfilePhotoUploading)
                                setProfilePhotoFile(null)
                                setProfilePhotoPreview('')
                              }}
                              disabled={profilePhotoUploading}
                              className="ml-2 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                            >
                              {profilePhotoUploading ? '⏳ Upload...' : '⬆️ Envoyer'}
                            </button>
                          )}
                          <p className="text-xs text-gray-500 mt-1">JPG, PNG ou WEBP — max 10 Mo</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block mb-2 font-semibold text-sm">Nom complet / Entreprise</label>
                      <input type="text" value={settingsForm.company_name} onChange={(e) => setSettingsForm({...settingsForm, company_name: e.target.value})}
                        className="w-full p-3 border-2 border-gray-200 rounded-lg text-base focus:border-[#FFC107] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block mb-2 font-semibold text-sm">Email professionnel</label>
                      <input type="email" value={settingsForm.email} onChange={(e) => setSettingsForm({...settingsForm, email: e.target.value})}
                        className="w-full p-3 border-2 border-gray-200 rounded-lg text-base focus:border-[#FFC107] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block mb-2 font-semibold text-sm">Téléphone</label>
                      <input type="tel" value={settingsForm.phone} onChange={(e) => setSettingsForm({...settingsForm, phone: e.target.value})}
                        className="w-full p-3 border-2 border-gray-200 rounded-lg text-base focus:border-[#FFC107] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block mb-2 font-semibold text-sm">Description / Bio</label>
                      <textarea value={settingsForm.bio} onChange={(e) => setSettingsForm({...settingsForm, bio: e.target.value})}
                        rows={3} placeholder="Décrivez votre activité..."
                        className="w-full p-3 border-2 border-gray-200 rounded-lg text-base focus:border-[#FFC107] focus:outline-none resize-none" />
                    </div>
                    <div>
                      <label className="block mb-2 font-semibold text-sm">Lien de réservation clients</label>
                      <div className="flex items-center gap-2">
                        <input type="text" readOnly value={`${process.env.NEXT_PUBLIC_APP_URL || 'https://fixit-production.vercel.app'}/artisan/${artisan?.slug || artisan?.id || ''}`}
                          className="w-full p-3 border-2 border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600" />
                        <button onClick={() => { navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL || 'https://fixit-production.vercel.app'}/artisan/${artisan?.slug || artisan?.id || ''}`); alert('Lien copié !') }}
                          className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-4 py-3 rounded-lg font-semibold text-sm transition whitespace-nowrap">
                          📋 Copier
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button onClick={saveSettings} disabled={savingSettings}
                        className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50">
                        {savingSettings ? '⏳ Sauvegarde...' : '💾 Enregistrer'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Agenda settings */}
                <div className="bg-white p-8 lg:p-10 rounded-2xl shadow-sm max-w-2xl mt-6">
                  <h3 className="text-xl font-bold mb-6">📅 Paramètres de l&apos;agenda</h3>
                  <div className="space-y-5">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div>
                        <div className="font-semibold">Validation automatique des RDV</div>
                        <p className="text-sm text-gray-500">
                          {autoAccept ? 'Les demandes de RDV clients sont confirmées automatiquement' : 'Vous devez valider manuellement chaque demande de RDV'}
                        </p>
                      </div>
                      <button onClick={toggleAutoAccept} className={`w-14 h-7 rounded-full relative transition-colors ${autoAccept ? 'bg-green-400' : 'bg-gray-300'}`}>
                        <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${autoAccept ? 'translate-x-7' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    {autoAccept && (
                      <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                        <div className="font-semibold mb-2">⚙️ Options d'acceptation auto</div>
                        <label className="text-sm text-gray-600 block mb-1">Durée de blocage par RDV</label>
                        <select
                          value={settingsForm.auto_block_duration_minutes}
                          onChange={e => setSettingsForm({...settingsForm, auto_block_duration_minutes: parseInt(e.target.value)})}
                          className="w-full border border-green-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-green-400"
                        >
                          <option value={60}>1 heure</option>
                          <option value={120}>2 heures</option>
                          <option value={180}>3 heures</option>
                          <option value={240}>4 heures (défaut)</option>
                          <option value={360}>6 heures</option>
                          <option value={480}>8 heures (journée)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Chaque RDV confirmé bloquera ce créneau dans votre agenda</p>
                      </div>
                    )}

                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="font-semibold mb-2">💬 Réponse automatique</div>
                      <p className="text-sm text-gray-500 mb-2">Envoyée au client dès la prise de RDV</p>
                      <textarea
                        value={settingsForm.auto_reply_message}
                        onChange={e => setSettingsForm({...settingsForm, auto_reply_message: e.target.value})}
                        rows={3}
                        placeholder="Ex: Bonjour, merci pour votre réservation ! Pouvez-vous m'envoyer des photos du lieu et les infos d'accès ?"
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107] resize-none"
                      />
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="font-semibold mb-2">📍 Périmètre d'intervention</div>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={5}
                          max={100}
                          step={5}
                          value={settingsForm.zone_radius_km}
                          onChange={e => setSettingsForm({...settingsForm, zone_radius_km: parseInt(e.target.value)})}
                          className="flex-1 accent-[#FFC107]"
                        />
                        <span className="text-lg font-bold text-gray-900 min-w-[60px] text-right">{settingsForm.zone_radius_km} km</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Rayon autour de votre adresse</p>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button onClick={saveSettings} disabled={savingSettings}
                        className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50">
                        {savingSettings ? '⏳ Sauvegarde...' : '💾 Enregistrer les paramètres'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>
          )}

          {/* ────── COMPTABILITÉ ────── */}
          {activePage === 'comptabilite' && (
            <ComptabiliteSection
              bookings={bookings}
              artisan={artisan}
              services={services}
            />
          )}

          {/* ────── MATÉRIAUX & PRIX ────── */}
          {activePage === 'materiaux' && (
            <MateriauxSection
              artisan={artisan}
              onExportDevis={(lines: any[]) => {
                setConvertingDevis({ docType: 'devis', lines })
                setShowDevisForm(true)
                setActivePage('devis')
                setSidebarOpen(false)
              }}
            />
          )}



          {/* ────── WALLET CONFORMITÉ ────── */}
          {activePage === 'wallet' && (
            <WalletConformiteSection artisan={artisan} />
          )}

          {/* ────── CARNET DE VISITE / PORTFOLIO ────── */}
          {activePage === 'portfolio' && (
            <CarnetDeVisiteSection artisan={artisan} />
          )}

          {/* ────── BASE CLIENTS ────── */}
          {activePage === 'clients' && (
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
            <RapportsSection artisan={artisan} bookings={bookings} services={services} />
          )}

          {/* ────── CANAL PRO ────── */}
          {activePage === 'canal' && (
            <CanalProSection artisan={artisan} orgRole={orgRole} />
          )}

          {/* ────── AIDE ────── */}
          {activePage === 'help' && (
            <div className="animate-fadeIn">
              <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-[#FFC107] shadow-sm">
                <h1 className="text-2xl font-semibold">❓ Centre d&apos;aide</h1>
              </div>
              <div className="p-6 lg:p-8 max-w-3xl mx-auto">
                <div className="bg-white p-8 rounded-2xl shadow-sm mb-6">
                  <h2 className="text-xl font-bold mb-4">🚀 Démarrage rapide</h2>
                  <p className="text-gray-500 mb-4 text-lg">Bienvenue sur Vitfix Pro ! Voici comment commencer :</p>
                  <ol className="list-decimal pl-6 text-gray-600 space-y-3 text-lg leading-relaxed">
                    <li>Configurez vos motifs de consultation dans l&apos;onglet &quot;Motifs&quot;</li>
                    <li>Activez votre disponibilité dans le calendrier</li>
                    <li>Créez vos premiers devis et factures conformes</li>
                    <li>Partagez votre lien de réservation avec vos clients</li>
                  </ol>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-sm mb-6">
                  <h2 className="text-xl font-bold mb-4">📚 Guides pratiques</h2>
                  <div className="space-y-3">
                    <button onClick={() => { setShowDevisForm(true); setActivePage('devis'); setSidebarOpen(false) }} className="w-full text-left bg-white text-gray-600 border-2 border-gray-200 px-5 py-4 rounded-lg font-semibold hover:bg-gray-50 hover:border-[#FFC107] transition">📄 Créer un devis conforme</button>
                    <button onClick={() => { setShowFactureForm(true); setActivePage('factures'); setSidebarOpen(false) }} className="w-full text-left bg-white text-gray-600 border-2 border-gray-200 px-5 py-4 rounded-lg font-semibold hover:bg-gray-50 hover:border-[#FFC107] transition">🧾 Créer une facture</button>
                    <button onClick={() => navigateTo('calendar')} className="w-full text-left bg-white text-gray-600 border-2 border-gray-200 px-5 py-4 rounded-lg font-semibold hover:bg-gray-50 hover:border-[#FFC107] transition">📅 Configurer mon agenda</button>
                    <button onClick={() => navigateTo('motifs')} className="w-full text-left bg-white text-gray-600 border-2 border-gray-200 px-5 py-4 rounded-lg font-semibold hover:bg-gray-50 hover:border-[#FFC107] transition">🔧 Gérer mes motifs</button>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-sm">
                  <h2 className="text-xl font-bold mb-4">💬 Support</h2>
                  <p className="text-gray-500 mb-5 text-lg">Notre équipe est là pour vous accompagner :</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl text-center cursor-pointer hover:-translate-y-1 transition-transform">
                      <div className="text-4xl mb-3">📧</div>
                      <div className="font-bold text-lg mb-1">Email</div>
                      <div className="text-gray-500">support@fixit.fr</div>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl text-center cursor-pointer hover:-translate-y-1 transition-transform">
                      <div className="text-4xl mb-3">💬</div>
                      <div className="font-bold text-lg mb-1">Chat en ligne</div>
                      <div className="text-gray-500">Lun-Ven 9h-18h</div>
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
            const [availRes, svcRes, bkRes, dsRes] = await Promise.all([
              fetch(`/api/availability?artisan_id=${artisan.id}`),
              supabase.from('services').select('*').eq('artisan_id', artisan.id).order('created_at'),
              supabase.from('bookings').select('*, services(name)').eq('artisan_id', artisan.id).order('booking_date', { ascending: false }).limit(50),
              fetch(`/api/availability-services?artisan_id=${artisan.id}`),
            ])
            const availJson = await availRes.json()
            setAvailability(availJson.data || [])
            if (svcRes.data) setServices(svcRes.data)
            if (bkRes.data) setBookings(bkRes.data)
            try {
              const dsJson = await dsRes.json()
              if (dsJson.dayServices) setDayServices(dsJson.dayServices)
            } catch {}
          }}
        />
      )}

      {/* ── Modal Messagerie Artisan Dashboard ── */}
      {dashMsgModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDashMsgModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">💬 Messages</h3>
                <p className="text-sm text-gray-500 mt-0.5">{dashMsgModal.services?.name || 'Service'} &bull; {dashMsgModal.booking_date} à {dashMsgModal.booking_time?.substring(0, 5)}</p>
              </div>
              <button onClick={() => setDashMsgModal(null)} className="text-gray-500 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {dashMsgList.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  Aucun message pour ce RDV. Envoyez un message au client.
                </div>
              ) : (
                dashMsgList.map((msg: any) => (
                  <div key={msg.id} className={`flex ${msg.sender_role === 'artisan' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      msg.sender_role === 'artisan'
                        ? 'bg-[#FFC107] text-gray-900'
                        : msg.type === 'auto_reply'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {msg.type === 'auto_reply' && <div className="text-[10px] font-semibold opacity-70 mb-1">Réponse automatique</div>}
                      {msg.sender_role === 'client' && <div className="text-xs font-semibold text-gray-500 mb-1">{msg.sender_name || 'Client'}</div>}
                      <p className="text-sm">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${msg.sender_role === 'artisan' ? 'text-gray-700' : 'text-gray-500'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={dashMsgText}
                  onChange={e => setDashMsgText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendDashMessage()}
                  placeholder="Votre message..."
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]"
                />
                <button
                  onClick={sendDashMessage}
                  disabled={dashMsgSending || !dashMsgText.trim()}
                  className="bg-[#FFC107] hover:bg-amber-500 text-gray-900 px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition"
                >
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
/* ══════════ WALLET CONFORMITÉ ══════════ */

const WALLET_DOCS = [
  { key: 'assurance_decennale', label: 'Assurance Décennale', icon: '🛡️', desc: 'Obligatoire pour les travaux de construction' },
  { key: 'kbis', label: 'Extrait KBIS', icon: '🏢', desc: "Preuve d'existence de l'entreprise" },
  { key: 'urssaf', label: 'Attestation URSSAF', icon: '📋', desc: 'Déclaration de conformité sociale' },
  { key: 'rc_pro', label: 'RC Professionnelle', icon: '⚖️', desc: 'Responsabilité civile professionnelle' },
  { key: 'rge', label: 'Certification RGE', icon: '🌿', desc: 'Reconnu Garant de l\'Environnement' },
  { key: 'carte_pro_btp', label: 'Carte Pro BTP', icon: '🪪', desc: 'Carte professionnelle du bâtiment' },
  { key: 'passeport_prevention', label: 'Passeport Prévention', icon: '🦺', desc: 'Suivi de formation sécurité' },
  { key: 'qualibat', label: 'Qualification Qualibat', icon: '🏅', desc: 'Certification qualité artisan' },
]

interface WalletDoc {
  url?: string
  expiryDate?: string
  uploadedAt?: string
  name?: string
}

function WalletConformiteSection({ artisan }: { artisan: any }) {
  const storageKey = `fixit_wallet_${artisan?.id}`

  const [docs, setDocs] = useState<Record<string, WalletDoc>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}') } catch { return {} }
  })
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [editExpiry, setEditExpiry] = useState<string | null>(null)
  const [sendEmail, setSendEmail] = useState('')
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const saveToStorage = (updated: Record<string, WalletDoc>) => {
    setDocs(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const handleUpload = async (docKey: string, file: File) => {
    if (!artisan?.id) return
    setUploading(prev => ({ ...prev, [docKey]: true }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('bucket', 'artisan-documents')
      fd.append('folder', `wallet/${artisan.id}/${docKey}`)
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
        body: fd,
      })
      const data = await res.json()
      if (data.url) {
        const updated = {
          ...docs,
          [docKey]: {
            ...docs[docKey],
            url: data.url,
            uploadedAt: new Date().toISOString(),
            name: file.name,
          }
        }
        saveToStorage(updated)
      }
    } catch (e) {
      console.error('Upload wallet doc error:', e)
    } finally {
      setUploading(prev => ({ ...prev, [docKey]: false }))
    }
  }

  const setExpiry = (docKey: string, date: string) => {
    const updated = { ...docs, [docKey]: { ...docs[docKey], expiryDate: date } }
    saveToStorage(updated)
    setEditExpiry(null)
  }

  const removeDoc = (docKey: string) => {
    const updated = { ...docs }
    delete updated[docKey]
    saveToStorage(updated)
  }

  const getStatus = (doc: WalletDoc | undefined): 'missing' | 'valid' | 'expiring' | 'expired' => {
    if (!doc?.url) return 'missing'
    if (!doc.expiryDate) return 'valid'
    const exp = new Date(doc.expiryDate)
    const now = new Date()
    const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    if (diff < 0) return 'expired'
    if (diff < 60) return 'expiring'
    return 'valid'
  }

  const statusBadge = (status: 'missing' | 'valid' | 'expiring' | 'expired') => {
    const map = {
      missing: { label: 'Manquant', bg: 'bg-gray-100', text: 'text-gray-500' },
      valid: { label: 'Valide', bg: 'bg-green-100', text: 'text-green-700' },
      expiring: { label: 'Expire bientôt', bg: 'bg-amber-100', text: 'text-amber-700' },
      expired: { label: 'Expiré', bg: 'bg-red-100', text: 'text-red-600' },
    }
    const s = map[status]
    return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
  }

  const validCount = WALLET_DOCS.filter(d => getStatus(docs[d.key]) === 'valid').length

  const handleSendDossier = () => {
    const lines = WALLET_DOCS
      .filter(d => docs[d.key]?.url)
      .map(d => `${d.label} : ${docs[d.key].url}`)
      .join('\n')
    const subject = encodeURIComponent(`Dossier de conformité — ${artisan?.company_name || 'Artisan'}`)
    const body = encodeURIComponent(
      `Bonjour,\n\nVeuillez trouver ci-dessous les documents de conformité de ${artisan?.company_name || 'mon entreprise'} :\n\n${lines}\n\nCordialement,\n${artisan?.company_name || ''}`
    )
    const recipient = encodeURIComponent(sendEmail || '')
    window.open(`mailto:${recipient}?subject=${subject}&body=${body}`)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🗂️ Wallet Conformité</h1>
          <p className="text-gray-500 text-sm mt-1">Centralisez vos documents légaux et envoyez votre dossier aux syndics et clients</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-gray-900">{validCount}/{WALLET_DOCS.length}</div>
          <div className="text-xs text-gray-500">documents valides</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-8">
        <div
          className="h-2 rounded-full transition-all"
          style={{
            width: `${(validCount / WALLET_DOCS.length) * 100}%`,
            background: validCount === WALLET_DOCS.length ? '#22c55e' : validCount >= 4 ? '#FFC107' : '#f87171',
          }}
        />
      </div>

      {/* Document cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {WALLET_DOCS.map(docDef => {
          const doc = docs[docDef.key]
          const status = getStatus(doc)
          return (
            <div key={docDef.key} className={`bg-white border-2 rounded-2xl p-4 transition-all ${status === 'expired' ? 'border-red-200' : status === 'expiring' ? 'border-amber-200' : status === 'valid' ? 'border-green-200' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{docDef.icon}</span>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{docDef.label}</div>
                    <div className="text-xs text-gray-500">{docDef.desc}</div>
                  </div>
                </div>
                {statusBadge(status)}
              </div>

              {doc?.url && (
                <div className="mt-3 p-2 bg-gray-50 rounded-lg flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-600 font-medium truncate">{doc.name || 'Document uploadé'}</div>
                    {doc.expiryDate && (
                      <div className="text-xs text-gray-500">Expire : {new Date(doc.expiryDate).toLocaleDateString('fr-FR')}</div>
                    )}
                    {doc.uploadedAt && (
                      <div className="text-xs text-gray-300">Ajouté le {new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}</div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <a href={doc.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 text-xs p-1 rounded hover:bg-blue-50">👁️</a>
                    <button onClick={() => removeDoc(docDef.key)} className="text-red-400 hover:text-red-600 text-xs p-1 rounded hover:bg-red-50">🗑️</button>
                  </div>
                </div>
              )}

              <div className="mt-3 flex gap-2 flex-wrap">
                {/* Upload button */}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  ref={el => { fileInputRefs.current[docDef.key] = el }}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleUpload(docDef.key, f)
                    e.target.value = ''
                  }}
                />
                <button
                  onClick={() => fileInputRefs.current[docDef.key]?.click()}
                  disabled={uploading[docDef.key]}
                  className="flex items-center gap-1 text-xs bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-3 py-1.5 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {uploading[docDef.key] ? '⏳ Upload...' : doc?.url ? '🔄 Remplacer' : '📎 Ajouter'}
                </button>

                {/* Expiry date */}
                {editExpiry === docDef.key ? (
                  <div className="flex gap-1 items-center">
                    <input
                      type="date"
                      className="text-xs border border-gray-200 rounded px-2 py-1"
                      defaultValue={doc?.expiryDate || ''}
                      onBlur={e => setExpiry(docDef.key, e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => setEditExpiry(null)} className="text-xs text-gray-500">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditExpiry(docDef.key)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition"
                  >
                    📅 {doc?.expiryDate ? 'Échéance' : 'Ajouter échéance'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Send dossier */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
        <div className="font-bold text-gray-900 mb-1">📤 Envoyer mon dossier de conformité</div>
        <p className="text-sm text-gray-500 mb-4">Envoyez tous vos documents valides par email à un syndic, client ou gestionnaire</p>
        <div className="flex gap-3">
          <input
            type="email"
            placeholder="Email du destinataire..."
            value={sendEmail}
            onChange={e => setSendEmail(e.target.value)}
            className="flex-1 border border-blue-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white"
          />
          <button
            onClick={handleSendDossier}
            disabled={WALLET_DOCS.filter(d => docs[d.key]?.url).length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-50 whitespace-nowrap"
          >
            📧 Envoyer le dossier
          </button>
        </div>
        {WALLET_DOCS.filter(d => docs[d.key]?.url).length === 0 && (
          <p className="text-xs text-gray-500 mt-2">⚠️ Uploadez au moins un document pour pouvoir envoyer le dossier</p>
        )}
      </div>
    </div>
  )
}

/* ══════════ CARNET DE VISITE / PORTFOLIO ══════════ */

const PORTFOLIO_CATEGORIES = ['Plomberie', 'Électricité', 'Peinture', 'Maçonnerie', 'Menuiserie', 'Carrelage', 'Chauffage', 'Toiture', 'Autre']

interface PortfolioPhoto {
  id: string
  url: string
  title: string
  category: string
  uploadedAt: string
}

function CarnetDeVisiteSection({ artisan }: { artisan: any }) {
  const storageKey = `fixit_portfolio_${artisan?.id}`

  const [photos, setPhotos] = useState<PortfolioPhoto[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('Autre')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PortfolioPhoto | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const saveToStorage = (updated: PortfolioPhoto[]) => {
    setPhotos(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const handleFileSelect = (file: File) => {
    setPendingFile(file)
    setNewTitle(file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
    setShowForm(true)
  }

  const handleUpload = async () => {
    if (!pendingFile || !artisan?.id) return
    setUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const authHeaders: Record<string, string> = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
      const fd = new FormData()
      fd.append('file', pendingFile)
      fd.append('bucket', 'artisan-documents')
      fd.append('folder', `portfolio/${artisan.id}`)
      const res = await fetch('/api/upload', { method: 'POST', headers: authHeaders, body: fd })
      const data = await res.json()
      if (data.url) {
        const newPhoto: PortfolioPhoto = {
          id: Date.now().toString(),
          url: data.url,
          title: newTitle || 'Réalisation',
          category: newCategory,
          uploadedAt: new Date().toISOString(),
        }
        const updated = [newPhoto, ...photos]
        saveToStorage(updated)

        // Also save to profiles_artisan.portfolio_photos if possible
        try {
          await fetch('/api/upload', {
            method: 'POST',
            headers: authHeaders,
            body: (() => {
              const fd2 = new FormData()
              fd2.append('artisan_id', artisan.id)
              fd2.append('field', 'portfolio_photo')
              fd2.append('photo_url', data.url)
              fd2.append('photo_meta', JSON.stringify({ title: newTitle, category: newCategory }))
              return fd2
            })(),
          })
        } catch { /* best effort */ }
      }
      setShowForm(false)
      setPendingFile(null)
      setNewTitle('')
      setNewCategory('Autre')
    } catch (e) {
      console.error('Portfolio upload error:', e)
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = (id: string) => {
    saveToStorage(photos.filter(p => p.id !== id))
  }

  const categories = ['Toutes', ...PORTFOLIO_CATEGORIES.filter(c => photos.some(p => p.category === c))]
  const [activeCategory, setActiveCategory] = useState('Toutes')
  const filtered = activeCategory === 'Toutes' ? photos : photos.filter(p => p.category === activeCategory)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📸 Carnet de Visite</h1>
          <p className="text-gray-500 text-sm mt-1">Vos réalisations visibles sur votre profil public — montrez votre savoir-faire</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-3xl font-black text-gray-900">{photos.length}</div>
            <div className="text-xs text-gray-500">réalisations</div>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2"
          >
            ➕ Ajouter une photo
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleFileSelect(f)
          e.target.value = ''
        }}
      />

      {/* Upload form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-bold text-lg text-gray-900 mb-4">📸 Nouvelle réalisation</h3>
            {pendingFile && (
              <div className="mb-4 rounded-xl overflow-hidden bg-gray-100 h-40 flex items-center justify-center">
                <img
                  src={URL.createObjectURL(pendingFile)}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Titre de la réalisation</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Ex: Remplacement chauffe-eau 300L, Pose carrelage salle de bain..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Catégorie</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]"
                >
                  {PORTFOLIO_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowForm(false); setPendingFile(null) }}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 font-semibold text-sm hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !newTitle.trim()}
                className="flex-1 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 rounded-xl py-2.5 font-bold text-sm transition disabled:opacity-50"
              >
                {uploading ? '⏳ Upload en cours...' : '✅ Publier la réalisation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo lightbox */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img src={preview.url} alt={preview.title} className="w-full rounded-2xl" />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 rounded-b-2xl p-4">
              <div className="font-bold text-white">{preview.title}</div>
              <div className="text-sm text-gray-300">{preview.category} · {new Date(preview.uploadedAt).toLocaleDateString('fr-FR')}</div>
            </div>
            <button onClick={() => setPreview(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70">✕</button>
          </div>
        </div>
      )}

      {/* Category filter tabs */}
      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-6">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${activeCategory === cat ? 'bg-[#FFC107] text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Photo grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📷</div>
          <div className="text-xl font-bold text-gray-700 mb-2">Aucune réalisation</div>
          <p className="text-gray-500 mb-6">Ajoutez vos photos de chantier pour convaincre vos futurs clients</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-3 rounded-xl font-bold transition-all"
          >
            📸 Ajouter ma première réalisation
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(photo => (
            <div key={photo.id} className="group relative bg-gray-100 rounded-2xl overflow-hidden aspect-square cursor-pointer" onClick={() => setPreview(photo)}>
              <img src={photo.url} alt={photo.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                <div className="text-white font-semibold text-sm truncate">{photo.title}</div>
                <div className="text-gray-300 text-xs">{photo.category}</div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); removePhoto(photo.id) }}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 items-center justify-center text-xs hidden group-hover:flex hover:bg-red-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-700">
            💡 Ces photos sont visibles par les clients sur votre{' '}
            <a href={`/artisan/${artisan?.id}`} target="_blank" rel="noreferrer" className="font-bold underline">profil public →</a>
          </p>
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

function PageHeader({ title, actionLabel, onAction }: { title: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-[#FFC107] flex justify-between items-center shadow-sm">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <button onClick={onAction}
        className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm">
        {actionLabel}
      </button>
    </div>
  )
}


/* ══════════ ÉQUIPES BTP SECTION ══════════ */
function EquipesBTPSection({ artisan }: { artisan: any }) {
  const storageKey = `fixit_equipes_${artisan?.id}`
  const [equipes, setEquipes] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nom: '', chef: '', metier: '', membres: '', telephone: '', disponible: true })

  const handleSave = () => {
    if (!form.nom.trim()) return
    const newEquipe = { id: Date.now().toString(), ...form, membres: parseInt(form.membres) || 1, createdAt: new Date().toISOString() }
    const updated = [...equipes, newEquipe]
    setEquipes(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setShowModal(false)
    setForm({ nom: '', chef: '', metier: '', membres: '', telephone: '', disponible: true })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Supprimer cette équipe ?')) return
    const updated = equipes.filter(e => e.id !== id)
    setEquipes(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const toggleDispo = (id: string) => {
    const updated = equipes.map(e => e.id === id ? { ...e, disponible: !e.disponible } : e)
    setEquipes(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const METIERS = ['Maçonnerie', 'Plomberie', 'Électricité', 'Menuiserie', 'Peinture', 'Carrelage', 'Charpente', 'Couverture', 'Isolation', 'Démolition', 'VRD', 'Étanchéité', 'Serrurerie', 'Climatisation', 'Multi-corps']

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-blue-500 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-semibold">👷 Gestion des équipes</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition shadow-sm">+ Nouvelle équipe</button>
      </div>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-500">
            <div className="text-sm text-gray-500 mb-1">Équipes totales</div>
            <div className="text-3xl font-bold text-blue-600">{equipes.length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-500">
            <div className="text-sm text-gray-500 mb-1">Disponibles</div>
            <div className="text-3xl font-bold text-green-600">{equipes.filter(e => e.disponible).length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-orange-500">
            <div className="text-sm text-gray-500 mb-1">Total membres</div>
            <div className="text-3xl font-bold text-orange-600">{equipes.reduce((s, e) => s + (e.membres || 1), 0)}</div>
          </div>
        </div>

        {equipes.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">👷</div>
            <h3 className="text-xl font-bold mb-2">Aucune équipe</h3>
            <p className="text-gray-500 mb-6">Créez vos premières équipes pour organiser vos chantiers</p>
            <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition">+ Créer une équipe</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {equipes.map(eq => (
              <div key={eq.id} className={`bg-white rounded-2xl shadow-sm p-6 border-2 ${eq.disponible ? 'border-green-200' : 'border-orange-200'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{eq.nom}</h3>
                    <span className="text-sm text-blue-600 font-medium">{eq.metier}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${eq.disponible ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {eq.disponible ? '✅ Dispo' : '🔒 Occupée'}
                  </span>
                </div>
                {eq.chef && <p className="text-sm text-gray-600 mb-1">👤 Chef : <strong>{eq.chef}</strong></p>}
                {eq.telephone && <p className="text-sm text-gray-600 mb-1">📱 {eq.telephone}</p>}
                <p className="text-sm text-gray-600 mb-4">👥 {eq.membres} membre(s)</p>
                <div className="flex gap-2">
                  <button onClick={() => toggleDispo(eq.id)} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${eq.disponible ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                    {eq.disponible ? 'Marquer occupée' : 'Marquer disponible'}
                  </button>
                  <button onClick={() => handleDelete(eq.id)} className="px-3 py-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition text-sm">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">👷 Nouvelle équipe</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Nom de l&apos;équipe *</label>
                <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Ex: Équipe Plomberie A" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Corps de métier</label>
                <select value={form.metier} onChange={e => setForm({...form, metier: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none">
                  <option value="">Choisir...</option>
                  {METIERS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Chef d&apos;équipe</label>
                <input value={form.chef} onChange={e => setForm({...form, chef: e.target.value})} placeholder="Prénom Nom" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Téléphone</label>
                  <input value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} placeholder="06..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Nb membres</label>
                  <input type="number" min="1" value={form.membres} onChange={e => setForm({...form, membres: e.target.value})} placeholder="1" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition">Annuler</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition">Créer l&apos;équipe</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ CHANTIERS BTP SECTION ══════════ */
function ChantiersBTPSection({ artisan, bookings }: { artisan: any; bookings: any[] }) {
  const storageKey = `fixit_chantiers_${artisan?.id}`
  const [chantiers, setChantiers] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'Tous' | 'En cours' | 'Terminés' | 'En attente'>('Tous')
  const [form, setForm] = useState({ titre: '', client: '', adresse: '', dateDebut: '', dateFin: '', budget: '', statut: 'En attente', description: '', equipe: '' })

  const handleSave = () => {
    if (!form.titre.trim()) return
    const c = { id: Date.now().toString(), ...form, createdAt: new Date().toISOString() }
    const updated = [c, ...chantiers]
    setChantiers(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setShowModal(false)
    setForm({ titre: '', client: '', adresse: '', dateDebut: '', dateFin: '', budget: '', statut: 'En attente', description: '', equipe: '' })
  }

  const changeStatut = (id: string, statut: string) => {
    const updated = chantiers.map(c => c.id === id ? { ...c, statut } : c)
    setChantiers(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const filtered = filter === 'Tous' ? chantiers : chantiers.filter(c => c.statut === filter)
  const STATUS_COLORS: Record<string, string> = { 'En cours': 'bg-blue-100 text-blue-700', 'Terminé': 'bg-green-100 text-green-700', 'En attente': 'bg-orange-100 text-orange-700', 'Annulé': 'bg-red-100 text-red-700' }

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-blue-500 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-semibold">📋 Chantiers</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition shadow-sm">+ Nouveau chantier</button>
      </div>
      <div className="p-6 lg:p-8">
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['Tous', 'En cours', 'En attente', 'Terminés'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full font-semibold text-sm transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{f} {f === 'Tous' ? `(${chantiers.length})` : `(${chantiers.filter(c => c.statut === (f === 'Terminés' ? 'Terminé' : f)).length})`}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🏗️</div>
            <h3 className="text-xl font-bold mb-2">Aucun chantier</h3>
            <p className="text-gray-500 mb-6">Créez votre premier chantier</p>
            <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition">+ Créer un chantier</button>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(c => (
              <div key={c.id} className="bg-white rounded-2xl shadow-sm p-6 flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-lg">{c.titre}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[c.statut] || 'bg-gray-100 text-gray-700'}`}>{c.statut}</span>
                  </div>
                  {c.client && <p className="text-sm text-gray-600 mb-1">👤 {c.client}</p>}
                  {c.adresse && <p className="text-sm text-gray-600 mb-1">📍 {c.adresse}</p>}
                  {(c.dateDebut || c.dateFin) && <p className="text-sm text-gray-600 mb-1">📅 {c.dateDebut || '?'} → {c.dateFin || '?'}</p>}
                  {c.budget && <p className="text-sm text-gray-600 mb-1">💰 Budget : {c.budget} €</p>}
                  {c.description && <p className="text-sm text-gray-500 mt-2">{c.description}</p>}
                </div>
                <div className="flex flex-col gap-2 min-w-[160px]">
                  <select value={c.statut} onChange={e => changeStatut(c.id, e.target.value)} className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:border-blue-500 outline-none">
                    {['En attente', 'En cours', 'Terminé', 'Annulé'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">📋 Nouveau chantier</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Titre du chantier *</label>
                <input value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} placeholder="Ex: Rénovation salle de bain - Apt 12" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Client</label>
                  <input value={form.client} onChange={e => setForm({...form, client: e.target.value})} placeholder="Nom du client" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Budget (€)</label>
                  <input type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Adresse</label>
                <input value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} placeholder="Adresse du chantier" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Date début</label>
                  <input type="date" value={form.dateDebut} onChange={e => setForm({...form, dateDebut: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Date fin</label>
                  <input type="date" value={form.dateFin} onChange={e => setForm({...form, dateFin: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder="Description des travaux..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none resize-none" />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition">Annuler</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition">Créer le chantier</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ PROPRIÉTÉS CONCIERGERIE SECTION ══════════ */
function ProprietesConciergerieSection({ artisan }: { artisan: any }) {
  const storageKey = `fixit_proprietes_${artisan?.id}`
  const [proprietes, setProprietes] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nom: '', adresse: '', proprietaire: '', telephone: '', typeLogement: 'Appartement', nombrePieces: '', etage: '', digicode: '', notesAcces: '', loyer: '', etatMenage: 'Propre' })

  const handleSave = () => {
    if (!form.nom.trim()) return
    const p = { id: Date.now().toString(), ...form, createdAt: new Date().toISOString() }
    const updated = [p, ...proprietes]
    setProprietes(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setShowModal(false)
    setForm({ nom: '', adresse: '', proprietaire: '', telephone: '', typeLogement: 'Appartement', nombrePieces: '', etage: '', digicode: '', notesAcces: '', loyer: '', etatMenage: 'Propre' })
  }

  const ETATS = ['Propre', 'À nettoyer', 'En maintenance', 'Occupé', 'Vacant']
  const ETAT_COLORS: Record<string, string> = { 'Propre': 'bg-green-100 text-green-700', 'À nettoyer': 'bg-yellow-100 text-yellow-700', 'En maintenance': 'bg-orange-100 text-orange-700', 'Occupé': 'bg-blue-100 text-blue-700', 'Vacant': 'bg-gray-100 text-gray-700' }

  const updateEtat = (id: string, etat: string) => {
    const updated = proprietes.map(p => p.id === id ? { ...p, etatMenage: etat } : p)
    setProprietes(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-purple-500 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-semibold">🏠 Propriétés gérées</h1>
        <button onClick={() => setShowModal(true)} className="bg-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-purple-700 transition shadow-sm">+ Nouvelle propriété</button>
      </div>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-purple-500">
            <div className="text-sm text-gray-500 mb-1">Total propriétés</div>
            <div className="text-3xl font-bold text-purple-600">{proprietes.length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-500">
            <div className="text-sm text-gray-500 mb-1">Propres / Prêtes</div>
            <div className="text-3xl font-bold text-green-600">{proprietes.filter(p => p.etatMenage === 'Propre').length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-orange-500">
            <div className="text-sm text-gray-500 mb-1">À traiter</div>
            <div className="text-3xl font-bold text-orange-600">{proprietes.filter(p => p.etatMenage === 'À nettoyer' || p.etatMenage === 'En maintenance').length}</div>
          </div>
        </div>

        {proprietes.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🏠</div>
            <h3 className="text-xl font-bold mb-2">Aucune propriété</h3>
            <p className="text-gray-500 mb-6">Ajoutez les propriétés que vous gérez</p>
            <button onClick={() => setShowModal(true)} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition">+ Ajouter une propriété</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {proprietes.map(p => (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm p-6 border-2 border-gray-100 hover:border-purple-200 transition">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{p.nom}</h3>
                    <span className="text-sm text-gray-500">{p.typeLogement} · {p.nombrePieces ? `${p.nombrePieces} pièces` : ''}</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${ETAT_COLORS[p.etatMenage] || 'bg-gray-100 text-gray-700'}`}>{p.etatMenage}</span>
                </div>
                {p.adresse && <p className="text-sm text-gray-600 mb-1">📍 {p.adresse}</p>}
                {p.proprietaire && <p className="text-sm text-gray-600 mb-1">👤 {p.proprietaire}</p>}
                {p.telephone && <p className="text-sm text-gray-600 mb-1">📱 {p.telephone}</p>}
                {p.loyer && <p className="text-sm text-gray-600 mb-3">💰 Loyer : {p.loyer} €/mois</p>}
                <select value={p.etatMenage} onChange={e => updateEtat(p.id, e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:border-purple-500 outline-none mt-2">
                  {ETATS.map(e => <option key={e}>{e}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">🏠 Nouvelle propriété</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Nom / Référence *</label>
                <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Ex: Apt Paris 11 - Dupont" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Type</label>
                  <select value={form.typeLogement} onChange={e => setForm({...form, typeLogement: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none">
                    {['Appartement', 'Maison', 'Studio', 'Villa', 'Loft', 'Commerce'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Nb pièces</label>
                  <input type="number" value={form.nombrePieces} onChange={e => setForm({...form, nombrePieces: e.target.value})} placeholder="3" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Adresse</label>
                <input value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} placeholder="123 rue de la Paix, 75001 Paris" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Propriétaire</label>
                  <input value={form.proprietaire} onChange={e => setForm({...form, proprietaire: e.target.value})} placeholder="Nom du propriétaire" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Téléphone</label>
                  <input value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} placeholder="06..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Digicode / Accès</label>
                  <input value={form.digicode} onChange={e => setForm({...form, digicode: e.target.value})} placeholder="A1234" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Loyer (€/mois)</label>
                  <input type="number" value={form.loyer} onChange={e => setForm({...form, loyer: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Notes d&apos;accès</label>
                <textarea value={form.notesAcces} onChange={e => setForm({...form, notesAcces: e.target.value})} rows={2} placeholder="Bâtiment B, 3ème étage, code boîte aux lettres..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none resize-none" />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition">Annuler</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition">Ajouter la propriété</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ ACCÈS & CLÉS CONCIERGERIE SECTION ══════════ */
function AccesConciergerieSection({ artisan }: { artisan: any }) {
  const storageKey = `fixit_acces_${artisan?.id}`
  const [acces, setAcces] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ propriete: '', typeAcces: 'Clé physique', localisation: '', code: '', responsable: '', notes: '', statut: 'Disponible' })

  const handleSave = () => {
    if (!form.propriete.trim()) return
    const a = { id: Date.now().toString(), ...form, createdAt: new Date().toISOString() }
    const updated = [a, ...acces]
    setAcces(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setShowModal(false)
    setForm({ propriete: '', typeAcces: 'Clé physique', localisation: '', code: '', responsable: '', notes: '', statut: 'Disponible' })
  }

  const STATUTS = ['Disponible', 'En prêt', 'Perdu', 'Dupliqué']
  const STATUT_COLORS: Record<string, string> = { 'Disponible': 'bg-green-100 text-green-700', 'En prêt': 'bg-yellow-100 text-yellow-700', 'Perdu': 'bg-red-100 text-red-700', 'Dupliqué': 'bg-blue-100 text-blue-700' }

  const updateStatut = (id: string, statut: string) => {
    const updated = acces.map(a => a.id === id ? { ...a, statut } : a)
    setAcces(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-purple-500 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-semibold">🔑 Accès &amp; Clés</h1>
        <button onClick={() => setShowModal(true)} className="bg-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-purple-700 transition shadow-sm">+ Nouvel accès</button>
      </div>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-green-400 text-center">
            <div className="text-2xl font-bold text-green-600">{acces.filter(a => a.statut === 'Disponible').length}</div>
            <div className="text-xs text-gray-500 mt-1">Disponibles</div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-yellow-400 text-center">
            <div className="text-2xl font-bold text-yellow-600">{acces.filter(a => a.statut === 'En prêt').length}</div>
            <div className="text-xs text-gray-500 mt-1">En prêt</div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-red-400 text-center">
            <div className="text-2xl font-bold text-red-600">{acces.filter(a => a.statut === 'Perdu').length}</div>
            <div className="text-xs text-gray-500 mt-1">Perdus</div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-purple-400 text-center">
            <div className="text-2xl font-bold text-purple-600">{acces.length}</div>
            <div className="text-xs text-gray-500 mt-1">Total</div>
          </div>
        </div>

        {acces.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🔑</div>
            <h3 className="text-xl font-bold mb-2">Aucun accès enregistré</h3>
            <p className="text-gray-500 mb-6">Gérez les clés et codes d&apos;accès de vos propriétés</p>
            <button onClick={() => setShowModal(true)} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition">+ Ajouter un accès</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {acces.map(a => (
              <div key={a.id} className="bg-white rounded-2xl shadow-sm p-5 border-2 border-gray-100">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold">{a.propriete}</h3>
                    <span className="text-sm text-purple-600">{a.typeAcces}</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUT_COLORS[a.statut] || ''}`}>{a.statut}</span>
                </div>
                {a.localisation && <p className="text-sm text-gray-600 mb-1">📍 {a.localisation}</p>}
                {a.code && <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mb-1">🔢 {a.code}</p>}
                {a.responsable && <p className="text-sm text-gray-600 mb-2">👤 {a.responsable}</p>}
                <select value={a.statut} onChange={e => updateStatut(a.id, e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold focus:border-purple-500 outline-none">
                  {STATUTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">🔑 Nouvel accès / Clé</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Propriété *</label>
                <input value={form.propriete} onChange={e => setForm({...form, propriete: e.target.value})} placeholder="Nom de la propriété" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Type d&apos;accès</label>
                  <select value={form.typeAcces} onChange={e => setForm({...form, typeAcces: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none">
                    {['Clé physique', 'Digicode', 'Badge', 'Application', 'Boîte à clés'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Code / Référence</label>
                  <input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="A1234 / #5" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Localisation (où est rangée la clé)</label>
                <input value={form.localisation} onChange={e => setForm({...form, localisation: e.target.value})} placeholder="Armoire bureau, boîte clés n°3..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Responsable</label>
                <input value={form.responsable} onChange={e => setForm({...form, responsable: e.target.value})} placeholder="Nom du responsable" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder="Informations supplémentaires..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-500 outline-none resize-none" />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition">Annuler</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ IMMEUBLES GESTIONNAIRE SECTION ══════════ */
function ImmeublesGestionnaireSection({ artisan }: { artisan: any }) {
  const storageKey = `fixit_imm_gest_${artisan?.id}`
  const [immeubles, setImmeubles] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nom: '', adresse: '', lots: '', anneeConstruction: '', syndic: '', gestionnaire: '', typeImmeuble: 'Résidentiel', charges: '', notes: '' })

  const handleSave = () => {
    if (!form.nom.trim()) return
    const i = { id: Date.now().toString(), ...form, createdAt: new Date().toISOString() }
    const updated = [i, ...immeubles]
    setImmeubles(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setShowModal(false)
    setForm({ nom: '', adresse: '', lots: '', anneeConstruction: '', syndic: '', gestionnaire: '', typeImmeuble: 'Résidentiel', charges: '', notes: '' })
  }

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-green-500 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-semibold">🏢 Immeubles gérés</h1>
        <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-700 transition shadow-sm">+ Nouvel immeuble</button>
      </div>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-500">
            <div className="text-sm text-gray-500 mb-1">Immeubles gérés</div>
            <div className="text-3xl font-bold text-green-600">{immeubles.length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-500">
            <div className="text-sm text-gray-500 mb-1">Total lots</div>
            <div className="text-3xl font-bold text-blue-600">{immeubles.reduce((s, i) => s + (parseInt(i.lots) || 0), 0)}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-amber-500">
            <div className="text-sm text-gray-500 mb-1">Résidentiels</div>
            <div className="text-3xl font-bold text-amber-600">{immeubles.filter(i => i.typeImmeuble === 'Résidentiel').length}</div>
          </div>
        </div>

        {immeubles.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-xl font-bold mb-2">Aucun immeuble</h3>
            <p className="text-gray-500 mb-6">Ajoutez les immeubles que vous gérez</p>
            <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition">+ Ajouter un immeuble</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {immeubles.map(im => (
              <div key={im.id} className="bg-white rounded-2xl shadow-sm p-6 border-2 border-gray-100 hover:border-green-200 transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{im.nom}</h3>
                    <span className="text-sm text-green-600">{im.typeImmeuble}</span>
                  </div>
                  <span className="bg-green-50 text-green-700 px-2 py-1 rounded-lg text-xs font-bold">{im.lots || 0} lots</span>
                </div>
                {im.adresse && <p className="text-sm text-gray-600 mb-1">📍 {im.adresse}</p>}
                {im.anneeConstruction && <p className="text-sm text-gray-600 mb-1">🏗️ Construit en {im.anneeConstruction}</p>}
                {im.syndic && <p className="text-sm text-gray-600 mb-1">🤝 Syndic : {im.syndic}</p>}
                {im.charges && <p className="text-sm text-gray-600">💰 Charges : {im.charges} €/mois</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">🏢 Nouvel immeuble</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Nom / Résidence *</label>
                <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Résidence Les Pins" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Type</label>
                  <select value={form.typeImmeuble} onChange={e => setForm({...form, typeImmeuble: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none">
                    {['Résidentiel', 'Commercial', 'Mixte', 'Bureaux'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Nombre de lots</label>
                  <input type="number" value={form.lots} onChange={e => setForm({...form, lots: e.target.value})} placeholder="12" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Adresse</label>
                <input value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} placeholder="12 allée des Roses, 69001 Lyon" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Année construction</label>
                  <input type="number" value={form.anneeConstruction} onChange={e => setForm({...form, anneeConstruction: e.target.value})} placeholder="1985" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Charges (€/mois)</label>
                  <input type="number" value={form.charges} onChange={e => setForm({...form, charges: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Syndic</label>
                <input value={form.syndic} onChange={e => setForm({...form, syndic: e.target.value})} placeholder="Nom du syndic" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder="Informations utiles..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none resize-none" />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition">Annuler</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ MISSIONS GESTIONNAIRE SECTION ══════════ */
function MissionsGestionnaireSection({ artisan, bookings }: { artisan: any; bookings: any[] }) {
  const storageKey = `fixit_missions_gest_${artisan?.id}`
  const [missions, setMissions] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'Toutes' | 'Urgentes' | 'En cours' | 'Terminées'>('Toutes')
  const [form, setForm] = useState({ titre: '', immeuble: '', lot: '', locataire: '', type: 'Plomberie', priorite: 'normale', description: '', artisan: '', dateIntervention: '', devis: '' })

  const handleSave = () => {
    if (!form.titre.trim() && !form.type.trim()) return
    const m = { id: Date.now().toString(), ...form, statut: 'En attente', createdAt: new Date().toISOString() }
    const updated = [m, ...missions]
    setMissions(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setShowModal(false)
    setForm({ titre: '', immeuble: '', lot: '', locataire: '', type: 'Plomberie', priorite: 'normale', description: '', artisan: '', dateIntervention: '', devis: '' })
  }

  const changeStatut = (id: string, statut: string) => {
    const updated = missions.map(m => m.id === id ? { ...m, statut } : m)
    setMissions(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const filtered = filter === 'Toutes' ? missions : filter === 'Urgentes' ? missions.filter(m => m.priorite === 'urgente') : filter === 'En cours' ? missions.filter(m => m.statut === 'En cours') : missions.filter(m => m.statut === 'Terminée')
  const PRIO_COLORS: Record<string, string> = { 'urgente': 'bg-red-100 text-red-700', 'haute': 'bg-orange-100 text-orange-700', 'normale': 'bg-blue-100 text-blue-700', 'basse': 'bg-gray-100 text-gray-700' }
  const STATUS_COLORS: Record<string, string> = { 'En attente': 'bg-orange-100 text-orange-700', 'En cours': 'bg-blue-100 text-blue-700', 'Terminée': 'bg-green-100 text-green-700', 'Annulée': 'bg-red-100 text-red-700' }
  const TYPES = ['Plomberie', 'Électricité', 'Serrurerie', 'Chauffage', 'Climatisation', 'Menuiserie', 'Vitrerie', 'Peinture', 'Maçonnerie', 'Nettoyage', 'Ascenseur', 'Parties communes', 'Autre']

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-green-500 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-semibold">📋 Ordres de mission</h1>
        <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-700 transition shadow-sm">+ Nouvel ordre</button>
      </div>
      <div className="p-6 lg:p-8">
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['Toutes', 'Urgentes', 'En cours', 'Terminées'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full font-semibold text-sm transition ${filter === f ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{f} ({f === 'Toutes' ? missions.length : f === 'Urgentes' ? missions.filter(m => m.priorite === 'urgente').length : f === 'En cours' ? missions.filter(m => m.statut === 'En cours').length : missions.filter(m => m.statut === 'Terminée').length})</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-bold mb-2">Aucun ordre de mission</h3>
            <p className="text-gray-500 mb-6">Créez votre premier ordre de mission</p>
            <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition">+ Créer un ordre</button>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(m => (
              <div key={m.id} className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-bold text-lg">{m.titre || m.type}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${PRIO_COLORS[m.priorite] || ''}`}>{m.priorite}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[m.statut] || ''}`}>{m.statut}</span>
                    </div>
                    {m.immeuble && <p className="text-sm text-gray-600 mb-1">🏢 {m.immeuble}{m.lot ? ` — Lot ${m.lot}` : ''}</p>}
                    {m.locataire && <p className="text-sm text-gray-600 mb-1">👤 {m.locataire}</p>}
                    <p className="text-sm text-gray-600 mb-1">🔧 {m.type}</p>
                    {m.artisan && <p className="text-sm text-gray-600 mb-1">👷 {m.artisan}</p>}
                    {m.dateIntervention && <p className="text-sm text-gray-600 mb-1">📅 {m.dateIntervention}</p>}
                    {m.description && <p className="text-sm text-gray-500 mt-2">{m.description}</p>}
                  </div>
                  <div className="min-w-[160px]">
                    <select value={m.statut} onChange={e => changeStatut(m.id, e.target.value)} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:border-green-500 outline-none">
                      {['En attente', 'En cours', 'Terminée', 'Annulée'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">📋 Nouvel ordre de mission</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Titre (optionnel)</label>
                <input value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} placeholder="Ex: Fuite robinet cuisine" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Type *</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none">
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Priorité</label>
                  <select value={form.priorite} onChange={e => setForm({...form, priorite: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none">
                    <option value="basse">Basse</option>
                    <option value="normale">Normale</option>
                    <option value="haute">Haute</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Immeuble</label>
                  <input value={form.immeuble} onChange={e => setForm({...form, immeuble: e.target.value})} placeholder="Résidence..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Lot / Appartement</label>
                  <input value={form.lot} onChange={e => setForm({...form, lot: e.target.value})} placeholder="Apt 12, Bât B" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Locataire</label>
                  <input value={form.locataire} onChange={e => setForm({...form, locataire: e.target.value})} placeholder="Nom du locataire" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Artisan assigné</label>
                  <input value={form.artisan} onChange={e => setForm({...form, artisan: e.target.value})} placeholder="Nom de l'artisan" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Date d&apos;intervention souhaitée</label>
                <input type="date" value={form.dateIntervention} onChange={e => setForm({...form, dateIntervention: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder="Décrivez le problème..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-green-500 outline-none resize-none" />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition">Annuler</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition">Créer l&apos;ordre</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ CONTRATS SECTION ══════════ */
function ContratsSection({ artisan }: { artisan: any }) {
  const storageKey = `fixit_contrats_${artisan?.id}`
  const [contrats, setContrats] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ titre: '', client: '', type: 'Maintenance', dateDebut: '', dateFin: '', montant: '', periodicite: 'Annuel', statut: 'Actif', description: '' })

  const handleSave = () => {
    if (!form.titre.trim() && !form.client.trim()) return
    const c = { id: Date.now().toString(), ...form, createdAt: new Date().toISOString() }
    const updated = [c, ...contrats]
    setContrats(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setShowModal(false)
    setForm({ titre: '', client: '', type: 'Maintenance', dateDebut: '', dateFin: '', montant: '', periodicite: 'Annuel', statut: 'Actif', description: '' })
  }

  const STATUS_COLORS: Record<string, string> = { 'Actif': 'bg-green-100 text-green-700', 'Expiré': 'bg-red-100 text-red-700', 'En renouvellement': 'bg-orange-100 text-orange-700', 'Suspendu': 'bg-gray-100 text-gray-700' }

  const expirantBientot = contrats.filter(c => {
    if (!c.dateFin || c.statut !== 'Actif') return false
    const diff = (new Date(c.dateFin).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff > 0 && diff <= 30
  })

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-[#FFC107] shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-semibold">📑 Contrats</h1>
        <button onClick={() => setShowModal(true)} className="bg-[#FFC107] text-gray-900 px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#FFD54F] transition shadow-sm">+ Nouveau contrat</button>
      </div>
      <div className="p-6 lg:p-8">
        {expirantBientot.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 mb-6">
            <div className="font-bold text-orange-700 mb-2">⚠️ {expirantBientot.length} contrat(s) expire(nt) dans moins de 30 jours</div>
            {expirantBientot.map(c => <div key={c.id} className="text-sm text-orange-600">• {c.titre || c.client} — expire le {c.dateFin}</div>)}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-400">
            <div className="text-sm text-gray-500 mb-1">Actifs</div>
            <div className="text-3xl font-bold text-green-600">{contrats.filter(c => c.statut === 'Actif').length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-[#FFC107]">
            <div className="text-sm text-gray-500 mb-1">Valeur totale / an</div>
            <div className="text-3xl font-bold text-amber-600">{contrats.filter(c => c.statut === 'Actif').reduce((s, c) => s + (parseFloat(c.montant) || 0), 0).toLocaleString('fr-FR')} €</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-red-400">
            <div className="text-sm text-gray-500 mb-1">Expirés</div>
            <div className="text-3xl font-bold text-red-600">{contrats.filter(c => c.statut === 'Expiré').length}</div>
          </div>
        </div>

        {contrats.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">📑</div>
            <h3 className="text-xl font-bold mb-2">Aucun contrat</h3>
            <p className="text-gray-500 mb-6">Gérez vos contrats de maintenance et de service</p>
            <button onClick={() => setShowModal(true)} className="bg-[#FFC107] text-gray-900 px-6 py-3 rounded-xl font-semibold hover:bg-[#FFD54F] transition">+ Créer un contrat</button>
          </div>
        ) : (
          <div className="space-y-4">
            {contrats.map(c => (
              <div key={c.id} className="bg-white rounded-2xl shadow-sm p-6 flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg">{c.titre || c.client}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[c.statut] || ''}`}>{c.statut}</span>
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-bold">{c.type}</span>
                  </div>
                  {c.client && c.titre && <p className="text-sm text-gray-600 mb-1">👤 {c.client}</p>}
                  {c.montant && <p className="text-sm text-gray-600 mb-1">💰 {c.montant} € / {c.periodicite}</p>}
                  {(c.dateDebut || c.dateFin) && <p className="text-sm text-gray-600 mb-1">📅 {c.dateDebut || '?'} → {c.dateFin || 'Sans limite'}</p>}
                  {c.description && <p className="text-sm text-gray-500 mt-1">{c.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">📑 Nouveau contrat</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Titre du contrat</label>
                <input value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} placeholder="Ex: Maintenance ascenseur - Résidence X" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-amber-400 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Client / Prestataire *</label>
                  <input value={form.client} onChange={e => setForm({...form, client: e.target.value})} placeholder="Nom" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-amber-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-amber-400 outline-none">
                    {['Maintenance', 'Prestation', 'Location', 'Assurance', 'Autre'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Montant (€)</label>
                  <input type="number" value={form.montant} onChange={e => setForm({...form, montant: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-amber-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Périodicité</label>
                  <select value={form.periodicite} onChange={e => setForm({...form, periodicite: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-amber-400 outline-none">
                    {['Mensuel', 'Trimestriel', 'Annuel', 'Unique'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Date début</label>
                  <input type="date" value={form.dateDebut} onChange={e => setForm({...form, dateDebut: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-amber-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Date fin</label>
                  <input type="date" value={form.dateFin} onChange={e => setForm({...form, dateFin: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-amber-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder="Détails du contrat..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-amber-400 outline-none resize-none" />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition">Annuler</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-[#FFC107] text-gray-900 rounded-xl font-semibold hover:bg-[#FFD54F] transition">Créer le contrat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
// ══════════════════════════════════════════════
// BTP — PLANNING GANTT
// ══════════════════════════════════════════════
function GanttSection({ userId }: { userId: string }) {
  const STORAGE_KEY = `gantt_${userId}`
  interface Tache {
    id: string; nom: string; chantier: string; responsable: string
    debut: string; fin: string; avancement: number
    statut: 'planifié' | 'en_cours' | 'terminé' | 'en_retard'; couleur: string
  }
  const [taches, setTaches] = useState<Tache[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nom: '', chantier: '', responsable: '', debut: '', fin: '', avancement: 0, statut: 'planifié' as const, couleur: '#3B82F6' })

  const save = (data: Tache[]) => { setTaches(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addTache = () => { save([...taches, { ...form, id: Date.now().toString() }]); setShowForm(false); setForm({ nom: '', chantier: '', responsable: '', debut: '', fin: '', avancement: 0, statut: 'planifié', couleur: '#3B82F6' }) }
  const updateAvancement = (id: string, val: number) => save(taches.map(t => t.id === id ? { ...t, avancement: val, statut: val === 100 ? 'terminé' : val > 0 ? 'en_cours' : 'planifié' } : t))
  const deleteTache = (id: string) => save(taches.filter(t => t.id !== id))

  const allDates = taches.flatMap(t => [new Date(t.debut), new Date(t.fin)]).filter(d => !isNaN(d.getTime()))
  const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date(Date.now() + 30 * 86400000)
  const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / 86400000)
  const getBar = (t: Tache) => {
    const start = Math.max(0, (new Date(t.debut).getTime() - minDate.getTime()) / 86400000)
    const duration = Math.max(1, (new Date(t.fin).getTime() - new Date(t.debut).getTime()) / 86400000)
    return { left: `${(start / totalDays) * 100}%`, width: `${(duration / totalDays) * 100}%` }
  }
  const statColors: Record<string, string> = { planifié: 'bg-gray-400', en_cours: 'bg-blue-500', terminé: 'bg-green-500', en_retard: 'bg-red-500' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">📅 Planning Gantt</h2><p className="text-gray-500 text-sm mt-1">{taches.length} tâche(s) planifiée(s)</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">+ Ajouter tâche</button>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Nouvelle tâche</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-gray-700">Nom *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Terrassement" /></div>
            <div><label className="text-sm font-medium text-gray-700">Chantier</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} placeholder="Résidence Les Pins" /></div>
            <div><label className="text-sm font-medium text-gray-700">Responsable</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.responsable} onChange={e => setForm({...form, responsable: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Couleur</label><input type="color" className="mt-1 w-full border rounded-lg px-3 py-2 h-9" value={form.couleur} onChange={e => setForm({...form, couleur: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Début *</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.debut} onChange={e => setForm({...form, debut: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Fin *</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.fin} onChange={e => setForm({...form, fin: e.target.value})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addTache} disabled={!form.nom || !form.debut || !form.fin} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Ajouter</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Annuler</button>
          </div>
        </div>
      )}
      {taches.length === 0 ? (
        <div className="text-center py-16 text-gray-500"><div className="text-5xl mb-3">📅</div><p className="font-medium">Aucune tâche planifiée</p></div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Tâche', 'Chantier', 'Statut', 'Planning', 'Avancement', ''].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-600 px-4 py-3">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {taches.map(t => {
                  const bar = getBar(t)
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="font-medium text-sm">{t.nom}</div><div className="text-xs text-gray-500">{t.responsable}</div></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{t.chantier}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${statColors[t.statut]}`}>{t.statut}</span></td>
                      <td className="px-4 py-3 min-w-[200px]">
                        <div className="relative h-6 bg-gray-100 rounded">
                          <div className="absolute top-1 h-4 rounded opacity-80" style={{ left: bar.left, width: bar.width, backgroundColor: t.couleur }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                          <span>{t.debut ? new Date(t.debut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''}</span>
                          <span>{t.fin ? new Date(t.fin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 w-40">
                        <div className="flex items-center gap-2">
                          <input type="range" min="0" max="100" value={t.avancement} onChange={e => updateAvancement(t.id, Number(e.target.value))} className="flex-1 h-1.5 accent-blue-600" />
                          <span className="text-xs font-medium w-8">{t.avancement}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><button onClick={() => deleteTache(t.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="grid grid-cols-4 gap-4">
        {(['planifié', 'en_cours', 'terminé', 'en_retard'] as const).map(s => (
          <div key={s} className="bg-white rounded-xl border p-4 text-center">
            <div className="text-2xl font-bold">{taches.filter(t => t.statut === s).length}</div>
            <div className="text-sm text-gray-500 capitalize">{s.replace('_', ' ')}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — SITUATIONS DE TRAVAUX
// ══════════════════════════════════════════════
function SituationsTravaux({ userId }: { userId: string }) {
  const STORAGE_KEY = `situations_${userId}`
  interface Poste { poste: string; quantite: number; unite: string; prixUnit: number; avancement: number }
  interface Situation {
    id: string; chantier: string; client: string; numero: number; date: string
    montantMarche: number; travaux: Poste[]; statut: 'brouillon' | 'envoyée' | 'validée' | 'payée'
  }
  const [situations, setSituations] = useState<Situation[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [selected, setSelected] = useState<Situation | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ chantier: '', client: '', montantMarche: 0 })
  const [newPoste, setNewPoste] = useState<Poste>({ poste: '', quantite: 0, unite: 'u', prixUnit: 0, avancement: 0 })

  const save = (data: Situation[]) => { setSituations(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const createSit = () => {
    const numero = situations.filter(s => s.chantier === form.chantier).length + 1
    const s: Situation = { id: Date.now().toString(), ...form, numero, date: new Date().toISOString().split('T')[0], travaux: [], statut: 'brouillon' }
    save([...situations, s]); setSelected(s); setShowForm(false)
  }
  const addPoste = () => {
    if (!selected) return
    const updated = { ...selected, travaux: [...selected.travaux, { ...newPoste }] }
    save(situations.map(s => s.id === selected.id ? updated : s)); setSelected(updated)
    setNewPoste({ poste: '', quantite: 0, unite: 'u', prixUnit: 0, avancement: 0 })
  }
  const getTotal = (s: Situation) => s.travaux.reduce((sum, t) => sum + t.quantite * t.prixUnit * (t.avancement / 100), 0)
  const changeStatut = (id: string, statut: Situation['statut']) => {
    const upd = situations.map(s => s.id === id ? { ...s, statut } : s)
    save(upd); if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut } : null)
  }
  const statColors: Record<string, string> = { brouillon: 'bg-gray-100 text-gray-700', envoyée: 'bg-blue-100 text-blue-700', validée: 'bg-yellow-100 text-yellow-700', payée: 'bg-green-100 text-green-700' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">📊 Situations de Travaux</h2><p className="text-gray-500 text-sm mt-1">Facturation progressive par avancement</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">+ Nouvelle situation</button>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-sm font-medium text-gray-700">Chantier *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Client *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Montant marché (€)</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={createSit} disabled={!form.chantier || !form.client} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Créer</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Annuler</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-3">
          {situations.length === 0 ? <div className="text-center py-8 text-gray-500 text-sm">Aucune situation</div> : situations.map(s => (
            <div key={s.id} onClick={() => setSelected(s)} className={`bg-white rounded-xl border p-4 cursor-pointer hover:border-blue-300 ${selected?.id === s.id ? 'border-blue-500 ring-1 ring-blue-200' : ''}`}>
              <div className="flex justify-between mb-1"><span className="font-semibold text-sm">Sit. n°{s.numero}</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statColors[s.statut]}`}>{s.statut}</span></div>
              <div className="text-sm text-gray-600">{s.chantier}</div>
              <div className="text-xs text-gray-500">{s.client}</div>
              <div className="text-sm font-bold text-blue-700 mt-1">{getTotal(s).toLocaleString('fr-FR')} €</div>
            </div>
          ))}
        </div>
        <div className="col-span-2">
          {selected ? (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Situation n°{selected.numero} — {selected.chantier}</h3>
                <div className="flex gap-2">
                  {(['brouillon', 'envoyée', 'validée', 'payée'] as const).map(s => (
                    <button key={s} onClick={() => changeStatut(selected.id, s)} className={`px-2 py-1 rounded text-xs font-medium border ${selected.statut === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <table className="w-full text-sm border rounded-lg overflow-hidden mb-4">
                <thead className="bg-gray-50"><tr>{['Poste', 'Qté', 'U', 'P.U. €', 'Avt %', 'Montant €'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {selected.travaux.map((t, i) => (
                    <tr key={i}><td className="px-3 py-2">{t.poste}</td><td className="px-3 py-2">{t.quantite}</td><td className="px-3 py-2">{t.unite}</td><td className="px-3 py-2">{t.prixUnit.toLocaleString('fr-FR')}</td><td className="px-3 py-2">{t.avancement}%</td><td className="px-3 py-2 font-semibold">{(t.quantite * t.prixUnit * t.avancement / 100).toLocaleString('fr-FR')}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr className="bg-blue-50 font-bold"><td colSpan={5} className="px-3 py-2 text-right">TOTAL</td><td className="px-3 py-2 text-blue-700">{getTotal(selected).toLocaleString('fr-FR')} €</td></tr></tfoot>
              </table>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-5 gap-2 mb-2">
                  <input className="col-span-2 border rounded px-2 py-1.5 text-sm" placeholder="Poste" value={newPoste.poste} onChange={e => setNewPoste({...newPoste, poste: e.target.value})} />
                  <input type="number" className="border rounded px-2 py-1.5 text-sm" placeholder="Qté" value={newPoste.quantite || ''} onChange={e => setNewPoste({...newPoste, quantite: Number(e.target.value)})} />
                  <select className="border rounded px-2 py-1.5 text-sm" value={newPoste.unite} onChange={e => setNewPoste({...newPoste, unite: e.target.value})}>{['u', 'm²', 'm³', 'ml', 'kg', 'h', 'forfait'].map(u => <option key={u}>{u}</option>)}</select>
                  <input type="number" className="border rounded px-2 py-1.5 text-sm" placeholder="P.U. €" value={newPoste.prixUnit || ''} onChange={e => setNewPoste({...newPoste, prixUnit: Number(e.target.value)})} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1"><span className="text-sm text-gray-600">Avancement :</span><input type="range" min="0" max="100" value={newPoste.avancement} onChange={e => setNewPoste({...newPoste, avancement: Number(e.target.value)})} className="flex-1 accent-blue-600" /><span className="text-sm w-8">{newPoste.avancement}%</span></div>
                  <button onClick={addPoste} disabled={!newPoste.poste} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50">Ajouter</button>
                </div>
              </div>
            </div>
          ) : <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center h-64 text-gray-500"><div className="text-center"><div className="text-4xl mb-2">📊</div><p>Sélectionnez une situation</p></div></div>}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — RETENUES DE GARANTIE
// ══════════════════════════════════════════════
function RetenuesGarantieSection({ userId }: { userId: string }) {
  const STORAGE_KEY = `retenues_${userId}`
  interface Retenue {
    id: string; chantier: string; client: string; montantMarche: number; tauxRetenue: number
    montantRetenu: number; dateFinTravaux: string; dateLiberation?: string
    statut: 'active' | 'mainlevée_demandée' | 'libérée'; caution: boolean
  }
  const [retenues, setRetenues] = useState<Retenue[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ chantier: '', client: '', montantMarche: 0, tauxRetenue: 5, dateFinTravaux: '', caution: false })

  const save = (data: Retenue[]) => { setRetenues(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addRetenue = () => {
    save([...retenues, { id: Date.now().toString(), ...form, montantRetenu: form.montantMarche * form.tauxRetenue / 100, statut: 'active' }])
    setShowForm(false); setForm({ chantier: '', client: '', montantMarche: 0, tauxRetenue: 5, dateFinTravaux: '', caution: false })
  }
  const changeStatut = (id: string, statut: Retenue['statut']) => save(retenues.map(r => r.id === id ? { ...r, statut, dateLiberation: statut === 'libérée' ? new Date().toISOString().split('T')[0] : r.dateLiberation } : r))

  const totalRetenu = retenues.filter(r => r.statut === 'active').reduce((s, r) => s + r.montantRetenu, 0)
  const totalLibéré = retenues.filter(r => r.statut === 'libérée').reduce((s, r) => s + r.montantRetenu, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">🔒 Retenues de Garantie</h2><p className="text-gray-500 text-sm mt-1">Suivi des 5% retenus et mainlevées</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">+ Nouvelle retenue</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4"><div className="text-orange-600 text-sm font-medium">Retenu (en attente)</div><div className="text-2xl font-bold text-orange-700 mt-1">{totalRetenu.toLocaleString('fr-FR')} €</div></div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4"><div className="text-green-600 text-sm font-medium">Libéré</div><div className="text-2xl font-bold text-green-700 mt-1">{totalLibéré.toLocaleString('fr-FR')} €</div></div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4"><div className="text-blue-600 text-sm font-medium">Chantiers concernés</div><div className="text-2xl font-bold text-blue-700 mt-1">{retenues.length}</div></div>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Nouvelle retenue de garantie</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-gray-700">Chantier *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Client *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Montant marché HT (€)</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Taux retenue (%)</label><input type="number" min="1" max="10" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.tauxRetenue} onChange={e => setForm({...form, tauxRetenue: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Fin des travaux</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.dateFinTravaux} onChange={e => setForm({...form, dateFinTravaux: e.target.value})} /></div>
            <div className="flex items-center gap-2 mt-6"><input type="checkbox" id="caution_ret" checked={form.caution} onChange={e => setForm({...form, caution: e.target.checked})} className="w-4 h-4" /><label htmlFor="caution_ret" className="text-sm text-gray-700">Caution bancaire en remplacement</label></div>
          </div>
          {form.montantMarche > 0 && <div className="mt-3 bg-blue-50 rounded-lg p-3 text-sm text-blue-700">💡 Montant retenu : <strong>{(form.montantMarche * form.tauxRetenue / 100).toLocaleString('fr-FR')} €</strong></div>}
          <div className="flex gap-3 mt-4">
            <button onClick={addRetenue} disabled={!form.chantier || !form.client} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Enregistrer</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Annuler</button>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b"><tr>{['Chantier', 'Client', 'Marché HT', 'Retenu', 'Fin travaux', 'Statut', 'Actions'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-600 px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {retenues.length === 0 ? <tr><td colSpan={7} className="text-center py-10 text-gray-500 text-sm">Aucune retenue</td></tr> : retenues.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-sm">{r.chantier}</td>
                <td className="px-4 py-3 text-sm">{r.client}</td>
                <td className="px-4 py-3 text-sm">{r.montantMarche.toLocaleString('fr-FR')} €</td>
                <td className="px-4 py-3 text-sm font-semibold text-orange-700">{r.montantRetenu.toLocaleString('fr-FR')} €</td>
                <td className="px-4 py-3 text-sm">{r.dateFinTravaux ? new Date(r.dateFinTravaux).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.statut === 'active' ? 'bg-orange-100 text-orange-700' : r.statut === 'mainlevée_demandée' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{r.statut}</span></td>
                <td className="px-4 py-3">
                  {r.statut === 'active' && <button onClick={() => changeStatut(r.id, 'mainlevée_demandée')} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100">Demander mainlevée</button>}
                  {r.statut === 'mainlevée_demandée' && <button onClick={() => changeStatut(r.id, 'libérée')} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100">Libérer</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — POINTAGE ÉQUIPES
// ══════════════════════════════════════════════
function PointageEquipesSection({ userId }: { userId: string }) {
  const STORAGE_KEY = `pointage_${userId}`
  interface Pointage {
    id: string; employe: string; poste: string; chantier: string; date: string
    heureArrivee: string; heureDepart: string; pauseMinutes: number; heuresTravaillees: number; notes: string
  }
  const [pointages, setPointages] = useState<Pointage[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [filterEmploye, setFilterEmploye] = useState('')
  const [form, setForm] = useState({ employe: '', poste: '', chantier: '', date: new Date().toISOString().split('T')[0], heureArrivee: '08:00', heureDepart: '17:00', pauseMinutes: 60, notes: '' })

  const save = (data: Pointage[]) => { setPointages(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const calcH = (a: string, d: string, p: number) => {
    const [ah, am] = a.split(':').map(Number); const [dh, dm] = d.split(':').map(Number)
    return Math.max(0, ((dh * 60 + dm) - (ah * 60 + am) - p) / 60)
  }
  const addPointage = () => {
    save([...pointages, { id: Date.now().toString(), ...form, heuresTravaillees: Math.round(calcH(form.heureArrivee, form.heureDepart, form.pauseMinutes) * 100) / 100 }])
    setShowForm(false)
  }
  const deleteP = (id: string) => save(pointages.filter(p => p.id !== id))
  const employes = [...new Set(pointages.map(p => p.employe))].filter(Boolean)
  const filtered = pointages.filter(p => (!filterDate || p.date === filterDate) && (!filterEmploye || p.employe === filterEmploye))
  const totalH = filtered.reduce((s, p) => s + p.heuresTravaillees, 0)
  const heuresByEmp = employes.map(e => ({ employe: e, heures: pointages.filter(p => p.employe === e).reduce((s, p) => s + p.heuresTravaillees, 0), jours: new Set(pointages.filter(p => p.employe === e).map(p => p.date)).size }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">⏱️ Pointage Équipes</h2><p className="text-gray-500 text-sm mt-1">Suivi des heures par employé et chantier</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">+ Pointer</button>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-sm font-medium text-gray-700">Employé *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.employe} onChange={e => setForm({...form, employe: e.target.value})} placeholder="Jean Dupont" /></div>
            <div><label className="text-sm font-medium text-gray-700">Poste</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.poste} onChange={e => setForm({...form, poste: e.target.value})}><option value="">Sélectionner</option>{['Chef de chantier', 'Maçon', 'Électricien', 'Plombier', 'Charpentier', 'Peintre', 'Manœuvre'].map(p => <option key={p}>{p}</option>)}</select></div>
            <div><label className="text-sm font-medium text-gray-700">Chantier</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Date</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Arrivée</label><input type="time" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.heureArrivee} onChange={e => setForm({...form, heureArrivee: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Départ</label><input type="time" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.heureDepart} onChange={e => setForm({...form, heureDepart: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Pause (min)</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.pauseMinutes} onChange={e => setForm({...form, pauseMinutes: Number(e.target.value)})} /></div>
            <div className="col-span-2"><label className="text-sm font-medium text-gray-700">Notes</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <div className="mt-3 bg-blue-50 rounded-lg p-3 text-sm text-blue-700">⏱️ Heures : <strong>{calcH(form.heureArrivee, form.heureDepart, form.pauseMinutes).toFixed(2)}h</strong></div>
          <div className="flex gap-3 mt-4">
            <button onClick={addPointage} disabled={!form.employe} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Enregistrer</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Annuler</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-3 bg-white rounded-xl border shadow-sm p-4">
          <div className="flex gap-3 mb-4">
            <div><label className="text-xs font-medium text-gray-600">Date</label><input type="date" className="mt-1 border rounded-lg px-3 py-2 text-sm" value={filterDate} onChange={e => setFilterDate(e.target.value)} /></div>
            <div><label className="text-xs font-medium text-gray-600">Employé</label><select className="mt-1 border rounded-lg px-3 py-2 text-sm" value={filterEmploye} onChange={e => setFilterEmploye(e.target.value)}><option value="">Tous</option>{employes.map(e => <option key={e}>{e}</option>)}</select></div>
            <div className="flex items-end"><span className="text-sm text-gray-600 pb-2">{filtered.length} pointage(s) — <strong>{totalH.toFixed(1)}h</strong></span></div>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b"><tr>{['Employé', 'Poste', 'Chantier', 'Date', 'Arrivée', 'Départ', 'Heures', ''].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-600 pb-2">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? <tr><td colSpan={8} className="py-8 text-center text-gray-500 text-sm">Aucun pointage</td></tr> : filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="py-2 font-medium">{p.employe}</td><td className="py-2 text-gray-600">{p.poste}</td><td className="py-2 text-gray-600">{p.chantier}</td>
                  <td className="py-2">{new Date(p.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}</td>
                  <td className="py-2">{p.heureArrivee}</td><td className="py-2">{p.heureDepart}</td>
                  <td className="py-2 font-semibold text-blue-700">{p.heuresTravaillees}h</td>
                  <td className="py-2"><button onClick={() => deleteP(p.id)} className="text-red-400 hover:text-red-600">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Récap employés</h4>
          {heuresByEmp.length === 0 ? <p className="text-xs text-gray-500">Aucune donnée</p> : heuresByEmp.map(e => (
            <div key={e.employe} className="flex items-center justify-between py-2 border-b last:border-0">
              <div><div className="text-sm font-medium">{e.employe}</div><div className="text-xs text-gray-500">{e.jours} jour(s)</div></div>
              <div className="text-sm font-bold text-blue-700">{e.heures.toFixed(1)}h</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — SOUS-TRAITANCE DC4
// ══════════════════════════════════════════════
function SousTraitanceDC4Section({ userId }: { userId: string }) {
  const STORAGE_KEY = `dc4_${userId}`
  interface SousTraitant {
    id: string; entreprise: string; siret: string; responsable: string; email: string
    telephone: string; adresse: string; chantier: string; lot: string
    montantMarche: number; tauxTVA: number; statut: 'en_attente' | 'agréé' | 'refusé'; dateAgrement?: string; dc4Genere: boolean
  }
  const [soustraitants, setSoustraitants] = useState<SousTraitant[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ entreprise: '', siret: '', responsable: '', email: '', telephone: '', adresse: '', chantier: '', lot: '', montantMarche: 0, tauxTVA: 20 })

  const save = (data: SousTraitant[]) => { setSoustraitants(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addST = () => {
    save([...soustraitants, { id: Date.now().toString(), ...form, statut: 'en_attente', dc4Genere: false }])
    setShowForm(false); setForm({ entreprise: '', siret: '', responsable: '', email: '', telephone: '', adresse: '', chantier: '', lot: '', montantMarche: 0, tauxTVA: 20 })
  }
  const agréer = (id: string) => save(soustraitants.map(s => s.id === id ? { ...s, statut: 'agréé', dateAgrement: new Date().toISOString().split('T')[0] } : s))
  const genererDC4 = (st: SousTraitant) => {
    const content = `DC4 — ACTE SPÉCIAL DE SOUS-TRAITANCE\n\nChantier : ${st.chantier}\nLot : ${st.lot}\nSous-traitant : ${st.entreprise}\nSIRET : ${st.siret}\nReprésentant : ${st.responsable}\n\nMontant HT : ${st.montantMarche.toLocaleString('fr-FR')} €\nTVA : ${st.tauxTVA}%\nMontant TTC : ${(st.montantMarche * (1 + st.tauxTVA / 100)).toLocaleString('fr-FR')} €\nDate agrément : ${st.dateAgrement || '—'}\n\nSignature maître d'ouvrage : _______________\nSignature entreprise principale : _______________\nSignature sous-traitant : _______________`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `DC4_${st.entreprise}.txt`; a.click()
    URL.revokeObjectURL(url)
    save(soustraitants.map(s => s.id === st.id ? { ...s, dc4Genere: true } : s))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">🤝 Sous-traitance DC4</h2><p className="text-gray-500 text-sm mt-1">Gestion des agréments et actes spéciaux</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">+ Ajouter sous-traitant</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"><div className="text-yellow-700 text-sm font-medium">En attente</div><div className="text-2xl font-bold text-yellow-700 mt-1">{soustraitants.filter(s => s.statut === 'en_attente').length}</div></div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4"><div className="text-green-700 text-sm font-medium">Agréés</div><div className="text-2xl font-bold text-green-700 mt-1">{soustraitants.filter(s => s.statut === 'agréé').length}</div></div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4"><div className="text-blue-700 text-sm font-medium">DC4 générés</div><div className="text-2xl font-bold text-blue-700 mt-1">{soustraitants.filter(s => s.dc4Genere).length}</div></div>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            {([['Entreprise *', 'entreprise', 'text'], ['SIRET', 'siret', 'text'], ['Responsable', 'responsable', 'text'], ['Email', 'email', 'email'], ['Téléphone', 'telephone', 'tel'], ['Adresse', 'adresse', 'text'], ['Chantier', 'chantier', 'text'], ['Lot', 'lot', 'text']] as [string, string, string][]).map(([label, key, type]) => (
              <div key={key}><label className="text-sm font-medium text-gray-700">{label}</label><input type={type} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={(form as Record<string, string | number>)[key] as string} onChange={e => setForm({...form, [key]: e.target.value})} /></div>
            ))}
            <div><label className="text-sm font-medium text-gray-700">Montant HT (€)</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">TVA (%)</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.tauxTVA} onChange={e => setForm({...form, tauxTVA: Number(e.target.value)})}>{[20, 10, 5.5, 0].map(t => <option key={t} value={t}>{t}%</option>)}</select></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addST} disabled={!form.entreprise} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Ajouter</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Annuler</button>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b"><tr>{['Entreprise', 'Chantier/Lot', 'Montant HT', 'Statut', 'DC4', 'Actions'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-600 px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {soustraitants.length === 0 ? <tr><td colSpan={6} className="text-center py-10 text-gray-500 text-sm">Aucun sous-traitant</td></tr> : soustraitants.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3"><div className="font-medium text-sm">{s.entreprise}</div><div className="text-xs text-gray-500">{s.siret}</div></td>
                <td className="px-4 py-3 text-sm"><div>{s.chantier}</div><div className="text-xs text-gray-500">{s.lot}</div></td>
                <td className="px-4 py-3 text-sm font-semibold">{s.montantMarche.toLocaleString('fr-FR')} €</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.statut === 'en_attente' ? 'bg-yellow-100 text-yellow-700' : s.statut === 'agréé' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{s.statut}</span></td>
                <td className="px-4 py-3 text-center">{s.dc4Genere ? '✅' : '—'}</td>
                <td className="px-4 py-3">
                  {s.statut === 'en_attente' && <button onClick={() => agréer(s.id)} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 mr-1">Agréer</button>}
                  {s.statut === 'agréé' && <button onClick={() => genererDC4(s)} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100">Générer DC4</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// BTP — DPGF / APPELS D'OFFRES
// ══════════════════════════════════════════════
function DPGFSection({ userId }: { userId: string }) {
  const STORAGE_KEY = `dpgf_${userId}`
  interface Lot { numero: string; designation: string; montantHT: number }
  interface AppelOffre { id: string; titre: string; client: string; dateRemise: string; montantEstime: number; statut: 'en_cours' | 'soumis' | 'gagné' | 'perdu'; lots: Lot[] }
  const [appels, setAppels] = useState<AppelOffre[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [selected, setSelected] = useState<AppelOffre | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ titre: '', client: '', dateRemise: '', montantEstime: 0 })
  const [newLot, setNewLot] = useState<Lot>({ numero: '', designation: '', montantHT: 0 })

  const save = (data: AppelOffre[]) => { setAppels(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const createAppel = () => {
    const a: AppelOffre = { id: Date.now().toString(), ...form, statut: 'en_cours', lots: [] }
    save([...appels, a]); setSelected(a); setShowForm(false)
  }
  const addLot = () => {
    if (!selected) return
    const updated = { ...selected, lots: [...selected.lots, { ...newLot }] }
    save(appels.map(a => a.id === selected.id ? updated : a)); setSelected(updated)
    setNewLot({ numero: '', designation: '', montantHT: 0 })
  }
  const getTotal = (a: AppelOffre) => a.lots.reduce((s, l) => s + l.montantHT, 0)
  const changeStatut = (id: string, statut: AppelOffre['statut']) => {
    const upd = appels.map(a => a.id === id ? { ...a, statut } : a)
    save(upd); if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut } : null)
  }
  const exportDPGF = (a: AppelOffre) => {
    const rows = a.lots.map(l => `LOT ${l.numero} — ${l.designation.padEnd(40)} ${l.montantHT.toLocaleString('fr-FR')} € HT`).join('\n')
    const content = `DPGF — ${a.titre}\nClient : ${a.client}\nDate remise : ${a.dateRemise ? new Date(a.dateRemise).toLocaleDateString('fr-FR') : ''}\n\n${rows}\n\nTOTAL HT : ${getTotal(a).toLocaleString('fr-FR')} €\nTVA 20% : ${(getTotal(a) * 0.2).toLocaleString('fr-FR')} €\nTOTAL TTC : ${(getTotal(a) * 1.2).toLocaleString('fr-FR')} €`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `DPGF_${a.titre.replace(/\s+/g, '_')}.txt`; link.click()
    URL.revokeObjectURL(url)
  }
  const statColors: Record<string, string> = { en_cours: 'bg-blue-100 text-blue-700', soumis: 'bg-yellow-100 text-yellow-700', gagné: 'bg-green-100 text-green-700', perdu: 'bg-red-100 text-red-700' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">📋 Appels d&apos;offres — DPGF</h2><p className="text-gray-500 text-sm mt-1">Décomposition du Prix Global et Forfaitaire</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">+ Nouvel appel</button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {(['en_cours', 'soumis', 'gagné', 'perdu'] as const).map(s => (
          <div key={s} className={`border rounded-xl p-4 ${statColors[s].replace('text-', 'border-').replace('-700', '-200')}`}>
            <div className="text-sm font-medium text-gray-600 capitalize">{s.replace('_', ' ')}</div>
            <div className="text-2xl font-bold mt-1">{appels.filter(a => a.statut === s).length}</div>
          </div>
        ))}
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-gray-700">Titre *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Client maître d&apos;ouvrage</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Date de remise</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.dateRemise} onChange={e => setForm({...form, dateRemise: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Montant estimé (€)</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.montantEstime} onChange={e => setForm({...form, montantEstime: Number(e.target.value)})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={createAppel} disabled={!form.titre} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Créer</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Annuler</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-3">
          {appels.length === 0 ? <div className="text-center py-8 text-gray-500 text-sm">Aucun appel d&apos;offres</div> : appels.map(a => (
            <div key={a.id} onClick={() => setSelected(a)} className={`bg-white rounded-xl border p-4 cursor-pointer hover:border-blue-300 ${selected?.id === a.id ? 'border-blue-500 ring-1 ring-blue-200' : ''}`}>
              <div className="flex items-center justify-between mb-1"><span className="font-semibold text-sm truncate">{a.titre}</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ml-2 ${statColors[a.statut]}`}>{a.statut}</span></div>
              <div className="text-xs text-gray-500">{a.client}</div>
              <div className="text-sm font-bold text-blue-700 mt-1">{getTotal(a).toLocaleString('fr-FR')} € HT</div>
            </div>
          ))}
        </div>
        <div className="col-span-2">
          {selected ? (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">{selected.titre}</h3>
                <div className="flex gap-2">
                  <button onClick={() => exportDPGF(selected)} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200">⬇️ Export</button>
                  {(['en_cours', 'soumis', 'gagné', 'perdu'] as const).map(s => (
                    <button key={s} onClick={() => changeStatut(selected.id, s)} className={`px-2 py-1 rounded text-xs font-medium border ${selected.statut === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <table className="w-full text-sm border rounded-lg overflow-hidden mb-4">
                <thead className="bg-gray-50"><tr>{['N° Lot', 'Désignation', 'Montant HT €'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>)}</tr></thead>
                <tbody className="divide-y">{selected.lots.map((l, i) => <tr key={i}><td className="px-3 py-2 font-medium">{l.numero}</td><td className="px-3 py-2">{l.designation}</td><td className="px-3 py-2 font-semibold">{l.montantHT.toLocaleString('fr-FR')}</td></tr>)}</tbody>
                <tfoot>
                  <tr className="bg-blue-50 font-bold"><td colSpan={2} className="px-3 py-2 text-right">TOTAL HT</td><td className="px-3 py-2 text-blue-700">{getTotal(selected).toLocaleString('fr-FR')} €</td></tr>
                  <tr className="bg-blue-100 font-bold"><td colSpan={2} className="px-3 py-2 text-right">TOTAL TTC</td><td className="px-3 py-2 text-blue-800">{(getTotal(selected) * 1.2).toLocaleString('fr-FR')} €</td></tr>
                </tfoot>
              </table>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex gap-2">
                  <input className="w-16 border rounded px-2 py-1.5 text-sm" placeholder="N° lot" value={newLot.numero} onChange={e => setNewLot({...newLot, numero: e.target.value})} />
                  <input className="flex-1 border rounded px-2 py-1.5 text-sm" placeholder="Désignation" value={newLot.designation} onChange={e => setNewLot({...newLot, designation: e.target.value})} />
                  <input type="number" className="w-28 border rounded px-2 py-1.5 text-sm" placeholder="Montant €" value={newLot.montantHT || ''} onChange={e => setNewLot({...newLot, montantHT: Number(e.target.value)})} />
                  <button onClick={addLot} disabled={!newLot.designation} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">+</button>
                </div>
              </div>
            </div>
          ) : <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center h-64 text-gray-500"><div className="text-center"><div className="text-4xl mb-2">📋</div><p>Sélectionnez un appel d&apos;offres</p></div></div>}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// CONCIERGERIE — CHANNEL MANAGER
// ══════════════════════════════════════════════
function ChannelManagerSection({ userId }: { userId: string }) {
  const STORAGE_KEY = `channel_${userId}`
  interface Reservation {
    id: string; plateforme: 'airbnb' | 'booking' | 'vrbo' | 'direct' | 'abritel' | 'autre'
    logement: string; client: string; dateArrivee: string; dateDepart: string
    montantTotal: number; commission: number; statut: 'confirmée' | 'en_attente' | 'annulée'; notes: string
  }
  const [reservations, setReservations] = useState<Reservation[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [filterP, setFilterP] = useState('')
  const [form, setForm] = useState<Omit<Reservation, 'id'>>({ plateforme: 'airbnb', logement: '', client: '', dateArrivee: '', dateDepart: '', montantTotal: 0, commission: 0, statut: 'confirmée', notes: '' })

  const save = (data: Reservation[]) => { setReservations(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addResa = () => { save([...reservations, { ...form, id: Date.now().toString() }]); setShowForm(false); setForm({ plateforme: 'airbnb', logement: '', client: '', dateArrivee: '', dateDepart: '', montantTotal: 0, commission: 0, statut: 'confirmée', notes: '' }) }
  const deleteResa = (id: string) => save(reservations.filter(r => r.id !== id))

  const plateformes = ['airbnb', 'booking', 'vrbo', 'direct', 'abritel', 'autre'] as const
  const platColors: Record<string, string> = { airbnb: 'bg-pink-100 text-pink-700', booking: 'bg-blue-100 text-blue-700', vrbo: 'bg-teal-100 text-teal-700', direct: 'bg-green-100 text-green-700', abritel: 'bg-orange-100 text-orange-700', autre: 'bg-gray-100 text-gray-700' }
  const filtered = reservations.filter(r => !filterP || r.plateforme === filterP)
  const confirmed = filtered.filter(r => r.statut === 'confirmée')
  const totalCA = confirmed.reduce((s, r) => s + r.montantTotal, 0)
  const totalComm = confirmed.reduce((s, r) => s + r.commission, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">🌐 Channel Manager</h2><p className="text-gray-500 text-sm mt-1">Centralisez toutes vos réservations OTA</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">+ Nouvelle réservation</button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4"><div className="text-blue-600 text-sm font-medium">CA total</div><div className="text-2xl font-bold text-blue-700 mt-1">{totalCA.toLocaleString('fr-FR')} €</div></div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4"><div className="text-orange-600 text-sm font-medium">Commissions</div><div className="text-2xl font-bold text-orange-700 mt-1">{totalComm.toLocaleString('fr-FR')} €</div></div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4"><div className="text-green-600 text-sm font-medium">Net perçu</div><div className="text-2xl font-bold text-green-700 mt-1">{(totalCA - totalComm).toLocaleString('fr-FR')} €</div></div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4"><div className="text-purple-600 text-sm font-medium">Réservations</div><div className="text-2xl font-bold text-purple-700 mt-1">{confirmed.length}</div></div>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-sm font-medium text-gray-700">Plateforme</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.plateforme} onChange={e => setForm({...form, plateforme: e.target.value as Reservation['plateforme']})}>{plateformes.map(p => <option key={p}>{p}</option>)}</select></div>
            <div><label className="text-sm font-medium text-gray-700">Logement *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.logement} onChange={e => setForm({...form, logement: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Client *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Arrivée</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.dateArrivee} onChange={e => setForm({...form, dateArrivee: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Départ</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.dateDepart} onChange={e => setForm({...form, dateDepart: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Statut</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.statut} onChange={e => setForm({...form, statut: e.target.value as Reservation['statut']})}><option value="confirmée">Confirmée</option><option value="en_attente">En attente</option><option value="annulée">Annulée</option></select></div>
            <div><label className="text-sm font-medium text-gray-700">Montant total (€)</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.montantTotal} onChange={e => setForm({...form, montantTotal: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Commission (€)</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.commission} onChange={e => setForm({...form, commission: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Notes</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addResa} disabled={!form.logement || !form.client} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Ajouter</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Annuler</button>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => setFilterP('')} className={`px-3 py-1 rounded-full text-sm font-medium ${!filterP ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Toutes</button>
        {plateformes.map(p => <button key={p} onClick={() => setFilterP(p)} className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${filterP === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{p}</button>)}
      </div>
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b"><tr>{['Plateforme', 'Logement', 'Client', 'Arrivée', 'Départ', 'Montant', 'Commission', 'Statut', ''].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-600 px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? <tr><td colSpan={9} className="text-center py-10 text-gray-500 text-sm">Aucune réservation</td></tr> : filtered.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${platColors[r.plateforme]}`}>{r.plateforme}</span></td>
                <td className="px-4 py-3 text-sm font-medium">{r.logement}</td>
                <td className="px-4 py-3 text-sm">{r.client}</td>
                <td className="px-4 py-3 text-sm">{r.dateArrivee ? new Date(r.dateArrivee).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="px-4 py-3 text-sm">{r.dateDepart ? new Date(r.dateDepart).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="px-4 py-3 text-sm font-semibold">{r.montantTotal.toLocaleString('fr-FR')} €</td>
                <td className="px-4 py-3 text-sm text-orange-600">{r.commission.toLocaleString('fr-FR')} €</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.statut === 'confirmée' ? 'bg-green-100 text-green-700' : r.statut === 'en_attente' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{r.statut}</span></td>
                <td className="px-4 py-3"><button onClick={() => deleteResa(r.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// CONCIERGERIE — TARIFICATION DYNAMIQUE
// ══════════════════════════════════════════════
function TarificationSection({ userId }: { userId: string }) {
  const STORAGE_KEY = `tarif_${userId}`
  interface TarifLog { id: string; logement: string; prixBase: number; prixWeekend: number; prixSaison: Record<string, number>; menage: number; caution: number; sejMinNuits: number }
  const [tarifs, setTarifs] = useState<TarifLog[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [selected, setSelected] = useState<TarifLog | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ logement: '', prixBase: 80, prixWeekend: 120, menage: 50, caution: 300, sejMinNuits: 2 })
  const [saisonNom, setSaisonNom] = useState('')
  const [saisonPrix, setSaisonPrix] = useState(0)

  const save = (data: TarifLog[]) => { setTarifs(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const createTarif = () => {
    const t: TarifLog = { id: Date.now().toString(), ...form, prixSaison: {} }
    save([...tarifs, t]); setSelected(t); setShowForm(false)
  }
  const addSaison = () => {
    if (!selected || !saisonNom) return
    const updated = { ...selected, prixSaison: { ...selected.prixSaison, [saisonNom]: saisonPrix } }
    save(tarifs.map(t => t.id === selected.id ? updated : t)); setSelected(updated); setSaisonNom(''); setSaisonPrix(0)
  }
  const updateField = (id: string, field: keyof TarifLog, value: number) => {
    const upd = tarifs.map(t => t.id === id ? { ...t, [field]: value } : t)
    save(upd); const found = upd.find(t => t.id === id); if (found) setSelected(found)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">💰 Tarification Dynamique</h2><p className="text-gray-500 text-sm mt-1">Prix par logement, saison et type de séjour</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">+ Ajouter logement</button>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3"><label className="text-sm font-medium text-gray-700">Nom du logement *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.logement} onChange={e => setForm({...form, logement: e.target.value})} placeholder="Appartement 2P - Cours Mirabeau" /></div>
            <div><label className="text-sm font-medium text-gray-700">Prix nuit base (€)</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.prixBase} onChange={e => setForm({...form, prixBase: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Prix week-end (€)</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.prixWeekend} onChange={e => setForm({...form, prixWeekend: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Frais ménage (€)</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.menage} onChange={e => setForm({...form, menage: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Caution (€)</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.caution} onChange={e => setForm({...form, caution: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Séjour min (nuits)</label><input type="number" min="1" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.sejMinNuits} onChange={e => setForm({...form, sejMinNuits: Number(e.target.value)})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={createTarif} disabled={!form.logement} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Créer</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Annuler</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-3">
          {tarifs.length === 0 ? <div className="text-center py-8 text-gray-500 text-sm">Aucun logement configuré</div> : tarifs.map(t => (
            <div key={t.id} onClick={() => setSelected(t)} className={`bg-white rounded-xl border p-4 cursor-pointer hover:border-blue-300 ${selected?.id === t.id ? 'border-blue-500 ring-1 ring-blue-200' : ''}`}>
              <div className="font-semibold text-sm">{t.logement}</div>
              <div className="flex gap-3 mt-1 text-sm text-gray-600"><span>🌙 {t.prixBase}€/nuit</span><span>🎉 {t.prixWeekend}€ WE</span></div>
              <div className="text-xs text-gray-500 mt-1">Ménage {t.menage}€ · Min {t.sejMinNuits} nuit(s)</div>
            </div>
          ))}
        </div>
        <div className="col-span-2">
          {selected ? (
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
              <h3 className="font-bold">{selected.logement}</h3>
              <div className="grid grid-cols-3 gap-4">
                {([['Prix base (€)', 'prixBase'], ['Prix WE (€)', 'prixWeekend'], ['Ménage (€)', 'menage'], ['Caution (€)', 'caution'], ['Min nuits', 'sejMinNuits']] as [string, keyof TarifLog][]).map(([label, field]) => (
                  <div key={String(field)}><label className="text-xs font-medium text-gray-600">{label}</label><input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={selected[field] as number} onChange={e => updateField(selected.id, field, Number(e.target.value))} /></div>
                ))}
              </div>
              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-700 mb-3">Tarifs saisonniers</h4>
                {Object.entries(selected.prixSaison).map(([s, p]) => (
                  <div key={s} className="flex justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-2"><span className="font-medium text-sm">{s}</span><span className="font-bold text-yellow-700">{p} €/nuit</span></div>
                ))}
                <div className="flex gap-2 mt-2">
                  <input className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="Nom saison (ex: Été 2025)" value={saisonNom} onChange={e => setSaisonNom(e.target.value)} />
                  <input type="number" className="w-24 border rounded-lg px-3 py-2 text-sm" placeholder="€/nuit" value={saisonPrix || ''} onChange={e => setSaisonPrix(Number(e.target.value))} />
                  <button onClick={addSaison} disabled={!saisonNom} className="bg-yellow-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50">+</button>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2">Simulation 7 nuits</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">7 nuits × {selected.prixBase}€</span><span className="font-semibold">{7 * selected.prixBase} €</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">+ Ménage</span><span className="font-semibold">{selected.menage} €</span></div>
                  <div className="flex justify-between font-bold"><span>Total voyageur</span><span className="text-blue-700">{7 * selected.prixBase + selected.menage} €</span></div>
                </div>
              </div>
            </div>
          ) : <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center h-64 text-gray-500"><div className="text-center"><div className="text-4xl mb-2">💰</div><p>Sélectionnez un logement</p></div></div>}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// CONCIERGERIE — CHECK-IN / CHECK-OUT
// ══════════════════════════════════════════════
function CheckinOutSection({ userId }: { userId: string }) {
  const STORAGE_KEY = `checkinout_${userId}`
  interface Passage {
    id: string; type: 'checkin' | 'checkout'; logement: string; client: string
    date: string; heure: string; statut: 'planifié' | 'effectué' | 'annulé'
    codeAcces: string; notes: string; etat: string[]
  }
  const [passages, setPassages] = useState<Passage[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [form, setForm] = useState<Omit<Passage, 'id'>>({ type: 'checkin', logement: '', client: '', date: new Date().toISOString().split('T')[0], heure: '15:00', statut: 'planifié', codeAcces: '', notes: '', etat: [] })

  const save = (data: Passage[]) => { setPassages(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addPassage = () => { save([...passages, { ...form, id: Date.now().toString() }]); setShowForm(false) }
  const changeStatut = (id: string, statut: Passage['statut']) => save(passages.map(p => p.id === id ? { ...p, statut } : p))
  const toggleCheck = (pid: string, item: string) => save(passages.map(p => p.id === pid ? { ...p, etat: p.etat.includes(item) ? p.etat.filter(e => e !== item) : [...p.etat, item] } : p))

  const filtered = passages.filter(p => !filterDate || p.date === filterDate)
  const today = new Date().toISOString().split('T')[0]
  const etatItems = ['Ménage OK', 'Clés remises', 'Inventaire fait', 'Caution encaissée', 'Livret remis', 'Photos état']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">✅ Check-in / Check-out</h2><p className="text-gray-500 text-sm mt-1">Gestion des arrivées et départs</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">+ Planifier</button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[["Check-ins aujourd'hui", passages.filter(p => p.date === today && p.type === 'checkin').length, 'bg-blue-50 border-blue-200 text-blue-700'], ["Check-outs aujourd'hui", passages.filter(p => p.date === today && p.type === 'checkout').length, 'bg-orange-50 border-orange-200 text-orange-700'], ['Planifiés', passages.filter(p => p.statut === 'planifié').length, 'bg-yellow-50 border-yellow-200 text-yellow-700'], ['Effectués', passages.filter(p => p.statut === 'effectué').length, 'bg-green-50 border-green-200 text-green-700']].map(([label, val, cls]) => (
          <div key={String(label)} className={`border rounded-xl p-4 ${cls}`}><div className="text-sm font-medium">{label}</div><div className="text-2xl font-bold mt-1">{val}</div></div>
        ))}
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-sm font-medium text-gray-700">Type</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.type} onChange={e => setForm({...form, type: e.target.value as 'checkin' | 'checkout'})}><option value="checkin">✅ Check-in</option><option value="checkout">🚪 Check-out</option></select></div>
            <div><label className="text-sm font-medium text-gray-700">Logement *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.logement} onChange={e => setForm({...form, logement: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Client *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Date</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Heure</label><input type="time" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.heure} onChange={e => setForm({...form, heure: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Code accès / boîte à clés</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.codeAcces} onChange={e => setForm({...form, codeAcces: e.target.value})} placeholder="1234" /></div>
            <div className="col-span-3"><label className="text-sm font-medium text-gray-700">Notes</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addPassage} disabled={!form.logement || !form.client} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Planifier</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Annuler</button>
          </div>
        </div>
      )}
      <div className="flex gap-3 items-center">
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        <button onClick={() => setFilterDate('')} className="text-sm text-blue-600">Tout voir</button>
      </div>
      <div className="space-y-3">
        {filtered.length === 0 ? <div className="text-center py-12 text-gray-500"><div className="text-4xl mb-2">🔑</div><p>Aucun passage prévu</p></div> : filtered.sort((a, b) => a.heure.localeCompare(b.heure)).map(p => (
          <div key={p.id} className={`bg-white rounded-xl border p-4 shadow-sm ${p.statut === 'effectué' ? 'opacity-70' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`text-2xl w-12 h-12 rounded-full flex items-center justify-center ${p.type === 'checkin' ? 'bg-blue-100' : 'bg-orange-100'}`}>{p.type === 'checkin' ? '✅' : '🚪'}</div>
                <div>
                  <div className="font-semibold">{p.type === 'checkin' ? 'Check-in' : 'Check-out'} — {p.client}</div>
                  <div className="text-sm text-gray-600">{p.logement} · {p.heure}</div>
                  {p.codeAcces && <div className="text-xs text-gray-500">🔐 Code : {p.codeAcces}</div>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.statut === 'planifié' ? 'bg-yellow-100 text-yellow-700' : p.statut === 'effectué' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.statut}</span>
                {p.statut === 'planifié' && <button onClick={() => changeStatut(p.id, 'effectué')} className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 font-medium">Marquer effectué</button>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {etatItems.map(item => (
                <label key={item} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={p.etat.includes(item)} onChange={() => toggleCheck(p.id, item)} className="w-3.5 h-3.5 accent-blue-600" />
                  <span className="text-xs text-gray-600">{item}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// CONCIERGERIE — LIVRET D'ACCUEIL DIGITAL
// ══════════════════════════════════════════════
function LivretAccueilSection({ userId }: { userId: string }) {
  const STORAGE_KEY = `livret_${userId}`
  interface Livret { id: string; logement: string; wifi: string; wifiMdp: string; codeAcces: string; reglement: string; instructions: string; urgences: string; transports: string; restaurants: string; contact: string }
  const [livrets, setLivrets] = useState<Livret[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [selected, setSelected] = useState<Livret | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [newLogement, setNewLogement] = useState('')

  const emptyLivret = (logement: string): Livret => ({ id: Date.now().toString(), logement, wifi: '', wifiMdp: '', codeAcces: '', reglement: '', instructions: '', urgences: 'SAMU 15 · Police 17 · Pompiers 18 · Urgences 112', transports: '', restaurants: '', contact: '' })
  const save = (data: Livret[]) => { setLivrets(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const createLivret = () => { const l = emptyLivret(newLogement); save([...livrets, l]); setSelected(l); setShowForm(false); setNewLogement('') }
  const updateLivret = (field: keyof Livret, value: string) => {
    if (!selected) return
    const updated = { ...selected, [field]: value }
    save(livrets.map(l => l.id === selected.id ? updated : l)); setSelected(updated)
  }
  const copyLivret = (l: Livret) => {
    const text = `🏠 BIENVENUE — ${l.logement}\n\n📶 WiFi : ${l.wifi}\n🔑 Mot de passe : ${l.wifiMdp}\n🔐 Code accès : ${l.codeAcces}\n\n📋 RÈGLEMENT\n${l.reglement}\n\n📖 INSTRUCTIONS\n${l.instructions}\n\n🚨 URGENCES\n${l.urgences}\n\n🚌 TRANSPORTS\n${l.transports}\n\n🍽️ RESTAURANTS\n${l.restaurants}\n\n📞 CONTACT\n${l.contact}`
    navigator.clipboard.writeText(text).then(() => alert('Livret copié !'))
  }

  const fields: [string, keyof Livret, string, boolean][] = [
    ['📶 Nom WiFi', 'wifi', 'FreeBox-123', false],
    ['🔑 Mot de passe WiFi', 'wifiMdp', '••••••••', false],
    ['🔐 Code accès / boîte à clés', 'codeAcces', '1234', false],
    ['📞 Contact concierge', 'contact', '06 00 00 00 00', false],
    ['📋 Règlement intérieur', 'reglement', 'Pas de fête, pas de fumée...', true],
    ['📖 Instructions logement', 'instructions', 'La poubelle se sort le lundi...', true],
    ['🚨 Urgences', 'urgences', 'SAMU 15 · Police 17 · Pompiers 18', true],
    ['🚌 Transports', 'transports', 'Métro ligne 1 à 200m...', true],
    ['🍽️ Restaurants', 'restaurants', 'Le Bistrot, 5 rue...', true],
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">📖 Livret d&apos;Accueil Digital</h2><p className="text-gray-500 text-sm mt-1">Guide de bienvenue personnalisé par logement</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">+ Créer un livret</button>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div><label className="text-sm font-medium text-gray-700">Nom du logement *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={newLogement} onChange={e => setNewLogement(e.target.value)} placeholder="Appartement 2P - Rue de la Paix" /></div>
          <div className="flex gap-3 mt-4">
            <button onClick={createLivret} disabled={!newLogement} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Créer</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Annuler</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-3">
          {livrets.length === 0 ? <div className="text-center py-8 text-gray-500 text-sm">Aucun livret créé</div> : livrets.map(l => (
            <div key={l.id} onClick={() => setSelected(l)} className={`bg-white rounded-xl border p-4 cursor-pointer hover:border-blue-300 ${selected?.id === l.id ? 'border-blue-500 ring-1 ring-blue-200' : ''}`}>
              <div className="font-semibold text-sm">{l.logement}</div>
              <div className="text-xs text-gray-500 mt-1">📶 {l.wifi || 'WiFi non renseigné'}</div>
              <button onClick={e => { e.stopPropagation(); copyLivret(l) }} className="mt-2 text-xs text-blue-600 hover:text-blue-800">📋 Copier le livret</button>
            </div>
          ))}
        </div>
        <div className="col-span-2">
          {selected ? (
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-3">
              <h3 className="font-bold text-lg">{selected.logement}</h3>
              <div className="grid grid-cols-2 gap-4">
                {fields.filter(([,,, isTextarea]) => !isTextarea).map(([label, field, placeholder]) => (
                  <div key={String(field)}><label className="text-xs font-medium text-gray-600">{label}</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={selected[field]} onChange={e => updateLivret(field, e.target.value)} placeholder={placeholder} /></div>
                ))}
              </div>
              {fields.filter(([,,, isTextarea]) => isTextarea).map(([label, field, placeholder]) => (
                <div key={String(field)}><label className="text-xs font-medium text-gray-600">{label}</label><textarea className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={2} value={selected[field]} onChange={e => updateLivret(field, e.target.value)} placeholder={placeholder} /></div>
              ))}
              <button onClick={() => copyLivret(selected)} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700">📋 Copier le livret complet (WhatsApp / email)</button>
            </div>
          ) : <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center h-64 text-gray-500"><div className="text-center"><div className="text-4xl mb-2">📖</div><p>Sélectionnez un livret à éditer</p></div></div>}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// CONCIERGERIE — PLANNING MÉNAGE
// ══════════════════════════════════════════════
function PlanningMenageSection({ userId }: { userId: string }) {
  const STORAGE_KEY = `menage_${userId}`
  interface TacheMenage { id: string; logement: string; date: string; heure: string; prestataire: string; statut: 'à_faire' | 'en_cours' | 'fait' | 'vérifié'; type: 'arrivée' | 'départ' | 'recouche' | 'entretien'; notes: string; checklist: string[] }
  const [taches, setTaches] = useState<TacheMenage[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [form, setForm] = useState<Omit<TacheMenage, 'id' | 'checklist'>>({ logement: '', date: new Date().toISOString().split('T')[0], heure: '11:00', prestataire: '', statut: 'à_faire', type: 'départ', notes: '' })

  const save = (data: TacheMenage[]) => { setTaches(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addTache = () => { save([...taches, { ...form, id: Date.now().toString(), checklist: [] }]); setShowForm(false) }
  const toggleCheck = (tid: string, item: string) => save(taches.map(t => t.id === tid ? { ...t, checklist: t.checklist.includes(item) ? t.checklist.filter(c => c !== item) : [...t.checklist, item] } : t))
  const changeStatut = (id: string, statut: TacheMenage['statut']) => save(taches.map(t => t.id === id ? { ...t, statut } : t))

  const filtered = taches.filter(t => !filterDate || t.date === filterDate)
  const checklistItems = ['Chambres', 'Salle de bain', 'Cuisine', 'Salon', 'Poubelles vidées', 'Linge changé', 'Serviettes propres', 'Inventaire vérifié']
  const typeColors: Record<string, string> = { arrivée: 'bg-blue-100 text-blue-700', départ: 'bg-orange-100 text-orange-700', recouche: 'bg-purple-100 text-purple-700', entretien: 'bg-gray-100 text-gray-700' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">🧹 Planning Ménage</h2><p className="text-gray-500 text-sm mt-1">Coordination des équipes de nettoyage</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">+ Planifier ménage</button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[['À faire', 'à_faire', 'bg-yellow-50 border-yellow-200 text-yellow-700'], ['En cours', 'en_cours', 'bg-blue-50 border-blue-200 text-blue-700'], ['Fait', 'fait', 'bg-green-50 border-green-200 text-green-700'], ['Vérifié', 'vérifié', 'bg-purple-50 border-purple-200 text-purple-700']].map(([label, statut, cls]) => (
          <div key={String(statut)} className={`border rounded-xl p-4 ${cls}`}><div className="text-sm font-medium">{label}</div><div className="text-2xl font-bold mt-1">{taches.filter(t => t.statut === statut).length}</div></div>
        ))}
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-sm font-medium text-gray-700">Logement *</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.logement} onChange={e => setForm({...form, logement: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Type</label><select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.type} onChange={e => setForm({...form, type: e.target.value as TacheMenage['type']})}><option value="départ">🚪 Ménage départ</option><option value="arrivée">✅ Prépa arrivée</option><option value="recouche">🔄 Recouche</option><option value="entretien">🧽 Entretien</option></select></div>
            <div><label className="text-sm font-medium text-gray-700">Prestataire</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.prestataire} onChange={e => setForm({...form, prestataire: e.target.value})} placeholder="Marie D." /></div>
            <div><label className="text-sm font-medium text-gray-700">Date</label><input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Heure</label><input type="time" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.heure} onChange={e => setForm({...form, heure: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-gray-700">Notes</label><input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addTache} disabled={!form.logement} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Planifier</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Annuler</button>
          </div>
        </div>
      )}
      <div className="flex gap-3 items-center">
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        <button onClick={() => setFilterDate('')} className="text-sm text-blue-600">Tout voir</button>
        <span className="text-sm text-gray-500">{filtered.length} tâche(s)</span>
      </div>
      <div className="space-y-3">
        {filtered.length === 0 ? <div className="text-center py-12 text-gray-500"><div className="text-4xl mb-2">🧹</div><p>Aucune tâche planifiée</p></div> : filtered.sort((a, b) => a.heure.localeCompare(b.heure)).map(t => (
          <div key={t.id} className={`bg-white rounded-xl border p-4 shadow-sm ${t.statut === 'vérifié' ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">🧹</div>
                <div>
                  <div className="flex items-center gap-2"><span className="font-semibold">{t.logement}</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[t.type]}`}>{t.type}</span></div>
                  <div className="text-sm text-gray-600">{t.heure} · {t.prestataire || 'Non assigné'}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.statut === 'à_faire' ? 'bg-yellow-100 text-yellow-700' : t.statut === 'en_cours' ? 'bg-blue-100 text-blue-700' : t.statut === 'fait' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>{t.statut.replace('_', ' ')}</span>
                {t.statut === 'à_faire' && <button onClick={() => changeStatut(t.id, 'en_cours')} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">Démarrer</button>}
                {t.statut === 'en_cours' && <button onClick={() => changeStatut(t.id, 'fait')} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">Terminer</button>}
                {t.statut === 'fait' && <button onClick={() => changeStatut(t.id, 'vérifié')} className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">Vérifier</button>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {checklistItems.map(item => (
                <label key={item} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={t.checklist.includes(item)} onChange={() => toggleCheck(t.id, item)} className="w-3.5 h-3.5 accent-green-600" />
                  <span className={`text-xs ${t.checklist.includes(item) ? 'text-green-600 line-through' : 'text-gray-600'}`}>{item}</span>
                </label>
              ))}
            </div>
            <div className="mt-1 text-xs text-gray-500">{t.checklist.length}/{checklistItems.length} validés · {Math.round(t.checklist.length / checklistItems.length * 100)}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// CONCIERGERIE — REVPAR / REPORTING
// ══════════════════════════════════════════════
function RevPARSection({ userId }: { userId: string }) {
  const STORAGE_KEY_CHANNEL = `channel_${userId}`
  const [reservations] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_CHANNEL) || '[]') } catch { return [] }
  })
  const [filterLogement, setFilterLogement] = useState('')
  const [filterMois, setFilterMois] = useState(new Date().toISOString().slice(0, 7))

  const logements = [...new Set(reservations.map((r: any) => r.logement).filter(Boolean))]
  const resaFiltered = reservations.filter((r: any) => {
    const inMois = !filterMois || (r.dateArrivee && r.dateArrivee.startsWith(filterMois))
    const inLog = !filterLogement || r.logement === filterLogement
    return inMois && inLog && r.statut === 'confirmée'
  })
  const getNuits = (r: any) => {
    if (!r.dateArrivee || !r.dateDepart) return 0
    return Math.max(0, (new Date(r.dateDepart).getTime() - new Date(r.dateArrivee).getTime()) / 86400000)
  }
  const totalNuits = resaFiltered.reduce((s: number, r: any) => s + getNuits(r), 0)
  const totalCA = resaFiltered.reduce((s: number, r: any) => s + (r.montantTotal || 0), 0)
  const totalCommissions = resaFiltered.reduce((s: number, r: any) => s + (r.commission || 0), 0)
  const [yr, mo] = filterMois ? filterMois.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1]
  const daysInMonth = new Date(yr, mo, 0).getDate()
  const logCount = filterLogement ? 1 : Math.max(1, logements.length)
  const totalDisponible = daysInMonth * logCount
  const tauxOccupation = totalDisponible > 0 ? Math.round((totalNuits / totalDisponible) * 100) : 0
  const revpar = totalDisponible > 0 ? Math.round(totalCA / totalDisponible) : 0
  const adr = totalNuits > 0 ? Math.round(totalCA / totalNuits) : 0

  const plateformes = ['airbnb', 'booking', 'vrbo', 'direct', 'abritel', 'autre']
  const byPlateforme = plateformes.map(p => ({
    p, count: resaFiltered.filter((r: any) => r.plateforme === p).length,
    ca: resaFiltered.filter((r: any) => r.plateforme === p).reduce((s: number, r: any) => s + (r.montantTotal || 0), 0),
    nuits: resaFiltered.filter((r: any) => r.plateforme === p).reduce((s: number, r: any) => s + getNuits(r), 0)
  })).filter(p => p.count > 0)

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">📈 Reporting RevPAR</h2><p className="text-gray-500 text-sm mt-1">Revenue Per Available Room — Indicateurs de performance</p></div>
      <div className="flex gap-3">
        <div><label className="text-xs font-medium text-gray-600">Mois</label><input type="month" className="mt-1 border rounded-lg px-3 py-2 text-sm" value={filterMois} onChange={e => setFilterMois(e.target.value)} /></div>
        <div><label className="text-xs font-medium text-gray-600">Logement</label><select className="mt-1 border rounded-lg px-3 py-2 text-sm" value={filterLogement} onChange={e => setFilterLogement(e.target.value)}><option value="">Tous ({logements.length})</option>{logements.map(l => <option key={l}>{l}</option>)}</select></div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[
          ['RevPAR', `${revpar} €`, 'Revenu par nuit disponible', 'bg-blue-50 border-blue-200 text-blue-700'],
          ['ADR', `${adr} €`, 'Prix moyen par nuit vendue', 'bg-purple-50 border-purple-200 text-purple-700'],
          ['Taux occupation', `${tauxOccupation}%`, `${totalNuits}/${totalDisponible} nuits`, 'bg-green-50 border-green-200 text-green-700'],
          ['CA brut', `${totalCA.toLocaleString('fr-FR')} €`, `Net: ${(totalCA - totalCommissions).toLocaleString('fr-FR')} €`, 'bg-orange-50 border-orange-200 text-orange-700'],
        ].map(([label, value, sub, cls]) => (
          <div key={String(label)} className={`border rounded-xl p-5 ${cls}`}>
            <div className="text-sm font-semibold">{label}</div>
            <div className="text-3xl font-bold mt-2">{value}</div>
            <div className="text-xs mt-1 opacity-75">{sub}</div>
          </div>
        ))}
      </div>
      {byPlateforme.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Performance par plateforme</h3>
          <div className="space-y-3">
            {byPlateforme.map(p => {
              const pct = totalCA > 0 ? Math.round(p.ca / totalCA * 100) : 0
              return (
                <div key={p.p} className="flex items-center gap-4">
                  <div className="w-20 text-sm font-medium capitalize text-gray-700">{p.p}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5"><div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${pct}%` }}></div></div>
                  <div className="w-20 text-right text-sm font-semibold">{p.ca.toLocaleString('fr-FR')} €</div>
                  <div className="w-12 text-right text-xs text-gray-500">{p.nuits} nuits</div>
                  <div className="w-8 text-right text-xs text-gray-500">{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {reservations.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="font-medium text-blue-700">Aucune donnée disponible</p>
          <p className="text-sm text-blue-600 mt-1">Ajoutez des réservations dans le Channel Manager pour voir vos statistiques ici</p>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ORDRES DE MISSION — Canal artisan pour recevoir et répondre aux missions syndic
// ══════════════════════════════════════════════════════════════════════════════
function OrdresMissionPage({ artisan }: { artisan: any }) {
  // Clé localStorage basée sur le nom de l'artisan (normalisé)
  const artisanKey = `canal_artisan_${(artisan?.company_name || artisan?.nom || artisan?.id || 'artisan').replace(/\s+/g, '_').toLowerCase()}`

  const [missions, setMissions] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newMsg, setNewMsg] = useState('')
  const [authorName, setAuthorName] = useState(artisan?.company_name || artisan?.nom || 'Artisan')
  const [tab, setTab] = useState<'nouvelles' | 'toutes'>('nouvelles')

  // Charger les ordres de mission depuis localStorage
  useEffect(() => {
    const loadMissions = () => {
      try {
        const data = JSON.parse(localStorage.getItem(artisanKey) || '[]')
        setMissions(data)
      } catch {}
    }
    loadMissions()
    // Rafraichir toutes les 5 secondes
    const interval = setInterval(loadMissions, 5000)
    return () => clearInterval(interval)
  }, [artisanKey])

  const saveMissions = (updated: any[]) => {
    setMissions(updated)
    try { localStorage.setItem(artisanKey, JSON.stringify(updated)) } catch {}
  }

  const selectedMission = missions.find(m => m.id === selectedId) || null

  const sendMsg = () => {
    if (!newMsg.trim() || !selectedMission) return
    const msg = { auteur: authorName, role: 'artisan', texte: newMsg.trim(), date: new Date().toISOString() }
    const updated = missions.map(m =>
      m.id === selectedMission.id
        ? { ...m, canalMessages: [...(m.canalMessages || []), msg] }
        : m
    )
    saveMissions(updated)

    // Répercuter dans le localStorage syndic (fixit_syndic_missions_*)
    // On cherche toutes les clés fixit_syndic_missions_*
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('fixit_syndic_missions_')) {
          const syndicMissions = JSON.parse(localStorage.getItem(key) || '[]')
          const idx = syndicMissions.findIndex((sm: any) => sm.id === selectedMission.id)
          if (idx !== -1) {
            syndicMissions[idx] = { ...syndicMissions[idx], canalMessages: [...(syndicMissions[idx].canalMessages || []), msg] }
            localStorage.setItem(key, JSON.stringify(syndicMissions))
          }
        }
      }
    } catch {}

    setNewMsg('')
  }

  const confirmerMission = (missionId: string) => {
    const now = new Date()
    const confirmMsg = { auteur: authorName, role: 'artisan', texte: `✅ Ordre de mission confirmé. Je serai présent à la date et heure indiquées. Merci.`, date: now.toISOString() }
    const updated = missions.map(m =>
      m.id === missionId ? { ...m, statutArtisan: 'confirme', canalMessages: [...(m.canalMessages || []), confirmMsg] } : m
    )
    saveMissions(updated)

    // Répercuter statut dans missions syndic
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('fixit_syndic_missions_')) {
          const syndicMissions = JSON.parse(localStorage.getItem(key) || '[]')
          const idx = syndicMissions.findIndex((sm: any) => sm.id === missionId)
          if (idx !== -1) {
            syndicMissions[idx] = { ...syndicMissions[idx], statut: 'acceptee', canalMessages: [...(syndicMissions[idx].canalMessages || []), confirmMsg] }
            localStorage.setItem(key, JSON.stringify(syndicMissions))
          }
        }
      }
    } catch {}
  }

  const filteredMissions = tab === 'nouvelles'
    ? missions.filter(m => !m.statutArtisan || m.statutArtisan === 'en_attente')
    : missions

  const prioriteColors: Record<string, string> = {
    urgente: 'bg-red-100 text-red-700 border-red-200',
    normale: 'bg-blue-100 text-blue-700 border-blue-200',
    planifiee: 'bg-gray-100 text-gray-600 border-gray-200',
  }

  if (missions.length === 0) {
    return (
      <div className="animate-fadeIn">
        <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-[#FFC107] shadow-sm">
          <h1 className="text-2xl font-semibold">📋 Ordres de mission</h1>
          <p className="text-sm text-gray-500 mt-1">Missions reçues depuis les gestionnaires syndic</p>
        </div>
        <div className="p-6 lg:p-10">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 text-center py-20">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-bold text-gray-700">Aucun ordre de mission</h3>
            <p className="text-gray-500 mt-2 text-sm">Les ordres de mission envoyés par les syndics apparaîtront ici</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn flex flex-col h-full">
      <div className="bg-white px-6 lg:px-10 py-4 border-b-2 border-[#FFC107] shadow-sm flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">📋 Ordres de mission syndic</h1>
            <p className="text-xs text-gray-500 mt-0.5">{missions.length} ordre{missions.length > 1 ? 's' : ''} reçu{missions.length > 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2">
            {[['nouvelles', `Nouvelles (${missions.filter(m => !m.statutArtisan || m.statutArtisan === 'en_attente').length})`], ['toutes', 'Toutes']].map(([val, lbl]) => (
              <button key={val} onClick={() => setTab(val as any)} className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${tab === val ? 'bg-[#FFC107] border-[#FFC107] text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ─ Liste missions ─ */}
        <div className="w-72 flex-shrink-0 border-r border-gray-100 overflow-y-auto bg-gray-50">
          {filteredMissions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">Aucune mission dans cette catégorie</p>
            </div>
          ) : filteredMissions.map(m => {
            const isSelected = m.id === selectedId
            const isConfirme = m.statutArtisan === 'confirme'
            const msgCount = m.canalMessages?.length || 0
            const lastMsg = msgCount > 0 ? m.canalMessages[msgCount - 1] : null

            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`w-full text-left p-4 border-b border-gray-100 transition hover:bg-white ${isSelected ? 'bg-white border-l-4 border-l-[#FFC107]' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="text-xs font-bold text-gray-900 truncate">{m.type || 'Intervention'}</span>
                      {m.priorite && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${prioriteColors[m.priorite] || prioriteColors.normale}`}>
                          {m.priorite === 'urgente' ? '🔴 URGENT' : m.priorite === 'normale' ? '🔵' : '⚪'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 truncate">🏢 {m.immeuble || '—'}</p>
                    {(m.batiment || m.etage || m.numLot) && (
                      <p className="text-xs text-gray-500 truncate">
                        {[m.batiment && `Bât. ${m.batiment}`, m.etage && `Ét. ${m.etage}`, m.numLot && `Lot ${m.numLot}`].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {m.dateIntervention && (
                      <p className="text-xs text-green-600 font-medium mt-0.5">
                        📅 {new Date(m.dateIntervention).toLocaleDateString('fr-FR')}{m.heureIntervention ? ` à ${m.heureIntervention}` : ''}
                      </p>
                    )}
                    {lastMsg && lastMsg.role !== 'system' && (
                      <p className="text-xs text-gray-500 mt-1 truncate italic">{lastMsg.texte.substring(0, 45)}…</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {isConfirme ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✅ Confirmé</span>
                    ) : (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold animate-pulse">⏳ À confirmer</span>
                    )}
                    {msgCount > 0 && <span className="text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded-full font-bold">{msgCount}</span>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* ─ Conversation ─ */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {!selectedMission ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-5xl mb-3">📋</div>
                <p className="font-medium">Sélectionnez un ordre de mission</p>
                <p className="text-sm mt-1">pour voir les détails et le canal de communication</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header mission */}
              <div className="p-4 border-b border-gray-100 bg-white flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-gray-900">{selectedMission.type || 'Intervention'}</h2>
                      {selectedMission.priorite === 'urgente' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold border border-red-200">🔴 URGENT</span>}
                      {selectedMission.statutArtisan === 'confirme' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✅ Confirmé</span>}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      <p className="text-sm text-gray-600">🏢 {selectedMission.immeuble}{selectedMission.adresseImmeuble ? ` — ${selectedMission.adresseImmeuble}` : ''}</p>
                      {(selectedMission.batiment || selectedMission.etage || selectedMission.numLot) && (
                        <p className="text-sm text-gray-600">
                          📌 {[selectedMission.batiment && `Bât. ${selectedMission.batiment}`, selectedMission.etage && `Étage ${selectedMission.etage}`, selectedMission.numLot && `Appt/Lot ${selectedMission.numLot}`].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {selectedMission.locataire && (
                        <p className="text-sm text-blue-600">👤 {selectedMission.locataire}{selectedMission.telephoneLocataire ? ` — 📞 ${selectedMission.telephoneLocataire}` : ''}</p>
                      )}
                      {selectedMission.accesLogement && (
                        <p className="text-sm text-amber-600">🔑 Accès : {selectedMission.accesLogement}</p>
                      )}
                      {selectedMission.dateIntervention && (
                        <p className="text-sm font-semibold text-green-600">
                          📅 Intervention : {new Date(selectedMission.dateIntervention).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{selectedMission.heureIntervention ? ` à ${selectedMission.heureIntervention}` : ''}
                        </p>
                      )}
                      {selectedMission.description && (
                        <p className="text-sm text-gray-500 mt-1">🔧 {selectedMission.description}</p>
                      )}
                    </div>
                  </div>
                  {/* Bouton confirmer */}
                  {selectedMission.statutArtisan !== 'confirme' && (
                    <button
                      onClick={() => confirmerMission(selectedMission.id)}
                      className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition shadow-sm"
                    >
                      ✅ Confirmer la mission
                    </button>
                  )}
                </div>
              </div>

              {/* Fil de messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {(!selectedMission.canalMessages || selectedMission.canalMessages.length === 0) ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-2">💬</div>
                    <p className="text-sm">Pas encore de messages — confirmez la mission ou posez une question</p>
                  </div>
                ) : selectedMission.canalMessages.map((msg: any, i: number) => {
                  const isMe = msg.role === 'artisan'
                  const isSystem = msg.role === 'system'

                  if (isSystem) {
                    return (
                      <div key={i} className="flex justify-center">
                        <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 max-w-xl">
                          <p className="text-xs text-gray-500 text-center leading-relaxed whitespace-pre-line">{msg.texte}</p>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={i} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isMe ? 'bg-[#FFC107] text-white' : 'bg-purple-100 text-purple-700'}`}>
                        {msg.auteur.charAt(0).toUpperCase()}
                      </div>
                      <div className={`max-w-sm flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                        <p className="text-xs text-gray-500 px-1">{msg.auteur} · {isMe ? 'Vous' : 'Gestionnaire'}</p>
                        <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line shadow-sm ${isMe ? 'bg-[#FFC107] text-white rounded-tr-sm' : 'bg-white text-gray-900 border border-gray-100 rounded-tl-sm'}`}>
                          {msg.texte}
                        </div>
                        <p className="text-xs text-gray-300 px-1">{new Date(msg.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Quick actions + saisie */}
              <div className="border-t border-gray-100 bg-white px-4 pt-3 pb-4 flex-shrink-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <label className="text-xs text-gray-500">Nom :</label>
                  <input className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-32 focus:ring-1 focus:ring-amber-400 focus:outline-none" value={authorName} onChange={e => setAuthorName(e.target.value)} />
                  <div className="flex gap-1.5 flex-wrap">
                    {['✅ Mission confirmée', '📍 En route', '🔍 Diagnostic terminé', '⚠️ Problème supplémentaire', '📦 Pièce à commander'].map(txt => (
                      <button key={txt} onClick={() => setNewMsg(txt)} className="text-xs bg-gray-100 hover:bg-amber-50 hover:text-amber-700 px-2 py-1 rounded-full transition">{txt}</button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <textarea
                    className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-amber-400 outline-none resize-none"
                    placeholder="Répondre au gestionnaire syndic…"
                    value={newMsg}
                    rows={2}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMsg())}
                  />
                  <button
                    onClick={sendMsg}
                    disabled={!newMsg.trim()}
                    className="bg-[#FFC107] text-white px-5 py-2 rounded-xl font-semibold text-sm hover:bg-amber-500 transition disabled:opacity-50 self-end"
                  >
                    Envoyer
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
