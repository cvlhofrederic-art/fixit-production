import { NextResponse, type NextRequest } from 'next/server'

// Vercel serverless timeout (2 Tavily + 1 Groq = peut dépasser 10s)
export const maxDuration = 30

// Agent Matériaux — Powered by Groq (Llama 3.3-70B) + Tavily AI Search
// Expert BTP : normes DTU/NF/RE2020, prix magasin réels, conformité réglementaire

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || ''
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''

// ─── Cache en mémoire (survit tant que la fonction serverless est chaude) ────
// Clé = hash de la query normalisée, valeur = { data, timestamp }
const CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4h (prix changent souvent)
const responseCache = new Map<string, { data: any; ts: number }>()

function getCacheKey(query: string, mode: string, city?: string): string {
  return `${mode}:${(query || '').trim().toLowerCase()}:${(city || '').trim().toLowerCase()}`
}

function getFromCache(key: string): any | null {
  const entry = responseCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    responseCache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key: string, data: any) {
  // Nettoyer les entrées expirées si le cache grossit
  if (responseCache.size > 100) {
    const now = Date.now()
    for (const [k, v] of responseCache) {
      if (now - v.ts > CACHE_TTL_MS) responseCache.delete(k)
    }
  }
  responseCache.set(key, { data, ts: Date.now() })
}

interface MaterialItem {
  name: string
  qty: number
  unit: string
  category: string
  norms: string[]          // ex: ["DTU 65.11", "NF EN 12897", "RE2020"]
  normDetails: string      // ex: "Distance mini 0.5m du tableau électrique"
  prices: Array<{ store: string; price: number; url: string | null }>
  bestPrice: { store: string; price: number } | null
  avgPrice: number
}

interface ProductItem {
  name: string
  description: string
  price: number
  store: string
  url: string
  image: string | null
  condition: 'new' | 'refurbished'
}

// ─── Base de connaissances normes BTP ────────────────────────────────────────
const BTP_NORMS_KNOWLEDGE = `
## BASE DE CONNAISSANCES NORMES BTP FRANCE (obligatoire pour chaque matériau)

### CHAUFFAGE / EAU CHAUDE SANITAIRE
- Chauffe-eau électrique : NF EN 60335-2-21, NF C 15-100 (raccordement élec), DTU 60.1 (plomberie)
- Chauffe-eau thermodynamique : NF EN 16147, RE2020 (COP min 2.5), arrêté du 3 mai 2007
- Chaudière gaz : DTU 61.1, NF EN 15420, DTA (Document Technique d'Application), certification NF GAZ
- Pompe à chaleur air/eau : NF EN 14511, RE2020, label RGE QualiPAC obligatoire pour aides
- Plancher chauffant : DTU 65.14 (eau chaude), NF EN 1264, température surface max 29°C
- Radiateur : NF EN 442-1, pression max 4 bars, DTU 65.11 (installation chauffage central)
- Robinet thermostatique : NF EN 215, réglage température par pièce obligatoire depuis 2012

### PLOMBERIE / SANITAIRE
- Tuyaux cuivre : NF EN 1057, DTU 60.1, brasure capillaire ou à sertir selon diamètre
- Tuyaux PER : NF EN ISO 15875, XP P 52-303, température max 70°C usage continu
- Tuyaux multicouche : NF EN ISO 21003, DTU 60.1, rayon de courbure min 5x diamètre
- Robinetterie : NF EN 200 (robinets), marquage CE obligatoire, débit min 0.1 L/s à 1 bar
- Siphon/évacuation : NF EN 1253, pente min 1cm/m obligatoire, DTU 60.11
- Chasse d'eau WC : NF EN 12541, volume chasse 6L standard, 3/6L double commande recommandé
- Raccords à sertir : NF EN 1254-7, outil de sertissage certifié par fabricant obligatoire
- Clapet anti-retour : NF EN 13959, obligatoire sur toute installation eau froide/chaude

### ÉLECTRICITÉ
- Câbles : NF C 32-102 (rigide), NF C 32-201 (souple), section min 1.5mm² éclairage / 2.5mm² prises
- Tableau électrique : NF EN 61439, NF C 15-100, disjoncteur différentiel 30mA obligatoire
- Prises/interrupteurs : NF EN 60669, indice IP selon pièce (IP44 salle de bain min)
- Gaines : NF EN 50086, ICTA obligatoire en neuf, IRL autorisé en rénovation
- Boîtes de dérivation : NF EN 60670, IP2X minimum, étiquetage obligatoire
- Tableau de communication (VDI) : NF C 15-100, NF EN 50173
- Chargeur VE : NF EN 61851, IRVE certifié obligatoire, protection différentielle type B

### ISOLATION
- Laine de verre/roche : Acermi (A+), Euréka, NF EN 13162, épaisseur selon zone climatique (H1/H2/H3)
- Isolation thermique par l'extérieur (ITE) : Avis technique CSTB obligatoire, NF DTU 55.2
- Pare-vapeur : NF EN 13984, Sd min 18m en zone froide, chevauchement 100mm + scotch aluminium
- Isolation combles perdus : RE2020 R≥7 m².K/W minimum, NF EN 13162
- Isolation sous-sol/plancher bas : R≥3 m².K/W RE2020, NF EN 13163 (PSE)
- Enduit isolant : Avis technique CSTB obligatoire, pas de remplacement à isolation classique

### CARRELAGE / REVÊTEMENTS
- Carrelage sol : NF EN 14411, PEI 3 minimum pour usage résidentiel intensif, NF DTU 52.1
- Carrelage mur : NF EN 14411, absorption eau ≤3% pour pièces humides
- Colle carrelage : NF EN 12004, classe C2 minimum pour pièces humides (douche/bain)
- Joint carrelage : NF EN 13888, joint époxy obligatoire douches à l'italienne
- Étanchéité sous carrelage (SPEC) : NF P 84-204, avis technique CSTB, obligatoire douches à l'italienne
- Chape : NF EN 13813, épaisseur min 5cm sur plancher chauffant, NF DTU 26.2

### MENUISERIES / FERMETURES
- Fenêtres PVC/ALU/BOIS : NF EN 14351-1, Uw max 1.3 W/m²K (RE2020), label ACOTHERM recommandé
- Portes d'entrée : NF EN 14351-1, résistance effraction RC2 recommandée, Ud max 1.2 W/m²K
- Volets roulants : NF EN 13659, motorisation NF EN 60335-2-97
- Vitrage : NF EN 1279 (double vitrage), facteur solaire g et Uw sur fiche produit obligatoire
- Garde-corps : NF P 01-012, hauteur min 1m, résistance 0.6 kN/m linéaire
- Escalier : NF P 01-012, giron min 24cm, hauteur max 20cm, main courante obligatoire

### MAÇONNERIE / GROS ŒUVRE
- Béton : NF EN 206, classe C25/30 minimum pour dalle, NF DTU 21
- Parpaing béton : NF EN 771-3, résistance compression selon usage, NF DTU 20.1
- Brique : NF EN 771-1, brique monomur R≥1 selon épaisseur
- Mortier : NF EN 998-2, M5 minimum pour maçonnerie portante
- Enduit façade : NF EN 998-1, NF DTU 26.1, compatibilité support obligatoire

### TOITURE / ÉTANCHÉITÉ
- Tuiles : NF EN 1304, recouvrement min selon pente (DTU 40.21/.22/.23)
- Ardoises : NF EN 12326, NF DTU 40.11, pente min 25° en pose traditionnelle
- Étanchéité toiture terrasse : NF DTU 43.1, Avis technique CSTB pour nouveaux produits
- Membrane EPDM : Avis technique CSTB obligatoire, épaisseur min 1.2mm
- Liteaux : NF B 52-001, section selon espacement et charge de neige zone

### VENTILATION
- VMC simple flux : NF EN 13141-7, NF DTU 68.3, débit réglementaire par pièce (arrêté 24/03/1982)
- VMC double flux : NF EN 308 (échangeur), NF DTU 68.3, rendement thermique >85% RE2020
- Conduit de ventilation : NF EN 13403, pente min 3% pour évacuation condensats
- Bouche VMC : NF EN 13141-2, réglage débit obligatoire, nettoyage annuel conseillé

### PRIX DE RÉFÉRENCE MAGASIN (France, prix TTC 2024-2025)
Chauffage:
- Chauffe-eau élec 150L: LM 280-380€, BD 240-320€, Casto 260-350€
- Chauffe-eau élec 200L: LM 320-450€, BD 280-380€, Casto 300-420€
- Chauffe-eau thermo 200L: LM 900-1400€, BD 750-1100€, Casto 850-1250€
- Chauffe-eau thermo 250L: LM 1100-1600€, BD 950-1300€, Casto 1000-1450€
- PAC air/air (monosplit 2.5kW): LM 600-900€, BD 500-800€, Casto 550-850€

Plomberie:
- Tube cuivre 12/14 (m): LM 4-6€, BD 3.5-5€, PP 3-4.5€
- Tube cuivre 16/18 (m): LM 5-8€, BD 4.5-7€, PP 4-6€
- Tube PER 16 (rouleau 25m): LM 35-50€, BD 28-42€, Casto 32-46€
- Tube multicouche 16 (rouleau 25m): LM 45-65€, BD 38-55€, Casto 42-60€
- Robinet d'arrêt 15/21: LM 8-15€, BD 6-12€, Casto 7-13€
- Mitigeur lavabo: LM 35-120€, BD 28-90€, Casto 30-100€
- Mitigeur douche: LM 45-150€, BD 38-120€, Casto 40-130€
- WC suspendu complet: LM 200-500€, BD 180-450€, Casto 190-470€
- Receveur douche 90x90: LM 80-250€, BD 70-200€, Casto 75-220€

Électricité:
- Câble H07V-U 1.5mm² (100m): LM 25-35€, BD 20-30€, Casto 22-32€
- Câble H07V-U 2.5mm² (100m): LM 38-52€, BD 32-44€, Casto 35-48€
- Tableau 13 modules: LM 35-65€, BD 28-55€, Casto 30-60€
- Disjoncteur différentiel 40A 30mA: LM 35-60€, BD 28-50€, Casto 30-55€
- Prise 2P+T: LM 3-8€, BD 2.5-7€, Casto 2.8-7.5€
- Interrupteur simple: LM 3-10€, BD 2.5-8€, Casto 2.8-9€
- Gaine ICTA 3/4 (100m): LM 18-28€, BD 15-24€, Casto 16-26€

Isolation:
- Laine de verre 100mm (m²): LM 3.5-6€, BD 3-5€, Casto 3.2-5.5€
- Laine de verre 200mm (m²): LM 6-9€, BD 5-8€, Casto 5.5-8.5€
- Pare-vapeur (rouleau 75m²): LM 25-40€, BD 20-35€, Casto 22-38€
- Polystyrène expansé 100mm (m²): LM 5-9€, BD 4-8€, Casto 4.5-8.5€

Carrelage:
- Carrelage sol grès cérame 60x60 (m²): LM 15-60€, BD 12-50€, Casto 13-55€
- Colle carrelage C2 (sac 25kg): LM 12-18€, BD 10-16€, Casto 11-17€
- Joint carrelage (sac 5kg): LM 8-15€, BD 6-12€, Casto 7-13€
- SPEC étanchéité (kit 10m²): LM 35-55€, BD 28-45€, Casto 30-50€

Menuiseries:
- Fenêtre PVC double vitrage 60x120: LM 80-200€, BD 70-180€, Casto 75-190€
- Porte d'entrée PVC: LM 400-1200€, BD 350-1000€, Casto 380-1100€
- Vitrage feuilleté (m²): LM 35-80€ (découpe), spécialiste vitrier

Maçonnerie:
- Parpaing 20x20x50 (unité): LM 1.2-1.8€, BD 1-1.6€, PP 0.9-1.5€
- Sac ciment 35kg: LM 7-10€, BD 6-9€, PP 6-8.5€
- Sac enduit 30kg: LM 8-14€, BD 7-12€, Casto 7.5-13€
`

// ─── LLM Multi-provider (Groq → OpenRouter fallback) ─────────────────────────
interface LLMProvider {
  name: string
  url: string
  apiKey: string
  models: string[]
}

function getProviders(preferredModel: string): LLMProvider[] {
  const providers: LLMProvider[] = []
  if (GROQ_API_KEY) {
    providers.push({
      name: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: GROQ_API_KEY,
      models: preferredModel === 'llama-3.1-8b-instant'
        ? ['llama-3.1-8b-instant']
        : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    })
  }
  if (OPENROUTER_API_KEY) {
    providers.push({
      name: 'OpenRouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: OPENROUTER_API_KEY,
      models: ['meta-llama/llama-3.1-8b-instruct:free'],
    })
  }
  return providers
}

async function callGroq(messages: Array<{ role: string; content: string }>, maxTokens = 1200, preferredModel = 'llama-3.3-70b-versatile') {
  const providers = getProviders(preferredModel)
  if (!providers.length) throw new Error('No LLM provider configured')

  for (const provider of providers) {
    for (const model of provider.models) {
      const maxRetries = 2
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const headers: Record<string, string> = {
            Authorization: `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json',
          }
          // OpenRouter requiert HTTP-Referer
          if (provider.name === 'OpenRouter') {
            headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.fr'
            headers['X-Title'] = 'Fixit Materiaux AI'
          }

          const res = await fetch(provider.url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.15,
              max_tokens: maxTokens,
            }),
          })

          if (res.status === 429) {
            const body = await res.text()
            if (attempt < maxRetries - 1) {
              const waitMatch = body.match(/try again in (\d+\.?\d*)s/i)
              const waitSec = waitMatch ? Math.ceil(parseFloat(waitMatch[1])) + 1 : (attempt + 1) * 5
              console.log(`${provider.name} 429 (${model}) — waiting ${waitSec}s`)
              await new Promise(resolve => setTimeout(resolve, waitSec * 1000))
              continue
            }
            console.log(`${provider.name} 429 (${model}) — trying next model/provider`)
            break
          }
          if (!res.ok) {
            console.error(`${provider.name} error ${res.status} (${model})`)
            break // Try next model/provider
          }
          const data = await res.json()
          const content = data.choices?.[0]?.message?.content || ''
          if (content) return content
        } catch (e) {
          console.error(`${provider.name} fetch error (${model}):`, e)
          break
        }
      }
    }
  }
  throw new Error('All LLM providers failed — rate limited or unavailable')
}

// ─── Domaines e-commerce BTP de confiance ─────────────────────────────────────
const BTP_STORE_DOMAINS = [
  'amazon.fr', 'manomano.fr', 'leroymerlin.fr', 'bricodepot.fr',
  'castorama.fr', 'cdiscount.com', 'toolstation.fr', 'pointp.fr',
  'cedeo.fr', 'bfrenchmaker.com', 'prolians.fr',
]
const REFURB_STORE_DOMAINS = [
  'backmarket.fr', 'drakare.fr', 'stockpro.fr', 'destockage-habitat.com',
]

// ─── Tavily search helper ─────────────────────────────────────────────────────
interface TavilyOptions {
  maxResults?: number
  includeDomains?: string[]
  excludeDomains?: string[]
}

async function searchTavily(
  query: string,
  options: TavilyOptions = {}
): Promise<Array<{ title: string; url: string; content: string }>> {
  if (!TAVILY_API_KEY) return []
  const { maxResults = 5, includeDomains, excludeDomains } = options
  try {
    const payload: Record<string, any> = {
      api_key: TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: maxResults,
    }
    if (includeDomains?.length) payload.include_domains = includeDomains
    if (excludeDomains?.length) payload.exclude_domains = excludeDomains

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error('Tavily error:', res.status, await res.text())
      return []
    }
    const data = await res.json()
    return data.results || []
  } catch (e) {
    console.error('Tavily fetch error:', e)
    return []
  }
}

// ─── Pré-filtrage pertinence Tavily ───────────────────────────────────────────
// Rejette les résultats dont le titre/contenu n'a rien à voir avec la query
function filterRelevantResults(
  results: Array<{ title: string; url: string; content: string }>,
  queryTerms: string[]
): Array<{ title: string; url: string; content: string }> {
  if (!queryTerms.length) return results
  // Au moins 1 mot-clé de la requête doit apparaître dans title OU content
  const keywords = queryTerms
    .map(t => t.toLowerCase())
    .filter(t => t.length > 2) // ignorer mots courts ("de", "le", etc.)
  if (!keywords.length) return results
  return results.filter(r => {
    const haystack = `${r.title} ${r.content}`.toLowerCase()
    return keywords.some(kw => haystack.includes(kw))
  })
}

// ─── Normalisation URL (déduplique les variantes utm, tracking, etc.) ─────────
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    // Supprimer les paramètres de tracking
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'ref', 'tag']
    trackingParams.forEach(p => u.searchParams.delete(p))
    return u.origin + u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '')
  } catch {
    return url
  }
}

// ─── Validation prix aberrants ────────────────────────────────────────────────
function validateProductPrices(products: any[]): any[] {
  if (!products.length) return products
  // Calculer la moyenne des prix > 0
  const pricesWithValue = products.filter(p => typeof p.price === 'number' && p.price > 0)
  if (!pricesWithValue.length) return products

  const avgPrice = pricesWithValue.reduce((sum, p) => sum + p.price, 0) / pricesWithValue.length

  return products.filter(p => {
    if (typeof p.price !== 'number' || p.price === 0) return true // garder les produits sans prix
    // Rejeter si prix < 0.50€ (probablement une erreur de parsing)
    if (p.price < 0.5) {
      console.log(`Prix aberrant rejeté (trop bas): ${p.name} = ${p.price}€`)
      return false
    }
    // Rejeter si prix > 10x la moyenne (probablement un lot/pack ou erreur)
    if (avgPrice > 0 && p.price > avgPrice * 10) {
      console.log(`Prix aberrant rejeté (>10x moyenne ${avgPrice.toFixed(0)}€): ${p.name} = ${p.price}€`)
      return false
    }
    return true
  })
}

// ─── Parse JSON from Groq response (with regex fallback) ─────────────────────
function parseJsonFromText<T>(text: string, fallback: T): T {
  try { return JSON.parse(text) } catch {}
  const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try { return JSON.parse(stripped) } catch {}
  const objMatch = stripped.match(/\{[\s\S]*\}/)
  if (objMatch) { try { return JSON.parse(objMatch[0]) } catch {} }
  const arrMatch = stripped.match(/\[[\s\S]*\]/)
  if (arrMatch) { try { return JSON.parse(arrMatch[0]) } catch {} }
  return fallback
}

// ─── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, city, mode } = body
    const searchMode: 'project' | 'product' = mode === 'product' ? 'product' : 'project'

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query requise' }, { status: 400 })
    }
    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY non configurée', fallback: true })
    }

    // ── Vérifier le cache ──
    const cacheKey = getCacheKey(query, searchMode, city)
    const cached = getFromCache(cacheKey)
    if (cached) {
      console.log(`Cache hit: ${cacheKey}`)
      return NextResponse.json({ ...cached, cached: true })
    }

    // Helper: cache + return
    const cachedResponse = (data: any) => {
      if (data.success && data.materials?.length || data.products?.length) {
        setCache(cacheKey, data)
      }
      return NextResponse.json(data)
    }

    const cityContext = city ? ` à ${city}` : ' en France'
    const usingTavily = Boolean(TAVILY_API_KEY)

    // ══ MODE PRODUIT : Recherche directe de produit avec liens d'achat ══════
    if (searchMode === 'product') {
      if (!usingTavily) {
        // Fallback sans Tavily : Groq génère des recommandations produit depuis sa base de connaissances
        const fallbackPrompt = `Tu es un assistant achat professionnel pour artisans BTP en France.
L'artisan recherche : "${query.trim()}"${cityContext}.

${BTP_NORMS_KNOWLEDGE}

Génère une liste de 3-6 produits recommandés avec prix estimés (prix magasin France 2024-2025).
Pour chaque produit, indique le magasin principal (Leroy Merlin, Brico Dépôt, Castorama, ManoMano, Point P).

Réponds UNIQUEMENT avec un JSON valide, sans markdown :
{
  "products": [
    {
      "name": "Nom du produit avec marque/modèle si pertinent",
      "description": "Caractéristiques clés (puissance, dimensions, normes)",
      "price": 59.90,
      "store": "Leroy Merlin",
      "url": null,
      "image": null,
      "condition": "new"
    }
  ],
  "response": "Synthèse des produits recommandés pour cette recherche",
  "recommendations": "Conseil pro: quel modèle choisir et pourquoi, normes à respecter"
}`
        try {
          const fallbackText = await callGroq([
            { role: 'system', content: fallbackPrompt },
            { role: 'user', content: `Recherche produit : "${query.trim()}"` },
          ], 2000, 'llama-3.1-8b-instant')

          const fallbackParsed = parseJsonFromText<any>(fallbackText, null)
          if (fallbackParsed?.products?.length) {
            return cachedResponse({
              success: true,
              mode: 'product',
              products: fallbackParsed.products.map((p: any) => ({
                name: p.name || 'Produit',
                description: p.description || '',
                price: typeof p.price === 'number' ? p.price : 0,
                store: p.store || '',
                url: null,
                image: null,
                condition: 'new',
              })),
              response: (fallbackParsed.response || `Résultats estimés pour "${query}"`) + '\n\n💡 *Prix indicatifs basés sur les tarifs magasin 2024-2025. Pour des prix en temps réel, visitez directement les sites des enseignes.*',
              recommendations: fallbackParsed.recommendations || '',
              source: 'groq-only',
              fallback: true,
              fetchedAt: new Date().toISOString(),
            })
          }
        } catch (e) {
          console.error('Product fallback error:', e)
        }

        return NextResponse.json({
          success: true,
          mode: 'product',
          products: [],
          response: `Aucun résultat trouvé pour "${query}". Essayez un terme plus précis (ex: "Bosch GWS 7-125" au lieu de "disqueuse").`,
          recommendations: '',
          fallback: true,
        })
      }

      // 3 recherches Tavily en parallèle : neuf ciblées (2) + reconditionné (1)
      const allNewResults: Array<{ title: string; url: string; content: string }> = []
      const allRefurbResults: Array<{ title: string; url: string; content: string }> = []
      const q = query.trim()
      const queryWords = q.split(/\s+/).filter((w: string) => w.length > 2)

      const settled = await Promise.allSettled([
        // Query 1 : produit exact + prix sur sites BTP de confiance
        searchTavily(`${q} prix`, { maxResults: 8, includeDomains: BTP_STORE_DOMAINS }),
        // Query 2 : recherche plus large pour compléter (sans restriction domaine)
        searchTavily(`"${q}" acheter prix €`, { maxResults: 6 }),
        // Query 3 : reconditionné/déstockage sur sites spécialisés
        searchTavily(`${q} reconditionné déstockage occasion`, { maxResults: 6, includeDomains: REFURB_STORE_DOMAINS }),
      ])
      if (settled[0].status === 'fulfilled') allNewResults.push(...settled[0].value)
      if (settled[1].status === 'fulfilled') allNewResults.push(...filterRelevantResults(settled[1].value, queryWords))
      if (settled[2].status === 'fulfilled') allRefurbResults.push(...settled[2].value)

      // Déduplier par URL normalisée (supprime tracking params)
      const seenUrls = new Set<string>()
      const uniqueNew = allNewResults.filter(r => {
        const norm = normalizeUrl(r.url)
        if (seenUrls.has(norm)) return false
        seenUrls.add(norm)
        return true
      })
      const uniqueRefurb = allRefurbResults.filter(r => {
        const norm = normalizeUrl(r.url)
        if (seenUrls.has(norm)) return false
        seenUrls.add(norm)
        return true
      })

      const allUnique = [...uniqueNew, ...uniqueRefurb]
      if (allUnique.length === 0) {
        return NextResponse.json({
          success: true,
          mode: 'product',
          products: [],
          response: `Aucun résultat trouvé pour "${query}". Essayez un terme plus précis (ex: "Bosch GWS 7-125" au lieu de "disqueuse").`,
          recommendations: '',
          fetchedAt: new Date().toISOString(),
        })
      }

      // Formater : marquer la source (neuf/reconditionné) pour Groq
      const newContext = uniqueNew
        .map((r, i) => `[N${i + 1}] "${r.title}" — ${r.content.substring(0, 300)} — URL: ${r.url}`)
        .join('\n\n')
      const refurbContext = uniqueRefurb
        .map((r, i) => `[R${i + 1}] "${r.title}" — ${r.content.substring(0, 300)} — URL: ${r.url}`)
        .join('\n\n')

      const productPrompt = `Tu es un assistant achat professionnel pour artisans BTP en France.

À partir des résultats de recherche ci-dessous, extrais les VRAIS produits avec leurs VRAIS prix et VRAIES URLs.

RÈGLES CRITIQUES DE PRÉCISION DES PRIX:
- N'invente JAMAIS un prix. Extrais le prix EXACT tel qu'il apparaît dans le texte du résultat.
- Si le texte contient "à partir de 59,90 €" → price: 59.90
- Si le texte contient "59,90 €" ou "59.90€" → price: 59.90
- Si un résultat montre une fourchette "de 45 à 89€", prends le prix le PLUS BAS → price: 45
- Si aucun prix n'est clairement visible dans le texte → price: 0 (NE PAS INVENTER)
- Utilise le point comme séparateur décimal (59.90 pas 59,90)

RÈGLES URLs:
- N'invente JAMAIS une URL. Utilise UNIQUEMENT les URLs des résultats fournis.
- Chaque produit DOIT avoir une URL réelle (commence par http)

CLASSIFICATION NEUF / RECONDITIONNÉ-DÉSTOCKAGE:
- Les résultats marqués [N...] sont des produits NEUFS → condition: "new"
- Les résultats marqués [R...] sont des produits RECONDITIONNÉS ou DÉSTOCKÉS → condition: "refurbished"
- Sites reconditionnés/déstockage connus : drakare.fr, backmarket.fr, stockpro.fr, destockage-habitat.com → TOUJOURS condition: "refurbished"
- Si un résultat [N...] contient "reconditionné", "occasion", "remis à neuf", "déstockage", "destockage", "used", "renewed" → condition: "refurbished"
- Si un résultat [R...] semble être un produit neuf sur un site classique (Amazon, LM, etc.) → condition: "new"
- En cas de doute → condition: "new"

AUTRES RÈGLES:
- Retourne entre 3 et 10 produits maximum
- Le champ "store" = nom du site marchand extrait du domaine de l'URL
- amazon.fr → Amazon, manomano.fr → ManoMano, leroymerlin.fr → Leroy Merlin, backmarket.fr → Back Market, drakare.fr → Drakare, stockpro.fr → StockPro, destockage-habitat.com → Destockage Habitat, etc.

Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans backtick:
{
  "products": [
    {
      "name": "Nom exact du produit tel qu'affiché sur le site",
      "description": "Courte description (puissance, dimensions, caractéristiques clés)",
      "price": 59.90,
      "store": "Amazon",
      "url": "https://www.amazon.fr/...",
      "image": null,
      "condition": "new"
    }
  ],
  "response": "Synthèse des résultats trouvés",
  "recommendations": "Conseil pro: quel modèle choisir et pourquoi"
}`

      const searchContext = [
        newContext && `=== PRODUITS NEUFS ===\n${newContext}`,
        refurbContext && `=== PRODUITS RECONDITIONNÉS ===\n${refurbContext}`,
      ].filter(Boolean).join('\n\n')

      const productText = await callGroq([
        { role: 'system', content: productPrompt },
        { role: 'user', content: `Recherche produit: "${q}"${cityContext}\n\nRésultats web:\n${searchContext}` },
      ], 2500)

      const productParsed = parseJsonFromText<any>(productText, null)
      const fetchedAt = new Date().toISOString()

      if (productParsed?.products?.length) {
        // Filtrer les produits avec URLs invalides (hallucinations)
        const rawProducts = productParsed.products
          .filter((p: any) => p.url && typeof p.url === 'string' && p.url.startsWith('http'))
          .map((p: any) => ({
            name: p.name || 'Produit',
            description: p.description || '',
            price: typeof p.price === 'number' ? p.price : 0,
            store: p.store || '',
            url: normalizeUrl(p.url),
            image: p.image || null,
            condition: p.condition === 'refurbished' ? 'refurbished' : 'new',
          }))
        // Rejeter les prix aberrants (< 0.50€ ou > 10x la moyenne)
        const validProducts = validateProductPrices(rawProducts)
        return cachedResponse({
          success: true,
          mode: 'product',
          products: validProducts,
          response: productParsed.response || `Résultats pour "${query}"`,
          recommendations: productParsed.recommendations || '',
          source: 'tavily+groq',
          fetchedAt,
        })
      }

      // Fallback: résultats Tavily bruts
      const refurbDomains = ['backmarket', 'drakare', 'stockpro', 'destockage', 'occasion', 'reconditionn', 'rebuy', 'refurb', 'destock']
      return NextResponse.json({
        success: true,
        mode: 'product',
        products: allUnique.slice(0, 10).map(r => {
          let storeName = r.url
          try { storeName = new URL(r.url).hostname.replace('www.', '').replace('.fr', '').replace('.com', '') } catch {}
          const isRefurb = refurbDomains.some(d => r.url.toLowerCase().includes(d) || r.title.toLowerCase().includes('reconditionn') || r.title.toLowerCase().includes('occasion'))
          return {
            name: r.title,
            description: r.content.substring(0, 150),
            price: 0,
            store: storeName,
            url: r.url,
            image: null,
            condition: isRefurb ? 'refurbished' : 'new',
          }
        }),
        response: `Résultats pour "${query}" — les prix n'ont pas pu être extraits automatiquement.`,
        recommendations: 'Cliquez sur les liens pour vérifier les prix directement sur les sites.',
        source: 'tavily-raw',
        fetchedAt,
      })
    }

    // ══ MODE PROJET : Analyse chantier + matériaux (existant) ═══════════════

    // ── STAGE 1 : Extraction matériaux + normes applicables ───────────────────
    const stage1System = `Tu es un expert BTP français certifié. Tu connais parfaitement toutes les normes (DTU, NF, RE2020, arrêtés) applicables à chaque type de travaux.

${BTP_NORMS_KNOWLEDGE}

Pour le chantier décrit, génère la liste des matériaux ESSENTIELS avec leurs normes obligatoires.

RÈGLES CRITIQUES :
- Liste UNIQUEMENT les matériaux CONSOMMABLES que l'artisan doit ACHETER pour ce chantier précis
- NE PAS extrapoler ni inventer des matériaux non mentionnés ou non directement nécessaires
- NE PAS inclure d'outillage (perceuse, niveau, etc.) sauf si explicitement demandé
- NE PAS inclure de main d'œuvre ou de services
- Maximum 5 matériaux (les plus importants/coûteux uniquement)
- Si le chantier décrit un SEUL produit (ex: "chauffe-eau 200L"), retourne UNIQUEMENT ce produit + ses consommables directs (raccords, fixations)
- Sois PRÉCIS sur les dimensions/capacités/modèles mentionnés dans la requête

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ou après, sans markdown, sans backtick.
Format strict (respecte exactement les noms de champs) :
[
  {
    "name": "Chauffe-eau thermodynamique 200L classe A+",
    "qty": 1,
    "unit": "unité",
    "category": "Chauffage",
    "norms": ["NF EN 16147", "RE2020", "DTU 60.1"],
    "normDetails": "COP minimum 2.5 requis RE2020. Raccordement électrique NF C 15-100. Distance mini 0.5m de toute paroi. Soupape de sécurité obligatoire."
  }
]
Chaque matériau DOIT avoir au moins 1 norme et des normDetails précis sur les contraintes de pose/installation.`

    const stage1Text = await callGroq([
      { role: 'system', content: stage1System },
      { role: 'user', content: `Chantier : ${query.trim()}${cityContext}` },
    ], 1000, 'llama-3.1-8b-instant')

    const rawMaterials: Array<{ name: string; qty: number; unit: string; category: string; norms: string[]; normDetails: string }> =
      parseJsonFromText(stage1Text, [])

    if (!rawMaterials.length) {
      return NextResponse.json({
        success: true,
        materials: [],
        totalEstimate: null,
        response: "Je n'ai pas réussi à analyser ce chantier. Pouvez-vous décrire plus précisément l'intervention ? Exemple : \"remplacement chauffe-eau thermodynamique 200L\" ou \"pose carrelage sol 20m² format 60x60\".",
        recommendations: '',
        fallback: false,
      })
    }

    // ── STAGE 2 : Recherche prix Tavily (si disponible) ───────────────────────
    let searchBundle = ''
    if (usingTavily) {
      const searchResults = await Promise.allSettled(
        rawMaterials.map(async (m) => {
          const searchQ = `${m.name} prix magasin France 2025`
          const results = await searchTavily(searchQ, {
            maxResults: 5,
            includeDomains: BTP_STORE_DOMAINS,
          })
          return { material: m, results }
        })
      )

      searchBundle = searchResults
        .map((r, i) => {
          if (r.status !== 'fulfilled') return `Matériau ${i + 1}: aucun résultat`
          const { material, results } = r.value
          const snippets = results
            .map(res => `  - [${res.title}] ${res.content.substring(0, 250)} (${res.url})`)
            .join('\n')
          return `Matériau ${i + 1}: ${material.name} (${material.qty} ${material.unit})\n${snippets || '  Aucun résultat web trouvé'}`
        })
        .join('\n\n---\n\n')
    }

    // ── STAGE 3 : Analyse prix + génération réponse finale ────────────────────
    const priceSystem = `Tu es un expert acheteur BTP en France. Tu connais précisément les prix en rayon de Leroy Merlin (LM), Brico Dépôt (BD), Castorama (Casto), Point P (PP) et Cédéo.

${BTP_NORMS_KNOWLEDGE}

${usingTavily ? 'Des résultats de recherche web sont fournis. Utilise les prix trouvés en priorité. Si insuffisants, complète avec ta connaissance des prix magasin.' : 'Utilise ta connaissance précise des prix magasin France 2024-2025 de la base ci-dessus.'}

IMPORTANT: Retourne UNIQUEMENT un objet JSON valide, sans markdown, sans backtick, sans texte avant ou après.
Structure OBLIGATOIRE:
{
  "materials": [
    {
      "name": "nom exact du matériau avec référence/modèle si possible",
      "qty": 1,
      "unit": "unité",
      "category": "catégorie",
      "norms": ["DTU XX.X", "NF EN XXXXX"],
      "normDetails": "Points de vigilance pour la pose et conformité réglementaire",
      "prices": [
        {"store": "Leroy Merlin", "price": 699, "url": "https://www.leroymerlin.fr/produit-exemple"},
        {"store": "Brico Dépôt", "price": 549, "url": "https://www.bricodepot.fr/produit-exemple"},
        {"store": "Castorama", "price": 629, "url": "https://www.castorama.fr/produit-exemple"}
      ],
      "bestPrice": {"store": "Brico Dépôt", "price": 549},
      "avgPrice": 625
    }
  ],
  "totalEstimate": {"min": 850, "max": 1200},
  "response": "Synthèse **en gras pour les points importants**, avec les normes clés à respecter",
  "recommendations": "Conseils pratiques : où acheter, quand commander, alertes normes critiques"
}
RÈGLES ABSOLUES:
- prix = nombre entier en euros TTC (JAMAIS de symbole €)
- toujours 2 à 4 enseignes par matériau
- bestPrice = enseigne avec le prix le plus bas dans prices
- avgPrice = moyenne arrondie des prices
- les prix doivent être cohérents avec les fourchettes de la base de connaissances ci-dessus
- normDetails = contraintes concrètes de pose (distances, sections, pentes, épaisseurs)
- Si des URLs de produits sont disponibles dans les résultats de recherche web, inclus-les dans le champ "url". Sinon mets null.`

    const priceUserContent = usingTavily
      ? `Chantier: "${query}"${cityContext}\nMatériaux identifiés: ${JSON.stringify(rawMaterials)}\n\nRésultats recherche web:\n${searchBundle}`
      : `Chantier: "${query}"${cityContext}\nMatériaux identifiés: ${JSON.stringify(rawMaterials)}`

    const priceText = await callGroq([
      { role: 'system', content: priceSystem },
      { role: 'user', content: priceUserContent },
    ], 2500)

    const parsed = parseJsonFromText<any>(priceText, null)

    if (parsed?.materials?.length) {
      return cachedResponse({
        success: true,
        materials: parsed.materials,
        totalEstimate: parsed.totalEstimate || null,
        response: parsed.response || `Voici les matériaux et prix pour : **${query}**`,
        recommendations: parsed.recommendations || '',
        fallback: !usingTavily,
        source: usingTavily ? 'tavily+groq' : 'groq-only',
      })
    }

    // Dernier recours — retourner au moins la liste sans prix
    return NextResponse.json({
      success: true,
      materials: rawMaterials.map(m => ({
        ...m,
        prices: [],
        bestPrice: null,
        avgPrice: 0,
      })),
      totalEstimate: null,
      response: `J'ai identifié **${rawMaterials.length} matériaux** pour votre chantier "${query}", mais je n'ai pas pu récupérer les prix cette fois. Réessayez dans quelques instants.`,
      recommendations: '',
      fallback: true,
      source: 'groq-list-only',
    })

  } catch (error: any) {
    console.error('Materiaux AI error:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur', fallback: true }, { status: 500 })
  }
}
