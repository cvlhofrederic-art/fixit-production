-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 20260612000004 — Publication Realtime + Storage
-- Date : 2026-06-12 — Audit Phase 2/9 Data Layer
-- Constats : C-01 (bookings, booking_messages, syndic_emails_analysed sont
--            souscrites par le code — dont useAlfredoNotifications — mais
--            absentes de la publication supabase_realtime → aucune notification
--            ne circule), bucket `tracking` jamais créé en migration (le code
--            le crée à la volée : app/api/tracking/update/route.ts), MIG-04
--            (policy storage permissive non tracée auth_write_artisan_photos —
--            088_fix_artisan_photos_rls.sql droppait le mauvais nom).
--
-- IMPORTANT : entièrement idempotente.
--
-- ⚠️ OWNERSHIP storage (LOT-2/LOT-3, 2026-06-13) : storage.objects (et
-- storage.buckets) appartiennent à supabase_storage_admin. Le rôle qui exécute
-- les migrations (postgres) ne peut PAS y faire de DDL (DROP/CREATE POLICY) —
-- le SQL Editor du Dashboard a la MÊME limite (il exécute en postgres).
-- Les statements storage ci-dessous sont donc wrappés DO $$ … EXCEPTION WHEN
-- insufficient_privilege : la migration n'échoue pas, elle émet un WARNING et
-- l'action est à reporter manuellement via Dashboard > Storage (étape 5-bis
-- du REPAIR-RUNBOOK). Le INSERT storage.buckets est du DML normalement couvert
-- par les GRANTs standards — gardé aussi par précaution.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. C-01 — Publication Realtime ────────────────────────────────────────────
-- Garde idempotente via pg_publication_tables (ALTER PUBLICATION ... ADD TABLE
-- échoue si la table est déjà publiée) + garde to_regclass (drift).
DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'Publication supabase_realtime absente — étape Realtime ignorée';
    RETURN;
  END IF;

  FOREACH t IN ARRAY ARRAY['bookings', 'booking_messages', 'syndic_emails_analysed']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Table public.% absente — non publiée', t;
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Realtime : table public.% ajoutée à supabase_realtime', t;
    END IF;
  END LOOP;
END $$;

-- ── 2. Bucket storage `tracking` ──────────────────────────────────────────────
-- Flux vérifié dans le code :
--   - écriture : app/api/tracking/update/route.ts → supabaseAdmin.storage
--     .from('tracking').upload(...) — service_role.
--   - lecture/suppression : app/api/tracking/[token]/route.ts → supabaseAdmin
--     .storage.from('tracking').download/remove — service_role.
-- Le flux est donc 100 % service_role (qui bypasse la RLS de storage.objects).
-- Policies minimales = AUCUNE policy pour anon/authenticated : bucket privé,
-- deny par défaut. On ne crée volontairement aucune policy storage.objects ici.
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('tracking', 'tracking', false)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'storage.buckets : privilèges insuffisants pour créer le bucket "tracking" — à créer via Dashboard > Storage > New bucket (privé, public = false). Cf. REPAIR-RUNBOOK étape 5-bis.';
END $$;

-- ── 3. MIG-04 — retrait de la policy permissive non tracée ────────────────────
-- La policy owner légitime (artisan_photos_owner_insert, vérifiée en live par
-- l'audit) reste en place pour les uploads des artisans.
-- DDL sur storage.objects → très probablement insufficient_privilege (cf.
-- en-tête) : le WARNING renvoie vers l'étape manuelle Dashboard.
DO $$
BEGIN
  DROP POLICY IF EXISTS auth_write_artisan_photos ON storage.objects;
  RAISE NOTICE 'MIG-04 : policy auth_write_artisan_photos supprimée (ou déjà absente)';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'storage.objects : privilèges insuffisants (owner = supabase_storage_admin) — supprimer la policy auth_write_artisan_photos via Dashboard > Storage > Policies. Cf. REPAIR-RUNBOOK étape 5-bis.';
END $$;
