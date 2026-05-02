-- ════════════════════════════════════════════════════════════════════════════
-- 074 — Persistance integrale des devis et factures (colonne raw_data)
-- ════════════════════════════════════════════════════════════════════════════
-- Avant cette migration, syncDocumentToSupabase persistait chaque devis ou
-- facture cote DB mais uniquement avec les champs SOMMAIRE (numero, client,
-- total HT, statut, lignes denormalisees). Le payload BTP complet (corps
-- d'etat, etapes par ligne, mediator, mentions de certification, notes,
-- acomptes, etc.) restait stocke uniquement dans le localStorage du
-- navigateur.
--
-- Consequence : un artisan qui changeait d'ordinateur ou de navigateur
-- perdait tout le contenu de ses devis BTP (la liste s'affichait mais en
-- ouvrant le devis, tout etait vide).
--
-- Cette migration ajoute une colonne raw_data JSONB sur les tables devis
-- et factures pour stocker l'integralite du payload du formulaire. Couplee
-- a la mise a jour de lib/document-sync.ts qui populate cette colonne et
-- de la fetch qui la retourne, on rend les devis/factures totalement
-- portables : ouverture identique sur un autre appareil, restauration
-- apres nettoyage du navigateur.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE devis    ADD COLUMN IF NOT EXISTS raw_data JSONB;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS raw_data JSONB;

COMMENT ON COLUMN devis.raw_data    IS 'Payload complet du formulaire devis (DevisFactureForm + DevisFactureFormBTP) — restaure le devis a l''identique sur n''importe quel appareil';
COMMENT ON COLUMN factures.raw_data IS 'Payload complet du formulaire facture — meme principe que devis.raw_data';
