// app/api/aj-signalement/similaires/route.ts
//
// GET ?jeton=&batiment=&zone=&langue= — signalements déjà faits au même endroit (demande de Hugo du 06/11/2026),
// montrés pendant la rédaction pour que la personne voie si c'est le même problème. Sans session : la copropriété est
// celle du jeton (QR code actif). Parties communes seulement, même bâtiment (normalisé), même zone (FR ou PT), encore
// ouverts (reçu, pris en charge, en cours) et de moins de 60 jours ; au plus 5, du plus récent au plus ancien
// (lib/aj-signalement/semblables.ts).
// La réponse ne porte aucune donnée personnelle ni aucun texte libre : numéro, type et zone (listes fixes), jour du
// dépôt à Paris (AAAA-MM-JJ, sans l'heure), statut. Ni identifiant, ni bâtiment, ni nom, ni coordonnées, ni
// description, ni heure.
// Limite : 30 recherches par minute et par adresse IP (contre le sondage bâtiment par bâtiment).
// Codes : 200 { semblables } · 400 invalide · 404 introuvable · 429 · 503 base_absente · 500 serveur.

import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { semblablesQrQuerySchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { coproprieteActiveQr, lireSemblablesQr, reponseErreur } from '@/lib/aj-signalement/serveur'
import { semblablePublicQr } from '@/lib/aj-signalement/semblables'

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_similaires_${ip}`, 30, 60_000))) return rateLimitResponse()

    const p = request.nextUrl.searchParams
    const validation = validateBody(semblablesQrQuerySchema, {
      jeton: p.get('jeton') ?? '', batiment: p.get('batiment') ?? '', zone: p.get('zone') ?? '', langue: p.get('langue') ?? undefined,
    })
    if (!validation.success) return NextResponse.json({ error: 'invalide', details: validation.error }, { status: 400 })
    const { jeton, batiment, zone, langue } = validation.data

    const active = await coproprieteActiveQr(jeton)
    if (!active.ok) return active.reponse

    const lecture = await lireSemblablesQr(active.copropriete.id, { batiment, zone })
    if (!lecture.ok) return reponseErreur(lecture.code, lecture.code === 'base_absente' ? 503 : 500)
    const reponse = NextResponse.json({ semblables: lecture.lignes.map((l) => semblablePublicQr(l, langue)) })
    reponse.headers.set('Cache-Control', 'private, no-store')
    return reponse
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] signalements semblables', { message: e instanceof Error ? e.message : String(e) }, e)
    return reponseErreur('serveur', 500)
  }
}
