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

// ── Fourchettes prix marché PT-PT 2025-2026 (sem IVA, em €) ─────────────────
// Sources : indicateurs marché Portugal cités dans SYSTEM_PROMPT_PT,
// extensions pour cas observés (motorisations, inspeções elétricas).
const PRIX_MARCHE_PT: Record<string, [number, number]> = {
  // Canalização
  'desentupimento simples': [60, 150],
  'desentupimento complexo': [150, 400],
  'fuga torneira': [50, 100],
  'substituicao torneira': [120, 300],
  'termoacumulador': [600, 1200],
  'cilindro agua quente': [600, 1200],
  'instalacao sanitarios': [350, 800],
  'coluna agua quente': [150, 400],
  // Eletricidade
  'quadro eletrico monofasico': [500, 1000],
  'quadro eletrico trifasico': [800, 2000],
  'adaptacao regras tecnicas': [1500, 4000],
  'inspecao previa sistema eletrico': [50, 150],
  'inspecao sistema eletrico': [50, 150],
  'tomada eletrica': [40, 120],
  'ponto de luz': [50, 150],
  'videoporteiro': [150, 700],
  'intercomunicador': [150, 700],
  'iluminacao areas comuns': [600, 1800],
  // Motorizações / portões (PDF Lobão)
  'motorizacao portao batente': [500, 1200],
  'motorizacao portao': [500, 1200],
  'motorline lince': [500, 1200],
  'motorline': [500, 1200],
  'mao de obra instalacao portao': [350, 800],
  'mao de obra instalacao completa': [200, 800],
  'mao de obra instalacao': [200, 800],
  'deslocacao materiais diversos': [50, 200],
  'outras despesas': [50, 200],
  // Carpintaria / Serralharia
  'porta entrada predio': [1500, 5000],
  'porta entrada': [1500, 5000],
  'porta patamar': [600, 2000],
  'janela vidro duplo': [350, 1000],
  'portao automatico': [1500, 5000],
  // Pintura
  'pintura interior': [15, 40],
  'pintura fachada': [20, 60],
  'reabilitacao fachada reboco': [30, 80],
  // Fechaduras / Segurança
  'fechadura': [120, 350],
  'codigo de acesso': [250, 700],
  'videoporteiro predio': [400, 1700],
  // Elevadores
  'manutencao anual elevador': [1200, 4000],
  'revisao elevador': [2500, 6500],
  // Coberturas
  'substituicao telhas': [60, 130],
  'impermeabilizacao terraco': [40, 100],
  // Espaços verdes
  'corte sebes': [25, 70],
  'poda arvore': [150, 700],
  'manutencao mensal espacos verdes': [150, 700],
  // Limpeza
  'limpeza areas comuns': [250, 700],
  'limpeza vidros': [1.5, 7],
  // Alvenaria
  'fissuracao fachada': [40, 130],
  'regularizacao pavimento': [8, 25],
}

function findPriceRangePt(designation: string): [number, number] | null {
  const norm = normalize(designation)
  let best: [number, number] | null = null
  let bestScore = 0
  for (const [key, range] of Object.entries(PRIX_MARCHE_PT)) {
    const keyN = normalize(key)
    const words = keyN.split(' ').filter(w => w.length > 1)
    if (words.length === 0) continue
    const matches = words.filter(w => norm.includes(w)).length
    const score = matches / words.length
    if (score > bestScore && score >= 0.5) {
      bestScore = score
      best = range
    }
  }
  return best
}

function calculatePrixScorePt(
  prestations: Array<{ designation: string; quantite?: number; unite?: string; prix_unitaire_ht?: number; total_ht?: number; type?: string }>,
): ScorePrix {
  const details: PrixDetail[] = []
  for (const p of prestations) {
    // Filtre 1 : exclure description / etape explicites du LLM
    if (p.type === 'description' || p.type === 'etape') continue
    // Filtre 2 : exclure designations commençant par un numéro+point (étapes numérotées
    // que le LLM aurait mal typées en 'prestation')
    if (/^\s*\d+\.\s/.test(p.designation || '')) continue
    // Filtre 3 : exclure designations qui commencent par '(' (sous-descriptions)
    if (/^\s*\(/.test(p.designation || '')) continue
    const prix = p.prix_unitaire_ht || p.total_ht || 0
    if (!prix || prix <= 0) continue
    const fourchette = findPriceRangePt(p.designation)
    if (!fourchette) {
      details.push({
        designation: p.designation,
        prix,
        unite: p.unite || 'u',
        fourchette_min: 0,
        fourchette_max: 0,
        status: 'inconnu',
        ecart_pct: 0,
      })
      continue
    }
    const milieu = (fourchette[0] + fourchette[1]) / 2
    const ecart = ((prix - milieu) / milieu) * 100
    let status: PrixDetail['status'] = 'ok'
    if (prix < fourchette[0]) status = 'bas'
    else if (prix > fourchette[1] * 1.5) status = 'excessif'
    else if (prix > fourchette[1]) status = 'eleve'
    details.push({
      designation: p.designation,
      prix,
      unite: p.unite || 'u',
      fourchette_min: fourchette[0],
      fourchette_max: fourchette[1],
      status,
      ecart_pct: Math.round(ecart),
    })
  }
  const known = details.filter(d => d.status !== 'inconnu')
  const ecart_moyen = known.length > 0
    ? Math.round(known.reduce((s, d) => s + d.ecart_pct, 0) / known.length)
    : 0
  return { ecart_moyen_pct: ecart_moyen, details }
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
  // When montant qualifies, we override LLM's "não aplicável" judgment in mm
  // so rawText presence of "alvara" correctly yields 'ok' (not 'partial').
  const alvaraMm = montantHt >= 16750 ? [] : mm
  const alvaraStatus: ConformiteCritere['status'] =
    montantHt < 16750
      ? 'na'
      : has(['alvara', 'lei 41 2015', 'alvara de construcao'], mp, alvaraMm, rawText)
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
  const prestations = (extracted.prestations || []) as Array<{ designation: string; quantite?: number; unite?: string; prix_unitaire_ht?: number; total_ht?: number }>
  const prix = calculatePrixScorePt(prestations)

  // Score prix normalisé /100 : 100 = pile au milieu, -1pt par % d'écart
  const prixScore = Math.max(0, Math.min(100, 100 - Math.abs(prix.ecart_moyen_pct)))

  // Confiance = conformidade × 0.5 + prix × 0.3 + bonus × 0.2
  const bonusEmpresa = nifVerified ? 100 : 50
  const conformitePct = conformite.max > 0 ? (conformite.total / conformite.max) * 100 : 0
  const confiance = Math.round(conformitePct * 0.5 + prixScore * 0.3 + bonusEmpresa * 0.2)

  // Action recommandée
  let action: AnalyseScores['action_recommandee'] = 'valider'
  if (conformitePct < 70 || prix.details.some(d => d.status === 'excessif')) {
    action = 'devis_vitfix'
  } else if (conformitePct < 90 || prix.details.some(d => d.status === 'eleve')) {
    action = 'negocier'
  }

  // Messages négo en portugais
  const messages: string[] = []
  for (const c of conformite.details) {
    if (c.status === 'missing') {
      messages.push(`O seu orçamento não menciona : ${c.label}. Pode acrescentar esta informação ?`)
    }
  }
  for (const p of prix.details) {
    if (p.status === 'eleve' || p.status === 'excessif') {
      const intensite = p.status === 'excessif' ? 'muito ' : ''
      messages.push(`O preço de "${p.designation}" (${p.prix} €) parece ${intensite}elevado face ao mercado PT (${p.fourchette_min}-${p.fourchette_max} €). É negociável ?`)
    }
  }

  return {
    conformite,
    prix,
    confiance: Math.max(0, Math.min(100, confiance)),
    action_recommandee: action,
    messages_negociation: messages,
  }
}

export type { ConformiteCritere, PrixDetail, ScoreConformite, ScorePrix, AnalyseScores }
