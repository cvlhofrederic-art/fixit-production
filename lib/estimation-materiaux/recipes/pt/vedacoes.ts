import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * VEDAÇÕES — recetas PT (escritas à mão, pt-PT).
 *
 * 4 obras de vedação / gradeamento :
 *  1. Muro em bloco de betão (m²)
 *  2. Vedação em rede/malha (ml)
 *  3. Portão de entrada (u)
 *  4. Gradeamento metálico (ml)
 *
 * Referências : NP EN 1090, NP EN 12859, NP EN 771-3.
 * Fabricantes : Bekaert PT, Metalogalva, Presdouro.
 */

export const vedacoesRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. MURO EM BLOCO DE BETÃO (vedação)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'muro-bloco-vedacao-pt',
    name: 'Muro de vedação em bloco de betão 20 cm (altura 1,80 m)',
    description: 'Muro de vedação de propriedade em bloco betão 20×20×40, com sapata corrida e pilares a cada 3 m.',
    country: 'PT',
    trade: 'cloture',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('alvenaria_blocos', 'argamassas', 'betao'),
    hypothesesACommuniquer: [
      'Blocos betão 20×20×40 cm vazios (Presdouro / Preceram)',
      '12,5 blocos por m²',
      'Sapata corrida 40×30 cm em betão armado (C25/30)',
      'Pilares BA 20×20 a cada 3 m (travamento)',
      'Capeamento superior em betão ou chapéu cerâmico',
      'Altura máx. 1,80 m sem projeto de estabilidade (RGEU)',
      'Reboco ou pintura das faces NÃO incluídos',
    ],
    materials: [
      {
        id: 'bloco-betao-vedacao-pt', name: 'Bloco betão 20×20×40 (Presdouro)',
        category: 'bloc', phase: 'principal', quantityPerBase: 12.5, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Quebras, cortes',
        normRef: 'NP EN 771-3 (2016)',
        manufacturerRef: 'Presdouro / Preceram',
        packaging: { unit: 'panneau', contentQty: 60, contentUnit: 'u', label: 'palete 60 u' },
      },
      {
        id: 'argamassa-vedacao-pt', name: 'Argamassa M7,5 (assentamento)',
        category: 'enduit', phase: 'principal', quantityPerBase: 20, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Resíduos',
        manufacturerRef: 'Weber PT',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'betao-sapata-vedacao-pt', name: 'Betão C25/30 (sapata corrida, 0,12 m³/ml)',
        category: 'liant', phase: 'preparation', quantityPerBase: 0.07, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Betonagem',
        notes: '0,12 m³/ml sapata ÷ 1,80 m altura ≈ 0,07 m³/m²',
      },
      {
        id: 'armadura-pilar-vedacao-pt', name: 'Varão HA ∅10 (pilares + sapata)',
        category: 'acier', phase: 'principal', quantityPerBase: 1.5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Cortes, amarrações',
        normRef: 'NP EN 10080 (2008)',
      },
      {
        id: 'capeamento-vedacao-pt', name: 'Capeamento betão / chapéu cerâmico',
        category: 'bloc', phase: 'finitions', quantityPerBase: 0.55, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        notes: '~0,55 ml de capeamento por m² (1 ml / 1,80 m altura)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. VEDAÇÃO EM REDE / MALHA PLASTIFICADA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'vedacao-rede-malha-pt',
    name: 'Vedação em rede plastificada (h = 1,50 m)',
    description: 'Vedação económica em rede de arame plastificado verde sobre postes metálicos galvanizados.',
    country: 'PT',
    trade: 'cloture',
    baseUnit: 'ml',
    geometryMode: 'length',
    version: '2.0.0',
    dtuReferences: ptRefs('estruturas_aco'),
    hypothesesACommuniquer: [
      'Rede arame plastificado verde, malha 50×50 mm, fio ∅2,5 mm',
      'Altura 1,50 m (vedação residencial)',
      'Postes metálicos galvanizados ∅48 mm a cada 2,50 m',
      'Dados betão 30×30×40 cm (fundação postes)',
      'Arames de tensão 3 linhas (superior, central, inferior)',
      'Tirantes e tensores nas extremidades e cantos',
    ],
    materials: [
      {
        id: 'rede-plastificada-pt', name: 'Rede arame plastificado verde h = 1,50 m',
        category: 'acier', phase: 'principal', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Sobreposição',
        manufacturerRef: 'Bekaert PT / Sodimetal',
        packaging: { unit: 'rouleau', contentQty: 25, contentUnit: 'ml', label: 'rolo 25 ml' },
      },
      {
        id: 'poste-galvanizado-pt', name: 'Poste galvanizado ∅48 mm × 2,00 m',
        category: 'ossature', phase: 'principal', quantityPerBase: 0.4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        notes: '1 poste a cada 2,50 m (0,4/ml)',
      },
      {
        id: 'betao-dado-vedacao-pt', name: 'Betão C20/25 (dado fundação 30×30×40)',
        category: 'liant', phase: 'preparation', quantityPerBase: 0.015, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Betonagem',
        notes: '0,036 m³ por dado × 0,4 postes/ml ≈ 0,015 m³/ml',
      },
      {
        id: 'arame-tensao-pt', name: 'Arame de tensão galvanizado ∅2,7 mm (3 linhas)',
        category: 'acier', phase: 'principal', quantityPerBase: 3, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Tensionamento',
      },
      {
        id: 'tensores-vedacao-pt', name: 'Tensores e tirantes (extremidades)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.08, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        notes: '~1 conjunto por 12 ml',
      },
      {
        id: 'agrafos-fixacao-pt', name: 'Agrafos de fixação rede/poste',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 3, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. PORTÃO DE ENTRADA (batente duplo)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'portao-entrada-pt',
    name: 'Portão de entrada batente duplo (3,00×1,80 m)',
    description: 'Portão de duas folhas em aço galvanizado lacado, com pilares de alvenaria, automação opcional.',
    country: 'PT',
    trade: 'cloture',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: ptRefs('estruturas_aco', 'betao'),
    hypothesesACommuniquer: [
      'Portão 2 folhas 1,50×1,80 m cada (vão total 3,00 m)',
      'Estrutura tubo aço 60×40 mm galvanizado + lacado',
      'Enchimento chapa, barras ou grelha (a definir)',
      'Pilares alvenaria 40×40 cm com chumbadouros',
      'Dobradiças reguláveis aço inox',
      'Fechadura cilindro europeu + trinco magnético',
      'Automação (motor enterrado ou braço) opcional',
    ],
    materials: [
      {
        id: 'portao-aco-2f-pt', name: 'Portão 2 folhas aço galv. lacado 3,00×1,80 m',
        category: 'ossature', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        normRef: 'NP EN 1090-2 (2012)',
        manufacturerRef: 'Metalogalva / serralharia local',
      },
      {
        id: 'pilar-portao-pt', name: 'Pilares alvenaria 40×40 cm (2 u, c/ chumbadouros)',
        category: 'bloc', phase: 'preparation', quantityPerBase: 2, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        notes: 'Bloco betão 40×40 cm, armação HA ∅12, betão C25/30',
      },
      {
        id: 'betao-pilares-portao-pt', name: 'Betão C25/30 (2 pilares, ~0,30 m³)',
        category: 'liant', phase: 'preparation', quantityPerBase: 0.30, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Betonagem',
      },
      {
        id: 'dobradicas-portao-pt', name: 'Dobradiças reguláveis inox (4 u)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
      },
      {
        id: 'fechadura-portao-pt', name: 'Fechadura cilindro europeu + trinco',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
      },
      {
        id: 'motor-portao-pt', name: 'Motor automatização (braço ou enterrado)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        optional: true,
        condition: 'Automatização do portão (comando remoto)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. GRADEAMENTO METÁLICO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'gradeamento-metalico-pt',
    name: 'Gradeamento metálico em ferro forjado / aço (h = 1,20 m)',
    description: 'Gradeamento em aço lacado para varandas, muros ou escadas, com prumos e travessas horizontais.',
    country: 'PT',
    trade: 'cloture',
    baseUnit: 'ml',
    geometryMode: 'length',
    version: '2.0.0',
    dtuReferences: ptRefs('estruturas_aco'),
    hypothesesACommuniquer: [
      'Altura 1,20 m (regulamentar para guarda-corpo — RGEU)',
      'Prumos tubo 40×40 mm a cada 1,20 m',
      'Travessas horizontais ou barras verticais (afastamento ≤ 11 cm)',
      'Aço S235 galvanizado + lacado (RAL a definir)',
      'Fixação por chumbadouros químicos ou platinas',
      'Espaçamento barras ≤ 11 cm (segurança crianças — RGEU)',
    ],
    materials: [
      {
        id: 'gradeamento-aco-pt', name: 'Gradeamento aço galv. lacado h = 1,20 m',
        category: 'ossature', phase: 'principal', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Ajustes comprimento',
        normRef: 'NP EN 1090-2 (2012)',
        manufacturerRef: 'Metalogalva / serralharia local',
      },
      {
        id: 'prumo-gradeamento-pt', name: 'Prumos tubo 40×40 mm (1 a cada 1,20 m)',
        category: 'ossature', phase: 'principal', quantityPerBase: 0.83, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        notes: '1 prumo a cada 1,20 m (0,83/ml)',
      },
      {
        id: 'platina-fixacao-pt', name: 'Platina de fixação (por prumo)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.83, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
      },
      {
        id: 'chumbadores-quimicos-pt', name: 'Chumbadouros químicos (2 por prumo)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1.66, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Perdas',
        manufacturerRef: 'Hilti / Fischer',
      },
      {
        id: 'tinta-retoques-pt', name: 'Tinta de retoque RAL (spray)',
        category: 'adjuvant', phase: 'finitions', quantityPerBase: 0.02, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Pulverização',
        notes: 'Retoque em soldaduras e fixações após montagem',
      },
    ],
  },
]
