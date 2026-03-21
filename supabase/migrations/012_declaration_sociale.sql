-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 012 — Profil fiscal artisan + table declarations_sociales
-- ══════════════════════════════════════════════════════════════════════════════

-- Profil fiscal sur profiles_artisan
ALTER TABLE profiles_artisan
  ADD COLUMN IF NOT EXISTS type_activite TEXT;
  -- FR: 'bic_ventes','bic_services','bnc_general','bnc_cipav'
  -- PT: 'prestadores_servicos','producao_venda_bens','empresarios_nome_individual'

ALTER TABLE profiles_artisan
  ADD COLUMN IF NOT EXISTS periodicite_declaration TEXT DEFAULT 'trimestrielle';
  -- FR: 'mensuelle' ou 'trimestrielle' | PT: toujours 'trimestrielle'

ALTER TABLE profiles_artisan
  ADD COLUMN IF NOT EXISTS acre_actif BOOLEAN DEFAULT false;

ALTER TABLE profiles_artisan
  ADD COLUMN IF NOT EXISTS acre_date_fin DATE;

ALTER TABLE profiles_artisan
  ADD COLUMN IF NOT EXISTS declaration_configuree BOOLEAN DEFAULT false;

-- Table historique des déclarations sociales
CREATE TABLE IF NOT EXISTS declarations_sociales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID NOT NULL REFERENCES profiles_artisan(id),
  pays TEXT NOT NULL DEFAULT 'FR',
  periode_label TEXT NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  ca_periode NUMERIC(10,2) NOT NULL DEFAULT 0,
  taux_applique NUMERIC(5,4) NOT NULL DEFAULT 0,
  cotisations_estimees NUMERIC(10,2) NOT NULL DEFAULT 0,
  date_limite_declaration DATE NOT NULL,
  statut TEXT NOT NULL DEFAULT 'a_declarer'
    CHECK (statut IN ('a_declarer', 'declare', 'ignore')),
  date_declaration_effectuee TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_declarations_artisan ON declarations_sociales(artisan_id);
CREATE INDEX IF NOT EXISTS idx_declarations_statut ON declarations_sociales(artisan_id, statut);

-- RLS
ALTER TABLE declarations_sociales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "artisans_own_declarations" ON declarations_sociales
  FOR ALL USING (
    artisan_id IN (
      SELECT id FROM profiles_artisan WHERE user_id = auth.uid()
    )
  );
