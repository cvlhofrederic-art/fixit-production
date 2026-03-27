/**
 * POST /api/tva/check
 * Vérifie le seuil TVA d'un artisan et crée une notification si nécessaire.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTvaStatus, shouldNotify, type TvaCountry, type TvaNotifiedLevel } from '@/lib/tva-thresholds'

// Lazy init — évite le crash au build CI
function getSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
function getSupabaseAnon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authError } = await getSupabaseAnon().auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { ca_ht, country } = await req.json()
    if (typeof ca_ht !== 'number' || !country) {
      return NextResponse.json({ error: 'Missing ca_ht or country' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: profile, error: profileError } = await supabaseAdmin
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

      await supabaseAdmin.from('artisan_notifications').insert({
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

      await supabaseAdmin
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
