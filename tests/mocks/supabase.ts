import { vi } from 'vitest'

const createChainMock = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'is', 'single', 'limit', 'order', 'range', 'gt', 'lt', 'gte', 'lte', 'like', 'ilike', 'match', 'not', 'or', 'filter', 'maybeSingle', 'csv']

  for (const method of methods) {
    chain[method] = vi.fn().mockImplementation(() => chain)
  }
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
  chain.then = undefined as unknown as ReturnType<typeof vi.fn> // prevent accidental promise resolution

  return chain
}

export const mockChain = createChainMock()

export const mockSupabaseAdmin = {
  from: vi.fn().mockReturnValue(mockChain),
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'test.jpg' }, error: null }),
      download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/test.jpg' } }),
    }),
  },
  auth: {
    admin: {
      createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'new-user-id' } }, error: null }),
      listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
      deleteUser: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
}

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}))
