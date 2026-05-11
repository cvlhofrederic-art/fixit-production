// app/api/syndic/alfredo-chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { callGroqWithRetry } from '@/lib/groq'
import { traceAgent } from '@/lib/langfuse'
import { buildAlfredoSystemPromptFR } from '@/lib/syndic/prompts/alfredo/system-prompt-fr'
import { buildAlfredoSystemPromptPT } from '@/lib/syndic/prompts/alfredo/system-prompt-pt'
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'
import type { SyndicRole } from '@/lib/syndic/agent-types'
import type { AlfredoChatContext } from '@/lib/syndic/prompts/alfredo/system-prompt-fr'

const BodySchema = z.object({
  conversation_id: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system', 'tool']),
        content: z.string(),
      }),
    )
    .max(60)
    .optional(),
  locale: z.enum(['fr', 'pt']).optional(),
})

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const allowed = await checkRateLimit(`alfredo-chat:${ip}`, 30, 60_000)
  if (!allowed) return rateLimitResponse()

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isSyndicRole(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const locale = parsed.data.locale ?? 'fr'

  const { data: countsData } = await supabase
    .from('syndic_emails_analysed')
    .select('draft_status')
    .eq('syndic_id', user.id)
    .limit(1000)

  const counts = (countsData ?? []) as Array<{ draft_status: string }>
  const pending = counts.filter((c) => c.draft_status === 'pending_review').length

  const { data: gmailToken } = await supabase
    .from('syndic_oauth_tokens')
    .select('syndic_id')
    .eq('syndic_id', user.id)
    .maybeSingle()

  const userRole = (user.user_metadata?.role as SyndicRole) ?? 'syndic'

  const promptCtx: AlfredoChatContext = {
    role: userRole,
    inbox_pending_count: pending,
    inbox_total_count: counts.length,
    gmail_connected: !!gmailToken,
  }

  const { sanitized: sanitizedCtx, tokenMap } = sanitizeContextForLLM(promptCtx)
  const systemPrompt =
    locale === 'pt'
      ? buildAlfredoSystemPromptPT(sanitizedCtx as AlfredoChatContext)
      : buildAlfredoSystemPromptFR(sanitizedCtx as AlfredoChatContext)

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...(parsed.data.history ?? []),
    { role: 'user' as const, content: parsed.data.message },
  ]

  try {
    const groqResponse = await traceAgent(
      {
        agent_id: 'alfredo',
        user_id: user.id,
        conversation_id: parsed.data.conversation_id,
        prompt: parsed.data.message,
      },
      () => callGroqWithRetry({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.4,
        max_tokens: 1500,
      }),
    )
    const rawContent = groqResponse.choices?.[0]?.message?.content ?? ''
    const resolvedContent = resolveSanitizedToken(rawContent, tokenMap) ?? rawContent
    return NextResponse.json({ content: resolvedContent })
  } catch (err) {
    logger.error('alfredo-chat groq error', {
      error: err instanceof Error ? err.message : String(err),
      user_id: user.id,
    })
    return NextResponse.json({ error: 'agent_error' }, { status: 502 })
  }
}
