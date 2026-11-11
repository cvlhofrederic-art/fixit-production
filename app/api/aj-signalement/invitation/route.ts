// app/api/aj-signalement/invitation/route.ts
//
// POST (P2-R3, PUBLIQUE, PR 2) — acceptation de l'accès d'un gestionnaire : { token, cabinet, password, politiqueLue:
// true }. Mot de passe : règle de « mot de passe oublié » (motDePasseConforme), contrôlée AVANT tout appel ; case
// obligatoire. Même relecture que P2-R2, puis création du compte professionnel (rôle gestionnaire_signalement et repère
// de routage fixés par le serveur, adresse confirmée : le lien prouve la boîte) ou rattachement d'un compte qui porte
// déjà ce rôle ; tout autre compte existant : refus neutre 409 compte_autre_espace (jamais converti, envoi refusé,
// super admin prévenu). Contrôle après coup : 200 { acces: 'ouvert' } ou 207 liaison_incomplete. Aucune session n'est
// ouverte : le gestionnaire se connecte ensuite sur vitfix.io/<identifiant>/connexion/. Limites : 5 par minute et par
// IP, 10 par heure et par lien (empreinte du jeton). Sans la migration 20261112 : 503 base_absente, aucun compte créé.

import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { invitationGestionnaireQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { reponseErreur, reponseInvalide, reponsePriveeQr } from '@/lib/aj-signalement/serveur'
import { accepterAccesQr, empreinteJetonQr, relireLienAccesQr } from '@/lib/aj-signalement/serveur-acces'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_invitation_post_${ip}`, 5, 60_000))) return rateLimitResponse()
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(invitationGestionnaireQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const { token, cabinet, password } = validation.data
    if (!(await checkRateLimit(`qr_invitation_jeton_${await empreinteJetonQr(token)}`, 10, 3_600_000))) return rateLimitResponse()

    const lien = await relireLienAccesQr(token, cabinet)
    if (!lien.ok) return reponseErreur(lien.code, lien.status)
    const reponse = await accepterAccesQr(lien, password)
    return reponsePriveeQr(reponse.corps, reponse.status)
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] acceptation d’un accès', { message: e instanceof Error ? e.name : 'inconnue' })
    return NextResponse.json({ error: 'serveur' }, { status: 500 })
  }
}
