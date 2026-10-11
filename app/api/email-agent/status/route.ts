import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

/**
 * GET /api/email-agent/status — état de la boîte e-mail du cabinet pour l'écran
 * « E-mails Fixy » du Syndic v54 : connectée ou non, fournisseur (provider : 'gmail' |
 * 'microsoft' | null), adresse reliée, derniers e-mails analysés par Alfredo (sans le
 * corps complet ni les tokens).
 * Auth : Bearer, rôles syndic (syndic, syndic_*, super_admin). Lecture via service_role,
 * filtrée sur le cabinet (les RLS de ces tables sont syndic_id = auth.uid()).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 403 })

    const [jeton, emails] = await Promise.all([
      supabaseAdmin
        .from('syndic_oauth_tokens')
        .select('provider, email_compte, access_token, updated_at')
        .eq('syndic_id', cabinetId)
        .maybeSingle(),
      supabaseAdmin
        .from('syndic_emails_analysed')
        .select('id, from_email, subject, resume_ia, received_at, urgence, type_demande, draft_status, draft_subject')
        .eq('syndic_id', cabinetId)
        .order('received_at', { ascending: false })
        .limit(30),
    ])

    if (jeton.error) logger.warn('[email-agent/status] lecture du jeton', { erreur: jeton.error.message })
    if (emails.error) logger.warn('[email-agent/status] lecture des e-mails', { erreur: emails.error.message })

    // Une ligne sans access_token = connexion commencée puis abandonnée (nonce seul).
    const connecte = !!jeton.data?.access_token
    const liste = emails.data ?? []
    return NextResponse.json({
      cabinetId,
      connecte,
      // Colonne provider vide = 'gmail' (valeur par défaut de la colonne).
      provider: connecte ? jeton.data?.provider || 'gmail' : null,
      email: connecte ? jeton.data?.email_compte ?? null : null,
      misAJour: connecte ? jeton.data?.updated_at ?? null : null,
      brouillonsEnAttente: liste.filter(e => e.draft_status === 'pending_review').length,
      emails: liste,
    })
  } catch (err) {
    logger.error('[email-agent/status] erreur inattendue', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
