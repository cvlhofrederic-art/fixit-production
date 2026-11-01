import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { lireProfilArtisan, verifierInscriptionArtisan } from '@/lib/inscription-artisan'
import { seedDefaultMotifs } from '@/lib/seed-motifs'
import { validateBody, motifsArtisanSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

// ════════════════════════════════════════════════════════════════════════════
// POST /api/pro/register/motifs-artisan
// Motifs par défaut d'un artisan qui s'inscrit, appelée par le formulaire
// artisan (app/(commun)/pro/register) après /api/auth/create-profile. Route sœur de
// /api/pro/register/finalize-artisan.
//
// Quand la confirmation d'e-mail est active, supabase.auth.signUp ne renvoie
// pas de session : /api/seed-motifs, qui exige un Bearer, refusait la requête
// et l'artisan démarrait sans motif. Même garde que finalize-artisan (compte
// de moins de 10 minutes, rôle artisan lu dans app_metadata).
//
// JSON : { user_id }. Métiers lus dans le profil (colonne categories écrite
// par create-profile), jamais dans la requête. Rien n'est inséré si l'artisan
// a déjà des motifs.
// ════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`artisan_register_motifs_${ip}`, 5, 600_000))) return rateLimitResponse()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }
  const v = validateBody(motifsArtisanSchema, body)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  const { user_id: userId } = v.data

  try {
    const inscription = await verifierInscriptionArtisan(userId)
    if (!inscription.ok) return inscription.reponse

    const lecture = await lireProfilArtisan(userId, 'artisan-register-motifs')
    if (!lecture.ok) return lecture.reponse
    const { profil } = lecture

    const categories = Array.isArray(profil.categories)
      ? profil.categories.filter((c): c is string => typeof c === 'string')
      : []
    const resultat = await seedDefaultMotifs(profil.id, categories)
    return NextResponse.json(resultat, { status: 'error' in resultat ? 500 : 200 })
  } catch (err: unknown) {
    logger.error('[artisan-register-motifs] exception:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
