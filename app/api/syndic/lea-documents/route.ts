// app/api/syndic/lea-documents/route.ts
// P1 Léa Documents — Liste paginée avec filtres (type, status, immeuble, date).
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const DOCUMENT_TYPES = [
  'facture_artisan', 'facture_syndic', 'devis', 'contrat',
  'rib', 'ata_ag', 'releve_bancaire', 'pv_assemblee', 'autre',
] as const

const COLONNES_BASE = 'id, filename, mime_type, size_bytes, type, status, immeuble_id, tags, uploaded_at, processed_at, error_message, extracted_metadata'
/** Colonnes de la migration 20261017 (portail copropriétaire). */
const COLONNES_EXTRANET = 'publie_extranet, espace_extranet, coproprio_id, categorie_extranet'
/** Valeurs renvoyées tant que la migration n'est pas appliquée : rien n'est publié. */
const SANS_EXTRANET = { publie_extranet: false, espace_extranet: 'commun', coproprio_id: null, categorie_extranet: null } as const

const QuerySchema = z.object({
  type: z.enum(DOCUMENT_TYPES).optional(),
  status: z.enum(['pending', 'processing', 'processed', 'error']).optional(),
  immeuble_id: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) {
      return NextResponse.json({ error: 'Cabinet non résolu' }, { status: 403 })
    }

    const ip = getClientIP(request)
    const allowed = await checkRateLimit(`lea-docs-list:${ip}`, 120, 60_000)
    if (!allowed) return rateLimitResponse()

    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = QuerySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_query', details: parsed.error.flatten() }, { status: 400 })
    }

    const filtres = parsed.data
    const construire = (colonnes: string) => {
      let query = supabaseAdmin
        .from('syndic_documents')
        .select(colonnes, { count: 'exact' })
        .eq('cabinet_id', cabinetId)
        .order('uploaded_at', { ascending: false })
        .range(filtres.offset, filtres.offset + filtres.limit - 1)

      if (filtres.type) query = query.eq('type', filtres.type)
      if (filtres.status) query = query.eq('status', filtres.status)
      if (filtres.immeuble_id) query = query.eq('immeuble_id', filtres.immeuble_id)
      if (filtres.date_from) query = query.gte('uploaded_at', filtres.date_from)
      if (filtres.date_to) query = query.lte('uploaded_at', filtres.date_to)
      return query
    }

    let colonnesExtranet = true
    let { data, error, count } = await construire(`${COLONNES_BASE}, ${COLONNES_EXTRANET}`)
    if (error?.code === '42703') {
      // Migration 20261017 (portail copropriétaire) pas encore appliquée en production :
      // relecture sans ses colonnes, aucun document n'est alors publié.
      logger.warn('[lea-documents/list] colonnes extranet absentes (migration 20261017 non appliquée) — relecture sans elles', { code: error.code, message: error.message })
      colonnesExtranet = false
      ;({ data, error, count } = await construire(COLONNES_BASE))
    }
    if (error) {
      logger.error('[lea-documents/list] db query failed:', error)
      return NextResponse.json({ error: 'db_query_failed' }, { status: 500 })
    }

    // Colonnes passées en chaîne dynamique : le client Supabase non typé ne sait pas en déduire les lignes.
    const lignes = (data ?? []) as unknown as Record<string, unknown>[]
    const documents = lignes.map((d) => (colonnesExtranet ? d : { ...d, ...SANS_EXTRANET }))

    return NextResponse.json({
      documents,
      total: count ?? 0,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    })
  } catch (err) {
    logger.error('[lea-documents/list] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
