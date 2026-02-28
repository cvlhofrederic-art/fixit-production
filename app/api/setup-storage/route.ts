import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'

/**
 * POST /api/setup-storage
 * Crée les buckets Supabase Storage et ajoute les colonnes à profiles_artisan
 * SÉCURISÉE : nécessite authentification super_admin
 */
export async function POST(request: NextRequest) {
  // ── Auth : super_admin uniquement ─────────────────────────────────────────
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  if (user.user_metadata?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès réservé aux super_admin' }, { status: 403 })
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
    try {
      const { error } = await supabaseAdmin.rpc('exec_sql', { sql })
      if (error) {
        errors.push(`SQL: ${sql.substring(0, 50)}... → ${error.message}`)
      } else {
        results.push(`OK: ${sql.substring(0, 60)}...`)
      }
    } catch (e: any) {
      errors.push(`SQL: ${sql.substring(0, 50)}... → ${e.message}`)
    }
  }

  // 2. Créer les buckets (si pas déjà existants)
  const buckets = [
    { id: 'profile-photos', name: 'profile-photos', public: true },
    { id: 'artisan-documents', name: 'artisan-documents', public: true },
  ]

  for (const bucket of buckets) {
    const { data: existing } = await supabaseAdmin.storage.getBucket(bucket.id)
    if (existing) {
      results.push(`Bucket '${bucket.id}' existe deja`)
      continue
    }

    const { error: bucketError } = await supabaseAdmin.storage.createBucket(bucket.id, {
      public: bucket.public,
      fileSizeLimit: 10 * 1024 * 1024,
    })

    if (bucketError) {
      errors.push(`Bucket '${bucket.id}': ${bucketError.message}`)
    } else {
      results.push(`Bucket '${bucket.id}' cree`)
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    results,
    errors,
    message: errors.length === 0
      ? 'Setup complet. Tous les buckets et colonnes sont prets.'
      : `${errors.length} erreur(s). Appliquez le SQL manuellement si besoin.`,
  })
}

/**
 * GET /api/setup-storage
 * Vérifie l'état des buckets et colonnes — protégé super_admin
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  if (user.user_metadata?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès réservé aux super_admin' }, { status: 403 })
  }

  const checks: { name: string; status: string }[] = []

  for (const bucketId of ['profile-photos', 'artisan-documents']) {
    const { data, error } = await supabaseAdmin.storage.getBucket(bucketId)
    checks.push({
      name: `Bucket: ${bucketId}`,
      status: error ? `Manquant (${error.message})` : `Existe (public: ${data?.public})`,
    })
  }

  const { data: cols } = await supabaseAdmin
    .from('profiles_artisan')
    .select('insurance_url, kbis_url, profile_photo_url')
    .limit(1)

  const colCheck = cols !== null ? 'Colonnes presentes' : 'Colonnes manquantes'
  checks.push({ name: 'Colonnes profiles_artisan', status: colCheck })

  return NextResponse.json({ checks })
}
