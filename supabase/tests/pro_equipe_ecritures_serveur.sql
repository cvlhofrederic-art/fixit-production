-- ══════════════════════════════════════════════════════════════════════════════
-- Équipe BTP (pro_societe) : écritures réservées au serveur (suite de R36, décision VF-A-02)
-- (migration 20261115_pro_equipe_ecritures_serveur.sql) — à lancer dans Supabase > SQL Editor.
--
-- Partie 1 : lecture seule, AVANT puis APRÈS la migration (constat daté, sans donnée personnelle).
-- Partie 2 : APRÈS la migration, sur le projet de test ; un seul bloc qui finit par une erreur volontaire
--            « BILAN », donc entièrement annulé : aucune ligne n'est écrite. Il n'utilise que des comptes
--            fictifs tirés au hasard, aucune ligne existante.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── Partie 1 · état de la table (lecture seule) ─────────────────────────────────
-- Une seule requête (l'éditeur n'affiche que le dernier résultat), qui renvoie un objet JSON.
-- Avant la migration (constat du 14/11/2026) : policies_ecriture = 3 (pro_team_insert, pro_team_update,
--   pro_team_delete), anon et authenticated ont tous les droits.
-- Après la migration, attendu : policies_ecriture = 0, seule pro_team_select reste ; rls_active = true ; anon et
--   authenticated : select = true, insert, update, delete et truncate = false ; service_role : tout à true (routes
--   serveur) ; heritage et cles_etrangeres : null. Constaté en entier le 16/11/2026 vers 16:35 UTC avec cette version
--   (empreinte 37ff9137…) ; le 15/11/2026 à 17:01 UTC, avec une version précédente (voir la fin de ce commentaire).
-- Avant comme après : fonctions_ecrivant_la_table = null (aucune fonction SQL repérée qui écrit la table ; si une
--   fonction apparaît avec security_definer = false, NE PAS appliquer la migration : elle casserait cette fonction
--   pour un client). Ce null ne dispense pas de relire les fonctions_citant_la_table : toute fonction dont le corps
--   nomme la table en toutes lettres (corps entre $$ ou corps SQL standard). Attendu :
--   next_doc_number(uuid,text,integer) seule, avec security_definer = true, fonction_de_declencheur = false et
--   sql_dynamique = false (son nom et SECURITY DEFINER viennent des constats du 15/11/2026). Toute fonction de ces
--   deux listes est à relire une à une, par select pg_get_functiondef('<signature>'::regprocedure); (une requête à la
--   fois : l'éditeur n'affiche que le dernier résultat ; ne rien recopier d'un corps, qui peut contenir une clé).
--   Seule exception, next_doc_number(uuid,text,integer), dispensée si sql_dynamique = false, si elle ne figure pas
--   dans fonctions_ecrivant_la_table et si empreinte_next_doc_number (début de l'empreinte SHA-256 de son corps, qui
--   n'en dit rien d'autre) vaut celle de la dernière lecture de son corps en production notée ici. Dernière lecture :
--   16/11/2026 vers 16:35 UTC, empreinte c41e0a5b17ec ; contrôle d'autorisation (le compte lui-même, ou un membre actif
--   de la société, lu dans pro_team_members), seule écriture dans doc_sequences, sans EXECUTE ni commentaire. Si
--   l'empreinte a changé, relire son corps, puis noter ici la date et l'empreinte. sql_dynamique : vrai si le corps
--   contient le mot EXECUTE (requête construite à l'exécution). Une écriture par EXECUTE, un TRUNCATE de plusieurs
--   tables, COPY … FROM ou un commentaire entre les mots peut n'apparaître que dans fonctions_citant_la_table. Un nom
--   qui n'est pas dans le corps en toutes lettres échappe aux deux listes : nom construit, passé en paramètre
--   (arguments d'un déclencheur compris) ou écrit avec un échappement U&"…". La partie 1 montre ce qui a été posé de
--   bonne foi ; elle ne prouve pas l'absence d'une écriture cachée exprès. Règle : ne pas appliquer si une fonction
--   écrit la table, même par EXECUTE, sans être SECURITY DEFINER.
-- Après la migration, toute entrée de fonctions_citant_la_table (next_doc_number mise à part aux conditions
--   ci-dessus), de fonctions_ecrivant_la_table, de vues, d'heritage ou de cles_etrangeres est à relire et à signaler
--   avant de conclure que l'écriture est fermée, quels que soient executable_par_les_clients et security_invoker :
--   - une fonction SECURITY DEFINER exécutable par les clients écrit avec les droits de son propriétaire ;
--   - une fonction de déclencheur (fonction_de_declencheur = true) s'exécute sans que le droit EXECUTE soit vérifié,
--     dès qu'un client écrit la table ou la vue qui porte le déclencheur ; SECURITY DEFINER, elle écrit avec les
--     droits de son propriétaire ;
--   - une fonction que les clients n'exécutent pas peut être appelée par une fonction SECURITY DEFINER qui ne nomme
--     pas la table, et qui n'apparaît donc dans aucune liste ;
--   - une règle INSERT, UPDATE ou DELETE (regle_d_ecriture = true), posée sur une table ou sur une vue, même
--     security_invoker, s'exécute avec les droits de son propriétaire ;
--   - une vue sans security_invoker écrit avec les droits de son propriétaire ; une vue listée, même
--     security_invoker, peut aussi être écrite par une fonction SECURITY DEFINER qui ne nomme que la vue : chercher
--     alors les fonctions qui nomment la vue ;
--   - une vue matérialisée (type m) ne s'écrit pas, mais montre à qui peut la lire toutes les lignes de son dernier
--     rafraîchissement, sans RLS ;
--   - heritage : par une table mère (lien = parente) que les clients écrivent, ils modifient, suppriment et vident
--     les lignes de la table, sous les droits et la RLS de cette mère ; par une table partitionnée (lien = parente
--     aussi), ils peuvent en plus y insérer des lignes, routées vers la table ; dans une table fille (lien = enfant),
--     ils ajoutent des lignes que le serveur lit comme des lignes de la table ;
--   - cles_etrangeres : toutes les clés étrangères de la table, avec leurs codes d'action (a : aucune, r : restrict,
--     c : cascade, n : set null, d : set default). Une clé à action c, n ou d modifie ou supprime des lignes de la
--     table, avec les droits de son propriétaire, quand un client écrit la table référencée ; même sans action, un
--     TRUNCATE … CASCADE de la table référencée, lancé par une fonction SECURITY DEFINER qui ne nomme pas la table,
--     la vide.
--   executable_par_les_clients : vrai si anon ou authenticated peut exécuter la fonction. vues : attendu null ; elle
--   liste les vues, et les tables dont une règle, qui lisent ou écrivent la table. regles_sur_la_table (règles posées
--   sur la table elle-même) : attendu 0. declencheurs : nom et fonction appelée, sans les arguments (un webhook
--   Supabase y place ses en-têtes, parfois une clé) ; attendu : trg_pro_team_updated_at seul. droits : select, insert
--   et update sont vrais pour un droit sur la table comme sur une seule de ses colonnes. proprietaire : le rôle qui
--   doit lancer la migration (celui de l'éditeur SQL, postgres, s'il est propriétaire). Ces champs ne sortent que des
--   noms, des signatures, des codes, des booléens et une empreinte, jamais de corps, d'arguments ni de définitions,
--   sauf policies : qual et with_check, nécessaires pour vérifier la lecture qui reste (une policy ne contient
--   normalement aucune clé).
-- Le constat du 14/11/2026 (colonnes, contraintes, policies, droits sur la table) a été fait avec une autre requête ;
--   ceux du 15/11/2026, avec des versions précédentes de cette partie : vers 11:30 UTC (empreinte 2e3b8c70…, sans
--   MERGE ni schéma entre guillemets dans le motif d'écriture, sans anon dans executable_par_les_clients), puis avant
--   et après la migration, vers 16:55 et 17:01 UTC (commit 9b5bdef4, empreinte 22c178d0…). Cette dernière n'avait ni
--   fonction_de_declencheur, ni sql_dynamique, ni empreinte_next_doc_number, ni regle_d_ecriture, ni heritage, ni
--   cles_etrangeres ; elle lisait security_invoker comme texte (true ou on seulement) et les droits sur la table
--   seule ; son motif d'écriture ignorait TRUNCATE TABLE et les espaces autour du point. Ce que ses résultats
--   établissent : vues null couvre regle_d_ecriture et security_invoker ; next_doc_number, seule fonction citée, était
--   aussi la seule qui pouvait entrer dans fonctions_ecrivant_la_table avec le nouveau motif, et ses trois arguments
--   déclarés excluent une fonction de déclencheur ; le REVOKE de la migration retire aussi les droits de colonne
--   d'anon et d'authenticated. Ce qu'ils n'établissent pas : heritage ; sql_dynamique et le corps de next_doc_number
--   (d'après le dépôt seulement, elle ne fait que lire la table et n'entre pas dans fonctions_ecrivant_la_table) ; les
--   droits de colonne donnés à PUBLIC, que le REVOKE laisse et que la RLS neutralise tant qu'aucune policy d'écriture
--   n'existe ; les clés étrangères (aucune le 14/11/2026, par une autre requête). La lecture du 16/11/2026 vers
--   16:35 UTC, faite avec cette version, les établit : heritage et cles_etrangeres null, sql_dynamique false, aucun
--   droit de colonne pour anon ni authenticated, corps de next_doc_number relu (voir plus haut).

-- 1. État
select json_build_object(
  'policies', (
    select json_agg(json_build_object('nom', policyname, 'cmd', cmd, 'permissive', permissive, 'roles', roles,
                                      'qual', qual, 'with_check', with_check) order by policyname)
    from pg_policies
    where schemaname = 'public' and tablename = 'pro_team_members'),
  'policies_ecriture', (
    select count(*)
    from pg_policies
    where schemaname = 'public' and tablename = 'pro_team_members' and cmd <> 'SELECT'),
  'rls_active', (
    select relrowsecurity from pg_class where oid = 'public.pro_team_members'::regclass),
  'proprietaire', (
    select relowner::regrole::text from pg_class where oid = 'public.pro_team_members'::regclass),
  'fonctions_citant_la_table', (
    select json_agg(json_build_object('fonction', p.oid::regprocedure::text, 'security_definer', p.prosecdef,
                                      'executable_par_les_clients', has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                                                    or has_function_privilege('anon', p.oid, 'EXECUTE'),
                                      'fonction_de_declencheur', p.prorettype = 'trigger'::regtype,
                                      'sql_dynamique', coalesce(nullif(p.prosrc, ''), pg_get_function_sqlbody(p.oid))
                                                       ~* '\mexecute\M')
                    order by p.oid::regprocedure::text)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname not in ('pg_catalog', 'information_schema')
      and coalesce(nullif(p.prosrc, ''), pg_get_function_sqlbody(p.oid)) ilike '%pro_team_members%'),
  'fonctions_ecrivant_la_table', (
    select json_agg(json_build_object('fonction', p.oid::regprocedure::text, 'security_definer', p.prosecdef,
                                      'executable_par_les_clients', has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                                                    or has_function_privilege('anon', p.oid, 'EXECUTE'),
                                      'fonction_de_declencheur', p.prorettype = 'trigger'::regtype,
                                      'sql_dynamique', coalesce(nullif(p.prosrc, ''), pg_get_function_sqlbody(p.oid))
                                                       ~* '\mexecute\M')
                    order by p.oid::regprocedure::text)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname not in ('pg_catalog', 'information_schema')
      and coalesce(nullif(p.prosrc, ''), pg_get_function_sqlbody(p.oid))
          ~* '(insert\s+into|update|delete\s+from|truncate(\s+table)?|merge\s+into)\s+(only\s+)?("?public"?\s*\.\s*)?"?pro_team_members\M'),
  'empreinte_next_doc_number', (
    select left(encode(sha256(convert_to(coalesce(nullif(p.prosrc, ''), pg_get_function_sqlbody(p.oid)), 'UTF8')), 'hex'), 12)
    from pg_proc p
    where p.oid = to_regprocedure('public.next_doc_number(uuid,text,integer)')),
  'vues', (
    select json_agg(json_build_object('vue', c.oid::regclass::text, 'type', c.relkind::text,
                                      'security_invoker', coalesce((select o.option_value::boolean
                                                                    from pg_options_to_table(c.reloptions) o
                                                                    where o.option_name = 'security_invoker'), false),
                                      'regle_d_ecriture', exists (select 1 from pg_rewrite w
                                                                  where w.ev_class = c.oid and w.ev_type <> '1'))
                    order by c.oid::regclass::text)
    from pg_class c
    where c.oid <> 'public.pro_team_members'::regclass
      and c.oid in (select r.ev_class
                    from pg_depend d
                    join pg_rewrite r on r.oid = d.objid
                    where d.classid = 'pg_rewrite'::regclass
                      and d.refclassid = 'pg_class'::regclass
                      and d.refobjid = 'public.pro_team_members'::regclass)),
  'heritage', (
    select json_agg(json_build_object('table', h.rel::regclass::text, 'lien', h.lien) order by h.rel::regclass::text)
    from (select inhparent as rel, 'parente' as lien from pg_inherits where inhrelid = 'public.pro_team_members'::regclass
          union all
          select inhrelid, 'enfant' from pg_inherits where inhparent = 'public.pro_team_members'::regclass) as h),
  'regles_sur_la_table', (
    select count(*) from pg_rewrite where ev_class = 'public.pro_team_members'::regclass),
  'cles_etrangeres', (
    select json_agg(json_build_object('contrainte', conname, 'vers', confrelid::regclass::text,
                                      'suppression', confdeltype, 'mise_a_jour', confupdtype) order by conname)
    from pg_constraint
    where conrelid = 'public.pro_team_members'::regclass and contype = 'f'),
  'declencheurs', (
    select json_agg(json_build_object('nom', t.tgname, 'fonction', t.tgfoid::regprocedure::text) order by t.tgname)
    from pg_trigger t
    where t.tgrelid = 'public.pro_team_members'::regclass and not t.tgisinternal),
  'droits', (
    select json_agg(json_build_object(
             'role', r.role,
             'select', has_any_column_privilege(r.role, 'public.pro_team_members', 'SELECT'),
             'insert', has_any_column_privilege(r.role, 'public.pro_team_members', 'INSERT'),
             'update', has_any_column_privilege(r.role, 'public.pro_team_members', 'UPDATE'),
             'delete', has_table_privilege(r.role, 'public.pro_team_members', 'DELETE'),
             'truncate', has_table_privilege(r.role, 'public.pro_team_members', 'TRUNCATE')) order by r.role)
    from (values ('anon'), ('authenticated'), ('service_role')) as r(role))
) as etat;


-- ── Partie 2 · scénario (après la migration, rien n'est conservé) ───────────────
-- Un seul bloc : il simule la session d'un compte fictif (rôle authenticated, request.jwt.claims), tente chaque
-- écriture du gérant ou du compte, puis se termine TOUJOURS par une erreur volontaire : Postgres annule alors
-- tout le bloc, quoi qu'il arrive, et l'éditeur affiche le message à coup sûr.
-- Attendu : « ERROR: P0001: BILAN (tout est annulé) : 2 ok … | 3 ok … | 4 ok … | suppression ok … | 1 ok … |
--            5 ok … ».
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

  -- (2) Un compte s'inscrit lui-même dans sa propre « société » : refusé.
  begin
    insert into public.pro_team_members (company_id, user_id, email, role, is_active)
    values (auth.uid(), auth.uid(), 'soi@exemple.test', 'GERANT', true);
    raise exception 'ÉCHEC 2 : ligne créée par une session navigateur';
  exception when insufficient_privilege then
    bilan := bilan || ('2 ok : ' || sqlerrm);
  end;

  -- (3) Un gérant rattache le compte de quelqu'un d'autre à sa société : refusé.
  begin
    insert into public.pro_team_members (company_id, user_id, email, role, is_active)
    values (auth.uid(), autre, 'autre@exemple.test', 'OUVRIER', true);
    raise exception 'ÉCHEC 3 : compte d''un autre rattaché par une session navigateur';
  exception when insufficient_privilege then
    bilan := bilan || ('3 ok : ' || sqlerrm);
  end;

  -- (4) Le gérant change le rôle d'une ligne de sa société (invitation comprise), jusqu'à GERANT : refusé.
  begin
    update public.pro_team_members set role = 'GERANT' where company_id = auth.uid();
    raise exception 'ÉCHEC 4 : modification acceptée pour une session navigateur';
  exception when insufficient_privilege then
    bilan := bilan || ('4 ok : ' || sqlerrm);
  end;

  -- Suppression d'une ligne de sa société : refusée.
  begin
    delete from public.pro_team_members where company_id = auth.uid();
    raise exception 'ÉCHEC suppression : acceptée pour une session navigateur';
  exception when insufficient_privilege then
    bilan := bilan || ('suppression ok : ' || sqlerrm);
  end;

  -- (1) Un membre déplace sa propre ligne vers une autre société : refusé.
  begin
    update public.pro_team_members set company_id = autre where user_id = auth.uid();
    raise exception 'ÉCHEC 1 : déplacement accepté pour une session navigateur';
  exception when insufficient_privilege then
    bilan := bilan || ('1 ok : ' || sqlerrm);
  end;

  -- (5) Lecture de sa propre ligne : acceptée (aucune ligne pour ce compte fictif, sans erreur).
  select count(*) into lignes from public.pro_team_members where user_id = auth.uid();
  bilan := bilan || ('5 ok : lecture acceptée, ' || lignes || ' ligne');

  raise exception 'BILAN (tout est annulé) : %', array_to_string(bilan, ' | ');
end
$$;
