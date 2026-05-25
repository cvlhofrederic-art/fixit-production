// P2 Léa Documents — endpoint async de traitement OCR + extraction métadonnées
// Picks N pending → download Storage → OCR (unpdf) → metadata (Groq) → update DB.
// Appelable via :
//   - Cron Cloudflare (x-cron-key header)
//   - Fire-and-forget après upload (cookie auth syndic)
//   - Cron GitHub Actions (x-cron-key)
import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { extractPdfText, extractMetadataFromText, type ExtractedMetadata } from '@/lib/syndic/lea-documents-extract'
import { embedText } from '@/lib/syndic/embed'
import { traceAgent } from '@/lib/langfuse'
import * as Sentry from '@sentry/nextjs'

export const maxDuration = 60

const BATCH_LIMIT = 5

interface PendingDoc {
  id: string
  cabinet_id: string
  storage_path: string
  mime_type: string
  type: string
}

async function authorize(request: NextRequest): Promise<{ ok: true; restrictToCabinetId?: string } | { ok: false; response: NextResponse }> {
  const cronKey = request.headers.get('x-cron-key')
  if (cronKey && cronKey === process.env.CRON_SECRET) {
    return { ok: true }
  }
  const user = await getAuthUser(request)
  if (!user) return { ok: false, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  if (!isSyndicRole(user)) return { ok: false, response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (!cabinetId) return { ok: false, response: NextResponse.json({ error: 'Cabinet non résolu' }, { status: 403 }) }
  return { ok: true, restrictToCabinetId: cabinetId }
}

async function processOne(doc: PendingDoc): Promise<{ id: string; ok: boolean; error?: string }> {
  return traceAgent(
    {
      agent_id: 'lea',
      user_id: doc.cabinet_id,
      prompt: `process_document:${doc.id}`,
      metadata: { tool: 'process_document', mime_type: doc.mime_type, doc_type: doc.type },
    },
    () => processOneInner(doc),
  )
}

async function processOneInner(doc: PendingDoc): Promise<{ id: string; ok: boolean; error?: string }> {
  try {
    // 1. Mark processing
    await supabaseAdmin
      .from('syndic_documents')
      .update({ status: 'processing' })
      .eq('id', doc.id)

    // 2. Download from Storage
    const { data: fileBlob, error: dlErr } = await supabaseAdmin.storage
      .from('syndic-documents')
      .download(doc.storage_path)
    if (dlErr || !fileBlob) {
      throw new Error(`storage_download_failed: ${dlErr?.message ?? 'no_data'}`)
    }

    // 3. Extract text (PDFs only for P2 — images deferred to P2.1)
    let extractedText = ''
    if (doc.mime_type === 'application/pdf') {
      const buf = await fileBlob.arrayBuffer()
      const result = await extractPdfText(buf)
      extractedText = result.text
    } else {
      // Image OCR pas implémenté en P2 — marque processed sans texte
      logger.info(`[lea-documents/process] skipping OCR for non-PDF (${doc.mime_type}) doc ${doc.id}`)
    }

    // 4. Extract metadata via Groq (uniquement si on a du texte)
    let metadata: ExtractedMetadata = {}
    if (extractedText.length > 20) {
      metadata = await extractMetadataFromText(extractedText, 'fr')
    }

    // 5. Embed pour RAG hybride P3 (best-effort — l'absence d'embedding
    //    ne bloque pas le doc, juste pas trouvable par search sémantique)
    let embedding: number[] | null = null
    if (extractedText.length > 20) {
      try {
        // BGE-M3 supporte 8192 tokens, on truncate généreusement à 8K caractères
        const inputForEmbed = extractedText.slice(0, 8000)
        embedding = await embedText(inputForEmbed)
      } catch (embedErr) {
        logger.warn(`[lea-documents/process] embedding failed for doc ${doc.id} (will retry on next process run):`, embedErr)
      }
    }

    // 6. Update row
    const { error: updErr } = await supabaseAdmin
      .from('syndic_documents')
      .update({
        status: 'processed',
        extracted_text: extractedText || null,
        extracted_metadata: metadata,
        embedding: embedding,
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', doc.id)

    if (updErr) throw new Error(`db_update_failed: ${updErr.message}`)

    return { id: doc.id, ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    logger.error(`[lea-documents/process] doc ${doc.id} failed:`, err)
    Sentry.captureException(err, {
      tags: { agent_type: 'lea', surface: 'documents_process', mime_type: doc.mime_type },
      extra: { doc_id: doc.id, cabinet_id: doc.cabinet_id },
    })
    try {
      await supabaseAdmin
        .from('syndic_documents')
        .update({
          status: 'error',
          error_message: message.slice(0, 500),
          processed_at: new Date().toISOString(),
        })
        .eq('id', doc.id)
    } catch {
      // best-effort
    }
    return { id: doc.id, ok: false, error: message }
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize(request)
    if (!auth.ok) return auth.response

    let query = supabaseAdmin
      .from('syndic_documents')
      .select('id, cabinet_id, storage_path, mime_type, type')
      .eq('status', 'pending')
      .order('uploaded_at', { ascending: true })
      .limit(BATCH_LIMIT)

    if (auth.restrictToCabinetId) {
      query = query.eq('cabinet_id', auth.restrictToCabinetId)
    }

    const { data: pending, error } = await query
    if (error) {
      logger.error('[lea-documents/process] db query failed:', error)
      return NextResponse.json({ error: 'db_query_failed' }, { status: 500 })
    }

    if (!pending || pending.length === 0) {
      return NextResponse.json({ processed: 0, ok: 0, error: 0 })
    }

    const results = await Promise.all(pending.map(processOne))
    const okCount = results.filter(r => r.ok).length
    const errCount = results.length - okCount

    return NextResponse.json({
      processed: results.length,
      ok: okCount,
      error: errCount,
      details: results,
    })
  } catch (err) {
    logger.error('[lea-documents/process] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
