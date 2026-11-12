// app/api/aj-signalement/diffusions/[id]/reprendre/route.ts
//
// POST (D-R4, cahier PR 3 § 4.1, § 5.5, § 9) — reprendre l'envoi d'une diffusion (l'écran l'enchaîne tant que reste > 0,
// ou « Reprendre l'envoi » dans l'historique) : jusqu'à 5 lots, chacun revérifié en base (oppositions, copropriété et
// cabinet, adresse changée ; lot interrompu rejoué à l'identique ou renuméroté). Un message d'exploitation ne part pas
// trop tard : plus de 24 h après sa création → 410 perime ; plus d'une heure → 409 a_confirmer { creeLe } tant que
// confirmeContenuAJour n'est pas envoyé (l'écran montre l'heure d'écriture). Copropriété ou cabinet qui ne permet plus
// la diffusion → lignes restantes annulées par la base, 409 diffusion_inactive. Journal diffusion.reprise (identifiant
// et énumérations seulement). Clé de signature absente → 503 configuration_incomplete. Diffusion inconnue → 404 ; partie
// gestionnaire (H11, ensuite) : hors de la portée nommée → 404. Super admin seul en PR 3.
// 200 { envoyes, refuses, reste, arret } (totaux de la diffusion). Migration 20261113 absente → 503. Jamais en cache.

import { type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { repriseDiffusionQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { cleLiensDiffusionConfigureeQr } from '@/lib/aj-signalement/diffusion-lien'
import {
  controlerAccesQr, estUuid, journaliserQr, reponseErreur, reponseErreurDiffusionQr, reponseInvalide, reponsePriveeQr,
} from '@/lib/aj-signalement/serveur'
import {
  PROFILS_DIFFUSION_QR, envoyerEtCompterDiffusionQr, lireDiffusionQr, raisonInactiveDiffusionQr,
} from '@/lib/aj-signalement/serveur-diffusion'

const CONTEXTE = '[AJ SIGNALEMENT]'
const UNE_HEURE_MS = 60 * 60 * 1000
const UN_JOUR_MS = 24 * UNE_HEURE_MS

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_diffusion_reprise_ip_${ip}`, 30, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: PROFILS_DIFFUSION_QR })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_diffusion_reprise_${controle.user.id}`, 30, 10 * 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    // Corps facultatif : vide ou absent = {}.
    const texte = await request.text().catch(() => '')
    let body: unknown = {}
    if (texte.trim() !== '') {
      try {
        body = JSON.parse(texte)
      } catch {
        return reponseInvalide('corps: JSON invalide')
      }
    }
    const validation = validateBody(repriseDiffusionQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    if (!cleLiensDiffusionConfigureeQr()) {
      logger.error(`${CONTEXTE} diffusion : clé de signature des liens absente (AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION)`, { diffusion: id })
      return reponseErreur('configuration_incomplete', 503)
    }

    const lecture = await lireDiffusionQr(id)
    if (!lecture.ok) return reponseErreurDiffusionQr(lecture.erreur, 'reprise d’une diffusion', { diffusion: id })
    if (!lecture.valeur) return reponseErreur('introuvable', 404)
    const ligne = lecture.valeur
    const creeLe = typeof ligne.created_at === 'string' ? ligne.created_at : ''
    const age = Date.now() - Date.parse(creeLe)
    if (!(age <= UN_JOUR_MS)) return reponseErreur('perime', 410)
    const confirmee = validation.data.confirmeContenuAJour === true
    if (age > UNE_HEURE_MS && !confirmee) return reponsePriveeQr({ error: 'a_confirmer', creeLe }, 409)

    const coproprieteId = typeof ligne.copropriete_id === 'string' ? ligne.copropriete_id : ''
    const raison = await raisonInactiveDiffusionQr(coproprieteId)
    if (!raison.ok) return reponseErreurDiffusionQr(raison.erreur, 'reprise d’une diffusion', { diffusion: id })
    if (raison.valeur !== null) {
      // Un lot demandé : la base annule les lignes restantes (diffusion_inactive) et ne rend rien ; rien ne part.
      await envoyerEtCompterDiffusionQr(ligne, 1)
      return reponseErreur('diffusion_inactive', 409)
    }

    await journaliserQr({
      action: 'diffusion.reprise', profil: controle.profil.type, acteurId: controle.user.id,
      acteurGestionnaireId: controle.profil.type === 'gestionnaire' ? controle.profil.gestionnaireId : null,
      cabinetId: typeof ligne.cabinet_id === 'string' ? ligne.cabinet_id : null, coproprieteId,
      details: { diffusion: id, mode: 'manuelle', confirmee },
    })
    const envoi = await envoyerEtCompterDiffusionQr(ligne)
    if (!envoi) return reponseErreur('serveur', 500)
    return reponsePriveeQr(envoi)
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} reprise d’une diffusion`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
