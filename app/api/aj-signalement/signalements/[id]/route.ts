// app/api/aj-signalement/signalements/[id]/route.ts
//
// PATCH — statut d'un signalement QR (espace AJ Signalement, super admin ; gestionnaires de sa portée en PR 2), P1-R7 :
// en_attente, acceptee, en_cours, terminee, annulee. La copropriété du signalement est lue AVANT l'écriture, et la mise
// à jour est conditionnée par elle (correctif d'IDOR pour la PR 2) et, si l'écran l'envoie, par le statut attendu
// (statutAttendu : sinon 409 conflit_statut). Trace statut_modifie_le / _par / _profil et journal { de, vers }. Le corps
// actuel { statut } seul reste accepté et la réponse garde misAJourLe (lu par changerStatutSignalementQr). Colonnes
// statut_modifie_* absentes (migration du 11/11/2026 non appliquée) : écriture rejouée sans elles.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { statutSignalementQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import {
  TABLE_SIGNALEMENTS_QR, cabinetDeCoproprieteQr, colonneInconnue, controlerAccesQr, estUuid, journaliserQr, journaliserRepliGestionQr,
  reponseErreur, reponseErreurSqlQr, reponseInvalide,
} from '@/lib/aj-signalement/serveur'

const CONTEXTE = '[AJ SIGNALEMENT]'

interface LigneStatutQr { id: string; copropriete_id: string; statut: string | null }
interface LigneStatutEcritQr { id: string; statut: string; updated_at: string | null; statut_modifie_le?: string | null }

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_signalement_patch_${ip}`, 60, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_signalement_patch_${controle.user.id}`, 120, 600_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(statutSignalementQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const { statut, statutAttendu } = validation.data

    const lu = await supabaseAdmin.from(TABLE_SIGNALEMENTS_QR).select('id, copropriete_id, statut').eq('id', id).maybeSingle()
    if (lu.error) return reponseErreurSqlQr(lu.error, 'lecture du signalement', { signalement: id })
    const avant = (lu.data as LigneStatutQr | null) ?? null
    if (!avant) return reponseErreur('introuvable', 404)

    const ecrire = (valeurs: Record<string, unknown>, colonnes: string) => {
      let q = supabaseAdmin.from(TABLE_SIGNALEMENTS_QR).update(valeurs).eq('id', id).eq('copropriete_id', avant.copropriete_id)
      if (statutAttendu) q = q.eq('statut', statutAttendu)
      return q.select(colonnes).maybeSingle()
    }
    let r = await ecrire(
      { statut, statut_modifie_le: new Date().toISOString(), statut_modifie_par: controle.user.id, statut_modifie_profil: 'super_admin' },
      'id, statut, updated_at, statut_modifie_le',
    )
    if (colonneInconnue(r.error)) {
      journaliserRepliGestionQr('trace du statut', r.error)
      r = await ecrire({ statut }, 'id, statut, updated_at')
    }
    if (r.error) return reponseErreurSqlQr(r.error, 'changement de statut', { signalement: id })
    const ecrit = (r.data as unknown as LigneStatutEcritQr | null) ?? null
    if (!ecrit) return reponseErreur(statutAttendu ? 'conflit_statut' : 'introuvable', statutAttendu ? 409 : 404)

    await journaliserQr({
      action: 'signalement.statut', cabinetId: await cabinetDeCoproprieteQr(avant.copropriete_id), acteurId: controle.user.id,
      coproprieteId: avant.copropriete_id, signalementId: id, details: { de: avant.statut ?? 'en_attente', vers: statut },
    })
    return NextResponse.json({
      signalement: { id: ecrit.id, statut: ecrit.statut, misAJourLe: ecrit.updated_at, statutModifieLe: ecrit.statut_modifie_le ?? null },
    })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} statut`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
