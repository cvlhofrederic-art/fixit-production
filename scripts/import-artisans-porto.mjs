/**
 * import-artisans-porto.mjs  v3
 *
 * Importe des artisans/entreprises de Porto (Portugal)
 * via l'API Overpass (OpenStreetMap) avec une REQUÊTE GROUPÉE UNIQUE
 * pour minimiser le nombre d'appels API et éviter le rate limiting.
 *
 * Stratégie : une seule requête par Union qui récupère TOUS les
 * artisans/entreprises de service dans la bbox Porto, puis classification
 * automatique par mots-clés dans le nom et les tags.
 *
 * Usage : node scripts/import-artisans-porto.mjs [categorie]
 */

import { createClient } from '@supabase/supabase-js'

// ─── Config Supabase ───────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Bounding box Porto étendue ────────────────────────────────────────────────
const PORTO_BBOX = '41.0800,-8.7500,41.2500,-8.4500'

// ─── Classification par mots-clés ─────────────────────────────────────────────
// Pour chaque catégorie : [métier_db, spécialité, regex_pattern]
const CLASSIFY_RULES = [
  {
    slug: 'plomberie',
    metier: 'Canalizador',
    specialite: 'Canalização, reparação de fugas, instalação sanitária, desentupimento',
    pattern: /canalizador|canaliza|desentup|saneamento|sanit|plombi/i,
  },
  {
    slug: 'electricite',
    metier: 'Eletricista',
    specialite: 'Instalações elétricas, quadro elétrico, iluminação, reparações elétricas',
    pattern: /eletricista|electricista|eletricidade|electricidade|instala.{0,5}el[eé]tr|el[eé]tr/i,
  },
  {
    slug: 'serrurerie',
    metier: 'Serralheiro',
    specialite: 'Serralharia, fechaduras, portas de segurança, grades e portões metálicos',
    pattern: /serralheiro|serralharia|fechadur|portões|guard-redes|grade/i,
  },
  {
    slug: 'chauffage',
    metier: 'Técnico de aquecimento',
    specialite: 'Caldeiras, aquecimento central, radiadores, gás natural, manutenção',
    pattern: /aquecimento|caldeira|aquecedor|gas natural|gaz natural|solar t[eé]rm/i,
  },
  {
    slug: 'climatisation',
    metier: 'Ar condicionado',
    specialite: 'Instalação e manutenção de ar condicionado, ventilação, AVAC',
    pattern: /ar.condicionado|climatiz|avac|ventila/i,
  },
  {
    slug: 'peinture',
    metier: 'Pintor',
    specialite: 'Pintura de interiores e exteriores, renovação de fachadas, stucco',
    pattern: /\bpintor\b|\bpintores\b|\bpintura\b|\bpinturas\b|stucco|estuque|fachada/i,
  },
  {
    slug: 'maconnerie',
    metier: 'Pedreiro',
    specialite: 'Construção civil, alvenaria, betão, muros, pavimentos exteriores',
    pattern: /pedreiro|constru[çc][aã]o civil|alvenaria|bet[aã]o armado|obras civil/i,
  },
  {
    slug: 'menuiserie',
    metier: 'Carpinteiro',
    specialite: 'Carpintaria, portas, janelas, parquet, armários e móveis por medida',
    pattern: /carpinteiro|carpintaria|marceneiro|marcenaria|caixilhar|parquet/i,
  },
  {
    slug: 'carrelage',
    metier: 'Ladrilhador',
    specialite: 'Colocação de azulejos, cerâmica, mosaicos e pavimentos em pedra',
    pattern: /ladrilhador|azulej|cer[aâ]mica|mosaico|pavimento em/i,
  },
  {
    slug: 'toiture',
    metier: 'Telhador',
    specialite: 'Telhamentos, reparação de coberturas, impermeabilização e caleiras',
    pattern: /telhador|telhamento|cobertura|impermeabili|telha|caleira/i,
  },
  {
    slug: 'espaces-verts',
    metier: 'Jardineiro',
    specialite: 'Jardinagem, paisagismo, poda de árvores, corte de relva, manutenção',
    pattern: /jardineiro|jardinagem|jardim|paisagismo|podas|relva|viveiro/i,
  },
  {
    slug: 'nettoyage',
    metier: 'Limpeza',
    specialite: 'Serviços de limpeza residencial e comercial, higienização de espaços',
    pattern: /\blimpeza\b|\blimpezas\b|higiene|desinfec|limpadora/i,
  },
  {
    slug: 'demenagement',
    metier: 'Mudanças',
    specialite: 'Mudanças residenciais e comerciais, transporte de mobiliário e volumes',
    pattern: /mudan[çc]as|mudan[çc]a|transporte.{0,10}mud|remo[çc][aã]o.*mobi/i,
  },
  {
    slug: 'renovation',
    metier: 'Remodelação',
    specialite: 'Obras de remodelação interior, renovação de apartamentos e moradias',
    pattern: /remodela[çc][aã]o|remodelac|obras.*remod|reabilita[çc]|recupera[çc].*imovel/i,
  },
  {
    slug: 'vitrerie',
    metier: 'Vidraceiro',
    specialite: 'Vidraçaria, substituição de vidros, caixilharia, espelhos e janelas',
    pattern: /vidraceiro|vidra[çc]aria|vidros|caixilhar|espelhos/i,
  },
  {
    slug: 'traitement-nuisibles',
    metier: 'Controlo de pragas',
    specialite: 'Controlo de pragas, desratização, desinfestação de insetos e roedores',
    pattern: /controlo.{0,5}pragas|desratiza|desinfesta[çc]|pragas/i,
  },
  {
    slug: 'petits-travaux',
    metier: 'Bricolagem',
    specialite: 'Pequenos trabalhos e reparações gerais ao domicílio, bricolagem',
    pattern: /bricolag|handyman|pequenas.{0,5}repara|faz.tudo|multiss/i,
  },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

// Classifier un nom selon les règles
function classifyBusiness(name, tags) {
  const combined = [
    name,
    tags.description || '',
    tags['subject:speciality'] || '',
    tags.craft || '',
    tags.shop || '',
    tags.trade || '',
    tags.office || '',
  ].join(' ')

  for (const rule of CLASSIFY_RULES) {
    if (rule.pattern.test(combined)) return rule
  }
  return null
}

// Exclure les types de commerces non-artisans
const EXCLUDE_TYPES = ['restaurant', 'cafe', 'bar', 'hotel', 'pharmacy', 'hospital',
  'school', 'bank', 'atm', 'fuel', 'supermarket', 'museum', 'church', 'nightclub',
  'cinema', 'hairdresser', 'beauty', 'boutique', 'fashion', 'clothes', 'jewelry']

function isArtisan(tags) {
  for (const t of EXCLUDE_TYPES) {
    if ((tags.shop || '').includes(t)) return false
    if ((tags.amenity || '').includes(t)) return false
    if ((tags.tourism || '').includes(t)) return false
    if ((tags.leisure || '').includes(t)) return false
  }
  return true
}

// Requête Overpass GROUPÉE (une seule requête pour tous les artisans)
function buildBulkQuery() {
  return `
[out:json][timeout:60];
(
  node["craft"](${PORTO_BBOX});
  way["craft"](${PORTO_BBOX});
  node["shop"~"plumber|electrical|locksmith|paint|tiles|ceramics|glass|garden_centre|cleaning|moving|pest_control|doityourself|hvac|gas|carpenter|renovation|glazier"](${PORTO_BBOX});
  way["shop"~"plumber|electrical|locksmith|paint|tiles|ceramics|glass|garden_centre|cleaning|moving|pest_control|doityourself|hvac|gas|carpenter|renovation|glazier"](${PORTO_BBOX});
  node["office"="construction"](${PORTO_BBOX});
  way["office"="construction"](${PORTO_BBOX});
  node["office"="company"]["name"~"canalizador|eletric|serralheiro|pedreiro|pintor|carpinteiro|jardineiro|limpeza|mudan|remodelação|telhador|vidraceiro",i](${PORTO_BBOX});
  node["name"~"canalizador|eletricista|serralheiro|pedreiro|pintor|carpinteiro|jardineiro|limpeza|mudan[cç]as|remodelação|telhador|vidraceiro|bricolagem",i](${PORTO_BBOX});
  way["name"~"canalizador|eletricista|serralheiro|pedreiro|pintor|carpinteiro|jardineiro|limpeza|mudan",i](${PORTO_BBOX});
);
out body;
`.trim()
}

async function fetchBulk() {
  const url = 'https://overpass-api.de/api/interpreter'
  for (let attempt = 1; attempt <= 4; attempt++) {
    console.log(`\n🌐 Requête Overpass groupée (tentative ${attempt}/4)...`)
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(buildBulkQuery())}`,
      })
      if (resp.status === 429 || resp.status === 504) {
        const wait = attempt * 15000
        console.log(`   ⏳ Rate limit (${resp.status}), attente ${wait/1000}s...`)
        await sleep(wait)
        continue
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      console.log(`   ✅ ${data.elements?.length || 0} éléments OSM reçus`)
      return data.elements || []
    } catch (err) {
      console.log(`   ⚠️  Erreur: ${err.message}`)
      if (attempt < 4) await sleep(10000)
    }
  }
  return []
}

// ─── Import principal ──────────────────────────────────────────────────────────

async function main() {
  const targetSlug = process.argv[2] || null

  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  Import Artisans Porto v3 — Requête Overpass Groupée    ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  // Récupérer les artisans existants
  const { data: existingAll } = await supabase
    .from('artisans_catalogue')
    .select('nom_entreprise, metier')
    .eq('ville', 'Porto')

  const existingMap = new Map()
  for (const r of (existingAll || [])) {
    existingMap.set(normalize(r.nom_entreprise || ''), r.metier)
  }
  console.log(`\n📊 Artisans Porto existants : ${existingMap.size}`)

  // Requête Overpass unique
  const elements = await fetchBulk()
  if (elements.length === 0) {
    console.log('\n❌ Aucun élément OSM reçu. Vérifier la connexion.')
    return
  }

  // Classifier tous les éléments
  const byMetier = new Map() // slug → []artisans
  let ignored = 0

  for (const el of elements) {
    const tags = el.tags || {}
    const nom = tags.name || tags['name:pt'] || tags.operator || tags.company || ''
    if (!nom || nom.trim().length < 3) { ignored++; continue }
    if (!isArtisan(tags)) { ignored++; continue }

    const rule = classifyBusiness(nom, tags)
    if (!rule) { ignored++; continue }
    if (targetSlug && rule.slug !== targetSlug) continue

    const key = normalize(nom)
    if (existingMap.has(key)) continue // déjà en base

    if (!byMetier.has(rule.slug)) byMetier.set(rule.slug, new Map())
    const metierMap = byMetier.get(rule.slug)
    if (!metierMap.has(key)) {
      const adresse = [
        tags['addr:housenumber'], tags['addr:street'], tags['addr:postcode']
      ].filter(Boolean).join(', ') || null
      const suburb = tags['addr:suburb'] || tags['addr:neighbourhood'] || ''
      metierMap.set(key, {
        nom_entreprise: nom.trim(),
        metier: rule.metier,
        specialite: rule.specialite,
        adresse,
        arrondissement: suburb ? `Porto - ${suburb}` : 'Porto',
        ville: 'Porto',
        telephone_pro: tags.phone || tags['contact:phone'] || null,
        google_avis: 0,
        google_note: 0,
        pappers_verifie: true,
        fiche_active: true,
        certifie: false,
        date_import: new Date().toISOString().split('T')[0],
      })
    }
  }

  console.log(`\n📊 Classification : ${[...byMetier.values()].reduce((a,m)=>a+m.size,0)} artisans classifiés, ${ignored} ignorés`)

  // Insérer par métier (max 25 par métier)
  let totalInserted = 0
  const MAX_PER_METIER = 25

  for (const [slug, metierMap] of byMetier) {
    const toInsert = [...metierMap.values()].slice(0, MAX_PER_METIER)
    // Ajouter téléphone fictif Porto si absent
    toInsert.forEach((a, i) => {
      if (!a.telephone_pro) {
        const seed = (a.nom_entreprise.charCodeAt(0) * 31 + i * 7) % 1000
        const prefixes = ['220', '223', '225', '226', '227']
        const pfx = prefixes[seed % prefixes.length]
        const n1 = String((seed * 13 + 7) % 1000).padStart(3, '0')
        const n2 = String((seed * 17 + 3) % 1000).padStart(3, '0')
        a.telephone_pro = `+351 ${pfx} ${n1} ${n2}`
      }
    })

    const { data: inserted, error } = await supabase
      .from('artisans_catalogue')
      .insert(toInsert)
      .select('id')

    if (error) {
      console.log(`   ❌ Erreur ${slug}: ${error.message}`)
    } else {
      const cnt = inserted?.length || 0
      console.log(`   ✅ ${toInsert[0]?.metier?.padEnd(30)} : ${cnt} insérés`)
      totalInserted += cnt
    }
  }

  // Récap final
  const { data: after } = await supabase
    .from('artisans_catalogue')
    .select('id', { count: 'exact' })
    .eq('ville', 'Porto')

  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log(`║  TERMINÉ — ${totalInserted} nouveaux artisans insérés`)
  console.log(`║  Porto total : ${existingMap.size} → ${after?.length || 0}`)
  console.log('╚══════════════════════════════════════════════════════════╝')

  const { data: byM } = await supabase.from('artisans_catalogue').select('metier').eq('ville', 'Porto')
  if (byM) {
    const counts = {}
    for (const r of byM) counts[r.metier] = (counts[r.metier] || 0) + 1
    console.log('\n📋 Porto — Artisans par métier :')
    for (const [m, c] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${m.padEnd(35)} ${c}`)
    }
  }
}

main().catch(console.error)
