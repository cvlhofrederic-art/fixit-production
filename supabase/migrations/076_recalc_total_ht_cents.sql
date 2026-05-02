-- ════════════════════════════════════════════════════════════════════════════
-- 076 — Recalcul one-shot du total_ht_cents pour les devis/factures legacy
-- ════════════════════════════════════════════════════════════════════════════
-- Avant la PR #78, syncDocumentToSupabase populait total_ht_cents via une
-- fonction qui ne sommait pas customTables. Resultat : tous les devis BTP
-- enrichis de corps d'etat avaient un total_ht_cents partiel en DB,
-- faussant les statistiques (revenus annee, panier moyen, factures payees).
--
-- Cette migration recalcule total_ht_cents pour TOUS les devis et factures
-- qui ont un raw_data (PR #75) en sommant l'ensemble des sources :
--   lines + materialLines + fraisLines + fraisAnnexes + customTables
-- Idempotente : peut etre re-jouee sans risque (l'update est exactement
-- la valeur que recomputerait le code applicatif au prochain save).
--
-- Pour les devis/factures sans raw_data (legacy avant PR #75), aucune
-- modification — le total_ht_cents existant reste tel quel (deja partiel
-- mais on n'a pas la donnee pour le recalculer).
-- ════════════════════════════════════════════════════════════════════════════

-- Helper : calcule le total HT en centimes a partir du raw_data JSONB.
-- Renvoie 0 si la donnee est absente ou malformee.
CREATE OR REPLACE FUNCTION calc_total_ht_cents_from_raw_data(raw jsonb)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  total numeric := 0;
BEGIN
  IF raw IS NULL OR jsonb_typeof(raw) <> 'object' THEN
    RETURN 0;
  END IF;

  -- lines (DevisFactureForm + DevisFactureFormBTP) : champ totalHT
  IF jsonb_typeof(raw->'lines') = 'array' THEN
    SELECT total + COALESCE(SUM(COALESCE((l->>'totalHT')::numeric, 0)), 0)
      INTO total
      FROM jsonb_array_elements(raw->'lines') l;
  END IF;

  -- materialLines (BTP) : champ totalHT
  IF jsonb_typeof(raw->'materialLines') = 'array' THEN
    SELECT total + COALESCE(SUM(COALESCE((l->>'totalHT')::numeric, 0)), 0)
      INTO total
      FROM jsonb_array_elements(raw->'materialLines') l;
  END IF;

  -- fraisLines (BTP) : champ totalHT
  IF jsonb_typeof(raw->'fraisLines') = 'array' THEN
    SELECT total + COALESCE(SUM(COALESCE((l->>'totalHT')::numeric, 0)), 0)
      INTO total
      FROM jsonb_array_elements(raw->'fraisLines') l;
  END IF;

  -- fraisAnnexes (DevisFactureForm artisan) : champ total_ht
  IF jsonb_typeof(raw->'fraisAnnexes') = 'array' THEN
    SELECT total + COALESCE(SUM(COALESCE((l->>'total_ht')::numeric, 0)), 0)
      INTO total
      FROM jsonb_array_elements(raw->'fraisAnnexes') l;
  END IF;

  -- customTables (BTP corps d'etat) : tableau de tables avec leurs propres lines
  IF jsonb_typeof(raw->'customTables') = 'array' THEN
    SELECT total + COALESCE(SUM(COALESCE((l->>'totalHT')::numeric, 0)), 0)
      INTO total
      FROM jsonb_array_elements(raw->'customTables') t,
           jsonb_array_elements(CASE WHEN jsonb_typeof(t->'lines') = 'array' THEN t->'lines' ELSE '[]'::jsonb END) l;
  END IF;

  RETURN ROUND(total * 100)::bigint;
END;
$$;

COMMENT ON FUNCTION calc_total_ht_cents_from_raw_data(jsonb) IS
  'Calcule total_ht_cents (BIGINT) en sommant toutes les sources de lignes du raw_data : lines, materialLines, fraisLines, fraisAnnexes, customTables';

-- Recalcul des devis avec raw_data
UPDATE devis
SET total_ht_cents = calc_total_ht_cents_from_raw_data(raw_data)
WHERE raw_data IS NOT NULL
  AND total_ht_cents IS DISTINCT FROM calc_total_ht_cents_from_raw_data(raw_data);

-- Recalcul des factures avec raw_data
UPDATE factures
SET total_ht_cents = calc_total_ht_cents_from_raw_data(raw_data)
WHERE raw_data IS NOT NULL
  AND total_ht_cents IS DISTINCT FROM calc_total_ht_cents_from_raw_data(raw_data);
