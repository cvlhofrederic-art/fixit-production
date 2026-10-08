import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type {
  FormeEnvoiCourrier,
  StatutCourrier,
} from '@/lib/administrateur-judiciaire/domain/referentiels-vitfix'

/**
 * Courrier, support de la preuve de notification (intégration Gestéam, T30). Fonctions pures.
 * C'est la forme d'envoi « AR » qui fait d'un envoi une notification opposable. Aucun routeur n'est intégré : on
 * modélise ce que VitFix doit SAVOIR d'un envoi (dépôt, accusé de réception, référence de diffusion), pas l'envoi.
 */

export interface CourrierSuivi {
  formeEnvoi: FormeEnvoiCourrier
  dateDepot: string | null
  dateAccuseReception: string | null
}

/**
 * État d'un courrier au regard de la notification :
 * - `non_envoye` : pas encore déposé ;
 * - `sans_valeur_de_notification` : envoyé, mais pas en AR ;
 * - `envoye_non_notifie` : AR déposé, accusé de réception pas encore revenu ;
 * - `notifie` : AR avec date d'accusé de réception.
 */
export type EtatNotificationCourrier = 'non_envoye' | 'sans_valeur_de_notification' | 'envoye_non_notifie' | 'notifie'

export function etatNotificationCourrier(courrier: CourrierSuivi): EtatNotificationCourrier {
  if (!courrier.dateDepot) return 'non_envoye'
  if (courrier.formeEnvoi !== 'AR') return 'sans_valeur_de_notification'
  return courrier.dateAccuseReception ? 'notifie' : 'envoye_non_notifie'
}

const verifierDateIso = (libelle: string, valeur: string) => {
  if (!estDateIsoValide(valeur)) throw new Error(`${libelle} invalide : « ${valeur} » (attendu AAAA-MM-JJ).`)
}

/** Données d'un nouveau courrier : la forme d'envoi est COPIÉE du modèle, et ne suivra plus ses changements. */
export function preparerCourrier(
  modele: { id: string; formeEnvoi: FormeEnvoiCourrier },
  saisie: {
    objet: string
    coproprieteId?: string | null
    mandatId?: string | null
    personneId?: string | null
    entrepriseId?: string | null
  },
): {
  modeleId: string
  formeEnvoi: FormeEnvoiCourrier
  statut: StatutCourrier
  objet: string
  coproprieteId: string | null
  mandatId: string | null
  personneId: string | null
  entrepriseId: string | null
  dateDepot: null
  dateAccuseReception: null
  referenceDiffusion: null
} {
  return {
    modeleId: modele.id,
    formeEnvoi: modele.formeEnvoi,
    statut: 'Préparation',
    objet: saisie.objet,
    coproprieteId: saisie.coproprieteId ?? null,
    mandatId: saisie.mandatId ?? null,
    personneId: saisie.personneId ?? null,
    entrepriseId: saisie.entrepriseId ?? null,
    dateDepot: null,
    dateAccuseReception: null,
    referenceDiffusion: null,
  }
}

/** Contrôle d'un dépôt (date ISO). */
export function controlerDepot(dateDepot: string): void {
  verifierDateIso('Date de dépôt', dateDepot)
}

/** Contrôle d'un accusé de réception : courrier en AR, déjà déposé, accusé non antérieur au dépôt. */
export function controlerAccuseReception(courrier: CourrierSuivi, dateAccuseReception: string): void {
  verifierDateIso("Date d'accusé de réception", dateAccuseReception)
  if (courrier.formeEnvoi !== 'AR')
    throw new Error(`Accusé de réception refusé : le courrier est envoyé en « ${courrier.formeEnvoi} », pas en AR.`)
  if (!courrier.dateDepot) throw new Error("Accusé de réception refusé : le dépôt du courrier n'est pas enregistré.")
  if (dateAccuseReception < courrier.dateDepot)
    throw new Error(
      `L'accusé de réception (${dateAccuseReception}) ne peut pas précéder le dépôt (${courrier.dateDepot}).`,
    )
}
