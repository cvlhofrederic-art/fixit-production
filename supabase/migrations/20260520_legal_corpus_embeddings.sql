-- ═══════════════════════════════════════════════════════════════════════════
-- Activation pgvector + colonnes embeddings pour le corpus juridique syndic
-- ═══════════════════════════════════════════════════════════════════════════
-- Objet : permettre le retrieval sémantique pro 2026 pour Max (consultor IA)
-- - Active l'extension vector (déjà en v0.8.0 sur l'instance)
-- - Ajoute embedding (1024 dims BGE-M3) + question_embedding (dual embedding)
-- - Ajoute chunk_hash pour idempotence ingestion + parent_path pour audit
-- - Index HNSW pour recherche cosine sub-10ms
-- - Idem PT et FR (isolation stricte par table, jamais de mélange)

CREATE EXTENSION IF NOT EXISTS vector;

-- ── PT corpus ────────────────────────────────────────────────────────────────
ALTER TABLE syndic_legal_corpus_pt
  ADD COLUMN IF NOT EXISTS embedding vector(1024),
  ADD COLUMN IF NOT EXISTS question_embedding vector(1024),
  ADD COLUMN IF NOT EXISTS chunk_hash text,
  ADD COLUMN IF NOT EXISTS parent_path text,
  ADD COLUMN IF NOT EXISTS chunk_index integer,
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_corpus_pt_chunk_hash
  ON syndic_legal_corpus_pt (chunk_hash)
  WHERE chunk_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_legal_corpus_pt_embedding_hnsw
  ON syndic_legal_corpus_pt
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_legal_corpus_pt_question_embedding_hnsw
  ON syndic_legal_corpus_pt
  USING hnsw (question_embedding vector_cosine_ops);

-- ── FR corpus (parité structurelle, même si non utilisé pour l'instant) ─────
ALTER TABLE syndic_legal_corpus_fr
  ADD COLUMN IF NOT EXISTS embedding vector(1024),
  ADD COLUMN IF NOT EXISTS question_embedding vector(1024),
  ADD COLUMN IF NOT EXISTS chunk_hash text,
  ADD COLUMN IF NOT EXISTS parent_path text,
  ADD COLUMN IF NOT EXISTS chunk_index integer,
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_corpus_fr_chunk_hash
  ON syndic_legal_corpus_fr (chunk_hash)
  WHERE chunk_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_legal_corpus_fr_embedding_hnsw
  ON syndic_legal_corpus_fr
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_legal_corpus_fr_question_embedding_hnsw
  ON syndic_legal_corpus_fr
  USING hnsw (question_embedding vector_cosine_ops);

-- ── Garantie d'isolation : language doit matcher la table ───────────────────
-- Empêche physiquement qu'un chunk PT atterrisse dans la table FR (et vice versa)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_pt_language_isolation'
  ) THEN
    ALTER TABLE syndic_legal_corpus_pt
      ADD CONSTRAINT chk_pt_language_isolation CHECK (language = 'pt');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_fr_language_isolation'
  ) THEN
    ALTER TABLE syndic_legal_corpus_fr
      ADD CONSTRAINT chk_fr_language_isolation CHECK (language = 'fr');
  END IF;
END $$;

-- ── Trigger updated_at ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_legal_corpus_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_legal_corpus_pt_updated_at ON syndic_legal_corpus_pt;
CREATE TRIGGER trg_legal_corpus_pt_updated_at
  BEFORE UPDATE ON syndic_legal_corpus_pt
  FOR EACH ROW EXECUTE FUNCTION update_legal_corpus_updated_at();

DROP TRIGGER IF EXISTS trg_legal_corpus_fr_updated_at ON syndic_legal_corpus_fr;
CREATE TRIGGER trg_legal_corpus_fr_updated_at
  BEFORE UPDATE ON syndic_legal_corpus_fr
  FOR EACH ROW EXECUTE FUNCTION update_legal_corpus_updated_at();

-- ── Fonction de recherche hybride (vector + BM25 fusionnés par RRF) ─────────
-- Utilisée par le retrieval multi-étapes côté Node.js. La fusion RRF se fait
-- côté serveur pour réduire le nombre de roundtrips.
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
    ORDER BY score DESC
    LIMIT match_count * 3
  ),
  combined AS (
    SELECT
      COALESCE(v.id, b.id) AS id,
      COALESCE(v.score, 0)::double precision AS vector_score,
      COALESCE(b.score, 0)::double precision AS bm25_score,
      -- RRF : 1/(60+rank), constante 60 standard
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

-- Idem pour FR (parité)
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
