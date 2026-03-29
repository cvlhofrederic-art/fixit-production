-- Migration 029 — BTP Pro Data Tables
-- Migrate localStorage data to Supabase for chantiers, membres, équipes, pointages
-- + Geo-pointage (auto clock-in by GPS proximity)
-- + Smart accounting fields (hourly rates, charges per worker)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Chantiers BTP — Projets/Oeuvres
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chantiers_btp (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titre           TEXT NOT NULL,
  client          TEXT,
  adresse         TEXT,
  -- GPS du chantier (pour pointage géo)
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  geo_rayon_m     INT NOT NULL DEFAULT 100, -- rayon en mètres pour le pointage auto
  date_debut      DATE,
  date_fin        DATE,
  budget          NUMERIC(12,2),
  statut          TEXT NOT NULL DEFAULT 'En attente'
                  CHECK (statut IN ('En attente', 'En cours', 'Terminé', 'Annulé')),
  description     TEXT,
  equipe          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chantiers_btp_owner ON chantiers_btp(owner_id);
CREATE INDEX IF NOT EXISTS idx_chantiers_btp_statut ON chantiers_btp(owner_id, statut);

ALTER TABLE chantiers_btp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chantiers_owner_all" ON chantiers_btp
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Membres BTP — Employés / Ouvriers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS membres_btp (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prenom          TEXT NOT NULL,
  nom             TEXT NOT NULL,
  telephone       TEXT,
  email           TEXT,
  type_compte     TEXT NOT NULL DEFAULT 'ouvrier'
                  CHECK (type_compte IN ('ouvrier', 'chef_chantier', 'conducteur_travaux', 'secretaire', 'gerant')),
  role_perso      TEXT,
  equipe_id       UUID,
  -- Comptabilité intelligente : coût horaire individuel
  cout_horaire    NUMERIC(8,2) NOT NULL DEFAULT 25.00,
  charges_pct     NUMERIC(5,2) NOT NULL DEFAULT 45.00, -- % charges patronales
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_membres_btp_owner ON membres_btp(owner_id);

ALTER TABLE membres_btp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membres_owner_all" ON membres_btp
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Équipes BTP
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS equipes_btp (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom             TEXT NOT NULL,
  metier          TEXT,
  chantier_id     UUID REFERENCES chantiers_btp(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipes_btp_owner ON equipes_btp(owner_id);

ALTER TABLE equipes_btp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipes_owner_all" ON equipes_btp
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Table pivot membres ↔ équipes
CREATE TABLE IF NOT EXISTS equipe_membres_btp (
  equipe_id   UUID NOT NULL REFERENCES equipes_btp(id) ON DELETE CASCADE,
  membre_id   UUID NOT NULL REFERENCES membres_btp(id) ON DELETE CASCADE,
  PRIMARY KEY (equipe_id, membre_id)
);

ALTER TABLE equipe_membres_btp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipe_membres_owner" ON equipe_membres_btp
  FOR ALL USING (
    EXISTS (SELECT 1 FROM equipes_btp WHERE id = equipe_id AND owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM equipes_btp WHERE id = equipe_id AND owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Pointages BTP — avec géolocalisation
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pointages_btp (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membre_id       UUID REFERENCES membres_btp(id) ON DELETE SET NULL,
  chantier_id     UUID REFERENCES chantiers_btp(id) ON DELETE SET NULL,
  -- Infos texte (rétro-compat import localStorage)
  employe         TEXT NOT NULL,
  poste           TEXT,
  chantier_nom    TEXT,
  date            DATE NOT NULL,
  heure_arrivee   TIME NOT NULL,
  heure_depart    TIME,
  pause_minutes   INT NOT NULL DEFAULT 60,
  heures_travaillees NUMERIC(5,2),
  notes           TEXT,
  -- Géolocalisation
  mode            TEXT NOT NULL DEFAULT 'manuel' CHECK (mode IN ('manuel', 'geo_auto', 'geo_confirme')),
  arrivee_lat     DOUBLE PRECISION,
  arrivee_lng     DOUBLE PRECISION,
  depart_lat      DOUBLE PRECISION,
  depart_lng      DOUBLE PRECISION,
  distance_m      INT, -- distance au chantier au moment du pointage
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pointages_btp_owner ON pointages_btp(owner_id);
CREATE INDEX IF NOT EXISTS idx_pointages_btp_date ON pointages_btp(owner_id, date);
CREATE INDEX IF NOT EXISTS idx_pointages_btp_chantier ON pointages_btp(chantier_id);
CREATE INDEX IF NOT EXISTS idx_pointages_btp_membre ON pointages_btp(membre_id);

ALTER TABLE pointages_btp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pointages_owner_all" ON pointages_btp
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Dépenses BTP — liées aux chantiers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS depenses_btp (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chantier_id     UUID REFERENCES chantiers_btp(id) ON DELETE SET NULL,
  label           TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  category        TEXT NOT NULL DEFAULT 'autre',
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_depenses_btp_owner ON depenses_btp(owner_id);
CREATE INDEX IF NOT EXISTS idx_depenses_btp_chantier ON depenses_btp(chantier_id);

ALTER TABLE depenses_btp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "depenses_owner_all" ON depenses_btp
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Paramètres BTP — config du patron (dépôt GPS, coûts horaires par défaut)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings_btp (
  owner_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Dépôt / QG de l'entreprise
  depot_adresse       TEXT,
  depot_lat           DOUBLE PRECISION,
  depot_lng           DOUBLE PRECISION,
  depot_rayon_m       INT NOT NULL DEFAULT 100,
  -- Coûts horaires par défaut par rôle
  cout_horaire_ouvrier          NUMERIC(8,2) NOT NULL DEFAULT 22.00,
  cout_horaire_chef_chantier    NUMERIC(8,2) NOT NULL DEFAULT 30.00,
  cout_horaire_conducteur       NUMERIC(8,2) NOT NULL DEFAULT 40.00,
  -- Charges patronales par défaut (%)
  charges_patronales_pct        NUMERIC(5,2) NOT NULL DEFAULT 45.00,
  -- Pointage géo activé ?
  geo_pointage_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  -- Devise
  devise              TEXT NOT NULL DEFAULT 'EUR',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE settings_btp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_owner_all" ON settings_btp
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Vue comptabilité intelligente — coût réel par homme/jour par chantier
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_rentabilite_chantier AS
SELECT
  c.id AS chantier_id,
  c.owner_id,
  c.titre,
  c.client,
  c.budget,
  c.date_debut,
  c.date_fin,
  c.statut,
  -- Durée prévue
  GREATEST(1, EXTRACT(DAY FROM (c.date_fin::timestamp - c.date_debut::timestamp))) AS jours_prevu,
  -- Main d'oeuvre
  COALESCE(p.total_heures, 0) AS total_heures,
  COALESCE(p.nb_ouvriers, 0) AS nb_ouvriers,
  COALESCE(p.nb_jours_pointes, 0) AS nb_jours_pointes,
  COALESCE(p.cout_main_oeuvre, 0) AS cout_main_oeuvre,
  -- Dépenses
  COALESCE(d.total_materiaux, 0) AS total_materiaux,
  COALESCE(d.total_autres, 0) AS total_autres,
  COALESCE(d.total_depenses, 0) AS total_depenses,
  -- Totaux
  COALESCE(p.cout_main_oeuvre, 0) + COALESCE(d.total_depenses, 0) AS cout_total,
  COALESCE(c.budget, 0) - (COALESCE(p.cout_main_oeuvre, 0) + COALESCE(d.total_depenses, 0)) AS benefice_net,
  -- Par homme par jour
  CASE WHEN COALESCE(p.nb_ouvriers, 0) > 0 AND COALESCE(p.nb_jours_pointes, 0) > 0
    THEN (COALESCE(c.budget, 0) - (COALESCE(p.cout_main_oeuvre, 0) + COALESCE(d.total_depenses, 0)))
         / (p.nb_ouvriers * p.nb_jours_pointes)
    ELSE 0
  END AS benefice_par_homme_jour,
  -- Perte par jour de retard
  CASE WHEN COALESCE(p.nb_ouvriers, 0) > 0
    THEN p.cout_main_oeuvre / GREATEST(1, p.nb_jours_pointes) -- coût MO par jour
    ELSE 0
  END AS perte_par_jour_retard
FROM chantiers_btp c
LEFT JOIN (
  SELECT
    pt.chantier_id,
    SUM(pt.heures_travaillees) AS total_heures,
    COUNT(DISTINCT pt.employe) AS nb_ouvriers,
    COUNT(DISTINCT pt.date) AS nb_jours_pointes,
    SUM(
      pt.heures_travaillees * COALESCE(m.cout_horaire, 25) * (1 + COALESCE(m.charges_pct, 45) / 100)
    ) AS cout_main_oeuvre
  FROM pointages_btp pt
  LEFT JOIN membres_btp m ON m.id = pt.membre_id
  GROUP BY pt.chantier_id
) p ON p.chantier_id = c.id
LEFT JOIN (
  SELECT
    dp.chantier_id,
    SUM(CASE WHEN dp.category IN ('materiel', 'materiaux') THEN dp.amount ELSE 0 END) AS total_materiaux,
    SUM(CASE WHEN dp.category NOT IN ('materiel', 'materiaux') THEN dp.amount ELSE 0 END) AS total_autres,
    SUM(dp.amount) AS total_depenses
  FROM depenses_btp dp
  GROUP BY dp.chantier_id
) d ON d.chantier_id = c.id;
