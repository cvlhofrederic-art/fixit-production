// app/api/aj-signalement/coproprietes/[id]/gestionnaires/route.ts
//
// PUT — gestionnaires d'une copropriété (P1-R6, super admin) : ensemble complet des attributions et, si fourni,
// « attribuée à tous » (copropriété de test : tous les gestionnaires actifs de SON cabinet). Par la fonction SQL
// signalements_qr_remplacer_attributions : insertion avant suppression (jamais un instant sans gestionnaire), fiches
// actives du même cabinet seulement (sinon 409 a_reverifier), copropriété sans cabinet → 409 sans_cabinet ; une fiche
// qui perd la copropriété en sort aussi des adresses saisies (RG-06 bis-2), journalisé sans valeur.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { attributionsCoproprieteQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import {
  TABLE_GESTIONNAIRES_QR, controlerAccesQr, estUuid, lireLigneCoproprieteQr, reponseErreur, reponseErreurSqlQr, reponseInvalide,
} from '@/lib/aj-signalement/serveur'

interface ResultatAttributionsQr { gestionnaires?: unknown; attribueeATous?: unknown; adressesRetirees?: unknown }

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_attributions_copro_${ip}`, 60, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_attributions_copro_${controle.user.id}`, 60, 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(attributionsCoproprieteQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)

    const copro = await lireLigneCoproprieteQr(id)
    if (!copro.ok) return reponseErreurSqlQr(copro.erreur, 'lecture de la copropriété', { copropriete: id })
    if (!copro.ligne) return reponseErreur('introuvable', 404)

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_remplacer_attributions', {
      p_copropriete: id, p_gestionnaires: validation.data.gestionnaireIds, p_tous: validation.data.attribueeATous ?? null, p_acteur: controle.user.id,
    })
    if (error) return reponseErreurSqlQr(error, 'attributions d’une copropriété', { copropriete: id })
    const r = (data ?? {}) as ResultatAttributionsQr
    const ids = Array.isArray(r.gestionnaires) ? r.gestionnaires.filter((g): g is string => typeof g === 'string') : []
    const noms = new Map<string, string | null>()
    if (ids.length > 0) {
      const fiches = await supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select('id, nom').in('id', ids)
      if (fiches.error) logger.warn('[AJ SIGNALEMENT] noms des gestionnaires non lus', { code: fiches.error.code, copropriete: id })
      for (const f of (fiches.data ?? []) as Array<{ id: string; nom: string | null }>) noms.set(f.id, f.nom ?? null)
    }
    return NextResponse.json({
      gestionnaires: ids.map((g) => ({ id: g, nom: noms.get(g) ?? null })),
      attribueeATous: r.attribueeATous === true,
      adressesRetirees: typeof r.adressesRetirees === 'number' ? r.adressesRetirees : 0,
    })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] attributions d’une copropriété', { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
