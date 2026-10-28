import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { validateBody, saveLogoSchema } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { envoyerImageArtisan, lireImageDataUrl, supprimerImageArtisan } from '@/lib/storage/images-artisan'

/**
 * POST /api/save-logo
 * Photo de profil ou logo de l'artisan connecté (profiles_artisan.profile_photo_url ou logo_url), envoyé par le
 * dashboard (SettingsSection) en data: URL base64.
 *
 * L'image part dans Supabase Storage (bucket public profile-photos, comme /api/upload) et la colonne reçoit l'URL
 * https publique : une data: URL de plusieurs centaines de Ko alourdissait tout ce qui lit la fiche (page publique
 * de 3 Mo, recherche, dashboard : Sentry V et W). Plus aucune data: URL n'est écrite en base (contrainte check de
 * la migration 20261028) : si l'envoi échoue (bucket absent ou privé, erreur réseau), la route répond 502,
 * l'artisan garde son image précédente et l'erreur est journalisée. Au-delà de 10 envois en 10 minutes, la route
 * répond 429 : chaque envoi crée un fichier dans le bucket.
 *
 * La ligne modifiée est toujours celle de l'utilisateur connecté (recherche par user_id, service role).
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const v = validateBody(saveLogoSchema, body)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const { base64, field } = v.data

    // Image JPEG, PNG, WebP ou GIF, vérifiée sur son contenu (le type annoncé par le navigateur ne suffit pas)
    const image = lireImageDataUrl(base64)
    if (!image) {
      return NextResponse.json({ error: 'Format non supporté. Utilisez JPG, PNG ou WEBP.' }, { status: 400 })
    }

    // Trouver l'artisan par user_id
    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!artisan) {
      return NextResponse.json({ error: 'Profil artisan non trouvé' }, { status: 404 })
    }

    const col = field === 'profile_photo_url' ? 'profile_photo_url' : 'logo_url'

    // La limite protège le bucket : chaque envoi y crée un fichier, alors qu'un enregistrement en base ne faisait
    // que remplacer la valeur.
    if (!(await checkRateLimit(`save_logo_storage_${user.id}`, 10, 10 * 60_000))) {
      logger.warn('[save-logo] Trop d’envois d’images, requête refusée', { artisanId: artisan.id, champ: col })
      return NextResponse.json(
        { error: 'Trop d’envois d’images en peu de temps. Réessayez dans quelques minutes.' },
        { status: 429 },
      )
    }

    // Storage seul : plus aucune data: URL en base. Si l'envoi échoue, l'artisan garde son image précédente et
    // reçoit une erreur explicite (le formulaire l'affiche).
    const envoi = await envoyerImageArtisan(supabaseAdmin, col, image)
    if (!envoi.ok) {
      logger.error(
        '[save-logo] Envoi dans Storage impossible',
        { artisanId: artisan.id, champ: col, etape: envoi.etape },
        new Error(envoi.message),
      )
      return NextResponse.json(
        { error: 'Envoi de l’image impossible pour le moment. Réessayez dans quelques minutes.' },
        { status: 502 },
      )
    }
    const valeur = envoi.url
    const cheminStockage = envoi.chemin

    const { error } = await supabaseAdmin
      .from('profiles_artisan')
      .update({ [col]: valeur, updated_at: new Date().toISOString() })
      .eq('id', artisan.id)

    if (error) {
      logger.error('[save-logo] Mise à jour du profil impossible', { artisanId: artisan.id, champ: col }, new Error(error.message))
      // Le profil garde son ancienne image : le fichier envoyé ne sert à rien
      const echecSuppression = await supprimerImageArtisan(supabaseAdmin, cheminStockage)
      if (echecSuppression) {
        logger.error('[save-logo] Fichier orphelin dans Storage', { chemin: cheminStockage }, new Error(echecSuppression))
      }
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    return NextResponse.json({ success: true, url: valeur })
  } catch (e: unknown) {
    logger.error('[save-logo] Erreur inattendue', undefined, e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
