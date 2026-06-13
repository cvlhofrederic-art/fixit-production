// app/api/syndic/automations/route.ts
// CRUD liste + création des automatisations Tempo.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Json } from '@/lib/database-types'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { evaluateCron } from '@/lib/scheduler/cron-evaluator'
import { logger } from '@/lib/logger'

const TASK_TYPES = z.enum([
  'send_email_template',
  'send_appel_charges',
  'send_relance_impaye',
  'send_convocation_ag',
  'generate_monthly_report',
  'remind_echeance_legale',
  'backup_docs',
])

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  task_type: TASK_TYPES,
  cron_expr: z.string().min(9).max(100),
  timezone: z.string().default('Europe/Paris'),
  params: z.record(z.string(), z.unknown()).default({}),
  locale: z.enum(['fr', 'pt']).default('fr'),
})

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (!cabinetId) {
    return NextResponse.json({ error: 'cabinet_not_found' }, { status: 403 })
  }

  const status = req.nextUrl.searchParams.get('status')
  let q = supabaseAdmin
    .from('syndic_automations')
    .select('*')
    .eq('cabinet_id', cabinetId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) q = q.eq('status', status) as typeof q

  const { data, error } = await q
  if (error) {
    logger.error('[automations] GET list failed', { error: error.message })
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ automations: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 })
  }

  const cronEval = evaluateCron(parsed.data.cron_expr, { timezone: parsed.data.timezone })
  if (!cronEval.valid) {
    return NextResponse.json({ error: 'invalid_cron', detail: cronEval.error }, { status: 400 })
  }

  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (!cabinetId) {
    return NextResponse.json({ error: 'cabinet_not_found' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('syndic_automations')
    .insert({
      cabinet_id: cabinetId,
      created_by: user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      task_type: parsed.data.task_type,
      cron_expr: parsed.data.cron_expr,
      timezone: parsed.data.timezone,
      // Frontière jsonb : params est validé par Zod depuis req.json(), donc JSON-sérialisable.
      params: parsed.data.params as Json,
      locale: parsed.data.locale,
      next_run_at: cronEval.next.toISOString(),
    })
    .select()
    .single()

  if (error) {
    logger.error('[automations] POST create failed', { error: error.message, user_id: user.id })
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ automation: data }, { status: 201 })
}
