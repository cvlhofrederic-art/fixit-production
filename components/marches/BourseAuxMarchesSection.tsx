'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { formatPrice } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { subscribeWithReconnect } from '@/lib/realtime-reconnect'
import {
  getCategoryLabel,
} from './views/shared'

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
  const [filterCategory, setFilterCategory] = useState('')
  const [filterGrandMarche, setFilterGrandMarche] = useState(false)
  const [filterRegion, setFilterRegion] = useState('paca')
  const [filterDepartments, setFilterDepartments] = useState<string[]>([])
  const [filterMarcheType, setFilterMarcheType] = useState<'tous' | 'publics' | 'prives'>('tous')
  const [prefsSaved, setPrefsSaved] = useState(false)
  const artisanPays = isPt ? 'PT' : 'FR'

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

  // Fetch marches
  const fetchMarches = useCallback(async () => {
    if (!isPro) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterCategory) params.set('category', filterCategory)
      params.set('pays', artisanPays)
      params.set('status', 'open')
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
  }, [isPro, filterCategory, artisanPays])

  // Resolved metiers for auto-scan
  const resolvedMetiers = React.useMemo(() => {
    if (filterCategory) return [filterCategory]
    if (marchesPrefs.marches_categories?.length) return [...marchesPrefs.marches_categories]
    if (artisan?.categories?.length) return [...artisan.categories]
    if (artisan?.specialite) return [artisan.specialite]
    return []
  }, [filterCategory, marchesPrefs.marches_categories, artisan?.categories, artisan?.specialite])

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
      if (!token) { setScanError('Session expirée'); return }
      const loc = artisan?.city || (isPt ? 'Porto' : 'Marseille')
      // eslint-disable-next-line no-console
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
        setScanError(err.error || `Erreur ${res.status}`)
        return
      }
      const data = await res.json()
      setScanResults(data.marches || [])
      setScanMeta(data.meta || null)
      setShowScanResults(true)
    } catch (err) {
      setScanError('Erreur de connexion au scanner')
    } finally {
      setScanning(false)
    }
  }, [isPt, artisan, resolvedMetiers, filterRegion, filterDepartments])

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

  // Submit evaluation (delegated to WonContractsTabView)
  const submitEvaluation = async (marcheId: string, candidatureId: string, rating: number, comment: string) => {
    const res = await fetch(`/api/marches/${marcheId}/evaluation`, {
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
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{fm.title}</div>
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
        {(filterCategory || filterDepartments.length > 0) && (
          <button
            onClick={() => { setFilterCategory(''); setFilterDepartments([]) }}
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
          prefsSaved={prefsSaved}
          onFilterCategoryChange={setFilterCategory}
          onFilterRegionChange={setFilterRegion}
          onFilterDepartmentsChange={setFilterDepartments}
          onFilterMarcheTypeChange={setFilterMarcheType}
          onScanMarches={handleScanMarches}
          onSaveGeoPrefs={saveGeoPrefs}
          onSelectMarche={setSelectedMarche}
          onGoToSettings={() => setActiveTab('settings')}
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
        />
      )}
    </div>
  )
}
