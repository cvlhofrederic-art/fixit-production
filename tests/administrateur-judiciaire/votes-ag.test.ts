import { describe, expect, it } from 'vitest'
import { calculerMajoriteAG } from '@/lib/administrateur-judiciaire/domain/majorites-ag'
import {
  controlerConvocation,
  controlerPouvoirs,
  depouiller,
  voixApresReduction,
  type LignePresence,
} from '@/lib/administrateur-judiciaire/domain/votes-ag'

/**
 * Votes d'assemblée (cartographie Gestéam, tranche 31 ; D2 : le votant est le compte copropriétaire).
 * - Feuille de présence : présent, représenté (mandataire), correspondance, visio, absent.
 * - Réduction de l'art. 22 al. 2 (L. 1965) : un copropriétaire détenant plus de la moitié des voix est ramené à la somme
 *   des voix des autres.
 * - Pouvoirs, art. 22 al. 3 : au plus trois délégations par mandataire, sauf si ses voix et celles de ses mandants
 *   n'excèdent pas 10 % des voix du syndicat.
 * - Convocation, D. 1967 art. 9 : au moins 21 jours avant la réunion, sauf urgence ; délai compté du lendemain de la
 *   première présentation de la lettre recommandée (art. 64) — repère, à confirmer.
 * - Dépouillement → VoteAssemblee de majorites-ag (art. 24, 25, 26).
 */

const presence = (compteId: string, tantiemes: number, etat: LignePresence['etat'], mandataire: string | null = null): LignePresence => ({
  compteId,
  tantiemes,
  etat,
  mandataire,
})

describe('art. 22 al. 2 — réduction des voix', () => {
  it('ramène le copropriétaire majoritaire à la somme des voix des autres', () => {
    expect(voixApresReduction([presence('A', 600, 'present'), presence('B', 250, 'present'), presence('C', 150, 'absent')])).toEqual({
      voix: { A: 400, B: 250, C: 150 },
      total: 800,
      reduit: 'A',
    })
  })

  it('sans copropriétaire majoritaire, rien ne change', () => {
    expect(voixApresReduction([presence('A', 500, 'present'), presence('B', 500, 'present')]).reduit).toBeNull()
  })
})

describe('art. 22 al. 3 — pouvoirs', () => {
  const syndicat = [
    presence('M', 50, 'present'),
    presence('P1', 50, 'represente', 'M'),
    presence('P2', 50, 'represente', 'M'),
    presence('P3', 50, 'represente', 'M'),
    presence('P4', 50, 'represente', 'M'),
    ...Array.from({ length: 15 }, (_, i) => presence(`X${i}`, 50, 'absent')),
  ]

  it('plus de trois délégations au-delà de 10 % des voix : anomalie', () => {
    expect(controlerPouvoirs(syndicat)).toEqual([
      expect.objectContaining({ code: 'trop_de_delegations', mandataire: 'M', delegations: 4, pourcentVoix: 25 }),
    ])
  })

  it('plus de trois délégations admises sous 10 % des voix', () => {
    const petit = syndicat.map((l) => (l.compteId.startsWith('X') ? { ...l, tantiemes: 400 } : { ...l, tantiemes: 10 }))
    expect(controlerPouvoirs(petit)).toEqual([])
  })

  it('un représenté sans mandataire, ou un mandataire absent : anomalie', () => {
    expect(controlerPouvoirs([presence('A', 10, 'represente'), presence('B', 10, 'present')]).map((a) => a.code)).toEqual(['mandataire_manquant'])
    expect(controlerPouvoirs([presence('A', 10, 'represente', 'B'), presence('B', 10, 'absent')]).map((a) => a.code)).toEqual(['mandataire_absent'])
  })
})

describe('D. 1967 art. 9 — délai de convocation', () => {
  it('21 jours pleins depuis le lendemain de la première présentation', () => {
    expect(controlerConvocation({ datePremierePresentation: '2026-05-01', dateAssemblee: '2026-05-23' })).toMatchObject({ conforme: true, joursFrancs: 21 })
    expect(controlerConvocation({ datePremierePresentation: '2026-05-02', dateAssemblee: '2026-05-23' })).toMatchObject({ conforme: false, joursFrancs: 20 })
  })

  it('urgence : délai réduit admis, signalé', () => {
    expect(controlerConvocation({ datePremierePresentation: '2026-05-15', dateAssemblee: '2026-05-23', urgence: true })).toMatchObject({ conforme: true })
  })

  it('sans première présentation connue, pas de conclusion', () => {
    expect(controlerConvocation({ datePremierePresentation: null, dateAssemblee: '2026-05-23' })).toMatchObject({ conforme: null })
  })
})

describe('dépouillement d’une résolution', () => {
  const feuille = [
    presence('A', 300, 'present'),
    presence('B', 200, 'represente', 'A'),
    presence('C', 150, 'correspondance'),
    presence('D', 100, 'visio'),
    presence('E', 250, 'absent'),
  ]

  it('compte les votants (présents, représentés, correspondance, visio) ; les absents et défaillants ne votent pas', () => {
    const vote = depouiller(feuille, { A: 'pour', B: 'pour', C: 'contre', D: 'abstention' })
    expect(vote).toEqual({ voixTotales: 1000, membresTotaux: 5, pour: 500, contre: 150, abstention: 100, membresPour: 2 })
    expect(calculerMajoriteAG(vote, 'art24').adopte).toBe(true)
    expect(calculerMajoriteAG(vote, 'art25').adopte).toBe(false)
  })

  it('un votant sans bulletin est défaillant ; un absent ne peut pas voter', () => {
    expect(depouiller(feuille, { A: 'pour' })).toMatchObject({ pour: 300, contre: 0, abstention: 0 })
    expect(() => depouiller(feuille, { E: 'pour' })).toThrow(/absent/i)
  })

  it('applique la réduction de l’art. 22 aux voix et au total', () => {
    const vote = depouiller([presence('A', 700, 'present'), presence('B', 300, 'present')], { A: 'pour', B: 'contre' })
    expect(vote).toMatchObject({ voixTotales: 600, pour: 300, contre: 300 })
  })
})
