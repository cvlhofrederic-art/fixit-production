/**
 * import-artisans-marseille.mjs
 *
 * Importe des auto-entrepreneurs/micro-entreprises actifs de Marseille
 * dans la table artisans_catalogue via l'API officielle SIRENE (données publiques INSEE).
 *
 * Source : https://recherche-entreprises.api.gouv.fr (Open Data gouvernement français)
 * Filtres :
 *   - nature_juridique = 1000 (Entrepreneur Individuel / Auto-Entrepreneur / Micro-Entreprise)
 *   - etat_administratif = A (actif en exercice)
 *   - code_postal 13001–13016 (arrondissements de Marseille)
 *
 * Usage : node scripts/import-artisans-marseille.mjs [categorie]
 * Ex:    node scripts/import-artisans-marseille.mjs plomberie
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
const MARSEILLE_CPS = new Set(Object.keys(MARSEILLE_CP))

// ─── Mapping catégories → NAF codes + métier DB ───────────────────────────────
// Le `metier` doit correspondre exactement aux valeurs dans CATEGORY_TO_METIERS du frontend
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
  if (clean.length === 9 && clean.startsWith('6') || clean.startsWith('7')) {
    return '0' + clean.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d)/, '$1 $2 $3 $4 $5')
  }
  return phone.trim() || null
}

function normalizeStr(s) {
  if (!s) return ''
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

// ─── Formatage du nom entreprise ─────────────────────────────────────────────
function formatNomEntreprise(result) {
  // Priorité : nom_commercial > nom_complet > nom_raison_sociale
  const siege = result.siege || {}
  const nomCommercial = siege.nom_commercial || siege.liste_enseignes?.[0]
  if (nomCommercial) {
    return nomCommercial.charAt(0).toUpperCase() + nomCommercial.slice(1).toLowerCase()
  }
  const nom = result.nom_complet || result.nom_raison_sociale || ''
  // Transformer "NOM PRENOM" en "Nom Prenom" pour les EI
  return nom.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

// ─── Récupérer artisans Marseille pour un NAF code ───────────────────────────
async function fetchArtisansMarseille(nafCode) {
  const marseilleByCp = {} // { cp: [artisan, ...] }
  Object.keys(MARSEILLE_CP).forEach(cp => marseilleByCp[cp] = [])

  // Paginer jusqu'à avoir assez de résultats Marseille ou 10 pages max
  for (let page = 1; page <= 60; page++) {
    const url = new URL('https://recherche-entreprises.api.gouv.fr/search')
    url.searchParams.set('activite_principale', nafCode)
    url.searchParams.set('nature_juridique', '1000')  // EI/AE/ME uniquement
    url.searchParams.set('etat_administratif', 'A')   // Actif seulement
    url.searchParams.set('per_page', '25')
    url.searchParams.set('page', String(page))

    try {
      const res = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VITFIX-Import/1.0'
        }
      })
      if (!res.ok) {
        console.warn(`    ⚠ API ${res.status} page ${page}`)
        break
      }
      const data = await res.json()
      const results = data.results || []
      if (results.length === 0) break

      for (const r of results) {
        const cp = r.siege?.code_postal || ''
        if (MARSEILLE_CPS.has(cp)) {
          marseilleByCp[cp].push(r)
        }
      }

      // Vérifier si on a assez de résultats dans tous les arrondissements
      const totalCollected = Object.values(marseilleByCp).reduce((s, arr) => s + arr.length, 0)
      const arrondissementsPlein = Object.values(marseilleByCp).filter(arr => arr.length >= 25).length

      if (arrondissementsPlein >= 14 && totalCollected >= 350) break

      await sleep(250)
    } catch (e) {
      console.warn(`    ⚠ Erreur: ${e.message}`)
      break
    }
  }

  return marseilleByCp
}

// ─── Convertir un résultat SIRENE en ligne artisans_catalogue ─────────────────
function toArtisanRow(result, config, cp) {
  const siege = result.siege || {}
  const nom = formatNomEntreprise(result)
  if (!nom || nom.length < 2) return null

  const adresse = [
    siege.numero_voie,
    siege.indice_repetition,
    siege.type_voie,
    siege.libelle_voie,
  ].filter(Boolean).join(' ').trim()
    || siege.geo_adresse?.split(' ').slice(0, -2).join(' ')  // Enlever "CP Ville" de la fin
    || ''

  return {
    nom_entreprise: nom,
    metier: config.metier,
    specialite: config.specialite,
    adresse: adresse || null,
    ville: 'Marseille',
    arrondissement: MARSEILLE_CP[cp],
    telephone_pro: formatPhone(siege.telephone || siege.telephone_2 || null),
    google_note: null,
    google_avis: 0,
    pappers_verifie: true, // Vérifié : actif dans SIRENE (données officielles INSEE)
    // Champs supplémentaires pour traçabilité (si la table les accepte)
    _siret: siege.siret,
    _siren: result.siren,
    _naf: siege.activite_principale,
    _source_import: 'sirene_ae_marseille',
  }
}

// ─── Import d'un métier complet ───────────────────────────────────────────────
async function importMetier(categorie, config) {
  console.log(`\n${'═'.repeat(65)}`)
  console.log(`📦  MÉTIER : ${config.metier.toUpperCase()} (${categorie})`)
  console.log(`    NAF : ${config.nafCodes.join(', ')}`)
  console.log(`${'═'.repeat(65)}`)

  // Récupérer les entrées existantes pour dédoublonnage
  const { data: existing } = await supabase
    .from('artisans_catalogue')
    .select('nom_entreprise')
    .eq('metier', config.metier)
  const existingNoms = new Set((existing || []).map(r => normalizeStr(r.nom_entreprise)))
  console.log(`  ℹ ${existingNoms.size} artisans déjà en base pour ce métier`)

  let totalInserted = 0
  let totalSkipped = 0

  // Pour chaque code NAF du métier
  for (const nafCode of config.nafCodes) {
    console.log(`\n  🔍 Recherche NAF ${nafCode}...`)
    const byCP = await fetchArtisansMarseille(nafCode)

    const artisansParCp = Object.entries(byCP)
      .map(([cp, results]) => ({
        cp,
        arr: MARSEILLE_CP[cp],
        results: results.slice(0, 25), // Max 25 par arrondissement
      }))
      .filter(({ results }) => results.length > 0)

    if (artisansParCp.length === 0) {
      console.log(`    ℹ Aucun auto-entrepreneur Marseille trouvé pour NAF ${nafCode}`)
      continue
    }

    // Affichage du bilan par arrondissement
    const totalFound = artisansParCp.reduce((s, { results }) => s + results.length, 0)
    const arrCount = artisansParCp.length
    console.log(`    ✓ ${totalFound} AE trouvés dans ${arrCount} arrondissements`)

    // Insertion arrondissement par arrondissement
    for (const { cp, arr, results } of artisansParCp) {
      const toInsert = []

      for (const r of results) {
        const row = toArtisanRow(r, config, cp)
        if (!row) continue

        const normNom = normalizeStr(row.nom_entreprise)
        if (existingNoms.has(normNom)) {
          totalSkipped++
          continue
        }

        existingNoms.add(normNom)

        // Ne conserver que les colonnes connues de artisans_catalogue
        const { _siret, _siren, _naf, _source_import, ...safeRow } = row
        toInsert.push(safeRow)
      }

      if (toInsert.length === 0) continue

      const { error, data: inserted } = await supabase
        .from('artisans_catalogue')
        .insert(toInsert)
        .select('id, nom_entreprise, adresse')

      if (error) {
        console.error(`    ❌ ${arr}: ${error.message}`)

        // Réessai colonne par colonne en cas d'erreur de schéma
        for (const row of toInsert) {
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
            console.error(`      ❌ ${row.nom_entreprise}: ${e2.message}`)
          } else {
            console.log(`      ✅ ${arr}: ${row.nom_entreprise}`)
            totalInserted++
          }
          await sleep(100)
        }
      } else {
        totalInserted += (inserted || []).length
        for (const ins of (inserted || [])) {
          console.log(`    ✅ ${arr}: ${ins.nom_entreprise}${ins.adresse ? ' — ' + ins.adresse : ''}`)
        }
      }

      await sleep(150)
    }

    await sleep(500)
  }

  const bilan = `  📊 ${config.metier}: ${totalInserted} insérés, ${totalSkipped} doublons ignorés`
  console.log(`\n${bilan}`)
  return totalInserted
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const arg = process.argv[2]

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  VITFIX — Import artisans Marseille (API SIRENE Open Data)  ║')
  console.log('║  Filtre : Auto-entrepreneurs/Micro-entreprises actifs        ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()

  // Test connexion Supabase
  const { error: testError } = await supabase.from('artisans_catalogue').select('id').limit(1)
  if (testError) {
    console.error('❌ Connexion Supabase échouée:', testError.message)
    process.exit(1)
  }

  // Compter les entrées existantes
  const { count } = await supabase.from('artisans_catalogue').select('*', { count: 'exact', head: true })
  console.log(`✅ Connexion Supabase OK — ${count} entrées existantes dans artisans_catalogue\n`)

  const metiersToProcess = arg && METIERS_CONFIG[arg]
    ? { [arg]: METIERS_CONFIG[arg] }
    : METIERS_CONFIG

  if (arg && !METIERS_CONFIG[arg]) {
    console.error(`❌ Métier inconnu: "${arg}". Disponibles: ${Object.keys(METIERS_CONFIG).join(', ')}`)
    process.exit(1)
  }

  console.log(`🗺  Arrondissements cibles: Marseille 1er → 16ème (CP 13001–13016)`)
  console.log(`🏢  Métiers à traiter: ${Object.keys(metiersToProcess).join(', ')}\n`)

  const startTime = Date.now()
  let grandTotal = 0

  for (const [categorie, config] of Object.entries(metiersToProcess)) {
    const inserted = await importMetier(categorie, config)
    grandTotal += inserted
    await sleep(1000)
  }

  const duration = Math.round((Date.now() - startTime) / 1000)
  console.log(`\n${'═'.repeat(65)}`)
  console.log(`🏆 TERMINÉ en ${duration}s — ${grandTotal} artisans ajoutés à artisans_catalogue`)
  console.log(`${'═'.repeat(65)}\n`)
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err)
  process.exit(1)
})
