-- ── Identité document stable + brouillons sans numéro (méthode pro 2026) ──
-- Modèle Stripe/QuickBooks : un brouillon n'a PAS de numéro légal tant qu'il
-- n'est pas validé. Le numéro (DEV-/FACT-/AC-/AV-) est tiré de la séquence
-- serveur gapless (next_doc_number) UNIQUEMENT à l'émission.
--
-- L'identité d'une ligne devient son `id` UUID (déjà PK, gen_random_uuid()),
-- stable sur tout le cycle de vie brouillon → émis. Le route /api/devis/sync
-- upsert onConflict='id' quand l'id est fourni (brouillons + docs ayant adopté
-- leur id canonique au hydrate) ; sinon onConflict='numero,artisan_user_id'
-- (compat docs legacy émis dont le client ne connaît pas encore l'id).
--
-- Trois changements, tous metadata-only / additifs. AUCUNE ligne émise n'est
-- modifiée (elles gardent numéro, statut, hash-chain) :
--   1. devis.numero + factures.numero → NULLABLE (brouillon = pas de numéro).
--   2. factures.status : ajout de 'draft' (les devis l'avaient déjà).
--   3. trigger validate_facture_transition : autorise draft → pending|cancelled.
--
-- Contexte légal : la contrainte UNIQUE(numero, artisan_user_id) est CONSERVÉE.
-- En SQL un NULL est DISTINCT dans un index unique → N brouillons (numero=NULL)
-- par artisan coexistent sans conflit, tandis que l'unicité des numéros ÉMIS
-- (continuité art. 242 nonies A I 2° CGI) reste garantie. Inaltérabilité ISCA
-- intacte : seuls les docs émis (devis 'sent' / facture 'pending') sont hashés ;
-- les brouillons ('draft') ne le sont jamais.

-- ── 1) numero NULLABLE ─────────────────────────────────────────────────────
-- DROP NOT NULL est idempotent (no-op si la colonne est déjà nullable).
DO $$
BEGIN
  IF to_regclass('public.devis') IS NOT NULL THEN
    ALTER TABLE devis ALTER COLUMN numero DROP NOT NULL;
  END IF;
  IF to_regclass('public.factures') IS NOT NULL THEN
    ALTER TABLE factures ALTER COLUMN numero DROP NOT NULL;
  END IF;
END $$;

-- ── 2) factures.status : ajouter 'draft' ───────────────────────────────────
-- Contrainte auto-nommée `factures_status_check` (migration 038, vérifiée en
-- prod). DROP + ADD = remplacement atomique du CHECK. 'draft' s'insère en tête
-- de la liste des valeurs autorisées ; les valeurs existantes sont préservées.
DO $$
BEGIN
  IF to_regclass('public.factures') IS NOT NULL THEN
    ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_status_check;
    ALTER TABLE factures
      ADD CONSTRAINT factures_status_check
      CHECK (status IN ('draft','pending','paid','overdue','cancelled','refunded'));
  END IF;
END $$;

-- ── 3) trigger transition factures : autoriser draft → pending|cancelled ───
-- Corps repris VERBATIM de la migration 079 + la seule branche ajoutée 'draft'.
-- Aucune transition existante n'est élargie ni retirée (émission = draft→pending,
-- moment où le numéro légal et le hash-chain sont attribués). Idempotent.
CREATE OR REPLACE FUNCTION public.validate_facture_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  allowed BOOLEAN := FALSE;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'draft' AND NEW.status IN ('pending', 'cancelled') THEN
    allowed := TRUE;
  ELSIF OLD.status = 'pending' AND NEW.status IN ('paid', 'overdue', 'cancelled') THEN
    allowed := TRUE;
  ELSIF OLD.status = 'paid' AND NEW.status IN ('refunded', 'cancelled') THEN
    allowed := TRUE;
  ELSIF OLD.status = 'overdue' AND NEW.status IN ('paid', 'cancelled') THEN
    allowed := TRUE;
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Invalid facture status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation',
            HINT = 'See migrations 079 + 20260602 for the allowed transition matrix';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_facture_transition() IS
  'Empêche transitions de statut interdites sur factures (art. 242 nonies CGI). draft→pending = émission (numéro + hash attribués à ce moment).';
