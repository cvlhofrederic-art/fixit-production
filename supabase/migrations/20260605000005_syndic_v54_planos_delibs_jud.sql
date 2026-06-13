-- ════════════════════════════════════════════════════════════════════════════
-- Syndic v54 — lot 2 « gestão » : Plano de Manutenção, Tracker de Deliberações,
-- Notificações Judiciais. 3 tables scopées cabinet_id (auth.users.id) + RLS stricte.
-- À appliquer en prod (Supabase SQL Editor) pour rendre les 3 modules fonctionnels.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Plano de Manutenção (DL 555/99 art. 89.°) ────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_planos_man (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo        text NOT NULL DEFAULT '',
  edificio      text NOT NULL DEFAULT '',
  estado        text NOT NULL DEFAULT 'preparacao' CHECK (estado IN ('preparacao','aprovado','concluido')),
  orcamento     numeric(12,2) NOT NULL DEFAULT 0,
  ano_inicio    integer,
  periodicidade text NOT NULL DEFAULT '',
  descricao     text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Tracker de Deliberações (CC art. 1436.° — 15 dias úteis) ─────────────────
CREATE TABLE IF NOT EXISTS syndic_deliberacoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deliberacao  text NOT NULL DEFAULT '',
  ag           text NOT NULL DEFAULT '',
  responsavel  text NOT NULL DEFAULT '',
  prazo        date,
  estado       text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','em_curso','concluida','atrasada','bloqueada')),
  origem       text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','ia')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Notificações Judiciais (Lei 8/2022 art. 1436.° o) e p)) ──────────────────
CREATE TABLE IF NOT EXISTS syndic_processos_jud (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo         text NOT NULL DEFAULT '',
  contraparte  text NOT NULL DEFAULT '',
  processo     text NOT NULL DEFAULT '',
  data         date,
  prazo        date,
  estado       text NOT NULL DEFAULT 'ativo' CHECK (estado IN ('ativo','arquivado')),
  valor        numeric(12,2) NOT NULL DEFAULT 0,
  descricao    text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Index cabinet_id ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS syndic_planos_man_cabinet_idx    ON syndic_planos_man (cabinet_id);
CREATE INDEX IF NOT EXISTS syndic_deliberacoes_cabinet_idx  ON syndic_deliberacoes (cabinet_id);
CREATE INDEX IF NOT EXISTS syndic_processos_jud_cabinet_idx ON syndic_processos_jud (cabinet_id);

-- ── RLS : isolation stricte par cabinet ──────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['syndic_planos_man','syndic_deliberacoes','syndic_processos_jud'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_owner ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_owner ON %I FOR ALL TO authenticated USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid())',
      t, t
    );
  END LOOP;
END $$;
