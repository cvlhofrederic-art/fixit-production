import { describe, expect, it } from 'vitest'
import {
  creerOperationTravaux,
  echeancesTravaux,
  retenueGarantie,
  type SaisieOperationTravaux,
} from '@/lib/administrateur-judiciaire/domain/travaux-operations'

/**
 * Opération de travaux (cartographie Gestéam, tranche 32) : décision d'AG, budget TTC, clé, appels en tranches,
 * financement par le fonds de travaux, retenue de garantie.
 * - Les appels de travaux exigent la décision d'assemblée (date et résolution).
 * - Tranches : pourcentages du montant à appeler (budget − part du fonds de travaux), au centime près.
 * - Part du fonds de travaux : contrôlée par fonds-travaux.ts (J4 : travaux votés, décision d'AG requise).
 * - Retenue de garantie : 5 % au plus (loi n° 71-584, art. 1er), libérée un an après la réception sauf opposition.
 */

const saisie = (surcharge: Partial<SaisieOperationTravaux> = {}): SaisieOperationTravaux => ({
  numero: '00042',
  coproprieteId: 'copro-tilleuls',
  libelle: 'Ravalement façade rue',
  cleId: 'cle-001',
  decision: { date: '2026-03-12', resolution: 'Résolution 8' },
  budgetTtcCentimes: 12_000_000,
  financementFondsTravauxCentimes: 2_000_000,
  tranches: [
    { date: '2026-05-01', tauxPct: 30 },
    { date: '2026-08-01', tauxPct: 40 },
    { date: '2026-11-01', tauxPct: 30 },
  ],
  ...surcharge,
})

describe('opération de travaux — création', () => {
  it('crée l’opération votée', () => {
    expect(creerOperationTravaux(saisie()).montantAAppelerCentimes).toBe(10_000_000)
  })

  it('refuse : tranches au-delà de 100 %, fonds supérieur au budget, montant invalide, n° d’opération mal formé', () => {
    expect(() => creerOperationTravaux(saisie({ tranches: [{ date: '2026-05-01', tauxPct: 60 }, { date: '2026-06-01', tauxPct: 50 }] }))).toThrow(/100/)
    expect(() => creerOperationTravaux(saisie({ financementFondsTravauxCentimes: 13_000_000 }))).toThrow(/fonds/i)
    expect(() => creerOperationTravaux(saisie({ budgetTtcCentimes: 0 }))).toThrow(/budget/i)
    expect(() => creerOperationTravaux(saisie({ numero: '42' }))).toThrow(/num[ée]ro/i)
  })
})

describe('appels de travaux en tranches', () => {
  it('une échéance « travaux » par tranche, sur le montant à appeler, au centime près', () => {
    expect(echeancesTravaux(creerOperationTravaux(saisie()))).toEqual([
      { id: '00042-T1', coproprieteId: 'copro-tilleuls', cleId: 'cle-001', exigibilite: '2026-05-01', libelle: 'Ravalement façade rue — appel n° 1 (30 %)', montantCentimes: 3_000_000, nature: 'travaux', compteContrepartie: '70200' },
      { id: '00042-T2', coproprieteId: 'copro-tilleuls', cleId: 'cle-001', exigibilite: '2026-08-01', libelle: 'Ravalement façade rue — appel n° 2 (40 %)', montantCentimes: 4_000_000, nature: 'travaux', compteContrepartie: '70200' },
      { id: '00042-T3', coproprieteId: 'copro-tilleuls', cleId: 'cle-001', exigibilite: '2026-11-01', libelle: 'Ravalement façade rue — appel n° 3 (30 %)', montantCentimes: 3_000_000, nature: 'travaux', compteContrepartie: '70200' },
    ])
  })

  it('quand les tranches font 100 %, la dernière absorbe l’arrondi', () => {
    const op = creerOperationTravaux(saisie({ budgetTtcCentimes: 1_001, financementFondsTravauxCentimes: 0, tranches: [{ date: '2026-05-01', tauxPct: 33.33 }, { date: '2026-06-01', tauxPct: 33.33 }, { date: '2026-07-01', tauxPct: 33.34 }] }))
    const montants = echeancesTravaux(op).map((e) => e.montantCentimes)
    expect(montants.reduce((s, m) => s + m, 0)).toBe(1_001)
  })

  it('refuse d’appeler sans décision d’assemblée', () => {
    expect(() => echeancesTravaux(creerOperationTravaux(saisie({ decision: null })))).toThrow(/assembl/i)
  })
})

describe('retenue de garantie', () => {
  it('5 % au plus du TTC, libérée un an après la réception', () => {
    expect(retenueGarantie({ montantTtcCentimes: 1_000_000, tauxPct: 5, dateReception: '2026-11-15' })).toEqual({
      retenueCentimes: 50_000,
      netAPayerCentimes: 950_000,
      liberationLe: '2027-11-15',
    })
  })

  it('refuse un taux supérieur à 5 % ; sans réception, pas de date de libération', () => {
    expect(() => retenueGarantie({ montantTtcCentimes: 1_000_000, tauxPct: 6, dateReception: null })).toThrow(/5 %/)
    expect(retenueGarantie({ montantTtcCentimes: 1_000_000, tauxPct: 5, dateReception: null }).liberationLe).toBeNull()
  })
})
