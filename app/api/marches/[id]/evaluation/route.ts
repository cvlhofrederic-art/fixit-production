import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { validateBody, VALID_UUID } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { CACHE_PERSONNEL } from '@/lib/marches-public'
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

  // Les évaluations portent des notes, des commentaires et le prix des candidatures : elles ne sont rendues
  // qu'au publieur (clé de gestion de l'offre) ou à l'entreprise connectée, pour ses seules candidatures.
  const token = new URL(request.url).searchParams.get('token')
  let candidaturesDeLAppelant: string[] | null = null
  if (token) {
    // maybeSingle : un marché introuvable n'est pas une erreur, une panne de la base en est une.
    const { data: marche, error: erreurMarche } = await supabaseAdmin
      .from('marches')
      .select('access_token')
      .eq('id', marcheId)
      .maybeSingle()
    // Marché introuvable ou panne pendant le contrôle : refus dans les deux cas, et la panne laisse une trace.
    if (erreurMarche) logger.error('[marches/evaluation] GET : contrôle de la clé impossible', { error: erreurMarche.message, marcheId })
    if (!marche || token !== marche.access_token) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 403 })
    }
  } else {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Authentification ou token requis' }, { status: 401 })
    const { data: candidatures, error: erreurCandidatures } = await supabaseAdmin
      .from('marches_candidatures')
      .select('id')
      .eq('marche_id', marcheId)
      .eq('artisan_user_id', user.id)
    if (erreurCandidatures) {
      // Une panne n'est pas « aucune candidature » : elle est journalisée et dite, au lieu d'une liste vide.
      logger.error('[marches/evaluation] GET candidatures error', { error: erreurCandidatures.message, marcheId })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    candidaturesDeLAppelant = (candidatures || []).map((c: { id: string }) => c.id)
    if (candidaturesDeLAppelant.length === 0) {
      return NextResponse.json({ evaluations: [] }, { headers: { 'Cache-Control': CACHE_PERSONNEL } })
    }
  }

  // Colonnes réelles de marches_candidatures : le nom de l'entreprise est artisan_company_name.
  let query = supabaseAdmin
    .from('marches_evaluations')
    .select('*, marches_candidatures(id, artisan_company_name, price)')
    .eq('marche_id', marcheId)
    .order('created_at', { ascending: false })
  if (candidaturesDeLAppelant) query = query.in('candidature_id', candidaturesDeLAppelant)

  const { data: evaluations, error } = await query

  if (error) {
    logger.error('[marches/evaluation] GET error', { error: error.message, marcheId })
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }

  return NextResponse.json({ evaluations: evaluations || [] }, { headers: { 'Cache-Control': CACHE_PERSONNEL } })
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

  // Supabase rend un échec dans { error } (la promesse n'est pas rejetée) : il est lu et journalisé.
  const { error: marqueurError } = await supabaseAdmin
    .from('marches_candidatures')
    .update(updateField)
    .eq('id', v.candidature_id)
  if (marqueurError) {
    logger.error('[marches/evaluation] marqueur « évalué » de la candidature non posé', { marcheId, error: marqueurError.message })
  }

  // La note publique de la fiche de l'entreprise (rating_avg, rating_count) n'est pas modifiée ici : elle est tenue
  // par les avis clients (/api/reviews), et la remplacer par la moyenne des seules évaluations de marchés écraserait
  // celle d'une société déjà inscrite. La façon de compter ces évaluations dans la note publique reste à décider.

  return NextResponse.json({ evaluation }, { status: 201 })
}
