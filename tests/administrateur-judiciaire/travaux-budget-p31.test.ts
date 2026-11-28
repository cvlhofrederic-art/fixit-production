import { describe, expect, it } from 'vitest'
import { suivreEcheances, type EcheanceAppelSuivie } from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import {
  controlerAffectationFondsTravaux,
  type DecaissementFondsTravaux,
  type DecisionAffectationAg,
  type OrdonnanceJuge,
} from '@/lib/administrateur-judiciaire/domain/fonds-travaux'
import { emploiDepuisOperation, type EmploiFondsTravaux } from '@/lib/administrateur-judiciaire/domain/fonds-travaux-lots'
import type { PosteDette } from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import type { ReglementFournisseur, StatutReglementFournisseur } from '@/lib/administrateur-judiciaire/domain/reglements-fournisseurs'
import {
  anomaliesComptesDesLignesDOperation,
  BAREME_DROIT_PROPORTIONNEL_TRAVAUX,
  CADRES_HONORAIRES_TRAVAUX,
  cadreHonorairesTravaux,
  compteProposePourLePoste,
  controlerDepassementBudgetAvantOs,
  controlerEmploiFondsOperation,
  controlerHonorairesTravaux,
  creerBudgetOperationTravaux,
  type DecisionSupplementTravaux,
  type EngagementAvantOs,
  type LigneCompteOperation,
  droitProportionnelTravauxAdministrateurProvisoire,
  droitsProportionnelsTravauxParOperation,
  marquerNePasUtiliserFondsTravaux,
  POSTES_BUDGET_TRAVAUX,
  suiviFinancierOperationTravaux,
  type BudgetOperationTravaux,
  type SaisieBudgetOperationTravaux,
} from '@/lib/administrateur-judiciaire/domain/travaux-budget'
import {
  affectationFondsDeLOperation,
  changerStatutOperationTravaux,
  creerOperationTravaux,
  echeancesTravaux,
  emploisFondsTravauxDesTranches,
  type OperationTravaux,
  type SaisieOperationTravaux,
} from '@/lib/administrateur-judiciaire/domain/travaux-operations'
import { enTeteDuModule } from './en-tete-module'

/**
 * Point 31 du bilan — budget et suivi financier d'une opération de travaux (Gestéam, tranche 32, onglet Budget) :
 * postes (travaux, dommages-ouvrage, honoraires cabinet et prestataires), engagé, adopté, appelé, encaissé, réglé,
 * trésorerie ; contrôle d'affectation du fonds de travaux (J4) et « Ne pas utiliser les fonds travaux » ; honoraires sur
 * travaux : poste du budget, cadre selon le régime (L. 1965 art. 18-1 A, III ; arrêté du 8 octobre 2015, art. 3 et 11).
 */

const saisie = (surcharge: Partial<SaisieOperationTravaux> = {}): SaisieOperationTravaux => ({
  numero: '00042',
  coproprieteId: 'copro-tilleuls',
  libelle: 'Ravalement façade rue',
  cleId: 'cle-001',
  decision: { date: '2026-03-12', resolution: 'Résolution 8', majorite: 'art24' },
  budgetTtcCentimes: 12_000_000,
  financementFondsTravauxCentimes: 2_000_000,
  affectationFonds: { objet: 'travaux_hors_ppt' },
  tranches: [
    { date: '2026-05-01', tauxPct: 30 },
    { date: '2026-08-01', tauxPct: 40 },
    { date: '2026-11-01', tauxPct: 30 },
  ],
  ...surcharge,
})

const operation = (surcharge: Partial<SaisieOperationTravaux> = {}): OperationTravaux => creerOperationTravaux(saisie(surcharge))

const sansFonds = (surcharge: Partial<SaisieOperationTravaux> = {}): OperationTravaux =>
  operation({ financementFondsTravauxCentimes: 0, affectationFonds: null, ...surcharge })

const LIGNES: SaisieBudgetOperationTravaux['lignes'] = [
  { poste: 'travaux', budgetTtcCentimes: 9_000_000, supplementsTtcCentimes: 500_000 },
  { poste: 'dommagesOuvrage', budgetTtcCentimes: 300_000 },
  { poste: 'honorairesCabinet', budgetTtcCentimes: 400_000 },
  { poste: 'honorairesPrestataires', budgetTtcCentimes: 600_000 },
]

const budget = (op: OperationTravaux, surcharge: Partial<SaisieBudgetOperationTravaux> = {}): BudgetOperationTravaux =>
  creerBudgetOperationTravaux(op, { lignes: LIGNES, ...surcharge })

const reglement = (id: string, statut: StatutReglementFournisseur, montantCentimes: number, coproprieteId = 'copro-tilleuls', travauxId: string | null = '00042') =>
  ({ id, coproprieteId, travauxId, statut, montantCentimes }) as ReglementFournisseur

const poste = (id: string, appelId: string | null, regleCentimes: number): PosteDette => ({
  id,
  compteId: 'c-1',
  appelId,
  typeAppel: null,
  libelle: id,
  exigibilite: '2026-05-01',
  montantCentimes: regleCentimes,
  regleCentimes,
  contentieux: false,
})

/** Échéances suivies de l'opération, la première appelée. */
const suiviesAvecPremiereAppelee = (op: OperationTravaux): EcheanceAppelSuivie[] =>
  suivreEcheances(echeancesTravaux(op)).map((e, i) => (i === 0 ? { ...e, statut: 'Appelé' as const } : e))

/** Emploi saisi à la main ; décision d'affectation en forme structurée (J30), comme emploiDepuisOperation la transmet. */
const emploiLibre = (id: string, montantCentimes: number, objet: EmploiFondsTravaux['decaissement']['objet'] = 'travaux_hors_ppt'): EmploiFondsTravaux => ({
  id,
  date: '2026-04-01',
  montantCentimes,
  cleId: 'cle-001',
  decaissement: { objet, montantCentimes, decisionAg: { dateAg: '2026-03-12', numeroResolution: 'Résolution 8' } },
  operationNumero: '00042',
  partOperationCentimes: 0,
  dateDecision: null,
})

const codes = (anomalies: { code: string }[]): string[] => anomalies.map((a) => a.code)

describe('budget de l’opération : quatre postes, financements, ventilation des règlements', () => {
  it('normalise les quatre postes dans l’ordre de l’écran, un poste absent à zéro', () => {
    const b = creerBudgetOperationTravaux(operation(), { lignes: [{ poste: 'honorairesCabinet', budgetTtcCentimes: 400_000 }] })
    expect(b.lignes.map((l) => l.poste)).toEqual([...POSTES_BUDGET_TRAVAUX])
    expect(b.lignes).toEqual([
      { poste: 'travaux', budgetTtcCentimes: 0, supplementsTtcCentimes: 0 },
      { poste: 'dommagesOuvrage', budgetTtcCentimes: 0, supplementsTtcCentimes: 0 },
      { poste: 'honorairesCabinet', budgetTtcCentimes: 400_000, supplementsTtcCentimes: 0 },
      { poste: 'honorairesPrestataires', budgetTtcCentimes: 0, supplementsTtcCentimes: 0 },
    ])
    expect(b).toMatchObject({ numero: '00042', coproprieteId: 'copro-tilleuls', financements: [], postesDesReglements: {} })
  })

  it('refuse un poste inconnu ou en double, des montants qui ne sont pas des centimes entiers positifs', () => {
    const op = operation()
    expect(() => creerBudgetOperationTravaux(op, { lignes: [{ poste: 'architecte' as never, budgetTtcCentimes: 1 }] })).toThrow(/poste du budget inconnu/)
    expect(() =>
      creerBudgetOperationTravaux(op, {
        lignes: [
          { poste: 'travaux', budgetTtcCentimes: 1 },
          { poste: 'travaux', budgetTtcCentimes: 2 },
        ],
      }),
    ).toThrow(/« Travaux » en double/)
    expect(() => creerBudgetOperationTravaux(op, { lignes: [{ poste: 'travaux', budgetTtcCentimes: 10.5 }] })).toThrow(/centimes entiers/)
    expect(() => creerBudgetOperationTravaux(op, { lignes: [{ poste: 'travaux', budgetTtcCentimes: 1, supplementsTtcCentimes: -1 }] })).toThrow(/suppléments Travaux/)
    expect(() => creerBudgetOperationTravaux(op, { lignes: [], postesDesReglements: { r1: 'divers' as never } })).toThrow(/Règlement r1 : poste du budget inconnu/)
  })

  it('financements : libellé de la nature par défaut, reçu au plus l’accordé, nature connue', () => {
    const op = operation()
    const b = creerBudgetOperationTravaux(op, {
      lignes: [],
      financements: [
        { nature: 'subvention', accordeCentimes: 800_000, recuCentimes: 500_000 },
        { nature: 'indemnite_assurance', libelle: '  Assureur MRI  ', accordeCentimes: 100_000, recuCentimes: 0 },
      ],
    })
    expect(b.financements.map((f) => f.libelle)).toEqual(['Prime, subvention', 'Assureur MRI'])
    expect(() => creerBudgetOperationTravaux(op, { lignes: [], financements: [{ nature: 'subvention', accordeCentimes: 1, recuCentimes: 2 }] })).toThrow(
      /reçu .* supérieur à l'accordé/,
    )
    expect(() => creerBudgetOperationTravaux(op, { lignes: [], financements: [{ nature: 'don' as never, accordeCentimes: 1, recuCentimes: 0 }] })).toThrow(
      /nature de financement inconnue/,
    )
  })
})

describe('« Ne pas utiliser les fonds travaux »', () => {
  it('refusé à la création avec une part du fonds ; admis sans part', () => {
    expect(() => operation({ nePasUtiliserFondsTravaux: true })).toThrow(/« Ne pas utiliser les fonds travaux » avec une part du fonds/)
    expect(sansFonds({ nePasUtiliserFondsTravaux: true }).nePasUtiliserFondsTravaux).toBe(true)
  })

  it('le bouton se pose sur une opération sans part, se retire toujours, et n’est pas admis avec une part', () => {
    const op = sansFonds()
    const marquee = marquerNePasUtiliserFondsTravaux(op, true)
    expect(marquee.nePasUtiliserFondsTravaux).toBe(true)
    expect(marquerNePasUtiliserFondsTravaux(marquee, false).nePasUtiliserFondsTravaux).toBe(false)
    expect(op.nePasUtiliserFondsTravaux).toBeUndefined()
    expect(() => marquerNePasUtiliserFondsTravaux(operation(), true)).toThrow(/exige une opération sans part du fonds/)
    expect(marquerNePasUtiliserFondsTravaux(operation(), false).nePasUtiliserFondsTravaux).toBe(false)
  })

  it('tout emploi du fonds rattaché à une opération marquée est bloquant, et compte dans sa trésorerie', () => {
    const op = sansFonds({ nePasUtiliserFondsTravaux: true })
    const suivi = suiviFinancierOperationTravaux(op, budget(op), { emploisFonds: [emploiLibre('E9', 300_000)] })
    expect(suivi.anomalies.filter((a) => a.code === 'emploi_fonds_exclu')).toEqual([
      expect.objectContaining({ gravite: 'bloquant', fondement: null, message: expect.stringContaining('Emploi E9') }),
    ])
    // La case exige une part nulle : le rapprochement des emplois avec cette part reste fait (relecture, tour 2).
    expect(codes(suivi.anomalies)).toContain('emploi_au_dela_de_la_part')
    expect(suivi).toMatchObject({ nePasUtiliserFondsTravaux: true, fondsTravauxCentimes: 0, emploiFondsTravauxCentimes: 300_000, soldeTresorerieCentimes: 300_000 })
  })
})

describe('suivi financier : engagé, adopté, appelé, encaissé, réglé, trésorerie', () => {
  const op = operation()
  const b = budget(op, {
    financements: [{ nature: 'subvention', accordeCentimes: 800_000, recuCentimes: 500_000 }],
    postesDesReglements: { r1: 'travaux', r2: 'honorairesPrestataires', r3: 'travaux' },
  })
  const reglements = [
    reglement('r1', 'Enregistré', 1_500_000),
    reglement('r2', 'Rapproché', 300_000),
    reglement('r3', 'À régler', 200_000),
    reglement('r4', 'Enregistré', 100_000),
    reglement('r5', 'Enregistré', 999_000, 'copro-autre'),
    reglement('r6', 'Annulé', 50_000),
  ]
  const emploi = emploiDepuisOperation(op, { id: 'E1', date: '2026-04-01', montantCentimes: 1_000_000 })
  const suivi = suiviFinancierOperationTravaux(op, b, {
    suivies: suiviesAvecPremiereAppelee(op),
    postes: [poste('P1', '00042-T1', 2_500_000), poste('P2', null, 7_777)],
    reglements,
    emploisFonds: [emploi],
  })

  it('postes : budget, suppléments, engagé, réglé et en cours ventilés, reste à régler', () => {
    expect(suivi.postes.map((p) => [p.libelle, p.engageCentimes, p.regleCentimes, p.enCoursCentimes, p.resteAReglerCentimes])).toEqual([
      ['Travaux', 9_500_000, 1_500_000, 200_000, 8_000_000],
      ['Dommages-ouvrage', 300_000, 0, 0, 300_000],
      ['Honoraires cabinet', 400_000, 0, 0, 400_000],
      ['Honoraires presta.', 600_000, 300_000, 0, 300_000],
    ])
    expect(suivi.totalEngageCentimes).toBe(10_800_000)
  })

  it('budget adopté, solde budgétaire, appels votés, part du fonds, financements', () => {
    expect(suivi).toMatchObject({
      budgetAdopteCentimes: 12_000_000,
      soldeBudgetaireCentimes: 1_200_000,
      appelsVotesCentimes: 10_000_000,
      fondsTravauxCentimes: 2_000_000,
      nePasUtiliserFondsTravaux: false,
      financements: [{ nature: 'subvention', libelle: 'Prime, subvention', accordeCentimes: 800_000, recuCentimes: 500_000 }],
    })
  })

  it('fonds appelés, encaissé, appels non reçus, réglé (même syndicat), emploi du fonds, trésorerie', () => {
    expect(suivi).toMatchObject({
      fondsAppelesCentimes: 3_000_000,
      encaisseCentimes: 2_500_000,
      appelsNonRecusCentimes: 500_000,
      regleCentimes: 1_900_000,
      reglementsEnCoursCentimes: 200_000,
      regleNonVentileCentimes: 100_000,
      emploiFondsTravauxCentimes: 1_000_000,
      // 2 500 000 encaissés + 1 000 000 du fonds + 500 000 de subvention − 1 900 000 réglés
      soldeTresorerieCentimes: 2_100_000,
    })
  })

  it('seul le règlement non ventilé est signalé : la part et l’emploi du fonds passent le contrôle d’affectation', () => {
    expect(suivi.anomalies).toEqual([
      { code: 'reglements_non_ventiles', gravite: 'information', message: expect.stringContaining('sans poste du budget'), fondement: null, aConfirmer: false },
    ])
  })

  it('le budget d’une autre opération, ou du même n° dans un autre syndicat (D1), est refusé', () => {
    expect(() => suiviFinancierOperationTravaux(operation({ numero: '00043' }), b)).toThrow(/Budget de l'opération 00042/)
    expect(() => suiviFinancierOperationTravaux(operation({ coproprieteId: 'copro-autre' }), b)).toThrow(/appliqué à l'opération 00042 \(copro-autre\)/)
  })

  it('échéances d’un autre syndicat ignorées ; plusieurs clés : chaque échéance appelée compte', () => {
    const ailleurs = suiviesAvecPremiereAppelee(op).map((e) => ({ ...e, coproprieteId: 'copro-autre', statut: 'Appelé' as const }))
    expect(suiviFinancierOperationTravaux(op, b, { suivies: ailleurs }).fondsAppelesCentimes).toBe(0)
    const deuxCles = sansFonds({
      cles: [
        { cleId: 'cle-001', budgetTtcCentimes: 8_000_000 },
        { cleId: 'cle-bat-B', budgetTtcCentimes: 4_000_000 },
      ],
    })
    const suivies = suivreEcheances(echeancesTravaux(deuxCles)).map((e) => (e.id.startsWith('00042-T1-') ? { ...e, statut: 'Appelé' as const } : e))
    const s = suiviFinancierOperationTravaux(deuxCles, budget(deuxCles), { suivies, postes: [poste('P1', '00042-T1-C2', 100_000)] })
    expect(s).toMatchObject({ fondsAppelesCentimes: 3_600_000, encaisseCentimes: 100_000, appelsNonRecusCentimes: 3_500_000, appelsVotesCentimes: 12_000_000 })
  })
})

describe('suivi financier : anomalies', () => {
  it('projet sans décision : ni budget adopté, ni solde budgétaire, ni appels votés ; part du fonds sans décision bloquante', () => {
    const projet = operation({ decision: null })
    const suivi = suiviFinancierOperationTravaux(projet, budget(projet))
    expect(suivi).toMatchObject({ budgetAdopteCentimes: null, soldeBudgetaireCentimes: null, appelsVotesCentimes: null, fondsAppelesCentimes: 0 })
    expect(suivi.anomalies.map((a) => [a.code, a.gravite, a.fondement])).toEqual([
      ['sans_decision', 'information', null],
      ['part_fonds_non_autorisee', 'bloquant', 'L. 1965 art. 14-2-1, I'],
    ])
    expect(suivi.anomalies[1].message).toContain("rattacher la décision d'assemblée qui affecte le fonds")
  })

  it('usage judiciaire du fonds sans ordonnance : fondé sur l’art. 29-14, 2°', () => {
    const op = operation({ decision: { date: '2026-03-12', resolution: 'Décision AP-3', origine: 'administrateur' }, affectationFonds: { objet: 'redressement_29_14' } })
    const anomalie = suiviFinancierOperationTravaux(op, budget(op)).anomalies.find((a) => a.code === 'part_fonds_non_autorisee')
    expect(anomalie).toMatchObject({ gravite: 'bloquant', fondement: 'L. 1965 art. 29-14, 2°' })
    expect(anomalie?.message).toContain("ordonnance du juge")
  })

  it('emploi du fonds pour une dépense exclue : contrôle d’affectation (J4) bloquant', () => {
    const op = operation()
    const suivi = suiviFinancierOperationTravaux(op, budget(op), { emploisFonds: [emploiLibre('E2', 100_000, 'charges_courantes'), { ...emploiLibre('E3', 5), operationNumero: '00099' }] })
    expect(suivi.anomalies.filter((a) => a.code === 'emploi_fonds_non_autorise')).toEqual([
      expect.objectContaining({ gravite: 'bloquant', fondement: 'L. 1965 art. 14-2-1, I', message: expect.stringContaining('Charges courantes') }),
    ])
    expect(suivi.emploiFondsTravauxCentimes).toBe(100_000)
  })

  it('emplois au-delà de la part de l’opération : aucune décision d’affectation au-delà', () => {
    const op = operation()
    const emplois = [emploiLibre('E4', 1_500_000), emploiLibre('E5', 600_000)]
    const anomalie = suiviFinancierOperationTravaux(op, budget(op), { emploisFonds: emplois }).anomalies.find((a) => a.code === 'emploi_au_dela_de_la_part')
    expect(anomalie).toMatchObject({ gravite: 'bloquant', fondement: 'L. 1965 art. 14-2-1, I, al. 7' })
    expect(suiviFinancierOperationTravaux(op, budget(op), { emploisFonds: [emploiLibre('E6', 2_000_000)] }).anomalies).toEqual([])
  })

  it('engagé au-delà du budget adopté (alerte du suivi gardée, J67, R59) ; tranches qui ne couvrent pas le montant à appeler', () => {
    const op = sansFonds({ budgetTtcCentimes: 10_000_000, tranches: [{ date: '2026-05-01', tauxPct: 50 }] })
    const suivi = suiviFinancierOperationTravaux(op, budget(op))
    expect(suivi.soldeBudgetaireCentimes).toBe(-800_000)
    expect(suivi.anomalies.map((a) => [a.code, a.gravite, a.aConfirmer])).toEqual([
      ['engage_superieur_au_budget', 'avertissement', false],
      ['tranches_inferieures_au_montant_a_appeler', 'information', false],
    ])
    expect(suivi.appelsVotesCentimes).toBe(5_000_000)
  })

  it('réglé au-delà de l’engagé du poste (art. 14-3) ; encaissé au-delà de l’appelé ; trésorerie négative', () => {
    const op = sansFonds()
    const b = creerBudgetOperationTravaux(op, { lignes: [{ poste: 'dommagesOuvrage', budgetTtcCentimes: 100_000 }], postesDesReglements: { r1: 'dommagesOuvrage' } })
    const suivi = suiviFinancierOperationTravaux(op, b, { reglements: [reglement('r1', 'Enregistré', 150_000)], postes: [poste('P1', '00042-T2', 20_000)] })
    expect(suivi.anomalies.map((a) => [a.code, a.fondement])).toEqual([
      ['regle_superieur_a_l_engage', 'L. 1965 art. 14-3, al. 2'],
      ['encaisse_superieur_a_l_appele', null],
      ['tresorerie_negative', null],
    ])
    expect(suivi.postes[1].resteAReglerCentimes).toBe(-50_000)
    expect(suivi.soldeTresorerieCentimes).toBe(-130_000)
  })
})

describe('honoraires sur travaux : cadre selon le régime du mandat', () => {
  it('syndic désigné par l’assemblée : honoraires votés avec les travaux (art. 18-1 A, III)', () => {
    expect(cadreHonorairesTravaux({ regime: 'syndic' })).toMatchObject({ cadre: 'vote_avec_les_travaux', fondements: ['L. 1965 art. 18-1 A, III'], arreteParLeJuge: false, aConfirmer: false })
  })

  it('syndic désigné en justice : même cadre (D. 1967 art. 46, al. 3 ; J67, R12) ; art. 47 : fixée par le président (J73)', () => {
    expect(cadreHonorairesTravaux({ regime: 'sj' })).toMatchObject({ cadre: 'vote_avec_les_travaux', aConfirmer: false })
    expect(cadreHonorairesTravaux({ regime: 'sj' }).fondements).toContain('D. 1967 art. 46, al. 3')
    expect(cadreHonorairesTravaux({ regime: 'sj' }).motif).not.toContain('à confirmer')
    expect(cadreHonorairesTravaux({ regime: 'ap47' })).toMatchObject({ cadre: 'fixe_par_le_president', aConfirmer: false })
  })

  it('J73 : art. 47, R1 l’emporte sur R12 : rémunération fixée par le président de la juridiction qui l’a désigné (C. com. R. 814-27 ; CPC 714 à 718)', () => {
    expect(CADRES_HONORAIRES_TRAVAUX).toContain('fixe_par_le_president')
    const ap47 = cadreHonorairesTravaux({ regime: 'ap47' })
    expect(ap47).toMatchObject({ cadre: 'fixe_par_le_president', arreteParLeJuge: true, aConfirmer: false })
    expect(ap47.fondements).toEqual(['D. 1967 art. 47', 'C. com. R. 814-27', 'CPC art. 714 à 718'])
    expect(ap47.motif).toMatch(
      /^Administrateur provisoire désigné faute de syndic \(D\. 1967 art\. 47\) : rémunération fixée par le président de la juridiction qui l'a désigné, sur justification de l'accomplissement de la mission \(C\. com\. R\. 814-27 ; recours : CPC art\. 714 à 718 ; J73\)/,
    )
    expect(ap47.motif).not.toMatch(/non établi|à confirmer|R12|Hugo|Frédéric/)
    const op = operation()
    // poste « Honoraires cabinet » : une prévision à soumettre au président, jamais un élément à facturer
    const [information] = controlerHonorairesTravaux(op, budget(op), { cadre: ap47 })
    expect(information).toMatchObject({
      code: 'honoraires_arretes_par_le_juge',
      gravite: 'information',
      fondement: 'D. 1967 art. 47 ; C. com. R. 814-27 ; CPC art. 714 à 718',
      aConfirmer: false,
    })
    expect(information.message).toContain('aucun élément à facturer au syndicat')
    expect(codes(controlerHonorairesTravaux(op, budget(op), { cadre: ap47 }))).not.toContain('honoraires_cadre_non_etabli')
  })

  it('J73 : tout honoraire voté par l’assemblée sous l’art. 47 reste signalé, avec le motif de l’art. 47 (pas celui de l’art. 29-1)', () => {
    const op = operation()
    const vote = { date: '2026-03-12', resolution: 'Résolution 9', majorite: 'art24' as const, mode: 'pourcentage_ht' as const }
    const anomalies = controlerHonorairesTravaux(op, budget(op), { cadre: cadreHonorairesTravaux({ regime: 'ap47' }), resolutionHonoraires: vote })
    expect(codes(anomalies)).toEqual(['honoraires_arretes_par_le_juge', 'honoraires_votes_sous_administration_provisoire'])
    const [, voteSignale] = anomalies
    expect(voteSignale).toMatchObject({ gravite: 'avertissement', aConfirmer: false })
    expect(voteSignale.message).toBe(
      "Résolution 9 : honoraires votés par l'assemblée, alors que la rémunération de l'administrateur provisoire désigné faute de syndic est fixée par le président de la juridiction qui l'a désigné (C. com. R. 814-27 ; J73), pas un vote de l'art. 18-1 A, III.",
    )
    // sans honoraires au budget, le vote seul reste signalé
    const sansHonoraires = creerBudgetOperationTravaux(op, { lignes: [{ poste: 'travaux', budgetTtcCentimes: 1 }] })
    expect(codes(controlerHonorairesTravaux(op, sansHonoraires, { cadre: cadreHonorairesTravaux({ regime: 'ap47' }), resolutionHonoraires: vote }))).toEqual([
      'honoraires_votes_sous_administration_provisoire',
    ])
    // art. 29-1 : motif inchangé
    const ap291 = controlerHonorairesTravaux(op, budget(op), { cadre: cadreHonorairesTravaux({ regime: 'ap291', nbLots: 120 }), resolutionHonoraires: vote })
    expect(ap291[1].message).toContain('suit le décret et la décision du juge (L. 1965 art. 29-1, II)')
  })

  it('administrateur provisoire de l’art. 29-1 : barème de l’art. 11 sous 500 lots, juge à 500 lots et plus, renforcée à part', () => {
    expect(cadreHonorairesTravaux({ regime: 'ap291', nbLots: 499 })).toMatchObject({ cadre: 'droit_proportionnel_administrateur_provisoire', arreteParLeJuge: true })
    expect(cadreHonorairesTravaux({ regime: 'ap291', nbLots: 500 })).toMatchObject({ cadre: 'fixe_par_le_juge', arreteParLeJuge: true, aConfirmer: false })
    // administration provisoire renforcée : hors barème, rémunération arrêtée par le juge, confirmé (J67, R12)
    expect(cadreHonorairesTravaux({ regime: 'ap291', nbLots: 40, administrationRenforcee: true })).toMatchObject({ cadre: 'fixe_par_le_juge', aConfirmer: false })
    expect(cadreHonorairesTravaux({ regime: 'ap291', nbLots: 40, administrationRenforcee: true }).motif).not.toContain('à confirmer')
    expect(cadreHonorairesTravaux({ regime: 'ap291', nbLots: 40 }).fondements).toEqual(['L. 1965 art. 29-1, II', 'D. 1967 art. 61-1-5', 'Arrêté du 8 octobre 2015, art. 11'])
  })

  it('refuse un nombre de lots absent sous l’art. 29-1, et l’administration renforcée hors de l’art. 29-1', () => {
    expect(() => cadreHonorairesTravaux({ regime: 'ap291' })).toThrow(/Nombre de lots invalide/)
    expect(() => cadreHonorairesTravaux({ regime: 'ap291', nbLots: 0 })).toThrow(/Nombre de lots invalide/)
    expect(() => cadreHonorairesTravaux({ regime: 'sj', administrationRenforcee: true })).toThrow(/renforcée hors/)
  })
})

describe('droit proportionnel de l’administrateur provisoire sur travaux (arrêté du 8 octobre 2015, art. 11)', () => {
  it('barème lu : 2 % jusqu’à 12 500 €, 1,5 % jusqu’à 25 000 €, 1 % au-delà', () => {
    expect(BAREME_DROIT_PROPORTIONNEL_TRAVAUX).toEqual([
      { jusquACentimes: 1_250_000, tauxPourMille: 20 },
      { jusquACentimes: 2_500_000, tauxPourMille: 15 },
      { jusquACentimes: null, tauxPourMille: 10 },
    ])
  })

  it('calcul par tranches, arrondi au centime du total', () => {
    const droit = (euros: number) => droitProportionnelTravauxAdministrateurProvisoire(euros).droitHtCentimes
    expect(droit(0)).toBe(0)
    expect(droit(33)).toBe(1)
    expect(droit(1_000_000)).toBe(20_000)
    expect(droit(1_250_000)).toBe(25_000)
    expect(droit(1_250_001)).toBe(25_000)
    expect(droit(2_500_000)).toBe(43_750)
    // 40 000 € HT : 250 € + 187,50 € + 150 € = 587,50 €
    const detail = droitProportionnelTravauxAdministrateurProvisoire(4_000_000)
    expect(detail).toMatchObject({ droitHtCentimes: 58_750, depasseSeuilArticle15: false, aConfirmer: true })
    expect(detail.tranches).toEqual([
      { tauxPct: 2, baseCentimes: 1_250_000 },
      { tauxPct: 1.5, baseCentimes: 1_250_000 },
      { tauxPct: 1, baseCentimes: 1_500_000 },
    ])
  })

  it('art. 15 : signalé quand le droit de l’opération excède 75 000 € HT', () => {
    expect(droitProportionnelTravauxAdministrateurProvisoire(748_125_000)).toMatchObject({ droitHtCentimes: 7_500_000, depasseSeuilArticle15: false })
    expect(droitProportionnelTravauxAdministrateurProvisoire(748_125_100)).toMatchObject({ droitHtCentimes: 7_500_001, depasseSeuilArticle15: true })
  })

  it('refuse un montant qui n’est pas en centimes entiers positifs', () => {
    expect(() => droitProportionnelTravauxAdministrateurProvisoire(-1)).toThrow(/centimes entiers/)
    expect(() => droitProportionnelTravauxAdministrateurProvisoire(1.5)).toThrow(/centimes entiers/)
  })
})

/**
 * Décision J39 de Hugo (06/11/2026, question de la PR #651, point 31) : le barème de l'art. 11 de l'arrêté du 8 octobre
 * 2015 s'applique OPÉRATION PAR OPÉRATION. Chaque opération a son propre calcul par tranches ; le droit de plusieurs
 * opérations est la somme de leurs droits, jamais le barème appliqué au cumul de leurs montants.
 */
describe('J39 — droit proportionnel opération par opération, jamais sur le cumul de plusieurs opérations', () => {
  const droitDuBloc = (centimes: number) => droitProportionnelTravauxAdministrateurProvisoire(centimes).droitHtCentimes

  it('deux opérations de 12 500 € HT : 250 € chacune, 500 € en tout ; le barème sur le cumul (25 000 €) donnerait 437,50 €', () => {
    const deux = droitsProportionnelsTravauxParOperation([
      { numero: 'T-1', montantTravauxHtCentimes: 1_250_000 },
      { numero: 'T-2', montantTravauxHtCentimes: 1_250_000 },
    ])
    expect(deux.operations.map((o) => [o.numero, o.droit.droitHtCentimes])).toEqual([
      ['T-1', 25_000],
      ['T-2', 25_000],
    ])
    expect(deux.totalDroitHtCentimes).toBe(50_000)
    expect(droitDuBloc(2_500_000)).toBe(43_750)
    expect(deux.totalDroitHtCentimes).not.toBe(droitDuBloc(2_500_000))
    // Chaque opération repart de la première tranche du barème (2 % jusqu'à 12 500 €).
    for (const { droit } of deux.operations) expect(droit.tranches[0]).toEqual({ tauxPct: 2, baseCentimes: 1_250_000 })
  })

  it('trois opérations : chacune son barème ; le total n’est jamais celui du cumul des montants', () => {
    const trois = droitsProportionnelsTravauxParOperation([
      { numero: 'T-1', montantTravauxHtCentimes: 4_000_000 },
      { numero: 'T-2', montantTravauxHtCentimes: 1_000_000 },
      { numero: 'T-3', montantTravauxHtCentimes: 3_000_000 },
    ])
    // 587,50 € + 200 € + 487,50 € = 1 275 € ; sur le cumul de 80 000 € : 987,50 €.
    expect(trois.operations.map((o) => o.droit.droitHtCentimes)).toEqual([58_750, 20_000, 48_750])
    expect(trois.totalDroitHtCentimes).toBe(127_500)
    expect(droitDuBloc(8_000_000)).toBe(98_750)
    for (const o of trois.operations) expect(o.droit).toEqual(droitProportionnelTravauxAdministrateurProvisoire(o.montantTravauxHtCentimes))
  })

  it('l’arrondi au centime se fait opération par opération, pas sur le cumul', () => {
    const petites = droitsProportionnelsTravauxParOperation([
      { numero: 'T-1', montantTravauxHtCentimes: 33 },
      { numero: 'T-2', montantTravauxHtCentimes: 33 },
    ])
    expect(petites.totalDroitHtCentimes).toBe(2)
    expect(droitDuBloc(66)).toBe(1)
  })

  it('numéro vide refusé ; aucune opération : aucun droit ; opération en double : refus (décision du 20/11/2026, partie C, F62), pas une décision J39', () => {
    const doublon = () =>
      droitsProportionnelsTravauxParOperation([
        { numero: 'T-1', montantTravauxHtCentimes: 1_000_000 },
        { numero: ' T-1 ', montantTravauxHtCentimes: 250_000 },
      ])
    expect(doublon).toThrow(/Opération T-1 fournie deux fois : refusée ; additionnez les montants de l'opération avant le calcul/)
    expect(doublon).toThrow(/partie C, F62/)
    expect(doublon).toThrow(/deux calculs pour une même opération feraient repartir le barème de sa première tranche/)
    // J39 dit seulement que chaque opération a son propre calcul : le refus du doublon ne l'invoque pas.
    expect(doublon).not.toThrow(/J39/)
    expect(() => droitsProportionnelsTravauxParOperation([{ numero: ' ', montantTravauxHtCentimes: 1_000 }])).toThrow(/numéro/i)
    expect(() => droitsProportionnelsTravauxParOperation([{ numero: 'T-1', montantTravauxHtCentimes: -1 }])).toThrow(/centimes entiers/)
    expect(droitsProportionnelsTravauxParOperation([])).toMatchObject({ operations: [], totalDroitHtCentimes: 0, depasseSeuilArticle15: false })
  })

  it('art. 15 : le total des droits de l’art. 11 des opérations est rapproché du seuil de 75 000 € HT', () => {
    // 37 500 € de droit par opération : 75 000 € en tout, seuil non dépassé ; un centime de plus le dépasse.
    const total = (seconde: number) =>
      droitsProportionnelsTravauxParOperation([
        { numero: 'T-1', montantTravauxHtCentimes: 373_125_000 },
        { numero: 'T-2', montantTravauxHtCentimes: seconde },
      ])
    expect(total(373_125_000)).toMatchObject({ totalDroitHtCentimes: 7_500_000, depasseSeuilArticle15: false })
    const auDela = total(373_125_100)
    expect(auDela).toMatchObject({ totalDroitHtCentimes: 7_500_001, depasseSeuilArticle15: true, aConfirmer: true })
    expect(auDela.operations.every((o) => !o.droit.depasseSeuilArticle15)).toBe(true)
    expect(auDela.fondements).toEqual(['Arrêté du 8 octobre 2015, art. 11 et 15', 'D. 1967 art. 61-1-5, I, 2°'])
  })
})

describe('honoraires sur travaux : contrôle du poste « Honoraires cabinet »', () => {
  const op = operation()
  const b = budget(op)
  const syndic = cadreHonorairesTravaux({ regime: 'syndic' })
  const vote = { date: '2026-03-12', resolution: 'Résolution 9', majorite: 'art24' as const, mode: 'pourcentage_ht' as const }

  it('voté à la même assemblée, à la même majorité, en pourcentage du hors taxes : rien à signaler', () => {
    expect(controlerHonorairesTravaux(op, b, { cadre: syndic, resolutionHonoraires: vote })).toEqual([])
  })

  it('sans vote, à une autre assemblée, à une autre majorité, au forfait : signalé (art. 18-1 A, III)', () => {
    expect(codes(controlerHonorairesTravaux(op, b, { cadre: syndic }))).toEqual(['honoraires_sans_vote'])
    const ecarts = controlerHonorairesTravaux(op, b, { cadre: syndic, resolutionHonoraires: { ...vote, date: '2026-06-20', majorite: 'art25', mode: 'forfait_ttc' } })
    expect(ecarts.map((a) => [a.code, a.fondement])).toEqual([
      ['honoraires_autre_assemblee', 'L. 1965 art. 18-1 A, III'],
      ['honoraires_majorite_differente', 'L. 1965 art. 18-1 A, III'],
      ['honoraires_au_forfait', 'L. 1965 art. 18-1 A, III'],
    ])
  })

  it('projet sans décision : honoraires sans travaux votés ; syndic judiciaire : même cadre, confirmé (J67, R12)', () => {
    const projet = sansFonds({ decision: null })
    const [anomalie] = controlerHonorairesTravaux(projet, budget(projet), { cadre: cadreHonorairesTravaux({ regime: 'sj' }), resolutionHonoraires: vote })
    expect(anomalie).toMatchObject({ code: 'honoraires_sans_vote', aConfirmer: false, message: expect.stringContaining('sans travaux votés') })
  })

  describe('J67, R13 — taux dégressif selon l’importance des travaux (art. 18-1 A, III) : alerte, jamais un blocage', () => {
    const paliers = (...taux: number[]) => taux.map((tauxPct, i) => ({ jusquACentimes: i === taux.length - 1 ? null : (i + 1) * 5_000_000, tauxPct }))
    const controle = (p: ReturnType<typeof paliers>, cadre = syndic) => controlerHonorairesTravaux(op, b, { cadre, resolutionHonoraires: { ...vote, paliers: p } })

    it('barème dégressif : rien à signaler ; barème non saisi : non contrôlé', () => {
      expect(controle(paliers(3, 2.5, 2))).toEqual([])
      expect(controlerHonorairesTravaux(op, b, { cadre: syndic, resolutionHonoraires: vote })).toEqual([])
    })

    it('taux unique, ou palier dont le taux monte avec le montant : avertissement « à vérifier »', () => {
      for (const p of [paliers(3), paliers(2, 2), paliers(2, 3), paliers(3, 2, 2.5)]) {
        const anomalies = controle(p)
        expect(anomalies).toEqual([expect.objectContaining({ code: 'honoraires_taux_non_degressif', gravite: 'avertissement', fondement: 'L. 1965 art. 18-1 A, III' })])
        expect(anomalies[0].message).toContain('taux dégressif selon l\'importance des travaux')
        expect(anomalies[0].message).toContain('travaux du II de l\'art. 14-1')
        expect(anomalies[0].message).toContain('à vérifier')
      }
      expect(controle(paliers(3))[0].message).toContain('taux unique de 3 %')
      expect(controle(paliers(2, 3))[0].message).toMatch(/taux de 3 % au-delà de 50\s000,00\s€, supérieur au palier précédent \(2 %\)/)
    })

    it('hors du cadre du syndic, le barème n’est pas contrôlé ; un barème mal saisi est refusé', () => {
      expect(codes(controle(paliers(3), cadreHonorairesTravaux({ regime: 'ap291', nbLots: 120 })))).not.toContain('honoraires_taux_non_degressif')
      expect(() => controle([{ jusquACentimes: null, tauxPct: 0 }])).toThrow(/barème des honoraires/)
      expect(() => controle([{ jusquACentimes: 5_000_000, tauxPct: 3 }])).toThrow(/barème des honoraires/)
      expect(() => controle([{ jusquACentimes: 5_000_000, tauxPct: 3 }, { jusquACentimes: 4_000_000, tauxPct: 2 }, { jusquACentimes: null, tauxPct: 1 }])).toThrow(/barème des honoraires/)
      expect(() => controlerHonorairesTravaux(op, b, { cadre: syndic, resolutionHonoraires: { ...vote, mode: 'forfait_ttc', paliers: paliers(3) } })).toThrow(/barème des honoraires/)
    })
  })

  it('aucun honoraire ni vote : aucun contrôle', () => {
    const sansHonoraires = creerBudgetOperationTravaux(op, { lignes: [{ poste: 'travaux', budgetTtcCentimes: 1 }] })
    expect(controlerHonorairesTravaux(op, sansHonoraires, { cadre: syndic })).toEqual([])
  })

  it('administrateur provisoire : prévision soumise au juge, jamais un élément à facturer ; un vote d’honoraires est signalé', () => {
    const ap = cadreHonorairesTravaux({ regime: 'ap291', nbLots: 120 })
    const [information] = controlerHonorairesTravaux(op, b, { cadre: ap })
    expect(information).toMatchObject({ code: 'honoraires_arretes_par_le_juge', gravite: 'information' })
    expect(information.message).toContain('aucun élément à facturer au syndicat')
    expect(information.fondement).toBe('L. 1965 art. 29-1, II ; D. 1967 art. 61-1-5 ; Arrêté du 8 octobre 2015, art. 11')
    expect(codes(controlerHonorairesTravaux(op, b, { cadre: ap, resolutionHonoraires: vote }))).toEqual([
      'honoraires_arretes_par_le_juge',
      'honoraires_votes_sous_administration_provisoire',
    ])
  })

  it('J73 : art. 47, plus de cadre non établi : prévision soumise au président, information sans « à confirmer »', () => {
    expect(controlerHonorairesTravaux(op, b, { cadre: cadreHonorairesTravaux({ regime: 'ap47' }) })).toEqual([
      expect.objectContaining({ code: 'honoraires_arretes_par_le_juge', gravite: 'information', aConfirmer: false }),
    ])
  })
})

describe('affectation de la part du fonds de l’opération (travaux-operations.ts, ajout du point 31)', () => {
  it('objet, décision qui affecte le fonds (la résolution des travaux à défaut d’une décision distincte), ordonnance', () => {
    expect(affectationFondsDeLOperation(operation())).toEqual({ objet: 'travaux_hors_ppt', decisionAg: 'Résolution 8 (AG du 12/03/2026)', autorisationJuge: null })
    expect(affectationFondsDeLOperation(operation({ affectationFonds: { objet: 'travaux_hors_ppt', decisionAg: 'Résolution 9' } }))?.decisionAg).toBe('Résolution 9')
    expect(affectationFondsDeLOperation(sansFonds())).toBeNull()
  })

  it('les plafonds d’emploi des tranches portent la même affectation (comportement du point 30 inchangé)', () => {
    const op = operation()
    expect(emploisFondsTravauxDesTranches(op).map((e) => e.affectation)).toEqual([1, 2, 3].map(() => affectationFondsDeLOperation(op)))
  })
})

describe('emploi du fonds pour l’opération : contrôle avant le décaissement', () => {
  const op = operation()
  const decisionAp = { date: '2026-03-12', resolution: 'Décision AP-3', origine: 'administrateur' as const }

  it('admis dans la part, compte tenu des emplois déjà faits ; reste de la part avant l’emploi', () => {
    expect(controlerEmploiFondsOperation(op, { montantCentimes: 1_500_000 })).toEqual({
      autorise: true,
      cause: 'admis',
      motif: expect.stringContaining('affectation admise'),
      fondement: 'L. 1965 art. 14-2-1, I',
      aConfirmer: false,
      cleId: 'cle-001',
      resteCentimes: 2_000_000,
      resteCleCentimes: 2_000_000,
    })
    expect(controlerEmploiFondsOperation(op, { montantCentimes: 500_000, dejaEmployeCentimes: 1_500_000 })).toMatchObject({ autorise: true, resteCentimes: 500_000 })
  })

  it('au-delà de la part restante : refusé, aucune décision d’affectation au-delà (art. 14-2-1, I, al. 7)', () => {
    const controle = controlerEmploiFondsOperation(op, { montantCentimes: 500_001, dejaEmployeCentimes: 1_500_000 })
    expect(controle).toMatchObject({ autorise: false, cause: 'au_dela_de_la_part', fondement: 'L. 1965 art. 14-2-1, I, al. 7', resteCentimes: 500_000 })
    expect(controle.motif).toMatch(/Emploi de 5\s000,01\s€ au-delà du reste de la part/)
    expect(controlerEmploiFondsOperation(op, { montantCentimes: 1, dejaEmployeCentimes: 2_500_000 })).toMatchObject({ cause: 'au_dela_de_la_part', resteCentimes: 0 })
  })

  it('« Ne pas utiliser les fonds travaux » (part nulle) : refusé pour l’absence de part, la case au motif ; opération sans part : refusé', () => {
    // La case exige une part nulle : le refus certain « sans_part » n'est pas masqué par la case (relecture, tour 2).
    expect(controlerEmploiFondsOperation(sansFonds({ nePasUtiliserFondsTravaux: true }), { montantCentimes: 1 })).toMatchObject({
      autorise: false,
      cause: 'sans_part',
      fondement: 'L. 1965 art. 14-2-1, I, al. 7',
      aConfirmer: false,
      motif: expect.stringContaining('« Ne pas utiliser les fonds travaux »'),
      resteCentimes: 0,
    })
    expect(controlerEmploiFondsOperation(sansFonds(), { montantCentimes: 1 })).toMatchObject({
      autorise: false,
      cause: 'sans_part',
      fondement: 'L. 1965 art. 14-2-1, I, al. 7',
      resteCentimes: 0,
    })
  })

  it('affectation non admise : cause du contrôle J4 (décision d’assemblée manquante ; ordonnance manquante, art. 29-14, 2°)', () => {
    // Projet sans décision : refusé avant le contrôle J4 (relecture du point 31, tour 1).
    expect(controlerEmploiFondsOperation(operation({ decision: null }), { montantCentimes: 100 })).toMatchObject({
      autorise: false,
      cause: 'decision_manquante',
      fondement: 'L. 1965 art. 14-2-1, I, al. 7',
    })
    const sansOrdonnance = operation({ decision: decisionAp, affectationFonds: { objet: 'redressement_29_14' } })
    expect(controlerEmploiFondsOperation(sansOrdonnance, { montantCentimes: 100 })).toMatchObject({
      autorise: false,
      cause: 'autorisation_manquante',
      fondement: 'L. 1965 art. 29-14, 2°',
    })
    const avecOrdonnance = operation({ decision: decisionAp, affectationFonds: { objet: 'redressement_29_14', autorisationJuge: 'TJ, ordonnance du 02/02/2026, n° 26/00042' } })
    expect(controlerEmploiFondsOperation(avecOrdonnance, { montantCentimes: 100 })).toMatchObject({ autorise: true, cause: 'admis', fondement: 'L. 1965 art. 29-14, 2°' })
  })

  it('refuse un montant nul ou qui n’est pas en centimes entiers, un déjà employé négatif', () => {
    expect(() => controlerEmploiFondsOperation(op, { montantCentimes: 0 })).toThrow(/strictement positifs/)
    expect(() => controlerEmploiFondsOperation(op, { montantCentimes: 10.5 })).toThrow(/strictement positifs/)
    expect(() => controlerEmploiFondsOperation(op, { montantCentimes: 1, dejaEmployeCentimes: -1 })).toThrow(/centimes entiers/)
  })
})

describe('règlements de l’opération payés depuis un compte du fonds de travaux', () => {
  const surCompte = (id: string, statut: StatutReglementFournisseur, montantCentimes: number, banqueId: string, coproprieteId = 'copro-tilleuls') =>
    ({ ...reglement(id, statut, montantCentimes, coproprieteId), banqueId }) as ReglementFournisseur
  const reglements = [
    surCompte('r1', 'Enregistré', 100_000, 'bq-fonds'),
    surCompte('r2', 'Demandé', 40_000, 'bq-fonds'),
    surCompte('r3', 'Enregistré', 50_000, 'bq-courant'),
    surCompte('r4', 'Annulé', 10_000, 'bq-fonds'),
    surCompte('r5', 'Enregistré', 1, 'bq-fonds', 'copro-autre'),
  ]
  const signales = (op: OperationTravaux, banquesDuFondsTravaux?: string[]) =>
    suiviFinancierOperationTravaux(op, budget(op), { reglements, banquesDuFondsTravaux }).anomalies.filter((a) => a.code === 'reglement_sur_compte_du_fonds')

  it('opération marquée « Ne pas utiliser les fonds travaux » (part nulle) : chaque règlement non annulé est bloquant, fondé sur l’absence de part', () => {
    const anomalies = signales(sansFonds({ nePasUtiliserFondsTravaux: true }), ['bq-fonds'])
    // Exclu dans les deux lectures de la question ouverte du bouton : rien à confirmer (relecture, tour 1) ; la case
    // exige une part nulle, dont le fondement (al. 7) n'est pas retiré par la case (relecture, tour 2).
    expect(anomalies.map((a) => [a.gravite, a.fondement, a.aConfirmer])).toEqual([
      ['bloquant', 'L. 1965 art. 14-2-1, I, al. 7', false],
      ['bloquant', 'L. 1965 art. 14-2-1, I, al. 7', false],
    ])
    expect(anomalies[0].message).toContain('Règlement r1')
    expect(anomalies[1].message).toContain('Règlement r2')
  })

  it('opération sans part du fonds : bloquant, aucune affectation du fonds à l’opération (art. 14-2-1, I, al. 7)', () => {
    expect(signales(sansFonds(), ['bq-fonds']).map((a) => [a.gravite, a.fondement])).toEqual([
      ['bloquant', 'L. 1965 art. 14-2-1, I, al. 7'],
      ['bloquant', 'L. 1965 art. 14-2-1, I, al. 7'],
    ])
  })

  it('opération avec une part du fonds, ou comptes du fonds non fournis : rien de signalé', () => {
    expect(signales(operation(), ['bq-fonds'])).toEqual([])
    expect(signales(sansFonds({ nePasUtiliserFondsTravaux: true }))).toEqual([])
  })
})

describe('relecture du point 31 — emploi du fonds par clé (art. 14-2-1, I, al. 7 ; J4)', () => {
  // Clé A : 60 000 € dont 6 000 € du fonds ; clé B : 40 000 € dont 4 000 € ; part totale 10 000 €.
  const deuxCles = (): OperationTravaux =>
    operation({
      budgetTtcCentimes: 10_000_000,
      financementFondsTravauxCentimes: 1_000_000,
      cles: [
        { cleId: 'cle-001', budgetTtcCentimes: 6_000_000, financementFondsTravauxCentimes: 600_000 },
        { cleId: 'cle-bat-B', budgetTtcCentimes: 4_000_000, financementFondsTravauxCentimes: 400_000 },
      ],
    })

  it('un emploi au-delà de la part de sa clé est refusé, même dans la part totale de l’opération', () => {
    const op = deuxCles()
    const controle = controlerEmploiFondsOperation(op, { montantCentimes: 1_000_000, cleId: 'cle-001' })
    expect(controle).toMatchObject({
      autorise: false,
      cause: 'au_dela_de_la_part_de_la_cle',
      fondement: 'L. 1965 art. 14-2-1, I, al. 7',
      cleId: 'cle-001',
      resteCentimes: 1_000_000,
      resteCleCentimes: 600_000,
    })
    expect(controle.motif).toContain('clé « cle-001 »')
    expect(controlerEmploiFondsOperation(op, { montantCentimes: 600_000, cleId: 'cle-001' })).toMatchObject({ autorise: true, cause: 'admis', resteCleCentimes: 600_000 })
    expect(controlerEmploiFondsOperation(op, { montantCentimes: 400_000, cleId: 'cle-bat-B' })).toMatchObject({ autorise: true, resteCleCentimes: 400_000 })
  })

  it('le déjà employé de la clé borne le nouvel emploi ; une clé étrangère à l’opération est refusée', () => {
    const op = deuxCles()
    expect(
      controlerEmploiFondsOperation(op, { montantCentimes: 200_000, cleId: 'cle-bat-B', dejaEmployeCentimes: 700_000, dejaEmployeSurLaCleCentimes: 300_000 }),
    ).toMatchObject({ autorise: false, cause: 'au_dela_de_la_part_de_la_cle', resteCentimes: 300_000, resteCleCentimes: 100_000 })
    const etrangere = controlerEmploiFondsOperation(op, { montantCentimes: 100, cleId: 'cle-Z' })
    expect(etrangere).toMatchObject({ autorise: false, cause: 'cle_sans_part', fondement: 'L. 1965 art. 14-2-1, I, al. 7', resteCleCentimes: 0 })
    expect(etrangere.motif).toContain('étrangère à l')
    expect(controlerEmploiFondsOperation(operation(), { montantCentimes: 100, cleId: 'cle-Z' })).toMatchObject({ autorise: false, cause: 'cle_sans_part' })
  })

  it('plusieurs clés : la clé de l’emploi et son déjà employé sont exigés ; une seule clé : celle de l’opération par défaut', () => {
    const op = deuxCles()
    expect(() => controlerEmploiFondsOperation(op, { montantCentimes: 100 })).toThrow(/clé de la dépense exigée/)
    expect(() => controlerEmploiFondsOperation(op, { montantCentimes: 100, cleId: 'cle-001', dejaEmployeCentimes: 100 })).toThrow(/déjà faits sur la clé « cle-001 » exigés/)
    expect(() =>
      controlerEmploiFondsOperation(op, { montantCentimes: 100, cleId: 'cle-001', dejaEmployeCentimes: 100, dejaEmployeSurLaCleCentimes: 200 }),
    ).toThrow(/supérieurs à ceux de l'opération/)
    expect(controlerEmploiFondsOperation(operation(), { montantCentimes: 100, dejaEmployeCentimes: 500 })).toMatchObject({ cleId: 'cle-001', resteCleCentimes: 1_999_500 })
  })

  it('suivi : les emplois sont rapprochés de la part de leur clé ; une clé étrangère est signalée', () => {
    const op = deuxCles()
    const budget = (o: OperationTravaux): BudgetOperationTravaux => creerBudgetOperationTravaux(o, { lignes: [] })
    const surCle = (id: string, montantCentimes: number, cleId: string): EmploiFondsTravaux => ({ ...emploiLibre(id, montantCentimes), cleId })
    // emploiDepuisOperation rattache tout emploi à la première clé (branchement signalé dans l'en-tête).
    const tout = suiviFinancierOperationTravaux(op, budget(op), { emploisFonds: [emploiDepuisOperation(op, { id: 'E1', date: '2026-04-01', montantCentimes: 1_000_000 })] })
    expect(tout.anomalies.map((a) => [a.code, a.gravite, a.fondement])).toEqual([['emploi_au_dela_de_la_part_de_la_cle', 'bloquant', 'L. 1965 art. 14-2-1, I, al. 7']])
    expect(tout.anomalies[0].message).toMatch(/clé « cle-001 » au-delà de sa part \(6\s000,00\s€\)/)
    const ailleurs = suiviFinancierOperationTravaux(op, budget(op), { emploisFonds: [surCle('E2', 100_000, 'cle-Z')] })
    expect(codes(ailleurs.anomalies)).toEqual(['emploi_au_dela_de_la_part_de_la_cle'])
    expect(ailleurs.anomalies[0].message).toContain('étrangère à l')
    expect(suiviFinancierOperationTravaux(op, budget(op), { emploisFonds: [surCle('E3', 600_000, 'cle-001'), surCle('E4', 400_000, 'cle-bat-B')] }).anomalies).toEqual([])
    expect(codes(suiviFinancierOperationTravaux(operation(), budget(operation()), { emploisFonds: [surCle('E5', 1_000, 'cle-Z')] }).anomalies)).toEqual([
      'emploi_au_dela_de_la_part_de_la_cle',
    ])
  })
})

describe('relecture du point 31 — dépassement d’une part fondée sur l’ordonnance du juge (art. 29-14, 2°)', () => {
  const ap = operation({
    decision: { date: '2026-03-12', resolution: 'Décision AP-3', origine: 'administrateur' },
    financementFondsTravauxCentimes: 500_000,
    affectationFonds: { objet: 'redressement_29_14', autorisationJuge: 'TJ, ordonnance du 02/02/2026, n° 26/00042' },
  })

  it('controlerEmploiFondsOperation cite l’art. 29-14, 2°, sans parler de décision d’affectation ; la part borne l’emploi (J67, R58)', () => {
    const controle = controlerEmploiFondsOperation(ap, { montantCentimes: 600_000 })
    expect(controle).toMatchObject({ autorise: false, cause: 'au_dela_de_la_part', fondement: 'L. 1965 art. 29-14, 2°', aConfirmer: false })
    expect(controle.motif).not.toContain("décision d'affectation")
    expect(controle.motif).toContain('ordonnance du juge')
    expect(controle.motif).toContain('nouvelle décision au registre (D. 1967 art. 62-8)')
  })

  it('le suivi cite l’art. 29-14, 2° pour des emplois au-delà de la part (J67, R58)', () => {
    const anomalie = suiviFinancierOperationTravaux(ap, budget(ap), { emploisFonds: [emploiLibre('E7', 600_000, 'redressement_29_14')] }).anomalies.find(
      (a) => a.code === 'emploi_au_dela_de_la_part',
    )
    expect(anomalie).toMatchObject({ gravite: 'bloquant', fondement: 'L. 1965 art. 29-14, 2°', aConfirmer: false })
    expect(anomalie?.message).not.toContain("décision d'affectation")
  })
})

describe('relecture du point 31 — aucun emploi du fonds pour une opération sans décision (Projet, Rejeté)', () => {
  const projet = operation({ decision: null, affectationFonds: { objet: 'travaux_hors_ppt', decisionAg: 'Résolution 3 (AG du 10/01/2026)' } })
  const rejetee = changerStatutOperationTravaux(projet, 'Rejeté', { le: '2026-02-01', motif: 'Travaux rejetés en AG' })

  it('controlerEmploiFondsOperation refuse l’emploi, même avec une décision d’affectation distincte', () => {
    for (const op of [projet, rejetee]) {
      const controle = controlerEmploiFondsOperation(op, { montantCentimes: 100_000 })
      expect(controle).toMatchObject({ autorise: false, cause: 'decision_manquante', fondement: 'L. 1965 art. 14-2-1, I, al. 7' })
      expect(controle.motif).toContain(`sans décision (statut « ${op.statut} »)`)
    }
  })

  it('le suivi signale bloquant chaque emploi rattaché à une opération sans décision', () => {
    const emploi = emploiDepuisOperation(rejetee, { id: 'E8', date: '2026-04-01', montantCentimes: 100_000 })
    const suivi = suiviFinancierOperationTravaux(rejetee, budget(rejetee), { emploisFonds: [emploi] })
    // la décision distincte saisie sur l'opération en texte libre reste un texte (emploiDepuisOperation) : signalée (J30)
    expect(suivi.anomalies.map((a) => [a.code, a.gravite])).toEqual([
      ['sans_decision', 'information'],
      ['emploi_sans_decision', 'bloquant'],
      ['emploi_fonds_forme_incomplete', 'avertissement'],
    ])
    expect(suivi.anomalies[1].message).toContain('Emploi E8')
    expect(suivi.anomalies[1].fondement).toBe('L. 1965 art. 14-2-1, I, al. 7')
  })
})

describe('relecture du point 31 — « Ne pas utiliser les fonds travaux » : ce qui dépend de la question ouverte', () => {
  const op = sansFonds({ nePasUtiliserFondsTravaux: true })

  it('l’emploi exclu est à confirmer ; les refus certains de la part nulle et le règlement depuis le compte du fonds ne le sont pas', () => {
    const reglementSurLeFonds = { ...reglement('r1', 'Enregistré', 100_000), banqueId: 'b-fonds' } as ReglementFournisseur
    const suivi = suiviFinancierOperationTravaux(op, budget(op), {
      emploisFonds: [emploiLibre('E9', 1_000)],
      reglements: [reglementSurLeFonds],
      banquesDuFondsTravaux: ['b-fonds'],
    })
    const marqueurs = suivi.anomalies.filter((a) => a.gravite === 'bloquant').map((a) => [a.code, a.aConfirmer, a.fondement])
    // Relecture, tour 2 : la case exige une part nulle ; les refus certains qui en découlent (al. 7) restent signalés.
    expect(marqueurs).toEqual([
      ['emploi_fonds_exclu', true, null],
      ['emploi_au_dela_de_la_part', false, 'L. 1965 art. 14-2-1, I, al. 7'],
      ['reglement_sur_compte_du_fonds', false, 'L. 1965 art. 14-2-1, I, al. 7'],
    ])
    expect(controlerEmploiFondsOperation(op, { montantCentimes: 1 })).toMatchObject({ cause: 'sans_part', aConfirmer: false })
  })
})

describe('relecture du point 31 — honoraires sur travaux : rattachement du budget, date du vote, régime inconnu', () => {
  const op = operation()
  const syndic = cadreHonorairesTravaux({ regime: 'syndic' })
  const vote = { date: '2026-03-12', resolution: 'Résolution 9', majorite: 'art24' as const, mode: 'pourcentage_ht' as const }

  it('controlerHonorairesTravaux refuse le budget d’une autre opération, ou du même n° dans un autre syndicat (D1)', () => {
    const autre = budget(operation({ numero: '00099' }))
    expect(() => controlerHonorairesTravaux(op, autre, { cadre: syndic })).toThrow(/Budget de l'opération 00099 \(copro-tilleuls\) appliqué à l'opération 00042/)
    const ailleurs = operation({ coproprieteId: 'copro-autre' })
    expect(() => controlerHonorairesTravaux(ailleurs, budget(op), { cadre: syndic, resolutionHonoraires: vote })).toThrow(/appliqué à l'opération 00042 \(copro-autre\)/)
  })

  it('refuse une date de vote des honoraires qui n’est pas une date ISO valide', () => {
    for (const date of ['12/03/2026', '2026-02-30', ''])
      expect(() => controlerHonorairesTravaux(op, budget(op), { cadre: syndic, resolutionHonoraires: { ...vote, date } })).toThrow(/AAAA-MM-JJ attendu/)
  })

  it('régime inconnu (null : mandat ad hoc, fondement vide ou non reconnu) : cadre non établi, à confirmer ; le syndic se passe explicitement', () => {
    expect(cadreHonorairesTravaux({ regime: null })).toMatchObject({ cadre: 'non_etabli', arreteParLeJuge: false, aConfirmer: true })
    expect(cadreHonorairesTravaux({ regime: 'syndic' })).toMatchObject({ cadre: 'vote_avec_les_travaux', fondements: ['L. 1965 art. 18-1 A, III'], aConfirmer: false })
    expect(controlerHonorairesTravaux(op, budget(op), { cadre: cadreHonorairesTravaux({ regime: null }), resolutionHonoraires: vote })).toEqual([
      expect.objectContaining({ code: 'honoraires_cadre_non_etabli', gravite: 'avertissement', fondement: null, aConfirmer: true }),
    ])
  })
})

describe('en-tête : sources, marqueurs et questions', () => {
  const { texte, item } = enTeteDuModule('travaux-budget')

  it('porte les trois marqueurs et les sources Gestéam de l’onglet Budget', () => {
    for (const marqueur of ['🟢 lu', '🔵 Déduit', '🔴 Non établi']) expect(texte).toContain(marqueur)
    expect(item('tranche 32, onglet Budget')).toContain('bouton « Ne pas utiliser les fonds travaux »')
  })

  it('cite les textes lus : art. 18-1 A, III ; arrêté du 8 octobre 2015, art. 11 ; aucun compte de dommages-ouvrage', () => {
    expect(texte).toContain('« votés lors de la même assemblée générale que les travaux concernés, aux mêmes règles de majorité »')
    expect(texte).toContain('2 % de 1 à 12 500 euros, 1,5 % de 12 501 à 25 000 euros, 1 % au-delà')
    expect(texte).toContain('AUCUN compte de dommages-ouvrage dans la nomenclature')
    expect(texte).toContain("L'engagement est soldé par le règlement.")
  })

  it('pose les questions ouvertes avec le choix actuel de VitFix', () => {
    expect(texte).toContain('« La ligne "Fonds de prévoyance" de l\'onglet Budget porte-t-elle la part financée par le fonds de travaux')
    // l'assiette du droit proportionnel n'est plus une question : décision de Hugo du 17/11/2026 (J55)
    expect(texte).not.toContain('(VitFix : le montant hors taxes fourni pour chaque opération, à confirmer)')
    expect(texte).toContain(
      '« Le bouton "Ne pas utiliser les fonds travaux" exclut-il tout emploi du fonds pour l\'opération (part, emploi, règlement depuis le compte du fonds), ou seulement le règlement de ses factures depuis ce compte ? »',
    )
    // paiement direct ou virement vers le compte courant : décision du 20/11/2026 (partie C, F95), plus une question
    expect(texte).not.toContain('« Quand l\'opération a une part du fonds, ses factures se règlent-elles directement depuis le compte du fonds')
    expect(texte).toContain(
      'Décision du 20/11/2026 (partie C, F95), même question que G28 (partie B) : par défaut, la facture se paie directement depuis le compte du fonds',
    )
  })

  it('signale les ajouts hors du module et les branchements à faire', () => {
    expect(texte).toContain('travaux-operations.ts (ajout du point 31)')
    expect(texte).toContain('virement-interne.ts')
  })

  it('J39 (décision de Hugo du 06/11/2026) : barème opération par opération ; l’assiette et la présentation au juge, tranchées par J55 (17/11/2026), quittent le 🔴', () => {
    expect(texte).toContain('Décisions de Hugo du 06/11/2026')
    const j39 = item('J39 :')
    expect(j39).toMatch(/opération par opération/)
    expect(j39).toMatch(/arrêté du 8 octobre 2015, art\. 11/)
    expect(j39).toMatch(/droitsProportionnelsTravauxParOperation/)
    expect(j39).toMatch(/jamais le barème appliqué au cumul/)
    expect(j39).toMatch(/tranchées par J55/)
    const nonEtabli = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(nonEtabli).not.toMatch(/s'applique-t-il opération par opération/)
    expect(nonEtabli).not.toMatch(/une seule fois au "montant total"/)
    expect(nonEtabli).not.toMatch(/Sur quelle assiette/)
    expect(nonEtabli).not.toMatch(/compte provisoire détaillé des émoluments/)
    const j55 = texte.slice(texte.indexOf('Décisions de Hugo du 17/11/2026'), texte.indexOf('Règles :'))
    expect(j55).toMatch(/compte provisoire détaillé des émoluments/)
    expect(j55).toMatch(/assietteDroitProportionnelTravaux/)
  })

  it('le refus d’une opération fournie deux fois : décision du 20/11/2026 (partie C, F62), non une décision J39 ; la question quitte le 🔴', () => {
    const deduit = texte.slice(texte.indexOf('🔵 Déduit'), texte.indexOf('🔴 Non établi'))
    expect(deduit).not.toMatch(/un numéro fourni deux fois est refusé/)
    const nonEtabli = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(nonEtabli).not.toContain('Une même opération fournie deux fois au calcul de plusieurs opérations')
    const f62 = item('Décision du 20/11/2026 (partie C, F62)')
    expect(f62).toContain("« additionnez les montants de l'opération avant le calcul »")
    expect(f62).toMatch(/arrêté du 8 octobre 2015, art\. 11 ; J39/)
    expect(f62).toMatch(/Des travaux supplémentaires qui complètent le même objet restent la même opération, par prudence/)
  })
})

describe('relecture du point 31, tour 2 — usage judiciaire (art. 29-14, 2°) : la part de chaque clé borne l’emploi, sans citer l’al. 7', () => {
  const ORDONNANCE = 'TJ, ordonnance du 02/02/2026, n° 26/00042'
  // Opération décidée par l'administrateur provisoire, part de 10 000 € : clé A 6 000 €, clé B 4 000 €.
  const ap = operation({
    decision: { date: '2026-03-12', resolution: 'Décision AP-3', origine: 'administrateur' },
    budgetTtcCentimes: 10_000_000,
    financementFondsTravauxCentimes: 1_000_000,
    affectationFonds: { objet: 'redressement_29_14', autorisationJuge: ORDONNANCE },
    cles: [
      { cleId: 'cle-001', budgetTtcCentimes: 6_000_000, financementFondsTravauxCentimes: 600_000 },
      { cleId: 'cle-bat-B', budgetTtcCentimes: 4_000_000, financementFondsTravauxCentimes: 400_000 },
    ],
  })
  // Ordonnance enregistrée sur l'emploi en forme structurée (J30) ; l'opération la saisit encore en texte libre.
  const ordonnanceDeLEmploi: OrdonnanceJuge = { juridiction: 'TJ', date: '2026-02-02', numero: '26/00042' }
  const surCle = (id: string, montantCentimes: number, cleId: string): EmploiFondsTravaux => ({
    ...emploiLibre(id, montantCentimes, 'redressement_29_14'),
    cleId,
    decaissement: { objet: 'redressement_29_14', montantCentimes, decisionAg: null, autorisationJuge: ordonnanceDeLEmploi },
  })

  it('controlerEmploiFondsOperation : au-delà de la part de la clé, ou clé étrangère : art. 29-14, 2°, à confirmer', () => {
    const cle = controlerEmploiFondsOperation(ap, { montantCentimes: 700_000, cleId: 'cle-001' })
    expect(cle).toMatchObject({ autorise: false, cause: 'au_dela_de_la_part_de_la_cle', fondement: 'L. 1965 art. 29-14, 2°', aConfirmer: true, resteCleCentimes: 600_000 })
    expect(cle.motif).toContain('ordonnance du juge')
    expect(cle.motif).not.toContain("l'affectation tient compte des clés")
    const etrangere = controlerEmploiFondsOperation(ap, { montantCentimes: 1, cleId: 'cle-Z' })
    expect(etrangere).toMatchObject({ autorise: false, cause: 'cle_sans_part', fondement: 'L. 1965 art. 29-14, 2°', aConfirmer: true })
    expect(etrangere.motif).toContain('ordonnance du juge')
    expect(etrangere.motif).not.toContain("l'affectation tient compte des clés")
    // même opération : le dépassement de la part totale citait déjà l'art. 29-14, 2°
    expect(controlerEmploiFondsOperation(ap, { montantCentimes: 1_100_000, cleId: 'cle-001' })).toMatchObject({ cause: 'au_dela_de_la_part', fondement: 'L. 1965 art. 29-14, 2°' })
    expect(controlerEmploiFondsOperation(ap, { montantCentimes: 600_000, cleId: 'cle-001' })).toMatchObject({ autorise: true, cause: 'admis' })
  })

  it('la clé exigée avec plusieurs clés se justifie par l’art. 29-14, 2°', () => {
    expect(() => controlerEmploiFondsOperation(ap, { montantCentimes: 100 })).toThrow(/clé de la dépense exigée, l'opération porte plusieurs clés \(L\. 1965 art\. 29-14, 2°/)
  })

  it('suivi : emplois au-delà de la part de leur clé, ou sur une clé étrangère : art. 29-14, 2°, à confirmer', () => {
    const suivi = suiviFinancierOperationTravaux(ap, creerBudgetOperationTravaux(ap, { lignes: [] }), { emploisFonds: [surCle('E1', 700_000, 'cle-001'), surCle('E2', 100, 'cle-Z')] })
    expect(suivi.anomalies.map((a) => [a.code, a.fondement, a.aConfirmer])).toEqual([
      ['emploi_au_dela_de_la_part_de_la_cle', 'L. 1965 art. 29-14, 2°', true],
      ['emploi_au_dela_de_la_part_de_la_cle', 'L. 1965 art. 29-14, 2°', true],
    ])
    for (const a of suivi.anomalies) {
      expect(a.message).toContain('ordonnance du juge')
      expect(a.message).not.toContain("l'affectation tient compte des clés")
    }
  })

  it('hors usage judiciaire, les refus par clé restent fondés sur l’al. 7 (vote de l’assemblée)', () => {
    const vote = operation({
      budgetTtcCentimes: 10_000_000,
      financementFondsTravauxCentimes: 1_000_000,
      cles: [
        { cleId: 'cle-001', budgetTtcCentimes: 6_000_000, financementFondsTravauxCentimes: 600_000 },
        { cleId: 'cle-bat-B', budgetTtcCentimes: 4_000_000, financementFondsTravauxCentimes: 400_000 },
      ],
    })
    const cle = controlerEmploiFondsOperation(vote, { montantCentimes: 700_000, cleId: 'cle-001' })
    expect(cle).toMatchObject({ cause: 'au_dela_de_la_part_de_la_cle', fondement: 'L. 1965 art. 14-2-1, I, al. 7', aConfirmer: false })
    expect(cle.motif).toContain("l'affectation tient compte des clés de répartition")
    expect(controlerEmploiFondsOperation(vote, { montantCentimes: 1, cleId: 'cle-Z' })).toMatchObject({ cause: 'cle_sans_part', fondement: 'L. 1965 art. 14-2-1, I, al. 7', aConfirmer: false })
    expect(() => controlerEmploiFondsOperation(vote, { montantCentimes: 100 })).toThrow(/plusieurs clés \(L\. 1965 art\. 14-2-1, I, al\. 7 : l'affectation tient compte des clés de répartition\)/)
  })
})

describe('relecture du point 31, tour 2 — « Ne pas utiliser les fonds travaux » ne masque pas un refus certain', () => {
  const AL7 = 'L. 1965 art. 14-2-1, I, al. 7'
  const sansPart = sansFonds()
  const cochee = marquerNePasUtiliserFondsTravaux(sansPart, true)
  const projetCoche = marquerNePasUtiliserFondsTravaux(sansFonds({ decision: null }), true)
  const bloquants = (op: OperationTravaux, sources: Parameters<typeof suiviFinancierOperationTravaux>[2]) =>
    suiviFinancierOperationTravaux(op, budget(op), sources)
      .anomalies.filter((a) => a.gravite === 'bloquant')
      .map((a) => [a.code, a.fondement, a.aConfirmer])

  it('controlerEmploiFondsOperation : sans part, case cochée : refus certain « sans_part » (al. 7), la case rappelée au motif', () => {
    expect(controlerEmploiFondsOperation(sansPart, { montantCentimes: 1_000 })).toMatchObject({ autorise: false, cause: 'sans_part', fondement: AL7, aConfirmer: false })
    const controle = controlerEmploiFondsOperation(cochee, { montantCentimes: 1_000 })
    expect(controle).toMatchObject({ autorise: false, cause: 'sans_part', fondement: AL7, aConfirmer: false })
    expect(controle.motif).toContain("aucune décision n'affecte le fonds à ses dépenses")
    expect(controle.motif).toContain('« Ne pas utiliser les fonds travaux »')
  })

  it('controlerEmploiFondsOperation : projet sans décision, case cochée : « decision_manquante », certain', () => {
    const controle = controlerEmploiFondsOperation(projetCoche, { montantCentimes: 1_000 })
    expect(controle).toMatchObject({ autorise: false, cause: 'decision_manquante', fondement: AL7, aConfirmer: false })
    expect(controle.motif).toContain('« Ne pas utiliser les fonds travaux »')
  })

  it('controlerEmploiFondsOperation : la case reste la cause quand aucun refus certain ne la précède (part avec la case : données incohérentes)', () => {
    const incoherente: OperationTravaux = { ...operation(), nePasUtiliserFondsTravaux: true }
    expect(controlerEmploiFondsOperation(incoherente, { montantCentimes: 1_000 })).toMatchObject({ autorise: false, cause: 'fonds_non_utilise', fondement: null, aConfirmer: true })
  })

  it('suivi : l’emploi exclu (à confirmer) s’ajoute au rapprochement des cumuls, certain (al. 7)', () => {
    const emplois = { emploisFonds: [emploiLibre('E1', 1_000)] }
    expect(bloquants(sansPart, emplois)).toEqual([['emploi_au_dela_de_la_part', AL7, false]])
    expect(bloquants(cochee, emplois)).toEqual([
      ['emploi_fonds_exclu', null, true],
      ['emploi_au_dela_de_la_part', AL7, false],
    ])
    expect(bloquants(projetCoche, emplois)).toEqual([
      ['emploi_fonds_exclu', null, true],
      ['emploi_sans_decision', AL7, false],
      ['emploi_au_dela_de_la_part', AL7, false],
    ])
  })

  it('règlement depuis le compte du fonds, case cochée : l’absence de part reste citée (al. 7)', () => {
    const surLeFonds = { ...reglement('r1', 'Enregistré', 100_000), banqueId: 'bq-fonds' } as ReglementFournisseur
    const sources = { reglements: [surLeFonds], banquesDuFondsTravaux: ['bq-fonds'] }
    expect(bloquants(sansPart, sources)).toEqual([['reglement_sur_compte_du_fonds', AL7, false]])
    expect(bloquants(cochee, sources)).toEqual([['reglement_sur_compte_du_fonds', AL7, false]])
    const message = suiviFinancierOperationTravaux(cochee, budget(cochee), sources).anomalies.find((a) => a.code === 'reglement_sur_compte_du_fonds')?.message
    expect(message).toContain('« Ne pas utiliser les fonds travaux »')
    expect(message).toContain("aucune part du fonds de travaux n'est affectée")
  })
})

describe('relecture du point 31, tour 2 — usage judiciaire à part nulle : refus fondés sur l’art. 29-14, 2°, comme les cumuls', () => {
  const ORDONNANCE = 'TJ, ordonnance du 02/02/2026, n° 26/00042'
  const apSansPart = sansFonds({
    decision: { date: '2026-03-12', resolution: 'Décision AP-3', origine: 'administrateur' },
    affectationFonds: { objet: 'redressement_29_14', autorisationJuge: ORDONNANCE },
  })

  it('controlerEmploiFondsOperation : « sans_part », art. 29-14, 2° (J67, R58), sans parler de décision d’affectation', () => {
    const controle = controlerEmploiFondsOperation(apSansPart, { montantCentimes: 1_000 })
    expect(controle).toMatchObject({ autorise: false, cause: 'sans_part', fondement: 'L. 1965 art. 29-14, 2°', aConfirmer: false })
    expect(controle.motif).toContain('ordonnance du juge')
    expect(controle.motif).not.toContain("aucune décision n'affecte")
  })

  it('suivi : le rapprochement des cumuls et le règlement depuis le compte du fonds citent le même texte', () => {
    const emploi: EmploiFondsTravaux = {
      ...emploiLibre('E1', 1_000, 'redressement_29_14'),
      decaissement: { objet: 'redressement_29_14', montantCentimes: 1_000, decisionAg: null, autorisationJuge: ORDONNANCE },
    }
    const surLeFonds = { ...reglement('r1', 'Enregistré', 100_000), banqueId: 'bq-fonds' } as ReglementFournisseur
    const sources = { emploisFonds: [emploi], reglements: [surLeFonds], banquesDuFondsTravaux: ['bq-fonds'] }
    const marqueurs = (op: OperationTravaux) =>
      suiviFinancierOperationTravaux(op, budget(op), sources)
        .anomalies.filter((a) => a.gravite === 'bloquant')
        .map((a) => [a.code, a.fondement, a.aConfirmer])
    // la part de l'opération borne l'usage judiciaire : décision de l'administrateur provisoire au registre (J67, R58)
    expect(marqueurs(apSansPart)).toEqual([
      ['emploi_au_dela_de_la_part', 'L. 1965 art. 29-14, 2°', false],
      ['reglement_sur_compte_du_fonds', 'L. 1965 art. 29-14, 2°', false],
    ])
    // case cochée : le règlement est exclu dans les deux lectures du bouton, plus rien à confirmer pour lui
    expect(marqueurs(marquerNePasUtiliserFondsTravaux(apSansPart, true))).toEqual([
      ['emploi_fonds_exclu', null, true],
      ['emploi_au_dela_de_la_part', 'L. 1965 art. 29-14, 2°', false],
      ['reglement_sur_compte_du_fonds', 'L. 1965 art. 29-14, 2°', false],
    ])
  })
})

describe('J30 (PR #643) — emploi du fonds rattaché à l’opération : décision et ordonnance enregistrées', () => {
  const AG_STRUCTUREE: DecisionAffectationAg = { dateAg: '2026-03-12', numeroResolution: '8' }
  const ORDONNANCE_STRUCTUREE: OrdonnanceJuge = { juridiction: 'Tribunal judiciaire de Marseille', date: '2026-02-02', numero: '26/00042' }
  const AG_TEXTE_LIBRE = 'Résolution 8 (AG du 12/03/2026)'
  const ORDONNANCE_TEXTE_LIBRE = 'TJ, ordonnance du 02/02/2026, n° 26/00042'
  // Opération décidée par l'administrateur provisoire, part du fonds sur ordonnance du juge (art. 29-14, 2°).
  const ap = operation({
    decision: { date: '2026-03-12', resolution: 'Décision AP-3', origine: 'administrateur' },
    affectationFonds: { objet: 'redressement_29_14', autorisationJuge: ORDONNANCE_TEXTE_LIBRE },
  })
  const surDecisionAg = (decisionAg: DecaissementFondsTravaux['decisionAg']): EmploiFondsTravaux => ({
    ...emploiLibre('E1', 1_000_000),
    decaissement: { objet: 'travaux_hors_ppt', montantCentimes: 1_000_000, decisionAg },
  })
  const surOrdonnance = (autorisationJuge: DecaissementFondsTravaux['autorisationJuge']): EmploiFondsTravaux => ({
    ...emploiLibre('E1', 1_000_000, 'redressement_29_14'),
    decaissement: { objet: 'redressement_29_14', montantCentimes: 1_000_000, decisionAg: null, autorisationJuge },
  })
  const suiviDe = (op: OperationTravaux, emploi: EmploiFondsTravaux) => suiviFinancierOperationTravaux(op, budget(op), { emploisFonds: [emploi] })

  it('décision d’AG structurée (date de l’AG, n° de la résolution) : contrôlée sans erreur, sans anomalie', () => {
    const op = operation()
    expect(() => suiviDe(op, surDecisionAg(AG_STRUCTUREE))).not.toThrow()
    expect(suiviDe(op, surDecisionAg(AG_STRUCTUREE)).anomalies).toEqual([])
  })

  it('ordonnance structurée de l’art. 29-14, 2° (juridiction, date, n°) : contrôlée sans erreur, sans anomalie', () => {
    expect(() => suiviDe(ap, surOrdonnance(ORDONNANCE_STRUCTUREE))).not.toThrow()
    expect(suiviDe(ap, surOrdonnance(ORDONNANCE_STRUCTUREE)).anomalies).toEqual([])
  })

  it('texte libre d’avant J30 : avertissement non bloquant « forme incomplète », message et fondement du contrôle', () => {
    const cas = [
      { op: operation(), emploi: surDecisionAg(AG_TEXTE_LIBRE), fondement: 'L. 1965 art. 14-2-1, I' },
      { op: ap, emploi: surOrdonnance(ORDONNANCE_TEXTE_LIBRE), fondement: 'L. 1965 art. 29-14' },
    ]
    for (const { op, emploi, fondement } of cas) {
      const controle = controlerAffectationFondsTravaux(emploi.decaissement, { aujourdhui: null })
      expect(controle).toMatchObject({ autorise: true, fondement })
      expect(controle.formeIncomplete).not.toBeNull()
      const suivi = suiviDe(op, emploi)
      expect(suivi.anomalies).toEqual([
        {
          code: 'emploi_fonds_forme_incomplete',
          gravite: 'avertissement',
          message: `Emploi E1 du fonds de travaux : ${controle.formeIncomplete?.message}`,
          fondement,
          aConfirmer: false,
        },
      ])
      expect(suivi.anomalies[0].message).toContain('forme incomplète')
      // non bloquant : l'emploi reste compté dans la trésorerie de l'opération
      expect(suivi.emploiFondsTravauxCentimes).toBe(1_000_000)
    }
  })

  it('forme structurée incomplète : refus bloquant « emploi_fonds_non_autorise », jamais un simple avertissement', () => {
    const cas = [
      {
        op: operation(),
        emploi: surDecisionAg({ dateAg: '2026-03-12', numeroResolution: '  ' }),
        manque: 'manque : n° de la résolution',
        fondement: 'L. 1965 art. 14-2-1, I',
      },
      {
        op: ap,
        emploi: surOrdonnance({ juridiction: 'Tribunal judiciaire de Marseille', date: '02/02/2026', numero: '26/00042' }),
        manque: "manque : date de l'ordonnance au format AAAA-MM-JJ",
        fondement: 'L. 1965 art. 29-14',
      },
    ]
    for (const { op, emploi, manque, fondement } of cas) {
      const { anomalies } = suiviDe(op, emploi)
      expect(anomalies).toEqual([expect.objectContaining({ code: 'emploi_fonds_non_autorise', gravite: 'bloquant', fondement })])
      expect(anomalies[0].message).toContain(manque)
    }
  })

  it('en-tête : le contrôle de chaque emploi suit J30 (PR #643), le texte libre signalé par emploi_fonds_forme_incomplete', () => {
    const rubrique = enTeteDuModule('travaux-budget').item("fonds de travaux : la part de l'opération passe le contrôle d'affectation")
    for (const attendu of ['J30', 'PR #643', '`aujourdhui: null`', 'emploi_fonds_forme_incomplete', 'avis-appel.ts']) expect(rubrique).toContain(attendu)
  })

  it('J67, R58 : ordonnance qui porte un montant ; l’emploi qui le dépasse, emplois antérieurs sous elle compris, est refusé', () => {
    const plafonnee: OrdonnanceJuge = { ...ORDONNANCE_STRUCTUREE, montantMaximumCentimes: 1_500_000 }
    const emplois = [
      { ...surOrdonnance(plafonnee), id: 'E2', date: '2026-05-01' },
      { ...surOrdonnance(plafonnee), id: 'E1', date: '2026-04-01' },
    ]
    const refus = suiviFinancierOperationTravaux(ap, budget(ap), { emploisFonds: emplois }).anomalies.filter((a) => a.code === 'emploi_fonds_non_autorise')
    expect(refus).toEqual([expect.objectContaining({ gravite: 'bloquant', fondement: 'L. 1965 art. 29-14' })])
    expect(refus[0].message).toContain('Emploi E2')
    expect(refus[0].message).toContain('J67, R58')
    expect(suiviFinancierOperationTravaux(ap, budget(ap), { emploisFonds: emplois.slice(1) }).anomalies).toEqual([])
  })

  it('relecture J67, R58 : le cumul sous une même ordonnance compte les emplois des autres opérations et ceux hors opération', () => {
    const plafonnee: OrdonnanceJuge = { ...ORDONNANCE_STRUCTUREE, montantMaximumCentimes: 1_500_000 }
    const deLOperation = { ...surOrdonnance(plafonnee), id: 'E2', date: '2026-05-01' }
    const autres = [
      { ...surOrdonnance(plafonnee), id: 'E1', date: '2026-04-01', operationNumero: '00043' },
      { ...surOrdonnance(plafonnee), id: 'E0', date: '2026-04-01', operationNumero: null, partOperationCentimes: null },
    ]
    for (const autre of autres) {
      const suivi = suiviFinancierOperationTravaux(ap, budget(ap), { emploisFonds: [deLOperation, autre] })
      const refus = suivi.anomalies.filter((a) => a.code === 'emploi_fonds_non_autorise')
      expect(refus).toEqual([expect.objectContaining({ gravite: 'bloquant', fondement: 'L. 1965 art. 29-14' })])
      expect(refus[0].message).toContain('Emploi E2')
      expect(refus[0].message).toMatch(/après 10\s000,00\s€ déjà employés sous cette ordonnance/)
      // l'emploi de l'autre opération, ou hors opération, n'entre ni à la trésorerie ni aux autres contrôles de celle-ci
      expect(suivi.emploiFondsTravauxCentimes).toBe(1_000_000)
    }
  })
})

describe('J67, R59 — commande au-delà du budget adopté : nouvelle décision avant l’ordre de service', () => {
  const op = sansFonds()
  const b = creerBudgetOperationTravaux(op, { lignes: [{ poste: 'travaux', budgetTtcCentimes: 9_000_000 }] })
  const controle = (montantOsTtcCentimes: number | null, autres: Partial<EngagementAvantOs> = {}) =>
    controlerDepassementBudgetAvantOs(op, b, { montantOsTtcCentimes, urgenceConstatee: false, date: '2026-06-01', ...autres })
  const RESOLUTION: DecisionSupplementTravaux = { origine: 'assemblee', date: '2026-05-20', reference: 'Résolution 4', montantCentimes: 1_000_000 }
  const REGISTRE: DecisionSupplementTravaux = { origine: 'administrateur', date: '2026-05-20', reference: 'Registre n° 7', montantCentimes: 1_000_000, avisConseilSyndicalLe: '2026-05-15' }

  it('dans le budget adopté : rien ; au-delà : bloquant, et le message dit comment lever le blocage', () => {
    expect(controle(3_000_000)).toEqual([])
    const [blocage, ...reste] = controle(4_000_000)
    expect(reste).toEqual([])
    expect(blocage).toMatchObject({ code: 'depassement_budget_os', gravite: 'bloquant', fondement: 'L. 1965 art. 18, I ; art. 29-1, I', aConfirmer: false })
    expect(blocage.message).toMatch(/dépasse le budget adopté \(120\s000,00\s€\) de 10\s000,00\s€/)
    for (const voie of ["nouvelle résolution d'assemblée", "pouvoirs de l'assemblée", 'urgence constatée', 'J67, R59']) expect(blocage.message).toContain(voie)
  })

  it('levé par une résolution d’assemblée qui couvre le supplément, prise au plus tard le jour de l’envoi', () => {
    expect(controle(4_000_000, { decisions: [RESOLUTION] })).toEqual([])
    expect(codes(controle(4_000_001, { decisions: [RESOLUTION] }))).toEqual(['depassement_budget_os'])
    expect(controle(4_000_000, { decisions: [{ ...RESOLUTION, date: '2026-06-02' }] })[0].message).toContain("postérieure à l'envoi")
    expect(() => controle(4_000_000, { decisions: [{ ...RESOLUTION, reference: ' ' }] })).toThrow(/Décision qui couvre le supplément/)
  })

  it('décision de l’administrateur provisoire : seulement avec les pouvoirs de l’assemblée, après l’avis du conseil syndical', () => {
    expect(controle(4_000_000, { decisions: [{ ...REGISTRE, pouvoirsAgConfies: 'tous' }] })).toEqual([])
    for (const pouvoirsAgConfies of ['aucun', null] as const) {
      const [blocage] = controle(4_000_000, { decisions: [{ ...REGISTRE, pouvoirsAgConfies }] })
      expect(blocage.code).toBe('depassement_budget_os')
      expect(blocage.message).toContain('il faut une assemblée')
    }
    const [sansAvis] = controle(4_000_000, { decisions: [{ ...REGISTRE, pouvoirsAgConfies: 'tous', avisConseilSyndicalLe: null }] })
    expect(sansAvis.message).toContain('avis préalable du conseil syndical (D. 1967 art. 62-7)')
  })

  it('relecture : une partie des pouvoirs ne lève pas le blocage sans la clause de l’ordonnance qui confie cette décision', () => {
    const partie: DecisionSupplementTravaux = { ...REGISTRE, pouvoirsAgConfies: 'partie' }
    const [blocage, ...reste] = controle(4_000_000, { decisions: [partie] })
    expect(reste).toEqual([])
    expect(blocage).toMatchObject({ code: 'depassement_budget_os', gravite: 'bloquant' })
    expect(blocage.message).toContain("vérifier que l'ordonnance lui confie cette décision et en citer la clause, faute de quoi il faut une assemblée")
    expect(blocage.message).toContain('L. 1965 art. 29-1, I, al. 2')
    expect(codes(controle(4_000_000, { decisions: [{ ...partie, clauseOrdonnance: '  ' }] }))).toEqual(['depassement_budget_os'])
    const avecClause = { ...partie, clauseOrdonnance: 'Ordonnance du 02/02/2026, art. 3 : budget des travaux de ravalement' }
    expect(controle(4_000_000, { decisions: [avecClause] })).toEqual([])
    // la clause ne dispense pas de l'avis préalable du conseil syndical
    expect(codes(controle(4_000_000, { decisions: [{ ...avecClause, avisConseilSyndicalLe: null }] }))).toEqual(['depassement_budget_os'])
  })

  it('relecture : l’OS d’un marché déjà porté au poste n’est pas compté deux fois (part de l’OS dans les postes)', () => {
    // budget adopté 120 000 € ; poste travaux 90 000 € = le marché signé ; OS de démarrage de ce marché : 90 000 €
    expect(codes(controle(9_000_000))).toEqual(['depassement_budget_os'])
    expect(controle(9_000_000, { partOsDansLesPostesCentimes: 9_000_000 })).toEqual([])
    // OS de 130 000 € dont 90 000 € déjà au poste : seuls 40 000 € s'ajoutent, 10 000 € au-delà du budget adopté
    const [blocage] = controle(13_000_000, { partOsDansLesPostesCentimes: 9_000_000 })
    expect(blocage.code).toBe('depassement_budget_os')
    expect(blocage.message).toMatch(/dont 90\s000,00\s€ déjà portés aux postes du budget/)
    expect(blocage.message).toMatch(/de 10\s000,00\s€/)
    expect(() => controle(1_000, { partOsDansLesPostesCentimes: 2_000 })).toThrow(/déjà comprise dans les postes/)
    expect(() => controle(20_000_000, { partOsDansLesPostesCentimes: 10_000_000 })).toThrow(/déjà comprise dans les postes/)
    expect(() => controle(9_000_000, { partOsDansLesPostesCentimes: -1 })).toThrow(/déjà comprise dans les postes/)
  })

  it('urgence constatée : pas de blocage, une alerte ; montant de l’OS inconnu : alerte ; marge du cabinet : règle interne, nulle par défaut', () => {
    expect(controle(4_000_000, { urgenceConstatee: true })).toEqual([expect.objectContaining({ code: 'depassement_budget_os_urgence', gravite: 'avertissement' })])
    expect(controle(null)).toEqual([expect.objectContaining({ code: 'montant_os_inconnu', gravite: 'avertissement' })])
    expect(controle(4_000_000, { margeCabinetPct: 10 })).toEqual([
      expect.objectContaining({ code: 'depassement_dans_la_marge_du_cabinet', gravite: 'information', fondement: null }),
    ])
    expect(codes(controle(4_000_000, { margeCabinetPct: 5 }))).toEqual(['depassement_budget_os'])
    expect(() => controle(4_000_000, { margeCabinetPct: -1 })).toThrow(/marge du cabinet/)
  })

  it('opération sans décision : aucun budget adopté, l’ordre de service est bloqué ; budget d’une autre opération refusé', () => {
    const projet = sansFonds({ decision: null })
    const [blocage] = controlerDepassementBudgetAvantOs(projet, budget(projet), { montantOsTtcCentimes: 1, urgenceConstatee: false, date: '2026-06-01' })
    expect(blocage).toMatchObject({ code: 'depassement_budget_os', gravite: 'bloquant' })
    expect(blocage.message).toContain('sans décision')
    expect(() => controlerDepassementBudgetAvantOs(operation({ numero: '00099' }), b, { montantOsTtcCentimes: 1, urgenceConstatee: false, date: '2026-06-01' })).toThrow(/appliqué à l'opération 00099/)
  })
})

describe('J67, R60 — comptes de l’opération : dommages-ouvrage et honoraires au 671, étude au 673 ; alerte en classe 61 ou 62', () => {
  it('compte proposé par poste : celui de l’opération (671, ou 673 pour une étude) ; aucun pour les honoraires du cabinet', () => {
    const op = operation()
    for (const poste of ['travaux', 'dommagesOuvrage', 'honorairesPrestataires'] as const) expect(compteProposePourLePoste(op, poste)).toMatchObject({ planCode: '67100', auxiliaire: '00042' })
    expect(compteProposePourLePoste(op, 'honorairesCabinet')).toBeNull()
    expect(compteProposePourLePoste(operation({ etude: true }), 'honorairesPrestataires')?.planCode).toBe('67300')
  })

  it('ligne de facture de l’opération en classe 61 ou 62 : avertissement, jamais un blocage ; lignes d’une autre opération ignorées', () => {
    const ligne = (comptePlan: string, id = '00042'): LigneCompteOperation => ({ comptePlan, montantTtcCentimes: 120_000, rattachement: { type: 'travaux', id } })
    const anomalies = anomaliesComptesDesLignesDOperation(operation(), [ligne('61600'), ligne('62300'), ligne('67100'), ligne('61600', '00099'), { ...ligne('62300'), rattachement: null }])
    expect(anomalies.map((a) => [a.code, a.gravite, a.fondement])).toEqual([
      ['ligne_operation_en_gestion_courante', 'avertissement', 'Arrêté du 14 mars 2005, art. 3 et 7'],
      ['ligne_operation_en_gestion_courante', 'avertissement', 'Arrêté du 14 mars 2005, art. 3 et 7'],
    ])
    expect(anomalies[0].message).toContain('61600')
    expect(anomalies[0].message).toContain('67100')
    expect(anomalies[0].message).toContain('J67, R60')
  })

  it('relecture : le suivi financier rend l’alerte quand il reçoit les lignes des factures du syndicat', () => {
    const op = sansFonds()
    const lignesFactures: LigneCompteOperation[] = [
      { comptePlan: '62300', montantTtcCentimes: 120_000, rattachement: { type: 'travaux', id: '00042' } },
      { comptePlan: '67100', montantTtcCentimes: 900_000, rattachement: { type: 'travaux', id: '00042' } },
    ]
    const suivi = suiviFinancierOperationTravaux(op, budget(op), { lignesFactures })
    expect(suivi.anomalies.filter((a) => a.code === 'ligne_operation_en_gestion_courante').map((a) => a.gravite)).toEqual(['avertissement'])
    expect(codes(suiviFinancierOperationTravaux(op, budget(op)).anomalies)).not.toContain('ligne_operation_en_gestion_courante')
  })
})

describe('J67, R81 — part du fonds affectée par la décision de l’administrateur provisoire : pouvoirs de l’assemblée', () => {
  const decisionAp = { date: '2026-03-12', resolution: 'Décision AP-3', origine: 'administrateur' as const }

  it('aucun pouvoir de l’assemblée : l’emploi est refusé avant le décaissement ; la part est bloquante au suivi', () => {
    const op = operation({ decision: { ...decisionAp, pouvoirsAgConfies: 'aucun' } })
    expect(controlerEmploiFondsOperation(op, { montantCentimes: 1_000 })).toMatchObject({ autorise: false, cause: 'decision_manquante', fondement: 'L. 1965 art. 29-1, I, al. 2', aConfirmer: false })
    expect(suiviFinancierOperationTravaux(op, budget(op)).anomalies).toContainEqual(expect.objectContaining({ code: 'part_fonds_non_autorisee', gravite: 'bloquant' }))
  })

  it('une partie des pouvoirs : l’emploi est admis, le suivi avertit (à vérifier dans l’ordonnance)', () => {
    const op = operation({ decision: { ...decisionAp, pouvoirsAgConfies: 'partie' } })
    expect(controlerEmploiFondsOperation(op, { montantCentimes: 1_000 }).autorise).toBe(true)
    expect(suiviFinancierOperationTravaux(op, budget(op)).anomalies).toContainEqual(
      expect.objectContaining({ code: 'affectation_pouvoirs_a_verifier', gravite: 'avertissement', fondement: 'L. 1965 art. 29-1, I, al. 2' }),
    )
  })
})

describe('J67 (décisions de Hugo du 17/11/2026) — en-tête de travaux-budget.ts', () => {
  const { texte } = enTeteDuModule('travaux-budget')
  const nonEtabli = texte.slice(texte.indexOf('🔴 Non établi'))

  it('les questions tranchées quittent le 🔴 ; pour l’art. 47, J73 range le cadre sous la rémunération fixée par le président', () => {
    expect(nonEtabli).toContain('🔴 Non établi')
    expect(nonEtabli).not.toContain("l'ordonnance fixe-t-elle un montant")
    expect(nonEtabli).not.toContain("La prime dommages-ouvrage d'une opération s'impute-t-elle au 671")
    expect(nonEtabli).not.toContain('Un engagement au-delà du budget adopté exige-t-il une nouvelle décision avant la commande ?')
    expect(nonEtabli).not.toContain('de l\'art. 18-1 A, III se contrôle-t-il ?')
    expect(nonEtabli).not.toContain('Le syndic désigné en justice (D. 1967 art. 46) perçoit-il des honoraires de travaux')
    // R1 (lot des honoraires) dit qui fixe la rémunération : la question n'est plus « quelle rémunération »
    expect(nonEtabli).not.toContain("« Quelle rémunération pour l'administrateur provisoire de l'art. 47 ? »")
    // J73 : R1 l'emporte sur R12 ; la question « fixé par le juge » est retirée
    expect(nonEtabli).not.toContain("Faut-il ranger l'administrateur provisoire de l'art. 47")
    expect(nonEtabli).not.toMatch(/en attendant Hugo/)
    const j67 = texte.slice(texte.indexOf('Décisions de Hugo du 17/11/2026 (registre des décisions juridiques, J67'), texte.indexOf('Règles :'))
    for (const r of ['R12', 'R13', 'R58', 'R59', 'R60', 'R81']) expect(j67).toContain(`J67, ${r}`)
    expect(j67).toMatch(/J67, R1 \(lot des honoraires.*\) : .*fixée par le président du tribunal judiciaire qui l'a désigné.*C\. com\. R\. 814-27/)
    expect(j67).not.toMatch(/garde le cadre « non établi »|il reste « à confirmer », arreteParLeJuge faux/)
    const j73 = texte.slice(texte.indexOf('Décision de Hugo du 18/11/2026 (registre des décisions juridiques, J73'), texte.indexOf('Règles :'))
    expect(j73).toMatch(/R1 l'emporte sur R12/)
    expect(j73).toMatch(/CADRE_AP47.*fixe_par_le_president.*arreteParLeJuge vrai/)
    expect(j73).toMatch(/C\. com\. R\. 814-27.*CPC art\. 714 à 718/)
    expect(j73).toMatch(/tout honoraire voté par l'assemblée reste signalé/)
  })
})
