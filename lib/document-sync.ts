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
    // Payload complet pour restauration cross-device. La colonne raw_data
    // est ajoutee par la migration 074 ; elle ne casse rien si elle n'existe
    // pas encore en base (Postgres rejettera juste l'insert avec une
    // colonne inconnue, qu'on attrape ci-dessous pour ne pas bloquer).
    raw_data: doc,
  }

  const tryUpsert = async (p: Record<string, unknown>) =>
    supabase.from(table).upsert(p, { onConflict: 'numero,artisan_user_id' })

  let { error } = await tryUpsert(payload)

  // Fallback : si la colonne raw_data n'existe pas encore (migration 074
  // pas appliquee), on retente sans pour ne pas bloquer la sync sommaire.
  if (error && /column .*raw_data.* does not exist/i.test(error.message || '')) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { raw_data: _omit, ...legacy } = payload
    const retry = await tryUpsert(legacy)
    error = retry.error
  }

  if (error) {
    console.error(`[document-sync] Failed to sync ${table} ${numero}:`, error.message)
  }
}

// Fetch documents from Supabase factures + devis tables for the authenticated user.
// Returns an array de document objects shaped to match the localStorage format.
//
// Si la colonne raw_data est presente (migration 074), on retourne le payload
// complet du formulaire — l'utilisateur retrouve l'integralite de son devis
// (corps d'etat BTP, etapes, mediator, notes, etc.) sur n'importe quel
// appareil. Sinon on retombe sur les champs sommaire (comportement legacy).
export async function fetchDocumentsFromSupabase(): Promise<Record<string, unknown>[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // On tente d'abord avec raw_data ; si la colonne n'existe pas (migration
  // pas encore deployee en DB), on retente sans.
  const SELECT_FIELDS_FULL = 'id,numero,client_name,status,chantier_id,created_at,total_ht_cents,raw_data'
  const SELECT_FIELDS_LEGACY = 'id,numero,client_name,status,chantier_id,created_at,total_ht_cents'

  const fetchTable = async (table: 'factures' | 'devis'): Promise<Array<Record<string, unknown>>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseQuery = supabase.from(table) as any
    let q = baseQuery.select(SELECT_FIELDS_FULL).eq('artisan_user_id', user.id)
    if (table === 'factures') q = q.is('deleted_at', null)
    let result = await q
    if (result.error && /column .*raw_data.* does not exist/i.test(result.error.message || '')) {
      let q2 = baseQuery.select(SELECT_FIELDS_LEGACY).eq('artisan_user_id', user.id)
      if (table === 'factures') q2 = q2.is('deleted_at', null)
      result = await q2
    }
    if (result.error) {
      console.error(`[document-sync] Failed to fetch ${table}:`, result.error.message)
      return []
    }
    return (result.data as Array<Record<string, unknown>>) || []
  }

  const [facData, devData] = await Promise.all([fetchTable('factures'), fetchTable('devis')])

  const merge = (
    type: 'devis' | 'facture',
    rows: Array<Record<string, unknown>>
  ): Record<string, unknown>[] =>
    rows.map((r) => {
      const raw = (r.raw_data as Record<string, unknown> | null) || null
      if (raw && typeof raw === 'object') {
        // raw_data contient deja docType/docNumber/lines/customTables/etc.
        // On force quelques champs depuis la ligne DB pour rester synchrone
        // si le statut / numero ont ete modifies cote serveur.
        return {
          ...raw,
          docType: type,
          docNumber: (r.numero as string) || (raw.docNumber as string),
          status: (r.status as string) || (raw.status as string),
          chantierId: (r.chantier_id as string) || (raw.chantierId as string) || null,
          docDate: (raw.docDate as string) || ((r.created_at as string) || '').slice(0, 10),
          _fromSupabase: true,
        }
      }
      // Fallback sommaire (legacy avant migration 074)
      return {
        docType: type,
        docNumber: r.numero,
        clientName: r.client_name,
        docDate: r.created_at ? (r.created_at as string).slice(0, 10) : '',
        status: r.status,
        chantierId: r.chantier_id,
        totalHT: r.total_ht_cents != null ? (r.total_ht_cents as number) / 100 : 0,
        _fromSupabase: true,
      }
    })

  return [...merge('facture', facData), ...merge('devis', devData)]
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
