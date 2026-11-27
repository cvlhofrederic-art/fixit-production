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
  estRoleDeTerrain,
  ALL_PRO_MODULES,
  PRO_TEAM_ROLES,
  ROLES_DE_TERRAIN,
} from '@/lib/permissions'
import type { AccessLevel, ProTeamRole } from '@/lib/permissions'
import { pageAppliSocieteBtp } from '@/lib/auth/destination-par-role'
import { peutEcrireTable, visibiliteListe } from '@/lib/btp/perimetre-compte'

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

    it('CHEF_CHANTIER n’a plus les photos de chantier par défaut (25/11/2026)', () => {
      expect(getDefaultPermission('CHEF_CHANTIER', 'photos_chantier')).toBe('NONE')
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

    // La secrétaire a tous les pouvoirs depuis le 24/11/2026 : elle règle aussi la fiche de la société. Les autres
    // ont « settings » en lecture, et pas NONE, parce que l'écran « Mon profil » porte le changement de mot de passe :
    // le fermer enfermerait le salarié dehors. En lecture, /api/btp ne livre aucun réglage de la société.
    it('seuls GERANT et SECRETAIRE écrivent les réglages ; les autres ouvrent l’écran sans les lire', () => {
      for (const role of PRO_TEAM_ROLES) {
        const perms = getDefaultPermissionsForRole(role)
        const attendu = role === 'GERANT' || role === 'SECRETAIRE' ? 'FULL' : 'READ'
        expect(perms.settings, role).toBe(attendu)
        expect(canWrite(perms, 'settings')).toBe(attendu === 'FULL')
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

    // Décision de Frédéric du 25/11/2026 : « Les salariés doivent uniquement recevoir les alertes météo, le
    // chantier qui les concerne, et surtout le pointage très important ». Plus « Mon profil » (settings, en lecture),
    // où il change son mot de passe. Rien d'autre par défaut — le gérant rouvre le reste employé par employé.
    // (Le 24/11 il avait demandé aussi le dictionnaire de matériaux ; le 25/11 il dit « uniquement » ; le 26/11 :
    // « Dictionnaire pour tous les employés ».)
    // Le 26/11/2026 : les rapports, c'est Frédéric qui les accorde « uniquement aux employés qui le font ».
    const TERRAIN: ProTeamRole[] = ['OUVRIER', 'CHEF_CHANTIER', 'CONDUCTEUR_TRAVAUX']

    // Le 26/11/2026, Frédéric ajoute la vérification de l'outillage chaque vendredi « par les encarregados », « le
    // responsable de son chantier » : chef de chantier et conducteur de travaux, en lecture (ses chantiers, et valider
    // leur vérification) ; pas l'ouvrier.
    it('OUVRIER n’ouvre que le pointage, ses chantiers, la météo, le dictionnaire et son profil', () => {
      const accessible = getAccessibleModules(getDefaultPermissionsForRole('OUVRIER'))
      expect(accessible.sort((a, b) => a.localeCompare(b))).toEqual(['chantiers', 'dictionnaire_materiaux', 'meteo', 'pointage', 'settings'])
    })

    // « Dictionnaire pour tous les employés » (26/11/2026) : chaque rôle d'équipe le lit ; seul le titulaire et la
    // secrétaire (tous les pouvoirs) y ont FULL, sans effet puisque le dictionnaire n'écrit rien.
    it.each(PRO_TEAM_ROLES)('%s lit le dictionnaire de matériaux', (role) => {
      expect(canAccess(getDefaultPermissionsForRole(role), 'dictionnaire_materiaux')).toBe(true)
    })

    // Rapports : fermés par défaut ; le gérant les accorde employé par employé, avec un degré.
    const perimetreAvec = (role: ProTeamRole, niveau?: AccessLevel) => ({
      societeId: 'societe', titulaire: false, roleEquipe: role, email: '',
      permissions: getEffectivePermissions(role, niveau ? [{ module_id: 'rapports', access_level: niveau }] : []),
    })
    it.each(TERRAIN)('%s : rapports fermés par défaut, ouverts au degré que le gérant choisit', (role) => {
      expect(visibiliteListe(perimetreAvec(role), 'rapports')).toBe('aucune')
      expect(peutEcrireTable(perimetreAvec(role), 'rapports_btp')).toBe(false)
      // Lecture : il voit les rapports de la société, il n'en écrit aucun.
      expect(visibiliteListe(perimetreAvec(role, 'READ'), 'rapports')).toBe('tout')
      expect(peutEcrireTable(perimetreAvec(role, 'READ'), 'rapports_btp')).toBe(false)
      // Écriture : il les rédige et les modifie.
      expect(peutEcrireTable(perimetreAvec(role, 'FULL'), 'rapports_btp')).toBe(true)
    })

    it.each(['CHEF_CHANTIER', 'CONDUCTEUR_TRAVAUX'] as const)('%s ouvre en plus l’outillage de ses chantiers, en lecture', (role) => {
      const droits = getDefaultPermissionsForRole(role)
      expect(getAccessibleModules(droits).sort((a, b) => a.localeCompare(b))).toEqual(['chantiers', 'dictionnaire_materiaux', 'meteo', 'outillage', 'pointage', 'settings'])
      expect(droits.outillage).toBe('READ')
    })

    it('l’outillage : le gérant et la secrétaire tiennent le répertoire, le comptable et l’ouvrier ne le voient pas', () => {
      expect(getDefaultPermission('GERANT', 'outillage')).toBe('FULL')
      expect(getDefaultPermission('SECRETAIRE', 'outillage')).toBe('FULL')
      expect(getDefaultPermission('COMPTABLE', 'outillage')).toBe('NONE')
      expect(getDefaultPermission('OUVRIER', 'outillage')).toBe('NONE')
      // Une dérogation du gérant s'applique (le module est dans la matrice de chaque rôle, comptable compris).
      expect(getEffectivePermissions('COMPTABLE', [{ module_id: 'outillage', access_level: 'READ' }]).outillage).toBe('READ')
      expect(getEffectivePermissions('OUVRIER', [{ module_id: 'outillage', access_level: 'READ' }]).outillage).toBe('READ')
    })

    it('les rôles de terrain sont exactement ceux que l’appli ouvre sur le pointage', () => {
      expect([...ROLES_DE_TERRAIN].sort()).toEqual([...TERRAIN].sort())
      for (const role of PRO_TEAM_ROLES) {
        expect(estRoleDeTerrain(role), role).toBe(pageAppliSocieteBtp(role).includes('p=pointage'))
      }
      for (const valeur of [null, undefined, '', 'ouvrier', 'GERANT', 'SECRETAIRE']) {
        expect(estRoleDeTerrain(valeur)).toBe(false)
      }
    })

    it('les postes de bureau ne changent pas : secrétaire et comptable gardent leurs écrans', () => {
      expect(getAccessibleModules(getDefaultPermissionsForRole('SECRETAIRE'))).toHaveLength(ALL_PRO_MODULES.length - 1)
      const comptable = getDefaultPermissionsForRole('COMPTABLE')
      for (const mod of ['compta_btp', 'factures', 'comptabilite', 'devis']) {
        expect(canAccess(comptable, mod), mod).toBe(true)
      }
    })

    it('chaque rôle de terrain reçoit sa propre copie : une dérogation de l’un ne touche pas l’autre', () => {
      const ouvrier = getEffectivePermissions('OUVRIER', [{ module_id: 'photos_chantier', access_level: 'FULL' }])
      expect(ouvrier.photos_chantier).toBe('FULL')
      expect(getDefaultPermission('OUVRIER', 'photos_chantier')).toBe('NONE')
      expect(getDefaultPermission('CHEF_CHANTIER', 'photos_chantier')).toBe('NONE')
    })

    // Un salarié de terrain ne doit rien pouvoir ÉCRIRE de ce qui porte des montants ou des salaires : depuis le
    // 24/11/2026, FULL vaut droit d'écriture dans /api/btp (lib/btp/perimetre-compte.ts). Et le pointage ne passe pas
    // par cette route : en FULL elle rendrait les positions GPS d'arrivée et de départ de chaque collègue, que la
    // route dédiée retire exprès.
    it.each(TERRAIN)('%s n’écrit ni les chantiers, ni les fiches employés, ni la comptabilité', (role) => {
      const perms = getDefaultPermissionsForRole(role)
      for (const mod of ['chantiers', 'equipes', 'compta_btp', 'comptabilite', 'settings', 'pointage']) {
        expect(canWrite(perms, mod)).toBe(false)
      }
    })
  })
})
