'use client'

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  Search,
  SlidersHorizontal,
  Star,
  MapPin,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Zap,
  Award,
  Clock,
  Calendar,
} from 'lucide-react'
import {
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  format,
  isBefore,
  startOfDay,
  isToday as isDateToday,
  isSameDay,
} from 'date-fns'
import { fr } from 'date-fns/locale'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface Artisan {
  id: string
  company_name: string | null
  bio: string | null
  categories: string[]
  hourly_rate: number | null
  rating_avg: number
  rating_count: number
  verified: boolean
  active: boolean
  zone_radius_km: number
  city?: string | null
  experience_years?: number | null
  services?: Service[]
  // Catalogue fields
  source?: 'registered' | 'catalogue'
  telephone_pro?: string | null
  adresse?: string | null
  arrondissement?: string | null
}

interface Service {
  id: string
  artisan_id: string
  name: string
  description: string | null
  duration_minutes: number
  price_ht: number
  price_ttc: number
  active: boolean
}

interface Availability {
  id: string
  artisan_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
}

interface Booking {
  id: string
  artisan_id: string
  booking_date: string
  booking_time: string
  duration_minutes: number | null
  status: string
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

const SHORT_DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function getInitials(name: string | null): string {
  if (!name) return '?'
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
}

function generateTimeSlots(
  avail: Availability,
  dateStr: string,
  bookings: Booking[],
  slotDuration: number = 60
): string[] {
  if (!avail.is_available) return []

  const startParts = avail.start_time.substring(0, 5).split(':')
  const endParts = avail.end_time.substring(0, 5).split(':')
  const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1])
  const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1])

  const dayBookings = bookings.filter(
    (b) => b.booking_date === dateStr && ['confirmed', 'pending'].includes(b.status)
  )

  const slots: string[] = []

  // If the date is today, skip slots that are already past
  const now = new Date()
  const todayStr = format(now, 'yyyy-MM-dd')
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  for (let m = startMinutes; m + slotDuration <= endMinutes; m += slotDuration) {
    // Skip past slots for today
    if (dateStr === todayStr && m <= currentMinutes) continue

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

    if (!hasConflict) {
      slots.push(timeStr)
    }
  }

  return slots
}

function getWeekDays(weekStart: Date): Date[] {
  // Returns Mon-Fri (5 days)
  return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))
}

function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 4)
  const startStr = format(weekStart, 'd MMM', { locale: fr })
  const endStr = format(end, 'd MMM', { locale: fr })
  return `${startStr} - ${endStr}`
}

function getCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    plomberie: 'Plombier',
    electricite: 'Electricien',
    peinture: 'Peintre',
    maconnerie: 'Mason',
    menuiserie: 'Menuisier',
    chauffage: 'Chauffagiste',
    climatisation: 'Climaticien',
    serrurerie: 'Serrurier',
    carrelage: 'Carreleur',
    toiture: 'Couvreur',
    jardinage: 'Jardinier',
    demenagement: 'Demenageur',
    nettoyage: 'Agent de nettoyage',
    renovation: 'Artisan renovation',
  }
  return map[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)
}

// Mapping catégorie slug → métiers catalogue
const CATEGORY_TO_METIERS: Record<string, string[]> = {
  plomberie:     ['Plomberie'],
  electricite:   ['Électricité'],
  serrurerie:    ['Serrurerie'],
  chauffage:     ['Chauffage'],
  climatisation: ['Climatisation'],
  peinture:      ['Peinture'],
  maconnerie:    ['Maçonnerie'],
  menuiserie:    ['Menuiserie'],
  carrelage:     ['Carrelage'],
  toiture:       ['Toiture'],
  jardinage:     ['Espaces verts', 'Paysagiste'],
  nettoyage:     ['Nettoyage'],
  demenagement:  ['Déménagement'],
  renovation:    ['Rénovation', 'Petits travaux'],
}

function metierToCategory(metier: string): string {
  for (const [cat, metiers] of Object.entries(CATEGORY_TO_METIERS)) {
    if (metiers.includes(metier)) return cat
  }
  return metier.toLowerCase()
}

// ------------------------------------------------------------------
// Mini Weekly Calendar Component
// ------------------------------------------------------------------

function MiniWeeklyCalendar({
  artisanId,
  availability,
  bookings,
}: {
  artisanId: string
  availability: Availability[]
  bookings: Booking[]
}) {
  const today = startOfDay(new Date())
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 })
  const [weekStart, setWeekStart] = useState<Date>(currentWeekStart)

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])

  const canGoPrev = !isBefore(weekStart, addDays(currentWeekStart, 1))

  const goNextWeek = () => setWeekStart(addWeeks(weekStart, 1))
  const goPrevWeek = () => {
    if (canGoPrev) setWeekStart(subWeeks(weekStart, 1))
  }

  // Build slots for each day
  const daySlotsMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const day of weekDays) {
      const dayOfWeek = day.getDay()
      const dateStr = format(day, 'yyyy-MM-dd')
      const avail = availability.find((a) => a.day_of_week === dayOfWeek && a.is_available)

      if (isBefore(day, today) && !isSameDay(day, today)) {
        map[dateStr] = []
      } else if (avail) {
        map[dateStr] = generateTimeSlots(avail, dateStr, bookings)
      } else {
        map[dateStr] = []
      }
    }
    return map
  }, [weekDays, availability, bookings, today])

  const MAX_VISIBLE_SLOTS = 3

  return (
    <div className="flex flex-col h-full">
      {/* Week nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goPrevWeek}
          disabled={!canGoPrev}
          className="p-1 rounded hover:bg-gray-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Semaine precedente"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-semibold text-gray-600">
          {formatWeekRange(weekStart)}
        </span>
        <button
          onClick={goNextWeek}
          className="p-1 rounded hover:bg-gray-100 transition"
          aria-label="Semaine suivante"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-5 gap-1 flex-1">
        {weekDays.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const slots = daySlotsMap[dateStr] || []
          const dayNum = format(day, 'd')
          const dayName = SHORT_DAY_NAMES[day.getDay()]
          const isToday = isDateToday(day)

          return (
            <div key={dateStr} className="flex flex-col items-center">
              {/* Day header */}
              <div
                className={`text-center mb-1.5 ${
                  isToday ? 'text-amber-600 font-bold' : 'text-gray-500'
                }`}
              >
                <div className="text-[10px] uppercase font-semibold leading-tight">
                  {dayName}
                </div>
                <div
                  className={`text-xs leading-tight ${
                    isToday
                      ? 'bg-[#FFC107] text-white w-5 h-5 rounded-full flex items-center justify-center mx-auto'
                      : ''
                  }`}
                >
                  {dayNum}
                </div>
              </div>

              {/* Time slots */}
              <div className="flex flex-col gap-1 w-full">
                {slots.length === 0 ? (
                  <span className="text-[10px] text-gray-300 text-center">&mdash;</span>
                ) : (
                  <>
                    {slots.slice(0, MAX_VISIBLE_SLOTS).map((slot) => (
                      <Link
                        key={slot}
                        href={`/artisan/${artisanId}`}
                        className="text-[10px] sm:text-xs bg-amber-50 hover:bg-[#FFC107] hover:text-gray-900 text-amber-700 font-semibold py-1 px-0.5 rounded text-center transition truncate"
                      >
                        {slot}
                      </Link>
                    ))}
                    {slots.length > MAX_VISIBLE_SLOTS && (
                      <span className="text-[9px] text-gray-400 text-center">
                        +{slots.length - MAX_VISIBLE_SLOTS}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* See more link */}
      <Link
        href={`/artisan/${artisanId}`}
        className="mt-2 text-xs text-[#FFC107] hover:text-amber-600 font-semibold text-center transition"
      >
        Voir plus de creneaux &rarr;
      </Link>
    </div>
  )
}

// ------------------------------------------------------------------
// Filter Modal
// ------------------------------------------------------------------

function FilterModal({
  isOpen,
  onClose,
  filters,
  setFilters,
}: {
  isOpen: boolean
  onClose: () => void
  filters: FilterState
  setFilters: (f: FilterState) => void
}) {
  const [local, setLocal] = useState<FilterState>(filters)

  useEffect(() => {
    if (isOpen) setLocal(filters)
  }, [isOpen, filters])

  if (!isOpen) return null

  const dispoOptions = [
    { value: 'all', label: 'Toutes les disponibilites' },
    { value: 'today', label: "Aujourd'hui" },
    { value: '3days', label: 'Sous 3 jours' },
    { value: '7days', label: 'Sous 7 jours' },
    { value: '14days', label: 'Sous 14 jours' },
  ]

  const interventionOptions = [
    { value: 'all', label: 'Tous types' },
    { value: 'urgence', label: 'Intervention urgente' },
    { value: 'planifie', label: 'Intervention planifiee' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Filtres</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Disponibilites */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Disponibilites</h3>
          <div className="space-y-2">
            {dispoOptions.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition"
              >
                <input
                  type="radio"
                  name="dispo"
                  checked={local.disponibilite === opt.value}
                  onChange={() => setLocal({ ...local, disponibilite: opt.value })}
                  className="w-4 h-4 accent-[#FFC107]"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Type d'intervention */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Type d&apos;intervention
          </h3>
          <div className="space-y-2">
            {interventionOptions.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition"
              >
                <input
                  type="radio"
                  name="intervention"
                  checked={local.typeIntervention === opt.value}
                  onChange={() => setLocal({ ...local, typeIntervention: opt.value })}
                  className="w-4 h-4 accent-[#FFC107]"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Verified only */}
        <div className="mb-8">
          <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition">
            <input
              type="checkbox"
              checked={local.verifiedOnly}
              onChange={() => setLocal({ ...local, verifiedOnly: !local.verifiedOnly })}
              className="w-4 h-4 accent-[#FFC107] rounded"
            />
            <span className="text-sm font-medium">Artisans certifies uniquement</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setLocal({
                disponibilite: 'all',
                typeIntervention: 'all',
                verifiedOnly: false,
              })
            }}
            className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Reinitialiser
          </button>
          <button
            onClick={() => {
              setFilters(local)
              onClose()
            }}
            className="flex-1 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-2.5 rounded-lg font-semibold transition"
          >
            Appliquer les filtres
          </button>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Filter state type
// ------------------------------------------------------------------

interface FilterState {
  disponibilite: string
  typeIntervention: string
  verifiedOnly: boolean
}

// ------------------------------------------------------------------
// Artisan Card
// ------------------------------------------------------------------

function StarsRow({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  const fullStars = Math.floor(rating)
  const hasHalf = rating - fullStars >= 0.5
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${
              i < fullStars
                ? 'fill-[#FFC107] text-[#FFC107]'
                : i === fullStars && hasHalf
                  ? 'fill-[#FFC107]/50 text-[#FFC107]'
                  : 'fill-gray-200 text-gray-200'
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-semibold">{rating.toFixed(1)}</span>
      <span className="text-xs text-gray-400">({reviewCount} avis)</span>
    </div>
  )
}

function ArtisanCard({
  artisan,
  availability,
  bookings,
}: {
  artisan: Artisan
  availability: Availability[]
  bookings: Booking[]
}) {
  const initials = getInitials(artisan.company_name)
  const primaryCategory = artisan.categories?.[0]
  const rating = artisan.rating_avg || 5.0
  const reviewCount = artisan.rating_count || 0
  const isCatalogue = artisan.source === 'catalogue'

  // Badges
  const badges: { icon: React.ReactNode; label: string; color: string }[] = []
  if (artisan.verified) {
    badges.push({
      icon: <Award className="w-3 h-3" />,
      label: isCatalogue ? 'Pappers vérifié' : 'Artisan certifie',
      color: 'bg-green-50 text-green-700 border-green-200',
    })
  }
  if (!isCatalogue) {
    const hasWeekendOrWideHours = availability.some(
      (a) => a.is_available && (a.day_of_week === 0 || a.day_of_week === 6)
    )
    if (hasWeekendOrWideHours) {
      badges.push({
        icon: <Zap className="w-3 h-3" />,
        label: 'Intervention rapide',
        color: 'bg-amber-50 text-amber-700 border-amber-200',
      })
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100">
      <div className="p-5 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:gap-6">
          {/* Avatar */}
          <div className="flex lg:flex-col items-center lg:items-center gap-4 lg:gap-2 mb-4 lg:mb-0 lg:w-20 flex-shrink-0">
            <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-[#FFC107] to-[#FFD54F] flex items-center justify-center text-white font-bold text-lg lg:text-xl shadow-sm flex-shrink-0">
              {initials}
            </div>
            <div className="hidden lg:flex items-center gap-0.5 mt-1">
              <Star className="w-3.5 h-3.5 fill-[#FFC107] text-[#FFC107]" />
              <span className="text-xs font-semibold">{rating.toFixed(1)}</span>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 mb-4 lg:mb-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                {isCatalogue ? (
                  <span className="font-bold text-lg">{artisan.company_name || 'Artisan'}</span>
                ) : (
                  <Link href={`/artisan/${artisan.id}`} className="font-bold text-lg hover:text-[#FFC107] transition">
                    {artisan.company_name || 'Artisan'}
                  </Link>
                )}
                {primaryCategory && (
                  <p className="text-sm text-gray-500">{getCategoryLabel(primaryCategory)}</p>
                )}
              </div>
            </div>

            <div className="mt-1 lg:hidden">
              <StarsRow rating={rating} reviewCount={reviewCount} />
            </div>
            <div className="hidden lg:block mt-1">
              <StarsRow rating={rating} reviewCount={reviewCount} />
            </div>

            <div className="mt-2 space-y-1">
              {artisan.experience_years && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>{artisan.experience_years} ans d&apos;experience</span>
                </div>
              )}
              {(artisan.adresse || artisan.city) && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <MapPin className="w-3 h-3" />
                  <span>{artisan.adresse || artisan.city}</span>
                </div>
              )}
            </div>

            {badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {badges.map((badge, idx) => (
                  <span key={idx} className={`inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>
                    {badge.icon}
                    {badge.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Colonne 3 : Calendrier (inscrit) ou Contact (catalogue) */}
          <div className="lg:w-64 xl:w-72 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 pt-4 lg:pt-0 lg:pl-5">
            {isCatalogue ? (
              <div className="flex flex-col gap-3 h-full justify-center">
                <p className="text-xs text-gray-500 font-medium">Artisan r&eacute;f&eacute;renc&eacute; &agrave; Marseille</p>
                {artisan.telephone_pro && artisan.verified && (
                  <a
                    href={`tel:${artisan.telephone_pro}`}
                    className="flex items-center justify-center gap-2 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 font-bold py-2.5 px-4 rounded-lg transition text-sm"
                  >
                    📞 {artisan.telephone_pro}
                  </a>
                )}
                <p className="text-[10px] text-gray-400 text-center">
                  {reviewCount} avis Google • {rating.toFixed(1)}/5
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 h-full justify-center">
                <Link
                  href={`/artisan/${artisan.id}`}
                  className="flex items-center justify-center gap-2 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 font-bold py-3 px-4 rounded-lg transition text-sm"
                >
                  <Calendar className="w-4 h-4" />
                  Prendre rendez-vous
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Main Content
// ------------------------------------------------------------------

function RechercheContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Search inputs
  const [categoryInput, setCategoryInput] = useState(
    searchParams.get('category') || ''
  )
  const [locationInput, setLocationInput] = useState(
    searchParams.get('loc') || ''
  )

  // Géolocalisation "Autour de moi"
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)

  // Data
  const [artisans, setArtisans] = useState<Artisan[]>([])
  const [allAvailability, setAllAvailability] = useState<Availability[]>([])
  const [allBookings, setAllBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    disponibilite: 'all',
    typeIntervention: 'all',
    verifiedOnly: false,
  })

  // Active search params (what was actually searched)
  const [activeCategory, setActiveCategory] = useState(
    searchParams.get('category') || ''
  )
  const [activeLocation, setActiveLocation] = useState(
    searchParams.get('loc') || ''
  )

  // ------------------------------------------------------------------
  // Fetch data
  // ------------------------------------------------------------------

  const fetchData = useCallback(
    async (category: string, location: string) => {
      setLoading(true)

      // ── 1. Artisans inscrits (profiles_artisan) ─────────────────────
      let query = supabase
        .from('profiles_artisan')
        .select('*, services(*)')
        .eq('active', true)

      if (category) {
        query = query.contains('categories', [category])
      }

      const { data: artisanData, error } = await query

      if (error) {
        console.error('Erreur fetch artisans:', error)
      }

      const registeredList: Artisan[] = (artisanData || []).map((a) => {
        // Extract address from bio (e.g. "basé à La Ciotat — Bât B, Rés. l'Aurore, 13600 La Ciotat")
        const addrMatch = (a.bio || '').match(/—\s*(.+?)(?:\.\s+[A-ZÀ-Ü]|<!--)/)
        const simpleMatch = !addrMatch ? (a.bio || '').match(/bas[ée]e?\s+[àa]\s+([^(.\n]+?)(?:\s*\((\d{5})\))?(?:\s*[.,]|\s*$)/i) : null
        const extractedCity = addrMatch
          ? addrMatch[1].trim()
          : simpleMatch
            ? simpleMatch[2] ? `${simpleMatch[1].trim()}, ${simpleMatch[2]}` : simpleMatch[1].trim()
            : null
        return {
          ...a,
          city: extractedCity,
          source: 'registered' as const,
        }
      })

      // ── 2. Artisans catalogue (artisans_catalogue) ──────────────────
      let catalogQuery = supabase
        .from('artisans_catalogue')
        .select('*')
        .order('google_note', { ascending: false })

      if (category) {
        const metiers = CATEGORY_TO_METIERS[category]
        if (metiers && metiers.length > 0) {
          catalogQuery = catalogQuery.in('metier', metiers)
        }
      }

      // Filter by location / arrondissement if provided
      if (location) {
        catalogQuery = catalogQuery.ilike('adresse', `%${location}%`)
      }

      const { data: catalogData } = await catalogQuery

      const catalogList: Artisan[] = (catalogData || []).map((c) => ({
        id: `cat_${c.id}`,
        company_name: c.nom_entreprise,
        bio: c.specialite,
        categories: [metierToCategory(c.metier)],
        hourly_rate: null,
        rating_avg: Number(c.google_note) || 0,
        rating_count: c.google_avis || 0,
        verified: c.pappers_verifie || false,
        active: true,
        zone_radius_km: 20,
        city: c.arrondissement || c.ville || 'Marseille',
        experience_years: null,
        source: 'catalogue' as const,
        telephone_pro: c.telephone_pro,
        adresse: c.adresse,
        arrondissement: c.arrondissement,
      }))

      // ── 3. Fusion : inscrits d'abord, puis catalogue ─────────────────
      const allArtisans = [...registeredList, ...catalogList]
      setArtisans(allArtisans)

      // ── 4. Dispo & bookings pour les artisans inscrits uniquement ────
      if (registeredList.length > 0) {
        const ids = registeredList.map((a) => a.id)

        const { data: availData } = await supabase
          .from('availability')
          .select('*')
          .in('artisan_id', ids)
          .eq('is_available', true)
          .order('day_of_week')

        setAllAvailability(availData || [])

        const todayStr = format(new Date(), 'yyyy-MM-dd')
        const { data: bookingsData } = await supabase
          .from('bookings')
          .select('*')
          .in('artisan_id', ids)
          .gte('booking_date', todayStr)
          .in('status', ['confirmed', 'pending'])

        setAllBookings(bookingsData || [])
      } else {
        setAllAvailability([])
        setAllBookings([])
      }

      setLoading(false)
    },
    []
  )

  // Initial load
  useEffect(() => {
    const cat = searchParams.get('category') || ''
    const loc = searchParams.get('loc') || ''
    setCategoryInput(cat)
    setLocationInput(loc)
    setActiveCategory(cat)
    setActiveLocation(loc)
    fetchData(cat, loc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ------------------------------------------------------------------
  // Search handler
  // ------------------------------------------------------------------

  const handleSearch = () => {
    setActiveCategory(categoryInput)
    setActiveLocation(locationInput)

    // Update URL params
    const params = new URLSearchParams()
    if (categoryInput) params.set('category', categoryInput)
    if (locationInput) params.set('loc', locationInput)
    router.push(`/recherche?${params.toString()}`)

    fetchData(categoryInput, locationInput)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  // ------------------------------------------------------------------
  // Géolocalisation "Autour de moi"
  // ------------------------------------------------------------------

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setGeoError('La géolocalisation n\'est pas disponible sur votre navigateur.')
      return
    }
    setGeoLoading(true)
    setGeoError('')

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        setUserCoords({ lat: latitude, lng: longitude })

        // Reverse geocoding via API publique
        try {
          const res = await fetch(
            `https://api-adresse.data.gouv.fr/reverse/?lon=${longitude}&lat=${latitude}`
          )
          const data = await res.json()
          const feature = data?.features?.[0]
          if (feature) {
            const city = feature.properties?.city || feature.properties?.municipality || ''
            const postcode = feature.properties?.postcode || ''
            const label = city ? `${city} (${postcode})` : postcode
            setLocationInput(label)
          } else {
            setLocationInput(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
          }
        } catch {
          setLocationInput(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
        }

        setGeoLoading(false)
        // Lancer la recherche automatiquement après géoloc
        setTimeout(() => {
          setActiveCategory(categoryInput)
          const params = new URLSearchParams()
          if (categoryInput) params.set('category', categoryInput)
          router.push(`/recherche?${params.toString()}`)
          fetchData(categoryInput, '')
        }, 100)
      },
      (err) => {
        setGeoLoading(false)
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Accès à la localisation refusé. Autorisez la géolocalisation dans votre navigateur.')
        } else {
          setGeoError('Impossible de récupérer votre position. Réessayez.')
        }
      },
      { timeout: 8000, maximumAge: 60000 }
    )
  }

  // ------------------------------------------------------------------
  // Filtered artisans
  // ------------------------------------------------------------------

  const filteredArtisans = useMemo(() => {
    let result = [...artisans]

    // Verified filter
    if (filters.verifiedOnly) {
      result = result.filter((a) => a.verified)
    }

    // Availability time filter
    if (filters.disponibilite !== 'all') {
      const today = startOfDay(new Date())
      let maxDate: Date

      switch (filters.disponibilite) {
        case 'today':
          maxDate = today
          break
        case '3days':
          maxDate = addDays(today, 3)
          break
        case '7days':
          maxDate = addDays(today, 7)
          break
        case '14days':
          maxDate = addDays(today, 14)
          break
        default:
          maxDate = addDays(today, 365)
      }

      result = result.filter((artisan) => {
        const artisanAvail = allAvailability.filter(
          (a) => a.artisan_id === artisan.id
        )
        // Check if the artisan has at least one available slot within the range
        for (
          let d = new Date(today);
          !isBefore(maxDate, d);
          d = addDays(d, 1)
        ) {
          const dayOfWeek = d.getDay()
          const avail = artisanAvail.find(
            (a) => a.day_of_week === dayOfWeek && a.is_available
          )
          if (avail) {
            const dateStr = format(d, 'yyyy-MM-dd')
            const artisanBookings = allBookings.filter(
              (b) => b.artisan_id === artisan.id
            )
            const slots = generateTimeSlots(avail, dateStr, artisanBookings)
            if (slots.length > 0) return true
          }
        }
        return false
      })
    }

    // Sort: inscrits d'abord, puis catalogue ; dans chaque groupe : vérifiés > note
    result.sort((a, b) => {
      if (a.source !== b.source) return a.source === 'catalogue' ? 1 : -1
      if (a.verified !== b.verified) return a.verified ? -1 : 1
      return (b.rating_avg || 0) - (a.rating_avg || 0)
    })

    return result
  }, [artisans, filters, allAvailability, allBookings])

  // ------------------------------------------------------------------
  // Subtitle text
  // ------------------------------------------------------------------

  const subtitleText = useMemo(() => {
    const parts: string[] = []
    if (activeCategory) {
      parts.push(`${getCategoryLabel(activeCategory)}s verifies`)
    } else {
      parts.push('Artisans verifies')
    }
    if (activeLocation) {
      parts.push(`a ${activeLocation}`)
    }
    parts.push('avec disponibilites en temps reel')
    return parts.join(' ')
  }, [activeCategory, activeLocation])

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search Bar (in-page) */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Plomberie, Electricite..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#FFC107] focus:ring-1 focus:ring-[#FFC107] transition text-sm"
              />
            </div>
            <div className="relative flex-1 sm:max-w-xs">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={locationInput}
                onChange={(e) => { setLocationInput(e.target.value); setUserCoords(null) }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Ville ou code postal"
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:border-[#FFC107] focus:ring-1 focus:ring-[#FFC107] transition text-sm ${
                  userCoords ? 'border-[#FFC107] bg-amber-50' : 'border-gray-200'
                }`}
              />
            </div>
            {/* Bouton Autour de moi */}
            <button
              onClick={handleGeolocate}
              disabled={geoLoading}
              title="Rechercher les artisans autour de moi"
              className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-[#FFC107] text-[#FFC107] hover:bg-amber-50 rounded-lg font-semibold transition disabled:opacity-60 whitespace-nowrap"
            >
              {geoLoading ? (
                <span className="animate-spin text-base">⏳</span>
              ) : (
                <MapPin className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{geoLoading ? 'Localisation...' : 'Autour de moi'}</span>
            </button>
            <button
              onClick={handleSearch}
              className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              Rechercher
            </button>
          </div>
          {/* Erreur géoloc */}
          {geoError && (
            <div className="mt-2 flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span>⚠️</span>
              <span>{geoError}</span>
              <button onClick={() => setGeoError('')} className="ml-auto text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
          {/* Badge géoloc active */}
          {userCoords && !geoError && (
            <div className="mt-2 flex items-center gap-2 text-amber-700 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <MapPin className="w-3 h-3" />
              <span>Recherche autour de votre position</span>
              <button
                onClick={() => { setUserCoords(null); setLocationInput('') }}
                className="ml-auto text-amber-500 hover:text-amber-700"
              >
                ✕ Effacer
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filter bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setFilterModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:border-[#FFC107] hover:bg-amber-50 transition whitespace-nowrap"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtres
            </button>

            {/* Chip Autour de moi */}
            <button
              onClick={() => {
                if (userCoords) {
                  setUserCoords(null)
                  setLocationInput('')
                } else {
                  handleGeolocate()
                }
              }}
              disabled={geoLoading}
              title={userCoords ? 'Désactiver la localisation' : 'Rechercher autour de ma position'}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition whitespace-nowrap disabled:opacity-60 ${
                userCoords
                  ? 'border-[#FFC107] bg-amber-50 text-amber-700'
                  : 'border-gray-200 hover:border-[#FFC107] hover:bg-amber-50 text-gray-700'
              }`}
            >
              {geoLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <MapPin className="w-4 h-4" />
              )}
              <span>{geoLoading ? 'Localisation...' : 'Autour de moi'}</span>
              {userCoords && !geoLoading && <X className="w-3 h-3 ml-0.5 opacity-70" />}
            </button>

            <button
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  disponibilite: prev.disponibilite === '3days' ? 'all' : '3days',
                }))
              }
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition whitespace-nowrap ${
                filters.disponibilite === '3days'
                  ? 'border-[#FFC107] bg-amber-50 text-amber-700'
                  : 'border-gray-200 hover:border-[#FFC107] hover:bg-amber-50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Disponibilites
            </button>
            <button
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  disponibilite: prev.disponibilite === 'today' ? 'all' : 'today',
                }))
              }
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition whitespace-nowrap ${
                filters.disponibilite === 'today'
                  ? 'border-[#FFC107] bg-amber-50 text-amber-700'
                  : 'border-gray-200 hover:border-[#FFC107] hover:bg-amber-50'
              }`}
            >
              <Zap className="w-4 h-4" />
              Intervention 24/7
            </button>
            {filters.verifiedOnly && (
              <button
                onClick={() =>
                  setFilters((prev) => ({ ...prev, verifiedOnly: false }))
                }
                className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium transition whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                Certifies
                <X className="w-3.5 h-3.5 ml-1" />
              </button>
            )}
          </div>
        </div>

        {/* Results header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {loading ? (
              'Recherche en cours...'
            ) : (
              <>{filteredArtisans.length} artisan{filteredArtisans.length !== 1 ? 's' : ''} disponible{filteredArtisans.length !== 1 ? 's' : ''}</>
            )}
          </h1>
          {!loading && (
            <p className="text-gray-500 mt-1 text-sm sm:text-base">
              {subtitleText}
            </p>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#FFC107] border-t-transparent"></div>
            <p className="mt-4 text-gray-500">Recherche en cours...</p>
          </div>
        ) : filteredArtisans.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2 text-gray-700">
              Aucun artisan trouve
            </h3>
            <p className="text-gray-500 mb-6">
              Essayez de modifier vos criteres de recherche ou vos filtres
            </p>
            <button
              onClick={() => {
                setCategoryInput('')
                setLocationInput('')
                setFilters({
                  disponibilite: 'all',
                  typeIntervention: 'all',
                  verifiedOnly: false,
                })
                setActiveCategory('')
                setActiveLocation('')
                fetchData('', '')
                router.push('/recherche')
              }}
              className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-2.5 rounded-lg font-semibold transition"
            >
              Reinitialiser la recherche
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredArtisans.map((artisan) => (
              <ArtisanCard
                key={artisan.id}
                artisan={artisan}
                availability={allAvailability.filter(
                  (a) => a.artisan_id === artisan.id
                )}
                bookings={allBookings.filter(
                  (b) => b.artisan_id === artisan.id
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Filter Modal */}
      <FilterModal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        filters={filters}
        setFilters={setFilters}
      />
    </div>
  )
}

// ------------------------------------------------------------------
// Page wrapper with Suspense
// ------------------------------------------------------------------

export default function RecherchePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FFC107] border-t-transparent"></div>
        </div>
      }
    >
      <RechercheContent />
    </Suspense>
  )
}
