import { useCallback, useRef, useState } from 'react'
import type { AgentConfig, Locale, Message } from '@/lib/syndic/agent-types'

interface SendParams {
  conversationId: string
  message: string
  history: Message[]
  locale: Locale
  context?: Record<string, unknown>
}

interface StreamState {
  pending: boolean
  partial: string
  error: string | null
}

export function useAgentStream(agentConfig: AgentConfig) {
  const [state, setState] = useState<StreamState>({ pending: false, partial: '', error: null })
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(async (params: SendParams): Promise<{ content: string; tool_calls?: unknown[] }> => {
    setState({ pending: true, partial: '', error: null })
    const ac = new AbortController()
    abortRef.current = ac

    try {
      const res = await fetch(agentConfig.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(agentConfig.streaming ? { 'accept': 'text/event-stream' } : {}),
        },
        // Le contrat des routes /api/syndic/{fixy-syndic,max-ai,lea-comptable} attend
        // `conversation_history` + `syndic_context` (cf. routes existantes avant Plan A).
        body: JSON.stringify({
          conversation_id: params.conversationId,
          message: params.message,
          conversation_history: params.history.slice(-60).map(m => ({ role: m.role, content: m.content })),
          locale: params.locale,
          syndic_context: params.context ?? {},
        }),
        signal: ac.signal,
      })

      if (!res.ok) throw new Error(`agent_${res.status}`)

      if (agentConfig.streaming && res.headers.get('content-type')?.includes('text/event-stream')) {
        const result = await readSSE(res, (chunk) => {
          setState(s => ({ ...s, partial: s.partial + chunk }))
        })
        setState(s => ({ ...s, pending: false }))
        return result
      }

      // Les routes renvoient `{ response, action?, role? }` (pas `content`).
      const json = await res.json() as { response?: string; content?: string; action?: unknown; tool_calls?: unknown[] }
      const content = json.response ?? json.content ?? ''
      const tool_calls = json.tool_calls ?? (json.action ? [json.action] : undefined)
      setState({ pending: false, partial: content, error: null })
      return { content, tool_calls }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown'
      setState(s => ({ ...s, pending: false, error: message }))
      throw err
    }
  }, [agentConfig])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setState(s => ({ ...s, pending: false }))
  }, [])

  return { ...state, send, cancel }
}

async function readSSE(res: Response, onChunk: (s: string) => void): Promise<{ content: string; tool_calls?: unknown[] }> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  let toolCalls: unknown[] | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') continue
      try {
        // Le helper `wrapGroqStreamWithPIIResolution` émet `{text}`,
        // les anciens streams Groq utilisent parfois `{delta}` ou `{content}`.
        const data = JSON.parse(payload) as { text?: string; delta?: string; content?: string; tool_calls?: unknown[] }
        const chunk = data.text ?? data.delta ?? data.content
        if (chunk) {
          full += chunk
          onChunk(chunk)
        }
        if (data.tool_calls) toolCalls = data.tool_calls
      } catch {
        // ignore malformed
      }
    }
  }

  return { content: full, tool_calls: toolCalls }
}
