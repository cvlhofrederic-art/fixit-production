import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { resoudreCoproprietaire, statutHttpAcces } from '@/lib/coproprietaire/acces'

// ── POST /api/coproprietaire/signalement/message ─────────────────────────────
// Message du copropriétaire connecté dans le fil de l'une de SES demandes (syndic_signalement_messages,
// rôle 'coproprio'). Le signalement doit appartenir au cabinet de sa fiche et porter son e-mail en
// demandeur : sinon 404, sans dire s'il existe. Le syndic lit le fil dans Canal de communication > Demandes.

const schema = z.object({
  signalementId: z.string().uuid(),
  texte: z.string().trim().min(1).max(5000),
})

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`copro_message_${ip}`, 20, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  const parametres = request.nextUrl.searchParams
  const acces = await resoudreCoproprietaire(user, supabaseAdmin, { coproprioId: parametres.get('lot'), email: parametres.get('email') })
  if (!acces.ok) return NextResponse.json({ error: acces.code }, { status: statutHttpAcces(acces.code) })

  const corps: unknown = await request.json().catch(() => null)
  const validation = schema.safeParse(corps)
  if (!validation.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  const { signalementId, texte } = validation.data

  const { cabinetId, fiche, email, role } = acces.acces
  if (!email) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  try {
    const { data: sig, error: sigErr } = await supabaseAdmin
      .from('syndic_signalements')
      .select('id, demandeur_email')
      .eq('id', signalementId)
      .eq('cabinet_id', cabinetId)
      .eq('demandeur_email', email)
      .is('deleted_at', null)
      .maybeSingle()
    if (sigErr) {
      logger.error('[COPRO MESSAGE] lecture du signalement', { code: sigErr.code, message: sigErr.message })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    if (!sig) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const prenom = (role === 'locataire' ? fiche.prenom_locataire : fiche.prenom_proprietaire) || ''
    const nom = (role === 'locataire' ? fiche.nom_locataire : fiche.nom_proprietaire) || ''
    const auteur = `${prenom} ${nom}`.trim().slice(0, 200) || email

    const { data, error } = await supabaseAdmin
      .from('syndic_signalement_messages')
      .insert({ signalement_id: signalementId, auteur, role: 'coproprio', texte })
      .select('id, auteur, role, texte, created_at')
      .single()
    if (error || !data) {
      logger.error('[COPRO MESSAGE] insertion', { code: error?.code, message: error?.message })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    const { error: majErr } = await supabaseAdmin
      .from('syndic_signalements')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', signalementId)
      .eq('cabinet_id', cabinetId)
    if (majErr) logger.warn('[COPRO MESSAGE] mise à jour de updated_at', { message: majErr.message })

    const ligne = data as { id: string; auteur: string; role: string; texte: string; created_at: string }
    return NextResponse.json({ message: { id: ligne.id, auteur: ligne.auteur, role: ligne.role, texte: ligne.texte, date: ligne.created_at, deMoi: true } })
  } catch (e) {
    logger.error('[COPRO MESSAGE] exception', undefined, e)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }
}
