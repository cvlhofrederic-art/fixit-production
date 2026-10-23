-- ══════════════════════════════════════════════════════════════════════════════
-- Garde des colonnes réservées au serveur sur profiles_artisan
-- (migration 20261023_garde_profiles_artisan.sql) — à lancer dans Supabase > SQL Editor.
--
-- Partie 1 : lecture seule, AVANT la migration (état réel de la production).
-- Partie 2 : APRÈS la migration ; tout se passe dans une transaction annulée
--            (rollback), aucune ligne n'est modifiée.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── Partie 1 · état de la production (lecture seule) ─────────────────────────
-- Une seule requête (l'éditeur n'affiche que le dernier résultat), qui renvoie un objet JSON :
--   policies : relevé du 23/10/2026 : « Users can insert own artisan profile » (INSERT),
--     « Anyone can view active artisan profiles » (SELECT, active = true),
--     « Users can update own artisan profile » (UPDATE, sans restriction de colonne) ;
--   triggers : relevé du 23/10/2026 : trg_profiles_artisan_updated_at seul. Un trigger BEFORE
--     qui modifie une colonne gardée pendant une écriture navigateur serait bloqué ;
--   colonnes_gardees_absentes : ignorées par le garde, rien à faire (23/10/2026 :
--     stripe_customer_id, subscription_plan, subscription_status) ;
--   fonctions_ecrivant_profiles_artisan : absentes des migrations du dépôt ; à relire si l'une
--     n'est pas SECURITY DEFINER et écrit une colonne gardée pour un appel navigateur ;
--   fiches_piegees : XSS du JSON-LD corrigée le 23/10/2026, à nettoyer (portfolio_photos
--     n'existe pas en production) ;
--   colonnes_profiles_artisan : schéma réel, différent des migrations du dépôt.

-- 1. État
select json_build_object(
  'policies', (
    select json_agg(json_build_object('nom', policyname, 'cmd', cmd, 'roles', roles, 'qual', qual, 'with_check', with_check) order by cmd, policyname)
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles_artisan'),
  'triggers', (
    select json_agg(json_build_object('nom', tgname, 'definition', pg_get_triggerdef(oid)) order by tgname)
    from pg_trigger
    where tgrelid = 'public.profiles_artisan'::regclass and not tgisinternal),
  'colonnes_gardees_absentes', (
    select json_agg(c.colonne)
    from unnest(array[
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
    ]) as c(colonne)
    where not exists (
      select 1 from pg_attribute a
      where a.attrelid = 'public.profiles_artisan'::regclass and a.attname = c.colonne and not a.attisdropped)),
  'fonctions_ecrivant_profiles_artisan', (
    select json_agg(json_build_object('schema', n.nspname, 'fonction', p.proname, 'security_definer', p.prosecdef) order by n.nspname, p.proname)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname not in ('pg_catalog', 'information_schema')
      and p.prosrc ~* '(update|insert\s+into)\s+(public\.)?"?profiles_artisan'),
  'fiches_piegees', (
    select json_agg(json_build_object('id', id, 'company_name', company_name, 'company_city', company_city))
    from public.profiles_artisan
    where company_name ~ '[<>]' or company_city ~ '[<>]' or phone ~ '[<>]'
       or categories::text ~ '[<>]' or profile_photo_url ~* '^\s*javascript:'),
  'colonnes_profiles_artisan', (
    select json_agg(attname order by attnum)
    from pg_attribute
    where attrelid = 'public.profiles_artisan'::regclass and attnum > 0 and not attisdropped)
) as etat;


-- ── Partie 2 · test du garde (après la migration, transaction annulée) ───────
-- Simule une session artisan (rôle authenticated, sub = user_id d'une fiche active : la seule
-- policy SELECT de production ne montre que les fiches actives, et un UPDATE … WHERE doit
-- voir la ligne). Attendu dans « Messages » : cinq lignes « OK ». Toute autre issue lève une erreur.

begin;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', f.user_id, 'role', 'authenticated')::text,
  true
)
from (select user_id from public.profiles_artisan where user_id is not null and active = true limit 1) as f;

set local role authenticated;

do $$
declare
  lignes int;
begin
  -- A. Colonne autorisée (écrite par le tableau de bord) : la mise à jour passe.
  update public.profiles_artisan set last_seen_at = now() where user_id = auth.uid();
  get diagnostics lignes = row_count;
  if lignes <> 1 then
    raise exception 'ÉCHEC A : % ligne(s) mise(s) à jour au lieu de 1', lignes;
  end if;
  raise notice 'OK A : last_seen_at modifiable par l''artisan';

  -- B. verified : refusé.
  begin
    update public.profiles_artisan set verified = not coalesce(verified, false) where user_id = auth.uid();
    raise exception 'ÉCHEC B : verified modifié par une session artisan';
  exception when insufficient_privilege then
    raise notice 'OK B : %', sqlerrm;
  end;

  -- C. rating_avg : refusé.
  begin
    update public.profiles_artisan set rating_avg = 5 where user_id = auth.uid() and rating_avg is distinct from 5;
    get diagnostics lignes = row_count;
    if lignes > 0 then
      raise exception 'ÉCHEC C : rating_avg modifié par une session artisan';
    end if;
    raise notice 'OK C : rating_avg déjà à 5, rien à refuser (relancer avec une autre fiche)';
  exception when insufficient_privilege then
    raise notice 'OK C : %', sqlerrm;
  end;

  -- D. subscription_tier (accès artisan_pro aux marchés) : refusé.
  begin
    update public.profiles_artisan set subscription_tier = 'artisan_pro'
    where user_id = auth.uid() and subscription_tier is distinct from 'artisan_pro';
    get diagnostics lignes = row_count;
    if lignes > 0 then
      raise exception 'ÉCHEC D : subscription_tier modifié par une session artisan';
    end if;
    raise notice 'OK D : fiche déjà artisan_pro, rien à refuser (relancer avec une autre fiche)';
  exception when insufficient_privilege then
    raise notice 'OK D : %', sqlerrm;
  end;

  -- E. Création directe d'une fiche : refusée.
  begin
    insert into public.profiles_artisan (user_id, company_name, verified)
    values (auth.uid(), 'Test garde', true);
    raise exception 'ÉCHEC E : fiche créée par une session navigateur';
  exception when insufficient_privilege then
    raise notice 'OK E : %', sqlerrm;
  end;
end
$$;

rollback;
