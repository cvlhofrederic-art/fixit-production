import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { coproSignalementSchema, validateBody } from '@/lib/validation'
import { getAuthUser, getUserRole, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { estSuperAdmin, resoudreCoproprietaire, type AccesCopro } from '@/lib/coproprietaire/acces'

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

    // Copropriétaire ou locataire rattaché à sa fiche (accès activé) : le signalement porte l'identité
    // de la fiche (e-mail, nom, lot), pas celle du corps — un compte ne dépose rien au nom d'un autre lot.
    // Super admin : seulement sur une fiche de son cabinet désignée par `lot` (vue copropriétaire du
    // portail) ; sans lot, il reste un dépôt public au nom du corps.
    const role = user ? getUserRole(user) : ''
    const superAdmin = user ? estSuperAdmin(user) : false
    const lot = typeof body.lot === 'string' ? body.lot : null
    let ficheConnectee: AccesCopro | null = null
    if (user && ((!superAdmin && (role === 'coproprio' || role === 'locataire')) || (superAdmin && lot))) {
      const acces = await resoudreCoproprietaire(user, supabaseAdmin, { coproprioId: lot })
      if (acces.ok) {
        ficheConnectee = acces.acces
        cabinetId = acces.acces.cabinetId
      }
    }

    if (!cabinetId) cabinetId = body.cabinetId || null

    if (!cabinetId && immeuble) {
      const { data: immeubles } = await supabaseAdmin
        .from('syndic_immeubles')
        .select('cabinet_id')
        .ilike('nom', echapperMotifLike(immeuble))
        .limit(1)
      if (immeubles && immeubles.length > 0) {
        cabinetId = immeubles[0].cabinet_id
      }
    }

    const demandeurRole = body.demandeurRole || body.role || 'coproprio'
    if (!['coproprio', 'locataire', 'technicien'].includes(demandeurRole)) {
      return NextResponse.json({ error: 'Rôle demandeur invalide' }, { status: 400 })
    }

    const fiche = ficheConnectee?.fiche ?? null
    const locataire = ficheConnectee?.role === 'locataire'
    const nomFiche = fiche
      ? `${(locataire ? fiche.prenom_locataire : fiche.prenom_proprietaire) || ''} ${(locataire ? fiche.nom_locataire : fiche.nom_proprietaire) || ''}`.trim()
      : ''
    const texteOuNull = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().substring(0, max) : null)

    const ligneSignalement = {
        cabinet_id: cabinetId,
        immeuble_nom: fiche ? (fiche.immeuble || '').trim() || immeuble : immeuble,
        demandeur_nom: (nomFiche || demandeurNom).substring(0, 200),
        demandeur_role: ficheConnectee ? (locataire ? 'locataire' : 'coproprio') : demandeurRole,
        // En minuscules : le suivi (GET ?email= et espace) cherche l'e-mail exact, mis en minuscules.
        demandeur_email: ficheConnectee
          ? ficheConnectee.email
          : (body.demandeurEmail || body.email || '').trim().toLowerCase().substring(0, 200) || null,
        demandeur_telephone: fiche
          ? texteOuNull(locataire ? fiche.tel_locataire : fiche.tel_proprietaire, 20)
          : (body.demandeurTelephone || body.telephone || '').substring(0, 20) || null,
        type_intervention: (body.typeIntervention || body.type || 'Autre').substring(0, 100),
        description: description.substring(0, 5000),
        priorite: ['urgente', 'normale', 'planifiee'].includes(body.priorite) ? body.priorite : 'normale',
        statut: 'en_attente',
        batiment: fiche ? texteOuNull(fiche.batiment, 100) : (body.batiment || '').substring(0, 100) || null,
        etage: fiche ? texteOuNull(fiche.etage === null || fiche.etage === undefined ? '' : String(fiche.etage), 20) : (body.etage || '').substring(0, 20) || null,
        num_lot: fiche ? texteOuNull(fiche.numero_porte, 20) : (body.numLot || '').substring(0, 20) || null,
        est_partie_commune: body.estPartieCommune || false,
        zone_signalee: (body.zoneSignalee || '').substring(0, 200) || null,
    }
    // Provenance (migration 20261017) : identité vérifiée par la fiche, ou dépôt public ; colonne retirée tant qu'elle manque (42703).
    let { data, error } = await supabaseAdmin.from('syndic_signalements').insert({ ...ligneSignalement, origine: ficheConnectee ? 'portail' : 'public' }).select().single()
    if (error?.code === '42703') ({ data, error } = await supabaseAdmin.from('syndic_signalements').insert(ligneSignalement).select().single())

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

// GET /api/coproprietaire/signalement?email= — suivi public (sans compte) des demandes déposées avec
// cet e-mail : statut, type et dates seulement (ni description, ni nom, ni lot, ni prestataire) ; suppressions exclues. Un e-mail connu d'un
// tiers ne doit rien révéler de plus que l'avancement. Le suivi complet (fil, mission, compte rendu)
// passe par GET /api/coproprietaire/espace, avec un compte. Plus de recherche par immeuble (elle
// livrait à quiconque les demandes de tout l'immeuble). E-mail exact, en minuscules ; rate limité.
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`copro_signalement_get_${ip}`, 15, 60_000))) return rateLimitResponse()

  const url = new URL(request.url)
  const email = (url.searchParams.get('email') || '').trim().toLowerCase()

  if (!email) return NextResponse.json({ error: 'email requis' }, { status: 400 })

  // Validation email basique pour éviter l'énumération
  if (!email.includes('@') || email.length < 5) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
  }

  // Stricter per-email rate limit to prevent email enumeration attacks
  // Max 5 unique email lookups per IP per minute
  if (!(await checkRateLimit(`copro_signalement_email_${ip}`, 5, 60_000))) {
    return rateLimitResponse()
  }

  // Recherche exacte (pas de ilike) pour éviter l'énumération
  const { data, error } = await supabaseAdmin
    .from('syndic_signalements')
    .select('id, type_intervention, statut, created_at, updated_at')
    .eq('demandeur_email', email)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    logger.error('[COPRO SIGNALEMENT] lecture du suivi', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }

  const signalements = (data || []).map(s => ({
    id: s.id,
    typeIntervention: s.type_intervention || '',
    statut: s.statut || 'en_attente',
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }))

  const reponse = NextResponse.json({ signalements })
  reponse.headers.set('Cache-Control', 'private, no-store')
  return reponse
}
