import { describe, it, expect, vi } from 'vitest'
import { logAiAudit, type AiAuditParams } from '@/lib/syndic/ai-audit'

// Phase 4 — helper logAiAudit insère dans syndic_ai_audit.
// Mock minimal du client Supabase : on enregistre les .insert() payloads.

interface RecordedInsert {
  table: string
  payload: unknown
}

function createMockClient(insertError?: { message: string }) {
  const inserts: RecordedInsert[] = []
  return {
    inserts,
    from: vi.fn((table: string) => ({
      insert: vi.fn((payload: unknown) => {
        inserts.push({ table, payload })
        return Promise.resolve({ data: null, error: insertError ?? null })
      }),
    })),
  }
}

describe('logAiAudit — Phase 4 audit RGPD', () => {
  it('insère dans syndic_ai_audit avec tous les champs', async () => {
    const mockClient = createMockClient()
    const params: AiAuditParams = {
      cabinetId: 'cabinet-uuid-A',
      agentId: 'alfredo',
      action: 'bulk_archive',
      status: 'success',
      conversationId: 'conv-uuid-1',
      userId: 'team-member-uuid-X',
      toolPayload: { matched: 5, succeeded: 5, failed: 0 },
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await logAiAudit(mockClient as any, params)

    expect(mockClient.from).toHaveBeenCalledWith('syndic_ai_audit')
    expect(mockClient.inserts).toHaveLength(1)

    const inserted = mockClient.inserts[0].payload as Record<string, unknown>
    expect(inserted.syndic_id).toBe('cabinet-uuid-A')
    expect(inserted.agent_id).toBe('alfredo')
    expect(inserted.action).toBe('bulk_archive')
    expect(inserted.status).toBe('success')
    expect(inserted.conversation_id).toBe('conv-uuid-1')
    // user_id doit être DANS tool_payload (la table n'a pas de colonne user_id)
    const payload = inserted.tool_payload as Record<string, unknown>
    expect(payload.user_id).toBe('team-member-uuid-X')
    expect(payload.matched).toBe(5)
  })

  it("met user_id dans tool_payload même quand toolPayload n'est pas fourni", async () => {
    const mockClient = createMockClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await logAiAudit(mockClient as any, {
      cabinetId: 'c',
      agentId: 'alfredo',
      action: 'test',
      status: 'success',
      userId: 'u-1',
    })
    const payload = (mockClient.inserts[0].payload as { tool_payload: Record<string, unknown> }).tool_payload
    expect(payload).toEqual({ user_id: 'u-1' })
  })

  it("ne lance pas d'exception quand l'INSERT échoue", async () => {
    const mockClient = createMockClient({ message: 'simulated DB error' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await logAiAudit(mockClient as any, {
      cabinetId: 'c',
      agentId: 'alfredo',
      action: 'test',
      status: 'success',
    })
    expect(result).toBeUndefined() // void
    // L'insert a quand même été tenté
    expect(mockClient.inserts).toHaveLength(1)
  })

  it("ne lance pas d'exception quand le client throw", async () => {
    const brokenClient = {
      from: vi.fn(() => {
        throw new Error('client is broken')
      }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(logAiAudit(brokenClient as any, {
      cabinetId: 'c',
      agentId: 'alfredo',
      action: 'test',
      status: 'success',
    })).resolves.toBeUndefined()
  })

  it('met tool_payload à null si aucun payload ni userId fournis', async () => {
    const mockClient = createMockClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await logAiAudit(mockClient as any, {
      cabinetId: 'c',
      agentId: 'fixy',
      action: 'test',
      status: 'denied_rbac',
    })
    const inserted = mockClient.inserts[0].payload as Record<string, unknown>
    expect(inserted.tool_payload).toBeNull()
  })
})
