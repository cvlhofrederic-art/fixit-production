-- Migration 060 — Interconnexion Facturation ↔ Analytique
-- Tables: ref_taux, ref_taux_audit, charges_fixes
-- Columns: devis.chantier_id, factures.chantier_id, devis.frais_annexes, factures.frais_annexes
-- View: v_rentabilite_chantier enriched

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Table ref_taux — Taux de référence versionnés par juridiction
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_taux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  juridiction TEXT NOT NULL CHECK (juridiction IN ('FR', 'PT')),
  type_charge TEXT NOT NULL,
  regime TEXT NOT NULL,
  taux NUMERIC(8,4) NOT NULL,
  seuil_min NUMERIC(12,2),
  seuil_max NUMERIC(12,2),
  date_debut_validite DATE NOT NULL,
  date_fin_validite DATE,
  source_reglementaire TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ref_taux_lookup
  ON ref_taux(juridiction, regime, type_charge, date_debut_validite DESC);

ALTER TABLE ref_taux ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ref_taux_read" ON ref_taux;
CREATE POLICY "ref_taux_read" ON ref_taux
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ref_taux_admin_write" ON ref_taux;
CREATE POLICY "ref_taux_admin_write" ON ref_taux
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
  );
DROP POLICY IF EXISTS "ref_taux_admin_update" ON ref_taux;
CREATE POLICY "ref_taux_admin_update" ON ref_taux
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
  );
DROP POLICY IF EXISTS "ref_taux_admin_delete" ON ref_taux;
CREATE POLICY "ref_taux_admin_delete" ON ref_taux
  FOR DELETE USING (
    auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Table ref_taux_audit — Historique des modifications
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_taux_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_taux_id UUID REFERENCES ref_taux(id) ON DELETE SET NULL,
  ancien_taux NUMERIC(8,4),
  nouveau_taux NUMERIC(8,4),
  modifie_par UUID REFERENCES auth.users NOT NULL,
  motif TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ref_taux_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ref_taux_audit_admin" ON ref_taux_audit;
CREATE POLICY "ref_taux_audit_admin" ON ref_taux_audit
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Table charges_fixes — Charges fixes relationnelles (remplace le JSONB)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS charges_fixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users NOT NULL,
  label TEXT NOT NULL,
  montant NUMERIC(10,2) NOT NULL,
  frequence TEXT NOT NULL CHECK (frequence IN ('mensuel', 'trimestriel', 'annuel')),
  categorie TEXT NOT NULL CHECK (categorie IN (
    'decennale', 'rc_pro', 'loyer', 'leasing',
    'comptabilite', 'vehicule', 'telephone',
    'logiciel', 'formation', 'autre'
  )),
  date_debut DATE,
  date_fin DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE charges_fixes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "charges_fixes_owner" ON charges_fixes;
CREATE POLICY "charges_fixes_owner" ON charges_fixes
  FOR ALL USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_charges_fixes_owner ON charges_fixes(owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Migrate existing JSONB frais_fixes_mensuels → charges_fixes
-- ─────────────────────────────────────────────────────────────────────────────

-- Migration idempotente : n'insère que si charges_fixes est vide pour cet owner
-- (évite doublons si la migration est rejouée).
INSERT INTO charges_fixes (owner_id, label, montant, frequence, categorie)
SELECT
  s.owner_id,
  ff->>'label',
  (ff->>'montant')::NUMERIC(10,2),
  COALESCE(ff->>'frequence', 'mensuel'),
  'autre'
FROM settings_btp s,
  jsonb_array_elements(s.frais_fixes_mensuels) AS ff
WHERE jsonb_array_length(s.frais_fixes_mensuels) > 0
  AND NOT EXISTS (
    SELECT 1 FROM charges_fixes cf WHERE cf.owner_id = s.owner_id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Liaison devis/factures ↔ chantier + frais annexes
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE devis ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES chantiers_btp(id);
ALTER TABLE factures ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES chantiers_btp(id);
ALTER TABLE devis ADD COLUMN IF NOT EXISTS frais_annexes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS frais_annexes JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_devis_chantier ON devis(chantier_id) WHERE chantier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_factures_chantier ON factures(chantier_id) WHERE chantier_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Enrichir la vue v_rentabilite_chantier
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
  -- Bénéfice brut
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
  -- Coût MO par jour
  CASE WHEN COALESCE(p.nb_jours_pointes, 0) > 0
    THEN (COALESCE(p.cout_main_oeuvre_brut, 0) + COALESCE(p.cout_charges_patronales, 0) + COALESCE(p.cout_indemnites, 0)) / p.nb_jours_pointes
    ELSE 0
  END AS perte_par_jour_retard,
  -- === NEW: Devis/Factures liés ===
  COALESCE(fac.montant_facture_ht, 0) AS montant_facture_ht_lie,
  COALESCE(dev.montant_devis_ht, 0) AS montant_devis_ht_lie,
  COALESCE(fac.total_frais_annexes_factures, 0) AS total_frais_annexes_factures,
  COALESCE(dev.total_frais_annexes_devis, 0) AS total_frais_annexes_devis,
  COALESCE(fac.nb_factures, 0) AS nb_factures_liees,
  COALESCE(dev.nb_devis, 0) AS nb_devis_lies,
  -- Détail par ouvrier (JSON)
  COALESCE(p.detail_ouvriers, '[]'::jsonb) AS detail_ouvriers
FROM chantiers_btp c
LEFT JOIN (
  SELECT
    pt.chantier_id,
    SUM(pt.heures_travaillees) AS total_heures,
    COUNT(DISTINCT pt.employe) AS nb_ouvriers,
    COUNT(DISTINCT pt.date) AS nb_jours_pointes,
    SUM(pt.heures_travaillees * COALESCE(m.cout_horaire, 25)) AS cout_main_oeuvre_brut,
    SUM(pt.heures_travaillees * COALESCE(m.cout_horaire, 25) * COALESCE(m.charges_patronales_pct, 45) / 100) AS cout_charges_patronales,
    SUM(
      CASE WHEN m.id IS NOT NULL
        THEN COALESCE(m.panier_repas_jour, 0) + COALESCE(m.indemnite_trajet_jour, 0)
        ELSE 0
      END
    ) AS cout_indemnites,
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
) d ON d.chantier_id = c.id
-- NEW: Factures liées
LEFT JOIN (
  SELECT
    f.chantier_id,
    SUM(f.total_ht_cents::NUMERIC / 100) AS montant_facture_ht,
    COUNT(*) AS nb_factures,
    SUM(
      COALESCE((
        SELECT SUM((item->>'total_ht')::NUMERIC)
        FROM jsonb_array_elements(f.frais_annexes) AS item
      ), 0)
    ) AS total_frais_annexes_factures
  FROM factures f
  WHERE f.chantier_id IS NOT NULL AND f.deleted_at IS NULL
  GROUP BY f.chantier_id
) fac ON fac.chantier_id = c.id
-- NEW: Devis liés
LEFT JOIN (
  SELECT
    dv.chantier_id,
    SUM(dv.total_ht_cents::NUMERIC / 100) AS montant_devis_ht,
    COUNT(*) AS nb_devis,
    SUM(
      COALESCE((
        SELECT SUM((item->>'total_ht')::NUMERIC)
        FROM jsonb_array_elements(dv.frais_annexes) AS item
      ), 0)
    ) AS total_frais_annexes_devis
  FROM devis dv
  WHERE dv.chantier_id IS NOT NULL
  GROUP BY dv.chantier_id
) dev ON dev.chantier_id = c.id;
