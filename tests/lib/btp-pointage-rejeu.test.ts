// tests/lib/btp-pointage-rejeu.test.ts — rejeu d'une journée d'envois du téléphone (lib/btp/pointage-rejeu.ts,
// 17/11/2026) : le résultat ne dépend ni de l'ordre ni du nombre de réceptions ; les pointages qui ne viennent pas du
// téléphone priment.

import { describe, expect, it } from 'vitest'
import {
  instantMural, memeContenu, ordreRejeu, rejouerJournee, retirerAutre, type EnvoiJournal, type PlageAutre, type Presence,
} from '@/lib/btp/pointage-rejeu'

/** Heure murale de Paris le 16/11/2026 (UTC+1). */
const h = (heure: number, minute = 0, seconde = 0) => Date.UTC(2026, 10, 16, heure - 1, minute, seconde)
const A = 'chantier-a'
const B = 'chantier-b'
const envoi = (chantier: string, sens: 'enter' | 'exit', detecte: number): EnvoiJournal => ({ chantier, sens, detecte, recu: detecte })
const entre = (chantier: string, t: number) => envoi(chantier, 'enter', t)
const sort = (chantier: string, t: number) => envoi(chantier, 'exit', t)

function permutations<T>(liste: readonly T[]): T[][] {
  if (liste.length <= 1) return [[...liste]]
  return liste.flatMap((x, i) => permutations([...liste.slice(0, i), ...liste.slice(i + 1)]).map(reste => [x, ...reste]))
}
const resume = (presences: Presence[]) => presences.map(p => [p.chantier, p.debut, p.fin])
/** Le même résultat pour chacun des ordres de réception possibles. */
function dansTousLesOrdres(envois: EnvoiJournal[], autres: PlageAutre[] = []) {
  const resultats = permutations(envois).map(ordre => JSON.stringify(resume(rejouerJournee(ordre, autres))))
  expect(new Set(resultats).size).toBe(1)
  return resume(rejouerJournee(envois, autres))
}

describe('rejeu dans l’ordre des heures de détection, quel que soit l’ordre de réception', () => {
  it('journée avec pause déjeuner : 08:00-12:00 puis 12:30-17:00 (24 ordres)', () => {
    expect(dansTousLesOrdres([entre(A, h(8)), sort(A, h(12)), entre(A, h(12, 30)), sort(A, h(17))]))
      .toEqual([[A, h(8), h(12)], [A, h(12, 30), h(17)]])
  })

  it('changement de chantier : A le matin, B l’après-midi', () => {
    expect(dansTousLesOrdres([entre(A, h(8)), sort(A, h(12)), entre(B, h(12, 30)), sort(B, h(17))]))
      .toEqual([[A, h(8), h(12)], [B, h(12, 30), h(17)]])
  })

  it('chantiers voisins (zones qui se chevauchent) : B prend le relais à la sortie de A, aucune heure comptée deux fois', () => {
    expect(dansTousLesOrdres([entre(A, h(8)), entre(B, h(10)), sort(A, h(12)), sort(B, h(17))]))
      .toEqual([[A, h(8), h(12)], [B, h(12), h(17)]])
  })

  it('trois zones qui se chevauchent, arrivée renvoyée dans l’une (zones reposées) : le relais suit l’ordre des vraies arrivées', () => {
    const C = 'chantier-c'
    expect(dansTousLesOrdres([
      entre(A, h(8)), entre(B, h(9)), entre(C, h(10)), entre(B, h(11)), sort(A, h(12)), sort(B, h(14)), sort(C, h(17)),
    ])).toEqual([[A, h(8), h(12)], [B, h(12), h(14)], [C, h(14), h(17)]])
  })

  it('sorti de B (voisin) avant la fin de A : B ne compte jamais', () => {
    expect(dansTousLesOrdres([entre(A, h(8)), entre(B, h(10)), sort(B, h(10, 30)), sort(A, h(17))]))
      .toEqual([[A, h(8), h(17)]])
  })

  it('deux zones franchies à la même heure (Android : même position, même heure) : une seule compte, rien de perdu', () => {
    expect(dansTousLesOrdres([entre(A, h(8)), entre(B, h(8)), sort(A, h(17)), sort(B, h(17))]))
      .toEqual([[A, h(8), h(17)]])
  })

  it('zones voisines quittées à quelques secondes d’écart : le relais de quelques secondes ne compte pas', () => {
    expect(dansTousLesOrdres([entre(A, h(8)), entre(B, h(9)), sort(A, h(17)), sort(B, h(17, 0, 20))]))
      .toEqual([[A, h(8), h(17)]])
  })

  it('envois reçus deux fois : sans effet', () => {
    expect(rejouerJournee([entre(A, h(8)), entre(A, h(8)), sort(A, h(12)), sort(A, h(12))], []).map(p => [p.debut, p.fin]))
      .toEqual([[h(8), h(12)]])
  })

  it('arrivée renvoyée par le système qui repose ses zones (déjà dedans) : rien de plus', () => {
    expect(dansTousLesOrdres([entre(A, h(8)), entre(A, h(10)), sort(A, h(12))])).toEqual([[A, h(8), h(12)]])
  })

  it('sortie sans arrivée connue : ignorée', () => {
    expect(dansTousLesOrdres([sort(A, h(9)), entre(A, h(10)), sort(A, h(12))])).toEqual([[A, h(10), h(12)]])
  })

  it('toujours sur place : présence ouverte', () => {
    expect(resume(rejouerJournee([entre(A, h(8))], []))).toEqual([[A, h(8), null]])
  })

  it('passage de moins de 3 min : écarté ; 3 min tout juste : compté', () => {
    expect(rejouerJournee([entre(A, h(8)), sort(A, h(8, 2, 59))], [])).toEqual([])
    expect(resume(rejouerJournee([entre(A, h(8)), sort(A, h(8, 3))], []))).toEqual([[A, h(8), h(8, 3)]])
  })

  it('ordre stable à heure égale : sortie avant arrivée, puis chantier', () => {
    expect([entre(B, h(8)), sort(B, h(8)), entre(A, h(8))].sort(ordreRejeu).map(e => `${e.sens}:${e.chantier}`))
      .toEqual([`exit:${B}`, `enter:${A}`, `enter:${B}`])
  })
})

describe('pointages qui ne viennent pas du téléphone : ils priment', () => {
  it('fin à la main sur place : la présence continue du téléphone ne compte plus, même zones reposées', () => {
    // Arrivée vue à 07:58, pointage à la main 08:00-17:00, zones reposées à 17:05 (téléphone toujours sur place).
    expect(rejouerJournee([entre(A, h(7, 58)), entre(A, h(17, 5))], [{ chantier: A, debut: h(8), fin: h(17) }])).toEqual([])
  })

  it('après la sortie et une nouvelle arrivée, le téléphone pointe de nouveau (après-midi)', () => {
    const envois = [entre(A, h(7, 58)), sort(A, h(12)), entre(A, h(13)), sort(A, h(17))]
    expect(dansTousLesOrdres(envois, [{ chantier: A, debut: h(8), fin: h(12, 10) }])).toEqual([[A, h(13), h(17)]])
  })

  it('pointage sur un autre chantier : sa durée est retirée, le reste compte', () => {
    expect(dansTousLesOrdres([entre(A, h(8)), sort(A, h(17))], [{ chantier: B, debut: h(10), fin: h(11) }]))
      .toEqual([[A, h(8), h(10)], [A, h(11), h(17)]])
  })

  it('pointage sans durée ailleurs (départ oublié refermé sans heures) : ne coupe pas la présence', () => {
    expect(dansTousLesOrdres([entre(A, h(8)), sort(A, h(17))], [{ chantier: B, debut: h(10), fin: h(10) }])).toEqual([[A, h(8), h(17)]])
  })

  it('pointage encore ouvert ailleurs : plus rien après son début', () => {
    expect(dansTousLesOrdres([entre(A, h(8)), sort(A, h(17))], [{ chantier: B, debut: h(10), fin: null }]))
      .toEqual([[A, h(8), h(10)]])
  })

  it('pointage refermé sans heures (départ oublié régularisé) sur le même chantier : la présence n’est pas recréée', () => {
    expect(rejouerJournee([entre(A, h(8)), sort(A, h(17))], [{ chantier: A, debut: h(8), fin: h(8) }])).toEqual([])
  })

  it('pointage du même chantier fini avant l’arrivée du téléphone : sans effet', () => {
    const presence: Presence = { chantier: A, debut: h(13), fin: h(17), arrivee: entre(A, h(13)) }
    expect(retirerAutre(presence, { chantier: A, debut: h(8), fin: h(12) })).toEqual([presence])
    expect(retirerAutre(presence, { chantier: B, debut: h(18), fin: null })).toEqual([presence])
  })
})

describe('outils', () => {
  it('instant d’une heure murale : Paris, Lisbonne, heure d’été', () => {
    expect(instantMural('2026-11-16', '08:30:00', 'Europe/Paris')).toBe(Date.UTC(2026, 10, 16, 7, 30))
    expect(instantMural('2026-11-16', '08:30', 'Europe/Lisbon')).toBe(Date.UTC(2026, 10, 16, 8, 30))
    expect(instantMural('2026-07-01', '08:30:00', 'Europe/Paris')).toBe(Date.UTC(2026, 6, 1, 6, 30))
    expect(instantMural('hier', '08:30', 'Europe/Paris')).toBeNaN()
  })

  it('pointage modifié depuis ? Formats de la base mis de côté, toute modification vue', () => {
    const ecrit = {
      chantier_id: A, date: '2026-11-16', heure_arrivee: '08:30:00', heure_depart: '12:30:00', heures_travaillees: 4,
      notes: null, created_at: '2026-11-16T07:30:00.000Z',
    }
    expect(memeContenu({ ...ecrit, id: 'x', heures_travaillees: '4.00', created_at: '2026-11-16T07:30:00+00:00' }, ecrit)).toBe(true)
    expect(memeContenu({ ...ecrit, heure_depart: '12:00:00' }, ecrit)).toBe(false)
    expect(memeContenu({ ...ecrit, notes: 'Corrigé par le gérant' }, ecrit)).toBe(false)
    expect(memeContenu({ ...ecrit, heures_travaillees: 3.5 }, ecrit)).toBe(false)
    expect(memeContenu({ ...ecrit, chantier_id: B }, ecrit)).toBe(false)
    expect(memeContenu({ ...ecrit, created_at: '2026-11-16T07:00:00.000Z' }, ecrit)).toBe(false)
    expect(memeContenu({ ...ecrit, date: '2026-11-17' }, ecrit)).toBe(false)
    expect(memeContenu({ ...ecrit, heure_arrivee: '08:00:00' }, ecrit)).toBe(false)
  })

  it('un écart de moins de 3 min après découpe est écarté aussi', () => {
    expect(rejouerJournee([entre(A, h(7, 58)), sort(A, h(12))], [{ chantier: A, debut: h(8), fin: h(12) }])).toEqual([])
  })
})
