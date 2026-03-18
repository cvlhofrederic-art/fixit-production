/**
 * filter-verify-artisans-PT.mjs
 *
 * 1. Charge artisans-PT-gmaps-raw.json
 * 2. Filtre les non-artisans (fournisseurs, fabricants, architectes, etc.)
 * 3. Valide que google_category correspond à la catégorie Vitfix assignée
 * 4. Vérifie l'activité de chaque profil (signaux + ping habitissimo si dispo)
 * 5. Produit artisans-PT-filtered.json prêt à importer
 *
 * Usage :
 *   node scripts/filter-verify-artisans-PT.mjs
 *   node scripts/filter-verify-artisans-PT.mjs --dry-run   (stats only)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GMAPS_FILE     = path.join(__dirname, '../data/artisans-PT-gmaps-raw.json')
const HABITISSIMO_FILE = path.join(__dirname, '../data/artisans-PT-enriched.json')
const OUTPUT_FILE    = path.join(__dirname, '../data/artisans-PT-filtered.json')
const DRY_RUN = process.argv.includes('--dry-run')

// ── Catégories Google Maps NON-artisans à rejeter ──────────────────────────
const REJECT_GCATEGORY_KEYWORDS = [
  'fornecedor', 'fabricante', 'loja ', 'armazem', 'armazém',
  'grossista', 'distribuidor', 'revendedor',
  'material', 'materiais',
  'equipamento', 'maquinaria',
  'arquiteto', 'arquitecto', 'arquitectura', 'arquitetura',
  'engenheiro', 'engenharia',
  'imobiliária', 'mediação',
  'escola', 'universidade', 'formação',
  'restaurante', 'café', 'hotel', 'alojamento',
  'automóvel', 'mecânica', 'pneus',
  'limpeza doméstica', 'limpeza de tapetes',
  'lavandaria',
]

// ── Catégories Google Maps VALIDES pour chaque slug Vitfix ─────────────────
const VALID_GCATEGORY_FOR_SLUG = {
  'eletricista':         ['eletric', 'electricist', 'instalação elétric', 'instalacao eletric'],
  'canalizador':         ['canalizador', 'canalização', 'saneamento', 'desentupidor', 'impermeabiliz'],
  'pintor':              ['pintor', 'pintura', 'revestimento', 'decoração'],
  'pladur':              ['pladur', 'gesso', 'divisória', 'drywall'],
  'obras-remodelacao':   ['constru', 'remodelad', 'empreiteiro', 'obras', 'renovaç'],
  'isolamento-termico':  ['isolamento', 'isola', 'alumínio', 'janela', 'caixilharia'],
  'impermeabilizacao':   ['impermeabiliz', 'impermeab'],
  'desentupimento':      ['desentupidor', 'desentupimento', 'saneamento', 'canalizador'],
  'serralheiro':         ['serralheiro', 'serralharia', 'metalúrgica', 'ferro', 'alumínio'],
  'telhador':            ['telhad', 'cobertura', 'telha'],
  'vidraceiro':          ['vidraçaria', 'vidraceiro', 'vidro', 'espelho'],
  'azulejador':          ['azulej', 'cerâmica', 'ladrilh', 'revestimento'],
  'pedreiro':            ['pedreiro', 'construç', 'civil', 'empreiteiro', 'betão'],
  'ar-condicionado':     ['ar condicionado', 'climatização', 'avac', 'hvac', 'refrigeraç'],
  'carpinteiro':         ['carpinteiro', 'carpintaria', 'madeira', 'móvel', 'marceneiro'],
  'faz-tudo':            ['reparaç', 'faz-tudo', 'bricolagem', 'manutenção'],
}

// ── Noms d'artisans à rejeter (non-artisans connus) ───────────────────────
const REJECT_NAME_KEYWORDS = [
  'leroy merlin', 'aki ', 'bricomarché', 'maxmat', 'castorama',
  'fnac', 'worten', 'mediamarkt',
  'imobiliária', 'mediação imobiliária',
  'banco ', 'seguros', 'advogado',
  'agência de viagens',
  'associação', 'cooperativa',
]

function isRejectedByGCategory(googleCat) {
  if (!googleCat) return false
  const lower = googleCat.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return REJECT_GCATEGORY_KEYWORDS.some(kw =>
    lower.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  )
}

function isRejectedByName(name) {
  if (!name) return false
  const lower = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return REJECT_NAME_KEYWORDS.some(kw =>
    lower.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  )
}

// Vérifie si google_category est compatible avec la catégorie Vitfix
function isCategoryMismatch(profile) {
  const slug = profile.categories?.[0]
  const gcatRaw = profile.google_category || ''
  const gcat = gcatRaw.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const validKeywords = VALID_GCATEGORY_FOR_SLUG[slug]
  if (!validKeywords) return false // slug inconnu → on garde
  if (!gcat) return false // pas de google_category → on garde (habitissimo)

  return !validKeywords.some(kw =>
    gcat.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  )
}

// Score d'activité et qualité
function scoreActivity(profile) {
  let score = 0
  const gcatLower = (profile.google_category || '').toLowerCase()

  // Signaux positifs
  if (profile.phone) score += 2           // numéro de téléphone = fort signal
  if (profile.rating_count > 10) score += 2   // beaucoup d'avis
  else if (profile.rating_count > 0) score += 1
  if (profile.rating_avg >= 4) score += 1
  if (profile.company_address) score += 1
  if (profile.website) score += 1

  // Signal "ouvert" dans google_category (ex: "CanalizadorAberto 24 horas")
  if (gcatLower.includes('aberto') || gcatLower.includes('fecha')) score += 2
  if (gcatLower.includes('24 horas') || gcatLower.includes('24h')) score += 1

  // Bio / description
  if (profile.bio && profile.bio.length > 50) score += 1

  return score
}

// Détermine si le profil est probablement encore actif
function isLikelyActive(profile) {
  const gcatLower = (profile.google_category || '').toLowerCase()

  // Signaux négatifs d'inactivité
  if (gcatLower.includes('fechado permanentemente')) return false
  if (gcatLower.includes('encerrado')) return false

  // Score minimum pour être considéré actif
  return scoreActivity(profile) >= 2
}

// Normalise le google_category en retirant les horaires collés
function normalizeGCategory(gcatRaw) {
  if (!gcatRaw) return gcatRaw
  // Ex: "CanalizadorAberto 24 horas" → "Canalizador"
  // Ex: "ElectricistaAberto ⋅ Fecha às 18:00" → "Electricista"
  return gcatRaw
    .replace(/Aberto[\s\S]*/i, '')
    .replace(/Fecha[\s\S]*/i, '')
    .replace(/Abertos[\s\S]*/i, '')
    .trim()
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔍 Filter & Verify — Artisans PT\n')

  // Charge les données
  const gmapsRaw = JSON.parse(fs.readFileSync(GMAPS_FILE, 'utf8'))
  const gmapsProfiles = gmapsRaw.profiles || []
  console.log(`📦 Google Maps : ${gmapsProfiles.length} profils`)

  let habitissimoProfiles = []
  if (fs.existsSync(HABITISSIMO_FILE)) {
    const habRaw = JSON.parse(fs.readFileSync(HABITISSIMO_FILE, 'utf8'))
    habitissimoProfiles = habRaw.profiles || []
    console.log(`📦 Habitissimo  : ${habitissimoProfiles.length} profils`)
  }

  const allProfiles = [...gmapsProfiles, ...habitissimoProfiles]
  console.log(`📦 Total combiné: ${allProfiles.length} profils\n`)

  // ── Filtrage ──────────────────────────────────────────────────────────
  const results = {
    kept: [],
    rejected_gcategory: [],
    rejected_name: [],
    rejected_mismatch: [],
    rejected_inactive: [],
    rejected_nodata: [],
  }

  for (const p of allProfiles) {
    const gcatNorm = normalizeGCategory(p.google_category)
    const profileNorm = { ...p, google_category: gcatNorm }

    // 1. Rejet par google_category (vendeurs, fabricants, etc.)
    if (isRejectedByGCategory(gcatNorm)) {
      results.rejected_gcategory.push({ name: p.company_name, gcategory: gcatNorm, categories: p.categories })
      continue
    }

    // 2. Rejet par nom
    if (isRejectedByName(p.company_name)) {
      results.rejected_name.push({ name: p.company_name, categories: p.categories })
      continue
    }

    // 3. Rejet mismatch catégorie (serralheiro mappé comme architecte, etc.)
    if (isCategoryMismatch(profileNorm)) {
      results.rejected_mismatch.push({ name: p.company_name, gcategory: gcatNorm, categories: p.categories })
      continue
    }

    // 4. Rejet si probablement inactif
    if (!isLikelyActive(profileNorm)) {
      results.rejected_inactive.push({ name: p.company_name, gcategory: gcatNorm, score: scoreActivity(profileNorm) })
      continue
    }

    // 5. Rejet si aucune donnée utile (pas de téléphone, pas d'adresse, pas d'avis, score 0)
    if (!p.phone && !p.company_address && !p.rating_count && !p.bio) {
      results.rejected_nodata.push({ name: p.company_name, categories: p.categories })
      continue
    }

    // ── Profil valide ──
    results.kept.push({
      ...profileNorm,
      active: true,
      _activity_score: scoreActivity(profileNorm),
    })
  }

  // ── Déduplication (name + city, garde le meilleur) ────────────────────
  const deduped = new Map()
  for (const p of results.kept) {
    const key = `${p.company_name.toLowerCase().trim()}|${(p.city || '').toLowerCase()}`
    if (!deduped.has(key)) {
      deduped.set(key, { ...p })
    } else {
      const existing = deduped.get(key)
      // Merge catégories
      const cats = new Set([...existing.categories, ...p.categories])
      existing.categories = [...cats]
      // Garde meilleures données
      if (!existing.phone && p.phone) existing.phone = p.phone
      if (!existing.company_address && p.company_address) existing.company_address = p.company_address
      if (!existing.bio && p.bio) existing.bio = p.bio
      if ((p.rating_count || 0) > (existing.rating_count || 0)) {
        existing.rating_avg = p.rating_avg
        existing.rating_count = p.rating_count
      }
      existing._activity_score = Math.max(existing._activity_score, p._activity_score)
    }
  }
  const unique = [...deduped.values()].sort((a, b) => b._activity_score - a._activity_score)

  // ── Stats ─────────────────────────────────────────────────────────────
  console.log('📊 Résultats du filtrage :')
  console.log(`   ✅ Gardés (après dédup)        : ${unique.length}`)
  console.log(`   ❌ Rejetés vendeurs/fabricants  : ${results.rejected_gcategory.length}`)
  console.log(`   ❌ Rejetés par nom              : ${results.rejected_name.length}`)
  console.log(`   ❌ Rejetés catégorie mismatch   : ${results.rejected_mismatch.length}`)
  console.log(`   ❌ Rejetés inactifs             : ${results.rejected_inactive.length}`)
  console.log(`   ❌ Rejetés sans données         : ${results.rejected_nodata.length}`)

  // Stats par catégorie
  const byCat = {}
  for (const p of unique) {
    for (const cat of (p.categories || [])) {
      byCat[cat] = (byCat[cat] || 0) + 1
    }
  }
  console.log('\n📋 Par catégorie :')
  for (const [cat, count] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(count).padStart(3)}  ${cat}`)
  }

  // Stats par ville
  const byCity = {}
  for (const p of unique) {
    byCity[p.city || '?'] = (byCity[p.city || '?'] || 0) + 1
  }
  console.log('\n🏙️  Par ville :')
  for (const [city, count] of Object.entries(byCity).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(count).padStart(3)}  ${city}`)
  }

  // Distribution des scores d'activité
  const scoreDist = {}
  for (const p of unique) {
    const s = p._activity_score
    scoreDist[s] = (scoreDist[s] || 0) + 1
  }
  console.log('\n⚡ Distribution score d\'activité :')
  for (const [score, count] of Object.entries(scoreDist).sort((a, b) => Number(b[0]) - Number(a[0]))) {
    const bar = '█'.repeat(Math.min(count, 40))
    console.log(`   Score ${score}: ${String(count).padStart(3)}  ${bar}`)
  }

  // Exemples de rejets
  if (results.rejected_gcategory.length > 0) {
    console.log('\n🗑️  Exemples rejetés (fournisseurs/fabricants) :')
    results.rejected_gcategory.slice(0, 10).forEach(r =>
      console.log(`   [${r.gcategory}] ${r.name} → ${r.categories?.join(', ')}`)
    )
  }

  if (results.rejected_mismatch.length > 0) {
    console.log('\n🗑️  Exemples rejetés (mismatch catégorie) :')
    results.rejected_mismatch.slice(0, 10).forEach(r =>
      console.log(`   [${r.gcategory}] ${r.name} → assigné à ${r.categories?.join(', ')}`)
    )
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN — fichier non écrit]\n')
    return
  }

  // ── Écriture ──────────────────────────────────────────────────────────
  const output = {
    filtered_at: new Date().toISOString(),
    sources: ['google_maps', 'habitissimo'],
    total_input: allProfiles.length,
    total_kept: unique.length,
    total_rejected: allProfiles.length - unique.length,
    rejection_breakdown: {
      gcategory_vendor: results.rejected_gcategory.length,
      name_vendor: results.rejected_name.length,
      category_mismatch: results.rejected_mismatch.length,
      likely_inactive: results.rejected_inactive.length,
      no_data: results.rejected_nodata.length,
    },
    profiles: unique,
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8')
  console.log(`\n✅ Données filtrées → ${OUTPUT_FILE}`)
  console.log(`   Prochaine étape : node scripts/import-artisans-PT-filtered.mjs\n`)
}

main().catch(err => {
  console.error('Erreur fatale :', err)
  process.exit(1)
})
