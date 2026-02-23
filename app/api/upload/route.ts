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

    // Générer un nom de fichier unique
    const ext = file.name.split('.').pop() || 'bin'
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const filename = `${folder}/${timestamp}_${randomSuffix}.${ext}`

    // Lire le fichier en buffer
    const buffer = await file.arrayBuffer()

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
      const allowedFields = ['insurance_url', 'kbis_url', 'profile_photo_url']
      if (allowedFields.includes(field)) {
        // IDOR check : vérifier que l'utilisateur connecté est bien le propriétaire
        const { data: artisanRow } = await supabaseAdmin
          .from('profiles_artisan')
          .select('user_id')
          .eq('id', artisanId)
          .single()
        if (!artisanRow || artisanRow.user_id !== user.id) {
          return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
        }

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
