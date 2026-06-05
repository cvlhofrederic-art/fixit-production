-- ═══════════════════════════════════════════════════════════════════════════
-- Migration — Filtrer les chunks TOC du retrieval (Max v1.1)
-- Date : 2026-05-21
-- ═══════════════════════════════════════════════════════════════════════════
-- Le pipeline d'ingestion v1.1 ajoute un chunk spécial parent_path='__TOC__'
-- contenant l'index de la base de connaissance. Ce chunk est destiné à être
-- pré-chargé dans le system prompt (stratégie hybride Anthropic), PAS retourné
-- par la recherche hybride — sinon il polluerait les résultats.
--
-- On met à jour les fonctions search_legal_corpus_hybrid_pt et _fr pour exclure
-- ces chunks. Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION search_legal_corpus_hybrid_pt(
  query_text text,
  query_embedding vector(1024),
  match_count integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  source text,
  article text,
  title text,
  content text,
  theme text,
  parent_path text,
  vector_score double precision,
  bm25_score double precision,
  rrf_score double precision
)
LANGUAGE sql
STABLE
AS $$
  WITH vector_results AS (
    SELECT
      c.id,
      ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS rank,
      1 - (c.embedding <=> query_embedding) AS score
    FROM syndic_legal_corpus_pt c
    WHERE c.embedding IS NOT NULL
      AND (c.parent_path IS NULL OR c.parent_path <> '__TOC__')
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count * 3
  ),
  bm25_results AS (
    SELECT
      c.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.search_vector, plainto_tsquery('portuguese', query_text)) DESC) AS rank,
      ts_rank_cd(c.search_vector, plainto_tsquery('portuguese', query_text)) AS score
    FROM syndic_legal_corpus_pt c
    WHERE c.search_vector @@ plainto_tsquery('portuguese', query_text)
      AND (c.parent_path IS NULL OR c.parent_path <> '__TOC__')
    ORDER BY score DESC
    LIMIT match_count * 3
  ),
  combined AS (
    SELECT
      COALESCE(v.id, b.id) AS id,
      COALESCE(v.score, 0)::double precision AS vector_score,
      COALESCE(b.score, 0)::double precision AS bm25_score,
      COALESCE(1.0 / (60 + v.rank), 0)::double precision +
      COALESCE(1.0 / (60 + b.rank), 0)::double precision AS rrf_score
    FROM vector_results v
    FULL OUTER JOIN bm25_results b ON v.id = b.id
  )
  SELECT
    c.id,
    cor.source,
    cor.article,
    cor.title,
    cor.content,
    cor.theme,
    cor.parent_path,
    c.vector_score,
    c.bm25_score,
    c.rrf_score
  FROM combined c
  JOIN syndic_legal_corpus_pt cor ON cor.id = c.id
  ORDER BY c.rrf_score DESC
  LIMIT match_count;
$$;

-- Parité FR (même si Max FR est dormant, on garde la structure cohérente)
CREATE OR REPLACE FUNCTION search_legal_corpus_hybrid_fr(
  query_text text,
  query_embedding vector(1024),
  match_count integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  source text,
  article text,
  title text,
  content text,
  theme text,
  parent_path text,
  vector_score double precision,
  bm25_score double precision,
  rrf_score double precision
)
LANGUAGE sql
STABLE
AS $$
  WITH vector_results AS (
    SELECT
      c.id,
      ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS rank,
      1 - (c.embedding <=> query_embedding) AS score
    FROM syndic_legal_corpus_fr c
    WHERE c.embedding IS NOT NULL
      AND (c.parent_path IS NULL OR c.parent_path <> '__TOC__')
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count * 3
  ),
  bm25_results AS (
    SELECT
      c.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.search_vector, plainto_tsquery('french', query_text)) DESC) AS rank,
      ts_rank_cd(c.search_vector, plainto_tsquery('french', query_text)) AS score
    FROM syndic_legal_corpus_fr c
    WHERE c.search_vector @@ plainto_tsquery('french', query_text)
      AND (c.parent_path IS NULL OR c.parent_path <> '__TOC__')
    ORDER BY score DESC
    LIMIT match_count * 3
  ),
  combined AS (
    SELECT
      COALESCE(v.id, b.id) AS id,
      COALESCE(v.score, 0)::double precision AS vector_score,
      COALESCE(b.score, 0)::double precision AS bm25_score,
      COALESCE(1.0 / (60 + v.rank), 0)::double precision +
      COALESCE(1.0 / (60 + b.rank), 0)::double precision AS rrf_score
    FROM vector_results v
    FULL OUTER JOIN bm25_results b ON v.id = b.id
  )
  SELECT
    c.id,
    cor.source,
    cor.article,
    cor.title,
    cor.content,
    cor.theme,
    cor.parent_path,
    c.vector_score,
    c.bm25_score,
    c.rrf_score
  FROM combined c
  JOIN syndic_legal_corpus_fr cor ON cor.id = c.id
  ORDER BY c.rrf_score DESC
  LIMIT match_count;
$$;
