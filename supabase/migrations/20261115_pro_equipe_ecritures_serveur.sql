-- ══════════════════════════════════════════════════════════════════════════════
-- Équipe BTP (pro_societe) : écritures réservées au serveur (suite de R36, décision VF-A-02 ; 15/11/2026)
--
-- Faille fermée (R36, risque élevé, antérieure à la téléphonie et indépendante d'elle ; même motif que
-- syndic_team_members, fermé par T20) : toute session connectée pouvait écrire elle-même dans pro_team_members,
-- sans passer par l'application, sous la seule condition company_id = auth.uid(). Un compte pouvait ainsi :
--   - rattacher le compte de quelqu'un d'autre (user_id) à sa propre « société » : resolveCompanyId lit cette
--     table, et PATCH /api/pro/team écrivait alors company_id (et pro_team_role lors d'un changement de rôle) dans
--     l'app_metadata de ce compte : le gérant d'une autre société perdait ses droits de gérant (corrigé dans la même
--     PR) ;
--   - changer le rôle d'une invitation déjà envoyée, jusqu'à GERANT (la contrainte du rôle l'admet) ;
--   - créer, modifier ou supprimer des lignes dans sa propre « société » hors de l'application.
-- Le code n'écrit jamais cette table avec la session d'un client : invitation, acceptation, modification,
-- suppression et création du gérant passent par des routes serveur en service role (/api/pro/team,
-- /api/pro/invite, /api/pro/team/auto-init-gerant, /api/auth/create-profile, lib/equipe/invitation-serveur.ts),
-- que cette migration ne touche pas. Constat en production du 14/11/2026 (lecture seule) : aucune requête des
-- rôles anon ou authenticated sur cette table depuis le 06/02/2026.
--
-- 1. Policies d'écriture du gérant retirées : pro_team_insert, pro_team_update, pro_team_delete (048, reprises
--    par 20260610 ; mêmes noms et même forme en production, constatées le 14/11/2026). Aucune policy n'est créée
--    ni modifiée. La lecture reste (pro_team_select : chaque membre voit sa ligne, le gérant celles de sa
--    société) : la policy pro_perms_select de pro_role_permissions s'appuie sur elle. next_doc_number (SECURITY
--    DEFINER) ne fait que lire la table.
-- 2. Droits INSERT, UPDATE, DELETE et TRUNCATE retirés aux rôles anon et authenticated sur cette table : une
--    policy d'écriture recréée à la main ne rouvrirait rien (TRUNCATE n'est jamais soumis à la RLS). Garde
--    d'existence de la table et des rôles, pour que la migration passe aussi dans le job CI, où les rôles
--    n'existent pas, et sur une base sans cette table. Lecture (SELECT) inchangée. service_role (routes serveur)
--    garde tous ses droits et contourne la RLS.
--
-- Rien d'autre : aucune ligne insérée, modifiée ou supprimée ; aucune colonne, contrainte, index ni déclencheur
-- touché ; pro_role_permissions, pro_team_audit_log et syndic_team_members hors du lot.
-- Contrôle sur une vraie base : supabase/tests/pro_equipe_ecritures_serveur.sql.
-- Retour arrière : docs/rollback-procedures.md, section « Migration 20261115 — Équipe BTP ».
--
-- À appliquer seule (éditeur SQL), par un rôle propriétaire de la table. DROP POLICY prend un verrou exclusif sur
-- la table, gardé jusqu'à la fin du script (une seule transaction) : lock_timeout évite d'attendre derrière une
-- transaction longue ; en cas d'expiration, rien n'est appliqué, relancer. Le bloc final vérifie le résultat : si
-- un droit d'écriture reste à anon ou authenticated (rôle exécutant non propriétaire, par exemple), il lève une
-- erreur et rien n'est appliqué.
-- ══════════════════════════════════════════════════════════════════════════════

set local lock_timeout = '5s';

-- 1. Policies d'écriture du gérant
DROP POLICY IF EXISTS "pro_team_insert" ON public.pro_team_members;
DROP POLICY IF EXISTS "pro_team_update" ON public.pro_team_members;
DROP POLICY IF EXISTS "pro_team_delete" ON public.pro_team_members;

-- 2. Droits d'écriture des rôles des clients (lecture inchangée)
DO $$
BEGIN
  -- Base où la table n'existe pas (REVOKE y échouerait, 42P01) : rien à retirer.
  IF to_regclass('public.pro_team_members') IS NULL THEN
    RAISE NOTICE 'Équipe BTP : table public.pro_team_members absente, rien à retirer';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pro_team_members FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pro_team_members FROM authenticated;
  END IF;

  -- Contrôle du résultat, sur les seuls rôles qui existent.
  IF EXISTS (
    SELECT 1
    FROM (SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')) AS r
    CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS d(droit)
    WHERE has_table_privilege(r.rolname, 'public.pro_team_members', d.droit)
  ) THEN
    RAISE EXCEPTION 'Équipe BTP : un droit d''écriture reste à anon ou authenticated sur pro_team_members, rien n''est appliqué (lancer la migration avec le rôle propriétaire de la table)';
  END IF;
END
$$;
