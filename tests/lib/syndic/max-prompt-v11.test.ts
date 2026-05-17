// tests/lib/syndic/max-prompt-v11.test.ts
// ──────────────────────────────────────────────────────────────────────────────
// Tests unitaires du prompt système Max v1.1 (PT) — sections XML balisées,
// pré-chargement TOC, 4 correctifs [v1.1] (défauts A/B/C/citation), format JSON
// compatible avec max-validate.ts.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { buildMaxStrictSystemPrompt } from '@/lib/syndic/max-strict-prompt'
import type { ScoredLegalChunk } from '@/lib/syndic/max-legal-rag'

const fakeChunk = (overrides: Partial<ScoredLegalChunk> = {}): ScoredLegalChunk => ({
  id: 'chunk-test-1',
  source: 'Código Civil',
  article: '1424.º',
  title: 'Encargos de conservação e fruição',
  content: 'As despesas necessárias à conservação e fruição das partes comuns...',
  theme: 'despesas',
  parent_path: 'Parte B > Secção III > Artigo 1424.º',
  score: 0.9,
  rerankScore: 5,
  ...overrides,
})

const fakeToc = `- PARTE A — ENQUADRAMENTO
- PARTE B — CÓDIGO CIVIL
  - Artigo 1414.º — Princípio geral
  - Artigo 1424.º — Encargos de conservação
- PARTE I — LEGISLAÇÃO CONEXA
  - I.3 — Ascensores (DL 320/2002)`

describe('buildMaxStrictSystemPrompt — PT v1.1', () => {
  const chunks = [fakeChunk(), fakeChunk({ id: 'chunk-2', article: '1430.º', title: 'Órgãos administrativos' })]

  it('produit un prompt en portugais (PT)', () => {
    const prompt = buildMaxStrictSystemPrompt({ chunks, locale: 'pt' })
    expect(prompt).toContain('Prompt de sistema v1.1')
    expect(prompt).toContain('condomínio')
    expect(prompt).toContain('propriedade horizontal')
    // « copropriété » figure dans l'interdiction explicite (anti-mélange FR/PT)
    // mais ne décrit jamais la matière traitée.
    expect(prompt).toMatch(/NUNCA mencionar[^.]*copropriété/)
  })

  it('contient les 14 sections XML balisées attendues', () => {
    const prompt = buildMaxStrictSystemPrompt({ chunks, locale: 'pt', tocContent: fakeToc })
    const expectedTags = [
      'identidade_e_missao',
      'fonte_de_conhecimento',
      'base_de_conhecimento_indice',
      'direito_e_facto',
      'tratamento_de_valores',
      'controlo_de_ambito',
      'o_que_a_base_cobre',
      'metodo_de_analise',
      'regime_de_citacao',
      'formato_das_respostas',
      'limites_e_postura',
      'exemplos_de_comportamento',
      'formato_de_saida_json',
      'fontes_juridicas_disponiveis',
    ]
    for (const tag of expectedTags) {
      expect(prompt).toContain(`<${tag}>`)
      expect(prompt).toContain(`</${tag}>`)
    }
  })

  it('correctif [v1.1] défaut A — comparaison numérique obligatoire', () => {
    const prompt = buildMaxStrictSystemPrompt({ chunks, locale: 'pt' })
    expect(prompt).toContain('<tratamento_de_valores>')
    expect(prompt).toContain('comparação explícita')
    expect(prompt).toContain('6 < 10')
    expect(prompt).toContain('mínimo')
    expect(prompt).toContain('máximo')
  })

  it('correctif [v1.1] défaut B — contrôle de périmètre exhaustif', () => {
    const prompt = buildMaxStrictSystemPrompt({ chunks, locale: 'pt' })
    expect(prompt).toContain('<controlo_de_ambito>')
    expect(prompt).toContain('Direito do trabalho')
    expect(prompt).toContain('porteiro')
    expect(prompt).toContain('Fiscalidade')
    expect(prompt).toContain('Contabilidade')
    expect(prompt).toContain('Direito penal')
    expect(prompt).toContain('Direito do arrendamento')
  })

  it('correctif [v1.1] défaut C — pas de refus sur matière couverte (Partie I)', () => {
    const prompt = buildMaxStrictSystemPrompt({ chunks, locale: 'pt' })
    expect(prompt).toContain('<o_que_a_base_cobre>')
    expect(prompt).toContain('ascensores')
    expect(prompt).toContain('SCIE')
    expect(prompt).toContain('instalações de gás')
    expect(prompt).toContain('alojamento local')
    expect(prompt).toContain('ruído')
    expect(prompt).toContain('proteção de dados')
  })

  it('correctif [v1.1] régime de citação — anti-faux verbatim + anti-auto-certification', () => {
    const prompt = buildMaxStrictSystemPrompt({ chunks, locale: 'pt' })
    expect(prompt).toContain('<regime_de_citacao>')
    // Distinction littéral / paraphrase / référence
    expect(prompt).toContain('Citação literal')
    expect(prompt).toContain('Paráfrase')
    expect(prompt).toContain('Referência')
    // Pas de "citação não literal"
    expect(prompt).toContain('Não existe «citação não literal»')
    // Anti-auto-certification
    expect(prompt).toContain('Proibição de auto-certificação')
    expect(prompt).toContain('citação verificada')
    expect(prompt).toContain('fonte confirmada')
  })

  it('injecte le TOC dans <base_de_conhecimento_indice> quand tocContent fourni', () => {
    const prompt = buildMaxStrictSystemPrompt({ chunks, locale: 'pt', tocContent: fakeToc })
    expect(prompt).toContain('<base_de_conhecimento_indice>')
    expect(prompt).toContain('PARTE A — ENQUADRAMENTO')
    expect(prompt).toContain('PARTE I — LEGISLAÇÃO CONEXA')
    expect(prompt).toContain('I.3 — Ascensores (DL 320/2002)')
  })

  it('place un fallback dans <base_de_conhecimento_indice> quand tocContent absent', () => {
    const prompt = buildMaxStrictSystemPrompt({ chunks, locale: 'pt' })
    expect(prompt).toContain('<base_de_conhecimento_indice>')
    expect(prompt).toContain('Índice da base não disponível')
  })

  it('injecte les chunks FONT-X dans <fontes_juridicas_disponiveis>', () => {
    const prompt = buildMaxStrictSystemPrompt({ chunks, locale: 'pt' })
    expect(prompt).toContain('<fontes_juridicas_disponiveis>')
    expect(prompt).toContain('[FONT-1]')
    expect(prompt).toContain('[FONT-2]')
    expect(prompt).toContain('Código Civil')
    expect(prompt).toContain('Art. 1424.º')
    expect(prompt).toContain('Art. 1430.º')
  })

  it('formato JSON compatible avec max-validate.ts (answer/citations/refusal)', () => {
    const prompt = buildMaxStrictSystemPrompt({ chunks, locale: 'pt' })
    expect(prompt).toContain('<formato_de_saida_json>')
    expect(prompt).toContain('"answer"')
    expect(prompt).toContain('"citations"')
    expect(prompt).toContain('"font_id"')
    expect(prompt).toContain('"exact_quote"')
    expect(prompt).toContain('"claim"')
    expect(prompt).toContain('"refusal"')
  })

  it('refusal standard inchangé (compat max-validate.ts)', () => {
    const prompt = buildMaxStrictSystemPrompt({ chunks, locale: 'pt' })
    expect(prompt).toContain('Esta questão não está coberta pelo meu corpus jurídico atual')
  })

  it('ne contient aucune phrase d\'auto-certification dans les exemples', () => {
    const prompt = buildMaxStrictSystemPrompt({ chunks, locale: 'pt' })
    // Aucun exemple ne doit affirmer "citation vérifiée" ou similaire comme bon comportement
    expect(prompt).not.toMatch(/citação\s+verificada\s*»?\s*$/im)
    // Les seules occurrences de "citação verificada" sont dans les règles d'interdiction
    const occurrences = (prompt.match(/citação verificada/g) || []).length
    expect(occurrences).toBeGreaterThanOrEqual(1)
    expect(occurrences).toBeLessThanOrEqual(3) // règle 5 du regime + JSON output rules
  })

  it('mention de tous les marqueurs [v1.1] dans les commentaires/sections', () => {
    const prompt = buildMaxStrictSystemPrompt({ chunks, locale: 'pt' })
    // v1.1 explicitement annoncé dans l'en-tête
    expect(prompt).toMatch(/v1\.1/)
    // Référence croisée des correctifs A/B/C dans les exemples
    expect(prompt).toContain('defeito A coberto')
    expect(prompt).toContain('defeito B coberto')
    expect(prompt).toContain('defeito C coberto')
  })

  it('date du jour injectée en pt-PT', () => {
    const prompt = buildMaxStrictSystemPrompt({ chunks, locale: 'pt' })
    expect(prompt).toMatch(/Data de hoje:\s+\d+/)
  })

  it('fallback "Nenhuma fonte" quand chunks vide', () => {
    const prompt = buildMaxStrictSystemPrompt({ chunks: [], locale: 'pt' })
    expect(prompt).toContain('Nenhuma fonte jurídica encontrada')
  })

  it('FR (dormant) — pas de régression, format inchangé', () => {
    const prompt = buildMaxStrictSystemPrompt({ chunks, locale: 'fr' })
    expect(prompt).toContain('Max')
    expect(prompt).toContain('copropriété française')
    expect(prompt).toContain('[FONT-1]')
    // FR garde son format markdown sans XML tags (pas de refonte demandée)
    expect(prompt).not.toContain('<identidade_e_missao>')
  })
})
