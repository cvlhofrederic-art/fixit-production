import { describe, it, expect } from 'vitest'
import { canInvokeAlfredoTool, ALFREDO_TOOLS_POLICY, type AlfredoToolAction } from '@/lib/syndic/alfredo-tools-policy'
import type { SyndicRole } from '@/lib/syndic/agent-types'

// Phase 3b — matrice de vérité rôle × action sur les tools Alfredo.
// Source de vérité unique pour les tests : l'export ALFREDO_TOOLS_POLICY.

describe('alfredo-tools-policy — RBAC sous-rôle', () => {
  const ALL_ROLES: SyndicRole[] = [
    'syndic', 'syndic_admin', 'syndic_tech', 'syndic_technicien',
    'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste',
  ]

  describe('lecture (tous les rôles)', () => {
    const READ_ACTIONS: AlfredoToolAction[] = ['search_emails', 'summarize_inbox']
    for (const action of READ_ACTIONS) {
      for (const role of ALL_ROLES) {
        it(`${role} → ${action} : autorisé`, () => {
          expect(canInvokeAlfredoTool(role, action)).toBe(true)
        })
      }
    }
  })

  describe('génération non destructive (tous les rôles)', () => {
    const CREATE_ACTIONS: AlfredoToolAction[] = ['regenerate_draft', 'bulk_draft_reply']
    for (const action of CREATE_ACTIONS) {
      for (const role of ALL_ROLES) {
        it(`${role} → ${action} : autorisé`, () => {
          expect(canInvokeAlfredoTool(role, action)).toBe(true)
        })
      }
    }
  })

  describe('mutations sensibles (admin + secretaire + gestionnaire)', () => {
    const SENSITIVE: AlfredoToolAction[] = ['bulk_archive', 'bulk_mark_spam', 'bulk_flag_priority']
    const ALLOWED: SyndicRole[] = ['syndic', 'syndic_admin', 'syndic_secretaire', 'syndic_gestionnaire']
    const DENIED: SyndicRole[] = ['syndic_tech', 'syndic_technicien', 'syndic_comptable', 'syndic_juriste']

    for (const action of SENSITIVE) {
      for (const role of ALLOWED) {
        it(`${role} → ${action} : autorisé`, () => {
          expect(canInvokeAlfredoTool(role, action)).toBe(true)
        })
      }
      for (const role of DENIED) {
        it(`${role} → ${action} : refusé`, () => {
          expect(canInvokeAlfredoTool(role, action)).toBe(false)
        })
      }
    }
  })

  it('exporte la liste des actions et la policy', () => {
    expect(ALFREDO_TOOLS_POLICY.actions).toContain('bulk_archive')
    expect(ALFREDO_TOOLS_POLICY.actions).toContain('search_emails')
    // 7 actions au total
    expect(ALFREDO_TOOLS_POLICY.actions).toHaveLength(7)
  })

  it('refuse une action inconnue', () => {
    expect(canInvokeAlfredoTool('syndic_admin', 'fake_action' as AlfredoToolAction)).toBe(false)
  })
})
