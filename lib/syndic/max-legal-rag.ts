// lib/syndic/max-legal-rag.ts
// ──────────────────────────────────────────────────────────────────────────────
// RAG juridique de Max — Pipeline multi-étapes 2026 (Plan H+).
// Architecture : HyDE → Hybrid Search (vector + BM25 RRF) → Reranker → MMR.
// Tables strictement isolées par locale : Max FR → syndic_legal_corpus_fr,
//                                          Max PT → syndic_legal_corpus_pt.
// ──────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { embedText } from './embed'
import { rerank, mmrFilter, cosineSimilarity, type RerankedCandidate } from './rerank'

export interface LegalChunk {
  id: string
  source: string
  article: string | null
  title: string
  content: string
  theme: string | null
  parent_path: string | null
}

export interface ScoredLegalChunk extends LegalChunk {
  /** Score combiné du retrieval (RRF + rerank, normalisé 0..1 approximatif) */
  score: number
  /** Score brut du reranker (utilisable pour gate de confiance) */
  rerankScore: number
}

interface CorpusHybridRow {
  id: string
  source: string
  article: string | null
  title: string
  content: string
  theme: string | null
  parent_path: string | null
  vector_score: number
  bm25_score: number
  rrf_score: number
  embedding?: number[]
}

const HYBRID_TOP_K = 30        // candidats récupérés en hybrid search
const RERANK_TOP_K = 10        // après reranker
const MMR_FINAL_K = 3          // top final passé au LLM (réduit de 6 : budget tokens Groq free tier)
const MMR_LAMBDA = 0.7         // 0.7 = privilégie pertinence (vs diversité)
const MIN_RERANK_SCORE = -2.0  // seuil sous lequel on considère "hors-scope"

/**
 * Pipeline retrieval complet. Renvoie les chunks pertinents pour la query,
 * ou tableau vide si aucun chunk ne dépasse le seuil de pertinence (=> refus côté Max).
 *
 * Étapes :
 *  1. Embed la query directement (et — si LLM disponible — la HyDE rewrite côté caller)
 *  2. Hybrid search via RPC search_legal_corpus_hybrid_{language}
 *  3. Rerank avec BGE-reranker (cross-encoder)
 *  4. Filtre par seuil de confiance
 *  5. Diversity MMR pour le top final
 */
export async function retrieveLegalChunks(
  supabase: SupabaseClient,
  query: string,
  language: 'fr' | 'pt',
  options?: { hydeQuery?: string; aiBinding?: unknown },
): Promise<ScoredLegalChunk[]> {
  const trimmed = (query || '').trim()
  if (!trimmed) return []

  // ── 1. Embed la query (et la HyDE rewrite si fournie) ──
  let queryEmbedding: number[]
  const embedOpts = options?.aiBinding ? { aiBinding: options.aiBinding, timeoutMs: 4_000 } : { timeoutMs: 4_000 }
  try {
    if (options?.hydeQuery && options.hydeQuery.trim()) {
      const [qVec, hVec] = await Promise.all([
        embedText(trimmed, embedOpts),
        embedText(options.hydeQuery.trim(), embedOpts),
      ])
      queryEmbedding = qVec.map((v, i) => (v + hVec[i]) / 2)
    } else {
      queryEmbedding = await embedText(trimmed, embedOpts)
    }
  } catch (err) {
    logger.error('[max-legal-rag] embed query failed — falling to BM25', {
      error: err instanceof Error ? err.message : String(err),
      language,
      hadBinding: !!options?.aiBinding,
    })
    return fallbackBm25(supabase, trimmed, language)
  }
  logger.info('[max-legal-rag] embed OK', { dims: queryEmbedding.length, language })

  // ── 2. Hybrid search via RPC SQL ──
  const rpcName = language === 'pt' ? 'search_legal_corpus_hybrid_pt' : 'search_legal_corpus_hybrid_fr'
  const { data: hybridRows, error: hybridErr } = await supabase.rpc(rpcName, {
    query_text: trimmed,
    query_embedding: formatVec(queryEmbedding),
    match_count: HYBRID_TOP_K,
  })
  if (hybridErr) {
    logger.warn('[max-legal-rag] hybrid RPC error, fallback BM25', { error: hybridErr.message })
    return fallbackBm25(supabase, trimmed, language)
  }
  const candidates = ((hybridRows ?? []) as CorpusHybridRow[]).filter((r) => r.content)
  logger.info('[max-legal-rag] hybrid search results', {
    total: candidates.length,
    topRrf: candidates[0]?.rrf_score ?? 0,
    topVec: candidates[0]?.vector_score ?? 0,
    topBm25: candidates[0]?.bm25_score ?? 0,
  })
  if (candidates.length === 0) {
    logger.info('[max-legal-rag] hybrid search returned 0, trying BM25 fallback', {
      query: trimmed.slice(0, 80), language,
    })
    return fallbackBm25(supabase, trimmed, language)
  }

  // ── 3. Rerank avec BGE-reranker ──
  let reranked: RerankedCandidate<CorpusHybridRow>[]
  try {
    reranked = await rerank<CorpusHybridRow>(
      trimmed,
      candidates.map((c) => ({
        document: c,
        text: `${c.title}\n\n${c.content}`,
      })),
    )
  } catch (err) {
    logger.warn('[max-legal-rag] rerank failed, using RRF order', {
      error: err instanceof Error ? err.message : String(err),
    })
    // Fallback : ordre RRF déjà calculé côté SQL, mapper directement.
    reranked = candidates.map((c) => ({ document: c, rerankScore: c.rrf_score * 100 }))
  }
  logger.info('[max-legal-rag] rerank done', {
    topScore: reranked[0]?.rerankScore ?? 'none',
    count: reranked.length,
    threshold: MIN_RERANK_SCORE,
  })

  // ── 4. Filtre par seuil de pertinence ──
  // Si le top-1 est en dessous du seuil → la pipeline vectorielle n'a pas trouvé
  // de résultat confiant. On tente ILIKE comme filet de sécurité avant de refuser.
  if (reranked.length === 0 || reranked[0].rerankScore < MIN_RERANK_SCORE) {
    logger.info('[max-legal-rag] no chunk above relevance threshold, trying ILIKE fallback', {
      topScore: reranked[0]?.rerankScore ?? 'none',
      query: trimmed.slice(0, 80),
    })
    return fallbackIlike(supabase, trimmed, language)
  }
  const filtered = reranked.slice(0, RERANK_TOP_K)

  // ── 5. MMR pour la diversité du top final ──
  // Sans embeddings disponibles côté reranker → on approxime la sim avec
  // une similarité de Jaccard sur les tokens (rapide, suffisant pour MMR).
  const diverse = mmrFilter<CorpusHybridRow>(
    filtered,
    MMR_FINAL_K,
    MMR_LAMBDA,
    (a, b) => jaccardSimilarity(`${a.title} ${a.content}`, `${b.title} ${b.content}`),
  )

  return diverse.map((d) => ({
    id: d.document.id,
    source: d.document.source,
    article: d.document.article,
    title: d.document.title,
    content: d.document.content,
    theme: d.document.theme,
    parent_path: d.document.parent_path,
    rerankScore: d.rerankScore,
    score: Math.min(1, Math.max(0, (d.rerankScore + 5) / 10)),
  }))
}

// ── Fallback BM25 si embeddings indisponibles ────────────────────────────────

async function fallbackBm25(
  supabase: SupabaseClient,
  query: string,
  language: 'fr' | 'pt',
): Promise<ScoredLegalChunk[]> {
  const table = language === 'pt' ? 'syndic_legal_corpus_pt' : 'syndic_legal_corpus_fr'
  const tsConfig = language === 'pt' ? 'portuguese' : 'french'
  const { data, error } = await supabase
    .from(table)
    .select('id, source, article, title, content, theme, parent_path')
    .textSearch('search_vector', query, { config: tsConfig, type: 'plain' })
    .limit(MMR_FINAL_K)
  if (!error && data && data.length > 0) {
    return mapChunkRows(data)
  }
  logger.info('[max-legal-rag] BM25 returned 0, trying ILIKE fallback', {
    query: query.slice(0, 80), language,
  })
  return fallbackIlike(supabase, query, language)
}

async function fallbackIlike(
  supabase: SupabaseClient,
  query: string,
  language: 'fr' | 'pt',
): Promise<ScoredLegalChunk[]> {
  const table = language === 'pt' ? 'syndic_legal_corpus_pt' : 'syndic_legal_corpus_fr'
  const words = query.toLowerCase().match(/\p{L}{3,}/gu) ?? []
  if (words.length === 0) return []
  const keywords = [...new Set(words)].slice(0, 5)
  const orConditions = keywords
    .flatMap((kw) => [`content.ilike.%${kw}%`, `title.ilike.%${kw}%`])
    .join(',')
  const { data, error } = await supabase
    .from(table)
    .select('id, source, article, title, content, theme, parent_path')
    .neq('parent_path', '__TOC__')
    .or(orConditions)
    .limit(MMR_FINAL_K)
  if (error || !data || data.length === 0) return []
  return mapChunkRows(data)
}

function mapChunkRows(data: Record<string, unknown>[]): ScoredLegalChunk[] {
  return data.map((r, i) => ({
    id: r.id as string,
    source: r.source as string,
    article: (r.article as string) ?? null,
    title: r.title as string,
    content: r.content as string,
    theme: (r.theme as string) ?? null,
    parent_path: (r.parent_path as string) ?? null,
    rerankScore: 0,
    score: 1 - i / MMR_FINAL_K,
  }))
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatVec(v: number[]): string {
  return `[${v.join(',')}]`
}

/** Similarité de Jaccard sur les tokens (rapide, pour MMR sans embeddings) */
function jaccardSimilarity(a: string, b: string): number {
  const tokA = new Set(a.toLowerCase().match(/\p{L}+/gu) ?? [])
  const tokB = new Set(b.toLowerCase().match(/\p{L}+/gu) ?? [])
  if (tokA.size === 0 || tokB.size === 0) return 0
  let inter = 0
  for (const t of tokA) if (tokB.has(t)) inter++
  return inter / (tokA.size + tokB.size - inter)
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy compat : `searchLegalCorpus` + `formatCitationsMarkdown` + `resolveLegalToolCalls`
// Conservés pour ne pas casser les imports existants (max-ai/route.ts legacy path).
// Mais le nouveau code utilise retrieveLegalChunks directement.
// ─────────────────────────────────────────────────────────────────────────────

export interface LegalCitation {
  source: string
  article: string
  title: string
  content: string
  theme: string | null
}

export async function searchLegalCorpus(
  supabase: SupabaseClient,
  query: string,
  language: 'fr' | 'pt',
  limit: number = 3,
): Promise<LegalCitation[]> {
  const chunks = await retrieveLegalChunks(supabase, query, language)
  return chunks.slice(0, limit).map((c) => ({
    source: c.source,
    article: c.article ?? '',
    title: c.title,
    content: c.content.length > 600 ? c.content.slice(0, 600).trimEnd() + '…' : c.content,
    theme: c.theme,
  }))
}

export function formatCitationsMarkdown(citations: LegalCitation[], language: 'fr' | 'pt'): string {
  if (citations.length === 0) {
    return language === 'pt'
      ? '> _Nenhum artigo encontrado no corpus jurídico para esta consulta._'
      : '> _Aucun article trouvé dans le corpus juridique pour cette requête._'
  }
  const header = language === 'pt' ? '**Fontes legais citadas :**' : '**Sources légales citées :**'
  const bullets = citations.map((c) => {
    const themeSuffix = c.theme ? ` _(${c.theme})_` : ''
    return `> **${c.source} ${c.article}** — ${c.title}${themeSuffix}\n> ${c.content.replace(/\n+/g, ' ')}`
  })
  return `${header}\n\n${bullets.join('\n\n')}`
}

export interface LegalToolCall {
  match: string
  query: string
}

export function extractLegalToolCalls(text: string): LegalToolCall[] {
  const calls: LegalToolCall[] = []
  if (!text) return calls
  const re = /##TOOL##\s*(\{[\s\S]*?\})\s*##/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(m[1]) as { name?: string; args?: { query?: unknown } }
      if (parsed.name === 'cite_legal_source' && typeof parsed.args?.query === 'string') {
        calls.push({ match: m[0], query: parsed.args.query })
      }
    } catch { /* ignored */ }
  }
  return calls
}

export async function resolveLegalToolCalls(
  supabase: SupabaseClient,
  rawResponse: string,
  language: 'fr' | 'pt',
): Promise<string> {
  const calls = extractLegalToolCalls(rawResponse)
  if (calls.length === 0) return rawResponse
  let result = rawResponse
  for (const call of calls) {
    const citations = await searchLegalCorpus(supabase, call.query, language, 3)
    const formatted = formatCitationsMarkdown(citations, language)
    result = result.replace(call.match, formatted)
  }
  return result
}

// Suppress unused warning while cosineSimilarity is re-exported for future use.
export { cosineSimilarity }
