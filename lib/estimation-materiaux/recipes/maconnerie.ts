import { Recipe } from '../types';

/**
 * ============================================================
 *  MAÇONNERIE / GROS ŒUVRE — v2 AUDITÉE
 *  
 *  Corrections apportées depuis v1 :
 *  - Composition béton alignée sur Lafarge (sable 0.48 m³)
 *  - Dalle armée SÉPARÉE en 2 recettes : m² (avec thickness param)
 *  - Mur parpaing : ciment corrigé (8 kg/m²), chaux + béton chaînage ajoutés
 *  - Toutes les pertes justifiées avec référence DTU ou fabricant
 * ============================================================
 */

export const maconnerieRecipes: Recipe[] = [
  // ══════════════════════════════════════════════════════════
  //  BÉTONS — baseUnit = m³
  // ══════════════════════════════════════════════════════════

  {
    id: 'beton-c25-350',
    name: 'Béton C25/30 dosé à 350 kg/m³ (béton armé courant)',
    description: 'Béton de référence pour dalles, poteaux, poutres et fondations armées. Composition type Lafarge.',
    trade: 'maconnerie',
    baseUnit: 'm3',
    geometryMode: 'volume',
    dtuReferences: [
      { code: 'NF EN 206', title: 'Béton : spécification, performance, production, conformité' },
      { code: 'DTU 21', title: 'Exécution des ouvrages en béton', section: '§ 6' },
    ],
    version: '2.1.0',
    constraints: {
      minThickness: 0.04,
      note: 'Pour dalles > 40 m², joints de dilatation obligatoires (DTU 13.3).',
    },
    hypothesesACommuniquer: [
      'Béton dosé 350 kg/m³ (armé courant) — passer à 400 kg/m³ si milieu agressif',
      'Composition type Lafarge : 500 L sable 0/4 + 700 L gravier 4/20 + 175 L eau',
      'Hors armatures, cales, joints et cure — à ajouter selon l\'ouvrage',
    ],
    materials: [
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II/B 32,5 R',
        category: 'liant', phase: 'principal', quantityPerBase: 350, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Résidus sacs, humidité stockage (DTU 21)',
        normRef: 'NF EN 197-1', manufacturerRef: 'Lafarge/Vicat — béton 350 kg/m³',
        dtu: 'DTU 21 § 6.2',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac de 35 kg' },
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4 (rivière ou concassé lavé)',
        category: 'granulat', quantityPerBase: 0.50, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention, bennage, humidité (10% standard DTU 21)',
        manufacturerRef: 'Lafarge Le Classic® — 500 L/m³ béton (consensus calculis.net)',
        dtu: 'DTU 21 § 6.3',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20',
        category: 'granulat', quantityPerBase: 0.70, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention et bennage (10% standard)',
        manufacturerRef: 'Lafarge Le Classic® — 700 L/m³ béton',
        dtu: 'DTU 21 § 6.3',
      },
      {
        id: 'eau-beton', name: 'Eau de gâchage',
        category: 'eau', quantityPerBase: 175, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage exact, aucune perte',
        normRef: 'NF EN 1008', dtu: 'DTU 21 § 5.4',
        notes: 'Rapport E/C = 0,50 — conforme XC1 (NF EN 206 tableau F.1).',
      },
    ],
  },

  {
    id: 'beton-c20-300',
    name: 'Béton C20/25 dosé à 300 kg/m³ (béton non armé / propreté)',
    description: 'Béton de propreté, formes de pente, massifs non structurels.',
    trade: 'maconnerie',
    baseUnit: 'm3',
    geometryMode: 'volume',
    dtuReferences: [
      { code: 'NF EN 206', title: 'Béton : spécification' },
      { code: 'DTU 13.11', title: 'Fondations superficielles' },
    ],
    version: '2.0.0',
    materials: [
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II/B 32,5 R',
        category: 'liant', quantityPerBase: 300, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Résidus sacs (DTU 13.11)',
        dtu: 'DTU 13.11 § 4', packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4',
        category: 'granulat', quantityPerBase: 0.50, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention (10%)',
        dtu: 'DTU 13.11',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20',
        category: 'granulat', quantityPerBase: 0.72, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention (10%)',
        dtu: 'DTU 13.11',
      },
      {
        id: 'eau-beton', name: 'Eau',
        category: 'eau', quantityPerBase: 180, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage exact',
        normRef: 'NF EN 1008',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  DALLE ARMÉE — baseUnit = m² avec thickness paramétrique
  //  CORRIGE le bug v1 (treillis faussement calculé en m³)
  // ══════════════════════════════════════════════════════════

  {
    id: 'dalle-ba-armee-st25c',
    name: 'Dalle béton armée ST25C (habitation / charges courantes)',
    description: 'Dalle sur terre-plein, charges habitation. Béton 350 + treillis ST25C haut. Épaisseur paramétrique.',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'DTU 13.3', title: 'Dallages', section: 'Partie 1 (maisons individuelles) / Partie 2 (autres bâtiments)' },
      { code: 'DTU 21', title: 'Exécution des ouvrages en béton' },
      { code: 'NF A 35-080-1', title: 'Aciers pour béton armé - Treillis soudés' },
    ],
    version: '2.1.0',
    constraints: {
      minThickness: 0.08, maxThickness: 0.20,
      note: 'Épaisseur min 8 cm (DTU 13.3) pour dalle armée. Au-delà de 20 cm, passer à double nappe.',
    },
    hypothesesACommuniquer: [
      'Hérisson de 20 cm en concassé 20/40 supposé (à adapter selon portance du sol)',
      'Géotextile 200 g/m² sous hérisson (anti-remontée fines)',
      'Fibre polypropylène 0,9 kg/m³ incluse (anti-fissuration retrait plastique NF DTU 13.3 §5.4.3)',
      'Joints de retrait sciés prévus tous les 25 m² maxi (obligatoire DTU 13.3 § 6.3)',
      'Bande résiliente périphérique 5 mm verticale contre mur + joint dilatation horizontal',
      'Film polyane sous dalle sur terre-plein (non pertinent pour dalle intermédiaire)',
      'Cure du béton par produit pulvérisé (obligatoire DTU 21 § 8 par temps chaud/vent)',
      'Isolant sous dalle NON inclus par défaut — à ajouter pour RE2020 ou local chauffé',
      'Durcisseur quartz NON inclus par défaut — à ajouter si usage intensif (atelier/garage pro)',
    ],
    materials: [
      // ═══════════ PRÉPARATION ═══════════
      {
        id: 'geotextile-200', name: 'Géotextile 200 g/m² (anti-contamination)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements 30 cm + chutes',
        dtu: 'DTU 13.3 § 5.1',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'm2', label: 'rouleau 50×2m (100 m²)' },
      },
      {
        id: 'herisson-20-40', name: 'Hérisson concassé 20/40 (épaisseur 20 cm compactée)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.20, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Compactage + calage (8 à 12%)',
        dtu: 'DTU 13.3 § 5.2',
      },
      {
        id: 'sable-compactage-0-4', name: 'Sable de compactage 0/4 (lit d\'assise 5 cm)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.05, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Compactage + bennage',
        dtu: 'DTU 13.3 § 5.2',
      },
      {
        id: 'film-polyane-200', name: 'Film polyane 200 μm (barrière sol)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Recouvrements 20 cm + remontées en rives (DTU 13.3)',
        dtu: 'DTU 13.3 § 5.1.4',
        packaging: { unit: 'rouleau', contentQty: 150, contentUnit: 'm2', label: 'rouleau 25×6m (150 m²)' },
        notes: 'À inclure pour dalle sur terre-plein. Non pertinent pour dalle intermédiaire.',
      },
      // ═══════════ PRINCIPAL (béton + armature) ═══════════
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II/B 32,5 R (béton 350 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 350, unit: 'kg',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.03, wasteReason: 'Résidus sacs, humidité',
        dtu: 'DTU 21 § 6.2', normRef: 'NF EN 206', manufacturerRef: 'Lafarge',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac de 35 kg' },
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.50, unit: 'm3',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.10, wasteReason: 'Manutention, bennage (10%)',
        dtu: 'DTU 21',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.70, unit: 'm3',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.10, wasteReason: 'Manutention, bennage (10%)',
        dtu: 'DTU 21',
      },
      {
        id: 'eau-beton', name: 'Eau de gâchage',
        category: 'eau', phase: 'principal', quantityPerBase: 175, unit: 'L',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.00, wasteReason: 'Dosage exact (E/C = 0,50)',
        normRef: 'NF EN 1008',
      },
      {
        id: 'treillis-st25c', name: 'Treillis soudé ST25C (Ø7 maille 150×150, panneau 6×2,4m)',
        category: 'acier', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Recouvrement 2 mailles (300 mm) + chutes (ADETS)',
        dtu: 'DTU 13.3 § 5.3', normRef: 'NF A 35-080-1', manufacturerRef: 'ADETS',
        packaging: { unit: 'panneau', contentQty: 14.4, contentUnit: 'm2', label: 'panneau 6×2,4m (14,4 m²)' },
        notes: 'Usage courant habitation. Pour garage/circulation lourde : passer à ST40C.',
      },
      // ═══════════ ACCESSOIRES ═══════════
      {
        id: 'cales-beton-30', name: 'Cales d\'enrobage 30 mm (distanciers)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse, perte chantier',
        dtu: 'DTU 21 § 7.2 - enrobage mini 3 cm', notes: '4 cales/m² — espacement max 50 cm selon DTU.',
      },
      {
        id: 'joint-dilatation-peripherique', name: 'Joint de dilatation périphérique (mousse PE 10 mm)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Chutes rives, angles',
        dtu: 'DTU 13.3 § 6.2',
        notes: 'Désolidarisation mur/dalle - périmètre complet obligatoire',
      },
      {
        id: 'joint-retrait-scie', name: 'Joint de retrait scié (cordon + mastic PU)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.4, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sciage précis — pas de perte',
        dtu: 'DTU 13.3 § 6.3',
        notes: '1 ligne par tranche de 25 m² maxi (obligatoire dallage >25 m²).',
      },
      {
        id: 'produit-cure-beton', name: 'Produit de cure pulvérisé (anti-évaporation)',
        category: 'adjuvant', phase: 'accessoires', quantityPerBase: 0.2, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sur-dosage pratique au pulvérisateur',
        dtu: 'DTU 21 § 8', manufacturerRef: 'Sika Antisol / Weber Cure',
        packaging: { unit: 'u', contentQty: 25, contentUnit: 'L', label: 'bidon 25 L' },
      },
      // ═══════════ OPTIONS (conditionnelles) ═══════════
      {
        id: 'isolant-xps-sous-dalle', name: 'Isolant XPS 60 mm sous dalle',
        category: 'isolant', phase: 'preparation', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes rives',
        dtu: 'DTU 13.3',
        packaging: { unit: 'panneau', contentQty: 6, contentUnit: 'm2', label: 'panneau 1,25×2,5m (6 m²)' },
        optional: true,
        condition: 'Si dalle sur local chauffé ou conformité RE2020',
      },
      {
        id: 'hydrofuge-masse-beton', name: 'Hydrofuge de masse (adjuvant béton)',
        category: 'adjuvant', phase: 'principal', quantityPerBase: 3.5, unit: 'kg',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.00, wasteReason: 'Dosage exact (1% du poids ciment)',
        manufacturerRef: 'Sika 1 / Weber Sysfuge',
        optional: true,
        condition: 'Si zone humide, garage semi-enterré ou local sanitaire',
      },
      // ═══════════ AJOUTS AUDIT #03.1 (avril 2026) ═══════════
      {
        id: 'fibre-polypro-pp', name: 'Fibre polypropylène anti-fissuration (L = 12 mm)',
        category: 'adjuvant', phase: 'principal',
        quantityPerBase: 0.9, unit: 'kg',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.05, wasteReason: 'Sur-dosage sachet',
        dtu: 'NF DTU 13.3 §5.4.3', normRef: 'NF EN 14889-2',
        manufacturerRef: 'Sika Fiber PPM-12 / Chryso Fibrin',
        packaging: { unit: 'sac', contentQty: 0.9, contentUnit: 'kg', label: 'sachet 900 g (dose 1 m³)' },
        notes: 'Anti-fissuration retrait plastique — dosage 0,9 kg/m³ béton.',
      },
      {
        id: 'bande-resiliente-peripherique', name: 'Bande résiliente périphérique 5 mm (désolidarisation mur)',
        category: 'joint', phase: 'accessoires',
        quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Coupes aux angles',
        dtu: 'NF DTU 13.3 §6.2',
        manufacturerRef: 'Sika Swell / Weber Sysfloor bande',
        packaging: { unit: 'rouleau', contentQty: 50, contentUnit: 'ml', label: 'rouleau 50 ml × 15 cm' },
        notes: 'Verticale contre mur — distincte du joint mousse PE horizontal.',
      },
      {
        id: 'durcisseur-surface-quartz', name: 'Durcisseur de surface minéral quartz (saupoudrage)',
        category: 'adjuvant', phase: 'finitions',
        quantityPerBase: 4, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Saupoudrage pratique',
        dtu: 'NF DTU 13.3 §8.2',
        manufacturerRef: 'Sika ChapDur Grey / Weber Quartz',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
        optional: true,
        condition: 'Si local technique, garage professionnel ou atelier (résistance P4S)',
      },
    ],
  },

  {
    id: 'dalle-ba-armee-st40c',
    name: 'Dalle béton armée ST40C (garage / charges lourdes)',
    description: 'Dalle pour circulation véhicules légers. Béton 350 + treillis ST40C renforcé.',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'DTU 13.3', title: 'Dallages — Partie 1', section: 'Maisons individuelles' },
      { code: 'DTU 21', title: 'Exécution béton' },
      { code: 'NF A 35-080-1', title: 'Treillis soudés' },
    ],
    version: '2.1.0',
    constraints: { minThickness: 0.12, maxThickness: 0.25, note: 'Épaisseur min 12 cm pour garage (DTU 13.3 Partie 1-1-1 — usage industriel/circulation).' },
    hypothesesACommuniquer: [
      'Épaisseur minimale 12 cm (vs 8 cm ST25C) — circulation véhicules légers',
      'Treillis ST40C Ø8 (vs Ø7 ST25C) — charges renforcées',
      'Hérisson de 20 cm en concassé 20/40 + géotextile + sable compactage',
      'Fibre polypropylène 0,9 kg/m³ incluse (anti-fissuration)',
      'Joints de retrait tous les 25 m² max (DTU 13.3 §6.3)',
      'Joint de construction si bétonnage en plusieurs passes (> 36 m² typiquement)',
      'Bande résiliente périphérique + joint dilatation horizontal obligatoires',
      'Durcisseur quartz recommandé pour garage professionnel (résistance P4S)',
      'Produit de cure obligatoire (DTU 21 §8)',
    ],
    materials: [
      // ═══════════ PRÉPARATION ═══════════
      {
        id: 'geotextile-200', name: 'Géotextile 200 g/m² (anti-contamination)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements 30 cm + chutes',
        dtu: 'NF DTU 13.3 §5.1',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'm2', label: 'rouleau 50×2m (100 m²)' },
      },
      {
        id: 'herisson-20-40', name: 'Hérisson concassé 20/40 (ép. 20 cm compactée)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.20, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Compactage + calage',
        dtu: 'NF DTU 13.3 §5.2',
      },
      {
        id: 'sable-compactage-0-4', name: 'Sable de compactage 0/4 (lit d\'assise 5 cm)',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.05, unit: 'm3',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Compactage + bennage',
        dtu: 'NF DTU 13.3 §5.2',
      },
      {
        id: 'film-polyane-200', name: 'Film polyane 200 μm (barrière sol)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Recouvrements 20 cm + remontées rives',
        dtu: 'NF DTU 13.3 §5.1.4',
        packaging: { unit: 'rouleau', contentQty: 150, contentUnit: 'm2', label: 'rouleau 25×6m (150 m²)' },
      },
      // ═══════════ PRINCIPAL ═══════════
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II/B 32,5 R (béton 350 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 350, unit: 'kg',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.03, wasteReason: 'Résidus sacs, humidité',
        dtu: 'DTU 21', normRef: 'NF EN 206',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac de 35 kg' },
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.50, unit: 'm3',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.10, wasteReason: 'Manutention',
        dtu: 'DTU 21',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.70, unit: 'm3',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.10, wasteReason: 'Manutention',
        dtu: 'DTU 21',
      },
      {
        id: 'eau-beton', name: 'Eau de gâchage',
        category: 'eau', phase: 'principal', quantityPerBase: 175, unit: 'L',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.00, wasteReason: 'Dosage exact (E/C = 0,50)',
        normRef: 'NF EN 1008',
      },
      {
        id: 'treillis-st40c', name: 'Treillis soudé ST40C (Ø8 maille 150×150, panneau 6×2,4m)',
        category: 'acier', phase: 'principal', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Recouvrement 2 mailles + chutes (ADETS)',
        dtu: 'NF DTU 13.3 § 5.3', normRef: 'NF A 35-080-1', manufacturerRef: 'ADETS',
        packaging: { unit: 'panneau', contentQty: 14.4, contentUnit: 'm2', label: 'panneau ST40C 6×2,4m' },
      },
      {
        id: 'fibre-polypro-pp', name: 'Fibre polypropylène anti-fissuration (L = 12 mm)',
        category: 'adjuvant', phase: 'principal',
        quantityPerBase: 0.9, unit: 'kg',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.05, wasteReason: 'Sur-dosage sachet',
        dtu: 'NF DTU 13.3 §5.4.3', normRef: 'NF EN 14889-2',
        manufacturerRef: 'Sika Fiber PPM-12 / Chryso Fibrin',
        packaging: { unit: 'sac', contentQty: 0.9, contentUnit: 'kg', label: 'sachet 900 g (dose 1 m³)' },
      },
      // ═══════════ ACCESSOIRES ═══════════
      {
        id: 'cales-beton-30', name: 'Cales d\'enrobage 30 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse, perte chantier',
        dtu: 'DTU 21 §7.2',
      },
      {
        id: 'joint-dilatation-peripherique', name: 'Joint de dilatation périphérique (mousse PE 10 mm)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Chutes rives, angles',
        dtu: 'NF DTU 13.3 §6.2',
      },
      {
        id: 'bande-resiliente-peripherique', name: 'Bande résiliente périphérique 5 mm (désolidarisation mur)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Coupes aux angles',
        dtu: 'NF DTU 13.3 §6.2',
        manufacturerRef: 'Sika Swell / Weber Sysfloor bande',
        packaging: { unit: 'rouleau', contentQty: 50, contentUnit: 'ml', label: 'rouleau 50 ml × 15 cm' },
      },
      {
        id: 'joint-retrait-scie', name: 'Joint de retrait scié (cordon + mastic PU)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.4, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sciage précis',
        dtu: 'NF DTU 13.3 §6.3',
      },
      {
        id: 'produit-cure-beton', name: 'Produit de cure pulvérisé',
        category: 'adjuvant', phase: 'accessoires', quantityPerBase: 0.2, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sur-dosage pratique',
        dtu: 'DTU 21 §8', manufacturerRef: 'Sika Antisol / Weber Cure',
        packaging: { unit: 'u', contentQty: 25, contentUnit: 'L', label: 'bidon 25 L' },
      },
      {
        id: 'joint-construction-metal', name: 'Profilé joint de construction métallique (reprise bétonnage)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.15, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes aux raccords',
        dtu: 'NF DTU 13.3 §6.4',
        manufacturerRef: 'Permaban / Betobar',
        optional: true,
        condition: 'Si dalle > 36 m² ou bétonnage en plusieurs passes',
      },
      // ═══════════ FINITIONS / OPTIONS ═══════════
      {
        id: 'durcisseur-surface-quartz', name: 'Durcisseur de surface minéral quartz',
        category: 'adjuvant', phase: 'finitions',
        quantityPerBase: 4, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Saupoudrage pratique',
        dtu: 'NF DTU 13.3 §8.2',
        manufacturerRef: 'Sika ChapDur Grey / Weber Quartz',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
        optional: true,
        condition: 'Si garage professionnel / atelier (résistance P4S)',
      },
      {
        id: 'isolant-xps-sous-dalle', name: 'Isolant XPS 60 mm sous dalle',
        category: 'isolant', phase: 'preparation',
        quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes rives',
        dtu: 'NF DTU 13.3',
        packaging: { unit: 'panneau', contentQty: 6, contentUnit: 'm2', label: 'panneau 1,25×2,5m (6 m²)' },
        optional: true,
        condition: 'Si local chauffé au-dessus ou conformité RE2020',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  MORTIERS
  // ══════════════════════════════════════════════════════════

  {
    id: 'mortier-batard-250-100',
    name: 'Mortier bâtard 250+100 (ciment + chaux) pour hourdage / enduit',
    description: 'Mortier courant pour pose de petits éléments et enduit extérieur.',
    trade: 'maconnerie',
    baseUnit: 'm3',
    geometryMode: 'volume',
    dtuReferences: [
      { code: 'DTU 20.1', title: 'Ouvrages en maçonnerie de petits éléments' },
      { code: 'DTU 26.1', title: 'Enduits aux mortiers de ciments, chaux' },
    ],
    version: '2.0.0',
    materials: [
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II 32,5',
        category: 'liant', quantityPerBase: 250, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Résidus sacs',
        dtu: 'DTU 20.1', packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
      },
      {
        id: 'chaux-nhl-35', name: 'Chaux hydraulique naturelle NHL 3,5',
        category: 'liant', quantityPerBase: 100, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Résidus sacs', normRef: 'NF EN 459-1',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4',
        category: 'granulat', quantityPerBase: 1.1, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention (10%)', dtu: 'DTU 20.1',
      },
      {
        id: 'eau-mortier', name: 'Eau',
        category: 'eau', quantityPerBase: 200, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage consistance', normRef: 'NF EN 1008',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  MUR PARPAINGS — CORRIGÉ : ciment 8 kg/m², béton chaînage
  // ══════════════════════════════════════════════════════════

  {
    id: 'mur-parpaing-20',
    name: 'Mur en parpaings creux 20×20×50 (hourdage mortier + chaînages)',
    description: 'Mur porteur ou de refend, bloc creux B40 NF. Mortier de hourdage et chaînages verticaux inclus.',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [
      { code: 'DTU 20.1', title: 'Ouvrages en maçonnerie de petits éléments', section: '§ 6.4 Chaînages' },
      { code: 'NF EN 771-3', title: 'Spécifications pour éléments de maçonnerie en béton de granulats' },
    ],
    version: '2.0.0',
    constraints: { maxHeight: 2.8, note: 'Au-delà de 2,80 m : chaînages intermédiaires obligatoires (DTU 20.1 § 6.4).' },
    materials: [
      {
        id: 'parpaing-20', name: 'Parpaing creux B40 20×20×50 (bloc NF)',
        category: 'bloc', quantityPerBase: 10, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse transport + coupes en rives',
        dtu: 'DTU 20.1', normRef: 'NF EN 771-3', manufacturerRef: 'Alkern / Bouyer Leroux',
        notes: 'Géométrie 50×20 → 10 blocs/m² exactement.',
      },
      {
        id: 'ciment-cem2-325r', name: 'Ciment (mortier de hourdage)',
        category: 'liant', quantityPerBase: 8, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Résidus + sur-dosage pratique',
        dtu: 'DTU 20.1 § 5', manufacturerRef: 'Mortier ciment 350 kg/m³ × 0,022 m³/m²',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
        notes: 'Base : 0,022 m³ mortier/m² × 350 kg ciment/m³ mortier = 7,7 kg arrondi à 8.',
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4 (pour mortier hourdage)',
        category: 'granulat', quantityPerBase: 0.022, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention', dtu: 'DTU 20.1',
      },
      {
        id: 'acier-ha10-chainage', name: 'Acier HA10 chaînages verticaux (angles + tous les 5m)',
        category: 'acier', quantityPerBase: 0.8, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes coupes + ligatures (DTU 21)',
        dtu: 'DTU 20.1 § 6.4', normRef: 'NF A 35-080',
        notes: '4 HA10 + cadres HA6 tous 15 cm par chaînage. Hypothèse : 1 chaînage/5 m² + angles.',
      },
      {
        id: 'beton-chainage', name: 'Béton chaînage (section 15×15 cm)',
        category: 'liant', quantityPerBase: 0.01, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Perte coulage', dtu: 'DTU 20.1 § 6.4',
        notes: '0,15×0,15 m² × hauteur moyenne / 5 m² ≈ 0,01 m³/m² de mur.',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  BRIQUE MONOMUR
  // ══════════════════════════════════════════════════════════

  {
    id: 'mur-brique-monomur-30',
    name: 'Mur brique monomur terre cuite 30 cm (joints minces)',
    description: 'Brique porteuse monomur Porotherm ou équivalent, pose au mortier-colle joint mince. R ≈ 2,2.',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [
      { code: 'DTU 20.1', title: 'Maçonnerie de petits éléments' },
      { code: 'NF EN 771-1', title: 'Spécifications briques en terre cuite' },
    ],
    version: '2.0.0',
    materials: [
      {
        id: 'brique-monomur-30', name: 'Brique monomur 30 cm (37,3×30×21,4 cm)',
        category: 'brique', quantityPerBase: 12.5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.07, wasteReason: 'Casse transport + coupes',
        dtu: 'DTU 20.1', manufacturerRef: 'Wienerberger Porotherm 30',
        notes: '1 m² = 1/(0,373×0,214) = 12,5 briques.',
      },
      {
        id: 'mortier-joint-mince', name: 'Mortier-colle à joint mince',
        category: 'colle', quantityPerBase: 1.3, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus bac, sur-dosage',
        manufacturerRef: 'Wienerberger Poroplus — 1,3 kg/m²',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  CHAPE — CORRIGÉE avec thickness paramétrique
  // ══════════════════════════════════════════════════════════

  {
    id: 'chape-ciment-tradi',
    name: 'Chape de ciment traditionnelle (épaisseur paramétrique)',
    description: 'Chape maigre, dosage 350 kg/m³. Épaisseur courante 4 à 6 cm.',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'DTU 26.2', title: 'Chapes et dalles à base de liants hydrauliques' },
    ],
    version: '2.0.0',
    constraints: { minThickness: 0.04, maxThickness: 0.08, note: 'Entre 4 et 8 cm (DTU 26.2).' },
    materials: [
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II 32,5 (chape 350 kg/m³)',
        category: 'liant', quantityPerBase: 350, unit: 'kg',
        geometryMultiplier: 'thickness',  // par m² × épaisseur
        wasteFactor: 1.03, wasteReason: 'Résidus sacs',
        dtu: 'DTU 26.2', packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4',
        category: 'granulat', quantityPerBase: 1.1, unit: 'm3',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.10, wasteReason: 'Manutention', dtu: 'DTU 26.2',
      },
      {
        id: 'eau-chape', name: 'Eau',
        category: 'eau', quantityPerBase: 170, unit: 'L',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.00, wasteReason: 'Dosage exact', normRef: 'NF EN 1008',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  CHAPE CIMENT — NF DTU 26.2
  // ══════════════════════════════════════════════════════════

  {
    id: 'chape-ciment-flottante',
    name: 'Chape ciment (flottante ou adhérente)',
    description: 'Chape de ragréage ou chape flottante sur isolant. Mortier CT-C25-F4 dosé 300 kg/m³.',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 26.2', title: 'Chapes et dalles à base de liants hydrauliques', section: 'rev. 2021' },
      { code: 'NF EN 13813', title: 'Matériaux de chape' },
      { code: 'NF EN 1008', title: 'Eau de gâchage' },
    ],
    version: '2.1.0',
    constraints: {
      minThickness: 0.04, maxThickness: 0.10,
      note: 'Épaisseur 4-10 cm selon type (adhérente / désolidarisée / flottante).',
    },
    hypothesesACommuniquer: [
      'Mortier chape CT-C25-F4 dosé 300 kg/m³ (ciment CEM II)',
      'Épaisseur 5 cm hypothèse par défaut (à adapter)',
      'Joint périphérique mousse PE 5 mm obligatoire (DTU 26.2 §8.1)',
      'Joint de fractionnement si flottante > 40 m² (DTU 26.2 §8.2)',
      'Cure recommandée (humidification 48h ou produit de cure)',
      'Primaire d\'accrochage obligatoire si chape adhérente (DTU 26.2 §7.2)',
      'Isolant acoustique/thermique NON inclus par défaut — à ajouter si chape flottante',
    ],
    materials: [
      // ═══════════ PRÉPARATION ═══════════
      {
        id: 'primaire-accrochage-chape', name: 'Primaire d\'accrochage chape',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac + résidus',
        dtu: 'NF DTU 26.2 §7.2',
        manufacturerRef: 'Weber Prim',
        packaging: { unit: 'pot', contentQty: 5, contentUnit: 'kg', label: 'bidon 5 kg' },
        optional: true,
        condition: 'Si chape adhérente sur support béton',
      },
      {
        id: 'film-polyane-150', name: 'Film polyane 150 μm (chape désolidarisée)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
        dtu: 'NF DTU 26.2 §5.2.2',
        packaging: { unit: 'rouleau', contentQty: 150, contentUnit: 'm2', label: 'rouleau 25×6m' },
        optional: true,
        condition: 'Si chape désolidarisée ou flottante',
      },
      // ═══════════ PRINCIPAL ═══════════
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II/B 32,5 R (chape 300 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 300, unit: 'kg',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.03, wasteReason: 'Résidus sacs',
        dtu: 'NF DTU 26.2', normRef: 'NF EN 197-1',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.5, unit: 'm3',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'eau-beton', name: 'Eau de gâchage',
        category: 'eau', phase: 'principal', quantityPerBase: 135, unit: 'L',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.00, wasteReason: 'Dosage E/C = 0,45',
        normRef: 'NF EN 1008',
      },
      // ═══════════ ACCESSOIRES ═══════════
      {
        id: 'joint-peripherique-chape', name: 'Joint périphérique mousse PE 5 mm × 80 mm',
        category: 'joint', phase: 'accessoires', quantityPerBase: 1, unit: 'ml',
        geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Coupes angles',
        dtu: 'NF DTU 26.2 §8.1',
        packaging: { unit: 'rouleau', contentQty: 50, contentUnit: 'ml', label: 'rouleau 50 ml' },
      },
      {
        id: 'joint-fractionnement-chape', name: 'Joint de fractionnement (cordon + mastic PU)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.025, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Sciage précis',
        dtu: 'NF DTU 26.2 §8.2',
        notes: '1 joint par tranche de 40 m² si chape flottante.',
        optional: true,
        condition: 'Si surface chape flottante > 40 m²',
      },
      // ═══════════ FINITIONS ═══════════
      {
        id: 'produit-cure-beton', name: 'Produit de cure pulvérisé',
        category: 'adjuvant', phase: 'finitions', quantityPerBase: 0.15, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sur-dosage pulvérisation',
        dtu: 'NF DTU 26.2 §9',
        packaging: { unit: 'u', contentQty: 25, contentUnit: 'L', label: 'bidon 25 L' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  RAGRÉAGE AUTOLISSANT — NF DTU 52.2 §6.2 / NF DTU 53.2
  // ══════════════════════════════════════════════════════════

  {
    id: 'ragreage-autolissant-p3',
    name: 'Ragréage autolissant fibré P3 (3 mm moyenne)',
    description: 'Ragréage sol intérieur pour planéité avant revêtement (carrelage, PVC, parquet).',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 52.2', title: 'Pose collée revêtements céramiques', section: '§6.2 ragréage' },
      { code: 'NF DTU 53.2', title: 'Revêtements PVC — préparation support' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Épaisseur moyenne 3 mm supposée (adapter si support très irrégulier)',
      'Classement P3 minimum pour sol habitation',
      'Primaire d\'accrochage obligatoire avant ragréage',
      'Eau de gâchage 20% du poids de poudre',
      'Délai de recouvrement 24h avant revêtement',
    ],
    materials: [
      {
        id: 'primaire-regulateur-ragreage', name: 'Primaire régulateur d\'absorption',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac + résidus',
        manufacturerRef: 'Weber Prim / Mapei Eco Prim Grip',
        packaging: { unit: 'pot', contentQty: 5, contentUnit: 'kg', label: 'bidon 5 kg' },
      },
      {
        id: 'ragreage-autolissant-fibre', name: 'Ragréage autolissant fibré P3 (Weber Niv Lex)',
        category: 'enduit', phase: 'principal', quantityPerBase: 5, unit: 'kg',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Résidus bac + sur-dosage',
        manufacturerRef: 'Weber Niv Lex / Mapei Ultraplan Eco',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'eau-ragreage', name: 'Eau de gâchage ragréage',
        category: 'eau', phase: 'principal', quantityPerBase: 0.6, unit: 'L',
        geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage précis (≈ 20% poids poudre)',
        normRef: 'NF EN 1008',
      },
    ],
  },
];
