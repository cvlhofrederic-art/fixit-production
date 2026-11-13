// @vitest-environment node
// tests/auth/google-app-mobile.test.ts — lecture du lien profond de retour de Google dans l'appli Vitfix Pro.
// Le schéma io.vitfix.pro:// est ouvert à toute application du téléphone : ce qui n'est pas notre retour de
// connexion doit être ignoré, et ce qui l'est doit partir vers la route serveur qui échange le code.

import { describe, expect, it } from 'vitest'
import {
  RETOUR_GOOGLE_APP_MOBILE,
  SCHEMA_APP_MOBILE,
  cheminRetourGoogle,
} from '@/lib/auth/google-app-mobile'

describe('cheminRetourGoogle', () => {
  it('code d’autorisation → route serveur, dans la langue de la page et marquée appli', () => {
    expect(cheminRetourGoogle(`${RETOUR_GOOGLE_APP_MOBILE}?code=abc123`, 'fr'))
      .toBe('/fr/auth/callback/?code=abc123&app=1')
    expect(cheminRetourGoogle(`${RETOUR_GOOGLE_APP_MOBILE}?code=abc123`, 'pt'))
      .toBe('/pt/auth/callback/?code=abc123&app=1')
  })

  it('code échappé : jamais de paramètre ni de chemin injecté', () => {
    const chemin = cheminRetourGoogle(`${RETOUR_GOOGLE_APP_MOBILE}?code=a%26app%3D0%26next%3D/admin`, 'fr')
    expect(chemin).toBe('/fr/auth/callback/?code=a%26app%3D0%26next%3D%2Fadmin&app=1')
    // Relu comme une URL, le code reste un seul paramètre et « app » garde la valeur que nous posons.
    const relu = new URL(`https://vitfix.io${chemin}`)
    expect(relu.searchParams.get('code')).toBe('a&app=0&next=/admin')
    expect(relu.searchParams.getAll('app')).toEqual(['1'])
    expect(relu.pathname).toBe('/fr/auth/callback/')
  })

  it('connexion refusée ou abandonnée (aucun code) → formulaire de connexion', () => {
    expect(cheminRetourGoogle(`${RETOUR_GOOGLE_APP_MOBILE}?error=access_denied`, 'fr')).toBe('/fr/auth/login/')
    expect(cheminRetourGoogle(RETOUR_GOOGLE_APP_MOBILE, 'pt')).toBe('/pt/auth/login/')
  })

  // /en/, /nl/ et /es/ n'ont ni espace mobile ni route de rappel (next.config.ts ne les réécrit pas vers
  // app/(commun)) : un retour sous ces langues tomberait sur une 404, connexion perdue.
  it('langue ramenée à fr ou pt', () => {
    for (const locale of ['en', 'nl', 'es', 'de', '', 'PT']) {
      expect(cheminRetourGoogle(`${RETOUR_GOOGLE_APP_MOBILE}?code=x`, locale), locale)
        .toBe('/fr/auth/callback/?code=x&app=1')
      expect(cheminRetourGoogle(RETOUR_GOOGLE_APP_MOBILE, locale), locale).toBe('/fr/auth/login/')
    }
    expect(cheminRetourGoogle(`${RETOUR_GOOGLE_APP_MOBILE}?code=x`, 'pt')).toBe('/pt/auth/callback/?code=x&app=1')
  })

  it('barre finale acceptée (certaines plateformes la rajoutent)', () => {
    expect(cheminRetourGoogle(`${SCHEMA_APP_MOBILE}://auth/callback/?code=x`, 'fr'))
      .toBe('/fr/auth/callback/?code=x&app=1')
  })

  it('tout autre lien profond est ignoré', () => {
    for (const url of [
      `${SCHEMA_APP_MOBILE}://autre?code=x`,
      `${SCHEMA_APP_MOBILE}://auth/autre?code=x`,
      `${SCHEMA_APP_MOBILE}://auth.callback?code=x`,
      'io.vitfix.autre://auth/callback?code=x',
      'https://vitfix.io/auth/callback?code=x',
      'pas une url',
      '',
    ]) {
      expect(cheminRetourGoogle(url, 'fr'), url).toBeNull()
    }
  })

  it('l’URL de retour est bâtie sur l’identifiant de l’appli', () => {
    expect(SCHEMA_APP_MOBILE).toBe('io.vitfix.pro')
    expect(RETOUR_GOOGLE_APP_MOBILE).toBe('io.vitfix.pro://auth/callback')
  })
})

// Le reste du circuit est couvert par des tests de comportement, pas par relecture du source :
// - google-app-mobile-circuit.test.ts : ce que le code demande à Supabase et aux plugins Capacitor ;
// - connexion-google-appli.test.tsx : le bouton de la page de connexion, dans l'appli et sur le web ;
// - ../components/providers-retour-google.test.tsx : l'écoute du retour et la navigation qui s'ensuit.
