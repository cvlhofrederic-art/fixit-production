const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seedClient() {
  console.log('👤 Création du compte client...\n')

  const email = process.env.SEED_CLIENT_EMAIL || 'test@example.com'
  const password = process.env.SEED_CLIENT_PASSWORD || 'ChangeMe123!'

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existing = existingUsers?.users?.find((u: any) => u.email === email)

  if (existing) {
    console.log('✅ Le compte client existe déjà:', email)
    console.log('   ID:', existing.id)
    return
  }

  // Create user with admin API (auto-confirms email)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: 'HDN Carvalho',
      role: 'client',
    },
  })

  if (error) {
    console.error('❌ Erreur création compte:', error.message)
    return
  }

  console.log('✅ Compte client créé avec succès !')
  console.log('   Email:', email)
  console.log('   ID:', data.user.id)
  console.log('   Rôle: client')
  console.log(`\n🔐 Connexion: ${email} / [voir .env.local]`)
}

seedClient().catch(console.error)
