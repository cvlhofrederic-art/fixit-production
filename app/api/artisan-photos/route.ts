import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/artisan-photos?artisan_id=X&booking_id=Y
 * Liste les photos d'un artisan (optionnellement filtrées par booking)
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!checkRateLimit(`artisan_photos_get_${ip}`, 60, 60_000)) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const artisanId = searchParams.get('artisan_id')
  const bookingId = searchParams.get('booking_id')
  const unassigned = searchParams.get('unassigned') // Si 'true', retourne seulement les photos sans booking

  if (!artisanId) {
    return NextResponse.json({ error: 'artisan_id requis' }, { status: 400 })
  }

  let query = supabaseAdmin
    .from('artisan_photos')
    .select('*')
    .eq('artisan_id', artisanId)
    .order('taken_at', { ascending: false })

  if (bookingId) {
    query = query.eq('booking_id', bookingId)
  }
  if (unassigned === 'true') {
    query = query.is('booking_id', null)
  }

  const { data, error } = await query.limit(200)

  if (error) {
    console.error('Error fetching artisan photos:', error)
    return NextResponse.json({ error: 'Erreur récupération photos' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

/**
 * POST /api/artisan-photos
 * Ajouter une photo (upload depuis mobile avec GPS + timestamp)
 * Body: FormData avec file, artisan_id, lat, lng, taken_at, booking_id?, label?
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!checkRateLimit(`artisan_photos_post_${ip}`, 30, 60_000)) return rateLimitResponse()

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const artisanId = formData.get('artisan_id') as string
    const lat = parseFloat(formData.get('lat') as string) || null
    const lng = parseFloat(formData.get('lng') as string) || null
    const takenAt = (formData.get('taken_at') as string) || new Date().toISOString()
    const bookingId = (formData.get('booking_id') as string) || null
    const label = (formData.get('label') as string) || ''
    const source = (formData.get('source') as string) || 'mobile'

    if (!file || !artisanId) {
      return NextResponse.json({ error: 'file et artisan_id requis' }, { status: 400 })
    }

    // Vérifier ownership artisan
    const { data: artisanProfile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('user_id')
      .eq('id', artisanId)
      .single()
    if (!artisanProfile || artisanProfile.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Vérifier type MIME image
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Seules les images sont acceptées' }, { status: 400 })
    }

    // Vérifier taille max 15 Mo
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'Photo trop volumineuse (max 15 Mo)' }, { status: 400 })
    }

    // Upload vers Supabase Storage
    const buffer = await file.arrayBuffer()
    const ext = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const filename = `${artisanId}/${timestamp}_${randomSuffix}.${ext}`

    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('artisan-photos')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[ARTISAN_PHOTOS] Upload error:', uploadError)
      return NextResponse.json({ error: `Erreur upload: ${uploadError.message}` }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage.from('artisan-photos').getPublicUrl(uploadData.path)
    const publicUrl = urlData.publicUrl

    // Insérer dans la table
    const { data: photo, error: insertError } = await supabaseAdmin
      .from('artisan_photos')
      .insert({
        artisan_id: artisanId,
        url: publicUrl,
        lat,
        lng,
        taken_at: takenAt,
        booking_id: bookingId,
        label,
        source,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[ARTISAN_PHOTOS] Insert error:', insertError)
      return NextResponse.json({ error: 'Erreur enregistrement' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: photo })
  } catch (e: unknown) {
    console.error('[ARTISAN_PHOTOS] Server error:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PATCH /api/artisan-photos
 * Associer/dissocier une photo d'un booking
 * Body: { photo_id, booking_id?, label? }
 */
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!checkRateLimit(`artisan_photos_patch_${ip}`, 30, 60_000)) return rateLimitResponse()

  try {
    const body = await request.json()
    const { photo_id, booking_id, label } = body

    if (!photo_id) {
      return NextResponse.json({ error: 'photo_id requis' }, { status: 400 })
    }

    // Vérifier ownership via artisan
    const { data: photo } = await supabaseAdmin
      .from('artisan_photos')
      .select('artisan_id')
      .eq('id', photo_id)
      .single()
    if (!photo) {
      return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })
    }
    const { data: artisanProfile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('user_id')
      .eq('id', photo.artisan_id)
      .single()
    if (!artisanProfile || artisanProfile.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const updatePayload: any = {}
    if (booking_id !== undefined) updatePayload.booking_id = booking_id || null
    if (label !== undefined) updatePayload.label = label

    const { data, error } = await supabaseAdmin
      .from('artisan_photos')
      .update(updatePayload)
      .eq('id', photo_id)
      .select()
      .single()

    if (error) {
      console.error('[ARTISAN_PHOTOS] Update error:', error)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (e: unknown) {
    console.error('[ARTISAN_PHOTOS] Server error:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/artisan-photos?id=X
 * Supprimer une photo
 */
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!checkRateLimit(`artisan_photos_delete_${ip}`, 20, 60_000)) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 })
  }

  // Vérifier ownership
  const { data: photo } = await supabaseAdmin
    .from('artisan_photos')
    .select('artisan_id, url')
    .eq('id', id)
    .single()
  if (!photo) {
    return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })
  }
  const { data: artisanProfile } = await supabaseAdmin
    .from('profiles_artisan')
    .select('user_id')
    .eq('id', photo.artisan_id)
    .single()
  if (!artisanProfile || artisanProfile.user_id !== user.id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Supprimer le fichier storage si possible
  try {
    const urlPath = new URL(photo.url).pathname
    const storagePath = urlPath.split('/artisan-photos/')[1]
    if (storagePath) {
      await supabaseAdmin.storage.from('artisan-photos').remove([storagePath])
    }
  } catch { /* ignore storage delete errors */ }

  const { error } = await supabaseAdmin
    .from('artisan_photos')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[ARTISAN_PHOTOS] Delete error:', error)
    return NextResponse.json({ error: 'Erreur suppression' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
