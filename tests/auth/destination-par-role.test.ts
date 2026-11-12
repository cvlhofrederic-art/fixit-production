// @vitest-environment node
// tests/auth/destination-par-role.test.ts — table des destinations après connexion (inchangée depuis la page de connexion).

import { describe, it, expect } from 'vitest'
import { destinationApresConnexion } from '@/lib/auth/destination-par-role'

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

  describe('dans l’appli Vitfix Pro', () => {
    it('artisan → espace mobile, dans sa langue', () => {
      expect(destinationApresConnexion('artisan', 'fr', { appMobile: true })).toBe('/fr/pro/mobile')
      expect(destinationApresConnexion('artisan', 'pt', { appMobile: true })).toBe('/pt/pro/mobile')
    })

    it('les autres rôles gardent leur tableau de bord (l’espace mobile est réservé aux artisans)', () => {
      for (const role of ['pro_societe', 'pro_conciergerie', 'pro_gestionnaire']) {
        expect(destinationApresConnexion(role, 'pt', { appMobile: true })).toBe('/pt/pro/dashboard')
      }
      expect(destinationApresConnexion('syndic', 'fr', { appMobile: true })).toBe('/fr/syndic/dashboard')
      expect(destinationApresConnexion('client', 'fr', { appMobile: true })).toBe('/fr/client/dashboard')
      expect(destinationApresConnexion(undefined, 'fr', { appMobile: true })).toBe('/fr/client/dashboard')
      expect(destinationApresConnexion({ role: 'artisan' }, 'fr', { appMobile: true })).toBe('/fr/client/dashboard')
    })

    it('hors de l’appli, rien ne change', () => {
      expect(destinationApresConnexion('artisan', 'fr', { appMobile: false })).toBe('/fr/artisan/dashboard')
      expect(destinationApresConnexion('artisan', 'fr', {})).toBe('/fr/artisan/dashboard')
    })
  })
})
