/**
 * lib/tva-intra.ts — Calcul du numéro de TVA intracommunautaire FR.
 *
 * Pour les entreprises françaises, le numéro de TVA intracom est dérivé
 * mécaniquement du SIREN par l'administration fiscale (pas de demande).
 * Formule officielle (impots.gouv.fr — Questions/Réponses TVA intracom) :
 *
 *     clé = (12 + 3 × (SIREN mod 97)) mod 97
 *     n° TVA = "FR" + clé (2 chiffres, zéro-padding) + SIREN
 *
 * Utilité : autoliquidation BTP (CGI art. 283, 2 nonies) → l'art. 242 nonies A
 * I-3° annexe II CGI exige le n° TVA intra du preneur sur la facture. On
 * l'auto-dérive depuis le SIRET client (déjà saisi) plutôt que d'exiger une
 * 2e saisie manuelle redondante. Le champ explicite reste possible pour les
 * cas border (n° UE non-FR, override administratif).
 *
 * Test connu :
 *   computeFrTvaIntra('92010210000012')  → 'FR10920102100'   (SIRET → SIREN)
 *   computeFrTvaIntra('920102100')        → 'FR10920102100'   (SIREN direct)
 *   computeFrTvaIntra('')                 → null
 *   computeFrTvaIntra('123')              → null              (trop court)
 *   computeFrTvaIntra('000000000')        → null              (SIREN nul rejeté)
 *
 * Limites :
 *   - Pas de vérification Luhn du SIREN (l'utilisateur peut entrer un SIRET
 *     invalide ; on calcule quand même, c'est le problème de l'utilisateur).
 *   - Algo FR uniquement. Numéros UE non-FR demandent une saisie manuelle.
 */

/**
 * Calcule le n° de TVA intracommunautaire FR à partir d'un SIREN ou SIRET.
 * Retourne null si l'input est invalide ou trop court.
 */
export function computeFrTvaIntra(sirenOrSiret: string | null | undefined): string | null {
  const digits = (sirenOrSiret || '').replace(/\D/g, '')
  if (digits.length < 9) return null
  const siren = digits.slice(0, 9)
  const sirenNum = parseInt(siren, 10)
  if (!Number.isFinite(sirenNum) || sirenNum === 0) return null
  const cle = (12 + 3 * (sirenNum % 97)) % 97
  return `FR${String(cle).padStart(2, '0')}${siren}`
}
