-- supabase/migrations/20260513_alfredo_drafts.sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Migration — Colonnes drafts Alfredo (Plan C Chunk 8)
-- Date: 2026-05-13
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE syndic_emails_analysed
  ADD COLUMN draft_subject text,
  ADD COLUMN draft_body_html text,
  ADD COLUMN draft_body_text text,
  ADD COLUMN draft_status text DEFAULT 'none'
    CHECK (draft_status IN ('none', 'generating', 'pending_review', 'approved', 'sent', 'edited_sent', 'skipped', 'expired')),
  ADD COLUMN draft_meta jsonb,
  ADD COLUMN draft_generated_at timestamptz,
  ADD COLUMN draft_reviewed_at timestamptz,
  ADD COLUMN draft_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_emails_pending_alfredo
  ON syndic_emails_analysed(syndic_id, draft_generated_at DESC)
  WHERE draft_status = 'pending_review';

CREATE INDEX idx_emails_alfredo_status
  ON syndic_emails_analysed(syndic_id, draft_status, received_at DESC)
  WHERE draft_status != 'none';

COMMENT ON COLUMN syndic_emails_analysed.draft_status IS
  'État du brouillon Alfredo : none | generating | pending_review | approved | sent | edited_sent | skipped | expired';

ALTER TABLE syndic_alfredo_learning
  ADD CONSTRAINT fk_syndic_alfredo_learning_email
  FOREIGN KEY (email_id) REFERENCES syndic_emails_analysed(id) ON DELETE SET NULL;
