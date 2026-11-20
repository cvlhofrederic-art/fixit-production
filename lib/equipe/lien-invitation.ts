// lib/equipe/lien-invitation.ts
//
// Lien d'invitation d'équipe (pro BTP : pro_team_members, syndic : syndic_team_members, AJ Signalement :
// signalements_qr_invitations, envois aux gestionnaires d'un cabinet client — confirmation d'adresse en PR 1).
// L'espace fait partie du message signé : un lien d'un espace ne vaut rien dans un autre.
//
// Le jeton du lien est `<jeton de la ligne>.<signature>`. La signature (HMAC-SHA256, calculée côté
// serveur) couvre la ligne d'invitation : id, équipe, e-mail invité, jeton de la ligne et rôle donné. Le lien
// n'est remis qu'à la boîte mail invitée. Le jeton de la ligne n'est donc pas un secret : il sert à retrouver
// l'invitation et à l'invalider une fois acceptée. Seule la signature permet d'accepter, et modifier la
// ligne après l'envoi (e-mail, jeton, équipe, rôle) rend le lien invalide.
//
// Format du message signé : v2 depuis la mise en ligne de ce changement (R36, décision VF-A-02 du 15/11/2026 : le
// rôle entre dans la signature). Les liens v1 (sans le rôle), envoyés avant, restent acceptés le temps que leurs
// invitations expirent : chacune expire 7 jours après sa création (lireInvitationValide), et FIN_FORMAT_V1 borne ce
// délai quoi qu'il arrive. Un lien v2 ne se vérifie jamais comme un v1 (messages différents). Après FIN_FORMAT_V1,
// retirer messageV1 et ses tests. Revenir au code d'avant le v2 rendrait invalides les liens v2 déjà envoyés.
//
// Clé : dérivée (HKDF-SHA256) de SUPABASE_SERVICE_ROLE_KEY, secret serveur déjà présent dans le Worker.
// Aucun nouveau secret. Changer cette clé invalide les invitations en attente (7 jours au plus). L'info
// « invitation-equipe-v1 » de la dérivation est la version de la clé, commune aux deux formats de message.

import { randomHex } from '@/lib/crypto-compat'

export type EspaceEquipe = 'pro' | 'syndic' | 'aj_signalement'

/** Rôle des gestionnaires d'AJ Signalement (posé par le serveur seul, PR 2) ; égalité stricte. */
const ROLE_GESTIONNAIRE_SIGNALEMENT = 'gestionnaire_signalement'

/** Ligne d'invitation telle qu'enregistrée en base. */
export interface InvitationSignee {
  id: string
  email: string
  invite_token: string
  /** company_id (pro) ou cabinet_id (syndic). */
  equipe_id: string
  /**
   * Rôle donné par l'invitation (colonne role de la ligne), signé avec elle. AJ Signalement : non lu, le seul rôle
   * de sa table est signé (ROLE_GESTIONNAIRE_SIGNALEMENT).
   */
  role?: string | null
}

/** Premier instant où un lien signé au format v1 (rôle non signé) est refusé. Voir l'en-tête. */
export const FIN_FORMAT_V1 = Date.parse('2027-01-01T00:00:00Z')

const FORMAT_JETON = /^([a-f0-9]{48})\.([a-f0-9]{64})$/
const VALEUR_DE_BUILD = 'placeholder-key-for-build'
const encodeur = new TextEncoder()

let cleEnCache: { secret: string; cle: Promise<CryptoKey> } | null = null

function cleHmac(): Promise<CryptoKey> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || secret === VALEUR_DE_BUILD) {
    return Promise.reject(new Error('[lien-invitation] SUPABASE_SERVICE_ROLE_KEY absente : signature impossible'))
  }
  if (cleEnCache?.secret !== secret) {
    const cle = crypto.subtle
      .importKey('raw', encodeur.encode(secret), 'HKDF', false, ['deriveKey'])
      .then((base) => crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: encodeur.encode('vitfix'), info: encodeur.encode('invitation-equipe-v1') },
        base,
        { name: 'HMAC', hash: 'SHA-256', length: 256 },
        false,
        ['sign', 'verify'],
      ))
    cleEnCache = { secret, cle }
  }
  return cleEnCache.cle
}

/** Rôle signé : celui de la ligne d'invitation ; AJ Signalement n'en admet qu'un, imposé par sa table (CHECK). */
function roleSigne(espace: EspaceEquipe, inv: InvitationSignee): string | null {
  return espace === 'aj_signalement' ? ROLE_GESTIONNAIRE_SIGNALEMENT : (inv.role ?? null)
}

/** Message signé (v2) : tableau JSON, sans ambiguïté quel que soit le contenu des champs. */
function message(espace: EspaceEquipe, inv: InvitationSignee) {
  return encodeur.encode(JSON.stringify(['v2', espace, inv.id, inv.equipe_id, inv.email, inv.invite_token, roleSigne(espace, inv)]))
}

/** Message des liens envoyés avant le format v2 (sans le rôle) : vérifié seulement avant FIN_FORMAT_V1. */
function messageV1(espace: EspaceEquipe, inv: InvitationSignee) {
  return encodeur.encode(JSON.stringify(['v1', espace, inv.id, inv.equipe_id, inv.email, inv.invite_token]))
}

const enHex = (octets: ArrayBuffer) => Array.from(new Uint8Array(octets), (o) => o.toString(16).padStart(2, '0')).join('')

function depuisHex(hex: string) {
  const octets = new Uint8Array(hex.length / 2)
  for (let i = 0; i < octets.length; i++) octets[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return octets
}

/** Jeton à placer dans le lien envoyé par e-mail : `<jeton de la ligne>.<signature>`. */
export async function jetonDuLien(espace: EspaceEquipe, invitation: InvitationSignee): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await cleHmac(), message(espace, invitation))
  return `${invitation.invite_token}.${enHex(signature)}`
}

/**
 * Identifiants d'une nouvelle invitation, à insérer tels quels (id, invite_token), et jeton signé du lien.
 * `role` (pro, syndic) : le rôle inséré dans la ligne, signé avec elle ; un lien signé sans lui ne correspondrait
 * pas à la ligne et ne s'accepterait pas. AJ Signalement : sans objet (rôle unique de sa table).
 * Échoue sans clé de signature : à appeler avant toute écriture.
 */
export async function nouvelleInvitation(
  espace: EspaceEquipe,
  email: string,
  equipeId: string,
  role?: string | null,
): Promise<{ id: string; invite_token: string; jetonLien: string }> {
  const invitation: InvitationSignee = {
    id: crypto.randomUUID(), email, invite_token: randomHex(24), equipe_id: equipeId, role: role ?? null,
  }
  return { id: invitation.id, invite_token: invitation.invite_token, jetonLien: await jetonDuLien(espace, invitation) }
}

/** Découpe le jeton reçu dans l'URL ; null si son format n'est pas celui d'un lien signé. */
export function lireJetonDuLien(jeton: string): { jeton: string; signature: string } | null {
  const m = FORMAT_JETON.exec(jeton)
  return m ? { jeton: m[1], signature: m[2] } : null
}

/**
 * Vrai si la signature du lien correspond à la ligne d'invitation lue en base (comparaison à temps constant) :
 * format v2 (rôle compris) ou, avant FIN_FORMAT_V1, format v1. `maintenant` : l'horloge, réglable par les tests.
 */
export async function signatureValide(
  espace: EspaceEquipe,
  signature: string,
  invitation: InvitationSignee,
  maintenant: number = Date.now(),
): Promise<boolean> {
  const cle = await cleHmac()
  if (!/^[a-f0-9]{64}$/.test(signature)) return false
  const octets = depuisHex(signature)
  if (await crypto.subtle.verify('HMAC', cle, octets, message(espace, invitation))) return true
  if (maintenant >= FIN_FORMAT_V1) return false
  return crypto.subtle.verify('HMAC', cle, octets, messageV1(espace, invitation))
}

/**
 * Un compte existant n'est rattaché à une équipe que s'il n'appartient à aucun autre espace : sans rôle,
 * ou déjà compte membre du même espace (sous-compte pro non gérant, rôle syndic_*). Les comptes titulaires
 * (gérant de société, cabinet syndic) et ceux des autres espaces (artisan, client, admin…) ne sont jamais
 * convertis.
 */
export function compteRattachable(espace: EspaceEquipe, appMetadata: Record<string, unknown> | undefined): boolean {
  const role = typeof appMetadata?.role === 'string' ? appMetadata.role : ''
  // AJ Signalement : AVANT le test « sans rôle » ; seul un compte qui porte déjà le rôle des gestionnaires est
  // rattaché, jamais un compte sans rôle ni celui d'un autre espace.
  if (espace === 'aj_signalement') return role === ROLE_GESTIONNAIRE_SIGNALEMENT
  if (!role) return true
  if (espace === 'syndic') return role.startsWith('syndic_')
  const roleEquipe = appMetadata?.pro_team_role
  return role === 'pro_societe' && typeof roleEquipe === 'string' && roleEquipe !== '' && roleEquipe !== 'GERANT'
}

/** Ligne d'équipe sans son jeton d'invitation, pour une réponse d'API. */
export function sansJetonInvitation<T extends Record<string, unknown>>(ligne: T): Omit<T, 'invite_token'> {
  return Object.fromEntries(Object.entries(ligne).filter(([colonne]) => colonne !== 'invite_token')) as Omit<T, 'invite_token'>
}

export const MESSAGE_COMPTE_AUTRE_ESPACE =
  "Cet e-mail est déjà utilisé par un compte VitFix d'un autre espace. Demandez une invitation sur une autre adresse ou contactez le support."
