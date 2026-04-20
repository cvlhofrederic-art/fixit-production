import type { Recipe } from '../../types'

/**
 * REVÊTEMENTS DE SOL — audit #15
 *
 * Référentiels FR :
 * - NF DTU 52.1   Revêtements de sol scellés (grès, pierre)
 * - NF DTU 52.2   Revêtements céramiques collés (cf. carrelage.ts)
 * - NF DTU 53.1   Revêtements textile (moquette)
 * - NF DTU 53.2   Revêtements PVC / linoléum
 * - NF DTU 54.1   Revêtements coulés (résine)
 * - NF DTU 51.11  Parquet flottant (cf. menuiseries-int.ts)
 *
 * Note : carrelage + parquet sont dans leurs trades respectifs.
 * Ce fichier couvre PVC, moquette, béton ciré, résine.
 */

export const revetementsSolsRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #15.2 SOL PVC / LINO (en lé ou dalles)
  // ══════════════════════════════════════════════════════════
  {
    id: 'sol-pvc-le-colle',
    name: 'Sol PVC en lé collé (Tarkett / Gerflor / Forbo)',
    description: 'Revêtement PVC grande largeur (2 ou 4 m) posé collé sur ragréage. Plinthes PVC assorties.',
    trade: 'revetement_sol',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 53.2 (Juillet 2018)', title: 'Revêtements PVC' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Lé PVC grande largeur 2 ou 4 m (moins de joints)',
      'Ragréage autolissant obligatoire si planéité support > 5 mm / 2 m',
      'Primaire d\'accrochage avant ragréage',
      'Colle PVC acrylique (C2) ou vinyle (C5) selon trafic',
      'Plinthes PVC assorties au périmètre (recommandé)',
      'Soudure à chaud des joints si local humide/hospitalier',
    ],
    materials: [
      // ═══ PRÉPARATION ═══
      {
        id: 'primaire-accrochage-sol-pvc', name: 'Primaire d\'accrochage (avant ragréage)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac',
        packaging: { unit: 'pot', contentQty: 5, contentUnit: 'L', label: 'bidon 5 L' },
      },
      {
        id: 'ragreage-autolissant-pvc', name: 'Ragréage autolissant P3',
        category: 'enduit', phase: 'preparation', quantityPerBase: 5, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Résidus',
        dtu: 'NF DTU 53.2',
        manufacturerRef: 'Weber Niv Lex / Mapei Ultraplan',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
        optional: true,
        condition: 'Si planéité support > 5 mm / 2 m',
      },
      // ═══ PRINCIPAL ═══
      {
        id: 'revetement-pvc-le', name: 'Sol PVC en lé (Tarkett / Gerflor / Forbo)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Chutes lés',
        dtu: 'NF DTU 53.2',
        manufacturerRef: 'Tarkett / Gerflor / Forbo',
      },
      {
        id: 'colle-pvc-sol', name: 'Colle PVC (acrylique ou vinyle)',
        category: 'colle', phase: 'principal', quantityPerBase: 0.4, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Résidus',
        packaging: { unit: 'u', contentQty: 20, contentUnit: 'kg', label: 'seau 20 kg' },
      },
      // ═══ ACCESSOIRES ═══
      {
        id: 'plinthe-pvc-assortie', name: 'Plinthes PVC assorties (hauteur 6 cm)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1.1, unit: 'ml', geometryMultiplier: 'perimeter',
        wasteFactor: 1.10, wasteReason: 'Coupes angles',
      },
      {
        id: 'profil-seuil-pvc', name: 'Profils de seuil / raccord (entre pièces)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.05, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
      // ═══ FINITIONS ═══
      {
        id: 'emulsion-entretien-pvc', name: 'Émulsion d\'entretien protectrice',
        category: 'adjuvant', phase: 'finitions', quantityPerBase: 0.05, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Application',
        optional: true,
        condition: 'Recommandé locaux à passage intensif',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #15.3 MOQUETTE
  // ══════════════════════════════════════════════════════════
  {
    id: 'moquette-colle',
    name: 'Moquette collée (aiguilletée ou vélomée)',
    description: 'Moquette LDF en rouleau 4 m largeur. Pose collée sur ragréage. Plinthes assorties.',
    trade: 'revetement_sol',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 53.1 (Mai 2019)', title: 'Revêtements textile moquette' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Moquette rouleau 4 m (standard)',
      'Pose collée (durabilité) ou tendue avec bande bi-adhésive (rénovation rapide)',
      'Ragréage si planéité support insuffisante',
      'Plinthes bois/PVC au périmètre',
    ],
    materials: [
      {
        id: 'primaire-accrochage-moquette', name: 'Primaire d\'accrochage (si support absorbant)',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.1, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac',
      },
      {
        id: 'moquette-ldf', name: 'Moquette LDF (rouleau 4 m)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes',
        dtu: 'NF DTU 53.1',
      },
      {
        id: 'colle-moquette', name: 'Colle moquette',
        category: 'colle', phase: 'principal', quantityPerBase: 0.3, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Résidus',
        packaging: { unit: 'u', contentQty: 15, contentUnit: 'kg', label: 'seau 15 kg' },
      },
      {
        id: 'plinthe-bois-moquette', name: 'Plinthes bois ou PVC',
        category: 'bois', phase: 'accessoires', quantityPerBase: 1.1, unit: 'ml', geometryMultiplier: 'perimeter',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'profil-seuil-moquette', name: 'Profils de seuil',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.05, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #15.5 BÉTON CIRÉ
  // ══════════════════════════════════════════════════════════
  {
    id: 'beton-cire-sol',
    name: 'Béton ciré de sol (2 passes + cire)',
    description: 'Mortier béton ciré appliqué en 2 passes sur primaire + chape support. Vernis ou cire protection finale.',
    trade: 'revetement_sol',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 54.1 (Mai 2017)', title: 'Revêtements coulés (référence)' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Chape fibrée de support + ragréage (épaisseur 3-5 mm final)',
      'Primaire spécifique béton ciré',
      'Mortier béton ciré 2 passes (première de remplissage + seconde de finition)',
      'Cire ou vernis PU de protection finale',
      'Pigment pour teinte uniforme (optionnel)',
    ],
    materials: [
      {
        id: 'chape-fibree-beton-cire', name: 'Chape fibrée support',
        category: 'liant', phase: 'preparation', quantityPerBase: 10, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Résidus',
        packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
      },
      {
        id: 'primaire-beton-cire', name: 'Primaire béton ciré',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.2, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac',
      },
      {
        id: 'mortier-beton-cire', name: 'Mortier béton ciré (2 passes)',
        category: 'enduit', phase: 'principal', quantityPerBase: 4, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Taloche + rebouchage',
        manufacturerRef: 'Mercadier / Beton.mat',
        packaging: { unit: 'sac', contentQty: 12, contentUnit: 'kg', label: 'kit 12 kg' },
      },
      {
        id: 'cire-vernis-beton-cire', name: 'Cire ou vernis PU (protection finale)',
        category: 'peinture', phase: 'finitions', quantityPerBase: 0.2, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Application',
      },
      {
        id: 'pigment-beton-cire', name: 'Pigment teinte uniforme',
        category: 'adjuvant', phase: 'principal', quantityPerBase: 0.05, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Dosage précis',
        optional: true,
        condition: 'Si teinte spécifique demandée',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #15.6 RÉSINE ÉPOXY / POLYURÉTHANE
  // ══════════════════════════════════════════════════════════
  {
    id: 'resine-pu-sol',
    name: 'Résine polyuréthane (atelier / industriel)',
    description: 'Revêtement résine PU bicomposant sur primaire. Durable, chimique-résistant. Typique atelier/garage pro.',
    trade: 'revetement_sol',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 54.1 (Mai 2017)', title: 'Revêtements coulés' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Résine polyuréthane (alternative époxy)',
      'Primaire d\'accrochage spécial résine',
      'Application 1 ou 2 couches selon épaisseur requise',
      'Décor (paillettes, quartz) optionnel pour antidérapant',
      'Vernis UV de protection finition',
    ],
    materials: [
      {
        id: 'primaire-resine', name: 'Primaire d\'accrochage spécial résine',
        category: 'primaire', phase: 'preparation', quantityPerBase: 0.15, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Bac',
      },
      {
        id: 'resine-pu', name: 'Résine polyuréthane bicomposant',
        category: 'peinture', phase: 'principal', quantityPerBase: 1, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Résidus mélange',
        dtu: 'NF DTU 54.1',
        manufacturerRef: 'Sika Sikafloor / Mapei Mapefloor',
      },
      {
        id: 'decor-quartz-resine', name: 'Décor quartz ou paillettes (antidérapant)',
        category: 'granulat', phase: 'principal', quantityPerBase: 0.3, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Saupoudrage',
        optional: true,
        condition: 'Si usage industriel / antidérapant requis',
      },
      {
        id: 'vernis-uv-resine', name: 'Vernis UV de finition',
        category: 'peinture', phase: 'finitions', quantityPerBase: 0.25, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Application',
      },
    ],
  },
]
