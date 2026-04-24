import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isSuperAdmin, unauthorizedResponse } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'
import { adminUsersQuerySchema } from '@/lib/validation'

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const allowed = await checkRateLimit(`admin_users_${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSuperAdmin(user)) return unauthorizedResponse()

  try {
    const { searchParams } = new URL(request.url)
    const parsed = adminUsersQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join('; ') }, { status: 400 })
    }
    const { role: roleFilter, search, page, limit } = parsed.data

    // Fetch all users (Supabase admin API)
    // Note: listUsers doesn't support filtering, so we fetch a large batch and filter client-side
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
      page: 1,
    })

    if (authError) {
      console.error('[admin/users] Auth list error:', authError.message)
      return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
    }

    let users = authData?.users || []

    // Filter by role
    if (roleFilter) {
      users = users.filter(u => {
        const role = u.app_metadata?.role || ''
        return role === roleFilter || role.startsWith(`${roleFilter}_`)
      })
    }

    // Filter by search (email)
    if (search) {
      const q = search.toLowerCase()
      users = users.filter(u =>
        u.email?.toLowerCase().includes(q) ||
        u.user_metadata?.full_name?.toLowerCase().includes(q)
      )
    }

    // Sort by created_at desc
    users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const total = users.length
    const totalPages = Math.ceil(total / limit)
    const paged = users.slice((page - 1) * limit, page * limit)

    // Fetch subscription data for these users
    const userIds = paged.map(u => u.id)
    const { data: subs } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id, subscription_plan, subscription_status')
      .in('user_id', userIds)

    const subsMap = new Map(subs?.map(s => [s.user_id, s]) || [])

    // Format response
    const formatted = paged.map(u => {
      const sub = subsMap.get(u.id)
      return {
        id: u.id,
        email: u.email || '',
        full_name: u.user_metadata?.full_name || '',
        role: u.app_metadata?.role || 'unknown',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at || null,
        subscription_plan: sub?.subscription_plan || 'starter',
        subscription_status: sub?.subscription_status || null,
      }
    })

    return NextResponse.json({
      users: formatted,
      pagination: { page, limit, total, totalPages },
    })
  } catch (error) {
    console.error('[admin/users] Error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
