import { describe, it, expect } from 'vitest'
import { calculateScoresPt } from '@/lib/analyse-devis-scoring-pt'

// ── Fixture : extraction JSON simulée du PDF Vitfix Artisan PT
// Orcamento-Lobao-Motorline-Lince.pdf (21/05/2026, NIF 276 873 297) ────────
const lobaoExtracted = {
  artisan_nom: 'Frédéric Neiva Carvalho',
  artisan_siret: '276873297',
  artisan_metier: 'Eletricidade / Motorizações',
  type_document: 'orcamento',
  description_travaux: 'Motorização portão de batente',
  immeuble: 'Rua Choqueiro Poente, 81, 4650-163 Barrosas',
  prestations: [
    { designation: 'Inspeção prévia do sistema elétrico', type: 'prestation', quantite: 1, unite: 'Serviço', prix_unitaire_ht: 80, total_ht: 80 },
    { designation: 'Fornecimento de motorização Motorline LINCE', type: 'prestation', quantite: 1, unite: 'Serviço', prix_unitaire_ht: 720, total_ht: 720 },
    { designation: 'Mão de obra — instalação completa', type: 'prestation', quantite: 1, unite: 'Serviço', prix_unitaire_ht: 440, total_ht: 440 },
    { designation: 'Outras despesas (deslocação e materiais diversos)', type: 'prestation', quantite: 1, unite: 'Serviço', prix_unitaire_ht: 110, total_ht: 110 },
  ],
  montant_ht: 1350,
  montant_ttc: 1660.5,
  tva_taux: 23,
  tva_montant: 310.5,
  date_intervention: '2026-05-23',
  artisan_email: 'cvlho.frederic@gmail.com',
  artisan_telephone: '912 014 971',
  priorite: 'planifiee',
  mentions_presentes: [
    'NIPC', 'CAE', 'IVA', 'Garantia legal 3 anos DL 84/2021',
    'Garantia comercial 2 anos', 'Validade 30 dias', 'Prazo de execução',
    'Condições de pagamento', 'IBAN', 'RGPD', 'REEE',
    'Direito de livre resolução 14 dias DL 24/2014',
    'CNIACC entidade RAL', 'Livro de Reclamações eletrónico',
  ],
  mentions_manquantes: [
    'Número de matrícula na Conservatória do Registo Comercial',
    'Seguro de responsabilidade civil profissional',
    'Alvará (não aplicável, montante < 16 750 €)',
    'ATCUD (não aplicável a orçamentos)',
    'SAF-T PT (não aplicável a orçamentos)',
  ],
  numero_documento: 'ORC-2026-205',
  date_documento: '2026-05-21',
  statut_juridique: 'Trabalhador independente (Recibos Verdes)',
}

// Texte brut du PDF (extraits clés) pour fallback de détection ────────────
const lobaoRawText = `
ORÇAMENTO — Projeto: Motorização portão de batente
ORC-2026-205
EMITENTE
Nome : Frédéric Neiva Carvalho
NIF : 276 873 297
CAE : 81210, 38112
DATA DE EMISSÃO 21/05/2026
VALIDADE 30 dias
PRAZO DE EXECUÇÃO No próprio dia
Subtotal s/IVA 1 350,00 €
IVA 23% s/ 1 350,00 € 310,50 €
TOTAL C/IVA 1 660,50 €
Garantia legal de conformidade: 3 anos sobre o equipamento (DL 84/2021, art. 12.º).
Garantia comercial: 2 anos adicionais sobre a mão de obra.
IBAN: PT50 0033 0000 4576 3682 866 05 — BIC: BCOMPTPL
PROTEÇÃO DE DADOS PESSOAIS (RGPD)
RESÍDUOS DE EQUIPAMENTOS ELÉTRICOS E ELETRÓNICOS (REEE)
Trabalhador independente (Recibos Verdes).
Direito de livre resolução: 14 dias de calendário (art. 10.º DL 24/2014).
Em caso de litígio, entidade RAL competente : CNIACC — www.cniacc.pt
Livro de Reclamações disponível em formato eletrónico em www.livroreclamacoes.pt
`

describe('calculateScoresPt — squelette', () => {
  it('exposes the expected shape', () => {
    const result = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    expect(result).toMatchObject({
      conformite: expect.objectContaining({ total: expect.any(Number), max: expect.any(Number), details: expect.any(Array) }),
      prix: expect.objectContaining({ ecart_moyen_pct: expect.any(Number), details: expect.any(Array) }),
      confiance: expect.any(Number),
      action_recommandee: expect.stringMatching(/^(valider|negocier|devis_vitfix)$/),
      messages_negociation: expect.any(Array),
    })
  })
})

describe('calculateScoresPt — critères de base', () => {
  it('detects NIF as ok when nifVerified=true', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    expect(r.conformite.details.find(c => c.id === 'nif')?.status).toBe('ok')
  })

  it('detects NIF as missing when nifVerified=false', () => {
    const r = calculateScoresPt({ ...lobaoExtracted, artisan_siret: '' }, lobaoRawText, { nifVerified: false })
    expect(r.conformite.details.find(c => c.id === 'nif')?.status).toBe('missing')
  })

  it('detects IVA mentioned (taxa 23%)', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'iva')?.status).toBe('ok')
  })

  it('detects garantia legal (DL 84/2021) via rawText fallback', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'garantia_legal')?.status).toBe('ok')
  })

  it('detects direito de livre resolução (DL 24/2014)', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'livre_resolucao')?.status).toBe('ok')
  })

  it('detects RGPD', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'rgpd')?.status).toBe('ok')
  })

  it('detects CNIACC (entidade RAL)', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'cniacc_ral')?.status).toBe('ok')
  })

  it('detects livro de reclamações', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'livro_reclamacoes')?.status).toBe('ok')
  })

  it('detects CAE present', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'cae')?.status).toBe('ok')
  })

  it('detects numero_orcamento from extracted.numero_document', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'numero_orcamento')?.status).toBe('ok')
  })

  it('detects data_emissao from extracted.date_document', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'data_emissao')?.status).toBe('ok')
  })

  it('detects detalhe_prestacoes when prestations[] has items with prix', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'detalhe_prestacoes')?.status).toBe('ok')
  })

  it('detects IBAN', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText)
    expect(r.conformite.details.find(c => c.id === 'iban_titular')?.status).toBe('ok')
  })
})

describe('calculateScoresPt — alvará conditionnel', () => {
  it('alvará marked NA when montant_ht < 16 750 €', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    const alvara = r.conformite.details.find(c => c.id === 'alvara')
    expect(alvara?.status).toBe('na')
  })

  it('alvará marked missing when montant_ht ≥ 16 750 € and no mention', () => {
    const ext = { ...lobaoExtracted, montant_ht: 20000 }
    const r = calculateScoresPt(ext, lobaoRawText, { nifVerified: true })
    expect(r.conformite.details.find(c => c.id === 'alvara')?.status).toBe('missing')
  })

  it('alvará marked ok when present in rawText AND montant qualifies', () => {
    const ext = { ...lobaoExtracted, montant_ht: 20000 }
    const raw = lobaoRawText + '\nAlvará de construção n.º 12345'
    const r = calculateScoresPt(ext, raw, { nifVerified: true })
    expect(r.conformite.details.find(c => c.id === 'alvara')?.status).toBe('ok')
  })

  it('alvará NA does not count in max (conformite ratio reflects N applicable items)', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    const max = r.conformite.max
    expect(max).toBeGreaterThan(0)
    expect(max).toBeLessThanOrEqual(120)
  })
})

describe('calculateScoresPt — Seguro RC adaptatif', () => {
  it('seguro_rc marked partial when absent BUT statut = Recibos Verdes', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    expect(r.conformite.details.find(c => c.id === 'seguro_rc')?.status).toBe('partial')
  })

  it('seguro_rc marked missing when absent AND statut = LDA/SA (pessoa coletiva)', () => {
    const ext = { ...lobaoExtracted, statut_juridique: 'Sociedade por Quotas (LDA)' }
    const r = calculateScoresPt(ext, lobaoRawText, { nifVerified: true })
    expect(r.conformite.details.find(c => c.id === 'seguro_rc')?.status).toBe('missing')
  })

  it('seguro_rc marked ok when present in mentions_presentes', () => {
    const ext = { ...lobaoExtracted, mentions_presentes: [...lobaoExtracted.mentions_presentes, 'Seguro de responsabilidade civil profissional Allianz nº 12345'] }
    const r = calculateScoresPt(ext, lobaoRawText, { nifVerified: true })
    expect(r.conformite.details.find(c => c.id === 'seguro_rc')?.status).toBe('ok')
  })
})

describe('calculateScoresPt — análise dos preços', () => {
  it('matches motorização Motorline LINCE within market range', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    const motoriz = r.prix.details.find(d => /motorline|motorizac/i.test(d.designation))
    expect(motoriz).toBeDefined()
    expect(motoriz?.status).not.toBe('inconnu')
    expect(motoriz?.fourchette_min).toBeGreaterThan(0)
  })

  it('matches mão de obra instalação as known range', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    const mo = r.prix.details.find(d => /mao\s*de\s*obra/i.test(d.designation))
    expect(mo?.status).not.toBe('inconnu')
  })

  it('computes a non-zero ecart_moyen_pct when prices match', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    const known = r.prix.details.filter(d => d.status !== 'inconnu')
    expect(known.length).toBeGreaterThan(0)
  })

  it('flags excessive price (> 50% above max) as excessif', () => {
    const ext = {
      ...lobaoExtracted,
      prestations: [
        { designation: 'Mão de obra — instalação completa', type: 'prestation', quantite: 1, unite: 'Serviço', prix_unitaire_ht: 1500, total_ht: 1500 },
      ],
    }
    const r = calculateScoresPt(ext, lobaoRawText, { nifVerified: true })
    expect(r.prix.details[0].status).toBe('excessif')
  })
})

describe('calculateScoresPt — messages PT + action + confiance', () => {
  it('messages_negociation are in Portuguese (no French phrasing)', () => {
    const degraded = { ...lobaoExtracted, mentions_presentes: [] as string[], mentions_manquantes: ['IVA', 'Garantia legal'] as string[] }
    const r = calculateScoresPt(degraded, '', { nifVerified: false })
    expect(r.messages_negociation.length).toBeGreaterThan(0)
    const joined = r.messages_negociation.join(' ')
    expect(joined).toMatch(/orçamento|preço|menciona/i)
    expect(joined).not.toMatch(/votre|prix|mentionne/i)
  })

  it('action_recommandee = valider when conformite ≥ 90%', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    if (r.conformite.total / r.conformite.max >= 0.9) {
      expect(r.action_recommandee).toBe('valider')
    }
  })

  it('action_recommandee = negocier when 70% ≤ conformite < 90%', () => {
    const partial = { ...lobaoExtracted, mentions_presentes: lobaoExtracted.mentions_presentes.slice(0, 5) }
    const r = calculateScoresPt(partial, '', { nifVerified: true })
    const pct = r.conformite.total / r.conformite.max
    if (pct >= 0.7 && pct < 0.9) expect(r.action_recommandee).toBe('negocier')
  })

  it('confiance is bounded 0-100', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    expect(r.confiance).toBeGreaterThanOrEqual(0)
    expect(r.confiance).toBeLessThanOrEqual(100)
  })

  it('confiance ≥ 80 on the Lobão fixture (well-formed PT doc)', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    expect(r.confiance).toBeGreaterThanOrEqual(80)
  })
})

describe('calculateScoresPt — acceptation Lobão PDF', () => {
  it('PDF Vitfix Artisan Lobão obtient un score de conformidade ≥ 80%', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    const ratio = r.conformite.total / r.conformite.max
    expect(ratio).toBeGreaterThanOrEqual(0.8)
  })

  it('PDF Lobão affiche au moins 12 critères PT (pas FR)', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    const ids = r.conformite.details.map(c => c.id)
    expect(ids).toEqual(expect.arrayContaining([
      'nif', 'cae', 'iva', 'garantia_legal', 'livre_resolucao',
      'cniacc_ral', 'livro_reclamacoes', 'rgpd', 'iban_titular',
    ]))
    expect(ids).not.toContain('siret')
    expect(ids).not.toContain('assurance_decennale')
    expect(ids).not.toContain('statut_juridique')
    expect(ids).not.toContain('mediateur')
  })

  it('Lobão : tous les labels sont en portugais (caractères portugais OK)', () => {
    const r = calculateScoresPt(lobaoExtracted, lobaoRawText, { nifVerified: true })
    const labels = r.conformite.details.map(c => c.label).join(' ')
    expect(labels).not.toMatch(/\bSIRET\b|\bdécennale\b|\bTVA mentionnée\b|\bSARL\b|\bSAS\b|\bEI\b/i)
    expect(labels).toMatch(/NIF|IVA|CAE|garantia|orçamento|livre resolução/i)
  })
})

describe('calculateScoresPt — filtrage strict des prestations vs descriptions/étapes', () => {
  // Reproduit le pattern observé en prod : le LLM JSON extractor confond
  // les sous-descriptions et étapes numérotées avec des prestations sans prix.
  // Le scoring doit les filtrer pour ne garder que les vraies prestations.
  const noisyExtracted = {
    ...lobaoExtracted,
    prestations: [
      { designation: 'Inspeção prévia do sistema elétrico', type: 'prestation', quantite: 1, unite: 'Serviço', prix_unitaire_ht: 80, total_ht: 80 },
      { designation: '(Diagnóstico técnico prévio)', type: 'description', quantite: 0, unite: '', prix_unitaire_ht: 0, total_ht: 0 },
      { designation: '1. Verificação do quadro e ponto de alimentação 230 V', type: 'prestation', quantite: 0, unite: '', prix_unitaire_ht: 0, total_ht: 0 },
      { designation: '2. Avaliação das folhas e pilares', type: 'etape', quantite: 0, unite: '', prix_unitaire_ht: 0, total_ht: 0 },
      { designation: 'Fornecimento de motorização Motorline LINCE', type: 'prestation', quantite: 1, unite: 'Serviço', prix_unitaire_ht: 720, total_ht: 720 },
      { designation: 'Mão de obra — instalação completa', type: 'prestation', quantite: 1, unite: 'Serviço', prix_unitaire_ht: 440, total_ht: 440 },
    ],
  }

  it('filters out type=description from prix details', () => {
    const r = calculateScoresPt(noisyExtracted, lobaoRawText, { nifVerified: true })
    const designations = r.prix.details.map(d => d.designation)
    expect(designations).not.toContain('(Diagnóstico técnico prévio)')
  })

  it('filters out type=etape from prix details', () => {
    const r = calculateScoresPt(noisyExtracted, lobaoRawText, { nifVerified: true })
    const designations = r.prix.details.map(d => d.designation)
    expect(designations).not.toContain('2. Avaliação das folhas e pilares')
  })

  it('filters out numbered-step designations even when LLM mistypes them as prestation', () => {
    const r = calculateScoresPt(noisyExtracted, lobaoRawText, { nifVerified: true })
    const designations = r.prix.details.map(d => d.designation)
    expect(designations).not.toContain('1. Verificação do quadro e ponto de alimentação 230 V')
  })

  it('filters out parenthetical sub-descriptions even when mistyped as prestation', () => {
    const noisier = {
      ...noisyExtracted,
      prestations: [
        ...noisyExtracted.prestations.slice(0, 1),
        { designation: '(Equipamentos para portão de batente)', type: 'prestation', quantite: 0, unite: '', prix_unitaire_ht: 0, total_ht: 0 },
        ...noisyExtracted.prestations.slice(4),
      ],
    }
    const r = calculateScoresPt(noisier, lobaoRawText, { nifVerified: true })
    const designations = r.prix.details.map(d => d.designation)
    expect(designations).not.toContain('(Equipamentos para portão de batente)')
  })

  it('keeps the 3 real prestations and matches them to PT price ranges', () => {
    const r = calculateScoresPt(noisyExtracted, lobaoRawText, { nifVerified: true })
    expect(r.prix.details.length).toBe(3)
    const known = r.prix.details.filter(d => d.status !== 'inconnu')
    expect(known.length).toBe(3)
  })

  it('produces a meaningful ecart_moyen_pct (non-zero, within reasonable range)', () => {
    const r = calculateScoresPt(noisyExtracted, lobaoRawText, { nifVerified: true })
    expect(r.prix.ecart_moyen_pct).not.toBe(0)
    expect(Math.abs(r.prix.ecart_moyen_pct)).toBeLessThanOrEqual(50)
  })
})
