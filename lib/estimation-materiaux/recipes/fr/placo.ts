import { Recipe } from '../../types';

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
      { code: 'NF DTU 25.41 (Février 2022)', title: 'Ouvrages en plaques de plâtre (cloisons, plafonds, doublages sur ossature)' },
    ],
    version: '2.1.0',
    constraints: { maxHeight: 2.6, note: 'Au-delà de 2,60 m, passer en 98/48 ou 100/70.' },
    hypothesesACommuniquer: [
      'Hauteur supposée 2,5 m (cloison standard) — adapter ratios rails si >2,7 m',
      'Entraxe montants 60 cm (DTU 25.41 § 6.2)',
      'Laine acoustique 45 mm incluse par défaut (ôter si cloison purement distributive)',
      'Cornières périphériques + joint acoustique PU NON inclus par défaut — à ajouter si cloison séparative',
    ],
    materials: [
      {
        id: 'plaque-ba13', name: 'Plaque de plâtre BA13 standard 2500×1200 mm',
        category: 'plaque', phase: 'principal', quantityPerBase: 2, unit: 'm2', geometryMultiplier: 'none',
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
        category: 'fixation', phase: 'accessoires', quantityPerBase: 30, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte chantier + rebuts',
        dtu: 'DTU 25.41 § 6.3', manufacturerRef: 'Placo® Stil® - 15 vis/m²/face',
        packaging: { unit: 'u', contentQty: 1000, contentUnit: 'u', label: 'boîte 1000 vis' },
        notes: 'Base : vis tous les 30 cm sur pourtour et intermédiaires = 28-30 vis/m² × 2 faces.',
      },
      {
        id: 'cheville-frapper-6x40', name: 'Cheville à frapper 6×40 (fixation rails)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 2.0, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Casse + rebuts',
        dtu: 'DTU 25.41 § 6.1 - fixation rails tous les 60 cm',
        packaging: { unit: 'u', contentQty: 100, contentUnit: 'u', label: 'boîte 100 chevilles' },
        notes: 'Base : 2 rails × (1/0,6) chevilles par ml + extrémités.',
      },
      {
        id: 'bande-joint-papier', name: 'Bande à joints papier',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 1.8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes',
        dtu: 'DTU 25.41 § 7', manufacturerRef: 'Placo® - joints verticaux + horizontaux',
        packaging: { unit: 'rouleau', contentQty: 150, contentUnit: 'ml', label: 'rouleau 150 m' },
      },
      {
        id: 'enduit-joint', name: 'Enduit à joints (poudre)',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sur-dosage, résidus',
        dtu: 'DTU 25.41 § 7', manufacturerRef: 'Placo® PR4 ou PR3',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'laine-verre-45', name: 'Laine de verre 45 mm (R = 1,25) — acoustique',
        category: 'isolant', phase: 'principal', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.07, wasteReason: 'Découpes sur ossature',
        manufacturerRef: 'Isover PAR — rouleau 45 mm',
        packaging: { unit: 'rouleau', contentQty: 10.8, contentUnit: 'm2', label: 'rouleau 10,8 m²' },
        notes: 'Option acoustique. Omettre si cloison purement distributive sans exigence.',
      },
      {
        id: 'joint-acoustique-pu', name: 'Joint acoustique PU sous rails',
        category: 'joint', phase: 'preparation', quantityPerBase: 0.8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes rives',
        dtu: 'DTU 25.41', manufacturerRef: 'Placo® Stil® joint mousse',
        optional: true,
        condition: 'Si cloison séparative entre logements ou bureaux (désolidarisation acoustique)',
      },
      // ═══════════ AJOUTS AUDIT #13.1 (avril 2026) ═══════════
      {
        id: 'corniere-angle-metal', name: 'Cornière d\'angle métallique (renfort angles sortants)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.3, unit: 'ml',
        geometryMultiplier: 'height',
        wasteFactor: 1.10, wasteReason: 'Coupes + casse transport',
        dtu: 'NF DTU 25.41 §6.5',
        manufacturerRef: 'Placo® cornière 2,50 m',
        packaging: { unit: 'u', contentQty: 2.5, contentUnit: 'ml', label: 'cornière 2,50 m' },
        notes: '1 angle sortant tous les ~3 m² (hypothèse).',
      },
      {
        id: 'enduit-finition-placo', name: 'Enduit de finition 2e passe (après bandes)',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.3, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus taloche, sur-dosage',
        dtu: 'NF DTU 25.41 §7.3',
        manufacturerRef: 'Placo PR4 / Weber Lisso',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'papier-verre-180-placo', name: 'Papier de verre grain 180 (ponçage plaques)',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 0.1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Usure feuille',
        packaging: { unit: 'u', contentQty: 10, contentUnit: 'u', label: 'paquet 10 feuilles' },
      },
      {
        id: 'rail-renfort-charge-mur', name: 'Rail de renfort porte-charge (Placo® 80×60)',
        category: 'ossature', phase: 'principal', quantityPerBase: 0.5, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 25.41',
        manufacturerRef: 'Placo® Stil® Rail de renfort',
        optional: true,
        condition: 'Si pose mobilier lourd (WC suspendu, vasque, TV, bibliothèque)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  CLOISON 98/48 (double peau BA13)
  // ══════════════════════════════════════════════════════════

  {
    id: 'cloison-placo-98-48',
    name: 'Cloison Placo 98/48 (double peau BA13 renforcée acoustique)',
    description: 'Cloison avec 2 plaques BA13 par face. H max 3,30 m. Isolation 45 mm recommandée. Performance acoustique 49 dB.',
    trade: 'placo',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [{ code: 'NF DTU 25.41 (Février 2022)', title: 'Ouvrages en plaques de plâtre sur ossature', section: 'Rev. Février 2022 applicable Mai 2022 — remplace rev. Décembre 2012' }],
    version: '2.1.0',
    constraints: { maxHeight: 3.3 },
    hypothesesACommuniquer: [
      'Double peau BA13 : 4 plaques/m² (2 faces × 2 couches)',
      'H max 3,30 m avec M48 — au-delà, passer en M70 ou M100',
      'Laine 45 mm incluse — performance acoustique 49 dB',
      'Entraxe montants 60 cm (DTU 25.41 §6.2)',
      'Enduit en 2 passes obligatoire (DTU 25.41 §7.3)',
      'Cornières d\'angle + joint acoustique PU optionnels selon exigence',
    ],
    materials: [
      {
        id: 'plaque-ba13', name: 'Plaque BA13 (4 plaques par m² : 2 faces × 2 couches)',
        category: 'plaque', phase: 'principal', quantityPerBase: 4, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Découpes et chutes',
        dtu: 'NF DTU 25.41', manufacturerRef: 'Placoplatre® BA13',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'm2', label: 'plaque 2,5×1,2m' },
      },
      {
        id: 'rail-r48', name: 'Rail R48',
        category: 'ossature', phase: 'principal', quantityPerBase: 0.8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + sur-longueurs', dtu: 'NF DTU 25.41',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'rail 3 m' },
      },
      {
        id: 'montant-m48', name: 'Montant M48',
        category: 'ossature', phase: 'principal', quantityPerBase: 1.80, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + bords', dtu: 'NF DTU 25.41 §6.2',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'montant 3 m' },
      },
      {
        id: 'vis-ttpc-25', name: 'Vis TTPC 25 mm (1ère peau)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 30, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte chantier', dtu: 'NF DTU 25.41',
        packaging: { unit: 'u', contentQty: 1000, contentUnit: 'u', label: 'boîte 1000 vis' },
      },
      {
        id: 'vis-ttpc-35', name: 'Vis TTPC 35 mm (2ème peau)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 30, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte chantier',
        dtu: 'NF DTU 25.41', manufacturerRef: 'Placo® vis longues 2ème peau',
        packaging: { unit: 'u', contentQty: 1000, contentUnit: 'u', label: 'boîte 1000 vis' },
      },
      {
        id: 'cheville-frapper-6x40', name: 'Cheville à frapper 6×40',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 2.0, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Casse', dtu: 'NF DTU 25.41',
        packaging: { unit: 'u', contentQty: 100, contentUnit: 'u', label: 'boîte 100' },
      },
      {
        id: 'bande-joint-papier', name: 'Bande à joints papier',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 1.8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes', dtu: 'NF DTU 25.41 §7',
        packaging: { unit: 'rouleau', contentQty: 150, contentUnit: 'ml', label: 'rouleau 150 m' },
      },
      {
        id: 'enduit-joint', name: 'Enduit à joints (1re passe)',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sur-dosage', dtu: 'NF DTU 25.41 §7',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'enduit-finition-placo', name: 'Enduit de finition (2e passe)',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.3, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus taloche',
        dtu: 'NF DTU 25.41 §7.3',
        manufacturerRef: 'Placo PR4',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'corniere-angle-metal', name: 'Cornière d\'angle métallique',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.3, unit: 'ml',
        geometryMultiplier: 'height',
        wasteFactor: 1.10, wasteReason: 'Coupes', dtu: 'NF DTU 25.41 §6.5',
        manufacturerRef: 'Placo® cornière 2,50 m',
      },
      {
        id: 'papier-verre-180-placo', name: 'Papier de verre grain 180',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 0.1, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Usure',
      },
      {
        id: 'laine-verre-45', name: 'Laine de verre 45 mm (acoustique)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.07, wasteReason: 'Découpes',
        manufacturerRef: 'Isover PAR 45 mm',
        packaging: { unit: 'rouleau', contentQty: 10.8, contentUnit: 'm2', label: 'rouleau 10,8 m²' },
      },
      {
        id: 'joint-acoustique-pu', name: 'Joint acoustique PU sous rails',
        category: 'joint', phase: 'preparation', quantityPerBase: 0.8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 25.41', manufacturerRef: 'Placo® Stil® joint mousse',
        optional: true,
        condition: 'Si cloison séparative entre logements (désolidarisation)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  DOUBLAGE COLLÉ
  // ══════════════════════════════════════════════════════════

  {
    id: 'doublage-colle-pse-80',
    name: 'Doublage collé Placomur® BA13 + PSE 80 mm (R = 2,10)',
    description: 'Doublage thermique sur mur maçonné. Panneau PSE Th38 80 mm contrecollé BA13. Pose au MAP.',
    trade: 'placo',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [
      { code: 'NF DTU 25.42 (Février 2022)', title: 'Ouvrages de doublage et habillage en complexes et sandwiches — plaques de parement plâtre', section: 'Rev. Février 2022 applicable Mai 2022' },
      { code: 'NF EN 13162+A1 (Juin 2015)', title: 'Laine minérale pour isolation' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Panneau Placomur® Doublissimo® 80+13 mm (format 2,50 × 1,20 m)',
      'Pose au MAP (Mortier Adhésif pour Panneau) — dosage 3-4 kg/m²',
      'Chevilles à frapper complémentaires : 3/m² (fixation mécanique + collage)',
      'Bande armée renfort coins (angles intérieurs)',
      'Cales bois pour verticalité à retirer après séchage',
      'Alternatives épaisseurs : 60+13 (R=1,55), 100+13 (R=2,60), 120+13 (R=3,15)',
    ],
    materials: [
      // ═══════════ PRÉPARATION ═══════════
      {
        id: 'primaire-regulateur-placomur', name: 'Primaire régulateur d\'adhérence (si support absorbant)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Rouleau + bac',
        manufacturerRef: 'Weber Prim / Placo® Primer',
        packaging: { unit: 'pot', contentQty: 5, contentUnit: 'L', label: 'bidon 5 L' },
        optional: true,
        condition: 'Si support fortement absorbant (plâtre, brique non enduite)',
      },
      // ═══════════ PRINCIPAL ═══════════
      {
        id: 'doublage-pse-80-ba13', name: 'Placomur® PSE Th38 80+13 (panneau 2,50×1,20 m)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Découpes',
        dtu: 'NF DTU 25.42', manufacturerRef: 'Placo® Doublissimo® 80+13',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'm2', label: 'panneau 2,5×1,2m' },
      },
      {
        id: 'mortier-collage-map', name: 'Mortier adhésif MAP (plots de collage)',
        category: 'colle', phase: 'principal', quantityPerBase: 4, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus seau, sur-dosage',
        dtu: 'NF DTU 25.42 §6',
        manufacturerRef: 'Placo® MAP Formule+ / Weber MAP',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      // ═══════════ ACCESSOIRES ═══════════
      {
        id: 'cheville-frapper-6x40', name: 'Cheville à frapper 6×40 (fixation complémentaire)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Casse',
        dtu: 'NF DTU 25.42',
        notes: '3 chevilles/m² — renforcement mécanique du collage.',
      },
      {
        id: 'bande-armee-coin', name: 'Bande armée angle (renfort coins intérieurs)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.2, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 25.42 §7',
      },
      // ═══════════ FINITIONS ═══════════
      {
        id: 'bande-joint-papier', name: 'Bande à joints papier (joints verticaux)',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 1.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes',
        dtu: 'NF DTU 25.42 §7',
        packaging: { unit: 'rouleau', contentQty: 150, contentUnit: 'ml', label: 'rouleau 150 m' },
      },
      {
        id: 'enduit-joint', name: 'Enduit à joints (1re passe)',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.35, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sur-dosage', dtu: 'NF DTU 25.42',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'enduit-finition-placo', name: 'Enduit de finition 2e passe',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.25, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus taloche',
        dtu: 'NF DTU 25.42',
        manufacturerRef: 'Placo PR4',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  PLAFOND F530
  // ══════════════════════════════════════════════════════════

  {
    id: 'plafond-placo-f530',
    name: 'Plafond suspendu Placo (ossature F530 + BA13)',
    description: 'Plafond sur ossature métallique suspendue. Porteuses 1,20 m + fourrures 60 cm + suspentes 1,20 m.',
    trade: 'placo',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 25.41 (Février 2022)', title: 'Ouvrages en plaques de plâtre sur ossature — inclut plafonds depuis révision 2022' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Grille ossature 1,20 × 0,60 m (suspentes 1,20 / fourrures 60 cm)',
      'BA13 standard 1 m²/m² (1 face seule)',
      'Cornière périphérique : ratio 0,5 ml/m² pour pièce standard — ajuster si atypique',
      'Enduit en 2 passes (idem cloisons DTU 25.41 §7.3)',
      'Trappes de visite à prévoir si passage de gaines/évacuations',
      'Laine minérale OPTIONNELLE (combles perdus uniquement) — cf. audit #10',
    ],
    materials: [
      // ═══════════ PRINCIPAL ═══════════
      {
        id: 'plaque-ba13', name: 'Plaque BA13',
        category: 'plaque', phase: 'principal', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Découpes',
        dtu: 'NF DTU 25.41', packaging: { unit: 'u', contentQty: 3, contentUnit: 'm2', label: 'plaque 2,5×1,2m' },
      },
      {
        id: 'fourrure-f530', name: 'Fourrure F530 (longueur 3 m)',
        category: 'ossature', phase: 'principal', quantityPerBase: 1.67, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 25.41 §6.4 — entraxe 60 cm', manufacturerRef: 'Placo® Stil® F530',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'fourrure 3 m' },
      },
      {
        id: 'suspente-acoustique', name: 'Suspente acoustique F530',
        category: 'fixation', phase: 'principal', quantityPerBase: 0.7, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse, réglage',
        dtu: 'NF DTU 25.41', notes: 'Grille 1,20 × 0,60 m ≈ 0,7 suspente/m².',
      },
      {
        id: 'corniere-periph-25', name: 'Cornière périphérique 25×25',
        category: 'ossature', phase: 'principal', quantityPerBase: 0.5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes angles', dtu: 'NF DTU 25.41',
      },
      // ═══════════ ACCESSOIRES ═══════════
      {
        id: 'eclisse-fourrure', name: 'Éclisse de raccord fourrure',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte', dtu: 'NF DTU 25.41',
      },
      {
        id: 'vis-ttpc-25', name: 'Vis TTPC 25 mm',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 15, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte', dtu: 'NF DTU 25.41 — 15 vis/m²',
        packaging: { unit: 'u', contentQty: 1000, contentUnit: 'u', label: 'boîte 1000 vis' },
      },
      // ═══════════ FINITIONS ═══════════
      {
        id: 'bande-joint-papier', name: 'Bande à joints',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 1.4, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes', dtu: 'NF DTU 25.41 §7',
        packaging: { unit: 'rouleau', contentQty: 150, contentUnit: 'ml', label: 'rouleau 150 m' },
      },
      {
        id: 'enduit-joint', name: 'Enduit à joints (1re passe)',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.4, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sur-dosage', dtu: 'NF DTU 25.41',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'enduit-finition-placo', name: 'Enduit de finition 2e passe',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.25, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus taloche',
        dtu: 'NF DTU 25.41 §7.3', manufacturerRef: 'Placo PR4',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'papier-verre-180-placo', name: 'Papier de verre grain 180',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 0.1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Usure',
      },
      // ═══════════ OPTIONS ═══════════
      {
        id: 'trappe-visite-plafond', name: 'Trappe de visite plafond 50×50 cm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.05, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 25.41',
        optional: true,
        condition: 'Si faux-plafond cache gaines/évacuations/VMC — 1 trappe / 20 m²',
        notes: 'Base : 1 trappe tous les 20 m² pour accès technique.',
      },
      {
        id: 'laine-verre-200', name: 'Laine de verre 200 mm (combles perdus)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Découpes',
        manufacturerRef: 'Isover Isoconfort 35',
        packaging: { unit: 'rouleau', contentQty: 4.7, contentUnit: 'm2', label: 'rouleau 4,7 m²' },
        optional: true,
        condition: 'Si plafond sous combles perdus (sinon voir trade #10 Isolation)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  CLOISON ALVÉOLAIRE Placopan® — audit #13.3
  // ══════════════════════════════════════════════════════════

  {
    id: 'cloison-alveolaire-placopan',
    name: 'Cloison alvéolaire Placopan® (épaisseur 50/70/100 mm)',
    description: 'Cloison distributive légère en panneaux sandwich pré-assemblés. Pose sur rails U.',
    trade: 'placo',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [
      { code: 'NF DTU 25.41 (Février 2022)', title: 'Ouvrages en plaques de plâtre', section: '§9 cloisons alvéolaires' },
      { code: 'NF EN 520+A1 (Décembre 2009)', title: 'Plaques de plâtre' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Panneaux Placopan® 2,50 × 1,20 m, épaisseur 50 mm (cloison distributive standard)',
      'Collage des jonctions verticales au PU + rails U de finition',
      'Alternative aux cloisons 72/48 pour distribution rapide sans isolation acoustique',
      'Pas adapté aux pièces humides (SDB, cuisine) — préférer BA13 hydrofuge',
    ],
    materials: [
      // ═══════════ PRINCIPAL ═══════════
      {
        id: 'panneau-placopan-50', name: 'Panneau Placopan® 50 mm (2,50 × 1,20 m)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Découpes',
        dtu: 'NF DTU 25.41 §9', manufacturerRef: 'Placo® Placopan®',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'm2', label: 'panneau 2,5×1,2m' },
      },
      {
        id: 'colle-pu-panneaux', name: 'Colle polyuréthane (jonctions panneaux)',
        category: 'colle', phase: 'principal', quantityPerBase: 0.05, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purge cartouche',
        dtu: 'NF DTU 25.41',
        packaging: { unit: 'cartouche', contentQty: 0.31, contentUnit: 'L', label: 'cartouche 310 ml' },
      },
      {
        id: 'rail-u-finition-placopan', name: 'Rail U de finition périphérique',
        category: 'ossature', phase: 'principal', quantityPerBase: 0.8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 25.41 §9',
      },
      // ═══════════ ACCESSOIRES ═══════════
      {
        id: 'vis-ttpc-25', name: 'Vis TTPC 25 mm (fixation sur rails)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 10, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte',
        packaging: { unit: 'u', contentQty: 1000, contentUnit: 'u', label: 'boîte 1000 vis' },
      },
      {
        id: 'mousse-pu-remplissage', name: 'Mousse PU (remplissage tête/pied)',
        category: 'adjuvant', phase: 'accessoires', quantityPerBase: 0.08, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purge bonbonne',
        packaging: { unit: 'cartouche', contentQty: 0.75, contentUnit: 'L', label: 'cartouche 750 ml' },
      },
      // ═══════════ FINITIONS ═══════════
      {
        id: 'bande-joint-papier', name: 'Bande à joints (joints panneaux)',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 1.4, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes',
        packaging: { unit: 'rouleau', contentQty: 150, contentUnit: 'ml', label: 'rouleau 150 m' },
      },
      {
        id: 'enduit-joint', name: 'Enduit à joints (1re passe)',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.4, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sur-dosage',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'enduit-finition-placo', name: 'Enduit de finition 2e passe',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.2, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  DOUBLAGE SUR OSSATURE 100/70 — audit #13.5
  // ══════════════════════════════════════════════════════════

  {
    id: 'doublage-placo-100-70',
    name: 'Doublage sur ossature 100/70 (BA13 + laine 60 mm)',
    description: 'Doublage thermique/acoustique sur mur existant — BA13 sur montants M70, laine minérale 60 mm. Face unique (vs cloison).',
    trade: 'placo',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [
      { code: 'NF DTU 25.41 (Février 2022)', title: 'Ouvrages en plaques de plâtre sur ossature' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Face unique vs cloison 72/48 (qui a 2 faces)',
      'Montants M70 (entraxe 60 cm) + rails R70',
      'Laine 60 mm pour performance thermique R ≈ 1,7',
      'Espace de désolidarisation 5 mm entre doublage et mur existant',
      'Cornière d\'angle au raccord avec mur perpendiculaire',
    ],
    materials: [
      {
        id: 'plaque-ba13', name: 'Plaque BA13 (1 plaque / m²)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Découpes',
        dtu: 'NF DTU 25.41', manufacturerRef: 'Placo® BA13',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'm2', label: 'plaque 2,5×1,2m' },
      },
      {
        id: 'rail-r70', name: 'Rail R70 (longueur 3 m)',
        category: 'ossature', phase: 'principal', quantityPerBase: 0.8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 25.41', manufacturerRef: 'Placo® Stil® R70',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'rail 3 m' },
      },
      {
        id: 'montant-m70', name: 'Montant M70 (longueur 3 m)',
        category: 'ossature', phase: 'principal', quantityPerBase: 1.8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + bords',
        dtu: 'NF DTU 25.41 §6.2', manufacturerRef: 'Placo® Stil® M70',
        packaging: { unit: 'u', contentQty: 3, contentUnit: 'ml', label: 'montant 3 m' },
      },
      {
        id: 'laine-verre-60', name: 'Laine de verre 60 mm (R ≈ 1,70)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.07, wasteReason: 'Découpes',
        manufacturerRef: 'Isover GR32 60 mm',
        packaging: { unit: 'rouleau', contentQty: 7.5, contentUnit: 'm2', label: 'rouleau 7,5 m²' },
      },
      {
        id: 'vis-ttpc-25', name: 'Vis TTPC 25 mm',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 15, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte', dtu: 'NF DTU 25.41',
        packaging: { unit: 'u', contentQty: 1000, contentUnit: 'u', label: 'boîte 1000 vis' },
      },
      {
        id: 'cheville-frapper-6x40', name: 'Cheville à frapper 6×40',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Casse',
        packaging: { unit: 'u', contentQty: 100, contentUnit: 'u', label: 'boîte 100' },
      },
      {
        id: 'bande-joint-papier', name: 'Bande à joints papier',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 1.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes',
        dtu: 'NF DTU 25.41 §7',
        packaging: { unit: 'rouleau', contentQty: 150, contentUnit: 'ml', label: 'rouleau 150 m' },
      },
      {
        id: 'enduit-joint', name: 'Enduit à joints',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.35, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sur-dosage',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'enduit-finition-placo', name: 'Enduit de finition 2e passe',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.25, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus',
        dtu: 'NF DTU 25.41 §7.3',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'corniere-angle-metal', name: 'Cornière d\'angle (raccords murs)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.3, unit: 'ml', geometryMultiplier: 'height',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 25.41 §6.5',
      },
    ],
  },
];
