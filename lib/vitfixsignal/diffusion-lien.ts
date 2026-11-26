// ── Vitfix Signal — diffusion : liens de désinscription signés, non stockés (PR 3, lot 4) ─────────────────────────
//
// Cahier PR 3 § 8.1 ; décision H5 de Hugo (recommandation du § 11 appliquée le 11/11/2026) : lien valable un an ;
// « Recevoir à nouveau » seulement avec le lien qui a servi à l'opposition, dans les 24 h (contrôlé en SQL,
// signalements_qr_diffusion_lever) ; l'en-tête un clic honoré même après un an (route D-P5).
//
// Deux liens par message, même forme `<id du destinataire, 32 hex>.<HMAC-SHA-256, 64 hex>`, signés pour deux usages :
//   - PAGE   (« vitfixsignal-diffusion-page ») : bouton du corps de l'e-mail, jeton dans le FRAGMENT de
//     https://vitfix.io/<identifiant>/desinscription/#<jeton> (absent des journaux du serveur, de Cloudflare et du
//     Referer). Il permet de s'opposer, puis de « Recevoir à nouveau » ;
//   - UN CLIC (« vitfixsignal-diffusion-un-clic ») : en-tête List-Unsubscribe (RFC 8058), jeton dans le CHEMIN de
//     https://vitfix.io/api/vitfixsignal/desinscription/un-clic/<jeton>. Cette adresse est appelée en clair : elle
//     reste dans les journaux du Worker et transite par le service d'e-mail. Elle ne permet donc QUE de s'opposer.
// Un jeton d'un usage ne vaut rien pour l'autre (l'usage fait partie du message signé).
//
// Clé : HMAC-SHA-256 dérivée par HKDF-SHA-256 (sel « vitfix », info « vitfixsignal-desinscription-v1 ») du secret
// DÉDIÉ VITFIXSIGNAL_CLE_LIENS_DIFFUSION (wrangler secret put ; 32 caractères au moins), sur le modèle de
// lib/equipe/lien-invitation.ts. Rotation : l'ancienne valeur passe dans VITFIXSIGNAL_CLE_LIENS_DIFFUSION_PRECEDENTE
// (facultatif) ; un lien signé par elle est « expiré » (repli par la saisie de l'adresse), aucune autre signature n'est
// acceptée. Secret absent : configuration_incomplete (aucune diffusion ne peut partir, aucun lien n'a pu être émis).
// Les deux secrets sont lus par lib/vitfixsignal/variables.ts (seul endroit de lecture).
//
// Transition (décision du 26/11/2026, lib/vitfixsignal/ancien-nom.ts, bloc C) : les liens des messages envoyés avant le
// renommage du produit ont été signés sous un autre contexte HKDF et d'autres usages. La SIGNATURE n'utilise que le
// contexte et les usages actuels ; la VÉRIFICATION accepte aussi ceux d'avant, par la même clé (courante, puis
// précédente), sans jamais croiser un contexte avec les usages de l'autre.
//
// Rien n'est stocké : le lien se recalcule à l'identique (un lot renvoyé produit le même message). L'identifiant du
// destinataire est tiré au hasard par la base (122 bits) ; le lien ne contient ni adresse, ni identifiant de
// signalement ou de copropriété. Une fuite de la base ne donne aucun lien utilisable : toute action publique exige
// une signature valable. Vérification par crypto.subtle.verify (comparaison à temps constant).
//
// Module sans dépendance serveur (Web Crypto seulement) : routes de diffusion, routes publiques de désinscription,
// tests. Il ne lit la base nulle part : etatLienDiffusionQr reçoit la ligne de signalements_qr_diffusion_lien.

import { ANCIENNE_INFO_HKDF_LIENS_QR, ANCIENS_USAGES_SIGNES_QR } from '@/lib/vitfixsignal/ancien-nom'
import { FORMAT_IDENTIFIANT_CABINET_QR } from '@/lib/vitfixsignal/chemin-cabinet'
import { lireVariableQr, type EnvVitfixSignalQr } from '@/lib/vitfixsignal/variables'

/** Les deux usages d'un lien (cahier § 8.1). */
export type UsageLienDiffusionQr = 'page' | 'un_clic'

/** Jeton d'un lien : identifiant du destinataire (32 hex, UUID sans tirets) et signature (64 hex). */
export const FORMAT_JETON_DIFFUSION_QR = /^[a-f0-9]{32}\.[a-f0-9]{64}$/

/** Durée de validité du lien de la page, depuis la création de la diffusion (H5). */
export const VALIDITE_LIEN_DIFFUSION_JOURS = 365

/** Longueur minimale du secret : en dessous, il est traité comme absent (une clé courte se devine hors ligne). */
export const LONGUEUR_MIN_CLE_LIENS_DIFFUSION_QR = 32

/** Origine des liens (cahier § 5.1, § 5.2) : fixe, pour qu'un lot rejoué produise exactement le même message. */
export const ORIGINE_LIENS_DIFFUSION_QR = 'https://vitfix.io'

/** Environnement lu (process.env par défaut ; un objet dans les tests). */
export type EnvLiensDiffusionQr = EnvVitfixSignalQr

/** Forme d'un lien signé : le contexte (info HKDF) de sa clé et le nom signé de chaque usage. */
interface FormeLienSigne {
  info: string
  usages: Readonly<Record<UsageLienDiffusionQr, string>>
}

/** Forme actuelle : la seule qui SIGNE. */
const FORME_ACTUELLE: FormeLienSigne = {
  info: 'vitfixsignal-desinscription-v1',
  usages: { page: 'vitfixsignal-diffusion-page', un_clic: 'vitfixsignal-diffusion-un-clic' },
}

/** Formes VÉRIFIÉES, dans l'ordre : l'actuelle, puis celle des messages envoyés avant le renommage (transition, bloc C). */
const FORMES_VERIFIEES: readonly FormeLienSigne[] = [
  FORME_ACTUELLE,
  { info: ANCIENNE_INFO_HKDF_LIENS_QR, usages: ANCIENS_USAGES_SIGNES_QR },
]

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const JOUR_MS = 24 * 60 * 60 * 1000
const encodeur = new TextEncoder()

// ── Clés ──

/** Secret utilisable (rogné, 32 caractères au moins), sinon null. */
function secretDe(valeur: string | undefined): string | null {
  const secret = (valeur ?? '').trim()
  return secret.length >= LONGUEUR_MIN_CLE_LIENS_DIFFUSION_QR ? secret : null
}

// Clés dérivées, par contexte et par secret (la clé courante et la précédente, sous les deux formes vérifiées ; une
// rotation en ajoute deux). Une dérivation échouée n'est pas gardée.
const clesEnCache = new Map<string, Promise<CryptoKey>>()
const TAILLE_MAX_CACHE = 8

function cleHmac(secret: string, info: string): Promise<CryptoKey> {
  // Le contexte ne contient jamais de saut de ligne : la clé du cache est sans ambiguïté.
  const entree = `${info}\n${secret}`
  const enCache = clesEnCache.get(entree)
  if (enCache) return enCache
  if (clesEnCache.size >= TAILLE_MAX_CACHE) clesEnCache.clear()
  const cle = crypto.subtle
    .importKey('raw', encodeur.encode(secret), 'HKDF', false, ['deriveKey'])
    .then((base) => crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: encodeur.encode('vitfix'), info: encodeur.encode(info) },
      base,
      { name: 'HMAC', hash: 'SHA-256', length: 256 },
      false,
      ['sign', 'verify'],
    ))
  cle.catch(() => clesEnCache.delete(entree))
  clesEnCache.set(entree, cle)
  return cle
}

/** Clé courante (rognée, 32 caractères au moins), sinon null. */
const cleCourante = (env: EnvLiensDiffusionQr) => secretDe(lireVariableQr('VITFIXSIGNAL_CLE_LIENS_DIFFUSION', env))

/** Clé précédente, pendant une rotation (facultative), sinon null. */
const clePrecedente = (env: EnvLiensDiffusionQr) => secretDe(lireVariableQr('VITFIXSIGNAL_CLE_LIENS_DIFFUSION_PRECEDENTE', env))

/** La clé de signature est-elle configurée (D-R3, D-R4, D-C1 : 503 configuration_incomplete sinon) ? */
export function cleLiensDiffusionConfigureeQr(env: EnvLiensDiffusionQr = process.env): boolean {
  return cleCourante(env) !== null
}

// ── Signature ──

/** Message signé : tableau JSON, sans ambiguïté (cahier § 8.1). */
const message = (forme: FormeLienSigne, usage: UsageLienDiffusionQr, destinataireId: string) =>
  encodeur.encode(JSON.stringify(['v1', forme.usages[usage], destinataireId]))

const enHex = (octets: ArrayBuffer) => Array.from(new Uint8Array(octets), (o) => o.toString(16).padStart(2, '0')).join('')

function depuisHex(hex: string) {
  const octets = new Uint8Array(hex.length / 2)
  for (let i = 0; i < octets.length; i++) octets[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return octets
}

/** « 3f2b8c1d4e5a… » (32 hex) → « 3f2b8c1d-4e5a-… » (UUID, forme de la base). */
const uuidDepuisHex = (hex: string) => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`

export type SignatureLiensDiffusionQr =
  | { ok: true; page: string; unClic: string }
  | { ok: false; code: 'configuration_incomplete' | 'identifiant_invalide' }

/**
 * Jetons des deux liens d'un destinataire (identifiant de signalements_qr_diffusion_destinataires). Même entrée, même
 * clé → mêmes jetons. Clé absente → configuration_incomplete ; identifiant hors format UUID → identifiant_invalide
 * (aucune exception pour ces deux cas ; seule une panne de Web Crypto rejetterait la promesse).
 */
export async function signerLiensDiffusionQr(destinataireId: string, env: EnvLiensDiffusionQr = process.env): Promise<SignatureLiensDiffusionQr> {
  const secret = cleCourante(env)
  if (!secret) return { ok: false, code: 'configuration_incomplete' }
  const id = destinataireId.toLowerCase()
  if (!FORMAT_UUID.test(id)) return { ok: false, code: 'identifiant_invalide' }
  const cle = await cleHmac(secret, FORME_ACTUELLE.info)
  const hex = id.replaceAll('-', '')
  const [page, unClic] = await Promise.all([
    crypto.subtle.sign('HMAC', cle, message(FORME_ACTUELLE, 'page', id)),
    crypto.subtle.sign('HMAC', cle, message(FORME_ACTUELLE, 'un_clic', id)),
  ])
  return { ok: true, page: `${hex}.${enHex(page)}`, unClic: `${hex}.${enHex(unClic)}` }
}

// ── Vérification ──

/** Jeton dont la signature est bonne : identifiant (UUID), usage, clé qui l'a signé. */
export interface JetonSigneDiffusionQr {
  statut: 'signe'
  destinataireId: string
  usage: UsageLienDiffusionQr
  cle: 'courante' | 'precedente'
}

export type VerificationJetonDiffusionQr = JetonSigneDiffusionQr | { statut: 'inconnu' } | { statut: 'configuration_incomplete' }

/**
 * Vérifie la signature d'un jeton pour les usages acceptés, dans cet ordre : sous la clé courante, puis sous la clé
 * précédente (cahier § 8.1) ; pour chaque clé, sous la forme actuelle puis sous celle d'avant le renommage (transition,
 * FORMES_VERIFIEES). Aucune ne vérifie, ou format faux → inconnu, quel que soit l'identifiant. Clé courante absente →
 * configuration_incomplete (D-P5 : 503 ; pages publiques : « inconnu »). Ne lit pas la base.
 */
export async function verifierJetonDiffusionQr(
  jeton: string,
  usages: readonly UsageLienDiffusionQr[],
  env: EnvLiensDiffusionQr = process.env,
): Promise<VerificationJetonDiffusionQr> {
  const courante = cleCourante(env)
  if (!courante) return { statut: 'configuration_incomplete' }
  if (!FORMAT_JETON_DIFFUSION_QR.test(jeton)) return { statut: 'inconnu' }
  const destinataireId = uuidDepuisHex(jeton.slice(0, 32))
  const signature = depuisHex(jeton.slice(33))
  const precedente = clePrecedente(env)
  const cles: Array<[JetonSigneDiffusionQr['cle'], string]> = [['courante', courante]]
  if (precedente) cles.push(['precedente', precedente])
  for (const [nom, secret] of cles) {
    for (const forme of FORMES_VERIFIEES) {
      const cle = await cleHmac(secret, forme.info)
      for (const usage of usages) {
        if (await crypto.subtle.verify('HMAC', cle, signature, message(forme, usage, destinataireId))) {
          return { statut: 'signe', destinataireId, usage, cle: nom }
        }
      }
    }
  }
  return { statut: 'inconnu' }
}

// ── État du lien (après lecture de signalements_qr_diffusion_lien) ──

/** Colonnes de signalements_qr_diffusion_lien utiles à l'état du lien. */
export interface LigneLienDiffusionQr {
  cabinet_identifiant: string
  diffusion_cree_le: string
}

/** États de la page publique (D-P1) : valide, expire (repli par l'adresse), ancien (contact du cabinet), inconnu. */
export type EtatLienDiffusionQr = 'valide' | 'expire' | 'ancien' | 'inconnu'

/**
 * État d'un lien, dans cet ordre (cahier § 8.1) :
 *   1. signature fausse (ou clé absente) → inconnu, MÊME si l'identifiant existe en base : jamais le repli ;
 *   2. signature bonne, identifiant absent de la base (diffusion purgée après 3 ans) → ancien ;
 *   3. cabinet du chemin différent de celui de la diffusion (comparaison exacte) → inconnu ;
 *   4. signée par la clé précédente, ou plus de 365 jours après la diffusion (le jour même compte encore) → expire ;
 *   5. sinon → valide.
 * Le un clic (D-P5) s'oppose même « expiré » (H5) : la route lit la vérification, pas seulement cet état.
 */
export function etatLienDiffusionQr(p: {
  verification: VerificationJetonDiffusionQr
  ligne: LigneLienDiffusionQr | null
  identifiantChemin: string
  maintenant?: Date
}): EtatLienDiffusionQr {
  if (p.verification.statut !== 'signe') return 'inconnu'
  if (!p.ligne) return 'ancien'
  if (p.ligne.cabinet_identifiant !== p.identifiantChemin) return 'inconnu'
  if (p.verification.cle === 'precedente') return 'expire'
  const creeLe = Date.parse(p.ligne.diffusion_cree_le)
  // Date illisible : « expiré », dont le repli permet encore de s'opposer.
  if (Number.isNaN(creeLe)) return 'expire'
  const maintenant = (p.maintenant ?? new Date()).getTime()
  return maintenant - creeLe <= VALIDITE_LIEN_DIFFUSION_JOURS * JOUR_MS ? 'valide' : 'expire'
}

// ── Adresses des liens ──

function exigerJeton(jeton: string): void {
  if (!FORMAT_JETON_DIFFUSION_QR.test(jeton)) throw new TypeError('[diffusion-lien] jeton hors format')
}

/** Identifiant de cabinet au format de la base (CHECK signalements_qr_cabinets_identifiant_format). */
export function identifiantCabinetLienValideQr(identifiant: string): boolean {
  return identifiant.length >= 3 && identifiant.length <= 40 && FORMAT_IDENTIFIANT_CABINET_QR.test(identifiant)
}

/**
 * Bouton du corps de l'e-mail : https://vitfix.io/<identifiant>/desinscription/#<jeton de page> (jeton dans le
 * fragment seulement). Lève (TypeError) si l'identifiant ou le jeton sont hors format : rien d'autre n'entre dans
 * l'adresse.
 */
export function urlPageDesinscriptionQr(identifiant: string, jetonPage: string): string {
  if (!identifiantCabinetLienValideQr(identifiant)) throw new TypeError('[diffusion-lien] identifiant de cabinet hors format')
  exigerJeton(jetonPage)
  return `${ORIGINE_LIENS_DIFFUSION_QR}/${identifiant}/desinscription/#${jetonPage}`
}

/**
 * En-tête List-Unsubscribe (RFC 8058) : https://vitfix.io/api/vitfixsignal/desinscription/un-clic/<jeton un clic>.
 * Alphabet sûr pour un en-tête (lettres, chiffres, « : / . _ - ») ; lève (TypeError) si le jeton est hors format.
 */
export function urlUnClicDesinscriptionQr(jetonUnClic: string): string {
  exigerJeton(jetonUnClic)
  return `${ORIGINE_LIENS_DIFFUSION_QR}/api/vitfixsignal/desinscription/un-clic/${jetonUnClic}`
}
