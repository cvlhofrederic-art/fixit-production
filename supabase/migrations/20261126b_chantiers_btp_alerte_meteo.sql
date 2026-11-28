-- 20261126b_chantiers_btp_alerte_meteo.sql
--
-- Alerte météo par notification, chantier par chantier (décision de Frédéric du 26/11/2026) : « il faudra que
-- l'alerte pluie par exemple sonne uniquement pour les chantiers en extérieur donc il faudra avoir la possibilité de
-- soumettre un chantier à l'alerte météo par notif ou pas si cela le concerne, exemple on fait une dalle béton mais il
-- pleut ».
--
-- Une seule colonne, désactivée par défaut : aucun chantier existant ne se met à sonner. Le gérant la coche dans la
-- fiche chantier. Lue par l'appli (notification la veille au soir, lib/btp/alerte-meteo-telephone.ts) et par la tâche
-- quotidienne de l'e-mail de secours (app/api/cron/alerte-meteo/route.ts).
--
-- Rejouable. Ne touche à aucune ligne existante (valeur par défaut posée par la colonne, sans réécriture) ni aux
-- droits : chantiers_btp garde sa RLS et ses policies ; l'écriture passe par /api/btp (liste blanche
-- lib/btp/schema-tables-btp.ts).

alter table public.chantiers_btp
  add column if not exists alerte_meteo boolean not null default false;

comment on column public.chantiers_btp.alerte_meteo is
  'Chantier exposé aux intempéries (béton, toiture, façade…) : alerte météo de la veille par notification et e-mail aux salariés affectés.';

-- La tâche quotidienne ne lit que les chantiers soumis à l'alerte.
create index if not exists chantiers_btp_alerte_meteo_idx
  on public.chantiers_btp (owner_id)
  where alerte_meteo;
