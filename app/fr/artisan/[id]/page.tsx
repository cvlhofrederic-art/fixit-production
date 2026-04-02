'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLocale } from '@/lib/i18n/context'
import Link from 'next/link'
import {
  Star,
  MapPin,
  Check,
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  Home,
  Search,
  Building2,
  Shield,
  FileText,
  ChevronDown,
} from 'lucide-react'
import {
  type PriceTier,
  type PriceInfo,
  getDayName,
  getMonthName,
  getSmartPrice,
  calculateEstimatedPrice,
  parseServiceTag,
  cleanServiceDesc,
  getServiceEstimate,
  getServiceEmoji,
  getArtisanInitials,
  groupServicesByCategory,
  UNIT_LABELS,
} from '@/lib/artisan-profile-utils'
import { AvisSection } from '@/components/artisan-profile/AvisSection'
import { ServicesGrid } from '@/components/artisan-profile/ServicesGrid'
import { BookingForm } from '@/components/artisan-profile/BookingForm'

type Step = 'profile' | 'motif' | 'calendar'

export default function ArtisanProfilePage() {
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const isPt = locale === 'pt'
  const t = (fr: string, pt: string) => (isPt ? pt : fr)
  const dateFmtLocale = isPt ? 'pt-PT' : 'fr-FR'
  const [artisan, setArtisan] = useState<any>(null)
  const [services, setServices] = useState<any[]>([])
  const [availability, setAvailability] = useState<any[]>([])
  const [existingBookings, setExistingBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dayServicesConfig, setDayServicesConfig] = useState<Record<string, string[]>>({})

  // Connected user
  const [connectedUser, setConnectedUser] = useState<any>(null)

  // Flow state
  const [step, setStep] = useState<Step>('profile')
  const [isFavorited, setIsFavorited] = useState(false)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [customMotif, setCustomMotif] = useState('')
  const [useCustomMotif, setUseCustomMotif] = useState(false)
  const [selectedPriceTier, setSelectedPriceTier] = useState<PriceTier | null>(null)
  const [selectedTreeWidth, setSelectedTreeWidth] = useState<{ label: string; price: string } | null>(null)
  // Pour les services au m² / ml : question superficie
  const [quantityKnown, setQuantityKnown] = useState<boolean | null>(null)
  const [quantityValue, setQuantityValue] = useState<string>('')

  // ── Multi-service cart ────────────────────────────────────────────
  const [selectedServices, setSelectedServices] = useState<any[]>([])
  const [serviceQuantities, setServiceQuantities] = useState<Record<string, string>>({})
  const [showEstimateModal, setShowEstimateModal] = useState(false)
  const [showBusinessCard, setShowBusinessCard] = useState(false)
  // ─────────────────────────────────────────────────────────────────

  // Calendar state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Client form state
  const [bookingForm, setBookingForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    cgu: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [addressSuggestions, setAddressSuggestions] = useState<{ label: string; value: string }[]>([])
  const [showAddrDropdown, setShowAddrDropdown] = useState(false)
  const addrDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchAddressSuggestions = (query: string) => {
    if (addrDebounceRef.current) clearTimeout(addrDebounceRef.current)
    if (query.length < 3) { setAddressSuggestions([]); return }
    addrDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`)
        if (res.ok) {
          const data = await res.json()
          const suggestions = (data.features || []).map((f: any) => ({
            label: f.properties?.label || '',
            value: f.properties?.label || '',
          }))
          setAddressSuggestions(suggestions)
          setShowAddrDropdown(suggestions.length > 0)
        }
      } catch { /* silent */ }
    }, 300)
  }

  useEffect(() => {
    fetchArtisan()
    // Check if user is logged in to pre-fill booking form
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setConnectedUser(session.user)
      }
    }
    checkUser()

    // Browser back button: push a guard entry, intercept every back press
    window.history.pushState(null, '')
    const onPopState = () => {
      const cur = stepRef.current
      if (cur === 'calendar') {
        window.history.pushState(null, '')
        setStep('motif')
      } else if (cur === 'motif') {
        window.history.pushState(null, '')
        setStep('profile')
      } else {
        // On profile — go back for real (leave the page)
        window.history.back()
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Track current step in a ref so popstate handler always reads latest
  const stepRef = useRef(step)
  useEffect(() => { stepRef.current = step }, [step])

  // Check if artisan is favorited
  useEffect(() => {
    if (!artisan?.id) return
    const checkFav = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch('/api/favorites', { headers: { Authorization: `Bearer ${session.access_token}` } })
        if (res.ok) {
          const data = await res.json()
          if (data.favorites?.some((f: any) => f.artisan_id === artisan.id)) setIsFavorited(true)
        }
      } catch { /* silent */ }
    }
    checkFav()
  }, [artisan?.id])

  const fetchArtisan = async () => {
    const paramId = params.id as string

    // Résolution par slug OU par UUID
    // UUID = format 8-4-4-4-12 hex, sinon c'est un slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paramId)

    let artisanData: any = null
    if (isUuid) {
      const { data } = await supabase
        .from('profiles_artisan').select('*').eq('id', paramId).single()
      artisanData = data
    } else {
      // Chercher par slug
      const { data } = await supabase
        .from('profiles_artisan').select('*').eq('slug', paramId).single()
      artisanData = data
    }

    if (!artisanData) { setLoading(false); return }
    const artisanId = artisanData.id

    const { data: servicesData } = await supabase
      .from('services')
      .select('*')
      .eq('artisan_id', artisanId)
      .eq('active', true)

    // Use API routes (server-side service_role key) to bypass RLS
    const [availRes, bookingsRes, dsRes] = await Promise.all([
      fetch(`/api/availability?artisan_id=${artisanId}`),
      fetch(`/api/bookings?artisan_id=${artisanId}`),
      fetch(`/api/availability-services?artisan_id=${artisanId}`),
    ])

    const availJson = await availRes.json()
    const bookingsJson = await bookingsRes.json()
    const dsJson = await dsRes.json()

    const availData = availJson.data || []
    const bookingsData = bookingsJson.data || []
    const parsedDayServices = dsJson.data || {}

    setArtisan(artisanData)
    setServices(servicesData || [])
    setAvailability(availData)
    setExistingBookings(bookingsData)
    setDayServicesConfig(parsedDayServices)
    setLoading(false)
  }

  // ---- Helpers ----

  const cleanBio = (bio: string) => {
    let text = (bio || '').replace(/\s*<!--DS:[\s\S]*?-->/, '').trim()
    // Retirer les adresses physiques : "— Bâtiment X, Rés. Y, 13600 Ville."
    text = text.replace(/\s*—\s*[\s\S]*?\d{5}\s*[^.]*\./g, '.')
    // Retirer les mentions "(rayon XX km)" redondantes avec le header
    text = text.replace(/\s*\(rayon\s*\d+\s*km\)\s*/gi, ' ')
    // Retirer les doubles espaces et points
    text = text.replace(/\.\s*\./g, '.').replace(/\s+/g, ' ').trim()
    return text
  }

  const isServiceAvailableOnDay = (serviceId: string, dayOfWeek: number): boolean => {
    const dayConfig = dayServicesConfig[String(dayOfWeek)]
    // If no config for this day, or empty array = all services available
    if (!dayConfig || dayConfig.length === 0) return true
    // If this service is not referenced in ANY day's config, it's available everywhere
    // (only restrict services that have been explicitly configured)
    const allConfiguredServices = new Set(Object.values(dayServicesConfig).flat())
    if (!allConfiguredServices.has(serviceId)) return true
    return dayConfig.includes(serviceId)
  }

  const isDateAvailableForService = (date: Date, serviceId: string | null): boolean => {
    if (!isDateAvailable(date)) return false
    if (!serviceId) return true
    return isServiceAvailableOnDay(serviceId, date.getDay())
  }

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h === 0) return `${m}min`
    if (m === 0) return `${h}h`
    return `${h}h${m}`
  }

  const getTimeSlotsForDate = (date: Date) => {
    const dayOfWeek = date.getDay()
    const avail = availability.find((a) => a.day_of_week === dayOfWeek && a.is_available)
    if (!avail) return []

    const startParts = avail.start_time.substring(0, 5).split(':')
    const endParts = avail.end_time.substring(0, 5).split(':')
    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1])
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1])

    const slotDuration = selectedService?.duration_minutes || 60
    const slots: { time: string; available: boolean }[] = []
    const dateStr = date.toISOString().split('T')[0]
    const dayBookings = existingBookings.filter((b) => b.booking_date === dateStr)

    for (let m = startMinutes; m + slotDuration <= endMinutes; m += slotDuration) {
      const hours = Math.floor(m / 60)
      const mins = m % 60
      const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`

      const slotEnd = m + slotDuration
      const hasConflict = dayBookings.some((b) => {
        if (!b.booking_time) return false
        const bParts = b.booking_time.substring(0, 5).split(':')
        const bStart = parseInt(bParts[0]) * 60 + parseInt(bParts[1])
        const bEnd = bStart + (b.duration_minutes || 60)
        return m < bEnd && slotEnd > bStart
      })

      slots.push({ time: timeStr, available: !hasConflict })
    }

    return slots
  }

  const isDateAvailable = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date < today) return false
    const dayOfWeek = date.getDay()
    return availability.some((a) => a.day_of_week === dayOfWeek && a.is_available)
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
  }

  // Active days of the week (display order Mon→Sun)
  const activeDayIndices = useMemo(() => {
    const displayOrder = [1, 2, 3, 4, 5, 6, 0] // Mon=1 ... Sun=0
    if (!availability || availability.length === 0) return displayOrder // fallback: all 7 days
    const active = displayOrder.filter(dow =>
      availability.some(a => a.day_of_week === dow && a.is_available)
    )
    return active.length > 0 ? active : displayOrder // fallback if none active
  }, [availability])

  const dayHeaders = useMemo(() => {
    const labels: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Jeu', 5: 'Ven', 6: 'Sam', 0: 'Dim' }
    return activeDayIndices.map(dow => labels[dow])
  }, [activeDayIndices])

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    // Build week rows with only active day columns
    const rows: (Date | null)[][] = []
    const firstOfMonth = new Date(year, month, 1)
    const firstDow = firstOfMonth.getDay()
    const mondayOffset = firstDow === 0 ? -6 : 1 - firstDow
    let weekMonday = new Date(year, month, 1 + mondayOffset)

    while (rows.length < 7) {
      const row: (Date | null)[] = []
      for (const dow of activeDayIndices) {
        const dayOffset = dow === 0 ? 6 : dow - 1 // Mon=0 offset, Sun=6 offset
        const date = new Date(weekMonday.getFullYear(), weekMonday.getMonth(), weekMonday.getDate() + dayOffset)
        if (date.getMonth() === month) {
          row.push(date)
        } else {
          row.push(null)
        }
      }
      rows.push(row)
      weekMonday = new Date(weekMonday.getFullYear(), weekMonday.getMonth(), weekMonday.getDate() + 7)
      if (weekMonday.getMonth() > month || weekMonday.getFullYear() > year) break
    }

    return rows.flat()
  }, [currentMonth, activeDayIndices])

  const changeMonth = (dir: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + dir, 1))
  }

  // ---- Actions ----

  const selectMotif = (service: any) => {
    setUseCustomMotif(false)
    setCustomMotif('')
    setSelectedService(service)
    setSelectedPriceTier(null)
    setSelectedTreeWidth(null)
    setQuantityKnown(null)
    setQuantityValue('')
  }

  const toggleCustomMotif = () => {
    if (useCustomMotif) {
      setUseCustomMotif(false)
      setCustomMotif('')
    } else {
      setUseCustomMotif(true)
      setSelectedService(null)
    }
  }

  const goToCalendar = () => {
    if (!selectedService && !useCustomMotif) return
    // Si service avec paliers, un palier doit être sélectionné
    if (selectedService) {
      const priceInfo = getSmartPrice(selectedService.name, selectedService.price_ttc)
      if (priceInfo.type === 'tiered' && !selectedPriceTier) return
      if (selectedPriceTier?.widths && !selectedTreeWidth) return
      if ((priceInfo.type === 'per_sqm' || priceInfo.type === 'per_ml') && quantityKnown === null) return
    }
    setStep('calendar')
    setSelectedDate(null)
    setSelectedSlot(null)

    // Pre-fill with connected user data if available
    if (connectedUser) {
      const meta = connectedUser.user_metadata || {}
      const addressParts = [meta.address, meta.postal_code, meta.city].filter(Boolean)
      setBookingForm({
        name: meta.full_name || '',
        email: connectedUser.email || '',
        phone: meta.phone || '',
        address: addressParts.join(', '),
        notes: '',
        cgu: false,
      })
    } else {
      setBookingForm({ name: '', email: '', phone: '', address: '', notes: '', cgu: false })
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const selectDate = (date: Date) => {
    setSelectedDate(date)
    setSelectedSlot(null)
  }

  const submitBooking = async () => {
    if (!selectedDate || !selectedSlot || !bookingForm.name || !bookingForm.phone || !bookingForm.cgu) return
    setSubmitting(true)
    setBookingError(null)

    const dateStr = selectedDate.toISOString().split('T')[0]

    // Determine service list (multi or single)
    const multiMode = selectedServices.length > 0
    const serviceList = multiMode ? selectedServices : (selectedService ? [selectedService] : [])
    const mainService = serviceList[0] || selectedService

    // Compute combined price estimate
    let totalMin = 0, totalMax = 0
    for (const svc of serviceList) {
      const { minVal, maxVal } = getServiceEstimate(svc, serviceQuantities[svc.id] || '')
      totalMin += minVal
      totalMax += maxVal
    }

    // Combined notes
    const multiNote = multiMode
      ? `Services: ${serviceList.map(s => {
          const qty = serviceQuantities[s.id]
          const t = parseServiceTag(s)
          const unitLbl = t ? (UNIT_LABELS[t.unit] || '') : ''
          return qty ? `${s.name} (${qty} ${unitLbl})` : s.name
        }).join(', ')}. ` : ''
    const singleNotes = `${useCustomMotif ? `Motif: ${customMotif}. ` : ''}${selectedPriceTier ? `Arbre hauteur ${selectedPriceTier.label}. ` : ''}${selectedService && (() => { const pi = getSmartPrice(selectedService.name, selectedService.price_ttc); if (pi.type !== 'per_sqm' && pi.type !== 'per_ml') return ''; const unit = pi.type === 'per_ml' ? 'ml' : 'm²'; return quantityKnown === false ? `Superficie à mesurer sur place. ` : quantityValue ? `${pi.type === 'per_ml' ? 'Linéaire' : 'Superficie'}: ${quantityValue}${unit}. ` : '' })() || ''}`

    const estimNote = totalMax > 0 ? `Estimation: ${totalMin.toLocaleString(dateFmtLocale)}–${totalMax.toLocaleString(dateFmtLocale)}€. ` : ''

    const insertData: any = {
      artisan_id: artisan.id,
      status: 'pending',
      booking_date: dateStr,
      booking_time: selectedSlot,
      duration_minutes: Math.min(serviceList.reduce((sum, s) => sum + (s.duration_minutes || 60), 0) || 60, 480),
      address: bookingForm.address || 'A definir',
      notes: `${multiNote}${singleNotes}${estimNote}Client: ${bookingForm.name} | Tel: ${bookingForm.phone} | Email: ${bookingForm.email || '-'} | ${bookingForm.notes || ''}`.substring(0, 2000),
      price_ht: totalMin || mainService?.price_ht || 0,
      price_ttc: totalMax || mainService?.price_ttc || 0,
    }

    // Link booking to connected client account
    if (connectedUser?.id) {
      insertData.client_id = connectedUser.id
    }

    if (mainService) {
      insertData.service_id = mainService.id
    }

    // Get auth token for API call
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setBookingError('Vous devez être connecté pour réserver. Veuillez vous connecter.')
      setSubmitting(false)
      return
    }

    // Use API route to bypass RLS
    const bookingRes = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(insertData),
    })
    const bookingJson = await bookingRes.json()

    if (!bookingJson.error && bookingJson.data) {
      router.push(`/confirmation?id=${bookingJson.data.id}`)
    } else {
      const errMsg = typeof bookingJson.error === 'string' ? bookingJson.error : 'Erreur lors de la réservation. Veuillez réessayer.'
      setBookingError(errMsg)
    }

    setSubmitting(false)
  }

  // ---- Derived ----

  const availableSlots = selectedDate ? getTimeSlotsForDate(selectedDate) : []
  const canSubmitBooking =
    selectedDate &&
    selectedSlot &&
    bookingForm.name.trim() !== '' &&
    bookingForm.phone.trim() !== '' &&
    bookingForm.cgu

  // ---- Loading / Not Found ----

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-500">Chargement du profil...</p>
        </div>
      </div>
    )
  }

  if (!artisan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Artisan non trouv&eacute;</h1>
          <a href="/recherche" className="text-yellow hover:underline">
            Retour &agrave; la recherche
          </a>
        </div>
      </div>
    )
  }

  const initials = getArtisanInitials(artisan.company_name || '')

  // =============================================
  // STEP: PROFILE
  // =============================================
  if (step === 'profile') {
    return (
      <div className="min-h-screen bg-warm-gray py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-text-muted hover:text-yellow transition mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour
          </button>

          {/* Header Card with gradient banner */}
          <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border-[1.5px] border-[#EFEFEF] overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-yellow to-yellow-light p-8">
              <div className="flex flex-col sm:flex-row items-start gap-6">
                {artisan.profile_photo_url ? (
                  <Image
                    src={artisan.profile_photo_url}
                    alt={artisan.company_name}
                    width={96}
                    height={96}
                    className="w-24 h-24 rounded-full object-cover shadow-lg flex-shrink-0 border-4 border-white"
                  />
                ) : (
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-3xl font-bold text-yellow shadow-lg flex-shrink-0">
                    {initials}
                  </div>
                )}
                <div className="flex-1 text-white">
                  <h1 className="font-display text-3xl font-black mb-2 tracking-[-0.03em]">{artisan.company_name}</h1>
                  {/* Online status badge */}
                  {(() => {
                    const lastSeen = artisan.last_seen_at ? new Date(artisan.last_seen_at) : null
                    const now = new Date()
                    const diffMin = lastSeen ? (now.getTime() - lastSeen.getTime()) / 60000 : Infinity
                    if (diffMin < 15) return <span className="inline-flex items-center gap-1.5 text-xs font-semibold mb-2 bg-green-500/20 text-green-300 px-2.5 py-1 rounded-full"><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />{isPt ? 'Online' : 'En ligne'}</span>
                    if (diffMin < 1440) return <span className="inline-flex items-center gap-1.5 text-xs font-semibold mb-2 bg-white/10 text-white/70 px-2.5 py-1 rounded-full"><span className="w-2 h-2 bg-gray-400 rounded-full" />{isPt ? 'Ativo recentemente' : 'Actif récemment'}</span>
                    return null
                  })()}
                  <div className="flex flex-wrap items-center gap-4 mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 fill-white" />
                      <span className="text-xl font-semibold">{artisan.rating_avg || '5.0'}</span>
                      <span className="opacity-90">({artisan.rating_count || 0} {t('avis', 'avaliações')})</span>
                    </div>
                    {artisan.verified && (
                      <span className="bg-white text-yellow px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                        <Check className="w-4 h-4" /> {t('Vérifié', 'Verificado')}
                      </span>
                    )}
                    <button
                      onClick={async () => {
                        try {
                          const { supabase: sb } = await import('@/lib/supabase')
                          const { data: { session } } = await sb.auth.getSession()
                          if (!session) { window.location.href = '/fr/login'; return }
                          if (isFavorited) {
                            await fetch(`/api/favorites?artisan_id=${artisan.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } })
                            setIsFavorited(false)
                          } else {
                            await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ artisan_id: artisan.id }) })
                            setIsFavorited(true)
                          }
                        } catch { /* silent */ }
                      }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition ${isFavorited ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}
                      title={isFavorited ? (isPt ? 'Remover dos favoritos' : 'Retirer des favoris') : (isPt ? 'Adicionar aos favoritos' : 'Ajouter aux favoris')}
                    >
                      {isFavorited ? '❤️' : '🤍'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 opacity-90">
                    <MapPin className="w-4 h-4" />
                    <span>
                      {artisan.city || (isPt ? 'Porto' : 'La Ciotat')} - {artisan.zone_radius_km || 30} {t('km de rayon d\'intervention', 'km de raio de atuação')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8">
              {/* About */}
              <div className="mb-8">
                <h2 className="font-display text-2xl font-black text-dark mb-4 tracking-[-0.02em]">{t('À propos', 'Sobre')}</h2>
                <p className="text-mid leading-relaxed">
                  {cleanBio(artisan.bio) || t('Artisan professionnel disponible pour vos projets.', 'Profissional disponível para os seus projetos.')}
                </p>
              </div>

              {/* Carnet de visite */}
              <div className="mb-8">
                <button
                  onClick={() => setShowBusinessCard(!showBusinessCard)}
                  className="w-full flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                      <FileText className="w-5 h-5 text-yellow" />
                    </div>
                    <h2 className="font-display text-2xl font-black text-dark tracking-[-0.02em] group-hover:text-yellow transition">{t('Carnet de visite', 'Cartão de visita')}</h2>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${showBusinessCard ? 'rotate-180' : ''}`} />
                </button>

                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showBusinessCard ? 'max-h-[800px] opacity-100 mt-6' : 'max-h-0 opacity-0'}`}>
                  <div className="bg-gradient-to-br from-gray-50 to-amber-50/30 rounded-2xl border border-gray-100 p-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Nom de l'entreprise */}
                      {artisan.company_name && (
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5">
                            <Building2 className="w-4.5 h-4.5 text-yellow" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t('Entreprise', 'Empresa')}</div>
                            <div className="font-semibold text-gray-900">{artisan.company_name}</div>
                          </div>
                        </div>
                      )}

                      {/* Forme juridique */}
                      {artisan.legal_form && (
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5">
                            <FileText className="w-4.5 h-4.5 text-yellow" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t('Forme juridique', 'Forma jurídica')}</div>
                            <div className="font-semibold text-gray-900">{artisan.legal_form}</div>
                          </div>
                        </div>
                      )}

                      {/* SIRET */}
                      {artisan.siret && (
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5">
                            <Shield className="w-4.5 h-4.5 text-yellow" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t('SIRET', 'NIF')}</div>
                            <div className="font-semibold text-gray-900 font-mono text-sm">{artisan.siret}</div>
                          </div>
                        </div>
                      )}

                      {/* Code NAF */}
                      {artisan.naf_code && (
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5">
                            <FileText className="w-4.5 h-4.5 text-yellow" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t('Code NAF', 'Código CAE')}</div>
                            <div className="font-semibold text-gray-900">{artisan.naf_code}{artisan.naf_label ? ` — ${artisan.naf_label}` : ''}</div>
                          </div>
                        </div>
                      )}

                      {/* Adresse */}
                      {(artisan.company_address || artisan.company_city) && (
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5">
                            <MapPin className="w-4.5 h-4.5 text-yellow" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t('Adresse', 'Morada')}</div>
                            <div className="font-semibold text-gray-900 text-sm">
                              {artisan.company_address && <span>{artisan.company_address}<br /></span>}
                              {artisan.company_postal_code && <span>{artisan.company_postal_code} </span>}
                              {artisan.company_city}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Téléphone */}
                      {artisan.phone && (
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5">
                            <Phone className="w-4.5 h-4.5 text-yellow" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t('Téléphone', 'Telefone')}</div>
                            <a href={`tel:${artisan.phone.replace(/\s/g, '')}`} className="font-semibold text-gray-900 hover:text-yellow transition">
                              {artisan.phone}
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Email */}
                      {artisan.email && (
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5">
                            <Mail className="w-4.5 h-4.5 text-yellow" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Email</div>
                            <a href={`mailto:${artisan.email}`} className="font-semibold text-gray-900 hover:text-yellow transition text-sm break-all">
                              {artisan.email}
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Zone d'intervention */}
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5">
                          <Search className="w-4.5 h-4.5 text-yellow" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t('Zone d\'intervention', 'Zona de atuação')}</div>
                          <div className="font-semibold text-gray-900">{artisan.company_city || artisan.city || (isPt ? 'Porto' : 'La Ciotat')} — {t('rayon', 'raio')} {artisan.zone_radius_km || 30} km</div>
                        </div>
                      </div>
                    </div>

                    {/* Photos / Réalisations dans le carnet de visite */}
                    {artisan.portfolio_photos && Array.isArray(artisan.portfolio_photos) && artisan.portfolio_photos.length > 0 && (
                      <div className="mt-6 pt-5 border-t border-gray-200/60">
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          📸 {t('Réalisations', 'Realizações')}
                          <span className="text-xs text-gray-500 font-normal">({artisan.portfolio_photos.length} photo{artisan.portfolio_photos.length > 1 ? 's' : ''})</span>
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {artisan.portfolio_photos.slice(0, 6).map((photo: any, idx: number) => (
                            <div
                              key={photo.id || idx}
                              className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group cursor-pointer"
                              onClick={() => window.open(photo.url, '_blank')}
                            >
                              <Image
                                src={photo.url}
                                alt={photo.title || 'Réalisation'}
                                fill
                                sizes="(max-width: 768px) 50vw, 25vw"
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 translate-y-full group-hover:translate-y-0 transition-transform">
                                <div className="text-white text-xs font-semibold truncate">{photo.title || 'Réalisation'}</div>
                                {photo.category && <div className="text-gray-300 text-[10px]">{photo.category}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                        {artisan.portfolio_photos.length > 6 && (
                          <p className="text-sm text-gray-500 mt-2.5 text-center">+ {artisan.portfolio_photos.length - 6} {t('autres réalisations', 'outras realizações')}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <ServicesGrid
                services={services}
                selectedServices={selectedServices}
                setSelectedServices={setSelectedServices}
                serviceQuantities={serviceQuantities}
                setServiceQuantities={setServiceQuantities}
                showEstimateModal={showEstimateModal}
                setShowEstimateModal={setShowEstimateModal}
                locale={locale}
                isPt={isPt}
                dateFmtLocale={dateFmtLocale}
                connectedUser={connectedUser}
                setSelectedService={setSelectedService}
                setSelectedDate={setSelectedDate}
                setSelectedSlot={setSelectedSlot}
                setBookingForm={setBookingForm}
                setStep={setStep}
                t={t}
              />

              {/* ── Avis Clients (style Google) ── */}
              <AvisSection artisanId={artisan.id} locale={dateFmtLocale} ratingAvg={artisan.rating_avg} ratingCount={artisan.rating_count} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =============================================
  // STEP: MOTIF (Choix du motif d'intervention)
  // =============================================
  if (step === 'motif') {
    const hasSelection = selectedService !== null || (useCustomMotif && customMotif.trim() !== '')

    return (
      <div className="min-h-screen bg-warm-gray pb-32">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-2 text-sm text-text-muted">
              <Link href="/" className="hover:text-yellow transition flex items-center gap-1">
                <Home className="w-3.5 h-3.5" />
                Accueil
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link href="/recherche" className="hover:text-yellow transition flex items-center gap-1">
                <Search className="w-3.5 h-3.5" />
                Recherche
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-dark font-medium">Choisir le motif</span>
            </nav>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page header */}
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl md:text-4xl font-black text-dark mb-2 tracking-[-0.03em]">
              {'\uD83D\uDD27'} Choisissez votre motif d&apos;intervention
            </h1>
            <p className="text-text-muted text-lg">
              S&eacute;lectionnez le service souhait&eacute; pour continuer votre r&eacute;servation
            </p>
          </div>

          {/* Artisan recap card */}
          <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] p-4 mb-8 flex items-center gap-4 max-w-lg mx-auto">
            <div className="w-14 h-14 bg-yellow rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-bold text-dark truncate">{artisan.company_name}</h3>
              <p className="text-sm text-text-muted truncate">
                {artisan.categories?.[0] || 'Artisan professionnel'}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Star className="w-4 h-4 fill-[#FFC107] text-yellow" />
              <span className="font-semibold text-sm">{artisan.rating_avg || '5.0'}</span>
            </div>
          </div>

          {/* Motifs grid — élagage dédupliqué en 1 seule carte */}
          {(() => {
            const ELAGAGE_KW = ['élagage', 'elagage', 'elaguage']
            const isElag = (name: string) => ELAGAGE_KW.some(k => name.toLowerCase().includes(k))
            let elagSeen = false
            const displayedServices = services.reduce<any[]>((acc, svc) => {
              if (isElag(svc.name)) {
                if (!elagSeen) {
                  elagSeen = true
                  acc.push({ ...svc, name: 'Élagage arbre', description: 'Taille et soin de vos arbres selon leur hauteur et envergure de feuillage.' })
                }
              } else {
                acc.push(svc)
              }
              return acc
            }, [])

            return (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {displayedServices.map((service) => {
              const isSelected = selectedService?.id === service.id && !useCustomMotif
              const priceInfo = getSmartPrice(service.name, service.price_ttc)
              const needsQty = priceInfo.type === 'per_sqm' || priceInfo.type === 'per_ml'
              const qtyUnit = priceInfo.type === 'per_ml' ? 'mètres linéaires' : 'm²'
              return (
                <div key={service.id} className="flex flex-col gap-2">
                  <div
                    onClick={() => selectMotif(service)}
                    className={`relative bg-white rounded-2xl p-5 cursor-pointer transition-all duration-200 border-[1.5px] ${
                      isSelected
                        ? 'border-yellow bg-warm-gray shadow-lg -translate-y-1'
                        : 'border-[#EFEFEF] hover:border-yellow hover:shadow-[0_4px_20px_rgba(255,214,0,0.15)] hover:-translate-y-0.5'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}

                    <div className="text-3xl mb-3">{getServiceEmoji(service.name)}</div>
                    <h3 className="font-bold text-dark mb-1">{service.name}</h3>
                    <p className="text-sm text-text-muted mb-4 line-clamp-2">{service.description}</p>

                    {/* Smart price */}
                    <div className="pt-3 border-t border-gray-100">
                      {priceInfo.type === 'devis' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-full">
                          📋 {isPt ? 'Sob orçamento — entraremos em contacto' : 'Sur devis — nous vous contacterons'}
                        </span>
                      )}
                      {priceInfo.type === 'per_sqm' && (
                        <span className="text-sm font-semibold text-yellow">📐 {priceInfo.label}</span>
                      )}
                      {priceInfo.type === 'per_ml' && (
                        <span className="text-sm font-semibold text-yellow">📏 {priceInfo.label}</span>
                      )}
                      {priceInfo.type === 'hourly' && (
                        <span className="text-sm font-semibold text-yellow">⏱ {priceInfo.label}</span>
                      )}
                      {priceInfo.type === 'tiered' && (
                        <span className="text-sm font-semibold text-yellow">🌳 Tarif selon hauteur & envergure</span>
                      )}
                      {priceInfo.type === 'fixed' && (
                        <span className="text-lg font-bold text-yellow">{priceInfo.label}</span>
                      )}
                    </div>

                    {/* Jour dispo */}
                    {Object.keys(dayServicesConfig).some(k => dayServicesConfig[k]?.length > 0) && (
                      <div className="mt-2 pt-2 border-t border-gray-50">
                        <div className="flex flex-wrap gap-1">
                          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((dayName, i) => {
                            const dayNum = i === 6 ? 0 : i + 1
                            const avail = availability.find(a => a.day_of_week === dayNum && a.is_available)
                            const serviceOk = isServiceAvailableOnDay(service.id, dayNum)
                            return (
                              <span key={dayNum} className={`text-[10px] px-1.5 py-0.5 rounded ${avail && serviceOk ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {dayName}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sélecteur hauteur × largeur (élagage) */}
                  {isSelected && priceInfo.type === 'tiered' && priceInfo.tiers && (
                    <div className="bg-amber-50 border-2 border-yellow rounded-xl p-4 flex flex-col gap-4">

                      {/* ── Étape 1 : Hauteur ── */}
                      <div>
                        <p className="text-sm font-bold text-gray-900 mb-3">📏 Hauteur de l'arbre</p>
                        <div className="flex flex-col gap-2">
                          {priceInfo.tiers.map((tier) => (
                            <button
                              key={tier.label}
                              onClick={(e) => { e.stopPropagation(); setSelectedPriceTier(tier); setSelectedTreeWidth(null) }}
                              className={`flex items-center justify-between px-4 py-2.5 rounded-lg border-2 transition text-sm font-semibold ${
                                selectedPriceTier?.label === tier.label
                                  ? 'border-yellow bg-yellow text-gray-900'
                                  : 'border-gray-200 bg-white hover:border-yellow text-gray-700'
                              }`}
                            >
                              <span>🌳 {tier.label}</span>
                              {selectedPriceTier?.label !== tier.label && (
                                <span className="text-xs text-gray-500 font-normal">Sélectionner</span>
                              )}
                            </button>
                          ))}
                        </div>
                        {!selectedPriceTier && (
                          <p className="text-xs text-amber-700 mt-2">⚠️ Sélectionnez une hauteur pour continuer</p>
                        )}
                      </div>

                      {/* ── Étape 2 : Largeur/Envergure (affiché après hauteur) ── */}
                      {selectedPriceTier?.widths && (
                        <div>
                          <p className="text-sm font-bold text-gray-900 mb-3">📐 Envergure du feuillage (largeur)</p>
                          <div className="flex flex-col gap-2">
                            {selectedPriceTier.widths.map((w) => (
                              <button
                                key={w.label}
                                onClick={(e) => { e.stopPropagation(); setSelectedTreeWidth(w) }}
                                className={`flex items-center justify-between px-4 py-2.5 rounded-lg border-2 transition text-sm font-semibold ${
                                  selectedTreeWidth?.label === w.label
                                    ? 'border-yellow bg-yellow text-gray-900'
                                    : 'border-gray-200 bg-white hover:border-yellow text-gray-700'
                                }`}
                              >
                                <span>🌿 {w.label}</span>
                                <span className={`font-bold ${selectedTreeWidth?.label === w.label ? 'text-gray-900' : 'text-yellow'}`}>
                                  {w.price}
                                </span>
                              </button>
                            ))}
                          </div>
                          {!selectedTreeWidth && (
                            <p className="text-xs text-amber-700 mt-2">⚠️ Sélectionnez l'envergure pour obtenir le tarif</p>
                          )}
                        </div>
                      )}

                    </div>
                  )}

                  {/* ── Widget superficie / mètres linéaires ── */}
                  {isSelected && needsQty && (
                    <div className="bg-amber-50 border-2 border-yellow rounded-xl p-4 flex flex-col gap-3">
                      <p className="text-sm font-bold text-gray-900">
                        📐 Connaissez-vous la superficie à traiter ?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setQuantityKnown(true) }}
                          className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition ${
                            quantityKnown === true
                              ? 'border-yellow bg-yellow text-gray-900'
                              : 'border-gray-200 bg-white hover:border-yellow text-gray-700'
                          }`}
                        >
                          ✅ Oui, je connais
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setQuantityKnown(false); setQuantityValue('') }}
                          className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition ${
                            quantityKnown === false
                              ? 'border-gray-600 bg-gray-600 text-white'
                              : 'border-gray-200 bg-white hover:border-gray-400 text-gray-700'
                          }`}
                        >
                          ❌ Non / à estimer
                        </button>
                      </div>

                      {quantityKnown === true && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={quantityValue}
                            onChange={(e) => setQuantityValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="ex: 150"
                            className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-yellow focus:outline-none text-sm"
                          />
                          <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">{qtyUnit}</span>
                        </div>
                      )}

                      {quantityKnown === true && quantityValue && Number(quantityValue) > 0 && (
                        <div className="bg-white border-2 border-yellow rounded-lg px-4 py-3">
                          <p className="text-xs text-gray-500 mb-1">💰 Estimation du prix</p>
                          <p className="text-lg font-bold text-gray-900">
                            {calculateEstimatedPrice(priceInfo, Number(quantityValue))}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">* Estimation indicative. Le montant final dépendra des conditions d&apos;accès et de la complexité des travaux.</p>
                        </div>
                      )}

                      {quantityKnown === false && (
                        <p className="text-sm text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-200">
                          Pas de problème, l'artisan mesurera et vous confirmera le prix sur place. ✓
                        </p>
                      )}

                      {quantityKnown === null && (
                        <p className="text-xs text-amber-700">⚠️ Répondez pour continuer vers le calendrier</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* "Autre intervention" card */}
            <div
              onClick={toggleCustomMotif}
              className={`bg-white rounded-xl p-5 cursor-pointer transition-all duration-200 border-2 border-dashed flex flex-col ${
                useCustomMotif
                  ? 'border-yellow bg-warm-gray shadow-lg -translate-y-1'
                  : 'border-gray-300 hover:border-yellow hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              {useCustomMotif && (
                <div className="absolute top-3 right-3 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <div className="text-3xl mb-3">{'\u2795'}</div>
              <h3 className="font-bold text-gray-900 mb-1">Autre intervention</h3>
              <p className="text-sm text-gray-500 mb-4">D&eacute;crivez votre besoin ci-dessous</p>
              {useCustomMotif && (
                <textarea
                  value={customMotif}
                  onChange={(e) => setCustomMotif(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="D&eacute;crivez votre probl&egrave;me ou le service souhait&eacute;..."
                  rows={3}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-yellow focus:outline-none transition resize-none text-sm mt-auto"
                />
              )}
            </div>
          </div>
            )
          })()}
        </div>

        {/* Fixed bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              {hasSelection ? (
                <div>
                  <p className="text-sm text-gray-500">Motif s&eacute;lectionn&eacute;</p>
                  <p className="font-semibold text-gray-900 truncate">
                    {useCustomMotif
                      ? `Autre : ${customMotif || '...'}`
                      : selectedService?.name}
                  </p>
                  {selectedService && (() => {
                    const pi = getSmartPrice(selectedService.name, selectedService.price_ttc)
                    const isQty = pi.type === 'per_sqm' || pi.type === 'per_ml'
                    const unit = pi.type === 'per_ml' ? 'ml' : 'm²'
                    let label = pi.label
                    if (selectedPriceTier) {
                      label = `🌳 ${selectedPriceTier.label}${selectedTreeWidth ? ` · ${selectedTreeWidth.label} — ${selectedTreeWidth.price}` : ' — ?'}`
                    } else if (isQty && quantityKnown === true && quantityValue && Number(quantityValue) > 0) {
                      const est = calculateEstimatedPrice(pi, Number(quantityValue))
                      label = `📐 ${quantityValue} ${unit} → ${est}`
                    } else if (isQty && quantityKnown === false) {
                      label = `📐 ${pi.label} · superficie à mesurer sur place`
                    }
                    return <p className="text-sm text-yellow font-semibold">{label}</p>
                  })()}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Aucun motif s&eacute;lectionn&eacute;</p>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => {
                  setStep('profile')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="px-5 py-2.5 bg-white text-gray-600 border-2 border-gray-200 rounded-lg font-semibold hover:bg-gray-50 transition text-sm"
              >
                Annuler
              </button>
              <button
                onClick={goToCalendar}
                disabled={!hasSelection}
                className="px-6 py-2.5 bg-yellow hover:bg-yellow-light text-gray-900 rounded-lg font-semibold transition text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Continuer vers le calendrier
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =============================================
  // STEP: CALENDAR (Choisissez votre créneau)
  // =============================================
  if (step === 'calendar') {
    return (
      <div className="min-h-screen bg-warm-gray">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-2 text-sm text-text-muted">
              <Link href="/" className="hover:text-yellow transition flex items-center gap-1">
                <Home className="w-3.5 h-3.5" />
                Accueil
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <button
                onClick={() => {
                  setStep('motif')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="hover:text-yellow transition"
              >
                Choisir le motif
              </button>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-dark font-medium">Calendrier</span>
            </nav>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page header */}
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl md:text-4xl font-black text-dark mb-2 tracking-[-0.03em]">
              {'📅'} Choisissez votre cr&eacute;neau
            </h1>
            <p className="text-text-muted text-lg">
              S&eacute;lectionnez une date et un horaire disponible
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left column: Calendar + Time slots (2/3) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Calendar */}
              <div className="bg-white rounded-2xl p-6 border-[1.5px] border-[#EFEFEF]">
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => changeMonth(-1)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h3 className="font-display font-bold text-xl text-dark">
                    {getMonthName(currentMonth.getMonth(), dateFmtLocale)} {currentMonth.getFullYear()}
                  </h3>
                  <button
                    onClick={() => changeMonth(1)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: `repeat(${activeDayIndices.length}, 1fr)` }}>
                  {dayHeaders.map((d) => (
                    <div key={d} className="text-center text-sm font-semibold text-gray-500 py-2">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${activeDayIndices.length}, 1fr)` }}>
                  {calendarDays.map((date, i) => {
                    if (!date) return <div key={`empty-${i}`} />
                    const available = isDateAvailableForService(date, selectedService?.id || null)
                    const isSelected = selectedDate?.toDateString() === date.toDateString()
                    const isTodayDate = isToday(date)

                    return (
                      <button
                        key={date.toISOString()}
                        onClick={() => available && selectDate(date)}
                        disabled={!available}
                        className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-yellow text-gray-900 shadow-md font-bold'
                            : available
                              ? isTodayDate
                                ? 'bg-blue-100 text-blue-700 hover:bg-yellow hover:text-gray-900 font-semibold'
                                : 'hover:bg-amber-100 text-gray-700'
                              : 'text-gray-300 cursor-not-allowed line-through'
                        }`}
                      >
                        {date.getDate()}
                      </button>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></span>
                    Aujourd&apos;hui
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-yellow"></span>
                    S&eacute;lectionn&eacute;
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-gray-200"></span>
                    Indisponible
                  </span>
                </div>
              </div>

              {/* Time slots */}
              <div className="bg-white rounded-2xl p-6 border-[1.5px] border-[#EFEFEF]">
                {selectedDate ? (
                  <>
                    <h3 className="font-bold text-lg mb-1">
                      Cr&eacute;neaux du {getDayName(selectedDate.getDay(), dateFmtLocale)} {selectedDate.getDate()}{' '}
                      {getMonthName(selectedDate.getMonth(), dateFmtLocale)}
                    </h3>
                    {selectedPriceTier && (
                      <p className="text-sm text-amber-700 font-semibold mb-3">
                        🌳 Élagage {selectedPriceTier.label}{selectedTreeWidth ? ` · ${selectedTreeWidth.label} — ${selectedTreeWidth.price}` : ''}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 mb-5">
                      S&eacute;lectionnez l&apos;heure de d&eacute;but d&apos;intervention
                    </p>

                    {availableSlots.length > 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot.time}
                            onClick={() => slot.available && setSelectedSlot(slot.time)}
                            disabled={!slot.available}
                            className={`p-3 rounded-xl text-center font-semibold text-sm transition-all ${
                              !slot.available
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                                : selectedSlot === slot.time
                                  ? 'bg-yellow text-dark shadow-md'
                                  : 'bg-warm-gray hover:bg-amber-100 text-mid border-[1.5px] border-[#E0E0E0] hover:border-yellow'
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">Aucun cr&eacute;neau disponible</p>
                        <p className="text-sm">Tous les cr&eacute;neaux sont pris ce jour</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-16 text-gray-500">
                    <Calendar className="w-16 h-16 mx-auto mb-4 opacity-40" />
                    <p className="font-medium text-lg">S&eacute;lectionnez une date</p>
                    <p className="text-sm">Choisissez un jour disponible dans le calendrier ci-dessus</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right column: Booking summary sidebar (1/3) */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 space-y-6">
                {/* Artisan card */}
                <div className="bg-white rounded-2xl border-[1.5px] border-yellow p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-yellow rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display font-bold text-dark truncate">{artisan.company_name}</h4>
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="w-3.5 h-3.5 fill-[#FFC107] text-yellow" />
                        <span className="font-medium">{artisan.rating_avg || '5.0'}</span>
                        <span className="text-gray-500">({artisan.rating_count || 0})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary card */}
                <div className="bg-white rounded-2xl p-5 border-[1.5px] border-[#EFEFEF]">
                  <h4 className="font-display font-bold text-dark mb-4">R&eacute;capitulatif</h4>
                  <div className="space-y-3 text-sm">

                    {/* ── Services détaillés ── */}
                    {(() => {
                      const isMulti = selectedServices.length > 0
                      const serviceList = isMulti ? selectedServices : (selectedService ? [selectedService] : [])
                      if (serviceList.length === 0 && !useCustomMotif) {
                        return (
                          <div className="flex justify-between">
                            <span className="text-text-muted">Service</span>
                            <span className="font-medium">-</span>
                          </div>
                        )
                      }
                      if (useCustomMotif) {
                        return (
                          <div className="flex justify-between">
                            <span className="text-text-muted">Service</span>
                            <span className="font-medium text-right max-w-[65%]">Autre intervention{customMotif ? ` : ${customMotif}` : ''}</span>
                          </div>
                        )
                      }
                      return (
                        <div>
                          <span className="text-text-muted text-xs uppercase tracking-wider font-semibold">Service{serviceList.length > 1 ? 's' : ''}</span>
                          <div className="mt-2 space-y-2">
                            {serviceList.map(svc => {
                              const tag = parseServiceTag(svc)
                              const needsQty = tag ? ['m2', 'ml', 'arbre', 'tonne', 'unite', 'm3', 'kg', 'lot'].includes(tag.unit) : false
                              const qty = isMulti ? (serviceQuantities[svc.id] || '') : quantityValue
                              const unitLbl = tag ? (UNIT_LABELS[tag.unit] || tag.unit) : ''
                              const { minVal, maxVal } = getServiceEstimate(svc, qty)
                              const isDevis = tag ? (tag.min === 0 && tag.max === 0) : false

                              // Build detail text
                              let detail = ''
                              if (!isMulti && selectedPriceTier) {
                                detail = `Hauteur ${selectedPriceTier.label}`
                              } else if (!isMulti && selectedTreeWidth) {
                                detail = selectedTreeWidth.label
                              } else if (needsQty && qty) {
                                detail = `${qty} ${unitLbl}`
                              } else if (!isMulti && quantityKnown === false) {
                                detail = 'À mesurer sur place'
                              }

                              return (
                                <div key={svc.id} className="bg-[#FAFAFA] rounded-lg px-3 py-2">
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-dark text-[13px] leading-tight">{getServiceEmoji(svc.name)} {svc.name}</p>
                                      {detail && <p className="text-[11px] text-gray-500 mt-0.5">{detail}</p>}
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      {isDevis ? (
                                        <span className="text-blue-600 text-xs font-semibold">{isPt ? 'Sob orçamento' : 'Sur devis'}</span>
                                      ) : minVal === maxVal ? (
                                        <span className="text-yellow font-bold text-xs">{minVal.toLocaleString(dateFmtLocale)} &euro;</span>
                                      ) : (
                                        <span className="text-yellow font-bold text-xs">{minVal.toLocaleString(dateFmtLocale)} – {maxVal.toLocaleString(dateFmtLocale)} &euro;</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}

                    <div className="flex justify-between">
                      <span className="text-gray-500">Date</span>
                      <span className="font-medium">
                        {selectedDate
                          ? `${selectedDate.getDate()} ${getMonthName(selectedDate.getMonth(), dateFmtLocale)} ${selectedDate.getFullYear()}`
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Heure</span>
                      <span className="font-medium">{selectedSlot || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Dur&eacute;e</span>
                      <span className="font-medium">
                        {(() => {
                          const isMulti = selectedServices.length > 0
                          const serviceList = isMulti ? selectedServices : (selectedService ? [selectedService] : [])
                          const totalMin = serviceList.reduce((sum, s) => sum + (s.duration_minutes || 60), 0)
                          return totalMin ? formatDuration(Math.min(totalMin, 480)) : '~1h'
                        })()}
                      </span>
                    </div>

                    {/* ── Total avec fourchette de prix ── */}
                    {(() => {
                      const isMulti = selectedServices.length > 0
                      const serviceList = isMulti ? selectedServices : (selectedService ? [selectedService] : [])
                      if (serviceList.length === 0 && !useCustomMotif) {
                        return (
                          <div className="border-t border-border pt-3 flex justify-between items-center">
                            <span className="text-text-muted font-medium">Total</span>
                            <span className="text-lg font-bold text-yellow">{isPt ? 'Sob orçamento' : 'Sur devis'}</span>
                          </div>
                        )
                      }
                      if (useCustomMotif) {
                        return (
                          <div className="border-t border-border pt-3 flex justify-between items-center">
                            <span className="text-text-muted font-medium">Total</span>
                            <span className="text-lg font-bold text-yellow">{isPt ? 'Sob orçamento' : 'Sur devis'}</span>
                          </div>
                        )
                      }
                      let totalMin = 0, totalMax = 0, hasDevis = false, hasUnknown = false
                      for (const svc of serviceList) {
                        const tag = parseServiceTag(svc)
                        if (tag && tag.min === 0 && tag.max === 0) { hasDevis = true; continue }
                        const needsQty = tag ? ['m2', 'ml', 'arbre', 'tonne', 'unite', 'm3', 'kg', 'lot'].includes(tag.unit) : false
                        const qty = isMulti ? (serviceQuantities[svc.id] || '') : quantityValue
                        if (needsQty && !qty) { hasUnknown = true; continue }
                        const { minVal, maxVal } = getServiceEstimate(svc, qty)
                        totalMin += minVal
                        totalMax += maxVal
                      }
                      const hasTotal = totalMin > 0 || totalMax > 0
                      return (
                        <div className="border-t border-border pt-3">
                          <div className="flex justify-between items-start">
                            <span className="text-text-muted font-medium text-xs">Total TTC</span>
                            <div className="text-right">
                              {hasTotal ? (
                                <>
                                  {totalMin === totalMax ? (
                                    <p className="text-xl font-bold text-yellow">{totalMin.toLocaleString(dateFmtLocale)} &euro;</p>
                                  ) : (
                                    <p className="text-lg font-bold text-yellow leading-tight">
                                      {totalMin.toLocaleString(dateFmtLocale)} – {totalMax.toLocaleString(dateFmtLocale)} &euro;
                                    </p>
                                  )}
                                  <p className="text-[10px] text-gray-400 mt-0.5">
                                    {hasUnknown || hasDevis ? 'Estimation partielle' : 'Estimation indicative'}
                                  </p>
                                </>
                              ) : (
                                <p className="text-lg font-bold text-yellow">{isPt ? 'Sob orçamento' : 'Sur devis'}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Client info form */}
                <BookingForm
                  bookingForm={bookingForm}
                  setBookingForm={setBookingForm}
                  addressSuggestions={addressSuggestions}
                  showAddrDropdown={showAddrDropdown}
                  setShowAddrDropdown={setShowAddrDropdown}
                  bookingError={bookingError}
                  submitting={submitting}
                  canSubmitBooking={canSubmitBooking}
                  connectedUser={connectedUser}
                  onSubmit={submitBooking}
                  fetchAddressSuggestions={fetchAddressSuggestions}
                  setStep={setStep}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
