-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 20260612000003 — Index UNIQUE anti-doublons
-- Date : 2026-06-12 — Audit Phase 2/9 Data Layer
-- Constats : INT-07 (referrals sans UNIQUE sur filleul_id → double récompense
--            possible pour un même filleul), INT-08 (bookings sans anti-doublon
--            de créneau → double réservation du même créneau artisan).
--
-- IMPORTANT : entièrement idempotente (CREATE UNIQUE INDEX IF NOT EXISTS,
-- dédoublonnage rejouable à vide).
--
-- ÉTAT LIVE VÉRIFIÉ (2026-06-13, LOT-1) : 4 groupes de créneaux bookings en
-- DOUBLON existent en prod — même artisan (745a1498…), même heure 09:00,
-- dates 2026-03-11 / 2026-03-12 / 2026-03-13 et 2026-05-13, status
-- 'confirmed' (très probablement des données de TEST du même artisan).
-- Sans traitement, le CREATE UNIQUE INDEX uniq_bookings_artisan_slot
-- ÉCHOUERAIT. Le bloc 2a ci-dessous neutralise les doublons en SOFT
-- (deleted_at = now()) en GARDANT la ligne la plus ancienne (created_at) de
-- chaque groupe — JAMAIS de DELETE : les lignes restent en base, récupérables.
-- REVUE HUMAINE de ces groupes OBLIGATOIRE avant push : requête et procédure
-- dans supabase/REPAIR-RUNBOOK.md, étape 2a-bis.
--
-- PRÉ-REQUIS LIVE restant : l'absence de doublons referrals (INT-07) doit
-- toujours être vérifiée AVANT application (runbook, étape 2a) — aucun doublon
-- referrals constaté par l'audit, donc pas de bloc de dédoublonnage pour eux.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. INT-07 — un filleul ne peut apparaître que dans UN parrainage ──────────
-- filleul_id est NULLABLE (parrainage au stade « clic » sans inscription) :
-- UNIQUE partiel sur les seules lignes où le filleul est identifié.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_referrals_filleul
  ON public.referrals (filleul_id)
  WHERE filleul_id IS NOT NULL;

-- ── 2a. INT-08 — dédoublonnage SOFT préalable des créneaux bookings ──────────
-- Mêmes prédicats que l'index 2b (un booking annulé/soft-deleted/sans créneau
-- ne compte pas). artisan_id IS NOT NULL en plus : des lignes à artisan NULL
-- ne peuvent pas entrer en conflit dans l'index (NULL ≠ NULL) — on ne les
-- touche pas. Keeper par groupe = created_at le plus ancien (NULLS LAST :
-- une ligne sans created_at n'est jamais préférée), départage par id.
-- SOFT uniquement : deleted_at = now(). Aucun DELETE, aucune perte de donnée.
DO $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH classement AS (
    SELECT id,
           row_number() OVER (
             PARTITION BY artisan_id, booking_date, booking_time
             ORDER BY created_at ASC NULLS LAST, id ASC
           ) AS rn
    FROM public.bookings
    WHERE status IS DISTINCT FROM 'cancelled'
      AND deleted_at IS NULL
      AND artisan_id IS NOT NULL
      AND booking_date IS NOT NULL
      AND booking_time IS NOT NULL
  )
  UPDATE public.bookings b
     SET deleted_at = now()
    FROM classement c
   WHERE b.id = c.id
     AND c.rn > 1;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RAISE NOTICE 'INT-08 : % booking(s) en doublon de créneau neutralisé(s) en SOFT (deleted_at = now() — ligne la plus ancienne conservée par groupe, aucune suppression physique)', v_count;
  ELSE
    RAISE NOTICE 'INT-08 : aucun doublon de créneau bookings à neutraliser';
  END IF;
END $$;

-- ── 2b. INT-08 — un créneau (artisan, date, heure) ne peut être réservé qu'une fois
-- Valeurs de status vérifiées dans le code et le schéma :
--   - 052_baseline_missing_tables.sql : CHECK (status IN
--     ('pending','confirmed','cancelled','completed')), NOT NULL DEFAULT 'pending'
--     — mais la colonne live est nullable d'après l'audit, d'où IS DISTINCT FROM.
--   - app/api/bookings/route.ts : crée en 'pending' ou 'confirmed' (auto-accept),
--     et la détection de conflit lit .in('status', ['confirmed','pending']).
-- Prédicat :
--   - status IS DISTINCT FROM 'cancelled' : seule une annulation libère le
--     créneau ('completed' garde le créneau occupé dans l'historique ; NULL est
--     traité comme actif — robuste à la nullabilité live).
--   - deleted_at IS NULL : un booking soft-deleted libère le créneau.
--   - booking_date/booking_time NOT NULL : les lignes sans créneau précis ne
--     participent pas à l'unicité (et NULL ≠ NULL dans un index unique de toute
--     façon) — le prédicat garde l'index petit.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bookings_artisan_slot
  ON public.bookings (artisan_id, booking_date, booking_time)
  WHERE status IS DISTINCT FROM 'cancelled'
    AND deleted_at IS NULL
    AND booking_date IS NOT NULL
    AND booking_time IS NOT NULL;
