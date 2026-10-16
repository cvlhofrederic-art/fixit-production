import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { lireProfilArtisan, verifierInscriptionArtisan } from '@/lib/inscription-artisan'
import { lierFilleulAuParrain } from '@/lib/referral-signup'
import { validateBody, parrainageArtisanSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

// ════════════════════════════════════════════════════════════════════════════
// POST /api/pro/register/parrainage-artisan
// Lien entre l'artisan qui s'inscrit (filleul) et son parrain, appelée par le
// formulaire artisan (app/pro/register) après /api/auth/create-profile.
// Route sœur de /api/pro/register/finalize-artisan.
//
// Quand la confirmation d'e-mail est active, supabase.auth.signUp ne renvoie
// pas de session : /api/referral/signup, qui exige un Bearer, refusait la
// requête (parrainage perdu, bandeau « Parrainé par » jamais affiché). Ici,
// même garde que finalize-artisan (compte de moins de 10 minutes, rôle
// artisan lu dans app_metadata) et l'artisan filleul est retrouvé à partir de
// user_id : impossible de désigner le profil d'un autre. Ensuite, mêmes
// contrôles que /api/referral/signup (code valide, parrain non signalé,
// anti-auto-parrainage, score de risque), dans lib/referral-signup.ts.
//
// JSON : { user_id, code }. Un filleul déjà rattaché n'est jamais rattaché à
// nouveau (un seul parrain, pas de second referral sur un nouvel appel).
// ════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`artisan_register_parrainage_${ip}`, 5, 600_000))) return rateLimitResponse()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }
  const v = validateBody(parrainageArtisanSchema, body)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  const { user_id: userId, code } = v.data

  try {
    const inscription = await verifierInscriptionArtisan(userId)
    if (!inscription.ok) return inscription.reponse

    const lecture = await lireProfilArtisan(userId, 'artisan-register-parrainage')
    if (!lecture.ok) return lecture.reponse
    const { profil } = lecture

    if (profil.referral_parrain_id) return NextResponse.json({ success: true, referral: false })

    const resultat = await lierFilleulAuParrain(code, profil.id, ip)
    return NextResponse.json({ success: true, ...resultat })
  } catch (err: unknown) {
    logger.error('[artisan-register-parrainage] exception:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
