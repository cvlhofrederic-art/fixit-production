import { describe, it, expect } from 'vitest'
import { dimancheDePaques, feriadosObrigatorios, estFeriadoObrigatorio } from '@/lib/syndic/v54/feriados-pt'

/**
 * Feriados obrigatórios portugais (art. 234.º, n.º 1, du Código do Trabalho), utilisés par la
 * seule règle PT du délai de la declaração de encargos (report de l'art. 279.º, e), CC).
 * Fêtes mobiles calculées depuis Pâques (calendrier grégorien) : Sexta-feira Santa = Pâques − 2,
 * Corpo de Deus = Pâques + 60. Carnaval et férié municipal (facultatifs, art. 235.º) : exclus.
 */

describe('dimancheDePaques — calendrier grégorien', () => {
  it.each([
    [2008, '2008-03-23'],
    [2011, '2011-04-24'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2029, '2029-04-01'],
    [2030, '2030-04-21'],
    [2038, '2038-04-25'],
    [2285, '2285-03-22'],
  ])('%i → %s', (annee, paques) => {
    expect(dimancheDePaques(annee)).toBe(paques)
  })
})

describe('feriadosObrigatorios — art. 234.º, n.º 1, CT', () => {
  it('2026 : les 13 feriados obrigatórios, dans l’ordre du calendrier', () => {
    expect(feriadosObrigatorios(2026)).toEqual([
      '2026-01-01', // Ano Novo
      '2026-04-03', // Sexta-feira Santa (Pâques − 2)
      '2026-04-05', // Domingo de Páscoa
      '2026-04-25', // Dia da Liberdade
      '2026-05-01', // Dia do Trabalhador
      '2026-06-04', // Corpo de Deus (Pâques + 60)
      '2026-06-10', // Dia de Portugal
      '2026-08-15', // Assunção de Nossa Senhora
      '2026-10-05', // Implantação da República
      '2026-11-01', // Todos os Santos
      '2026-12-01', // Restauração da Independência
      '2026-12-08', // Imaculada Conceição
      '2026-12-25', // Natal
    ])
  })

  it('2027 : fêtes mobiles recalculées depuis Pâques (28 mars)', () => {
    const feriados = feriadosObrigatorios(2027)
    expect(feriados).toHaveLength(13)
    expect(feriados).toContain('2027-03-26') // Sexta-feira Santa
    expect(feriados).toContain('2027-03-28') // Domingo de Páscoa
    expect(feriados).toContain('2027-05-27') // Corpo de Deus
    expect(feriados).not.toContain('2027-04-02')
    expect(feriados).not.toContain('2027-06-04')
  })

  it('fête mobile sur une fête fixe : un seul jour, sans doublon', () => {
    // 2038 : Domingo de Páscoa le 25 avril ; 2004 : Corpo de Deus le 10 juin.
    const f2038 = feriadosObrigatorios(2038)
    expect(f2038.filter((j) => j === '2038-04-25')).toHaveLength(1)
    expect(f2038).toHaveLength(12)
    const f2004 = feriadosObrigatorios(2004)
    expect(f2004.filter((j) => j === '2004-06-10')).toHaveLength(1)
    expect(f2004).toHaveLength(12)
  })

  it('facultatifs exclus : Carnaval, férié municipal, veille de Noël', () => {
    const feriados = feriadosObrigatorios(2026)
    expect(feriados).not.toContain('2026-02-17') // Carnaval (Pâques − 47)
    expect(feriados).not.toContain('2026-06-13') // Santo António (Lisbonne)
    expect(feriados).not.toContain('2026-06-24') // São João (Porto)
    expect(feriados).not.toContain('2026-12-24')
  })
})

describe('estFeriadoObrigatorio', () => {
  it.each(['2026-12-08', '2026-04-03', '2026-06-04', '2027-05-27', '2028-01-01'])('%s : férié', (jour) => {
    expect(estFeriadoObrigatorio(jour)).toBe(true)
  })

  it.each(['2026-12-09', '2026-10-25', '2026-02-17', '2027-04-02'])('%s : pas férié', (jour) => {
    expect(estFeriadoObrigatorio(jour)).toBe(false)
  })

  it.each([undefined, null, '', 'abc', '2026-02-30', '2026-12-08T00:00:00Z', '08/12/2026'])('jour absent ou impossible (%s) : pas férié', (jour) => {
    expect(estFeriadoObrigatorio(jour)).toBe(false)
  })
})
