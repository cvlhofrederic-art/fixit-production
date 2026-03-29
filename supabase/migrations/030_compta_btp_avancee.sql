-- Migration 030 — Comptabilité BTP avancée
-- Salaire patron, situation fiscale, charges détaillées par membre, frais fixes

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Enrichir settings_btp — Profil fiscal du patron
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE settings_btp
  -- Salaire patron
  ADD COLUMN IF NOT EXISTS salaire_patron_mensuel NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salaire_patron_type TEXT DEFAULT 'net'
    CHECK (salaire_patron_type IN ('net', 'brut')),
  -- Situation fiscale
  ADD COLUMN IF NOT EXISTS statut_juridique TEXT DEFAULT 'sarl'
    CHECK (statut_juridique IN ('sarl', 'sas', 'eurl', 'sasu', 'ei', 'micro', 'sa', 'scop')),
  ADD COLUMN IF NOT EXISTS regime_tva TEXT DEFAULT 'reel_normal'
    CHECK (regime_tva IN ('reel_normal', 'reel_simplifie', 'franchise', 'mini_reel')),
  ADD COLUMN IF NOT EXISTS taux_is NUMERIC(5,2) DEFAULT 25.00, -- impôt sur les sociétés %
  ADD COLUMN IF NOT EXISTS taux_cotisations_patron NUMERIC(5,2) DEFAULT 45.00, -- charges patron sur son salaire
  -- Frais fixes mensuels (loyer, assurance, comptable, véhicules, etc.)
  ADD COLUMN IF NOT EXISTS frais_fixes_mensuels JSONB DEFAULT '[]'::jsonb,
  -- Objectif de marge
  ADD COLUMN IF NOT EXISTS objectif_marge_pct NUMERIC(5,2) DEFAULT 20.00,
  -- Amortissements mensuels (matériel, véhicules)
  ADD COLUMN IF NOT EXISTS amortissements_mensuels NUMERIC(10,2) DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Enrichir membres_btp — Coûts détaillés par ouvrier
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE membres_btp
  -- Salaire
  ADD COLUMN IF NOT EXISTS salaire_brut_mensuel NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS salaire_net_mensuel NUMERIC(10,2),
  -- Charges détaillées
  ADD COLUMN IF NOT EXISTS charges_salariales_pct NUMERIC(5,2) DEFAULT 22.00,
  ADD COLUMN IF NOT EXISTS charges_patronales_pct NUMERIC(5,2) DEFAULT 45.00,
  -- Contrat
  ADD COLUMN IF NOT EXISTS type_contrat TEXT DEFAULT 'cdi'
    CHECK (type_contrat IN ('cdi', 'cdd', 'interim', 'apprenti', 'stage', 'independant')),
  ADD COLUMN IF NOT EXISTS heures_hebdo NUMERIC(5,2) DEFAULT 35.00,
  -- Indemnités
  ADD COLUMN IF NOT EXISTS panier_repas_jour NUMERIC(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indemnite_trajet_jour NUMERIC(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prime_mensuelle NUMERIC(8,2) DEFAULT 0,
  -- Actif/inactif
  ADD COLUMN IF NOT EXISTS actif BOOLEAN DEFAULT TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Enrichir chantiers_btp — Données financières chantier
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE chantiers_btp
  ADD COLUMN IF NOT EXISTS marge_prevue_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS tva_taux NUMERIC(5,2) DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS montant_facture NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acompte_recu NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalite_retard_jour NUMERIC(10,2) DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Recréer la vue rentabilité avec les nouveaux champs
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS v_rentabilite_chantier;

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
  c.marge_prevue_pct,
  c.tva_taux,
  c.montant_facture,
  c.acompte_recu,
  c.penalite_retard_jour,
  -- Durée
  GREATEST(1, EXTRACT(DAY FROM (c.date_fin::timestamp - c.date_debut::timestamp))) AS jours_prevu,
  -- Main d'oeuvre détaillée
  COALESCE(p.total_heures, 0) AS total_heures,
  COALESCE(p.nb_ouvriers, 0) AS nb_ouvriers,
  COALESCE(p.nb_jours_pointes, 0) AS nb_jours_pointes,
  COALESCE(p.cout_main_oeuvre_brut, 0) AS cout_main_oeuvre_brut,
  COALESCE(p.cout_charges_patronales, 0) AS cout_charges_patronales,
  COALESCE(p.cout_indemnites, 0) AS cout_indemnites,
  COALESCE(p.cout_main_oeuvre_brut, 0) + COALESCE(p.cout_charges_patronales, 0) + COALESCE(p.cout_indemnites, 0) AS cout_main_oeuvre_total,
  -- Dépenses
  COALESCE(d.total_materiaux, 0) AS total_materiaux,
  COALESCE(d.total_autres, 0) AS total_autres,
  COALESCE(d.total_depenses, 0) AS total_depenses,
  -- Totaux
  COALESCE(p.cout_main_oeuvre_brut, 0) + COALESCE(p.cout_charges_patronales, 0) + COALESCE(p.cout_indemnites, 0) + COALESCE(d.total_depenses, 0) AS cout_total,
  -- CA réel (facturé ou budget)
  GREATEST(COALESCE(c.montant_facture, 0), COALESCE(c.budget, 0)) AS ca_reel,
  -- Bénéfice
  GREATEST(COALESCE(c.montant_facture, 0), COALESCE(c.budget, 0))
    - (COALESCE(p.cout_main_oeuvre_brut, 0) + COALESCE(p.cout_charges_patronales, 0) + COALESCE(p.cout_indemnites, 0) + COALESCE(d.total_depenses, 0)) AS benefice_net,
  -- Par homme par jour
  CASE WHEN COALESCE(p.nb_ouvriers, 0) > 0 AND COALESCE(p.nb_jours_pointes, 0) > 0
    THEN (
      GREATEST(COALESCE(c.montant_facture, 0), COALESCE(c.budget, 0))
      - (COALESCE(p.cout_main_oeuvre_brut, 0) + COALESCE(p.cout_charges_patronales, 0) + COALESCE(p.cout_indemnites, 0) + COALESCE(d.total_depenses, 0))
    ) / (p.nb_ouvriers * p.nb_jours_pointes)
    ELSE 0
  END AS benefice_par_homme_jour,
  -- Coût MO par jour (= perte si retard)
  CASE WHEN COALESCE(p.nb_jours_pointes, 0) > 0
    THEN (COALESCE(p.cout_main_oeuvre_brut, 0) + COALESCE(p.cout_charges_patronales, 0) + COALESCE(p.cout_indemnites, 0)) / p.nb_jours_pointes
    ELSE 0
  END AS perte_par_jour_retard,
  -- Détail par ouvrier (JSON)
  COALESCE(p.detail_ouvriers, '[]'::jsonb) AS detail_ouvriers
FROM chantiers_btp c
LEFT JOIN (
  SELECT
    pt.chantier_id,
    SUM(pt.heures_travaillees) AS total_heures,
    COUNT(DISTINCT pt.employe) AS nb_ouvriers,
    COUNT(DISTINCT pt.date) AS nb_jours_pointes,
    -- Coût brut = heures × taux horaire
    SUM(pt.heures_travaillees * COALESCE(m.cout_horaire, 25)) AS cout_main_oeuvre_brut,
    -- Charges patronales
    SUM(pt.heures_travaillees * COALESCE(m.cout_horaire, 25) * COALESCE(m.charges_patronales_pct, 45) / 100) AS cout_charges_patronales,
    -- Indemnités (panier + trajet) par jour pointé par ouvrier
    SUM(
      CASE WHEN m.id IS NOT NULL
        THEN COALESCE(m.panier_repas_jour, 0) + COALESCE(m.indemnite_trajet_jour, 0)
        ELSE 0
      END
    ) AS cout_indemnites,
    -- Détail JSON par ouvrier
    jsonb_agg(DISTINCT jsonb_build_object(
      'employe', pt.employe,
      'heures', (SELECT SUM(p2.heures_travaillees) FROM pointages_btp p2 WHERE p2.chantier_id = pt.chantier_id AND p2.employe = pt.employe),
      'cout_horaire', COALESCE(m.cout_horaire, 25),
      'charges_pct', COALESCE(m.charges_patronales_pct, 45),
      'type_contrat', COALESCE(m.type_contrat, 'cdi')
    )) AS detail_ouvriers
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
