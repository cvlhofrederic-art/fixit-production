import { Recipe } from '../types';

/**
 * ============================================================
 *  PLÂTRERIE / PLACO — v2 AUDITÉE
 *  
 *  Corrections :
 *  - Montants 1.80 ml/m² (au lieu de 1.67) : intègre bord + bord
 *  - Chevilles 2.0/m² (au lieu de 1.5) : DTU 25.41 tous les 60 cm
 *  - Vis TTPC : documenté (28 vis/m² réel, 30 avec marge)
 * ============================================================
 */

export const placoRecipes: Recipe[] = [
  // ══════════════════════════════════════════════════════════
  //  CLOISON 72/48 (simple peau BA13)
  // ══════════════════════════════════════════════════════════

  {
    id: 'cloison-placo-72-48',
    name: 'Cloison Placo 72/48 (simple peau BA13, ossature M48)',
    description: 'Cloison distributive standard. H max 2,60 m avec M48. Isolation acoustique laine 45 mm incluse.',
    trade: 'placo',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [
      { code: 'DTU 25.41', title: 'Ouvrages en plaques de plâtre (cloisons, plafonds, doublages sur ossature)' },
    ],
    version: '2.0.0',
    constraints: { maxHeight: 2.6, note: 'Au-delà de 2,60 m, passer en 98/48 ou 100/70.' },
    materials: [
      {
        id: 'plaque-ba13', name: 'Plaque de plâtre BA13 standard 2500×1200 mm',
        category: 'plaque', quantityPerBase: 2, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Découpes et chutes (DTU 25.41)',
        dtu: 'DTU 25.41', manufacturerRef: 'Placoplatre® BA13',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'm2', label: 'plaque 2,5×1,2m (3 m²)' },
        notes: '2 m² de plaque par m² de cloison (1 face × 2).',
      },
      {
        id: 'rail-r48', name: 'Rail R48 (longueur 3 m)',
        category: 'ossature', quantityPerBase: 0.8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + sur-longueurs',
        dtu: 'DTU 25.41', manufacturerRef: 'Placo® Stil® Prim',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'rail 3 m' },
        notes: 'Ratio moyen pour hauteur 2,5 m (=2/h). Acceptable entre 2,4 et 2,7 m.',
      },
      {
        id: 'montant-m48', name: 'Montant M48 (longueur 3 m)',
        category: 'ossature', quantityPerBase: 1.80, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes, bords et renforts ouvertures',
        dtu: 'DTU 25.41 § 6.2 - entraxe 60 cm', manufacturerRef: 'Placo® Stil® M48',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'montant 3 m' },
        notes: 'Ratio 1,80 ml/m² intègre le montant de bord (DTU 25.41).',
      },
      {
        id: 'vis-ttpc-25', name: 'Vis TTPC 25 mm (plaques sur ossature)',
        category: 'fixation', quantityPerBase: 30, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte chantier + rebuts',
        dtu: 'DTU 25.41 § 6.3', manufacturerRef: 'Placo® Stil® - 15 vis/m²/face',
        packaging: { unit: 'u', contentQty: 1000, contentUnit: 'u', label: 'boîte 1000 vis' },
        notes: 'Base : vis tous les 30 cm sur pourtour et intermédiaires = 28-30 vis/m² × 2 faces.',
      },
      {
        id: 'cheville-frapper-6x40', name: 'Cheville à frapper 6×40 (fixation rails)',
        category: 'fixation', quantityPerBase: 2.0, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Casse + rebuts',
        dtu: 'DTU 25.41 § 6.1 - fixation rails tous les 60 cm',
        packaging: { unit: 'u', contentQty: 100, contentUnit: 'u', label: 'boîte 100 chevilles' },
        notes: 'Base : 2 rails × (1/0,6) chevilles par ml + extrémités.',
      },
      {
        id: 'bande-joint-papier', name: 'Bande à joints papier',
        category: 'accessoire', quantityPerBase: 1.8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes',
        dtu: 'DTU 25.41 § 7', manufacturerRef: 'Placo® - joints verticaux + horizontaux',
        packaging: { unit: 'rouleau', contentQty: 150, contentUnit: 'ml', label: 'rouleau 150 m' },
      },
      {
        id: 'enduit-joint', name: 'Enduit à joints (poudre)',
        category: 'enduit', quantityPerBase: 0.5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sur-dosage, résidus',
        dtu: 'DTU 25.41 § 7', manufacturerRef: 'Placo® PR4 ou PR3',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'laine-verre-45', name: 'Laine de verre 45 mm (R = 1,25) — acoustique',
        category: 'isolant', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.07, wasteReason: 'Découpes sur ossature',
        manufacturerRef: 'Isover PAR — rouleau 45 mm',
        packaging: { unit: 'rouleau', contentQty: 10.8, contentUnit: 'm2', label: 'rouleau 10,8 m²' },
        notes: 'Option acoustique. Omettre si cloison purement distributive sans exigence.',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  CLOISON 98/48 (double peau BA13)
  // ══════════════════════════════════════════════════════════

  {
    id: 'cloison-placo-98-48',
    name: 'Cloison Placo 98/48 (double peau BA13 renforcée acoustique)',
    description: 'Cloison avec 2 plaques BA13 par face. H max 3,30 m. Isolation 45 mm recommandée.',
    trade: 'placo',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [{ code: 'DTU 25.41', title: 'Ouvrages en plaques de plâtre' }],
    version: '2.0.0',
    constraints: { maxHeight: 3.3 },
    materials: [
      {
        id: 'plaque-ba13', name: 'Plaque BA13 (4 plaques par m² : 2 faces × 2 couches)',
        category: 'plaque', quantityPerBase: 4, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Découpes et chutes',
        dtu: 'DTU 25.41', manufacturerRef: 'Placoplatre® BA13',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'm2', label: 'plaque 2,5×1,2m' },
      },
      {
        id: 'rail-r48', name: 'Rail R48',
        category: 'ossature', quantityPerBase: 0.8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + sur-longueurs', dtu: 'DTU 25.41',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'rail 3 m' },
      },
      {
        id: 'montant-m48', name: 'Montant M48',
        category: 'ossature', quantityPerBase: 1.80, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + bords', dtu: 'DTU 25.41 § 6.2',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'montant 3 m' },
      },
      {
        id: 'vis-ttpc-25', name: 'Vis TTPC 25 mm (1ère peau)',
        category: 'fixation', quantityPerBase: 30, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte chantier', dtu: 'DTU 25.41',
        packaging: { unit: 'u', contentQty: 1000, contentUnit: 'u', label: 'boîte 1000 vis' },
      },
      {
        id: 'vis-ttpc-35', name: 'Vis TTPC 35 mm (2ème peau)',
        category: 'fixation', quantityPerBase: 30, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte chantier',
        dtu: 'DTU 25.41', manufacturerRef: 'Placo® - vis longues pour 2ème peau',
        packaging: { unit: 'u', contentQty: 1000, contentUnit: 'u', label: 'boîte 1000 vis' },
      },
      {
        id: 'cheville-frapper-6x40', name: 'Cheville à frapper 6×40',
        category: 'fixation', quantityPerBase: 2.0, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Casse', dtu: 'DTU 25.41',
        packaging: { unit: 'u', contentQty: 100, contentUnit: 'u', label: 'boîte 100' },
      },
      {
        id: 'bande-joint-papier', name: 'Bande à joints papier',
        category: 'accessoire', quantityPerBase: 1.8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes', dtu: 'DTU 25.41',
        packaging: { unit: 'rouleau', contentQty: 150, contentUnit: 'ml', label: 'rouleau 150 m' },
      },
      {
        id: 'enduit-joint', name: 'Enduit à joints',
        category: 'enduit', quantityPerBase: 0.5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sur-dosage', dtu: 'DTU 25.41',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'laine-verre-45', name: 'Laine de verre 45 mm',
        category: 'isolant', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.07, wasteReason: 'Découpes', manufacturerRef: 'Isover PAR',
        packaging: { unit: 'rouleau', contentQty: 10.8, contentUnit: 'm2', label: 'rouleau 10,8 m²' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  DOUBLAGE COLLÉ
  // ══════════════════════════════════════════════════════════

  {
    id: 'doublage-colle-pse-80',
    name: 'Doublage collé BA13 + PSE 80 mm (R = 2,10)',
    description: 'Doublage thermique sur mur maçonné. Panneau PSE Th38 80 mm contrecollé BA13.',
    trade: 'placo',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [{ code: 'DTU 25.42', title: 'Doublages et habillages collés' }],
    version: '2.0.0',
    materials: [
      {
        id: 'doublage-pse-80-ba13', name: 'Placomur® PSE Th38 80+13 (2,50×1,20 m)',
        category: 'plaque', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Découpes',
        dtu: 'DTU 25.42', manufacturerRef: 'Placo® Doublissimo® 80+13',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'm2', label: 'panneau 2,5×1,2m' },
      },
      {
        id: 'mortier-collage-map', name: 'Mortier adhésif type MAP (plots de collage)',
        category: 'colle', quantityPerBase: 3.5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus seau, sur-dosage',
        dtu: 'DTU 25.42 § 6', manufacturerRef: 'Placo® MAP — 3 à 4 kg/m²',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'bande-joint-papier', name: 'Bande à joints papier',
        category: 'accessoire', quantityPerBase: 1.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes',
        dtu: 'DTU 25.42 § 7', notes: 'Joints verticaux uniquement sur doublage.',
        packaging: { unit: 'rouleau', contentQty: 150, contentUnit: 'ml', label: 'rouleau 150 m' },
      },
      {
        id: 'enduit-joint', name: 'Enduit à joints',
        category: 'enduit', quantityPerBase: 0.35, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sur-dosage', dtu: 'DTU 25.42',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  PLAFOND F530
  // ══════════════════════════════════════════════════════════

  {
    id: 'plafond-placo-f530',
    name: 'Plafond suspendu Placo (ossature F530, BA13)',
    description: 'Plafond sur ossature métallique suspendue. Porteuses 1,20 m, fourrures 60 cm, suspentes 1,20 m.',
    trade: 'placo',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [{ code: 'DTU 25.41', title: 'Ouvrages en plaques de plâtre - plafonds' }],
    version: '2.0.0',
    materials: [
      {
        id: 'plaque-ba13', name: 'Plaque BA13',
        category: 'plaque', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Découpes',
        dtu: 'DTU 25.41', packaging: { unit: 'u', contentQty: 3, contentUnit: 'm2', label: 'plaque 2,5×1,2m' },
      },
      {
        id: 'fourrure-f530', name: 'Fourrure F530 (longueur 3 m)',
        category: 'ossature', quantityPerBase: 1.67, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'DTU 25.41 § 6.4 - entraxe fourrures 60 cm', manufacturerRef: 'Placo® Stil® F530',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'fourrure 3 m' },
      },
      {
        id: 'suspente-acoustique', name: 'Suspente acoustique F530',
        category: 'fixation', quantityPerBase: 0.7, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse, réglage',
        dtu: 'DTU 25.41', notes: 'Grille 1,20 × 0,60 m = 1 suspente / 1,44 m² ≈ 0,7/m².',
      },
      {
        id: 'eclisse-fourrure', name: 'Éclisse de raccord fourrure',
        category: 'fixation', quantityPerBase: 0.3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
        dtu: 'DTU 25.41',
      },
      {
        id: 'vis-ttpc-25', name: 'Vis TTPC 25',
        category: 'fixation', quantityPerBase: 15, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte', dtu: 'DTU 25.41 - 15 vis/m²',
        packaging: { unit: 'u', contentQty: 1000, contentUnit: 'u', label: 'boîte 1000 vis' },
      },
      {
        id: 'corniere-periph-25', name: 'Cornière périphérique 25×25',
        category: 'ossature', quantityPerBase: 0.5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes angles', dtu: 'DTU 25.41',
        notes: 'Ratio moyen pièce standard. Ajuster selon périmètre réel si pièce atypique.',
      },
      {
        id: 'bande-joint-papier', name: 'Bande à joints',
        category: 'accessoire', quantityPerBase: 1.4, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes', dtu: 'DTU 25.41',
        packaging: { unit: 'rouleau', contentQty: 150, contentUnit: 'ml', label: 'rouleau 150 m' },
      },
      {
        id: 'enduit-joint', name: 'Enduit à joints',
        category: 'enduit', quantityPerBase: 0.4, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sur-dosage', dtu: 'DTU 25.41',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'laine-verre-200', name: 'Laine de verre 200 mm (R = 6,25) — si combles perdus',
        category: 'isolant', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Découpes', manufacturerRef: 'Isover Isoconfort 35',
        packaging: { unit: 'rouleau', contentQty: 4.7, contentUnit: 'm2', label: 'rouleau 4,7 m²' },
        notes: 'Inclure uniquement si plafond sous combles perdus.',
      },
    ],
  },
];
