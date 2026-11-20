import type { SaisieArrete } from '@/lib/administrateur-judiciaire/db/rapprochements'
import { estDateIsoValide, messagePlausibilite, plausibiliteDate } from '@/lib/administrateur-judiciaire/domain/dates'
import { parserMontant } from '@/lib/administrateur-judiciaire/domain/import/csv'
import type { ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'

/**
 * Vue du panneau « Rapprochement » de l'écran « Banque et recouvrement » (RapprochementPanel.tsx) : arrêté affiché et
 * contrôle de la saisie de « Nouvel arrêté » avant l'écriture (db/rapprochements.ts, qui applique les règles du
 * domaine). Fonctions pures.
 */

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
 * Contrôle de la saisie avant l'écriture : date à saisir, valide, ni future ni d'une année improbable (plausibiliteDate :
 * un arrêté constate un solde passé) ; solde lisible. Les règles de l'arrêté (un seul en cours, date postérieure au
 * dernier) restent celles du domaine, appliquées à l'écriture.
 */
export function controlerSaisieArrete(valeurs: ValeursArrete, aujourdhui: string): { saisie: SaisieArrete } | { erreur: string } {
  if (!valeurs.date) return { erreur: 'Date de l’arrêté à saisir.' }
  if (!estDateIsoValide(valeurs.date)) return { erreur: 'Date de l’arrêté invalide : JJ/MM/AAAA attendu.' }
  const anomalie = plausibiliteDate(valeurs.date, aujourdhui, { futurAdmis: false })
  if (anomalie) return { erreur: messagePlausibilite('Arrêté daté', valeurs.date, anomalie) }
  const soldeBanqueCentimes = soldeSaisiVersCentimes(valeurs.soldeBanque)
  if (soldeBanqueCentimes === null)
    return { erreur: 'Solde banque illisible : montant en euros attendu (ex. 1 234,56 ; négatif pour un découvert).' }
  return { saisie: { dateArrete: valeurs.date, soldeBanqueCentimes } }
}
