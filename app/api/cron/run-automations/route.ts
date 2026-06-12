// app/api/cron/run-automations/route.ts
// Endpoint invoqué par GitHub Actions cron (*/5 * * * *).
// Protégé par header x-cron-secret = INTERNAL_API_SECRET.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { evaluateCron } from '@/lib/scheduler/cron-evaluator'
import { executeTaskHandler } from '@/lib/scheduler/task-handlers'
import { logger } from '@/lib/logger'
import type { Json } from '@/lib/database-types'

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

  for (const automation of dueAutomations ?? []) {
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
        // jsonb → métier : Row DB (params: Json, locale: string) vers le contrat
        // Automation du handler (params: Record, locale: 'fr' | 'pt')
        automation: automation as unknown as Parameters<typeof executeTaskHandler>[0]['automation'],
        supabase: supabaseAdmin as Parameters<typeof executeTaskHandler>[0]['supabase'],
        runId: run.id,
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
        // métier → jsonb : result_meta est un objet JSON-sérialisable (cf. HandlerResult)
        result_meta: (result.result_meta ?? null) as Json,
      })
      .eq('id', run.id)

    // 5. Update automation : last_run_at, run_count, next_run_at, failure_count
    const cronEval = evaluateCron(automation.cron_expr, {
      timezone: automation.timezone,
      currentDate: now,
    })
    const newFailureCount =
      result.status === 'failed' ? automation.failure_count + 1 : 0

    await supabaseAdmin
      .from('syndic_automations')
      .update({
        last_run_at: now.toISOString(),
        last_run_status: result.status,
        last_run_message: result.error_message ?? null,
        next_run_at: cronEval.next.toISOString(),
        run_count: automation.run_count + 1,
        failure_count: newFailureCount,
      })
      .eq('id', automation.id)

    // 6. Notification si 3 échecs consécutifs
    if (result.status === 'failed' && newFailureCount === 3) {
      try {
        const { data: adminUser } = await supabaseAdmin.auth.admin.getUserById(
          automation.cabinet_id,
        )
        const email = adminUser?.user?.email
        if (email) {
          const { sendEmail } = await import('@/lib/email')
          await sendEmail({
            to: email,
            subject: '⚠️ Tempo — Automatisation en échec (3 fois consécutives)',
            html: `
              <p>Une de vos automatisations Vitfix a échoué <strong>3 fois consécutives</strong>.</p>
              <ul>
                <li><strong>Nom</strong> : ${automation.name}</li>
                <li><strong>Type</strong> : ${automation.task_type}</li>
                <li><strong>Cron</strong> : <code>${automation.cron_expr}</code></li>
                <li><strong>Dernière erreur</strong> : ${result.error_message ?? 'inconnue'}</li>
              </ul>
              <p>Connectez-vous à votre dashboard pour diagnostiquer ou mettre en pause.</p>
              <p><a href="https://vitfix.io/syndic/dashboard?page=automation_agent">Ouvrir Tempo</a></p>
            `,
          })
        }
      } catch (err) {
        logger.warn('[cron] failure notification send failed', { error: String(err) })
      }
    }

    results.push({
      automation_id: automation.id,
      status: result.status,
      emails_sent: result.emails_sent,
    })
  }

  return NextResponse.json({ ok: true, processed: results.length, results })
}
