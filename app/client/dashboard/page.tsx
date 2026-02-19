'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import { Calendar, Clock, MapPin, Star, LogOut, User, Search, ChevronRight, Pencil, Save, X } from 'lucide-react'

type Booking = {
  id: string
  booking_date: string
  booking_time: string
  status: string
  address: string
  notes: string
  price_ttc: number
  duration_minutes: number
  services?: { name: string } | null
  profiles_artisan?: { company_name: string; rating_avg: number } | null
}

export default function ClientDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'profile'>('upcoming')
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
      .select('*, services(name), profiles_artisan:artisan_id(company_name, rating_avg)')
      .eq('client_id', userId)
      .order('booking_date', { ascending: false })

    if (error) {
      console.error('Error fetching bookings:', error)
    }
    setBookings((data as Booking[]) || [])
    setLoading(false)
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

  const today = new Date().toISOString().split('T')[0]
  const upcomingBookings = bookings.filter(b => b.booking_date >= today && b.status !== 'cancelled')
  const pastBookings = bookings.filter(b => b.booking_date < today || b.status === 'cancelled')

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
              <span className="text-2xl font-bold text-[#FFC107]">Fixit</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/recherche" className="hidden sm:flex items-center gap-2 text-gray-600 hover:text-[#FFC107] transition text-sm font-medium">
                <Search className="w-4 h-4" />
                Trouver un artisan
              </Link>
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
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 max-w-md">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition ${
              activeTab === 'upcoming' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {'\u00C0'} venir ({upcomingBookings.length})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition ${
              activeTab === 'past' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Historique ({pastBookings.length})
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'profile' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Mon profil
          </button>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'profile' ? (
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
              (activeTab === 'upcoming' ? upcomingBookings : pastBookings).map((booking) => (
                <div key={booking.id} className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-gray-900 truncate">
                          {booking.services?.name || 'Service'}
                        </h3>
                        {getStatusBadge(booking.status)}
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
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xl font-bold text-[#FFC107]">{formatPrice(booking.price_ttc || 0)}</div>
                      <div className="text-xs text-gray-400 mt-1">TTC</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
