/**
 * Duration Estimator — BTP Pro Analytics
 *
 * Estimates chantier duration from surface, crew size, and trade type.
 * Uses productivity reference data from config.
 * Pure functions, no React.
 */

import type { DurationEstimate } from './pipeline-types'
import {
  getProductivityRate,
  type ProductivityRate,
} from '@/lib/config/productivity-rates'

// ════════════════════════════════════════════
//  MAIN ESTIMATOR
// ════════════════════════════════════════════

export interface DurationInput {
  task_type: string
  surface_m2: number       // or quantity for unit-based tasks
  nb_workers: number
  difficulty?: 'easy' | 'normal' | 'hard'
  custom_rate?: number     // Override productivity rate if known
}

export function estimateDuration(input: DurationInput): DurationEstimate {
  const { task_type, surface_m2, nb_workers, difficulty = 'normal' } = input
  const workers = Math.max(1, nb_workers)

  // Get productivity rate
  const rateData = getProductivityRate(task_type)
  let rate: number

  if (input.custom_rate && input.custom_rate > 0) {
    rate = input.custom_rate
  } else if (rateData) {
    rate = pickRateByDifficulty(rateData, difficulty)
  } else {
    // Unknown task type: use conservative 10 m²/day/worker
    rate = 10
  }

  // Calculate duration
  const totalWorkerDays = rate > 0 ? surface_m2 / rate : surface_m2
  const durationDays = Math.ceil(totalWorkerDays / workers)
  const hoursPerDay = 7 // standard BTP day (35h/5j)
  const durationHours = durationDays * hoursPerDay

  // Confidence based on data quality
  const confidence = determineConfidence(rateData, input)

  return {
    task_type,
    surface_m2,
    nb_workers: workers,
    productivity_rate: Math.round(rate * 100) / 100,
    duration_days: durationDays,
    duration_hours: durationHours,
    total_worker_days: Math.round(totalWorkerDays * 10) / 10,
    confidence,
  }
}

function pickRateByDifficulty(
  rate: ProductivityRate,
  difficulty: 'easy' | 'normal' | 'hard'
): number {
  switch (difficulty) {
    case 'easy': return rate.max     // fast = best conditions
    case 'normal': return rate.avg
    case 'hard': return rate.min     // slow = difficult conditions
  }
}

function determineConfidence(
  rateData: ProductivityRate | undefined,
  input: DurationInput
): 'high' | 'medium' | 'low' {
  if (!rateData) return 'low'
  if (input.custom_rate) return 'medium' // custom rate = user knows better, but unverified
  if (input.surface_m2 > 500) return 'medium' // large surfaces = more variability
  return 'high'
}

// ════════════════════════════════════════════
//  MULTI-TASK ESTIMATOR
// ════════════════════════════════════════════

export interface MultiTaskInput {
  tasks: DurationInput[]
  parallel?: boolean       // Can tasks run in parallel? Default: false (sequential)
}

export interface MultiTaskEstimate {
  tasks: DurationEstimate[]
  total_days: number
  total_hours: number
  total_worker_days: number
  is_parallel: boolean
}

export function estimateMultiTask(input: MultiTaskInput): MultiTaskEstimate {
  const estimates = input.tasks.map(t => estimateDuration(t))
  const isParallel = input.parallel ?? false

  const totalWorkerDays = estimates.reduce((s, e) => s + e.total_worker_days, 0)

  const totalDays = isParallel
    ? Math.max(...estimates.map(e => e.duration_days), 0)
    : estimates.reduce((s, e) => s + e.duration_days, 0)

  const hoursPerDay = 7
  const totalHours = totalDays * hoursPerDay

  return {
    tasks: estimates,
    total_days: totalDays,
    total_hours: totalHours,
    total_worker_days: Math.round(totalWorkerDays * 10) / 10,
    is_parallel: isParallel,
  }
}
