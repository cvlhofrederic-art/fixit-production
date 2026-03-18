/**
 * import-artisans-PT-filtered.mjs
 *
 * Importe les artisans PT filtrés depuis data/artisans-PT-filtered.json
 * dans la table profiles_artisan de Supabase.
 *
 * Score activité :
 *   ≥ 5 → active: true  (téléphone + avis + adresse = très probablement actif)
 *   2-4 → active: false (à vérifier manuellement)
 *
 * Usage :
 *   node scripts/import-artisans-PT-filtered.mjs             → tous
 *   node scripts/import-artisans-PT-filtered.mjs --dry-run   → aperçu
 *   node scripts/import-artisans-PT-filtered.mjs --min-score 4
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INPUT_FILE = path.join(__dirname, '../data/artisans-PT-filtered.json')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const DRY_RUN    = process.argv.includes('--dry-run')
const MIN_SCORE  = parseInt(process.argv.find(a => a.startsWith('--min-score='))?.split('=')[1] || '2')
const BATCH_SIZE = 50

// ── Mapping catégorie Vitfix → tags Supabase ────────────────────────────────
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

function toSupabaseRecord(profile) {
  // Score ≥ 5 → marquer actif directement (a phone + rating + address)
  const autoActive = (profile._activity_score || 0) >= 5

  return {
    company_name: profile.company_name,
    bio: profile.bio || null,
    phone: profile.phone || null,
    email: profile.email || null,
    company_address: profile.company_address || null,
    company_city: profile.city || null,
    language: 'pt',
    categories: buildCategories(profile.categories || []),
    rating_avg: profile.rating_avg || null,
    rating_count: profile.rating_count || 0,
    active: autoActive,
    verified: false,
    profile_photo_url: null,
    source: profile.source_name || 'google_maps',
    website: profile.website || null,
  }
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Fichier introuvable : ${INPUT_FILE}`)
    console.error('   Exécuter d\'abord : node scripts/filter-verify-artisans-PT.mjs')
    process.exit(1)
  }

  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'))
  const all = data.profiles || []
  const eligible = all.filter(p => (p._activity_score || 0) >= MIN_SCORE)

  console.log(`\n🇵🇹 Import artisans PT filtrés → Supabase`)
  console.log(`   Mode         : ${DRY_RUN ? 'DRY RUN' : 'RÉEL'}`)
  console.log(`   Score min    : ${MIN_SCORE}`)
  console.log(`   Total filtré : ${all.length}`)
  console.log(`   Éligibles    : ${eligible.length}`)
  console.log(`   → auto-actif (score ≥ 5) : ${eligible.filter(p => (p._activity_score || 0) >= 5).length}`)
  console.log(`   → à vérifier (score 2-4) : ${eligible.filter(p => (p._activity_score || 0) < 5).length}\n`)

  let inserted = 0
  let duplicates = 0
  let errors = 0

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE)
    const records = batch.map(toSupabaseRecord)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1

    if (DRY_RUN) {
      console.log(`  [DRY] Batch ${batchNum} : ${records.length} enregistrements`)
      records.slice(0, 3).forEach((r, idx) => {
        const score = batch[idx]._activity_score
        console.log(`    → [score:${score} active:${r.active}] ${r.company_name} | ${r.company_city} | ${r.categories.join(',')}`)
      })
      inserted += records.length
      continue
    }

    // Upsert par company_name + company_city (évite les doublons)
    const { data: upserted, error } = await supabase
      .from('profiles_artisan')
      .upsert(records, {
        onConflict: 'company_name,company_city',
        ignoreDuplicates: false,
      })
      .select('id')

    if (error) {
      // Si upsert non supporté, fall back vers insert (ignore conflicts)
      const { data: inserted_data, error: insertError } = await supabase
        .from('profiles_artisan')
        .insert(records)
        .select('id')

      if (insertError) {
        console.error(`  ✗ Batch ${batchNum} erreur :`, insertError.message.slice(0, 100))
        errors += batch.length
      } else {
        console.log(`  ✓ Batch ${batchNum} : ${batch.length} insérés`)
        inserted += batch.length
      }
    } else {
      console.log(`  ✓ Batch ${batchNum} : ${batch.length} upsertés`)
      inserted += batch.length
    }
  }

  console.log(`\n📊 Résultats :`)
  console.log(`   Insérés/upsertés : ${inserted}`)
  console.log(`   Erreurs          : ${errors}`)
  if (DRY_RUN) console.log('\n   ⚠️  Dry run — aucune modification en base')
  console.log()
}

main().catch(err => {
  console.error('Erreur fatale :', err)
  process.exit(1)
})
