import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * Route temporaire d'initialisation de la table syndic_team_members
 * À supprimer après usage.
 * Appel : POST /api/admin/init-team-table avec header x-init-secret: fixit-init-2024
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-init-secret')
  if (secret !== 'fixit-init-2024') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const results: { step: string; ok: boolean; error?: string }[] = []

  // 1. Tenter via RPC (peut ne pas exister)
  try {
    const { error } = await supabaseAdmin.rpc('exec_ddl' as any, { sql: 'SELECT 1' }) as any
    results.push({ step: 'rpc_check', ok: !error, error: error?.message })
  } catch (e: any) {
    results.push({ step: 'rpc_check', ok: false, error: 'RPC exec_ddl not available (normal)' })
  }

  // Fallback: essayer d'insérer directement (si table existe)
  const { data: insertData, error: insertError } = await supabaseAdmin
    .from('syndic_team_members')
    .upsert({
      cabinet_id: 'c018eab3-63d4-4928-b5ba-44dd1db5f579',
      user_id: '3d40c802-b0ea-493d-bf2d-f57cf6237917',
      email: 'htmpro.renovation@gmail.com',
      full_name: 'HTM Pro Renovation',
      role: 'syndic_tech',
      accepted_at: new Date().toISOString(),
      is_active: true,
    }, { onConflict: 'email' })
    .select()

  results.push({
    step: 'insert_htmpro_member',
    ok: !insertError,
    error: insertError?.message,
  })

  const allOk = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok)

  return NextResponse.json({
    summary: `${allOk}/${results.length} étapes OK`,
    member_inserted: !insertError,
    member_data: insertData,
    results,
    failed,
  })
}
