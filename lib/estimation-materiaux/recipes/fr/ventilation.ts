import type { Recipe } from '../../types'

/**
 * VENTILATION VMC — audit #19
 *
 * Référentiels FR :
 * - NF DTU 68.3   Installations ventilation mécanique (rev. 2017)
 * - NF EN 13141   Performance composants ventilation
 * - RE2020        VMC double flux favorisée
 */

export const ventilationRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #19.1 VMC SIMPLE FLUX HYGRORÉGLABLE
  // ══════════════════════════════════════════════════════════
  {
    id: 'vmc-simple-flux-hygro',
    name: 'VMC simple flux hygroréglable Type B (logement T3)',
    description: 'Caisson hygroréglable + 3 bouches extraction + entrées d\'air façade + gaines + rejet toiture.',
    trade: 'ventilation',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 68.3 (Juin 2013)', title: 'Installations VMC (rev. 2017)' },
      { code: 'NF EN 13141-4 (Mai 2011)', title: 'Performance' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = 1 installation VMC complète (logement T3 standard)',
      '3 bouches extraction (cuisine + SDB + WC)',
      '3 entrées d\'air autoréglables (salon + 2 chambres)',
      '15 ml gaine semi-rigide Ø125 (5 ml par bouche vers caisson)',
      'Rejet toiture Ø125 (ou pignon si impossible toiture)',
      'Alimentation 230 V dédiée au tableau (circuit VMC protégé 10 A)',
    ],
    materials: [
      {
        id: 'caisson-vmc-hygro', name: 'Caisson VMC hygroréglable Type B',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 68.3 §5.4',
        manufacturerRef: 'Aldes / Unelvent / Atlantic',
      },
      {
        id: 'gaine-semi-rigide-125', name: 'Gaine semi-rigide Ø125',
        category: 'accessoire', phase: 'principal', quantityPerBase: 15, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + raccords',
      },
      {
        id: 'bouche-extraction-hygro', name: 'Bouches extraction hygroréglables (cuisine/SDB/WC)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'entree-air-autoreglable', name: 'Entrées d\'air autoréglables (façade)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'rejet-toiture-vmc-125', name: 'Rejet toiture Ø125 (ou sortie pignon)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'manchette-raccord-vmc', name: 'Manchettes de raccord',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 6, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'collier-gaine-vmc', name: 'Colliers fixation gaines',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 10, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'cable-alim-vmc', name: 'Câble alimentation 3G1,5 (caisson → tableau)',
        category: 'plaque', phase: 'accessoires', quantityPerBase: 10, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'disjoncteur-vmc', name: 'Disjoncteur dédié VMC (10 A au tableau)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #19.2 VMC DOUBLE FLUX (échangeur thermique)
  // ══════════════════════════════════════════════════════════
  {
    id: 'vmc-double-flux',
    name: 'VMC double flux haut rendement (échangeur thermique)',
    description: 'Caisson double flux + échangeur > 85% + 2 circuits (soufflage + extraction) + prise air neuf + rejet toit.',
    trade: 'ventilation',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 68.3 (Juin 2013)', title: 'Installations VMC' },
      { code: 'NF EN 13141-7 (Février 2021)', title: 'Performance échangeurs' },
      { code: 'RE2020', title: 'Rendement > 85% obligatoire' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = 1 installation double flux complète (T4 standard)',
      'Caisson double flux rendement > 85% (obligatoire RE2020)',
      '2 circuits séparés : soufflage (pièces sèches) + extraction (pièces humides)',
      '4 bouches soufflage (3 chambres + séjour) + 3 extraction (cuisine/SDB/WC)',
      '30 ml gaines isolées Ø125/160',
      'Filtres G4 entrée air neuf + F7 protection échangeur (1 jeu + 1 rechange)',
      'Évacuation condensats (PVC Ø32)',
    ],
    materials: [
      {
        id: 'caisson-vmc-double-flux', name: 'Caisson VMC double flux + échangeur > 85%',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 68.3',
        manufacturerRef: 'Atlantic DuolyPro / Aldes DeeFly',
      },
      {
        id: 'gaine-isolee-125-160', name: 'Gaines isolées Ø125/160',
        category: 'accessoire', phase: 'principal', quantityPerBase: 30, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + raccords',
      },
      {
        id: 'bouche-soufflage', name: 'Bouches soufflage (1 par pièce sèche)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'bouche-extraction-df', name: 'Bouches extraction (1 par pièce humide)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'rejet-toit-df', name: 'Rejet toit',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'prise-air-neuf', name: 'Prise d\'air neuf',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'piege-a-son-vmc', name: 'Pièges à son (si circulation longue)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        optional: true,
        condition: 'Si logement dense ou exigence acoustique',
      },
      {
        id: 'filtre-g4-f7-vmc', name: 'Filtres G4 + F7 (1 jeu + 1 rechange)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'evac-condensats-vmc', name: 'Évacuation condensats PVC Ø32',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'commande-vmc-df', name: 'Commande programmable',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'cable-alim-vmc-df', name: 'Câble alimentation 3G1,5',
        category: 'plaque', phase: 'accessoires', quantityPerBase: 10, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #19.3 VMI (ventilation par insufflation)
  // ══════════════════════════════════════════════════════════
  {
    id: 'vmi-ventilation-insufflation',
    name: 'VMI — ventilation mécanique par insufflation (combles)',
    description: 'Caisson VMI en combles + gaines soufflage dans pièces de vie. Évacuation par conduits existants.',
    trade: 'ventilation',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 68.3 (Juin 2013)', title: 'VMC (référence)' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Alternative VMC simple flux, principe inversé (souffle au lieu d\'extraire)',
      'Caisson placé en combles perdus ou aménagés',
      'Filtre G4 sur l\'air insufflé',
      'Évacuation par conduits existants ou VB',
      'Moins courant qu\'en double flux — surtout rénovation',
    ],
    materials: [
      {
        id: 'caisson-vmi', name: 'Caisson VMI avec filtre G4',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'gaine-soufflage-vmi', name: 'Gaines soufflage (pièces de vie)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 15, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'bouche-soufflage-vmi', name: 'Bouches soufflage (par pièce)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'filtre-g4-vmi', name: 'Filtre G4 (entrée air neuf)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: '1 jeu + 1 rechange',
      },
      {
        id: 'cable-alim-vmi', name: 'Câble alimentation 3G1,5',
        category: 'plaque', phase: 'accessoires', quantityPerBase: 8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'commande-vmi', name: 'Commande filaire',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
    ],
  },
]
