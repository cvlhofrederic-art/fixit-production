import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { resoudreCoproprietaire, statutHttpAcces } from '@/lib/coproprietaire/acces'
import { lireEspaceCopro } from '@/lib/coproprietaire/lecture'

// ── GET /api/coproprietaire/espace ───────────────────────────────────────────
// Tout l'espace du copropriétaire connecté (jeton Bearer) en un appel : profil et lot, immeuble,
// syndic, demandes et travaux, charges et factures, documents, assemblées et votes, annonces.
// Service role → la fiche est d'abord résolue (lib/coproprietaire/acces.ts), puis l'espace est lu
// et filtré sur SON cabinet et SON immeuble (lib/coproprietaire/lecture.ts, filtrage.ts). Une table
// en échec (ou absente : migration non appliquée) est journalisée et rendue vide : le reste de
// l'espace s'affiche. Jamais de cache.
//   ?lot=<id syndic_coproprios>   lot affiché (compte à plusieurs lots)
//   ?email=<e-mail>               super admin seulement : fiche de son cabinet à afficher

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`copro_espace_${ip}`, 60, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  const parametres = request.nextUrl.searchParams
  const acces = await resoudreCoproprietaire(user, supabaseAdmin, {
    coproprioId: parametres.get('lot'),
    email: parametres.get('email'),
  })
  if (!acces.ok) return NextResponse.json({ error: acces.code }, { status: statutHttpAcces(acces.code) })

  try {
    const espace = await lireEspaceCopro(acces.acces, supabaseAdmin)
    const reponse = NextResponse.json({ espace })
    reponse.headers.set('Cache-Control', 'private, no-store')
    return reponse
  } catch (e) {
    logger.error('[COPRO ESPACE] exception', undefined, e)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }
}
