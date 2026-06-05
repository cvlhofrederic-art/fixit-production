-- ════════════════════════════════════════════════════════════════════════════
-- 068 — security_invoker explicite sur les vues publiques
-- ════════════════════════════════════════════════════════════════════════════
-- Contexte : Supabase Security Advisor remontait 2 erreurs "Security Definer View"
-- pour `syndic_email_daily_report` et `v_rentabilite_chantier`. Ces vues n'ont en
-- fait pas SECURITY DEFINER, mais le linter exige `security_invoker = true` posé
-- explicitement (Postgres ≥ 15) pour ne pas tomber dans le défaut historique.
--
-- Effet : la vue s'exécute désormais avec les permissions DU USER qui query
-- (et donc soumise à sa RLS), pas celles du créateur de la vue. C'est ce qu'on
-- veut — la RLS de la table sous-jacente filtre par syndic_id / owner_id.
-- Idempotent.

ALTER VIEW IF EXISTS public.syndic_email_daily_report SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_rentabilite_chantier   SET (security_invoker = true);
