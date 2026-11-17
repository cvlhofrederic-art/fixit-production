// app/api/aj-signalement/logo/[identifiant]/route.ts
//
// GET — lecture PUBLIQUE du logo d'un cabinet client (demande de Hugo du 13/11/2026), sans session : pages publiques
// du cabinet (signalement par QR code, connexion, confirmation d'adresse, invitation), espace du cabinet et affiches PDF
// préparées dans le navigateur. Choix d'une route plutôt qu'une data: URL rendue dans chaque page : l'image (jusqu'à
// 200 Kio) n'alourdit ni le HTML ni les réponses JSON, elle est mise en cache par le navigateur une fois pour toutes
// (adresse versionnée), et l'affiche la relit comme une image ordinaire.
// Adresse : /api/aj-signalement/logo/<identifiant du chemin public du cabinet>/?v=<version> (cheminLogoCabinetQr) :
// aucune donnée personnelle, aucun identifiant individuel. Seul un PNG revérifié est servi (jamais de SVG) :
//   - version demandée = version en place → Cache-Control public, max-age=31536000, immutable ; sinon (absente,
//     ancienne) l'image en place, cache public de 5 minutes ; ETag = version, If-None-Match → 304 ;
//   - X-Content-Type-Options: nosniff, Content-Security-Policy « default-src 'none'; sandbox », ressource réservée au
//     site (Cross-Origin-Resource-Policy: same-origin : aucune page d'un autre site, aucun e-mail ne la charge — les
//     e-mails portent le logo en pièce jointe en ligne), jamais indexée, aucun cookie ;
//   - identifiant hors format ou réservé → 404 sans lecture ; aucun logo, cabinet inconnu, migration 20261114 absente
//     (repli journalisé une fois) ou image stockée illisible (journalisé) → 404 ; erreur de la base → 500 ; tous
//     jamais en cache. Limite de débit par adresse IP (120 par minute).
// Relecture de sécurité du 13/11/2026 : les métadonnées (version, dimensions) sont lues D'ABORD ; 404 (aucun logo) et
// 304 (If-None-Match de la version en place) se décident sur elles, sans tirer l'image de la base. L'image n'est lue,
// revérifiée et servie que pour une réponse 200. Le 304 ne revérifie pas l'image : la version est l'empreinte de son
// contenu, déjà servi (donc revérifié) au navigateur qui la présente.

import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { validerIdentifiantCabinetQr } from '@/lib/aj-signalement/chemin-cabinet'
import { lectureMetaLogoCabinetQr, lireLogoCabinetQr } from '@/lib/aj-signalement/serveur-logo'

const CONTEXTE = '[AJ SIGNALEMENT]'
const CACHE_VERSION = 'public, max-age=31536000, immutable'
const CACHE_COURT = 'public, max-age=300'

/** Réponse sans image (404, 500) : JSON court, jamais en cache. */
function sansImage(code: string, status: number): NextResponse {
  const reponse = NextResponse.json({ error: code }, { status })
  reponse.headers.set('Cache-Control', 'no-store')
  reponse.headers.set('X-Robots-Tag', 'noindex')
  return reponse
}

/** En-têtes d'une réponse image (200 ou 304). */
function entetesImage(version: string, cache: string): Headers {
  return new Headers({
    'Content-Type': 'image/png',
    'Cache-Control': cache,
    ETag: `"${version}"`,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Disposition': 'inline; filename="logo.png"',
    'X-Robots-Tag': 'noindex',
  })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ identifiant: string }> }) {
  try {
    if (!(await checkRateLimit(`qr_logo_${getClientIP(request)}`, 120, 60_000))) return rateLimitResponse()
    const { identifiant } = await params
    if (!validerIdentifiantCabinetQr(identifiant).ok) return sansImage('introuvable', 404)

    // Métadonnées seules : 404 et 304 sans l'image.
    const meta = await lectureMetaLogoCabinetQr({ identifiant })
    if (!meta.ok) return sansImage('serveur', 500)
    if (!meta.logo) return sansImage('introuvable', 404)
    const versionDemandee = request.nextUrl.searchParams.get('v')
    if (request.headers.get('if-none-match') === `"${meta.logo.version}"`) {
      return new NextResponse(null, { status: 304, headers: entetesImage(meta.logo.version, versionDemandee === meta.logo.version ? CACHE_VERSION : CACHE_COURT) })
    }

    // 200 : l'image, revérifiée (elle a pu changer entre les deux lectures : ses propres métadonnées font foi).
    const lecture = await lireLogoCabinetQr({ identifiant })
    if (!lecture.ok) return sansImage('serveur', 500)
    const logo = lecture.logo
    if (!logo) return sansImage('introuvable', 404)
    const entetes = entetesImage(logo.version, versionDemandee === logo.version ? CACHE_VERSION : CACHE_COURT)
    entetes.set('Content-Length', String(logo.png.length))
    return new NextResponse(logo.png, { status: 200, headers: entetes })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} lecture publique d’un logo`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return sansImage('serveur', 500)
  }
}
