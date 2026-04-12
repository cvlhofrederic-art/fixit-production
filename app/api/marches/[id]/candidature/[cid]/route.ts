import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { updateCandidatureStatusSchema, validateBody, VALID_UUID } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── PATCH /api/marches/[id]/candidature/[cid] — Accept or reject a bid ──────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { id: marcheId, cid: candidatureId } = await params
  if (!VALID_UUID.test(marcheId) || !VALID_UUID.test(candidatureId)) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
  }

  // ── Rate limit: 10 requests/min per IP ──
  const ip = getClientIP(request)
  const allowed = await checkRateLimit(`candidature_patch_${ip}`, 10, 60_000)
  if (!allowed) return rateLimitResponse()

  try {
    const body = await request.json()

    // ── Validate body ──
    const validation = validateBody(updateCandidatureStatusSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { status } = validation.data

    // ── Fetch parent marche to verify ownership ──
    const { data: marche, error: marcheError } = await supabaseAdmin
      .from('marches')
      .select('id, title, publisher_user_id, access_token, status')
      .eq('id', marcheId)
      .single()

    if (marcheError || !marche) {
      return NextResponse.json({ error: 'Marché introuvable' }, { status: 404 })
    }

    // ── Auth: access_token in body OR authenticated publisher ──
    let authorized = false

    if (body.access_token && body.access_token === marche.access_token) {
      authorized = true
    } else {
      const user = await getAuthUser(request)
      if (user && user.id === marche.publisher_user_id) {
        authorized = true
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // ── Fetch candidature and verify it belongs to this marche ──
    const { data: candidature, error: candidatureError } = await supabaseAdmin
      .from('marche_candidatures')
      .select('id, marche_id, artisan_id, status')
      .eq('id', candidatureId)
      .single()

    if (candidatureError || !candidature) {
      return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 })
    }

    if (candidature.marche_id !== marcheId) {
      return NextResponse.json(
        { error: 'Cette candidature n\'appartient pas à ce marché' },
        { status: 400 }
      )
    }

    // ── Update candidature status ──
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('marche_candidatures')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', candidatureId)
      .select()
      .single()

    if (updateError) {
      logger.error('Failed to update candidature', { candidatureId, status, error: updateError.message })
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }

    // ── Side effects based on status ──
    if (status === 'accepted') {
      // Mark marche as awarded
      await supabaseAdmin
        .from('marches')
        .update({ status: 'awarded', updated_at: new Date().toISOString() })
        .eq('id', marcheId)

      // Notify winning artisan
      await supabaseAdmin.from('artisan_notifications').insert({
        artisan_id: candidature.artisan_id,
        type: 'marche_won',
        title: 'Marché remporté !',
        body: `Votre candidature pour "${marche.title}" a été acceptée.`,
      })

      logger.info('Candidature accepted — marche awarded', { marcheId, candidatureId, artisanId: candidature.artisan_id })
    } else if (status === 'rejected') {
      // Notify rejected artisan
      await supabaseAdmin.from('artisan_notifications').insert({
        artisan_id: candidature.artisan_id,
        type: 'marche_rejected',
        title: 'Candidature non retenue',
        body: `Votre candidature pour "${marche.title}" n'a pas été retenue.`,
      })

      logger.info('Candidature rejected', { marcheId, candidatureId, artisanId: candidature.artisan_id })
    }

    return NextResponse.json({ candidature: updated })
  } catch (err) {
    logger.error('PATCH /api/marches/[id]/candidature/[cid] error', {
      marcheId,
      candidatureId,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
