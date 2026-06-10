import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// SÉCURITÉ (audit 2026-06-10) : cet endpoint permettait à tout utilisateur
// authentifié de s'auto-assigner pro_societe / pro_conciergerie /
// pro_gestionnaire (caller.id === user_id passait sans autre garde), en
// contournement direct de l'allowlist de /api/auth/init-role. Politique
// alignée sur init-role :
//   - self-set : UNIQUEMENT pro_societe (onboarding BTP public), et UNIQUEMENT
//     si aucun rôle n'est encore défini (anti re-promotion)
//   - pro_conciergerie / pro_gestionnaire (dormants) : super_admin uniquement
const setProRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['pro_societe', 'pro_conciergerie', 'pro_gestionnaire']),
  org_type: z.string().min(1),
})

function getAnon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

/**
 * POST /api/auth/set-pro-role
 * Sets the correct role in app_metadata after PRO company registration.
 * Auth : self-set limité à pro_societe sans rôle préexistant ; sinon super_admin.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req)
    if (!(await checkRateLimit(`set_pro_role_${ip}`, 10, 60_000))) return rateLimitResponse()

    // Authenticate caller
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: { user: caller }, error: authErr } = await getAnon().auth.getUser(token)
    if (authErr || !caller) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json()
    const parsed = setProRoleSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })

    const { user_id, role, org_type } = parsed.data

    const callerRole = caller.app_metadata?.role
    const isSuperAdmin = callerRole === 'super_admin'

    if (!isSuperAdmin) {
      // Self-set uniquement, et uniquement pro_societe
      if (caller.id !== user_id) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
      if (role !== 'pro_societe') {
        return NextResponse.json({ error: 'Rôle non auto-assignable — attribution par un administrateur uniquement' }, { status: 403 })
      }
      // Anti re-promotion : refus si un rôle est déjà défini (même garde que init-role)
      if (callerRole) {
        return NextResponse.json({ error: 'Rôle déjà défini — changement via un flow admin uniquement' }, { status: 403 })
      }
    }

    // Écrit dans app_metadata (server-only, non forgeable côté client)
    const { data: target } = await supabaseAdmin.auth.admin.getUserById(user_id)
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      app_metadata: { ...(target?.user?.app_metadata || {}), role, org_type },
    })

    if (error) {
      console.error('[set-pro-role] Update error:', error.message)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
