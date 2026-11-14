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
--   truncate = false ; service_role : tout à true (routes serveur).

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
  'droits', (
    select json_agg(json_build_object(
             'role', r.role,
             'select', has_table_privilege(r.role, 'public.syndic_team_members', 'SELECT'),
             'insert', has_table_privilege(r.role, 'public.syndic_team_members', 'INSERT'),
             'update', has_table_privilege(r.role, 'public.syndic_team_members', 'UPDATE'),
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
