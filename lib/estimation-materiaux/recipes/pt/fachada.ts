import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * FACHADA — recetas PT (escritas à mão, pt-PT).
 *
 * 5 obras de fachada portuguesa corrente :
 *  1. Reboco projetado monocamada (m²)
 *  2. Pintura de fachada (m²)
 *  3. Revestimento cerâmico exterior (m²)
 *  4. Fachada ventilada (m²)
 *  5. Reparação de fachada com reboco tradicional (m²)
 *
 * Referências : NP EN 998-1 (argamassas), NP EN 13914, RGEU.
 * Fabricantes : Weber PT, Secil Argamassas, Robbialac, CIN.
 */

export const fachadaRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. REBOCO PROJETADO MONOCAMADA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'reboco-projetado-monocamada-pt',
    name: 'Reboco projetado monocamada exterior',
    description: 'Reboco monocamada pré-doseado aplicado por projeção mecânica. Espessura 15-18 mm em 2 passagens. Acabamento raspado ou talochado.',
    country: 'PT',
    trade: 'facade',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('argamassas', 'rgeu'),
      { code: 'NP EN 13914 (2016)', title: 'Projeto e aplicação de rebocos exteriores e interiores' },
    ],
    hypothesesACommuniquer: [
      'Reboco monocamada pré-doseado ~22 kg/m² para espessura 15-18 mm',
      'Aplicação em 2 passagens próximas (húmido sobre húmido)',
      'Humidificação do suporte obrigatória antes da aplicação',
      'Cantoneiras PVC nos ângulos + perfil de arranque alumínio na base',
      'Rede de fibra de vidro obrigatória nas juntas entre materiais diferentes',
      'Consumo de água: ~4 L/m²',
    ],
    materials: [
      {
        id: 'reboco-monocamada-pt', name: 'Reboco monocamada pré-doseado (Weber PT / Secil)',
        category: 'enduit', phase: 'principal', quantityPerBase: 22, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Projeção + talocha',
        normRef: 'NP EN 998-1 (2017)', manufacturerRef: 'Weber PT (weber.rev classic) / Secil Argamassas (SecilTek)',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'agua-reboco-fachada-pt', name: 'Água de amassadura',
        category: 'eau', phase: 'principal', quantityPerBase: 4, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosagem precisa',
      },
      {
        id: 'cantoneira-pvc-fachada-pt', name: 'Cantoneiras PVC (ângulos + arestas)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.2, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'perfil-arranque-fachada-pt', name: 'Perfil de arranque alumínio (base fachada)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.3, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'rede-fibra-vidro-fachada-pt', name: 'Rede de fibra de vidro (juntas entre materiais)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.15, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sobreposições',
        optional: true, condition: 'Obrigatória se parede em materiais mistos (tijolo + betão)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. PINTURA DE FACHADA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'pintura-fachada-pt',
    name: 'Pintura de fachada exterior (tinta acrílica 2 demãos)',
    description: 'Pintura exterior de fachada sobre reboco existente: limpeza, primário fixador, 2 demãos de tinta acrílica elástica.',
    country: 'PT',
    trade: 'facade',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('pintura_interior', 'rgeu'),
      { code: 'NP EN 1062-1 (2004)', title: 'Tintas e vernizes — materiais de revestimento e sistemas para alvenaria e betão exteriores' },
    ],
    hypothesesACommuniquer: [
      'Limpeza prévia obrigatória (lavagem a pressão ou escovagem)',
      'Reparação pontual de fissuras com mástique acrílico',
      'Primário fixador sobre suporte existente (consolidação)',
      '2 demãos de tinta acrílica elástica para exterior',
      'Rendimento: ~0,20 L/m²/demão (tinta de qualidade)',
      'Tempo de secagem entre demãos: 4-6 horas (mín.)',
    ],
    materials: [
      {
        id: 'primario-fixador-fachada-pt', name: 'Primário fixador (consolidação suporte)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação rolo',
        manufacturerRef: 'Robbialac (Primário Universal) / CIN (Primário Fixador)',
        packaging: { unit: 'u', contentQty: 15, contentUnit: 'L', label: 'lata 15 L' },
      },
      {
        id: 'tinta-acrilica-exterior-pt', name: 'Tinta acrílica elástica para fachadas (2 demãos)',
        category: 'enduit', phase: 'principal', quantityPerBase: 0.40, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas rolo + absorção suporte',
        normRef: 'NP EN 1062-1 (2004)', manufacturerRef: 'Robbialac (Stucomat Plus) / CIN (CINelástico)',
        packaging: { unit: 'u', contentQty: 15, contentUnit: 'L', label: 'lata 15 L' },
        notes: '0,20 L/m²/demão × 2 demãos = 0,40 L/m².',
      },
      {
        id: 'mastique-acrilico-fissuras-pt', name: 'Mástique acrílico (reparação fissuras)',
        category: 'joint', phase: 'preparation', quantityPerBase: 0.02, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purga cartucho',
        manufacturerRef: 'Sika PT / Weber PT',
        packaging: { unit: 'cartouche', contentQty: 0.31, contentUnit: 'L', label: 'cartucho 310 ml' },
        optional: true, condition: 'Se fissuras existentes no reboco',
      },
      {
        id: 'fita-protecao-caixilhos-pt', name: 'Fita de proteção caixilharia (masking)',
        category: 'accessoire', phase: 'preparation', quantityPerBase: 0.3, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        notes: 'Proteção caixilhos, soleiras, peitoris.',
      },
      {
        id: 'rolo-fachada-pt', name: 'Rolo de pintura anti-gota 23 cm (consumível)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.01, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sem perdas',
        notes: '1 rolo por cada ~100 m².',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. REVESTIMENTO CERÂMICO EXTERIOR
  // ══════════════════════════════════════════════════════════════
  {
    id: 'revestimento-ceramico-exterior-pt',
    name: 'Revestimento cerâmico de fachada (azulejo colado)',
    description: 'Aplicação de azulejo/ladrilho cerâmico em fachada sobre reboco existente, com argamassa cola flexível C2TE.',
    country: 'PT',
    trade: 'facade',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('ceramicos_azulejos', 'argamassas', 'rgeu'),
      { code: 'NP EN 12004 (2017)', title: 'Colas para ladrilhos — definições e especificações' },
    ],
    hypothesesACommuniquer: [
      'Azulejo/ladrilho cerâmico formato médio (20×20 ou 30×30 cm)',
      'Argamassa cola flexível C2TE obrigatória para exterior (NP EN 12004)',
      'Colagem dupla (peça + suporte) para formato > 30×30 cm',
      'Junta mínima 3 mm (recomendado 5 mm para exterior)',
      'Juntas de dilatação estrutural a respeitar',
      'Betume de juntas flexível para exterior (classe CG2 WA)',
    ],
    materials: [
      {
        id: 'primario-ceramico-ext-pt', name: 'Primário de aderência (suporte rebocado)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação rolo',
        manufacturerRef: 'Weber PT / Sika PT',
      },
      {
        id: 'azulejo-ceramico-ext-pt', name: 'Azulejo/ladrilho cerâmico fachada (20×20 ou 30×30)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.05, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes + quebras',
        normRef: 'NP EN 14411 (2016)',
      },
      {
        id: 'argamassa-cola-c2te-pt', name: 'Argamassa cola flexível C2TE (exterior)',
        category: 'colle', phase: 'principal', quantityPerBase: 5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Resíduos',
        normRef: 'NP EN 12004 (2017)', manufacturerRef: 'Weber PT (weber.col flex) / Secil Argamassas',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'cruzetas-junta-ext-pt', name: 'Cruzetas de junta 5 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 8, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas',
        notes: '~8 cruzetas/m² para ladrilho 30×30 cm.',
      },
      {
        id: 'betume-juntas-cg2-pt', name: 'Betume de juntas flexível CG2 WA (exterior)',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Resíduos',
        manufacturerRef: 'Weber PT (weber.joint flex) / Secil Argamassas',
        packaging: { unit: 'sac', contentQty: 5, contentUnit: 'kg', label: 'saco 5 kg' },
      },
      {
        id: 'silicone-junta-dilatacao-pt', name: 'Silicone para juntas de dilatação',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.02, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purga cartucho',
        manufacturerRef: 'Sika PT / Weber PT',
        packaging: { unit: 'cartouche', contentQty: 0.31, contentUnit: 'L', label: 'cartucho 310 ml' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. FACHADA VENTILADA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'fachada-ventilada-pt',
    name: 'Fachada ventilada (subestrutura + placas cerâmicas/compósitas)',
    description: 'Sistema de fachada ventilada com subestrutura metálica, isolamento lã mineral e revestimento em placas cerâmicas ou compósitas.',
    country: 'PT',
    trade: 'facade',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('reh', 'rgeu'),
      { code: 'NP EN 13914 (2016)', title: 'Projeto e aplicação de rebocos — referência fachadas' },
      { code: 'ETA (Aprovação Técnica Europeia)', title: 'Sistema de fachada ventilada — aprovação por fabricante' },
    ],
    hypothesesACommuniquer: [
      'Subestrutura em alumínio ou aço inoxidável (consolas + montantes)',
      'Isolamento lã mineral 80 mm fixada mecanicamente (cavilhas)',
      'Caixa de ar ventilada 30-40 mm (ventilação natural ascendente)',
      'Revestimento: placas cerâmicas, fibrocimento, compósito alumínio ou pedra natural',
      'Fixação oculta ou visível (grampos inox)',
      'REH: solução de alto desempenho térmico (elimina pontes térmicas)',
      'Grelha anti-insetos na base e no topo da caixa de ar',
    ],
    materials: [
      {
        id: 'consola-fixacao-fv-pt', name: 'Consolas de fixação alumínio/inox (ancoragem parede)',
        category: 'ossature', phase: 'preparation', quantityPerBase: 3, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Posicionamento',
        notes: '3 consolas/m² (afastamento ≈ 60 cm vertical × 60 cm horizontal).',
      },
      {
        id: 'montante-alu-fv-pt', name: 'Montantes alumínio (perfis T ou L)',
        category: 'ossature', phase: 'preparation', quantityPerBase: 1.67, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        notes: 'Afastamento 60 cm → 1,67 ml/m².',
      },
      {
        id: 'la-mineral-80-fv-pt', name: 'Lã mineral 80 mm (isolamento térmico)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1.05, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        normRef: 'NP EN 13162 (2015)', manufacturerRef: 'Volcalis / Sotecnisol / Knauf Insulation',
      },
      {
        id: 'cavilha-isolante-fv-pt', name: 'Cavilhas de fixação isolante',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Quebras',
      },
      {
        id: 'placa-revestimento-fv-pt', name: 'Placas de revestimento (cerâmicas / compósitas)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.05, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.08, wasteReason: 'Cortes + quebras',
      },
      {
        id: 'grampo-fixacao-oculta-pt', name: 'Grampos de fixação oculta inox',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 8, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas',
        notes: '~8 grampos/m² (4 por placa 60×60 cm).',
      },
      {
        id: 'grelha-anti-insetos-fv-pt', name: 'Grelha anti-insetos (base + topo)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.3, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'perfil-arranque-fv-pt', name: 'Perfil de arranque / remate alumínio',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.25, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  5. REPARAÇÃO DE FACHADA — REBOCO TRADICIONAL
  // ══════════════════════════════════════════════════════════════
  {
    id: 'reparacao-fachada-reboco-pt',
    name: 'Reparação de fachada com reboco tradicional',
    description: 'Reparação de reboco exterior degradado: picagem do existente, regularização, reboco cimentício em 2 camadas + pintura.',
    country: 'PT',
    trade: 'facade',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('argamassas', 'rgeu'),
    hypothesesACommuniquer: [
      'Picagem do reboco existente degradado (manualmente ou com martelo)',
      'Limpeza e humidificação do suporte',
      'Reboco cimentício em 2 camadas: crespido (salpico) + massa grossa (12-15 mm)',
      'Consumo ~18 kg/m² total',
      'Pintura final NÃO incluída (a prever separadamente)',
      'Rede de reforço nos cantos de aberturas e juntas construtivas',
    ],
    materials: [
      {
        id: 'argamassa-reboco-rep-pt', name: 'Argamassa de reboco pré-doseada M5 (Weber PT / Secil)',
        category: 'enduit', phase: 'principal', quantityPerBase: 18, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Resíduos, projeção, reparação irregular',
        normRef: 'NP EN 998-1 (2017)', manufacturerRef: 'Weber PT (weber.rev) / Secil Argamassas',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'primario-consolidante-pt', name: 'Primário consolidante (suporte degradado)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.2, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação rolo/pincel',
        manufacturerRef: 'Weber PT / Robbialac',
        optional: true, condition: 'Aplicar em suporte muito degradado/friável',
      },
      {
        id: 'rede-reforco-cantos-pt', name: 'Rede de fibra de vidro (reforço cantos aberturas)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.2, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes, sobreposição',
      },
      {
        id: 'cantoneira-pvc-rep-pt', name: 'Cantoneiras PVC (restabelecimento arestas)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.15, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'agua-amassadura-fachada-pt', name: 'Água de amassadura',
        category: 'eau', phase: 'principal', quantityPerBase: 3.5, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosagem precisa',
      },
    ],
  },
]
