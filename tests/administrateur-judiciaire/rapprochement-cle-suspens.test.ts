import { describe, expect, it } from 'vitest'
import { cleDeRapprochement, payeurEstUnTiers, proposerImputations, type LigneReleve } from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import { suspensA, type ElementRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'

/**
 * Rapprochement : clé conservée, payeur, suspens à une date (point 40 du bilan 2 ; Gestéam, tranche 43 § 2 : le virement
 * reçu par fichier bancaire garde dans ses notes la trace du rapprochement automatique — syndicat, immeuble, compte, tiers
 * retrouvés — et le libellé de la pièce peut nommer un autre payeur que le copropriétaire crédité ; § 20 : particularité
 * « mouvements bancaires en suspens à une date »).
 */

const ligne = (libelle: string, montant: number): LigneReleve => ({ date: '2026-10-05', libelle, montant })
const coproprietaires = [
  { nom: 'Durand Claire', solde: -350, compteId: 'cpt-12', coproprieteId: 'copro-tilleuls', mandatId: 'm-1' },
  { nom: 'Martin Paul', solde: -120, compteId: 'cpt-14', coproprieteId: 'copro-tilleuls', mandatId: 'm-1' },
]

describe('clé de rapprochement', () => {
  it('garde la règle, la confiance et le compte, la copropriété et le mandat retrouvés', () => {
    const [proposition] = proposerImputations([ligne('VIR SEPA DURAND CLAIRE CHARGES T4', 350)], coproprietaires)
    expect(cleDeRapprochement(proposition)).toEqual({
      regle: 'Nom complet dans le libellé · montant égal au solde dû.',
      confiance: 'forte',
      compteId: 'cpt-12',
      coproprieteId: 'copro-tilleuls',
      mandatId: 'm-1',
      payeur: null,
      payeurTiers: false,
    })
  })

  it('aucune clé sans candidat retenu ; champs absents du candidat : null', () => {
    const [sansCandidat] = proposerImputations([ligne('VIR SEPA INCONNU', 80)], coproprietaires)
    expect(cleDeRapprochement(sansCandidat)).toBeNull()
    const [partiel] = proposerImputations([ligne('VIR MARTIN', 50)], [{ nom: 'Martin Paul', solde: -120 }])
    expect(cleDeRapprochement(partiel)).toMatchObject({ confiance: 'probable', compteId: null, coproprieteId: null, mandatId: null })
  })

  it('un payeur qui n’est pas le copropriétaire crédité est marqué « tiers »', () => {
    const [proposition] = proposerImputations([ligne('VIR SEPA DURAND CLAIRE', 350)], coproprietaires)
    expect(cleDeRapprochement(proposition, { payeur: ' Notaire Lefèvre ' })).toMatchObject({ payeur: 'Notaire Lefèvre', payeurTiers: true })
    expect(cleDeRapprochement(proposition, { payeur: 'MME DURAND' })).toMatchObject({ payeur: 'MME DURAND', payeurTiers: false })
  })
})

describe('payeur et copropriétaire crédité', () => {
  it('tiers si aucun mot significatif du nom crédité ne se retrouve dans le payeur', () => {
    expect(payeurEstUnTiers('SCI LES PINS', 'Durand Claire')).toBe(true)
    expect(payeurEstUnTiers('M. et Mme DURAND', 'Durand Claire')).toBe(false)
    expect(payeurEstUnTiers('Durand-Martin Claire', 'Durand Claire')).toBe(false)
    expect(payeurEstUnTiers(null, 'Durand Claire')).toBe(false)
    expect(payeurEstUnTiers('  ', 'Durand Claire')).toBe(false)
  })
})

describe('suspens à une date', () => {
  const el = (id: string, cote: 'banque' | 'compta', montantCentimes: number, date: string, rapproche: ElementRapprochement['rapproche'], rapprocheLe: string | null = null): ElementRapprochement => ({
    id,
    cote,
    montantCentimes,
    date,
    rapproche,
    rapprocheLe,
  })
  const elements = [
    el('b1', 'banque', 25_000, '2026-10-01', 'auto', '2026-10-03'),
    el('b2', 'banque', -10_000, '2026-10-02', false),
    el('b3', 'banque', 8_000, '2026-10-05', 'manuel', '2026-10-20'),
    el('c1', 'compta', 25_000, '2026-09-30', 'auto', '2026-10-03'),
    el('c2', 'compta', -40_000, '2026-10-12', false),
  ]

  it('opérés au plus tard ce jour et non encore rapprochés à cette date, par côté, avec leurs totaux', () => {
    expect(suspensA(elements, '2026-10-02')).toEqual({
      banque: [elements[0], elements[1]],
      compta: [elements[3]],
      totalBanqueCentimes: 15_000,
      totalComptaCentimes: 25_000,
    })
    const au10 = suspensA(elements, '2026-10-10')
    expect(au10.banque.map((e) => e.id)).toEqual(['b2', 'b3'])
    expect(au10.compta).toEqual([])
    const au20 = suspensA(elements, '2026-10-20')
    expect(au20.banque.map((e) => e.id)).toEqual(['b2'])
    expect(au20.compta.map((e) => e.id)).toEqual(['c2'])
    expect(au20.totalComptaCentimes).toBe(-40_000)
  })

  it('le jour du rapprochement, l’élément n’est plus en suspens', () => {
    expect(suspensA(elements, '2026-10-03').banque.map((e) => e.id)).toEqual(['b2'])
  })

  it('un élément rapproché sans date de rapprochement est refusé : sa contrepartie a pu être enregistrée plus tard', () => {
    const pointes = [el('b9', 'banque', 1_000, '2026-10-05', 'manuel'), el('c9', 'compta', 1_000, '2026-10-15', 'manuel')]
    expect(() => suspensA(pointes, '2026-10-10')).toThrow(/b9.*date de rapprochement/)
    const dates = [el('b9', 'banque', 1_000, '2026-10-05', 'manuel', '2026-10-15'), el('c9', 'compta', 1_000, '2026-10-15', 'manuel', '2026-10-15')]
    expect(suspensA(dates, '2026-10-10')).toMatchObject({ banque: [dates[0]], compta: [], totalBanqueCentimes: 1_000 })
  })

  it('refuse une date invalide, un élément sans date d’opération ou rapproché avant d’être opéré', () => {
    expect(() => suspensA(elements, '02/10/2026')).toThrow(/AAAA-MM-JJ/)
    expect(() => suspensA([{ id: 'x', cote: 'banque', montantCentimes: 1, rapproche: false }], '2026-10-02')).toThrow(/x.*date d'opération/)
    expect(() => suspensA([el('y', 'banque', 1, '2026-10-05', 'auto', '2026-10-04')], '2026-10-06')).toThrow(/y.*antérieur/)
  })
})
