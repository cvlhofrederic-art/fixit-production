-- ── Table analyses_devis : persistance des analyses de devis client + syndic ──
-- Remplace le stockage localStorage par une vraie table avec RLS

CREATE TABLE IF NOT EXISTS analyses_devis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL CHECK (user_type IN ('client', 'syndic')),

  -- Document source
  pdf_url TEXT,
  pdf_text TEXT,
  filename TEXT,
  is_vitfix BOOLEAN DEFAULT FALSE,

  -- Artisan
  artisan_nom TEXT,
  artisan_siret TEXT,
  siret_verified BOOLEAN DEFAULT FALSE,

  -- Scores
  score_conformite INTEGER,
  score_conformite_max INTEGER DEFAULT 100,
  score_prix_ecart DECIMAL,
  score_confiance INTEGER,
  action_recommandee TEXT CHECK (action_recommandee IN ('valider', 'negocier', 'devis_vitfix')),

  -- Données structurées
  extracted JSONB DEFAULT '{}'::jsonb,
  scores_details JSONB DEFAULT '{}'::jsonb,
  alertes JSONB DEFAULT '[]'::jsonb,
  messages_negociation JSONB DEFAULT '[]'::jsonb,

  -- Analyse narrative complète
  analysis_text TEXT,

  -- Metadata
  model TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS : chaque utilisateur ne voit que ses propres analyses
ALTER TABLE analyses_devis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analyses_devis_own" ON analyses_devis
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_analyses_devis_user_date
  ON analyses_devis(user_id, created_at DESC);

-- Réplication temps réel (optionnel)
ALTER PUBLICATION supabase_realtime ADD TABLE analyses_devis;
