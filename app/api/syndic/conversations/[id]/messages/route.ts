// app/api/syndic/conversations/[id]/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { logger } from '@/lib/logger'

const AddMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().min(1),
  tool_calls: z.array(z.any()).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('syndic_ai_messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    logger.error('list messages failed', { error: error.message, user_id: user.id, id })
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
  return NextResponse.json({ messages: data ?? [] })
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = AddMessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('syndic_ai_messages')
    .insert({
      conversation_id: id,
      role: parsed.data.role,
      content: parsed.data.content,
      tool_calls: parsed.data.tool_calls ?? null,
      metadata: parsed.data.metadata ?? null,
    })
    .select()
    .single()

  if (error) {
    logger.error('insert message failed', { error: error.message, user_id: user.id, id })
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
  return NextResponse.json({ message: data }, { status: 201 })
}
