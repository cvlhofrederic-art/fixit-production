-- RFQ system for BTP companies only
-- Does NOT modify any existing tables

CREATE TABLE IF NOT EXISTS rfqs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country TEXT NOT NULL CHECK (country IN ('FR', 'PT')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'closed')),
  message TEXT,
  title TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rfq_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_ref TEXT,
  category TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'unité',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT NOT NULL CHECK (country IN ('FR', 'PT')),
  categories TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  supplier_name TEXT NOT NULL,
  supplier_email TEXT NOT NULL,
  total_price NUMERIC,
  delivery_days INTEGER,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offer_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  rfq_item_id UUID REFERENCES rfq_items(id),
  product_name TEXT NOT NULL,
  unit_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  total_price NUMERIC GENERATED ALWAYS AS (unit_price * quantity) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed some example suppliers (FR)
INSERT INTO suppliers (name, email, country, categories) VALUES
('Pro Matériaux France', 'devis@promateriaux.fr', 'FR', ARRAY['gros_oeuvre', 'isolation', 'menuiserie']),
('BTP Fournitures Pro', 'contact@btpfournitures.fr', 'FR', ARRAY['plomberie', 'electricite', 'carrelage']),
('Distrib Pro Bâtiment', 'rfq@distribpro.fr', 'FR', ARRAY['toiture', 'charpente', 'enduit'])
ON CONFLICT DO NOTHING;

INSERT INTO suppliers (name, email, country, categories) VALUES
('Materiais Pro Portugal', 'orcamentos@materiaispro.pt', 'PT', ARRAY['alvenaria', 'isolamento', 'carpintaria']),
('Fornecedor BTP PT', 'contacto@fornecedorbtp.pt', 'PT', ARRAY['canalizacao', 'electricidade', 'pavimento'])
ON CONFLICT DO NOTHING;

-- RLS policies
ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Users can only see their own RFQs
CREATE POLICY "rfqs_user_policy" ON rfqs
  FOR ALL USING (auth.uid() = user_id);

-- RFQ items visible to owner of rfq
CREATE POLICY "rfq_items_user_policy" ON rfq_items
  FOR ALL USING (
    rfq_id IN (SELECT id FROM rfqs WHERE user_id = auth.uid())
  );

-- Offers visible to RFQ owner
CREATE POLICY "offers_user_policy" ON offers
  FOR SELECT USING (
    rfq_id IN (SELECT id FROM rfqs WHERE user_id = auth.uid())
  );

-- Service role bypasses RLS
CREATE POLICY "rfqs_service_policy" ON rfqs FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "rfq_items_service_policy" ON rfq_items FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "offers_service_policy" ON offers FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "offer_items_service_policy" ON offer_items FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "suppliers_read_policy" ON suppliers FOR SELECT USING (TRUE);
CREATE POLICY "suppliers_service_policy" ON suppliers FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Index for performance
CREATE INDEX IF NOT EXISTS rfqs_user_id_idx ON rfqs(user_id);
CREATE INDEX IF NOT EXISTS rfqs_status_idx ON rfqs(status);
CREATE INDEX IF NOT EXISTS rfq_items_rfq_id_idx ON rfq_items(rfq_id);
CREATE INDEX IF NOT EXISTS offers_rfq_id_idx ON offers(rfq_id);
CREATE INDEX IF NOT EXISTS offers_token_idx ON offers(token);
