'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type SiretStatus = 'idle' | 'checking' | 'verified' | 'error'

interface VerifiedCompany {
  name: string
  siret: string
  siren: string
  nafCode: string
  nafLabel: string
  legalForm: string
  address: string
  city: string
  postalCode: string
  isActive: boolean
  creationDate: string
  isArtisanActivity: boolean
}

export default function ProRegisterPage() {
  const [step, setStep] = useState<1 | 2>(1)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    siret: '',
    bio: '',
  })
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Upload assurance
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null)
  const [insurancePreview, setInsurancePreview] = useState<string>('')
  const [insuranceUploading, setInsuranceUploading] = useState(false)
  const [insuranceUrl, setInsuranceUrl] = useState<string>('')

  // SIRET verification
  const [siretInput, setSiretInput] = useState('')
  const [siretStatus, setSiretStatus] = useState<SiretStatus>('idle')
  const [siretError, setSiretError] = useState('')
  const [siretWarning, setSiretWarning] = useState('')
  const [verifiedCompany, setVerifiedCompany] = useState<VerifiedCompany | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('active', true)
      .order('name')
    if (error) console.error('Error fetching categories:', error)
    setCategories(data || [])
  }

  const handleInsuranceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError('Le fichier assurance est trop volumineux (max 10 Mo)')
      return
    }
    setInsuranceFile(file)
    setInsuranceUrl('')
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (ev) => setInsurancePreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setInsurancePreview('')
    }
  }

  const uploadInsurance = async (artisanId?: string): Promise<string> => {
    if (!insuranceFile) return insuranceUrl
    setInsuranceUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', insuranceFile)
      fd.append('bucket', 'artisan-documents')
      fd.append('folder', 'insurance')
      if (artisanId) {
        fd.append('artisan_id', artisanId)
        fd.append('field', 'insurance_url')
      }
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur upload')
      setInsuranceUrl(data.url)
      return data.url
    } catch (err: any) {
      setError(`Erreur upload assurance: ${err.message}`)
      return ''
    } finally {
      setInsuranceUploading(false)
    }
  }

  const toggleCategory = (slug: string) => {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug]
    )
  }

  // Format SIRET avec espaces (XXX XXX XXX XXXXX)
  const formatSiret = (value: string) => {
    const digits = value.replace(/\D/g, '').substring(0, 14)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
  }

  const handleSiretChange = (value: string) => {
    const formatted = formatSiret(value)
    setSiretInput(formatted)
    setSiretStatus('idle')
    setSiretError('')
    setSiretWarning('')
    setVerifiedCompany(null)
  }

  const verifySiret = async () => {
    const cleanSiret = siretInput.replace(/\s/g, '')
    if (cleanSiret.length !== 14) {
      setSiretError('Le SIRET doit contenir exactement 14 chiffres')
      setSiretStatus('error')
      return
    }

    setSiretStatus('checking')
    setSiretError('')
    setSiretWarning('')

    try {
      const res = await fetch(`/api/verify-siret?siret=${cleanSiret}`)
      const data = await res.json()

      if (data.verified) {
        setSiretStatus('verified')
        setVerifiedCompany(data.company)
        setSiretWarning(data.warning || '')
        setFormData(prev => ({
          ...prev,
          companyName: data.company.name,
          siret: cleanSiret,
        }))
      } else {
        setSiretStatus('error')
        setSiretError(data.error || 'SIRET invalide')
      }
    } catch {
      setSiretStatus('error')
      setSiretError('Erreur de connexion. Veuillez réessayer.')
    }
  }

  const goToStep2 = () => {
    if (siretStatus !== 'verified') return
    setStep(2)
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

    if (selectedCategories.length === 0) {
      setError('Sélectionnez au moins une catégorie')
      return
    }

    setLoading(true)

    try {
      // Store all verified company data in user_metadata for legal compliance
      const userMetadata: any = {
        full_name: formData.companyName,
        role: 'artisan',
      }
      if (verifiedCompany) {
        userMetadata.siret = verifiedCompany.siret
        userMetadata.siren = verifiedCompany.siren
        userMetadata.naf_code = verifiedCompany.nafCode
        userMetadata.naf_label = verifiedCompany.nafLabel
        userMetadata.legal_form = verifiedCompany.legalForm
        userMetadata.company_address = verifiedCompany.address
        userMetadata.company_city = verifiedCompany.city
        userMetadata.company_postal_code = verifiedCompany.postalCode
        userMetadata.company_verified = true
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: userMetadata,
        },
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      if (authData.user) {
        // Insert profile with all verified SIRET data
        const profileInsert: any = {
          user_id: authData.user.id,
          company_name: formData.companyName,
          siret: formData.siret,
          bio: formData.bio,
          categories: selectedCategories,
          verified: true,
        }
        // Add verified company fields (columns must exist in DB)
        if (verifiedCompany) {
          profileInsert.legal_form = verifiedCompany.legalForm
          profileInsert.siren = verifiedCompany.siren
          profileInsert.naf_code = verifiedCompany.nafCode
          profileInsert.naf_label = verifiedCompany.nafLabel
          profileInsert.company_address = verifiedCompany.address
          profileInsert.company_city = verifiedCompany.city
          profileInsert.company_postal_code = verifiedCompany.postalCode
          profileInsert.email = formData.email
        }
        const { data: profileData, error: profileError } = await supabase
          .from('profiles_artisan')
          .insert(profileInsert)
          .select('id')
          .single()

        if (profileError) {
          setError(profileError.message)
          setLoading(false)
          return
        }

        // Upload assurance si fournie
        if (insuranceFile && profileData?.id) {
          await uploadInsurance(profileData.id)
        }

        setSuccess(true)
      }
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
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2">Bienvenue sur Fixit !</h2>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-center gap-2 text-green-700 font-semibold">
                <span className="text-xl">✅</span>
                <span>Entreprise vérifiée automatiquement</span>
              </div>
              <p className="text-sm text-green-600 mt-1">{verifiedCompany?.name} — SIRET {formatSiret(formData.siret)}</p>
            </div>
            <p className="text-gray-600 mb-6">
              Vérifiez votre email pour confirmer votre compte, puis connectez-vous.
            </p>
            <Link
              href="/pro/login"
              className="inline-block bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-3 rounded-lg font-semibold transition"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Devenir artisan Fixit</h1>
          <p className="text-gray-600 mt-2">Rejoignez notre réseau d&apos;artisans et développez votre activité</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-[#FFC107]' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-[#FFC107] text-gray-900' : 'bg-gray-200 text-gray-500'}`}>1</div>
            <span className="font-semibold text-sm hidden sm:inline">Vérification SIRET</span>
          </div>
          <div className={`w-12 h-0.5 ${step >= 2 ? 'bg-[#FFC107]' : 'bg-gray-200'}`} />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-[#FFC107]' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-[#FFC107] text-gray-900' : 'bg-gray-200 text-gray-500'}`}>2</div>
            <span className="font-semibold text-sm hidden sm:inline">Création du compte</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">

          {/* ═══ ÉTAPE 1 : Vérification SIRET ═══ */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-2">
                <div className="text-4xl mb-3">🔍</div>
                <h2 className="text-xl font-bold">Vérification de votre entreprise</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Entrez votre numéro SIRET pour vérifier automatiquement votre entreprise
                </p>
              </div>

              {/* Info box */}
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                <p className="text-sm text-blue-800">
                  <strong>💡 Où trouver votre SIRET ?</strong> Sur votre extrait KBIS, votre attestation INSEE,
                  ou sur <a href="https://annuaire-entreprises.data.gouv.fr" target="_blank" rel="noopener noreferrer" className="underline font-semibold">annuaire-entreprises.data.gouv.fr</a>
                </p>
              </div>

              {/* SIRET input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Numéro SIRET</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={siretInput}
                    onChange={(e) => handleSiretChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); verifySiret() } }}
                    maxLength={17}
                    className={`flex-1 px-4 py-3 border-2 rounded-lg text-lg font-mono tracking-wider focus:outline-none transition ${
                      siretStatus === 'verified' ? 'border-green-400 bg-green-50' :
                      siretStatus === 'error' ? 'border-red-400 bg-red-50' :
                      'border-gray-200 focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20'
                    }`}
                    placeholder="XXX XXX XXX XXXXX"
                  />
                  <button
                    onClick={verifySiret}
                    disabled={siretInput.replace(/\s/g, '').length !== 14 || siretStatus === 'checking'}
                    className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-3 rounded-lg font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {siretStatus === 'checking' ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin">⏳</span> Vérification...
                      </span>
                    ) : 'Vérifier'}
                  </button>
                </div>
              </div>

              {/* Erreur SIRET */}
              {siretStatus === 'error' && siretError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">❌</span>
                    <div>
                      <div className="font-semibold text-red-700">Vérification échouée</div>
                      <p className="text-sm text-red-600 mt-1">{siretError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Résultat positif */}
              {siretStatus === 'verified' && verifiedCompany && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-xl">✅</span>
                      </div>
                      <div>
                        <div className="font-bold text-green-800">Entreprise vérifiée !</div>
                        <div className="text-sm text-green-600">Données officielles du registre national</div>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-0.5">Raison sociale</div>
                        <div className="font-semibold text-sm">{verifiedCompany.name}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-0.5">SIRET</div>
                        <div className="font-semibold text-sm font-mono">{formatSiret(verifiedCompany.siret)}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-0.5">Activité (NAF)</div>
                        <div className="font-semibold text-sm">{verifiedCompany.nafLabel || verifiedCompany.nafCode || 'N/A'}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-0.5">Forme juridique</div>
                        <div className="font-semibold text-sm">{verifiedCompany.legalForm || 'N/A'}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 sm:col-span-2">
                        <div className="text-xs text-gray-500 mb-0.5">Adresse du siège</div>
                        <div className="font-semibold text-sm">{verifiedCompany.address || 'N/A'}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-0.5">Statut</div>
                        <div className="font-semibold text-sm text-green-600">🟢 Active</div>
                      </div>
                      {verifiedCompany.creationDate && (
                        <div className="bg-white rounded-lg p-3">
                          <div className="text-xs text-gray-500 mb-0.5">Date de création</div>
                          <div className="font-semibold text-sm">{new Date(verifiedCompany.creationDate).toLocaleDateString('fr-FR')}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {siretWarning && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">⚠️</span>
                        <p className="text-sm text-amber-700">{siretWarning}</p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={goToStep2}
                    className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-lg font-semibold transition shadow-md hover:shadow-lg"
                  >
                    Continuer l&apos;inscription →
                  </button>
                </div>
              )}

              <div className="text-center pt-2">
                <p className="text-gray-600 text-sm">
                  Déjà inscrit ?{' '}
                  <Link href="/pro/login" className="text-[#FFC107] hover:underline font-semibold">
                    Se connecter
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* ═══ ÉTAPE 2 : Création du compte ═══ */}
          {step === 2 && (
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">✅</span>
                  <div>
                    <div className="font-semibold text-green-800 text-sm">{verifiedCompany?.name}</div>
                    <div className="text-xs text-green-600">SIRET {formatSiret(formData.siret)} — Vérifié</div>
                  </div>
                </div>
                <button type="button" onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-700 underline">
                  Modifier
                </button>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom de l&apos;entreprise</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                  placeholder="Nom affiché sur votre profil"
                />
                <p className="text-xs text-gray-400 mt-1">Pré-rempli depuis le registre. Vous pouvez le modifier.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email professionnel</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                  placeholder="pro@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description de votre activité</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none resize-none"
                  placeholder="Décrivez votre activité, vos spécialités..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Vos métiers</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.slug)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        selectedCategories.includes(cat.slug)
                          ? 'bg-[#FFC107] text-gray-900'
                          : 'bg-gray-100 text-gray-700 hover:bg-[#FFF9E6]'
                      }`}
                    >
                      {cat.icon} {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload assurance */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Attestation d&apos;assurance professionnelle
                  <span className="ml-2 text-xs text-amber-600 font-normal">Recommandé</span>
                </label>
                <p className="text-xs text-gray-400 mb-3">
                  RC Pro, décennale selon votre activité. Fichier JPG, PNG ou PDF — max 10 Mo.
                </p>

                {!insuranceFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#FFC107] hover:bg-amber-50 transition group">
                    <div className="text-center">
                      <div className="text-3xl mb-1">📄</div>
                      <p className="text-sm text-gray-500 group-hover:text-amber-700">
                        Cliquez pour ajouter votre attestation
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">PDF, JPG ou PNG</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={handleInsuranceChange}
                    />
                  </label>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                    {insurancePreview ? (
                      <img src={insurancePreview} alt="Aperçu" className="w-12 h-12 object-cover rounded-lg border" />
                    ) : (
                      <div className="w-12 h-12 bg-white rounded-lg border border-green-200 flex items-center justify-center text-2xl">📄</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-green-800 truncate">{insuranceFile.name}</p>
                      <p className="text-xs text-green-600">{(insuranceFile.size / 1024).toFixed(0)} Ko</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setInsuranceFile(null); setInsurancePreview(''); setInsuranceUrl('') }}
                      className="text-gray-400 hover:text-red-500 transition text-xl"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/20 focus:outline-none"
                    placeholder="Min. 6 caractères"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirmer</label>
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-lg font-semibold transition disabled:opacity-50 shadow-md"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span> Création du compte...
                  </span>
                ) : 'Créer mon compte artisan'}
              </button>

              <div className="text-center">
                <p className="text-gray-600 text-sm">
                  Déjà inscrit ?{' '}
                  <Link href="/pro/login" className="text-[#FFC107] hover:underline font-semibold">
                    Se connecter
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
