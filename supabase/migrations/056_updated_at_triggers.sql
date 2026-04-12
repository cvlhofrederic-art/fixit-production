-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 056 — Trigger generique updated_at pour toutes les tables
-- Date: 2026-04-12
-- Audit: DB-14 — 15+ tables avec updated_at mais sans trigger automatique
--
-- IMPORTANT: Entierement idempotent. Safe en prod.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Fonction generique reutilisable ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── Appliquer sur toutes les tables qui ont updated_at mais pas de trigger ──

-- syndic_immeubles
DROP TRIGGER IF EXISTS trg_syndic_immeubles_updated_at ON syndic_immeubles;
CREATE TRIGGER trg_syndic_immeubles_updated_at
  BEFORE UPDATE ON syndic_immeubles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- syndic_signalements
DROP TRIGGER IF EXISTS trg_syndic_signalements_updated_at ON syndic_signalements;
CREATE TRIGGER trg_syndic_signalements_updated_at
  BEFORE UPDATE ON syndic_signalements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- syndic_missions
DROP TRIGGER IF EXISTS trg_syndic_missions_updated_at ON syndic_missions;
CREATE TRIGGER trg_syndic_missions_updated_at
  BEFORE UPDATE ON syndic_missions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- devis
DROP TRIGGER IF EXISTS trg_devis_updated_at ON devis;
CREATE TRIGGER trg_devis_updated_at
  BEFORE UPDATE ON devis
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- factures
DROP TRIGGER IF EXISTS trg_factures_updated_at ON factures;
CREATE TRIGGER trg_factures_updated_at
  BEFORE UPDATE ON factures
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- subscriptions
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- rfqs
DROP TRIGGER IF EXISTS trg_rfqs_updated_at ON rfqs;
CREATE TRIGGER trg_rfqs_updated_at
  BEFORE UPDATE ON rfqs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- situations_btp
DROP TRIGGER IF EXISTS trg_situations_btp_updated_at ON situations_btp;
CREATE TRIGGER trg_situations_btp_updated_at
  BEFORE UPDATE ON situations_btp
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- retenues_btp
DROP TRIGGER IF EXISTS trg_retenues_btp_updated_at ON retenues_btp;
CREATE TRIGGER trg_retenues_btp_updated_at
  BEFORE UPDATE ON retenues_btp
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- dc4_btp
DROP TRIGGER IF EXISTS trg_dc4_btp_updated_at ON dc4_btp;
CREATE TRIGGER trg_dc4_btp_updated_at
  BEFORE UPDATE ON dc4_btp
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- dpgf_btp
DROP TRIGGER IF EXISTS trg_dpgf_btp_updated_at ON dpgf_btp;
CREATE TRIGGER trg_dpgf_btp_updated_at
  BEFORE UPDATE ON dpgf_btp
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- profiles_artisan
DROP TRIGGER IF EXISTS trg_profiles_artisan_updated_at ON profiles_artisan;
CREATE TRIGGER trg_profiles_artisan_updated_at
  BEFORE UPDATE ON profiles_artisan
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- profiles_client
DROP TRIGGER IF EXISTS trg_profiles_client_updated_at ON profiles_client;
CREATE TRIGGER trg_profiles_client_updated_at
  BEFORE UPDATE ON profiles_client
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- syndic_cabinets
DROP TRIGGER IF EXISTS trg_syndic_cabinets_updated_at ON syndic_cabinets;
CREATE TRIGGER trg_syndic_cabinets_updated_at
  BEFORE UPDATE ON syndic_cabinets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- syndic_oauth_tokens (si la table a updated_at)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'syndic_oauth_tokens' AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS trg_syndic_oauth_updated_at ON syndic_oauth_tokens;
    CREATE TRIGGER trg_syndic_oauth_updated_at
      BEFORE UPDATE ON syndic_oauth_tokens
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
