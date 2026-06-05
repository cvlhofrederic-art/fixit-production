-- Phase 3 v54 — FCR (Fundo Comum de Reserva, DL 268/94 art.4 · CC art.1424)
-- Module : ModFCR (deux entités). RLS : cabinet_id = auth.uid() (isolation par cabinet).

CREATE TABLE IF NOT EXISTS syndic_fcr_edificios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  endereco TEXT NOT NULL DEFAULT '',
  orcamento_anual NUMERIC NOT NULL DEFAULT 0,
  percentagem_fcr NUMERIC NOT NULL DEFAULT 10,
  saldo_inicial NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS syndic_fcr_edificios_cabinet_idx ON syndic_fcr_edificios (cabinet_id);
ALTER TABLE syndic_fcr_edificios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "syndic_fcr_edificios_cabinet_full_access" ON syndic_fcr_edificios;
CREATE POLICY "syndic_fcr_edificios_cabinet_full_access" ON syndic_fcr_edificios FOR ALL USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid());

CREATE TABLE IF NOT EXISTS syndic_fcr_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edificio TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'entrada' CHECK (tipo IN ('entrada','saida')),
  data DATE,
  montante NUMERIC NOT NULL DEFAULT 0,
  descricao TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS syndic_fcr_movimentos_cabinet_idx ON syndic_fcr_movimentos (cabinet_id);
ALTER TABLE syndic_fcr_movimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "syndic_fcr_movimentos_cabinet_full_access" ON syndic_fcr_movimentos;
CREATE POLICY "syndic_fcr_movimentos_cabinet_full_access" ON syndic_fcr_movimentos FOR ALL USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid());
