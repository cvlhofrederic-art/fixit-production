-- ══════════════════════════════════════════════════════════════════════════════
-- AJ Signalement (19/11/2026) — bureaux des cabinets clients : base (PR 1, sans écran).
--
-- Demande du 14/11/2026 : un cabinet client a plusieurs bureaux ; chaque gestionnaire appartient à un bureau.
-- Accord du 17/11/2026 sur les cinq choix de la note des bureaux : (1) la copropriété est rattachée DIRECTEMENT à un
-- bureau ; (2) bureau obligatoire pour les NOUVEAUX gestionnaires, les fiches existantes complétées au fil de l'eau ;
-- (3) bureaux créés par le super admin seul en V1 ; (4) pas d'adresse de contact par bureau en V1 ; (5) visibilité
-- inchangée, le bureau sert de filtre. Réponses proposées aux questions ouvertes du plan, appliquées ici et à valider :
-- bureau facultatif pour une copropriété ; un bureau encore utilisé (gestionnaire actif ou copropriété active) ne se
-- ferme pas, et rien ne s'y réactive une fois fermé (un bureau fermé n'a jamais de rattachement actif) ; le bureau
-- d'une fiche se change, il ne se retire pas ; journal par des actions EXISTANTES (option A).
-- Aucune valeur ici (ni cabinet, ni bureau) : le dépôt est public, les bureaux se saisissent dans l'espace.
--
-- Contenu : la table signalements_qr_bureaux (cabinet, nom unique dans le cabinet à la casse et aux espaces près,
-- fermeture datée ; AUCUNE adresse de contact) ; une colonne bureau_id sur la fiche gestionnaire et sur la copropriété,
-- vide permise, avec une clé étrangère composée (bureau_id, cabinet_id) : le bureau appartient toujours au cabinet de la
-- fiche ou de la copropriété ; une copropriété sans cabinet ne porte jamais de bureau (contrôle : une clé composée n'est
-- pas vérifiée quand l'une de ses colonnes est vide). Règles posées par la base (triggers) :
--   - nouvelle fiche sans bureau dans un cabinet qui a un bureau ouvert : bureau_requis (une fiche existante n'est
--     jamais bloquée ; tant qu'aucun bureau n'existe, rien ne change pour personne) ;
--   - fiche qui a un bureau : il se change, il ne se retire pas (bureau_requis) ;
--   - rattacher une fiche ou une copropriété à un bureau fermé : bureau_ferme (ce qui y est déjà rattaché le reste) ;
--   - réactiver une fiche ou une copropriété (actif faux → vrai) restée dans un bureau fermé : bureau_ferme, comme un
--     rattachement (changer de bureau d'abord, ou dans la même écriture) ; sinon la fermeture se contournerait.
-- Fonctions appelées par les routes : signalements_qr_enregistrer_bureau (création ou renommage),
-- signalements_qr_fermer_bureau (fermeture ou réouverture), et signalements_qr_inviter_gestionnaire, MÊME signature,
-- redéfinie à partir de son texte de la 20261112 (dernière définition), avec une seule différence : elle lit bureauId
-- dans p_gestionnaire et l'insère. Le changement de bureau d'une fiche ou d'une copropriété passe par les routes de
-- modification existantes (écriture directe) : les triggers et les clés étrangères font les contrôles.
-- Journal (option A) : actions EXISTANTES, liste fermée inchangée (signalements_qr_journal_action_valeurs n'est pas
-- touchée) : création, renommage, fermeture, réouverture d'un bureau = cabinet.modifie, champs {bureaux}, détails
-- { bureau: cree | renomme | ferme | rouvert, bureauId } (énumération et identifiant, jamais le nom du bureau).
-- Erreurs levées : P0001 (nom_pris, plafond_bureaux — 100 bureaux par cabinet —, bureau_utilise, bureau_requis,
-- bureau_ferme, a_reverifier : codes publics 409 des routes), 22023 (paramètre invalide) ; jamais renvoyées telles
-- quelles au navigateur.
-- Droits : RLS activée sans politique sur la table nouvelle, droits retirés à PUBLIC, anon et authenticated ; EXECUTE
-- des fonctions à service_role seul ; fonctions SECURITY INVOKER, chemin de recherche figé. Droits de la fiche redits
-- (colonne nouvelle, sans effet). La copropriété garde ses droits d'aujourd'hui, comme ses autres colonnes : les droits
-- de la table n'ont jamais été retirés à anon et authenticated (20261104), seule la RLS sans politique les arrête (aucune
-- ligne lue ni écrite) ; les retirer toucherait une table existante (à trancher, hors de cette migration).
--
-- Additive et rejouable (modèle 20261114) : CREATE TABLE / INDEX IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, contraintes
-- nommées créées seulement si absentes de pg_constraint, en NOT VALID puis VALIDATE, CREATE OR REPLACE FUNCTION et
-- CREATE OR REPLACE TRIGGER ; aucune écriture de données ; aucun DROP. À appliquer APRÈS
-- 20261112_signalements_qr_acces_gestionnaires.sql (corps de signalements_qr_inviter_gestionnaire repris), avant ou après
-- la 20261113 et la 20261114 (aucune dépendance) ; seulement après la fusion et l'accord donné. La 20261112
-- rejouée APRÈS celle-ci remet son corps de signalements_qr_inviter_gestionnaire (sans bureau) : rejouer ensuite
-- celle-ci. D'ici là, les routes se replient (42P01, PGRST205, 42703, PGRST204, PGRST202) : listes sans bureau, actions
-- sur les bureaux 503 base_absente.
-- Retour arrière : supabase/retours-arriere/20261119_signalements_qr_bureaux.retour.sql (bureaux et rattachements
-- perdus, journal gardé), exécuté dans tests/migrations/signalements_qr_bureaux.execution.test.ts.
-- Règles exécutées sur un vrai PostgreSQL : tests/migrations/signalements_qr_bureaux.execution.test.ts (PGlite).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Bureaux d'un cabinet ──
CREATE TABLE IF NOT EXISTS signalements_qr_bureaux (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id  UUID NOT NULL REFERENCES signalements_qr_cabinets(id) ON DELETE RESTRICT,
  nom         TEXT NOT NULL,
  ferme_le    TIMESTAMPTZ,                            -- NULL : bureau ouvert ; une date : bureau fermé
  cree_par    UUID NOT NULL,                          -- super admin, sans clé étrangère (la trace survit au compte)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Cible des clés étrangères composées : le bureau d'une fiche ou d'une copropriété est dans SON cabinet.
  CONSTRAINT signalements_qr_bureaux_id_cabinet_unique UNIQUE (id, cabinet_id),
  CONSTRAINT signalements_qr_bureaux_nom_format
    CHECK (nom = btrim(nom) AND char_length(nom) BETWEEN 1 AND 80 AND nom !~ '[[:cntrl:]]')
);
-- Deux bureaux d'un même cabinet ne portent pas le même nom, à la casse et aux espaces près, bureaux fermés compris.
CREATE UNIQUE INDEX IF NOT EXISTS uq_signalements_qr_bureaux_nom
  ON signalements_qr_bureaux (cabinet_id, lower(btrim(nom)));
COMMENT ON TABLE signalements_qr_bureaux IS 'AJ Signalement : bureaux d''un cabinet client, créés par le super admin (V1 : nom et fermeture, aucune adresse de contact).';
COMMENT ON COLUMN signalements_qr_bureaux.ferme_le IS 'NULL : bureau ouvert ; une date : bureau fermé (aucun nouveau rattachement ni aucune réactivation ; ce qui y est rattaché le reste).';

-- ── 2. Bureau d'une fiche gestionnaire et d'une copropriété ──
ALTER TABLE signalements_qr_gestionnaires ADD COLUMN IF NOT EXISTS bureau_id UUID;
ALTER TABLE signalements_qr_coproprietes ADD COLUMN IF NOT EXISTS bureau_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_gestionnaires_bureau_fk'
                 AND conrelid = 'signalements_qr_gestionnaires'::regclass) THEN
    ALTER TABLE signalements_qr_gestionnaires ADD CONSTRAINT signalements_qr_gestionnaires_bureau_fk
      FOREIGN KEY (bureau_id, cabinet_id) REFERENCES signalements_qr_bureaux (id, cabinet_id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_copros_bureau_fk'
                 AND conrelid = 'signalements_qr_coproprietes'::regclass) THEN
    ALTER TABLE signalements_qr_coproprietes ADD CONSTRAINT signalements_qr_copros_bureau_fk
      FOREIGN KEY (bureau_id, cabinet_id) REFERENCES signalements_qr_bureaux (id, cabinet_id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signalements_qr_copros_bureau_cabinet'
                 AND conrelid = 'signalements_qr_coproprietes'::regclass) THEN
    -- Une clé étrangère composée n'est pas vérifiée quand l'une de ses colonnes est vide : sans ce contrôle, une
    -- copropriété sans cabinet pourrait porter un bureau.
    ALTER TABLE signalements_qr_coproprietes ADD CONSTRAINT signalements_qr_copros_bureau_cabinet
      CHECK (bureau_id IS NULL OR cabinet_id IS NOT NULL) NOT VALID;
  END IF;
END $$;

-- Les lignes existantes ont bureau_id vide : la validation passe.
ALTER TABLE signalements_qr_gestionnaires VALIDATE CONSTRAINT signalements_qr_gestionnaires_bureau_fk;
ALTER TABLE signalements_qr_coproprietes VALIDATE CONSTRAINT signalements_qr_copros_bureau_fk;
ALTER TABLE signalements_qr_coproprietes VALIDATE CONSTRAINT signalements_qr_copros_bureau_cabinet;

CREATE INDEX IF NOT EXISTS idx_signalements_qr_gestionnaires_bureau
  ON signalements_qr_gestionnaires (bureau_id) WHERE bureau_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_signalements_qr_copros_bureau
  ON signalements_qr_coproprietes (bureau_id) WHERE bureau_id IS NOT NULL;
COMMENT ON COLUMN signalements_qr_gestionnaires.bureau_id IS 'Bureau de la fiche, dans son cabinet ; obligatoire pour une NOUVELLE fiche dès que le cabinet a un bureau ouvert ; vide permis pour les fiches existantes (à compléter) ; se change, ne se retire pas.';
COMMENT ON COLUMN signalements_qr_coproprietes.bureau_id IS 'Bureau de la copropriété, dans son cabinet, posé par le super admin ; facultatif ; jamais sans cabinet. Ne change ni la visibilité ni les destinataires.';

-- ── 3. Règles posées par la base (fonctions de trigger) ──
-- Fiche gestionnaire. Nouvelle fiche sans bureau : refusée dès que son cabinet a un bureau OUVERT (choix 2) ;
-- une fiche existante ne passe jamais par l'insertion (rien ne la bloque). Fiche qui a un bureau : il se change, il ne se
-- retire pas. Bureau fermé : refusé pour un nouveau rattachement, et pour une réactivation (actif faux → vrai, bureau
-- inchangé : la fermeture ne compte que les fiches actives, une réactivation la contournerait) ; le bureau est verrouillé
-- (FOR SHARE) jusqu'à la fin de la transaction : une fermeture concurrente attend, puis voit ce rattachement
-- (bureau_utilise).
CREATE OR REPLACE FUNCTION signalements_qr_bureau_du_gestionnaire() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_ferme timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.bureau_id IS NOT DISTINCT FROM OLD.bureau_id THEN
    -- Bureau inchangé : seule une réactivation dans un bureau est contrôlée (fermé : bureau_ferme, plus bas).
    IF NEW.bureau_id IS NULL OR NOT NEW.actif OR OLD.actif THEN
      RETURN NEW;
    END IF;
  ELSIF NEW.bureau_id IS NULL THEN
    IF TG_OP = 'UPDATE' OR EXISTS (SELECT 1 FROM signalements_qr_bureaux b
                                    WHERE b.cabinet_id = NEW.cabinet_id AND b.ferme_le IS NULL) THEN
      RAISE EXCEPTION 'bureau_requis' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  -- Bureau inconnu ou d'un autre cabinet : la clé étrangère composée le refuse ensuite (23503).
  SELECT b.ferme_le INTO v_ferme FROM signalements_qr_bureaux b WHERE b.id = NEW.bureau_id FOR SHARE;
  IF v_ferme IS NOT NULL THEN
    RAISE EXCEPTION 'bureau_ferme' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $fn$;

-- Copropriété : bureau facultatif ; seuls le rattachement à un bureau fermé et la réactivation d'une copropriété restée
-- dans un bureau fermé sont refusés (même verrou que la fiche).
CREATE OR REPLACE FUNCTION signalements_qr_bureau_de_la_copropriete() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_ferme timestamptz;
BEGIN
  IF NEW.bureau_id IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.bureau_id IS NOT DISTINCT FROM OLD.bureau_id AND (NOT NEW.actif OR OLD.actif)) THEN
    RETURN NEW;
  END IF;
  SELECT b.ferme_le INTO v_ferme FROM signalements_qr_bureaux b WHERE b.id = NEW.bureau_id FOR SHARE;
  IF v_ferme IS NOT NULL THEN
    RAISE EXCEPTION 'bureau_ferme' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $fn$;

-- ── 4. Fonctions appelées par les routes (clé service), chacune en une transaction avec son journal ──

-- Création (p_bureau NULL) ou renommage d'un bureau (route du super admin). Nom rogné, 1 à 80 caractères, sans caractère
-- de contrôle (22023 sinon) ; nom déjà porté par un autre bureau du cabinet, fermé compris, à la casse près : nom_pris ;
-- 100 bureaux par cabinet au plus : plafond_bureaux ; cabinet inconnu, ou bureau inconnu dans ce cabinet : a_reverifier.
-- Même nom exactement : rien n'est écrit ni journalisé (modifie = false). Les écritures des bureaux d'un cabinet passent
-- l'une après l'autre (verrou de transaction) : le nom unique et le plafond tiennent sous la concurrence.
CREATE OR REPLACE FUNCTION signalements_qr_enregistrer_bureau(
  p_cabinet uuid, p_bureau uuid, p_nom text, p_acteur uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_nom    text := btrim(p_nom);
  v_id     uuid := p_bureau;
  v_avant  text;
BEGIN
  IF p_cabinet IS NULL OR p_acteur IS NULL OR v_nom IS NULL OR char_length(v_nom) NOT BETWEEN 1 AND 80
     OR v_nom ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM signalements_qr_cabinets k WHERE k.id = p_cabinet FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('signalements_qr_bureaux:' || p_cabinet::text, 0));
  IF p_bureau IS NOT NULL THEN
    SELECT b.nom INTO v_avant FROM signalements_qr_bureaux b WHERE b.id = p_bureau AND b.cabinet_id = p_cabinet FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
    END IF;
    IF v_avant = v_nom THEN
      RETURN jsonb_build_object('id', p_bureau, 'cree', false, 'modifie', false);
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM signalements_qr_bureaux b
              WHERE b.cabinet_id = p_cabinet AND lower(btrim(b.nom)) = lower(v_nom) AND b.id IS DISTINCT FROM p_bureau) THEN
    RAISE EXCEPTION 'nom_pris' USING ERRCODE = 'P0001';
  END IF;
  IF p_bureau IS NULL THEN
    IF (SELECT count(*) FROM signalements_qr_bureaux b WHERE b.cabinet_id = p_cabinet) >= 100 THEN
      RAISE EXCEPTION 'plafond_bureaux' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO signalements_qr_bureaux (cabinet_id, nom, cree_par)
    VALUES (p_cabinet, v_nom, p_acteur)
    RETURNING id INTO v_id;                         -- 23505 (index du nom) : écriture hors de cette fonction
  ELSE
    UPDATE signalements_qr_bureaux SET nom = v_nom WHERE id = p_bureau;
  END IF;
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, champs, details)
  VALUES (p_cabinet, p_acteur, 'super_admin', 'cabinet.modifie', ARRAY['bureaux'],
          jsonb_build_object('bureau', CASE WHEN p_bureau IS NULL THEN 'cree' ELSE 'renomme' END, 'bureauId', v_id));
  RETURN jsonb_build_object('id', v_id, 'cree', p_bureau IS NULL, 'modifie', true);
END $fn$;

-- Fermeture (p_fermer vrai) ou réouverture d'un bureau (route du super admin). Fermer un bureau auquel est encore
-- rattaché un gestionnaire actif ou une copropriété active : bureau_utilise (proposé, à valider : rattacher d'abord
-- ailleurs). Les rattachements inactifs restent, mais ne s'y réactivent plus tant qu'il est fermé (triggers, section 3).
-- Bureau inconnu : a_reverifier. Déjà dans l'état demandé : rien n'est écrit ni journalisé (modifie = false).
-- Le bureau est verrouillé (FOR UPDATE) avant le contrôle : un rattachement ou une réactivation concurrents attendent,
-- puis voient la fermeture (bureau_ferme), ou se font attendre et sont vus (bureau_utilise).
CREATE OR REPLACE FUNCTION signalements_qr_fermer_bureau(p_bureau uuid, p_fermer boolean, p_acteur uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_cab    uuid;
  v_ferme  timestamptz;
BEGIN
  IF p_bureau IS NULL OR p_fermer IS NULL OR p_acteur IS NULL THEN
    RAISE EXCEPTION 'parametre_invalide' USING ERRCODE = '22023';
  END IF;
  SELECT b.cabinet_id, b.ferme_le INTO v_cab, v_ferme FROM signalements_qr_bureaux b WHERE b.id = p_bureau FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'a_reverifier' USING ERRCODE = 'P0001';
  END IF;
  IF p_fermer = (v_ferme IS NOT NULL) THEN
    RETURN jsonb_build_object('id', p_bureau, 'modifie', false);
  END IF;
  IF p_fermer AND (EXISTS (SELECT 1 FROM signalements_qr_gestionnaires g WHERE g.bureau_id = p_bureau AND g.actif)
                   OR EXISTS (SELECT 1 FROM signalements_qr_coproprietes c WHERE c.bureau_id = p_bureau AND c.actif)) THEN
    RAISE EXCEPTION 'bureau_utilise' USING ERRCODE = 'P0001';
  END IF;
  UPDATE signalements_qr_bureaux SET ferme_le = CASE WHEN p_fermer THEN now() END WHERE id = p_bureau;
  INSERT INTO signalements_qr_journal (cabinet_id, acteur_id, acteur_profil, action, champs, details)
  VALUES (v_cab, p_acteur, 'super_admin', 'cabinet.modifie', ARRAY['bureaux'],
          jsonb_build_object('bureau', CASE WHEN p_fermer THEN 'ferme' ELSE 'rouvert' END, 'bureauId', p_bureau));
  RETURN jsonb_build_object('id', p_bureau, 'modifie', true);
END $fn$;

-- ── 5. Création d'une fiche (route POST /api/aj-signalement/gestionnaires) ──
-- Même signature, même en-tête et même corps que la 20261112 (dernière définition, contre-vérification du 12/11
-- comprise), avec une seule différence : le bureau de la fiche (bureauId, facultatif) lu dans p_gestionnaire et inséré.
-- Les triggers de la section 3 font les contrôles (bureau_requis, bureau_ferme), la clé étrangère composée le cabinet du
-- bureau (23503). Garde contre la perte d'une correction passée : tests/migrations/signalements_qr_bureaux.test.ts
-- compare ce corps à celui de la 20261112.
CREATE OR REPLACE FUNCTION signalements_qr_inviter_gestionnaire(
  p_gestionnaire jsonb, p_invitation jsonb, p_coproprietes uuid[], p_acteur uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_id      uuid := nullif(p_gestionnaire->>'id', '')::uuid;
  v_cab     uuid := nullif(p_gestionnaire->>'cabinetId', '')::uuid;
  v_bureau  uuid := nullif(p_gestionnaire->>'bureauId', '')::uuid;   -- bureau de la fiche (19/11/2026), facultatif
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
  INSERT INTO signalements_qr_gestionnaires (id, cabinet_id, bureau_id, nom, email, domaine_force, cree_par)
  VALUES (v_id, v_cab, v_bureau, v_nom, v_email, v_force, p_acteur);   -- 23505 : existe_deja ; bureau_requis, bureau_ferme (trigger)
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

-- ── 6. Triggers (set_updated_at existe : migration 056, ou créée par 20261104_signalements_qr.sql) ──
CREATE OR REPLACE TRIGGER trg_signalements_qr_bureaux_updated_at
  BEFORE UPDATE ON signalements_qr_bureaux FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE TRIGGER trg_signalements_qr_gestionnaires_bureau
  BEFORE INSERT OR UPDATE OF bureau_id, actif ON signalements_qr_gestionnaires
  FOR EACH ROW EXECUTE FUNCTION signalements_qr_bureau_du_gestionnaire();
CREATE OR REPLACE TRIGGER trg_signalements_qr_copros_bureau
  BEFORE INSERT OR UPDATE OF bureau_id, actif ON signalements_qr_coproprietes
  FOR EACH ROW EXECUTE FUNCTION signalements_qr_bureau_de_la_copropriete();

-- ── 7. Droits : EXECUTE réservé à service_role (signatures complètes) ──
REVOKE EXECUTE ON FUNCTION signalements_qr_enregistrer_bureau(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_enregistrer_bureau(uuid, uuid, text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_fermer_bureau(uuid, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_fermer_bureau(uuid, boolean, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION signalements_qr_inviter_gestionnaire(jsonb, jsonb, uuid[], uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION signalements_qr_inviter_gestionnaire(jsonb, jsonb, uuid[], uuid) TO service_role;
-- Fonctions de trigger : jamais appelables directement (le trigger s'exécute sans ce droit).
REVOKE EXECUTE ON FUNCTION signalements_qr_bureau_du_gestionnaire() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION signalements_qr_bureau_de_la_copropriete() FROM PUBLIC, anon, authenticated;

-- ── 8. RLS sans politique et retrait des droits par défaut de Supabase ──
ALTER TABLE signalements_qr_bureaux ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON signalements_qr_bureaux FROM PUBLIC, anon, authenticated;
-- Redit pour la colonne nouvelle de la fiche (déjà retiré par la 20261111 : sans effet).
REVOKE ALL ON signalements_qr_gestionnaires FROM anon, authenticated;

-- PostgREST relit le schéma : table, colonnes et fonctions utilisables sans redémarrage.
NOTIFY pgrst, 'reload schema';
