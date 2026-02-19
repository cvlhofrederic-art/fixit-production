'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import {
  Star,
  MapPin,
  Check,
  Clock,
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  Mail,
  MessageSquare,
  Home,
  Search,
  X,
} from 'lucide-react'

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

// Mapping of service name keywords to emojis
function getServiceEmoji(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('plomb')) return '\uD83D\uDD27'
  if (lower.includes('electr') || lower.includes('électr')) return '\u26A1'
  if (lower.includes('serrur')) return '\uD83D\uDD11'
  if (lower.includes('chauff')) return '\uD83D\uDD25'
  if (lower.includes('vitr')) return '\uD83E\uDE9F'
  if (lower.includes('jardin') || lower.includes('vert') || lower.includes('tonte') || lower.includes('haie') || lower.includes('pelouse')) return '\uD83C\uDF33'
  if (lower.includes('nettoy') || lower.includes('menage') || lower.includes('ménage')) return '\uD83E\uDDF9'
  if (lower.includes('peintur')) return '\uD83C\uDFA8'
  if (lower.includes('carrel')) return '\uD83E\uDDF1'
  if (lower.includes('toiture') || lower.includes('toit')) return '\uD83C\uDFE0'
  if (lower.includes('démouss') || lower.includes('demouss')) return '\uD83C\uDF3F'
  return '\uD83D\uDD27'
}

function getArtisanInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

type Step = 'profile' | 'motif' | 'calendar'

export default function ArtisanProfilePage() {
  const params = useParams()
  const router = useRouter()
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
  const [selectedService, setSelectedService] = useState<any>(null)
  const [customMotif, setCustomMotif] = useState('')
  const [useCustomMotif, setUseCustomMotif] = useState(false)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchArtisan = async () => {
    // Artisan profile and services can still use anon key (public read)
    const { data: artisanData } = await supabase
      .from('profiles_artisan')
      .select('*')
      .eq('id', params.id)
      .single()

    const { data: servicesData } = await supabase
      .from('services')
      .select('*')
      .eq('artisan_id', params.id)
      .eq('active', true)

    // Use API routes (server-side service_role key) to bypass RLS
    const [availRes, bookingsRes, dsRes] = await Promise.all([
      fetch(`/api/availability?artisan_id=${params.id}`),
      fetch(`/api/bookings?artisan_id=${params.id}`),
      fetch(`/api/availability-services?artisan_id=${params.id}`),
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

  const cleanBio = (bio: string) => (bio || '').replace(/\s*<!--DS:[\s\S]*?-->/, '').trim()

  const isServiceAvailableOnDay = (serviceId: string, dayOfWeek: number): boolean => {
    const dayConfig = dayServicesConfig[String(dayOfWeek)]
    // If no config for this day, or empty array = all services available
    if (!dayConfig || dayConfig.length === 0) return true
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

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1

    const days: (Date | null)[] = []
    for (let i = 0; i < startPadding; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d))
    }
    return days
  }, [currentMonth])

  const changeMonth = (dir: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + dir, 1))
  }

  // ---- Actions ----

  const goToMotif = () => {
    setStep('motif')
    setSelectedService(null)
    setUseCustomMotif(false)
    setCustomMotif('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const selectMotif = (service: any) => {
    setUseCustomMotif(false)
    setCustomMotif('')
    setSelectedService(service)
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

    const dateStr = selectedDate.toISOString().split('T')[0]

    const insertData: any = {
      artisan_id: params.id,
      status: 'pending',
      booking_date: dateStr,
      booking_time: selectedSlot,
      duration_minutes: selectedService?.duration_minutes || 60,
      address: bookingForm.address || 'A definir',
      notes: `Client: ${bookingForm.name} | Tel: ${bookingForm.phone} | Email: ${bookingForm.email || '-'} | ${bookingForm.notes || ''}${useCustomMotif ? ` | Motif personnalisé: ${customMotif}` : ''}`,
      price_ht: selectedService?.price_ht || 0,
      price_ttc: selectedService?.price_ttc || 0,
    }

    // Link booking to connected client account
    if (connectedUser?.id) {
      insertData.client_id = connectedUser.id
    }

    if (selectedService) {
      insertData.service_id = selectedService.id
    }

    // Use API route to bypass RLS
    const bookingRes = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insertData),
    })
    const bookingJson = await bookingRes.json()

    if (!bookingJson.error && bookingJson.data) {
      router.push(`/confirmation?id=${bookingJson.data.id}`)
    } else {
      alert('Erreur lors de la réservation. Veuillez réessayer.')
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
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FFC107] border-t-transparent mx-auto"></div>
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
          <a href="/recherche" className="text-[#FFC107] hover:underline">
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
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-[#FFC107] transition mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour
          </button>

          {/* Header Card with gradient banner */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-[#FFC107] to-[#FFD54F] p-8">
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-3xl font-bold text-[#FFC107] shadow-lg flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 text-white">
                  <h1 className="text-3xl font-bold mb-2">{artisan.company_name}</h1>
                  <div className="flex flex-wrap items-center gap-4 mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 fill-white" />
                      <span className="text-xl font-semibold">{artisan.rating_avg || '5.0'}</span>
                      <span className="opacity-90">({artisan.rating_count || 0} avis)</span>
                    </div>
                    {artisan.verified && (
                      <span className="bg-white text-[#FFC107] px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                        <Check className="w-4 h-4" /> V&eacute;rifi&eacute;
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 opacity-90">
                    <MapPin className="w-4 h-4" />
                    <span>
                      {artisan.city || 'La Ciotat'} - {artisan.zone_radius_km || 30} km de rayon d&apos;intervention
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8">
              {/* About */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">&Agrave; propos</h2>
                <p className="text-gray-600 leading-relaxed">
                  {cleanBio(artisan.bio) || 'Artisan professionnel disponible pour vos projets.'}
                </p>
              </div>

              {/* Services */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">Services propos&eacute;s</h2>
                {services.length === 0 ? (
                  <p className="text-gray-600">Aucun service disponible pour le moment.</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {services.map((service) => (
                      <div
                        key={service.id}
                        onClick={() => {
                          setSelectedService(service)
                          setStep('motif')
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className="border-2 border-gray-200 rounded-xl p-6 transition cursor-pointer hover:border-[#FFC107] hover:shadow-md hover:-translate-y-0.5"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <span className="text-2xl">{getServiceEmoji(service.name)}</span>
                          <h3 className="font-bold text-lg">{service.name}</h3>
                        </div>
                        <p className="text-gray-600 text-sm mb-4">{service.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-gray-500 text-sm">
                            <Clock className="w-4 h-4" />
                            <span>~{formatDuration(service.duration_minutes)}</span>
                          </div>
                          <div className="text-lg font-bold text-[#FFC107]">{formatPrice(service.price_ttc)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* CTA to go to motif selection */}
                {services.length > 0 && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={goToMotif}
                      className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-3 rounded-lg font-semibold transition text-lg inline-flex items-center gap-2"
                    >
                      <Calendar className="w-5 h-5" />
                      Prendre rendez-vous
                    </button>
                  </div>
                )}
              </div>

              {/* Info section */}
              <div>
                <h2 className="text-2xl font-bold mb-4">Informations</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Tarif horaire</div>
                    <div className="text-lg font-semibold">
                      {artisan.hourly_rate ? `${artisan.hourly_rate}\u20AC/h` : 'Sur devis'}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Zone d&apos;intervention</div>
                    <div className="text-lg font-semibold">{artisan.zone_radius_km || 30} km</div>
                  </div>
                  {artisan.siret && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">SIRET</div>
                      <div className="text-lg font-semibold">{artisan.siret}</div>
                    </div>
                  )}
                  {availability.filter((a) => a.is_available).length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Horaires</div>
                      <div className="text-sm font-medium space-y-1">
                        {availability
                          .filter((a) => a.is_available)
                          .sort((a, b) => a.day_of_week - b.day_of_week)
                          .map((a) => (
                            <div key={a.day_of_week} className="flex justify-between">
                              <span>{DAY_NAMES[a.day_of_week]}</span>
                              <span className="text-[#FFC107] font-semibold">
                                {a.start_time?.substring(0, 5)} - {a.end_time?.substring(0, 5)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
      <div className="min-h-screen bg-gray-50 pb-32">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-2 text-sm text-gray-500">
              <Link href="/" className="hover:text-[#FFC107] transition flex items-center gap-1">
                <Home className="w-3.5 h-3.5" />
                Accueil
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link href="/recherche" className="hover:text-[#FFC107] transition flex items-center gap-1">
                <Search className="w-3.5 h-3.5" />
                Recherche
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-gray-900 font-medium">Choisir le motif</span>
            </nav>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              {'\uD83D\uDD27'} Choisissez votre motif d&apos;intervention
            </h1>
            <p className="text-gray-500 text-lg">
              S&eacute;lectionnez le service souhait&eacute; pour continuer votre r&eacute;servation
            </p>
          </div>

          {/* Artisan recap card */}
          <div className="bg-white rounded-xl border-2 border-gray-100 p-4 mb-8 flex items-center gap-4 max-w-lg mx-auto">
            <div className="w-14 h-14 bg-[#FFC107] rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 truncate">{artisan.company_name}</h3>
              <p className="text-sm text-gray-500 truncate">
                {artisan.categories?.[0] || 'Artisan professionnel'}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Star className="w-4 h-4 fill-[#FFC107] text-[#FFC107]" />
              <span className="font-semibold text-sm">{artisan.rating_avg || '5.0'}</span>
            </div>
          </div>

          {/* Motifs grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {services.map((service) => {
              const isSelected = selectedService?.id === service.id && !useCustomMotif
              return (
                <div
                  key={service.id}
                  onClick={() => selectMotif(service)}
                  className={`relative bg-white rounded-xl p-5 cursor-pointer transition-all duration-200 border-2 ${
                    isSelected
                      ? 'border-[#FFC107] bg-[#FFF9E6] shadow-lg -translate-y-1'
                      : 'border-gray-200 hover:border-[#FFC107] hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  {/* Selected checkmark */}
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div className="text-3xl mb-3">{getServiceEmoji(service.name)}</div>
                  <h3 className="font-bold text-gray-900 mb-1">{service.name}</h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{service.description}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      ⏱️ ~{formatDuration(service.duration_minutes)}
                    </span>
                    <span className="font-bold text-[#FFC107]">{formatPrice(service.price_ttc)}</span>
                  </div>
                  {/* Show available days indicator if dayServices config exists */}
                  {Object.keys(dayServicesConfig).some(k => dayServicesConfig[k]?.length > 0) && (
                    <div className="mt-2 pt-2 border-t border-gray-50">
                      <div className="flex flex-wrap gap-1">
                        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((dayName, i) => {
                          const dayNum = i === 6 ? 0 : i + 1
                          const avail = availability.find(a => a.day_of_week === dayNum && a.is_available)
                          const serviceOk = isServiceAvailableOnDay(service.id, dayNum)
                          return (
                            <span
                              key={dayNum}
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                avail && serviceOk
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-400'
                              }`}
                            >
                              {dayName}
                            </span>
                          )
                        })}
                      </div>
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
                  ? 'border-[#FFC107] bg-[#FFF9E6] shadow-lg -translate-y-1'
                  : 'border-gray-300 hover:border-[#FFC107] hover:shadow-md hover:-translate-y-0.5'
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
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none transition resize-none text-sm mt-auto"
                />
              )}
            </div>
          </div>
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
                  {selectedService && (
                    <p className="text-sm text-[#FFC107] font-semibold">
                      {formatPrice(selectedService.price_ttc)} &middot; ~{formatDuration(selectedService.duration_minutes)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Aucun motif s&eacute;lectionn&eacute;</p>
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
                className="px-6 py-2.5 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 rounded-lg font-semibold transition text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
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
      <div className="min-h-screen bg-gray-50">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-2 text-sm text-gray-500">
              <Link href="/" className="hover:text-[#FFC107] transition flex items-center gap-1">
                <Home className="w-3.5 h-3.5" />
                Accueil
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <button
                onClick={() => {
                  setStep('motif')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="hover:text-[#FFC107] transition"
              >
                Choisir le motif
              </button>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-gray-900 font-medium">Calendrier</span>
            </nav>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              {'📅'} Choisissez votre cr&eacute;neau
            </h1>
            <p className="text-gray-500 text-lg">
              S&eacute;lectionnez une date et un horaire disponible
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left column: Calendar + Time slots (2/3) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Calendar */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => changeMonth(-1)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h3 className="font-bold text-xl">
                    {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </h3>
                  <button
                    onClick={() => changeMonth(1)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                    <div key={d} className="text-center text-sm font-semibold text-gray-400 py-2">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
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
                            ? 'bg-[#FFC107] text-gray-900 shadow-md font-bold'
                            : available
                              ? isTodayDate
                                ? 'bg-blue-100 text-blue-700 hover:bg-[#FFC107] hover:text-gray-900 font-semibold'
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
                <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></span>
                    Aujourd&apos;hui
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#FFC107]"></span>
                    S&eacute;lectionn&eacute;
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-gray-200"></span>
                    Indisponible
                  </span>
                </div>
              </div>

              {/* Time slots */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                {selectedDate ? (
                  <>
                    <h3 className="font-bold text-lg mb-1">
                      Cr&eacute;neaux du {DAY_NAMES[selectedDate.getDay()]} {selectedDate.getDate()}{' '}
                      {MONTH_NAMES[selectedDate.getMonth()]}
                    </h3>
                    <p className="text-sm text-gray-500 mb-5">
                      Dur&eacute;e du service : {selectedService ? formatDuration(selectedService.duration_minutes) : '1h'}
                    </p>

                    {availableSlots.length > 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot.time}
                            onClick={() => slot.available && setSelectedSlot(slot.time)}
                            disabled={!slot.available}
                            className={`p-3 rounded-lg text-center font-semibold text-sm transition-all ${
                              !slot.available
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                                : selectedSlot === slot.time
                                  ? 'bg-[#FFC107] text-gray-900 shadow-md'
                                  : 'bg-gray-50 hover:bg-amber-100 text-gray-700 border border-gray-200 hover:border-[#FFC107]'
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-400">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">Aucun cr&eacute;neau disponible</p>
                        <p className="text-sm">Tous les cr&eacute;neaux sont pris ce jour</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-16 text-gray-400">
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
                <div className="bg-white rounded-2xl border-2 border-[#FFC107] p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-[#FFC107] rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 truncate">{artisan.company_name}</h4>
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="w-3.5 h-3.5 fill-[#FFC107] text-[#FFC107]" />
                        <span className="font-medium">{artisan.rating_avg || '5.0'}</span>
                        <span className="text-gray-400">({artisan.rating_count || 0})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary card */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-4">R&eacute;capitulatif</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Service</span>
                      <span className="font-medium text-right max-w-[60%] truncate">
                        {useCustomMotif ? 'Autre intervention' : selectedService?.name || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date</span>
                      <span className="font-medium">
                        {selectedDate
                          ? `${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
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
                        {selectedService ? formatDuration(selectedService.duration_minutes) : '~1h'}
                      </span>
                    </div>
                    <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                      <span className="text-gray-500 font-medium">Total</span>
                      <span className="text-2xl font-bold text-[#FFC107]">
                        {selectedService ? formatPrice(selectedService.price_ttc) : 'Sur devis'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Client info form */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-4">Vos informations</h4>

                  {connectedUser && (
                    <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <p className="text-xs text-green-700">Connect&eacute; &mdash; vos informations sont pr&eacute;-remplies depuis votre profil</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        Nom complet <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={bookingForm.name}
                        onChange={(e) => setBookingForm({ ...bookingForm, name: e.target.value })}
                        placeholder="Ex: Marie Dupont"
                        className={`w-full p-2.5 border-2 rounded-lg focus:border-[#FFC107] focus:outline-none transition text-sm ${
                          connectedUser && bookingForm.name ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
                        }`}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        Email
                      </label>
                      <input
                        type="email"
                        value={bookingForm.email}
                        onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })}
                        placeholder="marie@exemple.com"
                        className={`w-full p-2.5 border-2 rounded-lg focus:border-[#FFC107] focus:outline-none transition text-sm ${
                          connectedUser && bookingForm.email ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        T&eacute;l&eacute;phone <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="tel"
                        value={bookingForm.phone}
                        onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                        placeholder="06 12 34 56 78"
                        className={`w-full p-2.5 border-2 rounded-lg focus:border-[#FFC107] focus:outline-none transition text-sm ${
                          connectedUser && bookingForm.phone ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
                        }`}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        Adresse d&apos;intervention
                      </label>
                      <input
                        type="text"
                        value={bookingForm.address}
                        onChange={(e) => setBookingForm({ ...bookingForm, address: e.target.value })}
                        placeholder="123 rue de la Paix, 13600 La Ciotat"
                        className="w-full p-2.5 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none transition text-sm"
                      />
                      {connectedUser && bookingForm.address && (
                        <p className="text-[11px] text-gray-400 mt-1">Adresse de votre profil par d&eacute;faut &mdash; modifiable si l&apos;intervention est ailleurs</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                        Notes / Pr&eacute;cisions
                      </label>
                      <textarea
                        value={bookingForm.notes}
                        onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                        rows={2}
                        placeholder="D&eacute;crivez votre besoin..."
                        className="w-full p-2.5 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none transition resize-none text-sm"
                      />
                    </div>

                    {/* CGU checkbox */}
                    <label className="flex items-start gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={bookingForm.cgu}
                        onChange={(e) => setBookingForm({ ...bookingForm, cgu: e.target.checked })}
                        className="mt-0.5 w-4 h-4 accent-[#FFC107] rounded"
                      />
                      <span className="text-xs text-gray-500 leading-snug">
                        J&apos;accepte les{' '}
                        <span className="text-[#FFC107] underline cursor-pointer">
                          conditions g&eacute;n&eacute;rales d&apos;utilisation
                        </span>{' '}
                        et la{' '}
                        <span className="text-[#FFC107] underline cursor-pointer">
                          politique de confidentialit&eacute;
                        </span>
                        . <span className="text-red-400">*</span>
                      </span>
                    </label>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-5 space-y-3">
                    <button
                      onClick={submitBooking}
                      disabled={!canSubmitBooking || submitting}
                      className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-lg font-semibold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-900 border-t-transparent" />
                          R&eacute;servation en cours...
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          Confirmer la r&eacute;servation
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setStep('motif')
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className="w-full py-2.5 text-gray-500 hover:text-gray-700 text-sm font-medium transition flex items-center justify-center gap-1"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Retour au choix du motif
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
