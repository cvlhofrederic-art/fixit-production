// app/api/aj-signalement/coproprietes/route.ts
//
// POST — nouvelle copropriété dotée d'un QR code (tableau de bord, super admin) : nom, adresse, e-mails
// destinataires ; le jeton est tiré ici (UUID sans tirets). La fiche renvoyée porte le jeton : le tableau
// de bord en dessine le QR code. Aucun lien avec les immeubles du logiciel Syndic.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { coproprieteQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import {
  COLONNES_COPROPRIETE_QR, TABLE_COPROPRIETES_QR, controlerSuperAdmin, coproprieteDepuisLigne, genererJetonQr, reponseErreur,
  reponseErreurBase, type LigneCoproprieteQr,
} from '@/lib/aj-signalement/serveur'

const CONTEXTE = '[AJ SIGNALEMENT]'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_copropriete_post_${ip}`, 20, 60_000))) return rateLimitResponse()
    const controle = await controlerSuperAdmin(request)
    if (!controle.ok) return controle.reponse

    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(coproprieteQrSchema, body)
    if (!validation.success) return NextResponse.json({ error: 'invalide', details: validation.error }, { status: 400 })
    const saisie = validation.data

    const { data, error } = await supabaseAdmin
      .from(TABLE_COPROPRIETES_QR)
      .insert({
        nom: saisie.nom,
        adresse: saisie.adresse,
        emails_destinataires: saisie.emailsDestinataires.map((e) => e.trim().toLowerCase()),
        jeton: genererJetonQr(),
        cree_par: controle.user.id,
      })
      .select(COLONNES_COPROPRIETE_QR)
      .single()
    if (error || !data) {
      logger.error(`${CONTEXTE} création de copropriété refusée`, { code: error?.code, message: error?.message })
      return reponseErreurBase(error)
    }
    return NextResponse.json({ copropriete: coproprieteDepuisLigne(data as LigneCoproprieteQr) }, { status: 201 })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} création de copropriété`, { message: e instanceof Error ? e.message : String(e) }, e)
    return reponseErreur('serveur', 500)
  }
}
