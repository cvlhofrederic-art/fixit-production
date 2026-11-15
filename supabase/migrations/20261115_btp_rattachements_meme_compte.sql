-- ══════════════════════════════════════════════════════════════════════════════
-- BTP : une fiche ne désigne qu'un chantier, un membre ou une équipe du MÊME compte (15/11/2026)
--
-- Constat api-coeur-9 de l'audit des fondations BTP du 11/11/2026. Depuis le 15/11/2026, la route /api/btp vérifie
-- que chantier_id, membre_id, equipe_id et les membres d'une équipe désignent des fiches du compte. Les politiques
-- d'accès des tables BTP ne contrôlent que owner_id : une écriture faite directement avec la session du navigateur,
-- sans passer par la route, pouvait encore rattacher une fiche au chantier ou au salarié d'une autre société (la clé
-- étrangère vérifie que la fiche existe, pas à qui elle appartient). Cette migration pose la même règle dans la base.
--
-- Contenu : deux fonctions de déclencheur (SECURITY INVOKER, search_path figé) et un déclencheur BEFORE INSERT OR
-- UPDATE sur pointages_btp, depenses_btp, equipes_btp, membres_btp, situations_btp, retenues_btp, dc4_btp,
-- rapports_btp et equipe_membres_btp (colonnes du relevé de production du 11/11/2026).
--   - Création : chaque identifiant lié non vide doit désigner une fiche du propriétaire de la ligne.
--   - Modification : contrôle seulement si l'identifiant lié (ou le propriétaire) CHANGE. Une valeur déjà
--     enregistrée n'est jamais remise en cause ; une remise à vide (suppression d'un chantier, ON DELETE SET NULL)
--     passe toujours.
--   - Refus : SQLSTATE 23503, que la route traduit en « fiche liée introuvable » (400).
-- Avec la session du navigateur, la fonction lit chantiers_btp, membres_btp et equipes_btp sous leurs politiques
-- d'accès : la fiche d'un autre compte y est invisible, donc refusée ; avec le service role (la route), la condition
-- sur owner_id fait le même contrôle.
--
-- Aucune ligne existante n'est lue, modifiée ni supprimée par la migration. Rejouable : CREATE OR REPLACE FUNCTION et
-- CREATE OR REPLACE TRIGGER (aucun DROP). Le code de l'application est correct avant comme après : la route refuse
-- déjà ces rattachements, avec un message clair.
-- Non couvert ici : devis.chantier_id et factures.chantier_id (documents ; écrits par une autre route).
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
  return new;
end;
$$;

comment on function public.btp_rattachements_meme_compte() is
  'Déclencheur des tables BTP : chantier_id, membre_id et equipe_id d''une ligne désignent des fiches du même
   propriétaire (owner_id), à la création et quand ils changent. Constat api-coeur-9 (audit du 11/11/2026).';

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
