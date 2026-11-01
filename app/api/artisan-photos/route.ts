import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateBody, artisanPhotosPatchSchema } from '@/lib/validation'
import { StoragePathError, assertStoragePath, buildStoragePath } from '@/lib/security/storage-path'

const artisanPhotosFormSchema = z.object({
  artisan_id: z.string().uuid(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  taken_at: z.string().max(50).optional(),
  booking_id: z.string().uuid().optional().nullable(),
  label: z.string().max(200).optional(),
  source: z.string().max(50).optional(),
})

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
  if (!(await checkRateLimit(`artisan_photos_get_${ip}`, 60, 60_000))) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const artisanId = searchParams.get('artisan_id')
  const bookingId = searchParams.get('booking_id')
  const unassigned = searchParams.get('unassigned') // Si 'true', retourne seulement les photos sans booking

  if (!artisanId) {
    return NextResponse.json({ error: 'artisan_id requis' }, { status: 400 })
  }

  let query = supabaseAdmin
    .from('artisan_photos')
    .select('id, artisan_id, booking_id, url, label, lat, lng, taken_at, source, created_at')
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
    logger.error('Error fetching artisan photos:', error)
    return NextResponse.json({ error: 'Erreur récupération photos' }, { status: 500 })
  }

  const response = NextResponse.json({ data })
  response.headers.set('Cache-Control', 'private, max-age=0, s-maxage=300, stale-while-revalidate=600')
  return response
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
  if (!(await checkRateLimit(`artisan_photos_post_${ip}`, 30, 60_000))) return rateLimitResponse()

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

    const fieldValidation = validateBody(artisanPhotosFormSchema, {
      artisan_id: artisanId,
      lat,
      lng,
      taken_at: takenAt,
      booking_id: bookingId || undefined,
      label,
      source,
    })
    if (!fieldValidation.success) {
      return NextResponse.json({ error: fieldValidation.error }, { status: 400 })
    }

    if (!file || !artisanId) {
      return NextResponse.json({ error: 'file et artisan_id requis' }, { status: 400 })
    }

    // Vérifier ownership artisan
    const { data: artisanProfile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id, user_id')
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

    // F10: validation magic bytes (ne pas faire confiance au file.type client)
    const buffer = await file.arrayBuffer()
    const magicBytes = new Uint8Array(buffer.slice(0, 12))
    const matchMagic = (sig: number[]) => sig.every((b, i) => magicBytes[i] === b)
    const isJPEG = matchMagic([0xFF, 0xD8, 0xFF])
    const isPNG = matchMagic([0x89, 0x50, 0x4E, 0x47])
    const isGIF = matchMagic([0x47, 0x49, 0x46])
    let isWebP = false
    if (buffer.byteLength >= 12 && matchMagic([0x52, 0x49, 0x46, 0x46])) {
      isWebP = magicBytes[8] === 0x57 && magicBytes[9] === 0x45 && magicBytes[10] === 0x42 && magicBytes[11] === 0x50
    }
    if (!isJPEG && !isPNG && !isGIF && !isWebP) {
      return NextResponse.json({ error: 'Format image invalide (JPEG, PNG, GIF, WebP acceptés)' }, { status: 400 })
    }

    // F11: type et extension déduits des octets reconnus (liste blanche), jamais du nom ni du type
    // annoncés par le client ; nom généré côté serveur ; dossier = fiche artisan vérifiée (user_id de
    // la session), segments vérifiés par buildStoragePath.
    let typeImage = { mime: 'image/webp', ext: 'webp' }
    if (isJPEG) typeImage = { mime: 'image/jpeg', ext: 'jpg' }
    else if (isPNG) typeImage = { mime: 'image/png', ext: 'png' }
    else if (isGIF) typeImage = { mime: 'image/gif', ext: 'gif' }
    const filename = buildStoragePath(artisanProfile.id, `${crypto.randomUUID()}.${typeImage.ext}`)

    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('artisan-photos')
      .upload(filename, buffer, {
        contentType: typeImage.mime,
        upsert: false,
      })

    if (uploadError) {
      logger.error('[ARTISAN_PHOTOS] Upload error:', uploadError)
      return NextResponse.json({ error: 'Erreur lors de l\'upload du fichier' }, { status: 500 })
    }

    // Utiliser signed URL (7 jours) au lieu de public URL pour la sécurité
    // Les photos artisan portfolio sont accessibles via signed URLs renouvelables
    // Chemin renvoyé par Storage revérifié (défense en profondeur) avant l'URL signée.
    const cheminDepose = assertStoragePath(uploadData.path, artisanProfile.id)
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from('artisan-photos')
      .createSignedUrl(cheminDepose, 60 * 60 * 24 * 7) // 7 jours
    if (signError) {
      // Bucket privé : l'URL publique de repli ne sera pas lisible, l'échec doit se voir dans les journaux.
      logger.warn('[ARTISAN_PHOTOS] URL signée en échec, repli sur l’URL publique', { message: signError.message })
    }
    const publicUrl = signedData?.signedUrl || supabaseAdmin.storage.from('artisan-photos').getPublicUrl(cheminDepose).data.publicUrl

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
      logger.error('[ARTISAN_PHOTOS] Insert error:', insertError)
      return NextResponse.json({ error: 'Erreur enregistrement' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: photo })
  } catch (e: unknown) {
    if (e instanceof StoragePathError) {
      logger.warn('[ARTISAN_PHOTOS] chemin de stockage refusé')
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
    }
    logger.error('[ARTISAN_PHOTOS] Server error:', e)
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
  if (!(await checkRateLimit(`artisan_photos_patch_${ip}`, 30, 60_000))) return rateLimitResponse()

  try {
    const body = await request.json()
    const v = validateBody(artisanPhotosPatchSchema, body)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const { photo_id, booking_id, label } = v.data

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

    const updatePayload: Record<string, unknown> = {}
    if (booking_id !== undefined) updatePayload.booking_id = booking_id || null
    if (label !== undefined) updatePayload.label = label

    const { data, error } = await supabaseAdmin
      .from('artisan_photos')
      .update(updatePayload)
      .eq('id', photo_id)
      .select()
      .single()

    if (error) {
      logger.error('[ARTISAN_PHOTOS] Update error:', error)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (e: unknown) {
    logger.error('[ARTISAN_PHOTOS] Server error:', e)
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
  if (!(await checkRateLimit(`artisan_photos_delete_${ip}`, 20, 60_000))) return rateLimitResponse()

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

  // Supprimer le fichier storage si possible (best-effort : la ligne reste la source de vérité).
  // Chemin extrait de l'URL enregistrée, puis vérifié : traversée bloquée, dossier de la fiche imposé.
  // Chemin refusé ou URL illisible : objet laissé, ligne supprimée (comme un échec de remove).
  try {
    const urlPath = new URL(photo.url).pathname
    const storagePath = urlPath.split('/artisan-photos/')[1]
    if (storagePath) {
      const { error: storageError } = await supabaseAdmin.storage
        .from('artisan-photos')
        .remove([assertStoragePath(storagePath, photo.artisan_id)])
      if (storageError) logger.warn('[ARTISAN_PHOTOS] fichier non supprimé', { photo: id, message: storageError.message })
    }
  } catch (e) {
    logger.warn('[ARTISAN_PHOTOS] fichier non supprimé', { photo: id, raison: e instanceof Error ? e.name : 'inconnue' })
  }

  const { error } = await supabaseAdmin
    .from('artisan_photos')
    .delete()
    .eq('id', id)

  if (error) {
    logger.error('[ARTISAN_PHOTOS] Delete error:', error)
    return NextResponse.json({ error: 'Erreur suppression' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
