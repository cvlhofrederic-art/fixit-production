import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { validateBody, serviceEtapesPostSchema, serviceEtapesPatchSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

// ══════════════════════════════════════════════════════════════
// API /api/service-etapes
// CRUD étapes template sur les motifs/services
// ══════════════════════════════════════════════════════════════

async function getUser() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  const supabase = createServerClient(
    url,
    key,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function getArtisan(userId: string) {
  const { data } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

async function verifyServiceOwnership(artisanId: string, serviceId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('services')
    .select('id')
    .eq('id', serviceId)
    .eq('artisan_id', artisanId)
    .maybeSingle()
  return !!data
}

// GET — Lister les étapes d'un service
export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const artisan = await getArtisan(user.id)
    if (!artisan) return NextResponse.json({ error: 'Artisan introuvable' }, { status: 404 })

    const serviceId = request.nextUrl.searchParams.get('service_id')
    if (!serviceId) return NextResponse.json({ error: 'service_id requis' }, { status: 400 })

    const owns = await verifyServiceOwnership(artisan.id, serviceId)
    if (!owns) return NextResponse.json({ error: 'Service non trouvé' }, { status: 404 })

    const { data, error } = await supabaseAdmin
      .from('service_etapes')
      .select('*')
      .eq('service_id', serviceId)
      .order('ordre', { ascending: true })

    if (error) throw error
    return NextResponse.json({ etapes: data || [] })
  } catch (err) {
    logger.error('[service-etapes] GET error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — Créer une étape ou réordonner
export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const artisan = await getArtisan(user.id)
    if (!artisan) return NextResponse.json({ error: 'Artisan introuvable' }, { status: 404 })

    const rawBody = await request.json()
    const v = validateBody(serviceEtapesPostSchema, rawBody)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const body = v.data
    const { service_id, action } = body

    const owns = await verifyServiceOwnership(artisan.id, service_id)
    if (!owns) return NextResponse.json({ error: 'Service non trouvé' }, { status: 404 })

    // Action: reorder
    if (action === 'reorder') {
      const { ordre } = body // [{ id, ordre }]
      if (!Array.isArray(ordre)) return NextResponse.json({ error: 'ordre[] requis' }, { status: 400 })

      for (const item of ordre) {
        await supabaseAdmin
          .from('service_etapes')
          .update({ ordre: item.ordre })
          .eq('id', item.id)
          .eq('service_id', service_id)
      }
      return NextResponse.json({ success: true })
    }

    // Action: create
    const { designation, ordre } = body
    if (!designation?.trim()) return NextResponse.json({ error: 'designation requis' }, { status: 400 })

    // Auto-calculate ordre if not provided
    let finalOrdre = ordre
    if (finalOrdre === undefined || finalOrdre === null) {
      const { data: existing } = await supabaseAdmin
        .from('service_etapes')
        .select('ordre')
        .eq('service_id', service_id)
        .order('ordre', { ascending: false })
        .limit(1)
      finalOrdre = existing && existing.length > 0 ? existing[0].ordre + 1 : 0
    }

    const { data, error } = await supabaseAdmin
      .from('service_etapes')
      .insert({
        service_id,
        designation: designation.trim(),
        ordre: finalOrdre,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ etape: data })
  } catch (err) {
    logger.error('[service-etapes] POST error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH — Modifier une étape
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const artisan = await getArtisan(user.id)
    if (!artisan) return NextResponse.json({ error: 'Artisan introuvable' }, { status: 404 })

    const rawBody = await request.json()
    const v2 = validateBody(serviceEtapesPatchSchema, rawBody)
    if (!v2.success) return NextResponse.json({ error: v2.error }, { status: 400 })
    const { id, service_id, designation, ordre } = v2.data

    const owns = await verifyServiceOwnership(artisan.id, service_id)
    if (!owns) return NextResponse.json({ error: 'Service non trouvé' }, { status: 404 })

    const updates: Record<string, unknown> = {}
    if (designation !== undefined) updates.designation = designation.trim()
    if (ordre !== undefined) updates.ordre = ordre

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('service_etapes')
      .update(updates)
      .eq('id', id)
      .eq('service_id', service_id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ etape: data })
  } catch (err) {
    logger.error('[service-etapes] PATCH error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE — Supprimer une étape
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const artisan = await getArtisan(user.id)
    if (!artisan) return NextResponse.json({ error: 'Artisan introuvable' }, { status: 404 })

    const id = request.nextUrl.searchParams.get('id')
    const serviceId = request.nextUrl.searchParams.get('service_id')
    if (!id || !serviceId) return NextResponse.json({ error: 'id et service_id requis' }, { status: 400 })

    const owns = await verifyServiceOwnership(artisan.id, serviceId)
    if (!owns) return NextResponse.json({ error: 'Service non trouvé' }, { status: 404 })

    const { error } = await supabaseAdmin
      .from('service_etapes')
      .delete()
      .eq('id', id)
      .eq('service_id', serviceId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('[service-etapes] DELETE error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
