/**
 * Helper partagé V2 + V3 — calcul de la date d'échéance facture.
 *
 * Source unique de vérité pour les conditions de paiement (art. L441-10
 * C. com. + BOFIP-TVA-DECLA-30-20-10) : convertit une chaîne issue du
 * dropdown « Conditions de paiement » (ex: "60 jours date facture",
 * "30 jours fin de mois", "Comptant à réception") en date d'échéance.
 *
 * Formats supportés (par ordre de priorité) :
 *  1. Date ISO (YYYY-MM-DD) — date d'échéance saisie manuellement
 *  2. "X jours fin de mois" — emission + X jours puis snap au dernier jour
 *     du mois (interprétation commune art. L441-10, fin du mois civil)
 *  3. "X jours date facture" / "X jours" / "X dias" — emission + X jours
 *  4. "Comptant…" / "À réception" / "Pronto…" — emission (J0)
 *  5. Fallback : emission + fallbackDays (défaut 30)
 *
 * Le paramètre `raw` accepte :
 *  - String FR/PT/EN venant du dropdown paymentCondition / paymentDelay
 *  - Date ISO string (YYYY-MM-DD) pour override manuel
 *  - null / undefined / "" → fallback days
 */

export interface ComputeEcheanceOptions {
  /** Jours par défaut si raw vide ou non parseable. Défaut 30. */
  fallbackDays?: number
}

/**
 * Extrait le nombre de jours d'une chaîne du type « X jours », « X jours
 * fin de mois », « X dias ». Retourne null si non parseable (texte libre
 * comme "Comptant à réception" ou "Acompte 50/50" — le « 50 » de 50/50
 * n'est pas un délai de paiement).
 *
 * Validation : 1 ≤ X ≤ 365 (au-delà = donnée corrompue).
 */
export function parsePaymentDelayDays(raw: string | null | undefined): number | null {
  if (!raw || typeof raw !== 'string') return null
  // Match strict : nombre suivi de « jours » / « jour » / « dias » / « dia » / « j »
  // (mot complet, pas dans « 50/50 »). Insensible à la casse.
  const m = raw.match(/(\d+)\s*(?:jours?|dias?|\bj\b)/i)
  if (!m) return null
  const n = parseInt(m[1], 10)
  if (!Number.isFinite(n) || n < 1 || n > 365) return null
  return n
}

/**
 * Détecte la mention « fin de mois » / « fim do mês » / « end of month ».
 */
function hasEndOfMonth(raw: string): boolean {
  return /fin\s+de\s+mois|fim\s+do\s+m[êe]s|end\s+of\s+month/i.test(raw)
}

/**
 * Détecte « comptant à réception » / « pronto pagamento » / « immédiat ».
 */
function isImmediate(raw: string): boolean {
  return /comptant|r[ée]ception|pronto|imm[ée]diat|immediate|on\s+receipt/i.test(raw)
}

/**
 * Snap au dernier jour du mois (28-31 selon le mois).
 */
function lastDayOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

/**
 * Calcule la date d'échéance d'une facture à partir de la date d'émission
 * et de la chaîne de conditions de paiement.
 *
 * @param emission Date d'émission (Date object).
 * @param raw Chaîne paymentCondition / paymentDelay / paymentDue.
 * @param options Optionnel : fallbackDays.
 * @returns Date d'échéance.
 */
export function computeEcheanceDate(
  emission: Date,
  raw: string | null | undefined,
  options: ComputeEcheanceOptions = {},
): Date {
  const fallbackDays = options.fallbackDays ?? 30

  // 1. Date ISO explicite → use it directly
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const iso = new Date(raw)
    if (!isNaN(iso.getTime())) return iso
  }

  // 2. Texte parseable « X jours [fin de mois] »
  if (raw) {
    const days = parsePaymentDelayDays(raw)
    if (days != null) {
      const d = new Date(emission)
      d.setDate(d.getDate() + days)
      if (hasEndOfMonth(raw)) {
        return lastDayOfMonth(d)
      }
      return d
    }
    // 3. « Comptant à réception » → emission (J0)
    if (isImmediate(raw)) {
      return new Date(emission)
    }
    // 4. Texte libre non parseable → fallback
  }

  // 5. Fallback
  const d = new Date(emission)
  d.setDate(d.getDate() + fallbackDays)
  return d
}

/**
 * Formate la date d'échéance pour affichage PDF.
 * Compat rétro avec les anciennes signatures V3 (raw, docDate, locale) :
 * si raw est ISO ou parseable comme délai, renvoie la date formatée ;
 * sinon renvoie le texte libre tel quel (legacy).
 */
export function formatPaymentDueDate(
  raw: string | null | undefined,
  emissionDateIso: string | null | undefined,
  dateLocaleStr: string,
  options: ComputeEcheanceOptions = {},
): string {
  if (!raw) return '---'
  // Date ISO directe → formate
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(raw)
    if (!isNaN(d.getTime())) return d.toLocaleDateString(dateLocaleStr)
  }
  // Délai parseable → calcule depuis emission
  if (emissionDateIso) {
    const emission = new Date(emissionDateIso)
    if (!isNaN(emission.getTime())) {
      const days = parsePaymentDelayDays(raw)
      if (days != null) {
        const d = computeEcheanceDate(emission, raw, options)
        return d.toLocaleDateString(dateLocaleStr)
      }
      if (isImmediate(raw)) {
        return emission.toLocaleDateString(dateLocaleStr)
      }
    }
  }
  // Texte libre non parseable → affiche tel quel
  return raw
}
