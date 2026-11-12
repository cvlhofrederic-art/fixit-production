// app/api/aj-signalement/cabinets/[id]/route.ts
//
// PATCH (P1-R22) — modification d'un cabinet client (super admin) : nom, identifiant, langue, domaines (liste remplacée
// en entier). Par signalements_qr_enregistrer_cabinet (paramètre absent = inchangé ; journal cabinet.modifie { champs } /
// cabinet.domaines_modifies { nombre }). Identifiant d'un cabinet qui a déjà une copropriété ou un gestionnaire →
// 409 identifiant_fige (trigger : QR codes imprimés, liens envoyés). Une fiche existante hors des nouveaux domaines
// n'est pas touchée : elle est signalée dans la réponse (fichesHorsDomaines) pour que le super admin décide.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { modificationCabinetQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { emailDansDomainesQr } from '@/lib/aj-signalement/gestionnaires'
import {
  TABLE_GESTIONNAIRES_QR, controlerAccesQr, estUuid, lireCabinetQr, reponseErreur, reponseErreurSqlQr, reponseInvalide,
} from '@/lib/aj-signalement/serveur'
import { lireCabinetsCompletsQr } from '@/lib/aj-signalement/serveur-gestion'

const CONTEXTE = '[AJ SIGNALEMENT]'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_cabinet_patch_${ip}`, 30, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_cabinet_patch_${controle.user.id}`, 30, 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(modificationCabinetQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const m = validation.data

    const existant = await lireCabinetQr({ id })
    if (!existant.ok) return reponseErreurSqlQr(existant.erreur, 'lecture du cabinet', { cabinet: id })
    if (!existant.cabinet) return reponseErreur('introuvable', 404)

    const { error } = await supabaseAdmin.rpc('signalements_qr_enregistrer_cabinet', {
      p_id: id, p_nom: m.nom ?? null, p_identifiant: m.identifiant ?? null, p_langue: m.langue ?? null, p_domaines: m.domaines ?? null,
      p_acteur: controle.user.id,
    })
    if (error) return reponseErreurSqlQr(error, 'modification d’un cabinet', { cabinet: id })

    let fichesHorsDomaines: Array<{ id: string; nom: string | null }> = []
    if (m.domaines) {
      const domaines = m.domaines
      const fiches = await supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select('id, nom, email').eq('cabinet_id', id)
      if (fiches.error) logger.warn(`${CONTEXTE} fiches du cabinet non relues`, { code: fiches.error.code, cabinet: id })
      fichesHorsDomaines = ((fiches.data ?? []) as Array<{ id: string; nom: string | null; email: string | null }>)
        .filter((f) => f.email && !emailDansDomainesQr(f.email, domaines))
        .map((f) => ({ id: f.id, nom: f.nom ?? null }))
    }
    const lecture = await lireCabinetsCompletsQr([id])
    if (!lecture.ok) return reponseErreurSqlQr(lecture.erreur, 'relecture du cabinet', { cabinet: id })
    return NextResponse.json({ cabinet: lecture.valeur[0] ?? null, fichesHorsDomaines })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} modification d’un cabinet`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
