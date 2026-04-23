import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * ISOLAMENTO — recetas PT (escritas à mão, pt-PT).
 *
 * 5 obras de isolamento térmico/acústico português corrente :
 *  1. ETICS / Capoto (isolamento térmico exterior) (m²)
 *  2. Isolamento de cobertura inclinada (m²)
 *  3. Isolamento de pavimento térreo (m²)
 *  4. Isolamento acústico entre pisos (m²)
 *  5. Isolamento de cobertura plana (invertida) (m²)
 *
 * Referências : REH (DL 118/2013), NP EN 13162 a 13171, LNEC ITE 50.
 * Fabricantes : Weber PT (webertherm), Sika PT, Volcalis, Sotecnisol.
 */

export const isolamentoRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. ETICS / CAPOTO (isolamento térmico pelo exterior)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'etics-capoto-pt',
    name: 'ETICS / Capoto — EPS 80 mm colado e cavilhado',
    description: 'Sistema ETICS (capoto) com EPS grafitado 80 mm, colagem + cavilhagem mecânica, armadura em rede de fibra de vidro, reboco fino.',
    country: 'PT',
    trade: 'isolation',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('reh', 'isolamento_eps'),
      { code: 'LNEC ITE 50', title: 'Coeficientes de transmissão térmica de elementos opacos da envolvente' },
      { code: 'ETA (Aprovação Técnica Europeia)', title: 'Sistema ETICS — aprovação por fabricante' },
    ],
    hypothesesACommuniquer: [
      'EPS grafitado (cinzento) 80 mm (λ = 0,032 W/mK → R ≈ 2,5 m²K/W)',
      'Colagem argamassa + cavilhagem mecânica complementar (6 cavilhas/m²)',
      'Perfil de arranque em alumínio no pé de fachada (proteção + alinhamento)',
      'Armadura rede de fibra de vidro 160 g/m² no reboco base',
      'Acabamento reboco fino acrílico 1,5 mm (Weber PT / Sika PT)',
      'Cantoneiras PVC/alumínio com rede integrada nos ângulos',
      'REH exige U ≤ 0,40 W/m²K em paredes exteriores (zona climática I2)',
    ],
    materials: [
      {
        id: 'perfil-arranque-alu-pt', name: 'Perfil de arranque alumínio (pé de fachada)',
        category: 'ossature', phase: 'preparation', quantityPerBase: 0.25, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        manufacturerRef: 'Weber PT / Sika PT',
        notes: '1 ml perfil por cada 4 m² de fachada típica.',
      },
      {
        id: 'eps-grafitado-80-pt', name: 'Placa EPS grafitado 80 mm (R ≈ 2,5)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1.05, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        normRef: 'NP EN 13163 (2015)', manufacturerRef: 'Volcalis / Weber PT (webertherm)',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'm2', label: 'embalagem 6 placas 0,50 m²' },
      },
      {
        id: 'argamassa-colagem-etics-pt', name: 'Argamassa de colagem ETICS',
        category: 'colle', phase: 'principal', quantityPerBase: 5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Resíduos',
        manufacturerRef: 'Weber PT (webertherm collage) / Sika PT',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'cavilha-etics-pt', name: 'Cavilhas de fixação mecânica (plástico + prego)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 6, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Quebras',
        notes: '6 cavilhas/m² (mínimo ETA fabricante).',
      },
      {
        id: 'rede-fibra-vidro-etics-pt', name: 'Rede de fibra de vidro 160 g/m² (armadura)',
        category: 'fixation', phase: 'principal', quantityPerBase: 1.15, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sobreposições 10 cm',
      },
      {
        id: 'reboco-base-etics-pt', name: 'Reboco base armado (marouflagem)',
        category: 'enduit', phase: 'principal', quantityPerBase: 4, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Resíduos',
        manufacturerRef: 'Weber PT (webertherm base)',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'primario-regulador-etics-pt', name: 'Primário regulador (antes do acabamento)',
        category: 'primaire', phase: 'principal', quantityPerBase: 0.12, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Aplicação rolo',
        manufacturerRef: 'Weber PT',
      },
      {
        id: 'acabamento-acrilico-etics-pt', name: 'Acabamento reboco acrílico 1,5 mm',
        category: 'enduit', phase: 'finitions', quantityPerBase: 2.5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Talocha',
        manufacturerRef: 'Weber PT (webertherm finish) / Sika PT',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'cantoneira-pvc-etics-pt', name: 'Cantoneiras PVC/alu com rede integrada',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 0.2, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. ISOLAMENTO DE COBERTURA INCLINADA (sob telha)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'isolamento-cobertura-inclinada-pt',
    name: 'Isolamento de cobertura inclinada (lã mineral 120 mm entre varas)',
    description: 'Isolamento térmico de cobertura inclinada com lã mineral entre varas/caibros + barreira pára-vapor + forro em gesso cartonado.',
    country: 'PT',
    trade: 'isolation',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('reh', 'isolamento_la_mineral'),
      { code: 'LNEC ITE 50', title: 'Coeficientes de transmissão térmica de elementos opacos' },
    ],
    hypothesesACommuniquer: [
      'Lã mineral 120 mm entre varas (R ≈ 3,4 m²K/W)',
      'Barreira pára-vapor lado quente obrigatória',
      'Forro interior em gesso cartonado 12,5 mm sobre perfilaria',
      'Subtelha existente assumida (ventilação pelo exterior)',
      'REH exige U ≤ 0,35 W/m²K em coberturas (zona climática I2)',
      'Alternativa: isolamento sobre varas (sarking) — mais eficaz mas mais caro',
    ],
    materials: [
      {
        id: 'barreira-vapor-cobertura-pt', name: 'Barreira pára-vapor (lado quente)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições',
      },
      {
        id: 'la-mineral-120-pt', name: 'Lã mineral 120 mm (rolo ou painel semi-rígido)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1.05, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        normRef: 'NP EN 13162 (2015)', manufacturerRef: 'Volcalis / Sotecnisol / Knauf Insulation',
        packaging: { unit: 'u', contentQty: 6.6, contentUnit: 'm2', label: 'rolo 1,20×5,50 m' },
      },
      {
        id: 'suspensao-perfilaria-pt', name: 'Suspensões metálicas (fixação perfilaria)',
        category: 'fixation', phase: 'principal', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Quebras',
      },
      {
        id: 'perfilaria-f530-pt', name: 'Perfilaria F530 (afastamento 60 cm)',
        category: 'ossature', phase: 'principal', quantityPerBase: 1.67, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'gesso-cartonado-125-pt', name: 'Gesso cartonado 12,5 mm (forro interior)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.05, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'fita-adesiva-vapor-pt', name: 'Fita adesiva estanquidade ao ar (juntas)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.2, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. ISOLAMENTO DE PAVIMENTO TÉRREO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'isolamento-pavimento-terreo-pt',
    name: 'Isolamento de pavimento térreo (XPS 50 mm sob betonilha)',
    description: 'Isolamento térmico de pavimento sobre terreno com placas XPS 50 mm sob betonilha de regularização.',
    country: 'PT',
    trade: 'isolation',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('reh', 'isolamento_xps'),
      { code: 'LNEC ITE 50', title: 'Coeficientes de transmissão térmica — pavimentos' },
    ],
    hypothesesACommuniquer: [
      'XPS 50 mm (λ = 0,034 W/mK → R ≈ 1,47 m²K/W)',
      'Filme polietileno 200 μm sob isolante (barreira humidade)',
      'Betonilha armada 5 cm sobre isolante',
      'Junta perimetral em espuma PE 5 mm (desolidarização)',
      'REH exige isolamento em pavimentos em contacto com o solo',
      'Compatível com piso radiante (a prever separadamente)',
    ],
    materials: [
      {
        id: 'polietileno-200-iso-pt', name: 'Filme polietileno 200 μm (barreira humidade)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sobreposições 20 cm',
      },
      {
        id: 'xps-50-pavimento-pt', name: 'Placas XPS 50 mm (isolamento térmico)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1.05, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        normRef: 'NP EN 13164 (2015)', manufacturerRef: 'Volcalis / Ibershaco',
        packaging: { unit: 'u', contentQty: 7.5, contentUnit: 'm2', label: 'embalagem 10 placas 1,25×0,60 m' },
      },
      {
        id: 'junta-perimetral-pe-pt', name: 'Junta perimetral espuma PE 5 mm',
        category: 'joint', phase: 'accessoires', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Cortes',
      },
      {
        id: 'malha-anti-fissura-pav-pt', name: 'Malha galvanizada ∅3 // 15 (anti-fissuração betonilha)',
        category: 'acier', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições',
      },
      {
        id: 'betonilha-regulacao-pav-pt', name: 'Betonilha de regularização (5 cm)',
        category: 'liant', phase: 'principal', quantityPerBase: 100, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Resíduos',
        notes: 'Argamassa pré-doseada ≈ 100 kg/m² para 5 cm (2000 kg/m³).',
        manufacturerRef: 'Weber PT / Secil Argamassas',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. ISOLAMENTO ACÚSTICO ENTRE PISOS
  // ══════════════════════════════════════════════════════════════
  {
    id: 'isolamento-acustico-pisos-pt',
    name: 'Isolamento acústico entre pisos (lã mineral + piso flutuante)',
    description: 'Isolamento de ruídos de percussão: lã mineral 20 mm de alta densidade sob betonilha flutuante dessolidarizada.',
    country: 'PT',
    trade: 'isolation',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('reh', 'isolamento_la_mineral', 'rgeu'),
      { code: 'NP EN 13162 a 13171', title: 'Produtos de isolamento térmico e acústico para construção' },
    ],
    hypothesesACommuniquer: [
      'Lã mineral de alta densidade 20 mm (≥ 150 kg/m³) — isolamento acústico a ruídos de percussão',
      'Betonilha flutuante dessolidarizada 5 cm (sem contacto com paredes)',
      'Junta perimetral em espuma PE 10 mm em todo o perímetro',
      'RGEU exige Lnw ≤ 60 dB (ruído de percussão)',
      'REH/RRAE: requisitos acústicos entre frações autónomas',
      'Filme polietileno entre isolante e betonilha',
    ],
    materials: [
      {
        id: 'la-mineral-acustica-20-pt', name: 'Lã mineral alta densidade 20 mm (≥ 150 kg/m³)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1.05, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        normRef: 'NP EN 13162 (2015)', manufacturerRef: 'Volcalis / Sotecnisol / Knauf Insulation',
      },
      {
        id: 'polietileno-separacao-pt', name: 'Filme polietileno (separação isolante/betonilha)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sobreposições',
      },
      {
        id: 'junta-perimetral-acustica-pt', name: 'Junta perimetral espuma PE 10 mm (dessolidarização)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Cortes',
      },
      {
        id: 'malha-anti-fissura-acust-pt', name: 'Malha galvanizada ∅3 // 15 (betonilha flutuante)',
        category: 'acier', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições',
      },
      {
        id: 'betonilha-flutuante-pt', name: 'Betonilha flutuante (5 cm)',
        category: 'liant', phase: 'principal', quantityPerBase: 100, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Resíduos',
        manufacturerRef: 'Weber PT / Secil Argamassas',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  5. ISOLAMENTO DE COBERTURA PLANA (invertida)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'isolamento-cobertura-invertida-pt',
    name: 'Isolamento de cobertura plana invertida (XPS 80 mm)',
    description: 'Isolamento térmico sobre membrana impermeabilizante existente. XPS 80 mm + geotêxtil + proteção pesada (seixo rolado).',
    country: 'PT',
    trade: 'isolation',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('reh', 'isolamento_xps', 'impermeabilizacao'),
      { code: 'LNEC ITE 50', title: 'Coeficientes de transmissão térmica — coberturas' },
    ],
    hypothesesACommuniquer: [
      'XPS 80 mm (300 kPa) sobre membrana impermeabilizante existente',
      'Geotêxtil de separação sobre isolante',
      'Proteção pesada: seixo rolado 40/60 (espessura 5 cm, ≈ 80 kg/m²)',
      'Sistema invertido: isolante protege a membrana (maior durabilidade)',
      'REH exige U ≤ 0,35 W/m²K em coberturas',
      'Alternativa à proteção pesada: lajetas sobre plots',
    ],
    materials: [
      {
        id: 'xps-80-cobertura-pt', name: 'Placas XPS 80 mm (300 kPa)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1.05, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
        normRef: 'NP EN 13164 (2015)', manufacturerRef: 'Volcalis / Ibershaco',
      },
      {
        id: 'geotextil-separacao-cob-pt', name: 'Geotêxtil de separação 200 g/m²',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1.10, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposições',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'm2', label: 'rolo 50×2 m' },
      },
      {
        id: 'seixo-rolado-40-60-pt', name: 'Seixo rolado 40/60 (proteção pesada, 5 cm)',
        category: 'granulat', phase: 'principal', quantityPerBase: 80, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Manuseamento',
        notes: '≈ 80 kg/m² para espessura 5 cm.',
      },
      {
        id: 'remate-periferico-xps-pt', name: 'Remate periférico XPS (corte + ajuste)',
        category: 'isolant', phase: 'accessoires', quantityPerBase: 0.1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes adaptação periferia',
      },
    ],
  },
]
