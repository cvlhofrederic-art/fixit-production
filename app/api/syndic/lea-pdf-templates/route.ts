// P4 Léa Documents — Liste + création de templates PDF (upload PDF source).
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const MAX_TEMPLATE_BYTES = 10 * 1024 * 1024

const TEMPLATE_TYPES = [
  'chamada_quotas', 'lettre_relance_impaye', 'ata_ag',
  'pv_assemblee', 'convocation_ag', 'avis_passage', 'autre',
] as const

const PlaceholdersSchema = z.record(z.string(), z.object({
  label: z.string().min(1).max(200),
  default: z.string().max(500).optional(),
  required: z.boolean().optional(),
}))

const FormSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(TEMPLATE_TYPES).default('autre'),
  description: z.string().max(500).optional(),
  locale: z.enum(['fr', 'pt']).default('fr'),
  placeholders: PlaceholdersSchema.optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Cabinet non résolu' }, { status: 403 })

    const ip = getClientIP(request)
    if (!(await checkRateLimit(`lea-tpl-list:${ip}`, 120, 60_000))) return rateLimitResponse()

    const { data, error } = await supabaseAdmin
      .from('syndic_pdf_templates')
      .select('id, name, type, description, locale, placeholders, is_active, created_at, updated_at')
      .eq('cabinet_id', cabinetId)
      .order('updated_at', { ascending: false })

    if (error) {
      logger.error('[lea-pdf-templates/list] db query failed:', error)
      return NextResponse.json({ error: 'db_query_failed' }, { status: 500 })
    }
    return NextResponse.json({ templates: data ?? [] })
  } catch (err) {
    logger.error('[lea-pdf-templates/list] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Cabinet non résolu' }, { status: 403 })

    const ip = getClientIP(request)
    if (!(await checkRateLimit(`lea-tpl-create:${ip}`, 20, 60_000))) return rateLimitResponse()

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'missing_file' }, { status: 400 })
    if (file.size > MAX_TEMPLATE_BYTES) return NextResponse.json({ error: 'file_too_large' }, { status: 413 })
    if (file.type !== 'application/pdf') return NextResponse.json({ error: 'pdf_only' }, { status: 415 })

    let placeholdersInput: unknown = {}
    const placeholdersRaw = form.get('placeholders')
    if (typeof placeholdersRaw === 'string' && placeholdersRaw.trim()) {
      try { placeholdersInput = JSON.parse(placeholdersRaw) } catch {
        return NextResponse.json({ error: 'invalid_placeholders_json' }, { status: 400 })
      }
    }

    const parsed = FormSchema.safeParse({
      name: form.get('name'),
      type: form.get('type') ?? undefined,
      description: form.get('description') ?? undefined,
      locale: form.get('locale') ?? undefined,
      placeholders: placeholdersInput,
    })
    if (!parsed.success) return NextResponse.json({ error: 'invalid_metadata', details: parsed.error.flatten() }, { status: 400 })

    const tplId = crypto.randomUUID()
    // Storage path scopé cabinet (et non uploader) — toute l'équipe accède aux templates.
    const storagePath = `${cabinetId}/${tplId}.pdf`

    const { error: upErr } = await supabaseAdmin.storage
      .from('syndic-pdf-templates')
      .upload(storagePath, file, { contentType: 'application/pdf', upsert: false })
    if (upErr) {
      logger.error('[lea-pdf-templates/create] storage upload failed:', upErr)
      return NextResponse.json({ error: 'storage_upload_failed' }, { status: 500 })
    }

    const { data: row, error: insErr } = await supabaseAdmin
      .from('syndic_pdf_templates')
      .insert({
        id: tplId,
        cabinet_id: cabinetId,
        name: parsed.data.name,
        type: parsed.data.type,
        description: parsed.data.description ?? null,
        locale: parsed.data.locale,
        placeholders: parsed.data.placeholders ?? {},
        storage_path: storagePath,
        created_by: user.id, // qui a créé (per-user, intentionnel)
      })
      .select('id, name, type, locale, placeholders, created_at')
      .single()

    if (insErr || !row) {
      await supabaseAdmin.storage.from('syndic-pdf-templates').remove([storagePath]).catch(() => {})
      logger.error('[lea-pdf-templates/create] db insert failed:', insErr)
      return NextResponse.json({ error: 'db_insert_failed' }, { status: 500 })
    }

    return NextResponse.json({ template: row }, { status: 201 })
  } catch (err) {
    logger.error('[lea-pdf-templates/create] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
