-- Phase 3 v54 — syndic_caderneta (Caderneta de Manutenção & Técnica)
-- Module : ModCadernetaMan. RLS : cabinet_id = auth.uid() (isolation par cabinet).
CREATE TABLE IF NOT EXISTS syndic_caderneta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE,
  estado TEXT NOT NULL DEFAULT 'realizado' CHECK (estado IN ('realizado','planeado','em-curso','cancelado')),
  natureza TEXT NOT NULL DEFAULT '',
  edificio TEXT NOT NULL DEFAULT '',
  localizacao TEXT NOT NULL DEFAULT '',
  prestador TEXT NOT NULL DEFAULT '',
  custo NUMERIC NOT NULL DEFAULT 0,
  garantia TEXT NOT NULL DEFAULT '',
  cee TEXT NOT NULL DEFAULT 'na',
  notas TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS syndic_caderneta_cabinet_idx ON syndic_caderneta (cabinet_id);
ALTER TABLE syndic_caderneta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "syndic_caderneta_cabinet_full_access" ON syndic_caderneta;
CREATE POLICY "syndic_caderneta_cabinet_full_access" ON syndic_caderneta FOR ALL USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid());
