-- ══════════════════════════════════════════════════════════════════════════════
-- Migration P1 — Léa Agent Comptable : Storage + Liste documents
-- Date: 2026-05-21
-- Réf : ~/.claude/projects/.../memory/project_lea_documents_agent.md
-- ══════════════════════════════════════════════════════════════════════════════
-- Pose la fondation pour l'ingestion de documents comptables (factures artisans,
-- devis, factures syndic, contrats, RIB, ata AG, relevés bancaires…). L'extraction
-- OCR + embeddings + RAG search arrivent en P2/P3 (champs nullable préparés ici).
--
-- Patterns réutilisés :
--   - Bucket privé + RLS folder = cabinet_id (cf 20260518_cabinet_backups_bucket.sql)
--   - Table syndic_* avec cabinet_id (cf 20260516_lea_compta_tables.sql)
--   - pgvector + HNSW (cf 20260520_legal_corpus_embeddings.sql)

-- ── 1. Bucket Supabase Storage privé ─────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('syndic-documents', 'syndic-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY syndic_documents_select ON storage.objects FOR SELECT USING (
  bucket_id = 'syndic-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY syndic_documents_insert ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'syndic-documents'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.role() = 'service_role')
);

CREATE POLICY syndic_documents_delete ON storage.objects FOR DELETE USING (
  bucket_id = 'syndic-documents'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.role() = 'service_role')
);

-- ── 2. Enum types ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE syndic_document_type AS ENUM (
    'facture_artisan', 'facture_syndic', 'devis', 'contrat',
    'rib', 'ata_ag', 'releve_bancaire', 'pv_assemblee', 'autre'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE syndic_document_status AS ENUM (
    'pending', 'processing', 'processed', 'error'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── 3. Table syndic_documents ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  immeuble_id uuid REFERENCES syndic_immeubles(id) ON DELETE SET NULL,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_path text NOT NULL UNIQUE,
  type syndic_document_type NOT NULL DEFAULT 'autre',
  status syndic_document_status NOT NULL DEFAULT 'pending',
  -- P2 fields (OCR + extraction) — nullable for P1
  extracted_text text,
  extracted_metadata jsonb DEFAULT '{}'::jsonb,
  tags text[] DEFAULT array[]::text[],
  -- P3 field (RAG embeddings) — nullable for P1
  embedding vector(1024),
  -- Audit
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id),
  processed_at timestamptz,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_syndic_documents_cabinet
  ON syndic_documents(cabinet_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_syndic_documents_type
  ON syndic_documents(cabinet_id, type, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_syndic_documents_status
  ON syndic_documents(status)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_syndic_documents_immeuble
  ON syndic_documents(immeuble_id)
  WHERE immeuble_id IS NOT NULL;

-- FTS bilingue FR + PT (P3 utilisera RRF avec embeddings)
CREATE INDEX IF NOT EXISTS idx_syndic_documents_fts_fr
  ON syndic_documents
  USING gin(to_tsvector('french', coalesce(extracted_text, '')));

CREATE INDEX IF NOT EXISTS idx_syndic_documents_fts_pt
  ON syndic_documents
  USING gin(to_tsvector('portuguese', coalesce(extracted_text, '')));

-- HNSW pour P3 (vector cosine similarity, BGE-M3 1024-dim)
CREATE INDEX IF NOT EXISTS idx_syndic_documents_embedding_hnsw
  ON syndic_documents
  USING hnsw (embedding vector_cosine_ops);

-- ── 4. RLS — strict isolation par cabinet_id ─────────────────────────────────
ALTER TABLE syndic_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY syndic_documents_select_own
  ON syndic_documents FOR SELECT
  USING (cabinet_id = auth.uid());

CREATE POLICY syndic_documents_insert_own
  ON syndic_documents FOR INSERT
  WITH CHECK (cabinet_id = auth.uid());

CREATE POLICY syndic_documents_update_own
  ON syndic_documents FOR UPDATE
  USING (cabinet_id = auth.uid());

CREATE POLICY syndic_documents_delete_own
  ON syndic_documents FOR DELETE
  USING (cabinet_id = auth.uid());

-- ── 5. Commentaires ──────────────────────────────────────────────────────────
COMMENT ON TABLE syndic_documents IS 'Documents comptables uploadés par les syndics (factures, devis, contrats, RIB, ata AG, relevés…). Storage : bucket syndic-documents avec path <cabinet_id>/<doc_id>.<ext>. RLS strict par cabinet_id.';
COMMENT ON COLUMN syndic_documents.extracted_text IS 'Texte OCR — peuplé en P2 par le pipeline async pdf-parse + Tesseract.';
COMMENT ON COLUMN syndic_documents.extracted_metadata IS 'Métadonnées structurées (date, montant, fournisseur, n° facture…) — peuplées en P2 via Groq.';
COMMENT ON COLUMN syndic_documents.embedding IS 'Embedding BGE-M3 (1024-dim) pour RAG hybride — peuplé en P3 via lib/syndic/embed.ts.';
