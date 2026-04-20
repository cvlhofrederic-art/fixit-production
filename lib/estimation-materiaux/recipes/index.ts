import { Recipe, Country } from '../types';
// ══════════════════════════════════════════════════════════════════════════
//  ISOLATION FILESYSTEM — recipes/fr/ et recipes/pt/ strictement séparés.
//  Test d'isolation : tests/estimation-materiaux-isolation.test.ts
//  vérifie qu'aucun import croisé n'existe entre fr/ et pt/.
// ══════════════════════════════════════════════════════════════════════════
import { maconnerieRecipes } from './fr/maconnerie';
import { placoRecipes } from './fr/placo';
import { peintureRecipes } from './fr/peinture';
import { carrelageRecipes } from './fr/carrelage';
import { plomberieRecipes } from './fr/plomberie';
import { couvertureRecipes } from './fr/couverture';
import { menuiseriesExtRecipes } from './fr/menuiseries-ext';
import { electriciteRecipes } from './fr/electricite';
import { betonBancheRecipes } from './fr/beton-banche';
import { charpenteRecipes } from './fr/charpente';
import { zingerieRecipes } from './fr/zinguerie';
import { etancheiteRecipes } from './fr/etancheite';
import { isolationRecipes } from './fr/isolation';
import { facadeBardageRecipes } from './fr/facade-bardage';
import { menuiseriesIntRecipes } from './fr/menuiseries-int';
import { revetementsSolsRecipes } from './fr/revetements-sols';
import { revetementsMurauxRecipes } from './fr/revetements-muraux';
import { chauffageRecipes } from './fr/chauffage';
import { ventilationRecipes } from './fr/ventilation';
import { climatisationRecipes } from './fr/climatisation';
import { vrdRecipes } from './fr/vrd';
import { assainissementRecipes } from './fr/assainissement';
import { electriciteCfaRecipes } from './fr/electricite-cfa';
import { voirieExterieureRecipes } from './fr/voirie-exterieure';
import { cloturesPortailsRecipes } from './fr/clotures-portails';
import { terrasseExterieureRecipes } from './fr/terrasse-exterieure';
import { jardinRecipes } from './fr/jardin';
import { piscineRecipes } from './fr/piscine';

// ── Recettes PT (20 recettes écrites à la main en pt-PT) ────────────
import { allPtRecipes } from './pt';

/**
 * Normalise le pays d'une recette : défaut 'FR' si absent (recettes historiques).
 * Garantit qu'à la sortie, `recipe.country` est toujours défini.
 */
function withCountry(recipe: Recipe, fallback: Country): Recipe {
  return recipe.country ? recipe : { ...recipe, country: fallback };
}

const frRecipesRaw: Recipe[] = [
  ...maconnerieRecipes,
  ...placoRecipes,
  ...peintureRecipes,
  ...carrelageRecipes,
  ...plomberieRecipes,
  ...couvertureRecipes,
  ...menuiseriesExtRecipes,
  ...electriciteRecipes,
  ...betonBancheRecipes,
  ...charpenteRecipes,
  ...zingerieRecipes,
  ...etancheiteRecipes,
  ...isolationRecipes,
  ...facadeBardageRecipes,
  ...menuiseriesIntRecipes,
  ...revetementsSolsRecipes,
  ...revetementsMurauxRecipes,
  ...chauffageRecipes,
  ...ventilationRecipes,
  ...climatisationRecipes,
  ...vrdRecipes,
  ...assainissementRecipes,
  ...electriciteCfaRecipes,
  ...voirieExterieureRecipes,
  ...cloturesPortailsRecipes,
  ...terrasseExterieureRecipes,
  ...jardinRecipes,
  ...piscineRecipes,
];

const ptRecipesRaw: Recipe[] = allPtRecipes;

export const allRecipes: Recipe[] = [
  ...frRecipesRaw.map(r => withCountry(r, 'FR')),
  ...ptRecipesRaw.map(r => withCountry(r, 'PT')),
];

export const recipeRegistry: Record<string, Recipe> = allRecipes.reduce(
  (acc, r) => { acc[r.id] = r; return acc; },
  {} as Record<string, Recipe>
);

export function getRecipesByTrade(trade: Recipe['trade']): Recipe[] {
  return allRecipes.filter(r => r.trade === trade);
}

/**
 * Filtre par pays. Isolation stricte : une recette FR ne remonte JAMAIS sur un projet PT
 * et inversement. Utilisé par la UI (filtre selon locale) et le prompt IA (whitelist IDs).
 */
export function getRecipesByCountry(country: Country): Recipe[] {
  return allRecipes.filter(r => r.country === country);
}

export function getRecipesByTradeAndCountry(
  trade: Recipe['trade'],
  country: Country,
): Recipe[] {
  return allRecipes.filter(r => r.trade === trade && r.country === country);
}

export function searchRecipes(query: string, country?: Country): Recipe[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const scope = country ? allRecipes.filter(r => r.country === country) : allRecipes;
  return scope.filter(r =>
    r.name.toLowerCase().includes(q) ||
    r.description?.toLowerCase().includes(q) ||
    r.id.toLowerCase().includes(q)
  );
}

export {
  maconnerieRecipes,
  placoRecipes,
  peintureRecipes,
  carrelageRecipes,
  plomberieRecipes,
  couvertureRecipes,
  menuiseriesExtRecipes,
  electriciteRecipes,
  betonBancheRecipes,
  charpenteRecipes,
  zingerieRecipes,
  etancheiteRecipes,
  isolationRecipes,
  facadeBardageRecipes,
  menuiseriesIntRecipes,
  revetementsSolsRecipes,
  revetementsMurauxRecipes,
  chauffageRecipes,
  ventilationRecipes,
  climatisationRecipes,
  vrdRecipes,
  assainissementRecipes,
  electriciteCfaRecipes,
  voirieExterieureRecipes,
  cloturesPortailsRecipes,
  terrasseExterieureRecipes,
  jardinRecipes,
  piscineRecipes,
};
