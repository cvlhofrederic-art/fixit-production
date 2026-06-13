import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicPrazoSchema, syndicPrazoUpdateSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/syndic/prazos — obligations légales du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`prazos_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_prazos_legais')
      .select('id, cabinet_id, immeuble, titulo, tipo, data_limite, statut, notes, created_at')
      .eq('cabinet_id', cabinetId)
      .order('data_limite', { ascending: true })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const prazos = (data || []).map(p => ({
      id: p.id,
      immeuble: p.immeuble || '',
      titulo: p.titulo || '',
      tipo: p.tipo || '',
      dataLimite: p.data_limite || '',
      statut: p.statut || 'pendente',
      notes: p.notes || '',
    }))

    return NextResponse.json({ prazos })
  } catch (err) {
    logger.error('[syndic/prazos/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/prazos — ajouter une obligation
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`prazos_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const body = await request.json()

    const validation = validateBody(syndicPrazoSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_prazos_legais')
      .insert({
        cabinet_id: cabinetId,
        immeuble: v.immeuble || '',
        titulo: v.titulo,
        tipo: v.tipo || '',
        data_limite: v.dataLimite || null,
        statut: v.statut || 'pendente',
        notes: v.notes || '',
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/prazos/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ prazo: data })
  } catch (err) {
    logger.error('[syndic/prazos/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/syndic/prazos — mettre à jour (statut, …)
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`prazos_patch_${ip}`, 20, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const body = await request.json()
    const validation = validateBody(syndicPrazoUpdateSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const { id, statut, titulo, dataLimite, immeuble, tipo } = validation.data

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (statut !== undefined) updates.statut = statut
    if (titulo !== undefined) updates.titulo = titulo
    if (dataLimite !== undefined) updates.data_limite = dataLimite || null
    if (immeuble !== undefined) updates.immeuble = immeuble
    if (tipo !== undefined) updates.tipo = tipo

    const { data, error } = await supabaseAdmin
      .from('syndic_prazos_legais')
      .update(updates)
      .eq('id', id)
      .eq('cabinet_id', cabinetId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    return NextResponse.json({ prazo: data })
  } catch (err) {
    logger.error('[syndic/prazos/PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/syndic/prazos?id= — supprimer une obligation
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`prazos_delete_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('syndic_prazos_legais')
      .delete()
      .eq('id', id)
      .eq('cabinet_id', cabinetId)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('[syndic/prazos/DELETE] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
