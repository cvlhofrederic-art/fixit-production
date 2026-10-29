import { describe, expect, it } from 'vitest'
import { repartirAuxPlusFortsRestes } from '@/lib/administrateur-judiciaire/domain/arrondis'

/**
 * Plus forts restes en arithmétique entière exacte (arrondis.ts) : la somme des parts égale le montant, chaque part est
 * un entier, même quand montant × poids dépasse les entiers sûrs de JavaScript (2^53).
 */

describe('répartition aux plus forts restes', () => {
  it('répartit au prorata, un centime aux plus forts restes, départage par l’ordre reçu', () => {
    expect(repartirAuxPlusFortsRestes(45_350, [1, 1, 1, 1])).toEqual([11_338, 11_338, 11_337, 11_337])
    expect(repartirAuxPlusFortsRestes(1_000, [300, 100])).toEqual([750, 250])
    expect(repartirAuxPlusFortsRestes(10, [0, 3, 0])).toEqual([0, 10, 0])
  })

  it('reste exacte au-delà des entiers sûrs (gros budget, poids en centimes)', () => {
    const poids = [236_450_458, 236_450_458, 236_450_457, 236_450_457]
    const parts = repartirAuxPlusFortsRestes(84_561_544, poids)
    for (const part of parts) expect(Number.isInteger(part)).toBe(true)
    expect(parts.reduce((s, p) => s + p, 0)).toBe(84_561_544)
    expect(parts).toEqual([21_140_386, 21_140_386, 21_140_386, 21_140_386])
  })

  it('refuse un montant ou un poids non entier, négatif, ou un total nul', () => {
    expect(() => repartirAuxPlusFortsRestes(10.5, [1])).toThrow(/centimes/)
    expect(() => repartirAuxPlusFortsRestes(-1, [1])).toThrow(/centimes/)
    expect(() => repartirAuxPlusFortsRestes(10, [1.5, 1])).toThrow(/poids/i)
    expect(() => repartirAuxPlusFortsRestes(10, [-1, 2])).toThrow(/poids/i)
    expect(() => repartirAuxPlusFortsRestes(10, [0, 0])).toThrow(/nul/)
  })
})
