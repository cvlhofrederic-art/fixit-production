// ── Audit logging helper for API routes ──────────────────────────────────────
// RGPD Art. 30 — Registre des activités de traitement
// Enregistre les opérations sensibles dans la table audit_logs
//
// Usage:
//   import { auditLog } from '@/lib/audit'
//   await auditLog(request, userId, 'CREATE', 'syndic_missions', missionId, { description: '...' })

import { supabaseAdmin } from '@/lib/supabase-server'

type AuditAction =
  | 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  | 'LOGIN_SUCCESS' | 'LOGIN_FAILED'
  | 'EXPORT_DATA' | 'DELETE_ACCOUNT'
  | 'ROLE_CHANGE' | 'INVITE_CREATED' | 'INVITE_ACCEPTED'
  | 'PASSWORD_CHANGE' | 'SIGNATURE_UPDATE'

export async function auditLog(
  request: Request | null,
  userId: string | null,
  action: AuditAction,
  tableName?: string,
  recordId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const ip = request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const ua = request?.headers?.get('user-agent')?.substring(0, 256) || null

    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      action,
      table_name: tableName || null,
      record_id: recordId || null,
      details: details || {},
      ip_address: ip,
      user_agent: ua,
    })
  } catch {
    // Non-critical — audit_logs table may not exist yet
    // Never let audit logging break the main flow
  }
}

// ── Helper for login attempt logging ────────────────────────────────────────
export async function auditLoginAttempt(
  request: Request,
  email: string,
  success: boolean,
  userId?: string,
  reason?: string,
): Promise<void> {
  await auditLog(
    request,
    userId || null,
    success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
    'auth.users',
    undefined,
    {
      email: email.substring(0, 3) + '***' + email.substring(email.indexOf('@')),
      success,
      reason,
    },
  )
}
