// app/api/syndic/automations/[id]/route.ts
// Détail, modification et suppression (soft) d'une automatisation.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { evaluateCron } from '@/lib/scheduler/cron-evaluator'

const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
  cron_expr: z.string().optional(),
  timezone: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  locale: z.enum(['fr', 'pt']).optional(),
})

async function authAndOwn(req: NextRequest, id: string) {
  const user = await getAuthUser(req)
  if (!user || !isSyndicRole(user)) return { error: 'unauthorized' as const }
  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (!cabinetId) return { error: 'unauthorized' as const }
  const { data: owner } = await supabaseAdmin
    .from('syndic_automations')
    .select('cabinet_id')
    .eq('id', id)
    .maybeSingle()
  if (!owner || owner.cabinet_id !== cabinetId) return { error: 'not_found' as const }
  return { user, cabinetId }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const auth = await authAndOwn(req, id)
  if ('error' in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === 'unauthorized' ? 401 : 404 },
    )
  }

  const { data } = await supabaseAdmin
    .from('syndic_automations')
    .select('*')
    .eq('id', id)
    .single()

  const { data: runs } = await supabaseAdmin
    .from('syndic_automation_runs')
    .select('*')
    .eq('automation_id', id)
    .order('started_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ automation: data, recent_runs: runs ?? [] })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const auth = await authAndOwn(req, id)
  if ('error' in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === 'unauthorized' ? 401 : 404 },
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { ...parsed.data }

  if (parsed.data.cron_expr) {
    const evaluation = evaluateCron(parsed.data.cron_expr, {
      timezone: parsed.data.timezone ?? 'Europe/Paris',
    })
    if (!evaluation.valid) {
      return NextResponse.json({ error: 'invalid_cron' }, { status: 400 })
    }
    updates.next_run_at = evaluation.next.toISOString()
  }

  const { data, error } = await supabaseAdmin
    .from('syndic_automations')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ automation: data })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const auth = await authAndOwn(req, id)
  if ('error' in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === 'unauthorized' ? 401 : 404 },
    )
  }

  // Soft delete : passe à archived
  await supabaseAdmin
    .from('syndic_automations')
    .update({ status: 'archived' })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
