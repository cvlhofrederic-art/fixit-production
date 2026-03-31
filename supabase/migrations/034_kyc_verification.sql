-- 034_kyc_verification.sql
-- Colonnes KYC enrichies sur profiles_artisan

ALTER TABLE profiles_artisan
  ADD COLUMN IF NOT EXISTS kyc_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kyc_checks JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kbis_extracted JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS certidao_extracted JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kyc_market TEXT DEFAULT NULL;

-- Index pour filtrer les KYC en attente rapidement
CREATE INDEX IF NOT EXISTS idx_profiles_artisan_kyc_status
  ON profiles_artisan (kyc_status)
  WHERE kyc_status = 'pending';

-- Commentaires
COMMENT ON COLUMN profiles_artisan.kyc_score IS 'Score de confiance anti-fraude 0-100. >=80=auto-approuvé, <40=auto-rejeté, sinon revue manuelle.';
COMMENT ON COLUMN profiles_artisan.kyc_checks IS 'JSON détaillant chaque contrôle : siret_format/nif_format, active_in_registry, ocr_success, doc_id_match, name_match.';
COMMENT ON COLUMN profiles_artisan.kbis_extracted IS 'Données extraites du KBIS FR par OCR : denomination, siret, gerant, adresse, date_constitution.';
COMMENT ON COLUMN profiles_artisan.certidao_extracted IS 'Dados extraídos da Certidão Permanente PT por OCR : denominacao, nif, gerente, morada, data_constituicao.';
COMMENT ON COLUMN profiles_artisan.kyc_market IS 'Marché du profil : fr_artisan, pt_artisan, fr_btp. Détermine le pipeline KYC appliqué.';
