import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AFFECTATION_FONDS_TRAVAUX,
  NATURES_FONDS,
  controlerAffectationFondsTravaux,
  controlerCotisationFondsTravaux,
  controlerSeuilFondsTravaux,
  cotisationMinimaleFondsTravaux,
  creerReglagesFondsTravaux,
  echeancesCotisationFondsTravaux,
  obligationFondsTravaux,
  PPT_INCONNU,
  questionSuspensionFondsTravaux,
  type DecaissementFondsTravaux,
  type SaisieObligationFondsTravaux,
} from '@/lib/administrateur-judiciaire/domain/fonds-travaux'
import { NATURE_PLAN_COMPTABLE } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Décision J4 (Hugo Carvalho, 09/10/2026), tranchée sur Légifrance le 28/10/2026 et relue sur le texte officiel le
 * 29/10/2026 — le fonds de travaux (L. 1965 art. 14-2-1, créé par la loi n° 2021-1104, art. 171, jamais modifié).
 * - Obligation : immeuble à destination totale ou partielle d'habitation, dix ans après la réception ; entrée en vigueur
 *   échelonnée selon le nombre de lots (2023, 2024, 2025) ; plus aucune dispense.
 * - Affectation : les quatre dépenses du I (1° à 4°), sur décision d'affectation de l'assemblée ; en administration
 *   provisoire, le juge peut autoriser l'usage du fonds pour le redressement ou la gestion courante (art. 29-14, 2°).
 * - Cotisation annuelle : au moins 5 % du budget prévisionnel, et 2,5 % des travaux du plan adopté ; un montant supérieur
 *   se vote à la majorité des voix de tous les copropriétaires ; appelée selon les modalités des provisions du budget.
 * - Suspension : l'assemblée doit se prononcer quand le fonds excède le budget (et, avec un plan, la moitié de ses
 *   travaux) ; le juge peut suspendre en plan de sauvegarde (art. 29-14, 1°).
 * - Le « Montant bloqué € » de Gestéam (sens DÉDUIT : trésorerie minimale, 5.4.20) reste un garde-fou de GESTION.
 */

const decaissement = (surcharge: Partial<DecaissementFondsTravaux>): DecaissementFondsTravaux => ({
  objet: 'travaux_hors_ppt',
  montantCentimes: 1_250_000,
  decisionAg: 'AG du 12/03/2026, résolution 8',
  ...surcharge,
})

const AUJOURDHUI = '2026-10-29'

const immeuble = (surcharge: Partial<SaisieObligationFondsTravaux> = {}): SaisieObligationFondsTravaux => ({
  destinationHabitation: true,
  dateReception: '2014-06-15',
  nbLotsPrincipaux: 30,
  ...surcharge,
})

/** Budget prévisionnel d'exemple : 9 070,00 €. */
const BUDGET = 907_000

describe('J4 — cinq natures de fonds, jamais fusionnées', () => {
  it('les cinq natures de fonds sont distinctes et toutes présentes au référentiel du plan', () => {
    expect(NATURES_FONDS).toEqual([
      'Fonds, avance de trésorerie',
      'Fonds de prévoyance',
      'Fonds de réserve',
      'Fonds de solidarité',
      'Fonds travaux',
    ])
    expect(new Set(NATURES_FONDS).size).toBe(5)
    for (const nature of NATURES_FONDS) expect(NATURE_PLAN_COMPTABLE['Copropriété']).toContain(nature)
    // « Comptes bloqués » est une autre nature : le « Montant bloqué » du fonds travaux n'y renvoie pas.
    expect(NATURES_FONDS).not.toContain('Comptes bloqués')
  })
})

describe('J4 — contrôle d’affectation (art. 14-2-1, I et art. 29-14, 2°)', () => {
  it('un décaissement vers une charge courante est refusé, avec son fondement et la voie de l’art. 29-14', () => {
    const resultat = controlerAffectationFondsTravaux(decaissement({ objet: 'charges_courantes', decisionAg: null }))
    expect(resultat.autorise).toBe(false)
    expect(resultat.cause).toBe('exclu')
    expect(resultat.motif).toMatch(/charges courantes/i)
    expect(resultat.motif).toMatch(/29-14/)
    expect(resultat.fondement).toBe('L. 1965 art. 14-2-1, I')
  })

  it.each(['travaux_amelioration', 'charges_courantes', 'compensation_impaye', 'frais_contentieux', 'travaux_privatifs'] as const)(
    '« %s » est exclu du fonds de travaux, même avec une décision d’assemblée',
    (objet) => {
      const resultat = controlerAffectationFondsTravaux(decaissement({ objet }))
      expect(resultat.autorise).toBe(false)
      expect(resultat.cause).toBe('exclu')
    },
  )

  it('les travaux d’amélioration hors plan sont refusés, mais le motif rappelle la voie du plan adopté', () => {
    expect(controlerAffectationFondsTravaux(decaissement({ objet: 'travaux_amelioration' })).motif).toMatch(/figurent au plan pluriannuel de travaux adopté/)
  })

  it.each(['elaboration_ppt_dtg', 'travaux_ppt', 'travaux_urgents', 'travaux_hors_ppt'] as const)(
    '« %s » (une des quatre dépenses du I) est admis sur décision d’affectation de l’assemblée',
    (objet) => {
      const resultat = controlerAffectationFondsTravaux(decaissement({ objet }))
      expect(resultat).toMatchObject({ autorise: true, cause: 'admis', fondement: 'L. 1965 art. 14-2-1, I' })
    },
  )

  it.each(['elaboration_ppt_dtg', 'travaux_ppt', 'travaux_urgents', 'travaux_hors_ppt'] as const)(
    '« %s » sans décision d’affectation de l’assemblée est refusé',
    (objet) => {
      for (const decisionAg of [null, '  ']) {
        const resultat = controlerAffectationFondsTravaux(decaissement({ objet, decisionAg }))
        expect(resultat.autorise).toBe(false)
        expect(resultat.cause).toBe('decision_manquante')
        expect(resultat.motif).toMatch(/décision d'assemblée/)
      }
    },
  )

  it('travaux urgents : le syndic décide seul des travaux, pas de l’usage du fonds', () => {
    const resultat = controlerAffectationFondsTravaux(decaissement({ objet: 'travaux_urgents', decisionAg: null }))
    expect(resultat.motif).toMatch(/décide seul des travaux urgents, pas de l.usage du fonds/)
  })

  it('art. 29-14, 2° : usage pour le redressement ou la gestion courante, sur autorisation du juge seulement', () => {
    const autorise = controlerAffectationFondsTravaux(
      decaissement({ objet: 'redressement_29_14', decisionAg: null, autorisationJuge: 'Ordonnance du 02/09/2026' }),
    )
    expect(autorise).toMatchObject({ autorise: true, cause: 'admis', fondement: 'L. 1965 art. 29-14' })
    const sansJuge = controlerAffectationFondsTravaux(decaissement({ objet: 'redressement_29_14', autorisationJuge: ' ' }))
    expect(sansJuge).toMatchObject({ autorise: false, cause: 'autorisation_manquante' })
    expect(sansJuge.motif).toMatch(/juge/)
  })

  it('le montant doit être en centimes entiers strictement positifs ; un objet inconnu ou ancien est refusé', () => {
    expect(() => controlerAffectationFondsTravaux(decaissement({ montantCentimes: 10.5 }))).toThrow(/centimes/)
    expect(() => controlerAffectationFondsTravaux(decaissement({ montantCentimes: 0 }))).toThrow(/centimes/)
    // @ts-expect-error — objet hors AFFECTATION_FONDS_TRAVAUX
    expect(() => controlerAffectationFondsTravaux(decaissement({ objet: 'entretien' }))).toThrow(/objet/i)
    // @ts-expect-error — anciennes clés, absentes du texte en vigueur
    expect(() => controlerAffectationFondsTravaux(decaissement({ objet: 'travaux_votes_ag' }))).toThrow(/objet/i)
    // @ts-expect-error — clé héritée de JavaScript
    expect(() => controlerAffectationFondsTravaux(decaissement({ objet: 'constructor' }))).toThrow(/objet/i)
  })

  it('le référentiel suit le texte : les quatre dépenses du I, numérotées, puis la voie judiciaire, puis les exclusions', () => {
    const admis = Object.entries(AFFECTATION_FONDS_TRAVAUX).filter(([, a]) => a.admis).map(([cle]) => cle)
    expect(admis).toEqual(['elaboration_ppt_dtg', 'travaux_ppt', 'travaux_urgents', 'travaux_hors_ppt', 'redressement_29_14'])
    expect(admis.slice(0, 4).map((cle) => AFFECTATION_FONDS_TRAVAUX[cle as keyof typeof AFFECTATION_FONDS_TRAVAUX].alinea)).toEqual([
      '1°',
      '2°',
      '3°',
      '4°',
    ])
    expect(Object.keys(AFFECTATION_FONDS_TRAVAUX)).toHaveLength(10)
  })
})

describe('J4 — obligation de constituer le fonds (art. 14-2-1, I ; loi n° 2021-1104, art. 171, VI)', () => {
  it('immeuble sans habitation : pas de fonds obligatoire', () => {
    expect(obligationFondsTravaux(immeuble({ destinationHabitation: false }), AUJOURDHUI)).toMatchObject({
      obligatoire: false,
      depuis: null,
      aConfirmer: false,
    })
  })

  it('destination non renseignée : à établir', () => {
    const obligation = obligationFondsTravaux(immeuble({ destinationHabitation: null }), AUJOURDHUI)
    expect(obligation).toMatchObject({ obligatoire: null, aConfirmer: true })
    expect(obligation.motif).toMatch(/destination/i)
  })

  it('50 lots au plus, réception de plus de dix ans : obligatoire depuis le 01/01/2025, sans dispense', () => {
    const obligation = obligationFondsTravaux(immeuble(), AUJOURDHUI)
    expect(obligation).toMatchObject({ obligatoire: true, depuis: '2025-01-01', aConfirmer: false })
    expect(obligation.motif).toMatch(/aucune dispense/i)
    expect(obligation.fondements).toEqual(['L. 1965 art. 14-2-1, I', 'Loi n° 2021-1104 du 22 août 2021, art. 171, VI'])
  })

  it('le plus tardif l’emporte entre l’entrée en vigueur (selon les lots) et les dix ans après la réception', () => {
    expect(obligationFondsTravaux(immeuble({ nbLotsPrincipaux: 250 }), AUJOURDHUI).depuis).toBe('2024-06-15')
    expect(obligationFondsTravaux(immeuble({ nbLotsPrincipaux: 201, dateReception: '2000-03-01' }), AUJOURDHUI).depuis).toBe('2023-01-01')
    expect(obligationFondsTravaux(immeuble({ nbLotsPrincipaux: 200, dateReception: '2000-03-01' }), AUJOURDHUI).depuis).toBe('2024-01-01')
    expect(obligationFondsTravaux(immeuble({ nbLotsPrincipaux: 51, dateReception: '2000-03-01' }), AUJOURDHUI).depuis).toBe('2024-01-01')
    expect(obligationFondsTravaux(immeuble({ nbLotsPrincipaux: 50, dateReception: '2000-03-01' }), AUJOURDHUI).depuis).toBe('2025-01-01')
  })

  it('réception de moins de dix ans : pas encore obligatoire, avec la date à laquelle il le deviendra', () => {
    const obligation = obligationFondsTravaux(immeuble({ dateReception: '2020-03-01' }), AUJOURDHUI)
    expect(obligation).toMatchObject({ obligatoire: false, depuis: '2030-03-01', aConfirmer: false })
    expect(obligation.motif).toMatch(/10 ans après la réception/)
    expect(obligation.motif).toMatch(/01\/03\/2030/)
  })

  it('avant l’entrée en vigueur applicable : l’ancien art. 14-2 s’appliquait, réponse à établir', () => {
    const obligation = obligationFondsTravaux(immeuble({ nbLotsPrincipaux: 50, dateReception: '2000-01-01' }), '2023-06-01')
    expect(obligation).toMatchObject({ obligatoire: null, depuis: null, aConfirmer: true })
    expect(obligation.motif).toMatch(/ancien art. 14-2/)
  })

  it('fonds déjà dû sous l’ancien régime (cinq ans) mais pas encore sous le nouveau (dix ans) : transition à confirmer', () => {
    const obligation = obligationFondsTravaux(immeuble({ dateReception: '2017-03-01' }), AUJOURDHUI)
    expect(obligation).toMatchObject({ obligatoire: false, depuis: '2027-03-01', aConfirmer: true })
    expect(obligation.motif).toMatch(/sort transitoire/)
  })

  it('le jour même où l’obligation naît, elle joue', () => {
    expect(obligationFondsTravaux(immeuble({ dateReception: '2016-10-29' }), AUJOURDHUI)).toMatchObject({
      obligatoire: true,
      depuis: '2026-10-29',
    })
  })

  it('nombre de lots inconnu : obligatoire au plus tard le 01/01/2025 ; avant, à établir (régime antérieur possible)', () => {
    const certain = obligationFondsTravaux(immeuble({ nbLotsPrincipaux: null, dateReception: '2000-01-01' }), AUJOURDHUI)
    expect(certain).toMatchObject({ obligatoire: true, depuis: '2025-01-01', aConfirmer: true })
    expect(certain.motif).toMatch(/au plus tard/)
    expect(obligationFondsTravaux(immeuble({ nbLotsPrincipaux: null, dateReception: '2000-01-01' }), '2022-12-31')).toMatchObject({
      obligatoire: null,
      aConfirmer: true,
    })
    expect(obligationFondsTravaux(immeuble({ nbLotsPrincipaux: null, dateReception: '2000-01-01' }), '2024-06-01')).toMatchObject({
      obligatoire: null,
      aConfirmer: true,
    })
  })

  it('seule l’année de construction est connue : réponse marquée à confirmer', () => {
    const ancien = obligationFondsTravaux(immeuble({ dateReception: null, anneeConstruction: 1975 }), AUJOURDHUI)
    expect(ancien).toMatchObject({ obligatoire: true, depuis: '2025-01-01', aConfirmer: true })
    expect(ancien.motif).toMatch(/année de construction/)
    const recent = obligationFondsTravaux(immeuble({ dateReception: null, anneeConstruction: 2020 }), AUJOURDHUI)
    expect(recent).toMatchObject({ obligatoire: false, depuis: '2030-12-31', aConfirmer: true })
    // Réception supposée au plus tard le 31/12 : même date que pour une réception connue ce jour-là.
    expect(obligationFondsTravaux(immeuble({ dateReception: null, anneeConstruction: 2016 }), '2026-12-31')).toMatchObject({
      obligatoire: true,
      depuis: '2026-12-31',
    })
    // Un immeuble ancien n'a pas d'année plancher.
    expect(obligationFondsTravaux(immeuble({ dateReception: null, anneeConstruction: 1880 }), AUJOURDHUI).obligatoire).toBe(true)
  })

  it('ni réception ni année de construction : à établir', () => {
    const obligation = obligationFondsTravaux(immeuble({ dateReception: null }), AUJOURDHUI)
    expect(obligation).toMatchObject({ obligatoire: null, depuis: null, aConfirmer: true })
    expect(obligation.motif).toMatch(/réception/)
  })

  it('refuse une saisie invalide', () => {
    expect(() => obligationFondsTravaux(immeuble(), '29/10/2026')).toThrow(/AAAA-MM-JJ/)
    expect(() => obligationFondsTravaux(immeuble({ dateReception: '2014-02-30' }), AUJOURDHUI)).toThrow(/réception/i)
    expect(() => obligationFondsTravaux(immeuble({ nbLotsPrincipaux: -1 }), AUJOURDHUI)).toThrow(/lots/i)
    expect(() => obligationFondsTravaux(immeuble({ nbLotsPrincipaux: 2.5 }), AUJOURDHUI)).toThrow(/lots/i)
    expect(() => obligationFondsTravaux(immeuble({ dateReception: null, anneeConstruction: 1975.5 }), AUJOURDHUI)).toThrow(/année/i)
    expect(() => obligationFondsTravaux(immeuble({ dateReception: null, anneeConstruction: 2027 }), AUJOURDHUI)).toThrow(/année/i)
  })
})

describe('J4 — cotisation minimale (art. 14-2-1, I, al. 8)', () => {
  it('sans plan adopté : 5 % du budget prévisionnel', () => {
    expect(cotisationMinimaleFondsTravaux({ budgetPrevisionnelCentimes: BUDGET, travauxPptAdopteCentimes: null })).toEqual({
      minimumCentimes: 45_350,
      cinqPourcentBudgetCentimes: 45_350,
      deuxEtDemiPourcentPptCentimes: null,
      retenu: 'budget',
      aConfirmer: false,
      fondement: 'L. 1965 art. 14-2-1, I',
    })
  })

  it('plan pluriannuel non renseigné : seul le plancher de 5 % est calculé, à confirmer', () => {
    expect(cotisationMinimaleFondsTravaux({ budgetPrevisionnelCentimes: BUDGET, travauxPptAdopteCentimes: PPT_INCONNU })).toMatchObject({
      minimumCentimes: 45_350,
      deuxEtDemiPourcentPptCentimes: null,
      aConfirmer: true,
    })
  })

  it('« ne peut être inférieur » : arrondi au centime supérieur', () => {
    expect(cotisationMinimaleFondsTravaux({ budgetPrevisionnelCentimes: 1_001, travauxPptAdopteCentimes: 1_001 })).toMatchObject({
      cinqPourcentBudgetCentimes: 51,
      deuxEtDemiPourcentPptCentimes: 26,
      minimumCentimes: 51,
    })
  })

  it('avec un plan adopté : les deux planchers jouent, le plus élevé s’impose', () => {
    expect(cotisationMinimaleFondsTravaux({ budgetPrevisionnelCentimes: BUDGET, travauxPptAdopteCentimes: 3_000_000 })).toMatchObject({
      minimumCentimes: 75_000,
      retenu: 'ppt',
    })
    expect(cotisationMinimaleFondsTravaux({ budgetPrevisionnelCentimes: BUDGET, travauxPptAdopteCentimes: 1_000_000 })).toMatchObject({
      minimumCentimes: 45_350,
      deuxEtDemiPourcentPptCentimes: 25_000,
      retenu: 'budget',
    })
  })

  it('refuse un budget ou un montant de plan invalide', () => {
    expect(() => cotisationMinimaleFondsTravaux({ budgetPrevisionnelCentimes: -1, travauxPptAdopteCentimes: null })).toThrow(/centimes/)
    expect(() => cotisationMinimaleFondsTravaux({ budgetPrevisionnelCentimes: 10.5, travauxPptAdopteCentimes: null })).toThrow(/centimes/)
    expect(() => cotisationMinimaleFondsTravaux({ budgetPrevisionnelCentimes: BUDGET, travauxPptAdopteCentimes: -5 })).toThrow(/centimes/)
  })
})

describe('J4 — contrôle de la cotisation votée', () => {
  const assiette = { budgetPrevisionnelCentimes: BUDGET, travauxPptAdopteCentimes: null }

  it('au minimum : rien à signaler', () => {
    expect(controlerCotisationFondsTravaux({ cotisationAnnuelleCentimes: 45_350 }, assiette)).toEqual([])
  })

  it('plan non renseigné : le plancher de 2,5 % et les seuils de suspension restent à vérifier', () => {
    const inconnu = { budgetPrevisionnelCentimes: BUDGET, travauxPptAdopteCentimes: PPT_INCONNU }
    expect(controlerCotisationFondsTravaux({ cotisationAnnuelleCentimes: 45_350 }, inconnu)).toMatchObject([
      { code: 'plancher_ppt_a_verifier', aConfirmer: true },
    ])
    expect(
      controlerCotisationFondsTravaux(
        { cotisationAnnuelleCentimes: 0, suspension: { origine: 'ag', reference: 'AG du 12/03/2026, résolution 9' }, soldeFondsCentimes: 1_000_000 },
        inconnu,
      ),
    ).toMatchObject([{ code: 'suspension_seuils_a_verifier', aConfirmer: true }])
  })

  it('sous le minimum : anomalie motivée, avec son fondement', () => {
    const [anomalie, ...autres] = controlerCotisationFondsTravaux({ cotisationAnnuelleCentimes: 40_000 }, assiette)
    expect(autres).toEqual([])
    expect(anomalie).toMatchObject({ code: 'cotisation_sous_minimum', fondement: 'L. 1965 art. 14-2-1, I', aConfirmer: false })
    expect(anomalie.message).toMatch(/400,00/)
    expect(anomalie.message).toMatch(/453,50/)
  })

  it('au-dessus du minimum : majorité des voix de tous les copropriétaires, ou second vote de l’art. 25-1', () => {
    const decision = { cotisationAnnuelleCentimes: 60_000 }
    expect(controlerCotisationFondsTravaux({ ...decision, majorite: 'art24' }, assiette)).toMatchObject([
      { code: 'majorite_insuffisante', fondement: 'L. 1965 art. 14-2-1, I' },
    ])
    expect(controlerCotisationFondsTravaux({ ...decision, majorite: 'art24', secondVoteArt25_1: true }, assiette)).toEqual([])
    for (const majorite of ['art25', 'art26', 'unanimite'] as const)
      expect(controlerCotisationFondsTravaux({ ...decision, majorite }, assiette)).toEqual([])
    expect(controlerCotisationFondsTravaux(decision, assiette)).toEqual([])
  })

  it('suspension votée par l’assemblée quand le fonds excède le budget : régulière', () => {
    expect(
      controlerCotisationFondsTravaux(
        { cotisationAnnuelleCentimes: 0, suspension: { origine: 'ag', reference: 'AG du 12/03/2026, résolution 9' }, soldeFondsCentimes: 1_000_000 },
        assiette,
      ),
    ).toEqual([])
  })

  it('suspension votée sous les seuils : la cotisation reste due (déduit, à confirmer)', () => {
    const suspension = { origine: 'ag' as const, reference: 'AG du 12/03/2026, résolution 9' }
    expect(controlerCotisationFondsTravaux({ cotisationAnnuelleCentimes: 0, suspension, soldeFondsCentimes: BUDGET }, assiette)).toMatchObject([
      { code: 'suspension_hors_seuils', fondement: 'L. 1965 art. 14-2-1, II', aConfirmer: true },
    ])
    // Avec un plan adopté, il faut EN OUTRE dépasser la moitié de ses travaux.
    expect(
      controlerCotisationFondsTravaux(
        { cotisationAnnuelleCentimes: 0, suspension, soldeFondsCentimes: 1_000_000 },
        { budgetPrevisionnelCentimes: BUDGET, travauxPptAdopteCentimes: 3_000_000 },
      ),
    ).toMatchObject([{ code: 'suspension_hors_seuils' }])
    // Le fonds dépasse la moitié du plan mais pas le budget : les conditions sont cumulatives.
    expect(
      controlerCotisationFondsTravaux(
        { cotisationAnnuelleCentimes: 0, suspension, soldeFondsCentimes: 600_000 },
        { budgetPrevisionnelCentimes: BUDGET, travauxPptAdopteCentimes: 1_000_000 },
      ),
    ).toMatchObject([{ code: 'suspension_hors_seuils' }])
    expect(controlerCotisationFondsTravaux({ cotisationAnnuelleCentimes: 0, suspension }, assiette)).toMatchObject([
      { code: 'suspension_seuils_a_verifier', aConfirmer: true },
    ])
  })

  it('suspension par le juge (plan de sauvegarde, art. 29-14, 1°) : pas de condition de seuil', () => {
    expect(
      controlerCotisationFondsTravaux(
        { cotisationAnnuelleCentimes: 0, suspension: { origine: 'juge_29_14', reference: 'Ordonnance du 02/09/2026' }, soldeFondsCentimes: 0 },
        assiette,
      ),
    ).toEqual([])
  })

  it('refuse une saisie invalide', () => {
    expect(() => controlerCotisationFondsTravaux({ cotisationAnnuelleCentimes: -1 }, assiette)).toThrow(/centimes/)
    expect(() =>
      controlerCotisationFondsTravaux({ cotisationAnnuelleCentimes: 0, suspension: { origine: 'ag', reference: ' ' } }, assiette),
    ).toThrow(/suspension/i)
  })
})

describe('J4 — l’assemblée doit se prononcer sur la suspension (art. 14-2-1, II)', () => {
  it('sans plan : dès que le fonds excède le budget prévisionnel (strictement)', () => {
    const alerte = questionSuspensionFondsTravaux({ soldeFondsCentimes: BUDGET + 1, budgetPrevisionnelCentimes: BUDGET, travauxPptAdopteCentimes: null })
    expect(alerte).toMatchObject({ code: 'ag_doit_se_prononcer_suspension', fondement: 'L. 1965 art. 14-2-1, II' })
    expect(alerte?.message).toMatch(/se prononcer/)
    expect(alerte?.message).toMatch(/pas automatique/)
    expect(questionSuspensionFondsTravaux({ soldeFondsCentimes: BUDGET, budgetPrevisionnelCentimes: BUDGET, travauxPptAdopteCentimes: null })).toBeNull()
  })

  it('avec un plan adopté : il faut en outre dépasser la moitié de ses travaux', () => {
    const assiette = { budgetPrevisionnelCentimes: BUDGET, travauxPptAdopteCentimes: 3_000_000 }
    expect(questionSuspensionFondsTravaux({ ...assiette, soldeFondsCentimes: 1_500_000 })).toBeNull()
    expect(questionSuspensionFondsTravaux({ ...assiette, soldeFondsCentimes: 1_500_001 })?.code).toBe('ag_doit_se_prononcer_suspension')
    // Conditions cumulatives : plus de la moitié du plan ne suffit pas sans dépasser le budget.
    expect(
      questionSuspensionFondsTravaux({ budgetPrevisionnelCentimes: BUDGET, travauxPptAdopteCentimes: 1_000_000, soldeFondsCentimes: 600_000 }),
    ).toBeNull()
  })

  it('plan non renseigné : alerte dès le budget dépassé, marquée à confirmer', () => {
    const alerte = questionSuspensionFondsTravaux({
      budgetPrevisionnelCentimes: BUDGET,
      travauxPptAdopteCentimes: PPT_INCONNU,
      soldeFondsCentimes: BUDGET + 1,
    })
    expect(alerte).toMatchObject({ code: 'ag_doit_se_prononcer_suspension', aConfirmer: true })
    expect(alerte?.message).toMatch(/plan non renseigné/)
  })

  it('refuse un solde invalide', () => {
    expect(() => questionSuspensionFondsTravaux({ soldeFondsCentimes: 1.5, budgetPrevisionnelCentimes: BUDGET, travauxPptAdopteCentimes: null })).toThrow(/centimes/)
  })
})

describe('J4 — appels de cotisation, aux modalités des provisions du budget (art. 14-2-1, I, al. 6)', () => {
  const provisions = ['2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01'].map((exigibilite) => ({ exigibilite, montantCentimes: 226_750 }))
  const saisie = { coproprieteId: 'copro-1', cleId: '001', exercice: '2026', cotisationAnnuelleCentimes: 45_350, provisions }

  it('une échéance « fonds_travaux » par provision, au compte 10500, sans centime perdu ni créé', () => {
    const echeances = echeancesCotisationFondsTravaux(saisie)
    expect(echeances).toEqual([
      { id: 'FT-2026-1', coproprieteId: 'copro-1', cleId: '001', exigibilite: '2026-01-01', libelle: 'Fonds de travaux 2026 — appel n° 1', montantCentimes: 11_338, nature: 'fonds_travaux', compteContrepartie: '10500' },
      { id: 'FT-2026-2', coproprieteId: 'copro-1', cleId: '001', exigibilite: '2026-04-01', libelle: 'Fonds de travaux 2026 — appel n° 2', montantCentimes: 11_338, nature: 'fonds_travaux', compteContrepartie: '10500' },
      { id: 'FT-2026-3', coproprieteId: 'copro-1', cleId: '001', exigibilite: '2026-07-01', libelle: 'Fonds de travaux 2026 — appel n° 3', montantCentimes: 11_337, nature: 'fonds_travaux', compteContrepartie: '10500' },
      { id: 'FT-2026-4', coproprieteId: 'copro-1', cleId: '001', exigibilite: '2026-10-01', libelle: 'Fonds de travaux 2026 — appel n° 4', montantCentimes: 11_337, nature: 'fonds_travaux', compteContrepartie: '10500' },
    ])
    // Gestéam arrondit chaque trimestre (l'année dépasse de quelques centimes) ; ici, la somme égale la cotisation.
    expect(echeances.reduce((s, e) => s + e.montantCentimes, 0)).toBe(45_350)
  })

  it('suit le poids de chaque provision quand elles sont inégales', () => {
    const inegales = [
      { exigibilite: '2026-01-01', montantCentimes: 300 },
      { exigibilite: '2026-07-01', montantCentimes: 100 },
    ]
    expect(echeancesCotisationFondsTravaux({ ...saisie, cotisationAnnuelleCentimes: 1_000, provisions: inegales }).map((e) => e.montantCentimes)).toEqual([750, 250])
  })

  it('cotisation nulle (suspendue) : aucun appel', () => {
    expect(echeancesCotisationFondsTravaux({ ...saisie, cotisationAnnuelleCentimes: 0 })).toEqual([])
  })

  it('refuse : aucune provision, provision négative ou date invalide, provisions toutes nulles', () => {
    expect(() => echeancesCotisationFondsTravaux({ ...saisie, provisions: [] })).toThrow(/provision/i)
    expect(() => echeancesCotisationFondsTravaux({ ...saisie, provisions: [{ exigibilite: '2026-01-01', montantCentimes: -1 }] })).toThrow(/centimes/)
    expect(() => echeancesCotisationFondsTravaux({ ...saisie, provisions: [{ exigibilite: '01/01/2026', montantCentimes: 1 }] })).toThrow(/AAAA-MM-JJ/)
    expect(() => echeancesCotisationFondsTravaux({ ...saisie, provisions: [{ exigibilite: '2026-01-01', montantCentimes: 0 }] })).toThrow(/provision/i)
  })
})

describe('J4 — « Montant bloqué » : un garde-fou de gestion, pas une règle légale', () => {
  it('par défaut, pas de plancher (0) ; le montant est en centimes entiers, positif ou nul', () => {
    expect(creerReglagesFondsTravaux({})).toEqual({ montantBloqueCentimes: 0 })
    expect(creerReglagesFondsTravaux({ montantBloqueCentimes: 500_000 }).montantBloqueCentimes).toBe(500_000)
    expect(() => creerReglagesFondsTravaux({ montantBloqueCentimes: -1 })).toThrow(/centimes/)
    expect(() => creerReglagesFondsTravaux({ montantBloqueCentimes: 12.5 })).toThrow(/centimes/)
  })

  it('sous le seuil : alerte de gestion ; au-dessus, ou sans seuil : rien', () => {
    const reglages = creerReglagesFondsTravaux({ montantBloqueCentimes: 500_000 })
    expect(controlerSeuilFondsTravaux(499_999, reglages)).toMatchObject({ code: 'sous_montant_bloque', ecartCentimes: 1 })
    expect(controlerSeuilFondsTravaux(500_000, reglages)).toBeNull()
    expect(controlerSeuilFondsTravaux(0, creerReglagesFondsTravaux({}))).toBeNull()
  })

  it('l’alerte de seuil ne cite aucun fondement légal et se dit garde-fou interne', () => {
    const alerte = controlerSeuilFondsTravaux(100, creerReglagesFondsTravaux({ montantBloqueCentimes: 500_000 }))
    expect(alerte?.message).toMatch(/garde-fou de gestion/)
    expect(alerte?.message).toMatch(/aucun texte/)
    expect(alerte?.message).not.toMatch(/\bart\.|article|L\. 1965|loi du/i)
    expect(alerte).not.toHaveProperty('fondement')
  })

  it('le sens du champ est marqué DÉDUIT, le texte est daté de sa relecture, et les points ouverts restent visibles', () => {
    const source = readFileSync(
      join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'fonds-travaux.ts'),
      'utf8',
    )
    expect(source).toMatch(/DÉDUIT/)
    expect(source).toMatch(/🔴/)
    expect(source).toMatch(/Légifrance le 29\/10\/2026/)
    expect(source).not.toMatch(/Non établi : la rédaction exactement en vigueur/)
  })
})
