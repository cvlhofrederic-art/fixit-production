/**
 * POST /api/tva/check
 * Vérifie le seuil TVA d'un artisan et crée une notification si nécessaire.
 *
 * Profile read/update flows through getAuthedClient(token) so RLS
 * (profiles_artisan_owner_read / owner_update from migration 041) is
 * the enforcer. The artisan_notifications insert keeps service-role
 * because no INSERT policy exists on that table — only SELECT/UPDATE
 * are scoped to the owner; INSERT is intentionally service-role-only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTvaStatus, shouldNotify, type TvaCountry, type TvaNotifiedLevel } from '@/lib/tva-thresholds'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { authenticateRequest, getAdminClient, getAuthedClient, getBearerToken } from '@/lib/supabase-clients'

const tvaCheckSchema = z.object({
  ca_ht: z.number().nonnegative(),
  country: z.string().min(2).max(2),
})

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req)
    if (!(await checkRateLimit(`tva_chk_${ip}`, 10, 60_000))) return rateLimitResponse()

    const token = getBearerToken(req)
    const user = await authenticateRequest(req)
    if (!user || !token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = tvaCheckSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })

    const { ca_ht, country } = parsed.data

    const authed = getAuthedClient(token)
    const { data: profile, error: profileError } = await authed
      .from('profiles_artisan')
      .select('id, tva_notified_level, tva_auto_activate')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const tvaCountry = (country as string).toUpperCase() as TvaCountry
    const tvaResult = getTvaStatus(ca_ht, tvaCountry)
    const lastLevel = profile.tva_notified_level as TvaNotifiedLevel

    const needsNotif = shouldNotify(tvaResult.status, lastLevel)

    if (needsNotif) {
      const isPt = tvaCountry === 'PT'
      const title = isPt ? tvaResult.title.pt : tvaResult.title.fr
      const body = isPt ? tvaResult.message.pt : tvaResult.message.fr

      // artisan_notifications has no INSERT RLS policy — keep admin here.
      await getAdminClient().from('artisan_notifications').insert({
        artisan_id: user.id,
        type: 'tva_threshold',
        title,
        body,
        read: false,
        data_json: JSON.stringify({
          status: tvaResult.status,
          ca_ht,
          seuil: tvaResult.seuil,
          percent: tvaResult.percent,
          country: tvaCountry,
        }),
      })

      // Profile update goes through the user's JWT (owner_update policy).
      await authed
        .from('profiles_artisan')
        .update({ tva_notified_level: tvaResult.status === 'exceeded_majore' ? 'exceeded_majore' : tvaResult.status })
        .eq('id', profile.id)
    }

    return NextResponse.json({
      notified: needsNotif,
      status: tvaResult.status,
      percent: tvaResult.percent,
      tva_auto_activate: profile.tva_auto_activate,
    })
  } catch (e) {
    console.error('[TVA CHECK]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
