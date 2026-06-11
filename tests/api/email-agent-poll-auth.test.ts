// Tests d'auth du POST /api/email-agent/poll (audit ENV-04).
//
// Trois chemins d'auth quand syndic_id est fourni :
//   1. Header x-internal-trigger présent → comparaison temps constant avec
//      INTERNAL_POLL_TOKEN (appel interne webhook Gmail, pas de cookies).
//      Invalide/vide/serveur non configuré → 401, jamais de fallback cookie.
//   2. Pas de header → auth cookie inchangée (getAuthUser + resolveCabinetId).
//   3. Pas de syndic_id → chemin cron (x-cron-key), hors scope ici.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks des dépendances lourdes de la route ────────────────────────────────
const mockGetAuthUser = vi.fn()
const mockGetUserRole = vi.fn()
const mockIsSyndicRole = vi.fn()
const mockResolveCabinetId = vi.fn()

vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  getUserRole: (...args: unknown[]) => mockGetUserRole(...args),
  isSyndicRole: (...args: unknown[]) => mockIsSyndicRole(...args),
  resolveCabinetId: (...args: unknown[]) => mockResolveCabinetId(...args),
  refreshGmailAccessToken: vi.fn(),
}))

// supabaseAdmin chaînable — le fallback "plain token" retourne data:null
// → la boucle `continue` immédiatement, aucun appel Gmail.
const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null })
const chain: Record<string, unknown> = {}
chain.select = vi.fn(() => chain)
chain.eq = vi.fn(() => chain)
chain.update = vi.fn(() => chain)
chain.delete = vi.fn(() => chain)
chain.single = mockSingle
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: vi.fn(() => chain) },
}))

vi.mock('@/lib/oauth/tokens', () => ({
  getDecryptedToken: vi.fn().mockResolvedValue(null),
  setEncryptedToken: vi.fn(),
}))

vi.mock('@/lib/syndic/alfredo-pipeline', () => ({ processIncomingEmail: vi.fn() }))
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

const mockLoggerWarn = vi.fn()
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: vi.fn(),
  },
}))

const SYNDIC_ID = 'cab-123'
const TOKEN = 'internal-poll-token-test-0123456789abcdef'

function pollRequest(opts: { token?: string; cookieUser?: boolean } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.token !== undefined) headers['x-internal-trigger'] = opts.token
  return new Request('http://localhost:3000/api/email-agent/poll', {
    method: 'POST',
    headers,
    body: JSON.stringify({ syndic_id: SYNDIC_ID }),
  })
}

async function callPOST(req: Request) {
  const { POST } = await import('@/app/api/email-agent/poll/route')
  return POST(req as never)
}

describe('POST /api/email-agent/poll — auth interne x-internal-trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSingle.mockResolvedValue({ data: null, error: null })
    vi.stubEnv('INTERNAL_POLL_TOKEN', TOKEN)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('token valide → autorisé (200), sans passer par l\'auth cookie', async () => {
    const res = await callPOST(pollRequest({ token: TOKEN }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    // Bypass cookie : getAuthUser ne doit jamais être appelé
    expect(mockGetAuthUser).not.toHaveBeenCalled()
  })

  it('token valide → scopé au seul syndic_id transmis', async () => {
    const res = await callPOST(pollRequest({ token: TOKEN }))
    expect(res.status).toBe(200)
    // La boucle ne traite que ce syndic : 1 seul lookup token plain
    expect(chain.eq).toHaveBeenCalledWith('syndic_id', SYNDIC_ID)
    expect(mockSingle).toHaveBeenCalledTimes(1)
  })

  it('token invalide → 401', async () => {
    const res = await callPOST(pollRequest({ token: 'mauvais-token' }))
    expect(res.status).toBe(401)
    expect(mockGetAuthUser).not.toHaveBeenCalled()
    expect(mockLoggerWarn).toHaveBeenCalled()
  })

  it('token de même longueur mais différent → 401 (comparaison réelle du contenu)', async () => {
    const sameLength = 'X'.repeat(TOKEN.length)
    const res = await callPOST(pollRequest({ token: sameLength }))
    expect(res.status).toBe(401)
  })

  it('header vide → 401 (jamais traité comme absent)', async () => {
    const res = await callPOST(pollRequest({ token: '' }))
    expect(res.status).toBe(401)
    expect(mockGetAuthUser).not.toHaveBeenCalled()
  })

  it('INTERNAL_POLL_TOKEN non configuré côté serveur → 401 même avec un header', async () => {
    vi.stubEnv('INTERNAL_POLL_TOKEN', '')
    const res = await callPOST(pollRequest({ token: 'nimporte-quoi' }))
    expect(res.status).toBe(401)
  })

  it('vide==vide refusé : env vide + header vide → 401', async () => {
    vi.stubEnv('INTERNAL_POLL_TOKEN', '')
    const res = await callPOST(pollRequest({ token: '' }))
    expect(res.status).toBe(401)
  })

  it('header invalide ne retombe PAS sur l\'auth cookie (pas de fallback silencieux)', async () => {
    // Même avec un user cookie valide, un header invalide doit refuser
    mockGetAuthUser.mockResolvedValue({ id: 'user-1' })
    mockIsSyndicRole.mockReturnValue(true)
    mockGetUserRole.mockReturnValue('syndic')
    mockResolveCabinetId.mockResolvedValue(SYNDIC_ID)
    const res = await callPOST(pollRequest({ token: 'mauvais-token' }))
    expect(res.status).toBe(401)
    expect(mockGetAuthUser).not.toHaveBeenCalled()
  })
})

describe('POST /api/email-agent/poll — chemin cookie inchangé (pas de header)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSingle.mockResolvedValue({ data: null, error: null })
    vi.stubEnv('INTERNAL_POLL_TOKEN', TOKEN)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('pas de header + pas de session → 401', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await callPOST(pollRequest())
    expect(res.status).toBe(401)
    expect(mockGetAuthUser).toHaveBeenCalledTimes(1)
  })

  it('pas de header + user non syndic → 403', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'user-1' })
    mockIsSyndicRole.mockReturnValue(false)
    mockGetUserRole.mockReturnValue('artisan')
    const res = await callPOST(pollRequest())
    expect(res.status).toBe(403)
  })

  it('pas de header + syndic d\'un autre cabinet → 403', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'user-1' })
    mockIsSyndicRole.mockReturnValue(true)
    mockGetUserRole.mockReturnValue('syndic')
    mockResolveCabinetId.mockResolvedValue('autre-cabinet')
    const res = await callPOST(pollRequest())
    expect(res.status).toBe(403)
  })

  it('pas de header + syndic du bon cabinet → 200', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'user-1' })
    mockIsSyndicRole.mockReturnValue(true)
    mockGetUserRole.mockReturnValue('syndic')
    mockResolveCabinetId.mockResolvedValue(SYNDIC_ID)
    const res = await callPOST(pollRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})
