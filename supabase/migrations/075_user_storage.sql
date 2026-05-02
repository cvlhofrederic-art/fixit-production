-- ════════════════════════════════════════════════════════════════════════════
-- 075 — user_storage : key-value JSONB par utilisateur, miroir cross-device
-- ════════════════════════════════════════════════════════════════════════════
-- Beaucoup de donnees applicatives (absences, equipements, contrats, journal
-- de chantier, lots, ppsps, registre securite, sav, sinistres, parametres
-- modules, conversations messagerie, ...) sont actuellement stockees en
-- localStorage uniquement. Consequence : un utilisateur qui change d'ordi,
-- de navigateur, ou nettoie ses donnees du site perd tout.
--
-- Cette table generique stocke n'importe quelle paire clef/valeur scoped
-- a l'utilisateur. Le client mirror chaque ecriture localStorage
-- (prefixee `fixit_*`) ici, et a chaque login on hydrate le localStorage
-- depuis la DB. Resultat : portabilite totale sans refactoriser chaque
-- composant.
--
-- Pour les donnees deja modelisees en tables relationnelles (devis,
-- factures, chantiers_btp, equipes_btp, etc.), celles-ci restent la
-- source de verite ; user_storage stocke uniquement les donnees encore
-- en local-only.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_storage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, key)
);

-- ── Trigger updated_at ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_user_storage_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_storage_updated_at ON user_storage;
CREATE TRIGGER user_storage_updated_at
  BEFORE UPDATE ON user_storage
  FOR EACH ROW
  EXECUTE FUNCTION update_user_storage_updated_at();

-- ── Index pour la liste hydration (toutes les cles d'un user) ───────────────
CREATE INDEX IF NOT EXISTS idx_user_storage_user_updated
  ON user_storage(user_id, updated_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE user_storage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_storage_owner" ON user_storage;
CREATE POLICY "user_storage_owner" ON user_storage
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE user_storage IS 'Key-value JSONB par utilisateur — miroir des donnees localStorage pour portabilite cross-device';
COMMENT ON COLUMN user_storage.key IS 'Cle exacte du localStorage (ex: fixit_absences_<artisan_id>)';
COMMENT ON COLUMN user_storage.value IS 'Valeur JSONB (objet, tableau, ou primitif)';
