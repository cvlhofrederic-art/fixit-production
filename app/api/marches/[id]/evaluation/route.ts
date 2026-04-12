import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { validateBody, VALID_UUID } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { z } from 'zod'

// ── Validation schema ────────────────────────────────────────────────────────
const createEvaluationSchema = z.object({
  candidature_id: z.string().uuid('candidature_id doit etre un UUID valide'),
  evaluator_type: z.enum(['publisher', 'artisan']),
  note_globale: z.number().int().min(1).max(5),
  note_qualite: z.number().int().min(1).max(5).optional(),
  note_ponctualite: z.number().int().min(1).max(5).optional(),
  note_prix: z.number().int().min(1).max(5).optional(),
  note_communication: z.number().int().min(1).max(5).optional(),
  commentaire: z.string().max(2000).optional(),
  access_token: z.string().max(200).optional(),
})

// GET /api/marches/[id]/evaluation — lister les evaluations d'un marche
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`marches_eval_get_${ip}`, 30, 60_000))) return rateLimitResponse()

  const { id: marcheId } = await params
  if (!VALID_UUID.test(marcheId)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })

  const { data: evaluations, error } = await supabaseAdmin
    .from('marches_evaluations')
    .select('*, marches_candidatures(id, artisan_name, artisan_city, price)')
    .eq('marche_id', marcheId)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('[marches/evaluation] GET error', { error: error.message, marcheId })
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }

  return NextResponse.json({ evaluations: evaluations || [] })
}

// POST /api/marches/[id]/evaluation — soumettre une evaluation
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`marches_eval_post_${ip}`, 5, 60_000))) return rateLimitResponse()

  const { id: marcheId } = await params
  if (!VALID_UUID.test(marcheId)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requete invalide' }, { status: 400 })
  }

  const validation = validateBody(createEvaluationSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: 'Donnees invalides', details: validation.error }, { status: 400 })
  }
  const v = validation.data

  // Verify the marche exists and is in 'awarded' status
  const { data: marche, error: marcheError } = await supabaseAdmin
    .from('marches')
    .select('id, status, access_token')
    .eq('id', marcheId)
    .single()

  if (marcheError || !marche) {
    return NextResponse.json({ error: 'Marche non trouve' }, { status: 404 })
  }

  if (marche.status !== 'awarded') {
    return NextResponse.json({ error: 'Les evaluations ne sont possibles que pour les marches attribues' }, { status: 400 })
  }

  // Verify the candidature exists and belongs to this marche
  const { data: candidature, error: candError } = await supabaseAdmin
    .from('marches_candidatures')
    .select('id, artisan_id, artisan_user_id, status')
    .eq('id', v.candidature_id)
    .eq('marche_id', marcheId)
    .single()

  if (candError || !candidature) {
    return NextResponse.json({ error: 'Candidature non trouvee' }, { status: 404 })
  }

  // ── Publisher evaluating ──────────────────────────────────────────────────
  if (v.evaluator_type === 'publisher') {
    if (!v.access_token || v.access_token !== marche.access_token) {
      return NextResponse.json({ error: 'Token publisher invalide' }, { status: 403 })
    }
  }

  // ── Artisan evaluating ────────────────────────────────────────────────────
  if (v.evaluator_type === 'artisan') {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }

    if (candidature.artisan_user_id !== user.id) {
      return NextResponse.json({ error: 'Cette candidature ne vous appartient pas' }, { status: 403 })
    }
  }

  // Check for duplicate evaluation (same evaluator_type for same candidature)
  const { data: existing } = await supabaseAdmin
    .from('marches_evaluations')
    .select('id')
    .eq('marche_id', marcheId)
    .eq('candidature_id', v.candidature_id)
    .eq('evaluator_type', v.evaluator_type)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Vous avez deja soumis une evaluation pour cette candidature' }, { status: 409 })
  }

  // Insert the evaluation
  const { data: evaluation, error: insertError } = await supabaseAdmin
    .from('marches_evaluations')
    .insert({
      marche_id: marcheId,
      candidature_id: v.candidature_id,
      evaluator_type: v.evaluator_type,
      note_globale: v.note_globale,
      note_qualite: v.note_qualite || null,
      note_ponctualite: v.note_ponctualite || null,
      note_prix: v.note_prix || null,
      note_communication: v.note_communication || null,
      commentaire: v.commentaire || null,
    })
    .select()
    .single()

  if (insertError) {
    logger.error('[marches/evaluation] POST insert error', { error: insertError.message, marcheId })
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }

  // Update candidature flags
  const updateField = v.evaluator_type === 'publisher'
    ? { publisher_evaluated: true }
    : { artisan_evaluated: true }

  await supabaseAdmin
    .from('marches_candidatures')
    .update(updateField)
    .eq('id', v.candidature_id)
    .then(null, (err: unknown) => {
      logger.warn('[marches/evaluation] Failed to update candidature flag', { error: String(err) })
    })

  // If publisher evaluates artisan, recalculate artisan's average rating
  if (v.evaluator_type === 'publisher' && candidature.artisan_id) {
    try {
      const { data: allEvals } = await supabaseAdmin
        .from('marches_evaluations')
        .select('note_globale, marches_candidatures!inner(artisan_id)')
        .eq('evaluator_type', 'publisher')
        .eq('marches_candidatures.artisan_id', candidature.artisan_id)

      if (allEvals && allEvals.length > 0) {
        const avg = allEvals.reduce((sum, e) => sum + e.note_globale, 0) / allEvals.length
        const roundedAvg = Math.round(avg * 10) / 10

        await supabaseAdmin
          .from('profiles_artisan')
          .update({ rating_avg: roundedAvg, rating_count: allEvals.length })
          .eq('id', candidature.artisan_id)
      }
    } catch (err) {
      logger.warn('[marches/evaluation] Failed to recalculate artisan rating', {
        artisan_id: candidature.artisan_id,
        error: String(err),
      })
    }
  }

  return NextResponse.json({ evaluation }, { status: 201 })
}
