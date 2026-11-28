// app/api/syndic/lea-documents/upload/route.ts
// P1 Léa Documents — Upload endpoint (multipart form).
// Vérifie auth syndic, valide taille + MIME, upload Storage, insert row pending.
// Cloudflare Workers compatible (FormData + Blob, pas de fs/path).
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { StoragePathError, buildStoragePath } from '@/lib/security/storage-path'
import { getCabinetStorageUsage, wouldExceedQuota } from '@/lib/syndic/lea-documents-quota'
import * as Sentry from '@sentry/nextjs'

export const maxDuration = 30

const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB
// Types acceptés et extension de dépôt associée (liste blanche : jamais l'extension du nom client).
const EXTENSION_PAR_MIME = new Map<string, string>([
  ['application/pdf', 'pdf'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/webp', 'webp'],
])

const DOCUMENT_TYPES = [
  'facture_artisan', 'facture_syndic', 'devis', 'contrat',
  'rib', 'ata_ag', 'releve_bancaire', 'pv_assemblee', 'autre',
] as const

const FormSchema = z.object({
  type: z.enum(DOCUMENT_TYPES).default('autre'),
  immeuble_id: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) {
      return NextResponse.json({ error: 'Cabinet non résolu' }, { status: 403 })
    }

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
    const ext = EXTENSION_PAR_MIME.get(file.type)
    if (!ext) {
      return NextResponse.json({ error: 'unsupported_mime_type', mime: file.type }, { status: 415 })
    }

    // P5 — Quota storage par cabinet (free tier protection)
    const usage = await getCabinetStorageUsage(supabaseAdmin, cabinetId)
    if (wouldExceedQuota(usage, file.size)) {
      return NextResponse.json({
        error: 'quota_exceeded',
        bytes_used: usage.bytes_used,
        bytes_quota: usage.bytes_quota,
      }, { status: 413 })
    }

    const parsed = FormSchema.safeParse({
      type: form.get('type') ?? undefined,
      immeuble_id: form.get('immeuble_id') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_metadata', details: parsed.error.flatten() }, { status: 400 })
    }

    const docId = crypto.randomUUID()
    // Storage path scopé sur le cabinet (et non sur l'uploader) — un team_member
    // doit déposer dans le dossier du cabinet pour que toute l'équipe y accède.
    // Nom généré côté serveur (le nom d'origine reste en base, colonne filename),
    // segments vérifiés par buildStoragePath.
    const storagePath = buildStoragePath(cabinetId, `${docId}.${ext}`)

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
        cabinet_id: cabinetId,
        immeuble_id: parsed.data.immeuble_id ?? null,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        storage_path: storagePath,
        type: parsed.data.type,
        status: 'pending',
        uploaded_by: user.id, // qui a uploadé (per-user, intentionnel)
      })
      .select('id, filename, type, status, size_bytes, uploaded_at')
      .single()

    if (insErr || !row) {
      // Rollback storage si l'insert DB échoue
      await supabaseAdmin.storage.from('syndic-documents').remove([storagePath])
        .catch((e: unknown) => logger.warn('[lea-documents/upload] rollback storage failed:', e))
      logger.error('[lea-documents/upload] db insert failed:', insErr)
      Sentry.captureException(insErr, { tags: { agent_type: 'lea', surface: 'documents_upload' } })
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

    return NextResponse.json({
      document: row,
      quota: {
        bytes_used: usage.bytes_used + file.size,
        bytes_quota: usage.bytes_quota,
        warning: (usage.bytes_used + file.size) / usage.bytes_quota >= 0.8,
      },
    }, { status: 201 })
  } catch (err) {
    if (err instanceof StoragePathError) {
      logger.warn('[lea-documents/upload] chemin de stockage refusé')
      return NextResponse.json({ error: 'invalid_storage_path' }, { status: 400 })
    }
    logger.error('[lea-documents/upload] unexpected:', err)
    Sentry.captureException(err, { tags: { agent_type: 'lea', surface: 'documents_upload' } })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
