import type { Recipe } from '../../types'

/**
 * VOIRIE & CIRCULATIONS EXTÉRIEURES — audit #24
 *
 * Référentiels FR :
 * - NF DTU 13.3    Dallages (si dallage extérieur)
 * - NF P98-331     Tranchées
 * - NF EN 13242    Granulats
 * - Fascicule 25   (CCTG) — chaussées enrobé
 */

export const voirieExterieureRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #24.1 ENROBÉ À CHAUD (cour/allée)
  // ══════════════════════════════════════════════════════════
  {
    id: 'voirie-enrobe-chaud',
    name: 'Enrobé à chaud BBSG 0/10 (cour/allée)',
    description: 'Forme grave + enrobé BBSG 6-8 cm. Compactage par rouleau obligatoire. Géotextile si sol argileux.',
    trade: 'vrd',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'Fascicule 25 (CCTG)', title: 'Chaussées enrobé' },
      { code: 'NF EN 13242+A1 (Mars 2008)', title: 'Granulats' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Forme de fondation grave 0/31,5 compactée 20 cm',
      'Géotextile sous forme si sol argileux / nappe haute',
      'BBSG 0/10 (Béton Bitumineux Semi-Grenu) épaisseur 6-8 cm',
      'Densité enrobé 2,4 t/m³',
      'Compactage par rouleau vibrant',
      'Fourni par centrale enrobé — camion 10-20 t',
    ],
    materials: [
      {
        id: 'grave-forme-0-315', name: 'Grave 0/31,5 (forme fondation 20 cm)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.20, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Compactage',
      },
      {
        id: 'geotextile-voirie', name: 'Géotextile (si sol argileux)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
        optional: true,
        condition: 'Si sol argileux ou nappe haute',
      },
      {
        id: 'enrobe-bbsg-0-10', name: 'Enrobé BBSG 0/10 (6 cm épaisseur)',
        category: 'liant', phase: 'principal', quantityPerBase: 144, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Pertes coulage',
        manufacturerRef: 'Colas / Eurovia / Eiffage',
        notes: '0,06 m³/m² × 2 400 kg/m³ = 144 kg/m².',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #24.2 PAVÉS AUTOBLOQUANTS
  // ══════════════════════════════════════════════════════════
  {
    id: 'voirie-paves-autobloquants',
    name: 'Pavés autobloquants béton 20×10×6',
    description: 'Pavés autobloquants sur lit de sable + fondation grave. Joints sable polymère.',
    trade: 'vrd',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF EN 1338/AC (Mars 2009)', title: 'Pavés béton' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Forme grave 0/31,5 compactée 15 cm',
      'Lit de sable 0/4 concassé 3-5 cm',
      'Pavés 20×10×6 format courant (50 pavés/m²)',
      'Joints sable polymère solidification (vs sable classique)',
      'Pertes 5% (coupes rives)',
    ],
    materials: [
      {
        id: 'grave-fondation-paves', name: 'Grave 0/31,5 (fondation 15 cm)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.15, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Compactage',
      },
      {
        id: 'geotextile-paves', name: 'Géotextile (sous forme)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
      },
      {
        id: 'sable-lit-pose-paves', name: 'Sable 0/4 (lit pose 3-5 cm)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.04, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'pave-autobloquant-20-10', name: 'Pavés autobloquants béton 20×10×6',
        category: 'bloc', phase: 'principal', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes rives',
        normRef: 'NF EN 1338',
        manufacturerRef: 'Bradstone / Alkern',
        packaging: { unit: 'u', contentQty: 10, contentUnit: 'm2', label: 'palette 10 m²' },
      },
      {
        id: 'sable-polymere-joints', name: 'Sable polymère (joints)',
        category: 'granulat', phase: 'finitions', quantityPerBase: 5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sur-dosage balayage',
        manufacturerRef: 'Romex / Techniseal',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #24.3 DALLES BÉTON GRAND FORMAT
  // ══════════════════════════════════════════════════════════
  {
    id: 'voirie-dalles-beton',
    name: 'Dalles béton 50×50 (allée / terrasse)',
    description: 'Dalles béton format 50×50 sur fondation grave + lit sable ou mortier maigre.',
    trade: 'vrd',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF EN 1339/AC (Mars 2009)', title: 'Dalles béton' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Format standard 50×50 (4 dalles/m²)',
      'Pose sur sable (allée piéton) OU mortier maigre (plus stable)',
      'Pertes 5% (coupes rives)',
      'Joints sable ou ciment selon usage',
    ],
    materials: [
      {
        id: 'grave-fondation-dalles', name: 'Grave fondation',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.10, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Compactage',
      },
      {
        id: 'sable-lit-dalles', name: 'Sable ou mortier maigre (lit pose)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.03, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'dalle-beton-50-50', name: 'Dalles béton 50×50',
        category: 'plaque', phase: 'principal', quantityPerBase: 4.2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse + coupes',
        normRef: 'NF EN 1339',
      },
      {
        id: 'sable-polymere-joints-dalles', name: 'Sable joints (polymère ou classique)',
        category: 'granulat', phase: 'finitions', quantityPerBase: 3, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sur-dosage',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #24.4 STABILISÉ CALCAIRE
  // ══════════════════════════════════════════════════════════
  {
    id: 'voirie-stabilise-calcaire',
    name: 'Allée stabilisée calcaire blanc 0/6',
    description: 'Fondation grave + couche finition stabilisé calcaire compacté. Arrosage + liant hydraulique optionnel.',
    trade: 'vrd',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF P98-331 (Février 2005)', title: 'Tranchées : ouverture, remblayage, réfection' },
      { code: 'Guide SETRA', title: 'Chaussées à faible trafic — structures types' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Forme grave 0/31,5 compactée 10 cm',
      'Couche finition stabilisé calcaire 0/6 ou 0/10, épaisseur 5-8 cm',
      'Arrosage + compactage par rouleau',
      'Liant hydraulique léger optionnel (renforce stabilité)',
      'Esthétique : blanc lumineux, parking/jardin',
    ],
    materials: [
      {
        id: 'grave-stabilise-fondation', name: 'Grave fondation 0/31,5',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.10, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Compactage',
      },
      {
        id: 'stabilise-calcaire', name: 'Stabilisé calcaire blanc 0/6',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.08, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Compactage',
      },
      {
        id: 'liant-hydraulique-stabilise', name: 'Liant hydraulique léger (stabilisation)',
        category: 'liant', phase: 'accessoires', quantityPerBase: 5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sur-dosage',
        optional: true,
        condition: 'Pour renforcer stabilité (passage véhicule léger)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #24.5 BORDURES BÉTON
  // ══════════════════════════════════════════════════════════
  {
    id: 'voirie-bordure-t2',
    name: 'Bordures béton T2 (au ml)',
    description: 'Bordures béton type T2 (ou CS1, A2) scellées sur massif béton. Délimitation chaussée/trottoir.',
    trade: 'vrd',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF EN 1340/AC (Mars 2009)', title: 'Bordures béton' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Bordures T2 ou CS1 (format courant habitation)',
      'Scellement sur massif béton 30×15 cm',
      'Béton C20/25 dosé 250 kg/m³',
      'Joints sable ciment entre bordures',
    ],
    materials: [
      {
        id: 'bordure-t2', name: 'Bordures béton T2 (ou CS1 / A2)',
        category: 'bloc', phase: 'principal', quantityPerBase: 1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        normRef: 'NF EN 1340',
        manufacturerRef: 'Alkern / Bonna Sabla',
      },
      {
        id: 'beton-scellement-bordure', name: 'Béton scellement (C20/25 massif 30×15 cm)',
        category: 'liant', phase: 'principal', quantityPerBase: 0.05, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coulage',
      },
      {
        id: 'mortier-joint-bordure', name: 'Mortier joint (entre bordures)',
        category: 'liant', phase: 'accessoires', quantityPerBase: 1, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sur-dosage',
      },
    ],
  },
]
