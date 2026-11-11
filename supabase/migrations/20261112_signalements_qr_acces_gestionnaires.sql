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
-- compte ; la règle « adresse d'une fiche » en UNE fonction (signalements_qr_adresse_de_fiche : même boîte, sous-adresses
-- « + » comprises, ou même partie locale sur un domaine déclaré du cabinet de la fiche ; jumelle TypeScript
-- estAdresseDeFicheQr, mêmes réponses sur une table de cas commune), seule utilisée par les exclusions de l'envoi et par
-- chaque retrait des saisies ; corps de signalements_qr_emails_gestionnaires remplacé (acces_ouvert réel : bouton
-- « Ouvrir le suivi » des e-mails ; même signature ; exclusions par la règle) ; corps de
-- signalements_qr_contester_adresse élargi (« Ce n'est pas moi » aussi depuis un lien d'accès ; même signature) ; corps
-- de signalements_qr_desactiver_gestionnaire (départ) qui retire des saisies l'adresse ET ses variantes par la règle ;
-- effacement RGPD en une transaction (signalements_qr_pseudonymiser_gestionnaire : variantes retirées avant que
-- l'adresse ne disparaisse). Les actions du journal et les valeurs des envois (objet 'acces', refus
-- 'compte_autre_espace') sont déjà dans les CHECK de la 20261111 : aucune contrainte n'est remplacée.
--
-- À appliquer par Frédéric (Supabase > SQL Editor) APRÈS 20261111_signalements_qr_gestionnaires.sql. Additive et
-- rejouable (ADD COLUMN IF NOT EXISTS, contrainte créée seulement si absente de pg_constraint, NOT VALID puis VALIDATE,
-- CREATE INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION / TRIGGER, sans DROP), aucune écriture de données, aucune table
-- nouvelle, aucune valeur de client (dépôt public). La PR peut être fusionnée AVANT : d'ici là, les routes de la PR 2
-- répondent 503 base_absente (« migration à appliquer ») et rien d'existant ne change (espace du super admin, dépôt
-- public, e-mails, connexion ; l'effacement RGPD reste celui de la PR 1, repli journalisé).
-- Ordre des rejeux : cette migration redéfinit trois fonctions de la 20261111 (signalements_qr_emails_gestionnaires,
-- signalements_qr_contester_adresse, signalements_qr_desactiver_gestionnaire ; corps repris de sa version corrigée). Si
-- la 20261111 est rejouée APRÈS celle-ci, elle remet ses corps (acces_ouvert faux, « Ce n'est pas moi » refusé depuis
-- un lien d'accès, variantes laissées au départ) : rejouer ensuite celle-ci (essai PGlite du 11/11).
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

-- ── 4. Adresse d'une fiche : LA règle (RG-06 bis), une seule définition ──
-- Une adresse est celle d'une fiche quand elle a la même BOÎTE (rognée, en minuscules, sans l'étiquette « + » de sa
-- partie locale : « prenom+etiquette@ » est « prenom@ ») ou la même partie locale de boîte sur un domaine DÉCLARÉ par le
-- cabinet de la fiche, passé en p_domaines (un cabinet à deux domaines, ancien et nouveau nom ou domaine secondaire, les
-- fait livrer par sa messagerie aux mêmes boîtes). La partie locale exige une seule « @ » aux deux parties non vides ;
-- NULL ou sans « @ » : non. Le domaine de la fiche n'entre pas en compte (une fiche forcée sur une messagerie publique
-- garde sa partie locale sur les domaines de son cabinet). Jumelle TypeScript : estAdresseDeFicheQr
-- (lib/aj-signalement/gestionnaires.ts), mêmes réponses sur la table de cas commune
-- (tests/helpers/aj-signalement-adresse-de-fiche.cas.json : test de parité, essai PGlite). Immuable : les domaines lui
-- sont passés, elle ne lit aucune table. Seule utilisée par les exclusions de l'envoi (section 5) et par chaque retrait
-- des saisies (départ, effacement, retrait d'attribution).
CREATE OR REPLACE FUNCTION signalements_qr_adresse_de_fiche(p_adresse text, p_fiche_email text, p_domaines text[])
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
  SELECT coalesce(
           strpos(a.boite, '@') > 0 AND strpos(f.boite, '@') > 0
           AND (a.boite = f.boite
                OR (a.boite ~ '^[^@]+@[^@]+$' AND f.boite ~ '^[^@]+@[^@]+$'
                    AND split_part(a.boite, '@', 1) = split_part(f.boite, '@', 1)
                    AND split_part(a.boite, '@', 2) = ANY (p_domaines))),
           false)
    FROM (SELECT regexp_replace(lower(btrim(p_adresse)), '^([^@+]+)\+[^@]*@', '\1@') AS boite) AS a,
         (SELECT regexp_replace(lower(btrim(p_fiche_email)), '^([^@+]+)\+[^@]*@', '\1@') AS boite) AS f
$fn$;

-- Saisies d'une copropriété SANS celles de la fiche (même règle) : ordre gardé, NULL gardés (comme array_remove).
CREATE OR REPLACE FUNCTION signalements_qr_saisies_sans_fiche(p_saisies text[], p_fiche_email text, p_domaines text[])
RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
  SELECT coalesce(array_agg(u.e ORDER BY u.n)
                    FILTER (WHERE NOT signalements_qr_adresse_de_fiche(u.e, p_fiche_email, p_domaines)), '{}')
    FROM unnest(p_saisies) WITH ORDINALITY AS u(e, n)
$fn$;

-- ── 5. Destinataires : même signature et même corps que la 20261111, sauf acces_ouvert (réel) et les exclusions ──
-- acces_ouvert : le gestionnaire a un compte relié, son accès est ouvert et sa connexion n'est pas bloquée (bouton
-- « Ouvrir le suivi » dans l'e-mail d'un signalement, sans jeton).
-- Exclusions (RG-06 bis-3) : une saisie est celle d'une fiche partie ou contestée selon la règle de la section 4
-- (domaines du cabinet de la fiche) ; elle ne reçoit donc rien. La ligne exclue porte cette SAISIE (retirée telle quelle
-- de l'envoi par destinatairesSignalementQr, lib/aj-signalement/destinataires.ts). Une fiche pseudonymisée n'a plus
-- d'adresse et n'exclut plus rien : ses saisies sont retirées AVANT (section 8).
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
    SELECT g.id, u.e, false, true
      FROM signalements_qr_coproprietes c
      CROSS JOIN LATERAL unnest(c.emails_destinataires) AS u(e)
      JOIN signalements_qr_gestionnaires g
        ON signalements_qr_adresse_de_fiche(u.e, g.email,
             ARRAY(SELECT d.domaine FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id = g.cabinet_id))
     WHERE c.id = p_copropriete
       AND (NOT g.actif OR g.adresse_contestee_le IS NOT NULL)
  ) AS t
  ORDER BY t.exclu DESC, t.gestionnaire_id
  LIMIT 100
$fn$;

-- ── 6. « Ce n'est pas moi » aussi depuis un lien d'accès (route POST /api/aj-signalement/invitation/refus) ──
-- Même signature et même corps que la 20261111 (version corrigée de la PR 1 : la fiche verrouillée d'abord, puis ses
-- envois ; les jetons de TOUS ses envois effacés, celui d'un envoi déjà accepté compris), avec : envoi de confirmation
-- d'adresse OU d'accès ; fiche SANS compte relié (un compte ouvert a déjà prouvé la boîte : la fiche ne se conteste
-- plus) ; objet de l'envoi au journal (details { objet }). La fiche est figée, pas désactivée : le super admin choisit
-- les successions.
CREATE OR REPLACE FUNCTION signalements_qr_contester_adresse(p_invitation uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_g    uuid;
  v_cab  uuid;
  v_objet text;
BEGIN
  -- La fiche d'abord, puis ses envois (même ordre que le départ et « C'est moi »).
  PERFORM 1 FROM signalements_qr_gestionnaires g
   WHERE g.id = (SELECT i.gestionnaire_id FROM signalements_qr_invitations i WHERE i.id = p_invitation)
   FOR NO KEY UPDATE;
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
  -- Tous ses liens caducs, celui d'un envoi déjà accepté compris (fiche contestée : 404 générique).
  UPDATE signalements_qr_invitations SET invite_token = NULL
   WHERE gestionnaire_id = v_g AND invite_token IS NOT NULL;
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_profil, acteur_gestionnaire_id, action, gestionnaire_id, details)
  VALUES (v_cab, 'gestionnaire', v_g, 'gestionnaire.adresse_contestee', v_g, jsonb_build_object('objet', v_objet));
  RETURN true;
END $fn$;

-- ── 7. Départ d'un gestionnaire (route POST /api/aj-signalement/gestionnaires/[id]/depart) ──
-- Même signature et même corps que la 20261111 (version corrigée de la PR 1 : ordre unique des verrous, fiches puis
-- copropriétés ; au plus 1 000 attributions par fiche ; jetons de TOUS ses envois effacés), sauf ses saisies : son
-- adresse ET ses variantes (règle de la section 4, domaines de son cabinet) quittent les adresses saisies de toutes les
-- copropriétés, au lieu de la seule égalité exacte (array_remove) ; ces copropriétés sont verrouillées avec les autres,
-- avant tout retrait. Journal inchangé (copropriete.modifiee, motif depart, une ligne par copropriété retouchée).
-- Une succession (un successeur actif du même cabinet, ou NULL) pour CHACUNE de ses attributions.
-- p_successions = [{ coproprieteId, versGestionnaireId | null }].
CREATE OR REPLACE FUNCTION signalements_qr_desactiver_gestionnaire(
  p_id uuid, p_successions jsonb, p_acteur uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_cab        uuid;
  v_actif      boolean;
  v_email      text;
  v_succ       jsonb := coalesce(p_successions, '[]'::jsonb);
  v_attr       uuid[];
  v_s          jsonb;
  v_copro      uuid;
  v_vers       uuid;
  v_deplacees  int := 0;
  v_sans       int := 0;
  v_retirees   int := 0;
  v_c          uuid;
  v_ccab       uuid;
  v_f          uuid;
  v_trouvee    boolean := false;
  v_successeurs  uuid[] := '{}';
  v_domaines   text[];
BEGIN
  IF p_id IS NULL OR p_acteur IS NULL OR jsonb_typeof(v_succ) <> 'array' THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  -- Ordre unique des verrous : la fiche et ses successeurs, par identifiant (la fiche FOR UPDATE ; ses successeurs, une
  -- fois contrôlés actifs, le restent jusqu'à la fin), puis les copropriétés, par identifiant.
  FOR v_f IN SELECT t.x FROM (SELECT p_id AS x
                               UNION SELECT nullif(e.val->>'versGestionnaireId', '')::uuid FROM jsonb_array_elements(v_succ) AS e(val)) AS t
              WHERE t.x IS NOT NULL ORDER BY t.x LOOP
    IF v_f = p_id THEN
      SELECT g.cabinet_id, g.actif, g.email INTO v_cab, v_actif, v_email
        FROM signalements_qr_gestionnaires g WHERE g.id = p_id FOR UPDATE;
      v_trouvee := FOUND;
    ELSE
      PERFORM 1 FROM signalements_qr_gestionnaires g WHERE g.id = v_f FOR NO KEY UPDATE;
    END IF;
  END LOOP;
  IF NOT v_trouvee OR NOT v_actif THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;
  -- Domaines du cabinet de la fiche : ses saisies (adresse et variantes) se reconnaissent par la règle de la section 4.
  v_domaines := ARRAY(SELECT d.domaine FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id = v_cab ORDER BY d.domaine);
  PERFORM 1 FROM signalements_qr_coproprietes c
   WHERE c.id IN (SELECT a.copropriete_id FROM signalements_qr_attributions a WHERE a.gestionnaire_id = p_id)
      OR (v_email IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(c.emails_destinataires) AS u(e)
                                           WHERE signalements_qr_adresse_de_fiche(u.e, v_email, v_domaines)))
   ORDER BY c.id FOR NO KEY UPDATE;
  -- Attributions relues sous ces verrous : aucune ne s'ajoute ni ne se retire plus d'ici la fin de la transaction.
  v_attr := ARRAY(SELECT a.copropriete_id FROM signalements_qr_attributions a WHERE a.gestionnaire_id = p_id);
  -- Une entrée, et une seule, pour chacune de ses attributions ; aucune autre.
  IF jsonb_array_length(v_succ) <> cardinality(v_attr)
     OR (SELECT count(DISTINCT e.val->>'coproprieteId') FROM jsonb_array_elements(v_succ) AS e(val)) <> cardinality(v_attr)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_succ) AS e(val)
                 WHERE e.val->>'coproprieteId' IS NULL OR NOT ((e.val->>'coproprieteId')::uuid = ANY (v_attr))) THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;

  FOR v_s IN SELECT e.val FROM jsonb_array_elements(v_succ) AS e(val) LOOP
    v_copro := (v_s->>'coproprieteId')::uuid;
    v_vers := nullif(v_s->>'versGestionnaireId', '')::uuid;
    IF v_vers IS NULL THEN
      v_sans := v_sans + 1;
    ELSE
      IF v_vers = p_id OR NOT EXISTS (SELECT 1 FROM signalements_qr_gestionnaires g
                                       WHERE g.id = v_vers AND g.actif AND g.cabinet_id = v_cab) THEN
        RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
      END IF;
      INSERT INTO signalements_qr_attributions (copropriete_id, gestionnaire_id, origine, attribue_par)
      VALUES (v_copro, v_vers, 'reattribution', p_acteur)
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, gestionnaire_id, details)
        VALUES (v_cab, p_acteur, 'super_admin', 'attribution.ajoutee', v_copro, v_vers, '{"origine": "reattribution"}'::jsonb);
      END IF;
      v_successeurs := array_append(v_successeurs, v_vers);
      v_deplacees := v_deplacees + 1;
    END IF;
  END LOOP;
  -- Au plus 1 000 attributions par fiche, successeurs compris (voir signalements_qr_creer_coproprietes) : la fiche qui part
  -- n'en a jamais plus, ses 1 000 successions au plus passent toujours (« sans gestionnaire » si un successeur est plein).
  IF EXISTS (SELECT 1 FROM signalements_qr_attributions a WHERE a.gestionnaire_id = ANY (v_successeurs)
              GROUP BY a.gestionnaire_id HAVING count(*) > 1000) THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;

  -- Successeurs posés d'abord, puis retrait : la copropriété n'est jamais un instant sans son successeur.
  DELETE FROM signalements_qr_attributions a WHERE a.gestionnaire_id = p_id;
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, gestionnaire_id, details)
  SELECT v_cab, p_acteur, 'super_admin', 'attribution.retiree', t.x, p_id, '{"motif": "depart"}'::jsonb FROM unnest(v_attr) AS t(x);

  UPDATE signalements_qr_gestionnaires SET actif = false, desactive_le = now(), desactive_par = p_acteur WHERE id = p_id;
  -- Ses liens ne valent plus rien : ceux pas encore ouverts, et celui déjà confirmé (fiche désactivée : 404 générique).
  UPDATE signalements_qr_invitations SET invite_token = NULL
   WHERE gestionnaire_id = p_id AND invite_token IS NOT NULL;

  -- Son adresse ET ses variantes (règle de la section 4 : même boîte, ou même partie locale sur un domaine de son
  -- cabinet) quittent les adresses saisies de TOUTES les copropriétés qui les contiennent (quel que soit leur cabinet).
  IF v_email IS NOT NULL THEN
    FOR v_c, v_ccab IN
      UPDATE signalements_qr_coproprietes c
         SET emails_destinataires = signalements_qr_saisies_sans_fiche(c.emails_destinataires, v_email, v_domaines)
       WHERE EXISTS (SELECT 1 FROM unnest(c.emails_destinataires) AS u(e)
                      WHERE signalements_qr_adresse_de_fiche(u.e, v_email, v_domaines))
      RETURNING c.id, c.cabinet_id
    LOOP
      v_retirees := v_retirees + 1;
      INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, gestionnaire_id,
                                           champs, details)
      VALUES (v_ccab, p_acteur, 'super_admin', 'copropriete.modifiee', v_c, p_id, ARRAY['emails_destinataires'],
              '{"motif": "depart"}'::jsonb);
    END LOOP;
  END IF;

  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, gestionnaire_id, details)
  VALUES (v_cab, p_acteur, 'super_admin', 'gestionnaire.desactive', p_id,
          jsonb_build_object('deplacees', v_deplacees, 'sansGestionnaire', v_sans, 'adressesRetirees', v_retirees));
  RETURN jsonb_build_object('deplacees', v_deplacees, 'laisseesSansGestionnaire', v_sans, 'adressesRetirees', v_retirees);
END $fn$;


-- ── 8. Effacement RGPD d'une fiche partie (route PATCH /api/aj-signalement/gestionnaires/[id] { pseudonymiser }) ──
-- Une transaction : les saisies reconnues comme l'adresse de la fiche (règle de la section 4, domaines de son cabinet)
-- quittent TOUTES les copropriétés AVANT que l'adresse ne soit effacée ; sinon plus rien ne les exclurait de l'envoi
-- (l'exclusion de la section 5 porte sur l'adresse de la fiche) et une variante restée (import, saisie antérieure,
-- départ fait avant cette migration) recevrait les coordonnées des déclarants dans la boîte de la personne partie.
-- Puis nom et e-mail mis à NULL. Fiche désactivée seulement (le départ d'abord) ; déjà pseudonymisée : rien (relance du
-- même bouton). Ordre des verrous : la fiche, puis les copropriétés par identifiant (comme le départ). Journal comme au
-- départ ; les envois et la ligne gestionnaire.pseudonymise restent écrits par la route (PR 1). Fonction absente (cette
-- migration non appliquée) : la route fait la pseudonymisation de la PR 1 et journalise le repli.
CREATE OR REPLACE FUNCTION signalements_qr_pseudonymiser_gestionnaire(p_id uuid, p_acteur uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_g         signalements_qr_gestionnaires%ROWTYPE;
  v_domaines  text[];
  v_c         uuid;
  v_ccab      uuid;
  v_retirees  int := 0;
BEGIN
  IF p_id IS NULL OR p_acteur IS NULL THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_g FROM signalements_qr_gestionnaires g WHERE g.id = p_id FOR UPDATE;
  IF NOT FOUND OR v_g.actif THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;
  IF v_g.pseudonymise_le IS NOT NULL THEN
    RETURN jsonb_build_object('pseudonymisee', false, 'adressesRetirees', 0);
  END IF;
  IF v_g.email IS NOT NULL THEN
    v_domaines := ARRAY(SELECT d.domaine FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id = v_g.cabinet_id ORDER BY d.domaine);
    PERFORM 1 FROM signalements_qr_coproprietes c
     WHERE EXISTS (SELECT 1 FROM unnest(c.emails_destinataires) AS u(e)
                    WHERE signalements_qr_adresse_de_fiche(u.e, v_g.email, v_domaines))
     ORDER BY c.id FOR NO KEY UPDATE;
    FOR v_c, v_ccab IN
      UPDATE signalements_qr_coproprietes c
         SET emails_destinataires = signalements_qr_saisies_sans_fiche(c.emails_destinataires, v_g.email, v_domaines)
       WHERE EXISTS (SELECT 1 FROM unnest(c.emails_destinataires) AS u(e)
                      WHERE signalements_qr_adresse_de_fiche(u.e, v_g.email, v_domaines))
      RETURNING c.id, c.cabinet_id
    LOOP
      v_retirees := v_retirees + 1;
      INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, gestionnaire_id,
                                           champs, details)
      VALUES (v_ccab, p_acteur, 'super_admin', 'copropriete.modifiee', v_c, p_id, ARRAY['emails_destinataires'],
              '{"motif": "depart"}'::jsonb);
    END LOOP;
  END IF;
  -- L'adresse disparaît APRÈS le retrait de ses saisies (même transaction : tout ou rien).
  UPDATE signalements_qr_gestionnaires SET nom = NULL, email = NULL, pseudonymise_le = now() WHERE id = p_id;
  RETURN jsonb_build_object('pseudonymisee', true, 'adressesRetirees', v_retirees);
END $fn$;

-- ── 9. Droits ──
REVOKE EXECUTE ON FUNCTION signalements_qr_envoyer_acces(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_envoyer_acces(uuid, jsonb, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_emails_gestionnaires(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_emails_gestionnaires(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_contester_adresse(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_contester_adresse(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_lier_gestionnaire() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION signalements_qr_adresse_de_fiche(text, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_adresse_de_fiche(text, text, text[]) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_saisies_sans_fiche(text[], text, text[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_saisies_sans_fiche(text[], text, text[]) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_desactiver_gestionnaire(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_desactiver_gestionnaire(uuid, jsonb, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_pseudonymiser_gestionnaire(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_pseudonymiser_gestionnaire(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
