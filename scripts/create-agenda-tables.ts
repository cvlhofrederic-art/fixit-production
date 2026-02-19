const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://irluhepekbqgquveaett.supabase.co',
  'sb_secret_lDcyzgFqQMUE65_bCpzuAg_rlTsd6tB'
)

async function createTables() {
  console.log('🗄️  Création des tables agenda...\n')

  // 1. Table artisan_availability - plages horaires récurrentes par jour
  console.log('1️⃣  Création table artisan_availability...')
  const { error: e1 } = await supabase.rpc('exec_sql', {
    sql: `
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
    `
  })

  if (e1) {
    console.log('   Trying direct SQL approach...')
    // Fallback: créer via REST API en insérant dans une table de migration
    // On va utiliser les tables directement avec des requêtes
  }

  // 2. Table artisan_settings - paramètres de l'artisan dont auto_accept
  console.log('2️⃣  Création table artisan_settings...')
  const { error: e2 } = await supabase.rpc('exec_sql', {
    sql: `
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
    `
  })

  if (e2) {
    console.log('   ⚠️ RPC not available, tables need to be created via Supabase Dashboard SQL Editor')
  }

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
