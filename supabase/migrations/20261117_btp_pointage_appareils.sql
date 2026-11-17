-- ══════════════════════════════════════════════════════════════════════════════
-- Pointage BTP en arrière-plan (17/11/2026) : téléphones qui envoient les arrivées et départs détectés par le
-- géorepérage du système (appli Vitfix Pro, téléphone en poche).
--
-- Table pointage_appareils_btp : un téléphone enregistré par un employé (son compte, sa fiche membres_btp, sa société).
-- Le téléphone reçoit son jeton une seule fois ; seule l'empreinte SHA-256 du jeton est gardée ici (colonne empreinte,
-- unique). Il l'envoie avec chaque arrivée ou départ à POST /api/btp/pointage/evenement, sans aucune position.
-- retire_le : téléphone retiré (l'employé coupe le pointage en arrière-plan, enregistre un autre téléphone, son compte
-- quitte la société ou sa fiche change d'adresse e-mail, le gérant coupe le pointage automatique) ; ses envois sont
-- alors ignorés. Un seul téléphone actif par compte (index unique partiel pointage_appareils_btp_actifs).
-- email_fiche : adresse de la fiche à l'enregistrement (rattachement du compte). vu_le : dernier envoi reçu. fuseau :
-- celui du téléphone à l'enregistrement, pour écrire la date et l'heure murales du pointage.
-- État des envois (le module Android les livre dans le désordre et parfois deux fois) : traite_jusqu_au (un envoi
-- traité à la fois), dernier_evenement_le (heure de détection du dernier envoi traité : un envoi plus ancien ne
-- s'applique pas), entree_attente_* (arrivée sur un chantier voisin pendant un autre pointage automatique),
-- sortie_attente_* (sortie reçue avant son arrivée), bloque_* (pointage terminé à la main sur le chantier : arrivées
-- ignorées ce jour-là jusqu'à une sortie).
-- RLS active SANS policy et droits retirés à anon et authenticated : seules les routes serveur (service role) la lisent
-- et l'écrivent.
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
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  membre_id   uuid not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  empreinte   text not null unique check (empreinte ~ '^[0-9a-f]{64}$'),
  plateforme  text not null check (plateforme in ('android', 'ios')),
  email_fiche text not null,
  fuseau      text not null default 'Europe/Paris',
  cree_le     timestamptz not null default now(),
  vu_le       timestamptz,
  retire_le   timestamptz,
  traite_jusqu_au         timestamptz,
  dernier_evenement_le    timestamptz,
  entree_attente_chantier uuid,
  entree_attente_le       timestamptz,
  sortie_attente_chantier uuid,
  sortie_attente_le       timestamptz,
  bloque_chantier         uuid,
  bloque_le               timestamptz
);

create unique index if not exists pointage_appareils_btp_actifs
  on public.pointage_appareils_btp (user_id)
  where retire_le is null;

alter table public.pointage_appareils_btp enable row level security;

comment on table public.pointage_appareils_btp is
  'Téléphones qui pointent en arrière-plan (appli Vitfix Pro, géorepérage) : empreinte SHA-256 du jeton seulement. Serveur seulement.';

do $$
begin
  -- Lecture et écriture par les routes serveur seulement (service role, qui contourne la RLS).
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.pointage_appareils_btp from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.pointage_appareils_btp from authenticated;
  end if;
end
$$;

commit;
