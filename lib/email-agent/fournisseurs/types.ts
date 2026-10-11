/**
 * Fournisseurs de boîte e-mail de l'agent Alfredo (Syndic v54) — contrat commun.
 *
 * Une boîte par cabinet (table syndic_oauth_tokens, UNIQUE syndic_id, colonne provider).
 * Chaque fournisseur sait : construire l'adresse d'autorisation OAuth, échanger le code,
 * rafraîchir le jeton et relever les derniers e-mails de la boîte de réception sous une
 * forme normalisée. Lecture seule : rien n'est jamais envoyé depuis la boîte.
 * Sans dépendance : fetch uniquement (le Worker Cloudflare est proche de sa taille maximale).
 */

export type IdFournisseur = 'gmail' | 'microsoft'

/** Jetons renvoyés par un échange de code ou un rafraîchissement. */
export interface JetonsFournisseur {
  accessToken: string
  /**
   * Jeton de rafraîchissement à ranger. Microsoft en renvoie un NOUVEAU à chaque
   * rafraîchissement (rotation) ; Google n'en renvoie pas au rafraîchissement : null =
   * garder celui déjà en base.
   */
  refreshToken: string | null
  /** Expiration du jeton d'accès (ISO 8601). */
  expiresAt: string
  /** Adresse de la boîte (profil du compte) — renseignée à l'échange du code seulement. */
  email: string | null
  scope: string
}

/** E-mail relevé, indépendant du fournisseur (corps texte tronqué à ~1000 caractères). */
export interface MessageNormalise {
  /** Identifiant du message chez le fournisseur (rangé dans syndic_emails_analysed.gmail_message_id). */
  id: string
  /** Fil de discussion (Gmail threadId, Microsoft conversationId). */
  threadId: string | null
  /** Expéditeur au format d'en-tête « Nom <adresse> » ou « adresse ». */
  from: string
  subject: string
  bodyText: string
  /** Réception (ISO 8601). */
  receivedAt: string
}

export interface OptionsReleve {
  /** Première relève : 30 derniers jours ; relèves suivantes : 7 derniers jours (20 e-mails au plus). */
  premiereReleve: boolean
}

export interface FournisseurBoite {
  id: IdFournisseur
  /** Nom affiché (« Gmail / Google Workspace », « Outlook / Microsoft 365 »). */
  nom: string
  /** Secrets ou variables absents côté serveur (vide = configuré). */
  configurationManquante(): string[]
  /** Adresse de la page de consentement du fournisseur (state = « <id utilisateur>:<nonce> »). */
  urlAutorisation(state: string): string
  echangerCode(code: string): Promise<JetonsFournisseur>
  rafraichir(refreshToken: string): Promise<JetonsFournisseur>
  /** E-mails de la boîte de réception, lus ou non, du plus récent au plus ancien. */
  recupererMessages(accessToken: string, options: OptionsReleve): Promise<MessageNormalise[]>
}

/**
 * Erreur d'un fournisseur, avec un code court (sans détail interne) destiné à l'URL de
 * retour (?email_error=<code>) ou au résultat de relève ; le détail part dans les journaux.
 */
export class ErreurFournisseur extends Error {
  readonly code: string
  readonly details: Record<string, unknown>

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ErreurFournisseur'
    this.code = code
    this.details = details
  }
}

/** Nombre maximal d'e-mails relevés par passage, et fenêtres de relève (jours). */
export const MAX_MESSAGES_RELEVE = 20
export const JOURS_PREMIERE_RELEVE = 30
export const JOURS_RELEVE_REGULIERE = 7
/** Longueur conservée du corps texte d'un e-mail (aperçu analysé par Alfredo). */
export const LONGUEUR_CORPS = 1000

/** Début de la fenêtre de relève. */
export function debutFenetreReleve(premiereReleve: boolean, maintenant = Date.now()): Date {
  const jours = premiereReleve ? JOURS_PREMIERE_RELEVE : JOURS_RELEVE_REGULIERE
  return new Date(maintenant - jours * 86_400_000)
}

/** Adresse publique de l'application (redirections OAuth), sans barre finale. */
export function urlApplication(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
}

/** Expiration ISO à partir d'un expires_in (secondes), 1 h par défaut. */
export function expirationDepuis(expiresIn: unknown, maintenant = Date.now()): string {
  const secondes = typeof expiresIn === 'number' && expiresIn > 0
    ? expiresIn
    : Number.parseInt(String(expiresIn ?? ''), 10) || 3600
  return new Date(maintenant + secondes * 1000).toISOString()
}
