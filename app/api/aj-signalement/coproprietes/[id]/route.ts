// app/api/aj-signalement/coproprietes/[id]/route.ts
//
// PATCH — modification d'une copropriété QR (tableau de bord, super admin) : nom, adresse, e-mails
// destinataires, activation (un QR code désactivé répond 404 à qui le scanne, l'historique reste), ou
// nouveau jeton (regenererJeton : l'ancien QR code imprimé ne répond plus).

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { modificationCoproprieteQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import {
  COLONNES_COPROPRIETE_QR, TABLE_COPROPRIETES_QR, compterSignalementsQr, controlerSuperAdmin, coproprieteDepuisLigne, estUuid,
  genererJetonQr, reponseErreur, reponseErreurBase, type LigneCoproprieteQr,
} from '@/lib/aj-signalement/serveur'

const CONTEXTE = '[AJ SIGNALEMENT]'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_copropriete_patch_${ip}`, 30, 60_000))) return rateLimitResponse()
    const controle = await controlerSuperAdmin(request)
    if (!controle.ok) return controle.reponse

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(modificationCoproprieteQrSchema, body)
    if (!validation.success) return NextResponse.json({ error: 'invalide', details: validation.error }, { status: 400 })
    const m = validation.data

    const modification: Record<string, unknown> = {}
    if (m.nom !== undefined) modification.nom = m.nom
    if (m.adresse !== undefined) modification.adresse = m.adresse
    if (m.emailsDestinataires !== undefined) modification.emails_destinataires = m.emailsDestinataires.map((e) => e.trim().toLowerCase())
    if (m.actif !== undefined) modification.actif = m.actif
    if (m.regenererJeton) modification.jeton = genererJetonQr()
    if (Object.keys(modification).length === 0) return NextResponse.json({ error: 'invalide', details: 'aucune modification' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from(TABLE_COPROPRIETES_QR)
      .update(modification)
      .eq('id', id)
      .select(COLONNES_COPROPRIETE_QR)
      .maybeSingle()
    if (error) {
      logger.error(`${CONTEXTE} modification de copropriété refusée`, { code: error.code, message: error.message, copropriete: id })
      return reponseErreurBase(error)
    }
    if (!data) return reponseErreur('introuvable', 404)
    const compteurs = await compterSignalementsQr(id)
    return NextResponse.json({ copropriete: coproprieteDepuisLigne(data as LigneCoproprieteQr, compteurs) })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} modification de copropriété`, { message: e instanceof Error ? e.message : String(e) }, e)
    return reponseErreur('serveur', 500)
  }
}
