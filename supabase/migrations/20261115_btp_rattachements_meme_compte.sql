-- ══════════════════════════════════════════════════════════════════════════════
-- BTP : une fiche ne désigne qu'un chantier, un membre ou une équipe du MÊME compte (15/11/2026)
--
-- Constat api-coeur-9 de l'audit des fondations BTP du 11/11/2026. Depuis le 15/11/2026, la route /api/btp vérifie
-- que chantier_id, membre_id, equipe_id et les membres d'une équipe désignent des fiches du compte, et depuis le
-- 17/11/2026 les employés affectés à un chantier (chantiers_btp.membres_ids, migration 20261116). Cette migration
-- pose la même règle dans la base : une fiche ne désigne qu'un chantier, un membre ou une équipe du même compte,
-- quelle que soit la voie d'écriture.
--
-- Contenu : deux fonctions de déclencheur (SECURITY INVOKER, search_path figé) et un déclencheur BEFORE INSERT OR
-- UPDATE sur pointages_btp, depenses_btp, equipes_btp, membres_btp, situations_btp, retenues_btp, dc4_btp,
-- rapports_btp et equipe_membres_btp (colonnes du relevé de production du 11/11/2026), et sur chantiers_btp pour
-- membres_ids (uuid[], sans clé étrangère).
--   - Création : chaque identifiant lié non vide doit désigner une fiche du propriétaire de la ligne ; chaque employé
--     de membres_ids, un membre du même propriétaire.
--   - Modification : contrôle seulement si l'identifiant lié (ou le propriétaire) CHANGE ; pour membres_ids, seuls les
--     employés AJOUTÉS à la liste. Une valeur déjà enregistrée n'est jamais remise en cause (un employé supprimé
--     depuis reste dans la liste) ; une remise à vide (suppression d'un chantier, ON DELETE SET NULL) passe toujours.
--   - Colonne absente (membres_ids avant la migration 20261116) : rien à contrôler, la fonction lit la ligne en JSON.
--   - Refus : SQLSTATE 23503, que la route traduit en « fiche liée introuvable » (400).
-- Au nom d'un compte (rôle authenticated), la fonction lit chantiers_btp, membres_btp et equipes_btp sous leurs
-- politiques d'accès : la fiche d'un autre compte y est invisible, donc refusée ; avec le service role (la route), la
-- condition sur owner_id fait le même contrôle.
--
-- Aucune ligne existante n'est lue, modifiée ni supprimée par la migration. Rejouable : CREATE OR REPLACE FUNCTION et
-- CREATE OR REPLACE TRIGGER (aucun DROP). Le code de l'application est correct avant comme après : la route refuse
-- déjà ces rattachements, avec un message clair, et ne réécrit jamais un lien équipe-membre inchangé (une équipe qui
-- porte un lien ancien hors du compte se modifie donc normalement).
-- Retour arrière : docs/rollback-procedures.md, section « Migration 20261115 — BTP : rattachements au même compte (`20261115_btp_rattachements_meme_compte.sql`) ».
--
-- À appliquer par Frédéric (Supabase > SQL Editor, un seul « Run »). CREATE TRIGGER prend un verrou sur chaque table
-- le temps de sa création : lock_timeout évite d'attendre derrière une transaction longue ; en cas d'expiration,
-- rien n'est appliqué, relancer.
-- ══════════════════════════════════════════════════════════════════════════════

set local lock_timeout = '5s';

create or replace function public.btp_rattachements_meme_compte()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  nouvelle jsonb := to_jsonb(new);
  ancienne jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  colonne text;
  valeur uuid;
  intrus text;
begin
  foreach colonne in array array['chantier_id', 'membre_id', 'equipe_id'] loop
    -- Colonne absente de cette table, ou identifiant vide : rien à contrôler.
    continue when not (nouvelle ? colonne) or nouvelle ->> colonne is null;
    -- Modification qui garde l'identifiant et le propriétaire : valeur déjà enregistrée, acceptée telle quelle.
    continue when tg_op = 'UPDATE'
      and (nouvelle -> colonne) is not distinct from (ancienne -> colonne)
      and (nouvelle -> 'owner_id') is not distinct from (ancienne -> 'owner_id');

    valeur := (nouvelle ->> colonne)::uuid;
    if colonne = 'chantier_id' then
      perform 1 from public.chantiers_btp c where c.id = valeur and c.owner_id = new.owner_id;
    elsif colonne = 'membre_id' then
      perform 1 from public.membres_btp m where m.id = valeur and m.owner_id = new.owner_id;
    else
      perform 1 from public.equipes_btp e where e.id = valeur and e.owner_id = new.owner_id;
    end if;
    if not found then
      raise exception using errcode = '23503', message = format('%s : fiche liée hors du compte', colonne);
    end if;
  end loop;

  -- Employés affectés à un chantier (membres_ids) : chaque employé ajouté à la liste (tous à la création, ou si le
  -- propriétaire change) doit être un membre du même propriétaire. Pas de liste (autre table, colonne absente) : rien.
  if jsonb_typeof(nouvelle -> 'membres_ids') = 'array' then
    select e.membre into intrus
      from jsonb_array_elements_text(nouvelle -> 'membres_ids') as e(membre)
     where (tg_op = 'INSERT'
            or (nouvelle -> 'owner_id') is distinct from (ancienne -> 'owner_id')
            or not (coalesce(ancienne -> 'membres_ids', '[]'::jsonb) ? e.membre))
       and not exists (select 1 from public.membres_btp m where m.id = e.membre::uuid and m.owner_id = new.owner_id)
     limit 1;
    if found then
      raise exception using errcode = '23503', message = 'membres_ids : employé hors du compte du chantier';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.btp_rattachements_meme_compte() is
  'Déclencheur des tables BTP : chantier_id, membre_id et equipe_id d''une ligne, et les employés ajoutés à
   membres_ids d''un chantier, désignent des fiches du même propriétaire (owner_id), à la création et quand ils
   changent. Constat api-coeur-9 (audit du 11/11/2026).';

create or replace function public.btp_membre_equipe_meme_compte()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.equipe_id is not distinct from old.equipe_id and new.membre_id is not distinct from old.membre_id then
    return new;
  end if;
  perform 1
    from public.equipes_btp e
    join public.membres_btp m on m.owner_id = e.owner_id
   where e.id = new.equipe_id and m.id = new.membre_id;
  if not found then
    raise exception using errcode = '23503', message = 'membre_id : membre hors du compte de l''équipe';
  end if;
  return new;
end;
$$;

comment on function public.btp_membre_equipe_meme_compte() is
  'Déclencheur de equipe_membres_btp : l''équipe et le membre appartiennent au même compte. Constat api-coeur-9.';

create or replace trigger btp_rattachements_meme_compte before insert or update on public.chantiers_btp
  for each row execute function public.btp_rattachements_meme_compte();

create or replace trigger btp_rattachements_meme_compte before insert or update on public.pointages_btp
  for each row execute function public.btp_rattachements_meme_compte();

create or replace trigger btp_rattachements_meme_compte before insert or update on public.depenses_btp
  for each row execute function public.btp_rattachements_meme_compte();

create or replace trigger btp_rattachements_meme_compte before insert or update on public.equipes_btp
  for each row execute function public.btp_rattachements_meme_compte();

create or replace trigger btp_rattachements_meme_compte before insert or update on public.membres_btp
  for each row execute function public.btp_rattachements_meme_compte();

create or replace trigger btp_rattachements_meme_compte before insert or update on public.situations_btp
  for each row execute function public.btp_rattachements_meme_compte();

create or replace trigger btp_rattachements_meme_compte before insert or update on public.retenues_btp
  for each row execute function public.btp_rattachements_meme_compte();

create or replace trigger btp_rattachements_meme_compte before insert or update on public.dc4_btp
  for each row execute function public.btp_rattachements_meme_compte();

create or replace trigger btp_rattachements_meme_compte before insert or update on public.rapports_btp
  for each row execute function public.btp_rattachements_meme_compte();

create or replace trigger btp_membre_equipe_meme_compte before insert or update on public.equipe_membres_btp
  for each row execute function public.btp_membre_equipe_meme_compte();

-- Fonctions de déclencheur, jamais appelées en RPC (même règle que 070_revoke_definer_execute.sql).
revoke execute on function public.btp_rattachements_meme_compte() from public, authenticated, anon;
revoke execute on function public.btp_membre_equipe_meme_compte() from public, authenticated, anon;
