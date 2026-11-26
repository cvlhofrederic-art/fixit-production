import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole } from '@/lib/auth-helpers'
import { generateSlug } from '@/lib/utils'
import { artisanSettingsPostSchema, validateBody } from '@/lib/validation'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { ficheSocieteOuRefus, peutModifierFicheSociete } from '@/lib/btp/fiche-societe'
import { messageRefusFr } from '@/lib/documents/messages-refus'

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

/** Début et fin du marqueur des services par jour, rangé à la fin de la bio (app/api/availability-services l'écrit). */
const DEBUT_MARQUEUR = '<!--DS:'
const FIN_MARQUEUR = '-->'

/** Le marqueur de la bio en base, lu sans expression régulière (temps linéaire) ; undefined s'il n'y en a pas. */
function marqueurDesServices(bioEnBase: unknown): string | undefined {
  if (typeof bioEnBase !== 'string') return undefined
  const debut = bioEnBase.indexOf(DEBUT_MARQUEUR)
  if (debut < 0) return undefined
  const fin = bioEnBase.indexOf(FIN_MARQUEUR, debut + DEBUT_MARQUEUR.length)
  return fin < 0 ? undefined : bioEnBase.slice(debut, fin + FIN_MARQUEUR.length)
}

/**
 * Compte invité : la bio reçue n'a jamais le marqueur des services par jour (le formulaire le retire de l'écran, et le
 * tableau de bord d'un invité ne le réécrit pas après l'enregistrement, comme il le fait pour le gérant). Il est repris
 * de la fiche : sinon le réglage de la société disparaîtrait à la première bio modifiée.
 */
function bioAvecMarqueur(bio: string | undefined, bioEnBase: unknown): string | undefined {
  if (typeof bio !== 'string' || bio.includes(DEBUT_MARQUEUR)) return bio
  const marqueur = marqueurDesServices(bioEnBase)
  return marqueur ? `${bio.trim()} ${marqueur}`.trim() : bio
}

/** Les 18 champs du formulaire « Mon profil » (SettingsForm, hooks/dashboard/useSettings.ts). */
const CHAMPS_DU_FORMULAIRE = [
  'company_name', 'bio', 'phone', 'email', 'auto_reply_message', 'auto_block_duration_minutes', 'zone_radius_km',
  'rcs_number', 'ape_code', 'share_capital', 'tva_intra',
  'insurance_name', 'insurance_number', 'insurance_coverage', 'insurance_type', 'insurance_expiry',
  'mediator_name', 'mediator_url',
] as const

/**
 * Compte invité : un onglet ouvert avant cette correction n'a jamais chargé le formulaire depuis la fiche, et il envoie
 * ses 18 champs d'un coup, vides. Le formulaire corrigé n'envoie que les champs changés. Seul est refusé le corps
 * complet qui viderait un champ rempli de la fiche de la société. Retirer un médiateur (nom et site) ou toute une
 * assurance reste possible : la règle d'avant, « au plus un champ vidé », le refusait, et recharger n'y changeait rien.
 */
function formulaireJamaisCharge(
  corps: Record<string, unknown>,
  aEcrire: Record<string, unknown>,
  fiche: Record<string, unknown>,
): boolean {
  if (!CHAMPS_DU_FORMULAIRE.every((cle) => cle in corps)) return false
  const remplie = (valeur: unknown) => valeur !== null && valeur !== undefined && valeur !== ''
  return Object.entries(aEcrire).some(([cle, valeur]) => valeur === null && remplie(fiche[cle]))
}

/**
 * Compte invité, juste avant l'écriture sur la fiche de la société. L'interrupteur « Validation automatique » de Mon
 * profil y passe : la fiche de la société ne s'écrit pas depuis le navigateur (la RLS filtrait sans erreur,
 * l'interrupteur basculait quand même). Rend le refus d'un formulaire jamais chargé, ou null.
 */
function refusOuValidationAutomatique(
  corps: Record<string, unknown>,
  aEcrire: Record<string, unknown>,
  fiche: Record<string, unknown>,
): NextResponse | null {
  if (typeof corps.auto_accept === 'boolean') aEcrire.auto_accept = corps.auto_accept
  if (!formulaireJamaisCharge(corps, aEcrire, fiche)) return null
  logger.warn('[artisan-settings] formulaire vide refusé sur la fiche d’une société', { ficheId: fiche.id })
  return NextResponse.json({ error: messageRefusFr('formulaire_perime'), code: 'formulaire_perime' }, { status: 409 })
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

    // Verify artisan ownership. Société BTP : la fiche entière (adresse publique, nom, ville) ; artisan : inchangé.
    const estSocieteBtp = getUserRole(user) === 'pro_societe'
    // Compte invité dans une société BTP (co-gérant, secrétaire…) : il n'a pas de fiche à lui, « Mon profil » est
    // celle de sa société, et seul le module settings en FULL l'écrit. Tout autre compte : null, chemin d'origine.
    const ficheSociete = await ficheSocieteOuRefus(user, supabaseAdmin, peutModifierFicheSociete, '*')
    if (ficheSociete instanceof NextResponse) return ficheSociete
    const colonnesFiche = estSocieteBtp ? '*' : 'id'
    const { data: artisan, error: fetchError } = ficheSociete
      ? { data: ficheSociete.fiche as { id: string }, error: null }
      : await supabaseAdmin
        .from('profiles_artisan')
        .select(colonnesFiche)
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
    if (estSocieteBtp) {
      // Société BTP, française ou portugaise (fiche en portugais : /pt/empresa/<adresse>, getProfilePath) : l'adresse
      // publique de la fiche est posée une seule fois (adresse indexée, liens partagés) et ne change plus, même avec le
      // nom. Une fiche qui n'en a pas la reçoit au premier enregistrement venu, quel que soit l'écran (« Mon profil »
      // n'envoie plus le nom s'il n'a pas changé), à partir du nom et de la ville de la fiche.
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
      company_name, bio: ficheSociete ? bioAvecMarqueur(bio, ficheSociete.fiche.bio) : bio, phone, email, slug,
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

    const refusInvite = ficheSociete ? refusOuValidationAutomatique(body, updatePayload, ficheSociete.fiche) : null
    if (refusInvite) return refusInvite

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

    if (updateError && estSocieteBtp && 'slug' in updatePayload && updateError.code === '23505') {
      // Société BTP : adresse publique prise entre-temps par une autre fiche. Les autres champs s'enregistrent sans
      // elle ; la fiche la recevra à un prochain enregistrement.
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
