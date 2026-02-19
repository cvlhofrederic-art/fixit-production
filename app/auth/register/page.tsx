'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type ClientType = 'particulier' | 'entreprise'

export default function RegisterPage() {
  const router = useRouter()
  const [clientType, setClientType] = useState<ClientType | null>(null)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    password: '',
    confirmPassword: '',
    // Champs entreprise
    companyName: '',
    siret: '',
    contactRole: '', // Poste dans l'entreprise
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // SIRET verification states
  const [siretVerifying, setSiretVerifying] = useState(false)
  const [siretVerified, setSiretVerified] = useState(false)
  const [siretData, setSiretData] = useState<any>(null)
  const [siretError, setSiretError] = useState('')
  const [siretWarning, setSiretWarning] = useState('')

  const formatSiret = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14)
    // Format: XXX XXX XXX XXXXX
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
  }

  const handleSiretChange = (value: string) => {
    const formatted = formatSiret(value)
    setFormData({ ...formData, siret: formatted })
    // Reset verification when SIRET changes
    if (siretVerified) {
      setSiretVerified(false)
      setSiretData(null)
      setSiretError('')
      setSiretWarning('')
    }
  }

  const verifySiret = async () => {
    const cleanSiret = formData.siret.replace(/\s/g, '')
    if (cleanSiret.length !== 14) {
      setSiretError('Le SIRET doit contenir 14 chiffres')
      return
    }

    setSiretVerifying(true)
    setSiretError('')
    setSiretWarning('')

    try {
      const res = await fetch(`/api/verify-siret?siret=${cleanSiret}`)
      const data = await res.json()

      if (data.verified) {
        setSiretVerified(true)
        setSiretData(data.company)
        // Auto-fill company name
        setFormData(prev => ({
          ...prev,
          companyName: data.company.name || prev.companyName,
        }))
        if (data.warning) {
          setSiretWarning(data.warning)
        }
      } else {
        setSiretError(data.error || 'SIRET non vérifié')
      }
    } catch {
      setSiretError('Erreur de connexion. Réessayez.')
    } finally {
      setSiretVerifying(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    if (!formData.phone || formData.phone.length < 10) {
      setError('Veuillez entrer un numéro de téléphone valide')
      return
    }

    if (clientType === 'entreprise' && !formData.companyName.trim()) {
      setError('Veuillez renseigner le nom de votre entreprise')
      return
    }

    setLoading(true)

    try {
      const metadata: any = {
        full_name: formData.fullName,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        postal_code: formData.postalCode,
        role: 'client',
        client_type: clientType,
      }

      // Ajouter les données entreprise si applicable
      if (clientType === 'entreprise') {
        metadata.company_name = formData.companyName
        metadata.contact_role = formData.contactRole
        if (siretVerified && siretData) {
          metadata.siret = siretData.siret
          metadata.siren = siretData.siren
          metadata.naf_code = siretData.nafCode
          metadata.naf_label = siretData.nafLabel
          metadata.legal_form = siretData.legalForm
          metadata.company_address = siretData.address
          metadata.company_verified = true
        } else if (formData.siret.replace(/\s/g, '').length === 14) {
          metadata.siret = formData.siret.replace(/\s/g, '')
          metadata.company_verified = false
        }
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: metadata,
        },
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      // Auto-login after registration if email confirmation is disabled
      if (authData.session) {
        window.location.href = '/client/dashboard'
        return
      }

      setSuccess(true)
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-6xl mb-4">{'\u2705'}</div>
            <h2 className="text-2xl font-bold mb-2">Inscription réussie !</h2>
            <p className="text-gray-600 mb-6">
              Vérifiez votre email pour confirmer votre compte, puis connectez-vous.
            </p>
            <Link
              href="/auth/login"
              className="inline-block bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-3 rounded-lg font-semibold transition"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Step 1: Choose client type
  if (!clientType) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Créer mon compte</h1>
            <p className="text-gray-600 mt-2">Quel type de client êtes-vous ?</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Particulier Card */}
            <button
              onClick={() => setClientType('particulier')}
              className="bg-white rounded-2xl shadow-lg p-8 text-left hover:shadow-xl hover:border-[#FFC107] border-2 border-transparent transition-all group cursor-pointer"
            >
              <div className="text-5xl mb-4">🏠</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-[#FFC107] transition">
                Particulier
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Je suis un particulier et je cherche un artisan pour des travaux chez moi (plomberie, électricité, peinture, rénovation...)
              </p>
              <div className="mt-4 flex items-center text-[#FFC107] font-semibold text-sm opacity-0 group-hover:opacity-100 transition">
                Commencer →
              </div>
            </button>

            {/* Entreprise Card */}
            <button
              onClick={() => setClientType('entreprise')}
              className="bg-white rounded-2xl shadow-lg p-8 text-left hover:shadow-xl hover:border-[#FFC107] border-2 border-transparent transition-all group cursor-pointer"
            >
              <div className="text-5xl mb-4">🏢</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-[#FFC107] transition">
                Entreprise
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Je représente une entreprise et je cherche un artisan sous-traitant pour une mission ou un chantier spécifique
              </p>
              <div className="mt-4 flex items-center text-[#FFC107] font-semibold text-sm opacity-0 group-hover:opacity-100 transition">
                Commencer →
              </div>
            </button>
          </div>

          <div className="text-center">
            <p className="text-gray-500 text-sm">
              Vous êtes artisan ?{' '}
              <Link href="/pro/register" className="text-[#FFC107] hover:underline font-semibold">
                Inscrivez-vous ici
              </Link>
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Déjà un compte ?{' '}
              <Link href="/auth/login" className="text-[#FFC107] hover:underline font-semibold">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Registration form
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Créer mon compte</h1>
          <p className="text-gray-600 mt-2">
            {clientType === 'particulier'
              ? 'Inscrivez-vous pour réserver vos artisans en quelques clics'
              : 'Inscrivez votre entreprise pour trouver des sous-traitants qualifiés'}
          </p>
        </div>

        {/* Client type indicator + change option */}
        <div className="mb-6 flex items-center justify-between bg-white rounded-xl shadow-sm px-5 py-3.5 border border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{clientType === 'particulier' ? '🏠' : '🏢'}</span>
            <div>
              <p className="font-semibold text-gray-900 text-sm">
                {clientType === 'particulier' ? 'Compte Particulier' : 'Compte Entreprise'}
              </p>
              <p className="text-xs text-gray-500">
                {clientType === 'particulier'
                  ? 'Recherche d\'artisans pour travaux personnels'
                  : 'Recherche de sous-traitants pour vos chantiers'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setClientType(null)
              setSiretVerified(false)
              setSiretData(null)
              setSiretError('')
              setSiretWarning('')
            }}
            className="text-sm text-[#FFC107] hover:underline font-medium"
          >
            Changer
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <form onSubmit={handleRegister} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Section Entreprise: SIRET + company info */}
            {clientType === 'entreprise' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 bg-[#FFC107] text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  Votre entreprise
                </h3>
                <div className="space-y-4">
                  {/* SIRET field with verification */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SIRET de l'entreprise <span className="text-gray-400 text-xs">(optionnel mais recommandé)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.siret}
                        onChange={(e) => handleSiretChange(e.target.value)}
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none font-mono tracking-wider"
                        placeholder="XXX XXX XXX XXXXX"
                        maxLength={17}
                      />
                      <button
                        type="button"
                        onClick={verifySiret}
                        disabled={siretVerifying || formData.siret.replace(/\s/g, '').length !== 14}
                        className="px-4 py-3 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 rounded-lg font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                      >
                        {siretVerifying ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Vérification...
                          </span>
                        ) : siretVerified ? '✓ Vérifié' : 'Vérifier'}
                      </button>
                    </div>
                    {siretError && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <span>✗</span> {siretError}
                      </p>
                    )}
                    {siretWarning && (
                      <p className="mt-2 text-sm text-amber-600 flex items-center gap-1">
                        <span>⚠</span> {siretWarning}
                      </p>
                    )}
                  </div>

                  {/* Verified company info card */}
                  {siretVerified && siretData && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-green-600 text-lg">✓</span>
                        <span className="font-semibold text-green-800">Entreprise vérifiée</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-green-700 font-medium">Raison sociale :</span>
                          <p className="text-green-900">{siretData.name}</p>
                        </div>
                        <div>
                          <span className="text-green-700 font-medium">SIRET :</span>
                          <p className="text-green-900 font-mono">{siretData.siret}</p>
                        </div>
                        {siretData.nafLabel && (
                          <div>
                            <span className="text-green-700 font-medium">Activité :</span>
                            <p className="text-green-900">{siretData.nafLabel}</p>
                          </div>
                        )}
                        {siretData.legalForm && (
                          <div>
                            <span className="text-green-700 font-medium">Forme juridique :</span>
                            <p className="text-green-900">{siretData.legalForm}</p>
                          </div>
                        )}
                        {siretData.address && (
                          <div className="col-span-2">
                            <span className="text-green-700 font-medium">Adresse :</span>
                            <p className="text-green-900">{siretData.address}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Company name (auto-filled if SIRET verified, or manual entry) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nom de l'entreprise <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      required
                      className={`w-full px-4 py-3 border-2 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none ${
                        siretVerified ? 'border-green-300 bg-green-50/50' : 'border-gray-200'
                      }`}
                      placeholder="Nom de votre société"
                    />
                  </div>

                  {/* Contact role in company */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Votre fonction dans l'entreprise
                    </label>
                    <input
                      type="text"
                      value={formData.contactRole}
                      onChange={(e) => setFormData({ ...formData, contactRole: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                      placeholder="Ex: Gérant, Chef de chantier, Responsable achats..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Informations personnelles */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-[#FFC107] text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {clientType === 'entreprise' ? '2' : '1'}
                </span>
                {clientType === 'entreprise' ? 'Personne de contact' : 'Vos informations'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {clientType === 'entreprise' ? 'Nom et prénom du contact' : 'Nom complet'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                    placeholder={clientType === 'entreprise' ? 'Jean Dupont' : 'Jean Dupont'}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                      placeholder={clientType === 'entreprise' ? 'contact@entreprise.fr' : 'votre@email.com'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                      placeholder="06 12 34 56 78"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Adresse */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-[#FFC107] text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {clientType === 'entreprise' ? '3' : '2'}
                </span>
                {clientType === 'entreprise' ? 'Adresse de l\'entreprise' : 'Votre adresse'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Adresse</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                    placeholder="123 rue de la Paix"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Code postal</label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                      placeholder="75001"
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ville</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                      placeholder="Paris"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-[#FFC107] text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {clientType === 'entreprise' ? '4' : '3'}
                </span>
                Sécurité
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                    placeholder="Min. 6 caractères"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirmer <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                    placeholder="Retapez le mot de passe"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3.5 rounded-lg font-semibold transition disabled:opacity-50 text-lg"
            >
              {loading ? 'Inscription...' : clientType === 'entreprise' ? 'Inscrire mon entreprise' : 'Créer mon compte'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Déjà un compte ?{' '}
              <Link href="/auth/login" className="text-[#FFC107] hover:underline font-semibold">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
