// app/api/aj-signalement/cabinets/[id]/rattachement/route.ts
//
// POST (P1-R23) — rattachement de copropriétés SANS cabinet à un cabinet client (super admin), par
// signalements_qr_rattacher_coproprietes : toutes ou aucune, sous le verrou de création du cabinet, journal
// copropriete.rattachee. Définitif (trigger : changer de cabinet changerait l'adresse des QR codes imprimés) : une
// copropriété déjà rattachée → 409 a_reverifier ; immatriculation ou référence déjà prise dans le cabinet → 409 doublon.
// Doublons (RG-08, SPEC § 1.6, relecture 9) : chaque copropriété est comparée à TOUTES celles du cabinet et aux autres
// du lot, AVANT l'appel → 409 doublon { doublon } ; un doublon probable passe avec confirmerDoublonProbable, un doublon
// nom + code postal avec forcerDoublon (journalisé doublon.force par la fonction) ; immatriculation ou référence :
// jamais. La fonction refait le contrôle nom + code postal sous le verrou (clés des noms calculées ici : cle_nom est NULL
// pour les anciennes copropriétés ; une clé manquante est refusée, 409 a_reverifier). Seules les copropriétés demandées
// sont lues dans le groupe « sans cabinet », celles du cabinet le sont toutes, par pages de 1 000 (essai PGlite du 11/11,
// D5 : max-rows de PostgREST). Réponse { rattachees }. Les QR codes déjà imprimés (/fr/signalement/<jeton>/) continuent
// de marcher (redirection vers le chemin du cabinet).

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { rattachementQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { cleNomCoproQr, decisionDoublonsQr, doublonsCoproprieteQr } from '@/lib/aj-signalement/doublons'
import {
  controlerAccesQr, estUuid, lireCabinetQr, lireCoproprietesDoublonsQr, reponseErreur, reponseErreurSqlQr, reponseInvalide,
} from '@/lib/aj-signalement/serveur'
import type { CoproprieteDoublonQr } from '@/lib/aj-signalement/types'

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
    const s = validation.data

    const cabinet = await lireCabinetQr({ id })
    if (!cabinet.ok) return reponseErreurSqlQr(cabinet.erreur, 'lecture du cabinet', { cabinet: id })
    if (!cabinet.cabinet) return reponseErreur('introuvable', 404)

    const [sansCabinet, duCabinet] = await Promise.all([lireCoproprietesDoublonsQr(null, { ids: s.coproprieteIds }), lireCoproprietesDoublonsQr(id)])
    if (!sansCabinet.ok) return reponseErreurSqlQr(sansCabinet.erreur, 'lecture des copropriétés sans cabinet', { cabinet: id })
    if (!duCabinet.ok) return reponseErreurSqlQr(duCabinet.erreur, 'lecture des copropriétés du cabinet', { cabinet: id })
    const demandees = new Set(s.coproprieteIds)
    // Une copropriété demandée mais absente du groupe « sans cabinet » : la fonction répond a_reverifier (définitif).
    const aRattacher = sansCabinet.coproprietes.filter((c) => demandees.has(c.id))
    const comparees: CoproprieteDoublonQr[] = [...duCabinet.coproprietes]
    let doublonForce = false
    for (const c of aRattacher) {
      const decision = decisionDoublonsQr(doublonsCoproprieteQr(c, comparees), {
        profil: 'super_admin', forcerDoublon: s.forcerDoublon, confirmerDoublonProbable: s.confirmerDoublonProbable,
      })
      if (!decision.ok) {
        const { certitude, critere, copropriete } = decision.doublon
        return NextResponse.json({ error: 'doublon', doublon: { certitude, critere, copropriete } }, { status: 409 })
      }
      doublonForce ||= decision.doublonForce
      comparees.push(c)
    }

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_rattacher_coproprietes', {
      p_cabinet: id, p_coproprietes: s.coproprieteIds, p_acteur: controle.user.id,
      p_cles_nom: Object.fromEntries(aRattacher.map((c) => [c.id, cleNomCoproQr(c.nom)])), p_forcer_doublon: doublonForce,
    })
    if (error) return reponseErreurSqlQr(error, 'rattachement de copropriétés', { cabinet: id })
    const n = (data as { rattachees?: unknown } | null)?.rattachees
    return NextResponse.json({ rattachees: typeof n === 'number' ? n : Number(n) || 0 })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] rattachement de copropriétés', { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
