-- ══════════════════════════════════════════════════════════════════════════════
-- Lecture anonyme de profiles_artisan limitée aux colonnes des pages publiques (15/11/2026)
--
-- NON EXÉCUTÉE. À lancer par Frédéric (Supabase > SQL Editor > Run), APRÈS le déploiement en production du code
-- de la branche fix/fiche-publique-liens-signes : voir « Ordre de mise en production » plus bas.
--
-- Ce que fait le script :
--   1. retire au rôle anon (visiteurs sans compte, clé publique du site) la lecture de la table, d'abord sur la table
--      entière puis colonne par colonne (un droit accordé colonne par colonne survit au retrait sur la table) ;
--   2. lui rend la lecture des seules colonnes que les pages publiques affichent ou filtrent, parmi celles qui
--      existent dans la table (la liste est celle de lib/fiche-publique.ts, COLONNES_LECTURE_ANONYME ; un test
--      compare les deux) ;
--   3. vérifie le résultat : si une autre colonne restait lisible par anon (droit accordé par un autre rôle, ou à
--      PUBLIC), le script s'arrête en erreur et rien n'est changé.
-- Inchangés : la politique de lecture des lignes (fiches actives), les droits des comptes connectés
-- (authenticated) et du serveur (service_role), les écritures. Aucune ligne n'est lue ni modifiée.
-- Rejouable : relancé, il aboutit au même état.
--
-- Ordre de mise en production :
--   1. fusionner et déployer le code (les pages publiques ne demandent plus que leurs colonnes) ;
--   2. ouvrir une fiche publique et la recherche sans être connecté : elles doivent s'afficher ;
--   3. lancer ce script aussitôt après cette vérification, sans attendre ; 4. lancer le contrôle ci-dessous ;
--   5. rouvrir une fiche publique sans être connecté.
-- Un onglet resté ouvert depuis avant le déploiement garde l'ancien code : après le script, il peut afficher
-- « Artisan non trouvé » ou « Impossible de charger les artisans inscrits » jusqu'au rechargement de la page.
-- Lancé AVANT le déploiement, il casserait, pour les visiteurs sans compte, les lectures de l'ancien code qui
-- demandent toutes les colonnes : la fiche publique (« Artisan non trouvé » sur /fr/artisan, /fr/societe,
-- /pt/profissional, /pt/empresa), la recherche (message « Impossible de charger les artisans inscrits », plus
-- aucune fiche de profiles_artisan, seul le catalogue artisans_catalogue reste), la page de réservation (nom du
-- professionnel absent) et la confirmation de réservation (encart du professionnel absent).
-- Les métadonnées, le JSON-LD et le sitemap des fiches lisent déjà des colonnes de la liste : ils ne changent pas.
-- Les comptes connectés (rôle authenticated) ne sont pas concernés, ni avant ni après le déploiement.
--
-- Avant tout retour du site à une version antérieure à cette branche (annulation de la fusion, Worker précédent),
-- lancer d'abord le retour arrière ci-dessous : sinon, les pages citées plus haut casseraient de la même façon.
-- Retour arrière, si besoin : grant select on table public.profiles_artisan to anon;
--
-- Contrôle après exécution (lecture seule) : doit rendre 26 et 0.
--   select count(*) filter (where has_column_privilege('anon', 'public.profiles_artisan', column_name, 'SELECT'))
--            as colonnes_lisibles_sans_compte,
--          count(*) filter (where has_column_privilege('anon', 'public.profiles_artisan', column_name, 'SELECT')
--                            and column_name in ('kbis_url', 'id_document_verso_url', 'insurance_url',
--                                                'paiement_modes', 'kyc_status', 'kyc_score'))
--            as colonnes_privees_lisibles_sans_compte
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'profiles_artisan';
-- (26 = colonnes de la liste présentes en production au relevé du 31/10/2026.)
-- ══════════════════════════════════════════════════════════════════════════════

set local lock_timeout = '5s';

do $$
declare
  colonnes_publiques constant text[] := array[
    'active', 'bio', 'categories', 'company_address', 'company_city', 'company_name', 'company_postal_code',
    'email', 'hourly_rate', 'id', 'intervention_zones', 'language', 'latitude', 'legal_form', 'longitude',
    'naf_code', 'naf_label', 'phone', 'profile_photo_url', 'rating_avg', 'rating_count', 'siret', 'slug',
    'user_id', 'verified', 'zone_radius_km'
  ];
  toutes text;
  publiques text;
  encore_lisibles text;
begin
  if to_regclass('public.profiles_artisan') is null then
    raise notice 'Table public.profiles_artisan absente : rien à faire.';
    return;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    raise notice 'Rôle anon absent : rien à faire.';
    return;
  end if;

  select string_agg(quote_ident(attname), ', ' order by attnum)
    into toutes
    from pg_attribute
   where attrelid = 'public.profiles_artisan'::regclass and attnum > 0 and not attisdropped;

  select string_agg(quote_ident(attname), ', ' order by attnum)
    into publiques
    from pg_attribute
   where attrelid = 'public.profiles_artisan'::regclass and attnum > 0 and not attisdropped
     and attname = any (colonnes_publiques);

  execute 'revoke select on table public.profiles_artisan from anon';
  execute format('revoke select (%s) on table public.profiles_artisan from anon', toutes);
  if publiques is not null then
    execute format('grant select (%s) on table public.profiles_artisan to anon', publiques);
  end if;

  select string_agg(attname, ', ' order by attnum)
    into encore_lisibles
    from pg_attribute
   where attrelid = 'public.profiles_artisan'::regclass and attnum > 0 and not attisdropped
     and not (attname = any (colonnes_publiques))
     and has_column_privilege('anon', 'public.profiles_artisan'::regclass, attname::text, 'SELECT');
  if encore_lisibles is not null then
    raise exception 'Colonnes encore lisibles sans compte après le retrait : %. Rien n''a été changé.', encore_lisibles
      using hint = 'Un droit de lecture vient d''un autre rôle ou de PUBLIC : relever les droits de la table avant de relancer.';
  end if;
end
$$;
