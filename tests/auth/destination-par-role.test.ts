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

  // AJ Signalement (PR 2, lot 4) : un gestionnaire d'un cabinet client n'a pas de tableau de bord VitFix. La page de
  // connexion générale l'envoie vers l'espace AJ Signalement (en français pour tout cabinet), où le middleware l'aiguille
  // vers l'espace de SON cabinet (repère de routage), ou vers la connexion de l'espace (message neutre) sans repère.
  it.each(['fr', 'pt', 'en', 'nl', 'es'])('gestionnaire_signalement (%s) → /fr/aj-signalement/', async (locale) => {
    expect(destinationApresConnexion('gestionnaire_signalement', locale)).toBe('/fr/aj-signalement/')
    const { CHEMIN_ESPACE_QR, ROLE_GESTIONNAIRE_QR } = await import('@/lib/aj-signalement/acces-espace')
    expect(destinationApresConnexion(ROLE_GESTIONNAIRE_QR, locale)).toBe(CHEMIN_ESPACE_QR)
  })

  it('un rôle voisin n’en profite pas (égalité stricte)', () => {
    expect(destinationApresConnexion('gestionnaire', 'fr')).toBe('/fr/client/dashboard')
    expect(destinationApresConnexion('gestionnaire_signalement_x', 'fr')).toBe('/fr/client/dashboard')
    expect(destinationApresConnexion('Gestionnaire_Signalement', 'fr')).toBe('/fr/client/dashboard')
  })
})
