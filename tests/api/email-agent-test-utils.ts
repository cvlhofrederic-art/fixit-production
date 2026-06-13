// Échafaudage partagé des tests email-agent : poll auth (ENV-04), poll dédup
// (ALF-2) et webhook (ALF-1). Factorise les fabriques de mocks, les builders
// de Request, les fixtures Gmail et les helpers d'assertion répétés entre les
// trois fichiers (duplication SonarCloud PR #467).
//
// Contrainte vitest : vi.mock est hoisté PAR FICHIER de test — chaque fichier
// garde donc ses appels vi.mock, mais leurs factories viennent d'ici. C'est
// sûr car une factory vi.mock s'exécute PARESSEUSEMENT, au premier import du
// module mocké (ici l'import dynamique de la route dans les tests), donc bien
// après l'initialisation des imports et constantes du fichier de test.

import { vi, expect } from 'vitest'

// ── Constantes partagées ─────────────────────────────────────────────────────

export const SYNDIC_ID = 'cab-123'
export const INTERNAL_TOKEN = 'internal-poll-token-test-0123456789abcdef'
export const GMAIL_SECRET = 'gmail-webhook-secret-test'

// ── Chaînes Supabase mockées ─────────────────────────────────────────────────

// supabaseAdmin chaînable, chemin tokens du poll (syndic_oauth_tokens).
// Depuis la refonte chiffrement applicatif (TSQ-02), la route ne lit plus les
// colonnes claires : le lookup token passe par getDecryptedToken (mocké via
// makeOauthTokensMock, null par défaut → la boucle `continue` immédiatement).
// Cette chaîne couvre les accès résiduels (listing cron, update/delete refresh).
export function makeTokensChain() {
  const single = vi.fn().mockResolvedValue({ data: null, error: null })
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.update = vi.fn(() => chain)
  chain.delete = vi.fn(() => chain)
  chain.single = single
  return { chain, single }
}

// Chaîne de dédup (syndic_emails_analysed) : select→eq→in (requête ALF-2).
export function makeDedupChain() {
  const mockIn = vi.fn()
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.in = mockIn
  return { chain, mockIn }
}

// Chaîne select→eq→maybeSingle (lookup du syndic dans le webhook).
export function makeMaybeSingleChain() {
  const maybeSingle = vi.fn()
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.maybeSingle = maybeSingle
  return { chain, maybeSingle }
}

// ── Factories de modules mockés (à passer aux vi.mock de chaque fichier) ────

export const makeSupabaseAdminMock = (from: (table: string) => unknown) => ({
  supabaseAdmin: { from },
})

export const makeSupabaseJsMock = (chain: unknown) => ({
  createClient: vi.fn(() => ({ from: vi.fn(() => chain) })),
})

export function makeAuthHelperSpies() {
  return {
    getAuthUser: vi.fn(),
    getUserRole: vi.fn(),
    isSyndicRole: vi.fn(),
    resolveCabinetId: vi.fn(),
    refreshGmailAccessToken: vi.fn(),
  }
}

export function makeLoggerSpies() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

export const makeLoggerMock = (spies: ReturnType<typeof makeLoggerSpies>) => ({
  logger: spies,
})

export const makeOauthTokensMock = (getDecryptedToken?: ReturnType<typeof vi.fn>) => ({
  getDecryptedToken: getDecryptedToken ?? vi.fn().mockResolvedValue(null),
  setEncryptedToken: vi.fn(),
})

export const makeAlfredoPipelineMock = (
  processIncomingEmail: ReturnType<typeof vi.fn> = vi.fn(),
) => ({ processIncomingEmail })

export const makeAlfredoContextMock = () => ({ loadClientContext: vi.fn() })
export const makeAlfredoClassifyMock = () => ({ classifyEmailWithGroq: vi.fn() })
export const makeAlfredoDraftMock = () => ({ generateDraftReply: vi.fn() })

export const makeSanitizeContextMock = () => ({
  sanitizeContextForLLM: vi.fn(),
  resolveSanitizedToken: vi.fn(),
})

export const makeValidationMock = () => ({
  validateBody: vi.fn(),
  emailAgentPollGetSchema: {},
})

// ── Mock partiel de next/server avec capture des callbacks after() (ALF-1) ──
// after() réel throw hors contexte requête Next (vitest appelle le handler
// directement). On capture les callbacks pour vérifier qu'ils sont bien
// enregistrés PUIS les exécuter manuellement via flushAfterCallbacks (= ce que
// fait ctx.waitUntil en prod via OpenNext). Le reste du module réel
// (NextRequest/NextResponse) est préservé par makeNextServerMockWithAfter.

type AfterTask = () => unknown | Promise<unknown>

export function makeAfterCapture() {
  const callbacks: AfterTask[] = []
  const mockAfter = vi.fn((task: AfterTask) => {
    callbacks.push(task)
  })
  // Exécute les callbacks after() enregistrés (simule la phase post-réponse).
  async function flushAfterCallbacks() {
    const tasks = callbacks.splice(0)
    for (const task of tasks) await task()
  }
  const resetAfterCallbacks = () => {
    callbacks.length = 0
  }
  return { mockAfter, flushAfterCallbacks, resetAfterCallbacks }
}

export async function makeNextServerMockWithAfter(
  importOriginal: () => Promise<Record<string, unknown>>,
  after: (task: AfterTask) => void,
) {
  const actual = await importOriginal()
  return { ...actual, after }
}

// ── Builders de Request ──────────────────────────────────────────────────────

export function makePollRequest(opts: { internalToken?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.internalToken !== undefined) headers['x-internal-trigger'] = opts.internalToken
  return new Request('http://localhost:3000/api/email-agent/poll', {
    method: 'POST',
    headers,
    body: JSON.stringify({ syndic_id: SYNDIC_ID }),
  })
}

// Requête du chemin cron : pas de syndic_id, auth par header x-cron-key.
export function makeCronPollRequest(cronKey?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cronKey !== undefined) headers['x-cron-key'] = cronKey
  return new Request('http://localhost:3000/api/email-agent/poll', {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  })
}

export function makeWebhookRequest(opts: { token?: string; email?: string; body?: string } = {}) {
  const payload = { emailAddress: opts.email ?? 'syndic@example.com', historyId: '42' }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.token !== undefined) headers['x-gmail-webhook-token'] = opts.token
  return new Request('http://localhost:3000/api/email-agent/webhook', {
    method: 'POST',
    headers,
    body: opts.body ?? JSON.stringify({ message: { data } }),
  })
}

// ── Appels de route (import dynamique APRÈS enregistrement des vi.mock) ─────

export async function callPollPOST(req: Request) {
  const { POST } = await import('@/app/api/email-agent/poll/route')
  return POST(req as never)
}

export async function callWebhookPOST(req: Request) {
  const { POST } = await import('@/app/api/email-agent/webhook/route')
  return POST(req as never)
}

// ── Assertions communes ──────────────────────────────────────────────────────

// Vérifie le status HTTP puis retourne le corps JSON (non typé, comme res.json()).
export async function expectJson(res: Response, status: number) {
  expect(res.status).toBe(status)
  return res.json()
}

// ── Fixtures Gmail (poll) ────────────────────────────────────────────────────

export function gmailMessage(id: string) {
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

// fetch global : répond à la liste Gmail puis au détail de chaque message.
export function stubGmailFetch(ids: string[]) {
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
