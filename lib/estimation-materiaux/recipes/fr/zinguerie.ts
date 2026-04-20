import type { Recipe } from '../../types'

/**
 * ZINGUERIE — audit #08
 *
 * Référentiels FR :
 * - NF DTU 40.5   Évacuation eaux pluviales
 * - NF DTU 60.11  Règles de calcul (dimensionnement descentes EP)
 * - NF DTU 40.41  Zinc joint debout (compléments solins)
 */

export const zingerieRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #8.1 GOUTTIÈRES DEMI-RONDES ZINC
  // ══════════════════════════════════════════════════════════
  {
    id: 'gouttiere-zinc-demi-ronde',
    name: 'Gouttière zinc demi-ronde 25 (au ml)',
    description: 'Gouttière zinc pré-patiné posée en pied de pan de toiture. Crochets tous les 60 cm + naissances vers descentes EP.',
    trade: 'zinguerie',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF DTU 40.5 (Juin 2018)', title: 'Évacuation eaux pluviales', section: '§5-6' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Gouttière demi-ronde 25 (Ø 25 cm) — dimension standard maison individuelle',
      'Crochets tous les 60 cm (DTU 40.5 §6.5) → 1,7 crochet/ml',
      'Jonctions entre éléments 4 ml tous les ~4 ml de gouttière',
      'Étain de soudure pour assemblages',
      'Naissance + tampons obturateurs à ajouter au périmètre',
    ],
    materials: [
      {
        id: 'gouttiere-zinc', name: 'Gouttière zinc demi-ronde 25 (élément 4 ml)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Chutes',
        dtu: 'NF DTU 40.5',
        manufacturerRef: 'VMZinc / RheinZink / Umicore',
        packaging: { unit: 'u', contentQty: 4, contentUnit: 'ml', label: 'élément 4 ml' },
      },
      {
        id: 'crochet-gouttiere', name: 'Crochets gouttière (à bande ou à plat)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1.7, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
        dtu: 'NF DTU 40.5 §6.5',
        notes: '1 crochet tous les 60 cm → 1,67 arrondi 1,7.',
      },
      {
        id: 'jonction-gouttiere', name: 'Manchons jonction gouttière',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.25, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
        notes: '1 jonction tous les 4 ml.',
      },
      {
        id: 'etain-soudure-zinguerie', name: 'Étain de soudure (assemblages)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.03, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte',
        packaging: { unit: 'u', contentQty: 0.5, contentUnit: 'kg', label: 'bobine 500 g' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #8.2 DESCENTE EAUX PLUVIALES (EP)
  // ══════════════════════════════════════════════════════════
  {
    id: 'descente-ep-zinc',
    name: 'Descente EP zinc Ø100 (au ml)',
    description: 'Tube zinc Ø80 ou Ø100 selon surface drainée. Colliers de fixation tous 1,5 m. Dauphin fonte en pied.',
    trade: 'zinguerie',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF DTU 40.5 (Juin 2018)', title: 'Évacuation EP' },
      { code: 'NF DTU 60.11 (Décembre 2012)', title: 'Dimensionnement (Ø80 < 50 m² / Ø100 > 50 m²)' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Tube Ø100 (surface drainée > 50 m² — standard habitation)',
      'Pour < 50 m² : tube Ø80 suffit (DTU 60.11)',
      'Élément 2 ml (modulaire)',
      'Colliers fixation tous 1,5 m (vertical)',
      'Dauphin fonte 50 cm en pied (anti-chocs véhicule/outils)',
      'Naissance + coudes (raccord toiture → tube)',
    ],
    materials: [
      {
        id: 'tube-descente-zinc-100', name: 'Tube descente zinc Ø100 (élément 2 ml)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 40.5',
        packaging: { unit: 'u', contentQty: 2, contentUnit: 'ml', label: 'élément 2 ml' },
      },
      {
        id: 'coude-descente-ep', name: 'Coudes zinc (raccord + changement direction)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
        notes: '2-3 coudes par descente (naissance + pied dauphin).',
      },
      {
        id: 'dauphin-fonte', name: 'Dauphin fonte 50 cm (pied descente)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.15, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 40.5',
        notes: '1 dauphin par descente × 6 m hauteur moyenne → 0,17/ml.',
      },
      {
        id: 'collier-descente', name: 'Colliers fixation descente',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.67, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
        notes: '1 tous les 1,5 m vertical.',
      },
      {
        id: 'raccord-cuvette-ep', name: 'Raccord cuvette (évacuation vers regard)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.15, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #8.3 NOUE ZINC
  // ══════════════════════════════════════════════════════════
  {
    id: 'noue-zinc',
    name: 'Noue zinc (raccord 2 pans toiture, au ml)',
    description: 'Bande zinc pré-formée en V, ép. 0,65 mm min, soudure étain.',
    trade: 'zinguerie',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF DTU 40.21 (Juillet 2020)', title: 'Tuiles TC', section: '§6.7 noues' },
      { code: 'NF DTU 40.41 (Février 2023)', title: 'Zinc', section: '§7 noues' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Bande zinc ép. 0,65 mm (minimum DTU 40.41)',
      'Éléments 2 ml pré-formés en V',
      'Pattes fixes + coulissantes pour dilatation',
      'Soudure étain aux raccords',
      'Bande porte-solin si raccord contre mur',
    ],
    materials: [
      {
        id: 'bande-noue-zinc', name: 'Bande zinc pré-formée en V (noue)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + pertes',
        dtu: 'NF DTU 40.41 §7',
        packaging: { unit: 'u', contentQty: 2, contentUnit: 'ml', label: 'élément 2 ml' },
      },
      {
        id: 'patte-zinc-noue', name: 'Pattes zinc (fixes + coulissantes)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'etain-soudure-zinguerie', name: 'Étain soudure',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.02, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte',
      },
      {
        id: 'bande-porte-solin', name: 'Bande porte-solin (raccord mur)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        optional: true,
        condition: 'Si noue contre un mur (mitoyen / souche cheminée)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #8.4 HABILLAGES (solins + couronnement + chapeaux)
  // ══════════════════════════════════════════════════════════
  {
    id: 'habillage-zinguerie',
    name: 'Habillages zinguerie (solins, couronnement, chapeaux)',
    description: 'Ensemble compléments zinguerie par ouvrage : solin cheminée, chapeau, couronnement acrotère.',
    trade: 'zinguerie',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 40.5 (Juin 2018)', title: 'Évacuation EP' },
      { code: 'NF DTU 40.41 (Février 2023)', title: 'Zinc joint debout / solins' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = 1 ensemble d\'habillage (1 cheminée / 1 lucarne / 1 pénétration)',
      'Solin zinc ≈ 4 ml en moyenne par pénétration',
      'Chapeau cheminée 1 u par conduit',
      'Couronnement acrotère : au linéaire, à gérer séparément',
      'Bandes EPDM complémentaires pour étanchéité',
    ],
    materials: [
      {
        id: 'solin-zinc', name: 'Solin zinc pré-formé (4 ml moyen par pénétration)',
        category: 'plaque', phase: 'principal', quantityPerBase: 4, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes sur mesure',
        dtu: 'NF DTU 40.5',
      },
      {
        id: 'chapeau-cheminee-zinc', name: 'Chapeau cheminée zinc (anti-pluie/anti-vent)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'bande-etancheite-epdm', name: 'Bande étanchéité EPDM (complément solin)',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 4, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'etain-soudure-zinguerie', name: 'Étain soudure',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.05, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte',
      },
      {
        id: 'vis-tetalu-inox', name: 'Vis tête alu inox (fixation solins)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 20, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
    ],
  },
]
