-- ── PII encrypted columns ────────────────────────────────────────────────────
-- Series A hardening: add side-by-side BYTEA columns to host AES-256-GCM
-- ciphertext for the most sensitive identifiers in profiles_artisan and
-- pt_fiscal_documents. The plaintext columns stay alongside until dual-write
-- has been validated on 100 % of new writes — only then can we drop them
-- (see docs/pii-encryption.md "Cleanup phase").
--
-- Idempotent (ADD COLUMN IF NOT EXISTS) so re-running on environments that
-- already have the columns is a no-op.

ALTER TABLE profiles_artisan
  ADD COLUMN IF NOT EXISTS siret_encrypted          BYTEA,
  ADD COLUMN IF NOT EXISTS nif_encrypted            BYTEA,
  ADD COLUMN IF NOT EXISTS kbis_extracted_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS pii_encryption_version   INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN profiles_artisan.siret_encrypted IS
  'AES-256-GCM ciphertext (base64 string stored as bytea). Plaintext mirror in profiles_artisan.siret until cleanup phase. See docs/pii-encryption.md.';
COMMENT ON COLUMN profiles_artisan.nif_encrypted IS
  'AES-256-GCM ciphertext. Plaintext mirror in profiles_artisan.nif until cleanup phase.';
COMMENT ON COLUMN profiles_artisan.kbis_extracted_encrypted IS
  'AES-256-GCM ciphertext of the JSON-serialised KBIS extraction. Plaintext mirror in profiles_artisan.kbis_extracted.';
COMMENT ON COLUMN profiles_artisan.pii_encryption_version IS
  '0 = plaintext only, 1 = dual-write (plaintext + AES-256-GCM), 2+ = future rotations.';

ALTER TABLE pt_fiscal_documents
  ADD COLUMN IF NOT EXISTS issuer_nif_encrypted     BYTEA,
  ADD COLUMN IF NOT EXISTS client_nif_encrypted     BYTEA,
  ADD COLUMN IF NOT EXISTS pii_encryption_version   INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN pt_fiscal_documents.issuer_nif_encrypted IS
  'AES-256-GCM ciphertext of issuer_nif. Plaintext mirror in pt_fiscal_documents.issuer_nif until cleanup phase.';
COMMENT ON COLUMN pt_fiscal_documents.client_nif_encrypted IS
  'AES-256-GCM ciphertext of client_nif. Plaintext mirror in pt_fiscal_documents.client_nif until cleanup phase.';
