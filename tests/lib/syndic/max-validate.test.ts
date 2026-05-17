// tests/lib/syndic/max-validate.test.ts
// ──────────────────────────────────────────────────────────────────────────────
// Tests unitaires de la validation post-génération de Max (garde-fous v1.1).
// Vérifie : JSON shape, citation vs chunks injectés, filtre TOC, fuite locale,
// auto-certification, format de sortie nettoyé.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { validateMaxResponse } from '@/lib/syndic/max-validate'
import type { ScoredLegalChunk } from '@/lib/syndic/max-legal-rag'

const fakeChunk = (overrides: Partial<ScoredLegalChunk> = {}): ScoredLegalChunk => ({
  id: 'chunk-1',
  source: 'Código Civil',
  article: '1424.º',
  title: 'Encargos de conservação e fruição',
  content:
    'As despesas necessárias à conservação e fruição das partes comuns do edifício são pagas pelos condóminos na proporção do valor das suas frações.',
  theme: 'despesas',
  parent_path: 'Parte B > Secção III > Artigo 1424.º',
  score: 0.9,
  rerankScore: 5,
  ...overrides,
})

const tocChunk = (): ScoredLegalChunk =>
  fakeChunk({
    id: 'chunk-toc',
    source: 'Índice',
    article: null,
    title: 'Índice da base de conhecimento',
    content: '- PARTE A — ENQUADRAMENTO\n- PARTE B — CÓDIGO CIVIL',
    parent_path: '__TOC__',
  })

const jsonResponse = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    answer: 'A repartição faz-se em proporção do valor das frações (artigo 1424.º).',
    citations: [
      {
        font_id: 'FONT-1',
        exact_quote:
          'As despesas necessárias à conservação e fruição das partes comuns do edifício são pagas pelos condóminos na proporção do valor das suas frações.',
        claim: 'Repartição proportionnelle des charges',
      },
    ],
    refusal: false,
    ...overrides,
  })

describe('validateMaxResponse — happy path', () => {
  it('accepte une réponse valide avec citation littérale', () => {
    const result = validateMaxResponse(jsonResponse(), [fakeChunk()], 'pt')
    expect(result.ok).toBe(true)
    expect(result.refusal).toBe(false)
    expect(result.citations).toHaveLength(1)
    expect(result.citations[0].quote_verified).toBe(true)
    expect(result.citations[0].chunk_id).toBe('chunk-1')
  })

  it('accepte un refusal explicite sans citations', () => {
    const raw = JSON.stringify({
      answer: 'Esta questão não está coberta pelo meu corpus jurídico atual.',
      citations: [],
      refusal: true,
    })
    const result = validateMaxResponse(raw, [fakeChunk()], 'pt')
    expect(result.ok).toBe(true)
    expect(result.refusal).toBe(true)
  })

  it('strip les marqueurs [FONT-X] du texte affiché', () => {
    const raw = JSON.stringify({
      answer: 'A repartição [FONT-1] faz-se em proporção (FONT-1).',
      citations: [
        {
          font_id: 'FONT-1',
          exact_quote:
            'As despesas necessárias à conservação e fruição das partes comuns do edifício são pagas pelos condóminos na proporção do valor das suas frações.',
          claim: 'Répartition',
        },
      ],
      refusal: false,
    })
    const result = validateMaxResponse(raw, [fakeChunk()], 'pt')
    expect(result.ok).toBe(true)
    expect(result.answer).not.toContain('[FONT-1]')
    expect(result.answer).not.toContain('FONT-1')
  })
})

describe('validateMaxResponse — defense en profondeur', () => {
  it('rejette JSON invalide', () => {
    const result = validateMaxResponse('not json', [fakeChunk()], 'pt')
    expect(result.ok).toBe(false)
    expect(result.reasons[0]).toContain('JSON parse failed')
  })

  it('exclut les chunks __TOC__ du fontMap (citation TOC impossible)', () => {
    const chunks = [tocChunk(), fakeChunk({ id: 'chunk-real' })]
    // FONT-1 doit pointer vers chunk-real, pas vers le TOC qui est filtré
    const raw = jsonResponse()
    const result = validateMaxResponse(raw, chunks, 'pt')
    expect(result.ok).toBe(true)
    expect(result.citations[0].chunk_id).toBe('chunk-real')
  })

  it('rejette une réponse longue sans aucune citation (hallucination suspecte)', () => {
    const raw = JSON.stringify({
      answer:
        'Uma resposta longa sem nenhuma citação que descreve um regime jurídico fictício e que deveria conter pelo menos uma referência aos artigos pertinentes do Código Civil ou do DL 268/94 para ser considerada legítima.',
      citations: [],
      refusal: false,
    })
    const result = validateMaxResponse(raw, [fakeChunk()], 'pt')
    expect(result.ok).toBe(false)
    expect(result.reasons.some((r) => r.includes('long answer without any citation'))).toBe(true)
  })

  it('rejette une citation pointant vers un font_id inexistant', () => {
    const raw = JSON.stringify({
      answer: 'Algo (artigo X).',
      citations: [
        {
          font_id: 'FONT-99',
          exact_quote: 'whatever',
          claim: 'Whatever',
        },
      ],
      refusal: false,
    })
    const result = validateMaxResponse(raw, [fakeChunk()], 'pt')
    // Citation ignorée mais réponse courte → la validation passe avec 0 citations
    // (sauf si la réponse est trop longue)
    expect(result.reasons.some((r) => r.includes('non-existent FONT-99'))).toBe(true)
  })

  it('flag quote_verified=false si la quote n\'est pas dans le chunk', () => {
    const raw = JSON.stringify({
      answer: 'Conteúdo inventado.',
      citations: [
        {
          font_id: 'FONT-1',
          exact_quote: 'Texte qui n\'existe absolument pas dans le contenu du chunk source.',
          claim: 'Claim quelconque',
        },
      ],
      refusal: false,
    })
    const result = validateMaxResponse(raw, [fakeChunk()], 'pt')
    expect(result.citations[0]?.quote_verified).toBe(false)
    expect(result.reasons.some((r) => r.includes('quote not literally'))).toBe(true)
  })

  it('rejette une fuite cross-locale PT → FR (SIRET, copropriété, Loi 65-557)', () => {
    const raw = JSON.stringify({
      answer:
        'En droit français de la copropriété (loi 65-557), il faut un SIRET et une garantie décennale pour la RC Pro du syndic.',
      citations: [],
      refusal: false,
    })
    // Petit chunk dummy pour atteindre la validation
    const result = validateMaxResponse(raw, [fakeChunk()], 'pt')
    expect(result.ok).toBe(false)
    expect(result.reasons.some((r) => r.includes('cross-locale leak'))).toBe(true)
  })

  it('rejette une auto-certification "[verificado]"', () => {
    const raw = jsonResponse({
      answer: 'A repartição faz-se em proporção [verificado].',
    })
    const result = validateMaxResponse(raw, [fakeChunk()], 'pt')
    expect(result.ok).toBe(false)
    expect(result.reasons.some((r) => r.includes('auto-certification'))).toBe(true)
  })

  it('rejette une auto-certification "citação verificada"', () => {
    const raw = jsonResponse({
      answer: 'A regra é clara (citação verificada).',
    })
    const result = validateMaxResponse(raw, [fakeChunk()], 'pt')
    expect(result.ok).toBe(false)
    expect(result.reasons.some((r) => r.includes('auto-certification'))).toBe(true)
  })

  it('rejette une auto-certification "fonte confirmada"', () => {
    const raw = jsonResponse({
      answer: 'Os condóminos pagam em proporção (fonte confirmada).',
    })
    const result = validateMaxResponse(raw, [fakeChunk()], 'pt')
    expect(result.ok).toBe(false)
    expect(result.reasons.some((r) => r.includes('auto-certification'))).toBe(true)
  })

  it('rejette une auto-certification "✅ citação"', () => {
    const raw = jsonResponse({
      answer: 'A regra é clara. ✅ citação',
    })
    const result = validateMaxResponse(raw, [fakeChunk()], 'pt')
    expect(result.ok).toBe(false)
    expect(result.reasons.some((r) => r.includes('auto-certification'))).toBe(true)
  })

  it('rejette une auto-certification "eu validei"', () => {
    const raw = jsonResponse({
      answer: 'Eu validei esta citação contra o Diário da República.',
    })
    const result = validateMaxResponse(raw, [fakeChunk()], 'pt')
    expect(result.ok).toBe(false)
    expect(result.reasons.some((r) => r.includes('auto-certification'))).toBe(true)
  })

  it('accepte la mention du selo ✅ DRE en référence à la base (sans auto-certification)', () => {
    // « ✅ DRE » est un selo de la base que Max peut reproduire quand il cite
    // un élément qui en porte un. Ce n'est pas une auto-certification.
    const raw = jsonResponse({
      answer: 'O artigo 1424.º porta o selo ✅ DRE no corpus de origem.',
    })
    const result = validateMaxResponse(raw, [fakeChunk()], 'pt')
    expect(result.ok).toBe(true)
  })
})
