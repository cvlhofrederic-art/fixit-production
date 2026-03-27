-- ── Table doc_sequences : numérotation séquentielle devis/factures (art. L441-3 C. com.) ──
-- Garantit des numéros gapless par artisan, par année, par type de document.

CREATE TABLE IF NOT EXISTS doc_sequences (
  artisan_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('devis', 'facture', 'avoir')),
  year INTEGER NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (artisan_user_id, doc_type, year)
);

-- RLS : seul le propriétaire peut lire ses séquences
ALTER TABLE doc_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_sequences_owner_access" ON doc_sequences
  USING (artisan_user_id = auth.uid())
  WITH CHECK (artisan_user_id = auth.uid());

-- Fonction atomique pour obtenir le prochain numéro
-- Utilise INSERT ... ON CONFLICT + RETURNING pour garantir l'atomicité
CREATE OR REPLACE FUNCTION next_doc_number(
  p_artisan_user_id UUID,
  p_doc_type TEXT,
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
  v_prefix TEXT;
BEGIN
  -- Atomically increment or initialize the sequence
  INSERT INTO doc_sequences (artisan_user_id, doc_type, year, last_seq)
  VALUES (p_artisan_user_id, p_doc_type, p_year, 1)
  ON CONFLICT (artisan_user_id, doc_type, year)
  DO UPDATE SET last_seq = doc_sequences.last_seq + 1
  RETURNING last_seq INTO v_seq;

  -- Build prefix based on doc_type
  v_prefix := CASE p_doc_type
    WHEN 'devis' THEN 'DEV'
    WHEN 'facture' THEN 'FACT'
    WHEN 'avoir' THEN 'AV'
  END;

  RETURN v_prefix || '-' || p_year::TEXT || '-' || LPAD(v_seq::TEXT, 3, '0');
END;
$$;
