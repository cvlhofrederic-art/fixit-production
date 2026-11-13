// ── AJ Signalement, côté serveur : logo d'un cabinet client (migration 20261114) ────────────────────────────────────
//
// Demande de Hugo du 13/11/2026 : le logo du cabinet sur les affiches PDF, dans l'espace du cabinet, sur la page
// publique de signalement et dans l'accusé de réception envoyé au déclarant (ni dans les e-mails de signalement aux
// gestionnaires, partis en lot sans pièce jointe possible, ni dans les messages de diffusion, ni sur la page de
// désinscription). Lectures avec la clé service (supabaseAdmin), jamais depuis un composant client :
//   - lireMetaLogosQr / lireMetaLogoCabinetQr : métadonnées seulement (version, dimensions) pour les listes et les
//     profils (GET /cabinets, GET /moi), jamais l'image ;
//   - lireLogoPageCabinetQr : nom du cabinet et métadonnées, prêts pour une page (espace du cabinet, page publique du
//     QR code) ; jamais l'image, qui est lue par sa route publique ; ne lève jamais : un logo ne casse aucune page ;
//   - lireLogoCabinetQr : l'image et ses métadonnées (route publique de lecture), revérifiée (analyserPngQr, forme ET
//     contenu : la contrainte de la base ne vérifie que la forme) : une valeur stockée qui ne serait pas un PNG conforme,
//     même écrite hors de la route, n'est jamais servie (relecture de sécurité du 13/11/2026) ;
//   - lireLogoEmailDeCoproprieteQr : la même image revérifiée et le nom du cabinet d'une copropriété, pour la pièce
//     jointe en ligne de l'accusé de réception ; ne lève jamais : l'accusé part toujours.
// Migration absente (colonnes inconnues 42703) : aucun logo, repli journalisé une fois par isolat (journaliserRepliLogoQr) ;
// toute autre erreur est journalisée avec son code seul et traitée comme « aucun logo » par les lectures de métadonnées.

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import {
  TABLE_CABINETS_QR, TABLE_COPROPRIETES_QR, journaliserRepliLogoQr, structureAbsenteQr, type ErreurBase,
} from '@/lib/aj-signalement/serveur'
import { analyserPngQr, logoPageQr, metaLogoDepuisLigneQr, octetsDepuisByteaQr, type LogoPageQr } from '@/lib/aj-signalement/logo'
import { validerIdentifiantCabinetQr } from '@/lib/aj-signalement/chemin-cabinet'
import type { LogoCabinetQr, LogoEmailCabinetQr } from '@/lib/aj-signalement/types'

const CONTEXTE = '[AJ SIGNALEMENT]'

/** Colonnes des métadonnées du logo (jamais l'image) ; absentes tant que la migration 20261114 manque. */
export const COLONNES_META_LOGO_QR = 'logo_version, logo_largeur, logo_hauteur'

/** Logo prêt à servir : l'image PNG revérifiée et ses métadonnées. */
export interface LogoPngCabinetQr extends LogoCabinetQr {
  /** Octets du PNG (corps de la réponse de la route publique, pièce jointe en ligne d'un e-mail en base64). */
  png: Uint8Array<ArrayBuffer>
}

/** Clé d'un cabinet : son id, ou l'identifiant de son chemin public. */
export type CleCabinetLogoQr = { id: string } | { identifiant: string }

/**
 * Métadonnées des logos des cabinets donnés (tous si `ids` est null) : id du cabinet → logo. Cabinets sans logo absents
 * de la table rendue. Migration absente ou erreur de la base : table vide (journalisé), la liste reste servie.
 */
export async function lireMetaLogosQr(ids: readonly string[] | null): Promise<Map<string, LogoCabinetQr>> {
  const resultat = new Map<string, LogoCabinetQr>()
  if (ids?.length === 0) return resultat
  const q = supabaseAdmin.from(TABLE_CABINETS_QR).select(`id, ${COLONNES_META_LOGO_QR}`).not('logo_version', 'is', null)
  const { data, error } = await (ids ? q.in('id', [...ids]) : q)
  if (error) {
    if (structureAbsenteQr(error)) journaliserRepliLogoQr('logos des cabinets', error)
    else logger.error(`${CONTEXTE} logos des cabinets non lus`, { code: error.code })
    return resultat
  }
  for (const ligne of (data ?? []) as Array<Record<string, unknown>>) {
    const logo = metaLogoDepuisLigneQr(ligne)
    if (logo && typeof ligne.id === 'string') resultat.set(ligne.id, logo)
  }
  return resultat
}

export type LectureMetaLogoQr = { ok: true; logo: LogoCabinetQr | null } | { ok: false }

/**
 * Métadonnées du logo d'un cabinet, sans l'image. { ok: true, logo: null } : aucun logo, cabinet inconnu, ou migration
 * absente (journalisé une fois) ; { ok: false } : erreur de la base (code seul au journal). Sert à la route publique,
 * qui décide d'un 404 ou d'un 304 sans tirer l'image (relecture de sécurité du 13/11/2026).
 */
export async function lectureMetaLogoCabinetQr(cle: CleCabinetLogoQr): Promise<LectureMetaLogoQr> {
  const q = supabaseAdmin.from(TABLE_CABINETS_QR).select(COLONNES_META_LOGO_QR)
  const { data, error } = await ('id' in cle ? q.eq('id', cle.id) : q.eq('identifiant', cle.identifiant)).maybeSingle()
  if (error) {
    if (structureAbsenteQr(error)) {
      journaliserRepliLogoQr('logo d’un cabinet', error)
      return { ok: true, logo: null }
    }
    logger.error(`${CONTEXTE} logo d’un cabinet non lu`, { code: error.code })
    return { ok: false }
  }
  return { ok: true, logo: data ? metaLogoDepuisLigneQr(data as Record<string, unknown>) : null }
}

/** Métadonnées du logo d'un cabinet ; null : aucun logo, migration absente ou erreur de la base (journalisé). */
export async function lireMetaLogoCabinetQr(cle: CleCabinetLogoQr): Promise<LogoCabinetQr | null> {
  const lecture = await lectureMetaLogoCabinetQr(cle)
  return lecture.ok ? lecture.logo : null
}

/**
 * Logo d'un cabinet pour une page : connexion, invitation et confirmation d'adresse (par l'identifiant du chemin), page
 * publique du QR code (par l'id du cabinet de la copropriété). Nom et métadonnées seulement (jamais l'image). null : la
 * page reste celle d'avant — identifiant invalide ou réservé (sans lecture), cabinet inconnu ou sans logo, métadonnées
 * incohérentes, migration 20261114 absente (repli journalisé une fois), erreur de la base (code seul) ou exception (nom
 * seul). Ne lève jamais.
 */
export async function lireLogoPageCabinetQr(cle: CleCabinetLogoQr): Promise<LogoPageQr | null> {
  if ('identifiant' in cle && !validerIdentifiantCabinetQr(cle.identifiant).ok) return null
  try {
    const q = supabaseAdmin.from(TABLE_CABINETS_QR).select(`identifiant, nom, ${COLONNES_META_LOGO_QR}`)
    const { data, error } = await ('id' in cle ? q.eq('id', cle.id) : q.eq('identifiant', cle.identifiant)).maybeSingle()
    if (error) {
      if (structureAbsenteQr(error)) journaliserRepliLogoQr('logo d’une page du cabinet', error)
      else logger.error(`${CONTEXTE} logo d’une page du cabinet non lu`, { code: error.code })
      return null
    }
    const ligne = (data ?? null) as Record<string, unknown> | null
    const identifiant = typeof ligne?.identifiant === 'string' ? ligne.identifiant : null
    if (!ligne || !identifiant || ('identifiant' in cle && identifiant !== cle.identifiant)) return null
    return logoPageQr(identifiant, typeof ligne.nom === 'string' ? ligne.nom : '', metaLogoDepuisLigneQr(ligne))
  } catch (e: unknown) {
    logger.warn(`${CONTEXTE} logo d’une page du cabinet non lu (exception)`, { exception: e instanceof Error ? e.name : 'inconnue' })
    return null
  }
}

export type LectureLogoQr = { ok: true; logo: LogoPngCabinetQr | null } | { ok: false }

/**
 * Image du logo d'un cabinet et ses métadonnées. { ok: true, logo: null } : aucun logo, migration absente (journalisé
 * une fois), ou valeur stockée qui n'est pas un PNG conforme (journalisé en erreur : jamais servie). { ok: false } :
 * erreur de la base (code seul au journal) ; une page ou un e-mail la traite comme « aucun logo ».
 */
export async function lireLogoCabinetQr(cle: CleCabinetLogoQr): Promise<LectureLogoQr> {
  const q = supabaseAdmin.from(TABLE_CABINETS_QR).select(`logo_png, ${COLONNES_META_LOGO_QR}`)
  const { data, error } = await ('id' in cle ? q.eq('id', cle.id) : q.eq('identifiant', cle.identifiant)).maybeSingle()
  if (error) {
    if (structureAbsenteQr(error)) {
      journaliserRepliLogoQr('image du logo', error)
      return { ok: true, logo: null }
    }
    logger.error(`${CONTEXTE} image du logo non lue`, { code: error.code })
    return { ok: false }
  }
  return { ok: true, logo: imageDepuisLigneQr((data ?? null) as Record<string, unknown> | null) }
}

/**
 * Image d'une ligne de signalements_qr_cabinets (colonnes logo_png et métadonnées) : null sans logo, ou si la valeur
 * stockée n'est pas un PNG conforme à ses métadonnées (journalisé en erreur : impossible tant que la contrainte de la
 * base tient ; jamais servi ni envoyé).
 */
function imageDepuisLigneQr(ligne: Record<string, unknown> | null): LogoPngCabinetQr | null {
  if (!ligne || ligne.logo_png === null || ligne.logo_png === undefined) return null
  const meta = metaLogoDepuisLigneQr(ligne)
  const png = octetsDepuisByteaQr(ligne.logo_png)
  const analyse = png ? analyserPngQr(png) : null
  if (!meta || !png || !analyse?.ok || analyse.largeur !== meta.largeur || analyse.hauteur !== meta.hauteur) {
    logger.error(`${CONTEXTE} logo stocké illisible : non servi`, { raison: analyse && !analyse.ok ? analyse.raison : 'forme' })
    return null
  }
  return { ...meta, png }
}

/**
 * Accusé de réception au déclarant (route du dépôt public) : image revérifiée du logo du cabinet de la copropriété et
 * nom du cabinet (texte alternatif), pour une pièce jointe EN LIGNE. null — l'accusé part comme avant — pour une
 * copropriété sans cabinet ou inconnue, un cabinet sans logo, une image stockée illisible, une structure absente
 * (migration 20261114, ou colonne cabinet_id de la 20261111 : repli journalisé une fois sous la clé du logo, comme la
 * politique du cabinet le fait sous celle de la diffusion ; les autres lectures du dépôt journalisent déjà la 20261111),
 * une erreur de la base (code seul) ou une exception (nom seul). Ne lève jamais.
 */
export async function lireLogoEmailDeCoproprieteQr(coproprieteId: string): Promise<LogoEmailCabinetQr | null> {
  const operation = 'logo de l’accusé de réception'
  const repli = (erreur: ErreurBase): null => {
    if (structureAbsenteQr(erreur)) journaliserRepliLogoQr(operation, erreur)
    else logger.warn(`${CONTEXTE} ${operation} non lu`, { code: erreur.code, copropriete: coproprieteId })
    return null
  }
  try {
    const copro = await supabaseAdmin.from(TABLE_COPROPRIETES_QR).select('cabinet_id').eq('id', coproprieteId).maybeSingle()
    if (copro.error) return repli(copro.error)
    const cabinetId = (copro.data as { cabinet_id?: unknown } | null)?.cabinet_id
    if (typeof cabinetId !== 'string') return null
    const { data, error } = await supabaseAdmin.from(TABLE_CABINETS_QR).select(`nom, logo_png, ${COLONNES_META_LOGO_QR}`).eq('id', cabinetId).maybeSingle()
    if (error) return repli(error)
    const ligne = (data ?? null) as Record<string, unknown> | null
    const image = imageDepuisLigneQr(ligne)
    return image ? { ...image, nom: typeof ligne?.nom === 'string' ? ligne.nom : '' } : null
  } catch (e: unknown) {
    logger.warn(`${CONTEXTE} ${operation} non lu (exception)`, { exception: e instanceof Error ? e.name : 'inconnue', copropriete: coproprieteId })
    return null
  }
}
