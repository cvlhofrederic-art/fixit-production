// app/api/aj-signalement/coproprietes/[id]/signalements/[sid]/opposition/route.ts
//
// POST (D-R7, cahier PR 3 § 4.1, J31) — « Ne plus envoyer d'informations à ce déclarant (à sa demande) » : opposition à
// la diffusion enregistrée par le cabinet à la demande ÉCRITE de la personne, pour CETTE copropriété (origine
// demande_cabinet, date de réception gardée, non future → 400 sinon). Le signalement doit appartenir à la copropriété
// du chemin (lu ici, puis revérifié par signalements_qr_diffusion_opposer_signalement), sinon 404 ; les lignes en
// attente de cette adresse sont annulées dans la même transaction ; idempotente. Aucune adresse ni empreinte dans la
// réponse ou le journal. Super admin seul en PR 3 (partie gestionnaire H11 ensuite : copropriété attribuée nommément).
// 200 { enregistree: true }. Migration 20261113 absente → 503 base_absente.

import { type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { oppositionSignalementQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import {
  controlerAccesQr, estUuid, lireLigneCoproprieteQr, reponseErreur, reponseErreurDiffusionQr, reponseErreurSqlQr, reponseInvalide,
  reponsePriveeQr,
} from '@/lib/aj-signalement/serveur'
import {
  PROFILS_DIFFUSION_QR, aujourdhuiParisQr, parametresAuteurDiffusionQr, signalementDeLaCoproprieteQr,
} from '@/lib/aj-signalement/serveur-diffusion'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_diffusion_opposition_ip_${ip}`, 30, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: PROFILS_DIFFUSION_QR })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_diffusion_opposition_${controle.user.id}`, 30, 10 * 60_000))) return rateLimitResponse()

    const { id, sid } = await params
    if (!estUuid(id) || !estUuid(sid)) return reponseErreur('introuvable', 404)
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(oppositionSignalementQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const { demandeRecueLe } = validation.data
    if (demandeRecueLe > aujourdhuiParisQr()) return reponseInvalide('demandeRecueLe: date future')

    const copro = await lireLigneCoproprieteQr(id)
    if (!copro.ok) return reponseErreurSqlQr(copro.erreur, 'lecture de la copropriété', { copropriete: id })
    if (!copro.ligne) return reponseErreur('introuvable', 404)
    const lien = await signalementDeLaCoproprieteQr(sid, id)
    if (!lien.ok) return reponseErreurSqlQr(lien.erreur, 'lecture du signalement', { copropriete: id })
    if (!lien.valeur) return reponseErreur('introuvable', 404)

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_diffusion_opposer_signalement', {
      p_signalement: sid, p_copropriete: id, ...parametresAuteurDiffusionQr(controle.profil), p_demande_recue_le: demandeRecueLe,
    })
    if (error) return reponseErreurDiffusionQr(error, 'opposition à la demande du déclarant', { copropriete: id })
    if (data !== true) return reponseErreur('introuvable', 404)
    return reponsePriveeQr({ enregistree: true })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] opposition à la demande du déclarant', { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
