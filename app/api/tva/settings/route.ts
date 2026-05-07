/**
 * GET  /api/tva/settings — Récupère les paramètres TVA de l'artisan
 * PATCH /api/tva/settings — Met à jour tva_auto_activate
 *
 * Both flows are user-scoped and rely on the existing RLS policies on
 * profiles_artisan (owner_read / owner_update from migration 041).
 * No service-role bypass is needed; the route runs the request through
 * the user's JWT so RLS is the enforcer.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { authenticateRequest, getAuthedClient, getBearerToken } from '@/lib/supabase-clients'

const tvaSettingsSchema = z.object({
  tva_auto_activate: z.boolean(),
})

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIP(req)
    if (!(await checkRateLimit(`tva_set_${ip}`, 15, 60_000))) return rateLimitResponse()

    const token = getBearerToken(req)
    const user = await authenticateRequest(req)
    if (!user || !token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await getAuthedClient(token)
      .from('profiles_artisan')
      .select('tva_auto_activate, tva_notified_level')
      .eq('user_id', user.id)
      .single()

    if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[TVA SETTINGS GET]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ip = getClientIP(req)
    if (!(await checkRateLimit(`tva_set_${ip}`, 15, 60_000))) return rateLimitResponse()

    const token = getBearerToken(req)
    const user = await authenticateRequest(req)
    if (!user || !token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = tvaSettingsSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })

    const { tva_auto_activate } = parsed.data

    const { error } = await getAuthedClient(token)
      .from('profiles_artisan')
      .update({ tva_auto_activate })
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true, tva_auto_activate })
  } catch (e) {
    console.error('[TVA SETTINGS PATCH]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
