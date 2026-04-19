import { Recipe } from '../types';

/**
 * ============================================================
 *  CARRELAGE — v2 AUDITÉE
 *  
 *  Corrections majeures :
 *  - Croisillons 45×45 : 5/m² (et non 15) — CORRECTION CRITIQUE ×3
 *  - Joints : ratios par format (20×20, 45×45, 60×60)
 *  - Colle : peignes documentés selon DTU 52.2
 * ============================================================
 */

export const carrelageRecipes: Recipe[] = [
  // ══════════════════════════════════════════════════════════
  //  SOL INTÉRIEUR COLLÉ
  // ══════════════════════════════════════════════════════════

  {
    id: 'carrelage-sol-colle-45',
    name: 'Carrelage sol intérieur grès cérame 45×45 (pose collée)',
    description: 'Format courant sol résidentiel. Double encollage DTU 52.2 peigne U9.',
    trade: 'carrelage',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'DTU 52.2', title: 'Pose collée des revêtements céramiques et assimilés' },
    ],
    version: '2.0.0',
    constraints: {
      minArea: 2,
      note: 'Format > 30×30 → double encollage obligatoire (DTU 52.2 § 6.4).',
    },
    materials: [
      {
        id: 'carreau-gres-cerame-45', name: 'Carreau grès cérame 45×45',
        category: 'carreau', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Découpes rives + coupes standards (DTU 52.2)',
        dtu: 'DTU 52.2 § 5', notes: 'Pose droite. Majorer à 15% pour pose diagonale.',
      },
      {
        id: 'primaire-accrochage-sol', name: 'Primaire d\'accrochage (sur chape/béton)',
        category: 'primaire', quantityPerBase: 0.15, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac + résidus pinceau',
        dtu: 'DTU 52.2 § 6.2', manufacturerRef: 'Weber Prim — 150 g/m² dilué',
        packaging: { unit: 'pot', contentQty: 5, contentUnit: 'kg', label: 'bidon 5 kg' },
      },
      {
        id: 'colle-carrelage-c2', name: 'Mortier-colle C2 amélioré (double encollage peigne U9)',
        category: 'colle', quantityPerBase: 5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Résidus bac + sur-dosage pratique',
        dtu: 'DTU 52.2 § 6.4', normRef: 'NF EN 12004 - classe C2',
        manufacturerRef: 'Weber colflex / Mapei Keraflex - 5 kg/m² double encollage',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'joint-carrelage-3mm', name: 'Joint mortier ciment (joints 3 mm)',
        category: 'joint', quantityPerBase: 0.24, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus, sur-dosage',
        dtu: 'DTU 52.2 § 7', manufacturerRef: 'Mapei Ultracolor Plus - formule par format',
        packaging: { unit: 'sac', contentQty: 5, contentUnit: 'kg', label: 'sac 5 kg' },
        notes: 'Base : formule (L+l)×e×j×1,8/(L×l) avec L=l=450mm, e=10mm, j=3mm = 0,24 kg/m².',
      },
      {
        id: 'croisillons-3mm', name: 'Croisillons auto-nivelants 3 mm',
        category: 'accessoire', quantityPerBase: 5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Perte chantier, non récupérés',
        notes: 'Base : 1 croisillon/intersection = 1/(0,45×0,45) ≈ 5/m² (pas 4 par carreau !).',
        packaging: { unit: 'u', contentQty: 500, contentUnit: 'u', label: 'sachet 500 pièces' },
      },
      {
        id: 'silicone-sanitaire', name: 'Silicone sanitaire (joint périphérique)',
        category: 'joint', quantityPerBase: 0.4, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purge début cartouche',
        dtu: 'DTU 52.2 § 7.4 - joint périphérique obligatoire',
        packaging: { unit: 'cartouche', contentQty: 12, contentUnit: 'ml', label: 'cartouche 310 ml (~12 ml joint)' },
        notes: 'Rendement cartouche pour joint 6×6 mm.',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  SOL GRAND FORMAT 60×60
  // ══════════════════════════════════════════════════════════

  {
    id: 'carrelage-sol-colle-60',
    name: 'Carrelage sol grès cérame 60×60 (grand format)',
    description: 'Format rectifié grand format. Colle C2S1 déformable + double encollage peigne U10.',
    trade: 'carrelage',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [{ code: 'DTU 52.2', title: 'Pose collée des revêtements céramiques' }],
    version: '2.0.0',
    constraints: { minArea: 4, note: 'Format > 60×60 → C2S1 obligatoire (DTU 52.2).' },
    materials: [
      {
        id: 'carreau-gres-cerame-60', name: 'Carreau grès cérame 60×60 rectifié',
        category: 'carreau', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Casse transport + coupes (grand format DTU 52.2)',
        dtu: 'DTU 52.2',
      },
      {
        id: 'primaire-accrochage-sol', name: 'Primaire d\'accrochage',
        category: 'primaire', quantityPerBase: 0.15, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac + résidus', dtu: 'DTU 52.2',
        packaging: { unit: 'pot', contentQty: 5, contentUnit: 'kg', label: 'bidon 5 kg' },
      },
      {
        id: 'colle-carrelage-c2s1', name: 'Mortier-colle C2S1 déformable (peigne U10)',
        category: 'colle', quantityPerBase: 6.5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Résidus bac + sur-dosage',
        dtu: 'DTU 52.2 § 6.4', normRef: 'NF EN 12004 - classe C2S1',
        manufacturerRef: 'Mapei Keraflex Maxi S1 - 6-7 kg/m²',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'joint-carrelage-2mm', name: 'Joint souple (joints 2 mm pour rectifié)',
        category: 'joint', quantityPerBase: 0.18, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus',
        dtu: 'DTU 52.2', manufacturerRef: 'Mapei - 0,18 kg/m² pour 60×60 joint 2mm',
        packaging: { unit: 'sac', contentQty: 5, contentUnit: 'kg', label: 'sac 5 kg' },
      },
      {
        id: 'croisillons-2mm', name: 'Croisillons 2 mm',
        category: 'accessoire', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Perte chantier',
        notes: '1/(0,60×0,60) ≈ 3 croisillons/m².',
        packaging: { unit: 'u', contentQty: 500, contentUnit: 'u', label: 'sachet 500 pièces' },
      },
      {
        id: 'silicone-sanitaire', name: 'Silicone sanitaire',
        category: 'joint', quantityPerBase: 0.4, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purge cartouche', dtu: 'DTU 52.2 § 7.4',
        packaging: { unit: 'cartouche', contentQty: 12, contentUnit: 'ml', label: 'cartouche 310 ml' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  FAÏENCE MURALE
  // ══════════════════════════════════════════════════════════

  {
    id: 'carrelage-mur-faience-20',
    name: 'Faïence murale 20×20 (salle de bain / cuisine)',
    description: 'Faïence petit format. SPEC primaire en pièces humides + simple encollage peigne U6.',
    trade: 'carrelage',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [
      { code: 'DTU 52.2', title: 'Pose collée' },
      { code: 'CPT 3578', title: 'Systèmes de protection à l\'eau sous carrelage (SPEC)' },
    ],
    version: '2.0.0',
    materials: [
      {
        id: 'carreau-faience-20', name: 'Carreau faïence 20×20',
        category: 'carreau', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Casse + coupes (DTU 52.2 pose murale 10-15%)', dtu: 'DTU 52.2',
      },
      {
        id: 'spec-primaire-hydrofuge', name: 'SPEC primaire hydrofuge (pièces humides)',
        category: 'primaire', quantityPerBase: 0.2, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac + résidus pinceau',
        dtu: 'CPT 3578', manufacturerRef: 'Weber Sys Protec',
        packaging: { unit: 'pot', contentQty: 7, contentUnit: 'kg', label: 'bidon 7 kg' },
        notes: 'À exclure en pièce sèche (cuisine crédence sans projection).',
      },
      {
        id: 'colle-carrelage-c2', name: 'Mortier-colle C2 (simple encollage peigne U6)',
        category: 'colle', quantityPerBase: 3.5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Résidus + sur-dosage',
        dtu: 'DTU 52.2 § 6.3 - simple encollage mur', manufacturerRef: 'Weber colflex - peigne 6mm',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'joint-carrelage-3mm', name: 'Joint mortier ciment (3 mm)',
        category: 'joint', quantityPerBase: 0.54, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus',
        dtu: 'DTU 52.2', manufacturerRef: 'Mapei - petit format = plus de joint/m²',
        packaging: { unit: 'sac', contentQty: 5, contentUnit: 'kg', label: 'sac 5 kg' },
        notes: 'Base : (200+200)×10×3×1,8/(200×200) = 0,54 kg/m².',
      },
      {
        id: 'croisillons-2mm', name: 'Croisillons 2 mm',
        category: 'accessoire', quantityPerBase: 25, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Perte chantier',
        notes: '1/(0,20×0,20) = 25 croisillons/m². Petit format → beaucoup.',
        packaging: { unit: 'u', contentQty: 500, contentUnit: 'u', label: 'sachet 500' },
      },
      {
        id: 'silicone-sanitaire', name: 'Silicone sanitaire (angles + raccord sanitaires)',
        category: 'joint', quantityPerBase: 0.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purge cartouche',
        dtu: 'DTU 52.2 § 7.4',
        packaging: { unit: 'cartouche', contentQty: 12, contentUnit: 'ml', label: 'cartouche 310 ml' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  TERRASSE EXTÉRIEURE
  // ══════════════════════════════════════════════════════════

  {
    id: 'carrelage-terrasse-spec',
    name: 'Carrelage terrasse extérieur avec SPEC (sur chape pente)',
    description: 'Grès cérame R11. Support préparé avec pente 1,5%. SPEC étanchéité + C2S1 double encollage.',
    trade: 'carrelage',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'DTU 52.2', title: 'Pose collée céramiques' },
      { code: 'CPT 3578', title: 'SPEC sous carrelage extérieur' },
    ],
    version: '2.0.0',
    materials: [
      {
        id: 'carreau-gres-r11', name: 'Carrelage grès cérame R11 (antidérapant ext.)',
        category: 'carreau', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Casse + coupes (pose extérieure DTU 52.2)', dtu: 'DTU 52.2',
      },
      {
        id: 'spec-etancheite-resine', name: 'Système SPEC (2 couches étanchéité résine)',
        category: 'etancheite', quantityPerBase: 2.5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus pot + deux passes',
        dtu: 'CPT 3578', manufacturerRef: 'Weber Sys Protec - 2 couches × 1,25 kg/m²',
        packaging: { unit: 'pot', contentQty: 25, contentUnit: 'kg', label: 'bidon 25 kg' },
      },
      {
        id: 'bande-etancheite-spec', name: 'Bande d\'étanchéité armée (joints fractionnement)',
        category: 'etancheite', quantityPerBase: 0.5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Chutes + recouvrements', dtu: 'CPT 3578',
        packaging: { unit: 'rouleau', contentQty: 10, contentUnit: 'ml', label: 'rouleau 10 m' },
      },
      {
        id: 'colle-carrelage-c2s1', name: 'Colle C2S1 déformable extérieure',
        category: 'colle', quantityPerBase: 6, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.12, wasteReason: 'Résidus + sur-dosage',
        dtu: 'DTU 52.2 - double encollage extérieur', normRef: 'NF EN 12004 - C2S1',
        manufacturerRef: 'Mapei Keraflex Maxi S1',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'joint-souple-uv', name: 'Joint souple résistant UV',
        category: 'joint', quantityPerBase: 0.4, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus',
        dtu: 'DTU 52.2', manufacturerRef: 'Mapei Ultracolor Plus',
        packaging: { unit: 'sac', contentQty: 5, contentUnit: 'kg', label: 'sac 5 kg' },
      },
      {
        id: 'profile-fractionnement', name: 'Profilé de fractionnement + silicone',
        category: 'joint', quantityPerBase: 0.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Coupes',
        dtu: 'DTU 52.2 - fractionnement tous les 40 m² ext.',
      },
    ],
  },
];
