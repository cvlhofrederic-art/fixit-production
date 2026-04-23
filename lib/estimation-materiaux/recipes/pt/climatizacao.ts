import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * CLIMATIZAÇÃO — recetas PT (pt-PT).
 *
 * 4 obras de climatização portuguesa corrente :
 *  1. Ar condicionado split mural (u)
 *  2. Sistema multi-split (u)
 *  3. Piso radiante hidráulico (m²)
 *  4. Bomba de calor ar-água (u)
 *
 * Referências : REH (DL 118/2013), RECS, NP EN 14511, F-Gas (UE 517/2014).
 * Fabricantes : Daikin PT, Mitsubishi Electric PT, Samsung PT, Uponor PT.
 */

export const climatizacaoRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. AR CONDICIONADO SPLIT MURAL
  // ══════════════════════════════════════════════════════════════
  {
    id: 'split-mural-pt',
    name: 'Ar condicionado split mural (3,5 kW)',
    description: 'Unidade interior mural + unidade exterior + tubagem frigorífica + cabo de ligação + evacuação condensados.',
    country: 'PT',
    trade: 'climatisation',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: ptRefs('reh', 'bombas_calor', 'fgas'),
    hypothesesACommuniquer: [
      '1 u = 1 split mono (1 UI + 1 UE) para 1 divisão',
      'Potência 2,5 / 3,5 / 5 kW conforme volume da divisão',
      'Fluido R32 (desde 2020 — substitui R410A descontinuado)',
      'Tubagem frigorífica cobre isolado (ida + retorno): 5 ml standard',
      'Cabo de ligação 4 condutores + terra (entre UI e UE)',
      'Suporte mural UE (consolas anti-vibração)',
      'Tabuleiro evacuação condensados + tubo PVC',
      'Carotagem parede estanque para passagem',
      'Disjuntor dedicado 230 V no quadro elétrico',
      'Certificado F-Gas obrigatório após instalação',
    ],
    materials: [
      {
        id: 'ui-split-mural-pt', name: 'Unidade interior mural 3,5 kW R32',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Daikin PT / Mitsubishi Electric PT / Samsung PT',
      },
      {
        id: 'ue-split-pt', name: 'Unidade exterior 3,5 kW R32',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'tubagem-frigo-pt', name: 'Tubagem frigorífica cobre isolado (par pré-isolado)',
        category: 'plaque', phase: 'principal', quantityPerBase: 5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes + uniões',
      },
      {
        id: 'cabo-ligacao-clim-pt', name: 'Cabo de ligação (4 condutores + terra) entre UI e UE',
        category: 'plaque', phase: 'principal', quantityPerBase: 5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'suporte-mural-ue-pt', name: 'Suporte mural UE (consolas anti-vibração)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
      },
      {
        id: 'evacuacao-condensados-pt', name: 'Tabuleiro evacuação condensados + tubo PVC Ø32',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'passagem-parede-pt', name: 'Passagem parede estanque (carotagem + vedação)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
      },
      {
        id: 'disjuntor-clim-pt', name: 'Disjuntor dedicado (230 V no quadro) + cablagem',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. SISTEMA MULTI-SPLIT (3 divisões)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'multi-split-3-pt',
    name: 'Sistema multi-split (1 UE + 3 UI murais)',
    description: 'Sistema multi-split para 3 divisões: 1 unidade exterior + 3 unidades interiores murais + tubagens frigoríficas.',
    country: 'PT',
    trade: 'climatisation',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: ptRefs('reh', 'bombas_calor', 'fgas'),
    hypothesesACommuniquer: [
      '1 u = instalação multi-split completa (1 UE + 3 UI)',
      'UE potência 6–8 kW (conforme cargas térmicas das 3 divisões)',
      'UI murais 2,0–3,5 kW cada (conforme área/volume)',
      'Fluido R32 (certificação F-Gas obrigatória)',
      'Tubagens frigoríficas: média 8 ml por UI (ida + retorno)',
      'Derivação em Y (juntas refnet) para distribuição frigorífica',
      'Comando por infravermelhos individual por UI + controlo centralizado Wi-Fi',
      'Disjuntor dedicado 230 V no quadro elétrico (circuito único)',
    ],
    materials: [
      {
        id: 'ue-multi-split-pt', name: 'Unidade exterior multi-split 7 kW R32',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Daikin PT / Mitsubishi Electric PT / Samsung PT',
      },
      {
        id: 'ui-mural-multi-pt', name: 'Unidades interiores murais (2,5–3,5 kW)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Daikin PT / Mitsubishi Electric PT',
      },
      {
        id: 'tubagem-frigo-multi-pt', name: 'Tubagem frigorífica cobre isolado (total 3 circuitos)',
        category: 'plaque', phase: 'principal', quantityPerBase: 24, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes + uniões',
        notes: '~8 ml × 3 UI = 24 ml (ida + retorno).',
      },
      {
        id: 'cabo-ligacao-multi-pt', name: 'Cabo de ligação multi-split (4 cond. + terra)',
        category: 'plaque', phase: 'principal', quantityPerBase: 15, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        notes: '~5 ml × 3 UI = 15 ml.',
      },
      {
        id: 'juntas-refnet-pt', name: 'Juntas de derivação (refnet Y)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        notes: '4 juntas Y para derivar de 1 UE para 3 UI (2 liquid + 2 gas).',
      },
      {
        id: 'suporte-mural-ue-multi-pt', name: 'Suporte mural UE (consolas reforçadas)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
      },
      {
        id: 'evacuacao-condensados-multi-pt', name: 'Evacuação condensados PVC (3 UI)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 10, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'passagem-parede-multi-pt', name: 'Passagem parede estanque (3 carotagens)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'disjuntor-multi-pt', name: 'Disjuntor dedicado 230 V + cablagem',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. PISO RADIANTE HIDRÁULICO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'piso-radiante-pt',
    name: 'Piso radiante hidráulico (água quente)',
    description: 'Sistema de aquecimento por piso radiante: isolamento XPS, tubo PEX Ø16 em espiral, coletor, betonilha.',
    country: 'PT',
    trade: 'chauffage',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('reh', 'bombas_calor', 'tubagens_pex'),
    hypothesesACommuniquer: [
      'Isolamento base XPS 30 mm obrigatório (REH)',
      'Tubo PEX Ø16 em espiral, espaçamento 15 cm (6,7 ml/m²)',
      'Coletor de distribuição com caudalímetros (1 por cada ~20 m²)',
      'Betonilha de regularização 5 cm sobre tubo (NÃO incluída — ver receita betonilha)',
      'Temperatura máxima da água: 45 °C (conforto e eficiência REH)',
      'Faixa perimetral espuma PE obrigatória (dilatação térmica)',
      'Ensaio de pressão 6 bar durante 24 h antes de betonilhar',
      'Compatível com bomba de calor (baixa temperatura ideal)',
    ],
    materials: [
      {
        id: 'isolamento-xps-30-piso-pt', name: 'Isolamento XPS 30 mm (base piso radiante)',
        category: 'isolant', phase: 'preparation', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes + ajustes perímetro',
        normRef: 'NP EN 13164 (2015)',
        packaging: { unit: 'panneau', contentQty: 5, contentUnit: 'm2', label: 'placa 1250×600 mm (0,75 m²) — 5 placas/emb.' },
      },
      {
        id: 'pelicula-pe-piso-pt', name: 'Película PE anti-humidade (barreira vapor)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições 20 cm',
      },
      {
        id: 'tubo-pex-16-piso-pt', name: 'Tubo PEX Ø16 (espiral espaçamento 15 cm)',
        category: 'plaque', phase: 'principal', quantityPerBase: 6.7, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Ligações ao coletor',
        normRef: 'NP EN ISO 15875 (2005)', manufacturerRef: 'Uponor PT / Giacomini',
        packaging: { unit: 'rouleau', contentQty: 120, contentUnit: 'ml', label: 'rolo 120 m' },
      },
      {
        id: 'placas-fixacao-piso-pt', name: 'Placas de fixação com encaixes (nubs)',
        category: 'fixation', phase: 'principal', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes bordos',
        manufacturerRef: 'Uponor PT',
        packaging: { unit: 'u', contentQty: 1.12, contentUnit: 'm2', label: 'placa 1120×840 mm' },
      },
      {
        id: 'coletor-piso-radiante-pt', name: 'Coletor de distribuição com caudalímetros',
        category: 'accessoire', phase: 'principal', quantityPerBase: 0.06, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Uponor PT / Giacomini',
        notes: '1 coletor para ~17 m² (0,06 u/m², respeitar 120 m max por circuito).',
      },
      {
        id: 'faixa-perimetral-pt', name: 'Faixa perimetral espuma PE 10 mm × 150 mm',
        category: 'isolant', phase: 'preparation', quantityPerBase: 0.5, unit: 'ml', geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Cortes cantos',
        packaging: { unit: 'rouleau', contentQty: 50, contentUnit: 'ml', label: 'rolo 50 m' },
        notes: 'Quantidade escala com o perímetro da divisão.',
      },
      {
        id: 'aditivo-betonilha-piso-pt', name: 'Aditivo plastificante para betonilha (piso radiante)',
        category: 'adjuvant', phase: 'accessoires', quantityPerBase: 0.15, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Doseamento',
        manufacturerRef: 'Sika PT / Weber PT',
        notes: 'Melhora condutividade térmica e trabalhabilidade da betonilha.',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. BOMBA DE CALOR AR-ÁGUA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'bomba-calor-ar-agua-pt',
    name: 'Bomba de calor ar-água (aquecimento + AQS)',
    description: 'Bomba de calor monobloco ou split ar-água para aquecimento central e AQS. Depósito inércia + circuitos hidráulicos.',
    country: 'PT',
    trade: 'chauffage',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: ptRefs('reh', 'recs', 'bombas_calor', 'fgas'),
    hypothesesACommuniquer: [
      'Bomba de calor ar-água monobloco ou split (8–14 kW habitação T3–T5)',
      'COP ≥ 3,5 (conforme NP EN 14511 — condições A7/W35)',
      'Fluido R32 ou R290 (propano — nova geração F-Gas)',
      'Depósito de inércia 100–200 L (tampão para ciclos curtos)',
      'Depósito AQS 200–300 L com serpentina integrada',
      'Válvula de 3 vias para comutação aquecimento/AQS',
      'Vaso de expansão circuito fechado obrigatório',
      'Circulador de alta eficiência (classe A)',
      'Ligação elétrica trifásica ou monofásica conforme potência',
      'Certificação energética SCE obrigatória (DL 101-D/2020)',
    ],
    materials: [
      {
        id: 'bc-monobloco-pt', name: 'Bomba de calor ar-água monobloco 10 kW',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        normRef: 'NP EN 14511 (2018)', manufacturerRef: 'Daikin PT / Mitsubishi Electric PT',
      },
      {
        id: 'deposito-inercia-pt', name: 'Depósito de inércia 150 L',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'deposito-aqs-pt', name: 'Depósito AQS 200 L com serpentina',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'valvula-3-vias-pt', name: 'Válvula de 3 vias motorizada (comutação aquec./AQS)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'circulador-alta-ef-pt', name: 'Circulador de alta eficiência classe A',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        manufacturerRef: 'Grundfos / Wilo',
      },
      {
        id: 'vaso-expansao-pt', name: 'Vaso de expansão 18 L (circuito fechado)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'tubagem-cobre-28-pt', name: 'Tubagem cobre Ø28 mm (circuito primário)',
        category: 'plaque', phase: 'principal', quantityPerBase: 12, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes + curvas',
        normRef: 'NP EN 1057 (2017)',
        packaging: { unit: 'u', contentQty: 5, contentUnit: 'ml', label: 'vara 5 m' },
      },
      {
        id: 'isolamento-tubagem-pt', name: 'Isolamento Armaflex 19 mm (tubagem)',
        category: 'isolant', phase: 'accessoires', quantityPerBase: 12, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes + juntas',
        notes: 'Isolamento obrigatório REH para tubagens em zona não aquecida.',
      },
      {
        id: 'grupo-seguranca-bc-pt', name: 'Grupo de segurança (válvula + manómetro + purgador)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
      },
      {
        id: 'anticongelante-pt', name: 'Anticongelante propilenoglicol 30% (circuito)',
        category: 'adjuvant', phase: 'accessoires', quantityPerBase: 15, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Doseamento + purga',
        notes: 'Necessário em zonas com risco de geada (interior norte PT).',
        optional: true,
        condition: 'Se zona com risco de geada (Trás-os-Montes, Beira Interior)',
      },
    ],
  },
]
