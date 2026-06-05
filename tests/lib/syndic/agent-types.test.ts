import { describe, it, expect } from 'vitest'
import type { AgentId, Conversation, Message } from '@/lib/syndic/agent-types'

describe('agent-types', () => {
  it('AgentId accepte les 4 valeurs valides', () => {
    const ids: AgentId[] = ['fixy', 'max', 'lea', 'alfredo']
    expect(ids).toHaveLength(4)
  })

  it('Conversation shape compatible avec les colonnes DB', () => {
    const conv: Conversation = {
      id: 'uuid',
      syndic_id: 'uuid',
      agent_id: 'fixy',
      locale: 'fr',
      title: 'Test',
      immeuble_id: null,
      message_count: 0,
      last_message_preview: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    }
    expect(conv.agent_id).toBe('fixy')
  })

  it('Message shape supporte tool_calls null et populated', () => {
    const m1: Message = {
      id: 'uuid', conversation_id: 'uuid', role: 'user', content: 'hello',
      tool_calls: null, metadata: null, created_at: new Date().toISOString()
    }
    const m2: Message = {
      ...m1,
      role: 'assistant',
      tool_calls: [{ tool_name: 'navigate', arguments: { page: 'immeubles' }, status: 'pending' }]
    }
    expect(m1.tool_calls).toBeNull()
    expect(m2.tool_calls).toHaveLength(1)
  })
})
