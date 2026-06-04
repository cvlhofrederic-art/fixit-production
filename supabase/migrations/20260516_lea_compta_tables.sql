-- ══════════════════════════════════════════════════════════════════════════════
-- Migration — Tables comptables copropriété pour Léa (Plan E.3)
-- Date: 2026-05-16
-- ══════════════════════════════════════════════════════════════════════════════
-- 4 tables pour permettre à Léa de gérer la comptabilité réelle :
--   - syndic_appels_charges : appels trimestriels par immeuble/copro
--   - syndic_impayes : créances impayées (lien copro + ancienneté)
--   - syndic_factures_copro : factures émises au copro (fournisseur, échéances)
--   - syndic_recouvrement : procédures de recouvrement amiable/judiciaire
--
-- RLS strict via cabinet_id (cohérent avec les autres syndic_*).
-- Naming `syndic_factures_copro` pour éviter conflit avec `factures` (artisan).

-- 1. Appels de charges (trimestriels)
CREATE TABLE IF NOT EXISTS syndic_appels_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  immeuble_id uuid REFERENCES syndic_immeubles(id) ON DELETE SET NULL,
  coproprio_id uuid REFERENCES syndic_coproprios(id) ON DELETE SET NULL,
  exercice text NOT NULL,                                        -- ex "2026-T2"
  periode_debut date NOT NULL,
  periode_fin date NOT NULL,
  montant_total numeric(12, 2) NOT NULL CHECK (montant_total >= 0),
  montant_paye numeric(12, 2) NOT NULL DEFAULT 0 CHECK (montant_paye >= 0),
  statut text NOT NULL DEFAULT 'a_payer' CHECK (statut IN ('a_payer','partiellement_paye','solde','en_retard','annule')),
  echeance date,
  iban text,
  reference_paiement text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_appels_charges_cabinet ON syndic_appels_charges(cabinet_id, exercice, statut);
CREATE INDEX idx_appels_charges_coproprio ON syndic_appels_charges(coproprio_id, statut) WHERE statut != 'solde';

-- 2. Impayés (créances non recouvrées)
CREATE TABLE IF NOT EXISTS syndic_impayes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  immeuble_id uuid REFERENCES syndic_immeubles(id) ON DELETE SET NULL,
  coproprio_id uuid REFERENCES syndic_coproprios(id) ON DELETE SET NULL,
  appel_charge_id uuid REFERENCES syndic_appels_charges(id) ON DELETE SET NULL,
  montant numeric(12, 2) NOT NULL CHECK (montant > 0),
  nature text NOT NULL CHECK (nature IN ('charges_courantes','travaux','fonds_reserve','interets_retard','frais_relance','autre')),
  depuis date NOT NULL,
  derniere_relance_at timestamptz,
  nb_relances int NOT NULL DEFAULT 0,
  statut text NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert','en_recouvrement','solde','passe_perte')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_impayes_cabinet ON syndic_impayes(cabinet_id, statut, depuis DESC) WHERE statut != 'solde';
CREATE INDEX idx_impayes_coproprio ON syndic_impayes(coproprio_id) WHERE statut = 'ouvert';

-- 3. Factures émises au copropriétaire (distinctes des factures artisan)
CREATE TABLE IF NOT EXISTS syndic_factures_copro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coproprio_id uuid REFERENCES syndic_coproprios(id) ON DELETE SET NULL,
  immeuble_id uuid REFERENCES syndic_immeubles(id) ON DELETE SET NULL,
  numero_facture text NOT NULL,
  emise_le date NOT NULL,
  echeance date,
  montant_ht numeric(12, 2) NOT NULL CHECK (montant_ht >= 0),
  tva_taux numeric(5, 2) NOT NULL DEFAULT 20,
  montant_ttc numeric(12, 2) NOT NULL CHECK (montant_ttc >= 0),
  description text,
  statut text NOT NULL DEFAULT 'a_regler' CHECK (statut IN ('a_regler','partiellement_regle','reglee','contestee','annulee')),
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_factures_copro_cabinet ON syndic_factures_copro(cabinet_id, statut, emise_le DESC);
CREATE UNIQUE INDEX idx_factures_copro_numero ON syndic_factures_copro(cabinet_id, numero_facture);

-- 4. Procédures de recouvrement
CREATE TABLE IF NOT EXISTS syndic_recouvrement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coproprio_id uuid REFERENCES syndic_coproprios(id) ON DELETE SET NULL,
  immeuble_id uuid REFERENCES syndic_immeubles(id) ON DELETE SET NULL,
  impaye_id uuid REFERENCES syndic_impayes(id) ON DELETE SET NULL,
  procedure text NOT NULL CHECK (procedure IN ('amiable','mise_en_demeure','huissier','tribunal','saisie','accord_paiement')),
  statut text NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours','suspendu','cloture_succes','cloture_echec')),
  montant_initial numeric(12, 2) NOT NULL CHECK (montant_initial >= 0),
  montant_recouvre numeric(12, 2) NOT NULL DEFAULT 0 CHECK (montant_recouvre >= 0),
  date_ouverture date NOT NULL,
  date_cloture date,
  avocat_huissier text,
  prochaine_echeance date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recouvrement_cabinet ON syndic_recouvrement(cabinet_id, statut, date_ouverture DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- RLS — Pattern identique aux autres tables syndic_* :
--   accès si cabinet_id = auth.uid() OU si user est dans syndic_team_members
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE syndic_appels_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_impayes ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_factures_copro ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_recouvrement ENABLE ROW LEVEL SECURITY;

CREATE POLICY syndic_appels_charges_all ON syndic_appels_charges
  FOR ALL USING (
    cabinet_id = auth.uid()
    OR cabinet_id IN (SELECT cabinet_id FROM syndic_team_members WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY syndic_impayes_all ON syndic_impayes
  FOR ALL USING (
    cabinet_id = auth.uid()
    OR cabinet_id IN (SELECT cabinet_id FROM syndic_team_members WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY syndic_factures_copro_all ON syndic_factures_copro
  FOR ALL USING (
    cabinet_id = auth.uid()
    OR cabinet_id IN (SELECT cabinet_id FROM syndic_team_members WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY syndic_recouvrement_all ON syndic_recouvrement
  FOR ALL USING (
    cabinet_id = auth.uid()
    OR cabinet_id IN (SELECT cabinet_id FROM syndic_team_members WHERE user_id = auth.uid() AND is_active = true)
  );

-- Trigger pour updated_at sur syndic_appels_charges
CREATE OR REPLACE FUNCTION update_appel_charge_modtime() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_appel_charge_modtime
  BEFORE UPDATE ON syndic_appels_charges
  FOR EACH ROW EXECUTE FUNCTION update_appel_charge_modtime();
