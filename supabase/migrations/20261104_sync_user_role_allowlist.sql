-- 20261104_sync_user_role_allowlist.sql
--
-- Resserre la liste des rôles que le trigger trg_sync_user_role recopie de raw_user_meta_data vers
-- raw_app_meta_data, pour qu'elle soit exactement celle de POST /api/auth/init-role.
-- À relire et appliquer par Frédéric.
--
-- Constat du 04/11/2026 (audit en lecture seule) :
--   - La migration 20260429_sync_user_role_to_app_metadata.sql accepte neuf rôles, dont syndic, coproprio,
--     pro_conciergerie et pro_gestionnaire. /api/auth/init-role les a retirés de sa propre liste le 10/06/2026
--     (rôles à privilèges ou dormants, attribués seulement par invitation) ; le trigger, non. raw_user_meta_data est
--     écrit par le client (supabase.auth.signUp options.data, ou updateUser) : un compte inscrit, ou sans rôle, qui y
--     met role = 'syndic' recevait app_metadata.role = 'syndic', lu comme fiable par le middleware et les routes
--     serveur (espace syndic, Administrateur judiciaire, agents IA).
--   - En production, la fonction ne contient aucune liste (pg_get_functiondef) : toute valeur de
--     user_metadata.role, super_admin compris, est recopiée quand app_metadata.role est vide. Le texte enregistré pour
--     la version 20260429 dans supabase_migrations.schema_migrations contient pourtant la liste : la fonction a été
--     redéfinie hors migrations. CREATE OR REPLACE remplace la définition en place, quelle qu'elle soit.
--   - Aucune reprise de données : en production, aucun compte portant un rôle à privilèges n'a été créé depuis le
--     29/04/2026 (comptage, sans donnée personnelle).
--
-- Liste : exactement ROLES_AUTO_ATTRIBUABLES (lib/auth/roles-auto-attribuables.ts), qu'utilise aussi
-- /api/auth/init-role. tests/securite/roles-auto-attribuables.test.ts compare la dernière définition de cette fonction
-- dans supabase/migrations/ avec ce module : modifier l'une sans l'autre fait échouer le test.
--
-- Le trigger (BEFORE INSERT OR UPDATE OF raw_user_meta_data ON auth.users) n'est pas recréé : il désigne la fonction
-- par son identifiant, que CREATE OR REPLACE conserve, de même que son propriétaire et ses droits.
-- Idempotent.

create or replace function public.sync_user_role_to_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta_role text;
  v_app_role text;
begin
  v_meta_role := new.raw_user_meta_data->>'role';
  if v_meta_role is null or v_meta_role = '' then
    return new;
  end if;

  -- SÉCURITÉ : raw_user_meta_data est choisi par le client. Seuls les rôles auto-attribuables sont recopiés ; tout
  -- autre rôle (syndic, syndic_*, coproprio, pro_conciergerie, pro_gestionnaire, super_admin, admin, ou inconnu) est
  -- ignoré, sans erreur, comme le refus 403 d'init-role.
  if v_meta_role not in ('client', 'artisan', 'particulier', 'locataire', 'pro_societe') then
    return new;
  end if;

  -- Jamais d'écrasement d'un rôle déjà posé côté serveur (invitation, réglage administrateur).
  v_app_role := new.raw_app_meta_data->>'role';
  if v_app_role is null or v_app_role = '' then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', v_meta_role);
  end if;

  return new;
end;
$$;

comment on function public.sync_user_role_to_app_metadata() is
  'Recopie raw_user_meta_data.role dans raw_app_meta_data.role, à l''insertion ou à la mise à jour, quand ce dernier
   est vide et que le rôle est auto-attribuable : client, artisan, particulier, locataire, pro_societe (liste
   ROLES_AUTO_ATTRIBUABLES de lib/auth/roles-auto-attribuables.ts, la même que /api/auth/init-role). Les rôles à
   privilèges ou dormants ne sont jamais recopiés.';

-- Fonction de trigger, jamais appelée en RPC (même règle que 070_revoke_definer_execute.sql). En dernier : la CI
-- (postgres sans les rôles Supabase anon / authenticated) s'arrête sur cette ligne, la fonction est alors déjà créée.
revoke execute on function public.sync_user_role_to_app_metadata() from public, authenticated, anon;
