import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { isSyndicRole } from '@/lib/auth-helpers'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const status = req.nextUrl.searchParams.get('status') ?? 'pending_review'
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10), 100)

  const { data, error } = await supabase
    .from('syndic_emails_analysed')
    .select('id, from_email, subject, body_preview, received_at, urgence, type_demande, draft_subject, draft_body_text, draft_body_html, draft_status, draft_meta, draft_generated_at')
    .eq('syndic_id', user.id)
    .eq('draft_status', status)
    .order('draft_generated_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ drafts: data ?? [] })
}
