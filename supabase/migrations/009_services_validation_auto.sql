-- Migration 009: Ajouter validation_auto et delai_minimum_heures à la table services
-- Ticket 3: validation auto par motif de RDV
-- Ticket 4: délai minimum avant prise de RDV

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS validation_auto BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delai_minimum_heures INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN services.validation_auto IS 'Si true, les demandes de RDV pour ce motif sont confirmées automatiquement sans action de l''artisan';
COMMENT ON COLUMN services.delai_minimum_heures IS 'Délai minimum en heures entre la prise de RDV et l''heure du créneau (0 = pas de délai)';
