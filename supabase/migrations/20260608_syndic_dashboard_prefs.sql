-- Préférences de la barre latérale du dashboard syndic v54 (1 ligne par cabinet).
-- item_order : ids des entrées sidebar dans l'ordre souhaité (par section).
-- items_hidden : ids des entrées masquées. RLS owner stricte. À appliquer en prod.
CREATE TABLE IF NOT EXISTS syndic_dashboard_prefs (
  cabinet_id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  item_order   jsonb NOT NULL DEFAULT '[]'::jsonb,
  items_hidden jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE syndic_dashboard_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS syndic_dashboard_prefs_owner ON syndic_dashboard_prefs;
CREATE POLICY syndic_dashboard_prefs_owner ON syndic_dashboard_prefs FOR ALL TO authenticated
  USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid());
