/**
 * import-artisans-PT-habitissimo.mjs
 *
 * Importe les artisans PT enrichis depuis data/artisans-PT-enriched.json
 * dans la table profiles_artisan de Supabase.
 *
 * Règles :
 *   - score ≥ 4 : import direct (active: false, verified: false)
 *   - score 2-3 : import avec tag "a_verifier: true"
 *   - score < 2 : ignoré
 *
 * Usage :
 *   node scripts/import-artisans-PT-habitissimo.mjs            → tous (score ≥ 2)
 *   node scripts/import-artisans-PT-habitissimo.mjs --dry-run  → aperçu sans insertion
 *   node scripts/import-artisans-PT-habitissimo.mjs --min 4    → seulement score ≥ 4
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INPUT_FILE = path.join(__dirname, '../data/artisans-PT-final.json')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const DRY_RUN = process.argv.includes('--dry-run')
const MIN_SCORE = parseInt(process.argv.find(a => a.startsWith('--min'))?.split('=')[1] || '2')

// ── Mapping categories Vitfix → specialites_ids Supabase ────────────────────
// Adapter selon les vraies valeurs dans la BD
const CATEGORY_MAP = {
  'eletricista':        ['eletricidade'],
  'canalizador':        ['canalizacao'],
  'pintor':             ['pintura'],
  'pladur':             ['pladur', 'drywall'],
  'obras-remodelacao':  ['remodelacao', 'obras'],
  'isolamento-termico': ['isolamento'],
  'impermeabilizacao':  ['impermeabilizacao'],
  'desentupimento':     ['desentupimento', 'canalizacao'],
  'serralheiro':        ['serralharia'],
  'telhador':           ['telhado', 'cobertura'],
  'vidraceiro':         ['vidracaria'],
  'azulejador':         ['azulejos', 'ladrilhamento'],
  'pedreiro':           ['alvenaria', 'construcao'],
  'ar-condicionado':    ['climatizacao', 'ar-condicionado'],
  'carpinteiro':        ['carpintaria'],
  'faz-tudo':           ['manutencao', 'reparacoes'],
}

function buildCategories(cats) {
  const result = new Set()
  for (const cat of cats) {
    const mapped = CATEGORY_MAP[cat] || [cat]
    mapped.forEach(c => result.add(c))
  }
  return [...result]
}

// ── Prépare un enregistrement pour Supabase ─────────────────────────────────
function toSupabaseRecord(profile) {
  return {
    // Identité
    company_name: profile.company_name,
    bio: profile.bio || null,

    // Contact
    phone: profile.phone || null,
    email: profile.email || null,
    company_address: profile.company_address || null,
    company_city: profile.city || null,

    // Localisation
    language: profile.language || 'pt',

    // Catégories
    categories: buildCategories(profile.categories || []),

    // Évaluations
    rating_avg: profile.rating_avg || null,
    rating_count: profile.rating_count || 0,

    // Statut (toujours inactif jusqu'à vérification manuelle)
    active: false,
    verified: false,
    profile_photo_url: null,
  }
}

// ── Import principal ─────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Fichier introuvable : ${INPUT_FILE}`)
    console.error('   Exécuter d\'abord : node scripts/enrich-artisans-PT-habitissimo.mjs')
    process.exit(1)
  }

  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'))
  const eligible = data.profiles.filter(p => (p._score || 0) >= MIN_SCORE)

  console.log(`\n🇵🇹 Import artisans PT — Habitissimo → Supabase`)
  console.log(`   Mode : ${DRY_RUN ? 'DRY RUN (pas d\'insertion)' : 'RÉEL'}`)
  console.log(`   Score minimum : ${MIN_SCORE}`)
  console.log(`   Profils éligibles : ${eligible.length} / ${data.profiles.length}\n`)

  if (eligible.length === 0) {
    console.log('Aucun profil à importer. Essayer --min 1 ou relancer l\'enrichissement.')
    return
  }

  let inserted = 0
  let skipped = 0
  let errors = 0

  // Traitement par batch de 50
  const BATCH_SIZE = 50
  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE)
    const records = batch.map(toSupabaseRecord)

    if (DRY_RUN) {
      console.log(`  [DRY] Batch ${Math.floor(i/BATCH_SIZE)+1} : ${records.length} enregistrements`)
      records.slice(0, 3).forEach(r => {
        console.log(`    → ${r.company_name} | ${r.company_city} | ${r.categories.join(',')} | score: ${batch[records.indexOf(r)]?._score}`)
      })
      inserted += records.length
      continue
    }

    const { data: inserted_data, error } = await supabase
      .from('profiles_artisan')
      .insert(records)
      .select('id')

    if (error) {
      console.error(`  ✗ Batch ${Math.floor(i/BATCH_SIZE)+1} erreur :`, error.message)
      errors += batch.length
    } else {
      console.log(`  ✓ Batch ${Math.floor(i/BATCH_SIZE)+1} : ${batch.length} insérés`)
      inserted += batch.length
    }
  }

  console.log(`\n📊 Résultats import :`)
  console.log(`   Insérés   : ${inserted}`)
  console.log(`   Erreurs   : ${errors}`)
  console.log(`   Ignorés   : ${data.profiles.length - eligible.length} (score < ${MIN_SCORE})`)
  if (DRY_RUN) console.log('\n   (Dry run — aucune modification en base)')
  console.log()
}

main().catch(err => {
  console.error('Erreur fatale :', err)
  process.exit(1)
})
