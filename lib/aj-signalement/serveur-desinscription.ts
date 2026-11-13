// ── AJ Signalement — diffusion : désinscription publique, côté serveur (PR 3, lot 6) ───────────────────────────────
//
// Cahier PR 3 § 4.1 (D-P1 à D-P5b), § 7.5, § 8.1, § 8.2, § 9 ; décision H5 de Hugo (lien d'un an ; « Recevoir à
// nouveau » avec le seul lien qui a servi, dans les 24 h, contrôlé en SQL ; un clic honoré même après un an).
//
// Lecture d'un lien, dans cet ordre (§ 8.1) : signature d'abord, SANS la base (clé courante puis précédente, usages
// acceptés par la route) ; signature fausse ou clé absente → « inconnu », quel que soit l'identifiant ; puis la ligne de
// signalements_qr_diffusion_lien ; puis l'état (etatLienDiffusionQr : ancien, cabinet du chemin, expiré, valable).
// Réponses publiques jamais en cache (private, no-store) ; aucune date (un message transféré ne doit pas dire quand la
// personne s'est opposée) ; l'adresse n'est rendue que masquée, et seulement à la page ouverte par le jeton de PAGE.
// Journal du serveur : opération et code seulement (jamais un jeton, une adresse ni un identifiant de destinataire).

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import {
  etatLienDiffusionQr, verifierJetonDiffusionQr, type UsageLienDiffusionQr,
} from '@/lib/aj-signalement/diffusion-lien'
import {
  TABLE_CABINETS_QR, codeDepuisErreurSqlQr, journaliserRepliDiffusionQr, structureAbsenteQr, type ErreurBase,
} from '@/lib/aj-signalement/serveur'
import type { LangueSignalementQr } from '@/lib/aj-signalement/types'

const CONTEXTE = '[AJ SIGNALEMENT]'

/** Durée minimale de la réponse du repli par l'adresse (D-P4) : adresse juste ou fausse, même durée (§ 8.2). */
export const DUREE_MIN_ADRESSE_DESINSCRIPTION_MS = 400

/** En-tête de cache de toute réponse publique de désinscription (§ 8.2, « Cache »). */
export const CACHE_PRIVE_DESINSCRIPTION_QR = 'private, no-store'

// ── Réponses ──

/** Réponse JSON publique, jamais en cache. */
export function reponseDesinscriptionQr(corps: unknown, status = 200): NextResponse {
  const reponse = NextResponse.json(corps, { status })
  reponse.headers.set('Cache-Control', CACHE_PRIVE_DESINSCRIPTION_QR)
  return reponse
}

/** Erreur publique : un code seul (jamais un détail de la base). */
export const erreurDesinscriptionQr = (code: string, status: number): NextResponse => reponseDesinscriptionQr({ error: code }, status)

/** Corps refusé (400) : noms de champs et règles de Zod seulement. */
export const invalideDesinscriptionQr = (details: string): NextResponse => reponseDesinscriptionQr({ error: 'invalide', details }, 400)

/** Limite atteinte : 429 que la page traduit (le 429 de lib/rate-limit.ts est en anglais). */
export function limiteDesinscriptionQr(): NextResponse {
  const reponse = erreurDesinscriptionQr('limite', 429)
  reponse.headers.set('Retry-After', '60')
  return reponse
}

/** Réponse sans corps (D-P5, messagerie), jamais en cache. */
export function reponseVideDesinscriptionQr(status: number): NextResponse {
  const reponse = new NextResponse(null, { status, headers: { 'Cache-Control': CACHE_PRIVE_DESINSCRIPTION_QR } })
  if (status === 429) reponse.headers.set('Retry-After', '60')
  return reponse
}

/**
 * Erreur de la base après la lecture du lien (opposition, levée) : code public de codeDepuisErreurSqlQr, journalisée
 * par son seul code (500 et plus), jamais en cache.
 */
export function erreurSqlDesinscriptionQr(erreur: ErreurBase | null | undefined, operation: string): NextResponse {
  const { code, status } = codeDepuisErreurSqlQr(erreur)
  if (status >= 500) logger.error(`${CONTEXTE} ${operation} refusée par la base`, { code: erreur?.code })
  return erreurDesinscriptionQr(code, status)
}

/** Clé de signature absente : journalisée une fois par isolat (aucune diffusion n'a pu partir sans elle). */
let cleAbsenteJournalisee = false
export function journaliserCleAbsenteDesinscriptionQr(): void {
  if (cleAbsenteJournalisee) return
  cleAbsenteJournalisee = true
  logger.error(`${CONTEXTE} désinscription : clé de signature des liens absente (AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION)`)
}

/** Tests : chaque cas repart d'un isolat « neuf ». */
export const reinitialiserDesinscriptionQr = (): void => { cleAbsenteJournalisee = false }

/** Attend la fin de la durée minimale comptée depuis `debut` (Date.now()). */
export async function attendreDureeMinimaleQr(debut: number, dureeMs: number): Promise<void> {
  const reste = dureeMs - (Date.now() - debut)
  if (reste > 0) await new Promise<void>((resolve) => { setTimeout(resolve, reste) })
}

// ── Lecture du lien ──

/** Colonnes de signalements_qr_diffusion_lien. */
export interface LigneLienDesinscriptionQr {
  diffusion_id: string
  copropriete_id: string
  copropriete_nom: string | null
  cabinet_nom: string | null
  cabinet_identifiant: string
  langue: string | null
  politique_url: string | null
  contact_email: string | null
  diffusion_cree_le: string
  email: string | null
  oppose: boolean
  levable: boolean
}

const texteOuNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

/** Première ligne rendue par une fonction SQL à RETURNS TABLE (tableau) ; null si absente ou illisible. */
export function ligneLienDesinscriptionQr(data: unknown): LigneLienDesinscriptionQr | null {
  const brut: unknown = Array.isArray(data) ? data[0] : data
  if (typeof brut !== 'object' || brut === null) return null
  const l = brut as Record<string, unknown>
  if (typeof l.cabinet_identifiant !== 'string' || typeof l.diffusion_cree_le !== 'string') return null
  return {
    diffusion_id: String(l.diffusion_id ?? ''),
    copropriete_id: String(l.copropriete_id ?? ''),
    copropriete_nom: texteOuNull(l.copropriete_nom),
    cabinet_nom: texteOuNull(l.cabinet_nom),
    cabinet_identifiant: l.cabinet_identifiant,
    langue: texteOuNull(l.langue),
    politique_url: texteOuNull(l.politique_url),
    contact_email: texteOuNull(l.contact_email),
    diffusion_cree_le: l.diffusion_cree_le,
    email: texteOuNull(l.email),
    oppose: l.oppose === true,
    levable: l.levable === true,
  }
}

export type LienDesinscriptionLuQr =
  | { etat: 'valide' | 'expire'; usage: UsageLienDiffusionQr; destinataireId: string; ligne: LigneLienDesinscriptionQr }
  | { etat: 'ancien'; usage: UsageLienDiffusionQr; destinataireId: string }
  | { etat: 'inconnu' }
  | { etat: 'erreur' }

/** Relecture d'une ligne : trouvée ou absente (null), migration absente, ou erreur de la base. */
export type RelectureLienQr =
  | { statut: 'lue'; ligne: LigneLienDesinscriptionQr | null }
  | { statut: 'migration_absente' }
  | { statut: 'erreur' }

/**
 * Relit la ligne d'un destinataire (signalements_qr_diffusion_lien). Migration absente : journalisée une fois par isolat
 * (aucune diffusion n'a pu partir) ; autre erreur : journalisée par son code seul.
 */
export async function relireLigneLienQr(destinataireId: string): Promise<RelectureLienQr> {
  const { data, error } = await supabaseAdmin.rpc('signalements_qr_diffusion_lien', { p_destinataire: destinataireId })
  if (error) {
    if (structureAbsenteQr(error)) {
      journaliserRepliDiffusionQr('lecture d’un lien de désinscription', error)
      return { statut: 'migration_absente' }
    }
    logger.error(`${CONTEXTE} lecture d’un lien de désinscription refusée par la base`, { code: error.code })
    return { statut: 'erreur' }
  }
  return { statut: 'lue', ligne: ligneLienDesinscriptionQr(data) }
}

/**
 * Lien d'une page publique : signature (sans la base, usages acceptés par la route), puis ligne en base, puis état.
 * Clé absente ou signature fausse → inconnu, sans aucune lecture ; migration absente → inconnu (aucune diffusion n'a pu
 * partir, aucun lien à honorer, § 9) ; erreur de la base → erreur.
 */
export async function lireLienDesinscriptionQr(
  jeton: string,
  identifiantChemin: string,
  usages: readonly UsageLienDiffusionQr[],
  maintenant: Date = new Date(),
): Promise<LienDesinscriptionLuQr> {
  const verification = await verifierJetonDiffusionQr(jeton, usages)
  if (verification.statut === 'configuration_incomplete') {
    journaliserCleAbsenteDesinscriptionQr()
    return { etat: 'inconnu' }
  }
  if (verification.statut !== 'signe') return { etat: 'inconnu' }
  const relecture = await relireLigneLienQr(verification.destinataireId)
  if (relecture.statut === 'erreur') return { etat: 'erreur' }
  if (relecture.statut === 'migration_absente') return { etat: 'inconnu' }
  const { ligne } = relecture
  const etat = etatLienDiffusionQr({ verification, ligne, identifiantChemin, maintenant })
  const { destinataireId, usage } = verification
  if (etat === 'inconnu') return { etat: 'inconnu' }
  if (etat === 'ancien' || !ligne) return { etat: 'ancien', usage, destinataireId }
  return { etat, usage, destinataireId, ligne }
}

// ── Cabinet du chemin ──

/** Cabinet de l'adresse de la page (pages « ancien » et « non valable », langue par défaut). */
export interface CabinetDesinscriptionQr {
  nom: string | null
  langue: LangueSignalementQr
  contact: string | null
  politiqueUrl: string | null
}

/** Politique recopiée dans un href : https et alphabet sûr seulement (même langage que le CHECK de la base). */
const FORMAT_POLITIQUE = /^https:\/\/[A-Za-z0-9._~:/?#@!$&()*+,;=%-]{4,500}$/
export const politiqueSureQr = (url: string | null | undefined): string | null => (url && FORMAT_POLITIQUE.test(url) ? url : null)

/** Contact du cabinet affiché : même langage que le CHECK signalements_qr_cabinets_diffusion_contact_format. */
const FORMAT_CONTACT = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/
export const contactSurQr = (email: string | null | undefined): string | null => (email && FORMAT_CONTACT.test(email) ? email : null)

export const langueDesinscriptionQr = (langue: unknown): LangueSignalementQr => (langue === 'pt' ? 'pt' : 'fr')

/**
 * Le cabinet du chemin (nom, langue, contact et politique de diffusion), ou null : inconnu, migration absente
 * (journalisé une fois), erreur (journalisée par son code). Jamais une exception : la page reste servie.
 */
export async function lireCabinetDesinscriptionQr(identifiant: string): Promise<CabinetDesinscriptionQr | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLE_CABINETS_QR)
    .select('nom, identifiant, langue, diffusion_contact_email, diffusion_politique_url')
    .eq('identifiant', identifiant)
    .maybeSingle()
  if (error) {
    if (structureAbsenteQr(error)) journaliserRepliDiffusionQr('lecture du cabinet de la désinscription', error)
    else logger.error(`${CONTEXTE} lecture du cabinet de la désinscription refusée par la base`, { code: error.code })
    return null
  }
  const ligne = data as Record<string, unknown> | null
  if (!ligne || ligne.identifiant !== identifiant) return null
  return {
    nom: texteOuNull(ligne.nom),
    langue: langueDesinscriptionQr(ligne.langue),
    contact: contactSurQr(texteOuNull(ligne.diffusion_contact_email)),
    politiqueUrl: politiqueSureQr(texteOuNull(ligne.diffusion_politique_url)),
  }
}

/** Page publique (rendu serveur) : langue et contact du cabinet du chemin, rien d'autre. */
export async function cabinetDuCheminDesinscriptionQr(identifiant: string): Promise<{ langue: LangueSignalementQr; contact: string | null } | null> {
  const cabinet = await lireCabinetDesinscriptionQr(identifiant)
  return cabinet ? { langue: cabinet.langue, contact: cabinet.contact } : null
}

// ── Corps de la lecture (D-P1) ──

/** Adresse masquée : deux premiers caractères au plus (un seul si la partie locale est courte), domaine entier. */
export function masquerEmailDesinscriptionQr(email: string | null): string | null {
  if (!email) return null
  const arobase = email.lastIndexOf('@')
  if (arobase < 1) return null
  const locale = email.slice(0, arobase)
  let garde = 0
  if (locale.length >= 4) garde = 2
  else if (locale.length >= 2) garde = 1
  return `${locale.slice(0, garde)}***${email.slice(arobase)}`
}

export type CorpsLectureDesinscriptionQr =
  | {
    etat: 'valide'; type: UsageLienDiffusionQr; langue: LangueSignalementQr; cabinet: string; copropriete: string
    emailMasque?: string; oppose?: boolean; levable?: boolean; politiqueUrl?: string
  }
  | { etat: 'expire'; type: UsageLienDiffusionQr; langue: LangueSignalementQr; cabinet: string; copropriete: string; politiqueUrl?: string }
  | { etat: 'ancien'; langue: LangueSignalementQr; cabinet?: string; contactCabinet?: string; politiqueUrl?: string }
  | { etat: 'inconnu'; langue: LangueSignalementQr; contactCabinet?: string }

/**
 * Corps de D-P1 (fonction pure). Jeton un clic : ni adresse masquée, ni « levable », ni état d'opposition (§ 8.1 : il ne
 * permet que de s'opposer ; il se lit dans les journaux du Worker, chez Resend ou dans la source d'un message transféré,
 * et ne doit rien dire de la personne — relecture 2 de la PR 3 : avec le repli par l'adresse, l'état d'opposition aurait
 * confirmé une adresse devinée ; la page affiche toujours le bouton, D-P2 est idempotente). Expiré : ni adresse, ni état
 * d'opposition (repli par l'adresse). Ancien et inconnu : cabinet du chemin. Aucune date, jamais.
 */
export function corpsLectureDesinscriptionQr(
  lien: Exclude<LienDesinscriptionLuQr, { etat: 'erreur' }>,
  cabinetChemin: CabinetDesinscriptionQr | null,
): CorpsLectureDesinscriptionQr {
  if (lien.etat === 'inconnu') {
    const contact = cabinetChemin?.contact
    return { etat: 'inconnu', langue: cabinetChemin?.langue ?? 'fr', ...(contact ? { contactCabinet: contact } : {}) }
  }
  if (lien.etat === 'ancien') {
    return {
      etat: 'ancien',
      langue: cabinetChemin?.langue ?? 'fr',
      ...(cabinetChemin?.nom ? { cabinet: cabinetChemin.nom } : {}),
      ...(cabinetChemin?.contact ? { contactCabinet: cabinetChemin.contact } : {}),
      ...(cabinetChemin?.politiqueUrl ? { politiqueUrl: cabinetChemin.politiqueUrl } : {}),
    }
  }
  const { ligne, usage } = lien
  const politique = politiqueSureQr(ligne.politique_url)
  const commun = {
    type: usage,
    langue: langueDesinscriptionQr(ligne.langue),
    cabinet: ligne.cabinet_nom ?? '',
    copropriete: ligne.copropriete_nom ?? '',
  }
  if (lien.etat === 'expire') return { etat: 'expire', ...commun, ...(politique ? { politiqueUrl: politique } : {}) }
  const masque = usage === 'page' ? masquerEmailDesinscriptionQr(ligne.email) : null
  return {
    etat: 'valide',
    ...commun,
    ...(masque ? { emailMasque: masque } : {}),
    ...(usage === 'page' ? { oppose: ligne.oppose, levable: ligne.oppose && ligne.levable } : {}),
    ...(politique ? { politiqueUrl: politique } : {}),
  }
}
