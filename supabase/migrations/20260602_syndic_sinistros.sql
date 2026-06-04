-- syndic_sinistros : sinistres assurance d'un cabinet syndic (Phase 3 — slice 5)
--
-- Backend du module v54 ModSinistros (pipeline Declaração → Indemnização →
-- Encerramento). RLS identique au gabarit (cabinet_id = auth.uid()).

CREATE TABLE IF NOT EXISTS syndic_sinistros (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  immeuble          TEXT NOT NULL DEFAULT '',
  tipo              TEXT NOT NULL DEFAULT '',
  descricao         TEXT NOT NULL DEFAULT '',
  seguradora        TEXT NOT NULL DEFAULT '',
  statut            TEXT NOT NULL DEFAULT 'declarado' CHECK (statut IN (
    'declarado', 'atribuido', 'peritagem', 'resolucao', 'indemnizado', 'encerrado'
  )),
  montante_estimado NUMERIC NOT NULL DEFAULT 0,
  indemnizacao      NUMERIC NOT NULL DEFAULT 0,
  data_declaracao   DATE,
  urgente           BOOLEAN NOT NULL DEFAULT FALSE,
  notes             TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS syndic_sinistros_cabinet_idx ON syndic_sinistros (cabinet_id);
CREATE INDEX IF NOT EXISTS syndic_sinistros_statut_idx ON syndic_sinistros (cabinet_id, statut);

ALTER TABLE syndic_sinistros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "syndic_sinistros_cabinet_full_access"
  ON syndic_sinistros
  FOR ALL
  USING (cabinet_id = auth.uid())
  WITH CHECK (cabinet_id = auth.uid());
