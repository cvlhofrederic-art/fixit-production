-- syndic_seg_edificio : sécurité incendie d'un cabinet syndic (Phase 3 — slice 11)
--
-- Backend du module v54 ModSegEdificio (RSCIE — DL 220/2008). Classification
-- catégorie de risque 1-4 par immeuble + encarregado de segurança + exercices.
-- La génération de plan d'urgence (Alfredo) reste un agent externe.
-- RLS identique au gabarit (cabinet_id = auth.uid()).

CREATE TABLE IF NOT EXISTS syndic_seg_edificio (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  immeuble          TEXT NOT NULL DEFAULT '',
  categoria         TEXT NOT NULL DEFAULT '1' CHECK (categoria IN ('1', '2', '3', '4')),
  encarregado       TEXT NOT NULL DEFAULT '',
  plano_emergencia  BOOLEAN NOT NULL DEFAULT FALSE,
  ultimo_exercicio  DATE,
  notes             TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS syndic_seg_edificio_cabinet_idx ON syndic_seg_edificio (cabinet_id);

ALTER TABLE syndic_seg_edificio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "syndic_seg_edificio_cabinet_full_access"
  ON syndic_seg_edificio
  FOR ALL
  USING (cabinet_id = auth.uid())
  WITH CHECK (cabinet_id = auth.uid());
