-- ══════════════════════════════════════════════════════════════════════════════
-- Policies RLS : retrait de conditions non fiables côté client (04/11/2026)
--
-- Retrait seul, sans policy de remplacement : pour ces opérations, le code passe déjà par
-- les routes API en service role (qui ne dépend pas des policies). Les tables, les droits
-- et l'activation de la RLS ne changent pas.
--
-- 1. syndic_team_members — syndic_team_members_member_update_self (migration 20260527).
--    Son WITH CHECK ne portait que sur user_id : cabinet_id, is_active, role et les autres
--    colonnes de la ligne n'étaient pas contraints lors d'une mise à jour par le membre.
--    Le code n'écrit jamais cette table depuis le navigateur : création, modification,
--    acceptation d'invitation et suppression passent par /api/syndic/team et
--    /api/syndic/invite (supabaseAdmin). Restent : syndic_team_members_cabinet_full_access
--    (cabinet_id = auth.uid()) et syndic_team_members_member_select (lecture de sa fiche).
--
-- 2. ref_taux, ref_taux_audit — ref_taux_admin_write, ref_taux_admin_update,
--    ref_taux_admin_delete, ref_taux_audit_admin (migration 060, réécrites par
--    20260610_rls_initplan_wrap). Elles testaient raw_user_meta_data->>'role', champ que
--    l'utilisateur peut modifier avec sa propre session (auth.updateUser) : ce n'est pas une
--    source de rôle. Les taux sont écrits par migration (061_seed_ref_taux) ; le code ne fait que
--    les lire (lib/rentabilite/ref-taux.ts, GET /api/btp). ref_taux_read est conservée ;
--    ref_taux_audit, sans policy, n'est plus accessible qu'au service role.
--
-- 3. audit_logs, documents_audit_log — audit_logs_super_admin_read (migration 042),
--    documents_audit_log_super_admin (migration 080). Leur condition lit auth.users ; une
--    policy est évaluée avec les droits de l'utilisateur qui interroge la table, et le rôle
--    authenticated n'a pas le droit SELECT sur auth.users. Aucun écran ne lit ces journaux
--    avec la session d'un super_admin : audit_logs est écrit en service role (lib/audit.ts,
--    /api/user/*), documents_audit_log par des triggers SECURITY DEFINER et lu par son
--    auteur. Restent : audit_logs_service_role_all, documents_audit_log_service et
--    documents_audit_log_owner_read (lecture de ses propres entrées, /pro/conformite).
--
-- À appliquer seul (éditeur SQL ou apply_migration). DROP POLICY prend un verrou exclusif
-- sur la table, le temps de l'instruction : lock_timeout évite d'attendre derrière une
-- transaction longue ; en cas d'expiration, rien n'est appliqué, relancer.
-- ══════════════════════════════════════════════════════════════════════════════

set local lock_timeout = '5s';

-- 1. syndic_team_members
DROP POLICY IF EXISTS "syndic_team_members_member_update_self" ON public.syndic_team_members;

-- 2. ref_taux, ref_taux_audit
DROP POLICY IF EXISTS "ref_taux_admin_write" ON public.ref_taux;
DROP POLICY IF EXISTS "ref_taux_admin_update" ON public.ref_taux;
DROP POLICY IF EXISTS "ref_taux_admin_delete" ON public.ref_taux;
DROP POLICY IF EXISTS "ref_taux_audit_admin" ON public.ref_taux_audit;

-- 3. audit_logs, documents_audit_log
DROP POLICY IF EXISTS "audit_logs_super_admin_read" ON public.audit_logs;
DROP POLICY IF EXISTS "documents_audit_log_super_admin" ON public.documents_audit_log;
