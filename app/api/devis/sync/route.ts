import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { validateBody, devisSyncSchema, canTransition } from '@/lib/validation'
import { supabaseAdmin } from '@/lib/supabase-server'
import { computeDocumentTotalHtCents, buildDocumentLines } from '@/lib/devis-totals'
import { computeTva, type TvaRegime, type TvaLineInput } from '@/lib/tva-calculator'
import { toCents } from '@/lib/money'
import { logger } from '@/lib/logger'
import { buildHashChainFields, type CanonicalDocPayload } from '@/lib/document-integrity'
import { isStableDocId } from '@/lib/devis-utils'

export const maxDuration = 30

// Map localStorage status (FR) → DB status enum (EN). Doit rester en sync
// avec lib/document-sync.ts:mapStatus pour que la backfill produise les
// memes valeurs. Source de verite = ce fichier (server-side autoritaire).
function mapStatus(rawStatus: string, table: 'factures' | 'devis'): string {
  if (table === 'devis') {
    // Valid: draft | sent | signed | accepted | rejected | expired | cancelled (FR-V7)
    if (rawStatus === 'brouillon') return 'draft'
    if (rawStatus === 'envoye') return 'sent'
    if (rawStatus === 'signe') return 'signed'
    if (rawStatus === 'accepte') return 'accepted'
    if (rawStatus === 'refuse') return 'rejected'
    if (rawStatus === 'expire') return 'expired'
    if (rawStatus === 'annule') return 'cancelled'
    if (['draft', 'sent', 'signed', 'accepted', 'rejected', 'expired', 'cancelled'].includes(rawStatus)) return rawStatus
    return 'draft'
  }
  // factures : draft | pending | paid | overdue | cancelled | refunded
  // brouillon = 'draft' (pas de numéro, non hashé, hors agrégats financiers) ;
  // 'envoye' = émission → 'pending' (numéro légal + hash-chain attribués).
  if (rawStatus === 'brouillon') return 'draft'
  if (rawStatus === 'envoye') return 'pending'
  if (rawStatus === 'paye') return 'paid'
  if (rawStatus === 'en_retard') return 'overdue'
  if (rawStatus === 'annule') return 'cancelled'
  if (rawStatus === 'rembourse') return 'refunded'
  if (['draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded'].includes(rawStatus)) return rawStatus
  // Défaut conservateur : 'pending' (et non 'draft') pour ne pas rétrograder un
  // doc legacy au statut inconnu/vide. Seul 'brouillon' explicite → 'draft'.
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

  // Identité document (méthode pro Stripe) : `id` UUID stable si fourni
  // (brouillon / nouveau modèle), sinon `numero` (legacy émis dont le client
  // n'a pas encore adopté l'id canonique via le hydrate). Au moins une identité
  // non vide est requise. Un brouillon a un id mais numero = null (le numéro
  // légal n'est tiré de next_doc_number qu'à l'émission).
  //
  // `id` n'est retenu comme clé d'upsert QUE s'il est un UUID canonique
  // (isStableDocId). Les docs LEGACY portent un id horodaté Date.now()
  // (ex "1779539827817") : on les traite comme « sans id canonique » →
  // identité par `numero`, et on n'écrit jamais une valeur non-UUID dans la
  // colonne `uuid` (sinon Postgres 22P02). Cf. lib/devis-utils.isStableDocId.
  const docRec = doc as Record<string, unknown>
  const docId = isStableDocId(docRec.id) ? docRec.id : null
  const numeroIn = (typeof docRec.docNumber === 'string' && docRec.docNumber) ? docRec.docNumber : null
  if (!docId && !numeroIn) {
    return NextResponse.json({ error: 'doc.id or doc.docNumber required' }, { status: 400 })
  }

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
  const totalHtCents = computeDocumentTotalHtCents(docRec)

  // Source unique de vérité : `buildDocumentLines` applique le filtrage
  // canonique des sections masquées (materialLinesEnabled/fraisLinesEnabled),
  // le fallback laborLines → lines, et l'aplatissement customTables avec
  // garde null-safe. Aucune sommation à la main ici — invariant garanti.
  const items = buildDocumentLines(docRec as Parameters<typeof buildDocumentLines>[0]) as unknown[]
  const fraisAnnexes =
    (docRec.fraisAnnexes as unknown[])?.length
      ? docRec.fraisAnnexes
      : (docRec.fraisLines as unknown[]) || []

  // 4bis. Régime TVA + calcul officiel (corrige bug antérieur total_tax_cents=0).
  // computeTva() force totalTVA=0 et totalTTC=totalHT en régime franchise/autoliq.
  // En classique, agrège la TVA par taux à partir des lignes (BOFiP §50).
  const regimeTva: TvaRegime =
    (docRec.regimeTva as TvaRegime) ?? 'classique'
  const tvaLines: TvaLineInput[] = items
    .filter((l): l is Record<string, unknown> => l != null && typeof l === 'object')
    .map(l => ({
      totalHT: Number(l.totalHT ?? l.total_ht ?? l.total ?? 0),
      tvaRate: Number(l.tvaRate ?? l.tva_rate ?? 0),
    }))
  const tva = computeTva({ regime: regimeTva, lines: tvaLines })
  const totalTaxCents = toCents(tva.totalTVA)
  const totalTtcCents = toCents(tva.totalTTC)

  const incomingStatus = mapStatus((docRec.status as string) || '', table)

  // 4bis. Transition guard (FR-V1) — empêche les retours en arrière interdits
  // (`paid → pending`, `signed → draft`...). Migration 079 ajoute aussi un
  // trigger PG defense-in-depth, mais on rejette ici dès le 409 pour éviter
  // un round-trip DB inutile + retourner un message clair côté client.
  // FR-V1.1 : on récupère aussi content_hash pour permettre le rattrapage
  // de hash chain sur des docs émis avant que DOC_HASH_SECRET soit configuré.
  let currentStatus: string | null = null
  let existingContentHash: string | null = null
  // Propriétaire de la ligne existante (le cas échéant) — pour le contrôle IDOR
  // ci-dessous. On le récupère dans le même lookup pour éviter un round-trip.
  let existingOwner: string | null = null
  // Id de la ligne existante : sert à distinguer une vraie transition (même doc)
  // d'une COLLISION DE NUMÉRO entre deux documents différents (cf. plus bas).
  let existingId: string | null = null
  {
    const sel = supabaseAdmin.from(table).select('id, status, content_hash, artisan_user_id')
    const { data: existing, error: lookupErr } = await (
      docId ? sel.eq('id', docId) : sel.eq('numero', numeroIn as string).eq('artisan_user_id', user.id)
    ).maybeSingle()
    if (lookupErr) {
      // Fallback si la colonne content_hash n'existe pas (migration 081 non appliquée).
      // Ne JAMAIS swallow silently une vraie erreur DB : retour 500.
      if (/column .*content_hash.* does not exist/i.test(lookupErr.message || '')) {
        const selFb = supabaseAdmin.from(table).select('id, status, artisan_user_id')
        const fb = await (
          docId ? selFb.eq('id', docId) : selFb.eq('numero', numeroIn as string).eq('artisan_user_id', user.id)
        ).maybeSingle()
        if (fb.error) {
          logger.error(`[devis-sync] status lookup fallback failed ${docRec.docNumber}:`, fb.error.message)
          Sentry.captureException(fb.error, {
            tags: { agent_type: 'devis-sync', stage: 'status-lookup-fallback', table },
            extra: { numero: docRec.docNumber, artisan_id: artisanId },
          })
          return NextResponse.json({ error: 'Status lookup failed' }, { status: 500 })
        }
        currentStatus = (fb.data?.status as string) || null
        existingOwner = (fb.data?.artisan_user_id as string) || null
        existingId = (fb.data?.id as string) || null
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
      existingOwner = (existing?.artisan_user_id as string) || null
      existingId = (existing?.id as string) || null
    }
  }

  // SÉCURITÉ (IDOR) — le chemin `docId` fait un upsert `onConflict='id'` (clé
  // GLOBALE, non scopée par propriétaire). La route est en `supabaseAdmin`
  // (service_role) → la RLS ne s'applique pas. Si une ligne existe déjà pour cet
  // `id` et appartient à un AUTRE artisan, refuser : sinon un attaquant
  // authentifié qui connaît le UUID d'un document d'autrui pourrait l'écraser et
  // se l'attribuer (artisan_user_id réassigné). Le chemin `numero` est déjà sûr
  // (lookup ET onConflict scopés par artisan_user_id).
  if (existingOwner && existingOwner !== user.id) {
    logger.warn(`[devis-sync] forbidden cross-owner write table=${table} docId=${docId} user=${user.id}`)
    Sentry.captureException(new Error('devis-sync cross-owner write blocked'), {
      tags: { agent_type: 'devis-sync', stage: 'idor-guard', table },
      extra: { docId, artisan_id: artisanId },
    })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const docTypeForGuard: 'devis' | 'facture' = docType
  if (currentStatus && !canTransition(currentStatus, incomingStatus, docTypeForGuard)) {
    // Discriminateur COLLISION DE NUMÉRO vs vraie transition.
    // Si la ligne existante (retrouvée par numéro ou par id) porte un id
    // DIFFÉRENT de l'id stable entrant, ce n'est PAS une transition arrière du
    // même document : ce sont DEUX documents distincts qui se disputent le même
    // numéro légal (typiquement après un fallback de numérotation localStorage
    // sur un device neuf — cause racine du bug « doc qui disparaît »). On le
    // signale par un corps distinct `numero_collision` pour que le client
    // renumérote le doc entrant et resynchronise, AU LIEU de le perdre.
    // Le cas même-id (existingId === docId, ou pas d'id stable des deux côtés)
    // reste un vrai conflit de transition → réponse inchangée.
    // NB : on exige docId NON-NULL (id canonique entrant). Un doc LEGACY (docId
    // null, retrouvé par numéro) qui resync SA PROPRE ligne ne doit JAMAIS être
    // vu comme une collision (sinon renumérotation à tort) → vrai conflit.
    const isNumberCollision =
      !!existingId && !!docId && existingId !== docId
    if (isNumberCollision) {
      logger.warn(`[devis-sync] numero collision ${docRec.docNumber} existing=${existingId} incoming=${docId ?? '(no-id)'}`)
      return NextResponse.json({ error: 'numero_collision' }, { status: 409 })
    }
    logger.warn(`[devis-sync] invalid transition ${currentStatus} -> ${incomingStatus} on ${docRec.docNumber}`)
    return NextResponse.json({
      error: 'Invalid status transition',
      current: currentStatus,
      incoming: incomingStatus,
    }, { status: 409 })
  }

  const payload: Record<string, unknown> = {
    // id : identité stable → permet onConflict='id' (update in-place sur tout le
    // cycle brouillon→émis). Absent pour les docs legacy → onConflict tombe sur
    // numero+artisan_user_id. numero = null pour un brouillon (pas encore émis).
    ...(docId ? { id: docId } : {}),
    artisan_user_id: user.id,
    artisan_id: artisanId,
    numero: numeroIn,
    client_name: (docRec.clientName as string) || '',
    client_email: (docRec.clientEmail as string) || null,
    chantier_id: (docRec.chantierId as string) || null,
    total_ht_cents: totalHtCents,
    // Calculé par computeTva() selon le régime — source unique de vérité
    // (cf. lib/tva-calculator.ts). En franchise/autoliquidation : tax=0, ttc=ht.
    // En classique : agrégation par taux (BOFiP §50).
    total_tax_cents: totalTaxCents,
    total_ttc_cents: totalTtcCents,
    regime_tva: regimeTva,
    client_type: (docRec.clientType as string) || null,
    client_siren: (docRec.clientSiren as string) || null,
    tva_intra_emetteur: (docRec.tvaIntraEmetteur as string) || null,
    tva_intra_preneur: (docRec.tvaIntraPreneur as string) || null,
    frais_annexes: fraisAnnexes,
    items,
    status: incomingStatus,
    raw_data: doc,
  }

  // Avoir : référence à la facture corrigée (factures uniquement, pas sur devis)
  if (table === 'factures' && docRec.avoirDeFactureId) {
    payload.avoir_de_facture_id = docRec.avoirDeFactureId
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
        numero: numeroIn as string,
        artisan_user_id: user.id,
        client_name: (docRec.clientName as string) || '',
        total_ht_cents: totalHtCents,
        total_tax_cents: totalTaxCents,
        total_ttc_cents: totalTtcCents,
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

  // 5. Upsert idempotent. Clé de conflit = `id` (identité stable, update in-place
  //    brouillon→émis) si fourni ; sinon `numero,artisan_user_id` (legacy émis).
  //    La contrainte UNIQUE(numero, artisan_user_id) reste un garde-fou contre
  //    deux numéros émis identiques même via le chemin id.
  const conflictTarget = docId ? 'id' : 'numero,artisan_user_id'
  const tryUpsert = async (p: Record<string, unknown>) =>
    supabaseAdmin.from(table).upsert(p, { onConflict: conflictTarget }).select('id').single()

  let result = await tryUpsert(payload)

  // Fallback si raw_data n'existe pas en DB (migration 074 pas appliquee).
  // Ce code de defense en profondeur reproduit le pattern lib/document-sync.ts.
  if (result.error && /column .*raw_data.* does not exist/i.test(result.error.message || '')) {
    const { raw_data: _omit, ...legacy } = payload
    result = await tryUpsert(legacy)
  }

  // Fallback si les colonnes régime TVA (migration 20260514) ne sont pas
  // encore appliquées en prod. On strip les nouveaux champs et on retente
  // pour ne pas bloquer le sync. Sentry capture le cas pour suivi.
  if (
    result.error &&
    /column .*(regime_tva|client_type|client_siren|tva_intra_emetteur|tva_intra_preneur|avoir_de_facture_id).* does not exist/i.test(
      result.error.message || '',
    )
  ) {
    Sentry.captureMessage('Migration 20260514_tva_regime_facturation non appliquée — sync en mode legacy', {
      level: 'warning',
      tags: { agent_type: 'devis-sync', stage: 'tva-regime-fallback', table },
    })
    const legacy = { ...payload }
    delete legacy.regime_tva
    delete legacy.client_type
    delete legacy.client_siren
    delete legacy.tva_intra_emetteur
    delete legacy.tva_intra_preneur
    delete legacy.avoir_de_facture_id
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
