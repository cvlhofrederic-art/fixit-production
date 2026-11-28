-- ══════════════════════════════════════════════════════════════════════════════
-- Droits par membre d'une équipe BTP (pro_role_permissions) : écritures réservées au serveur (25/11/2026)
--
-- Faille fermée (relecture adverse du 25/11/2026, même motif que R36 pour pro_team_members, fermé par 20261115) :
-- toute session connectée pouvait écrire elle-même dans pro_role_permissions, sans passer par l'application, sous la
-- seule condition company_id = auth.uid() (policies pro_perms_insert / update / delete de 048, reprises par
-- 20260610). Un salarié invité lit l'id de sa propre ligne d'équipe (pro_team_select le lui permet), puis insère
-- { company_id: <son propre uid>, member_id: <sa ligne>, module_id: 'settings', access_level: 'FULL' } : le serveur
-- lisait les dérogations par member_id seul et lui donnait FULL (réglages de la société, équipes et salaires,
-- chantiers, suppression comprise). Reproduit sur PGlite le 25/11/2026. Le code est corrigé dans le même lot (lecture
-- bornée à la société du membre) ; cette migration ferme l'écriture elle-même.
-- Le code n'écrit jamais cette table avec la session d'un client : invitation (POST /api/pro/team) et
-- « Enregistrer les permissions » (PATCH /api/pro/team) passent par le serveur en service role.
--
-- 1. Policies d'écriture retirées : pro_perms_insert, pro_perms_update, pro_perms_delete. La lecture
--    (pro_perms_select : le gérant voit celles de sa société, le membre les siennes) reste.
-- 2. Droits INSERT, UPDATE, DELETE et TRUNCATE retirés aux rôles anon et authenticated : une policy d'écriture
--    recréée à la main ne rouvrirait rien (TRUNCATE n'est jamais soumis à la RLS). Gardes d'existence de la table et
--    des rôles (job CI, base sans cette table). service_role garde tous ses droits et contourne la RLS.
--
-- Rien d'autre : aucune ligne insérée, modifiée ou supprimée ; aucune colonne, contrainte, index ni déclencheur touché.
-- Lignes déjà forgées éventuelles : la requête de contrôle en fin de fichier les compte (à lancer à part, lecture).
-- Retour arrière : docs/rollback-procedures.md, section « Migration 20261125b ».
--
-- À appliquer seule (éditeur SQL), par un rôle propriétaire de la table. DROP POLICY prend un verrou exclusif sur la
-- table, gardé jusqu'à la fin du script (une seule transaction) : lock_timeout évite d'attendre derrière une
-- transaction longue ; en cas d'expiration, rien n'est appliqué, relancer. Le bloc final vérifie le résultat.
-- ══════════════════════════════════════════════════════════════════════════════

set local lock_timeout = '5s';

-- 1. Policies d'écriture
DROP POLICY IF EXISTS "pro_perms_insert" ON public.pro_role_permissions;
DROP POLICY IF EXISTS "pro_perms_update" ON public.pro_role_permissions;
DROP POLICY IF EXISTS "pro_perms_delete" ON public.pro_role_permissions;

-- 2. Droits d'écriture des rôles des clients (lecture inchangée)
DO $$
BEGIN
  IF to_regclass('public.pro_role_permissions') IS NULL THEN
    RAISE NOTICE 'Équipe BTP : table public.pro_role_permissions absente, rien à retirer';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pro_role_permissions FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pro_role_permissions FROM authenticated;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')) AS r
    CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS d(droit)
    WHERE has_table_privilege(r.rolname, 'public.pro_role_permissions', d.droit)
  ) THEN
    RAISE EXCEPTION 'Équipe BTP : un droit d''écriture reste à anon ou authenticated sur pro_role_permissions, rien n''est appliqué (lancer la migration avec le rôle propriétaire de la table)';
  END IF;
END
$$;

-- Contrôle à lancer à part, en lecture : dérogations dont la société diffère de celle du membre (forgées).
-- select p.id, p.company_id, m.company_id as societe_du_membre, p.module_id, p.access_level
--   from public.pro_role_permissions p join public.pro_team_members m on m.id = p.member_id
--  where p.company_id <> m.company_id;
