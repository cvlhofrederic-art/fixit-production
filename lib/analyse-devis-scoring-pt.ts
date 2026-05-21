// ── Moteur de scoring PT — Análise Orçamentos/Faturas (côté syndic) ─────────
// Côté FR : lib/analyse-devis-scoring.ts (NE PAS TOUCHER)
// Types : importés depuis le moteur FR (source de vérité, intact).

import type {
  ConformiteCritere,
  PrixDetail,
  ScoreConformite,
  ScorePrix,
  AnalyseScores,
} from '@/lib/analyse-devis-scoring'

// ── Normalisation texte ─────────────────────────────────────────────────────
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Détection avec fallback texte brut ──────────────────────────────────────
// Le LLM peut omettre certaines mentions dans mentions_presentes ; on cherche
// donc aussi dans rawText. Status :
//   'ok'      = trouvé dans mentions_presentes OU dans rawText (sans manque déclaré)
//   'partial' = trouvé dans rawText mais déclaré manquant ailleurs
//   'missing' = absent partout
export function has(
  keywords: string[],
  mp: string[],
  mm: string[],
  rawText: string,
): 'ok' | 'partial' | 'missing' {
  const mpN = mp.map(normalize)
  const mmN = mm.map(normalize)
  const rawN = normalize(rawText)
  const kN = keywords.map(normalize)

  const inMp = kN.some(k => mpN.some(m => m.includes(k)))
  const inMm = kN.some(k => mmN.some(m => m.includes(k)))
  const inRaw = kN.some(k => rawN.includes(k))

  if (inMp) return 'ok'
  if (inRaw && !inMm) return 'ok'
  if (inRaw && inMm) return 'partial'
  return 'missing'
}

// ── Critères de conformité PT ───────────────────────────────────────────────
function calculateConformiteScorePt(
  extracted: Record<string, unknown>,
  rawText: string,
  nifVerified: boolean,
): ScoreConformite {
  const mp = (extracted.mentions_presentes || []) as string[]
  const mm = (extracted.mentions_manquantes || []) as string[]
  const typeDoc = String(extracted.type_document || '').toLowerCase()
  const isFatura = typeDoc.includes('fatura') || typeDoc === 'factura'
  const montantHt = Number(extracted.montant_ht || 0)
  const statutJuridique = String(extracted.statut_juridique || '').toLowerCase()
  const isRecibosVerdes = /recibos\s*verdes|trabalhador\s+independente|empresario.+nome\s+individual|\bei\b/.test(statutJuridique)

  const prestations = (extracted.prestations || []) as Array<{ prix_unitaire_ht?: number; total_ht?: number }>
  const hasPrestations = prestations.length > 0 && prestations.some(p => (p.prix_unitaire_ht || p.total_ht || 0) > 0)

  // Pattern IBAN PT : PTxx suivi de groupes de 4 chiffres
  const hasIban = /\bPT\d{2}(\s?\d{4}){2,}/.test(rawText)

  // Support both field name variants (numero_document and numero_documento)
  const numeroDoc = extracted.numero_document || extracted.numero_documento
  const dateDoc = extracted.date_document || extracted.date_documento

  const criteres: ConformiteCritere[] = [
    {
      id: 'nif',
      label: 'NIF/NIPC válido',
      poids: 12,
      status: nifVerified ? 'ok' : (extracted.artisan_siret ? 'partial' : 'missing'),
    },
    {
      id: 'cae',
      label: 'CAE (Código de Atividade Económica)',
      poids: 5,
      status: has(['cae', 'codigo de atividade economica'], mp, mm, rawText),
    },
    {
      id: 'iva',
      label: 'IVA mencionado (taxa ou regime)',
      poids: 10,
      status: has(['iva', 'isento', 'regime de iva', 'taxa de iva', '23%', '13%', '6%'], mp, mm, rawText),
    },
    {
      id: 'garantia_legal',
      label: 'Garantia legal (DL 84/2021 ou DL 67/2003)',
      poids: 12,
      status: has(['garantia legal', 'dl 84 2021', 'dl 67 2003', 'decreto lei 84', 'decreto lei 67', '3 anos sobre o equipamento', 'garantia 5 anos'], mp, mm, rawText),
    },
    {
      id: 'condicoes_pagamento',
      label: 'Condições de pagamento',
      poids: 5,
      status: has(['condicoes de pagamento', 'adiantamento', 'tranches', 'transferencia bancaria', 'modo de pagamento'], mp, mm, rawText),
    },
    {
      id: 'prazo_execucao',
      label: 'Prazo de execução',
      poids: 4,
      status: has(['prazo de execucao', 'data da prestacao', 'no proprio dia'], mp, mm, rawText),
    },
    {
      id: 'validade_orcamento',
      label: 'Validade do orçamento',
      poids: 4,
      status: has(['validade', 'valido ate', 'dias a contar'], mp, mm, rawText),
    },
    {
      id: 'livre_resolucao',
      label: 'Direito de livre resolução (DL 24/2014)',
      poids: 10,
      status: has(['livre resolucao', 'dl 24 2014', '14 dias de calendario', 'direito de livre'], mp, mm, rawText),
    },
    {
      id: 'cniacc_ral',
      label: 'Entidade RAL (CNIACC ou equivalente)',
      poids: 5,
      status: has(['cniacc', 'entidade ral', 'resolucao alternativa de litigios', 'lei 144 2015'], mp, mm, rawText),
    },
    {
      id: 'livro_reclamacoes',
      label: 'Livro de Reclamações (eletrónico)',
      poids: 4,
      status: has(['livro de reclamacoes', 'livroreclamacoes', 'dl 156 2005'], mp, mm, rawText),
    },
    {
      id: 'rgpd',
      label: 'Tratamento de dados pessoais (RGPD)',
      poids: 4,
      status: has(['rgpd', 'dados pessoais', '2016 679', 'cnpd', 'protecao de dados'], mp, mm, rawText),
    },
    {
      id: 'numero_orcamento',
      label: 'Número sequencial único do orçamento',
      poids: 4,
      status: numeroDoc
        ? 'ok'
        : has(['orc', 'numero do orcamento', 'numero sequencial'], mp, mm, rawText),
    },
    {
      id: 'data_emissao',
      label: 'Data de emissão',
      poids: 4,
      status: dateDoc
        ? 'ok'
        : has(['data de emissao', 'emitido em'], mp, mm, rawText),
    },
    {
      id: 'detalhe_prestacoes',
      label: 'Detalhe das prestações (qtd, unidade, preço)',
      poids: 8,
      status: hasPrestations ? 'ok' : has(['designacao', 'prestacao', 'quantidade'], mp, mm, rawText),
    },
    {
      id: 'iban_titular',
      label: 'IBAN e titular para transferência',
      poids: 3,
      status: hasIban ? 'ok' : has(['iban'], mp, mm, rawText),
    },
  ]

  // Alvará — applicable seulement si montant ≥ 16 750 € (Lei 41/2015)
  const alvaraStatus: ConformiteCritere['status'] =
    montantHt < 16750
      ? 'na'
      : has(['alvara', 'lei 41 2015', 'alvara de construcao'], mp, mm, rawText)
  criteres.push({
    id: 'alvara',
    label: 'Alvará de construção (Lei 41/2015, obras ≥ 16 750 €)',
    poids: 8,
    status: alvaraStatus,
  })

  // Seguro RC — adaptatif au statut juridique
  const seguroFound = has(['seguro de responsabilidade civil', 'seguro rc', 'apolice'], mp, mm, rawText)
  const seguroStatus: ConformiteCritere['status'] =
    seguroFound === 'ok'
      ? 'ok'
      : isRecibosVerdes
        ? 'partial'
        : 'missing'
  criteres.push({
    id: 'seguro_rc',
    label: 'Seguro de responsabilidade civil profissional',
    poids: 8,
    status: seguroStatus,
  })

  // Items spécifiques fatura
  if (isFatura) {
    criteres.push(
      {
        id: 'atcud',
        label: 'ATCUD (Portaria 195/2020)',
        poids: 8,
        status: has(['atcud', 'codigo unico de documento', 'portaria 195 2020'], mp, mm, rawText),
      },
      {
        id: 'saft_pt',
        label: 'SAF-T PT exportável (DL 28/2019)',
        poids: 5,
        status: has(['saf t', 'saft pt', 'dl 28 2019'], mp, mm, rawText),
      },
    )
  }

  // Calcul total / max — items 'na' sont retirés du max
  let total = 0
  let max = 0
  for (const c of criteres) {
    if (c.status === 'na') continue
    max += c.poids
    if (c.status === 'ok') total += c.poids
    else if (c.status === 'partial') total += Math.floor(c.poids * 0.5)
  }
  return { total, max, details: criteres }
}

// ── API publique ────────────────────────────────────────────────────────────
export function calculateScoresPt(
  extracted: Record<string, unknown>,
  rawText: string,
  options?: { nifVerified?: boolean },
): AnalyseScores {
  const nifVerified = !!options?.nifVerified
  const conformite = calculateConformiteScorePt(extracted, rawText, nifVerified)
  return {
    conformite,
    prix: { ecart_moyen_pct: 0, details: [] },
    confiance: 0,
    action_recommandee: 'valider',
    messages_negociation: [],
  }
}

export type { ConformiteCritere, PrixDetail, ScoreConformite, ScorePrix, AnalyseScores }
