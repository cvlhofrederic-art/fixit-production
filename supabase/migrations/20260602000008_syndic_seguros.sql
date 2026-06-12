-- syndic_seguros : apólices de seguro d'un cabinet syndic (Phase 3 — slice 2)
--
-- Backend du module v54 ModSeguros (jusqu'ici mock/empty). Polices par immeuble :
-- assureur, type de couverture, prime annuelle, capital, échéance. KPIs ativas /
-- expiradas / a expirar / prémios ano / capital. RLS identique au gabarit
-- syndic_contrats (cabinet_id = auth.uid()).

CREATE TABLE IF NOT EXISTS syndic_seguros (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  immeuble      TEXT NOT NULL DEFAULT '',
  seguradora    TEXT NOT NULL DEFAULT '',
  tipo          TEXT NOT NULL DEFAULT 'multirriscos' CHECK (tipo IN (
    'multirriscos', 'responsabilidade_civil', 'incendio', 'outros'
  )),
  apolice       TEXT NOT NULL DEFAULT '',
  premio_anual  NUMERIC NOT NULL DEFAULT 0,
  capital       NUMERIC NOT NULL DEFAULT 0,
  data_inicio   DATE,
  data_fim      DATE,
  statut        TEXT NOT NULL DEFAULT 'ativa' CHECK (statut IN (
    'ativa', 'expirada', 'renovacao'
  )),
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS syndic_seguros_cabinet_idx ON syndic_seguros (cabinet_id);
CREATE INDEX IF NOT EXISTS syndic_seguros_fim_idx ON syndic_seguros (cabinet_id, data_fim);

ALTER TABLE syndic_seguros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "syndic_seguros_cabinet_full_access"
  ON syndic_seguros
  FOR ALL
  USING (cabinet_id = auth.uid())
  WITH CHECK (cabinet_id = auth.uid());
