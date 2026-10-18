import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicSignalementMessageSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'

const COLONNES_SIGNALEMENT = 'id, immeuble_nom, demandeur_nom, demandeur_role, demandeur_email, demandeur_telephone, type_intervention, description, priorite, statut, batiment, etage, num_lot, est_partie_commune, zone_signalee, artisan_assigne, created_at, updated_at'
const FIL_MESSAGES = 'syndic_signalement_messages ( id, auteur, role, texte, created_at )'

/** Provenance d'un signalement (colonne `origine`, migration 20261017) ; null tant que la colonne manque. */
type OrigineSignalement = 'portail' | 'public' | null

interface LigneMessage { id: string; auteur: string; role: string; texte: string; created_at: string }

interface LigneSignalement {
  id: string
  immeuble_nom: string | null
  demandeur_nom: string | null
  demandeur_role: string | null
  demandeur_email: string | null
  demandeur_telephone: string | null
  type_intervention: string | null
  description: string | null
  priorite: string | null
  statut: string | null
  batiment: string | null
  etage: string | null
  num_lot: string | null
  est_partie_commune: boolean | null
  zone_signalee: string | null
  artisan_assigne: string | null
  created_at: string
  updated_at: string | null
  origine?: string | null
  syndic_signalement_messages?: LigneMessage[] | null
}

interface ErreurSupabase { code?: string; message?: string }

/** Colonne inconnue de la base (Postgres 42703, message PostgREST « column … does not exist »). */
function colonneAbsente(error: ErreurSupabase | null): boolean {
  if (!error) return false
  return error.code === '42703' || /column .* does not exist/i.test(error.message ?? '')
}

const origineDe = (valeur: string | null | undefined): OrigineSignalement =>
  valeur === 'portail' || valeur === 'public' ? valeur : null

/**
 * Avertissement « colonne origine absente » émis une seule fois par instance : le Canal de communication
 * relit les demandes toutes les 15 s, un avertissement par lecture noierait les journaux.
 */
let origineAbsenteSignalee = false

/**
 * Signalements du cabinet avec leur provenance (`origine`). Tant que la migration 20261017 n'est pas
 * appliquée (42703), ils sont relus sans la colonne : la provenance est alors inconnue (null).
 */
async function lireSignalements(cabinetId: string): Promise<{ data: LigneSignalement[] | null; error: ErreurSupabase | null }> {
  const requete = (colonnes: string) => supabaseAdmin
    .from('syndic_signalements')
    .select(colonnes)
    .eq('cabinet_id', cabinetId)
    .order('created_at', { ascending: false })
    .limit(100)

  const premiere = await requete(`${COLONNES_SIGNALEMENT}, origine, ${FIL_MESSAGES}`)
  if (!premiere.error) return { data: premiere.data as unknown as LigneSignalement[] | null, error: null }
  if (!colonneAbsente(premiere.error)) return { data: null, error: premiere.error }

  if (!origineAbsenteSignalee) {
    origineAbsenteSignalee = true
    logger.warn('[syndic/signalements] colonne origine absente (migration 20261017 non appliquée) : signalements servis sans provenance')
  }
  const seconde = await requete(`${COLONNES_SIGNALEMENT}, ${FIL_MESSAGES}`)
  return { data: seconde.data as unknown as LigneSignalement[] | null, error: seconde.error }
}

// GET /api/syndic/signalements — récupérer les signalements du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const { data, error } = await lireSignalements(cabinetId)

    if (error) {
      logger.error('[syndic/signalements/GET] lecture signalements', { code: error.code, message: error.message })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    const signalements = (data || []).map(s => ({
      id: s.id,
      immeuble: s.immeuble_nom || '',
      demandeurNom: s.demandeur_nom || '',
      demandeurRole: s.demandeur_role || '',
      demandeurEmail: s.demandeur_email || '',
      demandeurTelephone: s.demandeur_telephone || '',
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
      // Provenance : 'portail' = compte rattaché à sa fiche (identité vérifiée), 'public' = formulaire sans
      // compte (e-mail non vérifié), null = inconnue (colonne absente ou valeur inattendue).
      origine: origineDe(s.origine),
      messages: (s.syndic_signalement_messages || []).map((m: LigneMessage) => ({
        id: m.id,
        auteur: m.auteur,
        role: m.role,
        texte: m.texte,
        createdAt: m.created_at,
      })),
    }))

    const response = NextResponse.json({ signalements })
    // Jamais de cache : une demande déposée par un copropriétaire doit apparaître au syndic sans délai.
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  } catch (err) {
    console.error('[syndic/signalements/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/syndic/signalements — mettre à jour un signalement
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (updates.statut !== undefined) dbUpdates.statut = updates.statut
    if (updates.artisanAssigne !== undefined) dbUpdates.artisan_assigne = updates.artisanAssigne
    if (updates.priorite !== undefined) dbUpdates.priorite = updates.priorite

    const { data, error } = await supabaseAdmin
      .from('syndic_signalements')
      .update(dbUpdates)
      .eq('id', id)
      .eq('cabinet_id', cabinetId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    return NextResponse.json({ signalement: data })
  } catch (err) {
    console.error('[syndic/signalements/PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/signalements/message — ajouter un message (via query param action=message)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await request.json()
    const validation = validateBody(syndicSignalementMessageSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Donn\u00e9es invalides', details: validation.error }, { status: 400 })
    }
    const { signalementId, auteur, role, texte } = validation.data

    // Le signalement doit appartenir au cabinet de l'utilisateur.
    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { data: sig, error: sigErr } = await supabaseAdmin
      .from('syndic_signalements')
      .select('id')
      .eq('id', signalementId)
      .eq('cabinet_id', cabinetId)
      .maybeSingle()
    if (sigErr) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    if (!sig) return NextResponse.json({ error: 'Signalement introuvable' }, { status: 404 })

    const { data, error } = await supabaseAdmin
      .from('syndic_signalement_messages')
      .insert({
        signalement_id: signalementId,
        auteur: auteur || 'Gestionnaire',
        role: role || 'gestionnaire',
        texte,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    return NextResponse.json({ message: data })
  } catch (err) {
    console.error('[syndic/signalements/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
