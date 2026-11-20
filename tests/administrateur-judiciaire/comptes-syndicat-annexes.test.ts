import { describe, expect, it } from 'vitest'
import {
  annexesComptesSyndicat,
  type Colonnes,
  type ComptesSyndicatAnnexes,
  type EntreeAnnexes,
  type GroupeCleAnnexe4,
  type LigneEtatFinancier,
  type LigneGestion,
  type MontantsAnnexe4,
  type PartieGestion,
} from '@/lib/administrateur-judiciaire/domain/comptes-syndicat-annexes'
import { creerBudget, type Budget } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import { creerTraitement, type FamilleTraitement, type LigneMouvement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import {
  changerStatutOperationTravaux,
  constaterRepartitionOperation,
  creerOperationTravaux,
  repriseSoldeTravauxALOuverture,
  virementProvisionsTravauxALaRealisation,
} from '@/lib/administrateur-judiciaire/domain/travaux-operations'
import { enTeteDuModule } from './en-tete-module'

/**
 * Annexes 1 à 5 des comptes du syndicat (décret n° 2005-240 du 14 mars 2005, art. 8 à 10 et annexes, modèles du JO
 * n° 65 du 18/03/2005 complétés par les décrets n° 2016-1914 et n° 2020-1229 ; arrêté du 14 mars 2005).
 *
 * Syndicat FICTIF « Résidence des Tilleuls » (segment TILL), trois copropriétaires A, B, C (500, 300 et 200 tantièmes),
 * trois catégories de charges (GEN, ASC, BATA). Deux exercices civils :
 * - 2025, premier exercice (pas de comparatif) : budget de 8 000 €, charges réalisées 8 300 €, produit divers 100 € →
 *   insuffisance de 200 € répartie ; fonds de travaux appelé 400 € ; ravalement n° 00042 voté le 15/06/2025 (20 000 €,
 *   400 € pris sur le fonds de travaux, deux tranches de 9 800 €) : situation 1 de 6 000 €, subvention de 1 500 € notifiée,
 *   5 000 € payés ; solde de l'opération passé au 12 en fin d'exercice (400 €) ;
 * - 2026 : reprise du 12 à l'ouverture ; budget de 8 400 €, charges réalisées 8 310 € (dont 10 € d'agios), indemnité
 *   d'assurance 200 € → excédent de 290 € réparti ; situation 2 du ravalement 13 000 €, subvention reçue et constatée ;
 *   diagnostic technique global n° 00043 (étude, 3 000 € votés, 2 800 € réalisés) clôturé et réparti en octobre ; créance
 *   de C passée en créance douteuse puis dépréciée de 3 000 € (opération exceptionnelle répartie) ; B paie 1 000 €
 *   d'avance ; solde du ravalement passé au 12 (1 900 €).
 * Chaque montant attendu est recalculé à la main dans le commentaire qui le précède.
 */

// ─── Données fictives ─────────────────────────────────────────────────────────────────────────

const cpt = (plan: string, auxiliaire = '00000') => `TILL.${plan}.${auxiliaire}.0`
const BQ = cpt('51200')
const A = cpt('45000', '00001')
const B = cpt('45000', '00002')
const C = cpt('45000', '00003')
const FT = cpt('10500')
const P701 = cpt('70100')
const F = (code: string) => cpt('40100', code)

type Extra = { cle?: string; op?: string }
type Ligne = [compte: string, sens: 'debit' | 'credit', montantCentimes: number, extra?: Extra]

const ligne = ([compte, sens, montantCentimes, extra]: Ligne): LigneMouvement => ({
  compte,
  sens,
  montantCentimes,
  ...(extra?.cle ? { attributs: { cle: extra.cle } } : {}),
  ...(extra?.op ? { liens: { travauxId: extra.op } } : {}),
})
const t = (id: string, famille: FamilleTraitement, date: string, lignes: Ligne[]): Traitement =>
  creerTraitement({ id, famille, date, mouvements: lignes.map(ligne) })

const GEN = { cle: 'GEN' }
const ASC = { cle: 'ASC' }
const OP42 = { op: '00042' }
const GEN42 = { cle: 'GEN', op: '00042' }
const OP43 = { op: '00043' }
const GEN43 = { cle: 'GEN', op: '00043' }

const op42 = creerOperationTravaux({
  numero: '00042',
  coproprieteId: 'copro-tilleuls-fictive',
  libelle: 'Ravalement des façades',
  cleId: 'GEN',
  decision: { date: '2025-06-15', resolution: 'Résolution 12' },
  budgetTtcCentimes: 2_000_000,
  financementFondsTravauxCentimes: 40_000,
  affectationFonds: { objet: 'travaux_hors_ppt' },
  tranches: [
    { date: '2025-09-01', tauxPct: 50 },
    { date: '2026-03-01', tauxPct: 50 },
  ],
})
const op42Termine = changerStatutOperationTravaux(op42, 'Terminé', { le: '2026-07-15', motif: 'Réception des travaux le 15/07/2026' })

const op43 = creerOperationTravaux({
  numero: '00043',
  coproprieteId: 'copro-tilleuls-fictive',
  libelle: 'Diagnostic technique global',
  etude: true,
  cleId: 'GEN',
  decision: { date: '2026-03-10', resolution: 'Résolution 5' },
  budgetTtcCentimes: 300_000,
  financementFondsTravauxCentimes: 0,
  affectationFonds: null,
  tranches: [{ date: '2026-04-01', tauxPct: 100 }],
})

const vir = (id: string, op: typeof op42, date: string, chargeCentimes: number, solde102Centimes: number): Traitement => {
  const { traitement } = virementProvisionsTravauxALaRealisation(op, { id, date, segmentSyndicat: 'TILL', chargeCentimes, solde102Centimes })
  if (!traitement) throw new Error('virement attendu')
  return traitement
}

const solde12En2025 = t('25-solde-12', 'Saisie de mouvements', '2025-12-31', [
  [cpt('67100', '00042'), 'credit', 600_000, OP42],
  [cpt('70200', '00042'), 'debit', 600_000, OP42],
  [cpt('70500', '00042'), 'debit', 40_000, OP42],
  [cpt('12000', '00042'), 'credit', 40_000, OP42],
])

const traitements2025: Traitement[] = [
  t('25-appel-budget', 'Appel de fonds', '2025-01-01', [[A, 'debit', 400_000], [B, 'debit', 240_000], [C, 'debit', 160_000], [P701, 'credit', 800_000]]),
  t('25-appel-ft', 'Appel de fonds', '2025-01-01', [[A, 'debit', 20_000], [B, 'debit', 12_000], [C, 'debit', 8_000], [FT, 'credit', 40_000]]),
  t('25-enc-a', 'Encaissement', '2025-02-01', [[BQ, 'debit', 420_000], [A, 'credit', 420_000]]),
  t('25-enc-b', 'Encaissement', '2025-02-01', [[BQ, 'debit', 252_000], [B, 'credit', 252_000]]),
  t('25-enc-c', 'Encaissement', '2025-03-01', [[BQ, 'debit', 100_000], [C, 'credit', 100_000]]),
  t('25-fact-elec', 'Saisie de factures', '2025-03-31', [[cpt('60200'), 'debit', 110_000, GEN], [F('ELECX'), 'credit', 110_000]]),
  t('25-regl-elec', 'Règlement de factures', '2025-04-15', [[F('ELECX'), 'debit', 110_000], [BQ, 'credit', 110_000]]),
  t('25-fact-assur', 'Saisie de factures', '2025-04-30', [[cpt('61600'), 'debit', 200_000, GEN], [F('ASSUR'), 'credit', 200_000]]),
  t('25-regl-assur', 'Règlement de factures', '2025-05-15', [[F('ASSUR'), 'debit', 200_000], [BQ, 'credit', 200_000]]),
  t('25-fact-asc', 'Saisie de factures', '2025-06-30', [[cpt('61400'), 'debit', 220_000, ASC], [F('ASCEN'), 'credit', 220_000]]),
  t('25-regl-asc', 'Règlement de factures', '2025-07-15', [[F('ASCEN'), 'debit', 220_000], [BQ, 'credit', 220_000]]),
  t('25-appel-t1', 'Appel de fonds', '2025-09-01', [[A, 'debit', 490_000], [B, 'debit', 294_000], [C, 'debit', 196_000], [cpt('10200', '00042'), 'credit', 980_000, OP42]]),
  t('25-enc-t1-a', 'Encaissement', '2025-09-20', [[BQ, 'debit', 490_000], [A, 'credit', 490_000]]),
  t('25-enc-t1-b', 'Encaissement', '2025-09-20', [[BQ, 'debit', 294_000], [B, 'credit', 294_000]]),
  t('25-produit-divers', 'Saisie de mouvements', '2025-10-01', [[BQ, 'debit', 10_000], [cpt('71400'), 'credit', 10_000, GEN]]),
  t('25-fact-raval-1', 'Saisie de factures', '2025-11-15', [[cpt('67100', '00042'), 'debit', 600_000, GEN42], [F('RAVAL'), 'credit', 600_000, OP42]]),
  vir('25-vir-1', op42, '2025-11-15', 600_000, 980_000),
  t('25-affect-ft', 'Saisie de mouvements', '2025-11-20', [[FT, 'debit', 40_000], [cpt('70500', '00042'), 'credit', 40_000, GEN42]]),
  t('25-subv-notif', 'Saisie de mouvements', '2025-12-01', [[cpt('44100', 'SUBV1'), 'debit', 150_000, OP42], [cpt('13100', '00042'), 'credit', 150_000, OP42]]),
  t('25-regl-raval', 'Règlement de factures', '2025-12-10', [[F('RAVAL'), 'debit', 500_000, OP42], [BQ, 'credit', 500_000]]),
  t('25-fact-syndic', 'Saisie de factures', '2025-12-31', [[cpt('62110'), 'debit', 300_000, GEN], [F('SYNDC'), 'credit', 300_000]]),
  t('25-repartition', 'Répartition de charges', '2025-12-31', [[A, 'debit', 10_000], [B, 'debit', 6_000], [C, 'debit', 4_000], [P701, 'credit', 20_000]]),
  solde12En2025,
]

const repartitionDtg = t('26-repartition-dtg', 'Répartition de charges', '2026-10-15', [
  [cpt('67300', '00043'), 'credit', 280_000, OP43],
  [cpt('70200', '00043'), 'debit', 280_000, OP43],
  [cpt('10200', '00043'), 'debit', 20_000, OP43],
  [A, 'credit', 10_000],
  [B, 'credit', 6_000],
  [C, 'credit', 4_000],
])
const op43Reparti = constaterRepartitionOperation(
  changerStatutOperationTravaux(op43, 'A clôturer', { le: '2026-09-30', motif: 'Diagnostic livré le 31/05/2026' }),
  repartitionDtg,
  'TILL',
)

const traitements2026: Traitement[] = [
  repriseSoldeTravauxALOuverture(solde12En2025, { id: '26-reprise-12', date: '2026-01-01' }),
  t('26-appel-budget', 'Appel de fonds', '2026-01-01', [[A, 'debit', 420_000], [B, 'debit', 252_000], [C, 'debit', 168_000], [P701, 'credit', 840_000]]),
  t('26-appel-ft', 'Appel de fonds', '2026-01-01', [[A, 'debit', 21_000], [B, 'debit', 12_600], [C, 'debit', 8_400], [FT, 'credit', 42_000]]),
  t('26-regl-syndic', 'Règlement de factures', '2026-01-15', [[F('SYNDC'), 'debit', 300_000], [BQ, 'credit', 300_000]]),
  t('26-enc-a', 'Encaissement', '2026-02-01', [[BQ, 'debit', 451_000], [A, 'credit', 451_000]]),
  t('26-enc-b', 'Encaissement', '2026-02-01', [[BQ, 'debit', 270_600], [B, 'credit', 270_600]]),
  t('26-appel-t2', 'Appel de fonds', '2026-03-01', [[A, 'debit', 490_000], [B, 'debit', 294_000], [C, 'debit', 196_000], [cpt('10200', '00042'), 'credit', 980_000, OP42]]),
  t('26-enc-t2-a', 'Encaissement', '2026-03-20', [[BQ, 'debit', 490_000], [A, 'credit', 490_000]]),
  t('26-enc-t2-b', 'Encaissement', '2026-03-20', [[BQ, 'debit', 294_000], [B, 'credit', 294_000]]),
  t('26-fact-elec', 'Saisie de factures', '2026-03-31', [[cpt('60200'), 'debit', 105_000, GEN], [F('ELECX'), 'credit', 105_000]]),
  t('26-appel-dtg', 'Appel de fonds', '2026-04-01', [[A, 'debit', 150_000], [B, 'debit', 90_000], [C, 'debit', 60_000], [cpt('10200', '00043'), 'credit', 300_000, OP43]]),
  t('26-regl-elec', 'Règlement de factures', '2026-04-15', [[F('ELECX'), 'debit', 105_000], [BQ, 'credit', 105_000]]),
  t('26-enc-dtg-a', 'Encaissement', '2026-04-20', [[BQ, 'debit', 150_000], [A, 'credit', 150_000]]),
  t('26-enc-dtg-b', 'Encaissement', '2026-04-20', [[BQ, 'debit', 90_000], [B, 'credit', 90_000]]),
  t('26-fact-assur', 'Saisie de factures', '2026-04-30', [[cpt('61600'), 'debit', 210_000, GEN], [F('ASSUR'), 'credit', 210_000]]),
  t('26-subv-recue', 'Saisie de mouvements', '2026-05-10', [[BQ, 'debit', 150_000], [cpt('44100', 'SUBV1'), 'credit', 150_000, OP42]]),
  t('26-regl-assur', 'Règlement de factures', '2026-05-15', [[F('ASSUR'), 'debit', 210_000], [BQ, 'credit', 210_000]]),
  t('26-fact-dtg', 'Saisie de factures', '2026-05-31', [[cpt('67300', '00043'), 'debit', 280_000, GEN43], [F('BETXX'), 'credit', 280_000, OP43]]),
  vir('26-vir-dtg', op43, '2026-05-31', 280_000, 300_000),
  t('26-regl-dtg', 'Règlement de factures', '2026-06-15', [[F('BETXX'), 'debit', 280_000, OP43], [BQ, 'credit', 280_000]]),
  t('26-fact-raval-2', 'Saisie de factures', '2026-06-30', [[cpt('67100', '00042'), 'debit', 1_300_000, GEN42], [F('RAVAL'), 'credit', 1_300_000, OP42]]),
  vir('26-vir-2', op42, '2026-06-30', 1_300_000, 1_360_000),
  t('26-subv-constat', 'Saisie de mouvements', '2026-06-30', [[cpt('13100', '00042'), 'debit', 150_000, OP42], [cpt('71147', '00042'), 'credit', 150_000, GEN42]]),
  t('26-fact-asc', 'Saisie de factures', '2026-06-30', [[cpt('61400'), 'debit', 200_000, ASC], [F('ASCEN'), 'credit', 200_000]]),
  t('26-regl-asc', 'Règlement de factures', '2026-07-15', [[F('ASCEN'), 'debit', 200_000], [BQ, 'credit', 200_000]]),
  t('26-regl-raval', 'Règlement de factures', '2026-07-31', [[F('RAVAL'), 'debit', 1_300_000, OP42], [BQ, 'credit', 1_300_000]]),
  t('26-indemnite', 'Saisie de mouvements', '2026-08-01', [[BQ, 'debit', 20_000], [cpt('71300'), 'credit', 20_000, GEN]]),
  t('26-fact-plomb', 'Saisie de factures', '2026-09-30', [[cpt('61500'), 'debit', 15_000, ASC], [F('PLOMB'), 'credit', 15_000]]),
  t('26-regl-plomb', 'Règlement de factures', '2026-10-15', [[F('PLOMB'), 'debit', 15_000], [BQ, 'credit', 15_000]]),
  repartitionDtg,
  // C : 2 680 € dus fin 2025 + 1 680 + 84 + 1 960 + 600 − 40 (remboursement du DTG) = 6 964 €.
  t('26-douteuse', 'Saisie de mouvements', '2026-11-30', [[cpt('45900', '00003'), 'debit', 696_400], [C, 'credit', 696_400]]),
  t('26-depreciation', 'Saisie de mouvements', '2026-12-15', [[cpt('68000'), 'debit', 300_000, GEN], [cpt('49100', '00003'), 'credit', 300_000]]),
  t('26-enc-b-avance', 'Encaissement', '2026-12-20', [[BQ, 'debit', 100_000], [B, 'credit', 100_000]]),
  t('26-fact-syndic', 'Saisie de factures', '2026-12-31', [[cpt('62110'), 'debit', 300_000, GEN], [F('SYNDC'), 'credit', 300_000]]),
  t('26-agios', 'Saisie de mouvements', '2026-12-31', [[cpt('66200'), 'debit', 1_000, GEN], [BQ, 'credit', 1_000]]),
  t('26-repartition', 'Répartition de charges', '2026-12-31', [[P701, 'debit', 29_000], [A, 'credit', 14_500], [B, 'credit', 8_700], [C, 'credit', 5_800]]),
  t('26-repartition-exc', 'Répartition de charges', '2026-12-31', [[A, 'debit', 150_000], [B, 'debit', 90_000], [C, 'debit', 60_000], [cpt('68000'), 'credit', 300_000, GEN]]),
  t('26-solde-12', 'Saisie de mouvements', '2026-12-31', [
    [cpt('67100', '00042'), 'credit', 1_900_000, OP42],
    [cpt('70200', '00042'), 'debit', 1_900_000, OP42],
    [cpt('70500', '00042'), 'debit', 40_000, OP42],
    [cpt('71147', '00042'), 'debit', 150_000, OP42],
    [cpt('12000', '00042'), 'credit', 190_000, OP42],
  ]),
]

const budget = (elec: number, assur: number, syndic: number, asc: number, entretienAsc = 0): Budget =>
  creerBudget([
    { cle: 'GEN', compte: '60200', rubrique: 'Électricité', prevuCentimes: elec },
    { cle: 'GEN', compte: '61600', rubrique: 'Assurance', prevuCentimes: assur },
    { cle: 'GEN', compte: '62110', rubrique: 'Rémunération du syndic', prevuCentimes: syndic },
    { cle: 'ASC', compte: '61400', rubrique: 'Contrat ascenseur', prevuCentimes: asc },
    ...(entretienAsc ? [{ cle: 'ASC', compte: '61500', rubrique: 'Petites réparations ascenseur', prevuCentimes: entretienAsc }] : []),
  ])
const budget2025 = budget(100_000, 200_000, 300_000, 200_000)
const budget2026 = budget(110_000, 210_000, 300_000, 220_000)
const budget2027 = budget(120_000, 220_000, 310_000, 230_000)
const budget2028 = budget(125_000, 225_000, 320_000, 230_000, 20_000)

const CATEGORIES = [
  { cle: 'GEN', libelle: 'Charges communes générales' },
  { cle: 'ASC', libelle: "Charges d'ascenseurs" },
  { cle: 'BATA', libelle: 'Charges bâtiment A' },
]

const EX2025 = { ouverture: '2025-01-01', cloture: '2025-12-31' }
const EX2026 = { ouverture: '2026-01-01', cloture: '2026-12-31' }

const entree2025: EntreeAnnexes = {
  exercice: EX2025,
  exercicePrecedent: null,
  traitements: traitements2025,
  budgets: { voteN: budget2025, voteNPlus1: budget2026, aVoterNPlus2: budget2027 },
  operations: [op42],
  categoriesCharges: CATEGORIES,
}
const entree2026: EntreeAnnexes = {
  exercice: EX2026,
  exercicePrecedent: EX2025,
  traitements: [...traitements2025, ...traitements2026],
  budgets: { voteN: budget2026, voteNPlus1: budget2027, aVoterNPlus2: budget2028 },
  operations: [op42Termine, op43Reparti],
  categoriesCharges: CATEGORIES,
}

// ─── Lecture des résultats ────────────────────────────────────────────────────────────────────

const c = (v: Colonnes) => [v.precedentApprouve, v.budgetVote, v.realise, v.budgetEnCours, v.budgetAVoter]
const plat1 = (lignes: LigneEtatFinancier[]): (string | number | null)[][] =>
  lignes.flatMap((l) => [[l.code, l.montants.exercicePrecedent, l.montants.exerciceClos], ...plat1(l.detail ?? [])])
const plat2 = (lignes: LigneGestion[]): (string | number | null)[][] => lignes.flatMap((l) => [[l.code, ...c(l.valeurs)], ...plat2(l.detail ?? [])])
const pied = (p: PartieGestion) => ({ sousTotal: c(p.sousTotal), solde: c(p.solde), total: c(p.total) })
const m4 = (m: MontantsAnnexe4) => [m.depensesVotees, m.depenses, m.provisionsEtFinancements, m.solde]
const groupe4 = (g: GroupeCleAnnexe4) => ({
  cle: g.cle,
  charges: g.charges.map((p) => [p.compte, p.montantCentimes]),
  produits: g.produitsAffectes.map((p) => [p.compte, p.montantCentimes]),
  net: g.net,
  montants: m4(g.montants),
})
const controle = (r: ComptesSyndicatAnnexes, code: string) => {
  const trouve = r.controles.find((x) => x.code === code)
  if (!trouve) throw new Error(`contrôle ${code} absent`)
  return [trouve.attenduCentimes, trouve.constateCentimes, trouve.ok]
}

const r2025 = annexesComptesSyndicat(entree2025)
const r2026 = annexesComptesSyndicat(entree2026)

// ─── Annexe 1 ─────────────────────────────────────────────────────────────────────────────────

describe('annexe 1 — état financier après répartition', () => {
  it('2026 : trésorerie, provisions et avances, créances, dettes, colonnes 2025 et 2026', () => {
    const a1 = r2026.annexe1
    expect(a1.intitule).toBe('État financier après répartition au 31/12/2026')
    // Banque 2025 : + 4 200 + 2 520 + 1 000 + 100 + 4 900 + 2 940 − 1 100 − 2 000 − 2 200 − 5 000 = 5 360 €.
    // Banque 2026 : 5 360 + 4 510 + 2 706 + 4 900 + 2 940 + 1 500 + 900 + 1 500 + 200 + 1 000
    //   − 3 000 − 1 050 − 2 100 − 2 800 − 2 000 − 13 000 − 150 − 10 = 1 406 €.
    expect(plat1(a1.tresorerie.lignes)).toEqual([
      ['50', 0, 0],
      ['51', 536_000, 140_600],
      ['53', 0, 0],
    ])
    expect(a1.tresorerie.total).toEqual({ exercicePrecedent: 536_000, exerciceClos: 140_600 })
    // 102 : 2025 : 9 800 − 6 000 = 3 800 ; 2026 : 3 800 + 9 800 − 13 000 = 600 (00042) ; 3 000 − 2 800 − 200 = 0 (00043).
    // 105 : 400 − 400 = 0 ; puis + 420. 131 : 1 500 notifiés fin 2025, constatés en produit en 2026.
    // 12 : solde du ravalement, 400 fin 2025 ; reprise à l'ouverture puis 1 900 fin 2026.
    expect(plat1(a1.provisionsEtAvances.lignes)).toEqual([
      ['102', 380_000, 60_000],
      ['103', 0, 0],
      ['1031', 0, 0],
      ['1032', 0, 0],
      ['1033', 0, 0],
      ['105', 0, 42_000],
      ['106', 0, 0],
      ['131', 150_000, 0],
      ['12', 40_000, 190_000],
    ])
    expect(a1.provisionsEtAvances.total).toEqual({ exercicePrecedent: 570_000, exerciceClos: 292_000 })
    // 45 débiteurs : fin 2025 A 100 + B 60 + C 2 680 = 2 840 ; fin 2026 A 1 255 + C 542 = 1 797 (B créditeur).
    // 459 : 6 964 (C). 42 à 44 : subvention à recevoir 1 500 fin 2025, reçue en 2026.
    expect(plat1(a1.creances.lignes)).toEqual([
      ['45', 284_000, 179_700],
      ['459', 0, 696_400],
      ['42-44', 150_000, 0],
      ['46', 0, 0],
      ['47', 0, 0],
      ['48', 0, 0],
    ])
    expect(a1.creances.total).toEqual({ exercicePrecedent: 434_000, exerciceClos: 876_100 })
    // 45 créditeurs : B, avance de 1 000 € moins sa part de la dépréciation et de l'excédent → 247 €.
    // 40 : syndic 3 000 + ravaleur 1 000 aux deux clôtures. 49 : dépréciation de 3 000 € (C).
    expect(plat1(a1.dettes.lignes)).toEqual([
      ['45', 0, 24_700],
      ['40', 400_000, 400_000],
      ['42-44', 0, 0],
      ['46', 0, 0],
      ['47', 0, 0],
      ['48', 0, 0],
      ['49', 0, 300_000],
    ])
    expect(a1.dettes.total).toEqual({ exercicePrecedent: 400_000, exerciceClos: 724_700 })
    // (I) + (II) : 5 360 + 4 340 = 9 700 = 5 700 + 4 000 ; 1 406 + 8 761 = 10 167 = 2 920 + 7 247.
    expect(a1.totalGeneralGauche).toEqual({ exercicePrecedent: 970_000, exerciceClos: 1_016_700 })
    expect(a1.totalGeneralDroite).toEqual({ exercicePrecedent: 970_000, exerciceClos: 1_016_700 })
    expect(a1.resultatNonReparti).toEqual({ exercicePrecedent: 0, exerciceClos: 0 })
    expect(a1.empruntsRestantDus).toBeNull()
  })

  it('liste individualisée (note 2 du modèle) : comptes et montants, sans compensation entre copropriétaires', () => {
    expect(r2026.annexe1.listesIndividualisees).toEqual({
      coproprietairesDebiteurs: [
        { compte: A, montantCentimes: 125_500 },
        { compte: C, montantCentimes: 54_200 },
      ],
      coproprietairesCrediteurs: [{ compte: B, montantCentimes: 24_700 }],
      creancesDouteuses: [{ compte: cpt('45900', '00003'), montantCentimes: 696_400 }],
      depreciations: [{ compte: cpt('49100', '00003'), montantCentimes: 300_000 }],
    })
  })

  it('emprunts restant dus : paramètre explicite (l’emprunt ne se suit qu’en trésorerie, arrêté art. 10)', () => {
    const r = annexesComptesSyndicat({ ...entree2026, empruntsRestantDus: { exercicePrecedentCentimes: 0, exerciceClosCentimes: 1_200_000 } })
    expect(r.annexe1.empruntsRestantDus).toEqual({ exercicePrecedent: 0, exerciceClos: 1_200_000 })
    expect(() => annexesComptesSyndicat({ ...entree2026, empruntsRestantDus: { exercicePrecedentCentimes: 0, exerciceClosCentimes: 12.5 } })).toThrow(/centimes/)
  })
})

// ─── Annexe 2 ─────────────────────────────────────────────────────────────────────────────────

describe('annexe 2 — compte de gestion général', () => {
  it('2026 : charges pour opérations courantes, cinq colonnes (N-1, budget N, réalisé N, N+1, N+2)', () => {
    const { charges } = r2026.annexe2.operationsCourantes
    // Réalisé 2026 : 1 050 + 2 000 + 150 + 2 100 + 3 000 + 10 = 8 310 €. Budgets : 8 400 (2026), 8 800 (2027), 9 200 (2028).
    expect(plat2(charges.lignes)).toEqual([
      ['60', 110_000, 110_000, 105_000, 120_000, 125_000],
      ['601', 0, 0, 0, 0, 0],
      ['602', 110_000, 110_000, 105_000, 120_000, 125_000],
      ['603', 0, 0, 0, 0, 0],
      ['60X', 0, 0, 0, 0, 0],
      ['61', 420_000, 430_000, 425_000, 450_000, 475_000],
      ['611', 0, 0, 0, 0, 0],
      ['612', 0, 0, 0, 0, 0],
      ['613', 0, 0, 0, 0, 0],
      ['614', 220_000, 220_000, 200_000, 230_000, 230_000],
      ['615', 0, 0, 15_000, 0, 20_000],
      ['616', 200_000, 210_000, 210_000, 220_000, 225_000],
      ['62', 300_000, 300_000, 300_000, 310_000, 320_000],
      ['621', 300_000, 300_000, 300_000, 310_000, 320_000],
      ['622', 0, 0, 0, 0, 0],
      ['62…', 0, 0, 0, 0, 0],
      ['63', 0, 0, 0, 0, 0],
      ['64', 0, 0, 0, 0, 0],
      ['65', 0, 0, 0, 0, 0],
      ['66200', 0, 0, 1_000, 0, 0],
    ])
    expect(charges.lignes.at(-1)?.horsModele).toBe(true)
    // Excédent 2026 : 8 400 + 200 − 8 310 = 290 € ; grisé dans les colonnes de budget.
    expect(pied(charges)).toEqual({
      sousTotal: [830_000, 840_000, 831_000, 880_000, 920_000],
      solde: [0, null, 29_000, null, null],
      total: [830_000, 840_000, 860_000, 880_000, 920_000],
    })
  })

  it('2026 : produits pour opérations courantes ; insuffisance 2025 en comparatif', () => {
    const { produits } = r2026.annexe2.operationsCourantes
    expect(plat2(produits.lignes)).toEqual([
      ['701', 800_000, 840_000, 840_000, 880_000, 920_000],
      ['711', 0, 0, 0, 0, 0],
      ['713', 0, 0, 20_000, 0, 0],
      ['714', 10_000, 0, 0, 0, 0],
      ['716', 0, 0, 0, 0, 0],
    ])
    // 2025 : 8 300 − 8 000 − 100 = 200 € d'insuffisance.
    expect(pied(produits)).toEqual({
      sousTotal: [810_000, 840_000, 860_000, 880_000, 920_000],
      solde: [20_000, null, 0, null, null],
      total: [830_000, 840_000, 860_000, 880_000, 920_000],
    })
  })

  it('2026 : travaux et opérations exceptionnelles ; la reprise du 12 n’entre pas dans le réalisé', () => {
    const { charges, produits } = r2026.annexe2.travauxEtOperationsExceptionnelles
    // Réalisé 2026 : ravalement 13 000 + DTG 2 800 = 15 800 ; dépréciation 3 000. 2025 : 6 000.
    expect(plat2(charges.lignes)).toEqual([
      ['661', 0, null, 0, null, null],
      ['671-673', 600_000, null, 1_580_000, null, null],
      ['674', 0, null, 0, null, null],
      ['677', 0, null, 0, null, null],
      ['678', 0, null, 0, null, null],
      ['68', 0, null, 300_000, null, null],
    ])
    expect(pied(charges)).toEqual({
      sousTotal: [600_000, null, 1_880_000, null, null],
      solde: [null, null, 0, null, null],
      total: [600_000, null, 1_880_000, null, null],
    })
    // 702 : 13 000 + 2 800 virés du 102 ; 705 : 400 affectés du fonds en 2025 ; 711 : subvention constatée 1 500 (2026).
    expect(plat2(produits.lignes)).toEqual([
      ['702', 600_000, null, 1_580_000, null, null],
      ['703', 0, null, 0, null, null],
      ['704', 0, null, 0, null, null],
      ['705', 40_000, null, 0, null, null],
      ['706', 0, null, 0, null, null],
      ['AUTRES', 0, null, 150_000, null, null],
      ['711', 0, null, 150_000, null, null],
      ['712', 0, null, 0, null, null],
      ['713', 0, null, 0, null, null],
      ['714', 0, null, 0, null, null],
      ['716', 0, null, 0, null, null],
      ['718', 0, null, 0, null, null],
      ['78', 0, null, 0, null, null],
    ])
    // Insuffisance 2026 : 18 800 − 17 300 = 1 500 € ; le comparatif 2025 n'a pas de solde (case grisée du modèle).
    expect(pied(produits)).toEqual({
      sousTotal: [640_000, null, 1_730_000, null, null],
      solde: [null, null, 150_000, null, null],
      total: [640_000, null, 1_880_000, null, null],
    })
  })

  it('périodes des budgets N+1 et N+2 : les deux exercices de douze mois qui suivent', () => {
    expect(r2026.annexe2.periodeBudgetEnCours).toEqual({ ouverture: '2027-01-01', cloture: '2027-12-31' })
    expect(r2026.annexe2.periodeBudgetAVoter).toEqual({ ouverture: '2028-01-01', cloture: '2028-12-31' })
    expect(r2026.annexe2.intitule).toBe(
      "Compte de gestion général de l'exercice clos réalisé du 01/01/2026 au 31/12/2026 et budget prévisionnel de l'exercice du 01/01/2028 au 31/12/2028",
    )
  })
})

// ─── Annexe 3 ─────────────────────────────────────────────────────────────────────────────────

describe('annexe 3 — compte de gestion pour opérations courantes, par catégorie de charges', () => {
  it('2026 : charges détaillées par poste, produits affectés, net, pour chaque catégorie du règlement', () => {
    const a3 = r2026.annexe3
    expect(a3.categories.map((k) => [k.cle, k.libelle])).toEqual([
      ['GEN', 'Charges communes générales'],
      ['ASC', "Charges d'ascenseurs"],
      ['BATA', 'Charges bâtiment A'],
    ])
    const [gen, asc, bata] = a3.categories
    expect(gen.charges.map((p) => [p.compte, ...c(p.valeurs)])).toEqual([
      ['60200', 110_000, 110_000, 105_000, 120_000, 125_000],
      ['61600', 200_000, 210_000, 210_000, 220_000, 225_000],
      ['62110', 300_000, 300_000, 300_000, 310_000, 320_000],
      ['66200', 0, 0, 1_000, 0, 0],
    ])
    expect(gen.charges.map((p) => p.libelle)).toEqual(['Electricité', "Primes d'assurances", 'Rémunération du syndic', 'Autres charges financières et agios'])
    expect(c(gen.totalCharges)).toEqual([610_000, 620_000, 616_000, 650_000, 670_000])
    expect(gen.produitsAffectes.map((p) => [p.compte, ...c(p.valeurs)])).toEqual([
      ['71300', 0, 0, 20_000, 0, 0],
      ['71400', 10_000, 0, 0, 0, 0],
    ])
    expect(c(gen.totalProduitsAffectes)).toEqual([10_000, 0, 20_000, 0, 0])
    expect(c(gen.net)).toEqual([600_000, 620_000, 596_000, 650_000, 670_000])
    expect(asc.charges.map((p) => [p.compte, ...c(p.valeurs)])).toEqual([
      ['61400', 220_000, 220_000, 200_000, 230_000, 230_000],
      ['61500', 0, 0, 15_000, 0, 20_000],
    ])
    expect(asc.produitsAffectes).toEqual([])
    expect(c(asc.net)).toEqual([220_000, 220_000, 215_000, 230_000, 250_000])
    expect(bata.charges).toEqual([])
    expect(c(bata.net)).toEqual([0, 0, 0, 0, 0])
  })

  it('2026 : total des charges nettes, provisions, solde (excédent 290 €, insuffisance 2025 de 200 €)', () => {
    const a3 = r2026.annexe3
    expect(c(a3.totalChargesNettes)).toEqual([820_000, 840_000, 811_000, 880_000, 920_000])
    expect(c(a3.provisionsCoproprietaires)).toEqual([800_000, 840_000, 840_000, null, null])
    expect(c(a3.solde)).toEqual([-20_000, null, 29_000, null, null])
  })
})

// ─── Annexe 4 ─────────────────────────────────────────────────────────────────────────────────

describe('annexe 4 — compte de gestion pour travaux de l’art. 14-2 et opérations exceptionnelles', () => {
  it('2026 : par opération puis par clé ; opérations exceptionnelles à part ; totaux', () => {
    const a4 = r2026.annexe4
    expect(a4.travaux.map((o) => [o.numero, o.libelle, o.decision])).toEqual([
      ['00042', 'Ravalement des façades', { date: '2025-06-15', resolution: 'Résolution 12' }],
      ['00043', 'Diagnostic technique global', { date: '2026-03-10', resolution: 'Résolution 5' }],
    ])
    const [raval, dtg] = a4.travaux
    // Ravalement : dépenses 13 000 ; 702 13 000 + subvention 1 500 = 14 500 ; net = 13 000 − 14 500 = −1 500 ;
    // excédent de l'exercice 1 500.
    expect(raval.cles.map(groupe4)).toEqual([
      { cle: 'GEN', charges: [['67100', 1_300_000]], produits: [['70200', 1_300_000], ['71147', 150_000]], net: -150_000, montants: [2_000_000, 1_300_000, 1_450_000, 150_000] },
    ])
    expect(m4(raval.total)).toEqual([2_000_000, 1_300_000, 1_450_000, 150_000])
    expect(dtg.cles.map(groupe4)).toEqual([
      { cle: 'GEN', charges: [['67300', 280_000]], produits: [['70200', 280_000]], net: 0, montants: [300_000, 280_000, 280_000, 0] },
    ])
    expect(m4(a4.totalTravaux)).toEqual([2_300_000, 1_580_000, 1_730_000, 150_000])
    expect(a4.operationsExceptionnelles.map(groupe4)).toEqual([
      { cle: 'GEN', charges: [['68000', 300_000]], produits: [], net: 300_000, montants: [null, 300_000, 0, -300_000] },
    ])
    expect(m4(a4.totalOperationsExceptionnelles)).toEqual([null, 300_000, 0, -300_000])
    expect(m4(a4.totalGeneral)).toEqual([2_300_000, 1_880_000, 1_730_000, -150_000])
  })

  it('2025 : le ravalement seul, avec l’affectation du fonds de travaux (705) dans les financements', () => {
    const a4 = r2025.annexe4
    expect(a4.travaux.map((o) => o.numero)).toEqual(['00042'])
    expect(a4.travaux[0].cles.map(groupe4)).toEqual([
      { cle: 'GEN', charges: [['67100', 600_000]], produits: [['70200', 600_000], ['70500', 40_000]], net: -40_000, montants: [2_000_000, 600_000, 640_000, 40_000] },
    ])
    expect(a4.operationsExceptionnelles).toEqual([])
    expect(m4(a4.totalOperationsExceptionnelles)).toEqual([null, 0, 0, 0])
    expect(m4(a4.totalGeneral)).toEqual([2_000_000, 600_000, 640_000, 40_000])
  })
})

// ─── Annexe 5 ─────────────────────────────────────────────────────────────────────────────────

describe('annexe 5 — travaux votés non encore clôturés à la fin de l’exercice', () => {
  it('2026 : le ravalement (le DTG, réparti en octobre, en sort) ; colonnes A à F, montants cumulés et dates', () => {
    const a5 = r2026.annexe5
    expect(a5.lignes.map((l) => l.numero)).toEqual(['00042'])
    const [raval] = a5.lignes
    // B : 5 000 (2025) + 13 000 (2026) ; C : 6 000 + 13 000 ; D : 702 19 000 + 705 400 + 711 1 500 = 20 900 ; E = D − C.
    expect(raval).toMatchObject({
      votes: { montantCentimes: 2_000_000, date: '2025-06-15' },
      payes: { montantCentimes: 1_800_000, date: '2026-07-31' },
      realises: { montantCentimes: 1_900_000, date: '2026-06-30' },
      provisionsEtFinancements: { montantCentimes: 2_090_000, date: '2026-06-30' },
      soldeEnAttente: 190_000,
      aRecevoir: { montantCentimes: 0, date: null },
      soldeCompte12Centimes: 190_000,
      provisionsNonConsommees102Centimes: 60_000,
    })
    expect(raval.parCle).toEqual([
      { cle: 'GEN', libelle: 'Charges communes générales', votesCentimes: 2_000_000, realisesCentimes: 1_900_000, provisionsEtFinancementsCentimes: 2_090_000, soldeEnAttenteCentimes: 190_000 },
    ])
    expect(a5.total).toEqual({ votes: 2_000_000, payes: 1_800_000, realises: 1_900_000, provisionsEtFinancements: 2_090_000, soldeEnAttente: 190_000, aRecevoir: 0 })
  })

  it('2025 : subvention notifiée non reçue en colonne F ; solde E égal au compte 12', () => {
    const [raval] = r2025.annexe5.lignes
    expect(raval).toMatchObject({
      payes: { montantCentimes: 500_000, date: '2025-12-10' },
      realises: { montantCentimes: 600_000, date: '2025-11-15' },
      provisionsEtFinancements: { montantCentimes: 640_000, date: '2025-11-20' },
      soldeEnAttente: 40_000,
      aRecevoir: { montantCentimes: 150_000, date: '2025-12-01' },
      soldeCompte12Centimes: 40_000,
      provisionsNonConsommees102Centimes: 380_000,
    })
  })

  it('emprunt ou subvention à recevoir hors comptabilité : ajouté en colonne F, opération connue exigée', () => {
    const r = annexesComptesSyndicat({
      ...entree2026,
      aRecevoirHorsComptabilite: [{ operation: '00042', nature: 'emprunt', montantCentimes: 500_000, date: '2026-11-02' }],
    })
    expect(r.annexe5.lignes[0].aRecevoir).toEqual({ montantCentimes: 500_000, date: '2026-11-02' })
    expect(r.annexe5.total.aRecevoir).toBe(500_000)
    expect(() =>
      annexesComptesSyndicat({ ...entree2026, aRecevoirHorsComptabilite: [{ operation: '00099', nature: 'subvention', montantCentimes: 1, date: '2026-11-02' }] }),
    ).toThrow(/00099/)
  })
})

// ─── Contrôles de concordance ─────────────────────────────────────────────────────────────────

describe('contrôles de concordance', () => {
  it('2026 : tous les contrôles passent, sans anomalie autre que la ligne hors modèle (agios, 662)', () => {
    expect(r2026.controles.filter((x) => !x.ok)).toEqual([])
    expect(controle(r2026, 'annexe1_equilibre')).toEqual([1_016_700, 1_016_700, true])
    expect(controle(r2026, 'annexe1_equilibre_precedent')).toEqual([970_000, 970_000, true])
    expect(controle(r2026, 'annexe1_resultat_reparti')).toEqual([0, 0, true])
    expect(controle(r2026, 'annexe3_charges_realise')).toEqual([831_000, 831_000, true])
    expect(controle(r2026, 'annexe3_charges_budget_a_voter')).toEqual([920_000, 920_000, true])
    expect(controle(r2026, 'annexe3_solde_realise')).toEqual([29_000, 29_000, true])
    expect(controle(r2026, 'annexe4_depenses')).toEqual([1_880_000, 1_880_000, true])
    expect(controle(r2026, 'annexe4_produits')).toEqual([1_730_000, 1_730_000, true])
    expect(controle(r2026, 'annexe5_compte12')).toEqual([190_000, 190_000, true])
    expect(controle(r2026, 'compte_attente_47')).toEqual([0, 0, true])
    expect(r2026.anomalies.map((a) => a.code)).toEqual(['ligne_hors_modele'])
    expect(r2026.anomalies[0].message).toMatch(/66200/)
  })

  it('fin d’exercice sans le passage au 12 : résultat non réparti et écart entre l’annexe 5 et le compte 12', () => {
    const r = annexesComptesSyndicat({ ...entree2026, traitements: entree2026.traitements.filter((x) => x.id !== '26-solde-12') })
    // Sans le passage au 12, l'opération garde 19 000 au débit (671) et 20 900 au crédit (702, 705, 711) : 1 900 non répartis.
    expect(r.annexe1.resultatNonReparti).toEqual({ exercicePrecedent: 0, exerciceClos: -190_000 })
    expect(controle(r, 'annexe1_resultat_reparti')).toEqual([0, -190_000, false])
    expect(controle(r, 'annexe5_compte12')).toEqual([0, 190_000, false])
    // La gestion de l'exercice et l'annexe 5, elles, ne dépendent pas du passage au 12.
    expect(r.annexe5.lignes[0].soldeEnAttente).toBe(190_000)
    expect(m4(r.annexe4.totalGeneral)).toEqual([2_300_000, 1_880_000, 1_730_000, -150_000])
  })

  it('compte d’attente non soldé à la clôture : contrôle à justifier ligne à ligne (arrêté art. 10)', () => {
    const r = annexesComptesSyndicat({
      ...entree2026,
      traitements: [...entree2026.traitements, t('26-attente', 'Saisie de mouvements', '2026-12-30', [[cpt('47100'), 'debit', 5_000], [BQ, 'credit', 5_000]])],
    })
    expect(plat1(r.annexe1.creances.lignes)).toContainEqual(['47', 0, 5_000])
    expect(controle(r, 'compte_attente_47')).toEqual([0, 5_000, false])
    expect(controle(r, 'annexe1_equilibre')).toEqual([1_016_700, 1_016_700, true])
  })
})

// ─── Cas limites ──────────────────────────────────────────────────────────────────────────────

describe('cas limites', () => {
  it('premier exercice : aucune colonne « exercice précédent » ; budgets en cours et à voter repris', () => {
    expect(r2025.premierExercice).toBe(true)
    expect(r2025.annexe1.tresorerie.total).toEqual({ exercicePrecedent: null, exerciceClos: 536_000 })
    expect(plat2(r2025.annexe2.operationsCourantes.charges.lignes).filter((l) => l[3] !== 0)).toEqual([
      ['60', null, 100_000, 110_000, 110_000, 120_000],
      ['602', null, 100_000, 110_000, 110_000, 120_000],
      ['61', null, 400_000, 420_000, 430_000, 450_000],
      ['614', null, 200_000, 220_000, 220_000, 230_000],
      ['616', null, 200_000, 200_000, 210_000, 220_000],
      ['62', null, 300_000, 300_000, 300_000, 310_000],
      ['621', null, 300_000, 300_000, 300_000, 310_000],
    ])
    expect(pied(r2025.annexe2.operationsCourantes.produits)).toEqual({
      sousTotal: [null, 800_000, 810_000, 840_000, 880_000],
      solde: [null, null, 20_000, null, null],
      total: [null, 800_000, 830_000, 840_000, 880_000],
    })
    expect(pied(r2025.annexe2.travauxEtOperationsExceptionnelles.charges)).toEqual({
      sousTotal: [null, null, 600_000, null, null],
      solde: [null, null, 40_000, null, null],
      total: [null, null, 640_000, null, null],
    })
    expect(c(r2025.annexe3.solde)).toEqual([null, null, -20_000, null, null])
    expect(r2025.controles.filter((x) => !x.ok)).toEqual([])
    expect(r2025.controles.some((x) => x.code === 'annexe1_equilibre_precedent')).toBe(false)
    expect(r2025.anomalies).toEqual([])
  })

  it('exercice de dix-huit mois : admis pour le premier exercice, refusé au-delà ; signalé hors du premier exercice', () => {
    const premier = annexesComptesSyndicat({ ...entree2025, exercice: { ouverture: '2024-07-01', cloture: '2025-12-31' } })
    expect(premier.anomalies).toEqual([])
    expect(premier.annexe1.tresorerie.total.exerciceClos).toBe(536_000)
    expect(() => annexesComptesSyndicat({ ...entree2025, exercice: { ouverture: '2024-06-30', cloture: '2025-12-31' } })).toThrow(/dix-huit mois/)
    const allonge = annexesComptesSyndicat({
      ...entree2026,
      exercice: { ouverture: '2026-01-01', cloture: '2027-06-30' },
      budgets: { voteN: budget2026, voteNPlus1: null, aVoterNPlus2: null },
    })
    expect(allonge.anomalies.map((a) => a.code)).toContain('duree_exercice')
    expect(allonge.annexe2.periodeBudgetEnCours).toEqual({ ouverture: '2027-07-01', cloture: '2028-06-30' })
    expect(c(allonge.annexe2.operationsCourantes.charges.sousTotal)).toEqual([830_000, 840_000, 831_000, null, null])
  })

  it('exercice précédent non contigu, dates invalides : refusés', () => {
    expect(() => annexesComptesSyndicat({ ...entree2026, exercicePrecedent: { ouverture: '2025-01-01', cloture: '2025-12-30' } })).toThrow(/contigu/)
    expect(() => annexesComptesSyndicat({ ...entree2026, exercice: { ouverture: '2026-01-01', cloture: '2026-13-01' } })).toThrow(/AAAA-MM-JJ/)
    expect(() => annexesComptesSyndicat({ ...entree2026, exercice: { ouverture: '2026-12-31', cloture: '2026-01-01' } })).toThrow(/clôture/)
  })

  it('travaux à cheval sur deux exercices : gestion de l’exercice seul (annexe 4), cumul depuis le vote (annexe 5)', () => {
    const raval2026 = r2026.annexe4.travaux[0]
    expect(raval2026.total.depenses).toBe(1_300_000)
    expect(r2026.annexe5.lignes[0].realises.montantCentimes).toBe(600_000 + 1_300_000)
    expect(r2025.annexe4.travaux[0].total.depenses).toBe(600_000)
    expect(r2025.annexe5.lignes[0].realises.montantCentimes).toBe(600_000)
  })

  it('fonds de travaux : cotisations au 105 (annexe 1), affectation au 705 (annexes 2, 4 et 5)', () => {
    expect(plat1(r2026.annexe1.provisionsEtAvances.lignes)).toContainEqual(['105', 0, 42_000])
    expect(plat2(r2025.annexe2.travauxEtOperationsExceptionnelles.produits.lignes)).toContainEqual(['705', null, null, 40_000, null, null])
    expect(r2025.annexe4.travaux[0].cles[0].produitsAffectes).toContainEqual({ compte: '70500', libelle: 'Affectation du fonds de travaux', montantCentimes: 40_000 })
    expect(r2025.annexe5.lignes[0].provisionsEtFinancements.montantCentimes).toBe(600_000 + 40_000)
  })

  it('découvert bancaire : montant négatif en trésorerie (note 1 du modèle)', () => {
    const r = annexesComptesSyndicat({
      exercice: EX2026,
      exercicePrecedent: null,
      traitements: [
        t('x-fact', 'Saisie de factures', '2026-02-01', [[cpt('61500'), 'debit', 30_000, GEN], [F('PLOMB'), 'credit', 30_000]]),
        t('x-regl', 'Règlement de factures', '2026-02-10', [[F('PLOMB'), 'debit', 30_000], [BQ, 'credit', 30_000]]),
        t('x-rep', 'Répartition de charges', '2026-12-31', [[A, 'debit', 30_000], [P701, 'credit', 30_000]]),
      ],
      budgets: { voteN: null, voteNPlus1: null, aVoterNPlus2: null },
      operations: [],
    })
    expect(plat1(r.annexe1.tresorerie.lignes)).toContainEqual(['51', null, -30_000])
    expect(r.annexe1.totalGeneralGauche).toEqual({ exercicePrecedent: null, exerciceClos: 0 })
    expect(r.annexe1.totalGeneralDroite).toEqual({ exercicePrecedent: null, exerciceClos: 0 })
    // Sans budget voté : colonnes de budget sans objet (null), pas de zéro inventé.
    expect(c(r.annexe2.operationsCourantes.charges.sousTotal)).toEqual([null, null, 30_000, null, null])
  })

  it('charge sans clé de répartition : catégorie « sans clé » et anomalie (arrêté art. 2, balances en concordance)', () => {
    const r = annexesComptesSyndicat({
      ...entree2026,
      traitements: [...entree2026.traitements, t('26-sans-cle', 'Saisie de factures', '2026-12-01', [[cpt('61100'), 'debit', 4_000], [F('MENAG'), 'credit', 4_000]])],
    })
    const sansCle = r.annexe3.categories.at(-1)
    expect(sansCle?.cle).toBeNull()
    expect(sansCle?.charges.map((p) => [p.compte, p.valeurs.realise])).toEqual([['61100', 4_000]])
    expect(r.anomalies.map((a) => a.code)).toContain('mouvement_sans_cle')
    expect(controle(r, 'annexe3_charges_realise')).toEqual([835_000, 835_000, true])
  })

  it('opération exceptionnelle sans clé et sans opération : ligne « sans clé » de l’annexe 4', () => {
    const r = annexesComptesSyndicat({
      ...entree2026,
      traitements: [...entree2026.traitements, t('26-perte', 'Saisie de mouvements', '2026-12-31', [[cpt('67700'), 'debit', 2_500], [C, 'credit', 2_500]])],
    })
    expect(r.annexe4.operationsExceptionnelles.map(groupe4)).toEqual([
      { cle: 'GEN', charges: [['68000', 300_000]], produits: [], net: 300_000, montants: [null, 300_000, 0, -300_000] },
      { cle: null, charges: [['67700', 2_500]], produits: [], net: 2_500, montants: [null, 2_500, 0, -2_500] },
    ])
  })

  it('budget : ligne de travaux ou de provisions écartée et signalée ; produit attendu déduit des provisions budgétées', () => {
    const b = creerBudget([
      { cle: 'GEN', compte: '60200', rubrique: 'Électricité', prevuCentimes: 100_000 },
      { cle: 'GEN', compte: '71400', rubrique: 'Produits divers', prevuCentimes: 10_000 },
      { cle: 'GEN', compte: '70100', rubrique: 'Provisions', prevuCentimes: 90_000 },
      { cle: 'GEN', compte: '67100', rubrique: 'Travaux', prevuCentimes: 50_000 },
    ])
    const r = annexesComptesSyndicat({ ...entree2026, budgets: { voteN: b, voteNPlus1: null, aVoterNPlus2: null } })
    // Provisions budgétées : 1 000 de charges − 100 de produits attendus = 900 €.
    const produits = plat2(r.annexe2.operationsCourantes.produits.lignes)
    expect(produits.find((l) => l[0] === '701')).toEqual(['701', 800_000, 90_000, 840_000, null, null])
    expect(produits.find((l) => l[0] === '714')).toEqual(['714', 10_000, 10_000, 0, null, null])
    expect(c(r.annexe2.operationsCourantes.charges.sousTotal)).toEqual([830_000, 100_000, 831_000, null, null])
    expect(c(r.annexe3.provisionsCoproprietaires)).toEqual([800_000, 90_000, 840_000, null, null])
    expect(c(r.annexe3.categories[0].net)).toEqual([600_000, 90_000, 596_000, null, null])
    expect(r.anomalies.map((a) => a.code)).toEqual(expect.arrayContaining(['budget_ligne_provisions', 'budget_hors_operations_courantes']))
  })

  it('compte hors nomenclature, compte de trésorerie hors modèle, opération inconnue : signalés', () => {
    const r = annexesComptesSyndicat({
      ...entree2026,
      traitements: [
        ...entree2026.traitements,
        t('26-hors', 'Saisie de mouvements', '2026-12-30', [[cpt('00000'), 'debit', 1_000], [BQ, 'credit', 1_000]]),
        t('26-58', 'Saisie de mouvements', '2026-12-30', [[cpt('58000'), 'debit', 2_000], [BQ, 'credit', 2_000]]),
        t('26-inconnue', 'Saisie de factures', '2026-12-30', [[cpt('67100', '00099'), 'debit', 3_000, { cle: 'GEN', op: '00099' }], [F('XXXXX'), 'credit', 3_000]]),
      ],
    })
    // Banque : 1 406 − 10 − 20 = 1 376 € ; 58000 hors modèle : 20 €.
    expect(plat1(r.annexe1.tresorerie.lignes)).toEqual([
      ['50', 0, 0],
      ['51', 536_000, 137_600],
      ['53', 0, 0],
      ['58000', 0, 2_000],
    ])
    // Gauche : 1 396 + 8 761 = 10 157 ; droite : 2 920 + 7 247 + 30 = 10 197 ; écart = 10 (hors nomenclature) + 30 (charge non répartie).
    expect(controle(r, 'annexe1_equilibre')).toEqual([1_019_700, 1_015_700, false])
    expect(r.annexe4.travaux.map((o) => [o.numero, o.libelle, o.decision, m4(o.total)])).toContainEqual(['00099', 'Opération 00099', null, [null, 3_000, 0, -3_000]])
    expect(r.anomalies.map((a) => a.code)).toEqual(expect.arrayContaining(['compte_hors_nomenclature', 'ligne_hors_modele', 'operation_inconnue']))
  })

  it('libellés du plan fournis : ils remplacent les intitulés de la nomenclature', () => {
    const r = annexesComptesSyndicat({ ...entree2026, libellesComptes: { '62110': "Rémunération de l'administrateur provisoire" } })
    expect(r.annexe3.categories[0].charges.find((p) => p.compte === '62110')?.libelle).toBe("Rémunération de l'administrateur provisoire")
  })

  it('opération sans historique de statuts : votée au plus tard à la clôture, elle figure à l’annexe 5', () => {
    const r = annexesComptesSyndicat({ ...entree2025, operations: [{ ...op42, historiqueStatuts: [] }] })
    expect(r.annexe5.lignes.map((l) => l.numero)).toEqual(['00042'])
  })

  it('opération ou catégorie fournie deux fois : refusée', () => {
    expect(() => annexesComptesSyndicat({ ...entree2026, operations: [op42Termine, op42Termine] })).toThrow(/00042/)
    expect(() => annexesComptesSyndicat({ ...entree2026, categoriesCharges: [...CATEGORIES, { cle: 'GEN', libelle: 'Doublon' }] })).toThrow(/GEN/)
  })
})

// ─── Relecture du 20/11/2026 ──────────────────────────────────────────────────────────────────

describe('relecture — opération sur deux clés : le virement 102 → 702 du domaine porte la clé de la charge', () => {
  const op50 = creerOperationTravaux({
    numero: '00050',
    coproprieteId: 'copro-tilleuls-fictive',
    libelle: 'Toiture et ascenseur',
    cleId: 'GEN',
    cles: [
      { cleId: 'GEN', budgetTtcCentimes: 600_000 },
      { cleId: 'ASC', budgetTtcCentimes: 400_000 },
    ],
    decision: { date: '2026-02-01', resolution: 'Résolution 3' },
    budgetTtcCentimes: 1_000_000,
    financementFondsTravauxCentimes: 0,
    affectationFonds: null,
    tranches: [{ date: '2026-03-01', tauxPct: 100 }],
  })
  const OP50 = { op: '00050' }
  const appelEtFacture = [
    t('50-appel', 'Appel de fonds', '2026-03-01', [[A, 'debit', 500_000], [B, 'debit', 300_000], [C, 'debit', 200_000], [cpt('10200', '00050'), 'credit', 1_000_000, OP50]]),
    t('50-fact', 'Saisie de factures', '2026-06-30', [
      [cpt('67100', '00050'), 'debit', 600_000, { cle: 'GEN', op: '00050' }],
      [cpt('67100', '00050'), 'debit', 400_000, { cle: 'ASC', op: '00050' }],
      [F('TOITX'), 'credit', 1_000_000, OP50],
    ]),
  ]
  const entree50 = (virements: Traitement[]): EntreeAnnexes => ({
    exercice: EX2026,
    exercicePrecedent: null,
    traitements: [...appelEtFacture, ...virements],
    budgets: { voteN: null, voteNPlus1: null, aVoterNPlus2: null },
    operations: [op50],
    categoriesCharges: CATEGORIES,
  })

  it('annexe 4 (note 3) et annexe 5 (note 1) : provisions virées détaillées par clé, aucune ligne « sans clé »', () => {
    // Une charge par ligne de la facture ventilée : un virement par ligne, avec sa clé ; le 102 de l'opération fait 10 000 €.
    const contexte = { date: '2026-06-30', segmentSyndicat: 'TILL' }
    const virGen = virementProvisionsTravauxALaRealisation(op50, { ...contexte, id: '50-vir-gen', chargeCentimes: 600_000, solde102Centimes: 1_000_000, cleId: 'GEN' })
    const virAsc = virementProvisionsTravauxALaRealisation(op50, { ...contexte, id: '50-vir-asc', chargeCentimes: 400_000, solde102Centimes: 400_000, cleId: 'ASC' })
    if (!virGen.traitement || !virAsc.traitement) throw new Error('virements attendus')
    expect([...virGen.traitement.mouvements, ...virAsc.traitement.mouvements].map((m) => m.attributs?.cle)).toEqual(['GEN', 'GEN', 'ASC', 'ASC'])
    const r = annexesComptesSyndicat(entree50([virGen.traitement, virAsc.traitement]))
    // GEN : 6 000 votés, 6 000 dépensés, 6 000 virés du 102 → solde nul ; ASC : 4 000, 4 000, 4 000.
    expect(r.annexe4.travaux[0].cles.map((g) => [g.cle, ...m4(g.montants)])).toEqual([
      ['GEN', 600_000, 600_000, 600_000, 0],
      ['ASC', 400_000, 400_000, 400_000, 0],
    ])
    expect(r.annexe5.lignes[0].parCle.map((k) => [k.cle, k.votesCentimes, k.realisesCentimes, k.provisionsEtFinancementsCentimes, k.soldeEnAttenteCentimes])).toEqual([
      ['GEN', 600_000, 600_000, 600_000, 0],
      ['ASC', 400_000, 400_000, 400_000, 0],
    ])
    expect(r.anomalies.map((a) => a.code)).not.toContain('mouvement_sans_cle')
  })

  it('un 702 sans clé sur une opération à plusieurs clés (reprise d’un autre logiciel) : « sans clé » et anomalie, sans ventilation inventée', () => {
    const repris = t('50-vir-repris', 'Saisie de mouvements', '2026-06-30', [[cpt('10200', '00050'), 'debit', 1_000_000, OP50], [cpt('70200', '00050'), 'credit', 1_000_000, OP50]])
    const r = annexesComptesSyndicat(entree50([repris]))
    expect(r.annexe4.travaux[0].cles.map((g) => [g.cle, ...m4(g.montants)])).toEqual([
      ['GEN', 600_000, 600_000, 0, -600_000],
      ['ASC', 400_000, 400_000, 0, -400_000],
      [null, null, 0, 1_000_000, 1_000_000],
    ])
    expect(r.anomalies.map((a) => a.code)).toContain('mouvement_sans_cle')
  })
})

describe('relecture — 706-1 et 703, qui peuvent financer du courant (arrêté du 14 mars 2005, art. 7 et 10)', () => {
  const avec = (lignes: Ligne[]) =>
    annexesComptesSyndicat({
      exercice: EX2026,
      exercicePrecedent: null,
      traitements: [t('x', 'Saisie de mouvements', '2026-05-01', lignes)],
      budgets: { voteN: null, voteNPlus1: null, aVoterNPlus2: null },
      operations: [],
      categoriesCharges: CATEGORIES,
    })

  it('un 7061 présenté en produits pour travaux (modèle du décret) est signalé : présentation à confirmer', () => {
    const r = avec([[A, 'debit', 50_000], [cpt('70610'), 'credit', 50_000, GEN]])
    expect(r.annexe2.travauxEtOperationsExceptionnelles.produits.lignes.find((l) => l.code === '706')?.valeurs.realise).toBe(50_000)
    const anomalie = r.anomalies.find((a) => a.code === 'section_a_confirmer')
    expect(anomalie?.message).toMatch(/70610/)
    expect(anomalie?.message).toMatch(/706-1/)
    expect(anomalie?.message).toMatch(/art\. 7/)
  })

  it('un 703 présenté en produits pour travaux est signalé : l’arrêté le crédite aussi pour des dépenses courantes', () => {
    const r = avec([[cpt('10310'), 'debit', 20_000], [cpt('70300'), 'credit', 20_000, GEN]])
    const anomalie = r.anomalies.find((a) => a.code === 'section_a_confirmer')
    expect(anomalie?.message).toMatch(/70300/)
    expect(anomalie?.message).toMatch(/dépenses courantes ou imprévues/)
    expect(anomalie?.message).toMatch(/art\. 10/)
  })

  it('un 702 ou un 7062 n’est pas signalé', () => {
    const r = avec([[A, 'debit', 30_000], [cpt('70620'), 'credit', 10_000, GEN], [cpt('70200'), 'credit', 20_000, GEN]])
    expect(r.anomalies.map((a) => a.code)).not.toContain('section_a_confirmer')
  })
})

describe('relecture — intitulés repris des modèles', () => {
  it('annexe 3 : « et budget prévisionnel de l’exercice (N+2) du … au … », comme l’annexe 2', () => {
    expect(r2026.annexe3.intitule).toBe(
      "Compte de gestion pour opérations courantes de l'exercice clos réalisé du 01/01/2026 au 31/12/2026 et budget prévisionnel de l'exercice du 01/01/2028 au 31/12/2028",
    )
  })

  it('annexe 2, ligne 65 : libellé complet du décret n° 2020-1229, art. 5, 2° a', () => {
    expect(r2026.annexe2.operationsCourantes.charges.lignes.find((l) => l.code === '65')?.libelle).toBe(
      "Montant alloué au conseil syndical pour l'exercice de sa délégation de pouvoirs (préciser la nature de chaque opération concernée)",
    )
  })
})

describe('relecture — en-tête : portée des contrôles et questions ouvertes', () => {
  const enTete = enTeteDuModule('comptes-syndicat-annexes')

  it('les contrôles de l’art. 10 sont dits vrais par construction (garde-fous de non-régression)', () => {
    expect(enTete.texte).toContain('par construction')
    expect(enTete.texte).toContain('non-régression')
    expect(enTete.texte).not.toContain("concordance de l'art. 10 vérifiée")
  })

  it('questions 🔴 : 706-1 et 703, produits affectés de l’annexe 4, détail de la ligne 65, clé du virement 102 → 702', () => {
    const rouge = enTete.texte.slice(enTete.texte.indexOf('🔴 Non établi'))
    for (const attendu of ['706-1', '703', 'Produits affectés', 'préciser la nature de chaque opération concernée', 'virementProvisionsTravauxALaRealisation'])
      expect(rouge).toContain(attendu)
  })
})
