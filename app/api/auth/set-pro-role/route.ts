import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * POST /api/auth/set-pro-role
 * Sets the correct role in user metadata after PRO company registration.
 * Uses the admin service key to bypass Supabase email confirmation restrictions.
 */
export async function POST(req: NextRequest) {
  try {
    const { user_id, role, org_type } = await req.json()

    if (!user_id || !role || !org_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const allowedRoles = ['pro_societe', 'pro_conciergerie', 'pro_gestionnaire']
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      user_metadata: { role, org_type },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
