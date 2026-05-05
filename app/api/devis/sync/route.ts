import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { validateBody, devisSyncSchema, canTransition } from '@/lib/validation'
import { supabaseAdmin } from '@/lib/supabase-server'
import { computeDocumentTotalHtCents } from '@/lib/devis-totals'
import { logger } from '@/lib/logger'
import { buildHashChainFields, type CanonicalDocPayload } from '@/lib/document-integrity'

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

  // 3bis. Vérification ownership artisanId.
  //
  // Deux paths d'autorisation valides :
  //   A) Artisan solo / gérant BTP : profiles_artisan.user_id === user.id
  //      ET profiles_artisan.id === artisanId
  //   B) Membre d'équipe BTP : pro_team_members.user_id === user.id AND
  //      pro_team_members.is_active = true → on autorise le sync sous
  //      l'artisanId de la company (profiles_artisan.user_id === company_id)
  //
  // Hotfix audit 04/05/2026 : path B ajouté. Avant, les membres BTP
  // (COMPTABLE/SECRETAIRE) recevaient un 403 systématique car ils n'ont pas
  // de ligne profiles_artisan avec user_id = leur user_id.
  try {
    // Path A : profil artisan direct
    const { data: ownedProfiles, error: ownErr } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', user.id)
    if (ownErr) {
      logger.error('[devis-sync] ownership check (direct) failed', ownErr.message)
      return NextResponse.json({ error: 'Authorization check failed' }, { status: 500 })
    }
    let ownsArtisan = (ownedProfiles || []).some((p: { id: string }) => p.id === artisanId)

    // Path B : membre d'équipe BTP — résoudre via pro_team_members
    if (!ownsArtisan) {
      const { data: memberships, error: memErr } = await supabaseAdmin
        .from('pro_team_members')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
      if (memErr) {
        logger.error('[devis-sync] ownership check (team) failed', memErr.message)
        return NextResponse.json({ error: 'Authorization check failed' }, { status: 500 })
      }
      const companyIds = (memberships || []).map((m: { company_id: string }) => m.company_id).filter(Boolean)
      if (companyIds.length > 0) {
        const { data: companyProfiles, error: cpErr } = await supabaseAdmin
          .from('profiles_artisan')
          .select('id')
          .in('user_id', companyIds)
        if (cpErr) {
          logger.error('[devis-sync] ownership check (company profiles) failed', cpErr.message)
          return NextResponse.json({ error: 'Authorization check failed' }, { status: 500 })
        }
        ownsArtisan = (companyProfiles || []).some((p: { id: string }) => p.id === artisanId)
      }
    }

    if (!ownsArtisan) {
      logger.warn(`[devis-sync] forbidden artisanId=${artisanId} user=${user.id}`)
      return NextResponse.json({ error: 'Forbidden — artisanId does not belong to authenticated user or team' }, { status: 403 })
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

  const incomingStatus = mapStatus((docRec.status as string) || '', table)

  // 4bis. Transition guard (FR-V1) — empêche les retours en arrière interdits
  // (`paid → pending`, `signed → draft`...). Migration 079 ajoute aussi un
  // trigger PG defense-in-depth, mais on rejette ici dès le 409 pour éviter
  // un round-trip DB inutile + retourner un message clair côté client.
  // FR-V1.1 : on récupère aussi content_hash pour permettre le rattrapage
  // de hash chain sur des docs émis avant que DOC_HASH_SECRET soit configuré.
  let currentStatus: string | null = null
  let existingContentHash: string | null = null
  {
    const { data: existing, error: lookupErr } = await supabaseAdmin
      .from(table)
      .select('status, content_hash')
      .eq('numero', docRec.docNumber as string)
      .eq('artisan_user_id', user.id)
      .maybeSingle()
    if (lookupErr) {
      // Fallback si la colonne content_hash n'existe pas (migration 081 non appliquée).
      // Ne JAMAIS swallow silently une vraie erreur DB : retour 500.
      if (/column .*content_hash.* does not exist/i.test(lookupErr.message || '')) {
        const fb = await supabaseAdmin
          .from(table)
          .select('status')
          .eq('numero', docRec.docNumber as string)
          .eq('artisan_user_id', user.id)
          .maybeSingle()
        if (fb.error) {
          logger.error(`[devis-sync] status lookup fallback failed ${docRec.docNumber}:`, fb.error.message)
          Sentry.captureException(fb.error, {
            tags: { agent_type: 'devis-sync', stage: 'status-lookup-fallback', table },
            extra: { numero: docRec.docNumber, artisan_id: artisanId },
          })
          return NextResponse.json({ error: 'Status lookup failed' }, { status: 500 })
        }
        currentStatus = (fb.data?.status as string) || null
      } else {
        logger.error(`[devis-sync] status lookup failed ${docRec.docNumber}:`, lookupErr.message)
        Sentry.captureException(lookupErr, {
          tags: { agent_type: 'devis-sync', stage: 'status-lookup', table },
          extra: { numero: docRec.docNumber, artisan_id: artisanId },
        })
        return NextResponse.json({ error: 'Status lookup failed' }, { status: 500 })
      }
    } else {
      currentStatus = (existing?.status as string) || null
      existingContentHash = (existing?.content_hash as string) || null
    }
  }

  const docTypeForGuard: 'devis' | 'facture' = docType
  if (currentStatus && !canTransition(currentStatus, incomingStatus, docTypeForGuard)) {
    logger.warn(`[devis-sync] invalid transition ${currentStatus} -> ${incomingStatus} on ${docRec.docNumber}`)
    return NextResponse.json({
      error: 'Invalid status transition',
      current: currentStatus,
      incoming: incomingStatus,
    }, { status: 409 })
  }

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
    status: incomingStatus,
    raw_data: doc,
  }

  // 4ter. Hash chain (FR-V1.1) — calcul si :
  //   1. doc en état émis (sent pour devis, pending pour facture)
  //   2. ET pas encore de content_hash en DB (premier hash OU rattrapage si
  //      DOC_HASH_SECRET vient d'être configuré sur des docs déjà émis).
  // Les documents brouillons (status draft) n'ont pas de hash.
  const inEmittedState =
    (table === 'devis' && incomingStatus === 'sent') ||
    (table === 'factures' && incomingStatus === 'pending')
  const isFirstIssuance = inEmittedState && !existingContentHash

  if (isFirstIssuance && process.env.DOC_HASH_SECRET) {
    try {
      const canonical: CanonicalDocPayload = {
        numero: docRec.docNumber as string,
        artisan_user_id: user.id,
        client_name: (docRec.clientName as string) || '',
        total_ht_cents: totalHtCents,
        total_tax_cents: 0,
        total_ttc_cents: totalHtCents,
        items,
        signed_at: new Date().toISOString(),
      }
      const chain = await buildHashChainFields(table, canonical)
      payload.content_hash = chain.content_hash
      payload.previous_hash = chain.previous_hash
      payload.chain_signature = chain.chain_signature
      payload.signed_at = chain.signed_at
    } catch (e) {
      logger.error('[devis-sync] hash chain build failed:', e)
      Sentry.captureException(e, {
        tags: { agent_type: 'devis-sync', stage: 'hash-chain', table },
        extra: { numero: docRec.docNumber, artisan_id: artisanId },
      })
      return NextResponse.json({ error: 'Document integrity build failed' }, { status: 500 })
    }
  } else if (isFirstIssuance) {
    // FR-V8 audit fix : escalation Sentry en prod. DOC_HASH_SECRET DOIT être
    // configuré en prod (cf. attestation éditeur opposable DGFiP). Si on tombe
    // ici en prod, l'inaltérabilité ISCA est cassée → exception critique.
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('[devis-sync] DOC_HASH_SECRET not set — hash chain skipped (dev/test)')
    } else {
      logger.error(`[devis-sync] CRITICAL: DOC_HASH_SECRET missing in prod for ${docRec.docNumber}`)
      Sentry.captureMessage(
        'DOC_HASH_SECRET missing in production — hash chain skipped, ISCA broken',
        {
          level: 'error',
          tags: { agent_type: 'devis-sync', stage: 'hash-chain-missing-secret', table },
          extra: { numero: docRec.docNumber, artisan_id: artisanId },
        },
      )
    }
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
