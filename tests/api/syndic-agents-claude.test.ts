// tests/api/syndic-agents-claude.test.ts
//
// Routes des agents IA du syndic sur le chemin Claude réel (lib/claude.ts non simulé) : clé
// Anthropic présente, API Anthropic simulée par un faux fetch qui répond en flux SSE.
// - Max : Claude répond en premier (consigne JSON, fil de conversation au format JSON),
//   provider 'claude' ; bascule vers Cerebras puis Groq si Claude échoue.
// - Fixy : historique masqué (données personnelles) avec le contexte ; modèle renvoyé.
// - Tempo : relance après outil = messages alternés qui finissent par l'utilisateur.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  const resultat = { data: [] as unknown[], count: 0, error: null }
  const chaine = (): unknown => {
    const requete: unknown = new Proxy(() => undefined, {
      get: (_cible, prop) =>
        prop === 'then'
          ? (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultat).then(ok, ko)
          : () => requete,
    })
    return requete
  }
  const utilisateur = { id: 'u-test', email: 'gestion@exemple.fr', app_metadata: { role: 'syndic' }, user_metadata: { full_name: 'Gestion Test' } }
  return {
    utilisateur,
    chaine,
    getSecret: vi.fn(async (cle: string) => ({ ANTHROPIC_API_KEY: 'sk-ant-test', GROQ_API_KEY: 'gsk-test', CEREBRAS_API_KEY: 'csk-test' } as Record<string, string>)[cle] ?? ''),
    groq: vi.fn(async (_params: unknown, _opts?: unknown) => ({ choices: [{ message: { content: '{"answer":"Réponse Groq","citations":[],"refusal":false}' } }], model: 'llama-3.3-70b-versatile' })),
    cerebras: vi.fn(async (_params: unknown, _opts?: unknown) => ({ choices: [{ message: { content: '{"answer":"Réponse Cerebras assez longue pour passer","citations":[],"refusal":false}' } }] })),
    retrieveLegalChunks: vi.fn(async () => [
      { id: 'c1', content: 'Article 10 de la loi du 10 juillet 1965 : charges.', parent_path: 'L65', score: 0.9 },
    ]),
  }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/env', () => ({ getSecret: h.getSecret, getCfEnv: vi.fn(async () => ({})), validateEnv: vi.fn() }))
vi.mock('@/lib/rate-limit', async (orig) => ({
  ...(await orig<object>()),
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', async (orig) => ({
  ...(await orig<object>()),
  getAuthUser: vi.fn(async () => h.utilisateur),
  getUserRole: vi.fn(() => 'syndic'),
  isSyndicRole: vi.fn(() => true),
  resolveCabinetId: vi.fn(async () => 'cab-test'),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: vi.fn(() => h.chaine()), rpc: vi.fn(() => h.chaine()) } }))
vi.mock('@/lib/supabase-server-component', () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: h.utilisateur } }) } })),
}))
vi.mock('@/lib/groq', async (orig) => ({ ...(await orig<object>()), callGroqWithRetry: h.groq, callGroqStreaming: vi.fn() }))
vi.mock('@/lib/cerebras', async (orig) => ({ ...(await orig<object>()), callCerebrasWithRetry: h.cerebras }))
vi.mock('@/lib/langfuse', async (orig) => ({ ...(await orig<object>()), traceAgent: vi.fn((_m: unknown, appel: () => unknown) => appel()) }))
vi.mock('@/lib/syndic/fixy-context-loader', () => ({
  loadFixyContext: vi.fn(async () => ({ coproprios: [{ nom: 'Durand', email: 'jean.durand@exemple.fr' }] })),
}))
vi.mock('@/lib/syndic/max-legal-rag', async (orig) => ({ ...(await orig<object>()), retrieveLegalChunks: h.retrieveLegalChunks }))

type Ev = Record<string, unknown>
const sse = (evs: Ev[]) => evs.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('')
const fluxClaude = (texte: string) => new Response(sse([
  { type: 'message_start', message: { model: 'claude-sonnet-5-5', usage: { input_tokens: 10, output_tokens: 1 } } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: texte } },
  { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } },
  { type: 'message_stop' },
]), { headers: { 'content-type': 'text/event-stream' } })

let corpsAnthropic: Array<Record<string, unknown>> = []
let reponseAnthropic: () => Response = () => fluxClaude('Bonjour')
const fetchOriginal = globalThis.fetch

beforeEach(() => {
  corpsAnthropic = []
  h.groq.mockClear()
  h.cerebras.mockClear()
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url === 'https://api.anthropic.com/v1/messages') {
      corpsAnthropic.push(JSON.parse(String(init?.body)))
      return reponseAnthropic()
    }
    throw new Error(`fetch inattendu : ${url}`)
  }) as unknown as typeof fetch
})
afterEach(() => {
  globalThis.fetch = fetchOriginal
})

async function appeler(chemin: string, module: () => Promise<{ POST: (req: NextRequest) => Promise<Response> }>, corps: Record<string, unknown>) {
  const { POST } = await module()
  const res = await POST(new NextRequest(`https://vitfix.io${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok', origin: 'https://vitfix.io' },
    body: JSON.stringify(corps),
  }))
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

const max = () => import('@/app/api/syndic/max-ai/route')
const fixy = () => import('@/app/api/syndic/fixy-syndic/route')
const tempo = () => import('@/app/api/syndic/tempo-ai/route')

describe('Max — Claude en premier', () => {
  it('répond avec Claude : consigne JSON, fil au format JSON, provider claude', async () => {
    reponseAnthropic = () => fluxClaude('{"answer":"Selon l\'article 10, les charges sont réparties [FONT-1].","citations":[{"font_id":"FONT-1"}],"refusal":false}')
    const { status, json } = await appeler('/api/syndic/max-ai', max, {
      message: 'Et pour le ravalement ?',
      locale: 'fr',
      conversation_history: [
        { role: 'user', content: 'Qui paie les charges ?' },
        { role: 'assistant', content: 'Les charges sont réparties selon les tantièmes.' },
      ],
    })
    expect(status).toBe(200)
    expect(json.provider).toBe('claude')
    expect(String(json.response)).toContain('article 10')
    expect(h.cerebras).not.toHaveBeenCalled()
    expect(h.groq).not.toHaveBeenCalled()

    const corps = corpsAnthropic[0]
    expect(corps.model).toBe('claude-sonnet-5-5')
    expect((corps.system as Array<{ text: string }>)[0].text).toMatch(/objet JSON valide/)
    const messages = corps.messages as Array<{ role: string; content: string }>
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(JSON.parse(messages[1].content)).toEqual({ answer: 'Les charges sont réparties selon les tantièmes.', citations: [], refusal: false })
  })

  it('aucun texte dans la base juridique : réponse générale de Claude, présentée comme telle (pas de refus)', async () => {
    h.retrieveLegalChunks.mockResolvedValueOnce([])
    reponseAnthropic = () => fluxClaude('La majorité de l’article 25 s’applique en principe.')
    const { json } = await appeler('/api/syndic/max-ai', max, { message: 'Quelle majorité pour désigner le syndic ?', locale: 'fr' })
    expect(json.refusal).toBe(false)
    expect(json.mode).toBe('general')
    expect(json.provider).toBe('claude')
    expect(String(json.response)).toMatch(/^ℹ️ \*Réponse générale de Max/)
    expect(String(json.response)).toContain('article 25')
    expect(json.citations).toEqual([])
    expect(h.groq).not.toHaveBeenCalled()
  })

  it('aucun texte dans la base et Claude en échec : refus standard (pas de réponse juridique sans source par Llama)', async () => {
    h.retrieveLegalChunks.mockResolvedValueOnce([])
    reponseAnthropic = () => Response.json({ type: 'error', error: { type: 'api_error', message: 'boom' } }, { status: 500 })
    const { json } = await appeler('/api/syndic/max-ai', max, { message: 'Quelle majorité ?', locale: 'fr' })
    expect(json.refusal).toBe(true)
    expect(h.groq).not.toHaveBeenCalled()
    expect(h.cerebras).not.toHaveBeenCalled()
  })

  it('Claude en échec : chaîne historique Cerebras', async () => {
    reponseAnthropic = () => Response.json({ type: 'error', error: { type: 'api_error', message: 'boom' } }, { status: 500 })
    const { json } = await appeler('/api/syndic/max-ai', max, { message: 'Qui paie le ravalement ?', locale: 'fr' })
    expect(h.cerebras).toHaveBeenCalledTimes(1)
    expect(json.provider).toBe('cerebras')
  })
})

describe('Fixy — historique masqué, modèle renvoyé', () => {
  it('l’e-mail présent dans l’historique ne part pas en clair vers Claude ; la réponse indique le modèle', async () => {
    reponseAnthropic = () => fluxClaude('Voici le point du jour.')
    const { json } = await appeler('/api/syndic/fixy-syndic', fixy, {
      message: 'Et ses impayés ?',
      locale: 'fr',
      conversation_history: [
        { role: 'user', content: 'Coordonnées de M. Durand ?' },
        { role: 'assistant', content: 'M. Durand : jean.durand@exemple.fr' },
      ],
    })
    expect(json.response).toBe('Voici le point du jour.')
    expect(json.modele).toBe('claude-sonnet-5-5')
    const envoye = JSON.stringify(corpsAnthropic[0])
    expect(envoye).not.toContain('jean.durand@exemple.fr')
    expect(envoye).toMatch(/<email:[0-9a-f]{8}>/)
  })
})

describe('Tempo — relance après outil', () => {
  it('les messages de la relance alternent et se terminent par l’utilisateur', async () => {
    let n = 0
    reponseAnthropic = () => fluxClaude(n++ === 0 ? '##TOOL##{"name":"list_automations","args":{}}##' : 'Vous avez 0 automatisation active.')
    const { json } = await appeler('/api/syndic/tempo-ai', tempo, { message: 'Mes automatisations ?', locale: 'fr' })
    expect(json.response).toBe('Vous avez 0 automatisation active.')
    expect(corpsAnthropic).toHaveLength(2)
    const roles = (corpsAnthropic[1].messages as Array<{ role: string }>).map(m => m.role)
    expect(roles[0]).toBe('user')
    expect(roles[roles.length - 1]).toBe('user')
    roles.slice(1).forEach((r, i) => expect(r).not.toBe(roles[i]))
  })
})
