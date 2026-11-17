-- ══════════════════════════════════════════════════════════════════════════════
-- Équipe syndic : écritures réservées au serveur (T20, DT9 élargie ; scénario A23 du dossier M0)
-- (migration 20261114_syndic_equipe_ecritures_serveur.sql) — à lancer dans Supabase > SQL Editor.
--
-- Partie 1 : lecture seule, AVANT puis APRÈS la migration (constat daté, sans donnée personnelle).
-- Partie 2 : APRÈS la migration, sur le projet de test (A23) ; un seul bloc qui finit par une
--            erreur volontaire « BILAN », donc entièrement annulé : aucune ligne n'est écrite. Il
--            n'utilise que des comptes fictifs tirés au hasard, aucune ligne existante.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── Partie 1 · état de la table (lecture seule) ─────────────────────────────────
-- Une seule requête (l'éditeur n'affiche que le dernier résultat), qui renvoie un objet JSON.
-- Avant la migration (constat du 14/11/2026) : policies_ecriture = 3 (syndic_team_insert,
--   syndic_team_update, syndic_team_delete), anon et authenticated ont tous les droits.
-- Après la migration, attendu : policies_ecriture = 0, seule syndic_team_select reste (production) ;
--   rls_active = true ; anon et authenticated : select = true, insert, update, delete et
--   truncate = false ; service_role : tout à true (routes serveur) ; heritage : null ;
--   cles_etrangeres : null en production (lecture du 16/11/2026). 20260527 est un CREATE TABLE IF NOT
--   EXISTS : ses deux clés vers auth.users (cabinet_id en suppression c, user_id en suppression n)
--   n'existent que dans une base où elle a créé la table, comme l'état « dépôt » des tests d'exécution.
-- Avant comme après : fonctions_ecrivant_la_table = null (aucune fonction SQL repérée qui écrit la
--   table ; si une fonction apparaît avec security_definer = false, NE PAS appliquer la migration : elle
--   casserait cette fonction pour un client) ; fonctions_citant_la_table : toute fonction dont le corps
--   nomme la table en toutes lettres (corps entre $$ ou corps SQL standard), attendu null en production
--   (constats du 15/11/2026) ; toute fonction listée est à relire une à une avant d'appliquer, par
--   select pg_get_functiondef('<signature>'::regprocedure); (une requête à la fois : l'éditeur n'affiche que
--   le dernier résultat ; ne rien recopier d'un corps, qui peut contenir une clé). Une écriture par EXECUTE
--   dynamique, un TRUNCATE de plusieurs tables, COPY … FROM ou un commentaire entre les mots peut
--   n'apparaître que dans fonctions_citant_la_table. Un nom qui n'est pas dans le corps en toutes lettres
--   échappe aux deux listes : nom construit, passé en paramètre (arguments d'un déclencheur compris) ou écrit
--   avec un échappement U&"…" dans un corps donné en texte (entre $$, $étiquette$ ou apostrophes ; seul un
--   corps SQL standard, BEGIN ATOMIC ou RETURN …, relu résolu, montre alors le nom). Les valeurs par défaut
--   des colonnes n'y figurent pas non plus : une valeur par défaut qui appelle une fonction (qui lit, par
--   exemple, une table que les clients écrivent) change les insertions du serveur qui omettent la colonne. La
--   partie 1 montre ce qui a été posé de bonne foi ; elle ne prouve pas l'absence d'une écriture cachée
--   exprès. Règle : ne pas appliquer si une fonction écrit la table, même par EXECUTE, sans être
--   SECURITY DEFINER.
-- Après la migration, toute entrée de fonctions_citant_la_table, de fonctions_ecrivant_la_table, de vues,
--   d'heritage ou de cles_etrangeres, et tout déclencheur qui diffère de l'attendu par son nom, sa fonction,
--   son type, son état actif ou l'une de ses deux empreintes (voir declencheurs), est à relire et à
--   signaler avant de conclure que l'écriture est fermée, quels que soient executable_par_les_clients et
--   security_invoker :
--   - une fonction SECURITY DEFINER exécutable par les clients écrit avec les droits de son propriétaire ;
--   - une fonction de déclencheur (fonction_de_declencheur = true) s'exécute sans que le droit EXECUTE soit
--     vérifié, dès qu'un client écrit la table ou la vue qui porte le déclencheur ; SECURITY DEFINER, elle
--     écrit avec les droits de son propriétaire ;
--   - une fonction que les clients n'exécutent pas peut être appelée par une fonction SECURITY DEFINER qui
--     ne nomme pas la table, et qui n'apparaît donc dans aucune liste ;
--   - une règle INSERT, UPDATE ou DELETE (regle_d_ecriture = true), posée sur une table ou sur une vue,
--     même security_invoker, s'exécute avec les droits de son propriétaire ;
--   - une vue sans security_invoker écrit avec les droits de son propriétaire ; une vue listée, même
--     security_invoker, peut aussi être écrite par une fonction SECURITY DEFINER qui ne nomme que la vue :
--     chercher alors les fonctions qui nomment la vue ;
--   - une vue matérialisée (type m) ne s'écrit pas, mais montre à qui peut la lire toutes les lignes de son
--     dernier rafraîchissement, sans RLS ;
--   - heritage : par une table mère (lien = parente) que les clients écrivent, ils modifient, suppriment et
--     vident les lignes de la table, sous les droits et la RLS de cette mère ; par une table partitionnée
--     (lien = parente aussi), ils peuvent en plus y insérer des lignes, routées vers la table ; dans une
--     table fille (lien = enfant), ils ajoutent des lignes que le serveur lit comme des lignes de la table ;
--   - cles_etrangeres : toutes les clés étrangères de la table, avec leurs codes d'action (a : aucune,
--     r : restrict, c : cascade, n : set null, d : set default). Une clé à action c, n ou d modifie ou
--     supprime des lignes de la table, avec les droits de son propriétaire, quand un client écrit la table
--     référencée ; même sans action, un TRUNCATE … CASCADE de la table référencée, lancé par une fonction
--     SECURITY DEFINER qui ne nomme pas la table, la vide ;
--   - declencheurs : un déclencheur posé sur la table s'exécute à chacune des écritures qu'il vise, celles
--     du serveur comprises, et peut changer les valeurs écrites (le rôle d'une invitation, par exemple, lu
--     dans une table que les clients écrivent) sans nommer la table : il n'apparaît alors que dans
--     declencheurs ; relire sa fonction (champ fonction) par pg_get_functiondef, et le déclencheur sans ses
--     arguments (un webhook peut y placer une clé), par : select tgname, tgtype, tgenabled, tgnargs,
--     tgattr::text as colonnes, tgqual is not null as quand, regexp_replace(pg_get_triggerdef(oid),
--     'EXECUTE FUNCTION .*$', 'EXECUTE FUNCTION ' || tgfoid::regprocedure::text) as definition
--     from pg_trigger where tgrelid = 'public.syndic_team_members'::regclass and not tgisinternal;
--     Le déclencheur attendu le peut aussi sans changer de nom : fonction remplacée (CREATE OR REPLACE),
--     passée dans l'autre mode (SECURITY DEFINER ou INVOKER) ou dont le SET search_path change (un schéma
--     placé avant pg_catalog détourne now()) ; déclencheur recréé pour d'autres écritures, avec une clause
--     WHEN ou des arguments ; seuls ses empreintes, son type ou son état actif changent alors.
--   executable_par_les_clients : vrai si anon ou authenticated peut exécuter la fonction. vues : attendu
--   null ; elle liste les vues, et les tables dont une règle, qui lisent ou écrivent la table.
--   regles_sur_la_table (règles posées sur la table elle-même) : attendu 0. declencheurs : nom, fonction
--   appelée, type (pg_trigger.tgtype, somme de 1 : par ligne, 2 : BEFORE, 4 : INSERT, 8 : DELETE,
--   16 : UPDATE, 32 : TRUNCATE, 64 : INSTEAD OF), actif (O : hors du mode replica, D : désactivé, R : en
--   mode replica seulement, A : toujours), empreinte (début du SHA-256 de pg_get_functiondef : corps,
--   SECURITY DEFINER, SET, langage) et empreinte_declencheur (début du SHA-256 de pg_get_triggerdef : moment,
--   écritures, colonnes de UPDATE OF, clause WHEN et arguments, hachés sans être rendus ; un webhook Supabase
--   place ses en-têtes, parfois une clé, dans ces arguments). Le propriétaire de la fonction n'y est pas :
--   pour une fonction SECURITY DEFINER, le lire à part. Une empreinte suit le texte exact (fins de ligne du
--   corps comprises) et peut changer avec la version de PostgreSQL ; empreinte_declencheur dépend aussi du
--   search_path (pg_get_triggerdef ne qualifie le nom de la fonction que s'il n'y est pas trouvé) : un écart
--   est à relire, ce n'est pas forcément un contournement. Règle des empreintes : ne noter dans ce dépôt
--   (public) qu'une empreinte dont tout le texte haché a été relu sans clé, donc jamais celles d'un
--   déclencheur à arguments (jamais affichés), ni celle d'un corps de fonction ou d'une clause WHEN où la
--   relecture montre une clé ; ces empreintes se notent hors du dépôt (dossier d'audit privé, jamais dans un
--   fichier suivi), car 12 caractères d'empreinte d'une définition dont seul un secret court est inconnu se
--   cassent hors ligne.
--   Attendu en production (lecture du 17/11/2026 vers 12:00 UTC, PostgreSQL 17.6, éditeur SQL, search_path
--   "$user", public, extensions) : trg_team_updated_at seul, fonction update_team_updated_at(), type 19
--   (BEFORE UPDATE, par ligne, comme dans le SQL qui l'a créée : supabase-team.sql, commit 15c46477),
--   actif O, empreinte 4c078d78adb5, empreinte_declencheur abd2e2292260 (avec un autre search_path :
--   fonction public.update_team_updated_at() et empreinte_declencheur 6624b9b7c976). Relevé le même jour
--   par une requête à part, sans afficher le corps : la fonction est SECURITY DEFINER (la migration 070 le
--   signalait) avec SET search_path = '' (son now() reste celui de pg_catalog), propriétaire postgres, et
--   son corps (52 caractères, sans retour chariot) ne fait que dater la ligne et la renvoyer ; le
--   déclencheur n'a ni clause WHEN, ni colonnes, ni arguments. Ces deux empreintes se recalculent hors
--   production : 4c078d78adb5 est celle du corps d'origine (supabase-team.sql) avec SECURITY DEFINER et
--   SET search_path TO '' ; le corps de production est donc celui d'origine, octet pour octet ; l'état
--   « production » des tests d'exécution les reproduit. Toute valeur qui change est à relire (requête de
--   relecture des déclencheurs ci-dessus et pg_get_functiondef de la fonction), puis à noter avec sa date,
--   ici ou hors du dépôt selon la règle des empreintes. L'état « dépôt » des tests d'exécution montre
--   syndic_team_members_updated_at à la place. droits : select, insert et update sont vrais pour un droit sur
--   la table comme sur une seule de ses colonnes, donné au rôle ou à PUBLIC ; un droit de colonne donné à
--   PUBLIC survit au REVOKE de la migration (qui ne vise qu'anon et authenticated) et à son contrôle final
--   (droits sur la table seule) : la RLS le neutralise tant qu'aucune policy d'écriture n'existe, mais il est
--   à signaler. proprietaire : le rôle qui doit lancer la migration (celui de l'éditeur SQL, postgres, s'il
--   est propriétaire). Ces champs ne sortent que des noms, des signatures, des codes, des booléens et des
--   empreintes, jamais de corps, d'arguments ni de définitions, sauf policies : qual et with_check,
--   nécessaires pour vérifier la lecture qui reste (une policy ne contient normalement aucune clé).
-- Le constat du 14/11/2026 (droits, policies, contraintes) a été fait avec une autre requête, sans les
--   fonctions, les vues ni les règles ; ceux du 15/11/2026 (vers 09:45 et 09:55 UTC, avant et après la
--   migration), avec la version précédente de cette partie (commit 4eef6e0d) : sans vues,
--   regles_sur_la_table, executable_par_les_clients ni fonction_de_declencheur, et sans MERGE, TRUNCATE
--   TABLE ni schéma entre guillemets dans le motif d'écriture (sans effet : fonctions_citant_la_table y
--   était null) ; les vues et les règles ont été relevées à part le 15/11/2026 vers 11:30 UTC (aucune).
--   Les lectures du 15/11/2026 n'avaient ni heritage ni cles_etrangeres, ni les espaces autour du point
--   dans le motif (sans effet, même raison), et lisaient les droits sur la table seule
--   (has_table_privilege) : elles n'établissaient ni l'héritage, ni les clés étrangères, ni les droits de
--   colonne. Le 16/11/2026 vers 16:39 UTC, une requête de lecture distincte de cette partie (quatre
--   champs : heritage compté, cles_etrangeres, policies_ecriture et droits ; lecture seule, éditeur SQL,
--   lors du constat de la partie 1 du scénario BTP) a relevé : héritage 0 (pg_inherits dans les deux
--   sens), aucune clé étrangère, policies_ecriture 0, et des droits lus par has_any_column_privilege pour
--   select, insert et update (qui compte aussi un droit de colonne donné à PUBLIC), par
--   has_table_privilege pour delete et truncate : anon et authenticated, select seulement (insert,
--   update, delete et truncate à false) ; service_role, tout. Cette version de la partie 1 a été lancée
--   en production le 17/11/2026 vers 12:00 UTC (lecture seule, éditeur SQL) : policies_ecriture 0, seule
--   syndic_team_select reste (lecture du cabinet ou de soi), rls_active vrai, propriétaire postgres, ni
--   fonction citant ou écrivant la table, ni vue, ni règle, heritage et cles_etrangeres null, droits comme
--   le 16/11, declencheurs comme attendu ci-dessus.

-- 1. État
select json_build_object(
  'policies', (
    select json_agg(json_build_object('nom', policyname, 'cmd', cmd, 'permissive', permissive, 'roles', roles,
                                      'qual', qual, 'with_check', with_check) order by policyname)
    from pg_policies
    where schemaname = 'public' and tablename = 'syndic_team_members'),
  'policies_ecriture', (
    select count(*)
    from pg_policies
    where schemaname = 'public' and tablename = 'syndic_team_members' and cmd <> 'SELECT'),
  'rls_active', (
    select relrowsecurity from pg_class where oid = 'public.syndic_team_members'::regclass),
  'proprietaire', (
    select relowner::regrole::text from pg_class where oid = 'public.syndic_team_members'::regclass),
  'fonctions_citant_la_table', (
    select json_agg(json_build_object('fonction', p.oid::regprocedure::text, 'security_definer', p.prosecdef,
                                      'executable_par_les_clients', has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                                                    or has_function_privilege('anon', p.oid, 'EXECUTE'),
                                      'fonction_de_declencheur', p.prorettype = 'trigger'::regtype)
                    order by p.oid::regprocedure::text)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname not in ('pg_catalog', 'information_schema')
      and coalesce(nullif(p.prosrc, ''), pg_get_function_sqlbody(p.oid)) ilike '%syndic_team_members%'),
  'fonctions_ecrivant_la_table', (
    select json_agg(json_build_object('fonction', p.oid::regprocedure::text, 'security_definer', p.prosecdef,
                                      'executable_par_les_clients', has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                                                    or has_function_privilege('anon', p.oid, 'EXECUTE'),
                                      'fonction_de_declencheur', p.prorettype = 'trigger'::regtype)
                    order by p.oid::regprocedure::text)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname not in ('pg_catalog', 'information_schema')
      and coalesce(nullif(p.prosrc, ''), pg_get_function_sqlbody(p.oid))
          ~* '(insert\s+into|update|delete\s+from|truncate(\s+table)?|merge\s+into)\s+(only\s+)?("?public"?\s*\.\s*)?"?syndic_team_members\M'),
  'vues', (
    select json_agg(json_build_object('vue', c.oid::regclass::text, 'type', c.relkind::text,
                                      'security_invoker', coalesce((select o.option_value::boolean
                                                                    from pg_options_to_table(c.reloptions) o
                                                                    where o.option_name = 'security_invoker'), false),
                                      'regle_d_ecriture', exists (select 1 from pg_rewrite w
                                                                  where w.ev_class = c.oid and w.ev_type <> '1'))
                    order by c.oid::regclass::text)
    from pg_class c
    where c.oid <> 'public.syndic_team_members'::regclass
      and c.oid in (select r.ev_class
                    from pg_depend d
                    join pg_rewrite r on r.oid = d.objid
                    where d.classid = 'pg_rewrite'::regclass
                      and d.refclassid = 'pg_class'::regclass
                      and d.refobjid = 'public.syndic_team_members'::regclass)),
  'regles_sur_la_table', (
    select count(*) from pg_rewrite where ev_class = 'public.syndic_team_members'::regclass),
  'declencheurs', (
    select json_agg(json_build_object(
             'nom', t.tgname, 'fonction', t.tgfoid::regprocedure::text, 'type', t.tgtype, 'actif', t.tgenabled,
             'empreinte', left(encode(sha256(convert_to(pg_get_functiondef(t.tgfoid), 'UTF8')), 'hex'), 12),
             'empreinte_declencheur', left(encode(sha256(convert_to(pg_get_triggerdef(t.oid), 'UTF8')), 'hex'), 12))
           order by t.tgname)
    from pg_trigger t
    where t.tgrelid = 'public.syndic_team_members'::regclass and not t.tgisinternal),
  'heritage', (
    select json_agg(json_build_object('table', h.rel::regclass::text, 'lien', h.lien) order by h.rel::regclass::text)
    from (select inhparent as rel, 'parente' as lien from pg_inherits where inhrelid = 'public.syndic_team_members'::regclass
          union all
          select inhrelid, 'enfant' from pg_inherits where inhparent = 'public.syndic_team_members'::regclass) as h),
  'cles_etrangeres', (
    select json_agg(json_build_object('contrainte', conname, 'vers', confrelid::regclass::text,
                                      'suppression', confdeltype, 'mise_a_jour', confupdtype) order by conname)
    from pg_constraint
    where conrelid = 'public.syndic_team_members'::regclass and contype = 'f'),
  'droits', (
    select json_agg(json_build_object(
             'role', r.role,
             'select', has_any_column_privilege(r.role, 'public.syndic_team_members', 'SELECT'),
             'insert', has_any_column_privilege(r.role, 'public.syndic_team_members', 'INSERT'),
             'update', has_any_column_privilege(r.role, 'public.syndic_team_members', 'UPDATE'),
             'delete', has_table_privilege(r.role, 'public.syndic_team_members', 'DELETE'),
             'truncate', has_table_privilege(r.role, 'public.syndic_team_members', 'TRUNCATE')) order by r.role)
    from (values ('anon'), ('authenticated'), ('service_role')) as r(role))
) as etat;


-- ── Partie 2 · scénario A23 (après la migration, rien n'est conservé) ────────────
-- Un seul bloc : il simule la session d'un compte fictif (rôle authenticated, request.jwt.claims),
-- tente chaque écriture du titulaire ou du compte, puis se termine TOUJOURS par une erreur
-- volontaire : Postgres annule alors tout le bloc, quoi qu'il arrive, et l'éditeur affiche le
-- message à coup sûr.
-- Attendu : « ERROR: P0001: BILAN (tout est annulé) : 2 ok … | 3 ok … | 4 ok … | suppression ok … |
--            1 ok … | 5 ok … ».
-- Un « ÉCHEC … » ou toute autre erreur signale un problème (rien n'est conservé non plus).

-- 2. Test
do $$
declare
  soi uuid := gen_random_uuid();
  autre uuid := gen_random_uuid();
  lignes int;
  bilan text[] := '{}';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', soi, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- (2) Un compte s'inscrit lui-même dans son propre « cabinet » : refusé.
  begin
    insert into public.syndic_team_members (cabinet_id, user_id, is_active) values (auth.uid(), auth.uid(), true);
    raise exception 'ÉCHEC 2 : ligne créée par une session navigateur';
  exception when insufficient_privilege then
    bilan := bilan || ('2 ok : ' || sqlerrm);
  end;

  -- (3) Un titulaire rattache le compte de quelqu'un d'autre à son équipe : refusé.
  begin
    insert into public.syndic_team_members (cabinet_id, user_id, role, is_active)
    values (auth.uid(), autre, 'syndic_admin', true);
    raise exception 'ÉCHEC 3 : compte d''un autre rattaché par une session navigateur';
  exception when insufficient_privilege then
    bilan := bilan || ('3 ok : ' || sqlerrm);
  end;

  -- (4) Le titulaire change le rôle d'une ligne de son cabinet (invitation comprise) : refusé.
  begin
    update public.syndic_team_members set role = 'syndic_admin' where cabinet_id = auth.uid();
    raise exception 'ÉCHEC 4 : modification acceptée pour une session navigateur';
  exception when insufficient_privilege then
    bilan := bilan || ('4 ok : ' || sqlerrm);
  end;

  -- Suppression d'une ligne de son cabinet : refusée.
  begin
    delete from public.syndic_team_members where cabinet_id = auth.uid();
    raise exception 'ÉCHEC suppression : acceptée pour une session navigateur';
  exception when insufficient_privilege then
    bilan := bilan || ('suppression ok : ' || sqlerrm);
  end;

  -- (1) Un membre déplace sa propre ligne vers un autre cabinet : refusé (déjà fermé par #649).
  begin
    update public.syndic_team_members set cabinet_id = autre where user_id = auth.uid();
    raise exception 'ÉCHEC 1 : déplacement accepté pour une session navigateur';
  exception when insufficient_privilege then
    bilan := bilan || ('1 ok : ' || sqlerrm);
  end;

  -- (5) Lecture de sa propre ligne : acceptée (aucune ligne pour ce compte fictif, sans erreur).
  select count(*) into lignes from public.syndic_team_members where user_id = auth.uid();
  bilan := bilan || ('5 ok : lecture acceptée, ' || lignes || ' ligne');

  raise exception 'BILAN (tout est annulé) : %', array_to_string(bilan, ' | ');
end
$$;
