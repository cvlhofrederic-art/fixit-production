-- Phase 3 v54 — syndic_decl_encargos (Declaração de Encargos — Lei 8/2022)
-- Module : ModDeclEncargos. RLS : cabinet_id = auth.uid() (isolation par cabinet).
CREATE TABLE IF NOT EXISTS syndic_decl_encargos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fracao TEXT NOT NULL DEFAULT '',
  condomino TEXT NOT NULL DEFAULT '',
  edificio TEXT NOT NULL DEFAULT '',
  data_pedido DATE,
  prazo_limite DATE,
  encargos_correntes NUMERIC NOT NULL DEFAULT 0,
  divida NUMERIC NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','emitida','concluida')),
  notas TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS syndic_decl_encargos_cabinet_idx ON syndic_decl_encargos (cabinet_id);
ALTER TABLE syndic_decl_encargos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "syndic_decl_encargos_cabinet_full_access" ON syndic_decl_encargos;
CREATE POLICY "syndic_decl_encargos_cabinet_full_access" ON syndic_decl_encargos FOR ALL USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid());
