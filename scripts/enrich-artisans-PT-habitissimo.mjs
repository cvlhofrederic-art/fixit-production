/**
 * enrich-artisans-PT-habitissimo.mjs
 *
 * Visite chaque profil Habitissimo et extrait : bio, adresse, expérience, rating, website.
 * Relit data/artisans-PT-habitissimo-raw.json et écrit data/artisans-PT-enriched.json
 *
 * Usage :
 *   node scripts/enrich-artisans-PT-habitissimo.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INPUT_FILE  = path.join(__dirname, '../data/artisans-PT-habitissimo-raw.json')
const OUTPUT_FILE = path.join(__dirname, '../data/artisans-PT-enriched.json')

const DELAY_MS = 800

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Extraction des données depuis la page profil ─────────────────────────────
function extractProfileData(html, profile) {
  // Bio / description
  const bioMatch = html.match(/Informação sobre [^<]+<\/[^>]+>\s*<[^>]+>([\s\S]{30,800}?)<\//)
  let bio = null
  if (bioMatch) {
    bio = bioMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 500)
  }

  // Adresse (code postal format PT: XXXX-XXX)
  const addrMatch = html.match(/((?:Rua|Av\.|Avenida|Largo|Praça|Travessa|Estrada|Beco|Caminho|Alameda)[^<"]{5,80}?(?:\d{4}-\d{3}[^<"]{0,40})?)/)
  const zipMatch = html.match(/\b(\d{4}-\d{3})\b/)
  let company_address = addrMatch ? addrMatch[1].replace(/\s+/g, ' ').trim() : null
  if (!company_address && zipMatch) company_address = zipMatch[1]

  // Expérience
  const expMatch = html.match(/(\d+)\s+anos?\s+de\s+experiên/i)
  const experience_years = expMatch ? parseInt(expMatch[1]) : null

  // Rating (ex: "4.8 de 5")
  const ratingValMatch = html.match(/"ratingValue"\s*:\s*"?([\d.]+)"?/)
  const ratingCountMatch = html.match(/"reviewCount"\s*:\s*"?(\d+)"?/)
  const rating_avg = ratingValMatch ? parseFloat(ratingValMatch[1]) : null
  const rating_count = ratingCountMatch ? parseInt(ratingCountMatch[1]) : 0

  // Website externe
  const websiteMatch = html.match(/href="(https?:\/\/(?!www\.habitissimo)[^"]{5,80})"[^>]*>(?:Site|Website|www\.|http)/i)
  const website = websiteMatch ? websiteMatch[1] : null

  // Spécialités (liste de services)
  const specsMatches = [...html.matchAll(/<li[^>]*>\s*<span[^>]*>([^<]{5,60})<\/span>\s*<\/li>/g)]
  const specialites = specsMatches.map(m => m[1].trim()).filter(s => s.length > 3).slice(0, 10)

  return { bio, company_address, experience_years, rating_avg, rating_count, website, specialites }
}

// ── Score de qualité ─────────────────────────────────────────────────────────
function scoreProfile(p) {
  let score = 0
  if (p.phone) score++
  if (p.company_address) score++
  if (p.rating_count > 0) score++
  if (p.bio && p.bio.length > 50) score++
  if (p.email || p.website) score++
  return score
}

// ── Fetch avec retry ─────────────────────────────────────────────────────────
async function fetchProfile(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'pt-PT,pt;q=0.9',
        },
      })
      if (res.ok) return await res.text()
      return null
    } catch (e) {
      if (attempt === retries) return null
      await sleep(1500)
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Fichier introuvable : ${INPUT_FILE}`)
    console.error('   Exécuter d\'abord : node scripts/scrape-habitissimo-PT.mjs')
    process.exit(1)
  }

  const raw = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'))
  const profiles = raw.profiles

  console.log(`\n🔍 Enrichissement de ${profiles.length} profils Habitissimo PT`)
  console.log('   Extraction : bio, adresse, expérience, rating, website\n')

  const enriched = []
  let enrichCount = 0

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i]
    process.stdout.write(`  [${i + 1}/${profiles.length}] ${p.company_name.slice(0, 40).padEnd(40)} `)

    const html = await fetchProfile(p.profile_url)

    if (!html) {
      process.stdout.write('(erreur)\n')
      enriched.push({ ...p, _score: scoreProfile(p) })
      await sleep(DELAY_MS)
      continue
    }

    const extracted = extractProfileData(html, p)

    const enrichedProfile = {
      ...p,
      bio: extracted.bio || p.bio,
      company_address: extracted.company_address || p.company_address,
      experience_years: extracted.experience_years || p.experience_years,
      rating_avg: extracted.rating_avg,
      rating_count: extracted.rating_count,
      website: extracted.website,
      specialites: extracted.specialites,
    }
    enrichedProfile._score = scoreProfile(enrichedProfile)

    if (extracted.bio || extracted.company_address) {
      enrichCount++
      process.stdout.write(`score:${enrichedProfile._score} ✓\n`)
    } else {
      process.stdout.write(`score:${enrichedProfile._score}\n`)
    }

    enriched.push(enrichedProfile)
    await sleep(DELAY_MS)

    // Sauvegarde intermédiaire toutes les 20 entrées
    if ((i + 1) % 20 === 0) {
      const tmpOutput = {
        ...raw,
        profiles: enriched,
        enriched_at: new Date().toISOString(),
        enriched_count: enrichCount,
      }
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(tmpOutput, null, 2), 'utf8')
      process.stdout.write(`\n  💾 Sauvegarde intermédiaire (${enriched.length} profils)\n\n`)
    }
  }

  // Stats finales
  const toImport  = enriched.filter(p => p._score >= 4)
  const toReview  = enriched.filter(p => p._score >= 2 && p._score < 4)
  const autoReject = enriched.filter(p => p._score < 2)

  console.log(`\n📊 Résultats enrichissement :`)
  console.log(`   Enrichis (bio/adresse trouvés) : ${enrichCount}`)
  console.log(`   Score ≥ 4 (import direct)      : ${toImport.length}`)
  console.log(`   Score 2-3 (révision)            : ${toReview.length}`)
  console.log(`   Score < 2 (rejeté auto)         : ${autoReject.length}`)

  const finalOutput = {
    ...raw,
    enriched_at: new Date().toISOString(),
    enriched_count: enrichCount,
    to_import: toImport.length,
    to_review: toReview.length,
    auto_rejected: autoReject.length,
    profiles: enriched,
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalOutput, null, 2), 'utf8')
  console.log(`\n✅ Données enrichies → ${OUTPUT_FILE}`)
  console.log(`   Prochaine étape : node scripts/import-artisans-PT-habitissimo.mjs\n`)
}

main().catch(err => {
  console.error('Erreur fatale :', err)
  process.exit(1)
})
