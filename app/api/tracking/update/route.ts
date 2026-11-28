import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { validateBody, trackingUpdatePostSchema } from '@/lib/validation'
import { buildStoragePath } from '@/lib/security/storage-path'
import { BUCKET_SUIVI, CHAMP_PROPRIETAIRE_SUIVI, proprietaireSessionSuivi } from '@/lib/tracking/session-suivi'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`tracking_update_${ip}`, 120, 60_000))) return rateLimitResponse()

    // ── Auth obligatoire ──
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await request.json()
    const validation = validateBody(trackingUpdatePostSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { token, lat, lng, status, artisanNom, artisanInitiales, missionTitre, missionAdresse, photos, startedAt } = validation.data

    // Créer le bucket "tracking" s'il n'existe pas
    await supabaseAdmin.storage.createBucket(BUCKET_SUIVI, { public: false }).catch(err => logger.error('[tracking/update] Failed to create storage bucket:', err))

    // Jeton au format émis par l'application mobile (regex stricte du schéma Zod, 400 sinon) ;
    // nom d'objet construit par buildStoragePath.
    const chemin = buildStoragePath(`${token}.json`)

    // Une session déjà alimentée par un autre compte ne s'écrase pas (jeton rejoué ou deviné) : le jeton
    // n'est lié à aucun compte en base, le propriétaire est celui enregistré dans l'objet.
    const proprietaire = await proprietaireSessionSuivi(chemin)
    if (proprietaire && proprietaire !== user.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

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
      [CHAMP_PROPRIETAIRE_SUIVI]: user.id, // jamais renvoyé par le GET public
    }

    const jsonStr = JSON.stringify(trackingData)
    const { error } = await supabaseAdmin.storage
      .from(BUCKET_SUIVI)
      .upload(chemin, Buffer.from(jsonStr), {
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
