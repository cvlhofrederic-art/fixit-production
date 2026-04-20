import type { Recipe } from '../types'

/**
 * TERRASSES EXTÉRIEURES — audit #26
 *
 * Référentiels FR :
 * - NF DTU 51.4   Platelages bois extérieurs (rev. 2018)
 * - NF DTU 52.2   Carrelage extérieur collé (cf. carrelage.ts)
 * - NF DTU 43.1   Si terrasse-toiture (cf. etancheite.ts)
 */

export const terrasseExterieureRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #26.1 TERRASSE BOIS SUR PLOTS
  // ══════════════════════════════════════════════════════════
  {
    id: 'terrasse-bois-plots',
    name: 'Terrasse bois sur plots réglables (ipé / douglas)',
    description: 'Lames bois sur lambourdes 45×70 classe 4 posées sur plots PVC réglables. Pente 1-2% drainage.',
    trade: 'terrasse_ext',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 51.4', title: 'Platelages extérieurs bois (rev. 2018)' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Essences premium : ipé, teck, douglas, pin classe 4',
      'Plots PVC réglables Jouplast / Alphaplot (4 plots/m²)',
      'Lambourdes 45×70 classe 4 entraxe 40 cm (3 ml/m²)',
      'Vis inox A2 ou A4 (bord de mer) — 25 vis/m²',
      'Profils de finition alu périphériques',
      'Pente 1-2% obligatoire drainage eau',
    ],
    materials: [
      {
        id: 'plot-pvc-reglable-terrasse', name: 'Plots PVC réglables',
        category: 'accessoire', phase: 'preparation', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse',
        manufacturerRef: 'Jouplast / Alphaplot',
      },
      {
        id: 'lambourde-bois-45-70', name: 'Lambourdes bois 45×70 classe 4',
        category: 'bois', phase: 'principal', quantityPerBase: 3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        normRef: 'NF EN 14081',
      },
      {
        id: 'lame-terrasse-bois', name: 'Lames terrasse bois (ipé / douglas / pin classe 4)',
        category: 'bois', phase: 'principal', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 51.4',
      },
      {
        id: 'vis-inox-terrasse', name: 'Vis inox A2 ou A4 (bord de mer)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 25, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'profil-finition-alu-terrasse', name: 'Profils finition alu (périmètre)',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 0.4, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #26.2 TERRASSE COMPOSITE (WPC)
  // ══════════════════════════════════════════════════════════
  {
    id: 'terrasse-composite-wpc',
    name: 'Terrasse composite WPC (Silvadec / Fiberon)',
    description: 'Lames composite WPC (wood-plastic-composite) durable 25+ ans. Fixation clips invisibles.',
    trade: 'terrasse_ext',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 51.4', title: 'Platelages extérieurs (référence)' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Lames composite WPC Silvadec / Fiberon / Trex',
      'Lambourdes alu (vs bois) — durabilité 30+ ans',
      'Clips de fixation invisibles (fournis avec lames)',
      'Pas de traitement à prévoir — durabilité usine',
      'Plots PVC identiques terrasse bois',
    ],
    materials: [
      {
        id: 'plot-pvc-reglable-terrasse-wpc', name: 'Plots PVC réglables',
        category: 'accessoire', phase: 'preparation', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse',
      },
      {
        id: 'lambourde-alu-terrasse', name: 'Lambourdes alu (durables 30+ ans)',
        category: 'ossature', phase: 'principal', quantityPerBase: 3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'lame-composite-wpc', name: 'Lames composite WPC',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        manufacturerRef: 'Silvadec / Fiberon / Trex',
      },
      {
        id: 'clip-invisible-wpc', name: 'Clips invisibles (fixation lames)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 20, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #26.3 CARRELAGE EXTÉRIEUR
  // ══════════════════════════════════════════════════════════
  {
    id: 'terrasse-carrelage-ext',
    name: 'Carrelage terrasse extérieur grès cérame R11',
    description: 'Carrelage grès cérame antidérapant R11 pose scellée ou collée. Colle C2S2 flexible obligatoire.',
    trade: 'terrasse_ext',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 52.2', title: 'Pose collée revêtements céramiques' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Grès cérame classe R11 antidérapant OBLIGATOIRE extérieur',
      'Colle C2S2 flexible (résistance gel/dégel)',
      'Joints 5-8 mm anti-dilatation (vs 3 mm intérieur)',
      'Dalle support béton avec pente 1-2% drainage',
      'Alternative : pose sur plots (drainage automatique)',
    ],
    materials: [
      {
        id: 'primaire-exterieur-carrelage', name: 'Primaire d\'accrochage extérieur',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac',
      },
      {
        id: 'carreau-gres-r11-ext', name: 'Carreau grès cérame R11 extérieur',
        category: 'carreau', phase: 'principal', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 52.2',
      },
      {
        id: 'colle-c2s2-flexible', name: 'Mortier colle C2S2 flexible (résistance gel)',
        category: 'colle', phase: 'principal', quantityPerBase: 5.5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Résidus + sur-dosage',
        dtu: 'NF DTU 52.2 §6.4', normRef: 'NF EN 12004 classe C2S2',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'joint-exterieur-5mm', name: 'Joint extérieur 5-8 mm (anti-dilatation)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.4, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sur-dosage',
      },
      {
        id: 'silicone-ext-terrasse', name: 'Silicone périphérique extérieur',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.3, unit: 'ml', geometryMultiplier: 'perimeter',
        wasteFactor: 1.15, wasteReason: 'Purge cartouche',
      },
    ],
  },
]
