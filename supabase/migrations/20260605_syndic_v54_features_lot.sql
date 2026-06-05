-- ════════════════════════════════════════════════════════════════════════════
-- Syndic v54 — lot features net-new : Reservas, Infrações, Enquetes, Checklists.
-- 4 tables scopées cabinet_id (auth.users.id) + RLS stricte (cabinet_id = auth.uid()).
-- À appliquer en prod (Supabase SQL Editor / CLI) pour rendre les 4 modules fonctionnels.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Réservation d'espaces communs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_reservas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  espaco      text NOT NULL DEFAULT '',
  quem        text NOT NULL DEFAULT '',
  data        date,
  hora        text NOT NULL DEFAULT '',
  estado      text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('confirmada','pendente','cancelada')),
  notes       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Infrações ao regulamento ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_infracoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        text NOT NULL DEFAULT '',
  condomino   text NOT NULL DEFAULT '',
  edificio    text NOT NULL DEFAULT '',
  etapa       text NOT NULL DEFAULT 'sinalizada' CHECK (etapa IN ('sinalizada','analise','notificacao','multa','resolvida')),
  multa       numeric(12,2) NOT NULL DEFAULT 0,
  descricao   text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Enquetes & Sondagens ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_enquetes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo      text NOT NULL DEFAULT '',
  descricao   text NOT NULL DEFAULT '',
  estado      text NOT NULL DEFAULT 'ativa' CHECK (estado IN ('ativa','a_decorrer','encerrada')),
  tipo        text NOT NULL DEFAULT '',
  edificio    text NOT NULL DEFAULT '',
  prazo       date,
  total       integer NOT NULL DEFAULT 0,        -- nb total de fractions consultées
  options     jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{ "label": str, "votes": int }]
  anonima     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Checklists ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_checklists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo      text NOT NULL DEFAULT '',
  tipo        text NOT NULL DEFAULT '',
  edificio    text NOT NULL DEFAULT '',
  estado      text NOT NULL DEFAULT 'em_curso' CHECK (estado IN ('em_curso','concluida')),
  items       jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{ "label": str, "done": bool }]
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Index cabinet_id ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS syndic_reservas_cabinet_idx    ON syndic_reservas (cabinet_id);
CREATE INDEX IF NOT EXISTS syndic_infracoes_cabinet_idx   ON syndic_infracoes (cabinet_id);
CREATE INDEX IF NOT EXISTS syndic_enquetes_cabinet_idx    ON syndic_enquetes (cabinet_id);
CREATE INDEX IF NOT EXISTS syndic_checklists_cabinet_idx  ON syndic_checklists (cabinet_id);

-- ── RLS : isolation stricte par cabinet (cabinet_id = auth.uid()) ─────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['syndic_reservas','syndic_infracoes','syndic_enquetes','syndic_checklists'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_owner ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_owner ON %I FOR ALL TO authenticated USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid())',
      t, t
    );
  END LOOP;
END $$;
