import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { isSyndicRole } from '@/lib/auth-helpers'

const PatchSchema = z.object({
  draft_status: z.enum(['approved', 'sent', 'edited_sent', 'skipped']).optional(),
  draft_subject: z.string().min(1).max(500).optional(),
  draft_body_text: z.string().max(50000).optional(),
  draft_body_html: z.string().max(100000).optional(),
})

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  const updates: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.draft_status) {
    updates.draft_reviewed_at = new Date().toISOString()
    updates.draft_reviewed_by = user.id
  }

  const { data, error } = await supabase
    .from('syndic_emails_analysed')
    .update(updates)
    .eq('id', id)
    .eq('syndic_id', user.id)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ draft: data })
}
