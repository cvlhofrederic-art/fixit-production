import type { Recipe } from '../types'

/**
 * ESPACES VERTS — audit #27
 *
 * Référentiels FR :
 * - NF P98-332   Pelouses
 * - NF V12-040   Terre végétale
 */

export const jardinRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #27.1 GAZON SEMÉ
  // ══════════════════════════════════════════════════════════
  {
    id: 'jardin-gazon-seme',
    name: 'Gazon semé (terre végétale + semences + amendement)',
    description: 'Préparation sol + terre végétale + compost + semences gazon rustique.',
    trade: 'jardin',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF P98-332', title: 'Pelouses' },
      { code: 'NF V12-040', title: 'Terre végétale' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Terre végétale épaisseur 10-15 cm (NF V12-040)',
      'Amendement organique (compost ou fumier) pour fertilité',
      'Semences gazon rustique 40 g/m² (densité standard)',
      'Engrais de démarrage NPK équilibré',
      'Arrosage nécessaire 2-3 semaines après semis',
      'Tonte à 5-6 cm à la 3e semaine',
    ],
    materials: [
      {
        id: 'terre-vegetale', name: 'Terre végétale (10 cm épaisseur)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.10, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Tassement',
        normRef: 'NF V12-040',
      },
      {
        id: 'compost-amendement', name: 'Compost / amendement organique',
        category: 'adjuvant', phase: 'preparation', quantityPerBase: 0.02, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Tassement',
      },
      {
        id: 'semence-gazon-rustique', name: 'Semences gazon (rustique ou ornement)',
        category: 'autre', phase: 'principal', quantityPerBase: 40, unit: 'g', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Semis',
        manufacturerRef: 'Vilmorin / Naturasemus',
      },
      {
        id: 'engrais-demarrage-gazon', name: 'Engrais démarrage NPK',
        category: 'adjuvant', phase: 'finitions', quantityPerBase: 30, unit: 'g', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Épandage',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #27.2 PLANTATIONS (arbres / arbustes)
  // ══════════════════════════════════════════════════════════
  {
    id: 'jardin-plantation',
    name: 'Plantation arbre ou arbuste (par sujet)',
    description: 'Plantation 1 arbre/arbuste : trou + terreau + engrais + tuteur + paillage.',
    trade: 'jardin',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF P90-201', title: 'Aménagements paysagers — plantations d\'arbres et arbustes' },
      { code: 'Fascicule 35', title: 'CCTG travaux — Aménagements paysagers, aires de sports' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = 1 plant (arbre ou arbuste)',
      'Trou dimension 60×60×60 cm (1,5× motte)',
      'Terreau plantation spécifique 50 L par trou',
      'Engrais de plantation (NPK)',
      'Tuteur bois + lien pour arbres (jeunes sujets)',
      'Paillage (écorces/chanvre/lin) 5 cm sur 1 m² autour du pied',
    ],
    materials: [
      {
        id: 'plant-arbre-arbuste', name: 'Plant arbre/arbuste',
        category: 'autre', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'terreau-plantation', name: 'Terreau plantation (50 L)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.05, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Tassement',
      },
      {
        id: 'engrais-plantation', name: 'Engrais plantation (NPK)',
        category: 'adjuvant', phase: 'preparation', quantityPerBase: 100, unit: 'g', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sur-dosage',
      },
      {
        id: 'tuteur-bois', name: 'Tuteur bois + lien',
        category: 'bois', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        optional: true,
        condition: 'Pour arbres jeunes (< 3 ans) — stabilisation',
      },
      {
        id: 'paillage-ecorce', name: 'Paillage écorces / chanvre / lin',
        category: 'autre', phase: 'finitions', quantityPerBase: 0.05, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Épandage',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #27.3 ARROSAGE AUTOMATIQUE
  // ══════════════════════════════════════════════════════════
  {
    id: 'jardin-arrosage-auto',
    name: 'Arrosage automatique (3 zones gazon + 1 goutte-à-goutte)',
    description: 'Programmateur 4 voies + électrovannes + tuyaux PE Ø25 + arroseurs/goutteurs.',
    trade: 'jardin',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF EN 12484', title: 'Systèmes d\'irrigation — arrosage intégré' },
      { code: 'NF EN 805', title: 'Alimentation en eau — conduites extérieures' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = 1 installation 4 zones (3 gazon + 1 massif)',
      'Programmateur 4-8 voies selon nb zones',
      '60 ml tuyau PE Ø25 (réseau principal)',
      '16 arroseurs tournants ou escamotables',
      'Filtre entrée réseau OBLIGATOIRE (protection électrovannes)',
      'Réducteur de pression si réseau > 4 bar',
    ],
    materials: [
      {
        id: 'programmateur-arrosage', name: 'Programmateur 4-8 voies',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'electrovanne-arrosage', name: 'Électrovannes (1 par zone)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'tube-pe-25-arrosage', name: 'Tuyaux PE Ø25 (réseau principal)',
        category: 'plaque', phase: 'principal', quantityPerBase: 60, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
      {
        id: 'arroseur-escamotable', name: 'Arroseurs escamotables (tournants)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 16, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse',
      },
      {
        id: 'raccord-pe-arrosage', name: 'Raccords PE (tés + coudes)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 10, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Rebuts',
      },
      {
        id: 'filtre-entree-arrosage', name: 'Filtre entrée réseau',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'reducteur-pression-arrosage', name: 'Réducteur de pression',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        optional: true,
        condition: 'Si pression réseau > 4 bar',
      },
    ],
  },
]
