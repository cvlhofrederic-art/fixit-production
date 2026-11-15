-- ══════════════════════════════════════════════════════════════════════════════
-- Équipe syndic : rôles acceptés par la base alignés sur l'application, une adresse par cabinet
-- (15/11/2026)
--
-- Défaut 1, les rôles. Constat en production du 14/11/2026 (lecture seule, VT-A-01) : la contrainte
-- syndic_team_members_role_check n'accepte que 5 rôles, ceux du script d'origine supabase-team.sql
-- (février 2026). L'application en propose 7 (écran Équipe, POST et PATCH /api/syndic/team ; liste
-- unique : lib/syndic/equipe-contraintes.ts) : une invitation « Technicien » (syndic_technicien,
-- rôle créé le 17/05/2026) ou « Juriste » (syndic_juriste) échoue en erreur 500. La migration
-- 20260527 du dépôt en déclare 6 (sans syndic_technicien).
-- → La contrainte est reposée sous le même nom avec exactement les 7 rôles de l'application ; tout
--   rôle accepté jusqu'ici le reste (les 5 de la production, les 6 du dépôt).
--
-- Défaut 2, l'unicité de l'e-mail. Aucune contrainte d'unicité sur l'e-mail en production (constat
-- du 14/11/2026, pg_constraint ; le contrôle ci-dessous liste aussi les index uniques), alors que
-- POST /api/admin/init-team-table écrivait par un upsert sur l'e-mail : ON CONFLICT exige une
-- unicité qui corresponde à sa cible, sinon l'upsert échoue toujours (42P10). L'index unique
-- partiel du dépôt (syndic_team_members_email_unique_idx, WHERE email IS NOT NULL) ne lui
-- convenait pas non plus : un index partiel n'est retenu par ON CONFLICT que si la requête répète
-- son prédicat, ce que PostgREST ne fait pas.
-- → Unicité (cabinet_id, email), contrainte syndic_team_members_cabinet_id_email_key : la règle que
--   POST /api/syndic/team vérifie déjà avant d'inviter (« Cet email est déjà membre de votre
--   équipe »), et celle de pro_team_members en production. init-team-table vise désormais ce
--   couple, sans jamais réécrire une ligne existante (ON CONFLICT DO NOTHING). Plusieurs lignes
--   sans e-mail restent possibles (NULL distincts). Une même adresse reste possible dans deux
--   cabinets, comme aujourd'hui en production : l'interdire refuserait des invitations que
--   l'application accepte ; décision laissée à Frédéric.
--
-- Rien d'autre : aucune ligne insérée, modifiée ou supprimée ; aucune colonne, valeur par défaut,
-- policy, droit ni déclencheur touché. Si une ligne porte un rôle hors des 7, ou si une adresse
-- figure deux fois dans un même cabinet, la migration s'arrête sur un message et n'applique rien :
-- ces lignes sont à examiner avec Frédéric, jamais corrigées par une migration. Indépendante de T20
-- (20261114_syndic_equipe_ecritures_serveur.sql, policies et droits) : jouable avant ou après elle.
--
-- À appliquer seule (éditeur SQL), par le rôle propriétaire de la table (postgres). Un seul bloc :
-- tout ou rien. Le verrou exclusif sur la table est attendu au plus 5 s (lock_timeout) ; en cas
-- d'expiration, rien n'est appliqué : relancer. Rejouable : une seconde passe ne change rien.
-- Contrôle avant et après : supabase/tests/syndic_equipe_roles_unicite.sql (lecture seule).
-- Retour arrière (un seul bloc exécutable, tout ou rien) : docs/rollback-procedures.md, section
-- « Migration 20261115 — Équipe syndic : rôles et unicité de l'adresse par cabinet ».
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  table_equipe constant regclass := to_regclass('public.syndic_team_members');
  roles_hors_liste text;
  doublons integer;
  controles_role integer;
BEGIN
  -- Base sans la table : rien à faire.
  IF table_equipe IS NULL THEN
    RAISE NOTICE 'Équipe syndic : table public.syndic_team_members absente, rien à faire';
    RETURN;
  END IF;

  -- Verrou d'abord (lock_timeout local à la transaction du bloc) : contrôles et changements voient le même état.
  PERFORM set_config('lock_timeout', '5s', true);
  LOCK TABLE public.syndic_team_members IN ACCESS EXCLUSIVE MODE;

  -- 1. Lignes existantes : rien n'est appliqué si l'une s'oppose à la nouvelle contrainte ou à l'unicité.
  SELECT string_agg(format('%L (%s)', left(r.role, 60), r.nb), ', ' ORDER BY r.role) INTO roles_hors_liste
  FROM (
    SELECT role, count(*) AS nb
    FROM public.syndic_team_members
    WHERE role NOT IN ('syndic_admin', 'syndic_tech', 'syndic_technicien', 'syndic_secretaire',
                       'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste')
    GROUP BY role
  ) AS r;
  IF roles_hors_liste IS NOT NULL THEN
    RAISE EXCEPTION 'Équipe syndic : rôle hors des 7 de l''application sur des lignes existantes : %. Rien n''est appliqué ; examiner ces lignes avec Frédéric.', roles_hors_liste;
  END IF;

  SELECT count(*) INTO doublons
  FROM (
    SELECT 1
    FROM public.syndic_team_members
    WHERE email IS NOT NULL
    GROUP BY cabinet_id, email
    HAVING count(*) > 1
  ) AS d;
  IF doublons > 0 THEN
    RAISE EXCEPTION 'Équipe syndic : % adresse(s) en double dans un même cabinet. Rien n''est appliqué ; examiner ces lignes avec Frédéric.', doublons;
  END IF;

  -- 2. Rôles : la contrainte reposée sous son nom, avec les 7 rôles de l'application.
  ALTER TABLE public.syndic_team_members DROP CONSTRAINT IF EXISTS syndic_team_members_role_check;
  ALTER TABLE public.syndic_team_members ADD CONSTRAINT syndic_team_members_role_check
    CHECK (role IN ('syndic_admin', 'syndic_tech', 'syndic_technicien', 'syndic_secretaire',
                    'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste'));

  -- 3. Une adresse par cabinet (ADD CONSTRAINT n'a pas de IF NOT EXISTS : présence vérifiée par le nom).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = table_equipe AND conname = 'syndic_team_members_cabinet_id_email_key'
  ) THEN
    ALTER TABLE public.syndic_team_members
      ADD CONSTRAINT syndic_team_members_cabinet_id_email_key UNIQUE (cabinet_id, email);
  END IF;

  -- 4. Contrôle du résultat : sinon erreur, et rien n'est appliqué.
  SELECT count(*) INTO controles_role
  FROM pg_constraint c
  WHERE c.conrelid = table_equipe
    AND c.contype = 'c'
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey) AND a.attname = 'role'
    );
  IF controles_role <> 1 THEN
    RAISE EXCEPTION 'Équipe syndic : % contraintes CHECK portent sur role (une seule attendue, syndic_team_members_role_check) ; une autre refuserait encore des rôles de l''application. Rien n''est appliqué.', controles_role;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = table_equipe
      AND c.contype = 'u'
      AND c.conname = 'syndic_team_members_cabinet_id_email_key'
      AND ARRAY(
            SELECT a.attname::text FROM pg_attribute a
            WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
            ORDER BY a.attname
          ) = ARRAY['cabinet_id', 'email']
  ) THEN
    RAISE EXCEPTION 'Équipe syndic : la contrainte syndic_team_members_cabinet_id_email_key existe mais ne porte pas sur (cabinet_id, email). Rien n''est appliqué.';
  END IF;
END
$$;
