import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * AZULEJO / CERÂMICO — recetas PT (Lot Carrelage — escritas à mão, pt-PT).
 *
 * 5 obras de revestimento cerâmico português corrente :
 *  1. Revestimento cerâmico de parede (azulejo 20×20) (m²)
 *  2. Pavimento cerâmico colado (grés porcelânico 60×60) (m²)
 *  3. Mosaico hidráulico (m²)
 *  4. Pedra natural (mármore / granito) (m²)
 *  5. Azulejo de fachada exterior (m²)
 *
 * Referências : NP EN 14411 (azulejos), NP EN 12004 (colas),
 *               NP EN 13888 (betumes/juntas), NP EN 13813 (betonilhas).
 * Fabricantes : Aleluia Cerâmicas, Revigrés, Margres, Weber PT (colas).
 */

export const azulejoRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. REVESTIMENTO CERÂMICO DE PAREDE (AZULEJO 20×20)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'azulejo-parede-20-pt',
    name: 'Azulejo de parede 20×20 cm (casa de banho / cozinha)',
    description: 'Azulejo cerâmico formato pequeno para revestimento mural. Colagem simples peigne U6. SPEC em zonas húmidas.',
    country: 'PT',
    trade: 'carrelage',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    version: '2.0.0',
    dtuReferences: [
      { code: 'NP EN 14411 (2016)', title: 'Placas cerâmicas — definições, classificação, características e marcação' },
      { code: 'NP EN 12004 (2017)', title: 'Colas para ladrilhos — requisitos, avaliação e classificação' },
      { code: 'NP EN 13888 (2009)', title: 'Betumes de juntas para ladrilhos — definições e especificações' },
    ],
    hypothesesACommuniquer: [
      'Azulejo 20×20 cm (formato clássico português)',
      'Colagem simples pente U6 (formato ≤ 30×30)',
      'Primário hidrófugo obrigatório em zonas húmidas (casa de banho, duche)',
      'Juntas 2-3 mm (azulejo tradicional)',
      'Junta periférica silicone obrigatória (ângulos + sanita + lavatório)',
      'Autonivelante / regularização NÃO incluído — prever se planimetria insuficiente',
    ],
    materials: [
      {
        id: 'primario-hidrofugo-pt', name: 'Primário hidrófugo (zonas húmidas)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.2, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recipiente + resíduos pincel',
        manufacturerRef: 'Weber PT (weber.sys protec)',
        packaging: { unit: 'pot', contentQty: 7, contentUnit: 'kg', label: 'bidão 7 kg' },
        notes: 'A excluir em parede seca (cozinha sem projecção directa).',
      },
      {
        id: 'azulejo-20-pt', name: 'Azulejo cerâmico 20×20 cm (Aleluia / Revigrés)',
        category: 'carreau', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Quebras + cortes (10-15% em pose mural)',
        normRef: 'NP EN 14411 (2016)', manufacturerRef: 'Aleluia Cerâmicas / Revigrés',
      },
      {
        id: 'cola-c2-azulejo-pt', name: 'Cimento-cola C2 (colagem simples pente U6)',
        category: 'colle', phase: 'principal', quantityPerBase: 3.5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Resíduos + sobre-dosagem',
        normRef: 'NP EN 12004 (2017) — classe C2', manufacturerRef: 'Weber PT (weber.col flex) / Mapei',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'betume-juntas-azulejo-pt', name: 'Betume de juntas cimentício (juntas 2-3 mm)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.54, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Resíduos, sobre-dosagem',
        normRef: 'NP EN 13888 (2009)', manufacturerRef: 'Mapei Ultracolor Plus / Weber PT',
        packaging: { unit: 'sac', contentQty: 5, contentUnit: 'kg', label: 'saco 5 kg' },
        notes: 'Base: (200+200)×10×3×1,8/(200×200) = 0,54 kg/m²',
      },
      {
        id: 'cruzetas-2mm-pt', name: 'Cruzetas 2 mm (espaçadores)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 25, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Perdas em obra, não recuperáveis',
        notes: '1/(0,20×0,20) = 25 cruzetas/m². Formato pequeno = muitas juntas.',
        packaging: { unit: 'u', contentQty: 500, contentUnit: 'u', label: 'saco 500 u' },
      },
      {
        id: 'silicone-sanitario-pt', name: 'Silicone sanitário (ângulos + raccords sanitários)',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.3, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purga cartucho',
        packaging: { unit: 'cartouche', contentQty: 12, contentUnit: 'ml', label: 'cartucho 280 ml (~12 ml junta)' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. PAVIMENTO CERÂMICO COLADO (GRÉS PORCELÂNICO 60×60)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'pavimento-ceramico-60-pt',
    name: 'Pavimento cerâmico grés porcelânico 60×60 (colagem dupla)',
    description: 'Grés porcelânico rectificado grande formato. Cola C2S1 deformável + colagem dupla pente U9.',
    country: 'PT',
    trade: 'carrelage',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    constraints: {
      minArea: 4,
      note: 'Formato > 30×30 → colagem dupla obrigatória. Formato > 60×60 → C2S1.',
    },
    dtuReferences: [
      { code: 'NP EN 14411 (2016)', title: 'Placas cerâmicas — especificações e marcação' },
      { code: 'NP EN 12004 (2017)', title: 'Colas para ladrilhos — classe C2S1' },
      ...ptRefs('ceramico_colado'),
    ],
    hypothesesACommuniquer: [
      'Suporte pressuposto betonilha cimentícia ou laje betão (planimetria 5 mm à régua 2 m)',
      'Pose recta (perdas 10%) — majorar a 15% para pose diagonal',
      'Primário de aderência incluído',
      'Juntas 2 mm (rectificado)',
      'Junta periférica silicone obrigatória (dilatação)',
      'Autonivelante NÃO incluído — prever se planimetria não conforme',
    ],
    materials: [
      {
        id: 'primario-aderencia-sol-pt', name: 'Primário de aderência (sobre betonilha/betão)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recipiente + resíduos',
        manufacturerRef: 'Weber PT (weber.prim) — 150 g/m² diluído',
        packaging: { unit: 'pot', contentQty: 5, contentUnit: 'kg', label: 'bidão 5 kg' },
      },
      {
        id: 'autonivelante-ceramico-pt', name: 'Autonivelante cimentício (3 mm)',
        category: 'enduit', phase: 'preparation', quantityPerBase: 5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Resíduos, sobre-dosagem',
        manufacturerRef: 'Weber PT (weber.niv pro) / Mapei',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
        optional: true,
        condition: 'Se planimetria do suporte > 5 mm à régua de 2 m',
      },
      {
        id: 'gres-porcelanico-60-pt', name: 'Grés porcelânico rectificado 60×60 (Margres / Revigrés)',
        category: 'carreau', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Quebras transporte + cortes (grande formato)',
        normRef: 'NP EN 14411 (2016)', manufacturerRef: 'Margres / Revigrés / Love Tiles',
      },
      {
        id: 'cola-c2s1-pt', name: 'Cimento-cola C2S1 deformável (colagem dupla pente U9)',
        category: 'colle', phase: 'principal', quantityPerBase: 7, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Resíduos + sobre-dosagem',
        normRef: 'NP EN 12004 (2017) — classe C2S1', manufacturerRef: 'Weber PT (weber.col flex S1) / Mapei Keraflex Maxi S1',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'betume-juntas-2mm-pt', name: 'Betume de juntas flexível (juntas 2 mm rectificado)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.12, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Resíduos',
        normRef: 'NP EN 13888 (2009)', manufacturerRef: 'Mapei — 0,12 kg/m² para 60×60 junta 2 mm',
        packaging: { unit: 'sac', contentQty: 5, contentUnit: 'kg', label: 'saco 5 kg' },
      },
      {
        id: 'cruzetas-2mm-60-pt', name: 'Cruzetas 2 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 3, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Perdas em obra',
        notes: '1/(0,60×0,60) ≈ 3 cruzetas/m².',
        packaging: { unit: 'u', contentQty: 500, contentUnit: 'u', label: 'saco 500 u' },
      },
      {
        id: 'silicone-perimetral-pt', name: 'Silicone (junta periférica obrigatória)',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.4, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purga cartucho',
        packaging: { unit: 'cartouche', contentQty: 12, contentUnit: 'ml', label: 'cartucho 310 ml (~12 ml junta)' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. MOSAICO HIDRÁULICO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'mosaico-hidraulico-pt',
    name: 'Mosaico hidráulico artesanal 20×20 (pose colada)',
    description: 'Mosaico hidráulico artesanal (ladrilho cimentício decorado), pose colada sobre betonilha. Tratamento hidrófugo final.',
    country: 'PT',
    trade: 'carrelage',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      { code: 'NP EN 14411 (2016)', title: 'Placas cerâmicas (referência adaptada a mosaico cimentício)' },
      { code: 'NP EN 12004 (2017)', title: 'Colas para ladrilhos' },
    ],
    hypothesesACommuniquer: [
      'Mosaico hidráulico artesanal 20×20 cm, espessura 16-18 mm',
      'Produção artesanal — variações de tonalidade normais',
      'Colagem dupla cola flexível C2 (peça pesada ~6 kg/u)',
      'Juntas 1,5-2 mm (mosaico artesanal — mínimo possível)',
      'Tratamento hidrófugo obrigatório (mosaico poroso)',
      'Impregnação prévia da peça recomendada (antes pose)',
      'Perdas 12-15% (peças artesanais, quebras frequentes)',
    ],
    materials: [
      {
        id: 'mosaico-hidraulico-20-pt', name: 'Mosaico hidráulico artesanal 20×20 cm',
        category: 'carreau', phase: 'principal', quantityPerBase: 25, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Quebras (peça artesanal frágil) + cortes',
        notes: '25 peças/m² (20×20 cm). Encomendar +15% de reserva.',
        manufacturerRef: 'Viúva Lamego / Cortiço & Netos / Projecto Mosaico',
      },
      {
        id: 'cola-c2-mosaico-pt', name: 'Cimento-cola C2 flexível (colagem dupla)',
        category: 'colle', phase: 'principal', quantityPerBase: 5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Resíduos + sobre-dosagem',
        normRef: 'NP EN 12004 (2017)', manufacturerRef: 'Weber PT / Mapei',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'betume-juntas-mosaico-pt', name: 'Betume de juntas cimentício (1,5-2 mm)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.40, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Resíduos, limpeza',
        normRef: 'NP EN 13888 (2009)',
        packaging: { unit: 'sac', contentQty: 5, contentUnit: 'kg', label: 'saco 5 kg' },
      },
      {
        id: 'cruzetas-15mm-mosaico-pt', name: 'Cruzetas 1,5 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 25, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Perdas em obra',
        packaging: { unit: 'u', contentQty: 500, contentUnit: 'u', label: 'saco 500 u' },
      },
      {
        id: 'impregnante-hidrofugo-pt', name: 'Impregnante hidrófugo (tratamento pós-pose)',
        category: 'peinture', phase: 'finitions', quantityPerBase: 0.2, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação pincel/rolo',
        manufacturerRef: 'Fila / Akemi / Weber PT',
        packaging: { unit: 'pot', contentQty: 1, contentUnit: 'L', label: 'frasco 1 L' },
        notes: 'Aplicar 2 demãos após secagem completa das juntas (48 h).',
      },
      {
        id: 'cera-acabamento-mosaico-pt', name: 'Cera de acabamento (brilho / mate)',
        category: 'peinture', phase: 'finitions', quantityPerBase: 0.1, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação',
        optional: true,
        condition: 'Se acabamento cera tradicional desejado (alternativa ao hidrófugo simples)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. PEDRA NATURAL (MÁRMORE / GRANITO)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'pedra-natural-pavimento-pt',
    name: 'Pavimento em pedra natural (mármore / granito / calcário)',
    description: 'Revestimento de pavimento em placas de pedra natural 40×40 ou 60×40. Colagem dupla C2S1.',
    country: 'PT',
    trade: 'carrelage',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      { code: 'NP EN 12057 (2015)', title: 'Produtos de pedra natural — placas modulares — requisitos' },
      { code: 'NP EN 12004 (2017)', title: 'Colas para ladrilhos — classe C2S1' },
      { code: 'NP EN 14411 (2016)', title: 'Referência para critérios de pose análogos' },
    ],
    hypothesesACommuniquer: [
      'Pedra natural: mármore Estremoz, granito Alpalhão, calcário Moleanos (conforme projecto)',
      'Formato típico 40×40 ou 60×40 cm, espessura 2 cm (polido/amaciado)',
      'Colagem dupla cola C2S1 (peça pesada + pedra natural)',
      'Juntas 2-3 mm (conforme tipo de pedra)',
      'Tratamento hidrófugo obrigatório (pedra porosa, especialmente calcário)',
      'Perdas 10-12% (cortes + eventual quebra de peças)',
      'Pedra natural tem variações de tonalidade normais entre lotes',
    ],
    materials: [
      {
        id: 'primario-pedra-pt', name: 'Primário de aderência (suporte)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recipiente + resíduos',
        manufacturerRef: 'Weber PT',
        packaging: { unit: 'pot', contentQty: 5, contentUnit: 'kg', label: 'bidão 5 kg' },
      },
      {
        id: 'placa-pedra-natural-pt', name: 'Placas pedra natural (mármore/granito/calcário)',
        category: 'carreau', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Quebras + cortes (material natural)',
        normRef: 'NP EN 12057 (2015)', manufacturerRef: 'Solancis / Mármores Galrão / Granitos SA',
      },
      {
        id: 'cola-c2s1-pedra-pt', name: 'Cimento-cola C2S1 flexível branca (colagem dupla)',
        category: 'colle', phase: 'principal', quantityPerBase: 6.5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Resíduos + sobre-dosagem',
        normRef: 'NP EN 12004 (2017) — C2S1', manufacturerRef: 'Weber PT / Mapei Keraflex Maxi S1',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
        notes: 'Cola branca recomendada para mármores claros (evitar manchas).',
      },
      {
        id: 'betume-juntas-pedra-pt', name: 'Betume de juntas epóxi (pedra natural)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.25, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Resíduos',
        normRef: 'NP EN 13888 (2009)', manufacturerRef: 'Mapei Kerapoxy',
        packaging: { unit: 'pot', contentQty: 5, contentUnit: 'kg', label: 'balde 5 kg' },
      },
      {
        id: 'cruzetas-pedra-pt', name: 'Cruzetas 2-3 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 5, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Perdas em obra',
        packaging: { unit: 'u', contentQty: 500, contentUnit: 'u', label: 'saco 500 u' },
      },
      {
        id: 'hidrofugo-pedra-pt', name: 'Hidrófugo impregnante (protecção pedra)',
        category: 'peinture', phase: 'finitions', quantityPerBase: 0.2, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação rolo/pincel',
        manufacturerRef: 'Fila / Akemi / Bellinzoni',
        packaging: { unit: 'pot', contentQty: 1, contentUnit: 'L', label: 'frasco 1 L' },
      },
      {
        id: 'silicone-perimet-pedra-pt', name: 'Silicone neutro (junta periférica)',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.4, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purga cartucho',
        packaging: { unit: 'cartouche', contentQty: 12, contentUnit: 'ml', label: 'cartucho 310 ml' },
        notes: 'Silicone neutro obrigatório para pedra natural (não acético — mancha).',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  5. AZULEJO DE FACHADA EXTERIOR
  // ══════════════════════════════════════════════════════════════
  {
    id: 'azulejo-fachada-ext-pt',
    name: 'Azulejo de fachada exterior (revestimento cerâmico colado)',
    description: 'Revestimento cerâmico de fachada colado com C2S1. Tradição portuguesa do azulejo exterior.',
    country: 'PT',
    trade: 'carrelage',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    version: '2.0.0',
    dtuReferences: [
      { code: 'NP EN 14411 (2016)', title: 'Placas cerâmicas — especificações' },
      { code: 'NP EN 12004 (2017)', title: 'Colas para ladrilhos — C2S1 obrigatória exterior' },
      ...ptRefs('rgeu'),
    ],
    hypothesesACommuniquer: [
      'Azulejo exterior vidrado (tradição portuguesa) ou grés porcelânico',
      'Formato típico 15×15 ou 20×20 cm',
      'Cola C2S1 deformável obrigatória (exterior — dilatação térmica)',
      'Colagem dupla obrigatória em fachada',
      'Juntas de dilatação a cada 12-16 m² (fraccionamento fachada)',
      'Juntas 3 mm mínimo (exterior — absorção dilatações)',
      'Perdas 12-15% (cortes + quebras + altitude)',
    ],
    materials: [
      {
        id: 'azulejo-fachada-pt', name: 'Azulejo fachada exterior (Aleluia / Viúva Lamego)',
        category: 'carreau', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Quebras + cortes + manuseamento em altura',
        normRef: 'NP EN 14411 (2016)', manufacturerRef: 'Aleluia Cerâmicas / Viúva Lamego / Revigrés',
      },
      {
        id: 'cola-c2s1-fachada-pt', name: 'Cimento-cola C2S1 deformável (colagem dupla fachada)',
        category: 'colle', phase: 'principal', quantityPerBase: 6, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Resíduos + sobre-dosagem',
        normRef: 'NP EN 12004 (2017) — C2S1', manufacturerRef: 'Weber PT (weber.col flex S1)',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'betume-juntas-fachada-pt', name: 'Betume de juntas flexível resistente UV',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.40, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Resíduos',
        normRef: 'NP EN 13888 (2009)', manufacturerRef: 'Mapei Ultracolor Plus / Weber PT',
        packaging: { unit: 'sac', contentQty: 5, contentUnit: 'kg', label: 'saco 5 kg' },
      },
      {
        id: 'cruzetas-3mm-fachada-pt', name: 'Cruzetas 3 mm (espaçadores)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 25, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Perdas em obra',
        packaging: { unit: 'u', contentQty: 500, contentUnit: 'u', label: 'saco 500 u' },
        notes: '~25/m² para formato 20×20.',
      },
      {
        id: 'perfil-fraccionamento-pt', name: 'Perfil de fraccionamento + mástique (juntas dilatação)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.3, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Cortes',
        notes: 'Fraccionamento a cada 12-16 m² em fachada.',
      },
      {
        id: 'primario-fachada-pt', name: 'Primário de aderência (suporte rebocado)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recipiente + resíduos',
        manufacturerRef: 'Weber PT',
        packaging: { unit: 'pot', contentQty: 5, contentUnit: 'kg', label: 'bidão 5 kg' },
      },
    ],
  },
]
