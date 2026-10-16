import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { validateBody, seedMotifsSchema } from '@/lib/validation'
import { getAuthUser } from '@/lib/auth-helpers'
import { seedDefaultMotifs } from '@/lib/seed-motifs'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/seed-motifs
// Insère les motifs par défaut pour un nouvel artisan selon son métier.
// Exige une session : l'inscription artisan, qui n'en a pas quand la
// confirmation d'e-mail est active, passe par /api/pro/register/motifs-artisan.
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`seed_motifs_${ip}`, 5, 60_000))) return rateLimitResponse()

  try {
    const body = await request.json()
    const v = validateBody(seedMotifsSchema, body)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const { artisan_id, categories } = v.data

    // F02: vérifier que l'artisan appartient à l'utilisateur connecté
    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id, user_id')
      .eq('id', artisan_id)
      .single()

    if (!artisan) {
      return NextResponse.json({ error: 'Artisan non trouvé' }, { status: 404 })
    }

    if (artisan.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès interdit' }, { status: 403 })
    }

    const resultat = await seedDefaultMotifs(artisan_id, categories)
    return NextResponse.json(resultat, { status: 'error' in resultat ? 500 : 200 })

  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : 'Internal error'
    console.error('[seed-motifs] Error:', errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
