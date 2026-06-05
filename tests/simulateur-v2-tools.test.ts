import { describe, it, expect } from 'vitest'
import { TOOL_SCHEMAS, executeTool } from '@/app/api/simulateur-travaux/tools'

describe('TOOL_SCHEMAS', () => {
  it('expose lookupVariants et computeQuote uniquement', () => {
    const names = TOOL_SCHEMAS.map(t => t.function.name)
    expect(names).toEqual(['lookupVariants', 'computeQuote'])
  })

  it('chaque schema a description et parameters', () => {
    for (const t of TOOL_SCHEMAS) {
      expect(t.function.description).toBeTruthy()
      expect(t.function.parameters).toBeTruthy()
    }
  })
})

describe('executeTool — lookupVariants', () => {
  it('retourne candidats valides', () => {
    const r = executeTool('lookupVariants', {
      description: 'peinture mur salon',
      metierHint: 'peinture',
    })
    expect(r.error).toBeUndefined()
    expect(Array.isArray(r.result)).toBe(true)
    expect((r.result as unknown[]).length).toBeGreaterThan(0)
  })

  it('args invalide (description absente) → error', () => {
    const r = executeTool('lookupVariants', { metierHint: 'peinture' })
    expect(r.error).toMatch(/description/i)
  })
})

describe('executeTool — computeQuote', () => {
  it('items vides → out-of-catalog', () => {
    const r = executeTool('computeQuote', {
      items: [],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })
    expect(r.error).toBeUndefined()
    expect((r.result as { mode: string }).mode).toBe('out-of-catalog')
  })

  it('items normaux → mode normal', () => {
    const r = executeTool('computeQuote', {
      items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 25 }],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })
    expect(r.error).toBeUndefined()
    expect((r.result as { mode: string }).mode).toBe('normal')
  })

  it('taskId inconnu → error', () => {
    const r = executeTool('computeQuote', {
      items: [{ taskId: 'inexistant', qty: 1 }],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })
    expect(r.error).toMatch(/unknown taskId/i)
  })

  it('args invalides (gamme manquant) → error', () => {
    const r = executeTool('computeQuote', {
      items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 25 }],
      region: 'PACA',
      etat: 'bon',
    })
    expect(r.error).toMatch(/gamme/i)
  })
})

describe('executeTool — tool inconnu', () => {
  it('renvoie error', () => {
    const r = executeTool('unknownTool', {})
    expect(r.error).toMatch(/unknown_tool/i)
  })
})
