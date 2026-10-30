import { describe, expect, it } from 'vitest'
import { composerDateIso } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  comptagePresence,
  echeanceContestation,
  limitePresentationConvocation,
  resultatsResolutions,
  type ResolutionFiche,
} from '@/lib/administrateur-judiciaire/domain/fiche-assemblee'
import type { Bulletin, LignePresence } from '@/lib/administrateur-judiciaire/domain/votes-ag'

/** Dix comptes de 1 000 tantièmes : A à F votent, G et H sont représentés par A, I et J sont absents. */
const FEUILLE: LignePresence[] = [
  ...['A', 'B', 'C', 'D', 'E', 'F'].map((compteId) => ({ compteId, tantiemes: 1000, etat: 'present' as const, mandataire: null })),
  { compteId: 'G', tantiemes: 1000, etat: 'represente', mandataire: 'A' },
  { compteId: 'H', tantiemes: 1000, etat: 'represente', mandataire: 'A' },
  { compteId: 'I', tantiemes: 1000, etat: 'absent', mandataire: null },
  { compteId: 'J', tantiemes: 1000, etat: 'absent', mandataire: null },
]
const bulletins = (pour: string[], contre: string[] = [], abstention: string[] = []): Record<string, Bulletin> => ({
  ...Object.fromEntries(pour.map((compte) => [compte, 'pour' as const])),
  ...Object.fromEntries(contre.map((compte) => [compte, 'contre' as const])),
  ...Object.fromEntries(abstention.map((compte) => [compte, 'abstention' as const])),
})
const resoudre = (resolution: ResolutionFiche) => resultatsResolutions({ id: 'ag-1', feuille: FEUILLE, resolutions: [resolution] })[0]

describe('fiche assemblée — résultat des résolutions (modules resolutions-ag et votes-ag)', () => {
  it('art. 24 : majorité des voix exprimées', () => {
    const r = resoudre({ numero: 1, intitule: 'Président de séance', majorite: 'art24', bulletins: bulletins(['A', 'B', 'C'], ['D', 'E'], ['F']) })
    expect(r.libelle).toBe('Adoptée')
    expect(r.vote).toMatchObject({ pour: 3000, contre: 2000, abstention: 1000 })
  })

  it('art. 25 manqué avec au moins le tiers des voix : adoptée au second vote (art. 25-1)', () => {
    const r = resoudre({ numero: 2, intitule: 'Travaux', majorite: 'art25', bulletins: bulletins(['A', 'B', 'C', 'D'], ['E', 'F']) })
    expect(r.libelle).toBe('Adoptée au second vote (art. 25-1)')
  })

  it('art. 25 sous le tiers : rejetée, sans passerelle hors travaux de l’art. 25 f', () => {
    expect(resoudre({ numero: 3, intitule: 'Ravalement', majorite: 'art25', bulletins: bulletins(['A', 'B'], ['C', 'D', 'E', 'F']) }).libelle).toBe('Rejetée')
    expect(
      resoudre({ numero: 4, intitule: 'Isolation', majorite: 'art25', travauxArt25f: true, bulletins: bulletins(['A', 'B'], ['C', 'D', 'E', 'F']) }).libelle,
    ).toBe('Rejetée : nouvelle AG possible sous trois mois (art. 25-1, al. 2)')
  })

  it('une résolution sans bulletins reste à voter', () => {
    expect(resoudre({ numero: 5, intitule: 'Budget', majorite: 'art24', bulletins: null })).toMatchObject({ libelle: 'À voter', vote: null })
  })
})

describe('fiche assemblée — présence, convocation, contestation', () => {
  it('compte les présences en nombre et en tantièmes', () => {
    expect(comptagePresence(FEUILLE)).toEqual({
      present: { nombre: 6, tantiemes: 6000 },
      represente: { nombre: 2, tantiemes: 2000 },
      correspondance: { nombre: 0, tantiemes: 0 },
      visio: { nombre: 0, tantiemes: 0 },
      absent: { nombre: 2, tantiemes: 2000 },
    })
  })

  it('la convocation doit être présentée au plus tard 22 jours avant la réunion', () => {
    expect(limitePresentationConvocation(composerDateIso(2026, 4, 18))).toBe(composerDateIso(2026, 3, 27))
  })

  it('contestation : deux mois à compter du lendemain de la première présentation (J1)', () => {
    expect(echeanceContestation(composerDateIso(2026, 2, 4))).toEqual({
      pointDeDepart: composerDateIso(2026, 2, 5),
      echeance: composerDateIso(2026, 4, 5),
    })
  })
})
