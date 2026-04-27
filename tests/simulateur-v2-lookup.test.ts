// tests/simulateur-v2-lookup.test.ts
import { describe, it, expect } from 'vitest'
import { lookupVariants } from '@/lib/prix-travaux-2026/lookup'

describe('lookupVariants — matching basique', () => {
  it('retourne tableau vide pour description vide', () => {
    expect(lookupVariants({ description: '' })).toEqual([])
  })

  it('matche peinture par metierHint', () => {
    const r = lookupVariants({ description: 'travaux', metierHint: 'peinture' })
    expect(r.length).toBeGreaterThan(0)
    expect(r.every(v => v.metier === 'peinture')).toBe(true)
  })

  it('matche peinture par keyword "peinture mur"', () => {
    const r = lookupVariants({ description: 'refaire la peinture du mur du salon' })
    const ids = r.map(v => v.taskId)
    expect(ids).toContain('peinture-murs-interieur-2couches')
  })

  it('limite à 5 résultats max', () => {
    const r = lookupVariants({ description: 'peinture' })
    expect(r.length).toBeLessThanOrEqual(5)
  })

  it('retourne metier inconnu vide', () => {
    // @ts-expect-error invalid metier
    const r = lookupVariants({ description: 'ascenseur', metierHint: 'ascenseur' })
    expect(r).toEqual([])
  })
})
