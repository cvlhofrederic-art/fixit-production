import {
  EstimationInput, EstimationResult, Recipe, Geometry,
  MaterialNeed, RecipeMaterial, ChantierProfile,
} from '../types';

/**
 * ============================================================
 *  MOTEUR v2 — corrigé et audité
 *  
 *  Corrections majeures :
 *  - Multiplicateur géométrique (thickness, height) 
 *  - Bonus de pertes selon profil chantier (transparent)
 *  - Agrégation avec recalcul PROPRE du conditionnement
 *  - Sortie humanSummary lisible
 * ============================================================
 */

// ─── BONUS DE PERTES PAR PROFIL ─────────────────────────────

export function computeProfileWasteBonus(
  profile: ChantierProfile | undefined,
  category: RecipeMaterial['category']
): { bonus: number; reasons: string[] } {
  if (!profile) return { bonus: 0, reasons: [] };
  let bonus = 0;
  const reasons: string[] = [];

  if (profile.difficulty === 'difficile') {
    bonus += 0.05;
    reasons.push('+5% chantier difficile (accès, exiguïté)');
  }
  if (profile.size === 'petit') {
    bonus += 0.05;
    reasons.push('+5% petit chantier (<10 m², arrondis conditionnement)');
  }
  if (profile.workforceLevel === 'apprenti') {
    bonus += 0.05;
    reasons.push('+5% équipe peu expérimentée');
  }
  if (profile.complexShapes) {
    bonus += 0.03;
    reasons.push('+3% formes complexes (angles, ouvertures multiples)');
  }
  // Pistolet : pertes peinture spécifiques
  if (profile.isPistoletPainting && category === 'peinture') {
    bonus += 0.10;
    reasons.push('+10% application au pistolet (brume, rebonds)');
  }

  return { bonus, reasons };
}

// ─── RÉSOLUTION GÉOMÉTRIE ──────────────────────────────────

export function resolveBaseQuantity(recipe: Recipe, geo: Geometry): {
  quantity: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  switch (recipe.geometryMode) {
    case 'volume':
      if (geo.volume !== undefined) return { quantity: geo.volume, warnings };
      if (geo.length && geo.width && geo.thickness)
        return { quantity: geo.length * geo.width * geo.thickness, warnings };
      if (geo.area && geo.thickness)
        return { quantity: geo.area * geo.thickness, warnings };
      throw new Error(`Géométrie insuffisante pour "${recipe.name}" : longueur+largeur+épaisseur, ou surface+épaisseur, ou volume requis.`);

    case 'area':
      if (geo.area !== undefined) return { quantity: geo.area, warnings };
      if (geo.length && geo.width) return { quantity: geo.length * geo.width, warnings };
      if (geo.length && geo.height) return { quantity: geo.length * geo.height, warnings };
      throw new Error(`Géométrie insuffisante pour "${recipe.name}" : surface ou longueur×hauteur requis.`);

    case 'area_minus_openings': {
      let area: number;
      if (geo.area !== undefined) area = geo.area;
      else if (geo.length && geo.height) area = geo.length * geo.height;
      else if (geo.length && geo.width) area = geo.length * geo.width;
      else throw new Error(`Géométrie insuffisante pour "${recipe.name}".`);
      const openings = geo.openings ?? 0;
      const net = area - openings;
      if (net <= 0) throw new Error(`Ouvertures (${openings}m²) ≥ surface (${area}m²).`);
      if (openings / area > 0.4)
        warnings.push(`Ouvertures = ${Math.round((openings / area) * 100)}% de la surface — vérifier.`);
      return { quantity: net, warnings };
    }

    case 'length':
      if (geo.length !== undefined) return { quantity: geo.length, warnings };
      if (geo.perimeter !== undefined) return { quantity: geo.perimeter, warnings };
      throw new Error(`Géométrie insuffisante pour "${recipe.name}" : longueur requise.`);

    case 'count':
      if (geo.count !== undefined) return { quantity: geo.count, warnings };
      throw new Error(`Géométrie insuffisante pour "${recipe.name}" : nombre requis.`);
  }
}

// ─── MULTIPLICATEUR GÉOMÉTRIQUE ────────────────────────────

function applyGeometryMultiplier(
  mat: RecipeMaterial,
  geo: Geometry
): { multiplier: number; warnings: string[] } {
  const warnings: string[] = [];
  switch (mat.geometryMultiplier) {
    case 'thickness':
      if (geo.thickness === undefined) {
        warnings.push(`Matériau "${mat.name}" dépend de l'épaisseur mais non fournie — utilisé sans multiplicateur.`);
        return { multiplier: 1, warnings };
      }
      return { multiplier: geo.thickness, warnings };
    case 'height':
      if (geo.height === undefined) return { multiplier: 1, warnings };
      return { multiplier: geo.height, warnings };
    case 'coats':
      return { multiplier: geo.coats ?? 1, warnings };
    case 'none':
    default:
      return { multiplier: 1, warnings };
  }
}

// ─── CHECK CONTRAINTES ─────────────────────────────────────

export function checkConstraints(recipe: Recipe, geo: Geometry): string[] {
  const warnings: string[] = [];
  const c = recipe.constraints;
  if (!c) return warnings;
  if (c.minThickness !== undefined && geo.thickness !== undefined && geo.thickness < c.minThickness) {
    warnings.push(`Épaisseur ${geo.thickness * 100}cm < minimum ${c.minThickness * 100}cm pour "${recipe.name}".`);
  }
  if (c.maxThickness !== undefined && geo.thickness !== undefined && geo.thickness > c.maxThickness) {
    warnings.push(`Épaisseur ${geo.thickness * 100}cm > maximum ${c.maxThickness * 100}cm — ouvrage atypique.`);
  }
  if (c.minArea !== undefined && geo.area !== undefined && geo.area < c.minArea) {
    warnings.push(`Surface ${geo.area}m² < minimum ${c.minArea}m² — ratios moins fiables.`);
  }
  if (c.maxHeight !== undefined && geo.height !== undefined && geo.height > c.maxHeight) {
    warnings.push(`Hauteur ${geo.height}m > max ${c.maxHeight}m — ouvrage hors standard.`);
  }
  return warnings;
}

// ─── CALCUL MATÉRIAU (CORRIGÉ) ─────────────────────────────

export function computeMaterial(
  mat: RecipeMaterial,
  baseQuantity: number,
  geometry: Geometry,
  profile: ChantierProfile | undefined,
  extraWaste: number = 0
): { need: MaterialNeed; warnings: string[] } {
  const warnings: string[] = [];
  const { multiplier, warnings: mw } = applyGeometryMultiplier(mat, geometry);
  warnings.push(...mw);

  const theoretical = baseQuantity * mat.quantityPerBase * multiplier;

  const profileWaste = computeProfileWasteBonus(profile, mat.category);
  const baseWastePercent = (mat.wasteFactor - 1) * 100;
  const totalMultiplier = mat.wasteFactor * (1 + extraWaste) * (1 + profileWaste.bonus);
  const totalPercent = (totalMultiplier - 1) * 100;
  const withWaste = theoretical * totalMultiplier;

  const references: string[] = [];
  if (mat.dtu) references.push(mat.dtu);
  if (mat.normRef) references.push(mat.normRef);
  if (mat.manufacturerRef) references.push(mat.manufacturerRef);

  const need: MaterialNeed = {
    id: mat.id,
    name: mat.name,
    category: mat.category,
    theoreticalQuantity: round(theoretical, 3),
    quantityWithWaste: round(withWaste, 3),
    unit: mat.unit,
    wasteBreakdown: {
      baseWastePercent: round(baseWastePercent, 1),
      baseWasteReason: mat.wasteReason,
      profileBonusPercent: round(profileWaste.bonus * 100, 1),
      profileBonusReason: profileWaste.reasons.join(' · ') || undefined,
      totalPercent: round(totalPercent, 1),
    },
    references,
    contributingItems: [],
  };

  if (mat.packaging && mat.packaging.contentUnit === mat.unit) {
    const units = Math.ceil(withWaste / mat.packaging.contentQty);
    need.packagingRecommendation = {
      unitsToOrder: units,
      packagingLabel: mat.packaging.label,
      totalContent: round(units * mat.packaging.contentQty, 2),
    };
  }
  return { need, warnings };
}

// ─── AGRÉGATION ────────────────────────────────────────────

export function aggregateNeeds(allNeeds: MaterialNeed[], perUnitContent: Map<string, number>): MaterialNeed[] {
  const map = new Map<string, MaterialNeed>();

  for (const n of allNeeds) {
    const key = `${n.id}__${n.unit}`;
    const existing = map.get(key);
    if (existing) {
      existing.theoreticalQuantity = round(existing.theoreticalQuantity + n.theoreticalQuantity, 3);
      existing.quantityWithWaste = round(existing.quantityWithWaste + n.quantityWithWaste, 3);
      existing.references = Array.from(new Set([...existing.references, ...n.references]));
      existing.contributingItems = Array.from(new Set([...existing.contributingItems, ...n.contributingItems]));
    } else {
      map.set(key, { ...n, contributingItems: [...n.contributingItems] });
    }
  }

  // Recalcul propre du packaging sur la somme
  for (const [key, need] of map.entries()) {
    const content = perUnitContent.get(key);
    if (content && need.packagingRecommendation) {
      const units = Math.ceil(need.quantityWithWaste / content);
      need.packagingRecommendation = {
        unitsToOrder: units,
        packagingLabel: need.packagingRecommendation.packagingLabel,
        totalContent: round(units * content, 2),
      };
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });
}

// ─── FONCTION PRINCIPALE ───────────────────────────────────

export function estimateProject(
  input: EstimationInput,
  recipeRegistry: Record<string, Recipe>
): EstimationResult {
  const resultItems: EstimationResult['items'] = [];
  const globalWarnings: string[] = [];
  const allNeeds: MaterialNeed[] = [];
  // Pour l'agrégation, on garde la taille de conditionnement par matériau
  const perUnitContent = new Map<string, number>();

  for (const item of input.items) {
    const recipe = recipeRegistry[item.recipeId];
    if (!recipe) {
      globalWarnings.push(`Recette introuvable : "${item.recipeId}" — item ignoré.`);
      continue;
    }

    const itemWarnings = checkConstraints(recipe, item.geometry);
    let baseQty: number;
    try {
      const resolved = resolveBaseQuantity(recipe, item.geometry);
      baseQty = resolved.quantity;
      itemWarnings.push(...resolved.warnings);
    } catch (e) {
      globalWarnings.push(`[${item.label ?? recipe.name}] ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    const needs: MaterialNeed[] = [];
    for (const m of recipe.materials) {
      const { need, warnings: w } = computeMaterial(
        m, baseQty, item.geometry, input.chantierProfile, item.extraWaste ?? 0
      );
      need.contributingItems = [item.label ?? recipe.name];
      needs.push(need);
      itemWarnings.push(...w);
      // Mémoriser le conditionnement pour agrégation
      if (m.packaging) {
        perUnitContent.set(`${m.id}__${m.unit}`, m.packaging.contentQty);
      }
    }
    allNeeds.push(...needs);

    resultItems.push({
      recipeId: recipe.id,
      recipeName: recipe.name,
      label: item.label,
      geometry: item.geometry,
      baseQuantity: round(baseQty, 3),
      baseUnit: recipe.baseUnit,
      dtuReferences: recipe.dtuReferences,
      materials: needs,
      warnings: itemWarnings,
    });
  }

  const aggregated = aggregateNeeds(allNeeds, perUnitContent);

  return {
    projectName: input.projectName,
    computedAt: new Date().toISOString(),
    chantierProfile: input.chantierProfile,
    items: resultItems,
    aggregated,
    warnings: globalWarnings,
    humanSummary: buildHumanSummary(aggregated),
  };
}

// ─── GÉNÉRATION DU RÉSUMÉ LISIBLE ──────────────────────────

function buildHumanSummary(aggregated: MaterialNeed[]): string[] {
  return aggregated.map(m => {
    const qty = formatQuantity(m.quantityWithWaste, m.unit);
    const pack = m.packagingRecommendation
      ? ` → ${m.packagingRecommendation.unitsToOrder} × ${m.packagingRecommendation.packagingLabel}`
      : '';
    const refs = m.references.length > 0 ? ` (${m.references.join(' · ')})` : '';
    const waste = m.wasteBreakdown.totalPercent > 0
      ? ` [pertes +${m.wasteBreakdown.totalPercent}%]`
      : '';
    return `${m.name} : ${qty}${pack}${waste}${refs}`;
  });
}

function formatQuantity(qty: number, unit: string): string {
  if (unit === 'kg' && qty >= 1000) return `${(qty / 1000).toFixed(2)} t (${qty.toFixed(0)} kg)`;
  if (unit === 'L' && qty >= 100) return `${qty.toFixed(0)} L`;
  if (qty >= 100) return `${qty.toFixed(1)} ${unit}`;
  if (qty >= 10) return `${qty.toFixed(1)} ${unit}`;
  return `${qty.toFixed(2)} ${unit}`;
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
