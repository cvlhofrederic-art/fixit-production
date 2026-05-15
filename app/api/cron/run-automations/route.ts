// app/api/cron/run-automations/route.ts
// Endpoint invoqué par GitHub Actions cron (*/5 * * * *).
// Protégé par header x-cron-secret = INTERNAL_API_SECRET.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { evaluateCron } from '@/lib/scheduler/cron-evaluator'
import { executeTaskHandler } from '@/lib/scheduler/task-handlers'
import { logger } from '@/lib/logger'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  // Auth : header secret partagé
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // 1. Sélectionner les automations actives dont next_run_at <= now
  const { data: dueAutomations, error } = await supabaseAdmin
    .from('syndic_automations')
    .select('*')
    .eq('status', 'active')
    .lte('next_run_at', now.toISOString())
    .limit(50)

  if (error) {
    logger.error('[cron] fetch due automations failed', { error: error.message })
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  const results: Array<{ automation_id: string; status: string; emails_sent: number }> = []

  for (const automation of ((dueAutomations ?? []) as Record<string, unknown>[])) {
    // 2. Insert run record (status=running)
    const { data: run } = await supabaseAdmin
      .from('syndic_automation_runs')
      .insert({
        automation_id: automation.id,
        cabinet_id: automation.cabinet_id,
        started_at: new Date().toISOString(),
        status: 'running',
      })
      .select()
      .single()

    if (!run) continue

    // 3. Execute handler
    let result
    try {
      result = await executeTaskHandler({
        automation: automation as Parameters<typeof executeTaskHandler>[0]['automation'],
        supabase: supabaseAdmin as Parameters<typeof executeTaskHandler>[0]['supabase'],
        runId: (run as { id: string }).id,
      })
    } catch (err) {
      result = {
        status: 'failed' as const,
        emails_sent: 0,
        docs_generated: 0,
        error_message: err instanceof Error ? err.message : 'handler_threw',
      }
    }

    // 4. Update run record
    await supabaseAdmin
      .from('syndic_automation_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: result.status,
        emails_sent: result.emails_sent,
        docs_generated: result.docs_generated,
        error_message: result.error_message ?? null,
        result_meta: result.result_meta ?? null,
      })
      .eq('id', (run as { id: string }).id)

    // 5. Update automation : last_run_at, run_count, next_run_at
    const cronEval = evaluateCron(automation.cron_expr as string, {
      timezone: automation.timezone as string,
      currentDate: now,
    })
    await supabaseAdmin
      .from('syndic_automations')
      .update({
        last_run_at: now.toISOString(),
        last_run_status: result.status,
        last_run_message: result.error_message ?? null,
        next_run_at: cronEval.next.toISOString(),
        run_count: ((automation.run_count as number) ?? 0) + 1,
        failure_count:
          result.status === 'failed'
            ? ((automation.failure_count as number) ?? 0) + 1
            : automation.failure_count,
      })
      .eq('id', automation.id)

    results.push({
      automation_id: automation.id as string,
      status: result.status,
      emails_sent: result.emails_sent,
    })
  }

  return NextResponse.json({ ok: true, processed: results.length, results })
}
