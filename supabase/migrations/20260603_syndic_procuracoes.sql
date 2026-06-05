-- syndic_procuracoes : procurations AG d'un cabinet syndic (Phase 3 — slice 10)
--
-- Backend du module v54 ModProcuracoes (CC art. 1433.°-3). Tracker des
-- représentations en assemblée : condómino représenté, procurador, validité.
-- L'OCR Léa + validation NIF AT restent externes. RLS identique au gabarit.

CREATE TABLE IF NOT EXISTS syndic_procuracoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  immeuble       TEXT NOT NULL DEFAULT '',
  condomino      TEXT NOT NULL DEFAULT '',
  procurador     TEXT NOT NULL DEFAULT '',
  fracao         TEXT NOT NULL DEFAULT '',
  data_validade  DATE,
  ag_ref         TEXT NOT NULL DEFAULT '',
  statut         TEXT NOT NULL DEFAULT 'valida' CHECK (statut IN (
    'valida', 'expirada'
  )),
  notes          TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS syndic_procuracoes_cabinet_idx ON syndic_procuracoes (cabinet_id);

ALTER TABLE syndic_procuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "syndic_procuracoes_cabinet_full_access"
  ON syndic_procuracoes
  FOR ALL
  USING (cabinet_id = auth.uid())
  WITH CHECK (cabinet_id = auth.uid());
