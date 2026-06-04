-- syndic_prazos_legais : obligations réglementaires d'un cabinet syndic (Phase 3 — slice 7)
--
-- Backend du module v54 ModPrazosLegais (échéances légales multi-immeubles).
-- RLS identique au gabarit (cabinet_id = auth.uid()).

CREATE TABLE IF NOT EXISTS syndic_prazos_legais (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  immeuble    TEXT NOT NULL DEFAULT '',
  titulo      TEXT NOT NULL DEFAULT '',
  tipo        TEXT NOT NULL DEFAULT '',
  data_limite DATE,
  statut      TEXT NOT NULL DEFAULT 'pendente' CHECK (statut IN (
    'pendente', 'realizado'
  )),
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS syndic_prazos_cabinet_idx ON syndic_prazos_legais (cabinet_id);
CREATE INDEX IF NOT EXISTS syndic_prazos_data_idx ON syndic_prazos_legais (cabinet_id, data_limite);

ALTER TABLE syndic_prazos_legais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "syndic_prazos_legais_cabinet_full_access"
  ON syndic_prazos_legais
  FOR ALL
  USING (cabinet_id = auth.uid())
  WITH CHECK (cabinet_id = auth.uid());
