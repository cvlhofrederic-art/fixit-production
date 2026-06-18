// app/api/syndic/dashboard-prefs/route.ts
// Phase A3 — préférences de la barre latérale (ordre + masqués), 1 ligne par cabinet.
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'

const PrefsSchema = z.object({
  itemOrder: z.array(z.string().max(64)).max(200).optional(),
  itemsHidden: z.array(z.string().max(64)).max(200).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('syndic_dashboard_prefs')
      .select('item_order, items_hidden')
      .eq('cabinet_id', cabinetId)
      .maybeSingle()
    if (error) {
      logger.error('[dashboard-prefs/GET]', error)
      return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
    return NextResponse.json({ prefs: { itemOrder: data?.item_order ?? [], itemsHidden: data?.items_hidden ?? [] } })
  } catch (err) {
    logger.error('[dashboard-prefs/GET] unexpected', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`dashboard-prefs:${ip}`, 30, 60_000))) return rateLimitResponse()
    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const v = validateBody(PrefsSchema, body)
    if (!v.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('syndic_dashboard_prefs')
      .upsert({
        cabinet_id: cabinetId,
        item_order: v.data.itemOrder ?? [],
        items_hidden: v.data.itemsHidden ?? [],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'cabinet_id' })
    if (error) {
      logger.error('[dashboard-prefs/PUT]', error)
      return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('[dashboard-prefs/PUT] unexpected', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
