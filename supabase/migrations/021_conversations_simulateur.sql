-- ── Table conversations_simulateur : historique des estimations IA ──

CREATE TABLE IF NOT EXISTS conversations_simulateur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  metiers_detectes TEXT[],
  estimation_basse DECIMAL,
  estimation_haute DECIMAL,
  ville TEXT,
  code_postal TEXT,
  devis_demande BOOLEAN DEFAULT false,
  bourse_publiee BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversations_simulateur ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_own_conversations" ON conversations_simulateur
  FOR ALL USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_conversations_simulateur_client
  ON conversations_simulateur(client_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE conversations_simulateur;
