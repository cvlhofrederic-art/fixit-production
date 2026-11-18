import {
  MODES_NOTIFICATION,
  etatNotificationCourrier,
  modeNotificationCourrier,
  type CourrierSuivi,
  type EtatNotificationCourrier,
  type ModeNotification,
} from '@/lib/administrateur-judiciaire/domain/courriers'
import { dateIsoVersFr, decomposerDateIso, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { normaliserEspaces } from '@/lib/administrateur-judiciaire/domain/texte'
import type { AnomalieEnvoiElectronique, VoieNotification } from '@/lib/administrateur-judiciaire/domain/voie-notification'

/**
 * Envois électroniques et signature électronique : cycles de statuts. Point 65 du bilan des écarts Gestéam → VitFix.
 * Fonctions pures, horodatages ISO 8601 avec fuseau, sans écran, sans table, sans version Dexie ni migration. Aucun
 * prestataire n'est branché : le module dit ce que VitFix devra suivre le jour où un prestataire de lettre recommandée
 * électronique (LRE) ou de signature électronique le sera.
 *
 * Sources Gestéam (5.4.22, consultation en lecture seule) :
 * - 🟢 Tranche 40 (menu Outils, 27/10/2026) : console Notifications, « envois dématérialisés » (colonnes Type, Date,
 *   heure, Objet, Correspondant, N°, P., Collaborateur, Statut), sept statuts relevés dans le critère de recherche :
 *   Préparation · Attente d'envoi · En cours · Envoyé OK · Échec · Reçu · Reçu en erreur ; console eSignature (« même
 *   console, autre type »), huit statuts : Soumis · En cours · Signé · Stocké, signé · Inconnu · Expiré · Annulé ·
 *   À relever. Les valeurs de VitFix sont ces libellés, tels quels, dans l'ordre de Gestéam.
 * - ⚪ Non observé : le sens exact de chaque statut, les transitions, l'instant qui date un changement, le prestataire
 *   derrière chaque console (aucun envoi ouvert : consigne « architecture seulement »).
 * - 🟢 Tranche 43 § 4 et § 5 : l'extranet porte le consentement au recommandé électronique (activer, désactiver, valider
 *   l'e-mail des AR électroniques) et la fiche client le critère LRE, avec les anomalies « LRE sans prénom » et « PM sans
 *   représentant » ; VitFix les tient dans voie-notification.ts (point 60), lu ici en contrôle d'appoint.
 * - Les deux listes ne sont pas dans lib/data/referentiels-gesteam-judiciaire.ts, fichier généré depuis des relevés (07 et
 *   08/10/2026) qui ne les contiennent pas : elles sont posées ici, une seule fois (comme dans statuts-facture.ts).
 *
 * Choix (🔵 déduits des libellés, à revoir sur la documentation du prestataire branché) :
 * - deux machines d'états, chacune avec un chemin principal ordonné (Notifications : Préparation, Attente d'envoi, En
 *   cours, Envoyé OK, puis Reçu ou Reçu en erreur ; eSignature : Soumis, En cours, À relever, Signé, Stocké, signé) et des
 *   branches (Échec ; Inconnu, Expiré, Annulé). « À relever » est lu comme « signature faite, document à relever chez le
 *   prestataire », par analogie avec « Relever mes corbeilles » du même menu (qui importe des documents dans la GED) :
 *   il compte donc, avec « Signé » et « Stocké, signé », parmi les statuts de signature obtenue ; « Inconnu », comme un
 *   statut que la console n'a pas su lire ;
 * - transitions directes sans motif (REFERENTIEL_*.suivants) ; saut en avant sur le chemin principal permis avec un motif
 *   et marqué hors séquence (statut intermédiaire non transmis par le prestataire, reprise de Gestéam), comme les statuts
 *   d'AG (J2, statut-assemblee.ts : décision prise pour l'AG, reprise ici par analogie) ; retour en arrière interdit, sauf
 *   « Attente d'envoi » → « Préparation » (rien n'est parti) ; « Inconnu » ne fait pas revenir en arrière : il mène au
 *   dernier statut connu ou à ses suivants ; un état final ne change plus ;
 * - états finaux : Échec, Reçu, Reçu en erreur ; Stocké, signé, Expiré, Annulé. « Échec » n'est atteint que depuis
 *   « Attente d'envoi » ou « En cours » ; une demande « À relever » ou « Signé » ne s'annule ni n'expire ;
 * - historique horodaté : statut, statut ancien, horodatage, origine (saisie, prestataire, reprise de Gestéam), hors
 *   séquence, motif, référence du prestataire. L'horodatage porte son fuseau (Z ou ±HH:MM), sans quoi deux horodatages ne
 *   se comparent pas, et ne remonte jamais avant le changement précédent ; l'historique reçu est contrôlé (premier statut,
 *   chaînage statut ancien → statut, dernier statut égal à celui de l'envoi), sans quoi un retour en arrière passerait
 *   inaperçu ; le rejeu exact du dernier changement (même statut, même instant, même origine, même référence, même motif :
 *   un retour du prestataire reçu deux fois) rend l'envoi inchangé ; tout autre changement vers le statut courant est
 *   refusé ;
 * - lien avec le courrier sans toucher au type Courrier (db/schema.ts) : l'envoi porte courrierId et, pour une
 *   notification, le mode de notification du courrier (J50 : lre, prestataire_qualifie, ou null pour un envoi électronique
 *   sans valeur de notification), figé à la création ; un courrier « AR » (LRAR) ou dont le mode est incohérent avec la
 *   forme d'envoi est refusé ; une seule tentative en cours par courrier et par console, plus aucune après « Reçu »,
 *   « Échec » (décision de Hugo du 17/11/2026 (J58), ci-dessous) ou « Stocké, signé », et une nouvelle tentative ne
 *   remonte pas avant le dernier changement de la précédente ;
 * - le statut de l'envoi est un champ à part du statut du courrier (STATUT_COURRIER) : deux champs nommés « Statut » ne
 *   se fondent jamais (06_PIEGES § 4), même si « Préparation » figure dans les deux listes ;
 * - contrôle d'appoint à la création d'une notification électronique (LRE ou prestataire qualifié) : refus si la demande
 *   de voie postale du destinataire est en vigueur (voieDeNotification ; L. 1965 art. 42-1, al. 2 ; D. 1967 art. 64-1 et
 *   64-4) ou si une anomalie bloquante d'avant envoi demeure (controlerAvantEnvoiElectronique). Le calcul du délai
 *   (statut-assemblee.ts) reste seul juge, à la date du dépôt (J50).
 *
 * Valeur de notification, telle que 07_DECISIONS_JURIDIQUES.md la fixe (J50, décision de Hugo du 11/11/2026, textes lus
 * sur Légifrance le 11/11/2026) : une notification électronique est acquise à la transmission, par le prestataire, de
 * l'avis électronique (D. 1967 art. 64, dernier al.), que le contenu soit téléchargé ou non ; ni la date du dépôt, ni
 * celle du téléchargement. Cette date est Courrier.dateAvisElectronique, contrôlée par controlerAvisElectronique
 * (courriers.ts) et lue, pour le prestataire qualifié, sur son justificatif de transmission (art. 64-5), pour une LRE, sur
 * l'information du destinataire (CPCE art. R. 53-3, I ; interprétation, 🔵). Sans mode de notification, un envoi
 * électronique ne vaut pas notification (J50). lireNotificationElectronique lit donc l'état du courrier
 * (etatNotificationCourrier, inchangé), jamais le statut de la console, et signale les incohérences entre les deux par des
 * alertes, sans effet sur le délai ni sur l'ordre de service (J51 inchangé).
 *
 * Décisions de Hugo du 17/11/2026 (DECISIONS-HUGO-2026-11-17.md, section « Suite » : recommandations validées en bloc ;
 * numéros de registre proposés ; D. 1967 art. 64 et 64-4 relus sur Légifrance le 17/11/2026) :
 * - J57 (décision de Hugo du 17/11/2026 (J57)) : une LRE, ou un envoi par le procédé d'un prestataire qualifié, refusé ou
 *   non réclamé fait quand même courir le délai, du lendemain de la transmission de l'avis électronique ; l'acceptation,
 *   le refus ou la non-réclamation sont sans effet (D. 1967 art. 64, dernier al. ; même logique que la LRAR non retirée,
 *   Cass. 3e civ., 16/04/2026, n° 24-18.842). « Reçu en erreur » ne lève donc pas la date d'avis saisie
 *   (retour_en_erreur_apres_avis : elle reste seule retenue). Il reste distinct d'un défaut de transmission de l'avis,
 *   qui ne fait pas courir le délai : aucune date d'avis n'est affirmée tant que le justificatif de transmission ne
 *   l'établit pas (avis_a_saisir) ;
 * - J58 (décision de Hugo du 17/11/2026 (J58)) : après un « Échec », une nouvelle tentative sur le même courrier est
 *   refusée : un envoi en échec n'a rien notifié (D. 1967 art. 64, 64-1) ; pour un nouvel envoi, créer un nouveau
 *   courrier (nouveau dépôt). Le refus après « Reçu » est inchangé ; « Reçu en erreur » relève de J66 (ci-dessous).
 * - J66 (décision de Hugo du 17/11/2026, sur recommandation de Claude) : après « Reçu en erreur », le même courrier ne
 *   repart pas non plus : avis transmis, la notification est acquise (J57) et aucun nouvel envoi n'est utile ; avis non
 *   transmis, rien n'est notifié et un nouvel envoi se fait sur un nouveau courrier (J58).
 * - J57 et J66 : aucun statut de la console ne fait courir le délai : seule la date d'avis saisie sur le courrier compte
 *   (J50). Le module ne déduit ni date de notification ni délai d'un statut (valeurDuStatut : non_etablie), ni la date
 *   de dépôt.
 * - J67, R16 (décision de Hugo du 17/11/2026 ; textes lus sur Légifrance et EUR-Lex le 17/11/2026) : la valeur probante
 *   d'une signature électronique dépend de son niveau, donné par le prestataire (valeurProbanteSignature) : qualifiée,
 *   présumée fiable ; simple, avancée ou inconnue, recevable mais à prouver. Un écrit électronique vaut un écrit papier si
 *   son auteur est identifié et son intégrité garantie (C. civ. art. 1366) ; la fiabilité n'est présumée que pour une
 *   signature qualifiée (C. civ. art. 1367, al. 2 ; décret n° 2017-1416, art. 1 ; eIDAS, art. 25, 2) ; une autre reste
 *   recevable comme preuve, sans présomption (eIDAS, art. 25, 1 ; Cass. 3e civ., 05/03/2026, n° 24-21.034). Le niveau est
 *   facultatif sur l'envoi, lu « inconnu » (la console Gestéam ne le montre pas) ; le statut « Signé » ne le dit pas.
 *   Pour un procès-verbal d'assemblée tenu dans un registre électronique, la signature qualifiée est conseillée (D. 1967
 *   art. 17). 🔵 Avant la signature obtenue, aucune valeur probante n'est lue (null). La mention « valeur probante
 *   eIDAS » de la démonstration (SignatureElectroniqueModule.tsx, non modifié) ne doit jamais s'afficher sans ce niveau :
 *   écran de Frédéric ; enregistrement du niveau : à brancher.
 *
 * Non établi :
 * - 🔴 Sens de chaque statut de la console Notifications : aucun n'est rattaché par 07_DECISIONS_JURIDIQUES.md à un
 *   événement précis de l'envoi : « Envoyé OK » peut être le dépôt ou la transmission, « Reçu » la réception ou le
 *   téléchargement (qui ne compte pas), « Reçu en erreur » un refus ou un rejet. Pour l'établir : la documentation du
 *   prestataire branché (correspondance entre ses statuts et la preuve de dépôt, l'avis, le téléchargement), puis une
 *   décision de Hugo.
 * - 🔴 Signature électronique et procès-verbal : « Signé » ne pose pas le statut d'AG « PV signé » (J2,
 *   statut-assemblee.ts) : lien à décider (relevé du 17/11/2026, partie C, F8).
 * - 🔴 Questions à Hugo : les transitions et les finaux déduits (« Reçu en erreur » final, « Échec » jamais
 *   après « Envoyé OK », « Expiré » sans prolongation, « À relever » avant « Signé » et non l'inverse) sont-ils ceux du
 *   prestataire retenu ? Un envoi abandonné en « Préparation » ne se clôt qu'en passant par « Attente d'envoi » puis
 *   « Échec », sans motif (Gestéam n'a pas d'« Annulé » dans la console Notifications ; depuis J58, cet « Échec » impose
 *   un nouveau courrier) : faut-il un motif, ou un abandon propre à VitFix ?
 * - 🔴 Frédéric : écrans (console des envois, demande de signature) et tables : rien n'est fait, son accord est
 *   nécessaire (règle UX du CLAUDE.md).
 */

// ─── Référentiels (Gestéam, tranche 40) ──────────────────────────────────────────────────────

/** Console Notifications de Gestéam : sept statuts, dans l'ordre du critère de recherche (🟢 tranche 40). */
export const STATUTS_NOTIFICATION_ELECTRONIQUE = [
  'Préparation',
  "Attente d'envoi",
  'En cours',
  'Envoyé OK',
  'Échec',
  'Reçu',
  'Reçu en erreur',
] as const
export type StatutNotificationElectronique = (typeof STATUTS_NOTIFICATION_ELECTRONIQUE)[number]

/** Console eSignature de Gestéam : huit statuts, dans l'ordre du critère de recherche (🟢 tranche 40). */
export const STATUTS_SIGNATURE_ELECTRONIQUE = [
  'Soumis',
  'En cours',
  'Signé',
  'Stocké, signé',
  'Inconnu',
  'Expiré',
  'Annulé',
  'À relever',
] as const
export type StatutSignatureElectronique = (typeof STATUTS_SIGNATURE_ELECTRONIQUE)[number]

/** Les deux consoles (« même console, autre type », tranche 40). */
export const TYPES_ENVOI_ELECTRONIQUE = ['notification', 'signature'] as const
export type TypeEnvoiElectronique = (typeof TYPES_ENVOI_ELECTRONIQUE)[number]

export interface DefinitionStatutEnvoi<S extends string> {
  /** Libellé Gestéam (🟢 tranche 40), affiché tel quel. */
  libelle: S
  /** Lecture VitFix du libellé (🔵 déduite ; ⚪ sens non observé). */
  sens: string
  /** Rang sur le chemin principal (saut en avant permis avec motif) ; null pour une branche. */
  rang: number | null
  /** Statuts suivants permis sans motif (🔵). */
  suivants: readonly S[]
  final: boolean
}

export const REFERENTIEL_NOTIFICATION_ELECTRONIQUE: Readonly<
  Record<StatutNotificationElectronique, DefinitionStatutEnvoi<StatutNotificationElectronique>>
> = {
  Préparation: {
    libelle: 'Préparation',
    sens: "Envoi en préparation : rien n'est transmis au prestataire.",
    rang: 0,
    suivants: ["Attente d'envoi"],
    final: false,
  },
  "Attente d'envoi": {
    libelle: "Attente d'envoi",
    sens: "Envoi prêt, en file d'attente vers le prestataire ; un retour en préparation est encore possible.",
    rang: 1,
    suivants: ['Préparation', 'En cours', 'Échec'],
    final: false,
  },
  'En cours': {
    libelle: 'En cours',
    sens: 'Envoi pris en charge par le prestataire, en cours de traitement.',
    rang: 2,
    suivants: ['Envoyé OK', 'Échec'],
    final: false,
  },
  'Envoyé OK': {
    libelle: 'Envoyé OK',
    sens: 'Envoi accepté et expédié par le prestataire (dépôt ou transmission de l’avis : non établi, 🔴).',
    rang: 3,
    suivants: ['Reçu', 'Reçu en erreur'],
    final: false,
  },
  Échec: {
    libelle: 'Échec',
    sens: "Envoi non abouti avant l'expédition : rien n'est notifié ; un nouvel envoi se fait sur un nouveau courrier (J58).",
    rang: null,
    suivants: [],
    final: true,
  },
  Reçu: {
    libelle: 'Reçu',
    sens: 'Retour du prestataire reçu : réception ou téléchargement par le destinataire (non établi, 🔴).',
    rang: 4,
    suivants: [],
    final: true,
  },
  'Reçu en erreur': {
    libelle: 'Reçu en erreur',
    sens: "Retour du prestataire reçu en erreur : refus, non-réclamation, rejet ou défaut de transmission de l'avis (sens non établi, 🔴 ; un refus ou une non-réclamation après l'avis ne remettent pas en cause sa date : J57).",
    rang: 4,
    suivants: [],
    final: true,
  },
}

export const REFERENTIEL_SIGNATURE_ELECTRONIQUE: Readonly<
  Record<StatutSignatureElectronique, DefinitionStatutEnvoi<StatutSignatureElectronique>>
> = {
  Soumis: {
    libelle: 'Soumis',
    sens: 'Demande de signature soumise au prestataire.',
    rang: 0,
    suivants: ['En cours', 'Inconnu', 'Expiré', 'Annulé'],
    final: false,
  },
  'En cours': {
    libelle: 'En cours',
    sens: 'Signature en cours : les signataires sont invités à signer.',
    rang: 1,
    suivants: ['À relever', 'Signé', 'Inconnu', 'Expiré', 'Annulé'],
    final: false,
  },
  'À relever': {
    libelle: 'À relever',
    sens: 'Signature faite chez le prestataire, document signé à relever (lecture par analogie avec « Relever mes corbeilles »).',
    rang: 2,
    suivants: ['Signé', 'Stocké, signé', 'Inconnu'],
    final: false,
  },
  Signé: {
    libelle: 'Signé',
    sens: 'Document signé relevé chez le prestataire, pas encore classé.',
    rang: 3,
    suivants: ['Stocké, signé'],
    final: false,
  },
  'Stocké, signé': {
    libelle: 'Stocké, signé',
    sens: 'Document signé classé (GED) : fin du cycle.',
    rang: 4,
    suivants: [],
    final: true,
  },
  Inconnu: {
    libelle: 'Inconnu',
    sens: "Statut que la console n'a pas su lire chez le prestataire : il mène au dernier statut connu ou à ses suivants.",
    rang: null,
    suivants: [],
    final: false,
  },
  Expiré: {
    libelle: 'Expiré',
    sens: 'Demande expirée sans signature ; une nouvelle demande est un nouvel envoi.',
    rang: null,
    suivants: [],
    final: true,
  },
  Annulé: {
    libelle: 'Annulé',
    sens: 'Demande annulée avant signature ; une nouvelle demande est un nouvel envoi.',
    rang: null,
    suivants: [],
    final: true,
  },
}

export const STATUTS_FINAUX_NOTIFICATION_ELECTRONIQUE: readonly StatutNotificationElectronique[] = STATUTS_NOTIFICATION_ELECTRONIQUE.filter(
  (statut) => REFERENTIEL_NOTIFICATION_ELECTRONIQUE[statut].final,
)

export const STATUTS_FINAUX_SIGNATURE_ELECTRONIQUE: readonly StatutSignatureElectronique[] = STATUTS_SIGNATURE_ELECTRONIQUE.filter(
  (statut) => REFERENTIEL_SIGNATURE_ELECTRONIQUE[statut].final,
)

/** Statuts où la console montre un envoi abouti (🔵) : ils ne datent ni l'avis (J57, J66) ni le dépôt (🔴, en-tête). */
export const STATUTS_ENVOI_ABOUTI: ReadonlySet<StatutNotificationElectronique> = new Set<StatutNotificationElectronique>([
  'Envoyé OK',
  'Reçu',
  'Reçu en erreur',
])

/**
 * Statuts où la signature est obtenue (🔵 lecture des libellés, cohérente avec REFERENTIEL_SIGNATURE_ELECTRONIQUE : « À
 * relever » y est une signature faite, qui ne s'annule ni n'expire ; valeur probante selon le niveau, J67, R16).
 */
export const STATUTS_SIGNATURE_OBTENUE: ReadonlySet<StatutSignatureElectronique> = new Set<StatutSignatureElectronique>([
  'Signé',
  'Stocké, signé',
  'À relever',
])

// ─── Envoi et historique ─────────────────────────────────────────────────────────────────────

export const ORIGINES_EVENEMENT_ENVOI = ['saisie', 'prestataire', 'reprise_gesteam'] as const
export type OrigineEvenementEnvoi = (typeof ORIGINES_EVENEMENT_ENVOI)[number]

/** Changement de statut historisé ; le premier, celui de la création, a statutAncien null. */
export interface EvenementEnvoiElectronique<S extends string> {
  statut: S
  statutAncien: S | null
  /** ISO 8601 avec fuseau (AAAA-MM-JJTHH:MM, secondes facultatives, Z ou ±HH:MM). */
  horodatage: string
  origine: OrigineEvenementEnvoi
  /** Saut d'étape en avant : motif obligatoire. */
  horsSequence: boolean
  motif: string | null
  referencePrestataire: string | null
}

/** Mode de notification d'un envoi électronique (J50) : LRE ou procédé d'un prestataire qualifié. */
export type ModeNotificationElectronique = Exclude<ModeNotification, 'lrar'>

export interface EnvoiNotificationElectronique {
  type: 'notification'
  id: string
  courrierId: string
  /** Mode du courrier, figé à la création ; null : envoi électronique sans valeur de notification (J50). */
  modeNotification: ModeNotificationElectronique | null
  statut: StatutNotificationElectronique
  historique: EvenementEnvoiElectronique<StatutNotificationElectronique>[]
}

/** Niveau de la signature électronique, donné par le prestataire (J67, R16 ; eIDAS, art. 3, 25 à 29). */
export const NIVEAUX_SIGNATURE_ELECTRONIQUE = ['simple', 'avancee', 'qualifiee', 'inconnu'] as const
export type NiveauSignatureElectronique = (typeof NIVEAUX_SIGNATURE_ELECTRONIQUE)[number]

export interface EnvoiSignatureElectronique {
  type: 'signature'
  id: string
  courrierId: string
  /** Facultatif ; absent : lu « inconnu » (J67, R16). Enregistrement : à brancher. */
  niveauSignature?: NiveauSignatureElectronique
  statut: StatutSignatureElectronique
  historique: EvenementEnvoiElectronique<StatutSignatureElectronique>[]
}

export type EnvoiElectronique = EnvoiNotificationElectronique | EnvoiSignatureElectronique

export interface TransitionsPermises<S extends string> {
  sansMotif: S[]
  /** Sauts en avant sur le chemin principal : motif obligatoire, marqués hors séquence. */
  avecMotif: S[]
}

interface MachineEnvoi<S extends string> {
  nom: string
  statuts: readonly S[]
  referentiel: Readonly<Record<S, DefinitionStatutEnvoi<S>>>
  initial: S
  /** Statut final qui clôt le cycle avec succès : plus de nouvelle tentative sur le même courrier. */
  abouti: S
  /**
   * Statut final d'un envoi qui n'a rien notifié et après lequel le même courrier ne repart pas : nouveau courrier
   * (J58, notification) ; null : une nouvelle tentative se rattache au même courrier.
   */
  echec: S | null
  /** Statut illisible : il mène au dernier statut connu ou à ses suivants. */
  illisible: S | null
  /**
   * Statut final ambigu après lequel le même courrier ne repart pas non plus (J66, notification : « Reçu en erreur ») :
   * avis transmis, la notification est acquise (J57) ; avis non transmis, rien n'est notifié (nouveau courrier, J58).
   */
  erreurApresEnvoi: S | null
}

const MACHINE_NOTIFICATION: MachineEnvoi<StatutNotificationElectronique> = {
  nom: 'notification électronique',
  statuts: STATUTS_NOTIFICATION_ELECTRONIQUE,
  referentiel: REFERENTIEL_NOTIFICATION_ELECTRONIQUE,
  initial: 'Préparation',
  abouti: 'Reçu',
  echec: 'Échec',
  illisible: null,
  erreurApresEnvoi: 'Reçu en erreur',
}

const MACHINE_SIGNATURE: MachineEnvoi<StatutSignatureElectronique> = {
  nom: 'signature électronique',
  statuts: STATUTS_SIGNATURE_ELECTRONIQUE,
  referentiel: REFERENTIEL_SIGNATURE_ELECTRONIQUE,
  initial: 'Soumis',
  abouti: 'Stocké, signé',
  echec: null,
  illisible: 'Inconnu',
  erreurApresEnvoi: null,
}

/**
 * Plus aucune nouvelle tentative sur le même courrier : cycle abouti, échec qui n'a rien notifié (J58), ou « Reçu en
 * erreur » (J66).
 */
const closLeCourrier = <S extends string>(machine: MachineEnvoi<S>, statut: S): boolean =>
  statut === machine.abouti || statut === machine.echec || statut === machine.erreurApresEnvoi

/** Refus d'une nouvelle tentative après un « Échec » (décision de Hugo du 17/11/2026, J58). */
const RAISON_NOUVEAU_COURRIER_APRES_ECHEC =
  "un envoi en échec n'a rien notifié ; pour un nouvel envoi, créer un nouveau courrier (nouveau dépôt ; D. 1967 art. 64, 64-1 ; décision de Hugo du 17/11/2026, J58)"

/** Refus d'une nouvelle tentative après « Reçu en erreur » (décision de Hugo du 17/11/2026, J66). */
const RAISON_APRES_RECU_EN_ERREUR =
  "si le justificatif établit la transmission de l'avis électronique, la notification est acquise et aucun nouvel envoi n'est utile (D. 1967 art. 64, dernier al. ; J57) ; sinon rien n'a été notifié : créer un nouveau courrier (nouveau dépôt ; J58) (décision de Hugo du 17/11/2026, J66)"

// ─── Horodatages ─────────────────────────────────────────────────────────────────────────────

const HORODATAGE_ISO = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})$/

/** Instant UTC (ms) d'un horodatage ISO 8601 avec fuseau ; null s'il est invalide. */
function instantHorodatage(valeur: string): number | null {
  const m = HORODATAGE_ISO.exec(valeur)
  if (!m || !estDateIsoValide(m[1])) return null
  const [heures, minutes, secondes] = [Number(m[2]), Number(m[3]), Number(m[4] ?? 0)]
  if (heures > 23 || minutes > 59 || secondes > 59) return null
  const { a, m: mois, j } = decomposerDateIso(m[1])
  const millisecondes = Number((m[5] ?? '').padEnd(3, '0').slice(0, 3))
  const local = Date.UTC(a, mois - 1, j, heures, minutes, secondes, millisecondes)
  if (m[6] === 'Z') return local
  const [decalageHeures, decalageMinutes] = m[6].slice(1).split(':').map(Number)
  if (decalageHeures > 23 || decalageMinutes > 59) return null
  const decalage = (decalageHeures * 60 + decalageMinutes) * 60_000
  return m[6].startsWith('+') ? local - decalage : local + decalage
}

/** Horodatage ISO 8601 avec fuseau (Z ou ±HH:MM), date et heure réelles. */
export function estHorodatageIsoValide(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && instantHorodatage(valeur) !== null
}

function instant(valeur: string): number {
  const ms = instantHorodatage(valeur)
  if (ms === null)
    throw new Error(`Horodatage invalide : « ${valeur} » (attendu AAAA-MM-JJTHH:MM, secondes facultatives, avec le fuseau : Z ou ±HH:MM).`)
  return ms
}

// ─── Contrôles communs ───────────────────────────────────────────────────────────────────────

const texteFacultatif = (valeur: string | null | undefined): string | null => (valeur == null ? null : normaliserEspaces(valeur) || null)

function identifiant(valeur: string, quoi: string): string {
  const id = typeof valeur === 'string' ? valeur.trim() : ''
  if (!id) throw new Error(`Envoi électronique : identifiant ${quoi} attendu.`)
  return id
}

function verifierOrigine(origine: OrigineEvenementEnvoi | undefined): OrigineEvenementEnvoi {
  const valeur = origine ?? 'saisie'
  if (!(ORIGINES_EVENEMENT_ENVOI as readonly string[]).includes(valeur))
    throw new Error(`Origine « ${valeur} » inconnue (saisie, prestataire ou reprise_gesteam attendue).`)
  return valeur
}

function lireStatut<S extends string>(machine: MachineEnvoi<S>, valeur: string): S {
  const normalise = typeof valeur === 'string' ? normaliserEspaces(valeur) : String(valeur)
  const statut = machine.statuts.find((s) => s === normalise)
  if (statut === undefined)
    throw new Error(`Statut « ${normalise} » inconnu pour une ${machine.nom} (statuts Gestéam : ${machine.statuts.join(', ')}).`)
  return statut
}

const messageTypeInconnu = (type: unknown): string => `Type d'envoi électronique « ${String(type)} » inconnu (notification ou signature attendu).`

function verifierType(type: string): TypeEnvoiElectronique {
  const connu = TYPES_ENVOI_ELECTRONIQUE.find((t) => t === type)
  if (connu === undefined) throw new Error(messageTypeInconnu(type))
  return connu
}

/** Envoi d'un type que le typage exclut, mais qu'une donnée reçue peut porter. */
function typeInconnu(envoi: never): never {
  throw new Error(messageTypeInconnu((envoi as { type?: unknown }).type))
}

/** Un statut de cette console est-il final ? Erreur pour un type ou un statut inconnu de la console. */
export function estStatutFinal(type: TypeEnvoiElectronique, statut: string): boolean {
  return verifierType(type) === 'notification'
    ? REFERENTIEL_NOTIFICATION_ELECTRONIQUE[lireStatut(MACHINE_NOTIFICATION, statut)].final
    : REFERENTIEL_SIGNATURE_ELECTRONIQUE[lireStatut(MACHINE_SIGNATURE, statut)].final
}

/**
 * Envoi reçu (d'une base, d'une reprise) : statut de sa console, historique qui part du statut initial, chaîné (statut
 * ancien = statut précédent) et qui finit sur le statut de l'envoi. Sinon, un retour en arrière passerait inaperçu.
 */
function verifierEnvoi<S extends string>(machine: MachineEnvoi<S>, envoi: { id: string; statut: S; historique: readonly EvenementEnvoiElectronique<S>[] }): void {
  const prefixe = `Envoi électronique ${envoi.id}`
  if (!machine.statuts.includes(envoi.statut))
    throw new Error(`${prefixe} : statut « ${String(envoi.statut)} » inconnu pour une ${machine.nom} (statuts Gestéam : ${machine.statuts.join(', ')}).`)
  const historique = Array.isArray(envoi.historique) ? envoi.historique : []
  const premier = historique[0]
  if (premier === undefined || premier.statut !== machine.initial || premier.statutAncien !== null)
    throw new Error(`${prefixe} : historique incohérent : il doit s'ouvrir sur le statut « ${machine.initial} », sans statut ancien.`)
  historique.forEach((evenement, i) => {
    if (i > 0 && evenement.statutAncien !== historique[i - 1].statut)
      throw new Error(
        `${prefixe} : historique incohérent : passage noté depuis « ${String(evenement.statutAncien)} » alors que le statut précédent est « ${historique[i - 1].statut} ».`,
      )
  })
  const dernier = historique.at(-1)?.statut
  if (dernier !== envoi.statut)
    throw new Error(`${prefixe} : historique incohérent : dernier statut « ${String(dernier)} », statut de l'envoi « ${envoi.statut} ».`)
}

// ─── Machine d'états ─────────────────────────────────────────────────────────────────────────

function permisesDepuis<S extends string>(
  machine: MachineEnvoi<S>,
  statut: S,
  historique: readonly EvenementEnvoiElectronique<S>[],
): TransitionsPermises<S> {
  if (machine.referentiel[statut].final) return { sansMotif: [], avecMotif: [] }
  const base = statut === machine.illisible ? (historique.findLast((e) => e.statut !== machine.illisible)?.statut ?? machine.initial) : statut
  const directs = new Set<S>(machine.referentiel[base].suivants)
  directs.add(base)
  directs.delete(statut)
  const rangBase = machine.referentiel[base].rang
  const sansMotif = machine.statuts.filter((s) => directs.has(s))
  const avecMotif =
    rangBase === null
      ? []
      : machine.statuts.filter((s) => {
          const rang = machine.referentiel[s].rang
          return rang !== null && rang > rangBase && !directs.has(s)
        })
  return { sansMotif, avecMotif }
}

const citer = (statuts: readonly string[]): string => statuts.map((s) => `« ${s} »`).join(', ')

function listePermises(permises: TransitionsPermises<string>): string {
  const sansMotif = `sans motif : ${permises.sansMotif.length > 0 ? citer(permises.sansMotif) : 'aucun'}`
  return permises.avecMotif.length > 0 ? `${sansMotif} ; avec motif : ${citer(permises.avecMotif)}` : sansMotif
}

export interface SaisieChangementStatutEnvoi {
  /** Statut Gestéam (libellé) ; les espaces superflus sont normalisés, la casse ne l'est pas. */
  statut: string
  horodatage: string
  origine?: OrigineEvenementEnvoi
  /** Obligatoire pour un saut en avant (hors séquence). */
  motif?: string | null
  referencePrestataire?: string | null
}

function appliquer<S extends string>(
  machine: MachineEnvoi<S>,
  envoi: { id: string; statut: S; historique: EvenementEnvoiElectronique<S>[] },
  saisie: SaisieChangementStatutEnvoi,
): { statut: S; historique: EvenementEnvoiElectronique<S>[] } {
  verifierEnvoi(machine, envoi)
  const statut = lireStatut(machine, saisie.statut)
  const horodatage = saisie.horodatage
  const quand = instant(horodatage)
  const origine = verifierOrigine(saisie.origine)
  const motif = texteFacultatif(saisie.motif)
  const referencePrestataire = texteFacultatif(saisie.referencePrestataire)
  const courant = envoi.statut
  const prefixe = `Envoi électronique ${envoi.id}`
  const dernier = envoi.historique.at(-1)
  const rejeu =
    dernier !== undefined &&
    statut === courant &&
    quand === instant(dernier.horodatage) &&
    origine === dernier.origine &&
    referencePrestataire === dernier.referencePrestataire &&
    (motif === null || motif === dernier.motif)
  if (rejeu) return { statut: courant, historique: envoi.historique }
  if (machine.referentiel[courant].final) {
    const suite = closLeCourrier(machine, courant) ? 'pour un nouvel envoi, créer un nouveau courrier' : 'créer un nouvel envoi si besoin'
    throw new Error(`${prefixe} : statut « ${courant} » final, plus aucun changement (${suite}).`)
  }
  if (statut === courant) throw new Error(`${prefixe} : déjà au statut « ${courant} ».`)
  if (dernier && quand < instant(dernier.horodatage))
    throw new Error(`${prefixe} : horodatage ${horodatage} antérieur au dernier changement de statut (${dernier.horodatage}).`)
  const permises = permisesDepuis(machine, courant, envoi.historique)
  const horsSequence = permises.avecMotif.includes(statut)
  if (!horsSequence && !permises.sansMotif.includes(statut))
    throw new Error(`${prefixe} : passage de « ${courant} » à « ${statut} » interdit (${listePermises(permises)}).`)
  if (horsSequence && motif === null)
    throw new Error(
      `${prefixe} : passage de « ${courant} » à « ${statut} » hors séquence : motif obligatoire (statut intermédiaire non transmis par le prestataire, reprise de Gestéam…).`,
    )
  const evenement: EvenementEnvoiElectronique<S> = {
    statut,
    statutAncien: courant,
    horodatage,
    origine,
    horsSequence,
    motif,
    referencePrestataire,
  }
  return { statut, historique: [...envoi.historique, evenement] }
}

/** Transitions permises depuis le statut courant de l'envoi. */
export function transitionsPermises(envoi: EnvoiNotificationElectronique): TransitionsPermises<StatutNotificationElectronique>
export function transitionsPermises(envoi: EnvoiSignatureElectronique): TransitionsPermises<StatutSignatureElectronique>
export function transitionsPermises(
  envoi: EnvoiElectronique,
): TransitionsPermises<StatutNotificationElectronique> | TransitionsPermises<StatutSignatureElectronique> {
  if (envoi.type === 'notification') {
    verifierEnvoi(MACHINE_NOTIFICATION, envoi)
    return permisesDepuis(MACHINE_NOTIFICATION, envoi.statut, envoi.historique)
  }
  if (envoi.type === 'signature') {
    verifierEnvoi(MACHINE_SIGNATURE, envoi)
    return permisesDepuis(MACHINE_SIGNATURE, envoi.statut, envoi.historique)
  }
  return typeInconnu(envoi)
}

/**
 * Changement de statut : refuse un envoi incohérent (type, statut ou historique), un statut inconnu de la console, un
 * état final, le même statut, un horodatage antérieur au changement précédent, une transition interdite (retour en
 * arrière, branche hors d'atteinte) et un saut en avant sans motif. Le rejeu exact du dernier changement rend l'envoi
 * inchangé. Renvoie un nouvel envoi ; l'envoi reçu n'est pas modifié.
 */
export function changerStatutEnvoi(envoi: EnvoiNotificationElectronique, saisie: SaisieChangementStatutEnvoi): EnvoiNotificationElectronique
export function changerStatutEnvoi(envoi: EnvoiSignatureElectronique, saisie: SaisieChangementStatutEnvoi): EnvoiSignatureElectronique
export function changerStatutEnvoi(envoi: EnvoiElectronique, saisie: SaisieChangementStatutEnvoi): EnvoiElectronique {
  if (envoi.type === 'notification') return { ...envoi, ...appliquer(MACHINE_NOTIFICATION, envoi, saisie) }
  if (envoi.type === 'signature') return { ...envoi, ...appliquer(MACHINE_SIGNATURE, envoi, saisie) }
  return typeInconnu(envoi)
}

/** Horodatage du premier passage de l'envoi à ce statut ; null s'il ne l'a pas atteint. */
export function dateDuStatut(envoi: EnvoiElectronique, statut: StatutNotificationElectronique | StatutSignatureElectronique): string | null {
  const historique: readonly EvenementEnvoiElectronique<string>[] = envoi.historique
  return historique.find((e) => e.statut === statut)?.horodatage ?? null
}

// ─── Création ────────────────────────────────────────────────────────────────────────────────

export interface SaisieCreationEnvoi {
  id: string
  horodatage: string
  origine?: OrigineEvenementEnvoi
  referencePrestataire?: string | null
  /** Envois déjà connus (toutes consoles) : identifiant unique, une seule tentative en cours par courrier et par console. */
  envoisExistants?: readonly EnvoiElectronique[]
}

function ouvrir<S extends string>(machine: MachineEnvoi<S>, saisie: SaisieCreationEnvoi): { statut: S; historique: EvenementEnvoiElectronique<S>[] } {
  instant(saisie.horodatage)
  const evenement: EvenementEnvoiElectronique<S> = {
    statut: machine.initial,
    statutAncien: null,
    horodatage: saisie.horodatage,
    origine: verifierOrigine(saisie.origine),
    horsSequence: false,
    motif: null,
    referencePrestataire: texteFacultatif(saisie.referencePrestataire),
  }
  return { statut: machine.initial, historique: [evenement] }
}

function controlerNouvelleTentative(
  type: TypeEnvoiElectronique,
  id: string,
  courrierId: string,
  horodatage: string,
  envoisExistants: readonly EnvoiElectronique[] = [],
): void {
  const quand = instant(horodatage)
  if (envoisExistants.some((e) => e.id === id)) throw new Error(`Nouvel envoi refusé : identifiant ${id} déjà pris.`)
  const { abouti, echec, erreurApresEnvoi } = type === 'notification' ? MACHINE_NOTIFICATION : MACHINE_SIGNATURE
  for (const e of envoisExistants) {
    if (e.type !== type || e.courrierId !== courrierId) continue
    if (!estStatutFinal(type, e.statut))
      throw new Error(
        `Nouvel envoi refusé : l'envoi ${e.id} du courrier ${courrierId} est encore au statut « ${e.statut} » ; une seule tentative en cours par courrier.`,
      )
    if (e.statut === abouti)
      throw new Error(`Nouvel envoi refusé : l'envoi ${e.id} du courrier ${courrierId} est déjà « ${e.statut} » ; pour un nouvel envoi, créer un nouveau courrier.`)
    if (e.statut === echec)
      throw new Error(`Nouvel envoi refusé : l'envoi ${e.id} du courrier ${courrierId} est en « ${e.statut} » : ${RAISON_NOUVEAU_COURRIER_APRES_ECHEC}.`)
    if (e.statut === erreurApresEnvoi)
      throw new Error(`Nouvel envoi refusé : l'envoi ${e.id} du courrier ${courrierId} est « ${e.statut} » : ${RAISON_APRES_RECU_EN_ERREUR}.`)
    const fin = e.historique.at(-1)?.horodatage
    if (fin !== undefined && quand < instant(fin))
      throw new Error(
        `Nouvel envoi refusé : horodatage ${horodatage} antérieur à la fin de l'envoi ${e.id} du courrier ${courrierId} (${fin}) ; une seule tentative en cours par courrier.`,
      )
  }
}

/** Mode électronique du courrier (J50) : refus d'un courrier « AR » (LRAR) et d'un mode inconnu ou incohérent. */
function modeElectroniqueDuCourrier(courrier: { id: string; formeEnvoi: string; modeNotification?: ModeNotification | null }): ModeNotificationElectronique | null {
  const saisi = courrier.modeNotification ?? null
  if (saisi !== null && !(MODES_NOTIFICATION as readonly string[]).includes(saisi))
    throw new Error(`Mode de notification inconnu : « ${saisi} » (lrar, lre ou prestataire_qualifie attendu).`)
  const mode = modeNotificationCourrier(courrier)
  if (saisi !== null && mode === null)
    throw new Error(
      `Mode de notification « ${saisi} » incohérent avec la forme d'envoi « ${courrier.formeEnvoi} » du courrier ${courrier.id} (J50 ; D. 1967 art. 64, 64-1).`,
    )
  if (mode === 'lrar')
    throw new Error(
      `Le courrier ${courrier.id} est une lettre recommandée avec avis de réception (forme « AR ») : il ne part pas par voie électronique (J50, courriers.ts).`,
    )
  return mode
}

/** Contrôle d'appoint avant une notification électronique (point 60, voie-notification.ts). */
function controlerDestinataire(
  voie: Pick<VoieNotification, 'voie' | 'depuis'> | null | undefined,
  anomalies: readonly Pick<AnomalieEnvoiElectronique, 'gravite' | 'message'>[] = [],
): void {
  if (voie?.voie === 'postale') {
    const depuis = voie.depuis ? ` depuis le ${dateIsoVersFr(voie.depuis)}` : ''
    throw new Error(
      `Notification électronique refusée : demande de voie postale en vigueur${depuis} ; notifier par lettre recommandée avec avis de réception (L. 1965 art. 42-1, al. 2 ; D. 1967 art. 64-1, 64-4).`,
    )
  }
  const bloquantes = anomalies.filter((a) => a.gravite === 'bloquant')
  if (bloquantes.length > 0)
    throw new Error(`Notification électronique refusée, anomalies bloquantes d'avant envoi : ${bloquantes.map((a) => a.message).join(' ')}`)
}

/**
 * Envoi d'un courrier par la console Notifications : statut « Préparation », mode de notification du courrier figé.
 * Courrier « AR » (LRAR) ou mode incohérent : refus. Pour une LRE ou le procédé d'un prestataire qualifié, la voie du
 * destinataire (voieDeNotification, à la date prévue de l'envoi) et les anomalies d'avant envoi
 * (controlerAvantEnvoiElectronique), quand l'appelant les donne, doivent permettre l'envoi électronique. Après un envoi
 * du même courrier en « Reçu » ou en « Échec » (J58 : un envoi en échec n'a rien notifié), refus : nouveau courrier.
 */
export function creerEnvoiNotificationElectronique(
  saisie: SaisieCreationEnvoi & {
    courrier: { id: string; formeEnvoi: string; modeNotification?: ModeNotification | null }
    voieDestinataire?: Pick<VoieNotification, 'voie' | 'depuis'> | null
    anomaliesAvantEnvoi?: readonly Pick<AnomalieEnvoiElectronique, 'gravite' | 'message'>[]
  },
): EnvoiNotificationElectronique {
  const id = identifiant(saisie.id, "de l'envoi")
  const courrierId = identifiant(saisie.courrier.id, 'du courrier')
  const modeNotification = modeElectroniqueDuCourrier({ ...saisie.courrier, id: courrierId })
  if (modeNotification !== null) controlerDestinataire(saisie.voieDestinataire, saisie.anomaliesAvantEnvoi)
  controlerNouvelleTentative('notification', id, courrierId, saisie.horodatage, saisie.envoisExistants)
  return { type: 'notification', id, courrierId, modeNotification, ...ouvrir(MACHINE_NOTIFICATION, saisie) }
}

/** Niveau contrôlé ; absent ou null : « inconnu » (J67, R16). */
function niveauDeSignature(niveau: NiveauSignatureElectronique | null | undefined): NiveauSignatureElectronique {
  if (niveau === undefined || niveau === null) return 'inconnu'
  if (!(NIVEAUX_SIGNATURE_ELECTRONIQUE as readonly string[]).includes(niveau))
    throw new Error(`Niveau de signature « ${String(niveau)} » inconnu (simple, avancee, qualifiee ou inconnu attendu).`)
  return niveau
}

/**
 * Demande de signature d'un courrier par la console eSignature : statut « Soumis ». Niveau de signature facultatif,
 * gardé seulement s'il est donné (J67, R16).
 */
export function creerEnvoiSignatureElectronique(
  saisie: SaisieCreationEnvoi & { courrierId: string; niveauSignature?: NiveauSignatureElectronique | null },
): EnvoiSignatureElectronique {
  const id = identifiant(saisie.id, "de l'envoi")
  const courrierId = identifiant(saisie.courrierId, 'du courrier')
  const niveau = saisie.niveauSignature ?? null
  if (niveau !== null) niveauDeSignature(niveau)
  controlerNouvelleTentative('signature', id, courrierId, saisie.horodatage, saisie.envoisExistants)
  return { type: 'signature', id, courrierId, ...(niveau === null ? {} : { niveauSignature: niveau }), ...ouvrir(MACHINE_SIGNATURE, saisie) }
}

// ─── Lecture ─────────────────────────────────────────────────────────────────────────────────

export const CODES_ALERTE_ENVOI_ELECTRONIQUE = [
  'sans_valeur_de_notification',
  'depot_a_saisir',
  'avis_a_saisir',
  'avis_sans_envoi_abouti',
  'retour_en_erreur_apres_avis',
] as const
export type CodeAlerteEnvoiElectronique = (typeof CODES_ALERTE_ENVOI_ELECTRONIQUE)[number]

export interface AlerteEnvoiElectronique {
  code: CodeAlerteEnvoiElectronique
  message: string
}

export interface LectureNotificationElectronique {
  statut: StatutNotificationElectronique
  modeNotification: ModeNotificationElectronique | null
  /** État du courrier au regard de la notification (courriers.ts, J1 et J50) : seul il dit si le courrier notifie. */
  etatCourrier: EtatNotificationCourrier
  /** Transmission de l'avis électronique saisie sur le courrier (J50) ; jamais déduite du statut ; null sans mode. */
  dateAvisElectronique: string | null
  /** Aucun statut de la console ne vaut « notification faite » (J57, J66 ; en-tête). */
  valeurDuStatut: 'non_etablie'
  alertes: AlerteEnvoiElectronique[]
}

const SOURCE_AVIS: Readonly<Record<ModeNotificationElectronique, string>> = {
  lre: "sur l'information du destinataire (CPCE art. R. 53-3, I ; interprétation)",
  prestataire_qualifie: 'sur le justificatif de transmission du prestataire qualifié (D. 1967 art. 64-5)',
}

function alertesNotification(
  envoi: EnvoiNotificationElectronique,
  courrier: CourrierSuivi & { id: string },
  avis: string | null,
): AlerteEnvoiElectronique[] {
  const mode = envoi.modeNotification
  const abouti = STATUTS_ENVOI_ABOUTI.has(envoi.statut)
  const enConsole = `Console au statut « ${envoi.statut} »`
  const alertes: AlerteEnvoiElectronique[] = []
  if (mode === null)
    alertes.push({
      code: 'sans_valeur_de_notification',
      message: `Envoi électronique du courrier ${courrier.id} sans mode de notification (LRE ou prestataire qualifié) : il ne vaut pas notification (J50 ; D. 1967 art. 64).`,
    })
  if (abouti && !courrier.dateDepot)
    alertes.push({
      code: 'depot_a_saisir',
      message: `${enConsole} : la date de dépôt du courrier ${courrier.id} n'est pas saisie (controlerDepot, courriers.ts) ; aucun statut de la console ne la donne (🔴).`,
    })
  if (mode === null) return alertes
  if (abouti && !avis)
    alertes.push({
      code: 'avis_a_saisir',
      message:
        envoi.statut === 'Reçu en erreur'
          ? `${enConsole} : vérifier ${SOURCE_AVIS[mode]} si l'avis électronique a été transmis, et ne saisir sa date (controlerAvisElectronique, courriers.ts) sur le courrier ${courrier.id} que si ce justificatif l'établit. Avis transmis, envoi ensuite refusé ou non réclamé : la date de l'avis vaut, le délai court de son lendemain (D. 1967 art. 64, dernier al. ; décision de Hugo du 17/11/2026, J57) ; défaut de transmission de l'avis : aucune date à saisir, le délai ne court pas. Sans cette date, le délai n'est pas calculé (J50).`
          : `${enConsole} : saisir sur le courrier ${courrier.id} la date de transmission de l'avis électronique (controlerAvisElectronique, courriers.ts), lue ${SOURCE_AVIS[mode]} ; aucun statut de la console ne la donne (J57) et, sans elle, le délai n'est pas calculé (J50).`,
    })
  if (avis && !abouti)
    alertes.push({
      code: 'avis_sans_envoi_abouti',
      message: `Avis électronique du ${dateIsoVersFr(avis)} saisi sur le courrier ${courrier.id} alors que la console ne montre aucun envoi abouti (statut « ${envoi.statut} ») : vérifier cette date ${SOURCE_AVIS[mode]} ; c'est elle, non le statut, qui fait courir le délai (J50).`,
    })
  if (avis && envoi.statut === 'Reçu en erreur')
    alertes.push({
      code: 'retour_en_erreur_apres_avis',
      message: `${enConsole} après l'avis du ${dateIsoVersFr(avis)} saisi sur le courrier ${courrier.id} : le module garde cette date, seule retenue pour le délai (une notification électronique est acquise à la transmission de l'avis, téléchargé ou non : D. 1967 art. 64, dernier al. ; J50) ; un refus ou une non-réclamation après l'avis ne remettent pas en cause sa date (décision de Hugo du 17/11/2026, J57). Vérifier toutefois ${SOURCE_AVIS[mode]} que l'avis a bien été transmis à cette date : un retour en erreur peut aussi signaler un défaut de transmission de l'avis, qui ne fait pas courir le délai ; la date saisie serait alors à retirer.`,
    })
  return alertes
}

/**
 * Lecture d'une notification électronique : l'état du courrier (etatNotificationCourrier) et la date de transmission de
 * l'avis saisie sur le courrier (J50), jamais déduits du statut de la console ; alertes quand le statut et le courrier ne
 * concordent pas. Erreur si le courrier n'est pas celui de l'envoi, ou si son mode n'est plus celui figé à la création.
 */
export function lireNotificationElectronique(
  envoi: EnvoiNotificationElectronique,
  courrier: CourrierSuivi & { id: string },
): LectureNotificationElectronique {
  if (envoi.type !== 'notification')
    throw new Error(`Lecture refusée : l'envoi ${String(envoi.id)} est de type « ${String(envoi.type)} », pas une notification électronique.`)
  verifierEnvoi(MACHINE_NOTIFICATION, envoi)
  if (courrier.id !== envoi.courrierId)
    throw new Error(`Lecture refusée : l'envoi ${envoi.id} est rattaché au courrier ${envoi.courrierId}, pas à ${courrier.id}.`)
  const modeCourrier = modeNotificationCourrier(courrier)
  if (modeCourrier !== envoi.modeNotification)
    throw new Error(
      `Lecture refusée : mode « ${envoi.modeNotification ?? 'aucun'} » à la création de l'envoi, « ${modeCourrier ?? 'aucun'} » sur le courrier ${courrier.id} : le mode est figé à la création (J50).`,
    )
  const avis = envoi.modeNotification === null ? null : (courrier.dateAvisElectronique ?? null)
  return {
    statut: envoi.statut,
    modeNotification: envoi.modeNotification,
    etatCourrier: etatNotificationCourrier(courrier),
    dateAvisElectronique: avis,
    valeurDuStatut: 'non_etablie',
    alertes: alertesNotification(envoi, courrier, avis),
  }
}

export interface LectureSignatureElectronique {
  statut: StatutSignatureElectronique
  final: boolean
  /** « Signé », « Stocké, signé » ou « À relever » (🔵 lecture des libellés, STATUTS_SIGNATURE_OBTENUE). */
  signatureObtenue: boolean
  /** Horodatage du premier passage à un statut de signature obtenue, tel que la console l'a enregistré. */
  signatureConstateeLe: string | null
  /** Niveau donné par le prestataire ; absent sur l'envoi : « inconnu » (J67, R16). */
  niveauSignature: NiveauSignatureElectronique
  /** Selon le niveau (valeurProbanteSignature) ; null tant que la signature n'est pas obtenue (🔵, en-tête). */
  valeurProbante: ValeurProbanteSignature | null
}

export interface ValeurProbanteSignature {
  /** Qualifiée : présumée fiable ; autre niveau : recevable, fiabilité à prouver si elle est contestée. */
  valeur: 'presumee_fiable' | 'recevable_a_prouver'
  niveau: NiveauSignatureElectronique
  fondements: readonly string[]
  message: string
}

const LIBELLES_NIVEAUX_SIGNATURE: Record<NiveauSignatureElectronique, string> = {
  simple: 'Signature électronique simple',
  avancee: 'Signature électronique avancée',
  qualifiee: 'Signature électronique qualifiée',
  inconnu: 'Niveau de signature inconnu (le statut « Signé » ne le dit pas)',
}

/**
 * Valeur probante d'une signature électronique selon son niveau (J67, R16) : qualifiée, fiabilité présumée (C. civ. art.
 * 1367, al. 2 ; décret n° 2017-1416, art. 1 ; eIDAS, art. 25, 2) ; simple, avancée ou inconnue (absent ou null),
 * recevable comme preuve, sans présomption (C. civ. art. 1366 et 1367 ; eIDAS, art. 25, 1 ; Cass. 3e civ., 05/03/2026,
 * n° 24-21.034). Niveau hors liste : refus.
 */
export function valeurProbanteSignature(niveauSaisi?: NiveauSignatureElectronique | null): ValeurProbanteSignature {
  const niveau = niveauDeSignature(niveauSaisi)
  if (niveau === 'qualifiee')
    return {
      valeur: 'presumee_fiable',
      niveau,
      fondements: ['C. civ. art. 1367, al. 2', 'décret n° 2017-1416, art. 1', 'règlement (UE) n° 910/2014 (eIDAS), art. 25, 2'],
      message: `${LIBELLES_NIVEAUX_SIGNATURE[niveau]} : fiabilité présumée, même effet qu'une signature manuscrite (C. civ. art. 1367, al. 2 ; décret n° 2017-1416, art. 1 ; eIDAS, art. 25, 2).`,
    }
  return {
    valeur: 'recevable_a_prouver',
    niveau,
    fondements: ['C. civ. art. 1366 et 1367', 'règlement (UE) n° 910/2014 (eIDAS), art. 25, 1', 'Cass. 3e civ., 05/03/2026, n° 24-21.034'],
    message: `${LIBELLES_NIVEAUX_SIGNATURE[niveau]} : recevable comme preuve, sans présomption de fiabilité ; contestée, sa fiabilité est à prouver (C. civ. art. 1366 et 1367 ; eIDAS, art. 25, 1 ; Cass. 3e civ., 05/03/2026, n° 24-21.034). Pour un procès-verbal d'assemblée tenu dans un registre électronique, préférer la signature qualifiée, seule présumée fiable (D. 1967 art. 17).`,
  }
}

export function lireSignatureElectronique(envoi: EnvoiSignatureElectronique): LectureSignatureElectronique {
  if (envoi.type !== 'signature')
    throw new Error(`Lecture refusée : l'envoi ${String(envoi.id)} est de type « ${String(envoi.type)} », pas une signature électronique.`)
  verifierEnvoi(MACHINE_SIGNATURE, envoi)
  const signatureObtenue = STATUTS_SIGNATURE_OBTENUE.has(envoi.statut)
  const niveauSignature = niveauDeSignature(envoi.niveauSignature)
  return {
    statut: envoi.statut,
    final: REFERENTIEL_SIGNATURE_ELECTRONIQUE[envoi.statut].final,
    signatureObtenue,
    signatureConstateeLe: envoi.historique.find((e) => STATUTS_SIGNATURE_OBTENUE.has(e.statut))?.horodatage ?? null,
    niveauSignature,
    valeurProbante: signatureObtenue ? valeurProbanteSignature(niveauSignature) : null,
  }
}
