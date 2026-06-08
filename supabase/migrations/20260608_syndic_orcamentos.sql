-- syndic_orcamentos : devis individuels rattachés à une obra, pour la comparaison
-- obligatoire « 3 orçamentos » (Lei 8/2022, art. 1436.° CC). Scopé cabinet_id + RLS
-- stricte (FOR ALL owner). FK obra_id → syndic_obras (CASCADE). À appliquer en prod.
CREATE TABLE IF NOT EXISTS syndic_orcamentos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  obra_id      uuid NOT NULL REFERENCES syndic_obras(id) ON DELETE CASCADE,
  empresa      text NOT NULL DEFAULT '',
  valor        numeric NOT NULL DEFAULT 0,
  prazo_dias   integer,
  validade     text,
  notas        text,
  recomendado  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS syndic_orcamentos_cabinet_idx ON syndic_orcamentos (cabinet_id);
CREATE INDEX IF NOT EXISTS syndic_orcamentos_obra_idx    ON syndic_orcamentos (cabinet_id, obra_id);

ALTER TABLE syndic_orcamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS syndic_orcamentos_owner ON syndic_orcamentos;
CREATE POLICY syndic_orcamentos_owner ON syndic_orcamentos FOR ALL TO authenticated
  USING (cabinet_id = auth.uid()) WITH CHECK (cabinet_id = auth.uid());
