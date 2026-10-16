// ══════════════════════════════════════════════════════════════════════════════
// POST /api/referral/signup — Lie un filleul à son parrain après inscription
// Exige une session : l'inscription artisan, qui n'en a pas quand la
// confirmation d'e-mail est active, passe par /api/pro/register/parrainage-artisan.
// Vérifie anti-auto-parrainage, calcule le risk score partiel (lib/referral-signup.ts)
// ══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { validateBody, referralSignupSchema } from '@/lib/validation'
import { lierFilleulAuParrain } from '@/lib/referral-signup'

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const allowed = await checkRateLimit(`referral_signup_${ip}`, 5, 60_000)
  if (!allowed) return rateLimitResponse()

  try {
    const body = await request.json()
    const v = validateBody(referralSignupSchema, body)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const { code, artisan_id, user_id } = v.data

    // SÉCURITÉ (IDOR) : authentification + ownership obligatoires. Sans ça, n'importe
    // qui pouvait poster un artisan_id/user_id arbitraire et frauder le parrainage.
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    if (user_id !== authUser.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    const { data: ownArtisan } = await supabaseAdmin
      .from('profiles_artisan').select('id, user_id').eq('id', artisan_id).maybeSingle()
    if (!ownArtisan || ownArtisan.user_id !== authUser.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const resultat = await lierFilleulAuParrain(code, artisan_id, ip)
    return NextResponse.json({ success: true, ...resultat })
  } catch (err) {
    console.error('[referral/signup] Error:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
