import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Rate limiting simple
const rateLimits = new Map<string, { count: number; reset: number }>()
function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const limit = rateLimits.get(ip)
  if (!limit || limit.reset < now) {
    rateLimits.set(ip, { count: 1, reset: now + 60_000 })
    return true
  }
  if (limit.count >= 120) return false
  limit.count++
  return true
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit dépassé' }, { status: 429 })
  }

  const body = await request.json()
  const { token, lat, lng, status, artisanNom, artisanInitiales, missionTitre, missionAdresse, photos, startedAt } = body

  if (!token) return NextResponse.json({ error: 'Token requis' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Créer le bucket "tracking" s'il n'existe pas
  await supabase.storage.createBucket('tracking', { public: false }).catch(() => {})

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
  const { error } = await supabase.storage
    .from('tracking')
    .upload(`${token}.json`, Buffer.from(jsonStr), {
      contentType: 'application/json',
      upsert: true,
    })

  if (error) {
    console.error('[Tracking] Storage error:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 200 })
  }

  return NextResponse.json({ success: true })
}
