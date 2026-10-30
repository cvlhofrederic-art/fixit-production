import { describe, expect, it } from 'vitest'
import { echeancesBudget, modalitesParDefaut } from '@/lib/administrateur-judiciaire/domain/appels-budget'
import { creerBudget, creerExercice, type SaisieExercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import { creerCompteCoproprietaire, creerPosition } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { avisDAppel, creerCleRepartition } from '@/lib/administrateur-judiciaire/domain/repartition-appels'

/**
 * Échéancier des appels du budget (point 18 du bilan 2 ; Gestéam, tranche 43 § 9 : quatre appels trimestriels égaux au
 * quart du budget). L. 1965 art. 14-1, I (relu sur Légifrance le 29/10/2026) : provisions égales au quart du budget
 * VOTÉ, exigibles le premier jour de chaque trimestre, sauf modalités différentes fixées par l'assemblée.
 */

const exercice = (surcharge: Partial<SaisieExercice> = {}) =>
  creerExercice({
    coproprieteId: 'copro-1',
    nom: '2026',
    ouverture: '2026-01-01',
    cloture: '2026-12-31',
    statut: 'Voté',
    statutIrc: 'Non déclaré',
    agId: 'AG-2026',
    resolutions: { budget: '4', complement: null, honoraires: null, travaux: null },
    ...surcharge,
  })

const cle001 = creerCleRepartition({
  id: 'cle-001',
  coproprieteId: 'copro-1',
  code: '001',
  libelle: 'Charges communes générales',
  lots: [
    { lotId: 'lot-1', tantiemes: 500 },
    { lotId: 'lot-2', tantiemes: 500 },
  ],
})
const cle002 = creerCleRepartition({ id: 'cle-002', coproprieteId: 'copro-1', code: '002', libelle: 'Ascenseur', lots: [{ lotId: 'lot-2', tantiemes: 1 }] })
const cles = [cle001, cle002]

const budget = creerBudget([
  { cle: '001', compte: '60100', rubrique: 'Eau froide', prevuCentimes: 290_000 },
  { cle: '001', compte: '61500', rubrique: 'Entretien', prevuCentimes: 50_000 },
  { cle: '001', compte: '61600', rubrique: 'Assurance', prevuCentimes: 90_000 },
  { cle: '001', compte: '62100', rubrique: 'Honoraires', prevuCentimes: 397_000 },
  { cle: '001', compte: '60610', rubrique: 'Électricité', prevuCentimes: 50_000 },
  { cle: '001', compte: '62200', rubrique: 'Débours', prevuCentimes: 30_000 },
])

describe('modalités par défaut', () => {
  it('quatre provisions, le premier jour de chaque trimestre d’un exercice de douze mois', () => {
    expect(modalitesParDefaut(exercice())).toEqual({ nombre: 4, premiereLe: '2026-01-01', tousLesMois: 3, decision: null })
  })

  it('exercice d’une autre durée : les modalités votées sont exigées', () => {
    expect(() => modalitesParDefaut(exercice({ nom: '2026-2027', ouverture: '2026-01-01', cloture: '2027-06-30' }))).toThrow(/douze mois/)
    expect(() => modalitesParDefaut(exercice({ ouverture: '2026-04-01', cloture: '2026-12-31' }))).toThrow(/douze mois/)
  })
})

describe('échéances du budget', () => {
  it('quatre provisions égales au quart du budget, une échéance « budget » par clé (identifiant de la clé), au compte 70100', () => {
    expect(echeancesBudget({ exercice: exercice(), budget, cles })).toEqual([
      { id: 'B-2026-001-1', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-01-01', libelle: 'Budget 2026 — provision 1/4 (clé 001)', montantCentimes: 226_750, nature: 'budget', compteContrepartie: '70100' },
      { id: 'B-2026-001-2', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-04-01', libelle: 'Budget 2026 — provision 2/4 (clé 001)', montantCentimes: 226_750, nature: 'budget', compteContrepartie: '70100' },
      { id: 'B-2026-001-3', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-07-01', libelle: 'Budget 2026 — provision 3/4 (clé 001)', montantCentimes: 226_750, nature: 'budget', compteContrepartie: '70100' },
      { id: 'B-2026-001-4', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-10-01', libelle: 'Budget 2026 — provision 4/4 (clé 001)', montantCentimes: 226_750, nature: 'budget', compteContrepartie: '70100' },
    ])
  })

  it('s’enchaîne avec l’avis d’appel : aucune clé inconnue, la somme des quotes-parts égale la provision', () => {
    const comptes = [
      creerCompteCoproprietaire({ id: 'cpt-A', coproprieteId: 'copro-1', serie: '1', libelle: 'A' }),
      creerCompteCoproprietaire({ id: 'cpt-B', coproprieteId: 'copro-1', serie: '2', libelle: 'B' }),
    ]
    const positions = [
      creerPosition({ id: 'p1', identiteId: 'i1', lotId: 'lot-1', compteId: 'cpt-A', qualite: 'Copropriétaire', part: { numerateur: 1, denominateur: 1 }, statut: 'En place', dateEntree: '2020-01-01', dateSortie: null }),
      creerPosition({ id: 'p2', identiteId: 'i2', lotId: 'lot-2', compteId: 'cpt-B', qualite: 'Copropriétaire', part: { numerateur: 1, denominateur: 1 }, statut: 'En place', dateEntree: '2020-01-01', dateSortie: null }),
    ]
    const impair = creerBudget([{ cle: '001', compte: '61500', rubrique: 'Entretien', prevuCentimes: 100_001 }])
    const avis = avisDAppel({ echeances: echeancesBudget({ exercice: exercice(), budget: impair, cles }), cles, positions, comptes })
    expect(avis.anomalies).toEqual([])
    expect(avis.parCompte.reduce((s, c) => s + c.totalAppeleCentimes, 0)).toBe(100_001)
  })

  it('au centime près : la somme des provisions égale le budget de la clé', () => {
    const impair = creerBudget([{ cle: '001', compte: '61500', rubrique: 'Entretien', prevuCentimes: 1_001 }])
    expect(echeancesBudget({ exercice: exercice(), budget: impair, cles }).map((e) => e.montantCentimes)).toEqual([251, 250, 250, 250])
  })

  it('plusieurs clés : chacune ses provisions, triées par date puis par clé ; une clé sans montant ne donne rien', () => {
    const deuxCles = creerBudget([
      { cle: '002', compte: '61500', rubrique: 'Ascenseur', prevuCentimes: 40_000 },
      { cle: '001', compte: '61500', rubrique: 'Entretien', prevuCentimes: 80_000 },
      { cle: '003', compte: '61500', rubrique: 'Parking', prevuCentimes: 0 },
    ])
    const echeances = echeancesBudget({ exercice: exercice(), budget: deuxCles, cles })
    expect(echeances.map((e) => `${e.exigibilite} ${e.cleId} ${e.montantCentimes}`).slice(0, 4)).toEqual([
      '2026-01-01 cle-001 20000',
      '2026-01-01 cle-002 10000',
      '2026-04-01 cle-001 20000',
      '2026-04-01 cle-002 10000',
    ])
    expect(echeances).toHaveLength(8)
  })

  it('exercice ouvert le 1er mai : les trimestres de l’exercice (la lecture civile donnerait le 1er juillet, etc.)', () => {
    const decale = exercice({ nom: '2026-2027', ouverture: '2026-05-01', cloture: '2027-04-30' })
    expect(echeancesBudget({ exercice: decale, budget, cles }).map((e) => e.exigibilite)).toEqual(['2026-05-01', '2026-08-01', '2026-11-01', '2027-02-01'])
  })

  it('modalités fixées par l’assemblée, avec leur décision : par exemple douze provisions mensuelles', () => {
    const mensuel = echeancesBudget({
      exercice: exercice(),
      budget,
      cles,
      modalites: { nombre: 12, premiereLe: '2026-01-05', tousLesMois: 1, decision: 'AG du 12/03/2026, résolution 5' },
    })
    expect(mensuel).toHaveLength(12)
    expect(mensuel[11]).toMatchObject({ exigibilite: '2026-12-05', libelle: 'Budget 2026 — provision 12/12 (clé 001)' })
    expect(mensuel.reduce((s, e) => s + e.montantCentimes, 0)).toBe(907_000)
  })

  it('refuse : budget non voté, modalités sans décision, clé inconnue, modalités invalides, provision hors de l’exercice', () => {
    for (const statut of ['Préparation', 'Budgété', 'Non géré'] as const)
      expect(() => echeancesBudget({ exercice: exercice({ statut }), budget, cles })).toThrow(/non voté/)
    expect(() => echeancesBudget({ exercice: exercice({ resolutions: { budget: null, complement: null, honoraires: null, travaux: null } }), budget, cles })).toThrow(/non voté/)
    expect(() => echeancesBudget({ exercice: exercice(), budget, cles, modalites: { nombre: 12, premiereLe: '2026-01-05', tousLesMois: 1 } })).toThrow(/décision/)
    expect(() => echeancesBudget({ exercice: exercice(), budget, cles: [cle002] })).toThrow(/Clé « 001 »/)
    const decision = 'AG du 12/03/2026, résolution 5'
    expect(() => echeancesBudget({ exercice: exercice(), budget, cles, modalites: { nombre: 0, premiereLe: '2026-01-01', tousLesMois: 3, decision } })).toThrow(/nombre/i)
    expect(() => echeancesBudget({ exercice: exercice(), budget, cles, modalites: { nombre: 4, premiereLe: '2026-01-01', tousLesMois: 0, decision } })).toThrow(/mois/i)
    expect(() => echeancesBudget({ exercice: exercice(), budget, cles, modalites: { nombre: 4, premiereLe: '01/01/2026', tousLesMois: 3, decision } })).toThrow(/AAAA-MM-JJ/)
    expect(() => echeancesBudget({ exercice: exercice(), budget, cles, modalites: { nombre: 4, premiereLe: '2026-04-01', tousLesMois: 3, decision } })).toThrow(/exercice/i)
  })
})
