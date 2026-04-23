import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * PAVIMENTOS — recetas PT (Lot Revêtements de sols — escritas à mão, pt-PT).
 *
 * 5 obras de pavimentos portuguesa corrente :
 *  1. Pavimento flutuante / laminado (m²)
 *  2. Pavimento vinílico em régua (m²)
 *  3. Soalho de madeira maciça pregado (m²)
 *  4. Betonilha autonivelante (m²)
 *  5. Rodapé para pavimentos (ml)
 *
 * Referências : NP EN 13329 (laminados), NP EN ISO 10582 (vinílicos),
 *               NP EN 13810 (subpavimentos secos), NP EN 13813 (betonilhas).
 * Fabricantes : Wicanders/Amorim, Revigrés, Tarkett PT, Quick-Step PT.
 */

export const pavimentosRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. PAVIMENTO FLUTUANTE / LAMINADO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'pavimento-laminado-pt',
    name: 'Pavimento flutuante laminado (Quick-Step / Wicanders)',
    description: 'Pavimento laminado em régua com encaixe click. Subcamada acústica + filme PE. Pose flutuante, perdas 8%.',
    country: 'PT',
    trade: 'revetements_sols',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      { code: 'NP EN 13329 (2016)', title: 'Pavimentos laminados — especificações, requisitos e métodos de ensaio' },
      { code: 'NP EN 13810-1 (2014)', title: 'Subpavimentos secos — propriedades e requisitos' },
    ],
    hypothesesACommuniquer: [
      'Réguas laminadas formato típico 1200×190 mm, espessura 8-12 mm',
      'Subcamada acústica em espuma PE 3 mm (ou cortiça 2 mm Wicanders)',
      'Filme polietileno barreira à humidade sob subcamada',
      'Perdas 8% (pose recta) — majorar para 12% em pose diagonal',
      'Juntas de dilatação perimetrais 8-10 mm',
      'Perfil de transição nas portas / junções com outros revestimentos',
    ],
    materials: [
      {
        id: 'filme-pe-pavimento-pt', name: 'Filme polietileno 200 μm (barreira humidade)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições 20 cm',
      },
      {
        id: 'subcamada-acustica-pt', name: 'Subcamada acústica espuma PE 3 mm (ou cortiça 2 mm)',
        category: 'isolant', phase: 'preparation', quantityPerBase: 1.05, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        manufacturerRef: 'Wicanders (cortiça) / Quick-Step (PE)',
        packaging: { unit: 'rouleau', contentQty: 15, contentUnit: 'm2', label: 'rolo 15 m²' },
      },
      {
        id: 'regua-laminada-pt', name: 'Réguas laminadas (Quick-Step / Wicanders / Tarkett)',
        category: 'bois', phase: 'principal', quantityPerBase: 1.08, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.08, wasteReason: 'Cortes (pose recta)',
        normRef: 'NP EN 13329 (2016)', manufacturerRef: 'Quick-Step / Wicanders / Tarkett',
        packaging: { unit: 'u', contentQty: 2.1, contentUnit: 'm2', label: 'caixa ~2,1 m²' },
      },
      {
        id: 'calco-dilatacao-pt', name: 'Calços de dilatação perimetrais',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 3, unit: 'u',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.00, wasteReason: 'Reutilizáveis',
      },
      {
        id: 'perfil-transicao-alu-pt', name: 'Perfil de transição alumínio (portas)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.1, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. PAVIMENTO VINÍLICO EM RÉGUA (LVT)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'pavimento-vinilico-lvt-pt',
    name: 'Pavimento vinílico LVT em régua (colado ou click)',
    description: 'Revêtement vinílico de luxe (LVT) em régua, colado ou encaixe click. Resistente à água.',
    country: 'PT',
    trade: 'revetements_sols',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      { code: 'NP EN ISO 10582 (2014)', title: 'Revestimentos de piso resilientes — revestimentos vinílicos heterogéneos' },
      { code: 'NP EN 13813 (2003)', title: 'Argamassas de betonilha — propriedades e requisitos' },
    ],
    hypothesesACommuniquer: [
      'Réguas LVT formato típico 1220×180 mm, espessura 4-5 mm',
      'Pose colada (cola acrílica) ou click (sem cola)',
      'Autonivelante obrigatório se planimetria suporte > 3 mm/2 m',
      'Primário de aderência antes do autonivelante',
      'Perdas 5-8% (pose recta)',
      'Adequado para casas de banho e cozinhas (impermeável)',
    ],
    materials: [
      {
        id: 'primario-aderencia-vinil-pt', name: 'Primário de aderência (antes autonivelante)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recipiente + resíduos',
        packaging: { unit: 'pot', contentQty: 5, contentUnit: 'L', label: 'bidão 5 L' },
      },
      {
        id: 'autonivelante-vinil-pt', name: 'Autonivelante cimentício (3 mm)',
        category: 'enduit', phase: 'preparation', quantityPerBase: 5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Resíduos, sobre-dosagem',
        manufacturerRef: 'Weber PT (weber.niv pro) / Mapei',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
        optional: true,
        condition: 'Se planimetria do suporte > 3 mm à régua de 2 m',
      },
      {
        id: 'regua-lvt-pt', name: 'Réguas LVT vinílicas (Tarkett / Wicanders / Revigrés)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.05, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes rives',
        normRef: 'NP EN ISO 10582 (2014)', manufacturerRef: 'Tarkett / Wicanders / Revigrés',
        packaging: { unit: 'u', contentQty: 2.2, contentUnit: 'm2', label: 'caixa ~2,2 m²' },
      },
      {
        id: 'cola-acrilica-vinil-pt', name: 'Cola acrílica para vinílico',
        category: 'colle', phase: 'principal', quantityPerBase: 0.35, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Resíduos espátula',
        packaging: { unit: 'u', contentQty: 15, contentUnit: 'kg', label: 'balde 15 kg' },
        optional: true,
        condition: 'Apenas se pose colada (não click)',
      },
      {
        id: 'perfil-transicao-vinil-pt', name: 'Perfil de transição (portas)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.1, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
      },
      {
        id: 'rodape-vinil-assortido-pt', name: 'Rodapé vinílico compatível (altura 6 cm)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1.1, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.10, wasteReason: 'Cortes em ângulo',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. SOALHO DE MADEIRA MACIÇA PREGADO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'soalho-madeira-macica-pt',
    name: 'Soalho de madeira maciça pregado em barrotes (pinho/carvalho)',
    description: 'Soalho tradicional português em tábuas de madeira maciça pregadas sobre barrotes. Envernizamento final.',
    country: 'PT',
    trade: 'revetements_sols',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      { code: 'NP EN 13226 (2009)', title: 'Pavimentos de madeira — elementos maciços com encaixe' },
      { code: 'NP EN 942 (2007)', title: 'Madeira para caixilharia — classificação da qualidade' },
      ...ptRefs('rgeu'),
    ],
    hypothesesACommuniquer: [
      'Barrotes de madeira 50×70 mm, entre-eixo 30-40 cm (~3 ml/m²)',
      'Isolamento acústico lã mineral 40 mm entre barrotes',
      'Tábuas de soalho maciço (pinho nacional ou carvalho)',
      'Espessura tábua 21 mm (standard soalho português)',
      'Perdas lâminas: 10% (cortes em extremidades)',
      'Envernizamento 2 demãos (manutenção a cada 10 anos)',
      'Alternativa: oleamento (aspecto natural, manutenção mais frequente)',
    ],
    materials: [
      {
        id: 'barrote-pinho-pt', name: 'Barrotes pinho tratado 50×70 mm (classe 2)',
        category: 'bois', phase: 'preparation', quantityPerBase: 3, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        normRef: 'NP EN 14081-1 (2016)',
      },
      {
        id: 'la-mineral-acustica-pt', name: 'Lã mineral acústica 40 mm (entre barrotes)',
        category: 'isolant', phase: 'preparation', quantityPerBase: 0.85, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Recortes',
        notes: 'Dedução ~15% da superfície dos barrotes',
      },
      {
        id: 'tabua-soalho-macico-pt', name: 'Tábuas soalho maciço pinho/carvalho 21 mm',
        category: 'bois', phase: 'principal', quantityPerBase: 1.10, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes em extremidades',
        manufacturerRef: 'Jular / Pinho de Leiria / Amorim',
      },
      {
        id: 'prego-soalho-pt', name: 'Pregos soalho sem cabeça 2,5×50 mm',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 12, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas',
      },
      {
        id: 'verniz-soalho-pt', name: 'Verniz poliuretano (ou óleo) 2 demãos',
        category: 'peinture', phase: 'finitions', quantityPerBase: 0.25, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recipiente + rolo',
        manufacturerRef: 'Bona / CIN / Robbialac',
        packaging: { unit: 'pot', contentQty: 5, contentUnit: 'L', label: 'lata 5 L' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. BETONILHA AUTONIVELANTE
  // ══════════════════════════════════════════════════════════════
  {
    id: 'betonilha-autonivelante-pt',
    name: 'Betonilha autonivelante (5 cm, antes revestimento)',
    description: 'Betonilha cimentícia autonivelante sobre laje, regularização de suporte para pavimento. Primário + argamassa fluida.',
    country: 'PT',
    trade: 'revetements_sols',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      { code: 'NP EN 13813 (2003)', title: 'Argamassas de betonilha — propriedades e requisitos' },
      ...ptRefs('argamassas', 'ceramico_colado'),
    ],
    hypothesesACommuniquer: [
      'Espessura standard 5 cm (mínimo 3 cm, máximo 8 cm)',
      'Primário de aderência obrigatório em suporte existente',
      'Argamassa autonivelante fluida (CT-C30-F5 conforme NP EN 13813)',
      'Junta perimetral em fita PE 5 mm (desolidarização)',
      'Tempo de secagem: 24-48 h para circulação, 28 dias para revestimento',
      'Consumo: ~22 kg/m² por cm de espessura',
    ],
    materials: [
      {
        id: 'primario-betonilha-pt', name: 'Primário de aderência (suporte existente)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.2, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recipiente + resíduos',
        manufacturerRef: 'Weber PT / Mapei',
      },
      {
        id: 'argamassa-autonivelante-pt', name: 'Argamassa autonivelante CT-C30-F5 (5 cm)',
        category: 'liant', phase: 'principal', quantityPerBase: 110, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Resíduos mistura, rebarba',
        normRef: 'NP EN 13813 (2003)', manufacturerRef: 'Weber PT (weber.niv pro) / Sika',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
        notes: '~22 kg/m² × 5 cm = 110 kg/m²',
      },
      {
        id: 'fita-perimetral-pe-pt', name: 'Fita perimetral mousse PE 5 mm (desolidarização)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Cortes',
      },
      {
        id: 'fibra-pp-betonilha-pt', name: 'Fibra polipropileno (anti-fissuração)',
        category: 'adjuvant', phase: 'principal', quantityPerBase: 0.6, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosagem exacta',
        optional: true,
        condition: 'Recomendado em áreas > 40 m² ou espessura > 6 cm',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  5. RODAPÉ PARA PAVIMENTOS
  // ══════════════════════════════════════════════════════════════
  {
    id: 'rodape-pavimento-pt',
    name: 'Rodapé MDF / madeira / PVC (perímetro divisão)',
    description: 'Rodapé de acabamento compatível com pavimento. Fixação colada + pregada.',
    country: 'PT',
    trade: 'revetements_sols',
    baseUnit: 'ml',
    geometryMode: 'length',
    version: '2.0.0',
    dtuReferences: ptRefs('rgeu'),
    hypothesesACommuniquer: [
      'Rodapé MDF lacado, madeira maciça ou PVC (altura 6-10 cm)',
      'Fixação: cola polímero + pregos sem cabeça',
      'Cantos cortados a 45° em obra ou ângulos pré-fabricados',
    ],
    materials: [
      {
        id: 'rodape-mdf-pav-pt', name: 'Rodapé MDF / madeira / PVC',
        category: 'bois', phase: 'principal', quantityPerBase: 1.10, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes em ângulo',
        manufacturerRef: 'Jular / Leroy Merlin PT',
      },
      {
        id: 'cola-polimero-rodape-pav-pt', name: 'Cola polímero (fixação)',
        category: 'colle', phase: 'accessoires', quantityPerBase: 0.03, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purga cartucho',
      },
      {
        id: 'prego-rodape-pav-pt', name: 'Pregos sem cabeça',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 2, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perdas',
      },
    ],
  },
]
