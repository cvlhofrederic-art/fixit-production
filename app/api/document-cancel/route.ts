import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { validateBody, documentCancelSchema, canTransition } from '@/lib/validation'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export const maxDuration = 15

// POST /api/document-cancel
// Annule un devis ou une facture émis. Le doc passe à status='cancelled' et
// reçoit cancelled_at, cancelled_reason, cancelled_by_user_id (FR-V1).
// L'audit est inséré automatiquement par le trigger 080.
export async function POST(request: NextRequest) {
  // 1. Auth
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Rate limit (10 / min / user — annulation rare)
  if (!(await checkRateLimit(`doc_cancel_${user.id}`, 10, 60_000))) {
    return rateLimitResponse()
  }

  // 3. Parse + validate
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const v = validateBody(documentCancelSchema, raw)
  if (!v.success) {
    return NextResponse.json({ error: v.error }, { status: 400 })
  }

  const { docType, numero, reason } = v.data
  const table: 'devis' | 'factures' = docType === 'facture' ? 'factures' : 'devis'

  // 4. Fetch current doc by natural key (numero + artisan_user_id)
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from(table)
    .select('id, status, artisan_user_id, numero, cancelled_at')
    .eq('numero', numero)
    .eq('artisan_user_id', user.id)
    .maybeSingle()

  if (fetchErr) {
    logger.error(`[doc-cancel] fetch ${table} ${numero} failed:`, fetchErr.message)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
  if (existing.cancelled_at) {
    return NextResponse.json({ error: 'Document already cancelled' }, { status: 409 })
  }

  // 5. Transition guard (defense in depth — trigger 079 le rejettera aussi)
  if (!canTransition(existing.status as string, 'cancelled', docType)) {
    return NextResponse.json({
      error: 'Cannot cancel from current status',
      current: existing.status,
    }, { status: 409 })
  }

  // 6. UPDATE soft cancel
  const cancelledAt = new Date().toISOString()
  const { error: updErr } = await supabaseAdmin
    .from(table)
    .update({
      status: 'cancelled',
      cancelled_at: cancelledAt,
      cancelled_reason: reason,
      cancelled_by_user_id: user.id,
    })
    .eq('id', existing.id)
    .eq('artisan_user_id', user.id)

  if (updErr) {
    logger.error(`[doc-cancel] update ${table} ${existing.id} failed:`, updErr.message)
    Sentry.captureException(updErr, {
      tags: { agent_type: 'doc-cancel', table, doc_id: existing.id },
      extra: { numero: existing.numero, status_was: existing.status },
    })
    return NextResponse.json({ error: 'Cancellation failed' }, { status: 500 })
  }

  Sentry.addBreadcrumb({
    category: 'doc-cancel',
    message: `Cancelled ${table} ${existing.numero}`,
    data: { reason, status_was: existing.status },
    level: 'info',
  })

  return NextResponse.json({
    id: existing.id,
    table,
    numero: existing.numero,
    cancelled_at: cancelledAt,
  })
}
