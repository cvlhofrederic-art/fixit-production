/**
 * PII dual-write payload contributions for the KYC orchestrator.
 *
 * Returns the `_encrypted` columns that should be merged into the
 * profiles_artisan UPDATE payload alongside the plaintext columns.
 * Plaintext continues to be written for the duration of Phase 15
 * (rollout), the `pii_encryption_version` flag bumps to 1 as soon
 * as at least one encrypted column is contributed.
 *
 * Constraints (matched against migration 103 prod state):
 *   - profiles_artisan.siret_encrypted  exists (FR market)
 *   - profiles_artisan.nif_encrypted    exists (PT market)
 *   - profiles_artisan.kbis_extracted_encrypted  exists (FR only)
 *   - profiles_artisan.pii_encryption_version    exists
 *
 * pt_fiscal_documents is intentionally NOT covered — the table does
 * not exist in production (Portugal fiscal feature never activated).
 * If/when it ships, add a parallel helper for that table.
 */
import { encryptJSON, encryptPII } from '@/lib/pii-crypto'

export interface PiiDualWriteInput {
  market: 'FR' | 'PT'
  /** SIRET (FR) or NIF (PT). null/empty → no encrypted contribution for that field. */
  declaredIdentifiant: string | null | undefined
  /** Parsed KBIS / certidao JSON. null → no encrypted contribution. Only encrypted on FR market (kbis_extracted_encrypted). */
  kbisExtracted: unknown
}

export async function piiDualWriteAdditions(
  input: PiiDualWriteInput
): Promise<Record<string, unknown>> {
  const additions: Record<string, unknown> = {}

  const id = input.declaredIdentifiant?.trim()
  if (id && id.length > 0) {
    if (input.market === 'FR') {
      additions.siret_encrypted = await encryptPII(id)
    } else if (input.market === 'PT') {
      additions.nif_encrypted = await encryptPII(id)
    }
  }

  // Only FR has a kbis_extracted_encrypted column today (see migration 103).
  if (input.kbisExtracted != null && input.market === 'FR') {
    additions.kbis_extracted_encrypted = await encryptJSON(input.kbisExtracted)
  }

  if (Object.keys(additions).length > 0) {
    additions.pii_encryption_version = 1
  }

  return additions
}
