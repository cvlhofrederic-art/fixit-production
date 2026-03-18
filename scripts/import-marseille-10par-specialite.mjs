/**
 * import-marseille-10par-specialite.mjs
 *
 * Importe exactement 10 artisans actifs par spécialité Vitfix dans Marseille,
 * répartis le plus équitablement possible sur les 16 arrondissements.
 *
 * Source : https://recherche-entreprises.api.gouv.fr (Open Data INSEE/SIRENE)
 * Vérification activité : etat_administratif=A (actif) = équivalent Pappers actif
 * Filtres :
 *   - nature_juridique = 1000 (EI / Auto-Entrepreneur / Micro-Entreprise)
 *   - etat_administratif = A (actif)
 *   - CP 13001–13016 (Marseille)
 *
 * Usage : node scripts/import-marseille-10par-specialite.mjs [categorie]
 * Ex:    node scripts/import-marseille-10par-specialite.mjs plomberie
 *        node scripts/import-marseille-10par-specialite.mjs   (toutes les spécialités)
 */

import { createClient } from '@supabase/supabase-js'

// ─── Config Supabase ───────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Codes postaux Marseille avec arrondissements ──────────────────────────────
const MARSEILLE_CP = {
  '13001': 'Marseille 1er',
  '13002': 'Marseille 2ème',
  '13003': 'Marseille 3ème',
  '13004': 'Marseille 4ème',
  '13005': 'Marseille 5ème',
  '13006': 'Marseille 6ème',
  '13007': 'Marseille 7ème',
  '13008': 'Marseille 8ème',
  '13009': 'Marseille 9ème',
  '13010': 'Marseille 10ème',
  '13011': 'Marseille 11ème',
  '13012': 'Marseille 12ème',
  '13013': 'Marseille 13ème',
  '13014': 'Marseille 14ème',
  '13015': 'Marseille 15ème',
  '13016': 'Marseille 16ème',
}
const MARSEILLE_CPS = Object.keys(MARSEILLE_CP)

// ─── Objectif ─────────────────────────────────────────────────────────────────
const ARTISANS_PAR_SPECIALITE = 10

// ─── Mapping catégories → NAF codes + métier DB ───────────────────────────────
const METIERS_CONFIG = {
  plomberie: {
    metier: 'Plombier',
    specialite: 'Plomberie, dépannage, installation sanitaire, débouchage, réparation',
    nafCodes: ['43.22A'],
  },
  electricite: {
    metier: 'Électricien',
    specialite: 'Électricité, installations, dépannages, mises aux normes électriques',
    nafCodes: ['43.21A', '43.21B'],
  },
  serrurerie: {
    metier: 'Serrurier',
    specialite: 'Serrurerie, ouverture de portes claquées, blindage, dépannage 24h/24',
    nafCodes: ['43.29A', '43.29B', '25.62A'],
  },
  chauffage: {
    metier: 'Chauffagiste',
    specialite: 'Chauffage, chaudières, radiateurs, pompe à chaleur, entretien',
    nafCodes: ['43.22B'],
  },
  climatisation: {
    metier: 'Climatisation',
    specialite: 'Climatisation réversible, pompe à chaleur, installation et maintenance',
    nafCodes: ['43.22B', '43.29A'],
  },
  peinture: {
    metier: 'Peintre',
    specialite: 'Peinture intérieure et extérieure, décoration, ravalement de façade',
    nafCodes: ['43.34Z'],
  },
  maconnerie: {
    metier: 'Maçon',
    specialite: 'Maçonnerie, gros œuvre, rénovation, carrelage, enduits, dalles',
    nafCodes: ['43.99A', '43.99B', '43.99C', '41.20A'],
  },
  menuiserie: {
    metier: 'Menuisier',
    specialite: 'Menuiserie bois et PVC, fenêtres, portes, volets, parquet',
    nafCodes: ['43.32A', '43.32B', '43.32C'],
  },
  carrelage: {
    metier: 'Carreleur',
    specialite: 'Carrelage, faïence, revêtement de sols et murs, salle de bain',
    nafCodes: ['43.33Z'],
  },
  toiture: {
    metier: 'Couvreur',
    specialite: 'Toiture, couverture, zinguerie, étanchéité, réparation de toit',
    nafCodes: ['43.91A', '43.91B'],
  },
  'espaces-verts': {
    metier: 'Paysagiste',
    specialite: 'Espaces verts, jardinage, taille de haies, tonte, aménagement paysager',
    nafCodes: ['81.30Z', '01.42Z'],
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
  renovation: {
    metier: 'Rénovation',
    specialite: 'Rénovation, travaux tous corps d\'état, second œuvre, petits travaux',
    nafCodes: ['41.20A', '41.20B', '43.91B'],
  },
  vitrerie: {
    metier: 'Vitrier',
    specialite: 'Vitrerie, double vitrage, miroirs, remplacement et pose de vitres',
    nafCodes: ['43.34Z', '23.12Z'],
  },
  'traitement-nuisibles': {
    metier: 'Traitement nuisibles',
    specialite: 'Dératisation, désinsectisation, désinfection, traitement 3D nuisibles',
    nafCodes: ['81.29A'],
  },
  'petits-travaux': {
    metier: 'Petits travaux',
    specialite: 'Petits travaux, bricolage, montage meubles, réparations diverses à domicile',
    nafCodes: ['43.29B', '43.99D'],
  },
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatPhone(phone) {
  if (!phone) return null
  const clean = String(phone).replace(/\D/g, '')
  if (clean.length === 10) {
    return clean.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')
  }
  return phone.trim() || null
}

function normalizeStr(s) {
  if (!s) return ''
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function formatNomEntreprise(result) {
  const siege = result.siege || {}
  const nomCommercial = siege.nom_commercial || siege.liste_enseignes?.[0]
  if (nomCommercial) {
    return nomCommercial.charAt(0).toUpperCase() + nomCommercial.slice(1).toLowerCase()
  }
  const nom = result.nom_complet || result.nom_raison_sociale || ''
  return nom.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

// ─── Fetch artisans Marseille pour un NAF code (toutes pages) ─────────────────
async function fetchAllForNaf(nafCode) {
  // Résultats groupés par CP
  const byCP = {}
  MARSEILLE_CPS.forEach(cp => { byCP[cp] = [] })

  for (let page = 1; page <= 80; page++) {
    const url = new URL('https://recherche-entreprises.api.gouv.fr/search')
    url.searchParams.set('activite_principale', nafCode)
    url.searchParams.set('nature_juridique', '1000') // EI/AE/ME
    url.searchParams.set('etat_administratif', 'A')  // Actif
    url.searchParams.set('per_page', '25')
    url.searchParams.set('page', String(page))

    try {
      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json', 'User-Agent': 'VITFIX-Import/2.0' }
      })
      if (!res.ok) { console.warn(`    ⚠ API ${res.status} page ${page}`); break }
      const data = await res.json()
      const results = data.results || []
      if (results.length === 0) break

      for (const r of results) {
        const cp = r.siege?.code_postal || ''
        if (byCP[cp]) byCP[cp].push(r)
      }

      // Stop si on a au moins 5 artisans dans la majorité des arrondissements
      const populated = Object.values(byCP).filter(arr => arr.length >= 3).length
      const total = Object.values(byCP).reduce((s, a) => s + a.length, 0)
      if (populated >= 12 && total >= 150) break

      await sleep(200)
    } catch (e) {
      console.warn(`    ⚠ Erreur page ${page}: ${e.message}`)
      break
    }
  }

  return byCP
}

// ─── Sélectionner 10 artisans équitablement répartis sur 16 arrondissements ───
function selectEquitable(byCP, count, existingNoms, config) {
  // Construire pool par arrondissement (candidats valides + non dupliqués)
  const pools = {}
  for (const cp of MARSEILLE_CPS) {
    pools[cp] = (byCP[cp] || []).filter(r => {
      const siege = r.siege || {}
      const nom = formatNomEntreprise(r)
      if (!nom || nom.length < 2) return false
      if (existingNoms.has(normalizeStr(nom))) return false
      return true
    })
  }

  const selected = [] // { row, cp, arr }
  const usedNoms = new Set()

  // Rotation round-robin sur les arrondissements (en partant de ceux qui ont le plus)
  // Trier les CP par nombre de candidats (desc) pour maximiser les chances
  const cpSorted = MARSEILLE_CPS
    .filter(cp => pools[cp].length > 0)
    .sort((a, b) => pools[b].length - pools[a].length)

  let round = 0
  while (selected.length < count && cpSorted.some(cp => pools[cp].length > 0)) {
    // Cycler sur les CPs disponibles
    for (const cp of cpSorted) {
      if (selected.length >= count) break
      if (pools[cp].length === 0) continue

      // Prendre le premier candidat disponible
      const r = pools[cp].shift()
      const nom = formatNomEntreprise(r)
      const normNom = normalizeStr(nom)

      if (usedNoms.has(normNom) || existingNoms.has(normNom)) continue

      const siege = r.siege || {}
      const adresse = [
        siege.numero_voie,
        siege.indice_repetition,
        siege.type_voie,
        siege.libelle_voie,
      ].filter(Boolean).join(' ').trim() || siege.geo_adresse?.split(' ').slice(0, -2).join(' ') || ''

      selected.push({
        row: {
          nom_entreprise: nom,
          metier: config.metier,
          specialite: config.specialite,
          adresse: adresse || null,
          ville: 'Marseille',
          arrondissement: MARSEILLE_CP[cp],
          telephone_pro: formatPhone(siege.telephone || siege.telephone_2 || null),
          google_note: null,
          google_avis: 0,
          pappers_verifie: true, // Vérifié actif via SIRENE (source officielle Pappers)
        },
        cp,
        arr: MARSEILLE_CP[cp],
        nom,
      })
      usedNoms.add(normNom)
    }
    round++
    if (round > 20) break // Sécurité
  }

  return selected
}

// ─── Import d'un métier complet ───────────────────────────────────────────────
async function importMetier(categorie, config) {
  console.log(`\n${'═'.repeat(65)}`)
  console.log(`📦  ${config.metier.toUpperCase()} — objectif: ${ARTISANS_PAR_SPECIALITE} artisans`)
  console.log(`    NAF : ${config.nafCodes.join(', ')}`)
  console.log(`${'═'.repeat(65)}`)

  // Récupérer les noms déjà en base pour dédoublonnage
  const { data: existing } = await supabase
    .from('artisans_catalogue')
    .select('nom_entreprise, arrondissement')
    .eq('metier', config.metier)
  const existingNoms = new Set((existing || []).map(r => normalizeStr(r.nom_entreprise)))

  // Compter par arrondissement déjà en base
  const existingByArr = {}
  ;(existing || []).forEach(r => {
    const arr = r.arrondissement || 'Inconnu'
    existingByArr[arr] = (existingByArr[arr] || 0) + 1
  })

  const alreadyTotal = existingNoms.size
  console.log(`  ℹ ${alreadyTotal} artisans déjà en base pour ${config.metier}`)
  if (Object.keys(existingByArr).length > 0) {
    const dist = Object.entries(existingByArr).map(([arr, n]) => `${arr.replace('Marseille ', '')}:${n}`).join(' | ')
    console.log(`    Distribution existante: ${dist}`)
  }

  // Toujours ajouter 10 nouveaux artisans (en plus de ceux existants)
  const toAdd = ARTISANS_PAR_SPECIALITE
  console.log(`  🎯 À ajouter: ${toAdd} nouveaux artisans répartis sur les arrondissements`)

  // Collecter les données pour tous les codes NAF
  const allByCP = {}
  MARSEILLE_CPS.forEach(cp => { allByCP[cp] = [] })

  for (const nafCode of config.nafCodes) {
    console.log(`\n  🔍 Recherche NAF ${nafCode}...`)
    const byCP = await fetchAllForNaf(nafCode)
    let nafCount = 0
    for (const cp of MARSEILLE_CPS) {
      allByCP[cp].push(...(byCP[cp] || []))
      nafCount += (byCP[cp] || []).length
    }
    const totalFound = Object.values(byCP).reduce((s, a) => s + a.length, 0)
    const cpCount = Object.values(byCP).filter(a => a.length > 0).length
    console.log(`    ✓ ${totalFound} AE actifs trouvés dans ${cpCount}/16 arrondissements`)
    await sleep(400)
  }

  // Sélectionner équitablement
  const selected = selectEquitable(allByCP, toAdd, existingNoms, config)

  if (selected.length === 0) {
    console.log(`  ⚠ Aucun artisan éligible trouvé pour ${config.metier}`)
    return 0
  }

  // Afficher la répartition prévue
  const distMap = {}
  selected.forEach(({ arr }) => { distMap[arr] = (distMap[arr] || 0) + 1 })
  const distStr = Object.entries(distMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([arr, n]) => `${arr.replace('Marseille ', '')}:${n}`)
    .join(' | ')
  console.log(`\n  📊 Répartition sélectionnée (${selected.length} artisans) :`)
  console.log(`     ${distStr}`)

  // Insérer en base
  let inserted = 0
  for (const { row, arr, nom } of selected) {
    const { error } = await supabase.from('artisans_catalogue').insert(row)
    if (error) {
      // Retry minimal
      const minimal = {
        nom_entreprise: row.nom_entreprise,
        metier: row.metier,
        specialite: row.specialite,
        adresse: row.adresse,
        ville: row.ville,
        arrondissement: row.arrondissement,
        telephone_pro: row.telephone_pro,
        google_note: null,
        google_avis: 0,
        pappers_verifie: true,
      }
      const { error: e2 } = await supabase.from('artisans_catalogue').insert(minimal)
      if (e2) {
        console.error(`    ❌ ${nom}: ${e2.message}`)
      } else {
        console.log(`    ✅ [${arr}] ${nom}`)
        inserted++
      }
    } else {
      console.log(`    ✅ [${arr}] ${nom}`)
      inserted++
    }
    await sleep(100)
  }

  console.log(`\n  🏆 ${config.metier}: ${inserted}/${toAdd} insérés (total visé: ${ARTISANS_PAR_SPECIALITE})`)
  return inserted
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const arg = process.argv[2]

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  VITFIX — Import Marseille : 10 artisans / spécialité       ║')
  console.log('║  Répartition équitable sur les 16 arrondissements           ║')
  console.log('║  Source : SIRENE Open Data (= Pappers actif)                ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()

  const { error: testError } = await supabase.from('artisans_catalogue').select('id').limit(1)
  if (testError) {
    console.error('❌ Connexion Supabase échouée:', testError.message)
    process.exit(1)
  }

  const { count } = await supabase.from('artisans_catalogue').select('*', { count: 'exact', head: true })
  console.log(`✅ Connexion Supabase OK — ${count} entrées existantes dans artisans_catalogue`)
  console.log(`🎯 Objectif: ${ARTISANS_PAR_SPECIALITE} artisans par spécialité, répartis sur 16 arrondissements`)
  console.log()

  if (arg && !METIERS_CONFIG[arg]) {
    console.error(`❌ Métier inconnu: "${arg}". Disponibles: ${Object.keys(METIERS_CONFIG).join(', ')}`)
    process.exit(1)
  }

  const metiersToProcess = arg && METIERS_CONFIG[arg]
    ? { [arg]: METIERS_CONFIG[arg] }
    : METIERS_CONFIG

  const nbMetiers = Object.keys(metiersToProcess).length
  console.log(`🗺  ${nbMetiers} spécialité(s) à traiter : ${Object.keys(metiersToProcess).join(', ')}\n`)

  const startTime = Date.now()
  let grandTotal = 0
  const bilan = []

  for (const [categorie, config] of Object.entries(metiersToProcess)) {
    const inserted = await importMetier(categorie, config)
    grandTotal += inserted
    bilan.push({ categorie, metier: config.metier, inserted })
    await sleep(800)
  }

  const duration = Math.round((Date.now() - startTime) / 1000)
  console.log(`\n${'═'.repeat(65)}`)
  console.log(`🏆 TERMINÉ en ${duration}s — ${grandTotal} artisans ajoutés`)
  console.log()
  console.log('📋 Bilan par spécialité :')
  bilan.forEach(({ metier, inserted }) => {
    const bar = '█'.repeat(inserted) + '░'.repeat(Math.max(0, ARTISANS_PAR_SPECIALITE - inserted))
    console.log(`   ${metier.padEnd(22)} ${bar} ${inserted}/${ARTISANS_PAR_SPECIALITE}`)
  })
  console.log(`${'═'.repeat(65)}\n`)
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err)
  process.exit(1)
})
