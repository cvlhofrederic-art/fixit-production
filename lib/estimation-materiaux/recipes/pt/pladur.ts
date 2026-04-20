import type { Recipe } from '../../types'
import { ptRefs } from '../../data/pt/standards'

/**
 * PLADUR / GESSO CARTONADO — recetas PT (Lot F).
 *
 * 4 obras pladur correntes :
 *  1. Parede divisória pladur 72/48 (m²)
 *  2. Tecto falso pladur suspenso (m²)
 *  3. Revestimento de parede colado directo (m²)
 *  4. Parede pladur hidrófuga (casas de banho) (m²)
 *
 * Referências : NP EN 520, RGEU, REH (isolamento).
 * Fabricantes : Placopla (ex-Placoplatre PT), Knauf, Siniat, Isover (Saint-Gobain).
 */

export const pladurRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════════
  //  1. PAREDE DIVISÓRIA PLADUR 72/48 (standard)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'parede-pladur-72-48-pt',
    name: 'Parede divisória Pladur 72/48 (placa + estrutura + isolamento)',
    description: 'Divisória standard: 2× placa pladur BA13 + estrutura metálica 48 mm + lã mineral 45 mm.',
    country: 'PT',
    trade: 'placo',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    version: '2.0.0',
    dtuReferences: [
      ...ptRefs('isolamento_la_mineral', 'rgeu'),
      { code: 'NP EN 520+A1 (2010)', title: 'Placas de gesso laminado — definições, especificações, métodos de ensaio' },
    ],
    constraints: {
      maxHeight: 2.6, note: 'Acima de 2,6 m usar pladur 98/48 com estrutura reforçada',
    },
    hypothesesACommuniquer: [
      '1 placa BA13 de cada lado (espessura 12,5 mm)',
      'Montantes M48 passo 60 cm',
      'Lã mineral 45 mm densidade 12 kg/m³ (isolamento acústico Rw ≈ 42 dB)',
      'Faixa acústica (anti-vibração) no perímetro de fixação',
      'Sobreposição juntas 20 cm (estanquidade acústica)',
      'Acabamento: banda papel + massa de juntas (2 camadas)',
    ],
    materials: [
      {
        id: 'placa-ba13-pt', name: 'Placa pladur BA13 1,2×2,5 m (Placopla / Knauf)',
        category: 'plaque', phase: 'principal', quantityPerBase: 2, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes, quebras (10%)',
        normRef: 'NP EN 520+A1 (2010)', manufacturerRef: 'Placopla / Knauf',
        packaging: { unit: 'panneau', contentQty: 3, contentUnit: 'm2', label: 'placa 1,2×2,5 (3 m²)' },
      },
      {
        id: 'montante-m48-pt', name: 'Montante metálico M48 (estrutura vertical)',
        category: 'ossature', phase: 'principal', quantityPerBase: 1.7, unit: 'ml',
        geometryMultiplier: 'height',
        wasteFactor: 1.10, wasteReason: 'Cortes, ajustes',
      },
      {
        id: 'guia-r48-pt', name: 'Guia R48 (horizontal superior/inferior)',
        category: 'ossature', phase: 'principal', quantityPerBase: 0.7, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
      },
      {
        id: 'la-mineral-45-pt', name: 'Lã mineral 45 mm (isolamento acústico)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.07, wasteReason: 'Cortes',
        manufacturerRef: 'Volcalis / Isover',
      },
      {
        id: 'parafusos-pladur-25-pt', name: 'Parafusos pladur TTPC 25 mm',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 35, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perda na colocação',
      },
      {
        id: 'banda-juntas-pt', name: 'Banda de juntas papel/fibra',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1.3, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposição',
      },
      {
        id: 'massa-juntas-pt', name: 'Massa de juntas pronta (Placopla PR4)',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.7, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Secagem, aplicação',
        manufacturerRef: 'Placopla / Knauf',
        packaging: { unit: 'pot', contentQty: 20, contentUnit: 'kg', label: 'balde 20 kg' },
      },
      {
        id: 'faixa-acustica-pt', name: 'Faixa acústica perimetral (mousse 3 mm)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.7, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  2. TECTO FALSO PLADUR SUSPENSO
  // ══════════════════════════════════════════════════════════════
  {
    id: 'tecto-falso-pladur-pt',
    name: 'Tecto falso pladur suspenso (estrutura metálica)',
    description: 'Tecto falso com perfis F47 + pendurais regulares + placa BA13 + isolamento opcional.',
    country: 'PT',
    trade: 'placo',
    baseUnit: 'm2',
    geometryMode: 'area',
    version: '2.0.0',
    dtuReferences: ptRefs('isolamento_la_mineral', 'rgeu'),
    hypothesesACommuniquer: [
      'Pendurais metálicos passo 1,0 × 1,2 m (~1 por m²)',
      'Perfis F47 passo 60 cm',
      'Placa BA13 standard (ou BA13 hidrófuga em zonas húmidas)',
      'Isolamento lã mineral opcional — REH / acústico',
      'Altura suspensão 10 cm mínima (passagem condutas/iluminação)',
    ],
    materials: [
      {
        id: 'placa-ba13-pt', name: 'Placa pladur BA13 (tecto)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes em tecto',
        manufacturerRef: 'Placopla / Knauf',
      },
      {
        id: 'perfil-f47-pt', name: 'Perfil F47 (primário tecto)',
        category: 'ossature', phase: 'principal', quantityPerBase: 1.7, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'pendural-rapido-pt', name: 'Pendural rápido + tirante',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Perda colocação',
      },
      {
        id: 'parafusos-pladur-25-pt', name: 'Parafusos pladur TTPC 25 mm',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 20, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perda',
      },
      {
        id: 'massa-juntas-pt', name: 'Massa de juntas',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Secagem',
        manufacturerRef: 'Placopla',
      },
      {
        id: 'la-mineral-45-pt', name: 'Lã mineral 45 mm (opcional, REH/acústico)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.07, wasteReason: 'Cortes',
        optional: true, condition: 'Adicionar se REH ou exigência acústica',
        manufacturerRef: 'Volcalis / Isover',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  3. REVESTIMENTO PAREDE PLADUR COLADO DIRECTO (SAD)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'pladur-colado-sad-pt',
    name: 'Placa pladur colada directo (sistema SAD) sobre parede',
    description: 'Revestimento de parede com pladur colado directamente (suporte plano), sem estrutura.',
    country: 'PT',
    trade: 'placo',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    version: '2.0.0',
    dtuReferences: ptRefs('rgeu'),
    hypothesesACommuniquer: [
      'Suporte: parede plana sem fissuras (irregularidade < 1 cm)',
      'Placa BA10 ou BA13',
      'Cola MAP (massa adesiva para pladur) em porções cada 40 cm',
      'Consumo cola: ≈ 4 kg/m²',
      'Acabamento: banda + massa de juntas',
    ],
    materials: [
      {
        id: 'placa-ba13-pt', name: 'Placa pladur BA13',
        category: 'plaque', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.08, wasteReason: 'Cortes',
        manufacturerRef: 'Placopla / Knauf',
      },
      {
        id: 'cola-map-pt', name: 'Cola MAP pladur (Placopla)',
        category: 'colle', phase: 'principal', quantityPerBase: 4, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Preparação, secagem',
        manufacturerRef: 'Placopla (MAP)',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'saco 25 kg' },
      },
      {
        id: 'banda-juntas-pt', name: 'Banda de juntas',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.8, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sobreposição',
      },
      {
        id: 'massa-juntas-pt', name: 'Massa de juntas',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.4, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Secagem',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  //  4. PAREDE PLADUR HIDRÓFUGA (casa de banho)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'parede-pladur-hidrofuga-pt',
    name: 'Parede pladur hidrófuga 72/48 (casa de banho / cozinha)',
    description: 'Divisória com placa pladur hidrófuga verde + estrutura 48 + impermeabilização pé-de-parede.',
    country: 'PT',
    trade: 'placo',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    version: '2.0.0',
    dtuReferences: ptRefs('rgeu'),
    hypothesesACommuniquer: [
      'Placa pladur hidrófuga BA13 verde (zonas húmidas)',
      'Impermeabilização pé-de-parede obrigatória (subida 20 cm)',
      'Tratamento juntas com massa hidrófuga',
      'Faixa de impermeabilização nas esquinas internas',
      'Suporte obrigatório para cerâmico (peso ≤ 30 kg/m²)',
    ],
    materials: [
      {
        id: 'placa-ba13-hidrofuga-pt', name: 'Placa pladur hidrófuga BA13 verde',
        category: 'plaque', phase: 'principal', quantityPerBase: 2, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Cortes',
        normRef: 'NP EN 520+A1 (2010)', manufacturerRef: 'Placopla / Knauf (BA13 H)',
      },
      {
        id: 'montante-m48-pt', name: 'Montante M48',
        category: 'ossature', phase: 'principal', quantityPerBase: 1.7, unit: 'ml',
        geometryMultiplier: 'height',
        wasteFactor: 1.10, wasteReason: 'Cortes',
      },
      {
        id: 'guia-r48-pt', name: 'Guia R48',
        category: 'ossature', phase: 'principal', quantityPerBase: 0.7, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Cortes',
      },
      {
        id: 'la-mineral-45-pt', name: 'Lã mineral 45 mm',
        category: 'isolant', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.07, wasteReason: 'Cortes',
      },
      {
        id: 'impermeabilizante-pared-pt', name: 'Impermeabilização SPEC pé-de-parede (Sika / Mapei)',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 0.3, unit: 'kg',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.10, wasteReason: 'Aplicação',
        manufacturerRef: 'Sika SikaSeal-107 / Mapei Mapelastic',
      },
      {
        id: 'parafusos-pladur-25-pt', name: 'Parafusos pladur hidrófugos 25 mm',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 35, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perda',
      },
      {
        id: 'massa-juntas-hidro-pt', name: 'Massa de juntas hidrófuga',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.7, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Secagem',
        manufacturerRef: 'Placopla',
      },
    ],
  },
]
