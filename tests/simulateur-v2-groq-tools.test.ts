import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callGroqWithTools } from '@/lib/groq'
import type { ToolSchema } from '@/app/api/simulateur-travaux/tools'

const TOOLS: ToolSchema[] = [
  { type: 'function', function: { name: 'echo', description: 'echo', parameters: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] } } },
]

describe('callGroqWithTools', () => {
  const ORIG_ENV = { ...process.env }
  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-key'
    global.fetch = vi.fn() as typeof fetch
  })
  afterEach(() => {
    process.env = { ...ORIG_ENV }
    vi.restoreAllMocks()
  })

  it('réponse texte → renvoie message content', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'Bonjour' }, finish_reason: 'stop' }],
        usage: { total_tokens: 10, prompt_tokens: 5, completion_tokens: 5 },
      }),
    })
    const r = await callGroqWithTools({
      messages: [{ role: 'user', content: 'salut' }],
      tools: TOOLS,
    })
    expect(r.message.content).toBe('Bonjour')
    expect(r.message.tool_calls).toBeUndefined()
  })

  it('réponse tool_calls → renvoie tool_calls', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'echo', arguments: '{"msg":"hi"}' } }],
          },
          finish_reason: 'tool_calls',
        }],
      }),
    })
    const r = await callGroqWithTools({
      messages: [{ role: 'user', content: 'echo hi' }],
      tools: TOOLS,
    })
    expect(r.message.tool_calls).toHaveLength(1)
    expect(r.message.tool_calls?.[0].function.name).toBe('echo')
    expect(r.message.tool_calls?.[0].function.arguments).toBe('{"msg":"hi"}')
  })

  it('429 → retry et succès', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '0' }),
        text: async () => 'rate limit',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }),
      })
    const r = await callGroqWithTools({
      messages: [{ role: 'user', content: 'x' }],
      tools: TOOLS,
    })
    expect(r.message.content).toBe('ok')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('non-OK persistant → throw', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'server error',
    })
    await expect(
      callGroqWithTools({ messages: [{ role: 'user', content: 'x' }], tools: TOOLS })
    ).rejects.toThrow()
  })
})
