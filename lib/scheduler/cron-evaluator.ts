// lib/scheduler/cron-evaluator.ts
// Évalue un cron expression et retourne le prochain trigger en timezone donnée.
// Utilise cron-parser v5 (CronExpressionParser.parse).

import { CronExpressionParser } from 'cron-parser'

export interface CronEvaluationResult {
  next: Date
  prev?: Date
  valid: boolean
  error?: string
}

export function evaluateCron(
  expr: string,
  options?: { timezone?: string; currentDate?: Date },
): CronEvaluationResult {
  try {
    const interval = CronExpressionParser.parse(expr, {
      tz: options?.timezone ?? 'Europe/Paris',
      currentDate: options?.currentDate ?? new Date(),
    })
    return {
      next: interval.next().toDate(),
      prev: interval.prev().toDate(),
      valid: true,
    }
  } catch (err) {
    return {
      next: new Date(Date.now() + 86400_000), // fallback +24h
      valid: false,
      error: err instanceof Error ? err.message : 'unknown',
    }
  }
}

export function isCronDue(
  automation: { next_run_at: string | null; status: string },
  now: Date = new Date(),
): boolean {
  if (automation.status !== 'active') return false
  if (!automation.next_run_at) return false
  return new Date(automation.next_run_at) <= now
}
