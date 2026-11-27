import type { SaisieArrete } from '@/lib/administrateur-judiciaire/db/rapprochements'
import { dateIsoVersFr, estDateIsoValide, messagePlausibilite, plausibiliteDate } from '@/lib/administrateur-judiciaire/domain/dates'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { parserMontant } from '@/lib/administrateur-judiciaire/domain/import/csv'
import type { SoldeBanquePropose } from '@/lib/administrateur-judiciaire/domain/import/releves-importes'
import type { ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'

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

/**
 * Solde en centimes → texte du champ « Solde banque », relu au centime près par soldeSaisiVersCentimes (« 472,94 »,
 * « -127,06 ») : sans séparateur des milliers, comme une saisie à la main. Sert au solde proposé d'un relevé importé
 * (décision du 26/11/2026, PR 799, rb-03 C).
 */
export function saisieDuSolde(centimes: number): string {
  const absolu = Math.abs(centimes)
  return `${centimes < 0 ? '-' : ''}${Math.trunc(absolu / 100)},${String(absolu % 100).padStart(2, '0')}`
}

const AIDE_SOLDE_BANQUE = 'Solde du relevé de la banque à cette date ; négatif : découvert.'

/**
 * Aide du champ « Solde banque ». Solde proposé d'un relevé importé : sa source, « relevé du JJ/MM/AAAA » (date de
 * clôture du relevé), et la réserve quand ce relevé est clos avant la date de l'arrêté (des mouvements ont pu passer
 * depuis). Sans solde proposé, ou dès que le solde est saisi à la main : l'aide d'avant.
 */
export function aideSoldeBanque(propose: SoldeBanquePropose | null): string {
  if (!propose) return AIDE_SOLDE_BANQUE
  const source = `Solde de clôture du relevé du ${dateIsoVersFr(propose.dateReleve)}`
  return propose.anterieur
    ? `${source}, antérieur à la date de l’arrêté : à vérifier. Modifiable\u00A0; négatif\u00A0: découvert.`
    : `${source}, modifiable\u00A0; négatif\u00A0: découvert.`
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
