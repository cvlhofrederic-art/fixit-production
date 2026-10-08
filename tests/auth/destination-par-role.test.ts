/**
 * Table rôle → espace après connexion (lib/auth/destination-par-role.ts).
 *
 * La page de connexion portait deux copies de cette table (session existante et connexion réussie). Elle est extraite
 * dans un module pur, sans changer une seule destination : chaque rôle doit arriver exactement où il arrivait avant
 * (décision de Frédéric : aucun changement visible). La règle d'origine est recopiée ci-dessous comme référence.
 */
import { describe, expect, it } from 'vitest'
import { destinationApresConnexion } from '@/lib/auth/destination-par-role'

/** Copie conforme de la table d'origine (app/auth/login/page.tsx, avant extraction). */
function tableDOrigine(role: string | undefined, locale: string): string {
  if (role === 'artisan') return `/${locale}/artisan/dashboard`
  else if (['pro_societe', 'pro_conciergerie', 'pro_gestionnaire'].includes(role as string)) return `/${locale}/pro/dashboard`
  else if (role === 'syndic' || role?.startsWith('syndic')) return `/${locale}/syndic/dashboard`
  else return `/${locale}/client/dashboard`
}

describe('destinationApresConnexion', () => {
  it.each([
    ['artisan', '/fr/artisan/dashboard'],
    ['pro_societe', '/fr/pro/dashboard'],
    ['pro_conciergerie', '/fr/pro/dashboard'],
    ['pro_gestionnaire', '/fr/pro/dashboard'],
    ['syndic', '/fr/syndic/dashboard'],
    ['syndic_admin', '/fr/syndic/dashboard'],
    ['syndic_tech', '/fr/syndic/dashboard'],
    ['syndic_secretaire', '/fr/syndic/dashboard'],
    ['syndic_gestionnaire', '/fr/syndic/dashboard'],
    ['syndic_comptable', '/fr/syndic/dashboard'],
    ['super_admin', '/fr/client/dashboard'],
    ['coproprio', '/fr/client/dashboard'],
    ['locataire', '/fr/client/dashboard'],
    ['client', '/fr/client/dashboard'],
    ['particulier', '/fr/client/dashboard'],
  ])('rôle %s → %s', (role, attendu) => {
    expect(destinationApresConnexion(role, 'fr')).toBe(attendu)
  })

  it('rôle absent, vide ou inconnu → tableau de bord client', () => {
    expect(destinationApresConnexion(undefined, 'fr')).toBe('/fr/client/dashboard')
    expect(destinationApresConnexion('', 'fr')).toBe('/fr/client/dashboard')
    expect(destinationApresConnexion('inconnu', 'fr')).toBe('/fr/client/dashboard')
  })

  it('la comparaison reste sensible à la casse, comme avant', () => {
    expect(destinationApresConnexion('ARTISAN', 'fr')).toBe('/fr/client/dashboard')
    expect(destinationApresConnexion('Pro_Societe', 'fr')).toBe('/fr/client/dashboard')
  })

  it('garde la règle d’origine : tout rôle qui commence par « syndic » va vers l’espace syndic', () => {
    expect(destinationApresConnexion('syndicat', 'fr')).toBe('/fr/syndic/dashboard')
  })

  it('préfixe la langue reçue, sans barre finale (destinations inchangées)', () => {
    expect(destinationApresConnexion('artisan', 'pt')).toBe('/pt/artisan/dashboard')
    expect(destinationApresConnexion('pro_societe', 'pt')).toBe('/pt/pro/dashboard')
    expect(destinationApresConnexion('syndic_admin', 'pt')).toBe('/pt/syndic/dashboard')
    expect(destinationApresConnexion(undefined, 'pt')).toBe('/pt/client/dashboard')
    expect(destinationApresConnexion('client', 'en')).toBe('/en/client/dashboard')
  })

  it('donne exactement la destination de la table d’origine pour chaque rôle et chaque langue', () => {
    const roles = [
      undefined, '', 'artisan', 'pro_societe', 'pro_conciergerie', 'pro_gestionnaire', 'syndic', 'syndic_admin',
      'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndicat', 'super_admin',
      'coproprio', 'locataire', 'client', 'particulier', 'inconnu', 'ARTISAN', 'pro', 'pro_societe ',
    ]
    for (const locale of ['fr', 'pt', 'en', 'es', 'nl']) {
      for (const role of roles) {
        expect(destinationApresConnexion(role, locale), `${role} / ${locale}`).toBe(tableDOrigine(role, locale))
      }
    }
  })
})
