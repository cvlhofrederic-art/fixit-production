/**
 * import-artisans-petites-villes.mjs
 *
 * Importe des artisans actifs pour les petites villes autour de Marseille
 * via l'API officielle SIRENE / recherche-entreprises.api.gouv.fr (Open Data INSEE).
 *
 * Vérification activité : etat_administratif = A (actif — même source que Pappers)
 * Filtre : tous statuts juridiques (EI, SARL, SAS, etc.)
 * Quota : 10 artisans par ville × par corps de métier
 *
 * Usage :
 *   node scripts/import-artisans-petites-villes.mjs            → toutes villes, tous métiers
 *   node scripts/import-artisans-petites-villes.mjs plomberie  → un seul métier
 *   node scripts/import-artisans-petites-villes.mjs - la-ciotat → toutes métiers, une seule ville
 */

import { createClient } from '@supabase/supabase-js'

// ─── Config Supabase ───────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Villes cibles ─────────────────────────────────────────────────────────────
// slug → { nom, cp, commune (pour filtrage si plusieurs communes partagent le CP) }
const VILLES = {
  'la-ciotat':         { nom: 'La Ciotat',          cp: '13600', commune: 'LA CIOTAT' },
  'aubagne':           { nom: 'Aubagne',             cp: '13400', commune: 'AUBAGNE' },
  'cassis':            { nom: 'Cassis',              cp: '13260', commune: 'CASSIS' },
  'gemenos':           { nom: 'Gémenos',             cp: '13420', commune: 'GEMENOS' },
  'ceyreste':          { nom: 'Ceyreste',            cp: '13600', commune: 'CEYRESTE' },
  'la-bedoule':        { nom: 'Roquefort-la-Bédoule', cp: '13830', commune: 'ROQUEFORT LA BEDOULE' },
  'cuges-les-pins':    { nom: 'Cuges-les-Pins',      cp: '13780', commune: 'CUGES LES PINS' },
  'saint-cyr-sur-mer': { nom: 'Saint-Cyr-sur-Mer',  cp: '83270', commune: 'SAINT CYR SUR MER' },
  'bandol':            { nom: 'Bandol',              cp: '83150', commune: 'BANDOL' },
  'sanary-sur-mer':    { nom: 'Sanary-sur-Mer',      cp: '83110', commune: 'SANARY SUR MER' },
  'six-fours':         { nom: 'Six-Fours-les-Plages', cp: '83140', commune: 'SIX FOURS LES PLAGES' },
  'martigues':         { nom: 'Martigues',           cp: '13500', commune: 'MARTIGUES' },
  'allauch':           { nom: 'Allauch',             cp: '13190', commune: 'ALLAUCH' },
  'plan-de-cuques':    { nom: 'Plan-de-Cuques',      cp: '13380', commune: 'PLAN DE CUQUES' },
  'gardanne':          { nom: 'Gardanne',            cp: '13120', commune: 'GARDANNE' },
  'salon-de-provence': { nom: 'Salon-de-Provence',  cp: '13300', commune: 'SALON DE PROVENCE' },
  'la-seyne-sur-mer':  { nom: 'La Seyne-sur-Mer',   cp: '83500', commune: 'LA SEYNE SUR MER' },
  'hyeres':            { nom: 'Hyères',              cp: '83400', commune: 'HYERES' },
  'la-valette-du-var': { nom: 'La Valette-du-Var',  cp: '83160', commune: 'LA VALETTE DU VAR' },

  // ── Marseille arrondissements ─────────────────────────────────────────────
  'marseille-1':  { nom: 'Marseille 1er',   cp: '13001', commune: 'MARSEILLE' },
  'marseille-2':  { nom: 'Marseille 2ème',  cp: '13002', commune: 'MARSEILLE' },
  'marseille-3':  { nom: 'Marseille 3ème',  cp: '13003', commune: 'MARSEILLE' },
  'marseille-4':  { nom: 'Marseille 4ème',  cp: '13004', commune: 'MARSEILLE' },
  'marseille-5':  { nom: 'Marseille 5ème',  cp: '13005', commune: 'MARSEILLE' },
  'marseille-6':  { nom: 'Marseille 6ème',  cp: '13006', commune: 'MARSEILLE' },
  'marseille-7':  { nom: 'Marseille 7ème',  cp: '13007', commune: 'MARSEILLE' },
  'marseille-8':  { nom: 'Marseille 8ème',  cp: '13008', commune: 'MARSEILLE' },
  'marseille-9':  { nom: 'Marseille 9ème',  cp: '13009', commune: 'MARSEILLE' },
  'marseille-10': { nom: 'Marseille 10ème', cp: '13010', commune: 'MARSEILLE' },
  'marseille-11': { nom: 'Marseille 11ème', cp: '13011', commune: 'MARSEILLE' },
  'marseille-12': { nom: 'Marseille 12ème', cp: '13012', commune: 'MARSEILLE' },
  'marseille-13': { nom: 'Marseille 13ème', cp: '13013', commune: 'MARSEILLE' },
  'marseille-14': { nom: 'Marseille 14ème', cp: '13014', commune: 'MARSEILLE' },
  'marseille-15': { nom: 'Marseille 15ème', cp: '13015', commune: 'MARSEILLE' },
  'marseille-16': { nom: 'Marseille 16ème', cp: '13016', commune: 'MARSEILLE' },
}

// ─── Mapping corps de métier → NAF + libellé DB ───────────────────────────────
const METIERS_CONFIG = {
  plomberie: {
    metier: 'Plombier',
    specialite: 'Plomberie, dépannage, installation sanitaire, débouchage, réparation',
    nafCodes: ['43.22A'],
  },
  electricite: {
    metier: 'Électricien',
    specialite: 'Électricité, installations, dépannage, mise aux normes, tableau électrique',
    nafCodes: ['43.21A', '43.21B'],
  },
  serrurerie: {
    metier: 'Serrurier',
    specialite: 'Serrurerie, ouverture de porte claquée, changement serrure, blindage, urgence 24h',
    nafCodes: ['43.29A', '43.29B', '25.62A'],
  },
  peinture: {
    metier: 'Peintre',
    specialite: 'Peinture intérieure et extérieure, décoration, ravalement de façade',
    nafCodes: ['43.34Z'],
  },
  plaquisterie: {
    metier: 'Plaquiste',
    specialite: 'Plaquisterie, isolation, cloisons, faux plafonds, doublage',
    nafCodes: ['43.31Z'],
  },
  'espaces-verts': {
    metier: 'Paysagiste',
    specialite: 'Espaces verts, paysagisme, jardinage, taille, tonte, arrosage, débroussaillage',
    nafCodes: ['81.30Z', '01.42Z'],
  },
  nettoyage: {
    metier: 'Nettoyage',
    specialite: 'Nettoyage courant de locaux, nettoyage industriel, entretien copropriété',
    nafCodes: ['81.21Z', '81.22Z'],
  },
  toiture: {
    metier: 'Couvreur',
    specialite: 'Toiture, couverture, zinguerie, étanchéité, réparation de toit',
    nafCodes: ['43.91A', '43.91B'],
  },
  climatisation: {
    metier: 'Climatisation',
    specialite: 'Climatisation réversible, pompe à chaleur, installation et maintenance',
    nafCodes: ['43.22B'],
  },
  carrelage: {
    metier: 'Carreleur',
    specialite: 'Carrelage, faïence, revêtement de sols et murs, salle de bain',
    nafCodes: ['43.33Z'],
  },
  maconnerie: {
    metier: 'Maçon',
    specialite: 'Maçonnerie, gros œuvre, rénovation, carrelage, enduits, dalles',
    nafCodes: ['43.99A', '43.99B', '43.99C', '41.20A'],
  },
  vitrerie: {
    metier: 'Vitrier',
    specialite: 'Vitrerie, double vitrage, miroirs, remplacement et pose de vitres',
    nafCodes: ['43.34Z', '23.12Z'],
  },
  menuiserie: {
    metier: 'Menuisier',
    specialite: 'Menuiserie bois et PVC, fenêtres, portes, volets, parquet, portails',
    nafCodes: ['43.32A', '43.32B', '43.32C'],
  },
  debouchage: {
    metier: 'Débouchage',
    specialite: 'Débouchage canalisation, hydrocurage, inspection caméra, assainissement',
    nafCodes: ['43.22A', '43.29B'],
  },
  demenagement: {
    metier: 'Déménageur',
    specialite: 'Déménagement, transport de meubles, emballage, garde-meubles, vide-maison',
    nafCodes: ['49.41B', '52.29A'],
  },
  chauffage: {
    metier: 'Chauffagiste',
    specialite: 'Chauffage, chaudières, radiateurs, pompe à chaleur, entretien annuel',
    nafCodes: ['43.22B'],
  },
}

const MAX_PAR_VILLE = 10

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

// ─── Fetch artisans pour une ville + un code NAF ──────────────────────────────
async function fetchArtisansVille(nafCode, ville) {
  const collected = []

  for (let page = 1; page <= 20; page++) {
    if (collected.length >= MAX_PAR_VILLE * 3) break  // buffer suffisant

    const url = new URL('https://recherche-entreprises.api.gouv.fr/search')
    url.searchParams.set('activite_principale', nafCode)
    url.searchParams.set('code_postal', ville.cp)
    url.searchParams.set('etat_administratif', 'A')  // Actif seulement (= pappers actif)
    url.searchParams.set('per_page', '25')
    url.searchParams.set('page', String(page))

    try {
      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json', 'User-Agent': 'VITFIX-Import/1.0' }
      })
      if (!res.ok) break

      const data = await res.json()
      const results = data.results || []
      if (results.length === 0) break

      for (const r of results) {
        // Normalise : supprime accents + tirets + espaces pour comparaison robuste
        const norm = s => s.toUpperCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[-\s]/g, '')
        const siegeCommune = norm(r.siege?.libelle_commune || '')
        const targetCommune = norm(ville.commune)

        // Si plusieurs communes partagent le CP, filtrer par commune
        if (siegeCommune && targetCommune && !siegeCommune.includes(targetCommune) && !targetCommune.includes(siegeCommune)) {
          continue
        }
        collected.push(r)
      }

      if ((data.total_results || 0) <= page * 25) break
      await sleep(200)
    } catch (e) {
      console.warn(`      ⚠ ${e.message}`)
      break
    }
  }

  return collected
}

// ─── Import ville × métier ────────────────────────────────────────────────────
async function importVilleMetier(villeSlug, ville, categorie, config, existingNoms) {
  let inserted = 0

  for (const nafCode of config.nafCodes) {
    if (inserted >= MAX_PAR_VILLE) break

    const results = await fetchArtisansVille(nafCode, ville)
    if (results.length === 0) continue

    const toInsert = []
    for (const r of results) {
      if (inserted + toInsert.length >= MAX_PAR_VILLE) break

      const siege = r.siege || {}
      const nom = formatNomEntreprise(r)
      if (!nom || nom.length < 2) continue

      const normNom = normalizeStr(nom)
      const key = `${config.metier}|${normNom}`
      if (existingNoms.has(key)) continue

      const adresse = [
        siege.numero_voie,
        siege.indice_repetition,
        siege.type_voie,
        siege.libelle_voie,
      ].filter(Boolean).join(' ').trim() || null

      toInsert.push({
        nom_entreprise: nom,
        metier: config.metier,
        specialite: config.specialite,
        adresse: adresse,
        ville: ville.nom,
        arrondissement: null,
        telephone_pro: formatPhone(siege.telephone || siege.telephone_2 || null),
        google_note: null,
        google_avis: 0,
        pappers_verifie: true,  // Vérifié actif via SIRENE (source officielle Pappers)
      })
      existingNoms.add(key)
    }

    if (toInsert.length === 0) continue

    const { error, data: ins } = await supabase
      .from('artisans_catalogue')
      .insert(toInsert)
      .select('id, nom_entreprise')

    if (error) {
      // Tentative minimale ligne par ligne
      for (const row of toInsert) {
        const { error: e2 } = await supabase.from('artisans_catalogue').insert(row)
        if (!e2) {
          console.log(`      ✅ ${row.nom_entreprise}`)
          inserted++
        }
        await sleep(80)
      }
    } else {
      inserted += (ins || []).length
      for (const i of (ins || [])) {
        console.log(`      ✅ ${i.nom_entreprise}`)
      }
    }

    await sleep(200)
  }

  return inserted
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const arg1 = process.argv[2]  // métier ou '-'
  const arg2 = process.argv[3]  // ville slug

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  VITFIX — Import artisans petites villes PACA               ║')
  console.log('║  Source : API SIRENE (Open Data INSEE) — même base Pappers  ║')
  console.log('║  Quota : 10 artisans actifs / ville / corps de métier       ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')

  // Test connexion
  const { error: testError, count } = await supabase
    .from('artisans_catalogue')
    .select('*', { count: 'exact', head: true })
  if (testError) {
    console.error('❌ Connexion Supabase échouée:', testError.message)
    process.exit(1)
  }
  console.log(`\n✅ Connexion Supabase OK — ${count} entrées existantes\n`)

  // Charger tous les noms existants pour dédoublonnage
  console.log('📥 Chargement des noms existants pour dédoublonnage...')
  const { data: existing } = await supabase
    .from('artisans_catalogue')
    .select('nom_entreprise, metier')
  const existingNoms = new Set(
    (existing || []).map(r => `${r.metier}|${normalizeStr(r.nom_entreprise)}`)
  )
  console.log(`  ${existingNoms.size} artisans déjà en base (toutes villes)\n`)

  // Sélection villes et métiers
  const villesTarget = arg2 && VILLES[arg2]
    ? { [arg2]: VILLES[arg2] }
    : VILLES

  const metiersTarget = arg1 && arg1 !== '-' && METIERS_CONFIG[arg1]
    ? { [arg1]: METIERS_CONFIG[arg1] }
    : METIERS_CONFIG

  if (arg1 && arg1 !== '-' && !METIERS_CONFIG[arg1]) {
    console.error(`❌ Métier inconnu: "${arg1}". Disponibles: ${Object.keys(METIERS_CONFIG).join(', ')}`)
    process.exit(1)
  }
  if (arg2 && !VILLES[arg2]) {
    console.error(`❌ Ville inconnue: "${arg2}". Disponibles: ${Object.keys(VILLES).join(', ')}`)
    process.exit(1)
  }

  console.log(`🗺  Villes: ${Object.keys(villesTarget).join(', ')}`)
  console.log(`🔧 Métiers: ${Object.keys(metiersTarget).join(', ')}\n`)

  const startTime = Date.now()
  let grandTotal = 0

  for (const [villeSlug, ville] of Object.entries(villesTarget)) {
    console.log(`\n${'═'.repeat(65)}`)
    console.log(`📍 VILLE : ${ville.nom.toUpperCase()} (${ville.cp})`)
    console.log(`${'═'.repeat(65)}`)

    let villeTotal = 0
    for (const [categorie, config] of Object.entries(metiersTarget)) {
      console.log(`\n  🔧 ${config.metier}...`)
      const n = await importVilleMetier(villeSlug, ville, categorie, config, existingNoms)
      if (n === 0) {
        console.log(`     (aucun artisan actif trouvé à ${ville.nom} pour ce métier)`)
      } else {
        console.log(`     → ${n} insérés`)
      }
      villeTotal += n
      await sleep(300)
    }

    console.log(`\n  📊 ${ville.nom} : ${villeTotal} artisans ajoutés`)
    grandTotal += villeTotal
    await sleep(500)
  }

  const duration = Math.round((Date.now() - startTime) / 1000)
  console.log(`\n${'═'.repeat(65)}`)
  console.log(`🏆 TERMINÉ en ${duration}s — ${grandTotal} artisans ajoutés au total`)
  console.log(`${'═'.repeat(65)}\n`)
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err)
  process.exit(1)
})
