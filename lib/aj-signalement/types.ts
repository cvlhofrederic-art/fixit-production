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
}

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

/** Ce qu'une copropriété ou une fiche porte de son cabinet. */
export interface CabinetResumeQr {
  id: string
  nom: string
  /** Chemin public : /<identifiant>/signalement/<jeton>/. */
  identifiant: string
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
}

/** D'où vient une attribution (CHECK de signalements_qr_attributions.origine). */
export const ORIGINES_ATTRIBUTION_QR = ['super_admin', 'creation', 'import', 'reattribution'] as const
export type OrigineAttributionQr = (typeof ORIGINES_ATTRIBUTION_QR)[number]

/** Auteur d'une ligne du journal (CHECK de signalements_qr_journal.acteur_profil). */
export const PROFILS_ACTEUR_QR = ['super_admin', 'gestionnaire', 'systeme'] as const
export type ProfilActeurQr = (typeof PROFILS_ACTEUR_QR)[number]

/**
 * Actions du journal (CHECK signalements_qr_journal_action_valeurs) : liste fermée posée une seule fois, actions de la
 * PR 2 comprises (accès des gestionnaires).
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
  'hors_domaine',
] as const
export type ErreurMetierSqlQr = (typeof ERREURS_METIER_SQL_QR)[number]

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

/** Ligne de signalements_qr_emails_gestionnaires : exclu = false → destinataire ; exclu = true → à retirer des saisies. */
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

/** Messages déjà comptés sur la dernière heure, et messages de ce dépôt (budget d'e-mails, RG-06 ter). */
export interface ConsommationEmailsQr {
  sommeCopropriete: number
  sommeCabinet: number
  nombre: number
}

export type DecisionBudgetEmailsQr = { accorde: true } | { accorde: false; limite: 'copropriete' | 'cabinet' }

/** Objet d'un envoi à un gestionnaire (CHECK de signalements_qr_invitations.objet) ; 'acces' : PR 2. */
export const OBJETS_ENVOI_QR = ['confirmation_adresse', 'acces'] as const
export type ObjetEnvoiQr = (typeof OBJETS_ENVOI_QR)[number]

/** Refus d'un envoi (CHECK de signalements_qr_invitations.refus) ; 'compte_autre_espace' : PR 2. */
export const REFUS_ENVOI_QR = ['compte_autre_espace', 'pas_moi'] as const
export type RefusEnvoiQr = (typeof REFUS_ENVOI_QR)[number]

/** Ce que l'état d'une fiche lit de la fiche elle-même. */
export interface FicheEtatGestionnaireQr {
  actif: boolean
  adresseConfirmeeLe: string | null
  adresseContesteeLe: string | null
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

/** États d'une fiche calculés en PR 1 (les 4 autres d'ETATS_GESTIONNAIRE_QR viennent avec la PR 2). */
export type EtatGestionnairePr1Qr = Extract<
  EtatGestionnaireQr,
  'confirmation_envoyee' | 'confirmation_expiree' | 'adresse_confirmee' | 'adresse_contestee' | 'desactive'
>

// ── Routes du lot 3 (contrôle d'accès, réponses, envois) ────────────────────────────────────────────────────────

/**
 * Profil d'un appel authentifié, rendu par controlerAccesQr (lib/aj-signalement/serveur.ts) après isSuperAdmin. En
 * PR 1, le super admin seul ; la PR 2 ajoutera { type: 'gestionnaire'; userId; gestionnaireId; cabinetId } et
 * { type: 'acces_retire' } (fiche relue en base par user_id, jamais app_metadata).
 */
export type ProfilQr = { type: 'super_admin'; userId: string }
export type TypeProfilQr = ProfilQr['type']

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
