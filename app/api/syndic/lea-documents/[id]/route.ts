// app/api/syndic/lea-documents/[id]/route.ts
// P1 Léa Documents — GET (détails + signed URL 10 min) et DELETE (Storage + row).
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const SIGNED_URL_TTL_SECONDS = 10 * 60

const IdSchema = z.string().uuid()

async function requireSyndicUser(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  if (!isSyndicRole(user)) return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (!cabinetId) return { error: NextResponse.json({ error: 'Cabinet non résolu' }, { status: 403 }) }
  return { user, cabinetId }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { cabinetId, error: authError } = await requireSyndicUser(request)
    if (authError) return authError

    const ip = getClientIP(request)
    const allowed = await checkRateLimit(`lea-docs-get:${ip}`, 120, 60_000)
    if (!allowed) return rateLimitResponse()

    const { id } = await params
    const parsed = IdSchema.safeParse(id)
    if (!parsed.success) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

    const { data: doc, error: queryError } = await supabaseAdmin
      .from('syndic_documents')
      .select('*')
      .eq('id', parsed.data)
      .eq('cabinet_id', cabinetId!)
      .maybeSingle()

    if (queryError) {
      logger.error('[lea-documents/get] db query failed:', queryError)
      return NextResponse.json({ error: 'db_query_failed' }, { status: 500 })
    }
    if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from('syndic-documents')
      .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS)

    if (signError || !signed) {
      logger.error('[lea-documents/get] signed url failed:', signError)
      return NextResponse.json({ error: 'storage_signed_url_failed' }, { status: 500 })
    }

    return NextResponse.json({
      document: doc,
      signed_url: signed.signedUrl,
      expires_in_seconds: SIGNED_URL_TTL_SECONDS,
    })
  } catch (err) {
    logger.error('[lea-documents/get] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { cabinetId, error: authError } = await requireSyndicUser(request)
    if (authError) return authError

    const ip = getClientIP(request)
    const allowed = await checkRateLimit(`lea-docs-delete:${ip}`, 30, 60_000)
    if (!allowed) return rateLimitResponse()

    const { id } = await params
    const parsed = IdSchema.safeParse(id)
    if (!parsed.success) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

    const { data: doc, error: queryError } = await supabaseAdmin
      .from('syndic_documents')
      .select('id, storage_path')
      .eq('id', parsed.data)
      .eq('cabinet_id', cabinetId!)
      .maybeSingle()

    if (queryError) {
      logger.error('[lea-documents/delete] db query failed:', queryError)
      return NextResponse.json({ error: 'db_query_failed' }, { status: 500 })
    }
    if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // Storage delete (best-effort — la row reste la source de vérité)
    const { error: storageError } = await supabaseAdmin.storage
      .from('syndic-documents')
      .remove([doc.storage_path])
    if (storageError) {
      logger.warn('[lea-documents/delete] storage remove failed (continuing with DB delete):', storageError)
    }

    const { error: deleteError } = await supabaseAdmin
      .from('syndic_documents')
      .delete()
      .eq('id', parsed.data)
      .eq('cabinet_id', cabinetId!)

    if (deleteError) {
      logger.error('[lea-documents/delete] db delete failed:', deleteError)
      return NextResponse.json({ error: 'db_delete_failed' }, { status: 500 })
    }

    return NextResponse.json({ deleted: true, id: parsed.data })
  } catch (err) {
    logger.error('[lea-documents/delete] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
