import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * PISCINA — recetas PT (escritas à mão, pt-PT).
 *
 * 4 obras de piscina :
 *  1. Piscina em betão armado 8×4 m (u)
 *  2. Revestimento em pastilha/mosaico (m²)
 *  3. Casa das máquinas (u)
 *  4. Deck em madeira tratada (m²)
 *
 * Referências : NP EN 16582, NP EN 206+A2, NP EN 335.
 * Fabricantes : Fluidra PT, Astralpool PT, Sika PT.
 */

export const piscinaRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. PISCINA EM BETÃO ARMADO 8×4×1,50 m
  // ══════════════════════════════════════════════════════════════
  {
    id: 'piscina-betao-armado-pt',
    name: 'Piscina em betão armado 8×4×1,50 m (estrutura completa)',
    description: 'Estrutura em betão armado C30/37 hidrófugo, armadura bi-nappe, equipamentos de filtração e segurança.',
    country: 'PT',
    trade: 'piscine',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: ptRefs('piscinas_domesticas', 'betao', 'betao_calculo'),
    hypothesesACommuniquer: [
      '1 unidade = piscina completa 8×4×1,50 m (48 m³ água)',
      'Betão C30/37 hidrófugo (NP EN 206+A2, classe XC2/XS1)',
      'Paredes e laje de fundo 20 cm, betão C30/37, ~15 m³',
      'Armadura bi-nappe HA ∅12 // 15: ~600 kg',
      'Impermeabilização obrigatória (revestimento final separado)',
      'Comunicação prévia à câmara municipal obrigatória (piscina > 10 m²)',
      'Dispositivo de segurança obrigatório (DL 65/97 — vedação ou cobertura)',
    ],
    materials: [
      {
        id: 'betao-c30-piscina-pt', name: 'Betão C30/37 hidrófugo (15 m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 15, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Betonagem, bombagem',
        normRef: 'NP EN 206+A2 (2021)',
        manufacturerRef: 'Secil / Cimpor (betão pronto)',
      },
      {
        id: 'armadura-ha12-piscina-pt', name: 'Armadura HA ∅12 bi-nappe (~600 kg)',
        category: 'acier', phase: 'principal', quantityPerBase: 600, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Cortes, sobreposições',
        normRef: 'NP EN 10080 (2008)',
      },
      {
        id: 'cofragem-piscina-pt', name: 'Cofragem (paredes + laje)',
        category: 'ossature', phase: 'principal', quantityPerBase: 75, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Reutilização parcial',
      },
      {
        id: 'bomba-filtracao-pt', name: 'Bomba de filtração + pré-filtro',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        manufacturerRef: 'Fluidra PT / Astralpool PT',
      },
      {
        id: 'filtro-areia-piscina-pt', name: 'Filtro de areia (ou cartucho)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        manufacturerRef: 'Astralpool PT',
      },
      {
        id: 'skimmer-piscina-pt', name: 'Skimmers (2 u)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 2, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
      },
      {
        id: 'bicos-retorno-pt', name: 'Bicos de retorno (2 u)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 2, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
      },
      {
        id: 'ralo-fundo-pt', name: 'Ralo de fundo',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
      },
      {
        id: 'projector-led-piscina-pt', name: 'Projectores LED subaquáticos (2 u)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        manufacturerRef: 'Fluidra PT',
      },
      {
        id: 'vedacao-seguranca-pt', name: 'Vedação/cobertura segurança OBRIGATÓRIA',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        normRef: 'DL 65/97 + NP EN 16582 (2017)',
        notes: 'Vedação h ≥ 1,10 m com portão auto-fechamento, ou cobertura de segurança.',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. REVESTIMENTO EM PASTILHA / MOSAICO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'revestimento-pastilha-piscina-pt',
    name: 'Revestimento interior piscina em pastilha/mosaico vítreo',
    description: 'Aplicação de pastilha vítrea 2,5×2,5 cm sobre betão hidrófugo, com cola flexível e betumação epóxi.',
    country: 'PT',
    trade: 'piscine',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('piscinas_domesticas', 'ceramicos_azulejos'),
    hypothesesACommuniquer: [
      'Pastilha vítrea 2,5×2,5 cm em folha 30×30 cm',
      'Superfície betão curado e regularizado (sem irregularidades > 2 mm)',
      'Cola cimentícia flexível classe C2TE S1 (deformável, piscinas)',
      'Betumação epóxi obrigatória (estanquidade, anti-cloro)',
      'Impermeabilização prévia recomendada (membrana cimentícia)',
      'Tempo de cura 14 dias antes de enchimento',
    ],
    materials: [
      {
        id: 'pastilha-vitrea-pt', name: 'Pastilha vítrea 2,5×2,5 cm (folha 30×30)',
        category: 'autre', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes, cantos, desperdício',
        normRef: 'NP EN 14411 (2016)',
      },
      {
        id: 'cola-flexivel-piscina-pt', name: 'Cola cimentícia C2TE S1 (piscinas)',
        category: 'liant', phase: 'principal', quantityPerBase: 5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação',
        manufacturerRef: 'Weber PT (weber.col flex) / Sika PT',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'betume-epoxi-piscina-pt', name: 'Betume epóxi (juntas, anti-cloro)',
        category: 'joint', phase: 'principal', quantityPerBase: 0.8, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação',
        manufacturerRef: 'Mapei / Sika PT',
      },
      {
        id: 'membrana-impermeab-piscina-pt', name: 'Membrana cimentícia impermeabilizante (2 demãos)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 2.5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Aplicação trincha',
        manufacturerRef: 'Sika PT (Sikalastic)',
      },
      {
        id: 'primario-piscina-pt', name: 'Primário de aderência',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.2, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Aplicação rolo',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. CASA DAS MÁQUINAS
  // ══════════════════════════════════════════════════════════════
  {
    id: 'casa-maquinas-piscina-pt',
    name: 'Casa das máquinas (compartimento técnico piscina)',
    description: 'Compartimento técnico em alvenaria ou pré-fabricado para alojar bomba, filtro, tratamento e quadro elétrico.',
    country: 'PT',
    trade: 'piscine',
    baseUnit: 'u',
    geometryMode: 'count',
    version: '2.0.0',
    dtuReferences: ptRefs('piscinas_domesticas', 'alvenaria_blocos', 'rtiebt'),
    hypothesesACommuniquer: [
      'Dimensão tipo 2,50×1,50×2,00 m (≈ 7,5 m³)',
      'Paredes em bloco betão 20 cm + reboco',
      'Laje cobertura betão ou fibrocimento',
      'Porta de acesso metálica ventilada',
      'Quadro elétrico dedicado com disjuntor diferencial 30 mA (RTIEBT)',
      'Ventilação natural obrigatória (grelhas)',
      'Proximidade máxima 15 m da piscina (perdas de carga)',
    ],
    materials: [
      {
        id: 'bloco-betao-casa-maq-pt', name: 'Blocos betão 20×20×40 (paredes)',
        category: 'bloc', phase: 'principal', quantityPerBase: 200, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Quebras',
        normRef: 'NP EN 771-3 (2016)',
        packaging: { unit: 'panneau', contentQty: 60, contentUnit: 'u', label: 'palete 60 u' },
      },
      {
        id: 'argamassa-casa-maq-pt', name: 'Argamassa M7,5 (assentamento + reboco)',
        category: 'enduit', phase: 'principal', quantityPerBase: 350, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Resíduos',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'betao-laje-casa-maq-pt', name: 'Betão C25/30 (laje cobertura, 0,5 m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 0.5, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Betonagem',
      },
      {
        id: 'porta-metalica-casa-maq-pt', name: 'Porta metálica ventilada 80×200',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
      },
      {
        id: 'quadro-eletrico-piscina-pt', name: 'Quadro elétrico dedicado (diferencial 30 mA)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perda',
        normRef: 'RTIEBT (Portaria 949-A/2006)',
      },
      {
        id: 'tubagem-pvc-piscina-pt', name: 'Tubagem PVC pressão ∅63 (ida + retorno)',
        category: 'plaque', phase: 'principal', quantityPerBase: 30, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        notes: '~15 m ida + 15 m retorno (distância tipo 12-15 m da piscina)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. DECK EM MADEIRA TRATADA (envolvente piscina)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'deck-madeira-piscina-pt',
    name: 'Deck em madeira tratada (envolvente piscina)',
    description: 'Pavimento em madeira pinho tratada classe 4 ou compósito, sobre lambourdes, para zona envolvente de piscina.',
    country: 'PT',
    trade: 'piscine',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('durabilidade_madeira', 'piscinas_domesticas'),
    hypothesesACommuniquer: [
      'Tábuas de deck 14,5×2,1 cm (pinho autoclave classe 4 ou compósito)',
      'Lambourdes 4,5×7 cm afastamento 40 cm (centro a centro)',
      'Apoios reguláveis (plots) ou base em betão',
      'Parafusos inox A2 (ambiente húmido / cloro)',
      'Acabamento anti-derrapante obrigatório (zona piscina)',
      'Tratamento com óleo ou saturador anual',
    ],
    materials: [
      {
        id: 'tabua-deck-pt', name: 'Tábuas deck pinho autoclave cl.4 (14,5×2,1 cm)',
        category: 'bois', phase: 'principal', quantityPerBase: 7.5, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes, emendas',
        normRef: 'NP EN 335 (2013)',
        notes: '~7,5 ml de tábua por m² (largura 14,5 cm + junta 5 mm)',
      },
      {
        id: 'lambourde-deck-pt', name: 'Lambourdes pinho autoclave 4,5×7 cm',
        category: 'bois', phase: 'principal', quantityPerBase: 2.5, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        notes: '2,5 ml por m² (afastamento 40 cm)',
      },
      {
        id: 'plots-deck-pt', name: 'Apoios reguláveis (plots) ou calços',
        category: 'accessoire', phase: 'preparation', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Quebras',
        notes: '~4 apoios por m²',
      },
      {
        id: 'parafusos-inox-deck-pt', name: 'Parafusos inox A2 5×60 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 20, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Perdas',
      },
      {
        id: 'oleo-saturador-deck-pt', name: 'Óleo saturador / acabamento (1ª demão)',
        category: 'adjuvant', phase: 'finitions', quantityPerBase: 0.15, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Absorção variável',
        notes: '~0,15 L/m² por demão (2 demãos recomendadas)',
      },
    ],
  },
]
