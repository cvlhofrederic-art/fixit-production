import type { Recipe } from '../../types'

/**
 * MENUISERIES INTÉRIEURES — audit #14
 *
 * Référentiels FR :
 * - NF DTU 36.2   Menuiseries intérieures en bois
 * - NF DTU 51.1   Parquet massif cloué
 * - NF DTU 51.2   Parquet collé
 * - NF DTU 51.3   Parquet flottant sur lambourdes
 * - NF DTU 51.11  Parquet flottant / stratifié
 */

export const menuiseriesIntRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #14.1 PORTE INTÉRIEURE
  // ══════════════════════════════════════════════════════════
  {
    id: 'menuiserie-int-porte',
    name: 'Porte intérieure (bloc-porte + quincaillerie)',
    description: 'Bloc-porte complet : dormant + vantail 83×204 + serrure + paumelles + poignées + butoir.',
    trade: 'menuiserie_int',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 36.2 (Novembre 2019)', title: 'Menuiseries intérieures bois', section: '§5-6' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Bloc-porte standard 83×204 cm (adapter si atypique)',
      'Essence : MDF / bois massif / composite selon budget',
      'Serrure type BT (bec-de-cane) pour chambre — serrure à clé pour WC/SDB',
      '3 paumelles (standard)',
      'Réglage par cale bois + mousse PU',
    ],
    materials: [
      {
        id: 'bloc-porte-interieure', name: 'Bloc-porte complet (dormant + vantail + joint)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 36.2',
        manufacturerRef: 'Eclisse / Tordjman / Sofrappo',
      },
      {
        id: 'serrure-bec-cane', name: 'Serrure bec-de-cane + cylindre',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'paumelle-porte', name: 'Paumelles (3 u standard)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'poignee-porte', name: 'Poignées (2 × béquille)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'butoir-mural', name: 'Butoir mural (anti-choc)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'mousse-pu-porte', name: 'Mousse PU + cales bois (réglage)',
        category: 'adjuvant', phase: 'accessoires', quantityPerBase: 0.5, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purge cartouche',
        packaging: { unit: 'cartouche', contentQty: 0.75, contentUnit: 'L', label: 'cartouche 750 ml' },
      },
      {
        id: 'chambranle-porte', name: 'Cornière bois ou plinthe murale (jonction mur)',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes angles',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #14.2 PLACARD 2 PORTES COULISSANTES
  // ══════════════════════════════════════════════════════════
  {
    id: 'placard-2-portes-coulissantes',
    name: 'Placard 2 portes coulissantes (2 m largeur)',
    description: 'Placard intégré avec portes coulissantes miroir/bois/verre. Rails haut/bas + aménagement intérieur.',
    trade: 'menuiserie_int',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [{ code: 'NF DTU 36.2 (Novembre 2019)', title: 'Menuiseries intérieures bois' }],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Placard 2 vantaux × 1 m (largeur totale 2 m standard)',
      'Alternative 3 vantaux pour largeur 2,40 m',
      'Rails haut + bas obligatoires + guides plastique',
      'Aménagement intérieur : 1 tablard + 1 pendeur minimum',
    ],
    materials: [
      {
        id: 'porte-coulissante-placard', name: 'Portes coulissantes (2 vantaux, miroir/bois/verre)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sur mesure',
      },
      {
        id: 'rail-haut-placard', name: 'Rail haut + guides (fixation plafond/sol)',
        category: 'ossature', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
      },
      {
        id: 'tablard-placard', name: 'Panneaux séparation intérieur (tablards)',
        category: 'bois', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'pendeur-placard', name: 'Pendeur + support',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'roulette-placard', name: 'Roulettes + poignées',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #14.3 ESCALIER BOIS DROIT (1/4 TOURNANT)
  // ══════════════════════════════════════════════════════════
  {
    id: 'escalier-bois-14-marches',
    name: 'Escalier bois droit ou 1/4 tournant (14 marches)',
    description: 'Escalier 2,70 m hauteur, 14 marches. Limons + marches + contremarches + balustres + main courante.',
    trade: 'menuiserie_int',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 36.2 (Novembre 2019)', title: 'Menuiseries intérieures bois', section: '§8 Escaliers' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Escalier 14 marches pour hauteur étage 2,70 m (19 cm marche)',
      'Essence : hêtre (économique), chêne (standard), sapin (rustique)',
      'Limons latéraux (2) ou central (1) selon modèle',
      'Balustres : 1 par marche généralement',
      'Main courante bois vernie/huilée',
    ],
    materials: [
      {
        id: 'marche-bois', name: 'Marches bois (14 u)',
        category: 'bois', phase: 'principal', quantityPerBase: 14, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
      {
        id: 'contremarche-bois', name: 'Contremarches bois (14 u)',
        category: 'bois', phase: 'principal', quantityPerBase: 14, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
      {
        id: 'limon-bois', name: 'Limons bois (2 latéraux OU 1 central)',
        category: 'bois', phase: 'principal', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes sur mesure',
      },
      {
        id: 'balustre-bois', name: 'Balustres bois (1 par marche)',
        category: 'bois', phase: 'principal', quantityPerBase: 14, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse',
      },
      {
        id: 'main-courante-bois', name: 'Main courante bois',
        category: 'bois', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
      {
        id: 'poteau-escalier', name: 'Poteaux d\'appui haut/bas (2 u)',
        category: 'bois', phase: 'principal', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
      {
        id: 'vis-chevilles-escalier', name: 'Vis + chevilles fixation',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #14.4 PARQUET MASSIF CLOUÉ
  // ══════════════════════════════════════════════════════════
  {
    id: 'parquet-massif-cloue',
    name: 'Parquet massif cloué sur lambourdes (chêne / hêtre)',
    description: 'Parquet massif traditionnel sur lambourdes + isolant acoustique entre lambourdes + vitrification.',
    trade: 'menuiserie_int',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 51.1 (Janvier 2014)', title: 'Parquet massif cloué' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Lambourdes bois 27×50 entraxe 30-40 cm (3 ml/m²)',
      'Isolant acoustique laine minérale 40 mm entre lambourdes',
      'Lames parquet massif (chêne le plus courant)',
      'Pertes lames : 10% (coupes en rives)',
      'Vitrificateur 2 couches (entretien 10 ans)',
      'Alternative : huile (aspect naturel + entretien plus fréquent)',
    ],
    materials: [
      {
        id: 'lambourde-parquet', name: 'Lambourdes bois 27×50 (classe 2)',
        category: 'bois', phase: 'preparation', quantityPerBase: 3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 51.1',
      },
      {
        id: 'laine-acoustique-parquet', name: 'Laine minérale acoustique 40 mm (entre lambourdes)',
        category: 'isolant', phase: 'preparation', quantityPerBase: 0.85, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Découpes',
        notes: 'Déduction ~15% surface lambourdes.',
      },
      {
        id: 'lame-parquet-massif', name: 'Lames parquet massif (chêne)',
        category: 'bois', phase: 'principal', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes rives',
        dtu: 'NF DTU 51.1',
      },
      {
        id: 'clou-parquet-tete-perdue', name: 'Clous parquet tête perdue 2,5×50',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 12, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'vitrificateur-parquet', name: 'Vitrificateur (ou huile) 2 couches',
        category: 'peinture', phase: 'finitions', quantityPerBase: 0.3, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac + rouleau',
        manufacturerRef: 'Bona / Pall-X / Blanchon',
        packaging: { unit: 'pot', contentQty: 5, contentUnit: 'L', label: 'bidon 5 L' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #14.5 PARQUET FLOTTANT / STRATIFIÉ
  // ══════════════════════════════════════════════════════════
  {
    id: 'parquet-flottant-stratifie',
    name: 'Parquet flottant stratifié (Quick-Step / Tarkett)',
    description: 'Stratifié sur sous-couche acoustique + film polyane. Pose flottante à clic, pertes 8%.',
    trade: 'menuiserie_int',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 51.11 (Octobre 2022)', title: 'Parquet flottant / stratifié' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Lames stratifié format 1,20 × 0,20 m typique',
      'Sous-couche acoustique mousse PE 3 mm (ou équivalent)',
      'Film polyane barrière humidité sous sous-couche',
      'Pertes 8% (pose droite — majorer 10-12% si pose diagonale)',
      'Cales dilatation périphériques 8-10 mm',
      'Nez de seuil aux ouvertures / jonctions autres pièces',
    ],
    materials: [
      {
        id: 'film-polyane-parquet', name: 'Film polyane (barrière humidité)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
      },
      {
        id: 'sous-couche-acoustique-parquet', name: 'Sous-couche acoustique mousse PE 3 mm',
        category: 'isolant', phase: 'preparation', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
      {
        id: 'lame-stratifie', name: 'Lames stratifié (Quick-Step / Tarkett / Egger)',
        category: 'bois', phase: 'principal', quantityPerBase: 1.08, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.08, wasteReason: 'Coupes (pose droite)',
        dtu: 'NF DTU 51.11',
        manufacturerRef: 'Quick-Step / Tarkett / Egger',
      },
      {
        id: 'cale-dilatation-parquet', name: 'Cales dilatation périphériques',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'perimeter',
        wasteFactor: 1.00, wasteReason: 'Réutilisables',
      },
      {
        id: 'nez-seuil-alu', name: 'Nez de seuil alu (jonctions pièces)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #14.6 PLINTHES
  // ══════════════════════════════════════════════════════════
  {
    id: 'plinthe-bois-mdf',
    name: 'Plinthes bois ou MDF (périmètre pièce)',
    description: 'Plinthes assorties parquet. Pose collée + clouée. Hauteur 6-10 cm.',
    trade: 'menuiserie_int',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF DTU 36.2 (Novembre 2019)', title: 'Menuiseries intérieures' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Plinthes bois ou MDF assorties (hauteur 6-10 cm)',
      'Fixation : colle + clous tête perdue',
      'Angles intérieurs et extérieurs pré-découpés OU coupe sur chantier à 45°',
    ],
    materials: [
      {
        id: 'plinthe-bois', name: 'Plinthes bois / MDF',
        category: 'bois', phase: 'principal', quantityPerBase: 1.10, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes angles',
      },
      {
        id: 'colle-plinthe', name: 'Colle polymère (fixation)',
        category: 'colle', phase: 'accessoires', quantityPerBase: 0.03, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purge cartouche',
      },
      {
        id: 'clou-plinthe', name: 'Clous tête perdue',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'angle-plinthe', name: 'Angles pré-découpés intérieur/extérieur',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: '~1 angle tous 5 ml moyen.',
      },
    ],
  },
]
