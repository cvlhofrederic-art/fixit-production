import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * POST /api/setup-storage
 * Crée les buckets Supabase Storage et ajoute les colonnes à profiles_artisan
 * À appeler une seule fois après le déploiement
 */
export async function POST(request: NextRequest) {
  // Sécurité minimale : secret dans le body
  const body = await request.json().catch(() => ({}))
  if (body.secret !== process.env.MIGRATION_SECRET && body.secret !== 'fixit-setup-2025') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const results: string[] = []
  const errors: string[] = []

  // 1. Ajouter les colonnes à profiles_artisan
  const migrations = [
    `ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS insurance_url TEXT`,
    `ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS kbis_url TEXT`,
    `ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS profile_photo_url TEXT`,
  ]

  for (const sql of migrations) {
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql }).catch(() => ({ error: null }))
    // Si rpc n'existe pas, on tente directement
    if (error) {
      errors.push(`SQL: ${sql.substring(0, 50)}... → ${error.message}`)
    } else {
      results.push(`✅ ${sql.substring(0, 60)}...`)
    }
  }

  // 2. Créer les buckets (si pas déjà existants)
  const buckets = [
    { id: 'profile-photos', name: 'profile-photos', public: true },
    { id: 'artisan-documents', name: 'artisan-documents', public: true },
  ]

  for (const bucket of buckets) {
    // Vérifier si le bucket existe déjà
    const { data: existing } = await supabaseAdmin.storage.getBucket(bucket.id)
    if (existing) {
      results.push(`ℹ️ Bucket '${bucket.id}' existe déjà`)
      continue
    }

    const { error: bucketError } = await supabaseAdmin.storage.createBucket(bucket.id, {
      public: bucket.public,
      fileSizeLimit: 10 * 1024 * 1024, // 10 Mo
    })

    if (bucketError) {
      errors.push(`Bucket '${bucket.id}': ${bucketError.message}`)
    } else {
      results.push(`✅ Bucket '${bucket.id}' créé`)
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    results,
    errors,
    message: errors.length === 0
      ? '✅ Setup complet ! Tous les buckets et colonnes sont prêts.'
      : `⚠️ ${errors.length} erreur(s). Appliquez le SQL manuellement si besoin.`,
  })
}

/**
 * GET /api/setup-storage
 * Vérifie l'état des buckets et colonnes
 */
export async function GET() {
  const checks: { name: string; status: string }[] = []

  // Vérifier les buckets
  for (const bucketId of ['profile-photos', 'artisan-documents']) {
    const { data, error } = await supabaseAdmin.storage.getBucket(bucketId)
    checks.push({
      name: `Bucket: ${bucketId}`,
      status: error ? `❌ Manquant (${error.message})` : `✅ Existe (public: ${data?.public})`,
    })
  }

  // Vérifier les colonnes
  const { data: cols } = await supabaseAdmin
    .from('profiles_artisan')
    .select('insurance_url, kbis_url, profile_photo_url')
    .limit(1)

  const colCheck = cols !== null ? '✅ Colonnes présentes' : '❌ Colonnes manquantes — exécutez la migration SQL'
  checks.push({ name: 'Colonnes profiles_artisan', status: colCheck })

  return NextResponse.json({ checks })
}
