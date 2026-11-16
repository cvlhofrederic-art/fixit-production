import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole } from '@/lib/auth-helpers'
import { generateSlug } from '@/lib/utils'
import { ficheSocieteFrancaise } from '@/lib/btp/fiche-societe-francaise'
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
  'intervention_zones', 'language',
  // BTP — champs légaux issus du Kbis (saisie manuelle pour l'instant)
  'rcs_number', 'ape_code', 'share_capital', 'tva_intra',
  // BTP — Assurance & Médiateur (saisis une fois, repris sur tous les devis)
  'insurance_name', 'insurance_number', 'insurance_coverage', 'insurance_type', 'insurance_expiry',
  'mediator_name', 'mediator_url',
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

/**
 * Adresse publique (slug) libre pour la fiche d'une société BTP : nom et ville de la fiche, puis -2, -3… si une autre
 * fiche l'a déjà. Indisponible (nom vide, lecture en échec) : undefined, la fiche reste sans adresse et les autres
 * champs s'enregistrent.
 */
async function adressePubliqueLibre(nom: string, ville: string, idFiche: string): Promise<string | undefined> {
  const base = generateSlug(nom, ville)
  if (!base) return undefined
  // generateSlug ne garde que [a-z0-9-] : aucun joker de LIKE dans la base
  const { data, error } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id, slug')
    .like('slug', `${base}%`)
  if (error) {
    logger.warn('[artisan-settings] adresses publiques illisibles, fiche laissée sans adresse', { code: error.code })
    return undefined
  }
  const prises = new Set((data ?? []).filter((ligne) => ligne.id !== idFiche).map((ligne) => ligne.slug))
  if (!prises.has(base)) return base
  // prises contient la base : parmi ces prises.size suffixes, au moins un est libre
  for (let n = 2; n <= prises.size + 1; n++) {
    if (!prises.has(`${base}-${n}`)) return `${base}-${n}`
  }
  return undefined
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

    // Verify artisan ownership. Société BTP : la fiche entière (langue, adresse publique, nom, ville) ; artisan : inchangé.
    const estSocieteBtp = getUserRole(user) === 'pro_societe'
    const { data: artisan, error: fetchError } = await supabaseAdmin
      .from('profiles_artisan')
      .select(estSocieteBtp ? '*' : 'id')
      .eq('user_id', user.id)
      .single()

    if (fetchError || !artisan) {
      return NextResponse.json({ error: 'Profil artisan introuvable' }, { status: 404 })
    }
    // Société BTP française : fiche qui n'est pas en portugais. Société inscrite au Portugal : hors de ce correctif,
    // calcul de l'adresse publique et enregistrement d'avant.
    const estSocieteBtpFrancaise = estSocieteBtp && ficheSocieteFrancaise(artisan as Record<string, unknown>)

    const body = await request.json()
    const settingsValidation = validateBody(artisanSettingsPostSchema, body)
    if (!settingsValidation.success) {
      return NextResponse.json({ error: 'Donn\u00e9es invalides', details: settingsValidation.error }, { status: 400 })
    }
    const {
      company_name, bio, phone, email,
      auto_reply_message, auto_block_duration_minutes, zone_radius_km,
      intervention_zones, language,
      rcs_number, ape_code, share_capital, tva_intra,
      insurance_name, insurance_number, insurance_coverage, insurance_type, insurance_expiry,
      mediator_name, mediator_url,
    } = settingsValidation.data

    // Déterminer quelles colonnes existent en base
    const existingCols = await getExistingColumns(supabaseAdmin)

    // Construire le payload avec uniquement les colonnes existantes
    const updatePayload: Record<string, any> = {}
    const skippedFields: string[] = []

    let slug: string | undefined = undefined
    if (estSocieteBtpFrancaise) {
      // Société BTP française : l'adresse publique de la fiche est posée une seule fois (adresse indexée, liens
      // partagés) et ne change plus, même avec le nom. Une fiche qui n'en a pas la reçoit au premier enregistrement
      // venu, quel que soit l'écran (« Mon profil » n'envoie plus le nom s'il n'a pas changé), à partir du nom et de la
      // ville de la fiche.
      const fiche = artisan as Record<string, unknown>
      if (!fiche.slug) {
        slug = await adressePubliqueLibre(String(company_name || fiche.company_name || ''), String(fiche.company_city || ''), String(fiche.id))
      }
    } else if (company_name) {
      // Auto-générer le slug quand company_name ou city change
      const city = body.company_city || body.city || ''
      slug = generateSlug(company_name, city)
    }

    const fields: Record<string, any> = {
      company_name, bio, phone, email, slug,
      auto_reply_message, auto_block_duration_minutes, zone_radius_km,
      intervention_zones, language,
      rcs_number, ape_code, share_capital, tva_intra,
      insurance_name, insurance_number, insurance_coverage, insurance_type, insurance_expiry,
      mediator_name, mediator_url,
    }

    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue
      if (existingCols.has(key)) {
        // Normalise les chaînes vides en null avant l'update.
        // Postgres rejette '' pour les colonnes typées (DATE, INTEGER, NUMERIC…)
        // ce qui faisait remonter une erreur générique « Erreur lors de la
        // sauvegarde » au client. Pour les colonnes TEXT, null ↔ '' est
        // sémantiquement équivalent côté lecture.
        updatePayload[key] = value === '' ? null : value
      } else {
        skippedFields.push(key)
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      if (skippedFields.length > 0) {
        return NextResponse.json({
          error: `Les champs suivants ne sont pas encore disponibles en base de données : ${skippedFields.join(', ')}. Contactez le support technique.`,
        }, { status: 400 })
      }
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    // Exécuter l'update
    let { error: updateError } = await supabaseAdmin
      .from('profiles_artisan')
      .update(updatePayload)
      .eq('id', artisan.id)

    if (updateError && estSocieteBtpFrancaise && 'slug' in updatePayload && updateError.code === '23505') {
      // Société BTP française : adresse publique prise entre-temps par une autre fiche. Les autres champs s'enregistrent
      // sans elle ; la fiche la recevra à un prochain enregistrement.
      logger.warn('[artisan-settings] adresse publique déjà prise, enregistrement sans elle', { ficheId: artisan.id })
      delete updatePayload.slug
      slug = undefined
      if (Object.keys(updatePayload).length === 0) {
        updateError = null
      } else {
        ;({ error: updateError } = await supabaseAdmin
          .from('profiles_artisan')
          .update(updatePayload)
          .eq('id', artisan.id))
      }
    }

    if (updateError) {
      logger.error('saveSettings error:', updateError)

      // Si erreur inattendue, invalider le cache des colonnes et réessayer
      knownColumns = null

      return NextResponse.json({
        error: 'Erreur lors de la sauvegarde',
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
