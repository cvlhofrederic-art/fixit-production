import type { Ecriture } from '@/lib/administrateur-judiciaire/db/schema'
import { dateVersIso } from '@/lib/administrateur-judiciaire/domain/dates'
import type { SoldeOuverture } from '@/lib/administrateur-judiciaire/domain/solde-ouverture-compte'

/**
 * Sous-comptes 512 des comptes bancaires d'une copropriété, dans le journal de banque de la base locale (choix du compte
 * à l'import du relevé : question 6 du plan des écrans, validée le 20/11/2026) :
 * - « 512-<id du compte bancaire> » : lignes d'un relevé importé sur ce compte (db/releves-bancaires.ts) ;
 * - « 512 » seul : lignes importées sans compte (avant ce choix, ou par l'import du store appelé sans compte), dites
 *   « non rattachées ».
 * Numérotation locale, sur le modèle du « 450-<id du copropriétaire> » de l'écran : la numérotation des comptes du
 * syndicat (« <syndicat>.512xx.<auxiliaire>.<repère> », lue par virement-interne.ts et fonds-detenus.ts) n'est encore
 * attribuée à aucun compte bancaire (point à trancher). Fonctions pures.
 */

export const COMPTE_BANQUE_NON_RATTACHE = '512'

const PREFIXE_SOUS_COMPTE = '512-'

/** Sous-compte 512 d'un compte bancaire. */
export const compteBanque = (banqueId: string): string => `${PREFIXE_SOUS_COMPTE}${banqueId}`

/** Identifiant du compte bancaire d'un sous-compte 512 ; null pour le « 512 » non rattaché et tout autre compte. */
export const banqueDuCompte = (compte: string): string | null =>
  compte.startsWith(PREFIXE_SOUS_COMPTE) && compte.length > PREFIXE_SOUS_COMPTE.length ? compte.slice(PREFIXE_SOUS_COMPTE.length) : null

/** Compte de banque : « 512 » non rattaché ou sous-compte d'un compte bancaire. */
export const estCompteBanque = (compte: string): boolean => compte === COMPTE_BANQUE_NON_RATTACHE || banqueDuCompte(compte) !== null

/** Montant signé d'une écriture en centimes entiers : débit (encaissement) positif, crédit (décaissement) négatif. */
const centimesSignes = (ecriture: Pick<Ecriture, 'montant' | 'sens'>): number =>
  (ecriture.sens === 'debit' ? 1 : -1) * Math.round(ecriture.montant * 100)

/**
 * Solde d'un compte (débit − crédit), en centimes entiers, sur les écritures datées au plus tard `jusquau` (AAAA-MM-JJ,
 * ce jour compris) quand il est donné. Null quand le compte n'a aucune écriture, quelle que soit sa date : solde inconnu,
 * distinct d'un solde nul.
 */
export function soldeCompteCentimes(
  ecritures: readonly Pick<Ecriture, 'compte' | 'montant' | 'sens' | 'date'>[],
  compte: string,
  jusquau?: string,
): number | null {
  const duCompte = ecritures.filter((ecriture) => ecriture.compte === compte)
  if (duCompte.length === 0) return null
  return duCompte
    .filter((ecriture) => jusquau === undefined || (dateVersIso(ecriture.date) ?? '') <= jusquau)
    .reduce((total, ecriture) => total + centimesSignes(ecriture), 0)
}

type EcritureDeSolde = Pick<Ecriture, 'compte' | 'montant' | 'sens' | 'date'>

/** Écritures du sous-compte 512 d'un compte bancaire datées avant son solde d'ouverture (voir soldeCompteBancaireCentimes). */
const avantOuverture = (ecritures: readonly EcritureDeSolde[], banqueId: string, ouverture: SoldeOuverture): EcritureDeSolde[] =>
  ecritures.filter((ecriture) => ecriture.compte === compteBanque(banqueId) && (dateVersIso(ecriture.date) ?? '') < ouverture.au)

/**
 * Solde d'un compte bancaire, en centimes entiers, avec son solde d'ouverture (décision du 26/11/2026, PR 799, point 2,
 * choix A ; domain/solde-ouverture-compte.ts). Seul calcul du solde d'un compte bancaire : solde par compte, solde compta
 * des arrêtés (ouverture, recalcul, clôture) et formulaire « Nouvel arrêté » passent par lui.
 * - Sans solde d'ouverture, ou à une date `jusquau` antérieure à celui-ci : le solde du sous-compte 512 du compte, comme
 *   avant (soldeCompteCentimes ; null sans aucune écriture : solde inconnu).
 * - Sinon : le solde d'ouverture (solde au début de son jour), plus les écritures du sous-compte datées de ce jour ou
 *   d'après, jusqu'à `jusquau` compris. Les écritures datées avant sont tenues pour déjà comprises dans le solde
 *   d'ouverture : elles n'y entrent pas une seconde fois (lignesAvantOuverture les compte, l'écran les signale). Jamais
 *   null : le solde est connu dès qu'un solde d'ouverture est saisi.
 */
export function soldeCompteBancaireCentimes(
  ecritures: readonly EcritureDeSolde[],
  banqueId: string,
  ouverture: SoldeOuverture | null,
  jusquau?: string,
): number | null {
  if (ouverture === null || (jusquau !== undefined && jusquau < ouverture.au)) return soldeCompteCentimes(ecritures, compteBanque(banqueId), jusquau)
  const horsSolde = new Set(avantOuverture(ecritures, banqueId, ouverture))
  const depuis = soldeCompteCentimes(
    ecritures.filter((ecriture) => !horsSolde.has(ecriture)),
    compteBanque(banqueId),
    jusquau,
  )
  return ouverture.centimes + (depuis ?? 0)
}

/** Nombre de lignes du sous-compte 512 d'un compte datées avant son solde d'ouverture : hors de son solde, à signaler. */
export const lignesAvantOuverture = (ecritures: readonly EcritureDeSolde[], banqueId: string, ouverture: SoldeOuverture | null): number =>
  ouverture === null ? 0 : avantOuverture(ecritures, banqueId, ouverture).length
