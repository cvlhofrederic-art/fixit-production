// tests/components/syndic-v54-agents-historique-routes.test.ts
//
// Mémoire de conversation des 5 agents IA v54 (Fixy, Max, Léa, Alfredo, Tempo),
// de bout en bout : askAgent(historique) → vraie route Next → messages envoyés
// au LLM. On vérifie que chaque route accepte `conversation_history` (pas de 400
// Zod : rôles, nombre, taille) et le place entre le prompt système et la
// question. Supabase, l'auth et le LLM sont simulés (même montage que
// syndic-v54-correctifs-langue-agents) ; sans clé Anthropic, lib/claude passe
// par le secours Groq simulé, avec exactement les mêmes messages.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { askAgent, type MessageHistorique } from '@/lib/syndic/v54/api'
import { versMessagesClaude } from '@/lib/claude'

const h = vi.hoisted(() => {
  const resultat = { data: [] as unknown[], count: 0, error: null }
  // Requête Supabase factice : toute chaîne (.select().eq().limit()…) se résout à `resultat`.
  const chaine = (): unknown => {
    const requete: unknown = new Proxy(() => undefined, {
      get: (_cible, prop) =>
        prop === 'then'
          ? (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultat).then(ok, ko)
          : () => requete,
    })
    return requete
  }
  return {
    utilisateur: { id: 'u-test', email: 'admin@vitfix.io', app_metadata: { role: 'super_admin' }, user_metadata: { role: 'syndic', full_name: 'Gestionnaire Test' } },
    chaine,
    from: vi.fn((_table: string) => chaine()),
    groq: vi.fn(async (_params: { messages: Array<{ role: string; content: string }> }, _opts?: unknown) => ({
      choices: [{ message: { content: 'Réponse de l’agent' } }],
    })),
  }
})

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  withScope: vi.fn((cb: (s: unknown) => void) => cb({ setUser: vi.fn(), setTag: vi.fn(), setExtras: vi.fn(), setLevel: vi.fn() })),
}))
vi.mock('@/lib/env', () => ({
  getSecret: vi.fn(async (cle: string) => (cle === 'GROQ_API_KEY' ? 'valeur-factice-test' : '')),
  getCfEnv: vi.fn(async () => ({})),
  validateEnv: vi.fn(),
}))
vi.mock('@/lib/rate-limit', async (orig) => ({
  ...(await orig<object>()),
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', async (orig) => ({
  ...(await orig<object>()),
  getAuthUser: vi.fn(async () => h.utilisateur),
  getUserRole: vi.fn(() => 'super_admin'),
  isSyndicRole: vi.fn(() => true),
  resolveCabinetId: vi.fn(async () => 'u-test'),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: h.from, rpc: vi.fn(() => h.chaine()) } }))
vi.mock('@/lib/supabase-server-component', () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: h.utilisateur } }) } })),
}))
vi.mock('@/lib/groq', async (orig) => ({ ...(await orig<object>()), callGroqWithRetry: h.groq, callGroqStreaming: vi.fn() }))
vi.mock('@/lib/cerebras', async (orig) => ({ ...(await orig<object>()), callCerebrasWithRetry: vi.fn() }))
vi.mock('@/lib/langfuse', async (orig) => ({
  ...(await orig<object>()),
  traceAgent: vi.fn((_meta: unknown, appel: () => unknown) => appel()),
}))
vi.mock('@/lib/syndic/fixy-context-loader', () => ({ loadFixyContext: vi.fn(async () => ({})) }))
vi.mock('@/lib/syndic/lea-context-loader', () => ({ loadLeaContext: vi.fn(async () => ({})) }))
vi.mock('@/lib/syndic/lea-documents-search', async (orig) => ({ ...(await orig<object>()), searchDocuments: vi.fn(async () => []) }))
vi.mock('@/lib/syndic/max-legal-rag', async (orig) => ({
  ...(await orig<object>()),
  retrieveLegalChunks: vi.fn(async () => [{ id: 'c1', content: 'Article 10 de la loi du 10 juillet 1965', parent_path: 'Loi 1965', score: 0.9 }]),
}))
vi.mock('@/lib/syndic/max-validate', async (orig) => ({
  ...(await orig<object>()),
  validateMaxResponse: vi.fn(() => ({ ok: true, answer: 'Réponse juridique fondée sur le corpus.', citations: [], refusal: false, reasons: [] })),
}))

type Handler = (req: NextRequest) => Promise<Response>
const ROUTES: Record<string, () => Promise<{ POST: unknown }>> = {
  '/api/syndic/fixy-syndic': () => import('@/app/api/syndic/fixy-syndic/route'),
  '/api/syndic/max-ai': () => import('@/app/api/syndic/max-ai/route'),
  '/api/syndic/lea-comptable': () => import('@/app/api/syndic/lea-comptable/route'),
  '/api/syndic/alfredo-chat': () => import('@/app/api/syndic/alfredo-chat/route'),
  '/api/syndic/tempo-ai': () => import('@/app/api/syndic/tempo-ai/route'),
}

/** Envoie chaque fetch du client à la vraie route Next correspondante. */
function brancherRoutes() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (entree, init) => {
    const chemin = String(entree)
    const charger = ROUTES[chemin]
    if (!charger) throw new Error(`route non simulée : ${chemin}`)
    const { POST } = await charger()
    return (POST as Handler)(new NextRequest(`https://vitfix.io${chemin}`, init as ConstructorParameters<typeof NextRequest>[1]))
  })
}

/** Messages du premier appel LLM de la requête. */
const messagesLLM = (): Array<{ role: string; content: string }> => {
  const appel = h.groq.mock.calls[0]
  if (!appel) throw new Error('aucun appel LLM')
  return appel[0].messages
}

const AGENTS = ['fixy', 'max', 'lea', 'alfredo', 'tempo'] as const
/** Historique retenu par chaque route (Max : 12 derniers ; les autres : 30 ou plus). */
const RETENUS: Record<(typeof AGENTS)[number], number> = { fixy: 20, max: 12, lea: 20, alfredo: 20, tempo: 20 }

const fil = (n: number, taille = 0): MessageHistorique[] =>
  Array.from({ length: n }, (_, i): MessageHistorique => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i}` + (taille ? ' ' + 'z'.repeat(taille) : ''),
  }))

let fetchSpy: ReturnType<typeof brancherRoutes>

beforeEach(() => {
  h.groq.mockClear()
  fetchSpy = brancherRoutes()
})

afterEach(() => {
  fetchSpy.mockRestore()
})

describe('Mémoire de conversation — les 5 routes acceptent et transmettent conversation_history', () => {
  it.each(AGENTS)('%s : historique placé entre le prompt système et la question', async (agent) => {
    const historique = fil(20)
    await askAgent(agent, 'Question finale', 'tok', 'fr-FR', historique) // rejette si HTTP ≠ 2xx
    const msgs = messagesLLM()
    expect(msgs[0].role).toBe('system')
    expect(msgs.at(-1)).toMatchObject({ role: 'user', content: 'Question finale' })
    const brut = historique.slice(-RETENUS[agent])
    // Max remet ses réponses précédentes au format JSON qu'il doit produire ({answer, citations, refusal}).
    const attendu = agent === 'max'
      ? brut.map((m) => (m.role === 'assistant'
        ? { role: m.role, content: JSON.stringify({ answer: m.content.substring(0, 2000), citations: [], refusal: false }) }
        : m))
      : brut
    expect(msgs.slice(1, -1).map(({ role, content }) => ({ role, content }))).toEqual(attendu)
    // Format Claude (lib/claude) : le fil reste alterné, la question en dernier.
    const claude = versMessagesClaude(msgs as Parameters<typeof versMessagesClaude>[0])
    expect(claude.messages).toHaveLength(attendu.length + 1)
    expect(claude.messages.at(-1)).toEqual({ role: 'user', content: 'Question finale' })
  })

  it.each(AGENTS)('%s : 20 messages de 3000 caractères (plafond client) → pas de 400', async (agent) => {
    const historique = fil(40, 5000) // askAgent borne à 20 messages de 3000 caractères
    await expect(askAgent(agent, 'Suite', 'tok', 'fr-FR', historique)).resolves.toBeTruthy()
    expect(messagesLLM().slice(1, -1)).toHaveLength(RETENUS[agent])
  })

  it.each(AGENTS)('%s : deux questions consécutives (réponse d’erreur retirée du fil) → acceptées', async (agent) => {
    const historique: MessageHistorique[] = [
      { role: 'user', content: 'Question restée sans réponse' },
      { role: 'user', content: 'Deuxième essai' },
      { role: 'assistant', content: '**Voici** la réponse.' },
    ]
    await expect(askAgent(agent, 'Merci, et ensuite ?', 'tok', 'fr-FR', historique)).resolves.toBeTruthy()
    expect(messagesLLM().slice(1, -1).map((m) => m.role)).toEqual(['user', 'user', 'assistant'])
  })
})
