// Feature flag pour bascule progressive V1 → V2 :
//   - Cookie sticky `vitfix_sim_v2_bucket` (hash sha256 userId ou IP, 8 hex chars)
//   - Env `SIMULATEUR_V2_ROLLOUT` (int 0..100) : pourcentage utilisateurs en V2
//   - Override admin via cookie `vitfix_sim_v2=on|off` (priorité maximale après kill-switch)
//   - Kill-switch global `SIMULATEUR_V2_FORCE_V1=true` : tout retombe en V1

import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'
import { getClientIP } from '@/lib/rate-limit'

export const BUCKET_COOKIE = 'vitfix_sim_v2_bucket'
export const OVERRIDE_COOKIE = 'vitfix_sim_v2'

export type ExperimentArm = 'v1' | 'v2'

export type ResolveResult = {
  arm: ExperimentArm
  setBucketCookie?: { name: string; value: string; maxAge: number }
}

export function computeBucket(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 8)
}

export function resolveExperimentArm(req: NextRequest, userId?: string): ResolveResult {
  // 1. Kill-switch global
  if (process.env.SIMULATEUR_V2_FORCE_V1 === 'true') {
    return { arm: 'v1' }
  }

  // 2. Override admin (cookie manuel non-HttpOnly)
  const override = req.cookies.get(OVERRIDE_COOKIE)?.value
  if (override === 'on') return { arm: 'v2' }
  if (override === 'off') return { arm: 'v1' }

  // 3. Rollout %
  const rolloutPct = parseInt(process.env.SIMULATEUR_V2_ROLLOUT ?? '0', 10)
  if (Number.isNaN(rolloutPct) || rolloutPct <= 0) return { arm: 'v1' }
  if (rolloutPct >= 100) return { arm: 'v2' }

  // 4. Cookie sticky existant
  let bucket = req.cookies.get(BUCKET_COOKIE)?.value
  let setBucketCookie: ResolveResult['setBucketCookie']
  if (!bucket || !/^[0-9a-f]{8}$/.test(bucket)) {
    const seed = userId || getClientIP(req) || 'anon'
    bucket = computeBucket(seed)
    setBucketCookie = {
      name: BUCKET_COOKIE,
      value: bucket,
      maxAge: 60 * 60 * 24 * 90, // 90 jours
    }
  }

  const bucketInt = parseInt(bucket, 16) % 100
  const arm: ExperimentArm = bucketInt < rolloutPct ? 'v2' : 'v1'
  return { arm, setBucketCookie }
}
