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
import { searchEmails, regenerateDraft, bulkAction, summarizeInbox } from '@/lib/syndic/alfredo-chat-tools'
import type { SyndicRole, Locale } from '@/lib/syndic/agent-types'
import type { AlfredoChatContext } from '@/lib/syndic/prompts/alfredo/system-prompt-fr'

const BodySchema = z.object({
  conversation_id: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  // Renommé `history` → `conversation_history` pour aligner avec le hook frontend
  // `useAgentStream` (cf. components/syndic-dashboard/agents-ia/hooks/useAgentStream.ts).
  // Un alias `history` reste accepté pour ne pas casser d'éventuels clients existants.
  conversation_history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system', 'tool']),
        content: z.string(),
      }),
    )
    .max(60)
    .optional(),
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
  syndic_context: z.record(z.string(), z.unknown()).optional(),
})

// ── Tool dispatch helpers ─────────────────────────────────────────────────────

function extractToolCall(
  text: string,
): { name: string; args: Record<string, unknown> } | null {
  const re = /##TOOL##\s*(\{[\s\S]*?\})\s*##/
  const match = text.match(re)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1]) as { name?: string; args?: Record<string, unknown> }
    if (typeof parsed.name === 'string') {
      return { name: parsed.name, args: parsed.args ?? {} }
    }
  } catch {
    return null
  }
  return null
}

async function executeChatTool(
  toolName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any,
  syndicRole: SyndicRole,
  locale: Locale,
): Promise<unknown> {
  switch (toolName) {
    case 'search_emails':
      return searchEmails(client, user, args)
    case 'regenerate_draft':
      return regenerateDraft(client, user, { ...args, syndicRole, locale })
    case 'bulk_action':
      return bulkAction(client, user, { ...args, syndicRole, locale })
    case 'summarize_inbox':
      return summarizeInbox(client, user, args)
    default:
      return { error: `unknown_tool: ${toolName}` }
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

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

  const locale = (parsed.data.locale ?? 'fr') as Locale

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
    ...(parsed.data.conversation_history ?? parsed.data.history ?? []),
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
      () =>
        callGroqWithRetry({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.4,
          max_tokens: 1500,
        }),
    )
    const rawContent = groqResponse.choices?.[0]?.message?.content ?? ''

    // Check if the LLM wants to invoke a tool
    const toolCall = extractToolCall(rawContent)
    if (toolCall) {
      let toolResult: unknown
      try {
        toolResult = await executeChatTool(
          toolCall.name,
          toolCall.args,
          supabase,
          user,
          userRole,
          locale,
        )
      } catch (toolErr) {
        logger.error('alfredo-chat tool execution error', {
          tool: toolCall.name,
          error: toolErr instanceof Error ? toolErr.message : String(toolErr),
          user_id: user.id,
        })
        toolResult = { error: 'tool_execution_failed' }
      }

      // Second Groq turn — reformulate the tool result for the user
      const followUpMessages = [
        ...messages,
        { role: 'assistant' as const, content: rawContent },
        {
          role: 'system' as const,
          content: `Résultat de l'outil ${toolCall.name} :\n\n${JSON.stringify(toolResult, null, 2)}\n\nReformule cette information pour l'utilisateur en ${locale === 'pt' ? 'portugais européen' : 'français'}. Sois concis et professionnel.`,
        },
      ]

      const followUpResponse = await callGroqWithRetry({
        model: 'llama-3.3-70b-versatile',
        messages: followUpMessages,
        temperature: 0.4,
        max_tokens: 1500,
      })

      const followUpContent = followUpResponse.choices?.[0]?.message?.content ?? rawContent
      const resolvedFinal = resolveSanitizedToken(followUpContent, tokenMap) ?? followUpContent
      return NextResponse.json({ content: resolvedFinal, tool_used: toolCall.name })
    }

    // No tool — return direct response
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
