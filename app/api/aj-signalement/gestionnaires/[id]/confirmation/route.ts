// app/api/aj-signalement/gestionnaires/[id]/confirmation/route.ts
//
// POST (P1-R12) — renvoi du lien de confirmation d'adresse à un gestionnaire (super admin). Fiche active, adresse non
// confirmée (sinon 409 deja_confirmee) et NON contestée (sinon 409 adresse_contestee : créez une fiche avec la bonne
// adresse, puis faites le départ de celle-ci en lui donnant la nouvelle pour successeur). Les envois précédents non
// acceptés perdent leur jeton (un renvoi rend les liens précédents introuvables), puis un nouvel envoi signé est inséré
// et l'e-mail part. Limites : 20 par heure et par compte, 3 par heure et par fiche.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { nouvelleInvitation } from '@/lib/equipe/lien-invitation'
import {
  TABLE_INVITATIONS_QR, controlerAccesQr, estUuid, lireCabinetQr, reponseErreur, reponseErreurSqlQr,
} from '@/lib/aj-signalement/serveur'
import { envoyerLienConfirmationQr, lireFicheQr } from '@/lib/aj-signalement/serveur-gestion'

const CONTEXTE = '[AJ SIGNALEMENT]'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_confirmation_renvoi_${ip}`, 20, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_confirmation_renvoi_${controle.user.id}`, 20, 3_600_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    if (!(await checkRateLimit(`qr_confirmation_fiche_${id}`, 3, 3_600_000))) return rateLimitResponse()

    const lue = await lireFicheQr(id)
    if (!lue.ok) return reponseErreurSqlQr(lue.erreur, 'lecture du gestionnaire', { gestionnaire: id })
    const fiche = lue.valeur
    if (!fiche) return reponseErreur('introuvable', 404)
    if (fiche.actif !== true || !fiche.email) return reponseErreur('a_reverifier', 409)
    if (fiche.adresse_contestee_le) return reponseErreur('adresse_contestee', 409)
    if (fiche.adresse_confirmee_le) return reponseErreur('deja_confirmee', 409)

    const cabinet = await lireCabinetQr({ id: fiche.cabinet_id })
    if (!cabinet.ok) return reponseErreurSqlQr(cabinet.erreur, 'lecture du cabinet', { gestionnaire: id })
    if (!cabinet.cabinet) return reponseErreur('a_reverifier', 409)

    // Signature d'abord (échoue sans clé, avant toute écriture), puis anciens liens caducs, puis nouvel envoi.
    const invitation = await nouvelleInvitation('aj_signalement', fiche.email, fiche.id)
    const caducs = await supabaseAdmin.from(TABLE_INVITATIONS_QR).update({ invite_token: null })
      .eq('gestionnaire_id', id).is('accepted_at', null).not('invite_token', 'is', null)
    if (caducs.error) return reponseErreurSqlQr(caducs.error, 'renvoi : anciens liens', { gestionnaire: id })
    const envoi = await supabaseAdmin.from(TABLE_INVITATIONS_QR).insert({
      id: invitation.id, gestionnaire_id: id, objet: 'confirmation_adresse', email: fiche.email, full_name: fiche.nom,
      invite_token: invitation.invite_token, envoye_par: controle.user.id,
    })
    if (envoi.error) return reponseErreurSqlQr(envoi.error, 'renvoi : nouvel envoi', { gestionnaire: id })

    const emailEnvoye = await envoyerLienConfirmationQr({
      envoiId: invitation.id, jetonLien: invitation.jetonLien, email: fiche.email, nom: fiche.nom, gestionnaireId: id,
      cabinet: { id: cabinet.cabinet.id, nom: cabinet.cabinet.nom ?? '', identifiant: cabinet.cabinet.identifiant ?? '' }, acteurId: controle.user.id,
    })
    return NextResponse.json({ emailEnvoye })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} renvoi du lien de confirmation`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
