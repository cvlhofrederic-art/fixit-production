-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 20260612000003 — Index UNIQUE anti-doublons
-- Date : 2026-06-12 — Audit Phase 2/9 Data Layer
-- Constats : INT-07 (referrals sans UNIQUE sur filleul_id → double récompense
--            possible pour un même filleul), INT-08 (bookings sans anti-doublon
--            de créneau → double réservation du même créneau artisan).
--
-- IMPORTANT : entièrement idempotente (CREATE UNIQUE INDEX IF NOT EXISTS).
-- PRÉ-REQUIS LIVE : vérifier l'absence de doublons existants AVANT application
-- (requêtes de contrôle dans supabase/REPAIR-RUNBOOK.md, étape 2) — sinon le
-- CREATE UNIQUE INDEX échoue.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. INT-07 — un filleul ne peut apparaître que dans UN parrainage ──────────
-- filleul_id est NULLABLE (parrainage au stade « clic » sans inscription) :
-- UNIQUE partiel sur les seules lignes où le filleul est identifié.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_referrals_filleul
  ON public.referrals (filleul_id)
  WHERE filleul_id IS NOT NULL;

-- ── 2. INT-08 — un créneau (artisan, date, heure) ne peut être réservé qu'une fois
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
