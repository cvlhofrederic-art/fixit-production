-- syndic_vistorias : vistorias techniques d'un cabinet syndic (Phase 3 — slice 6)
--
-- Backend du module v54 ModVistoria (checklist terrain → relatório PDF).
-- RLS identique au gabarit (cabinet_id = auth.uid()).

CREATE TABLE IF NOT EXISTS syndic_vistorias (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  immeuble           TEXT NOT NULL DEFAULT '',
  titulo             TEXT NOT NULL DEFAULT '',
  statut             TEXT NOT NULL DEFAULT 'em_curso' CHECK (statut IN (
    'em_curso', 'concluida', 'enviada'
  )),
  pontos_vigiar      INTEGER NOT NULL DEFAULT 0,
  pontos_deficientes INTEGER NOT NULL DEFAULT 0,
  data_vistoria      DATE,
  notes              TEXT NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS syndic_vistorias_cabinet_idx ON syndic_vistorias (cabinet_id);

ALTER TABLE syndic_vistorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "syndic_vistorias_cabinet_full_access"
  ON syndic_vistorias
  FOR ALL
  USING (cabinet_id = auth.uid())
  WITH CHECK (cabinet_id = auth.uid());
