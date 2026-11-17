// ── Nouvel essai après un 429 (Groq, Cerebras) ───────────────────────────────
//
// Avant le 15/11/2026, lib/groq et lib/cerebras attendaient `retry-after` (plafonné à 10 s) après CHAQUE 429, même
// au dernier essai et même quand le quota ne revenait que des heures plus tard : jusqu'à 50 s d'attente avant le
// secours, alors que l'écran de Fixy abandonne au bout de 30 s. Désormais : pas d'attente au dernier essai, et un
// quota qui ne revient pas sous 10 s fait passer tout de suite au modèle ou au fournisseur suivant.

/** Attente maximale avant un nouvel essai après un 429. */
export const ATTENTE_MAX_429_MS = 10_000

/**
 * Délai avant un nouvel essai après un 429, ou `null` pour passer tout de suite au modèle (ou au fournisseur)
 * suivant : dernier essai atteint, ou `retry-after` au-delà de `ATTENTE_MAX_429_MS`.
 */
export function delaiApres429(retryAfter: string | null, essai: number, maxEssais: number): number | null {
  if (essai >= maxEssais) return null
  const secondes = retryAfter === null ? Number.NaN : Number(retryAfter)
  const attente = Number.isFinite(secondes) && secondes >= 0 ? secondes * 1000 : (essai + 1) * 2000
  return attente > ATTENTE_MAX_429_MS ? null : attente
}
