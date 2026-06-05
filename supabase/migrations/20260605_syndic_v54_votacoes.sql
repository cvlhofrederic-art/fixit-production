-- ════════════════════════════════════════════════════════════════════════════
-- Syndic v54 — lot 4 : Votação Online AG (deliberações + permilagem).
-- 1 table scopée cabinet_id + RLS stricte. À appliquer en prod (Supabase SQL Editor).
-- (ModMultiImoveis du même lot se câble sur data.immeubles → aucune table nouvelle.)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS syndic_votacoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo      text NOT NULL DEFAULT '',
  descricao   text NOT NULL DEFAULT '',
  edificio    text NOT NULL DEFAULT '',
  estado      text NOT NULL DEFAULT 'aberta' CHECK (estado IN ('aberta','aprovada','rejeitada','encerrada')),
  maioria     text NOT NULL DEFAULT 'simples' CHECK (maioria IN ('simples','qualificada','unanimidade')),
  artigo      text NOT NULL DEFAULT '',
  prazo       date,
  perm_total  integer NOT NULL DEFAULT 1000,         -- permilagem totale de l'immeuble
  options     jsonb NOT NULL DEFAULT '[]'::jsonb,      -- [{ "label": str, "perm": int }]
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS syndic_votacoes_cabinet_idx ON syndic_votacoes (cabinet_id);

DO $$
BEGIN
  EXECUTE 'ALTER TABLE syndic_votacoes ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS syndic_votacoes_owner ON syndic_votacoes';
  EXECUTE 'CREATE POLICY syndic_votacoes_owner ON syndic_votacoes FOR ALL TO authenticated USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid())';
END $$;
