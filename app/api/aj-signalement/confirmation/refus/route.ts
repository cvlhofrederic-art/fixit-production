// app/api/aj-signalement/confirmation/refus/route.ts
//
// POST (P1-R17b, PUBLIQUE) — « Ce n'est pas moi ». La confirmation prouve la boîte, pas l'identité (RG-02) : le
// destinataire d'une adresse erronée se reconnaît et refuse. Même relecture que P1-R16, puis
// signalements_qr_contester_adresse : la fiche est FIGÉE (non confirmée, aucun e-mail de signalement, aucun nouvel
// envoi, tous ses liens caducs), pas désactivée (les successions restent au super admin, RG-11). Le super admin est
// alerté (un message à chaque adresse ADMIN_EMAIL, sans nom ni adresse, avec le lien vers la fiche). L'échec de
// l'alerte n'annule pas la contestation. 5 par minute et par adresse IP.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { jetonLienQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { CHEMIN_ESPACE_QR } from '@/lib/aj-signalement/acces-espace'
import { ALERTE_ADRESSE_CONTESTEE_QR, envoyerAlerteAdministrateurQr } from '@/lib/aj-signalement/email'
import { reponseErreur, reponseErreurSqlQr, reponseInvalide } from '@/lib/aj-signalement/serveur'
import { origineLiensQr, relireLienConfirmationQr } from '@/lib/aj-signalement/serveur-gestion'

const CONTEXTE = '[AJ SIGNALEMENT]'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_confirmation_refus_${ip}`, 5, 60_000))) return rateLimitResponse()
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(jetonLienQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)

    const lien = await relireLienConfirmationQr(validation.data.token, validation.data.cabinet)
    if (!lien.ok) return reponseErreur(lien.code, lien.status)
    const { data, error } = await supabaseAdmin.rpc('signalements_qr_contester_adresse', { p_invitation: lien.envoiId })
    if (error) return reponseErreurSqlQr(error, 'contestation d’adresse', { gestionnaire: lien.fiche.id })
    if (data !== true) return reponseErreur('introuvable', 404)

    // Vue « page profil » de l'espace (ancre posée par les écrans, lot 4).
    const alerte = await envoyerAlerteAdministrateurQr({
      ...ALERTE_ADRESSE_CONTESTEE_QR, lien: `${origineLiensQr()}${CHEMIN_ESPACE_QR}#gestionnaire/${lien.fiche.id}`,
    })
    if (alerte.total === 0 || alerte.refuses > 0) {
      logger.warn(`${CONTEXTE} alerte « adresse contestée » non envoyée au super admin`, { gestionnaire: lien.fiche.id, refuses: alerte.refuses, total: alerte.total })
    }
    return NextResponse.json({ contestee: true })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} contestation d’adresse`, { message: e instanceof Error ? e.name : 'inconnue' })
    return reponseErreur('serveur', 500)
  }
}
