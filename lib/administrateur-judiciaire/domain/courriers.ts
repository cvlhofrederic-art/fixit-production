import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type {
  FormeEnvoiCourrier,
  StatutCourrier,
} from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Courrier, support de la preuve de notification (intégration Gestéam, T30). Fonctions pures.
 * C'est la forme d'envoi « AR » qui fait d'un envoi une notification opposable. Aucun routeur n'est intégré : on
 * modélise ce que VitFix doit SAVOIR d'un envoi (dépôt, première présentation, retrait, référence de diffusion).
 *
 * Décision J1 (08/10/2026) : la notification est acquise à la PREMIÈRE PRÉSENTATION du pli par La Poste, qu'il ait
 * été retiré ou non. La date de retrait (signature de l'avis de réception) reste une information de suivi.
 */

export interface CourrierSuivi {
  formeEnvoi: FormeEnvoiCourrier
  dateDepot: string | null
  /** Absente sur les courriers écrits avant J1 : lue comme null. */
  datePremierePresentation?: string | null
  dateAccuseReception: string | null
}

/**
 * État d'un courrier au regard de la notification :
 * - `non_envoye` : pas encore déposé ;
 * - `sans_valeur_de_notification` : envoyé, mais pas en AR ;
 * - `envoye_non_notifie` : AR déposé, première présentation pas encore connue ;
 * - `notifie` : AR présenté (retiré ou non).
 */
export type EtatNotificationCourrier = 'non_envoye' | 'sans_valeur_de_notification' | 'envoye_non_notifie' | 'notifie'

export function etatNotificationCourrier(courrier: CourrierSuivi): EtatNotificationCourrier {
  if (!courrier.dateDepot) return 'non_envoye'
  if (courrier.formeEnvoi !== 'AR') return 'sans_valeur_de_notification'
  return courrier.datePremierePresentation ? 'notifie' : 'envoye_non_notifie'
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
  datePremierePresentation: null
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
    datePremierePresentation: null,
    dateAccuseReception: null,
    referenceDiffusion: null,
  }
}

/** Contrôle d'un dépôt (date ISO). */
export function controlerDepot(dateDepot: string): void {
  verifierDateIso('Date de dépôt', dateDepot)
}

/** Un événement de suivi postal ne s'enregistre que sur un AR déjà déposé, et jamais avant le dépôt. */
function controlerEvenementPostal(courrier: CourrierSuivi, libelle: string, date: string): void {
  verifierDateIso(`Date ${libelle}`, date)
  if (courrier.formeEnvoi !== 'AR')
    throw new Error(`Date ${libelle} refusée : le courrier est envoyé en « ${courrier.formeEnvoi} », pas en AR.`)
  if (!courrier.dateDepot) throw new Error(`Date ${libelle} refusée : le dépôt du courrier n'est pas enregistré.`)
  if (date < courrier.dateDepot)
    throw new Error(`La date ${libelle} (${date}) ne peut pas précéder le dépôt (${courrier.dateDepot}).`)
}

/**
 * Contrôle de la date de première présentation (J1). Seule la PREMIÈRE compte : une date postérieure à celle déjà
 * saisie est refusée (une représentation ne repousse pas le délai) ; une date antérieure la corrige.
 */
export function controlerPremierePresentation(courrier: CourrierSuivi, datePresentation: string): void {
  controlerEvenementPostal(courrier, 'de première présentation', datePresentation)
  const dejaSaisie = courrier.datePremierePresentation ?? null
  if (dejaSaisie && datePresentation > dejaSaisie)
    throw new Error(
      `Seule la première présentation fait courir le délai : ${dejaSaisie} est déjà saisie, ${datePresentation} est postérieure.`,
    )
  if (courrier.dateAccuseReception && datePresentation > courrier.dateAccuseReception)
    throw new Error(
      `La première présentation (${datePresentation}) ne peut pas suivre le retrait du pli (${courrier.dateAccuseReception}).`,
    )
}

/** Contrôle de l'accusé de réception (retrait du pli) : AR déposé, présenté, retrait non antérieur à la présentation. */
export function controlerAccuseReception(courrier: CourrierSuivi, dateAccuseReception: string): void {
  controlerEvenementPostal(courrier, "d'accusé de réception", dateAccuseReception)
  const presentation = courrier.datePremierePresentation ?? null
  if (!presentation)
    throw new Error("Accusé de réception refusé : saisir d'abord la date de première présentation du pli.")
  if (dateAccuseReception < presentation)
    throw new Error(
      `L'accusé de réception (${dateAccuseReception}) ne peut pas précéder la première présentation (${presentation}).`,
    )
}
