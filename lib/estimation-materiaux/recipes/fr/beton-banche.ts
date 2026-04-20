import type { Recipe } from '../../types'

/**
 * BÉTON ARMÉ / BÉTON BANCHÉ — audit #05
 *
 * Référentiels FR :
 * - NF DTU 23.1   Murs en béton banché (mai 1993)
 * - NF DTU 21     Exécution des ouvrages en béton
 * - NF DTU 21.4   Béton auto-plaçant
 * - NF DTU 22.1   Dalles et murs béton préfabriqué
 * - NF DTU 23.2   Prédalles + poutrelles-hourdis
 * - NF EN 206     Spécification béton
 * - Eurocode 2    NF EN 1992-1-1
 * - NF EN 13670   Exécution structures béton
 *
 * Référentiels PT : NP EN 13670 + NP EN 1992 + DL 90/2021
 */

export const betonBancheRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #5.1 VOILE BÉTON BANCHÉ
  // ══════════════════════════════════════════════════════════
  {
    id: 'voile-beton-banche',
    name: 'Voile béton banché (mur porteur intérieur/extérieur)',
    description: 'Mur béton coulé en place dans coffrage. Épaisseur standard 16-20 cm. Armatures verticales + horizontales selon Eurocode 2.',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [
      { code: 'NF DTU 23.1', title: 'Murs en béton banché' },
      { code: 'NF DTU 21', title: 'Exécution ouvrages en béton' },
      { code: 'Eurocode 2', title: 'NF EN 1992-1-1' },
      { code: 'NF EN 206', title: 'Béton — spécification' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Voile épaisseur 20 cm supposée (adapter selon descente de charges Eurocode 2)',
      'Béton C25/30 dosé 350 kg/m³',
      'Armatures verticales HA12 tous les 25 cm',
      'Armatures horizontales HA10 tous les 30 cm',
      'Armatures chaînage d\'angle renforcées (4 HA14 × 2 angles)',
      'Coffrage 2 faces (banches louées — seuls consommables comptés)',
      'Décoffrant + cure obligatoires',
    ],
    materials: [
      // ═══ PRÉPARATION ═══
      {
        id: 'huile-decoffrage', name: 'Huile de décoffrage',
        category: 'adjuvant', phase: 'preparation', quantityPerBase: 0.15, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sur-dosage pratique',
        dtu: 'NF DTU 23.1 §6.4',
        manufacturerRef: 'Sika Separol / Chryso Decofrage',
        packaging: { unit: 'u', contentQty: 25, contentUnit: 'L', label: 'bidon 25 L' },
        notes: '1,5 L / 10 m² coffrage.',
      },
      // ═══ PRINCIPAL — Béton ═══
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II 32,5 R (béton 350 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 70, unit: 'kg', geometryMultiplier: 'thickness',
        wasteFactor: 1.03, wasteReason: 'Résidus',
        dtu: 'NF DTU 21', normRef: 'NF EN 197-1',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.5, unit: 'm3', geometryMultiplier: 'thickness',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.7, unit: 'm3', geometryMultiplier: 'thickness',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'eau-beton', name: 'Eau de gâchage',
        category: 'eau', phase: 'principal', quantityPerBase: 175, unit: 'L', geometryMultiplier: 'thickness',
        wasteFactor: 1.00, wasteReason: 'Dosage précis',
      },
      // ═══ PRINCIPAL — Armatures ═══
      {
        id: 'acier-ha12-vertical', name: 'Acier HA12 verticaux (tous les 25 cm)',
        category: 'acier', phase: 'principal', quantityPerBase: 4, unit: 'kg', geometryMultiplier: 'height',
        wasteFactor: 1.10, wasteReason: 'Chutes + recouvrements',
        dtu: 'NF DTU 23.1 §7', normRef: 'NF A 35-080',
      },
      {
        id: 'acier-ha10-horizontal', name: 'Acier HA10 horizontaux (tous 30 cm)',
        category: 'acier', phase: 'principal', quantityPerBase: 2.5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes + recouvrements',
        dtu: 'NF DTU 23.1 §7',
      },
      {
        id: 'acier-ha14-chainage-angle', name: 'Acier HA14 chaînage d\'angle (4 barres × 2 angles)',
        category: 'acier', phase: 'principal', quantityPerBase: 2, unit: 'kg', geometryMultiplier: 'height',
        wasteFactor: 1.10, wasteReason: 'Chutes',
        dtu: 'Eurocode 2 §9.2',
      },
      // ═══ ACCESSOIRES ═══
      {
        id: 'entretoise-banche', name: 'Entretoises banches / tiges d\'écartement',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte chantier',
      },
      {
        id: 'cales-beton-30', name: 'Cales d\'enrobage 30 mm (2 faces)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 8, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse',
        dtu: 'NF DTU 21 §7.2',
      },
      {
        id: 'bouchon-tige-banche', name: 'Bouchon tige / chapeau étanchéité',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'ligatures-fil-recuit', name: 'Ligatures fil recuit 1,4 mm',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.3, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte',
        dtu: 'NF DTU 21 §3.4',
      },
      // ═══ FINITIONS ═══
      {
        id: 'mortier-ragreage-voile', name: 'Mortier de ragréage (nids de cailloux/bulles)',
        category: 'enduit', phase: 'finitions', quantityPerBase: 0.5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Reprises ponctuelles',
        notes: 'Estimation 5% de surface à reprendre après décoffrage.',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'produit-cure-beton', name: 'Produit de cure',
        category: 'adjuvant', phase: 'finitions', quantityPerBase: 0.15, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Pulvérisation',
        dtu: 'NF DTU 21 §8',
        packaging: { unit: 'u', contentQty: 25, contentUnit: 'L', label: 'bidon 25 L' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #5.2 POTEAU BÉTON ARMÉ (25×25 cm type habitation)
  // ══════════════════════════════════════════════════════════
  {
    id: 'poteau-ba-25',
    name: 'Poteau béton armé 25×25 cm (habitation courante)',
    description: '4 aciers longitudinaux HA12 + cadres HA6 tous 20 cm. Béton C25/30. Coffrage consommable.',
    trade: 'maconnerie',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF DTU 21', title: 'Exécution ouvrages en béton' },
      { code: 'Eurocode 2', title: 'NF EN 1992-1-1 §5.8 Poteaux' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Section 25×25 cm (0,0625 m³ béton/ml)',
      '4 HA12 longitudinaux + cadres HA6 tous 20 cm',
      'Coffrage contreplaqué 1 ml/ml poteau (4 faces × 0,25 m)',
      'Enrobage minimum 30 mm (NF DTU 21 §7.2)',
    ],
    materials: [
      {
        id: 'ciment-cem2-325r', name: 'Ciment (béton 350 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 22, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Résidus',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
        notes: '0,0625 m³ × 350 kg = 22 kg/ml.',
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.031, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.044, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'eau-beton', name: 'Eau', category: 'eau', phase: 'principal',
        quantityPerBase: 11, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage',
      },
      {
        id: 'acier-ha12-poteau', name: 'Acier HA12 longitudinal (4 barres)',
        category: 'acier', phase: 'principal', quantityPerBase: 3.55, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes + recouvrements',
      },
      {
        id: 'acier-ha6-cadres-poteau', name: 'Acier HA6 cadres (tous 20 cm)',
        category: 'acier', phase: 'principal', quantityPerBase: 1.1, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes',
      },
      {
        id: 'coffrage-ctbx-poteau', name: 'Coffrage contreplaqué CTBX 18 mm',
        category: 'bois', phase: 'preparation', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Coupes + usure',
      },
      {
        id: 'huile-decoffrage', name: 'Huile de décoffrage',
        category: 'adjuvant', phase: 'preparation', quantityPerBase: 0.08, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sur-dosage',
      },
      {
        id: 'cales-beton-30', name: 'Cales enrobage 30 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse',
      },
      {
        id: 'ligatures-fil-recuit', name: 'Ligatures',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.1, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #5.3 POUTRE BÉTON ARMÉ (25×40 cm)
  // ══════════════════════════════════════════════════════════
  {
    id: 'poutre-ba-25-40',
    name: 'Poutre béton armé 25×40 cm',
    description: '4 HA14 longitudinaux + cadres HA8 tous 15 cm. Coffrage 3 faces (fond + 2 flancs).',
    trade: 'maconnerie',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF DTU 21', title: 'Exécution ouvrages en béton' },
      { code: 'Eurocode 2', title: 'NF EN 1992-1-1 §9.2 Poutres' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Section 25×40 cm (0,1 m³ béton/ml)',
      '4 HA14 longitudinaux + cadres HA8 tous 15 cm',
      'Coffrage 1,3 m²/ml (fond 0,25 + 2 flancs × 0,40 × 1,3)',
      'Étais temporaires (matériel, non compté)',
    ],
    materials: [
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II 32,5 R',
        category: 'liant', phase: 'principal', quantityPerBase: 35, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Résidus',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.05, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.07, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'eau-beton', name: 'Eau', category: 'eau', phase: 'principal',
        quantityPerBase: 17, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage',
      },
      {
        id: 'acier-ha14-poutre', name: 'Acier HA14 longitudinal (4 barres)',
        category: 'acier', phase: 'principal', quantityPerBase: 4.84, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes + recouvrements',
        normRef: 'NF A 35-080',
      },
      {
        id: 'acier-ha8-cadres-poutre', name: 'Cadres HA8 tous 15 cm',
        category: 'acier', phase: 'principal', quantityPerBase: 2.6, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes',
      },
      {
        id: 'coffrage-ctbx-poutre', name: 'Coffrage CTBX 18 mm (3 faces)',
        category: 'bois', phase: 'preparation', quantityPerBase: 1.3, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Coupes + usure',
      },
      {
        id: 'huile-decoffrage', name: 'Huile de décoffrage',
        category: 'adjuvant', phase: 'preparation', quantityPerBase: 0.1, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sur-dosage',
      },
      {
        id: 'cales-beton-30', name: 'Cales enrobage 30 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 6, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse',
      },
      {
        id: 'ligatures-fil-recuit', name: 'Ligatures',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.15, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #5.4 PLANCHER DALLE PLEINE COULÉ
  // ══════════════════════════════════════════════════════════
  {
    id: 'plancher-dalle-pleine',
    name: 'Plancher dalle pleine béton armé (épaisseur 20 cm)',
    description: 'Double nappe HA12 maille 15×15 (haut + bas). Coffrage plafond étayé.',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 21', title: 'Exécution ouvrages en béton' },
      { code: 'Eurocode 2', title: 'NF EN 1992-1-1' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Épaisseur 20 cm (standard habitation)',
      'Double nappe HA12 : 2 × 2 kg/m² = 4 kg/m² (+ recouvrements 15%)',
      'Coffrage plafond 1 m²/m² avec étaiement (étais loués, non comptés)',
      'Cales enrobage 8/m² (4 haut + 4 bas)',
      'Chaises d\'armatures pour support nappe supérieure',
    ],
    materials: [
      {
        id: 'ciment-cem2-325r', name: 'Ciment (béton 350 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 350, unit: 'kg', geometryMultiplier: 'thickness',
        wasteFactor: 1.03, wasteReason: 'Résidus',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.5, unit: 'm3', geometryMultiplier: 'thickness',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.7, unit: 'm3', geometryMultiplier: 'thickness',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'eau-beton', name: 'Eau', category: 'eau', phase: 'principal',
        quantityPerBase: 175, unit: 'L', geometryMultiplier: 'thickness',
        wasteFactor: 1.00, wasteReason: 'Dosage',
      },
      {
        id: 'acier-ha12-binappe-plancher', name: 'Acier HA12 bi-nappe (haut + bas, maille 15×15)',
        category: 'acier', phase: 'principal', quantityPerBase: 4, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Recouvrements + chutes',
        dtu: 'Eurocode 2',
      },
      {
        id: 'coffrage-plafond', name: 'Coffrage plafond (contreplaqué CTBX)',
        category: 'bois', phase: 'preparation', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Usure (3-4 réutilisations)',
      },
      {
        id: 'huile-decoffrage', name: 'Huile de décoffrage',
        category: 'adjuvant', phase: 'preparation', quantityPerBase: 0.15, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sur-dosage',
      },
      {
        id: 'cales-beton-30', name: 'Cales enrobage 30 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 8, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse',
      },
      {
        id: 'chaise-armature', name: 'Chaises d\'armatures (support nappe sup.)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
      {
        id: 'ligatures-fil-recuit', name: 'Ligatures',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.2, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #5.5 PLANCHER POUTRELLES-HOURDIS
  // ══════════════════════════════════════════════════════════
  {
    id: 'plancher-poutrelles-hourdis',
    name: 'Plancher poutrelles précontraintes + hourdis',
    description: 'Plancher préfabriqué léger. Poutrelles KP1/Rector entraxe 60 cm + hourdis + dalle compression.',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 23.2', title: 'Prédalles et planchers béton' },
      { code: 'NF DTU 22.1', title: 'Dalles et murs béton préfabriqué' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Poutrelles précontraintes entraxe 60 cm → 1,67 ml/m²',
      'Hourdis PSE ou béton (format 60×20×20) → 3,3 hourdis/m²',
      'Dalle de compression 5 cm avec treillis ST10C',
      'Chaînage périphérique (4 HA10 + cadres HA6)',
    ],
    materials: [
      {
        id: 'poutrelle-precontrainte', name: 'Poutrelle précontrainte (KP1 / Rector)',
        category: 'acier', phase: 'principal', quantityPerBase: 1.67, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes aux appuis',
        manufacturerRef: 'KP1 / Rector',
      },
      {
        id: 'hourdis-pse', name: 'Hourdis PSE ou béton 60×20×20',
        category: 'bloc', phase: 'principal', quantityPerBase: 3.3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse',
      },
      {
        id: 'treillis-st10c', name: 'Treillis soudé ST10C (dalle compression)',
        category: 'acier', phase: 'principal', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Recouvrements',
        normRef: 'NF A 35-080-1',
      },
      {
        id: 'ciment-cem2-325r', name: 'Ciment (dalle compression 5 cm, 350 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 17.5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Résidus',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
        notes: '0,05 m³ × 350 kg = 17,5 kg/m².',
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.025, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.035, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'eau-beton', name: 'Eau', category: 'eau', phase: 'principal',
        quantityPerBase: 9, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage',
      },
      {
        id: 'acier-ha10-chainage-peripherique', name: 'Acier HA10 chaînage périphérique (4 barres)',
        category: 'acier', phase: 'principal', quantityPerBase: 0.5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes',
        dtu: 'NF DTU 23.2',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #5.6 PRÉDALLE
  // ══════════════════════════════════════════════════════════
  {
    id: 'predalle-beton',
    name: 'Prédalle béton armé préfabriquée',
    description: 'Prédalle 4-5 cm préfa + béton complémentaire 15 cm. Pose sur étais temporaires.',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 23.2', title: 'Prédalles', section: 'Partie 1' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Prédalle 2,40 m largeur × épaisseur 4-5 cm (préfa)',
      'Béton complémentaire de 15 cm à couler sur site',
      'Armatures complémentaires (treillis + chapeaux) selon calcul Eurocode 2',
      'Étais temporaires (matériel, non comptés)',
    ],
    materials: [
      {
        id: 'predalle-prefa', name: 'Prédalle préfabriquée (2,40 m larg.)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.02, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.02, wasteReason: 'Coupes',
        dtu: 'NF DTU 23.2',
      },
      {
        id: 'ciment-cem2-325r', name: 'Ciment (béton complémentaire 15 cm)',
        category: 'liant', phase: 'principal', quantityPerBase: 52, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Résidus',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
        notes: '0,15 m³ × 350 kg = 52 kg/m².',
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.075, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.105, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'eau-beton', name: 'Eau', category: 'eau', phase: 'principal',
        quantityPerBase: 26, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage',
      },
      {
        id: 'armature-complementaire-predalle', name: 'Armatures complémentaires (treillis + chapeaux)',
        category: 'acier', phase: 'principal', quantityPerBase: 2, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #5.7 ESCALIER BÉTON COULÉ EN PLACE
  // ══════════════════════════════════════════════════════════
  {
    id: 'escalier-ba-coule',
    name: 'Escalier béton armé coulé en place (droit, 14 marches)',
    description: 'Escalier type 2,70 m hauteur. Paillasse + marches + limon. Coffrage bois sur mesure.',
    trade: 'maconnerie',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 21', title: 'Exécution ouvrages en béton' },
      { code: 'Eurocode 2', title: 'NF EN 1992-1-1' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Escalier droit 14 marches, largeur 1 m, hauteur 2,70 m',
      'Volume béton ≈ 0,6 m³',
      'Armatures paillasse (25 kg) + armatures marches (10 kg) = 35 kg',
      'Coffrage sur mesure (contreplaqué + tasseaux)',
      'Pour escalier tournant/hélicoïdal : majorer +30% temps coffrage',
    ],
    materials: [
      {
        id: 'ciment-cem2-325r', name: 'Ciment (0,6 m³ × 350 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 210, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Résidus',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.3, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.42, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'eau-beton', name: 'Eau', category: 'eau', phase: 'principal',
        quantityPerBase: 105, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage',
      },
      {
        id: 'acier-ha12-escalier', name: 'Armatures HA12 paillasse + marches',
        category: 'acier', phase: 'principal', quantityPerBase: 35, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes',
      },
      {
        id: 'coffrage-escalier-ctbx', name: 'Coffrage sur mesure (CTBX + tasseaux)',
        category: 'bois', phase: 'preparation', quantityPerBase: 15, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Découpes sur mesure',
      },
      {
        id: 'huile-decoffrage', name: 'Huile de décoffrage',
        category: 'adjuvant', phase: 'preparation', quantityPerBase: 2, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sur-dosage',
      },
      {
        id: 'cales-beton-30', name: 'Cales enrobage 30 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 30, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse',
      },
      {
        id: 'ligatures-fil-recuit', name: 'Ligatures',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte',
      },
    ],
  },
]
