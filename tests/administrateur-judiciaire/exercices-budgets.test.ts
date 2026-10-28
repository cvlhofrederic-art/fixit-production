import { describe, expect, it } from 'vitest'
import {
  STATUTS_EXERCICE,
  STATUTS_IRC,
  changerStatutExercice,
  creerBudget,
  creerExercice,
  realiseBudget,
  type SaisieExercice,
} from '@/lib/administrateur-judiciaire/domain/exercices-budgets'

/**
 * Exercices et budgets (cartographie Gestéam, tranches 25 et 27 ; D1 : exercices et budgets au SYNDICAT).
 * - Six statuts d'exercice ; cycle Préparation → Budgété → Voté → Répart. en cours → Réparti ; « Non géré » à part.
 * - « Voté » exige l'assemblée qui approuve et la résolution du budget.
 * - Budget = lignes (clé, compte, rubrique) → prévu ; réalisé lu sur les mouvements ; alerte de dépassement réglable.
 */

const saisie = (surcharge: Partial<SaisieExercice> = {}): SaisieExercice => ({
  coproprieteId: 'copro-tilleuls',
  nom: '2026',
  ouverture: '2026-01-01',
  cloture: '2026-12-31',
  statut: 'Préparation',
  statutIrc: 'Non déclaré',
  agId: null,
  resolutions: { budget: null, complement: null, honoraires: null, travaux: null },
  ...surcharge,
})

describe('exercices — référentiels et création', () => {
  it('reprend les statuts d’exercice et d’immatriculation de Gestéam', () => {
    expect(STATUTS_EXERCICE).toEqual(['Préparation', 'Budgété', 'Voté', 'Répart. en cours', 'Réparti', 'Non géré'])
    expect(STATUTS_IRC).toEqual(['Non déclaré', 'Commencé', 'Validé', 'Transmis', 'Déclaré', 'En erreur'])
  })

  it('crée un exercice rattaché au syndicat', () => {
    expect(creerExercice(saisie())).toMatchObject({ coproprieteId: 'copro-tilleuls', nom: '2026', statut: 'Préparation' })
  })

  it('refuse une clôture avant l’ouverture, des dates invalides, un statut inconnu, un syndicat absent', () => {
    expect(() => creerExercice(saisie({ cloture: '2025-12-31' }))).toThrow(/cl[ôo]ture/i)
    expect(() => creerExercice(saisie({ ouverture: '01/01/2026' }))).toThrow(/date/i)
    expect(() => creerExercice(saisie({ statut: 'Clos' as never }))).toThrow(/statut/i)
    expect(() => creerExercice(saisie({ statutIrc: 'Envoyé' as never }))).toThrow(/IRC/)
    expect(() => creerExercice(saisie({ coproprieteId: '' }))).toThrow(/syndicat/i)
  })
})

describe('exercices — cycle de statut', () => {
  it('avance d’une étape, sans modifier l’exercice d’origine', () => {
    const exercice = creerExercice(saisie())
    expect(changerStatutExercice(exercice, 'Budgété').statut).toBe('Budgété')
    expect(exercice.statut).toBe('Préparation')
  })

  it('refuse de sauter une étape ou de revenir en arrière', () => {
    expect(() => changerStatutExercice(creerExercice(saisie()), 'Voté')).toThrow(/étape/i)
    expect(() => changerStatutExercice(creerExercice(saisie({ statut: 'Voté', agId: 'ag-1', resolutions: { ...saisie().resolutions, budget: 'R4' } })), 'Budgété')).toThrow(/étape/i)
  })

  it('« Voté » exige l’assemblée et la résolution du budget', () => {
    const budgete = creerExercice(saisie({ statut: 'Budgété' }))
    expect(() => changerStatutExercice(budgete, 'Voté')).toThrow(/assembl/i)
    expect(() => changerStatutExercice(budgete, 'Voté', { agId: 'ag-1' })).toThrow(/r[ée]solution/i)
    expect(changerStatutExercice(budgete, 'Voté', { agId: 'ag-1', resolutionBudget: 'Résolution 4' })).toMatchObject({
      statut: 'Voté',
      agId: 'ag-1',
      resolutions: { budget: 'Résolution 4' },
    })
  })

  it('« Non géré » seulement depuis « Préparation » (exercice antérieur au mandat)', () => {
    expect(changerStatutExercice(creerExercice(saisie()), 'Non géré').statut).toBe('Non géré')
    expect(() => changerStatutExercice(creerExercice(saisie({ statut: 'Budgété' })), 'Non géré')).toThrow(/Non géré/)
  })
})

describe('budgets — lignes, prévu et réalisé', () => {
  const lignes = [
    { cle: '001 Générales', compte: '61500', rubrique: '460', prevuCentimes: 300_000 },
    { cle: '001 Générales', compte: '60200', rubrique: '230', prevuCentimes: 120_000 },
    { cle: '002 Ascenseur', compte: '61400', rubrique: '401', prevuCentimes: 200_000 },
  ]

  it('crée un budget : total prévu, une seule ligne par (clé, compte, rubrique)', () => {
    expect(creerBudget(lignes).totalPrevuCentimes).toBe(620_000)
    expect(() => creerBudget([...lignes, { ...lignes[0], prevuCentimes: 1 }])).toThrow(/doublon/i)
    expect(() => creerBudget([{ ...lignes[0], prevuCentimes: -1 }])).toThrow(/montant/i)
    expect(() => creerBudget([{ ...lignes[0], compte: '615' }])).toThrow(/compte/i)
  })

  it('réalisé = débits − crédits des mouvements de la ligne ; écart et taux ; alerte au-delà du seuil', () => {
    const budget = creerBudget(lignes)
    const mouvements = [
      { compte: 'TILL.61500.00000.0', cle: '001 Générales', rubrique: '460', sens: 'debit' as const, montantCentimes: 250_000 },
      { compte: 'TILL.61500.00000.0', cle: '001 Générales', rubrique: '460', sens: 'debit' as const, montantCentimes: 40_000 },
      { compte: 'TILL.60200.00000.0', cle: '001 Générales', rubrique: '230', sens: 'debit' as const, montantCentimes: 60_000 },
      { compte: 'TILL.60200.00000.0', cle: '001 Générales', rubrique: '230', sens: 'credit' as const, montantCentimes: 5_000 },
    ]
    const resultat = realiseBudget(budget, mouvements, { seuilAlertePct: 90 })
    expect(resultat.lignes.map((l) => [l.compte, l.realiseCentimes, l.ecartCentimes, l.tauxPct, l.alerte])).toEqual([
      ['61500', 290_000, 10_000, 96.7, true],
      ['60200', 55_000, 65_000, 45.8, false],
      ['61400', 0, 200_000, 0, false],
    ])
    expect(resultat.totalRealiseCentimes).toBe(345_000)
    expect(resultat.horsBudget).toEqual([])
  })

  it('isole les mouvements sans ligne de budget', () => {
    const resultat = realiseBudget(creerBudget(lignes), [
      { compte: 'TILL.62300.00000.0', cle: '001 Générales', rubrique: '620', sens: 'debit', montantCentimes: 18_000 },
    ])
    expect(resultat.horsBudget).toEqual([{ cle: '001 Générales', compte: '62300', rubrique: '620', realiseCentimes: 18_000 }])
  })
})
