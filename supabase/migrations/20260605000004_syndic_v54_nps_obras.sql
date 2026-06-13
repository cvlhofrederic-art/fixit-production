-- ════════════════════════════════════════════════════════════════════════════
-- Syndic v54 — lot 7 : NPS Pós-Intervenção + Orçamentos & Obras (3 devis).
-- 2 tables scopées cabinet_id + RLS stricte. À appliquer en prod (Supabase SQL Editor).
-- ════════════════════════════════════════════════════════════════════════════

-- ── NPS pós-intervenção (réponses) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_nps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prestador   text NOT NULL DEFAULT '',
  condomino   text NOT NULL DEFAULT '',
  intervencao text NOT NULL DEFAULT '',
  tipo        text NOT NULL DEFAULT '',
  nota        integer NOT NULL DEFAULT 0 CHECK (nota >= 0 AND nota <= 10),
  comentario  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Orçamentos & Obras (3 devis, Lei 8/2022) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_obras (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo         text NOT NULL DEFAULT '',
  tipo           text NOT NULL DEFAULT '',
  descricao      text NOT NULL DEFAULT '',
  local          text NOT NULL DEFAULT '',
  prazo          date,
  estado         text NOT NULL DEFAULT 'orcamentacao' CHECK (estado IN ('orcamentacao','aprovacao_ag','execucao','concluida')),
  orcamento      numeric(12,2) NOT NULL DEFAULT 0,
  empresa        text NOT NULL DEFAULT '',
  num_orcamentos integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS syndic_nps_cabinet_idx   ON syndic_nps (cabinet_id);
CREATE INDEX IF NOT EXISTS syndic_obras_cabinet_idx ON syndic_obras (cabinet_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['syndic_nps','syndic_obras'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_owner ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_owner ON %I FOR ALL TO authenticated USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid())', t, t);
  END LOOP;
END $$;
