import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-server'

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
 * Sets the correct role in user metadata after PRO company registration.
 * Uses the admin service key to bypass Supabase email confirmation restrictions.
 * Auth: caller must be the target user or a super_admin.
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate caller
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: { user: caller }, error: authErr } = await getAnon().auth.getUser(token)
    if (authErr || !caller) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json()
    const parsed = setProRoleSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })

    const { user_id, role, org_type } = parsed.data

    // Authorize: caller must be the target user or super_admin
    const callerRole = caller.app_metadata?.role
    if (caller.id !== user_id && callerRole !== 'super_admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      user_metadata: { role, org_type },
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
