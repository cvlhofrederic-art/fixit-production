import { Recipe } from '../../types';

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
      { code: 'NF EN 206+A2/CN (Avril 2021)', title: 'Béton : spécification, performance, production, conformité' },
      { code: 'NF DTU 21 (Mars 2017)', title: 'Exécution des ouvrages en béton', section: '§ 6' },
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
      { code: 'NF EN 206+A2/CN (Avril 2021)', title: 'Béton : spécification' },
      { code: 'NF DTU 13.11 (Juin 1988, historique)', title: 'Fondations superficielles' },
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
      { code: 'NF DTU 13.3 P1-1-2 (Décembre 2021)', title: 'Dallages', section: 'Partie 1 (maisons individuelles) / Partie 2 (autres bâtiments)' },
      { code: 'NF DTU 21 (Mars 2017)', title: 'Exécution des ouvrages en béton' },
      { code: 'NF A 35-080-1 (Janvier 2013)', title: 'Aciers pour béton armé - Treillis soudés' },
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
      { code: 'NF DTU 13.3 P1-1-2 (Décembre 2021)', title: 'Dallages — Partie 1', section: 'Maisons individuelles' },
      { code: 'NF DTU 21 (Mars 2017)', title: 'Exécution béton' },
      { code: 'NF A 35-080-1 (Janvier 2013)', title: 'Treillis soudés' },
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
      { code: 'NF DTU 20.1 P1-1 (Octobre 2008 + A1 2020)', title: 'Ouvrages en maçonnerie de petits éléments' },
      { code: 'NF DTU 26.1 (Avril 2008)', title: 'Enduits aux mortiers de ciments, chaux' },
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
    description: 'Mur porteur ou de refend, bloc creux B40 NF. Arase + mortier + chaînages + linteaux inclus.',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [
      { code: 'NF DTU 20.1 P1-1 (Octobre 2008 + A1 2020)', title: 'Ouvrages en maçonnerie de petits éléments', section: 'rev. juillet 2020' },
      { code: 'NF EN 771-3+A1 (Octobre 2015)', title: 'Spécifications éléments maçonnerie béton granulats' },
      { code: 'NF EN 998-2 (Mai 2017)', title: 'Mortiers de maçonnerie' },
      { code: 'Eurocode 6', title: 'NF EN 1996-1-1 — calcul structures maçonnerie' },
    ],
    version: '2.1.0',
    constraints: { maxHeight: 2.8, note: 'Au-delà de 2,80 m : chaînages intermédiaires obligatoires (DTU 20.1 § 6.4).' },
    hypothesesACommuniquer: [
      'Arase étanche bitumineuse obligatoire en pied de mur (NF DTU 20.1 §5.2.2)',
      'Chaînages verticaux HA10 tous les 5 m + 4 angles (1 chaînage / 5 m²)',
      'Chaînage horizontal haut 2 HA8 filantes (DTU 20.1 §6.4.2)',
      'Cadres HA6 tous 15 cm dans chaînages verticaux',
      'Linteaux préfa estimés à 70 cm/m² d\'ouvertures (ouverture moyenne 1,50 m)',
      'Mortier traditionnel ciment + sable + eau (E/C = 0,55)',
      'Enduit extérieur NON inclus — à ajouter via recette "enduit-ext-multicouche" ou "-monocouche"',
    ],
    materials: [
      // ═══════════ PRÉPARATION ═══════════
      {
        id: 'arase-etanche-bitume', name: 'Arase étanche bitumineuse (barrière capillaire 20 cm)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 0.4, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes aux angles',
        dtu: 'NF DTU 20.1 §5.2.2',
        manufacturerRef: 'Siplast Veral / Icopal',
        packaging: { unit: 'rouleau', contentQty: 10, contentUnit: 'ml', label: 'rouleau 10 m × 20 cm' },
        notes: 'Base : 0,4 ml/m² pour mur hauteur standard 2,50 m (1 ml arase / 2,5 m² mur).',
      },
      // ═══════════ PRINCIPAL ═══════════
      {
        id: 'parpaing-20', name: 'Parpaing creux B40 20×20×50 (bloc NF)',
        category: 'bloc', phase: 'principal', quantityPerBase: 10, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse transport + coupes en rives',
        dtu: 'NF DTU 20.1', normRef: 'NF EN 771-3', manufacturerRef: 'Alkern / Bouyer Leroux',
        notes: 'Géométrie 50×20 → 10 blocs/m² exactement.',
      },
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II 32,5 R (mortier hourdage)',
        category: 'liant', phase: 'principal', quantityPerBase: 8, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Résidus + sur-dosage pratique',
        dtu: 'NF DTU 20.1 § 5', normRef: 'NF EN 197-1',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
        notes: 'Base : 0,022 m³ mortier/m² × 350 kg ciment/m³ = 7,7 kg arrondi à 8.',
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4 (mortier hourdage)',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.022, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention', dtu: 'NF DTU 20.1',
      },
      {
        id: 'eau-mortier', name: 'Eau de gâchage mortier',
        category: 'eau', phase: 'principal', quantityPerBase: 4, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage précis (E/C = 0,55)',
        normRef: 'NF EN 1008',
      },
      {
        id: 'acier-ha10-chainage', name: 'Acier HA10 chaînages verticaux (angles + tous les 5 m)',
        category: 'acier', phase: 'principal', quantityPerBase: 0.8, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes + ligatures (DTU 21)',
        dtu: 'NF DTU 20.1 § 6.4', normRef: 'NF A 35-080',
        notes: '4 HA10 + cadres HA6 tous 15 cm par chaînage. Hypothèse : 1 chaînage/5 m² + 4 angles.',
      },
      {
        id: 'acier-ha6-cadres', name: 'Acier HA6 cadres chaînages (tous les 15 cm)',
        category: 'acier', phase: 'principal', quantityPerBase: 0.25, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes + ligatures',
        dtu: 'NF DTU 20.1 § 6.4', normRef: 'NF A 35-080',
      },
      {
        id: 'acier-ha8-chainage-horiz', name: 'Acier HA8 chaînage horizontal (2 filantes haut)',
        category: 'acier', phase: 'principal', quantityPerBase: 0.6, unit: 'kg', geometryMultiplier: 'height',
        wasteFactor: 1.10, wasteReason: 'Chutes + recouvrements 30 cm',
        dtu: 'NF DTU 20.1 §6.4.2',
        notes: '2 filantes HA8 × longueur mur (géométrie multipliée par hauteur).',
      },
      {
        id: 'beton-chainage', name: 'Béton chaînage (section 15×15 cm, 350 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 0.01, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Perte coulage', dtu: 'NF DTU 20.1 § 6.4',
        notes: '0,15×0,15 m² × hauteur / 5 m² ≈ 0,01 m³/m² de mur.',
      },
      {
        id: 'linteau-prefa-beton', name: 'Linteau préfabriqué béton armé (au-dessus ouvertures)',
        category: 'bloc', phase: 'principal', quantityPerBase: 0.7, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes appuis',
        dtu: 'NF DTU 20.1 §6.6', normRef: 'NF EN 845-2',
        manufacturerRef: 'Alkern / Fabemi',
        notes: 'Estimation 0,7 ml de linteau/m² d\'ouvertures (hypothèse ouverture moyenne 1,50 m).',
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
      { code: 'NF DTU 20.1 P1-1 (Octobre 2008 + A1 2020)', title: 'Maçonnerie de petits éléments', section: 'rev. juillet 2020' },
      { code: 'NF EN 771-1+A1 (Octobre 2015)', title: 'Spécifications briques terre cuite' },
      { code: 'Eurocode 6', title: 'NF EN 1996-1-1' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Briques monomur Porotherm 30 (37,3×30×21,4 cm) — 12,5 briques/m²',
      'Pose au mortier-colle joint mince (1,3 kg/m² — Wienerberger Poroplus)',
      'Arase étanche bitumineuse obligatoire en pied (NF DTU 20.1 §5.2.2)',
      'Chaînages verticaux HA10 tous les 5 m + 4 angles',
      'Chaînage horizontal haut 2 HA8 filantes',
      'Linteau spécial monomur préfa (Wienerberger Porolith) au-dessus ouvertures',
      'Pas d\'enduit extérieur inclus — brique monomur peut rester apparente ou être enduite',
    ],
    materials: [
      // ═══════════ PRÉPARATION ═══════════
      {
        id: 'arase-etanche-bitume', name: 'Arase étanche bitumineuse (barrière capillaire 30 cm)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 0.4, unit: 'ml',
        geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes aux angles',
        dtu: 'NF DTU 20.1 §5.2.2',
        manufacturerRef: 'Siplast Veral / Icopal',
        packaging: { unit: 'rouleau', contentQty: 10, contentUnit: 'ml', label: 'rouleau 10 m × 30 cm' },
      },
      // ═══════════ PRINCIPAL ═══════════
      {
        id: 'brique-monomur-30', name: 'Brique monomur 30 cm (37,3×30×21,4 cm)',
        category: 'brique', phase: 'principal', quantityPerBase: 12.5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.07, wasteReason: 'Casse transport + coupes',
        dtu: 'NF DTU 20.1', normRef: 'NF EN 771-1', manufacturerRef: 'Wienerberger Porotherm 30',
        notes: '1 m² = 1/(0,373×0,214) = 12,5 briques.',
      },
      {
        id: 'mortier-joint-mince', name: 'Mortier-colle à joint mince (Porotherm)',
        category: 'colle', phase: 'principal', quantityPerBase: 1.3, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Résidus bac, sur-dosage',
        manufacturerRef: 'Wienerberger Poroplus — 1,3 kg/m²',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'eau-mortier-joint-mince', name: 'Eau de gâchage mortier-colle',
        category: 'eau', phase: 'principal', quantityPerBase: 0.8, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage précis (20% poids poudre)',
        normRef: 'NF EN 1008',
      },
      {
        id: 'acier-ha10-chainage', name: 'Acier HA10 chaînages verticaux',
        category: 'acier', phase: 'principal', quantityPerBase: 0.8, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes + ligatures',
        dtu: 'NF DTU 20.1 §6.4', normRef: 'NF A 35-080',
      },
      {
        id: 'acier-ha6-cadres', name: 'Acier HA6 cadres chaînages (tous les 15 cm)',
        category: 'acier', phase: 'principal', quantityPerBase: 0.25, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes + ligatures',
        dtu: 'NF DTU 20.1 §6.4',
      },
      {
        id: 'acier-ha8-chainage-horiz', name: 'Acier HA8 chaînage horizontal (2 filantes haut)',
        category: 'acier', phase: 'principal', quantityPerBase: 0.6, unit: 'kg', geometryMultiplier: 'height',
        wasteFactor: 1.10, wasteReason: 'Chutes + recouvrements 30 cm',
        dtu: 'NF DTU 20.1 §6.4.2',
      },
      {
        id: 'beton-chainage', name: 'Béton chaînage (section 15×15 cm)',
        category: 'liant', phase: 'principal', quantityPerBase: 0.01, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Perte coulage',
        dtu: 'NF DTU 20.1 §6.4',
      },
      {
        id: 'linteau-monomur', name: 'Linteau spécial monomur (Porolith / Porotherm)',
        category: 'brique', phase: 'principal', quantityPerBase: 0.7, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes appuis',
        dtu: 'NF DTU 20.1 §6.6',
        manufacturerRef: 'Wienerberger Porolith',
        notes: 'Estimation 0,7 ml de linteau/m² d\'ouvertures.',
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
      { code: 'NF DTU 26.2 (Avril 2013)', title: 'Chapes et dalles à base de liants hydrauliques' },
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
      { code: 'NF DTU 26.2 (Avril 2013)', title: 'Chapes et dalles à base de liants hydrauliques', section: 'rev. 2021' },
      { code: 'NF EN 13813 (Mars 2003)', title: 'Matériaux de chape' },
      { code: 'NF EN 1008 (Juillet 2003)', title: 'Eau de gâchage' },
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
      { code: 'NF DTU 52.2 (Mai 2022)', title: 'Pose collée revêtements céramiques', section: '§6.2 ragréage' },
      { code: 'NF DTU 53.2 (Juillet 2018)', title: 'Revêtements PVC — préparation support' },
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

  // ══════════════════════════════════════════════════════════
  //  MUR BRIQUE TERRE CUITE TRADITIONNELLE — audit #04.3
  // ══════════════════════════════════════════════════════════

  {
    id: 'mur-brique-tc-traditionnelle',
    name: 'Mur brique terre cuite traditionnelle (format 5,5×10,5×22)',
    description: 'Mur porteur ou refend en briques TC pleines/creuses format courant, hourdage mortier classique.',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [
      { code: 'NF DTU 20.1 P1-1 (Octobre 2008 + A1 2020)', title: 'Ouvrages en maçonnerie de petits éléments', section: 'rev. 2020' },
      { code: 'NF EN 771-1+A1 (Octobre 2015)', title: 'Spécifications éléments maçonnerie terre cuite' },
    ],
    version: '2.1.0',
    constraints: { maxHeight: 2.8 },
    hypothesesACommuniquer: [
      'Brique TC format 5,5×10,5×22 cm — 60 briques/m² (1 rang horizontal)',
      'Mortier traditionnel ciment + sable (8 kg ciment/m²)',
      'Arase étanche bitumineuse obligatoire en pied (DTU 20.1 §5.2.2)',
      'Chaînages verticaux + horizontaux (idem mur parpaing)',
      'Enduit extérieur à prévoir séparément',
    ],
    materials: [
      {
        id: 'arase-etanche-bitume', name: 'Arase étanche bitumineuse',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 0.4, unit: 'ml',
        geometryMultiplier: 'none', wasteFactor: 1.05,
        wasteReason: 'Coupes angles', dtu: 'NF DTU 20.1 §5.2.2',
        packaging: { unit: 'rouleau', contentQty: 10, contentUnit: 'ml', label: 'rouleau 10 m × 20 cm' },
      },
      {
        id: 'brique-tc-tradi', name: 'Brique TC creuse/pleine 5,5×10,5×22',
        category: 'brique', phase: 'principal', quantityPerBase: 60, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse + coupes rives',
        dtu: 'NF DTU 20.1', normRef: 'NF EN 771-1',
        manufacturerRef: 'Bouyer Leroux / Terreal / Wienerberger',
        notes: '1 m² ≈ 60 briques format standard (appareillage simple).',
      },
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II 32,5 R (mortier hourdage)',
        category: 'liant', phase: 'principal', quantityPerBase: 8, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Résidus + sur-dosage', dtu: 'NF DTU 20.1',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.025, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention', dtu: 'NF DTU 20.1',
      },
      {
        id: 'eau-mortier', name: 'Eau de gâchage', category: 'eau', phase: 'principal',
        quantityPerBase: 4, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage précis', normRef: 'NF EN 1008',
      },
      {
        id: 'acier-ha10-chainage', name: 'Acier HA10 chaînages verticaux',
        category: 'acier', phase: 'principal', quantityPerBase: 0.8, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes + ligatures', dtu: 'NF DTU 20.1 §6.4',
      },
      {
        id: 'acier-ha6-cadres', name: 'Acier HA6 cadres chaînages',
        category: 'acier', phase: 'principal', quantityPerBase: 0.25, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes', dtu: 'NF DTU 20.1 §6.4',
      },
      {
        id: 'acier-ha8-chainage-horiz', name: 'Acier HA8 chaînage horizontal',
        category: 'acier', phase: 'principal', quantityPerBase: 0.6, unit: 'kg', geometryMultiplier: 'height',
        wasteFactor: 1.10, wasteReason: 'Chutes + recouvrements', dtu: 'NF DTU 20.1 §6.4.2',
      },
      {
        id: 'beton-chainage', name: 'Béton chaînage',
        category: 'liant', phase: 'principal', quantityPerBase: 0.01, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Perte coulage', dtu: 'NF DTU 20.1 §6.4',
      },
      {
        id: 'linteau-prefa-beton', name: 'Linteau préfabriqué béton',
        category: 'bloc', phase: 'principal', quantityPerBase: 0.7, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes appuis', dtu: 'NF DTU 20.1 §6.6',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  MUR PIERRE MOELLONS (chaux NHL obligatoire) — audit #04.4
  // ══════════════════════════════════════════════════════════

  {
    id: 'mur-pierre-moellons',
    name: 'Mur pierre moellons hourdés (chaux NHL 3,5)',
    description: 'Mur traditionnel en pierre locale hourdée à la chaux. Chaux obligatoire — pas de ciment pur (pathologie).',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [
      { code: 'NF DTU 20.1 P1-1 (Octobre 2008 + A1 2020)', title: 'Maçonnerie petits éléments', section: '§5.4 pierre' },
      { code: 'NF EN 771-6+A1 (Octobre 2015)', title: 'Spécifications pierre naturelle' },
      { code: 'NF EN 459-1 (Décembre 2015)', title: 'Chaux de construction' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Mur pierre épaisseur 30 cm supposée (1 t moellons/m²)',
      'Chaux NHL 3,5 OBLIGATOIRE (ciment pur interdit sur pierre ancienne — pathologie humidité)',
      'Ratio mortier chaux : 1 volume chaux / 2 volumes sable',
      'Pertes moellons 25% (calage + rejets selon calibrage)',
      'Harpages inox recommandés aux angles',
      'Variabilité forte selon pierre locale (carrière) — ratios indicatifs',
    ],
    materials: [
      {
        id: 'moellon-pierre-locale', name: 'Moellons pierre locale (calibre ~20-30 cm)',
        category: 'autre', phase: 'principal', quantityPerBase: 1, unit: 't', geometryMultiplier: 'none',
        wasteFactor: 1.25, wasteReason: 'Calage + rejet selon calibrage (pierre = matière brute)',
        normRef: 'NF EN 771-6',
        notes: '1 t moellons/m² pour mur 30 cm (densité 2,4 t/m³ × 0,3 × foisonnement 1,4).',
      },
      {
        id: 'chaux-nhl-35-pierre', name: 'Chaux hydraulique naturelle NHL 3,5',
        category: 'liant', phase: 'principal', quantityPerBase: 15, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Résidus + sur-dosage',
        normRef: 'NF EN 459-1', manufacturerRef: 'Saint-Astier / Baumit Romanzement',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4 (mortier chaux)',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.04, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'eau-mortier-chaux', name: 'Eau de gâchage mortier chaux',
        category: 'eau', phase: 'principal', quantityPerBase: 5, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage (E/L 0,8 plus élevé pour chaux)',
        normRef: 'NF EN 1008',
      },
      {
        id: 'feuillard-harpage-inox', name: 'Feuillards harpage inox (aux angles)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        dtu: 'NF DTU 20.1 §6.3',
        optional: true,
        condition: 'Si jonction avec autre matériau ou mur ancien',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  MUR BÉTON CELLULAIRE (Ytong / Cellumat) — audit #04.5
  // ══════════════════════════════════════════════════════════

  {
    id: 'mur-beton-cellulaire-30',
    name: 'Mur béton cellulaire 30 cm (Ytong / Cellumat)',
    description: 'Mur porteur en blocs béton cellulaire autoclave. Pose au mortier-colle joint mince. R ≈ 2,5.',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [
      { code: 'NF DTU 20.1 P1-1 (Octobre 2008 + A1 2020)', title: 'Maçonnerie petits éléments', section: '§5.5 blocs cellulaires' },
      { code: 'NF EN 771-4+A1 (Octobre 2015)', title: 'Spécifications blocs cellulaires autoclavés' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Blocs Ytong 625×250×300 mm — 4 blocs/m²',
      'Mortier-colle joint mince spécifique cellulaire (Ytong ThermoKleber)',
      '1er rang posé au mortier traditionnel classique (réglage niveau)',
      'Arase étanche obligatoire (NF DTU 20.1 §5.2.2)',
      'Chaînages verticaux HA10 + horizontaux HA8 (DTU 20.1 §6.4)',
      'Linteaux béton cellulaire préfa (Ytong Porolith) ou béton classique',
    ],
    materials: [
      {
        id: 'arase-etanche-bitume', name: 'Arase étanche bitumineuse',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 0.4, unit: 'ml',
        geometryMultiplier: 'none', wasteFactor: 1.05,
        wasteReason: 'Coupes angles', dtu: 'NF DTU 20.1 §5.2.2',
        packaging: { unit: 'rouleau', contentQty: 10, contentUnit: 'ml', label: 'rouleau 10 m × 30 cm' },
      },
      {
        id: 'mortier-hourdage-1er-rang', name: 'Mortier classique 1er rang (réglage)',
        category: 'liant', phase: 'preparation', quantityPerBase: 0.02, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
        dtu: 'NF DTU 20.1',
        notes: 'Seulement pour 1er rang — permet réglage précis avant joint mince.',
      },
      {
        id: 'bloc-beton-cellulaire-30', name: 'Bloc béton cellulaire Ytong 625×250×300',
        category: 'bloc', phase: 'principal', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse + coupes',
        dtu: 'NF DTU 20.1 §5.5', normRef: 'NF EN 771-4',
        manufacturerRef: 'Xella Ytong / Cellumat',
      },
      {
        id: 'colle-joint-mince-cellulaire', name: 'Colle joint mince spéciale béton cellulaire',
        category: 'colle', phase: 'principal', quantityPerBase: 3, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Résidus bac',
        manufacturerRef: 'Ytong ThermoKleber',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'eau-colle-cellulaire', name: 'Eau de gâchage colle cellulaire',
        category: 'eau', phase: 'principal', quantityPerBase: 1, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage précis',
        normRef: 'NF EN 1008',
      },
      {
        id: 'acier-ha10-chainage', name: 'Acier HA10 chaînages verticaux',
        category: 'acier', phase: 'principal', quantityPerBase: 0.8, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes', dtu: 'NF DTU 20.1 §6.4',
      },
      {
        id: 'acier-ha6-cadres', name: 'Acier HA6 cadres chaînages',
        category: 'acier', phase: 'principal', quantityPerBase: 0.25, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes', dtu: 'NF DTU 20.1 §6.4',
      },
      {
        id: 'acier-ha8-chainage-horiz', name: 'Acier HA8 chaînage horizontal',
        category: 'acier', phase: 'principal', quantityPerBase: 0.6, unit: 'kg', geometryMultiplier: 'height',
        wasteFactor: 1.10, wasteReason: 'Recouvrements', dtu: 'NF DTU 20.1 §6.4.2',
      },
      {
        id: 'beton-chainage', name: 'Béton chaînage 15×15 cm',
        category: 'liant', phase: 'principal', quantityPerBase: 0.01, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Perte coulage', dtu: 'NF DTU 20.1 §6.4',
      },
      {
        id: 'linteau-cellulaire', name: 'Linteau béton cellulaire préfa (Ytong Porolith)',
        category: 'bloc', phase: 'principal', quantityPerBase: 0.7, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes appuis',
        dtu: 'NF DTU 20.1 §6.6', manufacturerRef: 'Xella Ytong Porolith',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  ENDUIT EXTÉRIEUR MULTICOUCHE (NF DTU 26.1) — audit #04.6
  // ══════════════════════════════════════════════════════════

  {
    id: 'enduit-ext-multicouche',
    name: 'Enduit extérieur multicouche traditionnel (gobetis + corps + finition)',
    description: '3 couches DTU 26.1 : gobetis accrochage + corps + finition. 20-25 mm total.',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 26.1 (Avril 2008)', title: 'Enduits aux mortiers de liants hydrauliques', section: '§6.3 3 couches' },
      { code: 'NF EN 998-1 (Mai 2017)', title: 'Mortiers d\'enduits' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Cycle complet 3 couches DTU 26.1 §6.3 : gobetis 1-5 mm + corps 10-15 mm + finition 3-5 mm',
      'Délais : gobetis → corps 48h / corps → finition 7 jours',
      'Grillage armature obligatoire aux jonctions entre matériaux différents',
      'Cornières d\'angle PVC + treillis à inclure pour tous les angles',
      'Alternative : enduit monocouche (recette dédiée enduit-ext-monocouche)',
    ],
    materials: [
      // ═══════════ PRÉPARATION ═══════════
      {
        id: 'grillage-armature-enduit', name: 'Grillage armature fibre de verre (jonctions)',
        category: 'fixation', phase: 'preparation', quantityPerBase: 0.15, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Recouvrements + chutes',
        dtu: 'NF DTU 26.1 §6.4.3',
        optional: true,
        condition: 'Obligatoire si mur en multiples matériaux (brique+parpaing, changement support)',
      },
      // ═══════════ PRINCIPAL — Couche 1 Gobetis ═══════════
      {
        id: 'ciment-gobetis', name: 'Ciment CEM II (gobetis 600 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 12, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Résidus',
        dtu: 'NF DTU 26.1 §6.3.1',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
        notes: 'Gobetis dosé ciment 600 kg/m³ × épaisseur 20 mm = 12 kg/m².',
      },
      {
        id: 'sable-gobetis', name: 'Sable 0/4 (gobetis)',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.02, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'eau-gobetis', name: 'Eau gâchage gobetis',
        category: 'eau', phase: 'principal', quantityPerBase: 3, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage précis',
      },
      // ═══════════ PRINCIPAL — Couche 2 Corps ═══════════
      {
        id: 'liant-corps-enduit', name: 'Liant ciment + chaux NHL (corps d\'enduit, 500 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 15, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Résidus',
        dtu: 'NF DTU 26.1 §6.3.2',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
      },
      {
        id: 'sable-corps', name: 'Sable 0/4 (corps)',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.015, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'eau-corps', name: 'Eau gâchage corps',
        category: 'eau', phase: 'principal', quantityPerBase: 3, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage précis',
      },
      // ═══════════ FINITIONS — Couche 3 ═══════════
      {
        id: 'enduit-finition-pigmente', name: 'Mortier finition chaux pigmenté (3-5 mm)',
        category: 'enduit', phase: 'finitions', quantityPerBase: 5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Taloche + projections',
        dtu: 'NF DTU 26.1 §6.3.3',
        manufacturerRef: 'Weber.monorex / Parex Lanko',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'eau-finition', name: 'Eau gâchage finition',
        category: 'eau', phase: 'finitions', quantityPerBase: 1, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage précis',
      },
      // ═══════════ ACCESSOIRES ═══════════
      {
        id: 'corniere-angle-pvc-enduit', name: 'Cornière d\'angle PVC avec treillis (aux angles)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.2, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes angles',
        dtu: 'NF DTU 26.1 §6.5',
        manufacturerRef: 'PAM / Weber',
        packaging: { unit: 'u', contentQty: 2.5, contentUnit: 'ml', label: 'cornière 2,50 m' },
        notes: 'Base : 0,2 ml/m² (1 angle tous les 5 m² moyen).',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  ENDUIT EXTÉRIEUR MONOCOUCHE — alternative #04.6
  // ══════════════════════════════════════════════════════════

  {
    id: 'enduit-ext-monocouche',
    name: 'Enduit extérieur monocouche (2 passes en 1 application)',
    description: 'Enduit prêt à l\'emploi pâteux ou hydraulique. Mise en œuvre rapide 2 passes. Format fabricant.',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 26.1 (Avril 2008)', title: 'Enduits aux mortiers' },
      { code: 'Cahier CSTB 3678', title: 'Enduits monocouches' },
      { code: 'NF EN 998-1 (Mai 2017)', title: 'Mortiers d\'enduits' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Enduit monocouche dosé 25 kg/m² pour 15-18 mm d\'épaisseur',
      'Fabricant : Weber.monorex / Parex Lanko / PRB (prêt à l\'emploi)',
      'Mise en œuvre en 2 passes rapprochées (pas 3 couches)',
      'Humidification support obligatoire avant application',
      'Cornières d\'angle + profils de départ + grillage armature inclus',
      'Alternative à l\'enduit multicouche traditionnel (plus rapide mais moins durable)',
    ],
    materials: [
      {
        id: 'enduit-monocouche', name: 'Enduit monocouche prêt à l\'emploi (15-18 mm)',
        category: 'enduit', phase: 'principal', quantityPerBase: 25, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Projection + taloche',
        dtu: 'Cahier CSTB 3678', normRef: 'NF EN 998-1',
        manufacturerRef: 'Weber.monorex / Parex Lanko / PRB',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'eau-enduit-mono', name: 'Eau gâchage enduit',
        category: 'eau', phase: 'principal', quantityPerBase: 4, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage précis',
      },
      {
        id: 'corniere-angle-pvc-enduit', name: 'Cornière d\'angle PVC (angles + rives)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.2, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes angles', dtu: 'NF DTU 26.1 §6.5',
      },
      {
        id: 'profil-depart-enduit', name: 'Profilé de départ alu (bas de façade)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        notes: 'Base : estimation 0,3 ml/m² (~1 ml de départ tous les 3 m² de façade).',
      },
      {
        id: 'grillage-armature-enduit', name: 'Grillage armature fibre de verre',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.15, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Recouvrements', dtu: 'NF DTU 26.1 §6.4.3',
        optional: true,
        condition: 'Obligatoire si mur en multiples matériaux',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  FONDATIONS SUPERFICIELLES — NF DTU 13.1 rev. 2019
  //  Audit #02
  // ══════════════════════════════════════════════════════════

  // #02.1 Semelle filante BA
  {
    id: 'semelle-filante-ba',
    name: 'Semelle filante béton armé (sous mur)',
    description: 'Fondation continue sous mur porteur. Dimensions min 40 cm L × 20 cm H (DTU 13.1).',
    trade: 'maconnerie',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF DTU 13.1 (Avril 2022)', title: 'Fondations superficielles', section: 'rev. septembre 2019 §5-6' },
      { code: 'NF EN 206+A2/CN (Avril 2021)', title: 'Béton — spécification' },
      { code: 'Eurocode 2', title: 'NF EN 1992-1-1 — calcul structures béton' },
    ],
    version: '2.1.0',
    constraints: {
      note: 'Largeur 40 cm mini, hauteur 20 cm mini (DTU 13.1 §5.1). Profondeur hors-gel selon zone (70-90 cm).',
    },
    hypothesesACommuniquer: [
      'Semelle standard 40 cm largeur × 20 cm hauteur supposée (à adapter selon G2 PRO)',
      'Étude de sol G2 PRO obligatoire avant exécution (loi Elan 2018)',
      'Béton de propreté 5 cm obligatoire sous armatures (DTU 13.1 §5.3)',
      'Ferraillage : 4 HA10 filants + cadres HA8 tous 25 cm (DTU 13.1 §6.2)',
      'Profondeur à adapter au hors-gel local (70 cm Nord, 90 cm montagne)',
      'Arase étanche obligatoire haut semelle avant montage mur (NF DTU 20.1)',
      'Film polyane optionnel si sol humide/argileux ou nappe < 2 m',
    ],
    materials: [
      // ═══ PRÉPARATION ═══
      {
        id: 'beton-proprete', name: 'Béton de propreté 5 cm (250 kg/m³)',
        category: 'liant', phase: 'preparation', quantityPerBase: 0.02, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coulage en fond de fouille',
        dtu: 'NF DTU 13.1 §5.3',
      },
      // ═══ PRINCIPAL — Béton semelle ═══
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II 32,5 R (béton 350 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 28, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Résidus sacs',
        dtu: 'NF DTU 13.1 §6.1', normRef: 'NF EN 197-1',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
        notes: '0,08 m³/ml (40×20 cm) × 350 kg = 28 kg/ml.',
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.04, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.056, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'eau-beton', name: 'Eau de gâchage', category: 'eau', phase: 'principal',
        quantityPerBase: 14, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage précis', normRef: 'NF EN 1008',
      },
      // ═══ PRINCIPAL — Armatures ═══
      {
        id: 'acier-ha10-filant', name: 'Acier HA10 filants (4 barres)',
        category: 'acier', phase: 'principal', quantityPerBase: 2.48, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes + recouvrements 30 cm',
        dtu: 'NF DTU 13.1 §6.2', normRef: 'NF A 35-080',
        notes: '4 HA10 × 0,62 kg/ml = 2,48 kg/ml.',
      },
      {
        id: 'acier-ha8-cadres', name: 'Acier HA8 cadres tous 25 cm',
        category: 'acier', phase: 'principal', quantityPerBase: 1.58, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes + ligatures',
        dtu: 'NF DTU 13.1 §6.2',
      },
      // ═══ ACCESSOIRES ═══
      {
        id: 'cales-beton-30', name: 'Cales enrobage 30 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse',
        dtu: 'NF DTU 21 §7.2',
      },
      {
        id: 'ligatures-fil-recuit', name: 'Ligatures fil recuit 1,4 mm',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.1, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte chantier',
        dtu: 'NF DTU 21 §3.4',
        packaging: { unit: 'rouleau', contentQty: 5, contentUnit: 'kg', label: 'bobine 5 kg' },
      },
      // ═══ FINITIONS ═══
      {
        id: 'arase-etanche-bitume', name: 'Arase étanche bitumineuse (avant mur)',
        category: 'etancheite', phase: 'finitions', quantityPerBase: 1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes angles',
        dtu: 'NF DTU 20.1 §5.2.2',
        packaging: { unit: 'rouleau', contentQty: 10, contentUnit: 'ml', label: 'rouleau 10 m × 20 cm' },
      },
      // ═══ OPTIONS ═══
      {
        id: 'film-polyane-200', name: 'Film polyane 200 μm (si sol humide)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 0.5, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Recouvrements + remontées',
        dtu: 'NF DTU 13.1 §5.3',
        optional: true,
        condition: 'Si sol humide, argileux ou nappe phréatique < 2 m',
      },
    ],
  },

  // #02.2 Semelle isolée (sous poteau)
  {
    id: 'semelle-isolee-ba',
    name: 'Semelle isolée béton armé (sous poteau)',
    description: 'Fondation ponctuelle 60×60×45 cm sous poteau. Grille bi-directionnelle HA10.',
    trade: 'maconnerie',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 13.1 (Avril 2022)', title: 'Fondations superficielles', section: '§5.1.2 semelles isolées' },
      { code: 'Eurocode 2', title: 'NF EN 1992-1-1' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Semelle standard 60×60×45 cm (0,16 m³ béton/u)',
      'Grille bidirectionnelle HA10 : 8 barres/semelle (4 sens × 2 directions)',
      'Béton propreté 10 cm sous armatures',
      'Enrobage 3 cm mini (cales béton sous armatures)',
      'Dimensions à adapter selon descente de charges poteau',
    ],
    materials: [
      {
        id: 'beton-proprete', name: 'Béton de propreté (4 cm × 60×60)',
        category: 'liant', phase: 'preparation', quantityPerBase: 0.04, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coulage', dtu: 'NF DTU 13.1 §5.3',
      },
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II 32,5 R (béton 350 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 56, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Résidus',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
        notes: '0,16 m³ × 350 kg = 56 kg/u.',
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.08, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.112, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'eau-beton', name: 'Eau', category: 'eau', phase: 'principal',
        quantityPerBase: 28, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage',
      },
      {
        id: 'acier-ha10-grille-semelle', name: 'Acier HA10 grille bi-directionnelle (8 barres)',
        category: 'acier', phase: 'principal', quantityPerBase: 3, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes + recouvrements',
        dtu: 'NF DTU 13.1 §6.2',
        notes: '8 × 60 cm × 0,62 kg/ml ≈ 3 kg/u.',
      },
      {
        id: 'cales-beton-30', name: 'Cales enrobage 30 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse', dtu: 'NF DTU 21 §7.2',
      },
      {
        id: 'ligatures-fil-recuit', name: 'Ligatures fil recuit',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.05, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte chantier',
      },
    ],
  },

  // #02.3 Radier général
  {
    id: 'radier-general',
    name: 'Radier général béton armé (dalle de fondation)',
    description: 'Radier épaisseur 25+ cm, double nappe armatures HA12. Sols à faible portance ou charges importantes.',
    trade: 'maconnerie',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 13.1 (Avril 2022)', title: 'Fondations superficielles', section: '§5.4 Radiers' },
      { code: 'Eurocode 2', title: 'NF EN 1992-1-1' },
      { code: 'NF EN 206+A2/CN (Avril 2021)', title: 'Béton C30/37' },
    ],
    version: '2.1.0',
    constraints: { minThickness: 0.25, note: 'Épaisseur minimum 25 cm (DTU 13.1 §5.4).' },
    hypothesesACommuniquer: [
      'Épaisseur 30 cm supposée (à adapter selon calcul Eurocode 2)',
      'Béton C30/37 (plus résistant que dalle standard)',
      'Double nappe armatures HA12 maille 15×15 (haut + bas)',
      'Hydrofuge de masse OBLIGATOIRE (vs optionnel dallage)',
      'Joint de reprise hydrogonflant à chaque reprise bétonnage',
      'Polyane 200 μm obligatoire sous radier',
      'Étude de sol G2 PRO + calcul structure obligatoires',
    ],
    materials: [
      {
        id: 'geotextile-200', name: 'Géotextile 200 g/m²',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'm2', label: 'rouleau 50×2m' },
      },
      {
        id: 'film-polyane-200', name: 'Film polyane 200 μm',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Recouvrements',
        dtu: 'NF DTU 13.1',
        packaging: { unit: 'rouleau', contentQty: 150, contentUnit: 'm2', label: 'rouleau 25×6m' },
      },
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II 32,5 R (béton 400 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 400, unit: 'kg', geometryMultiplier: 'thickness',
        wasteFactor: 1.03, wasteReason: 'Résidus',
        dtu: 'NF EN 206', normRef: 'NF EN 197-1',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.5, unit: 'm3', geometryMultiplier: 'thickness',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.7, unit: 'm3', geometryMultiplier: 'thickness',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'eau-beton', name: 'Eau', category: 'eau', phase: 'principal',
        quantityPerBase: 180, unit: 'L', geometryMultiplier: 'thickness',
        wasteFactor: 1.00, wasteReason: 'Dosage',
      },
      {
        id: 'acier-ha12-binappe', name: 'Acier HA12 bi-nappe (haut + bas, maille 15×15)',
        category: 'acier', phase: 'principal', quantityPerBase: 3.56, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Recouvrements + chutes',
        dtu: 'NF DTU 13.1 §5.4 / Eurocode 2',
        notes: '2 × 1,78 kg/m² (nappe haute + basse).',
      },
      {
        id: 'chaise-armatures', name: 'Chaises d\'armatures (support nappe sup.)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
      {
        id: 'cales-beton-30', name: 'Cales enrobage 30 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 8, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse',
      },
      {
        id: 'hydrofuge-masse-beton-radier', name: 'Hydrofuge de masse radier (OBLIGATOIRE)',
        category: 'adjuvant', phase: 'principal', quantityPerBase: 4, unit: 'kg', geometryMultiplier: 'thickness',
        wasteFactor: 1.00, wasteReason: 'Dosage exact (1% ciment)',
        manufacturerRef: 'Sika 1 / Weber Sysfuge',
        notes: 'Obligatoire radier contrairement au dallage.',
      },
      {
        id: 'joint-hydrogonflant', name: 'Joint hydrogonflant (reprises bétonnage)',
        category: 'joint', phase: 'accessoires', quantityPerBase: 0.1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        manufacturerRef: 'Sika Swellstop / Fosroc',
        notes: 'Au droit des reprises de coulage.',
      },
      {
        id: 'produit-cure-beton', name: 'Produit de cure',
        category: 'adjuvant', phase: 'finitions', quantityPerBase: 0.2, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Pulvérisation',
        dtu: 'DTU 21 §8',
        packaging: { unit: 'u', contentQty: 25, contentUnit: 'L', label: 'bidon 25 L' },
      },
    ],
  },

  // #02.4 Longrine BA
  {
    id: 'longrine-ba',
    name: 'Longrine béton armé (poutre de fondation 30×40)',
    description: 'Poutre béton sur pieux ou entre semelles. Section type 30×40 cm.',
    trade: 'maconnerie',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF DTU 13.1 (Avril 2022)', title: 'Fondations superficielles', section: '§5.5 Longrines' },
      { code: 'Eurocode 2', title: 'NF EN 1992-1-1 §9.2 Poutres' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Section standard 30×40 cm (0,12 m³ béton/ml)',
      'Armatures : 4 HA12 longitudinaux + cadres HA8 tous 20 cm',
      'Coffrage contreplaqué CTBX 18 mm (si hors sol)',
      'Décoffrant obligatoire avant coulage',
      'Dimensions à adapter selon portée et charges',
    ],
    materials: [
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II 32,5 R (béton 350 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 42, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Résidus',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.06, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.084, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'eau-beton', name: 'Eau', category: 'eau', phase: 'principal',
        quantityPerBase: 21, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage',
      },
      {
        id: 'acier-ha12-longrine', name: 'Acier HA12 longitudinaux (4 barres)',
        category: 'acier', phase: 'principal', quantityPerBase: 3.55, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes + recouvrements',
        dtu: 'NF DTU 13.1 §5.5', normRef: 'NF A 35-080',
      },
      {
        id: 'acier-ha8-cadres-longrine', name: 'Cadres HA8 tous 20 cm',
        category: 'acier', phase: 'principal', quantityPerBase: 2, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes', dtu: 'NF DTU 13.1 §5.5',
      },
      {
        id: 'coffrage-ctbx-18', name: 'Coffrage contreplaqué CTBX 18 mm',
        category: 'bois', phase: 'preparation', quantityPerBase: 1.3, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Réutilisation limitée + coupes',
        optional: true,
        condition: 'Si longrine hors sol (non enterrée)',
      },
      {
        id: 'decoffrant-huile', name: 'Huile de décoffrage',
        category: 'adjuvant', phase: 'preparation', quantityPerBase: 0.15, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sur-dosage',
        manufacturerRef: 'Sika Separol / Chryso Decofrage',
        packaging: { unit: 'u', contentQty: 25, contentUnit: 'L', label: 'bidon 25 L' },
        optional: true,
        condition: 'Si coffrage utilisé',
      },
      {
        id: 'cales-beton-30', name: 'Cales enrobage 30 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse', dtu: 'NF DTU 21 §7.2',
      },
      {
        id: 'ligatures-fil-recuit', name: 'Ligatures fil recuit',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.1, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte',
      },
    ],
  },

  // #02.5 Puits court / massif semi-profond
  {
    id: 'puits-court-ba',
    name: 'Puits court béton armé (massif semi-profond)',
    description: 'Fondation par puits court (élancement ≤ 5 — DTU 13.1). Typique reprise fondations ou sol hétérogène.',
    trade: 'maconnerie',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 13.1 (Avril 2022)', title: 'Fondations superficielles', section: '§5.6 massifs semi-profonds' },
      { code: 'Eurocode 2', title: 'NF EN 1992-1-1' },
    ],
    version: '2.1.0',
    constraints: {
      note: 'Élancement ≤ 5. Au-delà → fondation profonde (NF DTU 13.2).',
    },
    hypothesesACommuniquer: [
      'Puits Ø80 cm × hauteur 2-3 m supposé (volume 1-1,5 m³/u)',
      'Cage armatures : 4 HA14 + cadres HA8',
      'Béton dosé 350 kg/m³',
      'Étude de sol G2 PRO obligatoire (élancement, portance)',
      'Au-delà d\'un élancement 5, passer à fondation profonde DTU 13.2',
    ],
    materials: [
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II 32,5 R (puits 350 kg/m³)',
        category: 'liant', phase: 'principal', quantityPerBase: 440, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Résidus',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac 35 kg' },
        notes: '~1,25 m³ béton × 350 kg/m³ = 440 kg/u.',
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.63, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20', category: 'granulat', phase: 'principal',
        quantityPerBase: 0.88, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'eau-beton', name: 'Eau', category: 'eau', phase: 'principal',
        quantityPerBase: 220, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage',
      },
      {
        id: 'acier-ha14-cage-puits', name: 'Acier HA14 cage longitudinal (4 barres)',
        category: 'acier', phase: 'principal', quantityPerBase: 15, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes',
        notes: '4 × 3 m × 1,21 kg/ml ≈ 15 kg/u.',
      },
      {
        id: 'acier-ha8-cadres-puits', name: 'Cadres HA8 puits',
        category: 'acier', phase: 'principal', quantityPerBase: 4, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes',
      },
      {
        id: 'cales-beton-30', name: 'Cales enrobage 30 mm',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 6, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse',
      },
      {
        id: 'ligatures-fil-recuit', name: 'Ligatures',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.2, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte',
      },
    ],
  },
];
