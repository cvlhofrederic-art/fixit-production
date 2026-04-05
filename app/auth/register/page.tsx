'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { trackEvent, AnalyticsEventType } from '@/lib/analytics'

type ClientType = 'particulier' | 'entreprise'

export default function RegisterPage() {
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
  const [siretData, setSiretData] = useState<{
    name?: string
    siret?: string
    siren?: string
    nafCode?: string
    nafLabel?: string
    legalForm?: string
    address?: string
  } | null>(null)
  const [siretError, setSiretError] = useState('')
  const [siretWarning, setSiretWarning] = useState('')
  const [emailError, setEmailError] = useState('')
  const emailDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

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

  const handleEmailChange = (value: string) => {
    setFormData(prev => ({ ...prev, email: value }))
    setEmailError('')
    clearTimeout(emailDebounceRef.current)
    if (value) {
      emailDebounceRef.current = setTimeout(() => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          setEmailError('Adresse email invalide')
        }
      }, 500)
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
    } catch (e) {
      console.warn('[register] SIRET verification failed:', e)
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

    // Politique de mot de passe renforcée (min 8 chars, 1 majuscule, 1 minuscule, 1 chiffre)
    const pwdErrors: string[] = []
    if (formData.password.length < 8) pwdErrors.push('8 caractères minimum')
    if (!/[A-Z]/.test(formData.password)) pwdErrors.push('1 majuscule')
    if (!/[a-z]/.test(formData.password)) pwdErrors.push('1 minuscule')
    if (!/[0-9]/.test(formData.password)) pwdErrors.push('1 chiffre')
    if (pwdErrors.length > 0) {
      setError(`Mot de passe trop faible : ${pwdErrors.join(', ')}`)
      return
    }

    if (!formData.phone || formData.phone.length < 10) {
      setError('Veuillez entrer un numéro de téléphone valide')
      return
    }

    if (!formData.address || !formData.postalCode || !formData.city) {
      setError('Veuillez renseigner votre adresse complète (adresse, code postal, ville)')
      return
    }

    if (clientType === 'entreprise' && !formData.companyName.trim()) {
      setError('Veuillez renseigner le nom de votre entreprise')
      return
    }

    trackEvent(AnalyticsEventType.SIGNUP_STARTED, { role: 'client', client_type: clientType })
    setLoading(true)

    try {
      const metadata: Record<string, string | boolean | null | undefined> = {
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

      trackEvent(AnalyticsEventType.SIGNUP_COMPLETED, { role: 'client' })

      // Auto-login after registration if email confirmation is disabled
      if (authData.session) {
        window.location.href = '/client/dashboard'
        return
      }

      setSuccess(true)
    } catch (e) {
      console.warn('[register] handleRegister failed:', e)
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-warm-gray flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border-[1.5px] border-[#EFEFEF] p-8">
            <div className="text-6xl mb-4">{'\u2705'}</div>
            <h2 className="font-display text-2xl font-black tracking-[-0.03em] mb-2">Inscription réussie !</h2>
            <p className="text-text-muted mb-6">
              Vérifiez votre email pour confirmer votre compte, puis connectez-vous.
            </p>
            <Link
              href="/auth/login"
              className="inline-block bg-yellow hover:bg-yellow-light hover:-translate-y-px text-dark px-8 py-3 rounded-xl font-semibold transition"
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
      <div className="min-h-screen bg-warm-gray py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-black tracking-[-0.03em] text-dark">Créer mon compte</h1>
            <p className="text-text-muted mt-2">Quel type de compte souhaitez-vous créer ?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Particulier Card */}
            <button
              onClick={() => setClientType('particulier')}
              className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border-[1.5px] border-[#EFEFEF] p-8 text-left hover:shadow-xl hover:border-yellow transition-all group cursor-pointer"
            >
              <div className="text-5xl mb-4">🏠</div>
              <h2 className="text-xl font-bold text-dark mb-2 group-hover:text-yellow transition">
                Particulier
              </h2>
              <p className="text-text-muted text-sm leading-relaxed">
                Je suis un particulier et je cherche un artisan pour des travaux chez moi (plomberie, électricité, peinture, rénovation...)
              </p>
              <div className="mt-4 flex items-center text-yellow font-semibold text-sm opacity-0 group-hover:opacity-100 transition">
                Commencer →
              </div>
            </button>

            {/* Artisan Card */}
            <Link
              href="/pro/register"
              className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border-[1.5px] border-[#EFEFEF] p-8 text-left hover:shadow-xl hover:border-yellow transition-all group"
            >
              <div className="text-5xl mb-4">🔧</div>
              <h2 className="text-xl font-bold text-dark mb-2 group-hover:text-yellow transition">
                Artisan
              </h2>
              <p className="text-text-muted text-sm leading-relaxed">
                Je suis artisan et je souhaite proposer mes services sur Fixit (plombier, électricien, peintre, maçon...)
              </p>
              <div className="mt-4 flex items-center text-yellow font-semibold text-sm opacity-0 group-hover:opacity-100 transition">
                S'inscrire →
              </div>
            </Link>

            {/* Entreprise Card */}
            <Link
              href="/pro/register"
              className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border-[1.5px] border-[#EFEFEF] p-8 text-left hover:shadow-xl hover:border-yellow transition-all group"
            >
              <div className="text-5xl mb-4">🏢</div>
              <h2 className="text-xl font-bold text-dark mb-2 group-hover:text-yellow transition">
                Entreprise
              </h2>
              <p className="text-text-muted text-sm leading-relaxed">
                Syndic, gestionnaire d'immeubles, conciergerie, société BTP... Accédez à notre espace professionnel
              </p>
              <div className="mt-4 flex items-center text-yellow font-semibold text-sm opacity-0 group-hover:opacity-100 transition">
                Espace pro →
              </div>
            </Link>
          </div>

          <div className="text-center">
            <p className="text-text-muted text-sm">
              Déjà un compte ?{' '}
              <Link href="/auth/login" className="text-yellow hover:underline font-semibold">
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
    <div className="min-h-screen bg-warm-gray py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-black tracking-[-0.03em] text-dark">Créer mon compte</h1>
          <p className="text-text-muted mt-2">
            {clientType === 'particulier'
              ? 'Inscrivez-vous pour réserver vos artisans en quelques clics'
              : 'Inscrivez votre entreprise pour trouver des sous-traitants qualifiés'}
          </p>
        </div>

        {/* Client type indicator + change option */}
        <div className="mb-6 flex items-center justify-between bg-white rounded-xl shadow-sm px-5 py-3.5 border-[1.5px] border-[#EFEFEF]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{clientType === 'particulier' ? '🏠' : '🏢'}</span>
            <div>
              <p className="font-semibold text-dark text-sm">
                {clientType === 'particulier' ? 'Compte Particulier' : 'Compte Entreprise'}
              </p>
              <p className="text-xs text-text-muted">
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
            className="text-sm text-yellow hover:underline font-medium"
          >
            Changer
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border-[1.5px] border-[#EFEFEF] p-8">
          <form onSubmit={handleRegister} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Section Entreprise: SIRET + company info */}
            {clientType === 'entreprise' && (
              <div>
                <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 bg-yellow text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  Votre entreprise
                </h3>
                <div className="space-y-4">
                  {/* SIRET field with verification */}
                  <div>
                    <label className="block text-sm font-medium text-mid mb-2">
                      SIRET de l'entreprise <span className="text-text-muted text-xs">(optionnel mais recommandé)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.siret}
                        onChange={(e) => handleSiretChange(e.target.value)}
                        className="flex-1 px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none font-mono tracking-wider"
                        placeholder="XXX XXX XXX XXXXX"
                        maxLength={17}
                      />
                      <button
                        type="button"
                        onClick={verifySiret}
                        disabled={siretVerifying || formData.siret.replace(/\s/g, '').length !== 14}
                        className="px-4 py-3 bg-yellow hover:bg-yellow-light text-dark rounded-xl font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed text-sm whitespace-nowrap"
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
                    <label className="block text-sm font-medium text-mid mb-2">
                      Nom de l'entreprise <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      required
                      className={`w-full px-4 py-3 border-[1.5px] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none ${
                        siretVerified ? 'border-green-300 bg-green-50/50' : 'border-[#E0E0E0]'
                      }`}
                      placeholder="Nom de votre société"
                    />
                  </div>

                  {/* Contact role in company */}
                  <div>
                    <label className="block text-sm font-medium text-mid mb-2">
                      Votre fonction dans l'entreprise
                    </label>
                    <input
                      type="text"
                      value={formData.contactRole}
                      onChange={(e) => setFormData({ ...formData, contactRole: e.target.value })}
                      className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none"
                      placeholder="Ex: Gérant, Chef de chantier, Responsable achats..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Informations personnelles */}
            <div>
              <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-yellow text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {clientType === 'entreprise' ? '2' : '1'}
                </span>
                {clientType === 'entreprise' ? 'Personne de contact' : 'Vos informations'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-mid mb-2">
                    {clientType === 'entreprise' ? 'Nom et prénom du contact' : 'Nom complet'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none"
                    placeholder={clientType === 'entreprise' ? 'Jean Dupont' : 'Jean Dupont'}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-mid mb-2">Email <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      required
                      className={`w-full px-4 py-3 border-[1.5px] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none ${emailError ? 'border-red-400' : 'border-[#E0E0E0]'}`}
                      placeholder={clientType === 'entreprise' ? 'contact@entreprise.fr' : 'votre@email.com'}
                    />
                    {emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-mid mb-2">Téléphone <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none"
                      placeholder="06 12 34 56 78"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Adresse */}
            <div>
              <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-yellow text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {clientType === 'entreprise' ? '3' : '2'}
                </span>
                {clientType === 'entreprise' ? 'Adresse de l\'entreprise' : 'Votre adresse'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-mid mb-2">Adresse <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                    className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none"
                    placeholder="123 rue de la Paix"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-mid mb-2">Code postal <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      required
                      className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none"
                      placeholder="75001"
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-mid mb-2">Ville <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                      className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none"
                      placeholder="Paris"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-yellow text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {clientType === 'entreprise' ? '4' : '3'}
                </span>
                Sécurité
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-mid mb-2">Mot de passe <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none"
                    placeholder="Min. 8 caractères"
                  />
                  {formData.password.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs">
                      <li className={formData.password.length >= 8 ? 'text-green-600' : 'text-gray-400'}>
                        {formData.password.length >= 8 ? '✓' : '○'} Min. 8 caractères
                      </li>
                      <li className={/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}>
                        {/[A-Z]/.test(formData.password) ? '✓' : '○'} Une majuscule
                      </li>
                      <li className={/[a-z]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}>
                        {/[a-z]/.test(formData.password) ? '✓' : '○'} Une minuscule
                      </li>
                      <li className={/[0-9]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}>
                        {/[0-9]/.test(formData.password) ? '✓' : '○'} Un chiffre
                      </li>
                    </ul>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-mid mb-2">Confirmer <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none"
                    placeholder="Retapez le mot de passe"
                  />
                  {formData.confirmPassword.length > 0 && (
                    <p className={`mt-2 text-xs ${formData.password === formData.confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                      {formData.password === formData.confirmPassword ? '✓ Les mots de passe correspondent' : '✗ Les mots de passe ne correspondent pas'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow hover:bg-yellow-light hover:-translate-y-px text-dark py-3.5 rounded-xl font-semibold transition disabled:opacity-60 text-lg"
            >
              {loading ? 'Inscription...' : clientType === 'entreprise' ? 'Inscrire mon entreprise' : 'Créer mon compte'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-text-muted text-sm">
              Déjà un compte ?{' '}
              <Link href="/auth/login" className="text-yellow hover:underline font-semibold">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
