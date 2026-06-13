import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { CATEGORIES, DEPRECATED_SLUGS } from '@/lib/categories'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// POST /api/admin/sync-categories
// Syncs the categories table with lib/categories.ts (single source of truth).
// Requires super_admin auth.
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`admin_sync_cat_${ip}`, 3, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  const ADMIN_EMAILS = [process.env.ADMIN_EMAIL].filter(Boolean) as string[]
  if (!user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Accès réservé aux super_admin' }, { status: 403 })
  }

  const results: string[] = []

  // 1. Add display_order and featured columns if missing (already done via migration 047)

  // 2. Deactivate deprecated categories
  const { data: deactivated, error: deactivateError } = await supabaseAdmin
    .from('categories')
    .update({ active: false })
    .in('slug', DEPRECATED_SLUGS)
    .select()
  if (deactivateError) {
    logger.error('[admin/sync-categories] Deactivation failed', { error: deactivateError.message })
    results.push(`Error deactivating deprecated categories: ${deactivateError.message}`)
  } else {
    results.push(`Deactivated ${deactivated?.length || 0} deprecated categories`)
  }

  // 3. Sync all active categories.
  // `categories.name` est NOT NULL sans défaut : un upsert sans `name` échoue (et en
  // fournir un écraserait les libellés existants). On fait donc update puis insert.
  for (const cat of CATEGORIES) {
    const payload = {
      icon: cat.icon,
      active: true,
      display_order: cat.order,
      featured: cat.featured,
    }
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('categories')
      .update(payload)
      .eq('slug', cat.slug)
      .select('id')

    if (updateError) {
      logger.warn('[admin/sync-categories] Update failed', { slug: cat.slug, error: updateError.message })
      results.push(`Error upserting ${cat.slug}: ${updateError.message}`)
      continue
    }

    if (!updated || updated.length === 0) {
      // Nouvelle catégorie — name dérivé du slug (libellé affinable ensuite en DB)
      const name = cat.slug.charAt(0).toUpperCase() + cat.slug.slice(1).replace(/-/g, ' ')
      const { error: insertError } = await supabaseAdmin
        .from('categories')
        .insert({ slug: cat.slug, name, ...payload })
      if (insertError) {
        logger.warn('[admin/sync-categories] Insert failed', { slug: cat.slug, error: insertError.message })
        results.push(`Error upserting ${cat.slug}: ${insertError.message}`)
      }
    }
  }
  results.push(`Upserted ${CATEGORIES.length} categories`)

  // 4. Migrate artisan profiles with deprecated slugs
  for (const old of DEPRECATED_SLUGS) {
    const { data: affected, error: affectedError } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id, categories')
      .contains('categories', [old])

    if (affectedError) {
      logger.error('[admin/sync-categories] Lookup of profiles with deprecated slug failed', { slug: old, error: affectedError.message })
      results.push(`Error looking up profiles with "${old}": ${affectedError.message}`)
      continue
    }

    if (affected && affected.length > 0) {
      for (const profile of affected) {
        const cats = (profile.categories ?? [])
          .map(c => c === old ? 'espaces-verts' : c)
          .filter((c, i, a) => a.indexOf(c) === i) // dedupe
        const { error: migrateError } = await supabaseAdmin
          .from('profiles_artisan')
          .update({ categories: cats })
          .eq('id', profile.id)
        if (migrateError) {
          logger.error('[admin/sync-categories] Profile migration failed', { profileId: profile.id, error: migrateError.message })
          results.push(`Error migrating profile ${profile.id}: ${migrateError.message}`)
        }
      }
      results.push(`Migrated ${affected.length} artisan profiles from "${old}" → "espaces-verts"`)
    }
  }

  return NextResponse.json({ ok: true, results })
}
