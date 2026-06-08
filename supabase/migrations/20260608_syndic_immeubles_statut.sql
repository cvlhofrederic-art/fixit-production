-- Edifícios : statut de gestion (ativo / suspenso).
-- Permet de retirer un edifício de la gestion active sans le supprimer
-- (anti-fraude : on conserve l'historique). RLS existante sur syndic_immeubles
-- couvre déjà la colonne (policies par cabinet_id, aucune policy à ajouter).
ALTER TABLE syndic_immeubles
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'ativo'
  CHECK (statut IN ('ativo', 'suspenso'));
