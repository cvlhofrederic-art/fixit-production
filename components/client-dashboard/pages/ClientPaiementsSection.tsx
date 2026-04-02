'use client'

import { CreditCard } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

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
  expires_at?: string
  services?: { name: string } | null
  profiles_artisan?: { company_name: string; rating_avg: number; rating_count?: number } | null
}

interface ClientPaiementsSectionProps {
  bookings: Booking[]
  locale: string
}

export default function ClientPaiementsSection({ bookings, locale }: ClientPaiementsSectionProps) {
  const completedBookings = bookings.filter(b => b.status === 'completed' && b.price_ttc > 0)
  const totalSpent = completedBookings.reduce((sum, b) => sum + (b.price_ttc || 0), 0)
  const avgSpent = completedBookings.length > 0 ? totalSpent / completedBookings.length : 0

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-black tracking-[-0.02em] text-dark flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-amber-600" />
        {locale === 'pt' ? 'Os meus pagamentos' : 'Mes paiements'}
      </h2>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-sm p-5 text-center">
          <div className="text-2xl font-bold text-dark">{formatPrice(totalSpent)}</div>
          <div className="text-sm text-text-muted mt-1">{locale === 'pt' ? 'Total gasto' : 'Total dépensé'}</div>
        </div>
        <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-sm p-5 text-center">
          <div className="text-2xl font-bold text-dark">{completedBookings.length}</div>
          <div className="text-sm text-text-muted mt-1">{locale === 'pt' ? 'Intervenções' : 'Interventions'}</div>
        </div>
        <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-sm p-5 text-center">
          <div className="text-2xl font-bold text-dark">{formatPrice(avgSpent)}</div>
          <div className="text-sm text-text-muted mt-1">{locale === 'pt' ? 'Média' : 'Dépense moyenne'}</div>
        </div>
      </div>

      {/* Payment list */}
      {completedBookings.length === 0 ? (
        <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-sm p-12 text-center">
          <div className="text-5xl mb-4">💳</div>
          <h3 className="text-lg font-display font-bold text-dark mb-2">{locale === 'pt' ? 'Nenhum pagamento' : 'Aucun paiement'}</h3>
          <p className="text-text-muted">{locale === 'pt' ? 'Os seus pagamentos aparecerão aqui após as intervenções.' : 'Vos paiements apparaîtront ici après les interventions.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {completedBookings
            .sort((a, b) => new Date(b.booking_date || '').getTime() - new Date(a.booking_date || '').getTime())
            .map(b => (
              <div key={b.id} className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-lg flex-shrink-0">✅</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-dark">{b.profiles_artisan?.company_name || 'Artisan'}</div>
                  <div className="text-xs text-text-muted">{b.services?.name || 'Service'}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {b.booking_date ? new Date(b.booking_date + 'T12:00:00').toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                  </div>
                </div>
                <div className="text-lg font-bold text-dark">{formatPrice(b.price_ttc || 0)}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
