// ── AJ Signalement : signalements déposés par QR code ─────────────────────────
//
// Application publique « AJ Signalement » : chaque copropriété a un QR code unique qui ouvre
// /fr/signalement/<jeton>/ ; la personne qui le scanne décrit le problème (même parcours que
// « Signaler un problème » du portail copropriétaire) et laisse ses coordonnées, toutes
// obligatoires (bâtiment et qualité compris depuis le 06/11/2026). Le signalement est conservé (tables
// signalements_qr_*, migrations 20261104 et 20261106) et envoyé par e-mail aux destinataires de la
// copropriété. Aucun lien avec le logiciel Syndic : ces types ne connaissent ni cabinet, ni immeuble, ni
// fiche de copropriétaire.

import { CHEMIN_ESPACE_QR, type VueEspaceQr } from '@/lib/aj-signalement/acces-espace'
import { urlSignalementCabinetQr } from '@/lib/aj-signalement/chemin-cabinet'

export type StatutSignalementQr = 'en_attente' | 'acceptee' | 'en_cours' | 'terminee' | 'annulee'
export type PrioriteSignalementQr = 'urgente' | 'normale' | 'planifiee'
export type LangueSignalementQr = 'fr' | 'pt'
/** « Vous êtes : Propriétaire / Locataire » (demande de Hugo du 06/11/2026). */
export type QualiteDeclarantQr = 'proprietaire' | 'locataire'
/** Statuts d'un signalement encore ouvert : seuls ceux-là sont proposés comme « déjà faits au même endroit ». */
export type StatutOuvertQr = Extract<StatutSignalementQr, 'en_attente' | 'acceptee' | 'en_cours'>

export const STATUTS_SIGNALEMENT_QR: readonly StatutSignalementQr[] = ['en_attente', 'acceptee', 'en_cours', 'terminee', 'annulee']
export const PRIORITES_SIGNALEMENT_QR: readonly PrioriteSignalementQr[] = ['urgente', 'normale', 'planifiee']
export const QUALITES_DECLARANT_QR: readonly QualiteDeclarantQr[] = ['proprietaire', 'locataire']
export const STATUTS_OUVERTS_QR: readonly StatutOuvertQr[] = ['en_attente', 'acceptee', 'en_cours']

/** Jeton d'un QR code : 32 caractères hexadécimaux (UUID sans tirets, tiré par la base ou par le serveur). */
export const JETON_QR = /^[0-9a-f]{32}$/

/** Numéro communiqué au public (numeroSignalementQr) : 8 hexadécimaux en majuscules. */
export const NUMERO_QR = /^[0-9A-F]{8}$/

export const estJetonQr = (valeur: unknown): valeur is string => typeof valeur === 'string' && JETON_QR.test(valeur)

export const estQualiteDeclarantQr = (valeur: unknown): valeur is QualiteDeclarantQr =>
  typeof valeur === 'string' && (QUALITES_DECLARANT_QR as readonly string[]).includes(valeur)

export const estStatutOuvertQr = (valeur: unknown): valeur is StatutOuvertQr =>
  typeof valeur === 'string' && (STATUTS_OUVERTS_QR as readonly string[]).includes(valeur)

/** Adresse proposée d'après la position d'un déclarant, avec la date du signalement qui l'a apportée. */
export interface AdresseProposeeQr {
  adresse: string
  le: string
}

/**
 * Copropriété dotée d'un QR code, telle que le tableau de bord la voit. Les champs de gestion (cabinet, gestionnaires,
 * compteurs…, GestionCoproprieteQr) sont calculés par le serveur depuis le 11/11/2026 ; tant que la migration manque,
 * ils prennent leurs valeurs par défaut (gestionCoproprieteQrVide).
 */
export interface CoproprieteQr extends GestionCoproprieteQr {
  id: string
  nom: string
  adresse: string
  jeton: string
  /** Adresses qui reçoivent les signalements ; vide = adresse de l'administrateur du déploiement. */
  emailsDestinataires: string[]
  actif: boolean
  creeLe: string
  nbSignalements: number
  nbEnAttente: number
  /**
   * Copropriété sans adresse seulement : la plus récente des adresses proposées par les déclarants (d'après leur
   * position), que le super admin peut enregistrer comme adresse de la copropriété ; null sinon.
   */
  derniereAdresseProposee: AdresseProposeeQr | null
}

/** Ce que le public voit de la copropriété après le scan. */
export interface CoproprieteQrPublique {
  nom: string
  adresse: string
}

/** Signalement reçu (tableau de bord : toutes les coordonnées du déclarant). */
export interface SignalementQr {
  id: string
  coproprieteId: string
  coproprieteNom: string
  prenom: string
  nom: string
  telephone: string
  email: string
  batiment: string
  etage: string
  numLot: string
  estPartieCommune: boolean
  zoneSignalee: string
  typeIntervention: string
  description: string
  priorite: PrioriteSignalementQr
  statut: StatutSignalementQr
  langue: LangueSignalementQr
  emailEnvoyeLe: string | null
  emailErreur: string | null
  /** E-mail de confirmation au déclarant (migration 20261106) ; null et null pour les dépôts antérieurs. */
  confirmationEnvoyeeLe: string | null
  confirmationErreur: string | null
  /** Migration 20261106_signalements_qr_geoloc_qualite : null pour les dépôts antérieurs. */
  qualiteDeclarant: QualiteDeclarantQr | null
  /** Adresse proposée d'après la position du déclarant (texte seul, jamais les coordonnées) ; '' sinon. */
  adresseProposee: string
  /** Signalement déjà fait au même endroit que le déclarant a désigné comme « le même problème ». */
  signalementLieId: string | null
  creeLe: string
  misAJourLe: string
  /**
   * Vue d'un gestionnaire seulement (PR 2, lib/aj-signalement/minimisation.ts) : qui a changé le statut en dernier, sans
   * nom ni compte (vous, un collègue, le cabinet) ; null : jamais changé. Absent pour le super admin.
   */
  statutModifiePar?: AuteurStatutQr | null
}

/** Auteur d'un changement de statut tel qu'un gestionnaire le voit (jamais un nom ni un identifiant). */
export type AuteurStatutQr = 'vous' | 'collegue' | 'cabinet'

/** Corps du POST public /api/aj-signalement/signalements (validé par signalementQrSchema, lib/validation.ts). */
export interface SaisieSignalementQr {
  jeton: string
  prenom: string
  nom: string
  telephone: string
  email: string
  batiment: string
  etage: string
  numLot: string
  /** '' est refusé par le serveur (champ obligatoire) : le formulaire n'envoie qu'une fois complet. */
  qualiteDeclarant: QualiteDeclarantQr | ''
  estPartieCommune: boolean
  zoneSignalee: string
  typeIntervention: string
  description: string
  priorite: PrioriteSignalementQr
  langue: LangueSignalementQr
  /** Adresse proposée d'après la position (copropriété sans adresse) ; '' si la personne a refusé ou si rien n'a été trouvé. */
  adresseProposee: string
  /** Numéro (8 hexadécimaux) du signalement désigné comme « le même problème » ; '' sinon. Le serveur le vérifie. */
  signalementLieNumero: string
}

/**
 * Signalement déjà fait au même endroit, tel que le public le voit pendant la rédaction (GET similaires) : ni
 * identifiant, ni bâtiment, ni coordonnées, ni description ; type et zone pris dans les listes fixes.
 */
export interface SignalementSemblableQr {
  numero: string
  typeIntervention: string
  zone: string
  /** Jour du dépôt à Paris (AAAA-MM-JJ), jamais l'heure : avec le bâtiment et la zone, elle désignerait le déclarant. */
  creeLe: string
  statut: StatutOuvertQr
}

/** Réponse de GET /api/aj-signalement/tableau. */
export interface TableauQr {
  coproprietes: CoproprieteQr[]
  signalements: SignalementQr[]
  /** Avec ?gestionnaire=<id> seulement : la fiche dont c'est la page de suivi (vue par le super admin). */
  gestionnaire?: GestionnaireSuiviQr
}

/** Fiche dont le tableau est la page de suivi (sa portée : attributions ∪ « à tous » de son cabinet). */
export interface GestionnaireSuiviQr {
  id: string
  nom: string | null
  actif: boolean
  cabinet: CabinetResumeQr
}

/** Copropriété saisie ou modifiée depuis le tableau de bord. */
export interface SaisieCoproprieteQr {
  nom: string
  adresse: string
  emailsDestinataires: string[]
}

/**
 * Adresse publique du QR code. Copropriété rattachée à un cabinet client (choix de Hugo du 10/11/2026) :
 * …/<identifiant>/signalement/<jeton>/ ; sans cabinet : l'ancienne adresse …/fr/signalement/<jeton>/, que gardent les
 * affiches déjà imprimées (l'ancienne page redirige vers le chemin du cabinet une fois la copropriété rattachée).
 */
export function urlSignalementQr(jeton: string, origine = 'https://vitfix.io', identifiantCabinet?: string | null): string {
  if (identifiantCabinet) return urlSignalementCabinetQr(identifiantCabinet, jeton, origine)
  return `${origine.replace(/\/+$/, '')}/fr/signalement/${jeton}/`
}

/** Numéro communiqué au déclarant : huit premiers caractères de l'identifiant, en majuscules (comme le portail). */
export const numeroSignalementQr = (id: string): string => id.replace(/-/g, '').slice(0, 8).toUpperCase()

/**
 * Vue « Signalements » de l'espace indépendant AJ Signalement (lien de l'e-mail envoyé à l'administrateur). Les e-mails
 * envoyés avant le 10/11/2026 pointent vers l'ancien écran du portail (#signalementsQr), qui ramène à son accueil.
 */
export const ANCRE_TABLEAU_QR: VueEspaceQr = 'signalements'
export const CHEMIN_TABLEAU_QR = `${CHEMIN_ESPACE_QR}#${ANCRE_TABLEAU_QR}`

// ── Cabinets clients, gestionnaires, journal (migration 20261111_signalements_qr_gestionnaires) ──────────────
//
// Demandes de Hugo du 10/11/2026 : chaque cabinet client a sa ligne (nom, identifiant du chemin public
// vitfix.io/<identifiant>/…, langue, domaines e-mail), saisie par le super admin dans l'espace, jamais dans le code ;
// ses gestionnaires reçoivent par e-mail les signalements de leurs copropriétés. Les listes fermées ci-dessous sont
// celles des CHECK de la migration (tests/lib/aj-signalement-types-journal.test.ts les compare au texte SQL).

/** Langue de la page publique de signalement d'un cabinet (colonne signalements_qr_cabinets.langue, fr par défaut). */
export type LangueCabinetQr = 'fr' | 'pt'
export const LANGUES_CABINET_QR: readonly LangueCabinetQr[] = ['fr', 'pt']

/**
 * Langues des cabinets qui peuvent diffuser (PR 3, décision H9 : ouverture au Portugal après vérification du droit
 * portugais ; H4 : textes portugais à relire). Même liste que la règle d'inactivité de la migration 20261113
 * (signalements_qr_diffusion_raison_inactive, raison langue_non_ouverte ; test d'accord dans
 * tests/migrations/signalements_qr_diffusion.test.ts) : un cabinet d'une autre langue ne diffuse pas, même activé puis
 * passé dans cette langue. L'activation (D-R8) s'y réfère aussi.
 */
export const LANGUES_DIFFUSION_OUVERTES_QR: readonly LangueCabinetQr[] = ['fr']

/** Ce qu'une copropriété ou une fiche porte de son cabinet. */
export interface CabinetResumeQr {
  id: string
  nom: string
  /** Chemin public : /<identifiant>/signalement/<jeton>/. */
  identifiant: string
}

/**
 * Logo d'un cabinet client (migration 20261114_signalements_qr_logo_cabinet.sql, demande de Hugo du 13/11/2026) :
 * métadonnées seulement ; l'image (PNG) est lue par sa route publique, à l'adresse cheminLogoCabinetQr
 * (lib/aj-signalement/logo.ts), jamais dans une réponse JSON.
 */
export interface LogoCabinetQr {
  /** 16 caractères hexadécimaux : empreinte de l'image (adresse de lecture, mise en cache sans fin). */
  version: string
  /** Pixels (800 au plus). */
  largeur: number
  /** Pixels (400 au plus). */
  hauteur: number
}

/**
 * Logo d'un cabinet pour un e-mail (accusé de réception au déclarant) : l'image PNG revérifiée, envoyée en pièce jointe
 * EN LIGNE (jamais une image distante), ses métadonnées, et le nom du cabinet (texte alternatif). Serveur seulement.
 */
export interface LogoEmailCabinetQr extends LogoCabinetQr {
  nom: string
  png: Uint8Array
}

/** Cabinet client tel que l'espace du super admin le voit. */
export interface CabinetQr extends CabinetResumeQr {
  langue: LangueCabinetQr
  /** Domaines e-mail des gestionnaires (minuscules) ; un domaine appartient à un seul cabinet. */
  domaines: string[]
  /** Vrai dès que le cabinet a une copropriété ou un gestionnaire : l'identifiant ne change plus (trigger en base). */
  identifiantFige: boolean
  nbCoproprietes: number
  nbGestionnaires: number
  /** Logo du cabinet ; ABSENT : aucun logo, ou migration 20261114 non appliquée (réponse identique à avant). */
  logo?: LogoCabinetQr
}

/** États d'une fiche gestionnaire : les 5 premiers en PR 1 ; les 4 suivants réservés à la PR 2 (accès à sa page). */
export const ETATS_GESTIONNAIRE_QR = [
  'confirmation_envoyee', 'confirmation_expiree', 'adresse_confirmee', 'adresse_contestee', 'desactive',
  'acces_envoye', 'acces_ouvert', 'refus_autre_espace', 'effacement_demande',
] as const
export type EtatGestionnaireQr = (typeof ETATS_GESTIONNAIRE_QR)[number]

/** Gestionnaire tel qu'une copropriété le cite (nom null : fiche pseudonymisée, « Ancien gestionnaire »). */
export interface GestionnaireResumeQr {
  id: string
  nom: string | null
}

/** Ligne de la liste des gestionnaires (jamais de jeton d'envoi). */
export interface GestionnaireQr extends GestionnaireResumeQr {
  cabinet: CabinetResumeQr
  /** null : fiche pseudonymisée (RGPD). */
  email: string | null
  etat: EtatGestionnaireQr
  /** Adresse hors des domaines du cabinet, acceptée par le super admin (journalisé). */
  domaineForce: boolean
  /** Nombre de copropriétés attribuées. */
  coproprietes: number
  ouverts: number
  urgents: number
  creeLe: string
  confirmeeLe: string | null
  /**
   * Accès à l'espace du cabinet (PR 2, colonnes de la migration 20261112, lues à part) : ABSENTS tant que la migration
   * manque (réponse identique à la PR 1). Jamais l'identifiant du compte relié.
   */
  accesOuvertLe?: string | null
  connexionBloquee?: boolean
  effacementDemandeLe?: string | null
  compteRelie?: boolean
}

/** D'où vient une attribution (CHECK de signalements_qr_attributions.origine). */
export const ORIGINES_ATTRIBUTION_QR = ['super_admin', 'creation', 'import', 'reattribution'] as const
export type OrigineAttributionQr = (typeof ORIGINES_ATTRIBUTION_QR)[number]

/** Auteur d'une ligne du journal (CHECK de signalements_qr_journal.acteur_profil). */
export const PROFILS_ACTEUR_QR = ['super_admin', 'gestionnaire', 'systeme'] as const
export type ProfilActeurQr = (typeof PROFILS_ACTEUR_QR)[number]

/**
 * Actions du journal (CHECK signalements_qr_journal_action_valeurs) : liste fermée posée par la 20261111 (actions de la
 * PR 2 comprises), remplacée par la 20261113 qui y ajoute les 7 actions de la diffusion (PR 3).
 */
export const ACTIONS_JOURNAL_QR = [
  'cabinet.cree', 'cabinet.modifie', 'cabinet.domaines_modifies',
  'copropriete.creee', 'copropriete.modifiee', 'copropriete.desactivee', 'copropriete.reactivee',
  'copropriete.jeton_remplace', 'copropriete.supprimee', 'copropriete.tous_active', 'copropriete.tous_retire',
  'copropriete.rattachee',
  'attribution.ajoutee', 'attribution.retiree',
  'gestionnaire.cree', 'gestionnaire.modifie', 'gestionnaire.confirmation_envoyee', 'gestionnaire.adresse_confirmee',
  'gestionnaire.adresse_contestee', 'gestionnaire.domaine_force', 'gestionnaire.desactive', 'gestionnaire.reactive',
  'gestionnaire.pseudonymise', 'gestionnaire.exporte',
  'gestionnaire.acces_envoye', 'gestionnaire.acces_ouvert', 'gestionnaire.refus_autre_espace',
  'gestionnaire.connexion_bloquee', 'gestionnaire.effacement_demande',
  'signalement.statut', 'doublon.refuse', 'doublon.force', 'import.realise', 'journal.purge',
  // Migration 20261113 (PR 3) : diffusion de messages d'exploitation aux déclarants.
  'cabinet.diffusion_activee', 'cabinet.diffusion_suspendue',
  'diffusion.envoyee', 'diffusion.reprise', 'diffusion.opposition', 'diffusion.opposition_levee', 'diffusion.purge',
] as const
export type ActionJournalQr = (typeof ACTIONS_JOURNAL_QR)[number]

/** Ligne du journal vue par le super admin : identifiants, noms de champs, énumérations et nombres seulement. */
export interface EvenementJournalQr {
  /** BIGINT de la base, rendu en chaîne. */
  id: string
  creeLe: string
  cabinetId: string | null
  action: ActionJournalQr
  /** nom : joint pour l'affichage (gestionnaire auteur) ; null pour le super admin, le système ou une fiche effacée. */
  acteur: { profil: ProfilActeurQr; nom: string | null }
  coproprieteId: string | null
  coproprieteNom: string | null
  gestionnaireId: string | null
  gestionnaireNom: string | null
  signalementId: string | null
  operationId: string | null
  /** NOMS des champs modifiés, jamais leurs valeurs. */
  champs: string[]
  details: Record<string, unknown>
}

/** Résultat de signalements_qr_creer_coproprietes (saisie = lot d'une ligne, ou import). */
export interface ResultatCreationQr {
  creees: Array<{ numeroLigne: number; id: string; jeton: string }>
  completees: Array<{ numeroLigne: number; id: string }>
  /** Vrai : même operationId déjà traité, résultat du premier appel. */
  rejeu: boolean
}

/**
 * Messages des erreurs métier levées par les fonctions SQL (SQLSTATE P0001), traduits par les routes en codes publics
 * 409 ; 42501 (interdit) et 22023 (paramètre invalide) n'en font pas partie.
 */
export const ERREURS_METIER_SQL_QR = [
  'doublon', 'a_reverifier', 'sans_cabinet', 'identifiant_pris', 'identifiant_fige', 'domaine_pris', 'cabinet_fige',
  'hors_domaine', 'domaine_autre_cabinet',
  // Migration 20261112 (PR 2) : envoi d'un accès (signalements_qr_envoyer_acces).
  'deja_ouvert', 'adresse_contestee',
  // Migration 20261112 (contre-vérification du 12/11) : création d'une fiche sur une boîte déjà portée par une fiche
  // (signalements_qr_inviter_gestionnaire ; identifiant de cette fiche en DETAIL, rendu par la route).
  'existe_deja',
  // Migration 20261113 (PR 3, diffusion) : copropriété qui ne peut pas diffuser (inactive, sans cabinet, cabinet non
  // activé, fin de mission atteinte), personne dans le périmètre, nombre réel au-dessus de l'aperçu ou aperçu périmé.
  'diffusion_inactive', 'aucun_destinataire', 'perimetre_change',
  // Migration 20261113, réglages du cabinet (route D-R8) : activation refusée, réglage manquant ou langue non ouverte (H9).
  'cabinet_incomplet', 'langue_non_ouverte',
] as const
export type ErreurMetierSqlQr = (typeof ERREURS_METIER_SQL_QR)[number]

/**
 * Attributions d'une fiche gestionnaire, au plus (borne de la base, 20261111 : HAVING count(*) > 1000 → 22023). La page
 * profil (ensemble complet) et le départ (une succession par attribution) en reçoivent autant au plus (lib/validation.ts).
 */
export const ATTRIBUTIONS_MAX_PAR_GESTIONNAIRE_QR = 1000

/** Auteur d'une copropriété : le super admin, ou un gestionnaire (PR 2). */
export type CreateurCoproprieteQr = 'administrateur' | { gestionnaireId: string; nom: string | null }

/**
 * Champs de gestion d'une copropriété (migration 20261111) : cabinet, fiche détaillée, gestionnaires, compteurs. Tous
 * obligatoires. CoproprieteQr les reçoit quand le serveur les calcule (lot 3) ; d'ici là, et pour une réponse ancienne
 * ou un simulacre de test, gestionCoproprieteQrVide() donne leurs valeurs par défaut.
 */
export interface GestionCoproprieteQr {
  /** null : copropriété sans cabinet (adresse /fr/signalement/<jeton>/, aucun gestionnaire). */
  cabinet: CabinetResumeQr | null
  codePostal: string
  ville: string
  immatriculation: string | null
  referenceCabinet: string | null
  batiments: string[]
  /** Vue par tous les gestionnaires actifs de son cabinet (copropriété de test) ; jamais sans cabinet. */
  attribueeATous: boolean
  gestionnaires: GestionnaireResumeQr[]
  creePar: CreateurCoproprieteQr
  ouverts: number
  urgentsOuverts: number
  /** Signalements en attente depuis plus de 48 heures. */
  attente48h: number
  /** Date du dernier signalement ; null s'il n'y en a aucun. */
  dernier: string | null
  /** Adresses saisies qui sont celles d'une fiche gestionnaire (données antérieures, à nettoyer par le super admin). */
  adressesDeGestionnaires: number
  /**
   * Vue d'un gestionnaire seulement (PR 2, lib/aj-signalement/minimisation.ts), absents pour le super admin :
   * fiche modifiable par lui (attribuée nommément), saisies masquées (adresse d'une autre fiche), créée par lui.
   */
  modifiable?: boolean
  adressesMasquees?: number
  creeeParVous?: boolean
}

/** Valeurs par défaut des champs de gestion : tableaux neufs à chaque appel. */
export function gestionCoproprieteQrVide(): GestionCoproprieteQr {
  return {
    cabinet: null, codePostal: '', ville: '', immatriculation: null, referenceCabinet: null, batiments: [],
    attribueeATous: false, gestionnaires: [], creePar: 'administrateur',
    ouverts: 0, urgentsOuverts: 0, attente48h: 0, dernier: null, adressesDeGestionnaires: 0,
  }
}

// ── Fonctions pures du lot 2 (chemin par client, droits, doublons, destinataires, budget, fiches) ──────────────

/** Chemin public d'un cabinet reconnu par cheminPublicCabinetQr (chemin-cabinet.ts) ; aucun droit n'en découle. */
export type CheminCabinetQr =
  | { page: 'signalement'; identifiant: string; jeton: string }
  | { page: 'confirmation-adresse'; identifiant: string }
  // Ouverture de l'accès d'un gestionnaire (PR 2, lot 3) : lien de l'e-mail, page publique.
  | { page: 'invitation'; identifiant: string }

/**
 * Espace d'un cabinet reconnu par cheminEspaceCabinetQr (PR 2, lot 4) : /<id>/ (accueil, redirigé vers le suivi),
 * /<id>/connexion/, /<id>/suivi/ ; identifiant valable (jamais un nom réservé). Aucun droit n'en découle.
 */
export interface EspaceCabinetQr {
  page: 'accueil' | 'connexion' | 'suivi'
  identifiant: string
}

/** Refus d'un identifiant de chemin : hors format (3 à 40 caractères…) ou réservé (route du site, mot gardé). */
export type ValidationIdentifiantCabinetQr = { ok: true } | { ok: false; raison: 'format' | 'reserve' }

/** Refus d'un domaine e-mail de cabinet : hors format, ou messagerie publique (gmail.com…). */
export type ValidationDomaineCabinetQr = { ok: true } | { ok: false; raison: 'format' | 'public' }

/**
 * Profil pour le calcul des droits (acces-espace.ts) : le super admin, un gestionnaire à fiche active (PR 2), ou
 * aucun droit (fiche désactivée, rôle sans fiche, tout autre compte).
 */
export type ProfilDroitsQr = 'super_admin' | 'gestionnaire' | 'aucun'

/** Colonnes de droits d'une copropriété (aucune autre n'entre dans la portée). */
export interface CoproDroitsQr {
  id: string
  /** null : copropriété sans cabinet, jamais dans la portée d'un gestionnaire. */
  cabinetId: string | null
  attribueeATous: boolean
}

/** Fiche gestionnaire relue en base à chaque appel (jamais app_metadata). */
export interface FicheDroitsQr {
  id: string
  cabinetId: string
  actif: boolean
}

/** Portée d'un gestionnaire (RG-05) : identifiants de copropriétés. modifiables ⊆ visibles. */
export interface PorteeQr {
  visibles: ReadonlySet<string>
  modifiables: ReadonlySet<string>
}

/** Droits sur une copropriété (matrice SPEC § 1.5). */
export interface DroitsCoproprieteQr {
  /** Voir la copropriété, son QR code, ses signalements (coordonnées comprises). */
  voir: boolean
  changerStatut: boolean
  /** Nom, adresse, CP, ville, immatriculation, référence, bâtiments, destinataires. */
  modifierFiche: boolean
  /** Désactiver, remplacer le QR, supprimer, attribuer, « à tous », gestionnaires, import, journal. */
  administrer: boolean
}

export type CertitudeDoublonQr = 'certain' | 'probable'
/** Critère du doublon, du plus sûr au moins sûr (SPEC § 1.6). */
export type CritereDoublonQr = 'immatriculation' | 'reference_cabinet' | 'nom_code_postal' | 'adresse_code_postal' | 'nom'

/** Champs comparés pour les doublons (saisie, ligne d'import, ou copropriété existante). */
export interface FicheDoublonQr {
  nom: string
  adresse: string
  codePostal: string
  immatriculation: string | null
  referenceCabinet: string | null
}

/** Copropriété existante du cabinet, active ou non (sa clé de nom est recalculée : cle_nom peut être NULL). */
export interface CoproprieteDoublonQr extends FicheDoublonQr {
  id: string
  ville: string
}

export interface DoublonQr {
  certitude: CertitudeDoublonQr
  critere: CritereDoublonQr
  /** Seul le doublon nom + code postal se force (« Ce n'est pas un doublon », super admin seul). */
  forcable: boolean
  copropriete: { id: string; nom: string; ville: string }
}

/**
 * Décision sur les doublons d'une création ou d'une modification. doublonForce : un doublon nom + CP a été forcé par
 * le super admin (la route passe alors forcerDoublon à la fonction SQL, qui journalise doublon.force).
 */
export type DecisionDoublonsQr =
  | { ok: true; doublonForce: boolean; probableConfirme: boolean }
  | { ok: false; doublon: DoublonQr }

export type TypeDestinataireQr = 'gestionnaire' | 'saisi' | 'administrateur'

/**
 * Ligne de signalements_qr_emails_gestionnaires : exclu = false → destinataire (adresse de la fiche) ; exclu = true → à
 * retirer des saisies (20261111 : l'adresse de la fiche partie ou contestée ; 20261112 : la SAISIE reconnue comme la
 * sienne, même boîte ou même partie locale sur un autre domaine de son cabinet).
 */
export interface LigneEmailGestionnaireQr {
  gestionnaireId: string
  email: string
  accesOuvert: boolean
  exclu: boolean
}

export interface DestinataireQr {
  /** Adresse canonique (rognée, minuscules). */
  email: string
  type: TypeDestinataireQr
  /** Gestionnaire qui a accès à sa page de suivi (PR 2) ; false sinon. */
  accesOuvert: boolean
}

/** Destinataires d'un signalement, plafonnés ; auDelaDuPlafond > 0 : adresses écartées (avertissement sans adresse). */
export interface CalculDestinatairesQr {
  destinataires: DestinataireQr[]
  auDelaDuPlafond: number
}

/** Adresses saisies montrées à un gestionnaire (PR 2) : celles d'une autre fiche sont remplacées par un compteur. */
export interface SaisiesVisiblesQr {
  emails: string[]
  adressesMasquees: number
}

/**
 * Une fiche telle que la règle « adresse d'une fiche » la lit (RG-06 bis) : son adresse et son cabinet. Sans cabinet,
 * seule la boîte compte (pas de rapprochement par la partie locale).
 */
export interface FicheAdresseQr {
  id?: string
  email: string | null
  cabinetId?: string | null
}

/**
 * Domaines déclarés (minuscules) → leur cabinet. Un domaine n'appartient qu'à un cabinet (contrainte
 * signalements_qr_domaines_domaine_unique de la 20261111). Corrections, tour 2 : même partie locale de boîte sur un domaine
 * du cabinet de la fiche = adresse de la fiche (un cabinet à deux domaines les livre aux mêmes boîtes).
 */
export type CabinetsDesDomainesQr = ReadonlyMap<string, string>

/** Objet d'un envoi à un gestionnaire (CHECK de signalements_qr_invitations.objet) ; 'acces' : PR 2. */
export const OBJETS_ENVOI_QR = ['confirmation_adresse', 'acces'] as const
export type ObjetEnvoiQr = (typeof OBJETS_ENVOI_QR)[number]

/** Refus d'un envoi (CHECK de signalements_qr_invitations.refus) ; 'compte_autre_espace' : PR 2. */
export const REFUS_ENVOI_QR = ['compte_autre_espace', 'pas_moi'] as const
export type RefusEnvoiQr = (typeof REFUS_ENVOI_QR)[number]

/** Champs d'accès d'une fiche (migration 20261112, PR 2) que son état lit : dates et drapeau, jamais le compte. */
export interface AccesFicheEtatQr {
  accesOuvertLe: string | null
  compteRelie: boolean
  effacementDemandeLe: string | null
}

/** Ce que l'état d'une fiche lit de la fiche elle-même. */
export interface FicheEtatGestionnaireQr {
  actif: boolean
  adresseConfirmeeLe: string | null
  adresseContesteeLe: string | null
  /** PR 2, lot 5 : absent tant que la migration 20261112 manque (l'état est alors celui de la PR 1, envois « acces » ignorés). */
  acces?: AccesFicheEtatQr
}

/** Un envoi (ligne de signalements_qr_invitations), sans son jeton. */
export interface EnvoiGestionnaireQr {
  objet: ObjetEnvoiQr
  /** created_at : départ des 7 jours de validité. */
  creeLe: string
  /** invite_sent_at : posé par la route après un envoi réussi ; null si l'e-mail n'est jamais parti. */
  envoyeLe: string | null
  accepteLe: string | null
  refus: RefusEnvoiQr | null
}

/** États d'une fiche calculés en PR 1 (les 4 autres d'ETATS_GESTIONNAIRE_QR viennent avec la PR 2, lot 5). */
export type EtatGestionnairePr1Qr = Extract<
  EtatGestionnaireQr,
  'confirmation_envoyee' | 'confirmation_expiree' | 'adresse_confirmee' | 'adresse_contestee' | 'desactive'
>

// ── Routes du lot 3 (contrôle d'accès, réponses, envois) ────────────────────────────────────────────────────────

/**
 * Rôle serveur (app_metadata.role) d'un compte gestionnaire d'un cabinet client, posé à l'acceptation de son accès, et
 * repère de routage posé avec lui (identifiant du chemin de SON cabinet : il aiguille vers vitfix.io/<identifiant>/suivi/
 * et ne donne AUCUN droit, les routes ne lisent que la fiche). Définis dans acces-espace.ts (module pur lu par le
 * middleware, lot 4), repris ici pour les routes.
 */
export { CLE_REPERE_CABINET_QR, ROLE_GESTIONNAIRE_QR } from '@/lib/aj-signalement/acces-espace'

/**
 * Profil d'un appel authentifié, rendu par controlerAccesQr (lib/aj-signalement/serveur.ts) : le super admin
 * (isSuperAdmin), ou un gestionnaire (rôle app_metadata gestionnaire_signalement ET fiche ACTIVE relue en base par
 * user_id à chaque appel ; cabinet et nom viennent de la fiche, jamais du compte).
 */
export type ProfilQr =
  | { type: 'super_admin'; userId: string }
  | { type: 'gestionnaire'; userId: string; gestionnaireId: string; cabinetId: string; nom: string | null }
export type TypeProfilQr = ProfilQr['type']
export type ProfilGestionnaireQr = Extract<ProfilQr, { type: 'gestionnaire' }>

/** Curseur de page (created_at BRUT de PostgREST, microsecondes comprises, et id de la dernière ligne) ; null : fin. */
export type SuitePageQr = { avant: string; avantId: string } | null

/** Attribution d'une copropriété à une fiche, vue sur la page profil. */
export interface AttributionVueQr {
  coproprieteId: string
  nom: string
  origine: OrigineAttributionQr
  creeLe: string
}

/** Page profil d'un gestionnaire (GET /gestionnaires/[id]) : jamais de jeton d'envoi. */
export interface FicheGestionnaireDetailQr {
  gestionnaire: GestionnaireQr
  envois: EnvoiGestionnaireQr[]
  attributions: AttributionVueQr[]
  /** Copropriétés créées par ce gestionnaire (PR 2). */
  creations: Array<{ id: string; nom: string }>
  journal: EvenementJournalQr[]
}

/** Bilan d'un envoi par lot : messages acceptés et refusés par le service d'e-mail (jamais son texte). */
export interface BilanEnvoiQr {
  envoyes: number
  refuses: number
  total: number
}

// ── Écrans du super admin (lot 4) : saisies envoyées par lib/aj-signalement/api.ts ───────────────────────────

/** Doublon rendu par POST / PATCH /coproprietes (409 doublon), tel que l'écran le montre. */
export type DoublonRenduQr = Pick<DoublonQr, 'certitude' | 'critere' | 'copropriete'>

/**
 * Doublon rendu à un GESTIONNAIRE (PR 2, SPEC § 1.6) : la copropriété n'est nommée que si elle est dans sa portée
 * (« elle est déjà dans vos copropriétés ») ; hors portée, ni nom, ni identifiant, ni ville.
 */
export type DoublonRenduGestionnaireQr = Pick<DoublonQr, 'certitude' | 'critere'> & { copropriete?: DoublonQr['copropriete'] }

/**
 * Champs de gestion d'une copropriété saisis à l'écran (création, modification) : facultatifs, envoyés seulement s'ils
 * sont remplis ou changés (la route répond 503 base_absente à un champ nouveau tant que la migration manque).
 */
export interface SaisieGestionCoproprieteQr {
  cabinetId?: string
  codePostal?: string
  ville?: string
  immatriculation?: string
  referenceCabinet?: string
  batiments?: string[]
  gestionnaireIds?: string[]
  attribueeATous?: boolean
  forcerDoublon?: boolean
  confirmerDoublonProbable?: boolean
  confirmerHorsDomaine?: boolean
}

/** Saisie d'un cabinet client (POST /cabinets). */
export interface SaisieCabinetQr {
  nom: string
  identifiant: string
  langue: LangueCabinetQr
  domaines: string[]
}

/** Saisie d'une fiche gestionnaire (POST /gestionnaires) : ni id ni jeton, tirés par la route. */
export interface SaisieGestionnaireQr {
  nom: string
  email: string
  cabinetId: string
  coproprieteIds: string[]
  forcerDomaine: boolean
}

/** Succession d'une copropriété au départ d'un gestionnaire : un successeur, ou null (sans gestionnaire, ou retrait seul). */
export interface SuccessionDepartQr {
  coproprieteId: string
  versGestionnaireId: string | null
}

/**
 * Copropriétés d'un gestionnaire au départ (SPEC § 1.8) : celles dont il est le seul gestionnaire (successeur à choisir,
 * ou « sans gestionnaire ») et celles où d'autres restent (simplement retirées).
 */
export interface GroupesDepartQr {
  seul: AttributionVueQr[]
  partages: AttributionVueQr[]
}

/** Successions prêtes à envoyer, ou les copropriétés dont le successeur reste à choisir. */
export type DecisionDepartQr = { ok: true; successions: SuccessionDepartQr[] } | { ok: false; manquantes: string[] }

/** Domaines e-mail saisis dans la fiche d'un cabinet : retenus (canoniques, sans doublon) et refusés. */
export interface AnalyseDomainesQr {
  domaines: string[]
  invalides: string[]
}

/** Filtre de la liste des copropriétés : '' (toutes), sans_cabinet, sans_gestionnaire, a_tous, adresses_gestionnaires, gestionnaire:<id>. */
export type FiltreCoproprietesQr = string

/** Filtres et curseur du journal (GET /journal) ; une valeur vide n'est pas envoyée. */
export interface FiltreJournalQr {
  action?: ActionJournalQr | ''
  copropriete?: string
  gestionnaire?: string
  cabinet?: string
  avant?: string
  avantId?: string
}

/** Réponse de signalements_qr_reserver_emails : retenus = dépôts retenus depuis le dernier e-mail parti. */
export interface ReservationEmailsQr {
  accorde: boolean
  retenus: number
}

// ── Import des copropriétés depuis un fichier Excel ou CSV (lot 5, SPEC § 1.9) ────────────────────────────────
//
// Demande de Hugo du 10/11/2026 : « créer les copropriétés à partir d'un tableau Excel fourni par le client ». Le fichier
// est lu dans le navigateur (lib/aj-signalement/import/*), jamais envoyé ni conservé : seules les lignes normalisées
// partent vers POST /api/aj-signalement/coproprietes/import, qui refait toute la vérification (même fonction pure).

/** Champs d'une ligne d'import (colonnes du modèle). */
export type ChampImportQr =
  | 'nom' | 'adresse' | 'codePostal' | 'ville' | 'immatriculation' | 'referenceCabinet' | 'batiments' | 'gestionnaires'
  | 'emailsDestinataires'

/** Colonne du modèle à télécharger : en-tête, rôle, règle, exemple, synonymes reconnus dans le fichier d'un client. */
export interface ColonneModeleImportQr {
  champ: ChampImportQr
  entete: string
  obligatoire: 'oui' | 'conseille' | 'non'
  format: string
  exemple: string
  synonymes: readonly string[]
}

/** Colonne du fichier (index à partir de 0) reliée à chaque champ ; un champ absent est ignoré. */
export type CorrespondanceImportQr = Partial<Record<ChampImportQr, number>>

export interface OptionsImportQr {
  /** Une seule colonne contient l'adresse complète : « 12 rue Exemple 13008 Marseille » est séparée. */
  adresseComplete?: boolean
}

export type NiveauMessageImportQr = 'erreur' | 'avertissement'

/** Message d'une ligne (texte en français, pour le super admin ; jamais journalisé au serveur). */
export interface MessageImportQr {
  niveau: NiveauMessageImportQr
  champ: ChampImportQr | null
  texte: string
}

/** Ce qu'il faut faire d'une ligne qui ressemble à une copropriété existante du cabinet. */
export type ActionSiExisteImportQr = 'ignorer' | 'completer'

/** Ligne normalisée envoyée au serveur (importCoproprietesQrSchema). */
export interface LigneImportQr {
  /** N° de la ligne dans le tableur (1 = première ligne du fichier). */
  numeroLigne: number
  nom: string
  adresse: string
  codePostal: string
  ville: string
  immatriculation: string
  referenceCabinet: string
  batiments: string[]
  /** Adresses e-mail des gestionnaires (minuscules), résolues au serveur sur les fiches du cabinet. */
  gestionnaires: string[]
  /** À défaut d'adresse : noms, reconnus sans ambiguïté parmi les fiches du cabinet. */
  nomsGestionnaires: string[]
  emailsDestinataires: string[]
  actionSiExiste: ActionSiExisteImportQr
  /** Obligatoire avec actionSiExiste = 'completer' : la copropriété existante à compléter. */
  coproprieteExistanteId?: string
  /** « Ce n'est pas un doublon » (nom + code postal, super admin), journalisé. */
  forcerDoublon: boolean
  /** Doublon probable : créer quand même (par défaut). */
  creerSiDoublonProbable: boolean
}

/** Choix du super admin sur une ligne (aperçu). */
export type ChoixLigneImportQr = Pick<LigneImportQr, 'actionSiExiste' | 'coproprieteExistanteId' | 'forcerDoublon' | 'creerSiDoublonProbable'>

/** Ligne lue et normalisée dans le navigateur ; saisie null : erreur de format, la ligne n'est pas envoyée. */
export interface LigneNormaliseeImportQr {
  numeroLigne: number
  nom: string
  saisie: LigneImportQr | null
  messages: MessageImportQr[]
}

export interface NormalisationImportQr {
  lignes: LigneNormaliseeImportQr[]
  /** Plus de LIGNES_IMPORT_MAX_QR lignes de données : « divisez le fichier ». */
  tropDeLignes: boolean
}

export type EtatLigneImportQr = 'a_creer' | 'avertissement' | 'erreur' | 'doublon_fichier' | 'existe_deja'
/** aucune : ligne en erreur, jamais envoyée à la fonction SQL. */
export type ActionImportQr = 'creer' | 'completer' | 'ignorer' | 'aucune'

/** Diagnostic d'une ligne, calculé par la même fonction pure au navigateur et au serveur. */
export interface DiagnosticLigneImportQr {
  numeroLigne: number
  nom: string
  etat: EtatLigneImportQr
  action: ActionImportQr
  messages: MessageImportQr[]
  /** Le doublon le plus grave avec une copropriété existante du cabinet ; null s'il n'y en a pas. */
  doublon: DoublonQr | null
  /** Fiches actives du cabinet attribuées par la ligne (colonne Gestionnaire(s), adresses de fiche des destinataires). */
  gestionnaires: GestionnaireResumeQr[]
  /** Destinataires retenus (canoniques, sans adresse de fiche). */
  emailsDestinataires: string[]
  /** Destinataires retenus hors des domaines du cabinet (confirmerHorsDomaine). */
  emailsHorsDomaine: string[]
}

/** Gestionnaire cité par le fichier sans fiche au cabinet : panneau « créer ces fiches ». */
export interface GestionnaireInconnuImportQr {
  email: string
  /** « prenom.nom@… » → « Prénom Nom », modifiable avant la création. */
  nomPropose: string
  /** Domaine de l'adresse parmi ceux du cabinet ; sinon, création seulement par une case cochée (forcerDomaine). */
  dansDomaines: boolean
  lignes: number[]
}

/** Réponse de « verifier » (et diagnostics à jour d'un 409 a_reverifier). */
export interface VerificationImportQr {
  diagnostics: DiagnosticLigneImportQr[]
  gestionnairesInconnus: GestionnaireInconnuImportQr[]
  /** Une ligne à créer a un destinataire hors des domaines du cabinet : confirmerHorsDomaine exigé. */
  horsDomaine: boolean
}

/** Fiche gestionnaire du cabinet, telle que la vérification la lit. */
export interface FicheImportQr {
  id: string
  nom: string | null
  email: string | null
  actif: boolean
  /** « Ce n'est pas moi » : l'adresse ne reçoit rien et n'est pas attribuable. */
  contestee: boolean
}

/**
 * Ce que la vérification lit du cabinet (et seulement de lui) ; des autres cabinets, rien que les adresses des fiches et
 * les domaines cités par le fichier.
 */
export interface ContexteImportQr {
  domaines: readonly string[]
  fiches: readonly FicheImportQr[]
  /** Adresses (canoniques) des fiches des AUTRES cabinets : jamais attribuables, jamais destinataires. */
  emailsAutresCabinets: readonly string[]
  /**
   * Domaines e-mail déclarés par d'AUTRES cabinets clients : une adresse sans fiche sur l'un d'eux est en erreur, jamais
   * proposée à la création, même forcée (relecture 2, § 6 : un gestionnaire n'est accepté que sur un domaine de SON cabinet).
   */
  domainesAutresCabinets: readonly string[]
  /** Copropriétés du cabinet, actives ou non. */
  existantes: readonly CoproprieteDoublonQr[]
}

/** Champs communs d'une ligne passée à signalements_qr_creer_coproprietes (p_lignes). */
interface LigneSqlImportCommuneQr {
  numeroLigne: number
  /** Un fichier d'une seule ligne reste un import (journal, origine des attributions). */
  origine: 'import'
  nom: string
  adresse: string
  codePostal: string
  ville: string
  immatriculation: string
  referenceCabinet: string
  batiments: string[]
  emails: string[]
  gestionnaireIds: string[]
  forcerDoublon: boolean
}

/**
 * Ligne de p_lignes : « creer » porte la clé de SON nom ; « compléter » (le nom de la fiche ne change pas) porte la clé
 * du nom de la fiche EXISTANTE, écrite dans cle_nom si elle y manque (relecture 8).
 */
export type LigneSqlImportQr =
  | (LigneSqlImportCommuneQr & { action: 'creer'; cleNom: string })
  | (LigneSqlImportCommuneQr & { action: 'completer'; coproprieteId: string; cleNomExistante: string })

export interface PlanImportQr {
  lignesSql: LigneSqlImportQr[]
  ignorees: number
  erreurs: number
}

/** Corps de POST /coproprietes/import. */
export interface SaisieImportQr {
  cabinetId: string
  operationId: string
  lignes: LigneImportQr[]
  confirmerHorsDomaine: boolean
}

/**
 * Copropriété créée par un import, telle que la base l'a enregistrée (relue par la fonction SQL) : les affiches et
 * l'export en sont faits, jamais des saisies de l'écran (relecture 1).
 */
export interface CoproprieteCreeeImportQr {
  numeroLigne: number
  id: string
  jeton: string
  nom: string
  adresse: string
  codePostal: string
  ville: string
}

/** Réponse de « creer ». */
export interface ResultatImportQr {
  creees: CoproprieteCreeeImportQr[]
  completees: Array<{ numeroLigne: number; id: string }>
  ignorees: number
  /** Même operationId, même cabinet et même lot déjà traités : le résultat du premier passage. */
  rejeu: boolean
}

/** Feuille d'un classeur .xlsx (masquée : jamais choisie d'office). */
export interface FeuilleClasseurQr {
  nom: string
  visible: boolean
}

/** Refus de lecture d'un fichier (aucun texte de la bibliothèque n'est montré). */
export type CodeLectureImportQr = 'trop_gros' | 'format_ancien' | 'illisible' | 'bombe' | 'vide'

/** Fichier lu : cellules en texte, ligne par ligne (index = n° de ligne - 1). */
export type LectureTableurQr =
  | { ok: true; feuilles: FeuilleClasseurQr[]; feuille: string | null; lignes: string[][]; avertissements: string[]; tronque: boolean }
  | { ok: false; code: CodeLectureImportQr }

/** Copropriété créée par l'import, pour l'export CSV et les affiches. */
export interface LigneExportCoproprieteQr {
  nom: string
  adresse: string
  codePostal: string
  ville: string
  gestionnaires: string[]
  jeton: string
  /** Chemin du cabinet client (vitfix.io/<identifiant>/signalement/…) ; null : ancien chemin. */
  identifiantCabinet: string | null
}
