-- Migration 061 — FK chantier_id sur situations/dc4/retenues
-- Connecte tous les modules BTP au chantier par FK au lieu de texte libre

-- 1. Ajouter chantier_id FK
ALTER TABLE situations_btp ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES chantiers_btp(id);
ALTER TABLE dc4_btp ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES chantiers_btp(id);
ALTER TABLE retenues_btp ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES chantiers_btp(id);

-- 2. Index pour performance des joins
CREATE INDEX IF NOT EXISTS idx_situations_chantier ON situations_btp(chantier_id) WHERE chantier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dc4_chantier ON dc4_btp(chantier_id) WHERE chantier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_retenues_chantier ON retenues_btp(chantier_id) WHERE chantier_id IS NOT NULL;

-- 3. Backfill : lier les lignes existantes par matching titre (meme owner)
UPDATE situations_btp s SET chantier_id = c.id
FROM chantiers_btp c
WHERE s.chantier_id IS NULL AND s.owner_id = c.owner_id
  AND lower(trim(s.chantier)) = lower(trim(c.titre));

UPDATE dc4_btp d SET chantier_id = c.id
FROM chantiers_btp c
WHERE d.chantier_id IS NULL AND d.owner_id = c.owner_id
  AND lower(trim(d.chantier)) = lower(trim(c.titre));

UPDATE retenues_btp r SET chantier_id = c.id
FROM chantiers_btp c
WHERE r.chantier_id IS NULL AND r.owner_id = c.owner_id
  AND lower(trim(r.chantier)) = lower(trim(c.titre));
