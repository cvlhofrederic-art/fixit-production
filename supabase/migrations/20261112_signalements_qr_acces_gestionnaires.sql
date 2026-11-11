-- ══════════════════════════════════════════════════════════════════════════════
-- AJ Signalement (12/11/2026) — accès de chaque gestionnaire à l'espace de son cabinet (vitfix.io/<identifiant>/suivi/).
--
-- Demandes de Hugo du 10 et du 11/11/2026 : chaque gestionnaire a un compte VitFix professionnel (rôle serveur
-- gestionnaire_signalement, posé par le serveur à l'acceptation d'une invitation signée envoyée par e-mail) ; un compte
-- existant n'est jamais converti. Le compte est relié à sa fiche (user_id) par le trigger ci-dessous, à l'acceptation
-- d'un envoi « acces » ; les droits suivent la fiche ACTIVE et ses attributions, relues par le serveur à chaque appel.
--
-- Contenu : 4 colonnes sur la fiche (compte relié, date d'ouverture de l'accès, date de blocage de la connexion après un
-- départ, date d'une demande d'effacement transmise au cabinet), FK vers auth.users (ON DELETE SET NULL), index unique
-- « un compte = une fiche », envoi d'un accès en une transaction (signalements_qr_envoyer_acces), trigger de liaison du
-- compte, corps de signalements_qr_emails_gestionnaires remplacé (acces_ouvert réel : bouton « Ouvrir le suivi » des
-- e-mails ; même signature, mêmes exclusions), corps de signalements_qr_contester_adresse élargi (« Ce n'est pas moi »
-- aussi depuis un lien d'accès ; même signature). Les actions du journal et les valeurs des envois (objet 'acces', refus
-- 'compte_autre_espace') sont déjà dans les CHECK de la 20261111 : aucune contrainte n'est remplacée.
--
-- À appliquer par Frédéric (Supabase > SQL Editor) APRÈS 20261111_signalements_qr_gestionnaires.sql. Additive et
-- rejouable (ADD COLUMN IF NOT EXISTS, contrainte créée seulement si absente de pg_constraint, NOT VALID puis VALIDATE,
-- CREATE INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION / TRIGGER, sans DROP), aucune écriture de données, aucune table
-- nouvelle, aucune valeur de client (dépôt public). La PR peut être fusionnée AVANT : d'ici là, les routes de la PR 2
-- répondent 503 base_absente (« migration à appliquer ») et rien d'existant ne change (espace du super admin, dépôt
-- public, e-mails, connexion).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Colonnes de la fiche ──
ALTER TABLE signalements_qr_gestionnaires ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE signalements_qr_gestionnaires ADD COLUMN IF NOT EXISTS acces_ouvert_le TIMESTAMPTZ;
ALTER TABLE signalements_qr_gestionnaires ADD COLUMN IF NOT EXISTS connexion_bloquee_le TIMESTAMPTZ;
ALTER TABLE signalements_qr_gestionnaires ADD COLUMN IF NOT EXISTS effacement_demande_le TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_gestionnaires_user_fk'
                 AND conrelid = 'signalements_qr_gestionnaires'::regclass) THEN
    ALTER TABLE signalements_qr_gestionnaires ADD CONSTRAINT signalements_qr_gestionnaires_user_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;
ALTER TABLE signalements_qr_gestionnaires VALIDATE CONSTRAINT signalements_qr_gestionnaires_user_fk;

-- Un compte = une fiche.
CREATE UNIQUE INDEX IF NOT EXISTS uq_signalements_qr_gestionnaires_user
  ON signalements_qr_gestionnaires (user_id) WHERE user_id IS NOT NULL;

COMMENT ON COLUMN signalements_qr_gestionnaires.user_id IS 'Compte VitFix du gestionnaire (rôle gestionnaire_signalement), relié à l''acceptation de son accès ; NULL : aucun accès.';
COMMENT ON COLUMN signalements_qr_gestionnaires.acces_ouvert_le IS 'Date de la première acceptation de l''accès (le compte a été relié).';
COMMENT ON COLUMN signalements_qr_gestionnaires.connexion_bloquee_le IS 'Compte banni après le départ (la fiche inactive coupe déjà tout accès).';
COMMENT ON COLUMN signalements_qr_gestionnaires.effacement_demande_le IS 'Demande d''effacement reçue du gestionnaire (suppression du compte refusée, transmise au cabinet).';

-- ── 2. Envoi d'un accès (route POST /api/aj-signalement/gestionnaires/[id]/acces) ──
-- p_invitation = { id, invite_token, email } signés par nouvelleInvitation (lib/equipe) AVANT cet appel, insérés tels
-- quels. Le journal (gestionnaire.acces_envoye) est écrit par la route après l'e-mail, comme la confirmation d'adresse.
-- L'adresse n'a pas à être confirmée avant : l'acceptation prouve la boîte (le trigger la date).
CREATE OR REPLACE FUNCTION signalements_qr_envoyer_acces(p_gestionnaire uuid, p_invitation jsonb, p_acteur uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_inv  uuid := nullif(p_invitation->>'id', '')::uuid;
  v_g    signalements_qr_gestionnaires%ROWTYPE;
BEGIN
  IF p_gestionnaire IS NULL OR v_inv IS NULL OR p_acteur IS NULL OR p_invitation->>'invite_token' IS NULL THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_g FROM signalements_qr_gestionnaires g WHERE g.id = p_gestionnaire FOR UPDATE;
  IF NOT FOUND OR NOT v_g.actif OR v_g.pseudonymise_le IS NOT NULL OR v_g.email IS NULL
     OR p_invitation->>'email' IS DISTINCT FROM v_g.email THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;
  IF v_g.adresse_contestee_le IS NOT NULL THEN
    RAISE EXCEPTION 'adresse_contestee' USING ERRCODE = 'P0001';
  END IF;
  IF v_g.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'deja_ouvert' USING ERRCODE = 'P0001';
  END IF;
  UPDATE signalements_qr_invitations SET invite_token = NULL
   WHERE gestionnaire_id = p_gestionnaire AND objet = 'acces' AND accepted_at IS NULL AND invite_token IS NOT NULL;
  INSERT INTO signalements_qr_invitations (id, gestionnaire_id, objet, email, full_name, invite_token, envoye_par)
  VALUES (v_inv, p_gestionnaire, 'acces', v_g.email, v_g.nom, p_invitation->>'invite_token', p_acteur);
  RETURN true;
END $fn$;

-- ── 3. Liaison du compte à l'acceptation (marquerAcceptee de lib/equipe pose user_id, accepted_at) ──
-- Le code partagé ne rend pas l'identifiant d'un compte existant rattaché : la liaison se fait ici, dans la même
-- transaction que l'acceptation. Gardes : envoi « acces » accepté avec un compte nouveau ; compte relié à aucune autre
-- fiche ; fiche active, non pseudonymisée, non contestée, à la même adresse, sans autre compte. Sinon rien : la route
-- relit l'envoi et la fiche, et répond 207 liaison_incomplete.
CREATE OR REPLACE FUNCTION signalements_qr_lier_gestionnaire() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_cab  uuid;
BEGIN
  IF NEW.objet <> 'acces' OR NEW.user_id IS NULL OR NEW.accepted_at IS NULL
     OR NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM signalements_qr_gestionnaires g WHERE g.user_id = NEW.user_id AND g.id <> NEW.gestionnaire_id) THEN
    RETURN NEW;
  END IF;
  UPDATE signalements_qr_gestionnaires g
     SET user_id              = NEW.user_id,
         acces_ouvert_le      = coalesce(g.acces_ouvert_le, NEW.accepted_at),
         adresse_confirmee_le = coalesce(g.adresse_confirmee_le, NEW.accepted_at)
   WHERE g.id = NEW.gestionnaire_id AND g.actif AND g.pseudonymise_le IS NULL AND g.adresse_contestee_le IS NULL
     AND g.email = NEW.email AND (g.user_id IS NULL OR g.user_id = NEW.user_id)
  RETURNING g.cabinet_id INTO v_cab;
  IF FOUND THEN
    UPDATE signalements_qr_invitations SET invite_token = NULL
     WHERE gestionnaire_id = NEW.gestionnaire_id AND id <> NEW.id AND accepted_at IS NULL AND invite_token IS NOT NULL;
    INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, acteur_gestionnaire_id, action, gestionnaire_id)
    VALUES (v_cab, NEW.user_id, 'gestionnaire', NEW.gestionnaire_id, 'gestionnaire.acces_ouvert', NEW.gestionnaire_id);
  END IF;
  RETURN NEW;
END $fn$;

CREATE OR REPLACE TRIGGER trg_signalements_qr_invitations_liaison
  AFTER UPDATE OF user_id ON signalements_qr_invitations
  FOR EACH ROW EXECUTE FUNCTION signalements_qr_lier_gestionnaire();

-- ── 4. Destinataires : même signature et même corps que la 20261111, seul acces_ouvert devient réel ──
-- acces_ouvert : le gestionnaire a un compte relié, son accès est ouvert et sa connexion n'est pas bloquée (bouton
-- « Ouvrir le suivi » dans l'e-mail d'un signalement, sans jeton).
CREATE OR REPLACE FUNCTION signalements_qr_emails_gestionnaires(p_copropriete uuid)
RETURNS TABLE(gestionnaire_id uuid, email text, acces_ouvert boolean, exclu boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
  SELECT t.gestionnaire_id, t.email, t.acces_ouvert, t.exclu FROM (
    SELECT g.id AS gestionnaire_id, g.email AS email, (g.user_id IS NOT NULL AND g.acces_ouvert_le IS NOT NULL AND g.connexion_bloquee_le IS NULL) AS acces_ouvert, false AS exclu
      FROM signalements_qr_coproprietes c
      JOIN signalements_qr_gestionnaires g ON g.cabinet_id = c.cabinet_id
     WHERE c.id = p_copropriete
       AND g.actif AND g.email IS NOT NULL AND g.adresse_confirmee_le IS NOT NULL AND g.adresse_contestee_le IS NULL
       AND (c.attribuee_a_tous OR EXISTS (SELECT 1 FROM signalements_qr_attributions a
                                           WHERE a.copropriete_id = c.id AND a.gestionnaire_id = g.id))
    UNION ALL
    SELECT g.id, g.email, false, true
      FROM signalements_qr_coproprietes c
      JOIN signalements_qr_gestionnaires g ON g.email = ANY (c.emails_destinataires)
     WHERE c.id = p_copropriete
       AND (NOT g.actif OR g.adresse_contestee_le IS NOT NULL)
  ) AS t
  ORDER BY t.exclu DESC, t.gestionnaire_id
  LIMIT 100
$fn$;

-- ── 5. « Ce n'est pas moi » aussi depuis un lien d'accès (route POST /api/aj-signalement/invitation/refus) ──
-- Même signature et même corps que la 20261111, avec : envoi de confirmation d'adresse OU d'accès ; fiche SANS compte
-- relié (un compte ouvert a déjà prouvé la boîte : la fiche ne se conteste plus) ; objet de l'envoi au journal
-- (details { objet }). La fiche est figée, pas désactivée : le super admin choisit les successions.
CREATE OR REPLACE FUNCTION signalements_qr_contester_adresse(p_invitation uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_g    uuid;
  v_cab  uuid;
  v_objet text;
BEGIN
  UPDATE signalements_qr_invitations i SET refus = 'pas_moi', invite_token = NULL
   WHERE i.id = p_invitation AND i.objet IN ('confirmation_adresse', 'acces') AND i.accepted_at IS NULL AND i.refus IS NULL
     AND i.invite_token IS NOT NULL AND i.created_at > now() - interval '7 days'
     AND EXISTS (SELECT 1 FROM signalements_qr_gestionnaires g
                  WHERE g.id = i.gestionnaire_id AND g.actif AND g.adresse_contestee_le IS NULL AND g.email = i.email
                    AND g.user_id IS NULL)
  RETURNING i.gestionnaire_id, i.objet INTO v_g, v_objet;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE signalements_qr_gestionnaires SET adresse_contestee_le = now() WHERE id = v_g
  RETURNING cabinet_id INTO v_cab;
  UPDATE signalements_qr_invitations SET invite_token = NULL
   WHERE gestionnaire_id = v_g AND accepted_at IS NULL AND invite_token IS NOT NULL;
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_profil, acteur_gestionnaire_id, action, gestionnaire_id, details)
  VALUES (v_cab, 'gestionnaire', v_g, 'gestionnaire.adresse_contestee', v_g, jsonb_build_object('objet', v_objet));
  RETURN true;
END $fn$;

-- ── 6. Droits ──
REVOKE EXECUTE ON FUNCTION signalements_qr_envoyer_acces(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_envoyer_acces(uuid, jsonb, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_emails_gestionnaires(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_emails_gestionnaires(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_contester_adresse(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_contester_adresse(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_lier_gestionnaire() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
