import { Recipe } from '../types';

/**
 * ============================================================
 *  PEINTURE — v2 AUDITÉE
 *  
 *  Source : DTU 59.1 + fiches Tollens, Seigneurie, Zolpan.
 *  Pertes pistolet : gérées via chantierProfile.isPistoletPainting.
 * ============================================================
 */

export const peintureRecipes: Recipe[] = [
  // ══════════════════════════════════════════════════════════
  //  MURS INTÉRIEURS NEUF (cycle complet)
  // ══════════════════════════════════════════════════════════

  {
    id: 'peinture-murs-neuf-acryl',
    name: 'Peinture acrylique murs intérieurs NEUF — impression + 2 couches finition',
    description: 'Cycle complet sur Placo neuf : classe C DTU 59.1. Rendements validés fiches Tollens/Seigneurie.',
    trade: 'peinture',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [
      { code: 'DTU 59.1', title: 'Travaux de peinture des bâtiments', section: 'Classe C - travaux courants' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Support Placo neuf (classe C DTU 59.1)',
      'Cycle : enduit de rebouchage ponctuel + impression + 2 couches finition',
      'Ponçage inter-couches léger (grain 180) — papier de verre inclus',
      'Application au rouleau (pistolet : +10% via profil chantier)',
      'Protection sol bâche + adhésif de masquage incluse',
      'Ouvertures déduites (surface nette) — portes/fenêtres à renseigner',
    ],
    materials: [
      // ═══════════ PRÉPARATION ═══════════
      {
        id: 'enduit-rebouchage', name: 'Enduit de rebouchage (reprises, clous, fissures)',
        category: 'enduit', phase: 'preparation', quantityPerBase: 0.05, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Reprises ponctuelles, résidus',
        dtu: 'DTU 59.1 § 5.3 - travaux préparatoires',
        packaging: { unit: 'pot', contentQty: 1.5, contentUnit: 'kg', label: 'pot 1,5 kg' },
      },
      {
        id: 'papier-verre-180', name: 'Papier de verre grain 180 (ponçage inter-couches)',
        category: 'accessoire', phase: 'preparation', quantityPerBase: 0.1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: '1 feuille pour 10 m²',
        packaging: { unit: 'u', contentQty: 10, contentUnit: 'u', label: 'paquet 10 feuilles' },
      },
      {
        id: 'adhesif-masquage', name: 'Adhésif de masquage 30 mm',
        category: 'accessoire', phase: 'preparation', quantityPerBase: 0.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Chutes courtes, réutilisation limitée',
        packaging: { unit: 'rouleau', contentQty: 50, contentUnit: 'ml', label: 'rouleau 50 m' },
      },
      {
        id: 'bache-protection-sol', name: 'Bâche polyane protection sol',
        category: 'accessoire', phase: 'preparation', quantityPerBase: 0.3, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Découpes',
        notes: 'Protection zones projections + mobilier.',
      },
      {
        id: 'sous-couche-placo', name: 'Sous-couche / impression pour Placo',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.10, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac + trempage rouleau',
        dtu: 'DTU 59.1', manufacturerRef: 'Tollens Tolleplus / Seigneurie — 10 m²/L',
        packaging: { unit: 'pot', contentQty: 10, contentUnit: 'L', label: 'bidon 10 L' },
        notes: 'Base : 1 couche × 10 m²/L = 0,10 L/m².',
      },
      // ═══════════ PRINCIPAL ═══════════
      {
        id: 'peinture-murale-acryl', name: 'Peinture acrylique murale (finition mate/velours)',
        category: 'peinture', phase: 'principal', quantityPerBase: 0.18, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac + projections rouleau (DTU 59.1)',
        dtu: 'DTU 59.1', manufacturerRef: 'Tollens/Seigneurie/Zolpan — 11 m²/L/couche',
        packaging: { unit: 'pot', contentQty: 10, contentUnit: 'L', label: 'bidon 10 L' },
        notes: 'Base : 2 couches × 0,091 L/m² = 0,18 L/m². Pistolet : +10% via profil.',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  MURS INTÉRIEURS ENTRETIEN (rafraîchissement)
  // ══════════════════════════════════════════════════════════

  {
    id: 'peinture-murs-entretien',
    name: 'Peinture acrylique murs — ENTRETIEN (2 couches sur existant)',
    description: 'Rafraîchissement sur support peint non dégradé. Sans sous-couche.',
    trade: 'peinture',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [{ code: 'DTU 59.1', title: 'Travaux de peinture - entretien' }],
    version: '2.0.0',
    materials: [
      {
        id: 'peinture-murale-acryl', name: 'Peinture acrylique murale',
        category: 'peinture', quantityPerBase: 0.18, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac + projections',
        dtu: 'DTU 59.1', manufacturerRef: 'Tollens — 11 m²/L/couche',
        packaging: { unit: 'pot', contentQty: 10, contentUnit: 'L', label: 'bidon 10 L' },
      },
      {
        id: 'enduit-lissage', name: 'Enduit de lissage',
        category: 'enduit', quantityPerBase: 0.3, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Sur-dosage, résidus',
        dtu: 'DTU 59.1 - finition classe B/C',
        packaging: { unit: 'sac', contentQty: 15, contentUnit: 'kg', label: 'sac 15 kg' },
      },
      {
        id: 'abrasif-ponce-180', name: 'Abrasif grain 120-180 (feuilles)',
        category: 'outillage', quantityPerBase: 0.15, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Usure, casse',
        dtu: 'DTU 59.1 § 5.3', notes: 'Ponçage entre couches.',
      },
      {
        id: 'adhesif-masquage', name: 'Adhésif masquage',
        category: 'accessoire', quantityPerBase: 0.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Chutes',
        packaging: { unit: 'rouleau', contentQty: 50, contentUnit: 'ml', label: 'rouleau 50 m' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  PLAFOND
  // ══════════════════════════════════════════════════════════

  {
    id: 'peinture-plafond-mat',
    name: 'Peinture plafond mat NEUF — impression + 2 couches',
    description: 'Peinture mate spéciale plafond, cycle sur Placo. Pertes majorées : projection verticale.',
    trade: 'peinture',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [{ code: 'DTU 59.1', title: 'Travaux de peinture - plafonds' }],
    version: '2.0.0',
    materials: [
      {
        id: 'sous-couche-placo', name: 'Impression Placo',
        category: 'primaire', quantityPerBase: 0.10, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac + trempage', dtu: 'DTU 59.1',
        packaging: { unit: 'pot', contentQty: 10, contentUnit: 'L', label: 'bidon 10 L' },
      },
      {
        id: 'peinture-plafond-mat', name: 'Peinture mate spéciale plafond (opacité renforcée)',
        category: 'peinture', quantityPerBase: 0.20, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Projections verticales plus importantes',
        dtu: 'DTU 59.1', manufacturerRef: 'Zolpan Plafocouverte - 10 m²/L',
        packaging: { unit: 'pot', contentQty: 10, contentUnit: 'L', label: 'bidon 10 L' },
      },
      {
        id: 'bache-protection-sol', name: 'Bâche protection sol',
        category: 'accessoire', quantityPerBase: 1.0, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Découpes',
        notes: 'Protection complète sol obligatoire (projections verticales).',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  LAQUE BOISERIES
  // ══════════════════════════════════════════════════════════

  {
    id: 'laque-boiseries-glycero',
    name: 'Laque glycéro boiseries — sous-couche + 2 couches',
    description: 'Portes, plinthes, huisseries. Cycle traditionnel glycéro, finition satinée.',
    trade: 'peinture',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [{ code: 'DTU 59.1', title: 'Peinture - travaux sur bois' }],
    version: '2.0.0',
    materials: [
      {
        id: 'sous-couche-glycero', name: 'Sous-couche glycéro bois',
        category: 'primaire', quantityPerBase: 0.08, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac + pinceau',
        dtu: 'DTU 59.1', manufacturerRef: 'V33/Dulux - 13 m²/L sur bois',
        packaging: { unit: 'pot', contentQty: 2.5, contentUnit: 'L', label: 'pot 2,5 L' },
      },
      {
        id: 'laque-glycero-satinee', name: 'Laque glycéro satinée',
        category: 'peinture', quantityPerBase: 0.15, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac + pinceau',
        dtu: 'DTU 59.1', manufacturerRef: 'V33/Syntilor - 13 m²/L/couche × 2',
        packaging: { unit: 'pot', contentQty: 2.5, contentUnit: 'L', label: 'pot 2,5 L' },
      },
      {
        id: 'white-spirit', name: 'White spirit (nettoyage outils)',
        category: 'accessoire', quantityPerBase: 0.02, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Consommation pratique',
        packaging: { unit: 'pot', contentQty: 1, contentUnit: 'L', label: 'bidon 1 L' },
      },
      {
        id: 'abrasif-ponce-240', name: 'Abrasif grain 180-240',
        category: 'outillage', quantityPerBase: 0.2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.20, wasteReason: 'Usure',
        dtu: 'DTU 59.1', notes: 'Égrenage entre couches.',
      },
    ],
  },
];
