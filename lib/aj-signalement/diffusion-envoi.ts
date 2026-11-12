// ── AJ Signalement — diffusion : envoi par lots (PR 3, lot 5) ───────────────────────────────────────────────────────
//
// Cahier PR 3 § 5.5 et § 9. Module serveur (clé service, service d'e-mail), appelé par les routes de création (D-R3), de
// reprise (D-R4) et par le filet de reprise (D-C1). Pour chaque lot, jusqu'à 5 par appel et 1 s entre deux lots (le
// débit du service d'e-mail est commun à tout VitFix : mots de passe, invitations, accusés) :
//   1. signalements_qr_diffusion_lot(diffusion, 100) réserve le lot suivant et rend l'adresse RELUE de chaque ligne —
//      la base y revérifie tout (oppositions, copropriété et cabinet, adresse changée, 24 h ; lot interrompu rejoué à
//      l'identique ou renuméroté), rien de cela n'est refait ici ;
//   2. message de chaque ligne depuis les SEULES valeurs figées de la diffusion et ses deux liens signés (page et un clic) :
//      même entrée, même message — un lot rejoué sous la même clé est identique octet pour octet (idempotence) ;
//   3. un appel au service d'e-mail par lot (sendBatchEmailsDetaille : mode permissive, clé
//      « aj-diffusion-<diffusion>-<lot> », délai de 15 s) ;
//   4. signalements_qr_diffusion_resultats inscrit l'issue sur les lignes EN COURS de ce lot : acceptées → envoye ;
//      refusées à l'unité (ou adresse relue hors forme, jamais envoyée) → refuse ; limite de débit → en attente
//      (limite_service) et arrêt ; quota → en attente (quota_service), arrêt, erreur journalisée ; contenu refusé au
//      rejeu → incertain (issue_inconnue), jamais renvoyé ; réseau, délai dépassé ou refus global → AUCUNE écriture (les
//      lignes restent en cours : règle du lot interrompu après 10 minutes) ; rejeu concurrent → aucune écriture.
// Journal serveur : identifiant de diffusion, numéro de lot, nombres et codes ; jamais une adresse, un objet, un texte,
// un jeton, ni le texte d'une erreur du service d'e-mail ou de la base.

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { sendBatchEmailsDetaille, type EmailPayload, type OptionsLotEmailDetaille, type ResultatLotEmailDetaille } from '@/lib/email'
import {
  DiffusionInvalideQr, adresseDestinataireDiffusionValideQr, messageDiffusionQr, type DiffusionFigeeQr,
} from '@/lib/aj-signalement/email'
import { cleLiensDiffusionConfigureeQr, signerLiensDiffusionQr, type SignatureLiensDiffusionQr } from '@/lib/aj-signalement/diffusion-lien'

const CONTEXTE = '[AJ SIGNALEMENT]'

/** Destinataires par lot (borne de signalements_qr_diffusion_lot et du lot du service d'e-mail). */
export const TAILLE_LOT_DIFFUSION_QR = 100
/** Lots au plus par appel (une requête HTTP : 500 personnes). */
export const LOTS_PAR_APPEL_DIFFUSION_QR = 5
/** Pause entre deux lots : la moitié du débit du service reste aux autres e-mails de VitFix (§ 5.5, F6). */
export const PAUSE_LOTS_DIFFUSION_MS = 1000
/** Délai d'attente de la réponse du service d'e-mail pour un lot. */
export const DELAI_LOT_DIFFUSION_MS = 15_000

/** Erreur de la base telle que PostgREST la rend (le message n'est jamais journalisé). */
interface ErreurRpcQr { code?: string; message?: string }

/** Appel d'une fonction SQL (supabaseAdmin.rpc par défaut). */
export type RpcDiffusionQr = (nom: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: ErreurRpcQr | null }>

export interface DependancesEnvoiDiffusionQr {
  rpc: RpcDiffusionQr
  envoyerLot: (messages: readonly EmailPayload[], options: OptionsLotEmailDetaille) => Promise<ResultatLotEmailDetaille>
  signer: (destinataireId: string) => Promise<SignatureLiensDiffusionQr>
  cleConfiguree: () => boolean
  attendre: (ms: number) => Promise<void>
}

// Chaque dépendance est lue à l'appel (jamais au chargement du module) : un module qui importe celui-ci sans envoyer
// n'exige rien du service d'e-mail.
const DEPENDANCES_PAR_DEFAUT: DependancesEnvoiDiffusionQr = {
  rpc: (nom, args) => supabaseAdmin.rpc(nom, args),
  envoyerLot: (messages, options) => sendBatchEmailsDetaille(messages, options),
  signer: (id) => signerLiensDiffusionQr(id),
  cleConfiguree: () => cleLiensDiffusionConfigureeQr(),
  attendre: (ms) => new Promise((resoudre) => { setTimeout(resoudre, ms) }),
}

/**
 * Pourquoi la boucle s'est arrêtée avant d'avoir tout envoyé : limite ou quota du service (lignes remises en attente),
 * rejeu concurrent (une autre requête envoie ce lot), issue inconnue (contenu refusé au rejeu ou valeur figée hors
 * forme : lignes incertaines), réseau (lignes en cours, reprises après 10 minutes), clé de signature absente, erreur de
 * la base. null : la boucle a fini normalement (plus rien à réserver, ou lots par appel atteints).
 */
export type ArretEnvoiDiffusionQr =
  | 'limite_service' | 'quota_service' | 'rejeu_concurrent' | 'issue_inconnue' | 'reseau' | 'configuration_incomplete' | 'base'

export interface BilanEnvoiDiffusionQr {
  /** Lots réservés par cet appel. */
  lots: number
  /** Lignes passées à « envoye » / « refuse » par cet appel (nombres de la base). */
  envoyes: number
  refuses: number
  /** Lignes en attente ou en cours après le dernier lot inscrit ; null si aucun résultat n'a été inscrit en dernier. */
  reste: number | null
  arret: ArretEnvoiDiffusionQr | null
}

export interface OptionsEnvoiDiffusionQr {
  /** Lots au plus pour cet appel (1 à 5 ; 5 par défaut). */
  lotsMax?: number
  /** Tests : dépendances remplacées. */
  dependances?: Partial<DependancesEnvoiDiffusionQr>
}

interface LigneLotQr { destinataire_id: string; email: string; lot: number; reprise: boolean }

/** Lignes rendues par signalements_qr_diffusion_lot ; une ligne hors forme est ignorée (la base l'a réservée : elle
 *  restera en cours puis sera revérifiée comme un lot interrompu). */
function lignesDuLot(data: unknown): LigneLotQr[] {
  if (!Array.isArray(data)) return []
  return data.filter((l): l is LigneLotQr => typeof l === 'object' && l !== null
    && typeof (l as LigneLotQr).destinataire_id === 'string' && typeof (l as LigneLotQr).email === 'string'
    && Number.isInteger((l as LigneLotQr).lot))
}

interface ResultatsLotQr { envoyes: number; refuses: number; reste: number }

const entier = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** Messages d'un lot : un par ligne envoyable ; adresse hors forme → refusée sans envoi ; valeur figée hors forme → null. */
async function messagesDuLot(
  diffusion: DiffusionFigeeQr, lignes: readonly LigneLotQr[], d: DependancesEnvoiDiffusionQr,
): Promise<{ messages: EmailPayload[]; ids: string[]; refusesLocaux: string[] } | { invalide: string } | { configuration: true }> {
  const messages: EmailPayload[] = []
  const ids: string[] = []
  const refusesLocaux: string[] = []
  for (const ligne of lignes) {
    if (!adresseDestinataireDiffusionValideQr(ligne.email)) {
      refusesLocaux.push(ligne.destinataire_id)
      continue
    }
    const jetons = await d.signer(ligne.destinataire_id)
    if (!jetons.ok) {
      if (jetons.code === 'configuration_incomplete') return { configuration: true }
      refusesLocaux.push(ligne.destinataire_id)
      continue
    }
    try {
      messages.push(messageDiffusionQr(diffusion, { id: ligne.destinataire_id, email: ligne.email }, { page: jetons.page, unClic: jetons.unClic }))
      ids.push(ligne.destinataire_id)
    } catch (erreur) {
      if (!(erreur instanceof DiffusionInvalideQr)) throw erreur
      if (erreur.champ !== 'destinataire') return { invalide: erreur.champ }
      refusesLocaux.push(ligne.destinataire_id)
    }
  }
  return { messages, ids, refusesLocaux }
}

/**
 * Envoie les lots suivants d'une diffusion (5 au plus, 1 s entre deux) et rend le bilan de cet appel. Ne lève pas pour
 * une erreur de la base ou du service d'e-mail (arrêt et journal) ; la clé de signature est vérifiée avant toute
 * réservation.
 */
export async function envoyerDiffusionQr(diffusion: DiffusionFigeeQr, options: OptionsEnvoiDiffusionQr = {}): Promise<BilanEnvoiDiffusionQr> {
  const d: DependancesEnvoiDiffusionQr = { ...DEPENDANCES_PAR_DEFAUT, ...options.dependances }
  const lotsMax = Math.min(Math.max(Math.trunc(options.lotsMax ?? LOTS_PAR_APPEL_DIFFUSION_QR), 1), LOTS_PAR_APPEL_DIFFUSION_QR)
  const bilan: BilanEnvoiDiffusionQr = { lots: 0, envoyes: 0, refuses: 0, reste: null, arret: null }
  const ids = { diffusionId: diffusion.id }
  if (!d.cleConfiguree()) {
    logger.error(`${CONTEXTE} diffusion : clé de signature des liens absente, rien n’est envoyé`, ids)
    return { ...bilan, arret: 'configuration_incomplete' }
  }

  /** Inscrit l'issue d'un lot ; false si la base la refuse (journalisée, arrêt). */
  const inscrire = async (lot: number, envoyes: string[], refuses: string[], nonPartis: string[], code: string | null): Promise<boolean> => {
    const { data, error } = await d.rpc('signalements_qr_diffusion_resultats', {
      p_diffusion: diffusion.id, p_lot: lot, p_envoyes: envoyes, p_refuses: refuses, p_non_partis: nonPartis, p_code: code,
    })
    if (error) {
      logger.error(`${CONTEXTE} diffusion : issue d’un lot non inscrite (les lignes restent en cours)`, { ...ids, lot, code: error.code })
      bilan.arret = 'base'
      return false
    }
    const r = (data ?? {}) as Partial<Record<keyof ResultatsLotQr, unknown>>
    bilan.envoyes += entier(r.envoyes)
    bilan.refuses += entier(r.refuses)
    bilan.reste = entier(r.reste)
    return true
  }

  for (let i = 0; i < lotsMax; i += 1) {
    if (i > 0) await d.attendre(PAUSE_LOTS_DIFFUSION_MS)
    const reservation = await d.rpc('signalements_qr_diffusion_lot', { p_diffusion: diffusion.id, p_taille: TAILLE_LOT_DIFFUSION_QR })
    if (reservation.error) {
      logger.error(`${CONTEXTE} diffusion : lot non réservé`, { ...ids, code: reservation.error.code })
      bilan.arret = 'base'
      break
    }
    const lignes = lignesDuLot(reservation.data)
    // Plus rien à réserver : tout est parti, un lot est en cours ailleurs, ou la base a tout arrêté (inactive, 24 h).
    // Le reste n'est alors pas connu ici (la route relit les nombres de la diffusion).
    if (lignes.length === 0) {
      bilan.reste = null
      break
    }
    bilan.lots += 1
    const lot = lignes[0].lot
    const tous = lignes.map((l) => l.destinataire_id)
    const prepares = await messagesDuLot(diffusion, lignes, d)
    if ('configuration' in prepares) {
      logger.error(`${CONTEXTE} diffusion : clé de signature des liens absente, lot laissé en cours`, { ...ids, lot })
      bilan.arret = 'configuration_incomplete'
      bilan.reste = null
      break
    }
    if ('invalide' in prepares) {
      // Valeur figée hors forme (défaut : la base les contrôle à la création) : rien ne peut partir, jamais renvoyé.
      logger.error(`${CONTEXTE} diffusion : valeur figée hors forme, lot abandonné (incertain)`, { ...ids, lot, champ: prepares.invalide })
      if (await inscrire(lot, [], [], tous, 'issue_inconnue')) bilan.arret = 'issue_inconnue'
      break
    }
    const { messages, ids: envoyables, refusesLocaux } = prepares
    if (messages.length === 0) {
      if (!(await inscrire(lot, [], refusesLocaux, [], null))) break
      if (bilan.reste === 0) break
      continue
    }

    const envoi = await d.envoyerLot(messages, {
      idempotencyKey: `aj-diffusion-${diffusion.id}-${lot}`, validation: 'permissive', delaiMs: DELAI_LOT_DIFFUSION_MS,
    })
    const nb = { ...ids, lot, messages: messages.length }
    if (envoi.ok) {
      const acceptes = envoi.acceptes.map((k) => envoyables[k]).filter((v): v is string => v !== undefined)
      const refuses = [...envoi.refuses.map((k) => envoyables[k]).filter((v): v is string => v !== undefined), ...refusesLocaux]
      if (!(await inscrire(lot, acceptes, refuses, [], null))) break
      if (bilan.reste === 0) break
      continue
    }
    if (envoi.code === 'limite' || envoi.code === 'quota') {
      const code = envoi.code === 'limite' ? 'limite_service' : 'quota_service'
      if (envoi.code === 'limite') logger.warn(`${CONTEXTE} diffusion : limite de débit du service d’e-mail, lot remis en attente`, { ...nb, motif: envoi.motif })
      else logger.error(`${CONTEXTE} diffusion : quota du service d’e-mail atteint, lot remis en attente`, { ...nb, motif: envoi.motif })
      if (await inscrire(lot, [], refusesLocaux, envoyables, code)) bilan.arret = code
      break
    }
    if (envoi.code === 'rejeu_refuse') {
      // Même clé, contenu différent malgré les valeurs figées : défaut à corriger ; l'issue est inconnue, rien n'est renvoyé.
      logger.error(`${CONTEXTE} diffusion : contenu refusé au rejeu par le service d’e-mail, lot incertain`, { ...nb, motif: envoi.motif })
      if (await inscrire(lot, [], refusesLocaux, envoyables, 'issue_inconnue')) bilan.arret = 'issue_inconnue'
      break
    }
    if (envoi.code === 'rejeu_concurrent') {
      logger.warn(`${CONTEXTE} diffusion : lot déjà en cours d’envoi par une autre requête`, nb)
      bilan.arret = 'rejeu_concurrent'
      bilan.reste = null
      break
    }
    // reseau (issue inconnue : délai dépassé, réponse illisible, 5xx) ou refus global du lot : aucune issue inscrite
    // pour les messages appelés (règle du lot interrompu) ; les adresses hors forme, jamais envoyées, sont refusées.
    if (envoi.code === 'reseau') logger.warn(`${CONTEXTE} diffusion : issue d’un lot inconnue, lot laissé en cours`, { ...nb, motif: envoi.motif })
    else logger.error(`${CONTEXTE} diffusion : lot refusé par le service d’e-mail, lot laissé en cours`, { ...nb, motif: envoi.motif, statut: envoi.statutHttp })
    if (refusesLocaux.length > 0) await inscrire(lot, [], refusesLocaux, [], null)
    bilan.arret = 'reseau'
    bilan.reste = null
    break
  }
  return bilan
}
