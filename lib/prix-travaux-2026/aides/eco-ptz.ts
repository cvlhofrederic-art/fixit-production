// lib/prix-travaux-2026/aides/eco-ptz.ts

/**
 * Éco-prêt à taux zéro — pas une "aide" directe mais un financement subventionné.
 * Plafond 2026 : jusqu'à 50 000 € sur 20 ans pour un bouquet travaux.
 * Source: Service Public — éco-PTZ 2026.
 */
export const ECO_PTZ_PLAFOND_2026 = 50_000

export function ecoPTZEligible(eligibleFlag: boolean | undefined): {
  eligible: boolean
  montantMax?: number
} {
  return eligibleFlag === true
    ? { eligible: true, montantMax: ECO_PTZ_PLAFOND_2026 }
    : { eligible: false }
}
