import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSuperAdmin } from '@/lib/auth-helpers'

/**
 * POST /api/setup-storage
 * Crée les buckets Supabase Storage et ajoute les colonnes à profiles_artisan
 * SÉCURISÉE : nécessite authentification super_admin (app_metadata)
 */
export async function POST(request: NextRequest) {
  // ── Auth : super_admin uniquement (vérifié via app_metadata, non forgeable) ──
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: 'Accès réservé aux super_admin' }, { status: 403 })
  }

  const results: string[] = []
  const errors: string[] = []

  // 1. Vérifier les colonnes de profiles_artisan
  // Columns should exist from migrations. Verify presence.
  const { data: colTest, error: colError } = await supabaseAdmin
    .from('profiles_artisan')
    .select('insurance_url, kbis_url, profile_photo_url')
    .limit(0)

  if (colError) {
    errors.push(`Colonnes manquantes dans profiles_artisan: ${colError.message}. Exécutez les migrations Supabase.`)
  } else {
    results.push('OK: Colonnes insurance_url, kbis_url, profile_photo_url présentes')
  }

  // 2. Créer les buckets (si pas déjà existants)
  // SÉCURITÉ : buckets PRIVÉS — accès via signed URLs uniquement
  const buckets = [
    { id: 'profile-photos', name: 'profile-photos', public: false },
    { id: 'artisan-documents', name: 'artisan-documents', public: false },
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
  if (!isSuperAdmin(user)) {
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
