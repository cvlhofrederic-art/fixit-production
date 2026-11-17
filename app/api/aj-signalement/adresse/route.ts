// app/api/aj-signalement/adresse/route.ts
//
// POST — adresse proposée d'après la position de la personne qui a scanné le QR code (demande de Hugo du 06/11/2026),
// pour une copropriété dont l'adresse n'est pas renseignée. Sans session : la copropriété est désignée par son jeton.
// Corps { jeton, latitude, longitude } validé par adresseQrSchema ; la position part dans le corps, jamais dans l'URL.
// Géocodage inverse auprès du service de l'État (lib/aj-signalement/geocodage.ts, data.geopf.fr) ; seul le libellé de
// l'adresse revient au navigateur. Rien n'est écrit en base : l'adresse proposée part ensuite avec le signalement
// (texte seul). La position n'est ni conservée, ni journalisée.
// Limites : 5 demandes par minute et par adresse IP, 30 par 10 minutes et par copropriété (QR code public).
// Codes : 200 { adresse: string | null } (null : rien trouvé, service indisponible) · 400 invalide · 404 introuvable
// (jeton inconnu ou QR code désactivé) · 409 adresse_connue (adresse déjà renseignée : la page ne demande rien) ·
// 429 · 503 base_absente · 500 serveur.

import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { adresseQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { coproprieteActiveQr, reponseErreur } from '@/lib/aj-signalement/serveur'
import { geocoderInverse } from '@/lib/aj-signalement/geocodage'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_adresse_${ip}`, 5, 60_000))) return rateLimitResponse()

    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(adresseQrSchema, body)
    if (!validation.success) return NextResponse.json({ error: 'invalide', details: validation.error }, { status: 400 })
    const { jeton, latitude, longitude } = validation.data

    const active = await coproprieteActiveQr(jeton)
    if (!active.ok) return active.reponse
    const copropriete = active.copropriete
    if (!(await checkRateLimit(`qr_adresse_copro_${copropriete.id}`, 30, 600_000))) return rateLimitResponse()
    // Adresse déjà renseignée : aucune position n'a à être traitée.
    if ((copropriete.adresse ?? '').trim()) return reponseErreur('adresse_connue', 409)

    const adresse = await geocoderInverse(latitude, longitude)
    const reponse = NextResponse.json({ adresse })
    reponse.headers.set('Cache-Control', 'private, no-store')
    return reponse
  } catch (e: unknown) {
    // Ni le corps (la position), ni le message de l'erreur, qui pourrait le citer : seulement son nom.
    logger.error('[AJ SIGNALEMENT] adresse proposée', { erreur: e instanceof Error ? e.name : 'inconnue' })
    return reponseErreur('serveur', 500)
  }
}
