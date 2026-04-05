import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const BTP_VALID_TABLES = ['chantiers_btp', 'membres_btp', 'equipes_btp', 'pointages_btp', 'depenses_btp', 'settings_btp'] as const

const btpBodySchema = z.object({
  table: z.enum(BTP_VALID_TABLES),
  action: z.enum(['insert', 'update', 'delete', 'upsert_settings', 'import']),
  data: z.unknown().optional(),
  id: z.string().optional(),
})

// ── GET /api/btp — Fetch all BTP data for the authenticated user ─────────────
// Returns: chantiers, membres, equipes, pointages, depenses, settings
// Query params: ?table=chantiers|membres|equipes|pointages|depenses|settings|all
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`btp_get_${ip}`, 60, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const url = new URL(request.url)
  const table = url.searchParams.get('table') || 'all'
  const chantierId = url.searchParams.get('chantier_id')

  const result: Record<string, unknown> = {}

  try {
    if (table === 'all' || table === 'chantiers') {
      const { data } = await supabaseAdmin
        .from('chantiers_btp')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200)
      result.chantiers = data || []
    }

    if (table === 'all' || table === 'membres') {
      const { data } = await supabaseAdmin
        .from('membres_btp')
        .select('*')
        .eq('owner_id', user.id)
        .order('nom', { ascending: true })
        .limit(500)
      result.membres = data || []
    }

    if (table === 'all' || table === 'equipes') {
      const { data } = await supabaseAdmin
        .from('equipes_btp')
        .select('*, equipe_membres_btp(membre_id)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
      result.equipes = (data || []).map((e: { equipe_membres_btp?: { membre_id: string }[]; [key: string]: unknown }) => ({
        ...e,
        membreIds: (e.equipe_membres_btp || []).map((m) => m.membre_id),
      }))
    }

    if (table === 'all' || table === 'pointages') {
      let q = supabaseAdmin
        .from('pointages_btp')
        .select('*')
        .eq('owner_id', user.id)
        .order('date', { ascending: false })
        .limit(500)
      if (chantierId) q = q.eq('chantier_id', chantierId)
      const { data } = await q
      result.pointages = data || []
    }

    if (table === 'all' || table === 'depenses') {
      let q = supabaseAdmin
        .from('depenses_btp')
        .select('*')
        .eq('owner_id', user.id)
        .order('date', { ascending: false })
        .limit(500)
      if (chantierId) q = q.eq('chantier_id', chantierId)
      const { data } = await q
      result.depenses = data || []
    }

    if (table === 'all' || table === 'settings') {
      const { data } = await supabaseAdmin
        .from('settings_btp')
        .select('*')
        .eq('owner_id', user.id)
        .single()
      result.settings = data || null
    }

    // Rentabilité view
    if (table === 'rentabilite') {
      const { data } = await supabaseAdmin
        .from('v_rentabilite_chantier')
        .select('*')
        .eq('owner_id', user.id)
        .limit(100)
      result.rentabilite = data || []
    }

    return NextResponse.json(result)
  } catch (err) {
    logger.error('[btp] GET error', { error: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
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

  const { table, action, data, id } = parsed.data as { table: typeof BTP_VALID_TABLES[number]; action: string; data: any; id?: string } // eslint-disable-line @typescript-eslint/no-explicit-any -- BTP data varies per table

  try {
    // ── Import from localStorage (batch insert) ──────────────────────────────
    if (action === 'import' && Array.isArray(data)) {
      const rows = data.map((d: Record<string, unknown>) => ({ ...d, owner_id: user.id }))
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
      const { data: result, error } = await supabaseAdmin
        .from('settings_btp')
        .upsert({ owner_id: user.id, ...data, updated_at: new Date().toISOString() })
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
      // Handle equipe membreIds separately
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

      const { data: updated, error } = await supabaseAdmin
        .from(table)
        .update(row)
        .eq('id', id)
        .eq('owner_id', user.id)
        .select()
        .single()
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
