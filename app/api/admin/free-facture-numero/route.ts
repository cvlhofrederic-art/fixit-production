import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 10

// POST /api/admin/free-facture-numero — Libère le slot UNIQUE (numero, artisan_user_id)
// d'une facture annulée en renommant son numero vers `${numero}-VOID-${epoch}`.
// Usage : phase test SaaS pour réutiliser un numéro chronologique après cancel.
// Auth : owner artisan uniquement. Cible : factures avec status='cancelled'.
export async function POST(request: NextRequest) {
  let user = await getAuthUser(request)
  if (!user) {
    try {
      const sc = await createServerSupabaseClient()
      const { data } = await sc.auth.getUser()
      user = data.user
    } catch { /* noop */ }
  }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await checkRateLimit(`free_fact_${user.id}`, 5, 60_000))) return rateLimitResponse()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { numero } = (body || {}) as { numero?: string }
  if (!numero || typeof numero !== 'string' || !/^FACT-\d{4}-\d{3}$/.test(numero)) {
    return NextResponse.json({ error: 'Invalid numero (expected FACT-YYYY-NNN)' }, { status: 400 })
  }

  // Cible : facture cancelled appartenant au caller
  const { data: target, error: fetchErr } = await supabaseAdmin
    .from('factures')
    .select('id, numero, status, cancelled_at, artisan_user_id')
    .eq('numero', numero)
    .eq('artisan_user_id', user.id)
    .eq('status', 'cancelled')
    .maybeSingle()

  if (fetchErr) {
    logger.error(`[free-fact] fetch failed:`, fetchErr.message)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
  if (!target) {
    return NextResponse.json({ error: 'No cancelled facture matching numero/owner' }, { status: 404 })
  }

  const epoch = target.cancelled_at ? Math.floor(new Date(target.cancelled_at).getTime() / 1000) : Math.floor(Date.now() / 1000)
  const newNumero = `${numero}-VOID-${epoch}`

  const { error: updErr } = await supabaseAdmin
    .from('factures')
    .update({ numero: newNumero })
    .eq('id', target.id)
    .eq('artisan_user_id', user.id)

  if (updErr) {
    logger.error(`[free-fact] update failed:`, updErr.message)
    return NextResponse.json({ error: 'Rename failed', detail: updErr.message }, { status: 500 })
  }

  return NextResponse.json({
    id: target.id,
    old_numero: numero,
    new_numero: newNumero,
  })
}
