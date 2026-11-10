// ── AJ Signalement : signalements déposés par QR code ─────────────────────────
//
// Application publique « AJ Signalement » : chaque copropriété a un QR code unique qui ouvre
// /fr/signalement/<jeton>/ ; la personne qui le scanne décrit le problème (même parcours que
// « Signaler un problème » du portail copropriétaire) et laisse ses coordonnées, toutes
// obligatoires (bâtiment et qualité compris depuis le 06/11/2026). Le signalement est conservé (tables
// signalements_qr_*, migrations 20261104 et 20261106) et envoyé par e-mail aux destinataires de la
// copropriété. Aucun lien avec le logiciel Syndic : ces types ne connaissent ni cabinet, ni immeuble, ni
// fiche de copropriétaire.

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

/** Ancre du tableau de bord dans le portail copropriétaire (vue super admin). */
export const ANCRE_TABLEAU_QR = 'signalementsQr'
export const CHEMIN_TABLEAU_QR = `/fr/coproprietaire/dashboard/#${ANCRE_TABLEAU_QR}`
