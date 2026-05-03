/**
 * lib/money.ts — Helpers monétaires conformes à la doctrine fiscale française.
 *
 * Pourquoi ce module existe :
 *   La règle BOFiP (BOI-TVA-DECLA-30-20-20 §50) exige un arrondi commercial
 *   "round half up" (à 0,5 on monte) à 2 décimales — pas l'arrondi banker
 *   (`toFixed(2)`) qui arrondit au pair pour 0,5 et est INTERDIT en compta FR.
 *
 *   JavaScript a aussi une précision flottante IEEE 754 catastrophique
 *   pour la monnaie : 0.1 + 0.2 === 0.30000000000000004. Sur 50 lignes
 *   d'un devis, ça part en cacahuète et les totaux affichés ne tombent
 *   plus juste (cf. audit 03/05/2026, écart 1-3 cents observé).
 *
 *   Ce module normalise tous les calculs en passant par les centimes
 *   entiers (Math.round(x * 100)) et un arrondi explicite ROUND_HALF_UP.
 *
 * Convention :
 *   - `round2(n)` : arrondi 2 décimales (norme TVA)
 *   - `round4(n)` : arrondi 4 décimales (PU étude de prix BTP)
 *   - `mulMoney(a, b)` : multiplication monétaire, retourne 2 décimales
 *   - `sumMoney(values)` : somme via centimes entiers (zéro drift)
 *   - `parseDecimalInput(v)` : parse input utilisateur, gère virgule FR
 *   - `computeAcomptesAmounts(total, acomptes)` : dernier acompte rattrape
 *      le résidu d'arrondi (convention comptable standard)
 *   - `assertInvoiceInvariant(ht, tva, ttc)` : vérifie HT + TVA = TTC
 *      (à brancher sur logger.warn / Sentry en prod)
 *
 * Référence métier :
 *   - BOI-TVA-DECLA-30-20-20 §50 (méthode d'arrondi TVA)
 *   - Stripe Invoicing, QuickBooks FR, Sage, Henrri (BTP) appliquent
 *     tous le même pattern : centimes entiers + ROUND_HALF_UP
 */

/**
 * Arrondi commercial ROUND_HALF_UP à 2 décimales (norme TVA FR).
 *
 * Note : `Math.round(0.005 * 100)` = 0 en JS (à cause de 0.005 → 0.00499999…).
 *   On ajoute Number.EPSILON pour forcer l'arrondi au-dessus dans ce cas.
 *   Vérifié : round2(1.005) === 1.01 (BOFiP), round2(1.015) === 1.02.
 */
export const round2 = (n: number): number => {
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Arrondi à 4 décimales (PU étude de prix BTP).
 * Norme : Bertrand & Faucou, "Étude de prix BTP" 7ème éd., chap. 4 — les
 * coefficients de matériaux et débours s'expriment souvent au 1/10 de centime.
 */
export const round4 = (n: number): number => {
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 10_000) / 10_000
}

/**
 * Convertit un montant € en centimes entiers (pour stockage / sommation
 * sans drift flottant). Pattern Stripe : `amount_total` en cents.
 */
export const toCents = (n: number): number => {
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100)
}

/**
 * Convertit centimes → euros.
 */
export const fromCents = (c: number): number => c / 100

/**
 * Multiplication monétaire : multiplie deux nombres et arrondit le
 * résultat à 2 décimales en `round2`. Utilise comme primitive pour
 * `qty × priceHT`, `HT × tauxTVA / 100`, etc.
 *
 * Cas test (devis Adeline DEV-2026-001) :
 *   mulMoney(5, 381.8181818) === 1909.09  // PU réel à 4 décimales
 *   mulMoney(5, 381.82) === 1909.10        // PU saisi à 2 décimales
 *   mulMoney(100, 0.055) === 5.50          // TVA 5,5% sans drift
 *
 * Garde-fou : NaN/Infinity → 0 (évite NaN pollution sur les sommes).
 */
export const mulMoney = (a: number, b: number): number => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return round2(a * b)
}

/**
 * Somme monétaire SANS drift flottant : passe par les centimes entiers.
 *
 * Cas test : sumMoney([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1])
 *   doit retourner 1.00 exact (et non 0.9999999999999999).
 *
 * Garde-fou : valeurs non-finies → 0 silencieusement (évite NaN).
 */
export const sumMoney = (values: number[]): number => {
  const cents = values.reduce(
    (s, v) => s + (Number.isFinite(v) ? Math.round((v + Number.EPSILON) * 100) : 0),
    0,
  )
  return fromCents(cents)
}

/**
 * Parse un input utilisateur en montant monétaire valide.
 *
 * Gère :
 *   - virgule décimale FR ("0,01" → 0.01)
 *   - espaces / NNBSP de séparateur de milliers ("1 234,56" → 1234.56)
 *   - chaînes vides / non-numériques → 0
 *   - négatifs / NaN / Infinity → 0
 *   - bornes : > max → 0 (anti-DoS via 1e308)
 *
 * Sortie toujours arrondie à 2 décimales (round2).
 */
export const parseDecimalInput = (v: string | number, max = 9_999_999.99): number => {
  if (typeof v === 'number') {
    return Number.isFinite(v) && v >= 0 && v <= max ? round2(v) : 0
  }
  if (typeof v !== 'string') return 0
  const cleaned = v.trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '') return 0
  const n = parseFloat(cleaned)
  if (!Number.isFinite(n) || n < 0 || n > max) return 0
  return round2(n)
}

/**
 * Calcule la liste des montants d'acomptes pour un total et une liste
 * de pourcentages, en garantissant que la somme des acomptes === total
 * exactement (au centime près). Le DERNIER acompte absorbe le résidu
 * d'arrondi — convention comptable standard (Henrri, EBP, Sage).
 *
 * Cas test :
 *   computeAcomptesAmounts(100.01, [{p:33.33}, {p:33.33}, {p:33.34}])
 *   doit retourner [33.33, 33.33, 33.35] (somme = 100.01) au lieu de
 *   [33.33, 33.33, 33.34] (somme = 100.00, 1 cent perdu).
 */
export const computeAcomptesAmounts = (
  total: number,
  acomptes: { pourcentage: number }[],
): number[] => {
  if (acomptes.length === 0) return []
  if (!Number.isFinite(total) || total <= 0) return acomptes.map(() => 0)
  const amounts = acomptes.slice(0, -1).map(a => round2(total * (a.pourcentage || 0) / 100))
  const last = round2(total - sumMoney(amounts))
  return [...amounts, last]
}

/**
 * Vérifie l'invariant fiscal : Sous-total HT + Σ TVA = TOTAL TTC à 0,01 € près.
 *
 * À brancher sur Sentry / logger.warn en prod (sans bloquer le rendu).
 * Si delta > 0,01, le PDF est incohérent : risque audit Bercy + contestation
 * client. Devrait toujours retourner ok=true en production.
 */
export const assertInvoiceInvariant = (
  subtotalHT: number,
  totalTVA: number,
  totalTTC: number,
): { ok: boolean; delta: number } => {
  const sum = round2((subtotalHT || 0) + (totalTVA || 0))
  const ttc = round2(totalTTC || 0)
  const delta = Math.abs(sum - ttc)
  return { ok: delta < 0.01, delta }
}
