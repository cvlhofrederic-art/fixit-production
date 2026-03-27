-- ═══════════════════════════════════════════════════════════════
-- BOURSE AUX MARCHÉS — Tables appels d'offres + candidatures
-- ═══════════════════════════════════════════════════════════════

-- 1. Table des marchés (appels d'offres)
CREATE TABLE IF NOT EXISTS marches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Publisher info (pas d'auth requise)
  publisher_name TEXT NOT NULL,
  publisher_email TEXT NOT NULL,
  publisher_phone TEXT,
  publisher_type TEXT DEFAULT 'particulier' CHECK (publisher_type IN ('syndic','entreprise','particulier')),
  publisher_user_id UUID REFERENCES auth.users(id),

  -- Détails du marché
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  location_city TEXT NOT NULL,
  location_postal TEXT,
  location_address TEXT,
  budget_min NUMERIC(10,2),
  budget_max NUMERIC(10,2),
  deadline DATE NOT NULL,
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('normal','urgent','emergency')),
  photos TEXT[] DEFAULT '{}',

  -- Gestion statut
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_review','awarded','closed','cancelled')),
  access_token TEXT NOT NULL,

  -- Compteurs
  candidatures_count INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_marches_status ON marches(status);
CREATE INDEX IF NOT EXISTS idx_marches_category ON marches(category);
CREATE INDEX IF NOT EXISTS idx_marches_deadline ON marches(deadline);
CREATE INDEX IF NOT EXISTS idx_marches_publisher_email ON marches(publisher_email);
CREATE INDEX IF NOT EXISTS idx_marches_access_token ON marches(access_token);
CREATE INDEX IF NOT EXISTS idx_marches_created_at ON marches(created_at DESC);

-- 2. Table des candidatures (bids)
CREATE TABLE IF NOT EXISTS marches_candidatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  marche_id UUID NOT NULL REFERENCES marches(id) ON DELETE CASCADE,
  artisan_id UUID NOT NULL,
  artisan_user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Détails candidature
  price NUMERIC(10,2) NOT NULL,
  timeline TEXT NOT NULL,
  description TEXT NOT NULL,
  materials_included BOOLEAN DEFAULT FALSE,
  guarantee TEXT,

  -- Statut
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Un artisan ne peut postuler qu'une fois par marché
  UNIQUE(marche_id, artisan_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_candidatures_marche ON marches_candidatures(marche_id);
CREATE INDEX IF NOT EXISTS idx_candidatures_artisan ON marches_candidatures(artisan_id);
CREATE INDEX IF NOT EXISTS idx_candidatures_artisan_user ON marches_candidatures(artisan_user_id);
CREATE INDEX IF NOT EXISTS idx_candidatures_status ON marches_candidatures(status);

-- 3. RLS Policies
ALTER TABLE marches ENABLE ROW LEVEL SECURITY;
ALTER TABLE marches_candidatures ENABLE ROW LEVEL SECURITY;

-- Marchés : lecture publique des marchés ouverts
CREATE POLICY "marches_public_read" ON marches
  FOR SELECT USING (status = 'open');

-- Marchés : le publisher peut voir tous ses marchés
CREATE POLICY "marches_publisher_read" ON marches
  FOR SELECT USING (publisher_user_id = auth.uid());

-- Marchés : insertion publique (via supabaseAdmin côté serveur, mais policy permissive au cas où)
CREATE POLICY "marches_insert" ON marches
  FOR INSERT WITH CHECK (true);

-- Marchés : update par le publisher authentifié
CREATE POLICY "marches_publisher_update" ON marches
  FOR UPDATE USING (publisher_user_id = auth.uid());

-- Candidatures : l'artisan voit ses propres candidatures
CREATE POLICY "candidatures_artisan_read" ON marches_candidatures
  FOR SELECT USING (artisan_user_id = auth.uid());

-- Candidatures : le publisher du marché voit les candidatures
CREATE POLICY "candidatures_publisher_read" ON marches_candidatures
  FOR SELECT USING (
    marche_id IN (SELECT id FROM marches WHERE publisher_user_id = auth.uid())
  );

-- Candidatures : un artisan peut insérer sa candidature
CREATE POLICY "candidatures_artisan_insert" ON marches_candidatures
  FOR INSERT WITH CHECK (artisan_user_id = auth.uid());

-- Candidatures : un artisan peut modifier sa propre candidature (retirer)
CREATE POLICY "candidatures_artisan_update" ON marches_candidatures
  FOR UPDATE USING (artisan_user_id = auth.uid());

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION update_marches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER marches_updated_at
  BEFORE UPDATE ON marches
  FOR EACH ROW
  EXECUTE FUNCTION update_marches_updated_at();

CREATE TRIGGER candidatures_updated_at
  BEFORE UPDATE ON marches_candidatures
  FOR EACH ROW
  EXECUTE FUNCTION update_marches_updated_at();
