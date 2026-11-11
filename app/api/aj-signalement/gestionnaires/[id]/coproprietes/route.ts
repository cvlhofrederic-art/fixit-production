// app/api/aj-signalement/gestionnaires/[id]/coproprietes/route.ts
//
// PUT (P1-R13) — copropriétés attribuées à un gestionnaire, depuis sa page profil (super admin) : ensemble complet de
// ses attributions explicites, par signalements_qr_attribuer_au_gestionnaire (copropriétés du MÊME cabinet seulement,
// sinon 409 a_reverifier ; son adresse quitte les adresses saisies des copropriétés qu'il perd, RG-06 bis-2).

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { attributionsGestionnaireQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { controlerAccesQr, estUuid, reponseErreur, reponseErreurSqlQr, reponseInvalide } from '@/lib/aj-signalement/serveur'
import { lireFicheQr } from '@/lib/aj-signalement/serveur-gestion'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_attributions_gestionnaire_${ip}`, 60, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_attributions_gestionnaire_${controle.user.id}`, 60, 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(attributionsGestionnaireQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)

    const fiche = await lireFicheQr(id)
    if (!fiche.ok) return reponseErreurSqlQr(fiche.erreur, 'lecture du gestionnaire', { gestionnaire: id })
    if (!fiche.valeur) return reponseErreur('introuvable', 404)

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_attribuer_au_gestionnaire', {
      p_gestionnaire: id, p_coproprietes: validation.data.coproprieteIds, p_acteur: controle.user.id,
    })
    if (error) return reponseErreurSqlQr(error, 'attributions d’un gestionnaire', { gestionnaire: id })
    const r = (data ?? {}) as { coproprietes?: unknown; adressesRetirees?: unknown }
    return NextResponse.json({
      coproprietes: Array.isArray(r.coproprietes) ? r.coproprietes.filter((c): c is string => typeof c === 'string') : [],
      adressesRetirees: typeof r.adressesRetirees === 'number' ? r.adressesRetirees : 0,
    })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] attributions d’un gestionnaire', { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
