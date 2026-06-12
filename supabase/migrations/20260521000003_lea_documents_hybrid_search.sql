-- ══════════════════════════════════════════════════════════════════════════════
-- Migration P3 — Léa Agent Comptable : hybrid search (FTS + vector + RRF)
-- Date: 2026-05-21
-- ══════════════════════════════════════════════════════════════════════════════
-- Pattern réutilisé de search_legal_corpus_hybrid_pt/fr (Max consultor juridique).
-- Combine FTS bilingue (tsvector FR + PT) + vector similarity (HNSW) via RRF.
--
-- Scoping strict : la fonction accepte cabinet_id pour ne retourner que les
-- documents du syndic appelant (RLS-equivalent côté SQL).

CREATE OR REPLACE FUNCTION search_syndic_documents_hybrid(
  p_cabinet_id uuid,
  query_text text,
  query_embedding vector(1024),
  query_locale text DEFAULT 'french',
  filter_type syndic_document_type DEFAULT NULL,
  filter_immeuble_id uuid DEFAULT NULL,
  match_count integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  filename text,
  type syndic_document_type,
  status syndic_document_status,
  immeuble_id uuid,
  uploaded_at timestamptz,
  extracted_metadata jsonb,
  snippet text,
  vector_score double precision,
  bm25_score double precision,
  rrf_score double precision
)
LANGUAGE sql
STABLE
AS $$
  WITH vector_results AS (
    SELECT
      d.id,
      ROW_NUMBER() OVER (ORDER BY d.embedding <=> query_embedding) AS rank,
      1 - (d.embedding <=> query_embedding) AS score
    FROM syndic_documents d
    WHERE d.cabinet_id = p_cabinet_id
      AND d.embedding IS NOT NULL
      AND (filter_type IS NULL OR d.type = filter_type)
      AND (filter_immeuble_id IS NULL OR d.immeuble_id = filter_immeuble_id)
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count * 3
  ),
  fts_results AS (
    SELECT
      d.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector(query_locale::regconfig, coalesce(d.extracted_text, '')), plainto_tsquery(query_locale::regconfig, query_text)) DESC) AS rank,
      ts_rank_cd(to_tsvector(query_locale::regconfig, coalesce(d.extracted_text, '')), plainto_tsquery(query_locale::regconfig, query_text)) AS score
    FROM syndic_documents d
    WHERE d.cabinet_id = p_cabinet_id
      AND to_tsvector(query_locale::regconfig, coalesce(d.extracted_text, '')) @@ plainto_tsquery(query_locale::regconfig, query_text)
      AND (filter_type IS NULL OR d.type = filter_type)
      AND (filter_immeuble_id IS NULL OR d.immeuble_id = filter_immeuble_id)
    ORDER BY score DESC
    LIMIT match_count * 3
  ),
  combined AS (
    SELECT
      COALESCE(v.id, f.id) AS id,
      COALESCE(v.score, 0)::double precision AS vector_score,
      COALESCE(f.score, 0)::double precision AS bm25_score,
      -- RRF : 1/(60+rank), constante 60 standard
      COALESCE(1.0 / (60 + v.rank), 0)::double precision +
      COALESCE(1.0 / (60 + f.rank), 0)::double precision AS rrf_score
    FROM vector_results v
    FULL OUTER JOIN fts_results f ON v.id = f.id
  )
  SELECT
    d.id,
    d.filename,
    d.type,
    d.status,
    d.immeuble_id,
    d.uploaded_at,
    d.extracted_metadata,
    ts_headline(query_locale::regconfig, coalesce(d.extracted_text, ''), plainto_tsquery(query_locale::regconfig, query_text), 'MaxFragments=2, MinWords=5, MaxWords=20, FragmentDelimiter=" … "') AS snippet,
    c.vector_score,
    c.bm25_score,
    c.rrf_score
  FROM combined c
  JOIN syndic_documents d ON d.id = c.id
  WHERE d.cabinet_id = p_cabinet_id  -- defense-in-depth scoping
  ORDER BY c.rrf_score DESC
  LIMIT match_count;
$$;

COMMENT ON FUNCTION search_syndic_documents_hybrid IS 'P3 Léa — recherche hybride RRF (FTS bilingue + vector BGE-M3) scopée par cabinet_id. Locale fr/pt via query_locale. Filters optionnels type + immeuble_id. Retourne snippet ts_headline pour preview.';
