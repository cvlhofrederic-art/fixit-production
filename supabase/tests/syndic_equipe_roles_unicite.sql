-- ══════════════════════════════════════════════════════════════════════════════
-- Équipe syndic : rôles acceptés par la base et unicité de l'adresse par cabinet
-- (migration 20261115_syndic_equipe_roles_unicite.sql) — à lancer dans Supabase > SQL Editor.
--
-- Lecture seule, AVANT puis APRÈS la migration : aucune écriture, aucune donnée personnelle en
-- sortie (noms de contraintes et d'index, codes de rôle, booléens, comptages).
-- ══════════════════════════════════════════════════════════════════════════════

-- Une seule requête (l'éditeur n'affiche que le dernier résultat), qui renvoie un objet JSON :
--   controles_du_role : chaque contrainte CHECK qui porte sur la colonne role (nom, nombre de valeurs
--     citées, validée ou non) ;
--   roles_refuses : rôles de l'application (lib/syndic/equipe-contraintes.ts) absents d'au moins une
--     de ces contraintes, donc refusés par la base (invitation en erreur 500) ;
--   roles_en_trop : valeurs citées par ces contraintes qui ne sont pas des rôles de l'application ;
--   unicites : index uniques de la table (colonnes, partiel ou non, porté par une contrainte ou non) ;
--   unicite_email_par_cabinet : vrai si une unicité non partielle porte exactement sur
--     (cabinet_id, email), la cible d'upsert de /api/admin/init-team-table ;
--   lignes_role_hors_liste, doublons_email_par_cabinet : doivent valoir 0 AVANT la migration, sinon
--     elle s'arrêtera sans rien appliquer (lignes à examiner avec Frédéric, jamais à corriger seul) ;
--   doublons_email_casse_ignoree_par_cabinet, emails_dans_plusieurs_cabinets : pour information
--     (adresses qui ne diffèrent que par la casse ; adresses présentes dans plusieurs cabinets, que
--     la migration laisse possibles).
-- Avant la migration, attendu en production (constat du 14/11/2026) : un contrôle du rôle à 5
--   valeurs, roles_refuses = ["syndic_juriste", "syndic_technicien"], unicites =
--   syndic_team_members_invite_token_key et syndic_team_members_pkey seulement (le constat ne lisait
--   que pg_constraint : un index unique sans contrainte apparaîtrait ici ; si l'un porte sur email,
--   le signaler avant la migration, il changerait ce qui est dit des adresses dans plusieurs
--   cabinets), unicite_email_par_cabinet = false, lignes = 1, lignes_role_hors_liste = 0,
--   doublons_email_par_cabinet = 0.
-- Après la migration, attendu : un seul contrôle du rôle (syndic_team_members_role_check, 7 valeurs,
--   validee = true), roles_refuses = null, roles_en_trop = null, unicite_email_par_cabinet = true
--   (syndic_team_members_cabinet_id_email_key) ; les comptages de lignes inchangés.

with roles_application(role) as (
  select unnest(array['syndic_admin', 'syndic_tech', 'syndic_technicien', 'syndic_secretaire',
                      'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste'])
),
controles as (
  select c.conname as nom,
         c.convalidated as validee,
         array(select v.m[1]
               from regexp_matches(pg_get_constraintdef(c.oid), '''([^'']*)''', 'g') as v(m)
               order by 1) as valeurs
  from pg_constraint c
  where c.conrelid = 'public.syndic_team_members'::regclass
    and c.contype = 'c'
    and exists (select 1 from pg_attribute a
                where a.attrelid = c.conrelid and a.attnum = any (c.conkey) and a.attname = 'role')
),
unicites as (
  select i.relname::text as nom,
         array(select a.attname::text
               from unnest(x.indkey::int2[]) with ordinality as k(attnum, rang)
               join pg_attribute a on a.attrelid = x.indrelid and a.attnum = k.attnum
               order by k.rang) as colonnes,
         x.indpred is not null as partiel,
         x.indexprs is not null as expression,
         exists (select 1 from pg_constraint c where c.conindid = x.indexrelid and c.contype in ('u', 'p')) as contrainte
  from pg_index x
  join pg_class i on i.oid = x.indexrelid
  where x.indrelid = 'public.syndic_team_members'::regclass and x.indisunique
)
select json_build_object(
  'date_constat', now(),
  'controles_du_role', (
    select json_agg(json_build_object('nom', nom, 'nb_valeurs', cardinality(valeurs), 'validee', validee) order by nom)
    from controles),
  'roles_refuses', (
    select json_agg(r.role order by r.role)
    from roles_application r
    where exists (select 1 from controles c where not (r.role = any (c.valeurs)))),
  'roles_en_trop', (
    select json_agg(distinct v.valeur order by v.valeur)
    from controles c cross join unnest(c.valeurs) as v(valeur)
    where v.valeur not in (select role from roles_application)),
  'unicites', (
    select json_agg(json_build_object('nom', nom, 'colonnes', colonnes, 'partiel', partiel, 'contrainte', contrainte) order by nom)
    from unicites),
  'unicite_email_par_cabinet', exists (
    select 1 from unicites u
    where not u.partiel and not u.expression
      and array(select unnest(u.colonnes) order by 1) = array['cabinet_id', 'email']),
  'lignes', (select count(*) from public.syndic_team_members),
  'lignes_role_hors_liste', (
    select count(*) from public.syndic_team_members
    where role not in (select role from roles_application)),
  'doublons_email_par_cabinet', (
    select count(*) from (
      select 1 from public.syndic_team_members
      where email is not null group by cabinet_id, email having count(*) > 1) d),
  'doublons_email_casse_ignoree_par_cabinet', (
    select count(*) from (
      select 1 from public.syndic_team_members
      where email is not null group by cabinet_id, lower(email) having count(*) > 1) d),
  'emails_dans_plusieurs_cabinets', (
    select count(*) from (
      select 1 from public.syndic_team_members
      where email is not null group by lower(email) having count(distinct cabinet_id) > 1) d)
) as etat;
