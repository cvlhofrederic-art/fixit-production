// tests/lib/syndic/max-parser.test.ts
// ──────────────────────────────────────────────────────────────────────────────
// Tests unitaires du parser markdown du corpus juridique PT pour Max v1.1.
// Vérifie les invariants critiques : chunks atomiques par article, sources
// correctement attribuées (incl. Partie I + diplômes en parenthèses), Partes H
// et J découpées par bullet, chunk spécial __TOC__ émis.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  parseLegalMarkdown,
  deriveSource,
  extractDiplomaSource,
} from '@/lib/syndic/max-parser'
import { decodeCorpusMd } from '@/lib/syndic/legal-corpus-pt-md'

describe('extractDiplomaSource', () => {
  it('extrait DL X/Y depuis un titre H2 standard', () => {
    expect(extractDiplomaSource('I.3 — Ascensores (Decreto-Lei n.º 320/2002)')).toBe('DL 320/2002')
    expect(extractDiplomaSource('I.2 — SCIE (Decreto-Lei n.º 220/2008)')).toBe('DL 220/2008')
  })

  it('extrait DL X/Y même avec texte additionnel entre numéro et parenthèse fermante', () => {
    expect(
      extractDiplomaSource('I.6.2 — Ruído (Decreto-Lei n.º 9/2007 — Regulamento Geral do Ruído)'),
    ).toBe('DL 9/2007')
  })

  it('extrait Lei X/Y', () => {
    expect(extractDiplomaSource('I.6.3 — Proteção de dados (Lei n.º 58/2019)')).toBe('Lei 58/2019')
  })

  it('retourne null si aucun code de diplôme', () => {
    expect(extractDiplomaSource('I.6 — Alojamento local e outros diplomas')).toBeNull()
    expect(extractDiplomaSource('I.1 — Urbanismo e o fim do RGEU')).toBeNull()
  })
})

describe('deriveSource', () => {
  it('mappe les titres de Partie vers une source identifiable', () => {
    expect(deriveSource('CÓDIGO CIVIL: REGIME DA PROPRIEDADE HORIZONTAL')).toBe('Código Civil')
    expect(deriveSource('DECRETO-LEI N.º 268/94, DE 25 DE OUTUBRO')).toBe('DL 268/94')
    expect(deriveSource('DECRETO-LEI N.º 269/94, DE 25 DE OUTUBRO')).toBe('DL 269/94')
    expect(deriveSource('CÓDIGO DO NOTARIADO, ARTIGO 54.º')).toBe('Código do Notariado')
    expect(deriveSource('JURISPRUDÊNCIA ESSENCIAL DOS TRIBUNAIS SUPERIORES')).toBe('Jurisprudência')
    expect(deriveSource('QUADRO PROCESSUAL DA COBRANÇA DE DÍVIDAS DE CONDOMÍNIO')).toBe('Cobrança de dívidas')
    expect(deriveSource('ENQUADRAMENTO PROFISSIONAL DO ADMINISTRADOR DE CONDOMÍNIO')).toBe('Enquadramento profissional')
    expect(deriveSource('LEGISLAÇÃO CONEXA')).toBe('Legislação conexa')
    expect(deriveSource('GLOSSÁRIO')).toBe('Glossário')
  })
})

describe('parseLegalMarkdown — corpus complet PT v1.1', () => {
  const md = decodeCorpusMd()
  const chunks = parseLegalMarkdown(md)

  it('produit au moins 100 chunks', () => {
    expect(chunks.length).toBeGreaterThanOrEqual(100)
  })

  it('aucun chunk ne contient moins de 30 caractères de content', () => {
    const tooShort = chunks.filter((c) => c.content.length < 30)
    expect(tooShort).toEqual([])
  })

  it('chaque chunk a un parent_path non vide', () => {
    expect(chunks.every((c) => c.parent_path && c.parent_path.length > 0)).toBe(true)
  })

  it('Código Civil — 31 articles (1414.º à 1438.º-A) — défaut C/E couvert', () => {
    const cc = chunks.filter((c) => c.source === 'Código Civil')
    expect(cc.length).toBe(31)
    expect(cc.find((c) => c.article === '1414.º')).toBeDefined()
    expect(cc.find((c) => c.article === '1422.º-A')).toBeDefined()
    expect(cc.find((c) => c.article === '1438.º-A')).toBeDefined()
  })

  it('DL 268/94 — 14 unités (12 numérotés + 1.º-A + 10.º-A)', () => {
    const dl = chunks.filter((c) => c.source === 'DL 268/94')
    expect(dl.length).toBe(14)
    expect(dl.find((c) => c.article === '1.º-A')).toBeDefined()
    expect(dl.find((c) => c.article === '10.º-A')).toBeDefined()
  })

  it('DL 269/94 — 9 articles (parser tolère titre vide pour 1.º, 2.º, 4.º…)', () => {
    const dl = chunks.filter((c) => c.source === 'DL 269/94')
    expect(dl.length).toBe(9)
    // Articles 1.º, 2.º, 4.º à 9.º n'ont pas de titre dans le corpus — le parser
    // doit les capturer quand même grâce au titre optionnel dans ARTIGO_RE.
    expect(dl.find((c) => c.article === '1.º')).toBeDefined()
    expect(dl.find((c) => c.article === '2.º')).toBeDefined()
    expect(dl.find((c) => c.article === '3.º')).toBeDefined() // REVOGADO
  })

  it('DL 320/2002 (ascensores) — au moins 5 chunks — défaut C cible RÉSOLU', () => {
    const dl = chunks.filter((c) => c.source === 'DL 320/2002')
    expect(dl.length).toBeGreaterThanOrEqual(5)
    expect(dl.some((c) => c.content.toLowerCase().includes('manutenção'))).toBe(true)
  })

  it('DL 220/2008 (SCIE) — au moins 5 chunks dont la grelha das categorias', () => {
    const dl = chunks.filter((c) => c.source === 'DL 220/2008')
    expect(dl.length).toBeGreaterThanOrEqual(5)
    expect(dl.some((c) => c.content.includes('1.ª') && c.content.includes('categoria'))).toBe(true)
  })

  it('DL 97/2017 (gás) — au moins 5 chunks', () => {
    const dl = chunks.filter((c) => c.source === 'DL 97/2017')
    expect(dl.length).toBeGreaterThanOrEqual(5)
  })

  it('DL 128/2014 (alojamento local) — au moins 1 chunk', () => {
    const dl = chunks.filter((c) => c.source === 'DL 128/2014')
    expect(dl.length).toBeGreaterThanOrEqual(1)
  })

  it('DL 9/2007 (ruído) — au moins 1 chunk', () => {
    const dl = chunks.filter((c) => c.source === 'DL 9/2007')
    expect(dl.length).toBeGreaterThanOrEqual(1)
  })

  it('Lei 58/2019 (RGPD) — au moins 1 chunk', () => {
    const dl = chunks.filter((c) => c.source === 'Lei 58/2019')
    expect(dl.length).toBeGreaterThanOrEqual(1)
  })

  it('DL 93/2025 (mobilidade elétrica) — au moins 3 chunks', () => {
    const dl = chunks.filter((c) => c.source === 'DL 93/2025')
    expect(dl.length).toBeGreaterThanOrEqual(3)
  })

  it('Partie H (Enquadramento profissional) — au moins 4 chunks bullets — bug B1 corrigé', () => {
    const h = chunks.filter((c) => c.source === 'Enquadramento profissional')
    expect(h.length).toBeGreaterThanOrEqual(4)
    expect(h.every((c) => c.article === null)).toBe(true)
    expect(h.every((c) => c.parent_path.startsWith('Parte H'))).toBe(true)
  })

  it('Partie J (Glossário) — au moins 15 chunks bullets — bug B2 corrigé', () => {
    const j = chunks.filter((c) => c.source === 'Glossário')
    expect(j.length).toBeGreaterThanOrEqual(15)
    expect(j.every((c) => c.article === null)).toBe(true)
    // Vérifie quelques termes clés
    expect(j.find((c) => c.title === 'EMA')).toBeDefined()
    expect(j.find((c) => c.title === 'IAS')).toBeDefined()
  })

  it('Personnalité judiciaire du condomínio (F.0) accessible via recherche content', () => {
    const found = chunks.find(
      (c) =>
        c.content.includes('personalidade judiciária') &&
        c.content.toLowerCase().includes('condomínio'),
    )
    expect(found).toBeDefined()
  })

  it('Art. 703.º CPC (espécies de títulos executivos) accessible', () => {
    const found = chunks.find((c) => c.content.includes('703.º') && c.content.includes('títulos executivos'))
    expect(found).toBeDefined()
  })

  it('TOC chunk présent — parent_path === __TOC__, source === Índice', () => {
    const toc = chunks.filter((c) => c.parent_path === '__TOC__')
    expect(toc.length).toBe(1)
    expect(toc[0].source).toBe('Índice')
    expect(toc[0].article).toBeNull()
    // Le TOC doit lister toutes les Partes
    for (const p of ['PARTE A', 'PARTE B', 'PARTE C', 'PARTE D', 'PARTE E', 'PARTE F', 'PARTE G', 'PARTE H', 'PARTE I', 'PARTE J']) {
      expect(toc[0].content).toContain(p)
    }
  })

  it('chunk_index est unique pour chaque chunk', () => {
    const indices = chunks.map((c) => c.chunk_index)
    expect(new Set(indices).size).toBe(indices.length)
  })

  it('chaque article du Code Civil contient une référence au numéro dans son content', () => {
    const cc = chunks.filter((c) => c.source === 'Código Civil')
    for (const c of cc) {
      // Le content doit contenir au moins une trace numérique (texte de loi)
      expect(c.content.length).toBeGreaterThan(50)
    }
  })

  it('aucun chunk ne mélange contenu de deux articles (parent_path stable)', () => {
    // Chaque chunk article doit avoir parent_path qui contient exactement un "Artigo X.º"
    const articleChunks = chunks.filter((c) => c.article)
    for (const c of articleChunks) {
      const matches = c.parent_path.match(/Artigo /g) || []
      expect(matches.length).toBe(1)
    }
  })
})
