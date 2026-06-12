-- syndic_elevadores : parc d'ascenseurs d'un cabinet syndic (Phase 3 — slice 4)
--
-- Backend du module v54 ModElevadores (obligation légale DL 320/2002). Suivi
-- inspections périodiques (2/4/6 ans selon catégorie), contrat EMA, état de
-- conformité. RLS identique au gabarit (cabinet_id = auth.uid()).

CREATE TABLE IF NOT EXISTS syndic_elevadores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  immeuble         TEXT NOT NULL DEFAULT '',
  marca            TEXT NOT NULL DEFAULT '',
  categoria        TEXT NOT NULL DEFAULT 'habitacional' CHECK (categoria IN (
    'comercial', 'misto', 'habitacional'
  )),
  ema              TEXT NOT NULL DEFAULT '',
  ultima_inspecao  DATE,
  proxima_inspecao DATE,
  estado           TEXT NOT NULL DEFAULT 'conforme' CHECK (estado IN (
    'conforme', 'prazo', 'atraso'
  )),
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS syndic_elevadores_cabinet_idx ON syndic_elevadores (cabinet_id);
CREATE INDEX IF NOT EXISTS syndic_elevadores_prox_idx ON syndic_elevadores (cabinet_id, proxima_inspecao);

ALTER TABLE syndic_elevadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "syndic_elevadores_cabinet_full_access"
  ON syndic_elevadores
  FOR ALL
  USING (cabinet_id = auth.uid())
  WITH CHECK (cabinet_id = auth.uid());
