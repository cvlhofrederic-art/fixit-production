-- ============================================================================
-- Custom Access Token Hook — Expose app_metadata.role dans le JWT
-- ============================================================================
-- Ce hook PostgreSQL est appele par Supabase Auth a chaque emission de JWT.
-- Il copie app_metadata.role dans un claim top-level "user_role" du JWT.
--
-- Avantage : le role est lisible cote client via session.access_token
-- sans passer par user_metadata (forgeable) ni app_metadata (qui peut
-- etre filtre selon la config Supabase).
--
-- INSTALLATION :
--   1. Executer ce SQL dans Supabase Dashboard > SQL Editor
--   2. Aller dans Authentication > Hooks > Access Token (JWT)
--   3. Activer le hook et selectionner la fonction custom_access_token_hook
--
-- IMPORTANT : Tester en staging d'abord. Un hook bugge = plus personne ne
-- peut se connecter. Le hook DOIT retourner event meme en cas d'erreur.
-- ============================================================================

-- Creer le schema dedie aux hooks (convention Supabase)
CREATE SCHEMA IF NOT EXISTS auth_hooks;

-- Fonction hook
CREATE OR REPLACE FUNCTION auth_hooks.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims jsonb;
  app_role text;
BEGIN
  -- Extraire les claims existants
  claims := event->'claims';

  -- Lire le role depuis app_metadata (source de verite)
  app_role := claims->'app_metadata'->>'role';

  -- Injecter le role dans un claim top-level "user_role"
  -- Cela le rend accessible partout sans parser app_metadata
  IF app_role IS NOT NULL AND app_role != '' THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(app_role));
  ELSE
    claims := jsonb_set(claims, '{user_role}', '"user"'::jsonb);
  END IF;

  -- Retourner l'event modifie (OBLIGATOIRE — ne jamais retourner NULL)
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Permissions : seul supabase_auth_admin peut executer ce hook
REVOKE ALL ON FUNCTION auth_hooks.custom_access_token_hook(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_hooks.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- Accorder l'usage du schema
GRANT USAGE ON SCHEMA auth_hooks TO supabase_auth_admin;

-- ============================================================================
-- Verification : le hook fonctionne ?
-- ============================================================================
-- Apres installation, testez avec :
--   SELECT auth_hooks.custom_access_token_hook(
--     '{"claims": {"app_metadata": {"role": "super_admin"}}}'::jsonb
--   );
-- Resultat attendu : {"claims": {"app_metadata": {"role": "super_admin"}, "user_role": "super_admin"}}
