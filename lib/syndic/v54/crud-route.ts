import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { Database } from '@/lib/database-types'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

/**
 * Factory CRUD pour les routes syndic v54 list/create (GET + POST).
 *
 * Factorise le boilerplate identique de chaque route (auth isSyndicRole → 401,
 * rate-limit, resolveCabinetId, pagination, mapping snake↔camel, gestion d'erreur)
 * pour éliminer la duplication. Chaque route ne fournit plus que sa config :
 * table, colonnes, ordre, clés de réponse, schéma Zod, mappers.
 *
 * Isolation : toutes les requêtes sont scopées `.eq('cabinet_id', cabinetId)` et
 * les tables portent une RLS stricte `cabinet_id = auth.uid()`.
 */

export type Row = Record<string, unknown>

/** Coercions sûres depuis une colonne `unknown` (jamais de `any`). */
export const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)
export const num = (v: unknown, d = 0): number => (typeof v === 'number' ? v : Number(v) || d)
export const bool = (v: unknown): boolean => !!v

// `table: string` forçait supabase-js à instancier l'union des ~138 tables du
// schéma (TS2589 « type instantiation excessively deep »). On contraint donc la
// config à un nom de table précis : chaque route passe un littéral, TTable
// s'infère, et `from()`/`insert()` ne résolvent que la table concernée.
type SyndicTableName = keyof Database['public']['Tables'] & string
// Miroir exact de la contrainte du paramètre de `insert()` (postgrest-js) : avec un
// TTable générique le conditionnel reste différé, et seule cette forme identique
// permet à TS de prouver l'assignabilité sans résoudre les 138 tables.
type TableInsert<TTable extends SyndicTableName> = Database['public']['Tables'][TTable] extends {
  Insert: unknown
}
  ? Database['public']['Tables'][TTable]['Insert']
  : never

interface CrudConfig<TIn, TTable extends SyndicTableName> {
  /** Nom de la table Postgres (ex. `syndic_reservas`). */
  table: TTable
  /** Colonnes du SELECT (inclure `cabinet_id`). */
  select: string
  /** Colonne de tri. */
  orderBy: string
  /** Tri ascendant (défaut : false → desc). */
  ascending?: boolean
  /** Clé du tableau dans la réponse GET (ex. `reservas`). */
  listKey: string
  /** Clé de l'objet dans la réponse POST (ex. `reserva`). */
  itemKey: string
  /** Préfixe des clés de rate-limit + des logs. */
  rateKey: string
  /** Schéma Zod de validation du body POST. */
  schema: z.ZodSchema<TIn>
  /** Mapping ligne DB (snake) → objet client (camel). */
  mapRow: (row: Row) => Record<string, unknown>
  /** Mapping body validé → objet d'insertion DB (ajouter cabinet_id). */
  mapInsert: (v: TIn, cabinetId: string) => TableInsert<TTable>
}

export function createSyndicCrudRoute<TIn, TTable extends SyndicTableName>(cfg: CrudConfig<TIn, TTable>) {
  async function GET(request: NextRequest) {
    try {
      const user = await getAuthUser(request)
      if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      const ip = getClientIP(request)
      if (!(await checkRateLimit(`${cfg.rateKey}_get_${ip}`, 30, 60_000))) return rateLimitResponse()

      const cabinetId = await resolveCabinetId(user, supabaseAdmin)
      if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      const { from, to } = parsePagination(new URL(request.url))

      const { data, error } = await supabaseAdmin
        .from(cfg.table)
        .select(cfg.select)
        // `.filter(col, 'eq', v)` ≡ `.eq(col, v)` (même querystring PostgREST) ; avec
        // TTable générique, `.eq` ne résout pas le type de la colonne (conditionnel différé).
        .filter('cabinet_id', 'eq', cabinetId)
        .order(cfg.orderBy, { ascending: cfg.ascending ?? false })
        .range(from, to)

      if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

      return NextResponse.json({ [cfg.listKey]: ((data ?? []) as unknown as Row[]).map(cfg.mapRow) })
    } catch (err) {
      logger.error(`[syndic/${cfg.rateKey}/GET] Unexpected error:`, err)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  async function POST(request: NextRequest) {
    try {
      const user = await getAuthUser(request)
      if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      const ip = getClientIP(request)
      if (!(await checkRateLimit(`${cfg.rateKey}_post_${ip}`, 10, 60_000))) return rateLimitResponse()

      const cabinetId = await resolveCabinetId(user, supabaseAdmin)
      if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      const body = await request.json()

      const validation = validateBody(cfg.schema, body)
      if (!validation.success) {
        return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
      }

      const { data, error } = await supabaseAdmin
        .from(cfg.table)
        .insert(cfg.mapInsert(validation.data, cabinetId))
        .select()
        .single()

      if (error) {
        logger.error(`[syndic/${cfg.rateKey}/POST] insert error:`, error)
        return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
      }
      return NextResponse.json({ [cfg.itemKey]: data })
    } catch (err) {
      logger.error(`[syndic/${cfg.rateKey}/POST] Unexpected error:`, err)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  return { GET, POST }
}
