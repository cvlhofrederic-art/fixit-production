import * as Sentry from '@sentry/nextjs'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

// Sync a saved document (devis or facture) to Supabase via server-side API.
// Pattern Pro SaaS 2026 : POST vers /api/devis/sync (Cloudflare Worker)
// avec Authorization Bearer, validation Zod côté serveur, supabaseAdmin
// pour bypass RLS de manière contrôlée, idempotency naturelle via
// (numero, artisan_user_id).
//
// Avant : direct upsert depuis le browser anon client → user?.id null
//   silencieusement → 0 inserts EVER en prod (cf. plan d'audit).
//
// Après : tout passe par /api/devis/sync, erreurs surfacées via Sentry
//   côté caller (DevisFactureForm.tsx remplace .catch(() => {})).
export async function syncDocumentToSupabase(
  doc: Record<string, unknown>,
  artisanId: string,
): Promise<void> {
  const docType: 'devis' | 'facture' = doc.docType === 'facture' ? 'facture' : 'devis'
  const numero = (doc.docNumber as string) || ''
  if (!numero) return

  // Recupere le token de session pour l'auth Bearer côté endpoint.
  // Si pas de session : on ne peut rien sync, on remonte une erreur
  // au caller (qui la log via Sentry au lieu de .catch silencieux).
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    throw new Error('No active session — cannot sync document')
  }

  const res = await fetch('/api/devis/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ docType, artisanId, doc }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`devis-sync HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
}

// Wrapper safe : remplace le pattern `.catch(() => {})` aux call sites
// (DevisFactureForm.tsx + DevisFactureFormBTP.tsx). Sentry capture + toast
// discret au lieu d'avaler silencieusement les erreurs.
//
// La sync reste fire-and-forget (Promise<void>) — le caller n'attend pas.
// Anti-spam toast : 1 seul toast par 30s pour ne pas noyer l'UX si toutes
// les sync echouent (auth perdue, reseau down).
let _lastSyncErrorToastAt = 0
const SYNC_TOAST_THROTTLE_MS = 30_000

export function syncDocumentSafe(doc: Record<string, unknown>, artisanId: string): void {
  syncDocumentToSupabase(doc, artisanId).catch((err: unknown) => {
    const numero = (doc.docNumber as string) || '(sans numero)'
    const docType = (doc.docType as string) || 'devis'

    Sentry.captureException(err, {
      tags: { feature: 'devis-sync', stage: 'client-fetch', doc_type: docType },
      extra: { numero, artisan_id: artisanId },
    })

    const now = Date.now()
    if (now - _lastSyncErrorToastAt > SYNC_TOAST_THROTTLE_MS) {
      _lastSyncErrorToastAt = now
      toast.error('Sync DB échouée — devis sauvé localement', {
        description: 'Réessai au prochain login. Vos données sont en sécurité.',
      })
    }
  })
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
