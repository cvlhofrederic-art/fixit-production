// P5 Léa Documents — quotas de stockage par cabinet (warning + bloc).
//
// Limites cibles (free tier Supabase Storage = 1 GB total) :
//   - Warning à 80 % du quota → renvoie warning sans bloquer
//   - Bloc à 100 % du quota → upload refusé (413)
//
// Quota calculé sur SUM(size_bytes) de syndic_documents + syndic_pdf_generated
// (les templates source ne comptent pas — petits et essentiels).
import type { SupabaseClient } from '@supabase/supabase-js'

export const DEFAULT_CABINET_QUOTA_BYTES = 500 * 1024 * 1024 // 500 MB par cabinet (conservateur)
const WARN_THRESHOLD_RATIO = 0.8

export interface CabinetStorageUsage {
  bytes_used: number
  bytes_quota: number
  ratio: number
  warning: boolean
  exceeded: boolean
}

export async function getCabinetStorageUsage(
  supabase: SupabaseClient,
  cabinetId: string,
  quotaBytes: number = DEFAULT_CABINET_QUOTA_BYTES,
): Promise<CabinetStorageUsage> {
  let total = 0

  // syndic_documents (uploads OCR)
  try {
    const { data: docs } = await supabase
      .from('syndic_documents')
      .select('size_bytes')
      .eq('cabinet_id', cabinetId)
    if (Array.isArray(docs)) {
      total += docs.reduce((s: number, d: { size_bytes?: number | null }) => s + (d.size_bytes ?? 0), 0)
    }
  } catch {
    // best-effort — un échec n'empêche pas l'upload
  }

  // syndic_pdf_generated (PDFs générés par templates)
  try {
    const { data: gens } = await supabase
      .from('syndic_pdf_generated')
      .select('size_bytes')
      .eq('cabinet_id', cabinetId)
    if (Array.isArray(gens)) {
      total += gens.reduce((s: number, d: { size_bytes?: number | null }) => s + (d.size_bytes ?? 0), 0)
    }
  } catch {
    // best-effort
  }

  const ratio = quotaBytes > 0 ? total / quotaBytes : 0
  return {
    bytes_used: total,
    bytes_quota: quotaBytes,
    ratio,
    warning: ratio >= WARN_THRESHOLD_RATIO && ratio < 1,
    exceeded: ratio >= 1,
  }
}

/**
 * Check si un upload supplémentaire de `incomingBytes` ferait dépasser le quota.
 */
export function wouldExceedQuota(usage: CabinetStorageUsage, incomingBytes: number): boolean {
  return usage.bytes_used + incomingBytes > usage.bytes_quota
}
