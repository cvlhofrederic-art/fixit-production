// app/api/cron/aj-diffusion-reprise/route.ts
//
// POST (D-C1, cahier PR 3 § 5.5, § 2.5, décision F10) — filet de reprise de la diffusion d'AJ Signalement, appelé toutes
// les 5 minutes par GitHub Actions (.github/workflows/aj-diffusion-reprise.yml ; le Worker n'a pas de cron). Il complète
// la reprise par l'écran quand la fenêtre s'est fermée pendant l'envoi :
//   - en-tête x-cron-secret comparé À TEMPS CONSTANT à INTERNAL_API_SECRET (empreintes SHA-256 de longueur fixe,
//     timingSafeEqual) ; secret absent côté serveur, en-tête absent ou faux → 401 au corps neutre ; limite par IP ;
//   - diffusions de MOINS d'une heure ayant des lignes à envoyer ou un lot interrompu (signalements_qr_diffusions_a_reprendre,
//     10 au plus ; l'âge est revérifié ici) : au-delà, seule une reprise manuelle confirmée part, et plus rien après 24 h ;
//   - 5 lots au plus par diffusion, 20 par appel (durée d'une requête du Worker) ; chaque lot revérifié par la base ;
//   - diffusion devenue impossible (copropriété désactivée, cabinet suspendu, fin de mission passée : raison d'inactivité
//     relue AVANT la copie, comme la reprise D-R4 ; relecture 3) : aucune copie au cabinet, un lot demandé pour que la base
//     annule les lignes restantes (diffusion_inactive), aucun journal de reprise ; raison illisible : diffusion laissée au
//     passage suivant ;
//   - copie au cabinet encore due (création arrêtée avant elle, ou refusée par le service) : envoyée avant les lots, datée
//     au succès (relecture 2 ; clé d'idempotence propre, un envoi concurrent de la reprise n'en fait qu'un) ;
//   - purge de conservation (H10), au plus une fois par jour ; journal diffusion.reprise (mode filet, nombre de lots).
// 200 { diffusions, lots } ; clé de signature des liens absente → 503 configuration_incomplete ; migration absente → 503
// base_absente. Journal serveur : identifiants, nombres et codes seulement.

import { NextResponse, type NextRequest } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { cleLiensDiffusionConfigureeQr } from '@/lib/aj-signalement/diffusion-lien'
import { LOTS_PAR_APPEL_DIFFUSION_QR, envoyerDiffusionQr } from '@/lib/aj-signalement/diffusion-envoi'
import { journaliserQr, reponseErreur, reponseErreurDiffusionQr } from '@/lib/aj-signalement/serveur'
import {
  diffusionFigeeQr, envoyerCopieCabinetSiDueQr, lireDiffusionQr, purgerDiffusionsSiBesoinQr, raisonInactiveDiffusionQr,
} from '@/lib/aj-signalement/serveur-diffusion'

export const maxDuration = 60

const CONTEXTE = '[AJ SIGNALEMENT]'
/** Diffusions reprises au plus par appel, lots au plus par appel (toutes diffusions confondues). */
const DIFFUSIONS_PAR_APPEL = 10
const LOTS_MAX_PAR_APPEL = 20
/** Au-delà, un message d'exploitation n'est plus repris sans confirmation humaine (D-R4). */
const UNE_HEURE_MS = 60 * 60 * 1000

const empreinte = (valeur: string): Buffer => createHash('sha256').update(valeur, 'utf8').digest()

/**
 * Secret attendu configuré ET en-tête égal, comparés à temps constant sur des empreintes de même longueur (aucune
 * fuite de la longueur) ; jamais d'égalité vide = vide.
 */
function secretValable(fourni: string | null): boolean {
  const attendu = process.env.INTERNAL_API_SECRET ?? ''
  if (attendu === '' || !fourni) return false
  return timingSafeEqual(empreinte(fourni), empreinte(attendu))
}

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRateLimit(`qr_cron_diffusion_${getClientIP(request)}`, 12, 60_000))) return rateLimitResponse()
    if (!secretValable(request.headers.get('x-cron-secret'))) {
      return NextResponse.json({ error: 'non_autorise' }, { status: 401 })
    }
    if (!cleLiensDiffusionConfigureeQr()) {
      logger.error(`${CONTEXTE} filet de reprise : clé de signature des liens absente (AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION)`)
      return reponseErreur('configuration_incomplete', 503)
    }

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_diffusions_a_reprendre', { p_limite: DIFFUSIONS_PAR_APPEL })
    if (error) return reponseErreurDiffusionQr(error, 'filet de reprise de la diffusion')
    const ids = (Array.isArray(data) ? data : [])
      .map((l) => (typeof l === 'object' && l !== null ? (l as { diffusion_id?: unknown }).diffusion_id : null))
      .filter((v): v is string => typeof v === 'string')

    let diffusions = 0
    let lots = 0
    for (const id of ids) {
      const budget = LOTS_MAX_PAR_APPEL - lots
      if (budget <= 0) break
      const lecture = await lireDiffusionQr(id)
      if (!lecture.ok) {
        logger.warn(`${CONTEXTE} filet de reprise : diffusion non relue`, { diffusionId: id, code: lecture.erreur.code })
        continue
      }
      const ligne = lecture.valeur
      if (!ligne) continue
      const creeLe = Date.parse(typeof ligne.created_at === 'string' ? ligne.created_at : '')
      if (!(Date.now() - creeLe < UNE_HEURE_MS)) {
        logger.warn(`${CONTEXTE} filet de reprise : diffusion de plus d’une heure écartée (reprise manuelle seulement)`, { diffusionId: id })
        continue
      }
      const figee = diffusionFigeeQr(ligne)
      if (!figee) continue
      // Même ordre que D-R4 : la copie au cabinet ne part que si la diffusion peut encore partir (voir l'en-tête).
      const raison = await raisonInactiveDiffusionQr(typeof ligne.copropriete_id === 'string' ? ligne.copropriete_id : '')
      if (!raison.ok) {
        logger.warn(`${CONTEXTE} filet de reprise : diffusion possible non relue`, { diffusionId: id, code: raison.erreur.code })
        continue
      }
      if (raison.valeur !== null) {
        // Un lot demandé : la base annule les lignes restantes (diffusion_inactive) et ne réserve rien ; rien ne part.
        const annulation = await envoyerDiffusionQr(figee, { lotsMax: 1 })
        lots += annulation.lots
        logger.info(`${CONTEXTE} filet de reprise : diffusion devenue impossible, lignes annulées`, { diffusionId: id, raison: raison.valeur })
        continue
      }
      await envoyerCopieCabinetSiDueQr(ligne)
      const bilan = await envoyerDiffusionQr(figee, { lotsMax: Math.min(LOTS_PAR_APPEL_DIFFUSION_QR, budget) })
      diffusions += 1
      lots += bilan.lots
      if (bilan.lots > 0) {
        await journaliserQr({
          action: 'diffusion.reprise', profil: 'systeme',
          cabinetId: typeof ligne.cabinet_id === 'string' ? ligne.cabinet_id : null,
          coproprieteId: typeof ligne.copropriete_id === 'string' ? ligne.copropriete_id : null,
          details: { diffusion: id, mode: 'filet', lots: bilan.lots },
        })
      }
      if (bilan.arret) logger.warn(`${CONTEXTE} filet de reprise : envoi arrêté`, { diffusionId: id, arret: bilan.arret, lots: bilan.lots })
    }
    await purgerDiffusionsSiBesoinQr()
    return NextResponse.json({ diffusions, lots })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} filet de reprise de la diffusion`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
