'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import DevisFactureForm from '@/components/DevisFactureForm'
import AiChatBot from '@/components/AiChatBot'

export default function DashboardPage() {
  const router = useRouter()
  const [artisan, setArtisan] = useState<any>(null)
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
  const [newRdv, setNewRdv] = useState({ client_name: '', service_id: '', date: '', time: '', address: '', notes: '' })
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [showBookingDetail, setShowBookingDetail] = useState(false)
  const [convertingDevis, setConvertingDevis] = useState<any>(null)
  const [savingAvail, setSavingAvail] = useState(false)
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
  const [motifForm, setMotifForm] = useState({
    name: '', description: '', duration_minutes: 60, price_ht: 0, price_ttc: 0, pricing_unit: 'forfait'
  })
  const [savingMotif, setSavingMotif] = useState(false)

  // Settings state
  const [settingsForm, setSettingsForm] = useState({ company_name: '', email: '', phone: '', bio: '' })
  const [savingSettings, setSavingSettings] = useState(false)

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

    const { data: artisanData } = await supabase
      .from('profiles_artisan').select('*').eq('user_id', user.id).single()
    if (!artisanData) { router.push('/pro/login'); return }

    setArtisan(artisanData)
    const cleanBioForDisplay = (artisanData.bio || '').replace(/\s*<!--DS:[\s\S]*?-->/, '').trim()
    setSettingsForm({
      company_name: artisanData.company_name || '',
      email: user.email || '',
      phone: artisanData.phone || '06 51 46 66 98',
      bio: cleanBioForDisplay,
    })

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

    const savedAutoAccept = localStorage.getItem(`fixit_auto_accept_${artisanData.id}`)
    if (savedAutoAccept !== null) setAutoAccept(savedAutoAccept === 'true')

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

    const docs = JSON.parse(localStorage.getItem('fixit_documents') || '[]')
    const drafts = JSON.parse(localStorage.getItem('fixit_drafts') || '[]')
    setSavedDocuments([...docs, ...drafts])

    setLoading(false)
  }

  const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

  const toggleAutoAccept = () => {
    const newVal = !autoAccept
    setAutoAccept(newVal)
    if (artisan) localStorage.setItem(`fixit_auto_accept_${artisan.id}`, String(newVal))
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
    const status = autoAccept ? 'confirmed' : 'pending'
    const { data, error } = await supabase.from('bookings').insert({
      artisan_id: artisan.id,
      service_id: newRdv.service_id,
      status,
      booking_date: newRdv.date,
      booking_time: newRdv.time,
      duration_minutes: service?.duration_minutes || 60,
      address: newRdv.address || 'A definir',
      notes: newRdv.client_name ? `Client: ${newRdv.client_name}. ${newRdv.notes || ''}` : newRdv.notes,
      price_ht: service?.price_ht,
      price_ttc: service?.price_ttc,
    }).select('*, services(name)').single()
    if (!error && data) {
      setBookings([data, ...bookings])
      setShowNewRdv(false)
      setNewRdv({ client_name: '', service_id: '', date: '', time: '', address: '', notes: '' })
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
    setNewRdv({ client_name: '', service_id: '', date: dateStr, time: hour, address: '', notes: '' })
    setShowNewRdv(true)
  }

  // Clic sur un RDV existant → ouvrir détail
  const handleBookingClick = (booking: any) => {
    setSelectedBooking(booking)
    setShowBookingDetail(true)
  }

  // Convertir un devis en facture
  const convertDevisToFacture = (devis: any) => {
    setConvertingDevis(devis)
    setShowFactureForm(true)
    setActivePage('factures')
    setSidebarOpen(false)
  }

  const getWeekDates = () => {
    const start = new Date(selectedWeekStart)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }

  const getBookingsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return bookings.filter((b) => b.booking_date === dateStr)
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
  const openNewMotif = () => {
    setEditingMotif(null)
    setMotifForm({ name: '', description: '', duration_minutes: 60, price_ht: 0, price_ttc: 0, pricing_unit: 'forfait' })
    setShowMotifModal(true)
  }

  const openEditMotif = (service: any) => {
    setEditingMotif(service)
    const pricingUnit = service.description?.includes('[m²]') ? 'm2'
      : service.description?.includes('[heure]') ? 'heure'
      : service.description?.includes('[unité]') ? 'unite'
      : 'forfait'
    const cleanDesc = (service.description || '').replace(/\s*\[(m²|heure|unité|forfait)\]\s*/g, '')
    setMotifForm({
      name: service.name || '',
      description: cleanDesc,
      duration_minutes: service.duration_minutes || 60,
      price_ht: service.price_ht || 0,
      price_ttc: service.price_ttc || 0,
      pricing_unit: pricingUnit,
    })
    setShowMotifModal(true)
  }

  const saveMotif = async () => {
    if (!artisan || !motifForm.name) return
    setSavingMotif(true)

    const unitLabel = motifForm.pricing_unit === 'm2' ? '[m²]'
      : motifForm.pricing_unit === 'heure' ? '[heure]'
      : motifForm.pricing_unit === 'unite' ? '[unité]'
      : '[forfait]'
    const description = `${motifForm.description || ''} ${unitLabel}`.trim()

    const payload = {
      artisan_id: artisan.id,
      name: motifForm.name,
      description,
      duration_minutes: motifForm.duration_minutes,
      price_ht: motifForm.price_ht,
      price_ttc: motifForm.price_ttc || motifForm.price_ht * 1.2,
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
    if (service.description?.includes('[m²]')) return 'au m²'
    if (service.description?.includes('[heure]')) return '/heure'
    if (service.description?.includes('[unité]')) return '/unité'
    return 'forfait'
  }

  const getCleanDescription = (service: any) => {
    return (service.description || '').replace(/\s*\[(m²|heure|unité|forfait)\]\s*/g, '').trim()
  }

  // ═══ SETTINGS SAVE ═══
  const saveSettings = async () => {
    if (!artisan) return
    setSavingSettings(true)
    await supabase.from('profiles_artisan').update({
      company_name: settingsForm.company_name,
      bio: settingsForm.bio,
    }).eq('id', artisan.id)
    setArtisan({ ...artisan, company_name: settingsForm.company_name, bio: settingsForm.bio })
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
    setSavingSettings(false)
    alert('✅ Profil mis à jour avec succès !')
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
  const navigateTo = (page: string) => {
    setActivePage(page)
    setSidebarOpen(false)
    // Reset form views when navigating via sidebar
    if (page === 'devis') setShowDevisForm(false)
    if (page === 'factures') setShowFactureForm(false)
  }

  const firstName = artisan?.company_name?.split(' ')[0] || 'Pro'
  const initials = artisan?.company_name
    ? artisan.company_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'PR'

  const completedBookings = bookings.filter((b) => b.status === 'completed')
  const pendingBookings = bookings.filter((b) => b.status === 'pending')
  const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.price_ttc || 0), 0)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-[#FFC107] border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Chargement du dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" }}>
      {/* ══════════ TOP BAR ══════════ */}
      <div className="bg-white border-b-2 border-[#FFC107] px-4 lg:px-6 py-3 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <button className="lg:hidden text-2xl" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <div className="text-2xl font-bold text-[#FFC107] cursor-pointer hover:scale-105 transition-transform" onClick={() => navigateTo('home')}>
            FIXIT
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
            <SidebarItem icon="📅" label="Agenda" active={activePage === 'calendar'} onClick={() => navigateTo('calendar')} />
            <SidebarItem icon="🔧" label="Motifs" active={activePage === 'motifs'} onClick={() => navigateTo('motifs')} />
            <SidebarItem icon="🕐" label="Horaires" active={activePage === 'horaires'} onClick={() => navigateTo('horaires')} />
          </div>
          <div className="mb-6">
            <div className="px-6 text-[0.7rem] uppercase text-[#95A5A6] mb-3 font-semibold tracking-widest">Communication</div>
            <SidebarItem icon="💬" label="Messages" active={activePage === 'messages'} badge={pendingBookings.length || undefined} onClick={() => navigateTo('messages')} />
            <SidebarItem icon="👥" label="Clients" active={activePage === 'clients'} onClick={() => navigateTo('clients')} />
          </div>
          <div className="mb-6">
            <div className="px-6 text-[0.7rem] uppercase text-[#95A5A6] mb-3 font-semibold tracking-widest">Facturation</div>
            <SidebarItem icon="📄" label="Devis" active={activePage === 'devis'} onClick={() => navigateTo('devis')} />
            <SidebarItem icon="🧾" label="Factures" active={activePage === 'factures'} onClick={() => navigateTo('factures')} />
          </div>
          <div className="mb-6">
            <div className="px-6 text-[0.7rem] uppercase text-[#95A5A6] mb-3 font-semibold tracking-widest">Analyse</div>
            <SidebarItem icon="📊" label="Statistiques" active={activePage === 'stats'} onClick={() => navigateTo('stats')} />
            <SidebarItem icon="💰" label="Revenus" active={activePage === 'revenus'} onClick={() => navigateTo('revenus')} />
            <SidebarItem icon="🧮" label="Comptabilité" active={activePage === 'comptabilite'} onClick={() => navigateTo('comptabilite')} />
            <SidebarItem icon="🛒" label="Matériaux" active={activePage === 'materiaux'} onClick={() => navigateTo('materiaux')} />
          </div>
          <div className="mb-6">
            <div className="px-6 text-[0.7rem] uppercase text-[#95A5A6] mb-3 font-semibold tracking-widest">Compte</div>
            <SidebarItem icon="⚙️" label="Parametres" active={activePage === 'settings'} onClick={() => navigateTo('settings')} />
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
              <div className="bg-gradient-to-r from-[#FFC107] to-[#FFD54F] p-8 lg:p-10 rounded-2xl text-gray-900 mb-8 shadow-lg">
                <h1 className="text-3xl lg:text-4xl font-bold mb-2">👋 Bonjour {firstName} !</h1>
                <p className="text-lg opacity-95">Vous avez {pendingBookings.length} intervention(s) en attente</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <StatCard icon="📅" iconBg="bg-blue-50" iconColor="text-blue-500" value={bookings.length.toString()} label="Interventions ce mois" change={`${pendingBookings.length} en attente`} positive onClick={() => navigateTo('calendar')} />
                <StatCard icon="💰" iconBg="bg-green-50" iconColor="text-green-500" value={formatPrice(totalRevenue)} label="Chiffre d'affaires" change={`${completedBookings.length} terminées`} positive onClick={() => navigateTo('revenus')} />
                <StatCard icon="🔧" iconBg="bg-amber-50" iconColor="text-orange-500" value={services.filter(s => s.active).length.toString()} label="Motifs actifs" change={`${services.length} au total`} onClick={() => navigateTo('motifs')} />
                <StatCard icon="⭐" iconBg="bg-pink-50" iconColor="text-pink-500" value={`${artisan?.rating_avg || '5.0'}/5`} label="Note moyenne" change={`${artisan?.rating_count || 0} avis`} positive onClick={() => navigateTo('stats')} />
              </div>

              <h2 className="text-xl font-bold mb-4">Actions rapides</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <QuickAction icon="📅" label="Nouvel RDV" onClick={() => { setShowNewRdv(true); navigateTo('calendar') }} />
                <QuickAction icon="📄" label="Créer devis" onClick={() => { setShowDevisForm(true); setActivePage('devis'); setSidebarOpen(false) }} />
                <QuickAction icon="🧾" label="Nouvelle facture" onClick={() => { setShowFactureForm(true); setActivePage('factures'); setSidebarOpen(false) }} />
                <QuickAction icon="🔧" label="Nouveau motif" onClick={() => { openNewMotif(); navigateTo('motifs') }} />
              </div>

              {/* Real recent activity from bookings */}
              <div className="bg-white p-6 rounded-2xl shadow-sm">
                <h2 className="text-xl font-bold mb-5">Activité récente</h2>
                {bookings.length === 0 ? (
                  <p className="text-gray-400 text-center py-6">Aucune activité récente</p>
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
                  <div className="bg-white p-5 rounded-2xl shadow-sm">
                    <div className="text-sm text-gray-500 mb-1">RDV aujourd&apos;hui</div>
                    <div className="text-2xl font-bold">{getBookingsForDate(new Date()).length}</div>
                    <div className="text-xs text-green-500 font-semibold mt-1">{getBookingsForDate(new Date()).filter(b => b.status === 'confirmed').length} confirm&eacute;(s)</div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl shadow-sm">
                    <div className="text-sm text-gray-500 mb-1">Taux de remplissage</div>
                    <div className="text-2xl font-bold">{bookings.length > 0 ? Math.round((bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length / bookings.length) * 100) : 0}%</div>
                    <div className="text-xs text-blue-500 font-semibold mt-1">cette semaine</div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl shadow-sm">
                    <div className="text-sm text-gray-500 mb-1">Revenus du mois</div>
                    <div className="text-2xl font-bold">{formatPrice(totalRevenue)}</div>
                    <div className="text-xs text-green-500 font-semibold mt-1">{completedBookings.length} termin&eacute;e(s)</div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl shadow-sm">
                    <div className="text-sm text-gray-500 mb-1">Note moyenne</div>
                    <div className="text-2xl font-bold">{artisan?.rating_avg || '5.0'}/5</div>
                    <div className="text-xs text-amber-500 font-semibold mt-1">{artisan?.rating_count || 0} avis</div>
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
                      <button onClick={() => setShowNewRdv(true)} className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-4 py-1.5 rounded-lg font-semibold text-sm shadow-sm transition-all">
                        + Nouveau rendez-vous
                      </button>
                    </div>
                  </div>

                  {/* ═══ VUE JOUR ═══ */}
                  {calendarView === 'day' && (() => {
                    const dayDate = new Date(selectedDay)
                    const dayBookings = getBookingsForDate(dayDate)
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
                        {getCalendarHours().map((hour) => {
                          const hourBookings = dayBookings.filter((b) => b.booking_time?.substring(0, 5) === hour)
                          const isEmpty = hourBookings.length === 0
                          return (
                            <div key={hour} className="grid grid-cols-[70px_1fr] border-b border-gray-100 last:border-b-0">
                              <div className="p-2 text-right pr-3 text-xs text-gray-400 font-medium border-r border-gray-100 flex items-start justify-end pt-1">
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
                  {calendarView === 'week' && (
                    <div className="overflow-x-auto">
                      <div className="min-w-[800px]">
                        {/* Day headers */}
                        <div className="grid grid-cols-[70px_repeat(7,1fr)] border-b border-gray-200">
                          <div className="p-2 text-center text-xs text-gray-400 border-r border-gray-100"></div>
                          {getWeekDates().map((date, i) => {
                            const isToday = date.toDateString() === new Date().toDateString()
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6
                            return (
                              <div key={i} onClick={() => { setSelectedDay(date.toISOString().split('T')[0]); setCalendarView('day') }}
                                className={`p-3 text-center border-r border-gray-100 last:border-r-0 cursor-pointer hover:bg-amber-50 transition ${isWeekend ? 'bg-[#FAFAFA]' : ''}`}>
                                <div className={`text-xs uppercase tracking-wide ${isToday ? 'text-[#FFC107] font-bold' : 'text-gray-500'}`}>
                                  {DAY_SHORT[date.getDay()]}
                                </div>
                                <div className={`text-lg font-bold mt-0.5 ${isToday ? 'bg-[#FFC107] text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto' : 'text-gray-800'}`}>
                                  {date.getDate()}
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Time grid rows */}
                        {getCalendarHours().map((hour) => (
                          <div key={hour} className="grid grid-cols-[70px_repeat(7,1fr)] border-b border-gray-100 last:border-b-0">
                            <div className="p-2 text-right pr-3 text-xs text-gray-400 font-medium border-r border-gray-100 flex items-start justify-end pt-1">
                              {hour}
                            </div>
                            {getWeekDates().map((date, i) => {
                              const isWeekend = date.getDay() === 0 || date.getDay() === 6
                              const dayBookings = getBookingsForDate(date)
                              const hourBookings = dayBookings.filter((b) => b.booking_time?.substring(0, 5) === hour)
                              const isEmpty = hourBookings.length === 0
                              return (
                                <div
                                  key={i}
                                  onClick={() => isEmpty && handleEmptyCellClick(date, hour)}
                                  className={`min-h-[70px] border-r border-gray-100 last:border-r-0 p-1 transition-colors group relative ${isWeekend ? 'bg-[#FAFAFA]' : ''} ${isEmpty ? 'cursor-pointer hover:bg-[#FFF9E6]' : ''}`}
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
                  )}

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
                              return (
                                <div key={i}
                                  onClick={() => { setSelectedDay(date.toISOString().split('T')[0]); setCalendarView('day') }}
                                  className={`min-h-[90px] p-1.5 border-r border-gray-100 last:border-r-0 cursor-pointer transition group
                                    ${!isCurrentMonth ? 'bg-gray-50/50' : isWeekend ? 'bg-[#FAFAFA]' : 'bg-white'}
                                    hover:bg-[#FFF9E6]`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full
                                      ${isToday ? 'bg-[#FFC107] text-white' : !isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}`}>
                                      {date.getDate()}
                                    </span>
                                    {dayBookings.length > 0 && isCurrentMonth && (
                                      <span className="text-xs text-gray-400 font-semibold">{dayBookings.length}</span>
                                    )}
                                  </div>
                                  <div className="space-y-0.5">
                                    {dayBookings.slice(0, 3).map((b) => {
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
                                    {dayBookings.length > 3 && (
                                      <div className="text-[10px] text-gray-400 font-semibold pl-2.5">+{dayBookings.length - 3} de plus</div>
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
                            {b.notes && <div className="text-xs text-gray-400 mt-1">{b.notes}</div>}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => updateBookingStatus(b.id, 'confirmed')} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition">✓ Accepter</button>
                            <button onClick={() => updateBookingStatus(b.id, 'cancelled')} className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold text-sm transition">✕ Refuser</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Modal Nouveau RDV */}
                {showNewRdv && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowNewRdv(false)}>
                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
                      <h2 className="text-xl font-bold mb-6">📅 Nouveau rendez-vous</h2>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold mb-1">Nom du client</label>
                          <input type="text" value={newRdv.client_name} onChange={(e) => setNewRdv({...newRdv, client_name: e.target.value})} placeholder="Ex: Marie Dupont" className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1">Motif *</label>
                          <select value={newRdv.service_id} onChange={(e) => setNewRdv({...newRdv, service_id: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none bg-white">
                            <option value="">Choisir un motif</option>
                            {services.filter(s => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} - {formatPrice(s.price_ttc)}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-semibold mb-1">Date *</label>
                            <input type="date" value={newRdv.date} onChange={(e) => setNewRdv({...newRdv, date: e.target.value})} min={new Date().toISOString().split('T')[0]} className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold mb-1">Heure *</label>
                            <input type="time" value={newRdv.time} onChange={(e) => setNewRdv({...newRdv, time: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1">Adresse</label>
                          <input type="text" value={newRdv.address} onChange={(e) => setNewRdv({...newRdv, address: e.target.value})} placeholder="Adresse d'intervention" className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1">Notes</label>
                          <textarea value={newRdv.notes} onChange={(e) => setNewRdv({...newRdv, notes: e.target.value})} rows={2} placeholder="Détails supplémentaires..." className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none resize-none" />
                        </div>
                        <div className="flex gap-3 pt-2">
                          <button onClick={createRdvManual} disabled={!newRdv.service_id || !newRdv.date || !newRdv.time} className="flex-1 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-lg font-semibold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                            Créer le RDV
                          </button>
                          <button onClick={() => setShowNewRdv(false)} className="px-6 py-3 bg-white text-gray-600 border-2 border-gray-200 rounded-lg font-semibold hover:bg-gray-50 transition">
                            Annuler
                          </button>
                        </div>
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
                        <button onClick={() => { setShowBookingDetail(false); setSelectedBooking(null) }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
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
                          <div className="w-full text-center text-gray-400 py-2 text-sm">Ce RDV est terminé</div>
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
                                  <span className="text-gray-400">à</span>
                                  <input type="time" value={avail.end_time?.substring(0, 5) || '17:00'}
                                    onChange={(e) => updateAvailabilityTime(day, 'end_time', e.target.value)}
                                    className="px-2 py-1 border-2 border-gray-200 rounded-lg text-sm focus:border-[#FFC107] focus:outline-none" />
                                  <span className="text-xs text-gray-400 ml-2">
                                    {dayServiceIds.length > 0 ? `${dayServiceIds.length} motif(s)` : 'Tous les motifs'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">Fermé</span>
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
                        <th className="text-left p-4 font-semibold text-sm">Prix HT</th>
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
                              <div className="text-xs text-gray-400 mt-1">{getCleanDescription(service)}</div>
                            )}
                          </td>
                          <td className="p-4">{Math.floor(service.duration_minutes / 60)}h{service.duration_minutes % 60 > 0 ? String(service.duration_minutes % 60).padStart(2, '0') : ''}</td>
                          <td className="p-4 font-bold">{formatPrice(service.price_ht)}</td>
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
                          <td colSpan={6} className="p-12 text-center text-gray-400">
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
                        <label className="block text-sm font-semibold mb-1">Durée estimée (minutes) *</label>
                        <div className="flex items-center gap-3">
                          <input type="number" value={motifForm.duration_minutes} onChange={(e) => setMotifForm({...motifForm, duration_minutes: parseInt(e.target.value) || 60})}
                            min={15} step={15}
                            className="w-32 p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none" />
                          <span className="text-gray-500 text-sm">= {Math.floor(motifForm.duration_minutes / 60)}h{motifForm.duration_minutes % 60 > 0 ? String(motifForm.duration_minutes % 60).padStart(2, '0') : '00'}</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2">Unité de tarification *</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'forfait', label: '💰 Forfait', desc: 'Prix fixe par prestation' },
                            { value: 'm2', label: '📐 Au m²', desc: 'Prix au mètre carré' },
                            { value: 'heure', label: '🕐 À l\'heure', desc: 'Prix horaire' },
                            { value: 'unite', label: '📦 À l\'unité', desc: 'Prix par pièce/unité' },
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
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold mb-1">
                            Prix HT (€) *
                            <span className="text-gray-400 font-normal ml-1">
                              {motifForm.pricing_unit === 'm2' ? '/m²' : motifForm.pricing_unit === 'heure' ? '/h' : motifForm.pricing_unit === 'unite' ? '/unité' : ''}
                            </span>
                          </label>
                          <input type="number" value={motifForm.price_ht}
                            onChange={(e) => {
                              const ht = parseFloat(e.target.value) || 0
                              setMotifForm({...motifForm, price_ht: ht, price_ttc: Math.round(ht * 1.2 * 100) / 100})
                            }}
                            step="0.01" min="0"
                            className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1">Prix TTC (€)</label>
                          <input type="number" value={motifForm.price_ttc}
                            onChange={(e) => setMotifForm({...motifForm, price_ttc: parseFloat(e.target.value) || 0})}
                            step="0.01" min="0"
                            className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none" />
                          <p className="text-xs text-gray-400 mt-1">TVA 20% calculée auto</p>
                        </div>
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

          {/* ────── MESSAGES ────── */}
          {activePage === 'messages' && (
            <div className="animate-fadeIn">
              <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-[#FFC107] flex justify-between items-center shadow-sm">
                <h1 className="text-2xl font-semibold">💬 Messages</h1>
                {pendingBookings.length > 0 && (
                  <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-sm font-semibold">{pendingBookings.length} demande(s) en attente</span>
                )}
              </div>
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
                            {b.notes && <div className="text-sm text-gray-400 mt-2 bg-gray-50 p-2 rounded">{b.notes}</div>}
                          </div>
                          <div className="flex gap-2 self-start">
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
                    <p className="text-gray-500 text-lg">Toutes les demandes ont été traitées</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ────── DEVIS ────── */}
          {activePage === 'devis' && (
            showDevisForm ? (
              <DevisFactureForm artisan={artisan} services={services} bookings={bookings} initialDocType="devis"
                initialData={convertingDevis}
                onBack={() => { setShowDevisForm(false); setConvertingDevis(null); const docs = JSON.parse(localStorage.getItem('fixit_documents') || '[]'); const drafts = JSON.parse(localStorage.getItem('fixit_drafts') || '[]'); setSavedDocuments([...docs, ...drafts]) }}
                onSave={() => { setConvertingDevis(null); const docs = JSON.parse(localStorage.getItem('fixit_documents') || '[]'); const drafts = JSON.parse(localStorage.getItem('fixit_drafts') || '[]'); setSavedDocuments([...docs, ...drafts]) }}
              />
            ) : (
              <div className="animate-fadeIn">
                <PageHeader title="📄 Devis" actionLabel="+ Nouveau devis" onAction={() => setShowDevisForm(true)} />
                <div className="p-6 lg:p-8">
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#2C3E50] text-white">
                          <th className="text-left p-4 font-semibold text-sm">Numéro</th>
                          <th className="text-left p-4 font-semibold text-sm">Client</th>
                          <th className="text-left p-4 font-semibold text-sm">Date</th>
                          <th className="text-left p-4 font-semibold text-sm">Montant</th>
                          <th className="text-left p-4 font-semibold text-sm">Statut</th>
                          <th className="text-left p-4 font-semibold text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {savedDocuments.filter(d => d.docType === 'devis').map((doc, i) => (
                          <tr key={`saved-dev-${i}`} className="border-b border-gray-100 hover:bg-gray-50 transition">
                            <td className="p-4 font-bold">{doc.docNumber}</td>
                            <td className="p-4">{doc.clientName || '-'}</td>
                            <td className="p-4">{doc.docDate ? new Date(doc.docDate).toLocaleDateString('fr-FR') : '-'}</td>
                            <td className="p-4 font-bold">{doc.lines?.reduce((s: number, l: any) => s + (l.totalHT || 0), 0).toFixed(2)} €</td>
                            <td className="p-4">
                              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${doc.status === 'envoye' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-orange-700'}`}>
                                {doc.status === 'envoye' ? 'Envoyé' : 'Brouillon'}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex gap-2">
                                <button className="bg-white text-gray-600 border-2 border-gray-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-gray-50 transition text-sm">👁️ Voir</button>
                                <button onClick={() => convertDevisToFacture(doc)} className="bg-[#FFC107] text-gray-900 px-3 py-1.5 rounded-lg font-semibold hover:bg-[#FFD54F] shadow-sm transition text-sm">🧾 Convertir en facture</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {savedDocuments.filter(d => d.docType === 'devis').length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-12 text-center text-gray-400">
                              <div className="text-4xl mb-3">📄</div>
                              <p className="font-semibold text-lg mb-2">Aucun devis</p>
                              <p className="text-sm mb-4">Créez votre premier devis conforme aux normes françaises</p>
                              <button onClick={() => setShowDevisForm(true)} className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2 rounded-lg font-semibold text-sm transition">
                                + Créer un devis
                              </button>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
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
                onBack={() => { setShowFactureForm(false); setConvertingDevis(null); const docs = JSON.parse(localStorage.getItem('fixit_documents') || '[]'); const drafts = JSON.parse(localStorage.getItem('fixit_drafts') || '[]'); setSavedDocuments([...docs, ...drafts]) }}
                onSave={() => { setConvertingDevis(null); const docs = JSON.parse(localStorage.getItem('fixit_documents') || '[]'); const drafts = JSON.parse(localStorage.getItem('fixit_drafts') || '[]'); setSavedDocuments([...docs, ...drafts]) }}
              />
            ) : (
              <div className="animate-fadeIn">
                <PageHeader title="🧾 Factures" actionLabel="+ Nouvelle facture" onAction={() => setShowFactureForm(true)} />
                <div className="p-6 lg:p-8">
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#2C3E50] text-white">
                          <th className="text-left p-4 font-semibold text-sm">Numéro</th>
                          <th className="text-left p-4 font-semibold text-sm">Client</th>
                          <th className="text-left p-4 font-semibold text-sm">Date émission</th>
                          <th className="text-left p-4 font-semibold text-sm">Échéance</th>
                          <th className="text-left p-4 font-semibold text-sm">Montant</th>
                          <th className="text-left p-4 font-semibold text-sm">Statut</th>
                          <th className="text-left p-4 font-semibold text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {savedDocuments.filter(d => d.docType === 'facture').map((doc, i) => (
                          <tr key={`saved-fact-${i}`} className="border-b border-gray-100 hover:bg-gray-50 transition">
                            <td className="p-4 font-bold">{doc.docNumber}</td>
                            <td className="p-4">{doc.clientName || '-'}</td>
                            <td className="p-4">{doc.docDate ? new Date(doc.docDate).toLocaleDateString('fr-FR') : '-'}</td>
                            <td className="p-4">{doc.paymentDue ? new Date(doc.paymentDue).toLocaleDateString('fr-FR') : '-'}</td>
                            <td className="p-4 font-bold">{doc.lines?.reduce((s: number, l: any) => s + (l.totalHT || 0), 0).toFixed(2)} €</td>
                            <td className="p-4">
                              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${doc.status === 'envoye' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-orange-700'}`}>
                                {doc.status === 'envoye' ? 'Envoyée' : 'Brouillon'}
                              </span>
                            </td>
                            <td className="p-4">
                              <button className="bg-white text-gray-600 border-2 border-gray-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-gray-50 transition text-sm">📥 PDF</button>
                            </td>
                          </tr>
                        ))}
                        {savedDocuments.filter(d => d.docType === 'facture').length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-12 text-center text-gray-400">
                              <div className="text-4xl mb-3">🧾</div>
                              <p className="font-semibold text-lg mb-2">Aucune facture</p>
                              <p className="text-sm mb-4">Créez votre première facture conforme</p>
                              <button onClick={() => setShowFactureForm(true)} className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2 rounded-lg font-semibold text-sm transition">
                                + Créer une facture
                              </button>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
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
                    <p className="text-gray-400">Aucun revenu enregistré</p>
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
              <div className="p-6 lg:p-8">
                <div className="bg-white p-8 lg:p-10 rounded-2xl shadow-sm max-w-2xl">
                  <h3 className="text-xl font-bold mb-6">Profil professionnel</h3>

                  {/* Message upload */}
                  {uploadMsg && (
                    <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
                      uploadMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {uploadMsg.text}
                      <button onClick={() => setUploadMsg(null)} className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
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
                            <span className="text-3xl font-bold text-gray-400">{initials}</span>
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
                          <p className="text-xs text-gray-400 mt-1">JPG, PNG ou WEBP — max 10 Mo</p>
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
                        <input type="text" readOnly value={`https://fixit-production.vercel.app/artisan/${artisan?.id || ''}`}
                          className="w-full p-3 border-2 border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600" />
                        <button onClick={() => { navigator.clipboard.writeText(`https://fixit-production.vercel.app/artisan/${artisan?.id || ''}`); alert('Lien copié !') }}
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

                {/* Documents professionnels */}
                <div className="bg-white p-8 lg:p-10 rounded-2xl shadow-sm max-w-2xl mt-6">
                  <h3 className="text-xl font-bold mb-2">📁 Documents professionnels</h3>
                  <p className="text-sm text-gray-500 mb-6">Mettez à jour votre Kbis et votre attestation d&apos;assurance.</p>

                  <div className="space-y-6">
                    {/* Upload Kbis */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-sm">Extrait Kbis</div>
                          <p className="text-xs text-gray-500 mt-0.5">À mettre à jour si vous changez de statut juridique</p>
                        </div>
                        {(artisan as any)?.kbis_url && (
                          <a href={(artisan as any).kbis_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            👁️ Voir actuel
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition flex-1">
                          📄 {kbisFile ? kbisFile.name : 'Choisir un fichier'}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setKbisFile(e.target.files?.[0] || null)} />
                        </label>
                        {kbisFile && (
                          <button
                            onClick={() => { uploadDocument(kbisFile, 'kbis', 'kbis_url', setKbisUploading); setKbisFile(null) }}
                            disabled={kbisUploading}
                            className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 whitespace-nowrap"
                          >
                            {kbisUploading ? '⏳...' : '⬆️ Envoyer'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Upload Assurance */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-sm">Attestation d&apos;assurance</div>
                          <p className="text-xs text-gray-500 mt-0.5">RC Pro, décennale — à renouveler chaque année</p>
                        </div>
                        {(artisan as any)?.insurance_url && (
                          <a href={(artisan as any).insurance_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            👁️ Voir actuel
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition flex-1">
                          📄 {insuranceFile ? insuranceFile.name : 'Choisir un fichier'}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setInsuranceFile(e.target.files?.[0] || null)} />
                        </label>
                        {insuranceFile && (
                          <button
                            onClick={() => { uploadDocument(insuranceFile, 'insurance', 'insurance_url', setInsuranceUploading); setInsuranceFile(null) }}
                            disabled={insuranceUploading}
                            className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 whitespace-nowrap"
                          >
                            {insuranceUploading ? '⏳...' : '⬆️ Envoyer'}
                          </button>
                        )}
                      </div>
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
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="font-semibold mb-3">Plages d&apos;ouverture</div>
                      <p className="text-sm text-gray-500 mb-3">Gérez vos horaires dans l&apos;onglet Horaires</p>
                      <button onClick={() => navigateTo('horaires')} className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition-all">
                        🕐 Ouvrir les horaires
                      </button>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="font-semibold mb-3">Motifs de consultation</div>
                      <p className="text-sm text-gray-500 mb-3">{services.filter(s => s.active).length} motifs actifs sur {services.length}</p>
                      <button onClick={() => navigateTo('motifs')} className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition-all">
                        🔧 Gérer les motifs
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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

          {/* ────── BASE CLIENTS ────── */}
          {activePage === 'clients' && (
            <ClientsSection
              artisan={artisan}
              bookings={bookings}
              services={services}
              onNewRdv={(clientName: string) => {
                setNewRdv({ client_name: clientName, service_id: '', date: '', time: '', address: '', notes: '' })
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

          {/* ────── AIDE ────── */}
          {activePage === 'help' && (
            <div className="animate-fadeIn">
              <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-[#FFC107] shadow-sm">
                <h1 className="text-2xl font-semibold">❓ Centre d&apos;aide</h1>
              </div>
              <div className="p-6 lg:p-8 max-w-3xl mx-auto">
                <div className="bg-white p-8 rounded-2xl shadow-sm mb-6">
                  <h2 className="text-xl font-bold mb-4">🚀 Démarrage rapide</h2>
                  <p className="text-gray-500 mb-4 text-lg">Bienvenue sur Fixit Pro ! Voici comment commencer :</p>
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
            // Passer les données du chatbot au formulaire via convertingDevis
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
        />
      )}
    </div>
  )
}

/* ══════════ COMPTABILITÉ SECTION ══════════ */

function ComptabiliteSection({ bookings, artisan, services }: { bookings: any[]; artisan: any; services: any[] }) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedPeriod, setSelectedPeriod] = useState<'mois' | 'trimestre' | 'annee'>('mois')
  const [selectedMonth, setSelectedMonthC] = useState(currentMonth)
  const [expenses, setExpenses] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(`fixit_expenses_${artisan?.id}`) || '[]') } catch { return [] }
  })
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ label: '', amount: '', category: 'materiel', date: new Date().toISOString().split('T')[0], notes: '' })
  const [activeComptaTab, setActiveComptaTab] = useState<'dashboard' | 'revenus' | 'depenses' | 'declaration' | 'assistant'>('dashboard')

  const MONTH_NAMES = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']
  const MONTH_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const EXPENSE_CATEGORIES = [
    { key: 'materiel', label: 'Matériaux & fournitures chantier', icon: '🔧' },
    { key: 'mainoeuvre', label: 'Main d\'œuvre & sous-traitance', icon: '👷' },
    { key: 'transport', label: 'Transport & carburant', icon: '🚗' },
    { key: 'outillage', label: 'Outillage & machines', icon: '🛠️' },
    { key: 'assurance', label: 'Assurance (RC Pro, décennale…)', icon: '🛡️' },
    { key: 'formation', label: 'Formation & certifications', icon: '📚' },
    { key: 'logiciel', label: 'Logiciels & abonnements', icon: '💻' },
    { key: 'telephone', label: 'Téléphone & internet', icon: '📱' },
    { key: 'comptable', label: 'Expert-comptable & juridique', icon: '🧮' },
    { key: 'publicite', label: 'Publicité & marketing', icon: '📣' },
    { key: 'bureau', label: 'Frais de bureau', icon: '🏢' },
    { key: 'autre', label: 'Autres charges', icon: '📦' },
  ]

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const getBookingsForPeriod = (year: number, month?: number, quarter?: number) => {
    return bookings.filter(b => {
      if (!b.booking_date) return false
      const d = new Date(b.booking_date)
      if (d.getFullYear() !== year) return false
      if (selectedPeriod === 'mois' && month !== undefined) return d.getMonth() === month
      if (selectedPeriod === 'trimestre' && quarter !== undefined) return Math.floor(d.getMonth() / 3) === quarter
      return true
    })
  }

  const getQuarter = () => Math.floor(selectedMonth / 3)

  const filteredBookings = selectedPeriod === 'mois'
    ? getBookingsForPeriod(selectedYear, selectedMonth)
    : selectedPeriod === 'trimestre'
    ? getBookingsForPeriod(selectedYear, undefined, getQuarter())
    : getBookingsForPeriod(selectedYear)

  const completedFiltered = filteredBookings.filter(b => b.status === 'completed')
  const chiffreAffaires = completedFiltered.reduce((s, b) => s + (b.price_ttc || 0), 0)
  const chiffreAffairesHT = completedFiltered.reduce((s, b) => s + (b.price_ht || (b.price_ttc || 0) / 1.2), 0)
  const tvaCollectee = chiffreAffaires - chiffreAffairesHT

  const filteredExpenses = expenses.filter(e => {
    const d = new Date(e.date)
    if (d.getFullYear() !== selectedYear) return false
    if (selectedPeriod === 'mois') return d.getMonth() === selectedMonth
    if (selectedPeriod === 'trimestre') return Math.floor(d.getMonth() / 3) === getQuarter()
    return true
  })

  const totalExpenses = filteredExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  const resultatNet = chiffreAffairesHT - totalExpenses

  // Monthly revenue for chart
  const monthlyRevenue = Array.from({ length: 12 }, (_, m) => {
    const mb = bookings.filter(b => {
      if (!b.booking_date || b.status !== 'completed') return false
      const d = new Date(b.booking_date)
      return d.getFullYear() === selectedYear && d.getMonth() === m
    })
    return { month: MONTH_NAMES[m], ca: mb.reduce((s, b) => s + (b.price_ttc || 0), 0) }
  })

  const maxCA = Math.max(...monthlyRevenue.map(m => m.ca), 1)

  // Expense breakdown by category
  const expenseByCategory = EXPENSE_CATEGORIES.map(cat => ({
    ...cat,
    total: expenses.filter(e => e.category === cat.key && new Date(e.date).getFullYear() === selectedYear)
      .reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  const saveExpense = () => {
    if (!expenseForm.label || !expenseForm.amount) return
    const newExpense = { ...expenseForm, id: Date.now().toString(), amount: parseFloat(expenseForm.amount) }
    const updated = [...expenses, newExpense]
    setExpenses(updated)
    localStorage.setItem(`fixit_expenses_${artisan?.id}`, JSON.stringify(updated))
    setShowAddExpense(false)
    setExpenseForm({ label: '', amount: '', category: 'materiel', date: new Date().toISOString().split('T')[0], notes: '' })
  }

  const deleteExpense = (id: string) => {
    const updated = expenses.filter(e => e.id !== id)
    setExpenses(updated)
    localStorage.setItem(`fixit_expenses_${artisan?.id}`, JSON.stringify(updated))
  }

  // Declaration data
  const quarterLabels = ['T1 (Jan-Mars)', 'T2 (Avr-Juin)', 'T3 (Juil-Sept)', 'T4 (Oct-Déc)']
  const quarterData = [0, 1, 2, 3].map(q => {
    const qb = bookings.filter(b => {
      if (!b.booking_date || b.status !== 'completed') return false
      const d = new Date(b.booking_date)
      return d.getFullYear() === selectedYear && Math.floor(d.getMonth() / 3) === q
    })
    return qb.reduce((s, b) => s + (b.price_ht || (b.price_ttc || 0) / 1.2), 0)
  })

  const annualHT = quarterData.reduce((s, v) => s + v, 0)
  const isAutoEntrepreneur = annualHT < 77700 // plafond micro-entreprise artisans 2024
  const tauxCotisation = 0.217 // 21.7% pour artisans
  const cotisationsSociales = annualHT * tauxCotisation
  const impotRevenu = annualHT * 0.011 // 1.1% prélèvement libératoire optionnel artisans
  const resultatApresCharges = annualHT - cotisationsSociales

  const formatEur = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-[#FFC107] flex justify-between items-center shadow-sm">
        <h1 className="text-2xl font-semibold">🧮 Comptabilité & Fiscalité</h1>
        <div className="flex items-center gap-3">
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-[#FFC107]">
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex bg-gray-100 rounded-lg overflow-hidden">
            {(['mois', 'trimestre', 'annee'] as const).map(p => (
              <button key={p} onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold transition ${selectedPeriod === p ? 'bg-[#FFC107] text-gray-900' : 'text-gray-500 hover:bg-gray-200'}`}>
                {p === 'mois' ? 'Mois' : p === 'trimestre' ? 'Trimestre' : 'Année'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">

        {/* Period selector */}
        {selectedPeriod === 'mois' && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {MONTH_NAMES.map((m, i) => (
              <button key={i} onClick={() => setSelectedMonthC(i)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${selectedMonth === i ? 'bg-[#FFC107] text-gray-900' : 'bg-white border border-gray-200 text-gray-500 hover:border-[#FFC107]'}`}>
                {m}
              </button>
            ))}
          </div>
        )}
        {selectedPeriod === 'trimestre' && (
          <div className="flex gap-2 mb-6">
            {[0, 1, 2, 3].map(q => (
              <button key={q} onClick={() => setSelectedMonthC(q * 3)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${getQuarter() === q ? 'bg-[#FFC107] text-gray-900' : 'bg-white border border-gray-200 text-gray-500 hover:border-[#FFC107]'}`}>
                {quarterLabels[q]}
              </button>
            ))}
          </div>
        )}

        {/* Sub-tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          {([
            { key: 'dashboard', label: '📊 Tableau de bord' },
            { key: 'revenus', label: '💰 Revenus' },
            { key: 'depenses', label: '🧾 Dépenses' },
            { key: 'declaration', label: '🏛️ Déclaration' },
            { key: 'assistant', label: '🤖 Assistant IA' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveComptaTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${activeComptaTab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── DASHBOARD TAB ── */}
        {activeComptaTab === 'dashboard' && (
          <div>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-green-400">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Chiffre d&apos;affaires TTC</div>
                <div className="text-3xl font-black text-green-600">{formatEur(chiffreAffaires)}</div>
                <div className="text-xs text-gray-400 mt-1">{completedFiltered.length} intervention(s)</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-blue-400">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">CA Hors Taxes</div>
                <div className="text-3xl font-black text-blue-600">{formatEur(chiffreAffairesHT)}</div>
                <div className="text-xs text-gray-400 mt-1">TVA : {formatEur(tvaCollectee)}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-red-400">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Charges déductibles</div>
                <div className="text-3xl font-black text-red-500">{formatEur(totalExpenses)}</div>
                <div className="text-xs text-gray-400 mt-1">{filteredExpenses.length} dépense(s)</div>
              </div>
              <div className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${resultatNet >= 0 ? 'border-[#FFC107]' : 'border-red-500'}`}>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Résultat net</div>
                <div className={`text-3xl font-black ${resultatNet >= 0 ? 'text-gray-900' : 'text-red-500'}`}>{formatEur(resultatNet)}</div>
                <div className="text-xs text-gray-400 mt-1">avant impôts</div>
              </div>
            </div>

            {/* Revenue chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm mb-6">
              <h3 className="font-bold text-lg mb-5">📈 Évolution du CA mensuel {selectedYear}</h3>
              <div className="flex items-end gap-2 h-40">
                {monthlyRevenue.map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[9px] text-gray-400 font-semibold">
                      {m.ca > 0 ? formatEur(m.ca).replace('€', '') + '€' : ''}
                    </div>
                    <div
                      className={`w-full rounded-t-lg transition-all ${i === currentMonth && selectedYear === currentYear ? 'bg-[#FFC107]' : 'bg-blue-100'}`}
                      style={{ height: `${Math.max(4, (m.ca / maxCA) * 100)}%` }}
                    />
                    <div className="text-[9px] text-gray-400">{m.month}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Health indicator */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 p-5 rounded-2xl">
                <div className="font-bold text-green-800 mb-2">✅ Statut fiscal</div>
                <div className="text-sm text-green-700">
                  {isAutoEntrepreneur ? 'Micro-entrepreneur' : 'Dépassement plafond !'}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  CA annuel : {formatEur(bookings.filter(b => b.status === 'completed' && new Date(b.booking_date).getFullYear() === selectedYear).reduce((s, b) => s + (b.price_ht || 0), 0))}
                  {' / '}77 700 €
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl">
                <div className="font-bold text-blue-800 mb-2">💳 Cotisations estimées</div>
                <div className="text-2xl font-black text-blue-700">{formatEur(cotisationsSociales)}</div>
                <div className="text-xs text-blue-600 mt-1">21,7% du CA HT annuel</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl">
                <div className="font-bold text-amber-800 mb-2">📋 Prochaine déclaration</div>
                <div className="text-sm text-amber-700 font-semibold">
                  {(() => {
                    const q = Math.floor(currentMonth / 3)
                    const dates = ['30 Avril', '31 Juillet', '31 Oct', '31 Jan']
                    return dates[q] || 'Voir calendrier'
                  })()}
                </div>
                <div className="text-xs text-amber-600 mt-1">Déclaration URSSAF trimestrielle</div>
              </div>
            </div>
          </div>
        )}

        {/* ── REVENUS TAB ── */}
        {activeComptaTab === 'revenus' && (
          <div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-bold text-lg">
                  💰 Revenus — {selectedPeriod === 'mois' ? MONTH_FULL[selectedMonth] : selectedPeriod === 'trimestre' ? quarterLabels[getQuarter()] : selectedYear}
                </h3>
                <div className="flex gap-6 mt-3">
                  <div><span className="text-2xl font-black text-green-600">{formatEur(chiffreAffaires)}</span><span className="text-xs text-gray-400 ml-1">TTC</span></div>
                  <div><span className="text-2xl font-black text-blue-500">{formatEur(chiffreAffairesHT)}</span><span className="text-xs text-gray-400 ml-1">HT</span></div>
                  <div><span className="text-2xl font-black text-gray-500">{formatEur(tvaCollectee)}</span><span className="text-xs text-gray-400 ml-1">TVA 20%</span></div>
                </div>
              </div>
              {completedFiltered.length === 0 ? (
                <div className="p-10 text-center text-gray-400">Aucune intervention terminée sur cette période</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-semibold">Date</th>
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-semibold">Client / Service</th>
                      <th className="text-right px-5 py-3 text-xs text-gray-500 font-semibold">HT</th>
                      <th className="text-right px-5 py-3 text-xs text-gray-500 font-semibold">TVA</th>
                      <th className="text-right px-5 py-3 text-xs text-gray-500 font-semibold">TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedFiltered.sort((a, b) => b.booking_date.localeCompare(a.booking_date)).map(b => {
                      const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'
                      const ht = b.price_ht || (b.price_ttc || 0) / 1.2
                      const tva = (b.price_ttc || 0) - ht
                      return (
                        <tr key={b.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-5 py-3 text-gray-500">{new Date(b.booking_date).toLocaleDateString('fr-FR')}</td>
                          <td className="px-5 py-3">
                            <div className="font-medium">{clientName}</div>
                            <div className="text-xs text-gray-400">{b.services?.name}</div>
                          </td>
                          <td className="px-5 py-3 text-right font-semibold">{formatEur(ht)}</td>
                          <td className="px-5 py-3 text-right text-gray-400">{formatEur(tva)}</td>
                          <td className="px-5 py-3 text-right font-bold text-green-600">{formatEur(b.price_ttc || 0)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={2} className="px-5 py-3 font-bold">TOTAL</td>
                      <td className="px-5 py-3 text-right font-bold">{formatEur(chiffreAffairesHT)}</td>
                      <td className="px-5 py-3 text-right font-bold text-gray-500">{formatEur(tvaCollectee)}</td>
                      <td className="px-5 py-3 text-right font-bold text-green-600">{formatEur(chiffreAffaires)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Revenue by service */}
            {services.length > 0 && (
              <div className="bg-white p-6 rounded-2xl shadow-sm">
                <h3 className="font-bold mb-4">🔧 CA par motif ({selectedYear})</h3>
                <div className="space-y-3">
                  {services.map(s => {
                    const sBookings = bookings.filter(b => b.service_id === s.id && b.status === 'completed' && new Date(b.booking_date).getFullYear() === selectedYear)
                    const sCA = sBookings.reduce((sum, b) => sum + (b.price_ttc || 0), 0)
                    const pct = maxCA > 0 ? (sCA / (chiffreAffaires || 1)) * 100 : 0
                    return (
                      <div key={s.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{s.name}</span>
                          <span className="font-bold text-green-600">{formatEur(sCA)} ({sBookings.length} RDV)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#FFC107] to-[#FFD54F] rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DÉPENSES TAB ── */}
        {activeComptaTab === 'depenses' && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="font-bold text-lg">🧾 Charges déductibles</h3>
                <p className="text-sm text-gray-500">Total : <span className="font-bold text-red-500">{formatEur(totalExpenses)}</span></p>
              </div>
              <button onClick={() => setShowAddExpense(true)}
                className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2.5 rounded-xl font-semibold shadow-sm text-sm transition-all">
                + Ajouter une charge
              </button>
            </div>

            {showAddExpense && (
              <div className="bg-white border-2 border-[#FFC107] p-6 rounded-2xl mb-5">
                <h4 className="font-bold mb-4">Nouvelle charge déductible</h4>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Libellé *</label>
                    <input value={expenseForm.label} onChange={e => setExpenseForm(p => ({ ...p, label: e.target.value }))}
                      placeholder="Ex: Achat vis et boulons" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Montant TTC (€) *</label>
                    <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="0.00" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Catégorie</label>
                    <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]">
                      {EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Date</label>
                    <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Notes (optionnel)</label>
                    <input value={expenseForm.notes} onChange={e => setExpenseForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Numéro de facture, fournisseur..." className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowAddExpense(false)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-semibold">Annuler</button>
                  <button onClick={saveExpense} disabled={!expenseForm.label || !expenseForm.amount}
                    className="flex-1 bg-[#FFC107] text-gray-900 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">Enregistrer</button>
                </div>
              </div>
            )}

            {/* Breakdown by category */}
            {expenseByCategory.length > 0 && (
              <div className="bg-white p-5 rounded-2xl shadow-sm mb-5">
                <h4 className="font-semibold mb-4">Répartition par catégorie</h4>
                <div className="space-y-3">
                  {expenseByCategory.map(c => (
                    <div key={c.key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{c.icon} {c.label}</span>
                        <span className="font-bold text-red-500">{formatEur(c.total)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${(c.total / (totalExpenses || 1)) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expenses list */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 font-semibold text-sm text-gray-700">
                Liste des charges ({filteredExpenses.length})
              </div>
              {filteredExpenses.length === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  <div className="text-4xl mb-3">🧾</div>
                  <div>Aucune charge enregistrée sur cette période</div>
                  <button onClick={() => setShowAddExpense(true)} className="mt-3 text-[#FFC107] font-semibold text-sm">+ Ajouter une charge</button>
                </div>
              ) : (
                <div>
                  {filteredExpenses.sort((a, b) => b.date.localeCompare(a.date)).map(e => {
                    const cat = EXPENSE_CATEGORIES.find(c => c.key === e.category)
                    return (
                      <div key={e.id} className="flex items-center gap-4 px-5 py-4 border-t border-gray-100 hover:bg-gray-50 group">
                        <div className="text-2xl">{cat?.icon || '📦'}</div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{e.label}</div>
                          <div className="text-xs text-gray-400">{cat?.label} · {new Date(e.date).toLocaleDateString('fr-FR')}</div>
                          {e.notes && <div className="text-xs text-gray-400 italic">{e.notes}</div>}
                        </div>
                        <div className="font-bold text-red-500">{formatEur(parseFloat(e.amount))}</div>
                        <button onClick={() => deleteExpense(e.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition ml-2 text-lg">🗑</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DÉCLARATION TAB ── */}
        {activeComptaTab === 'declaration' && (
          <div className="space-y-6">
            {/* Status badge */}
            <div className={`p-5 rounded-2xl border-2 flex items-start gap-4 ${isAutoEntrepreneur ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
              <div className="text-3xl">{isAutoEntrepreneur ? '✅' : '⚠️'}</div>
              <div>
                <div className={`font-bold text-lg ${isAutoEntrepreneur ? 'text-green-800' : 'text-red-700'}`}>
                  {isAutoEntrepreneur ? 'Régime Micro-Entrepreneur (Auto-entrepreneur)' : '⚠️ Attention : Dépassement de plafond possible'}
                </div>
                <div className={`text-sm mt-1 ${isAutoEntrepreneur ? 'text-green-700' : 'text-red-600'}`}>
                  {isAutoEntrepreneur
                    ? `CA HT annuel estimé : ${formatEur(annualHT)} sur ${formatEur(77700)} de plafond autorisé`
                    : `Votre CA dépasse le seuil de 77 700 €. Consultez un expert-comptable pour le passage en régime réel.`}
                </div>
              </div>
            </div>

            {/* Quarterly declaration */}
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-lg mb-5">📋 Déclarations URSSAF trimestrielles {selectedYear}</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {quarterData.map((ca, q) => {
                  const deadline = ['30 avril', '31 juillet', '31 octobre', '31 janvier'][q]
                  const cotis = ca * tauxCotisation
                  const isPast = (q < Math.floor(currentMonth / 3)) && selectedYear <= currentYear
                  return (
                    <div key={q} className={`p-5 rounded-xl border-2 ${isPast ? 'border-gray-200 bg-gray-50' : 'border-[#FFC107] bg-amber-50'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-bold text-gray-900">{quarterLabels[q]}</div>
                        {isPast && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Passé</span>}
                        {!isPast && <span className="text-xs bg-[#FFC107] text-gray-900 px-2 py-0.5 rounded-full font-semibold">À déclarer</span>}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">CA HT réalisé</span>
                          <span className="font-bold">{formatEur(ca)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Cotisations (21,7%)</span>
                          <span className="font-bold text-red-500">{formatEur(cotis)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-bold">
                          <span>À payer</span>
                          <span className="text-red-600">{formatEur(cotis)}</span>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-gray-400">⏰ Délai : {deadline}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Annual summary */}
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-lg mb-5">📊 Récapitulatif annuel {selectedYear}</h3>
              <div className="space-y-3">
                {[
                  { label: 'Chiffre d\'affaires TTC', value: chiffreAffaires + (bookings.filter(b => b.status === 'completed' && new Date(b.booking_date).getFullYear() === selectedYear && filteredBookings.indexOf(b) === -1).reduce((s, b) => s + (b.price_ttc || 0), 0)), color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'CA Hors Taxes (déclarable)', value: annualHT, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Cotisations sociales URSSAF (21,7%)', value: -cotisationsSociales, color: 'text-red-600', bg: 'bg-red-50' },
                  { label: 'Prélèvement libératoire IR (1,1%)', value: -impotRevenu, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'Résultat net estimé', value: resultatApresCharges - impotRevenu, color: 'text-gray-900', bg: 'bg-gray-50', bold: true },
                ].map((row, i) => (
                  <div key={i} className={`flex justify-between items-center px-4 py-3 rounded-xl ${row.bg}`}>
                    <span className={`text-sm ${row.bold ? 'font-bold' : 'font-medium'} text-gray-700`}>{row.label}</span>
                    <span className={`font-bold ${row.color} ${row.bold ? 'text-lg' : ''}`}>
                      {row.value < 0 ? `- ${formatEur(Math.abs(row.value))}` : formatEur(row.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action links */}
            <div className="grid sm:grid-cols-3 gap-4">
              <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" rel="noopener noreferrer"
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:-translate-y-1 transition-transform cursor-pointer text-center">
                <div className="text-3xl mb-2">🏛️</div>
                <div className="font-semibold text-sm">URSSAF</div>
                <div className="text-xs text-gray-400">Déclarer votre CA</div>
              </a>
              <a href="https://www.impots.gouv.fr" target="_blank" rel="noopener noreferrer"
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:-translate-y-1 transition-transform cursor-pointer text-center">
                <div className="text-3xl mb-2">📋</div>
                <div className="font-semibold text-sm">impots.gouv.fr</div>
                <div className="text-xs text-gray-400">Déclaration de revenus</div>
              </a>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:-translate-y-1 transition-transform cursor-pointer text-center">
                <div className="text-3xl mb-2">📥</div>
                <div className="font-semibold text-sm">Exporter données</div>
                <div className="text-xs text-gray-400">CSV pour votre comptable</div>
                <button onClick={() => {
                  const rows = [
                    ['Date', 'Client', 'Service', 'HT', 'TVA', 'TTC', 'Statut'],
                    ...bookings.filter(b => new Date(b.booking_date).getFullYear() === selectedYear && b.status === 'completed').map(b => {
                      const client = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'
                      const ht = (b.price_ht || (b.price_ttc || 0) / 1.2).toFixed(2)
                      const tva = ((b.price_ttc || 0) - parseFloat(ht)).toFixed(2)
                      return [b.booking_date, client, b.services?.name || '', ht, tva, (b.price_ttc || 0).toFixed(2), b.status]
                    })
                  ]
                  const csv = rows.map(r => r.join(';')).join('\n')
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url; a.download = `fixit-revenus-${selectedYear}.csv`; a.click()
                  URL.revokeObjectURL(url)
                }} className="mt-2 text-xs text-[#FFC107] font-semibold block">Télécharger CSV →</button>
              </div>
            </div>
          </div>
        )}

        {/* ── AGENT COMPTABLE LÉAU ── */}
        {activeComptaTab === 'assistant' && (
          <AgentComptable
            bookings={bookings}
            artisan={artisan}
            services={services}
            expenses={expenses}
            annualHT={annualHT}
            annualCA={bookings.filter(b => b.status === 'completed' && new Date(b.booking_date).getFullYear() === currentYear).reduce((s, b) => s + (b.price_ttc || 0), 0)}
            totalExpenses={expenses.filter(e => new Date(e.date).getFullYear() === currentYear).reduce((s, e) => s + parseFloat(e.amount || 0), 0)}
            quarterData={quarterData}
            currentMonth={currentMonth}
            currentYear={currentYear}
            formatEur={formatEur}
          />
        )}

      </div>
    </div>
  )
}

/* ══════════ AGENT COMPTABLE LÉA ══════════ */

function AgentComptable({ bookings, artisan, services, expenses, annualHT, annualCA, totalExpenses, quarterData, currentMonth, currentYear, formatEur }: {
  bookings: any[]; artisan: any; services: any[]; expenses: any[]; annualHT: number; annualCA: number; totalExpenses: number; quarterData: number[]; currentMonth: number; currentYear: number; formatEur: (v: number) => string
}) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [chatStarted, setChatStarted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const expenseCategories = expenses.reduce((acc: any, e: any) => {
    acc[e.category] = (acc[e.category] || 0) + parseFloat(e.amount || 0)
    return acc
  }, {})

  // ── Enrichir chaque booking avec clientName et serviceName déjà résolus
  const allBookingsEnriched = bookings.map((b: any) => ({
    ...b,
    clientName: b.notes?.match(/Client:\s*([^|.\n]+)/)?.[1]?.trim() || 'Client',
    serviceName: b.services?.name || services.find((s: any) => s.id === b.service_id)?.name || 'Intervention',
  }))

  const financialContext = {
    // Agrégats (référence rapide)
    annualCA,
    annualCAHT: annualHT,
    completedCount: bookings.filter(b => b.status === 'completed' && new Date(b.booking_date).getFullYear() === currentYear).length,
    tvaCollectee: annualCA - annualHT,
    avgMonthlyCA: annualCA / (currentMonth + 1),
    totalExpenses,
    expenseCategories,
    quarterData,
    // ── DONNÉES BRUTES COMPLÈTES (pour calculs sur période)
    allBookings: allBookingsEnriched,   // Toutes les interventions avec client + service résolus
    allExpenses: expenses,              // Toutes les dépenses avec date, catégorie, montant, notes
  }

  const QUICK_QUESTIONS = [
    { label: '🔧 Matériaux vs main d\'œuvre', q: 'Donne-moi le total dépensé en matériaux et en main d\'œuvre séparément depuis le début de l\'année, avec le détail ligne par ligne.' },
    { label: '💳 Cotisations URSSAF', q: 'Combien vais-je payer à l\'URSSAF ce trimestre et sur l\'année entière ? Détaille par trimestre.' },
    { label: '📊 Bénéfice net réel', q: 'Quel est mon bénéfice net réel après toutes les charges, cotisations URSSAF et impôt ? Fais le calcul complet.' },
    { label: '📅 Analyse du mois', q: `Analyse mes revenus et dépenses du mois dernier : combien j'ai encaissé, dépensé, et quel est mon résultat net ?` },
    { label: '⚠️ Plafond micro', q: 'Suis-je proche du plafond micro-entrepreneur ? À quel rythme je l\'atteindrai ?' },
    { label: '🚗 Frais de déplacement', q: 'Combien j\'ai dépensé en transport et déplacements ? Y a-t-il des frais kilométriques à optimiser ?' },
    { label: '🏗️ Charges déductibles BTP', q: 'Quelles sont toutes les charges déductibles spécifiques au BTP que je peux enregistrer ?' },
    { label: '📋 Préparer ma déclaration', q: 'Prépare un récapitulatif complet de mes données pour ma prochaine déclaration URSSAF.' },
  ]

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return
    setChatStarted(true)
    const userMsg = { role: 'user' as const, content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/comptable-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          financialContext,
          conversationHistory: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const responseText = data.response || 'Je n\'ai pas pu générer une réponse. Veuillez réessayer.'
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Erreur de connexion. Vérifiez votre connexion internet et réessayez.' }])
    }
    setIsLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const formatMessage = (text: string) => {
    return text
      // gras
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // code inline
      .replace(/`([^`]+)`/g, '<code class="bg-gray-200 rounded px-1 text-xs font-mono">$1</code>')
      // lignes tiret → liste
      .replace(/(^|\n)(- .+)/g, (_, pre, item) =>
        `${pre}<span class="flex gap-1.5 mt-0.5"><span class="text-[#FFC107] font-bold mt-px">›</span><span>${item.slice(2)}</span></span>`
      )
      // saut de ligne
      .replace(/\n/g, '<br/>')
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header Léa */}
      <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] p-6 rounded-2xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#FFC107]/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="flex items-center gap-4 mb-3 relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FFC107] to-[#FFD54F] flex items-center justify-center text-2xl shadow-lg">
            🧮
          </div>
          <div>
            <div className="text-xl font-black">Léa — Votre Agent Comptable IA</div>
            <div className="text-sm text-gray-300">Spécialisée micro-entreprise · Toujours disponible</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-300 font-medium">En ligne</span>
          </div>
        </div>
        <p className="text-sm text-gray-300 relative">
          Posez-moi toutes vos questions de comptabilité, fiscalité et gestion. J&apos;analyse vos données financières réelles pour vous donner des réponses précises et personnalisées.
        </p>
      </div>

      {/* Financial snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'CA TTC annuel', value: formatEur(annualCA), icon: '💰', color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Charges déduites', value: formatEur(totalExpenses), icon: '🧾', color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'URSSAF estimé', value: formatEur(annualHT * 0.217), icon: '🏛️', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Net estimé', value: formatEur(annualHT * 0.772 - totalExpenses), icon: '📈', color: 'text-gray-900', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className={`${stat.bg} rounded-2xl p-4 border border-white`}>
            <div className="text-xl mb-1">{stat.icon}</div>
            <div className={`font-black text-lg ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" style={{ minHeight: '500px' }}>

        {/* Chat header */}
        <div className="border-b border-gray-100 px-5 py-3 flex items-center gap-3 bg-gray-50">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFC107] to-[#FFD54F] flex items-center justify-center text-sm flex-shrink-0">🧮</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900">Léa — Agent Comptable IA</div>
            <div className="text-xs text-gray-400 truncate">
              Accès à <strong className="text-gray-600">{bookings.filter(b => b.status === 'completed').length} interventions</strong> · <strong className="text-gray-600">{expenses.length} dépenses</strong> · calculs sur toute période
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-600 font-medium">En ligne</span>
            </div>
            {messages.length > 0 && (
              <button onClick={() => { setMessages([]); setChatStarted(false) }}
                className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2 py-1 transition">
                ↺ Nouveau
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ maxHeight: '420px', minHeight: '320px' }}>
          {!chatStarted ? (
            <div className="py-4">
              {/* Welcome */}
              <div className="flex gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FFC107] to-[#FFD54F] flex items-center justify-center text-base flex-shrink-0 shadow-sm">🧮</div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[82%]">
                  <p className="text-sm text-gray-800 leading-relaxed">
                    Bonjour ! Je suis <strong>Léa</strong>, votre agent comptable IA spécialisée BTP.<br /><br />
                    J&apos;ai accès en temps réel à <strong>toutes vos données</strong> : chaque intervention, chaque dépense avec leur date et catégorie exactes.<br /><br />
                    Vous pouvez me demander n&apos;importe quel calcul sur n&apos;importe quelle période — par exemple <em>&ldquo;combien j&apos;ai dépensé en matériaux du 1er janvier au 15 mars&rdquo;</em> et je ferai le calcul ligne par ligne.
                  </p>
                </div>
              </div>

              {/* Quick question grid */}
              <div className="grid grid-cols-2 gap-2">
                {QUICK_QUESTIONS.map((q, i) => (
                  <button key={i} onClick={() => sendMessage(q.q)}
                    className="text-left text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2.5 hover:bg-amber-100 transition font-medium leading-snug">
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0 shadow-sm ${
                    msg.role === 'assistant'
                      ? 'bg-gradient-to-br from-[#FFC107] to-[#FFD54F]'
                      : 'bg-[#2C3E50] text-white'
                  }`}>
                    {msg.role === 'assistant' ? '🧮' : '👤'}
                  </div>
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#FFC107] text-gray-900 rounded-tr-sm'
                      : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                  }`}>
                    <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FFC107] to-[#FFD54F] flex items-center justify-center text-sm flex-shrink-0">🧮</div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                    <span className="text-xs text-gray-400 mr-1">Léa analyse vos données</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Suggestions rapides pendant le chat */}
        {chatStarted && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto border-t border-gray-50 pt-2">
            {[
              { label: '🔧 Matériaux', q: 'Total dépensé en matériaux cette année, détail ligne par ligne ?' },
              { label: '👷 Main d\'œuvre', q: 'Total dépensé en main d\'œuvre et sous-traitance cette année ?' },
              { label: '📆 Ce mois', q: 'Résultat net du mois en cours : revenus moins charges moins cotisations ?' },
              { label: '💳 URSSAF T en cours', q: 'Combien je dois payer à l\'URSSAF pour le trimestre en cours ?' },
              { label: '📊 Par service', q: 'Quel est mon chiffre d\'affaires par type d\'intervention cette année ?' },
              { label: '🧾 Top dépenses', q: 'Quelles sont mes 5 plus grosses dépenses de l\'année ?' },
            ].map((s, i) => (
              <button key={i} onClick={() => sendMessage(s.q)}
                className="flex-shrink-0 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-1.5 hover:bg-amber-100 transition font-medium whitespace-nowrap">
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-gray-100 p-4 flex gap-3 items-end">
          <textarea
            ref={inputRef as any}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(inputValue)
              }
            }}
            placeholder={'Posez votre question à Léa...\nEx: "Combien j\'ai dépensé en matériaux de janvier à mars ?"\nEx: "Quel est mon bénéfice net sur le 2e trimestre ?"'}
            rows={3}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107] bg-gray-50 resize-none"
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading}
            className="bg-[#FFC107] hover:bg-[#FFD54F] disabled:opacity-40 text-gray-900 px-5 py-3 rounded-xl font-bold text-sm transition-all shadow-sm flex-shrink-0 self-end"
          >
            {isLoading ? '⏳' : '↑ Envoyer'}
          </button>
        </div>
        <div className="px-4 pb-3 text-[10px] text-gray-300 text-center">
          Entrée = envoyer · Maj+Entrée = saut de ligne
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs text-gray-400 text-center">
        ℹ️ Léa fournit des informations indicatives basées sur vos données Fixit. Pour des conseils fiscaux engageant votre responsabilité, consultez un expert-comptable agréé.
      </div>
    </div>
  )
}

/* ══════════ BASE CLIENTS SECTION ══════════ */

function ClientsSection({ artisan, bookings, services, onNewRdv, onNewDevis }: {
  artisan: any
  bookings: any[]
  services: any[]
  onNewRdv: (clientName: string) => void
  onNewDevis: (clientName: string) => void
}) {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'tous' | 'particuliers' | 'entreprises'>('tous')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!artisan?.id) return
    setLoading(true)
    fetch(`/api/artisan-clients?artisan_id=${artisan.id}`)
      .then(r => r.json())
      .then(data => {
        setClients(data.clients || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [artisan?.id])

  const isEntreprise = (c: any) => Boolean(c.siret && c.siret.trim())

  const filtered = clients.filter(c => {
    const matchSearch = !search || [c.name, c.email, c.phone, c.address, c.siret]
      .filter(Boolean).some((v: string) => v.toLowerCase().includes(search.toLowerCase()))
    const matchTab =
      activeTab === 'tous' ||
      (activeTab === 'entreprises' && isEntreprise(c)) ||
      (activeTab === 'particuliers' && !isEntreprise(c))
    return matchSearch && matchTab
  })

  const totalCA = (c: any) => {
    const clientBookings = bookings.filter(b => {
      const notesMatch = b.notes && b.notes.includes(c.name)
      const idMatch = b.client_id === c.id
      return (notesMatch || idMatch) && b.status === 'completed'
    })
    return clientBookings.reduce((sum: number, b: any) => sum + (b.price_ttc || 0), 0)
  }

  const lastBookingDate = (c: any) => {
    const bks = c.bookings || []
    if (bks.length === 0) return null
    const sorted = [...bks].sort((a: any, b: any) => b.date.localeCompare(a.date))
    return sorted[0].date
  }

  const particuliersCount = clients.filter(c => !isEntreprise(c)).length
  const entreprisesCount = clients.filter(c => isEntreprise(c)).length

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-[#FFC107] shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-semibold">👥 Base Clients</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-full font-semibold">
              {clients.length} client{clients.length > 1 ? 's' : ''}
            </span>
            <span className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full font-semibold">
              {particuliersCount} particulier{particuliersCount > 1 ? 's' : ''}
            </span>
            <span className="bg-purple-50 border border-purple-200 text-purple-700 px-3 py-1 rounded-full font-semibold">
              {entreprisesCount} entreprise{entreprisesCount > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        {/* Search + Tabs */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
            <input
              type="text"
              placeholder="Rechercher par nom, email, téléphone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FFC107] transition bg-white"
            />
          </div>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {(['tous', 'particuliers', 'entreprises'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'tous' ? `Tous (${clients.length})`
                  : tab === 'particuliers' ? `👤 Particuliers (${particuliersCount})`
                  : `🏢 Entreprises (${entreprisesCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-4 animate-pulse">👥</div>
            <p>Chargement des clients...</p>
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">
              {search ? 'Aucun résultat' : 'Pas encore de clients'}
            </h3>
            <p className="text-gray-400 text-sm">
              {search
                ? 'Essayez un autre terme de recherche'
                : 'Vos clients apparaîtront ici dès qu\'ils auront pris un rendez-vous.'}
            </p>
          </div>
        )}

        {/* Client cards */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map(c => {
              const isExp = isEntreprise(c)
              const ca = totalCA(c)
              const lastDate = lastBookingDate(c)
              const bks = c.bookings || []
              const isExpanded = expandedId === c.id

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Card header */}
                  <div
                    className="p-5 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0 ${
                        isExp ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {isExp ? '🏢' : c.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-base">{c.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            isExp
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {isExp ? 'Entreprise' : 'Particulier'}
                          </span>
                          {c.source === 'auth' && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Compte Fixit</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 flex-wrap">
                          {c.phone && <span className="text-sm text-gray-500">📞 {c.phone}</span>}
                          {c.email && <span className="text-sm text-gray-500 truncate">✉️ {c.email}</span>}
                          {!c.phone && !c.email && <span className="text-sm text-gray-400 italic">Coordonnées non renseignées</span>}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="text-lg font-bold text-green-600">
                          {ca > 0 ? `${ca.toFixed(0)} €` : '—'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {bks.length} intervention{bks.length > 1 ? 's' : ''}
                        </div>
                        {lastDate && (
                          <div className="text-xs text-gray-400">
                            Dernier: {new Date(lastDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </div>

                      {/* Expand arrow */}
                      <div className={`text-gray-400 text-lg transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                        ▾
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-5 bg-gray-50">
                      <div className="grid sm:grid-cols-2 gap-6">
                        {/* Contact details */}
                        <div>
                          <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">📋 Coordonnées</h4>
                          <div className="space-y-2 text-sm">
                            {c.phone && (
                              <div className="flex gap-2">
                                <span className="text-gray-400 w-20 flex-shrink-0">Téléphone</span>
                                <a href={`tel:${c.phone}`} className="text-blue-600 hover:underline font-medium">{c.phone}</a>
                              </div>
                            )}
                            {c.email && (
                              <div className="flex gap-2">
                                <span className="text-gray-400 w-20 flex-shrink-0">Email</span>
                                <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline font-medium truncate">{c.email}</a>
                              </div>
                            )}
                            {c.address && (
                              <div className="flex gap-2">
                                <span className="text-gray-400 w-20 flex-shrink-0">Adresse</span>
                                <span className="text-gray-700">{c.address}{c.postalCode ? `, ${c.postalCode}` : ''}{c.city ? ` ${c.city}` : ''}</span>
                              </div>
                            )}
                            {c.siret && (
                              <div className="flex gap-2">
                                <span className="text-gray-400 w-20 flex-shrink-0">SIRET</span>
                                <span className="font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-xs">{c.siret}</span>
                              </div>
                            )}
                            {!c.phone && !c.email && !c.address && !c.siret && (
                              <p className="text-gray-400 italic text-xs">Aucune coordonnée disponible</p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => onNewRdv(c.name)}
                              className="flex-1 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-3 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
                            >
                              📅 Nouveau RDV
                            </button>
                            <button
                              onClick={() => onNewDevis(c.name)}
                              className="flex-1 bg-white border-2 border-gray-200 hover:border-[#FFC107] text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                            >
                              📄 Créer devis
                            </button>
                          </div>
                        </div>

                        {/* Booking history */}
                        <div>
                          <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">🗂 Historique ({bks.length})</h4>
                          {bks.length === 0 ? (
                            <p className="text-gray-400 text-sm italic">Aucune intervention enregistrée</p>
                          ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {[...bks].sort((a: any, b: any) => b.date.localeCompare(a.date)).map((bk: any) => (
                                <div key={bk.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2">
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    bk.status === 'completed' ? 'bg-green-500'
                                      : bk.status === 'confirmed' ? 'bg-blue-500'
                                      : bk.status === 'cancelled' ? 'bg-red-400'
                                      : 'bg-amber-400'
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-800 truncate">{bk.service || 'Intervention'}</div>
                                    <div className="text-xs text-gray-400">
                                      {new Date(bk.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </div>
                                  </div>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                                    bk.status === 'completed' ? 'bg-green-100 text-green-700'
                                      : bk.status === 'confirmed' ? 'bg-blue-100 text-blue-700'
                                      : bk.status === 'cancelled' ? 'bg-red-100 text-red-600'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {bk.status === 'completed' ? 'Terminé'
                                      : bk.status === 'confirmed' ? 'Confirmé'
                                      : bk.status === 'cancelled' ? 'Annulé'
                                      : 'En attente'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Mobile stats */}
                          <div className="mt-4 pt-3 border-t border-gray-200 flex gap-4 sm:hidden text-sm">
                            <div>
                              <div className="font-bold text-green-600 text-lg">{ca > 0 ? `${ca.toFixed(0)} €` : '—'}</div>
                              <div className="text-gray-400 text-xs">CA total TTC</div>
                            </div>
                            <div>
                              <div className="font-bold text-gray-700 text-lg">{bks.length}</div>
                              <div className="text-gray-400 text-xs">Intervention{bks.length > 1 ? 's' : ''}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════ MATÉRIAUX & PRIX SECTION ══════════ */

interface MatPrice { store: string; price: number; url: string | null }
interface MatItem { name: string; qty: number; unit: string; category: string; norms: string[]; normDetails: string; prices: MatPrice[]; bestPrice: { store: string; price: number } | null; avgPrice: number }
interface MatSearch { id: string; date: string; query: string; city: string | null; materials: MatItem[]; totalEstimate: { min: number; max: number } | null }

const JOB_PRESETS = [
  { label: '🚿 Chauffe-eau', q: 'Remplacement chauffe-eau thermodynamique 200L' },
  { label: '🪟 Carrelage 20m²', q: 'Pose carrelage sol 20m² format 60x60' },
  { label: '⚡ Tableau électrique', q: 'Remplacement tableau électrique 8 circuits' },
  { label: '🚪 Salle de bain', q: 'Rénovation salle de bain complète 6m²' },
  { label: '🔩 Robinetterie', q: 'Remplacement robinetterie cuisine et salle de bain' },
  { label: '🧱 Isolation combles', q: 'Isolation combles perdus 50m² laine de verre' },
]

const STORE_COLORS: Record<string, string> = {
  'Leroy Merlin': 'text-green-700 bg-green-50',
  'Brico Dépôt': 'text-orange-700 bg-orange-50',
  'Castorama': 'text-blue-700 bg-blue-50',
  'Point P': 'text-red-700 bg-red-50',
  'Cédéo': 'text-purple-700 bg-purple-50',
  'Mr.Bricolage': 'text-yellow-700 bg-yellow-50',
  'Brico Leclerc': 'text-teal-700 bg-teal-50',
}

function MateriauxSection({ artisan, onExportDevis }: { artisan: any; onExportDevis: (lines: any[]) => void }) {
  const [activeTab, setActiveTab] = useState<'recherche' | 'historique' | 'aide'>('recherche')
  const [userCity, setUserCity] = useState<string | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [chatStarted, setChatStarted] = useState(false)
  const [currentResults, setCurrentResults] = useState<MatItem[] | null>(null)
  const [currentEstimate, setCurrentEstimate] = useState<{ min: number; max: number } | null>(null)
  const [isFallback, setIsFallback] = useState(false)
  const [savedSearches, setSavedSearches] = useState<MatSearch[]>(() => {
    try { return JSON.parse(localStorage.getItem(`fixit_materiaux_${artisan?.id}`) || '[]') } catch { return [] }
  })
  const [globalMarkup, setGlobalMarkup] = useState(15)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentResults])

  const handleGeolocation = () => {
    if (!navigator.geolocation) { setGeoError('Géolocalisation non supportée'); return }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
            { headers: { 'User-Agent': 'Fixit-Pro/1.0' } }
          )
          const data = await res.json()
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || null
          setUserCity(city)
        } catch { setGeoError('Impossible de déterminer la ville') }
        setGeoLoading(false)
      },
      (err) => {
        setGeoError(err.code === 1 ? 'Accès à la position refusé' : 'Erreur de géolocalisation')
        setGeoLoading(false)
      },
      { timeout: 8000, maximumAge: 300000 }
    )
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return
    setChatStarted(true)
    setCurrentResults(null)
    setCurrentEstimate(null)
    const userMsg = { role: 'user' as const, content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/materiaux-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text.trim(),
          city: userCity,
          conversationHistory: messages.slice(-6),
        }),
      })
      const data = await res.json()

      setIsFallback(data.fallback || false)

      if (data.materials?.length > 0) {
        setCurrentResults(data.materials)
        setCurrentEstimate(data.totalEstimate || null)
        // Save to history
        const search: MatSearch = {
          id: Date.now().toString(),
          date: new Date().toISOString().split('T')[0],
          query: text.trim(),
          city: userCity,
          materials: data.materials,
          totalEstimate: data.totalEstimate || null,
        }
        const updated = [search, ...savedSearches].slice(0, 20)
        setSavedSearches(updated)
        localStorage.setItem(`fixit_materiaux_${artisan?.id}`, JSON.stringify(updated))
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response || 'Voici les matériaux identifiés pour votre chantier.',
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Erreur de connexion. Veuillez réessayer.',
      }])
    }
    setIsLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // ─── Logique fiscale selon statut artisan ────────────────────────────────
  // Détermine si l'artisan est en franchise en base de TVA (auto-entrepreneur, ou EI sous seuil)
  // Seuils 2024-2025 : 37 500€ CA pour services / 85 000€ pour ventes de marchandises
  // Pour BTP (mixte prestation+fourniture) : seuil 37 500€ applicable
  const artisanLegalForm = (artisan?.legal_form || '').toLowerCase()
  const isAutoEntrepreneur = artisanLegalForm.includes('auto') || artisanLegalForm.includes('micro') || artisanLegalForm.includes('individuel')
  // TVA applicable si l'artisan est en société (SARL/SAS/EURL) ou a explicitement activé la TVA
  const isAssujetti = artisanLegalForm.includes('sarl') || artisanLegalForm.includes('sas') || artisanLegalForm.includes('eurl') || artisanLegalForm.includes('sa ')

  // Taux de TVA applicable sur la revente de matériaux BTP :
  // - Travaux de rénovation logement > 2 ans : 10% (art. 279-0 bis CGI)
  // - Travaux éco-rénovation éligibles (isolation, PAC) : 5.5% (art. 278-0 bis CGI)
  // - Travaux en logement neuf ou local professionnel : 20%
  // On utilise 10% par défaut (rénovation résidentielle = cas le plus courant)
  const TVA_REVENTE = 10   // % TVA sur prestations+fournitures facturées au client
  const TVA_ACHAT = 10     // % TVA incluse dans les prix TTC magasin (rénovation BTP)

  // Prix de revente HT à facturer au client selon statut fiscal :
  // AE/franchise : Prix achat TTC × (1 + marge%) → pas de TVA récupérée à l'achat
  //               → le devis est en HT = TTC (TVA non applicable art. 293B CGI)
  // Assujetti TVA : Prix achat TTC / (1 + TVA_ACHAT/100) = Prix achat HT artisan
  //               → Prix revente HT = Prix achat HT × (1 + marge%)
  //               → Le client paie HT + TVA 10% sur la prestation complète

  const getPrixAchatHT = (prixTTC: number) => {
    if (isAssujetti) return prixTTC / (1 + TVA_ACHAT / 100)  // récupère la TVA achat
    return prixTTC  // AE : supporte la TVA achat (non récupérable) → intégrer dans le coût
  }

  const getPrixRevente = (prixTTC: number, markup: number) => {
    const prixBase = getPrixAchatHT(prixTTC)
    return prixBase * (1 + markup / 100)
  }

  // Marge minimum recommandée : 25-35% (standard national artisans BTP, source CAPEB/FFB)
  // Pour AE : marge doit couvrir TVA achat non récupérable (10%) + bénéfice réel ≥ 15%
  // → recommandation min AE = 30%, min assujetti TVA = 25%
  const margeMinRecommandee = isAutoEntrepreneur ? 30 : 25
  const margeIsRentable = globalMarkup >= margeMinRecommandee

  const handleExportDevis = () => {
    if (!currentResults) return
    const exportLines = currentResults.map((m, i) => {
      const prixTTC = m.bestPrice?.price || m.avgPrice || 0
      const priceHT = Math.round(getPrixRevente(prixTTC, globalMarkup) * 100) / 100
      return {
        id: i + 1,
        description: `${m.name} — ${m.category}${m.norms?.length ? ` (${m.norms[0]})` : ''}`,
        qty: m.qty,
        priceHT,
        // AE : TVA non applicable → tvaRate = 0 et tvaEnabled = false dans le devis
        // Assujetti : TVA 10% rénovation BTP (art. 279-0 bis CGI)
        tvaRate: isAssujetti ? TVA_REVENTE : 0,
        totalHT: Math.round(priceHT * m.qty * 100) / 100,
      }
    })
    onExportDevis(exportLines)
  }

  const formatMsg = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>')
  }

  // Totaux avec logique fiscale correcte
  const totalBestPrice = currentResults?.reduce((sum, m) => sum + (m.bestPrice?.price || m.avgPrice || 0), 0) || 0
  const totalCoutAchatHT = currentResults?.reduce((sum, m) => sum + getPrixAchatHT(m.bestPrice?.price || m.avgPrice || 0), 0) || 0
  const totalRevente = currentResults?.reduce((sum, m) => sum + getPrixRevente(m.bestPrice?.price || m.avgPrice || 0, globalMarkup), 0) || 0
  const totalReventeTTC = isAssujetti ? totalRevente * (1 + TVA_REVENTE / 100) : totalRevente
  const margeBrute = totalRevente - totalCoutAchatHT
  const markupAmount = Math.round(margeBrute)
  const totalWithMarkup = Math.round(totalRevente)

  const allStores = currentResults
    ? [...new Set(currentResults.flatMap(m => m.prices.map(p => p.store)))].sort()
    : []

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-[#FFC107] shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold">🛒 Matériaux & Prix</h1>
            <p className="text-sm text-gray-400 mt-0.5">Recherche IA autonome · Comparatif par enseigne</p>
          </div>
          <div className="flex items-center gap-2">
            {userCity && (
              <span className="text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1.5 font-semibold">
                📍 {userCity}
              </span>
            )}
            <button
              onClick={handleGeolocation}
              disabled={geoLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                userCity
                  ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'border-[#FFC107] bg-[#FFC107]/10 text-gray-800 hover:bg-[#FFC107]/20'
              }`}
            >
              {geoLoading ? '⏳' : '📍'} {userCity ? 'Mettre à jour' : 'Localisation GPS'}
            </button>
          </div>
        </div>
        {geoError && <p className="text-xs text-red-500 mt-2">⚠️ {geoError}</p>}
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-6 lg:px-10 pt-4 pb-0">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-0">
          {([
            { key: 'recherche', label: '🔍 Recherche' },
            { key: 'historique', label: `📋 Historique (${savedSearches.length})` },
            { key: 'aide', label: '💡 Aide' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
                activeTab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── RECHERCHE TAB ── */}
      {activeTab === 'recherche' && (
        <div className="p-6 lg:p-8">
          {/* Welcome screen */}
          {!chatStarted && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-[#FFC107]/40 rounded-2xl p-8 mb-6 text-center">
                <div className="text-6xl mb-4">🛒</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Agent Matériaux IA</h2>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Décrivez votre intervention et l&apos;agent génère automatiquement la liste des matériaux
                  avec les prix par enseigne <strong>(Leroy Merlin, Brico Dépôt, Castorama…)</strong>
                </p>
                {!userCity && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
                    💡 Activez la localisation GPS pour des résultats adaptés à votre région
                  </div>
                )}
              </div>

              {/* Quick presets */}
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">Interventions courantes</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {JOB_PRESETS.map((p, i) => (
                    <button key={i} onClick={() => sendMessage(p.q)}
                      className="bg-white border-2 border-gray-200 hover:border-[#FFC107] hover:-translate-y-0.5 text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chat messages */}
          {chatStarted && (
            <div className="max-w-3xl mx-auto">
              <div className="space-y-4 mb-6">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 bg-[#FFC107] rounded-xl flex items-center justify-center text-lg mr-2 flex-shrink-0 mt-1">🛒</div>
                    )}
                    <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#FFC107] text-gray-900 font-medium rounded-tr-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                    }`}
                      dangerouslySetInnerHTML={{ __html: formatMsg(msg.content) }}
                    />
                  </div>
                ))}

                {/* Loading */}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="w-8 h-8 bg-[#FFC107] rounded-xl flex items-center justify-center text-lg mr-2 flex-shrink-0">🛒</div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-5 py-3 shadow-sm">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="flex gap-1">
                          <span className="w-2 h-2 bg-[#FFC107] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-[#FFC107] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-[#FFC107] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                        <span>Recherche des matériaux et prix en cours...</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Résultats matériaux */}
                {currentResults && currentResults.length > 0 && !isLoading && (
                  <div className="space-y-4">
                    {isFallback && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex gap-2">
                        <span>⚠️</span>
                        <span>Prix estimés (sans recherche web en temps réel). Activez Tavily pour des prix actualisés.</span>
                      </div>
                    )}

                    {/* Cards matériaux */}
                    <div className="grid gap-3">
                      {currentResults.map((m, i) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                          {/* Header matériau */}
                          <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
                            <span className="text-2xl">{
                              m.category === 'Sanitaire' || m.category === 'Plomberie' ? '🔧'
                              : m.category === 'Électricité' ? '⚡'
                              : m.category === 'Chauffage' ? '🌡️'
                              : m.category === 'Carrelage' ? '🪟'
                              : m.category === 'Isolation' ? '🧱'
                              : m.category === 'Menuiserie' ? '🚪'
                              : m.category === 'Peinture' ? '🎨'
                              : m.category === 'Maçonnerie' ? '🧱'
                              : m.category === 'Toiture' ? '🏠'
                              : m.category === 'Ventilation' ? '💨'
                              : '📦'
                            }</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-gray-900">{m.name}</div>
                              <div className="text-xs text-gray-400">{m.qty} {m.unit} · {m.category}</div>
                            </div>
                            {m.bestPrice && (
                              <div className="text-right flex-shrink-0">
                                <div className="text-lg font-black text-green-600">{m.bestPrice.price} €</div>
                                <div className="text-xs text-gray-400">Meilleur prix</div>
                              </div>
                            )}
                          </div>

                          {/* Prix par enseigne */}
                          {m.prices.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                              {[...m.prices].sort((a, b) => a.price - b.price).map((p, j) => (
                                <div key={j} className={`flex items-center gap-3 px-5 py-2.5 ${
                                  m.bestPrice?.store === p.store ? 'bg-green-50' : ''
                                }`}>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${STORE_COLORS[p.store] || 'text-gray-700 bg-gray-100'}`}>
                                    {p.store}
                                  </span>
                                  <div className="flex-1" />
                                  <span className={`font-bold text-base ${m.bestPrice?.store === p.store ? 'text-green-700' : 'text-gray-700'}`}>
                                    {p.price} €
                                  </span>
                                  {m.bestPrice?.store === p.store && (
                                    <span className="text-green-600 text-xs font-bold">✅ Meilleur</span>
                                  )}
                                  {p.url && (
                                    <a href={p.url} target="_blank" rel="noopener noreferrer"
                                      className="text-blue-500 hover:text-blue-700 text-xs underline ml-1">↗</a>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="px-5 py-3 text-sm text-gray-400 italic">Prix non trouvés — vérifiez manuellement</div>
                          )}

                          {/* Normes applicables */}
                          {(m.norms?.length > 0 || m.normDetails) && (
                            <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
                              {m.norms?.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                  <span className="text-xs font-bold text-amber-700">📋 Normes :</span>
                                  {m.norms.map((n: string, ni: number) => (
                                    <span key={ni} className="text-xs bg-amber-100 border border-amber-300 text-amber-800 px-2 py-0.5 rounded-full font-mono font-semibold">
                                      {n}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {m.normDetails && (
                                <p className="text-xs text-amber-700 leading-relaxed">
                                  ⚠️ {m.normDetails}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Tableau comparatif si plusieurs enseignes */}
                    {allStores.length > 1 && (
                      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 font-bold text-sm text-gray-700">
                          📊 Tableau comparatif des prix
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="text-left px-4 py-2 text-gray-500 font-semibold">Matériau</th>
                                {allStores.map(s => (
                                  <th key={s} className="text-right px-4 py-2 text-gray-500 font-semibold whitespace-nowrap">{s}</th>
                                ))}
                                <th className="text-right px-4 py-2 text-green-600 font-semibold">Meilleur</th>
                              </tr>
                            </thead>
                            <tbody>
                              {currentResults.map((m, i) => (
                                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                  <td className="px-4 py-2 text-gray-800 font-medium max-w-[200px] truncate">{m.name}</td>
                                  {allStores.map(s => {
                                    const p = m.prices.find(pr => pr.store === s)
                                    const isBest = m.bestPrice?.store === s
                                    return (
                                      <td key={s} className={`text-right px-4 py-2 font-semibold ${
                                        isBest ? 'text-green-700 bg-green-50' : p ? 'text-gray-700' : 'text-gray-300'
                                      }`}>
                                        {p ? `${p.price} €` : '—'}
                                      </td>
                                    )
                                  })}
                                  <td className="text-right px-4 py-2 text-green-700 font-bold">
                                    {m.bestPrice ? `${m.bestPrice.price} €` : '—'}
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                                <td className="px-4 py-2 text-gray-700">TOTAL (meilleurs prix)</td>
                                {allStores.map(s => <td key={s} className="px-4 py-2" />)}
                                <td className="text-right px-4 py-2 text-green-700 text-base">
                                  {totalBestPrice > 0 ? `${totalBestPrice} €` : '—'}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Marge + Export devis */}
                    {totalBestPrice > 0 && (
                      <div className="bg-white border-2 border-[#FFC107]/40 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                          <h3 className="font-bold text-gray-800 text-lg">💰 Intégrer au devis</h3>
                          {/* Badge statut fiscal détecté */}
                          <span className={`text-xs px-3 py-1 rounded-full font-semibold border ${
                            isAssujetti
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : 'bg-amber-50 border-amber-200 text-amber-700'
                          }`}>
                            {isAssujetti
                              ? `📋 ${artisan?.legal_form || 'Société'} — TVA ${TVA_REVENTE}% applicable`
                              : `📋 ${isAutoEntrepreneur ? 'Auto-entrepreneur' : 'EI'} — Franchise en base TVA (art. 293B CGI)`
                            }
                          </span>
                        </div>

                        {/* Marge slider */}
                        <div className="flex items-center gap-4 mb-2">
                          <label className="text-sm font-semibold text-gray-600 flex-shrink-0">Marge de revente</label>
                          <input
                            type="range" min={0} max={60} value={globalMarkup}
                            onChange={e => setGlobalMarkup(Number(e.target.value))}
                            className="flex-1 accent-[#FFC107]"
                          />
                          <span className={`text-xl font-black w-14 text-right ${margeIsRentable ? 'text-green-600' : 'text-red-500'}`}>
                            {globalMarkup}%
                          </span>
                        </div>

                        {/* Alerte si marge insuffisante */}
                        {!margeIsRentable && totalBestPrice > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-red-700">
                            ⚠️ <strong>Marge insuffisante.</strong> Standard national CAPEB/FFB : min <strong>{margeMinRecommandee}%</strong>
                            {isAutoEntrepreneur ? ` en franchise TVA (couvre TVA achat non récupérable + charges + bénéfice)` : ` en société assujettie TVA`}.
                          </div>
                        )}
                        {margeIsRentable && totalBestPrice > 0 && (
                          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 mb-4 text-xs text-green-700">
                            ✅ Marge conforme aux standards nationaux BTP ({margeMinRecommandee}% min)
                          </div>
                        )}

                        {/* Tableau de calcul fiscal */}
                        <div className="bg-gray-50 rounded-2xl p-4 mb-5 space-y-2 text-sm">
                          <div className="flex justify-between text-gray-600">
                            <span>Coût achat matériaux (prix magasin TTC)</span>
                            <span className="font-semibold">{Math.round(totalBestPrice)} €</span>
                          </div>
                          {isAssujetti && (
                            <div className="flex justify-between text-gray-500 text-xs pl-3">
                              <span>→ TVA achat récupérée ({TVA_ACHAT}%) — crédit de TVA</span>
                              <span className="text-blue-600 font-semibold">−{Math.round(totalBestPrice - totalCoutAchatHT)} €</span>
                            </div>
                          )}
                          {isAutoEntrepreneur && (
                            <div className="flex justify-between text-gray-500 text-xs pl-3">
                              <span>→ TVA achat non récupérable (incluse dans votre coût réel)</span>
                              <span className="text-amber-600 font-semibold">{Math.round(totalBestPrice - totalBestPrice / (1 + TVA_ACHAT / 100))} €</span>
                            </div>
                          )}
                          <div className="flex justify-between text-gray-600 border-t border-gray-200 pt-2">
                            <span>Coût réel HT artisan</span>
                            <span className="font-semibold">{Math.round(totalCoutAchatHT)} €</span>
                          </div>
                          <div className="flex justify-between text-amber-700">
                            <span>Marge revente {globalMarkup}%</span>
                            <span className="font-bold">+{markupAmount} €</span>
                          </div>
                          <div className="flex justify-between text-gray-800 font-bold border-t border-gray-200 pt-2">
                            <span>Montant HT à facturer</span>
                            <span>{totalWithMarkup} €</span>
                          </div>
                          {isAssujetti && (
                            <div className="flex justify-between text-gray-600 text-xs pl-3">
                              <span>+ TVA {TVA_REVENTE}% collectée (art. 279-0 bis CGI — rénovation)</span>
                              <span>{Math.round(totalRevente * TVA_REVENTE / 100)} €</span>
                            </div>
                          )}
                          <div className={`flex justify-between font-black text-base pt-2 border-t-2 border-gray-300 ${isAssujetti ? 'text-blue-700' : 'text-green-700'}`}>
                            <span>Total TTC client</span>
                            <span>{Math.round(totalReventeTTC)} €</span>
                          </div>
                        </div>

                        {/* Info légale selon statut */}
                        <div className={`rounded-xl px-4 py-3 mb-4 text-xs leading-relaxed ${
                          isAssujetti ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {isAssujetti ? (
                            <>
                              <strong>📋 Régime TVA réel :</strong> Vous récupérez la TVA sur vos achats et collectez la TVA sur vos ventes.
                              Taux applicable : <strong>10% rénovation logement &gt;2 ans</strong> (art. 279-0 bis CGI).
                              Pour éco-rénovation (isolation, PAC, fenêtres) : 5.5% (art. 278-0 bis CGI).
                              Pour local professionnel ou construction neuve : 20%.
                            </>
                          ) : (
                            <>
                              <strong>📋 Franchise en base de TVA :</strong> Vous n&apos;êtes pas assujetti à la TVA.
                              Vos achats sont à votre charge TTC (non récupérable).
                              Vos factures doivent mentionner <em>&quot;TVA non applicable — art. 293 B du CGI&quot;</em>.
                              Seuils 2025 : 37 500 €/an prestation · 85 000 €/an marchandises.
                            </>
                          )}
                        </div>

                        <button onClick={handleExportDevis}
                          className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-3.5 rounded-xl font-bold text-base shadow-md hover:-translate-y-0.5 transition-all">
                          📄 Exporter vers un devis ({totalWithMarkup} € HT
                          {isAssujetti ? ` + TVA ${TVA_REVENTE}% = ${Math.round(totalReventeTTC)} € TTC` : ' — TVA non applicable'})
                        </button>
                        <p className="text-xs text-gray-400 text-center mt-2">
                          {isAssujetti
                            ? `TVA ${TVA_REVENTE}% collectée sur revente · Prix HT client calculés avec marge ${globalMarkup}%`
                            : `Franchise TVA art. 293B CGI · Marge ${globalMarkup}% sur coût TTC artisan`
                          }
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions rapides */}
              {chatStarted && !isLoading && (
                <div className="flex gap-2 flex-wrap mb-4">
                  {JOB_PRESETS.slice(0, 3).map((p, i) => (
                    <button key={i} onClick={() => sendMessage(p.q)}
                      className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-1.5 hover:bg-amber-100 transition font-medium whitespace-nowrap">
                      {p.label}
                    </button>
                  ))}
                  <button onClick={() => { setMessages([]); setChatStarted(false); setCurrentResults(null); setCurrentEstimate(null) }}
                    className="text-xs bg-gray-100 border border-gray-200 text-gray-500 rounded-xl px-3 py-1.5 hover:bg-gray-200 transition font-medium">
                    🔄 Nouvelle recherche
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Input */}
          <div className="max-w-3xl mx-auto">
            <div className="bg-white border-2 border-gray-200 rounded-2xl shadow-sm focus-within:border-[#FFC107] transition-colors">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputValue) }
                }}
                placeholder={userCity
                  ? `Décrivez votre intervention à ${userCity}...\nEx: "Remplacement chauffe-eau 150L" ou "Pose parquet flottant 30m²"`
                  : `Décrivez votre intervention...\nEx: "Remplacement chauffe-eau 150L" ou "Installation VMC double flux"`
                }
                rows={3}
                className="w-full px-5 pt-4 pb-2 text-sm focus:outline-none bg-transparent resize-none rounded-2xl"
                disabled={isLoading}
              />
              <div className="flex items-center justify-between px-4 pb-3">
                <span className="text-xs text-gray-300">Entrée = rechercher · Maj+Entrée = saut de ligne</span>
                <button
                  onClick={() => sendMessage(inputValue)}
                  disabled={!inputValue.trim() || isLoading}
                  className="bg-[#FFC107] hover:bg-[#FFD54F] disabled:opacity-40 text-gray-900 px-5 py-2 rounded-xl font-bold text-sm transition-all shadow-sm"
                >
                  {isLoading ? '⏳' : '🔍 Rechercher'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORIQUE TAB ── */}
      {activeTab === 'historique' && (
        <div className="p-6 lg:p-8">
          {savedSearches.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">Aucune recherche sauvegardée</h3>
              <p className="text-gray-400 text-sm">Vos recherches de matériaux apparaîtront ici automatiquement.</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl mx-auto">
              {savedSearches.map(s => (
                <div key={s.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4 p-5">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 truncate">{s.query}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400">
                          📅 {new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        {s.city && <span className="text-xs text-blue-600">📍 {s.city}</span>}
                        <span className="text-xs text-gray-500">{s.materials.length} matériaux</span>
                        {s.totalEstimate && (
                          <span className="text-xs font-bold text-green-600">
                            ~{s.totalEstimate.min}–{s.totalEstimate.max} €
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setCurrentResults(s.materials)
                          setCurrentEstimate(s.totalEstimate)
                          setMessages([
                            { role: 'user', content: s.query },
                            { role: 'assistant', content: `Résultats chargés depuis l'historique du **${new Date(s.date).toLocaleDateString('fr-FR')}**${s.city ? ` (${s.city})` : ''}.` },
                          ])
                          setChatStarted(true)
                          setActiveTab('recherche')
                        }}
                        className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                      >
                        📂 Recharger
                      </button>
                      <button
                        onClick={() => {
                          const updated = savedSearches.filter(x => x.id !== s.id)
                          setSavedSearches(updated)
                          localStorage.setItem(`fixit_materiaux_${artisan?.id}`, JSON.stringify(updated))
                        }}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl text-sm transition-all border border-gray-200"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AIDE TAB ── */}
      {activeTab === 'aide' && (
        <div className="p-6 lg:p-8 max-w-3xl mx-auto">
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 text-lg">🤖 Comment fonctionne l&apos;agent ?</h3>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-600 leading-relaxed">
                <li><strong>Analyse :</strong> L&apos;IA identifie les matériaux nécessaires à partir de votre description</li>
                <li><strong>Recherche :</strong> Chaque matériau est recherché sur internet (Leroy Merlin, Brico Dépôt, Castorama…)</li>
                <li><strong>Comparaison :</strong> Les prix sont extraits et comparés par enseigne</li>
                <li><strong>Export :</strong> La liste peut être exportée directement vers un devis avec marge configurable</li>
              </ol>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 text-lg">🏪 Enseignes couvertes</h3>
              <div className="flex flex-wrap gap-2">
                {['Leroy Merlin', 'Brico Dépôt', 'Castorama', 'Point P', 'Cédéo', 'Mr.Bricolage', 'Brico Leclerc'].map(s => (
                  <span key={s} className={`px-3 py-1.5 rounded-full text-sm font-semibold ${STORE_COLORS[s] || 'bg-gray-100 text-gray-700'}`}>{s}</span>
                ))}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 text-lg">💡 Conseils d&apos;utilisation</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>📍 <strong>Activez le GPS</strong> pour des résultats orientés vers votre région</li>
                <li>🎯 <strong>Soyez précis</strong> : &quot;chauffe-eau 150L électrique&quot; plutôt que &quot;chauffe-eau&quot;</li>
                <li>📐 <strong>Donnez les surfaces</strong> : &quot;carrelage 20m²&quot; permet d&apos;estimer les quantités</li>
                <li>💰 <strong>Ajustez la marge</strong> selon votre contrat et la complexité de la pose</li>
                <li>📄 <strong>Exportez vers devis</strong> pour facturer les matériaux avec TVA 10% (rénovation BTP)</li>
              </ul>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-700">
              <strong>⚠️ Disclaimer :</strong> Les prix affichés sont des estimations à titre indicatif.
              Ils peuvent varier selon les promotions, stocks et localisation. Vérifiez toujours les prix
              définitifs directement sur les sites ou en magasin avant d&apos;établir un devis définitif.
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
      <div className={`text-sm mt-2 font-semibold ${positive ? 'text-green-500' : 'text-gray-400'}`}>{change}</div>
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
        <div className="text-sm text-gray-400">{time}</div>
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
