import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`tracking_update_${ip}`, 120, 60_000))) return rateLimitResponse()

    // ── Auth obligatoire ──
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await request.json()
    const { token, lat, lng, status, artisanNom, artisanInitiales, missionTitre, missionAdresse, photos, startedAt } = body

    if (!token) return NextResponse.json({ error: 'Token requis' }, { status: 400 })

    // Créer le bucket "tracking" s'il n'existe pas
    await supabaseAdmin.storage.createBucket('tracking', { public: false }).catch(err => logger.error('[tracking/update] Failed to create storage bucket:', err))

    const trackingData = {
      token,
      lat: lat ?? null,
      lng: lng ?? null,
      status: status || 'en_route',
      artisan_nom: artisanNom || '',
      artisan_initiales: artisanInitiales || '',
      mission_titre: missionTitre || '',
      mission_adresse: missionAdresse || '',
      photos: photos || [],
      started_at: startedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const jsonStr = JSON.stringify(trackingData)
    const { error } = await supabaseAdmin.storage
      .from('tracking')
      .upload(`${token}.json`, Buffer.from(jsonStr), {
        contentType: 'application/json',
        upsert: true,
      })

    if (error) {
      logger.error('[Tracking] Storage error:', error.message)
      return NextResponse.json({ success: false, error: error.message }, { status: 200 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('[tracking/update] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
