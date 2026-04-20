import type { Country, Recipe } from '../types'

/**
 * Runtime guard — bloque tout mélange FR/PT à l'entrée de l'API.
 * Si un utilisateur PT envoie un recipeId FR (ou inversement), on refuse.
 * Préférable à une erreur silencieuse qui enverrait des DTU NF à un artisan PT.
 */
export class CountryMismatchError extends Error {
  constructor(
    public readonly expectedCountry: Country,
    public readonly recipeId: string,
    public readonly recipeCountry: Country | undefined,
  ) {
    super(
      `Isolation pays : recette "${recipeId}" (${recipeCountry ?? 'non renseigné'}) `
      + `incompatible avec le projet (${expectedCountry}).`
    )
    this.name = 'CountryMismatchError'
  }
}

export function assertSameCountry(
  expectedCountry: Country,
  recipes: Array<Pick<Recipe, 'id' | 'country'>>,
): void {
  for (const r of recipes) {
    if (r.country !== expectedCountry) {
      throw new CountryMismatchError(expectedCountry, r.id, r.country)
    }
  }
}

export function filterByCountry<T extends { country?: Country }>(
  items: T[],
  country: Country,
): T[] {
  return items.filter(r => r.country === country)
}
