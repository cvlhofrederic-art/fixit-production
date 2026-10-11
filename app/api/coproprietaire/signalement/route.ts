import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { coproSignalementSchema, validateBody } from '@/lib/validation'
import { getAuthUser, getUserRole, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

/** Échappe les jokers de LIKE (% _ \) : la recherche ilike reste une égalité insensible à la casse. */
function echapperMotifLike(valeur: string): string {
  return valeur.replace(/[\\%_]/g, c => `\\${c}`)
}

/**
 * Cabinet d'un utilisateur connecté (jeton Bearer) :
 * - syndic, employé de cabinet ou super admin → son cabinet (resolveCabinetId) ;
 * - super admin qui consulte un autre tableau de bord (rôle d'emprunt, _original_role) → son propre id,
 *   qui est aussi son cabinet de syndic ;
 * - copropriétaire ou locataire → cabinet de sa fiche syndic_coproprios (même e-mail, casse ignorée).
 * null quand rien ne permet de le déterminer : la route retombe alors sur le comportement public.
 */
async function cabinetDeLUtilisateur(user: User, immeuble: string): Promise<string | null> {
  if (isSyndicRole(user)) return resolveCabinetId(user, supabaseAdmin)
  if (user.app_metadata?._original_role === 'super_admin') return user.id

  const role = getUserRole(user)
  const email = (user.email || '').trim().toLowerCase()
  if ((role !== 'coproprio' && role !== 'locataire') || !email) return null

  const { data, error } = await supabaseAdmin
    .from('syndic_coproprios')
    .select('cabinet_id, email_proprietaire, immeuble')
    .ilike('email_proprietaire', echapperMotifLike(email))
    .limit(10)
  if (error) {
    logger.error('[COPRO SIGNALEMENT] recherche du cabinet du copropriétaire', { code: error.code, message: error.message })
    return null
  }
  // Égalité stricte vérifiée ici : PostgREST traite aussi « * » comme un joker dans un motif ilike.
  const fiches = (data || []).filter(f => f.cabinet_id && (f.email_proprietaire || '').trim().toLowerCase() === email)
  const immeubleCherche = immeuble.toLowerCase()
  const memeImmeuble = immeubleCherche ? fiches.find(f => (f.immeuble || '').trim().toLowerCase() === immeubleCherche) : undefined
  return (memeImmeuble ?? fiches[0])?.cabinet_id ?? null
}

// POST /api/coproprietaire/signalement — créer un signalement
// Rate-limité pour éviter le spam. Sans jeton : appel public (copropriétaires non inscrits, QR code) ;
// avec un jeton Bearer valide, le cabinet est déduit du compte connecté (voir cabinetDeLUtilisateur).
export async function POST(request: NextRequest) {
  try {
    // Rate limiting strict
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`copro_signalement_post_${ip}`, 5, 60_000))) return rateLimitResponse()

    const body = await request.json()

    // Zod schema validation
    const coproValidation = validateBody(coproSignalementSchema, body)
    if (!coproValidation.success) {
      return NextResponse.json({ error: 'Donn\u00e9es invalides', details: coproValidation.error }, { status: 400 })
    }

    // Validation des champs obligatoires (kept for backward compatibility with flexible field names)
    const description = (body.description || '').trim()
    const demandeurNom = (body.demandeurNom || body.nom || '').trim()
    const immeuble = (body.immeuble || body.immeubleNom || '').trim()

    if (!description || description.length < 10) {
      return NextResponse.json({ error: 'Description requise (minimum 10 caract\u00e8res)' }, { status: 400 })
    }
    if (!demandeurNom || demandeurNom.length < 2) {
      return NextResponse.json({ error: 'Nom du demandeur requis' }, { status: 400 })
    }
    if (description.length > 5000) {
      return NextResponse.json({ error: 'Description trop longue (max 5000 caract\u00e8res)' }, { status: 400 })
    }

    // 1. Compte connecté : cabinet déduit du jeton. 2. Sinon : cabinetId transmis, puis nom de l'immeuble.
    const user = await getAuthUser(request)
    let cabinetId: string | null = user ? await cabinetDeLUtilisateur(user, immeuble) : null

    if (!cabinetId) cabinetId = body.cabinetId || null

    if (!cabinetId && immeuble) {
      const { data: immeubles } = await supabaseAdmin
        .from('syndic_immeubles')
        .select('cabinet_id')
        .ilike('nom', immeuble)
        .limit(1)
      if (immeubles && immeubles.length > 0) {
        cabinetId = immeubles[0].cabinet_id
      }
    }

    const demandeurRole = body.demandeurRole || body.role || 'coproprio'
    if (!['coproprio', 'locataire', 'technicien'].includes(demandeurRole)) {
      return NextResponse.json({ error: 'Rôle demandeur invalide' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('syndic_signalements')
      .insert({
        cabinet_id: cabinetId,
        immeuble_nom: immeuble,
        demandeur_nom: demandeurNom.substring(0, 200),
        demandeur_role: demandeurRole,
        // En minuscules : le suivi (GET ?email=) cherche l'e-mail exact, mis en minuscules.
        demandeur_email: (body.demandeurEmail || body.email || '').trim().toLowerCase().substring(0, 200) || null,
        demandeur_telephone: (body.demandeurTelephone || body.telephone || '').substring(0, 20) || null,
        type_intervention: (body.typeIntervention || body.type || 'Autre').substring(0, 100),
        description: description.substring(0, 5000),
        priorite: ['urgente', 'normale', 'planifiee'].includes(body.priorite) ? body.priorite : 'normale',
        statut: 'en_attente',
        batiment: (body.batiment || '').substring(0, 100) || null,
        etage: (body.etage || '').substring(0, 20) || null,
        num_lot: (body.numLot || '').substring(0, 20) || null,
        est_partie_commune: body.estPartieCommune || false,
        zone_signalee: (body.zoneSignalee || '').substring(0, 200) || null,
      })
      .select()
      .single()

    if (error) {
      logger.error('[COPRO SIGNALEMENT] insertion refusée', {
        code: error.code, message: error.message, details: error.details, cabinetId, authentifie: Boolean(user),
      })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ signalement: data })
  } catch (e: unknown) {
    logger.error('[COPRO SIGNALEMENT]', e)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }
}

// GET /api/coproprietaire/signalement — récupérer ses signalements
// Requiert email exact (pas de wildcard) + rate limiting
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`copro_signalement_get_${ip}`, 15, 60_000))) return rateLimitResponse()

  const url = new URL(request.url)
  const email = (url.searchParams.get('email') || '').trim().toLowerCase()
  const immeuble = url.searchParams.get('immeuble')

  if (!email && !immeuble) {
    return NextResponse.json({ error: 'email ou immeuble requis' }, { status: 400 })
  }

  // Validation email basique pour éviter l'énumération
  if (email && (!email.includes('@') || email.length < 5)) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
  }

  // Stricter per-email rate limit to prevent email enumeration attacks
  // Max 5 unique email lookups per IP per minute
  if (email && !(await checkRateLimit(`copro_signalement_email_${ip}`, 5, 60_000))) {
    return rateLimitResponse()
  }

  let query = supabaseAdmin
    .from('syndic_signalements')
    .select('id, immeuble_nom, demandeur_nom, demandeur_role, type_intervention, description, priorite, statut, batiment, etage, num_lot, est_partie_commune, zone_signalee, artisan_assigne, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(50)

  // Recherche exacte (pas de ilike) pour éviter l'énumération
  if (email) query = query.eq('demandeur_email', email)
  if (immeuble) query = query.eq('immeuble_nom', immeuble)

  const { data, error } = await query

  if (error) {
    logger.error('[COPRO SIGNALEMENT] lecture du suivi', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }

  const signalements = (data || []).map(s => ({
    id: s.id,
    immeuble: s.immeuble_nom || '',
    demandeurNom: s.demandeur_nom || '',
    demandeurRole: s.demandeur_role || '',
    typeIntervention: s.type_intervention || '',
    description: s.description || '',
    priorite: s.priorite || 'normale',
    statut: s.statut || 'en_attente',
    batiment: s.batiment || '',
    etage: s.etage || '',
    numLot: s.num_lot || '',
    estPartieCommune: s.est_partie_commune || false,
    zoneSignalee: s.zone_signalee || '',
    artisanAssigne: s.artisan_assigne || '',
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }))

  return NextResponse.json({ signalements })
}
