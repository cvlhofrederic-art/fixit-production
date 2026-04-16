const { createClient } = require('@supabase/supabase-js')

// Utilisation de la clé service_role pour bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function seed() {
  console.log('🌱 Début du seeding Lepore Sebastien...\n')

  // 1. Créer la catégorie Paysagiste
  console.log('1️⃣  Vérification catégorie Paysagiste...')
  let { data: existingCat } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', 'paysagiste')
    .single()

  if (!existingCat) {
    const { data: newCat, error: catError } = await supabase
      .from('categories')
      .insert({
        name: 'Paysagiste',
        slug: 'paysagiste',
        icon: '🌿',
        description: 'Aménagement et entretien de jardins et espaces verts',
        active: true,
      })
      .select()
      .single()

    if (catError) {
      console.error('❌ Erreur catégorie:', catError.message)
    } else {
      existingCat = newCat
      console.log('✅ Catégorie Paysagiste créée !')
    }
  } else {
    console.log('✅ Catégorie Paysagiste existe déjà')
  }

  // 2. Créer le compte auth pour l'artisan
  console.log('\n2️⃣  Création du compte auth...')
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'leporesebastien.pro@gmail.com',
    password: 'ChangeMe123!',
    email_confirm: true,
    user_metadata: {
      full_name: 'Lepore Sebastien',
      role: 'artisan',
      phone: '06 51 46 66 98',
    },
  })

  if (authError) {
    console.error('❌ Erreur auth:', authError.message)
    // Essayons de récupérer l'utilisateur existant
    const { data: users } = await supabase.auth.admin.listUsers()
    const existingUser = users?.users?.find((u: any) => u.email === 'leporesebastien.pro@gmail.com')
    if (existingUser) {
      console.log('ℹ️  Utilisateur existe déjà, on continue avec ID:', existingUser.id)
      await createProfile(existingUser.id, existingCat)
      return
    }
    return
  }

  console.log('✅ Compte auth créé ! User ID:', authData.user.id)

  await createProfile(authData.user.id, existingCat)
}

async function createProfile(userId: string, category: any) {
  // 3. Créer le profil artisan avec les vraies infos Pappers
  console.log('\n3️⃣  Création du profil artisan Lepore Sebastien...')

  // Coordonnées GPS de La Ciotat
  const latitude = 43.1748
  const longitude = 5.6046

  const { data: artisan, error: artisanError } = await supabase
    .from('profiles_artisan')
    .insert({
      user_id: userId,
      company_name: 'Lepore Sebastien',
      siret: '95395158900019',
      bio: 'Paysagiste professionnel basé à La Ciotat (13600). Spécialisé dans l\'entretien de jardins et l\'élagage. Entrepreneur individuel passionné par l\'aménagement et l\'entretien de vos espaces verts. Intervient sur La Ciotat et ses environs.',
      categories: ['paysagiste', 'elagueur', 'nettoyage'],
      hourly_rate: 45,
      zone_radius_km: 30,
      latitude: latitude,
      longitude: longitude,
      rating_avg: 4.9,
      rating_count: 0,
      verified: true,
      subscription_tier: 'pro',
      active: true,
    })
    .select()
    .single()

  if (artisanError) {
    console.error('❌ Erreur artisan:', artisanError.message)
    return
  }

  console.log('✅ Profil artisan créé ! ID:', artisan.id)

  // 4. Créer les services
  console.log('\n4️⃣  Création des services...')

  const services = [
    {
      artisan_id: artisan.id,
      category_id: category?.id || null,
      name: 'Entretien jardin',
      description: 'Tonte de pelouse, désherbage, taille de haies, nettoyage des massifs et entretien général de votre jardin. Intervention sur La Ciotat et environs (30km).',
      duration_minutes: 120,
      price_ht: 75.00,
      price_ttc: 90.00,
      active: true,
    },
    {
      artisan_id: artisan.id,
      category_id: category?.id || null,
      name: 'Élagage',
      description: 'Élagage et taille d\'arbres, abattage de branches dangereuses, mise en forme et entretien des arbres de votre propriété. Devis gratuit sur place.',
      duration_minutes: 180,
      price_ht: 125.00,
      price_ttc: 150.00,
      active: true,
    },
  ]

  const { data: createdServices, error: servicesError } = await supabase
    .from('services')
    .insert(services)
    .select()

  if (servicesError) {
    console.error('❌ Erreur services:', servicesError.message)
    return
  }

  console.log('✅ Services créés !')
  createdServices.forEach((s: any) => {
    console.log(`   - ${s.name} → ${s.price_ttc}€ TTC (${s.duration_minutes}min)`)
  })

  // Résumé final
  console.log('\n' + '='.repeat(55))
  console.log('🎉 COMPTE ARTISAN CRÉÉ AVEC SUCCÈS !')
  console.log('='.repeat(55))
  console.log(`\n👷 Artisan     : Lepore Sebastien`)
  console.log(`📧 Email       : leporesebastien.pro@gmail.com`)
  console.log(`📞 Téléphone   : 06 51 46 66 98`)
  console.log(`🏢 SIRET       : 953 951 589 00019`)
  console.log(`📍 Adresse     : Rés. L'Aurore Bât. B, 13600 La Ciotat`)
  console.log(`🌿 Métier      : Paysagiste`)
  console.log(`📋 Services    : Entretien jardin (90€) + Élagage (150€)`)
  console.log(`🔐 Mot de passe: ChangeMe123!`)
  console.log(`🆔 ID Artisan  : ${artisan.id}`)
  console.log(`🔗 Profil      : https://vitfix.io/artisan/${artisan.id}`)
  console.log(`🔗 Login       : https://vitfix.io/auth/login`)
}

seed().catch(console.error)
