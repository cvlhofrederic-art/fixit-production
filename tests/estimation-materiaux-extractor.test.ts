/**
 * Tests Vitest — Extracteur IA (Groq) : normalisation pré-Zod et safety filters
 *
 * Couvre :
 *  - Normalisation des valeurs numériques malformées (strings, virgules FR, 0, null)
 *  - Rejet des recipeId inconnus et hors scope (trades/country)
 *  - Détection de troncation (finish_reason === 'length')
 *  - Post-validation : questions de relance sur dimensions critiques manquantes
 *  - Robustesse face à JSON malformé (fallback gracieux sans crash)
 *  - Modèle Groq, relais par Claude et signalement des échecs durables à Sentry
 *  - Réponse de Groq inutilisable (vide, coupée, illisible) reprise par Claude
 *  - Réponse refusée par le schéma : rien de technique à l'écran
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Groq AVANT import extractor (hoisted)
vi.mock('@/lib/groq', () => ({
  callGroqWithRetry: vi.fn(),
}))
// Relais Claude : absent par défaut (pas de clé), comme dans un environnement sans ANTHROPIC_API_KEY.
vi.mock('@/lib/claude', () => ({
  callClaudeWithRetry: vi.fn(),
  hasAnthropicKey: vi.fn(async () => false),
}))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { callGroqWithRetry } from '@/lib/groq'
import { callClaudeWithRetry, hasAnthropicKey } from '@/lib/claude'
import { logger } from '@/lib/logger'
import { MODELE_EXTRACTION_GROQ, extractEstimationWithGroq } from '@/lib/estimation-materiaux/ai/groq-extractor'

const mockedGroq = vi.mocked(callGroqWithRetry)
const mockedClaude = vi.mocked(callClaudeWithRetry)
const mockedCleClaude = vi.mocked(hasAnthropicKey)

function mockGroqResponse(content: unknown, finishReason: string = 'stop') {
  mockedGroq.mockResolvedValueOnce({
    choices: [{
      message: { content: typeof content === 'string' ? content : JSON.stringify(content) },
      finish_reason: finishReason,
    }],
  })
}

// Réponse type d'un chantier simple, et sa forme une fois extraite.
const REPONSE_DALLE = { items: [{ recipeId: 'dalle-ba-armee-st25c', geometry: { area: 40, thickness: 0.12 } }], assumptions: [], questions: [] }
const ITEMS_DALLE = [{ recipeId: 'dalle-ba-armee-st25c', geometry: { area: 40, thickness: 0.12 }, label: undefined }]
const reponseClaude = (contenu: unknown) => ({
  choices: [{ message: { content: JSON.stringify(contenu) }, finish_reason: 'stop' }],
  model: 'claude-sonnet-5-5',
})

beforeEach(() => {
  mockedGroq.mockReset()
  mockedClaude.mockReset()
  mockedCleClaude.mockReset()
  mockedCleClaude.mockResolvedValue(false)
  vi.mocked(logger.warn).mockClear()
  vi.mocked(logger.error).mockClear()
})

// ════════════════════════════════════════════════════════════
//  1. NORMALISATION PRE-ZOD — tolérance LLM imparfait
// ════════════════════════════════════════════════════════════

describe('Extractor — normalisation pré-Zod', () => {

  it('champs numériques à 0 → omis (évite crash Zod positive)', async () => {
    mockGroqResponse({
      items: [{
        recipeId: 'dalle-ba-armee-st25c',
        geometry: { length: 0, width: 0, area: 50, thickness: 0.12 },
      }],
      assumptions: [], questions: [],
    })
    const result = await extractEstimationWithGroq('Dalle 50m² 12cm')
    expect(result.items.length).toBe(1)
    expect(result.items[0].geometry.length).toBeUndefined()
    expect(result.items[0].geometry.width).toBeUndefined()
    expect(result.items[0].geometry.area).toBe(50)
    expect(result.items[0].geometry.thickness).toBe(0.12)
  })

  it('strings numériques ("50", "12") → converties en number', async () => {
    mockGroqResponse({
      items: [{
        recipeId: 'dalle-ba-armee-st25c',
        geometry: { area: '50', thickness: '0.12' },
      }],
      assumptions: [], questions: [],
    })
    const result = await extractEstimationWithGroq('Dalle')
    expect(result.items[0].geometry.area).toBe(50)
    expect(result.items[0].geometry.thickness).toBe(0.12)
  })

  it('virgule FR ("50,5") → 50.5', async () => {
    mockGroqResponse({
      items: [{
        recipeId: 'dalle-ba-armee-st25c',
        geometry: { area: '50,5', thickness: '0,12' },
      }],
      assumptions: [], questions: [],
    })
    const result = await extractEstimationWithGroq('Dalle')
    expect(result.items[0].geometry.area).toBe(50.5)
    expect(result.items[0].geometry.thickness).toBe(0.12)
  })

  it('null geometry → objet vide (pas de crash)', async () => {
    mockGroqResponse({
      items: [{ recipeId: 'dalle-ba-armee-st25c', geometry: null }],
      assumptions: [], questions: [],
    })
    const result = await extractEstimationWithGroq('test')
    expect(result.items[0].geometry).toEqual({})
  })

  it('items absent → array vide (pas de crash)', async () => {
    mockGroqResponse({ assumptions: [], questions: [] })
    const result = await extractEstimationWithGroq('trop vague')
    expect(result.items).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════
//  2. SAFETY FILTERS — recipeId inconnus et scope
// ════════════════════════════════════════════════════════════

describe('Extractor — safety filters', () => {

  it('recipeId inconnu → filtré + assumption ajoutée', async () => {
    mockGroqResponse({
      items: [
        { recipeId: 'recette-fake-123', geometry: { area: 10 } },
        { recipeId: 'dalle-ba-armee-st25c', geometry: { area: 20, thickness: 0.12 } },
      ],
      assumptions: [], questions: [],
    })
    const result = await extractEstimationWithGroq('test')
    expect(result.items.length).toBe(1)
    expect(result.items[0].recipeId).toBe('dalle-ba-armee-st25c')
    expect(result.assumptions.some(a => /recette-fake-123/.test(a))).toBe(true)
  })

  it('scope trade restreint → rejette recettes hors périmètre', async () => {
    mockGroqResponse({
      items: [
        { recipeId: 'dalle-ba-armee-st25c', geometry: { area: 20, thickness: 0.12 } },
        { recipeId: 'peinture-murs-neuf-acryl', geometry: { length: 5, height: 2.5, openings: 0 } },
      ],
      assumptions: [], questions: [],
    })
    const result = await extractEstimationWithGroq('test', undefined, { trades: ['peinture'] })
    expect(result.items.length).toBe(1)
    expect(result.items[0].recipeId).toBe('peinture-murs-neuf-acryl')
    expect(result.assumptions.some(a => /hors p[ée]rim[èe]tre/i.test(a))).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════
//  3. TRONCATION — finish_reason === 'length'
// ════════════════════════════════════════════════════════════

describe('Extractor — détection troncation', () => {

  it('finish_reason=length → assumption warning tronquée', async () => {
    mockGroqResponse(
      {
        items: [{ recipeId: 'dalle-ba-armee-st25c', geometry: { area: 20, thickness: 0.12 } }],
        assumptions: [], questions: [],
      },
      'length', // ← tronqué
    )
    const result = await extractEstimationWithGroq('test')
    expect(result.assumptions.some(a => /tronqu/i.test(a))).toBe(true)
  })

  it('finish_reason=stop → pas de warning troncation', async () => {
    mockGroqResponse(
      {
        items: [{ recipeId: 'dalle-ba-armee-st25c', geometry: { area: 20, thickness: 0.12 } }],
        assumptions: [], questions: [],
      },
      'stop',
    )
    const result = await extractEstimationWithGroq('test')
    expect(result.assumptions.some(a => /tronqu/i.test(a))).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════
//  4. POST-VALIDATION — questions de relance
// ════════════════════════════════════════════════════════════

describe('Extractor — post-validation dimensions manquantes', () => {

  it('recette nécessite thickness mais absent → question de relance', async () => {
    mockGroqResponse({
      items: [{ recipeId: 'dalle-ba-armee-st25c', geometry: { area: 20 } }], // pas thickness
      assumptions: [], questions: [],
    })
    const result = await extractEstimationWithGroq('test')
    expect(result.questions.some(q => /[ée]paisseur/i.test(q))).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════
//  5. JSON MALFORMÉ — fallback gracieux
// ════════════════════════════════════════════════════════════

describe('Extractor — JSON malformé', () => {

  it('JSON invalide → throw avec message clair', async () => {
    mockedGroq.mockResolvedValueOnce({
      choices: [{ message: { content: 'ceci n\'est pas du JSON' }, finish_reason: 'stop' }],
    })
    await expect(extractEstimationWithGroq('test')).rejects.toThrow(/JSON invalide/)
  })

  it('structure totalement vide → fallback propre (items:[], questions utiles)', async () => {
    mockGroqResponse({})
    const result = await extractEstimationWithGroq('trop vague')
    expect(result.items).toEqual([])
    expect(Array.isArray(result.assumptions)).toBe(true)
    expect(Array.isArray(result.questions)).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════
//  6. MODÈLE ET RELAIS — l'extraction ne dépend plus d'un modèle retiré ni d'un seul fournisseur
// ════════════════════════════════════════════════════════════
// Constat du 14/11/2026 en production : « Cerebras 404: Model does not exist ». Groq avait retiré
// llama-3.3-70b-versatile le 16/08/2026 (offres gratuite et développeur) et le secours Cerebras pointait
// sur un modèle disparu lui aussi.

describe('Extractor — modèle et relais entre fournisseurs', () => {
  it('appelle le modèle de remplacement recommandé par Groq, sans repli sur un autre modèle', async () => {
    mockGroqResponse(REPONSE_DALLE)
    await extractEstimationWithGroq('Dalle 40 m² en 12 cm', 'cle-groq')
    expect(MODELE_EXTRACTION_GROQ).toBe('openai/gpt-oss-120b')
    const [opts, config] = mockedGroq.mock.calls[0]
    expect(opts.model).toBe('openai/gpt-oss-120b')
    expect(opts.response_format).toEqual({ type: 'json_object' })
    expect(opts.max_tokens).toBe(8000)
    // Pas de secours Cerebras : son modèle a disparu (c'est lui qui répondait « Cerebras 404 » en production).
    // Sans Claude pour reprendre, Groq garde ses quatre tentatives sur 429.
    expect(config).toEqual({ apiKey: 'cle-groq', fallbackModel: 'openai/gpt-oss-120b', maxRetries: 3, disableCerebrasFallback: true })
    expect(mockedClaude).not.toHaveBeenCalled()
  })

  it('avec Claude en relais, Groq ne réessaie qu’une fois sur 429 avant de basculer', async () => {
    mockedCleClaude.mockResolvedValue(true)
    mockGroqResponse(REPONSE_DALLE)
    expect((await extractEstimationWithGroq('Dalle 40 m² en 12 cm', 'cle-groq')).items).toEqual(ITEMS_DALLE)
    // lib/groq attend jusqu'à 10 s avant chaque nouvel essai : 4 tentatives, c'était jusqu'à 40 s d'attente.
    expect(mockedGroq.mock.calls[0][1]).toEqual({ apiKey: 'cle-groq', fallbackModel: 'openai/gpt-oss-120b', maxRetries: 1, disableCerebrasFallback: true })
    // Réponse exploitable : pas de relais, pas de signalement.
    expect(mockedClaude).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('ne cite plus aucun modèle retiré', () => {
    const source = readFileSync(join(process.cwd(), 'lib/estimation-materiaux/ai/groq-extractor.ts'), 'utf8')
    const appels = source.split('\n').filter((ligne) => !ligne.trim().startsWith('*') && !ligne.trim().startsWith('//'))
    expect(appels.join('\n')).not.toMatch(/llama-3\.[13]/)
  })

  it('passe le relais à Claude, avec la même demande, quand Groq échoue', async () => {
    mockedGroq.mockRejectedValueOnce(new Error('Groq 503: Service Unavailable'))
    mockedCleClaude.mockResolvedValue(true)
    mockedClaude.mockResolvedValueOnce(reponseClaude(REPONSE_DALLE))

    const result = await extractEstimationWithGroq('Dalle 40 m² en 12 cm', undefined, { country: 'FR' })
    expect(result.items).toEqual(ITEMS_DALLE)

    const [optsGroq] = mockedGroq.mock.calls[0]
    const [optsClaude, configClaude] = mockedClaude.mock.calls[0]
    expect(optsClaude.messages).toEqual(optsGroq.messages)
    expect(optsClaude.messages[1]).toEqual({ role: 'user', content: 'Dalle 40 m² en 12 cm' })
    expect(optsClaude.response_format).toEqual({ type: 'json_object' })
    // Pas de retour vers Groq depuis Claude : il vient d'échouer.
    expect(configClaude).toEqual({ effort: 'low', cacheSysteme: true, disableGroqFallback: true })
  })

  // Formes exactes des erreurs de lib/groq.ts : « Groq <statut>: … » sur une réponse HTTP en erreur, « All Groq API
  // attempts failed » après des 429 répétés, l'erreur de fetch telle quelle (délai, réseau), clé absente.
  it.each([
    { cas: 'clé refusée', erreur: new Error('Groq 401: {"error":{"message":"Invalid API Key"}}'), statut: 401 },
    { cas: 'accès refusé', erreur: new Error('Groq 403: {"error":{"message":"Forbidden"}}'), statut: 403 },
    { cas: 'modèle retiré', erreur: new Error('Groq 404: {"error":{"message":"The model does not exist"}}'), statut: 404 },
    { cas: 'requête trop grosse', erreur: new Error('Groq 413: {"error":{"message":"Request too large: tokens per minute"}}'), statut: 413 },
    { cas: 'clé absente', erreur: new Error('GROQ_API_KEY not configured'), statut: undefined },
  ])('échec durable de Groq ($cas) : relais par Claude et signalement à Sentry', async ({ erreur, statut }) => {
    mockedGroq.mockRejectedValueOnce(erreur)
    mockedCleClaude.mockResolvedValue(true)
    mockedClaude.mockResolvedValueOnce(reponseClaude(REPONSE_DALLE))

    expect((await extractEstimationWithGroq('Dalle 40 m² en 12 cm')).items).toEqual(ITEMS_DALLE)
    // logger.error avec l'objet d'erreur en troisième argument : c'est ce qui part dans Sentry (lib/logger).
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('relais par Claude'),
      statut === undefined ? { module: 'estimation-materiaux' } : { module: 'estimation-materiaux', statut },
      erreur,
    )
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it.each([
    { cas: '429 répétés', erreur: new Error('All Groq API attempts failed') },
    { cas: 'erreur 500', erreur: new Error('Groq 500: Internal Server Error') },
    { cas: 'erreur 503', erreur: new Error('Groq 503: Service Unavailable') },
    { cas: 'délai dépassé', erreur: Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }) },
    { cas: 'réseau', erreur: new TypeError('fetch failed') },
  ])('surcharge passagère de Groq ($cas) : relais par Claude, simple avertissement', async ({ erreur }) => {
    mockedGroq.mockRejectedValueOnce(erreur)
    mockedCleClaude.mockResolvedValue(true)
    mockedClaude.mockResolvedValueOnce(reponseClaude(REPONSE_DALLE))

    expect((await extractEstimationWithGroq('Dalle 40 m² en 12 cm')).items).toEqual(ITEMS_DALLE)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('relais par Claude'), { erreur: erreur.message })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('sans Claude configuré, l’échec de Groq remonte tel quel (la route le journalise)', async () => {
    mockedGroq.mockRejectedValueOnce(new Error('Groq 404: model_decommissioned'))
    await expect(extractEstimationWithGroq('Dalle')).rejects.toThrow('Groq 404: model_decommissioned')
    expect(mockedClaude).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('si Claude échoue aussi, son erreur remonte', async () => {
    mockedGroq.mockRejectedValueOnce(new Error('Groq 404'))
    mockedCleClaude.mockResolvedValue(true)
    mockedClaude.mockRejectedValueOnce(new Error('Claude 529: overloaded'))
    await expect(extractEstimationWithGroq('Dalle')).rejects.toThrow('Claude 529: overloaded')
  })
})

// ════════════════════════════════════════════════════════════
//  7. RÉPONSE DE GROQ INUTILISABLE — Claude reprend au lieu d'une erreur 500
// ════════════════════════════════════════════════════════════
// gpt-oss raisonne avant de répondre et ce raisonnement compte dans max_tokens : quand il épuise le budget, Groq
// répond 200 avec un contenu vide ou coupé (finish_reason 'length'). Sans relais, l'extraction échouait plus loin.

describe('Extractor — réponse de Groq inutilisable', () => {
  it.each([
    { cas: 'budget épuisé à raisonner', contenu: '', fin: 'length', motif: 'budget de jetons épuisé' },
    { cas: 'JSON coupé', contenu: '{"items":[{"recipeId":"dalle-ba-armee-st25c","geometry":{"area":4', fin: 'length', motif: 'budget de jetons épuisé' },
    { cas: 'contenu vide', contenu: '  ', fin: 'stop', motif: 'contenu vide' },
    { cas: 'texte au lieu de JSON', contenu: 'Voici les matériaux de votre dalle.', fin: 'stop', motif: 'JSON illisible' },
    { cas: 'JSON sans objet', contenu: '["dalle"]', fin: 'stop', motif: 'JSON sans objet' },
  ])('$cas : Claude reprend la même demande, l’échec part dans Sentry', async ({ contenu, fin, motif }) => {
    mockGroqResponse(contenu, fin)
    mockedCleClaude.mockResolvedValue(true)
    mockedClaude.mockResolvedValueOnce(reponseClaude(REPONSE_DALLE))

    const result = await extractEstimationWithGroq('Dalle 40 m² en 12 cm')
    expect(result.items).toEqual(ITEMS_DALLE)
    expect(result.assumptions.some(a => /tronqu/i.test(a))).toBe(false)
    expect(mockedClaude.mock.calls[0][0].messages).toEqual(mockedGroq.mock.calls[0][0].messages)
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('relais par Claude'),
      { module: 'estimation-materiaux' },
      expect.objectContaining({ name: 'ReponseGroqInutilisable', message: expect.stringContaining(motif) }),
    )
  })

  it('sans Claude configuré, la réponse de Groq est traitée comme avant', async () => {
    mockGroqResponse('', 'length')
    await expect(extractEstimationWithGroq('Dalle')).rejects.toThrow(/renvoyé de contenu/)
    expect(mockedClaude).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════
//  8. RÉPONSE REFUSÉE PAR LE SCHÉMA — rien de technique à l'écran
// ════════════════════════════════════════════════════════════

describe('Extractor — réponse refusée par le schéma', () => {
  // Passe la normalisation, mais Zod la refuse : profil de chantier hors des valeurs admises.
  const REFUSEE = { ...REPONSE_DALLE, chantierProfile: { difficulty: 'extreme' } }

  it.each([
    { pays: 'FR' as const, phrase: "L'IA a retourné une réponse malformée." },
    { pays: 'PT' as const, phrase: 'A IA devolveu uma resposta malformada.' },
  ])('$pays : phrase lisible pour l’artisan, détail de Zod dans les journaux', async ({ pays, phrase }) => {
    mockGroqResponse(REFUSEE)
    const result = await extractEstimationWithGroq('Dalle 40 m² en 12 cm', undefined, { country: pays })
    expect(result.items).toEqual([])
    expect(result.assumptions[0]).toBe(phrase)
    // Avant : « (détail : [{"code":"invalid_value",…}]) » s'affichait tel quel à l'artisan.
    expect(result.assumptions.join(' ')).not.toMatch(/détail|detalhe|invalid|expected|difficulty|[[\]{}]/)
    expect(result.questions.length).toBeGreaterThan(0)
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('schéma'),
      expect.objectContaining({ module: 'estimation-materiaux' }),
      expect.objectContaining({ message: expect.stringContaining('difficulty') }),
    )
  })
})
