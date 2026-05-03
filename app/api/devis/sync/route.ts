import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { validateBody, devisSyncSchema } from '@/lib/validation'
import { supabaseAdmin } from '@/lib/supabase-server'
import { computeDocumentTotalHtCents } from '@/lib/devis-totals'
import { logger } from '@/lib/logger'

export const maxDuration = 30

// Map localStorage status (FR) → DB status enum (EN). Doit rester en sync
// avec lib/document-sync.ts:mapStatus pour que la backfill produise les
// memes valeurs. Source de verite = ce fichier (server-side autoritaire).
function mapStatus(rawStatus: string, table: 'factures' | 'devis'): string {
  if (table === 'devis') {
    // Valid: draft | sent | signed | expired | cancelled
    if (rawStatus === 'brouillon') return 'draft'
    if (rawStatus === 'envoye') return 'sent'
    if (rawStatus === 'signe') return 'signed'
    if (rawStatus === 'expire') return 'expired'
    if (rawStatus === 'annule') return 'cancelled'
    if (['draft', 'sent', 'signed', 'expired', 'cancelled'].includes(rawStatus)) return rawStatus
    return 'draft'
  }
  // factures : pending | paid | overdue | cancelled | refunded
  if (rawStatus === 'brouillon' || rawStatus === 'envoye') return 'pending'
  if (rawStatus === 'paye') return 'paid'
  if (rawStatus === 'en_retard') return 'overdue'
  if (rawStatus === 'annule') return 'cancelled'
  if (rawStatus === 'rembourse') return 'refunded'
  if (['pending', 'paid', 'overdue', 'cancelled', 'refunded'].includes(rawStatus)) return rawStatus
  return 'pending'
}

// POST /api/devis/sync
// Auth Bearer → rate-limit → validate → upsert via service_role.
// onConflict: 'numero,artisan_user_id' (idempotency naturelle, pas de table dediee).
export async function POST(request: NextRequest) {
  // 1. Auth
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Rate limit (60 syncs / min / user — large car batch backfill)
  if (!(await checkRateLimit(`devis_sync_${user.id}`, 60, 60_000))) {
    return rateLimitResponse()
  }

  // 3. Parse + validate
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const v = validateBody(devisSyncSchema, raw)
  if (!v.success) {
    return NextResponse.json({ error: v.error }, { status: 400 })
  }

  const { docType, artisanId, doc } = v.data
  const table: 'devis' | 'factures' = docType === 'facture' ? 'factures' : 'devis'

  // 3bis. Vérification ownership artisanId — empêche un utilisateur
  // authentifié d'écrire sous l'identité d'un autre artisan partageant
  // son user.id (cas équipe BTP). Audit 03/05/2026 CRITIQUE sécurité.
  try {
    const { data: ownedProfiles, error: ownErr } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', user.id)
    if (ownErr) {
      logger.error('[devis-sync] ownership check failed', ownErr.message)
      return NextResponse.json({ error: 'Authorization check failed' }, { status: 500 })
    }
    const ownsArtisan = (ownedProfiles || []).some((p: { id: string }) => p.id === artisanId)
    if (!ownsArtisan) {
      logger.warn(`[devis-sync] forbidden artisanId=${artisanId} user=${user.id}`)
      return NextResponse.json({ error: 'Forbidden — artisanId does not belong to authenticated user' }, { status: 403 })
    }
  } catch (e) {
    logger.error('[devis-sync] ownership check exception', e)
    return NextResponse.json({ error: 'Authorization check failed' }, { status: 500 })
  }

  // 4. Build DB payload
  const totalHtCents = computeDocumentTotalHtCents(doc as Record<string, unknown>)

  const docRec = doc as Record<string, unknown>
  const items = [
    ...((docRec.lines as unknown[]) || []),
    ...((docRec.materialLines as unknown[]) || []),
    ...((docRec.fraisLines as unknown[]) || []),
    ...((docRec.fraisAnnexes as unknown[]) || []),
  ]
  const fraisAnnexes =
    (docRec.fraisAnnexes as unknown[])?.length
      ? docRec.fraisAnnexes
      : (docRec.fraisLines as unknown[]) || []

  const payload: Record<string, unknown> = {
    artisan_user_id: user.id,
    artisan_id: artisanId,
    numero: docRec.docNumber as string,
    client_name: (docRec.clientName as string) || '',
    client_email: (docRec.clientEmail as string) || null,
    chantier_id: (docRec.chantierId as string) || null,
    total_ht_cents: totalHtCents,
    // total_tax_cents / total_ttc_cents : best-effort. La source de verite
    // pour la TVA est dans raw_data.fraisAnnexes — utilise ces valeurs si
    // tu as besoin du detail TTC, total_*_cents sert juste aux stats sommaires.
    total_tax_cents: 0,
    total_ttc_cents: totalHtCents,
    frais_annexes: fraisAnnexes,
    items,
    status: mapStatus((docRec.status as string) || '', table),
    raw_data: doc,
  }

  // 5. Upsert (idempotent via natural PK numero+artisan_user_id)
  const tryUpsert = async (p: Record<string, unknown>) =>
    supabaseAdmin.from(table).upsert(p, { onConflict: 'numero,artisan_user_id' }).select('id').single()

  let result = await tryUpsert(payload)

  // Fallback si raw_data n'existe pas en DB (migration 074 pas appliquee).
  // Ce code de defense en profondeur reproduit le pattern lib/document-sync.ts.
  if (result.error && /column .*raw_data.* does not exist/i.test(result.error.message || '')) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { raw_data: _omit, ...legacy } = payload
    result = await tryUpsert(legacy)
  }

  if (result.error) {
    logger.error(`[devis-sync] upsert ${table} ${payload.numero} failed:`, result.error.message)
    Sentry.captureException(result.error, {
      tags: { agent_type: 'devis-sync', stage: 'upsert', table, doc_type: docType },
      extra: { numero: payload.numero, artisan_id: artisanId, status: payload.status },
    })
    // Pas de leak du detail interne au client (lib/auth-helpers convention).
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }

  return NextResponse.json({
    id: (result.data as { id: string }).id,
    table,
    numero: payload.numero,
    syncedAt: new Date().toISOString(),
  })
}
