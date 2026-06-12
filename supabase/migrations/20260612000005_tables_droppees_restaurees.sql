-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 20260612000005 — Restauration des tables droppées à la main
-- Date : 2026-06-12 — Audit Phase 2/9 Data Layer
-- Constats : 5 migrations enregistrées au registre dont les objets ont été
--            DROPpés manuellement en prod (025 rfqs/rfq_items/offers/
--            offer_items/suppliers, 028 btp_candidature_messages, 040
--            pt_fiscal_*, 046 analytics_events, 20260412 background_jobs).
--            Le code déployé écrit toujours sur RFQ (app/api/rfq/*,
--            components/dashboard/RFQSection.tsx) et analytics
--            (app/api/analytics/track/route.ts) → échecs silencieux en prod.
--
-- Recréés ici : rfqs, rfq_items, offers, offer_items, suppliers (source :
--   025_rfq_btp.sql + correctifs FK de 055_schema_integrity_fixes.sql) et
--   analytics_events (source : 046_analytics_events.sql).
-- NON recréés (volontaire) :
--   - pt_fiscal_* : lockdown 082 (Vitfix non certifié AT — Decreto-Lei 28/2019),
--     scope dormant.
--   - background_jobs : lib/queue.ts n'est importé nulle part — code mort.
--   - btp_candidature_messages (028) : plus aucune référence dans le code ; la
--     table reviendra mécaniquement si 028 est rejouée par `db push` après
--     `migration repair --status reverted 028` (cf. REPAIR-RUNBOOK.md, étape 4).
--
-- IMPORTANT : entièrement idempotente (IF NOT EXISTS + DROP POLICY IF EXISTS).
-- Compatible avec un replay préalable de 025/046 par `db push` (no-op partiel).
-- Les policies sont recréées avec auth.*() encapsulé en (SELECT auth.*())
-- (pattern initplan de 20260610000002_rls_initplan_wrap.sql).
-- ══════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- A. Système RFQ (source : 025, FK durcies par 055)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rfqs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country TEXT NOT NULL CHECK (country IN ('FR', 'PT')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'closed')),
  message TEXT,
  title TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rfq_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_ref TEXT,
  category TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'unité',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT NOT NULL CHECK (country IN ('FR', 'PT')),
  categories TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  supplier_id UUID,
  supplier_name TEXT NOT NULL,
  supplier_email TEXT NOT NULL,
  total_price NUMERIC,
  delivery_days INTEGER,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.offer_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  rfq_item_id UUID,
  product_name TEXT NOT NULL,
  unit_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  total_price NUMERIC GENERATED ALWAYS AS (unit_price * quantity) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK durcies (équivalent 055 — DB-15) : noms identiques à 055 pour cohérence.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_offers_supplier' AND conrelid = 'public.offers'::regclass
  ) THEN
    ALTER TABLE public.offers
      ADD CONSTRAINT fk_offers_supplier
      FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_offer_items_rfq_item' AND conrelid = 'public.offer_items'::regclass
  ) THEN
    ALTER TABLE public.offer_items
      ADD CONSTRAINT fk_offer_items_rfq_item
      FOREIGN KEY (rfq_item_id) REFERENCES public.rfq_items(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Index (source : 025)
CREATE INDEX IF NOT EXISTS rfqs_user_id_idx ON public.rfqs(user_id);
CREATE INDEX IF NOT EXISTS rfqs_status_idx ON public.rfqs(status);
CREATE INDEX IF NOT EXISTS rfq_items_rfq_id_idx ON public.rfq_items(rfq_id);
CREATE INDEX IF NOT EXISTS offers_rfq_id_idx ON public.offers(rfq_id);
CREATE INDEX IF NOT EXISTS offers_token_idx ON public.offers(token);
-- FK supplier_id indexée (lint unindexed_foreign_keys, cf. 20260610000001)
CREATE INDEX IF NOT EXISTS idx_offers_supplier_id ON public.offers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_offer_items_offer_id ON public.offer_items(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_items_rfq_item_id ON public.offer_items(rfq_item_id);

-- RLS + policies (source : 025, quals encapsulés initplan)
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rfqs_user_policy" ON public.rfqs;
CREATE POLICY "rfqs_user_policy" ON public.rfqs
  FOR ALL USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "rfq_items_user_policy" ON public.rfq_items;
CREATE POLICY "rfq_items_user_policy" ON public.rfq_items
  FOR ALL USING (
    rfq_id IN (SELECT id FROM public.rfqs WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "offers_user_policy" ON public.offers;
CREATE POLICY "offers_user_policy" ON public.offers
  FOR SELECT USING (
    rfq_id IN (SELECT id FROM public.rfqs WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "rfqs_service_policy" ON public.rfqs;
CREATE POLICY "rfqs_service_policy" ON public.rfqs FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "rfq_items_service_policy" ON public.rfq_items;
CREATE POLICY "rfq_items_service_policy" ON public.rfq_items FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "offers_service_policy" ON public.offers;
CREATE POLICY "offers_service_policy" ON public.offers FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "offer_items_service_policy" ON public.offer_items;
CREATE POLICY "offer_items_service_policy" ON public.offer_items FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "suppliers_read_policy" ON public.suppliers;
CREATE POLICY "suppliers_read_policy" ON public.suppliers FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "suppliers_service_policy" ON public.suppliers;
CREATE POLICY "suppliers_service_policy" ON public.suppliers FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Seed fournisseurs (source : 025) — garde NOT EXISTS par email (la table n'a
-- pas d'UNIQUE sur email : le ON CONFLICT DO NOTHING de 025 ne protégeait rien).
INSERT INTO public.suppliers (name, email, country, categories)
SELECT v.name, v.email, v.country, v.categories
FROM (VALUES
  ('Pro Matériaux France',  'devis@promateriaux.fr',      'FR', ARRAY['gros_oeuvre', 'isolation', 'menuiserie']),
  ('BTP Fournitures Pro',   'contact@btpfournitures.fr',  'FR', ARRAY['plomberie', 'electricite', 'carrelage']),
  ('Distrib Pro Bâtiment',  'rfq@distribpro.fr',          'FR', ARRAY['toiture', 'charpente', 'enduit']),
  ('Materiais Pro Portugal','orcamentos@materiaispro.pt', 'PT', ARRAY['alvenaria', 'isolamento', 'carpintaria']),
  ('Fornecedor BTP PT',     'contacto@fornecedorbtp.pt',  'PT', ARRAY['canalizacao', 'electricidade', 'pavimento'])
) AS v(name, email, country, categories)
WHERE NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.email = v.email);

-- ════════════════════════════════════════════════════════════════════════════
-- B. analytics_events (source : 046)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  page_url TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created
  ON public.analytics_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created
  ON public.analytics_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session
  ON public.analytics_events (session_id);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events_service_role_all" ON public.analytics_events;
CREATE POLICY "analytics_events_service_role_all" ON public.analytics_events
  FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- Rétention 90 jours (RGPD proportionnalité) — garde pg_cron défensive
-- (pattern 058_cron_cleanup.sql : warning au lieu d'un échec si pg_cron absent).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- cron.schedule(jobname, ...) est un upsert : pas de doublon de job.
    PERFORM cron.schedule(
      'analytics_events_cleanup',
      '0 4 * * 0',
      $job$DELETE FROM public.analytics_events WHERE created_at < NOW() - INTERVAL '90 days'$job$
    );
  ELSE
    RAISE WARNING 'pg_cron non disponible — purge analytics_events (90 j) non planifiée. Activer pg_cron : Dashboard > Database > Extensions.';
  END IF;
END $$;
