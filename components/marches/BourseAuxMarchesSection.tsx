'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { fetchAuthentifie } from '@/lib/fetch-authentifie'
import { subscribeWithReconnect } from '@/lib/realtime-reconnect'
import {
  CATEGORIES,
  getCategoryLabel,
} from './views/shared'
import { METIER_CPV_MAP, resolveMetierKeys } from '@/lib/marches-cpv-mapping'
import { isSmallBusinessStatus } from '@/lib/devis-utils'
import { getDefaultCategoriesFromNaf } from '@/lib/naf-to-categories'
import { useLocale } from '@/lib/i18n/context'

const BrowseTabView = dynamic(() => import('./views/BrowseTabView'), { ssr: false })
const MyBidsTabView = dynamic(() => import('./views/MyBidsTabView'), { ssr: false })
const WonContractsTabView = dynamic(() => import('./views/WonContractsTabView'), { ssr: false })
const SettingsTabView = dynamic(() => import('./views/SettingsTabView'), { ssr: false })
const DetailModalView = dynamic(() => import('./views/DetailModalView'), { ssr: false })

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface Props {
  artisan: any
  orgRole?: OrgRole
  navigateTo: (page: string) => void
}

// titlePt : intitulé affiché en portugais (aperçu flouté de l'accès Pro).
const FAKE_MARCHES = [
  { title: 'Rénovation cage d\'escalier immeuble 12 lots', titlePt: 'Renovação da caixa de escadas de um prédio com 12 frações', category: 'renovacao', budget_min: 8000, budget_max: 15000, city: 'Porto', urgency: 'normal' },
  { title: 'Remplacement chaudière collective', titlePt: 'Substituição de caldeira coletiva', category: 'canalizacao', budget_min: 5000, budget_max: 12000, city: 'Lisboa', urgency: 'urgent' },
  { title: 'Ravalement façade bâtiment B', titlePt: 'Reabilitação da fachada do edifício B', category: 'construcao', budget_min: 20000, budget_max: 45000, city: 'Marseille', urgency: 'normal' },
]

export default function BourseAuxMarchesSection({ artisan, orgRole = 'artisan', navigateTo }: Props) {
  const isSociete = orgRole === 'pro_societe'
  // Langue de l'interface dès le premier rendu (avant : cookie lu après un premier rendu en français, d'où un premier
  // chargement « pays=FR » et un message français pour un utilisateur portugais).
  const locale = useLocale()
  const isPt = locale === 'pt'

  // PRO GATE CHECK — disabled temporarily, free access for all
  const isPro = true

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
  const isArtisan = orgRole === 'artisan'
  const [filterCategory, setFilterCategory] = useState('')
  const [filterGrandMarche, setFilterGrandMarche] = useState(false)
  const [filterRegion, setFilterRegion] = useState('paca')
  const [filterDepartments, setFilterDepartments] = useState<string[]>([])
  // Type union large pour supporter les valeurs des deux dropdowns (artisan vs BTP Pro).
  // Cf. components/marches/views/BrowseTabView.tsx → MarcheTypeFilter
  type MarcheTypeFilter = 'tous' | 'publics' | 'prives' | 'sous_traitance' | 'client_direct'
  const [filterMarcheType, setFilterMarcheType] = useState<MarcheTypeFilter>('tous')
  const [prefsSaved, setPrefsSaved] = useState(false)
  const artisanPays = isPt ? 'PT' : 'FR'

  // ─── Détection auto-entrepreneur (franchise 293 B / Art. 53 CIVA) ───
  // Conservé pour afficher le bandeau d'info AE expliquant le modèle d'opportunités.
  // Le contrôle des dropdowns/scan est désormais gouverné par `isArtisan` (toute artisan,
  // pas seulement AE, voit le dropdown Pro/Particulier et n'a pas de scan public).
  const [isFranchise, setIsFranchise] = useState<boolean>(false)
  useEffect(() => {
    if (!isArtisan) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/btp?table=settings', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        const statut: string | undefined = data?.settings?.statut_juridique || data?.settings?.company_type
        if (cancelled || !statut) return
        const franchise = isSmallBusinessStatus(statut, locale as 'fr' | 'pt')
        setIsFranchise(franchise)
      } catch { /* keep default false */ }
    })()
    return () => { cancelled = true }
  }, [isArtisan, locale])

  // Migration soft : si user est artisan et qu'une vieille préférence pointe vers
  // 'publics' ou 'prives' (issu du dropdown BTP), reset à 'tous'.
  useEffect(() => {
    if (isArtisan && (filterMarcheType === 'publics' || filterMarcheType === 'prives')) {
      setFilterMarcheType('tous')
    }
  }, [isArtisan, filterMarcheType])

  // Restore region/dept prefs from localStorage on mount
  useEffect(() => {
    if (!artisan?.id) return
    try {
      const saved = localStorage.getItem(`fixit_marches_geo_${artisan.id}`)
      if (saved) {
        const { region, departments } = JSON.parse(saved)
        if (region) setFilterRegion(region)
        if (departments?.length) setFilterDepartments(departments)
      }
    } catch {
      // ignore
    }
  }, [artisan?.id])

  const saveGeoPrefs = () => {
    if (!artisan?.id) return
    try {
      localStorage.setItem(`fixit_marches_geo_${artisan.id}`, JSON.stringify({ region: filterRegion, departments: filterDepartments }))
      setPrefsSaved(true)
      setTimeout(() => setPrefsSaved(false), 2000)
    } catch {
      // ignore
    }
  }

  // Bid form state
  const [bidPrice, setBidPrice] = useState('')
  const [bidTimeline, setBidTimeline] = useState('')
  const [bidDescription, setBidDescription] = useState('')
  const [bidMaterials, setBidMaterials] = useState(false)
  const [bidGuarantee, setBidGuarantee] = useState('')
  const [bidEffectif, setBidEffectif] = useState('')
  const [bidSubmitting, setBidSubmitting] = useState(false)
  const [bidError, setBidError] = useState('')
  const [bidSuccess, setBidSuccess] = useState(false)

  // Stats
  const [stats, setStats] = useState({ openCount: 0, activeBids: 0, wonCount: 0 })

  // Evaluation state
  const [receivedEval, setReceivedEval] = useState<Record<string, any>>({})

  // Messaging state
  const [msgCandidatureId, setMsgCandidatureId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [msgLoading, setMsgLoading] = useState(false)

  // Alerts state
  const [alerts, setAlerts] = useState<{ expiringCount: number; unreadMessages: number }>({ expiringCount: 0, unreadMessages: 0 })

  // Scanner state
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState<any[]>([])
  const [scanMeta, setScanMeta] = useState<any>(null)
  const [scanError, setScanError] = useState('')
  const [showScanResults, setShowScanResults] = useState(true)

  // Corps de métier de l'artisan (sans tenir compte du filtre transitoire)
  // ⚠️ Doit être déclaré AVANT fetchMarches pour éviter un TDZ dans le dep array de useCallback.
  const artisanCoreMetiers = React.useMemo(() => {
    if (marchesPrefs.marches_categories?.length) return [...marchesPrefs.marches_categories]
    if (artisan?.categories?.length) return [...artisan.categories]
    if (artisan?.specialite) return [artisan.specialite]
    // Fallback NAF runtime : sociétés inscrites avant le commit 1f90923 (auto-fill NAF)
    // n'ont pas categories renseignées → on les dérive depuis profiles_artisan.naf_code.
    const nafCode = (artisan as unknown as { naf_code?: string })?.naf_code
    if (nafCode) {
      const derived = getDefaultCategoriesFromNaf(nafCode)
      if (derived.length > 0) return derived
    }
    return []
  }, [marchesPrefs.marches_categories, artisan?.categories, artisan?.specialite, (artisan as unknown as { naf_code?: string })?.naf_code])

  // Signature stable pour les hooks dépendants : évite la cascade de re-fetch quand
  // setMarchesPrefs reçoit un nouvel objet (même contenu, nouvelle référence d'array).
  // Sans ça, fetchMarches se régénère à chaque render → useEffect retrigger → fetch boucle
  // → rate limit 429 sur /api/marches.
  const artisanMetiersKey = artisanCoreMetiers.join(',')

  // Fetch marches
  const fetchMarches = useCallback(async () => {
    if (!isPro) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterCategory) params.set('category', filterCategory)
      params.set('pays', artisanPays)
      params.set('status', 'open')
      // Filtre privés/publics côté serveur — sinon les scrappés (scan_*) restent visibles.
      //
      // Cas particulier artisan + "Tous" : on envoie 'prives' au lieu de rien
      // pour exclure les marchés publics scrapés que l'artisan ne doit jamais voir
      // (la rule d'isolation artisan/BTP s'applique aussi quand le filtre est "tous").
      if (filterMarcheType === 'tous') {
        if (isArtisan) params.set('marche_type', 'prives')
        // BTP Pro "Tous" → vraiment tout (publics + privés)
      } else {
        params.set('marche_type', filterMarcheType)
      }
      // Filtre intelligent par métier : artisan ET société BTP ne voient que les marchés
      // correspondant à leurs corps de métier déclarés (auto-remplis depuis NAF pour BTP).
      // Le serveur résout via METIER_CPV_MAP.
      if (artisanCoreMetiers.length > 0) {
        params.set('metiers', artisanCoreMetiers.join(','))
      }
      const res = await fetch(`/api/marches?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch marches')
      const data = await res.json()
      setMarches(data.marches || [])
      setStats(prev => ({ ...prev, openCount: data.total || data.marches?.length || 0 }))
    } catch (e) {
      console.error('Marches fetch failed:', e)
      toast.error(isPt ? 'Erro ao carregar as oportunidades' : 'Erreur de chargement des marchés')
      setMarches([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- artisanMetiersKey is the stable signature
  }, [isPro, filterCategory, artisanPays, filterMarcheType, isArtisan, artisanMetiersKey, isPt])

  // Resolved metiers for auto-scan (respecte le filtre si posé)
  const resolvedMetiers = React.useMemo(() => {
    if (filterCategory) return [filterCategory]
    return artisanCoreMetiers
  }, [filterCategory, artisanCoreMetiers])

  // Compteur "vraiment affichable" — applique le même filtre métier que BrowseTabView
  // pour éviter le décalage trompeur "100 disponibles / 0 affichés".
  const visibleMarchesCount = React.useMemo(() => {
    if (!artisanCoreMetiers || artisanCoreMetiers.length === 0) return marches.length
    const allowed = new Set<string>()
    const metierKeys = resolveMetierKeys(artisanCoreMetiers)
    for (const key of metierKeys) {
      const m = METIER_CPV_MAP[key]
      if (m) m.categoryIds.forEach(c => allowed.add(c))
    }
    for (const input of artisanCoreMetiers) {
      const lower = input.toLowerCase().trim()
      if (CATEGORIES.some(c => c.id === lower)) allowed.add(lower)
    }
    if (allowed.size === 0) return marches.length
    return marches.filter(m => !m.category || allowed.has(m.category)).length
  }, [marches, artisanCoreMetiers])

  // Scanner marches publics
  const handleScanMarches = useCallback(async () => {
    const metiers = [...resolvedMetiers]
    if (metiers.length === 0) {
      setScanError(isPt ? 'Selecione uma categoria primeiro' : 'Sélectionnez un corps de métier dans le menu déroulant')
      return
    }
    setScanning(true)
    setScanError('')
    setScanResults([])
    setScanMeta(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) { setScanError(isPt ? 'Sessão expirada' : 'Session expirée'); return }
      const loc = artisan?.city || (isPt ? 'Porto' : 'Marseille')
      console.log('[scan] Envoi:', { metiers, location: loc, country: isPt ? 'PT' : 'FR' })
      const res = await fetch('/api/marches/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          country: isPt ? 'PT' : 'FR',
          daysBack: 30,
          metiers,
          location: loc,
          region: filterRegion || undefined,
          departments: filterDepartments.length > 0 ? filterDepartments : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setScanError(err.error || (isPt ? `Erro ${res.status}` : `Erreur ${res.status}`))
        return
      }
      const data = await res.json()
      setScanResults(data.marches || [])
      setScanMeta(data.meta || null)
      setShowScanResults(true)
    } catch (err) {
      setScanError(isPt ? 'Erro de ligação ao scanner' : 'Erreur de connexion au scanner')
    } finally {
      setScanning(false)
    }
  }, [isPt, artisan, resolvedMetiers, filterRegion, filterDepartments])

  // Fetch my bids
  const fetchMyBids = useCallback(async () => {
    if (!isPro || !artisan?.id) return
    try {
      // Route réservée au titulaire de la fiche (ses candidatures et leurs prix) : jeton requis.
      const res = await fetchAuthentifie(`/api/marches?my_bids=true&artisan_id=${artisan.id}`)
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
      // Société BTP : un refus du serveur (session expirée, limite de débit, panne) est dit, sinon il s'affiche
      // comme « aucune candidature ». Identifiant fixe : une relance remplace le message au lieu de l'empiler.
      // Côté artisan, le comportement n'est pas modifié (règle artisan / BTP).
      if (isSociete) toast.error(isPt ? 'Não foi possível carregar as suas candidaturas' : 'Impossible de charger vos candidatures', { id: 'marches-mes-candidatures' })
    }
  }, [isPro, artisan?.id, isSociete, isPt])

  // Fetch marches preferences
  const fetchMarchesPrefs = useCallback(async () => {
    if (!isPro || !artisan?.id) return
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) return
      const res = await fetch('/api/artisan-marches-prefs', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMarchesPrefs({
          marches_opt_in: data.marches_opt_in ?? false,
          marches_categories: data.marches_categories ?? [],
          marches_work_mode: data.marches_work_mode ?? 'forfait',
          marches_tarif_journalier: data.marches_tarif_journalier ?? null,
          marches_tarif_horaire: data.marches_tarif_horaire ?? null,
          marches_description: data.marches_description ?? '',
        })
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

  // Candidater, les messages et les évaluations passent par des routes qui exigent le jeton de la session
  // (getAuthUser ne lit que l'en-tête Authorization) : la société BTP l'envoie. Côté artisan, l'appel d'origine est
  // conservé (règle artisan / BTP) ; le même défaut y reste, signalé.
  const appelDuCompte = useCallback(
    (url: string, options?: RequestInit) => (isSociete ? fetchAuthentifie(url, options) : fetch(url, options)),
    [isSociete],
  )

  // Load messages for a candidature
  const loadMessages = useCallback(async (marcheId: string, candidatureId: string) => {
    setMsgLoading(true)
    try {
      const res = await appelDuCompte(`/api/marches/${marcheId}/messages?candidature_id=${candidatureId}&artisan_id=${artisan?.id}`)
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
  }, [artisan?.id, appelDuCompte])

  // Send a message
  const sendMessage = async (marcheId: string, candidatureId: string) => {
    if (!msgInput.trim() || msgSending) return
    setMsgSending(true)
    try {
      const res = await appelDuCompte(`/api/marches/${marcheId}/messages`, {
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
    } catch (e) {
      console.error('Message send failed:', e)
      toast.error(isPt ? 'Erro ao enviar a mensagem' : 'Erreur d\'envoi du message')
    } finally {
      setMsgSending(false)
    }
  }

  // Submit evaluation (delegated to WonContractsTabView)
  const submitEvaluation = async (marcheId: string, candidatureId: string, rating: number, comment: string) => {
    const res = await appelDuCompte(`/api/marches/${marcheId}/evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidature_id: candidatureId,
        evaluator_type: 'artisan',
        note_globale: rating,
        commentaire: comment || undefined,
      }),
    })
    if (!res.ok) throw new Error('Evaluation failed')
  }

  // Load evaluation received from publisher
  const loadReceivedEvaluation = useCallback(async (marcheId: string) => {
    try {
      const res = await appelDuCompte(`/api/marches/${marcheId}/evaluation?artisan_id=${artisan?.id}&type=from_publisher`)
      if (res.ok) {
        const data = await res.json()
        // Société BTP : la route rend la liste des évaluations des candidatures du compte (evaluations) ; celle du
        // donneur d'ordre y est prise, et son commentaire (commentaire) passé sous le nom que lit la vue (comment).
        const recue = isSociete
          ? (data.evaluations as Array<Record<string, unknown>> | undefined)?.find(e => e.evaluator_type === 'publisher')
          : null
        if (recue) {
          setReceivedEval(prev => ({ ...prev, [marcheId]: { ...recue, comment: recue.commentaire } }))
        } else if (!isSociete && data.evaluation) {
          setReceivedEval(prev => ({ ...prev, [marcheId]: data.evaluation }))
        }
      }
    } catch {
      // silent
    }
  }, [artisan?.id, appelDuCompte, isSociete])

  // Save marches preferences
  const saveMarchesPrefs = async () => {
    if (!artisan?.id) return
    setPrefsSaving(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) {
        toast.error(isPt ? 'Sessão expirada. Inicie sessão novamente.' : 'Session expirée, reconnectez-vous')
        return
      }
      const res = await fetch('/api/artisan-marches-prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(marchesPrefs),
      })
      if (res.ok) {
        toast.success(isPt ? 'Preferências guardadas' : 'Préférences enregistrées')
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || (isPt ? 'Erro ao guardar' : 'Erreur lors de la sauvegarde'))
      }
    } catch {
      toast.error(isPt ? 'Erro de rede' : 'Erreur réseau')
    } finally {
      setPrefsSaving(false)
    }
  }

  useEffect(() => {
    fetchMarches()
    fetchMyBids()
    fetchMarchesPrefs()
  }, [fetchMarches, fetchMyBids, fetchMarchesPrefs])

  // Auto-scan on load (max 1 per 24h per artisan)
  const hasAutoScanned = useRef(false)
  useEffect(() => {
    if (hasAutoScanned.current) return
    if (resolvedMetiers.length === 0) return
    if (scanning) return
    const cacheKey = `fixit_scan_last_${artisan?.id}`
    const lastScan = localStorage.getItem(cacheKey)
    const now = Date.now()
    if (lastScan && now - parseInt(lastScan) < 24 * 60 * 60 * 1000) return
    hasAutoScanned.current = true
    localStorage.setItem(cacheKey, String(now))
    handleScanMarches()
  }, [resolvedMetiers, scanning, handleScanMarches, artisan?.id])

  // Realtime listener for marche notifications
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
          fetchMarches()
          fetchMyBids()
        }
      })
    subscribeWithReconnect(channel, (status, err) => {
      console.error(`[BourseAuxMarches] Realtime ${status}:`, err)
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
      const res = await appelDuCompte(`/api/marches/${selectedMarche.id}/candidature`, {
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
        throw new Error(err.error || (isPt ? 'Erro ao enviar a candidatura' : 'Submission failed'))
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
    setMsgCandidatureId(null)
  }

  // ── PRO GATE ──
  if (!isPro) {
    return (
      <div style={{ padding: 14 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ filter: 'blur(4px)', opacity: 0.6, pointerEvents: 'none', userSelect: 'none' }} aria-hidden="true">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
              {FAKE_MARCHES.map((fm, i) => (
                <div key={i} className="v22-card" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span className="v22-tag v22-tag-yellow">
                      {getCategoryLabel(fm.category, isPt)}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{isPt ? fm.titlePt : fm.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginBottom: 6 }}>📍 {fm.city}</div>
                  <div className="v22-mono" style={{ fontSize: 12, fontWeight: 500 }}>
                    {formatPrice(fm.budget_min, locale)} - {formatPrice(fm.budget_max, locale)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="v22-card" style={{ padding: '28px 32px', maxWidth: 440, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏛️</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                {isPt ? 'Bolsa de oportunidades' : 'Bourse aux Marchés'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
                {isPt
                  ? 'Aceda a dezenas de oportunidades publicadas por administradores de condomínio, empresas e particulares. Candidate-se diretamente e conquiste novos contratos.'
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

  // ── DETAIL VIEW (MODAL) ──
  if (selectedMarche) {
    return (
      <DetailModalView
        isPt={isPt}
        locale={locale}
        isSociete={isSociete}
        selectedMarche={selectedMarche}
        artisan={artisan}
        messages={messages}
        msgLoading={msgLoading}
        msgSending={msgSending}
        msgInput={msgInput}
        msgCandidatureId={msgCandidatureId}
        onMsgInputChange={setMsgInput}
        onMsgCandidatureIdChange={setMsgCandidatureId}
        onLoadMessages={loadMessages}
        onSendMessage={sendMessage}
        onSubmitBid={handleSubmitBid}
        bidSubmitting={bidSubmitting}
        bidError={bidError}
        bidSuccess={bidSuccess}
        showBidForm={showBidForm}
        onShowBidFormChange={setShowBidForm}
        bidPrice={bidPrice}
        bidTimeline={bidTimeline}
        bidDescription={bidDescription}
        bidMaterials={bidMaterials}
        bidGuarantee={bidGuarantee}
        bidEffectif={bidEffectif}
        onBidPriceChange={setBidPrice}
        onBidTimelineChange={setBidTimeline}
        onBidDescriptionChange={setBidDescription}
        onBidMaterialsChange={setBidMaterials}
        onBidGuaranteeChange={setBidGuarantee}
        onBidEffectifChange={setBidEffectif}
        onBidErrorChange={setBidError}
        onClose={resetDetail}
      />
    )
  }

  // ── MAIN LIST VIEW ──
  const wonBids = myBids.filter(b => b.status === 'accepted')

  const tabs = [
    // L'artisan ne voit que des marchés privés (filtre « prives » ci-dessus) : « Concursos » (marchés publics) ne lui va pas.
    { key: 'browse' as const, labelFr: 'Marchés', labelPt: isArtisan ? 'Oportunidades' : 'Concursos' },
    { key: 'mybids' as const, labelFr: 'Candidatures', labelPt: 'Candidaturas' },
    { key: 'won' as const, labelFr: 'Gagnés', labelPt: 'Ganhos' },
    { key: 'settings' as const, labelFr: 'Paramètres', labelPt: 'Definições' },
  ]

  return (
    <div>
      {/* Page header */}
      <div className="v22-page-header" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="v22-page-title">{isPt ? 'Bolsa de oportunidades' : 'Bourse aux Marchés'}</div>
          <div className="v22-page-sub">
            {visibleMarchesCount} {isPt ? 'oportunidades disponíveis' : 'opportunités disponibles'}
          </div>
        </div>
        {(filterCategory || filterDepartments.length > 0) && (
          <button
            onClick={() => { setFilterCategory(''); setFilterDepartments([]) }}
            className="v22-btn v22-btn-sm"
          >
            {isPt ? 'Repor' : 'Réinitialiser'}
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="v22-stats">
        <div className="v22-stat v22-stat-yellow">
          <div className="v22-stat-label">{isPt ? 'Novas' : 'Nouvelles'}</div>
          <div className="v22-stat-val">{visibleMarchesCount}</div>
        </div>
        <div className="v22-stat">
          <div className="v22-stat-label">{isPt ? 'Candidaturas' : 'Candidatures'}</div>
          <div className="v22-stat-val">{stats.activeBids}</div>
        </div>
        <div className="v22-stat">
          <div className="v22-stat-label">{isPt ? 'Orçamento máx.' : 'Budget max'}</div>
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

      {/* Tab content */}
      {activeTab === 'browse' && (
        <BrowseTabView
          isPt={isPt}
          locale={locale}
          marches={marches}
          loading={loading}
          scanning={scanning}
          scanResults={scanResults}
          scanMeta={scanMeta}
          scanError={scanError}
          showScanResults={showScanResults}
          alerts={alerts}
          prefsLoaded={prefsLoaded}
          marchesOptIn={marchesPrefs.marches_opt_in}
          filterCategory={filterCategory}
          filterRegion={filterRegion}
          filterDepartments={filterDepartments}
          filterMarcheType={filterMarcheType}
          hidePublicMarches={isFranchise}
          isArtisan={isArtisan}
          prefsSaved={prefsSaved}
          onFilterCategoryChange={setFilterCategory}
          onFilterRegionChange={setFilterRegion}
          onFilterDepartmentsChange={setFilterDepartments}
          onFilterMarcheTypeChange={setFilterMarcheType}
          onScanMarches={handleScanMarches}
          onSaveGeoPrefs={saveGeoPrefs}
          onSelectMarche={setSelectedMarche}
          onGoToSettings={() => setActiveTab('settings')}
          artisanMetiers={artisanCoreMetiers}
        />
      )}

      {activeTab === 'mybids' && (
        <MyBidsTabView
          isPt={isPt}
          locale={locale}
          myBids={myBids}
          onGoToBrowse={() => setActiveTab('browse')}
        />
      )}

      {activeTab === 'won' && (
        <WonContractsTabView
          isPt={isPt}
          locale={locale}
          wonBids={wonBids}
          receivedEval={receivedEval}
          onGoToBrowse={() => setActiveTab('browse')}
          onSubmitEvaluation={submitEvaluation}
          onLoadReceivedEvaluation={loadReceivedEvaluation}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsTabView
          isPt={isPt}
          marchesPrefs={marchesPrefs}
          prefsSaving={prefsSaving}
          onPrefsChange={setMarchesPrefs}
          onSave={saveMarchesPrefs}
          artisanCategories={artisan?.categories || []}
        />
      )}
    </div>
  )
}
