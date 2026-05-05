// ══════════════════════════════════════════════════════════════════════════════
// POST /api/devis-status — Marquer manuellement un devis accepté / refusé / expiré (FR-V7)
// ══════════════════════════════════════════════════════════════════════════════
// Cas d'usage : le client a répondu hors ligne (appel, email, en-personne).
// L'artisan met à jour le statut depuis son dashboard Vitfix.
//
// Pour signature électronique canvas → utiliser /api/devis-sign (transition
// 'sent' → 'signed' avec preuve cryptographique).
//
// Audit log automatique via trigger 080 (action='update' sur transition
// status).

import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { validateBody, devisStatusUpdateSchema, canTransition } from '@/lib/validation'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export const maxDuration = 15

export async function POST(request: NextRequest) {
  // 1. Auth
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Rate limit (20/min/user — opération rare)
  if (!(await checkRateLimit(`devis_status_${user.id}`, 20, 60_000))) {
    return rateLimitResponse()
  }

  // 3. Parse + validate
  let raw: unknown
  try { raw = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const v = validateBody(devisStatusUpdateSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })

  const { numero, newStatus, reason } = v.data

  // 4. Fetch existant + ownership
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('devis')
    .select('id, status, numero, cancelled_at, client_response_at')
    .eq('numero', numero)
    .eq('artisan_user_id', user.id)
    .maybeSingle()

  if (fetchErr) {
    logger.error(`[devis-status] fetch ${numero} failed:`, fetchErr.message)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'Devis not found' }, { status: 404 })
  }
  if (existing.cancelled_at) {
    return NextResponse.json({ error: 'Devis already cancelled' }, { status: 409 })
  }
  if (existing.status === newStatus) {
    return NextResponse.json({ id: existing.id, status: newStatus, idempotent: true })
  }

  // 5. Vérification transition (defense in depth — trigger 086 le rejette aussi)
  if (!canTransition(existing.status as string, newStatus, 'devis')) {
    return NextResponse.json({
      error: 'Invalid status transition',
      current: existing.status,
      requested: newStatus,
    }, { status: 409 })
  }

  // 6. UPDATE
  const responseAt = new Date().toISOString()
  const { error: updErr } = await supabaseAdmin
    .from('devis')
    .update({
      status: newStatus,
      client_response_at: responseAt,
      client_response_reason: reason || null,
    })
    .eq('id', existing.id)
    .eq('artisan_user_id', user.id)

  if (updErr) {
    logger.error(`[devis-status] update ${existing.id} failed:`, updErr.message)
    Sentry.captureException(updErr, {
      tags: { agent_type: 'devis-status', from: existing.status, to: newStatus },
      extra: { numero: existing.numero },
    })
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  Sentry.addBreadcrumb({
    category: 'devis-status',
    message: `${existing.status} → ${newStatus} on devis ${existing.numero}`,
    data: { reason: reason || null },
    level: 'info',
  })

  return NextResponse.json({
    id: existing.id,
    numero: existing.numero,
    status: newStatus,
    client_response_at: responseAt,
  })
}
