-- ══════════════════════════════════════════════════════════════════════════════
-- Catégorie des outils BTP (28/11/2026). Demande de Frédéric : « Module ferramentas : il faut créer les catégories
-- (ferramentas de mão, andaimes, etc.) qu'on s'y retrouve plus facilement. »
--
-- Une colonne NOUVELLE et facultative sur outillage_btp (migration 20261126) : `categorie`, le code de la catégorie
-- d'un outil (main, electroportatif, echafaudage, coffrage, machines, mesure, securite, autre). Vide pour un véhicule,
-- et pour les outils déjà saisis : l'écran les range sous « Sem categoria » jusqu'à ce qu'on leur en choisisse une.
-- La base ne contrôle que la forme du code (minuscules et _) : la liste des catégories vit dans le code
-- (lib/btp/outillage-regles.ts, CATEGORIES_OUTIL), qui refuse un code inconnu ; en ajouter une ne demande donc pas de
-- nouvelle migration.
--
-- Rien d'autre : aucune ligne modifiée, aucune autre table, aucune policy ni aucun droit touchés (la table reste
-- réservée au serveur : RLS active sans policy, aucun droit pour anon ni authenticated).
-- Contrôle sur une vraie base : tests/migrations/btp_outillage_categorie.execution.test.ts.
-- Retour arrière : docs/rollback-procedures.md, section « Migration 20261128d — Catégorie des outils BTP ».
--
-- À lancer dans l'éditeur SQL de Supabase AVANT la fusion du code. Sans elle, l'écran montre les outils sans
-- catégorie et refuse d'enregistrer une catégorie (409 migration_categorie) ; le code d'avant, lui, n'en voit rien
-- (colonne facultative, qu'il n'écrit pas). Rejouable : relancée, elle ne change rien.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

set local lock_timeout = '5s';

alter table public.outillage_btp add column if not exists categorie text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'outillage_btp_categorie_valide' and conrelid = 'public.outillage_btp'::regclass
  ) then
    alter table public.outillage_btp
      add constraint outillage_btp_categorie_valide check (categorie is null or categorie ~ '^[a-z_]{1,40}$');
  end if;
end
$$;

comment on column public.outillage_btp.categorie is
  'Catégorie d''un outil (code de CATEGORIES_OUTIL, lib/btp/outillage-regles.ts) ; vide pour un véhicule ou un outil non classé.';

commit;
