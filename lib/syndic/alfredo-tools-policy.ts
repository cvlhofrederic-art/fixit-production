// lib/syndic/alfredo-tools-policy.ts
//
// Matrice RBAC pour les TOOLS Alfredo (search, summarize, draft, bulk).
// Complémentaire à alfredo-data-access-policy.ts qui gère les SOURCES de données.
//
// Règle métier (Phase 3b) :
// - Lecture (search_emails, summarize_inbox) → tous les sous-rôles
// - Génération de brouillon (regenerate_draft, bulk_draft_reply) → tous (non destructif)
// - Mutations sensibles (archive, mark_spam, flag_priority) → admin + secretaire + gestionnaire
//
// Le syndic_comptable, syndic_tech, syndic_technicien et syndic_juriste ne sont
// pas censés gérer l'inbox au sens « tri / classement » — c'est le boulot du
// secrétariat ou du gestionnaire.

import type { SyndicRole } from './agent-types'

export type AlfredoToolAction =
  | 'search_emails'
  | 'summarize_inbox'
  | 'regenerate_draft'
  | 'bulk_archive'
  | 'bulk_mark_spam'
  | 'bulk_flag_priority'
  | 'bulk_draft_reply'

const ALL_ROLES: SyndicRole[] = [
  'syndic',
  'syndic_admin',
  'syndic_tech',
  'syndic_technicien',
  'syndic_secretaire',
  'syndic_gestionnaire',
  'syndic_comptable',
  'syndic_juriste',
]

const INBOX_MANAGEMENT_ROLES: SyndicRole[] = [
  'syndic',
  'syndic_admin',
  'syndic_secretaire',
  'syndic_gestionnaire',
]

const TOOLS_POLICY: Record<AlfredoToolAction, SyndicRole[]> = {
  // Lecture
  search_emails: ALL_ROLES,
  summarize_inbox: ALL_ROLES,
  // Génération non destructive
  regenerate_draft: ALL_ROLES,
  bulk_draft_reply: ALL_ROLES,
  // Mutations sensibles (tri / classement de l'inbox)
  bulk_archive: INBOX_MANAGEMENT_ROLES,
  bulk_mark_spam: INBOX_MANAGEMENT_ROLES,
  bulk_flag_priority: INBOX_MANAGEMENT_ROLES,
}

export function canInvokeAlfredoTool(role: SyndicRole, action: AlfredoToolAction): boolean {
  const allowed = TOOLS_POLICY[action]
  if (!allowed) return false
  return allowed.includes(role)
}

export const ALFREDO_TOOLS_POLICY = {
  actions: Object.keys(TOOLS_POLICY) as AlfredoToolAction[],
  policy: TOOLS_POLICY,
}
