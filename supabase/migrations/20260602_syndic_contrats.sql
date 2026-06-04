-- syndic_contrats : contrats prestataires d'un cabinet syndic (Phase 3 — slice 1)
--
-- Backend du module v54 ModContratos (jusqu'ici sans données : mock/empty only).
-- Catégories alignées sur les onglets du module : Limpezas · Elevadores ·
-- Segurança · Jardinagem · Outros. Suivi coût mensuel/annuel + date de fin
-- (alertes renovação J-90/60/30 côté produit).
--
-- RLS scopée cabinet_id = auth.uid() (défense en profondeur), identique au
-- gabarit syndic_team_members. L'API /api/syndic/contratos utilise le client
-- service-role + filtre explicite .eq('cabinet_id', cabinetId).

CREATE TABLE IF NOT EXISTS syndic_contrats (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  immeuble      TEXT NOT NULL DEFAULT '',
  fornecedor    TEXT NOT NULL DEFAULT '',
  categoria     TEXT NOT NULL DEFAULT 'outros' CHECK (categoria IN (
    'limpezas', 'elevadores', 'seguranca', 'jardinagem', 'outros'
  )),
  custo_mensal  NUMERIC NOT NULL DEFAULT 0,
  custo_anual   NUMERIC NOT NULL DEFAULT 0,
  data_inicio   DATE,
  data_fim      DATE,
  statut        TEXT NOT NULL DEFAULT 'ativo' CHECK (statut IN (
    'ativo', 'expirado', 'renovacao'
  )),
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS syndic_contrats_cabinet_idx
  ON syndic_contrats (cabinet_id);

-- Pour les alertes renovação (tri par échéance dans la carteira du cabinet).
CREATE INDEX IF NOT EXISTS syndic_contrats_fim_idx
  ON syndic_contrats (cabinet_id, data_fim);

ALTER TABLE syndic_contrats ENABLE ROW LEVEL SECURITY;

-- Le cabinet maître a accès complet à ses propres contrats.
CREATE POLICY "syndic_contrats_cabinet_full_access"
  ON syndic_contrats
  FOR ALL
  USING (cabinet_id = auth.uid())
  WITH CHECK (cabinet_id = auth.uid());
