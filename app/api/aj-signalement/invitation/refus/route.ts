// app/api/aj-signalement/invitation/refus/route.ts
//
// POST (P2-R3b, PUBLIQUE, PR 2) — « Ce n'est pas moi » depuis un lien d'accès : le destinataire d'une adresse erronée
// se reconnaît et refuse. Même relecture que P2-R2, puis signalements_qr_contester_adresse (corps élargi de la 20261112) :
// la fiche est FIGÉE (aucun e-mail, aucun nouvel envoi, tous ses liens caducs), pas désactivée ; aucun compte n'est créé.
// Le super admin est alerté sans nom ni adresse (lien vers la fiche) ; l'échec de l'alerte n'annule pas la contestation.
// 5 par minute et par adresse IP. Sans la migration 20261112 : 503 base_absente.

import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { jetonLienQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { reponseErreur, reponseInvalide } from '@/lib/aj-signalement/serveur'
import { contesterLienAccesQr, relireLienAccesQr } from '@/lib/aj-signalement/serveur-acces'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_invitation_refus_${ip}`, 5, 60_000))) return rateLimitResponse()
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(jetonLienQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)

    const lien = await relireLienAccesQr(validation.data.token, validation.data.cabinet)
    if (!lien.ok) return reponseErreur(lien.code, lien.status)
    const reponse = await contesterLienAccesQr(lien)
    return NextResponse.json(reponse.corps, { status: reponse.status })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] contestation d’un accès', { message: e instanceof Error ? e.name : 'inconnue' })
    return reponseErreur('serveur', 500)
  }
}
