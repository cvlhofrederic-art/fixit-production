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
})
