-- ============================================================
-- 013_service_etapes.sql
-- Étapes par défaut sur les motifs/services
-- Template réutilisable: copié sur chaque devis
-- ============================================================

CREATE TABLE IF NOT EXISTS service_etapes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id    UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  ordre         INTEGER NOT NULL DEFAULT 0,
  designation   TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_service_etapes_service_id
  ON service_etapes(service_id);

-- RLS: artisan voit uniquement les étapes de ses propres services
ALTER TABLE service_etapes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "artisan_own_service_etapes"
  ON service_etapes
  FOR ALL
  USING (
    service_id IN (
      SELECT s.id FROM services s
      JOIN profiles_artisan pa ON pa.id = s.artisan_id
      WHERE pa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    service_id IN (
      SELECT s.id FROM services s
      JOIN profiles_artisan pa ON pa.id = s.artisan_id
      WHERE pa.user_id = auth.uid()
    )
  );

-- Service role bypass (pour les API routes avec supabaseAdmin)
CREATE POLICY "service_role_full_access"
  ON service_etapes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
