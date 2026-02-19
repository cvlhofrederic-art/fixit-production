'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import { Calendar, Clock, MapPin, ArrowLeft } from 'lucide-react'

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

  const [formData, setFormData] = useState({
    date: '',
    time: '',
    address: '',
    notes: '',
  })

  useEffect(() => {
    if (artisanId && serviceId) {
      fetchData()
    }
  }, [artisanId, serviceId])

  const fetchData = async () => {
    const [artisanRes, serviceRes] = await Promise.all([
      supabase.from('profiles_artisan').select('*').eq('id', artisanId).single(),
      supabase.from('services').select('*').eq('id', serviceId).single(),
    ])

    setArtisan(artisanRes.data)
    setService(serviceRes.data)
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    const { error: bookingError } = await supabase.from('bookings').insert({
      client_id: user.id,
      artisan_id: artisanId,
      service_id: serviceId,
      status: 'pending',
      booking_date: formData.date,
      booking_time: formData.time,
      duration_minutes: service?.duration_minutes,
      address: formData.address,
      notes: formData.notes,
      price_ht: service?.price_ht,
      price_ttc: service?.price_ttc,
    })

    if (bookingError) {
      setError(bookingError.message)
      setSubmitting(false)
    } else {
      setSuccess(true)
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
            <h2 className="text-2xl font-bold mb-2">Reservation envoyee !</h2>
            <p className="text-gray-600 mb-6">
              L&apos;artisan va confirmer votre reservation. Vous recevrez une notification.
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-3 rounded-lg font-semibold transition"
            >
              Retour a l&apos;accueil
            </button>
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

        <h1 className="text-3xl font-bold mb-8">Reserver un service</h1>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Form */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Date souhaitee
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
                    Heure souhaitee
                  </label>
                  <select
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none bg-white"
                  >
                    <option value="">Choisir une heure</option>
                    {['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'].map((time) => (
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
                    placeholder="Details supplementaires..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {submitting ? 'Envoi...' : 'Confirmer la reservation'}
                </button>
              </form>
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-24">
              <h3 className="font-bold text-lg mb-4">Recapitulatif</h3>

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
