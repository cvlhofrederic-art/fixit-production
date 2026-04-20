import type { Recipe } from '../../types'

/**
 * ASSAINISSEMENT — audit #23
 *
 * Référentiels FR :
 * - NF DTU 64.1     Assainissement non collectif (rev. 2013 + A1 2020)
 * - NF EN 12566     Petites installations traitement eaux usées
 * - Arrêté 7 sept. 2009  Prescriptions ANC
 * - NF DTU 60.33    Canalisations enterrées
 */

export const assainissementRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #23.1 FOSSE TOUTES EAUX + ÉPANDAGE
  // ══════════════════════════════════════════════════════════
  {
    id: 'anc-fosse-epandage',
    name: 'ANC — Fosse toutes eaux 5 000 L + épandage (maison T4 = 5 EH)',
    description: 'Fosse toutes eaux 5 000 L (béton ou PE) + tranchée épandage drainant 90 ml + ventilation + regards.',
    trade: 'assainissement',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 64.1 (Août 2013)', title: 'Assainissement non collectif (rev. 2013 + A1 2020)' },
      { code: 'NF EN 12566-1 à 7 (2013-2018)', title: 'Petites installations traitement eaux usées' },
      { code: 'Arrêté 7/9/2009', title: 'Prescriptions techniques ANC' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = 1 installation ANC complète (maison T4 = 5 EH)',
      'Fosse toutes eaux 5 000 L (béton ou PE — Sotralentz / Graf / Simop)',
      'Épandage 90 ml drainant minimum (adapter selon perméabilité sol)',
      'Ventilation PRIMAIRE (chute EV) + SECONDAIRE (extracteur statique sur fosse)',
      'Regards : 1 répartition avant épandage + 1 bouclage après',
      'Bac dégraisseur optionnel (si cuisine > 5 m fosse OU rejet graisses)',
      'SPANC validation obligatoire avant et après travaux',
    ],
    materials: [
      {
        id: 'fosse-toutes-eaux-5000', name: 'Fosse toutes eaux 5 000 L (béton ou PE)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 64.1',
        manufacturerRef: 'Sotralentz / Graf / Simop',
      },
      {
        id: 'drain-pvc-100-perfore', name: 'Drain PVC Ø100 perforé (épandage)',
        category: 'plaque', phase: 'principal', quantityPerBase: 94.5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        notes: '90 ml × 1,05 pertes = 94,5 ml.',
      },
      {
        id: 'gravier-epandage', name: 'Gravier calibré 10/30 ou 20/40 (épandage)',
        category: 'granulat', phase: 'principal', quantityPerBase: 81, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Tassement',
        notes: '0,9 m³/ml × 90 ml = 81 m³.',
      },
      {
        id: 'geotextile-epandage', name: 'Géotextile (enveloppement tranchée)',
        category: 'etancheite', phase: 'principal', quantityPerBase: 180, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
        notes: '2 m² par ml × 90 ml = 180 m².',
      },
      {
        id: 'regard-repartition-epandage', name: 'Regard de répartition + bouclage',
        category: 'bloc', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'extracteur-statique-anc', name: 'Extracteur statique ventilation secondaire',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'bac-degraisseur-anc', name: 'Bac dégraisseur (cuisine éloignée / graisses)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        optional: true,
        condition: 'Si cuisine > 5 m fosse OU rejet graisses important',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #23.2 MICROSTATION
  // ══════════════════════════════════════════════════════════
  {
    id: 'anc-microstation',
    name: 'Microstation agréée (2,5 à 20 EH)',
    description: 'Station traitement biologique compacte (Graf Cloche / Tricel Novo / Simop Bionet). Agrément ministériel obligatoire.',
    trade: 'assainissement',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 64.1 (Août 2013)', title: 'ANC (§4.2 agréments)' },
      { code: 'NF EN 12566-3+A2 (Novembre 2013)', title: 'Spécifications microstations' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Microstation agréée Ministère (liste officielle ecologie.gouv.fr)',
      'Dimensionnement 5-6 EH pour habitation T4 standard',
      'Raccordement électrique 230 V dédié (disjoncteur diff 30 mA)',
      'Extracteur intégré (ventilation)',
      'Alternative économe en espace vs fosse+épandage',
    ],
    materials: [
      {
        id: 'microstation-5eh', name: 'Microstation agréée 5-6 EH',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 64.1 §4.2',
        manufacturerRef: 'Graf / Tricel Novo / Simop Bionet',
      },
      {
        id: 'raccordement-elec-microstation', name: 'Raccordement électrique 230 V dédié',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'rehausse-microstation', name: 'Rehausse (si nappe haute)',
        category: 'bloc', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        optional: true,
        condition: 'Si nappe phréatique ou zone inondable',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #23.3 FILTRE COMPACT (alternative épandage)
  // ══════════════════════════════════════════════════════════
  {
    id: 'anc-filtre-compact',
    name: 'Filtre compact (filtre à sable ou fibre coco)',
    description: 'Alternative à l\'épandage quand terrain défavorable (argile, rocher). Massif filtrant compact.',
    trade: 'assainissement',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 64.1 (Août 2013)', title: 'ANC' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Filtre compact agréé (filtre à sable 20 m² OU filtre coco)',
      'Préfiltre placé avant le filtre',
      'Typiquement remplace l\'épandage 90 ml par un massif 4×5 m',
      'Terrain nécessaire réduit de 80%',
    ],
    materials: [
      {
        id: 'filtre-compact-agree', name: 'Module filtre compact agréé',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 64.1',
      },
      {
        id: 'prefiltre-anc', name: 'Préfiltre (avant massif)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'sable-filtre-compact', name: 'Sable calibré filtre',
        category: 'granulat', phase: 'principal', quantityPerBase: 4, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Tassement',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #23.4 RACCORDEMENT RÉSEAU COLLECTIF
  // ══════════════════════════════════════════════════════════
  {
    id: 'raccord-collectif-sanitaire',
    name: 'Raccordement au réseau collectif (tout-à-l\'égout)',
    description: 'Tube PVC Ø125 ou 160 + regard de branchement en limite de propriété. Autorisation mairie + convention obligatoires.',
    trade: 'assainissement',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF DTU 60.33 (Janvier 2007)', title: 'PVC enterré' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Tube PVC Ø125 (habitation standard) ou Ø160 (bâtiment collectif)',
      'Lit sable 10 cm + enrobage sable 10 cm + grillage avertisseur',
      'Regard de branchement en limite de propriété (fin du privé)',
      'Convention raccordement mairie obligatoire (autorisation préalable)',
      'Frais de branchement en sus (variables selon commune)',
    ],
    materials: [
      {
        id: 'tube-pvc-125-collectif', name: 'Tube PVC Ø125 ou 160 (raccord collectif)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.05, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
      {
        id: 'coude-te-pvc-125', name: 'Coudes / tés PVC (raccords)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Rebuts',
      },
      {
        id: 'regard-branchement', name: 'Regard de branchement (limite propriété)',
        category: 'bloc', phase: 'principal', quantityPerBase: 0.05, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: '1 regard par raccord (~0,05/ml pour raccord 20 m).',
      },
      {
        id: 'sable-raccord', name: 'Sable lit + enrobage',
        category: 'granulat', phase: 'preparation', quantityPerBase: 0.08, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Manutention',
      },
      {
        id: 'grillage-avertisseur-marron-raccord', name: 'Grillage avertisseur marron',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
    ],
  },
]
