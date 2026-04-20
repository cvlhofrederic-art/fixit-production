import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * REVESTIMENTOS (cerâmicos, pavimentos) — recetas PT (Lot F).
 *
 * 4 obras revestimentos correntes :
 *  1. Azulejo parede colado 20×20 (casa de banho/cozinha)
 *  2. Porcelânico pavimento 45×45 colado
 *  3. Porcelânico exterior anti-derrapante 60×60 (terraço)
 *  4. Pavimento flutuante laminado AC4 (habitação)
 *
 * Referências : NP EN 14411, NP EN 13813.
 * Fabricantes : Aleluia, Love Tiles, Margres, Weber PT / Mapei.
 */

export const revestimentoRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. AZULEJO PAREDE 20×20 (casa de banho / cozinha)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'azulejo-parede-20-pt',
    name: 'Azulejo parede 20×20 cm colado',
    description: 'Azulejo cerâmico parede (banho/cozinha): cola flexível + juntas cerâmicas.',
    country: 'PT',
    trade: 'carrelage',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('ceramico_colado'),
      { code: 'NP EN 14411 (2016)', title: 'Placas cerâmicas — especificações e marcação' },
    ],
    hypothesesACommuniquer: [
      'Suporte: reboco ou pladur curado, plano, seco',
      'Cola C2T flexível (Weber PT weber.col flex / Mapei Keraflex)',
      'Consumo cola: 3,5 kg/m² com pente 6 mm',
      'Juntas: 2-3 mm com juntas cimentosas CG2',
      'Acabamento perimetral: silicone sanitário (juntas de movimento)',
    ],
    materials: [
      {
        id: 'primario-ceramico-pt', name: 'Primário de aderência (Weber PT ou Mapei)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Aplicação rolo',
        manufacturerRef: 'Weber PT / Mapei Eco Prim',
      },
      {
        id: 'azulejo-20-20-pt', name: 'Azulejo cerâmico 20×20 cm (Aleluia / Love Tiles)',
        category: 'carreau', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.08, wasteReason: 'Cortes e quebras',
        normRef: 'NP EN 14411 (2016)', manufacturerRef: 'Aleluia / Love Tiles',
        packaging: { unit: 'panneau', contentQty: 1.25, contentUnit: 'm2', label: 'caixa 1,25 m²' },
      },
      {
        id: 'cola-c2t-pt', name: 'Cola C2T flexível (Weber.col flex)',
        category: 'colle', phase: 'principal', quantityPerBase: 3.5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Mistura e aplicação',
        normRef: 'NP EN 12004 (2017)', manufacturerRef: 'Weber PT / Mapei',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'junta-cimento-cg2-pt', name: 'Junta cerâmica cimentosa CG2 (3 mm)',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.3, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Resíduos e limpeza',
        manufacturerRef: 'Weber.joint / Mapei Ultracolor',
        packaging: { unit: 'sac', contentQty: 5, contentUnit: 'kg', label: 'saco 5 kg' },
      },
      {
        id: 'silicone-sanitario-pt', name: 'Silicone sanitário neutro (juntas movimento)',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.3, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.10, wasteReason: 'Aplicação',
        manufacturerRef: 'Sika SikaSil / Weber PT',
      },
      {
        id: 'cruzetas-3mm-pt', name: 'Cruzetas 3 mm (alinhamento juntas)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 20, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Reutilizáveis',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. PORCELÂNICO PAVIMENTO 45×45 (interior)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'porcelanico-pavimento-45-pt',
    name: 'Porcelânico pavimento interior 45×45 cm colado',
    description: 'Pavimento porcelânico colado sobre betonilha: primário + cola + juntas + junta perimetral.',
    country: 'PT',
    trade: 'revetement_sol',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('ceramico_colado'),
      { code: 'NP EN 14411 (2016)', title: 'Placas cerâmicas' },
    ],
    hypothesesACommuniquer: [
      'Suporte: betonilha regularizada (curada 28 dias)',
      'Cola C2TE flexível deformável',
      'Consumo cola: 4,5 kg/m² (pente 8 mm, formato grande)',
      'Juntas: 3 mm com junta cimentosa CG2',
      'Junta perimetral 5 mm em cortiça/PE',
      'Classificação suporte PEI 4 mínimo',
    ],
    materials: [
      {
        id: 'primario-ceramico-pt', name: 'Primário de aderência',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Aplicação',
        manufacturerRef: 'Weber PT',
      },
      {
        id: 'porcelanico-45-45-pt', name: 'Porcelânico 45×45 PEI 4 (Margres / Aleluia)',
        category: 'carreau', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes e quebras',
        normRef: 'NP EN 14411 (2016)', manufacturerRef: 'Margres / Aleluia / Love Tiles',
        packaging: { unit: 'panneau', contentQty: 1.4, contentUnit: 'm2', label: 'caixa 1,4 m²' },
      },
      {
        id: 'cola-c2te-pt', name: 'Cola C2TE flexível (Weber.col flex plus / Mapei Keraflex Maxi)',
        category: 'colle', phase: 'principal', quantityPerBase: 4.5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Mistura',
        normRef: 'NP EN 12004 (2017)', manufacturerRef: 'Weber PT / Mapei',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'junta-cimento-cg2-pt', name: 'Junta cimentosa CG2',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Resíduos',
      },
      {
        id: 'junta-periferica-5-pt', name: 'Junta perimetral 5 mm cortiça/PE',
        category: 'joint', phase: 'accessoires', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Cortes',
      },
      {
        id: 'cruzetas-3mm-pt', name: 'Cruzetas 3 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 8, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Reutilizáveis',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. PORCELÂNICO EXTERIOR ANTI-DERRAPANTE 60×60 (terraço)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'porcelanico-exterior-60-r11-pt',
    name: 'Porcelânico exterior 60×60 anti-derrapante R11 (terraço)',
    description: 'Pavimento porcelânico exterior R11 sobre betonilha exterior com pendente: cola impermeável + juntas.',
    country: 'PT',
    trade: 'terrasse_ext',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('ceramico_colado', 'impermeabilizacao'),
    ],
    hypothesesACommuniquer: [
      'Suporte: betonilha exterior com pendente 1,5% mínimo',
      'Impermeabilização SPEC prévia OBRIGATÓRIA (Sika SikaTop Seal 107)',
      'Porcelânico classificação R11 (anti-derrapante exterior chuva)',
      'Cola C2TE S1 flexível aderência alta',
      'Junta cimentosa flexível CG2W (resistência ciclos gelo/calor)',
      'Junta periférica + juntas de movimento cada 25 m²',
    ],
    materials: [
      {
        id: 'impermeabilizante-spec-ext-pt', name: 'SPEC impermeabilizante (SikaTop Seal 107)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 3, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação 2 camadas',
        manufacturerRef: 'Sika SikaTop Seal-107 / Mapei Mapelastic',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'porcelanico-r11-60-pt', name: 'Porcelânico R11 60×60 exterior (Margres)',
        category: 'carreau', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Cortes, formato grande',
        normRef: 'NP EN 14411 (2016)', manufacturerRef: 'Margres / Aleluia (gama R11)',
        packaging: { unit: 'panneau', contentQty: 1.44, contentUnit: 'm2', label: 'caixa 1,44 m²' },
      },
      {
        id: 'cola-c2tes1-ext-pt', name: 'Cola C2TE S1 exterior (Weber.col fix flex)',
        category: 'colle', phase: 'principal', quantityPerBase: 5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Mistura, aplicação dupla cola',
        normRef: 'NP EN 12004 (2017)', manufacturerRef: 'Weber PT / Mapei',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'junta-cg2w-ext-pt', name: 'Junta cimentosa CG2W (exterior, gelo)',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.6, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Resíduos',
        manufacturerRef: 'Weber.joint / Mapei Ultracolor',
      },
      {
        id: 'junta-periferica-5-pt', name: 'Junta perimetral 5 mm',
        category: 'joint', phase: 'accessoires', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Cortes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. PAVIMENTO FLUTUANTE LAMINADO AC4
  // ══════════════════════════════════════════════════════════════
  {
    id: 'pavimento-laminado-ac4-pt',
    name: 'Pavimento flutuante laminado AC4 (habitação)',
    description: 'Pavimento laminado AC4 click sobre subcapa em espuma: junta perimetral + rodapé.',
    country: 'PT',
    trade: 'revetement_sol',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('rgeu'),
    hypothesesACommuniquer: [
      'Suporte: betonilha plana (< 2 mm / 2 m), seca (< 3% humidade)',
      'Subcapa de espuma 3 mm (isolamento acústico mínimo)',
      'Laminado AC4 click (classe 32 doméstico intenso)',
      'Junta perimetral 10 mm obrigatória (dilatação)',
      'Rodapé perimetral em MDF hidrófugo ou madeira',
      'Sentido de pose: perpendicular à entrada de luz',
    ],
    materials: [
      {
        id: 'subcapa-espuma-3-pt', name: 'Subcapa espuma 3 mm acústica',
        category: 'isolant', phase: 'preparation', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Sobreposição pequena',
        packaging: { unit: 'rouleau', contentQty: 15, contentUnit: 'm2', label: 'rolo 15 m²' },
      },
      {
        id: 'laminado-ac4-pt', name: 'Laminado AC4 click 8 mm',
        category: 'bois', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.07, wasteReason: 'Cortes final de fileira',
        manufacturerRef: 'Sonae Arauco / Egger / Quick-Step',
        packaging: { unit: 'panneau', contentQty: 2.2, contentUnit: 'm2', label: 'caixa 2,2 m²' },
      },
      {
        id: 'rodape-mdf-hidrofugo-pt', name: 'Rodapé MDF hidrófugo pintado branco',
        category: 'bois', phase: 'finitions', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.10, wasteReason: 'Cortes esquinas',
        manufacturerRef: 'Sonae Arauco',
      },
      {
        id: 'cantoneira-rodape-pt', name: 'Cantoneiras rodapé (internas + externas)',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 0.15, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Variante interna/externa',
      },
      {
        id: 'pregos-rodape-pt', name: 'Pregos / silicone fixação rodapé',
        category: 'fixation', phase: 'finitions', quantityPerBase: 0.2, unit: 'u',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.10, wasteReason: 'Perda colocação',
      },
    ],
  },
]
