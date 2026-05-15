// lib/syndic/max-legal-rag.ts
// ──────────────────────────────────────────────────────────────────────────────
// RAG — Recherche dans le corpus juridique de Max (Plan H).
// Deux tables strictement isolées par locale : Max FR → syndic_legal_corpus_fr,
// Max PT → syndic_legal_corpus_pt. Recherche full-text via tsvector + ts_rank.
// ──────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

export interface LegalCitation {
  source: string
  article: string
  title: string
  content: string
  theme: string | null
}

interface CorpusRow {
  source: string
  article: string
  title: string
  content: string
  theme: string | null
  rank?: number
}

const MAX_CONTENT_CHARS = 600 // tronqué pour limiter le coût du prompt
const DEFAULT_LIMIT = 3

/**
 * Recherche les articles juridiques pertinents pour une requête donnée.
 * @param supabase  Client Supabase (admin recommandé pour éviter RLS lookup overhead)
 * @param query     Requête en langage naturel (mots-clés)
 * @param language  'fr' ou 'pt' — détermine la table et la config tsvector
 * @param limit     Nombre max de résultats (défaut: 3)
 */
export async function searchLegalCorpus(
  supabase: SupabaseClient,
  query: string,
  language: 'fr' | 'pt',
  limit: number = DEFAULT_LIMIT,
): Promise<LegalCitation[]> {
  const trimmed = (query || '').trim()
  if (!trimmed) return []

  const table = language === 'pt' ? 'syndic_legal_corpus_pt' : 'syndic_legal_corpus_fr'
  const tsConfig = language === 'pt' ? 'portuguese' : 'french'

  try {
    // textSearch avec plainto_tsquery — supabase-js gère l'échappement.
    // On ne peut pas exprimer ts_rank en select() directement (limitation PostgREST),
    // donc on récupère les matchs et on s'appuie sur l'ordre de pertinence
    // implicite via la sélection d'un nombre limité + tri par created_at desc.
    const { data, error } = await supabase
      .from(table)
      .select('source, article, title, content, theme')
      .textSearch('search_vector', trimmed, { config: tsConfig, type: 'plain' })
      .limit(Math.max(1, Math.min(limit, 10)))

    if (error) {
      logger.warn('[max-legal-rag] textSearch error', { error: error.message, language, query: trimmed.slice(0, 80) })
      return []
    }

    const rows = (data ?? []) as CorpusRow[]
    return rows.map((r) => ({
      source: r.source,
      article: r.article,
      title: r.title,
      content: r.content.length > MAX_CONTENT_CHARS
        ? r.content.slice(0, MAX_CONTENT_CHARS).trimEnd() + '…'
        : r.content,
      theme: r.theme ?? null,
    }))
  } catch (err) {
    logger.error('[max-legal-rag] unexpected error', {
      error: err instanceof Error ? err.message : String(err),
      language,
    })
    return []
  }
}

/**
 * Formatte un tableau de citations en bullet markdown pour insertion inline
 * dans la réponse Max. Retourne une chaîne vide si aucune citation.
 */
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

// ── Tool tag extraction (pattern ##TOOL##…##) ────────────────────────────────

export interface LegalToolCall {
  match: string         // chaîne complète à remplacer dans la réponse
  query: string         // requête extraite
}

/**
 * Extrait tous les tags ##TOOL##{"name":"cite_legal_source","args":{"query":"..."}}##
 * de la réponse brute du LLM. Renvoie la liste des occurrences à résoudre.
 */
export function extractLegalToolCalls(text: string): LegalToolCall[] {
  const calls: LegalToolCall[] = []
  if (!text) return calls

  // Pattern non-greedy multi-occurrences.
  const re = /##TOOL##\s*(\{[\s\S]*?\})\s*##/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(m[1]) as { name?: string; args?: { query?: unknown } }
      if (parsed.name === 'cite_legal_source' && typeof parsed.args?.query === 'string') {
        calls.push({ match: m[0], query: parsed.args.query })
      }
    } catch {
      // tag malformé — ignoré silencieusement (sera laissé tel quel dans la sortie)
    }
  }
  return calls
}

/**
 * Résout tous les tags cite_legal_source dans la réponse en les remplaçant
 * par les citations markdown correspondantes.
 */
export async function resolveLegalToolCalls(
  supabase: SupabaseClient,
  rawResponse: string,
  language: 'fr' | 'pt',
): Promise<string> {
  const calls = extractLegalToolCalls(rawResponse)
  if (calls.length === 0) return rawResponse

  let result = rawResponse
  for (const call of calls) {
    const citations = await searchLegalCorpus(supabase, call.query, language, DEFAULT_LIMIT)
    const formatted = formatCitationsMarkdown(citations, language)
    // Remplace la première occurrence du tag exact (chaque appel est unique grâce à exec).
    result = result.replace(call.match, formatted)
  }
  return result
}
