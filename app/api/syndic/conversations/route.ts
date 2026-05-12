// app/api/syndic/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { isSyndicRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

const CreateConversationSchema = z.object({
  agent_id: z.enum(['fixy', 'max', 'lea', 'alfredo']),
  locale: z.enum(['fr', 'pt']),
  title: z.string().min(1).max(200).optional(),
  immeuble_id: z.string().uuid().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const ip = getClientIP(req)
  const allowed = await checkRateLimit(`conv-list:${ip}`, 60, 60_000)
  if (!allowed) return rateLimitResponse()

  const agentId = req.nextUrl.searchParams.get('agent_id')
  let query = supabase
    .from('syndic_ai_conversations')
    .select('*')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (agentId) query = query.eq('agent_id', agentId)

  const { data, error } = await query
  if (error) {
    logger.error('list conversations failed', { error: error.message, user_id: user.id })
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
  return NextResponse.json({ conversations: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = CreateConversationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.issues }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('syndic_ai_conversations')
    .insert({
      syndic_id: user.id,
      agent_id: parsed.data.agent_id,
      locale: parsed.data.locale,
      title: parsed.data.title ?? 'Nouvelle conversation',
      immeuble_id: parsed.data.immeuble_id ?? null,
    })
    .select()
    .single()

  if (error) {
    logger.error('create conversation failed', { error: error.message, user_id: user.id })
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
  return NextResponse.json({ conversation: data }, { status: 201 })
}
