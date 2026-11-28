import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { VoteAssemblee } from '@/lib/administrateur-judiciaire/domain/majorites-ag'
import {
  amenderResolution,
  bulletinsApresAmendement,
  creerResolution,
  membresVotants,
  reporterResolution,
  voterResolution,
  voterSecondVote,
  type SaisieResolution,
} from '@/lib/administrateur-judiciaire/domain/resolutions-ag'
import type { LignePresence } from '@/lib/administrateur-judiciaire/domain/votes-ag'

/**
 * Résolutions d'assemblée générale (point 22 du bilan 2 ; Gestéam, tranche 31 : onglet Votes, majorité par résolution,
 * boutons Amendement et Reportée). Textes relus sur Légifrance le 29/10/2026.
 * - La résolution porte sa majorité requise, son premier vote, son éventuel second vote et son résultat.
 * - Art. 25-1 al. 1 : au moins le tiers des voix → second vote immédiat à la majorité de l'art. 24 ; al. 2 : sous le
 *   tiers, nouvelle assemblée dans les trois mois seulement pour les travaux de l'art. 25 f.
 * - Art. 26-1 : moitié des membres présents, représentés ou votant par correspondance, et tiers des voix → second vote
 *   immédiat à la majorité de l'art. 25 ; D. 19-1 : pas d'art. 25-1 ensuite.
 * - Art. 17-1 A al. 2 : sur une résolution amendée, le vote « pour » par correspondance compte comme défaillant.
 * - Report : pratique de Gestéam, aucun texte.
 */

const saisie = (surcharge: Partial<SaisieResolution> = {}): SaisieResolution => ({
  id: 'R5',
  agId: 'AG-2026',
  numero: 5,
  intitule: 'Désignation du syndic',
  majorite: 'art25',
  ...surcharge,
})

const vote = (surcharge: Partial<VoteAssemblee> = {}): VoteAssemblee => ({
  voixTotales: 10_000,
  membresTotaux: 40,
  pour: 0,
  contre: 0,
  abstention: 0,
  membresPour: 0,
  ...surcharge,
})

describe('création', () => {
  it('une résolution porte sa majorité requise et part « à voter »', () => {
    expect(creerResolution(saisie())).toMatchObject({
      etat: 'a_voter',
      majorite: 'art25',
      amendee: false,
      texteAmende: null,
      premierVote: null,
      secondVote: null,
      suite: null,
      motifReport: null,
    })
  })

  it('refuse un numéro, un intitulé ou une majorité invalides', () => {
    expect(() => creerResolution(saisie({ numero: 0 }))).toThrow(/numéro/i)
    expect(() => creerResolution(saisie({ intitule: '  ' }))).toThrow(/intitulé/i)
    // @ts-expect-error — majorité inconnue
    expect(() => creerResolution(saisie({ majorite: 'art27' }))).toThrow(/majorité/i)
  })
})

describe('art. 24 et unanimité', () => {
  it('art. 24 : majorité des voix exprimées, abstentions exclues ; aucune voix exprimée : rejetée', () => {
    const r = creerResolution(saisie({ majorite: 'art24', intitule: 'Approbation des comptes' }))
    expect(voterResolution(r, vote({ pour: 3_000, contre: 2_000, abstention: 4_000 }))).toMatchObject({ etat: 'adoptee', suite: null })
    expect(voterResolution(r, vote({ abstention: 4_000 })).etat).toBe('rejetee')
  })

  it('unanimité : toutes les voix du syndicat', () => {
    const r = creerResolution(saisie({ majorite: 'unanimite' }))
    expect(voterResolution(r, vote({ pour: 10_000, membresPour: 40 })).etat).toBe('adoptee')
    expect(voterResolution(r, vote({ pour: 9_999 })).etat).toBe('rejetee')
  })
})

describe('art. 25 et art. 25-1', () => {
  const r = creerResolution(saisie())

  it('majorité des voix de tous les copropriétaires : adoptée', () => {
    const adoptee = voterResolution(r, vote({ pour: 5_001, contre: 1_000 }))
    expect(adoptee).toMatchObject({ etat: 'adoptee', suite: null })
    expect(adoptee.premierVote).toMatchObject({ majorite: 'art25', adopte: true })
  })

  it('borne exacte du tiers : second vote ; travaux de l’art. 25 f au-dessus du tiers : second vote aussi', () => {
    expect(voterResolution(r, vote({ voixTotales: 9_000, pour: 3_000 })).etat).toBe('second_vote')
    const travaux = creerResolution(saisie({ travauxArt25f: true }))
    expect(voterResolution(travaux, vote({ voixTotales: 9_000, pour: 3_000 })).suite?.code).toBe('second_vote_immediat')
  })

  it('au moins le tiers des voix : second vote immédiat à la majorité de l’art. 24', () => {
    const second = voterResolution(r, vote({ pour: 3_334, contre: 1_000 }))
    expect(second).toMatchObject({
      etat: 'second_vote',
      suite: { code: 'second_vote_immediat', majorite: 'art24', fondement: 'L. 1965 art. 25-1, al. 1' },
    })
    const adoptee = voterSecondVote(second, vote({ pour: 3_500, contre: 3_000 }))
    expect(adoptee).toMatchObject({ etat: 'adoptee' })
    expect(adoptee.secondVote).toMatchObject({ majorite: 'art24', adopte: true })
    expect(voterSecondVote(second, vote({ pour: 3_000, contre: 3_500 })).etat).toBe('rejetee')
  })

  it('sous le tiers : rejetée, sans nouvelle assemblée de droit…', () => {
    expect(voterResolution(r, vote({ pour: 3_333, contre: 6_000 }))).toMatchObject({ etat: 'rejetee', suite: null })
  })

  it('… sauf pour les travaux de l’art. 25 f : nouvelle assemblée dans les trois mois, projet identique, art. 24', () => {
    const travaux = creerResolution(saisie({ intitule: 'Isolation des façades', travauxArt25f: true }))
    expect(voterResolution(travaux, vote({ pour: 2_000, contre: 6_000 }))).toMatchObject({
      etat: 'rejetee',
      suite: { code: 'nouvelle_ag_trois_mois', majorite: 'art24', fondement: 'L. 1965 art. 25-1, al. 2' },
    })
  })
})

describe('art. 26 et art. 26-1', () => {
  const r = creerResolution(saisie({ majorite: 'art26', intitule: 'Vente d’une loge' }))

  it('double majorité : membres et deux tiers des voix', () => {
    expect(voterResolution(r, vote({ pour: 6_700, membresPour: 21 })).etat).toBe('adoptee')
  })

  it('moitié des membres VOTANTS (pas de tous les membres) et tiers des voix : second vote à la majorité de l’art. 25', () => {
    // 12 membres pour sur 20 votants (moitié atteinte), 12 sur 40 membres du syndicat (moitié non atteinte).
    const second = voterResolution(r, vote({ pour: 4_000, contre: 2_000, membresPour: 12 }), { membresVotants: 20 })
    expect(second).toMatchObject({
      etat: 'second_vote',
      suite: { code: 'second_vote_immediat', majorite: 'art25', fondement: 'L. 1965 art. 26-1' },
    })
    expect(voterSecondVote(second, vote({ pour: 5_001 })).etat).toBe('adoptee')
  })

  it('après un second vote 26-1 manqué : rejetée, pas d’art. 25-1 (D. 1967 art. 19-1)', () => {
    const second = voterResolution(r, vote({ pour: 4_000, membresPour: 12 }), { membresVotants: 20 })
    expect(voterSecondVote(second, vote({ pour: 4_000 }))).toMatchObject({ etat: 'rejetee', suite: null })
  })

  it('moitié des votants atteinte mais pas le tiers des voix : rejetée ; bornes exactes : second vote', () => {
    expect(voterResolution(r, vote({ pour: 3_333, membresPour: 12 }), { membresVotants: 20 })).toMatchObject({ etat: 'rejetee', suite: null })
    expect(voterResolution(r, vote({ voixTotales: 9_000, pour: 3_000, membresPour: 10 }), { membresVotants: 20 }).etat).toBe('second_vote')
  })

  it('sans le nombre de membres votants : moitié de tous les membres atteinte, second vote certain ; sinon, le nombre est exigé', () => {
    expect(voterResolution(r, vote({ pour: 4_000, membresPour: 20 }))).toMatchObject({ etat: 'second_vote', suite: { majorite: 'art25' } })
    expect(() => voterResolution(r, vote({ pour: 4_000, membresPour: 12 }))).toThrow(/membres présents, représentés ou ayant voté par correspondance/)
    // Sous le tiers des voix, le rejet est certain : le nombre de votants n'est pas demandé.
    expect(voterResolution(r, vote({ pour: 3_000, membresPour: 12 })).etat).toBe('rejetee')
  })

  it('refuse un nombre de membres votants incohérent', () => {
    expect(() => voterResolution(r, vote({ pour: 4_000, membresPour: 12 }), { membresVotants: 10 })).toThrow(/votants invalide/)
    expect(() => voterResolution(r, vote({ pour: 4_000, membresPour: 12 }), { membresVotants: 41 })).toThrow(/votants invalide/)
  })
})

describe('amendement et report', () => {
  it('amender une résolution à voter ; pas après le vote', () => {
    const amendee = amenderResolution(creerResolution(saisie()), 'Désignation du syndic pour 18 mois')
    expect(amendee).toMatchObject({ amendee: true, texteAmende: 'Désignation du syndic pour 18 mois', etat: 'a_voter' })
    const votee = voterResolution(creerResolution(saisie()), vote({ pour: 6_000 }))
    expect(() => amenderResolution(votee, 'texte')).toThrow(/voter/i)
    expect(() => amenderResolution(creerResolution(saisie()), '  ')).toThrow(/texte/i)
  })

  it('résolution amendée : le « pour » par correspondance devient défaillant ; « contre » et abstention restent', () => {
    const feuille: LignePresence[] = [
      { compteId: 'C1', tantiemes: 100, etat: 'correspondance', mandataire: null },
      { compteId: 'C2', tantiemes: 100, etat: 'correspondance', mandataire: null },
      { compteId: 'C3', tantiemes: 100, etat: 'present', mandataire: null },
      { compteId: 'C4', tantiemes: 100, etat: 'correspondance', mandataire: null },
    ]
    expect(bulletinsApresAmendement(feuille, { C1: 'pour', C2: 'contre', C3: 'pour', C4: 'abstention' })).toEqual({
      bulletins: { C2: 'contre', C3: 'pour', C4: 'abstention' },
      defaillantsAssimiles: ['C1'],
    })
  })

  it('résolution art. 26 amendée : les défaillants assimilés sortent de la base de la moitié du 26-1', () => {
    const feuille: LignePresence[] = [
      ...['C1', 'C2', 'C3', 'C4'].map((compteId) => ({ compteId, tantiemes: 50, etat: 'correspondance' as const, mandataire: null })),
      ...['C5', 'C6', 'C7'].map((compteId) => ({ compteId, tantiemes: 130, etat: 'present' as const, mandataire: null })),
      { compteId: 'C8', tantiemes: 100, etat: 'present', mandataire: null },
      { compteId: 'C9', tantiemes: 155, etat: 'absent', mandataire: null },
      { compteId: 'C10', tantiemes: 155, etat: 'absent', mandataire: null },
    ]
    const { defaillantsAssimiles } = bulletinsApresAmendement(feuille, { C1: 'pour', C2: 'pour', C3: 'pour', C4: 'pour', C5: 'pour', C6: 'pour', C7: 'pour', C8: 'contre' })
    expect(membresVotants(feuille)).toBe(8)
    expect(membresVotants(feuille, defaillantsAssimiles)).toBe(4)
    const amendee = amenderResolution(creerResolution(saisie({ majorite: 'art26' })), 'Vente de la loge, prix revu')
    const voteAmende = vote({ voixTotales: 1_000, membresTotaux: 10, pour: 390, contre: 100, membresPour: 3 })
    expect(voterResolution(amendee, voteAmende, { membresVotants: membresVotants(feuille, defaillantsAssimiles) }).etat).toBe('second_vote')
  })

  it('membres votants : présents, représentés, en visioconférence ou par correspondance', () => {
    const feuille: LignePresence[] = [
      { compteId: 'C1', tantiemes: 100, etat: 'correspondance', mandataire: null },
      { compteId: 'C2', tantiemes: 100, etat: 'absent', mandataire: null },
      { compteId: 'C3', tantiemes: 100, etat: 'represente', mandataire: 'C4' },
      { compteId: 'C4', tantiemes: 100, etat: 'present', mandataire: null },
      { compteId: 'C5', tantiemes: 100, etat: 'visio', mandataire: null },
    ]
    expect(membresVotants(feuille)).toBe(4)
  })

  it('reporter une résolution à voter, avec son motif ; pas une résolution votée', () => {
    expect(reporterResolution(creerResolution(saisie()), 'Devis complémentaires attendus')).toMatchObject({
      etat: 'reportee',
      motifReport: 'Devis complémentaires attendus',
    })
    expect(() => reporterResolution(voterResolution(creerResolution(saisie()), vote({ pour: 6_000 })), 'x')).toThrow(/voter/i)
  })

  it('refuse de voter deux fois, ou un second vote sans premier vote qui l’ouvre', () => {
    const adoptee = voterResolution(creerResolution(saisie()), vote({ pour: 6_000 }))
    expect(() => voterResolution(adoptee, vote())).toThrow(/voter/i)
    expect(() => voterSecondVote(adoptee, vote())).toThrow(/second vote/i)
    expect(() => voterSecondVote(creerResolution(saisie()), vote())).toThrow(/second vote/i)
  })

  it('l’en-tête date la relecture et signale les deux énoncés du calculateur à corriger', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'resolutions-ag.ts'), 'utf8')
    expect(source).toMatch(/Légifrance le 29\/10\/2026/)
    expect(source).toMatch(/majorites-ag\.ts/)
    expect(source).toMatch(/art\. 25-1 annonce une nouvelle assemblée sous le tiers pour toute décision/)
    expect(source).toMatch(/26-1 compte la moitié sur tous les membres/)
  })

  it('les messages disent l’état en clair', () => {
    const adoptee = voterResolution(creerResolution(saisie()), vote({ pour: 6_000 }))
    expect(() => reporterResolution(adoptee, 'x')).toThrow(/elle est adoptée/)
  })
})
