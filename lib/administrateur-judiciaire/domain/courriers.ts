import { dateIsoVersFr as dateFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type {
  FormeEnvoiCourrier,
  StatutCourrier,
} from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Courrier, support de la preuve de notification (intégration Gestéam, T30). Fonctions pures.
 * Aucun routeur n'est intégré : on modélise ce que VitFix doit SAVOIR d'un envoi (dépôt, première présentation ou
 * transmission de l'avis électronique, retrait, référence de diffusion).
 *
 * Décision J1 (08/10/2026) : la notification par lettre recommandée est acquise à la PREMIÈRE PRÉSENTATION du pli par
 * La Poste, qu'il ait été retiré ou non. La date de retrait (signature de l'avis de réception) reste une information de
 * suivi.
 *
 * Décisions de Hugo du 11/11/2026 (registre des décisions juridiques : J50, « Oui, calcul électronique » ; notes
 * decisions-1111/questions-hugo.md et j50-textes.md, textes lus sur Légifrance le 11/11/2026) :
 * - depuis le 25/12/2025 (décret du 22/12/2025, JORF du 24/12/2025, texte n° 119), la notification se fait par voie
 *   électronique de principe, par lettre recommandée électronique (LRE, CPCE art. R. 53 à R. 53-4) ou par le procédé
 *   d'un prestataire de services de confiance qualifié (D. 1967 art. 64, 1° et 2° ; art. 64-5 à 64-9) ; la lettre
 *   recommandée avec avis de réception (LRAR) est l'exception, pour qui a demandé la voie postale (art. 64-1) ;
 * - le MODE DE NOTIFICATION (modeNotification : lrar, lre, prestataire_qualifie) est un champ propre à VitFix, fixé à la
 *   création du courrier comme la forme d'envoi ; la liste Gestéam des formes d'envoi n'a ni LRE ni prestataire qualifié,
 *   et FORME_ENVOI_COURRIER ne change pas ; sans mode saisi (courriers d'avant J50, lus comme null), la forme « AR » vaut
 *   LRAR et toute autre forme ne vaut pas notification ; LRAR en forme « AR » seulement, envoi électronique dans une
 *   autre forme que « AR » (sinon : refus à la création, mode incohérent à la lecture) ;
 * - une notification électronique est acquise à la TRANSMISSION DE L'AVIS électronique par le prestataire
 *   (dateAvisElectronique ; D. 1967 art. 64, dernier al.), que le contenu soit téléchargé ou non ; ni la date du dépôt, ni
 *   celle du téléchargement. Où la lire dépend du mode (relecture du 14/11/2026 : les art. 64-5 à 64-9 ne visent que le
 *   procédé du 2°) : procédé du prestataire qualifié, sur son justificatif de transmission (art. 64-5 ; l'avis porte
 *   lui-même cette date : art. 64-6, 4°), le rappel envoyé après 48 heures ne la repousse pas (art. 64-7) ; LRE, sur
 *   l'information du destinataire de CPCE art. R. 53-3, I (🔵 interprétation), un second avis ne la repousse pas (même
 *   règle, 🔵) ; une date antérieure à celle déjà saisie la corrige ; une date postérieure est refusée, sauf correction
 *   motivée (motifCorrection : date saisie par erreur, par exemple celle du dépôt), dont l'avertissement est à tracer ;
 * - la remise contre émargement, le courriel simple, le SMS, la lettre simple et l'extranet ne valent pas notification
 *   du procès-verbal (art. 64 et 64-3) : refus inchangé.
 * 🔵 Pour une LRE, « l'avis » est lu comme l'information du destinataire de CPCE art. R. 53-3, I (interprétation) ; une
 * LRE refusée ou non réclamée fait quand même courir le délai, comme une LRAR non retirée (interprétation, aucun arrêt).
 * 🔴 Écrans (choix du mode, saisie de l'avis) et écriture en base (enregistrement de l'avis, mode figé par le
 * repository) : à faire, accord de Frédéric pour les écrans.
 */

/** Mode de notification d'un courrier (J50) : liste propre à VitFix, pas une forme d'envoi Gestéam. */
export const MODES_NOTIFICATION = ['lrar', 'lre', 'prestataire_qualifie'] as const
export type ModeNotification = (typeof MODES_NOTIFICATION)[number]

/** LRE (D. 1967 art. 64, 1°) ou procédé d'un prestataire de services de confiance qualifié (art. 64, 2°). */
export const estModeElectronique = (mode: ModeNotification | null): boolean => mode === 'lre' || mode === 'prestataire_qualifie'

export interface CourrierSuivi {
  formeEnvoi: FormeEnvoiCourrier
  dateDepot: string | null
  /** Absente sur les courriers écrits avant J1 : lue comme null. */
  datePremierePresentation?: string | null
  dateAccuseReception: string | null
  /** Mode de notification (J50) ; absent sur les courriers écrits avant J50 : lu comme null. */
  modeNotification?: ModeNotification | null
  /** Transmission de l'avis électronique par le prestataire (J50) ; absente avant J50 : lue comme null. */
  dateAvisElectronique?: string | null
}

/**
 * Mode de notification d'un courrier (J50) : le mode saisi, s'il est cohérent avec la forme d'envoi (LRAR en « AR »
 * seulement, envoi électronique hors « AR ») ; sans mode saisi, « AR » vaut LRAR ; null : le courrier ne vaut pas
 * notification.
 */
export function modeNotificationCourrier(courrier: { formeEnvoi: string; modeNotification?: ModeNotification | null }): ModeNotification | null {
  const mode = courrier.modeNotification ?? null
  const enAr = courrier.formeEnvoi === 'AR'
  if (mode === null) return enAr ? 'lrar' : null
  return (mode === 'lrar') === enAr ? mode : null
}

/**
 * État d'un courrier au regard de la notification :
 * - `non_envoye` : pas encore déposé ;
 * - `sans_valeur_de_notification` : envoyé, mais ni en AR ni par un mode électronique (J50) ;
 * - `envoye_non_notifie` : déposé, première présentation (AR) ou transmission de l'avis (électronique) pas encore connue ;
 * - `notifie` : AR présenté (retiré ou non), ou avis électronique transmis (téléchargé ou non).
 */
export type EtatNotificationCourrier = 'non_envoye' | 'sans_valeur_de_notification' | 'envoye_non_notifie' | 'notifie'

export function etatNotificationCourrier(courrier: CourrierSuivi): EtatNotificationCourrier {
  if (!courrier.dateDepot) return 'non_envoye'
  const mode = modeNotificationCourrier(courrier)
  if (mode === null) return 'sans_valeur_de_notification'
  const evenement = mode === 'lrar' ? courrier.datePremierePresentation : courrier.dateAvisElectronique
  return evenement ? 'notifie' : 'envoye_non_notifie'
}

const verifierDateIso = (libelle: string, valeur: string) => {
  if (!estDateIsoValide(valeur)) throw new Error(`${libelle} invalide : « ${valeur} » (attendu AAAA-MM-JJ).`)
}

/** Mode saisi à la création : dans la liste, et cohérent avec la forme d'envoi du modèle (J50). */
function verifierModeNotification(formeEnvoi: FormeEnvoiCourrier, mode: ModeNotification | null): void {
  if (mode === null) return
  if (!(MODES_NOTIFICATION as readonly string[]).includes(mode))
    throw new Error(`Mode de notification inconnu : « ${mode} » (lrar, lre ou prestataire_qualifie attendu).`)
  if (mode === 'lrar' && formeEnvoi !== 'AR')
    throw new Error(`Mode « lrar » refusé : la forme d'envoi du modèle est « ${formeEnvoi} », pas « AR » (D. 1967 art. 64-1).`)
  if (mode !== 'lrar' && formeEnvoi === 'AR')
    throw new Error(`Mode « ${mode} » refusé : la forme d'envoi du modèle est « AR », un envoi postal (D. 1967 art. 64).`)
}

/**
 * Données d'un nouveau courrier : la forme d'envoi est COPIÉE du modèle, et ne suivra plus ses changements ; le mode de
 * notification (J50) est fixé à la création.
 */
export function preparerCourrier(
  modele: { id: string; formeEnvoi: FormeEnvoiCourrier },
  saisie: {
    objet: string
    coproprieteId?: string | null
    mandatId?: string | null
    personneId?: string | null
    entrepriseId?: string | null
    modeNotification?: ModeNotification | null
  },
): {
  modeleId: string
  formeEnvoi: FormeEnvoiCourrier
  modeNotification: ModeNotification | null
  statut: StatutCourrier
  objet: string
  coproprieteId: string | null
  mandatId: string | null
  personneId: string | null
  entrepriseId: string | null
  dateDepot: null
  datePremierePresentation: null
  dateAvisElectronique: null
  dateAccuseReception: null
  referenceDiffusion: null
} {
  const modeNotification = saisie.modeNotification ?? null
  verifierModeNotification(modele.formeEnvoi, modeNotification)
  return {
    modeleId: modele.id,
    formeEnvoi: modele.formeEnvoi,
    modeNotification,
    statut: 'Préparation',
    objet: saisie.objet,
    coproprieteId: saisie.coproprieteId ?? null,
    mandatId: saisie.mandatId ?? null,
    personneId: saisie.personneId ?? null,
    entrepriseId: saisie.entrepriseId ?? null,
    dateDepot: null,
    datePremierePresentation: null,
    dateAvisElectronique: null,
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

/** Pourquoi une date d'avis plus tardive ne repousse pas le délai, selon le mode (relecture du 14/11/2026). */
const AVIS_PLUS_TARDIF: Readonly<Record<'lre' | 'prestataire_qualifie', { regle: string; verification: string }>> = {
  // LRE (D. 1967 art. 64, 1°) : les art. 64-5 à 64-9 ne visent que le prestataire qualifié ; règle lue par analogie (🔵)
  lre: {
    regle: "seule l'information du destinataire fait courir le délai, un nouvel avis ne la repousse pas (CPCE art. R. 53-3, I ; interprétation, 🔵)",
    verification: "vérifier sur la preuve de l'information du destinataire (CPCE art. R. 53-3, I ; interprétation) qu'il ne s'agit pas d'un second avis, sans effet sur le point de départ",
  },
  // procédé du prestataire qualifié (art. 64, 2°) : art. 64-5 (justificatif de transmission) et 64-7 (rappel sans effet)
  prestataire_qualifie: {
    regle: 'seule la transmission de l\'avis fait courir le délai, le rappel envoyé après 48 heures est sans effet (D. 1967 art. 64-7)',
    verification:
      "vérifier sur le justificatif de transmission (D. 1967 art. 64-5) qu'il ne s'agit pas du rappel envoyé après 48 heures, sans effet sur le point de départ (art. 64-7)",
  },
}

/**
 * Contrôle de la date de transmission de l'avis électronique (J50 ; D. 1967 art. 64, dernier al.) : envoi électronique
 * (LRE ou prestataire qualifié) déjà déposé, avis jamais avant le dépôt. Une date antérieure à celle déjà saisie la
 * corrige. Une date POSTÉRIEURE est refusée sans motif (le rappel du prestataire qualifié est sans effet, art. 64-7 ;
 * pour la LRE, même règle par interprétation, CPCE art. R. 53-3, I) ; avec un motif (`motifCorrection` : date saisie par
 * erreur, par exemple celle du dépôt), elle est admise et la fonction renvoie l'avertissement à tracer avec la
 * correction (relecture du 14/11/2026 : une date saisie trop tôt doit pouvoir être corrigée, sinon le délai finit trop
 * tôt). Renvoie la liste des avertissements, vide sans correction.
 */
export function controlerAvisElectronique(
  courrier: CourrierSuivi,
  dateAvis: string,
  { motifCorrection = null }: { motifCorrection?: string | null } = {},
): string[] {
  verifierDateIso("Date de transmission de l'avis électronique", dateAvis)
  const mode = modeNotificationCourrier(courrier)
  if (mode !== 'lre' && mode !== 'prestataire_qualifie')
    throw new Error(
      "Date de transmission de l'avis refusée : le courrier n'est pas une notification électronique (LRE ou prestataire qualifié, D. 1967 art. 64).",
    )
  if (!courrier.dateDepot) throw new Error("Date de transmission de l'avis refusée : le dépôt de l'envoi électronique n'est pas enregistré.")
  if (dateAvis < courrier.dateDepot)
    throw new Error(`La transmission de l'avis (${dateAvis}) ne peut pas précéder le dépôt (${courrier.dateDepot}).`)
  const dejaSaisie = courrier.dateAvisElectronique ?? null
  if (!dejaSaisie || dateAvis <= dejaSaisie) return []
  const motif = motifCorrection?.trim() || null
  if (motif === null)
    throw new Error(
      `Date de transmission de l'avis du ${dateFr(dateAvis)} postérieure à celle déjà saisie (${dateFr(dejaSaisie)}) : ${AVIS_PLUS_TARDIF[mode].regle}. Pour corriger une date saisie par erreur (par exemple celle du dépôt), donner le motif de la correction.`,
    )
  return [
    `Date de transmission de l'avis corrigée du ${dateFr(dejaSaisie)} au ${dateFr(dateAvis)} (motif : ${motif}) : ${AVIS_PLUS_TARDIF[mode].verification}.`,
  ]
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
