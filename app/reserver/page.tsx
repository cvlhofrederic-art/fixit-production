'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import { Calendar, Clock, MapPin, ArrowLeft, User, Phone, Mail } from 'lucide-react'

function ReserverContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const artisanId = searchParams.get('artisan')
  const serviceId = searchParams.get('service')

  const [artisan, setArtisan] = useState<any>(null)
  const [service, setService] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [bookingId, setBookingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    date: '',
    time: '',
    address: '',
    notes: '',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
  })

  useEffect(() => {
    if (artisanId && serviceId) {
      fetchData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artisanId, serviceId])

  const fetchData = async () => {
    try {
      // Fetch artisan + service data
      const [artisanRes, serviceRes] = await Promise.all([
        supabase.from('profiles_artisan').select('*').eq('id', artisanId).single(),
        supabase.from('services').select('*').eq('id', serviceId).single(),
      ])

      setArtisan(artisanRes.data)
      setService(serviceRes.data)

      // Auto-fill client info from authenticated user
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const meta = user.user_metadata || {}

        // Try loading client profile from DB
        const { data: clientProfile } = await supabase
          .from('profiles_client')
          .select('first_name, last_name, phone, address')
          .eq('id', user.id)
          .single()

        const fullName = clientProfile
          ? [clientProfile.first_name, clientProfile.last_name].filter(Boolean).join(' ')
          : meta.full_name || meta.name || ''

        setFormData(prev => ({
          ...prev,
          clientName: fullName,
          clientPhone: clientProfile?.phone || meta.phone || '',
          clientEmail: user.email || '',
          address: clientProfile?.address || meta.address || '',
        }))
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        router.push('/auth/login')
        return
      }

      // Build notes with client info for artisan
      const clientInfoNote = `Client: ${formData.clientName || 'N/C'} | Tél: ${formData.clientPhone || 'N/C'} | Email: ${formData.clientEmail || 'N/C'}`
      const fullNotes = formData.notes
        ? `${clientInfoNote}\n${formData.notes}`
        : clientInfoNote

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          artisan_id: artisanId,
          service_id: serviceId,
          booking_date: formData.date,
          booking_time: formData.time,
          duration_minutes: service?.duration_minutes || 60,
          address: formData.address || 'À définir',
          notes: fullNotes,
          price_ht: service?.price_ht || 0,
          price_ttc: service?.price_ttc || 0,
          status: 'pending',
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Erreur lors de la réservation. Veuillez réessayer.')
        setSubmitting(false)
        return
      }

      setBookingId(result.data?.id || null)
      setSuccess(true)
    } catch {
      setError('Erreur de connexion. Vérifiez votre connexion internet et réessayez.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FFC107] border-t-transparent"></div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold mb-2">Réservation envoyée !</h2>
            <p className="text-gray-600 mb-6">
              L&apos;artisan va confirmer votre réservation. Vous recevrez une notification.
            </p>
            <div className="flex flex-col gap-3">
              {bookingId && (
                <button
                  onClick={() => router.push(`/confirmation?id=${bookingId}`)}
                  className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-3 rounded-xl font-semibold transition"
                >
                  Voir ma réservation
                </button>
              )}
              <button
                onClick={() => router.push('/')}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-8 py-3 rounded-xl font-semibold transition"
              >
                Retour à l&apos;accueil
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-[#FFC107] transition mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Retour
        </button>

        <h1 className="text-3xl font-bold mb-8">Réserver un service</h1>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Form */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-200">
                    ❌ {error}
                  </div>
                )}

                {/* Client info section */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <User className="w-4 h-4" /> Vos informations
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Nom complet</label>
                      <input
                        type="text"
                        value={formData.clientName}
                        onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                        required
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none text-sm"
                        placeholder="Jean Dupont"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        <Phone className="w-3.5 h-3.5 inline mr-1" />Téléphone
                      </label>
                      <input
                        type="tel"
                        value={formData.clientPhone}
                        onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                        required
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none text-sm"
                        placeholder="06 12 34 56 78"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      <Mail className="w-3.5 h-3.5 inline mr-1" />Email
                    </label>
                    <input
                      type="email"
                      value={formData.clientEmail}
                      onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none text-sm bg-gray-100"
                      readOnly
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Date souhaitée
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Heure souhaitée
                  </label>
                  <select
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none bg-white"
                  >
                    <option value="">Choisir une heure</option>
                    {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Adresse d&apos;intervention
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none"
                    placeholder="123 rue de la Paix, 75001 Paris"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (optionnel)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none resize-none"
                    placeholder="Détails supplémentaires, accès, digicode..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-xl font-semibold transition disabled:opacity-60"
                >
                  {submitting ? '⏳ Envoi en cours...' : 'Confirmer la réservation'}
                </button>
              </form>
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-24">
              <h3 className="font-bold text-lg mb-4">Récapitulatif</h3>

              {artisan && (
                <div className="mb-4 pb-4 border-b border-gray-100">
                  <p className="font-semibold">{artisan.company_name}</p>
                  <p className="text-sm text-gray-600">Artisan</p>
                </div>
              )}

              {service && (
                <div className="mb-4 pb-4 border-b border-gray-100">
                  <p className="font-semibold">{service.name}</p>
                  <p className="text-sm text-gray-600">{service.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-500">
                      {Math.floor(service.duration_minutes / 60)}h
                      {service.duration_minutes % 60 > 0 ? service.duration_minutes % 60 : ''}
                    </span>
                  </div>
                </div>
              )}

              {service && (
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total TTC</span>
                  <span className="text-2xl font-bold text-[#FFC107]">
                    {formatPrice(service.price_ttc)}
                  </span>
                </div>
              )}

              {formData.clientName && (
                <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
                  <p>📍 {formData.address || 'Adresse non renseignée'}</p>
                  <p>👤 {formData.clientName}</p>
                  {formData.clientPhone && <p>📞 {formData.clientPhone}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ReserverPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FFC107] border-t-transparent"></div>
      </div>
    }>
      <ReserverContent />
    </Suspense>
  )
}
