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
--   serveur) ; heritage et cles_etrangeres : null ; declencheurs : voir plus bas. Constaté en entier le 17/11/2026 vers
--   15:41 UTC avec cette version-ci (empreinte ff0cd741…), où declencheurs rend aussi le type, l'état actif et deux
--   empreintes : tout à l'attendu ; le 16/11/2026 vers 16:35 UTC avec la version précédente de cette partie (empreinte
--   37ff9137…, dont declencheurs ne rendait que le nom et la fonction) ; le 15/11/2026 à 17:01 UTC, avec une version
--   plus ancienne (voir la fin de ce commentaire).
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
--   l'empreinte a changé, relire son corps, puis noter la date et l'empreinte, ici ou hors du dépôt (règle des
--   empreintes : voir declencheurs). sql_dynamique : vrai si le corps contient le mot EXECUTE (requête construite à
--   l'exécution). Une écriture par EXECUTE, un TRUNCATE de plusieurs tables, COPY … FROM ou un commentaire entre les
--   mots peut n'apparaître que dans fonctions_citant_la_table. Un nom qui n'est pas dans le corps en toutes lettres
--   échappe aux deux listes : nom construit, passé en paramètre (arguments d'un déclencheur compris) ou écrit avec un
--   échappement U&"…" dans un corps donné en texte (entre $$, $étiquette$ ou apostrophes ; seul un corps SQL standard,
--   BEGIN ATOMIC ou RETURN …, relu résolu, montre alors le nom). Les valeurs par défaut des colonnes n'y figurent pas
--   non plus : une valeur par défaut qui appelle une fonction (qui lit, par exemple, une table que les clients
--   écrivent) change les insertions du serveur qui omettent la colonne. La partie 1 montre ce qui a été posé de bonne
--   foi ; elle ne prouve pas l'absence d'une écriture cachée exprès. Règle : ne pas appliquer si une fonction écrit la
--   table, même par EXECUTE, sans être SECURITY DEFINER.
-- Après la migration, toute entrée de fonctions_citant_la_table (next_doc_number mise à part aux conditions
--   ci-dessus), de fonctions_ecrivant_la_table, de vues, d'heritage ou de cles_etrangeres, et tout déclencheur qui
--   diffère de l'attendu par son nom, sa fonction, son type, son état actif ou l'une de ses deux empreintes (voir
--   declencheurs), est à relire et à signaler avant de conclure que l'écriture est fermée, quels que soient
--   executable_par_les_clients et security_invoker :
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
--     la vide ;
--   - declencheurs : un déclencheur posé sur la table s'exécute à chacune des écritures qu'il vise, celles du serveur
--     comprises, et peut changer les valeurs écrites (le rôle d'une invitation, par exemple, lu dans une table que les
--     clients écrivent) sans nommer la table : il n'apparaît alors que dans declencheurs ; relire sa fonction (champ
--     fonction) par select pg_get_functiondef('<signature>'::regprocedure); et sa définition sans ses arguments
--     (pg_get_triggerdef seul les affiche en clair, clé d'un webhook comprise) par cette requête, en une fois :
--     select tgname, tgtype, tgenabled, tgnargs, tgattr::text as colonnes, tgqual is not null as quand,
--            regexp_replace(pg_get_triggerdef(oid), 'EXECUTE FUNCTION .*$',
--                           'EXECUTE FUNCTION ' || tgfoid::regprocedure::text) as definition
--     from pg_trigger where tgrelid = 'public.pro_team_members'::regclass and not tgisinternal;
--     Le déclencheur attendu le peut aussi sans changer de nom : fonction remplacée (CREATE OR REPLACE), passée dans
--     l'autre mode (SECURITY DEFINER ou INVOKER) ou dont le SET search_path change (un schéma placé avant pg_catalog
--     détourne now()) ; déclencheur recréé pour d'autres écritures, avec une clause WHEN ou des arguments ; seuls ses
--     empreintes, son type ou son état actif changent alors.
--   executable_par_les_clients : vrai si anon ou authenticated peut exécuter la fonction. vues : attendu null ; elle
--   liste les vues, et les tables dont une règle, qui lisent ou écrivent la table. regles_sur_la_table (règles posées
--   sur la table elle-même) : attendu 0. declencheurs : nom, fonction appelée, type (pg_trigger.tgtype, somme de
--   1 : par ligne, 2 : BEFORE, 4 : INSERT, 8 : DELETE, 16 : UPDATE, 32 : TRUNCATE, 64 : INSTEAD OF), actif (O : hors
--   du mode replica, D : désactivé, R : en mode replica seulement, A : toujours), empreinte (début du SHA-256 de
--   pg_get_functiondef : corps, SECURITY DEFINER, SET, langage) et empreinte_declencheur (début du SHA-256 de
--   pg_get_triggerdef : moment, écritures, colonnes de UPDATE OF, clause WHEN et arguments, hachés sans être rendus ;
--   un webhook Supabase place ses en-têtes, parfois une clé, dans ces arguments). Le propriétaire de la fonction n'y
--   est pas : pour une fonction SECURITY DEFINER, le lire à part. Une empreinte suit le texte exact (fins de ligne du
--   corps comprises) et peut changer avec la version de PostgreSQL : un écart est à relire, ce n'est pas forcément un
--   contournement. empreinte_declencheur dépend aussi du search_path de la session : pg_get_triggerdef, comme le champ
--   fonction, ne qualifie le nom de la fonction que s'il n'y est pas trouvé. Règle des empreintes : ne noter dans ce
--   fichier (dépôt public) qu'une empreinte dont tout le texte haché a été relu sans clé, donc jamais celles d'un
--   déclencheur à arguments (jamais affichés), ni celle d'un corps de fonction ou d'une clause WHEN où la relecture
--   montre une clé ; ces empreintes se notent hors du dépôt (dossier d'audit privé, jamais dans un fichier suivi), car
--   48 bits d'empreinte d'une définition dont seul un secret court est inconnu se cassent hors ligne. Attendu en
--   production, avec le search_path de l'éditeur SQL ("$user", public, extensions) :
--   trg_pro_team_updated_at seul, fonction update_pro_team_updated_at(), type 19 (BEFORE UPDATE, par ligne, comme dans
--   la migration 048 qui l'a créé), actif O, empreinte 40588a5266ec, empreinte_declencheur cabcbdb0ce56 ; avec un
--   search_path sans public, fonction vaut public.update_pro_team_updated_at() et empreinte_declencheur 19562976bb04
--   (recalculée hors ligne). Ces valeurs viennent d'une requête à part, de même calcul, lancée en production le
--   17/11/2026 vers 12:00 UTC (lecture seule, éditeur SQL, PostgreSQL 17.6) lors du constat de la partie 1 de T20 ;
--   cette version-ci les a rendues à l'identique vers 15:41 UTC. Relevé par la requête à part, sans afficher le corps :
--   la fonction n'est pas SECURITY DEFINER, a SET search_path = pg_catalog, public (migration 071 ; son now() reste
--   celui de pg_catalog), propriétaire postgres, et son corps (52 caractères, sans retour chariot) ne fait que dater la
--   ligne ; le déclencheur n'a ni clause WHEN, ni colonnes, ni arguments. Les deux empreintes se recalculent hors
--   production : 40588a5266ec est celle de pg_get_functiondef pour le corps d'origine de 048 (BEGIN /
--   NEW.updated_at = now(); / RETURN NEW; / END;, fins de ligne LF) avec SET search_path TO 'pg_catalog', 'public' :
--   le corps de production est donc celui de 048, octet pour octet (en CRLF, l'empreinte serait autre) ;
--   cabcbdb0ce56 est celle de CREATE TRIGGER trg_pro_team_updated_at BEFORE UPDATE ON public.pro_team_members FOR EACH
--   ROW EXECUTE FUNCTION update_pro_team_updated_at(). Toute valeur qui change est à relire (requêtes de relecture
--   ci-dessus, sans arguments), puis à noter avec sa date, ici ou hors du dépôt selon la règle des empreintes. L'état
--   « dépôt » des tests d'exécution (048 sans 071) montre le même déclencheur sur la même fonction, sans SET
--   search_path (autre empreinte de fonction) ; elle y sert aussi trg_pro_perms_updated_at, posé sur
--   pro_role_permissions, hors de cette liste. droits : select, insert et update sont vrais pour un droit sur la table
--   comme sur une seule de ses colonnes. proprietaire : le rôle qui doit lancer la migration (celui de l'éditeur SQL,
--   postgres, s'il est propriétaire). Ces champs ne sortent que des noms, des signatures, des codes, des booléens et
--   des empreintes, jamais de corps, d'arguments ni de définitions, sauf policies : qual et with_check, nécessaires
--   pour vérifier la lecture qui reste (une policy ne contient normalement aucune clé).
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
--   16:35 UTC, faite avec la version précédente de cette partie (empreinte 37ff9137…), les établit : heritage et
--   cles_etrangeres null, sql_dynamique false, aucun droit de colonne pour anon ni authenticated, corps de
--   next_doc_number relu (voir plus haut). Dans toutes ces versions, declencheurs ne rendait que le nom et la fonction
--   (trg_pro_team_updated_at et update_pro_team_updated_at() dans les constats des 15 et 16/11/2026) ; le type, l'état
--   actif et les empreintes ont été relevés à part le 17/11/2026 vers 12:00 UTC, puis par cette version-ci vers
--   15:41 UTC (voir declencheurs).

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
    select json_agg(json_build_object(
             'nom', t.tgname, 'fonction', t.tgfoid::regprocedure::text, 'type', t.tgtype, 'actif', t.tgenabled,
             'empreinte', left(encode(sha256(convert_to(pg_get_functiondef(t.tgfoid), 'UTF8')), 'hex'), 12),
             'empreinte_declencheur', left(encode(sha256(convert_to(pg_get_triggerdef(t.oid), 'UTF8')), 'hex'), 12))
           order by t.tgname)
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
