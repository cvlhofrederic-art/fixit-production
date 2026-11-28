// @vitest-environment node
// tests/lib/cron-autorisation.test.ts — secret des tâches planifiées (lib/cron/autorisation.ts). Appelée directement,
// sans passer par Headers (qui retire l'espace final de « Bearer ») : seul ce test prouve la garde du secret vide.

import { describe, expect, it } from 'vitest'
import { secretCronValide } from '@/lib/cron/autorisation'

describe('secretCronValide', () => {
  it('accepte l’en-tête exact, refuse un autre secret ou une autre forme', () => {
    expect(secretCronValide('Bearer s3cret', 's3cret')).toBe(true)
    expect(secretCronValide('Bearer s3cre', 's3cret')).toBe(false)
    expect(secretCronValide('bearer s3cret', 's3cret')).toBe(false)
    expect(secretCronValide('s3cret', 's3cret')).toBe(false)
  })

  it('secret vide ou absent côté serveur : refus, même pour « Bearer » suivi de rien', () => {
    expect(secretCronValide('Bearer ', '')).toBe(false)
    expect(secretCronValide('Bearer', '')).toBe(false)
    expect(secretCronValide('Bearer undefined', undefined)).toBe(false)
    expect(secretCronValide('Bearer null', null)).toBe(false)
  })

  it('en-tête absent ou vide : refus', () => {
    expect(secretCronValide(null, 's3cret')).toBe(false)
    expect(secretCronValide(undefined, 's3cret')).toBe(false)
    expect(secretCronValide('', 's3cret')).toBe(false)
  })
})
