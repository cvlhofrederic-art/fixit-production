-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 066 : ajout colonnes BTP sous-traitance manquantes sur la table `marches`
--
-- Contexte : le code POST /api/marches/sous-traitance et POST /api/marches
-- référencent ces colonnes depuis le 28/04 (PR #50 + #56 simulateur-v2 + commits
-- récents Bourse), mais aucune migration n'a été appliquée. Conséquence :
--   - Toute publication de sous-traitance BTP échouait (insert silencieux côté
--     UI car le frontend ne remontait pas l'erreur Supabase)
--   - Le SELECT enrichi côté GET /api/marches plantait avec column "X" does
--     not exist → "Erreur de chargement des marchés" côté Bourse artisan
--
-- Ces colonnes sont toutes optionnelles (pas de NOT NULL) car les marchés
-- existants (clients particuliers + scrappés BOAMP) ne les renseignent pas.
-- ─────────────────────────────────────────────────────────────────────────────

-- Identification de l'entreprise publieuse (sous-traitance uniquement)
ALTER TABLE marches ADD COLUMN IF NOT EXISTS btp_company_id   TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS btp_company_name TEXT;

-- Type de mission de sous-traitance
-- Valeurs : 'sous_traitance_complete' | 'renfort_equipe'
ALTER TABLE marches ADD COLUMN IF NOT EXISTS mission_type TEXT;

-- Calendrier de la mission
ALTER TABLE marches ADD COLUMN IF NOT EXISTS start_date    DATE;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS duration_text TEXT;

-- Effectif souhaité (sous-traitance avec équipe)
ALTER TABLE marches ADD COLUMN IF NOT EXISTS nb_intervenants_souhaite INTEGER;

-- Index pour accélérer les filtres sur source_type côté Bourse
-- (déjà utilisé dans le GET filter "marche_type=prives|publics")
CREATE INDEX IF NOT EXISTS idx_marches_source_type ON marches (source_type);

-- Commentaires de schéma pour documentation
COMMENT ON COLUMN marches.btp_company_id IS
  'ID de l''entreprise BTP publieuse (uniquement quand source_type = btp_sous_traitance)';
COMMENT ON COLUMN marches.btp_company_name IS
  'Nom commercial de l''entreprise BTP publieuse';
COMMENT ON COLUMN marches.mission_type IS
  'Type de mission de sous-traitance : sous_traitance_complete | renfort_equipe';
COMMENT ON COLUMN marches.start_date IS
  'Date de début souhaitée de la mission (sous-traitance BTP)';
COMMENT ON COLUMN marches.duration_text IS
  'Durée libre de la mission (ex: "3 semaines", "jusqu''à fin mai")';
COMMENT ON COLUMN marches.nb_intervenants_souhaite IS
  'Nombre d''intervenants/équipe souhaité (sous-traitance BTP avec équipe)';
