import { Recipe } from '../types';
import { maconnerieRecipes } from './maconnerie';
import { placoRecipes } from './placo';
import { peintureRecipes } from './peinture';
import { carrelageRecipes } from './carrelage';
import { plomberieRecipes } from './plomberie';
import { couvertureRecipes } from './couverture';
import { menuiseriesExtRecipes } from './menuiseries-ext';
import { electriciteRecipes } from './electricite';

export const allRecipes: Recipe[] = [
  ...maconnerieRecipes,
  ...placoRecipes,
  ...peintureRecipes,
  ...carrelageRecipes,
  ...plomberieRecipes,
  ...couvertureRecipes,
  ...menuiseriesExtRecipes,
  ...electriciteRecipes,
];

export const recipeRegistry: Record<string, Recipe> = allRecipes.reduce(
  (acc, r) => { acc[r.id] = r; return acc; },
  {} as Record<string, Recipe>
);

export function getRecipesByTrade(trade: Recipe['trade']): Recipe[] {
  return allRecipes.filter(r => r.trade === trade);
}

export function searchRecipes(query: string): Recipe[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return allRecipes.filter(r =>
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
};
