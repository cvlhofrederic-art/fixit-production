-- Migration 026 — Paramètres TVA / IVA par artisan
-- Ajoute deux colonnes à profiles_artisan :
--   tva_auto_activate : l'artisan veut être notifié pour activer la TVA automatiquement
--   tva_notified_level : dernier niveau de seuil pour lequel une notif a été envoyée
--                        ('warning' | 'exceeded' | 'exceeded_majore')
--                        Permet d'éviter le spam de notifications

ALTER TABLE profiles_artisan
  ADD COLUMN IF NOT EXISTS tva_auto_activate   BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tva_notified_level  TEXT     CHECK (tva_notified_level IN ('warning', 'exceeded', 'exceeded_majore'));

-- Index léger pour les requêtes de check
CREATE INDEX IF NOT EXISTS idx_profiles_artisan_tva
  ON profiles_artisan (id, tva_notified_level);

COMMENT ON COLUMN profiles_artisan.tva_auto_activate  IS 'Activer automatiquement la TVA dès dépassement du seuil';
COMMENT ON COLUMN profiles_artisan.tva_notified_level IS 'Dernier niveau de seuil notifié (évite le spam)';
