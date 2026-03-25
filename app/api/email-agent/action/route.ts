import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { validateBody, emailAgentActionPostSchema } from '@/lib/validation'

// ── Applique une action sur un email analysé ──────────────────────────────────
// Actions : 'archiver' | 'marquer_traite' | 'creer_mission' | 'ajouter_note'
export async function POST(request: NextRequest) {
  try {
    // Auth — vérifier que l'utilisateur est syndic
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const _body = await request.json()
    const validation = validateBody(emailAgentActionPostSchema, _body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { email_id, syndic_id, action, note } = validation.data as any

    // Sécurité : le syndic_id du body DOIT correspondre à l'utilisateur authentifié
    // ou être un membre du même cabinet
    if (user.id !== syndic_id && user.user_metadata?.cabinet_id !== syndic_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Valider l'action
    const validActions = ['archiver', 'marquer_traite', 'creer_mission', 'ajouter_note']
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
    }

    // Vérifier que l'email appartient bien à ce syndic
    const { data: email, error: fetchErr } = await supabaseAdmin
      .from('syndic_emails_analysed')
      .select('*')
      .eq('id', email_id)
      .eq('syndic_id', syndic_id)
      .single()

    if (fetchErr || !email) {
      return NextResponse.json({ error: 'Email non trouvé' }, { status: 404 })
    }

    let updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    switch (action) {
      case 'archiver':
        updateData.statut = 'archive'
        break

      case 'marquer_traite':
        updateData.statut = 'traite'
        break

      case 'ajouter_note':
        updateData.note_interne = note || ''
        break

      case 'creer_mission':
        // Créer une mission depuis l'email (dans la table syndic_missions si elle existe, sinon retour des données)
        updateData.statut = 'mission_cree'
        return NextResponse.json({
          success: true,
          action: 'creer_mission',
          mission_data: {
            description: email.resume_ia || email.subject,
            immeuble: email.immeuble_detecte || '',
            type: getMissionType(email.type_demande),
            priorite: email.urgence === 'haute' ? 'urgente' : email.urgence === 'moyenne' ? 'normale' : 'planifiee',
            contact: email.from_email,
            source_email_id: email_id,
          },
          message: 'Données de mission prêtes — créez la mission dans l\'onglet Missions'
        })

      default:
        return NextResponse.json({ error: `Action inconnue : ${action}` }, { status: 400 })
    }

    const { error: updateErr } = await supabaseAdmin
      .from('syndic_emails_analysed')
      .update(updateData)
      .eq('id', email_id)

    if (updateErr) {
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    return NextResponse.json({ success: true, action, email_id, new_statut: updateData.statut })

  } catch (err: unknown) {
    logger.error('[email-agent/action] Error:', err)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }
}

function getMissionType(typeDemande: string): string {
  const map: Record<string, string> = {
    signalement_panne: 'Dépannage',
    demande_devis: 'Devis',
    reclamation: 'Réclamation',
    ag: 'Assemblée',
    facturation: 'Facturation',
    autre: 'Autre',
  }
  return map[typeDemande] || 'Autre'
}
