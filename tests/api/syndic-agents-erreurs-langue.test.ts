// tests/api/syndic-agents-erreurs-langue.test.ts
//
// Routes des agents IA du syndic (Max, Fixy, Léa) : les réponses d'erreur et
// les réponses de secours doivent suivre la langue de la requête (`locale`).
// - Max : le refus joint à l'erreur 500 était toujours en portugais.
// - Fixy : les erreurs 400 et 500 n'étaient qu'en français.
// - Léa : l'erreur 500 mêlait portugais (fautif) et français.
// - Les trois routes : une panne du secret, de la limite de débit ou de
//   l'authentification répondait dans la langue par défaut, le corps n'étant
//   pas encore lu ; le corps est désormais lu en premier.
// - Léa, réponse de secours (sans IA) : références de procédure FR et PT.
// Les routes sont appelées directement (askAgent masque le corps des 500).
// Groq, Supabase et l'auth sont simulés ; aucun appel réseau.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getRefusalMessage } from '@/lib/syndic/max-strict-prompt'

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
  const secretsParDefaut = async (cle: string) => (cle === 'GROQ_API_KEY' ? 'valeur-factice-test' : '')
  const utilisateur = { id: 'u-test', email: 'gestion@exemple.fr', user_metadata: { role: 'syndic', full_name: 'Gestion Test' } }
  return {
    utilisateur,
    chaine,
    secretsParDefaut,
    getSecret: vi.fn(secretsParDefaut),
    checkRateLimit: vi.fn(async (_cle: string, _max: number, _fenetre: number) => true),
    getAuthUser: vi.fn(async (_req: unknown): Promise<typeof utilisateur | null> => utilisateur),
    from: vi.fn((_table: string) => chaine()),
    groq: vi.fn(async (_params: unknown, _opts?: unknown) => ({ choices: [{ message: { content: 'Réponse de l’agent' } }] })),
    retrieveLegalChunks: vi.fn(async (_client: unknown, _question: string, _langue: string, _opts?: unknown) => [
      { id: 'c1', content: 'Article 10 de la loi du 10 juillet 1965', parent_path: 'L65', score: 0.9 },
    ]),
    // Remplacé par l'implémentation réelle au chargement du module simulé.
    sanitize: vi.fn(),
  }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/env', () => ({
  getSecret: h.getSecret,
  getCfEnv: vi.fn(async () => ({})),
  validateEnv: vi.fn(),
}))
vi.mock('@/lib/rate-limit', async (orig) => ({
  ...(await orig<object>()),
  checkRateLimit: h.checkRateLimit,
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', async (orig) => ({
  ...(await orig<object>()),
  getAuthUser: h.getAuthUser,
  getUserRole: vi.fn(() => 'syndic'),
  isSyndicRole: vi.fn(() => true),
  resolveCabinetId: vi.fn(async () => 'cab-test'),
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
vi.mock('@/lib/syndic/lea-documents-search', async (orig) => ({
  ...(await orig<object>()),
  searchDocuments: vi.fn(async () => []),
}))
vi.mock('@/lib/syndic/max-legal-rag', async (orig) => ({ ...(await orig<object>()), retrieveLegalChunks: h.retrieveLegalChunks }))
vi.mock('@/lib/ai/sanitize-context', async (orig) => {
  const reel = await orig<typeof import('@/lib/ai/sanitize-context')>()
  h.sanitize.mockImplementation(reel.sanitizeContextForLLM)
  return { ...reel, sanitizeContextForLLM: h.sanitize }
})

type Handler = (req: NextRequest) => Promise<Response>
const ROUTES = {
  max: () => import('@/app/api/syndic/max-ai/route'),
  fixy: () => import('@/app/api/syndic/fixy-syndic/route'),
  lea: () => import('@/app/api/syndic/lea-comptable/route'),
} as const
const CHEMINS: Record<keyof typeof ROUTES, string> = {
  max: '/api/syndic/max-ai',
  fixy: '/api/syndic/fixy-syndic',
  lea: '/api/syndic/lea-comptable',
}

/** Appelle la route avec un corps JSON (objet) ou brut (chaîne). */
async function appeler(agent: keyof typeof ROUTES, corps: Record<string, unknown> | string) {
  const { POST } = await ROUTES[agent]()
  const req = new NextRequest(`https://vitfix.io${CHEMINS[agent]}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
    body: typeof corps === 'string' ? corps : JSON.stringify(corps),
  })
  const res = await (POST as Handler)(req)
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

/** Fait lever le masquage des données personnelles : exception imprévue dans la route. */
const pannerSanitize = () =>
  h.sanitize.mockImplementationOnce(() => {
    throw new Error('panne simulée')
  })

beforeEach(() => {
  h.getSecret.mockReset()
  h.getSecret.mockImplementation(h.secretsParDefaut)
  h.checkRateLimit.mockReset()
  h.checkRateLimit.mockImplementation(async () => true)
  h.getAuthUser.mockReset()
  h.getAuthUser.mockImplementation(async () => h.utilisateur)
  h.groq.mockClear()
  h.from.mockClear()
  h.retrieveLegalChunks.mockClear()
  h.sanitize.mockClear()
})

describe('Max — refus de l’erreur 500 dans la langue de la requête', () => {
  it('requête FR : refus en français', async () => {
    h.retrieveLegalChunks.mockRejectedValueOnce(new Error('panne'))
    const { status, json } = await appeler('max', { message: 'Qui paie le ravalement ?', locale: 'fr' })
    expect(status).toBe(500)
    expect(json.response).toBe(getRefusalMessage('fr'))
    expect(json.error).toBe('internal_error')
  })

  it('requête PT : refus en portugais', async () => {
    h.retrieveLegalChunks.mockRejectedValueOnce(new Error('panne'))
    const { status, json } = await appeler('max', { message: 'Quem paga as obras na fachada?', locale: 'pt' })
    expect(status).toBe(500)
    expect(json.response).toBe(getRefusalMessage('pt'))
  })
})

describe('Fixy — erreurs 400 et 500 dans la langue de la requête', () => {
  it('message vide, requête PT : 400 en portugais', async () => {
    const { status, json } = await appeler('fixy', { message: '   ', locale: 'pt' })
    expect(status).toBe(400)
    expect(json.error).toBe('mensagem obrigatória')
  })

  it.each([
    ['requête FR', { message: '   ', locale: 'fr' }],
    ['requête sans langue', { message: '   ' }],
  ])('message vide, %s : 400 en français', async (_cas, corps) => {
    const { status, json } = await appeler('fixy', corps)
    expect(status).toBe(400)
    expect(json.error).toBe('message requis')
  })

  it('exception imprévue, requête PT : 500 en portugais', async () => {
    pannerSanitize()
    const { status, json } = await appeler('fixy', { message: 'Olá', locale: 'pt' })
    expect(status).toBe(500)
    expect(json.error).toBe('Ocorreu um erro interno')
  })

  it('exception imprévue, requête FR : 500 en français', async () => {
    pannerSanitize()
    const { status, json } = await appeler('fixy', { message: 'Bonjour', locale: 'fr' })
    expect(status).toBe(500)
    expect(json.error).toBe('Une erreur interne est survenue')
  })
})

describe('Léa — erreur 500 dans la langue de la requête (une seule langue)', () => {
  it('exception imprévue, requête PT : 500 en portugais', async () => {
    pannerSanitize()
    const { status, json } = await appeler('lea', { message: 'Qual é o saldo?', locale: 'pt' })
    expect(status).toBe(500)
    expect(json.error).toBe('Ocorreu um erro interno')
  })

  it('exception imprévue, requête FR : 500 en français, sans portugais', async () => {
    pannerSanitize()
    const { status, json } = await appeler('lea', { message: 'Quel est le solde ?', locale: 'fr' })
    expect(status).toBe(500)
    expect(json.error).toBe('Une erreur interne est survenue')
  })
})

// Le secret, la limite de débit et l'authentification passent avant la
// validation du corps et peuvent lever. La langue de la requête doit déjà être
// connue : chaque route lit son corps en tout premier. Seul un corps illisible
// garde le défaut de la route, le français.
const ERREUR_500: Record<keyof typeof ROUTES, { champ: string; fr: string; pt: string }> = {
  max: { champ: 'response', fr: getRefusalMessage('fr'), pt: getRefusalMessage('pt') },
  fixy: { champ: 'error', fr: 'Une erreur interne est survenue', pt: 'Ocorreu um erro interno' },
  lea: { champ: 'error', fr: 'Une erreur interne est survenue', pt: 'Ocorreu um erro interno' },
}
const PANNES_AVANT_VALIDATION: Array<[string, () => void]> = [
  ['du secret (getSecret)', () => h.getSecret.mockRejectedValueOnce(new Error('secret indisponible'))],
  ['de la limite de débit (checkRateLimit)', () => h.checkRateLimit.mockRejectedValueOnce(new Error('limiteur indisponible'))],
  ["de l'authentification (getAuthUser)", () => h.getAuthUser.mockRejectedValueOnce(new Error('auth indisponible'))],
]
const CORPS = {
  pt: { message: 'Olá, qual é o saldo?', locale: 'pt' },
  fr: { message: 'Bonjour, quel est le solde ?', locale: 'fr' },
} as const

describe.each(['max', 'fixy', 'lea'] as const)('%s — panne avant la validation du corps', (agent) => {
  const attendu = ERREUR_500[agent]

  describe.each(PANNES_AVANT_VALIDATION)('panne %s : erreur 500 dans la langue de la requête', (_etape, panner) => {
    it.each(['pt', 'fr'] as const)('requête %s', async (langue) => {
      panner()
      const { status, json } = await appeler(agent, CORPS[langue])
      expect(status).toBe(500)
      expect(json[attendu.champ]).toBe(attendu[langue])
    })
  })

  it('corps illisible (langue inconnue) : 500 dans la langue par défaut de la route, le français', async () => {
    const { status, json } = await appeler(agent, 'xx')
    expect(status).toBe(500)
    expect(json[attendu.champ]).toBe(attendu.fr)
  })

  it('corps illisible sans authentification : 401, l’ordre des contrôles est inchangé', async () => {
    h.getAuthUser.mockResolvedValueOnce(null)
    const { status } = await appeler(agent, 'xx')
    expect(status).toBe(401)
  })

  it('limite de débit atteinte : 429, sans authentification ni appel à l’IA', async () => {
    h.checkRateLimit.mockResolvedValueOnce(false)
    const { status } = await appeler(agent, CORPS.pt)
    expect(status).toBe(429)
    expect(h.getAuthUser).not.toHaveBeenCalled()
    expect(h.groq).not.toHaveBeenCalled()
  })
})

describe('Léa — réponse de secours sans IA : procédure de recouvrement du pays', () => {
  beforeEach(() => {
    h.getSecret.mockImplementation(async () => '')
  })

  it('FR : injonction de payer ou procédure accélérée au fond (art. 19-2)', async () => {
    const { status, json } = await appeler('lea', { message: 'Relance pour un impayé', locale: 'fr' })
    expect(status).toBe(200)
    expect(json.fallback).toBe(true)
    const texte = String(json.response)
    expect(texte).toContain(
      '4. **Procédure judiciaire** — Injonction de payer ou, après mise en demeure restée sans effet 30 jours, procédure accélérée au fond (art. 19-2 loi 10/07/1965)',
    )
    expect(texte).not.toMatch(/art\.\s?19 loi/)
  })

  // L'art. 6.º du DL 268/94 fait de l'ata un título executivo : il fonde l'ação executiva.
  // L'injunção (DL 269/98) sert à obtenir un titre pour une créance sans ata exequível
  // (docs/agent-max/regime-juridico-condominio-portugal-2026.md, F.4).
  it('PT : ação executiva fondée sur l’ata (art. 6.º do DL 268/94), injunção à défaut d’ata exequível', async () => {
    const { status, json } = await appeler('lea', { message: 'Cobrança de uma dívida', locale: 'pt' })
    expect(status).toBe(200)
    expect(json.fallback).toBe(true)
    const texte = String(json.response)
    expect(texte).toContain(
      '4. **Procedimento judicial** — Ação executiva com base na ata da assembleia (art. 6.º do DL 268/94) ou, na falta de ata exequível, injunção (DL 269/98)',
    )
    expect(texte).not.toContain('Injunção / ação executiva')
    expect(texte).not.toContain('1424')
  })
})
