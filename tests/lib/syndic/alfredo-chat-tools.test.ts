import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchEmails, summarizeInbox, bulkAction } from '@/lib/syndic/alfredo-chat-tools'

// Phase 3a — preuve que les 4 tools utilisent bien `cabinetId` et non `user.id`.
// Phase 4 — preuve que bulkAction logge dans syndic_ai_audit (RBAC refus + résultats).
// Mock minimal du client Supabase : enregistre les .eq() et les .insert().

interface RecordedCall {
  table: string
  filters: Array<{ column: string; value: unknown }>
}

interface RecordedInsert {
  table: string
  payload: unknown
}

function createMockClient() {
  const calls: RecordedCall[] = []
  const inserts: RecordedInsert[] = []
  let currentCall: RecordedCall | null = null
  let currentTable: string = ''

  function makeChain(returnValue: unknown) {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn((column: string, value: unknown) => {
        if (currentCall) currentCall.filters.push({ column, value })
        return chain
      }),
      gte: vi.fn(() => chain),
      lte: vi.fn(() => chain),
      or: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      insert: vi.fn((payload: unknown) => {
        inserts.push({ table: currentTable, payload })
        return Promise.resolve({ data: null, error: null })
      }),
      update: vi.fn(() => chain),
      // Awaitable — résout avec un payload minimal compatible
      then: (resolve: (v: { data: unknown; count: number }) => void) => {
        resolve({ data: returnValue, count: 0 })
      },
    }
    return chain
  }

  return {
    calls,
    inserts,
    from: vi.fn((table: string) => {
      currentTable = table
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
    // Pas d'appel à syndic_emails_analysed quand RBAC refuse (court-circuit).
    // Phase 4 : un appel à syndic_ai_audit est attendu (log RGPD du refus).
    expect(mockClient.from).not.toHaveBeenCalledWith('syndic_emails_analysed')
    expect(mockClient.from).toHaveBeenCalledWith('syndic_ai_audit')
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
    // Phase 4 : audit RGPD écrit même en cas de refus.
    expect(mockClient.from).not.toHaveBeenCalledWith('syndic_emails_analysed')
    expect(mockClient.from).toHaveBeenCalledWith('syndic_ai_audit')
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

// Phase 4 — audit RGPD : bulkAction écrit dans syndic_ai_audit pour traçabilité.
describe('bulkAction — audit RGPD (Phase 4)', () => {
  const CABINET_ID = 'cabinet-uuid-AAAAAAAA'
  const USER_ID = 'team-member-uuid-XXXX'

  it("écrit denied_rbac dans syndic_ai_audit quand RBAC refuse", async () => {
    const mockClient = createMockClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await bulkAction(mockClient as any, CABINET_ID, {
      filter: { urgence: 'haute' },
      action: 'archive',
      syndicRole: 'syndic_comptable',
      locale: 'fr',
      userId: USER_ID,
      conversationId: 'conv-1',
    })

    const auditInserts = mockClient.inserts.filter((i) => i.table === 'syndic_ai_audit')
    expect(auditInserts).toHaveLength(1)
    const row = auditInserts[0].payload as Record<string, unknown>
    expect(row.syndic_id).toBe(CABINET_ID)
    expect(row.agent_id).toBe('alfredo')
    expect(row.action).toBe('bulk_archive')
    expect(row.status).toBe('denied_rbac')
    expect(row.conversation_id).toBe('conv-1')
    const payload = row.tool_payload as Record<string, unknown>
    expect(payload.user_id).toBe(USER_ID)
    expect(payload.role).toBe('syndic_comptable')
  })

  it("écrit success dans syndic_ai_audit quand bulk passe (0 email à traiter)", async () => {
    const mockClient = createMockClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await bulkAction(mockClient as any, CABINET_ID, {
      filter: {},
      action: 'archive',
      syndicRole: 'syndic_secretaire',
      locale: 'fr',
      userId: USER_ID,
    })

    const auditInserts = mockClient.inserts.filter((i) => i.table === 'syndic_ai_audit')
    // 1 write (résultat global), pas de denied_rbac car la secretaire est autorisée
    expect(auditInserts).toHaveLength(1)
    const row = auditInserts[0].payload as Record<string, unknown>
    expect(row.status).toBe('success')
    expect(row.action).toBe('bulk_archive')
    const payload = row.tool_payload as Record<string, unknown>
    expect(payload.matched).toBe(0)
    expect(payload.succeeded).toBe(0)
  })
})
