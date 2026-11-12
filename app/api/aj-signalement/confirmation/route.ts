// app/api/aj-signalement/confirmation/route.ts
//
// POST (P1-R17, PUBLIQUE) — « C'est moi : confirmer l'adresse ». Même relecture que P1-R16 (signature, envoi de
// confirmation sans refus, fiche active non contestée, cabinet du chemin = cabinet de la fiche), puis
// signalements_qr_confirmer_adresse, qui revérifie tout en SQL (7 jours, envoi non accepté, même adresse) : dès lors le
// gestionnaire reçoit les signalements de ses copropriétés. Le lien ne sert qu'une fois. 5 par minute et par adresse IP.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { jetonLienQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { reponseErreur, reponseErreurSqlQr, reponseInvalide } from '@/lib/aj-signalement/serveur'
import { relireLienConfirmationQr } from '@/lib/aj-signalement/serveur-gestion'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_confirmation_post_${ip}`, 5, 60_000))) return rateLimitResponse()
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(jetonLienQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)

    const lien = await relireLienConfirmationQr(validation.data.token, validation.data.cabinet)
    if (!lien.ok) return reponseErreur(lien.code, lien.status)
    const { data, error } = await supabaseAdmin.rpc('signalements_qr_confirmer_adresse', { p_invitation: lien.envoiId })
    if (error) return reponseErreurSqlQr(error, 'confirmation d’adresse', { gestionnaire: lien.fiche.id })
    // Refusée en SQL (course : lien utilisé ou contesté entre-temps) : même réponse qu'un lien introuvable.
    if (data !== true) return reponseErreur('introuvable', 404)
    return NextResponse.json({ confirmee: true })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] confirmation d’adresse', { message: e instanceof Error ? e.name : 'inconnue' })
    return reponseErreur('serveur', 500)
  }
}
