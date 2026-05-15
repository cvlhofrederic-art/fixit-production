// app/api/syndic/conversations/[id]/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { isSyndicRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

// `user` / `assistant` / `tool` autorisés depuis le client (le frontend persiste
// la réponse de l'agent après réception). `system` reste serveur-only pour éviter
// l'injection de prompts. L'ownership de la conversation est vérifié par RLS +
// check explicite ci-dessous (defense in depth).
//
// TODO post-MVP : déplacer la persistance de `role: 'assistant'` côté agent
// endpoint pour éviter qu'un client malveillant puisse fabriquer des réponses
// LLM qui prompt-injectent les tours suivants.
const AddMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string().min(1).max(32000),
  tool_calls: z.array(z.unknown()).nullable().optional(),
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
  if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Vérifier ownership de la conversation (defense in depth, en plus de la RLS)
  const { data: ownerCheck } = await supabase
    .from('syndic_ai_conversations')
    .select('syndic_id')
    .eq('id', id)
    .eq('syndic_id', user.id)
    .single()

  if (!ownerCheck) return NextResponse.json({ error: 'not_found' }, { status: 404 })

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
  if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const allowed = await checkRateLimit(`conv-msg-post:${user.id}`, 120, 60_000)
  if (!allowed) return rateLimitResponse()

  // Vérifier ownership de la conversation (defense in depth, en plus de la RLS)
  const { data: ownerCheck } = await supabase
    .from('syndic_ai_conversations')
    .select('syndic_id')
    .eq('id', id)
    .eq('syndic_id', user.id)
    .single()

  if (!ownerCheck) return NextResponse.json({ error: 'not_found' }, { status: 404 })

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
