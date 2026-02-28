import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

/**
 * POST /api/upload
 * Upload un fichier vers Supabase Storage
 *
 * FormData attendu :
 *   file        : File
 *   bucket      : 'artisan-documents' | 'profile-photos'
 *   folder      : string (ex: 'insurance', 'kbis', 'profiles')
 *   artisan_id? : string (pour mettre à jour le profil après upload)
 *   field?      : 'insurance_url' | 'kbis_url' | 'profile_photo_url'
 */
export async function POST(request: NextRequest) {
  // Auth guard
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Rate limit : 20 uploads/min par IP
  const ip = getClientIP(request)
  if (!checkRateLimit(`upload_${ip}`, 20, 60_000)) {
    return rateLimitResponse()
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bucket = (formData.get('bucket') as string) || 'artisan-documents'
    const folder = (formData.get('folder') as string) || 'misc'
    const artisanId = formData.get('artisan_id') as string | null
    const field = formData.get('field') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    }

    // Vérifier taille max 10 Mo
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 400 })
    }

    // Vérifier type MIME
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Format non supporté. Utilisez JPG, PNG, WEBP ou PDF.' },
        { status: 400 }
      )
    }

    // Lire le fichier en buffer AVANT validation pour vérifier les magic bytes
    const buffer = await file.arrayBuffer()

    // Validation magic bytes — ne pas faire confiance au file.type client
    const bytes = new Uint8Array(buffer.slice(0, 8))
    function matchesMagic(sig: number[]): boolean {
      return sig.every((b, i) => bytes[i] === b)
    }
    const isJPEG = matchesMagic([0xFF, 0xD8, 0xFF])
    const isPNG = matchesMagic([0x89, 0x50, 0x4E, 0x47])
    const isGIF = matchesMagic([0x47, 0x49, 0x46])
    const isPDF = matchesMagic([0x25, 0x50, 0x44, 0x46]) // %PDF

    // WebP : RIFF header (bytes 0-3) + "WEBP" aux bytes 8-11
    let isWebP = false
    if (buffer.byteLength >= 12 && matchesMagic([0x52, 0x49, 0x46, 0x46])) {
      const webpBytes = new Uint8Array(buffer.slice(8, 12))
      isWebP = webpBytes[0] === 0x57 && webpBytes[1] === 0x45 && webpBytes[2] === 0x42 && webpBytes[3] === 0x50
    }

    if (!isJPEG && !isPNG && !isGIF && !isWebP && !isPDF) {
      return NextResponse.json(
        { error: 'Le contenu du fichier ne correspond à aucun format autorisé (JPEG, PNG, GIF, WebP, PDF).' },
        { status: 400 }
      )
    }

    // Générer un nom de fichier unique
    const ext = file.name.split('.').pop() || 'bin'
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const filename = `${folder}/${timestamp}_${randomSuffix}.${ext}`

    // Upload vers Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from(bucket)
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[UPLOAD] Erreur Supabase Storage:', uploadError)
      return NextResponse.json(
        { error: `Erreur upload: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Récupérer l'URL publique
    const { data: urlData } = supabaseAdmin
      .storage
      .from(bucket)
      .getPublicUrl(uploadData.path)

    const publicUrl = urlData.publicUrl

    // Si artisan_id + field fournis, mettre à jour le profil
    if (artisanId && field) {
      const allowedFields = ['insurance_url', 'kbis_url', 'profile_photo_url', 'portfolio_photo']
      if (allowedFields.includes(field)) {
        // IDOR check : vérifier que l'utilisateur connecté est bien le propriétaire
        const { data: artisanRow } = await supabaseAdmin
          .from('profiles_artisan')
          .select('user_id, portfolio_photos')
          .eq('id', artisanId)
          .single()
        if (!artisanRow || artisanRow.user_id !== user.id) {
          return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
        }

        if (field === 'portfolio_photo') {
          // Append to portfolio_photos JSONB array
          const photoMeta = formData.get('photo_meta') as string | null
          const photoUrl = formData.get('photo_url') as string | null
          const targetUrl = photoUrl || publicUrl
          let meta: any = {}
          try { meta = photoMeta ? JSON.parse(photoMeta) : {} } catch { /* ignore */ }
          const newEntry = {
            url: targetUrl,
            title: meta.title || 'Réalisation',
            category: meta.category || 'Autre',
            uploadedAt: new Date().toISOString(),
            id: Date.now().toString(),
          }
          const existing: any[] = artisanRow.portfolio_photos || []
          const { error: updateError } = await supabaseAdmin
            .from('profiles_artisan')
            .update({
              portfolio_photos: [newEntry, ...existing],
              updated_at: new Date().toISOString(),
            })
            .eq('id', artisanId)
          if (updateError) {
            console.error('[UPLOAD] Erreur portfolio_photos:', updateError)
          }
        } else {
          const { error: updateError } = await supabaseAdmin
            .from('profiles_artisan')
            .update({ [field]: publicUrl, updated_at: new Date().toISOString() })
            .eq('id', artisanId)
          if (updateError) {
            console.error('[UPLOAD] Erreur mise à jour profil:', updateError)
            // On retourne quand même l'URL car l'upload a réussi
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: uploadData.path,
    })
  } catch (err: any) {
    console.error('[UPLOAD] Erreur:', err)
    return NextResponse.json(
      { error: 'Erreur serveur lors de l\'upload' },
      { status: 500 }
    )
  }
}
