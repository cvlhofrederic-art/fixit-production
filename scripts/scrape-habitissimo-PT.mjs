/**
 * scrape-habitissimo-PT.mjs
 *
 * Scrape Habitissimo Portugal pour tous les services × villes VITFIX PT.
 * Extrait les profils LocalBusiness depuis les données JSON-LD de chaque page listing.
 *
 * Usage :
 *   node scripts/scrape-habitissimo-PT.mjs
 *   node scripts/scrape-habitissimo-PT.mjs eletricista         → un seul service
 *   node scripts/scrape-habitissimo-PT.mjs - marco-de-canaveses → une seule ville
 *
 * Output : data/artisans-PT-habitissimo-raw.json
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_FILE = path.join(__dirname, '../data/artisans-PT-habitissimo-raw.json')

// ── Délai pour ne pas hammer le serveur ──────────────────────────────────────
const DELAY_MS = 1200

// ── Mapping Vitfix service slug → Habitissimo category slug ─────────────────
const SERVICE_MAP = {
  'eletricista':       'instalacao-eletrica',
  'canalizador':       'canalizacao',
  'pintor':            'pintura',
  'pladur':            'pladur',
  'obras-remodelacao': 'remodelacoes',
  'isolamento-termico':'isolamento-termico',
  'impermeabilizacao': 'impermeabilizacao',
  'desentupimento':    'desentupimentos',
  'serralheiro':       'serralharia',
  'telhador':          'telhados',
  'vidraceiro':        'vidros',
  'azulejador':        'ladrilhamento',
  'pedreiro':          'alvenaria',
  'ar-condicionado':   'climatizacao-e-ar-condicionado',
  'carpinteiro':       'carpintaria',
  'faz-tudo':          'remodelacoes',  // fallback
}

// ── Villes VITFIX PT avec leur distrito Habitissimo ─────────────────────────
const CITIES = [
  // Priorité 1 — Tâmega e Sousa
  { slug: 'marco-de-canaveses', name: 'Marco de Canaveses', distrito: 'porto' },
  { slug: 'penafiel',           name: 'Penafiel',           distrito: 'porto' },
  { slug: 'amarante',           name: 'Amarante',           distrito: 'porto' },
  { slug: 'baiao',              name: 'Baião',              distrito: 'porto' },
  { slug: 'felgueiras',         name: 'Felgueiras',         distrito: 'porto' },
  { slug: 'lousada',            name: 'Lousada',            distrito: 'porto' },
  { slug: 'pacos-de-ferreira',  name: 'Paços de Ferreira',  distrito: 'porto' },
  { slug: 'paredes',            name: 'Paredes',            distrito: 'porto' },
  // Priorité 2 — AMP
  { slug: 'porto',              name: 'Porto',              distrito: 'porto' },
  { slug: 'vila-nova-de-gaia',  name: 'Vila Nova de Gaia',  distrito: 'porto' },
  { slug: 'maia',               name: 'Maia',               distrito: 'porto' },
  { slug: 'braga',              name: 'Braga',              distrito: 'braga' },
]

// ── Règles d'exclusion (jamais importer) ────────────────────────────────────
const EXCLUSION_KEYWORDS = [
  'materiais', 'armazém', 'depósito', 'loja', 'store', 'shop',
  'comércio', 'distribuição', 'grossista', 'revendedor',
  'leroy', 'merlin', 'aki', 'bricomarché', 'maxmat', 'castorama',
  'arquitecto', 'engenheiro civil', 'imobiliária', 'formação', 'escola',
]

function isExcluded(name) {
  const lower = name.toLowerCase()
  return EXCLUSION_KEYWORDS.some(kw => lower.includes(kw))
}

// ── Extraction JSON-LD depuis HTML ──────────────────────────────────────────
function extractProfilesFromHTML(html, cityName, vitfixServiceSlug) {
  const profiles = []
  const jsonLdRegex = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let match

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1])
      if (data['@type'] === 'LocalBusiness' && data.name && data.url) {
        if (!isExcluded(data.name)) {
          profiles.push({
            company_name: data.name,
            profile_url: data.url,
            city: cityName,
            country: 'PT',
            language: 'pt',
            categories: [vitfixServiceSlug],
            source_name: 'habitissimo',
            source_url: data.url,
            active: false,
            verified: false,
            rating_avg: null,
            rating_count: 0,
            phone: null,
            email: null,
            company_address: null,
            bio: null,
          })
        }
      }
    } catch (e) {
      // JSON parse error — skip
    }
  }

  return profiles
}

// ── Fetch avec retry ─────────────────────────────────────────────────────────
async function fetchWithRetry(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-PT,pt;q=0.9',
        },
      })
      if (res.ok) return await res.text()
      if (res.status === 404) return null  // page doesn't exist for this combo
      throw new Error(`HTTP ${res.status}`)
    } catch (e) {
      if (attempt === retries) {
        console.error(`  ✗ Échec après ${retries + 1} tentatives : ${url} — ${e.message}`)
        return null
      }
      await sleep(2000)
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Score de qualité (selon les règles du prompt) ────────────────────────────
function scoreProfile(profile) {
  let score = 0
  if (profile.phone) score++
  if (profile.company_address) score++
  if (profile.rating_count > 0) score++
  if (profile.bio && profile.bio.length > 50) score++
  if (profile.email || profile.website) score++
  return score
}

// ── Déduplication ────────────────────────────────────────────────────────────
function deduplicate(profiles) {
  const seen = new Set()
  return profiles.filter(p => {
    const key = p.profile_url  // profile URL est unique par professionnel
    if (seen.has(key)) {
      // Merge categories si même profil dans plusieurs villes/services
      return false
    }
    seen.add(key)
    return true
  })
}

// Merge versions : si même profile_url apparaît pour plusieurs services/villes,
// on combine les categories et garde le meilleur record
function mergeProfiles(profiles) {
  const map = new Map()
  for (const p of profiles) {
    if (!map.has(p.profile_url)) {
      map.set(p.profile_url, { ...p })
    } else {
      const existing = map.get(p.profile_url)
      // Merge categories
      const cats = new Set([...existing.categories, ...p.categories])
      existing.categories = [...cats]
      // Keep best city (first occurrence)
    }
  }
  return [...map.values()]
}

// ── Script principal ─────────────────────────────────────────────────────────
async function main() {
  const argService = process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : null
  const argCity = process.argv[3] ? process.argv[3] : null

  const services = argService
    ? Object.entries(SERVICE_MAP).filter(([k]) => k === argService)
    : Object.entries(SERVICE_MAP)

  const cities = argCity
    ? CITIES.filter(c => c.slug === argCity)
    : CITIES

  console.log(`\n🇵🇹 Scraping Habitissimo PT — ${services.length} services × ${cities.length} villes`)
  console.log(`   Total combinaisons : ${services.length * cities.length}\n`)

  const allProfiles = []
  let total = 0
  let rejected = 0
  let notFound = 0
  const stats = {}

  for (const [vitfixSlug, habitissimoSlug] of services) {
    stats[vitfixSlug] = {}

    for (const city of cities) {
      const url = `https://www.habitissimo.pt/empresas/${habitissimoSlug}/${city.distrito}/${city.slug}`
      process.stdout.write(`  [${vitfixSlug}] ${city.name} ... `)

      const html = await fetchWithRetry(url)

      if (!html) {
        process.stdout.write('(not found)\n')
        notFound++
        stats[vitfixSlug][city.slug] = 0
        await sleep(DELAY_MS)
        continue
      }

      const profiles = extractProfilesFromHTML(html, city.name, vitfixSlug)
      const rejectedCount = 0  // exclusions already applied in extractProfilesFromHTML

      allProfiles.push(...profiles)
      total += profiles.length
      stats[vitfixSlug][city.slug] = profiles.length
      process.stdout.write(`${profiles.length} profils\n`)

      await sleep(DELAY_MS)
    }
  }

  console.log(`\n📊 Avant déduplication : ${allProfiles.length} entrées`)

  // Merge duplicates (même profil, plusieurs villes/services)
  const merged = mergeProfiles(allProfiles)
  console.log(`📊 Après merge : ${merged.length} profils uniques`)

  // Score tous les profils
  const scored = merged.map(p => ({ ...p, _score: scoreProfile(p) }))
  const toImport = scored.filter(p => p._score >= 4)
  const toReview = scored.filter(p => p._score >= 2 && p._score < 4)
  const autoReject = scored.filter(p => p._score < 2)

  console.log(`   → Score ≥ 4 (import direct) : ${toImport.length}`)
  console.log(`   → Score 2-3 (révision)      : ${toReview.length}`)
  console.log(`   → Score < 2 (rejeté auto)   : ${autoReject.length}`)
  console.log(`   → Pages not found           : ${notFound}`)

  // Préparer output directory
  const dataDir = path.join(__dirname, '../data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

  // Écrire le fichier de données brutes
  const output = {
    scraped_at: new Date().toISOString(),
    source: 'habitissimo.pt',
    total_raw: allProfiles.length,
    total_unique: merged.length,
    to_import: toImport.length,
    to_review: toReview.length,
    auto_rejected: autoReject.length,
    stats_by_service_city: stats,
    profiles: scored,
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8')
  console.log(`\n✅ Données sauvegardées → ${OUTPUT_FILE}`)
  console.log(`   Prochaine étape : node scripts/import-artisans-PT-habitissimo.mjs\n`)
}

main().catch(err => {
  console.error('Erreur fatale :', err)
  process.exit(1)
})
