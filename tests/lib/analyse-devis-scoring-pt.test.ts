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
