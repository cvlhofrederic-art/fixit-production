/**
 * POST /api/admin/pii-backfill
 *
 * One-shot (re-runnable) backfill of the AES-256-GCM ciphertext columns
 * for rows that pre-date the Phase 15 dual-write rollout. Idempotent by
 * construction: filters on `pii_encryption_version = 0` so completed rows
 * are skipped on subsequent runs.
 *
 * Query params:
 *   - ?dry_run=true (default) — count + sample, no writes.
 *   - ?dry_run=false           — actually update rows.
 *   - ?batch=N (default 100, max 500) — pagination cap so a single
 *     invocation stays under the 30 s CPU budget.
 *
 * Auth: super_admin only (`isSuperAdmin(user)`).
 *
 * Why a route, not a CLI script: PII_ENCRYPTION_KEY is a Cloudflare
 * worker secret and must stay there — running encryption from a local
 * shell would require leaking the key. The route runs inside the worker
 * with the secret already mounted.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isSuperAdmin, unauthorizedResponse } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { piiDualWriteAdditions } from '@/lib/services/kyc/pii-dual-write'

interface ProfileRow {
  id: string
  siret: string | null
  kbis_extracted: unknown
}

interface RowResult {
  id: string
  status: 'encrypted' | 'skipped_no_pii' | 'error'
  error?: string
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  if (!(await checkRateLimit(`pii_backfill_${ip}`, 5, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(req)
  if (!user || !isSuperAdmin(user)) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const dryRun = searchParams.get('dry_run') !== 'false'
  const batch = Math.min(Math.max(Number.parseInt(searchParams.get('batch') ?? '100', 10) || 100, 1), 500)

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id, siret, kbis_extracted')
      .or('pii_encryption_version.is.null,pii_encryption_version.eq.0')
      .or('siret.not.is.null,kbis_extracted.not.is.null')
      .limit(batch)

    if (error) {
      logger.error('[pii-backfill] query failed', { error: error.message })
      return NextResponse.json({ error: 'Query failed', details: error.message }, { status: 500 })
    }

    const candidates = (rows ?? []) as ProfileRow[]
    const results: RowResult[] = []
    let encryptedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const row of candidates) {
      // The current production schema has `siret` as the only plain mirror
      // (no `nif` column on profiles_artisan, see plan note). FR market is
      // therefore the only path that has anything to backfill.
      if (!row.siret && row.kbis_extracted == null) {
        results.push({ id: row.id, status: 'skipped_no_pii' })
        skippedCount++
        continue
      }

      try {
        const additions = await piiDualWriteAdditions({
          market: 'FR',
          declaredIdentifiant: row.siret,
          kbisExtracted: row.kbis_extracted,
        })

        if (Object.keys(additions).length === 0) {
          results.push({ id: row.id, status: 'skipped_no_pii' })
          skippedCount++
          continue
        }

        if (!dryRun) {
          const { error: updateError } = await supabaseAdmin
            .from('profiles_artisan')
            .update(additions)
            .eq('id', row.id)
          if (updateError) {
            logger.warn('[pii-backfill] row update failed', { id: row.id, error: updateError.message })
            results.push({ id: row.id, status: 'error', error: updateError.message })
            errorCount++
            continue
          }
        }

        results.push({ id: row.id, status: 'encrypted' })
        encryptedCount++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.warn('[pii-backfill] row crypto failed', { id: row.id, error: message })
        results.push({ id: row.id, status: 'error', error: message })
        errorCount++
      }
    }

    logger.info('[pii-backfill] run complete', {
      dryRun,
      scanned: candidates.length,
      encrypted: encryptedCount,
      skipped: skippedCount,
      errors: errorCount,
    })

    return NextResponse.json({
      dry_run: dryRun,
      batch,
      scanned: candidates.length,
      encrypted: encryptedCount,
      skipped: skippedCount,
      errors: errorCount,
      sample: results.slice(0, 10),
    })
  } catch (err) {
    logger.error('[pii-backfill] fatal', { err: (err as Error).message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
