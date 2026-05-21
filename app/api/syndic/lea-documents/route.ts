// app/api/syndic/lea-documents/route.ts
// P1 Léa Documents — Liste paginée avec filtres (type, status, immeuble, date).
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const DOCUMENT_TYPES = [
  'facture_artisan', 'facture_syndic', 'devis', 'contrat',
  'rib', 'ata_ag', 'releve_bancaire', 'pv_assemblee', 'autre',
] as const

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

    const ip = getClientIP(request)
    const allowed = await checkRateLimit(`lea-docs-list:${ip}`, 120, 60_000)
    if (!allowed) return rateLimitResponse()

    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = QuerySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_query', details: parsed.error.flatten() }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('syndic_documents')
      .select('id, filename, mime_type, size_bytes, type, status, immeuble_id, tags, uploaded_at, processed_at, error_message', { count: 'exact' })
      .eq('cabinet_id', user.id)
      .order('uploaded_at', { ascending: false })
      .range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1)

    if (parsed.data.type) query = query.eq('type', parsed.data.type)
    if (parsed.data.status) query = query.eq('status', parsed.data.status)
    if (parsed.data.immeuble_id) query = query.eq('immeuble_id', parsed.data.immeuble_id)
    if (parsed.data.date_from) query = query.gte('uploaded_at', parsed.data.date_from)
    if (parsed.data.date_to) query = query.lte('uploaded_at', parsed.data.date_to)

    const { data, error, count } = await query
    if (error) {
      logger.error('[lea-documents/list] db query failed:', error)
      return NextResponse.json({ error: 'db_query_failed' }, { status: 500 })
    }

    return NextResponse.json({
      documents: data ?? [],
      total: count ?? 0,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    })
  } catch (err) {
    logger.error('[lea-documents/list] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
