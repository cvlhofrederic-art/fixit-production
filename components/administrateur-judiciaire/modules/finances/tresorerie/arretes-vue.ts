import type { SaisieArrete } from '@/lib/administrateur-judiciaire/db/rapprochements'
import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { parserMontant } from '@/lib/administrateur-judiciaire/domain/import/csv'
import { refusDateArrete, type ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'

/**
 * Vue du panneau « Rapprochement » de l'écran « Banque et recouvrement » (RapprochementPanel.tsx) : arrêté affiché et
 * contrôle de la saisie de « Nouvel arrêté » avant l'écriture (db/rapprochements.ts, qui applique les règles du
 * domaine). Fonctions pures.
 */

/**
 * Montant d'un arrêté en euros, pour le panneau et le formulaire (décision du 26/11/2026, PR 799, rb-c02 A) : le
 * séparateur des milliers est une espace insécable de pleine largeur (U+00A0), et non l'espace fine insécable (U+202F) de
 * Intl, presque invisible dans la police du panneau (« 1958,10 € » au lieu de « 1 958,10 € »).
 */
export const eurosArrete = (centimes: number): string => formatEurosCentimes(centimes / 100).replaceAll('\u202f', '\u00a0')

/** Arrêté affiché : celui en cours, sinon le dernier par date ; null sans arrêté. */
export function arreteCourant(arretes: readonly ArreteRapprochement[]): ArreteRapprochement | null {
  const enCours = arretes.find((arrete) => arrete.statut === 'En cours')
  if (enCours) return enCours
  return arretes.reduce<ArreteRapprochement | null>((dernier, arrete) => (dernier === null || arrete.dateArrete > dernier.dateArrete ? arrete : dernier), null)
}

/**
 * Solde saisi en euros (« 1 234,56 », « -35,5 ») → centimes entiers signés : un solde de banque peut être négatif
 * (découvert). Vide, illisible ou plus de deux décimales : null.
 */
export function soldeSaisiVersCentimes(texte: string): number | null {
  const euros = parserMontant(texte)
  if (euros === null) return null
  const centimes = Math.round(euros * 100)
  return Math.abs(euros * 100 - centimes) < 1e-6 ? centimes : null
}

/** Saisie du formulaire « Nouvel arrêté » : date (AAAA-MM-JJ du champ date) et solde banque en euros. */
export interface ValeursArrete {
  date: string
  soldeBanque: string
}

/**
 * Contrôle de la saisie avant l'écriture : date à saisir, valide, ni future ni d'une année improbable (règle commune du
 * domaine, refusDateArrete : un arrêté constate un solde passé ; décision du 26/11/2026, rb-16 A) ; solde lisible. Les
 * règles de l'arrêté (un seul en cours, date postérieure au dernier, et de nouveau la date) sont celles du domaine,
 * appliquées à l'écriture.
 */
export function controlerSaisieArrete(valeurs: ValeursArrete, aujourdhui: string): { saisie: SaisieArrete } | { erreur: string } {
  if (!valeurs.date) return { erreur: 'Date de l’arrêté à saisir.' }
  if (!estDateIsoValide(valeurs.date)) return { erreur: 'Date de l’arrêté invalide : JJ/MM/AAAA attendu.' }
  const refusDate = refusDateArrete(valeurs.date, aujourdhui)
  if (refusDate) return { erreur: refusDate }
  const soldeBanqueCentimes = soldeSaisiVersCentimes(valeurs.soldeBanque)
  if (soldeBanqueCentimes === null)
    return { erreur: 'Solde banque illisible : montant en euros attendu (ex. 1 234,56 ; négatif pour un découvert).' }
  return { saisie: { dateArrete: valeurs.date, soldeBanqueCentimes } }
}
