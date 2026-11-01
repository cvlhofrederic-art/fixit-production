-- ══════════════════════════════════════════════════════════════════════════════
-- Garde des colonnes réservées au serveur sur profiles_artisan (23/10/2026)
--
-- En production (relevé du 23/10/2026), la policy « Users can update own artisan profile »
-- (USING auth.uid() = user_id, migration 041 : profiles_artisan_owner_update) ne restreint
-- aucune colonne : avec sa session, un artisan peut appeler l'API Supabase directement et
-- passer verified, rating_avg, subscription_tier (accès artisan_pro aux marchés), kyc_*…
-- à la valeur de son choix. De même, « Users can insert own artisan profile » (WITH CHECK
-- auth.uid() = user_id) laisse tout compte connecté, client compris, créer une fiche
-- artisan déjà « vérifiée ». Seul autre trigger : trg_profiles_artisan_updated_at.
--
-- Pour les rôles navigateur (anon, authenticated), le trigger refuse :
--   - toute création de fiche, upsert compris (le BEFORE INSERT passe avant la détection du
--     conflit) : le code les crée par /api/auth/create-profile et /api/pro/register/finalize*,
--     en service role ;
--   - toute modification d'une colonne de colonnes_serveur.
-- Les routes API (service_role), l'éditeur SQL (postgres), supabase_auth_admin et les
-- fonctions SECURITY DEFINER passent : seul current_user compte, le rôle que PostgREST prend
-- pour la requête.
--
-- Écritures navigateur relevées dans le code le 23/10/2026 (contre-vérifiées par quatre
-- relectures indépendantes), aucune sur une colonne gardée : last_seen_at, auto_accept,
-- company_name, phone, auto_reply_message, auto_block_duration_minutes, zone_radius_km, et
-- referral_notifications_enabled (colonne absente en production : déjà refusée par PostgREST).
-- Toutes les autres écritures passent par supabaseAdmin. Une future écriture d'une colonne
-- gardée passe par une route API en service role.
--
-- Colonnes comparées par to_jsonb : une colonne absente du schéma de production est
-- ignorée au lieu de faire échouer chaque UPDATE. Nom « aa_… » : les triggers BEFORE
-- s'exécutent par ordre alphabétique, le garde voit donc la ligne telle que le client l'a
-- envoyée, avant tout autre trigger.
--
-- À appliquer en production (Supabase > SQL Editor), après la partie 1 de
-- supabase/tests/garde_profiles_artisan.sql ; la partie 2 vérifie le garde ensuite.
-- CREATE TRIGGER retient les écritures sur la table le temps de prendre son verrou :
-- lock_timeout évite que le tableau de bord (last_seen_at) s'accumule derrière une
-- transaction longue ; en cas d'expiration, rien n'est appliqué, relancer.
-- ══════════════════════════════════════════════════════════════════════════════

set local lock_timeout = '5s';

create or replace function public.garde_colonnes_profiles_artisan()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  colonnes_serveur constant text[] := array[
    'active', 'verified', 'rating_avg', 'rating_count',
    'subscription_tier', 'subscription_plan', 'subscription_status', 'stripe_customer_id',
    'insurance_verified', 'insurance_scan_data',
    'kyc_status', 'kyc_market', 'kyc_score', 'kyc_checks', 'kyc_verified_at',
    'kyc_reviewed_at', 'kyc_reviewed_by', 'kyc_rejection_reason',
    'kbis_extracted', 'certidao_extracted', 'kbis_extracted_encrypted',
    'siret', 'siren', 'siret_encrypted', 'nif_encrypted', 'pii_encryption_version',
    'kbis_url', 'insurance_url', 'id_document_verso_url',
    'rc_pro_valid', 'decennale_valid', 'rge_valid', 'qualibat_valid',
    'credit_mois_gratuits', 'total_parrainages_reussis', 'referral_flagged', 'referral_code',
    'referral_parrain_id'
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
