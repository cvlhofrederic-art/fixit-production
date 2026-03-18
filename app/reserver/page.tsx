'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import { Calendar, Clock, MapPin, ArrowLeft, User, Phone, Mail } from 'lucide-react'
import { useLocale } from '@/lib/i18n/context'

function ReserverContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const locale = useLocale()
  const isPt = locale === 'pt'
  const t = (fr: string, pt: string) => (isPt ? pt : fr)

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
      // Validate JWT with Supabase server before trusting the session
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/auth/login')
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        router.push('/auth/login')
        return
      }

      // Build notes with client info for artisan
      const clientInfoNote = `Client: ${formData.clientName || 'N/C'} | ${t('Tél', 'Tel')}: ${formData.clientPhone || 'N/C'} | Email: ${formData.clientEmail || 'N/C'}`
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
          address: formData.address || t('À définir', 'A definir'),
          notes: fullNotes,
          price_ht: service?.price_ht || 0,
          price_ttc: service?.price_ttc || 0,
          status: 'pending',
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result.error || t(
          'Erreur lors de la réservation. Veuillez réessayer.',
          'Erro ao efetuar a reserva. Por favor tente novamente.',
        ))
        setSubmitting(false)
        return
      }

      setBookingId(result.data?.id || null)
      setSuccess(true)
    } catch {
      setError(t(
        'Erreur de connexion. Vérifiez votre connexion internet et réessayez.',
        'Erro de ligação. Verifique a sua ligação à internet e tente novamente.',
      ))
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow border-t-transparent"></div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-warm-gray flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border-[1.5px] border-[#EFEFEF] p-8">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="font-display text-2xl font-black text-dark mb-2 tracking-[-0.03em]">
              {t('Réservation envoyée !', 'Reserva enviada!')}
            </h2>
            <p className="text-text-muted mb-6">
              {t(
                'L\'artisan va confirmer votre réservation. Vous recevrez une notification.',
                'O profissional vai confirmar a sua reserva. Receberá uma notificação.',
              )}
            </p>
            <div className="flex flex-col gap-3">
              {bookingId && (
                <button
                  onClick={() => router.push(`/confirmation?id=${bookingId}`)}
                  className="bg-yellow hover:bg-yellow-light text-dark px-8 py-3 rounded-xl font-semibold transition hover:-translate-y-px"
                >
                  {t('Voir ma réservation', 'Ver a minha reserva')}
                </button>
              )}
              <button
                onClick={() => router.push('/')}
                className="bg-warm-gray hover:bg-gray-200 text-mid px-8 py-3 rounded-xl font-semibold transition border-[1.5px] border-[#E0E0E0]"
              >
                {t('Retour à l\'accueil', 'Voltar ao início')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-warm-gray py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-muted hover:text-yellow transition mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          {t('Retour', 'Voltar')}
        </button>

        <h1 className="font-display text-3xl font-black text-dark mb-8 tracking-[-0.03em]">
          {t('Réserver un service', 'Reservar um serviço')}
        </h1>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Form */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-200">
                    ❌ {error}
                  </div>
                )}

                {/* Client info section */}
                <div className="bg-warm-gray rounded-xl p-4 space-y-4">
                  <h3 className="font-semibold text-dark flex items-center gap-2">
                    <User className="w-4 h-4" /> {t('Vos informations', 'As suas informações')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">
                        {t('Nom complet', 'Nome completo')}
                      </label>
                      <input
                        type="text"
                        value={formData.clientName}
                        onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                        required
                        className="w-full px-4 py-3 bg-white border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:outline-none text-sm"
                        placeholder={t('Jean Dupont', 'João Silva')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">
                        <Phone className="w-3.5 h-3.5 inline mr-1" />{t('Téléphone', 'Telefone')}
                      </label>
                      <input
                        type="tel"
                        value={formData.clientPhone}
                        onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                        required
                        className="w-full px-4 py-3 bg-white border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:outline-none text-sm"
                        placeholder={t('06 12 34 56 78', '+351 912 345 678')}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">
                      <Mail className="w-3.5 h-3.5 inline mr-1" />Email
                    </label>
                    <input
                      type="email"
                      value={formData.clientEmail}
                      onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                      className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:outline-none text-sm bg-warm-gray"
                      readOnly
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-mid mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    {t('Date souhaitée', 'Data pretendida')}
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 bg-warm-gray border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-mid mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    {t('Heure souhaitée', 'Hora pretendida')}
                  </label>
                  <select
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-warm-gray border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:bg-white focus:outline-none"
                  >
                    <option value="">{t('Choisir une heure', 'Escolher uma hora')}</option>
                    {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-mid mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    {t('Adresse d\'intervention', 'Morada de intervenção')}
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-warm-gray border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:bg-white focus:outline-none"
                    placeholder={t('123 rue de la Paix, 75001 Paris', 'Rua da Liberdade 123, 4000 Porto')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-mid mb-2">
                    {t('Notes (optionnel)', 'Notas (opcional)')}
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 bg-warm-gray border-[1.5px] border-[#E0E0E0] rounded-xl focus:border-yellow focus:bg-white focus:outline-none resize-none"
                    placeholder={t('Détails supplémentaires, accès, digicode...', 'Detalhes adicionais, acesso, código da porta...')}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-yellow hover:bg-yellow-light text-dark py-3 rounded-xl font-semibold transition disabled:opacity-60 hover:-translate-y-px"
                >
                  {submitting
                    ? t('⏳ Envoi en cours...', '⏳ A enviar...')
                    : t('Confirmer la réservation', 'Confirmar a reserva')
                  }
                </button>
              </form>
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] p-6 sticky top-24">
              <h3 className="font-display font-bold text-lg text-dark mb-4">
                {t('Récapitulatif', 'Resumo')}
              </h3>

              {artisan && (
                <div className="mb-4 pb-4 border-b border-border">
                  <p className="font-semibold text-dark">{artisan.company_name}</p>
                  <p className="text-sm text-text-muted">{t('Artisan', 'Profissional')}</p>
                </div>
              )}

              {service && (
                <div className="mb-4 pb-4 border-b border-border">
                  <p className="font-semibold text-dark">{service.name}</p>
                  <p className="text-sm text-text-muted">{service.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-text-muted">
                      {Math.floor(service.duration_minutes / 60)}h
                      {service.duration_minutes % 60 > 0 ? service.duration_minutes % 60 : ''}
                    </span>
                  </div>
                </div>
              )}

              {service && (
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-dark">{t('Total TTC', 'Total c/ IVA')}</span>
                  <span className="text-2xl font-bold text-yellow">
                    {formatPrice(service.price_ttc)}
                  </span>
                </div>
              )}

              {formData.clientName && (
                <div className="mt-4 pt-4 border-t border-border text-sm text-text-muted">
                  <p>📍 {formData.address || t('Adresse non renseignée', 'Morada não indicada')}</p>
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
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow border-t-transparent"></div>
      </div>
    }>
      <ReserverContent />
    </Suspense>
  )
}
