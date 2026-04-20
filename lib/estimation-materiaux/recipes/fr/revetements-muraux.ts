import type { Recipe } from '../../types'

/**
 * REVÊTEMENTS MURAUX — audit #16
 *
 * Référentiels FR :
 * - NF DTU 59.1   Peinture des bâtiments (cf. peinture.ts existant)
 * - NF DTU 59.4   Papier peint / tentures
 * - NF DTU 25.1   Plâtrerie traditionnelle (enduits décoratifs plâtre)
 *
 * Note : peinture murs + faïence sont dans leurs trades respectifs
 * (peinture.ts et carrelage.ts). Ce fichier couvre :
 * - Papier peint
 * - Enduit décoratif (tadelakt, chaux pigmentée)
 * - Lambris bois
 */

export const revetementsMurauxRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #16.3 PAPIER PEINT
  // ══════════════════════════════════════════════════════════
  {
    id: 'papier-peint-intisse',
    name: 'Papier peint intissé (rouleau 10 m × 0,53 m)',
    description: 'Pose papier peint intissé avec encollage mur. Enduit de lissage + primaire spécifique papier peint.',
    trade: 'revetement_mural',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [
      { code: 'NF DTU 59.4 (Juillet 2013)', title: 'Papier peint / tentures' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Rouleau standard 10 m × 0,53 m = 5,3 m² utiles (pertes raccords motifs)',
      'Pertes 10-20% selon raccord motif (droit / saut / inverse)',
      'Enduit lissage si support Placo classe A (pas nécessaire pour classes B/C)',
      'Primaire spécifique papier peint (facilite décollage futur)',
      'Colle vendue en sachet (200-300 g pour ~25 m²)',
    ],
    materials: [
      // ═══ PRÉPARATION ═══
      {
        id: 'enduit-lissage-pp', name: 'Enduit de lissage (support classe A)',
        category: 'enduit', phase: 'preparation', quantityPerBase: 0.3, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus',
        dtu: 'NF DTU 59.1 classe A',
        optional: true,
        condition: 'Si support Placo classe A ou murs à lisser',
      },
      {
        id: 'primaire-papier-peint', name: 'Primaire spécifique papier peint',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.1, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac + rouleau',
      },
      // ═══ PRINCIPAL ═══
      {
        id: 'papier-peint-rouleau', name: 'Papier peint intissé (rouleau 10 m × 0,53)',
        category: 'plaque', phase: 'principal', quantityPerBase: 0.21, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Raccords motifs',
        dtu: 'NF DTU 59.4',
        notes: '1 rouleau pour ~5,3 m² → 0,19/m² + 10% marge = 0,21/m².',
      },
      {
        id: 'colle-papier-peint', name: 'Colle papier peint (sachet)',
        category: 'colle', phase: 'principal', quantityPerBase: 0.1, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sur-dosage',
        packaging: { unit: 'sac', contentQty: 0.3, contentUnit: 'kg', label: 'sachet 300 g (25 m²)' },
      },
      // ═══ ACCESSOIRES ═══
      {
        id: 'brosse-encollage', name: 'Brosse à encoller + rouleau',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.05, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Réutilisable',
        notes: '1 kit pour ~20 m² (amortissement chantier).',
      },
      {
        id: 'lisseuse-papier-peint', name: 'Lisseuse à papier peint',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.05, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Réutilisable',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #16.4 ENDUIT DÉCORATIF (tadelakt chaux)
  // ══════════════════════════════════════════════════════════
  {
    id: 'enduit-tadelakt',
    name: 'Enduit décoratif tadelakt (chaux + savon noir)',
    description: 'Enduit traditionnel marocain à base de chaux aérienne pigmentée + finition savon noir (imperméabilisation).',
    trade: 'revetement_mural',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 25.1 (Février 2010)', title: 'Plâtrerie traditionnelle' },
      { code: 'NF EN 459-1 (Décembre 2015)', title: 'Chaux construction' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Chaux aérienne CL90 (base tadelakt)',
      'Sable fin naturellement pigmenté OU chaux colorée avec pigments',
      'Finition au savon noir liquide (imperméabilisation — obligatoire pour SDB/cuisine)',
      'Usage courant : murs SDB, cuisine, zones humides',
      'Application experte requise (lissage à la truelle + fer chaud)',
    ],
    materials: [
      {
        id: 'chaux-aerienne-cl90', name: 'Chaux aérienne CL90 (Saint-Astier)',
        category: 'liant', phase: 'principal', quantityPerBase: 6, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Résidus',
        manufacturerRef: 'Saint-Astier',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'sable-fin-pigmente', name: 'Sable fin 0/2',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.015, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'pigment-naturel-tadelakt', name: 'Pigment naturel (selon teinte)',
        category: 'adjuvant', phase: 'principal', quantityPerBase: 0.15, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Dosage',
      },
      {
        id: 'savon-noir-tadelakt', name: 'Savon noir liquide (imperméabilisation finale)',
        category: 'adjuvant', phase: 'finitions', quantityPerBase: 0.08, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Application',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #16.5 LAMBRIS BOIS
  // ══════════════════════════════════════════════════════════
  {
    id: 'lambris-bois-mural',
    name: 'Lambris bois mural sur tasseaux (pin / sapin 10 mm)',
    description: 'Lames lambris bois fixées sur tasseaux 27×40 horizontaux. Vernis ou cire de finition.',
    trade: 'revetement_mural',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [
      { code: 'NF DTU 36.2 (Novembre 2019)', title: 'Menuiseries intérieures' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Lames pin/sapin ép. 10 mm (épaisseur économique standard)',
      'Tasseaux 27×40 horizontaux, entraxe 50 cm (2,1 ml/m²)',
      'Fixation par clous lambris sans tête (invisibles)',
      'Cornières d\'angle intérieur/extérieur + finitions bois',
      'Vernis ou cire de protection (selon aspect souhaité)',
    ],
    materials: [
      {
        id: 'tasseau-lambris', name: 'Tasseaux bois 27×40 (ossature)',
        category: 'bois', phase: 'preparation', quantityPerBase: 2.1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'lame-lambris-bois', name: 'Lames lambris bois 10 mm (pin / sapin)',
        category: 'bois', phase: 'principal', quantityPerBase: 1.08, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.08, wasteReason: 'Coupes + pertes',
      },
      {
        id: 'clou-lambris-sans-tete', name: 'Clous lambris sans tête',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 8, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'corniere-angle-lambris', name: 'Cornières d\'angle bois (intérieur/extérieur)',
        category: 'bois', phase: 'accessoires', quantityPerBase: 0.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'vernis-cire-lambris', name: 'Vernis ou cire bois (2 couches)',
        category: 'peinture', phase: 'finitions', quantityPerBase: 0.15, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Application',
      },
    ],
  },
]
