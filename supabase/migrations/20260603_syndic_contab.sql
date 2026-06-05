-- Phase 3 v54 — Contabilidade Condomínio (ModContabCond) — 4 entités plates, RLS cabinet_id = auth.uid()

CREATE TABLE IF NOT EXISTS syndic_contab_fracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identificacao TEXT NOT NULL DEFAULT '',
  permilagem NUMERIC NOT NULL DEFAULT 0,
  proprietario TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'habitacao',
  notas TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS syndic_contab_fracoes_cabinet_idx ON syndic_contab_fracoes (cabinet_id);
ALTER TABLE syndic_contab_fracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "syndic_contab_fracoes_cabinet_full_access" ON syndic_contab_fracoes;
CREATE POLICY "syndic_contab_fracoes_cabinet_full_access" ON syndic_contab_fracoes FOR ALL USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid());

CREATE TABLE IF NOT EXISTS syndic_contab_chamadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT '',
  edificio TEXT NOT NULL DEFAULT '',
  data_emissao DATE,
  data_vencimento DATE,
  montante NUMERIC NOT NULL DEFAULT 0,
  distribuicao TEXT NOT NULL DEFAULT 'milesimos',
  notas TEXT NOT NULL DEFAULT '',
  liquidadas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS syndic_contab_chamadas_cabinet_idx ON syndic_contab_chamadas (cabinet_id);
ALTER TABLE syndic_contab_chamadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "syndic_contab_chamadas_cabinet_full_access" ON syndic_contab_chamadas;
CREATE POLICY "syndic_contab_chamadas_cabinet_full_access" ON syndic_contab_chamadas FOR ALL USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid());

CREATE TABLE IF NOT EXISTS syndic_contab_diario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE,
  tipo TEXT NOT NULL DEFAULT 'debito' CHECK (tipo IN ('debito','credito')),
  conta TEXT NOT NULL DEFAULT '',
  montante NUMERIC NOT NULL DEFAULT 0,
  descricao TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS syndic_contab_diario_cabinet_idx ON syndic_contab_diario (cabinet_id);
ALTER TABLE syndic_contab_diario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "syndic_contab_diario_cabinet_full_access" ON syndic_contab_diario;
CREATE POLICY "syndic_contab_diario_cabinet_full_access" ON syndic_contab_diario FOR ALL USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid());

CREATE TABLE IF NOT EXISTS syndic_contab_orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ano TEXT NOT NULL DEFAULT '',
  edificio TEXT NOT NULL DEFAULT '',
  total_previsto NUMERIC NOT NULL DEFAULT 0,
  rubricas TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  aprovado BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS syndic_contab_orcamentos_cabinet_idx ON syndic_contab_orcamentos (cabinet_id);
ALTER TABLE syndic_contab_orcamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "syndic_contab_orcamentos_cabinet_full_access" ON syndic_contab_orcamentos;
CREATE POLICY "syndic_contab_orcamentos_cabinet_full_access" ON syndic_contab_orcamentos FOR ALL USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid());
