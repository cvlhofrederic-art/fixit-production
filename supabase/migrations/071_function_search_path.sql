-- ════════════════════════════════════════════════════════════════════════════
-- 071 — search_path explicite sur fonctions PL/pgSQL
-- ════════════════════════════════════════════════════════════════════════════
-- Contexte : Supabase Security Advisor remontait 9 warnings "Function Search Path
-- Mutable". Sans search_path explicite, un attaquant qui peut créer une fonction
-- dans un schéma autre que pg_catalog pourrait shadow une fonction système et
-- piéger l'appel.
--
-- Fix : poser search_path = pg_catalog, public sur chaque fonction concernée.
-- pg_catalog en premier garantit la résolution des fonctions Postgres natives.
-- Idempotent.

ALTER FUNCTION public.encrypt_token(token text, encryption_key text)              SET search_path = pg_catalog, public;
ALTER FUNCTION public.decrypt_token(encrypted bytea, encryption_key text)          SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_marches_updated_at()     SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_marketplace_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_coproprios_updated_at()  SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_assemblees_updated_at()  SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_resolutions_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_pro_team_updated_at()    SET search_path = pg_catalog, public;
ALTER FUNCTION public.set_updated_at()                SET search_path = pg_catalog, public;
