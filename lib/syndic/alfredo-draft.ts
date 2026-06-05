// lib/syndic/alfredo-draft.ts
import { buildAlfredoDraftPromptFR } from './prompts/alfredo/draft-reply-prompt-fr'
import { buildAlfredoDraftPromptPT } from './prompts/alfredo/draft-reply-prompt-pt'
import { callGroqWithRetry } from '@/lib/groq'
import type { Locale } from './agent-types'
import type { DraftPromptInput } from './prompts/alfredo/draft-reply-prompt-fr'

export type { DraftPromptInput }

export interface DraftReplyResult {
  subject_suggested: string
  body_text: string
  body_html: string
  confidence: number
  missing_info: string[]
  suggested_next_actions: Array<{ tool: string; args: Record<string, unknown> }>
}

export async function generateDraftReply(
  input: DraftPromptInput,
  locale: Locale,
): Promise<DraftReplyResult> {
  const prompt =
    locale === 'pt'
      ? buildAlfredoDraftPromptPT(input)
      : buildAlfredoDraftPromptFR(input)

  const response = await callGroqWithRetry({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  try {
    const parsed = JSON.parse(
      response.choices?.[0]?.message?.content ?? '{}',
    ) as Partial<DraftReplyResult>
    return {
      subject_suggested: String(parsed.subject_suggested ?? ''),
      body_text: String(parsed.body_text ?? ''),
      body_html: String(parsed.body_html ?? ''),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      missing_info: Array.isArray(parsed.missing_info) ? parsed.missing_info : [],
      suggested_next_actions: Array.isArray(parsed.suggested_next_actions)
        ? (parsed.suggested_next_actions as Array<{ tool: string; args: Record<string, unknown> }>)
        : [],
    }
  } catch {
    return {
      subject_suggested: '',
      body_text: '',
      body_html: '',
      confidence: 0,
      missing_info: ['parsing_error'],
      suggested_next_actions: [],
    }
  }
}
