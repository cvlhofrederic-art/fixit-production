-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 001 — Tables syndic (immeubles, signalements, missions)
-- À exécuter dans Supabase Dashboard > SQL Editor
-- https://supabase.com/dashboard/project/irluhepekbqgquveaett/sql/new
-- ══════════════════════════════════════════════════════════════════════════════

-- ── IMMEUBLES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_immeubles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  adresse TEXT NOT NULL DEFAULT '',
  ville TEXT NOT NULL DEFAULT '',
  code_postal TEXT NOT NULL DEFAULT '',
  nb_lots INTEGER DEFAULT 1,
  annee_construction INTEGER DEFAULT 2000,
  type_immeuble TEXT DEFAULT 'Copropriété',
  gestionnaire TEXT DEFAULT '',
  prochain_controle DATE,
  nb_interventions INTEGER DEFAULT 0,
  budget_annuel NUMERIC DEFAULT 0,
  depenses_annee NUMERIC DEFAULT 0,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geoloc_activee BOOLEAN DEFAULT false,
  rayon_detection INTEGER DEFAULT 150,
  reglement_texte TEXT,
  reglement_pdf_nom TEXT,
  reglement_date_maj DATE,
  reglement_charges_repartition TEXT,
  reglement_majorite_ag TEXT,
  reglement_fonds_travaux BOOLEAN DEFAULT false,
  reglement_fonds_roulement_pct NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── SIGNALEMENTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_signalements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID,
  immeuble_nom TEXT,
  demandeur_nom TEXT NOT NULL DEFAULT '',
  demandeur_role TEXT CHECK (demandeur_role IN ('coproprio','locataire','technicien')),
  demandeur_email TEXT,
  demandeur_telephone TEXT,
  type_intervention TEXT NOT NULL DEFAULT 'Autre',
  description TEXT,
  priorite TEXT DEFAULT 'normale' CHECK (priorite IN ('urgente','normale','planifiee')),
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente','acceptee','en_cours','terminee','annulee')),
  batiment TEXT,
  etage TEXT,
  num_lot TEXT,
  est_partie_commune BOOLEAN DEFAULT false,
  zone_signalee TEXT,
  artisan_assigne TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── MESSAGES SIGNALEMENT ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_signalement_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signalement_id UUID REFERENCES syndic_signalements(id) ON DELETE CASCADE,
  auteur TEXT NOT NULL,
  role TEXT NOT NULL,
  texte TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── MISSIONS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID,
  signalement_id UUID REFERENCES syndic_signalements(id),
  immeuble TEXT,
  artisan TEXT,
  type TEXT,
  description TEXT,
  priorite TEXT DEFAULT 'normale' CHECK (priorite IN ('urgente','normale','planifiee')),
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente','acceptee','en_cours','terminee','annulee')),
  date_creation DATE DEFAULT CURRENT_DATE,
  date_intervention DATE,
  montant_devis NUMERIC,
  montant_facture NUMERIC,
  batiment TEXT,
  etage TEXT,
  num_lot TEXT,
  locataire TEXT,
  telephone_locataire TEXT,
  acces_logement TEXT,
  demandeur_nom TEXT,
  demandeur_role TEXT,
  demandeur_email TEXT,
  est_partie_commune BOOLEAN DEFAULT false,
  zone_signalee TEXT,
  canal_messages JSONB DEFAULT '[]'::jsonb,
  demandeur_messages JSONB DEFAULT '[]'::jsonb,
  rapport_artisan TEXT,
  travail_effectue TEXT,
  materiaux_utilises TEXT,
  problemes_constates TEXT,
  recommandations TEXT,
  date_rapport DATE,
  duree_intervention TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── INDEX ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_syndic_immeubles_cabinet ON syndic_immeubles(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_syndic_signalements_cabinet ON syndic_signalements(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_syndic_missions_cabinet ON syndic_missions(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_syndic_signalement_msgs ON syndic_signalement_messages(signalement_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE syndic_immeubles ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_signalements ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_signalement_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_missions ENABLE ROW LEVEL SECURITY;

-- ── POLICIES syndic_immeubles ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "syndic_immeubles_access" ON syndic_immeubles;
CREATE POLICY "syndic_immeubles_access" ON syndic_immeubles
  USING (cabinet_id = auth.uid() OR EXISTS (
    SELECT 1 FROM syndic_team_members
    WHERE cabinet_id = syndic_immeubles.cabinet_id
      AND user_id = auth.uid()
      AND is_active = true
  ));

DROP POLICY IF EXISTS "syndic_immeubles_insert" ON syndic_immeubles;
CREATE POLICY "syndic_immeubles_insert" ON syndic_immeubles FOR INSERT
  WITH CHECK (cabinet_id = auth.uid() OR EXISTS (
    SELECT 1 FROM syndic_team_members
    WHERE cabinet_id = syndic_immeubles.cabinet_id
      AND user_id = auth.uid()
      AND is_active = true
  ));

-- ── POLICIES syndic_signalements ──────────────────────────────────────────────
DROP POLICY IF EXISTS "syndic_signalements_read" ON syndic_signalements;
CREATE POLICY "syndic_signalements_read" ON syndic_signalements FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "syndic_signalements_insert" ON syndic_signalements;
CREATE POLICY "syndic_signalements_insert" ON syndic_signalements FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "syndic_signalements_update" ON syndic_signalements;
CREATE POLICY "syndic_signalements_update" ON syndic_signalements FOR UPDATE
  USING (true);

-- ── POLICIES syndic_signalement_messages ──────────────────────────────────────
DROP POLICY IF EXISTS "syndic_signalement_messages_all" ON syndic_signalement_messages;
CREATE POLICY "syndic_signalement_messages_all" ON syndic_signalement_messages
  USING (true) WITH CHECK (true);

-- ── POLICIES syndic_missions ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "syndic_missions_access" ON syndic_missions;
CREATE POLICY "syndic_missions_access" ON syndic_missions
  USING (cabinet_id = auth.uid() OR EXISTS (
    SELECT 1 FROM syndic_team_members
    WHERE cabinet_id = syndic_missions.cabinet_id
      AND user_id = auth.uid()
      AND is_active = true
  ));

DROP POLICY IF EXISTS "syndic_missions_insert" ON syndic_missions;
CREATE POLICY "syndic_missions_insert" ON syndic_missions FOR INSERT
  WITH CHECK (cabinet_id = auth.uid() OR EXISTS (
    SELECT 1 FROM syndic_team_members
    WHERE cabinet_id = syndic_missions.cabinet_id
      AND user_id = auth.uid()
      AND is_active = true
  ));

-- ── BYPASS RLS pour service role (API server-side) ───────────────────────────
-- Le service role bypasse automatiquement RLS, aucune policy supplémentaire requise
