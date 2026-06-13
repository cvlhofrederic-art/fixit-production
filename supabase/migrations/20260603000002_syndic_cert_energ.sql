-- Phase 3 v54 — syndic_cert_energ (Certificação Energética / SCE — DL 101-D/2020)
-- Module : ModCertEnerg. RLS : cabinet_id = auth.uid() (isolation par cabinet).
CREATE TABLE IF NOT EXISTS syndic_cert_energ (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero TEXT NOT NULL DEFAULT '',
  edificio TEXT NOT NULL DEFAULT '',
  perito TEXT NOT NULL DEFAULT '',
  classe TEXT NOT NULL DEFAULT 'C',
  data_emissao DATE,
  data_validade DATE,
  notas TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS syndic_cert_energ_cabinet_idx ON syndic_cert_energ (cabinet_id);
ALTER TABLE syndic_cert_energ ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "syndic_cert_energ_cabinet_full_access" ON syndic_cert_energ;
CREATE POLICY "syndic_cert_energ_cabinet_full_access" ON syndic_cert_energ FOR ALL USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid());
