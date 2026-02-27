'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import { Calendar, Clock, MapPin, Star, LogOut, User, Search, ChevronRight, Pencil, Save, X, Home, Shield, FileText, CheckCircle, AlertTriangle, Copy, Filter, FileSearch } from 'lucide-react'

type Booking = {
  id: string
  booking_date: string
  booking_time: string
  status: string
  address: string
  notes: string
  price_ttc: number
  duration_minutes: number
  artisan_id?: string
  confirmed_at?: string
  completed_at?: string
  services?: { name: string } | null
  profiles_artisan?: { company_name: string; rating_avg: number; rating_count?: number } | null
}

type CILEntry = {
  id: string
  bookingId: string
  date: string
  artisanName: string
  artisanId?: string
  serviceName: string
  category: 'plomberie' | 'electricite' | 'chauffage' | 'serrurerie' | 'peinture' | 'menuiserie' | 'autre'
  description: string
  address: string
  priceTTC: number
  hasProof: boolean
  proofPhotosCount: number
  hasSignature: boolean
  hasGPS: boolean
  warranty?: { type: string; endDate: string }
  nextMaintenance?: string
  notes?: string
  documents?: { name: string; type: string }[]
}

export default function ClientDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'logement' | 'analyse' | 'profile'>('upcoming')
  const [editingProfile, setEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')
  const [profileData, setProfileData] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
  })

  // Photo de profil client
  const [clientPhotoFile, setClientPhotoFile] = useState<File | null>(null)
  const [clientPhotoPreview, setClientPhotoPreview] = useState<string>('')
  const [clientPhotoUploading, setClientPhotoUploading] = useState(false)

  // ── Annulation ──
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  // ── Notation ──
  const [ratingModal, setRatingModal] = useState<Booking | null>(null)
  const [ratingVal, setRatingVal] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [ratings, setRatings] = useState<Record<string, { stars: number; comment: string }>>({})
  // ── GPS Tracking ──
  const [trackingModal, setTrackingModal] = useState<Booking | null>(null)
  const [trackingData, setTrackingData] = useState<Record<string, { lat: number; lng: number; eta: number; active: boolean }>>({})
  // ── Favoris ──
  const [favoris, setFavoris] = useState<string[]>([])

  // ── Carnet de Santé Logement ──
  const [cilEntries, setCilEntries] = useState<CILEntry[]>([])
  const [showCilDetail, setShowCilDetail] = useState<CILEntry | null>(null)
  const [cilFilter, setCilFilter] = useState<'all' | 'plomberie' | 'electricite' | 'chauffage' | 'serrurerie' | 'autre'>('all')

  // ── Analyse Devis ──
  const [analyseInput, setAnalyseInput] = useState('')
  const [analyseFilename, setAnalyseFilename] = useState('')
  const [analyseResult, setAnalyseResult] = useState('')
  const [analyseLoading, setAnalyseLoading] = useState(false)
  const [analyseInputMode, setAnalyseInputMode] = useState<'paste' | 'pdf'>('paste')
  const [analyseExtracting, setAnalyseExtracting] = useState(false)
  const [analysePdfReady, setAnalysePdfReady] = useState(false)
  const [analyseHistory, setAnalyseHistory] = useState<{date: string; filename: string; verdict: string}[]>([])

  useEffect(() => {
    let didLoad = false

    const initAuth = async () => {
      // Try getSession first (reads from storage, faster) then validate with getUser
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        didLoad = true
        setUser(session.user)
        await fetchBookings(session.user.id)
        return
      }

      // Fallback: try getUser (validates with server)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        didLoad = true
        setUser(currentUser)
        await fetchBookings(currentUser.id)
      } else {
        window.location.href = '/auth/login'
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/auth/login'
      }
      if (!didLoad && event === 'INITIAL_SESSION' && session?.user) {
        didLoad = true
        setUser(session.user)
        await fetchBookings(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchBookings = async (userId: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, services(name), profiles_artisan:artisan_id(company_name, rating_avg, rating_count)')
      .eq('client_id', userId)
      .order('booking_date', { ascending: false })

    if (error) {
      console.error('Error fetching bookings:', error)
    }
    setBookings((data as Booking[]) || [])
    // Generate Carnet de Santé entries
    generateCIL((data as Booking[]) || [])
    setLoading(false)
    // Charger les notes depuis localStorage
    try {
      const saved = localStorage.getItem(`fixit_client_ratings_${userId}`)
      if (saved) setRatings(JSON.parse(saved))
      const savedFavoris = localStorage.getItem(`fixit_client_favoris_${userId}`)
      if (savedFavoris) setFavoris(JSON.parse(savedFavoris))
      setAnalyseHistory(JSON.parse(localStorage.getItem('fixit_analyse_history_client') || '[]'))
    } catch {}
  }

  const initProfileData = (userData: any) => {
    const meta = userData?.user_metadata || {}
    setProfileData({
      fullName: meta.full_name || '',
      phone: meta.phone || '',
      address: meta.address || '',
      city: meta.city || '',
      postalCode: meta.postal_code || '',
    })
  }

  const startEditing = () => {
    initProfileData(user)
    setEditingProfile(true)
    setProfileSuccess('')
    setProfileError('')
  }

  const cancelEditing = () => {
    setEditingProfile(false)
    setProfileError('')
  }

  const saveProfile = async () => {
    if (!profileData.fullName.trim()) {
      setProfileError('Le nom est obligatoire')
      return
    }
    if (!profileData.phone || profileData.phone.length < 10) {
      setProfileError('Numéro de téléphone invalide')
      return
    }

    setSavingProfile(true)
    setProfileError('')
    setProfileSuccess('')

    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.fullName.trim(),
          phone: profileData.phone.trim(),
          address: profileData.address.trim(),
          city: profileData.city.trim(),
          postal_code: profileData.postalCode.trim(),
        },
      })

      if (error) {
        setProfileError(error.message)
      } else {
        setUser(data.user)
        setEditingProfile(false)
        setProfileSuccess('Profil mis à jour avec succès !')
        setTimeout(() => setProfileSuccess(''), 3000)
      }
    } catch {
      setProfileError('Erreur lors de la sauvegarde. Réessayez.')
    } finally {
      setSavingProfile(false)
    }
  }

  const uploadClientPhoto = async (file: File) => {
    setClientPhotoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('bucket', 'profile-photos')
      fd.append('folder', 'clients')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur upload')
      // Sauvegarder l'URL dans user_metadata
      await supabase.auth.updateUser({
        data: { profile_photo_url: data.url }
      })
      setUser((prev: any) => ({
        ...prev,
        user_metadata: { ...(prev?.user_metadata || {}), profile_photo_url: data.url }
      }))
      setClientPhotoFile(null)
      setClientPhotoPreview('')
      setProfileSuccess('Photo de profil mise à jour !')
      setTimeout(() => setProfileSuccess(''), 3000)
    } catch (err: any) {
      setProfileError(`Erreur upload photo: ${err.message}`)
    } finally {
      setClientPhotoUploading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // ── Annuler un RDV ──
  const cancelBooking = async (id: string) => {
    setCancellingId(id)
    try {
      await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b))
    } catch (e) { console.error(e) }
    setCancellingId(null)
    setCancelConfirm(null)
  }

  // ── Soumettre une notation ──
  const submitRating = async () => {
    if (!ratingModal || !user) return
    setRatingSubmitting(true)
    const newRatings = { ...ratings, [ratingModal.id]: { stars: ratingVal, comment: ratingComment } }
    setRatings(newRatings)
    try { localStorage.setItem(`fixit_client_ratings_${user.id}`, JSON.stringify(newRatings)) } catch {}
    // Update artisan rating_avg in DB
    try {
      const { data: artisanData } = await supabase
        .from('profiles_artisan')
        .select('rating_avg, rating_count')
        .eq('user_id', ratingModal.profiles_artisan ? (ratingModal as any).artisan_id : '')
        .single()
      if (artisanData) {
        const newCount = (artisanData.rating_count || 0) + 1
        const newAvg = ((artisanData.rating_avg || 0) * (artisanData.rating_count || 0) + ratingVal) / newCount
        await supabase.from('profiles_artisan').update({ rating_avg: Math.round(newAvg * 10) / 10, rating_count: newCount }).eq('user_id', (ratingModal as any).artisan_id)
      }
    } catch {}
    setRatingSubmitting(false)
    setRatingModal(null)
    setRatingComment('')
    setRatingVal(5)
  }

  // ── Charger GPS tracking ──
  const loadTracking = async (booking: Booking) => {
    setTrackingModal(booking)
    try {
      const { data } = await supabase
        .from('tracking_sessions')
        .select('*')
        .eq('booking_id', booking.id)
        .eq('status', 'active')
        .single()
      if (data) {
        setTrackingData(prev => ({
          ...prev,
          [booking.id]: { lat: data.lat, lng: data.lng, eta: data.eta_minutes || 0, active: true }
        }))
      }
    } catch {}
  }

  // ── Toggle favori artisan ──
  const toggleFavori = (artisanId: string) => {
    const next = favoris.includes(artisanId)
      ? favoris.filter(f => f !== artisanId)
      : [...favoris, artisanId]
    setFavoris(next)
    try { localStorage.setItem(`fixit_client_favoris_${user?.id}`, JSON.stringify(next)) } catch {}
  }

  // ── Générer le Carnet de Santé (CIL) depuis les bookings terminés ──
  const generateCIL = (bks: Booking[]) => {
    const proofs = JSON.parse(localStorage.getItem('fixit_proofs') || '[]')
    const entries: CILEntry[] = bks
      .filter(b => b.status === 'completed')
      .map(b => {
        const proof = proofs.find((p: any) => p.bookingId === b.id)
        const serviceName = (b.services?.name || '').toLowerCase()
        let category: CILEntry['category'] = 'autre'
        if (serviceName.match(/plomb|fuite|robinet|wc|sani|eau|tuyau/)) category = 'plomberie'
        else if (serviceName.match(/electr|prise|tableau|disj|câbl|inter/)) category = 'electricite'
        else if (serviceName.match(/chauff|chaudière|radiateur|thermo|clim/)) category = 'chauffage'
        else if (serviceName.match(/serrur|porte|clé|verrou|blind/)) category = 'serrurerie'
        else if (serviceName.match(/peint|mur|plaf|end/)) category = 'peinture'
        else if (serviceName.match(/menuis|bois|parquet|meuble|étagère/)) category = 'menuiserie'

        // Garantie par défaut : 2 ans structurel, 1 an pour le reste
        const warrantyEnd = new Date(b.booking_date)
        const isStructural = ['plomberie', 'electricite', 'chauffage'].includes(category)
        warrantyEnd.setFullYear(warrantyEnd.getFullYear() + (isStructural ? 2 : 1))

        // Prochaine maintenance suggérée à +1 an
        const nextMaint = new Date(b.booking_date)
        nextMaint.setFullYear(nextMaint.getFullYear() + 1)

        return {
          id: `cil-${b.id}`,
          bookingId: b.id,
          date: b.booking_date,
          artisanName: b.profiles_artisan?.company_name || 'Artisan',
          artisanId: b.artisan_id,
          serviceName: b.services?.name || 'Intervention',
          category,
          description: b.notes || '',
          address: b.address || '',
          priceTTC: b.price_ttc || 0,
          hasProof: !!proof,
          proofPhotosCount: proof ? (proof.beforePhotos?.length || 0) + (proof.afterPhotos?.length || 0) : 0,
          hasSignature: !!proof?.signature,
          hasGPS: !!(proof?.gpsLat && proof?.gpsLng),
          warranty: { type: isStructural ? 'Garantie biennale' : 'Garantie annuelle', endDate: warrantyEnd.toISOString().split('T')[0] },
          nextMaintenance: nextMaint.toISOString().split('T')[0],
        }
      })
    setCilEntries(entries)
  }

  // ── Score de santé du logement ──
  const getCILHealthScore = (): number => {
    if (cilEntries.length === 0) return 0
    let score = 0
    let total = 0
    const now = new Date()
    cilEntries.forEach(e => {
      // Proof coverage (+30 points max)
      total += 30
      if (e.hasProof) score += 15
      if (e.hasSignature) score += 10
      if (e.hasGPS) score += 5

      // Warranty status (+40 points max)
      total += 40
      if (e.warranty) {
        const wEnd = new Date(e.warranty.endDate)
        if (wEnd > now) {
          score += 40 // Under warranty
        } else {
          const monthsExpired = (now.getTime() - wEnd.getTime()) / (1000 * 60 * 60 * 24 * 30)
          if (monthsExpired < 6) score += 20 // Recently expired
        }
      }

      // Maintenance (+30 points max)
      total += 30
      if (e.nextMaintenance) {
        const mDate = new Date(e.nextMaintenance)
        if (mDate > now) score += 30
        else {
          const monthsOverdue = (now.getTime() - mDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
          if (monthsOverdue < 3) score += 15
        }
      }
    })
    return total > 0 ? Math.round((score / total) * 100) : 0
  }

  // ── Catégorie label + icône CIL ──
  const getCategoryInfo = (cat: CILEntry['category']): { label: string; icon: string; color: string } => {
    switch (cat) {
      case 'plomberie': return { label: 'Plomberie', icon: '\uD83D\uDEB0', color: 'bg-blue-100 text-blue-700' }
      case 'electricite': return { label: '\u00C9lectricit\u00E9', icon: '\u26A1', color: 'bg-yellow-100 text-yellow-700' }
      case 'chauffage': return { label: 'Chauffage', icon: '\uD83D\uDD25', color: 'bg-orange-100 text-orange-700' }
      case 'serrurerie': return { label: 'Serrurerie', icon: '\uD83D\uDD11', color: 'bg-purple-100 text-purple-700' }
      case 'peinture': return { label: 'Peinture', icon: '\uD83C\uDFA8', color: 'bg-pink-100 text-pink-700' }
      case 'menuiserie': return { label: 'Menuiserie', icon: '\uD83E\uDE9A', color: 'bg-amber-100 text-amber-700' }
      default: return { label: 'Autre', icon: '\uD83D\uDD27', color: 'bg-gray-100 text-gray-700' }
    }
  }

  // ── Exporter le CIL en texte formaté ──
  const exportCIL = () => {
    const lines: string[] = [
      '=== CARNET D\'INFORMATION DU LOGEMENT (CIL) ===',
      `G\u00E9n\u00E9r\u00E9 le ${new Date().toLocaleDateString('fr-FR')}`,
      `Score de sant\u00E9 : ${getCILHealthScore()}%`,
      `Nombre d'interventions : ${cilEntries.length}`,
      '',
      '--- INTERVENTIONS ---',
      '',
    ]
    cilEntries.forEach((e, i) => {
      const catInfo = getCategoryInfo(e.category)
      lines.push(`${i + 1}. ${e.serviceName}`)
      lines.push(`   Date : ${new Date(e.date).toLocaleDateString('fr-FR')}`)
      lines.push(`   Cat\u00E9gorie : ${catInfo.label}`)
      lines.push(`   Artisan : ${e.artisanName}`)
      lines.push(`   Adresse : ${e.address || 'Non renseign\u00E9e'}`)
      lines.push(`   Montant TTC : ${formatPrice(e.priceTTC)}`)
      lines.push(`   Preuve de travaux : ${e.hasProof ? 'Oui' : 'Non'} | Photos : ${e.proofPhotosCount} | Signature : ${e.hasSignature ? 'Oui' : 'Non'} | GPS : ${e.hasGPS ? 'Oui' : 'Non'}`)
      if (e.warranty) lines.push(`   Garantie : ${e.warranty.type} (jusqu'au ${new Date(e.warranty.endDate).toLocaleDateString('fr-FR')})`)
      if (e.nextMaintenance) lines.push(`   Prochaine maintenance : ${new Date(e.nextMaintenance).toLocaleDateString('fr-FR')}`)
      lines.push('')
    })
    lines.push('--- FIN DU CARNET ---')
    navigator.clipboard.writeText(lines.join('\n'))
    alert('Carnet copi\u00E9 dans le presse-papier !')
  }

  const filteredCilEntries = cilFilter === 'all'
    ? cilEntries
    : cilEntries.filter(e => e.category === cilFilter)

  const today = new Date().toISOString().split('T')[0]
  const upcomingBookings = bookings.filter(b => b.booking_date >= today && b.status !== 'cancelled')
  const pastBookings = bookings.filter(b => b.booking_date < today || b.status === 'cancelled')

  // ── Score de ponctualité par artisan (% interventions réalisées vs acceptées) ──
  const getPonctualiteScore = (artisanId: string | undefined): number | null => {
    if (!artisanId) return null
    const artisanBookings = bookings.filter(b => b.artisan_id === artisanId)
    const completed = artisanBookings.filter(b => b.status === 'completed').length
    const total = artisanBookings.filter(b => ['completed', 'confirmed', 'cancelled'].includes(b.status)).length
    if (total < 2) return null
    return Math.round((completed / total) * 100)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Confirm&eacute;</span>
      case 'pending':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">En attente</span>
      case 'completed':
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">Termin&eacute;</span>
      case 'cancelled':
        return <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Annul&eacute;</span>
      default:
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">{status}</span>
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FFC107] border-t-transparent"></div>
      </div>
    )
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Client'
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-3xl">{'\u26A1'}</span>
              <span className="text-2xl font-bold text-[#FFC107]">VitFix</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/recherche" className="hidden sm:flex items-center gap-2 text-gray-600 hover:text-[#FFC107] transition text-sm font-medium">
                <Search className="w-4 h-4" />
                Trouver un artisan
              </Link>
              {/* Notif bell */}
              {bookings.filter(b => b.status === 'pending').length > 0 && (
                <button
                  onClick={() => setActiveTab('upcoming')}
                  className="relative p-1.5 text-gray-400 hover:text-[#FFC107] transition"
                  title="Réservations en attente"
                >
                  <span className="text-xl">🔔</span>
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {bookings.filter(b => b.status === 'pending').length}
                  </span>
                </button>
              )}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#FFC107] flex-shrink-0 bg-[#FFC107] flex items-center justify-center">
                  {user?.user_metadata?.profile_photo_url ? (
                    <img src={user.user_metadata.profile_photo_url} alt="Photo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-white">{userInitials}</span>
                  )}
                </div>
                <span className="hidden sm:block text-sm font-semibold text-gray-800">{userName}</span>
              </div>
              <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition p-1" title="D&eacute;connexion">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Bonjour {userName.split(' ')[0]} {'\uD83D\uDC4B'}</h1>
          <p className="text-gray-500 mt-1">G&eacute;rez vos r&eacute;servations et retrouvez vos artisans</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl shadow-sm">
            <div className="text-sm text-gray-500 mb-1">R&eacute;servations</div>
            <div className="text-2xl font-bold">{bookings.length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm">
            <div className="text-sm text-gray-500 mb-1">{'\u00C0'} venir</div>
            <div className="text-2xl font-bold text-[#FFC107]">{upcomingBookings.length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm">
            <div className="text-sm text-gray-500 mb-1">Termin&eacute;es</div>
            <div className="text-2xl font-bold text-green-500">{pastBookings.filter(b => b.status === 'completed').length}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm">
            <div className="text-sm text-gray-500 mb-1">En attente</div>
            <div className="text-2xl font-bold text-amber-500">{bookings.filter(b => b.status === 'pending').length}</div>
          </div>
        </div>

        {/* Quick action */}
        <Link
          href="/recherche"
          className="flex items-center justify-between bg-gradient-to-r from-[#FFC107] to-[#FFD54F] text-gray-900 rounded-2xl p-6 mb-8 hover:shadow-lg transition group"
        >
          <div>
            <h3 className="text-lg font-bold">Besoin d&apos;un artisan ?</h3>
            <p className="text-sm opacity-80">Trouvez un professionnel v&eacute;rifi&eacute; pr&egrave;s de chez vous</p>
          </div>
          <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </Link>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 max-w-2xl">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition ${
              activeTab === 'upcoming' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {'\u00C0'} venir ({upcomingBookings.length})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition ${
              activeTab === 'past' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Historique ({pastBookings.length})
          </button>
          <button
            onClick={() => setActiveTab('logement')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'logement' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            Logement
          </button>
          <button
            onClick={() => setActiveTab('analyse')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'analyse' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileSearch className="w-3.5 h-3.5" />
            Analyser
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'profile' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Mon profil
          </button>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'logement' ? (
          /* ============== LOGEMENT / CIL TAB ============== */
          <div className="space-y-6">
            {/* Health Score Header */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${
                    getCILHealthScore() >= 75 ? 'bg-green-100 text-green-700' :
                    getCILHealthScore() >= 50 ? 'bg-amber-100 text-amber-700' :
                    getCILHealthScore() >= 25 ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {getCILHealthScore()}%
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-[#FFC107]" />
                      Carnet de Sant{'\u00E9'} du Logement
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {cilEntries.length} intervention{cilEntries.length > 1 ? 's' : ''} enregistr{'\u00E9'}e{cilEntries.length > 1 ? 's' : ''}
                      {' '}&bull;{' '}Obligation l{'\u00E9'}gale CIL depuis 2023
                    </p>
                  </div>
                </div>
                <button
                  onClick={exportCIL}
                  disabled={cilEntries.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Copy className="w-4 h-4" />
                  Exporter le CIL
                </button>
              </div>

              {/* Health score bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                  <span>Score de sant{'\u00E9'} global</span>
                  <span className={`font-semibold ${
                    getCILHealthScore() >= 75 ? 'text-green-600' :
                    getCILHealthScore() >= 50 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {getCILHealthScore() >= 75 ? 'Bon \u00E9tat' :
                     getCILHealthScore() >= 50 ? 'Attention requise' :
                     getCILHealthScore() >= 25 ? 'Maintenance n\u00E9cessaire' : 'Aucune donn\u00E9e'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      getCILHealthScore() >= 75 ? 'bg-green-500' :
                      getCILHealthScore() >= 50 ? 'bg-amber-500' :
                      getCILHealthScore() >= 25 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${getCILHealthScore()}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Category filter chips */}
            {cilEntries.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-gray-400" />
                {([
                  { key: 'all' as const, label: 'Tout' },
                  { key: 'plomberie' as const, label: 'Plomberie' },
                  { key: 'electricite' as const, label: '\u00C9lectricit\u00E9' },
                  { key: 'chauffage' as const, label: 'Chauffage' },
                  { key: 'serrurerie' as const, label: 'Serrurerie' },
                  { key: 'autre' as const, label: 'Autre' },
                ]).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setCilFilter(f.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                      cilFilter === f.key
                        ? 'bg-[#FFC107] text-gray-900 shadow-sm'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {f.label}
                    {f.key !== 'all' && ` (${cilEntries.filter(e => e.category === f.key).length})`}
                  </button>
                ))}
              </div>
            )}

            {/* Timeline entries */}
            {filteredCilEntries.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <div className="text-5xl mb-4">{'\uD83C\uDFE0'}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {cilEntries.length === 0 ? 'Aucune intervention enregistr\u00E9e' : 'Aucune intervention dans cette cat\u00E9gorie'}
                </h3>
                <p className="text-gray-500 mb-4 max-w-md mx-auto">
                  {cilEntries.length === 0
                    ? 'Votre carnet de sant\u00E9 se remplira automatiquement apr\u00E8s chaque intervention termin\u00E9e par un artisan VitFix.'
                    : 'Essayez un autre filtre pour voir vos interventions.'
                  }
                </p>
                {cilEntries.length === 0 && (
                  <Link
                    href="/recherche"
                    className="inline-block bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-3 rounded-lg font-semibold transition"
                  >
                    R{'\u00E9'}server une intervention
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCilEntries.map((entry, idx) => {
                  const catInfo = getCategoryInfo(entry.category)
                  const now = new Date()
                  const warrantyActive = entry.warranty ? new Date(entry.warranty.endDate) > now : false
                  const maintenanceOverdue = entry.nextMaintenance ? new Date(entry.nextMaintenance) < now : false

                  return (
                    <button
                      key={entry.id}
                      onClick={() => setShowCilDetail(entry)}
                      className="w-full text-left bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition group"
                    >
                      <div className="flex items-start gap-4">
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${catInfo.color}`}>
                            {catInfo.icon}
                          </div>
                          {idx < filteredCilEntries.length - 1 && (
                            <div className="w-0.5 h-8 bg-gray-200 mt-2" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-gray-900 truncate">{entry.serviceName}</h4>
                            <span className="text-sm font-semibold text-[#FFC107] flex-shrink-0">{formatPrice(entry.priceTTC)}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="truncate">{entry.artisanName}</span>
                          </div>

                          {/* Status badges */}
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {/* Proof badge */}
                            {entry.hasProof ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[11px] font-medium border border-green-200">
                                <CheckCircle className="w-3 h-3" /> Preuve
                                {entry.proofPhotosCount > 0 && <span>({entry.proofPhotosCount} photos)</span>}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full text-[11px] font-medium border border-gray-200">
                                Sans preuve
                              </span>
                            )}
                            {/* Signature */}
                            {entry.hasSignature && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[11px] font-medium border border-blue-200">
                                {'\u270D\uFE0F'} Sign{'\u00E9'}
                              </span>
                            )}
                            {/* GPS */}
                            {entry.hasGPS && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[11px] font-medium border border-purple-200">
                                <MapPin className="w-3 h-3" /> GPS
                              </span>
                            )}
                            {/* Warranty */}
                            {warrantyActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-medium border border-emerald-200">
                                <Shield className="w-3 h-3" /> Sous garantie
                              </span>
                            ) : entry.warranty ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[11px] font-medium border border-red-200">
                                <AlertTriangle className="w-3 h-3" /> Garantie expir{'\u00E9'}e
                              </span>
                            ) : null}
                            {/* Maintenance overdue */}
                            {maintenanceOverdue && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[11px] font-medium border border-amber-200">
                                <AlertTriangle className="w-3 h-3" /> Maintenance en retard
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Arrow */}
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#FFC107] transition flex-shrink-0 mt-1" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Summary stats */}
            {cilEntries.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl shadow-sm text-center">
                  <div className="text-2xl font-bold text-gray-900">{cilEntries.length}</div>
                  <div className="text-xs text-gray-500 mt-1">Interventions</div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm text-center">
                  <div className="text-2xl font-bold text-green-600">{cilEntries.filter(e => e.hasProof).length}</div>
                  <div className="text-xs text-gray-500 mt-1">Avec preuve</div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm text-center">
                  <div className="text-2xl font-bold text-emerald-600">
                    {cilEntries.filter(e => e.warranty && new Date(e.warranty.endDate) > new Date()).length}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Sous garantie</div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm text-center">
                  <div className="text-2xl font-bold text-[#FFC107]">{formatPrice(cilEntries.reduce((sum, e) => sum + e.priceTTC, 0))}</div>
                  <div className="text-xs text-gray-500 mt-1">Total d{'\u00E9'}pens{'\u00E9'}</div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'analyse' ? (
          /* ============== ANALYSE DEVIS TAB ============== */
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <FileSearch className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Analyse de devis</h2>
                  <p className="text-blue-100 text-sm">V{'\u00E9'}rifiez un devis avant de l{'\u2019'}accepter</p>
                </div>
              </div>
              <div className="flex gap-4 mt-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-green-300" />
                  <span>Prix du march{'\u00E9'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-green-300" />
                  <span>Conformit{'\u00E9'} l{'\u00E9'}gale</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-yellow-300" />
                  <span>D{'\u00E9'}tection arnaques</span>
                </div>
              </div>
            </div>

            {/* Input mode toggle */}
            {!analyseResult && (
              <div>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => { setAnalyseInputMode('paste'); setAnalysePdfReady(false) }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                      analyseInputMode === 'paste' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Coller le texte
                  </button>
                  <button
                    onClick={() => setAnalyseInputMode('pdf')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                      analyseInputMode === 'pdf' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Importer un PDF
                  </button>
                </div>

                {analyseInputMode === 'paste' ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={analyseFilename}
                      onChange={e => setAnalyseFilename(e.target.value)}
                      placeholder="Nom du document (optionnel)"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <textarea
                      value={analyseInput}
                      onChange={e => setAnalyseInput(e.target.value)}
                      rows={10}
                      placeholder={"Collez ici le texte du devis ou de la facture...\n\nAstuce : ouvrez le devis PDF, s\u00E9lectionnez tout (Ctrl+A), copiez (Ctrl+C) puis collez ici."}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none font-mono"
                    />
                    {analyseInput && (
                      <div className="text-xs text-gray-400 text-right">{analyseInput.length} caract{'\u00E8'}res</div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!analysePdfReady ? (
                      <label className="block border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setAnalyseExtracting(true)
                            setAnalyseFilename(file.name)
                            try {
                              const { data: { session } } = await supabase.auth.getSession()
                              const fd = new FormData()
                              fd.append('file', file)
                              const res = await fetch('/api/client/extract-pdf', {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${session?.access_token}` },
                                body: fd,
                              })
                              const data = await res.json()
                              if (data.success) {
                                setAnalyseInput(data.text)
                                setAnalysePdfReady(true)
                              } else {
                                alert(data.error || 'Erreur extraction PDF')
                                if (data.isScanned) setAnalyseInputMode('paste')
                              }
                            } catch { alert('Erreur r\u00E9seau') }
                            finally { setAnalyseExtracting(false) }
                          }}
                        />
                        {analyseExtracting ? (
                          <div>
                            <div className="text-3xl mb-2 animate-pulse">{'\u23F3'}</div>
                            <div className="font-semibold text-gray-700">Extraction en cours...</div>
                            <div className="text-sm text-gray-400">Lecture du PDF</div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-3xl mb-2">{'\uD83D\uDCC4'}</div>
                            <div className="font-semibold text-gray-700">Cliquez pour importer un PDF</div>
                            <div className="text-sm text-gray-400 mt-1">Devis ou facture au format PDF (max 20 Mo)</div>
                          </div>
                        )}
                      </label>
                    ) : (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-semibold text-sm">PDF extrait : {analyseFilename}</span>
                        </div>
                        <div className="text-xs text-green-600 mt-1">{analyseInput.length} caract{'\u00E8'}res extraits</div>
                        <button onClick={() => { setAnalysePdfReady(false); setAnalyseInput(''); setAnalyseFilename('') }} className="text-xs text-green-600 underline mt-1">Changer de fichier</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Analyze button */}
                <button
                  disabled={analyseLoading || analyseInput.trim().length < 20}
                  onClick={async () => {
                    setAnalyseLoading(true)
                    setAnalyseResult('')
                    try {
                      const { data: { session } } = await supabase.auth.getSession()
                      const res = await fetch('/api/client/analyse-devis', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${session?.access_token}`,
                        },
                        body: JSON.stringify({ content: analyseInput, filename: analyseFilename }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        setAnalyseResult(data.analysis)
                        // Save to history
                        const verdict = data.analysis.match(/Verdict.*?:\s*(.+)/)?.[1]?.trim() || ''
                        const hist = [...analyseHistory, { date: new Date().toISOString(), filename: analyseFilename || 'Sans nom', verdict }].slice(-10)
                        setAnalyseHistory(hist)
                        try { localStorage.setItem('fixit_analyse_history_client', JSON.stringify(hist)) } catch {}
                      } else {
                        alert(data.error || 'Erreur analyse')
                      }
                    } catch { alert('Erreur r\u00E9seau') }
                    finally { setAnalyseLoading(false) }
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-4 rounded-xl text-sm transition flex items-center justify-center gap-2 mt-4"
                >
                  {analyseLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      <FileSearch className="w-4 h-4" />
                      Analyser ce devis
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Results */}
            {analyseResult && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(analyseResult)
                    }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copier
                  </button>
                  <button
                    onClick={() => { setAnalyseResult(''); setAnalyseInput(''); setAnalyseFilename(''); setAnalysePdfReady(false) }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
                  >
                    Analyser un autre
                  </button>
                </div>

                <div
                  className="bg-white border border-gray-200 rounded-2xl p-6 prose prose-sm max-w-none
                    [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-gray-900
                    [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2
                    [&_table]:w-full [&_table]:text-sm [&_table]:border-collapse [&_table]:mt-3 [&_table]:mb-3
                    [&_th]:bg-gray-50 [&_th]:border [&_th]:border-gray-200 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-gray-700
                    [&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2
                    [&_hr]:my-4 [&_hr]:border-gray-200
                    [&_strong]:font-bold
                    [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:space-y-1
                    [&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:space-y-1
                    [&_p]:mb-2 [&_p]:leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: analyseResult
                    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/^---$/gm, '<hr/>')
                    .replace(/^\| (.+)$/gm, (match: string) => {
                      const cells = match.split('|').filter((c: string) => c.trim())
                      if (cells.every((c: string) => c.trim().match(/^[-:]+$/))) return ''
                      const tag = 'td'
                      return '<tr>' + cells.map((c: string) => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>'
                    })
                    .replace(/((<tr>.*<\/tr>\s*)+)/g, '<table>$1</table>')
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/\n/g, '<br/>')
                  }}
                />
              </div>
            )}

            {/* History */}
            {analyseHistory.length > 0 && !analyseResult && (
              <div>
                <h3 className="text-sm font-bold text-gray-500 mb-3">Derni{'\u00E8'}res analyses</h3>
                <div className="space-y-2">
                  {analyseHistory.slice().reverse().map((h, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{h.filename}</div>
                        <div className="text-xs text-gray-400">{new Date(h.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">{h.verdict.substring(0, 30) || 'Analys\u00E9'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trust banner */}
            {!analyseResult && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-blue-800 text-sm">100% confidentiel</div>
                    <div className="text-xs text-blue-600 mt-0.5">Vos documents sont analys{'\u00E9'}s par IA et ne sont jamais stock{'\u00E9'}s sur nos serveurs. L{'\u2019'}analyse est instantan{'\u00E9'}e et priv{'\u00E9'}e.</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'profile' ? (
          /* ============== PROFILE TAB ============== */
          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-xl flex items-center gap-2">
                <User className="w-5 h-5" />
                Mon profil
              </h3>
              {!editingProfile && (
                <button
                  onClick={startEditing}
                  className="flex items-center gap-2 px-4 py-2 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 rounded-lg font-semibold transition text-sm"
                >
                  <Pencil className="w-4 h-4" />
                  Modifier
                </button>
              )}
            </div>

            {/* Photo de profil */}
            <div className="flex items-center gap-5 mb-6 pb-6 border-b border-gray-100">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0 bg-gray-100 flex items-center justify-center">
                {clientPhotoPreview ? (
                  <img src={clientPhotoPreview} alt="Aperçu" className="w-full h-full object-cover" />
                ) : user?.user_metadata?.profile_photo_url ? (
                  <img src={user.user_metadata.profile_photo_url} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-gray-400">{userInitials}</span>
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-lg">{userName}</p>
                <p className="text-sm text-gray-500 mb-2">{user?.email}</p>
                <label className="cursor-pointer inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium transition">
                  📷 {clientPhotoFile ? clientPhotoFile.name : 'Changer la photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setClientPhotoFile(f)
                    const reader = new FileReader()
                    reader.onload = (ev) => setClientPhotoPreview(ev.target?.result as string)
                    reader.readAsDataURL(f)
                  }} />
                </label>
                {clientPhotoFile && (
                  <button
                    onClick={() => uploadClientPhoto(clientPhotoFile)}
                    disabled={clientPhotoUploading}
                    className="ml-2 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-3 py-1.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                  >
                    {clientPhotoUploading ? '⏳ Upload...' : '⬆️ Envoyer'}
                  </button>
                )}
              </div>
            </div>

            {profileSuccess && (
              <div className="mb-4 bg-green-50 text-green-700 p-3 rounded-lg text-sm flex items-center gap-2">
                <span>✓</span> {profileSuccess}
              </div>
            )}
            {profileError && (
              <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {profileError}
              </div>
            )}

            {editingProfile ? (
              /* Mode édition */
              <div className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nom complet <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={profileData.fullName}
                      onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                      placeholder="Jean Dupont"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                      placeholder="06 12 34 56 78"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Adresse</label>
                  <input
                    type="text"
                    value={profileData.address}
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                    placeholder="123 rue de la Paix"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Code postal</label>
                    <input
                      type="text"
                      value={profileData.postalCode}
                      onChange={(e) => setProfileData({ ...profileData, postalCode: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                      placeholder="75001"
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ville</label>
                    <input
                      type="text"
                      value={profileData.city}
                      onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                      placeholder="Paris"
                    />
                  </div>
                </div>

                {/* Email non modifiable */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400 mt-1">L'email ne peut pas être modifié</p>
                </div>

                {/* Type de client (lecture seule) */}
                {user?.user_metadata?.client_type && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type de compte</label>
                    <div className="flex items-center gap-2 px-4 py-3 border-2 border-gray-100 rounded-lg bg-gray-50">
                      <span className="text-xl">{user.user_metadata.client_type === 'entreprise' ? '🏢' : '🏠'}</span>
                      <span className="font-medium text-gray-700">
                        {user.user_metadata.client_type === 'entreprise' ? 'Entreprise' : 'Particulier'}
                      </span>
                      {user.user_metadata.company_name && (
                        <span className="text-gray-500">— {user.user_metadata.company_name}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Boutons sauvegarder / annuler */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="flex items-center gap-2 px-6 py-3 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 rounded-lg font-semibold transition disabled:opacity-50 text-sm"
                  >
                    {savingProfile ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sauvegarde...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Sauvegarder
                      </>
                    )}
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={savingProfile}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition text-sm"
                  >
                    <X className="w-4 h-4" />
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              /* Mode lecture */
              <div className="space-y-1">
                <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
                  <div className="flex items-start gap-3 py-3 border-b border-gray-100">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-[#FFC107]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Nom complet</p>
                      <p className="font-semibold text-gray-900">{user?.user_metadata?.full_name || '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 py-3 border-b border-gray-100">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-[#FFC107]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Email</p>
                      <p className="font-semibold text-gray-900">{user?.email || '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 py-3 border-b border-gray-100">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-[#FFC107]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Téléphone</p>
                      <p className="font-semibold text-gray-900">{user?.user_metadata?.phone || '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 py-3 border-b border-gray-100">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-[#FFC107]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Adresse</p>
                      <p className="font-semibold text-gray-900">
                        {user?.user_metadata?.address || '—'}
                        {user?.user_metadata?.postal_code || user?.user_metadata?.city ? (
                          <span className="text-gray-500 font-normal">
                            {user?.user_metadata?.postal_code ? `, ${user.user_metadata.postal_code}` : ''}
                            {user?.user_metadata?.city ? ` ${user.user_metadata.city}` : ''}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  {user?.user_metadata?.client_type && (
                    <div className="flex items-start gap-3 py-3 border-b border-gray-100">
                      <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm">{user.user_metadata.client_type === 'entreprise' ? '🏢' : '🏠'}</span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Type de compte</p>
                        <p className="font-semibold text-gray-900">
                          {user.user_metadata.client_type === 'entreprise' ? 'Entreprise' : 'Particulier'}
                          {user.user_metadata.company_name && (
                            <span className="text-gray-500 font-normal"> — {user.user_metadata.company_name}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {user?.user_metadata?.siret && (
                    <div className="flex items-start gap-3 py-3 border-b border-gray-100">
                      <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm">📋</span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">SIRET</p>
                        <p className="font-semibold text-gray-900 font-mono">
                          {user.user_metadata.siret}
                          {user.user_metadata.company_verified && (
                            <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-sans">✓ Vérifié</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <p className="text-xs text-gray-400">Membre depuis {user?.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '—'}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ============== BOOKINGS TABS ============== */
          <div className="space-y-4">
            {(activeTab === 'upcoming' ? upcomingBookings : pastBookings).length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <div className="text-5xl mb-4">{activeTab === 'upcoming' ? '\uD83D\uDCC5' : '\u2705'}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {activeTab === 'upcoming' ? 'Aucune r\u00E9servation \u00E0 venir' : 'Aucun historique'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {activeTab === 'upcoming'
                    ? 'Trouvez un artisan et r\u00E9servez votre premier rendez-vous !'
                    : 'Vos r\u00E9servations pass\u00E9es appara\u00EEtront ici'
                  }
                </p>
                {activeTab === 'upcoming' && (
                  <Link
                    href="/recherche"
                    className="inline-block bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-3 rounded-lg font-semibold transition"
                  >
                    Trouver un artisan
                  </Link>
                )}
              </div>
            ) : (
              (activeTab === 'upcoming' ? upcomingBookings : pastBookings).map((booking) => {
                const myRating = ratings[booking.id]
                const isUpcoming = activeTab === 'upcoming'
                const canCancel = isUpcoming && !['cancelled'].includes(booking.status)
                const canRate = !isUpcoming && booking.status === 'completed' && !myRating && booking.price_ttc > 0
                const artisanId = (booking as any).artisan_id
                const isFavori = favoris.includes(artisanId)
                return (
                <div key={booking.id} className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-gray-900 truncate">
                          {booking.services?.name || 'Service'}
                        </h3>
                        {getStatusBadge(booking.status)}
                        {/* Favori */}
                        {artisanId && (
                          <button
                            onClick={() => toggleFavori(artisanId)}
                            className={`text-lg transition-transform hover:scale-110 ${isFavori ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
                            title={isFavori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                          >
                            ❤️
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{booking.profiles_artisan?.company_name || 'Artisan'}</span>
                          {booking.profiles_artisan?.rating_avg && (
                            <span className="flex items-center gap-0.5 text-amber-500">
                              <Star className="w-3.5 h-3.5 fill-current" />
                              {booking.profiles_artisan.rating_avg}
                            </span>
                          )}
                          {/* Badge assurance live */}
                          {booking.profiles_artisan?.rating_count && booking.profiles_artisan.rating_count > 0 && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">🛡️ Assuré</span>
                          )}
                          {/* Score ponctualité */}
                          {(() => {
                            const score = getPonctualiteScore(booking.artisan_id)
                            if (score === null) return null
                            return (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${
                                score >= 90 ? 'bg-green-100 text-green-700' : score >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                              }`}>
                                ⏱️ {score}%
                              </span>
                            )
                          })()}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          <span>{formatDate(booking.booking_date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 flex-shrink-0" />
                          <span>{booking.booking_time?.substring(0, 5)} &bull; {booking.duration_minutes || 60} min</span>
                        </div>
                        {booking.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{booking.address}</span>
                          </div>
                        )}
                        {/* Notes affichées */}
                        {booking.notes && (
                          <div className="flex items-start gap-2 mt-2 bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-xs">📝</span>
                            <span className="text-xs text-gray-600">{booking.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xl font-bold text-[#FFC107]">{formatPrice(booking.price_ttc || 0)}</div>
                      <div className="text-xs text-gray-400 mt-1">TTC</div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                    {/* Suivre GPS */}
                    {isUpcoming && booking.status === 'confirmed' && (
                      <button
                        onClick={() => loadTracking(booking)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
                      >
                        📍 Suivre l&apos;artisan
                      </button>
                    )}
                    {/* Annuler */}
                    {canCancel && (
                      <button
                        onClick={() => setCancelConfirm(booking.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition"
                      >
                        ✕ Annuler
                      </button>
                    )}
                    {/* Noter */}
                    {canRate && (
                      <button
                        onClick={() => { setRatingModal(booking); setRatingVal(5); setRatingComment('') }}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition"
                      >
                        ⭐ Laisser un avis
                      </button>
                    )}
                    {/* Note déjà donnée */}
                    {myRating && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-green-50 text-green-700 border border-green-200">
                        {'⭐'.repeat(myRating.stars)} Votre avis
                      </div>
                    )}
                    {/* Notation verrouillée (post-facture) */}
                    {!isUpcoming && booking.status === 'completed' && !myRating && !(booking.price_ttc > 0) && (
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 px-3 py-2">
                        🔒 Avis disponible après facturation
                      </div>
                    )}
                    {/* Re-réserver */}
                    {!isUpcoming && booking.status === 'completed' && (
                      <a
                        href={`/recherche?artisan=${artisanId}`}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-[#FFC107]/10 text-amber-700 hover:bg-[#FFC107]/20 border border-amber-200 transition"
                      >
                        🔁 Re-réserver
                      </a>
                    )}
                  </div>
                </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* ── Modal Annulation ── */}
      {cancelConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCancelConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-gray-900">Annuler ce RDV ?</h3>
              <p className="text-sm text-gray-500 mt-1">Cette action est irréversible. L&apos;artisan sera notifié.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelConfirm(null)}
                className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl font-semibold text-sm hover:bg-gray-50 transition"
              >
                Conserver
              </button>
              <button
                onClick={() => cancelBooking(cancelConfirm)}
                disabled={!!cancellingId}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm transition"
              >
                {cancellingId ? '...' : '✕ Confirmer annulation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Notation ── */}
      {ratingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setRatingModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">⭐ Évaluer l&apos;intervention</h3>
              <p className="text-sm text-gray-500 mt-1">{ratingModal.profiles_artisan?.company_name} — {ratingModal.services?.name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Votre note</div>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setRatingVal(n)} className={`text-3xl transition-transform hover:scale-110 ${n <= ratingVal ? 'opacity-100' : 'opacity-25'}`}>⭐</button>
                  ))}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {ratingVal === 1 ? 'Très insatisfait' : ratingVal === 2 ? 'Insatisfait' : ratingVal === 3 ? 'Correct' : ratingVal === 4 ? 'Satisfait' : 'Très satisfait'}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Commentaire (optionnel)</label>
                <textarea
                  value={ratingComment}
                  onChange={e => setRatingComment(e.target.value)}
                  rows={3}
                  placeholder="Décrivez votre expérience..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107] resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRatingModal(null)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Annuler</button>
                <button onClick={submitRating} disabled={ratingSubmitting} className="flex-1 bg-[#FFC107] hover:bg-[#FFD54F] disabled:opacity-50 text-gray-900 py-3 rounded-xl text-sm font-bold transition">
                  {ratingSubmitting ? '...' : 'Envoyer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal GPS Tracking ── */}
      {trackingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setTrackingModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">📍 Suivi en temps réel</h3>
                <p className="text-sm text-gray-500 mt-0.5">{trackingModal.profiles_artisan?.company_name}</p>
              </div>
              <button onClick={() => setTrackingModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {trackingData[trackingModal.id]?.active ? (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm font-bold text-blue-800">Artisan en route</span>
                    </div>
                    <div className="text-sm text-blue-700">
                      Position : {trackingData[trackingModal.id].lat.toFixed(4)}, {trackingData[trackingModal.id].lng.toFixed(4)}
                    </div>
                    {trackingData[trackingModal.id].eta > 0 && (
                      <div className="mt-2 bg-blue-100 rounded-lg px-3 py-2 text-sm font-bold text-blue-800">
                        ⏱️ Arrivée estimée : ~{trackingData[trackingModal.id].eta} minutes
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 text-center">Position mise à jour en temps réel par l&apos;artisan</div>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">🚗</div>
                  <div className="text-sm font-semibold text-gray-700 mb-1">Artisan pas encore en route</div>
                  <div className="text-xs text-gray-400">Le suivi GPS s&apos;activera quand l&apos;artisan démarrera sa navigation</div>
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                    📅 RDV le {trackingModal.booking_date ? new Date(trackingModal.booking_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''} à {trackingModal.booking_time?.substring(0,5)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal CIL Detail ── */}
      {showCilDetail && (() => {
        const entry = showCilDetail
        const catInfo = getCategoryInfo(entry.category)
        const now = new Date()
        const warrantyActive = entry.warranty ? new Date(entry.warranty.endDate) > now : false
        const warrantyDaysLeft = entry.warranty ? Math.ceil((new Date(entry.warranty.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0
        const maintenanceOverdue = entry.nextMaintenance ? new Date(entry.nextMaintenance) < now : false

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCilDetail(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${catInfo.color}`}>
                      {catInfo.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{entry.serviceName}</h3>
                      <p className="text-sm text-gray-500">{catInfo.label} &bull; {new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowCilDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl p-1">{'\u2715'}</button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Artisan info */}
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
                  <div className="w-10 h-10 bg-[#FFC107] rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {entry.artisanName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{entry.artisanName}</p>
                    <p className="text-sm text-gray-500">Artisan intervenant</p>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Montant TTC</p>
                    <p className="font-bold text-gray-900">{formatPrice(entry.priceTTC)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Adresse</p>
                    <p className="font-semibold text-gray-900 text-sm truncate">{entry.address || 'Non renseign\u00E9e'}</p>
                  </div>
                </div>

                {/* Description */}
                {entry.description && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Description</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{entry.description}</p>
                  </div>
                )}

                {/* Proof of Work attestation */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Attestation de travaux</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`flex items-center gap-2 p-3 rounded-xl border ${entry.hasProof ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      <FileText className={`w-4 h-4 ${entry.hasProof ? 'text-green-600' : 'text-gray-400'}`} />
                      <div>
                        <p className={`text-xs font-semibold ${entry.hasProof ? 'text-green-700' : 'text-gray-500'}`}>Preuve</p>
                        <p className="text-[11px] text-gray-500">{entry.hasProof ? `${entry.proofPhotosCount} photo${entry.proofPhotosCount > 1 ? 's' : ''}` : 'Absente'}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 p-3 rounded-xl border ${entry.hasSignature ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                      <span className="text-sm">{'\u270D\uFE0F'}</span>
                      <div>
                        <p className={`text-xs font-semibold ${entry.hasSignature ? 'text-blue-700' : 'text-gray-500'}`}>Signature</p>
                        <p className="text-[11px] text-gray-500">{entry.hasSignature ? 'Client sign\u00E9' : 'Absente'}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 p-3 rounded-xl border ${entry.hasGPS ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
                      <MapPin className={`w-4 h-4 ${entry.hasGPS ? 'text-purple-600' : 'text-gray-400'}`} />
                      <div>
                        <p className={`text-xs font-semibold ${entry.hasGPS ? 'text-purple-700' : 'text-gray-500'}`}>G{'\u00E9'}olocalisation</p>
                        <p className="text-[11px] text-gray-500">{entry.hasGPS ? 'V\u00E9rifi\u00E9e' : 'Absente'}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 p-3 rounded-xl border ${entry.hasProof && entry.hasSignature && entry.hasGPS ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                      <Shield className={`w-4 h-4 ${entry.hasProof && entry.hasSignature && entry.hasGPS ? 'text-emerald-600' : 'text-gray-400'}`} />
                      <div>
                        <p className={`text-xs font-semibold ${entry.hasProof && entry.hasSignature && entry.hasGPS ? 'text-emerald-700' : 'text-gray-500'}`}>CIL conforme</p>
                        <p className="text-[11px] text-gray-500">{entry.hasProof && entry.hasSignature && entry.hasGPS ? 'Complet' : 'Incomplet'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Warranty */}
                {entry.warranty && (
                  <div className={`rounded-xl p-4 border ${warrantyActive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className={`w-5 h-5 ${warrantyActive ? 'text-emerald-600' : 'text-red-500'}`} />
                        <div>
                          <p className={`font-semibold text-sm ${warrantyActive ? 'text-emerald-700' : 'text-red-700'}`}>{entry.warranty.type}</p>
                          <p className={`text-xs ${warrantyActive ? 'text-emerald-600' : 'text-red-600'}`}>
                            Jusqu&apos;au {new Date(entry.warranty.endDate).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      {warrantyActive ? (
                        <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                          {warrantyDaysLeft}j restants
                        </span>
                      ) : (
                        <span className="text-xs font-semibold bg-red-100 text-red-600 px-2.5 py-1 rounded-full">
                          Expir{'\u00E9'}e
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Next maintenance */}
                {entry.nextMaintenance && (
                  <div className={`rounded-xl p-4 border ${maintenanceOverdue ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                    <div className="flex items-center gap-2">
                      <Calendar className={`w-5 h-5 ${maintenanceOverdue ? 'text-amber-600' : 'text-blue-600'}`} />
                      <div>
                        <p className={`font-semibold text-sm ${maintenanceOverdue ? 'text-amber-700' : 'text-blue-700'}`}>
                          {maintenanceOverdue ? 'Maintenance en retard' : 'Prochaine maintenance'}
                        </p>
                        <p className={`text-xs ${maintenanceOverdue ? 'text-amber-600' : 'text-blue-600'}`}>
                          {new Date(entry.nextMaintenance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    {maintenanceOverdue && (
                      <Link
                        href="/recherche"
                        className="mt-3 flex items-center justify-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm font-semibold transition"
                      >
                        Planifier la maintenance
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
