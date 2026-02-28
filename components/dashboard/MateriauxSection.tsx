'use client'

import { useState, useEffect, useRef } from 'react'

/* ══════════ MATÉRIAUX & PRIX SECTION ══════════ */

interface MatPrice { store: string; price: number; url: string | null }
interface MatItem { name: string; qty: number; unit: string; category: string; norms: string[]; normDetails: string; prices: MatPrice[]; bestPrice: { store: string; price: number } | null; avgPrice: number }
interface MatSearch { id: string; date: string; query: string; city: string | null; materials: MatItem[]; totalEstimate: { min: number; max: number } | null }

const JOB_PRESETS = [
  { label: '🚿 Chauffe-eau', q: 'Remplacement chauffe-eau thermodynamique 200L' },
  { label: '🪟 Carrelage 20m²', q: 'Pose carrelage sol 20m² format 60x60' },
  { label: '⚡ Tableau électrique', q: 'Remplacement tableau électrique 8 circuits' },
  { label: '🚪 Salle de bain', q: 'Rénovation salle de bain complète 6m²' },
  { label: '🔩 Robinetterie', q: 'Remplacement robinetterie cuisine et salle de bain' },
  { label: '🧱 Isolation combles', q: 'Isolation combles perdus 50m² laine de verre' },
]

const STORE_COLORS: Record<string, string> = {
  'Leroy Merlin': 'text-green-700 bg-green-50',
  'Brico Dépôt': 'text-orange-700 bg-orange-50',
  'Castorama': 'text-blue-700 bg-blue-50',
  'Point P': 'text-red-700 bg-red-50',
  'Cédéo': 'text-purple-700 bg-purple-50',
  'Mr.Bricolage': 'text-yellow-700 bg-yellow-50',
  'Brico Leclerc': 'text-teal-700 bg-teal-50',
  'Amazon': 'text-orange-700 bg-orange-50',
  'Amazon.fr': 'text-orange-700 bg-orange-50',
  'ManoMano': 'text-blue-700 bg-blue-50',
  'Toolstation': 'text-red-700 bg-red-50',
  'Cdiscount': 'text-red-700 bg-red-50',
}

const PRODUCT_PRESETS = [
  { label: '🔧 Disqueuse', q: 'disqueuse meuleuse 125mm' },
  { label: '🔩 Perceuse', q: 'perceuse visseuse sans fil 18V' },
  { label: '💨 Karcher', q: 'nettoyeur haute pression karcher' },
  { label: '🪜 Échafaudage', q: 'échafaudage roulant aluminium' },
  { label: '📐 Laser', q: 'niveau laser croix vert' },
  { label: '🔨 Visseuse', q: 'visseuse à chocs 18V' },
]

export default function MateriauxSection({ artisan, onExportDevis }: { artisan: any; onExportDevis: (lines: any[]) => void }) {
  const [activeTab, setActiveTab] = useState<'recherche' | 'historique' | 'aide'>('recherche')
  const [userCity, setUserCity] = useState<string | null>(null)
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
  const [productResults, setProductResults] = useState<Array<{
    name: string; description: string; price: number;
    store: string; url: string; image: string | null;
    condition: 'new' | 'refurbished';
  }> | null>(null)
  const [productRecommendations, setProductRecommendations] = useState('')
  const [productFetchedAt, setProductFetchedAt] = useState<string | null>(null)
  const [productTab, setProductTab] = useState<'new' | 'refurbished'>('new')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentResults])

  const handleGeolocation = () => {
    if (!navigator.geolocation) { setGeoError('Géolocalisation non supportée'); return }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
            { headers: { 'User-Agent': 'Vitfix-Pro/1.0' } }
          )
          const data = await res.json()
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || null
          setUserCity(city)
        } catch { setGeoError('Impossible de déterminer la ville') }
        setGeoLoading(false)
      },
      (err) => {
        setGeoError(err.code === 1 ? 'Accès à la position refusé' : 'Erreur de géolocalisation')
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
      const res = await fetch('/api/materiaux-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text.trim(),
          city: userCity,
          mode: searchMode,
          conversationHistory: messages.slice(-6),
        }),
      })
      const data = await res.json()

      // Handle API errors
      if (!res.ok || data.error) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ ${data.error || 'Erreur serveur. Veuillez réessayer.'}`,
        }])
        setIsLoading(false)
        setTimeout(() => inputRef.current?.focus(), 100)
        return
      }

      // Handle product mode response
      if (searchMode === 'product') {
        const products = data.products?.length > 0 ? data.products.map((p: any) => ({
          ...p,
          condition: p.condition === 'refurbished' ? 'refurbished' : 'new',
        })) : null
        setProductResults(products)
        setProductRecommendations(data.recommendations || '')
        setProductFetchedAt(data.fetchedAt || new Date().toISOString())
        // Auto-select tab with results
        if (products) {
          const hasNew = products.some((p: any) => p.condition === 'new')
          const hasRefurb = products.some((p: any) => p.condition === 'refurbished')
          setProductTab(hasNew ? 'new' : hasRefurb ? 'refurbished' : 'new')
        }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response || (data.products?.length > 0 ? 'Voici les produits trouvés.' : 'Aucun produit trouvé. Essayez une recherche plus précise.'),
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
        content: data.response || 'Voici les matériaux identifiés pour votre chantier.',
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Erreur de connexion. Veuillez réessayer.',
      }])
    }
    setIsLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // ─── Logique fiscale selon statut artisan ────────────────────────────────
  // Détermine si l'artisan est en franchise en base de TVA (auto-entrepreneur, ou EI sous seuil)
  // Seuils 2024-2025 : 37 500€ CA pour services / 85 000€ pour ventes de marchandises
  // Pour BTP (mixte prestation+fourniture) : seuil 37 500€ applicable
  const artisanLegalForm = (artisan?.legal_form || '').toLowerCase()
  const isAutoEntrepreneur = artisanLegalForm.includes('auto') || artisanLegalForm.includes('micro') || artisanLegalForm.includes('individuel')
  // TVA applicable si l'artisan est en société (SARL/SAS/EURL) ou a explicitement activé la TVA
  const isAssujetti = artisanLegalForm.includes('sarl') || artisanLegalForm.includes('sas') || artisanLegalForm.includes('eurl') || artisanLegalForm.includes('sa ')

  // Taux de TVA applicable sur la revente de matériaux BTP :
  // - Travaux de rénovation logement > 2 ans : 10% (art. 279-0 bis CGI)
  // - Travaux éco-rénovation éligibles (isolation, PAC) : 5.5% (art. 278-0 bis CGI)
  // - Travaux en logement neuf ou local professionnel : 20%
  // On utilise 10% par défaut (rénovation résidentielle = cas le plus courant)
  const TVA_REVENTE = 10   // % TVA sur prestations+fournitures facturées au client
  const TVA_ACHAT = 10     // % TVA incluse dans les prix TTC magasin (rénovation BTP)

  // Prix de revente HT à facturer au client selon statut fiscal :
  // AE/franchise : Prix achat TTC × (1 + marge%) → pas de TVA récupérée à l'achat
  //               → le devis est en HT = TTC (TVA non applicable art. 293B CGI)
  // Assujetti TVA : Prix achat TTC / (1 + TVA_ACHAT/100) = Prix achat HT artisan
  //               → Prix revente HT = Prix achat HT × (1 + marge%)
  //               → Le client paie HT + TVA 10% sur la prestation complète

  const getPrixAchatHT = (prixTTC: number) => {
    if (isAssujetti) return prixTTC / (1 + TVA_ACHAT / 100)  // récupère la TVA achat
    return prixTTC  // AE : supporte la TVA achat (non récupérable) → intégrer dans le coût
  }

  const getPrixRevente = (prixTTC: number, markup: number) => {
    const prixBase = getPrixAchatHT(prixTTC)
    return prixBase * (1 + markup / 100)
  }

  // Marge minimum recommandée : 25-35% (standard national artisans BTP, source CAPEB/FFB)
  // Pour AE : marge doit couvrir TVA achat non récupérable (10%) + bénéfice réel ≥ 15%
  // → recommandation min AE = 30%, min assujetti TVA = 25%
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
        priceHT,
        // AE : TVA non applicable → tvaRate = 0 et tvaEnabled = false dans le devis
        // Assujetti : TVA 10% rénovation BTP (art. 279-0 bis CGI)
        tvaRate: isAssujetti ? TVA_REVENTE : 0,
        totalHT: Math.round(priceHT * m.qty * 100) / 100,
      }
    })
    onExportDevis(exportLines)
  }

  const formatMsg = (text: string) => {
    // 1. Escape HTML first (XSS prevention)
    const escaped = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
    // 2. Apply markdown on escaped content
    return escaped
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>')
  }

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

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-[#FFC107] shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold">🛒 Matériaux & Prix</h1>
            <p className="text-sm text-gray-500 mt-0.5">Recherche IA autonome · Comparatif par enseigne</p>
          </div>
          <div className="flex items-center gap-2">
            {userCity && (
              <span className="text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1.5 font-semibold">
                📍 {userCity}
              </span>
            )}
            <button
              onClick={handleGeolocation}
              disabled={geoLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                userCity
                  ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'border-[#FFC107] bg-[#FFC107]/10 text-gray-800 hover:bg-[#FFC107]/20'
              }`}
            >
              {geoLoading ? '⏳' : '📍'} {userCity ? 'Mettre à jour' : 'Localisation GPS'}
            </button>
          </div>
        </div>
        {geoError && <p className="text-xs text-red-500 mt-2">⚠️ {geoError}</p>}
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-6 lg:px-10 pt-4 pb-0">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-0">
          {([
            { key: 'recherche', label: '🔍 Recherche' },
            { key: 'historique', label: `📋 Historique (${savedSearches.length})` },
            { key: 'aide', label: '💡 Aide' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
                activeTab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── RECHERCHE TAB ── */}
      {activeTab === 'recherche' && (
        <div className="p-6 lg:p-8">
          {/* Mode toggle */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6 mx-auto">
            <button
              onClick={() => { setSearchMode('project'); setProductResults(null); setProductRecommendations('') }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
                searchMode === 'project' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              🏗️ Matériaux chantier
            </button>
            <button
              onClick={() => { setSearchMode('product'); setCurrentResults(null); setCurrentEstimate(null) }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
                searchMode === 'product' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              🛍️ Recherche produit
            </button>
          </div>

          {/* Welcome screen — project mode */}
          {!chatStarted && searchMode === 'project' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-[#FFC107]/40 rounded-2xl p-8 mb-6 text-center">
                <div className="text-6xl mb-4">🛒</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Agent Matériaux IA</h2>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Décrivez votre intervention et l&apos;agent génère automatiquement la liste des matériaux
                  avec les prix par enseigne <strong>(Leroy Merlin, Brico Dépôt, Castorama…)</strong>
                </p>
                {!userCity && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
                    💡 Activez la localisation GPS pour des résultats adaptés à votre région
                  </div>
                )}
              </div>

              {/* Quick presets */}
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">Interventions courantes</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {JOB_PRESETS.map((p, i) => (
                    <button key={i} onClick={() => sendMessage(p.q)}
                      className="bg-white border-2 border-gray-200 hover:border-[#FFC107] hover:-translate-y-0.5 text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Welcome screen — product mode */}
          {!chatStarted && searchMode === 'product' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300/40 rounded-2xl p-8 mb-6 text-center">
                <div className="text-6xl mb-4">🛍️</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Recherche Produit</h2>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Recherchez un outil ou produit spécifique. L&apos;agent scanne les boutiques en ligne
                  <strong> (Amazon, ManoMano, Leroy Merlin, Castorama…)</strong> et affiche les meilleurs prix
                  avec des liens d&apos;achat directs.
                </p>
              </div>

              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">Recherches populaires</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRODUCT_PRESETS.map((p, i) => (
                    <button key={i} onClick={() => sendMessage(p.q)}
                      className="bg-white border-2 border-gray-200 hover:border-blue-400 hover:-translate-y-0.5 text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chat messages */}
          {chatStarted && (
            <div className="max-w-3xl mx-auto">
              <div className="space-y-4 mb-6">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 bg-[#FFC107] rounded-xl flex items-center justify-center text-lg mr-2 flex-shrink-0 mt-1">🛒</div>
                    )}
                    <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#FFC107] text-gray-900 font-medium rounded-tr-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                    }`}
                      dangerouslySetInnerHTML={{ __html: formatMsg(msg.content) }}
                    />
                  </div>
                ))}

                {/* Loading */}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="w-8 h-8 bg-[#FFC107] rounded-xl flex items-center justify-center text-lg mr-2 flex-shrink-0">🛒</div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-5 py-3 shadow-sm">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="flex gap-1">
                          <span className="w-2 h-2 bg-[#FFC107] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-[#FFC107] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-[#FFC107] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                        <span>{searchMode === 'product' ? 'Recherche du produit sur les boutiques en ligne...' : 'Recherche des matériaux et prix en cours...'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Résultats matériaux */}
                {currentResults && currentResults.length > 0 && !isLoading && (
                  <div className="space-y-4">
                    {isFallback && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex gap-2">
                        <span>⚠️</span>
                        <span>Prix estimés (sans recherche web en temps réel). Activez Tavily pour des prix actualisés.</span>
                      </div>
                    )}

                    {/* Cards matériaux */}
                    <div className="grid gap-3">
                      {currentResults.map((m, i) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                          {/* Header matériau */}
                          <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
                            <span className="text-2xl">{
                              m.category === 'Sanitaire' || m.category === 'Plomberie' ? '🔧'
                              : m.category === 'Électricité' ? '⚡'
                              : m.category === 'Chauffage' ? '🌡️'
                              : m.category === 'Carrelage' ? '🪟'
                              : m.category === 'Isolation' ? '🧱'
                              : m.category === 'Menuiserie' ? '🚪'
                              : m.category === 'Peinture' ? '🎨'
                              : m.category === 'Maçonnerie' ? '🧱'
                              : m.category === 'Toiture' ? '🏠'
                              : m.category === 'Ventilation' ? '💨'
                              : '📦'
                            }</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-gray-900">{m.name}</div>
                              <div className="text-xs text-gray-500">{m.qty} {m.unit} · {m.category}</div>
                            </div>
                            {m.bestPrice && (
                              <div className="text-right flex-shrink-0">
                                <div className="text-lg font-black text-green-600">{m.bestPrice.price} €</div>
                                <div className="text-xs text-gray-500">Meilleur prix</div>
                              </div>
                            )}
                          </div>

                          {/* Prix par enseigne */}
                          {m.prices.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                              {[...m.prices].sort((a, b) => a.price - b.price).map((p, j) => (
                                <div key={j} className={`flex items-center gap-3 px-5 py-2.5 ${
                                  m.bestPrice?.store === p.store ? 'bg-green-50' : ''
                                }`}>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${STORE_COLORS[p.store] || 'text-gray-700 bg-gray-100'}`}>
                                    {p.store}
                                  </span>
                                  <div className="flex-1" />
                                  <span className={`font-bold text-base ${m.bestPrice?.store === p.store ? 'text-green-700' : 'text-gray-700'}`}>
                                    {p.price} €
                                  </span>
                                  {m.bestPrice?.store === p.store && (
                                    <span className="text-green-600 text-xs font-bold">✅ Meilleur</span>
                                  )}
                                  {p.url && (
                                    <a href={p.url} target="_blank" rel="noopener noreferrer"
                                      className="text-blue-500 hover:text-blue-700 text-xs underline ml-1">↗</a>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="px-5 py-3 text-sm text-gray-500 italic">Prix non trouvés — vérifiez manuellement</div>
                          )}

                          {/* Normes applicables */}
                          {(m.norms?.length > 0 || m.normDetails) && (
                            <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
                              {m.norms?.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                  <span className="text-xs font-bold text-amber-700">📋 Normes :</span>
                                  {m.norms.map((n: string, ni: number) => (
                                    <span key={ni} className="text-xs bg-amber-100 border border-amber-300 text-amber-800 px-2 py-0.5 rounded-full font-mono font-semibold">
                                      {n}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {m.normDetails && (
                                <p className="text-xs text-amber-700 leading-relaxed">
                                  ⚠️ {m.normDetails}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Tableau comparatif si plusieurs enseignes */}
                    {allStores.length > 1 && (
                      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 font-bold text-sm text-gray-700">
                          📊 Tableau comparatif des prix
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="text-left px-4 py-2 text-gray-500 font-semibold">Matériau</th>
                                {allStores.map(s => (
                                  <th key={s} className="text-right px-4 py-2 text-gray-500 font-semibold whitespace-nowrap">{s}</th>
                                ))}
                                <th className="text-right px-4 py-2 text-green-600 font-semibold">Meilleur</th>
                              </tr>
                            </thead>
                            <tbody>
                              {currentResults.map((m, i) => (
                                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                  <td className="px-4 py-2 text-gray-800 font-medium max-w-[200px] truncate">{m.name}</td>
                                  {allStores.map(s => {
                                    const p = m.prices.find(pr => pr.store === s)
                                    const isBest = m.bestPrice?.store === s
                                    return (
                                      <td key={s} className={`text-right px-4 py-2 font-semibold ${
                                        isBest ? 'text-green-700 bg-green-50' : p ? 'text-gray-700' : 'text-gray-300'
                                      }`}>
                                        {p ? `${p.price} €` : '—'}
                                      </td>
                                    )
                                  })}
                                  <td className="text-right px-4 py-2 text-green-700 font-bold">
                                    {m.bestPrice ? `${m.bestPrice.price} €` : '—'}
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                                <td className="px-4 py-2 text-gray-700">TOTAL (meilleurs prix)</td>
                                {allStores.map(s => <td key={s} className="px-4 py-2" />)}
                                <td className="text-right px-4 py-2 text-green-700 text-base">
                                  {totalBestPrice > 0 ? `${totalBestPrice} €` : '—'}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Marge + Export devis */}
                    {totalBestPrice > 0 && (
                      <div className="bg-white border-2 border-[#FFC107]/40 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                          <h3 className="font-bold text-gray-800 text-lg">💰 Intégrer au devis</h3>
                          {/* Badge statut fiscal détecté */}
                          <span className={`text-xs px-3 py-1 rounded-full font-semibold border ${
                            isAssujetti
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : 'bg-amber-50 border-amber-200 text-amber-700'
                          }`}>
                            {isAssujetti
                              ? `📋 ${artisan?.legal_form || 'Société'} — TVA ${TVA_REVENTE}% applicable`
                              : `📋 ${isAutoEntrepreneur ? 'Auto-entrepreneur' : 'EI'} — Franchise en base TVA (art. 293B CGI)`
                            }
                          </span>
                        </div>

                        {/* Marge slider */}
                        <div className="flex items-center gap-4 mb-2">
                          <label className="text-sm font-semibold text-gray-600 flex-shrink-0">Marge de revente</label>
                          <input
                            type="range" min={0} max={60} value={globalMarkup}
                            onChange={e => setGlobalMarkup(Number(e.target.value))}
                            className="flex-1 accent-[#FFC107]"
                          />
                          <span className={`text-xl font-black w-14 text-right ${margeIsRentable ? 'text-green-600' : 'text-red-500'}`}>
                            {globalMarkup}%
                          </span>
                        </div>

                        {/* Alerte si marge insuffisante */}
                        {!margeIsRentable && totalBestPrice > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-red-700">
                            ⚠️ <strong>Marge insuffisante.</strong> Standard national CAPEB/FFB : min <strong>{margeMinRecommandee}%</strong>
                            {isAutoEntrepreneur ? ` en franchise TVA (couvre TVA achat non récupérable + charges + bénéfice)` : ` en société assujettie TVA`}.
                          </div>
                        )}
                        {margeIsRentable && totalBestPrice > 0 && (
                          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 mb-4 text-xs text-green-700">
                            ✅ Marge conforme aux standards nationaux BTP ({margeMinRecommandee}% min)
                          </div>
                        )}

                        {/* Tableau de calcul fiscal */}
                        <div className="bg-gray-50 rounded-2xl p-4 mb-5 space-y-2 text-sm">
                          <div className="flex justify-between text-gray-600">
                            <span>Coût achat matériaux (prix magasin TTC)</span>
                            <span className="font-semibold">{Math.round(totalBestPrice)} €</span>
                          </div>
                          {isAssujetti && (
                            <div className="flex justify-between text-gray-500 text-xs pl-3">
                              <span>→ TVA achat récupérée ({TVA_ACHAT}%) — crédit de TVA</span>
                              <span className="text-blue-600 font-semibold">−{Math.round(totalBestPrice - totalCoutAchatHT)} €</span>
                            </div>
                          )}
                          {isAutoEntrepreneur && (
                            <div className="flex justify-between text-gray-500 text-xs pl-3">
                              <span>→ TVA achat non récupérable (incluse dans votre coût réel)</span>
                              <span className="text-amber-600 font-semibold">{Math.round(totalBestPrice - totalBestPrice / (1 + TVA_ACHAT / 100))} €</span>
                            </div>
                          )}
                          <div className="flex justify-between text-gray-600 border-t border-gray-200 pt-2">
                            <span>Coût réel HT artisan</span>
                            <span className="font-semibold">{Math.round(totalCoutAchatHT)} €</span>
                          </div>
                          <div className="flex justify-between text-amber-700">
                            <span>Marge revente {globalMarkup}%</span>
                            <span className="font-bold">+{markupAmount} €</span>
                          </div>
                          <div className="flex justify-between text-gray-800 font-bold border-t border-gray-200 pt-2">
                            <span>Montant HT à facturer</span>
                            <span>{totalWithMarkup} €</span>
                          </div>
                          {isAssujetti && (
                            <div className="flex justify-between text-gray-600 text-xs pl-3">
                              <span>+ TVA {TVA_REVENTE}% collectée (art. 279-0 bis CGI — rénovation)</span>
                              <span>{Math.round(totalRevente * TVA_REVENTE / 100)} €</span>
                            </div>
                          )}
                          <div className={`flex justify-between font-black text-base pt-2 border-t-2 border-gray-300 ${isAssujetti ? 'text-blue-700' : 'text-green-700'}`}>
                            <span>Total TTC client</span>
                            <span>{Math.round(totalReventeTTC)} €</span>
                          </div>
                        </div>

                        {/* Info légale selon statut */}
                        <div className={`rounded-xl px-4 py-3 mb-4 text-xs leading-relaxed ${
                          isAssujetti ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {isAssujetti ? (
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
                          )}
                        </div>

                        <button onClick={handleExportDevis}
                          className="w-full bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-3.5 rounded-xl font-bold text-base shadow-md hover:-translate-y-0.5 transition-all">
                          📄 Exporter vers un devis ({totalWithMarkup} € HT
                          {isAssujetti ? ` + TVA ${TVA_REVENTE}% = ${Math.round(totalReventeTTC)} € TTC` : ' — TVA non applicable'})
                        </button>
                        <p className="text-xs text-gray-500 text-center mt-2">
                          {isAssujetti
                            ? `TVA ${TVA_REVENTE}% collectée sur revente · Prix HT client calculés avec marge ${globalMarkup}%`
                            : `Franchise TVA art. 293B CGI · Marge ${globalMarkup}% sur coût TTC artisan`
                          }
                        </p>
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
                  const timeStr = productFetchedAt ? new Date(productFetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null

                  return (
                  <div className="space-y-4">
                    {/* Onglets Neuf / Reconditionné */}
                    <div className="flex items-center gap-2">
                      <button onClick={() => setProductTab('new')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                          productTab === 'new'
                            ? 'bg-green-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        🆕 Neuf {newProducts.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${productTab === 'new' ? 'bg-white/20' : 'bg-gray-200'}`}>{newProducts.length}</span>}
                      </button>
                      <button onClick={() => setProductTab('refurbished')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                          productTab === 'refurbished'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        ♻️ Reconditionné / Déstockage {refurbProducts.length > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${productTab === 'refurbished' ? 'bg-white/20' : 'bg-gray-200'}`}>{refurbProducts.length}</span>}
                      </button>
                      {timeStr && (
                        <span className="ml-auto text-[11px] text-gray-500 italic">Prix constatés à {timeStr}</span>
                      )}
                    </div>

                    {activeProducts.length === 0 ? (
                      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
                        <div className="text-3xl mb-2">{productTab === 'new' ? '📦' : '♻️'}</div>
                        <p className="text-sm text-gray-500 font-medium">
                          Aucune offre {productTab === 'new' ? 'neuve' : 'reconditionnée / déstockage'} trouvée pour ce produit.
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {productTab === 'new' ? 'Essayez l\'onglet Reconditionné / Déstockage pour trouver des alternatives.' : 'Essayez l\'onglet Neuf pour voir les offres disponibles.'}
                        </p>
                      </div>
                    ) : (
                    <>
                    {/* Bandeau récapitulatif */}
                    {withPrice.length >= 2 && (
                      <div className={`bg-gradient-to-r ${productTab === 'new' ? 'from-green-50 to-emerald-50 border-green-200' : 'from-purple-50 to-fuchsia-50 border-purple-200'} border rounded-2xl p-4`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-sm font-bold ${productTab === 'new' ? 'text-green-800' : 'text-purple-800'}`}>
                            📊 Comparatif {productTab === 'new' ? 'Neuf' : 'Reconditionné / Déstockage'} — {withPrice.length} offres
                          </span>
                          {maxSaving > 0 && (
                            <span className={`${productTab === 'new' ? 'bg-green-600' : 'bg-purple-600'} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                              Économie jusqu&apos;à {maxSaving.toFixed(2)} € ({savingPct}%)
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                            <div className="text-xs text-gray-500 mb-1">🏆 Meilleur prix</div>
                            <div className={`text-lg font-black ${productTab === 'new' ? 'text-green-600' : 'text-purple-600'}`}>{cheapest.price.toFixed(2)} €</div>
                            <div className={`text-xs font-semibold mt-0.5 px-2 py-0.5 rounded-full inline-block ${STORE_COLORS[cheapest.store] || 'text-gray-700 bg-gray-100'}`}>
                              {cheapest.store}
                            </div>
                          </div>
                          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                            <div className="text-xs text-gray-500 mb-1">📈 Prix moyen</div>
                            <div className="text-lg font-bold text-gray-700">{avgPrice.toFixed(2)} €</div>
                            <div className="text-xs text-gray-500">{withPrice.length} offres</div>
                          </div>
                          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                            <div className="text-xs text-gray-500 mb-1">💸 Plus cher</div>
                            <div className="text-lg font-bold text-red-500">{mostExpensive.price.toFixed(2)} €</div>
                            <div className={`text-xs font-semibold mt-0.5 px-2 py-0.5 rounded-full inline-block ${STORE_COLORS[mostExpensive.store] || 'text-gray-700 bg-gray-100'}`}>
                              {mostExpensive.store}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {productRecommendations && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
                        💡 {productRecommendations}
                      </div>
                    )}

                    {/* Tableau comparatif des offres */}
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                      <div className={`px-4 py-3 ${productTab === 'new' ? 'bg-gray-50' : 'bg-purple-50/50'} border-b border-gray-200`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-gray-700">
                            {productTab === 'new' ? '🛒' : '♻️'} Offres {productTab === 'new' ? 'neuves' : 'reconditionnées / déstockage'}
                          </span>
                          <span className="text-xs text-gray-500">Triées du moins cher au plus cher</span>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {sorted.map((p, i) => {
                          const isBest = cheapest && p.price === cheapest.price && p.price > 0
                          const saving = cheapest && p.price > 0 ? p.price - cheapest.price : 0
                          const accentColor = productTab === 'new' ? 'green' : 'purple'
                          return (
                            <div key={i} className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors ${isBest ? (productTab === 'new' ? 'bg-green-50/50' : 'bg-purple-50/50') : ''}`}>
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                isBest ? `bg-${accentColor}-600 text-white` : 'bg-gray-100 text-gray-500'
                              }`}
                                style={isBest ? { backgroundColor: productTab === 'new' ? '#16a34a' : '#9333ea', color: '#fff' } : undefined}>
                                {p.price > 0 ? i + 1 : '—'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 text-sm leading-tight">{p.name}</div>
                                {p.description && (
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{p.description}</p>
                                )}
                              </div>
                              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${STORE_COLORS[p.store] || 'text-gray-700 bg-gray-100'}`}>
                                {p.store}
                              </span>
                              <div className="text-right flex-shrink-0 min-w-[90px]">
                                {p.price > 0 ? (
                                  <>
                                    <div className={`text-base font-black ${isBest ? (productTab === 'new' ? 'text-green-600' : 'text-purple-600') : 'text-gray-800'}`}>
                                      {p.price.toFixed(2)} €
                                    </div>
                                    {isBest && <div className={`text-[10px] font-bold ${productTab === 'new' ? 'text-green-600' : 'text-purple-600'} uppercase`}>Meilleur prix</div>}
                                    {!isBest && saving > 0 && (
                                      <div className="text-[10px] text-red-400">+{saving.toFixed(2)} €</div>
                                    )}
                                  </>
                                ) : (
                                  <div className="text-xs text-gray-500 italic">Voir prix</div>
                                )}
                              </div>
                              {p.url && (
                                <a href={p.url} target="_blank" rel="noopener noreferrer"
                                  className={`flex-shrink-0 px-3 py-2 rounded-xl font-bold text-xs transition-all shadow-sm whitespace-nowrap ${
                                    isBest
                                      ? (productTab === 'new' ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700') + ' text-white'
                                      : 'bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900'
                                  }`}>
                                  {isBest ? '🏆 Acheter' : 'Acheter →'}
                                </a>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700">
                      ⚠️ Prix constatés en temps réel — Les tarifs peuvent varier. Vérifiez le prix final sur le site du vendeur avant achat.
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
                <div className="flex gap-2 flex-wrap mb-4">
                  {(searchMode === 'product' ? PRODUCT_PRESETS : JOB_PRESETS).slice(0, 3).map((p, i) => (
                    <button key={i} onClick={() => sendMessage(p.q)}
                      className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-1.5 hover:bg-amber-100 transition font-medium whitespace-nowrap">
                      {p.label}
                    </button>
                  ))}
                  <button onClick={() => { setMessages([]); setChatStarted(false); setCurrentResults(null); setCurrentEstimate(null); setProductResults(null); setProductRecommendations(''); setProductFetchedAt(null); setProductTab('new') }}
                    className="text-xs bg-gray-100 border border-gray-200 text-gray-500 rounded-xl px-3 py-1.5 hover:bg-gray-200 transition font-medium">
                    🔄 Nouvelle recherche
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Input */}
          <div className="max-w-3xl mx-auto">
            <div className="bg-white border-2 border-gray-200 rounded-2xl shadow-sm focus-within:border-[#FFC107] transition-colors">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputValue) }
                }}
                placeholder={searchMode === 'product'
                  ? `Recherchez un outil ou produit...\nEx: "disqueuse Bosch 125mm" ou "perceuse Makita 18V"`
                  : userCity
                    ? `Décrivez votre intervention à ${userCity}...\nEx: "Remplacement chauffe-eau 150L" ou "Pose parquet flottant 30m²"`
                    : `Décrivez votre intervention...\nEx: "Remplacement chauffe-eau 150L" ou "Installation VMC double flux"`
                }
                rows={3}
                className="w-full px-5 pt-4 pb-2 text-sm focus:outline-none bg-transparent resize-none rounded-2xl"
                disabled={isLoading}
              />
              <div className="flex items-center justify-between px-4 pb-3">
                <span className="text-xs text-gray-300">Entrée = rechercher · Maj+Entrée = saut de ligne</span>
                <button
                  onClick={() => sendMessage(inputValue)}
                  disabled={!inputValue.trim() || isLoading}
                  className="bg-[#FFC107] hover:bg-[#FFD54F] disabled:opacity-40 text-gray-900 px-5 py-2 rounded-xl font-bold text-sm transition-all shadow-sm"
                >
                  {isLoading ? '⏳' : '🔍 Rechercher'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORIQUE TAB ── */}
      {activeTab === 'historique' && (
        <div className="p-6 lg:p-8">
          {savedSearches.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">Aucune recherche sauvegardée</h3>
              <p className="text-gray-500 text-sm">Vos recherches de matériaux apparaîtront ici automatiquement.</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl mx-auto">
              {savedSearches.map(s => (
                <div key={s.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4 p-5">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 truncate">{s.query}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">
                          📅 {new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        {s.city && <span className="text-xs text-blue-600">📍 {s.city}</span>}
                        <span className="text-xs text-gray-500">{s.materials.length} matériaux</span>
                        {s.totalEstimate && (
                          <span className="text-xs font-bold text-green-600">
                            ~{s.totalEstimate.min}–{s.totalEstimate.max} €
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setCurrentResults(s.materials)
                          setCurrentEstimate(s.totalEstimate)
                          setMessages([
                            { role: 'user', content: s.query },
                            { role: 'assistant', content: `Résultats chargés depuis l'historique du **${new Date(s.date).toLocaleDateString('fr-FR')}**${s.city ? ` (${s.city})` : ''}.` },
                          ])
                          setChatStarted(true)
                          setActiveTab('recherche')
                        }}
                        className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                      >
                        📂 Recharger
                      </button>
                      <button
                        onClick={() => {
                          const updated = savedSearches.filter(x => x.id !== s.id)
                          setSavedSearches(updated)
                          localStorage.setItem(`fixit_materiaux_${artisan?.id}`, JSON.stringify(updated))
                        }}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl text-sm transition-all border border-gray-200"
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
        <div className="p-6 lg:p-8 max-w-3xl mx-auto">
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 text-lg">🤖 Comment fonctionne l&apos;agent ?</h3>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-600 leading-relaxed">
                <li><strong>Analyse :</strong> L&apos;IA identifie les matériaux nécessaires à partir de votre description</li>
                <li><strong>Recherche :</strong> Chaque matériau est recherché sur internet (Leroy Merlin, Brico Dépôt, Castorama…)</li>
                <li><strong>Comparaison :</strong> Les prix sont extraits et comparés par enseigne</li>
                <li><strong>Export :</strong> La liste peut être exportée directement vers un devis avec marge configurable</li>
              </ol>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 text-lg">🛍️ Recherche Produit</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>🔍 <strong>Recherche directe</strong> : tapez le nom d&apos;un outil ou produit spécifique</li>
                <li>🌐 <strong>Boutiques en ligne</strong> : Amazon, ManoMano, Leroy Merlin, Castorama, Toolstation…</li>
                <li>🛒 <strong>Liens d&apos;achat</strong> : chaque résultat a un bouton &quot;Acheter&quot; qui ouvre la page produit</li>
                <li>💰 <strong>Comparaison</strong> : les résultats sont triés du moins cher au plus cher</li>
              </ul>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 text-lg">🏪 Enseignes couvertes</h3>
              <div className="flex flex-wrap gap-2">
                {['Leroy Merlin', 'Brico Dépôt', 'Castorama', 'Point P', 'Cédéo', 'Mr.Bricolage',
                  'Amazon', 'ManoMano', 'Toolstation', 'Cdiscount'].map(s => (
                  <span key={s} className={`px-3 py-1.5 rounded-full text-sm font-semibold ${STORE_COLORS[s] || 'bg-gray-100 text-gray-700'}`}>{s}</span>
                ))}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 text-lg">💡 Conseils d&apos;utilisation</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>📍 <strong>Activez le GPS</strong> pour des résultats orientés vers votre région</li>
                <li>🎯 <strong>Soyez précis</strong> : &quot;chauffe-eau 150L électrique&quot; plutôt que &quot;chauffe-eau&quot;</li>
                <li>📐 <strong>Donnez les surfaces</strong> : &quot;carrelage 20m²&quot; permet d&apos;estimer les quantités</li>
                <li>💰 <strong>Ajustez la marge</strong> selon votre contrat et la complexité de la pose</li>
                <li>📄 <strong>Exportez vers devis</strong> pour facturer les matériaux avec TVA 10% (rénovation BTP)</li>
              </ul>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-700">
              <strong>⚠️ Disclaimer :</strong> Les prix affichés sont des estimations à titre indicatif.
              Ils peuvent varier selon les promotions, stocks et localisation. Vérifiez toujours les prix
              définitifs directement sur les sites ou en magasin avant d&apos;établir un devis définitif.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
