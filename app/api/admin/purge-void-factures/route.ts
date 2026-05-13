import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 10

// POST /api/admin/purge-void-factures — hard delete les factures dont le
// numero contient "-VOID-" pour le caller (artisan owner). Endpoint éphémère
// phase test SaaS : sera retiré juste après usage. Préserve la chaîne de
// hash car les rows VOID n'ont pas de successeur (les nouveaux numéros
// chronologiques ont été ré-attribués).
export async function POST(request: NextRequest) {
  let user = await getAuthUser(request)
  if (!user) {
    try {
      const sc = await createServerSupabaseClient()
      const { data } = await sc.auth.getUser()
      user = data.user
    } catch { /* noop */ }
  }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await checkRateLimit(`purge_void_${user.id}`, 3, 60_000))) return rateLimitResponse()

  // Test SaaS : autorise un user authentifié à purger les VOID des comptes
  // test connus (Frédéric Carvalho EI + Sud Travaux SAS — mêmes acteurs
  // physiques sur 2 entités juridiques distinctes). L'endpoint sera retiré
  // juste après usage (commit suivant).
  const TEST_ARTISANS = [
    '920b7d34-5d20-4fe4-b2c0-14eb0fe51ab9', // cvlho.frederic@gmail.com (EI)
    'c0f138e6-1725-406e-a631-03e1b72acfe4', // sudtravaux13650@hotmail.com (SAS)
  ]
  if (!TEST_ARTISANS.includes(user.id)) {
    return NextResponse.json({ error: 'Not a test artisan account' }, { status: 403 })
  }

  // List avant suppression — toutes les VOID rows des 2 comptes test
  const { data: targets, error: fetchErr } = await supabaseAdmin
    .from('factures')
    .select('id, numero, status, artisan_user_id')
    .in('artisan_user_id', TEST_ARTISANS)
    .like('numero', '%-VOID-%')

  if (fetchErr) {
    logger.error(`[purge-void] fetch failed:`, fetchErr.message)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
  if (!targets || targets.length === 0) {
    return NextResponse.json({ deleted: 0, message: 'No VOID rows for this user' })
  }

  // Hard delete
  const ids = targets.map(t => t.id)
  const { error: delErr } = await supabaseAdmin
    .from('factures')
    .delete()
    .in('id', ids)
    .in('artisan_user_id', TEST_ARTISANS)

  if (delErr) {
    logger.error(`[purge-void] delete failed:`, delErr.message)
    return NextResponse.json({ error: 'Delete failed', detail: delErr.message }, { status: 500 })
  }

  return NextResponse.json({
    deleted: targets.length,
    rows: targets.map(t => ({ id: t.id, numero: t.numero, status: t.status })),
  })
}
