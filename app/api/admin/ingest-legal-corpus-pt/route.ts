// One-shot d'ingestion du corpus juridique PT depuis le Worker Cloudflare,
// utilisant le binding AI (zéro token requis) pour BGE-M3 embeddings.
//
// Auth : super_admin uniquement (defense-in-depth + email allowlist).
//
// Usage :
//   curl -X POST https://vitfix.io/api/admin/ingest-legal-corpus-pt \
//        -H "Authorization: Bearer <super_admin_access_token>"
//
// Idempotent : skip les chunks déjà ingérés (chunk_hash UNIQUE).
//
// Le parser est extrait dans `lib/syndic/max-parser.ts` pour permettre les
// tests unitaires (tests/syndic/max-parser.test.ts). Cette route se contente
// d'orchestrer : auth → décodage MD → parse → embeddings → insert.

import { NextResponse, type NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { supabaseAdmin } from '@/lib/supabase-server'
import { embedBatch, formatVectorLiteral } from '@/lib/syndic/embed'
import { decodeCorpusMd } from '@/lib/syndic/legal-corpus-pt-md'
import { parseLegalMarkdown, type ParsedChunk } from '@/lib/syndic/max-parser'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { logger } from '@/lib/logger'

// Auth triple-path :
//  1. Bearer Supabase JWT (script avec access_token super_admin)
//  2. Cookie SSR (super_admin connecté dans le navigateur)
//  3. Header x-cron-secret = INTERNAL_API_SECRET (GitHub Actions / CI)
async function authenticateSuperAdmin(request: NextRequest): Promise<boolean> {
  // Path 1 : Bearer Supabase JWT (script/CI)
  const bearerUser = await getAuthUser(request)
  if (bearerUser && isSyndicRole(bearerUser)) return true
  // Path 2 : cookies SSR (navigateur logged in)
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user && isSyndicRole(user)) return true
  } catch {
    // ignore
  }
  // Path 3 : shared secret pour automation CI (pattern x-cron-secret existant).
  // Même niveau de privilège que les workflows cron — l'endpoint est idempotent
  // et seul super_admin peut déclencher la rotation du secret.
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret && process.env.INTERNAL_API_SECRET && cronSecret === process.env.INTERNAL_API_SECRET) {
    return true
  }
  return false
}

export const maxDuration = 30

function chunkHash(c: ParsedChunk): string {
  const normalized = `${c.source}|${c.article ?? ''}|${c.title}|${c.content.trim().replace(/\s+/g, ' ')}`
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

function buildHypotheticalQuestion(c: ParsedChunk): string {
  if (c.article) return `O que diz o ${c.source} no Artigo ${c.article} sobre ${c.title}?`
  return `O que diz a legislação portuguesa sobre ${c.title}?`
}

// Le chunk TOC est inséré tel quel (pas d'embedding) — il est destiné au
// pré-chargement dans le system prompt, pas au retrieval. La RPC
// search_legal_corpus_hybrid_pt l'exclut via WHERE parent_path <> '__TOC__'.
function isTocChunk(c: ParsedChunk): boolean {
  return c.parent_path === '__TOC__'
}

// ─────────────────────────────────────────────────────────────────────────────
// Route POST — ingestion idempotente
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!(await authenticateSuperAdmin(request))) {
    return NextResponse.json({ error: 'super_admin_required' }, { status: 403 })
  }

  // Récupère le binding AI (zéro token requis au runtime Worker)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let aiBinding: any = null
  try {
    const ctx = await getCloudflareContext({ async: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    aiBinding = (ctx as any)?.env?.AI ?? null
  } catch (err) {
    logger.warn('[ingest-legal-corpus-pt] no CF context, will use REST fallback', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  // Parse le MD inline (depuis la chaîne base64 embarquée)
  const md = decodeCorpusMd()
  const chunks = parseLegalMarkdown(md)

  // Filtre les chunks déjà présents (idempotence)
  const hashes = chunks.map(chunkHash)
  const { data: existing } = await supabaseAdmin
    .from('syndic_legal_corpus_pt')
    .select('chunk_hash')
    .in('chunk_hash', hashes)
  const existingSet = new Set((existing ?? []).map((r) => r.chunk_hash as string))
  const toInsert = chunks.filter((_, i) => !existingSet.has(hashes[i]))

  if (toInsert.length === 0) {
    return NextResponse.json({
      ok: true,
      total: chunks.length,
      inserted: 0,
      skipped: chunks.length,
      message: 'Tous les chunks sont déjà ingérés',
    })
  }

  let inserted = 0
  const errors: string[] = []
  const BATCH_SIZE = 16

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE)
    try {
      // Le chunk TOC est inséré sans embeddings (il n'est pas servi par le retrieval).
      const batchWithoutToc = batch.filter((c) => !isTocChunk(c))
      const tocChunksInBatch = batch.filter(isTocChunk)

      let contentVecs: number[][] = []
      let questionVecs: number[][] = []
      if (batchWithoutToc.length > 0) {
        contentVecs = await embedBatch(
          batchWithoutToc.map((c) => `${c.title}\n\n${c.content}`),
          { aiBinding },
        )
        questionVecs = await embedBatch(
          batchWithoutToc.map(buildHypotheticalQuestion),
          { aiBinding },
        )
      }

      const rowsNonToc = batchWithoutToc.map((c, j) => ({
        source: c.source,
        article: c.article,
        title: c.title,
        content: c.content,
        theme: c.theme,
        parent_path: c.parent_path,
        chunk_index: c.chunk_index,
        language: 'pt' as const,
        chunk_hash: chunkHash(c),
        embedding: formatVectorLiteral(contentVecs[j]),
        question_embedding: formatVectorLiteral(questionVecs[j]),
        version: 1,
      }))

      const rowsToc = tocChunksInBatch.map((c) => ({
        source: c.source,
        article: c.article,
        title: c.title,
        content: c.content,
        theme: c.theme,
        parent_path: c.parent_path,
        chunk_index: c.chunk_index,
        language: 'pt' as const,
        chunk_hash: chunkHash(c),
        // Pas d'embedding pour le TOC — exclu du retrieval par la RPC
        embedding: null,
        question_embedding: null,
        version: 1,
      }))

      const rows = [...rowsNonToc, ...rowsToc]

      // Insert simple : on a pré-filtré les chunks déjà présents via chunk_hash.
      // (upsert avec onConflict ne fonctionne pas avec un index partiel
      // WHERE chunk_hash IS NOT NULL, ce qui est notre cas.)
      const { error } = await supabaseAdmin
        .from('syndic_legal_corpus_pt')
        .insert(rows)
      if (error) {
        errors.push(`batch ${i / BATCH_SIZE + 1}: ${error.message}`)
      } else {
        inserted += batch.length
      }
    } catch (err) {
      errors.push(`batch ${i / BATCH_SIZE + 1}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    total: chunks.length,
    inserted,
    skipped: chunks.length - toInsert.length,
    errors,
  })
}

// Handler GET pour vérifier la couverture (audit + monitoring)
export async function GET(request: NextRequest) {
  if (!(await authenticateSuperAdmin(request))) {
    return NextResponse.json({ error: 'super_admin_required' }, { status: 403 })
  }
  const { count: totalCount } = await supabaseAdmin
    .from('syndic_legal_corpus_pt')
    .select('*', { count: 'exact', head: true })
  const { count: withEmbeddingCount } = await supabaseAdmin
    .from('syndic_legal_corpus_pt')
    .select('id', { count: 'exact', head: true })
    .not('embedding', 'is', null)
  return NextResponse.json({
    total_chunks: totalCount ?? 0,
    chunks_with_embedding: withEmbeddingCount ?? 0,
  })
}
