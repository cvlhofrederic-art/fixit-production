'use client'

import { useState, useEffect, type FormEvent } from 'react'
import Link from 'next/link'
import {
  FileText,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Euro,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Building2,
  ClipboardList,
  Zap,
  Shield,
  Target,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  LayoutGrid,
} from 'lucide-react'
import { MARCHE_TEMPLATES, type MarcheTemplate } from '@/lib/data/marches-templates'

const CATEGORIES = [
  { value: 'canalizacao', fr: 'Plomberie', pt: 'Canalização' },
  { value: 'eletricidade', fr: 'Électricité', pt: 'Eletricidade' },
  { value: 'pintura', fr: 'Peinture', pt: 'Pintura' },
  { value: 'serralharia', fr: 'Serrurerie', pt: 'Serralharia' },
  { value: 'elevadores', fr: 'Ascenseurs', pt: 'Elevadores' },
  { value: 'limpeza', fr: 'Nettoyage', pt: 'Limpeza' },
  { value: 'jardinagem', fr: 'Jardinage', pt: 'Jardinagem' },
  { value: 'impermeabilizacao', fr: 'Imperméabilisation', pt: 'Impermeabilização' },
  { value: 'construcao', fr: 'Construction', pt: 'Construção' },
  { value: 'climatizacao', fr: 'Climatisation', pt: 'Climatização' },
  { value: 'seguranca', fr: 'Sécurité', pt: 'Segurança' },
  { value: 'gas', fr: 'Gaz', pt: 'Gás' },
  { value: 'telhados', fr: 'Toiture', pt: 'Telhados' },
  { value: 'desentupimentos', fr: 'Débouchage', pt: 'Desentupimentos' },
  { value: 'carpintaria', fr: 'Menuiserie', pt: 'Carpintaria' },
  { value: 'vidracaria', fr: 'Vitrerie', pt: 'Vidraçaria' },
  { value: 'mudancas', fr: 'Déménagement', pt: 'Mudanças' },
  { value: 'renovacao', fr: 'Rénovation', pt: 'Renovação' },
  { value: 'isolamento', fr: 'Isolation', pt: 'Isolamento' },
  { value: 'outro', fr: 'Autre', pt: 'Outro' },
] as const

// ── Publisher type categories & profiles ──────────────────────────
type PublisherCategory = 'particulier' | 'pro_immobilier' | 'btp' | 'commerce' | 'assurance'

interface PublisherProfile {
  value: string
  fr: string
  pt: string
}

const PUBLISHER_CATEGORIES: { key: PublisherCategory; emoji: string; fr: string; pt: string; profiles: PublisherProfile[] }[] = [
  {
    key: 'particulier',
    emoji: '\u{1F3E0}',
    fr: 'Particulier',
    pt: 'Particular',
    profiles: [
      { value: 'particulier_proprietaire', fr: 'Propriétaire', pt: 'Proprietário' },
      { value: 'particulier_locataire', fr: 'Locataire', pt: 'Inquilino' },
      { value: 'particulier_investisseur', fr: 'Investisseur', pt: 'Investidor' },
    ],
  },
  {
    key: 'pro_immobilier',
    emoji: '\u{1F3E2}',
    fr: 'Pro Immobilier',
    pt: 'Profissional Imobiliário',
    profiles: [
      { value: 'syndic', fr: 'Syndic', pt: 'Administração de condomínio' },
      { value: 'gestionnaire_immobilier', fr: 'Gestionnaire immobilier', pt: 'Gestor imobiliário' },
      { value: 'conciergerie', fr: 'Conciergerie', pt: 'Concierge' },
      { value: 'agence_immobiliere', fr: 'Agence immobilière', pt: 'Agência imobiliária' },
      { value: 'promoteur_immobilier', fr: 'Promoteur immobilier', pt: 'Promotor imobiliário' },
    ],
  },
  {
    key: 'btp',
    emoji: '\u{1F3D7}\uFE0F',
    fr: 'BTP & Construction',
    pt: 'Construção',
    profiles: [
      { value: 'entreprise_btp', fr: 'Entreprise BTP', pt: 'Empresa BTP' },
      { value: 'maitre_oeuvre', fr: "Maître d'oeuvre", pt: 'Diretor de obra' },
      { value: 'bureau_etudes', fr: "Bureau d'études", pt: 'Gabinete de estudos' },
    ],
  },
  {
    key: 'commerce',
    emoji: '\u{1F3EA}',
    fr: 'Commerce & Tertiaire',
    pt: 'Comércio',
    profiles: [
      { value: 'commerce_restaurant', fr: 'Commerce / Restaurant', pt: 'Comércio / Restaurante' },
      { value: 'bureau_entreprise', fr: 'Bureau / Entreprise', pt: 'Escritório / Empresa' },
      { value: 'collectivite', fr: 'Collectivité', pt: 'Coletividade' },
      { value: 'hotel', fr: 'Hôtel', pt: 'Hotel' },
    ],
  },
  {
    key: 'assurance',
    emoji: '\u{1F6E1}\uFE0F',
    fr: 'Assurance & Sinistres',
    pt: 'Seguros',
    profiles: [
      { value: 'assurance', fr: "Compagnie d'assurance", pt: 'Companhia de seguros' },
      { value: 'expert_assure', fr: "Expert d'assuré", pt: 'Perito de segurado' },
    ],
  },
]

// Profiles that show company + SIRET fields (all non-particulier)
const PROFESSIONAL_TYPES = [
  'syndic', 'gestionnaire_immobilier', 'conciergerie', 'agence_immobiliere', 'promoteur_immobilier',
  'entreprise_btp', 'maitre_oeuvre', 'bureau_etudes',
  'commerce_restaurant', 'bureau_entreprise', 'collectivite', 'hotel',
  'assurance', 'expert_assure',
]

const URGENCY_OPTIONS = [
  { value: 'normal', fr: 'Normal', pt: 'Normal', icon: Calendar, color: 'text-green-600' },
  { value: 'urgent', fr: 'Urgent', pt: 'Urgente', icon: AlertTriangle, color: 'text-orange-500' },
  { value: 'emergency', fr: 'Urgence', pt: 'Emergência', icon: Zap, color: 'text-red-600' },
] as const

const WORK_MODE_OPTIONS = [
  { value: '', fr: 'Pas de préférence', pt: 'Sem preferência' },
  { value: 'forfait', fr: 'Forfait', pt: 'Forfait' },
  { value: 'journee', fr: 'À la journée', pt: 'Por dia' },
  { value: 'horaire', fr: "À l'heure", pt: 'Por hora' },
  { value: 'tache', fr: 'À la tâche', pt: 'Por tarefa' },
] as const

const LOT_TECHNIQUE_OPTIONS = [
  { value: '', fr: '-- Choisir --', pt: '-- Escolher --' },
  { value: 'gros_oeuvre', fr: 'Gros oeuvre', pt: 'Obra bruta' },
  { value: 'plomberie', fr: 'Plomberie', pt: 'Canalização' },
  { value: 'electricite', fr: 'Électricité', pt: 'Eletricidade' },
  { value: 'peinture', fr: 'Peinture', pt: 'Pintura' },
  { value: 'menuiserie', fr: 'Menuiserie', pt: 'Carpintaria' },
  { value: 'carrelage', fr: 'Carrelage', pt: 'Azulejos' },
  { value: 'toiture', fr: 'Toiture', pt: 'Telhados' },
  { value: 'isolation', fr: 'Isolation', pt: 'Isolamento' },
  { value: 'cvc', fr: 'CVC / Climatisation', pt: 'AVAC / Climatização' },
  { value: 'autre', fr: 'Autre', pt: 'Outro' },
]

const PHASE_CHANTIER_OPTIONS = [
  { value: '', fr: '-- Choisir --', pt: '-- Escolher --' },
  { value: 'conception', fr: 'Conception', pt: 'Conceção' },
  { value: 'gros_oeuvre', fr: 'Gros oeuvre', pt: 'Obra bruta' },
  { value: 'second_oeuvre', fr: 'Second oeuvre', pt: 'Acabamentos' },
  { value: 'finitions', fr: 'Finitions', pt: 'Acabamentos finais' },
  { value: 'livraison', fr: 'Livraison', pt: 'Entrega' },
]

const TYPE_SINISTRE_OPTIONS = [
  { value: '', fr: '-- Choisir --', pt: '-- Escolher --' },
  { value: 'degat_eaux', fr: 'Dégât des eaux', pt: 'Danos por água' },
  { value: 'incendie', fr: 'Incendie', pt: 'Incêndio' },
  { value: 'catastrophe_naturelle', fr: 'Catastrophe naturelle', pt: 'Catástrofe natural' },
  { value: 'bris_glace', fr: 'Bris de glace', pt: 'Quebra de vidro' },
  { value: 'vol', fr: 'Vol', pt: 'Roubo' },
  { value: 'autre', fr: 'Autre', pt: 'Outro' },
]

const TYPE_HEBERGEMENT_OPTIONS = [
  { value: '', fr: '-- Choisir --', pt: '-- Escolher --' },
  { value: 'appartement', fr: 'Appartement', pt: 'Apartamento' },
  { value: 'maison', fr: 'Maison', pt: 'Casa' },
  { value: 'villa', fr: 'Villa', pt: 'Vivenda' },
]

interface FormData {
  publisher_name: string
  publisher_email: string
  publisher_phone: string
  publisher_type: string
  title: string
  description: string
  category: string
  location_city: string
  location_postal: string
  budget_min: string
  budget_max: string
  deadline: string
  urgency: string
  max_candidatures: number
  require_rc_pro: boolean
  require_decennale: boolean
  require_rge: boolean
  require_qualibat: boolean
  preferred_work_mode: string
  // Dynamic fields
  publisher_company: string
  publisher_siret: string
  immeuble_nom: string
  immeuble_adresse: string
  partie_commune: boolean
  nb_lots: string
  type_hebergement: string
  nb_unites: string
  contrainte_calendrier: string
  lot_technique: string
  reference_chantier: string
  programme_immobilier: string
  phase_chantier: string
  nb_logements: string
  type_etablissement: string
  mise_aux_normes: boolean
  numero_sinistre: string
  type_sinistre: string
  expert_referent: string
}

const initialForm: FormData = {
  publisher_name: '',
  publisher_email: '',
  publisher_phone: '',
  publisher_type: '',
  title: '',
  description: '',
  category: '',
  location_city: '',
  location_postal: '',
  budget_min: '',
  budget_max: '',
  deadline: '',
  urgency: 'normal',
  max_candidatures: 3,
  require_rc_pro: false,
  require_decennale: false,
  require_rge: false,
  require_qualibat: false,
  preferred_work_mode: '',
  // Dynamic fields
  publisher_company: '',
  publisher_siret: '',
  immeuble_nom: '',
  immeuble_adresse: '',
  partie_commune: false,
  nb_lots: '',
  type_hebergement: '',
  nb_unites: '',
  contrainte_calendrier: '',
  lot_technique: '',
  reference_chantier: '',
  programme_immobilier: '',
  phase_chantier: '',
  nb_logements: '',
  type_etablissement: '',
  mise_aux_normes: false,
  numero_sinistre: '',
  type_sinistre: '',
  expert_referent: '',
}

export default function PublierMarcheClient({ isPt }: { isPt: boolean }) {
  const [form, setForm] = useState<FormData>(initialForm)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState<{ id: string; token: string } | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<PublisherCategory | null>(null)
  const [dynamicFieldsOpen, setDynamicFieldsOpen] = useState(true)

  // Templates state
  const [showTemplates, setShowTemplates] = useState(true)
  const [templateFilter, setTemplateFilter] = useState('')

  // Recurring market state
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceInterval, setRecurrenceInterval] = useState<'mensuel' | 'trimestriel' | 'annuel'>('mensuel')

  const t = (fr: string, pt: string) => (isPt ? pt : fr)

  // Clone from existing marche
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cloneId = params.get('clone')
    const cloneToken = params.get('token')
    if (cloneId && cloneToken) {
      setShowTemplates(false)
      fetch(`/api/marches/${cloneId}?token=${cloneToken}`)
        .then(res => res.json())
        .then(data => {
          if (data.marche) {
            const m = data.marche
            setForm(prev => ({
              ...prev,
              title: m.title || '',
              description: m.description || '',
              category: m.category || '',
              location_city: m.location_city || '',
              location_postal: m.location_postal || '',
              budget_min: m.budget_min?.toString() || '',
              budget_max: m.budget_max?.toString() || '',
              urgency: m.urgency || 'normal',
              require_rc_pro: m.require_rc_pro ?? false,
              require_decennale: m.require_decennale ?? false,
              require_rge: m.require_rge ?? false,
              require_qualibat: m.require_qualibat ?? false,
              preferred_work_mode: m.preferred_work_mode || '',
              publisher_name: m.publisher_name || '',
              publisher_email: m.publisher_email || '',
              publisher_phone: m.publisher_phone || '',
              publisher_type: m.publisher_type || '',
            }))
          }
        })
        .catch(() => { /* silent */ })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply template
  const applyTemplate = (tpl: MarcheTemplate) => {
    setForm(prev => ({
      ...prev,
      title: isPt ? tpl.title_pt : tpl.title_fr,
      description: isPt ? tpl.description_pt : tpl.description_fr,
      category: tpl.category,
      budget_min: tpl.estimated_budget_min?.toString() || '',
      budget_max: tpl.estimated_budget_max?.toString() || '',
      require_rc_pro: tpl.suggested_requirements.rc_pro ?? false,
      require_decennale: tpl.suggested_requirements.decennale ?? false,
      require_rge: tpl.suggested_requirements.rge ?? false,
      require_qualibat: tpl.suggested_requirements.qualibat ?? false,
    }))
    setShowTemplates(false)
  }

  const update = (field: keyof FormData, value: string | boolean | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const handleCategorySelect = (cat: PublisherCategory) => {
    setSelectedCategory(cat)
    // Auto-select the first profile if only one option, or clear selection
    const category = PUBLISHER_CATEGORIES.find(c => c.key === cat)
    if (category && category.profiles.length === 1) {
      update('publisher_type', category.profiles[0].value)
    } else {
      update('publisher_type', '')
    }
  }

  const handleProfileSelect = (profileValue: string) => {
    update('publisher_type', profileValue)
    setDynamicFieldsOpen(true)
  }

  const isProfessional = PROFESSIONAL_TYPES.includes(form.publisher_type)

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {}

    if (!form.publisher_name.trim() || form.publisher_name.trim().length < 2)
      e.publisher_name = t('Nom requis (min 2 caractères)', 'Nome obrigatório (min 2 caracteres)')
    if (!form.publisher_email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.publisher_email))
      e.publisher_email = t('Email invalide', 'Email inválido')
    if (!form.publisher_type)
      e.publisher_type = t('Veuillez sélectionner votre profil', 'Selecione o seu perfil')
    if (!form.title.trim() || form.title.trim().length < 5)
      e.title = t('Titre requis (min 5 caractères)', 'Título obrigatório (min 5 caracteres)')
    if (!form.description.trim() || form.description.trim().length < 20)
      e.description = t('Description trop courte (min 20 caractères)', 'Descrição muito curta (min 20 caracteres)')
    if (!form.category)
      e.category = t('Catégorie requise', 'Categoria obrigatória')
    if (!form.location_city.trim())
      e.location_city = t('Ville requise', 'Cidade obrigatória')
    if (!form.deadline)
      e.deadline = t('Date limite requise', 'Prazo obrigatório')
    else {
      const deadlineDate = new Date(form.deadline)
      if (deadlineDate <= new Date())
        e.deadline = t('La date limite doit être dans le futur', 'O prazo deve ser no futuro')
    }
    if (form.budget_min && form.budget_max && Number(form.budget_min) > Number(form.budget_max))
      e.budget_max = t('Le max doit être supérieur au min', 'O máximo deve ser superior ao mínimo')

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault()
    setApiError('')
    if (!validate()) return

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        publisher_name: form.publisher_name.trim(),
        publisher_email: form.publisher_email.trim(),
        publisher_type: form.publisher_type,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        location_city: form.location_city.trim(),
        deadline: form.deadline,
        urgency: form.urgency,
      }
      if (form.publisher_phone.trim()) payload.publisher_phone = form.publisher_phone.trim()
      if (form.location_postal.trim()) payload.location_postal = form.location_postal.trim()
      if (form.budget_min) payload.budget_min = Number(form.budget_min)
      if (form.budget_max) payload.budget_max = Number(form.budget_max)
      payload.max_candidatures = form.max_candidatures
      payload.require_rc_pro = form.require_rc_pro
      payload.require_decennale = form.require_decennale
      payload.require_rge = form.require_rge
      payload.require_qualibat = form.require_qualibat
      if (form.preferred_work_mode) payload.preferred_work_mode = form.preferred_work_mode
      if (isRecurring) {
        payload.is_recurring = true
        payload.recurrence_interval = recurrenceInterval
      }

      // Dynamic fields
      if (form.publisher_company.trim()) payload.publisher_company = form.publisher_company.trim()
      if (form.publisher_siret.trim()) payload.publisher_siret = form.publisher_siret.trim()
      if (form.immeuble_nom.trim()) payload.immeuble_nom = form.immeuble_nom.trim()
      if (form.immeuble_adresse.trim()) payload.immeuble_adresse = form.immeuble_adresse.trim()
      if (form.partie_commune) payload.partie_commune = form.partie_commune
      if (form.nb_lots) payload.nb_lots = Number(form.nb_lots)
      if (form.type_hebergement) payload.type_hebergement = form.type_hebergement
      if (form.nb_unites) payload.nb_unites = Number(form.nb_unites)
      if (form.contrainte_calendrier.trim()) payload.contrainte_calendrier = form.contrainte_calendrier.trim()
      if (form.lot_technique) payload.lot_technique = form.lot_technique
      if (form.reference_chantier.trim()) payload.reference_chantier = form.reference_chantier.trim()
      if (form.programme_immobilier.trim()) payload.programme_immobilier = form.programme_immobilier.trim()
      if (form.phase_chantier) payload.phase_chantier = form.phase_chantier
      if (form.nb_logements) payload.nb_logements = Number(form.nb_logements)
      if (form.type_etablissement.trim()) payload.type_etablissement = form.type_etablissement.trim()
      if (form.mise_aux_normes) payload.mise_aux_normes = form.mise_aux_normes
      if (form.numero_sinistre.trim()) payload.numero_sinistre = form.numero_sinistre.trim()
      if (form.type_sinistre) payload.type_sinistre = form.type_sinistre
      if (form.expert_referent.trim()) payload.expert_referent = form.expert_referent.trim()

      const res = await fetch('/api/marches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setApiError(data.error || t('Une erreur est survenue', 'Ocorreu um erro'))
        return
      }

      setSuccess({ id: data.marche.id, token: data.access_token })
    } catch {
      setApiError(t('Erreur de connexion', 'Erro de conexão'))
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = (field: keyof FormData) =>
    `w-full rounded-xl border ${errors[field] ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-200'} bg-white px-4 py-3 text-[0.95rem] text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100`

  const labelCls = 'flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5'

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDeadline = tomorrow.toISOString().split('T')[0]

  // ── Toggle helper for booleans ──
  const renderToggle = (field: keyof FormData, label: string) => (
    <label className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${
      form[field] ? 'border-[#FFC107] bg-yellow-50' : 'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      <button
        type="button"
        onClick={() => update(field, !form[field])}
        className={`relative w-11 h-6 rounded-full transition-all shrink-0 ${form[field] ? 'bg-green-500' : 'bg-gray-300'}`}
      >
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form[field] ? 'left-5.5' : 'left-0.5'}`} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )

  // ── Dynamic fields based on publisher_type ──
  const renderDynamicFields = () => {
    if (!form.publisher_type) return null

    const pt = form.publisher_type

    return (
      <div className="mt-5">
        <button
          type="button"
          onClick={() => setDynamicFieldsOpen(!dynamicFieldsOpen)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 cursor-pointer hover:text-gray-900 transition"
        >
          {dynamicFieldsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {t('Informations complémentaires', 'Informações complementares')}
        </button>

        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: dynamicFieldsOpen ? '2000px' : '0px',
            opacity: dynamicFieldsOpen ? 1 : 0,
          }}
        >
          <div className="grid gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
            {/* Company + SIRET for all professionals */}
            {isProfessional && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>
                    <Building2 className="h-4 w-4 text-gray-400" />
                    {t('Raison sociale', 'Razão social')}
                  </label>
                  <input
                    className={inputCls('publisher_company')}
                    placeholder={t('Nom de votre entreprise', 'Nome da empresa')}
                    value={form.publisher_company}
                    onChange={e => update('publisher_company', e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {t('SIRET / NIF', 'SIRET / NIF')}
                  </label>
                  <input
                    className={inputCls('publisher_siret')}
                    placeholder={t('12345678901234', '123456789')}
                    value={form.publisher_siret}
                    onChange={e => update('publisher_siret', e.target.value)}
                    maxLength={20}
                  />
                </div>
              </div>
            )}

            {/* Syndic fields */}
            {pt === 'syndic' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>
                      {t('Nom de l\'immeuble', 'Nome do edifício')}
                    </label>
                    <input
                      className={inputCls('immeuble_nom')}
                      placeholder={t('Résidence Les Oliviers', 'Edifício As Oliveiras')}
                      value={form.immeuble_nom}
                      onChange={e => update('immeuble_nom', e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      {t('Nombre de lots', 'Número de frações')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      className={inputCls('nb_lots')}
                      placeholder="24"
                      value={form.nb_lots}
                      onChange={e => update('nb_lots', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>
                    <MapPin className="h-4 w-4 text-gray-400" />
                    {t('Adresse de l\'immeuble', 'Morada do edifício')}
                  </label>
                  <input
                    className={inputCls('immeuble_adresse')}
                    placeholder={t('12 rue des Lilas, 13001 Marseille', 'Rua das Flores 12, 4000 Porto')}
                    value={form.immeuble_adresse}
                    onChange={e => update('immeuble_adresse', e.target.value)}
                    maxLength={500}
                  />
                </div>
                {renderToggle('partie_commune', t('Travaux en partie commune', 'Obras em parte comum'))}
              </>
            )}

            {/* Gestionnaire immobilier: same as syndic minus nb_lots */}
            {pt === 'gestionnaire_immobilier' && (
              <>
                <div>
                  <label className={labelCls}>
                    {t('Nom de l\'immeuble / bien', 'Nome do edifício / imóvel')}
                  </label>
                  <input
                    className={inputCls('immeuble_nom')}
                    placeholder={t('Résidence Les Oliviers', 'Edifício As Oliveiras')}
                    value={form.immeuble_nom}
                    onChange={e => update('immeuble_nom', e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    <MapPin className="h-4 w-4 text-gray-400" />
                    {t('Adresse du bien', 'Morada do imóvel')}
                  </label>
                  <input
                    className={inputCls('immeuble_adresse')}
                    placeholder={t('12 rue des Lilas, 13001 Marseille', 'Rua das Flores 12, 4000 Porto')}
                    value={form.immeuble_adresse}
                    onChange={e => update('immeuble_adresse', e.target.value)}
                    maxLength={500}
                  />
                </div>
              </>
            )}

            {/* Conciergerie fields */}
            {pt === 'conciergerie' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>
                      {t('Type d\'hébergement', 'Tipo de alojamento')}
                    </label>
                    <select
                      className={inputCls('type_hebergement')}
                      value={form.type_hebergement}
                      onChange={e => update('type_hebergement', e.target.value)}
                    >
                      {TYPE_HEBERGEMENT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {isPt ? opt.pt : opt.fr}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>
                      {t('Nombre d\'unités', 'Número de unidades')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      className={inputCls('nb_unites')}
                      placeholder="5"
                      value={form.nb_unites}
                      onChange={e => update('nb_unites', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>
                    {t('Contrainte calendrier', 'Restrição de calendário')}
                  </label>
                  <input
                    className={inputCls('contrainte_calendrier')}
                    placeholder={t('Travaux entre deux locations', 'Obras entre reservas')}
                    value={form.contrainte_calendrier}
                    onChange={e => update('contrainte_calendrier', e.target.value)}
                    maxLength={500}
                  />
                </div>
              </>
            )}

            {/* BTP fields: entreprise_btp, maitre_oeuvre, bureau_etudes */}
            {(pt === 'entreprise_btp' || pt === 'maitre_oeuvre' || pt === 'bureau_etudes') && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>
                    {t('Lot technique', 'Lote técnico')}
                  </label>
                  <select
                    className={inputCls('lot_technique')}
                    value={form.lot_technique}
                    onChange={e => update('lot_technique', e.target.value)}
                  >
                    {LOT_TECHNIQUE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {isPt ? opt.pt : opt.fr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    {t('Référence chantier', 'Referência da obra')}
                  </label>
                  <input
                    className={inputCls('reference_chantier')}
                    placeholder={t('REF-2026-042', 'REF-2026-042')}
                    value={form.reference_chantier}
                    onChange={e => update('reference_chantier', e.target.value)}
                    maxLength={200}
                  />
                </div>
              </div>
            )}

            {/* Promoteur fields */}
            {pt === 'promoteur_immobilier' && (
              <>
                <div>
                  <label className={labelCls}>
                    {t('Programme immobilier', 'Programa imobiliário')}
                  </label>
                  <input
                    className={inputCls('programme_immobilier')}
                    placeholder={t('Les Terrasses du Port', 'Terraços do Porto')}
                    value={form.programme_immobilier}
                    onChange={e => update('programme_immobilier', e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>
                      {t('Phase du chantier', 'Fase da obra')}
                    </label>
                    <select
                      className={inputCls('phase_chantier')}
                      value={form.phase_chantier}
                      onChange={e => update('phase_chantier', e.target.value)}
                    >
                      {PHASE_CHANTIER_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {isPt ? opt.pt : opt.fr}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>
                      {t('Nombre de logements', 'Número de habitações')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      className={inputCls('nb_logements')}
                      placeholder="48"
                      value={form.nb_logements}
                      onChange={e => update('nb_logements', e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Commerce / Restaurant */}
            {pt === 'commerce_restaurant' && (
              <div className="grid gap-4">
                <div>
                  <label className={labelCls}>
                    {t('Type d\'établissement', 'Tipo de estabelecimento')}
                  </label>
                  <input
                    className={inputCls('type_etablissement')}
                    placeholder={t('Restaurant, Boulangerie, Boutique...', 'Restaurante, Padaria, Loja...')}
                    value={form.type_etablissement}
                    onChange={e => update('type_etablissement', e.target.value)}
                    maxLength={100}
                  />
                </div>
                {renderToggle('mise_aux_normes', t('Mise aux normes ERP requise', 'Conformidade ERP necessária'))}
              </div>
            )}

            {/* Bureau / Entreprise */}
            {pt === 'bureau_entreprise' && (
              <div>
                <label className={labelCls}>
                  {t('Type d\'établissement', 'Tipo de estabelecimento')}
                </label>
                <input
                  className={inputCls('type_etablissement')}
                  placeholder={t('Bureau, Open space, Entrepôt...', 'Escritório, Open space, Armazém...')}
                  value={form.type_etablissement}
                  onChange={e => update('type_etablissement', e.target.value)}
                  maxLength={100}
                />
              </div>
            )}

            {/* Collectivité */}
            {pt === 'collectivite' && (
              <div>
                <label className={labelCls}>
                  {t('Type d\'établissement', 'Tipo de estabelecimento')}
                </label>
                <input
                  className={inputCls('type_etablissement')}
                  placeholder={t('École, Mairie, Hôpital, Stade...', 'Escola, Câmara, Hospital, Estádio...')}
                  value={form.type_etablissement}
                  onChange={e => update('type_etablissement', e.target.value)}
                  maxLength={100}
                />
              </div>
            )}

            {/* Hôtel */}
            {pt === 'hotel' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>
                    {t('Type d\'hébergement', 'Tipo de alojamento')}
                  </label>
                  <select
                    className={inputCls('type_hebergement')}
                    value={form.type_hebergement}
                    onChange={e => update('type_hebergement', e.target.value)}
                  >
                    {TYPE_HEBERGEMENT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {isPt ? opt.pt : opt.fr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    {t('Nombre d\'unités / chambres', 'Número de unidades / quartos')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    className={inputCls('nb_unites')}
                    placeholder="30"
                    value={form.nb_unites}
                    onChange={e => update('nb_unites', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Assurance fields */}
            {(pt === 'assurance' || pt === 'expert_assure') && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>
                      {t('N\u00b0 de sinistre', 'N.\u00ba do sinistro')}
                    </label>
                    <input
                      className={inputCls('numero_sinistre')}
                      placeholder="SIN-2026-12345"
                      value={form.numero_sinistre}
                      onChange={e => update('numero_sinistre', e.target.value)}
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      {t('Type de sinistre', 'Tipo de sinistro')}
                    </label>
                    <select
                      className={inputCls('type_sinistre')}
                      value={form.type_sinistre}
                      onChange={e => update('type_sinistre', e.target.value)}
                    >
                      {TYPE_SINISTRE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {isPt ? opt.pt : opt.fr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>
                    {t('Expert référent', 'Perito referente')}
                  </label>
                  <input
                    className={inputCls('expert_referent')}
                    placeholder={t('Nom de l\'expert', 'Nome do perito')}
                    value={form.expert_referent}
                    onChange={e => update('expert_referent', e.target.value)}
                    maxLength={200}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Success state ──
  if (success) {
    const manageUrl = `/marches/gerer?id=${success.id}&token=${success.token}`
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-amber-50">
        <div className="mx-auto max-w-xl px-4 py-20">
          <div className="rounded-2xl border border-green-200 bg-white p-8 shadow-lg text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">
              {t('Appel d\'offres publié !', 'Pedido de orçamento publicado!')}
            </h2>
            <p className="mb-6 text-gray-600">
              {t(
                'Votre appel d\'offres est en ligne. Les artisans qualifiés pourront y répondre.',
                'O seu pedido de orçamento está online. Os profissionais qualificados poderão responder.',
              )}
            </p>

            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
              <p className="mb-2 text-sm font-semibold text-amber-800">
                {t('Conservez ce lien de gestion :', 'Guarde este link de gestão:')}
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-white border border-amber-200 px-3 py-2">
                <code className="flex-1 break-all text-xs text-gray-700">
                  {typeof window !== 'undefined' ? window.location.origin : ''}{manageUrl}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}${manageUrl}`)
                  }}
                  className="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition cursor-pointer"
                >
                  {t('Copier', 'Copiar')}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href={manageUrl}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFC107] px-6 py-3 text-sm font-bold text-gray-900 shadow-[0_6px_20px_rgba(255,214,0,0.3)] hover:bg-[#FFE84D] hover:-translate-y-0.5 transition-all no-underline"
              >
                <ClipboardList className="h-4 w-4" />
                {t('Gérer mon appel d\'offres', 'Gerir o meu pedido')}
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-gray-900 px-6 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-900 hover:text-white transition-all no-underline"
              >
                {t('Retour à l\'accueil', 'Voltar ao início')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-amber-50">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,214,0,0.15),transparent_60%)]" />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition no-underline"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('Retour', 'Voltar')}
          </Link>
          <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {t('Publiez votre appel d\'offres', 'Publique o seu pedido de orçamento')}
          </h1>
          <p className="mx-auto max-w-lg text-lg text-gray-300">
            {t(
              'Décrivez votre projet et recevez des devis d\'artisans qualifiés. C\'est gratuit et sans engagement.',
              'Descreva o seu projeto e receba orçamentos de profissionais qualificados. É grátis e sem compromisso.',
            )}
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="mx-auto max-w-2xl px-4 py-10">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl sm:p-8">

          {/* ── Section: Templates ── */}
          {showTemplates && (
            <div className="mb-8">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                <LayoutGrid className="h-5 w-5 text-[#FFC107]" />
                {t('Modèles de marchés', 'Modelos de mercados')}
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                {t(
                  'Choisissez un modèle pour pré-remplir le formulaire, ou partez de zéro.',
                  'Escolha um modelo para pré-preencher o formulário, ou comece do zero.',
                )}
              </p>

              {/* Filter */}
              <input
                type="text"
                value={templateFilter}
                onChange={e => setTemplateFilter(e.target.value)}
                placeholder={t('Rechercher un modèle...', 'Pesquisar um modelo...')}
                className="w-full mb-4 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
              />

              {/* Templates grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4 max-h-[450px] overflow-y-auto pr-1">
                {MARCHE_TEMPLATES
                  .filter(tpl => {
                    if (!templateFilter.trim()) return true
                    const q = templateFilter.toLowerCase()
                    return (
                      tpl.title_fr.toLowerCase().includes(q) ||
                      tpl.title_pt.toLowerCase().includes(q) ||
                      tpl.category.toLowerCase().includes(q)
                    )
                  })
                  .map(tpl => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="text-left rounded-xl border border-gray-200 bg-white p-4 hover:border-yellow-400 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{tpl.icon}</span>
                        <span className="text-sm font-bold text-gray-900 group-hover:text-[#C9A84C] line-clamp-1">
                          {isPt ? tpl.title_pt : tpl.title_fr}
                        </span>
                      </div>
                      {(tpl.estimated_budget_min || tpl.estimated_budget_max) && (
                        <p className="text-xs text-gray-500 mb-1">
                          &#x1F4B0; {tpl.estimated_budget_min?.toLocaleString(isPt ? 'pt-PT' : 'fr-FR')}&#x20AC; - {tpl.estimated_budget_max?.toLocaleString(isPt ? 'pt-PT' : 'fr-FR')}&#x20AC;
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        &#x23F1; {tpl.typical_duration}
                      </p>
                    </button>
                  ))}
              </div>

              {/* Skip templates */}
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                className="w-full text-center border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all"
              >
                {t('Partir de zéro', 'Começar do zero')} &#x2192;
              </button>
            </div>
          )}

          {!showTemplates && (
            <button
              type="button"
              onClick={() => setShowTemplates(true)}
              className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <LayoutGrid className="h-4 w-4" />
              {t('Voir les modèles', 'Ver os modelos')}
            </button>
          )}

          {/* ── Section: Publisher type (2-step) ── */}
          <div className="mb-8">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-gray-900">
              <Building2 className="h-5 w-5 text-[#FFC107]" />
              {t('Votre profil', 'O seu perfil')}
            </h2>

            {/* Step 1: Category cards */}
            <p className="text-sm text-gray-500 mb-3">
              {t('1. Choisissez votre catégorie', '1. Escolha a sua categoria')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {PUBLISHER_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => handleCategorySelect(cat.key)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition-all cursor-pointer ${
                    selectedCategory === cat.key
                      ? 'border-[#FFC107] bg-yellow-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-2xl">{cat.emoji}</span>
                  <span className="text-xs font-semibold text-gray-700 leading-tight">
                    {isPt ? cat.pt : cat.fr}
                  </span>
                </button>
              ))}
            </div>

            {/* Step 2: Sub-profile selection */}
            {selectedCategory && (
              <div
                className="transition-all duration-300 ease-in-out"
                style={{ opacity: selectedCategory ? 1 : 0 }}
              >
                <p className="text-sm text-gray-500 mb-3">
                  {t('2. Précisez votre profil', '2. Especifique o seu perfil')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {PUBLISHER_CATEGORIES.find(c => c.key === selectedCategory)?.profiles.map(profile => (
                    <button
                      key={profile.value}
                      type="button"
                      onClick={() => handleProfileSelect(profile.value)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                        form.publisher_type === profile.value
                          ? 'bg-[#FFC107] text-gray-900 shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {isPt ? profile.pt : profile.fr}
                    </button>
                  ))}
                </div>
                {errors.publisher_type && <p className="mt-2 text-xs text-red-500">{errors.publisher_type}</p>}
              </div>
            )}

            {/* Dynamic fields based on publisher_type */}
            {renderDynamicFields()}
          </div>

          <hr className="mb-8 border-gray-100" />

          {/* ── Section: Publisher info ── */}
          <div className="mb-8">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-gray-900">
              <User className="h-5 w-5 text-[#FFC107]" />
              {t('Vos coordonnées', 'Os seus dados')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>
                  <User className="h-4 w-4 text-gray-400" />
                  {t('Nom / Raison sociale', 'Nome / Empresa')} *
                </label>
                <input
                  className={inputCls('publisher_name')}
                  placeholder={t('Jean Dupont', 'João Silva')}
                  value={form.publisher_name}
                  onChange={e => update('publisher_name', e.target.value)}
                />
                {errors.publisher_name && <p className="mt-1 text-xs text-red-500">{errors.publisher_name}</p>}
              </div>
              <div>
                <label className={labelCls}>
                  <Mail className="h-4 w-4 text-gray-400" />
                  Email *
                </label>
                <input
                  type="email"
                  className={inputCls('publisher_email')}
                  placeholder="email@example.com"
                  value={form.publisher_email}
                  onChange={e => update('publisher_email', e.target.value)}
                />
                {errors.publisher_email && <p className="mt-1 text-xs text-red-500">{errors.publisher_email}</p>}
              </div>
              <div>
                <label className={labelCls}>
                  <Phone className="h-4 w-4 text-gray-400" />
                  {t('Téléphone (optionnel)', 'Telefone (opcional)')}
                </label>
                <input
                  type="tel"
                  className={inputCls('publisher_phone')}
                  placeholder={t('+33 6 12 34 56 78', '+351 912 345 678')}
                  value={form.publisher_phone}
                  onChange={e => update('publisher_phone', e.target.value)}
                />
              </div>
            </div>
          </div>

          <hr className="mb-8 border-gray-100" />

          {/* ── Section: Project details ── */}
          <div className="mb-8">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-gray-900">
              <FileText className="h-5 w-5 text-[#FFC107]" />
              {t('Détails du projet', 'Detalhes do projeto')}
            </h2>
            <div className="grid gap-4">
              {/* Title */}
              <div>
                <label className={labelCls}>
                  {t('Titre du projet', 'Título do projeto')} *
                </label>
                <input
                  className={inputCls('title')}
                  placeholder={t('Ex : Rénovation salle de bain 12m²', 'Ex: Renovação casa de banho 12m²')}
                  value={form.title}
                  onChange={e => update('title', e.target.value)}
                  maxLength={200}
                />
                {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>
                  {t('Description détaillée', 'Descrição detalhada')} *
                </label>
                <textarea
                  className={`${inputCls('description')} min-h-[120px] resize-y`}
                  placeholder={t(
                    'Décrivez les travaux à réaliser, les matériaux souhaités, les contraintes...',
                    'Descreva os trabalhos a realizar, materiais desejados, restrições...',
                  )}
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                  maxLength={5000}
                />
                <div className="mt-1 flex justify-between">
                  {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
                  <p className="ml-auto text-xs text-gray-400">{form.description.length}/5000</p>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className={labelCls}>
                  {t('Catégorie', 'Categoria')} *
                </label>
                <select
                  className={inputCls('category')}
                  value={form.category}
                  onChange={e => update('category', e.target.value)}
                >
                  <option value="">{t('-- Choisir une catégorie --', '-- Escolher uma categoria --')}</option>
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>
                      {isPt ? c.pt : c.fr}
                    </option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category}</p>}
              </div>

              {/* Location */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>
                    <MapPin className="h-4 w-4 text-gray-400" />
                    {t('Ville', 'Cidade')} *
                  </label>
                  <input
                    className={inputCls('location_city')}
                    placeholder={t('Marseille', 'Porto')}
                    value={form.location_city}
                    onChange={e => update('location_city', e.target.value)}
                  />
                  {errors.location_city && <p className="mt-1 text-xs text-red-500">{errors.location_city}</p>}
                </div>
                <div>
                  <label className={labelCls}>
                    {t('Code postal (optionnel)', 'Código postal (opcional)')}
                  </label>
                  <input
                    className={inputCls('location_postal')}
                    placeholder={t('13001', '4000-001')}
                    value={form.location_postal}
                    onChange={e => update('location_postal', e.target.value)}
                  />
                </div>
              </div>

              {/* Budget */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>
                    <Euro className="h-4 w-4 text-gray-400" />
                    {t('Budget min (optionnel)', 'Orçamento min (opcional)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    className={inputCls('budget_min')}
                    placeholder="500"
                    value={form.budget_min}
                    onChange={e => update('budget_min', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    <Euro className="h-4 w-4 text-gray-400" />
                    {t('Budget max (optionnel)', 'Orçamento max (opcional)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    className={inputCls('budget_max')}
                    placeholder="5000"
                    value={form.budget_max}
                    onChange={e => update('budget_max', e.target.value)}
                  />
                  {errors.budget_max && <p className="mt-1 text-xs text-red-500">{errors.budget_max}</p>}
                </div>
              </div>

              {/* Deadline */}
              <div>
                <label className={labelCls}>
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {t('Date limite de candidature', 'Prazo para candidaturas')} *
                </label>
                <input
                  type="date"
                  min={minDeadline}
                  className={inputCls('deadline')}
                  value={form.deadline}
                  onChange={e => update('deadline', e.target.value)}
                />
                {errors.deadline && <p className="mt-1 text-xs text-red-500">{errors.deadline}</p>}
              </div>

              {/* Recurring market toggle */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <button
                    type="button"
                    onClick={() => setIsRecurring(!isRecurring)}
                    className={`relative w-11 h-6 rounded-full transition-all shrink-0 ${isRecurring ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isRecurring ? 'left-5.5' : 'left-0.5'}`} />
                  </button>
                  <div>
                    <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                      <RefreshCw className="h-4 w-4 text-gray-400" />
                      {t('Marché récurrent', 'Mercado recorrente')}
                    </span>
                  </div>
                </div>

                {isRecurring && (
                  <div className="mt-3 ml-14">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {t('Fréquence de republication', 'Frequência de republicação')}
                    </label>
                    <div className="flex gap-2">
                      {([
                        { value: 'mensuel' as const, fr: 'Mensuel', pt: 'Mensal' },
                        { value: 'trimestriel' as const, fr: 'Trimestriel', pt: 'Trimestral' },
                        { value: 'annuel' as const, fr: 'Annuel', pt: 'Anual' },
                      ]).map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setRecurrenceInterval(opt.value)}
                          className={`flex-1 rounded-lg border-2 px-3 py-2 text-xs font-medium transition cursor-pointer ${
                            recurrenceInterval === opt.value
                              ? 'border-[#FFC107] bg-yellow-50 text-gray-900'
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {isPt ? opt.pt : opt.fr}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {t(
                        'Ce marché sera automatiquement republié à chaque période',
                        'Este mercado será automaticamente republicado a cada período',
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Urgency */}
              <div>
                <label className={labelCls}>
                  {t('Niveau d\'urgence', 'Nível de urgência')}
                </label>
                <div className="flex gap-3">
                  {URGENCY_OPTIONS.map(u => {
                    const Icon = u.icon
                    const selected = form.urgency === u.value
                    return (
                      <button
                        key={u.value}
                        type="button"
                        onClick={() => update('urgency', u.value)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition cursor-pointer ${
                          selected
                            ? 'border-[#FFC107] bg-yellow-50 text-gray-900'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${selected ? u.color : 'text-gray-400'}`} />
                        {isPt ? u.pt : u.fr}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <hr className="mb-8 border-gray-100" />

          {/* ── Section: Exigences professionnelles ── */}
          <div className="mb-8">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-gray-900">
              <Shield className="h-5 w-5 text-[#FFC107]" />
              {t('Exigences professionnelles', 'Requisitos profissionais')}
            </h2>

            {/* Max candidatures */}
            <div className="mb-5">
              <label className={labelCls}>
                {t('Nombre max de candidatures', 'Número máximo de candidaturas')}
              </label>
              <p className="text-xs text-gray-400 mb-2">
                {t('Limitez à quelques artisans pour des réponses de qualité', 'Limite a poucos profissionais para respostas de qualidade')}
              </p>
              <input
                type="number"
                min={1}
                max={10}
                value={form.max_candidatures}
                onChange={e => setForm(prev => ({ ...prev, max_candidatures: Math.max(1, Math.min(10, Number(e.target.value) || 3)) }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[0.95rem] text-gray-900 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
              />
              <div className="mt-2 flex items-center gap-2">
                {[1, 3, 5, 10].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, max_candidatures: n }))}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${
                      form.max_candidatures === n
                        ? 'bg-[#FFC107] text-gray-900'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Compliance toggles */}
            <div className="mb-5">
              <label className={labelCls}>
                {t('Certifications requises', 'Certificações obrigatórias')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {([
                  { key: 'require_rc_pro' as const, emoji: '\u{1F6E1}\uFE0F', fr: 'RC Pro requise', pt: 'RC Pro obrigatória' },
                  { key: 'require_decennale' as const, emoji: '\u{1F3D7}\uFE0F', fr: 'Assurance décennale requise', pt: 'Seguro decenal obrigatório' },
                  { key: 'require_rge' as const, emoji: '\u{1F33F}', fr: 'Certification RGE requise', pt: 'Certificação RGE obrigatória' },
                  { key: 'require_qualibat' as const, emoji: '\u{1F3C5}', fr: 'QualiBAT requis', pt: 'QualiBAT obrigatório' },
                ]).map(toggle => (
                  <label
                    key={toggle.key}
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${
                      form[toggle.key]
                        ? 'border-[#FFC107] bg-yellow-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, [toggle.key]: !prev[toggle.key] }))}
                      className={`relative w-11 h-6 rounded-full transition-all shrink-0 ${form[toggle.key] ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form[toggle.key] ? 'left-5.5' : 'left-0.5'}`} />
                    </button>
                    <span className="text-sm text-gray-700">
                      {toggle.emoji} {isPt ? toggle.pt : toggle.fr}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Preferred work mode */}
            <div className="mb-5">
              <label className={labelCls}>
                {t('Mode de travail préféré', 'Modo de trabalho preferido')}
              </label>
              <select
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[0.95rem] text-gray-900 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                value={form.preferred_work_mode}
                onChange={e => setForm(prev => ({ ...prev, preferred_work_mode: e.target.value }))}
              >
                {WORK_MODE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {isPt ? opt.pt : opt.fr}
                  </option>
                ))}
              </select>
            </div>

            {/* Info banner */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-2">
              <Target className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700">
                {t(
                  'Votre annonce sera automatiquement envoyée aux artisans qualifiés les plus proches de votre chantier',
                  'O seu anúncio será automaticamente enviado aos profissionais qualificados mais próximos da sua obra',
                )}
              </p>
            </div>
          </div>

          {/* API error */}
          {apiError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {apiError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full cursor-pointer rounded-full bg-[#FFC107] px-8 py-3.5 text-base font-bold text-gray-900 shadow-[0_6px_20px_rgba(255,214,0,0.3)] transition-all hover:bg-[#FFE84D] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('Publication en cours...', 'A publicar...')}
              </span>
            ) : (
              t('Publier l\'appel d\'offres', 'Publicar pedido de orçamento')
            )}
          </button>

          <p className="mt-3 text-center text-xs text-gray-500">
            {t(
              'Gratuit et sans engagement. Vos coordonnées ne seront pas partagées publiquement.',
              'Grátis e sem compromisso. Os seus dados não serão partilhados publicamente.',
            )}
          </p>
        </form>
      </div>
    </div>
  )
}
