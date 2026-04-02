import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger, parsePagination } from '@/lib/logger'
import { z } from 'zod'
import { validateBody, syndicCoproprioPOSTSchema } from '@/lib/validation'

const syndicCopropriosBatchSchema = z.object({
  coproprios: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
  coproprio: z.record(z.string(), z.unknown()).optional(),
}).passthrough()

// ── GET /api/syndic/coproprios ──────────────────────────────────────────────
// Retourne tous les copropriétaires du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`copros_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)

    // Filtres optionnels
    const immeuble = request.nextUrl.searchParams.get('immeuble')
    const search = request.nextUrl.searchParams.get('search')

    let query = supabaseAdmin
      .from('syndic_coproprios')
      .select('*')
      .eq('cabinet_id', cabinetId)
      .order('immeuble', { ascending: true })
      .order('batiment', { ascending: true })
      .order('etage', { ascending: true })
      .order('numero_porte', { ascending: true })

    if (immeuble) {
      query = query.eq('immeuble', immeuble)
    }

    if (search) {
      query = query.or(
        `nom_proprietaire.ilike.%${search}%,prenom_proprietaire.ilike.%${search}%,email_proprietaire.ilike.%${search}%,numero_porte.ilike.%${search}%,nom_locataire.ilike.%${search}%`
      )
    }

    const { from, to } = parsePagination(new URL(request.url))
    const { data, error, count } = await query.range(from, to)

    if (error) {
      logger.error('[COPROPRIOS] GET error:', error)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    const response = NextResponse.json({ coproprios: data || [], from, to, count })
    response.headers.set('Cache-Control', 'private, max-age=0, s-maxage=30, stale-while-revalidate=60')
    return response
  } catch (err) {
    logger.error('[syndic/coproprios/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST /api/syndic/coproprios ─────────────────────────────────────────────
// Créer un ou plusieurs copropriétaires (supporte batch pour migration)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    // Double-check write permissions using server-side app_metadata (non-forgeable)
    const { getUserRole } = await import('@/lib/auth-helpers')
    const userRole = getUserRole(user)
    if (userRole !== 'syndic' && userRole !== 'syndic_admin' && userRole !== 'syndic_gestionnaire') {
      return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
    }

    const ip = getClientIP(request)
    if (!(await checkRateLimit(`copros_post_${ip}`, 20, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()
    const batchValidation = validateBody(syndicCopropriosBatchSchema, body)
    if (!batchValidation.success) {
      return NextResponse.json({ error: batchValidation.error }, { status: 400 })
    }

    // Supporte un seul copropriétaire ou un tableau (batch import)
    const items: any[] = Array.isArray(body.coproprios) ? body.coproprios : (body.coproprio ? [body.coproprio] : [body])

    if (items.length === 0) {
      return NextResponse.json({ error: 'Données requises' }, { status: 400 })
    }

    // Limiter le batch à 500 pour éviter les timeouts
    if (items.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 copropriétaires par requête' }, { status: 400 })
    }

    const insertData = items.map(item => ({
      cabinet_id: cabinetId,
      immeuble: item.immeuble || '',
      batiment: item.batiment || '',
      etage: typeof item.etage === 'number' ? item.etage : parseInt(item.etage) || 0,
      numero_porte: item.numeroPorte || item.numero_porte || '',
      nom_proprietaire: item.nomProprietaire || item.nom_proprietaire || '',
      prenom_proprietaire: item.prenomProprietaire || item.prenom_proprietaire || '',
      email_proprietaire: (item.emailProprietaire || item.email_proprietaire || '').toLowerCase().trim(),
      tel_proprietaire: item.telephoneProprietaire || item.tel_proprietaire || '',
      nom_locataire: item.nomLocataire || item.nom_locataire || null,
      prenom_locataire: item.prenomLocataire || item.prenom_locataire || null,
      email_locataire: item.emailLocataire || item.email_locataire ? (item.emailLocataire || item.email_locataire || '').toLowerCase().trim() : null,
      tel_locataire: item.telephoneLocataire || item.tel_locataire || null,
      est_occupe: item.estOccupe ?? item.est_occupe ?? false,
      notes: item.notes || null,
      tantieme: item.tantieme || 0,
      solde: item.solde || 0,
      acces_portail: item.acces_portail ?? item.accesPortail ?? false,
    }))

    const { data, error } = await supabaseAdmin
      .from('syndic_coproprios')
      .insert(insertData)
      .select()

    if (error) {
      logger.error('[COPROPRIOS] POST error:', error)
      return NextResponse.json({ error: 'Erreur création copropriétaire' }, { status: 500 })
    }

    return NextResponse.json({
      coproprios: data,
      count: data?.length || 0,
      message: `${data?.length || 0} copropriétaire(s) créé(s)`,
    })
  } catch (err) {
    logger.error('[syndic/coproprios/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH /api/syndic/coproprios ────────────────────────────────────────────
// Modifier un copropriétaire
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const ip = getClientIP(request)
    if (!(await checkRateLimit(`copros_patch_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()
    const { id, ...fields } = body

    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }

    // Vérifier que ce copropriétaire appartient au cabinet
    const { data: existing } = await supabaseAdmin
      .from('syndic_coproprios')
      .select('id')
      .eq('id', id)
      .eq('cabinet_id', cabinetId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Copropriétaire introuvable' }, { status: 404 })
    }

    // Mapper les champs camelCase → snake_case
    const updates: Record<string, unknown> = {}
    if (fields.immeuble !== undefined) updates.immeuble = fields.immeuble
    if (fields.batiment !== undefined) updates.batiment = fields.batiment
    if (fields.etage !== undefined) updates.etage = typeof fields.etage === 'number' ? fields.etage : parseInt(fields.etage) || 0
    if (fields.numeroPorte !== undefined) updates.numero_porte = fields.numeroPorte
    if (fields.nomProprietaire !== undefined) updates.nom_proprietaire = fields.nomProprietaire
    if (fields.prenomProprietaire !== undefined) updates.prenom_proprietaire = fields.prenomProprietaire
    if (fields.emailProprietaire !== undefined) updates.email_proprietaire = (fields.emailProprietaire || '').toLowerCase().trim()
    if (fields.telephoneProprietaire !== undefined) updates.tel_proprietaire = fields.telephoneProprietaire
    if (fields.nomLocataire !== undefined) updates.nom_locataire = fields.nomLocataire || null
    if (fields.prenomLocataire !== undefined) updates.prenom_locataire = fields.prenomLocataire || null
    if (fields.emailLocataire !== undefined) updates.email_locataire = fields.emailLocataire ? fields.emailLocataire.toLowerCase().trim() : null
    if (fields.telephoneLocataire !== undefined) updates.tel_locataire = fields.telephoneLocataire || null
    if (fields.estOccupe !== undefined) updates.est_occupe = Boolean(fields.estOccupe)
    if (fields.notes !== undefined) updates.notes = fields.notes || null
    if (fields.tantieme !== undefined) updates.tantieme = fields.tantieme
    if (fields.solde !== undefined) updates.solde = fields.solde
    if (fields.accesPortail !== undefined) updates.acces_portail = Boolean(fields.accesPortail)

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('syndic_coproprios')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('[COPROPRIOS] PATCH error:', error)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    return NextResponse.json({ coproprio: data })
  } catch (err) {
    logger.error('[syndic/coproprios/PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE /api/syndic/coproprios ───────────────────────────────────────────
// Supprimer un copropriétaire
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const userRole = user.user_metadata?.role || ''
    if (userRole !== 'syndic' && userRole !== 'syndic_admin') {
      return NextResponse.json({ error: 'Droits insuffisants (admin requis)' }, { status: 403 })
    }

    const ip = getClientIP(request)
    if (!(await checkRateLimit(`copros_delete_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const coproId = request.nextUrl.searchParams.get('id')

    if (!coproId) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('syndic_coproprios')
      .delete()
      .eq('id', coproId)
      .eq('cabinet_id', cabinetId)

    if (error) {
      logger.error('[COPROPRIOS] DELETE error:', error)
      return NextResponse.json({ error: 'Erreur suppression' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('[syndic/coproprios/DELETE] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
