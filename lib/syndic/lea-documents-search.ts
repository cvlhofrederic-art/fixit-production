// P3 Léa Documents — wrapper TS pour la RPC search_syndic_documents_hybrid.
// Embed la query via BGE-M3 puis appelle la fonction SQL RRF (FTS + vector).
import { embedText } from '@/lib/syndic/embed'
import { logger } from '@/lib/logger'
import type { SupabaseClient } from '@supabase/supabase-js'

export type DocType =
  | 'facture_artisan' | 'facture_syndic' | 'devis' | 'contrat'
  | 'rib' | 'ata_ag' | 'releve_bancaire' | 'pv_assemblee' | 'autre'

export interface DocSearchHit {
  id: string
  filename: string
  type: DocType
  status: string
  immeuble_id: string | null
  uploaded_at: string
  extracted_metadata: Record<string, unknown> | null
  snippet: string | null
  vector_score: number
  bm25_score: number
  rrf_score: number
}

export interface SearchOptions {
  locale?: 'fr' | 'pt'
  type?: DocType
  immeubleId?: string
  matchCount?: number
}

const MIN_QUERY_LEN = 3

/**
 * Recherche hybride dans les documents Léa du cabinet appelant.
 * - Embed la query via Cloudflare Workers AI (BGE-M3, 1024-dim)
 * - Appelle search_syndic_documents_hybrid (FTS + vector + RRF, scopée cabinet_id)
 * - Best-effort : retourne [] si l'embedding échoue (fallback FTS pur côté SQL
 *   pourrait être ajouté en P3.1 si besoin de robustesse offline-embed)
 */
export async function searchDocuments(
  supabase: SupabaseClient,
  cabinetId: string,
  query: string,
  opts: SearchOptions = {},
): Promise<DocSearchHit[]> {
  const trimmed = query.trim()
  if (trimmed.length < MIN_QUERY_LEN) return []

  let queryEmbedding: number[]
  try {
    queryEmbedding = await embedText(trimmed)
  } catch (err) {
    logger.warn('[lea-documents/search] query embed failed:', err)
    return []
  }

  const locale = opts.locale === 'pt' ? 'portuguese' : 'french'
  const { data, error } = await supabase.rpc('search_syndic_documents_hybrid', {
    p_cabinet_id: cabinetId,
    query_text: trimmed,
    query_embedding: queryEmbedding,
    query_locale: locale,
    filter_type: opts.type ?? null,
    filter_immeuble_id: opts.immeubleId ?? null,
    match_count: opts.matchCount ?? 5,
  })

  if (error) {
    logger.error('[lea-documents/search] rpc failed:', error)
    return []
  }

  return (data ?? []) as DocSearchHit[]
}

/**
 * Formate les résultats RAG en bloc texte injecté dans le system prompt Léa.
 * Préfère le snippet ts_headline si présent, sinon les métadonnées structurées.
 */
export function formatSearchHitsForPrompt(hits: DocSearchHit[], locale: 'fr' | 'pt' = 'fr'): string {
  if (hits.length === 0) return ''

  const isPt = locale === 'pt'
  const header = isPt
    ? `## Documentos contabilísticos relevantes (${hits.length} resultados, ordenados por relevância)`
    : `## Documents comptables pertinents (${hits.length} résultats, triés par pertinence)`

  const lines = hits.map((h, i) => {
    const meta = (h.extracted_metadata ?? {}) as Record<string, unknown>
    const parts: string[] = []
    parts.push(`### [${i + 1}] ${h.filename} — ${h.type}`)
    if (meta.fournisseur) parts.push(`Fournisseur : ${meta.fournisseur}`)
    if (meta.date_doc) parts.push(`Date : ${meta.date_doc}`)
    if (meta.montant_ttc != null) parts.push(`Montant TTC : ${meta.montant_ttc} €`)
    if (meta.numero_facture) parts.push(`N° : ${meta.numero_facture}`)
    if (h.snippet) parts.push(`Extrait : ${h.snippet}`)
    parts.push(`(doc_id: ${h.id})`)
    return parts.join('\n')
  })

  return `${header}\n\n${lines.join('\n\n')}`
}
