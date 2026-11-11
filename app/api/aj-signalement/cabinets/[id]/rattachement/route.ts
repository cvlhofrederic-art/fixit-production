// app/api/aj-signalement/cabinets/[id]/rattachement/route.ts
//
// POST (P1-R23) — rattachement de copropriétés SANS cabinet à un cabinet client (super admin), par
// signalements_qr_rattacher_coproprietes : toutes ou aucune, sous le verrou de création du cabinet, journal
// copropriete.rattachee. Définitif (trigger : changer de cabinet changerait l'adresse des QR codes imprimés) : une
// copropriété déjà rattachée → 409 a_reverifier ; immatriculation ou référence déjà prise dans le cabinet → 409 doublon.
// Réponse { rattachees }. Les QR codes déjà imprimés (/fr/signalement/<jeton>/) continuent de marcher (redirection
// vers le chemin du cabinet, lot suivant).

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { rattachementQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { controlerAccesQr, estUuid, lireCabinetQr, reponseErreur, reponseErreurSqlQr, reponseInvalide } from '@/lib/aj-signalement/serveur'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_rattachement_${ip}`, 20, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_rattachement_${controle.user.id}`, 20, 3_600_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(rattachementQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)

    const cabinet = await lireCabinetQr({ id })
    if (!cabinet.ok) return reponseErreurSqlQr(cabinet.erreur, 'lecture du cabinet', { cabinet: id })
    if (!cabinet.cabinet) return reponseErreur('introuvable', 404)

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_rattacher_coproprietes', {
      p_cabinet: id, p_coproprietes: validation.data.coproprieteIds, p_acteur: controle.user.id,
    })
    if (error) return reponseErreurSqlQr(error, 'rattachement de copropriétés', { cabinet: id })
    const n = (data as { rattachees?: unknown } | null)?.rattachees
    return NextResponse.json({ rattachees: typeof n === 'number' ? n : Number(n) || 0 })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] rattachement de copropriétés', { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
