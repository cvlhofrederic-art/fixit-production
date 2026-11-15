import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { PLAFONDS_LECTURE_BTP } from '@/lib/btp/plafonds-lecture'

// Tables écrivables par le POST. `ref_taux` (taux de référence globaux, posés par migration) n'y figure pas :
// la route le sert seulement en lecture (`GET /api/btp?table=ref_taux`).
const BTP_TABLES_ECRIVABLES = ['chantiers_btp', 'membres_btp', 'equipes_btp', 'pointages_btp', 'depenses_btp', 'settings_btp', 'situations_btp', 'retenues_btp', 'dc4_btp', 'dce_analyses_btp', 'dpgf_btp', 'charges_fixes', 'rapports_btp'] as const

const btpBodySchema = z.object({
  table: z.enum(BTP_TABLES_ECRIVABLES),
  action: z.enum(['insert', 'update', 'delete', 'upsert_settings', 'import']),
  data: z.unknown().optional(),
  id: z.string().optional(),
})

// ── GET /api/btp — données BTP du compte connecté ───────────────────────────
// ?table=<clé de LECTURES>|settings|all (all : chantiers, membres, equipes, pointages, depenses, settings).
// ?chantier_id=<uuid> filtre aussi les pointages et les dépenses.

/** Une liste lue par la route : source en base, tri et nombre maximal de lignes renvoyées. */
interface LectureListe {
  /** Table ou vue lue en base. */
  source: string
  colonnes?: string
  /** Tri appliqué, dans l'ordre : [colonne, croissant]. */
  tri: Array<[string, boolean]>
  /** Nombre maximal de lignes renvoyées ; absent : la route ne pose pas de limite. */
  plafond?: number
  /** false pour une table de référence commune à tous les comptes (pas de filtre sur owner_id). */
  parProprietaire?: boolean
  /** Le paramètre chantier_id filtre aussi cette liste. */
  parChantier?: boolean
}

// Nombres maximaux de lignes : lib/btp/plafonds-lecture.ts (les écrans en tirent le message d'une liste coupée).
const LECTURES: Record<string, LectureListe> = {
  chantiers: { source: 'chantiers_btp', tri: [['created_at', false]], plafond: PLAFONDS_LECTURE_BTP.chantiers },
  membres: { source: 'membres_btp', tri: [['nom', true]], plafond: PLAFONDS_LECTURE_BTP.membres },
  equipes: { source: 'equipes_btp', colonnes: '*, equipe_membres_btp(membre_id)', tri: [['created_at', false]] },
  pointages: { source: 'pointages_btp', tri: [['date', false]], plafond: PLAFONDS_LECTURE_BTP.pointages, parChantier: true },
  depenses: { source: 'depenses_btp', tri: [['date', false]], plafond: PLAFONDS_LECTURE_BTP.depenses, parChantier: true },
  situations: { source: 'situations_btp', tri: [['created_at', false]], plafond: PLAFONDS_LECTURE_BTP.situations },
  retenues: { source: 'retenues_btp', tri: [['created_at', false]], plafond: PLAFONDS_LECTURE_BTP.retenues },
  dc4: { source: 'dc4_btp', tri: [['created_at', false]], plafond: PLAFONDS_LECTURE_BTP.dc4 },
  dce_analyses: { source: 'dce_analyses_btp', tri: [['created_at', false]], plafond: PLAFONDS_LECTURE_BTP.dce_analyses },
  dpgf: { source: 'dpgf_btp', tri: [['created_at', false]], plafond: PLAFONDS_LECTURE_BTP.dpgf },
  ref_taux: { source: 'ref_taux', tri: [['juridiction', true], ['regime', true], ['type_charge', true]], parProprietaire: false },
  charges_fixes: { source: 'charges_fixes', tri: [['categorie', true], ['label', true]] },
  rapports: { source: 'rapports_btp', tri: [['created_at', false]], plafond: PLAFONDS_LECTURE_BTP.rapports },
  rentabilite: { source: 'v_rentabilite_chantier', tri: [], plafond: PLAFONDS_LECTURE_BTP.rentabilite },
}

const MESSAGE_LECTURE_IMPOSSIBLE = 'Les données n\'ont pas pu être chargées. Réessayez dans un instant.'
const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** La base a répondu en erreur : la route le dit (500) au lieu de renvoyer une liste vide. */
class ErreurLecture extends Error {
  constructor(readonly source: string, readonly erreurBase: { code?: string; message?: string }) {
    super(`lecture de ${source} en erreur`)
  }
}

interface ListeLue {
  lignes: Record<string, unknown>[]
  /** Nombre maximal de lignes atteint : d'autres lignes existent au-delà (null : liste complète). */
  plafondAtteint: number | null
}

async function lireListe(cle: string, userId: string, chantierId: string | null): Promise<ListeLue> {
  const lecture = LECTURES[cle]
  let requete = supabaseAdmin.from(lecture.source).select(lecture.colonnes ?? '*')
  if (lecture.parProprietaire !== false) requete = requete.eq('owner_id', userId)
  if (lecture.parChantier && chantierId) requete = requete.eq('chantier_id', chantierId)
  for (const [colonne, croissant] of lecture.tri) requete = requete.order(colonne, { ascending: croissant })
  // Une ligne de plus que le maximum : sa présence dit que la liste est coupée (constat donnees-btp-10). Les lignes
  // renvoyées restent les mêmes qu'avant : les `plafond` premières dans le même ordre.
  if (lecture.plafond) requete = requete.limit(lecture.plafond + 1)
  const { data, error } = await requete
  if (error) throw new ErreurLecture(lecture.source, error)
  const lignes = (data ?? []) as unknown as Record<string, unknown>[]
  if (lecture.plafond && lignes.length > lecture.plafond) {
    return { lignes: lignes.slice(0, lecture.plafond), plafondAtteint: lecture.plafond }
  }
  return { lignes, plafondAtteint: null }
}

/** `plafondsAtteints` de la réponse : seulement les listes coupées ; absent si toutes sont complètes. */
function plafondsAtteints(listes: Record<string, ListeLue>): { plafondsAtteints?: Record<string, number> } {
  const atteints = Object.fromEntries(
    Object.entries(listes).flatMap(([cle, liste]) => (liste.plafondAtteint === null ? [] : [[cle, liste.plafondAtteint]])),
  )
  return Object.keys(atteints).length > 0 ? { plafondsAtteints: atteints } : {}
}

/** Réglages du compte ; null s'ils n'ont jamais été enregistrés (ce n'est pas une erreur). */
async function lireReglages(userId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseAdmin.from('settings_btp').select('*').eq('owner_id', userId).maybeSingle()
  if (error) throw new ErreurLecture('settings_btp', error)
  return (data ?? null) as Record<string, unknown> | null
}

/** Équipes avec la liste de leurs membres (`membreIds`), lue dans equipe_membres_btp. */
function avecMembreIds(equipes: Record<string, unknown>[]): Record<string, unknown>[] {
  return equipes.map(e => ({
    ...e,
    membreIds: ((e.equipe_membres_btp as { membre_id: string }[] | undefined) || []).map(m => m.membre_id),
  }))
}

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`btp_get_${ip}`, 60, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const url = new URL(request.url)
  const table = url.searchParams.get('table') || 'all'
  const chantierId = url.searchParams.get('chantier_id')
  if (chantierId && !FORMAT_UUID.test(chantierId)) {
    return NextResponse.json({ error: 'Identifiant de chantier invalide' }, { status: 400 })
  }

  try {
    if (table === 'all') {
      const [chantiers, membres, equipes, pointages, depenses, settings] = await Promise.all([
        lireListe('chantiers', user.id, chantierId),
        lireListe('membres', user.id, chantierId),
        lireListe('equipes', user.id, chantierId),
        lireListe('pointages', user.id, chantierId),
        lireListe('depenses', user.id, chantierId),
        lireReglages(user.id),
      ])
      return NextResponse.json({
        chantiers: chantiers.lignes, membres: membres.lignes, equipes: avecMembreIds(equipes.lignes),
        pointages: pointages.lignes, depenses: depenses.lignes, settings,
        ...plafondsAtteints({ chantiers, membres, equipes, pointages, depenses }),
      })
    }

    if (table === 'settings') return NextResponse.json({ settings: await lireReglages(user.id) })

    if (!Object.prototype.hasOwnProperty.call(LECTURES, table)) {
      return NextResponse.json({ error: 'Table invalide' }, { status: 400 })
    }
    const liste = await lireListe(table, user.id, chantierId)
    return NextResponse.json({
      [table]: table === 'equipes' ? avecMembreIds(liste.lignes) : liste.lignes,
      ...plafondsAtteints({ [table]: liste }),
    })
  } catch (err) {
    // Panne, délai dépassé, table ou colonne absente : jamais une liste vide inventée (constat api-coeur-6).
    if (err instanceof ErreurLecture) {
      logger.error('[btp] GET : la base a répondu en erreur', { source: err.source, code: err.erreurBase.code, error: err.erreurBase.message })
    } else {
      logger.error('[btp] GET error', { error: err instanceof Error ? err.message : err })
    }
    return NextResponse.json({ error: MESSAGE_LECTURE_IMPOSSIBLE }, { status: 500 })
  }
}

// ── POST /api/btp — Create or update BTP data ───────────────────────────────
// Body: { table: string, action: 'insert'|'update'|'delete'|'upsert_settings'|'import', data: unknown (varies per table), id?: string }
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`btp_post_${ip}`, 30, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  let rawBody: unknown
  try { rawBody = await request.json() } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const parsed = btpBodySchema.safeParse(rawBody)
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { table, action, data, id } = parsed.data as { table: typeof BTP_TABLES_ECRIVABLES[number]; action: string; data: any; id?: string } // eslint-disable-line @typescript-eslint/no-explicit-any -- BTP data varies per table

  try {
    // ── Import from localStorage (batch insert) ──────────────────────────────
    if (action === 'import' && Array.isArray(data)) {
      if (data.length > 500) return NextResponse.json({ error: 'Import limité à 500 lignes max' }, { status: 400 })
      const rows = data.map((d: Record<string, unknown>) => {
        // F02: strip system/dangerous fields before spreading user data
        const { created_at: _ca, updated_at: _ua, owner_id: _oid, id: _id, ...rest } = d
        return { ...rest, owner_id: user.id }
      })
      const { data: inserted, error } = await supabaseAdmin
        .from(table)
        .insert(rows)
        .select()
      if (error) throw error
      logger.info(`[btp] Import ${table}`, { count: rows.length, userId: user.id })
      return NextResponse.json({ imported: inserted?.length || 0 })
    }

    // ── Upsert settings ──────────────────────────────────────────────────────
    if (action === 'upsert_settings') {
      // F02: strip blacklisted fields before spreading user data
      const { owner_id: _oid, id: _id, created_at: _ca, ...safeData } = (data || {}) as Record<string, unknown>
      const { data: result, error } = await supabaseAdmin
        .from('settings_btp')
        .upsert({ ...safeData, updated_at: new Date().toISOString(), owner_id: user.id })
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ settings: result })
    }

    // ── Validation rôle/contrat pour membres_btp ─────────────────────────────
    if (table === 'membres_btp' && (action === 'insert' || action === 'update')) {
      const CONTRATS_PAR_ROLE: Record<string, string[]> = {
        gerant: ['independant'],
        ouvrier: ['cdi', 'cdd', 'interim', 'apprenti'],
        chef_chantier: ['cdi', 'cdd', 'interim'],
        conducteur_travaux: ['cdi', 'cdd'],
        secretaire: ['cdi', 'cdd', 'apprenti', 'stage'],
      }
      const role = data.type_compte
      const contrat = data.type_contrat
      if (role && contrat && CONTRATS_PAR_ROLE[role] && !CONTRATS_PAR_ROLE[role].includes(contrat)) {
        return NextResponse.json(
          { error: `Contrat "${contrat}" invalide pour le rôle "${role}". Contrats autorisés : ${CONTRATS_PAR_ROLE[role].join(', ')}` },
          { status: 400 }
        )
      }
    }

    // ── Insert ───────────────────────────────────────────────────────────────
    if (action === 'insert') {
      const row = { ...data, owner_id: user.id }
      // Strip dangerous/system keys
      delete row.id; delete row.created_at
      const membreIds = row.membreIds
      delete row.membreIds
      delete row.equipe_membres_btp

      const { data: inserted, error } = await supabaseAdmin
        .from(table)
        .insert(row)
        .select()
        .single()
      if (error) throw error

      // Link membres to equipe if applicable
      if (table === 'equipes_btp' && membreIds?.length > 0) {
        await supabaseAdmin.from('equipe_membres_btp').insert(
          membreIds.map((mid: string) => ({ equipe_id: inserted.id, membre_id: mid }))
        )
      }

      return NextResponse.json({ row: inserted }, { status: 201 })
    }

    // ── Update ───────────────────────────────────────────────────────────────
    if (action === 'update' && id) {
      const row = { ...data }
      delete row.id
      delete row.owner_id
      const membreIds = row.membreIds
      delete row.membreIds
      delete row.equipe_membres_btp

      if (table === 'chantiers_btp') row.updated_at = new Date().toISOString()

      // Aucune colonne à écrire (seuls les membres d'une équipe changent) : PostgREST ne renvoie aucune ligne pour
      // un UPDATE vide, et la modification échouerait. On lit alors la ligne, ce qui vérifie qu'elle appartient
      // bien à l'appelant avant de toucher à ses membres.
      const cible = Object.keys(row).length === 0
        ? supabaseAdmin.from(table).select().eq('id', id).eq('owner_id', user.id).single()
        : supabaseAdmin.from(table).update(row).eq('id', id).eq('owner_id', user.id).select().single()
      const { data: updated, error } = await cible
      if (error) throw error

      // Re-sync equipe membres
      if (table === 'equipes_btp' && membreIds) {
        await supabaseAdmin.from('equipe_membres_btp').delete().eq('equipe_id', id)
        if (membreIds.length > 0) {
          await supabaseAdmin.from('equipe_membres_btp').insert(
            membreIds.map((mid: string) => ({ equipe_id: id, membre_id: mid }))
          )
        }
      }

      return NextResponse.json({ row: updated })
    }

    // ── Delete ───────────────────────────────────────────────────────────────
    if (action === 'delete' && id) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq('id', id)
        .eq('owner_id', user.id)
      if (error) throw error
      return NextResponse.json({ deleted: true })
    }

    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
  } catch (err) {
    logger.error(`[btp] POST ${table} ${action} error`, { error: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
