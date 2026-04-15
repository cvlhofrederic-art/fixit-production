/**
 * Seed Demo BTP Pro — Portugal 🇵🇹
 *
 * Crée le compte super admin PT + toutes les données de démo adaptées au Portugal.
 *
 * Usage:
 *   npx tsx scripts/seed-demo-btp-pt.ts          → Crée le compte + insère les données
 *   npx tsx scripts/seed-demo-btp-pt.ts --clean   → Supprime les données [DEMO-PT]
 *
 * Compte créé : admincvlhopt@gmail.com / Fixit2024!
 * Société     : Construções Valho & Filhos, Lda
 * Locale      : PT — noms, moradas, NIF, preços adaptados a Portugal
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const DEMO_TAG = '[DEMO-PT]'

// ────────────────────────────────────────────────────────────
// COMPTE
// ────────────────────────────────────────────────────────────
const ACCOUNT = {
  email: 'admincvlhopt@gmail.com',
  password: 'Fixit2024!',
  full_name: 'Carlos Valho',
  company_name: 'Construções Valho & Filhos, Lda',
  nif: '512 345 678',
  phone: '+351 912 345 678',
  address: 'Rua de Santa Catarina, 247',
  city: 'Porto',
  postal_code: '4000-447',
  country: 'PT',
  // Porto — centre-ville
  latitude: 41.1496,
  longitude: -8.6109,
  specialty: 'Construção civil e remodelação',
  org_role: 'pro_societe',
}

// ────────────────────────────────────────────────────────────
async function seed() {
  const isClean = process.argv.includes('--clean')

  // ── MODE CLEAN ──
  if (isClean) {
    console.log('🧹 Suppression des données [DEMO-PT]...')
    const { data: user } = await supabase.auth.admin.listUsers()
    const demoUser = user?.users?.find(u => u.email === ACCOUNT.email)
    if (!demoUser) { console.log('Compte introuvable, rien à supprimer.'); return }
    const ownerId = demoUser.id

    await supabase.from('devis').delete().eq('artisan_user_id', ownerId)
    await supabase.from('chantiers_btp').delete().eq('owner_id', ownerId)
    await supabase.from('membres_btp').delete().eq('owner_id', ownerId)
    await supabase.from('equipes_btp').delete().eq('owner_id', ownerId)
    await supabase.from('pointages_btp').delete().eq('owner_id', ownerId)
    await supabase.from('depenses_btp').delete().eq('owner_id', ownerId)
    await supabase.from('situations_btp').delete().eq('owner_id', ownerId)
    await supabase.from('retenues_btp').delete().eq('owner_id', ownerId)
    await supabase.from('dc4_btp').delete().eq('owner_id', ownerId)
    await supabase.from('dpgf_btp').delete().eq('owner_id', ownerId)
    await supabase.from('pro_team_members').delete().eq('company_id', ownerId)
    await supabase.from('settings_btp').delete().eq('owner_id', ownerId)
    await supabase.from('profiles_artisan').delete().eq('user_id', ownerId)
    await supabase.auth.admin.deleteUser(ownerId)
    console.log('✅ Données et compte supprimés.')
    return
  }

  // ════════════════════════════════════════════════════════════
  // 1. COMPTE AUTH
  // ════════════════════════════════════════════════════════════
  console.log('\n1️⃣  Création du compte auth...')

  let ownerId: string
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existing = existingUsers?.users?.find(u => u.email === ACCOUNT.email)

  if (existing) {
    console.log('ℹ️  Compte déjà existant, ID:', existing.id)
    ownerId = existing.id
  } else {
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: ACCOUNT.email,
      password: ACCOUNT.password,
      email_confirm: true,
      user_metadata: {
        full_name: ACCOUNT.full_name,
        role: 'pro_societe',
        phone: ACCOUNT.phone,
        locale: 'pt',
      },
    })
    if (authErr) { console.error('❌ Auth:', authErr.message); return }
    ownerId = authData.user.id
    console.log('✅ Compte créé — ID:', ownerId)
  }

  // ════════════════════════════════════════════════════════════
  // 2. PROFIL ARTISAN
  // ════════════════════════════════════════════════════════════
  console.log('\n2️⃣  Création du profil artisan...')

  const { data: existingArtisan } = await supabase
    .from('profiles_artisan').select('id').eq('user_id', ownerId).single()

  let artisanId: string

  if (existingArtisan) {
    artisanId = existingArtisan.id
    console.log('ℹ️  Profil artisan déjà existant — ID:', artisanId)
  } else {
    const { data: artisan, error: artisanErr } = await supabase.from('profiles_artisan').insert({
      user_id: ownerId,
      email: ACCOUNT.email,
      company_name: ACCOUNT.company_name,
    }).select('id').single()

    if (artisanErr) {
      // profiles_artisan insert failed → use ownerId as artisanId (dashboard fallback)
      console.warn('⚠️  profiles_artisan non créé:', artisanErr.message, '— utilise ownerId comme artisanId')
      artisanId = ownerId
    } else {
      artisanId = artisan!.id
      console.log('✅ Profil artisan créé — ID:', artisanId)
    }
  }

  // ════════════════════════════════════════════════════════════
  // 3. SETTINGS BTP (fiscalidade LDA)
  // ════════════════════════════════════════════════════════════
  console.log('\n3️⃣  Configuration des paramètres fiscaux...')

  await supabase.from('settings_btp').upsert({
    owner_id: ownerId,
    company_name: ACCOUNT.company_name,
    siret: ACCOUNT.nif,           // champ réutilisé pour NIF/NIPC
    tva_number: 'PT512345678',
    tva_rate: 23,                 // TVA PT standard
    currency: 'EUR',
    payment_terms: 30,
    logo_url: null,
    address: ACCOUNT.address,
    city: ACCOUNT.city,
    postal_code: ACCOUNT.postal_code,
    country: 'PT',
    phone: ACCOUNT.phone,
    email: ACCOUNT.email,
    iban: 'PT50 0010 0000 1234 5678 9015 4',
    bic: 'BPIPT PL',
    mentions_legales: 'Construções Valho & Filhos, Lda — NIPC 512 345 678 — Capital social: 50 000 € — Conservatória do Registo Comercial do Porto',
    // Zones tarifaires PT
    zones: [
      { name: 'Porto (cidade)', rayon_km: 10, majoration_pct: 0 },
      { name: 'Grande Porto', rayon_km: 30, majoration_pct: 5 },
      { name: 'Norte de Portugal', rayon_km: 100, majoration_pct: 10 },
    ],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id' })
  console.log('✅ Settings fiscaux configurés (LDA, NIF, TVA 23%)')

  // ════════════════════════════════════════════════════════════
  // 4. MEMBROS — 4 colaboradores
  // ════════════════════════════════════════════════════════════
  console.log('\n4️⃣  Insertion des 4 membres...')

  const membros = [
    {
      owner_id: ownerId,
      prenom: 'Miguel', nom: 'Ferreira',
      role_perso: `${DEMO_TAG} Encarregado de Obra`,
      type_compte: 'chef_chantier', type_contrat: 'cdi',
      cout_horaire: 14.50, charges_pct: 34,
      salaire_brut_mensuel: 1800, salaire_net_mensuel: 1440,
      charges_salariales_pct: 11, charges_patronales_pct: 23,
      heures_hebdo: 40, panier_repas_jour: 7.6, indemnite_trajet_jour: 5,
      prime_mensuelle: 150, actif: true,
      telephone: '+351 912 111 222', email: 'miguel.f@demo-valho.pt',
    },
    {
      owner_id: ownerId,
      prenom: 'João', nom: 'Santos',
      role_perso: `${DEMO_TAG} Pedreiro N3`,
      type_compte: 'ouvrier', type_contrat: 'cdi',
      cout_horaire: 11.00, charges_pct: 34,
      salaire_brut_mensuel: 1400, salaire_net_mensuel: 1120,
      charges_salariales_pct: 11, charges_patronales_pct: 23,
      heures_hebdo: 40, panier_repas_jour: 7.6, indemnite_trajet_jour: 4,
      prime_mensuelle: 0, actif: true,
      telephone: '+351 913 222 333', email: 'joao.s@demo-valho.pt',
    },
    {
      owner_id: ownerId,
      prenom: 'André', nom: 'Oliveira',
      role_perso: `${DEMO_TAG} Eletricista`,
      type_compte: 'ouvrier', type_contrat: 'cdi',
      cout_horaire: 12.50, charges_pct: 34,
      salaire_brut_mensuel: 1550, salaire_net_mensuel: 1240,
      charges_salariales_pct: 11, charges_patronales_pct: 23,
      heures_hebdo: 40, panier_repas_jour: 7.6, indemnite_trajet_jour: 4,
      prime_mensuelle: 0, actif: true,
      telephone: '+351 914 333 444', email: 'andre.o@demo-valho.pt',
    },
    {
      owner_id: ownerId,
      prenom: 'Rui', nom: 'Costa',
      role_perso: `${DEMO_TAG} Aprendiz 2º Ano`,
      type_compte: 'ouvrier', type_contrat: 'apprenti',
      cout_horaire: 6.50, charges_pct: 20,
      salaire_brut_mensuel: 760, salaire_net_mensuel: 680,
      charges_salariales_pct: 11, charges_patronales_pct: 23,
      heures_hebdo: 40, panier_repas_jour: 5, indemnite_trajet_jour: 3,
      prime_mensuelle: 0, actif: true,
      telephone: '+351 915 444 555', email: 'rui.c@demo-valho.pt',
    },
  ]

  const { data: insertedMembros, error: errMembros } = await supabase
    .from('membres_btp').insert(membros).select()
  if (errMembros) { console.error('❌ Membros:', errMembros.message) }
  else console.log(`✅ ${insertedMembros!.length} colaboradores criados`)

  // ════════════════════════════════════════════════════════════
  // 5. OBRAS — 5 chantiers ao PT
  // ════════════════════════════════════════════════════════════
  console.log('\n5️⃣  Insertion des 5 obras...')

  const obras = [
    {
      owner_id: ownerId,
      titre: `${DEMO_TAG} Remodelação completa T3 — Rua das Flores`,
      client: 'Sra. Ana Rodrigues',
      adresse: 'Rua das Flores, 123, 4000-193 Porto',
      latitude: 41.1462, longitude: -8.6141, geo_rayon_m: 100,
      date_debut: '2026-03-10', date_fin: '2026-05-15',
      budget: 32000, statut: 'En cours',
      description: 'Remodelação completa de T3 com 95m²: demolição de tabiques, gesso cartonado, instalação elétrica, canalização, pintura, azulejo, soalho em madeira.',
      equipe: 'Equipa A — Remodelação',
    },
    {
      owner_id: ownerId,
      titre: `${DEMO_TAG} Reabilitação fachada — Edifício Boavista`,
      client: 'Condomínio Boavista Center',
      adresse: 'Avenida da Boavista, 1400, 4100-115 Porto',
      latitude: 41.1579, longitude: -8.6389, geo_rayon_m: 150,
      date_debut: '2026-04-01', date_fin: '2026-06-30',
      budget: 58000, statut: 'En cours',
      description: 'Reabilitação de fachada R+5 (380m²): limpeza, tratamento de fissuras, reboco novo, pintura exterior.',
      equipe: 'Equipa B — Fachadas',
    },
    {
      owner_id: ownerId,
      titre: `${DEMO_TAG} Construção moradia V3 — Maia`,
      client: 'Sr. e Sra. Pereira',
      adresse: 'Rua do Souto, 45, 4470-214 Maia',
      latitude: 41.2257, longitude: -8.6209, geo_rayon_m: 100,
      date_debut: '2026-01-15', date_fin: '2026-09-30',
      budget: 185000, statut: 'En cours',
      description: 'Construção de moradia V3 em banda com 180m² de área útil. Fundações, estrutura em betão armado, alvenaria, cobertura, instalações, acabamentos.',
      equipe: 'Equipa A — Remodelação',
    },
    {
      owner_id: ownerId,
      titre: `${DEMO_TAG} Remodelação escritórios — Matosinhos`,
      client: 'Porto Tech Solutions, Lda',
      adresse: 'Rua Brito Capelo, 88, 4450-068 Matosinhos',
      latitude: 41.1847, longitude: -8.6905, geo_rayon_m: 100,
      date_debut: '2026-02-01', date_fin: '2026-03-28',
      budget: 24000, statut: 'En attente',
      description: 'Remodelação de open space de 200m²: piso técnico, tectos falsos, partições de vidro, instalação elétrica e rede informática.',
      equipe: 'Equipa B — Fachadas',
    },
    {
      owner_id: ownerId,
      titre: `${DEMO_TAG} Instalação AVAC — Clínica Cedofeita`,
      client: 'Clínica Médica Cedofeita',
      adresse: 'Rua de Cedofeita, 320, 4050-178 Porto',
      latitude: 41.1530, longitude: -8.6240, geo_rayon_m: 80,
      date_debut: '2026-04-15', date_fin: '2026-05-30',
      budget: 18500, statut: 'En attente',
      description: 'Fornecimento e instalação de sistema de climatização AVAC para clínica médica (8 unidades interiores, 2 unidades exteriores).',
      equipe: null,
    },
  ]

  const { data: insertedObras, error: errObras } = await supabase
    .from('chantiers_btp').insert(obras).select('id')
  if (errObras) { console.error('❌ Obras:', errObras.message); return }
  const obraIds = insertedObras!.map(o => o.id)
  console.log(`✅ ${obraIds.length} obras criadas`)

  // ════════════════════════════════════════════════════════════
  // 6. ORÇAMENTOS (DEVIS) — 5 documentos
  // ════════════════════════════════════════════════════════════
  console.log('\n6️⃣  Insertion des 5 orçamentos...')

  const orcamentos = [
    {
      artisan_id: artisanId, artisan_user_id: ownerId,
      numero: 'ORC-DEMO-PT-001',
      client_name: 'Sra. Ana Rodrigues', client_email: 'ana.rodrigues@demo-pt.com',
      client_phone: '+351 961 111 222', client_address: 'Rua das Flores, 123, 4000-193 Porto',
      status: 'signed', currency: 'EUR', country: 'PT',
      tax_rate: 23, tax_label: 'IVA 23%',
      total_ht_cents: 3200000, total_tax_cents: 736000, total_ttc_cents: 3936000,
      notes: `${DEMO_TAG} Remodelação T3 — Rua das Flores`,
      items: JSON.stringify([
        { description: 'Demolição de tabiques + remoção de entulho', qty: 1, priceHT: 1800, totalHT: 1800, unite: 'forfait', tvaRate: 23 },
        { description: 'Gesso cartonado BA13 — fornecimento + aplicação (90m²)', qty: 90, priceHT: 38, totalHT: 3420, unite: 'm²', tvaRate: 23 },
        { description: 'Instalação elétrica — certificação CERTIEL', qty: 1, priceHT: 4200, totalHT: 4200, unite: 'forfait', tvaRate: 23 },
        { description: 'Pintura 2 demãos paredes + tectos (115m²)', qty: 115, priceHT: 22, totalHT: 2530, unite: 'm²', tvaRate: 23 },
        { description: 'Azulejo pavimento WC (10m²)', qty: 10, priceHT: 75, totalHT: 750, unite: 'm²', tvaRate: 23 },
        { description: 'Azulejo revestimento WC (15m²)', qty: 15, priceHT: 65, totalHT: 975, unite: 'm²', tvaRate: 23 },
        { description: 'Cozinha — montagem móveis + bancada', qty: 1, priceHT: 3200, totalHT: 3200, unite: 'forfait', tvaRate: 23 },
        { description: 'Canalização WC + cozinha', qty: 1, priceHT: 3800, totalHT: 3800, unite: 'forfait', tvaRate: 23 },
        { description: 'Soalho em madeira sala + quartos (42m²)', qty: 42, priceHT: 65, totalHT: 2730, unite: 'm²', tvaRate: 23 },
        { description: 'Limpeza pós-obra', qty: 1, priceHT: 1595, totalHT: 1595, unite: 'forfait', tvaRate: 23 },
      ]),
    },
    {
      artisan_id: artisanId, artisan_user_id: ownerId,
      numero: 'ORC-DEMO-PT-002',
      client_name: 'Condomínio Boavista Center', client_email: 'admin@boavista-center.pt',
      client_phone: '+351 222 000 001', client_address: 'Av. da Boavista, 1400, 4100-115 Porto',
      status: 'sent', currency: 'EUR', country: 'PT',
      tax_rate: 23, tax_label: 'IVA 23%',
      total_ht_cents: 5800000, total_tax_cents: 1334000, total_ttc_cents: 7134000,
      notes: `${DEMO_TAG} Reabilitação fachada Boavista`,
      items: JSON.stringify([
        { description: 'Montagem andaime fachada R+5 (380m²)', qty: 1, priceHT: 7200, totalHT: 7200, unite: 'forfait', tvaRate: 23 },
        { description: 'Limpeza alta pressão fachada', qty: 380, priceHT: 10, totalHT: 3800, unite: 'm²', tvaRate: 23 },
        { description: 'Reparação fissuras + selagem', qty: 1, priceHT: 2800, totalHT: 2800, unite: 'forfait', tvaRate: 23 },
        { description: 'Reboco monocamada fachada (380m²)', qty: 380, priceHT: 38, totalHT: 14440, unite: 'm²', tvaRate: 23 },
        { description: 'Pintura exterior 2 demãos (380m²)', qty: 380, priceHT: 22, totalHT: 8360, unite: 'm²', tvaRate: 23 },
        { description: 'Desmontagem andaime', qty: 1, priceHT: 19400, totalHT: 19400, unite: 'forfait', tvaRate: 23 },
      ]),
    },
    {
      artisan_id: artisanId, artisan_user_id: ownerId,
      numero: 'ORC-DEMO-PT-003',
      client_name: 'Sr. e Sra. Pereira', client_email: 'f.pereira@demo-pt.com',
      client_phone: '+351 962 333 444', client_address: 'Rua do Souto, 45, 4470-214 Maia',
      status: 'signed', currency: 'EUR', country: 'PT',
      tax_rate: 23, tax_label: 'IVA 23%',
      total_ht_cents: 18500000, total_tax_cents: 4255000, total_ttc_cents: 22755000,
      notes: `${DEMO_TAG} Construção moradia V3 — Maia`,
      items: JSON.stringify([
        { description: 'Fundações + infraestruturas', qty: 1, priceHT: 22000, totalHT: 22000, unite: 'forfait', tvaRate: 23 },
        { description: 'Estrutura betão armado (180m²)', qty: 180, priceHT: 180, totalHT: 32400, unite: 'm²', tvaRate: 23 },
        { description: 'Alvenaria blocos de betão (350m²)', qty: 350, priceHT: 42, totalHT: 14700, unite: 'm²', tvaRate: 23 },
        { description: 'Cobertura em telha cerâmica (95m²)', qty: 95, priceHT: 85, totalHT: 8075, unite: 'm²', tvaRate: 23 },
        { description: 'Isolamento térmico + impermeabilização', qty: 1, priceHT: 12000, totalHT: 12000, unite: 'forfait', tvaRate: 23 },
        { description: 'Caixilharia alumínio + vidro duplo (18 unidades)', qty: 18, priceHT: 850, totalHT: 15300, unite: 'u', tvaRate: 23 },
        { description: 'Instalação elétrica + domótica', qty: 1, priceHT: 9500, totalHT: 9500, unite: 'forfait', tvaRate: 23 },
        { description: 'Canalização + AVAC', qty: 1, priceHT: 14500, totalHT: 14500, unite: 'forfait', tvaRate: 23 },
        { description: 'Acabamentos interiores (revestimentos, pinturas)', qty: 1, priceHT: 22500, totalHT: 22500, unite: 'forfait', tvaRate: 23 },
        { description: 'Arranjos exteriores + muros', qty: 1, priceHT: 14025, totalHT: 14025, unite: 'forfait', tvaRate: 23 },
      ]),
    },
    {
      artisan_id: artisanId, artisan_user_id: ownerId,
      numero: 'ORC-DEMO-PT-004',
      client_name: 'Porto Tech Solutions, Lda', client_email: 'obras@portotechsolutions.pt',
      client_phone: '+351 229 444 555', client_address: 'Rua Brito Capelo, 88, 4450-068 Matosinhos',
      status: 'signed', currency: 'EUR', country: 'PT',
      tax_rate: 23, tax_label: 'IVA 23%',
      total_ht_cents: 2400000, total_tax_cents: 552000, total_ttc_cents: 2952000,
      notes: `${DEMO_TAG} Remodelação escritórios Matosinhos`,
      items: JSON.stringify([
        { description: 'Pavimento técnico elevado (200m²)', qty: 200, priceHT: 45, totalHT: 9000, unite: 'm²', tvaRate: 23 },
        { description: 'Tectos falsos Armstrong (200m²)', qty: 200, priceHT: 28, totalHT: 5600, unite: 'm²', tvaRate: 23 },
        { description: 'Divisórias de vidro temperado (12ml)', qty: 12, priceHT: 320, totalHT: 3840, unite: 'ml', tvaRate: 23 },
        { description: 'Instalação elétrica + iluminação LED', qty: 1, priceHT: 3800, totalHT: 3800, unite: 'forfait', tvaRate: 23 },
        { description: 'Rede informática estruturada (CAT6)', qty: 1, priceHT: 1760, totalHT: 1760, unite: 'forfait', tvaRate: 23 },
      ]),
    },
    {
      artisan_id: artisanId, artisan_user_id: ownerId,
      numero: 'ORC-DEMO-PT-005',
      client_name: 'Clínica Médica Cedofeita', client_email: 'admin@clinicacedofeita.pt',
      client_phone: '+351 222 555 666', client_address: 'Rua de Cedofeita, 320, 4050-178 Porto',
      status: 'draft', currency: 'EUR', country: 'PT',
      tax_rate: 23, tax_label: 'IVA 23%',
      total_ht_cents: 1850000, total_tax_cents: 425500, total_ttc_cents: 2275500,
      notes: `${DEMO_TAG} Instalação AVAC clínica`,
      items: JSON.stringify([
        { description: 'Unidades interiores multi-split (8 unidades)', qty: 8, priceHT: 1200, totalHT: 9600, unite: 'u', tvaRate: 23 },
        { description: 'Unidades exteriores (2 unidades)', qty: 2, priceHT: 2800, totalHT: 5600, unite: 'u', tvaRate: 23 },
        { description: 'Tubagem frigorífica + suportes', qty: 1, priceHT: 1800, totalHT: 1800, unite: 'forfait', tvaRate: 23 },
        { description: 'Instalação elétrica dedicada AVAC', qty: 1, priceHT: 900, totalHT: 900, unite: 'forfait', tvaRate: 23 },
        { description: 'Colocação + testes + certificação', qty: 1, priceHT: 600, totalHT: 600, unite: 'forfait', tvaRate: 23 },
      ]),
    },
  ]

  const { data: insertedOrc, error: errOrc } = await supabase
    .from('devis').insert(orcamentos).select()
  if (errOrc) {
    console.warn('⚠️  Orçamentos ignorados (devis stockés en localStorage, pas en DB):', errOrc.message)
  } else {
    console.log(`✅ ${insertedOrc!.length} orçamentos criados`)
  }

  // ════════════════════════════════════════════════════════════
  // 7. EQUIPAS
  // ════════════════════════════════════════════════════════════
  console.log('\n7️⃣  Création des équipes...')

  const equipas = [
    { owner_id: ownerId, nom: `${DEMO_TAG} Equipa A — Remodelação`, metier: 'Remodelação e construção', chantier_id: obraIds[0] },
    { owner_id: ownerId, nom: `${DEMO_TAG} Equipa B — Fachadas`, metier: 'Fachadas e reabilitação', chantier_id: obraIds[1] },
  ]

  const { error: errEquipas } = await supabase.from('equipes_btp').insert(equipas)
  if (errEquipas) console.error('❌ Equipas:', errEquipas.message)
  else console.log('✅ 2 equipas criadas')

  // ════════════════════════════════════════════════════════════
  // 8. MARCAÇÕES DE HORAS (pointages)
  // ════════════════════════════════════════════════════════════
  console.log('\n8️⃣  Insertion des pointages...')

  const pointages = [
    { owner_id: ownerId, employe: 'Miguel Ferreira', poste: 'Encarregado de Obra', chantier_nom: 'Remodelação T3 — Rua das Flores', date: '2026-03-25', heures_travaillees: 8, heure_arrivee: '07:30', heure_depart: '16:30', pause_minutes: 60 },
    { owner_id: ownerId, employe: 'João Santos', poste: 'Pedreiro N3', chantier_nom: 'Remodelação T3 — Rua das Flores', date: '2026-03-25', heures_travaillees: 8, heure_arrivee: '07:30', heure_depart: '16:30', pause_minutes: 60 },
    { owner_id: ownerId, employe: 'André Oliveira', poste: 'Eletricista', chantier_nom: 'Remodelação escritórios Matosinhos', date: '2026-03-26', heures_travaillees: 9, heure_arrivee: '07:00', heure_depart: '17:00', pause_minutes: 60 },
    { owner_id: ownerId, employe: 'Rui Costa', poste: 'Aprendiz', chantier_nom: 'Reabilitação fachada Boavista', date: '2026-03-27', heures_travaillees: 8, heure_arrivee: '08:00', heure_depart: '17:00', pause_minutes: 60 },
    { owner_id: ownerId, employe: 'Miguel Ferreira', poste: 'Encarregado de Obra', chantier_nom: 'Construção moradia V3 Maia', date: '2026-03-28', heures_travaillees: 10, heure_arrivee: '06:30', heure_depart: '17:30', pause_minutes: 60 },
    { owner_id: ownerId, employe: 'João Santos', poste: 'Pedreiro N3', chantier_nom: 'Construção moradia V3 Maia', date: '2026-03-28', heures_travaillees: 10, heure_arrivee: '06:30', heure_depart: '17:30', pause_minutes: 60 },
  ]

  const { error: errPt } = await supabase.from('pointages_btp').insert(pointages)
  if (errPt) console.error('❌ Pointages:', errPt.message)
  else console.log(`✅ ${pointages.length} marcações de horas criadas`)

  // ════════════════════════════════════════════════════════════
  // 9. DESPESAS
  // ════════════════════════════════════════════════════════════
  console.log('\n9️⃣  Insertion des dépenses...')

  const despesas = [
    { owner_id: ownerId, label: 'Materiais — gesso cartonado + perfis (Obra Flores)', amount: 2840, category: 'materiau', date: '2026-03-12', notes: 'Saint-Gobain — fatura 2026-MAR-0412' },
    { owner_id: ownerId, label: 'Caixilharia alumínio — Moradia Maia (parcela 1)', amount: 7650, category: 'materiau', date: '2026-02-20', notes: 'João Pereira Alumínios, Lda' },
    { owner_id: ownerId, label: 'Aluguer andaime — Fachada Boavista (3 meses)', amount: 3200, category: 'materiau', date: '2026-04-01', notes: 'Scaffolding Porto, Lda' },
    { owner_id: ownerId, label: 'Seguro RC Profissional — 2º trimestre', amount: 1450, category: 'assurance', date: '2026-04-01', notes: 'Fidelidade — apólice 2026-RC-7891' },
    { owner_id: ownerId, label: 'Combustível furgão + carrinha (Março)', amount: 380, category: 'vehicule', date: '2026-03-31', notes: 'Março 2026 — 2200km' },
    { owner_id: ownerId, label: 'Contabilista — honorários Março', amount: 350, category: 'charges', date: '2026-04-05', notes: 'Contabilidade Sousa & Associados' },
    { owner_id: ownerId, label: 'Ferramentas — berbequim + esmerilhadora', amount: 620, category: 'materiau', date: '2026-03-15', notes: 'Leroy Merlin Porto' },
    { owner_id: ownerId, label: 'Cimento + areia — Moradia Maia (semana 8)', amount: 1280, category: 'materiau', date: '2026-03-18', notes: 'Cimpor — nota de encomenda 2026-003' },
    { owner_id: ownerId, label: 'Portagens + estacionamento (Março)', amount: 95, category: 'vehicule', date: '2026-03-31', notes: 'Via Verde + parques Porto' },
    { owner_id: ownerId, label: 'Software Vitfix PRO — mensalidade Abril', amount: 79, category: 'charges', date: '2026-04-01', notes: 'Subscrição mensal' },
  ]

  const { error: errDesp } = await supabase.from('depenses_btp').insert(despesas)
  if (errDesp) console.error('❌ Despesas:', errDesp.message)
  else console.log(`✅ ${despesas.length} despesas inseridas`)

  // ════════════════════════════════════════════════════════════
  // 10. SITUAÇÕES DE OBRA (situations de travaux)
  // ════════════════════════════════════════════════════════════
  console.log('\n🔟  Insertion des situations de travaux...')

  const situacoes = [
    {
      owner_id: ownerId,
      chantier: `${DEMO_TAG} Remodelação T3 — Rua das Flores`,
      client: 'Sra. Ana Rodrigues',
      numero: 1,
      date: '2026-04-01',
      montant_marche: 32000,
      statut: 'validée',
      travaux: JSON.stringify([
        { designation: 'Demolição + gesso cartonado', montantHT: 8400, avancement: 100 },
        { designation: 'Instalação elétrica', montantHT: 4200, avancement: 100 },
        { designation: 'Canalização + WC', montantHT: 6800, avancement: 60 },
        { designation: 'Revestimentos e pinturas', montantHT: 7600, avancement: 40 },
        { designation: 'Soalho + acabamentos', montantHT: 5000, avancement: 10 },
      ]),
    },
    {
      owner_id: ownerId,
      chantier: `${DEMO_TAG} Construção moradia V3 — Maia`,
      client: 'Sr. e Sra. Pereira',
      numero: 2,
      date: '2026-03-15',
      montant_marche: 185000,
      statut: 'validée',
      travaux: JSON.stringify([
        { designation: 'Fundações + infraestruturas', montantHT: 22000, avancement: 100 },
        { designation: 'Estrutura betão armado', montantHT: 32400, avancement: 100 },
        { designation: 'Alvenaria', montantHT: 14700, avancement: 80 },
        { designation: 'Cobertura', montantHT: 8075, avancement: 0 },
        { designation: 'Caixilharia + restantes', montantHT: 108025, avancement: 0 },
      ]),
    },
  ]

  const { error: errSit } = await supabase.from('situations_btp').insert(situacoes)
  if (errSit) console.error('❌ Situações:', errSit.message)
  else console.log(`✅ ${situacoes.length} situações de obra criadas`)

  // ════════════════════════════════════════════════════════════
  // 11. RETENÇÕES DE GARANTIA (retenues)
  // ════════════════════════════════════════════════════════════
  console.log('\n1️⃣1️⃣  Insertion des retenues de garantie...')

  const retencoes = [
    {
      owner_id: ownerId,
      chantier: `${DEMO_TAG} Remodelação T3 — Rua das Flores`,
      client: 'Sra. Ana Rodrigues',
      montant_marche: 32000, taux_retenue: 5, montant_retenu: 1600,
      date_fin_travaux: '2026-05-15', statut: 'active', caution: false,
    },
    {
      owner_id: ownerId,
      chantier: `${DEMO_TAG} Remodelação escritórios Matosinhos`,
      client: 'Porto Tech Solutions, Lda',
      montant_marche: 24000, taux_retenue: 5, montant_retenu: 1200,
      date_fin_travaux: '2026-03-28', statut: 'mainlevée_demandée', caution: false,
    },
    {
      owner_id: ownerId,
      chantier: `${DEMO_TAG} Construção moradia V3 — Maia`,
      client: 'Sr. e Sra. Pereira',
      montant_marche: 185000, taux_retenue: 5, montant_retenu: 9250,
      date_fin_travaux: '2026-09-30', statut: 'active', caution: true,
    },
  ]

  const { error: errRet } = await supabase.from('retenues_btp').insert(retencoes)
  if (errRet) console.error('❌ Retenções:', errRet.message)
  else console.log(`✅ ${retencoes.length} retenções de garantia criadas`)

  // ════════════════════════════════════════════════════════════
  // 12. SUBEMPREITEIROS DC4
  // ════════════════════════════════════════════════════════════
  console.log('\n1️⃣2️⃣  Insertion des sous-traitants DC4...')

  const subempreiteiros = [
    {
      owner_id: ownerId,
      entreprise: `${DEMO_TAG} Ferreira Eletricidade, Lda`,
      siret: '501 234 567',
      responsable: 'Paulo Ferreira',
      email: 'geral@ferreira-eletricidade.pt',
      telephone: '+351 222 111 333',
      adresse: 'Rua Álvares Cabral, 55, 4050-041 Porto',
      chantier: 'Remodelação T3 — Rua das Flores',
      lot: 'Instalação elétrica',
      montant_marche: 4200, taux_tva: 23, statut: 'agréé',
      date_agrement: '2026-03-01', dc4_genere: true,
    },
    {
      owner_id: ownerId,
      entreprise: `${DEMO_TAG} Santos & Pinto Canalizações, Unipessoal`,
      siret: '502 345 678',
      responsable: 'Nuno Pinto',
      email: 'nuno@sp-canalizacoes.pt',
      telephone: '+351 913 222 444',
      adresse: 'Rua Formosa, 120, 4000-249 Porto',
      chantier: 'Construção moradia V3 — Maia',
      lot: 'Canalização + AVAC',
      montant_marche: 14500, taux_tva: 23, statut: 'agréé',
      date_agrement: '2026-02-15', dc4_genere: false,
    },
  ]

  const { error: errDc4 } = await supabase.from('dc4_btp').insert(subempreiteiros)
  if (errDc4) console.error('❌ DC4:', errDc4.message)
  else console.log(`✅ ${subempreiteiros.length} subempreiteiros DC4 criados`)

  // ════════════════════════════════════════════════════════════
  // 13. CONCURSOS DPGF
  // ════════════════════════════════════════════════════════════
  console.log('\n1️⃣3️⃣  Insertion des concursos DPGF...')

  const concursos = [
    {
      owner_id: ownerId,
      titre: `${DEMO_TAG} Concurso — Reabilitação Escola EB1 Paranhos`,
      client: 'Câmara Municipal do Porto',
      date_remise: '2026-05-20',
      montant_estime: 480000,
      statut: 'en_cours',
      lots: JSON.stringify([
        { numero: 'Lote 1', designation: 'Movimentação de terras + fundações', montantHT: 55000 },
        { numero: 'Lote 2', designation: 'Estrutura + alvenaria', montantHT: 120000 },
        { numero: 'Lote 3', designation: 'Cobertura + impermeabilização', montantHT: 65000 },
        { numero: 'Lote 4', designation: 'Caixilharia + serralharia', montantHT: 48000 },
        { numero: 'Lote 5', designation: 'Instalações elétricas + AVAC', montantHT: 72000 },
        { numero: 'Lote 6', designation: 'Acabamentos interiores', montantHT: 85000 },
        { numero: 'Lote 7', designation: 'Arranjos exteriores', montantHT: 35000 },
      ]),
    },
    {
      owner_id: ownerId,
      titre: `${DEMO_TAG} Concurso — Edifício Residencial Gaia (32 frações)`,
      client: 'Habitat Gaia, SA',
      date_remise: '2026-06-15',
      montant_estime: 2200000,
      statut: 'soumis',
      lots: JSON.stringify([
        { numero: 'Lote A', designation: 'Infraestruturas + fundações', montantHT: 180000 },
        { numero: 'Lote B', designation: 'Estrutura betão armado', montantHT: 420000 },
        { numero: 'Lote C', designation: 'Fachadas + cobertura', montantHT: 310000 },
        { numero: 'Lote D', designation: 'Caixilharia + zonas comuns', montantHT: 245000 },
        { numero: 'Lote E', designation: 'Instalações especiais', montantHT: 380000 },
        { numero: 'Lote F', designation: 'Acabamentos + garagem', montantHT: 665000 },
      ]),
    },
  ]

  const { error: errDpgf } = await supabase.from('dpgf_btp').insert(concursos)
  if (errDpgf) console.error('❌ DPGF:', errDpgf.message)
  else console.log(`✅ ${concursos.length} concursos DPGF criados`)

  // ════════════════════════════════════════════════════════════
  // 14. CONTAS DE UTILIZADORES (pro_team_members)
  // ════════════════════════════════════════════════════════════
  console.log('\n1️⃣4️⃣  Création des comptes équipe...')

  const teamMembers = [
    {
      company_id: ownerId, user_id: null,
      email: 'miguel.ferreira@demo-valho.pt',
      full_name: `${DEMO_TAG} Miguel Ferreira`,
      phone: '+351 912 111 222',
      role: 'CHEF_CHANTIER',
      assigned_chantiers: [obraIds[0], obraIds[2]],
      invite_sent_at: '2026-03-01T10:00:00Z',
      accepted_at: '2026-03-01T14:30:00Z',
      last_login_at: '2026-04-10T07:15:00Z',
      is_active: true,
    },
    {
      company_id: ownerId, user_id: null,
      email: 'joao.santos@demo-valho.pt',
      full_name: `${DEMO_TAG} João Santos`,
      phone: '+351 913 222 333',
      role: 'OUVRIER',
      assigned_chantiers: [obraIds[0], obraIds[1]],
      invite_sent_at: '2026-03-01T10:00:00Z',
      accepted_at: '2026-03-02T09:00:00Z',
      last_login_at: '2026-04-09T07:30:00Z',
      is_active: true,
    },
    {
      company_id: ownerId, user_id: null,
      email: 'ines.martins@demo-valho.pt',
      full_name: `${DEMO_TAG} Inês Martins`,
      phone: '+351 916 555 666',
      role: 'SECRETAIRE',
      assigned_chantiers: [],
      invite_sent_at: '2026-03-05T09:00:00Z',
      accepted_at: '2026-03-05T11:00:00Z',
      last_login_at: '2026-04-10T09:00:00Z',
      is_active: true,
    },
    {
      company_id: ownerId, user_id: null,
      email: 'andre.oliveira@demo-valho.pt',
      full_name: `${DEMO_TAG} André Oliveira`,
      phone: '+351 914 333 444',
      role: 'OUVRIER',
      assigned_chantiers: [obraIds[3]],
      invite_sent_at: '2026-03-10T08:00:00Z',
      accepted_at: null,
      last_login_at: null,
      is_active: false,
    },
  ]

  const { error: errTeam } = await supabase.from('pro_team_members').insert(teamMembers)
  if (errTeam) console.error('❌ Team members:', errTeam.message)
  else console.log(`✅ ${teamMembers.length} contas de equipa criadas`)

  // ════════════════════════════════════════════════════════════
  // RÉSUMÉ
  // ════════════════════════════════════════════════════════════
  console.log(`
╔══════════════════════════════════════════════════════════╗
║        ✅ CONTA DEMO PT CRIADA COM SUCESSO               ║
╠══════════════════════════════════════════════════════════╣
║  Email    : admincvlhopt@gmail.com                       ║
║  Password : Fixit2024!                                   ║
║  Empresa  : Construções Valho & Filhos, Lda              ║
║  NIPC     : 512 345 678                                  ║
║  Morada   : Rua de Santa Catarina, 247 — Porto           ║
╠══════════════════════════════════════════════════════════╣
║  4 colaboradores                                         ║
║  5 obras (Porto, Maia, Matosinhos)                       ║
║  5 orçamentos (IVA 23%, EUR)                             ║
║  2 situações de obra                                     ║
║  3 retenções de garantia (5%)                            ║
║  2 subempreiteiros DC4                                   ║
║  2 concursos DPGF                                        ║
║  10 despesas                                             ║
║  6 marcações de horas                                    ║
║  4 contas de equipa                                      ║
╚══════════════════════════════════════════════════════════╝

URL: https://fixit-production.vercel.app/pt/pro/dashboard
`)
}

seed().catch(console.error)
