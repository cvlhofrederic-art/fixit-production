-- =============================================================================
-- Migration : Hygiene — fige search_path sur 9 functions SECURITY INVOKER
-- Date     : 2026-05-19
-- =============================================================================
-- Closes advisor `function_search_path_mutable` (WARN x9, niveau hygiene).
--
-- Le `search_path` non figé permet à un appelant de rediriger les références
-- non qualifiées d'une function vers un schema malicieux (privilege escalation
-- théorique). Aucune des 9 functions n'est SECURITY DEFINER, donc le risque
-- réel est faible — mais le linter Supabase signale par convention.
--
-- Fix : `SET search_path = 'public'` (et non '' vide) car ces fonctions
-- référencent des objets non qualifiés du schema `public` (tables, type
-- `vector` de l'extension pgvector). Le `public` explicite fige la résolution
-- sans casser le corps existant.
--
-- Purement additif : ajoute un attribut search_path aux 9 functions sans
-- toucher leur corps. Rollback trivial via `RESET search_path`.
-- =============================================================================

BEGIN;

-- Triggers (5)
ALTER FUNCTION public.block_pt_fiscal_emission()       SET search_path = 'public';
ALTER FUNCTION public.update_appel_charge_modtime()    SET search_path = 'public';
ALTER FUNCTION public.update_automation_modtime()      SET search_path = 'public';
ALTER FUNCTION public.update_legal_corpus_updated_at() SET search_path = 'public';
ALTER FUNCTION public.validate_devis_transition()      SET search_path = 'public';
ALTER FUNCTION public.validate_facture_transition()    SET search_path = 'public';

-- Utility function (1) — compute total HT cents from raw_data jsonb
ALTER FUNCTION public.calc_total_ht_cents_from_raw_data(jsonb) SET search_path = 'public';

-- Legal corpus hybrid search functions (2) — pgvector + BM25
-- Le type `vector` est défini dans l'extension pgvector installée dans `public`
-- (cf. advisor `extension_in_public` non corrigé dans cette migration).
ALTER FUNCTION public.search_legal_corpus_hybrid_fr(text, vector, integer) SET search_path = 'public';
ALTER FUNCTION public.search_legal_corpus_hybrid_pt(text, vector, integer) SET search_path = 'public';

COMMIT;
