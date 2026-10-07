/**
 * Bascule prod de la route LIVE du dashboard syndic v54 (/syndic/v54).
 *
 *   true  → /syndic/v54 est servi en production (design system v54, données mock).
 *   false → /syndic/v54 renvoie 404 (rollback : la route disparaît de la prod).
 *
 * L'ancien dashboard /syndic/dashboard (Supabase, realtime, auth, agents IA réels)
 * n'est JAMAIS touché par ce flag — la route v54 vit à côté, sans rien remplacer.
 *
 * ROLLBACK : repasser cette constante à `false` puis déployer. AUCUN code n'est
 * supprimé — le dashboard v54 (composant + 95 modules) reste dans le repo ; seul
 * ce booléen décide si la route /syndic/v54 est exposée.
 *
 * NB : le v54 affiche des données mock (pas encore branché à Supabase) — c'est
 * pourquoi il vit sur une route dédiée et non en remplacement du dashboard réel.
 */
export const SYNDIC_V54_LIVE = true

/**
 * Bascule prod de la route LIVE du dashboard syndic judiciaire FR (/syndic/v54-fr).
 *
 * Même mécanique que SYNDIC_V54_LIVE, pour la déclinaison française « syndic
 * judiciaire » (loi du 10 juillet 1965 / décret du 17 mars 1967) du design v54 :
 *   true  → /syndic/v54-fr est servi en production (données mock).
 *   false → /syndic/v54-fr renvoie 404 (rollback sans suppression de code).
 *
 * Indépendant du flag PT : chaque marché se déploie / rollback séparément.
 */
export const SYNDIC_V54_FR_LIVE = true

/**
 * Bascule de la version française du dashboard syndic classique (/fr/syndic/v54).
 *
 * Même route que le PT (app/syndic/v54) : la langue suit le préfixe d'URL relayé
 * par le middleware (en-tête x-locale).
 *   true  → /fr/syndic/v54 s'affiche en français (contenu adapté au droit français),
 *           et /syndic/dashboard renvoie les syndics francophones vers /fr/syndic/v54.
 *   false → /fr/syndic/v54 sert le dashboard portugais, comme avant la déclinaison
 *           (rollback sans suppression de code).
 * Sans effet sur /pt/syndic/v54, ni sur le syndic judiciaire (/syndic/v54-fr).
 */
export const SYNDIC_V54_CLASSIQUE_FR_LIVE = true
