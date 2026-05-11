// app/api/syndic/conversations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { isSyndicRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

const UpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  archived_at: z.string().datetime().nullable().optional(),
})

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('syndic_ai_conversations')
    .select('*')
    .eq('id', id)
    .eq('syndic_id', user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ conversation: data })
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const allowed = await checkRateLimit(`conv-op:${user.id}`, 60, 60_000)
  if (!allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('syndic_ai_conversations')
    .update(parsed.data)
    .eq('id', id)
    .eq('syndic_id', user.id)
    .select()
    .single()

  if (error || !data) {
    logger.error('update conversation failed', { error: error?.message, user_id: user.id, id })
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ conversation: data })
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const allowed = await checkRateLimit(`conv-op:${user.id}`, 60, 60_000)
  if (!allowed) return rateLimitResponse()

  // Soft delete via archived_at
  const { error } = await supabase
    .from('syndic_ai_conversations')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('syndic_id', user.id)

  if (error) {
    logger.error('archive conversation failed', { error: error.message, user_id: user.id, id })
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
