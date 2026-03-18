'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Euro,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ClipboardList,
  User,
  Shield,
  Wrench,
  Package,
  FileText,
  Zap,
  Ban,
  MessageCircle,
  Star,
  RefreshCw,
  Send,
} from 'lucide-react'

// ── Types ──
interface Marche {
  id: string
  title: string
  description: string
  category: string
  publisher_name: string
  publisher_email: string
  publisher_phone: string | null
  publisher_type: string
  location_city: string
  location_postal: string | null
  budget_min: number | null
  budget_max: number | null
  deadline: string
  urgency: string
  status: string
  candidatures_count: number
  max_candidatures: number | null
  require_rc_pro: boolean
  require_decennale: boolean
  require_rge: boolean
  require_qualibat: boolean
  preferred_work_mode: string | null
  created_at: string
}

interface Candidature {
  id: string
  marche_id: string
  artisan_id: string
  artisan_name: string
  artisan_city: string | null
  price: number
  timeline: string
  description: string
  materials_included: boolean
  guarantee: string | null
  status: string
  created_at: string
  // Enriched artisan data
  rc_pro_valid?: boolean
  decennale_valid?: boolean
  rge_valid?: boolean
  qualibat_valid?: boolean
  work_mode?: string
  tarif_journalier?: number | null
  tarif_horaire?: number | null
  rating?: number | null
  review_count?: number
  distance?: number | null
}

// ── Status config ──
const STATUS_CONFIG: Record<string, { label: string; labelPt: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  pending: { label: 'En attente', labelPt: 'Pendente', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock },
  accepted: { label: 'Acceptée', labelPt: 'Aceite', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCircle2 },
  rejected: { label: 'Refusée', labelPt: 'Recusada', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle },
}

const MARCHE_STATUS_CONFIG: Record<string, { label: string; labelPt: string; color: string; bg: string }> = {
  open: { label: 'Ouvert', labelPt: 'Aberto', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  awarded: { label: 'Attribué', labelPt: 'Atribuído', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  closed: { label: 'Fermé', labelPt: 'Fechado', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
  cancelled: { label: 'Annulé', labelPt: 'Cancelado', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
}

const URGENCY_LABELS: Record<string, { fr: string; pt: string; color: string }> = {
  normal: { fr: 'Normal', pt: 'Normal', color: 'text-green-600' },
  urgent: { fr: 'Urgent', pt: 'Urgente', color: 'text-orange-500' },
  emergency: { fr: 'Urgence', pt: 'Emergência', color: 'text-red-600' },
}

export default function GererMarcheClient({ isPt }: { isPt: boolean }) {
  return (
    <Suspense fallback={<LoadingScreen isPt={isPt} />}>
      <GererMarcheContent isPt={isPt} />
    </Suspense>
  )
}

function LoadingScreen({ isPt }: { isPt: boolean }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-amber-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#FFC107]" />
        <p className="mt-3 text-gray-500">
          {isPt ? 'A carregar...' : 'Chargement...'}
        </p>
      </div>
    </div>
  )
}

function GererMarcheContent({ isPt }: { isPt: boolean }) {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const token = searchParams.get('token')

  const [marche, setMarche] = useState<Marche | null>(null)
  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Messaging state
  const [openMsgId, setOpenMsgId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, any[]>>({})
  const [msgInput, setMsgInput] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [msgLoading, setMsgLoading] = useState<string | null>(null)
  const [unreadTotal, setUnreadTotal] = useState(0)

  // Evaluation state
  const [evalCandId, setEvalCandId] = useState<string | null>(null)
  const [evalRating, setEvalRating] = useState(0)
  const [evalComment, setEvalComment] = useState('')
  const [evalSubmitting, setEvalSubmitting] = useState(false)
  const [evalSuccess, setEvalSuccess] = useState<string | null>(null)

  const t = (fr: string, pt: string) => (isPt ? pt : fr)

  const fetchData = useCallback(async () => {
    if (!id || !token) {
      setError(t('Lien invalide. Vérifiez votre URL.', 'Link inválido. Verifique o seu URL.'))
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/marches/${id}?token=${token}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('Appel d\'offres introuvable', 'Pedido não encontrado'))
        return
      }

      if (!data.is_publisher) {
        setError(t('Accès non autorisé', 'Acesso não autorizado'))
        return
      }

      setMarche(data.marche)
      setCandidatures(data.candidatures || [])
    } catch {
      setError(t('Erreur de connexion', 'Erro de conexão'))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCandidatureAction = async (candidatureId: string, status: 'accepted' | 'rejected') => {
    if (!id || !token) return
    setActionLoading(candidatureId)

    try {
      const res = await fetch(`/api/marches/${id}/candidature/${candidatureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, access_token: token }),
      })

      if (res.ok) {
        await fetchData()
      }
    } catch {
      // silent fail, user can retry
    } finally {
      setActionLoading(null)
    }
  }

  const handleCloseMarche = async (newStatus: 'closed' | 'cancelled') => {
    if (!id || !token || !marche) return
    setActionLoading('marche-status')

    try {
      const res = await fetch(`/api/marches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, access_token: token }),
      })

      if (res.ok) {
        setMarche(prev => prev ? { ...prev, status: newStatus } : null)
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null)
    }
  }

  // Load messages for a candidature
  const loadMessages = async (candidatureId: string) => {
    if (!id || !token) return
    setMsgLoading(candidatureId)
    try {
      const res = await fetch(`/api/marches/${id}/messages?candidature_id=${candidatureId}&token=${token}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => ({ ...prev, [candidatureId]: data.messages || [] }))
        if (data.unread_count) {
          setUnreadTotal(data.unread_count)
        }
      }
    } catch {
      // silent
    } finally {
      setMsgLoading(null)
    }
  }

  // Send a message
  const sendMessage = async (candidatureId: string) => {
    if (!id || !token || !msgInput.trim() || msgSending) return
    setMsgSending(true)
    try {
      const res = await fetch(`/api/marches/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidature_id: candidatureId,
          sender_type: 'publisher',
          access_token: token,
          content: msgInput.trim(),
        }),
      })
      if (res.ok) {
        setMsgInput('')
        await loadMessages(candidatureId)
      }
    } catch {
      // silent
    } finally {
      setMsgSending(false)
    }
  }

  // Submit evaluation for an artisan
  const submitEvaluation = async (candidatureId: string) => {
    if (!id || !token || evalRating < 1 || evalSubmitting) return
    setEvalSubmitting(true)
    try {
      const res = await fetch(`/api/marches/${id}/evaluation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidature_id: candidatureId,
          access_token: token,
          evaluator_type: 'publisher',
          note_globale: evalRating,
          comment: evalComment.trim() || null,
        }),
      })
      if (res.ok) {
        setEvalSuccess(candidatureId)
        setEvalCandId(null)
        setEvalRating(0)
        setEvalComment('')
        setTimeout(() => setEvalSuccess(null), 3000)
      }
    } catch {
      // silent
    } finally {
      setEvalSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat(isPt ? 'pt-PT' : 'fr-FR', { style: 'currency', currency: 'EUR' }).format(price)

  if (loading) return <LoadingScreen isPt={isPt} />

  // ── Error ──
  if (error || !marche) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-amber-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-900">
            {t('Accès impossible', 'Acesso impossível')}
          </h2>
          <p className="mb-6 text-gray-600">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-[#FFC107] px-6 py-3 text-sm font-bold text-gray-900 shadow-[0_6px_20px_rgba(255,214,0,0.3)] hover:bg-[#FFE84D] transition-all no-underline"
          >
            {t('Retour à l\'accueil', 'Voltar ao início')}
          </Link>
        </div>
      </div>
    )
  }

  const marcheStatus = MARCHE_STATUS_CONFIG[marche.status] || MARCHE_STATUS_CONFIG.open
  const urgency = URGENCY_LABELS[marche.urgency] || URGENCY_LABELS.normal
  const isOpen = marche.status === 'open'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-amber-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition no-underline"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('Retour', 'Voltar')}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* ── Alerts / Stats ── */}
        {(() => {
          const daysUntilDeadline = marche.deadline
            ? Math.max(0, Math.ceil((new Date(marche.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : null
          const lastCandidature = candidatures.length > 0
            ? candidatures.reduce((latest, c) => new Date(c.created_at) > new Date(latest.created_at) ? c : latest, candidatures[0])
            : null
          const timeSinceLastCand = lastCandidature
            ? Math.floor((Date.now() - new Date(lastCandidature.created_at).getTime()) / (1000 * 60 * 60))
            : null

          return (
            <div className="mb-6 flex flex-wrap gap-3">
              {unreadTotal > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                  <MessageCircle className="h-4 w-4" />
                  {unreadTotal} {t('message(s) non lu(s)', 'mensagem(ns) não lida(s)')}
                </div>
              )}
              {timeSinceLastCand !== null && (
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  {timeSinceLastCand < 1
                    ? t('Dernière candidature : < 1h', 'Última candidatura: < 1h')
                    : timeSinceLastCand < 24
                      ? t(`Dernière candidature : il y a ${timeSinceLastCand}h`, `Última candidatura: há ${timeSinceLastCand}h`)
                      : t(`Dernière candidature : il y a ${Math.floor(timeSinceLastCand / 24)}j`, `Última candidatura: há ${Math.floor(timeSinceLastCand / 24)}d`)}
                </div>
              )}
              {daysUntilDeadline !== null && daysUntilDeadline <= 7 && (
                <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${
                  daysUntilDeadline <= 3
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}>
                  <Calendar className="h-4 w-4" />
                  {daysUntilDeadline === 0
                    ? t('Date limite : aujourd\'hui', 'Prazo: hoje')
                    : t(`Date limite dans ${daysUntilDeadline} jour${daysUntilDeadline > 1 ? 's' : ''}`, `Prazo em ${daysUntilDeadline} dia${daysUntilDeadline > 1 ? 's' : ''}`)}
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Marche details card ── */}
        <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-lg sm:p-8">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{marche.title}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('Publié le', 'Publicado a')} {formatDate(marche.created_at)}
              </p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${marcheStatus.bg} ${marcheStatus.color}`}>
              {isPt ? marcheStatus.labelPt : marcheStatus.label}
            </span>
          </div>

          <p className="mb-6 whitespace-pre-wrap text-gray-700 leading-relaxed">{marche.description}</p>

          {/* Meta grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-2.5 text-sm">
              <Wrench className="h-4 w-4 text-[#FFC107]" />
              <span className="text-gray-600">{t('Catégorie', 'Categoria')}:</span>
              <span className="font-medium text-gray-900 capitalize">{marche.category}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-2.5 text-sm">
              <MapPin className="h-4 w-4 text-[#FFC107]" />
              <span className="text-gray-600">{t('Lieu', 'Local')}:</span>
              <span className="font-medium text-gray-900">
                {marche.location_city}{marche.location_postal ? ` (${marche.location_postal})` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-2.5 text-sm">
              <Calendar className="h-4 w-4 text-[#FFC107]" />
              <span className="text-gray-600">{t('Date limite', 'Prazo')}:</span>
              <span className="font-medium text-gray-900">{formatDate(marche.deadline)}</span>
            </div>
            {(marche.budget_min || marche.budget_max) && (
              <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-2.5 text-sm">
                <Euro className="h-4 w-4 text-[#FFC107]" />
                <span className="text-gray-600">Budget:</span>
                <span className="font-medium text-gray-900">
                  {marche.budget_min && marche.budget_max
                    ? `${formatPrice(marche.budget_min)} - ${formatPrice(marche.budget_max)}`
                    : marche.budget_min
                      ? `${t('Min', 'Mín')} ${formatPrice(marche.budget_min)}`
                      : `Max ${formatPrice(marche.budget_max!)}`
                  }
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-2.5 text-sm">
              <Zap className={`h-4 w-4 ${urgency.color}`} />
              <span className="text-gray-600">{t('Urgence', 'Urgência')}:</span>
              <span className={`font-medium ${urgency.color}`}>
                {isPt ? urgency.pt : urgency.fr}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-2.5 text-sm">
              <ClipboardList className="h-4 w-4 text-[#FFC107]" />
              <span className="text-gray-600">{t('Candidatures', 'Candidaturas')}:</span>
              <span className="font-bold text-gray-900">{candidatures.length}</span>
            </div>
          </div>

          {/* Candidatures progress bar */}
          {(marche.max_candidatures ?? 0) > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-gray-600">
                  {candidatures.length}/{marche.max_candidatures} {t('candidatures reçues', 'candidaturas recebidas')}
                </span>
                {candidatures.length < (marche.max_candidatures ?? 0) && (
                  <span className="text-green-600 font-medium text-xs">
                    {(marche.max_candidatures ?? 0) - candidatures.length} {t('places restantes', 'vagas restantes')}
                  </span>
                )}
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    candidatures.length >= (marche.max_candidatures ?? 0) ? 'bg-red-400' :
                    candidatures.length / (marche.max_candidatures ?? 1) > 0.7 ? 'bg-orange-400' : 'bg-green-400'
                  }`}
                  style={{ width: `${Math.min(100, (candidatures.length / (marche.max_candidatures ?? 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Requirements badges */}
          {(marche.require_rc_pro || marche.require_decennale || marche.require_rge || marche.require_qualibat) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">{t('Exigences', 'Requisitos')}:</span>
              {marche.require_rc_pro && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  🛡️ RC Pro
                </span>
              )}
              {marche.require_decennale && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  🏗️ {t('Décennale', 'Decenal')}
                </span>
              )}
              {marche.require_rge && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-semibold text-green-700">
                  🌿 RGE
                </span>
              )}
              {marche.require_qualibat && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2.5 py-1 text-xs font-semibold text-purple-700">
                  🏅 QualiBAT
                </span>
              )}
            </div>
          )}

          {/* Actions for open marche */}
          {isOpen && (
            <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-100 pt-6">
              <button
                type="button"
                onClick={() => handleCloseMarche('closed')}
                disabled={actionLoading === 'marche-status'}
                className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition cursor-pointer disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
                {t('Fermer l\'appel d\'offres', 'Fechar pedido')}
              </button>
              <button
                type="button"
                onClick={() => handleCloseMarche('cancelled')}
                disabled={actionLoading === 'marche-status'}
                className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-red-300 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                {t('Annuler', 'Cancelar')}
              </button>
            </div>
          )}

          {/* Republish button for awarded/closed markets */}
          {(marche.status === 'awarded' || marche.status === 'closed') && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <Link
                href={isPt ? `/pt/mercados/publicar?clone=${id}&token=${token}` : `/marches/publier?clone=${id}&token=${token}`}
                className="inline-flex items-center gap-2 rounded-full bg-[#FFC107] px-6 py-3 text-sm font-bold text-gray-900 shadow-[0_4px_14px_rgba(255,214,0,0.3)] hover:bg-[#FFE84D] hover:-translate-y-0.5 transition-all no-underline"
              >
                <RefreshCw className="h-4 w-4" />
                {t('Republier ce marché', 'Republicar este mercado')}
              </Link>
            </div>
          )}
        </div>

        {/* ── Candidatures section ── */}
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900">
            <FileText className="h-5 w-5 text-[#FFC107]" />
            {t('Candidatures reçues', 'Candidaturas recebidas')}
            {candidatures.length > 0 && (
              <span className="rounded-full bg-[#FFC107] px-2.5 py-0.5 text-sm font-bold text-gray-900">
                {candidatures.length}
              </span>
            )}
          </h2>

          {candidatures.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <ClipboardList className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-gray-500">
                {t(
                  'Aucune candidature pour le moment. Les artisans qualifiés pourront candidater tant que l\'appel est ouvert.',
                  'Nenhuma candidatura por enquanto. Os profissionais qualificados poderão candidatar-se enquanto o pedido estiver aberto.',
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {candidatures.map(c => {
                const statusConf = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending
                const StatusIcon = statusConf.icon
                const isLoading = actionLoading === c.id

                return (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6"
                  >
                    {/* Header */}
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                          <User className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-900">{c.artisan_name}</p>
                            <a
                              href={`/artisan/${c.artisan_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            >
                              {t('Voir le profil', 'Ver perfil')} →
                            </a>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {c.artisan_city && (
                              <p className="flex items-center gap-1 text-sm text-gray-500">
                                <MapPin className="h-3.5 w-3.5" />
                                {c.artisan_city}
                              </p>
                            )}
                            {c.distance != null && (
                              <span className="text-xs text-blue-600 font-medium">
                                📍 {c.distance < 1 ? `${Math.round(c.distance * 1000)}m` : `${c.distance.toFixed(1)} km`} {t('du chantier', 'da obra')}
                              </span>
                            )}
                            {c.rating != null && (
                              <span className="text-xs text-amber-600 font-medium">
                                ⭐ {c.rating.toFixed(1)}/5{c.review_count ? ` (${c.review_count} ${t('avis', 'avaliações')})` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${statusConf.bg} ${statusConf.color}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {isPt ? statusConf.labelPt : statusConf.label}
                      </span>
                    </div>

                    {/* Compliance badges + work mode */}
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {/* Compliance badges */}
                      {marche.require_rc_pro && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          c.rc_pro_valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {c.rc_pro_valid ? '✅' : '❌'} RC Pro
                        </span>
                      )}
                      {marche.require_decennale && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          c.decennale_valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {c.decennale_valid ? '✅' : '❌'} {t('Décennale', 'Decenal')}
                        </span>
                      )}
                      {marche.require_rge && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          c.rge_valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {c.rge_valid ? '✅' : '❌'} RGE
                        </span>
                      )}
                      {marche.require_qualibat && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          c.qualibat_valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {c.qualibat_valid ? '✅' : '❌'} QualiBAT
                        </span>
                      )}

                      {/* Work mode + tariff */}
                      {c.work_mode && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[11px] font-semibold">
                          {c.work_mode === 'forfait' && '💼 Forfait'}
                          {c.work_mode === 'journee' && `📅 ${c.tarif_journalier ? `${c.tarif_journalier}€/${t('jour', 'dia')}` : t('Journée', 'Por dia')}`}
                          {c.work_mode === 'horaire' && `⏰ ${c.tarif_horaire ? `${c.tarif_horaire}€/h` : t('Horaire', 'Por hora')}`}
                          {c.work_mode === 'tache' && `✅ ${t('Tâche', 'Tarefa')}`}
                        </span>
                      )}
                    </div>

                    {/* Details grid */}
                    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl bg-gray-50 px-4 py-3">
                        <p className="text-xs text-gray-500">{t('Prix proposé', 'Preço proposto')}</p>
                        <p className="text-lg font-bold text-gray-900">{formatPrice(c.price)}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-4 py-3">
                        <p className="text-xs text-gray-500">{t('Délai', 'Prazo')}</p>
                        <p className="font-semibold text-gray-900">{c.timeline}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-4 py-3">
                        <p className="text-xs text-gray-500">{t('Matériaux inclus', 'Materiais incluídos')}</p>
                        <p className="flex items-center gap-1 font-semibold text-gray-900">
                          <Package className="h-4 w-4" />
                          {c.materials_included
                            ? t('Oui', 'Sim')
                            : t('Non', 'Não')
                          }
                        </p>
                      </div>
                      {c.guarantee && (
                        <div className="rounded-xl bg-gray-50 px-4 py-3">
                          <p className="text-xs text-gray-500">{t('Garantie', 'Garantia')}</p>
                          <p className="flex items-center gap-1 font-semibold text-gray-900">
                            <Shield className="h-4 w-4" />
                            {c.guarantee}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3">
                      <p className="mb-1 text-xs font-semibold text-gray-500">{t('Description', 'Descrição')}</p>
                      <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{c.description}</p>
                    </div>

                    {/* Date */}
                    <p className="mb-3 text-xs text-gray-400">
                      {t('Soumis le', 'Enviado a')} {formatDate(c.created_at)}
                    </p>

                    {/* Messaging */}
                    <div className="mb-3">
                      {openMsgId === c.id ? (
                        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                              <MessageCircle className="h-4 w-4 text-[#FFC107]" />
                              {t('Conversation', 'Conversa')}
                            </h4>
                            <button
                              type="button"
                              onClick={() => { setOpenMsgId(null); setMsgInput('') }}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              {t('Fermer', 'Fechar')}
                            </button>
                          </div>

                          {/* Messages list */}
                          <div className="max-h-52 overflow-y-auto space-y-2.5 mb-3">
                            {msgLoading === c.id ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                              </div>
                            ) : !messages[c.id] || messages[c.id].length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-4">
                                {t('Aucun message. Démarrez la conversation !', 'Nenhuma mensagem. Inicie a conversa!')}
                              </p>
                            ) : (
                              messages[c.id].map((msg: any, idx: number) => (
                                <div
                                  key={msg.id || idx}
                                  className={`flex ${msg.sender_type === 'publisher' ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                                    msg.sender_type === 'publisher'
                                      ? 'bg-[#FFC107]/20 text-gray-900'
                                      : 'bg-white border border-gray-200 text-gray-800'
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
                                  sendMessage(c.id)
                                }
                              }}
                              placeholder={t('Votre message...', 'A sua mensagem...')}
                              className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => sendMessage(c.id)}
                              disabled={!msgInput.trim() || msgSending}
                              className="shrink-0 inline-flex items-center gap-1.5 bg-[#FFC107] hover:bg-[#FFE84D] text-gray-900 font-semibold rounded-xl px-4 py-2 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Send className="h-3.5 w-3.5" />
                              {msgSending ? '...' : t('Envoyer', 'Enviar')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMsgId(c.id)
                            setMsgInput('')
                            loadMessages(c.id)
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                        >
                          <MessageCircle className="h-4 w-4" />
                          {t('Envoyer un message', 'Enviar uma mensagem')}
                        </button>
                      )}
                    </div>

                    {/* Evaluation section (only for accepted candidatures) */}
                    {c.status === 'accepted' && (
                      <div className="mb-3">
                        {evalSuccess === c.id ? (
                          <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-center">
                            <p className="text-sm font-semibold text-green-700">
                              &#x2705; {t('Évaluation envoyée !', 'Avaliação enviada!')}
                            </p>
                          </div>
                        ) : evalCandId === c.id ? (
                          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                            <p className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-1.5">
                              <Star className="h-4 w-4" />
                              {t('Évaluer cet artisan', 'Avaliar este profissional')}
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
                              placeholder={t('Commentaire (optionnel)...', 'Comentário (opcional)...')}
                              className="w-full border border-amber-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all resize-none mb-3 bg-white"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => { setEvalCandId(null); setEvalRating(0); setEvalComment('') }}
                                className="flex-1 border border-gray-200 text-gray-600 hover:bg-white font-semibold rounded-full px-4 py-2.5 text-sm transition-all"
                              >
                                {t('Annuler', 'Cancelar')}
                              </button>
                              <button
                                type="button"
                                onClick={() => submitEvaluation(c.id)}
                                disabled={evalRating < 1 || evalSubmitting}
                                className="flex-1 bg-[#FFC107] hover:bg-[#FFE84D] text-gray-900 font-bold rounded-full px-4 py-2.5 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                              >
                                {evalSubmitting
                                  ? (t('Envoi...', 'A enviar...'))
                                  : (t('Envoyer', 'Enviar'))}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEvalCandId(c.id)}
                            className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                          >
                            <Star className="h-4 w-4" />
                            {t('Évaluer cet artisan', 'Avaliar este profissional')}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {c.status === 'pending' && isOpen && (
                      <div className="flex gap-3 border-t border-gray-100 pt-4">
                        <button
                          type="button"
                          onClick={() => handleCandidatureAction(c.id, 'accepted')}
                          disabled={isLoading}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#FFC107] px-5 py-2.5 text-sm font-bold text-gray-900 shadow-[0_4px_14px_rgba(255,214,0,0.3)] hover:bg-[#FFE84D] hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          {t('Accepter', 'Aceitar')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCandidatureAction(c.id, 'rejected')}
                          disabled={isLoading}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border-[1.5px] border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          {t('Refuser', 'Recusar')}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
