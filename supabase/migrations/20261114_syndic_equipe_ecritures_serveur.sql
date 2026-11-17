-- ══════════════════════════════════════════════════════════════════════════════
-- Équipe syndic : écritures réservées au serveur (T20, DT9 élargie ; 14/11/2026)
--
-- Faille fermée (R36, risque élevé, antérieure à la téléphonie et indépendante d'elle) : toute
-- session connectée pouvait écrire elle-même dans syndic_team_members, sans passer par
-- l'application, sous la seule condition cabinet_id = auth.uid(). Un compte pouvait ainsi :
--   - rattacher le compte de quelqu'un d'autre (user_id) à sa propre « équipe » : la personne
--     visée perdait l'accès à son vrai cabinet (resolveCabinetId lit cette table) ;
--   - changer le rôle d'une ligne d'invitation déjà envoyée (le rôle n'est pas signé) ;
--   - créer, modifier ou supprimer des lignes dans son propre « cabinet ».
-- Le code n'écrit jamais cette table avec la session d'un client : invitation, acceptation,
-- modification d'équipe et suppression de compte passent par des routes serveur en service role
-- (/api/syndic/team, /api/syndic/invite, lib/equipe/invitation-serveur.ts,
-- /api/user/delete-account, /api/admin/init-team-table), que cette migration ne touche pas.
-- Constat en production du 14/11/2026 (lecture seule) : aucune requête des rôles anon ou
-- authenticated sur cette table depuis le 06/02/2026.
--
-- 1. Policies d'écriture retirées, sous leurs deux jeux de noms (rejouable sur les deux bases) :
--    - dépôt : syndic_team_members_cabinet_full_access (20260527), syndic_team_cabinet_write (041) ;
--    - production (constatées le 06/11 et le 14/11/2026) : syndic_team_insert, syndic_team_update,
--      syndic_team_delete.
--    Aucune policy n'est créée ni modifiée. Les policies de lecture restent : chaque membre voit sa
--    ligne, le titulaire celles de son cabinet (syndic_team_select en production ;
--    syndic_team_members_member_select et syndic_team_cabinet_read dans le dépôt).
--    syndic_team_members_member_update_self n'est pas visée : la migration 20261104 (#649) l'a
--    retirée, et son test exige que ce retrait reste la dernière instruction qui la nomme.
-- 2. Droits INSERT, UPDATE, DELETE et TRUNCATE retirés aux rôles anon et authenticated sur cette
--    table : une policy d'écriture recréée à la main ne rouvrirait rien (TRUNCATE n'est jamais
--    soumis à la RLS). Garde d'existence de la table et des rôles, pour que la migration passe aussi
--    dans le job CI, où les rôles n'existent pas, et sur une base sans cette table. Lecture (SELECT)
--    inchangée. service_role (routes serveur) garde tous ses droits et contourne la RLS.
--
-- Rien d'autre : aucune ligne insérée, modifiée ou supprimée ; aucune colonne, contrainte, index
-- ni déclencheur touché ; pro_team_members hors du lot (même motif, correctif distinct).
-- Contrôle sur une vraie base : supabase/tests/syndic_equipe_ecritures_serveur.sql.
-- Retour arrière : docs/rollback-procedures.md, section « Migration 20261114 — Équipe syndic ».
--
-- À appliquer seule (éditeur SQL), par un rôle propriétaire de la table. DROP POLICY prend un verrou
-- exclusif sur la table, gardé jusqu'à la fin du script (une seule transaction) : lock_timeout évite
-- d'attendre derrière une transaction longue ; en cas d'expiration, rien n'est appliqué, relancer.
-- Le bloc final vérifie le résultat : si un droit d'écriture reste à anon ou authenticated (rôle
-- exécutant non propriétaire, par exemple), il lève une erreur et rien n'est appliqué.
-- ══════════════════════════════════════════════════════════════════════════════

set local lock_timeout = '5s';

-- 1. Policies d'écriture du titulaire
DROP POLICY IF EXISTS "syndic_team_members_cabinet_full_access" ON public.syndic_team_members;
DROP POLICY IF EXISTS "syndic_team_cabinet_write" ON public.syndic_team_members;
DROP POLICY IF EXISTS "syndic_team_insert" ON public.syndic_team_members;
DROP POLICY IF EXISTS "syndic_team_update" ON public.syndic_team_members;
DROP POLICY IF EXISTS "syndic_team_delete" ON public.syndic_team_members;

-- 2. Droits d'écriture des rôles des clients (lecture inchangée)
DO $$
BEGIN
  -- Base où la table n'existe pas (REVOKE y échouerait, 42P01) : rien à retirer.
  IF to_regclass('public.syndic_team_members') IS NULL THEN
    RAISE NOTICE 'T20 : table public.syndic_team_members absente, rien à retirer';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.syndic_team_members FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.syndic_team_members FROM authenticated;
  END IF;

  -- Contrôle du résultat, sur les seuls rôles qui existent.
  IF EXISTS (
    SELECT 1
    FROM (SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')) AS r
    CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS d(droit)
    WHERE has_table_privilege(r.rolname, 'public.syndic_team_members', d.droit)
  ) THEN
    RAISE EXCEPTION 'T20 : un droit d''écriture reste à anon ou authenticated sur syndic_team_members, rien n''est appliqué (lancer la migration avec le rôle propriétaire de la table)';
  END IF;
END
$$;
