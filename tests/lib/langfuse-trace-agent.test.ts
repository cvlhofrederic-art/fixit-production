import { describe, it, expect } from 'vitest'
import { traceAgent } from '@/lib/langfuse'

describe('traceAgent', () => {
  it('exécute fn et retourne sa valeur', async () => {
    const result = await traceAgent({ agent_id: 'fixy', user_id: 'u1' }, async () => 42)
    expect(result).toBe(42)
  })

  it('propage les erreurs', async () => {
    await expect(traceAgent(
      { agent_id: 'fixy', user_id: 'u1' },
      async () => { throw new Error('boom') },
    )).rejects.toThrow('boom')
  })

  it('ne crash pas si langfuse global absent', async () => {
    const result = await traceAgent({ agent_id: 'max', user_id: 'u1' }, async () => 'ok')
    expect(result).toBe('ok')
  })
})
