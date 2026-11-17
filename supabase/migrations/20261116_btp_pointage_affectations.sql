-- ══════════════════════════════════════════════════════════════════════════════
-- Pointage géolocalisé BTP (16/11/2026) : employés affectés à un chantier, un seul pointage en cours par employé,
-- interrupteur du pointage automatique par société.
--
-- 1. chantiers_btp.membres_ids (uuid[], vide par défaut) : employés (membres_btp.id) affectés au chantier, en plus
--    des équipes (equipes_btp.chantier_id, colonne existante). L'écran Pointage (onglet Affectations) et la fiche
--    chantier l'écrivent ; /api/btp/pointage la lit pour savoir sur quels chantiers un employé peut pointer.
--    Colonne ajoutée avec une valeur par défaut constante : PostgreSQL ne réécrit aucune ligne existante, et les
--    chantiers existants se lisent « aucun employé affecté individuellement », comme aujourd'hui.
-- 2. Index unique partiel sur pointages_btp (owner_id, membre_id), limité aux pointages en cours d'un employé
--    (heure_depart IS NULL AND membre_id IS NOT NULL) : deux envois simultanés de la même arrivée (double appui,
--    réseau qui renvoie) ne peuvent pas ouvrir deux pointages. Constat en production du 16/11/2026, en lecture
--    seule : aucun pointage sans heure de départ, l'index se construit sans conflit. S'il en existait deux pour un
--    même employé au moment de l'exécution, la création échouerait et rien ne serait appliqué (transaction).
-- 3. Table pointage_reglages_btp (une ligne par société, owner_id = compte du gérant) : pointage automatique activé
--    ou non (coupé par défaut, aucune ligne créée ici), date et auteur de la confirmation par le gérant qu'il a
--    informé ses salariés. Table à part plutôt que settings_btp.geo_pointage_enabled : créer une ligne settings_btp
--    pour ce seul drapeau remplaçait les taux calculés de la société (coût horaire, charges, IS) par les valeurs par
--    défaut de la table. RLS active SANS policy et droits retirés à anon et authenticated : seule la route serveur
--    (service role) la lit et l'écrit.
--
-- Rien d'autre : aucune ligne insérée, modifiée ou supprimée ; aucune policy existante ni aucun droit existant touché
-- (la policy chantiers_owner_all de chantiers_btp couvre la nouvelle colonne).
-- Contrôle sur une vraie base : tests/migrations/btp_pointage_affectations.execution.test.ts.
-- Retour arrière : docs/rollback-procedures.md, section « Migration 20261116 — Pointage BTP ».
--
-- À lancer dans l'éditeur SQL de Supabase, de préférence AVANT la mise en ligne du code. Le code marche aussi sans
-- elle, en mode manuel : affectation par équipes seulement et pointage automatique indisponible (l'écran le dit).
-- Rejouable : relancée, elle ne change rien.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

set local lock_timeout = '5s';

alter table if exists public.chantiers_btp
  add column if not exists membres_ids uuid[] not null default '{}'::uuid[];

create table if not exists public.pointage_reglages_btp (
  owner_id      uuid primary key references auth.users(id) on delete cascade,
  auto_active   boolean not null default false,
  confirme_le   timestamptz,
  confirme_par  uuid,
  modifie_le    timestamptz not null default now()
);

alter table public.pointage_reglages_btp enable row level security;

do $$
begin
  if to_regclass('public.chantiers_btp') is not null then
    comment on column public.chantiers_btp.membres_ids is
      'Employés (membres_btp.id) affectés au chantier, en plus des équipes (equipes_btp.chantier_id). Pointage géolocalisé.';
  end if;

  if to_regclass('public.pointages_btp') is not null then
    create unique index if not exists pointages_btp_un_ouvert_par_membre
      on public.pointages_btp (owner_id, membre_id)
      where heure_depart is null and membre_id is not null;
  end if;

  comment on table public.pointage_reglages_btp is
    'Pointage automatique (GPS) des employés BTP, par société : activé par le gérant après confirmation. Serveur seulement.';

  -- Lecture et écriture par les routes serveur seulement (service role, qui contourne la RLS).
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.pointage_reglages_btp from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.pointage_reglages_btp from authenticated;
  end if;
end
$$;

commit;
