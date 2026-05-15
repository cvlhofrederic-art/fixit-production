// scripts/seed-max-legal-corpus.ts
// ──────────────────────────────────────────────────────────────────────────────
// Ingestion manuelle du corpus juridique Max (Plan H).
//
// Usage :
//   SUPABASE_SERVICE_ROLE_KEY="..." \
//   NEXT_PUBLIC_SUPABASE_URL="..." \
//   npx tsx scripts/seed-max-legal-corpus.ts ./data/legal-corpus.json
//
// Format du fichier JSON attendu :
// [
//   {
//     "language": "fr",
//     "source": "Loi 10/07/1965",
//     "article": "Art. 25",
//     "title": "Majorité absolue",
//     "content": "Sont adoptées à la majorité des voix de tous les copropriétaires…",
//     "theme": "AG"
//   },
//   …
// ]
//
// Comportement :
//   - Insère dans syndic_legal_corpus_fr ou _pt selon `language`
//   - Skip si (source, article) existe déjà pour la même langue (clé unique)
//   - Imprime un résumé : insérés / skippés / erreurs
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface CorpusEntry {
  language: 'fr' | 'pt'
  source: string
  article: string
  title: string
  content: string
  theme?: string
}

function isValidEntry(x: unknown): x is CorpusEntry {
  if (typeof x !== 'object' || x === null) return false
  const r = x as Record<string, unknown>
  return (
    (r.language === 'fr' || r.language === 'pt') &&
    typeof r.source === 'string' && r.source.length > 0 &&
    typeof r.article === 'string' && r.article.length > 0 &&
    typeof r.title === 'string' && r.title.length > 0 &&
    typeof r.content === 'string' && r.content.length > 0 &&
    (r.theme === undefined || typeof r.theme === 'string')
  )
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('[seed-legal-corpus] Usage : npx tsx scripts/seed-max-legal-corpus.ts <chemin.json>')
    process.exit(1)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('[seed-legal-corpus] Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises.')
    process.exit(1)
  }

  const abs = resolve(process.cwd(), filePath)
  console.log(`[seed-legal-corpus] Lecture : ${abs}`)
  let raw: string
  try {
    raw = readFileSync(abs, 'utf8')
  } catch (err) {
    console.error(`[seed-legal-corpus] Impossible de lire le fichier : ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    console.error(`[seed-legal-corpus] JSON invalide : ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }

  if (!Array.isArray(parsed)) {
    console.error('[seed-legal-corpus] Le fichier JSON doit contenir un tableau d\'entrées.')
    process.exit(1)
  }

  const entries: CorpusEntry[] = []
  let rejected = 0
  for (const item of parsed) {
    if (isValidEntry(item)) entries.push(item)
    else rejected++
  }

  console.log(`[seed-legal-corpus] ${entries.length} entrée(s) valide(s), ${rejected} rejetée(s).`)
  if (entries.length === 0) {
    console.log('[seed-legal-corpus] Rien à ingérer.')
    process.exit(0)
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  let inserted = 0
  let skipped = 0
  let failed = 0

  for (const e of entries) {
    const table = e.language === 'pt' ? 'syndic_legal_corpus_pt' : 'syndic_legal_corpus_fr'

    // Skip si (source, article) existe déjà
    const { data: existing, error: lookupErr } = await supabase
      .from(table)
      .select('id')
      .eq('source', e.source)
      .eq('article', e.article)
      .maybeSingle()

    if (lookupErr) {
      console.error(`[seed-legal-corpus] ✗ Lookup échoué pour ${e.source} ${e.article} : ${lookupErr.message}`)
      failed++
      continue
    }
    if (existing) {
      skipped++
      console.log(`[seed-legal-corpus] ⤳ Skip (déjà présent) : [${e.language}] ${e.source} ${e.article}`)
      continue
    }

    const { error: insErr } = await supabase.from(table).insert({
      source: e.source,
      article: e.article,
      title: e.title,
      content: e.content,
      theme: e.theme ?? null,
      language: e.language,
    })

    if (insErr) {
      console.error(`[seed-legal-corpus] ✗ Insert échoué : [${e.language}] ${e.source} ${e.article} — ${insErr.message}`)
      failed++
      continue
    }

    inserted++
    console.log(`[seed-legal-corpus] ✓ Inséré : [${e.language}] ${e.source} ${e.article}`)
  }

  console.log('\n[seed-legal-corpus] Résumé :')
  console.log(`  • Insérés : ${inserted}`)
  console.log(`  • Skippés : ${skipped}`)
  console.log(`  • Échoués : ${failed}`)
  console.log(`  • Rejetés (format invalide) : ${rejected}`)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('[seed-legal-corpus] FATAL :', err)
  process.exit(1)
})
