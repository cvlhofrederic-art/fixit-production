-- Migration : table syndic_alertes
-- Alertes priorisées par cabinet syndic (critique, haute, normal, info).
-- Séparée de syndic_notifications qui sert de log générique.

CREATE TABLE IF NOT EXISTS syndic_alertes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  immeuble_id    uuid        REFERENCES syndic_immeubles(id) ON DELETE SET NULL,
  titre          text        NOT NULL,
  message        text,
  severity       text        NOT NULL DEFAULT 'normal'
                             CHECK (severity IN ('info', 'normal', 'haute', 'critique')),
  resolved_at    timestamptz,
  resolved_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Index partiel : uniquement les alertes non résolues, triées par date décroissante
CREATE INDEX IF NOT EXISTS idx_syndic_alertes_cabinet
  ON syndic_alertes(cabinet_id, created_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE syndic_alertes ENABLE ROW LEVEL SECURITY;

-- SELECT : le user accède aux alertes de son cabinet ou d'un cabinet dont il est membre actif
CREATE POLICY syndic_alertes_select ON syndic_alertes
  FOR SELECT USING (
    cabinet_id = auth.uid()
    OR cabinet_id IN (
      SELECT cabinet_id FROM syndic_team_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- INSERT : idem
CREATE POLICY syndic_alertes_insert ON syndic_alertes
  FOR INSERT WITH CHECK (
    cabinet_id = auth.uid()
    OR cabinet_id IN (
      SELECT cabinet_id FROM syndic_team_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- UPDATE : idem (résolution d'alerte, modification priorité)
CREATE POLICY syndic_alertes_update ON syndic_alertes
  FOR UPDATE USING (
    cabinet_id = auth.uid()
    OR cabinet_id IN (
      SELECT cabinet_id FROM syndic_team_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
