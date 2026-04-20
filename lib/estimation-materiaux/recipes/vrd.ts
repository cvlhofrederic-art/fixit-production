import type { Recipe } from '../types'

/**
 * TERRASSEMENT & VRD — audit #01
 *
 * Référentiels FR :
 * - NF DTU 12     Terrassements pour bâtiments (rev. 1964, en vigueur)
 * - NF P98-331    Tranchées, ouverture, remblayage, réfection
 * - NF EN 1610    Construction réseaux d'évacuation
 * - Fascicule 70  (CCTG) — canalisations d'assainissement
 *
 * Note : 2 ouvrages sont "zéro matériau" (décaissement, évacuation déblais)
 * → pas inclus ici (main d'œuvre + location matériel uniquement).
 */

export const vrdRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #1.2 REMBLAIS (grave + sable)
  // ══════════════════════════════════════════════════════════
  {
    id: 'remblai-grave-sable',
    name: 'Remblai grave naturelle 0/31,5 + sable lit',
    description: 'Remblai structurant pour fondations / tranchées / forme. Compactage par couches de 30 cm.',
    trade: 'vrd',
    baseUnit: 'm3',
    geometryMode: 'volume',
    dtuReferences: [
      { code: 'NF DTU 12', title: 'Terrassements pour bâtiments' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Grave naturelle 0/31,5 pour remblai structurant',
      'Sable 0/4 pour lit de pose canalisations (~15% volume total)',
      'Pertes 15% (compactage par couches)',
      'Livraison camion 6-20 m³ ou big bag selon accès chantier',
    ],
    materials: [
      {
        id: 'grave-naturelle-0-315', name: 'Grave naturelle 0/31,5 (remblai structurant)',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.85, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Compactage par couches',
      },
      {
        id: 'sable-lit-pose', name: 'Sable 0/4 (lit de pose canalisations)',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.15, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #1.3 RÉSEAUX ENTERRÉS (par type, au ml)
  // ══════════════════════════════════════════════════════════
  {
    id: 'reseau-ep-pvc-enterre',
    name: 'Réseau évacuation EP PVC enterré (Ø160, au ml)',
    description: 'Réseau évacuation eaux pluviales en tranchée : tube PVC + sable + grillage avertisseur + remblai.',
    trade: 'vrd',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF EN 1610', title: 'Construction réseaux évacuation' },
      { code: 'NF DTU 60.33', title: 'Canalisations PVC enterrées' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Tube PVC Ø160 CR8 (résistance écrasement)',
      'Lit de sable 10 cm sous tube + enrobage sable 10 cm',
      'Grillage avertisseur couleur selon réseau : MARRON pour EP, BLEU pour eau potable',
      'Remblai grave au-dessus (compactage par couches)',
      'Profondeur tranchée : 0,8 m standard (hors gel)',
      'Coudes/tés : 0,1 u/ml moyen (1 tous 10 m)',
    ],
    materials: [
      {
        id: 'tube-pvc-160-cr8', name: 'Tube PVC Ø160 CR8 (barre 3 m)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.05, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        normRef: 'NF EN 1401-1',
      },
      {
        id: 'sable-enrobage-tube', name: 'Sable 0/4 (lit + enrobage 20 cm)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.08, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'grillage-avertisseur-marron', name: 'Grillage avertisseur marron (EP)',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
      {
        id: 'coude-te-pvc-160', name: 'Coudes / tés PVC Ø160',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Rebuts',
      },
      {
        id: 'grave-remblai-tranchee', name: 'Grave remblai tranchée (au-dessus sable)',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.2, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Compactage',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #1.4 REGARD DE VISITE
  // ══════════════════════════════════════════════════════════
  {
    id: 'regard-visite-40',
    name: 'Regard de visite préfabriqué 40×40 cm (tampon fonte A15)',
    description: 'Regard béton préfa avec tampon fonte classe A15 (circulation piéton). Scellement mortier.',
    trade: 'vrd',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF EN 1917', title: 'Regards préfa béton' },
      { code: 'NF EN 124', title: 'Classification tampons (A15, B125, C250, D400)' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Regard 40×40 cm (standard habitation)',
      'Tampon fonte classe A15 (circulation piéton uniquement)',
      'B125 pour accès véhicule léger, C250 véhicule lourd',
      'Rehausse béton si profondeur > 60 cm',
      'Joints étanches entre éléments + mortier scellement',
    ],
    materials: [
      {
        id: 'regard-40-40-beton', name: 'Regard préfabriqué béton 40×40 cm',
        category: 'bloc', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        normRef: 'NF EN 1917',
        manufacturerRef: 'Alkern / Dupré Préfa',
      },
      {
        id: 'tampon-fonte-a15', name: 'Tampon fonte classe A15',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        normRef: 'NF EN 124',
        notes: 'B125 si accès véhicule léger, C250 pour lourd.',
      },
      {
        id: 'joint-etanche-regard', name: 'Joints étanches entre éléments',
        category: 'joint', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'mortier-scellement-regard', name: 'Mortier scellement',
        category: 'liant', phase: 'accessoires', quantityPerBase: 5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Résidus',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'rehausse-beton-regard', name: 'Rehausse béton (si profondeur > 60 cm)',
        category: 'bloc', phase: 'principal', quantityPerBase: 0.3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        optional: true,
        condition: 'Si profondeur tranchée > 60 cm',
      },
    ],
  },
]
