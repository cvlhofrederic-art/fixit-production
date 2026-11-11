// app/api/aj-signalement/tableau/route.ts
//
// GET — tableau de bord « AJ Signalement » (super admin) : les copropriétés dotées d'un QR code, avec leurs compteurs
// et leurs champs de gestion (cabinet, gestionnaires, « à tous »…), et les signalements reçus les plus récents
// (coordonnées complètes des déclarants). Enveloppe { tableau: { coproprietes, signalements } } conservée (lue par
// chargerTableauQr) ; champs seulement ajoutés (P1-R1, 11/11/2026).
//   ?cabinet=<id>       : les copropriétés de ce cabinet client ;
//   ?gestionnaire=<id>  : la page de suivi de ce gestionnaire, vue par le super admin (sa portée : attributions ∪
//                         « à tous » de son cabinet), 100 signalements au plus ; fiche inconnue → 404.
// Espace AJ Signalement (/fr/aj-signalement/, cookies de session ; jeton Bearer accepté). 401 sans session · 403 pour
// tout autre compte (« vue en tant que » comprise) · 400 paramètre inconnu · 503 base_absente.

import { type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { tableauQrQuerySchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { controlerAccesQr, lireTableauQr, parametresQr, reponseErreur, reponseInvalide, reponsePriveeQr } from '@/lib/aj-signalement/serveur'

const STATUTS_LECTURE = { base_absente: 503, introuvable: 404, serveur: 500 } as const

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_tableau_${ip}`, 60, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_tableau_${controle.user.id}`, 60, 60_000))) return rateLimitResponse()

    const validation = validateBody(tableauQrQuerySchema, parametresQr(request))
    if (!validation.success) return reponseInvalide(validation.error)

    const lecture = await lireTableauQr(validation.data)
    if (!lecture.ok) return reponseErreur(lecture.code, STATUTS_LECTURE[lecture.code])
    return reponsePriveeQr({ tableau: lecture.tableau })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] tableau', { message: e instanceof Error ? e.message : String(e) }, e)
    return reponseErreur('serveur', 500)
  }
}
