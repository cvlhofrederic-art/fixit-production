// app/api/aj-signalement/cabinets/route.ts
//
// Cabinets clients d'AJ Signalement (demandes de Hugo du 10/11/2026 : le premier client n'est qu'un cabinet parmi
// d'autres ; chacun a son nom, son chemin public vitfix.io/<identifiant>/…, sa langue et les domaines e-mail de ses
// gestionnaires, saisis par le super admin dans l'espace, JAMAIS dans le code ni une migration).
// GET (P1-R21) — liste triée par nom : domaines, compteurs, identifiant figé (dès une copropriété ou un gestionnaire :
//   QR codes imprimés et liens envoyés ne doivent plus changer). Jamais en cache.
// POST (P1-R21) — création, par signalements_qr_enregistrer_cabinet (journal cabinet.cree / cabinet.domaines_modifies) :
//   identifiant hors format ou réservé (routes du site) → 400 ; pris → 409 identifiant_pris ; domaine d'un autre
//   cabinet → 409 domaine_pris ; messagerie publique (gmail.com…) → 400. p_acteur = la session, jamais le corps.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { cabinetQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { controlerAccesQr, reponseErreur, reponseErreurSqlQr, reponseInvalide, reponsePriveeQr } from '@/lib/aj-signalement/serveur'
import { lireCabinetsCompletsQr } from '@/lib/aj-signalement/serveur-gestion'

const CONTEXTE = '[AJ SIGNALEMENT]'

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_cabinets_${ip}`, 60, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_cabinets_${controle.user.id}`, 60, 60_000))) return rateLimitResponse()

    const lecture = await lireCabinetsCompletsQr()
    if (!lecture.ok) return reponseErreurSqlQr(lecture.erreur, 'lecture des cabinets')
    return reponsePriveeQr({ cabinets: lecture.valeur })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} liste des cabinets`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_cabinet_post_${ip}`, 10, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_cabinet_post_${controle.user.id}`, 10, 3_600_000))) return rateLimitResponse()

    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(cabinetQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const s = validation.data

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_enregistrer_cabinet', {
      p_id: null, p_nom: s.nom, p_identifiant: s.identifiant, p_langue: s.langue, p_domaines: s.domaines, p_acteur: controle.user.id,
    })
    if (error) return reponseErreurSqlQr(error, 'création d’un cabinet')
    const id = (data as { id?: unknown } | null)?.id
    if (typeof id !== 'string') return reponseErreur('a_reverifier', 409)
    const lecture = await lireCabinetsCompletsQr([id])
    if (!lecture.ok) return reponseErreurSqlQr(lecture.erreur, 'relecture du cabinet', { cabinet: id })
    const cabinet = lecture.valeur[0]
    if (!cabinet) return reponseErreur('a_reverifier', 409)
    return NextResponse.json({ cabinet }, { status: 201 })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} création d’un cabinet`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
