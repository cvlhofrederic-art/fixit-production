// app/api/aj-signalement/confirmation/lecture/route.ts
//
// POST (P1-R16, PUBLIQUE) — lecture d'un lien de confirmation d'adresse, SANS AUCUN EFFET (un antivirus ou un scanner
// qui ouvre le lien ne confirme rien) : la page vitfix.io/<identifiant>/confirmation-adresse/#<jeton> envoie
// { token, cabinet: <identifiant du chemin> } et affiche « <Marie M.>, gestionnaire chez <cabinet> — adresse ma***@… ».
// Lien mal formé, signature fausse, autre espace, envoi d'accès, fiche désactivée ou contestée, cabinet du chemin ≠
// cabinet de la fiche : le même 404 générique ; expiré 410 ; déjà confirmé 409. 20 par minute et par adresse IP.

import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { jetonLienQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { masquerEmail } from '@/lib/equipe/invitation-serveur'
import { nomCourtQr } from '@/lib/aj-signalement/gestionnaires'
import { reponseErreur, reponseInvalide, reponsePriveeQr } from '@/lib/aj-signalement/serveur'
import { relireLienConfirmationQr } from '@/lib/aj-signalement/serveur-gestion'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_confirmation_lecture_${ip}`, 20, 60_000))) return rateLimitResponse()
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(jetonLienQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)

    const lien = await relireLienConfirmationQr(validation.data.token, validation.data.cabinet)
    if (!lien.ok) return reponseErreur(lien.code, lien.status)
    return reponsePriveeQr({ nomCourt: nomCourtQr(lien.fiche.nom), cabinet: lien.cabinet.nom, email: masquerEmail(lien.fiche.email) })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] lecture d’un lien de confirmation', { message: e instanceof Error ? e.name : 'inconnue' })
    return NextResponse.json({ error: 'serveur' }, { status: 500 })
  }
}
