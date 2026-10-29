import { describe, expect, it } from 'vitest'
import { nouvelleFicheLot, quotePartPourcent } from '@/lib/administrateur-judiciaire/domain/fiche-lot'

describe('fiche lot — quote-part dans une clé', () => {
  it('en pourcentage à deux décimales, virgule française', () => {
    expect(quotePartPourcent({ numerateur: 412, denominateur: 10000 })).toBe('4,12 %')
    expect(quotePartPourcent({ numerateur: 58, denominateur: 1000 })).toBe('5,80 %')
    expect(quotePartPourcent({ numerateur: 1, denominateur: 3 })).toBe('33,33 %')
    expect(quotePartPourcent({ numerateur: 10000, denominateur: 10000 })).toBe('100,00 %')
  })

  it('sans total, ou avec des tantièmes négatifs, pas de quote-part', () => {
    expect(quotePartPourcent({ numerateur: 412, denominateur: 0 })).toBe('—')
    expect(quotePartPourcent({ numerateur: -1, denominateur: 1000 })).toBe('—')
  })
})

describe('fiche lot — fiche neuve', () => {
  it('lot principal, dans le règlement, sans données propres', () => {
    expect(nouvelleFicheLot({ numero: '12' })).toMatchObject({
      numero: '12',
      principal: true,
      horsReglement: false,
      tantiemes: [],
      fondsTravauxAttacheEuros: null,
    })
  })
})
