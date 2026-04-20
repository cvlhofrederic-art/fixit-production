import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * ALVENARIA — recetas PT (Lot F — escritas à mão, pt-PT).
 *
 * 8 obras de maçonnerie/alvenaria portuguesa courante :
 *  1. Betão C25/30 doseado a 350 kg/m³ (m³)
 *  2. Laje de betão armado em laje sobre terreno (m²)
 *  3. Parede exterior em tijolo térmico 30 (m²)
 *  4. Parede exterior em bloco de betão 20 cm (m²)
 *  5. Parede divisória em tijolo 11 cm (m²)
 *  6. Sapata corrida em BA (m³)
 *  7. Reboco tradicional em 3 camadas (m²)
 *  8. Betonilha armada/regularização (m²)
 *
 * Referências : NP EN 206+A2, Eurocódigo 2 & 6, LNEC E 464/465, RGEU.
 * Fabricantes : Secil, Cimpor, Weber PT, Preceram, Torreense, Sika PT.
 */

export const alvenariaRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. BETÃO C25/30 DOSEADO A 350 kg/m³
  // ══════════════════════════════════════════════════════════════
  {
    id: 'betao-c25-350-pt',
    name: 'Betão C25/30 doseado a 350 kg/m³ (betão armado corrente)',
    description: 'Betão de referência para lajes, pilares, vigas e fundações armadas. Composição tipo Secil.',
    country: 'PT',
    trade: 'maconnerie',
    baseUnit: 'm3',
    geometryMode: 'volume',
    version: '2.0.0',
    dtuReferences: ptRefs('betao', 'betao_execucao', 'lnec_e464'),
    hypothesesACommuniquer: [
      'Doseamento 350 kg/m³ (XS1 — interior/habitação corrente, EN 206+A2)',
      'Classe de exposição XC1 assumida (interior seco)',
      'Ratio A/C ≤ 0,55 (durabilidade LNEC E 465)',
      'Composição: CEM II/B-L 32,5 N (Secil) 350 kg + areia 0,48 m³ + brita 0,75 m³ + água 175 L',
      'Fibra PP opcional (fissuração retração plástica) — não incluída por defeito',
    ],
    materials: [
      {
        id: 'cemento-cem2-bl-325-pt', name: 'Cimento CEM II/B-L 32,5 N (Secil)',
        category: 'liant', phase: 'principal', quantityPerBase: 350, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Resíduos sacos, humidade',
        normRef: 'NP EN 197-1 (2012)', manufacturerRef: 'Secil / Cimpor',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'areia-0-4-pt', name: 'Areia 0/4 fluvial lavada',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.48, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manuseamento, basculamento',
        normRef: 'NP EN 12620+A1 (2010)',
      },
      {
        id: 'brita-4-20-pt', name: 'Brita 4/20 granítica',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.75, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manuseamento',
        normRef: 'NP EN 12620+A1 (2010)',
      },
      {
        id: 'agua-betao-pt', name: 'Água de amassadura',
        category: 'eau', phase: 'principal', quantityPerBase: 175, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Doseamento exato (A/C = 0,50)',
        normRef: 'NP EN 1008 (2003)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. LAJE DE BETÃO ARMADO SOBRE TERRENO (m²)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'laje-ba-terreno-pt',
    name: 'Laje de betão armado em terreno, armadura ∅8 // 15',
    description: 'Laje em terreno natural com base de brita compactada, polietileno, malha ∅8, betão C25/30.',
    country: 'PT',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    constraints: {
      minThickness: 0.10, maxThickness: 0.20,
      note: 'Espessura mínima 10 cm. Superior a 20 cm, armadura em 2 camadas.',
    },
    dtuReferences: ptRefs('betao', 'betao_execucao', 'betao_calculo', 'rgeu'),
    hypothesesACommuniquer: [
      'Base brita 20/40 compactada 20 cm pressuposto (a adaptar consoante solo)',
      'Geotêxtil 200 g/m² sob brita (anti-contaminação finos)',
      'Filme de polietileno 200 μm (barreira ao vapor)',
      'Malha electrosoldada ∅8 // 15×15 cm (superior)',
      'Juntas de dilatação perimetrais e juntas de retracção ao fim de 25 m² máx',
      'Cura protegida contra secagem rápida (EN 13670 §8.5)',
      'Isolante sob laje NÃO incluído (a adicionar para REH / aquecimento radiante)',
    ],
    materials: [
      {
        id: 'geotextil-200-pt', name: 'Geotêxtil 200 g/m² (anti-contaminação)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposição 30 cm',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'm2', label: 'rolo 50×2 m' },
      },
      {
        id: 'brita-20-40-pt', name: 'Brita 20/40 compactada (espessura 20 cm)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.20, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Compactação',
      },
      {
        id: 'polietileno-200-pt', name: 'Filme polietileno 200 μm',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sobreposições 20 cm',
      },
      {
        id: 'cemento-cem2-bl-325-pt', name: 'Cimento CEM II/B-L 32,5 N (betão 350 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 350, unit: 'kg',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.03, wasteReason: 'Resíduos, humidade',
        manufacturerRef: 'Secil / Cimpor',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'areia-0-4-pt', name: 'Areia 0/4',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.48, unit: 'm3',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.10, wasteReason: 'Manuseamento',
      },
      {
        id: 'brita-4-20-pt', name: 'Brita 4/20',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.75, unit: 'm3',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.10, wasteReason: 'Manuseamento',
      },
      {
        id: 'agua-betao-pt', name: 'Água de amassadura',
        category: 'eau', phase: 'principal', quantityPerBase: 175, unit: 'L',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.00, wasteReason: 'Doseamento exacto',
      },
      {
        id: 'malha-phi8-15-pt', name: 'Malha electrosoldada ∅8 // 15 cm',
        category: 'acier', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sobreposição 2 malhas + perdas de corte',
        normRef: 'NP EN 10080 (2008)',
        packaging: { unit: 'panneau', contentQty: 12, contentUnit: 'm2', label: 'painel 6×2 m (12 m²)' },
      },
      {
        id: 'espacador-30-pt', name: 'Espaçadores 30 mm (calçamento armadura)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Quebras, perda',
        notes: '4 por m² — recobrimento mínimo 30 mm (Eurocódigo 2)',
      },
      {
        id: 'produto-cura-pt', name: 'Produto de cura pulverizado',
        category: 'adjuvant', phase: 'accessoires', quantityPerBase: 0.2, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pulverização precisa',
        notes: 'Obrigatório em condições de vento/calor (EN 13670 §8.5)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. PAREDE EXTERIOR EM TIJOLO TÉRMICO 30
  // ══════════════════════════════════════════════════════════════
  {
    id: 'parede-tijolo-termico-30-pt',
    name: 'Parede exterior em tijolo térmico 30 cm',
    description: 'Parede exterior corrente habitação: tijolo cerâmico térmico 30 cm, argamassa M7,5.',
    country: 'PT',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    version: '2.0.0',
    dtuReferences: ptRefs('alvenaria', 'alvenaria_tijolo', 'argamassas', 'rgeu'),
    hypothesesACommuniquer: [
      'Tijolo térmico 30×19×30 cm (Preceram ou Torreense)',
      'Argamassa tradicional M7,5 (cimento/cal/areia 1:1:6)',
      'Juntas horizontais 12 mm + verticais 10 mm',
      '15 tijolos por m² (espessura 30 cm, formato 30×19)',
      'Malha anti-fissuração em cantos de aberturas (RGEU)',
      'Cinta sísmica horizontal em BA cada 3 m se zona sísmica (RSA)',
      'Abertura = porta ≈ 2,0 m² / janela ≈ 1,5 m² (a especificar em "openings")',
    ],
    materials: [
      {
        id: 'tijolo-termico-30-pt', name: 'Tijolo térmico 30 (Preceram / Torreense)',
        category: 'brique', phase: 'principal', quantityPerBase: 15, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.08, wasteReason: 'Quebras na manipulação + cortes',
        normRef: 'NP EN 771-1+A1 (2015)', manufacturerRef: 'Preceram / Cerâmica Torreense',
        packaging: { unit: 'panneau', contentQty: 96, contentUnit: 'u', label: 'palete 96 u' },
      },
      {
        id: 'argamassa-assentamento-pt', name: 'Argamassa assentamento M7,5 (Weber PT / sacos)',
        category: 'enduit', phase: 'principal', quantityPerBase: 25, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Resíduos, misturas não utilizadas',
        normRef: 'NP EN 998-2 (2017)', manufacturerRef: 'Weber PT (weber.mix)',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'malha-anti-fissura-pt', name: 'Malha anti-fissuração fibra vidro (cantos)',
        category: 'ossature', phase: 'accessoires', quantityPerBase: 0.3, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes, sobreposição',
      },
      {
        id: 'impermeabilizante-pe-pt', name: 'Impermeabilização betuminosa de pé de parede',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 0.1, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Aplicação por pincel',
        manufacturerRef: 'Sika / Imperalum',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. PAREDE EXTERIOR EM BLOCO DE BETÃO 20 cm
  // ══════════════════════════════════════════════════════════════
  {
    id: 'parede-bloco-betao-20-pt',
    name: 'Parede exterior em bloco de betão 20 cm',
    description: 'Parede exterior em bloco de betão 20×20×40 cm, preenchimento células (se cinta), argamassa.',
    country: 'PT',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    version: '2.0.0',
    dtuReferences: ptRefs('alvenaria', 'alvenaria_blocos', 'argamassas'),
    hypothesesACommuniquer: [
      'Bloco betão 20×20×40 cm vazio (Presdouro / Preceram)',
      '12,5 blocos por m²',
      'Argamassa M7,5 (junta horizontal 12 mm / vertical 10 mm)',
      'Isolante térmico exterior (ETICS) NÃO incluído — a prever separadamente',
      'Reboco interior e exterior NÃO incluídos',
      'Cinta sísmica obrigatória cada 3 m em zona sísmica (RSA)',
    ],
    materials: [
      {
        id: 'bloco-betao-20-40-pt', name: 'Bloco de betão 20×20×40 (Presdouro / Preceram)',
        category: 'bloc', phase: 'principal', quantityPerBase: 12.5, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Quebras manipulação',
        normRef: 'NP EN 771-3+A1 (2015)', manufacturerRef: 'Presdouro / Preceram',
        packaging: { unit: 'panneau', contentQty: 60, contentUnit: 'u', label: 'palete 60 u' },
      },
      {
        id: 'argamassa-assentamento-pt', name: 'Argamassa M7,5 (Weber PT)',
        category: 'enduit', phase: 'principal', quantityPerBase: 20, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Resíduos',
        manufacturerRef: 'Weber PT',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'ferro-varao-cinta-pt', name: 'Varão de aço ∅10 (cinta sísmica)',
        category: 'acier', phase: 'accessoires', quantityPerBase: 0.4, unit: 'kg',
        geometryMultiplier: 'height',
        wasteFactor: 1.10, wasteReason: 'Cortes, sobreposições',
        normRef: 'NP EN 10080 (2008)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  5. PAREDE DIVISÓRIA EM TIJOLO 11 cm
  // ══════════════════════════════════════════════════════════════
  {
    id: 'parede-divisoria-tijolo-11-pt',
    name: 'Parede divisória em tijolo 11 furos',
    description: 'Parede divisória interior em tijolo cerâmico 30×20×11 cm, argamassa + reboco tradicional.',
    country: 'PT',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    version: '2.0.0',
    dtuReferences: ptRefs('alvenaria_tijolo', 'argamassas'),
    hypothesesACommuniquer: [
      'Tijolo 11 furos 30×20×11 cm (Torreense)',
      '~17 tijolos por m² (espessura 11 cm)',
      'Não portadora de carga',
      'Reboco fino em ambas as faces NÃO incluído (a prever separadamente)',
    ],
    materials: [
      {
        id: 'tijolo-11-furos-pt', name: 'Tijolo 11 furos 30×20×11 (Torreense)',
        category: 'brique', phase: 'principal', quantityPerBase: 17, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Quebras, cortes',
        normRef: 'NP EN 771-1+A1 (2015)', manufacturerRef: 'Cerâmica Torreense',
        packaging: { unit: 'panneau', contentQty: 150, contentUnit: 'u', label: 'palete 150 u' },
      },
      {
        id: 'argamassa-assentamento-pt', name: 'Argamassa M5 (assentamento divisória)',
        category: 'enduit', phase: 'principal', quantityPerBase: 15, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Resíduos',
        manufacturerRef: 'Weber PT',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  6. SAPATA CORRIDA EM BA (fundação)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'sapata-corrida-ba-pt',
    name: 'Sapata corrida de betão armado (fundação de parede)',
    description: 'Sapata corrida contínua para parede estrutural: escavação, betão de limpeza, armadura, betão C25/30.',
    country: 'PT',
    trade: 'maconnerie',
    baseUnit: 'm3',
    geometryMode: 'volume',
    version: '2.0.0',
    dtuReferences: ptRefs('betao', 'betao_calculo', 'rgeu'),
    hypothesesACommuniquer: [
      'Solo: tensão admissível ≥ 150 kPa pressuposta',
      'Profundidade mínima 80 cm (fora do alcance gelo)',
      'Secção padrão 60×40 cm (a adaptar a projeto estrutural)',
      'Armadura longitudinal 4∅12 + cintas ∅6 // 20',
      'Betão de limpeza 5 cm (C12/15) obrigatório (EC2)',
    ],
    materials: [
      {
        id: 'betao-limpeza-pt', name: 'Betão de limpeza C12/15 (5 cm)',
        category: 'liant', phase: 'preparation', quantityPerBase: 0.05, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Betonagem',
        normRef: 'NP EN 206+A2 (2021)',
      },
      {
        id: 'cemento-cem2-bl-325-pt', name: 'Cimento CEM II/B-L 32,5 N (betão 350 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 350, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Resíduos sacos',
        manufacturerRef: 'Secil / Cimpor',
      },
      {
        id: 'areia-0-4-pt', name: 'Areia 0/4',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.48, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manuseamento',
      },
      {
        id: 'brita-4-20-pt', name: 'Brita 4/20',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.75, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manuseamento',
      },
      {
        id: 'agua-betao-pt', name: 'Água',
        category: 'eau', phase: 'principal', quantityPerBase: 175, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Doseamento',
      },
      {
        id: 'varao-ha-12-pt', name: 'Varão HA ∅12 (armadura longitudinal)',
        category: 'acier', phase: 'principal', quantityPerBase: 60, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Cortes, recobrimentos EC2',
        normRef: 'NP EN 10080 (2008)',
      },
      {
        id: 'cinta-phi6-pt', name: 'Cintas ∅6 (estribos)',
        category: 'acier', phase: 'principal', quantityPerBase: 15, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Cortes e dobragens',
      },
      {
        id: 'espacador-30-pt', name: 'Espaçadores 40 mm (recobrimento fundação)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 5, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Quebras',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  7. REBOCO TRADICIONAL 3 CAMADAS (interior)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'reboco-tradicional-3c-pt',
    name: 'Reboco tradicional em 3 camadas (interior)',
    description: 'Reboco clássico: salpico + massa grossa + massa fina. Espessura total ≈ 15 mm.',
    country: 'PT',
    trade: 'revetement_mural',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('argamassas', 'alvenaria'),
    hypothesesACommuniquer: [
      '3 camadas: salpico (3 mm) + massa grossa (10 mm) + massa fina (2 mm)',
      'Argamassa tradicional ou pré-doseada (Weber PT weber.rev universal)',
      'Consumo médio: 18 kg/m² total',
      'Primário regularizador opcional para suporte novo',
    ],
    materials: [
      {
        id: 'argamassa-reboco-pt', name: 'Argamassa de reboco pré-doseada M5 (Weber PT)',
        category: 'enduit', phase: 'principal', quantityPerBase: 18, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Resíduos, projeção',
        normRef: 'NP EN 998-1 (2017)', manufacturerRef: 'Weber PT (weber.rev)',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'primario-reboco-pt', name: 'Primário regulador (opcional, suporte novo)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.2, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Aplicação rolo',
        manufacturerRef: 'Sika / Weber PT',
        optional: true, condition: 'Aplicar em suporte novo/muito poroso',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  8. BETONILHA DE REGULARIZAÇÃO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'betonilha-regularizacao-pt',
    name: 'Betonilha de regularização (5 cm, armada)',
    description: 'Betonilha de cimento sobre laje, regularização para revestimento final, com malha anti-fissuração.',
    country: 'PT',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('argamassas', 'ceramico_colado'),
    hypothesesACommuniquer: [
      'Espessura standard 5 cm',
      'Doseamento 300 kg/m³ cimento',
      'Malha galvanizada ∅3 // 15 cm integrada',
      'Junta perimetral de 5 mm em mousse de PE (desolidarização)',
      'Cura húmida 7 dias antes de aplicação revestimento',
    ],
    materials: [
      {
        id: 'cemento-cem2-bl-325-pt', name: 'Cimento CEM II/B-L 32,5 N',
        category: 'liant', phase: 'principal', quantityPerBase: 15, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Resíduos sacos',
        manufacturerRef: 'Secil',
      },
      {
        id: 'areia-0-4-pt', name: 'Areia 0/4',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.05, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manuseamento',
      },
      {
        id: 'malha-galv-phi3-pt', name: 'Malha galvanizada ∅3 // 15 (anti-fissuração)',
        category: 'acier', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposição',
      },
      {
        id: 'junta-periferica-5-pt', name: 'Junta periférica mousse PE 5 mm',
        category: 'joint', phase: 'accessoires', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Cortes',
      },
    ],
  },
]
