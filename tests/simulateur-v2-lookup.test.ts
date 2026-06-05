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

describe('lookupVariants — filtre surface', () => {
  it('exclut les lignes avec surfaceMin > surface fournie', () => {
    const r = lookupVariants({
      description: 'peinture',
      metierHint: 'peinture',
      surface: 10,
    })
    for (const v of r) {
      const min = v.conditions?.surfaceMin ?? 0
      expect(min).toBeLessThanOrEqual(10)
    }
  })

  it('exclut les lignes avec surfaceMax < surface fournie', () => {
    const r = lookupVariants({
      description: 'peinture',
      metierHint: 'peinture',
      surface: 500,
    })
    for (const v of r) {
      const max = v.conditions?.surfaceMax ?? Infinity
      expect(max).toBeGreaterThanOrEqual(500)
    }
  })

  it('garde les lignes sans contraintes surface', () => {
    const r = lookupVariants({ description: 'peinture mur', surface: 25 })
    expect(r.length).toBeGreaterThan(0)
  })
})

describe('lookupVariants — scoring', () => {
  it('priorise mur intérieur sur ravalement façade pour "peinture salon"', () => {
    const r = lookupVariants({ description: 'peinture salon murs' })
    expect(r[0]?.taskId).toBe('peinture-murs-interieur-2couches')
  })

  it('keywords externes augmentent le score', () => {
    const baseline = lookupVariants({ description: 'travaux' })
    const boosted = lookupVariants({ description: 'travaux', keywords: ['peinture mur'] })
    expect(boosted.length).toBeGreaterThanOrEqual(baseline.length)
  })
})
