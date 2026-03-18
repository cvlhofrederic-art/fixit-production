'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { formatPrice } from '@/lib/utils'

interface Props {
  artisan: any
  navigateTo: (page: string) => void
}

const CATEGORIES = [
  { id: 'canalizacao', label: 'Canalização', labelFr: 'Plomberie', emoji: '🔧' },
  { id: 'eletricidade', label: 'Eletricidade', labelFr: 'Électricité', emoji: '⚡' },
  { id: 'pintura', label: 'Pintura', labelFr: 'Peinture', emoji: '🎨' },
  { id: 'serralharia', label: 'Serralharia', labelFr: 'Serrurerie', emoji: '🔩' },
  { id: 'elevadores', label: 'Elevadores', labelFr: 'Ascenseurs', emoji: '🛗' },
  { id: 'limpeza', label: 'Limpeza', labelFr: 'Nettoyage', emoji: '🧹' },
  { id: 'jardinagem', label: 'Jardinagem', labelFr: 'Jardinage', emoji: '🌱' },
  { id: 'impermeabilizacao', label: 'Impermeabilização', labelFr: 'Imperméabilisation', emoji: '💧' },
  { id: 'construcao', label: 'Construção Civil', labelFr: 'Construction', emoji: '🏗️' },
  { id: 'climatizacao', label: 'Climatização', labelFr: 'Climatisation', emoji: '❄️' },
  { id: 'seguranca', label: 'Segurança', labelFr: 'Sécurité', emoji: '🔒' },
  { id: 'gas', label: 'Gás', labelFr: 'Gaz', emoji: '🔥' },
  { id: 'telhados', label: 'Telhados', labelFr: 'Toitures', emoji: '🏠' },
  { id: 'desentupimentos', label: 'Desentupimentos', labelFr: 'Débouchage', emoji: '🚰' },
  { id: 'carpintaria', label: 'Carpintaria', labelFr: 'Menuiserie', emoji: '🪚' },
  { id: 'vidracaria', label: 'Vidraçaria', labelFr: 'Vitrerie', emoji: '🪟' },
  { id: 'mudancas', label: 'Mudanças', labelFr: 'Déménagement', emoji: '📦' },
  { id: 'renovacao', label: 'Renovação', labelFr: 'Rénovation', emoji: '🔨' },
  { id: 'isolamento', label: 'Isolamento', labelFr: 'Isolation', emoji: '🧱' },
  { id: 'outro', label: 'Outro', labelFr: 'Autre', emoji: '📋' },
]

const TIMELINE_OPTIONS = [
  { value: '1_day', labelFr: '1 jour', labelPt: '1 dia' },
  { value: '3_days', labelFr: '3 jours', labelPt: '3 dias' },
  { value: '1_week', labelFr: '1 semaine', labelPt: '1 semana' },
  { value: '2_weeks', labelFr: '2 semaines', labelPt: '2 semanas' },
  { value: '1_month', labelFr: '1 mois', labelPt: '1 mês' },
  { value: '2_months', labelFr: '2 mois', labelPt: '2 meses' },
  { value: '3_months', labelFr: '3 mois', labelPt: '3 meses' },
  { value: 'custom', labelFr: 'Personnalisé', labelPt: 'Personalizado' },
]

function getCategoryLabel(id: string, isPt: boolean): string {
  const cat = CATEGORIES.find(c => c.id === id)
  if (!cat) return id
  return `${cat.emoji} ${isPt ? cat.label : cat.labelFr}`
}

function getCategoryEmoji(id: string): string {
  return CATEGORIES.find(c => c.id === id)?.emoji || '📋'
}

function daysRemaining(deadline: string): number {
  const now = new Date()
  const end = new Date(deadline)
  const diff = end.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function urgencyBadge(urgency: string, isPt: boolean) {
  switch (urgency) {
    case 'emergency':
      return (
        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 rounded-full px-3 py-1 text-xs font-semibold">
          🔴 {isPt ? 'Emergência' : 'Urgence'}
        </span>
      )
    case 'urgent':
      return (
        <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 rounded-full px-3 py-1 text-xs font-semibold">
          🟡 {isPt ? 'Urgente' : 'Urgent'}
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 rounded-full px-3 py-1 text-xs font-semibold">
          🟢 {isPt ? 'Normal' : 'Normal'}
        </span>
      )
  }
}

function statusBadge(status: string, isPt: boolean) {
  switch (status) {
    case 'accepted':
      return (
        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 rounded-full px-3 py-1 text-xs font-semibold">
          ✅ {isPt ? 'Aceite' : 'Accepté'}
        </span>
      )
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 rounded-full px-3 py-1 text-xs font-semibold">
          ❌ {isPt ? 'Recusado' : 'Refusé'}
        </span>
      )
    case 'withdrawn':
      return (
        <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 rounded-full px-3 py-1 text-xs font-semibold">
          ↩️ {isPt ? 'Retirado' : 'Retiré'}
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 text-xs font-semibold">
          ⏳ {isPt ? 'Pendente' : 'En attente'}
        </span>
      )
  }
}

function publisherBadge(type: string, isPt: boolean) {
  switch (type) {
    case 'syndic':
      return <span className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-xs font-semibold">🏢 Syndic</span>
    case 'entreprise':
      return <span className="bg-purple-100 text-purple-700 rounded-full px-3 py-1 text-xs font-semibold">🏭 {isPt ? 'Empresa' : 'Entreprise'}</span>
    default:
      return <span className="bg-gray-100 text-gray-700 rounded-full px-3 py-1 text-xs font-semibold">👤 {isPt ? 'Particular' : 'Particulier'}</span>
  }
}

// Fake data for blurred preview behind pro gate
const FAKE_MARCHES = [
  { title: 'Rénovation cage d\'escalier immeuble 12 lots', category: 'renovacao', budget_min: 8000, budget_max: 15000, city: 'Porto', urgency: 'normal' },
  { title: 'Remplacement chaudière collective', category: 'canalizacao', budget_min: 5000, budget_max: 12000, city: 'Lisboa', urgency: 'urgent' },
  { title: 'Ravalement façade bâtiment B', category: 'construcao', budget_min: 20000, budget_max: 45000, city: 'Marseille', urgency: 'normal' },
]

export default function BourseAuxMarchesSection({ artisan, navigateTo }: Props) {
  // Detect locale
  const [locale, setLocale] = useState('fr')
  useEffect(() => {
    const match = document.cookie.match(/locale=(\w+)/)
    if (match) setLocale(match[1])
  }, [])
  const isPt = locale === 'pt'

  // PRO GATE CHECK
  const isPro = artisan?.subscription_tier === 'artisan_pro'

  // State
  const [activeTab, setActiveTab] = useState<'browse' | 'mybids' | 'won' | 'settings'>('browse')
  const [marches, setMarches] = useState<any[]>([])
  const [myBids, setMyBids] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMarche, setSelectedMarche] = useState<any>(null)
  const [showBidForm, setShowBidForm] = useState(false)

  // Marches preferences state
  const [marchesPrefs, setMarchesPrefs] = useState({
    marches_opt_in: false,
    marches_categories: [] as string[],
    marches_work_mode: 'forfait',
    marches_tarif_journalier: null as number | null,
    marches_tarif_horaire: null as number | null,
    marches_description: '',
  })
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsLoaded, setPrefsLoaded] = useState(false)

  // Filters
  const [filterCategory, setFilterCategory] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterUrgency, setFilterUrgency] = useState('')

  // Bid form state
  const [bidPrice, setBidPrice] = useState('')
  const [bidTimeline, setBidTimeline] = useState('')
  const [bidDescription, setBidDescription] = useState('')
  const [bidMaterials, setBidMaterials] = useState(false)
  const [bidGuarantee, setBidGuarantee] = useState('')
  const [bidSubmitting, setBidSubmitting] = useState(false)
  const [bidError, setBidError] = useState('')
  const [bidSuccess, setBidSuccess] = useState(false)

  // Stats
  const [stats, setStats] = useState({ openCount: 0, activeBids: 0, wonCount: 0 })

  // Photo gallery state
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState<number | null>(null)

  // Evaluation state
  const [evalBidId, setEvalBidId] = useState<string | null>(null)
  const [evalRating, setEvalRating] = useState(0)
  const [evalComment, setEvalComment] = useState('')
  const [evalSubmitting, setEvalSubmitting] = useState(false)
  const [evalSuccess, setEvalSuccess] = useState(false)
  const [receivedEval, setReceivedEval] = useState<Record<string, any>>({})

  // Messaging state
  const [msgCandidatureId, setMsgCandidatureId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [msgLoading, setMsgLoading] = useState(false)

  // Alerts state
  const [alerts, setAlerts] = useState<{ expiringCount: number; unreadMessages: number }>({ expiringCount: 0, unreadMessages: 0 })

  // Fetch marches
  const fetchMarches = useCallback(async () => {
    if (!isPro) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterCategory) params.set('category', filterCategory)
      if (filterCity) params.set('city', filterCity)
      if (filterUrgency) params.set('urgency', filterUrgency)
      params.set('status', 'open')
      if (artisan?.id) params.set('artisan_user_id', artisan.id)
      const res = await fetch(`/api/marches?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch marches')
      const data = await res.json()
      setMarches(data.marches || [])
      setStats(prev => ({ ...prev, openCount: data.total || data.marches?.length || 0 }))
    } catch {
      setMarches([])
    } finally {
      setLoading(false)
    }
  }, [isPro, filterCategory, filterCity, filterUrgency])

  // Fetch my bids
  const fetchMyBids = useCallback(async () => {
    if (!isPro || !artisan?.id) return
    try {
      const res = await fetch(`/api/marches?my_bids=true&artisan_id=${artisan.id}`)
      if (!res.ok) throw new Error('Failed to fetch bids')
      const data = await res.json()
      const bids = data.candidatures || data.bids || []
      setMyBids(bids)
      setStats(prev => ({
        ...prev,
        activeBids: bids.filter((b: any) => b.status === 'pending').length,
        wonCount: bids.filter((b: any) => b.status === 'accepted').length,
      }))
    } catch {
      setMyBids([])
    }
  }, [isPro, artisan?.id])

  // Fetch marches preferences
  const fetchMarchesPrefs = useCallback(async () => {
    if (!isPro || !artisan?.id) return
    try {
      const res = await fetch(`/api/artisan-marches-prefs?artisan_id=${artisan.id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.prefs) {
          setMarchesPrefs({
            marches_opt_in: data.prefs.marches_opt_in ?? false,
            marches_categories: data.prefs.marches_categories ?? [],
            marches_work_mode: data.prefs.marches_work_mode ?? 'forfait',
            marches_tarif_journalier: data.prefs.marches_tarif_journalier ?? null,
            marches_tarif_horaire: data.prefs.marches_tarif_horaire ?? null,
            marches_description: data.prefs.marches_description ?? '',
          })
        }
      }
    } catch {
      // silent
    } finally {
      setPrefsLoaded(true)
    }
  }, [isPro, artisan?.id])

  // Compute alerts from fetched data
  const computeAlerts = useCallback(() => {
    const now = new Date()
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const expiring = marches.filter(m => {
      if (!m.deadline) return false
      const d = new Date(m.deadline)
      return d >= now && d <= threeDaysLater
    }).length
    setAlerts(prev => ({ ...prev, expiringCount: expiring }))
  }, [marches])

  useEffect(() => {
    computeAlerts()
  }, [computeAlerts])

  // Load messages for a candidature
  const loadMessages = useCallback(async (marcheId: string, candidatureId: string) => {
    setMsgLoading(true)
    try {
      const res = await fetch(`/api/marches/${marcheId}/messages?candidature_id=${candidatureId}&artisan_id=${artisan?.id}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setAlerts(prev => ({ ...prev, unreadMessages: data.unread_count || 0 }))
      }
    } catch {
      setMessages([])
    } finally {
      setMsgLoading(false)
    }
  }, [artisan?.id])

  // Send a message
  const sendMessage = async (marcheId: string, candidatureId: string) => {
    if (!msgInput.trim() || msgSending) return
    setMsgSending(true)
    try {
      const res = await fetch(`/api/marches/${marcheId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidature_id: candidatureId,
          sender_type: 'artisan',
          sender_id: artisan?.id,
          content: msgInput.trim(),
        }),
      })
      if (res.ok) {
        setMsgInput('')
        await loadMessages(marcheId, candidatureId)
      }
    } catch {
      // silent
    } finally {
      setMsgSending(false)
    }
  }

  // Submit evaluation
  const submitEvaluation = async (marcheId: string) => {
    if (evalRating < 1 || evalSubmitting) return
    setEvalSubmitting(true)
    try {
      const res = await fetch(`/api/marches/${marcheId}/evaluation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artisan_id: artisan?.id,
          evaluator_type: 'artisan',
          note_globale: evalRating,
          comment: evalComment.trim() || null,
        }),
      })
      if (res.ok) {
        setEvalSuccess(true)
        setEvalBidId(null)
        setEvalRating(0)
        setEvalComment('')
        setTimeout(() => setEvalSuccess(false), 3000)
      }
    } catch {
      // silent
    } finally {
      setEvalSubmitting(false)
    }
  }

  // Load evaluation received from publisher
  const loadReceivedEvaluation = useCallback(async (marcheId: string) => {
    try {
      const res = await fetch(`/api/marches/${marcheId}/evaluation?artisan_id=${artisan?.id}&type=from_publisher`)
      if (res.ok) {
        const data = await res.json()
        if (data.evaluation) {
          setReceivedEval(prev => ({ ...prev, [marcheId]: data.evaluation }))
        }
      }
    } catch {
      // silent
    }
  }, [artisan?.id])

  // Save marches preferences
  const saveMarchesPrefs = async () => {
    if (!artisan?.id) return
    setPrefsSaving(true)
    try {
      await fetch('/api/artisan-marches-prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artisan_id: artisan.id, ...marchesPrefs }),
      })
    } catch {
      // silent
    } finally {
      setPrefsSaving(false)
    }
  }

  useEffect(() => {
    fetchMarches()
    fetchMyBids()
    fetchMarchesPrefs()
  }, [fetchMarches, fetchMyBids, fetchMarchesPrefs])

  // Submit bid
  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMarche?.id || !artisan?.id) return
    setBidError('')
    setBidSubmitting(true)
    setBidSuccess(false)

    try {
      const res = await fetch(`/api/marches/${selectedMarche.id}/candidature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artisan_id: artisan.id,
          price: parseFloat(bidPrice),
          timeline: bidTimeline,
          description: bidDescription,
          materials_included: bidMaterials,
          guarantee: bidGuarantee || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Submission failed')
      }
      setBidSuccess(true)
      setBidPrice('')
      setBidTimeline('')
      setBidDescription('')
      setBidMaterials(false)
      setBidGuarantee('')
      fetchMyBids()
      setTimeout(() => {
        setShowBidForm(false)
        setBidSuccess(false)
      }, 2500)
    } catch (err: any) {
      setBidError(err.message || (isPt ? 'Erro ao enviar' : 'Erreur lors de l\'envoi'))
    } finally {
      setBidSubmitting(false)
    }
  }

  const resetDetail = () => {
    setSelectedMarche(null)
    setShowBidForm(false)
    setBidError('')
    setBidSuccess(false)
    setSelectedPhotoIdx(null)
  }

  // ─── PRO GATE ─────────────────────────────────────────
  if (!isPro) {
    return (
      <div className="p-6 lg:p-8 animate-fadeIn">
        <div className="relative">
          {/* Blurred fake preview */}
          <div className="filter blur-sm opacity-60 pointer-events-none select-none" aria-hidden="true">
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              {FAKE_MARCHES.map((fm, i) => (
                <div key={i} className="rounded-2xl shadow-sm border border-gray-200 p-6 bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 text-xs font-semibold">
                      {getCategoryLabel(fm.category, isPt)}
                    </span>
                  </div>
                  <h3 className="font-bold text-[#0D1B2E] mb-2">{fm.title}</h3>
                  <p className="text-sm text-gray-500 mb-2">📍 {fm.city}</p>
                  <p className="text-sm font-semibold text-[#0D1B2E]">
                    {formatPrice(fm.budget_min, locale)} - {formatPrice(fm.budget_max, locale)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Overlay CTA */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-yellow-200 p-8 md:p-12 max-w-lg text-center">
              <div className="text-6xl mb-4">🏛️</div>
              <h2 className="text-2xl font-bold text-[#0D1B2E] mb-3">
                {isPt ? 'Bolsa de Mercados' : 'Bourse aux Marchés'}
              </h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                {isPt
                  ? 'Aceda a dezenas de concursos publicados por síndicos, empresas e particulares. Candidate-se diretamente e ganhe novos contratos.'
                  : 'Accédez à des dizaines d\'appels d\'offres publiés par des syndics, entreprises et particuliers. Postulez directement et remportez de nouveaux contrats.'}
              </p>
              <button
                onClick={() => navigateTo('tarifs')}
                className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-full px-8 py-3 text-lg transition-all hover:scale-105 shadow-md"
              >
                {isPt ? 'Atualizar para Pro' : 'Passer au Pro'} ✨
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── DETAIL VIEW ──────────────────────────────────────
  if (selectedMarche) {
    const days = selectedMarche.deadline ? daysRemaining(selectedMarche.deadline) : null
    const photos: string[] = selectedMarche.photos || []

    return (
      <div className="p-6 lg:p-8 animate-fadeIn">
        {/* Back button */}
        <button
          onClick={resetDetail}
          className="flex items-center gap-2 text-gray-500 hover:text-[#0D1B2E] mb-6 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {isPt ? 'Voltar aos mercados' : 'Retour aux marchés'}
        </button>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl shadow-sm border border-gray-200 p-6 bg-white">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 text-xs font-semibold">
                  {getCategoryLabel(selectedMarche.category, isPt)}
                </span>
                {urgencyBadge(selectedMarche.urgency, isPt)}
                {publisherBadge(selectedMarche.publisher_type, isPt)}
              </div>

              <h1 className="text-2xl font-bold text-[#0D1B2E] mb-2">{selectedMarche.title}</h1>

              <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
                {selectedMarche.city && (
                  <span className="flex items-center gap-1">📍 {selectedMarche.city}</span>
                )}
                {days !== null && (
                  <span className="flex items-center gap-1">
                    ⏰ {days > 0
                      ? (isPt ? `${days} dias restantes` : `${days} jours restants`)
                      : (isPt ? 'Prazo expirado' : 'Délai expiré')}
                  </span>
                )}
                {selectedMarche.candidatures_count !== undefined && (
                  <span className="flex items-center gap-1">
                    👥 {selectedMarche.candidatures_count} {isPt ? 'candidaturas' : 'candidatures'}
                  </span>
                )}
              </div>

              {(selectedMarche.budget_min || selectedMarche.budget_max) ? (
                <div className="bg-[#F7F4EE] rounded-xl p-4 mb-4">
                  <span className="text-sm text-gray-500 block mb-1">{isPt ? 'Orçamento' : 'Budget'}</span>
                  <span className="text-xl font-bold text-[#0D1B2E]">
                    {selectedMarche.budget_min ? formatPrice(selectedMarche.budget_min, locale) : '—'}
                    {' — '}
                    {selectedMarche.budget_max ? formatPrice(selectedMarche.budget_max, locale) : '—'}
                  </span>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                  <span className="text-sm text-gray-400 italic">
                    {isPt ? 'Orçamento não definido' : 'Budget non défini'}
                  </span>
                </div>
              )}

              <div className="prose prose-sm max-w-none text-gray-700">
                <h3 className="text-[#0D1B2E] font-semibold mb-2">{isPt ? 'Descrição' : 'Description'}</h3>
                <p className="whitespace-pre-wrap">{selectedMarche.description || (isPt ? 'Sem descrição.' : 'Aucune description.')}</p>
              </div>
            </div>

            {/* Photos gallery */}
            {photos.length > 0 && (
              <div className="rounded-2xl shadow-sm border border-gray-200 p-6 bg-white">
                <h3 className="font-semibold text-[#0D1B2E] mb-4">{isPt ? 'Fotos' : 'Photos'} ({photos.length})</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {photos.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPhotoIdx(idx)}
                      className="aspect-square rounded-xl overflow-hidden border border-gray-100 hover:ring-2 hover:ring-yellow-400 transition-all"
                    >
                      <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>

                {/* Lightbox */}
                {selectedPhotoIdx !== null && (
                  <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setSelectedPhotoIdx(null)}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedPhotoIdx(null) }}
                      className="absolute top-4 right-4 text-white text-3xl hover:text-yellow-400 z-50"
                    >
                      ✕
                    </button>
                    {selectedPhotoIdx > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedPhotoIdx(selectedPhotoIdx - 1) }}
                        className="absolute left-4 text-white text-4xl hover:text-yellow-400"
                      >
                        ‹
                      </button>
                    )}
                    {selectedPhotoIdx < photos.length - 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedPhotoIdx(selectedPhotoIdx + 1) }}
                        className="absolute right-4 text-white text-4xl hover:text-yellow-400"
                      >
                        ›
                      </button>
                    )}
                    <img
                      src={photos[selectedPhotoIdx]}
                      alt={`Photo ${selectedPhotoIdx + 1}`}
                      className="max-w-full max-h-[85vh] rounded-xl object-contain"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Message thread */}
            {selectedMarche.my_candidature_id && (
              <div className="rounded-2xl shadow-sm border border-gray-200 p-6 bg-white">
                <h3 className="font-semibold text-[#0D1B2E] mb-4 flex items-center gap-2">
                  &#x1F4AC; {isPt ? 'Mensagens' : 'Messages'}
                </h3>

                {!msgCandidatureId ? (
                  <button
                    onClick={() => {
                      setMsgCandidatureId(selectedMarche.my_candidature_id)
                      loadMessages(selectedMarche.id, selectedMarche.my_candidature_id)
                    }}
                    className="w-full text-center border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-all"
                  >
                    {isPt ? 'Abrir conversa com o publicador' : 'Ouvrir la conversation avec le donneur d\'ordre'}
                  </button>
                ) : (
                  <div>
                    {/* Messages list */}
                    <div className="max-h-64 overflow-y-auto space-y-3 mb-4 p-2">
                      {msgLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : messages.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">
                          {isPt ? 'Nenhuma mensagem ainda. Inicie a conversa!' : 'Aucun message pour l\'instant. Lancez la conversation !'}
                        </p>
                      ) : (
                        messages.map((msg, idx) => (
                          <div
                            key={msg.id || idx}
                            className={`flex ${msg.sender_type === 'artisan' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                              msg.sender_type === 'artisan'
                                ? 'bg-yellow-100 text-gray-900'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                              <p className="text-[10px] text-gray-400 mt-1">
                                {new Date(msg.created_at).toLocaleString(isPt ? 'pt-PT' : 'fr-FR', {
                                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={msgInput}
                        onChange={e => setMsgInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage(selectedMarche.id, selectedMarche.my_candidature_id)
                          }
                        }}
                        placeholder={isPt ? 'Escreva a sua mensagem...' : 'Écrivez votre message...'}
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
                      />
                      <button
                        onClick={() => sendMessage(selectedMarche.id, selectedMarche.my_candidature_id)}
                        disabled={!msgInput.trim() || msgSending}
                        className="shrink-0 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold rounded-xl px-4 py-2.5 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {msgSending ? '...' : (isPt ? 'Enviar' : 'Envoyer')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar: bid form or action */}
          <div className="space-y-6">
            {!showBidForm ? (
              <div className="rounded-2xl shadow-sm border border-gray-200 p-6 bg-white sticky top-6">
                <h3 className="font-bold text-[#0D1B2E] mb-4 text-lg">
                  {isPt ? 'Interessado?' : 'Intéressé ?'}
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  {isPt
                    ? 'Envie a sua candidatura com o seu preço e prazo estimado.'
                    : 'Envoyez votre candidature avec votre prix et délai estimé.'}
                </p>
                <button
                  onClick={() => setShowBidForm(true)}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-full px-6 py-3 transition-all hover:scale-105 shadow-md"
                >
                  {isPt ? 'Candidatar-me' : 'Postuler'} 🚀
                </button>
              </div>
            ) : (
              <div className="rounded-2xl shadow-sm border border-yellow-200 p-6 bg-white sticky top-6">
                {bidSuccess ? (
                  <div className="text-center py-8 animate-fadeIn">
                    <div className="text-6xl mb-4 animate-bounce">🎉</div>
                    <h3 className="text-xl font-bold text-green-600 mb-2">
                      {isPt ? 'Candidatura enviada!' : 'Candidature envoyée !'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {isPt
                        ? 'Receberá uma notificação quando o cliente responder.'
                        : 'Vous recevrez une notification quand le client répondra.'}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitBid}>
                    <h3 className="font-bold text-[#0D1B2E] mb-4 text-lg">
                      {isPt ? 'A sua proposta' : 'Votre proposition'}
                    </h3>

                    {bidError && (
                      <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm mb-4">{bidError}</div>
                    )}

                    {/* Price */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {isPt ? 'Preço (€)' : 'Prix (€)'} *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={bidPrice}
                        onChange={e => setBidPrice(e.target.value)}
                        placeholder="ex: 5000"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
                      />
                    </div>

                    {/* Timeline */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {isPt ? 'Prazo estimado' : 'Délai estimé'} *
                      </label>
                      <select
                        required
                        value={bidTimeline}
                        onChange={e => setBidTimeline(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all bg-white"
                      >
                        <option value="">{isPt ? 'Selecionar...' : 'Sélectionner...'}</option>
                        {TIMELINE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {isPt ? opt.labelPt : opt.labelFr}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Description */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {isPt ? 'Descrição da proposta' : 'Description de la proposition'} *
                      </label>
                      <textarea
                        required
                        value={bidDescription}
                        onChange={e => setBidDescription(e.target.value)}
                        rows={4}
                        placeholder={isPt
                          ? 'Descreva a sua abordagem, experiência e o que inclui...'
                          : 'Décrivez votre approche, expérience et ce qui est inclus...'}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all resize-none"
                      />
                    </div>

                    {/* Materials toggle */}
                    <div className="mb-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div
                          className={`w-12 h-7 rounded-full transition-all relative ${bidMaterials ? 'bg-yellow-500' : 'bg-gray-200'}`}
                          onClick={() => setBidMaterials(!bidMaterials)}
                        >
                          <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${bidMaterials ? 'left-5.5' : 'left-0.5'}`} />
                        </div>
                        <span className="text-sm text-gray-700">
                          {isPt ? 'Materiais incluídos' : 'Matériaux inclus'}
                        </span>
                      </label>
                    </div>

                    {/* Guarantee */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {isPt ? 'Garantia (opcional)' : 'Garantie (optionnel)'}
                      </label>
                      <input
                        type="text"
                        value={bidGuarantee}
                        onChange={e => setBidGuarantee(e.target.value)}
                        placeholder={isPt ? 'Ex: 2 anos' : 'Ex : 2 ans'}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { setShowBidForm(false); setBidError('') }}
                        className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-full px-4 py-3 transition-all"
                      >
                        {isPt ? 'Cancelar' : 'Annuler'}
                      </button>
                      <button
                        type="submit"
                        disabled={bidSubmitting}
                        className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-full px-4 py-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                      >
                        {bidSubmitting
                          ? (isPt ? 'A enviar...' : 'Envoi...')
                          : (isPt ? 'Enviar proposta' : 'Envoyer la proposition')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── MAIN LIST VIEW ───────────────────────────────────
  const wonBids = myBids.filter(b => b.status === 'accepted')

  return (
    <div className="p-6 lg:p-8 animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#0D1B2E] mb-2">
          🏛️ {isPt ? 'Bolsa de Mercados' : 'Bourse aux Marchés'}
        </h1>
        <p className="text-gray-500">
          {isPt
            ? 'Encontre e candidate-se a oportunidades de trabalho publicadas por síndicos e empresas.'
            : 'Trouvez et postulez aux opportunités de travaux publiées par des syndics et entreprises.'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-2xl shadow-sm border border-yellow-200 bg-yellow-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700 font-medium">
                {isPt ? 'Mercados abertos' : 'Marchés ouverts'}
              </p>
              <p className="text-3xl font-bold text-[#0D1B2E] mt-1">{stats.openCount}</p>
            </div>
            <div className="text-3xl">📋</div>
          </div>
        </div>
        <div className="rounded-2xl shadow-sm border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">
                {isPt ? 'Minhas candidaturas' : 'Mes candidatures'}
              </p>
              <p className="text-3xl font-bold text-[#0D1B2E] mt-1">{stats.activeBids}</p>
            </div>
            <div className="text-3xl">📝</div>
          </div>
        </div>
        <div className="rounded-2xl shadow-sm border border-green-200 bg-green-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium">
                {isPt ? 'Contratos ganhos' : 'Contrats gagnés'}
              </p>
              <p className="text-3xl font-bold text-[#0D1B2E] mt-1">{stats.wonCount}</p>
            </div>
            <div className="text-3xl">🏆</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-full p-1 mb-6 max-w-fit overflow-x-auto">
        {([
          { key: 'browse' as const, labelFr: 'Marchés', labelPt: 'Mercados' },
          { key: 'mybids' as const, labelFr: 'Mes candidatures', labelPt: 'Candidaturas' },
          { key: 'won' as const, labelFr: 'Gagnés', labelPt: 'Ganhos' },
          { key: 'settings' as const, labelFr: 'Paramètres', labelPt: 'Configurações' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-white text-[#0D1B2E] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {isPt ? tab.labelPt : tab.labelFr}
          </button>
        ))}
      </div>

      {/* ─── BROWSE TAB ─────────────────────────────── */}
      {activeTab === 'browse' && (
        <div>
          {/* Alerts banner */}
          {(alerts.expiringCount > 0 || alerts.unreadMessages > 0) && (
            <div className="mb-4 flex flex-wrap gap-3">
              {alerts.expiringCount > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
                  <span>&#x23F0;</span>
                  {isPt
                    ? `${alerts.expiringCount} mercado${alerts.expiringCount > 1 ? 's' : ''} expira${alerts.expiringCount > 1 ? 'm' : ''} nos próximos 3 dias`
                    : `${alerts.expiringCount} marché${alerts.expiringCount > 1 ? 's' : ''} expire${alerts.expiringCount > 1 ? 'nt' : ''} dans les 3 prochains jours`}
                </div>
              )}
              {alerts.unreadMessages > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700">
                  <span>&#x1F4AC;</span>
                  {isPt
                    ? `Tem ${alerts.unreadMessages} mensagen${alerts.unreadMessages > 1 ? 's' : ''} não lida${alerts.unreadMessages > 1 ? 's' : ''}`
                    : `Vous avez ${alerts.unreadMessages} message${alerts.unreadMessages > 1 ? 's' : ''} non lu${alerts.unreadMessages > 1 ? 's' : ''}`}
                </div>
              )}
            </div>
          )}

          {/* Opt-in info banner */}
          {prefsLoaded && !marchesPrefs.marches_opt_in && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
              <span className="text-2xl">💡</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">
                  {isPt
                    ? 'Ative a bolsa de mercados nas configurações para receber mercados personalizados'
                    : 'Activez la bourse aux marchés dans les paramètres pour recevoir des marchés personnalisés'}
                </p>
              </div>
              <button
                onClick={() => setActiveTab('settings')}
                className="shrink-0 bg-amber-200 hover:bg-amber-300 text-amber-900 font-semibold rounded-full px-4 py-2 text-sm transition-all"
              >
                {isPt ? 'Configurações' : 'Paramètres'} →
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none min-w-[180px]"
            >
              <option value="">{isPt ? 'Todas as categorias' : 'Toutes les catégories'}</option>
              {CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.emoji} {isPt ? cat.label : cat.labelFr}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              placeholder={isPt ? '📍 Cidade...' : '📍 Ville...'}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none min-w-[160px]"
            />

            <select
              value={filterUrgency}
              onChange={e => setFilterUrgency(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none min-w-[150px]"
            >
              <option value="">{isPt ? 'Urgência' : 'Urgence'}</option>
              <option value="normal">🟢 Normal</option>
              <option value="urgent">🟡 {isPt ? 'Urgente' : 'Urgent'}</option>
              <option value="emergency">🔴 {isPt ? 'Emergência' : 'Urgence'}</option>
            </select>

            {(filterCategory || filterCity || filterUrgency) && (
              <button
                onClick={() => { setFilterCategory(''); setFilterCity(''); setFilterUrgency('') }}
                className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
              >
                ✕ {isPt ? 'Limpar filtros' : 'Effacer les filtres'}
              </button>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-3 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Empty state */}
          {!loading && marches.length === 0 && (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-bold text-[#0D1B2E] mb-2">
                {isPt ? 'Nenhum mercado encontrado' : 'Aucun marché trouvé'}
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {isPt
                  ? 'Não há mercados disponíveis com os filtros selecionados. Tente ajustar os critérios ou volte mais tarde.'
                  : 'Aucun marché disponible avec les filtres sélectionnés. Essayez d\'ajuster les critères ou revenez plus tard.'}
              </p>
            </div>
          )}

          {/* Cards grid */}
          {!loading && marches.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {marches.map((m) => {
                const days = m.deadline ? daysRemaining(m.deadline) : null
                const maxCand = m.max_candidatures || 5
                const currentCand = m.candidatures_count || 0
                const isFull = currentCand >= maxCand
                const WORK_MODE_LABELS: Record<string, { emoji: string; fr: string; pt: string }> = {
                  forfait: { emoji: '💼', fr: 'Forfait', pt: 'Forfait' },
                  journee: { emoji: '📅', fr: 'Journée', pt: 'Por dia' },
                  horaire: { emoji: '⏰', fr: 'Horaire', pt: 'Por hora' },
                  tache: { emoji: '✅', fr: 'Tâche', pt: 'Por tarefa' },
                }
                const workMode = m.preferred_work_mode ? WORK_MODE_LABELS[m.preferred_work_mode] : null

                return (
                  <button
                    key={m.id}
                    onClick={() => !isFull && setSelectedMarche(m)}
                    disabled={isFull}
                    className={`text-left rounded-2xl shadow-sm border p-6 transition-all group ${
                      isFull
                        ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                        : 'border-gray-200 bg-white hover:shadow-md hover:border-yellow-300'
                    }`}
                  >
                    {/* Badges row */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 text-xs font-semibold">
                        {getCategoryLabel(m.category, isPt)}
                      </span>
                      {urgencyBadge(m.urgency, isPt)}
                      {isFull && (
                        <span className="bg-gray-200 text-gray-600 rounded-full px-3 py-1 text-xs font-semibold">
                          {isPt ? 'Completo' : 'Complet'}
                        </span>
                      )}
                      {workMode && (
                        <span className="bg-indigo-100 text-indigo-700 rounded-full px-3 py-1 text-xs font-semibold">
                          {workMode.emoji} {isPt ? workMode.pt : workMode.fr}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className={`font-bold text-[#0D1B2E] mb-2 line-clamp-2 transition-colors ${!isFull ? 'group-hover:text-[#C9A84C]' : ''}`}>
                      {m.title}
                    </h3>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-3">
                      {m.city && <span className="flex items-center gap-1">📍 {m.city}</span>}
                      {m.distance != null && (
                        <span className="flex items-center gap-1 text-blue-600 font-medium">
                          📍 {m.distance < 1 ? `${Math.round(m.distance * 1000)}m` : `${m.distance.toFixed(1)} km`}
                        </span>
                      )}
                      {days !== null && (
                        <span className={`flex items-center gap-1 ${days <= 3 ? 'text-red-500 font-semibold' : ''}`}>
                          ⏰ {days > 0
                            ? (isPt ? `${days}d` : `${days}j`)
                            : (isPt ? 'Expirado' : 'Expiré')}
                        </span>
                      )}
                    </div>

                    {/* Availability info */}
                    {m.artisan_dispo_info && (
                      <div className="mb-2">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 rounded-full px-2.5 py-1">
                          &#x1F4C5; {m.artisan_dispo_info.available_now
                            ? (isPt ? 'Disponível imediatamente' : 'Disponible immédiatement')
                            : m.artisan_dispo_info.available_from
                              ? (isPt
                                ? `Disponível a partir de ${new Date(m.artisan_dispo_info.available_from).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}`
                                : `Disponible à partir du ${new Date(m.artisan_dispo_info.available_from).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`)
                              : (isPt ? 'Disponibilidade a confirmar' : 'Disponibilité à confirmer')}
                        </span>
                      </div>
                    )}

                    {/* Places remaining progress */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>{currentCand}/{maxCand} {isPt ? 'candidaturas' : 'candidatures'}</span>
                        {!isFull && <span className="text-green-600 font-medium">{maxCand - currentCand} {isPt ? 'vagas' : 'places'}</span>}
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isFull ? 'bg-gray-400' : currentCand / maxCand > 0.7 ? 'bg-orange-400' : 'bg-green-400'}`}
                          style={{ width: `${Math.min(100, (currentCand / maxCand) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Requirements badges */}
                    {(m.require_rc_pro || m.require_decennale || m.require_rge || m.require_qualibat) && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {m.require_rc_pro && <span className="bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 text-[10px] font-semibold">🛡️ RC Pro</span>}
                        {m.require_decennale && <span className="bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 text-[10px] font-semibold">🏗️ {isPt ? 'Decenal' : 'Décennale'}</span>}
                        {m.require_rge && <span className="bg-green-50 text-green-700 rounded-full px-2 py-0.5 text-[10px] font-semibold">🌿 RGE</span>}
                        {m.require_qualibat && <span className="bg-purple-50 text-purple-700 rounded-full px-2 py-0.5 text-[10px] font-semibold">🏅 QualiBAT</span>}
                      </div>
                    )}

                    {/* Budget */}
                    <div className="mb-3">
                      {(m.budget_min || m.budget_max) ? (
                        <span className="text-sm font-semibold text-[#0D1B2E]">
                          💰 {m.budget_min ? formatPrice(m.budget_min, locale) : '—'}
                          {' - '}
                          {m.budget_max ? formatPrice(m.budget_max, locale) : '—'}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 italic">
                          {isPt ? 'Orçamento não definido' : 'Budget non défini'}
                        </span>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        {publisherBadge(m.publisher_type, isPt)}
                      </div>
                      <span className="text-xs text-gray-400">
                        👥 {currentCand} {isPt ? 'candidaturas' : 'candidatures'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── MY BIDS TAB ────────────────────────────── */}
      {activeTab === 'mybids' && (
        <div>
          {myBids.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-bold text-[#0D1B2E] mb-2">
                {isPt ? 'Nenhuma candidatura' : 'Aucune candidature'}
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                {isPt
                  ? 'Ainda não se candidatou a nenhum mercado. Explore os mercados abertos e envie a sua primeira proposta!'
                  : 'Vous n\'avez pas encore postulé à un marché. Explorez les marchés ouverts et envoyez votre première proposition !'}
              </p>
              <button
                onClick={() => setActiveTab('browse')}
                className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-full px-6 py-3 transition-all hover:scale-105"
              >
                {isPt ? 'Explorar mercados' : 'Explorer les marchés'} →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myBids.map((bid) => (
                <div
                  key={bid.id}
                  className="rounded-2xl shadow-sm border border-gray-200 p-5 bg-white hover:shadow-md transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 text-xs font-semibold">
                          {getCategoryEmoji(bid.marche_category || bid.category)} {isPt
                            ? CATEGORIES.find(c => c.id === (bid.marche_category || bid.category))?.label
                            : CATEGORIES.find(c => c.id === (bid.marche_category || bid.category))?.labelFr
                          }
                        </span>
                        {statusBadge(bid.status, isPt)}
                      </div>
                      <h3 className="font-bold text-[#0D1B2E] mb-1">
                        {bid.marche_title || bid.title || (isPt ? 'Mercado' : 'Marché')}
                      </h3>
                      {bid.marche_city && (
                        <p className="text-sm text-gray-500">📍 {bid.marche_city}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[#0D1B2E]">
                        {formatPrice(bid.price, locale)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {isPt ? 'Prazo:' : 'Délai :'} {bid.timeline || '—'}
                      </p>
                      {bid.materials_included && (
                        <span className="text-xs text-green-600 font-medium">
                          ✓ {isPt ? 'Materiais incluídos' : 'Matériaux inclus'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── WON CONTRACTS TAB ──────────────────────── */}
      {activeTab === 'won' && (
        <div>
          {wonBids.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🏆</div>
              <h3 className="text-xl font-bold text-[#0D1B2E] mb-2">
                {isPt ? 'Nenhum contrato ganho ainda' : 'Aucun contrat remporté pour l\'instant'}
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                {isPt
                  ? 'Continue a candidatar-se aos mercados. Os seus contratos ganhos aparecerão aqui.'
                  : 'Continuez à postuler aux marchés. Vos contrats remportés apparaîtront ici.'}
              </p>
              <button
                onClick={() => setActiveTab('browse')}
                className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-full px-6 py-3 transition-all hover:scale-105"
              >
                {isPt ? 'Ver mercados' : 'Voir les marchés'} →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {wonBids.map((bid) => (
                <div
                  key={bid.id}
                  className="rounded-2xl shadow-sm border border-green-200 bg-green-50/50 p-6 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="bg-green-100 text-green-700 rounded-full px-3 py-1 text-xs font-semibold">
                          ✅ {isPt ? 'Contrato ganho' : 'Contrat remporté'}
                        </span>
                        <span className="bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 text-xs font-semibold">
                          {getCategoryLabel(bid.marche_category || bid.category, isPt)}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-[#0D1B2E] mb-2">
                        {bid.marche_title || bid.title || (isPt ? 'Mercado' : 'Marché')}
                      </h3>
                      {bid.marche_city && (
                        <p className="text-sm text-gray-500 mb-2">📍 {bid.marche_city}</p>
                      )}
                      {bid.marche_description && (
                        <p className="text-sm text-gray-600 line-clamp-3">{bid.marche_description}</p>
                      )}
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-green-100 min-w-[200px]">
                      <p className="text-sm text-gray-500 mb-1">{isPt ? 'O seu preço' : 'Votre prix'}</p>
                      <p className="text-2xl font-bold text-green-600 mb-3">
                        {formatPrice(bid.price, locale)}
                      </p>
                      {bid.publisher_contact && (
                        <div className="border-t border-green-100 pt-3 mt-3">
                          <p className="text-xs text-gray-500 mb-1">{isPt ? 'Contacto' : 'Contact'}</p>
                          <p className="text-sm font-medium text-[#0D1B2E]">{bid.publisher_contact.name}</p>
                          {bid.publisher_contact.email && (
                            <a
                              href={`mailto:${bid.publisher_contact.email}`}
                              className="text-sm text-blue-600 hover:underline"
                            >
                              {bid.publisher_contact.email}
                            </a>
                          )}
                          {bid.publisher_contact.phone && (
                            <p className="text-sm text-gray-600">{bid.publisher_contact.phone}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Evaluation section for won contracts */}
                  <div className="mt-4 border-t border-green-100 pt-4">
                    {/* Received evaluation from publisher */}
                    {receivedEval[bid.marche_id] && (
                      <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 p-4">
                        <p className="text-sm font-semibold text-blue-800 mb-2">
                          &#x2B50; {isPt ? 'Avaliação recebida do cliente' : 'Évaluation reçue du donneur d\'ordre'}
                        </p>
                        <div className="flex items-center gap-1 mb-1">
                          {[1, 2, 3, 4, 5].map(s => (
                            <span key={s} className={`text-lg ${s <= receivedEval[bid.marche_id].note_globale ? 'text-yellow-500' : 'text-gray-300'}`}>
                              &#x2605;
                            </span>
                          ))}
                          <span className="ml-2 text-sm font-bold text-gray-900">{receivedEval[bid.marche_id].note_globale}/5</span>
                        </div>
                        {receivedEval[bid.marche_id].comment && (
                          <p className="text-sm text-gray-600 italic mt-1">&quot;{receivedEval[bid.marche_id].comment}&quot;</p>
                        )}
                      </div>
                    )}

                    {/* Evaluate this mission */}
                    {evalBidId === bid.id ? (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                        <p className="text-sm font-semibold text-amber-800 mb-3">
                          {isPt ? 'Avaliar esta missão' : 'Évaluer cette mission'}
                        </p>
                        <div className="flex items-center gap-1 mb-3">
                          {[1, 2, 3, 4, 5].map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setEvalRating(s)}
                              className={`text-2xl transition-all hover:scale-110 ${s <= evalRating ? 'text-yellow-500' : 'text-gray-300'}`}
                            >
                              &#x2605;
                            </button>
                          ))}
                          {evalRating > 0 && <span className="ml-2 text-sm font-bold text-gray-700">{evalRating}/5</span>}
                        </div>
                        <textarea
                          value={evalComment}
                          onChange={e => setEvalComment(e.target.value)}
                          rows={3}
                          placeholder={isPt ? 'Comentário (opcional)...' : 'Commentaire (optionnel)...'}
                          className="w-full border border-amber-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all resize-none mb-3 bg-white"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setEvalBidId(null); setEvalRating(0); setEvalComment('') }}
                            className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-full px-4 py-2.5 text-sm transition-all"
                          >
                            {isPt ? 'Cancelar' : 'Annuler'}
                          </button>
                          <button
                            type="button"
                            onClick={() => submitEvaluation(bid.marche_id)}
                            disabled={evalRating < 1 || evalSubmitting}
                            className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-full px-4 py-2.5 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                          >
                            {evalSubmitting
                              ? (isPt ? 'A enviar...' : 'Envoi...')
                              : (isPt ? 'Enviar avaliação' : 'Envoyer l\'évaluation')}
                          </button>
                        </div>
                      </div>
                    ) : evalSuccess ? (
                      <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                        <p className="text-sm font-semibold text-green-700">
                          &#x2705; {isPt ? 'Avaliação enviada com sucesso!' : 'Évaluation envoyée avec succès !'}
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEvalBidId(bid.id)
                          loadReceivedEvaluation(bid.marche_id)
                        }}
                        className="w-full text-center border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold rounded-full px-4 py-2.5 text-sm transition-all"
                      >
                        &#x2B50; {isPt ? 'Avaliar esta missão' : 'Évaluer cette mission'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── SETTINGS TAB ─────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl">
          <div className="space-y-8">
            {/* 1. Opt-in toggle */}
            <div className="rounded-2xl shadow-sm border border-gray-200 p-6 bg-white">
              <h3 className="font-bold text-[#0D1B2E] mb-4 text-lg">
                {isPt ? 'Receber propostas de mercados' : 'Recevoir des propositions de marchés'}
              </h3>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setMarchesPrefs(p => ({ ...p, marches_opt_in: !p.marches_opt_in }))}
                  className={`relative w-14 h-8 rounded-full transition-all ${marchesPrefs.marches_opt_in ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${marchesPrefs.marches_opt_in ? 'left-7' : 'left-1'}`} />
                </button>
                <span className={`text-sm font-semibold ${marchesPrefs.marches_opt_in ? 'text-green-600' : 'text-gray-500'}`}>
                  {marchesPrefs.marches_opt_in
                    ? (isPt ? 'Ativado' : 'Activé')
                    : (isPt ? 'Desativado' : 'Désactivé')}
                </span>
              </div>
              {!marchesPrefs.marches_opt_in && (
                <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm text-gray-500">
                  {isPt
                    ? 'Não receberá notificações para novos mercados'
                    : 'Vous ne recevrez plus de notifications pour les nouveaux marchés'}
                </div>
              )}
            </div>

            {/* 2. Categories checkboxes */}
            <div className={`rounded-2xl shadow-sm border border-gray-200 p-6 bg-white transition-opacity ${!marchesPrefs.marches_opt_in ? 'opacity-50 pointer-events-none' : ''}`}>
              <h3 className="font-bold text-[#0D1B2E] mb-4 text-lg">
                {isPt ? 'As minhas especialidades' : 'Mes spécialités'}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {isPt
                  ? 'Selecione as categorias de trabalho que lhe interessam'
                  : 'Sélectionnez les catégories de travaux qui vous intéressent'}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CATEGORIES.map(cat => {
                  const checked = marchesPrefs.marches_categories.includes(cat.id)
                  return (
                    <label
                      key={cat.id}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition-all text-sm ${
                        checked
                          ? 'border-yellow-400 bg-yellow-50 text-[#0D1B2E]'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setMarchesPrefs(p => ({
                            ...p,
                            marches_categories: checked
                              ? p.marches_categories.filter(c => c !== cat.id)
                              : [...p.marches_categories, cat.id],
                          }))
                        }}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                        checked ? 'bg-yellow-500 border-yellow-500' : 'border-gray-300 bg-white'
                      }`}>
                        {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span>{cat.emoji} {isPt ? cat.label : cat.labelFr}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* 3. Work mode radio */}
            <div className={`rounded-2xl shadow-sm border border-gray-200 p-6 bg-white transition-opacity ${!marchesPrefs.marches_opt_in ? 'opacity-50 pointer-events-none' : ''}`}>
              <h3 className="font-bold text-[#0D1B2E] mb-4 text-lg">
                {isPt ? 'O meu modo de trabalho' : 'Mon mode de travail'}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'forfait', emoji: '💼', fr: 'Forfait', pt: 'Forfait', desc_fr: 'Prix fixe pour la mission', desc_pt: 'Preço fixo para a missão' },
                  { value: 'journee', emoji: '📅', fr: 'À la journée', pt: 'Por dia', desc_fr: 'Tarif journalier', desc_pt: 'Tarifa diária' },
                  { value: 'horaire', emoji: '⏰', fr: 'À l\'heure', pt: 'Por hora', desc_fr: 'Tarif horaire', desc_pt: 'Tarifa por hora' },
                  { value: 'tache', emoji: '✅', fr: 'À la tâche', pt: 'Por tarefa', desc_fr: 'Prix défini par candidature', desc_pt: 'Preço definido por candidatura' },
                ] as const).map(mode => {
                  const selected = marchesPrefs.marches_work_mode === mode.value
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setMarchesPrefs(p => ({ ...p, marches_work_mode: mode.value }))}
                      className={`flex flex-col items-start gap-1 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                        selected
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <span className="text-lg">{mode.emoji}</span>
                      <span className={`text-sm font-semibold ${selected ? 'text-[#0D1B2E]' : 'text-gray-700'}`}>
                        {isPt ? mode.pt : mode.fr}
                      </span>
                      <span className="text-xs text-gray-400">{isPt ? mode.desc_pt : mode.desc_fr}</span>
                    </button>
                  )
                })}
              </div>

              {/* Tariff inputs based on work mode */}
              {marchesPrefs.marches_work_mode === 'journee' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isPt ? 'Tarifa diária (€)' : 'Tarif journalier (€)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={marchesPrefs.marches_tarif_journalier ?? ''}
                    onChange={e => setMarchesPrefs(p => ({ ...p, marches_tarif_journalier: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="ex: 350"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
                  />
                </div>
              )}
              {marchesPrefs.marches_work_mode === 'horaire' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isPt ? 'Tarifa por hora (€)' : 'Tarif horaire (€)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={marchesPrefs.marches_tarif_horaire ?? ''}
                    onChange={e => setMarchesPrefs(p => ({ ...p, marches_tarif_horaire: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="ex: 45"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
                  />
                </div>
              )}
            </div>

            {/* 4. Description textarea */}
            <div className={`rounded-2xl shadow-sm border border-gray-200 p-6 bg-white transition-opacity ${!marchesPrefs.marches_opt_in ? 'opacity-50 pointer-events-none' : ''}`}>
              <h3 className="font-bold text-[#0D1B2E] mb-4 text-lg">
                {isPt ? 'Apresentação bolsa de mercados' : 'Présentation bourse aux marchés'}
              </h3>
              <textarea
                value={marchesPrefs.marches_description}
                onChange={e => setMarchesPrefs(p => ({ ...p, marches_description: e.target.value.slice(0, 2000) }))}
                rows={5}
                maxLength={2000}
                placeholder={isPt
                  ? 'Descreva a sua empresa, experiência e competências principais...'
                  : 'Décrivez votre entreprise, expérience et compétences principales...'}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all resize-none"
              />
              <p className="mt-1 text-xs text-gray-400 text-right">
                {marchesPrefs.marches_description.length}/2000
              </p>
            </div>

            {/* Save button */}
            <button
              type="button"
              onClick={saveMarchesPrefs}
              disabled={prefsSaving}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-full px-8 py-3.5 text-base transition-all hover:scale-[1.02] shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {prefsSaving
                ? (isPt ? 'A guardar...' : 'Enregistrement...')
                : (isPt ? 'Guardar preferências' : 'Enregistrer les préférences')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
