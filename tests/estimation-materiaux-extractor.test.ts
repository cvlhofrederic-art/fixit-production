/**
 * Tests Vitest — Extracteur IA (Groq) : normalisation pré-Zod et safety filters
 *
 * Couvre :
 *  - Normalisation des valeurs numériques malformées (strings, virgules FR, 0, null)
 *  - Rejet des recipeId inconnus et hors scope (trades/country)
 *  - Détection de troncation (finish_reason === 'length')
 *  - Post-validation : questions de relance sur dimensions critiques manquantes
 *  - Robustesse face à JSON malformé (fallback gracieux sans crash)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Groq AVANT import extractor (hoisted)
vi.mock('@/lib/groq', () => ({
  callGroqWithRetry: vi.fn(),
}))

import { callGroqWithRetry } from '@/lib/groq'
import { extractEstimationWithGroq } from '@/lib/estimation-materiaux/ai/groq-extractor'

const mockedGroq = vi.mocked(callGroqWithRetry)

function mockGroqResponse(content: unknown, finishReason: string = 'stop') {
  mockedGroq.mockResolvedValueOnce({
    choices: [{
      message: { content: typeof content === 'string' ? content : JSON.stringify(content) },
      finish_reason: finishReason,
    }],
  })
}

beforeEach(() => {
  mockedGroq.mockReset()
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
