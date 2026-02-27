import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'

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
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user.user_metadata?.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const cabinetId = user.user_metadata?.cabinet_id || user.id

  const { data, error } = await supabaseAdmin
    .from('syndic_planning_events')
    .select('*')
    .eq('cabinet_id', cabinetId)
    .order('date', { ascending: true })
    .order('heure', { ascending: true })

  // Si la table n'existe pas encore, retourner tableau vide (pas d'erreur)
  if (error) {
    if (error.code === '42P01') return NextResponse.json({ events: [], needsMigration: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
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

  return NextResponse.json({ events })
}

// POST /api/syndic/planning-events — créer un événement
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user.user_metadata?.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const cabinetId = user.user_metadata?.cabinet_id || user.id
  const body = await request.json()

  if (!body.titre?.trim() || !body.date) {
    return NextResponse.json({ error: 'titre et date requis' }, { status: 400 })
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
    return NextResponse.json({ error: error.message }, { status: 500 })
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
}

// DELETE /api/syndic/planning-events?id=xxx
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user.user_metadata?.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const cabinetId = user.user_metadata?.cabinet_id || user.id
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('syndic_planning_events')
    .delete()
    .eq('id', id)
    .eq('cabinet_id', cabinetId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
