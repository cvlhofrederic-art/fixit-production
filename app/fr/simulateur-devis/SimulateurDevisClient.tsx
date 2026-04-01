'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { PHONE_FR } from '@/lib/constants'

// ─── Données service ───────────────────────────────────────────────────────────
const SERVICE_KEYWORDS: Record<string, { name: string; icon: string; slug: string; keywords: string[] }> = {
  plombier: {
    slug: 'plombier', name: 'Plomberie', icon: '🔧',
    keywords: ['fuite', 'eau', 'plomberie', 'robinet', 'canalisation', 'wc', 'toilette', 'chauffe-eau', 'debouchage', 'débouchage', 'tuyau', 'sanitaire', 'plombier', 'douche', 'baignoire', 'lavabo', 'siphon', 'dégât'],
  },
  electricien: {
    slug: 'electricien', name: 'Électricité', icon: '⚡',
    keywords: ['électricité', 'electricite', 'prise', 'tableau', 'disjoncteur', 'cable', 'éclairage', 'lumiere', 'electricien', 'électricien', 'courant', 'panne', 'court-circuit', 'interrupteur', 'norme', 'borne', 'recharge'],
  },
  serrurier: {
    slug: 'serrurier', name: 'Serrurerie', icon: '🔐',
    keywords: ['serrure', 'porte claquée', 'clé', 'claque', 'serrurier', 'cylindre', 'blindage', 'ouverture', 'enfermé', 'enfermée', 'verrou', 'claquee'],
  },
  peintre: {
    slug: 'peintre', name: 'Peinture', icon: '🎨',
    keywords: ['peinture', 'repeindre', 'facade', 'ravalement', 'peindre', 'peintre', 'décoration', 'enduit', 'rafraichir', 'mur'],
  },
  couvreur: {
    slug: 'couvreur', name: 'Toiture', icon: '🏠',
    keywords: ['toit', 'toiture', 'tuile', 'couvreur', 'ardoise', 'charpente', 'combles', 'gouttiere', 'gouttière', 'infiltration', 'fuite toit'],
  },
  paysagiste: {
    slug: 'espaces-verts', name: 'Jardin & Espaces verts', icon: '🌿',
    keywords: ['jardin', 'taille', 'tonte', 'haie', 'arbre', 'paysagiste', 'pelouse', 'gazon', 'debroussaillage', 'débroussaillage', 'elagage', 'élagage', 'herbe'],
  },
  carreleur: {
    slug: 'carreleur', name: 'Carrelage', icon: '⬜',
    keywords: ['carrelage', 'carreau', 'faïence', 'faience', 'carreleur', 'recarreler', 'sol abimé', 'dalle'],
  },
  climatisation: {
    slug: 'climatisation', name: 'Climatisation', icon: '❄️',
    keywords: ['clim', 'climatisation', 'climatiseur', 'split', 'pompe à chaleur', 'pac', 'reversible', 'chauffage climatisé'],
  },
  macon: {
    slug: 'macon', name: 'Maçonnerie', icon: '🧱',
    keywords: ['maçon', 'maconnerie', 'béton', 'beton', 'mur porteur', 'cloison', 'extension', 'agrandissement', 'terrasse béton', 'fissure', 'enduit facade'],
  },
  encombrants: {
    slug: 'nettoyage-encombrants', name: 'Débarras / Encombrants', icon: '🗑️',
    keywords: ['débarras', 'debarras', 'encombrant', 'nettoyage', 'vider', 'cave', 'grenier', 'déménagement', 'remise en état'],
  },
  metallier: {
    slug: 'metallerie', name: 'Métallerie / Ferronnerie', icon: '⚙️',
    keywords: ['portail', 'grille', 'garde-corps', 'balustrade', 'rampe', 'escalier métallique', 'métallier', 'ferronnier', 'ferronnerie', 'métallerie', 'fer forgé', 'acier', 'inox', 'aluminium'],
  },
}

// Prix indicatifs par service (PACA 2026)
const SERVICE_PRICES: Record<string, { label: string; detail: string; color: string }> = {
  plombier:           { label: '80 € – 350 €', detail: 'intervention main d\'œuvre', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  electricien:        { label: '80 € – 500 €', detail: 'selon type d\'intervention', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  serrurier:          { label: '80 € – 400 €', detail: 'ouverture / remplacement', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  peintre:            { label: '25 € – 70 €/m²', detail: 'main d\'œuvre uniquement', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  couvreur:           { label: '200 € – 800 €', detail: 'réparation / nettoyage', color: 'bg-stone-50 text-stone-700 border-stone-200' },
  'espaces-verts':    { label: '60 € – 300 €', detail: 'par passage / entretien', color: 'bg-green-50 text-green-700 border-green-200' },
  carreleur:          { label: '35 € – 85 €/m²', detail: 'pose main d\'œuvre', color: 'bg-gray-50 text-gray-700 border-gray-200' },
  climatisation:      { label: '800 € – 3 500 €', detail: 'fourniture + pose', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  macon:              { label: '50 € – 2 500 €', detail: 'selon envergure travaux', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  'nettoyage-encombrants': { label: '150 € – 900 €', detail: 'selon volume', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  metallerie:              { label: '500 € – 5 000 €', detail: 'selon ouvrage (portail, garde-corps…)', color: 'bg-slate-50 text-slate-700 border-slate-200' },
}

const PACA_CITIES = [
  'Marseille', 'Aix-en-Provence', 'Aubagne', 'La Ciotat', 'Cassis', 'Martigues',
  'Allauch', 'Salon-de-Provence', 'Saint-Cyr-sur-Mer', 'Bandol', 'Gémenos',
  'Sanary-sur-Mer', 'Six-Fours-les-Plages', 'La Seyne-sur-Mer', 'Hyères',
  'Plan-de-Cuques', 'Gardanne', 'Toulon', 'Arles', 'Avignon', 'Castelane',
  'Carry-le-Rouet', 'Vitrolles', 'Istres', 'Miramas',
]

const EXAMPLE_SEARCHES = [
  "J'ai une fuite d'eau dans ma salle de bain à Marseille",
  "Besoin d'un électricien pour changer mon tableau à Aubagne",
  "Porte claquée, urgence serrurerie La Ciotat",
  "Tonte pelouse et taille haies à Aix-en-Provence",
  "Pose carrelage salle de bain Cassis",
  "Installation climatisation à Sanary-sur-Mer",
]

// Détection service depuis texte libre
function detectService(text: string): string | null {
  const lower = text.toLowerCase()
  let best: string | null = null
  let bestScore = 0
  for (const [key, config] of Object.entries(SERVICE_KEYWORDS)) {
    const score = config.keywords.filter(kw => lower.includes(kw)).length
    if (score > bestScore) { bestScore = score; best = key }
  }
  return bestScore > 0 ? best : null
}

// Détection ville depuis texte libre
function detectCity(text: string): string | null {
  const lower = text.toLowerCase()
  for (const city of PACA_CITIES) {
    if (lower.includes(city.toLowerCase())) return city
  }
  const arrMatch = text.match(/marseille[\s-]*(\d{1,2})/i)
  if (arrMatch) {
    const n = arrMatch[1]
    return `Marseille ${n}${n === '1' ? 'er' : 'ème'}`
  }
  return null
}

interface ArtisanPrice {
  name: string
  price_ttc: number
  duration_minutes: number
}

interface ArtisanResult {
  id: string
  slug?: string | null
  company_name: string
  categories: string[]
  hourly_rate?: number | null
  rating_avg?: number | null
  rating_count?: number | null
  verified?: boolean | null
  city?: string | null
  profile_photo_url?: string | null
  experience_years?: number | null
  prices: ArtisanPrice[]
  min_price?: number | null
  source: 'registered'
}

interface CatalogueArtisan {
  id: string
  nom_entreprise: string
  metier: string
  ville: string | null
  adresse?: string | null
  telephone_pro?: string | null
  google_note?: number | null
  google_avis?: number | null
  pappers_verifie?: boolean | null
}

interface SimulateurDevisClientProps {
  initialCity?: string
  citySlug?: string
}

export default function SimulateurDevisClient({ initialCity = '', citySlug }: SimulateurDevisClientProps) {
  const [query, setQuery] = useState('')
  const [detectedService, setDetectedService] = useState<string | null>(null)
  const [detectedCity, setDetectedCity] = useState<string>(initialCity)
  const [cityInput, setCityInput] = useState(initialCity)
  const [artisans, setArtisans] = useState<ArtisanResult[]>([])
  const [catalogueArtisans, setCatalogueArtisans] = useState<CatalogueArtisan[]>([])
  const [artisanSource, setArtisanSource] = useState<'vitfix' | 'catalogue' | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [exampleIdx, setExampleIdx] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Rotation des exemples
  useEffect(() => {
    const t = setInterval(() => setExampleIdx(i => (i + 1) % EXAMPLE_SEARCHES.length), 3000)
    return () => clearInterval(t)
  }, [])

  // Détection en temps réel
  useEffect(() => {
    const full = query + (cityInput ? ` à ${cityInput}` : '')
    setDetectedService(detectService(full))
    const city = detectCity(full) || cityInput
    if (city) setDetectedCity(city)
  }, [query, cityInput])

  const handleSearch = async () => {
    const svc = detectedService
    const city = detectedCity || cityInput.trim()
    if (!svc && !city) return
    setLoading(true)
    setSearched(true)
    setArtisans([])
    setCatalogueArtisans([])
    setArtisanSource(null)
    try {
      const slug = svc ? SERVICE_KEYWORDS[svc]?.slug || svc : ''
      const params = new URLSearchParams({ limit: '6' })
      if (city) params.set('city', city)
      if (slug) params.set('service', slug)

      // 1. Essai artisans VITFIX inscrits
      const res = await fetch(`/api/simulateur-artisans?${params}`)
      const data = await res.json()
      const registered: ArtisanResult[] = data.artisans || []

      if (registered.length > 0) {
        setArtisans(registered)
        setArtisanSource('vitfix')
      } else {
        // 2. Fallback : catalogue SIRENE si aucun artisan VITFIX
        const catRes = await fetch(`/api/artisans-catalogue?${params}`)
        const catData = await catRes.json()
        setCatalogueArtisans(catData.artisans || [])
        setArtisanSource('catalogue')
      }
    } catch {
      setArtisans([])
      setCatalogueArtisans([])
    } finally {
      setLoading(false)
    }
  }

  const handleExample = (ex: string) => {
    setQuery(ex)
    const svc = detectService(ex)
    const city = detectCity(ex)
    setDetectedService(svc)
    if (city) { setDetectedCity(city); setCityInput(city) }
    inputRef.current?.focus()
  }

  const reset = () => {
    setQuery('')
    setDetectedService(null)
    setDetectedCity(initialCity)
    setCityInput(initialCity)
    setArtisans([])
    setCatalogueArtisans([])
    setArtisanSource(null)
    setSearched(false)
  }

  const svcConfig = detectedService ? SERVICE_KEYWORDS[detectedService] : null
  const priceInfo = svcConfig ? (SERVICE_PRICES[svcConfig.slug] ?? (detectedService ? SERVICE_PRICES[detectedService] : null) ?? null) : null

  return (
    <div className="min-h-screen bg-[#F8F7F2]">
      {/* ── Hero ── */}
      <div className="bg-dark text-white pt-14 pb-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-yellow/20 text-yellow rounded-full px-4 py-1.5 text-sm font-medium mb-5">
            🧮 Gratuit · Résultat instantané
          </div>
          <h1 className="font-display text-[clamp(1.7rem,4vw,2.8rem)] font-extrabold tracking-tight mb-3">
            {initialCity
              ? <><span className="text-yellow">À {initialCity}</span>, trouvez votre artisan</>
              : 'Décrivez vos travaux, trouvez l\'artisan'}
          </h1>
          <p className="text-white/60 text-base max-w-lg mx-auto">
            Tapez votre besoin en langage naturel. On détecte le métier, la ville et les prix en temps réel.
          </p>
        </div>
      </div>

      {/* ── Barre de recherche centrale ── */}
      <div className="max-w-3xl mx-auto px-4 -mt-6">
        <div className="bg-white rounded-2xl shadow-lg border border-border p-4 space-y-3">
          {/* Textarea */}
          <div className="relative">
            <textarea
              ref={inputRef}
              rows={2}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSearch() } }}
              placeholder={EXAMPLE_SEARCHES[exampleIdx]}
              className="w-full resize-none border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yellow placeholder:text-text-muted/60 transition-colors"
            />
          </div>

          {/* Ville + bouton */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">📍</span>
              <input
                type="text"
                placeholder="Votre ville (ex: La Ciotat)"
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                className="w-full border border-border rounded-xl pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-yellow"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || (!query.trim() && !cityInput.trim())}
              className="bg-yellow text-dark font-bold rounded-xl px-6 py-3 text-sm hover:bg-yellow/80 transition-colors disabled:opacity-40 flex items-center gap-2 shrink-0"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              ) : '🔍'}
              Trouver
            </button>
          </div>

          {/* Chips de détection temps réel */}
          {(svcConfig || detectedCity) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {svcConfig && (
                <span className="inline-flex items-center gap-1.5 bg-dark/5 text-dark rounded-full px-3 py-1 text-xs font-semibold">
                  {svcConfig.icon} {svcConfig.name} détecté
                </span>
              )}
              {detectedCity && (
                <span className="inline-flex items-center gap-1.5 bg-yellow/20 text-dark rounded-full px-3 py-1 text-xs font-semibold">
                  📍 {detectedCity}
                </span>
              )}
              {priceInfo && (
                <span className={`inline-flex items-center gap-1 border rounded-full px-3 py-1 text-xs font-semibold ${priceInfo.color}`}>
                  💰 {priceInfo.label}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Exemples de recherche ── */}
      {!searched && (
        <div className="max-w-3xl mx-auto px-4 mt-8">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-3">Exemples de demandes</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_SEARCHES.map((ex, i) => (
              <button
                key={i}
                onClick={() => handleExample(ex)}
                className="text-xs bg-white border border-border rounded-full px-4 py-2 text-text-muted hover:border-yellow hover:text-dark transition-colors text-left"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Résultats ── */}
      {searched && (
        <div className="max-w-3xl mx-auto px-4 mt-8 pb-16 space-y-6">

          {/* Prix indicatif */}
          {priceInfo && svcConfig && (
            <div className={`rounded-2xl border p-5 flex items-start gap-4 ${priceInfo.color}`}>
              <span className="text-3xl">{svcConfig.icon}</span>
              <div>
                <p className="font-bold text-base">{svcConfig.name} · tarif indicatif PACA 2026</p>
                <p className="text-2xl font-extrabold mt-0.5">{priceInfo.label}</p>
                <p className="text-xs opacity-70 mt-1">{priceInfo.detail} · Devis gratuit confirmé par l'artisan sur place</p>
              </div>
            </div>
          )}

          {/* Artisans */}
          {loading ? (
            <div className="text-center py-12 text-text-muted">
              <div className="animate-spin w-8 h-8 border-2 border-yellow border-t-transparent rounded-full mx-auto mb-3" />
              Recherche des artisans disponibles…
            </div>

          ) : artisanSource === 'vitfix' && artisans.length > 0 ? (
            /* ── ARTISANS VITFIX ── */
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-yellow text-dark rounded-full px-3 py-1 uppercase tracking-wide">✓ Artisans VITFIX certifiés</span>
                <span className="text-xs text-text-muted">{artisans.length} disponible{artisans.length > 1 ? 's' : ''}{detectedCity ? ` à ${detectedCity}` : ''}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {artisans.map(a => {
                  const pricesList = a.prices || []
                  const profileUrl = a.slug ? `/artisan/${a.slug}` : `/recherche${detectedCity ? `?loc=${encodeURIComponent(detectedCity)}` : ''}`
                  return (
                    <div key={a.id} className="bg-white rounded-2xl border-2 border-yellow/40 overflow-hidden hover:shadow-lg hover:border-yellow transition-all">
                      <div className="p-5 pb-4">
                        {/* Nom + badge */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-dark truncate">{a.company_name}</p>
                            <p className="text-xs text-text-muted capitalize">
                              {(a.categories || []).slice(0, 2).join(' · ')}
                              {a.experience_years ? ` · ${a.experience_years} ans` : ''}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs bg-yellow/20 text-dark border border-yellow/40 rounded-full px-2 py-0.5 font-bold">
                            VITFIX
                          </span>
                        </div>

                        {/* Note + ville */}
                        <div className="flex items-center gap-3 mb-3 text-xs text-text-muted">
                          {a.rating_avg && a.rating_avg > 0 && (
                            <span className="flex items-center gap-1 text-yellow-600 font-semibold">
                              ★ {a.rating_avg.toFixed(1)}
                              {a.rating_count ? <span className="font-normal text-text-muted">({a.rating_count})</span> : null}
                            </span>
                          )}
                          {a.city && <span>📍 {a.city}</span>}
                          {a.hourly_rate && <span>⏱ {a.hourly_rate} €/h</span>}
                        </div>

                        {/* Tarifs réels */}
                        {pricesList.length > 0 && (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 mb-3">
                            <p className="text-xs font-semibold text-emerald-700 mb-1.5">💰 Tarifs affichés</p>
                            <div className="space-y-1">
                              {pricesList.map((p, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                  <span className="text-dark/70 truncate mr-2">{p.name}</span>
                                  <span className="font-bold text-emerald-700 shrink-0">{p.price_ttc} €</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* CTA principal : profil + RDV */}
                      <Link
                        href={profileUrl}
                        className="flex items-center justify-center gap-2 bg-yellow text-dark font-bold py-3.5 px-4 hover:bg-yellow/80 transition-colors text-sm w-full"
                      >
                        📅 Voir les tarifs &amp; Prendre rendez-vous
                      </Link>
                    </div>
                  )
                })}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href={`/recherche${detectedCity ? `?loc=${encodeURIComponent(detectedCity)}` : ''}${svcConfig ? `&cat=${svcConfig.slug}` : ''}`}
                  className="flex-1 text-center bg-dark text-white font-bold rounded-full py-3 text-sm hover:bg-dark/80 transition-colors"
                >
                  Voir tous les artisans VITFIX →
                </Link>
                <button onClick={reset} className="flex-1 text-center border border-border text-text-muted rounded-full py-3 text-sm hover:border-dark hover:text-dark transition-colors">
                  Nouvelle recherche
                </button>
              </div>
            </>

          ) : artisanSource === 'catalogue' ? (
            /* ── FALLBACK CATALOGUE (pas d'artisan VITFIX dans la zone) ── */
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                <span className="text-xl">ℹ️</span>
                <div>
                  <p className="font-semibold text-amber-800 text-sm">Pas encore d'artisan VITFIX dans cette zone</p>
                  <p className="text-xs text-amber-700 mt-0.5">Voici des professionnels de la zone trouvés dans notre base. Pour un artisan certifié avec tarifs garantis, contactez VITFIX directement.</p>
                </div>
              </div>

              {catalogueArtisans.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {catalogueArtisans.map(a => {
                    const googleUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${a.nom_entreprise} ${a.ville || ''}`)}`
                    return (
                      <div key={a.id} className="bg-white rounded-xl border border-border p-4 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-dark text-sm truncate">{a.nom_entreprise}</p>
                          <p className="text-xs text-text-muted">{a.metier}{a.ville ? ` · ${a.ville}` : ''}</p>
                          {a.google_note && (
                            <p className="text-xs text-yellow-600 font-medium mt-0.5">★ {a.google_note.toFixed(1)}{a.google_avis ? ` (${a.google_avis})` : ''}</p>
                          )}
                        </div>
                        <a
                          href={googleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-xs bg-white border border-border rounded-lg px-3 py-1.5 text-text-muted hover:border-dark hover:text-dark transition-colors font-medium"
                        >
                          Google Maps ↗
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* CTA VITFIX prioritaire */}
              <div className="bg-dark rounded-2xl p-6 text-center text-white">
                <p className="font-bold text-lg mb-1">Vous préférez un artisan certifié VITFIX ?</p>
                <p className="text-white/60 text-sm mb-4">On vous met en contact avec le bon professionnel, tarifs affichés, réservation directe.</p>
                <a
                  href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=${encodeURIComponent(`Bonjour VITFIX ! J'ai besoin d'un artisan${query ? ` pour : ${query}` : ''}${detectedCity ? ` à ${detectedCity}` : ''}. Pouvez-vous m'aider ?`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#25D366] text-white font-bold rounded-full px-7 py-3 text-sm hover:bg-[#20ba59] transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Contacter VITFIX sur WhatsApp
                </a>
                <div className="mt-3">
                  <button onClick={reset} className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors">
                    Nouvelle recherche
                  </button>
                </div>
              </div>
            </>

          ) : searched && !loading ? (
            <div className="bg-white rounded-2xl border border-border p-8 text-center">
              <p className="text-3xl mb-3">🔍</p>
              <p className="font-bold text-dark mb-1">Aucun artisan trouvé</p>
              <p className="text-sm text-text-muted mb-5">Contactez VITFIX directement, on vous trouve la bonne ressource.</p>
              <a
                href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=${encodeURIComponent(`Bonjour VITFIX ! J'ai besoin d'un artisan${query ? ` pour : ${query}` : ''}${detectedCity ? ` à ${detectedCity}` : ''}. Pouvez-vous m'aider ?`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#25D366] text-white font-bold rounded-full px-6 py-3 text-sm hover:bg-[#20ba59] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Contacter VITFIX sur WhatsApp
              </a>
            </div>
          ) : null}

          {/* Disclaimer */}
          <p className="text-xs text-text-muted text-center max-w-md mx-auto">
            ⚠️ Les tarifs affichés sont indicatifs, basés sur les moyennes PACA 2026. Le devis définitif est confirmé gratuitement par l'artisan après visite.
          </p>
        </div>
      )}

      {/* ── Liens villes (si pas encore cherché) ── */}
      {!searched && (
        <div className="max-w-3xl mx-auto px-4 mt-12 pb-16">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-4">Simulateur disponible dans toute la région PACA</p>
          <div className="flex flex-wrap gap-2">
            {[
              { slug: 'marseille', name: 'Marseille' },
              { slug: 'aix-en-provence', name: 'Aix-en-Provence' },
              { slug: 'aubagne', name: 'Aubagne' },
              { slug: 'la-ciotat', name: 'La Ciotat' },
              { slug: 'cassis', name: 'Cassis' },
              { slug: 'toulon', name: 'Toulon' },
              { slug: 'bandol', name: 'Bandol' },
              { slug: 'sanary-sur-mer', name: 'Sanary-sur-Mer' },
              { slug: 'hyeres', name: 'Hyères' },
              { slug: 'martigues', name: 'Martigues' },
              { slug: 'salon-de-provence', name: 'Salon-de-Provence' },
              { slug: 'six-fours-les-plages', name: 'Six-Fours-les-Plages' },
              { slug: 'la-seyne-sur-mer', name: 'La Seyne-sur-Mer' },
              { slug: 'plan-de-cuques', name: 'Plan-de-Cuques' },
              { slug: 'allauch', name: 'Allauch' },
              { slug: 'gemenos', name: 'Gémenos' },
              { slug: 'gardanne', name: 'Gardanne' },
              { slug: 'saint-cyr-sur-mer', name: 'Saint-Cyr-sur-Mer' },
            ].filter(c => c.slug !== citySlug).map(c => (
              <a
                key={c.slug}
                href={`/fr/simulateur-devis/${c.slug}`}
                className="text-xs bg-white border border-border rounded-full px-3 py-1.5 text-text-muted hover:border-yellow hover:text-dark transition-colors"
              >
                {c.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
