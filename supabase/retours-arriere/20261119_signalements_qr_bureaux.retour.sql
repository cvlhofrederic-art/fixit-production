-- ══════════════════════════════════════════════════════════════════════════════
-- AJ Signalement — RETOUR ARRIÈRE de supabase/migrations/20261119_signalements_qr_bureaux.sql (bureaux des cabinets).
--
-- PAS une migration : ce fichier n'est jamais appliqué par la chaîne (il n'est pas dans supabase/migrations). À exécuter
-- seulement sur décision, par l'éditeur SQL de Supabase (tout ou rien), après avoir relevé ce qu'il fera perdre (des
-- nombres seulement) :
--   SELECT (SELECT count(*) FROM signalements_qr_bureaux) AS bureaux,
--          (SELECT count(*) FROM signalements_qr_gestionnaires WHERE bureau_id IS NOT NULL) AS fiches_rattachees,
--          (SELECT count(*) FROM signalements_qr_coproprietes WHERE bureau_id IS NOT NULL) AS coproprietes_rattachees;
-- Ce qui est perdu : les bureaux et les rattachements des fiches et des copropriétés. Ce qui reste : les lignes du
-- journal (actions existantes, option A : aucune n'empêche le retour).
-- Avant : déployer un code qui se replie sans les bureaux (le code de la PR 1 le fait : listes sans bureau, actions sur
-- les bureaux 503 base_absente).
-- Ordre : triggers, fonctions nouvelles, signalements_qr_inviter_gestionnaire remise dans son texte de la 20261112 (même
-- signature, mêmes droits), contraintes et colonnes bureau_id, table des bureaux. Rejouable (IF EXISTS partout).
-- Exécuté par tests/migrations/signalements_qr_bureaux.execution.test.ts (PGlite) : le schéma rendu est celui d'avant la
-- migration.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Triggers et fonctions nouvelles ──
DROP TRIGGER IF EXISTS trg_signalements_qr_gestionnaires_bureau ON signalements_qr_gestionnaires;
DROP TRIGGER IF EXISTS trg_signalements_qr_copros_bureau ON signalements_qr_coproprietes;
DROP FUNCTION IF EXISTS signalements_qr_bureau_du_gestionnaire();
DROP FUNCTION IF EXISTS signalements_qr_bureau_de_la_copropriete();
DROP FUNCTION IF EXISTS signalements_qr_enregistrer_bureau(uuid, uuid, text, uuid);
DROP FUNCTION IF EXISTS signalements_qr_fermer_bureau(uuid, boolean, uuid);

-- ── 2. Création d'une fiche : texte de la 20261112, à l'identique (sans bureau) ──
CREATE OR REPLACE FUNCTION signalements_qr_inviter_gestionnaire(
  p_gestionnaire jsonb, p_invitation jsonb, p_coproprietes uuid[], p_acteur uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_id      uuid := nullif(p_gestionnaire->>'id', '')::uuid;
  v_cab     uuid := nullif(p_gestionnaire->>'cabinetId', '')::uuid;
  v_nom     text := btrim(p_gestionnaire->>'nom');
  v_email   text := p_gestionnaire->>'email';
  v_force   boolean := coalesce((p_gestionnaire->>'domaineForce')::boolean, false);
  v_inv     uuid := nullif(p_invitation->>'id', '')::uuid;
  v_copros  uuid[] := ARRAY(SELECT DISTINCT t.x FROM unnest(coalesce(p_coproprietes, '{}'::uuid[])) AS t(x) WHERE t.x IS NOT NULL);
  v_existante uuid;
BEGIN
  IF v_id IS NULL OR v_inv IS NULL OR p_acteur IS NULL OR v_email IS NULL OR v_nom IS NULL
     OR p_invitation->>'invite_token' IS NULL OR cardinality(v_copros) > 500 THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  -- L'adresse signée est celle de la fiche, à l'identique ; le cabinet existe.
  IF p_invitation->>'email' IS DISTINCT FROM v_email OR v_cab IS NULL
     OR NOT EXISTS (SELECT 1 FROM signalements_qr_cabinets k WHERE k.id = v_cab) THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;
  -- Verrous de la transaction (contre-vérification du 12/11) : le domaine de l'adresse (même clé que l'ajout d'un domaine
  -- à un cabinet, section 11), puis sa partie locale sans étiquette « + » (deux fiches de même boîte ont toujours la même :
  -- leurs créations simultanées passent l'une après l'autre ; l'index unique ne voit que l'adresse exacte).
  PERFORM pg_advisory_xact_lock(hashtext('signalements_qr_domaine:' || split_part(v_email, '@', 2)));
  PERFORM pg_advisory_xact_lock(hashtext('signalements_qr_boite:' || split_part(split_part(v_email, '@', 1), '+', 1)));
  -- Domaine déclaré par un AUTRE cabinet client : refusé, forçage compris (son titulaire est salarié d'un autre client).
  IF EXISTS (SELECT 1 FROM signalements_qr_domaines_autorises d
              WHERE d.cabinet_id <> v_cab AND d.domaine = split_part(v_email, '@', 2)) THEN
    RAISE EXCEPTION 'domaine_autre_cabinet' USING ERRCODE = 'P0001';
  END IF;
  -- Une fiche n'est créée que dans les domaines de SON cabinet, sauf forçage du super admin (journalisé).
  IF NOT v_force AND NOT EXISTS (SELECT 1 FROM signalements_qr_domaines_autorises d
                                  WHERE d.cabinet_id = v_cab AND d.domaine = split_part(v_email, '@', 2)) THEN
    RAISE EXCEPTION 'hors_domaine' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_copros) AS t(x)
              WHERE NOT EXISTS (SELECT 1 FROM signalements_qr_coproprietes c WHERE c.id = t.x AND c.cabinet_id = v_cab)) THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;

  -- Boîte déjà portée par une fiche, active ou non, de tout cabinet (contre-vérification du 12/11) : la nouvelle adresse
  -- est une adresse de cette fiche, ou l'adresse de cette fiche est une adresse de la nouvelle, par la règle de la section
  -- 4 (domaines du cabinet de chacune) ; une boîte, une fiche (sinon le départ de l'une emporterait l'adresse de l'autre).
  -- Deux fiches forcées d'un même cabinet sur deux boîtes distinctes de même partie locale (luc@<messagerie 1>,
  -- luc@<messagerie 2>) ne se croisent que par une variante virtuelle sur le domaine du cabinet : acceptées (reprise de la
  -- garde, constat 6 ; une fiche forcée ne garde que sa boîte, section 4). Refus existe_deja, avec l'identifiant de la
  -- fiche en DETAIL (la route le rend : « voir la fiche ») : celle de même boîte d'abord, puis la plus petite par
  -- identifiant. Une fiche effacée n'a plus d'adresse : sa boîte se libère.
  SELECT o.id INTO v_existante FROM signalements_qr_gestionnaires o
   WHERE o.email IS NOT NULL
     AND (signalements_qr_adresse_de_fiche(v_email, o.email,
            ARRAY(SELECT d.domaine FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id = o.cabinet_id))
          OR signalements_qr_adresse_de_fiche(o.email, v_email,
            ARRAY(SELECT d.domaine FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id = v_cab)))
   ORDER BY signalements_qr_adresse_de_fiche(v_email, o.email, '{}'::text[]) DESC, o.id LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'existe_deja' USING ERRCODE = 'P0001', DETAIL = v_existante::text;
  END IF;
  INSERT INTO signalements_qr_gestionnaires (id, cabinet_id, nom, email, domaine_force, cree_par)
  VALUES (v_id, v_cab, v_nom, v_email, v_force, p_acteur);      -- 23505 : adresse déjà en table (existe_deja)
  INSERT INTO signalements_qr_invitations (id, gestionnaire_id, objet, email, full_name, invite_token, envoye_par)
  VALUES (v_inv, v_id, 'confirmation_adresse', v_email, v_nom, p_invitation->>'invite_token', p_acteur);
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, gestionnaire_id)
  VALUES (v_cab, p_acteur, 'super_admin', 'gestionnaire.cree', v_id);
  IF v_force THEN
    INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, gestionnaire_id)
    VALUES (v_cab, p_acteur, 'super_admin', 'gestionnaire.domaine_force', v_id);
  END IF;

  WITH ajoutees AS (
    INSERT INTO signalements_qr_attributions (copropriete_id, gestionnaire_id, origine, attribue_par)
    SELECT t.x, v_id, 'super_admin', p_acteur FROM unnest(v_copros) AS t(x)
    ON CONFLICT DO NOTHING
    RETURNING copropriete_id
  )
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, copropriete_id, gestionnaire_id, details)
  SELECT v_cab, p_acteur, 'super_admin', 'attribution.ajoutee', a.copropriete_id, v_id, '{"origine": "super_admin"}'::jsonb
    FROM ajoutees a;
  RETURN v_id;
END $fn$;
REVOKE EXECUTE ON FUNCTION signalements_qr_inviter_gestionnaire(jsonb, jsonb, uuid[], uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_inviter_gestionnaire(jsonb, jsonb, uuid[], uuid) TO service_role;

-- ── 3. Contraintes, index et colonnes bureau_id (les index partent avec leur colonne) ──
ALTER TABLE signalements_qr_gestionnaires DROP CONSTRAINT IF EXISTS signalements_qr_gestionnaires_bureau_fk;
ALTER TABLE signalements_qr_coproprietes DROP CONSTRAINT IF EXISTS signalements_qr_copros_bureau_fk;
ALTER TABLE signalements_qr_coproprietes DROP CONSTRAINT IF EXISTS signalements_qr_copros_bureau_cabinet;
ALTER TABLE signalements_qr_gestionnaires DROP COLUMN IF EXISTS bureau_id;
ALTER TABLE signalements_qr_coproprietes DROP COLUMN IF EXISTS bureau_id;

-- ── 4. Table des bureaux (son trigger updated_at et son index partent avec elle) ──
DROP TABLE IF EXISTS signalements_qr_bureaux;

NOTIFY pgrst, 'reload schema';
