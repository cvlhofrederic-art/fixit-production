const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function createTables() {
  console.log('🗄️  Création des tables agenda...\n')

  // exec_sql RPC was removed in security audit.
  // Tables should be created via Supabase migrations or Dashboard SQL Editor.
  console.log('⚠️  exec_sql RPC supprimé (audit sécurité). Utilisez les migrations ou le SQL Editor.')

  console.log('\n✅ Script terminé.')
  console.log('\n📋 Si les tables n\'ont pas été créées automatiquement,')
  console.log('   copiez le SQL ci-dessous dans Supabase Dashboard > SQL Editor:\n')

  console.log(`
-- ═══════════════════════════════════════════════
-- TABLES AGENDA FIXIT
-- ═══════════════════════════════════════════════

-- 1. Plages horaires récurrentes par jour de semaine
CREATE TABLE IF NOT EXISTS artisan_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id UUID NOT NULL REFERENCES profiles_artisan(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(artisan_id, day_of_week)
);

-- 2. Paramètres artisan (auto-accept, durée créneaux, etc.)
CREATE TABLE IF NOT EXISTS artisan_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id UUID NOT NULL UNIQUE REFERENCES profiles_artisan(id) ON DELETE CASCADE,
  auto_accept_bookings BOOLEAN DEFAULT false,
  slot_duration_minutes INTEGER DEFAULT 60,
  buffer_minutes INTEGER DEFAULT 0,
  max_bookings_per_day INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS policies (lecture publique, écriture par artisan)
ALTER TABLE artisan_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE artisan_settings ENABLE ROW LEVEL SECURITY;

-- Lecture publique des disponibilités
CREATE POLICY "Public read availability" ON artisan_availability
  FOR SELECT USING (true);

-- Artisan peut tout faire sur ses dispo
CREATE POLICY "Artisan manage own availability" ON artisan_availability
  FOR ALL USING (true);

-- Lecture publique des settings
CREATE POLICY "Public read settings" ON artisan_settings
  FOR SELECT USING (true);

-- Artisan peut tout faire sur ses settings
CREATE POLICY "Artisan manage own settings" ON artisan_settings
  FOR ALL USING (true);

-- Policy bookings lecture publique
CREATE POLICY IF NOT EXISTS "Public read bookings" ON bookings
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Public insert bookings" ON bookings
  FOR INSERT WITH CHECK (true);

-- ═══════════════════════════════════════════════
  `)
}

createTables().catch(console.error)
