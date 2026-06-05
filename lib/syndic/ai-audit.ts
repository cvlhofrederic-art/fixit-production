// lib/syndic/ai-audit.ts
//
// Audit log RGPD pour les actions des agents IA Syndic.
// Insère dans `syndic_ai_audit` (créée en migration 20260511_agents_ia_foundation).
//
// Schéma DB :
//   syndic_id (=cabinet, cascade RGPD au niveau tenant)
//   agent_id ('alfredo' | 'fixy' | 'lea' | 'max' | 'tempo')
//   conversation_id (nullable, FK syndic_ai_conversations)
//   action (text, ex: 'bulk_archive', 'regenerate_draft')
//   status ('success' | 'denied_rbac' | 'cancelled' | 'error')
//   tool_payload (jsonb — y compris user_id du team_member)
//   error_message, ip_address, user_agent (optionnels)
//
// Le `user_id` (qui dans l'équipe a déclenché) est mis dans `tool_payload.user_id`
// car la colonne user_id n'existe pas en DB (la table cascade sur cabinet uniquement).
//
// IMPORTANT — best-effort : si l'INSERT échoue (DB down, etc.), on log warn et
// retourne sans lancer. RGPD préfère un log incomplet à un service indisponible.

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

export type AiAuditStatus = 'success' | 'denied_rbac' | 'cancelled' | 'error'
export type AiAuditAgent = 'alfredo' | 'fixy' | 'lea' | 'max' | 'tempo'

export interface AiAuditParams {
  cabinetId: string
  agentId: AiAuditAgent
  action: string
  status: AiAuditStatus
  conversationId?: string
  userId?: string
  toolPayload?: Record<string, unknown>
  errorMessage?: string
  ipAddress?: string
  userAgent?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>

export async function logAiAudit(client: AnyClient, params: AiAuditParams): Promise<void> {
  try {
    // Composer tool_payload avec user_id systématiquement présent si fourni.
    const payload = {
      ...(params.toolPayload ?? {}),
      ...(params.userId ? { user_id: params.userId } : {}),
    }

    const row = {
      syndic_id: params.cabinetId,
      agent_id: params.agentId,
      conversation_id: params.conversationId ?? null,
      action: params.action,
      status: params.status,
      tool_payload: Object.keys(payload).length > 0 ? payload : null,
      error_message: params.errorMessage ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
    }

    const { error } = await client.from('syndic_ai_audit').insert(row)
    if (error) {
      logger.warn('[ai-audit] insert failed (non-blocking):', {
        error: error.message,
        agent: params.agentId,
        action: params.action,
        status: params.status,
      })
    }
  } catch (err) {
    // Catch-all : ne JAMAIS lancer depuis l'audit.
    logger.warn('[ai-audit] unexpected error (non-blocking):', {
      error: err instanceof Error ? err.message : String(err),
      agent: params.agentId,
      action: params.action,
    })
  }
}
