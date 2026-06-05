import { describe, it, expect, vi } from 'vitest'
import { loadClientContext } from '@/lib/syndic/alfredo-load-client-context'

function chainableMock(responses: Record<string, unknown>) {
  const make = (table: string) => {
    const result = responses[table] ?? null
    const arr = Array.isArray(result) ? result : (result ? [result] : [])
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      ilike: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => Promise.resolve({ data: arr, error: null })),
      single: vi.fn(() => Promise.resolve({ data: arr[0] ?? null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: arr[0] ?? null, error: null })),
    }
    return chain
  }
  return {
    from: vi.fn((table: string) => make(table)),
  }
}

describe('loadClientContext', () => {
  it('retourne unknown si coproprio non trouvé', async () => {
    const client = chainableMock({}) as unknown as Parameters<typeof loadClientContext>[0]
    const ctx = await loadClientContext(client, {
      syndicId: 's1',
      syndicRole: 'syndic_admin',
      emailAddress: 'unknown@example.com',
      locale: 'fr',
    })
    expect(ctx.copro_status).toBe('unknown')
    expect(ctx.identity).toBeUndefined()
  })

  it('omet financial pour syndic_tech', async () => {
    const client = chainableMock({}) as unknown as Parameters<typeof loadClientContext>[0]
    const ctx = await loadClientContext(client, {
      syndicId: 's1',
      syndicRole: 'syndic_tech',
      emailAddress: 'unknown@example.com',
      locale: 'fr',
    })
    expect(ctx.financial).toBeUndefined()
    expect(ctx.rbac_omitted_fields).toContain('financial')
  })

  it('client_token est déterministe', async () => {
    const client = chainableMock({}) as unknown as Parameters<typeof loadClientContext>[0]
    const ctx1 = await loadClientContext(client, {
      syndicId: 's1', syndicRole: 'syndic_admin', emailAddress: 'a@b.fr', locale: 'fr',
    })
    const ctx2 = await loadClientContext(client, {
      syndicId: 's1', syndicRole: 'syndic_admin', emailAddress: 'a@b.fr', locale: 'fr',
    })
    expect(ctx1.client_token).toBe(ctx2.client_token)
  })
})
