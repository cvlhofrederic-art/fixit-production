/**
 * enrich-phones-fr.mjs
 *
 * Scrape Google Maps pour récupérer le téléphone des artisans FR
 * dont telephone_pro est NULL dans artisans_catalogue, puis update Supabase.
 *
 * VÉRIFICATIONS STRICTES avant update :
 *   1. Nom de la société Google ≈ nom DB (similarité Jaro-Winkler ≥ 0.78)
 *   2. Catégorie Google compatible avec le métier en DB (mapping)
 *   3. Adresse / ville Google contient la ville DB (ou inverse)
 *   4. Société NON marquée "Définitivement fermé" ni "Permanently closed"
 *   5. Numéro au format FR valide (10 chiffres commençant par 0)
 *
 * Si une vérification échoue → on skip (et on logue pour review manuelle).
 *
 * Usage :
 *   npx playwright install chromium    (première fois)
 *   node scripts/enrich-phones-fr.mjs
 *   node scripts/enrich-phones-fr.mjs --limit 50
 *   node scripts/enrich-phones-fr.mjs --dry-run
 *   node scripts/enrich-phones-fr.mjs --metier Plombier
 *   node scripts/enrich-phones-fr.mjs --strict-min 0.85   (seuil similarité nom)
 *
 * Variables d'environnement requises :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Args CLI ────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const argVal = (k, def = null) => {
  const i = args.indexOf(k)
  return i >= 0 ? args[i + 1] : def
}
const LIMIT = parseInt(argVal('--limit', '200'), 10)
const DRY_RUN = args.includes('--dry-run')
const METIER_FILTER = argVal('--metier')
const STRICT_MIN = parseFloat(argVal('--strict-min', '0.78'))
const SLEEP_BETWEEN = 4500 // anti rate-limit

// ── Mapping métier DB → keywords catégorie Google ───────────────────
const METIER_KEYWORDS = {
  'Plombier': ['plomb', 'plumber', 'sanitaire', 'chauffag'],
  'Électricien': ['électr', 'electric', 'electrician'],
  'Serrurier': ['serrur', 'lock', 'locksmith', 'clé', 'porte blind'],
  'Peintre': ['peint', 'paint', 'painter'],
  'Plaquiste': ['plaqu', 'placo', 'cloison', 'drywall', 'plâtrier'],
  'Paysagiste': ['paysag', 'élagu', 'élagage', 'jardin', 'gardener', 'landscape', 'tonte', 'taille', 'haie', 'arbre', 'gazon', 'pelouse', 'horticult'],
  'Couvreur': ['couvr', 'toiture', 'roof', 'roofer', 'tuile'],
  'Maçon': ['maçon', 'macon', 'mason', 'masonry', 'gros œuvre', 'brique'],
  'Carreleur': ['carrel', 'tile', 'tiler', 'faïenc'],
  'Menuisier': ['menuis', 'carpenter', 'carpentry', 'bois', 'parquet'],
  'Vitrier': ['vitr', 'glazier', 'verre', 'fenêtre'],
  'Métallier': ['métall', 'metal', 'serrur', 'ferronn', 'soudure'],
  'Ferronnier': ['ferronn', 'fer forgé', 'wrought iron', 'métall'],
  'Métallerie': ['métall', 'metal', 'serrur', 'ferronn'],
  'Climatisation': ['clim', 'air condition', 'aircon', 'froid', 'climatisation'],
  'Chauffagiste': ['chauffag', 'heating', 'chaudière', 'pompe à chaleur'],
  'Nettoyage': ['nettoy', 'clean', 'cleaning', 'ménage', 'cleaning service'],
  'Déménageur': ['déménag', 'demenag', 'moving', 'movers', 'transport'],
  'Débouchage': ['débouch', 'debouchage', 'plomb', 'curage', 'canalisation'],
}

// ── Fermeture / inactif markers ─────────────────────────────────────
const CLOSED_MARKERS = [
  'définitivement fermé', 'definitivement ferme',
  'permanently closed', 'fermeture définitive',
  'a fermé ses portes', 'cessation', 'liquidation',
]

// ── Supabase ────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables manquantes : NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helpers ─────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const normalize = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Jaro-Winkler simplified (good enough for company names)
function jaroWinkler(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  const m = (a, b) => {
    const range = Math.floor(Math.max(a.length, b.length) / 2) - 1
    const aMatch = new Array(a.length).fill(false)
    const bMatch = new Array(b.length).fill(false)
    let matches = 0
    for (let i = 0; i < a.length; i++) {
      const start = Math.max(0, i - range)
      const end = Math.min(i + range + 1, b.length)
      for (let j = start; j < end; j++) {
        if (bMatch[j]) continue
        if (a[i] !== b[j]) continue
        aMatch[i] = true
        bMatch[j] = true
        matches++
        break
      }
    }
    if (matches === 0) return { matches: 0, transpositions: 0 }
    let k = 0, t = 0
    for (let i = 0; i < a.length; i++) {
      if (!aMatch[i]) continue
      while (!bMatch[k]) k++
      if (a[i] !== b[k]) t++
      k++
    }
    return { matches, transpositions: t / 2 }
  }
  const { matches, transpositions } = m(a, b)
  if (matches === 0) return 0
  const jaro = (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3
  let prefix = 0
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++
    else break
  }
  return jaro + prefix * 0.1 * (1 - jaro)
}

function nameMatch(dbName, gName) {
  const a = normalize(dbName)
  const b = normalize(gName)
  if (!a || !b) return 0
  // Tolérant aux suffixes type "SARL", "SAS", etc.
  const stripSuffix = (x) => x.replace(/\b(sarl|sas|sasu|eurl|sa|sci|ei|auto entrepreneur|micro entreprise)\b/g, '').replace(/\s+/g, ' ').trim()
  const a2 = stripSuffix(a)
  const b2 = stripSuffix(b)
  // Inclusion bidirectionnelle = match fort
  if (a2 && b2 && (a2.includes(b2) || b2.includes(a2))) return Math.max(0.92, jaroWinkler(a2, b2))
  return jaroWinkler(a2, b2)
}

function metierMatchesCategory(metier, gCategory) {
  if (!metier || !gCategory) return false
  const cat = normalize(gCategory)
  const keywords = METIER_KEYWORDS[metier] || [normalize(metier)]
  return keywords.some((kw) => cat.includes(normalize(kw)))
}

function cityMatchesAddress(dbVille, gAddress) {
  if (!dbVille || !gAddress) return false
  const ville = normalize(dbVille).split(' ')[0] // "Marseille 13e" → "marseille"
  return normalize(gAddress).includes(ville)
}

function extractFrenchPhone(text) {
  if (!text) return null
  const candidates = [
    text.match(/(\+33[\s.-]?[1-9](?:[\s.-]?\d{2}){4})/),
    text.match(/(0[1-9](?:[\s.-]?\d{2}){4})/),
  ].filter(Boolean)
  if (candidates.length === 0) return null
  return candidates[0][1].replace(/[\s.-]/g, '').replace(/^\+33/, '0')
}

function formatPhoneFr(phone) {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length !== 10) return null
  if (!digits.startsWith('0')) return null
  return digits.match(/.{2}/g).join(' ')
}

// ── Scraping : prend la fiche complète du 1er résultat ─────────────
async function scrapeBestMatch(page, query) {
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(2200)

    const data = await page.evaluate(() => {
      const tryRegex = (txt) => {
        if (!txt) return null
        const m = txt.match(/(\+33[\s.-]?[1-9](?:[\s.-]?\d{2}){4})/) ||
                  txt.match(/(0[1-9](?:[\s.-]?\d{2}){4})/)
        return m ? m[1] : null
      }

      // Vue fiche détaillée (un seul résultat ou clic auto)
      const headlineEl = document.querySelector('h1.DUwDvf, h1[class*="Headline"]')
      if (headlineEl) {
        const name = headlineEl.textContent?.trim() || ''
        const categoryEl = document.querySelector('button[jsaction*="category"], button.DkEaL')
        const category = categoryEl ? categoryEl.textContent.trim() : ''
        const addressBtn = document.querySelector('[data-item-id="address"], button[data-tooltip="Copier l\'adresse"]')
        const address = addressBtn ? (addressBtn.getAttribute('aria-label') || addressBtn.textContent || '').replace(/^Adresse:\s*/i, '').trim() : ''
        const phoneBtn = document.querySelector('[data-item-id^="phone:"], button[aria-label*="téléphone" i]')
        const phoneAria = phoneBtn ? (phoneBtn.getAttribute('aria-label') || '') : ''
        const phoneText = phoneBtn ? phoneBtn.textContent || '' : ''
        const phone = tryRegex(phoneAria) || tryRegex(phoneText) || tryRegex(document.body.innerText)
        const closed = /définitivement fermé|permanently closed|fermeture définitive/i.test(document.body.innerText)
        return { mode: 'detail', name, category, address, phone, closed }
      }

      // Vue liste : on prend le premier item du feed
      const items = document.querySelectorAll('[role="feed"] > div')
      for (const item of items) {
        const nameEl = item.querySelector('.fontHeadlineSmall')
        if (!nameEl) continue
        const name = nameEl.textContent.trim()
        const allText = item.innerText
        const phone = tryRegex(allText)
        let category = ''
        let address = ''
        const descSpans = item.querySelectorAll('.W4Efsd')
        for (const d of descSpans) {
          const t = d.textContent.trim()
          if (t.includes('·')) {
            const parts = t.split('·').map((p) => p.trim())
            if (!category && parts[0] && !parts[0].match(/^\d/)) category = parts[0]
            for (const p of parts) {
              if (p.match(/^(Rue|Av\.|R\.|Av |Avenue|Bd |Boulevard|Place|Chemin|Allée|Route|Impasse|\d+ )/i)) address = p
            }
          }
        }
        const closed = /définitivement fermé|permanently closed/i.test(allText)
        return { mode: 'list', name, category, address, phone, closed }
      }

      return null
    })

    return data
  } catch (err) {
    console.error(`   ⚠️  scrape error: ${err.message}`)
    return null
  }
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Enrichissement téléphones FR — artisans_catalogue')
  console.log(`   Mode : ${DRY_RUN ? 'DRY-RUN (aucun update)' : 'WRITE'}`)
  console.log(`   Limite : ${LIMIT}`)
  console.log(`   Seuil similarité nom : ${STRICT_MIN}`)
  if (METIER_FILTER) console.log(`   Métier : ${METIER_FILTER}`)

  let query = supabase
    .from('artisans_catalogue')
    .select('id, nom_entreprise, metier, adresse, ville, arrondissement')
    .is('telephone_pro', null)
    .ilike('ville', '%arseille%')
    .order('google_note', { ascending: false, nullsFirst: false })
    .limit(LIMIT)

  if (METIER_FILTER) query = query.eq('metier', METIER_FILTER)

  const { data: artisans, error } = await query
  if (error) {
    console.error('❌ Supabase error:', error.message)
    process.exit(1)
  }
  if (!artisans || artisans.length === 0) {
    console.log('✅ Aucun artisan avec téléphone NULL — rien à faire')
    return
  }
  console.log(`📋 ${artisans.length} artisan(s) à enrichir\n`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'fr-FR',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  // Cookies
  try {
    await page.goto('https://www.google.com/maps', { waitUntil: 'domcontentloaded' })
    await page.click('button:has-text("Tout accepter"), button:has-text("Accepter tout")', { timeout: 5000 }).catch(() => {})
    await sleep(1500)
  } catch {}

  let found = 0, updated = 0, rejected = 0
  const accepted = []
  const rejectedList = []

  for (let i = 0; i < artisans.length; i++) {
    const a = artisans[i]
    const queryStr = `${a.nom_entreprise} ${a.adresse || ''} ${a.ville || ''}`.replace(/\s+/g, ' ').trim()
    process.stdout.write(`[${i + 1}/${artisans.length}] ${a.nom_entreprise.slice(0, 42).padEnd(42)} → `)

    const data = await scrapeBestMatch(page, queryStr)
    if (!data || !data.phone) {
      console.log('— pas de numéro trouvé')
      await sleep(SLEEP_BETWEEN)
      continue
    }

    found++
    const phoneFormatted = formatPhoneFr(extractFrenchPhone(data.phone))
    if (!phoneFormatted) {
      console.log(`❌ format invalide (${data.phone})`)
      rejected++
      rejectedList.push({ ...a, reason: 'format', raw: data.phone })
      await sleep(SLEEP_BETWEEN)
      continue
    }

    // ── Validations strictes ────────────────────────────────────
    const nameSim = nameMatch(a.nom_entreprise, data.name)
    const metierOk = metierMatchesCategory(a.metier, data.category)
    const cityOk = cityMatchesAddress(a.ville, data.address)
    const isClosed = data.closed || CLOSED_MARKERS.some((m) => normalize(data.name + ' ' + data.address).includes(normalize(m)))

    const reasons = []
    if (nameSim < STRICT_MIN) reasons.push(`nom (sim=${nameSim.toFixed(2)})`)
    if (!metierOk) reasons.push(`métier (cat="${data.category}" vs DB="${a.metier}")`)
    if (!cityOk) reasons.push(`ville (addr="${data.address}" vs DB="${a.ville}")`)
    if (isClosed) reasons.push('fermé')

    if (reasons.length > 0) {
      console.log(`❌ rejeté : ${reasons.join(', ')}`)
      rejected++
      rejectedList.push({ ...a, reason: reasons.join(', '), gName: data.name, gCategory: data.category, gAddress: data.address, phone: phoneFormatted })
      await sleep(SLEEP_BETWEEN)
      continue
    }

    console.log(`📞 ${phoneFormatted}  ✓ nom=${nameSim.toFixed(2)} ✓ métier ✓ ville`)
    accepted.push({ id: a.id, nom: a.nom_entreprise, phone: phoneFormatted, gName: data.name, gCategory: data.category })

    if (!DRY_RUN) {
      const { error: upErr } = await supabase
        .from('artisans_catalogue')
        .update({ telephone_pro: phoneFormatted })
        .eq('id', a.id)
      if (upErr) {
        console.error(`   ❌ update failed: ${upErr.message}`)
      } else {
        updated++
      }
    }

    await sleep(SLEEP_BETWEEN)
  }

  await browser.close()

  console.log('\n──────────────────────────────────────────────────')
  console.log(`✅ Acceptés : ${accepted.length}/${artisans.length}`)
  console.log(`📞 Numéros trouvés : ${found}`)
  console.log(`❌ Rejetés (validation stricte) : ${rejected}`)
  console.log(`💾 Mis à jour en DB : ${updated}${DRY_RUN ? ' (DRY-RUN — aucun)' : ''}`)

  const dataDir = path.join(__dirname, '../data')
  fs.mkdirSync(dataDir, { recursive: true })
  if (accepted.length > 0) {
    fs.writeFileSync(path.join(dataDir, 'enriched-phones-fr-accepted.json'), JSON.stringify(accepted, null, 2))
    console.log(`   📄 accepted → data/enriched-phones-fr-accepted.json`)
  }
  if (rejectedList.length > 0) {
    fs.writeFileSync(path.join(dataDir, 'enriched-phones-fr-rejected.json'), JSON.stringify(rejectedList, null, 2))
    console.log(`   📄 rejected → data/enriched-phones-fr-rejected.json (à review manuellement)`)
  }
}

main().catch((err) => {
  console.error('❌ Fatal:', err)
  process.exit(1)
})
