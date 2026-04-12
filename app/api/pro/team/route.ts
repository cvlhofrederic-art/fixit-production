import { randomHex } from '@/lib/crypto-compat'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isProSocieteRole, isProGerant, resolveCompanyId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { sendEmail, templateProTeamInvite } from '@/lib/email'
import { logger } from '@/lib/logger'
import { validateBody, proTeamInviteSchema } from '@/lib/validation'
import { ROLE_LABELS, isValidProTeamRole } from '@/lib/permissions'
import type { ProTeamRole } from '@/lib/permissions'

// ── GET /api/pro/team ────────────────────────────────────────────────────────
// List team members for the authenticated company
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isProSocieteRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`pro_team_get_${ip}`, 30, 60_000))) return rateLimitResponse()

  const companyId = await resolveCompanyId(user, supabaseAdmin)

  const { data, error } = await supabaseAdmin
    .from('pro_team_members')
    .select('id, email, full_name, phone, role, assigned_chantiers, invite_sent_at, accepted_at, last_login_at, is_active, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) {
    logger.error('[PRO_TEAM] GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  // Fetch permission overrides for each member
  const memberIds = (data || []).map(m => m.id)
  let overridesMap: Record<string, { module_id: string; access_level: string }[]> = {}

  if (memberIds.length > 0) {
    const { data: overrides } = await supabaseAdmin
      .from('pro_role_permissions')
      .select('member_id, module_id, access_level')
      .in('member_id', memberIds)

    if (overrides) {
      overridesMap = overrides.reduce((acc, ov) => {
        if (!acc[ov.member_id]) acc[ov.member_id] = []
        acc[ov.member_id].push({ module_id: ov.module_id, access_level: ov.access_level })
        return acc
      }, {} as Record<string, { module_id: string; access_level: string }[]>)
    }
  }

  const members = (data || []).map(m => ({
    ...m,
    permission_overrides: overridesMap[m.id] || [],
  }))

  const response = NextResponse.json({ members })
  response.headers.set('Cache-Control', 'private, max-age=0, s-maxage=30, stale-while-revalidate=60')
  return response
}

// ── POST /api/pro/team ───────────────────────────────────────────────────────
// Invite a new team member (gérant only)
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isProSocieteRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  if (!isProGerant(user)) {
    return NextResponse.json({ error: 'Droits insuffisants (gérant requis)' }, { status: 403 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`pro_team_post_${ip}`, 10, 60_000))) return rateLimitResponse()

  const body = await request.json()
  const validation = validateBody(proTeamInviteSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { email, full_name, phone, memberRole, assigned_chantiers, permissionOverrides } = validation.data

  if (!isValidProTeamRole(memberRole)) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
  }

  const companyId = user.id // Gérant = company owner

  // Check if member already exists
  const { data: existing } = await supabaseAdmin
    .from('pro_team_members')
    .select('id')
    .eq('company_id', companyId)
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Cet email est déjà membre de votre équipe' }, { status: 409 })
  }

  // Generate invitation token
  const inviteToken = randomHex(24)

  const insertData: Record<string, unknown> = {
    company_id: companyId,
    email: email.toLowerCase().trim(),
    full_name: full_name.trim(),
    phone: phone?.trim() || '',
    role: memberRole,
    assigned_chantiers: assigned_chantiers || [],
    invite_token: inviteToken,
    invite_sent_at: new Date().toISOString(),
  }

  const { data: member, error } = await supabaseAdmin
    .from('pro_team_members')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    logger.error('[PRO_TEAM] POST insert error:', error)
    return NextResponse.json({ error: 'Erreur lors de la création du membre' }, { status: 500 })
  }

  // Insert permission overrides if provided
  if (Array.isArray(permissionOverrides) && permissionOverrides.length > 0 && member) {
    const overrideRows = permissionOverrides.map(ov => ({
      company_id: companyId,
      member_id: member.id,
      module_id: ov.module_id,
      access_level: ov.access_level,
    }))
    await supabaseAdmin.from('pro_role_permissions').insert(overrideRows)
  }

  // Audit log
  await supabaseAdmin.from('pro_team_audit_log').insert({
    company_id: companyId,
    actor_id: user.id,
    action: 'invite',
    target_member_id: member?.id,
    details: { email, role: memberRole },
  })

  // Build invitation URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const inviteUrl = `${appUrl}/pro/invite?token=${inviteToken}`

  // Send invitation email
  const companyName = user.user_metadata?.company_name || user.user_metadata?.full_name || 'Entreprise'
  const locale = user.user_metadata?.locale || 'fr'
  const isPt = locale === 'pt'
  const roleName = isPt ? ROLE_LABELS[memberRole as ProTeamRole].pt : ROLE_LABELS[memberRole as ProTeamRole].fr

  const emailTemplate = templateProTeamInvite({
    memberName: full_name,
    roleName,
    companyName,
    inviteUrl,
    locale,
  })

  let emailSent = false
  try {
    const emailResult = await sendEmail({
      to: email.toLowerCase().trim(),
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      tags: [
        { name: 'template', value: 'pro_team_invite' },
        { name: 'company_id', value: user.id },
      ],
    })
    emailSent = emailResult.success
    if (!emailResult.success) {
      logger.warn('[PRO_TEAM] Email invite failed:', emailResult.error)
    }
  } catch (emailErr: unknown) {
    logger.warn('[PRO_TEAM] Email invite error:', emailErr instanceof Error ? emailErr.message : emailErr)
  }

  return NextResponse.json({
    member,
    invite_url: inviteUrl,
    email_sent: emailSent,
    message: emailSent
      ? `Invitation envoyée par email à ${email}`
      : `Invitation créée pour ${email}. Partagez ce lien : ${inviteUrl}`,
  })
}

// ── PATCH /api/pro/team ──────────────────────────────────────────────────────
// Update member role, status, chantiers, or permissions (gérant only)
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isProSocieteRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  if (!isProGerant(user)) {
    return NextResponse.json({ error: 'Droits insuffisants (gérant requis)' }, { status: 403 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`pro_team_patch_${ip}`, 20, 60_000))) return rateLimitResponse()

  const body = await request.json()
  const { member_id, role, is_active, assigned_chantiers, permissions } = body

  if (!member_id) {
    return NextResponse.json({ error: 'member_id requis' }, { status: 400 })
  }

  const companyId = await resolveCompanyId(user, supabaseAdmin)

  // Verify member belongs to this company
  const { data: existing } = await supabaseAdmin
    .from('pro_team_members')
    .select('id, user_id, role')
    .eq('id', member_id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
  }

  // Cannot demote GERANT
  if (existing.role === 'GERANT' && role && role !== 'GERANT') {
    return NextResponse.json({ error: 'Impossible de modifier le rôle du gérant' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (role !== undefined) {
    if (!isValidProTeamRole(role)) return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    updates.role = role
  }
  if (is_active !== undefined) updates.is_active = Boolean(is_active)
  if (assigned_chantiers !== undefined) updates.assigned_chantiers = assigned_chantiers

  if (Object.keys(updates).length > 0) {
    const { data, error } = await supabaseAdmin
      .from('pro_team_members')
      .update(updates)
      .eq('id', member_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    // Sync user_metadata if user has accepted
    if ((role || is_active !== undefined) && existing.user_id) {
      try {
        const metaUpdates: Record<string, unknown> = { company_id: companyId }
        if (role) metaUpdates.pro_team_role = role
        await supabaseAdmin.auth.admin.updateUserById(existing.user_id, {
          user_metadata: metaUpdates,
        })
      } catch (e) {
        logger.error('[PRO_TEAM] Failed to update user_metadata:', e)
      }
    }

    // Audit log
    await supabaseAdmin.from('pro_team_audit_log').insert({
      company_id: companyId,
      actor_id: user.id,
      action: is_active === false ? 'deactivate' : is_active === true ? 'reactivate' : 'update_role',
      target_member_id: member_id,
      details: updates,
    })

    // Update permission overrides if provided
    if (Array.isArray(permissions)) {
      // Delete existing overrides and re-insert
      await supabaseAdmin.from('pro_role_permissions').delete().eq('member_id', member_id)
      if (permissions.length > 0) {
        const overrideRows = permissions.map((ov: { module_id: string; access_level: string }) => ({
          company_id: companyId,
          member_id,
          module_id: ov.module_id,
          access_level: ov.access_level,
        }))
        await supabaseAdmin.from('pro_role_permissions').insert(overrideRows)
      }

      await supabaseAdmin.from('pro_team_audit_log').insert({
        company_id: companyId,
        actor_id: user.id,
        action: 'update_permissions',
        target_member_id: member_id,
        details: { permissions },
      })
    }

    return NextResponse.json({ member: data })
  }

  return NextResponse.json({ error: 'Aucune modification' }, { status: 400 })
}

// ── DELETE /api/pro/team ─────────────────────────────────────────────────────
// Remove a team member (gérant only)
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isProSocieteRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  if (!isProGerant(user)) {
    return NextResponse.json({ error: 'Droits insuffisants (gérant requis)' }, { status: 403 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`pro_team_delete_${ip}`, 10, 60_000))) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('member_id')
  if (!memberId) return NextResponse.json({ error: 'member_id requis' }, { status: 400 })

  const companyId = await resolveCompanyId(user, supabaseAdmin)

  // Prevent deleting the gérant
  const { data: target } = await supabaseAdmin
    .from('pro_team_members')
    .select('role')
    .eq('id', memberId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
  }
  if (target.role === 'GERANT') {
    return NextResponse.json({ error: 'Impossible de supprimer le gérant' }, { status: 403 })
  }

  // Audit log before deletion
  await supabaseAdmin.from('pro_team_audit_log').insert({
    company_id: companyId,
    actor_id: user.id,
    action: 'delete',
    target_member_id: memberId,
    details: { role: target.role },
  })

  const { error } = await supabaseAdmin
    .from('pro_team_members')
    .delete()
    .eq('id', memberId)
    .eq('company_id', companyId)

  if (error) {
    return NextResponse.json({ error: 'Erreur suppression' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
