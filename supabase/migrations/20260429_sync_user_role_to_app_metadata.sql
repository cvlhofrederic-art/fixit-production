-- 20260429_sync_user_role_to_app_metadata.sql
--
-- Sync auth.users.raw_user_meta_data.role → raw_app_meta_data.role
--
-- Pourquoi : le routing post-auth (artisan dashboard / pro dashboard / client
-- dashboard) lit raw_app_meta_data.role car c'est le seul champ NON forgeable
-- côté client (raw_user_meta_data peut être manipulé via supabase.auth.updateUser).
--
-- Bug constaté : `app/pro/register/page.tsx` appelle POST /api/auth/init-role
-- juste après supabase.auth.signUp(). Quand email confirmation est activée,
-- signUp() ne renvoie PAS de session — le call init-role part avec un Bearer
-- token vide, init-role rejette pour 401, raw_app_meta_data.role n'est jamais
-- set, l'user atterrit en client par défaut au prochain login.
--
-- Fix permanent : trigger BEFORE INSERT/UPDATE qui copie automatiquement
-- raw_user_meta_data.role → raw_app_meta_data.role si ce dernier est vide.
-- Server-side, idempotent, fonctionne quel que soit le flow d'inscription.

-- ── Function : copie role de user_metadata vers app_metadata si absent ────────
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
  -- Pas d'effet si raw_user_meta_data.role n'est pas défini
  v_meta_role := new.raw_user_meta_data->>'role';
  if v_meta_role is null or v_meta_role = '' then
    return new;
  end if;

  -- ── SÉCURITÉ : allowlist stricte (anti escalade de privilège) ────────────────
  -- raw_user_meta_data est forgeable côté client (signUp / updateUser). Sans ce
  -- filtre, un compte créé avec user_metadata.role = 'super_admin' obtiendrait
  -- app_metadata.role = 'super_admin'. On ne synchronise QUE les rôles
  -- auto-attribuables non privilégiés (liste IDENTIQUE à ALLOWED_SELF_ROLES dans
  -- app/api/auth/init-role/route.ts). Tout autre rôle (super_admin, admin,
  -- syndic_admin, ou inconnu) est ignoré silencieusement.
  if v_meta_role not in ('client', 'artisan', 'coproprio', 'locataire', 'particulier',
                         'syndic', 'pro_societe', 'pro_conciergerie', 'pro_gestionnaire') then
    return new;
  end if;

  v_app_role := new.raw_app_meta_data->>'role';

  -- Set app_metadata.role uniquement si vide (jamais d'écrasement d'un role
  -- existant — protection contre rétrogradation accidentelle d'admin par
  -- self-update du user_metadata côté client).
  if v_app_role is null or v_app_role = '' then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', v_meta_role);
  end if;

  return new;
end;
$$;

-- ── Trigger : avant chaque INSERT ou UPDATE sur auth.users ───────────────────
drop trigger if exists trg_sync_user_role on auth.users;

create trigger trg_sync_user_role
  before insert or update of raw_user_meta_data on auth.users
  for each row
  execute function public.sync_user_role_to_app_metadata();

-- ── Backfill une dernière fois (au cas où des users seraient passés entre
--    le 1er backfill manuel et le déploiement de cette migration) ────────────
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', raw_user_meta_data->>'role')
where raw_user_meta_data->>'role' in ('client', 'artisan', 'coproprio', 'locataire', 'particulier',
                                      'syndic', 'pro_societe', 'pro_conciergerie', 'pro_gestionnaire')
  and (raw_app_meta_data->>'role' is null or raw_app_meta_data->>'role' = '');

comment on function public.sync_user_role_to_app_metadata is
  'Auto-sync raw_user_meta_data.role → raw_app_meta_data.role à l''insert/update.
   Évite le bug du flow signup où init-role n''était pas appelé (session vide
   quand email confirmation activée). app_metadata est non forgeable côté client
   donc safe pour le routing dashboard.';
