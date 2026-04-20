import { z } from 'zod';

/**
 * ============================================================
 *  TYPES v2 — ESTIMATION MATÉRIAUX
 *  
 *  Nouveautés v2 :
 *  - Chaque matériau porte explicitement son DTU de référence
 *  - wasteReason : justification textuelle de la perte
 *  - thickness devient un PARAMÈTRE de recette (pas de la géométrie)
 *    pour les ouvrages m² dont le matériau dépend de l'épaisseur
 *  - chantierProfile : bonus de perte contextuel (difficulté, taille, etc.)
 * ============================================================
 */

export const PhysicalUnitSchema = z.enum([
  'kg', 't', 'g',
  'L', 'm3',
  'm2',
  'ml',
  'u', 'sac', 'rouleau', 'pot', 'tube', 'cartouche', 'panneau',
]);
export type PhysicalUnit = z.infer<typeof PhysicalUnitSchema>;

// ─── GÉOMÉTRIE D'ENTRÉE ────────────────────────────────────
export const GeometrySchema = z.object({
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  thickness: z.number().positive().optional(),
  area: z.number().positive().optional(),
  volume: z.number().positive().optional(),
  perimeter: z.number().positive().optional(),
  count: z.number().int().positive().optional(),
  coats: z.number().int().positive().optional(),
  tileFormatCm: z.tuple([z.number(), z.number()]).optional(),
  openings: z.number().nonnegative().optional(),
});
export type Geometry = z.infer<typeof GeometrySchema>;

// ─── PROFIL CHANTIER (bonus de pertes contextuels) ─────────
export const ChantierProfileSchema = z.object({
  difficulty: z.enum(['facile', 'standard', 'difficile']).default('standard'),
  size: z.enum(['petit', 'moyen', 'grand']).default('moyen'),  // <10m², 10-100, >100
  workforceLevel: z.enum(['experimente', 'mixte', 'apprenti']).default('mixte'),
  complexShapes: z.boolean().default(false),
  isPistoletPainting: z.boolean().default(false),  // peinture au pistolet → pertes +
});
export type ChantierProfile = z.infer<typeof ChantierProfileSchema>;

// ─── MATÉRIAU DANS UNE RECETTE ─────────────────────────────

export const MaterialCategorySchema = z.enum([
  'liant', 'granulat', 'eau', 'adjuvant',
  'acier', 'bois',
  'bloc', 'brique', 'plaque',
  'ossature', 'fixation', 'accessoire',
  'isolant', 'etancheite',
  'colle', 'joint', 'enduit', 'peinture', 'primaire',
  'carreau', 'outillage',
  'autre',
]);
export type MaterialCategory = z.infer<typeof MaterialCategorySchema>;

/**
 * Phase d'un matériau dans le cycle d'exécution de l'ouvrage :
 * - preparation : travaux amont (support, hérisson, primaire, ragréage…)
 * - principal   : matériau porteur de l'ouvrage (béton, parpaing, carreau…)
 * - accessoires : fixations, joints, adjuvants, cure, croisillons…
 * - finitions   : cycle final (hydrofuge, vernis, joint de façade…)
 */
export const MaterialPhaseSchema = z.enum(['preparation', 'principal', 'accessoires', 'finitions']);
export type MaterialPhase = z.infer<typeof MaterialPhaseSchema>;

export const RecipeMaterialSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: MaterialCategorySchema,
  /** Phase du cycle d'exécution. Si omis, traité comme 'principal'. */
  phase: MaterialPhaseSchema.optional(),
  /** Quantité par unité de base (m², m³, ml, u) */
  quantityPerBase: z.number().positive(),
  unit: PhysicalUnitSchema,
  /**
   * Si le ratio dépend d'un paramètre géométrique (ex: épaisseur dalle),
   * multiplicateur à appliquer.
   */
  geometryMultiplier: z.enum(['thickness', 'height', 'coats', 'perimeter', 'none']).default('none'),
  /** Coefficient de perte : 1.05 = 5% */
  wasteFactor: z.number().min(1).max(2).default(1.05),
  /** Justification textuelle de la perte (affichée à l'artisan) */
  wasteReason: z.string(),
  /** Source normative précise : DTU, norme, fiche fabricant */
  dtu: z.string().optional(),          // "DTU 21 § 6.2"
  normRef: z.string().optional(),      // "NF EN 206"
  manufacturerRef: z.string().optional(), // "Lafarge - Béton 350 kg/m³"
  /** Conditionnement de vente */
  packaging: z.object({
    unit: PhysicalUnitSchema,
    contentQty: z.number().positive(),
    contentUnit: PhysicalUnitSchema,
    label: z.string(),
  }).optional(),
  notes: z.string().optional(),
  /**
   * Matériau optionnel : non inclus par défaut, l'IA ou l'utilisateur
   * peut le rajouter si sa `condition` s'applique (ex: RE2020, zone humide).
   * Si omis, traité comme false.
   */
  optional: z.boolean().optional(),
  /** Si optional=true : quand inclure ce matériau (affiché à l'utilisateur). */
  condition: z.string().optional(),
});
export type RecipeMaterial = z.infer<typeof RecipeMaterialSchema>;

// ─── RECETTE ────────────────────────────────────────────────

export const RecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  trade: z.enum([
    // Existants initiaux
    'maconnerie', 'placo', 'peinture', 'carrelage',
    // Extensions audit 28 trades (avril 2026)
    'charpente', 'couverture', 'zinguerie',
    'etancheite', 'isolation', 'facade',
    'menuiserie_ext', 'menuiserie_int',
    'revetement_sol', 'revetement_mural',
    'plomberie', 'chauffage', 'ventilation', 'climatisation',
    'electricite', 'electricite_cfa',
    'vrd', 'assainissement',
    'cloture', 'terrasse_ext', 'jardin', 'piscine',
  ]),
  baseUnit: z.enum(['m3', 'm2', 'ml', 'u']),
  geometryMode: z.enum([
    'volume',
    'area',
    'area_minus_openings',
    'length',
    'count',
  ]),
  materials: z.array(RecipeMaterialSchema).min(1),
  constraints: z.object({
    minThickness: z.number().optional(),
    maxThickness: z.number().optional(),
    minArea: z.number().optional(),
    maxHeight: z.number().optional(),
    note: z.string().optional(),
  }).optional(),
  /** DTU principaux de l'ouvrage (listés dans l'UI) */
  dtuReferences: z.array(z.object({
    code: z.string(),         // "DTU 21"
    title: z.string(),        // "Exécution des ouvrages en béton"
    section: z.string().optional(),
  })),
  /**
   * Hypothèses que l'IA (ou l'estimateur) doit communiquer à l'artisan
   * pour que le devis soit complet et auditable.
   * Ex: "Hérisson 20 cm supposé, à adapter selon portance sol"
   */
  hypothesesACommuniquer: z.array(z.string()).optional(),
  version: z.string().default('2.0.0'),
});
export type Recipe = z.infer<typeof RecipeSchema>;

// ─── INPUT ─────────────────────────────────────────────────

export const EstimationItemSchema = z.object({
  recipeId: z.string(),
  geometry: GeometrySchema,
  extraWaste: z.number().min(0).max(1).optional(),
  label: z.string().optional(),
});
export type EstimationItem = z.infer<typeof EstimationItemSchema>;

export const EstimationInputSchema = z.object({
  projectName: z.string().optional(),
  items: z.array(EstimationItemSchema).min(1),
  chantierProfile: ChantierProfileSchema.optional(),
});
export type EstimationInput = z.infer<typeof EstimationInputSchema>;

// ─── RÉSULTAT ──────────────────────────────────────────────

export const MaterialNeedSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: MaterialCategorySchema,
  phase: MaterialPhaseSchema,
  optional: z.boolean(),
  condition: z.string().optional(),
  theoreticalQuantity: z.number(),
  quantityWithWaste: z.number(),
  unit: PhysicalUnitSchema,
  /** Détail des pertes appliquées (transparence totale pour l'artisan) */
  wasteBreakdown: z.object({
    baseWastePercent: z.number(),       // % perte de base
    baseWasteReason: z.string(),        // "Recouvrement 2 mailles ADETS"
    profileBonusPercent: z.number(),    // % perte supplémentaire profil
    profileBonusReason: z.string().optional(),
    totalPercent: z.number(),            // % total appliqué
  }),
  packagingRecommendation: z.object({
    unitsToOrder: z.number(),
    packagingLabel: z.string(),
    totalContent: z.number(),
  }).optional(),
  /** Toutes les références normatives (DTU, normes) qui s'appliquent */
  references: z.array(z.string()),
  contributingItems: z.array(z.string()),
});
export type MaterialNeed = z.infer<typeof MaterialNeedSchema>;

export const EstimationResultSchema = z.object({
  projectName: z.string().optional(),
  computedAt: z.string(),
  chantierProfile: ChantierProfileSchema.optional(),
  items: z.array(z.object({
    recipeId: z.string(),
    recipeName: z.string(),
    label: z.string().optional(),
    geometry: GeometrySchema,
    baseQuantity: z.number(),
    baseUnit: z.string(),
    dtuReferences: z.array(z.object({
      code: z.string(),
      title: z.string(),
      section: z.string().optional(),
    })),
    materials: z.array(MaterialNeedSchema),
    warnings: z.array(z.string()),
    hypotheses: z.array(z.string()).default([]),
  })),
  aggregated: z.array(MaterialNeedSchema),
  warnings: z.array(z.string()),
  /** Hypothèses consolidées (union des hypothèses des recettes utilisées) */
  hypothesesACommuniquer: z.array(z.string()).default([]),
  /** Résumé lisible pour l'artisan */
  humanSummary: z.array(z.string()),
});
export type EstimationResult = z.infer<typeof EstimationResultSchema>;
