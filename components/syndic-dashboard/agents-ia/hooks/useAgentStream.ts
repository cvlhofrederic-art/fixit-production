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
        body: JSON.stringify({
          conversation_id: params.conversationId,
          message: params.message,
          history: params.history.slice(-60),
          locale: params.locale,
          context: params.context ?? {},
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

      const json = await res.json() as { content: string; tool_calls?: unknown[] }
      setState({ pending: false, partial: json.content, error: null })
      return json
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
        const data = JSON.parse(payload) as { delta?: string; tool_calls?: unknown[] }
        if (data.delta) {
          full += data.delta
          onChunk(data.delta)
        }
        if (data.tool_calls) toolCalls = data.tool_calls
      } catch {
        // ignore malformed
      }
    }
  }

  return { content: full, tool_calls: toolCalls }
}
