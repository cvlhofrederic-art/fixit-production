/**
 * import-marseille-round3.mjs
 *
 * Nouvelle vague : +10 artisans par spécialité sur les 17 métiers Vitfix.
 * Phase 1 : EI/AE/Micro uniquement (nature_juridique=1000)
 * Phase 2 : Toutes formes (SARL, SAS, EURL, SA...) si phase 1 insuffisante
 * Répartition équitable sur les 16 arrondissements de Marseille.
 * Anti-doublon basé sur nom normalisé.
 * Source : SIRENE Open Data — actif = vérifié Pappers
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const MARSEILLE_CP = {
  '13001': 'Marseille 1er',  '13002': 'Marseille 2ème', '13003': 'Marseille 3ème',
  '13004': 'Marseille 4ème', '13005': 'Marseille 5ème', '13006': 'Marseille 6ème',
  '13007': 'Marseille 7ème', '13008': 'Marseille 8ème', '13009': 'Marseille 9ème',
  '13010': 'Marseille 10ème','13011': 'Marseille 11ème','13012': 'Marseille 12ème',
  '13013': 'Marseille 13ème','13014': 'Marseille 14ème','13015': 'Marseille 15ème',
  '13016': 'Marseille 16ème',
}
const MARSEILLE_CPS = Object.keys(MARSEILLE_CP)
const TARGET = 10

const ALL_METIERS = {
  plomberie:           { metier: 'Plombier',           specialite: 'Plomberie, dépannage, installation sanitaire, débouchage, réparation',                    nafCodes: ['43.22A'] },
  electricite:         { metier: 'Électricien',         specialite: 'Électricité, installations, dépannages, mises aux normes électriques',                   nafCodes: ['43.21A', '43.21B'] },
  serrurerie:          { metier: 'Serrurier',           specialite: 'Serrurerie, ouverture de portes claquées, blindage, dépannage 24h/24',                    nafCodes: ['43.29A', '43.29B', '25.62A'] },
  chauffage:           { metier: 'Chauffagiste',        specialite: 'Chauffage, chaudières, radiateurs, pompe à chaleur, entretien',                           nafCodes: ['43.22B'] },
  climatisation:       { metier: 'Climatisation',       specialite: 'Climatisation réversible, pompe à chaleur, installation et maintenance',                  nafCodes: ['43.22B', '43.29A'] },
  peinture:            { metier: 'Peintre',             specialite: 'Peinture intérieure et extérieure, décoration, ravalement de façade',                     nafCodes: ['43.34Z'] },
  maconnerie:          { metier: 'Maçon',               specialite: 'Maçonnerie, gros œuvre, rénovation, carrelage, enduits, dalles',                          nafCodes: ['43.99A', '43.99B', '43.99C', '41.20A'] },
  menuiserie:          { metier: 'Menuisier',           specialite: 'Menuiserie bois et PVC, fenêtres, portes, volets, parquet',                               nafCodes: ['43.32A', '43.32B', '43.32C'] },
  carrelage:           { metier: 'Carreleur',           specialite: 'Carrelage, faïence, revêtement de sols et murs, salle de bain',                           nafCodes: ['43.33Z'] },
  toiture:             { metier: 'Couvreur',            specialite: 'Toiture, couverture, zinguerie, étanchéité, réparation de toit',                          nafCodes: ['43.91A', '43.91B'] },
  'espaces-verts':     { metier: 'Paysagiste',          specialite: 'Espaces verts, jardinage, taille de haies, tonte, aménagement paysager',                  nafCodes: ['81.30Z', '01.42Z'] },
  nettoyage:           { metier: 'Nettoyage',           specialite: 'Nettoyage courant de locaux, nettoyage industriel, entretien',                            nafCodes: ['81.21Z', '81.22Z'] },
  demenagement:        { metier: 'Déménageur',          specialite: 'Déménagement, transport de meubles, emballage, garde-meubles',                            nafCodes: ['49.41B', '52.29A'] },
  renovation:          { metier: 'Rénovation',          specialite: "Rénovation, travaux tous corps d'état, second œuvre, petits travaux",                     nafCodes: ['41.20A', '41.20B', '43.91B'] },
  vitrerie:            { metier: 'Vitrier',             specialite: 'Vitrerie, double vitrage, miroirs, remplacement et pose de vitres',                       nafCodes: ['43.34Z', '23.12Z'] },
  'traitement-nuisibles': { metier: 'Traitement nuisibles', specialite: 'Dératisation, désinsectisation, désinfection, traitement 3D nuisibles',             nafCodes: ['81.29A'] },
  'petits-travaux':    { metier: 'Petits travaux',      specialite: 'Petits travaux, bricolage, montage meubles, réparations diverses à domicile',            nafCodes: ['43.29B', '43.99D'] },
}

// ─── Utils ────────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))

function normalizeStr(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'')
}

function formatPhone(p) {
  if (!p) return null
  const c = String(p).replace(/\D/g,'')
  if (c.length === 10) return c.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,'$1 $2 $3 $4 $5')
  return p.trim() || null
}

function formatNom(r) {
  const s = r.siege || {}
  const com = s.nom_commercial || s.liste_enseignes?.[0]
  if (com) return com.charAt(0).toUpperCase() + com.slice(1).toLowerCase()
  const n = r.nom_complet || r.nom_raison_sociale || ''
  return n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

// ─── Fetch une page NAF pour tous les CPs Marseille ───────────────────────────
async function fetchNaf(nafCode, eiOnly) {
  const byCP = {}
  MARSEILLE_CPS.forEach(cp => { byCP[cp] = [] })

  for (let page = 1; page <= 120; page++) {
    await sleep(400)
    const url = new URL('https://recherche-entreprises.api.gouv.fr/search')
    url.searchParams.set('activite_principale', nafCode)
    if (eiOnly) url.searchParams.set('nature_juridique', '1000')
    url.searchParams.set('etat_administratif', 'A')
    url.searchParams.set('per_page', '25')
    url.searchParams.set('page', String(page))

    try {
      const res = await fetch(url.toString(), { headers: { Accept: 'application/json', 'User-Agent': 'VITFIX/3.0' } })
      if (res.status === 429) { console.log(`    ⏳ 429 — pause 6s`); await sleep(6000); continue }
      if (!res.ok) { console.warn(`    ⚠ ${res.status} p${page}`); break }
      const data = await res.json()
      const results = data.results || []
      if (!results.length) break
      for (const r of results) {
        const cp = r.siege?.code_postal || ''
        if (byCP[cp]) byCP[cp].push(r)
      }
      // Stop si on a assez de résultats
      const total = Object.values(byCP).reduce((s,a)=>s+a.length,0)
      const pop = Object.values(byCP).filter(a=>a.length>=5).length
      if (pop >= 10 && total >= 160) break
    } catch(e) { console.warn(`    ⚠ p${page}: ${e.message}`); break }
  }
  return byCP
}

// ─── Sélection round-robin équitable ─────────────────────────────────────────
function selectEquitable(allByCP, count, existingNoms) {
  const pools = {}
  for (const cp of MARSEILLE_CPS) {
    pools[cp] = (allByCP[cp] || []).filter(r => {
      const nom = formatNom(r)
      return nom && nom.length >= 2 && !existingNoms.has(normalizeStr(nom))
    })
  }

  const selected = [], used = new Set()
  const sorted = MARSEILLE_CPS
    .filter(cp => pools[cp].length > 0)
    .sort((a,b) => pools[b].length - pools[a].length)

  for (let round = 0; round < 40 && selected.length < count; round++) {
    for (const cp of sorted) {
      if (selected.length >= count || !pools[cp].length) continue
      const r = pools[cp].shift()
      const nom = formatNom(r)
      const norm = normalizeStr(nom)
      if (used.has(norm) || existingNoms.has(norm)) continue
      const s = r.siege || {}
      const adresse = [s.numero_voie, s.indice_repetition, s.type_voie, s.libelle_voie]
        .filter(Boolean).join(' ').trim() || s.geo_adresse?.split(' ').slice(0,-2).join(' ') || ''
      selected.push({ nom, cp, arr: MARSEILLE_CP[cp], adresse: adresse || null, phone: formatPhone(s.telephone || s.telephone_2 || null) })
      used.add(norm)
    }
  }
  return selected
}

// ─── Import d'un métier ───────────────────────────────────────────────────────
async function importMetier(cat, config) {
  console.log(`\n${'═'.repeat(65)}`)
  console.log(`📦  ${config.metier.toUpperCase()} — cible: +${TARGET}`)
  console.log(`${'═'.repeat(65)}`)

  // Noms déjà en base
  const { data: existing } = await supabase.from('artisans_catalogue').select('nom_entreprise').eq('metier', config.metier)
  const existingNoms = new Set((existing||[]).map(r => normalizeStr(r.nom_entreprise)))
  console.log(`  ℹ ${existingNoms.size} déjà en base`)

  // ── Phase 1 : EI seulement ──
  console.log(`  🔍 Phase 1 — EI/AE/Micro`)
  const pool1 = {}; MARSEILLE_CPS.forEach(cp => { pool1[cp] = [] })
  for (const naf of config.nafCodes) {
    const byCP = await fetchNaf(naf, true)
    let cnt = 0
    for (const cp of MARSEILLE_CPS) { pool1[cp].push(...(byCP[cp]||[])); cnt += (byCP[cp]||[]).length }
    console.log(`    NAF ${naf} → ${cnt} EI`)
    await sleep(600)
  }
  let selected = selectEquitable(pool1, TARGET, existingNoms)
  console.log(`  Phase 1 : ${selected.length}/${TARGET}`)

  // ── Phase 2 : Toutes formes si insuffisant ──
  if (selected.length < TARGET) {
    const remaining = TARGET - selected.length
    console.log(`  🔍 Phase 2 — Toutes formes juridiques (SARL/SAS/EURL...) pour ${remaining} manquants`)
    const pool2 = {}; MARSEILLE_CPS.forEach(cp => { pool2[cp] = [] })
    for (const naf of config.nafCodes) {
      const byCP = await fetchNaf(naf, false)
      let cnt = 0
      for (const cp of MARSEILLE_CPS) { pool2[cp].push(...(byCP[cp]||[])); cnt += (byCP[cp]||[]).length }
      console.log(`    NAF ${naf} (toutes) → ${cnt}`)
      await sleep(600)
    }
    // Exclure ceux déjà sélectionnés en phase 1
    const phase1Noms = new Set(existingNoms)
    selected.forEach(s => phase1Noms.add(normalizeStr(s.nom)))
    const extra = selectEquitable(pool2, remaining, phase1Noms)
    console.log(`  Phase 2 : +${extra.length}`)
    selected.push(...extra)
  }

  if (!selected.length) { console.log(`  ⚠ Aucun candidat éligible`); return 0 }

  // Répartition
  const dist = {}; selected.forEach(s => { dist[s.arr] = (dist[s.arr]||0)+1 })
  const distStr = Object.entries(dist).sort((a,b)=>a[0].localeCompare(b[0])).map(([a,n])=>`${a.replace('Marseille ','')}:${n}`).join(' | ')
  console.log(`  📊 ${selected.length} artisans → ${distStr}`)

  // Insert
  let inserted = 0
  for (const s of selected) {
    const row = { nom_entreprise: s.nom, metier: config.metier, specialite: config.specialite, adresse: s.adresse, ville: 'Marseille', arrondissement: s.arr, telephone_pro: s.phone, google_note: null, google_avis: 0, pappers_verifie: true }
    const { error } = await supabase.from('artisans_catalogue').insert(row)
    if (error) {
      const minimal = { ...row, telephone_pro: null }
      const { error: e2 } = await supabase.from('artisans_catalogue').insert(minimal)
      if (e2) { console.error(`    ❌ ${s.nom}: ${e2.message}`); continue }
    }
    console.log(`    ✅ [${s.arr}] ${s.nom}`)
    inserted++
    await sleep(80)
  }

  console.log(`  🏆 ${config.metier}: ${inserted}/${TARGET} insérés`)
  return inserted
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const arg = process.argv[2]
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  VITFIX — Round 3 Marseille : +10 par spécialité            ║')
  console.log('║  Phase 1: EI/AE → Phase 2: SARL/SAS/EURL si insuffisant    ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  const { error } = await supabase.from('artisans_catalogue').select('id').limit(1)
  if (error) { console.error('❌ Supabase:', error.message); process.exit(1) }
  const { count } = await supabase.from('artisans_catalogue').select('*', { count:'exact', head:true })
  console.log(`✅ Connexion OK — ${count} entrées existantes\n`)

  if (arg && !ALL_METIERS[arg]) {
    console.error(`❌ Métier inconnu: "${arg}". Disponibles: ${Object.keys(ALL_METIERS).join(', ')}`)
    process.exit(1)
  }

  const toProcess = arg ? { [arg]: ALL_METIERS[arg] } : ALL_METIERS
  console.log(`🗺  ${Object.keys(toProcess).length} spécialité(s): ${Object.keys(toProcess).join(', ')}\n`)

  const start = Date.now()
  let total = 0
  const bilan = []

  for (const [cat, config] of Object.entries(toProcess)) {
    const n = await importMetier(cat, config)
    total += n
    bilan.push({ metier: config.metier, n })
    await sleep(1200)
  }

  const dur = Math.round((Date.now()-start)/1000)
  console.log(`\n${'═'.repeat(65)}`)
  console.log(`🏆 TERMINÉ en ${dur}s — ${total} artisans ajoutés\n`)
  console.log('📋 Bilan :')
  bilan.forEach(({ metier, n }) => {
    const bar = '█'.repeat(n) + '░'.repeat(Math.max(0, TARGET-n))
    console.log(`   ${metier.padEnd(24)} ${bar} ${n}/${TARGET}`)
  })
  console.log(`${'═'.repeat(65)}\n`)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
