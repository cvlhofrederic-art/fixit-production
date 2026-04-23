/**
 * Référentiels normatifs PORTUGAL 2026 (actualisés).
 *
 * Sources officielles :
 *  - IPQ (Instituto Português da Qualidade) — normas NP EN
 *  - LNEC (Laboratório Nacional de Engenharia Civil) — Especificações E
 *  - RGEU (Regulamento Geral das Edificações Urbanas — DL 38382/1951, revisto)
 *  - RJUE (Regime Jurídico da Urbanização e Edificação — DL 555/99, revisto)
 *  - RGSPPDADAR (Regulamento Geral dos Sistemas Públicos de Distribuição de Água)
 *  - RCCTE / SCE (Regulamento das Características do Comportamento Térmico dos Edifícios)
 *  - REH (Regulamento de Desempenho Energético dos Edifícios de Habitação — DL 118/2013)
 *  - RECS (Regulamento de Desempenho Energético dos Edifícios de Comércio e Serviços)
 *  - RTIEBT (Regras Técnicas das Instalações Eléctricas de Baixa Tensão — Portaria 949-A/2006)
 *  - DL 90/2021 — Regime da certificação energética e da qualidade do ar interior
 */

export interface PTStandard {
  code: string
  title: string
  /** Date de publication / révision principale */
  version?: string
}

/**
 * Mapping domaine → normes PT de référence.
 * À importer dans les recettes PT comme `dtuReferences` (champ réutilisé,
 * même si sémantiquement ce sont des normes NP/LNEC côté Portugal).
 */
export const PT_STANDARDS = {
  // ═══ BÉTON / MAÇONNERIE ═══
  betao: {
    code: 'NP EN 206+A2',
    title: 'Betão — especificação, desempenho, produção e conformidade',
    version: '2021',
  } satisfies PTStandard,
  betao_execucao: {
    code: 'NP EN 13670',
    title: 'Execução de estruturas de betão',
    version: '2011',
  } satisfies PTStandard,
  betao_calculo: {
    code: 'NP EN 1992-1-1 (Eurocódigo 2)',
    title: 'Projeto de estruturas de betão',
    version: '2010',
  } satisfies PTStandard,
  lnec_e464: {
    code: 'LNEC E 464',
    title: 'Betões — metodologia prescritiva para vida útil de projeto',
    version: '2007',
  } satisfies PTStandard,
  lnec_e465: {
    code: 'LNEC E 465',
    title: 'Betões — metodologia para avaliar desempenho',
    version: '2007',
  } satisfies PTStandard,
  alvenaria: {
    code: 'NP EN 1996-1-1 (Eurocódigo 6)',
    title: 'Projeto de estruturas de alvenaria',
    version: '2011',
  } satisfies PTStandard,
  alvenaria_blocos: {
    code: 'NP EN 771-3',
    title: 'Blocos de betão para alvenaria',
    version: '2016',
  } satisfies PTStandard,
  alvenaria_tijolo: {
    code: 'NP EN 771-1',
    title: 'Tijolos cerâmicos para alvenaria',
    version: '2016',
  } satisfies PTStandard,
  argamassas: {
    code: 'NP EN 998-1/2',
    title: 'Argamassas para alvenaria — especificação',
    version: '2017',
  } satisfies PTStandard,

  // ═══ COBERTURA ═══
  telhas_ceramicas: {
    code: 'NP EN 1304',
    title: 'Telhas cerâmicas para coberturas inclinadas',
    version: '2014',
  } satisfies PTStandard,
  telhas_betao: {
    code: 'NP EN 490',
    title: 'Telhas de betão para cobertura',
    version: '2012',
  } satisfies PTStandard,
  chapa_zinco: {
    code: 'NP EN 988',
    title: 'Produtos laminados planos em zinco e ligas de zinco',
    version: '1997',
  } satisfies PTStandard,

  // ═══ IMPERMEABILIZAÇÃO ═══
  impermeabilizacao: {
    code: 'Especificação LNEC E 244',
    title: 'Impermeabilização de coberturas em terraço',
    version: '1988',
  } satisfies PTStandard,
  membranas_betuminosas: {
    code: 'NP EN 13707',
    title: 'Membranas betuminosas armadas para impermeabilização',
    version: '2013',
  } satisfies PTStandard,

  // ═══ ISOLAMENTO / REH ═══
  isolamento_la_mineral: {
    code: 'NP EN 13162',
    title: 'Produtos de isolamento térmico — lã mineral',
    version: '2015',
  } satisfies PTStandard,
  isolamento_xps: {
    code: 'NP EN 13164',
    title: 'Produtos de isolamento térmico — XPS extrudido',
    version: '2015',
  } satisfies PTStandard,
  isolamento_eps: {
    code: 'NP EN 13163',
    title: 'Produtos de isolamento térmico — EPS expandido',
    version: '2015',
  } satisfies PTStandard,
  reh: {
    code: 'DL 118/2013 (REH)',
    title: 'Regulamento de Desempenho Energético dos Edifícios de Habitação',
    version: '2013, alterado DL 28/2016',
  } satisfies PTStandard,
  sce: {
    code: 'DL 101-D/2020',
    title: 'Requisitos de desempenho energético — SCE',
    version: '2020',
  } satisfies PTStandard,

  // ═══ CANALIZAÇÃO (PLOMBERIE) ═══
  abastecimento_agua: {
    code: 'NP EN 805',
    title: 'Abastecimento de água — sistemas e componentes fora de edifícios',
    version: '2002',
  } satisfies PTStandard,
  abastecimento_agua_predial: {
    code: 'NP EN 806',
    title: 'Especificações para instalações de água para consumo humano no interior de edifícios',
    version: '2012',
  } satisfies PTStandard,
  tubagens_pvc_drenagem: {
    code: 'NP EN 1451-1',
    title: 'Sistemas de canalização em plástico para esgoto e drenagem — PP',
    version: '2000',
  } satisfies PTStandard,
  tubagens_cobre: {
    code: 'NP EN 1057',
    title: 'Tubos de cobre para canalizações de água e gás',
    version: '2017',
  } satisfies PTStandard,
  tubagens_pex: {
    code: 'NP EN ISO 15875',
    title: 'Sistemas de canalizações em PEX',
    version: '2005',
  } satisfies PTStandard,
  tubagens_pvc_evacuacao: {
    code: 'NP EN 1329-1',
    title: 'Sistemas de canalização PVC-U para evacuação',
    version: '2014',
  } satisfies PTStandard,
  dimensionamento_plombagem: {
    code: 'RGSPPDADAR',
    title: 'Regulamento Geral dos Sistemas Públicos e Prediais de Distribuição de Água e de Drenagem',
    version: 'DR 23/95',
  } satisfies PTStandard,

  // ═══ ELETRICIDADE ═══
  rtiebt: {
    code: 'RTIEBT',
    title: 'Regras Técnicas das Instalações Eléctricas de Baixa Tensão',
    version: 'Portaria 949-A/2006, Portaria 252/2015',
  } satisfies PTStandard,
  quadros_baixa_tensao: {
    code: 'NP EN 61439-3',
    title: 'Conjuntos de aparelhagem de baixa tensão — quadros de distribuição',
    version: '2012',
  } satisfies PTStandard,
  cablagem_estruturada: {
    code: 'NP EN 50173-1',
    title: 'Sistemas genéricos de cablagem',
    version: '2018',
  } satisfies PTStandard,
  disjuntores: {
    code: 'NP EN 60898-1',
    title: 'Aparelhagem de proteção — disjuntores para proteção de sobreintensidades',
    version: '2015',
  } satisfies PTStandard,
  diferenciais: {
    code: 'NP EN 61008-1',
    title: 'Interruptores diferenciais sem dispositivo de proteção contra sobreintensidades',
    version: '2012',
  } satisfies PTStandard,
  cenelec_instalacoes: {
    code: 'CENELEC HD 60364',
    title: 'Instalações elétricas de baixa tensão — série harmonizada',
    version: '2017',
  } satisfies PTStandard,

  // ═══ CLIMATIZAÇÃO / AQUECIMENTO ═══
  instalacoes_gas: {
    code: 'DL 97/2017',
    title: 'Regime jurídico das redes e ramais de distribuição de gás',
    version: '2017',
  } satisfies PTStandard,
  bombas_calor: {
    code: 'NP EN 14511',
    title: 'Unidades de ar-condicionado e bombas de calor — ensaios',
    version: '2018',
  } satisfies PTStandard,
  ventilacao_mecanica: {
    code: 'NP 1037-1',
    title: 'Ventilação natural e mista em edifícios',
    version: '2002',
  } satisfies PTStandard,
  recs: {
    code: 'DL 118/2013 (RECS)',
    title: 'Regulamento de Desempenho Energético dos Edifícios de Comércio e Serviços',
    version: '2013, alterado DL 28/2016',
  } satisfies PTStandard,
  fgas: {
    code: 'Regulamento UE 517/2014 (F-Gas)',
    title: 'Gases fluorados com efeito de estufa — certificação obrigatória técnicos',
    version: '2014, revisão 2024',
  } satisfies PTStandard,

  // ═══ CAIXILHARIA / MENUISERIES ═══
  caixilharia: {
    code: 'NP EN 14351-1+A2',
    title: 'Janelas e portas exteriores — norma de produto',
    version: '2016',
  } satisfies PTStandard,

  // ═══ PAVIMENTOS / REVESTIMENTOS ═══
  ceramico_colado: {
    code: 'NP EN 13813',
    title: 'Argamassas de assentamento e camadas de regularização',
    version: '2003',
  } satisfies PTStandard,
  ceramicos_azulejos: {
    code: 'NP EN 14411',
    title: 'Placas cerâmicas — especificações e marcação',
    version: '2016',
  } satisfies PTStandard,

  // ═══ PINTURA ═══
  pintura_interior: {
    code: 'NP EN 1062-1',
    title: 'Tintas e vernizes — classificação de produtos',
    version: '2004',
  } satisfies PTStandard,

  // ═══ LEGISLAÇÃO GENERICA ═══
  rgeu: {
    code: 'RGEU (DL 38382/1951, revisto)',
    title: 'Regulamento Geral das Edificações Urbanas',
    version: 'revisões sucessivas',
  } satisfies PTStandard,
  rjue: {
    code: 'RJUE (DL 555/99)',
    title: 'Regime Jurídico da Urbanização e Edificação',
    version: 'DL 136/2014',
  } satisfies PTStandard,
  dl90_2021: {
    code: 'DL 90/2021',
    title: 'Regime da certificação energética e da qualidade do ar interior',
    version: '2021',
  } satisfies PTStandard,
  dl96_2017: {
    code: 'DL 96/2017',
    title: 'Regime jurídico da segurança contra incêndio em edifícios',
    version: '2017',
  } satisfies PTStandard,

  // ═══ SANEAMENTO / DRENAGEM ═══
  drenagem_predial: {
    code: 'NP EN 12056',
    title: 'Sistemas de drenagem gravítica no interior de edifícios',
    version: '2000',
  } satisfies PTStandard,
  caixas_visita: {
    code: 'NP EN 1917',
    title: 'Caixas de visita e câmaras de inspeção de betão não armado, armado e fibras de aço',
    version: '2004',
  } satisfies PTStandard,
  rgsppdadar: {
    code: 'RGSPPDADAR',
    title: 'Regulamento Geral dos Sistemas Públicos e Prediais de Distribuição de Água e de Drenagem',
    version: 'DR 23/95',
  } satisfies PTStandard,

  // ═══ JARDIM / ESPAÇOS EXTERIORES ═══
  agregados_nao_ligados: {
    code: 'NP EN 13242',
    title: 'Agregados para materiais não ligados ou tratados com ligantes hidráulicos',
    version: '2013',
  } satisfies PTStandard,
  blocos_betao_pavimento: {
    code: 'NP EN 1338',
    title: 'Blocos de betão para pavimentação',
    version: '2004',
  } satisfies PTStandard,

  // ═══ PISCINAS ═══
  piscinas_domesticas: {
    code: 'NP EN 16582',
    title: 'Piscinas domésticas — requisitos de segurança',
    version: '2017',
  } satisfies PTStandard,

  // ═══ VEDAÇÕES / ESTRUTURAS METÁLICAS ═══
  estruturas_aco: {
    code: 'NP EN 1090',
    title: 'Execução de estruturas de aço e de estruturas de alumínio',
    version: '2012',
  } satisfies PTStandard,
  blocos_gesso: {
    code: 'NP EN 12859',
    title: 'Blocos de gesso — definições, requisitos e métodos de ensaio',
    version: '2012',
  } satisfies PTStandard,

  // ═══ TERRAÇO / MADEIRA ═══
  durabilidade_madeira: {
    code: 'NP EN 335',
    title: 'Durabilidade da madeira e de produtos derivados — classes de utilização',
    version: '2013',
  } satisfies PTStandard,
} as const

export type PTStandardKey = keyof typeof PT_STANDARDS

/**
 * Helper : convertit une ou plusieurs clés PT_STANDARDS en tableau
 * `dtuReferences` compatible avec le schéma Recipe.
 */
export function ptRefs(...keys: PTStandardKey[]): Array<{ code: string; title: string; section?: string }> {
  return keys.map(k => {
    const s = PT_STANDARDS[k]
    return { code: s.version ? `${s.code} (${s.version})` : s.code, title: s.title }
  })
}
