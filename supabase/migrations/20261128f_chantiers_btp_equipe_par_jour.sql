-- 20261128f_chantiers_btp_equipe_par_jour.sql
--
-- Équipe d'une obra jour par jour (demande de Frédéric du 28/11/2026) : « on doit pouvoir choisir les employés qui y
-- sont, et pouvoir modifier par JOUR si jamais d'autres y sont ».
--
-- L'équipe habituelle reste membres_ids (migration 20261116). Cette colonne ne garde que les jours retouchés :
--   { "2026-12-01": ["<uuid membre>", …], "2026-12-06": [] }
-- la liste exacte des employés présents ce jour-là (vide : personne). Un jour absent de l'objet prend l'équipe
-- habituelle (du lundi au vendredi). Lue par l'écran Obras (coût de la main-d'œuvre jour par jour,
-- lib/btp/rentabilite-obra.ts) et par le pointage (un renfort ajouté pour un jour peut pointer sur cette obra ce
-- jour-là, lib/btp/pointage-regles.ts).
--
-- Rejouable. Ne touche à aucune ligne existante (valeur par défaut posée par la colonne, sans réécriture) ni aux
-- droits : chantiers_btp garde sa RLS et ses policies ; l'écriture passe par /api/btp, qui vérifie le format et que
-- chaque employé désigné appartient à la société (lib/btp/schema-tables-btp.ts).

alter table public.chantiers_btp
  add column if not exists equipe_par_jour jsonb not null default '{}'::jsonb;

comment on column public.chantiers_btp.equipe_par_jour is
  'Jours où l''équipe diffère de l''équipe habituelle (membres_ids) : { "AAAA-MM-JJ": [uuid des membres présents] }.';

-- Toujours un objet (jamais une liste, un texte ou un nombre). La colonne étant neuve et remplie par sa valeur par
-- défaut, la contrainte se valide sans attendre.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chantiers_btp_equipe_par_jour_objet' and conrelid = 'public.chantiers_btp'::regclass
  ) then
    alter table public.chantiers_btp
      add constraint chantiers_btp_equipe_par_jour_objet check (jsonb_typeof(equipe_par_jour) = 'object');
  end if;
end $$;

-- Contrôle (lecture) après exécution :
-- select column_name, data_type, is_nullable, column_default from information_schema.columns
--   where table_schema = 'public' and table_name = 'chantiers_btp' and column_name = 'equipe_par_jour';
-- select convalidated from pg_constraint where conname = 'chantiers_btp_equipe_par_jour_objet';
