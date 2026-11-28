-- ══════════════════════════════════════════════════════════════════════════════
-- AJ Signalement (04/11/2026) — signalements déposés par QR code, sans compte.
--
-- Deux tables indépendantes du logiciel Syndic (aucune clé vers syndic_*) :
--   signalements_qr_coproprietes : une copropriété = un jeton unique, imprimé dans un QR code
--                                  qui ouvre https://vitfix.io/fr/signalement/<jeton>/ ;
--   signalements_qr              : ce qu'une personne a saisi après avoir scanné le QR code
--                                  (coordonnées obligatoires : prénom, nom, téléphone, e-mail,
--                                  étage, numéro de lot) ; chaque ligne est aussi envoyée par e-mail.
-- Accès : clé service uniquement (routes app/api/aj-signalement/*) ; RLS activée sans politique,
-- donc rien n'est lisible ni modifiable avec la clé anonyme.
--
-- À appliquer en production par Frédéric (Supabase > SQL Editor). Crée la copropriété de test
-- « Parc Belle Ombre » avec un jeton aléatoire : son QR code apparaît ensuite dans le tableau de bord
-- (portail copropriétaire, vue super admin, écran « AJ Signalement »).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Copropriétés dotées d'un QR code ──
CREATE TABLE IF NOT EXISTS signalements_qr_coproprietes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 200),
  adresse TEXT NOT NULL DEFAULT '',
  jeton TEXT NOT NULL UNIQUE CHECK (jeton ~ '^[0-9a-f]{32}$'),
  emails_destinataires TEXT[] NOT NULL DEFAULT '{}',
  actif BOOLEAN NOT NULL DEFAULT true,
  cree_par UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE signalements_qr_coproprietes IS 'AJ Signalement : copropriétés dotées d''un QR code de signalement (sans lien avec les tables syndic_*).';
COMMENT ON COLUMN signalements_qr_coproprietes.jeton IS 'Jeton du QR code (32 caractères hexadécimaux) : la page publique est /fr/signalement/<jeton>/.';
COMMENT ON COLUMN signalements_qr_coproprietes.emails_destinataires IS 'Adresses qui reçoivent chaque signalement ; vide = ADMIN_EMAIL / ADMIN_EMAIL_2 du déploiement.';
COMMENT ON COLUMN signalements_qr_coproprietes.actif IS 'false : le QR code ne reçoit plus rien (page 404), l''historique est conservé.';

-- ── 2. Signalements reçus ──
CREATE TABLE IF NOT EXISTS signalements_qr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copropriete_id UUID NOT NULL REFERENCES signalements_qr_coproprietes(id) ON DELETE CASCADE,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  telephone TEXT NOT NULL,
  email TEXT NOT NULL,
  batiment TEXT NOT NULL DEFAULT '',
  etage TEXT NOT NULL,
  num_lot TEXT NOT NULL,
  est_partie_commune BOOLEAN NOT NULL DEFAULT false,
  zone_signalee TEXT NOT NULL DEFAULT '',
  type_intervention TEXT NOT NULL,
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 5000),
  priorite TEXT NOT NULL DEFAULT 'normale' CHECK (priorite IN ('urgente', 'normale', 'planifiee')),
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'acceptee', 'en_cours', 'terminee', 'annulee')),
  langue TEXT NOT NULL DEFAULT 'fr' CHECK (langue IN ('fr', 'pt')),
  email_envoye_le TIMESTAMPTZ,
  email_erreur TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signalements_qr_copropriete_date
  ON signalements_qr (copropriete_id, created_at DESC);

COMMENT ON TABLE signalements_qr IS 'AJ Signalement : signalements déposés après scan du QR code d''une copropriété, avec les coordonnées du déclarant.';
COMMENT ON COLUMN signalements_qr.email_envoye_le IS 'Horodatage de l''e-mail reçu par les destinataires ; NULL avec email_erreur renseigné quand l''envoi a échoué.';

-- ── 3. Aucune lecture avec la clé anonyme : RLS sans politique (service role uniquement) ──
ALTER TABLE signalements_qr_coproprietes ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalements_qr ENABLE ROW LEVEL SECURITY;

-- ── 4. updated_at (fonction set_updated_at de la migration 056, créée si elle manque) ──
-- CREATE OR REPLACE TRIGGER (PostgreSQL 14+) : rejouable sans DROP, donc sans l'avertissement « destructive »
-- de l'éditeur SQL de Supabase.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE FUNCTION set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $f$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $f$;
  END IF;
END $$;

CREATE OR REPLACE TRIGGER trg_signalements_qr_coproprietes_updated_at
  BEFORE UPDATE ON signalements_qr_coproprietes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_signalements_qr_updated_at
  BEFORE UPDATE ON signalements_qr
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 5. Copropriété de test demandée par Frédéric : « Parc Belle Ombre », jeton aléatoire ──
INSERT INTO signalements_qr_coproprietes (nom, adresse, jeton)
SELECT 'Parc Belle Ombre', '', replace(gen_random_uuid()::text, '-', '')
WHERE NOT EXISTS (SELECT 1 FROM signalements_qr_coproprietes WHERE nom = 'Parc Belle Ombre');
