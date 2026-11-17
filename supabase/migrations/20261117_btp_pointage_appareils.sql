-- ══════════════════════════════════════════════════════════════════════════════
-- Pointage BTP en arrière-plan (17/11/2026) : téléphones qui envoient les arrivées et départs détectés par le
-- géorepérage du système (appli Vitfix Pro, téléphone en poche), journal de leurs envois, et pointages qu'ils ont écrits.
--
-- pointage_appareils_btp : un téléphone enregistré par un employé (son compte, sa fiche membres_btp, sa société).
-- Le téléphone reçoit son jeton une seule fois ; seule l'empreinte SHA-256 du jeton est gardée ici (colonne empreinte,
-- unique). Il l'envoie avec chaque arrivée ou départ à POST /api/btp/pointage/evenement, sans aucune position.
-- retire_le : téléphone retiré (l'employé coupe le pointage en arrière-plan, enregistre un autre téléphone, son compte
-- quitte la société ou sa fiche change d'adresse e-mail, le gérant coupe le pointage automatique) ; ses envois sont
-- alors ignorés. Un seul téléphone actif par compte (index unique partiel pointage_appareils_btp_actifs).
-- email_fiche : adresse de la fiche à l'enregistrement (rattachement du compte). vu_le : dernier envoi reçu. fuseau :
-- celui du téléphone à l'enregistrement, pour écrire la date et l'heure murales du pointage. traite_jusqu_au : un envoi
-- du téléphone est en cours de traitement (un seul à la fois).
--
-- pointage_evenements_btp : journal des envois du téléphone (chantier, sens, heure de détection, heure de réception).
-- Le module Android les livre dans le désordre et parfois deux fois : une même ligne (téléphone, chantier, sens, heure)
-- n'entre qu'une fois, et la journée est rejouée dans l'ordre des heures de détection à chaque réception.
--
-- pointage_lignes_appareil_btp : pointages (pointages_btp) écrits par un téléphone, avec ce qu'il y a écrit (ecrit). Le
-- téléphone ne réécrit un pointage que s'il porte encore ces valeurs : modifié par l'employé ou le gérant, il ne lui
-- appartient plus.
--
-- RLS active SANS policy et droits retirés à anon et authenticated sur les trois tables : seules les routes serveur
-- (service role) les lisent et les écrivent.
--
-- Rien d'autre : aucune ligne insérée, modifiée ou supprimée ; aucune table existante touchée.
-- Contrôle sur une vraie base : tests/migrations/btp_pointage_appareils.execution.test.ts.
-- Retour arrière : docs/rollback-procedures.md, section « Migration 20261117 — Pointage BTP en arrière-plan ».
--
-- À lancer dans l'éditeur SQL de Supabase avant la mise en ligne du code. Sans elle, le reste du pointage marche ;
-- seul le pointage en arrière-plan est indisponible (l'onglet Pointer de l'appli le dit). Rejouable : relancée, elle
-- ne change rien.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

set local lock_timeout = '5s';

create table if not exists public.pointage_appareils_btp (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  membre_id       uuid not null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  empreinte       text not null unique check (empreinte ~ '^[0-9a-f]{64}$'),
  plateforme      text not null check (plateforme in ('android', 'ios')),
  email_fiche     text not null,
  fuseau          text not null default 'Europe/Paris',
  cree_le         timestamptz not null default now(),
  vu_le           timestamptz,
  retire_le       timestamptz,
  traite_jusqu_au timestamptz
);

create unique index if not exists pointage_appareils_btp_actifs
  on public.pointage_appareils_btp (user_id)
  where retire_le is null;

create table if not exists public.pointage_evenements_btp (
  id           uuid primary key default gen_random_uuid(),
  appareil_id  uuid not null references public.pointage_appareils_btp(id) on delete cascade,
  chantier_id  uuid not null,
  chantier_nom text,
  sens         text not null check (sens in ('enter', 'exit')),
  detecte_le   timestamptz not null,
  recu_le      timestamptz not null default now(),
  constraint pointage_evenements_btp_un_envoi unique (appareil_id, chantier_id, sens, detecte_le)
);

create index if not exists pointage_evenements_btp_par_heure
  on public.pointage_evenements_btp (appareil_id, detecte_le);

create table if not exists public.pointage_lignes_appareil_btp (
  pointage_id text primary key,
  appareil_id uuid not null references public.pointage_appareils_btp(id) on delete cascade,
  date        date not null,
  ecrit       jsonb not null
);

create index if not exists pointage_lignes_appareil_btp_par_jour
  on public.pointage_lignes_appareil_btp (appareil_id, date);

alter table public.pointage_appareils_btp enable row level security;
alter table public.pointage_evenements_btp enable row level security;
alter table public.pointage_lignes_appareil_btp enable row level security;

comment on table public.pointage_appareils_btp is
  'Téléphones qui pointent en arrière-plan (appli Vitfix Pro, géorepérage) : empreinte SHA-256 du jeton seulement. Serveur seulement.';
comment on table public.pointage_evenements_btp is
  'Journal des arrivées et départs envoyés par les téléphones (sans position), rejoué dans l''ordre des heures de détection. Serveur seulement.';
comment on table public.pointage_lignes_appareil_btp is
  'Pointages écrits par un téléphone et ce qu''il y a écrit : il ne les réécrit que s''ils n''ont pas été modifiés. Serveur seulement.';

do $$
declare
  t text;
begin
  -- Lecture et écriture par les routes serveur seulement (service role, qui contourne la RLS).
  foreach t in array array['pointage_appareils_btp', 'pointage_evenements_btp', 'pointage_lignes_appareil_btp'] loop
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on public.%I from authenticated', t);
    end if;
  end loop;
end
$$;

commit;
