-- ════════════════════════════════════════════════════════════════════════════
-- 067 — availability.slot_type : sépare les plages RDV (auto) et Visite (manuel)
-- ════════════════════════════════════════════════════════════════════════════
-- Contexte : un artisan veut 2 fenêtres horaires par jour
--   • slot_type='rdv'    → motifs auto (dépannage, débouchage…) bookables direct
--   • slot_type='visite' → motifs manuels = inspection sur place avant devis
-- Côté BTP Pro : ne consomme que slot_type='rdv' (pas de Visite distincte).
-- Idempotent — peut être ré-appliquée sans effet.

-- 1. Ajout de la colonne avec default 'rdv' → toutes les rows existantes restent
--    rétro-compatibles. CHECK pour empêcher des valeurs hors-domaine.
ALTER TABLE availability
  ADD COLUMN IF NOT EXISTS slot_type TEXT NOT NULL DEFAULT 'rdv'
    CHECK (slot_type IN ('rdv', 'visite'));

-- 2. Index combiné pour les queries filtrées par (artisan, type, jour)
--    Le seed du hook crée jusqu'à 14 rows par artisan (7 jours × 2 types).
CREATE INDEX IF NOT EXISTS idx_availability_artisan_slot
  ON availability(artisan_id, slot_type, day_of_week);

-- 3. Pas de backfill nécessaire : les rows existantes héritent de 'rdv'.
--    Les rows 'visite' seront créées à la 1ʳᵉ visite Horaires de chaque artisan
--    (loadCalendarData → seed conditionnel).
