'use client'

import { useState, useEffect, useRef } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import { supabase } from '@/lib/supabase'

/* ══════════ MATÉRIAUX & PRIX SECTION ══════════ */

interface MatPrice { store: string; price: number; url: string | null }
interface MatItem { name: string; qty: number; unit: string; category: string; norms: string[]; normDetails: string; prices: MatPrice[]; bestPrice: { store: string; price: number } | null; avgPrice: number }
interface MatSearch { id: string; date: string; query: string; city: string | null; materials: MatItem[]; totalEstimate: { min: number; max: number } | null }
interface ProductResult { name: string; description: string; price: number; store: string; url: string; image: string | null; condition: 'new' | 'refurbished' }
interface ExportLine { id: number; description: string; qty: number; unit: string; priceHT: number; tvaRate: number; totalHT: number }

const JOB_PRESETS_FR = [
  { label: '🚿 Chauffe-eau', q: 'Remplacement chauffe-eau thermodynamique 200L' },
  { label: '🪟 Carrelage 20m²', q: 'Pose carrelage sol 20m² format 60x60' },
  { label: '⚡ Tableau électrique', q: 'Remplacement tableau électrique 8 circuits' },
  { label: '🚪 Salle de bain', q: 'Rénovation salle de bain complète 6m²' },
  { label: '🔩 Robinetterie', q: 'Remplacement robinetterie cuisine et salle de bain' },
  { label: '🧱 Isolation combles', q: 'Isolation combles perdus 50m² laine de verre' },
]

const JOB_PRESETS_SOCIETE_FR = [
  { label: '🏗️ Béton structure', q: 'Béton armé fondations + plancher dalle 200m² chantier neuf' },
  { label: '🪵 Charpente bois', q: 'Charpente traditionnelle bois 150m² + couverture tuile' },
  { label: '🔩 Ossature métallique', q: 'Ossature métallique IPE HEA bardage 500m² bâtiment industriel' },
  { label: '🧱 Gros œuvre', q: 'Parpaings + mortier + linteaux immeuble R+3 200m²' },
  { label: '🌿 Isolation façade ITE', q: 'Isolation thermique extérieure polystyrène 300m² immeuble' },
  { label: '🚧 VRD voirie', q: 'Enrobé bitumineux + bordures béton voirie 1000m² lotissement' },
  { label: '🔌 Courant fort CFO', q: 'Câblage CFO + armoire électrique TGBT immeuble 20 lots' },
  { label: '💧 Réseau plomberie', q: 'Réseau alimentation + évacuation PVC cuivre immeuble neuf 20 appartements' },
]
const JOB_PRESETS_PT = [
  { label: '🚿 Aquecedor', q: 'Substituição esquentador termostático 200L' },
  { label: '🪟 Azulejo 20m²', q: 'Colocação azulejo pavimento 20m² formato 60x60' },
  { label: '⚡ Quadro elétrico', q: 'Substituição quadro elétrico 8 circuitos' },
  { label: '🚪 Casa de banho', q: 'Renovação casa de banho completa 6m²' },
  { label: '🔩 Torneiras', q: 'Substituição torneiras cozinha e casa de banho' },
  { label: '🧱 Isolamento sótão', q: 'Isolamento sótão 50m² lã de vidro' },
]

const STORE_COLORS: Record<string, string> = {
  'Leroy Merlin': 'v22-tag v22-tag-green',
  'Brico Dépôt': 'v22-tag v22-tag-amber',
  'Castorama': 'v22-tag v22-tag-gray',
  'Point P': 'v22-tag v22-tag-red',
  'Cédéo': 'v22-tag v22-tag-gray',
  'Mr.Bricolage': 'v22-tag v22-tag-yellow',
  'Brico Leclerc': 'v22-tag v22-tag-green',
  'Amazon': 'v22-tag v22-tag-amber',
  'Amazon.fr': 'v22-tag v22-tag-amber',
  'ManoMano': 'v22-tag v22-tag-gray',
  'Toolstation': 'v22-tag v22-tag-red',
  'Cdiscount': 'v22-tag v22-tag-red',
  // PT stores
  'Leroy Merlin PT': 'v22-tag v22-tag-green',
  'AKI': 'v22-tag v22-tag-amber',
  'Bricomarché': 'v22-tag v22-tag-gray',
  'Maxmat': 'v22-tag v22-tag-red',
  'Wurth': 'v22-tag v22-tag-red',
  'Sanitop': 'v22-tag v22-tag-gray',
}

// ─── Coordonnées GPS des magasins physiques (marchés PT + FR) ───
interface StoreLocation { name: string; lat: number; lng: number; label: string }
const STORE_LOCATIONS: StoreLocation[] = [
  // PT — Norte (Porto / Tâmega e Sousa)
  { name: 'Leroy Merlin PT', lat: 41.1896, lng: -8.6827, label: 'Matosinhos' },
  { name: 'Leroy Merlin PT', lat: 41.1159, lng: -8.6139, label: 'Gaia' },
  { name: 'Leroy Merlin PT', lat: 41.2356, lng: -8.6199, label: 'Maia' },
  { name: 'AKI', lat: 41.1877, lng: -8.6943, label: 'Matosinhos' },
  { name: 'AKI', lat: 41.1596, lng: -8.6359, label: 'Porto' },
  { name: 'AKI', lat: 41.2080, lng: -8.2845, label: 'Penafiel' },
  { name: 'Maxmat', lat: 41.1615, lng: -8.6564, label: 'Porto' },
  { name: 'Maxmat', lat: 41.1844, lng: -8.1544, label: 'Marco Canaveses' },
  { name: 'Maxmat', lat: 41.2723, lng: -8.0811, label: 'Amarante' },
  { name: 'Bricomarché', lat: 41.1844, lng: -8.1544, label: 'Marco Canaveses' },
  { name: 'Bricomarché', lat: 41.2080, lng: -8.2845, label: 'Penafiel' },
  { name: 'Wurth', lat: 41.1579, lng: -8.6291, label: 'Porto' },
  { name: 'Wurth', lat: 41.2356, lng: -8.6199, label: 'Maia' },
  { name: 'Sanitop', lat: 41.1615, lng: -8.6564, label: 'Porto' },
  // FR — PACA (Marseille / Aix-en-Provence)
  { name: 'Leroy Merlin', lat: 43.3065, lng: 5.3655, label: 'Marseille La Valentine' },
  { name: 'Leroy Merlin', lat: 43.4510, lng: 5.3916, label: 'Aix-en-Provence' },
  { name: 'Leroy Merlin', lat: 43.2956, lng: 5.5708, label: 'Aubagne' },
  { name: 'Brico Dépôt', lat: 43.3188, lng: 5.3917, label: 'Marseille' },
  { name: 'Brico Dépôt', lat: 43.4335, lng: 5.2141, label: 'Vitrolles' },
  { name: 'Castorama', lat: 43.2784, lng: 5.3806, label: 'Marseille' },
  { name: 'Point P', lat: 43.3097, lng: 5.3789, label: 'Marseille' },
  { name: 'Point P', lat: 43.4510, lng: 5.3916, label: 'Aix-en-Provence' },
  { name: 'Cédéo', lat: 43.3030, lng: 5.3830, label: 'Marseille' },
  { name: 'Mr.Bricolage', lat: 43.2520, lng: 5.3980, label: 'La Ciotat' },
  { name: 'Toolstation', lat: 43.3100, lng: 5.3750, label: 'Marseille' },
]

/** Distance haversine en km entre deux points GPS */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Trouve le magasin le plus proche pour une enseigne donnée */
function getNearestStore(storeName: string, userLat: number, userLng: number): { distance: number; label: string } | null {
  const matches = STORE_LOCATIONS.filter(s => storeName.includes(s.name) || s.name.includes(storeName))
  if (matches.length === 0) return null
  let best: { distance: number; label: string } | null = null
  for (const m of matches) {
    const d = haversineKm(userLat, userLng, m.lat, m.lng)
    if (!best || d < best.distance) best = { distance: Math.round(d), label: m.label }
  }
  return best
}

const PRODUCT_PRESETS_FR = [
  { label: '🔧 Disqueuse', q: 'disqueuse meuleuse 125mm' },
  { label: '🔩 Perceuse', q: 'perceuse visseuse sans fil 18V' },
  { label: '💨 Karcher', q: 'nettoyeur haute pression karcher' },
  { label: '🪜 Échafaudage', q: 'échafaudage roulant aluminium' },
  { label: '📐 Laser', q: 'niveau laser croix vert' },
  { label: '🔨 Visseuse', q: 'visseuse à chocs 18V' },
]
const PRODUCT_PRESETS_PT = [
  { label: '🔧 Rebarbadora', q: 'rebarbadora 125mm' },
  { label: '🔩 Berbequim', q: 'berbequim aparafusadora sem fio 18V' },
  { label: '💨 Karcher', q: 'lavadora de alta pressão karcher' },
  { label: '🪜 Andaime', q: 'andaime rolante alumínio' },
  { label: '📐 Laser', q: 'nível laser cruzado verde' },
  { label: '🔨 Aparafusadora', q: 'aparafusadora de impacto 18V' },
]

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

export default function MateriauxSection({ artisan, onExportDevis, orgRole }: { artisan: import('@/lib/types').Artisan; onExportDevis: (lines: ExportLine[]) => void; orgRole?: OrgRole }) {
  const isSociete = orgRole === 'pro_societe'
  const isV5 = orgRole === 'pro_societe'
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const [activeTab, setActiveTab] = useState<'recherche' | 'historique' | 'aide'>('recherche')
  const [userCity, setUserCity] = useState<string | null>(null)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [chatStarted, setChatStarted] = useState(false)
  const [currentResults, setCurrentResults] = useState<MatItem[] | null>(null)
  const [currentEstimate, setCurrentEstimate] = useState<{ min: number; max: number } | null>(null)
  const [isFallback, setIsFallback] = useState(false)
  const [savedSearches, setSavedSearches] = useState<MatSearch[]>(() => {
    try { return JSON.parse(localStorage.getItem(`fixit_materiaux_${artisan?.id}`) || '[]') } catch { return [] }
  })
  const [globalMarkup, setGlobalMarkup] = useState(15)
  const [searchMode, setSearchMode] = useState<'project' | 'product'>('project')
  const [productResults, setProductResults] = useState<ProductResult[] | null>(null)
  const [productRecommendations, setProductRecommendations] = useState('')
  const [productFetchedAt, setProductFetchedAt] = useState<string | null>(null)
  const [productTab, setProductTab] = useState<'new' | 'refurbished'>('new')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentResults])

  // Auto-geoloc au mount (silencieux — pas d'erreur si refusé)
  useEffect(() => {
    if (userCity || typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
            { headers: { 'User-Agent': 'Vitfix-Pro/1.0' } }
          )
          const data = await res.json()
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || null
          if (city) setUserCity(city)
        } catch { /* silencieux */ }
      },
      () => { /* silencieux — l'utilisateur pourra cliquer manuellement */ },
      { timeout: 5000, maximumAge: 600000 }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGeolocation = () => {
    if (!navigator.geolocation) { setGeoError(locale === 'pt' ? 'Geolocalização não suportada' : 'Géolocalisation non supportée'); return }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
            { headers: { 'User-Agent': 'Vitfix-Pro/1.0' } }
          )
          const data = await res.json()
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || null
          setUserCity(city)
        } catch { setGeoError(locale === 'pt' ? 'Impossível determinar a cidade' : 'Impossible de déterminer la ville') }
        setGeoLoading(false)
      },
      (err) => {
        setGeoError(err.code === 1 ? (locale === 'pt' ? 'Acesso à localização recusado' : 'Accès à la position refusé') : (locale === 'pt' ? 'Erro de geolocalização' : 'Erreur de géolocalisation'))
        setGeoLoading(false)
      },
      { timeout: 8000, maximumAge: 300000 }
    )
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return
    setChatStarted(true)
    setCurrentResults(null)
    setCurrentEstimate(null)
    setProductResults(null)
    setProductRecommendations('')
    setProductFetchedAt(null)
    setProductTab('new')
    const userMsg = { role: 'user' as const, content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/materiaux-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query: text.trim(),
          city: userCity,
          mode: searchMode,
          conversationHistory: messages.slice(-6),
          locale,
        }),
      })
      const data = await res.json()

      // Handle API errors
      if (!res.ok || data.error) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ ${data.error || (locale === 'pt' ? 'Erro do servidor. Tente novamente.' : 'Erreur serveur. Veuillez réessayer.')}`,
        }])
        setIsLoading(false)
        setTimeout(() => inputRef.current?.focus(), 100)
        return
      }

      // Handle product mode response
      if (searchMode === 'product') {
        const products = data.products?.length > 0 ? data.products.map((p: ProductResult) => ({
          ...p,
          condition: p.condition === 'refurbished' ? 'refurbished' : 'new',
        })) : null
        setProductResults(products)
        setProductRecommendations(data.recommendations || '')
        setProductFetchedAt(data.fetchedAt || new Date().toISOString())
        // Auto-select tab with results
        if (products) {
          const hasNew = products.some((p: ProductResult) => p.condition === 'new')
          const hasRefurb = products.some((p: ProductResult) => p.condition === 'refurbished')
          setProductTab(hasNew ? 'new' : hasRefurb ? 'refurbished' : 'new')
        }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response || (data.products?.length > 0
            ? (locale === 'pt' ? 'Aqui estão os produtos encontrados.' : 'Voici les produits trouvés.')
            : (locale === 'pt' ? 'Nenhum produto encontrado. Tente uma pesquisa mais precisa.' : 'Aucun produit trouvé. Essayez une recherche plus précise.')),
        }])
        setIsLoading(false)
        setTimeout(() => inputRef.current?.focus(), 100)
        return
      }

      setIsFallback(data.fallback || false)

      if (data.materials?.length > 0) {
        setCurrentResults(data.materials)
        setCurrentEstimate(data.totalEstimate || null)
        // Save to history
        const search: MatSearch = {
          id: Date.now().toString(),
          date: new Date().toISOString().split('T')[0],
          query: text.trim(),
          city: userCity,
          materials: data.materials,
          totalEstimate: data.totalEstimate || null,
        }
        const updated = [search, ...savedSearches].slice(0, 20)
        setSavedSearches(updated)
        localStorage.setItem(`fixit_materiaux_${artisan?.id}`, JSON.stringify(updated))
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response || (locale === 'pt' ? 'Aqui estão os materiais identificados para a sua obra.' : 'Voici les matériaux identifiés pour votre chantier.'),
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: locale === 'pt' ? '❌ Erro de ligação. Tente novamente.' : '❌ Erreur de connexion. Veuillez réessayer.',
      }])
    }
    setIsLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // ─── Logique fiscale selon statut artisan ────────────────────────────────
  const artisanLegalForm = ((artisan as unknown as { legal_form?: string })?.legal_form || '').toLowerCase()
  const isAutoEntrepreneur = artisanLegalForm.includes('auto') || artisanLegalForm.includes('micro') || artisanLegalForm.includes('individuel')
  const isAssujetti = artisanLegalForm.includes('sarl') || artisanLegalForm.includes('sas') || artisanLegalForm.includes('eurl') || artisanLegalForm.includes('sa ')

  const TVA_REVENTE = 10
  const TVA_ACHAT = 10

  const getPrixAchatHT = (prixTTC: number) => {
    if (isAssujetti) return prixTTC / (1 + TVA_ACHAT / 100)
    return prixTTC
  }

  const getPrixRevente = (prixTTC: number, markup: number) => {
    const prixBase = getPrixAchatHT(prixTTC)
    return prixBase * (1 + markup / 100)
  }

  const margeMinRecommandee = isAutoEntrepreneur ? 30 : 25
  const margeIsRentable = globalMarkup >= margeMinRecommandee

  const handleExportDevis = () => {
    if (!currentResults) return
    const exportLines = currentResults.map((m, i) => {
      const prixTTC = m.bestPrice?.price || m.avgPrice || 0
      const priceHT = Math.round(getPrixRevente(prixTTC, globalMarkup) * 100) / 100
      return {
        id: i + 1,
        description: `${m.name} — ${m.category}${m.norms?.length ? ` (${m.norms[0]})` : ''}`,
        qty: m.qty,
        unit: m.unit || 'u',
        priceHT,
        tvaRate: isAssujetti ? TVA_REVENTE : 0,
        totalHT: Math.round(priceHT * m.qty * 100) / 100,
      }
    })
    onExportDevis(exportLines)
  }

  const formatMsg = (text: string) => safeMarkdownToHTML(text)

  // Totaux avec logique fiscale correcte
  const totalBestPrice = currentResults?.reduce((sum, m) => sum + (m.bestPrice?.price || m.avgPrice || 0), 0) || 0
  const totalCoutAchatHT = currentResults?.reduce((sum, m) => sum + getPrixAchatHT(m.bestPrice?.price || m.avgPrice || 0), 0) || 0
  const totalRevente = currentResults?.reduce((sum, m) => sum + getPrixRevente(m.bestPrice?.price || m.avgPrice || 0, globalMarkup), 0) || 0
  const totalReventeTTC = isAssujetti ? totalRevente * (1 + TVA_REVENTE / 100) : totalRevente
  const margeBrute = totalRevente - totalCoutAchatHT
  const markupAmount = Math.round(margeBrute)
  const totalWithMarkup = Math.round(totalRevente)

  const allStores = currentResults
    ? [...new Set(currentResults.flatMap(m => m.prices.map(p => p.store)))].sort()
    : []

  const getCategoryIcon = (cat: string) => {
    if (cat === 'Sanitaire' || cat === 'Plomberie') return '🔧'
    if (cat === 'Électricité') return '⚡'
    if (cat === 'Chauffage') return '🌡️'
    if (cat === 'Carrelage') return '🪟'
    if (cat === 'Isolation' || cat === 'Maçonnerie') return '🧱'
    if (cat === 'Menuiserie') return '🚪'
    if (cat === 'Peinture') return '🎨'
    if (cat === 'Toiture') return '🏠'
    if (cat === 'Ventilation') return '💨'
    return '📦'
  }

  // ── CSS class helpers for v5/v22 ──
  const cardCls = isV5 ? 'v5-card' : 'v22-card'
  const btnCls = isV5 ? 'v5-btn' : 'v22-btn'
  const btnPrimaryCls = isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'
  const btnSmCls = isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'
  const tagCls = (color: string) => isV5 ? `v5-badge v5-badge-${color}` : `v22-tag v22-tag-${color}`
  const alertCls = (color: string) => isV5 ? `v5-al ${color === 'red' ? 'err' : color === 'amber' ? 'warn' : 'info'}` : `v22-alert v22-alert-${color}`

  return (
    <div className={isV5 ? 'v5-fade' : ''}>
      {/* Header */}
      {isV5 ? (
        <>
          <div className="v5-pg-t">
            <h1>Mat&eacute;riaux &amp; Appro</h1>
            <p>Stock, commandes, comparatif fournisseurs</p>
          </div>
          <div className="v5-search">
            {userCity && (
              <span className="v5-badge v5-badge-green" style={{ fontSize: 11, padding: '3px 8px' }}>
                📍 {userCity}
              </span>
            )}
            <button
              onClick={handleGeolocation}
              disabled={geoLoading}
              className={`v5-btn${userCity ? '' : ' v5-btn-p'}`}
              style={{ marginLeft: 'auto' }}
            >
              {geoLoading ? '⏳' : '📍'} {userCity ? (locale === 'pt' ? 'Atualizar' : 'Mettre à jour') : (locale === 'pt' ? 'Localização GPS' : 'Localisation GPS')}
            </button>
          </div>
        </>
      ) : (
        <div className="v22-page-header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
          <div style={{ flex: 1 }}>
            <div className="v22-page-title">
              {isSociete
                ? (locale === 'pt' ? '🧱 Materiais & Aprovisionamento BTP' : '🧱 Matériaux & Approvisionnement BTP')
                : `🛒 ${locale === 'pt' ? 'Materiais & Preços' : 'Matériaux & Prix'}`}
            </div>
            <div className="v22-page-sub">
              {isSociete
                ? (locale === 'pt' ? 'Compare preços de materiais para os seus estaleiros e situações de obra' : 'Comparez les prix matériaux pour vos chantiers et situations de travaux')
                : (locale === 'pt' ? 'Pesquisa IA autónoma · Comparativo por loja' : 'Recherche IA autonome · Comparatif par enseigne')}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {userCity && (
              <span className="v22-tag v22-tag-green" style={{ fontSize: '11px', padding: '4px 10px' }}>
                📍 {userCity}
              </span>
            )}
            <button
              onClick={handleGeolocation}
              disabled={geoLoading}
              className={`v22-btn ${userCity ? '' : 'v22-btn-primary'} v22-btn-sm`}
            >
              {geoLoading ? '⏳' : '📍'} {userCity ? (locale === 'pt' ? 'Atualizar' : 'Mettre à jour') : (locale === 'pt' ? 'Localização GPS' : 'Localisation GPS')}
            </button>
          </div>
        </div>
      )}
      {geoError && (
        <div className={alertCls('red')} style={{ marginBottom: '12px' }}>
          <span>⚠️ {geoError}</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ padding: isV5 ? '0' : '14px 14px 0' }}>
        <div className={isV5 ? 'v5-tabs' : 'v22-tabs'} style={{ marginBottom: isV5 ? '0.75rem' : '14px' }}>
          {([
            { key: 'recherche', label: locale === 'pt' ? '🔍 Pesquisa' : '🔍 Recherche' },
            { key: 'historique', label: locale === 'pt' ? `📋 Histórico (${savedSearches.length})` : `📋 Historique (${savedSearches.length})` },
            { key: 'aide', label: locale === 'pt' ? '💡 Ajuda' : '💡 Aide' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={isV5 ? `v5-tab-b${activeTab === t.key ? ' active' : ''}` : `v22-tab ${activeTab === t.key ? 'active' : ''}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── RECHERCHE TAB ── */}
      {activeTab === 'recherche' && (
        <div style={{ padding: '14px' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <div className={isV5 ? 'v5-tabs' : 'v22-tabs'}>
              <button
                onClick={() => { setSearchMode('project'); setProductResults(null); setProductRecommendations('') }}
                className={isV5 ? `v5-tab-b${searchMode === 'project' ? ' active' : ''}` : `v22-tab ${searchMode === 'project' ? 'active' : ''}`}>
                {locale === 'pt' ? '🏗️ Materiais obra' : '🏗️ Matériaux chantier'}
              </button>
              <button
                onClick={() => { setSearchMode('product'); setCurrentResults(null); setCurrentEstimate(null) }}
                className={isV5 ? `v5-tab-b${searchMode === 'product' ? ' active' : ''}` : `v22-tab ${searchMode === 'product' ? 'active' : ''}`}>
                {locale === 'pt' ? '🛍️ Pesquisa produto' : '🛍️ Recherche produit'}
              </button>
            </div>
          </div>

          {/* Welcome screen — project mode */}
          {!chatStarted && searchMode === 'project' && (
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              <div className={cardCls} style={{ marginBottom: '16px', textAlign: 'center' }}>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: '24px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🛒</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
                    {isSociete ? 'Agent Approvisionnement BTP' : locale === 'pt' ? 'Agente Materiais IA' : 'Agent Matériaux IA'}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--v22-text-mid)', lineHeight: 1.6 }}>
                    {isSociete
                      ? <>Décrivez votre lot ou chantier — l&apos;agent génère la liste des matériaux avec comparatif de prix fournisseurs <strong>(Point P, Brico Dépôt, Leroy Merlin Pro…)</strong></>
                      : locale === 'pt'
                        ? <>Descreva a sua intervenção e o agente gera automaticamente a lista de materiais com os preços por loja <strong>(Leroy Merlin PT, AKI, Maxmat…)</strong></>
                        : <>Décrivez votre intervention et l&apos;agent génère automatiquement la liste des matériaux avec les prix par enseigne <strong>(Leroy Merlin, Brico Dépôt, Castorama…)</strong></>
                    }
                  </p>
                  {!userCity && (
                    <div className={alertCls('amber')} style={{ marginTop: '12px', cursor: 'default' }}>
                      <span>{locale === 'pt' ? '💡 Ative a localização GPS para resultados adaptados à sua região' : '💡 Activez la localisation GPS pour des résultats adaptés à votre região'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick presets */}
              <div style={{ marginBottom: '16px' }}>
                <div className="v22-form-label" style={{ marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {isSociete ? 'Lots de travaux fréquents' : locale === 'pt' ? 'Intervenções comuns' : 'Interventions courantes'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px' }}>
                  {(isSociete ? JOB_PRESETS_SOCIETE_FR : locale === 'pt' ? JOB_PRESETS_PT : JOB_PRESETS_FR).map((p, i) => (
                    <button key={i} onClick={() => sendMessage(p.q)}
                      className={btnCls} style={{ textAlign: 'left', padding: '10px 12px' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Welcome screen — product mode */}
          {!chatStarted && searchMode === 'product' && (
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              <div className={cardCls} style={{ marginBottom: '16px', textAlign: 'center' }}>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: '24px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🛍️</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>{locale === 'pt' ? 'Pesquisa Produto' : 'Recherche Produit'}</div>
                  <p style={{ fontSize: '12px', color: 'var(--v22-text-mid)', lineHeight: 1.6 }}>
                    {locale === 'pt'
                      ? <>Pesquise uma ferramenta ou produto específico. O agente analisa as lojas online <strong>(Amazon, ManoMano, Leroy Merlin PT, AKI…)</strong> e mostra os melhores preços com links de compra diretos.</>
                      : <>Recherchez un outil ou produit spécifique. L&apos;agent scanne les boutiques en ligne <strong>(Amazon, ManoMano, Leroy Merlin, Castorama…)</strong> et affiche les meilleurs prix avec des liens d&apos;achat directs.</>
                    }
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div className="v22-form-label" style={{ marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {locale === 'pt' ? 'Pesquisas populares' : 'Recherches populaires'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px' }}>
                  {(locale === 'pt' ? PRODUCT_PRESETS_PT : PRODUCT_PRESETS_FR).map((p, i) => (
                    <button key={i} onClick={() => sendMessage(p.q)}
                      className={btnCls} style={{ textAlign: 'left', padding: '10px 12px' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chat messages */}
          {chatStarted && (
            <div style={{ maxWidth: '720px', margin: '0 auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '8px' }}>
                    {msg.role === 'assistant' && (
                      <div className="v22-chat-avatar">🛒</div>
                    )}
                    <div
                      className={`v22-chat-bubble ${msg.role === 'user' ? 'v22-chat-bubble-user' : 'v22-chat-bubble-assistant'}`}
                      dangerouslySetInnerHTML={{ __html: formatMsg(msg.content) }}
                    />
                  </div>
                ))}

                {/* Loading */}
                {isLoading && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="v22-chat-avatar">🛒</div>
                    <div className="v22-chat-bubble v22-chat-bubble-assistant" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'flex', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', background: 'var(--v22-yellow)', borderRadius: '50%', animation: 'bounce 0.6s infinite', animationDelay: '0ms' }} />
                        <span style={{ width: '6px', height: '6px', background: 'var(--v22-yellow)', borderRadius: '50%', animation: 'bounce 0.6s infinite', animationDelay: '150ms' }} />
                        <span style={{ width: '6px', height: '6px', background: 'var(--v22-yellow)', borderRadius: '50%', animation: 'bounce 0.6s infinite', animationDelay: '300ms' }} />
                      </span>
                      <span style={{ color: 'var(--v22-text-muted)', fontSize: '11px' }}>{searchMode === 'product'
                        ? (locale === 'pt' ? 'A pesquisar o produto nas lojas online...' : 'Recherche du produit sur les boutiques en ligne...')
                        : (locale === 'pt' ? 'A pesquisar materiais e preços...' : 'Recherche des matériaux et prix en cours...')}</span>
                    </div>
                  </div>
                )}

                {/* Résultats matériaux */}
                {currentResults && currentResults.length > 0 && !isLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {isFallback && (
                      <div className={alertCls('amber')}>
                        <span>⚠️</span>
                        <span>{locale === 'pt' ? 'Preços estimados (sem pesquisa web em tempo real). Ative Tavily para preços atualizados.' : 'Prix estimés (sans recherche web en temps réel). Activez Tavily pour des prix actualisés.'}</span>
                      </div>
                    )}

                    {/* Cards matériaux */}
                    {currentResults.map((m, i) => (
                      <div key={i} className={cardCls}>
                        {/* Header matériau */}
                        <div className="v22-card-head" style={{ gap: '10px' }}>
                          <span style={{ fontSize: '18px' }}>{getCategoryIcon(m.category)}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--v22-text)' }}>{m.name}</div>
                            <div className="v22-ref">{m.qty} {m.unit} · {m.category}</div>
                          </div>
                          {m.bestPrice && (
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div className="v22-amount" style={{ fontSize: '16px', color: 'var(--v22-green)' }}>{m.bestPrice.price} €</div>
                              <div className="v22-ref">
                                {m.qty > 1 ? `${m.bestPrice.price} x ${m.qty} = ${Math.round(m.bestPrice.price * m.qty)} €` : (locale === 'pt' ? 'Melhor preço' : 'Meilleur prix')}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Prix par enseigne */}
                        {m.prices.length > 0 ? (
                          (() => {
                            const sorted = [...m.prices].filter(p => p.price > 0).sort((a, b) => a.price - b.price)
                            const bestP = sorted[0]?.price || 0
                            const worstP = sorted[sorted.length - 1]?.price || 0
                            return (
                              <div className="v22-card-body" style={{ padding: 0 }}>
                                <table>
                                  <tbody>
                                    {sorted.map((p, j) => {
                                      const isBest = bestP > 0 && p.price === bestP
                                      const isWorst = sorted.length > 1 && p.price === worstP && worstP !== bestP
                                      const ecartPct = bestP > 0 && !isBest ? Math.round(((p.price - bestP) / bestP) * 100) : 0
                                      return (
                                        <tr key={j} style={isBest ? { background: 'var(--v22-green-light)' } : isWorst ? { background: 'var(--v22-red-light)' } : undefined}>
                                          <td style={{ width: '1%', whiteSpace: 'nowrap' }}>
                                            <span className={STORE_COLORS[p.store] || 'v22-tag v22-tag-gray'}>
                                              {p.store}
                                              {userCoords && (() => {
                                                const nearest = getNearestStore(p.store, userCoords.lat, userCoords.lng)
                                                return nearest ? <span style={{ opacity: 0.7, marginLeft: '4px' }}>({nearest.distance} km)</span> : null
                                              })()}
                                            </span>
                                          </td>
                                          <td className="v22-ref" style={{ textAlign: 'right' }}>
                                            {m.qty > 1 && <span>{p.price} x {m.qty} = {Math.round(p.price * m.qty)} €</span>}
                                          </td>
                                          <td className="v22-amount" style={{
                                            color: isBest ? 'var(--v22-green)' : isWorst ? 'var(--v22-red)' : 'var(--v22-text)',
                                            fontWeight: 600,
                                            width: '1%',
                                            whiteSpace: 'nowrap',
                                          }}>
                                            {p.price} €
                                          </td>
                                          <td style={{ width: '1%', whiteSpace: 'nowrap' }}>
                                            {isBest && <span className="v22-tag v22-tag-green">{locale === 'pt' ? 'Melhor' : 'Meilleur'}</span>}
                                            {!isBest && ecartPct > 0 && (
                                              <span className={`v22-tag ${isWorst ? 'v22-tag-red' : 'v22-tag-gray'}`}>+{ecartPct}%</span>
                                            )}
                                          </td>
                                          <td style={{ width: '1%', whiteSpace: 'nowrap' }}>
                                            {p.url && (
                                              <a href={p.url} target="_blank" rel="noopener noreferrer"
                                                className="v22-btn v22-btn-sm" style={{ textDecoration: 'none' }}>{locale === 'pt' ? 'Ver' : 'Voir'}</a>
                                            )}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )
                          })()
                        ) : (
                          <div className="v22-card-body">
                            <span className="v22-ref" style={{ fontStyle: 'italic' }}>{locale === 'pt' ? 'Preços não encontrados — verifique manualmente' : 'Prix non trouvés — vérifiez manuellement'}</span>
                          </div>
                        )}

                        {/* Normes applicables */}
                        {(m.norms?.length > 0 || m.normDetails) && (
                          <div style={{ padding: '10px 14px', background: 'var(--v22-amber-light)', borderTop: '1px solid var(--v22-border)' }}>
                            {m.norms?.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--v22-amber)' }}>📋 {locale === 'pt' ? 'Normas:' : 'Normes :'}</span>
                                {m.norms.map((n: string, ni: number) => (
                                  <span key={ni} className="v22-tag v22-tag-amber v22-mono">{n}</span>
                                ))}
                              </div>
                            )}
                            {m.normDetails && (
                              <p style={{ fontSize: '11px', color: 'var(--v22-amber)', lineHeight: 1.5 }}>
                                ⚠️ {m.normDetails}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Tableau comparatif si plusieurs enseignes */}
                    {allStores.length > 1 && (
                      (() => {
                        const storeTotals = allStores.map(s => ({
                          store: s,
                          total: currentResults!.reduce((sum, m) => {
                            const p = m.prices.find(pr => pr.store === s)
                            return sum + (p ? p.price * m.qty : 0)
                          }, 0),
                          coverage: currentResults!.filter(m => m.prices.some(pr => pr.store === s)).length,
                        }))
                        const bestStoreTotal = Math.min(...storeTotals.filter(st => st.coverage === currentResults!.length && st.total > 0).map(st => st.total))
                        const worstStoreTotal = Math.max(...storeTotals.filter(st => st.total > 0).map(st => st.total))
                        return (
                          <div className={cardCls}>
                            {!isV5 && <div className="v22-card-head">
                              <div className="v22-card-title">{locale === 'pt' ? '📊 Comparativo por loja' : '📊 Comparatif par enseigne'}</div>
                            </div>}
                            {isV5 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#1a1a1a', marginBottom: 8, letterSpacing: '.3px' }}>{locale === 'pt' ? '📊 Comparativo por loja' : '📊 Comparatif par enseigne'}</div>}
                            <div style={{ overflowX: 'auto' }}>
                              <table>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: 'left' }}>{locale === 'pt' ? 'Material' : 'Matériau'}</th>
                                    <th style={{ textAlign: 'center' }}>{locale === 'pt' ? 'Qtd' : 'Qté'}</th>
                                    {allStores.map(s => {
                                      const nearest = userCoords ? getNearestStore(s, userCoords.lat, userCoords.lng) : null
                                      return (
                                        <th key={s} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                          {s}{nearest ? <span className="v22-ref" style={{ marginLeft: '4px' }}>({nearest.distance} km)</span> : null}
                                        </th>
                                      )
                                    })}
                                    <th style={{ textAlign: 'right', color: 'var(--v22-green)' }}>{locale === 'pt' ? 'Melhor' : 'Meilleur'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {currentResults.map((m, i) => {
                                    const sortedPrices = [...m.prices].filter(p => p.price > 0).sort((a, b) => a.price - b.price)
                                    const rowBest = sortedPrices[0]?.price || 0
                                    const rowWorst = sortedPrices[sortedPrices.length - 1]?.price || 0
                                    return (
                                      <tr key={i}>
                                        <td style={{ fontWeight: 500, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</td>
                                        <td className="v22-ref" style={{ textAlign: 'center' }}>{m.qty} {m.unit}</td>
                                        {allStores.map(s => {
                                          const p = m.prices.find(pr => pr.store === s)
                                          const isBest = p && p.price === rowBest && rowBest > 0
                                          const isWorst = p && p.price === rowWorst && rowWorst !== rowBest && sortedPrices.length > 1
                                          const ecart = rowBest > 0 && p && p.price > rowBest ? Math.round(((p.price - rowBest) / rowBest) * 100) : 0
                                          return (
                                            <td key={s} className="v22-amount" style={{
                                              color: isBest ? 'var(--v22-green)' : isWorst ? 'var(--v22-red)' : p ? 'var(--v22-text)' : 'var(--v22-text-muted)',
                                              background: isBest ? 'var(--v22-green-light)' : isWorst ? 'var(--v22-red-light)' : undefined,
                                              fontWeight: isBest || isWorst ? 600 : 400,
                                            }}>
                                              {p ? (
                                                <span>
                                                  {m.qty > 1 ? `${Math.round(p.price * m.qty)}` : p.price} €
                                                  {ecart > 0 && <span className="v22-ref" style={{ marginLeft: '4px', color: isWorst ? 'var(--v22-red)' : undefined }}> +{ecart}%</span>}
                                                </span>
                                              ) : '—'}
                                            </td>
                                          )
                                        })}
                                        <td className="v22-amount" style={{ color: 'var(--v22-green)', fontWeight: 600 }}>
                                          {m.bestPrice ? `${m.qty > 1 ? Math.round(m.bestPrice.price * m.qty) : m.bestPrice.price} €` : '—'}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                  {/* Total par enseigne */}
                                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--v22-border-dark)' }}>
                                    <td colSpan={2}>TOTAL</td>
                                    {storeTotals.map(st => {
                                      const isCheapest = st.total > 0 && st.total === bestStoreTotal && st.coverage === currentResults!.length
                                      const isMostExpensive = st.total > 0 && st.total === worstStoreTotal && worstStoreTotal !== bestStoreTotal
                                      const ecart = bestStoreTotal > 0 && st.total > bestStoreTotal ? Math.round(((st.total - bestStoreTotal) / bestStoreTotal) * 100) : 0
                                      return (
                                        <td key={st.store} className="v22-amount" style={{
                                          color: isCheapest ? 'var(--v22-green)' : isMostExpensive ? 'var(--v22-red)' : st.total > 0 ? 'var(--v22-text)' : 'var(--v22-text-muted)',
                                          background: isCheapest ? 'var(--v22-green-light)' : undefined,
                                        }}>
                                          {st.total > 0 ? (
                                            <span>
                                              {Math.round(st.total)} €
                                              {ecart > 0 && <span className="v22-ref" style={{ marginLeft: '4px', color: isMostExpensive ? 'var(--v22-red)' : undefined }}> +{ecart}%</span>}
                                              {st.coverage < currentResults!.length && <span className="v22-ref" style={{ marginLeft: '2px' }}>*</span>}
                                            </span>
                                          ) : '—'}
                                        </td>
                                      )
                                    })}
                                    <td className="v22-amount" style={{ color: 'var(--v22-green)', fontSize: '13px' }}>
                                      {totalBestPrice > 0 ? `${Math.round(currentResults!.reduce((sum, m) => sum + (m.bestPrice ? m.bestPrice.price * m.qty : 0), 0))} €` : '—'}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      })()
                    )}

                    {/* Marge + Export devis */}
                    {totalBestPrice > 0 && (
                      <div className={cardCls}>
                        {isV5 ? (
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#1a1a1a', marginBottom: 10, letterSpacing: '.3px' }}>
                            {locale === 'pt' ? '💰 Integrar no orçamento' : '💰 Intégrer au devis'}
                            <span className={`v5-badge ${isAssujetti ? 'v5-badge-gray' : 'v5-badge-yellow'}`} style={{ marginLeft: 8 }}>
                              {isAssujetti
                                ? `${(artisan as unknown as { legal_form?: string })?.legal_form || 'Société'} — TVA ${TVA_REVENTE}%`
                                : `${isAutoEntrepreneur ? 'Auto-entrepreneur' : 'EI'} — Franchise TVA`
                              }
                            </span>
                          </div>
                        ) : (
                        <>
                        <div className="v22-card-head">
                          <div className="v22-card-title">{locale === 'pt' ? '💰 Integrar no orçamento' : '💰 Intégrer au devis'}</div>
                          <div className="v22-card-meta">
                            <span className={`v22-tag ${isAssujetti ? 'v22-tag-gray' : 'v22-tag-amber'}`}>
                              {isAssujetti
                                ? `📋 ${(artisan as unknown as { legal_form?: string })?.legal_form || 'Société'} — TVA ${TVA_REVENTE}%`
                                : `📋 ${isAutoEntrepreneur ? 'Auto-entrepreneur' : 'EI'} — Franchise TVA (293B CGI)`
                              }
                            </span>
                          </div>
                        </div>
                        </>
                        )}
                        <div className={isV5 ? '' : 'v22-card-body'}>
                          {/* Marge slider */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <label className="v22-form-label" style={{ marginBottom: 0, flexShrink: 0 }}>{locale === 'pt' ? 'Margem de revenda' : 'Marge de revente'}</label>
                            <input
                              type="range" min={0} max={60} value={globalMarkup}
                              onChange={e => setGlobalMarkup(Number(e.target.value))}
                              style={{ flex: 1, accentColor: 'var(--v22-yellow)' }}
                            />
                            <span className="v22-mono" style={{
                              fontSize: '16px', fontWeight: 700, width: '42px', textAlign: 'right',
                              color: margeIsRentable ? 'var(--v22-green)' : 'var(--v22-red)',
                            }}>
                              {globalMarkup}%
                            </span>
                          </div>

                          {/* Alerte si marge insuffisante */}
                          {!margeIsRentable && totalBestPrice > 0 && (
                            <div className={alertCls('red')} style={{ marginBottom: '12px', cursor: 'default' }}>
                              <span>⚠️ <strong>{locale === 'pt' ? 'Margem insuficiente.' : 'Marge insuffisante.'}</strong> {locale === 'pt'
                                ? <>Norma mínima: <strong>{margeMinRecommandee}%</strong>{isAutoEntrepreneur ? ' para trabalhador independente (cobre IVA compra não recuperável + encargos)' : ' para empresa sujeita a IVA'}</>
                                : <>Standard national CAPEB/FFB : min <strong>{margeMinRecommandee}%</strong>{isAutoEntrepreneur ? ' en franchise TVA (couvre TVA achat non récupérable + charges + bénéfice)' : ' en société assujettie TVA'}</>
                              }.</span>
                            </div>
                          )}
                          {margeIsRentable && totalBestPrice > 0 && (
                            <div className="v22-alert" style={{ marginBottom: '12px', cursor: 'default', borderLeftColor: 'var(--v22-green)', background: 'var(--v22-green-light)' }}>
                              <span style={{ color: 'var(--v22-green)' }}>
                                {locale === 'pt' ? `✅ Margem conforme às normas do setor (${margeMinRecommandee}% mín)` : `✅ Marge conforme aux standards nationaux BTP (${margeMinRecommandee}% min)`}
                              </span>
                            </div>
                          )}

                          {/* Tableau de calcul fiscal */}
                          <div style={{ background: 'var(--v22-bg)', borderRadius: '4px', padding: '12px', marginBottom: '14px' }}>
                            <table style={{ borderCollapse: 'collapse' }}>
                              <tbody>
                                <tr>
                                  <td style={{ border: 'none', padding: '4px 0', color: 'var(--v22-text-mid)', fontSize: '12px' }}>
                                    {locale === 'pt' ? 'Custo compra materiais (preço loja c/ IVA)' : 'Coût achat matériaux (prix magasin TTC)'}
                                  </td>
                                  <td className="v22-amount" style={{ border: 'none', padding: '4px 0' }}>{Math.round(totalBestPrice)} €</td>
                                </tr>
                                {isAssujetti && (
                                  <tr>
                                    <td className="v22-ref" style={{ border: 'none', padding: '2px 0 2px 12px' }}>
                                      {locale === 'pt' ? `→ IVA compra recuperado (${TVA_ACHAT}%) — crédito de IVA` : `→ TVA achat récupérée (${TVA_ACHAT}%) — crédit de TVA`}
                                    </td>
                                    <td className="v22-amount v22-ref" style={{ border: 'none', padding: '2px 0', color: 'var(--v22-green)' }}>−{Math.round(totalBestPrice - totalCoutAchatHT)} €</td>
                                  </tr>
                                )}
                                {isAutoEntrepreneur && (
                                  <tr>
                                    <td className="v22-ref" style={{ border: 'none', padding: '2px 0 2px 12px' }}>
                                      {locale === 'pt' ? '→ IVA compra não recuperável (incluído no seu custo real)' : '→ TVA achat non récupérable (incluse dans votre coût réel)'}
                                    </td>
                                    <td className="v22-amount v22-ref" style={{ border: 'none', padding: '2px 0', color: 'var(--v22-amber)' }}>{Math.round(totalBestPrice - totalBestPrice / (1 + TVA_ACHAT / 100))} €</td>
                                  </tr>
                                )}
                                <tr style={{ borderTop: '1px solid var(--v22-border)' }}>
                                  <td style={{ border: 'none', padding: '6px 0 4px', color: 'var(--v22-text-mid)', fontSize: '12px' }}>
                                    {locale === 'pt' ? 'Custo real s/ IVA profissional' : 'Coût réel HT artisan'}
                                  </td>
                                  <td className="v22-amount" style={{ border: 'none', padding: '6px 0 4px' }}>{Math.round(totalCoutAchatHT)} €</td>
                                </tr>
                                <tr>
                                  <td style={{ border: 'none', padding: '4px 0', color: 'var(--v22-amber)', fontSize: '12px' }}>
                                    {locale === 'pt' ? `Margem revenda ${globalMarkup}%` : `Marge revente ${globalMarkup}%`}
                                  </td>
                                  <td className="v22-amount" style={{ border: 'none', padding: '4px 0', color: 'var(--v22-amber)', fontWeight: 700 }}>+{markupAmount} €</td>
                                </tr>
                                <tr style={{ borderTop: '1px solid var(--v22-border)' }}>
                                  <td style={{ border: 'none', padding: '6px 0 4px', fontWeight: 700, fontSize: '12px' }}>
                                    {locale === 'pt' ? 'Montante s/ IVA a faturar' : 'Montant HT à facturer'}
                                  </td>
                                  <td className="v22-amount" style={{ border: 'none', padding: '6px 0 4px', fontWeight: 700 }}>{totalWithMarkup} €</td>
                                </tr>
                                {isAssujetti && (
                                  <tr>
                                    <td className="v22-ref" style={{ border: 'none', padding: '2px 0 2px 12px' }}>
                                      {locale === 'pt' ? `+ IVA ${TVA_REVENTE}% cobrado (renovação)` : `+ TVA ${TVA_REVENTE}% collectée (art. 279-0 bis CGI — rénovation)`}
                                    </td>
                                    <td className="v22-amount v22-ref" style={{ border: 'none', padding: '2px 0' }}>{Math.round(totalRevente * TVA_REVENTE / 100)} €</td>
                                  </tr>
                                )}
                                <tr style={{ borderTop: '2px solid var(--v22-border-dark)' }}>
                                  <td style={{ border: 'none', padding: '8px 0 4px', fontWeight: 700, fontSize: '13px', color: isAssujetti ? 'var(--v22-green)' : 'var(--v22-green)' }}>
                                    {locale === 'pt' ? 'Total c/ IVA cliente' : 'Total TTC client'}
                                  </td>
                                  <td className="v22-amount" style={{ border: 'none', padding: '8px 0 4px', fontWeight: 700, fontSize: '14px', color: 'var(--v22-green)' }}>{Math.round(totalReventeTTC)} €</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Info légale selon statut */}
                          <div className="v22-alert" style={{
                            marginBottom: '14px', cursor: 'default', fontSize: '11px', lineHeight: 1.6,
                            borderLeftColor: isAssujetti ? 'var(--v22-green)' : 'var(--v22-amber)',
                            background: isAssujetti ? 'var(--v22-green-light)' : 'var(--v22-amber-light)',
                          }}>
                            <span style={{ color: isAssujetti ? 'var(--v22-green)' : 'var(--v22-amber)' }}>
                              {locale === 'pt' ? (
                                isAssujetti ? (
                                  <>
                                    <strong>📋 Regime IVA normal:</strong> Recupera o IVA nas compras e cobra IVA nas vendas.
                                    Taxa aplicável: <strong>23% normal</strong>, 13% intermédia, 6% reduzida (renovação habitação).
                                  </>
                                ) : (
                                  <>
                                    <strong>📋 Regime de isenção IVA:</strong> Não cobra IVA.
                                    As compras são a seu cargo c/ IVA (não recuperável).
                                    As faturas devem mencionar <em>&quot;IVA — isento artigo 53.º do CIVA&quot;</em>.
                                  </>
                                )
                              ) : (
                                isAssujetti ? (
                                  <>
                                    <strong>📋 Régime TVA réel :</strong> Vous récupérez la TVA sur vos achats et collectez la TVA sur vos ventes.
                                    Taux applicable : <strong>10% rénovation logement &gt;2 ans</strong> (art. 279-0 bis CGI).
                                    Pour éco-rénovation (isolation, PAC, fenêtres) : 5.5% (art. 278-0 bis CGI).
                                    Pour local professionnel ou construction neuve : 20%.
                                  </>
                                ) : (
                                  <>
                                    <strong>📋 Franchise en base de TVA :</strong> Vous n&apos;êtes pas assujetti à la TVA.
                                    Vos achats sont à votre charge TTC (non récupérable).
                                    Vos factures doivent mentionner <em>&quot;TVA non applicable — art. 293 B du CGI&quot;</em>.
                                    Seuils 2025 : 37 500 €/an prestation · 85 000 €/an marchandises.
                                  </>
                                )
                              )}
                            </span>
                          </div>

                          <button onClick={handleExportDevis} className={btnPrimaryCls} style={{ width: '100%', padding: '10px 16px', fontWeight: 700, fontSize: '13px' }}>
                            {locale === 'pt'
                              ? `📄 Exportar para orçamento (${totalWithMarkup} € s/ IVA${isAssujetti ? ` + IVA ${TVA_REVENTE}% = ${Math.round(totalReventeTTC)} € c/ IVA` : ' — IVA isento'})`
                              : `📄 Exporter vers un devis (${totalWithMarkup} € HT${isAssujetti ? ` + TVA ${TVA_REVENTE}% = ${Math.round(totalReventeTTC)} € TTC` : ' — TVA non applicable'})`
                            }
                          </button>
                          <p className="v22-ref" style={{ textAlign: 'center', marginTop: '6px' }}>
                            {locale === 'pt'
                              ? (isAssujetti
                                ? `IVA ${TVA_REVENTE}% cobrado na revenda · Preços s/ IVA calculados com margem ${globalMarkup}%`
                                : `Isento IVA art. 53.º CIVA · Margem ${globalMarkup}% sobre custo c/ IVA`)
                              : (isAssujetti
                                ? `TVA ${TVA_REVENTE}% collectée sur revente · Prix HT client calculés avec marge ${globalMarkup}%`
                                : `Franchise TVA art. 293B CGI · Marge ${globalMarkup}% sur coût TTC artisan`)
                            }
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Product search results — Tableau comparatif Neuf / Reconditionné ── */}
                {productResults && productResults.length > 0 && !isLoading && (() => {
                  const newProducts = productResults.filter(p => p.condition !== 'refurbished')
                  const refurbProducts = productResults.filter(p => p.condition === 'refurbished')
                  const activeProducts = productTab === 'new' ? newProducts : refurbProducts
                  const withPrice = activeProducts.filter(p => p.price > 0).sort((a, b) => a.price - b.price)
                  const withoutPrice = activeProducts.filter(p => !p.price || p.price <= 0)
                  const sorted = [...withPrice, ...withoutPrice]
                  const cheapest = withPrice[0]
                  const mostExpensive = withPrice[withPrice.length - 1]
                  const avgPrice = withPrice.length > 0 ? withPrice.reduce((s, p) => s + p.price, 0) / withPrice.length : 0
                  const maxSaving = cheapest && mostExpensive && mostExpensive.price > cheapest.price
                    ? mostExpensive.price - cheapest.price : 0
                  const savingPct = mostExpensive && mostExpensive.price > 0 ? Math.round((maxSaving / mostExpensive.price) * 100) : 0
                  const timeStr = productFetchedAt ? new Date(productFetchedAt).toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' }) : null

                  return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Onglets Neuf / Reconditionné */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className={isV5 ? 'v5-tabs' : 'v22-tabs'}>
                        <button onClick={() => setProductTab('new')}
                          className={isV5 ? `v5-tab-b${productTab === 'new' ? ' active' : ''}` : `v22-tab ${productTab === 'new' ? 'active' : ''}`}>
                          {locale === 'pt' ? '🆕 Novo' : '🆕 Neuf'} {newProducts.length > 0 && <span className="v22-ref" style={{ marginLeft: '4px' }}>{newProducts.length}</span>}
                        </button>
                        <button onClick={() => setProductTab('refurbished')}
                          className={isV5 ? `v5-tab-b${productTab === 'refurbished' ? ' active' : ''}` : `v22-tab ${productTab === 'refurbished' ? 'active' : ''}`}>
                          {locale === 'pt' ? '♻️ Recondicionado' : '♻️ Reconditionné'} {refurbProducts.length > 0 && <span className="v22-ref" style={{ marginLeft: '4px' }}>{refurbProducts.length}</span>}
                        </button>
                      </div>
                      {timeStr && (
                        <span className="v22-ref" style={{ marginLeft: 'auto', fontStyle: 'italic' }}>{locale === 'pt' ? `Preços verificados às ${timeStr}` : `Prix constatés à ${timeStr}`}</span>
                      )}
                    </div>

                    {activeProducts.length === 0 ? (
                      <div className={cardCls}>
                        <div className={isV5 ? '' : 'v22-card-body'} style={{ textAlign: 'center', padding: '24px' }}>
                          <div style={{ fontSize: '24px', marginBottom: '8px' }}>{productTab === 'new' ? '📦' : '♻️'}</div>
                          <p style={{ fontSize: '12px', color: 'var(--v22-text-muted)', fontWeight: 500 }}>
                            {locale === 'pt'
                              ? `Nenhuma oferta ${productTab === 'new' ? 'nova' : 'recondicionada / outlet'} encontrada para este produto.`
                              : `Aucune offre ${productTab === 'new' ? 'neuve' : 'reconditionnée / déstockage'} trouvée pour ce produit.`}
                          </p>
                          <p className="v22-ref" style={{ marginTop: '4px' }}>
                            {locale === 'pt'
                              ? (productTab === 'new' ? 'Tente o separador Recondicionado / Outlet para encontrar alternativas.' : 'Tente o separador Novo para ver as ofertas disponíveis.')
                              : (productTab === 'new' ? 'Essayez l\'onglet Reconditionné / Déstockage pour trouver des alternatives.' : 'Essayez l\'onglet Neuf pour voir les offres disponibles.')}
                          </p>
                        </div>
                      </div>
                    ) : (
                    <>
                    {/* Bandeau récapitulatif */}
                    {withPrice.length >= 2 && (
                      <div className="v22-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                        <div className="v22-stat">
                          <div className="v22-stat-label">{locale === 'pt' ? '🏆 Melhor preço' : '🏆 Meilleur prix'}</div>
                          <div className="v22-stat-val" style={{ color: 'var(--v22-green)' }}>{cheapest.price.toFixed(2)} €</div>
                          <span className={STORE_COLORS[cheapest.store] || 'v22-tag v22-tag-gray'}>{cheapest.store}</span>
                        </div>
                        <div className="v22-stat">
                          <div className="v22-stat-label">{locale === 'pt' ? '📈 Preço médio' : '📈 Prix moyen'}</div>
                          <div className="v22-stat-val">{avgPrice.toFixed(2)} €</div>
                          <span className="v22-ref">{withPrice.length} {locale === 'pt' ? 'ofertas' : 'offres'}</span>
                        </div>
                        <div className="v22-stat">
                          <div className="v22-stat-label">{locale === 'pt' ? '💸 Mais caro' : '💸 Plus cher'}</div>
                          <div className="v22-stat-val" style={{ color: 'var(--v22-red)' }}>{mostExpensive.price.toFixed(2)} €</div>
                          <span className={STORE_COLORS[mostExpensive.store] || 'v22-tag v22-tag-gray'}>{mostExpensive.store}</span>
                        </div>
                      </div>
                    )}

                    {maxSaving > 0 && (
                      <div className="v22-tag v22-tag-green" style={{ fontSize: '11px', padding: '4px 10px', width: 'fit-content' }}>
                        {locale === 'pt' ? `Poupança até ${maxSaving.toFixed(2)} € (${savingPct}%)` : `Économie jusqu'à ${maxSaving.toFixed(2)} € (${savingPct}%)`}
                      </div>
                    )}

                    {productRecommendations && (
                      <div className="v22-alert" style={{ cursor: 'default', borderLeftColor: 'var(--v22-green)', background: 'var(--v22-green-light)' }}>
                        <span style={{ color: 'var(--v22-green)' }}>💡 {productRecommendations}</span>
                      </div>
                    )}

                    {/* Tableau comparatif des offres */}
                    <div className={cardCls}>
                      {!isV5 ? (
                        <div className="v22-card-head">
                          <div className="v22-card-title">
                            {locale === 'pt'
                              ? `${productTab === 'new' ? '🛒' : '♻️'} Ofertas ${productTab === 'new' ? 'novas' : 'recondicionadas / outlet'}`
                              : `${productTab === 'new' ? '🛒' : '♻️'} Offres ${productTab === 'new' ? 'neuves' : 'reconditionnées / déstockage'}`}
                          </div>
                          <div className="v22-card-meta">{locale === 'pt' ? 'do mais barato ao mais caro' : 'du moins cher au plus cher'}</div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#1a1a1a', marginBottom: 8, letterSpacing: '.3px' }}>
                          {locale === 'pt'
                            ? `${productTab === 'new' ? '🛒' : '♻️'} Ofertas ${productTab === 'new' ? 'novas' : 'recondicionadas / outlet'}`
                            : `${productTab === 'new' ? '🛒' : '♻️'} Offres ${productTab === 'new' ? 'neuves' : 'reconstitionnées / déstockage'}`}
                        </div>
                      )}
                      <table>
                        <tbody>
                          {sorted.map((p, i) => {
                            const isBest = cheapest && p.price === cheapest.price && p.price > 0
                            const saving = cheapest && p.price > 0 ? p.price - cheapest.price : 0
                            return (
                              <tr key={i} style={isBest ? { background: 'var(--v22-green-light)' } : undefined}>
                                <td style={{ width: '28px', textAlign: 'center', fontWeight: isBest ? 700 : 400, color: isBest ? 'var(--v22-green)' : 'var(--v22-text-muted)' }}>
                                  {p.price > 0 ? i + 1 : '—'}
                                </td>
                                <td style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 500, color: 'var(--v22-text)' }}>{p.name}</div>
                                  {p.description && (
                                    <div className="v22-ref" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>{p.description}</div>
                                  )}
                                </td>
                                <td style={{ width: '1%', whiteSpace: 'nowrap' }}>
                                  <span className={STORE_COLORS[p.store] || 'v22-tag v22-tag-gray'}>
                                    {p.store}
                                    {userCoords && (() => {
                                      const nearest = getNearestStore(p.store, userCoords.lat, userCoords.lng)
                                      return nearest ? <span style={{ opacity: 0.7, marginLeft: '4px' }}>({nearest.distance} km)</span> : null
                                    })()}
                                  </span>
                                </td>
                                <td className="v22-amount" style={{
                                  width: '1%', whiteSpace: 'nowrap',
                                  color: isBest ? 'var(--v22-green)' : 'var(--v22-text)',
                                  fontWeight: isBest ? 700 : 500,
                                }}>
                                  {p.price > 0 ? (
                                    <>
                                      {p.price.toFixed(2)} €
                                      {isBest && <div className="v22-ref" style={{ color: 'var(--v22-green)', textTransform: 'uppercase', fontSize: '9px' }}>{locale === 'pt' ? 'Melhor preço' : 'Meilleur prix'}</div>}
                                      {!isBest && saving > 0 && (
                                        <div className="v22-ref" style={{ color: 'var(--v22-red)' }}>+{saving.toFixed(2)} €</div>
                                      )}
                                    </>
                                  ) : (
                                    <span className="v22-ref" style={{ fontStyle: 'italic' }}>{locale === 'pt' ? 'Ver preço' : 'Voir prix'}</span>
                                  )}
                                </td>
                                <td style={{ width: '1%', whiteSpace: 'nowrap' }}>
                                  {p.url && (
                                    <a href={p.url} target="_blank" rel="noopener noreferrer"
                                      className={`v22-btn v22-btn-sm ${isBest ? 'v22-btn-primary' : ''}`}
                                      style={{ textDecoration: 'none' }}>
                                      {isBest ? (locale === 'pt' ? '🏆 Comprar' : '🏆 Acheter') : (locale === 'pt' ? 'Comprar →' : 'Acheter →')}
                                    </a>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className={alertCls('amber')} style={{ cursor: 'default' }}>
                      <span>
                        {locale === 'pt'
                          ? '⚠️ Preços verificados em tempo real — Os preços podem variar. Verifique o preço final no site do vendedor antes de comprar.'
                          : '⚠️ Prix constatés en temps réel — Les tarifs peuvent varier. Vérifiez le prix final sur le site du vendeur avant achat.'}
                      </span>
                    </div>
                    </>
                    )}
                  </div>
                  )
                })()}

                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions rapides */}
              {chatStarted && !isLoading && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {(searchMode === 'product' ? (locale === 'pt' ? PRODUCT_PRESETS_PT : PRODUCT_PRESETS_FR) : (isSociete ? JOB_PRESETS_SOCIETE_FR : locale === 'pt' ? JOB_PRESETS_PT : JOB_PRESETS_FR)).slice(0, 3).map((p, i) => (
                    <button key={i} onClick={() => sendMessage(p.q)}
                      className={btnSmCls} style={{ whiteSpace: 'nowrap' }}>
                      {p.label}
                    </button>
                  ))}
                  <button onClick={() => { setMessages([]); setChatStarted(false); setCurrentResults(null); setCurrentEstimate(null); setProductResults(null); setProductRecommendations(''); setProductFetchedAt(null); setProductTab('new') }}
                    className={btnSmCls}>
                    {locale === 'pt' ? '🔄 Nova pesquisa' : '🔄 Nouvelle recherche'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Input */}
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            <div className={cardCls} style={{ overflow: 'visible' }}>
              <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: 0 }}>
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputValue) }
                  }}
                  placeholder={searchMode === 'product'
                    ? (locale === 'pt'
                      ? `Pesquise uma ferramenta ou produto...\nEx: "rebarbadora Bosch 125mm" ou "berbequim Makita 18V"`
                      : `Recherchez un outil ou produit...\nEx: "disqueuse Bosch 125mm" ou "perceuse Makita 18V"`)
                    : userCity
                      ? (locale === 'pt'
                        ? `Descreva a sua intervenção em ${userCity}...\nEx: "Substituição esquentador 150L" ou "Colocação pavimento flutuante 30m²"`
                        : `Décrivez votre intervention à ${userCity}...\nEx: "Remplacement chauffe-eau 150L" ou "Pose parquet flottant 30m²"`)
                      : (locale === 'pt'
                        ? `Descreva a sua intervenção...\nEx: "Substituição esquentador 150L" ou "Instalação VMC duplo fluxo"`
                        : `Décrivez votre intervention...\nEx: "Remplacement chauffe-eau 150L" ou "Installation VMC double flux"`)
                  }
                  rows={3}
                  className="v22-form-input"
                  style={{ border: 'none', borderRadius: '4px 4px 0 0', resize: 'none', padding: '12px 14px' }}
                  disabled={isLoading}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid var(--v22-border)' }}>
                  <span className="v22-ref">{locale === 'pt' ? 'Enter = pesquisar · Shift+Enter = nova linha' : 'Entrée = rechercher · Maj+Entrée = saut de ligne'}</span>
                  <button
                    onClick={() => sendMessage(inputValue)}
                    disabled={!inputValue.trim() || isLoading}
                    className={btnPrimaryCls}
                    style={{ opacity: !inputValue.trim() || isLoading ? 0.4 : 1 }}
                  >
                    {isLoading ? '⏳' : (locale === 'pt' ? '🔍 Pesquisar' : '🔍 Rechercher')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORIQUE TAB ── */}
      {activeTab === 'historique' && (
        <div style={{ padding: '14px' }}>
          {savedSearches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
              <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>{locale === 'pt' ? 'Nenhuma pesquisa guardada' : 'Aucune recherche sauvegardée'}</div>
              <p className="v22-ref">{locale === 'pt' ? 'As suas pesquisas de materiais aparecerão aqui automaticamente.' : 'Vos recherches de matériaux apparaîtront ici automatiquement.'}</p>
            </div>
          ) : (
            <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {savedSearches.map(s => (
                <div key={s.id} className={cardCls}>
                  <div className={isV5 ? '' : 'v22-card-head'} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--v22-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.query}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                        <span className="v22-ref">
                          📅 {new Date(s.date).toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        {s.city && <span className="v22-tag v22-tag-green">📍 {s.city}</span>}
                        <span className="v22-ref">{s.materials.length} {locale === 'pt' ? 'materiais' : 'matériaux'}</span>
                        {s.totalEstimate && (
                          <span className="v22-tag v22-tag-green" style={{ fontWeight: 700 }}>
                            ~{s.totalEstimate.min}–{s.totalEstimate.max} €
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => {
                          setCurrentResults(s.materials)
                          setCurrentEstimate(s.totalEstimate)
                          setMessages([
                            { role: 'user', content: s.query },
                            { role: 'assistant', content: locale === 'pt'
                              ? `Resultados carregados do histórico de **${new Date(s.date).toLocaleDateString(dateFmtLocale)}**${s.city ? ` (${s.city})` : ''}.`
                              : `Résultats chargés depuis l'historique du **${new Date(s.date).toLocaleDateString(dateFmtLocale)}**${s.city ? ` (${s.city})` : ''}.` },
                          ])
                          setChatStarted(true)
                          setActiveTab('recherche')
                        }}
                        className={isV5 ? 'v5-btn v5-btn-p v5-btn-sm' : 'v22-btn v22-btn-primary v22-btn-sm'}
                      >
                        {locale === 'pt' ? '📂 Carregar' : '📂 Recharger'}
                      </button>
                      <button
                        onClick={() => {
                          const updated = savedSearches.filter(x => x.id !== s.id)
                          setSavedSearches(updated)
                          localStorage.setItem(`fixit_materiaux_${artisan?.id}`, JSON.stringify(updated))
                        }}
                        className={isV5 ? 'v5-btn v5-btn-sm v5-btn-d' : 'v22-btn v22-btn-sm'} style={isV5 ? undefined : { color: 'var(--v22-red)' }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AIDE TAB ── */}
      {activeTab === 'aide' && (
        <div style={{ padding: '14px', maxWidth: '720px', margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className={cardCls}>
              {!isV5 && <div className="v22-card-head"><div className="v22-card-title">{locale === 'pt' ? '🤖 Como funciona o agente?' : '🤖 Comment fonctionne l\'agent ?'}</div></div>}
              {isV5 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#1a1a1a', marginBottom: 8, letterSpacing: '.3px' }}>{locale === 'pt' ? '🤖 Como funciona o agente?' : '🤖 Comment fonctionne l\'agent ?'}</div>}
              <div className={isV5 ? '' : 'v22-card-body'}>
                <ol style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--v22-text-mid)', lineHeight: 1.6 }}>
                  {locale === 'pt' ? (
                    <>
                      <li><strong>Análise:</strong> A IA identifica os materiais necessários a partir da sua descrição</li>
                      <li><strong>Pesquisa:</strong> Cada material é pesquisado online (Leroy Merlin PT, AKI, Maxmat…)</li>
                      <li><strong>Comparação:</strong> Os preços são extraídos e comparados por loja</li>
                      <li><strong>Exportar:</strong> A lista pode ser exportada diretamente para um orçamento com margem configurável</li>
                    </>
                  ) : (
                    <>
                      <li><strong>Analyse :</strong> L&apos;IA identifie les matériaux nécessaires à partir de votre description</li>
                      <li><strong>Recherche :</strong> Chaque matériau est recherché sur internet (Leroy Merlin, Brico Dépôt, Castorama…)</li>
                      <li><strong>Comparaison :</strong> Les prix sont extraits et comparés par enseigne</li>
                      <li><strong>Export :</strong> La liste peut être exportée directement vers un devis avec marge configurable</li>
                    </>
                  )}
                </ol>
              </div>
            </div>
            <div className={cardCls}>
              {!isV5 && <div className="v22-card-head"><div className="v22-card-title">{locale === 'pt' ? '🛍️ Pesquisa Produto' : '🛍️ Recherche Produit'}</div></div>}
              {isV5 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#1a1a1a', marginBottom: 8, letterSpacing: '.3px' }}>{locale === 'pt' ? '🛍️ Pesquisa Produto' : '🛍️ Recherche Produit'}</div>}
              <div className="v22-card-body">
                <ul style={{ paddingLeft: '0', margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--v22-text-mid)' }}>
                  {locale === 'pt' ? (
                    <>
                      <li>🔍 <strong>Pesquisa direta</strong>: escreva o nome de uma ferramenta ou produto específico</li>
                      <li>🌐 <strong>Lojas online</strong>: Amazon, ManoMano, Leroy Merlin PT, AKI, Maxmat…</li>
                      <li>🛒 <strong>Links de compra</strong>: cada resultado tem um botão &quot;Comprar&quot; que abre a página do produto</li>
                      <li>💰 <strong>Comparação</strong>: os resultados são ordenados do mais barato ao mais caro</li>
                    </>
                  ) : (
                    <>
                      <li>🔍 <strong>Recherche directe</strong> : tapez le nom d&apos;un outil ou produit spécifique</li>
                      <li>🌐 <strong>Boutiques en ligne</strong> : Amazon, ManoMano, Leroy Merlin, Castorama, Toolstation…</li>
                      <li>🛒 <strong>Liens d&apos;achat</strong> : chaque résultat a un bouton &quot;Acheter&quot; qui ouvre la page produit</li>
                      <li>💰 <strong>Comparaison</strong> : les résultats sont triés du moins cher au plus cher</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
            <div className={cardCls}>
              {!isV5 && <div className="v22-card-head"><div className="v22-card-title">{locale === 'pt' ? '🏪 Lojas cobertas' : '🏪 Enseignes couvertes'}</div></div>}
              {isV5 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#1a1a1a', marginBottom: 8, letterSpacing: '.3px' }}>{locale === 'pt' ? '🏪 Lojas cobertas' : '🏪 Enseignes couvertes'}</div>}
              <div className={isV5 ? '' : 'v22-card-body'}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(locale === 'pt'
                    ? ['Leroy Merlin PT', 'AKI', 'Maxmat', 'Bricomarché', 'Wurth', 'Sanitop', 'Amazon', 'ManoMano']
                    : ['Leroy Merlin', 'Brico Dépôt', 'Castorama', 'Point P', 'Cédéo', 'Mr.Bricolage', 'Amazon', 'ManoMano', 'Toolstation', 'Cdiscount']
                  ).map(s => (
                    <span key={s} className={STORE_COLORS[s] || 'v22-tag v22-tag-gray'}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className={cardCls}>
              {!isV5 && <div className="v22-card-head"><div className="v22-card-title">{locale === 'pt' ? '💡 Dicas de utilização' : '💡 Conseils d\'utilisation'}</div></div>}
              {isV5 && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#1a1a1a', marginBottom: 8, letterSpacing: '.3px' }}>{locale === 'pt' ? '💡 Dicas de utilização' : '💡 Conseils d\'utilisation'}</div>}
              <div className={isV5 ? '' : 'v22-card-body'}>
                <ul style={{ paddingLeft: '0', margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--v22-text-mid)' }}>
                  {locale === 'pt' ? (
                    <>
                      <li>📍 <strong>Ative o GPS</strong> para resultados orientados à sua região</li>
                      <li>🎯 <strong>Seja preciso</strong>: &quot;esquentador 150L elétrico&quot; em vez de &quot;esquentador&quot;</li>
                      <li>📐 <strong>Indique as áreas</strong>: &quot;azulejo 20m²&quot; permite estimar as quantidades</li>
                      <li>💰 <strong>Ajuste a margem</strong> conforme o seu contrato e a complexidade da instalação</li>
                      <li>📄 <strong>Exporte para orçamento</strong> para faturar os materiais com IVA</li>
                    </>
                  ) : (
                    <>
                      <li>📍 <strong>Activez le GPS</strong> pour des résultats orientés vers votre région</li>
                      <li>🎯 <strong>Soyez précis</strong> : &quot;chauffe-eau 150L électrique&quot; plutôt que &quot;chauffe-eau&quot;</li>
                      <li>📐 <strong>Donnez les surfaces</strong> : &quot;carrelage 20m²&quot; permet d&apos;estimer les quantités</li>
                      <li>💰 <strong>Ajustez la marge</strong> selon votre contrat et la complexité de la pose</li>
                      <li>📄 <strong>Exportez vers devis</strong> pour facturer les matériaux avec TVA 10% (rénovation BTP)</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
            <div className={alertCls('amber')} style={{ cursor: 'default', fontSize: '12px', lineHeight: 1.6 }}>
              <span>
                {locale === 'pt' ? (
                  <>
                    <strong>⚠️ Aviso:</strong> Os preços apresentados são estimativas indicativas.
                    Podem variar conforme promoções, stock e localização. Verifique sempre os preços
                    finais diretamente nos sites ou em loja antes de elaborar um orçamento definitivo.
                  </>
                ) : (
                  <>
                    <strong>⚠️ Disclaimer :</strong> Les prix affichés sont des estimations à titre indicatif.
                    Ils peuvent varier selon les promotions, stocks et localisation. Vérifiez toujours les prix
                    définitifs directement sur les sites ou en magasin avant d&apos;établir un devis définitif.
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
