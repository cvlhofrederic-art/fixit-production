import { supabase } from '@/lib/supabase'

// Map localStorage document status to Supabase-valid status values
function mapStatus(doc: Record<string, unknown>, table: 'factures' | 'devis'): string {
  const raw = (doc.status as string) || ''
  if (table === 'devis') {
    // Valid: draft | sent | signed | expired | cancelled
    if (raw === 'brouillon') return 'draft'
    if (raw === 'envoye') return 'sent'
    if (raw === 'signe') return 'signed'
    if (raw === 'expire') return 'expired'
    if (raw === 'annule') return 'cancelled'
    return 'draft'
  } else {
    // Valid: pending | paid | overdue | cancelled | refunded
    if (raw === 'brouillon') return 'pending'
    if (raw === 'envoye') return 'pending'
    if (raw === 'paye') return 'paid'
    if (raw === 'en_retard') return 'overdue'
    if (raw === 'annule') return 'cancelled'
    if (raw === 'rembourse') return 'refunded'
    return 'pending'
  }
}

// Calculate total HT in cents from a document payload.
// Both DevisFactureForm (fraisAnnexes) and DevisFactureFormBTP (fraisLines) are handled.
function calcTotalHtCents(doc: Record<string, unknown>): number {
  const lines = (doc.lines as Array<{ totalHT?: number }>) || []
  const materialLines = (doc.materialLines as Array<{ totalHT?: number }>) || []

  // DevisFactureForm uses fraisAnnexes with total_ht
  const fraisAnnexes = (doc.fraisAnnexes as Array<{ total_ht?: number }>) || []
  // DevisFactureFormBTP uses fraisLines with totalHT
  const fraisLines = (doc.fraisLines as Array<{ totalHT?: number }>) || []

  const total =
    lines.reduce((s, l) => s + (l.totalHT || 0), 0) +
    materialLines.reduce((s, l) => s + (l.totalHT || 0), 0) +
    fraisAnnexes.reduce((s, f) => s + (f.total_ht || 0), 0) +
    fraisLines.reduce((s, f) => s + (f.totalHT || 0), 0)

  return Math.round(total * 100)
}

// Sync a saved document (devis or facture) to Supabase.
// Fire-and-forget: callers should .catch(() => {}) to stay non-blocking.
export async function syncDocumentToSupabase(
  doc: Record<string, unknown>,
  artisanId: string,
): Promise<void> {
  const table: 'factures' | 'devis' = doc.docType === 'facture' ? 'factures' : 'devis'
  const numero = (doc.docNumber as string) || ''
  if (!numero) return

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id
  if (!userId) return

  const totalHtCents = calcTotalHtCents(doc)

  // Build items JSONB from all line arrays so the row is useful without raw_data
  const items = [
    ...((doc.lines as unknown[]) || []),
    ...((doc.materialLines as unknown[]) || []),
    ...((doc.fraisLines as unknown[]) || []),
    ...((doc.fraisAnnexes as unknown[]) || []),
  ]

  // frais_annexes: prefer dedicated field, fall back to fraisLines (BTP form)
  const fraisAnnexes =
    (doc.fraisAnnexes as unknown[])?.length
      ? doc.fraisAnnexes
      : (doc.fraisLines as unknown[]) || []

  const payload = {
    artisan_user_id: userId,
    artisan_id: artisanId,
    numero,
    client_name: (doc.clientName as string) || '',
    client_email: (doc.clientEmail as string) || null,
    total_ht_cents: totalHtCents,
    // total_tax_cents / total_ttc_cents: best-effort from fraisAnnexes TVA
    total_tax_cents: 0,
    total_ttc_cents: totalHtCents,
    chantier_id: (doc.chantierId as string) || null,
    frais_annexes: fraisAnnexes,
    items,
    status: mapStatus(doc, table),
  }

  const { error } = await supabase
    .from(table)
    .upsert(payload, { onConflict: 'numero,artisan_user_id' })

  if (error) {
    console.error(`[document-sync] Failed to sync ${table} ${numero}:`, error.message)
  }
}

// One-time import of all localStorage documents for an artisan into Supabase.
// Returns the count of documents processed.
export async function importLocalStorageDocsToSupabase(artisanId: string): Promise<number> {
  let count = 0
  for (const key of [
    `fixit_documents_${artisanId}`,
    `fixit_drafts_${artisanId}`,
  ]) {
    try {
      const docs = JSON.parse(localStorage.getItem(key) || '[]')
      for (const doc of docs) {
        await syncDocumentToSupabase(doc, artisanId)
        count++
      }
    } catch {
      // Ignore corrupt localStorage entries
    }
  }
  return count
}
