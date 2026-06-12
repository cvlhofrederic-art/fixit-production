import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getUserRole } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { adminKycQuerySchema, adminKycPatchSchema, validateBody } from '@/lib/validation'

// NB : profiles_artisan n'a PAS de colonnes first_name/last_name ni id_document_url
// (cf. lib/database-types.ts et le même constat dans app/api/kyc-orchestrate/route.ts).
// Le nom de la personne et l'URL de la pièce d'identité vivent dans auth user_metadata.
interface KycRow {
  id: string
  user_id: string | null
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
  const parsed = adminKycQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join('; ') }, { status: 400 })
  }
  const { status, page, limit } = parsed.data
  const from = (page - 1) * limit
  const to = from + limit - 1

  logger.info('[admin/kyc] GET', { status, page, limit, adminId: user.id })

  // Colonnes réduites aux champs réellement consommés par le dashboard admin (KycRow)
  const { data, error, count } = await supabaseAdmin
    .from('profiles_artisan')
    .select(
      'id, user_id, company_name, siret, email, phone, kyc_status, kyc_score, kyc_checks, kyc_verified_at, kyc_reviewed_at, kyc_reviewed_by, kyc_rejection_reason, kbis_extracted, certidao_extracted, kbis_url, kyc_market, created_at',
      { count: 'exact' }
    )
    .eq('kyc_status', status)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    logger.error('[admin/kyc] GET failed', { error: error.message })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const total = count ?? 0
  const totalPages = Math.ceil(total / limit)
  const rows: KycRow[] = data ?? []

  return NextResponse.json({
    data: rows,
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

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const v = validateBody(adminKycPatchSchema, rawBody)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })

  const { artisan_id, action, rejection_reason } = v.data

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

  // profiles_artisan n'a pas de first_name/last_name : l'ancien select sur ces colonnes
  // faisait échouer TOUT le PATCH (erreur PostgREST 42703 → update jamais appliqué).
  const { data: artisan, error } = await supabaseAdmin
    .from('profiles_artisan')
    .update(updatePayload)
    .eq('id', artisan_id)
    .select('email, company_name, kyc_market, user_id')
    .single()

  if (error || !artisan) {
    logger.error('[admin/kyc] PATCH update failed', { error: error?.message, artisan_id })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Le nom de la personne vit dans auth user_metadata.full_name (posé à l'inscription)
  let fullName = ''
  if (artisan.user_id) {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(artisan.user_id)
    if (authError) {
      logger.warn('[admin/kyc] Auth user lookup failed — email envoyé avec nom dégradé', { error: authError.message, artisan_id })
    } else {
      const metaName = authData.user?.user_metadata?.full_name
      if (typeof metaName === 'string') fullName = metaName
    }
  }
  const displayName = fullName.trim() || artisan.company_name || 'Artisan'

  // Fire-and-forget — do not await
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-kyc-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
    },
    body: JSON.stringify({
      to: artisan.email,
      name: displayName,
      company: artisan.company_name,
      action,
      rejection_reason,
      market: artisan.kyc_market,
    }),
  }).catch((err: unknown) => logger.warn('[admin/kyc] Email notification failed:', err))

  return NextResponse.json({ success: true, status: newStatus })
}
