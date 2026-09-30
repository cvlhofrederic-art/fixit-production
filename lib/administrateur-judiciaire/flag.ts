/**
 * Bascule de la succursale « Administrateur Judiciaire » (/administrateur-judiciaire).
 *
 *   ADMINISTRATEUR_JUDICIAIRE_LIVE = false → la route renvoie 404 en production,
 *   mais reste accessible en développement local (next dev) pour la recette.
 *   ADMINISTRATEUR_JUDICIAIRE_LIVE = true  → la route est servie en production.
 *
 * Totalement indépendante des flags syndic (lib/syndic/v54-flag.ts) : la succursale
 * se déploie et se retire sans toucher au logiciel Syndic.
 */
export const ADMINISTRATEUR_JUDICIAIRE_LIVE = false

export function administrateurJudiciaireActif(): boolean {
  return ADMINISTRATEUR_JUDICIAIRE_LIVE || process.env.NODE_ENV !== 'production'
}
