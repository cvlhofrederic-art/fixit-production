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

/** Copropriété dotée d'un QR code, telle que le tableau de bord la voit. */
export interface CoproprieteQr {
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
}

/** Copropriété saisie ou modifiée depuis le tableau de bord. */
export interface SaisieCoproprieteQr {
  nom: string
  adresse: string
  emailsDestinataires: string[]
}

/** Adresse publique du QR code (toujours sous /fr/ : la page est en français, la langue de l'administrateur). */
export function urlSignalementQr(jeton: string, origine = 'https://vitfix.io'): string {
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
