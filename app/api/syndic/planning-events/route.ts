import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { planningEventSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'

// ── Planning Events partagés — table syndic_planning_events
// SQL pour créer la table (à exécuter une fois dans Supabase SQL Editor) :
/*
CREATE TABLE IF NOT EXISTS syndic_planning_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cabinet_id UUID NOT NULL,
  titre TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'autre',
  date DATE NOT NULL,
  heure TEXT NOT NULL DEFAULT '09:00',
  duree_min INTEGER DEFAULT 60,
  assigne_a TEXT NOT NULL DEFAULT '',
  assigne_role TEXT DEFAULT '',
  description TEXT DEFAULT '',
  cree_par TEXT NOT NULL DEFAULT '',
  statut TEXT DEFAULT 'planifie',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_planning_events_cabinet ON syndic_planning_events(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_planning_events_date ON syndic_planning_events(date);
*/

// GET /api/syndic/planning-events — récupérer les événements du cabinet
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`planning_events_get_${ip}`, 60, 60_000))) return rateLimitResponse()

    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)

    const { data, error } = await supabaseAdmin
      .from('syndic_planning_events')
      .select('id, titre, type, date, heure, duree_min, assigne_a, assigne_role, description, cree_par, statut')
      .eq('cabinet_id', cabinetId)
      .order('date', { ascending: true })
      .order('heure', { ascending: true })
      .limit(200)

    // Si la table n'existe pas encore, retourner tableau vide (pas d'erreur)
    if (error) {
      if (error.code === '42P01') return NextResponse.json({ events: [], needsMigration: true })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    const events = (data || []).map(e => ({
      id: e.id,
      titre: e.titre,
      type: e.type,
      date: e.date,
      heure: e.heure,
      dureeMin: e.duree_min,
      assigneA: e.assigne_a,
      assigneRole: e.assigne_role,
      description: e.description,
      creePar: e.cree_par,
      statut: e.statut,
    }))

    const response = NextResponse.json({ events })
    response.headers.set('Cache-Control', 'private, max-age=0, s-maxage=30, stale-while-revalidate=60')
    return response
  } catch (err) {
    logger.error('[syndic/planning-events/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/planning-events — créer un événement
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`planning_events_post_${ip}`, 20, 60_000))) return rateLimitResponse()

    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()

    const eventValidation = validateBody(planningEventSchema, body)
    if (!eventValidation.success) {
      return NextResponse.json({ error: 'Donn\u00e9es invalides', details: eventValidation.error }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('syndic_planning_events')
      .insert({
        cabinet_id: cabinetId,
        titre: body.titre,
        type: body.type || 'autre',
        date: body.date,
        heure: body.heure || '09:00',
        duree_min: body.dureeMin || 60,
        assigne_a: body.assigneA || '',
        assigne_role: body.assigneRole || '',
        description: body.description || '',
        cree_par: body.creePar || '',
        statut: body.statut || 'planifie',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ error: 'needsMigration' }, { status: 503 })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    return NextResponse.json({
      event: {
        id: data.id,
        titre: data.titre,
        type: data.type,
        date: data.date,
        heure: data.heure,
        dureeMin: data.duree_min,
        assigneA: data.assigne_a,
        assigneRole: data.assigne_role,
        description: data.description,
        creePar: data.cree_par,
        statut: data.statut,
      }
    })
  } catch (err) {
    logger.error('[syndic/planning-events/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/syndic/planning-events?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`planning_events_del_${ip}`, 10, 60_000))) return rateLimitResponse()

    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('syndic_planning_events')
      .delete()
      .eq('id', id)
      .eq('cabinet_id', cabinetId)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('[syndic/planning-events/DELETE] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
