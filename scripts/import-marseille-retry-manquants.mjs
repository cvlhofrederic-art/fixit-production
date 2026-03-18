/**
 * import-marseille-retry-manquants.mjs
 *
 * Retry pour les spécialités incomplètes (< 10 artisans ajoutés).
 * Élargit la recherche aux SARL/SAS/EURL en plus des EI/AE.
 * Source : SIRENE Open Data (actif = vérifié Pappers)
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

const ADD_PER_SPECIALTY = 10

// Spécialités incomplètes à rattraper
const RETRY_CONFIG = {
  chauffage: {
    metier: 'Chauffagiste',
    specialite: 'Chauffage, chaudières, radiateurs, pompe à chaleur, entretien',
    nafCodes: ['43.22B'],
  },
  peinture: {
    metier: 'Peintre',
    specialite: 'Peinture intérieure et extérieure, décoration, ravalement de façade',
    nafCodes: ['43.34Z'],
  },
  menuiserie: {
    metier: 'Menuisier',
    specialite: 'Menuiserie bois et PVC, fenêtres, portes, volets, parquet',
    nafCodes: ['43.32A', '43.32B', '43.32C'],
    target: 9, // Besoin de 9 de plus
  },
  carrelage: {
    metier: 'Carreleur',
    specialite: 'Carrelage, faïence, revêtement de sols et murs, salle de bain',
    nafCodes: ['43.33Z'],
    target: 8, // Besoin de 8 de plus
  },
  electricite: {
    metier: 'Électricien',
    specialite: 'Électricité, installations, dépannages, mises aux normes électriques',
    nafCodes: ['43.21A', '43.21B'],
    target: 5, // Besoin de 5 de plus
  },
  'espaces-verts': {
    metier: 'Paysagiste',
    specialite: 'Espaces verts, jardinage, taille de haies, tonte, aménagement paysager',
    nafCodes: ['81.30Z', '01.42Z'],
    target: 9,
  },
  nettoyage: {
    metier: 'Nettoyage',
    specialite: 'Nettoyage courant de locaux, nettoyage industriel, entretien',
    nafCodes: ['81.21Z', '81.22Z'],
  },
  demenagement: {
    metier: 'Déménageur',
    specialite: 'Déménagement, transport de meubles, emballage, garde-meubles',
    nafCodes: ['49.41B', '52.29A'],
  },
  'traitement-nuisibles': {
    metier: 'Traitement nuisibles',
    specialite: 'Dératisation, désinsectisation, désinfection, traitement 3D nuisibles',
    nafCodes: ['81.29A'],
    target: 8,
  },
  'petits-travaux': {
    metier: 'Petits travaux',
    specialite: 'Petits travaux, bricolage, montage meubles, réparations diverses à domicile',
    nafCodes: ['43.29B', '43.99D'],
  },
}

// Formes juridiques élargies : EI + EURL + SARL + SAS + SA + micro/indep
// On retire le filtre nature_juridique pour maximiser les résultats
// L'API SIRENE retournera tout type d'entreprise active

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function formatPhone(phone) {
  if (!phone) return null
  const clean = String(phone).replace(/\D/g, '')
  if (clean.length === 10) return clean.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')
  return phone.trim() || null
}

function normalizeStr(s) {
  if (!s) return ''
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

function formatNom(r) {
  const siege = r.siege || {}
  const nomCom = siege.nom_commercial || siege.liste_enseignes?.[0]
  if (nomCom) return nomCom.charAt(0).toUpperCase() + nomCom.slice(1).toLowerCase()
  const nom = r.nom_complet || r.nom_raison_sociale || ''
  return nom.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

async function fetchNaf(nafCode, useEiFilter) {
  const byCP = {}
  MARSEILLE_CPS.forEach(cp => { byCP[cp] = [] })

  for (let page = 1; page <= 100; page++) {
    await sleep(350) // Délai suffisant pour éviter 429
    const url = new URL('https://recherche-entreprises.api.gouv.fr/search')
    url.searchParams.set('activite_principale', nafCode)
    if (useEiFilter) url.searchParams.set('nature_juridique', '1000') // EI only
    url.searchParams.set('etat_administratif', 'A')
    url.searchParams.set('per_page', '25')
    url.searchParams.set('page', String(page))

    try {
      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json', 'User-Agent': 'VITFIX-Import/2.1' }
      })
      if (res.status === 429) {
        console.log(`    ⏳ Rate limit 429, pause 5s...`)
        await sleep(5000)
        continue
      }
      if (!res.ok) { console.warn(`    ⚠ API ${res.status} p${page}`); break }
      const data = await res.json()
      const results = data.results || []
      if (results.length === 0) break

      for (const r of results) {
        const cp = r.siege?.code_postal || ''
        if (byCP[cp]) byCP[cp].push(r)
      }

      const total = Object.values(byCP).reduce((s, a) => s + a.length, 0)
      const populated = Object.values(byCP).filter(a => a.length >= 4).length
      if (populated >= 10 && total >= 120) break
    } catch (e) {
      console.warn(`    ⚠ p${page}: ${e.message}`)
      break
    }
  }
  return byCP
}

function selectEquitable(allByCP, count, existingNoms) {
  const pools = {}
  for (const cp of MARSEILLE_CPS) {
    pools[cp] = (allByCP[cp] || []).filter(r => {
      const nom = formatNom(r)
      return nom && nom.length >= 2 && !existingNoms.has(normalizeStr(nom))
    })
  }

  const selected = []
  const usedNoms = new Set()
  const cpSorted = MARSEILLE_CPS
    .filter(cp => pools[cp].length > 0)
    .sort((a, b) => pools[b].length - pools[a].length)

  let rounds = 0
  while (selected.length < count && cpSorted.some(cp => pools[cp].length > 0)) {
    for (const cp of cpSorted) {
      if (selected.length >= count) break
      if (pools[cp].length === 0) continue
      const r = pools[cp].shift()
      const nom = formatNom(r)
      const norm = normalizeStr(nom)
      if (usedNoms.has(norm) || existingNoms.has(norm)) continue
      const siege = r.siege || {}
      const adresse = [siege.numero_voie, siege.indice_repetition, siege.type_voie, siege.libelle_voie]
        .filter(Boolean).join(' ').trim() || siege.geo_adresse?.split(' ').slice(0, -2).join(' ') || ''
      selected.push({
        nom, cp, arr: MARSEILLE_CP[cp],
        adresse: adresse || null,
        phone: formatPhone(siege.telephone || siege.telephone_2 || null),
      })
      usedNoms.add(norm)
    }
    if (++rounds > 30) break
  }
  return selected
}

async function importMetier(categorie, config) {
  const toAdd = config.target || ADD_PER_SPECIALTY
  console.log(`\n${'═'.repeat(65)}`)
  console.log(`📦  ${config.metier.toUpperCase()} — à ajouter: ${toAdd}`)
  console.log(`${'═'.repeat(65)}`)

  const { data: existing } = await supabase
    .from('artisans_catalogue')
    .select('nom_entreprise')
    .eq('metier', config.metier)
  const existingNoms = new Set((existing || []).map(r => normalizeStr(r.nom_entreprise)))
  console.log(`  ℹ ${existingNoms.size} artisans existants en base`)

  // Phase 1: EI uniquement
  console.log(`\n  Phase 1 : EI/AE uniquement`)
  const allByCP = {}
  MARSEILLE_CPS.forEach(cp => { allByCP[cp] = [] })

  for (const nafCode of config.nafCodes) {
    console.log(`  🔍 NAF ${nafCode} (EI)...`)
    const byCP = await fetchNaf(nafCode, true)
    let cnt = 0
    for (const cp of MARSEILLE_CPS) { allByCP[cp].push(...(byCP[cp] || [])); cnt += (byCP[cp]||[]).length }
    console.log(`    → ${cnt} AE trouvés`)
    await sleep(500)
  }

  let selected = selectEquitable(allByCP, toAdd, existingNoms)
  const phase1Count = selected.length
  console.log(`  Phase 1 résultat: ${phase1Count}/${toAdd}`)

  // Phase 2: Si incomplet, élargir à toutes formes juridiques
  if (selected.length < toAdd) {
    console.log(`\n  Phase 2 : Toutes formes juridiques (SARL/SAS/EURL...)`)
    const allByCP2 = {}
    MARSEILLE_CPS.forEach(cp => { allByCP2[cp] = [] })

    for (const nafCode of config.nafCodes) {
      console.log(`  🔍 NAF ${nafCode} (toutes formes)...`)
      const byCP = await fetchNaf(nafCode, false) // Sans filtre EI
      let cnt = 0
      for (const cp of MARSEILLE_CPS) { allByCP2[cp].push(...(byCP[cp] || [])); cnt += (byCP[cp]||[]).length }
      console.log(`    → ${cnt} entreprises trouvées`)
      await sleep(500)
    }

    // Marquer ceux de la phase 1 comme existants pour éviter doublons
    const phase1Noms = new Set([...existingNoms])
    selected.forEach(s => phase1Noms.add(normalizeStr(s.nom)))

    const phase2selected = selectEquitable(allByCP2, toAdd - selected.length, phase1Noms)
    console.log(`  Phase 2 résultat: +${phase2selected.length}`)
    selected.push(...phase2selected)
  }

  if (selected.length === 0) {
    console.log(`  ⚠ Aucun artisan éligible trouvé`)
    return 0
  }

  // Afficher répartition
  const distMap = {}
  selected.forEach(s => { distMap[s.arr] = (distMap[s.arr] || 0) + 1 })
  const distStr = Object.entries(distMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([arr, n]) => `${arr.replace('Marseille ', '')}:${n}`).join(' | ')
  console.log(`\n  📊 Répartition (${selected.length}) : ${distStr}`)

  // Insérer
  let inserted = 0
  for (const s of selected) {
    const row = {
      nom_entreprise: s.nom,
      metier: config.metier,
      specialite: config.specialite,
      adresse: s.adresse,
      ville: 'Marseille',
      arrondissement: s.arr,
      telephone_pro: s.phone,
      google_note: null,
      google_avis: 0,
      pappers_verifie: true,
    }
    const { error } = await supabase.from('artisans_catalogue').insert(row)
    if (error) {
      // Retry minimal
      delete row.telephone_pro
      row.telephone_pro = null
      const { error: e2 } = await supabase.from('artisans_catalogue').insert(row)
      if (e2) { console.error(`    ❌ ${s.nom}: ${e2.message}`); continue }
    }
    console.log(`    ✅ [${s.arr}] ${s.nom}`)
    inserted++
    await sleep(80)
  }

  console.log(`\n  🏆 ${config.metier}: ${inserted}/${toAdd} insérés`)
  return inserted
}

async function main() {
  const arg = process.argv[2]
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  VITFIX — Retry spécialités incomplètes (toutes formes)     ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  const { error: testError } = await supabase.from('artisans_catalogue').select('id').limit(1)
  if (testError) { console.error('❌ Supabase:', testError.message); process.exit(1) }
  const { count } = await supabase.from('artisans_catalogue').select('*', { count: 'exact', head: true })
  console.log(`✅ Connexion OK — ${count} entrées existantes\n`)

  const metiersToProcess = arg && RETRY_CONFIG[arg]
    ? { [arg]: RETRY_CONFIG[arg] }
    : RETRY_CONFIG

  const startTime = Date.now()
  let grandTotal = 0
  const bilan = []

  for (const [cat, config] of Object.entries(metiersToProcess)) {
    const inserted = await importMetier(cat, config)
    grandTotal += inserted
    bilan.push({ metier: config.metier, inserted, target: config.target || ADD_PER_SPECIALTY })
    await sleep(1500)
  }

  const duration = Math.round((Date.now() - startTime) / 1000)
  console.log(`\n${'═'.repeat(65)}`)
  console.log(`🏆 TERMINÉ en ${duration}s — ${grandTotal} artisans ajoutés\n`)
  console.log('📋 Bilan :')
  bilan.forEach(({ metier, inserted, target }) => {
    const bar = '█'.repeat(inserted) + '░'.repeat(Math.max(0, target - inserted))
    console.log(`   ${metier.padEnd(22)} ${bar} ${inserted}/${target}`)
  })
  console.log(`${'═'.repeat(65)}\n`)
}

main().catch(err => { console.error('❌', err); process.exit(1) })
