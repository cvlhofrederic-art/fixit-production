// P4 Léa Documents — Endpoint de génération de PDF depuis template.
//
// POST { template_id, field_values, filename? } → produit le PDF, l'upload
// dans bucket syndic-pdf-generated, et retourne un signed URL.
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { generatePdfFromTemplate, type PdfFieldValue } from '@/lib/syndic/lea-pdf-generator'
import { traceAgent } from '@/lib/langfuse'
import * as Sentry from '@sentry/nextjs'

export const maxDuration = 30

const SIGNED_URL_TTL = 10 * 60

const BodySchema = z.object({
  template_id: z.string().uuid(),
  field_values: z.record(z.string(), z.string().max(2000)),
  filename: z.string().min(1).max(120).optional(),
})

function safeFilename(input: string): string {
  return input
    .replace(/[^\w\-.\sÀ-ÿ]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 100)
}

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
    if (!(await checkRateLimit(`lea-pdf-gen:${ip}`, 30, 60_000))) return rateLimitResponse()

    const body = await request.json().catch(() => null)
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
    }

    // 1. Charger le template (RLS-equivalent via cabinet_id check)
    const { data: tpl, error: tplErr } = await supabaseAdmin
      .from('syndic_pdf_templates')
      .select('id, name, storage_path, placeholders, locale, type')
      .eq('id', parsed.data.template_id)
      .eq('cabinet_id', cabinetId)
      .maybeSingle()
    if (tplErr) {
      logger.error('[lea-pdf-generate] template query failed:', tplErr)
      return NextResponse.json({ error: 'db_query_failed' }, { status: 500 })
    }
    if (!tpl) return NextResponse.json({ error: 'template_not_found' }, { status: 404 })

    // 2. Valider que les placeholders required sont fournis
    const placeholders = (tpl.placeholders ?? {}) as Record<string, { label?: string; default?: string; required?: boolean }>
    const missing: string[] = []
    for (const [key, def] of Object.entries(placeholders)) {
      if (def.required && !parsed.data.field_values[key]?.trim()) missing.push(key)
    }
    if (missing.length > 0) {
      return NextResponse.json({ error: 'missing_required_fields', fields: missing }, { status: 400 })
    }

    // 3. Télécharger le template depuis Storage
    const { data: tplBlob, error: dlErr } = await supabaseAdmin.storage
      .from('syndic-pdf-templates')
      .download(tpl.storage_path)
    if (dlErr || !tplBlob) {
      logger.error('[lea-pdf-generate] template download failed:', dlErr)
      return NextResponse.json({ error: 'template_download_failed' }, { status: 500 })
    }

    // 4. Préparer les champs (label depuis placeholders, valeur depuis input ou default)
    const fields: PdfFieldValue[] = []
    const allKeys = new Set([
      ...Object.keys(placeholders),
      ...Object.keys(parsed.data.field_values),
    ])
    for (const key of allKeys) {
      const def = placeholders[key]
      const value = parsed.data.field_values[key] ?? def?.default ?? ''
      fields.push({ key, label: def?.label, value })
    }

    // 5. Générer le PDF (wrapped traceAgent pour observabilité)
    const tplBytes = await tplBlob.arrayBuffer()
    const result = await traceAgent(
      {
        agent_id: 'lea',
        user_id: user.id,
        prompt: `generate_pdf:${tpl.name}`,
        metadata: { tool: 'generate_pdf', template_id: tpl.id, template_type: tpl.type, fields_count: fields.length },
      },
      () => generatePdfFromTemplate(tplBytes, fields),
    )

    // 6. Upload du PDF généré
    const docId = crypto.randomUUID()
    const baseFilename = safeFilename(parsed.data.filename || `${tpl.name}_${new Date().toISOString().slice(0, 10)}`)
    const filename = baseFilename.endsWith('.pdf') ? baseFilename : `${baseFilename}.pdf`
    // Storage path scopé cabinet (et non uploader) — toute l'équipe accède aux PDFs générés.
    const storagePath = `${cabinetId}/${docId}.pdf`

    const { error: upErr } = await supabaseAdmin.storage
      .from('syndic-pdf-generated')
      .upload(storagePath, result.bytes, { contentType: 'application/pdf', upsert: false })
    if (upErr) {
      logger.error('[lea-pdf-generate] storage upload failed:', upErr)
      return NextResponse.json({ error: 'storage_upload_failed' }, { status: 500 })
    }

    // 7. Insert audit row
    const { data: row, error: insErr } = await supabaseAdmin
      .from('syndic_pdf_generated')
      .insert({
        id: docId,
        cabinet_id: cabinetId,
        template_id: tpl.id,
        filename,
        storage_path: storagePath,
        field_values: parsed.data.field_values,
        size_bytes: result.bytes.byteLength,
        generated_by: user.id, // qui a généré (per-user, intentionnel)
      })
      .select('id, filename, generated_at')
      .single()
    if (insErr || !row) {
      await supabaseAdmin.storage.from('syndic-pdf-generated').remove([storagePath]).catch(() => {})
      logger.error('[lea-pdf-generate] db insert failed:', insErr)
      return NextResponse.json({ error: 'db_insert_failed' }, { status: 500 })
    }

    // 8. Signed URL pour téléchargement immédiat
    const { data: signed } = await supabaseAdmin.storage
      .from('syndic-pdf-generated')
      .createSignedUrl(storagePath, SIGNED_URL_TTL)

    return NextResponse.json({
      generated: row,
      signed_url: signed?.signedUrl ?? null,
      filled_fields: result.filled_fields,
      unfilled_fields: result.unfilled_fields,
    }, { status: 201 })
  } catch (err) {
    logger.error('[lea-pdf-generate] unexpected:', err)
    Sentry.captureException(err, { tags: { agent_type: 'lea', surface: 'pdf_generate' } })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
