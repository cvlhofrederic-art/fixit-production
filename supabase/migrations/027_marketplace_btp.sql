-- Migration 027 — Marketplace PRO BTP
-- Peer-to-peer location/vente de matériel et engins entre professionnels
-- Séparé de la Bourse aux Marchés (missions) — tables indépendantes

-- ─────────────────────────────────────────────────────────────────────────────
-- Annonces (listings)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Identification
  title                       TEXT NOT NULL,
  description                 TEXT,
  -- Catégorie & type
  categorie                   TEXT NOT NULL,
  -- engins_tp | grues_levage | camions | echafaudages | outillage_pro
  -- materiaux_gros | materiaux_second | materiel_electro
  -- mini_engins | materiel_leger | autre_pro
  type_annonce                TEXT NOT NULL CHECK (type_annonce IN ('vente','location','vente_location')),
  -- Tarifs
  prix_vente                  NUMERIC(12,2),
  prix_location_jour          NUMERIC(12,2),
  prix_location_semaine       NUMERIC(12,2),
  prix_location_mois          NUMERIC(12,2),
  -- Disponibilité
  disponible_de               DATE,
  disponible_jusqu            DATE,
  -- Localisation
  localisation                TEXT,
  latitude                    NUMERIC(10,7),
  longitude                   NUMERIC(10,7),
  country                     TEXT NOT NULL DEFAULT 'FR',
  -- Détails produit
  marque                      TEXT,
  modele                      TEXT,
  annee                       INTEGER,
  etat                        TEXT NOT NULL DEFAULT 'bon'
                              CHECK (etat IN ('neuf','bon','correct','use')),
  caracteristiques            JSONB DEFAULT '{}',
  -- Photos (URLs Supabase storage ou externes)
  photos                      TEXT[] DEFAULT '{}',
  -- Vendeur info (snapshot)
  vendeur_nom                 TEXT,
  vendeur_phone               TEXT,
  -- Accès restreint pour auto-entrepreneurs
  accessible_ae               BOOLEAN NOT NULL DEFAULT FALSE,
  -- État annonce
  status                      TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','paused','vendu','loue','deleted')),
  vues                        INTEGER NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Demandes de location / achat
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_demandes (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id                  UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  buyer_user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type_demande                TEXT NOT NULL CHECK (type_demande IN ('achat','location')),
  date_debut                  DATE,
  date_fin                    DATE,
  message                     TEXT,
  prix_propose                NUMERIC(12,2),
  status                      TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','accepted','rejected','completed','cancelled')),
  reponse_vendeur             TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Index
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mpl_user_id      ON marketplace_listings (user_id);
CREATE INDEX IF NOT EXISTS idx_mpl_categorie    ON marketplace_listings (categorie);
CREATE INDEX IF NOT EXISTS idx_mpl_country      ON marketplace_listings (country);
CREATE INDEX IF NOT EXISTS idx_mpl_status       ON marketplace_listings (status);
CREATE INDEX IF NOT EXISTS idx_mpl_accessible_ae ON marketplace_listings (accessible_ae);
CREATE INDEX IF NOT EXISTS idx_mpd_listing_id   ON marketplace_demandes (listing_id);
CREATE INDEX IF NOT EXISTS idx_mpd_buyer        ON marketplace_demandes (buyer_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE marketplace_listings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_demandes  ENABLE ROW LEVEL SECURITY;

-- Listings : lecture publique (annonces actives), écriture par propriétaire
CREATE POLICY "marketplace_listings_read"   ON marketplace_listings FOR SELECT USING (status <> 'deleted');
CREATE POLICY "marketplace_listings_insert" ON marketplace_listings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "marketplace_listings_update" ON marketplace_listings FOR UPDATE USING  (auth.uid() = user_id);
CREATE POLICY "marketplace_listings_delete" ON marketplace_listings FOR DELETE USING  (auth.uid() = user_id);

-- Demandes : acheteur voit les siennes, vendeur voit les demandes sur ses annonces
CREATE POLICY "marketplace_demandes_buyer_read" ON marketplace_demandes FOR SELECT
  USING (
    auth.uid() = buyer_user_id
    OR auth.uid() IN (SELECT user_id FROM marketplace_listings WHERE id = listing_id)
  );
CREATE POLICY "marketplace_demandes_insert" ON marketplace_demandes FOR INSERT WITH CHECK (auth.uid() = buyer_user_id);
CREATE POLICY "marketplace_demandes_update" ON marketplace_demandes FOR UPDATE
  USING (
    auth.uid() = buyer_user_id
    OR auth.uid() IN (SELECT user_id FROM marketplace_listings WHERE id = listing_id)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger updated_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_marketplace_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_mpl_updated BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION update_marketplace_updated_at();
CREATE TRIGGER trg_mpd_updated BEFORE UPDATE ON marketplace_demandes
  FOR EACH ROW EXECUTE FUNCTION update_marketplace_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Commentaires
-- ─────────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE marketplace_listings  IS 'Marketplace PRO BTP — annonces vente/location matériel entre professionnels';
COMMENT ON TABLE marketplace_demandes  IS 'Marketplace PRO BTP — demandes achat/location des acheteurs';
COMMENT ON COLUMN marketplace_listings.accessible_ae IS 'true = visible par artisans indépendants (mini-engins / matériel léger uniquement)';
