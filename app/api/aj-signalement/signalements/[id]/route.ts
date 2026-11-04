// app/api/aj-signalement/signalements/[id]/route.ts
//
// PATCH — statut d'un signalement QR (tableau de bord, super admin) : en_attente, acceptee, en_cours,
// terminee, annulee. Jeton Bearer ou cookies de session (controlerSuperAdmin).

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { statutSignalementQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { TABLE_SIGNALEMENTS_QR, controlerSuperAdmin, estUuid, reponseErreur, reponseErreurBase } from '@/lib/aj-signalement/serveur'

const CONTEXTE = '[AJ SIGNALEMENT]'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_signalement_patch_${ip}`, 60, 60_000))) return rateLimitResponse()
    const controle = await controlerSuperAdmin(request)
    if (!controle.ok) return controle.reponse

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(statutSignalementQrSchema, body)
    if (!validation.success) return NextResponse.json({ error: 'invalide', details: validation.error }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from(TABLE_SIGNALEMENTS_QR)
      .update({ statut: validation.data.statut })
      .eq('id', id)
      .select('id, statut, updated_at')
      .maybeSingle()
    if (error) {
      logger.error(`${CONTEXTE} changement de statut refusé`, { code: error.code, message: error.message, signalement: id })
      return reponseErreurBase(error)
    }
    if (!data) return reponseErreur('introuvable', 404)
    return NextResponse.json({ signalement: { id: data.id, statut: data.statut, misAJourLe: data.updated_at } })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} statut`, { message: e instanceof Error ? e.message : String(e) }, e)
    return reponseErreur('serveur', 500)
  }
}
