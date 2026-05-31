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
