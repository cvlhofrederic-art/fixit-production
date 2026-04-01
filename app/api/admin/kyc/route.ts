import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getUserRole } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

interface KycRow {
  id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  company_name: string | null
  siret: string | null
  email: string | null
  phone: string | null
  kyc_status: string | null
  kyc_score: number | null
  kyc_checks: unknown
  kyc_verified_at: string | null
  kyc_reviewed_at: string | null
  kyc_reviewed_by: string | null
  kyc_rejection_reason: string | null
  kbis_extracted: unknown
  certidao_extracted: unknown
  kbis_url: string | null
  id_document_url: string | null
  kyc_market: string | null
  created_at: string | null
}

// GET /api/admin/kyc — List artisans by KYC status (paginated)
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (getUserRole(user) !== 'admin' && getUserRole(user) !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'pending'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20') || 20))
  const from = (page - 1) * limit
  const to = from + limit - 1

  logger.info('[admin/kyc] GET', { status, page, limit, adminId: user.id })

  const { data, error, count } = await supabaseAdmin
    .from('profiles_artisan')
    .select('*', { count: 'exact' })
    .eq('kyc_status', status)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    logger.error('[admin/kyc] GET failed', { error: error.message })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const total = count ?? 0
  const totalPages = Math.ceil(total / limit)

  return NextResponse.json({
    data: (data ?? []) as KycRow[],
    pagination: { page, limit, total, totalPages },
  })
}

// PATCH /api/admin/kyc — Approve or reject an artisan's KYC
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (getUserRole(user) !== 'admin' && getUserRole(user) !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { artisan_id?: string; action?: string; rejection_reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { artisan_id, action, rejection_reason } = body

  if (!artisan_id || !action) {
    return NextResponse.json({ error: 'artisan_id and action are required' }, { status: 400 })
  }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }
  if (action === 'reject' && !rejection_reason) {
    return NextResponse.json({ error: 'rejection_reason is required when action is reject' }, { status: 400 })
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected'
  const reviewedAt = new Date().toISOString()
  const reviewedBy = user.email ?? user.id

  const updatePayload: Record<string, unknown> = {
    kyc_status: newStatus,
    kyc_reviewed_at: reviewedAt,
    kyc_reviewed_by: reviewedBy,
  }
  if (action === 'reject') {
    updatePayload.kyc_rejection_reason = rejection_reason
  }

  logger.info('[admin/kyc] PATCH', { artisan_id, action, reviewedBy })

  const { data: updatedRows, error } = await supabaseAdmin
    .from('profiles_artisan')
    .update(updatePayload)
    .eq('id', artisan_id)
    .select('email, first_name, last_name, company_name, kyc_market')
    .single()

  if (error || !updatedRows) {
    logger.error('[admin/kyc] PATCH update failed', { error: error?.message, artisan_id })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const artisan = updatedRows as {
    email: string | null
    first_name: string | null
    last_name: string | null
    company_name: string | null
    kyc_market: string | null
  }

  // Fire-and-forget — do not await
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-kyc-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
    },
    body: JSON.stringify({
      to: artisan.email,
      name: `${artisan.first_name ?? ''} ${artisan.last_name ?? ''}`.trim(),
      company: artisan.company_name,
      action,
      rejection_reason,
      market: artisan.kyc_market,
    }),
  }).catch((err: unknown) => logger.warn('[admin/kyc] Email notification failed:', err))

  return NextResponse.json({ success: true, status: newStatus })
}
