import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// ════════════════════════════════════════════════════════════════════════════
// POST /api/pro/team/auto-init-gerant
// Appelé une seule fois au signup d'une société BTP. Crée idempotamment le
// gérant comme premier membre de pro_team_members avec role=GERANT.
//
// Sans cette route, le gérant doit s'inviter lui-même manuellement après signup
// pour apparaître dans la liste "Comptes utilisateurs". On l'évite ici.
// ════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`auto_init_gerant_${ip}`, 5, 60_000))) return rateLimitResponse()

  let body: { user_id?: string; email?: string; full_name?: string; phone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const { user_id, email, full_name, phone } = body

  // Sécurité : on ne peut auto-init que pour soi-même
  if (!user_id || user_id !== user.id) {
    return NextResponse.json({ error: 'user_id ne correspond pas' }, { status: 403 })
  }
  if (!email) {
    return NextResponse.json({ error: 'email requis' }, { status: 400 })
  }

  const companyId = user.id // Pour le gérant, company_id = son propre user.id
  const cleanEmail = email.toLowerCase().trim()

  try {
    // Idempotent : si déjà existant, on ne fait rien
    const { data: existing } = await supabaseAdmin
      .from('pro_team_members')
      .select('id, role')
      .eq('company_id', companyId)
      .eq('email', cleanEmail)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ ok: true, alreadyExists: true, member_id: existing.id })
    }

    const { data: member, error } = await supabaseAdmin
      .from('pro_team_members')
      .insert({
        company_id: companyId,
        user_id: user.id,                    // déjà lié (pas d'invitation à accepter)
        email: cleanEmail,
        full_name: (full_name || '').trim() || cleanEmail,
        phone: (phone || '').trim() || '',
        role: 'GERANT',
        assigned_chantiers: [],
        invite_token: null,                  // pas d'invite, lien direct
        invite_sent_at: null,
        accepted_at: new Date().toISOString(), // gérant = accepté instantanément
        is_active: true,
      })
      .select('id')
      .single()

    if (error) {
      logger.error('[auto-init-gerant] insert error:', error)
      return NextResponse.json({ error: 'Erreur création gérant' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, alreadyExists: false, member_id: member?.id })
  } catch (e: unknown) {
    logger.error('[auto-init-gerant] exception:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
