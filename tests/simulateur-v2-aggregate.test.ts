import { describe, it, expect } from 'vitest'
import { PRIX_2026, COEFFICIENTS_ZONE_2026, COEFFICIENTS_GAMME_2026 } from '@/lib/prix-travaux-2026'

describe('prix-travaux-2026 barrel export', () => {
  it('PRIX_2026 contient au moins 50 lignes', () => {
    expect(PRIX_2026.length).toBeGreaterThanOrEqual(50)
  })

  it('PRIX_2026 contient les 10 métiers Phase 1', () => {
    const metiers = new Set(PRIX_2026.map(l => l.metier))
    expect(metiers).toEqual(new Set([
      'plomberie', 'electricite', 'peinture', 'plaquiste', 'carrelage',
      'maconnerie', 'couverture', 'menuiserie', 'chauffage', 'paysagisme',
    ]))
  })

  it('chaque taskId est unique', () => {
    const ids = PRIX_2026.map(l => l.taskId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('re-exporte les coefficients zone et gamme', () => {
    expect(COEFFICIENTS_ZONE_2026.length).toBeGreaterThan(0)
    expect(COEFFICIENTS_GAMME_2026.length).toBe(3)
  })
})
