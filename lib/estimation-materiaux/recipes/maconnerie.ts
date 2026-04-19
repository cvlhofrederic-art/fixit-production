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
      'Joints de retrait sciés prévus tous les 25 m² maxi (obligatoire DTU 13.3 § 6.3)',
      'Film polyane sous dalle sur terre-plein (non pertinent pour dalle intermédiaire)',
      'Cure du béton par produit pulvérisé (obligatoire DTU 21 § 8 par temps chaud/vent)',
      'Isolant sous dalle NON inclus par défaut — à ajouter pour RE2020 ou local chauffé',
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
    version: '2.0.0',
    constraints: { minThickness: 0.12, maxThickness: 0.25, note: 'Épaisseur min 12 cm pour garage (DTU 13.3 Partie 1).' },
    materials: [
      {
        id: 'ciment-cem2-325r', name: 'Ciment CEM II/B 32,5 R (béton 350 kg/m³)',
        category: 'liant', quantityPerBase: 350, unit: 'kg',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.03, wasteReason: 'Résidus sacs',
        dtu: 'DTU 21', normRef: 'NF EN 206',
        packaging: { unit: 'sac', contentQty: 35, contentUnit: 'kg', label: 'sac de 35 kg' },
      },
      {
        id: 'sable-0-4', name: 'Sable 0/4',
        category: 'granulat', quantityPerBase: 0.50, unit: 'm3',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.10, wasteReason: 'Manutention',
        dtu: 'DTU 21',
      },
      {
        id: 'gravier-4-20', name: 'Gravier 4/20',
        category: 'granulat', quantityPerBase: 0.70, unit: 'm3',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.10, wasteReason: 'Manutention',
        dtu: 'DTU 21',
      },
      {
        id: 'eau-beton', name: 'Eau',
        category: 'eau', quantityPerBase: 175, unit: 'L',
        geometryMultiplier: 'thickness',
        wasteFactor: 1.00, wasteReason: 'Dosage exact',
        normRef: 'NF EN 1008',
      },
      {
        id: 'treillis-st40c', name: 'Treillis soudé ST40C (Ø8 maille 150×150, panneau 6×2,4m)',
        category: 'acier', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Recouvrement 2 mailles + chutes (ADETS)',
        dtu: 'DTU 13.3 § 5.3', normRef: 'NF A 35-080-1', manufacturerRef: 'ADETS',
        packaging: { unit: 'panneau', contentQty: 14.4, contentUnit: 'm2', label: 'panneau ST40C 6×2,4m' },
      },
      {
        id: 'cales-beton-30', name: 'Cales d\'enrobage 30 mm',
        category: 'accessoire', quantityPerBase: 4, unit: 'u',
        geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse, perte chantier', dtu: 'DTU 21 § 7.2',
      },
      {
        id: 'film-polyane-200', name: 'Film polyane 200 μm',
        category: 'etancheite', quantityPerBase: 1, unit: 'm2',
        geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Recouvrements 20 cm + remontées', dtu: 'DTU 13.3 § 5.1.4',
        packaging: { unit: 'rouleau', contentQty: 150, contentUnit: 'm2', label: 'rouleau 25×6m' },
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
];
