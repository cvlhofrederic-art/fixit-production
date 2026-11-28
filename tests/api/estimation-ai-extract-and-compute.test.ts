// tests/api/estimation-ai-extract-and-compute.test.ts
//
// Route « Description libre » d'Estimation matériaux (description → extraction IA → calcul).
// Constat du 14/11/2026 en production : l'écran affichait « Cerebras 404: {"message":"Model does not exist…" ».
// La route ne rend plus aucun détail interne (fournisseur, modèle, erreur brute) : un message lisible, dans la
// langue du pays, et le détail dans les journaux (Sentry). Elle accepte de tourner dès qu'un des deux fournisseurs
// de l'extraction (Groq, ou Claude en relais) est configuré. Chaque appel coûtant un appel de modèle, elle est
// réservée aux comptes pro et plafonnée par compte en plus de l'adresse IP.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  utilisateur: { id: 'u-btp', app_metadata: { role: 'pro_societe' } } as Record<string, unknown> | null,
  extraire: vi.fn(),
  cleClaude: vi.fn(async () => false),
  limite: vi.fn<(cle: string, limite?: number, fenetreMs?: number) => Promise<boolean>>(async () => true),
  erreur: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: h.erreur } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: h.limite,
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.utilisateur),
}))
vi.mock('@/lib/claude', () => ({ hasAnthropicKey: h.cleClaude, callClaudeWithRetry: vi.fn() }))
vi.mock('@/lib/estimation-materiaux/ai/groq-extractor', async (orig) => ({
  ...(await orig<typeof import('@/lib/estimation-materiaux/ai/groq-extractor')>()),
  extractEstimationWithGroq: h.extraire,
}))

const { POST } = await import('@/app/api/estimation/ai-extract-and-compute/route')

const requete = (corps: unknown) =>
  new NextRequest('http://localhost/api/estimation/ai-extract-and-compute', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer jeton' },
    body: JSON.stringify(corps),
  })

const DEMANDE = { description: 'Dalle béton de 8 m x 5 m en 12 cm pour un garage', country: 'FR' }
const EXTRACTION = {
  items: [{ recipeId: 'dalle-ba-armee-st25c', geometry: { length: 8, width: 5, thickness: 0.12 }, label: 'Dalle garage' }],
  assumptions: [],
  questions: [],
}
const erreurDe = async (reponse: Response) => ((await reponse.json()) as { error?: string }).error ?? ''

describe('/api/estimation/ai-extract-and-compute', () => {
  const cleGroqInitiale = process.env.GROQ_API_KEY

  beforeEach(() => {
    h.utilisateur = { id: 'u-btp', app_metadata: { role: 'pro_societe' } }
    h.extraire.mockReset()
    h.extraire.mockResolvedValue(structuredClone(EXTRACTION))
    h.cleClaude.mockReset()
    h.cleClaude.mockResolvedValue(false)
    h.limite.mockReset()
    h.limite.mockResolvedValue(true)
    h.erreur.mockClear()
    process.env.GROQ_API_KEY = 'cle-groq-factice'
  })

  afterEach(() => {
    if (cleGroqInitiale === undefined) delete process.env.GROQ_API_KEY
    else process.env.GROQ_API_KEY = cleGroqInitiale
  })

  it('refuse un visiteur non connecté et un corps invalide', async () => {
    h.utilisateur = null
    expect((await POST(requete(DEMANDE))).status).toBe(401)
    h.utilisateur = { id: 'u-btp', app_metadata: { role: 'pro_societe' } }
    expect((await POST(requete({ description: 'abc' }))).status).toBe(400)
    expect(h.extraire).not.toHaveBeenCalled()
  })

  it('réserve l’analyse aux comptes pro : client, syndic ou rôle posé côté navigateur reçoivent 403', async () => {
    for (const utilisateur of [
      { id: 'u-client', app_metadata: {} },
      { id: 'u-client', app_metadata: { role: 'client' } },
      { id: 'u-syndic', app_metadata: { role: 'syndic' } },
      // Le tableau de bord des conciergeries n'a pas d'écran d'Estimation.
      { id: 'u-conciergerie', app_metadata: { role: 'pro_conciergerie' } },
      // user_metadata est modifiable par le client (supabase.auth.updateUser) : jamais lu pour le rôle.
      { id: 'u-forge', app_metadata: {}, user_metadata: { role: 'artisan' } },
    ]) {
      h.utilisateur = utilisateur
      const reponse = await POST(requete(DEMANDE))
      expect(reponse.status).toBe(403)
      expect(await erreurDe(reponse)).toBe('Accès refusé')
    }
    expect(h.extraire).not.toHaveBeenCalled()
  })

  it('accepte les comptes artisan, BTP et super admin', async () => {
    for (const role of ['artisan', 'pro_societe', 'super_admin']) {
      h.utilisateur = { id: `u-${role}`, app_metadata: { role } }
      expect((await POST(requete(DEMANDE))).status).toBe(200)
    }
    expect(h.extraire).toHaveBeenCalledTimes(3)
  })

  it('plafonne chaque compte à 30 analyses par heure, en plus de la limite par adresse IP', async () => {
    expect((await POST(requete(DEMANDE))).status).toBe(200)
    expect(h.limite).toHaveBeenCalledWith('estim_ai_127.0.0.1', 10, 60_000)
    expect(h.limite).toHaveBeenCalledWith('estim_ai_user_u-btp', 30, 3_600_000)

    // Plafond du compte atteint (celui de l'adresse IP ne l'est pas) : refus lisible, aucun appel de modèle.
    h.limite.mockImplementation(async (cle) => !cle.startsWith('estim_ai_user_'))
    h.extraire.mockClear()
    const refus = await POST(requete({ ...DEMANDE, country: 'PT' }))
    expect(refus.status).toBe(429)
    expect(await erreurDe(refus)).toBe('Demasiadas análises por IA numa hora. Tente mais tarde ou use o modo Formulário.')
    expect(await erreurDe(await POST(requete(DEMANDE)))).toBe('Trop d’analyses par IA en une heure. Réessayez plus tard ou utilisez le mode Formulaire.')
    expect(h.extraire).not.toHaveBeenCalled()
  })

  it('extrait puis calcule les matériaux', async () => {
    const reponse = await POST(requete(DEMANDE))
    expect(reponse.status).toBe(200)
    const corps = (await reponse.json()) as { extraction: typeof EXTRACTION; result: { materials?: unknown[] } | null }
    expect(corps.extraction.items[0].recipeId).toBe('dalle-ba-armee-st25c')
    expect(corps.result).not.toBeNull()
    expect(h.extraire).toHaveBeenCalledWith(DEMANDE.description, undefined, { country: 'FR', trades: undefined })
  })

  it('n’affiche plus l’erreur brute du fournisseur : message lisible, détail dans les journaux', async () => {
    const brute = 'Cerebras 404: {"message":"Model does not exist or you do not have access to it.","type":"not_found_error"}'
    h.extraire.mockRejectedValueOnce(new Error(brute))
    const reponse = await POST(requete(DEMANDE))
    expect(reponse.status).toBe(500)
    const message = await erreurDe(reponse)
    expect(message).toBe('L’IA n’a pas pu analyser cette description. Réessayez dans un instant ou utilisez le mode Formulaire.')
    expect(message).not.toMatch(/cerebras|groq|claude|model|404|not_found/i)
    // L'erreur en troisième argument : c'est ce que lib/logger envoie à Sentry (en deuxième, elle restait en console).
    expect(h.erreur).toHaveBeenCalledWith('ai-extract-and-compute failed', { module: 'estimation-materiaux' }, expect.objectContaining({ message: brute }))
  })

  it('répond en portugais à un compte portugais', async () => {
    h.extraire.mockRejectedValueOnce(new Error('Groq 404: model_decommissioned'))
    const message = await erreurDe(await POST(requete({ ...DEMANDE, country: 'PT' })))
    expect(message).toBe('A IA não conseguiu analisar esta descrição. Tente novamente dentro de instantes ou use o modo Formulário.')
  })

  it('tourne avec un seul des deux fournisseurs, et dit « indisponible » sans nommer de clé s’il n’y en a aucun', async () => {
    delete process.env.GROQ_API_KEY
    const aucun = await POST(requete(DEMANDE))
    expect(aucun.status).toBe(503)
    const message = await erreurDe(aucun)
    expect(message).toBe('L’analyse par IA est indisponible pour le moment. Utilisez le mode Formulaire ou réessayez plus tard.')
    expect(message).not.toMatch(/GROQ|API_KEY|ANTHROPIC/)
    expect(await erreurDe(await POST(requete({ ...DEMANDE, country: 'PT' })))).toBe(
      'A análise por IA está indisponível de momento. Use o modo Formulário ou tente mais tarde.',
    )
    expect(h.extraire).not.toHaveBeenCalled()

    // Claude seul suffit : l'extraction lui passe le relais (lib/estimation-materiaux/ai/groq-extractor).
    h.cleClaude.mockResolvedValue(true)
    expect((await POST(requete(DEMANDE))).status).toBe(200)
    expect(h.extraire).toHaveBeenCalledTimes(1)
  })
})
