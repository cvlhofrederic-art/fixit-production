import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * IMPERMEABILIZAÇÃO — recetas PT (escritas à mão, pt-PT).
 *
 * 5 obras de impermeabilização portuguesa corrente :
 *  1. Impermeabilização de cobertura plana (m²)
 *  2. Impermeabilização de terraço (m²)
 *  3. Impermeabilização de cave/fundações (m²)
 *  4. Impermeabilização de casa de banho (m²)
 *  5. Impermeabilização de varanda/marquise (m²)
 *
 * Referências : NP EN 13707, NP EN 13969, LNEC ITE 34, LNEC E 244.
 * Fabricantes : Sika PT, Imperalum, Sotecnisol, Weber PT.
 */

export const impermeabilizacaoRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. IMPERMEABILIZAÇÃO DE COBERTURA PLANA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'impermeabilizacao-cobertura-plana-pt',
    name: 'Impermeabilização de cobertura plana (bicamada SBS)',
    description: 'Complexo impermeabilizante para cobertura plana não acessível: primário + barreira pára-vapor + membrana bicamada SBS autoprotegida.',
    country: 'PT',
    trade: 'etancheite',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('membranas_betuminosas', 'impermeabilizacao'),
      { code: 'LNEC ITE 34', title: 'Coeficientes de transmissão térmica de elementos da envolvente' },
    ],
    hypothesesACommuniquer: [
      'Complexo standard: primário + barreira pára-vapor + membrana bicamada SBS 4+4 mm',
      'Remates de impermeabilização 15 cm em toda a periferia (obrigatório)',
      'Rufo metálico no perímetro (+ ralo pluvial nas saídas de água)',
      'Autoprotecção por granulado mineral na camada superior',
      'Pendente mínima 1,5% (RGEU)',
    ],
    materials: [
      {
        id: 'primario-betuminoso-cob-pt', name: 'Primário de aderência betuminoso',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.3, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação rolo',
        manufacturerRef: 'Imperalum / Sika PT',
        packaging: { unit: 'u', contentQty: 25, contentUnit: 'L', label: 'bidão 25 L' },
      },
      {
        id: 'barreira-vapor-cob-pt', name: 'Barreira pára-vapor SBS 3 mm',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições 10 cm',
        manufacturerRef: 'Imperalum',
        packaging: { unit: 'rouleau', contentQty: 13, contentUnit: 'm2', label: 'rolo 13 m²' },
      },
      {
        id: 'membrana-sbs-4mm-cob-pt', name: 'Membrana SBS 4 mm (1.ª camada)',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1.10, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições 10 cm + cortes',
        normRef: 'NP EN 13707 (2013)', manufacturerRef: 'Imperalum / Sotecnisol',
      },
      {
        id: 'membrana-sbs-autoprotegida-cob-pt', name: 'Membrana SBS autoprotegida granulado (2.ª camada)',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1.10, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições + cortes',
        manufacturerRef: 'Imperalum / Sotecnisol',
      },
      {
        id: 'remate-impermeabilizacao-pt', name: 'Remates periféricos (esquadrias + moletes)',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 0.5, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes periféricos',
        notes: 'Remate 15 cm × perímetro ≈ 0,5 m²/m² (superfície quadrada padrão).',
      },
      {
        id: 'rufo-metalico-cob-pt', name: 'Rufo metálico (perímetro cobertura)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.5, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'ralo-pluvial-pt', name: 'Ralo pluvial (saída de água)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.02, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        notes: '1 ralo por cada 50 m² aprox.',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. IMPERMEABILIZAÇÃO DE TERRAÇO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'impermeabilizacao-terraco-pt',
    name: 'Impermeabilização de terraço acessível (membrana líquida)',
    description: 'Impermeabilização de terraço/varanda com membrana líquida poliuretânica, proteção por revestimento cerâmico.',
    country: 'PT',
    trade: 'etancheite',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('impermeabilizacao', 'rgeu'),
      { code: 'NP EN 13707 (2013)', title: 'Membranas betuminosas armadas para impermeabilização' },
    ],
    hypothesesACommuniquer: [
      'Membrana líquida poliuretânica bicomponente (Sika / Weber)',
      'Primário de aderência obrigatório sobre betão',
      'Banda armada nas juntas muro/pavimento',
      'Remate 15 cm nos muros adjacentes',
      'Proteção mecânica: betonilha armada ou revestimento cerâmico direto (sistema aprovado)',
      'Pendente mínima 1,5% para escoamento',
    ],
    materials: [
      {
        id: 'primario-terraco-pt', name: 'Primário de aderência (betão)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação rolo',
        manufacturerRef: 'Sika PT / Weber PT',
      },
      {
        id: 'membrana-liquida-pu-pt', name: 'Membrana líquida poliuretânica bicomponente',
        category: 'etancheite', phase: 'principal', quantityPerBase: 2.52, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Balde + sobre-dosagem',
        manufacturerRef: 'Sika PT (Sikalastic 625) / Weber PT (weber.dry UV)',
        packaging: { unit: 'u', contentQty: 18.9, contentUnit: 'kg', label: 'balde 18,9 kg (15 L)' },
      },
      {
        id: 'banda-armada-juntas-pt', name: 'Banda armada fibra (juntas muro/pavimento)',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Cortes cantos',
      },
      {
        id: 'malha-reforco-pu-pt', name: 'Malha de reforço (incorporada na membrana)',
        category: 'fixation', phase: 'principal', quantityPerBase: 1.10, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições',
      },
      {
        id: 'manguito-dreno-pt', name: 'Manguitos para ralos/tubagens',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        notes: '~0,1 manguito/m² (1 ralo + 1-2 tubagens por 15-20 m²).',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. IMPERMEABILIZAÇÃO DE CAVE / FUNDAÇÕES
  // ══════════════════════════════════════════════════════════════
  {
    id: 'impermeabilizacao-cave-pt',
    name: 'Impermeabilização de cave e fundações (revestimento pelicular)',
    description: 'Impermeabilização de paredes enterradas por revestimento pelicular cimentício + drenagem periférica.',
    country: 'PT',
    trade: 'etancheite',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      { code: 'NP EN 13969 (2006)', title: 'Membranas flexíveis para impermeabilização — abaixo do nível do solo' },
      ...ptRefs('rgeu'),
    ],
    hypothesesACommuniquer: [
      'Revestimento pelicular cimentício elástico (Weber PT / Sika PT) ≈ 3 kg/m²',
      'Alternativa: membrana betuminosa colada a quente',
      'Drenagem periférica obrigatória (tubo drenante + brita + geotêxtil)',
      'Hidrófugo de massa no betão opcional (nível freático alto)',
      'Geomembrana nodular (tipo Delta MS) como proteção mecânica',
    ],
    materials: [
      {
        id: 'rev-pelicular-cimenticio-pt', name: 'Revestimento pelicular cimentício elástico',
        category: 'etancheite', phase: 'principal', quantityPerBase: 3, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Talocha + sobre-dosagem',
        normRef: 'NP EN 13969 (2006)', manufacturerRef: 'Weber PT (weber.dry enduit) / Sika PT (Igasol)',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'geomembrana-nodular-pt', name: 'Geomembrana nodular (proteção mecânica)',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1.10, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições',
        manufacturerRef: 'Imperalum / Sotecnisol',
        notes: 'Tipo Delta MS — protege a impermeabilização contra remblais.',
      },
      {
        id: 'tubo-drenante-100-pt', name: 'Tubo drenante PVC Ø100 perfurado',
        category: 'accessoire', phase: 'principal', quantityPerBase: 0.5, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        notes: '0,5 ml de tubo drenante por m² de parede (perímetro / superfície).',
      },
      {
        id: 'brita-drenante-15-25-pt', name: 'Brita drenante 15/25',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.03, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Assentamento',
        notes: 'Vala 30×30 cm → 0,03 m³ por ml × 0,5 ml/m².',
      },
      {
        id: 'geotextil-drenagem-pt', name: 'Geotêxtil 200 g/m² (envolvimento dreno)',
        category: 'etancheite', phase: 'principal', quantityPerBase: 0.5, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições',
      },
      {
        id: 'hidrofugo-massa-pt', name: 'Hidrófugo de massa (betão paredes)',
        category: 'adjuvant', phase: 'preparation', quantityPerBase: 0.5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosagem precisa',
        manufacturerRef: 'Sika PT (Sika 1)',
        optional: true, condition: 'Se nível freático permanente ou zona muito húmida',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. IMPERMEABILIZAÇÃO DE CASA DE BANHO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'impermeabilizacao-wc-pt',
    name: 'Impermeabilização de casa de banho (sistema sob cerâmico)',
    description: 'Membrana líquida bicomponente sob revestimento cerâmico. Obrigatória em base de duche e envolvente de banheira.',
    country: 'PT',
    trade: 'etancheite',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('impermeabilizacao', 'ceramicos_azulejos'),
      { code: 'LNEC ITE 34', title: 'Coeficientes de transmissão térmica — referência técnica' },
    ],
    hypothesesACommuniquer: [
      'Resina líquida bicomponente OU manta impermeabilizante pré-colada',
      'Banda de reforço armada obrigatória em todas as junções pavimento/parede',
      'Manguito para ralo + manguitos para tubagens',
      'Remate 20 cm em paredes adjacentes (duche: toda a altura molhada)',
      'Obrigatório para: base de duche, envolvente banheira, pavimento WC',
    ],
    materials: [
      {
        id: 'primario-wc-pt', name: 'Primário de aderência (suporte cimentício)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação rolo',
        manufacturerRef: 'Weber PT / Sika PT',
      },
      {
        id: 'membrana-liquida-wc-pt', name: 'Membrana líquida bicomponente (sob cerâmico)',
        category: 'etancheite', phase: 'principal', quantityPerBase: 3, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Balde + sobre-dosagem',
        manufacturerRef: 'Weber PT (weberdry 824) / Sika PT (Sika Sanisol)',
        packaging: { unit: 'u', contentQty: 5, contentUnit: 'kg', label: 'saco 5 kg' },
      },
      {
        id: 'banda-armada-wc-pt', name: 'Banda de reforço armada (junções pavimento/parede)',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Cortes cantos',
      },
      {
        id: 'manguito-ralo-wc-pt', name: 'Manguitos ralo + tubagens',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.3, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        notes: '~0,3 manguito/m² (1 ralo + 1-2 tubagens por zona húmida).',
      },
      {
        id: 'canto-pre-formado-wc-pt', name: 'Cantos pré-formados (ângulos internos)',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 0.2, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        notes: '~4 cantos por WC standard (5 m²) → 0,2/m².',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  5. IMPERMEABILIZAÇÃO DE VARANDA / MARQUISE
  // ══════════════════════════════════════════════════════════════
  {
    id: 'impermeabilizacao-varanda-pt',
    name: 'Impermeabilização de varanda/marquise (membrana betuminosa)',
    description: 'Impermeabilização de varanda ou marquise existente com membrana betuminosa monocamada + proteção cerâmica.',
    country: 'PT',
    trade: 'etancheite',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('membranas_betuminosas', 'impermeabilizacao', 'rgeu'),
    hypothesesACommuniquer: [
      'Membrana betuminosa SBS monocamada 4 mm (autoprotegida ou com proteção cerâmica)',
      'Primário betuminoso obrigatório sobre betão',
      'Remate 10 cm na soleira/peitoril',
      'Pendente mínima 1,5% para escoamento',
      'Gárgula ou tubo de queda para evacuação de águas',
    ],
    materials: [
      {
        id: 'primario-varanda-pt', name: 'Primário betuminoso (aderência sobre betão)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.3, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação rolo',
        manufacturerRef: 'Imperalum / Sotecnisol',
      },
      {
        id: 'membrana-sbs-monocamada-pt', name: 'Membrana SBS monocamada 4 mm',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1.10, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições 10 cm + cortes',
        normRef: 'NP EN 13707 (2013)', manufacturerRef: 'Imperalum / Sotecnisol',
        packaging: { unit: 'rouleau', contentQty: 10, contentUnit: 'm2', label: 'rolo 10 m²' },
      },
      {
        id: 'remate-soleira-pt', name: 'Remate impermeabilização soleira/peitoril',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 0.3, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'argamassa-cola-exterior-pt', name: 'Argamassa cola flexível C2TE (colagem cerâmico)',
        category: 'colle', phase: 'principal', quantityPerBase: 5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Resíduos',
        manufacturerRef: 'Weber PT (weber.col flex) / Sika PT',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
        optional: true, condition: 'Se proteção por cerâmico (não autoprotegida)',
      },
      {
        id: 'gargula-varanda-pt', name: 'Gárgula/tubo de queda (evacuação águas)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        notes: '1 gárgula por varanda (~10 m²) → 0,1/m².',
      },
    ],
  },
]
