// tests/lib/tracking-token.test.ts
//
// Jeton de suivi GPS (lib/security/tracking-token.ts) : motif calqué sur le seul générateur,
// app/(commun)/pro/mobile/page.tsx. Le jeton sert de nom d'objet Storage ({token}.json) en service role :
// tout ce qui n'est pas un jeton émis est refusé avant toute construction de chemin.

import { describe, it, expect } from 'vitest'
import { TRACKING_TOKEN_PATTERN, tokenSuiviValide } from '@/lib/security/tracking-token'

/** Générateur de l'application mobile, recopié à l'identique. */
function genererJetonMobile(): string {
  return `TRK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

describe('TRACKING_TOKEN_PATTERN', () => {
  it('accepte les jetons produits par le générateur de l’application mobile', () => {
    for (let i = 0; i < 200; i++) {
      const jeton = genererJetonMobile()
      expect(jeton).toMatch(TRACKING_TOKEN_PATTERN)
      expect(tokenSuiviValide(jeton)).toBe(true)
    }
  })

  it.each([
    ['TRK-MH6V0ABC-X9ZQ'],
    ['TRK-MH6V0ABC-A'],
    ['TRK-00000000-0'],
  ])('accepte %s', (jeton) => {
    expect(tokenSuiviValide(jeton)).toBe(true)
  })

  it.each([
    ['vide', ''],
    ['minuscules', 'trk-mh6v0abc-x9zq'],
    ['UUID v4 (ancien motif, jamais émis)', '550e8400-e29b-41d4-a716-446655440000'],
    ['remontée', '../x'],
    ['remontée après un jeton valide', 'TRK-MH6V0ABC-X9ZQ/../x'],
    ['extension ajoutée', 'TRK-MH6V0ABC-X9ZQ.json'],
    ['point', 'TRK-MH6V0ABC-X9.Q'],
    ['encodage', 'TRK-MH6V0ABC-%2E%2E'],
    ['espace', 'TRK-MH6V0ABC-X9 Q'],
    ['suffixe vide', 'TRK-MH6V0ABC-'],
    ['horodatage trop court', 'TRK-MH6V0AB-X'],
    ['horodatage trop long', 'TRK-MH6V0ABCD-X'],
    ['suffixe trop long', 'TRK-MH6V0ABC-ABCDE'],
    ['préfixe absent', 'MH6V0ABC-X9ZQ'],
    ['retour à la ligne', 'TRK-MH6V0ABC-X9ZQ\n'],
  ])('refuse un jeton %s', (_cas, jeton) => {
    expect(tokenSuiviValide(jeton)).toBe(false)
  })

  it.each([[null], [undefined], [42], [{ token: 'TRK-MH6V0ABC-X9ZQ' }]])('refuse une valeur non textuelle (%s)', (valeur) => { // gitleaks:allow — jeton factice
    expect(tokenSuiviValide(valeur)).toBe(false)
  })
})
