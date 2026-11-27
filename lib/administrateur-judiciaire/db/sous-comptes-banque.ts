import type { Ecriture } from '@/lib/administrateur-judiciaire/db/schema'
import { dateVersIso } from '@/lib/administrateur-judiciaire/domain/dates'

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
