// ── AJ Signalement : plainte « indésirable » sur un message de diffusion (PR 3, lot 9) ──
//
// Lu par le webhook PARTAGÉ de Resend (app/api/webhooks/resend/route.ts), après la vérification de sa signature Svix.
// Décisions F7 (webhook : étiquettes, plainte, subType) et H13 (une plainte vaut opposition) ; cahier PR 3 § 5.1 (les
// étiquettes d'un message de diffusion : type=aj-diffusion, diffusion=<id>, destinataire=<id>) et § 9.
//   - étiquettes : data.tags est un objet clé → valeur dans les événements de Resend (documentation officielle des
//     événements email.complained et email.bounced, relue le 12/11/2026) ; la forme tableau [{ name, value }] de l'envoi
//     est tolérée ;
//   - seule une plainte sur un message étiqueté type=aj-diffusion (diffusion ou message d'annonce, même gabarit) donne
//     une opposition : signalements_qr_diffusion_opposer(destinataire, 'plainte'), idempotente (un événement rejoué par
//     Resend ne crée rien de plus) ; tout autre e-mail (accusé, signalement, copie au cabinet, autres e-mails de VitFix)
//     n'est pas touché ;
//   - un rebond ne donne jamais d'opposition : Resend écarte déjà l'adresse (le webhook n'appelle pas ce module).
// Aucune adresse n'est lue ni journalisée : la fonction SQL retrouve la copropriété et l'empreinte par l'identifiant du
// destinataire. Erreur de la base (autre que la migration absente) : la route répond 503, pour que Resend réessaie.

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { journaliserRepliDiffusionQr, structureAbsenteQr } from '@/lib/aj-signalement/serveur'

const CONTEXTE = '[AJ SIGNALEMENT]'

/** Étiquette « type » d'un message de diffusion (messageDiffusionQr, lib/aj-signalement/email.ts). */
export const TYPE_ETIQUETTE_DIFFUSION_QR = 'aj-diffusion'

const FORMAT_UUID_QR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Étiquettes d'un événement de Resend : objet { nom: valeur } (forme documentée des webhooks) ou tableau
 * [{ name, value }] (forme de l'envoi) ; seules les valeurs textuelles sont gardées. Toute autre forme : aucune.
 */
export function etiquettesResendQr(tags: unknown): ReadonlyMap<string, string> {
  const etiquettes = new Map<string, string>()
  if (Array.isArray(tags)) {
    for (const t of tags) {
      const { name, value } = (t ?? {}) as { name?: unknown; value?: unknown }
      if (typeof name === 'string' && typeof value === 'string') etiquettes.set(name, value)
    }
  } else if (tags && typeof tags === 'object') {
    for (const [nom, valeur] of Object.entries(tags as Record<string, unknown>)) {
      if (typeof valeur === 'string') etiquettes.set(nom, valeur)
    }
  }
  return etiquettes
}

/** Étiquette « type » des e-mails d'AJ Signalement (lib/aj-signalement/email.ts) : aj-signalement…, aj-diffusion…. */
const TYPE_EMAIL_AJ_SIGNALEMENT_QR = /^aj-(?:signalement|diffusion)(?:-|$)/

/**
 * L'événement porte-t-il sur un e-mail d'AJ Signalement (signalement, alerte, accusé, adresse, accès, diffusion, copie au
 * cabinet) ? Le webhook n'en transmet alors à Sentry ni l'objet (copropriété, objet saisi par le cabinet) ni le texte
 * d'un rebond, qui cite souvent l'adresse du destinataire (cahier PR 3 § 8.2, « Journalisation » ; relecture 3).
 */
export function emailAjSignalementQr(tags: unknown): boolean {
  return TYPE_EMAIL_AJ_SIGNALEMENT_QR.test(etiquettesResendQr(tags).get('type') ?? '')
}

/**
 * Issue du traitement d'une plainte :
 *   - hors_diffusion : le message n'est pas une diffusion (inchangé) ;
 *   - etiquette_invalide : étiqueté aj-diffusion sans identifiant de destinataire valable (rien à faire) ;
 *   - opposee : opposition enregistrée (ou déjà là) ; inconnu : destinataire absent de la base (diffusion purgée) ;
 *   - base_absente : migration 20261113 non appliquée (aucune diffusion n'a pu partir) ;
 *   - erreur : la base n'a pas répondu ; la route demande à Resend de réessayer.
 */
export type IssuePlainteDiffusionQr = 'hors_diffusion' | 'etiquette_invalide' | 'opposee' | 'inconnu' | 'base_absente' | 'erreur'

/** Plainte « indésirable » reçue par le webhook : opposition « plainte » si le message est une diffusion (H13). */
export async function traiterPlainteDiffusionQr(tags: unknown): Promise<IssuePlainteDiffusionQr> {
  const etiquettes = etiquettesResendQr(tags)
  if (etiquettes.get('type') !== TYPE_ETIQUETTE_DIFFUSION_QR) return 'hors_diffusion'
  const diffusion = etiquettes.get('diffusion')
  const ids = { diffusionId: diffusion && FORMAT_UUID_QR.test(diffusion) ? diffusion.toLowerCase() : 'inconnue' }
  const destinataire = etiquettes.get('destinataire')
  if (!destinataire || !FORMAT_UUID_QR.test(destinataire)) {
    logger.warn(`${CONTEXTE} plainte sur une diffusion sans destinataire valable : aucune opposition`, ids)
    return 'etiquette_invalide'
  }
  try {
    const { data, error } = await supabaseAdmin.rpc('signalements_qr_diffusion_opposer', {
      p_destinataire: destinataire.toLowerCase(), p_origine: 'plainte',
    })
    if (error) {
      if (structureAbsenteQr(error)) {
        journaliserRepliDiffusionQr('opposition sur plainte (webhook)', error)
        return 'base_absente'
      }
      logger.error(`${CONTEXTE} opposition sur plainte non enregistrée : erreur de la base`, { code: error.code, ...ids })
      return 'erreur'
    }
    const issue = data === true ? 'opposee' : 'inconnu'
    logger.info(`${CONTEXTE} plainte sur une diffusion : ${issue === 'opposee' ? 'opposition enregistrée' : 'destinataire inconnu'}`, ids)
    return issue
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} opposition sur plainte non enregistrée : exception`, { exception: e instanceof Error ? e.name : 'inconnue', ...ids })
    return 'erreur'
  }
}
