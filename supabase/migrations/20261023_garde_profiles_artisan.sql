-- ══════════════════════════════════════════════════════════════════════════════
-- Garde des colonnes réservées au serveur sur profiles_artisan (23/10/2026)
--
-- La policy profiles_artisan_owner_update (migration 041, USING user_id = auth.uid())
-- ne restreint aucune colonne : avec sa session, un artisan peut appeler l'API Supabase
-- directement et passer verified, rating_avg, subscription_*, kyc_*… à la valeur de son
-- choix. De même, profiles_artisan_owner_insert (WITH CHECK user_id = auth.uid()) laisse
-- tout compte connecté, client compris, créer une fiche artisan déjà « vérifiée ».
--
-- Pour les rôles navigateur (anon, authenticated), le trigger refuse :
--   - toute création de fiche : le code les crée par /api/auth/create-profile et
--     /api/pro/register/finalize*, en service role ;
--   - toute modification d'une colonne de colonnes_serveur.
-- Les routes API (service_role), l'éditeur SQL (postgres) et les fonctions SECURITY
-- DEFINER passent : seul current_user compte, le rôle que PostgREST prend pour la requête.
--
-- Écritures navigateur relevées dans le code le 23/10/2026, aucune sur une colonne gardée :
-- auto_accept, referral_notifications_enabled, last_seen_at, company_name, phone,
-- auto_reply_message, auto_block_duration_minutes, zone_radius_km ; route
-- /api/declaration-sociale (session utilisateur) : type_activite, periodicite_declaration,
-- acre_actif, acre_date_fin, declaration_configuree. Une future écriture d'une colonne
-- gardée passe par une route API en service role.
--
-- Colonnes comparées par to_jsonb : une colonne absente du schéma de production est
-- ignorée au lieu de faire échouer chaque UPDATE. Nom « aa_… » : les triggers BEFORE
-- s'exécutent par ordre alphabétique, le garde voit donc la ligne telle que le client l'a
-- envoyée, avant tout autre trigger.
--
-- À appliquer en production par Frédéric (Supabase > SQL Editor), après la partie 1 de
-- supabase/tests/garde_profiles_artisan.sql ; la partie 2 vérifie le garde ensuite.
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function public.garde_colonnes_profiles_artisan()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  colonnes_serveur constant text[] := array[
    'active', 'verified', 'rating_avg', 'rating_count',
    'subscription_plan', 'subscription_status', 'stripe_customer_id',
    'insurance_verified', 'insurance_scan_data',
    'kyc_status', 'kyc_market', 'kyc_score', 'kyc_checks', 'kyc_verified_at',
    'kyc_reviewed_at', 'kyc_reviewed_by', 'kyc_rejection_reason',
    'rc_pro_valid', 'decennale_valid', 'rge_valid', 'qualibat_valid',
    'credit_mois_gratuits', 'total_parrainages_reussis', 'referral_flagged', 'referral_code'
  ];
  nouvelle jsonb;
  ancienne jsonb;
  colonne text;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Création de fiche artisan réservée au serveur'
      using errcode = '42501';
  end if;

  nouvelle := to_jsonb(new);
  ancienne := to_jsonb(old);
  foreach colonne in array colonnes_serveur loop
    if (nouvelle -> colonne) is distinct from (ancienne -> colonne) then
      raise exception 'Colonne réservée au serveur : %', colonne
        using errcode = '42501';
    end if;
  end loop;

  return new;
end
$$;

drop trigger if exists aa_garde_colonnes_profiles_artisan on public.profiles_artisan;
create trigger aa_garde_colonnes_profiles_artisan
  before insert or update on public.profiles_artisan
  for each row execute function public.garde_colonnes_profiles_artisan();
