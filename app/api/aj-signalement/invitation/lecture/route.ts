// app/api/aj-signalement/invitation/lecture/route.ts
//
// POST (P2-R2, PUBLIQUE, PR 2) — lecture d'un lien d'accès, SANS AUCUN EFFET (un antivirus ou un scanner qui ouvre le
// lien n'ouvre rien) : la page vitfix.io/<identifiant>/invitation/#<jeton> envoie { token, cabinet: <identifiant du
// chemin> } et affiche « <Marie M.>, gestionnaire chez <cabinet> — adresse ma***@… ». Lien mal formé, signature fausse,
// autre espace, lien de confirmation d'adresse, envoi refusé, fiche désactivée, contestée ou pseudonymisée, cabinet du
// chemin ≠ cabinet de la fiche : le même 404 générique ; expiré 410, déjà utilisé ou compte déjà relié 409 deja_ouvert
// (seulement sous le bon chemin). 20 par minute et par adresse IP. Sans la migration 20261112 : 503 base_absente.

import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { jetonLienQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { masquerEmail } from '@/lib/equipe/invitation-serveur'
import { nomCourtQr } from '@/lib/aj-signalement/gestionnaires'
import { reponseErreur, reponseInvalide, reponsePriveeQr } from '@/lib/aj-signalement/serveur'
import { relireLienAccesQr } from '@/lib/aj-signalement/serveur-acces'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_invitation_lecture_${ip}`, 20, 60_000))) return rateLimitResponse()
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(jetonLienQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)

    const lien = await relireLienAccesQr(validation.data.token, validation.data.cabinet)
    if (!lien.ok) return reponseErreur(lien.code, lien.status)
    return reponsePriveeQr({ nomCourt: nomCourtQr(lien.fiche.nom), cabinet: lien.cabinet.nom, email: masquerEmail(lien.fiche.email) })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] lecture d’un lien d’accès', { message: e instanceof Error ? e.name : 'inconnue' })
    return NextResponse.json({ error: 'serveur' }, { status: 500 })
  }
}
