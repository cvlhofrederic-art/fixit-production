// ── Attente des listes relues après une action (espace AJ Signalement) ───────────────────────────────────────────
//
// Relecture du correctif du 13/11/2026 (« les listes ne se rafraîchissent pas ») : une action attend la liste relue
// avant d'annoncer son succès, mais pas sans limite. Une lecture qui ne répond pas (réseau mobile figé, requête
// suspendue : les appels de lib/aj-signalement/api.ts n'ont pas de délai maximal) laissait la confirmation occupée et le
// succès jamais annoncé. Passé DELAI_MAX_LISTES_QR_MS, l'action annonce son succès et rend ses boutons ; la liste suit
// à son arrivée.

/** ≈ 2,4 s par appel en production, lectures en parallèle (2 à 5 s mesurées) : 8 s laissent la marge. */
export const DELAI_MAX_LISTES_QR_MS = 8000

/** true si la promesse est tenue dans le délai ; false sinon (elle continue, son résultat n'est plus attendu). */
export function attendreAuPlusQr(promesse: Promise<unknown>, delaiMs: number = DELAI_MAX_LISTES_QR_MS): Promise<boolean> {
  let minuteur: ReturnType<typeof setTimeout> | undefined
  const depasse = new Promise<boolean>((tenir) => { minuteur = setTimeout(() => tenir(false), delaiMs) })
  return Promise.race([promesse.then(() => true), depasse]).finally(() => clearTimeout(minuteur))
}
