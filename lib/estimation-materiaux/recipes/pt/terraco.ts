import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * TERRAÇO / DECK — recetas PT (escritas à mão, pt-PT).
 *
 * 3 obras de terraço / varanda :
 *  1. Terraço/deck em madeira (m²)
 *  2. Terraço em lajetas sobre plots (m²)
 *  3. Varanda com impermeabilização (m²)
 *
 * Referências : NP EN 335, NP EN 1338, LNEC E 244.
 * Fabricantes : Weber PT, Sika PT, Lusoceram, Imperalum.
 */

export const terracoRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. TERRAÇO / DECK EM MADEIRA TRATADA
  // ══════════════════════════════════════════════════════════════
  {
    id: 'terraco-deck-madeira-pt',
    name: 'Terraço/deck em madeira tratada autoclave (classe 3/4)',
    description: 'Pavimento exterior em tábuas de pinho autoclave classe 3 ou 4, sobre lambourdes e apoios reguláveis.',
    country: 'PT',
    trade: 'terrasse_ext',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('durabilidade_madeira'),
    hypothesesACommuniquer: [
      'Tábuas deck pinho autoclave cl.3/4 (14,5×2,1 cm)',
      'Lambourdes 4,5×7 cm — afastamento 40 cm (centro a centro)',
      'Apoios reguláveis (plots) sobre laje existente ou base preparada',
      'Parafusos inox A2 (resistência intempéries)',
      'Junta entre tábuas 5 mm (dilatação + drenagem)',
      'Tratamento com óleo/saturador na instalação e anualmente',
      'Pendente mínima 1,5% para escoamento (laje subjacente)',
    ],
    materials: [
      {
        id: 'tabua-deck-terraco-pt', name: 'Tábuas deck pinho autoclave 14,5×2,1 cm',
        category: 'bois', phase: 'principal', quantityPerBase: 7.5, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes, topos',
        normRef: 'NP EN 335 (2013)',
        notes: '~7,5 ml por m² (largura 14,5 cm + junta 5 mm)',
      },
      {
        id: 'lambourde-terraco-pt', name: 'Lambourdes pinho autoclave 4,5×7 cm',
        category: 'bois', phase: 'principal', quantityPerBase: 2.5, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        notes: '2,5 ml por m² (afastamento 40 cm)',
      },
      {
        id: 'plots-terraco-pt', name: 'Apoios reguláveis (plots) 40-70 mm',
        category: 'accessoire', phase: 'preparation', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Quebras',
        notes: '~4 plots por m²',
      },
      {
        id: 'parafusos-inox-terraco-pt', name: 'Parafusos inox A2 5×60 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 20, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Perdas',
      },
      {
        id: 'clips-fixacao-terraco-pt', name: 'Clips de fixação invisível (opcional)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 15, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Perdas',
        optional: true,
        condition: 'Fixação invisível (sem parafusos visíveis)',
      },
      {
        id: 'oleo-terraco-pt', name: 'Óleo saturador proteção UV (1ª demão)',
        category: 'adjuvant', phase: 'finitions', quantityPerBase: 0.15, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Absorção variável',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. TERRAÇO EM LAJETAS SOBRE PLOTS
  // ══════════════════════════════════════════════════════════════
  {
    id: 'terraco-lajetas-plots-pt',
    name: 'Terraço em lajetas de betão sobre plots reguláveis',
    description: 'Pavimento exterior sobre plots reguláveis com lajetas betão 60×60×4 cm. Solução elevada sem colagem.',
    country: 'PT',
    trade: 'terrasse_ext',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('blocos_betao_pavimento', 'impermeabilizacao'),
    hypothesesACommuniquer: [
      'Lajetas betão 60×60×4 cm (Lusoceram / Pavestone PT)',
      '~2,78 lajetas por m² (formato 60×60)',
      'Plots reguláveis 40-120 mm (ajuste pendente)',
      '~4 plots por m² (cruzamento de juntas)',
      'Laje subjacente impermeabilizada pressuposta (LNEC E 244)',
      'Junta aberta 3-5 mm (drenagem natural)',
      'Sem colagem — sistema desmontável e reparável',
    ],
    materials: [
      {
        id: 'lajeta-betao-60-pt', name: 'Lajetas betão 60×60×4 cm (superfície antiderrapante)',
        category: 'bloc', phase: 'principal', quantityPerBase: 2.78, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes periféricos',
        normRef: 'NP EN 1338 (2004)',
        manufacturerRef: 'Lusoceram / Pavestone PT',
        packaging: { unit: 'panneau', contentQty: 36, contentUnit: 'u', label: 'palete 36 u' },
      },
      {
        id: 'plots-regulaveis-terraco-pt', name: 'Plots reguláveis 40-120 mm',
        category: 'accessoire', phase: 'principal', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Quebras',
        notes: '~4 plots por m² (interseção de 4 lajetas)',
      },
      {
        id: 'cruzetas-plots-pt', name: 'Cruzetas espaçadoras (juntas)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas',
      },
      {
        id: 'geotextil-plots-pt', name: 'Geotêxtil 200 g/m² (proteção impermeabilização)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposição',
        notes: 'Proteção mecânica da membrana sob os plots',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'm2', label: 'rolo 50×2 m' },
      },
      {
        id: 'remate-periferico-pt', name: 'Perfil remate periférico alumínio',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 0.5, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        notes: 'Estimativa 0,5 ml por m² (perímetro variável)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. VARANDA COM IMPERMEABILIZAÇÃO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'varanda-impermeabilizacao-pt',
    name: 'Varanda com impermeabilização e revestimento cerâmico',
    description: 'Impermeabilização de varanda existente com membrana betuminosa, betonilha de pendente e revestimento cerâmico colado.',
    country: 'PT',
    trade: 'terrasse_ext',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('impermeabilizacao', 'membranas_betuminosas', 'ceramico_colado', 'ceramicos_azulejos'),
    hypothesesACommuniquer: [
      'Demolição revestimento existente pressuposta (NÃO incluída)',
      'Primário betuminoso sobre laje (aderência)',
      'Membrana betuminosa APP 3+4 kg/m² (dupla camada)',
      'Betonilha de pendente 2-3 cm (mín. 1,5% — LNEC E 244)',
      'Revestimento cerâmico antiderrapante R11 (NP EN 14411)',
      'Cola flexível C2TE S1 (exterior, deformável)',
      'Betumação com betume cimentício flexível',
      'Rufo/remate impermeável obrigatório no encontro com parede (h ≥ 15 cm)',
    ],
    materials: [
      {
        id: 'primario-betuminoso-pt', name: 'Primário betuminoso de aderência',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.3, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Aplicação rolo',
        manufacturerRef: 'Imperalum / Sika PT',
      },
      {
        id: 'membrana-betuminosa-pt', name: 'Membrana betuminosa APP 3+4 kg/m² (dupla camada)',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sobreposição 10 cm + rufos',
        normRef: 'NP EN 13707 (2013)',
        manufacturerRef: 'Imperalum / Sotecnisol',
      },
      {
        id: 'betonilha-pendente-pt', name: 'Betonilha de regularização/pendente (2,5 cm médio)',
        category: 'liant', phase: 'principal', quantityPerBase: 50, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Espessura variável',
        notes: '~50 kg/m² para 2,5 cm médio (argamassa pré-doseada)',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'ceramico-exterior-pt', name: 'Revestimento cerâmico antiderrapante R11',
        category: 'autre', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes, cantos',
        normRef: 'NP EN 14411 (2016)',
        manufacturerRef: 'Aleluia Cerâmicas / Revigrés',
      },
      {
        id: 'cola-exterior-pt', name: 'Cola cimentícia C2TE S1 (exterior flexível)',
        category: 'liant', phase: 'principal', quantityPerBase: 5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação',
        manufacturerRef: 'Weber PT (weber.col flex)',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'betume-cimenticio-pt', name: 'Betume cimentício flexível (juntas)',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação',
        manufacturerRef: 'Weber PT / Mapei',
      },
      {
        id: 'rufo-aluminio-pt', name: 'Rufo/remate alumínio (encontro parede)',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 0.5, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        notes: 'Estimativa 0,5 ml por m² (perímetro variável)',
      },
    ],
  },
]
