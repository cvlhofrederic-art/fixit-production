-- ════════════════════════════════════════════════════════════════════════════
-- Syndic v54 — lot 8 : Planeamento (eventos agenda hebdomadaire).
-- 1 table scopée cabinet_id + RLS stricte. À appliquer en prod (Supabase SQL Editor).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS syndic_eventos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo       text NOT NULL DEFAULT '',
  dia          text NOT NULL DEFAULT 'mon' CHECK (dia IN ('mon','tue','wed','thu','fri','sat','sun')),
  hora_inicio  text NOT NULL DEFAULT '09:00',
  hora_fim     text NOT NULL DEFAULT '10:00',
  tipo         text NOT NULL DEFAULT 'gold' CHECK (tipo IN ('gold','sage','amber','rust','green')),
  responsavel  text NOT NULL DEFAULT '',
  edificio     text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS syndic_eventos_cabinet_idx ON syndic_eventos (cabinet_id);

DO $$
BEGIN
  EXECUTE 'ALTER TABLE syndic_eventos ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS syndic_eventos_owner ON syndic_eventos';
  EXECUTE 'CREATE POLICY syndic_eventos_owner ON syndic_eventos FOR ALL TO authenticated USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid())';
END $$;
