/**
 * Navigation interne de la succursale : comme la maquette, l'écran affiché est porté par l'ancre
 * d'URL (#cockpit, #mandats…) et le shell écoute « hashchange ». Tous les écrans passent par
 * cette fonction au lieu d'écrire window.location eux-mêmes.
 */
export function naviguerVers(route: string): void {
  if (typeof window === 'undefined') return
  window.location.hash = route
}

/** Route lue dans l'ancre courante (sans le #), ou chaîne vide. */
export function routeCourante(): string {
  if (typeof window === 'undefined') return ''
  return window.location.hash.slice(1)
}
