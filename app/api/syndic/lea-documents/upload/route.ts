// app/api/syndic/lea-documents/upload/route.ts
// P1 Léa Documents — Upload endpoint (multipart form).
// Vérifie auth syndic, valide taille + MIME, upload Storage, insert row pending.
// Cloudflare Workers compatible (FormData + Blob, pas de fs/path).
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 30

const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
])

const DOCUMENT_TYPES = [
  'facture_artisan', 'facture_syndic', 'devis', 'contrat',
  'rib', 'ata_ag', 'releve_bancaire', 'pv_assemblee', 'autre',
] as const

const FormSchema = z.object({
  type: z.enum(DOCUMENT_TYPES).default('autre'),
  immeuble_id: z.string().uuid().optional(),
})

function extensionFor(mime: string, filename: string): string {
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg'
  const fromName = filename.split('.').pop()?.toLowerCase()
  return fromName && /^[a-z0-9]{1,5}$/.test(fromName) ? fromName : 'bin'
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const ip = getClientIP(request)
    const allowed = await checkRateLimit(`lea-docs-upload:${ip}`, 30, 60_000)
    if (!allowed) return rateLimitResponse()

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'missing_file' }, { status: 400 })
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'file_too_large', max_bytes: MAX_SIZE_BYTES }, { status: 413 })
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: 'unsupported_mime_type', mime: file.type }, { status: 415 })
    }

    const parsed = FormSchema.safeParse({
      type: form.get('type') ?? undefined,
      immeuble_id: form.get('immeuble_id') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_metadata', details: parsed.error.flatten() }, { status: 400 })
    }

    const docId = crypto.randomUUID()
    const ext = extensionFor(file.type, file.name)
    const storagePath = `${user.id}/${docId}.${ext}`

    const { error: upErr } = await supabaseAdmin.storage
      .from('syndic-documents')
      .upload(storagePath, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })
    if (upErr) {
      logger.error('[lea-documents/upload] storage upload failed:', upErr)
      return NextResponse.json({ error: 'storage_upload_failed' }, { status: 500 })
    }

    const { data: row, error: insErr } = await supabaseAdmin
      .from('syndic_documents')
      .insert({
        id: docId,
        cabinet_id: user.id,
        immeuble_id: parsed.data.immeuble_id ?? null,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        storage_path: storagePath,
        type: parsed.data.type,
        status: 'pending',
        uploaded_by: user.id,
      })
      .select('id, filename, type, status, size_bytes, uploaded_at')
      .single()

    if (insErr || !row) {
      // Rollback storage si l'insert DB échoue
      await supabaseAdmin.storage.from('syndic-documents').remove([storagePath]).catch(() => {})
      logger.error('[lea-documents/upload] db insert failed:', insErr)
      return NextResponse.json({ error: 'db_insert_failed' }, { status: 500 })
    }

    // Fire-and-forget : déclenche le pipeline OCR/extraction async (P2).
    // Ne bloque pas la réponse — si ça échoue, le cron de safety net (5 min)
    // attrapera les pending. Pas d'auth Bearer ici car l'endpoint /process
    // accepte la cookie session du user via getAuthUser.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    const cronKey = process.env.CRON_SECRET
    if (appUrl && cronKey) {
      void fetch(`${appUrl}/api/syndic/lea-documents/process`, {
        method: 'POST',
        headers: { 'x-cron-key': cronKey },
      }).catch(err => logger.warn('[lea-documents/upload] fire-and-forget process trigger failed:', err))
    }

    return NextResponse.json({ document: row }, { status: 201 })
  } catch (err) {
    logger.error('[lea-documents/upload] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
