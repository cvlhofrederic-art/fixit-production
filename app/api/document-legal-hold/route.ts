// ══════════════════════════════════════════════════════════════════════════════
// POST /api/document-legal-hold — Toggle legal_hold (FR-V6)
// ══════════════════════════════════════════════════════════════════════════════
// Permet à l'artisan de marquer un devis ou une facture comme étant sous
// "legal hold" — la rétention auto à 11 ans (anonymisation) est suspendue.
//
// Cas d'usage : litige actif, contrôle fiscal en cours, demande utilisateur
// de conservation prolongée.
//
// Audit log automatique via trigger 080 (action='update' sur status non
// changé mais autres champs modifiés). Pour un audit explicite, le trigger
// pourrait être étendu — pour l'instant, le breadcrumb Sentry suffit.

import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { validateBody } from '@/lib/validation'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export const maxDuration = 15

const legalHoldSchema = z.object({
  docType: z.enum(['devis', 'facture']),
  numero: z.string().min(1).max(100),
  hold: z.boolean(),
  reason: z.string().min(5).max(500).optional(),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await checkRateLimit(`legal_hold_${user.id}`, 20, 60_000))) return rateLimitResponse()

  let raw: unknown
  try { raw = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const v = validateBody(legalHoldSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })

  const { docType, numero, hold, reason } = v.data
  const table: 'devis' | 'factures' = docType === 'facture' ? 'factures' : 'devis'

  // Vérifier ownership + statut actuel
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from(table)
    .select('id, legal_hold')
    .eq('numero', numero)
    .eq('artisan_user_id', user.id)
    .maybeSingle()

  if (fetchErr) {
    logger.error(`[legal-hold] fetch ${table} ${numero} failed:`, fetchErr.message)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
  if (!existing) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  if (existing.legal_hold === hold) {
    return NextResponse.json({ id: existing.id, legal_hold: hold, idempotent: true })
  }

  const { error: updErr } = await supabaseAdmin
    .from(table)
    .update({ legal_hold: hold })
    .eq('id', existing.id)
    .eq('artisan_user_id', user.id)

  if (updErr) {
    logger.error(`[legal-hold] update ${table} ${existing.id} failed:`, updErr.message)
    Sentry.captureException(updErr, {
      tags: { agent_type: 'legal-hold', table, action: hold ? 'set' : 'unset' },
      extra: { numero, reason: reason || null },
    })
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  Sentry.addBreadcrumb({
    category: 'legal-hold',
    message: `${hold ? 'Set' : 'Unset'} legal_hold on ${table} ${numero}`,
    data: { reason: reason || null },
    level: 'info',
  })

  return NextResponse.json({ id: existing.id, legal_hold: hold })
}
