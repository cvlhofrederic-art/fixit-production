// tests/components/syndic-v54-correctifs-langue-agents.test.tsx
//
// Correctif : sur /pt/syndic/v54, les 5 agents IA (Fixy, Max, Léa, Alfredo,
// Tempo) répondaient en français. Cause : askAgent n'envoyait la langue qu'en
// français, et les 5 routes prennent 'fr' quand `locale` manque. On vérifie de
// bout en bout — askAgent → vraie route → prompt système envoyé au LLM — que
// la version PT obtient le prompt (et, pour Max et Léa, le corpus) portugais,
// et que la version FR garde le français. Groq, Supabase et l'auth sont simulés ;
// les prompts sont remplacés par des marqueurs (aucun prompt n'est modifié).

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NextRequest } from 'next/server'
import { askAgent } from '@/lib/syndic/v54/api'
import ModOrcIA from '@/components/syndic-dashboard/v54/modules/ModOrcIA'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { V54LocaleProvider } from '@/lib/syndic/v54/i18n'

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
    utilisateur: { id: 'u-test', email: 'gestor@exemplo.pt', user_metadata: { role: 'syndic', full_name: 'Gestor Teste' } },
    chaine,
    from: vi.fn((_table: string) => chaine()),
    groq: vi.fn(async (_params: { messages: Array<{ role: string; content: string }> }, _opts?: unknown) => ({
      choices: [{ message: { content: 'Resposta do agente' } }],
    })),
    retrieveLegalChunks: vi.fn(async (_client: unknown, _question: string, _langue: string, _opts?: unknown) => [
      { id: 'c1', content: 'Artigo 1430.º do Código Civil', parent_path: 'CC', score: 0.9 },
    ]),
    searchDocuments: vi.fn(async (_client: unknown, _cabinet: string, _question: string, _opts?: unknown) => [] as unknown[]),
  }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
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
vi.mock('@/lib/syndic/lea-documents-search', async (orig) => ({ ...(await orig<object>()), searchDocuments: h.searchDocuments }))
vi.mock('@/lib/syndic/max-legal-rag', async (orig) => ({ ...(await orig<object>()), retrieveLegalChunks: h.retrieveLegalChunks }))
vi.mock('@/lib/syndic/max-validate', async (orig) => ({
  ...(await orig<object>()),
  validateMaxResponse: vi.fn(() => ({ ok: true, answer: 'Resposta jurídica fundamentada no corpus.', citations: [], refusal: false, reasons: [] })),
}))
// Prompts remplacés par des marqueurs : on vérifie lequel la route choisit.
vi.mock('@/lib/syndic/max-strict-prompt', async (orig) => ({
  ...(await orig<object>()),
  buildMaxStrictSystemPrompt: vi.fn((o: { locale: string }) => `PROMPT max ${o.locale}`),
}))
vi.mock('@/lib/syndic/prompts/fixy/system-prompt-fr', async (orig) => ({ ...(await orig<object>()), buildFixySystemPromptFR: () => 'PROMPT fixy fr' }))
vi.mock('@/lib/syndic/prompts/fixy/system-prompt-pt', async (orig) => ({ ...(await orig<object>()), buildFixySystemPromptPT: () => 'PROMPT fixy pt' }))
vi.mock('@/lib/syndic/prompts/lea/system-prompt-fr', async (orig) => ({ ...(await orig<object>()), buildLeaSystemPromptFR: () => 'PROMPT lea fr' }))
vi.mock('@/lib/syndic/prompts/lea/system-prompt-pt', async (orig) => ({ ...(await orig<object>()), buildLeaSystemPromptPT: () => 'PROMPT lea pt' }))
vi.mock('@/lib/syndic/prompts/alfredo/system-prompt-fr', async (orig) => ({ ...(await orig<object>()), buildAlfredoSystemPromptFR: () => 'PROMPT alfredo fr' }))
vi.mock('@/lib/syndic/prompts/alfredo/system-prompt-pt', async (orig) => ({ ...(await orig<object>()), buildAlfredoSystemPromptPT: () => 'PROMPT alfredo pt' }))
vi.mock('@/lib/syndic/prompts/tempo/system-prompt-fr', async (orig) => ({ ...(await orig<object>()), buildTempoSystemPromptFR: () => 'PROMPT tempo fr' }))
vi.mock('@/lib/syndic/prompts/tempo/system-prompt-pt', async (orig) => ({ ...(await orig<object>()), buildTempoSystemPromptPT: () => 'PROMPT tempo pt' }))

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

/** Prompt système du dernier appel LLM. */
const promptSysteme = (): string => {
  const appel = h.groq.mock.calls.at(-1)
  if (!appel) throw new Error('aucun appel LLM')
  return appel[0].messages[0].content
}

const AGENTS = ['fixy', 'max', 'lea', 'alfredo', 'tempo'] as const
const ENDPOINT: Record<(typeof AGENTS)[number], string> = {
  fixy: '/api/syndic/fixy-syndic',
  max: '/api/syndic/max-ai',
  lea: '/api/syndic/lea-comptable',
  alfredo: '/api/syndic/alfredo-chat',
  tempo: '/api/syndic/tempo-ai',
}

let fetchSpy: ReturnType<typeof brancherRoutes>

beforeEach(() => {
  h.groq.mockClear()
  h.from.mockClear()
  h.retrieveLegalChunks.mockClear()
  h.searchDocuments.mockClear()
  fetchSpy = brancherRoutes()
})

afterEach(() => {
  fetchSpy.mockRestore()
})

describe('Correctif langue des agents IA v54 — version PT', () => {
  it.each(AGENTS)('%s : la version PT obtient le prompt portugais', async (agent) => {
    const reponse = await askAgent(agent, 'Olá, preciso de ajuda', 'tok', 'pt-PT')
    expect(promptSysteme().startsWith(`PROMPT ${agent} pt`)).toBe(true)
    expect(reponse.length).toBeGreaterThan(0)
  })

  it('Max : la version PT interroge le corpus juridique portugais', async () => {
    await askAgent('max', 'Quem paga as obras na fachada?', 'tok', 'pt-PT')
    expect(h.retrieveLegalChunks.mock.calls[0][2]).toBe('pt')
    const tables = h.from.mock.calls.map((c) => c[0])
    expect(tables).toContain('syndic_legal_corpus_pt')
    expect(tables).not.toContain('syndic_legal_corpus_fr')
  })

  it('Léa : la version PT cherche dans les documents en portugais', async () => {
    await askAgent('lea', 'Qual é o saldo do fundo comum de reserva?', 'tok', 'pt-PT')
    expect(h.searchDocuments.mock.calls[0][3]).toMatchObject({ locale: 'pt' })
  })

  it('ModOrcIA (Léa) sur la version PT : de bout en bout, prompt portugais', async () => {
    const d: SyndicData = { authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], token: 'tok-orcia' }
    render(<SyndicDataContext.Provider value={d}><ModOrcIA /></SyndicDataContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: /Gerar Orçamento 2027/ }))
    await screen.findByText('Resposta do agente')
    expect(JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body))).toMatchObject({ locale: 'pt' })
    expect(promptSysteme()).toBe('PROMPT lea pt')
  })
})

describe('Correctif langue des agents IA v54 — version FR inchangée', () => {
  it.each(AGENTS)('%s : la version FR garde le prompt français', async (agent) => {
    await askAgent(agent, 'Bonjour, j’ai besoin d’aide', 'tok', 'fr-FR')
    expect(promptSysteme().startsWith(`PROMPT ${agent} fr`)).toBe(true)
  })

  it('Max : la version FR interroge le corpus juridique français', async () => {
    await askAgent('max', 'Qui paie le ravalement ?', 'tok', 'fr-FR')
    expect(h.retrieveLegalChunks.mock.calls[0][2]).toBe('fr')
    expect(h.from.mock.calls.map((c) => c[0])).toContain('syndic_legal_corpus_fr')
  })

  it('ModOrcIA (Léa) sur la version FR : prompt français', async () => {
    const d: SyndicData = { authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], token: 'tok-orcia' }
    render(
      <V54LocaleProvider locale="fr-FR">
        <SyndicDataContext.Provider value={d}><ModOrcIA /></SyndicDataContext.Provider>
      </V54LocaleProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Générer le budget 2027/ }))
    await waitFor(() => expect(h.groq).toHaveBeenCalled())
    expect(JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body))).toMatchObject({ locale: 'fr' })
    expect(promptSysteme()).toBe('PROMPT lea fr')
  })
})

describe('Cause racine — sans `locale`, les 5 routes répondent en français', () => {
  it.each(AGENTS)('%s : corps sans langue → prompt français (d’où l’envoi explicite de « pt »)', async (agent) => {
    await fetch(ENDPOINT[agent], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ message: 'Olá' }),
    })
    expect(promptSysteme().startsWith(`PROMPT ${agent} fr`)).toBe(true)
  })
})
