-- ════════════════════════════════════════════════════════════════════════════
-- Syndic v54 — lot 3 : Calendário Regulamentar + Contacto Proativo (campanhas).
-- 2 tables scopées cabinet_id + RLS stricte. À appliquer en prod (Supabase SQL Editor).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Obrigações regulamentares / calendário legal ─────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_obrigacoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edificio    text NOT NULL DEFAULT '',
  tipo        text NOT NULL DEFAULT '',
  descricao   text NOT NULL DEFAULT '',
  prazo       date,
  concluido   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Campanhas de contacto proativo ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_campanhas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          text NOT NULL DEFAULT '',
  tipo          text NOT NULL DEFAULT '',
  edificio      text NOT NULL DEFAULT '',
  destinatarios integer NOT NULL DEFAULT 0,
  estado        text NOT NULL DEFAULT 'rascunho' CHECK (estado IN ('rascunho','agendada','enviada')),
  mensagem      text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS syndic_obrigacoes_cabinet_idx ON syndic_obrigacoes (cabinet_id);
CREATE INDEX IF NOT EXISTS syndic_campanhas_cabinet_idx  ON syndic_campanhas (cabinet_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['syndic_obrigacoes','syndic_campanhas'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_owner ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_owner ON %I FOR ALL TO authenticated USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid())',
      t, t
    );
  END LOOP;
END $$;
