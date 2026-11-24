import { describe, it, expect } from 'vitest'
import {
  getDefaultPermission,
  getDefaultPermissionsForRole,
  getEffectivePermissions,
  canAccess,
  canWrite,
  isGerantRole,
  isValidProTeamRole,
  getAccessibleModules,
  ALL_PRO_MODULES,
  PRO_TEAM_ROLES,
} from '@/lib/permissions'
import type { AccessLevel, ProTeamRole } from '@/lib/permissions'

describe('lib/permissions', () => {
  describe('getDefaultPermission', () => {
    it('GERANT has FULL on all modules', () => {
      for (const mod of ALL_PRO_MODULES) {
        expect(getDefaultPermission('GERANT', mod)).toBe('FULL')
      }
    })

    it('OUVRIER has NONE on gestion_comptes', () => {
      expect(getDefaultPermission('OUVRIER', 'gestion_comptes')).toBe('NONE')
    })

    it('COMPTABLE has FULL on compta_btp', () => {
      expect(getDefaultPermission('COMPTABLE', 'compta_btp')).toBe('FULL')
    })

    it('CHEF_CHANTIER has FULL on photos_chantier', () => {
      expect(getDefaultPermission('CHEF_CHANTIER', 'photos_chantier')).toBe('FULL')
    })

    it('returns NONE for unknown module', () => {
      expect(getDefaultPermission('OUVRIER', 'nonexistent_module')).toBe('NONE')
    })
  })

  describe('getDefaultPermissionsForRole', () => {
    it('returns all modules for every role', () => {
      for (const role of PRO_TEAM_ROLES) {
        const perms = getDefaultPermissionsForRole(role)
        // Every module in ALL_PRO_MODULES should have a permission
        for (const mod of ALL_PRO_MODULES) {
          expect(perms[mod]).toBeDefined()
          expect(['FULL', 'READ', 'NONE']).toContain(perms[mod])
        }
      }
    })
  })

  describe('getEffectivePermissions', () => {
    it('returns defaults when no overrides', () => {
      const perms = getEffectivePermissions('SECRETAIRE', [])
      expect(perms.devis).toBe('FULL')
      expect(perms.chantiers).toBe('FULL')
    })

    it('overrides take precedence over defaults', () => {
      const perms = getEffectivePermissions('SECRETAIRE', [
        { module_id: 'chantiers', access_level: 'READ' },
      ])
      expect(perms.chantiers).toBe('READ')
      // Others unchanged
      expect(perms.devis).toBe('FULL')
    })

    it('ignores overrides for unknown modules', () => {
      const perms = getEffectivePermissions('COMPTABLE', [
        { module_id: 'fake_module', access_level: 'FULL' },
      ])
      expect(perms['fake_module']).toBeUndefined()
    })
  })

  describe('canAccess', () => {
    it('true for FULL', () => {
      expect(canAccess({ devis: 'FULL' }, 'devis')).toBe(true)
    })

    it('true for READ', () => {
      expect(canAccess({ devis: 'READ' }, 'devis')).toBe(true)
    })

    it('false for NONE', () => {
      expect(canAccess({ devis: 'NONE' }, 'devis')).toBe(false)
    })

    it('false for missing module', () => {
      expect(canAccess({}, 'devis')).toBe(false)
    })
  })

  describe('canWrite', () => {
    it('true for FULL', () => {
      expect(canWrite({ devis: 'FULL' }, 'devis')).toBe(true)
    })

    it('false for READ', () => {
      expect(canWrite({ devis: 'READ' }, 'devis')).toBe(false)
    })

    it('false for NONE', () => {
      expect(canWrite({ devis: 'NONE' }, 'devis')).toBe(false)
    })
  })

  describe('isGerantRole', () => {
    it('true for null (owner without team role)', () => {
      expect(isGerantRole(null)).toBe(true)
    })

    it('true for undefined', () => {
      expect(isGerantRole(undefined)).toBe(true)
    })

    it('true for GERANT', () => {
      expect(isGerantRole('GERANT')).toBe(true)
    })

    it('false for other roles', () => {
      expect(isGerantRole('COMPTABLE')).toBe(false)
      expect(isGerantRole('OUVRIER')).toBe(false)
    })
  })

  describe('isValidProTeamRole', () => {
    it('validates all defined roles', () => {
      for (const role of PRO_TEAM_ROLES) {
        expect(isValidProTeamRole(role)).toBe(true)
      }
    })

    it('rejects invalid roles', () => {
      expect(isValidProTeamRole('admin')).toBe(false)
      expect(isValidProTeamRole('')).toBe(false)
    })
  })

  describe('getAccessibleModules', () => {
    it('returns modules with FULL or READ', () => {
      const perms: Record<string, AccessLevel> = {
        home: 'FULL',
        devis: 'READ',
        chantiers: 'NONE',
      }
      const result = getAccessibleModules(perms)
      expect(result).toContain('home')
      expect(result).toContain('devis')
      expect(result).not.toContain('chantiers')
    })
  })

  describe('Permission matrix consistency', () => {
    it('only GERANT has FULL on gestion_comptes', () => {
      for (const role of PRO_TEAM_ROLES) {
        const perms = getDefaultPermissionsForRole(role)
        if (role === 'GERANT') {
          expect(perms.gestion_comptes).toBe('FULL')
        } else {
          expect(perms.gestion_comptes).toBe('NONE')
        }
      }
    })

    // La secrétaire a tous les pouvoirs depuis le 24/11/2026 : elle règle aussi la fiche de la société.
    it('only GERANT and SECRETAIRE have FULL on settings', () => {
      for (const role of PRO_TEAM_ROLES) {
        const perms = getDefaultPermissionsForRole(role)
        if (role === 'GERANT' || role === 'SECRETAIRE') {
          expect(perms.settings).toBe('FULL')
        } else {
          expect(perms.settings).toBe('NONE')
        }
      }
    })

    // Elle a tout le reste, sans exception : si un module est ajouté au catalogue, il lui revient aussi.
    it('SECRETAIRE a tous les pouvoirs, sauf la gestion des comptes', () => {
      const perms = getDefaultPermissionsForRole('SECRETAIRE')
      for (const mod of ALL_PRO_MODULES) {
        expect(perms[mod]).toBe(mod === 'gestion_comptes' ? 'NONE' : 'FULL')
      }
    })

    // La gestion des comptes reste au gérant parce que le serveur la lui réserve : toute écriture de
    // app/api/pro/team passe par isProGerant. Ouvrir le module sans changer ces gardes afficherait un écran
    // dont chaque action répondrait 403.
    it('aucun rôle d’équipe autre que GERANT n’a la gestion des comptes', () => {
      for (const role of PRO_TEAM_ROLES) {
        if (role === 'GERANT') continue
        expect(getDefaultPermission(role, 'gestion_comptes')).toBe('NONE')
      }
    })

    it('COMPTABLE can access all accounting modules', () => {
      const perms = getDefaultPermissionsForRole('COMPTABLE')
      expect(perms.compta_btp).toBe('FULL')
      expect(perms.rentabilite).toBe('FULL')
      expect(perms.situations).toBe('FULL')
      expect(perms.garanties).toBe('FULL')
      expect(perms.factures).toBe('FULL')
      expect(perms.comptabilite).toBe('FULL')
    })

    // Ce que Frédéric a demandé le 24/11/2026 pour ses salariés de terrain : le pointage, leurs chantiers en cours,
    // la météo et le dictionnaire de matériaux. Rien d'autre par défaut — il ouvre le reste employé par employé.
    const TERRAIN: ProTeamRole[] = ['OUVRIER', 'CHEF_CHANTIER', 'CONDUCTEUR_TRAVAUX']

    it.each(TERRAIN)('%s voit le pointage, ses chantiers, la météo et le dictionnaire', (role) => {
      const perms = getDefaultPermissionsForRole(role)
      for (const mod of ['pointage', 'chantiers', 'meteo', 'dictionnaire_materiaux']) {
        expect(canAccess(perms, mod)).toBe(true)
      }
    })

    it('OUVRIER garde un accès minimal : rien de commercial ni de comptable', () => {
      const perms = getDefaultPermissionsForRole('OUVRIER')
      const accessible = getAccessibleModules(perms)
      expect(accessible.sort()).toEqual(
        ['calendar', 'chantiers', 'dictionnaire_materiaux', 'meteo', 'photos_chantier', 'pointage'].sort(),
      )
      for (const mod of ['devis', 'factures', 'comptabilite', 'revenus', 'stats', 'clients', 'settings', 'gestion_comptes']) {
        expect(canAccess(perms, mod)).toBe(false)
      }
    })

    // Un salarié de terrain ne doit rien pouvoir ÉCRIRE de ce qui porte des montants ou des salaires : depuis le
    // 24/11/2026, FULL vaut droit d'écriture dans /api/btp (lib/btp/perimetre-compte.ts).
    it.each(TERRAIN)('%s n’écrit ni les chantiers, ni les fiches employés, ni la comptabilité', (role) => {
      const perms = getDefaultPermissionsForRole(role)
      for (const mod of ['chantiers', 'equipes', 'compta_btp', 'comptabilite', 'settings']) {
        expect(canWrite(perms, mod)).toBe(false)
      }
    })
  })
})
