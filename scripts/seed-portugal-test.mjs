import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function seed() {
  console.log('🌱 Criação de contas de teste PT...\n')

  // ── 1. Compte client test ─────────────────────────────────────────
  console.log('1️⃣  Criação da conta cliente Ana Ferreira...')
  const { data: clientAuth, error: clientError } = await supabase.auth.admin.createUser({
    email: 'ana.ferreira.teste@gmail.com',
    password: 'ChangeMe123!',
    email_confirm: true,
    user_metadata: {
      full_name: 'Ana Ferreira',
      role: 'client',
    },
  })

  if (clientError) {
    console.error('❌ Erro cliente:', clientError.message)
  } else {
    console.log('✅ Conta cliente criada ! ID:', clientAuth.user.id)
    // Créer le profil client
    await supabase.from('profiles_client').upsert({
      id: clientAuth.user.id,
      first_name: 'Ana',
      last_name: 'Ferreira',
    })
    console.log('✅ Perfil cliente criado !')
  }

  // ── 2. Catégorie Paysagiste (déjà existante, on récupère) ─────────
  console.log('\n2️⃣  Verificação da categoria Paysagiste...')
  const { data: cat } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', 'paysagiste')
    .single()

  const catId = cat?.id || null
  console.log(cat ? `✅ Categoria encontrada : ${cat.name}` : '⚠️  Categoria não encontrada, serviços sem category_id')

  // ── 3. Compte artisan test ────────────────────────────────────────
  console.log('\n3️⃣  Criação da conta artisan Carlos Mendes Jardins...')
  const { data: artisanAuth, error: artisanAuthError } = await supabase.auth.admin.createUser({
    email: 'carlos.mendes.jardins@gmail.com',
    password: 'ChangeMe123!',
    email_confirm: true,
    user_metadata: {
      full_name: 'Carlos Mendes',
      role: 'artisan',
      phone: '+351 912 345 678',
    },
  })

  if (artisanAuthError) {
    console.error('❌ Erro artisan auth:', artisanAuthError.message)
    // Récupérer si déjà existant
    const { data: users } = await supabase.auth.admin.listUsers()
    const existing = users?.users?.find(u => u.email === 'carlos.mendes.jardins@gmail.com')
    if (existing) {
      console.log('ℹ️  Utilizador já existe, ID:', existing.id)
      await createArtisanProfile(existing.id, catId)
    }
    return
  }

  console.log('✅ Conta artisan criada ! ID:', artisanAuth.user.id)
  await createArtisanProfile(artisanAuth.user.id, catId)
}

async function createArtisanProfile(userId, catId) {
  console.log('\n4️⃣  Criação do perfil paisagista...')

  // Porto city center coordinates
  const latitude = 41.1579
  const longitude = -8.6291

  const { data: artisan, error } = await supabase
    .from('profiles_artisan')
    .insert({
      user_id: userId,
      company_name: 'Carlos Mendes Jardins',
      slug: 'carlosmendesjardins',
      bio: 'Paisagista profissional sediado no Porto. Especializado em manutenção de jardins, poda de árvores e gestão de espaços verdes. Trabalho com rigor e paixão pela natureza, ao serviço de particulares e empresas na área do Porto e arredores.',
      categories: ['paysagiste'],
      hourly_rate: 45,
      zone_radius_km: 30,
      latitude,
      longitude,
      language: 'pt',
      rating_avg: 4.8,
      rating_count: 37,
      verified: true,
      subscription_tier: 'pro',
      active: true,
    })
    .select()
    .single()

  if (error) {
    console.error('❌ Erro perfil artisan:', error.message)
    return
  }

  console.log('✅ Perfil paisagista criado ! ID:', artisan.id)

  // ── 5. Services (même structure que Lepore Sebastien, traduit PT) ─
  console.log('\n5️⃣  Criação dos serviços...')

  const services = [
    // ── Poda ──────────────────────────────────────────────────────
    {
      artisan_id: artisan.id,
      category_id: catId,
      name: 'Poda de árvore pequena (< 5m)',
      description: 'Poda e modelação de árvores até 5 metros de altura. Corte suave, clarificação da copa e remoção de ramos secos. [unit:arbre|min:150|max:350]',
      duration_minutes: 60,
      price_ht: 210,
      price_ttc: 210,
      active: true,
    },
    {
      artisan_id: artisan.id,
      category_id: catId,
      name: 'Poda de árvore média (5-10m)',
      description: 'Poda de árvores entre 5 e 10 metros de altura. Acesso por escada ou plataforma elevatória se necessário. [unit:arbre|min:350|max:800]',
      duration_minutes: 120,
      price_ht: 575,
      price_ttc: 575,
      active: true,
    },
    {
      artisan_id: artisan.id,
      category_id: catId,
      name: 'Poda de árvore grande (10-20m)',
      description: 'Poda de árvores entre 10 e 20 metros. Trabalho em escalada ou com plataforma elevatória. Orçamento gratuito no local. [unit:arbre|min:800|max:1600]',
      duration_minutes: 240,
      price_ht: 1200,
      price_ttc: 1200,
      active: true,
    },
    {
      artisan_id: artisan.id,
      category_id: catId,
      name: 'Poda de árvore muito grande (> 20m)',
      description: 'Poda especializada de árvores com mais de 20 metros. Intervenção técnica em escalada com equipamento de segurança profissional. [unit:arbre|min:1600|max:3000]',
      duration_minutes: 360,
      price_ht: 2300,
      price_ttc: 2300,
      active: true,
    },
    {
      artisan_id: artisan.id,
      category_id: catId,
      name: 'Poda de palmeira',
      description: 'Remoção de palmas secas, limpeza do estipe e modelação da palmeira. Especialidade na região do Porto. [unit:arbre|min:150|max:450]',
      duration_minutes: 90,
      price_ht: 300,
      price_ttc: 300,
      active: true,
    },
    // ── Abate ─────────────────────────────────────────────────────
    {
      artisan_id: artisan.id,
      category_id: catId,
      name: 'Abate de árvore pequena (< 10m)',
      description: 'Abate controlado de árvores até 10 metros. Remoção de tronco e ramos incluída. [unit:arbre|min:450|max:900]',
      duration_minutes: 120,
      price_ht: 675,
      price_ttc: 675,
      active: true,
    },
    {
      artisan_id: artisan.id,
      category_id: catId,
      name: 'Abate de árvore grande (> 10m)',
      description: 'Abate controlado de árvores com mais de 10 metros. Orçamento gratuito no local. [unit:arbre|min:900|max:3500]',
      duration_minutes: 300,
      price_ht: 2200,
      price_ttc: 2200,
      active: true,
    },
    // ── Relva ─────────────────────────────────────────────────────
    {
      artisan_id: artisan.id,
      category_id: catId,
      name: 'Corte de relva',
      description: 'Corte de relva, recolha de aparas e limpeza geral do relvado. Intervenção em jardins de particulares e empresas. [unit:m2|min:0.80|max:1.80]',
      duration_minutes: 60,
      price_ht: 80,
      price_ttc: 80,
      active: true,
    },
    {
      artisan_id: artisan.id,
      category_id: catId,
      name: 'Escarificação de relva',
      description: 'Escarificação e arejamento do solo para melhorar a saúde do relvado. Remoção de musgo e feltro. [unit:m2|min:0.80|max:1.50]',
      duration_minutes: 90,
      price_ht: 115,
      price_ttc: 115,
      active: true,
    },
    // ── Sebes ─────────────────────────────────────────────────────
    {
      artisan_id: artisan.id,
      category_id: catId,
      name: 'Aparação de sebes',
      description: 'Aparação e modelação de sebes e arbustos. Limpeza dos resíduos incluída. [unit:ml|min:8|max:20]',
      duration_minutes: 60,
      price_ht: 60,
      price_ttc: 60,
      active: true,
    },
    // ── Manutenção geral ──────────────────────────────────────────
    {
      artisan_id: artisan.id,
      category_id: catId,
      name: 'Manutenção de jardim',
      description: 'Corte de relva, desinfestação, aparação de sebes, limpeza de canteiros e manutenção geral do jardim. Intervenção no Porto e arredores (30 km). [unit:m2|min:35|max:60]',
      duration_minutes: 120,
      price_ht: 90,
      price_ttc: 90,
      active: true,
    },
    {
      artisan_id: artisan.id,
      category_id: catId,
      name: 'Desinfestação e limpeza de canteiros',
      description: 'Remoção de ervas daninhas, limpeza de canteiros e zonas ajardinadas. Tratamento preventivo disponível. [unit:m2|min:3|max:8]',
      duration_minutes: 90,
      price_ht: 55,
      price_ttc: 55,
      active: true,
    },
    // ── Criação ───────────────────────────────────────────────────
    {
      artisan_id: artisan.id,
      category_id: catId,
      name: 'Criação de relvado natural',
      description: 'Preparação do terreno, sementeira e primeiros cuidados. Garantia de germinação incluída. [unit:m2|min:8|max:15]',
      duration_minutes: 180,
      price_ht: 550,
      price_ttc: 550,
      active: true,
    },
    {
      artisan_id: artisan.id,
      category_id: catId,
      name: 'Aménagement paysager complet',
      description: 'Conception e execução completa do seu jardim: relvado, canteiros, árvores, sebes e caminhos. Orçamento personalizado. [unit:m2|min:80|max:300]',
      duration_minutes: 480,
      price_ht: 1800,
      price_ttc: 1800,
      active: true,
    },
  ]

  const { data: created, error: svcError } = await supabase
    .from('services')
    .insert(services)
    .select()

  if (svcError) {
    console.error('❌ Erro serviços:', svcError.message)
    return
  }

  console.log(`✅ ${created.length} serviços criados !`)
  created.forEach(s => console.log(`   - ${s.name}`))

  // ── 6. Disponibilités (Lun–Sam 8h–18h) ───────────────────────────
  console.log('\n6️⃣  Criação das disponibilidades (Seg–Sáb 08h–18h)...')

  const availability = [1,2,3,4,5,6].map(day => ({
    artisan_id: artisan.id,
    day_of_week: day,
    start_time: '08:00',
    end_time: '18:00',
    is_available: true,
  }))

  const { error: availError } = await supabase.from('availability').insert(availability)
  if (availError) console.error('❌ Erro disponibilidades:', availError.message)
  else console.log('✅ Disponibilidades criadas (Seg–Sáb, 08h–18h)')

  // ── Résumé ────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60))
  console.log('🎉 CONTAS DE TESTE PT CRIADAS COM SUCESSO !')
  console.log('='.repeat(60))
  console.log('\n👤 CLIENTE')
  console.log(`   Nome     : Ana Ferreira`)
  console.log(`   Email    : ana.ferreira.teste@gmail.com`)
  console.log(`   Password : ChangeMe123!`)
  console.log(`   Login    : https://fixit-production.vercel.app/pt/auth/login`)
  console.log('\n👷 ARTISAN (PAISAGISTA)')
  console.log(`   Nome     : Carlos Mendes Jardins`)
  console.log(`   Email    : carlos.mendes.jardins@gmail.com`)
  console.log(`   Password : ChangeMe123!`)
  console.log(`   Cidade   : Porto`)
  console.log(`   Serviços : ${created.length} (poda, abate, relva, sebes, manutenção...)`)
  console.log(`   ID       : ${artisan.id}`)
  console.log(`   Slug     : carlosmendesjardins`)
  console.log(`   Perfil   : https://fixit-production.vercel.app/pt/artisan/carlosmendesjardins`)
  console.log(`   Login    : https://fixit-production.vercel.app/pt/pro/login`)
  console.log('\n' + '='.repeat(60))
}

seed().catch(console.error)
