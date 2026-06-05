-- Migration 063 — Gantt sous-tâches persistées sur chantiers_btp
-- Stocke les sous-tâches Gantt en JSONB sur le chantier auquel elles appartiennent.
-- Choix délibéré : JSONB sur chantiers_btp plutôt qu'une table séparée, car
-- les sous-tâches sont peu nombreuses (< 50/chantier) et jamais interrogées
-- indépendamment de leur chantier.

ALTER TABLE chantiers_btp ADD COLUMN IF NOT EXISTS sous_taches JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN chantiers_btp.sous_taches IS
  'Tableau JSON des sous-tâches Gantt : [{id, nom, responsable, debut, fin, avancement, couleur}]';
