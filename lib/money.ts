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
 *   - `round2(n)` : arrondi 2 décimales (norme TVA), SYMÉTRIQUE pour les négatifs
 *   - `round4(n)` : arrondi 4 décimales (PU étude de prix BTP), symétrique
 *   - `mulMoney(a, b)` : multiplication monétaire, retourne 2 décimales
 *   - `sumMoney(values)` : somme via centimes entiers, arrondi UNE fois en fin
 *   - `parseDecimalInput(v)` : parse input utilisateur, gère virgule FR
 *   - `parseDecimalInput4(v)` : variante 4 décimales pour PU étude BTP
 *   - `computeAcomptesAmounts(total, acomptes)` : si Σ pourcentages === 100,
 *      le dernier acompte absorbe le résidu d'arrondi (convention comptable
 *      Henrri/EBP/Sage). Sinon, chaque acompte est rendu tel quel sans
 *      forçage à 100 % (préserve l'intention utilisateur).
 *   - `assertInvoiceInvariant(ht, tva, ttc)` : vérifie HT + TVA = TTC à 0,01 €
 *      près. À brancher sur Sentry en prod (sans bloquer le rendu).
 *
 * Référence métier :
 *   - BOI-TVA-DECLA-30-20-20 §50 (méthode d'arrondi TVA)
 *   - Stripe Invoicing, QuickBooks FR, Sage, Henrri (BTP) appliquent
 *     tous le même pattern : centimes entiers + ROUND_HALF_UP symétrique
 *
 * Hotfix audit interne 04/05/2026 :
 *   - round2 négatifs : symétrie commerciale (Math.round JS asymétrique)
 *   - sumMoney : somme brute puis arrondi UNIQUE (le pré-arrondi par item
 *     causait un drift de 0,50 € sur 100 lignes à 1,005 €)
 *   - computeAcomptesAmounts : ne force plus à 100 % si Σ pourcentages != 100
 *   - parseDecimalInput : cap relevé à 999 999 999,99 (immeubles HLM possibles)
 *   - assertInvoiceInvariant : tolérance <= 0,01 (inclusive)
 *   - parseDecimalInput4 : nouvelle fonction pour PU 4 décimales BTP
 */

/**
 * Arrondi ROUND_HALF_UP commercial à 2 décimales, SYMÉTRIQUE.
 *
 * Pour les positifs : 1.005 → 1.01, 1.045 → 1.05.
 * Pour les négatifs : -1.005 → -1.01, -1.045 → -1.05 (symétrie).
 *
 * Pourquoi pas Math.round natif : `Math.round(0.5) === 1` mais
 *   `Math.round(-0.5) === 0` (asymétrique vers +∞). Sur les remises,
 *   l'asymétrie drifte en faveur de l'artisan → contestation client.
 *   Stripe / Sage / Henrri appliquent tous l'arrondi symétrique.
 */
export const round2 = (n: number): number => {
  if (!Number.isFinite(n)) return 0
  const sign = n < 0 ? -1 : 1
  return sign * Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100
}

/**
 * Arrondi à 4 décimales (PU étude de prix BTP), symétrique.
 * Norme : Bertrand & Faucou, "Étude de prix BTP" 7ème éd., chap. 4 — les
 * coefficients de matériaux et débours s'expriment souvent au 1/10 de centime.
 */
export const round4 = (n: number): number => {
  if (!Number.isFinite(n)) return 0
  const sign = n < 0 ? -1 : 1
  return sign * Math.round((Math.abs(n) + Number.EPSILON) * 10_000) / 10_000
}

/**
 * Convertit un montant € en centimes entiers (pour stockage / sommation
 * sans drift flottant). Pattern Stripe : `amount_total` en cents.
 */
export const toCents = (n: number): number => {
  if (!Number.isFinite(n)) return 0
  const sign = n < 0 ? -1 : 1
  return sign * Math.round((Math.abs(n) + Number.EPSILON) * 100)
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
 * Garde-fou anti-overflow : si a*b → Infinity, retourne 0.
 */
export const mulMoney = (a: number, b: number): number => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  const product = a * b
  if (!Number.isFinite(product)) return 0
  return round2(product)
}

/**
 * Somme monétaire à drift minimal : somme les valeurs brutes puis arrondit
 * UNE FOIS en fin via `round2`. Préserve le comportement BOFiP (round half up
 * sur la somme finale) et évite l'amplification du biais d'arrondi qui se
 * produit quand on pré-arrondit chaque valeur en cents.
 *
 * Cas test :
 *   sumMoney([0.1, 0.1, ...]×10) === 1.00 (drift IEEE 754 absorbé)
 *   sumMoney([1.005, 1.005]) === 2.01    (round_half_up sur la somme)
 *   sumMoney([1.005]×100) === 100.50     (pas 101 € comme pré-arrondi)
 *
 * Garde-fou : valeurs non-finies ignorées (n'ajoutent rien).
 */
export const sumMoney = (values: number[]): number => {
  let sum = 0
  for (const v of values) {
    if (Number.isFinite(v)) sum += v
  }
  return round2(sum)
}

/**
 * Parse un input utilisateur en montant monétaire valide à 2 décimales.
 *
 * Gère :
 *   - virgule décimale FR ("0,01" → 0.01)
 *   - espaces / NNBSP de séparateur de milliers ("1 234,56" → 1234.56)
 *   - chaînes vides / non-numériques → 0
 *   - négatifs / NaN / Infinity → 0
 *   - bornes : cap à 999 999 999,99 € par défaut (immeuble HLM possible).
 *     1e308 et autres notations exposant overflow → 0.
 *
 * Sortie toujours arrondie à 2 décimales (round2).
 */
export const parseDecimalInput = (
  v: string | number,
  max = 999_999_999.99,
  opts?: { allowNegative?: boolean },
): number => {
  const allowNeg = opts?.allowNegative === true
  const min = allowNeg ? -max : 0
  if (typeof v === 'number') {
    return Number.isFinite(v) && v >= min && v <= max ? round2(v) : 0
  }
  if (typeof v !== 'string') return 0
  const cleaned = v.trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '' || cleaned === '-') return 0
  const n = parseFloat(cleaned)
  if (!Number.isFinite(n) || n < min || n > max) return 0
  return round2(n)
}

/**
 * Variante 4 décimales pour les prix unitaires BTP (étude de prix).
 *
 * Mêmes règles que parseDecimalInput mais arrondit à 4 décimales via round4.
 * À utiliser pour les inputs `priceHT` BTP où la norme métier autorise jusqu'à
 * 4 décimales (cas Adeline : 1909.09 / 5 = 381.8181 conservé exact).
 *
 * Le `totalHT = qty × priceHT` reste arrondi à 2 décimales via mulMoney(),
 * donc le PDF affiche toujours du 2 décimales — seule la base de calcul
 * conserve la précision.
 */
export const parseDecimalInput4 = (
  v: string | number,
  max = 999_999_999.99,
  opts?: { allowNegative?: boolean },
): number => {
  const allowNeg = opts?.allowNegative === true
  const min = allowNeg ? -max : 0
  if (typeof v === 'number') {
    return Number.isFinite(v) && v >= min && v <= max ? round4(v) : 0
  }
  if (typeof v !== 'string') return 0
  const cleaned = v.trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '' || cleaned === '-') return 0
  const n = parseFloat(cleaned)
  if (!Number.isFinite(n) || n < min || n > max) return 0
  return round4(n)
}

/**
 * Calcule la liste des montants d'acomptes pour un total et une liste
 * de pourcentages.
 *
 * Comportement (hotfix audit 04/05/2026) :
 *   - Si Σ pourcentages === 100 % (à 0,001 près) : le DERNIER acompte
 *     absorbe le résidu d'arrondi (Henrri/EBP/Sage convention) pour que
 *     la somme === total exact au centime.
 *   - Si Σ pourcentages !== 100 % : chaque acompte est calculé tel quel,
 *     SANS forçage à 100 %. Préserve l'intention utilisateur quand il
 *     saisit un acompte partiel ("30 % à la commande, le solde réglé
 *     séparément").
 *
 * Avant fix (PR #103) : forçait toujours le dernier à compléter à 100 %
 *   → un user qui saisit 1 acompte de 30 % voyait 100 % facturé. Bug majeur.
 */
export const computeAcomptesAmounts = (
  total: number,
  acomptes: { pourcentage: number }[],
): number[] => {
  if (acomptes.length === 0) return []
  if (!Number.isFinite(total) || total <= 0) return acomptes.map(() => 0)
  const totalPct = acomptes.reduce((s, a) => s + (Number.isFinite(a.pourcentage) ? a.pourcentage : 0), 0)
  const isFullPct = Math.abs(totalPct - 100) < 0.001
  // Cas standard : tous les acomptes calculés indépendamment.
  const amounts = acomptes.map(a => round2(total * (a.pourcentage || 0) / 100))
  if (!isFullPct) return amounts
  // Cas Σ === 100 : le DERNIER absorbe le résidu pour que sumMoney = total.
  const last = round2(total - sumMoney(amounts.slice(0, -1)))
  return [...amounts.slice(0, -1), last]
}

/**
 * Vérifie l'invariant fiscal : Sous-total HT + Σ TVA = TOTAL TTC à 0,01 € près.
 *
 * À brancher sur Sentry en prod (sans bloquer le rendu) — voir intégration
 * dans DevisFactureForm.tsx et DevisFactureFormBTP.tsx.
 *
 * Tolérance : delta <= 0,01 (inclusive). Au-delà, le PDF est incohérent
 * (risque audit Bercy + contestation client).
 *
 * Hotfix : tolérance changée de `< 0.01` à `<= 0.01` car un delta de 0,01 €
 *   exactement arrive en pratique sur certaines combinaisons de taux mixtes
 *   et ne devrait pas déclencher un faux positif.
 */
export const assertInvoiceInvariant = (
  subtotalHT: number,
  totalTVA: number,
  totalTTC: number,
): { ok: boolean; delta: number } => {
  // Comparaison en centimes entiers pour éviter le drift IEEE 754 :
  // Math.abs(120 - 120.01) === 0.010000000000005116 dans certains cas.
  const sumCents = toCents((subtotalHT || 0) + (totalTVA || 0))
  const ttcCents = toCents(totalTTC || 0)
  const deltaCents = Math.abs(sumCents - ttcCents)
  const delta = fromCents(deltaCents)
  return { ok: deltaCents <= 1, delta }
}
