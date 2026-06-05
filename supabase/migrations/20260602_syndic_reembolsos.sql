-- syndic_reembolsos : reembolsos pro-rata d'un cabinet syndic (Phase 3 — slice 9)
--
-- Backend du module v54 ModReembolsos (reembolso pro-rata sur vente de fração,
-- Lei 8/2022). Suivi/tracker : l'exécution Open Banking reste externe.
-- RLS identique au gabarit (cabinet_id = auth.uid()).

CREATE TABLE IF NOT EXISTS syndic_reembolsos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  immeuble            TEXT NOT NULL DEFAULT '',
  antigo_proprietario TEXT NOT NULL DEFAULT '',
  fracao              TEXT NOT NULL DEFAULT '',
  data_venda          DATE,
  quotas_pagas        NUMERIC NOT NULL DEFAULT 0,
  montante_reembolso  NUMERIC NOT NULL DEFAULT 0,
  metodo              TEXT NOT NULL DEFAULT '',
  statut              TEXT NOT NULL DEFAULT 'pendente' CHECK (statut IN (
    'pendente', 'liquidado', 'bloqueado'
  )),
  notes               TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS syndic_reembolsos_cabinet_idx ON syndic_reembolsos (cabinet_id, statut);

ALTER TABLE syndic_reembolsos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "syndic_reembolsos_cabinet_full_access"
  ON syndic_reembolsos
  FOR ALL
  USING (cabinet_id = auth.uid())
  WITH CHECK (cabinet_id = auth.uid());
