import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { CATEGORIES, DEPRECATED_SLUGS } from '@/lib/categories'

export const dynamic = 'force-dynamic'

// POST /api/admin/sync-categories
// Syncs the categories table with lib/categories.ts (single source of truth).
// Requires super_admin auth.
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`admin_sync_cat_${ip}`, 3, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request as any)
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  const ADMIN_EMAILS = [process.env.ADMIN_EMAIL].filter(Boolean) as string[]
  if (!user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Accès réservé aux super_admin' }, { status: 403 })
  }

  const results: string[] = []

  // 1. Add display_order and featured columns if missing (already done via migration 047)

  // 2. Deactivate deprecated categories
  const { count: deactivated } = await supabaseAdmin
    .from('categories')
    .update({ active: false })
    .in('slug', DEPRECATED_SLUGS)
    .select('*', { count: 'exact', head: true })
  results.push(`Deactivated ${deactivated || 0} deprecated categories`)

  // 3. Upsert all active categories
  for (const cat of CATEGORIES) {
    const { error } = await supabaseAdmin
      .from('categories')
      .upsert({
        slug: cat.slug,
        icon: cat.icon,
        active: true,
        display_order: cat.order,
        featured: cat.featured,
      }, { onConflict: 'slug' })

    if (error) results.push(`Error upserting ${cat.slug}: ${error.message}`)
  }
  results.push(`Upserted ${CATEGORIES.length} categories`)

  // 4. Migrate artisan profiles with deprecated slugs
  for (const old of DEPRECATED_SLUGS) {
    const { data: affected } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id, categories')
      .contains('categories', [old])

    if (affected && affected.length > 0) {
      for (const profile of affected) {
        const cats = (profile.categories as string[])
          .map(c => c === old ? 'espaces-verts' : c)
          .filter((c, i, a) => a.indexOf(c) === i) // dedupe
        await supabaseAdmin
          .from('profiles_artisan')
          .update({ categories: cats })
          .eq('id', profile.id)
      }
      results.push(`Migrated ${affected.length} artisan profiles from "${old}" → "espaces-verts"`)
    }
  }

  return NextResponse.json({ ok: true, results })
}
