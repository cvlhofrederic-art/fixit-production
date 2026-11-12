// ── AJ Signalement, côté serveur : information des déclarants (PR 3, lot 7) ──
//
// Cahier PR 3 § 6, droit § 5.4 et § 4.5 (art. 13 du RGPD) ; décisions HF2 (politique du cabinet) et HF3 (information à
// la collecte). Importé par la route du dépôt public et par la page publique du chemin d'un cabinet ; jamais par un
// composant client. Clé service (supabaseAdmin) ; les règles sont en SQL (migration 20261113) :
//   - annonce : signalements_qr_diffusion_annonce(signalement) dit si l'accusé porte les deux phrases du droit § 5.4
//     (copropriété qui peut diffuser, adresse sans opposition) ; signalements_qr_diffusion_annonce_faite(signalement)
//     date l'annonce, appelée par la route SEULEMENT après l'acceptation de l'accusé par le service d'e-mail ;
//   - politique : adresse de la politique de confidentialité du cabinet de la copropriété (colonne
//     diffusion_politique_url), pour la ligne d'information de l'accusé et la mention du formulaire public ;
//   - formulaire : partie « diffusion » de la mention seulement quand signalements_qr_diffusion_raison_inactive rend
//     NULL (même règle que l'aperçu, la création et chaque lot).
// Rien ne lève : migration 20261113 non appliquée (fonction ou colonne absente) → sans annonce ni information, repli
// journalisé une fois par isolat et par opération (journaliserRepliDiffusionQr de serveur.ts, commun à toute la diffusion) ; toute autre erreur → avertissement avec son code seul (jamais le
// message de la base, qui peut citer une valeur) ; le dépôt et l'accusé restent acquis (modèle SPEC PR 1 § 1.11).

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import {
  TABLE_CABINETS_QR, TABLE_COPROPRIETES_QR, journaliserRepliDiffusionQr, structureAbsenteQr, type ErreurBase,
} from '@/lib/aj-signalement/serveur'
import { politiqueConfidentialiteValideQr, type PolitiqueCabinetQr } from '@/lib/aj-signalement/email'
import { nettoyerLigneDiffusionQr } from '@/lib/aj-signalement/diffusion-texte'
import type { InformationFormulaireQr } from '@/lib/aj-signalement/textes'

const CONTEXTE = '[AJ SIGNALEMENT]'

/** Erreur d'une lecture ou d'un appel : repli journalisé (structure absente) ou avertissement avec le code seul. */
function signalerErreurQr(operation: string, erreur: ErreurBase, ids: Record<string, string>): void {
  if (structureAbsenteQr(erreur)) journaliserRepliDiffusionQr(operation, erreur)
  else logger.warn(`${CONTEXTE} ${operation} : erreur de la base, repli`, { code: erreur.code, ...ids })
}

/** Exception (réseau, client) : avertissement avec le nom de l'exception seul. */
function signalerExceptionQr(operation: string, e: unknown, ids: Record<string, string>): void {
  logger.warn(`${CONTEXTE} ${operation} : exception, repli`, { exception: e instanceof Error ? e.name : 'inconnue', ...ids })
}

// ── Annonce de la diffusion dans l'accusé (droit § 5.4) ──

/**
 * L'accusé de ce dépôt doit-il porter les deux phrases du droit § 5.4 ? Vrai seulement si la fonction SQL le dit
 * (copropriété qui peut diffuser, adresse sans opposition active dans cette copropriété) ; faux sinon, et sur toute
 * erreur : la phrase n'annonce jamais une diffusion qui n'existe pas.
 */
export async function annonceDiffusionQr(signalementId: string): Promise<boolean> {
  const operation = 'annonce de la diffusion dans l’accusé'
  try {
    const { data, error } = await supabaseAdmin.rpc('signalements_qr_diffusion_annonce', { p_signalement: signalementId })
    if (error) {
      signalerErreurQr(operation, error, { signalement: signalementId })
      return false
    }
    return data === true
  } catch (e: unknown) {
    signalerExceptionQr(operation, e, { signalement: signalementId })
    return false
  }
}

/**
 * Après l'acceptation de l'accusé (qui portait les deux phrases) : date l'annonce (origine « accuse »), preuve de
 * l'information préalable (H1). Vrai si la ligne a été datée ; faux sinon (déjà datée, plus due, erreur). Ne lève jamais.
 */
export async function annonceDiffusionFaiteQr(signalementId: string): Promise<boolean> {
  const operation = 'datation de l’annonce de la diffusion'
  try {
    const { data, error } = await supabaseAdmin.rpc('signalements_qr_diffusion_annonce_faite', { p_signalement: signalementId })
    if (error) {
      signalerErreurQr(operation, error, { signalement: signalementId })
      return false
    }
    return data === true
  } catch (e: unknown) {
    signalerExceptionQr(operation, e, { signalement: signalementId })
    return false
  }
}

// ── Politique de confidentialité du cabinet ──

/** Politique du cabinet : nom nettoyé et adresse https bien formée, sinon null (rien n'est affiché). */
async function lirePolitiqueCabinetQr(cabinetId: string, operation: string): Promise<PolitiqueCabinetQr | null> {
  const { data, error } = await supabaseAdmin.from(TABLE_CABINETS_QR).select('nom, diffusion_politique_url').eq('id', cabinetId).maybeSingle()
  if (error) {
    signalerErreurQr(operation, error, { cabinet: cabinetId })
    return null
  }
  const ligne = data as { nom?: unknown; diffusion_politique_url?: unknown } | null
  const url = ligne?.diffusion_politique_url
  if (!politiqueConfidentialiteValideQr(url)) return null
  const cabinet = typeof ligne?.nom === 'string' ? nettoyerLigneDiffusionQr(ligne.nom) : ''
  return cabinet ? { cabinet, url } : null
}

/**
 * Accusé de réception : politique du cabinet de la copropriété (ligne d'information, seul lien de l'accusé) ; null
 * pour une copropriété sans cabinet, un cabinet sans politique, ou sur toute erreur. Ne lève jamais.
 */
export async function politiqueCabinetDeCoproprieteQr(coproprieteId: string): Promise<PolitiqueCabinetQr | null> {
  const operation = 'politique du cabinet pour l’accusé'
  try {
    const copro = await supabaseAdmin.from(TABLE_COPROPRIETES_QR).select('cabinet_id').eq('id', coproprieteId).maybeSingle()
    if (copro.error) {
      signalerErreurQr(operation, copro.error, { copropriete: coproprieteId })
      return null
    }
    const cabinetId = (copro.data as { cabinet_id?: unknown } | null)?.cabinet_id
    if (typeof cabinetId !== 'string') return null
    return await lirePolitiqueCabinetQr(cabinetId, operation)
  } catch (e: unknown) {
    signalerExceptionQr(operation, e, { copropriete: coproprieteId })
    return null
  }
}

// ── Information du formulaire public (HF3) ──

/** La copropriété peut-elle diffuser ? Règle SQL unique ; faux sur toute erreur (jamais de promesse de diffusion). */
async function diffusionPossibleQr(coproprieteId: string, operation: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('signalements_qr_diffusion_raison_inactive', { p_copropriete: coproprieteId })
  if (error) {
    signalerErreurQr(operation, error, { copropriete: coproprieteId })
    return false
  }
  return data === null
}

/**
 * Page publique du chemin d'un cabinet : information à la collecte sous le bouton d'envoi — nom du cabinet, politique,
 * diffusion possible (partie « diffusion » de la mention). null (formulaire inchangé) pour un cabinet sans politique, une
 * politique hors format, ou sur toute erreur. Ne lève jamais.
 */
export async function informationFormulaireQr(coproprieteId: string, cabinetId: string): Promise<InformationFormulaireQr | null> {
  const operation = 'information du formulaire public'
  try {
    const politique = await lirePolitiqueCabinetQr(cabinetId, operation)
    if (!politique) return null
    const diffusion = await diffusionPossibleQr(coproprieteId, `${operation} (diffusion possible)`)
    return { cabinet: politique.cabinet, politiqueUrl: politique.url, diffusion }
  } catch (e: unknown) {
    signalerExceptionQr(operation, e, { copropriete: coproprieteId, cabinet: cabinetId })
    return null
  }
}
