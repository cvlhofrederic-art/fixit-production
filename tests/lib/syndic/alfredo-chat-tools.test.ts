import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchEmails, summarizeInbox, bulkAction } from '@/lib/syndic/alfredo-chat-tools'

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

  // Note : regenerateDraft est testé indirectement via le pattern file content
  // (tests/api/syndic-cabinet-resolution.test.ts) car il a des dépendances
  // lourdes (loadClientContext, generateDraftReply → LLM call).
})

// Phase 3b — bulkAction enforce le RBAC sous-rôle avant toute query.
// On vérifie que la fonction refuse SANS appeler le client Supabase quand le
// rôle n'a pas la permission, et qu'elle laisse passer quand il l'a.
describe('bulkAction — RBAC sous-rôle (Phase 3b)', () => {
  const CABINET_ID = 'cabinet-uuid-AAAAAAAA'

  it("refuse bulk_archive pour un syndic_comptable (rbac_denied)", async () => {
    const mockClient = createMockClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await bulkAction(mockClient as any, CABINET_ID, {
      filter: {},
      action: 'archive',
      syndicRole: 'syndic_comptable',
      locale: 'fr',
    })

    expect(result.matched).toBe(0)
    expect(result.succeeded).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatch(/rbac_denied/)
    expect(result.errors[0]).toMatch(/syndic_comptable/)
    // Pas d'appel Supabase quand RBAC refuse (court-circuit)
    expect(mockClient.from).not.toHaveBeenCalled()
  })

  it("refuse bulk_mark_spam pour un syndic_tech (rbac_denied)", async () => {
    const mockClient = createMockClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await bulkAction(mockClient as any, CABINET_ID, {
      filter: {},
      action: 'mark_spam',
      syndicRole: 'syndic_tech',
      locale: 'fr',
    })
    expect(result.errors[0]).toMatch(/rbac_denied/)
    expect(mockClient.from).not.toHaveBeenCalled()
  })

  it("autorise bulk_archive pour un syndic_secretaire (passe le RBAC)", async () => {
    const mockClient = createMockClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await bulkAction(mockClient as any, CABINET_ID, {
      filter: {},
      action: 'archive',
      syndicRole: 'syndic_secretaire',
      locale: 'fr',
    })
    // Pas de rbac_denied. matched: 0 car le mock retourne [] (pas d'emails à archiver).
    expect(result.errors.filter((e) => e.startsWith('rbac_denied'))).toHaveLength(0)
    // Supabase APPELÉ car le RBAC passe (mock returns 0 emails donc rien à exécuter)
    expect(mockClient.from).toHaveBeenCalledWith('syndic_emails_analysed')
  })

  it("autorise bulk_draft_reply pour un syndic_comptable (création non destructive)", async () => {
    const mockClient = createMockClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await bulkAction(mockClient as any, CABINET_ID, {
      filter: {},
      action: 'draft_reply',
      syndicRole: 'syndic_comptable',
      locale: 'fr',
    })
    expect(result.errors.filter((e) => e.startsWith('rbac_denied'))).toHaveLength(0)
    expect(mockClient.from).toHaveBeenCalledWith('syndic_emails_analysed')
  })
})
