/**
 * Seed Demo Client — Portugal 🇵🇹
 *
 * Crée un compte client de démonstration côté Portugal.
 *
 * Usage:
 *   npx tsx scripts/seed-demo-client-pt.ts           → crée le compte
 *   npx tsx scripts/seed-demo-client-pt.ts --clean   → supprime le compte
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

const ACCOUNT = {
  email: 'democlientpt@gmail.com',
  password: 'Fixit2024!',
  full_name: 'Maria Silva',
  phone: '+351 912 345 678',
  address: 'Rua de Santa Catarina, 150',
  city: 'Porto',
  postal_code: '4000-447',
  country: 'PT',
  locale: 'pt',
  role: 'client',
  client_type: 'particulier',
}

async function seed() {
  const isClean = process.argv.includes('--clean')

  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existing = existingUsers?.users?.find(u => u.email === ACCOUNT.email)

  if (isClean) {
    if (!existing) {
      console.log('Compte introuvable, rien à supprimer.')
      return
    }
    const { error } = await supabase.auth.admin.deleteUser(existing.id)
    if (error) {
      console.error('❌ Erreur suppression:', error.message)
      return
    }
    console.log('🧹 Compte supprimé:', ACCOUNT.email)
    return
  }

  if (existing) {
    console.log('ℹ️  Le compte existe déjà:', ACCOUNT.email)
    console.log('   ID:', existing.id)
    // Mise à jour mot de passe + metadata pour garantir l'accès
    const { error: updErr } = await supabase.auth.admin.updateUserById(existing.id, {
      password: ACCOUNT.password,
      email_confirm: true,
      user_metadata: {
        full_name: ACCOUNT.full_name,
        phone: ACCOUNT.phone,
        address: ACCOUNT.address,
        city: ACCOUNT.city,
        postal_code: ACCOUNT.postal_code,
        country: ACCOUNT.country,
        locale: ACCOUNT.locale,
        role: ACCOUNT.role,
        client_type: ACCOUNT.client_type,
      },
    })
    if (updErr) {
      console.error('❌ Erreur mise à jour:', updErr.message)
      return
    }
    console.log('✅ Mot de passe + metadata réinitialisés.')
    console.log(`🔐 Connexion: ${ACCOUNT.email} / ${ACCOUNT.password}`)
    return
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: ACCOUNT.email,
    password: ACCOUNT.password,
    email_confirm: true,
    user_metadata: {
      full_name: ACCOUNT.full_name,
      phone: ACCOUNT.phone,
      address: ACCOUNT.address,
      city: ACCOUNT.city,
      postal_code: ACCOUNT.postal_code,
      country: ACCOUNT.country,
      locale: ACCOUNT.locale,
      role: ACCOUNT.role,
      client_type: ACCOUNT.client_type,
    },
  })

  if (error) {
    console.error('❌ Erreur création compte:', error.message)
    return
  }

  console.log('✅ Compte client PT créé avec succès !')
  console.log('   Email :', ACCOUNT.email)
  console.log('   ID    :', data.user.id)
  console.log('   Rôle  : client')
  console.log('   Locale: pt')
  console.log(`\n🔐 Connexion: ${ACCOUNT.email} / ${ACCOUNT.password}`)
}

seed().catch(console.error)
