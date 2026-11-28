// @vitest-environment node
// tests/auth/destination-par-role.test.ts — table des destinations après connexion (inchangée depuis la page de connexion).

import { describe, it, expect } from 'vitest'
import { destinationApresConnexion, pageAppliSocieteBtp } from '@/lib/auth/destination-par-role'
import { PRO_TEAM_ROLES, getDefaultPermission, type ProTeamRole } from '@/lib/permissions'

// Salariés de terrain d'une société BTP : l'appli s'ouvre sur le pointage (23/11/2026).
const TERRAIN: ProTeamRole[] = ['OUVRIER', 'CHEF_CHANTIER', 'CONDUCTEUR_TRAVAUX']
const BUREAU: ProTeamRole[] = ['GERANT', 'SECRETAIRE', 'COMPTABLE']

describe('destinationApresConnexion', () => {
  it('artisan → tableau de bord artisan', () => {
    expect(destinationApresConnexion('artisan', 'fr')).toBe('/fr/artisan/dashboard')
  })

  it('rôles pro → tableau de bord pro', () => {
    for (const role of ['pro_societe', 'pro_conciergerie', 'pro_gestionnaire']) {
      expect(destinationApresConnexion(role, 'pt')).toBe('/pt/pro/dashboard')
    }
  })

  it('tout rôle commençant par « syndic » → tableau de bord syndic', () => {
    expect(destinationApresConnexion('syndic', 'fr')).toBe('/fr/syndic/dashboard')
    expect(destinationApresConnexion('syndic_gestionnaire', 'fr')).toBe('/fr/syndic/dashboard')
  })

  it('rôle absent, inconnu ou non textuel → tableau de bord client', () => {
    expect(destinationApresConnexion(undefined, 'fr')).toBe('/fr/client/dashboard')
    expect(destinationApresConnexion('client', 'fr')).toBe('/fr/client/dashboard')
    expect(destinationApresConnexion('super_admin', 'fr')).toBe('/fr/client/dashboard')
    expect(destinationApresConnexion(42, 'fr')).toBe('/fr/client/dashboard')
    expect(destinationApresConnexion({ role: 'artisan' }, 'fr')).toBe('/fr/client/dashboard')
  })

  // Vitfix Signal (PR 2, lot 4) : un gestionnaire d'un cabinet client n'a pas de tableau de bord VitFix. La page de
  // connexion générale l'envoie vers l'espace Vitfix Signal (en français pour tout cabinet), où le middleware l'aiguille
  // vers l'espace de SON cabinet (repère de routage), ou vers la connexion de l'espace (message neutre) sans repère.
  it.each(['fr', 'pt', 'en', 'nl', 'es'])('gestionnaire_signalement (%s) → /fr/vitfixsignal/', async (locale) => {
    expect(destinationApresConnexion('gestionnaire_signalement', locale)).toBe('/fr/vitfixsignal/')
    const { CHEMIN_ESPACE_QR, ROLE_GESTIONNAIRE_QR } = await import('@/lib/vitfixsignal/acces-espace')
    expect(destinationApresConnexion(ROLE_GESTIONNAIRE_QR, locale)).toBe(CHEMIN_ESPACE_QR)
  })

  // CRM du secrétariat (22/11/2026) : le compte de la secrétaire n'a que l'écran du CRM, route interne sans langue.
  it.each(['fr', 'pt', 'en', 'nl', 'es'])('secretariat (%s) → /admin/crm/', async (locale) => {
    expect(destinationApresConnexion('secretariat', locale)).toBe('/admin/crm/')
    const { CHEMIN_CRM, ROLE_SECRETARIAT } = await import('@/lib/crm/types')
    expect(destinationApresConnexion(ROLE_SECRETARIAT, locale)).toBe(CHEMIN_CRM)
    expect(destinationApresConnexion(ROLE_SECRETARIAT, locale, { appMobile: true })).toBe(CHEMIN_CRM)
  })

  it('un rôle voisin n’en profite pas (égalité stricte)', () => {
    expect(destinationApresConnexion('secretariat_x', 'fr')).toBe('/fr/client/dashboard')
    expect(destinationApresConnexion('Secretariat', 'fr')).toBe('/fr/client/dashboard')
    expect(destinationApresConnexion('gestionnaire', 'fr')).toBe('/fr/client/dashboard')
    expect(destinationApresConnexion('gestionnaire_signalement_x', 'fr')).toBe('/fr/client/dashboard')
    expect(destinationApresConnexion('Gestionnaire_Signalement', 'fr')).toBe('/fr/client/dashboard')
  })

  describe('dans l’appli Vitfix Pro', () => {
    it('artisan → espace mobile, dans sa langue', () => {
      expect(destinationApresConnexion('artisan', 'fr', { appMobile: true })).toBe('/fr/pro/mobile')
      expect(destinationApresConnexion('artisan', 'pt', { appMobile: true })).toBe('/pt/pro/mobile')
    })

    it('les autres rôles gardent leur destination (l’espace mobile est réservé aux artisans)', () => {
      for (const role of ['pro_societe', 'pro_conciergerie', 'pro_gestionnaire']) {
        expect(destinationApresConnexion(role, 'pt', { appMobile: true })).toBe('/pt/pro/dashboard')
      }
      expect(destinationApresConnexion('syndic', 'fr', { appMobile: true })).toBe('/fr/syndic/dashboard')
      expect(destinationApresConnexion('gestionnaire_signalement', 'pt', { appMobile: true })).toBe('/fr/vitfixsignal/')
      expect(destinationApresConnexion('client', 'fr', { appMobile: true })).toBe('/fr/client/dashboard')
      expect(destinationApresConnexion(undefined, 'fr', { appMobile: true })).toBe('/fr/client/dashboard')
      expect(destinationApresConnexion({ role: 'artisan' }, 'fr', { appMobile: true })).toBe('/fr/client/dashboard')
    })

    it('hors de l’appli, rien ne change', () => {
      expect(destinationApresConnexion('artisan', 'fr', { appMobile: false })).toBe('/fr/artisan/dashboard')
      expect(destinationApresConnexion('artisan', 'fr', {})).toBe('/fr/artisan/dashboard')
    })
  })

  // ── Société BTP dans l'appli : le salarié de terrain s'ouvre sur le pointage ──────────────────────────────────
  describe('société BTP dans l’appli Vitfix Pro', () => {
    it.each(TERRAIN)('un salarié %s part sur le pointage, dans sa langue', (roleEquipe) => {
      expect(destinationApresConnexion('pro_societe', 'fr', { appMobile: true, proTeamRole: roleEquipe }))
        .toBe('/fr/pro/dashboard/?p=pointage')
      expect(destinationApresConnexion('pro_societe', 'pt', { appMobile: true, proTeamRole: roleEquipe }))
        .toBe('/pt/pro/dashboard/?p=pointage')
    })

    it.each(BUREAU)('le gérant et les postes de bureau gardent le tableau de bord (%s)', (roleEquipe) => {
      expect(destinationApresConnexion('pro_societe', 'fr', { appMobile: true, proTeamRole: roleEquipe }))
        .toBe('/fr/pro/dashboard')
    })

    it('le compte de la société (sans rôle d’équipe) garde le tableau de bord', () => {
      expect(destinationApresConnexion('pro_societe', 'fr', { appMobile: true })).toBe('/fr/pro/dashboard')
      expect(destinationApresConnexion('pro_societe', 'fr', { appMobile: true, proTeamRole: undefined })).toBe('/fr/pro/dashboard')
    })

    it('un rôle d’équipe non textuel ou inconnu suit le tableau de bord', () => {
      for (const valeur of [42, null, {}, ['OUVRIER'], 'ouvrier', 'OUVRIER_X', '']) {
        expect(destinationApresConnexion('pro_societe', 'fr', { appMobile: true, proTeamRole: valeur })).toBe('/fr/pro/dashboard')
      }
    })

    it('hors de l’appli, un salarié de terrain garde le tableau de bord (le web ne change pas)', () => {
      expect(destinationApresConnexion('pro_societe', 'fr', { proTeamRole: 'OUVRIER' })).toBe('/fr/pro/dashboard')
      expect(destinationApresConnexion('pro_societe', 'fr', { appMobile: false, proTeamRole: 'OUVRIER' })).toBe('/fr/pro/dashboard')
    })

    it('conciergerie et gestionnaire ne sont pas des sociétés BTP : aucun pointage', () => {
      for (const role of ['pro_conciergerie', 'pro_gestionnaire']) {
        expect(destinationApresConnexion(role, 'fr', { appMobile: true, proTeamRole: 'OUVRIER' })).toBe('/fr/pro/dashboard')
      }
    })

    it('un rôle d’équipe sur un autre rôle de compte ne change rien', () => {
      expect(destinationApresConnexion('artisan', 'fr', { appMobile: true, proTeamRole: 'OUVRIER' })).toBe('/fr/pro/mobile')
      expect(destinationApresConnexion('client', 'fr', { appMobile: true, proTeamRole: 'OUVRIER' })).toBe('/fr/client/dashboard')
    })
  })

  // ── Cohérence avec lib/permissions.ts, dont les noms de rôles sont recopiés dans le module pur ──────────────
  describe('pageAppliSocieteBtp', () => {
    it('rend le pointage pour les seuls salariés de terrain', () => {
      for (const roleEquipe of TERRAIN) expect(pageAppliSocieteBtp(roleEquipe)).toBe('/pro/dashboard/?p=pointage')
      for (const roleEquipe of BUREAU) expect(pageAppliSocieteBtp(roleEquipe)).toBe('/pro/dashboard')
      expect(pageAppliSocieteBtp(undefined)).toBe('/pro/dashboard')
    })

    it('les salariés de terrain sont des rôles d’équipe existants', () => {
      for (const roleEquipe of TERRAIN) expect(PRO_TEAM_ROLES).toContain(roleEquipe)
    })

    // Le partage terrain / bureau est une décision de Frédéric, pas une déduction de la matrice : l'ouvrier et la
    // secrétaire y ont le même niveau (READ) et le gérant FULL. Le seul fait de permission est celui-ci — et il doit
    // le rester : un rôle qui perdrait l'accès au pointage ne devrait plus ouvrir l'appli dessus.
    it('le comptable est le seul rôle d’équipe sans accès au pointage, et il est exclu', () => {
      const sansAcces = PRO_TEAM_ROLES.filter((roleEquipe) => getDefaultPermission(roleEquipe, 'pointage') === 'NONE')
      expect(sansAcces).toEqual(['COMPTABLE'])
      expect(pageAppliSocieteBtp('COMPTABLE')).toBe('/pro/dashboard')
    })

    // Un rôle d'équipe ajouté dans lib/permissions.ts doit être classé ici, terrain ou bureau : sans ce test il
    // ouvrirait l'appli sur le tableau de bord par défaut, sans que personne ne l'ait décidé.
    it('tout rôle d’équipe est classé terrain ou bureau', () => {
      expect([...TERRAIN, ...BUREAU].sort()).toEqual([...PRO_TEAM_ROLES].sort())
    })
  })
})
