'use client'

import {
  User,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  Check,
  ArrowLeft,
} from 'lucide-react'

interface BookingFormProps {
  bookingForm: {
    name: string
    email: string
    phone: string
    address: string
    notes: string
    cgu: boolean
  }
  setBookingForm: React.Dispatch<React.SetStateAction<{
    name: string
    email: string
    phone: string
    address: string
    notes: string
    cgu: boolean
  }>>
  addressSuggestions: { label: string; value: string }[]
  showAddrDropdown: boolean
  setShowAddrDropdown: React.Dispatch<React.SetStateAction<boolean>>
  bookingError: string | null
  submitting: boolean
  canSubmitBooking: boolean | null | "" | undefined
  connectedUser: any
  onSubmit: () => void
  fetchAddressSuggestions: (query: string) => void
  setStep: React.Dispatch<React.SetStateAction<'profile' | 'motif' | 'calendar'>>
}

export function BookingForm({
  bookingForm,
  setBookingForm,
  addressSuggestions,
  showAddrDropdown,
  setShowAddrDropdown,
  bookingError,
  submitting,
  canSubmitBooking,
  connectedUser,
  onSubmit,
  fetchAddressSuggestions,
  setStep,
}: BookingFormProps) {
  return (
    <div className="bg-white rounded-2xl p-5 border-[1.5px] border-[#EFEFEF]">
      <h4 className="font-display font-bold text-dark mb-4">Vos informations</h4>

      {connectedUser && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
          <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
          <p className="text-xs text-green-700">Connect&eacute; &mdash; vos informations sont pr&eacute;-remplies depuis votre profil</p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-gray-500" />
            Nom complet <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={bookingForm.name}
            onChange={(e) => setBookingForm({ ...bookingForm, name: e.target.value })}
            placeholder="Ex: Marie Dupont"
            className={`w-full p-2.5 border-[1.5px] rounded-xl focus:border-yellow focus:outline-none transition text-sm ${
              connectedUser && bookingForm.name ? 'border-green-200 bg-green-50/30' : 'border-[#E0E0E0] bg-warm-gray focus:bg-white'
            }`}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-gray-500" />
            Email
          </label>
          <input
            type="email"
            value={bookingForm.email}
            onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })}
            placeholder="marie@exemple.com"
            className={`w-full p-2.5 border-[1.5px] rounded-xl focus:border-yellow focus:outline-none transition text-sm ${
              connectedUser && bookingForm.email ? 'border-green-200 bg-green-50/30' : 'border-[#E0E0E0] bg-warm-gray focus:bg-white'
            }`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-gray-500" />
            T&eacute;l&eacute;phone <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            value={bookingForm.phone}
            onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
            placeholder="06 12 34 56 78"
            className={`w-full p-2.5 border-[1.5px] rounded-xl focus:border-yellow focus:outline-none transition text-sm ${
              connectedUser && bookingForm.phone ? 'border-green-200 bg-green-50/30' : 'border-[#E0E0E0] bg-warm-gray focus:bg-white'
            }`}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-gray-500" />
            Adresse d&apos;intervention
          </label>
          <div className="relative">
            <input
              type="text"
              value={bookingForm.address}
              onChange={(e) => {
                setBookingForm({ ...bookingForm, address: e.target.value })
                fetchAddressSuggestions(e.target.value)
              }}
              onFocus={() => { if (addressSuggestions.length > 0) setShowAddrDropdown(true) }}
              onBlur={() => setTimeout(() => setShowAddrDropdown(false), 200)}
              placeholder="123 rue de la Paix, 13600 La Ciotat"
              className="w-full p-2.5 border-[1.5px] border-[#E0E0E0] bg-warm-gray rounded-xl focus:border-yellow focus:bg-white focus:outline-none transition text-sm"
              autoComplete="off"
            />
            {showAddrDropdown && addressSuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {addressSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setBookingForm({ ...bookingForm, address: s.value })
                      setShowAddrDropdown(false)
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-[#FFF8E1] transition flex items-center gap-2 border-b border-gray-50 last:border-0"
                  >
                    <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {connectedUser && bookingForm.address && (
            <p className="text-[11px] text-gray-500 mt-1">Adresse de votre profil par d&eacute;faut &mdash; modifiable si l&apos;intervention est ailleurs</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
            Note suppl&eacute;mentaire / Question pour l&apos;artisan
          </label>
          <textarea
            value={bookingForm.notes}
            onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
            rows={3}
            placeholder="D&eacute;crivez votre besoin, posez une question, ou indiquez des infos d'acc&egrave;s (code porte, &eacute;tage, parking, etc.)"
            className="w-full p-2.5 border-[1.5px] border-[#E0E0E0] bg-warm-gray rounded-xl focus:border-yellow focus:bg-white focus:outline-none transition resize-none text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">L&apos;artisan pourra vous r&eacute;pondre via la messagerie apr&egrave;s la r&eacute;servation</p>
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
            <span className="text-yellow underline cursor-pointer">
              conditions g&eacute;n&eacute;rales d&apos;utilisation
            </span>{' '}
            et la{' '}
            <span className="text-yellow underline cursor-pointer">
              politique de confidentialit&eacute;
            </span>
            . <span className="text-red-400">*</span>
          </span>
        </label>
      </div>

      {/* Booking error message */}
      {bookingError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {bookingError}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-5 space-y-3">
        <button
          onClick={onSubmit}
          disabled={!canSubmitBooking || submitting}
          className="w-full bg-yellow hover:bg-yellow-light text-dark py-3 rounded-xl font-semibold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:-translate-y-px"
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
  )
}
