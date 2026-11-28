import { describe, expect, it } from 'vitest'
import { composerDateIso } from '@/lib/administrateur-judiciaire/domain/dates'
import { finConseilSyndical, nouvelleFicheCopropriete } from '@/lib/administrateur-judiciaire/domain/fiche-copropriete'

describe('fiche copropriété — conseil syndical', () => {
  it('le mandat du conseil syndical finit N mois après l’élection', () => {
    expect(finConseilSyndical({ eluLe: composerDateIso(2026, 3, 12), dureeMois: 12 })).toBe(composerDateIso(2027, 3, 12))
    expect(finConseilSyndical({ eluLe: composerDateIso(2026, 1, 31), dureeMois: 1 })).toBe(composerDateIso(2026, 2, 28))
  })

  it('sans élection, ou avec une durée ou une date invalide, aucune fin', () => {
    expect(finConseilSyndical({ eluLe: null, dureeMois: 12 })).toBeNull()
    expect(finConseilSyndical({ eluLe: '12/03/2026', dureeMois: 12 })).toBeNull()
    expect(finConseilSyndical({ eluLe: composerDateIso(2026, 3, 12), dureeMois: 0 })).toBeNull()
    expect(finConseilSyndical({ eluLe: composerDateIso(2026, 3, 12), dureeMois: 1.5 })).toBeNull()
  })
})

describe('fiche copropriété — fiche neuve', () => {
  it('mandant le syndicat, en gestion, sans type ni données propres', () => {
    const fiche = nouvelleFicheCopropriete({ numeroMandat: 'M001' })
    expect(fiche).toMatchObject({
      numeroMandat: 'M001',
      typeMandat: '',
      mandant: 'Syndicat des copropriétaires',
      statutGestion: 'En gestion',
      cles: [],
      exercices: [],
      avertissement: null,
    })
  })
})
