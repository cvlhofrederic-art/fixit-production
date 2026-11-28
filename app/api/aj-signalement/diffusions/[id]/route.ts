// app/api/aj-signalement/diffusions/[id]/route.ts
//
// GET (D-R6, cahier PR 3 § 4.1, § 7.3) — détail d'une diffusion : objet, texte complet, périmètre écrit dans l'e-mail,
// auteur (jamais un nom), instruction écrite du cabinet (super admin seulement), date de la copie au cabinet et nombres
// par état (agrégés en base depuis les destinataires). AUCUNE adresse : ni celle d'un déclarant, ni le contact,
// l'expéditeur ou la politique figés. Diffusion inconnue (ou purgée) → 404.
// Super admin, et gestionnaire (H11) sur une diffusion d'une copropriété de SON cabinet qui lui est attribuée NOMMÉMENT,
// contrôlé par la copropriété DE LA DIFFUSION avant toute autre lecture : hors portée → 404 (comme une diffusion
// inconnue), « à tous » → 403 lecture_seule. Vue d'un gestionnaire minimisée (RG-23) : auteur « vous » / « collegue » /
// « cabinet », instruction écrite non rendue. Migration 20261113 absente → 503 base_absente. Jamais en cache.

import { type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { detailDiffusionDepuisLigneQr } from '@/lib/aj-signalement/diffusion-formes'
import { controlerAccesQr, estUuid, reponseErreur, reponseErreurDiffusionQr, reponsePriveeQr } from '@/lib/aj-signalement/serveur'
import {
  PROFILS_DIFFUSION_QR, controlerDroitSurDiffusionQr, lireDiffusionQr, nombresDiffusionQr, vueDiffusionDuProfilQr,
} from '@/lib/aj-signalement/serveur-diffusion'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_diffusion_detail_ip_${ip}`, 60, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: PROFILS_DIFFUSION_QR })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_diffusion_detail_${controle.user.id}`, 60, 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const lecture = await lireDiffusionQr(id)
    if (!lecture.ok) return reponseErreurDiffusionQr(lecture.erreur, 'détail d’une diffusion', { diffusion: id })
    if (!lecture.valeur) return reponseErreur('introuvable', 404)
    const droit = await controlerDroitSurDiffusionQr(controle.profil, lecture.valeur)
    if (!droit.ok) return droit.reponse
    const nombres = await nombresDiffusionQr(id)
    if (!nombres.ok) return reponseErreurDiffusionQr(nombres.erreur, 'détail d’une diffusion', { diffusion: id })
    return reponsePriveeQr({ diffusion: detailDiffusionDepuisLigneQr(lecture.valeur, nombres.valeur, vueDiffusionDuProfilQr(controle.profil)) })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] détail d’une diffusion', { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
