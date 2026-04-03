import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { generateSlug } from '@/lib/utils'
import { artisanSettingsPostSchema, validateBody } from '@/lib/validation'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// ── Cache des colonnes existantes (évite de re-tester à chaque requête) ────────
let knownColumns: Set<string> | null = null
let columnsCheckedAt = 0
const COLUMNS_CHECK_TTL = 5 * 60 * 1000 // re-check toutes les 5 min

const SETTINGS_FIELDS = [
  'company_name', 'bio', 'phone', 'email', 'slug',
  'auto_reply_message', 'auto_block_duration_minutes', 'zone_radius_km',
]

async function getExistingColumns(supabaseAdmin: typeof import('@/lib/supabase-server')['supabaseAdmin']): Promise<Set<string>> {
  if (knownColumns && Date.now() - columnsCheckedAt < COLUMNS_CHECK_TTL) {
    return knownColumns
  }

  const existing = new Set<string>()
  for (const col of SETTINGS_FIELDS) {
    const { error } = await supabaseAdmin
      .from('profiles_artisan')
      .select(col)
      .limit(1)
    if (!error) existing.add(col)
  }

  knownColumns = existing
  columnsCheckedAt = Date.now()
  // Columns discovered
  return existing
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Rate limit: 15 requests per minute per user
    const allowed = await checkRateLimit(`artisan_settings_${user.id}`, 15, 60_000)
    if (!allowed) return rateLimitResponse()

    // Verify artisan ownership
    const { data: artisan, error: fetchError } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (fetchError || !artisan) {
      return NextResponse.json({ error: 'Profil artisan introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const settingsValidation = validateBody(artisanSettingsPostSchema, body)
    if (!settingsValidation.success) {
      return NextResponse.json({ error: 'Donn\u00e9es invalides', details: settingsValidation.error }, { status: 400 })
    }
    const {
      company_name, bio, phone, email,
      auto_reply_message, auto_block_duration_minutes, zone_radius_km
    } = settingsValidation.data

    // Déterminer quelles colonnes existent en base
    const existingCols = await getExistingColumns(supabaseAdmin)

    // Construire le payload avec uniquement les colonnes existantes
    const updatePayload: Record<string, any> = {}
    const skippedFields: string[] = []

    // Auto-générer le slug quand company_name change
    let slug: string | undefined = undefined
    if (company_name) {
      slug = generateSlug(company_name)
    }

    const fields: Record<string, any> = {
      company_name, bio, phone, email, slug,
      auto_reply_message, auto_block_duration_minutes, zone_radius_km,
    }

    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue
      if (existingCols.has(key)) {
        updatePayload[key] = value
      } else {
        skippedFields.push(key)
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      if (skippedFields.length > 0) {
        return NextResponse.json({
          error: `Les champs suivants ne sont pas encore disponibles en base de données : ${skippedFields.join(', ')}. Contactez le support technique.`,
        }, { status: 500 })
      }
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    // Exécuter l'update
    const { error: updateError } = await supabaseAdmin
      .from('profiles_artisan')
      .update(updatePayload)
      .eq('id', artisan.id)

    if (updateError) {
      logger.error('saveSettings error:', updateError)

      // Si erreur inattendue, invalider le cache des colonnes et réessayer
      knownColumns = null

      return NextResponse.json({
        error: updateError.message || 'Erreur lors de la sauvegarde',
      }, { status: 500 })
    }

    // Succès
    if (skippedFields.length > 0) {
      return NextResponse.json({
        success: true,
        partial: true,
        savedFields: Object.keys(updatePayload).join(', '),
        warning: `Sauvegardé : ${Object.keys(updatePayload).join(', ')}. Non disponible : ${skippedFields.join(', ')}.`,
      })
    }

    return NextResponse.json({ success: true, slug: slug || undefined })
  } catch (err) {
    logger.error('[artisan-settings/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
