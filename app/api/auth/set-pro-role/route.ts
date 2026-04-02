import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'

const setProRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['pro_societe', 'pro_conciergerie', 'pro_gestionnaire']),
  org_type: z.string().min(1),
})

/**
 * POST /api/auth/set-pro-role
 * Sets the correct role in user metadata after PRO company registration.
 * Uses the admin service key to bypass Supabase email confirmation restrictions.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = setProRoleSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })

    const { user_id, role, org_type } = parsed.data

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
