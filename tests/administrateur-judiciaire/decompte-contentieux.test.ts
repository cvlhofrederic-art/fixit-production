import { describe, expect, it } from 'vitest'
import {
  DUREE_MAX_DELAIS_GRACE_MOIS,
  POSTES_JUGEMENT,
  calculerDecompte,
  controlerEcheancier,
  echelonner,
  ecartMontantDemande,
  genererEcheancier,
  suivreEcheancier,
  totalPostesCreance,
  type Condamnation,
  type CondamnationCentimes,
  type EcheanceDebiteur,
  type SaisieDecompte,
} from '@/lib/administrateur-judiciaire/domain/decompte-contentieux'
import type { PosteCreance } from '@/lib/administrateur-judiciaire/domain/postes-creance'

/**
 * Décompte et échéancier d'un contentieux (cartographie Gestéam, tranche 42 : onglet Règlements).
 * - Décompte : montant demandé (reconstitué depuis les postes de la créance, décision J3) ; postes du jugement →
 *   montant dû ; règlements → solde dû ; chèques à disposition et promis. Le décompte est DATÉ : seuls les règlements
 *   postérieurs à l'arrêté de la demande ou du jugement s'en déduisent ; les antérieurs sont listés à part (le juge
 *   les a déjà pris en compte).
 * - Échéancier du débiteur : en N fois, tous les N jours / semaines / mois, dates calculées depuis la première sans
 *   dérive ; suivi échéance par échéance ; délais de grâce bornés à deux ans (C. civ. art. 1343-5), comptés du
 *   jugement s'il est contradictoire, sinon de sa notification (CPC art. 511).
 * Montants en centimes entiers, dates ISO.
 */

const saisie = (surcharge: Partial<SaisieDecompte> = {}): SaisieDecompte => ({
  montantDemandeCentimes: 448_390,
  demandeArreteeLe: null,
  jugement: null,
  reglements: [],
  chequesADispositionCentimes: 0,
  chequesPromisCentimes: 0,
  ...surcharge,
})

const postes = (surcharge: Partial<CondamnationCentimes> = {}): CondamnationCentimes => ({
  principal: 0,
  indemnites: 0,
  depens: 0,
  article700: 0,
  interetsLegaux: 0,
  dommagesInterets: 0,
  ...surcharge,
})

const condamnation = (surcharge: Partial<CondamnationCentimes> = {}, arreteLe = '2026-06-15'): Condamnation => ({
  postes: postes(surcharge),
  arreteLe,
})

const poste = (id: string, montantCentimes: number): PosteCreance => ({
  id,
  exercice: '2025',
  nature: 'Provisions du budget prévisionnel',
  montantCentimes,
  fondement: 'art_19_2',
})

describe('décompte — référentiel et montant demandé', () => {
  it('reprend les six postes du jugement de la fiche Gestéam, dans l’ordre de la fiche', () => {
    expect(POSTES_JUGEMENT.map((p) => p.libelle)).toEqual([
      'Indemnités',
      'Principal',
      'Dépens',
      'Article 700 du CPC',
      'Intérêts légaux',
      'Dommages-intérêts',
    ])
  })

  it('reconstitue le montant demandé depuis les postes de la créance et en mesure l’écart', () => {
    const liste = [poste('p1', 300_000), poste('p2', 148_390)]
    expect(totalPostesCreance(liste)).toBe(448_390)
    expect(totalPostesCreance([])).toBe(0)
    expect(ecartMontantDemande(448_390, liste)).toBe(0)
    expect(ecartMontantDemande(450_000, liste)).toBe(1_610)
    expect(ecartMontantDemande(400_000, liste)).toBe(-48_390)
  })
})

describe('décompte — montant dû et solde', () => {
  it('sans condamnation saisie, le montant dû est le montant demandé', () => {
    expect(calculerDecompte(saisie())).toEqual({
      base: 'demande',
      arreteLe: null,
      montantDemandeCentimes: 448_390,
      montantDuCentimes: 448_390,
      totalReglementsCentimes: 0,
      reglementsAnterieurs: [],
      soldeDuCentimes: 448_390,
      chequesADispositionCentimes: 0,
      chequesPromisCentimes: 0,
      soldeApresChequesCentimes: 448_390,
    })
  })

  it('après jugement, le montant dû est la somme des postes de la condamnation, arrêtée à sa date', () => {
    const decompte = calculerDecompte(
      saisie({ jugement: condamnation({ principal: 420_000, depens: 18_000, article700: 100_000, interetsLegaux: 6_512 }) }),
    )
    expect(decompte.base).toBe('jugement')
    expect(decompte.arreteLe).toBe('2026-06-15')
    expect(decompte.montantDuCentimes).toBe(544_512)
    expect(decompte.soldeDuCentimes).toBe(544_512)
  })

  it('une condamnation saisie à zéro (syndicat débouté, ou créance réglée en cours d’instance) reste la base du décompte', () => {
    expect(calculerDecompte(saisie({ jugement: condamnation() })).montantDuCentimes).toBe(0)
  })

  it('ne déduit pas une seconde fois les règlements antérieurs à l’arrêté du jugement : ils sont listés à part', () => {
    const anterieur = { id: 'r1', date: '2026-03-01', montantCentimes: 100_000 }
    const posterieur = { id: 'r2', date: '2026-07-01', montantCentimes: 48_390 }
    const decompte = calculerDecompte(
      saisie({ jugement: condamnation({ principal: 348_390 }), reglements: [anterieur, posterieur] }),
    )
    expect(decompte.totalReglementsCentimes).toBe(48_390)
    expect(decompte.reglementsAnterieurs).toEqual([anterieur])
    expect(decompte.soldeDuCentimes).toBe(300_000)
    const reglee = calculerDecompte(saisie({ jugement: condamnation(), reglements: [anterieur] }))
    expect(reglee.soldeDuCentimes).toBe(0)
  })

  it('un règlement du jour même de l’arrêté est réputé pris en compte ; l’arrêté de la demande joue de même', () => {
    const decompte = calculerDecompte(
      saisie({
        demandeArreteeLe: '2026-02-01',
        reglements: [
          { id: 'r1', date: '2026-02-01', montantCentimes: 10_000 },
          { id: 'r2', date: '2026-02-02', montantCentimes: 20_000 },
        ],
      }),
    )
    expect(decompte.arreteLe).toBe('2026-02-01')
    expect(decompte.reglementsAnterieurs.map((r) => r.id)).toEqual(['r1'])
    expect(decompte.totalReglementsCentimes).toBe(20_000)
  })

  it('déduit les règlements, signale l’excédent par un solde négatif, et projette les chèques', () => {
    const decompte = calculerDecompte(
      saisie({
        reglements: [
          { id: 'r1', date: '2026-02-01', montantCentimes: 100_000 },
          { id: 'r2', date: '2026-03-01', montantCentimes: 48_390 },
        ],
        chequesADispositionCentimes: 50_000,
        chequesPromisCentimes: 25_000,
      }),
    )
    expect(decompte.totalReglementsCentimes).toBe(148_390)
    expect(decompte.soldeDuCentimes).toBe(300_000)
    expect(decompte.soldeApresChequesCentimes).toBe(225_000)
    const excedent = calculerDecompte(saisie({ reglements: [{ id: 'r1', date: '2026-02-01', montantCentimes: 500_000 }] }))
    expect(excedent.soldeDuCentimes).toBe(-51_610)
  })

  it('refuse un montant non entier ou négatif, une date d’arrêté invalide, un règlement nul, mal daté ou compté deux fois', () => {
    expect(() => calculerDecompte(saisie({ montantDemandeCentimes: 12.5 }))).toThrow(/montant demandé/i)
    expect(() => calculerDecompte(saisie({ chequesPromisCentimes: -1 }))).toThrow(/chèques promis/i)
    expect(() => calculerDecompte(saisie({ jugement: condamnation({ depens: -5 }) }))).toThrow(/dépens/i)
    expect(() => calculerDecompte(saisie({ jugement: condamnation({}, '15/06/2026') }))).toThrow(/arrêté/i)
    expect(() => calculerDecompte(saisie({ demandeArreteeLe: '2026-02-30' }))).toThrow(/arrêté/i)
    expect(() => calculerDecompte(saisie({ reglements: [{ id: 'r1', date: '2026-02-01', montantCentimes: 0 }] }))).toThrow(
      /règlement/i,
    )
    expect(() =>
      calculerDecompte(saisie({ reglements: [{ id: 'r1', date: '01/02/2026', montantCentimes: 100 }] })),
    ).toThrow(/date/i)
    expect(() =>
      calculerDecompte(
        saisie({
          reglements: [
            { id: 'r1', date: '2026-02-01', montantCentimes: 100 },
            { id: 'r1', date: '2026-02-01', montantCentimes: 100 },
          ],
        }),
      ),
    ).toThrow(/deux fois/i)
  })
})

describe('échéancier — génération', () => {
  it('génère N échéances d’un même montant, tous les N mois depuis la première, sans dérive de fin de mois', () => {
    const echeances = genererEcheancier({ nombre: 4, montantCentimes: 50_000, tousLes: 1, unite: 'mois', premiereLe: '2026-01-31' })
    expect(echeances.map((e) => e.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
    expect(echeances.map((e) => e.rang)).toEqual([1, 2, 3, 4])
    expect(echeances.every((e) => e.montantCentimes === 50_000)).toBe(true)
  })

  it('accepte une périodicité en jours ou en semaines', () => {
    expect(
      genererEcheancier({ nombre: 3, montantCentimes: 1_000, tousLes: 2, unite: 'semaines', premiereLe: '2026-11-02' }).map((e) => e.date),
    ).toEqual(['2026-11-02', '2026-11-16', '2026-11-30'])
    expect(
      genererEcheancier({ nombre: 2, montantCentimes: 1_000, tousLes: 15, unite: 'jours', premiereLe: '2026-12-25' }).map((e) => e.date),
    ).toEqual(['2026-12-25', '2027-01-09'])
  })

  it('échelonne un solde en N fois : montants égaux, l’arrondi sur la dernière échéance', () => {
    const echeances = echelonner(100_000, { nombre: 3, tousLes: 1, unite: 'mois', premiereLe: '2026-11-05' })
    expect(echeances.map((e) => e.montantCentimes)).toEqual([33_333, 33_333, 33_334])
    expect(echeances.reduce((total, e) => total + e.montantCentimes, 0)).toBe(100_000)
  })

  it('refuse un nombre, un pas ou un montant invalides, une unité inconnue, une date invalide', () => {
    const plan = { nombre: 3, montantCentimes: 1_000, tousLes: 1, unite: 'mois' as const, premiereLe: '2026-11-05' }
    expect(() => genererEcheancier({ ...plan, nombre: 0 })).toThrow(/nombre/i)
    expect(() => genererEcheancier({ ...plan, tousLes: 1.5 })).toThrow(/périodicité/i)
    expect(() => genererEcheancier({ ...plan, montantCentimes: 0 })).toThrow(/montant/i)
    expect(() => genererEcheancier({ ...plan, unite: 'trimestres' as never })).toThrow(/unité/i)
    expect(() => genererEcheancier({ ...plan, premiereLe: '05/11/2026' })).toThrow(/date/i)
    expect(() => echelonner(2, { nombre: 3, tousLes: 1, unite: 'mois', premiereLe: '2026-11-05' })).toThrow(/échelonner/i)
  })
})

describe('échéancier — suivi', () => {
  const echeances = genererEcheancier({ nombre: 4, montantCentimes: 50_000, tousLes: 1, unite: 'mois', premiereLe: '2026-08-05' })

  it('impute les règlements dans l’ordre des échéances et donne le statut de chacune', () => {
    const suivi = suivreEcheancier(
      echeances,
      [
        { id: 'r1', date: '2026-08-04', montantCentimes: 50_000 },
        { id: 'r2', date: '2026-09-10', montantCentimes: 20_000 },
      ],
      '2026-10-27',
    )
    expect(suivi.echeances.map((e) => [e.date, e.payeCentimes, e.statut])).toEqual([
      ['2026-08-05', 50_000, 'payee'],
      ['2026-09-05', 20_000, 'partielle'],
      ['2026-10-05', 0, 'impayee'],
      ['2026-11-05', 0, 'a_venir'],
    ])
    expect(suivi.impayesCentimes).toBe(80_000)
    expect(suivi.respecte).toBe(false)
    expect(suivi.prochaine?.date).toBe('2026-11-05')
    expect(suivi.excedentCentimes).toBe(0)
  })

  it('une échéance du jour n’est pas encore impayée ; un plan soldé n’a plus de prochaine échéance', () => {
    const duJour = suivreEcheancier(echeances, [{ id: 'r1', date: '2026-08-05', montantCentimes: 100_000 }], '2026-10-05')
    expect(duJour.echeances.map((e) => e.statut)).toEqual(['payee', 'payee', 'a_venir', 'a_venir'])
    expect(duJour.respecte).toBe(true)
    expect(duJour.prochaine?.date).toBe('2026-10-05')
    const solde = suivreEcheancier(echeances, [{ id: 'r1', date: '2026-08-05', montantCentimes: 210_000 }], '2026-10-27')
    expect(solde.prochaine).toBeNull()
    expect(solde.excedentCentimes).toBe(10_000)
  })

  it('ignore les règlements datés après la date du jour', () => {
    const suivi = suivreEcheancier(echeances, [{ id: 'r1', date: '2026-12-01', montantCentimes: 50_000 }], '2026-10-27')
    expect(suivi.echeances[0].statut).toBe('impayee')
  })

  it('contrôle tous les règlements avant d’écarter les futurs : une date mal formée n’est jamais perdue en silence', () => {
    expect(() => suivreEcheancier(echeances, [{ id: 'r1', date: '27/09/2026', montantCentimes: 100_000 }], '2026-10-27')).toThrow(
      /date/i,
    )
    expect(() => suivreEcheancier(echeances, [{ id: 'r1', date: '2026-9-27', montantCentimes: 100_000 }], '2026-10-27')).toThrow(
      /date/i,
    )
    expect(() =>
      suivreEcheancier(
        echeances,
        [
          { id: 'r1', date: '2026-08-05', montantCentimes: 100 },
          { id: 'r1', date: '2026-11-05', montantCentimes: 100 },
        ],
        '2026-10-27',
      ),
    ).toThrow(/deux fois/i)
    expect(() => suivreEcheancier(echeances, [{ id: 'r1', date: '2026-12-05', montantCentimes: -5 }], '2026-10-27')).toThrow(
      /règlement/i,
    )
  })

  it('refuse des échéances mal formées : date non ISO, montant non entier ou nul, rang en double', () => {
    const avec = (surcharge: Partial<EcheanceDebiteur>): EcheanceDebiteur[] => [{ ...echeances[0], ...surcharge }, echeances[1]]
    expect(() => suivreEcheancier(avec({ date: '05/08/2026' }), [], '2026-10-27')).toThrow(/date/i)
    expect(() => suivreEcheancier(avec({ montantCentimes: -50 }), [], '2026-10-27')).toThrow(/montant/i)
    expect(() => suivreEcheancier(avec({ rang: 2 }), [], '2026-10-27')).toThrow(/rang/i)
    expect(() => controlerEcheancier(avec({ montantCentimes: 10.5 }), { origine: 'amiable', decideLe: '2026-07-01' })).toThrow(
      /montant/i,
    )
  })
})

describe('échéancier — contrôles', () => {
  const vingtQuatre = genererEcheancier({ nombre: 24, montantCentimes: 1_000, tousLes: 1, unite: 'mois', premiereLe: '2026-11-15' })
  const vingtCinq = genererEcheancier({ nombre: 25, montantCentimes: 1_000, tousLes: 1, unite: 'mois', premiereLe: '2026-11-15' })

  it(`borne des délais de grâce à ${DUREE_MAX_DELAIS_GRACE_MOIS} mois depuis un jugement contradictoire (C. civ. art. 1343-5 ; CPC art. 511)`, () => {
    const jugement = { origine: 'delais_grace' as const, decideLe: '2026-10-15', contradictoire: true }
    expect(controlerEcheancier(vingtQuatre, jugement)).toEqual([])
    expect(controlerEcheancier(vingtCinq, jugement).map((a) => a.code)).toEqual(['delais_grace_depasses'])
  })

  it('compte les deux ans de la notification quand le jugement n’est pas contradictoire', () => {
    const notifie = { origine: 'delais_grace' as const, decideLe: '2026-09-15', contradictoire: false, notifieeLe: '2026-10-15' }
    expect(controlerEcheancier(vingtQuatre, notifie)).toEqual([])
    expect(controlerEcheancier(vingtCinq, notifie).map((a) => a.code)).toEqual(['delais_grace_depasses'])
  })

  it('signale un point de départ inconnu : jugement non contradictoire sans date de notification, ou caractère non renseigné', () => {
    expect(
      controlerEcheancier(vingtQuatre, { origine: 'delais_grace', decideLe: '2026-10-15', contradictoire: false }).map((a) => a.code),
    ).toEqual(['point_de_depart_inconnu'])
    expect(controlerEcheancier(vingtQuatre, { origine: 'delais_grace', decideLe: '2026-10-15' }).map((a) => a.code)).toEqual([
      'point_de_depart_inconnu',
    ])
  })

  it('ne borne ni un échéancier amiable, ni un accord homologué, ni un plan de surendettement', () => {
    for (const origine of ['amiable', 'accord_homologue', 'surendettement'] as const)
      expect(controlerEcheancier(vingtCinq, { origine, decideLe: '2026-10-15' })).toEqual([])
  })

  it('signale une première échéance antérieure à la décision qui fixe l’échéancier', () => {
    const echeances = genererEcheancier({ nombre: 2, montantCentimes: 1_000, tousLes: 1, unite: 'mois', premiereLe: '2026-10-01' })
    expect(controlerEcheancier(echeances, { origine: 'amiable', decideLe: '2026-10-15' }).map((a) => a.code)).toEqual([
      'premiere_avant_decision',
    ])
    expect(controlerEcheancier([], { origine: 'amiable', decideLe: '2026-10-15' })).toEqual([])
  })
})
