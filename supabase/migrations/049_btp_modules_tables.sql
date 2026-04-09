-- ══════════════════════════════════════════════════════════════════════════════
-- 049: Tables BTP manquantes — Situations, Retenues, DC4, DPGF
-- Complète la migration localStorage → Supabase pour tous les modules BTP
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Situations de travaux ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS situations_btp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chantier TEXT NOT NULL DEFAULT '',
  client TEXT DEFAULT '',
  numero INTEGER NOT NULL DEFAULT 1,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  montant_marche NUMERIC(12,2) DEFAULT 0,
  travaux JSONB NOT NULL DEFAULT '[]'::jsonb,
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','envoyée','validée','payée')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_situations_btp_owner ON situations_btp(owner_id);
ALTER TABLE situations_btp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "situations_btp_owner" ON situations_btp FOR ALL USING (auth.uid() = owner_id);

-- ── Retenues de garantie ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retenues_btp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chantier TEXT NOT NULL DEFAULT '',
  client TEXT DEFAULT '',
  montant_marche NUMERIC(12,2) DEFAULT 0,
  taux_retenue NUMERIC(5,2) DEFAULT 5,
  montant_retenu NUMERIC(12,2) DEFAULT 0,
  date_fin_travaux DATE,
  date_liberation DATE,
  statut TEXT NOT NULL DEFAULT 'active' CHECK (statut IN ('active','mainlevée_demandée','libérée')),
  caution BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_retenues_btp_owner ON retenues_btp(owner_id);
ALTER TABLE retenues_btp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "retenues_btp_owner" ON retenues_btp FOR ALL USING (auth.uid() = owner_id);

-- ── Sous-traitance DC4 ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dc4_btp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entreprise TEXT NOT NULL DEFAULT '',
  siret TEXT DEFAULT '',
  responsable TEXT DEFAULT '',
  email TEXT DEFAULT '',
  telephone TEXT DEFAULT '',
  adresse TEXT DEFAULT '',
  chantier TEXT DEFAULT '',
  lot TEXT DEFAULT '',
  montant_marche NUMERIC(12,2) DEFAULT 0,
  taux_tva NUMERIC(5,2) DEFAULT 20,
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','agréé','refusé')),
  date_agrement DATE,
  dc4_genere BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dc4_btp_owner ON dc4_btp(owner_id);
ALTER TABLE dc4_btp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dc4_btp_owner" ON dc4_btp FOR ALL USING (auth.uid() = owner_id);

-- ── Analyses DCE (liées à DC4) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dce_analyses_btp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titre TEXT NOT NULL DEFAULT '',
  country TEXT DEFAULT 'FR' CHECK (country IN ('FR','PT')),
  project_type TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','error')),
  result JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dce_analyses_btp_owner ON dce_analyses_btp(owner_id);
ALTER TABLE dce_analyses_btp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dce_analyses_btp_owner" ON dce_analyses_btp FOR ALL USING (auth.uid() = owner_id);

-- ── Appels d'offres / DPGF ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dpgf_btp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titre TEXT NOT NULL DEFAULT '',
  client TEXT DEFAULT '',
  date_remise DATE,
  montant_estime NUMERIC(12,2) DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours','soumis','gagné','perdu')),
  lots JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dpgf_btp_owner ON dpgf_btp(owner_id);
ALTER TABLE dpgf_btp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpgf_btp_owner" ON dpgf_btp FOR ALL USING (auth.uid() = owner_id);
