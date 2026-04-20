import type { Recipe } from '../types'

/**
 * PLOMBERIE SANITAIRE — audit #17
 *
 * Référentiels FR :
 * - NF DTU 60.1   Plomberie sanitaire bâtiments
 * - NF DTU 60.5   Canalisations cuivre
 * - NF DTU 60.11  Règles de calcul (dimensionnement)
 * - NF DTU 60.31  PVC-U alimentation pression
 * - NF DTU 60.32  PVC évacuation intérieure
 * - NF DTU 60.33  PVC évacuation extérieure
 *
 * Référentiels PT : NP EN 806, NP EN 12056, DL 23/95
 */

export const plomberieRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #17.1 ALIMENTATION PER / MULTICOUCHE (par point d'eau)
  // ══════════════════════════════════════════════════════════
  {
    id: 'plomberie-alim-per',
    name: 'Alimentation eau PER / multicouche (distribution en étoile)',
    description: 'Alim EF + ECS par point d\'eau depuis nourrice. Tubes PER bleu/rouge Ø16 en gaine ICTA.',
    trade: 'plomberie',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 60.1', title: 'Plomberie sanitaire bâtiments' },
      { code: 'NF DTU 60.11', title: 'Règles de calcul plomberie' },
      { code: 'NF EN ISO 15875-1', title: 'Tubes PER' },
      { code: 'NF EN 21003-1', title: 'Multicouche' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = 1 point d\'eau (lavabo, évier, douche, WC…) — estimation 8 ml tube par point depuis nourrice',
      'Alimentation en étoile depuis nourrice (distribution préférée rénovation)',
      'Tube PER bleu EF + PER rouge ECS en gaine ICTA préformée',
      'Clapet anti-retour + vanne d\'arrêt général incluses (NF DTU 60.1 §5.4)',
      'Isolant ECS RT2012/RE2020 pour tubes ECS > 3 m dans volume non chauffé',
      'Test de pression obligatoire avant fermeture gaines (NF DTU 60.1)',
    ],
    materials: [
      // ═══ PRINCIPAL ═══
      {
        id: 'tube-per-16-bleu', name: 'Tube PER Ø16 bleu (EF, en couronne)',
        category: 'plaque', phase: 'principal', quantityPerBase: 8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + cintrage',
        dtu: 'NF DTU 60.1', normRef: 'NF EN ISO 15875',
        manufacturerRef: 'Comap MultiSkin / Uponor / Giacomini',
        packaging: { unit: 'rouleau', contentQty: 50, contentUnit: 'ml', label: 'couronne 50 ml' },
      },
      {
        id: 'tube-per-16-rouge', name: 'Tube PER Ø16 rouge (ECS, en couronne)',
        category: 'plaque', phase: 'principal', quantityPerBase: 5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + cintrage',
        dtu: 'NF DTU 60.1', normRef: 'NF EN ISO 15875',
        manufacturerRef: 'Comap / Uponor',
        packaging: { unit: 'rouleau', contentQty: 50, contentUnit: 'ml', label: 'couronne 50 ml' },
        notes: '5 ml ECS / point (WC n\'a pas d\'ECS — moyenne pondérée).',
      },
      {
        id: 'gaine-icta-per', name: 'Gaine ICTA Ø25 (protection + isolation tubes)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 13, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        dtu: 'NF DTU 60.1',
        packaging: { unit: 'rouleau', contentQty: 25, contentUnit: 'ml', label: 'couronne 25 ml' },
      },
      {
        id: 'nourrice-per', name: 'Nourrice PER multiple (collecteur distribution)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 0.25, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Comap / Giacomini',
        notes: '1 nourrice pour ~4 points d\'eau (0,25 u/point).',
      },
      // ═══ ACCESSOIRES ═══
      {
        id: 'raccord-per-glissement', name: 'Raccords PER à glissement (coudes + tés)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Rebuts',
        dtu: 'NF DTU 60.1',
      },
      {
        id: 'vanne-arret-general', name: 'Robinet d\'arrêt général (1/4 tour)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.25, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 60.1',
        manufacturerRef: 'Comap / Watts',
        notes: '1 vanne par logement (0,25 u/point si T3-T4).',
      },
      {
        id: 'clapet-anti-retour-ep', name: 'Clapet anti-retour (après compteur)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.25, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 60.1 §5.4',
        notes: '1 clapet par logement (obligatoire).',
      },
      {
        id: 'collier-per', name: 'Collier de fixation tube PER (tous les 50 cm)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 16, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte chantier',
      },
      {
        id: 'gaine-fourreau-passage', name: 'Gaine fourreau protection passage mur',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
      // ═══ FINITIONS ═══
      {
        id: 'isolant-tube-ecs', name: 'Isolant tube ECS (mousse PE 19 mm)',
        category: 'isolant', phase: 'finitions', quantityPerBase: 3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + raccords',
        dtu: 'RT2012 / RE2020',
        optional: true,
        condition: 'Si tubes ECS > 3 m dans volume non chauffé',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #17.2 ALIMENTATION CUIVRE
  // ══════════════════════════════════════════════════════════
  {
    id: 'plomberie-alim-cuivre',
    name: 'Alimentation eau cuivre Ø14/16 (réseau linéaire)',
    description: 'Alim cuivre brasage capillaire ou sertissage. Réseau linéaire au mètre.',
    trade: 'plomberie',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF DTU 60.5', title: 'Canalisations cuivre' },
      { code: 'NF EN 1057', title: 'Tubes cuivre' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Tube cuivre Ø14 (alim secondaire) ou Ø16 (principale) — selon DN calcul',
      'Pose par brasage capillaire OU sertissage (raccords à sertir)',
      'Section par point : Ø12 lavabo, Ø14 évier/douche, Ø16 baignoire/général',
      'Isolant mousse pour ECS (déperditions + condensation EF)',
    ],
    materials: [
      {
        id: 'tube-cuivre-16', name: 'Tube cuivre Ø16 mm (barre 5 ml)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + cintrage',
        dtu: 'NF DTU 60.5', normRef: 'NF EN 1057',
        manufacturerRef: 'KME / Wieland',
        packaging: { unit: 'u', contentQty: 5, contentUnit: 'ml', label: 'barre 5 ml' },
      },
      {
        id: 'raccord-cuivre-brasage', name: 'Raccords cuivre à braser (coudes + tés)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Rebuts',
        dtu: 'NF DTU 60.5',
      },
      {
        id: 'etain-brasure', name: 'Étain de brasure (Sn 97/Cu 3)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.01, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Pertes soudure',
        packaging: { unit: 'u', contentQty: 0.25, contentUnit: 'kg', label: 'bobine 250 g' },
      },
      {
        id: 'decapant-brasage', name: 'Décapant pour brasage cuivre',
        category: 'adjuvant', phase: 'accessoires', quantityPerBase: 0.005, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus',
        packaging: { unit: 'pot', contentQty: 0.25, contentUnit: 'L', label: 'pot 250 ml' },
      },
      {
        id: 'collier-cuivre', name: 'Colliers cuivre isolés (tous 1 m)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'isolant-tube-cuivre', name: 'Isolant tube cuivre (mousse PE 9 mm)',
        category: 'isolant', phase: 'finitions', quantityPerBase: 1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        optional: true,
        condition: 'Pour ECS (obligatoire RE2020) ou EF anti-condensation',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #17.3 ÉVACUATIONS PVC (EU + EV)
  // ══════════════════════════════════════════════════════════
  {
    id: 'plomberie-evacuation-pvc',
    name: 'Évacuations PVC (EU + EV) — réseau linéaire',
    description: 'Évacuations PVC avec ventilation primaire obligatoire. Diamètres selon usage.',
    trade: 'plomberie',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF DTU 60.32', title: 'PVC évacuation intérieure' },
      { code: 'NF DTU 60.33', title: 'PVC évacuation extérieure' },
      { code: 'NF EN 1451-1', title: 'PVC évacuation' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Diamètres par usage : Ø32 lavabo/bidet, Ø40 douche/lave-linge, Ø50 évier/baignoire, Ø100 WC+chute',
      'Ratio 1 ml = 1 ml tube + accessoires (coudes/tés ~0,3/ml moyen)',
      'Colle PVC spéciale obligatoire (NF DTU 60.32 §6.2) — pas de colle universelle',
      'Ventilation primaire obligatoire chute EV Ø100 en toiture',
      'Tampon de visite tous les 15 ml ou changement de direction',
      'Siphon obligatoire par appareil sanitaire',
    ],
    materials: [
      {
        id: 'tube-pvc-evac-100', name: 'Tube PVC Ø100 évacuation (barre 4 ml)',
        category: 'plaque', phase: 'principal', quantityPerBase: 0.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 60.32', normRef: 'NF EN 1451-1',
        packaging: { unit: 'u', contentQty: 4, contentUnit: 'ml', label: 'barre 4 ml' },
        notes: 'Ratio 30% du linéaire typiquement en Ø100 (chute WC).',
      },
      {
        id: 'tube-pvc-evac-50', name: 'Tube PVC Ø50 évacuation',
        category: 'plaque', phase: 'principal', quantityPerBase: 0.4, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 60.32',
        packaging: { unit: 'u', contentQty: 4, contentUnit: 'ml', label: 'barre 4 ml' },
      },
      {
        id: 'tube-pvc-evac-40', name: 'Tube PVC Ø40 évacuation',
        category: 'plaque', phase: 'principal', quantityPerBase: 0.2, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 60.32',
        packaging: { unit: 'u', contentQty: 4, contentUnit: 'ml', label: 'barre 4 ml' },
      },
      {
        id: 'tube-pvc-evac-32', name: 'Tube PVC Ø32 évacuation',
        category: 'plaque', phase: 'principal', quantityPerBase: 0.1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 60.32',
        packaging: { unit: 'u', contentQty: 4, contentUnit: 'ml', label: 'barre 4 ml' },
      },
      {
        id: 'colle-pvc', name: 'Colle PVC spéciale évacuation',
        category: 'colle', phase: 'accessoires', quantityPerBase: 0.02, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus',
        dtu: 'NF DTU 60.32 §6.2',
        manufacturerRef: 'Griffon / Bostik',
        packaging: { unit: 'pot', contentQty: 1, contentUnit: 'L', label: 'boîte 1 L' },
      },
      {
        id: 'raccords-pvc-coudes-tes', name: 'Raccords PVC (coudes + tés + manchons)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Rebuts',
      },
      {
        id: 'collier-pvc-evac', name: 'Colliers fixation PVC (horizontal 80 cm, vertical 2 m)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.8, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'tampon-visite-pvc', name: 'Tampon de visite PVC (chaque 15 ml)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.07, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 60.32',
      },
      {
        id: 'ventilation-primaire-chute', name: 'Chapeau ventilation primaire Ø100 (toiture)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.05, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 60.11 §7',
        notes: '1 chapeau par chute EV (ratio 0,05 / ml).',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #17.4 WC SUSPENDU
  // ══════════════════════════════════════════════════════════
  {
    id: 'plomberie-wc-suspendu',
    name: 'WC suspendu (bâti-support + cuvette + accessoires)',
    description: 'Bâti-support Geberit / Grohe + cuvette sans bride + plaque commande. Scellement au mur porteur obligatoire.',
    trade: 'plomberie',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 60.1', title: 'Plomberie sanitaire' },
      { code: 'NF EN 997', title: 'Cuvettes WC céramique' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Bâti-support avec réservoir double débit 3/6 L (obligatoire RE2020)',
      'Cuvette sans bride (hygiène — obligatoire établissements santé)',
      'Plaque de commande double débit',
      'Scellement mur porteur par chevilles métal M10 (pas de cloison alvéolaire)',
      'Alimentation EF : robinet d\'arrêt + flexible inclus',
    ],
    materials: [
      {
        id: 'bati-wc-suspendu', name: 'Bâti-support WC suspendu (Geberit Duofix / Grohe Rapid SL)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Geberit / Grohe / Wirquin',
      },
      {
        id: 'cuvette-wc-sans-bride', name: 'Cuvette WC suspendue sans bride',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF EN 997',
        manufacturerRef: 'Villeroy & Boch / Duravit / Roca',
      },
      {
        id: 'abattant-wc', name: 'Abattant WC frein de chute (softclose)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'plaque-commande-wc', name: 'Plaque de commande double débit 3/6 L',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Geberit Sigma / Grohe Skate',
      },
      {
        id: 'raccord-ev-wc', name: 'Raccord évacuation EV Ø100 WC',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'flexible-arrivee-eau', name: 'Flexible arrivée EF (Gripp 3/8" × 40 cm)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'kit-scellement-bati', name: 'Kit scellement bâti (chevilles M10 + tire-fond)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'silicone-sanitaire-wc', name: 'Silicone sanitaire (joint périphérique)',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.05, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purge cartouche',
        packaging: { unit: 'cartouche', contentQty: 0.31, contentUnit: 'L', label: 'cartouche 310 ml' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #17.5 LAVABO / VASQUE
  // ══════════════════════════════════════════════════════════
  {
    id: 'plomberie-lavabo',
    name: 'Lavabo / vasque (mitigeur + siphon)',
    description: 'Lavabo mural ou vasque à poser. Mitigeur chromé + siphon chromé + flexibles.',
    trade: 'plomberie',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [{ code: 'NF DTU 60.1', title: 'Plomberie sanitaire' }],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Mitigeur chromé standard (Grohe Eurosmart niveau gamme économique)',
      'Alternative thermostatique + économique d\'eau selon demande',
      'Siphon laiton chromé Ø32',
      '2 flexibles inox G3/8" × G1/2" × 50 cm (EF + EC)',
      '2 robinets d\'arrêt (1/4 tour sous lavabo)',
    ],
    materials: [
      {
        id: 'lavabo-ceramique', name: 'Lavabo céramique (à poser ou suspendu)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Villeroy & Boch / Jacob Delafon / Roca',
      },
      {
        id: 'mitigeur-lavabo', name: 'Mitigeur lavabo chromé',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Grohe Eurosmart / Hansgrohe Talis',
      },
      {
        id: 'siphon-lavabo', name: 'Siphon laiton chromé Ø32',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'flexible-inox-lavabo', name: 'Flexibles inox G3/8" (2× 50 cm, EF + EC)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'robinet-arret-lavabo', name: 'Robinets d\'arrêt 1/4 tour (EF + EC)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'bonde-clic-clac', name: 'Bonde clic-clac + trop-plein',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'silicone-sanitaire-lavabo', name: 'Silicone sanitaire (joint périphérique)',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.03, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purge cartouche',
        packaging: { unit: 'cartouche', contentQty: 0.31, contentUnit: 'L', label: 'cartouche 310 ml' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #17.6 DOUCHE (bac + paroi + colonne)
  // ══════════════════════════════════════════════════════════
  {
    id: 'plomberie-douche-italienne',
    name: 'Douche à l\'italienne (receveur extra-plat + paroi + colonne)',
    description: 'Douche complète avec receveur, paroi vitrée, colonne mitigeur. Membrane SPEC obligatoire pour douche à l\'italienne.',
    trade: 'plomberie',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 60.1', title: 'Plomberie sanitaire' },
      { code: 'NF DTU 52.10', title: 'SPEC sous carrelage' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Receveur extra-plat résine (Kinedo / Jacob Delafon) dim std 90×90 à 120×80',
      'Paroi vitrée sécurit 8 mm (porte battante ou coulissante)',
      'Colonne douche : mitigeur + pommeau fixe + douchette à main',
      'Bonde grand débit Ø90 (évacuation rapide)',
      'Membrane SPEC obligatoire pour douche à l\'italienne (NF DTU 52.10)',
      'Silicone SEL (spécifique salles d\'eau) pour joints périphériques',
    ],
    materials: [
      {
        id: 'receveur-douche-extraplat', name: 'Receveur douche extra-plat résine',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Kinedo / Jacob Delafon / Novellini',
      },
      {
        id: 'paroi-douche-vitree', name: 'Paroi douche vitrée sécurit 8 mm',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'colonne-douche', name: 'Colonne douche (mitigeur + pommeau fixe + douchette)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Grohe / Hansgrohe',
      },
      {
        id: 'bonde-douche-90', name: 'Bonde douche Ø90 grand débit',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'membrane-spec-douche', name: 'Membrane SPEC sous carrelage (douche italienne)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 5, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements + relevés',
        dtu: 'NF DTU 52.10',
        manufacturerRef: 'Mapei Mapegum WPS / Weber.sys Protect',
        notes: 'Surface sol + 50 cm relevés — 5 m² typique pour 1 douche.',
      },
      {
        id: 'raccord-alim-douche', name: 'Raccords alimentation EF/EC multicouche',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Rebuts',
      },
      {
        id: 'silicone-sel-douche', name: 'Silicone SEL (spécifique salles d\'eau)',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.1, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purge + périmètre',
        packaging: { unit: 'cartouche', contentQty: 0.31, contentUnit: 'L', label: 'cartouche 310 ml' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #17.7 BAIGNOIRE
  // ══════════════════════════════════════════════════════════
  {
    id: 'plomberie-baignoire',
    name: 'Baignoire acrylique (170×70) + robinetterie + set vidage',
    description: 'Baignoire acrylique standard avec tablier + mitigeur mural + set vidage complet.',
    trade: 'plomberie',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [{ code: 'NF DTU 60.1', title: 'Plomberie sanitaire' }],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Baignoire acrylique 170×70 (format standard)',
      'Alternative : acier émaillé (plus lourde) ou fonte (premium)',
      'Mitigeur mural (gorge) ou sur gorge baignoire selon modèle',
      'Set de vidage complet (bonde + trop-plein + flexible évacuation)',
      'Mousse acoustique sous baignoire (anti-vibration)',
    ],
    materials: [
      {
        id: 'baignoire-acrylique-170', name: 'Baignoire acrylique 170×70',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Jacob Delafon / Kaldewei',
      },
      {
        id: 'tablier-baignoire', name: 'Tablier baignoire (habillage)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'mitigeur-baignoire', name: 'Mitigeur baignoire mural',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Grohe / Hansgrohe',
      },
      {
        id: 'set-vidage-baignoire', name: 'Set vidage baignoire (bonde + trop-plein + flexible)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'pieds-reglables-baignoire', name: 'Pieds réglables baignoire (4 u)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'mousse-acoustique-baignoire', name: 'Mousse acoustique sous baignoire',
        category: 'isolant', phase: 'accessoires', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        optional: true,
        condition: 'Recommandé étage — anti-vibration',
      },
      {
        id: 'silicone-sanitaire-baignoire', name: 'Silicone sanitaire (joint périphérique)',
        category: 'joint', phase: 'finitions', quantityPerBase: 0.08, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Périmètre baignoire',
        packaging: { unit: 'cartouche', contentQty: 0.31, contentUnit: 'L', label: 'cartouche 310 ml' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #17.8 CHAUFFE-EAU
  // ══════════════════════════════════════════════════════════
  {
    id: 'plomberie-chauffe-eau-elec',
    name: 'Chauffe-eau électrique (cumulus ACI vertical)',
    description: 'Cumulus électrique 150-300 L, capacité selon nb EH. Groupe sécurité obligatoire + évacuation.',
    trade: 'plomberie',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 60.1', title: 'Plomberie sanitaire', section: '§6.4 groupe sécurité' },
      { code: 'NF EN 60335-2-21', title: 'Sécurité chauffe-eau électriques' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Cumulus 200 L (capacité adaptée T3-T4, 3-4 EH)',
      'T1-T2 → 100-150 L / T5+ → 250-300 L',
      'Technologie ACI Hybride (anti-corrosion + longévité)',
      'Groupe de sécurité OBLIGATOIRE (NF DTU 60.1 §6.4)',
      'Vase d\'expansion obligatoire sur ECS > 50 L (NF DTU 60.11)',
      'Raccordement électrique 230V dédié au tableau + disjoncteur 20A',
      'Alternative : chauffe-eau thermodynamique (RE2020 privilégié)',
    ],
    materials: [
      {
        id: 'cumulus-electrique-200', name: 'Cumulus électrique ACI 200 L vertical',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Atlantic Chauffeo / Thermor Duralis',
      },
      {
        id: 'groupe-securite-ce', name: 'Groupe de sécurité chauffe-eau (NF)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 60.1 §6.4',
        manufacturerRef: 'Watts',
      },
      {
        id: 'siphon-evac-groupe-securite', name: 'Siphon + tube PVC évacuation groupe sécurité',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Ajustement',
      },
      {
        id: 'flexibles-inox-ce', name: 'Flexibles inox G1/2" × 40 cm (2 u EF + ECS)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'vanne-arret-ce', name: 'Vanne d\'arrêt 1/4 tour amont',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'vase-expansion-ce', name: 'Vase d\'expansion 5 L (ECS)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 60.11',
      },
      {
        id: 'supports-mur-ce', name: 'Supports muraux + tiges filetées M10',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: 'Fixation mur porteur — charge 250 kg en eau.',
      },
      {
        id: 'teflon-ce', name: 'Téflon + pâte à joint (étanchéité raccords)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
    ],
  },
]
