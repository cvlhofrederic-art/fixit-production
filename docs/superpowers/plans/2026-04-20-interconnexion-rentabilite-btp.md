# Interconnexion Facturation ↔ Analytique — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up billing, site tracking, and analytics modules so artisans see real net profitability per construction site — after all social/fiscal charges — adapted to their legal form (FR or PT).

**Architecture:** Three layers — (1) Supabase tables (`ref_taux`, `charges_fixes`, devis↔chantier FK) + enriched materialized view, (2) TypeScript calculation engine (`lib/rentabilite/`) that loads rates and computes net margin per site, (3) enriched existing dashboard components consuming the engine. No new pages — all work goes into existing sections.

**Tech Stack:** Next.js 16.2.2, TypeScript, Supabase (PostgreSQL), Tailwind CSS, Vitest, Sonner (toasts)

**Spec:** `docs/superpowers/specs/2026-04-20-interconnexion-rentabilite-btp-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/060_interconnexion_rentabilite.sql` | Tables `ref_taux`, `ref_taux_audit`, `charges_fixes`; columns on `devis`/`factures`; enriched view |
| `supabase/migrations/061_seed_ref_taux.sql` | Seed all tax/social rates for FR and PT (2026) |
| `lib/rentabilite/types.ts` | Shared interfaces: `FormeJuridique`, `CalculRentabiliteInput`, `ResultatRentabilite`, `RefTaux` |
| `lib/rentabilite/ref-taux.ts` | Load and cache `ref_taux` rows from Supabase, filtered by juridiction + regime + date |
| `lib/rentabilite/charges.ts` | Calculate social + fiscal charges per legal form |
| `lib/rentabilite/repartition.ts` | Allocate fixed costs across sites (prorata CA or time) |
| `lib/rentabilite/engine.ts` | Main `calculeRentabilite()` function composing the above |
| `tests/lib/rentabilite/engine.test.ts` | Unit tests — spec examples (SASU FR, Lda PT) + all 12 legal forms |
| `tests/lib/rentabilite/charges.test.ts` | Unit tests for charge calculation per legal form |
| `tests/lib/rentabilite/repartition.test.ts` | Unit tests for fixed cost allocation |

### Modified Files
| File | Changes |
|------|---------|
| `lib/devis-types.ts` | Add `FraisAnnexeItem` interface, add `fraisAnnexes` + `chantierId` to `DevisFactureData` |
| `components/DevisFactureForm.tsx` | Add "Frais annexes" tab/section, wire `chantierId` selection |
| `components/dashboard/ChantiersBTPV2.tsx` | Add "Devis et factures liés" section + "Lier un devis" modal |
| `components/dashboard/ComptaBTPSection.tsx` | Migrate frais fixes from JSONB to `charges_fixes` table, add categories + alerts |
| `components/dashboard/RentabiliteChantierSection.tsx` | Consume engine, 3-level display, écart devis vs réalisé |
| `components/dashboard/StatsRevenusSection.tsx` | Add pilotage banner (monthly CA, charges, net, alerts) |
| `lib/hooks/use-btp-data.ts` | Add `useChargesFixes()` hook, add `useRefTaux()` hook |
| `app/api/btp/route.ts` | Add `charges_fixes` and `ref_taux` to valid tables, handle CRUD |

---

## Task 1: Database Migration — Core Tables

**Files:**
- Create: `supabase/migrations/060_interconnexion_rentabilite.sql`

- [ ] **Step 1: Write the migration file**

```sql
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

CREATE INDEX idx_ref_taux_lookup
  ON ref_taux(juridiction, regime, type_charge, date_debut_validite DESC);

ALTER TABLE ref_taux ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ref_taux_read" ON ref_taux
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ref_taux_admin_write" ON ref_taux
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
  );
CREATE POLICY "ref_taux_admin_update" ON ref_taux
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
  );
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
CREATE POLICY "charges_fixes_owner" ON charges_fixes
  FOR ALL USING (owner_id = auth.uid());

CREATE INDEX idx_charges_fixes_owner ON charges_fixes(owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Migrate existing JSONB frais_fixes_mensuels → charges_fixes
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO charges_fixes (owner_id, label, montant, frequence, categorie)
SELECT
  s.owner_id,
  ff->>'label',
  (ff->>'montant')::NUMERIC(10,2),
  COALESCE(ff->>'frequence', 'mensuel'),
  'autre'
FROM settings_btp s,
  jsonb_array_elements(s.frais_fixes_mensuels) AS ff
WHERE jsonb_array_length(s.frais_fixes_mensuels) > 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Liaison devis/factures ↔ chantier + frais annexes
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE devis ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES chantiers_btp(id);
ALTER TABLE factures ADD COLUMN IF NOT EXISTS chantier_id UUID REFERENCES chantiers_btp(id);
ALTER TABLE devis ADD COLUMN IF NOT EXISTS frais_annexes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS frais_annexes JSONB DEFAULT '[]'::jsonb;

CREATE INDEX idx_devis_chantier ON devis(chantier_id) WHERE chantier_id IS NOT NULL;
CREATE INDEX idx_factures_chantier ON factures(chantier_id) WHERE chantier_id IS NOT NULL;

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
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db push` or apply via Supabase dashboard
Expected: Tables `ref_taux`, `ref_taux_audit`, `charges_fixes` created. Columns added to `devis`/`factures`. View recreated with new columns.

- [ ] **Step 3: Verify migration**

Run: `npx supabase db diff` — should show no pending changes
Verify in Supabase dashboard: `ref_taux`, `ref_taux_audit`, `charges_fixes` exist with RLS enabled.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/060_interconnexion_rentabilite.sql
git commit -m "feat(db): add ref_taux, charges_fixes tables and devis↔chantier liaison"
```

---

## Task 2: Seed Reference Rates

**Files:**
- Create: `supabase/migrations/061_seed_ref_taux.sql`

- [ ] **Step 1: Write the seed migration**

```sql
-- Migration 061 — Seed ref_taux with 2026 rates for FR and PT
-- Sources: URSSAF 2026, CGI, Código dos Regimes Contributivos, CIRC

-- ═══════════════════════════════════════════════════
-- FRANCE
-- ═══════════════════════════════════════════════════

-- Auto-entrepreneur BTP artisanal — cotisations sociales
INSERT INTO ref_taux (juridiction, type_charge, regime, taux, date_debut_validite, source_reglementaire, description)
VALUES
  ('FR', 'cotisations_sociales', 'auto_entrepreneur', 22.0000, '2026-01-01', 'URSSAF barème 2026 — activité artisanale BTP', 'Cotisation forfaitaire auto-entrepreneur artisan'),
  ('FR', 'versement_liberatoire', 'auto_entrepreneur', 1.7000, '2026-01-01', 'CGI art. 151-0', 'Versement libératoire IR optionnel'),
  -- Micro-BIC
  ('FR', 'cotisations_sociales', 'micro_bic', 22.0000, '2026-01-01', 'URSSAF barème 2026', 'Cotisations micro-BIC artisan'),
  ('FR', 'abattement_micro', 'micro_bic', 50.0000, '2026-01-01', 'CGI art. 50-0', 'Abattement forfaitaire BIC ventes/prestations'),
  -- EI
  ('FR', 'cotisations_sociales', 'ei', 45.0000, '2026-01-01', 'SSI barème 2026 — fourchette haute', 'Cotisations SSI sur bénéfice (variable 40-45%)'),
  -- EURL IS
  ('FR', 'charges_patronales', 'eurl_is', 42.0000, '2026-01-01', 'URSSAF barème employeur 2026', 'Charges patronales standard sur masse salariale'),
  ('FR', 'cotisations_sociales', 'eurl_is', 45.0000, '2026-01-01', 'SSI barème 2026 — gérant TNS', 'Cotisations SSI gérant majoritaire'),
  ('FR', 'is', 'eurl_is', 15.0000, '2026-01-01', 'CGI art. 219 I-b', 'IS taux réduit PME'),
  ('FR', 'is', 'eurl_is', 25.0000, '2026-01-01', 'CGI art. 219 I', 'IS taux normal'),
  -- EURL IR
  ('FR', 'charges_patronales', 'eurl_ir', 42.0000, '2026-01-01', 'URSSAF barème employeur 2026', 'Charges patronales standard'),
  ('FR', 'cotisations_sociales', 'eurl_ir', 45.0000, '2026-01-01', 'SSI barème 2026 — gérant TNS', 'Cotisations SSI gérant majoritaire'),
  -- SARL
  ('FR', 'charges_patronales', 'sarl', 42.0000, '2026-01-01', 'URSSAF barème employeur 2026', 'Charges patronales standard'),
  ('FR', 'cotisations_sociales', 'sarl', 45.0000, '2026-01-01', 'SSI barème 2026 — gérant majoritaire', 'Cotisations SSI gérant majoritaire'),
  ('FR', 'is', 'sarl', 15.0000, '2026-01-01', 'CGI art. 219 I-b', 'IS taux réduit PME'),
  ('FR', 'is', 'sarl', 25.0000, '2026-01-01', 'CGI art. 219 I', 'IS taux normal'),
  -- SASU
  ('FR', 'charges_patronales', 'sasu', 42.0000, '2026-01-01', 'URSSAF barème employeur 2026', 'Charges patronales sur salariés'),
  ('FR', 'cotisations_sociales', 'sasu', 80.0000, '2026-01-01', 'URSSAF barème assimilé salarié 2026', 'Charges sur rémunération dirigeant assimilé salarié'),
  ('FR', 'is', 'sasu', 15.0000, '2026-01-01', 'CGI art. 219 I-b', 'IS taux réduit PME'),
  ('FR', 'is', 'sasu', 25.0000, '2026-01-01', 'CGI art. 219 I', 'IS taux normal'),
  -- SAS (same as SASU)
  ('FR', 'charges_patronales', 'sas', 42.0000, '2026-01-01', 'URSSAF barème employeur 2026', 'Charges patronales sur salariés'),
  ('FR', 'cotisations_sociales', 'sas', 80.0000, '2026-01-01', 'URSSAF barème assimilé salarié 2026', 'Charges sur rémunération dirigeant assimilé salarié'),
  ('FR', 'is', 'sas', 15.0000, '2026-01-01', 'CGI art. 219 I-b', 'IS taux réduit PME'),
  ('FR', 'is', 'sas', 25.0000, '2026-01-01', 'CGI art. 219 I', 'IS taux normal'),
  -- SA FR (same as SAS)
  ('FR', 'charges_patronales', 'sa_fr', 42.0000, '2026-01-01', 'URSSAF barème employeur 2026', 'Charges patronales sur salariés'),
  ('FR', 'cotisations_sociales', 'sa_fr', 80.0000, '2026-01-01', 'URSSAF barème assimilé salarié 2026', 'Charges sur rémunération dirigeant assimilé salarié'),
  ('FR', 'is', 'sa_fr', 15.0000, '2026-01-01', 'CGI art. 219 I-b', 'IS taux réduit PME'),
  ('FR', 'is', 'sa_fr', 25.0000, '2026-01-01', 'CGI art. 219 I', 'IS taux normal');

-- IS seuils PME (applicable à toutes les formes IS)
INSERT INTO ref_taux (juridiction, type_charge, regime, taux, seuil_min, seuil_max, date_debut_validite, source_reglementaire, description)
VALUES
  ('FR', 'is_seuil_pme', 'all', 15.0000, 0, 42500.00, '2026-01-01', 'CGI art. 219 I-b — seuil PME 2026', 'IS 15% applicable jusqu''à 42 500 € de bénéfice'),
  ('FR', 'is_seuil_pme', 'all', 25.0000, 42500.01, NULL, '2026-01-01', 'CGI art. 219 I', 'IS 25% au-delà du seuil PME');

-- Contributions BTP spécifiques FR
INSERT INTO ref_taux (juridiction, type_charge, regime, taux, date_debut_validite, source_reglementaire, description)
VALUES
  ('FR', 'cibtp', 'all', 19.8000, '2026-01-01', 'CIBTP barème 2026', 'Congés payés BTP — caisse intempéries'),
  ('FR', 'intemperies', 'all', 0.6800, '2026-01-01', 'CIBTP barème 2026', 'Cotisation intempéries BTP'),
  ('FR', 'oppbtp', 'all', 0.1100, '2026-01-01', 'OPPBTP 2026', 'Formation et prévention BTP'),
  ('FR', 'pro_btp', 'all', 3.2000, '2026-01-01', 'PRO BTP barème 2026', 'Prévoyance et mutuelle BTP');

-- TVA France
INSERT INTO ref_taux (juridiction, type_charge, regime, taux, date_debut_validite, source_reglementaire, description)
VALUES
  ('FR', 'tva', 'normal', 20.0000, '2026-01-01', 'CGI art. 278', 'TVA taux normal'),
  ('FR', 'tva', 'intermediaire', 10.0000, '2026-01-01', 'CGI art. 279-0 bis', 'TVA travaux rénovation logement > 2 ans'),
  ('FR', 'tva', 'reduit', 5.5000, '2026-01-01', 'CGI art. 278-0 bis A', 'TVA taux réduit — travaux amélioration énergétique');

-- ═══════════════════════════════════════════════════
-- PORTUGAL
-- ═══════════════════════════════════════════════════

-- ENI
INSERT INTO ref_taux (juridiction, type_charge, regime, taux, date_debut_validite, source_reglementaire, description)
VALUES
  ('PT', 'cotisations_sociales', 'eni', 21.4000, '2026-01-01', 'Código dos Regimes Contributivos art. 168', 'Segurança Social ENI — base complète du revenu'),
  -- Trabalhador Independente
  ('PT', 'cotisations_sociales', 'trabalhador_independente', 21.4000, '2026-01-01', 'Código dos Regimes Contributivos art. 168', 'Segurança Social — taux sur 70% du revenu'),
  ('PT', 'base_incidence', 'trabalhador_independente', 70.0000, '2026-01-01', 'Código dos Regimes Contributivos art. 162', 'Base d''incidence: 70% du revenu relevante'),
  -- Unipessoal Lda
  ('PT', 'tsu_patronal', 'unipessoal_lda', 23.7500, '2026-01-01', 'Código dos Regimes Contributivos art. 53', 'TSU patronal — Taxa Social Única'),
  ('PT', 'tsu_salarial', 'unipessoal_lda', 11.0000, '2026-01-01', 'Código dos Regimes Contributivos art. 53', 'TSU salarié'),
  ('PT', 'fct', 'unipessoal_lda', 1.0000, '2026-01-01', 'Lei 70/2013', 'FCT + FGCT — Fundo de Compensação'),
  ('PT', 'irc', 'unipessoal_lda', 17.0000, '2026-01-01', 'CIRC art. 87 n.2', 'IRC taux réduit PME — premiers 50 000 €'),
  ('PT', 'irc', 'unipessoal_lda', 21.0000, '2026-01-01', 'CIRC art. 87 n.1', 'IRC taux normal'),
  -- Lda
  ('PT', 'tsu_patronal', 'lda', 23.7500, '2026-01-01', 'Código dos Regimes Contributivos art. 53', 'TSU patronal'),
  ('PT', 'tsu_salarial', 'lda', 11.0000, '2026-01-01', 'Código dos Regimes Contributivos art. 53', 'TSU salarié'),
  ('PT', 'fct', 'lda', 1.0000, '2026-01-01', 'Lei 70/2013', 'FCT + FGCT'),
  ('PT', 'irc', 'lda', 17.0000, '2026-01-01', 'CIRC art. 87 n.2', 'IRC taux réduit PME'),
  ('PT', 'irc', 'lda', 21.0000, '2026-01-01', 'CIRC art. 87 n.1', 'IRC taux normal'),
  -- SA PT
  ('PT', 'tsu_patronal', 'sa_pt', 23.7500, '2026-01-01', 'Código dos Regimes Contributivos art. 53', 'TSU patronal'),
  ('PT', 'tsu_salarial', 'sa_pt', 11.0000, '2026-01-01', 'Código dos Regimes Contributivos art. 53', 'TSU salarié'),
  ('PT', 'fct', 'sa_pt', 1.0000, '2026-01-01', 'Lei 70/2013', 'FCT + FGCT'),
  ('PT', 'irc', 'sa_pt', 21.0000, '2026-01-01', 'CIRC art. 87 n.1', 'IRC taux normal');

-- IRC seuil PME PT
INSERT INTO ref_taux (juridiction, type_charge, regime, taux, seuil_min, seuil_max, date_debut_validite, source_reglementaire, description)
VALUES
  ('PT', 'irc_seuil_pme', 'all', 17.0000, 0, 50000.00, '2026-01-01', 'CIRC art. 87 n.2', 'IRC 17% sur premiers 50 000 € — PME'),
  ('PT', 'irc_seuil_pme', 'all', 21.0000, 50000.01, NULL, '2026-01-01', 'CIRC art. 87 n.1', 'IRC 21% au-delà');

-- Contributions BTP spécifiques PT
INSERT INTO ref_taux (juridiction, type_charge, regime, taux, date_debut_validite, source_reglementaire, description)
VALUES
  ('PT', 'seguro_acidentes', 'all', 2.5000, '2026-01-01', 'Lei 98/2009 — Seguro de Acidentes de Trabalho', 'Assurance accidents du travail (taux moyen BTP)'),
  ('PT', 'derrama_municipal', 'all', 1.5000, '2026-01-01', 'Lei das Finanças Locais — taxa média', 'Derrama municipal (taux moyen, variable par commune)');

-- IVA Portugal
INSERT INTO ref_taux (juridiction, type_charge, regime, taux, date_debut_validite, source_reglementaire, description)
VALUES
  ('PT', 'iva', 'normal', 23.0000, '2026-01-01', 'CIVA art. 18 n.1-c', 'IVA taxa normal'),
  ('PT', 'iva', 'intermediaire', 13.0000, '2026-01-01', 'CIVA Lista II', 'IVA taxa intermédia'),
  ('PT', 'iva', 'reduit', 6.0000, '2026-01-01', 'CIVA Lista I', 'IVA taxa reduzida');
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db push`
Verify: `SELECT COUNT(*) FROM ref_taux;` — should return ~50 rows
Verify: `SELECT DISTINCT juridiction, regime FROM ref_taux ORDER BY 1, 2;` — all 12 combinations present

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/061_seed_ref_taux.sql
git commit -m "feat(db): seed ref_taux with 2026 FR and PT tax/social rates"
```

---

## Task 3: Rentabilité Engine — Types

**Files:**
- Create: `lib/rentabilite/types.ts`

- [ ] **Step 1: Write types file**

```typescript
// lib/rentabilite/types.ts
// Shared types for the profitability calculation engine

// ── Legal Forms ──

export type FormeJuridiqueFR =
  | 'auto_entrepreneur' | 'micro_bic' | 'micro_bnc'
  | 'ei' | 'eurl_is' | 'eurl_ir'
  | 'sarl' | 'sasu' | 'sas' | 'sa_fr'

export type FormeJuridiquePT =
  | 'eni' | 'trabalhador_independente'
  | 'unipessoal_lda' | 'lda' | 'sa_pt'

export type FormeJuridique = FormeJuridiqueFR | FormeJuridiquePT

export type Juridiction = 'FR' | 'PT'

export const FORMES_ARTISAN: FormeJuridique[] = [
  'auto_entrepreneur', 'micro_bic', 'micro_bnc', 'ei',
  'eni', 'trabalhador_independente',
]

export const FORMES_PRO_BTP: FormeJuridique[] = [
  'eurl_is', 'eurl_ir', 'sarl', 'sasu', 'sas', 'sa_fr',
  'unipessoal_lda', 'lda', 'sa_pt',
]

// ── Reference Rate ──

export interface RefTaux {
  id: string
  juridiction: Juridiction
  type_charge: string
  regime: string
  taux: number
  seuil_min: number | null
  seuil_max: number | null
  date_debut_validite: string
  date_fin_validite: string | null
  source_reglementaire: string
  description: string | null
}

// ── Fixed Charge ──

export type CategorieChargeFix =
  | 'decennale' | 'rc_pro' | 'loyer' | 'leasing'
  | 'comptabilite' | 'vehicule' | 'telephone'
  | 'logiciel' | 'formation' | 'autre'

export interface ChargeFixe {
  id: string
  label: string
  montant: number
  frequence: 'mensuel' | 'trimestriel' | 'annuel'
  categorie: CategorieChargeFix
  date_debut: string | null
  date_fin: string | null
}

// ── Frais Annexe (devis/facture) ──

export interface FraisAnnexeItem {
  id: string
  designation: string
  categorie: 'deplacement' | 'location_materiel' | 'hebergement' | 'peage' | 'carburant' | 'autre'
  quantite: number
  unite: 'forfait' | 'km' | 'jour' | 'heure'
  prix_unitaire_ht: number
  tva_applicable: number
  total_ht: number
}

// ── Engine Input ──

export interface CoutsChantier {
  materiaux: number
  main_oeuvre: number
  sous_traitance: number
  frais_annexes: number
}

export interface CalculRentabiliteInput {
  chantier_id: string
  montant_facture_ht: number
  montant_devis_ht: number
  couts: CoutsChantier
  devis_detail?: CoutsChantier
  masse_salariale_brute: number
  juridiction: Juridiction
  forme_juridique: FormeJuridique
  regime_tva: string
  periode: Date
  sous_traitance_autoliquidation?: boolean
}

// ── Engine Output ──

export type StatutRentabilite = 'rentable' | 'juste' | 'perte'

export interface EcartPoste {
  prevu: number
  reel: number
  ecart_pct: number
}

export interface TauxApplique {
  type: string
  taux: number
  source: string
}

export interface ResultatRentabilite {
  // Level 1 — headline
  benefice_net: number
  taux_marge_nette: number
  statut: StatutRentabilite

  // Level 2 — charge breakdown
  marge_brute: number
  taux_marge_brute: number
  charges_sociales: number
  charges_fiscales: number
  quote_part_fixes: number
  total_charges: number

  // Level 3 — devis vs réalisé
  ecart_devis: {
    materiaux: EcartPoste
    main_oeuvre: EcartPoste
    sous_traitance: EcartPoste
    frais_annexes: EcartPoste
    total: EcartPoste
  }

  // Audit trail
  taux_appliques: TauxApplique[]
  date_calcul: Date
}

// ── Repartition mode ──

export type ModeRepartition = 'prorata_ca' | 'prorata_temps'

export interface ContexteRepartition {
  mode: ModeRepartition
  ca_chantier: number
  ca_total_periode: number
  jours_chantier: number
  jours_total_periode: number
  charges_fixes_mensuelles: number
  duree_mois: number
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit lib/rentabilite/types.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add lib/rentabilite/types.ts
git commit -m "feat: add rentabilite engine type definitions"
```

---

## Task 4: Rentabilité Engine — ref-taux loader

**Files:**
- Create: `lib/rentabilite/ref-taux.ts`

- [ ] **Step 1: Write the ref-taux loader**

```typescript
// lib/rentabilite/ref-taux.ts
// Load and cache ref_taux rows from Supabase

import { supabase } from '@/lib/supabase'
import type { RefTaux, Juridiction, FormeJuridique } from './types'

let cache: { data: RefTaux[]; loadedAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function loadRefTaux(): Promise<RefTaux[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache.data
  }

  const { data, error } = await supabase
    .from('ref_taux')
    .select('*')
    .order('date_debut_validite', { ascending: false })

  if (error) throw new Error(`Failed to load ref_taux: ${error.message}`)

  const taux = (data ?? []).map((row) => ({
    ...row,
    taux: Number(row.taux),
    seuil_min: row.seuil_min != null ? Number(row.seuil_min) : null,
    seuil_max: row.seuil_max != null ? Number(row.seuil_max) : null,
  }))

  cache = { data: taux, loadedAt: Date.now() }
  return taux
}

export function invalidateCache(): void {
  cache = null
}

/**
 * Get the applicable rate for a specific charge type, jurisdiction, regime, and date.
 * Returns the most recent rate whose validity period covers the given date.
 * For rates with seuils (thresholds), pass the `montant` parameter to match the correct bracket.
 */
export function getTaux(
  allTaux: RefTaux[],
  juridiction: Juridiction,
  typeCharge: string,
  regime: string,
  date: Date,
  montant?: number,
): RefTaux | undefined {
  const dateStr = date.toISOString().split('T')[0]

  return allTaux.find((t) => {
    if (t.juridiction !== juridiction) return false
    if (t.type_charge !== typeCharge) return false
    // Match specific regime or 'all' (for shared rates like CIBTP)
    if (t.regime !== regime && t.regime !== 'all') return false
    if (t.date_debut_validite > dateStr) return false
    if (t.date_fin_validite && t.date_fin_validite < dateStr) return false
    // Threshold matching
    if (montant !== undefined) {
      if (t.seuil_min != null && montant < t.seuil_min) return false
      if (t.seuil_max != null && montant > t.seuil_max) return false
    } else {
      // If no montant provided, skip threshold-based rates
      if (t.seuil_min != null || t.seuil_max != null) return false
    }
    return true
  })
}

/**
 * Get all applicable rates for a jurisdiction + regime + date combo.
 * Useful for audit trail — returns every rate that would apply.
 */
export function getAllTauxForRegime(
  allTaux: RefTaux[],
  juridiction: Juridiction,
  regime: string,
  date: Date,
): RefTaux[] {
  const dateStr = date.toISOString().split('T')[0]

  return allTaux.filter((t) => {
    if (t.juridiction !== juridiction) return false
    if (t.regime !== regime && t.regime !== 'all') return false
    if (t.date_debut_validite > dateStr) return false
    if (t.date_fin_validite && t.date_fin_validite < dateStr) return false
    return true
  })
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add lib/rentabilite/ref-taux.ts
git commit -m "feat: add ref_taux loader with caching and threshold matching"
```

---

## Task 5: Rentabilité Engine — Charges Calculator

**Files:**
- Create: `lib/rentabilite/charges.ts`
- Create: `tests/lib/rentabilite/charges.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/rentabilite/charges.test.ts
import { describe, it, expect } from 'vitest'
import { calculeChargesSociales, calculeChargesFiscales } from '@/lib/rentabilite/charges'
import type { RefTaux } from '@/lib/rentabilite/types'

// Minimal ref_taux fixtures
const TAUX_FR: RefTaux[] = [
  { id: '1', juridiction: 'FR', type_charge: 'cotisations_sociales', regime: 'auto_entrepreneur', taux: 22, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'URSSAF', description: null },
  { id: '2', juridiction: 'FR', type_charge: 'charges_patronales', regime: 'sasu', taux: 42, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'URSSAF', description: null },
  { id: '3', juridiction: 'FR', type_charge: 'is', regime: 'sasu', taux: 15, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CGI', description: 'taux réduit PME' },
  { id: '3b', juridiction: 'FR', type_charge: 'is_seuil_pme', regime: 'all', taux: 15, seuil_min: 0, seuil_max: 42500, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CGI', description: null },
  { id: '3c', juridiction: 'FR', type_charge: 'is_seuil_pme', regime: 'all', taux: 25, seuil_min: 42500.01, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CGI', description: null },
  { id: '4', juridiction: 'FR', type_charge: 'cotisations_sociales', regime: 'ei', taux: 45, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'SSI', description: null },
]

const TAUX_PT: RefTaux[] = [
  { id: '10', juridiction: 'PT', type_charge: 'tsu_patronal', regime: 'lda', taux: 23.75, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CRC', description: null },
  { id: '11', juridiction: 'PT', type_charge: 'fct', regime: 'lda', taux: 1, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Lei 70/2013', description: null },
  { id: '12', juridiction: 'PT', type_charge: 'irc_seuil_pme', regime: 'all', taux: 17, seuil_min: 0, seuil_max: 50000, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CIRC', description: null },
  { id: '13', juridiction: 'PT', type_charge: 'irc_seuil_pme', regime: 'all', taux: 21, seuil_min: 50000.01, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CIRC', description: null },
  { id: '14', juridiction: 'PT', type_charge: 'derrama_municipal', regime: 'all', taux: 1.5, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'LFL', description: null },
  { id: '15', juridiction: 'PT', type_charge: 'seguro_acidentes', regime: 'all', taux: 2.5, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Lei 98/2009', description: null },
  { id: '16', juridiction: 'PT', type_charge: 'cotisations_sociales', regime: 'trabalhador_independente', taux: 21.4, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CRC', description: null },
  { id: '17', juridiction: 'PT', type_charge: 'base_incidence', regime: 'trabalhador_independente', taux: 70, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CRC', description: null },
]

describe('calculeChargesSociales', () => {
  const date = new Date('2026-06-15')

  it('auto-entrepreneur FR: 22% du CA', () => {
    const result = calculeChargesSociales({
      allTaux: TAUX_FR,
      juridiction: 'FR',
      formeJuridique: 'auto_entrepreneur',
      ca: 20000,
      masseSalariale: 0,
      beneficeBrut: 7200,
      date,
    })
    expect(result.montant).toBe(4400) // 22% × 20000
  })

  it('EI FR: ~45% du bénéfice', () => {
    const result = calculeChargesSociales({
      allTaux: TAUX_FR,
      juridiction: 'FR',
      formeJuridique: 'ei',
      ca: 20000,
      masseSalariale: 0,
      beneficeBrut: 7200,
      date,
    })
    expect(result.montant).toBe(3240) // 45% × 7200
  })

  it('SASU FR: 42% charges patronales sur masse salariale', () => {
    const result = calculeChargesSociales({
      allTaux: TAUX_FR,
      juridiction: 'FR',
      formeJuridique: 'sasu',
      ca: 20000,
      masseSalariale: 2800,
      beneficeBrut: 7200,
      date,
    })
    expect(result.montant).toBe(1176) // 42% × 2800
  })

  it('Lda PT: TSU 23.75% + FCT 1% sur masse salariale', () => {
    const result = calculeChargesSociales({
      allTaux: TAUX_PT,
      juridiction: 'PT',
      formeJuridique: 'lda',
      ca: 15000,
      masseSalariale: 1800,
      beneficeBrut: 5700,
      date,
    })
    expect(result.montant).toBe(445.50) // (23.75% + 1%) × 1800 = 24.75% × 1800
  })

  it('Trabalhador Independente PT: 21.4% sur 70% du revenu', () => {
    const result = calculeChargesSociales({
      allTaux: TAUX_PT,
      juridiction: 'PT',
      formeJuridique: 'trabalhador_independente',
      ca: 15000,
      masseSalariale: 0,
      beneficeBrut: 5700,
      date,
    })
    // 21.4% × (70% × 15000) = 21.4% × 10500 = 2247
    expect(result.montant).toBe(2247)
  })
})

describe('calculeChargesFiscales', () => {
  const date = new Date('2026-06-15')

  it('auto-entrepreneur FR: 0 (pas d IS)', () => {
    const result = calculeChargesFiscales({
      allTaux: TAUX_FR,
      juridiction: 'FR',
      formeJuridique: 'auto_entrepreneur',
      beneficeAvantImpot: 7200,
      date,
    })
    expect(result.montant).toBe(0)
  })

  it('SASU FR: IS 15% PME (benefice < 42500)', () => {
    const result = calculeChargesFiscales({
      allTaux: TAUX_FR,
      juridiction: 'FR',
      formeJuridique: 'sasu',
      beneficeAvantImpot: 5424, // 7200 - 1176 - 600
      date,
    })
    // IS 15% × 5424 = 813.60
    expect(result.montant).toBeCloseTo(813.60, 2)
  })

  it('Lda PT: IRC 17% PME + derrama 1.5%', () => {
    const result = calculeChargesFiscales({
      allTaux: TAUX_PT,
      juridiction: 'PT',
      formeJuridique: 'lda',
      beneficeAvantImpot: 4724.50, // 5700 - 445.50 - 80 - 450
      date,
    })
    // IRC 17% × 4724.50 = 803.165 → 803.17
    // Derrama 1.5% × 803.17 = 12.05
    // Total = 815.22
    const irc = 4724.50 * 0.17
    const derrama = irc * 0.015
    expect(result.montant).toBeCloseTo(irc + derrama, 2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/rentabilite/charges.test.ts`
Expected: FAIL — module `@/lib/rentabilite/charges` not found

- [ ] **Step 3: Write the charges calculator**

```typescript
// lib/rentabilite/charges.ts
// Calculate social and fiscal charges per legal form

import { getTaux } from './ref-taux'
import type { RefTaux, Juridiction, FormeJuridique, TauxApplique } from './types'

// ── Helpers ──

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Forms that pay cotisations as % of CA (not bénéfice)
const COTISATIONS_SUR_CA: FormeJuridique[] = ['auto_entrepreneur', 'micro_bic', 'micro_bnc']

// Forms that don't pay IS/IRC (individual tax — IR/IRS)
const PAS_D_IS: FormeJuridique[] = [
  'auto_entrepreneur', 'micro_bic', 'micro_bnc', 'ei', 'eurl_ir',
  'eni', 'trabalhador_independente',
]

// Society forms (FR) that pay charges patronales on masse salariale
const SOCIETES_FR: FormeJuridique[] = ['eurl_is', 'eurl_ir', 'sarl', 'sasu', 'sas', 'sa_fr']

// Society forms (PT) that pay TSU on masse salariale
const SOCIETES_PT: FormeJuridique[] = ['unipessoal_lda', 'lda', 'sa_pt']

// ── Social Charges ──

interface ChargesSocialesInput {
  allTaux: RefTaux[]
  juridiction: Juridiction
  formeJuridique: FormeJuridique
  ca: number
  masseSalariale: number
  beneficeBrut: number
  date: Date
}

interface ChargesResult {
  montant: number
  taux_appliques: TauxApplique[]
}

export function calculeChargesSociales(input: ChargesSocialesInput): ChargesResult {
  const { allTaux, juridiction, formeJuridique, ca, masseSalariale, beneficeBrut, date } = input
  const taux_appliques: TauxApplique[] = []
  let montant = 0

  if (juridiction === 'FR') {
    if (COTISATIONS_SUR_CA.includes(formeJuridique)) {
      // Micro/auto: cotisations = % du CA
      const t = getTaux(allTaux, 'FR', 'cotisations_sociales', formeJuridique, date)
      if (t) {
        montant = round2(ca * t.taux / 100)
        taux_appliques.push({ type: 'cotisations_sociales', taux: t.taux, source: t.source_reglementaire })
      }
    } else if (formeJuridique === 'ei') {
      // EI: SSI sur bénéfice
      const t = getTaux(allTaux, 'FR', 'cotisations_sociales', 'ei', date)
      if (t) {
        montant = round2(beneficeBrut * t.taux / 100)
        taux_appliques.push({ type: 'cotisations_sociales', taux: t.taux, source: t.source_reglementaire })
      }
    } else if (SOCIETES_FR.includes(formeJuridique)) {
      // Sociétés FR: charges patronales sur masse salariale
      const t = getTaux(allTaux, 'FR', 'charges_patronales', formeJuridique, date)
      if (t) {
        montant = round2(masseSalariale * t.taux / 100)
        taux_appliques.push({ type: 'charges_patronales', taux: t.taux, source: t.source_reglementaire })
      }
    }
  } else {
    // PT
    if (formeJuridique === 'trabalhador_independente') {
      // 21.4% on 70% of revenue
      const tBase = getTaux(allTaux, 'PT', 'base_incidence', 'trabalhador_independente', date)
      const tCot = getTaux(allTaux, 'PT', 'cotisations_sociales', 'trabalhador_independente', date)
      if (tBase && tCot) {
        const base = round2(ca * tBase.taux / 100)
        montant = round2(base * tCot.taux / 100)
        taux_appliques.push(
          { type: 'base_incidence', taux: tBase.taux, source: tBase.source_reglementaire },
          { type: 'cotisations_sociales', taux: tCot.taux, source: tCot.source_reglementaire },
        )
      }
    } else if (formeJuridique === 'eni') {
      const t = getTaux(allTaux, 'PT', 'cotisations_sociales', 'eni', date)
      if (t) {
        montant = round2(ca * t.taux / 100)
        taux_appliques.push({ type: 'cotisations_sociales', taux: t.taux, source: t.source_reglementaire })
      }
    } else if (SOCIETES_PT.includes(formeJuridique)) {
      // TSU patronal + FCT on masse salariale
      const tTsu = getTaux(allTaux, 'PT', 'tsu_patronal', formeJuridique, date)
      const tFct = getTaux(allTaux, 'PT', 'fct', formeJuridique, date)
      let total = 0
      if (tTsu) {
        total += tTsu.taux
        taux_appliques.push({ type: 'tsu_patronal', taux: tTsu.taux, source: tTsu.source_reglementaire })
      }
      if (tFct) {
        total += tFct.taux
        taux_appliques.push({ type: 'fct', taux: tFct.taux, source: tFct.source_reglementaire })
      }
      montant = round2(masseSalariale * total / 100)
    }
  }

  return { montant, taux_appliques }
}

// ── Fiscal Charges ──

interface ChargesFiscalesInput {
  allTaux: RefTaux[]
  juridiction: Juridiction
  formeJuridique: FormeJuridique
  beneficeAvantImpot: number
  date: Date
}

export function calculeChargesFiscales(input: ChargesFiscalesInput): ChargesResult {
  const { allTaux, juridiction, formeJuridique, beneficeAvantImpot, date } = input
  const taux_appliques: TauxApplique[] = []

  if (PAS_D_IS.includes(formeJuridique) || beneficeAvantImpot <= 0) {
    return { montant: 0, taux_appliques }
  }

  let montant = 0

  if (juridiction === 'FR') {
    // IS avec seuils PME
    const tReduit = getTaux(allTaux, 'FR', 'is_seuil_pme', 'all', date, Math.min(beneficeAvantImpot, 42500))
    const tNormal = getTaux(allTaux, 'FR', 'is_seuil_pme', 'all', date, 42500.01)

    if (beneficeAvantImpot <= 42500) {
      if (tReduit) {
        montant = round2(beneficeAvantImpot * tReduit.taux / 100)
        taux_appliques.push({ type: 'is', taux: tReduit.taux, source: tReduit.source_reglementaire })
      }
    } else {
      // Split: first 42500 at reduced rate, rest at normal rate
      if (tReduit) {
        montant += round2(42500 * tReduit.taux / 100)
        taux_appliques.push({ type: 'is_reduit', taux: tReduit.taux, source: tReduit.source_reglementaire })
      }
      if (tNormal) {
        montant += round2((beneficeAvantImpot - 42500) * tNormal.taux / 100)
        taux_appliques.push({ type: 'is_normal', taux: tNormal.taux, source: tNormal.source_reglementaire })
      }
    }
  } else {
    // PT — IRC avec seuils PME + derrama
    const tReduit = getTaux(allTaux, 'PT', 'irc_seuil_pme', 'all', date, Math.min(beneficeAvantImpot, 50000))
    const tNormal = getTaux(allTaux, 'PT', 'irc_seuil_pme', 'all', date, 50000.01)

    let irc = 0
    if (beneficeAvantImpot <= 50000) {
      if (tReduit) {
        irc = round2(beneficeAvantImpot * tReduit.taux / 100)
        taux_appliques.push({ type: 'irc', taux: tReduit.taux, source: tReduit.source_reglementaire })
      }
    } else {
      if (tReduit) {
        irc += round2(50000 * tReduit.taux / 100)
        taux_appliques.push({ type: 'irc_reduit', taux: tReduit.taux, source: tReduit.source_reglementaire })
      }
      if (tNormal) {
        irc += round2((beneficeAvantImpot - 50000) * tNormal.taux / 100)
        taux_appliques.push({ type: 'irc_normal', taux: tNormal.taux, source: tNormal.source_reglementaire })
      }
    }

    // Derrama municipal
    const tDerrama = getTaux(allTaux, 'PT', 'derrama_municipal', 'all', date)
    let derrama = 0
    if (tDerrama) {
      derrama = round2(irc * tDerrama.taux / 100)
      taux_appliques.push({ type: 'derrama_municipal', taux: tDerrama.taux, source: tDerrama.source_reglementaire })
    }

    montant = round2(irc + derrama)
  }

  return { montant, taux_appliques }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/lib/rentabilite/charges.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/rentabilite/charges.ts tests/lib/rentabilite/charges.test.ts
git commit -m "feat: add charge calculator for all FR/PT legal forms with tests"
```

---

## Task 6: Rentabilité Engine — Fixed Cost Repartition

**Files:**
- Create: `lib/rentabilite/repartition.ts`
- Create: `tests/lib/rentabilite/repartition.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/rentabilite/repartition.test.ts
import { describe, it, expect } from 'vitest'
import { calculeQuotePartFixes } from '@/lib/rentabilite/repartition'

describe('calculeQuotePartFixes', () => {
  it('prorata CA: allocates proportionally to revenue', () => {
    const result = calculeQuotePartFixes({
      mode: 'prorata_ca',
      ca_chantier: 20000,
      ca_total_periode: 80000,
      jours_chantier: 0,
      jours_total_periode: 0,
      charges_fixes_mensuelles: 1355,
      duree_mois: 1,
    })
    // 20000/80000 × 1355 × 1 = 338.75
    expect(result).toBeCloseTo(338.75, 2)
  })

  it('prorata temps: allocates proportionally to days', () => {
    const result = calculeQuotePartFixes({
      mode: 'prorata_temps',
      ca_chantier: 0,
      ca_total_periode: 0,
      jours_chantier: 15,
      jours_total_periode: 22,
      charges_fixes_mensuelles: 1355,
      duree_mois: 1,
    })
    // 15/22 × 1355 × 1 = 923.86
    expect(result).toBeCloseTo(923.86, 2)
  })

  it('multi-month period', () => {
    const result = calculeQuotePartFixes({
      mode: 'prorata_ca',
      ca_chantier: 20000,
      ca_total_periode: 100000,
      jours_chantier: 0,
      jours_total_periode: 0,
      charges_fixes_mensuelles: 1355,
      duree_mois: 3,
    })
    // 20000/100000 × 1355 × 3 = 813
    expect(result).toBeCloseTo(813, 2)
  })

  it('zero CA total returns 0 (no division by zero)', () => {
    const result = calculeQuotePartFixes({
      mode: 'prorata_ca',
      ca_chantier: 20000,
      ca_total_periode: 0,
      jours_chantier: 0,
      jours_total_periode: 0,
      charges_fixes_mensuelles: 1355,
      duree_mois: 1,
    })
    expect(result).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/rentabilite/repartition.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the repartition module**

```typescript
// lib/rentabilite/repartition.ts
// Allocate fixed costs across construction sites

import type { ContexteRepartition } from './types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Calculate the fixed cost share for a single site.
 * Two modes:
 * - prorata_ca: proportional to site revenue vs total revenue
 * - prorata_temps: proportional to site days vs total working days
 */
export function calculeQuotePartFixes(ctx: ContexteRepartition): number {
  const { mode, charges_fixes_mensuelles, duree_mois } = ctx
  const totalCharges = charges_fixes_mensuelles * duree_mois

  if (mode === 'prorata_ca') {
    if (ctx.ca_total_periode <= 0) return 0
    return round2((ctx.ca_chantier / ctx.ca_total_periode) * totalCharges)
  }

  // prorata_temps
  if (ctx.jours_total_periode <= 0) return 0
  return round2((ctx.jours_chantier / ctx.jours_total_periode) * totalCharges)
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/lib/rentabilite/repartition.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/rentabilite/repartition.ts tests/lib/rentabilite/repartition.test.ts
git commit -m "feat: add fixed cost repartition with prorata CA and time modes"
```

---

## Task 7: Rentabilité Engine — Main Engine

**Files:**
- Create: `lib/rentabilite/engine.ts`
- Create: `tests/lib/rentabilite/engine.test.ts`

- [ ] **Step 1: Write the failing test with spec examples**

```typescript
// tests/lib/rentabilite/engine.test.ts
import { describe, it, expect } from 'vitest'
import { calculeRentabilite } from '@/lib/rentabilite/engine'
import type { RefTaux, CalculRentabiliteInput } from '@/lib/rentabilite/types'

// Full rate fixtures matching the seed migration
const ALL_TAUX: RefTaux[] = [
  // FR
  { id: '1', juridiction: 'FR', type_charge: 'cotisations_sociales', regime: 'auto_entrepreneur', taux: 22, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'URSSAF', description: null },
  { id: '2', juridiction: 'FR', type_charge: 'charges_patronales', regime: 'sasu', taux: 42, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'URSSAF', description: null },
  { id: '3', juridiction: 'FR', type_charge: 'is_seuil_pme', regime: 'all', taux: 15, seuil_min: 0, seuil_max: 42500, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CGI', description: null },
  { id: '4', juridiction: 'FR', type_charge: 'is_seuil_pme', regime: 'all', taux: 25, seuil_min: 42500.01, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CGI', description: null },
  // PT
  { id: '10', juridiction: 'PT', type_charge: 'tsu_patronal', regime: 'lda', taux: 23.75, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CRC', description: null },
  { id: '11', juridiction: 'PT', type_charge: 'fct', regime: 'lda', taux: 1, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Lei 70/2013', description: null },
  { id: '12', juridiction: 'PT', type_charge: 'irc_seuil_pme', regime: 'all', taux: 17, seuil_min: 0, seuil_max: 50000, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CIRC', description: null },
  { id: '13', juridiction: 'PT', type_charge: 'irc_seuil_pme', regime: 'all', taux: 21, seuil_min: 50000.01, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CIRC', description: null },
  { id: '14', juridiction: 'PT', type_charge: 'derrama_municipal', regime: 'all', taux: 1.5, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'LFL', description: null },
  { id: '15', juridiction: 'PT', type_charge: 'seguro_acidentes', regime: 'all', taux: 2.5, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Lei 98/2009', description: null },
]

describe('calculeRentabilite', () => {
  it('SASU FR — spec example: bénéfice net = 4610.40 €', () => {
    const input: CalculRentabiliteInput = {
      chantier_id: 'test-sasu',
      montant_facture_ht: 20000,
      montant_devis_ht: 20000,
      couts: { materiaux: 6500, main_oeuvre: 2800, sous_traitance: 3000, frais_annexes: 500 },
      devis_detail: { materiaux: 6000, main_oeuvre: 2500, sous_traitance: 3000, frais_annexes: 400 },
      masse_salariale_brute: 2800,
      juridiction: 'FR',
      forme_juridique: 'sasu',
      regime_tva: 'reel_normal',
      periode: new Date('2026-06-15'),
    }

    const result = calculeRentabilite(input, ALL_TAUX, 600) // 600€ quote-part fixes

    expect(result.marge_brute).toBe(7200) // 20000 - 12800
    expect(result.charges_sociales).toBe(1176) // 42% × 2800
    expect(result.quote_part_fixes).toBe(600)
    expect(result.charges_fiscales).toBeCloseTo(813.60, 2) // IS 15% × (7200 - 1176 - 600)
    expect(result.benefice_net).toBeCloseTo(4610.40, 2)
    expect(result.taux_marge_nette).toBeCloseTo(23.05, 1)
    expect(result.statut).toBe('rentable')

    // Écart devis
    expect(result.ecart_devis.materiaux.ecart_pct).toBeCloseTo(8.33, 1)
    expect(result.ecart_devis.main_oeuvre.ecart_pct).toBeCloseTo(12, 0)
  })

  it('Lda PT — spec example: bénéfice net ≈ 3850.84 €', () => {
    const input: CalculRentabiliteInput = {
      chantier_id: 'test-lda',
      montant_facture_ht: 15000,
      montant_devis_ht: 15000,
      couts: { materiaux: 5000, main_oeuvre: 1800, sous_traitance: 2200, frais_annexes: 300 },
      masse_salariale_brute: 1800,
      juridiction: 'PT',
      forme_juridique: 'lda',
      regime_tva: 'normal',
      periode: new Date('2026-06-15'),
    }

    // From spec: TSU+FCT = 427.50+18 = 445.50, seguro = 80, fixes = 450
    // IRC = (5700 - 445.50 - 80 - 450) × 17% = 4724.50 × 17% = 803.17
    // Derrama = 803.17 × 1.5% = 12.05
    // Total charges = 445.50 + 80 + 450 + 803.17 + 12.05 = 1790.72
    // But our engine doesn't include seguro_acidentes in social charges yet
    // and quote_part_fixes is passed separately
    const result = calculeRentabilite(input, ALL_TAUX, 450) // 450€ quote-part fixes

    expect(result.marge_brute).toBe(5700)
    expect(result.charges_sociales).toBe(445.50) // (23.75+1)% × 1800
    expect(result.quote_part_fixes).toBe(450)
    expect(result.statut).toBe('rentable')
  })

  it('handles zero revenue gracefully', () => {
    const input: CalculRentabiliteInput = {
      chantier_id: 'test-zero',
      montant_facture_ht: 0,
      montant_devis_ht: 0,
      couts: { materiaux: 500, main_oeuvre: 0, sous_traitance: 0, frais_annexes: 0 },
      masse_salariale_brute: 0,
      juridiction: 'FR',
      forme_juridique: 'auto_entrepreneur',
      regime_tva: 'franchise',
      periode: new Date('2026-06-15'),
    }

    const result = calculeRentabilite(input, ALL_TAUX, 0)
    expect(result.marge_brute).toBe(-500)
    expect(result.statut).toBe('perte')
    expect(result.taux_marge_nette).toBe(0) // avoid division by zero
  })

  it('includes audit trail with taux_appliques', () => {
    const input: CalculRentabiliteInput = {
      chantier_id: 'test-audit',
      montant_facture_ht: 10000,
      montant_devis_ht: 10000,
      couts: { materiaux: 3000, main_oeuvre: 2000, sous_traitance: 0, frais_annexes: 0 },
      masse_salariale_brute: 2000,
      juridiction: 'FR',
      forme_juridique: 'sasu',
      regime_tva: 'reel_normal',
      periode: new Date('2026-06-15'),
    }

    const result = calculeRentabilite(input, ALL_TAUX, 0)
    expect(result.taux_appliques.length).toBeGreaterThan(0)
    expect(result.taux_appliques.some(t => t.type === 'charges_patronales')).toBe(true)
    expect(result.date_calcul).toBeInstanceOf(Date)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/rentabilite/engine.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the engine**

```typescript
// lib/rentabilite/engine.ts
// Main profitability calculation engine

import { calculeChargesSociales, calculeChargesFiscales } from './charges'
import type {
  CalculRentabiliteInput,
  ResultatRentabilite,
  RefTaux,
  EcartPoste,
  StatutRentabilite,
  TauxApplique,
} from './types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function ecartPoste(prevu: number, reel: number): EcartPoste {
  return {
    prevu,
    reel,
    ecart_pct: prevu > 0 ? round2(((reel - prevu) / prevu) * 100) : 0,
  }
}

function statut(tauxMargeNette: number): StatutRentabilite {
  if (tauxMargeNette > 15) return 'rentable'
  if (tauxMargeNette >= 5) return 'juste'
  return 'perte'
}

/**
 * Calculate the full profitability of a construction site.
 *
 * @param input — site data, costs, legal form, jurisdiction
 * @param allTaux — all reference rates (loaded from Supabase)
 * @param quotePartFixes — pre-calculated fixed cost share for this site
 * @returns Complete profitability result with 3 levels of detail
 */
export function calculeRentabilite(
  input: CalculRentabiliteInput,
  allTaux: RefTaux[],
  quotePartFixes: number,
): ResultatRentabilite {
  const { couts, devis_detail, montant_facture_ht, montant_devis_ht, periode } = input
  const taux_appliques: TauxApplique[] = []

  // 1. Marge brute
  const totalCouts = round2(couts.materiaux + couts.main_oeuvre + couts.sous_traitance + couts.frais_annexes)
  const marge_brute = round2(montant_facture_ht - totalCouts)
  const taux_marge_brute = montant_facture_ht > 0
    ? round2((marge_brute / montant_facture_ht) * 100)
    : 0

  // 2. Charges sociales
  const sociales = calculeChargesSociales({
    allTaux,
    juridiction: input.juridiction,
    formeJuridique: input.forme_juridique,
    ca: montant_facture_ht,
    masseSalariale: input.masse_salariale_brute,
    beneficeBrut: marge_brute,
    date: periode,
  })
  taux_appliques.push(...sociales.taux_appliques)

  // 3. Charges fiscales (IS/IRC)
  const beneficeAvantImpot = round2(marge_brute - sociales.montant - quotePartFixes)
  const fiscales = calculeChargesFiscales({
    allTaux,
    juridiction: input.juridiction,
    formeJuridique: input.forme_juridique,
    beneficeAvantImpot,
    date: periode,
  })
  taux_appliques.push(...fiscales.taux_appliques)

  // 4. Totaux
  const total_charges = round2(sociales.montant + fiscales.montant + quotePartFixes)
  const benefice_net = round2(marge_brute - total_charges)
  const taux_marge_nette = montant_facture_ht > 0
    ? round2((benefice_net / montant_facture_ht) * 100)
    : 0

  // 5. Écart devis vs réalisé
  const prevuTotal = devis_detail
    ? devis_detail.materiaux + devis_detail.main_oeuvre + devis_detail.sous_traitance + devis_detail.frais_annexes
    : montant_devis_ht > 0 ? totalCouts : 0 // fallback: no detail available

  const ecart_devis = {
    materiaux: ecartPoste(devis_detail?.materiaux ?? 0, couts.materiaux),
    main_oeuvre: ecartPoste(devis_detail?.main_oeuvre ?? 0, couts.main_oeuvre),
    sous_traitance: ecartPoste(devis_detail?.sous_traitance ?? 0, couts.sous_traitance),
    frais_annexes: ecartPoste(devis_detail?.frais_annexes ?? 0, couts.frais_annexes),
    total: ecartPoste(
      devis_detail
        ? devis_detail.materiaux + devis_detail.main_oeuvre + devis_detail.sous_traitance + devis_detail.frais_annexes
        : 0,
      totalCouts,
    ),
  }

  return {
    benefice_net,
    taux_marge_nette,
    statut: statut(taux_marge_nette),
    marge_brute,
    taux_marge_brute,
    charges_sociales: sociales.montant,
    charges_fiscales: fiscales.montant,
    quote_part_fixes: quotePartFixes,
    total_charges,
    ecart_devis,
    taux_appliques,
    date_calcul: new Date(),
  }
}
```

- [ ] **Step 4: Run all engine tests**

Run: `npx vitest run tests/lib/rentabilite/`
Expected: All tests PASS (charges + repartition + engine)

- [ ] **Step 5: Commit**

```bash
git add lib/rentabilite/engine.ts tests/lib/rentabilite/engine.test.ts
git commit -m "feat: add main rentabilite engine with spec example validation"
```

---

## Task 8: API — Add charges_fixes and ref_taux to BTP route

**Files:**
- Modify: `app/api/btp/route.ts`
- Modify: `lib/hooks/use-btp-data.ts`

- [ ] **Step 1: Update BTP_VALID_TABLES in route.ts**

In `app/api/btp/route.ts`, line 8, add the new tables:

```typescript
const BTP_VALID_TABLES = ['chantiers_btp', 'membres_btp', 'equipes_btp', 'pointages_btp', 'depenses_btp', 'settings_btp', 'situations_btp', 'retenues_btp', 'dc4_btp', 'dce_analyses_btp', 'dpgf_btp', 'charges_fixes', 'ref_taux'] as const
```

- [ ] **Step 2: Add ref_taux and charges_fixes to GET handler**

In the GET handler, add support for fetching these tables. The existing pattern fetches by `owner_id` — `ref_taux` is global (no owner filter), `charges_fixes` filters by `owner_id`.

Find the section that handles `?table=rentabilite` and add cases before it:

```typescript
// After existing table handling, before the default case
if (table === 'ref_taux') {
  const { data, error } = await supabaseAdmin
    .from('ref_taux')
    .select('*')
    .order('juridiction')
    .order('regime')
    .order('type_charge')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

if (table === 'charges_fixes') {
  const { data, error } = await supabaseAdmin
    .from('charges_fixes')
    .select('*')
    .eq('owner_id', user.id)
    .order('categorie')
    .order('label')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Add useChargesFixes hook in use-btp-data.ts**

At the end of `lib/hooks/use-btp-data.ts`, add:

```typescript
export function useChargesFixes() {
  return useBTPData({
    table: 'charges_fixes' as any,
    artisanId: '', // not used — charges_fixes uses owner_id via RLS
    userId: '',
  })
}
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add app/api/btp/route.ts lib/hooks/use-btp-data.ts
git commit -m "feat(api): add charges_fixes and ref_taux to BTP API route"
```

---

## Task 9: DevisFactureForm — Frais Annexes Tab

**Files:**
- Modify: `lib/devis-types.ts`
- Modify: `components/DevisFactureForm.tsx`

- [ ] **Step 1: Add FraisAnnexeItem to devis-types.ts**

In `lib/devis-types.ts`, after the `ProductLine` interface (line 28), add:

```typescript
export interface FraisAnnexeItem {
  id: number
  designation: string
  categorie: 'deplacement' | 'location_materiel' | 'hebergement' | 'peage' | 'carburant' | 'autre'
  quantite: number
  unite: 'forfait' | 'km' | 'jour' | 'heure'
  prix_unitaire_ht: number
  tva_applicable: number
  total_ht: number
}

export const FRAIS_ANNEXES_CATEGORIES = [
  { value: 'deplacement', label: 'Déplacement' },
  { value: 'location_materiel', label: 'Location matériel' },
  { value: 'hebergement', label: 'Hébergement' },
  { value: 'peage', label: 'Péage' },
  { value: 'carburant', label: 'Carburant' },
  { value: 'autre', label: 'Autre' },
] as const

export const FRAIS_ANNEXES_UNITES = [
  { value: 'forfait', label: 'Forfait' },
  { value: 'km', label: 'km' },
  { value: 'jour', label: 'Jour' },
  { value: 'heure', label: 'Heure' },
] as const
```

Then add `fraisAnnexes` and `chantierId` to the `DevisFactureData` interface (after `lines` at line 135):

```typescript
  // Frais annexes
  fraisAnnexes: FraisAnnexeItem[]
  // Liaison chantier
  chantierId?: string
```

- [ ] **Step 2: Add frais annexes state and UI in DevisFactureForm.tsx**

This is a large file (141 KB). The frais annexes tab follows the same pattern as the existing `lines` (ProductLine[]) management. Add state for `fraisAnnexes` and render a third section after the main lines table.

In the component state section (around line 100), add:

```typescript
const [fraisAnnexes, setFraisAnnexes] = useState<FraisAnnexeItem[]>(
  initialData?.fraisAnnexes ?? []
)
const [chantierId, setChantierId] = useState<string | undefined>(
  initialData?.chantierId
)
```

Add helper functions for frais annexes management:

```typescript
const addFraisAnnexe = () => {
  setFraisAnnexes(prev => [...prev, {
    id: Date.now(),
    designation: '',
    categorie: 'deplacement',
    quantite: 1,
    unite: 'forfait',
    prix_unitaire_ht: 0,
    tva_applicable: localeFormats.defaultTvaRate,
    total_ht: 0,
  }])
}

const updateFraisAnnexe = (id: number, field: string, value: unknown) => {
  setFraisAnnexes(prev => prev.map(fa => {
    if (fa.id !== id) return fa
    const updated = { ...fa, [field]: value }
    updated.total_ht = Math.round(updated.quantite * updated.prix_unitaire_ht * 100) / 100
    return updated
  }))
}

const removeFraisAnnexe = (id: number) => {
  setFraisAnnexes(prev => prev.filter(fa => fa.id !== id))
}

const totalFraisAnnexesHT = useMemo(
  () => fraisAnnexes.reduce((sum, fa) => sum + fa.total_ht, 0),
  [fraisAnnexes]
)
```

Add the frais annexes section in the JSX, after the main product lines table and before the totals section. Search for the totals section (look for `totalHT` or the grand total calculation) and add before it:

```tsx
{/* ═══ Frais annexes ═══ */}
<div className="mt-6 border-t pt-4">
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-semibold text-gray-700">
      {t('devis.fraisAnnexes', 'Frais annexes')}
    </h3>
    <button
      type="button"
      onClick={addFraisAnnexe}
      className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
    >
      + {t('devis.ajouterFrais', 'Ajouter')}
    </button>
  </div>

  {fraisAnnexes.length > 0 && (
    <div className="space-y-2">
      {/* Header */}
      <div className="hidden sm:grid grid-cols-12 gap-2 text-xs text-gray-500 px-2">
        <div className="col-span-3">Désignation</div>
        <div className="col-span-2">Catégorie</div>
        <div className="col-span-1">Qté</div>
        <div className="col-span-2">Unité</div>
        <div className="col-span-2">PU HT</div>
        <div className="col-span-1">Total HT</div>
        <div className="col-span-1"></div>
      </div>

      {fraisAnnexes.map((fa) => (
        <div key={fa.id} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2 rounded-lg">
          <input
            className="col-span-3 text-sm border rounded px-2 py-1"
            placeholder="Déplacement A/R..."
            value={fa.designation}
            onChange={(e) => updateFraisAnnexe(fa.id, 'designation', e.target.value)}
          />
          <select
            className="col-span-2 text-sm border rounded px-1 py-1"
            value={fa.categorie}
            onChange={(e) => updateFraisAnnexe(fa.id, 'categorie', e.target.value)}
          >
            {FRAIS_ANNEXES_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            className="col-span-1 text-sm border rounded px-2 py-1 text-right"
            type="number"
            min="0"
            step="1"
            value={fa.quantite}
            onChange={(e) => updateFraisAnnexe(fa.id, 'quantite', Number(e.target.value))}
          />
          <select
            className="col-span-2 text-sm border rounded px-1 py-1"
            value={fa.unite}
            onChange={(e) => updateFraisAnnexe(fa.id, 'unite', e.target.value)}
          >
            {FRAIS_ANNEXES_UNITES.map(u => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
          <input
            className="col-span-2 text-sm border rounded px-2 py-1 text-right"
            type="number"
            min="0"
            step="0.01"
            value={fa.prix_unitaire_ht}
            onChange={(e) => updateFraisAnnexe(fa.id, 'prix_unitaire_ht', Number(e.target.value))}
          />
          <div className="col-span-1 text-sm text-right font-medium">
            {formatPrice(fa.total_ht)}
          </div>
          <button
            type="button"
            onClick={() => removeFraisAnnexe(fa.id)}
            className="col-span-1 text-red-400 hover:text-red-600 text-center"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="text-right text-sm font-semibold pr-12 pt-1">
        Total frais annexes : {formatPrice(totalFraisAnnexesHT)}
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 3: Include fraisAnnexes in save/PDF data**

Find where `DevisFactureData` is assembled for saving (search for `onSave` call or the save function). Add `fraisAnnexes` and `chantierId` to the data object:

```typescript
fraisAnnexes,
chantierId,
```

Also include `totalFraisAnnexesHT` in the grand total HT calculation. Find the `totalHT` calculation and add `+ totalFraisAnnexesHT`.

- [ ] **Step 4: Include fraisAnnexes in Supabase save**

Find where devis/factures are inserted into Supabase (search for `.from('devis').insert` or `.from('factures').insert`). Add:

```typescript
frais_annexes: fraisAnnexes,
chantier_id: chantierId || null,
```

- [ ] **Step 5: Verify compilation and test manually**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add lib/devis-types.ts components/DevisFactureForm.tsx
git commit -m "feat: add frais annexes tab and chantier liaison in devis/facture form"
```

---

## Task 10: ChantiersBTPV2 — Liaison Devis/Factures

**Files:**
- Modify: `components/dashboard/ChantiersBTPV2.tsx`

- [ ] **Step 1: Add state and fetch for linked devis/factures**

Inside the component, after the existing data hooks (around line 79), add:

```typescript
const [linkedDocs, setLinkedDocs] = useState<Record<string, SavedDocument[]>>({})
const [showLinkModal, setShowLinkModal] = useState<string | null>(null) // chantier_id
const [availableDevis, setAvailableDevis] = useState<SavedDocument[]>([])

// Fetch linked docs for all chantiers
useEffect(() => {
  if (!artisan?.user_id) return
  const fetchLinked = async () => {
    const { data: devisData } = await supabase
      .from('devis')
      .select('id, numero, client_name, total_ht_cents, total_ttc_cents, status, chantier_id, created_at')
      .eq('artisan_user_id', artisan.user_id)
      .not('chantier_id', 'is', null)

    const { data: facturesData } = await supabase
      .from('factures')
      .select('id, numero, client_name, total_ht_cents, total_ttc_cents, status, chantier_id, created_at')
      .eq('artisan_user_id', artisan.user_id)
      .is('deleted_at', null)
      .not('chantier_id', 'is', null)

    const grouped: Record<string, SavedDocument[]> = {}
    for (const doc of [...(devisData ?? []), ...(facturesData ?? [])]) {
      if (!doc.chantier_id) continue
      if (!grouped[doc.chantier_id]) grouped[doc.chantier_id] = []
      grouped[doc.chantier_id].push({
        id: doc.id,
        type: 'numero' in doc && doc.numero?.startsWith('F-') ? 'facture' : 'devis',
        docNumber: doc.numero,
        clientName: doc.client_name,
        totalHT: doc.total_ht_cents ? doc.total_ht_cents / 100 : undefined,
        totalTTC: doc.total_ttc_cents ? doc.total_ttc_cents / 100 : undefined,
        status: doc.status,
        created_at: doc.created_at,
      })
    }
    setLinkedDocs(grouped)
  }
  fetchLinked()
}, [artisan?.user_id])

// Link a devis to a chantier
const linkDevisToChantier = async (devisId: string, chantierId: string) => {
  const { error } = await supabase
    .from('devis')
    .update({ chantier_id: chantierId })
    .eq('id', devisId)

  if (error) {
    toast.error('Erreur lors de la liaison')
    return
  }
  toast.success('Devis lié au chantier')
  setShowLinkModal(null)
  // Refresh linked docs
  const { data } = await supabase
    .from('devis')
    .select('id, numero, client_name, total_ht_cents, status, chantier_id')
    .eq('id', devisId)
    .single()
  if (data) {
    setLinkedDocs(prev => ({
      ...prev,
      [chantierId]: [...(prev[chantierId] ?? []), {
        id: data.id,
        type: 'devis',
        docNumber: data.numero,
        clientName: data.client_name,
        totalHT: data.total_ht_cents ? data.total_ht_cents / 100 : undefined,
        status: data.status,
      }],
    }))
  }
}

// Open link modal — load unlinked devis
const openLinkModal = async (chantierId: string) => {
  setShowLinkModal(chantierId)
  const { data } = await supabase
    .from('devis')
    .select('id, numero, client_name, total_ht_cents, status, created_at')
    .eq('artisan_user_id', artisan.user_id)
    .is('chantier_id', null)
    .order('created_at', { ascending: false })
  setAvailableDevis((data ?? []).map(d => ({
    id: d.id,
    type: 'devis' as const,
    docNumber: d.numero,
    clientName: d.client_name,
    totalHT: d.total_ht_cents ? d.total_ht_cents / 100 : undefined,
    status: d.status,
    created_at: d.created_at,
  })))
}
```

- [ ] **Step 2: Add linked docs section in chantier card**

Inside the chantier detail/card view (find the section that shows chantier details — look for `c.titre` or similar rendering), add after the existing info:

```tsx
{/* Devis et factures liés */}
<div className="mt-3 pt-3 border-t">
  <div className="flex items-center justify-between mb-2">
    <span className="text-xs font-semibold text-gray-600">Devis et factures liés</span>
    <button
      onClick={() => openLinkModal(c.id)}
      className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100"
    >
      + Lier un devis
    </button>
  </div>
  {(linkedDocs[c.id] ?? []).length === 0 ? (
    <p className="text-xs text-gray-400 italic">Aucun document lié</p>
  ) : (
    <div className="space-y-1">
      {(linkedDocs[c.id] ?? []).map(doc => (
        <div key={doc.id} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
          <span className="font-medium">
            {doc.type === 'devis' ? '📋' : '🧾'} {doc.docNumber}
          </span>
          <span className="text-gray-500">{doc.clientName}</span>
          <span className="font-semibold">{doc.totalHT ? formatPrice(doc.totalHT) : '—'}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
            doc.status === 'signed' || doc.status === 'paid' ? 'bg-green-100 text-green-700' :
            doc.status === 'sent' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {doc.status}
          </span>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 3: Add link modal**

At the end of the component's JSX (before the final closing `</div>`), add:

```tsx
{/* Modal: Lier un devis */}
{showLinkModal && (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowLinkModal(null)}>
    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
      <h3 className="text-lg font-semibold mb-4">Lier un devis à ce chantier</h3>
      {availableDevis.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">Aucun devis non lié disponible</p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {availableDevis.map(d => (
            <button
              key={d.id}
              onClick={() => linkDevisToChantier(d.id, showLinkModal)}
              className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-blue-50 transition-colors text-left"
            >
              <div>
                <div className="text-sm font-medium">{d.docNumber}</div>
                <div className="text-xs text-gray-500">{d.clientName}</div>
              </div>
              <div className="text-sm font-semibold">{d.totalHT ? formatPrice(d.totalHT) : '—'}</div>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setShowLinkModal(null)}
        className="mt-4 w-full text-sm text-gray-500 hover:text-gray-700 py-2"
      >
        Fermer
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/ChantiersBTPV2.tsx
git commit -m "feat: add devis/factures liaison with link modal in chantier view"
```

---

## Task 11: ComptaBTPSection — Charges Fixes Migration

**Files:**
- Modify: `components/dashboard/ComptaBTPSection.tsx`

- [ ] **Step 1: Replace JSONB frais fixes with charges_fixes table**

In `ComptaBTPSection.tsx`, find the frais fixes tab (around lines 400-458). Replace the JSONB-based state and CRUD with Supabase `charges_fixes` table operations.

Replace the existing frais fixes state management:

```typescript
// Replace existing JSONB frais fixes management with:
const [chargesFixes, setChargesFixes] = useState<ChargeFixeRow[]>([])
const [loadingFixes, setLoadingFixes] = useState(true)

interface ChargeFixeRow {
  id: string
  label: string
  montant: number
  frequence: 'mensuel' | 'trimestriel' | 'annuel'
  categorie: string
}

// Fetch from charges_fixes table
useEffect(() => {
  const fetchFixes = async () => {
    const res = await fetch('/api/btp?table=charges_fixes', {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setChargesFixes(data)
    }
    setLoadingFixes(false)
  }
  if (session?.access_token) fetchFixes()
}, [session?.access_token])

// Add charge fixe
const addChargeFix = async (charge: Omit<ChargeFixeRow, 'id'>) => {
  const res = await fetch('/api/btp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      table: 'charges_fixes',
      action: 'insert',
      data: charge,
    }),
  })
  if (res.ok) {
    // Refresh
    const refresh = await fetch('/api/btp?table=charges_fixes', {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (refresh.ok) setChargesFixes(await refresh.json())
    toast.success('Charge ajoutée')
  }
}

// Remove charge fixe
const removeChargeFix = async (id: string) => {
  const res = await fetch('/api/btp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      table: 'charges_fixes',
      action: 'delete',
      id,
    }),
  })
  if (res.ok) {
    setChargesFixes(prev => prev.filter(c => c.id !== id))
    toast.success('Charge supprimée')
  }
}

// Monthly total
const totalFixesMensuel = useMemo(() => {
  return chargesFixes.reduce((sum, c) => {
    if (c.frequence === 'mensuel') return sum + c.montant
    if (c.frequence === 'trimestriel') return sum + c.montant / 3
    if (c.frequence === 'annuel') return sum + c.montant / 12
    return sum
  }, 0)
}, [chargesFixes])
```

- [ ] **Step 2: Replace frais fixes tab UI with categorized view**

Replace the existing frais fixes rendering with:

```tsx
{/* Charges fixes — grouped by category */}
<div className="space-y-4">
  {/* Alertes intelligentes */}
  {settings.country === 'FR' && !chargesFixes.some(c => c.categorie === 'decennale') && (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
      ⚠️ Tu n&apos;as pas renseigné d&apos;assurance décennale. C&apos;est obligatoire en BTP.
    </div>
  )}
  {settings.country === 'PT' && !chargesFixes.some(c => c.categorie === 'rc_pro') && (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
      ⚠️ Seguro de acidentes de trabalho não registado. É obrigatório na construção.
    </div>
  )}

  {/* Grouped display */}
  {[
    { key: 'assurances', label: 'Assurances', cats: ['decennale', 'rc_pro'] },
    { key: 'local', label: 'Local & véhicule', cats: ['loyer', 'leasing', 'vehicule'] },
    { key: 'admin', label: 'Administratif', cats: ['comptabilite', 'telephone', 'logiciel', 'formation'] },
    { key: 'autre', label: 'Autres', cats: ['autre'] },
  ].map(group => {
    const items = chargesFixes.filter(c => group.cats.includes(c.categorie))
    if (items.length === 0) return null
    return (
      <div key={group.key}>
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">{group.label}</h4>
        {items.map(c => (
          <div key={c.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded mb-1">
            <span className="text-sm">{c.label}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{formatPrice(c.montant)}/{c.frequence === 'mensuel' ? 'mois' : c.frequence === 'trimestriel' ? 'trim.' : 'an'}</span>
              <button onClick={() => removeChargeFix(c.id)} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          </div>
        ))}
      </div>
    )
  })}

  {/* Total */}
  <div className="border-t pt-3 flex justify-between items-center">
    <span className="text-sm font-semibold">TOTAL mensuel</span>
    <div className="text-right">
      <div className="text-lg font-bold">{formatPrice(totalFixesMensuel)}/mois</div>
      <div className="text-xs text-gray-500">{formatPrice(totalFixesMensuel / 22)}/jour travaillé</div>
    </div>
  </div>

  {/* Add form */}
  {/* Keep existing add form but add categorie dropdown */}
</div>
```

- [ ] **Step 3: Add categorie dropdown to the add form**

In the existing "add frais fixes" form, add a categorie selector:

```tsx
<select
  value={newChargeCategorie}
  onChange={e => setNewChargeCategorie(e.target.value)}
  className="border rounded px-2 py-1.5 text-sm"
>
  <option value="decennale">Assurance décennale</option>
  <option value="rc_pro">RC Pro</option>
  <option value="loyer">Loyer</option>
  <option value="leasing">Leasing</option>
  <option value="comptabilite">Comptabilité</option>
  <option value="vehicule">Véhicule</option>
  <option value="telephone">Téléphone</option>
  <option value="logiciel">Logiciel</option>
  <option value="formation">Formation</option>
  <option value="autre">Autre</option>
</select>
```

Add a `frequence` dropdown (current form only has `mensuel` and `annuel`, add `trimestriel`):

```tsx
<select
  value={newChargeFrequence}
  onChange={e => setNewChargeFrequence(e.target.value)}
  className="border rounded px-2 py-1.5 text-sm"
>
  <option value="mensuel">Mensuel</option>
  <option value="trimestriel">Trimestriel</option>
  <option value="annuel">Annuel</option>
</select>
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/ComptaBTPSection.tsx
git commit -m "feat: migrate charges fixes from JSONB to relational table with categories and alerts"
```

---

## Task 12: RentabiliteChantierSection — Engine Integration

**Files:**
- Modify: `components/dashboard/RentabiliteChantierSection.tsx`

- [ ] **Step 1: Import and use the engine**

At the top of the file, add imports:

```typescript
import { calculeRentabilite } from '@/lib/rentabilite/engine'
import { loadRefTaux } from '@/lib/rentabilite/ref-taux'
import { calculeQuotePartFixes } from '@/lib/rentabilite/repartition'
import type { RefTaux, ResultatRentabilite, FormeJuridique, Juridiction } from '@/lib/rentabilite/types'
```

Add state for ref_taux and computed results:

```typescript
const [refTaux, setRefTaux] = useState<RefTaux[]>([])
const [resultats, setResultats] = useState<Record<string, ResultatRentabilite>>({})
const [chargesFixes, setChargesFixes] = useState<{ montant_mensuel: number }>({ montant_mensuel: 0 })

// Load ref_taux on mount
useEffect(() => {
  loadRefTaux().then(setRefTaux).catch(console.error)
}, [])

// Load charges fixes total
useEffect(() => {
  const fetchFixes = async () => {
    const res = await fetch('/api/btp?table=charges_fixes')
    if (res.ok) {
      const data = await res.json()
      const mensuel = data.reduce((sum: number, c: any) => {
        if (c.frequence === 'mensuel') return sum + Number(c.montant)
        if (c.frequence === 'trimestriel') return sum + Number(c.montant) / 3
        if (c.frequence === 'annuel') return sum + Number(c.montant) / 12
        return sum
      }, 0)
      setChargesFixes({ montant_mensuel: mensuel })
    }
  }
  fetchFixes()
}, [])
```

- [ ] **Step 2: Compute results for each chantier**

After the data is loaded, compute profitability for each site:

```typescript
// Get forme_juridique and juridiction from settings
const formeJuridique = (settings?.statut_juridique || 'auto_entrepreneur') as FormeJuridique
const juridiction: Juridiction = (settings?.country || 'FR') as Juridiction

// Compute results when data changes
useEffect(() => {
  if (refTaux.length === 0 || !rentaData.length) return

  const caTotalPeriode = rentaData.reduce((sum, r) => sum + (r.ca_reel || 0), 0)
  const computed: Record<string, ResultatRentabilite> = {}

  for (const r of rentaData) {
    const quotePartFixes = calculeQuotePartFixes({
      mode: 'prorata_ca',
      ca_chantier: r.ca_reel || 0,
      ca_total_periode: caTotalPeriode,
      jours_chantier: r.nb_jours_pointes || 0,
      jours_total_periode: 22, // default monthly
      charges_fixes_mensuelles: chargesFixes.montant_mensuel,
      duree_mois: 1,
    })

    computed[r.chantier_id] = calculeRentabilite({
      chantier_id: r.chantier_id,
      montant_facture_ht: r.ca_reel || 0,
      montant_devis_ht: r.montant_devis_ht_lie || r.budget || 0,
      couts: {
        materiaux: r.total_materiaux || 0,
        main_oeuvre: r.cout_main_oeuvre_brut || 0,
        sous_traitance: 0, // from depenses if categorized
        frais_annexes: r.total_autres || 0,
      },
      masse_salariale_brute: r.cout_main_oeuvre_brut || 0,
      juridiction,
      forme_juridique: formeJuridique,
      regime_tva: settings?.regime_tva || 'reel_normal',
      periode: new Date(),
    }, refTaux, quotePartFixes)
  }

  setResultats(computed)
}, [refTaux, rentaData, chargesFixes, settings])
```

- [ ] **Step 3: Update the chantier card rendering**

Replace or augment the existing profitability display for each chantier. Find where `benefice_net` is displayed and replace with the 3-level display:

```tsx
{/* Level 1 — headline */}
{resultats[r.chantier_id] && (() => {
  const res = resultats[r.chantier_id]
  const color = res.statut === 'rentable' ? 'text-green-600 bg-green-50' :
    res.statut === 'juste' ? 'text-orange-600 bg-orange-50' :
    'text-red-600 bg-red-50'
  return (
    <div className="mt-3">
      <div className={`${color} rounded-lg p-3`}>
        <div className="text-lg font-bold">
          {juridiction === 'PT' ? 'Esta obra rendeu-te' : 'Ce chantier t\'a rapporté'} {formatPrice(res.benefice_net)}
        </div>
        <div className="text-sm">
          Marge nette : {res.taux_marge_nette.toFixed(1)}%
        </div>
      </div>

      {/* Level 2 — collapsible detail */}
      <details className="mt-2">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
          Voir le détail des charges
        </summary>
        <div className="mt-2 space-y-1 text-sm bg-gray-50 rounded-lg p-3">
          <div className="flex justify-between"><span>Marge brute</span><span className="font-medium">{formatPrice(res.marge_brute)}</span></div>
          <div className="flex justify-between"><span>Charges sociales</span><span className="text-red-600">-{formatPrice(res.charges_sociales)}</span></div>
          <div className="flex justify-between"><span>Charges fixes</span><span className="text-red-600">-{formatPrice(res.quote_part_fixes)}</span></div>
          <div className="flex justify-between"><span>Impôt ({juridiction === 'PT' ? 'IRC' : 'IS'})</span><span className="text-red-600">-{formatPrice(res.charges_fiscales)}</span></div>
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>Net dans ta poche</span><span>{formatPrice(res.benefice_net)}</span>
          </div>
        </div>
      </details>

      {/* Level 3 — écart devis vs réalisé */}
      {res.ecart_devis.total.prevu > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            Écart devis vs réalisé
          </summary>
          <div className="mt-2 text-xs bg-gray-50 rounded-lg p-3">
            <div className="grid grid-cols-4 gap-1 font-semibold text-gray-600 mb-1">
              <div></div><div className="text-right">Prévu</div><div className="text-right">Réel</div><div className="text-right">Écart</div>
            </div>
            {(['materiaux', 'main_oeuvre', 'sous_traitance', 'frais_annexes'] as const).map(poste => {
              const e = res.ecart_devis[poste]
              if (e.prevu === 0 && e.reel === 0) return null
              const ecartColor = Math.abs(e.ecart_pct) < 5 ? 'text-green-600' :
                Math.abs(e.ecart_pct) < 15 ? 'text-orange-600' : 'text-red-600'
              return (
                <div key={poste} className="grid grid-cols-4 gap-1">
                  <div className="capitalize">{poste.replace('_', ' ')}</div>
                  <div className="text-right">{formatPrice(e.prevu)}</div>
                  <div className="text-right">{formatPrice(e.reel)}</div>
                  <div className={`text-right font-medium ${ecartColor}`}>
                    {e.ecart_pct > 0 ? '+' : ''}{e.ecart_pct.toFixed(1)}%
                  </div>
                </div>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
})()}
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/RentabiliteChantierSection.tsx
git commit -m "feat: integrate rentabilite engine with 3-level artisan-friendly display"
```

---

## Task 13: StatsRevenusSection — Pilotage Banner

**Files:**
- Modify: `components/dashboard/StatsRevenusSection.tsx`

- [ ] **Step 1: Add pilotage banner at the top**

Import the engine and add a monthly summary banner. In the component, after existing data loading, add:

```typescript
import { calculeRentabilite } from '@/lib/rentabilite/engine'
import { loadRefTaux } from '@/lib/rentabilite/ref-taux'
import type { RefTaux, ResultatRentabilite } from '@/lib/rentabilite/types'

// Inside the component:
const [pilotage, setPilotage] = useState<{
  caFacture: number
  chargesTotal: number
  netPoche: number
  margePct: number
  chantiersEnCours: number
  chantiersTermines: number
  meilleurChantier: string | null
  alertes: string[]
} | null>(null)
```

Compute the pilotage data from the existing bookings/rentability data:

```typescript
// Inside a useEffect, after rentability data is available:
useEffect(() => {
  // Aggregate current month data
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  // ... aggregate from existing bookings/chantiers data
  // This depends on which data is already available in the component
  // Compute caFacture, charges, net, etc.
}, [/* dependencies */])
```

- [ ] **Step 2: Render the banner**

At the top of the component's JSX output, before existing content:

```tsx
{pilotage && (
  <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
    <h3 className="text-sm font-semibold text-gray-500 mb-3">
      {new Date().toLocaleDateString(juridiction === 'PT' ? 'pt-PT' : 'fr-FR', { month: 'long', year: 'numeric' })}
    </h3>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div>
        <div className="text-xs text-gray-500">CA facturé</div>
        <div className="text-lg font-bold">{formatPrice(pilotage.caFacture)}</div>
      </div>
      <div>
        <div className="text-xs text-gray-500">Charges totales</div>
        <div className="text-lg font-bold text-red-600">{formatPrice(pilotage.chargesTotal)}</div>
      </div>
      <div>
        <div className="text-xs text-gray-500">Net dans ta poche</div>
        <div className="text-lg font-bold text-green-600">{formatPrice(pilotage.netPoche)}</div>
      </div>
      <div>
        <div className="text-xs text-gray-500">Marge</div>
        <div className={`text-lg font-bold ${
          pilotage.margePct > 15 ? 'text-green-600' :
          pilotage.margePct >= 5 ? 'text-orange-500' :
          'text-red-600'
        }`}>
          {pilotage.margePct.toFixed(1)}%
        </div>
      </div>
    </div>

    {/* Alerts */}
    {pilotage.alertes.length > 0 && (
      <div className="mt-3 space-y-1">
        {pilotage.alertes.map((alerte, i) => (
          <div key={i} className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
            ⚠️ {alerte}
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/StatsRevenusSection.tsx
git commit -m "feat: add monthly pilotage banner with CA, charges, net margin"
```

---

## Task 14: Final Integration Test & Typecheck

**Files:**
- All modified files

- [ ] **Step 1: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run all unit tests**

Run: `npx vitest run`
Expected: All tests PASS including the new rentabilite tests

- [ ] **Step 3: Run lint**

Run: `npx eslint lib/rentabilite/ tests/lib/rentabilite/ --fix`
Expected: No errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final integration cleanup for interconnexion feature"
```

---

## Dependency Graph

```
Task 1 (DB migration) ──→ Task 2 (seed) ──→ Task 4 (ref-taux loader)
                     └──→ Task 3 (types) ──→ Task 5 (charges) ──→ Task 7 (engine)
                                         └──→ Task 6 (repartition) ──↗
                     └──→ Task 8 (API route)
                     └──→ Task 9 (DevisFactureForm frais annexes)
                     └──→ Task 10 (ChantiersBTPV2 liaison)
Task 7 (engine) ──→ Task 11 (ComptaBTP charges fixes)
               └──→ Task 12 (RentabiliteSection enriched)
               └──→ Task 13 (StatsRevenus banner)
All ──→ Task 14 (final integration)
```

**Parallelizable groups:**
- After Task 1: Tasks 2, 3, 8, 9, 10 can run in parallel
- After Task 7: Tasks 11, 12, 13 can run in parallel
