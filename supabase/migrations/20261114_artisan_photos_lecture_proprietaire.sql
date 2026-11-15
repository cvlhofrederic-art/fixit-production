-- ══════════════════════════════════════════════════════════════════════════════
-- Photos de chantier : lecture de la table réservée au propriétaire de la fiche (14/11/2026)
--
-- public.artisan_photos porte, pour chaque photo de chantier, sa date, son libellé, sa position
-- et son lien d'affichage. Sa politique de lecture était restée ouverte à tous (condition
-- « true », migrations 041 et 069), alors que ses politiques d'écriture exigent déjà le
-- propriétaire de la fiche.
--
-- Le code ne lit jamais cette table depuis le navigateur : les écrans passent par
-- /api/artisan-photos (service role, qui ne dépend pas des politiques), route qui vérifie
-- désormais elle aussi que la fiche demandée est celle du compte connecté. Le code est donc
-- correct avant comme après cette migration.
--
-- 1. Retrait de toute politique de LECTURE dont la condition est littéralement « true ».
--    Son nom varie selon l'historique de la base (artisan_photos_public_read,
--    artisan_photos_select…) : elle est cherchée par sa condition, pas par son nom.
-- 2. Lecture par le propriétaire de la fiche (même condition que les politiques d'écriture
--    artisan_photos_owner_insert / _update / _delete, qui ne changent pas : sans lecture, une
--    modification ou une suppression par le propriétaire ne verrait plus ses propres lignes).
--
-- Aucune donnée n'est lue, modifiée ni supprimée ; la table, ses droits, l'activation de la
-- RLS et le seau de stockage ne changent pas. Rejouable.
--
-- À appliquer seul (éditeur SQL). DROP POLICY prend un verrou exclusif sur la table, le temps
-- de l'instruction : lock_timeout évite d'attendre derrière une transaction longue ; en cas
-- d'expiration, rien n'est appliqué, relancer.
--
-- Contrôle après exécution (lecture seule) : il doit rester quatre politiques
-- artisan_photos_owner_*, et aucune dont une condition (qual ou with_check) est « true ».
-- Si une condition « true » apparaît encore (politique d'écriture ou « ALL », que cette
-- migration ne retire pas) ou si une cinquième politique subsiste, ne rien forcer : le signaler.
--   select policyname, cmd, qual, with_check from pg_policies
--    where schemaname = 'public' and tablename = 'artisan_photos' order by policyname;
-- ══════════════════════════════════════════════════════════════════════════════

set local lock_timeout = '5s';

-- 1. Politiques de lecture ouvertes à tous
do $$
declare
  ouverte record;
begin
  for ouverte in
    select policyname
      from pg_policies
     where schemaname = 'public'
       and tablename = 'artisan_photos'
       and cmd = 'SELECT'
       and qual = 'true'
  loop
    execute format('drop policy if exists %I on public.artisan_photos', ouverte.policyname);
  end loop;
end
$$;

-- 2. Lecture par le propriétaire de la fiche
do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'artisan_photos'
       and policyname = 'artisan_photos_owner_select'
  ) then
    create policy artisan_photos_owner_select on public.artisan_photos
      for select using (
        exists (
          select 1
            from public.profiles_artisan p
           where p.id = artisan_photos.artisan_id
             and p.user_id = (select auth.uid())
        )
      );
  end if;
end
$$;
