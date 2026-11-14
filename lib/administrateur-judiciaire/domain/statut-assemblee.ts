import { estModeElectronique, modeNotificationCourrier, type ModeNotification } from '@/lib/administrateur-judiciaire/domain/courriers'
import {
  appliquerDelai,
  delaiMois,
  refDecret1967,
  refLoi1965,
  type CertitudeRegle,
  type Delai,
} from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import {
  ajouterJours,
  dateIsoVersFr,
  estDateIsoValide,
  reporterAuJourOuvrable as reporterJourOuvrable,
} from '@/lib/administrateur-judiciaire/domain/dates'
import type { ReferenceJurisprudence, ReferenceTexte } from '@/lib/administrateur-judiciaire/domain/fondements'
import {
  ENTREE_EN_VIGUEUR_ART_42_1_LOI_2024,
  ENTREE_EN_VIGUEUR_DECRET_2020,
  ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE,
  accordElectroniqueEnVigueur,
  demandesDepuisConsentements,
  effetDemandeVoiePostale,
  voieDeNotification,
  type ConsentementVoieElectronique,
  type DemandeVoiePostale,
} from '@/lib/administrateur-judiciaire/domain/voie-notification'
import { STATUT_ASSEMBLEE, type StatutAssemblee } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Statut de l'assemblée générale et historique de ses changements (intégration Gestéam, T12). Fonctions pures.
 *
 * Le statut suit le cycle légal relevé dans Gestéam 5.4.22 : Projet → Convoquée → PV signé → Notifiée. C'est la
 * NOTIFICATION du procès-verbal qui fait courir le délai de contestation de l'article 42 alinéa 2.
 *
 * Décision J2 (08/10/2026) : un saut d'étape EN AVANT est permis, mais marqué « hors séquence » avec un motif
 * obligatoire ; un retour arrière est impossible. Le moteur de délais refuse de calculer sur une chaîne incomplète.
 *
 * Décisions de Hugo du 11/11/2026 (registre des décisions juridiques : J50 et J51 ; notes decisions-1111 :
 * questions-hugo.md, recommandations et contre-vérification, j50-textes.md, j50-j51-jurisprudence.md, code-actuel.md) :
 * - J50 (« Oui, calcul électronique », suite de J1 et de J48) — point de départ du délai de l'art. 42, al. 2 selon le
 *   mode de notification du courrier (modeNotification, courriers.ts : champ propre à VitFix, la liste Gestéam des formes
 *   d'envoi ne change pas) :
 *   - LRAR : inchangé, lendemain de la première présentation, pli retiré ou non (D. 1967 art. 64-1, al. 2 ; Cass. 3e civ.,
 *     16/04/2026, n° 24-18.842, FS-B, texte lu sur Légifrance, JURITEXT000054217812) ;
 *   - voie électronique (LRE, CPCE art. R. 53 à R. 53-4, ou procédé d'un prestataire de services de confiance qualifié,
 *     D. 1967 art. 64-5 à 64-9), voie de principe depuis le 25/12/2025 (décret du 22/12/2025, JORF du 24/12/2025, texte
 *     n° 119, art. 14 à 19, sans règle transitoire pour les notifications ; L. 1965 art. 42-1, loi du 9 avril 2024,
 *     art. 38) : lendemain de la TRANSMISSION, par le prestataire, de l'avis électronique (D. 1967 art. 64, dernier
 *     al.) ; ni le dépôt, ni le téléchargement ; date lue, pour le prestataire qualifié, sur son justificatif (art. 64-5 ;
 *     le rappel des 48 heures est sans effet, art. 64-7) et, pour la LRE, sur l'information du destinataire (CPCE
 *     art. R. 53-3, I ; interprétation : les art. 64-5 à 64-9 ne visent que le procédé du 2°) ; un avis antérieur au dépôt
 *     n'est pas une preuve ; échéance calculée comme en J1 ;
 *   - un délai par opposant ou défaillant (D. 1967 art. 18 : « à chacun des copropriétaires opposants ou défaillants ») :
 *     finDelaiContestationAgParDestinataire retient la fin la plus tardive, et la dit inconnue si une notification manque
 *     ou n'est pas prouvée ; sans opposant ni défaillant (nombre saisi : 0), aucune contestation n'est ouverte ; relecture
 *     du 14/11/2026 : un même courrier rattaché à deux opposants est une erreur (données incohérentes : un pli, un
 *     destinataire), un courrier sans destinataire ne prouve rien pour un copropriétaire donné (destinataire_non_renseigne),
 *     une notification prouvée sans statut « Notifiée » enregistré donne statuts_incomplets (pas « non notifiée ») ;
 *   - relecture du 14/11/2026 (tour 2, sondes N1 et N1b) : un courrier déposé, présenté ou avisé avant la ligne qui
 *     précède « Notifiée » (« PV signé », ou la dernière ligne avant « Notifiée » si l'étape est sautée, J2 ; sans
 *     « Notifiée », la dernière ligne) ne notifie pas le procès-verbal de cette assemblée : refus courrier_anterieur_au_pv
 *     (L. 1965 art. 42, al. 2 : délai « à compter de la notification du procès-verbal » ; D. 1967 art. 17, al. 1 :
 *     procès-verbal signé à la fin de la séance ou dans les huit jours suivant la tenue de l'assemblée, texte lu sur
 *     Légifrance le 14/11/2026), dans le calcul par destinataire, le calcul sur une seule notification (attestation de
 *     non-recours) et la preuve R9 ; le jour même de la signature est admis ; limite : sans ligne avant « Notifiée »
 *     (passage de « Projet » hors séquence), rien à comparer ; 🔴 question ouverte : une date d'effet de « PV signé » saisie
 *     trop tard fait refuser une notification régulière, et cette date ne se corrige pas (seul le courrier se rattache
 *     après coup) ;
 *   - régime, accord, consentement et demande de voie postale jugés à la date du dépôt de l'envoi quand elle est saisie
 *     (sinon celle de l'événement), le point de départ restant le lendemain de l'événement (relecture du 14/11/2026,
 *     🔵 interprétation : l'expéditeur suit la règle en vigueur quand il envoie ; sondes P7, S5, S7) ;
 *   - cas limites : envoi électronique à un copropriétaire dont la demande de voie postale était en vigueur (effet le
 *     lendemain du huitième jour suivant sa réception, ou le jour de l'AG si elle y est faite : D. 1967 art. 64-4) : délai
 *     non lancé pour lui (D. 1967 art. 64-1 ; refus voie_postale_demandee) ; avant le 25/12/2025, une demande de voie
 *     postale reçue au plus tard à l'envoi l'exclut aussi, effet retenu à sa réception (L. 1965 art. 42-1, al. 2 depuis le
 *     11/04/2024 ; retrait de l'accord exprès avant ; sonde P6) ; refus ou retrait d'accord enregistré avant le
 *     25/12/2025 : demande de voie postale à sa date de réception (L. 1965 art. 42-1, al. 2 : « par tout moyen » ;
 *     interprétation prudente, aucune source ; voie-notification.ts), s'il est le dernier état des consentements à l'envoi ;
 *     demande, refus ou retrait reçu du 16 au 24/12/2025 dont l'effet actuel (réception + 9 jours) suit l'envoi : délai
 *     calculé, avertissement « à confirmer » (point ouvert) ; LRAR envoyée sans demande de voie postale reçue : délai
 *     calculé, avec un avertissement (lecture du GRECCO, préconisation n° 19, source secondaire) ; notification
 *     électronique antérieure au 25/12/2025 : calculée seulement si l'accord exprès est enregistré, sinon fin inconnue,
 *     le fondement cité suivant la date de l'envoi (L. 1965 art. 42-1, version de la loi n° 2014-366, jusqu'au
 *     10/04/2024 ; puis D. 1967 art. 64-3 de la rédaction en vigueur du 04/07/2020 au 24/12/2025 seul, l'art. 42-1 de la
 *     loi du 9 avril 2024 ayant une portée débattue) ; LRE
 *     vers un non-professionnel (ou dont la qualité n'est pas saisie) sans consentement enregistré (CPCE art. L. 100) :
 *     délai calculé, avec un avertissement « à confirmer » (interprétation : l'art. 64, 1° ne renvoie qu'aux art. R. 53
 *     à R. 53-4, et l'art. 42-1 est une loi spéciale plus récente) ; le procédé du prestataire qualifié n'est pas
 *     concerné ; remise contre émargement, courriel simple, SMS, lettre simple, extranet : ne valent pas notification du
 *     PV (art. 64 et 64-3) ;
 *   - fin tirée d'une seule notification (finDelaiContestationAg, la notification rattachée à la ligne « Notifiée ») :
 *     marquée minimale (finMinimale, avertissement) quand l'AG compte plusieurs opposants ou défaillants, ou quand leur
 *     nombre n'est pas saisi ; le contrôle de l'OS ne lit que le délai par copropriétaire (J51, envoi-ordre-service.ts :
 *     la date seule y est refusée depuis la relecture du 14/11/2026) ;
 *   - reste à confirmer (la variante électronique garde la marque « à confirmer », aConfirmer) : aucune jurisprudence sur
 *     la notification électronique du PV ; consentement de CPCE art. L. 100 face à l'art. 42-1 non tranché ; pour la LRE,
 *     l'« avis » est lu comme l'information de CPCE art. R. 53-3, I ; période du 11/04/2024 au 24/12/2025 (deux lectures,
 *     ici la prudente) ; le point à confirmer de J1 (règle 5) est éclairci pour la numérotation : départ électronique à
 *     l'art. 64-2, al. 2 du 04/07/2020 au 24/12/2025, à l'art. 64, dernier al. depuis le 25/12/2025 ;
 * - J51 (« Oui, bloquer ») : le refus porte sa CAUSE (CauseDelaiNonCalcule) pour que le contrôle de l'OS dise comment
 *   lever le blocage (envoi-ordre-service.ts) ;
 * - ce n'est pas un avis juridique ; France seulement (le Código Civil portugais n'a pas d'équivalent).
 */

/** Ligne d'historique telle que la lisent ces fonctions (sous-ensemble de ChangementStatut). */
export interface LigneHistoriqueStatut {
  entiteType: string
  entiteId: string
  statutNouveau: string
  dateEffet: string
}

/** Ligne d'historique avec ce qu'il faut pour contrôler la chaîne et la preuve de la notification. */
export interface LigneHistoriqueComplete extends LigneHistoriqueStatut {
  statutAncien: string | null
  courrierId: string | null
  horsSequence?: boolean
  motif?: string | null
}

/** Changement prêt à écrire : nouveau statut de l'AG et ligne d'historique (sans champs de suivi). */
export interface ChangementStatutPrepare {
  statut: StatutAssemblee
  changement: {
    entiteType: 'ag'
    entiteId: string
    statutAncien: StatutAssemblee
    statutNouveau: StatutAssemblee
    dateEffet: string
    courrierId: string | null
    horsSequence: boolean
    motif: string | null
  }
}

const rangStatut = (statut: string): number => (STATUT_ASSEMBLEE as readonly string[]).indexOf(statut)

/**
 * Vérifie et prépare un changement de statut d'AG (J2).
 * Lève une erreur si la date d'effet n'est pas une date ISO valide (AAAA-MM-JJ), si le statut est inchangé, en cas
 * de retour arrière, ou en cas de saut d'étape sans motif. Le saut justifié est marqué `horsSequence`.
 */
export function preparerChangementStatutAg(
  ag: { id: string; statut: StatutAssemblee },
  nouveau: StatutAssemblee,
  dateEffet: string,
  courrierId: string | null = null,
  motif: string | null = null,
): ChangementStatutPrepare {
  if (!estDateIsoValide(dateEffet))
    throw new Error(`Date d'effet invalide : « ${dateEffet} » (attendu AAAA-MM-JJ, date de l'acte).`)
  if (ag.statut === nouveau) throw new Error(`L'assemblée est déjà au statut « ${nouveau} ».`)
  const ecart = rangStatut(nouveau) - rangStatut(ag.statut)
  if (ecart < 0)
    throw new Error(`Retour arrière impossible : l'assemblée est au statut « ${ag.statut} », « ${nouveau} » le précède.`)
  const horsSequence = ecart > 1
  const motifNettoye = motif?.trim() || null
  if (horsSequence && !motifNettoye)
    throw new Error(`Passage de « ${ag.statut} » à « ${nouveau} » hors séquence (étape sautée) : un motif est obligatoire.`)
  return {
    statut: nouveau,
    changement: {
      entiteType: 'ag',
      entiteId: ag.id,
      statutAncien: ag.statut,
      statutNouveau: nouveau,
      dateEffet,
      courrierId,
      horsSequence,
      motif: horsSequence ? motifNettoye : null,
    },
  }
}

/** Historique d'une AG, du plus ancien au plus récent par date d'effet (ordre stable à date égale). */
export function historiqueTrie<T extends LigneHistoriqueStatut>(historique: T[], agId: string): T[] {
  return historique
    .filter((ligne) => ligne.entiteType === 'ag' && ligne.entiteId === agId)
    .map((ligne, rang) => ({ ligne, rang }))
    .sort((a, b) => a.ligne.dateEffet.localeCompare(b.ligne.dateEffet) || a.rang - b.rang)
    .map(({ ligne }) => ligne)
}

const derniereNotification = <T extends LigneHistoriqueStatut>(historique: T[], agId: string): T | undefined =>
  historiqueTrie(historique, agId).findLast((ligne) => ligne.statutNouveau === 'Notifiée')

/** Date d'effet (AAAA-MM-JJ) de la dernière notification du PV de l'AG, ou null si elle n'a jamais été notifiée. */
export function dateNotificationAg(historique: LigneHistoriqueStatut[], agId: string): string | null {
  return derniereNotification(historique, agId)?.dateEffet ?? null
}

/**
 * Contrôle la chaîne des statuts d'une AG (J2) : elle part de « Projet », chaque ligne part du statut où la
 * précédente est arrivée, ne recule jamais, et tout saut d'étape est marqué hors séquence avec un motif.
 * Renvoie null si la chaîne est complète, sinon le motif du refus.
 */
export function controlerChaineStatutsAg(historique: LigneHistoriqueComplete[], agId: string): string | null {
  let precedent = 'Projet'
  for (const ligne of historiqueTrie(historique, agId)) {
    const acte = `« ${ligne.statutNouveau} » (${ligne.dateEffet})`
    if (ligne.statutAncien !== precedent)
      return `Chaîne des statuts incomplète : ${acte} part de « ${ligne.statutAncien ?? '—'} » alors que l'assemblée était au statut « ${precedent} ».`
    const ecart = rangStatut(ligne.statutNouveau) - rangStatut(precedent)
    if (ecart <= 0) return `Chaîne des statuts incomplète : retour de « ${precedent} » à ${acte}.`
    if (ecart > 1 && !(ligne.horsSequence && ligne.motif?.trim()))
      return `Chaîne des statuts incomplète : passage de « ${precedent} » à ${acte} sans motif de saut d'étape.`
    precedent = ligne.statutNouveau
  }
  return null
}

export interface RegleDelaiStatut {
  libelle: string
  fondements: ReferenceTexte[]
  jurisprudence: ReferenceJurisprudence[]
  delai: Delai
  /** Report au premier jour ouvrable (CPC art. 642) : paramètre, désactivé par défaut (date la plus courte). */
  reportAuJourOuvrableParDefaut: boolean
  certitude: CertitudeRegle
  note: string
}

/**
 * Délai de contestation des décisions d'assemblée générale par les copropriétaires opposants ou défaillants (J1, J50).
 * Défini ici, à côté du registre REGLES_DELAIS_LEGAUX (règles de mandat, figées par les tests oracle de la maquette),
 * avec les mêmes briques : délai typé, référence de texte, niveau de certitude.
 */
export const DELAI_CONTESTATION_AG_ART42: RegleDelaiStatut = {
  libelle: "Fin du délai de contestation des décisions de l'assemblée générale",
  fondements: [refLoi1965('42, al. 2'), refDecret1967('18'), refDecret1967('64, dernier al.'), refDecret1967('64-1, al. 2')],
  jurisprudence: [
    {
      citation: 'Cass. 3e civ., 16 avr. 2026, n° 24-18.842, FS-B',
      portee:
        'Le délai court, dans tous les cas, à compter du lendemain de la première présentation de la lettre recommandée, que le pli soit retiré ou non.',
      verification: 'TEXTE_LU',
    },
    {
      citation: 'Cass. 3e civ., 26 mars 1997, n° 94-21.498',
      portee: 'Report au premier jour ouvrable (CPC art. 642) appliqué au délai de l’art. 42 al. 2.',
      verification: 'SOURCE_SECONDAIRE',
    },
    {
      citation: 'Cass. 3e civ., 4 juin 2003, n° 02-11.134',
      portee: 'Délai préfix, ni suspendu ni interrompu : pas de report au premier jour ouvrable.',
      verification: 'SOURCE_SECONDAIRE',
    },
  ],
  delai: delaiMois(2),
  reportAuJourOuvrableParDefaut: false,
  certitude: 'A_CONFIRMER',
  note:
    "Deux mois à compter de la notification du procès-verbal (L. 1965 art. 42 al. 2), à chaque opposant ou défaillant (D. 1967 art. 18) : un délai par destinataire, la fin la plus tardive pour l'assemblée. Point de départ : lendemain de la première présentation de la lettre recommandée, que le pli ait été retiré ou non — ni la date d'envoi, ni la date de retrait (D. 1967 art. 64-1, al. 2 ; décision métier J1 du 08/10/2026 ; Cass. 3e civ., 16 avr. 2026) ; pour une notification électronique (LRE ou procédé d'un prestataire qualifié, voie de principe depuis le 25/12/2025), lendemain de la transmission de l'avis électronique par le prestataire, téléchargé ou non (D. 1967 art. 64, dernier al. ; décision J50 du 11/11/2026, à confirmer). Échéance au même quantième que ce lendemain, deux mois plus tard, à minuit (CPC art. 641) : présentée le 4 février, échéance le 5 avril. Le report au premier jour ouvrable (CPC art. 642) est débattu (arrêts de 1997 et de 2003) : paramètre désactivé par défaut, date la plus courte ; si les deux calculs divergent, les deux dates sont affichées. Arrêt du 16 avr. 2026 lu sur Légifrance le 11/11/2026 ; arrêts de 1997 et de 2003 connus par des commentaires publiés, texte intégral non relu.",
}

/** Courrier tel que le lit le moteur de délais (sous-ensemble de Courrier). */
export interface CourrierNotification {
  id: string
  formeEnvoi: string
  dateDepot: string | null
  datePremierePresentation?: string | null
  dateAccuseReception: string | null
  /** Mode de notification (J50) ; absent ou null : « AR » vaut LRAR. */
  modeNotification?: ModeNotification | null
  /** Transmission de l'avis électronique par le prestataire (J50). */
  dateAvisElectronique?: string | null
  /** Destinataire (identité) : rapprochement des demandes de voie postale et des consentements (J50). */
  personneId?: string | null
}

/** Pourquoi la fin du délai n'est pas calculée (J51 : le contrôle de l'OS dit comment lever le blocage). */
export const CAUSES_DELAI_NON_CALCULE = [
  'statuts_incomplets',
  'notification_absente',
  'courrier_introuvable',
  'destinataire_different',
  'destinataire_non_renseigne',
  'courrier_anterieur_au_pv',
  'envoi_non_qualifie',
  'preuve_a_saisir',
  'voie_postale_demandee',
  'accord_electronique_absent',
  'opposants_non_saisis',
] as const
export type CauseDelaiNonCalcule = (typeof CAUSES_DELAI_NON_CALCULE)[number]

export interface DelaiRefuse {
  etat: 'refuse'
  cause: CauseDelaiNonCalcule
  motif: string
}

export interface DelaiCalcule {
  etat: 'calcule'
  /** Mode de notification qui fait courir le délai (J50). */
  mode: ModeNotification
  /** Première présentation (LRAR) ou transmission de l'avis électronique (LRE, prestataire qualifié). */
  dateEvenement: string
  /** Première présentation du pli (LRAR) ; null pour une notification électronique. */
  datePremierePresentation: string | null
  /** Lendemain de l'événement : jour à partir duquel le délai court. */
  pointDeDepart: string
  /** Même quantième deux mois plus tard, sans report. */
  echeanceSansReport: string
  /** Même échéance reportée au premier jour ouvrable. */
  echeanceAvecReport: string
  /** Échéance retenue selon le paramètre de report. */
  echeanceRetenue: string
  reportApplique: boolean
  /** Les deux calculs divergent : l'écran doit afficher les deux dates. */
  divergence: boolean
  /** Le calcul en toutes lettres, vérifiable par le gestionnaire. */
  justification: string
  avertissements: string[]
  /**
   * Fin tirée d'une seule notification alors que l'AG compte plusieurs opposants ou défaillants, ou que leur nombre
   * n'est pas saisi (J50) : la fin réelle peut être plus tardive.
   */
  finMinimale: boolean
  /** Variante électronique à confirmer (J50) ; null pour la LRAR. */
  aConfirmer: string | null
}

export type ResultatDelaiContestation = { etat: 'non_notifiee' } | DelaiRefuse | DelaiCalcule

/** Demandes de voie postale et consentements à la voie électronique (voie-notification.ts) ; absents : aucun enregistré. */
export interface ContexteVoieNotification {
  demandesVoiePostale?: readonly DemandeVoiePostale[]
  consentements?: readonly ConsentementVoieElectronique[]
}

const fr = dateIsoVersFr

const MOTIF_ENVOI_NON_QUALIFIE =
  "Le courrier rattaché n'est ni un envoi en AR ni une notification électronique (LRE ou prestataire qualifié) : il ne vaut pas notification du procès-verbal (D. 1967 art. 64, 64-1 et 64-3)."

const AVERTISSEMENT_LRAR_HORS_DEMANDE =
  'LRAR sans demande de voie postale enregistrée : délai calculé, validité à confirmer (L. 1965 art. 42-1 ; D. 1967 art. 64-1 ; lecture du GRECCO, préconisation n° 19, source secondaire).'

const AVERTISSEMENT_LRE_SANS_CONSENTEMENT =
  "LRE à un destinataire non professionnel (ou dont la qualité n'est pas saisie) sans consentement enregistré aux envois recommandés électroniques (CPCE art. L. 100) : délai calculé, à confirmer (D. 1967 art. 64, 1° ne renvoie qu'aux art. R. 53 à R. 53-4 du CPCE)."

const A_CONFIRMER_ELECTRONIQUE: Readonly<Record<Exclude<ModeNotification, 'lrar'>, string>> = {
  lre: "Variante électronique (J50) à confirmer : aucune jurisprudence sur la notification électronique du procès-verbal ; pour une LRE, l'avis est lu comme l'information du destinataire de CPCE art. R. 53-3, I, et le consentement de CPCE art. L. 100 n'est pas tranché face à L. 1965 art. 42-1.",
  prestataire_qualifie: 'Variante électronique (J50) à confirmer : aucune jurisprudence sur la notification électronique du procès-verbal.',
}

const MOTIF_SANS_CONTESTATION =
  "Aucun opposant ni défaillant : aucune contestation n'est ouverte, aucun délai à attendre (L. 1965 art. 42, al. 2 ; D. 1967 art. 18 ; interprétation à confirmer)."

const refus = (cause: CauseDelaiNonCalcule, motif: string): DelaiRefuse => ({ etat: 'refuse', cause, motif: `Délai non calculé. ${motif}` })

type PreuveNotification = { courrier: CourrierNotification; mode: ModeNotification; evenement: string } | { cause: CauseDelaiNonCalcule; motif: string }

type ModeElectronique = Exclude<ModeNotification, 'lrar'>

/**
 * Où lire la date de transmission de l'avis, selon le mode (relecture du 14/11/2026) : les art. 64-5 à 64-9 du D. 1967
 * ne visent que le procédé du prestataire qualifié (art. 64, 2°) ; pour la LRE (art. 64, 1°), l'avis est lu comme
 * l'information du destinataire de CPCE art. R. 53-3, I (🔵 interprétation).
 */
const SOURCE_AVIS: Readonly<Record<ModeElectronique, string>> = {
  lre: "l'information du destinataire (CPCE art. R. 53-3, I)",
  prestataire_qualifie: 'le justificatif de transmission du prestataire qualifié (D. 1967 art. 64-5)',
}

const MOTIF_AVIS_NON_SAISI: Readonly<Record<ModeElectronique, string>> = {
  lre: "La date de transmission de l'avis électronique n'est pas saisie (D. 1967 art. 64, dernier al. ; pour une LRE, information du destinataire par le prestataire, CPCE art. R. 53-3, I, lecture à confirmer).",
  prestataire_qualifie:
    "La date de transmission de l'avis électronique par le prestataire qualifié n'est pas saisie (justificatif de transmission, D. 1967 art. 64-5).",
}

/** Ligne de l'historique qui précède la notification du PV : un courrier antérieur ne notifie pas ce PV. */
interface BorneProcesVerbal {
  statut: string
  date: string
}

/**
 * Borne des courriers de notification (relecture du 14/11/2026, tour 2, sondes N1 et N1b) : la ligne qui précède
 * « Notifiée » dans l'historique trié, « PV signé », ou la dernière ligne avant « Notifiée » si l'étape est sautée (J2) ;
 * sans « Notifiée », la dernière ligne (celle que « Notifiée » suivra). null : aucune ligne avant (« Notifiée » est la
 * première, passage de « Projet » hors séquence), rien à comparer.
 */
function borneProcesVerbal(historique: LigneHistoriqueStatut[], agId: string): BorneProcesVerbal | null {
  const lignes = historiqueTrie(historique, agId)
  const rang = lignes.findLastIndex((ligne) => ligne.statutNouveau === 'Notifiée')
  let precedente: LigneHistoriqueStatut | undefined
  if (rang === -1) precedente = lignes.at(-1)
  else if (rang > 0) precedente = lignes[rang - 1]
  return precedente === undefined ? null : { statut: precedente.statutNouveau, date: precedente.dateEffet }
}

const etapeProcesVerbal = (borne: BorneProcesVerbal): string =>
  borne.statut === 'PV signé'
    ? `la signature du procès-verbal (${fr(borne.date)})`
    : `le statut « ${borne.statut} » de l'assemblée (${fr(borne.date)})`

const MOTIF_PV_SIGNE_APRES =
  "il ne peut pas notifier le procès-verbal de cette assemblée, signé après lui (L. 1965 art. 42, al. 2 : délai « à compter de la notification du procès-verbal » ; D. 1967 art. 17, al. 1 : procès-verbal signé à la fin de la séance ou dans les huit jours suivant la tenue de l'assemblée)."

/** Refus d'un courrier daté (dépôt, première présentation, transmission de l'avis) avant la borne ; null sinon. */
function courrierAnterieur(
  courrier: CourrierNotification,
  date: string | null,
  quoi: string,
  borne: BorneProcesVerbal | null,
): { cause: CauseDelaiNonCalcule; motif: string } | null {
  if (borne === null || date === null || date >= borne.date) return null
  return {
    cause: 'courrier_anterieur_au_pv',
    motif: `Le courrier rattaché (id=${courrier.id}) date du ${fr(date)} (${quoi}), avant ${etapeProcesVerbal(borne)} : ${MOTIF_PV_SIGNE_APRES}`,
  }
}

/**
 * Courrier qui prouve la notification (LRAR présentée, ou avis électronique transmis : J1, J50), ou le motif pour lequel
 * elle n'est pas prouvée. `identiteId` : destinataire attendu (calcul par opposant ou défaillant : le courrier doit lui
 * être adressé, D. 1967 art. 18) ; null, non contrôlé. Un avis antérieur au dépôt n'est pas une preuve (comme à la saisie,
 * controlerAvisElectronique). `borne` : un courrier déposé, présenté ou avisé avant elle ne notifie pas le PV de cette
 * assemblée (courrier_anterieur_au_pv ; relecture du 14/11/2026, tour 2) ; null, non contrôlé.
 */
function courrierPreuve(
  courrierId: string | null,
  courriers: readonly CourrierNotification[],
  identiteId: string | null,
  borne: BorneProcesVerbal | null,
): PreuveNotification {
  if (!courrierId) return { cause: 'notification_absente', motif: 'Aucun courrier rattaché à la notification.' }
  const courrier = courriers.find((candidat) => candidat.id === courrierId)
  if (!courrier) return { cause: 'courrier_introuvable', motif: `Courrier rattaché introuvable (id=${courrierId}).` }
  const destinataire = courrier.personneId ?? null
  if (identiteId !== null && destinataire === null)
    return {
      cause: 'destinataire_non_renseigne',
      motif: `Destinataire du courrier rattaché (id=${courrier.id}) non renseigné : rien ne montre qu'il notifie le procès-verbal à ce copropriétaire (D. 1967 art. 18 : notification « à chacun des copropriétaires opposants ou défaillants »).`,
    }
  if (identiteId !== null && destinataire !== identiteId)
    return {
      cause: 'destinataire_different',
      motif: `Le courrier rattaché (id=${courrier.id}) est adressé à une autre personne (identité ${destinataire}) : il ne notifie pas le procès-verbal à ce copropriétaire (D. 1967 art. 18).`,
    }
  const deposeAvant = courrierAnterieur(courrier, courrier.dateDepot, 'dépôt', borne)
  if (deposeAvant !== null) return deposeAvant
  const mode = modeNotificationCourrier(courrier)
  if (mode === null)
    return {
      cause: 'envoi_non_qualifie',
      motif: courrier.modeNotification
        ? `Le mode de notification du courrier rattaché (« ${courrier.modeNotification} ») ne correspond pas à sa forme d'envoi (« ${courrier.formeEnvoi} ») : il ne vaut pas notification (D. 1967 art. 64, 64-1).`
        : MOTIF_ENVOI_NON_QUALIFIE,
    }
  if (mode === 'lrar') {
    const presentation = courrier.datePremierePresentation ?? null
    if (!presentation) return { cause: 'preuve_a_saisir', motif: "La date de première présentation du pli n'est pas saisie." }
    return courrierAnterieur(courrier, presentation, 'première présentation', borne) ?? { courrier, mode, evenement: presentation }
  }
  const avis = courrier.dateAvisElectronique ?? null
  if (!avis) return { cause: 'preuve_a_saisir', motif: MOTIF_AVIS_NON_SAISI[mode] }
  if (courrier.dateDepot && avis < courrier.dateDepot)
    return {
      cause: 'preuve_a_saisir',
      motif: `La date de transmission de l'avis électronique saisie (${fr(avis)}) précède le dépôt de l'envoi (${fr(courrier.dateDepot)}) : la corriger d'après ${SOURCE_AVIS[mode]}.`,
    }
  return courrierAnterieur(courrier, avis, "transmission de l'avis électronique", borne) ?? { courrier, mode, evenement: avis }
}

const REDACTION_2020 = `rédaction en vigueur du ${fr(ENTREE_EN_VIGUEUR_DECRET_2020)} au ${fr(ajouterJours(ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE, -1))}`
const REDACTION_ANTERIEURE_2020 = `rédaction antérieure au ${fr(ENTREE_EN_VIGUEUR_DECRET_2020)}`

/**
 * Fondement de l'accord exprès exigé avant le 25/12/2025, selon la date de l'envoi (relecture du 14/11/2026) : jusqu'au
 * 10/04/2024, la loi l'exigeait (L. 1965 art. 42-1, version de la loi n° 2014-366) ; du 11/04/2024 au 24/12/2025, le seul
 * décret (art. 64-3, rédaction en vigueur du 04/07/2020 au 24/12/2025), alors que l'art. 42-1 disait déjà « valablement faites par voie électronique » :
 * portée débattue, lecture prudente.
 */
function fondementAccordExpres(dateEnvoi: string): string {
  if (dateEnvoi < ENTREE_EN_VIGUEUR_DECRET_2020) return `L. 1965 art. 42-1, version de la loi n° 2014-366 ; D. 1967 art. 64 à 64-4, ${REDACTION_ANTERIEURE_2020}`
  if (dateEnvoi < ENTREE_EN_VIGUEUR_ART_42_1_LOI_2024) return `L. 1965 art. 42-1, version de la loi n° 2014-366 ; D. 1967 art. 64-3, ${REDACTION_2020}`
  return `D. 1967 art. 64-3, ${REDACTION_2020} ; L. 1965 art. 42-1, version de la loi du 9 avril 2024 : portée débattue, deux lectures selon le GRECCO, préconisation n° 19, source secondaire ; lecture prudente retenue`
}

/**
 * Fondement d'une demande de voie postale reçue avant le 25/12/2025 (relecture du 14/11/2026, sonde P6) : depuis le
 * 11/04/2024, la demande « à tout moment et par tout moyen » de L. 1965 art. 42-1, al. 2 ; avant, un retrait de l'accord
 * exprès. Effet retenu à sa réception (prudence : le délai de huit jours de l'art. 64-4 actuel n'existait pas).
 */
function fondementDemandeAncienRegime(recueLe: string): string {
  if (recueLe < ENTREE_EN_VIGUEUR_DECRET_2020)
    return `retrait de l'accord exprès à la voie électronique, D. 1967 art. 64 à 64-4, ${REDACTION_ANTERIEURE_2020} ; effet retenu à sa réception`
  if (recueLe < ENTREE_EN_VIGUEUR_ART_42_1_LOI_2024)
    return `retrait de l'accord exprès à la voie électronique, D. 1967 art. 64-4, ${REDACTION_2020} ; effet retenu à sa réception`
  return `« à tout moment et par tout moyen », L. 1965 art. 42-1, al. 2, version de la loi du 9 avril 2024 ; elle vaut au moins retrait de l'accord exprès, D. 1967 art. 64-4, ${REDACTION_2020} ; effet retenu à sa réception, le délai de huit jours de l'art. 64-4 actuel n'existait pas`
}

/**
 * Demande (ou refus, ou retrait, converti en demande) reçue avant le 25/12/2025 dont l'effet, selon la règle actuelle
 * (réception + 9 jours, D. 1967 art. 64-4), tombe après l'envoi électronique (relecture du 14/11/2026, sonde P9 : reçue du
 * 16 au 24/12/2025) : délai calculé, avertissement « à confirmer » ; sous l'ancienne règle, elle excluait déjà la voie
 * électronique. Point ouvert (question à Hugo ; variante plus prudente : refus, effet à la réception).
 */
function avertissementsTransitoires(demandes: readonly DemandeVoiePostale[], identite: string, dateEnvoi: string): string[] {
  return demandes
    .filter((d) => d.identiteId === identite && d.recueLe < ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE && effetDemandeVoiePostale(d) > dateEnvoi)
    .map(
      (d) =>
        `Refus de la voie électronique, retrait de l'accord ou demande de voie postale reçu le ${fr(d.recueLe)}, avant le ${fr(ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE)} : selon la règle actuelle, effet le ${fr(effetDemandeVoiePostale(d))}, après l'envoi électronique du ${fr(dateEnvoi)} ; sous l'ancienne règle, il excluait déjà la voie électronique. Délai calculé, à confirmer (D. 1967 art. 64-4 ; décret du 22/12/2025 sans règle transitoire ; point ouvert, question à Hugo).`,
    )
}

/**
 * Voie de notification face au mode (J50) : refus quand le délai ne court pas pour ce copropriétaire (voie postale
 * demandée, accord exprès absent avant le 25/12/2025), avertissements sinon. Le régime (avant ou depuis le 25/12/2025),
 * l'accord, le consentement et la demande de voie postale sont jugés à la date de l'ENVOI (`dateEnvoi` : dépôt, à défaut
 * l'événement ; relecture du 14/11/2026, 🔵 interprétation) ; le point de départ reste le lendemain de l'événement.
 */
function controlerVoie(
  mode: ModeNotification,
  dateEnvoi: string,
  identiteId: string | null,
  professionnel: boolean | null,
  voie: ContexteVoieNotification,
): { cause: CauseDelaiNonCalcule; motif: string } | { avertissements: string[] } {
  const consentements = voie.consentements ?? []
  const demandesSaisies = voie.demandesVoiePostale ?? []
  const avertissements: string[] = []
  if (identiteId === null && (demandesSaisies.length > 0 || consentements.length > 0))
    avertissements.push(
      "Destinataire du courrier non renseigné : les demandes de voie postale et les consentements enregistrés n'ont pas pu lui être rapprochés.",
    )
  const identite = identiteId ?? ''
  const electronique = estModeElectronique(mode)
  const accord = () => accordElectroniqueEnVigueur({ identiteId: identite, consentements, date: dateEnvoi })
  if (dateEnvoi < ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE) {
    if (!electronique) return { avertissements }
    const demande = demandesSaisies
      .filter((d) => d.identiteId === identite && d.recueLe <= dateEnvoi)
      .sort((a, b) => a.recueLe.localeCompare(b.recueLe))[0]
    if (demande !== undefined)
      return {
        cause: 'voie_postale_demandee',
        motif: `Voie postale demandée par ce copropriétaire, demande reçue le ${fr(demande.recueLe)} (${fondementDemandeAncienRegime(demande.recueLe)}) : l'envoi électronique du ${fr(dateEnvoi)} ne fait pas courir le délai pour lui ; le notifier par lettre recommandée avec avis de réception (D. 1967 art. 64-1).`,
      }
    if (accord() === null)
      return {
        cause: 'accord_electronique_absent',
        motif: `Notification électronique envoyée le ${fr(dateEnvoi)}, avant le ${fr(ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE)} : accord exprès du copropriétaire à la voie électronique non enregistré (${fondementAccordExpres(dateEnvoi)}).`,
      }
    return { avertissements }
  }
  const demandes = [...demandesSaisies, ...demandesDepuisConsentements(consentements, dateEnvoi)]
  const { voie: voieApplicable, depuis } = voieDeNotification({ identiteId: identite, demandes, date: dateEnvoi })
  if (electronique && voieApplicable === 'postale')
    return {
      cause: 'voie_postale_demandee',
      motif: `Voie postale demandée par ce copropriétaire (effet le ${fr(depuis ?? dateEnvoi)}) : l'envoi électronique du ${fr(dateEnvoi)} ne fait pas courir le délai pour lui ; le notifier par lettre recommandée avec avis de réception (D. 1967 art. 64-1, 64-4).`,
    }
  if (electronique) avertissements.push(...avertissementsTransitoires(demandes, identite, dateEnvoi))
  // LRAR : avertissement seulement si aucune demande n'est reçue à l'envoi (une demande reçue, même pas encore effective,
  // justifie la voie postale ; relecture du 14/11/2026)
  if (!electronique && !demandes.some((d) => d.identiteId === identite && d.recueLe <= dateEnvoi)) avertissements.push(AVERTISSEMENT_LRAR_HORS_DEMANDE)
  if (mode === 'lre' && professionnel !== true && accord() === null) avertissements.push(AVERTISSEMENT_LRE_SANS_CONSENTEMENT)
  return { avertissements }
}

/** Échéances et justification d'une notification prouvée (J1, J50). */
function calculerDelai(mode: ModeNotification, evenement: string, avertissements: string[], reporterAuJourOuvrable: boolean): DelaiCalcule {
  const pointDeDepart = ajouterJours(evenement, 1)
  const echeanceSansReport = appliquerDelai(pointDeDepart, DELAI_CONTESTATION_AG_ART42.delai)
  const echeanceAvecReport = reporterJourOuvrable(echeanceSansReport)
  const divergence = echeanceSansReport !== echeanceAvecReport
  const depart =
    mode === 'lrar'
      ? `Deux mois à compter du lendemain de la première présentation du ${fr(evenement)} (départ le ${fr(pointDeDepart)})`
      : `Deux mois à compter du lendemain de la transmission de l'avis électronique par le prestataire, le ${fr(evenement)} (départ le ${fr(pointDeDepart)})`
  const fondement = mode === 'lrar' ? 'L. 1965 art. 42, al. 2.' : 'L. 1965 art. 42, al. 2 ; D. 1967 art. 64, dernier al.'
  let justification = `${depart} : échéance le ${fr(echeanceSansReport)} à minuit — ${fondement}`
  if (divergence)
    justification = reporterAuJourOuvrable
      ? `${depart} : échéance reportée au premier jour ouvrable, le ${fr(echeanceAvecReport)} à minuit — ${fondement} Report débattu : le ${fr(echeanceSansReport)} sans report.`
      : `${justification} Report au jour ouvrable débattu : le ${fr(echeanceAvecReport)} si on l’applique.`
  return {
    etat: 'calcule',
    mode,
    dateEvenement: evenement,
    datePremierePresentation: mode === 'lrar' ? evenement : null,
    pointDeDepart,
    echeanceSansReport,
    echeanceAvecReport,
    echeanceRetenue: reporterAuJourOuvrable ? echeanceAvecReport : echeanceSansReport,
    reportApplique: reporterAuJourOuvrable,
    divergence,
    justification,
    avertissements,
    finMinimale: false,
    aConfirmer: mode === 'lrar' ? null : A_CONFIRMER_ELECTRONIQUE[mode],
  }
}

interface ParametresNotification {
  /** Destinataire attendu ; null : celui du courrier. */
  identiteId: string | null
  professionnel: boolean | null
  voie: ContexteVoieNotification
  reporterAuJourOuvrable: boolean
  /** Ligne qui précède la notification (borneProcesVerbal) : un courrier antérieur ne notifie pas ce PV. */
  borne: BorneProcesVerbal | null
}

/** Délai d'une notification : refus (motif sans préfixe) ou calcul (J1, J50). */
function evaluerNotification(courrierId: string | null, courriers: readonly CourrierNotification[], p: ParametresNotification): DelaiRefuse | DelaiCalcule {
  const preuve = courrierPreuve(courrierId, courriers, p.identiteId, p.borne)
  if ('motif' in preuve) return { etat: 'refuse', cause: preuve.cause, motif: preuve.motif }
  const identite = p.identiteId ?? preuve.courrier.personneId ?? null
  // date de l'envoi : le dépôt, s'il est saisi et ne suit pas l'événement ; à défaut, l'événement (relecture du 14/11/2026)
  const depot = preuve.courrier.dateDepot ?? null
  const dateEnvoi = depot !== null && depot <= preuve.evenement ? depot : preuve.evenement
  const voie = controlerVoie(preuve.mode, dateEnvoi, identite, p.professionnel, p.voie)
  if ('motif' in voie) return { etat: 'refuse', cause: voie.cause, motif: voie.motif }
  return calculerDelai(preuve.mode, preuve.evenement, voie.avertissements, p.reporterAuJourOuvrable)
}

function verifierNombreOpposants(nombre: number | null): void {
  if (nombre !== null && (!Number.isInteger(nombre) || nombre < 0))
    throw new Error(`Nombre d'opposants et de défaillants invalide (${nombre}) : entier positif ou nul attendu.`)
}

/** Fin tirée d'une seule notification : avertissement « fin minimale » (J50), sauf pour un seul opposant ou défaillant. */
function avertissementFinMinimale(opposantsOuDefaillants: number | null): string | null {
  const suite = "un autre a pu être notifié plus tard (D. 1967 art. 18 : un délai par opposant ou défaillant). Calculer le délai de chacun."
  if (opposantsOuDefaillants === null)
    return `Fin minimale : tirée d'une seule notification, nombre d'opposants et de défaillants non saisi ; ${suite}`
  if (opposantsOuDefaillants > 1)
    return `Fin minimale : tirée d'une seule notification alors que l'assemblée compte ${opposantsOuDefaillants} opposants ou défaillants ; ${suite}`
  return null
}

export interface OptionsDelaiContestation {
  reporterAuJourOuvrable?: boolean
  /** Nombre d'opposants et de défaillants de l'AG (D. 1967 art. 18) ; absent ou null : non saisi (fin minimale). */
  opposantsOuDefaillants?: number | null
  voie?: ContexteVoieNotification
  /** Destinataire professionnel (CPCE art. L. 100) ; absent ou null : non saisi, lu comme non professionnel. */
  professionnel?: boolean | null
}

/**
 * Fin du délai de contestation de l'art. 42 d'après la notification rattachée à la ligne « Notifiée » (J1, J2, J50).
 * Refuse de calculer, avec sa cause et un motif explicite, sur une chaîne de statuts incomplète, sans courrier qui
 * prouve la notification (LRAR présentée ou avis électronique transmis), ou quand le délai ne court pas pour ce
 * destinataire (voie postale demandée, accord exprès absent avant le 25/12/2025), ou quand le courrier précède la ligne
 * qui précède « Notifiée » (courrier_anterieur_au_pv). Le point de départ est l'événement du mode, jamais la date d'effet
 * saisie, de dépôt ou de retrait. Fin marquée minimale sauf pour un seul opposant ou défaillant :
 * finDelaiContestationAgParDestinataire donne la fin de l'AG.
 */
export function finDelaiContestationAg(
  historique: LigneHistoriqueComplete[],
  courriers: readonly CourrierNotification[],
  agId: string,
  {
    reporterAuJourOuvrable = DELAI_CONTESTATION_AG_ART42.reportAuJourOuvrableParDefaut,
    opposantsOuDefaillants = null,
    voie = {},
    professionnel = null,
  }: OptionsDelaiContestation = {},
): ResultatDelaiContestation {
  verifierNombreOpposants(opposantsOuDefaillants)
  const notification = derniereNotification(historique, agId)
  if (!notification) return { etat: 'non_notifiee' }
  const motifChaine = controlerChaineStatutsAg(historique, agId)
  if (motifChaine) return refus('statuts_incomplets', motifChaine)
  const resultat = evaluerNotification(notification.courrierId, courriers, {
    identiteId: null,
    professionnel,
    voie,
    reporterAuJourOuvrable,
    borne: borneProcesVerbal(historique, agId),
  })
  if (resultat.etat === 'refuse') return refus(resultat.cause, resultat.motif)
  const evenementNomme = resultat.mode === 'lrar' ? 'la première présentation du pli' : "la transmission de l'avis électronique"
  const suivi = resultat.mode === 'lrar' ? 'la première présentation' : "la transmission de l'avis"
  const avertissementDateEffet =
    notification.dateEffet === resultat.dateEvenement
      ? []
      : [
          `La date d'effet saisie pour la notification (${notification.dateEffet}) diffère de ${evenementNomme} (${resultat.dateEvenement}) : le délai suit ${suivi}.`,
        ]
  const minimale = avertissementFinMinimale(opposantsOuDefaillants)
  return {
    ...resultat,
    avertissements: [...avertissementDateEffet, ...resultat.avertissements, ...(minimale === null ? [] : [minimale])],
    finMinimale: minimale !== null,
  }
}

// ── Un délai par opposant ou défaillant (J50 ; D. 1967 art. 18) ──────────────────────────────────────────────────

/** Notification du PV à un opposant ou défaillant. */
export interface NotificationDestinataire {
  /** Opposant ou défaillant (identité). */
  identiteId: string
  /** Courrier qui lui notifie le procès-verbal ; null : pas encore notifié. */
  courrierId: string | null
  /** Destinataire professionnel (CPCE art. L. 100) ; absent ou null : non saisi, lu comme non professionnel. */
  professionnel?: boolean | null
}

export type ResultatDestinataire = (DelaiRefuse | DelaiCalcule) & { identiteId: string }

export type ResultatDelaiContestationAg =
  | { etat: 'non_notifiee' }
  /** Aucun opposant ni défaillant (nombre saisi) : aucune contestation n'est ouverte. */
  | { etat: 'sans_contestation'; motif: string }
  | { etat: 'refuse'; cause: CauseDelaiNonCalcule; motif: string; destinataires: ResultatDestinataire[] }
  | {
      etat: 'calcule'
      /** Fin retenue pour l'affichage (J1) : la plus tardive des échéances retenues. */
      echeanceRetenue: string
      /** Fin la plus tardive, report au jour ouvrable compris : la date prudente pour attendre (J51, contrôle de l'OS). */
      echeanceLaPlusTardive: string
      /** Destinataire dont l'échéance retenue est la plus tardive. */
      dernierDestinataire: string
      destinataires: ResultatDestinataire[]
      justification: string
      avertissements: string[]
      aConfirmer: string | null
    }

/** La plus tardive des deux échéances d'un délai calculé (report au jour ouvrable compris). */
export const echeanceLaPlusTardiveDe = (r: Pick<DelaiCalcule, 'echeanceSansReport' | 'echeanceAvecReport'>): string =>
  r.echeanceAvecReport > r.echeanceSansReport ? r.echeanceAvecReport : r.echeanceSansReport

function verifierNotifications(notifications: readonly NotificationDestinataire[], opposantsOuDefaillants: number | null): void {
  const vues = new Set<string>()
  // un courrier (LRAR, LRE, prestataire) va à une seule personne : il ne notifie pas deux opposants (relecture du 14/11/2026)
  const identiteParCourrier = new Map<string, string>()
  for (const n of notifications) {
    if (!n.identiteId.trim()) throw new Error('Notification du procès-verbal : identité du destinataire attendue.')
    if (vues.has(n.identiteId)) throw new Error(`Identité ${n.identiteId} en double dans les notifications du procès-verbal.`)
    vues.add(n.identiteId)
    if (n.courrierId === null) continue
    const deja = identiteParCourrier.get(n.courrierId)
    if (deja !== undefined)
      throw new Error(
        `Courrier ${n.courrierId} rattaché à deux opposants ou défaillants (identités ${deja} et ${n.identiteId}) : une notification par copropriétaire (D. 1967 art. 18), données incohérentes.`,
      )
    identiteParCourrier.set(n.courrierId, n.identiteId)
  }
  if (opposantsOuDefaillants !== null && notifications.length > opposantsOuDefaillants)
    throw new Error(
      `${notifications.length} notification(s) fournie(s) pour ${opposantsOuDefaillants} opposant(s) ou défaillant(s) : données incohérentes.`,
    )
}

const estCalcule = (r: ResultatDestinataire): r is DelaiCalcule & { identiteId: string } => r.etat === 'calcule'

const opposants = (n: number): string => (n > 1 ? `${n} opposants ou défaillants` : `${n} opposant ou défaillant`)

/**
 * Fin du délai de contestation de l'AG, calculée pour chaque opposant ou défaillant (J50 ; D. 1967 art. 18) : la plus
 * tardive ; inconnue (refus, avec sa cause) si le nombre d'opposants et de défaillants n'est pas saisi, si l'un d'eux n'a
 * pas de notification rattachée, ou si le délai d'une notification n'est pas calculé (dont un courrier antérieur à la
 * ligne qui précède « Notifiée » : courrier_anterieur_au_pv, relecture du 14/11/2026, tour 2). Sans opposant ni
 * défaillant (0), aucune contestation n'est ouverte, même sans notification. Plus de notifications que d'opposants, ou
 * une identité en double : erreur (données incohérentes).
 */
export function finDelaiContestationAgParDestinataire(
  historique: LigneHistoriqueComplete[],
  courriers: readonly CourrierNotification[],
  agId: string,
  {
    opposantsOuDefaillants,
    notifications,
    voie = {},
    reporterAuJourOuvrable = DELAI_CONTESTATION_AG_ART42.reportAuJourOuvrableParDefaut,
  }: {
    opposantsOuDefaillants: number | null
    notifications: readonly NotificationDestinataire[]
    voie?: ContexteVoieNotification
    reporterAuJourOuvrable?: boolean
  },
): ResultatDelaiContestationAg {
  verifierNombreOpposants(opposantsOuDefaillants)
  verifierNotifications(notifications, opposantsOuDefaillants)
  if (opposantsOuDefaillants === 0) return { etat: 'sans_contestation', motif: MOTIF_SANS_CONTESTATION }
  // un courrier antérieur à la ligne qui précède « Notifiée » ne notifie pas ce PV (sondes N1, N1b)
  const borne = borneProcesVerbal(historique, agId)
  const destinataires: ResultatDestinataire[] = notifications.map((n) => ({
    ...evaluerNotification(n.courrierId, courriers, { identiteId: n.identiteId, professionnel: n.professionnel ?? null, voie, reporterAuJourOuvrable, borne }),
    identiteId: n.identiteId,
  }))
  if (!derniereNotification(historique, agId)) {
    // notification prouvée, statut « Notifiée » non enregistré : compléter l'historique, pas notifier de nouveau (sonde S4)
    const prouvees = destinataires.filter(estCalcule).map((r) => r.identiteId)
    if (prouvees.length === 0) return { etat: 'non_notifiee' }
    return {
      ...refus(
        'statuts_incomplets',
        `Statut « Notifiée » de l'assemblée non enregistré alors que la notification du procès-verbal est prouvée (${prouvees.length > 1 ? 'identités' : 'identité'} ${prouvees.join(', ')}) : l'enregistrer à la date de la notification (décision J2).`,
      ),
      destinataires,
    }
  }
  const motifChaine = controlerChaineStatutsAg(historique, agId)
  if (motifChaine) return { ...refus('statuts_incomplets', motifChaine), destinataires: [] }
  if (opposantsOuDefaillants === null)
    return { ...refus('opposants_non_saisis', "Nombre d'opposants et de défaillants non saisi (D. 1967 art. 18)."), destinataires: [] }
  const motifs: string[] = []
  let cause: CauseDelaiNonCalcule | null = null
  for (const r of destinataires)
    if (r.etat === 'refuse') {
      motifs.push(`Identité ${r.identiteId} : ${r.motif}`)
      cause ??= r.cause
    }
  const manquants = opposantsOuDefaillants - notifications.length
  if (manquants > 0) motifs.push(`${opposants(manquants)} sur ${opposantsOuDefaillants} sans notification rattachée (D. 1967 art. 18).`)
  if (motifs.length > 0) return { ...refus(cause ?? 'notification_absente', motifs.join(' ')), destinataires }
  const calcules = destinataires.filter(estCalcule)
  let dernier = calcules[0]
  let laPlusTardive = echeanceLaPlusTardiveDe(dernier)
  for (const r of calcules) {
    if (r.echeanceRetenue > dernier.echeanceRetenue) dernier = r
    const echeance = echeanceLaPlusTardiveDe(r)
    if (echeance > laPlusTardive) laPlusTardive = echeance
  }
  const entete =
    calcules.length > 1
      ? `Fin la plus tardive des ${calcules.length} délais (un par opposant ou défaillant, D. 1967 art. 18)`
      : 'Fin du délai du seul opposant ou défaillant (D. 1967 art. 18)'
  const report = laPlusTardive === dernier.echeanceRetenue ? '' : ` Report au jour ouvrable débattu : le ${fr(laPlusTardive)} si on l’applique.`
  return {
    etat: 'calcule',
    echeanceRetenue: dernier.echeanceRetenue,
    echeanceLaPlusTardive: laPlusTardive,
    dernierDestinataire: dernier.identiteId,
    destinataires,
    justification: `${entete} : le ${fr(dernier.echeanceRetenue)} à minuit (identité ${dernier.identiteId}) — L. 1965 art. 42, al. 2.${report}`,
    avertissements: calcules.flatMap((r) => r.avertissements.map((a) => `Identité ${r.identiteId} : ${a}`)),
    aConfirmer: (calcules.find((r) => r.mode === 'lre') ?? calcules.find((r) => r.aConfirmer !== null))?.aConfirmer ?? null,
  }
}

/**
 * Dernière fin du délai de contestation sur une liste de délais (un par opposant ou défaillant) : la plus tardive des deux
 * calculs (report compris), et son rang ; ou la cause et le motif qui empêchent de la connaître (reprise de
 * l'attestation de non-recours, gabarits-courrier.ts). Liste vide : erreur.
 */
export function derniereFinDelaiContestation(
  resultats: readonly ResultatDelaiContestation[],
): { echeance: string; rang: number } | { cause: CauseDelaiNonCalcule | 'pv_non_notifie'; motif: string } {
  if (resultats.length === 0) throw new Error('Aucun délai de contestation fourni.')
  let derniere = { echeance: '', rang: -1 }
  for (const [rang, r] of resultats.entries()) {
    if (r.etat === 'non_notifiee') return { cause: 'pv_non_notifie', motif: "Procès-verbal non notifié : le délai de l'art. 42 n'a pas couru." }
    if (r.etat === 'refuse') return { cause: r.cause, motif: r.motif }
    const echeance = echeanceLaPlusTardiveDe(r)
    if (echeance > derniere.echeance) derniere = { echeance, rang }
  }
  return derniere
}

/**
 * AG dont le statut courant ne correspond pas à leur historique : statut différent du dernier statut historisé, ou
 * statut autre que « Projet » sans aucun historique. Signale tout changement écrit hors de changerStatutAg.
 */
export function detecterStatutsAgNonHistorises(
  ags: { id: string; statut: StatutAssemblee }[],
  historique: LigneHistoriqueStatut[],
): string[] {
  return ags
    .filter((ag) => {
      const lignes = historiqueTrie(historique, ag.id)
      const attendu = lignes.at(-1)?.statutNouveau ?? 'Projet'
      return ag.statut !== attendu
    })
    .map((ag) => ag.id)
}

// ── Preuve de la notification (T31, règle R9 ; J1, J50) ─────────────────────────────────────────────────────────────

/** Alerte MÉTIER (pas une erreur technique) : la notification de l'AG ne peut pas être prouvée en l'état. */
export interface AlertePreuveNotification {
  code: 'notification_non_prouvee'
  motif: string
}

/**
 * Contrôle la preuve de la dernière notification du PV d'une AG (R9, J1, J50) : elle doit être reliée à un courrier en
 * AR dont la première présentation est saisie (retiré ou non), ou à une notification électronique dont la transmission
 * de l'avis est saisie, et qui ne précède pas la ligne qui précède « Notifiée » (relecture du 14/11/2026, tour 2).
 * Renvoie null si l'AG n'a pas été notifiée, ou si la notification est prouvée.
 */
export function controlerPreuveNotificationAg(
  historique: (LigneHistoriqueStatut & { courrierId: string | null })[],
  courriers: readonly CourrierNotification[],
  agId: string,
): AlertePreuveNotification | null {
  const derniere = derniereNotification(historique, agId)
  if (!derniere) return null
  const preuve = courrierPreuve(derniere.courrierId, courriers, null, borneProcesVerbal(historique, agId))
  return 'motif' in preuve ? { code: 'notification_non_prouvee', motif: preuve.motif } : null
}
