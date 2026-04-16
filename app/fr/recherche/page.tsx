'use client'

import { useState, useEffect, Suspense, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Search,
  SlidersHorizontal,
  MapPin,
  X,
  Check,
  Zap,
  Calendar,
} from 'lucide-react'
import {
  addDays,
  format,
  isBefore,
  startOfDay,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  CATEGORY_LABELS_PT,
  CATEGORY_TO_METIERS,
  SPECIALTY_SUGGESTIONS_FR,
  normalizeForSearch,
  fuzzyMatchCategory,
  getCategoryLabel,
  metierToCategory,
} from '@/lib/search-categories'
import { FilterModal, type FilterState } from '@/components/recherche/FilterModal'
import { ArtisanCard, type Artisan, type Availability, type Booking, type Service } from '@/components/recherche/ArtisanCard'
import { ALL_COMMUNES, FR_DEPARTEMENTS } from '@/lib/geo/fr-geo-data'


// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

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


// ------------------------------------------------------------------
// Algorithme de rotation équitable des artisans (anti-favoritisme)
// ------------------------------------------------------------------

/**
 * Retourne un seed entier qui change toutes les 4h.
 * Identique pour tous les utilisateurs → même ordre affiché pour tout le monde,
 * rotation automatique toutes les 4 heures.
 */
function getTimeSlotSeed(): number {
  const SLOT_MS = 4 * 60 * 60 * 1000 // 4 heures
  return Math.floor(Date.now() / SLOT_MS)
}

/**
 * Shuffle déterministe (Fisher-Yates + LCG seeded).
 * Même seed → même ordre. Seed différent → ordre différent.
 */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const shuffled = [...arr]
  let s = (seed ^ 0xdeadbeef) >>> 0
  for (let i = shuffled.length - 1; i > 0; i--) {
    // LCG: Numerical Recipes constants
    s = Math.imul(s, 1664525) + 1013904223
    s = s >>> 0
    const j = s % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}




// ------------------------------------------------------------------
// Main Content
// ------------------------------------------------------------------

function RechercheContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Détection locale depuis l'URL (/pt/... ou /fr/...) — fiable dès le 1er rendu
  // Le middleware garde l'URL /pt/recherche/ dans le navigateur même si next.config rewrite sert /recherche/
  const pathname = usePathname()
  const siteLocale: 'fr' | 'pt' = pathname?.startsWith('/pt') ? 'pt' : 'fr'
  const tp = (fr: string, pt: string) => siteLocale === 'pt' ? pt : fr

  // Search inputs — PT: show localized label instead of raw slug (e.g. "Eletricista" not "electricite")
  const [categoryInput, setCategoryInput] = useState(() => {
    const raw = searchParams.get('category') || ''
    return raw && siteLocale === 'pt' ? (CATEGORY_LABELS_PT[raw] || raw) : raw
  })
  const [locationInput, setLocationInput] = useState(
    searchParams.get('loc') || ''
  )

  // Géolocalisation "Autour de moi"
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  // Coordonnées de la ville saisie (geocodées) pour le tri par distance sans GPS
  const [searchCoords, setSearchCoords] = useState<{ lat: number; lng: number } | null>(null)

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

  // Autocomplete dropdowns
  const [catDropOpen, setCatDropOpen] = useState(false)
  const [locDropOpen, setLocDropOpen] = useState(false)
  const [citySuggestions, setCitySuggestions] = useState<Array<{label: string}>>([])
  const [citySuggestionsLoading, setCitySuggestionsLoading] = useState(false)
  const [catHighlight, setCatHighlight] = useState(-1)
  const [locHighlight, setLocHighlight] = useState(-1)
  const catRef = useRef<HTMLDivElement>(null)
  const locRef = useRef<HTMLDivElement>(null)

  // ------------------------------------------------------------------
  // Fetch data
  // ------------------------------------------------------------------

  const fetchData = useCallback(
    async (category: string, location: string) => {
      setLoading(true)
      const resolvedCategory = category ? fuzzyMatchCategory(category) : null
      const catNorm = normalizeForSearch(category)
      const locNorm = normalizeForSearch(location)

      // ── 1. Artisans inscrits (profiles_artisan) ─────────────────────
      // Détection du pays : GPS prioritaire (si "autour de moi") > URL (/pt ou /fr)
      // URL est la source de vérité : /pt/pesquisar = PT, /fr/recherche = FR
      let detectedCountry: string = siteLocale === 'pt' ? 'PT' : 'FR'

      // Si géolocalisation active, détecter le pays par coordonnées GPS
      if (userCoords) {
        const { lat, lng } = userCoords
        // Bounding box Portugal continental
        if (lat >= 36.9 && lat <= 42.2 && lng >= -9.6 && lng <= -6.1) {
          detectedCountry = 'PT'
        // Açores
        } else if (lat >= 36.5 && lat <= 40.0 && lng >= -31.5 && lng <= -24.5) {
          detectedCountry = 'PT'
        // Madère
        } else if (lat >= 32.0 && lat <= 33.5 && lng >= -17.5 && lng <= -15.5) {
          detectedCountry = 'PT'
        // France métropolitaine
        } else if (lat >= 41.0 && lat <= 51.5 && lng >= -5.5 && lng <= 10.0) {
          detectedCountry = 'FR'
        }
      }

      // detectedCountry = 'FR' | 'PT' — mappe vers la colonne `language` qui existe dans profiles_artisan
      const detectedLang = detectedCountry === 'PT' ? 'pt' : 'fr'

      let query = supabase
        .from('profiles_artisan')
        .select('*, services(*)')
        .eq('active', true)
        .eq('language', detectedLang)

      // Don't filter registered artisans at DB level — do it client-side for better fuzzy matching
      const { data: artisanData, error } = await query

      if (error) {
        console.error('Erreur fetch artisans:', error)
      }

      let registeredList: Artisan[] = (artisanData || []).map((a) => {
        // Extract city from bio or use company_city
        const extractedCity = a.company_city || (() => {
          const addrMatch = (a.bio || '').match(/—\s*(.+?)(?:\.\s+[A-ZÀ-Ü]|<!--)/)
          const simpleMatch = !addrMatch ? (a.bio || '').match(/bas[ée]e?\s+[àa]\s+([^(.\n]+?)(?:\s*\((\d{5})\))?(?:\s*[.,]|\s*$)/i) : null
          return addrMatch
            ? addrMatch[1].trim()
            : simpleMatch
              ? simpleMatch[2] ? `${simpleMatch[1].trim()}, ${simpleMatch[2]}` : simpleMatch[1].trim()
              : null
        })()
        // Calculer la distance si coords utilisateur disponibles
        let dist: number | null = null
        if (userCoords && a.latitude && a.longitude) {
          const R = 6371
          const dLat = (a.latitude - userCoords.lat) * Math.PI / 180
          const dLon = (a.longitude - userCoords.lng) * Math.PI / 180
          const sinLat = Math.sin(dLat / 2)
          const sinLon = Math.sin(dLon / 2)
          const h = sinLat * sinLat + Math.cos(userCoords.lat * Math.PI / 180) * Math.cos(a.latitude * Math.PI / 180) * sinLon * sinLon
          dist = R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
        }
        return {
          ...a,
          city: extractedCity,
          distance_km: dist,
          // Only real subscribers (user_id != null) get the booking button
          source: a.user_id ? 'registered' as const : 'catalogue' as const,
          telephone_pro: a.user_id ? null : (a.phone || null),
        }
      })

      // Client-side category filter for registered artisans
      if (catNorm) {
        if (resolvedCategory) {
          // Strict category filter: only show artisans whose categories array contains
          // the resolved slug OR a closely related slug. Do NOT search bio/services text
          // to avoid false positives (e.g. "jardin" in an address matching a plumber).
          const catSlugNorm = normalizeForSearch(resolvedCategory)
          // Collect all slugs that are aliases for this category
          const relatedSlugs = new Set<string>([catSlugNorm])
          // Also accept artisans that have any keyword/metier of this category as their category value
          const metiers = CATEGORY_TO_METIERS[resolvedCategory] || []
          for (const m of metiers) relatedSlugs.add(normalizeForSearch(m))

          registeredList = registeredList.filter((a) => {
            const artisanCats = (a.categories || []).map((c: string) => normalizeForSearch(c))
            // Exact slug match (most common case: categories = ['espaces-verts'])
            if (artisanCats.includes(catSlugNorm)) return true
            // Also match if the artisan category value is one of the metier names
            return artisanCats.some(ac => relatedSlugs.has(ac))
          })
        } else {
          // No resolved category — free text search across all artisan fields
          registeredList = registeredList.filter((a) => {
            const artisanText = normalizeForSearch(
              [
                (a.categories || []).join(' '),
                a.company_name || '',
                a.bio || '',
                (a.services || []).map((s: any) => s.name || '').join(' '),
              ].join(' ')
            )
            return catNorm.split(/\s+/).some(w => w.length >= 2 && artisanText.includes(w))
          })
        }
      }

      // Client-side location filter for registered artisans
      // Match la recherche client contre : ville/adresse de l'artisan ET ses zones d'intervention
      // (cities, departments, regions). Si un artisan a coché "13" ou "PACA", il apparaît quand
      // le client tape "Marseille", "Aubagne", etc.
      if (locNorm) {
        // 1. Tenter de résoudre la ville cherchée → département + région
        //    via le code postal retourné par les suggestions ou via la base communes 13
        let searchedDept = ''
        let searchedRegion = ''

        // a) Si postcode dans la saisie (format "Marseille (13001)" ou "13001"), extraire 2 premiers chiffres
        const cpMatch = (location || '').match(/(\d{5})/)
        if (cpMatch) {
          searchedDept = cpMatch[1].slice(0, 2)
        }
        // b) Sinon chercher dans les communes connues (phase test : 13)
        if (!searchedDept) {
          const m = ALL_COMMUNES.find(c => normalizeForSearch(c.nom) === locNorm)
          if (m) searchedDept = m.code.slice(0, 2)
        }
        if (searchedDept) {
          const d = FR_DEPARTEMENTS.find(x => x.code === searchedDept)
          if (d) searchedRegion = normalizeForSearch(d.region)
        }

        registeredList = registeredList.filter((a) => {
          const zones = (a as any).intervention_zones || {}
          const zoneCities: string[] = Array.isArray(zones.cities) ? zones.cities : []
          const zoneDepts: string[] = Array.isArray(zones.departments) ? zones.departments : []
          const zoneRegions: string[] = Array.isArray(zones.regions) ? zones.regions : []

          const haystack = normalizeForSearch(
            [
              a.city || '',
              (a as any).company_city || '',
              (a as any).company_postal_code || '',
              a.bio || '',
              zoneCities.join(' '),
              zoneDepts.join(' '),
              zoneRegions.join(' '),
            ].join(' ')
          )

          // Match 1 : texte direct (ville ou alentours nommés)
          const words = locNorm.split(/\s+/).filter(w => w.length >= 2)
          if (words.some(w => haystack.includes(w))) return true

          // Match 2 : département cherché → présent dans les depts de l'artisan
          if (searchedDept) {
            const deptMatch = zoneDepts.some(d => {
              const code = (d.match(/\b(\d{2,3})\b/) || [])[1]
              return code === searchedDept
            })
            if (deptMatch) return true
          }

          // Match 3 : région cherchée → présente dans les régions de l'artisan
          if (searchedRegion) {
            const regionMatch = zoneRegions.some(r => normalizeForSearch(r) === searchedRegion)
            if (regionMatch) return true
          }

          return false
        })
      }

      // ── 2. Artisans catalogue (artisans_catalogue) ──────────────────
      // PT : uniquement Porto. FR : toutes les villes françaises (location filter affine).
      let catalogQuery = supabase
        .from('artisans_catalogue')
        .select('*')
        .order('google_note', { ascending: false, nullsFirst: false })

      if (detectedCountry === 'PT') {
        catalogQuery = catalogQuery.eq('ville', 'Porto')
      } else {
        catalogQuery = catalogQuery.neq('ville', 'Porto')
      }

      if (resolvedCategory) {
        const metiers = CATEGORY_TO_METIERS[resolvedCategory]
        if (metiers && metiers.length > 0) {
          catalogQuery = catalogQuery.in('metier', metiers)
        }
      } else if (catNorm) {
        // Free-text fallback: search in metier, specialite, nom_entreprise
        catalogQuery = catalogQuery.or(`metier.ilike.%${catNorm}%,specialite.ilike.%${catNorm}%,nom_entreprise.ilike.%${catNorm}%`)
      }

      // Filter by location / arrondissement if provided
      if (location) {
        catalogQuery = catalogQuery.or(`adresse.ilike.%${location}%,ville.ilike.%${location}%,arrondissement.ilike.%${location}%`)
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
        city: c.arrondissement || c.ville || (detectedCountry === 'PT' ? 'Porto' : 'France'),
        experience_years: null,
        source: 'catalogue' as const,
        telephone_pro: c.telephone_pro,
        adresse: c.adresse,
        arrondissement: c.arrondissement,
      }))

      // ── 3. Fusion avec dédoublonnage : inscrits prioritaires ─────────
      // Un artisan inscrit (profiles_artisan) prime sur le catalogue
      // Dédup par nom d'entreprise normalisé pour éviter les doublons
      const seen = new Set<string>()
      const deduped: Artisan[] = []

      // D'abord les inscrits (priorité)
      for (const a of registeredList) {
        const key = normalizeForSearch(a.company_name || '')
        if (key && seen.has(key)) continue
        if (key) seen.add(key)
        deduped.push(a)
      }

      // Puis le catalogue, sauf si déjà vu
      for (const a of catalogList) {
        const key = normalizeForSearch(a.company_name || '')
        if (key && seen.has(key)) continue
        if (key) seen.add(key)
        deduped.push(a)
      }

      setArtisans(deduped)

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

      // Geocoder la ville saisie pour activer le tri par distance (même sans GPS)
      if (location) {
        try {
          if (detectedLang === 'pt') {
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&countrycodes=pt&format=json&limit=1`,
              { headers: { 'User-Agent': 'Vitfix/1.0' } }
            )
            const geoData = await geoRes.json()
            if (geoData?.[0]) setSearchCoords({ lat: parseFloat(geoData[0].lat), lng: parseFloat(geoData[0].lon) })
            else setSearchCoords(null)
          } else {
            const geoRes = await fetch(
              `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(location)}&type=municipality&limit=1`
            )
            const geoData = await geoRes.json()
            if (geoData.features?.[0]) {
              const [geoLng, geoLat] = geoData.features[0].geometry.coordinates
              setSearchCoords({ lat: geoLat, lng: geoLng })
            } else setSearchCoords(null)
          }
        } catch { setSearchCoords(null) }
      } else {
        setSearchCoords(null)
      }

      setLoading(false)
    },
    []
  )

  // Initial load
  useEffect(() => {
    const cat = searchParams.get('category') || ''
    const loc = searchParams.get('loc') || ''
    // PT: show localized label in the input (not the raw French slug)
    const displayCat = cat && siteLocale === 'pt' ? (CATEGORY_LABELS_PT[cat] || cat) : cat
    setCategoryInput(displayCat)
    setLocationInput(loc)
    setActiveCategory(cat)
    setActiveLocation(loc)
    fetchData(cat, loc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ------------------------------------------------------------------
  // Search handler
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // Autocomplete logic
  // ------------------------------------------------------------------

  // Filtered specialty suggestions
  const filteredSpecialtySuggestions = useMemo(() => {
    if (!categoryInput.trim()) return SPECIALTY_SUGGESTIONS_FR.filter(s => s.type === 'primary')
    const norm = categoryInput.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return SPECIALTY_SUGGESTIONS_FR.filter(s =>
      s.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(norm) ||
      (s.subtitle && s.subtitle.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(norm))
    ).slice(0, 8)
  }, [categoryInput])

  // Fetch city suggestions from API (debounced via useEffect)
  useEffect(() => {
    if (!locDropOpen) return
    if (locationInput.length < 2) { setCitySuggestions([]); return }
    setCitySuggestionsLoading(true)
    const timer = setTimeout(async () => {
      try {
        if (siteLocale === 'pt') {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationInput)}&countrycodes=pt&format=json&limit=6&addressdetails=1`, { headers: { 'User-Agent': 'Vitfix/1.0' } })
          const data = await res.json()
          setCitySuggestions((data || []).map((r: Record<string, unknown>) => ({ label: String(r.display_name).split(',')[0] })))
        } else {
          const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(locationInput)}&type=municipality&limit=6&autocomplete=1`)
          const data = await res.json()
          setCitySuggestions((data.features || []).map((f: { properties: { city?: string; label?: string; postcode?: string } }) => ({
            label: `${f.properties.city || f.properties.label}${f.properties.postcode ? ' (' + f.properties.postcode + ')' : ''}`,
          })))
        }
      } catch { setCitySuggestions([]) }
      finally { setCitySuggestionsLoading(false) }
    }, 250)
    return () => clearTimeout(timer)
  }, [locationInput, locDropOpen, siteLocale])

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) { setCatDropOpen(false); setCatHighlight(-1) }
      if (locRef.current && !locRef.current.contains(e.target as Node)) { setLocDropOpen(false); setLocHighlight(-1) }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard nav for specialty dropdown
  const handleCategoryKeyDown = (e: React.KeyboardEvent) => {
    if (!catDropOpen) { if (e.key === 'ArrowDown') setCatDropOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCatHighlight(h => Math.min(h + 1, filteredSpecialtySuggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCatHighlight(h => Math.max(h - 1, -1)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (catHighlight >= 0 && filteredSpecialtySuggestions[catHighlight]) {
        const s = filteredSpecialtySuggestions[catHighlight]
        const localLabel = siteLocale === 'pt' ? (CATEGORY_LABELS_PT[s.category] || s.label) : s.label
        setCategoryInput(localLabel); setCatDropOpen(false); setCatHighlight(-1)
      } else { setCatDropOpen(false); handleSearch() }
    }
    else if (e.key === 'Escape') { setCatDropOpen(false); setCatHighlight(-1) }
  }

  // Keyboard nav for city dropdown (index 0 = "Autour de moi", 1+ = citySuggestions)
  const allLocSuggestions = useMemo(() => [
    { label: tp('Autour de moi', 'Perto de mim'), isGeo: true },
    ...citySuggestions.map(s => ({ ...s, isGeo: false })),
  ], [citySuggestions, siteLocale]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLocationKeyDown = (e: React.KeyboardEvent) => {
    if (!locDropOpen) { if (e.key === 'ArrowDown') setLocDropOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setLocHighlight(h => Math.min(h + 1, allLocSuggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setLocHighlight(h => Math.max(h - 1, -1)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (locHighlight === 0) { handleGeolocate(); setLocDropOpen(false) }
      else if (locHighlight > 0 && allLocSuggestions[locHighlight]) {
        setLocationInput(allLocSuggestions[locHighlight].label); setLocDropOpen(false); setLocHighlight(-1)
      } else { setLocDropOpen(false); handleSearch() }
    }
    else if (e.key === 'Escape') { setLocDropOpen(false); setLocHighlight(-1) }
  }

  const handleSearch = () => {
    setActiveCategory(categoryInput)
    setActiveLocation(locationInput)

    // Update URL params
    const params = new URLSearchParams()
    if (categoryInput) params.set('category', categoryInput)
    if (locationInput) params.set('loc', locationInput)
    router.push(`/fr/recherche?${params.toString()}`)

    fetchData(categoryInput, locationInput)
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

        // Détecter le pays pour le reverse geocoding adaptatif
        const localeCookie = document.cookie.match(/(?:^|;\s*)locale=(\w+)/)?.[1]
        const isPortugal = localeCookie === 'pt' ||
          (latitude >= 36.9 && latitude <= 42.2 && longitude >= -9.6 && longitude <= -6.1)

        try {
          let city = '', postcode = ''
          if (isPortugal) {
            // API Nominatim pour le Portugal
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt&countrycodes=pt`,
              { headers: { 'User-Agent': 'Vitfix/1.0' } }
            )
            const data = await res.json()
            city = data?.address?.city || data?.address?.town || data?.address?.village || ''
            postcode = data?.address?.postcode || ''
          } else {
            // API adresse.data.gouv.fr pour la France
            const res = await fetch(
              `https://api-adresse.data.gouv.fr/reverse/?lon=${longitude}&lat=${latitude}`
            )
            const data = await res.json()
            const feature = data?.features?.[0]
            if (feature) {
              city = feature.properties?.city || feature.properties?.municipality || ''
              postcode = feature.properties?.postcode || ''
            }
          }

          const label = city ? `${city} (${postcode})` : postcode || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          setLocationInput(label)
        } catch {
          setLocationInput(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
        }

        setGeoLoading(false)
        // Lancer la recherche automatiquement après géoloc
        setTimeout(() => {
          setActiveCategory(categoryInput)
          const params = new URLSearchParams()
          if (categoryInput) params.set('category', categoryInput)
          router.push(`/fr/recherche?${params.toString()}`)
          fetchData(categoryInput, '')
        }, 100)
      },
      (err) => {
        setGeoLoading(false)
        const localeCookie = document.cookie.match(/(?:^|;\s*)locale=(\w+)/)?.[1]
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError(localeCookie === 'pt'
            ? 'Acesso à localização recusado. Autorize a geolocalização no seu navegador.'
            : 'Accès à la localisation refusé. Autorisez la géolocalisation dans votre navigateur.'
          )
        } else {
          setGeoError(localeCookie === 'pt'
            ? 'Impossível obter a sua posição. Tente novamente.'
            : 'Impossible de récupérer votre position. Réessayez.'
          )
        }
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    )
  }

  // ------------------------------------------------------------------
  // Filtered artisans
  // ------------------------------------------------------------------

  const filteredArtisans = useMemo(() => {
    let filtered = [...artisans]

    // Verified filter
    if (filters.verifiedOnly) {
      filtered = filtered.filter((a) => a.verified)
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

      filtered = filtered.filter((artisan) => {
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

    // Filtrer par rayon si géolocalisation active (max 50 km)
    if (userCoords) {
      filtered = filtered.filter(a => {
        if (a.distance_km == null) return true // Pas de coords → on garde quand même
        return a.distance_km <= 50
      })
    }

    // ── Algorithme de présentation équitable ──────────────────────────
    // Règle absolue : inscrits VITFIX toujours avant le catalogue.
    // Au sein de chaque groupe : rotation toutes les 4h (seed temporel)
    // pour éviter tout favoritisme permanent.
    // Si géoloc active : les inscrits sont triés par distance (objectif),
    // le catalogue reste en rotation.

    const seed = getTimeSlotSeed()

    // Séparer les deux groupes
    const registeredArtisans = filtered.filter(a => a.source !== 'catalogue')
    const catalogueArtisans  = filtered.filter(a => a.source === 'catalogue')

    // Point de référence : GPS (autour de moi) ou coords de la ville saisie (geocodée)
    const refCoords = userCoords || searchCoords

    // Distance haversine inline (km)
    const haversine = (a: Artisan): number => {
      if (!refCoords || !a.latitude || !a.longitude) return 9999
      const R = 6371
      const dLat = (a.latitude - refCoords.lat) * Math.PI / 180
      const dLon = (a.longitude - refCoords.lng) * Math.PI / 180
      const s = Math.sin(dLat / 2) ** 2
        + Math.cos(refCoords.lat * Math.PI / 180) * Math.cos(a.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2
      return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
    }

    // Groupe 1 — Inscrits VITFIX
    let sortedRegistered: Artisan[]
    if (refCoords) {
      // Coordonnées disponibles (GPS ou ville geocodée) → tri par distance croissante
      sortedRegistered = [...registeredArtisans].sort((a, b) => haversine(a) - haversine(b))
    } else {
      // Aucune localisation → rotation équitable toutes les 4h
      sortedRegistered = seededShuffle(registeredArtisans, seed)
    }

    // Groupe 2 — Catalogue SIRENE (toujours après les inscrits)
    // Rotation toutes les 4h, seed décalé pour varier indépendamment du groupe 1
    const sortedCatalogue = seededShuffle(catalogueArtisans, seed + 1)

    return [...sortedRegistered, ...sortedCatalogue]
  }, [artisans, filters, allAvailability, allBookings, userCoords, searchCoords])

  // ------------------------------------------------------------------
  // Subtitle text
  // ------------------------------------------------------------------

  const subtitleText = useMemo(() => {
    const parts: string[] = []
    if (siteLocale === 'pt') {
      if (activeCategory) {
        parts.push(`${getCategoryLabel(activeCategory, 'pt')}s verificados`)
      } else {
        parts.push('Profissionais verificados')
      }
      if (activeLocation) parts.push(`em ${activeLocation}`)
      parts.push('com disponibilidade em tempo real')
    } else {
      if (activeCategory) {
        parts.push(`${getCategoryLabel(activeCategory)}s verifies`)
      } else {
        parts.push('Artisans vérifiés')
      }
      if (activeLocation) parts.push(`a ${activeLocation}`)
      parts.push('avec disponibilités en temps réel')
    }
    return parts.join(' ')
  }, [activeCategory, activeLocation, siteLocale])

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-warm-gray">
      <h1 className="sr-only">Rechercher un artisan près de chez vous</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://vitfix.io/' },
              { '@type': 'ListItem', position: 2, name: 'Rechercher un artisan', item: 'https://vitfix.io/recherche/' },
            ],
          }),
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Titre résultats ── */}
        <div className="mb-5">
          <h1 className="font-display text-2xl sm:text-3xl font-black text-dark tracking-[-0.03em]">
            {loading ? (
              tp('Recherche en cours...', 'A pesquisar...')
            ) : (
              siteLocale === 'pt'
                ? <>{filteredArtisans.length} profissional{filteredArtisans.length !== 1 ? 'is' : ''} disponível{filteredArtisans.length !== 1 ? 'eis' : ''}</>
                : <>{filteredArtisans.length} artisan{filteredArtisans.length !== 1 ? 's' : ''} disponible{filteredArtisans.length !== 1 ? 's' : ''}</>
            )}
          </h1>
          {!loading && (
            <p className="text-gray-500 mt-1 text-sm sm:text-base">{subtitleText}</p>
          )}
        </div>

        {/* ── Barre de recherche (fond gris, sans carte blanche) ── */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Input spécialité avec autocomplete */}
            <div ref={catRef} className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
              <input
                type="text"
                value={categoryInput}
                onChange={(e) => { setCategoryInput(e.target.value); setCatDropOpen(true); setCatHighlight(-1) }}
                onFocus={() => setCatDropOpen(true)}
                onKeyDown={handleCategoryKeyDown}
                placeholder={tp('Spécialité ou motif (ex: plombier, fuite...)', 'Especialidade (ex: canalizador, fuga...)')}
                aria-label="Rechercher une spécialité"
                className="w-full pl-9 pr-4 py-2.5 bg-white border-[1.5px] border-[#E0E0E0] rounded-xl focus:outline-none focus:border-yellow transition text-sm"
                autoComplete="off"
              />
              {catDropOpen && filteredSpecialtySuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-border z-50 overflow-hidden max-h-72 overflow-y-auto">
                  {filteredSpecialtySuggestions.map((s, i) => (
                    <button
                      key={s.label}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition text-sm cursor-pointer border-none ${i === catHighlight ? 'bg-amber-50' : 'hover:bg-[#F5F5F0]'}`}
                      onMouseDown={(e) => { e.preventDefault(); const ll = siteLocale === 'pt' ? (CATEGORY_LABELS_PT[s.category] || s.label) : s.label; setCategoryInput(ll); setCatDropOpen(false); setCatHighlight(-1) }}
                    >
                      <span className="text-base w-6 text-center flex-shrink-0">{s.icon}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-dark truncate">{siteLocale === 'pt' ? (CATEGORY_LABELS_PT[s.category] || s.label) : s.label}</p>
                        {s.subtitle && <p className="text-xs text-text-muted">{siteLocale === 'pt' ? (CATEGORY_LABELS_PT[s.category] || s.subtitle) : s.subtitle}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input ville avec autocomplete */}
            <div ref={locRef} className="relative flex-1 sm:max-w-[240px]">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
              <input
                type="text"
                value={locationInput}
                onChange={(e) => { setLocationInput(e.target.value); setUserCoords(null); setLocDropOpen(true); setLocHighlight(-1) }}
                onFocus={() => setLocDropOpen(true)}
                onKeyDown={handleLocationKeyDown}
                placeholder={tp('Ville ou code postal', 'Cidade ou código postal')}
                aria-label="Rechercher une ville"
                className={`w-full pl-9 pr-4 py-2.5 border-[1.5px] rounded-xl focus:outline-none focus:border-yellow transition text-sm ${userCoords ? 'border-yellow bg-amber-50' : 'bg-white border-[#E0E0E0]'}`}
                autoComplete="off"
              />
              {locDropOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-border z-50 overflow-hidden">
                  <button
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition text-sm cursor-pointer border-none ${locHighlight === 0 ? 'bg-amber-50' : 'hover:bg-[#F5F5F0]'}`}
                    onMouseDown={(e) => { e.preventDefault(); handleGeolocate(); setLocDropOpen(false) }}
                  >
                    {geoLoading
                      ? <svg className="w-4 h-4 animate-spin flex-shrink-0 text-yellow" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      : <MapPin className="w-4 h-4 text-yellow flex-shrink-0" />
                    }
                    <span className="font-semibold text-dark">{geoLoading ? tp('Localisation...', 'A localizar...') : tp('Autour de moi', 'Perto de mim')}</span>
                    {userCoords && !geoLoading && <span className="ml-auto text-xs text-green-600 font-medium">✓ Actif</span>}
                  </button>
                  {citySuggestionsLoading && <div className="px-4 py-2 text-xs text-text-muted">Recherche des villes...</div>}
                  {!citySuggestionsLoading && citySuggestions.map((s, i) => (
                    <button
                      key={s.label}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition text-sm cursor-pointer border-none ${i + 1 === locHighlight ? 'bg-amber-50' : 'hover:bg-[#F5F5F0]'}`}
                      onMouseDown={(e) => { e.preventDefault(); setLocationInput(s.label); setLocDropOpen(false); setLocHighlight(-1) }}
                    >
                      <MapPin className="w-4 h-4 text-text-muted flex-shrink-0" />
                      <span className="text-dark">{s.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bouton Rechercher */}
            <button
              onClick={() => { setCatDropOpen(false); setLocDropOpen(false); handleSearch() }}
              className="bg-yellow hover:bg-yellow-light text-dark px-6 py-2.5 rounded-xl font-semibold transition flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Search className="w-4 h-4" />
              {tp('Rechercher', 'Pesquisar')}
            </button>
          </div>

          {/* Géoloc feedback */}
          {geoError && (
            <div className="mt-2 flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span>⚠️</span><span>{geoError}</span>
              <button onClick={() => setGeoError('')} className="ml-auto text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
          {userCoords && !geoError && (
            <div className="mt-2 flex items-center gap-2 text-amber-700 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <MapPin className="w-3 h-3" />
              <span>{tp('Recherche autour de votre position', 'A pesquisar perto de si')}</span>
              <button onClick={() => { setUserCoords(null); setLocationInput('') }} className="ml-auto text-amber-500 hover:text-amber-700">
                ✕ {tp('Effacer', 'Limpar')}
              </button>
            </div>
          )}
        </div>

        {/* ── Chips filtres ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 mb-6">
          <button
            onClick={() => setFilterModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border-[1.5px] border-[#E0E0E0] rounded-full text-xs font-medium hover:border-yellow hover:bg-amber-50 transition whitespace-nowrap flex-shrink-0"
          >
            <SlidersHorizontal className="w-3 h-3" />
            {tp('Filtres', 'Filtros')}
          </button>
          <button
            onClick={() => { if (userCoords) { setUserCoords(null); setLocationInput('') } else { handleGeolocate() } }}
            disabled={geoLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 border-[1.5px] rounded-full text-xs font-medium transition whitespace-nowrap flex-shrink-0 disabled:opacity-60 ${userCoords ? 'border-yellow bg-amber-50 text-amber-700' : 'bg-white border-[#E0E0E0] hover:border-yellow hover:bg-amber-50 text-dark'}`}
          >
            <MapPin className="w-3 h-3" />
            {geoLoading ? tp('Localisation...', 'A localizar...') : tp('Autour de moi', 'Perto de mim')}
            {userCoords && !geoLoading && <X className="w-2.5 h-2.5 ml-0.5" />}
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, disponibilite: prev.disponibilite === '3days' ? 'all' : '3days' }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 border-[1.5px] rounded-full text-xs font-medium transition whitespace-nowrap flex-shrink-0 ${filters.disponibilite === '3days' ? 'border-yellow bg-amber-50 text-amber-700' : 'bg-white border-gray-200 hover:border-yellow hover:bg-amber-50'}`}
          >
            <Calendar className="w-3 h-3" />
            {tp('Disponibilités', 'Disponibilidades')}
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, disponibilite: prev.disponibilite === 'today' ? 'all' : 'today' }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 border-[1.5px] rounded-full text-xs font-medium transition whitespace-nowrap flex-shrink-0 ${filters.disponibilite === 'today' ? 'border-yellow bg-amber-50 text-amber-700' : 'bg-white border-gray-200 hover:border-yellow hover:bg-amber-50'}`}
          >
            <Zap className="w-3 h-3" />
            {tp('Intervention 24/7', 'Intervenção 24/7')}
          </button>
          {filters.verifiedOnly && (
            <button
              onClick={() => setFilters(prev => ({ ...prev, verifiedOnly: false }))}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium transition whitespace-nowrap flex-shrink-0"
            >
              <Check className="w-3 h-3" />
              {tp('Certifiés', 'Certificados')}
              <X className="w-3 h-3 ml-0.5" />
            </button>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-yellow border-t-transparent"></div>
            <p className="mt-4 text-gray-500">{tp('Recherche en cours...', 'A pesquisar...')}</p>
          </div>
        ) : filteredArtisans.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-[1.5px] border-[#EFEFEF]">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="font-display text-2xl font-black tracking-[-0.03em] mb-2 text-dark">
              {tp('Aucun artisan trouvé', 'Nenhum profissional encontrado')}
            </h3>
            <p className="text-gray-500 mb-6">
              {tp('Essayez de modifier vos critères de recherche ou vos filtres', 'Tente modificar os seus critérios de pesquisa ou filtros')}
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
                router.push('/fr/recherche')
              }}
              className="bg-yellow hover:bg-yellow-light text-gray-900 px-6 py-2.5 rounded-lg font-semibold transition"
            >
              {tp('Réinitialiser la recherche', 'Reiniciar a pesquisa')}
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
                locale={siteLocale}
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
        locale={siteLocale}
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
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow border-t-transparent"></div>
        </div>
      }
    >
      <RechercheContent />
    </Suspense>
  )
}
