-- ══════════════════════════════════════════════════════════════════════════════
-- Outillage et véhicules BTP (26/11/2026) : répertoire des outils et véhicules de la société, et vérification de
-- chaque vendredi par le responsable du chantier (encarregado). Demande de Frédéric du 26/11/2026 : « un répertoire
-- das ferramentas da empresa / veículos, à valider par les encarregados chaque vendredi. Chaque vendredi le
-- responsable de son chantier valide les ferramentas qu'il y a là-bas et s'il en manque. »
--
-- 1. outillage_btp (une ligne par outil, lot d'outils identiques ou véhicule) : type (outil | vehicule), nom,
--    référence (numéro interne, numéro de série ou immatriculation), quantité, chantier où il se trouve (vide =
--    au dépôt), état (ok | en_panne), notes. Un outil retiré du répertoire garde sa ligne (retire_le) : les
--    vérifications passées le citent encore.
--    chantier_id sans clé étrangère, comme chantier_nom dans pointages_btp : un chantier supprimé ne doit ni
--    effacer l'outil ni faire échouer la suppression ; la route traite un chantier introuvable comme le dépôt.
-- 2. verifications_outillage_btp (une ligne par vérification) : chantier, vendredi de la semaine vérifiée, qui a
--    validé (compte et fiche employé), et la liste vérifiée en JSON (copie figée : nom, quantité attendue, nombre
--    présent, en panne, remarque). Jamais réécrite : une seconde vérification de la même semaine s'ajoute, la plus
--    récente fait foi.
--
-- RLS active SANS policy et droits retirés à anon et authenticated, comme pointage_reglages_btp (20261116) : seule
-- la route serveur /api/btp/outillage (service role) lit et écrit, et c'est elle qui vérifie les droits (gérant et
-- comptes en accès complet : le répertoire ; responsable affecté au chantier : la vérification).
--
-- Rien d'autre : deux tables NOUVELLES, aucune table existante touchée, aucune ligne insérée, modifiée ou supprimée,
-- aucune policy ni aucun droit existant changé.
-- Contrôle sur une vraie base : tests/migrations/btp_outillage.execution.test.ts.
-- Retour arrière : docs/rollback-procedures.md, section « Migration 20261126 — Outillage BTP ».
--
-- À lancer dans l'éditeur SQL de Supabase AVANT la mise en ligne du code (sans elle, l'écran le dit et n'écrit rien).
-- Rejouable : relancée, elle ne change rien.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

set local lock_timeout = '5s';

create table if not exists public.outillage_btp (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  type        text not null default 'outil',
  nom         text not null,
  reference   text,
  quantite    integer not null default 1,
  chantier_id uuid,
  etat        text not null default 'ok',
  notes       text,
  retire_le   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint outillage_btp_type_valide check (type in ('outil', 'vehicule')),
  constraint outillage_btp_nom_valide check (char_length(btrim(nom)) between 1 and 120),
  constraint outillage_btp_reference_valide check (reference is null or char_length(reference) <= 80),
  constraint outillage_btp_quantite_valide check (quantite between 1 and 999),
  constraint outillage_btp_etat_valide check (etat in ('ok', 'en_panne')),
  constraint outillage_btp_notes_valides check (notes is null or char_length(notes) <= 500)
);

create index if not exists outillage_btp_societe_chantier
  on public.outillage_btp (owner_id, chantier_id)
  where retire_le is null;

create table if not exists public.verifications_outillage_btp (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  chantier_id    uuid not null,
  chantier_titre text,
  vendredi       date not null,
  membre_id      uuid,
  valide_par     uuid not null,
  valide_par_nom text,
  lignes         jsonb not null default '[]'::jsonb,
  manquants      integer not null default 0,
  en_panne       integer not null default 0,
  observations   text,
  created_at     timestamptz not null default now(),
  constraint verifications_outillage_btp_vendredi check (extract(isodow from vendredi) = 5),
  constraint verifications_outillage_btp_lignes check (jsonb_typeof(lignes) = 'array'),
  constraint verifications_outillage_btp_compteurs check (manquants >= 0 and en_panne >= 0),
  constraint verifications_outillage_btp_observations check (observations is null or char_length(observations) <= 1000)
);

create index if not exists verifications_outillage_btp_societe_vendredi
  on public.verifications_outillage_btp (owner_id, vendredi desc, created_at desc);

alter table public.outillage_btp enable row level security;
alter table public.verifications_outillage_btp enable row level security;

comment on table public.outillage_btp is
  'Outils et véhicules d''une société BTP (owner_id = compte de la société), et chantier où ils se trouvent (vide = dépôt). Serveur seulement.';
comment on table public.verifications_outillage_btp is
  'Vérification du vendredi de l''outillage d''un chantier BTP par son responsable ; copie figée de la liste vérifiée. Serveur seulement.';

-- Lecture et écriture par la route serveur seulement (service role, qui contourne la RLS).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.outillage_btp from anon;
    revoke all on public.verifications_outillage_btp from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.outillage_btp from authenticated;
    revoke all on public.verifications_outillage_btp from authenticated;
  end if;
end
$$;

commit;
