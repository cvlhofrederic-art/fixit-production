import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicAgV54Schema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

/**
 * Route v54 dédiée pour ModAGDigit — réutilise la table partagée `syndic_assemblees`
 * avec mapping PT (v54) ↔ FR (colonnes existantes). NE TOUCHE PAS /api/syndic/assemblees
 * (route de l'ancien dashboard FR) : isolation par cabinet_id, données AG unifiées.
 */

const typeToPt = (t: string): string =>
  (({ ordinaire: 'ordinaria', extraordinaire: 'extraordinaria', urgent: 'urgente' } as Record<string, string>)[t] || t || 'ordinaria')

const statutToEstado = (s: string): string => (s === 'clôturée' || s === 'annulée' ? 'encerrada' : 'em-curso')

const odjToText = (odj: unknown): string =>
  Array.isArray(odj)
    ? odj
        .map((x) => {
          if (typeof x === 'string') return x
          const o = (x || {}) as Record<string, unknown>
          return (o.ponto || o.texto || o.label || o.titre || '') as string
        })
        .filter(Boolean)
        .join('\n')
    : ''

const num = (x: unknown) => (typeof x === 'number' ? x : Number(x) || 0)

// GET /api/syndic/ag-v54 — assemblées du cabinet (forme v54 PT)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`agv54_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_assemblees')
      .select('id, cabinet_id, titre, immeuble, date_ag, lieu, type_ag, statut, ordre_du_jour, quorum, total_tantiemes, created_at')
      .eq('cabinet_id', cabinetId)
      .order('date_ag', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const assembleias = (data || []).map((a) => ({
      id: a.id,
      titulo: a.titre || '',
      edificio: a.immeuble || '',
      dataHora: a.date_ag || '',
      tipo: typeToPt(a.type_ag || ''),
      local: a.lieu || '',
      quorum: num(a.quorum),
      milesimos: num(a.total_tantiemes),
      ordem: odjToText(a.ordre_du_jour),
      estado: statutToEstado(a.statut || ''),
    }))

    return NextResponse.json({ assembleias })
  } catch (err) {
    logger.error('[syndic/ag-v54/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/ag-v54 — créer une AG (forme v54 PT → colonnes FR)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`agv54_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()

    const validation = validateBody(syndicAgV54Schema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data
    const ordreDuJour = v.ordem ? v.ordem.split('\n').map((s) => s.trim()).filter(Boolean) : []

    const { data, error } = await supabaseAdmin
      .from('syndic_assemblees')
      .insert({
        cabinet_id: cabinetId,
        titre: v.titulo,
        immeuble: v.edificio || '',
        date_ag: v.dataHora || new Date().toISOString(),
        lieu: v.local || '',
        type_ag: v.tipo || 'ordinaria',
        statut: 'en_cours',
        ordre_du_jour: ordreDuJour,
        quorum: v.quorum ?? 50,
        total_tantiemes: Math.round(v.milesimos ?? 10000),
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/ag-v54/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ assembleia: data })
  } catch (err) {
    logger.error('[syndic/ag-v54/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
