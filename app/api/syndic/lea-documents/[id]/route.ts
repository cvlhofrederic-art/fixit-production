// app/api/syndic/lea-documents/[id]/route.ts
// P1 Léa Documents — GET (détails + signed URL 10 min), PATCH (publication sur le portail
// copropriétaire) et DELETE (Storage + row).
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const SIGNED_URL_TTL_SECONDS = 10 * 60

const IdSchema = z.string().uuid()

/** Rubriques de l'extranet (décret du 17 mars 1967, art. 33-1-1) — contrainte de la migration 20261017. */
const CATEGORIES_EXTRANET = [
  'reglement', 'edd', 'fiche_synthetique', 'carnet_entretien', 'diagnostic', 'assurance',
  'contrat_marche', 'contrat_entretien', 'pv_ag', 'devis_approuve', 'contrat_syndic',
  'convocation', 'budget', 'compte_individuel', 'appel_fonds', 'autre',
] as const

/**
 * Publication d'un document sur le portail copropriétaire : rien n'est visible tant que le
 * syndic ne l'a pas décidé (publie_extranet), dans l'espace commun de l'immeuble ou l'espace
 * personnel d'un seul copropriétaire (coproprio_id obligatoire).
 */
const PatchSchema = z.object({
  publie_extranet: z.boolean().optional(),
  espace_extranet: z.enum(['commun', 'personnel']).optional(),
  coproprio_id: z.string().uuid().nullable().optional(),
  categorie_extranet: z.enum(CATEGORIES_EXTRANET).nullable().optional(),
})

const COLONNES_DOCUMENT = 'id, filename, mime_type, size_bytes, type, status, immeuble_id, tags, uploaded_at, processed_at, error_message, extracted_metadata, publie_extranet, espace_extranet, coproprio_id, categorie_extranet'

/** Colonnes de la migration 20261017 lues avant la mise à jour (fusion avec le corps reçu). */
interface EtatPublication {
  immeuble_id: string | null
  publie_extranet: boolean | null
  espace_extranet: string | null
  coproprio_id: string | null
}

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { cabinetId, error: authError } = await requireSyndicUser(request)
    if (authError) return authError

    const ip = getClientIP(request)
    const allowed = await checkRateLimit(`lea-docs-patch:${ip}`, 60, 60_000)
    if (!allowed) return rateLimitResponse()

    const { id } = await params
    const parsedId = IdSchema.safeParse(id)
    if (!parsedId.success) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

    const corps: unknown = await request.json().catch(() => null)
    const parsed = PatchSchema.safeParse(corps)
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
    }
    const patch = parsed.data
    if (Object.values(patch).every((v) => v === undefined)) {
      return NextResponse.json({ error: 'empty_patch' }, { status: 400 })
    }

    const { data: doc, error: queryError } = await supabaseAdmin
      .from('syndic_documents')
      .select('id, immeuble_id, publie_extranet, espace_extranet, coproprio_id')
      .eq('id', parsedId.data)
      .eq('cabinet_id', cabinetId!)
      .maybeSingle()

    if (queryError) {
      if (queryError.code === '42703') {
        logger.warn('[lea-documents/patch] colonnes extranet absentes (migration 20261017 non appliquée)', queryError)
        return NextResponse.json({ error: 'migration_requise' }, { status: 409 })
      }
      logger.error('[lea-documents/patch] db query failed:', queryError)
      return NextResponse.json({ error: 'db_query_failed' }, { status: 500 })
    }
    if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const etat = doc as EtatPublication
    const publie = patch.publie_extranet ?? etat.publie_extranet === true
    const espace = patch.espace_extranet ?? (etat.espace_extranet === 'personnel' ? 'personnel' : 'commun')
    const coproprioId = patch.coproprio_id !== undefined ? patch.coproprio_id : etat.coproprio_id

    // Le portail filtre par immeuble : un document sans immeuble n'est visible de personne.
    if (publie && !etat.immeuble_id) {
      return NextResponse.json({ error: 'immeuble_requis' }, { status: 400 })
    }
    if (espace === 'personnel' && !coproprioId) {
      return NextResponse.json({ error: 'coproprio_requis' }, { status: 400 })
    }

    if (typeof patch.coproprio_id === 'string') {
      const { data: fiche, error: ficheError } = await supabaseAdmin
        .from('syndic_coproprios')
        .select('id')
        .eq('id', patch.coproprio_id)
        .eq('cabinet_id', cabinetId!)
        .maybeSingle()
      if (ficheError) {
        logger.error('[lea-documents/patch] coproprio query failed:', ficheError)
        return NextResponse.json({ error: 'db_query_failed' }, { status: 500 })
      }
      if (!fiche) return NextResponse.json({ error: 'coproprio_not_found' }, { status: 404 })
    }

    const { data: document, error: updateError } = await supabaseAdmin
      .from('syndic_documents')
      .update(patch)
      .eq('id', parsedId.data)
      .eq('cabinet_id', cabinetId!)
      .select(COLONNES_DOCUMENT)
      .single()

    if (updateError) {
      if (updateError.code === '42703') {
        logger.warn('[lea-documents/patch] colonnes extranet absentes (migration 20261017 non appliquée)', updateError)
        return NextResponse.json({ error: 'migration_requise' }, { status: 409 })
      }
      logger.error('[lea-documents/patch] db update failed:', updateError)
      return NextResponse.json({ error: 'db_update_failed' }, { status: 500 })
    }

    logger.info('[lea-documents/patch] publication portail mise à jour', { id: parsedId.data, cabinetId, ...patch })
    return NextResponse.json({ document })
  } catch (err) {
    logger.error('[lea-documents/patch] unexpected:', err)
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
