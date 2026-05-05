-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 081 — Hash chain documents (FR-V1)
-- Date: 2026-05-05
-- ══════════════════════════════════════════════════════════════════════════════
-- Inaltérabilité (condition I de ISCA, loi anti-fraude TVA art. 88 LF 2016).
-- Chaque devis/facture émis (status='sent' / 'pending') reçoit :
--   - content_hash : SHA-256 du payload canonique
--   - previous_hash : content_hash du document précédent (par artisan)
--   - chain_signature : HMAC-SHA256(secret, content_hash || previous_hash)
--   - signed_at : timestamp d'émission (existe déjà sur devis ; ajouté à factures)
--
-- Les colonnes sont remplies par l'application au moment du passage à 'sent'/
-- 'pending' (lib/document-integrity.ts). Pattern inspiré de pt_fiscal_documents
-- (migration 040 Portugal).

-- ── 1. Colonnes ──────────────────────────────────────────────────────────────
ALTER TABLE devis ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS previous_hash TEXT;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS chain_signature TEXT;
-- devis.signed_at existe déjà (migration 038)

ALTER TABLE factures ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS previous_hash TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS chain_signature TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

-- ── 2. Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_devis_signed_at
  ON devis(artisan_user_id, signed_at) WHERE signed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_factures_signed_at
  ON factures(artisan_user_id, signed_at) WHERE signed_at IS NOT NULL;

-- ── 3. Vues d'audit chaîne (vérification continuité) ─────────────────────────
CREATE OR REPLACE VIEW v_devis_chain_check AS
SELECT
  d.id,
  d.artisan_user_id,
  d.numero,
  d.signed_at,
  d.previous_hash,
  d.content_hash,
  LAG(d.content_hash) OVER (
    PARTITION BY d.artisan_user_id ORDER BY d.signed_at, d.id
  ) AS expected_previous_hash,
  CASE
    WHEN d.signed_at IS NULL THEN 'unsigned'
    WHEN d.content_hash IS NULL THEN 'missing_hash'
    WHEN d.previous_hash IS DISTINCT FROM LAG(d.content_hash) OVER (
      PARTITION BY d.artisan_user_id ORDER BY d.signed_at, d.id
    ) THEN 'broken'
    ELSE 'ok'
  END AS chain_status
FROM devis d
WHERE d.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_factures_chain_check AS
SELECT
  f.id,
  f.artisan_user_id,
  f.numero,
  f.signed_at,
  f.previous_hash,
  f.content_hash,
  LAG(f.content_hash) OVER (
    PARTITION BY f.artisan_user_id ORDER BY f.signed_at, f.id
  ) AS expected_previous_hash,
  CASE
    WHEN f.signed_at IS NULL THEN 'unsigned'
    WHEN f.content_hash IS NULL THEN 'missing_hash'
    WHEN f.previous_hash IS DISTINCT FROM LAG(f.content_hash) OVER (
      PARTITION BY f.artisan_user_id ORDER BY f.signed_at, f.id
    ) THEN 'broken'
    ELSE 'ok'
  END AS chain_status
FROM factures f
WHERE f.deleted_at IS NULL;

COMMENT ON COLUMN devis.content_hash IS 'SHA-256 hex du payload canonique au moment de l''émission.';
COMMENT ON COLUMN devis.previous_hash IS 'content_hash du devis précédent (par artisan, ordre signed_at).';
COMMENT ON COLUMN devis.chain_signature IS 'HMAC-SHA256(DOC_HASH_SECRET, content_hash || previous_hash).';
COMMENT ON VIEW v_devis_chain_check IS 'Vérifie l''intégrité de la chaîne de hash devis par artisan.';

COMMENT ON COLUMN factures.content_hash IS 'SHA-256 hex du payload canonique au moment de l''émission.';
COMMENT ON COLUMN factures.previous_hash IS 'content_hash de la facture précédente (par artisan, ordre signed_at).';
COMMENT ON COLUMN factures.chain_signature IS 'HMAC-SHA256(DOC_HASH_SECRET, content_hash || previous_hash).';
COMMENT ON VIEW v_factures_chain_check IS 'Vérifie l''intégrité de la chaîne de hash factures par artisan.';
