import type { Recipe } from '../types'

/**
 * CLÔTURES & PORTAILS — audit #25
 *
 * Référentiels FR :
 * - NF EN 13241    Performance portes/portails (cf. menuiseries-ext.ts)
 * - RNU + PLU local (hauteur max réglementaire)
 */

export const cloturesPortailsRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #25.1 CLÔTURE GRILLAGE RIGIDE
  // ══════════════════════════════════════════════════════════
  {
    id: 'cloture-grillage-rigide',
    name: 'Clôture grillage rigide panneau 2,50 m (au ml)',
    description: 'Panneaux rigides soudés sur poteaux acier galva scellés béton. Hauteur 1,20-2,00 m.',
    trade: 'cloture',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF EN 10244', title: 'Revêtements métalliques non ferreux sur fil d\'acier' },
      { code: 'NF P98-409', title: 'Clôtures et portails — spécifications techniques' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Panneaux rigides soudés largeur 2,50 m (le plus courant)',
      'Poteaux acier galva entraxe 2,50 m (1 poteau / 2,50 ml)',
      'Scellement béton : 0,03 m³ par poteau (massif 30×30×30 cm)',
      'Jambes de force aux angles (conseillé)',
      'Clips de fixation panneau sur poteau (fournis avec poteaux Dirickx)',
    ],
    materials: [
      {
        id: 'panneau-grillage-rigide', name: 'Panneau grillage rigide soudé 2,50 m',
        category: 'plaque', phase: 'principal', quantityPerBase: 0.42, unit: 'm2', geometryMultiplier: 'height',
        wasteFactor: 1.05, wasteReason: 'Pertes',
        manufacturerRef: 'Dirickx / Betafence',
        notes: '1 m² panneau par ml × hauteur (géométrie multipliée par hauteur).',
      },
      {
        id: 'poteau-acier-galva', name: 'Poteaux acier galvanisé (entraxe 2,50 m)',
        category: 'ossature', phase: 'principal', quantityPerBase: 0.4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse',
      },
      {
        id: 'beton-scellement-poteau-clotu', name: 'Béton scellement poteaux (massif 30×30×30)',
        category: 'liant', phase: 'preparation', quantityPerBase: 0.012, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coulage',
        notes: '0,03 m³ par poteau × 0,4 poteau/ml = 0,012 m³/ml.',
      },
      {
        id: 'clip-fixation-grillage', name: 'Clips de fixation panneau/poteau',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'height',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'jambe-de-force-cloture', name: 'Jambes de force (aux angles)',
        category: 'ossature', phase: 'accessoires', quantityPerBase: 0.05, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        optional: true,
        condition: 'Recommandé aux angles et portails',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #25.2 CLÔTURE PANNEAUX BOIS / COMPOSITE
  // ══════════════════════════════════════════════════════════
  {
    id: 'cloture-panneaux-bois',
    name: 'Clôture panneaux bois classe 4 (1,80 m hauteur)',
    description: 'Panneaux bois pré-fabriqués + poteaux bois classe 4 autoclave + traverses. Style persienne ou occultant.',
    trade: 'cloture',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF EN 14081', title: 'Classement bois (classe 4 sol)' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Panneaux bois pré-fabriqués 1,80 m largeur typique',
      'Poteaux bois classe 4 autoclave (contact sol) — entraxe 1,80 m',
      'Scellement béton 0,03 m³ par poteau',
      'Quincaillerie : clous / vis inox',
      'Traitement lasure à renouveler tous 3-5 ans',
    ],
    materials: [
      {
        id: 'panneau-bois-cloture', name: 'Panneau bois clôture 1,80 m (persienne ou occultant)',
        category: 'bois', phase: 'principal', quantityPerBase: 0.56, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Pertes',
        notes: '1 panneau / 1,80 m = 0,56/ml.',
      },
      {
        id: 'poteau-bois-classe-4', name: 'Poteaux bois classe 4 autoclave',
        category: 'bois', phase: 'principal', quantityPerBase: 0.56, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse',
        normRef: 'NF EN 14081',
      },
      {
        id: 'beton-scellement-poteau-bois', name: 'Béton scellement poteaux bois',
        category: 'liant', phase: 'preparation', quantityPerBase: 0.017, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coulage',
      },
      {
        id: 'vis-inox-cloture-bois', name: 'Vis inox (fixation panneaux)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 8, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #25.3 MUR BAHUT (composition avec maçonnerie)
  // ══════════════════════════════════════════════════════════
  // Voir : trade #02 (semelle filante) + #04 (mur parpaing) + #04.6 (enduit)
  // Non dupliqué ici — utiliser les recettes maçonnerie existantes.
]
