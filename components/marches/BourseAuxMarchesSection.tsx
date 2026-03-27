'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { formatPrice } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface Props {
  artisan: any
  orgRole?: OrgRole
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

function urgencyTag(urgency: string, isPt: boolean) {
  switch (urgency) {
    case 'emergency':
      return <span className="v22-tag v22-tag-red">🔴 {isPt ? 'Emergência' : 'Urgence'}</span>
    case 'urgent':
      return <span className="v22-tag v22-tag-amber">🟡 {isPt ? 'Urgente' : 'Urgent'}</span>
    default:
      return <span className="v22-tag v22-tag-green">🟢 {isPt ? 'Normal' : 'Normal'}</span>
  }
}

function statusTag(status: string, isPt: boolean) {
  switch (status) {
    case 'accepted':
      return <span className="v22-tag v22-tag-green">✅ {isPt ? 'Aceite' : 'Accepté'}</span>
    case 'rejected':
      return <span className="v22-tag v22-tag-red">❌ {isPt ? 'Recusado' : 'Refusé'}</span>
    case 'withdrawn':
      return <span className="v22-tag v22-tag-gray">↩️ {isPt ? 'Retirado' : 'Retiré'}</span>
    default:
      return <span className="v22-tag v22-tag-yellow">⏳ {isPt ? 'Pendente' : 'En attente'}</span>
  }
}

function publisherTag(type: string, isPt: boolean) {
  switch (type) {
    case 'syndic':
      return <span className="v22-tag" style={{ background: '#E8F0FE', color: '#1A56DB' }}>🏢 Syndic</span>
    case 'entreprise':
      return <span className="v22-tag" style={{ background: '#F3E8FF', color: '#7C3AED' }}>🏭 {isPt ? 'Empresa' : 'Entreprise'}</span>
    default:
      return <span className="v22-tag v22-tag-gray">👤 {isPt ? 'Particular' : 'Particulier'}</span>
  }
}

// Fake data for blurred preview behind pro gate
const FAKE_MARCHES = [
  { title: 'Rénovation cage d\'escalier immeuble 12 lots', category: 'renovacao', budget_min: 8000, budget_max: 15000, city: 'Porto', urgency: 'normal' },
  { title: 'Remplacement chaudière collective', category: 'canalizacao', budget_min: 5000, budget_max: 12000, city: 'Lisboa', urgency: 'urgent' },
  { title: 'Ravalement façade bâtiment B', category: 'construcao', budget_min: 20000, budget_max: 45000, city: 'Marseille', urgency: 'normal' },
]

export default function BourseAuxMarchesSection({ artisan, orgRole = 'artisan', navigateTo }: Props) {
  const isSociete = orgRole === 'pro_societe'
  // Detect locale
  const [locale, setLocale] = useState('fr')
  useEffect(() => {
    const match = document.cookie.match(/locale=(\w+)/)
    if (match) setLocale(match[1])
  }, [])
  const isPt = locale === 'pt'

  // PRO GATE CHECK — vérifie l'abonnement via la table subscriptions
  const [isPro, setIsPro] = useState(false)
  useEffect(() => {
    if (!artisan?.user_id) return
    const checkSub = async () => {
      try {
        const res = await fetch(`/api/stripe/subscription`, {
          headers: { 'Authorization': `Bearer ${(await (await import('@/lib/supabase')).supabase.auth.getSession()).data.session?.access_token}` }
        })
        if (res.ok) {
          const data = await res.json()
          const plan = data.subscription?.subscription_plan || data.plan || 'starter'
          setIsPro(plan !== 'starter')
        } else {
          setIsPro(false)
        }
      } catch {
        setIsPro(false)
      }
    }
    checkSub()
  }, [artisan?.user_id])

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
  const [filterGrandMarche, setFilterGrandMarche] = useState(false)   // pro_societe: budget ≥ 50k
  const [filterBTP, setFilterBTP] = useState(false)                  // Offres sous-traitance BTP

  // Bid form state
  const [bidPrice, setBidPrice] = useState('')
  const [bidTimeline, setBidTimeline] = useState('')
  const [bidDescription, setBidDescription] = useState('')
  const [bidMaterials, setBidMaterials] = useState(false)
  const [bidGuarantee, setBidGuarantee] = useState('')
  const [bidEffectif, setBidEffectif] = useState('')   // pro_societe: nombre de compagnons
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
      if (filterGrandMarche) params.set('budget_min', '50000')
      if (filterBTP) params.set('source_type', 'btp_sous_traitance')
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
  }, [isPro, filterCategory, filterCity, filterUrgency, filterGrandMarche, filterBTP])

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
          sender_name: artisan?.company_name || artisan?.email || 'Artisan',
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
  const submitEvaluation = async (marcheId: string, candidatureId: string) => {
    if (evalRating < 1 || evalSubmitting) return
    setEvalSubmitting(true)
    try {
      const res = await fetch(`/api/marches/${marcheId}/evaluation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidature_id: candidatureId,
          evaluator_type: 'artisan',
          note_globale: evalRating,
          commentaire: evalComment.trim() || undefined,
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

  // Realtime listener for marche notifications
  const realtimeErrorCount = useRef(0)
  useEffect(() => {
    if (!artisan?.user_id) return
    const channel = supabase
      .channel(`marches_notifs_${artisan.user_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'artisan_notifications',
        filter: `artisan_id=eq.${artisan.user_id}`,
      }, (payload) => {
        const n = payload.new as any
        if (n.type?.startsWith('marche_')) {
          // Auto-refresh marches and bids
          fetchMarches()
          fetchMyBids()
        }
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[BourseAuxMarches] Realtime error:', err?.message)
          realtimeErrorCount.current += 1
          if (realtimeErrorCount.current >= 3) {
            console.warn('[BourseAuxMarches] Too many errors, unsubscribing')
            supabase.removeChannel(channel)
          }
        }
      })
    return () => { supabase.removeChannel(channel) }
  }, [artisan?.user_id, fetchMarches, fetchMyBids])

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
          effectif: bidEffectif ? parseInt(bidEffectif) : null,
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
      setBidEffectif('')
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
      <div style={{ padding: 14 }}>
        <div style={{ position: 'relative' }}>
          {/* Blurred fake preview */}
          <div style={{ filter: 'blur(4px)', opacity: 0.6, pointerEvents: 'none', userSelect: 'none' }} aria-hidden="true">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
              {FAKE_MARCHES.map((fm, i) => (
                <div key={i} className="v22-card" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span className="v22-tag v22-tag-yellow">
                      {getCategoryLabel(fm.category, isPt)}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{fm.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginBottom: 6 }}>📍 {fm.city}</div>
                  <div className="v22-mono" style={{ fontSize: 12, fontWeight: 500 }}>
                    {formatPrice(fm.budget_min, locale)} - {formatPrice(fm.budget_max, locale)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Overlay CTA */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="v22-card" style={{ padding: '28px 32px', maxWidth: 440, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏛️</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                {isPt ? 'Bolsa de Mercados' : 'Bourse aux Marchés'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
                {isPt
                  ? 'Aceda a dezenas de concursos publicados por síndicos, empresas e particulares. Candidate-se diretamente e ganhe novos contratos.'
                  : 'Accédez à des dizaines d\'appels d\'offres publiés par des syndics, entreprises et particuliers. Postulez directement et remportez de nouveaux contrats.'}
              </div>
              <button
                onClick={() => navigateTo('tarifs')}
                className="v22-btn v22-btn-primary"
                style={{ padding: '8px 24px', fontSize: 13 }}
              >
                {isPt ? 'Atualizar para Pro' : 'Passer au Pro'} ✨
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── DETAIL VIEW (MODAL) ──────────────────────────────
  if (selectedMarche) {
    const days = selectedMarche.deadline ? daysRemaining(selectedMarche.deadline) : null
    const photos: string[] = selectedMarche.photos || []

    return (
      <div className="v22-modal-overlay" onClick={resetDetail}>
        <div className="v22-modal" style={{ width: 680, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
          {/* Modal head */}
          <div className="v22-modal-head">
            <div className="v22-modal-title">
              {isPt ? 'Detalhe do mercado' : 'Détail du marché'}
            </div>
            <button className="v22-modal-close" onClick={resetDetail}>✕</button>
          </div>

          {/* Modal body */}
          <div className="v22-modal-body">
            {/* Tags row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              <span className="v22-tag v22-tag-yellow">
                {getCategoryLabel(selectedMarche.category, isPt)}
              </span>
              {urgencyTag(selectedMarche.urgency, isPt)}
              {publisherTag(selectedMarche.publisher_type, isPt)}
            </div>

            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{selectedMarche.title}</div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, color: 'var(--v22-text-muted)', marginBottom: 12 }}>
              {selectedMarche.city && (
                <span>📍 {selectedMarche.city}</span>
              )}
              {days !== null && (
                <span>
                  ⏰ {days > 0
                    ? (isPt ? `${days} dias restantes` : `${days} jours restants`)
                    : (isPt ? 'Prazo expirado' : 'Délai expiré')}
                </span>
              )}
              {selectedMarche.candidatures_count !== undefined && (
                <span>
                  👥 {selectedMarche.candidatures_count} {isPt ? 'candidaturas' : 'candidatures'}
                </span>
              )}
            </div>

            {/* Budget */}
            {(selectedMarche.budget_min || selectedMarche.budget_max) ? (
              <div style={{ background: 'var(--v22-yellow-light)', borderRadius: 3, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="v22-mono">
                  {isPt ? 'Orçamento' : 'Budget'}
                </div>
                <div className="v22-mono" style={{ fontSize: 16, fontWeight: 600 }}>
                  {selectedMarche.budget_min ? formatPrice(selectedMarche.budget_min, locale) : '—'}
                  {' — '}
                  {selectedMarche.budget_max ? formatPrice(selectedMarche.budget_max, locale) : '—'}
                </div>
              </div>
            ) : (
              <div style={{ background: 'var(--v22-bg)', borderRadius: 3, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: 'var(--v22-text-muted)', fontStyle: 'italic' }}>
                {isPt ? 'Orçamento não definido' : 'Budget non défini'}
              </div>
            )}

            {/* Description */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{isPt ? 'Descrição' : 'Description'}</div>
              <div style={{ fontSize: 12, color: 'var(--v22-text-mid)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {selectedMarche.description || (isPt ? 'Sem descrição.' : 'Aucune description.')}
              </div>
            </div>

            {/* Photos gallery */}
            {photos.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{isPt ? 'Fotos' : 'Photos'} ({photos.length})</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {photos.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPhotoIdx(idx)}
                      style={{ aspectRatio: '1', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--v22-border)', cursor: 'pointer', padding: 0, background: 'none' }}
                    >
                      <img src={url} alt={`Photo ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>

                {/* Lightbox */}
                {selectedPhotoIdx !== null && (
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                    onClick={() => setSelectedPhotoIdx(null)}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedPhotoIdx(null) }}
                      style={{ position: 'absolute', top: 16, right: 16, color: '#fff', fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', zIndex: 301 }}
                    >
                      ✕
                    </button>
                    {selectedPhotoIdx > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedPhotoIdx(selectedPhotoIdx - 1) }}
                        style={{ position: 'absolute', left: 16, color: '#fff', fontSize: 32, background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        ‹
                      </button>
                    )}
                    {selectedPhotoIdx < photos.length - 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedPhotoIdx(selectedPhotoIdx + 1) }}
                        style={{ position: 'absolute', right: 16, color: '#fff', fontSize: 32, background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        ›
                      </button>
                    )}
                    <img
                      src={photos[selectedPhotoIdx]}
                      alt={`Photo ${selectedPhotoIdx + 1}`}
                      style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 4, objectFit: 'contain' }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Message thread */}
            {selectedMarche.my_candidature_id && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                  &#x1F4AC; {isPt ? 'Mensagens' : 'Messages'}
                </div>

                {!msgCandidatureId ? (
                  <button
                    onClick={() => {
                      setMsgCandidatureId(selectedMarche.my_candidature_id)
                      loadMessages(selectedMarche.id, selectedMarche.my_candidature_id)
                    }}
                    className="v22-btn"
                    style={{ width: '100%', textAlign: 'center' }}
                  >
                    {isPt ? 'Abrir conversa com o publicador' : 'Ouvrir la conversation avec le donneur d\'ordre'}
                  </button>
                ) : (
                  <div>
                    {/* Messages list */}
                    <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 10, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {msgLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
                          <div style={{ width: 20, height: 20, border: '2px solid var(--v22-yellow)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        </div>
                      ) : messages.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', textAlign: 'center', padding: '20px 0' }}>
                          {isPt ? 'Nenhuma mensagem ainda. Inicie a conversa!' : 'Aucun message pour l\'instant. Lancez la conversation !'}
                        </div>
                      ) : (
                        messages.map((msg, idx) => (
                          <div
                            key={msg.id || idx}
                            style={{ display: 'flex', justifyContent: msg.sender_type === 'artisan' ? 'flex-end' : 'flex-start' }}
                          >
                            <div style={{
                              maxWidth: '80%', borderRadius: 3, padding: '8px 10px', fontSize: 12,
                              background: msg.sender_type === 'artisan' ? 'var(--v22-yellow-light)' : 'var(--v22-bg)',
                              color: 'var(--v22-text)',
                            }}>
                              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                              <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', marginTop: 4 }}>
                                {new Date(msg.created_at).toLocaleString(isPt ? 'pt-PT' : 'fr-FR', {
                                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Input */}
                    <div style={{ display: 'flex', gap: 8 }}>
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
                        className="v22-form-input"
                        style={{ flex: 1 }}
                      />
                      <button
                        onClick={() => sendMessage(selectedMarche.id, selectedMarche.my_candidature_id)}
                        disabled={!msgInput.trim() || msgSending}
                        className="v22-btn v22-btn-primary"
                        style={{ opacity: (!msgInput.trim() || msgSending) ? 0.5 : 1, cursor: (!msgInput.trim() || msgSending) ? 'not-allowed' : 'pointer' }}
                      >
                        {msgSending ? '...' : (isPt ? 'Enviar' : 'Envoyer')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bid form area */}
            {!showBidForm ? (
              <div style={{ borderTop: '1px solid var(--v22-border)', paddingTop: 14, marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  {isPt ? 'Interessado?' : 'Intéressé ?'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginBottom: 12 }}>
                  {isPt
                    ? 'Envie a sua candidatura com o seu preço e prazo estimado.'
                    : 'Envoyez votre candidature avec votre prix et délai estimé.'}
                </div>
                <button
                  onClick={() => setShowBidForm(true)}
                  className="v22-btn v22-btn-primary"
                  style={{ width: '100%' }}
                >
                  {isPt ? 'Candidatar-me' : 'Postuler'} 🚀
                </button>
              </div>
            ) : bidSuccess ? (
              <div style={{ borderTop: '1px solid var(--v22-border)', paddingTop: 14, marginTop: 14, textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 10 }}>🎉</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v22-green)', marginBottom: 6 }}>
                  {isPt ? 'Candidatura enviada!' : 'Candidature envoyée !'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--v22-text-muted)' }}>
                  {isPt
                    ? 'Receberá uma notificação quando o cliente responder.'
                    : 'Vous recevrez une notification quand le client répondra.'}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitBid} style={{ borderTop: '1px solid var(--v22-border)', paddingTop: 14, marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                  {isPt ? 'A sua proposta' : 'Votre proposition'}
                </div>

                {bidError && (
                  <div className="v22-alert v22-alert-red" style={{ marginBottom: 10, fontSize: 12 }}>{bidError}</div>
                )}

                {/* Price */}
                <div style={{ marginBottom: 10 }}>
                  <label className="v22-form-label">
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
                    className="v22-form-input"
                  />
                </div>

                {/* Timeline */}
                <div style={{ marginBottom: 10 }}>
                  <label className="v22-form-label">
                    {isPt ? 'Prazo estimado' : 'Délai estimé'} *
                  </label>
                  <select
                    required
                    value={bidTimeline}
                    onChange={e => setBidTimeline(e.target.value)}
                    className="v22-form-input"
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
                <div style={{ marginBottom: 10 }}>
                  <label className="v22-form-label">
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
                    className="v22-form-input"
                    style={{ resize: 'none' }}
                  />
                </div>

                {/* Materials toggle */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <div
                      style={{
                        width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
                        background: bidMaterials ? 'var(--v22-yellow)' : 'var(--v22-border)',
                        transition: 'background 0.15s',
                      }}
                      onClick={() => setBidMaterials(!bidMaterials)}
                    >
                      <div style={{
                        position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
                        background: 'var(--v22-surface)', transition: 'left 0.15s',
                        left: bidMaterials ? 18 : 2,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                      }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--v22-text-mid)' }}>
                      {isPt ? 'Materiais incluídos' : 'Matériaux inclus'}
                    </span>
                  </label>
                </div>

                {/* Guarantee */}
                <div style={{ marginBottom: 14 }}>
                  <label className="v22-form-label">
                    {isPt ? 'Garantia (opcional)' : 'Garantie (optionnel)'}
                  </label>
                  <input
                    type="text"
                    value={bidGuarantee}
                    onChange={e => setBidGuarantee(e.target.value)}
                    placeholder={isPt ? 'Ex: 2 anos' : 'Ex : 2 ans'}
                    className="v22-form-input"
                  />
                </div>

                {/* Effectif — pro_societe uniquement */}
                {isSociete && (
                  <div style={{ marginBottom: 14 }}>
                    <label className="v22-form-label">
                      👷 {isPt ? 'Efectivo mobilizável (companheiros)' : 'Effectif mobilisable (compagnons)'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={bidEffectif}
                      onChange={e => setBidEffectif(e.target.value)}
                      placeholder={isPt ? 'Ex: 8' : 'Ex : 8'}
                      className="v22-form-input"
                    />
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setShowBidForm(false); setBidError('') }}
                    className="v22-btn"
                    style={{ flex: 1 }}
                  >
                    {isPt ? 'Cancelar' : 'Annuler'}
                  </button>
                  <button
                    type="submit"
                    disabled={bidSubmitting}
                    className="v22-btn v22-btn-primary"
                    style={{ flex: 1, opacity: bidSubmitting ? 0.5 : 1, cursor: bidSubmitting ? 'not-allowed' : 'pointer' }}
                  >
                    {bidSubmitting
                      ? (isPt ? 'A enviar...' : 'Envoi...')
                      : (isPt ? 'Enviar proposta' : 'Envoyer la proposition')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── MAIN LIST VIEW ───────────────────────────────────
  const wonBids = myBids.filter(b => b.status === 'accepted')

  // Tab definitions
  const tabs = [
    { key: 'browse' as const, labelFr: 'Marchés', labelPt: 'Mercados' },
    { key: 'mybids' as const, labelFr: 'Candidatures', labelPt: 'Candidaturas' },
    { key: 'won' as const, labelFr: 'Gagnés', labelPt: 'Ganhos' },
    { key: 'settings' as const, labelFr: 'Paramètres', labelPt: 'Configurações' },
  ]

  return (
    <div>
      {/* Page header */}
      <div className="v22-page-header" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="v22-page-title">Bourse aux Marchés</div>
          <div className="v22-page-sub">
            {stats.openCount} {isPt ? 'oportunidades disponíveis' : 'opportunités disponibles'}
          </div>
        </div>
        {(filterCategory || filterCity || filterUrgency || filterGrandMarche) && (
          <button
            onClick={() => { setFilterCategory(''); setFilterCity(''); setFilterUrgency(''); setFilterGrandMarche(false) }}
            className="v22-btn v22-btn-sm"
          >
            {isPt ? 'Reiniciar' : 'Réinitialiser'}
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="v22-stats">
        <div className="v22-stat v22-stat-yellow">
          <div className="v22-stat-label">{isPt ? 'Novas' : 'Nouvelles'}</div>
          <div className="v22-stat-val">{stats.openCount}</div>
        </div>
        <div className="v22-stat">
          <div className="v22-stat-label">{isPt ? 'Candidaturas' : 'Candidatures'}</div>
          <div className="v22-stat-val">{stats.activeBids}</div>
        </div>
        <div className="v22-stat">
          <div className="v22-stat-label">{isPt ? 'Orçamento máx' : 'Budget max'}</div>
          <div className="v22-stat-val">
            {marches.length > 0
              ? formatPrice(Math.max(...marches.map(m => m.budget_max || 0)), locale)
              : '—'}
          </div>
        </div>
        <div className="v22-stat">
          <div className="v22-stat-label">{isPt ? 'Prazo urgente' : 'Délai urgent'}</div>
          <div className="v22-stat-val">{marches.filter(m => m.urgency === 'urgent' || m.urgency === 'emergency').length}</div>
        </div>
      </div>

      {/* Tabs row */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--v22-border)', marginBottom: 14 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? 'var(--v22-text)' : 'var(--v22-text-muted)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--v22-yellow)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.1s',
            }}
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {alerts.expiringCount > 0 && (
                <div className="v22-alert v22-alert-red" style={{ fontSize: 12 }}>
                  <span>&#x23F0;</span>
                  <span>
                    {isPt
                      ? `${alerts.expiringCount} mercado${alerts.expiringCount > 1 ? 's' : ''} expira${alerts.expiringCount > 1 ? 'm' : ''} nos próximos 3 dias`
                      : `${alerts.expiringCount} marché${alerts.expiringCount > 1 ? 's' : ''} expire${alerts.expiringCount > 1 ? 'nt' : ''} dans les 3 prochains jours`}
                  </span>
                </div>
              )}
              {alerts.unreadMessages > 0 && (
                <div className="v22-alert v22-alert-amber" style={{ fontSize: 12 }}>
                  <span>&#x1F4AC;</span>
                  <span>
                    {isPt
                      ? `Tem ${alerts.unreadMessages} mensagen${alerts.unreadMessages > 1 ? 's' : ''} não lida${alerts.unreadMessages > 1 ? 's' : ''}`
                      : `Vous avez ${alerts.unreadMessages} message${alerts.unreadMessages > 1 ? 's' : ''} non lu${alerts.unreadMessages > 1 ? 's' : ''}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Opt-in info banner */}
          {prefsLoaded && !marchesPrefs.marches_opt_in && (
            <div className="v22-alert v22-alert-amber" style={{ marginBottom: 14, fontSize: 12 }}>
              <span style={{ fontSize: 16 }}>💡</span>
              <span style={{ flex: 1 }}>
                {isPt
                  ? 'Ative a bolsa de mercados nas configurações para receber mercados personalizados'
                  : 'Activez la bourse aux marchés dans les paramètres pour recevoir des marchés personnalisés'}
              </span>
              <button
                onClick={() => setActiveTab('settings')}
                className="v22-btn v22-btn-sm"
              >
                {isPt ? 'Configurações' : 'Paramètres'} →
              </button>
            </div>
          )}

          {/* Filters card */}
          <div className="v22-card" style={{ marginBottom: 14 }}>
            <div className="v22-card-head">
              <div className="v22-card-title">{isPt ? 'Filtros' : 'Filtres'}</div>
            </div>
            <div className="v22-card-body">
              {isSociete && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <div
                      style={{
                        width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
                        background: filterGrandMarche ? 'var(--v22-yellow)' : 'var(--v22-border)',
                        transition: 'background 0.15s',
                      }}
                      onClick={() => setFilterGrandMarche(v => !v)}
                    >
                      <div style={{
                        position: 'absolute', top: 2, left: filterGrandMarche ? 18 : 2,
                        width: 16, height: 16, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      🏗️ {isPt ? 'Grandes obras (≥ 50 000 €)' : 'Grands marchés (≥ 50 000 €)'}
                    </span>
                  </label>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div>
                  <label className="v22-form-label">{isPt ? 'Categoria' : 'Catégorie'}</label>
                  <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="v22-form-input"
                  >
                    <option value="">{isPt ? 'Todas' : 'Toutes'}</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.emoji} {isPt ? cat.label : cat.labelFr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="v22-form-label">{isPt ? 'Cidade' : 'Ville'}</label>
                  <input
                    type="text"
                    value={filterCity}
                    onChange={e => setFilterCity(e.target.value)}
                    placeholder={isPt ? 'Cidade...' : 'Ville...'}
                    className="v22-form-input"
                  />
                </div>

                <div>
                  <label className="v22-form-label">{isPt ? 'Urgência' : 'Urgence'}</label>
                  <select
                    value={filterUrgency}
                    onChange={e => setFilterUrgency(e.target.value)}
                    className="v22-form-input"
                  >
                    <option value="">{isPt ? 'Todas' : 'Toutes'}</option>
                    <option value="normal">🟢 Normal</option>
                    <option value="urgent">🟡 {isPt ? 'Urgente' : 'Urgent'}</option>
                    <option value="emergency">🔴 {isPt ? 'Emergência' : 'Urgence'}</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label className="v22-form-label">&nbsp;</label>
                  <button
                    onClick={() => setFilterBTP(f => !f)}
                    style={{
                      padding: '6px 12px', borderRadius: 8, border: '1px solid',
                      borderColor: filterBTP ? '#7c3aed' : '#d1d5db',
                      background: filterBTP ? '#f3e8ff' : '#fff',
                      color: filterBTP ? '#7c3aed' : '#374151',
                      cursor: 'pointer', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
                    }}
                  >
                    🏭 {isPt ? 'Só Empresas BTP' : 'Offres BTP seulement'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
              <div style={{ width: 24, height: 24, border: '2px solid var(--v22-yellow)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          )}

          {/* Empty state */}
          {!loading && marches.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                {isPt ? 'Nenhum mercado encontrado' : 'Aucun marché trouvé'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', maxWidth: 360, margin: '0 auto' }}>
                {isPt
                  ? 'Não há mercados disponíveis com os filtros selecionados. Tente ajustar os critérios ou volte mais tarde.'
                  : 'Aucun marché disponible avec les filtres sélectionnés. Essayez d\'ajuster les critères ou revenez plus tard.'}
              </div>
            </div>
          )}

          {/* Opportunités card with list */}
          {!loading && marches.length > 0 && (
            <div className="v22-card">
              <div className="v22-card-head">
                <div className="v22-card-title">{isPt ? 'Oportunidades' : 'Opportunités'}</div>
                <div className="v22-card-meta">{marches.length} {isPt ? 'resultados' : 'résultats'}</div>
              </div>
              <div>
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
                    <div
                      key={m.id}
                      onClick={() => !isFull && setSelectedMarche(m)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        borderBottom: '1px solid #F0F0EE',
                        cursor: isFull ? 'not-allowed' : 'pointer',
                        opacity: isFull ? 0.5 : 1,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isFull) (e.currentTarget as HTMLElement).style.background = '#FAFAF7' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                    >
                      {/* Type label (mono) */}
                      <div style={{ flexShrink: 0, width: 90 }}>
                        <span className="v22-tag v22-tag-yellow">
                          {getCategoryEmoji(m.category)} {isPt
                            ? (CATEGORIES.find(c => c.id === m.category)?.label || m.category)
                            : (CATEGORIES.find(c => c.id === m.category)?.labelFr || m.category)}
                        </span>
                        {m.source_type === 'btp_sous_traitance' && (
                          <span className="v22-tag" style={{ background: '#f3e8ff', color: '#7c3aed', marginTop: 4, display: 'block' }}>
                            🏭 {isPt ? 'Empresa BTP' : 'Entreprise BTP'}
                          </span>
                        )}
                      </div>

                      {/* Title + location */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                          {m.city && <span>📍 {m.city}</span>}
                          {days !== null && (
                            <span style={{ color: days <= 3 ? 'var(--v22-red)' : undefined }}>
                              ⏰ {days > 0 ? (isPt ? `${days}d` : `${days}j`) : (isPt ? 'Expirado' : 'Expiré')}
                            </span>
                          )}
                          {urgencyTag(m.urgency, isPt)}
                          {isFull && <span className="v22-tag v22-tag-gray">{isPt ? 'Completo' : 'Complet'}</span>}
                          {workMode && (
                            <span className="v22-tag" style={{ background: '#EEF2FF', color: '#4338CA' }}>
                              {workMode.emoji} {isPt ? workMode.pt : workMode.fr}
                            </span>
                          )}
                        </div>

                        {/* Requirements badges */}
                        {(m.require_rc_pro || m.require_decennale || m.require_rge || m.require_qualibat) && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            {m.require_rc_pro && <span className="v22-tag" style={{ background: '#E8F0FE', color: '#1A56DB' }}>🛡️ RC Pro</span>}
                            {m.require_decennale && <span className="v22-tag" style={{ background: '#E8F0FE', color: '#1A56DB' }}>🏗️ {isPt ? 'Decenal' : 'Décennale'}</span>}
                            {m.require_rge && <span className="v22-tag v22-tag-green">🌿 RGE</span>}
                            {m.require_qualibat && <span className="v22-tag" style={{ background: '#F3E8FF', color: '#7C3AED' }}>🏅 QualiBAT</span>}
                          </div>
                        )}

                        {/* Progress bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <div className="v22-prog-bar" style={{ flex: 1 }}>
                            <div className="v22-prog-fill" style={{
                              width: `${Math.min(100, (currentCand / maxCand) * 100)}%`,
                              background: isFull ? 'var(--v22-text-muted)' : currentCand / maxCand > 0.7 ? 'var(--v22-amber)' : 'var(--v22-green)',
                            }} />
                          </div>
                          <span className="v22-mono" style={{ fontSize: 10, color: 'var(--v22-text-muted)' }}>
                            {currentCand}/{maxCand}
                          </span>
                        </div>

                        {/* Availability info */}
                        {m.artisan_dispo_info && (
                          <div style={{ marginTop: 4 }}>
                            <span className="v22-tag v22-tag-green">
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
                      </div>

                      {/* Budget (mono, right-aligned) */}
                      <div className="v22-amount" style={{ flexShrink: 0, textAlign: 'right' }}>
                        {(m.budget_min || m.budget_max) ? (
                          <>
                            {m.budget_min ? formatPrice(m.budget_min, locale) : '—'}
                            {' - '}
                            {m.budget_max ? formatPrice(m.budget_max, locale) : '—'}
                          </>
                        ) : (
                          <span style={{ color: 'var(--v22-text-muted)', fontStyle: 'italic', fontSize: 11 }}>
                            {isPt ? 'N/D' : 'N/D'}
                          </span>
                        )}
                      </div>

                      {/* Publisher tag */}
                      <div style={{ flexShrink: 0 }}>
                        {publisherTag(m.publisher_type, isPt)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── MY BIDS TAB ────────────────────────────── */}
      {activeTab === 'mybids' && (
        <div>
          {myBids.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                {isPt ? 'Nenhuma candidatura' : 'Aucune candidature'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', maxWidth: 360, margin: '0 auto', marginBottom: 14 }}>
                {isPt
                  ? 'Ainda não se candidatou a nenhum mercado. Explore os mercados abertos e envie a sua primeira proposta!'
                  : 'Vous n\'avez pas encore postulé à un marché. Explorez les marchés ouverts et envoyez votre première proposition !'}
              </div>
              <button
                onClick={() => setActiveTab('browse')}
                className="v22-btn v22-btn-primary"
              >
                {isPt ? 'Explorar mercados' : 'Explorer les marchés'} →
              </button>
            </div>
          ) : (
            <div className="v22-card">
              <div className="v22-card-head">
                <div className="v22-card-title">{isPt ? 'As minhas candidaturas' : 'Mes candidatures'}</div>
                <div className="v22-card-meta">{myBids.length}</div>
              </div>
              <div>
                {myBids.map((bid) => (
                  <div
                    key={bid.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #F0F0EE' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                        <span className="v22-tag v22-tag-yellow">
                          {getCategoryEmoji(bid.marche_category || bid.category)} {isPt
                            ? CATEGORIES.find(c => c.id === (bid.marche_category || bid.category))?.label
                            : CATEGORIES.find(c => c.id === (bid.marche_category || bid.category))?.labelFr
                          }
                        </span>
                        {statusTag(bid.status, isPt)}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>
                        {bid.marche_title || bid.title || (isPt ? 'Mercado' : 'Marché')}
                      </div>
                      {bid.marche_city && (
                        <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 2 }}>📍 {bid.marche_city}</div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="v22-amount" style={{ fontSize: 14, fontWeight: 600 }}>
                        {formatPrice(bid.price, locale)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>
                        {isPt ? 'Prazo:' : 'Délai :'} {bid.timeline || '—'}
                      </div>
                      {bid.materials_included && (
                        <span className="v22-tag v22-tag-green" style={{ marginTop: 2 }}>
                          ✓ {isPt ? 'Materiais' : 'Matériaux'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── WON CONTRACTS TAB ──────────────────────── */}
      {activeTab === 'won' && (
        <div>
          {wonBids.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🏆</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                {isPt ? 'Nenhum contrato ganho ainda' : 'Aucun contrat remporté pour l\'instant'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', maxWidth: 360, margin: '0 auto', marginBottom: 14 }}>
                {isPt
                  ? 'Continue a candidatar-se aos mercados. Os seus contratos ganhos aparecerão aqui.'
                  : 'Continuez à postuler aux marchés. Vos contrats remportés apparaîtront ici.'}
              </div>
              <button
                onClick={() => setActiveTab('browse')}
                className="v22-btn v22-btn-primary"
              >
                {isPt ? 'Ver mercados' : 'Voir les marchés'} →
              </button>
            </div>
          ) : (
            <div className="v22-card">
              <div className="v22-card-head">
                <div className="v22-card-title">{isPt ? 'Contratos ganhos' : 'Contrats gagnés'}</div>
                <div className="v22-card-meta">{wonBids.length}</div>
              </div>
              <div>
                {wonBids.map((bid) => (
                  <div key={bid.id} style={{ padding: 14, borderBottom: '1px solid #F0F0EE' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                          <span className="v22-tag v22-tag-green">✅ {isPt ? 'Contrato ganho' : 'Contrat remporté'}</span>
                          <span className="v22-tag v22-tag-yellow">
                            {getCategoryLabel(bid.marche_category || bid.category, isPt)}
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                          {bid.marche_title || bid.title || (isPt ? 'Mercado' : 'Marché')}
                        </div>
                        {bid.marche_city && (
                          <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginBottom: 4 }}>📍 {bid.marche_city}</div>
                        )}
                        {bid.marche_description && (
                          <div style={{ fontSize: 12, color: 'var(--v22-text-mid)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>
                            {bid.marche_description}
                          </div>
                        )}
                      </div>
                      <div style={{ flexShrink: 0, background: 'var(--v22-bg)', borderRadius: 3, padding: '10px 14px', border: '1px solid var(--v22-border)', minWidth: 160 }}>
                        <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="v22-mono">
                          {isPt ? 'O seu preço' : 'Votre prix'}
                        </div>
                        <div className="v22-mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--v22-green)', marginBottom: 8 }}>
                          {formatPrice(bid.price, locale)}
                        </div>
                        {bid.publisher_contact && (
                          <div style={{ borderTop: '1px solid var(--v22-border)', paddingTop: 8, marginTop: 8 }}>
                            <div className="v22-mono" style={{ fontSize: 10, color: 'var(--v22-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              {isPt ? 'Contacto' : 'Contact'}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>{bid.publisher_contact.name}</div>
                            {bid.publisher_contact.email && (
                              <a href={`mailto:${bid.publisher_contact.email}`} style={{ fontSize: 11, color: '#1A56DB' }}>
                                {bid.publisher_contact.email}
                              </a>
                            )}
                            {bid.publisher_contact.phone && (
                              <div style={{ fontSize: 11, color: 'var(--v22-text-mid)' }}>{bid.publisher_contact.phone}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Evaluation section for won contracts */}
                    <div style={{ borderTop: '1px solid var(--v22-border)', paddingTop: 10, marginTop: 10 }}>
                      {/* Received evaluation from publisher */}
                      {receivedEval[bid.marche_id] && (
                        <div style={{ marginBottom: 10, borderRadius: 3, background: '#E8F0FE', border: '1px solid #B6D4FE', padding: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A56DB', marginBottom: 6 }}>
                            &#x2B50; {isPt ? 'Avaliação recebida do cliente' : 'Évaluation reçue du donneur d\'ordre'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 4 }}>
                            {[1, 2, 3, 4, 5].map(s => (
                              <span key={s} style={{ fontSize: 14, color: s <= receivedEval[bid.marche_id].note_globale ? '#D4A00A' : 'var(--v22-border)' }}>
                                &#x2605;
                              </span>
                            ))}
                            <span className="v22-mono" style={{ marginLeft: 6, fontSize: 12, fontWeight: 600 }}>{receivedEval[bid.marche_id].note_globale}/5</span>
                          </div>
                          {receivedEval[bid.marche_id].comment && (
                            <div style={{ fontSize: 12, color: 'var(--v22-text-mid)', fontStyle: 'italic', marginTop: 4 }}>
                              &quot;{receivedEval[bid.marche_id].comment}&quot;
                            </div>
                          )}
                        </div>
                      )}

                      {/* Evaluate this mission */}
                      {evalBidId === bid.id ? (
                        <div style={{ borderRadius: 3, background: 'var(--v22-amber-light)', border: '1px solid var(--v22-yellow-border)', padding: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--v22-amber)', marginBottom: 8 }}>
                            {isPt ? 'Avaliar esta missão' : 'Évaluer cette mission'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 8 }}>
                            {[1, 2, 3, 4, 5].map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setEvalRating(s)}
                                style={{
                                  fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                                  color: s <= evalRating ? '#D4A00A' : 'var(--v22-border)',
                                  transition: 'transform 0.1s',
                                }}
                              >
                                &#x2605;
                              </button>
                            ))}
                            {evalRating > 0 && <span className="v22-mono" style={{ marginLeft: 6, fontSize: 12, fontWeight: 600 }}>{evalRating}/5</span>}
                          </div>
                          <textarea
                            value={evalComment}
                            onChange={e => setEvalComment(e.target.value)}
                            rows={3}
                            placeholder={isPt ? 'Comentário (opcional)...' : 'Commentaire (optionnel)...'}
                            className="v22-form-input"
                            style={{ resize: 'none', marginBottom: 8 }}
                          />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => { setEvalBidId(null); setEvalRating(0); setEvalComment('') }}
                              className="v22-btn"
                              style={{ flex: 1 }}
                            >
                              {isPt ? 'Cancelar' : 'Annuler'}
                            </button>
                            <button
                              type="button"
                              onClick={() => submitEvaluation(bid.marche_id || bid.marche?.id, bid.id || bid.my_candidature_id)}
                              disabled={evalRating < 1 || evalSubmitting}
                              className="v22-btn v22-btn-primary"
                              style={{ flex: 1, opacity: (evalRating < 1 || evalSubmitting) ? 0.5 : 1, cursor: (evalRating < 1 || evalSubmitting) ? 'not-allowed' : 'pointer' }}
                            >
                              {evalSubmitting
                                ? (isPt ? 'A enviar...' : 'Envoi...')
                                : (isPt ? 'Enviar avaliação' : 'Envoyer l\'évaluation')}
                            </button>
                          </div>
                        </div>
                      ) : evalSuccess ? (
                        <div style={{ borderRadius: 3, background: 'var(--v22-green-light)', border: '1px solid var(--v22-green)', padding: 10, textAlign: 'center' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--v22-green)' }}>
                            &#x2705; {isPt ? 'Avaliação enviada com sucesso!' : 'Évaluation envoyée avec succès !'}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEvalBidId(bid.id)
                            loadReceivedEvaluation(bid.marche_id)
                          }}
                          className="v22-btn"
                          style={{ width: '100%', textAlign: 'center' }}
                        >
                          &#x2B50; {isPt ? 'Avaliar esta missão' : 'Évaluer cette mission'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── SETTINGS TAB ─────────────────────────────── */}
      {activeTab === 'settings' && (
        <div style={{ maxWidth: 560 }}>
          {/* 1. Opt-in toggle */}
          <div className="v22-card" style={{ marginBottom: 14 }}>
            <div className="v22-card-head">
              <div className="v22-card-title">
                {isPt ? 'Receber propostas de mercados' : 'Recevoir des propositions de marchés'}
              </div>
            </div>
            <div className="v22-card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  onClick={() => setMarchesPrefs(p => ({ ...p, marches_opt_in: !p.marches_opt_in }))}
                  style={{
                    width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
                    background: marchesPrefs.marches_opt_in ? 'var(--v22-green)' : 'var(--v22-border)',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
                    background: 'var(--v22-surface)', transition: 'left 0.15s',
                    left: marchesPrefs.marches_opt_in ? 18 : 2,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: marchesPrefs.marches_opt_in ? 'var(--v22-green)' : 'var(--v22-text-muted)' }}>
                  {marchesPrefs.marches_opt_in
                    ? (isPt ? 'Ativado' : 'Activé')
                    : (isPt ? 'Desativado' : 'Désactivé')}
                </span>
              </div>
              {!marchesPrefs.marches_opt_in && (
                <div style={{ marginTop: 10, borderRadius: 3, background: 'var(--v22-bg)', border: '1px solid var(--v22-border)', padding: '8px 10px', fontSize: 12, color: 'var(--v22-text-muted)' }}>
                  {isPt
                    ? 'Não receberá notificações para novos mercados'
                    : 'Vous ne recevrez plus de notifications pour les nouveaux marchés'}
                </div>
              )}
            </div>
          </div>

          {/* 2. Categories checkboxes */}
          <div className="v22-card" style={{ marginBottom: 14, opacity: !marchesPrefs.marches_opt_in ? 0.5 : 1, pointerEvents: !marchesPrefs.marches_opt_in ? 'none' : undefined }}>
            <div className="v22-card-head">
              <div className="v22-card-title">
                {isPt ? 'As minhas especialidades' : 'Mes spécialités'}
              </div>
            </div>
            <div className="v22-card-body">
              <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginBottom: 10 }}>
                {isPt
                  ? 'Selecione as categorias de trabalho que lhe interessam'
                  : 'Sélectionnez les catégories de travaux qui vous intéressent'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {CATEGORIES.map(cat => {
                  const checked = marchesPrefs.marches_categories.includes(cat.id)
                  return (
                    <label
                      key={cat.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, borderRadius: 3, cursor: 'pointer',
                        border: checked ? '1px solid var(--v22-yellow)' : '1px solid var(--v22-border)',
                        background: checked ? 'var(--v22-yellow-light)' : 'var(--v22-surface)',
                        padding: '6px 8px', fontSize: 12, transition: 'all 0.1s',
                      }}
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
                        style={{ display: 'none' }}
                      />
                      <div style={{
                        width: 14, height: 14, borderRadius: 2, flexShrink: 0,
                        border: checked ? '2px solid var(--v22-yellow)' : '2px solid var(--v22-border-dark)',
                        background: checked ? 'var(--v22-yellow)' : 'var(--v22-surface)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.1s',
                      }}>
                        {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span>{cat.emoji} {isPt ? cat.label : cat.labelFr}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 3. Work mode radio */}
          <div className="v22-card" style={{ marginBottom: 14, opacity: !marchesPrefs.marches_opt_in ? 0.5 : 1, pointerEvents: !marchesPrefs.marches_opt_in ? 'none' : undefined }}>
            <div className="v22-card-head">
              <div className="v22-card-title">
                {isPt ? 'O meu modo de trabalho' : 'Mon mode de travail'}
              </div>
            </div>
            <div className="v22-card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
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
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                        borderRadius: 3, padding: '10px 12px', textAlign: 'left',
                        border: selected ? '2px solid var(--v22-yellow)' : '1px solid var(--v22-border)',
                        background: selected ? 'var(--v22-yellow-light)' : 'var(--v22-surface)',
                        cursor: 'pointer', transition: 'all 0.1s',
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{mode.emoji}</span>
                      <span style={{ fontSize: 12, fontWeight: selected ? 600 : 400 }}>
                        {isPt ? mode.pt : mode.fr}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--v22-text-muted)' }}>{isPt ? mode.desc_pt : mode.desc_fr}</span>
                    </button>
                  )
                })}
              </div>

              {/* Tariff inputs based on work mode */}
              {marchesPrefs.marches_work_mode === 'journee' && (
                <div style={{ marginTop: 10 }}>
                  <label className="v22-form-label">
                    {isPt ? 'Tarifa diária (€)' : 'Tarif journalier (€)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={marchesPrefs.marches_tarif_journalier ?? ''}
                    onChange={e => setMarchesPrefs(p => ({ ...p, marches_tarif_journalier: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="ex: 350"
                    className="v22-form-input"
                  />
                </div>
              )}
              {marchesPrefs.marches_work_mode === 'horaire' && (
                <div style={{ marginTop: 10 }}>
                  <label className="v22-form-label">
                    {isPt ? 'Tarifa por hora (€)' : 'Tarif horaire (€)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={marchesPrefs.marches_tarif_horaire ?? ''}
                    onChange={e => setMarchesPrefs(p => ({ ...p, marches_tarif_horaire: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="ex: 45"
                    className="v22-form-input"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 4. Description textarea */}
          <div className="v22-card" style={{ marginBottom: 14, opacity: !marchesPrefs.marches_opt_in ? 0.5 : 1, pointerEvents: !marchesPrefs.marches_opt_in ? 'none' : undefined }}>
            <div className="v22-card-head">
              <div className="v22-card-title">
                {isPt ? 'Apresentação bolsa de mercados' : 'Présentation bourse aux marchés'}
              </div>
            </div>
            <div className="v22-card-body">
              <textarea
                value={marchesPrefs.marches_description}
                onChange={e => setMarchesPrefs(p => ({ ...p, marches_description: e.target.value.slice(0, 2000) }))}
                rows={5}
                maxLength={2000}
                placeholder={isPt
                  ? 'Descreva a sua empresa, experiência e competências principais...'
                  : 'Décrivez votre entreprise, expérience et compétences principales...'}
                className="v22-form-input"
                style={{ resize: 'none' }}
              />
              <div className="v22-mono" style={{ marginTop: 4, fontSize: 10, color: 'var(--v22-text-muted)', textAlign: 'right' }}>
                {marchesPrefs.marches_description.length}/2000
              </div>
            </div>
          </div>

          {/* Save button */}
          <button
            type="button"
            onClick={saveMarchesPrefs}
            disabled={prefsSaving}
            className="v22-btn v22-btn-primary"
            style={{ width: '100%', padding: '8px 16px', fontSize: 13, opacity: prefsSaving ? 0.5 : 1, cursor: prefsSaving ? 'not-allowed' : 'pointer' }}
          >
            {prefsSaving
              ? (isPt ? 'A guardar...' : 'Enregistrement...')
              : (isPt ? 'Guardar preferências' : 'Enregistrer les préférences')}
          </button>
        </div>
      )}
    </div>
  )
}
