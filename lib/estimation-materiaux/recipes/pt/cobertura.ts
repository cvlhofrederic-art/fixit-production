import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * COBERTURA — recetas PT (escritas à mão, pt-PT).
 *
 * 5 obras de cobertura portuguesa corrente :
 *  1. Telhado em telha cerâmica Luso/Marselha (m²)
 *  2. Telhado em painel sandwich (m²)
 *  3. Cobertura plana acessível (m²)
 *  4. Reparação de telhado inclinado (m²)
 *  5. Telhado em telha de betão (m²)
 *
 * Referências : NP EN 1304, NP EN 14509, NP EN 490, RGEU.
 * Fabricantes : Umbelino Monteiro, CS Coelho da Silva, Preceram.
 */

export const coberturaRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. TELHADO EM TELHA CERÂMICA LUSO/MARSELHA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'telhado-telha-ceramica-luso-pt',
    name: 'Telhado em telha cerâmica Luso/Marselha',
    description: 'Cobertura inclinada em telha cerâmica tipo Luso ou Marselha. Ripas + contra-ripas + subtelha + telhas.',
    country: 'PT',
    trade: 'couverture',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('telhas_ceramicas', 'rgeu'),
      { code: 'NP EN 1304 (2014)', title: 'Telhas cerâmicas para coberturas inclinadas' },
    ],
    hypothesesACommuniquer: [
      'Telha Luso/Marselha — ~12 telhas/m² (Umbelino Monteiro / CS Coelho da Silva)',
      'Subtelha ondulada obrigatória (ventilação + estanquidade secundária)',
      'Ripas de madeira 4×5 cm tratada (classe 3 autoclave)',
      'Contra-ripas 3×5 cm sobre varas/caibros',
      'Fixação: 1 em cada 3 telhas em zona corrente, 100% em cumeeira e beirados',
      'Telhas de cumeeira + telhas de beirado a adicionar ao linear',
      'Inclinação mínima 30% (telha Luso)',
    ],
    materials: [
      {
        id: 'subtelha-ondulada-pt', name: 'Subtelha ondulada (Onduline / Umbelino)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições 15 cm',
        manufacturerRef: 'Onduline / Umbelino Monteiro',
        packaging: { unit: 'u', contentQty: 2.17, contentUnit: 'm2', label: 'placa 2,00×1,085 m' },
      },
      {
        id: 'ripa-madeira-4x5-pt', name: 'Ripas madeira tratada 4×5 cm (classe 3)',
        category: 'bois', phase: 'preparation', quantityPerBase: 3.3, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes + quebras',
        normRef: 'NP EN 14081',
        notes: 'Galga ≈ 30 cm → 3,3 ml/m².',
      },
      {
        id: 'contra-ripa-3x5-pt', name: 'Contra-ripas 3×5 cm (sobre caibros)',
        category: 'bois', phase: 'preparation', quantityPerBase: 1.67, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        notes: '1 contra-ripa por caibro (afastamento 60 cm).',
      },
      {
        id: 'prego-galvanizado-pt', name: 'Pregos galvanizados 3×50 (fixação ripas)',
        category: 'fixation', phase: 'preparation', quantityPerBase: 6, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas em obra',
      },
      {
        id: 'telha-luso-ceramica-pt', name: 'Telha cerâmica Luso/Marselha (Umbelino / CS Coelho)',
        category: 'plaque', phase: 'principal', quantityPerBase: 12, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Quebras transporte + cortes',
        normRef: 'NP EN 1304 (2014)', manufacturerRef: 'Umbelino Monteiro / CS Coelho da Silva',
        packaging: { unit: 'panneau', contentQty: 240, contentUnit: 'u', label: 'palete 240 telhas' },
      },
      {
        id: 'gancho-telha-inox-pt', name: 'Ganchos/grampos telha inox A2',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas em obra',
        notes: '1 em cada 3 telhas fixadas × 12/m² ≈ 4/m² (zona corrente).',
      },
      {
        id: 'telha-cumeeira-pt', name: 'Telha de cumeeira cerâmica',
        category: 'plaque', phase: 'accessoires', quantityPerBase: 0.1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        manufacturerRef: 'Umbelino Monteiro / CS Coelho da Silva',
        notes: '~2,5 telhas/ml cumeeira × 4 ml / 100 m² ≈ 0,1/m².',
      },
      {
        id: 'argamassa-cumeeira-pt', name: 'Argamassa de assentamento cumeeira',
        category: 'enduit', phase: 'accessoires', quantityPerBase: 0.5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Resíduos, mistura',
        manufacturerRef: 'Weber PT',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. TELHADO EM PAINEL SANDWICH
  // ══════════════════════════════════════════════════════════════
  {
    id: 'telhado-painel-sandwich-pt',
    name: 'Telhado em painel sandwich (poliuretano 40 mm)',
    description: 'Cobertura em painel sandwich metálico com núcleo PUR/PIR 40 mm. Aplicação rápida para habitação, armazéns, anexos.',
    country: 'PT',
    trade: 'couverture',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      { code: 'NP EN 14509 (2014)', title: 'Painéis sandwich autoportantes com isolamento — produtos de fábrica' },
      ...ptRefs('rgeu'),
    ],
    hypothesesACommuniquer: [
      'Painel sandwich 40 mm PUR/PIR (R ≈ 1,8 m²K/W)',
      'Chapa exterior pré-lacada 0,5 mm + interior 0,4 mm',
      'Fixação por parafusos auto-perfurantes + anilha EPDM: 6-8/m²',
      'Sobreposição lateral 1 onda (largura útil ≈ 1 m)',
      'Remate de cumeeira e beirado em chapa lacada',
      'Inclinação mínima 7% (recomendado 10%)',
    ],
    materials: [
      {
        id: 'painel-sandwich-40-pt', name: 'Painel sandwich PUR/PIR 40 mm (Preceram / Perfisa)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.05, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Sobreposições laterais',
        normRef: 'NP EN 14509 (2014)', manufacturerRef: 'Preceram / Perfisa / Heraklith',
      },
      {
        id: 'parafuso-auto-epdm-pt', name: 'Parafusos auto-perfurantes + anilha EPDM',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 7, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas',
      },
      {
        id: 'remate-cumeeira-chapa-pt', name: 'Remate de cumeeira em chapa lacada',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.1, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'remate-beirado-chapa-pt', name: 'Remate de beirado/empena em chapa lacada',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.15, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'fita-vedante-sandwich-pt', name: 'Fita vedante butílica (junta longitudinal)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.5, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'caleira-pvc-125-pt', name: 'Caleira PVC 125 mm (recolha águas pluviais)',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 0.15, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        optional: true, condition: 'Se não existir caleira prévia',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. COBERTURA PLANA ACESSÍVEL (terraço)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'cobertura-plana-acessivel-pt',
    name: 'Cobertura plana acessível (lajetas sobre plots)',
    description: 'Cobertura plana com impermeabilização bicamada, isolamento XPS e proteção por lajetas de betão sobre plots reguláveis.',
    country: 'PT',
    trade: 'couverture',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('impermeabilizacao', 'isolamento_xps', 'rgeu'),
      { code: 'LNEC ITE 34', title: 'Coeficientes de transmissão térmica de elementos da envolvente' },
    ],
    hypothesesACommuniquer: [
      'Complexo: primário + barreira pára-vapor + isolamento XPS 60 mm + membrana bicamada SBS + lajetas',
      'XPS 300 kPa (resistência à compressão para circulação pedonal)',
      'Membrana betuminosa bicamada SBS 4+4 mm',
      'Lajetas de betão 50×50 cm sobre plots PVC reguláveis',
      'Pendente mínima 1,5% para drenagem (RGEU)',
      'Remates periféricos em membrana: 15 cm acima do nível acabado',
    ],
    materials: [
      {
        id: 'primario-betuminoso-pt', name: 'Primário de aderência betuminoso',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.3, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação rolo',
        manufacturerRef: 'Imperalum / Sika PT',
        packaging: { unit: 'u', contentQty: 25, contentUnit: 'L', label: 'bidão 25 L' },
      },
      {
        id: 'barreira-vapor-pt', name: 'Barreira pára-vapor betuminosa SBS 3 mm',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições',
        manufacturerRef: 'Imperalum',
        packaging: { unit: 'rouleau', contentQty: 10, contentUnit: 'm2', label: 'rolo 10 m²' },
      },
      {
        id: 'xps-60-300kpa-pt', name: 'Isolamento XPS 60 mm (300 kPa)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1.05, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        normRef: 'NP EN 13164 (2015)', manufacturerRef: 'Volcalis / Ibershaco',
      },
      {
        id: 'membrana-sbs-4mm-pt', name: 'Membrana SBS 4 mm (1.ª camada)',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1.10, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições 10 cm + cortes',
        normRef: 'NP EN 13707 (2013)', manufacturerRef: 'Imperalum / Sotecnisol',
      },
      {
        id: 'membrana-sbs-autoprotegida-pt', name: 'Membrana SBS autoprotegida (2.ª camada)',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1.10, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições + cortes',
        manufacturerRef: 'Imperalum / Sotecnisol',
      },
      {
        id: 'plot-pvc-regulavel-pt', name: 'Plots PVC reguláveis (sob lajetas)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Quebras',
      },
      {
        id: 'lajeta-betao-50x50-pt', name: 'Lajetas de betão 50×50 cm',
        category: 'plaque', phase: 'principal', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Quebras',
      },
      {
        id: 'remate-periferico-membrana-pt', name: 'Remates periféricos membrana (esquadrias)',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 0.4, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes periféricos',
        notes: 'Remate 15 cm × perímetro ≈ 0,4 m²/m² (superfície quadrada padrão).',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. REPARAÇÃO DE TELHADO INCLINADO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'reparacao-telhado-pt',
    name: 'Reparação de telhado inclinado (substituição parcial telhas)',
    description: 'Reparação corrente de cobertura: substituição de telhas partidas, reparação de ripas, selagem de cumeeira.',
    country: 'PT',
    trade: 'couverture',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('telhas_ceramicas', 'rgeu'),
    hypothesesACommuniquer: [
      'Substituição de ~20% das telhas (partidas, deslocadas)',
      'Reparação pontual de ripas danificadas (~10%)',
      'Selagem de cumeeira com argamassa ou fita impermeabilizante',
      'Limpeza de musgos/líquenes com produto hidrófugo',
      'Verificação e desobstrução de caleiras',
      'Não inclui substituição de estrutura (asnas, varas)',
    ],
    materials: [
      {
        id: 'telha-substituicao-pt', name: 'Telhas cerâmicas de substituição (Luso/Marselha)',
        category: 'plaque', phase: 'principal', quantityPerBase: 2.5, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Quebras manipulação + adaptação modelo',
        normRef: 'NP EN 1304 (2014)', manufacturerRef: 'Umbelino Monteiro / CS Coelho da Silva',
        notes: '~20% de 12 telhas/m² = 2,4 u/m² (arredondado).',
      },
      {
        id: 'ripa-reparacao-pt', name: 'Ripas de madeira tratada 4×5 cm (reparação)',
        category: 'bois', phase: 'principal', quantityPerBase: 0.33, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Cortes adaptação',
        notes: '~10% de 3,3 ml/m² ≈ 0,33 ml/m².',
      },
      {
        id: 'argamassa-selagem-cumeeira-pt', name: 'Argamassa de selagem cumeeira',
        category: 'enduit', phase: 'principal', quantityPerBase: 0.3, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Resíduos',
        manufacturerRef: 'Weber PT',
      },
      {
        id: 'fita-impermeabilizante-cumeeira-pt', name: 'Fita impermeabilizante cumeeira (alu/butilo)',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 0.04, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições',
        packaging: { unit: 'rouleau', contentQty: 5, contentUnit: 'ml', label: 'rolo 5 ml × 30 cm' },
      },
      {
        id: 'hidrofugo-telhado-pt', name: 'Produto hidrófugo anti-musgo (pulverização)',
        category: 'adjuvant', phase: 'preparation', quantityPerBase: 0.15, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Pulverização',
        manufacturerRef: 'Sika PT / CIN',
        packaging: { unit: 'u', contentQty: 5, contentUnit: 'L', label: 'bidão 5 L' },
      },
      {
        id: 'prego-galva-reparacao-pt', name: 'Pregos galvanizados (fixação ripas reparação)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  5. TELHADO EM TELHA DE BETÃO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'telhado-telha-betao-pt',
    name: 'Telhado em telha de betão (Preceram / Coelho da Silva)',
    description: 'Cobertura inclinada em telha de betão, mais resistente ao transporte que cerâmica. Subtelha + ripas + telhas.',
    country: 'PT',
    trade: 'couverture',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('telhas_betao', 'rgeu'),
      { code: 'NP EN 490 (2012)', title: 'Telhas de betão para cobertura' },
    ],
    hypothesesACommuniquer: [
      'Telha de betão grande formato — ~10 telhas/m²',
      'Perdas 3% (mais resistente que cerâmica no transporte)',
      'Peso superior à telha cerâmica — verificar estrutura antes da instalação',
      'Subtelha + ripas + contra-ripas idênticas à cobertura cerâmica',
      'Inclinação mínima 25% com subtelha',
    ],
    materials: [
      {
        id: 'subtelha-ondulada-betao-pt', name: 'Subtelha ondulada',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições',
        manufacturerRef: 'Onduline',
      },
      {
        id: 'ripa-madeira-4x5-betao-pt', name: 'Ripas madeira tratada 4×5 cm',
        category: 'bois', phase: 'preparation', quantityPerBase: 2.85, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'contra-ripa-3x5-betao-pt', name: 'Contra-ripas 3×5 cm',
        category: 'bois', phase: 'preparation', quantityPerBase: 1.67, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'prego-galva-betao-pt', name: 'Pregos galvanizados 3×50',
        category: 'fixation', phase: 'preparation', quantityPerBase: 5.7, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas',
      },
      {
        id: 'telha-betao-pt', name: 'Telha de betão grande formato (Preceram / Coelho da Silva)',
        category: 'plaque', phase: 'principal', quantityPerBase: 10, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Quebras transporte (betão resistente)',
        normRef: 'NP EN 490 (2012)', manufacturerRef: 'Preceram / CS Coelho da Silva',
        packaging: { unit: 'panneau', contentQty: 240, contentUnit: 'u', label: 'palete 240 telhas' },
      },
      {
        id: 'gancho-telha-betao-pt', name: 'Ganchos telha inox A2',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 3.3, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas',
        notes: '1/3 das telhas fixadas × 10/m² ≈ 3,3/m².',
      },
    ],
  },
]
