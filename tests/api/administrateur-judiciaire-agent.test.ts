// tests/api/administrateur-judiciaire-agent.test.ts
//
// Route des agents IA de la succursale Administrateur judiciaire : authentification (rôle syndic ou
// super admin), validation du corps, prompt construit avec les données envoyées par l'écran, données
// personnelles masquées avant le modèle puis rétablies dans la réponse. Claude, Supabase et l'auth sont
// simulés ; aucun appel réseau.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  utilisateur: { id: 'u-aj', email: 'admin@exemple.fr', app_metadata: { role: 'super_admin' } } as Record<string, unknown> | null,
  getSecret: vi.fn(async (cle: string) => (cle === 'ANTHROPIC_API_KEY' ? 'cle-factice' : '')),
  claude: vi.fn(async (_opts: { messages: Array<{ role: string; content: string }> }, _config?: unknown) => ({
    choices: [{ message: { content: 'Réponse de Fixy' } }],
    model: 'claude-sonnet-5-5',
  })),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/env', () => ({ getSecret: h.getSecret, getCfEnv: vi.fn(async () => ({})), validateEnv: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/supabase-server-component', () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: h.utilisateur } }) } })),
}))
vi.mock('@/lib/claude', () => ({
  callClaudeWithRetry: h.claude,
  hasAnthropicKey: vi.fn(async () => !!(await h.getSecret('ANTHROPIC_API_KEY'))),
}))
vi.mock('@/lib/langfuse', () => ({ traceAgent: (_p: unknown, fn: () => Promise<unknown>) => fn() }))

const { POST } = await import('@/app/api/administrateur-judiciaire/agent/route')

const requete = (corps: unknown) =>
  new NextRequest('http://localhost/api/administrateur-judiciaire/agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  })

const CONTEXTE = {
  dateDuJour: '2026-06-04',
  coproprieteSelectionnee: 'Le Clos des Vignes',
  coproprietes: [{ code: 'CV', nom: 'Le Clos des Vignes', lots: 48 }],
  coproprietairesDebiteurs: [{ nom: 'M. Durand', solde: -9200, note: 'joignable au 06 12 34 56 78 ou durand@exemple.fr' }],
}

describe('/api/administrateur-judiciaire/agent', () => {
  beforeEach(() => {
    h.utilisateur = { id: 'u-aj', email: 'admin@exemple.fr', app_metadata: { role: 'super_admin' } }
    h.claude.mockClear()
  })

  it('refuse un visiteur non connecté ou sans rôle syndic', async () => {
    h.utilisateur = null
    expect((await POST(requete({ agent: 'fixy', message: 'Bonjour' }))).status).toBe(401)
    h.utilisateur = { id: 'u-x', email: 'client@exemple.fr', app_metadata: { role: 'client' } }
    expect((await POST(requete({ agent: 'fixy', message: 'Bonjour' }))).status).toBe(401)
    expect(h.claude).not.toHaveBeenCalled()
  })

  it('refuse un corps invalide (agent inconnu, message vide, historique trop long)', async () => {
    expect((await POST(requete({ agent: 'inconnu', message: 'x' }))).status).toBe(400)
    expect((await POST(requete({ agent: 'max', message: '   ' }))).status).toBe(400)
    const historique = Array.from({ length: 21 }, () => ({ role: 'user', content: 'q' }))
    expect((await POST(requete({ agent: 'max', message: 'q', historique }))).status).toBe(400)
  })

  it('construit le prompt avec les données de l’écran, masque les données personnelles et répond', async () => {
    const res = await POST(requete({
      agent: 'lea',
      message: 'Qui sont les débiteurs ?',
      historique: [{ role: 'user', content: 'Bonjour' }, { role: 'assistant', content: 'Bonjour !' }],
      contexte: CONTEXTE,
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'Réponse de Fixy', modele: 'claude-sonnet-5-5' })

    const [opts, config] = h.claude.mock.calls[0]
    const systeme = opts.messages[0]
    expect(systeme.role).toBe('system')
    expect(systeme.content).toContain('Léa — Comptable')
    expect(systeme.content).toContain('Le Clos des Vignes')
    expect(systeme.content).toContain('2026-06-04')
    expect(systeme.content).not.toContain('durand@exemple.fr')
    expect(systeme.content).not.toContain('06 12 34 56 78')
    expect(opts.messages.slice(1).map(m => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(opts.messages[3].content).toBe('Qui sont les débiteurs ?')
    expect(config).toEqual({ effort: 'low', cacheSysteme: true })
  })

  it('Alfredo rédige un courriel en texte simple, les autres agents en Markdown léger', async () => {
    await POST(requete({ agent: 'alfredo', message: 'Rédige une réponse', contexte: CONTEXTE }))
    await POST(requete({ agent: 'fixy', message: 'Point du jour', contexte: CONTEXTE }))
    const [alfredo, fixy] = h.claude.mock.calls.map(([opts]) => opts.messages[0].content)
    expect(alfredo).toContain('Alfredo — Courriers')
    expect(alfredo).toContain('sans Markdown')
    expect(fixy).toContain('Markdown léger')
  })

  it('Max réfléchit davantage (effort medium)', async () => {
    await POST(requete({ agent: 'max', message: 'Quelle majorité pour désigner le syndic ?', contexte: CONTEXTE }))
    expect(h.claude.mock.calls[0][1]).toEqual({ effort: 'medium', cacheSysteme: true })
  })

  it('rétablit dans la réponse une donnée masquée que le modèle a recopiée', async () => {
    h.claude.mockImplementationOnce(async (opts) => {
      const jeton = /<email:[0-9a-f]{8}>/.exec(opts.messages[0].content)?.[0] ?? ''
      return { choices: [{ message: { content: `Écrire à ${jeton}` } }], model: 'claude-sonnet-5-5' }
    })
    const res = await POST(requete({ agent: 'fixy', message: 'Comment joindre M. Durand ?', contexte: CONTEXTE }))
    expect((await res.json()).text).toBe('Écrire à durand@exemple.fr')
  })

  it('503 si aucune clé IA n’est configurée', async () => {
    h.getSecret.mockImplementation(async () => '')
    const res = await POST(requete({ agent: 'tempo', message: 'Échéances ?' }))
    expect(res.status).toBe(503)
    h.getSecret.mockImplementation(async (cle: string) => (cle === 'ANTHROPIC_API_KEY' ? 'cle-factice' : ''))
  })

  it('502 si l’appel IA échoue (le client affiche alors la réponse type)', async () => {
    h.claude.mockRejectedValueOnce(new Error('Claude 500'))
    const res = await POST(requete({ agent: 'fixy', message: 'Bonjour' }))
    expect(res.status).toBe(502)
  })
})
