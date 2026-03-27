-- Vitfix — Artisan Absences Table
-- Stores absence periods for artisans (vacations, sick days, devis-blocked days)

CREATE TABLE IF NOT EXISTS artisan_absences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT DEFAULT '',
  label TEXT DEFAULT '',
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_absences_artisan ON artisan_absences(artisan_id);
CREATE INDEX IF NOT EXISTS idx_absences_dates ON artisan_absences(start_date, end_date);

ALTER TABLE artisan_absences ENABLE ROW LEVEL SECURITY;

-- Public can read absences (needed for client booking availability check)
CREATE POLICY "public_read_absences" ON artisan_absences
  FOR SELECT USING (true);

-- Artisans can manage their own absences
CREATE POLICY "artisan_manage_absences" ON artisan_absences
  FOR ALL USING (
    artisan_id IN (SELECT id FROM profiles_artisan WHERE user_id = auth.uid())
  );
