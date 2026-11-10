// app/api/aj-signalement/tableau/route.ts
//
// GET — tableau de bord « AJ Signalement » (super admin) : toutes les copropriétés dotées d'un QR code,
// avec leurs compteurs, et les signalements reçus les plus récents (coordonnées complètes des déclarants).
// Espace AJ Signalement (/fr/aj-signalement/, cookies de session ; jeton Bearer accepté quand l'appelant en donne un).
// 401 sans session · 403 pour un autre rôle · 503 base_absente tant que la migration 20261104 n'est pas appliquée.

import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { controlerSuperAdmin, lireTableauQr, reponseErreur } from '@/lib/aj-signalement/serveur'

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_tableau_${ip}`, 60, 60_000))) return rateLimitResponse()
    const controle = await controlerSuperAdmin(request)
    if (!controle.ok) return controle.reponse

    const lecture = await lireTableauQr()
    if (!lecture.ok) return reponseErreur(lecture.code, lecture.code === 'base_absente' ? 503 : 500)
    const reponse = NextResponse.json({ tableau: lecture.tableau })
    reponse.headers.set('Cache-Control', 'private, no-store')
    return reponse
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] tableau', { message: e instanceof Error ? e.message : String(e) }, e)
    return reponseErreur('serveur', 500)
  }
}
