import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchEmails, summarizeInbox } from '@/lib/syndic/alfredo-chat-tools'

// Phase 3a — preuve que les 4 tools utilisent bien `cabinetId` et non `user.id`.
// Mock minimal du client Supabase : enregistre tous les .eq(col, val) appelés.

interface RecordedCall {
  table: string
  filters: Array<{ column: string; value: unknown }>
}

function createMockClient() {
  const calls: RecordedCall[] = []
  let currentCall: RecordedCall | null = null

  function makeChain(returnValue: unknown) {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn((column: string, value: unknown) => {
        currentCall!.filters.push({ column, value })
        return chain
      }),
      gte: vi.fn(() => chain),
      lte: vi.fn(() => chain),
      or: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      // Awaitable — résout avec un payload minimal compatible
      then: (resolve: (v: { data: unknown; count: number }) => void) => {
        resolve({ data: returnValue, count: 0 })
      },
    }
    return chain
  }

  return {
    calls,
    from: vi.fn((table: string) => {
      currentCall = { table, filters: [] }
      calls.push(currentCall)
      return makeChain([])
    }),
  }
}

describe('alfredo-chat-tools — Phase 3a cabinetId routing', () => {
  let mockClient: ReturnType<typeof createMockClient>
  const CABINET_ID = 'cabinet-uuid-AAAAAAAA-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const USER_ID_DIFFERENT = 'team-member-uuid-BBBBBBBB-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

  beforeEach(() => {
    mockClient = createMockClient()
  })

  it('searchEmails filtre syndic_emails_analysed par le cabinetId fourni', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await searchEmails(mockClient as any, CABINET_ID, { limit: 10 })

    expect(mockClient.from).toHaveBeenCalledWith('syndic_emails_analysed')
    const syndicIdFilter = mockClient.calls[0].filters.find((f) => f.column === 'syndic_id')
    expect(syndicIdFilter).toBeDefined()
    expect(syndicIdFilter!.value).toBe(CABINET_ID)
    // Sanity : ce n'est PAS l'user.id d'un team_member
    expect(syndicIdFilter!.value).not.toBe(USER_ID_DIFFERENT)
  })

  it('summarizeInbox filtre syndic_emails_analysed par le cabinetId fourni', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await summarizeInbox(mockClient as any, CABINET_ID, { period: 'week' })

    expect(mockClient.from).toHaveBeenCalledWith('syndic_emails_analysed')
    const syndicIdFilter = mockClient.calls[0].filters.find((f) => f.column === 'syndic_id')
    expect(syndicIdFilter).toBeDefined()
    expect(syndicIdFilter!.value).toBe(CABINET_ID)
    expect(syndicIdFilter!.value).not.toBe(USER_ID_DIFFERENT)
  })

  // Note : regenerateDraft et bulkAction sont testés indirectement via le pattern
  // file content (tests/api/syndic-cabinet-resolution.test.ts) car ils ont des
  // dépendances lourdes (loadClientContext, generateDraftReply → LLM call).
})
