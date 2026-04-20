import type { Recipe } from '../../types'

/**
 * FAÇADE & BARDAGE — audit #11
 *
 * Référentiels FR :
 * - NF DTU 26.1   Enduits aux mortiers (hydrauliques)
 * - NF DTU 42.1   Revêtements extérieurs en polymère (pâteux)
 * - NF DTU 41.2   Bardage bois et panneaux dérivés
 * - NF DTU 33.1   Façades légères
 */

export const facadeBardageRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #11.1 ENDUIT MONOCOUCHE (prêt à l'emploi)
  // ══════════════════════════════════════════════════════════
  {
    id: 'enduit-facade-monocouche',
    name: 'Enduit extérieur monocouche (prêt à l\'emploi)',
    description: 'Enduit monocouche 25 kg/m² pour 15-18 mm en 2 passes rapprochées. Grillage armature aux jonctions.',
    trade: 'facade',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 26.1 (Avril 2008)', title: 'Enduits aux mortiers' },
      { code: 'Cahier CSTB 3678', title: 'Enduits monocouches' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Enduit monocouche 25 kg/m² pour épaisseur 15-18 mm',
      'Mise en œuvre 2 passes rapprochées (humide sur humide)',
      'Humidification support obligatoire avant application',
      'Profils d\'angle PVC + profilé départ alu',
      'Grillage armature obligatoire aux jonctions entre matériaux',
    ],
    materials: [
      {
        id: 'enduit-monocouche', name: 'Enduit monocouche prêt à l\'emploi',
        category: 'enduit', phase: 'principal', quantityPerBase: 25, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Projection + taloche',
        dtu: 'Cahier CSTB 3678',
        manufacturerRef: 'Weber.monorex / Parex Lanko / PRB',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'eau-enduit-facade', name: 'Eau de gâchage',
        category: 'eau', phase: 'principal', quantityPerBase: 4, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage précis',
      },
      {
        id: 'corniere-angle-pvc-facade', name: 'Cornières d\'angle PVC (angles + rives)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.2, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 26.1 §6.5',
      },
      {
        id: 'profil-depart-enduit', name: 'Profilé de départ alu (bas de façade)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'grillage-armature-facade', name: 'Grillage armature fibre de verre (jonctions)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.15, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Recouvrements',
        dtu: 'NF DTU 26.1 §6.4.3',
        optional: true,
        condition: 'Obligatoire si mur en multiples matériaux (parpaing+brique)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #11.3 BARDAGE BOIS SUR OSSATURE
  // ══════════════════════════════════════════════════════════
  {
    id: 'bardage-bois-claire-voie',
    name: 'Bardage bois sur ossature (douglas / mélèze, classe 3)',
    description: 'Lames bardage bois classe 3 sur tasseaux verticaux 40×50 entraxe 60 cm. Pare-pluie HPV.',
    trade: 'facade',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 41.2 (Septembre 2015)', title: 'Bardage bois et panneaux dérivés', section: '§5-7' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Lames bois classe 3 (essence : douglas, mélèze, red cedar)',
      'Tasseaux 40×50 classe 2 autoclave, entraxe 60 cm (1,67 ml/m²)',
      'Pare-pluie HPV obligatoire (étanchéité air + perméabilité vapeur)',
      'Vis inox A2 (A4 en bord de mer) — NF DTU 41.2 §7',
      'Grille anti-rongeurs en pied + haut de bardage',
      'Traitement ou lasure à prévoir si bois non pré-traité',
    ],
    materials: [
      // ═══ PRÉPARATION ═══
      {
        id: 'pare-pluie-hpv-bardage', name: 'Pare-pluie HPV (étanchéité air)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
        manufacturerRef: 'Delta Maxx / Siga Majpell',
      },
      {
        id: 'tasseau-ossature-40-50', name: 'Tasseaux ossature bois 40×50 (classe 2, entraxe 60 cm)',
        category: 'bois', phase: 'preparation', quantityPerBase: 1.67, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 41.2 §5.3',
      },
      // ═══ PRINCIPAL ═══
      {
        id: 'lame-bardage-bois', name: 'Lames bardage bois classe 3 (douglas / mélèze / cedar)',
        category: 'bois', phase: 'principal', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Recouvrements + pertes',
        dtu: 'NF DTU 41.2',
        manufacturerRef: 'ThermoWood / Piveteau',
      },
      // ═══ ACCESSOIRES ═══
      {
        id: 'vis-inox-bardage', name: 'Vis inox A2 (ou A4 bord de mer)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 22, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
        dtu: 'NF DTU 41.2 §7',
      },
      {
        id: 'grille-anti-rongeurs', name: 'Grille anti-rongeurs (pied + haut)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.4, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'profil-finition-alu-bardage', name: 'Profils finition alu (départ / arrêt)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.4, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      // ═══ FINITIONS ═══
      {
        id: 'traitement-bardage-bois', name: 'Traitement fongicide/insecticide (si non pré-traité)',
        category: 'adjuvant', phase: 'finitions', quantityPerBase: 0.5, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Application',
        optional: true,
        condition: 'Si bois non pré-traité usine',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #11.4 BARDAGE COMPOSITE / FIBRE-CIMENT
  // ══════════════════════════════════════════════════════════
  {
    id: 'bardage-composite-fibre-ciment',
    name: 'Bardage composite fibre-ciment (Cedral / HardiePlank)',
    description: 'Lames fibre-ciment pré-peintes usine. Ossature tasseaux identique bardage bois.',
    trade: 'facade',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 41.2 (Septembre 2015)', title: 'Bardage (référence)' },
      { code: 'ATEC fabricant', title: 'Cedral / HardiePlank' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Lames Cedral (Eternit) ou HardiePlank (James Hardie) pré-peintes usine',
      'Pas de traitement à prévoir — finition usine 15 ans',
      'Vis fabricant spécifiques (tête peinte assortie couleur)',
      'Ossature + pare-pluie identiques bardage bois',
    ],
    materials: [
      {
        id: 'pare-pluie-hpv-bardage', name: 'Pare-pluie HPV',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
      },
      {
        id: 'tasseau-ossature-40-50', name: 'Tasseaux ossature 40×50',
        category: 'bois', phase: 'preparation', quantityPerBase: 1.67, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'lame-cedral', name: 'Lames Cedral / HardiePlank (fibre-ciment)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + recouvrements',
        manufacturerRef: 'Eternit Cedral / James Hardie HardiePlank',
      },
      {
        id: 'vis-cedral', name: 'Vis fabricant tête peinte',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 22, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'profil-depart-bardage-composite', name: 'Profils départ / finition',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.4, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #11.5 BARDAGE MÉTALLIQUE (bac acier / zinc)
  // ══════════════════════════════════════════════════════════
  {
    id: 'bardage-metallique-bac-acier',
    name: 'Bardage bac acier nervuré vertical ou horizontal',
    description: 'Plaques acier prélaqué nervurées sur ossature tasseaux + pare-pluie.',
    trade: 'facade',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 40.35 (Août 2018)', title: 'Plaques nervurées métalliques' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Bac acier prélaqué (pose verticale ou horizontale)',
      'Vis autoforeuses + rondelles EPDM',
      'Closoirs + cornières aux joints',
      'Ossature + pare-pluie identiques bardage bois',
    ],
    materials: [
      {
        id: 'pare-pluie-hpv-bardage', name: 'Pare-pluie HPV',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
      },
      {
        id: 'tasseau-ossature-40-50', name: 'Tasseaux ossature 40×50',
        category: 'bois', phase: 'preparation', quantityPerBase: 1.67, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'bac-acier-bardage', name: 'Bac acier prélaqué nervuré (bardage)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Recouvrements latéraux',
        dtu: 'NF DTU 40.35',
      },
      {
        id: 'vis-autoforeuse-epdm-bardage', name: 'Vis autoforeuse + rondelle EPDM',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 8, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'closoir-bardage-bac', name: 'Closoirs mousse',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.2, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'corniere-bardage-metal', name: 'Cornières d\'angle / finition',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.2, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #11.6 VÊTURE (panneaux collés)
  // ══════════════════════════════════════════════════════════
  {
    id: 'veture-panneaux-rigides',
    name: 'Vêture panneaux rigides collés (fibre-ciment / pierre reconstituée)',
    description: 'Panneaux rigides décoratifs fixés par collage MAP + chevillage sur mur existant.',
    trade: 'facade',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'Cahier CSTB 3035', title: 'Règles systèmes vêture' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Panneaux rigides fibre-ciment ou pierre reconstituée',
      'Collage au MAP + chevillage mécanique complémentaire',
      'Joints silicone entre panneaux (esthétique + étanchéité)',
      'Alternative plus légère que le bardage ossature',
    ],
    materials: [
      {
        id: 'panneau-veture', name: 'Panneaux rigides (fibre-ciment / pierre reconstituée)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
      {
        id: 'mortier-colle-map-veture', name: 'Mortier adhésif MAP',
        category: 'colle', phase: 'principal', quantityPerBase: 5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Résidus',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'cheville-veture', name: 'Chevilles mécaniques (complément collage)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse',
      },
      {
        id: 'silicone-joint-veture', name: 'Silicone joint entre panneaux',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.05, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purge cartouche',
        packaging: { unit: 'cartouche', contentQty: 0.31, contentUnit: 'L', label: 'cartouche 310 ml' },
      },
    ],
  },
]
