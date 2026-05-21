// P4 Léa Documents — DELETE template (et son fichier Storage).
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const IdSchema = z.string().uuid()

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const ip = getClientIP(request)
    if (!(await checkRateLimit(`lea-tpl-del:${ip}`, 30, 60_000))) return rateLimitResponse()

    const { id } = await params
    const parsed = IdSchema.safeParse(id)
    if (!parsed.success) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

    const { data: tpl, error: q } = await supabaseAdmin
      .from('syndic_pdf_templates')
      .select('id, storage_path')
      .eq('id', parsed.data)
      .eq('cabinet_id', user.id)
      .maybeSingle()
    if (q) {
      logger.error('[lea-pdf-templates/delete] query failed:', q)
      return NextResponse.json({ error: 'db_query_failed' }, { status: 500 })
    }
    if (!tpl) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const { error: storageErr } = await supabaseAdmin.storage
      .from('syndic-pdf-templates')
      .remove([tpl.storage_path])
    if (storageErr) {
      logger.warn('[lea-pdf-templates/delete] storage remove failed (continuing):', storageErr)
    }

    const { error: dErr } = await supabaseAdmin
      .from('syndic_pdf_templates')
      .delete()
      .eq('id', parsed.data)
      .eq('cabinet_id', user.id)
    if (dErr) {
      logger.error('[lea-pdf-templates/delete] db delete failed:', dErr)
      return NextResponse.json({ error: 'db_delete_failed' }, { status: 500 })
    }

    return NextResponse.json({ deleted: true, id: parsed.data })
  } catch (err) {
    logger.error('[lea-pdf-templates/delete] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
