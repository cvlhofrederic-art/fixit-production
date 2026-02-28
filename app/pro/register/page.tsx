'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrgType = 'artisan' | 'societe_btp' | 'conciergerie' | 'gestionnaire' | 'syndic' | null
type SiretStatus = 'idle' | 'checking' | 'verified' | 'error'

interface VerifiedCompany {
  name: string; siret: string; siren: string; nafCode: string; nafLabel: string
  legalForm: string; address: string; city: string; postalCode: string
  isActive: boolean; creationDate: string; isArtisanActivity: boolean
}

// ─── Config types d'organisation ─────────────────────────────────────────────

const ORG_TYPES = [
  {
    id: 'artisan' as OrgType,
    emoji: '🔧',
    label: 'Artisan / Auto-entrepreneur',
    desc: 'Micro-entreprise, auto-entrepreneur, travailleur indépendant BTP',
    color: 'amber',
    role: 'artisan',
    examples: 'Plombier, Électricien, Peintre, Menuisier...',
  },
  {
    id: 'syndic' as OrgType,
    emoji: '🏛️',
    label: 'Syndic de copropriété',
    desc: 'Syndic professionnel, bénévole ou coopératif — gestion de copropriétés',
    color: 'purple',
    role: 'syndic',
    examples: 'Syndic professionnel, Syndic bénévole, Syndic coopératif...',
  },
  {
    id: 'gestionnaire' as OrgType,
    emoji: '🏢',
    label: 'Gestionnaire d\'immeubles',
    desc: 'Administrateur de biens, foncière, bailleur institutionnel',
    color: 'green',
    role: 'pro_gestionnaire',
    examples: 'Administrateur de biens, Foncière, Bailleur social...',
  },
  {
    id: 'conciergerie' as OrgType,
    emoji: '🗝️',
    label: 'Conciergerie',
    desc: 'Service de conciergerie résidentielle, gestion locative courte durée',
    color: 'blue',
    role: 'pro_conciergerie',
    examples: 'Conciergerie Airbnb, Gestion Airbnb, Conciergerie de luxe...',
  },
  {
    id: 'societe_btp' as OrgType,
    emoji: '🏗️',
    label: 'Entreprise BTP',
    desc: 'SARL, EURL, SAS, SA — entreprise avec salariés dans le BTP',
    color: 'blue',
    role: 'pro_societe',
    examples: 'Entreprise générale, Sous-traitant, Bureau d\'études...',
  },
]

// ─── Composant Étape 0 — Choix type organisation ─────────────────────────────

function StepChoixOrganisation({ onChoose }: { onChoose: (type: OrgType) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-5xl mb-3">⚡</div>
        <h2 className="text-2xl font-bold text-gray-900">Quel type d'organisation êtes-vous ?</h2>
        <p className="text-gray-500 mt-2 text-sm">Choisissez votre profil pour accéder à l'espace adapté à votre activité</p>
      </div>

      <div className="space-y-3">
        {ORG_TYPES.map(org => (
          <button
            key={org.id}
            onClick={() => onChoose(org.id)}
            className={`w-full text-left p-5 rounded-2xl border-2 transition-all hover:shadow-md group ${
              org.color === 'amber' ? 'border-amber-200 hover:border-amber-400 hover:bg-amber-50' :
              org.color === 'blue' ? 'border-blue-200 hover:border-blue-400 hover:bg-blue-50' :
              org.color === 'purple' ? 'border-purple-200 hover:border-purple-400 hover:bg-purple-50' :
              'border-green-200 hover:border-green-400 hover:bg-green-50'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`text-4xl w-14 h-14 flex items-center justify-center rounded-2xl flex-shrink-0 ${
                org.color === 'amber' ? 'bg-amber-100' :
                org.color === 'blue' ? 'bg-blue-100' :
                org.color === 'purple' ? 'bg-purple-100' :
                'bg-green-100'
              }`}>
                {org.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-gray-900 text-base">{org.label}</span>
                  {org.id === 'artisan' && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Auto-entrepreneur OK</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-1">{org.desc}</p>
                <p className="text-xs text-gray-500">{org.examples}</p>
              </div>
              <div className={`text-2xl transition-transform group-hover:translate-x-1 ${
                org.color === 'amber' ? 'text-amber-400' :
                org.color === 'blue' ? 'text-blue-400' :
                org.color === 'purple' ? 'text-purple-400' :
                'text-green-400'
              }`}>→</div>
            </div>
          </button>
        ))}
      </div>

    </div>
  )
}

// ─── Formulaire Artisan (flux existant) ──────────────────────────────────────

const METIERS = [
  { slug: 'plomberie', name: 'Plombier', icon: '🔧' },
  { slug: 'electricite', name: 'Électricien', icon: '⚡' },
  { slug: 'serrurerie', name: 'Serrurier', icon: '🔑' },
  { slug: 'chauffage', name: 'Chauffagiste', icon: '🔥' },
  { slug: 'peinture', name: 'Peintre', icon: '🎨' },
  { slug: 'maconnerie', name: 'Maçon', icon: '🧱' },
  { slug: 'menuiserie', name: 'Menuisier', icon: '🪚' },
  { slug: 'toiture', name: 'Couvreur', icon: '🏚️' },
  { slug: 'climatisation', name: 'Climaticien', icon: '❄️' },
  { slug: 'carrelage', name: 'Carreleur', icon: '🔲' },
  { slug: 'demenagement', name: 'Déménageur', icon: '🚚' },
  { slug: 'renovation', name: 'Rénovation générale', icon: '🏡' },
  { slug: 'vitrerie', name: 'Vitrier', icon: '🪟' },
  { slug: 'petits-travaux', name: 'Bricolage / Petits travaux', icon: '🛠️' },
  { slug: 'espaces-verts', name: 'Paysagiste / Jardinier', icon: '🌳' },
  { slug: 'nettoyage', name: 'Nettoyage', icon: '🧹' },
  { slug: 'traitement-nuisibles', name: 'Dératiseur / Désinsectiseur', icon: '🐛' },
]

// ─── Mapping NAF → métiers autorisés (anti-triche) ──────────────────────────

const BTP_METIERS = ['plomberie', 'electricite', 'serrurerie', 'chauffage', 'peinture', 'maconnerie', 'menuiserie', 'toiture', 'climatisation', 'carrelage', 'vitrerie', 'petits-travaux', 'renovation']

function getAllowedMetiers(nafCode: string | undefined): string[] | null {
  if (!nafCode) return null // pas de restriction si pas de NAF
  const c = nafCode.replace(/[.\s]/g, '')
  // BTP : construction, installations, finitions
  if (c.startsWith('41') || c.startsWith('42') || c.startsWith('43')) return BTP_METIERS
  // Métallurgie / serrurerie
  if (c.startsWith('25')) return [...BTP_METIERS]
  // Réparation machines / ingénierie
  if (c.startsWith('33') || c.startsWith('71')) return [...BTP_METIERS]
  // Dératisation / désinsectisation (81.29)
  if (c.startsWith('8129')) return ['traitement-nuisibles', 'nettoyage', 'petits-travaux']
  // Nettoyage (81.2x)
  if (c.startsWith('812') || c.startsWith('960')) return ['nettoyage', 'petits-travaux']
  // Espaces verts / jardinage
  if (c.startsWith('813') || c.startsWith('016')) return ['espaces-verts', 'petits-travaux']
  // Déménagement
  if (c.startsWith('4942')) return ['demenagement', 'petits-travaux']
  // Réparation biens personnels
  if (c.startsWith('95')) return ['petits-travaux', 'renovation']
  // Code NAF inconnu → pas de restriction (ne pas bloquer)
  return null
}

function FormulaireArtisan() {
  const [step, setStep] = useState<1 | 2>(1)
  const [formData, setFormData] = useState({ nom: '', prenom: '', email: '', telephone: '', password: '', confirmPassword: '', companyName: '', siret: '', bio: '', plan: 'freemium' as 'freemium' | 'pro' })
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null)
  const [insurancePreview, setInsurancePreview] = useState<string>('')
  const [kbisFile, setKbisFile] = useState<File | null>(null)
  const [kbisPreview, setKbisPreview] = useState<string>('')
  const [idFile, setIdFile] = useState<File | null>(null)
  const [idPreview, setIdPreview] = useState<string>('')
  const [siretInput, setSiretInput] = useState('')
  const [siretStatus, setSiretStatus] = useState<SiretStatus>('idle')
  const [siretError, setSiretError] = useState('')
  const [siretWarning, setSiretWarning] = useState('')
  const [verifiedCompany, setVerifiedCompany] = useState<VerifiedCompany | null>(null)
  const [idVerifyStatus, setIdVerifyStatus] = useState<'idle' | 'checking' | 'verified' | 'warning' | 'failed'>('idle')
  const [idVerifyDetails, setIdVerifyDetails] = useState<string[]>([])
  const [idVerifyScore, setIdVerifyScore] = useState(0)

  // Vérification automatique de la pièce d'identité par OCR
  const verifyIdDocument = async (file: File) => {
    if (!formData.nom.trim() || !formData.prenom.trim()) return // pas de vérif si pas de nom
    setIdVerifyStatus('checking')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('nom', formData.nom.trim())
      fd.append('prenom', formData.prenom.trim())
      const res = await fetch('/api/verify-id', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        setIdVerifyStatus(data.status)
        setIdVerifyDetails(data.details || [])
        setIdVerifyScore(data.score || 0)
      } else {
        setIdVerifyStatus('idle')
      }
    } catch {
      setIdVerifyStatus('idle')
    }
  }

  const formatSiret = (value: string) => {
    const digits = value.replace(/\D/g, '').substring(0, 14)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
  }

  const verifySiret = async () => {
    const clean = siretInput.replace(/\s/g, '')
    if (clean.length !== 14) { setSiretError('14 chiffres requis'); setSiretStatus('error'); return }
    setSiretStatus('checking'); setSiretError(''); setSiretWarning('')
    try {
      const res = await fetch(`/api/verify-siret?siret=${clean}`)
      const data = await res.json()
      if (data.verified) {
        setSiretStatus('verified'); setVerifiedCompany(data.company); setSiretWarning(data.warning || '')
        setFormData(prev => ({ ...prev, companyName: data.company.name, siret: clean }))
        // Filtrer les catégories sélectionnées pour ne garder que celles autorisées par le NAF
        const allowed = getAllowedMetiers(data.company.nafCode)
        if (allowed) setSelectedCategories(prev => prev.filter(c => allowed.includes(c)))
      } else { setSiretStatus('error'); setSiretError(data.error || 'SIRET invalide') }
    } catch { setSiretStatus('error'); setSiretError('Erreur de connexion') }
  }

  const uploadDocument = async (file: File, folder: string, artisanId?: string, field?: string): Promise<string> => {
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('bucket', 'artisan-documents'); fd.append('folder', folder)
      if (artisanId && field) { fd.append('artisan_id', artisanId); fd.append('field', field) }
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data.url
    } catch (err: any) { setError(`Erreur upload ${folder}: ${err.message}`); return '' }
  }

  const validateStep1 = () => {
    setError('')
    if (!formData.prenom.trim()) { setError('Prénom requis'); return false }
    if (!formData.nom.trim()) { setError('Nom requis'); return false }
    if (!formData.email.trim()) { setError('Email requis'); return false }
    if (siretStatus !== 'verified') { setError('Veuillez vérifier votre numéro SIRET'); return false }
    if (selectedCategories.length === 0) { setError('Sélectionnez au moins un métier'); return false }
    if (!kbisFile) { setError('Le KBIS ou extrait D1 est obligatoire'); return false }
    if (!idFile) { setError('La pièce d\'identité est obligatoire'); return false }
    if (!formData.password || formData.password.length < 6) { setError('Mot de passe trop court (6 min)'); return false }
    if (formData.password !== formData.confirmPassword) { setError('Mots de passe différents'); return false }
    return true
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    setLoading(true)
    try {
      const userMetadata: any = { full_name: `${formData.prenom} ${formData.nom}`, company_name: formData.companyName, phone: formData.telephone, role: 'artisan', plan: formData.plan, kyc_status: 'pending' }
      if (verifiedCompany) {
        Object.assign(userMetadata, {
          siret: verifiedCompany.siret, siren: verifiedCompany.siren,
          naf_code: verifiedCompany.nafCode, naf_label: verifiedCompany.nafLabel,
          legal_form: verifiedCompany.legalForm, company_address: verifiedCompany.address,
          company_city: verifiedCompany.city, company_postal_code: verifiedCompany.postalCode,
          company_verified: true,
        })
      }
      const { data: authData, error: authError } = await supabase.auth.signUp({ email: formData.email, password: formData.password, options: { data: userMetadata } })
      if (authError) { setError(authError.message); setLoading(false); return }
      if (authData.user) {
        const profileInsert: any = { user_id: authData.user.id, company_name: formData.companyName, siret: formData.siret, bio: formData.bio, categories: selectedCategories, verified: false, kyc_status: 'pending', first_name: formData.prenom, last_name: formData.nom, phone: formData.telephone, email: formData.email }
        if (verifiedCompany) Object.assign(profileInsert, { legal_form: verifiedCompany.legalForm, siren: verifiedCompany.siren, naf_code: verifiedCompany.nafCode, naf_label: verifiedCompany.nafLabel, company_address: verifiedCompany.address, company_city: verifiedCompany.city, company_postal_code: verifiedCompany.postalCode })
        const { data: profileData, error: profileError } = await supabase.from('profiles_artisan').insert(profileInsert).select('id').single()
        if (profileError) { setError(profileError.message); setLoading(false); return }
        if (profileData?.id) {
          await Promise.all([
            kbisFile ? uploadDocument(kbisFile, 'kbis', profileData.id, 'kbis_url') : Promise.resolve(),
            idFile ? uploadDocument(idFile, 'identity', profileData.id, 'id_document_url') : Promise.resolve(),
            insuranceFile ? uploadDocument(insuranceFile, 'insurance', profileData.id, 'insurance_url') : Promise.resolve(),
          ])
        }
        setSuccess(true)
      }
    } catch { setError('Une erreur est survenue.') }
    finally { setLoading(false) }
  }

  if (success) return (
    <div className="text-center py-8">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold mb-2">Compte créé avec succès !</h2>
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
        <p className="text-green-700 font-semibold">✅ SIRET vérifié — {verifiedCompany?.name}</p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
        <p className="text-amber-800 font-semibold">⏳ Vérification des documents en cours</p>
        <p className="text-sm text-amber-600 mt-1">Votre KBIS et pièce d&apos;identité seront vérifiés sous 24-48h. Vous recevrez un email de confirmation.</p>
      </div>
      <p className="text-gray-600 mb-6">Vérifiez votre email puis connectez-vous.</p>
      <Link href="/pro/login" className="inline-block bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-3 rounded-xl font-semibold transition">Se connecter</Link>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-2xl">🔧</div>
        <div>
          <h2 className="font-bold text-gray-900">Inscription Artisan / Auto-entrepreneur</h2>
          <p className="text-xs text-gray-500">Vérification SIRET + documents obligatoires</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {[{n:1,label:'Vos informations'},{n:2,label:'Choix de l\'offre'}].map((s,i) => (
          <div key={s.n} className="flex items-center gap-2">
            {i > 0 && <div className={`w-12 h-0.5 ${step >= s.n ? 'bg-amber-400' : 'bg-gray-200'}`} />}
            <div className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= s.n ? 'bg-[#FFC107] text-gray-900' : 'bg-gray-200 text-gray-500'}`}>{s.n}</div>
              <span className={`text-xs font-medium hidden sm:block ${step >= s.n ? 'text-gray-800' : 'text-gray-500'}`}>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={e => { e.preventDefault(); if (validateStep1()) setStep(2) }} className="space-y-5">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">{error}</div>}

          {/* Nom / Prénom */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom <span className="text-red-500">*</span></label>
              <input type="text" value={formData.prenom} onChange={e => setFormData({...formData, prenom: e.target.value})} required className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none" placeholder="Jean" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom <span className="text-red-500">*</span></label>
              <input type="text" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} required className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none" placeholder="Dupont" />
            </div>
          </div>

          {/* Email / Téléphone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email professionnel <span className="text-red-500">*</span></label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none" placeholder="pro@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input type="tel" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none" placeholder="06 00 00 00 00" />
            </div>
          </div>

          {/* SIRET */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Numéro SIRET <span className="text-red-500">*</span></label>
            <p className="text-xs text-gray-500 mb-2">Trouvez-le sur <a href="https://annuaire-entreprises.data.gouv.fr" target="_blank" rel="noopener noreferrer" className="underline text-blue-500 font-semibold">annuaire-entreprises.data.gouv.fr</a></p>
            <div className="flex gap-3">
              <input type="text" value={siretInput} onChange={e => { setSiretInput(formatSiret(e.target.value)); setSiretStatus('idle'); setSiretError(''); setVerifiedCompany(null); setSelectedCategories([]) }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); verifySiret() } }} maxLength={17}
                className={`flex-1 px-4 py-3 border-2 rounded-lg text-lg font-mono tracking-wider focus:outline-none transition ${siretStatus === 'verified' ? 'border-green-400 bg-green-50' : siretStatus === 'error' ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-[#FFC107]'}`} placeholder="XXX XXX XXX XXXXX" />
              <button type="button" onClick={verifySiret} disabled={siretInput.replace(/\s/g,'').length !== 14 || siretStatus === 'checking'}
                className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-3 rounded-xl font-semibold transition disabled:opacity-40 whitespace-nowrap">
                {siretStatus === 'checking' ? '⏳' : 'Vérifier'}
              </button>
            </div>
            {siretStatus === 'error' && <p className="text-red-600 text-sm mt-1">❌ {siretError}</p>}
            {siretStatus === 'verified' && verifiedCompany && (
              <div className="mt-2 bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="font-bold text-green-800 text-sm">✅ {verifiedCompany.name}</p>
                <p className="text-xs text-green-600">{verifiedCompany.address} · {verifiedCompany.nafLabel}</p>
                {siretWarning && <p className="text-xs text-amber-600 mt-1">⚠️ {siretWarning}</p>}
              </div>
            )}
          </div>

          {siretStatus !== 'verified' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l&apos;entreprise <span className="text-red-500">*</span></label>
              <input type="text" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none" placeholder="Ma Société" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description de l&apos;activité</label>
            <textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} rows={2} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none resize-none" placeholder="Vos spécialités, zones d'intervention..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Vos métiers <span className="text-red-500">*</span></label>
            {siretStatus === 'verified' && verifiedCompany && (
              <p className="text-xs text-gray-500 mb-2">Métiers compatibles avec votre activité{verifiedCompany.nafLabel ? ` (${verifiedCompany.nafLabel})` : ''}</p>
            )}
            {(() => {
              const allowed = siretStatus === 'verified' && verifiedCompany ? getAllowedMetiers(verifiedCompany.nafCode) : null
              const visibleMetiers = allowed ? METIERS.filter(m => allowed.includes(m.slug)) : METIERS
              return (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {visibleMetiers.map(m => (
                    <button key={m.slug} type="button" onClick={() => setSelectedCategories(prev => prev.includes(m.slug) ? prev.filter(c => c !== m.slug) : [...prev, m.slug])}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${selectedCategories.includes(m.slug) ? 'bg-[#FFC107] text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-amber-50'}`}>
                      {m.icon} {m.name}
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>

          {/* Documents obligatoires */}
          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-lg">
            <p className="text-sm text-blue-800"><strong>📋 Documents obligatoires</strong> pour valider votre inscription</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">KBIS ou extrait D1 <span className="text-red-500">*</span></label>
            <p className="text-xs text-gray-500 mb-2">Document de moins de 3 mois</p>
            {!kbisFile ? (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-red-300 rounded-xl cursor-pointer hover:border-[#FFC107] transition bg-red-50/30">
                <span className="text-2xl">🏢</span><span className="text-sm text-gray-500 mt-1">Ajouter KBIS / extrait D1</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setKbisFile(f); if (f.type.startsWith('image/')) { const r = new FileReader(); r.onload = ev => setKbisPreview(ev.target?.result as string); r.readAsDataURL(f) } } }} />
              </label>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                {kbisPreview ? <img src={kbisPreview} alt="" className="w-10 h-10 object-cover rounded" /> : <span className="text-2xl">📄</span>}
                <span className="flex-1 text-sm font-semibold text-green-800 truncate">{kbisFile.name}</span>
                <button type="button" onClick={() => { setKbisFile(null); setKbisPreview('') }} className="text-gray-500 hover:text-red-500">✕</button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pièce d&apos;identité <span className="text-red-500">*</span></label>
            <p className="text-xs text-gray-500 mb-2">CNI, passeport ou titre de séjour (recto/verso)</p>
            {!idFile ? (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-red-300 rounded-xl cursor-pointer hover:border-[#FFC107] transition bg-red-50/30">
                <span className="text-2xl">🪪</span><span className="text-sm text-gray-500 mt-1">Ajouter pièce d&apos;identité</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setIdFile(f); if (f.type.startsWith('image/')) { const r = new FileReader(); r.onload = ev => setIdPreview(ev.target?.result as string); r.readAsDataURL(f) }; verifyIdDocument(f) } }} />
              </label>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                {idPreview ? <img src={idPreview} alt="" className="w-10 h-10 object-cover rounded" /> : <span className="text-2xl">📄</span>}
                <span className="flex-1 text-sm font-semibold text-green-800 truncate">{idFile.name}</span>
                <button type="button" onClick={() => { setIdFile(null); setIdPreview(''); setIdVerifyStatus('idle'); setIdVerifyDetails([]) }} className="text-gray-500 hover:text-red-500">✕</button>
              </div>
            )}
            {/* Résultat vérification OCR */}
            {idVerifyStatus === 'checking' && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                <span className="animate-spin">⏳</span> Scan OCR en cours...
              </div>
            )}
            {idVerifyStatus === 'verified' && (
              <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2.5">
                <p className="text-sm font-semibold text-green-700">✅ Identité vérifiée ({idVerifyScore}%)</p>
                <p className="text-xs text-green-600 mt-0.5">{idVerifyDetails.join(' · ')}</p>
              </div>
            )}
            {idVerifyStatus === 'warning' && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <p className="text-sm font-semibold text-amber-700">⚠️ Vérification partielle ({idVerifyScore}%)</p>
                <p className="text-xs text-amber-600 mt-0.5">{idVerifyDetails.join(' · ')}</p>
                <p className="text-xs text-gray-500 mt-1">Le document sera vérifié manuellement par notre équipe</p>
              </div>
            )}
            {idVerifyStatus === 'failed' && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2.5">
                <p className="text-sm font-semibold text-red-700">❌ Nom/prénom non trouvés sur le document</p>
                <p className="text-xs text-red-600 mt-0.5">{idVerifyDetails.join(' · ')}</p>
                <p className="text-xs text-gray-500 mt-1">Vérifiez que le nom correspond à votre pièce d&apos;identité</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Attestation RC Pro <span className="text-xs text-gray-500 font-normal">(recommandé)</span></label>
            {!insuranceFile ? (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#FFC107] transition">
                <span className="text-2xl">📄</span><span className="text-sm text-gray-500 mt-1">Ajouter attestation RC Pro</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setInsuranceFile(f); if (f.type.startsWith('image/')) { const r = new FileReader(); r.onload = ev => setInsurancePreview(ev.target?.result as string); r.readAsDataURL(f) } } }} />
              </label>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                {insurancePreview ? <img src={insurancePreview} alt="" className="w-10 h-10 object-cover rounded" /> : <span className="text-2xl">📄</span>}
                <span className="flex-1 text-sm font-semibold text-green-800 truncate">{insuranceFile.name}</span>
                <button type="button" onClick={() => { setInsuranceFile(null); setInsurancePreview('') }} className="text-gray-500 hover:text-red-500">✕</button>
              </div>
            )}
          </div>

          {/* Mot de passe */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe <span className="text-red-500">*</span></label>
              <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required minLength={6} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none" placeholder="6 caractères min." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer <span className="text-red-500">*</span></label>
              <input type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} required className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none" placeholder="Répéter" />
            </div>
          </div>

          <button type="submit" className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-xl font-semibold transition">
            Continuer — Choisir mon offre →
          </button>
        </form>
      )}

      {/* Step 2 — Choix de l'offre + Création */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-800 text-sm">✅ {formData.prenom} {formData.nom} — {verifiedCompany?.name || formData.companyName}</p>
              <p className="text-xs text-green-600">SIRET vérifié · {selectedCategories.length} métier(s) · Documents fournis</p>
            </div>
            <button type="button" onClick={() => setStep(1)} className="text-xs text-gray-500 hover:underline">Modifier</button>
          </div>

          <div className="text-center">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Choisissez votre offre</h3>
            <p className="text-sm text-gray-500">Commencez gratuitement et passez au Pro quand vous êtes prêt</p>
          </div>

          {/* Comparison table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Module</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-700 w-20">Freemium<br/><span className="text-gray-900 font-bold">0€</span></th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-[#FFC107] w-20">Pro<br/><span className="font-bold">49€<span className="font-normal text-gray-500">/mois</span></span></th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Profil artisan vérifié', free: true, pro: true },
                  { label: 'Devis & factures PDF', free: true, pro: true },
                  { label: 'Agenda en ligne', free: false, pro: true },
                  { label: 'Réservations clients', free: false, pro: true },
                  { label: 'Messagerie client', free: false, pro: true },
                  { label: 'Mise en avant recherche', free: false, pro: true },
                  { label: 'Comptabilité IA (Léa)', free: false, pro: true },
                  { label: 'Proof of Work', free: false, pro: true },
                  { label: 'Notifications push', free: false, pro: true },
                  { label: 'App mobile', free: false, pro: true },
                  { label: 'Support prioritaire', free: false, pro: true },
                ].map((f, i) => (
                  <tr key={f.label} className={i % 2 === 0 ? 'bg-gray-50/50' : ''}>
                    <td className="px-4 py-2.5 text-gray-700">{f.label}</td>
                    <td className="text-center px-3 py-2.5">{f.free ? <span className="text-green-500 font-bold">✓</span> : <span className="text-red-400 font-bold">✗</span>}</td>
                    <td className="text-center px-3 py-2.5"><span className="text-green-500 font-bold">✓</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={async () => { setFormData(prev => ({ ...prev, plan: 'freemium' })); await handleRegister({ preventDefault: () => {} } as React.FormEvent) }}
              className="py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition disabled:opacity-60"
            >
              {loading && formData.plan === 'freemium' ? '⏳ Création...' : 'Choisir Freemium'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={async () => { setFormData(prev => ({ ...prev, plan: 'pro' })); await handleRegister({ preventDefault: () => {} } as React.FormEvent) }}
              className="py-3 rounded-xl bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 font-semibold text-sm transition disabled:opacity-60"
            >
              {loading && formData.plan === 'pro' ? '⏳ Création...' : 'Choisir Pro — 49€/mois'}
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center">Paiement non requis pour l&apos;instant — vous pourrez activer l&apos;offre Pro depuis votre tableau de bord</p>

          <button type="button" onClick={() => setStep(1)} className="w-full border-2 border-gray-200 text-gray-600 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition text-sm">← Retour</button>
        </div>
      )}
    </div>
  )
}

// ─── Formulaire générique Pro (Société / Conciergerie / Gestionnaire) ─────────

function FormulaireProGenerique({ orgType }: { orgType: OrgType }) {
  const org = ORG_TYPES.find(o => o.id === orgType)!
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', telephone: '', password: '', confirmPassword: '', companyName: '', nbEmployes: '', secteur: '', ville: '', codePostal: '' })
  const [siretInput, setSiretInput] = useState('')
  const [siretStatus, setSiretStatus] = useState<SiretStatus>('idle')
  const [siretError, setSiretError] = useState('')
  const [company, setCompany] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const verifySiret = async () => {
    const clean = siretInput.replace(/\s/g, '')
    if (clean.length !== 14) { setSiretError('14 chiffres requis'); setSiretStatus('error'); return }
    setSiretStatus('checking'); setSiretError('')
    try {
      const res = await fetch(`/api/verify-siret?siret=${clean}`)
      const data = await res.json()
      if (data.verified) { setSiretStatus('verified'); setCompany(data.company); setForm(f => ({ ...f, companyName: data.company.name })) }
      else { setSiretStatus('error'); setSiretError(data.error || 'SIRET invalide') }
    } catch { setSiretStatus('error'); setSiretError('Erreur de connexion') }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) { setError('Mots de passe différents'); return }
    if (form.password.length < 8) { setError('Mot de passe trop court (8 min)'); return }
    setLoading(true); setError('')
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: {
          data: {
            role: org.role,
            org_type: orgType,
            full_name: `${form.prenom} ${form.nom}`,
            phone: form.telephone,
            company_name: company?.name || form.companyName,
            company_siren: company?.siren || '',
            company_address: company?.address || '',
            siret: siretInput.replace(/\s/g, ''),
            nb_employes: form.nbEmployes,
            secteur: form.secteur,
            ville: form.ville,
            abonnement: 'trial',
          }
        }
      })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }
      setSuccess(true)
    } catch { setError('Une erreur est survenue.') }
    finally { setLoading(false) }
  }

  if (success) return (
    <div className="text-center py-8">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold mb-2">Compte créé !</h2>
      <p className="text-gray-600 mb-2">Vérifiez votre email pour confirmer votre compte.</p>
      <p className={`font-semibold mb-6 ${org.color === 'blue' ? 'text-blue-600' : org.color === 'purple' ? 'text-purple-600' : 'text-green-600'}`}>14 jours d'essai gratuit inclus ✅</p>
      <Link href="/pro/login" className={`inline-block text-white px-8 py-3 rounded-xl font-bold transition ${org.color === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : org.color === 'purple' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'}`}>Se connecter</Link>
    </div>
  )

  const accent = org.color === 'blue' ? 'border-blue-400 bg-blue-50 text-blue-600' : org.color === 'purple' ? 'border-purple-400 bg-purple-50 text-purple-600' : 'border-green-400 bg-green-50 text-green-600'
  const btnClass = org.color === 'blue' ? 'bg-blue-600 hover:bg-blue-700 text-white' : org.color === 'purple' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'

  const secteurs = orgType === 'societe_btp'
    ? ['Gros œuvre / Maçonnerie', 'Électricité / Plomberie', 'Peinture / Revêtements', 'Menuiserie / Charpente', 'CVC / Climatisation', 'Toiture / Étanchéité', 'Entreprise générale', 'Bureau d\'études', 'Autre BTP']
    : orgType === 'conciergerie'
    ? ['Conciergerie Airbnb / Courte durée', 'Conciergerie résidentielle', 'Gestion locative', 'Conciergerie de luxe', 'Services aux entreprises']
    : ['Administration de biens résidentiels', 'Gestion copropriété', 'Foncière / Bailleur social', 'Gestion commerciale', 'Promoteur / Marchand de biens']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-3xl ${org.color === 'blue' ? 'bg-blue-100' : org.color === 'purple' ? 'bg-purple-100' : 'bg-green-100'}`}>{org.emoji}</div>
        <div>
          <h2 className="font-bold text-gray-900">{org.label}</h2>
          <p className="text-xs text-gray-500">{org.desc}</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {[{n:1,label:'Société'},{n:2,label:'Contact'},{n:3,label:'Sécurité'}].map((s,i) => (
          <div key={s.n} className="flex items-center gap-2">
            {i > 0 && <div className={`w-8 h-0.5 ${step > s.n ? (org.color === 'blue' ? 'bg-blue-500' : org.color === 'purple' ? 'bg-purple-500' : 'bg-green-500') : 'bg-gray-200'}`} />}
            <div className="flex items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= s.n ? (org.color === 'blue' ? 'bg-blue-600 text-white' : org.color === 'purple' ? 'bg-purple-600 text-white' : 'bg-green-600 text-white') : 'bg-gray-200 text-gray-500'}`}>{s.n}</div>
              <span className={`text-xs hidden sm:block ${step >= s.n ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">{error}</div>}

      {/* Étape 1 — Société */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">SIRET <span className="text-gray-500 font-normal">(optionnel mais recommandé)</span></label>
            <div className="flex gap-2">
              <input type="text" value={siretInput} onChange={e => { setSiretInput(e.target.value); setSiretStatus('idle') }} maxLength={17}
                className={`flex-1 px-4 py-3 border-2 rounded-lg font-mono text-sm focus:outline-none ${siretStatus === 'verified' ? 'border-green-400 bg-green-50' : siretStatus === 'error' ? 'border-red-400' : 'border-gray-200 focus:border-purple-400'}`} placeholder="XXX XXX XXX XXXXX" />
              <button type="button" onClick={verifySiret} disabled={siretStatus === 'checking'} className={`px-4 py-3 rounded-xl font-semibold transition text-sm ${btnClass}`}>
                {siretStatus === 'checking' ? '⏳' : 'Vérifier'}
              </button>
            </div>
            {siretStatus === 'error' && <p className="text-red-600 text-xs mt-1">❌ {siretError}</p>}
            {siretStatus === 'verified' && company && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                <p className="font-semibold text-green-800">✅ {company.name}</p>
                <p className="text-xs text-green-600">{company.address}</p>
              </div>
            )}
          </div>

          {siretStatus !== 'verified' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nom de la société <span className="text-red-500">*</span></label>
              <input type="text" value={form.companyName} onChange={e => setForm(f => ({...f, companyName: e.target.value}))} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none" placeholder="Ma Société SARL" />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Secteur d'activité <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-1 gap-2">
              {secteurs.map(s => (
                <button key={s} type="button" onClick={() => setForm(f => ({...f, secteur: s}))}
                  className={`text-left px-4 py-2.5 rounded-xl border-2 text-sm transition ${form.secteur === s ? `${accent} border-2 font-semibold` : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}>
                  {form.secteur === s ? '✓ ' : ''}{s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre d'employés</label>
            <select value={form.nbEmployes} onChange={e => setForm(f => ({...f, nbEmployes: e.target.value}))} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none bg-white">
              <option value="">Sélectionner...</option>
              <option value="2-5">2 à 5 employés</option>
              <option value="6-20">6 à 20 employés</option>
              <option value="21-50">21 à 50 employés</option>
              <option value="51-200">51 à 200 employés</option>
              <option value="200+">Plus de 200 employés</option>
            </select>
          </div>

          <button type="button" onClick={() => {
            if (!form.companyName && !company) { setError('Indiquez le nom de votre société'); return }
            if (!form.secteur) { setError('Sélectionnez un secteur d\'activité'); return }
            setError(''); setStep(2)
          }} className={`w-full py-3 rounded-xl font-bold transition ${btnClass}`}>Continuer →</button>
        </div>
      )}

      {/* Étape 2 — Contact */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom <span className="text-red-500">*</span></label>
              <input type="text" value={form.prenom} onChange={e => setForm(f => ({...f, prenom: e.target.value}))} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none" placeholder="Jean" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom <span className="text-red-500">*</span></label>
              <input type="text" value={form.nom} onChange={e => setForm(f => ({...f, nom: e.target.value}))} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none" placeholder="Dupont" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email professionnel <span className="text-red-500">*</span></label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none" placeholder="jean@masociete.fr" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input type="tel" value={form.telephone} onChange={e => setForm(f => ({...f, telephone: e.target.value}))} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none" placeholder="06 00 00 00 00" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
              <input type="text" value={form.ville} onChange={e => setForm(f => ({...f, ville: e.target.value}))} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none" placeholder="Paris" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
              <input type="text" value={form.codePostal} onChange={e => setForm(f => ({...f, codePostal: e.target.value}))} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none" placeholder="75001" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setStep(1)} className="flex-1 border-2 border-gray-200 text-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-50 transition">← Retour</button>
            <button type="button" onClick={() => {
              if (!form.prenom || !form.nom || !form.email) { setError('Remplissez les champs obligatoires'); return }
              setError(''); setStep(3)
            }} className={`flex-1 py-3 rounded-xl font-bold transition ${btnClass}`}>Continuer →</button>
          </div>
        </div>
      )}

      {/* Étape 3 — Sécurité */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe <span className="text-red-500">*</span></label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required minLength={8} className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none" placeholder="8 caractères minimum" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
            <input type="password" value={form.confirmPassword} onChange={e => setForm(f => ({...f, confirmPassword: e.target.value}))} required className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none" placeholder="Répétez le mot de passe" />
          </div>

          {/* Récap */}
          <div className={`rounded-xl p-4 text-sm space-y-1.5 border ${org.color === 'blue' ? 'bg-blue-50 border-blue-100' : org.color === 'purple' ? 'bg-purple-50 border-purple-100' : 'bg-green-50 border-green-100'}`}>
            <p className={`font-semibold mb-2 ${org.color === 'blue' ? 'text-blue-800' : org.color === 'purple' ? 'text-purple-800' : 'text-green-800'}`}>{org.emoji} Récapitulatif</p>
            <p className="text-gray-600">🏢 {company?.name || form.companyName}</p>
            <p className="text-gray-600">👤 {form.prenom} {form.nom} — {form.email}</p>
            <p className="text-gray-600">📌 {form.secteur}</p>
            <p className={`font-semibold mt-2 ${org.color === 'blue' ? 'text-blue-700' : org.color === 'purple' ? 'text-purple-700' : 'text-green-700'}`}>✅ 14 jours d'essai gratuit</p>
          </div>

          <p className="text-xs text-gray-500">En créant un compte vous acceptez les <Link href="/cgu" className="text-purple-600 hover:underline">CGU</Link> et la <Link href="/confidentialite" className="text-purple-600 hover:underline">politique de confidentialité</Link>.</p>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(2)} className="flex-1 border-2 border-gray-200 text-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-50 transition">← Retour</button>
            <button type="submit" disabled={loading} className={`flex-1 py-3 rounded-xl font-bold transition disabled:opacity-60 ${btnClass}`}>
              {loading ? '⏳ Création...' : 'Créer mon compte'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ProRegisterPage() {
  const [orgType, setOrgType] = useState<OrgType>(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <span className="text-3xl">⚡</span>
            <span className="text-2xl font-bold text-[#FFC107]">Vitfix</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Créer votre espace professionnel</h1>
          <p className="text-gray-500 mt-2 text-sm">14 jours d'essai gratuit — Sans engagement — Sans carte bancaire</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Breadcrumb si type choisi */}
          {orgType && (
            <div className="mb-6">
              <button onClick={() => setOrgType(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition">
                <span>←</span>
                <span>Changer de type d'organisation</span>
              </button>
            </div>
          )}

          {/* Étape 0 — Choix du type */}
          {!orgType && <StepChoixOrganisation onChoose={setOrgType} />}

          {/* Artisan */}
          {orgType === 'artisan' && <FormulaireArtisan />}

          {/* Société / Conciergerie / Gestionnaire → vitfix.pro */}
          {orgType && orgType !== 'artisan' && (() => {
            const org = ORG_TYPES.find(o => o.id === orgType)!
            return (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-3xl ${org.color === 'blue' ? 'bg-blue-100' : org.color === 'purple' ? 'bg-purple-100' : 'bg-green-100'}`}>{org.emoji}</div>
                  <div>
                    <h2 className="font-bold text-gray-900">{org.label}</h2>
                    <p className="text-xs text-gray-500">{org.desc}</p>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-blue-50 border-2 border-blue-200 rounded-2xl p-8 text-center">
                  <div className="text-5xl mb-4">🚀</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Bientôt disponible</h3>
                  <p className="text-gray-600 mb-4">
                    L'espace de gestion pour les profils <strong>{org.label}</strong> sera accessible sur notre plateforme dédiée aux professionnels.
                  </p>
                  <div className="inline-flex items-center gap-2 bg-white border-2 border-blue-300 rounded-xl px-5 py-3 mb-4">
                    <span className="text-lg">🌐</span>
                    <span className="font-bold text-blue-600 text-lg">vitfix.pro</span>
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-semibold">BIENTÔT</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Ce site est dédié à la marketplace (clients et artisans indépendants).<br />
                    La gestion professionnelle (équipes, facturation avancée, multi-sites) sera disponible sur <strong>vitfix.pro</strong>.
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-gray-700">
                    <strong>💡 Vous êtes artisan indépendant ?</strong>{' '}
                    <button onClick={() => setOrgType('artisan')} className="text-[#FFC107] hover:underline font-semibold">
                      Inscrivez-vous ici →
                    </button>
                  </p>
                </div>
              </div>
            )
          })()}
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Déjà un compte ?{' '}
          <Link href="/pro/login" className="text-[#FFC107] hover:underline font-semibold">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
