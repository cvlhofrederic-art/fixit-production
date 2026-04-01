'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import LocaleLink from '@/components/common/LocaleLink'
import { useSearchParams } from 'next/navigation'
import { mapLegalFormToKey, getLegalStructureOptions } from '@/lib/tax-calculator'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrgType = 'artisan' | 'societe_btp' | 'conciergerie' | 'gestionnaire' | 'syndic' | null
type SiretStatus = 'idle' | 'checking' | 'verified' | 'error'

// ─── Mapping secteur BTP label → specialty slug ───────────────────────────────
const SECTEUR_TO_SLUG: Record<string, string> = {
  'Gros œuvre / Maçonnerie':   'gros-oeuvre',
  'Électricité / Plomberie':   'electricite',
  'Peinture / Revêtements':    'peinture',
  'Menuiserie / Charpente':    'menuiserie-bois',
  'CVC / Climatisation':       'chauffage',
  'Toiture / Étanchéité':      'couverture',
  'Métallerie / Ferronnerie':  'ferronnerie',
  'Entreprise générale':       'renovation-generale',
  "Bureau d'études":           'renovation-generale',
  'Autre BTP':                 'renovation-generale',
}

function secteursToSlugs(secteurs: string[]): string[] {
  return secteurs
    .map(s => SECTEUR_TO_SLUG[s] ?? s.toLowerCase().replace(/[\s/().'']/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
}

interface VerifiedCompany {
  name: string; siret: string; siren: string; nafCode: string; nafLabel: string
  legalForm: string; address: string; city: string; postalCode: string
  isActive: boolean; creationDate: string; isArtisanActivity: boolean
}

// ─── Config types d'organisation ─────────────────────────────────────────────

function getOrgTypes(t: (key: string) => string) {
  return [
    {
      id: 'artisan' as OrgType,
      emoji: '🔧',
      label: t('register.orgArtisanLabel'),
      desc: t('register.orgArtisanDesc'),
      color: 'amber',
      role: 'artisan',
      examples: t('register.orgArtisanExamples'),
    },
    {
      id: 'syndic' as OrgType,
      emoji: '🏛️',
      label: t('register.orgSyndicLabel'),
      desc: t('register.orgSyndicDesc'),
      color: 'purple',
      role: 'syndic',
      examples: t('register.orgSyndicExamples'),
    },
    {
      id: 'gestionnaire' as OrgType,
      emoji: '🏢',
      label: t('register.orgGestionnaireLabel'),
      desc: t('register.orgGestionnaireDesc'),
      color: 'green',
      role: 'pro_gestionnaire',
      examples: t('register.orgGestionnaireExamples'),
    },
    {
      id: 'conciergerie' as OrgType,
      emoji: '🗝️',
      label: t('register.orgConciergerieLabel'),
      desc: t('register.orgConciergerieDesc'),
      color: 'blue',
      role: 'pro_conciergerie',
      examples: t('register.orgConciergerieExamples'),
    },
    {
      id: 'societe_btp' as OrgType,
      emoji: '🏗️',
      label: t('register.orgBtpLabel'),
      desc: t('register.orgBtpDesc'),
      color: 'blue',
      role: 'pro_societe',
      examples: t('register.orgBtpExamples'),
    },
  ]
}

// ─── Composant Étape 0 — Choix type organisation ─────────────────────────────

function StepChoixOrganisation({ onChoose }: { onChoose: (type: OrgType) => void }) {
  const { t } = useTranslation()
  const ORG_TYPES = getOrgTypes(t)
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-3xl font-display font-black tracking-[-0.03em] uppercase text-dark mb-3"><span className="text-yellow">VIT</span>FIX</div>
        <h2 className="text-2xl font-display font-black tracking-[-0.03em] text-dark">{t('register.orgChoiceTitle')}</h2>
        <p className="text-text-muted mt-2 text-sm">{t('register.orgChoiceSubtitle')}</p>
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
                  <span className="font-bold text-dark text-base">{org.label}</span>
                  {org.id === 'artisan' && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{t('register.orgArtisanBadge')}</span>
                  )}
                </div>
                <p className="text-sm text-text-muted mb-1">{org.desc}</p>
                <p className="text-xs text-text-muted">{org.examples}</p>
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

function getMetiers(t: (key: string) => string) {
  return [
    { slug: 'plomberie', name: t('register.metierPlombier'), icon: '🔧' },
    { slug: 'electricite', name: t('register.metierElectricien'), icon: '⚡' },
    { slug: 'serrurerie', name: t('register.metierSerrurier'), icon: '🔑' },
    { slug: 'chauffage', name: t('register.metierChauffagiste'), icon: '🔥' },
    { slug: 'peinture', name: t('register.metierPeintre'), icon: '🎨' },
    { slug: 'maconnerie', name: t('register.metierMacon'), icon: '🧱' },
    { slug: 'menuiserie', name: t('register.metierMenuisier'), icon: '🪚' },
    { slug: 'toiture', name: t('register.metierCouvreur'), icon: '🏚️' },
    { slug: 'climatisation', name: t('register.metierClimaticien'), icon: '❄️' },
    { slug: 'carrelage', name: t('register.metierCarreleur'), icon: '🔲' },
    { slug: 'demenagement', name: t('register.metierDemenageur'), icon: '🚚' },
    { slug: 'renovation', name: t('register.metierRenovation'), icon: '🏡' },
    { slug: 'vitrerie', name: t('register.metierVitrier'), icon: '🪟' },
    { slug: 'petits-travaux', name: t('register.metierBricolage'), icon: '🛠️' },
    { slug: 'espaces-verts', name: t('register.metierPaysagiste'), icon: '🌳' },
    { slug: 'nettoyage', name: t('register.metierNettoyage'), icon: '🧹' },
    { slug: 'traitement-nuisibles', name: t('register.metierDeratiseur'), icon: '🐛' },
    { slug: 'plaquiste', name: t('register.metierPlaquiste'), icon: '🔳' },
    { slug: 'ramonage', name: t('register.metierRamoneur'), icon: '🔥' },
    { slug: 'piscine', name: t('register.metierPisciniste'), icon: '🏊' },
    { slug: 'store-banne', name: t('register.metierStoreBanne'), icon: '☀️' },
    { slug: 'paysagiste', name: t('register.metierPaysagisteConcepteur'), icon: '🌿' },
    { slug: 'debouchage', name: t('register.metierDebouchage'), icon: '🚿' },
    { slug: 'metallerie', name: t('register.metierMetallerie'), icon: '⚙️' },
  ]
}

// ─── Mapping NAF → métiers autorisés (anti-triche) ──────────────────────────

const BTP_METIERS = ['plomberie', 'electricite', 'serrurerie', 'chauffage', 'peinture', 'maconnerie', 'menuiserie', 'toiture', 'climatisation', 'carrelage', 'vitrerie', 'petits-travaux', 'renovation', 'plaquiste', 'ramonage', 'store-banne', 'debouchage', 'metallerie']

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
  // Ramonage (81.22)
  if (c.startsWith('8122')) return ['ramonage', 'nettoyage', 'petits-travaux']
  // Espaces verts / jardinage / paysagiste
  if (c.startsWith('813') || c.startsWith('016')) return ['espaces-verts', 'paysagiste', 'petits-travaux']
  // Installations spécialisées (43.29) — piscine, store, etc.
  if (c.startsWith('4329')) return [...BTP_METIERS, 'piscine']
  // Déménagement
  if (c.startsWith('4942')) return ['demenagement', 'petits-travaux']
  // Réparation biens personnels
  if (c.startsWith('95')) return ['petits-travaux', 'renovation']
  // Code NAF inconnu → pas de restriction (ne pas bloquer)
  return null
}

function FormulaireArtisan() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const METIERS = getMetiers(t)
  const [step, setStep] = useState<1 | 2>(1)
  const [formData, setFormData] = useState({ nom: '', prenom: '', email: '', telephone: '', password: '', confirmPassword: '', companyName: '', siret: '', bio: '', plan: 'freemium' as 'freemium' | 'pro' })
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [referralParrainName, setReferralParrainName] = useState<string | null>(null)

  // Lire le code parrainage depuis cookie, localStorage ou searchParams
  useEffect(() => {
    // Priorité : searchParams > cookie > localStorage
    const refParam = searchParams.get('ref')?.toUpperCase().trim()
    if (refParam && refParam.length >= 4) { setReferralCode(refParam); return }

    const cookieMatch = document.cookie.match(/(?:^|;\s*)vitfix_ref=([A-Z0-9]+)/)
    if (cookieMatch?.[1]) { setReferralCode(cookieMatch[1]); return }

    try {
      const stored = localStorage.getItem('vtfx_referral_code')
      if (stored) setReferralCode(stored)
    } catch {}
  }, [searchParams])
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
    if (clean.length !== 14) { setSiretError(t('register.taxId14digits')); setSiretStatus('error'); return }
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
      } else { setSiretStatus('error'); setSiretError(data.error || t('register.taxIdInvalid')) }
    } catch { setSiretStatus('error'); setSiretError(t('register.connectionError')) }
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
    } catch (err: any) { setError(`${t('register.uploadError')} ${folder}: ${err.message}`); return '' }
  }

  const validateStep1 = () => {
    setError('')
    if (!formData.prenom.trim()) { setError(t('register.firstNameRequired')); return false }
    if (!formData.nom.trim()) { setError(t('register.lastNameRequired')); return false }
    if (!formData.email.trim()) { setError(t('register.emailRequired')); return false }
    if (siretStatus !== 'verified') { setError(t('register.verifyTaxId')); return false }
    if (selectedCategories.length === 0) { setError(t('register.selectOneTrade')); return false }
    if (!kbisFile) { setError(t('register.kbisRequired')); return false }
    if (!idFile) { setError(t('register.idRequired')); return false }
    if (!formData.password || formData.password.length < 8 || !/[A-Z]/.test(formData.password) || !/[a-z]/.test(formData.password) || !/[0-9]/.test(formData.password)) { setError(t('register.passwordTooShort')); return false }
    if (formData.password !== formData.confirmPassword) { setError(t('register.passwordMismatch')); return false }
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
        // Détecter le pays via la locale (cookie ou navigator)
        const localeCookie = document.cookie.match(/(?:^|;\s*)locale=(\w+)/)?.[1]
        const artisanCountry = localeCookie === 'pt' ? 'PT' : 'FR'
        const profileInsert: any = { user_id: authData.user.id, company_name: formData.companyName, siret: formData.siret, bio: formData.bio, categories: selectedCategories, verified: false, kyc_status: 'pending', first_name: formData.prenom, last_name: formData.nom, phone: formData.telephone, email: formData.email, country: artisanCountry }
        if (verifiedCompany) Object.assign(profileInsert, { legal_form: verifiedCompany.legalForm, siren: verifiedCompany.siren, naf_code: verifiedCompany.nafCode, naf_label: verifiedCompany.nafLabel, company_address: verifiedCompany.address, company_city: verifiedCompany.city, company_postal_code: verifiedCompany.postalCode })
        const { data: profileData, error: profileError } = await supabase.from('profiles_artisan').insert(profileInsert).select('id').single()
        if (profileError) { setError(profileError.message); setLoading(false); return }
        if (profileData?.id) {
          await Promise.all([
            kbisFile ? uploadDocument(kbisFile, 'kbis', profileData.id, 'kbis_url') : Promise.resolve(),
            idFile ? uploadDocument(idFile, 'identity', profileData.id, 'id_document_url') : Promise.resolve(),
            insuranceFile ? uploadDocument(insuranceFile, 'insurance', profileData.id, 'insurance_url') : Promise.resolve(),
          ])

          // ── KYC anti-fraude : déclencher en background (non-bloquant) ──
          fetch('/api/kyc-orchestrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}` },
            body: JSON.stringify({ artisan_id: profileData.id }),
          }).catch(() => { /* KYC non-bloquant */ })

          // ── Spécialités granulaires — lier le profil aux spécialités choisies ──────
          try {
            await fetch('/api/profile/specialties', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: authData.user.id,
                slugs: selectedCategories,
                verified_source: kbisFile ? 'kbis' : 'self_declared',
              }),
            })
          } catch { /* non-bloquant */ }

          // ── Motifs par défaut : insérer selon le métier (silencieux, non-bloquant) ──
          try {
            await fetch('/api/seed-motifs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ artisan_id: profileData.id, categories: selectedCategories }),
            })
          } catch { /* non-bloquant */ }

          // ── Parrainage : lier le filleul au parrain (silencieux, non-bloquant) ──
          if (referralCode && profileData?.id && authData.user?.id) {
            try {
              const refRes = await fetch('/api/referral/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: referralCode, artisan_id: profileData.id, user_id: authData.user.id }),
              })
              const refData = await refRes.json()
              if (refData.referral && refData.parrain_name) {
                setReferralParrainName(refData.parrain_name)
              }
            } catch {
              // Erreur parrainage non-bloquante, l'inscription est déjà réussie
            }
            // Supprimer le cookie vitfix_ref
            document.cookie = 'vitfix_ref=; max-age=0; path=/; SameSite=Lax; Secure'
            try { localStorage.removeItem('vtfx_referral_code') } catch {}
          }
        }
        setSuccess(true)
      }
    } catch { setError(t('register.genericError')) }
    finally { setLoading(false) }
  }

  if (success) return (
    <div className="text-center py-8">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-display font-black tracking-[-0.03em] mb-2">{t('register.successTitle')}</h2>
      {referralParrainName && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4">
          <p className="text-amber-800 font-semibold">🎁 Parrainé par {referralParrainName}</p>
          <p className="text-sm text-amber-600 mt-1">Votre 1er mois sera offert lors de votre abonnement !</p>
        </div>
      )}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
        <p className="text-green-700 font-semibold">✅ {t('register.taxIdVerified')} — {verifiedCompany?.name}</p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
        <p className="text-amber-800 font-semibold">⏳ {t('register.docsVerifTitle')}</p>
        <p className="text-sm text-amber-600 mt-1">{t('register.docsVerifDesc')}</p>
      </div>
      <p className="text-text-muted mb-6">{t('register.checkEmailLogin')}</p>
      <LocaleLink href="/pro/login" className="inline-block bg-yellow hover:bg-yellow-light text-dark px-8 py-3 rounded-xl font-semibold transition hover:-translate-y-px">{t('register.login')}</LocaleLink>
    </div>
  )

  return (
    <div className="space-y-6">
      {referralCode && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-2">
          <span className="text-lg">🎁</span>
          <span className="text-sm text-amber-800 font-medium">1er mois offert grâce à votre lien de parrainage</span>
        </div>
      )}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-2xl">🔧</div>
        <div>
          <h2 className="font-bold text-dark">{t('register.artisanTitle')}</h2>
          <p className="text-xs text-text-muted">{t('register.artisanSubtitle')}</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {[{n:1,label:t('register.step1Label')},{n:2,label:t('register.step2Label')}].map((s,i) => (
          <div key={s.n} className="flex items-center gap-2">
            {i > 0 && <div className={`w-12 h-0.5 ${step >= s.n ? 'bg-amber-400' : 'bg-[#E0E0E0]'}`} />}
            <div className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= s.n ? 'bg-yellow text-dark' : 'bg-[#E0E0E0] text-text-muted'}`}>{s.n}</div>
              <span className={`text-xs font-medium hidden sm:block ${step >= s.n ? 'text-dark' : 'text-text-muted'}`}>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={e => { e.preventDefault(); if (validateStep1()) setStep(2) }} className="space-y-5">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-200">{error}</div>}

          {/* Nom / Prénom */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-mid mb-1">{t('register.firstName')} <span className="text-red-500">*</span></label>
              <input type="text" value={formData.prenom} onChange={e => setFormData({...formData, prenom: e.target.value})} required className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none" placeholder="Jean" />
            </div>
            <div>
              <label className="block text-sm font-medium text-mid mb-1">{t('register.lastName')} <span className="text-red-500">*</span></label>
              <input type="text" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} required className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none" placeholder="Dupont" />
            </div>
          </div>

          {/* Email / Téléphone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-mid mb-1">{t('register.proEmail')} <span className="text-red-500">*</span></label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none" placeholder="pro@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-mid mb-1">{t('register.phone')}</label>
              <input type="tel" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none" placeholder={t('register.phonePlaceholder')} />
            </div>
          </div>

          {/* SIRET */}
          <div>
            <label className="block text-sm font-semibold text-mid mb-2">{t('register.taxIdLabel')} <span className="text-red-500">*</span></label>
            <p className="text-xs text-text-muted mb-2">{t('register.taxIdHelp')} <a href="https://annuaire-entreprises.data.gouv.fr" target="_blank" rel="noopener noreferrer" className="underline text-blue-500 font-semibold">{t('register.taxIdSite')}</a></p>
            <div className="flex gap-3">
              <input type="text" value={siretInput} onChange={e => { setSiretInput(formatSiret(e.target.value)); setSiretStatus('idle'); setSiretError(''); setVerifiedCompany(null); setSelectedCategories([]) }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); verifySiret() } }} maxLength={17}
                className={`flex-1 px-4 py-3 border-[1.5px] rounded-xl text-lg font-mono tracking-wider focus:outline-none transition ${siretStatus === 'verified' ? 'border-green-400 bg-green-50' : siretStatus === 'error' ? 'border-red-400 bg-red-50' : 'border-[#E0E0E0] bg-warm-gray focus:border-yellow focus:bg-white'}`} placeholder={t('register.taxIdPlaceholder')} />
              <button type="button" onClick={verifySiret} disabled={siretInput.replace(/\s/g,'').length !== 14 || siretStatus === 'checking'}
                className="bg-yellow hover:bg-yellow-light text-dark px-5 py-3 rounded-xl font-semibold transition hover:-translate-y-px disabled:opacity-40 whitespace-nowrap">
                {siretStatus === 'checking' ? '⏳' : t('register.verify')}
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
              <label className="block text-sm font-medium text-mid mb-1">{t('register.companyName')} <span className="text-red-500">*</span></label>
              <input type="text" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none" placeholder="Ma Société" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-mid mb-1">{t('register.activityDesc')}</label>
            <textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} rows={2} className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none resize-none" placeholder={t('register.activityPlaceholder')} />
          </div>

          <div>
            <label className="block text-sm font-medium text-mid mb-2">{t('register.yourTrades')} <span className="text-red-500">*</span></label>
            {siretStatus === 'verified' && verifiedCompany && (
              <p className="text-xs text-text-muted mb-2">{t('register.tradesCompatible')}{verifiedCompany.nafLabel ? ` (${verifiedCompany.nafLabel})` : ''}</p>
            )}
            {(() => {
              const allowed = siretStatus === 'verified' && verifiedCompany ? getAllowedMetiers(verifiedCompany.nafCode) : null
              const visibleMetiers = allowed ? METIERS.filter(m => allowed.includes(m.slug)) : METIERS
              return (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {visibleMetiers.map(m => (
                    <button key={m.slug} type="button" onClick={() => setSelectedCategories(prev => prev.includes(m.slug) ? prev.filter(c => c !== m.slug) : [...prev, m.slug])}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition ${selectedCategories.includes(m.slug) ? 'bg-yellow text-dark' : 'bg-warm-gray text-mid hover:bg-amber-50'}`}>
                      {m.icon} {m.name}
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>

          {/* Documents obligatoires */}
          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-lg">
            <p className="text-sm text-blue-800"><strong>📋 {t('register.docsRequired')}</strong> {t('register.docsRequiredDesc')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-mid mb-1">{t('register.kbisLabel')} <span className="text-red-500">*</span></label>
            <p className="text-xs text-text-muted mb-2">{t('register.kbisHelp')}</p>
            {!kbisFile ? (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-red-300 rounded-xl cursor-pointer hover:border-yellow transition bg-red-50/30">
                <span className="text-2xl">🏢</span><span className="text-sm text-text-muted mt-1">{t('register.addKbis')}</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setKbisFile(f); if (f.type.startsWith('image/')) { const r = new FileReader(); r.onload = ev => setKbisPreview(ev.target?.result as string); r.readAsDataURL(f) } } }} />
              </label>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                {kbisPreview ? <Image src={kbisPreview} alt="" width={40} height={40} className="w-10 h-10 object-cover rounded" unoptimized /> : <span className="text-2xl">📄</span>}
                <span className="flex-1 text-sm font-semibold text-green-800 truncate">{kbisFile.name}</span>
                <button type="button" onClick={() => { setKbisFile(null); setKbisPreview('') }} className="text-text-muted hover:text-red-500">✕</button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-mid mb-1">{t('register.idLabel')} <span className="text-red-500">*</span></label>
            <p className="text-xs text-text-muted mb-2">{t('register.idHelp')}</p>
            {!idFile ? (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-red-300 rounded-xl cursor-pointer hover:border-yellow transition bg-red-50/30">
                <span className="text-2xl">🪪</span><span className="text-sm text-text-muted mt-1">{t('register.addId')}</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setIdFile(f); if (f.type.startsWith('image/')) { const r = new FileReader(); r.onload = ev => setIdPreview(ev.target?.result as string); r.readAsDataURL(f) }; verifyIdDocument(f) } }} />
              </label>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                {idPreview ? <Image src={idPreview} alt="" width={40} height={40} className="w-10 h-10 object-cover rounded" unoptimized /> : <span className="text-2xl">📄</span>}
                <span className="flex-1 text-sm font-semibold text-green-800 truncate">{idFile.name}</span>
                <button type="button" onClick={() => { setIdFile(null); setIdPreview(''); setIdVerifyStatus('idle'); setIdVerifyDetails([]) }} className="text-text-muted hover:text-red-500">✕</button>
              </div>
            )}
            {/* Résultat vérification OCR */}
            {idVerifyStatus === 'checking' && (
              <div className="mt-2 flex items-center gap-2 text-sm text-text-muted">
                <span className="animate-spin">⏳</span> {t('register.ocrScanning')}
              </div>
            )}
            {idVerifyStatus === 'verified' && (
              <div className="mt-2 bg-green-50 border border-green-200 rounded-xl p-2.5">
                <p className="text-sm font-semibold text-green-700">✅ {t('register.idVerified')} ({idVerifyScore}%)</p>
                <p className="text-xs text-green-600 mt-0.5">{idVerifyDetails.join(' · ')}</p>
              </div>
            )}
            {idVerifyStatus === 'warning' && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                <p className="text-sm font-semibold text-amber-700">⚠️ {t('register.partialVerif')} ({idVerifyScore}%)</p>
                <p className="text-xs text-amber-600 mt-0.5">{idVerifyDetails.join(' · ')}</p>
                <p className="text-xs text-text-muted mt-1">{t('register.manualReview')}</p>
              </div>
            )}
            {idVerifyStatus === 'failed' && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-xl p-2.5">
                <p className="text-sm font-semibold text-red-700">❌ {t('register.nameNotFound')}</p>
                <p className="text-xs text-red-600 mt-0.5">{idVerifyDetails.join(' · ')}</p>
                <p className="text-xs text-text-muted mt-1">{t('register.checkName')}</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-mid mb-1">{t('register.rcProLabel')} <span className="text-xs text-text-muted font-normal">({t('register.rcProRecommended')})</span></label>
            {!insuranceFile ? (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-[#D0D0D0] rounded-xl cursor-pointer hover:border-yellow transition">
                <span className="text-2xl">📄</span><span className="text-sm text-text-muted mt-1">{t('register.addRcPro')}</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setInsuranceFile(f); if (f.type.startsWith('image/')) { const r = new FileReader(); r.onload = ev => setInsurancePreview(ev.target?.result as string); r.readAsDataURL(f) } } }} />
              </label>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                {insurancePreview ? <Image src={insurancePreview} alt="" width={40} height={40} className="w-10 h-10 object-cover rounded" unoptimized /> : <span className="text-2xl">📄</span>}
                <span className="flex-1 text-sm font-semibold text-green-800 truncate">{insuranceFile.name}</span>
                <button type="button" onClick={() => { setInsuranceFile(null); setInsurancePreview('') }} className="text-text-muted hover:text-red-500">✕</button>
              </div>
            )}
          </div>

          {/* Mot de passe */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-mid mb-1">{t('register.password')} <span className="text-red-500">*</span></label>
              <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required minLength={6} className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none" placeholder={t('register.passwordMin')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-mid mb-1">{t('register.confirmPwd')} <span className="text-red-500">*</span></label>
              <input type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} required className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none" placeholder={t('register.repeatPwd')} />
            </div>
          </div>

          <button type="submit" className="w-full bg-yellow hover:bg-yellow-light text-dark py-3 rounded-xl font-semibold transition hover:-translate-y-px">
            {t('register.continueOffer')}
          </button>
        </form>
      )}

      {/* Step 2 — Choix de l'offre + Création */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-800 text-sm">✅ {formData.prenom} {formData.nom} — {verifiedCompany?.name || formData.companyName}</p>
              <p className="text-xs text-green-600">{t('register.taxIdVerified')} · {selectedCategories.length} {t('register.tradesCount')} · {t('register.docsProvided')}</p>
            </div>
            <button type="button" onClick={() => setStep(1)} className="text-xs text-text-muted hover:underline">{t('register.modify')}</button>
          </div>

          <div className="text-center">
            <h3 className="text-lg font-bold text-dark mb-1">{t('register.chooseOffer')}</h3>
            <p className="text-sm text-text-muted">{t('register.chooseOfferDesc')}</p>
          </div>

          {/* Comparison table */}
          <div className="bg-white rounded-xl border border-[#EFEFEF] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase">{t('register.module')}</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-mid w-20">{t('register.freemium')}<br/><span className="text-dark font-bold">0€</span></th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-yellow w-20">{t('register.pro')}<br/><span className="font-bold">49€<span className="font-normal text-text-muted">{t('register.perMonth')}</span></span></th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: t('register.featProfile'), free: true, pro: true },
                  { label: t('register.featQuotesPdf'), free: true, pro: true },
                  { label: t('register.featCalendar'), free: false, pro: true },
                  { label: t('register.featBookings'), free: false, pro: true },
                  { label: t('register.featMessaging'), free: false, pro: true },
                  { label: t('register.featSearch'), free: false, pro: true },
                  { label: t('register.featAiAccounting'), free: false, pro: true },
                  { label: t('register.featPow'), free: false, pro: true },
                  { label: t('register.featPush'), free: false, pro: true },
                  { label: t('register.featMobile'), free: false, pro: true },
                  { label: t('register.featSupport'), free: false, pro: true },
                ].map((f, i) => (
                  <tr key={f.label} className={i % 2 === 0 ? 'bg-warm-gray/50' : ''}>
                    <td className="px-4 py-2.5 text-mid">{f.label}</td>
                    <td className="text-center px-3 py-2.5">{f.free ? <span className="text-green-500 font-bold">✓</span> : <span className="text-red-400 font-bold">✗</span>}</td>
                    <td className="text-center px-3 py-2.5"><span className="text-green-500 font-bold">✓</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-200">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={async () => { setFormData(prev => ({ ...prev, plan: 'freemium' })); await handleRegister({ preventDefault: () => {} } as React.FormEvent) }}
              className="py-3 rounded-xl border-2 border-[#EFEFEF] text-mid font-semibold text-sm hover:bg-warm-gray transition disabled:opacity-60"
            >
              {loading && formData.plan === 'freemium' ? `⏳ ${t('register.creating')}` : t('register.chooseFreemium')}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={async () => { setFormData(prev => ({ ...prev, plan: 'pro' })); await handleRegister({ preventDefault: () => {} } as React.FormEvent) }}
              className="py-3 rounded-xl bg-yellow hover:bg-yellow-light text-dark font-semibold text-sm transition hover:-translate-y-px disabled:opacity-60"
            >
              {loading && formData.plan === 'pro' ? `⏳ ${t('register.creating')}` : t('register.chooseProPlan')}
            </button>
          </div>

          <p className="text-xs text-text-muted text-center">{t('register.paymentNotRequired')}</p>

          <button type="button" onClick={() => setStep(1)} className="w-full border-2 border-[#EFEFEF] text-text-muted py-2.5 rounded-xl font-semibold hover:bg-warm-gray transition text-sm">{t('register.back')}</button>
        </div>
      )}
    </div>
  )
}

// ─── Formulaire générique Pro (Société / Conciergerie / Gestionnaire) ─────────

function FormulaireProGenerique({ orgType }: { orgType: OrgType }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const registrationCountry = locale === 'pt' ? 'PT' as const : 'FR' as const
  const ORG_TYPES = getOrgTypes(t)
  const org = ORG_TYPES.find(o => o.id === orgType)!
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', telephone: '', password: '', confirmPassword: '', companyName: '', nbEmployes: '', secteurs: [] as string[], ville: '', codePostal: '' })
  const [siretInput, setSiretInput] = useState('')
  const [siretStatus, setSiretStatus] = useState<SiretStatus>('idle')
  const [siretError, setSiretError] = useState('')
  const [company, setCompany] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [kbisFile, setKbisFile] = useState<File | null>(null)
  const [kbisPreview, setKbisPreview] = useState('')
  const [idFile, setIdFile] = useState<File | null>(null)
  const [idPreview, setIdPreview] = useState('')
  const [legalStructure, setLegalStructure] = useState('')

  const verifySiret = async () => {
    const clean = siretInput.replace(/\s/g, '')
    if (clean.length !== 14) { setSiretError(t('register.taxId14digits')); setSiretStatus('error'); return }
    setSiretStatus('checking'); setSiretError('')
    try {
      const res = await fetch(`/api/verify-siret?siret=${clean}`)
      const data = await res.json()
      if (data.verified) {
        setSiretStatus('verified'); setCompany(data.company); setForm(f => ({ ...f, companyName: data.company.name }))
        // Auto-map legal form from API to companyTypes key
        if (data.company.legalForm) {
          const mapped = mapLegalFormToKey(data.company.legalForm, registrationCountry)
          if (mapped) setLegalStructure(mapped)
        }
      }
      else { setSiretStatus('error'); setSiretError(data.error || t('register.taxIdInvalid')) }
    } catch { setSiretStatus('error'); setSiretError(t('register.connectionError')) }
  }

  const uploadDoc = async (file: File, folder: string, token: string): Promise<string> => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('bucket', 'artisan-documents')
    fd.append('folder', folder)
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Échec de l\'upload')
    return data.url
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) { setError(t('register.passwordMismatch')); return }
    if (form.password.length < 8 || !/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/[0-9]/.test(form.password)) { setError(t('register.passwordMin8')); return }
    setLoading(true); setError('')
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
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
            company_city: company?.city || form.ville,
            company_postal_code: company?.postalCode || form.codePostal,
            naf_code: company?.nafCode || '',
            naf_label: company?.nafLabel || '',
            legal_form: company?.legalForm || '',
            legal_structure: legalStructure,
            siret: siretInput.replace(/\s/g, ''),
            siret_verified: true,
            nb_employes: form.nbEmployes,
            secteur: form.secteurs.join(', '),
            secteurs: form.secteurs,
            ville: form.ville,
            abonnement: 'trial',
            kyc_status: 'pending',
          }
        }
      })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }

      // Detect "email already exists" silent failure: Supabase returns user with empty identities array
      if (authData.user && authData.user.identities?.length === 0) {
        // Redirect to login page — the email is already registered
        window.location.href = `/pro/espace-pro?email_exists=1`
        return
      }

      // Upload documents using the session token from signUp
      if (authData.session?.access_token) {
        try {
          const [kbisUrl, idUrl] = await Promise.all([
            kbisFile ? uploadDoc(kbisFile, 'kbis', authData.session.access_token) : Promise.resolve(''),
            idFile ? uploadDoc(idFile, 'identity', authData.session.access_token) : Promise.resolve(''),
          ])
          if (kbisUrl || idUrl) {
            await supabase.auth.updateUser({
              data: { kbis_url: kbisUrl || undefined, id_document_url: idUrl || undefined },
            })
          }
        } catch (uploadErr: any) {
          // Non-blocking: account created, docs failed
          setError(`Compte créé mais erreur upload documents: ${uploadErr.message}`)
        }
      }

      // ── Créer profil artisan BTP pour le KYC ──
      if (authData.user && authData.session) {
        try {
          const localeCookie = document.cookie.match(/(?:^|;\s*)locale=(\w+)/)?.[1]
          const btpCountry = localeCookie === 'pt' ? 'PT' : 'FR'
          const btpMarket = orgType === 'societe_btp' ? 'fr_btp' : 'fr_artisan'
          const { data: btpProfile } = await supabase.from('profiles_artisan').insert({
            user_id: authData.user.id,
            email: form.email,
            first_name: form.prenom,
            last_name: form.nom,
            phone: form.telephone,
            company_name: company?.name || form.companyName || '',
            siret: siretInput.replace(/\s/g, ''),
            country: btpCountry,
            kyc_status: 'pending',
            kyc_market: btpMarket,
            verified: false,
          }).select('id').single()

          if (btpProfile?.id) {
            // Mettre à jour les URLs de documents si uploadées
            const updates: Record<string, string> = {}
            const { data: { user: currentUser } } = await supabase.auth.getUser()
            if (currentUser?.user_metadata?.kbis_url) updates.kbis_url = currentUser.user_metadata.kbis_url
            if (currentUser?.user_metadata?.id_document_url) updates.id_document_url = currentUser.user_metadata.id_document_url
            if (Object.keys(updates).length > 0) {
              await supabase.from('profiles_artisan').update(updates).eq('id', btpProfile.id)
            }

            // ── KYC anti-fraude en background ──
            fetch('/api/kyc-orchestrate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authData.session.access_token}` },
              body: JSON.stringify({ artisan_id: btpProfile.id }),
            }).catch(() => { /* KYC non-bloquant */ })
          }
        } catch { /* Création profil BTP non-bloquante */ }
      }

      // ── Spécialités granulaires BTP (non-bloquant, uniquement pour societe_btp) ──
      if (orgType === 'societe_btp') {
        try {
          await fetch('/api/profile/specialties', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: authData.user!.id,
              slugs: secteursToSlugs(form.secteurs),
              verified_source: kbisFile ? 'kbis' : 'self_declared',
            }),
          })
        } catch { /* non-bloquant */ }
      }

      setSuccess(true)
    } catch { setError(t('register.genericError')) }
    finally { setLoading(false) }
  }

  if (success) return (
    <div className="text-center py-8">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-display font-black tracking-[-0.03em] mb-2">{t('register.accountCreated')}</h2>
      <p className="text-text-muted mb-2">{t('register.checkEmailConfirm')}</p>
      <p className={`font-semibold mb-6 ${org.color === 'blue' ? 'text-blue-600' : org.color === 'purple' ? 'text-purple-600' : 'text-green-600'}`}>{t('register.trialIncluded')} ✅</p>
      <LocaleLink href="/pro/espace-pro" className={`inline-block text-white px-8 py-3 rounded-xl font-bold transition ${org.color === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : org.color === 'purple' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'}`}>{t('register.login')}</LocaleLink>
    </div>
  )

  const accent = org.color === 'blue' ? 'border-blue-400 bg-blue-50 text-blue-600' : org.color === 'purple' ? 'border-purple-400 bg-purple-50 text-purple-600' : 'border-green-400 bg-green-50 text-green-600'
  const btnClass = org.color === 'blue' ? 'bg-blue-600 hover:bg-blue-700 text-white hover:-translate-y-px' : org.color === 'purple' ? 'bg-purple-600 hover:bg-purple-700 text-white hover:-translate-y-px' : 'bg-green-600 hover:bg-green-700 text-white hover:-translate-y-px'

  const secteurs = orgType === 'societe_btp'
    ? [t('register.sectorBtpGrosOeuvre'), t('register.sectorBtpElecPlomb'), t('register.sectorBtpPeinture'), t('register.sectorBtpMenuiserie'), t('register.sectorBtpCvc'), t('register.sectorBtpToiture'), t('register.sectorBtpMetallerie'), t('register.sectorBtpGeneral'), t('register.sectorBtpBureau'), t('register.sectorBtpAutre')]
    : orgType === 'conciergerie'
    ? [t('register.sectorConcAirbnb'), t('register.sectorConcResidentiel'), t('register.sectorConcLocative'), t('register.sectorConcLuxe'), t('register.sectorConcEntreprises')]
    : [t('register.sectorGestResidentiel'), t('register.sectorGestCopro'), t('register.sectorGestFonciere'), t('register.sectorGestCommerciale'), t('register.sectorGestPromoteur')]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-3xl ${org.color === 'blue' ? 'bg-blue-100' : org.color === 'purple' ? 'bg-purple-100' : 'bg-green-100'}`}>{org.emoji}</div>
        <div>
          <h2 className="font-bold text-dark">{org.label}</h2>
          <p className="text-xs text-text-muted">{org.desc}</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {[{n:1,label:t('register.proStepCompany')},{n:2,label:t('register.proStepContact')},{n:3,label:t('register.proStepSecurity')}].map((s,i) => (
          <div key={s.n} className="flex items-center gap-2">
            {i > 0 && <div className={`w-8 h-0.5 ${step > s.n ? (org.color === 'blue' ? 'bg-blue-500' : org.color === 'purple' ? 'bg-purple-500' : 'bg-green-500') : 'bg-[#E0E0E0]'}`} />}
            <div className="flex items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= s.n ? (org.color === 'blue' ? 'bg-blue-600 text-white' : org.color === 'purple' ? 'bg-purple-600 text-white' : 'bg-green-600 text-white') : 'bg-[#E0E0E0] text-text-muted'}`}>{s.n}</div>
              <span className={`text-xs hidden sm:block ${step >= s.n ? 'text-dark font-medium' : 'text-text-muted'}`}>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-200">{error}</div>}

      {/* Étape 1 — Société */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-mid mb-1">SIRET <span className="text-red-500">*</span></label>
            <p className="text-xs text-text-muted mb-2">Vérifie l'existence légale de votre société auprès du registre officiel des entreprises (INSEE/SIRENE)</p>
            <div className="flex gap-2">
              <input type="text" value={siretInput} onChange={e => { setSiretInput(e.target.value); setSiretStatus('idle') }} maxLength={17}
                className={`flex-1 px-4 py-3 border-[1.5px] rounded-xl font-mono text-sm focus:outline-none ${siretStatus === 'verified' ? 'border-green-400 bg-green-50' : siretStatus === 'error' ? 'border-red-400' : 'border-[#E0E0E0] bg-warm-gray focus:border-purple-400 focus:bg-white'}`} placeholder={t('register.taxIdPlaceholder')} />
              <button type="button" onClick={verifySiret} disabled={siretStatus === 'checking'} className={`px-4 py-3 rounded-xl font-semibold transition text-sm ${btnClass}`}>
                {siretStatus === 'checking' ? '⏳' : t('register.verify')}
              </button>
            </div>
            {siretStatus === 'error' && <p className="text-red-600 text-xs mt-1">❌ {siretError}</p>}
            {siretStatus === 'verified' && company && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm">
                <p className="font-semibold text-green-800">✅ {company.name}</p>
                <p className="text-xs text-green-600">{company.address}</p>
                {company.nafLabel && <p className="text-xs text-green-600 mt-0.5">Activité : {company.nafLabel} ({company.nafCode})</p>}
                {company.legalForm && <p className="text-xs text-green-600">Forme : {company.legalForm}</p>}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-mid mb-1">Structure juridique <span className="text-red-500">*</span></label>
            <p className="text-xs text-text-muted mb-2">{registrationCountry === 'PT' ? 'As contribuições variam conforme a forma jurídica' : 'Les charges et cotisations varient selon votre forme juridique'}</p>
            <select value={legalStructure} onChange={e => setLegalStructure(e.target.value)}
              className={`w-full px-4 py-3 border-[1.5px] rounded-xl focus:outline-none bg-white ${legalStructure ? 'border-green-400 bg-green-50' : 'border-[#E0E0E0] bg-warm-gray focus:border-yellow focus:bg-white'}`}>
              <option value="">{registrationCountry === 'PT' ? '— Selecione a forma jurídica —' : '— Sélectionnez la forme juridique —'}</option>
              {getLegalStructureOptions(registrationCountry).map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
            {legalStructure && siretStatus === 'verified' && company?.legalForm && (
              <p className="text-xs text-green-600 mt-1">✓ Pré-rempli depuis le SIRET ({company.legalForm})</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-mid mb-1">{t('register.sectorLabel')} <span className="text-red-500">*</span></label>
            <p className="text-xs text-text-muted mb-2">Plusieurs choix possibles</p>
            <div className="grid grid-cols-1 gap-2">
              {secteurs.map(s => {
                const selected = form.secteurs.includes(s)
                return (
                  <button key={s} type="button" onClick={() => setForm(f => ({
                    ...f,
                    secteurs: selected ? f.secteurs.filter(x => x !== s) : [...f.secteurs, s]
                  }))}
                    className={`text-left px-4 py-2.5 rounded-xl border-2 text-sm transition ${selected ? `${accent} border-2 font-semibold` : 'border-[#EFEFEF] hover:border-[#D0D0D0] text-mid'}`}>
                    {selected ? '✓ ' : ''}{s}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-mid mb-1">{t('register.employeesLabel')}</label>
            <select value={form.nbEmployes} onChange={e => setForm(f => ({...f, nbEmployes: e.target.value}))} className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none bg-white">
              <option value="">{t('register.selectPlaceholder')}</option>
              <option value="2-5">{t('register.employees2to5')}</option>
              <option value="6-20">{t('register.employees6to20')}</option>
              <option value="21-50">{t('register.employees21to50')}</option>
              <option value="51-200">{t('register.employees51to200')}</option>
              <option value="200+">{t('register.employees200plus')}</option>
            </select>
          </div>

          <button type="button" onClick={() => {
            if (siretStatus !== 'verified') { setError('Veuillez vérifier votre SIRET avant de continuer — nous devons confirmer l\'existence légale de votre société'); return }
            if (!legalStructure) { setError('Veuillez sélectionner la structure juridique de votre société'); return }
            if (form.secteurs.length === 0) { setError(t('register.sectorRequired')); return }
            setError(''); setStep(2)
          }} className={`w-full py-3 rounded-xl font-bold transition ${btnClass}`}>{t('register.continue')}</button>
        </div>
      )}

      {/* Étape 2 — Contact */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-mid mb-1">{t('register.firstName')} <span className="text-red-500">*</span></label>
              <input type="text" value={form.prenom} onChange={e => setForm(f => ({...f, prenom: e.target.value}))} className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none" placeholder="Jean" />
            </div>
            <div>
              <label className="block text-sm font-medium text-mid mb-1">{t('register.lastName')} <span className="text-red-500">*</span></label>
              <input type="text" value={form.nom} onChange={e => setForm(f => ({...f, nom: e.target.value}))} className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none" placeholder="Dupont" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-mid mb-1">{t('register.proEmail')} <span className="text-red-500">*</span></label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none" placeholder="jean@masociete.fr" />
          </div>
          <div>
            <label className="block text-sm font-medium text-mid mb-1">{t('register.phone')}</label>
            <input type="tel" value={form.telephone} onChange={e => setForm(f => ({...f, telephone: e.target.value}))} className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none" placeholder={t('register.phonePlaceholder')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-mid mb-1">{t('register.ville')}</label>
              <input type="text" value={form.ville} onChange={e => setForm(f => ({...f, ville: e.target.value}))} className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none" placeholder="Paris" />
            </div>
            <div>
              <label className="block text-sm font-medium text-mid mb-1">{t('register.codePostal')}</label>
              <input type="text" value={form.codePostal} onChange={e => setForm(f => ({...f, codePostal: e.target.value}))} className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none" placeholder="75001" />
            </div>
          </div>
          {/* Documents obligatoires */}
          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-lg">
            <p className="text-sm text-blue-800"><strong>📋 Documents requis</strong> — Pour valider votre compte et lutter contre la fraude.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-mid mb-1">KBIS ou extrait d'immatriculation <span className="text-red-500">*</span></label>
            <p className="text-xs text-text-muted mb-2">Document officiel d'immatriculation de votre société (PDF ou image)</p>
            {!kbisFile ? (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-red-300 rounded-xl cursor-pointer hover:border-blue-400 transition bg-red-50/30">
                <span className="text-2xl">🏢</span>
                <span className="text-sm text-text-muted mt-1">Ajouter le KBIS</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setKbisFile(f)
                    if (f.type.startsWith('image/')) { const r = new FileReader(); r.onload = ev => setKbisPreview(ev.target?.result as string); r.readAsDataURL(f) }
                  }
                }} />
              </label>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                {kbisPreview ? <img src={kbisPreview} alt="" className="w-10 h-10 object-cover rounded" /> : <span className="text-2xl">📄</span>}
                <span className="flex-1 text-sm font-semibold text-green-800 truncate">{kbisFile.name}</span>
                <button type="button" onClick={() => { setKbisFile(null); setKbisPreview('') }} className="text-text-muted hover:text-red-500">✕</button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-mid mb-1">Carte d'identité du dirigeant <span className="text-red-500">*</span></label>
            <p className="text-xs text-text-muted mb-2">Pièce d'identité valide du représentant légal (PDF ou image)</p>
            {!idFile ? (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-red-300 rounded-xl cursor-pointer hover:border-blue-400 transition bg-red-50/30">
                <span className="text-2xl">🪪</span>
                <span className="text-sm text-text-muted mt-1">Ajouter la pièce d'identité</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setIdFile(f)
                    if (f.type.startsWith('image/')) { const r = new FileReader(); r.onload = ev => setIdPreview(ev.target?.result as string); r.readAsDataURL(f) }
                  }
                }} />
              </label>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                {idPreview ? <img src={idPreview} alt="" className="w-10 h-10 object-cover rounded" /> : <span className="text-2xl">📄</span>}
                <span className="flex-1 text-sm font-semibold text-green-800 truncate">{idFile.name}</span>
                <button type="button" onClick={() => { setIdFile(null); setIdPreview('') }} className="text-text-muted hover:text-red-500">✕</button>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setStep(1)} className="flex-1 border-2 border-[#EFEFEF] text-text-muted py-3 rounded-xl font-semibold hover:bg-warm-gray transition">{t('register.back')}</button>
            <button type="button" onClick={() => {
              if (!form.prenom || !form.nom || !form.email) { setError(t('register.fillRequired')); return }
              if (!kbisFile) { setError('Le KBIS est requis pour valider votre inscription'); return }
              if (!idFile) { setError("La carte d'identité du dirigeant est requise"); return }
              setError(''); setStep(3)
            }} className={`flex-1 py-3 rounded-xl font-bold transition ${btnClass}`}>{t('register.continue')}</button>
          </div>
        </div>
      )}

      {/* Étape 3 — Sécurité */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-mid mb-1">{t('register.password')} <span className="text-red-500">*</span></label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required minLength={8} className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none" placeholder={t('register.passwordPlaceholder')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-mid mb-1">{t('register.confirmPasswordLabel')}</label>
            <input type="password" value={form.confirmPassword} onChange={e => setForm(f => ({...f, confirmPassword: e.target.value}))} required className="w-full px-4 py-3 border-[1.5px] border-[#E0E0E0] rounded-xl bg-warm-gray focus:border-yellow focus:bg-white focus:outline-none" placeholder={t('register.repeatPassword')} />
          </div>

          {/* Récap */}
          <div className={`rounded-xl p-4 text-sm space-y-1.5 border ${org.color === 'blue' ? 'bg-blue-50 border-blue-100' : org.color === 'purple' ? 'bg-purple-50 border-purple-100' : 'bg-green-50 border-green-100'}`}>
            <p className={`font-semibold mb-2 ${org.color === 'blue' ? 'text-blue-800' : org.color === 'purple' ? 'text-purple-800' : 'text-green-800'}`}>{org.emoji} {t('register.recap')}</p>
            <p className="text-text-muted">🏢 {company?.name || form.companyName}</p>
            <p className="text-text-muted">👤 {form.prenom} {form.nom} — {form.email}</p>
            <p className="text-text-muted">📌 {form.secteurs.join(' · ')}</p>
            <p className="text-text-muted">⚖️ {getLegalStructureOptions(registrationCountry).find(o => o.key === legalStructure)?.label || legalStructure}</p>
            <p className="text-text-muted">📄 KBIS {kbisFile ? '✅' : '—'} · Pièce d'identité {idFile ? '✅' : '—'}</p>
            <p className={`font-semibold mt-2 ${org.color === 'blue' ? 'text-blue-700' : org.color === 'purple' ? 'text-purple-700' : 'text-green-700'}`}>✅ {t('register.trialDays')}</p>
          </div>

          <p className="text-xs text-text-muted">{t('register.cguAccept')} <LocaleLink href="/cgu" className="text-purple-600 hover:underline">{t('register.cgu')}</LocaleLink> {t('register.and')} <LocaleLink href="/confidentialite" className="text-purple-600 hover:underline">{t('register.privacyPolicy')}</LocaleLink>.</p>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(2)} className="flex-1 border-2 border-[#EFEFEF] text-text-muted py-3 rounded-xl font-semibold hover:bg-warm-gray transition">{t('register.back')}</button>
            <button type="submit" disabled={loading} className={`flex-1 py-3 rounded-xl font-bold transition disabled:opacity-60 ${btnClass}`}>
              {loading ? `⏳ ${t('register.creating')}` : t('register.createAccount')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ProRegisterPage() {
  const { t } = useTranslation()
  const ORG_TYPES = getOrgTypes(t)
  const [orgType, setOrgType] = useState<OrgType>(null)

  return (
    <div className="min-h-screen bg-warm-gray py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <LocaleLink href="/" className="inline-flex items-center gap-1.5 mb-4">
            <span className="text-2xl font-display font-black tracking-[-0.03em] uppercase text-dark"><span className="text-yellow">VIT</span>FIX</span>
          </LocaleLink>
          <h1 className="text-3xl font-display font-black tracking-[-0.03em] text-dark">{t('register.pageTitle')}</h1>
          <p className="text-text-muted mt-2 text-sm">{t('register.pageSubtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border-[1.5px] border-[#EFEFEF] p-8">
          {/* Breadcrumb si type choisi */}
          {orgType && (
            <div className="mb-6">
              <button onClick={() => setOrgType(null)} className="flex items-center gap-2 text-sm text-text-muted hover:text-mid transition">
                <span>←</span>
                <span>{t('register.changeOrgType')}</span>
              </button>
            </div>
          )}

          {/* Étape 0 — Choix du type */}
          {!orgType && <StepChoixOrganisation onChoose={setOrgType} />}

          {/* Artisan */}
          {orgType === 'artisan' && <FormulaireArtisan />}

          {/* Société BTP / Conciergerie / Gestionnaire / Syndic */}
          {orgType && orgType !== 'artisan' && <FormulaireProGenerique orgType={orgType} />}
        </div>

        <p className="text-center text-text-muted text-sm mt-6">
          {t('register.alreadyAccount')}{' '}
          <LocaleLink href="/pro/login" className="text-yellow hover:underline font-semibold">{t('register.login')}</LocaleLink>
        </p>
      </div>
    </div>
  )
}
