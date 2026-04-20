import type { Recipe } from '../../types'

/**
 * ÉTANCHÉITÉ — audit #09
 *
 * Référentiels FR :
 * - NF DTU 43.1   Étanchéité toitures-terrasses avec éléments porteurs maçonnerie (rev. nov. 2004 + A1 2007)
 * - NF DTU 43.3   Étanchéité toitures-terrasses tôles acier
 * - NF DTU 43.5   Réfection étanchéité
 * - NF DTU 44.1   Étanchéité joints façades
 * - NF DTU 14.1   Cuvelage (parties enterrées)
 * - NF DTU 52.10  Systèmes d'étanchéité sous carrelage (SPEC — SDB)
 */

export const etancheiteRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #9.1 ÉTANCHÉITÉ TOITURE-TERRASSE INACCESSIBLE
  // ══════════════════════════════════════════════════════════
  {
    id: 'etancheite-toiture-terrasse-inaccessible',
    name: 'Étanchéité toiture-terrasse inaccessible (bicouche SBS)',
    description: 'Complexe écran pare-vapeur + isolant + membrane bicouche SBS. Relevés périphériques obligatoires.',
    trade: 'etancheite',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 43.1 (Novembre 2004 + A1 Septembre 2007)', title: 'Étanchéité des toitures-terrasses et toitures inclinées avec éléments porteurs en maçonnerie en climat de plaine' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Complexe standard : primaire + pare-vapeur + isolant PIR 120 mm + bicouche SBS 4+4 mm',
      'Relevés d\'étanchéité 50 cm hauteur en périphérie (OBLIGATOIRE DTU 43.1 §10)',
      'Costière métallique au périmètre (+ crapaudines au droit des évacuations EP)',
      'Isolant épaisseur 120-160 mm selon RE2020 (R > 4,5)',
      'Autoprotection granulés minéraux en couche supérieure',
    ],
    materials: [
      // ═══ PRÉPARATION ═══
      {
        id: 'primaire-bitume-etancheite', name: 'Primaire d\'accrochage bitumineux',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.3, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac + rouleau',
        dtu: 'NF DTU 43.1 §5',
        manufacturerRef: 'Siplast Siplasol / Icopal',
        packaging: { unit: 'u', contentQty: 25, contentUnit: 'L', label: 'bidon 25 L' },
      },
      {
        id: 'pare-vapeur-bitume', name: 'Écran pare-vapeur bitume SBS 4 mm',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
        dtu: 'NF DTU 43.1 §5',
        packaging: { unit: 'rouleau', contentQty: 7.5, contentUnit: 'm2', label: 'rouleau 7,5 m²' },
      },
      // ═══ PRINCIPAL — Isolant ═══
      {
        id: 'isolant-pir-120', name: 'Isolant PIR 120 mm (panneaux 1,20×1 m)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Découpes',
        dtu: 'NF DTU 43.1',
        manufacturerRef: 'Efisol PIR / Rockwool Rockacier',
      },
      // ═══ PRINCIPAL — Membrane ═══
      {
        id: 'membrane-sbs-4mm', name: 'Membrane SBS 4 mm (1re couche)',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements 10 cm + chutes',
        dtu: 'NF DTU 43.1 §7',
        manufacturerRef: 'Siplast / Icopal',
      },
      {
        id: 'membrane-sbs-autoprotegee', name: 'Membrane SBS autoprotégée (2e couche granulés)',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements + chutes',
        dtu: 'NF DTU 43.1 §7',
      },
      // ═══ ACCESSOIRES ═══
      {
        id: 'releve-etancheite', name: 'Relevés d\'étanchéité (équerres + mollets)',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 0.5, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes périphériques',
        dtu: 'NF DTU 43.1 §10',
        notes: 'Relevé 50 cm × périmètre = 0,5 m²/m² (pour surface carrée standard).',
      },
      {
        id: 'costiere-metallique', name: 'Costière métallique (périmètre toiture)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 43.1',
      },
      {
        id: 'crapaudine-ep-terrasse', name: 'Crapaudine (entrée d\'eau pluviale)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.02, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: '1 crapaudine tous les 50 m² environ.',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #9.2 ÉTANCHÉITÉ TOITURE-TERRASSE ACCESSIBLE
  // ══════════════════════════════════════════════════════════
  {
    id: 'etancheite-toiture-terrasse-accessible',
    name: 'Étanchéité toiture-terrasse accessible (dalles sur plots)',
    description: 'Complexe ÉT accessible + protection par dalles béton sur plots PVC réglables. XPS 300 kPa.',
    trade: 'etancheite',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 43.1 (Novembre 2004 + A1 Septembre 2007)', title: 'Étanchéité toitures-terrasses' },
      { code: 'Règles CSFE', title: 'Complémentaires accessibilité' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Idem 9.1 + protection dure : dalles béton 50×50 sur plots PVC',
      'Isolant XPS 300 kPa (résistance compression haute) au lieu de PIR',
      'Écran de désolidarisation entre membrane et dalles',
      'Plots réglables pour pente 1-2% drainage',
      'Solution alternative : dalles bois composite sur plots',
    ],
    materials: [
      {
        id: 'primaire-bitume-etancheite', name: 'Primaire bitumineux',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.3, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac', dtu: 'NF DTU 43.1 §5',
      },
      {
        id: 'pare-vapeur-bitume', name: 'Pare-vapeur bitume SBS 4 mm',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements', dtu: 'NF DTU 43.1 §5',
      },
      {
        id: 'isolant-xps-300kpa', name: 'Isolant XPS 300 kPa (résistance compression)',
        category: 'isolant', phase: 'principal', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Découpes',
        manufacturerRef: 'Ursa XPS / Knauf Therm XPS',
      },
      {
        id: 'membrane-sbs-4mm', name: 'Membrane SBS 4 mm',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
      },
      {
        id: 'ecran-desolidarisation', name: 'Écran désolidarisation (natte)',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Recouvrements',
      },
      {
        id: 'plot-pvc-reglable', name: 'Plot PVC réglable (sous dalles)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse',
        manufacturerRef: 'Jouplast / Nicoll',
      },
      {
        id: 'dalle-beton-50x50', name: 'Dalles béton 50×50 (protection)',
        category: 'plaque', phase: 'principal', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse',
      },
      {
        id: 'releve-etancheite', name: 'Relevés d\'étanchéité 50 cm',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 0.5, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes', dtu: 'NF DTU 43.1 §10',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #9.3 SPEC SOUS CARRELAGE DOUCHE/SDB
  // ══════════════════════════════════════════════════════════
  {
    id: 'spec-douche-sdb',
    name: 'SPEC — Système de Protection à l\'Eau sous Carrelage (douche/SDB)',
    description: 'Membrane étanche liquide bicomposant sous carrelage. Obligatoire douche à l\'italienne et plan vasque.',
    trade: 'etancheite',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 52.10 (Septembre 2013)', title: 'Systèmes d\'étanchéité sous carrelage (SPEC)' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Résine liquide bicomposant OU natte étanche pré-encollée',
      'Bande d\'angle armée obligatoire sur toutes jonctions sol/mur',
      'Manchette bonde + manchettes canalisations pour perforations',
      'Relevés 50 cm sur murs adjacents (douche)',
      'Obligatoire pour : douche italienne, plan vasque carrelé, locaux humides classe U3 P3',
    ],
    materials: [
      {
        id: 'primaire-spec', name: 'Primaire bitumineux ou époxy (selon système)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac',
        dtu: 'NF DTU 52.10',
      },
      {
        id: 'membrane-spec', name: 'Membrane SPEC (résine liquide bicomposant)',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1.5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac + sur-dosage',
        dtu: 'NF DTU 52.10',
        manufacturerRef: 'Mapei Mapegum WPS / Weber.sys Protect / Sika Sanisol',
        packaging: { unit: 'u', contentQty: 8, contentUnit: 'kg', label: 'bidon 8 kg' },
      },
      {
        id: 'bande-angle-armee-spec', name: 'Bande d\'angle armée (jonctions sol/mur)',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 1, unit: 'ml', geometryMultiplier: 'perimeter',
        wasteFactor: 1.05, wasteReason: 'Coupes angles',
        dtu: 'NF DTU 52.10',
      },
      {
        id: 'manchette-perforation-spec', name: 'Manchettes bonde + canalisations',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: '~0,3 manchette/m² (1 pour bonde + 1-2 pour canalisations).',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #9.4 CUVELAGE ENTERRÉ
  // ══════════════════════════════════════════════════════════
  {
    id: 'cuvelage-enterre',
    name: 'Cuvelage enterré (enduit pelliculaire étanche)',
    description: 'Étanchéité de parties enterrées (vide sanitaire, cave, parking). Type C : enduit pelliculaire.',
    trade: 'etancheite',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 14.1 P1-1 (Mars 2017)', title: 'Cuvelage (étanchéité parties enterrées)' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Type C (béton sec) : enduit pelliculaire étanche ≈ 3 kg/m²',
      'Alternative Type B : membrane bitumineuse',
      'Drainage périphérique OBLIGATOIREMENT associé (recette séparée)',
      'Hydrofuge de masse dans béton paroi : option selon exigence',
    ],
    materials: [
      {
        id: 'enduit-pelliculaire-etanche', name: 'Enduit pelliculaire étanche',
        category: 'etancheite', phase: 'principal', quantityPerBase: 3, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Taloche + sur-dosage',
        dtu: 'NF DTU 14.1',
        manufacturerRef: 'Sika Igasol Haut / Weber Sysfuge',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'hydrofuge-beton-paroi', name: 'Hydrofuge de masse (dans béton paroi)',
        category: 'adjuvant', phase: 'preparation', quantityPerBase: 0.5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage précis',
        optional: true,
        condition: 'Si nappe phréatique permanente ou zone très humide',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #9.5 DRAINAGE PÉRIPHÉRIQUE
  // ══════════════════════════════════════════════════════════
  {
    id: 'drainage-peripherique',
    name: 'Drainage périphérique (contre mur enterré)',
    description: 'Nappe drainante + drain agricole + gravier + géotextile contre paroi enterrée.',
    trade: 'etancheite',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF DTU 20.1 P1-1 (Octobre 2008 + A1 2020)', title: 'Maçonnerie', section: '§5.6 drainage mur enterré' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = 1 ml de paroi enterrée à drainer',
      'Hauteur enterrée supposée 2 m (adapter selon chantier)',
      'Nappe drainante Delta MS + géotextile',
      'Drain agricole Ø100 PVC en pied de mur',
      'Gravier drainant 15/25 sur 0,3 m³/ml (tranchée 30×30 cm)',
      'Regard collecte tous 20 ml ou aux angles',
    ],
    materials: [
      {
        id: 'nappe-drainante', name: 'Nappe drainante Delta MS + géotextile intégré',
        category: 'etancheite', phase: 'principal', quantityPerBase: 2, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        manufacturerRef: 'Dörken Delta MS',
        notes: '2 m² par ml (hauteur enterrée 2 m).',
      },
      {
        id: 'drain-pvc-100', name: 'Drain agricole Ø100 PVC perforé',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1.05, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
      {
        id: 'gravier-drainant', name: 'Gravier drainant 15/25',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.3, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Tassement',
        notes: 'Tranchée 30×30 cm autour drain.',
      },
      {
        id: 'geotextile-drainage', name: 'Géotextile (enrobage drain anti-colmatage)',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
      },
      {
        id: 'regard-collecte-drainage', name: 'Regard collecte (tous 20 ml)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.05, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: '1 regard tous 20 ml + aux angles.',
      },
    ],
  },
]
