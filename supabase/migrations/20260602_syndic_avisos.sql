-- syndic_avisos : quadro de avisos d'un cabinet syndic (Phase 3 — slice 8)
--
-- Backend du module v54 ModQuadroAvisos (communication aux condóminos).
-- RLS identique au gabarit (cabinet_id = auth.uid()).

CREATE TABLE IF NOT EXISTS syndic_avisos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  immeuble    TEXT NOT NULL DEFAULT '',
  titulo      TEXT NOT NULL DEFAULT '',
  descricao   TEXT NOT NULL DEFAULT '',
  categoria   TEXT NOT NULL DEFAULT 'outro' CHECK (categoria IN (
    'manutencao', 'assembleia', 'financeiro', 'seguranca', 'social', 'outro'
  )),
  prioridade  TEXT NOT NULL DEFAULT 'normal' CHECK (prioridade IN (
    'normal', 'importante', 'urgente'
  )),
  fixado      BOOLEAN NOT NULL DEFAULT FALSE,
  views       INTEGER NOT NULL DEFAULT 0,
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS syndic_avisos_cabinet_idx ON syndic_avisos (cabinet_id, created_at DESC);

ALTER TABLE syndic_avisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "syndic_avisos_cabinet_full_access"
  ON syndic_avisos
  FOR ALL
  USING (cabinet_id = auth.uid())
  WITH CHECK (cabinet_id = auth.uid());
