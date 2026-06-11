// Tests d'idempotence du POST /api/email-agent/poll (audit ALF-2).
//
// Le poll requête Gmail `is:unread` et rien ne retire jamais le label UNREAD
// (pas de scope gmail.modify). Sans garde, chaque exécution (cron + push temps
// réel) relancerait classify + draft (2 appels Groq) sur les MÊMES emails et
// l'upsert écraserait draft_status → 'pending_review' (brouillons revus perdus).
// La route doit donc charger en UNE requête les gmail_message_id déjà en base
// pour le syndic et SAUTER les messages connus, quel que soit leur statut.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks des dépendances lourdes de la route ────────────────────────────────
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(),
  getUserRole: vi.fn(),
  isSyndicRole: vi.fn(),
  resolveCabinetId: vi.fn(),
  refreshGmailAccessToken: vi.fn(),
}))

// supabaseAdmin : deux chaînes distinctes —
//   syndic_oauth_tokens  → select/eq/single + update/delete (chemin tokens)
//   syndic_emails_analysed → select→eq→in (requête de dédup ALF-2)
const mockDedupIn = vi.fn()
const dedupChain = {
  select: vi.fn(() => dedupChain),
  eq: vi.fn(() => dedupChain),
  in: mockDedupIn,
}
const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null })
const tokensChain: Record<string, unknown> = {}
tokensChain.select = vi.fn(() => tokensChain)
tokensChain.eq = vi.fn(() => tokensChain)
tokensChain.update = vi.fn(() => tokensChain)
tokensChain.delete = vi.fn(() => tokensChain)
tokensChain.single = mockSingle
const mockFrom = vi.fn((table: string) =>
  table === 'syndic_emails_analysed' ? dedupChain : tokensChain,
)
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: (table: string) => mockFrom(table) },
}))

// Token OAuth valide non expiré → pas de refresh, on va droit au fetch Gmail
const mockGetDecryptedToken = vi.fn()
vi.mock('@/lib/oauth/tokens', () => ({
  getDecryptedToken: (...args: unknown[]) => mockGetDecryptedToken(...args),
  setEncryptedToken: vi.fn(),
}))

// Pipeline Alfredo mocké : c'est LUI qui porte classify + draft + upsert —
// s'il n'est pas appelé, aucun appel Groq ni upsert ne peut avoir lieu.
const mockProcessIncomingEmail = vi.fn()
vi.mock('@/lib/syndic/alfredo-pipeline', () => ({
  processIncomingEmail: (...args: unknown[]) => mockProcessIncomingEmail(...args),
}))
vi.mock('@/lib/syndic/alfredo-load-client-context', () => ({ loadClientContext: vi.fn() }))
vi.mock('@/lib/syndic/alfredo-classify', () => ({ classifyEmailWithGroq: vi.fn() }))
vi.mock('@/lib/syndic/alfredo-draft', () => ({ generateDraftReply: vi.fn() }))
vi.mock('@/lib/ai/sanitize-context', () => ({
  sanitizeContextForLLM: vi.fn(),
  resolveSanitizedToken: vi.fn(),
}))
vi.mock('@/lib/validation', () => ({
  validateBody: vi.fn(),
  emailAgentPollGetSchema: {},
}))

const mockLoggerInfo = vi.fn()
const mockLoggerError = vi.fn()
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: vi.fn(),
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}))

const SYNDIC_ID = 'cab-123'
const TOKEN = 'internal-poll-token-test-0123456789abcdef'

// ── Fixtures Gmail ────────────────────────────────────────────────────────────
function gmailMessage(id: string) {
  return {
    id,
    threadId: `thread-${id}`,
    internalDate: '1718000000000',
    payload: {
      headers: [
        { name: 'From', value: `client-${id}@example.com` },
        { name: 'Subject', value: `Sujet ${id}` },
        { name: 'Date', value: 'Tue, 10 Jun 2026 10:00:00 +0200' },
      ],
      body: { data: Buffer.from('Bonjour, fuite d eau.').toString('base64url') },
    },
  }
}

// fetch global : répond à la liste Gmail puis au détail de chaque message
function stubGmailFetch(ids: string[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('/users/me/messages?')) {
        return {
          ok: true,
          json: async () => ({ messages: ids.map(id => ({ id, threadId: `thread-${id}` })) }),
        }
      }
      const detail = ids.find(id => url.includes(`/users/me/messages/${id}?`))
      if (detail) {
        return { ok: true, json: async () => gmailMessage(detail) }
      }
      throw new Error(`fetch inattendu: ${url}`)
    }),
  )
}

function pollRequest() {
  return new Request('http://localhost:3000/api/email-agent/poll', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-trigger': TOKEN },
    body: JSON.stringify({ syndic_id: SYNDIC_ID }),
  })
}

async function callPOST(req: Request) {
  const { POST } = await import('@/app/api/email-agent/poll/route')
  return POST(req as never)
}

describe('POST /api/email-agent/poll — dédup gmail_message_id (ALF-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('INTERNAL_POLL_TOKEN', TOKEN)
    mockGetDecryptedToken.mockResolvedValue({
      access_token: 'access-token-valide',
      refresh_token: 'refresh-token',
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })
    mockSingle.mockResolvedValue({ data: null, error: null })
    mockProcessIncomingEmail.mockResolvedValue({ status: 'drafted', email_id: 'row-1' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('(a) message déjà en base → pipeline NON appelé, pas d\'upsert, compte skippé loggé', async () => {
    stubGmailFetch(['msg-1', 'msg-2'])
    mockDedupIn.mockResolvedValue({
      data: [{ gmail_message_id: 'msg-1' }, { gmail_message_id: 'msg-2' }],
      error: null,
    })

    const res = await callPOST(pollRequest())
    expect(res.status).toBe(200)
    const data = await res.json()

    // Aucun retraitement : pas de classify/draft (Groq) ni d'upsert
    expect(mockProcessIncomingEmail).not.toHaveBeenCalled()
    expect(data.results[0]).toMatchObject({
      syndic_id: SYNDIC_ID,
      emails_processed: 2,
      new_emails: 0,
      skipped_known: 2,
    })
    expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining('2 message(s)'))

    // La dédup est faite en UNE requête, scopée syndic + ids du batch
    expect(mockFrom).toHaveBeenCalledWith('syndic_emails_analysed')
    expect(dedupChain.eq).toHaveBeenCalledWith('syndic_id', SYNDIC_ID)
    expect(mockDedupIn).toHaveBeenCalledTimes(1)
    expect(mockDedupIn).toHaveBeenCalledWith('gmail_message_id', ['msg-1', 'msg-2'])
  })

  it('(b) message nouveau → pipeline appelé comme avant', async () => {
    stubGmailFetch(['msg-new'])
    mockDedupIn.mockResolvedValue({ data: [], error: null })

    const res = await callPOST(pollRequest())
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(mockProcessIncomingEmail).toHaveBeenCalledTimes(1)
    const params = mockProcessIncomingEmail.mock.calls[0][0]
    expect(params.syndicId).toBe(SYNDIC_ID)
    expect(params.email.gmail_message_id).toBe('msg-new')
    expect(params.email.from).toBe('client-msg-new@example.com')
    expect(params.email.subject).toBe('Sujet msg-new')
    expect(data.results[0]).toMatchObject({
      emails_processed: 1,
      new_emails: 1,
      skipped_known: 0,
    })
  })

  it('(c) mix connu/nouveau → pipeline appelé UNIQUEMENT pour les nouveaux', async () => {
    stubGmailFetch(['msg-known', 'msg-new-1', 'msg-new-2'])
    // msg-known déjà en base — statut indifférent (brouillon revu, refusé…)
    mockDedupIn.mockResolvedValue({ data: [{ gmail_message_id: 'msg-known' }], error: null })

    const res = await callPOST(pollRequest())
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(mockProcessIncomingEmail).toHaveBeenCalledTimes(2)
    const processedIds = mockProcessIncomingEmail.mock.calls.map(
      c => (c[0] as { email: { gmail_message_id: string } }).email.gmail_message_id,
    )
    expect(processedIds).toEqual(['msg-new-1', 'msg-new-2'])
    expect(processedIds).not.toContain('msg-known')
    expect(data.results[0]).toMatchObject({
      emails_processed: 3,
      new_emails: 2,
      skipped_known: 1,
    })
    expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining('1 message(s)'))
  })

  it('aucun message Gmail → pas de requête de dédup', async () => {
    stubGmailFetch([])
    const res = await callPOST(pollRequest())
    expect(res.status).toBe(200)
    expect(mockDedupIn).not.toHaveBeenCalled()
    expect(mockProcessIncomingEmail).not.toHaveBeenCalled()
  })

  it('échec de la requête de dédup → RIEN n\'est traité (pas d\'écrasement possible)', async () => {
    stubGmailFetch(['msg-1'])
    mockDedupIn.mockResolvedValue({ data: null, error: { message: 'db down' } })

    const res = await callPOST(pollRequest())
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(mockProcessIncomingEmail).not.toHaveBeenCalled()
    expect(data.results[0]).toMatchObject({ syndic_id: SYNDIC_ID, error: 'Erreur de déduplication' })
    expect(mockLoggerError).toHaveBeenCalled()
  })
})
