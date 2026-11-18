import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AFFECTATION_FONDS_TRAVAUX,
  NATURES_FONDS,
  controlerAffectationFondsTravaux,
  controlerCotisationFondsTravaux,
  controlerSeuilFondsTravaux,
  cotisationAnnuelleDue,
  cotisationMinimaleFondsTravaux,
  creerReglagesFondsTravaux,
  echeancesCotisationFondsTravaux,
  etatSuspensionCotisationsFondsTravaux,
  lireDecisionAffectationAg,
  lireOrdonnanceJuge,
  obligationFondsTravaux,
  PPT_INCONNU,
  questionSuspensionFondsTravaux,
  type DecaissementFondsTravaux,
  type OptionsControleAffectation,
  type OrdonnanceJuge,
  type SaisieObligationFondsTravaux,
} from '@/lib/administrateur-judiciaire/domain/fonds-travaux'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { NATURE_PLAN_COMPTABLE } from '@/lib/data/referentiels-gesteam-judiciaire'
import { enTeteDuModule } from './en-tete-module'

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

/** J67, R86 : fondements des régimes antérieurs à l'art. 14-2-1. */
const FONDEMENT_CREATION = 'L. 1965 art. 14-2, rédaction issue de la loi n° 2014-366, art. 58 (fonds de travaux créé le 01/01/2017)'
const ANCIEN_14_2 = 'L. 1965 art. 14-2 (rédactions en vigueur du 01/01/2017 au 01/01/2023)'

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

/**
 * Décision J30 de Hugo (03/11/2026) : l'ordonnance de l'art. 29-14, 2° n'est plus un texte libre. Forme exigée :
 * juridiction, date et n° de l'ordonnance, chacun obligatoire, date ISO jamais après aujourd'hui. Décision d'affectation
 * de l'assemblée : date de l'AG et n° de la résolution, déclinaison confirmée par la décision J42 du 06/11/2026. Une
 * valeur ancienne en texte libre reste lisible et admise, signalée « forme incomplète » ; une nouvelle saisie en texte
 * libre est refusée.
 */
describe('J30 — forme de l’ordonnance de l’art. 29-14, 2° et de la décision d’affectation', () => {
  const ORDONNANCE: OrdonnanceJuge = { juridiction: 'Tribunal judiciaire de Lyon', date: '2026-09-02', numero: 'RG 26/01234' }
  const DECISION = { dateAg: '2026-03-12', numeroResolution: '8' }
  const AU = { aujourdhui: AUJOURDHUI }
  const parLeJuge = (autorisationJuge: DecaissementFondsTravaux['autorisationJuge'], options: OptionsControleAffectation = AU) =>
    controlerAffectationFondsTravaux(decaissement({ objet: 'redressement_29_14', decisionAg: null, autorisationJuge }), options)
  const parAg = (decisionAg: DecaissementFondsTravaux['decisionAg'], options: OptionsControleAffectation = AU) =>
    controlerAffectationFondsTravaux(decaissement({ objet: 'travaux_ppt', decisionAg }), options)

  it('ordonnance complète (juridiction, date, n°) : usage admis, désignée dans le motif, forme complète', () => {
    const resultat = parLeJuge(ORDONNANCE)
    expect(resultat).toMatchObject({ autorise: true, cause: 'admis', fondement: 'L. 1965 art. 29-14', formeIncomplete: null })
    expect(resultat.motif).toMatch(/ordonnance n° RG 26\/01234 du 02\/09\/2026, Tribunal judiciaire de Lyon/)
  })

  it.each([
    ['juridiction', 'juridiction'],
    ['date', "date de l'ordonnance"],
    ['numero', "n° de l'ordonnance"],
  ] as const)('ordonnance sans %s : refus explicite et motivé', (champ, libelle) => {
    for (const vide of ['', '   ']) {
      const resultat = parLeJuge({ ...ORDONNANCE, [champ]: vide })
      expect(resultat).toMatchObject({ autorise: false, cause: 'reference_invalide', fondement: 'L. 1965 art. 29-14', formeIncomplete: null })
      expect(resultat.motif).toContain(`manque : ${libelle}`)
      expect(resultat.motif).toContain("forme exigée : juridiction, date et n° de l'ordonnance")
    }
  })

  it('ordonnance à qui il manque plusieurs champs : tous nommés', () => {
    const resultat = parLeJuge({ juridiction: ' ', date: '', numero: 'RG 26/01234' })
    expect(resultat.motif).toContain("manque : juridiction, date de l'ordonnance")
  })

  it('date de l’ordonnance non ISO ou postérieure à aujourd’hui : refusée', () => {
    for (const date of ['02/09/2026', '2026-02-30']) {
      const resultat = parLeJuge({ ...ORDONNANCE, date })
      expect(resultat).toMatchObject({ autorise: false, cause: 'reference_invalide' })
      expect(resultat.motif).toContain("date de l'ordonnance au format AAAA-MM-JJ")
    }
    const future = parLeJuge({ ...ORDONNANCE, date: '2026-10-30' })
    expect(future).toMatchObject({ autorise: false, cause: 'reference_invalide' })
    expect(future.motif).toMatch(/date de l'ordonnance \(30\/10\/2026\) postérieure à aujourd'hui/)
    expect(parLeJuge({ ...ORDONNANCE, date: AUJOURDHUI })).toMatchObject({ autorise: true, cause: 'admis' })
  })

  it('forme structurée sans date du jour, ou date du jour invalide : erreur d’appel', () => {
    expect(() => parLeJuge(ORDONNANCE, {})).toThrow(/date du jour attendue/)
    expect(() => parLeJuge(ORDONNANCE, { aujourdhui: '29/10/2026' })).toThrow(/Date du jour invalide/)
  })

  it('valeur ancienne en texte libre : lisible, admise, signalée « forme incomplète », même sans date du jour', () => {
    const resultat = parLeJuge(' Ordonnance du 02/09/2026 ', {})
    expect(resultat).toMatchObject({ autorise: true, cause: 'admis' })
    expect(resultat.formeIncomplete).toEqual({
      code: 'forme_incomplete',
      texte: 'Ordonnance du 02/09/2026',
      manquants: ['juridiction', "date de l'ordonnance", "n° de l'ordonnance"],
      message: expect.stringMatching(/saisie en texte libre \(« Ordonnance du 02\/09\/2026 »\) : forme incomplète/),
    })
  })

  it('texte blanc ou absent : toujours une autorisation manquante, qui rappelle la forme exigée', () => {
    for (const vide of [null, undefined, '  ']) {
      const resultat = parLeJuge(vide)
      expect(resultat).toMatchObject({ autorise: false, cause: 'autorisation_manquante', formeIncomplete: null })
      expect(resultat.motif).toContain("juridiction, date et n° de l'ordonnance")
    }
  })

  it('J42 : décision d’affectation de l’assemblée : date de l’AG et n° de la résolution ; motif inchangé (« forme attendue »)', () => {
    const resultat = parAg(DECISION)
    expect(resultat).toMatchObject({ autorise: true, cause: 'admis', formeIncomplete: null })
    expect(resultat.motif).toMatch(/résolution n° 8 de l'assemblée du 12\/03\/2026/)
    const sansNumero = parAg({ ...DECISION, numeroResolution: ' ' })
    expect(sansNumero).toMatchObject({ autorise: false, cause: 'reference_invalide', fondement: 'L. 1965 art. 14-2-1, I' })
    expect(sansNumero.motif).toContain('manque : n° de la résolution')
    expect(sansNumero.motif).toContain("forme attendue : date de l'assemblée et n° de la résolution")
    expect(parAg({ ...DECISION, dateAg: '2026-11-02' }).motif).toMatch(/date de l'assemblée \(02\/11\/2026\) postérieure à aujourd'hui/)
  })

  it('décision d’affectation ancienne en texte libre : admise, signalée « forme incomplète » (comportement inchangé par J42)', () => {
    const resultat = parAg('AG du 12/03/2026, résolution 8', {})
    expect(resultat).toMatchObject({ autorise: true, cause: 'admis' })
    expect(resultat.formeIncomplete).toMatchObject({
      texte: 'AG du 12/03/2026, résolution 8',
      manquants: ["date de l'assemblée", 'n° de la résolution'],
    })
    expect(resultat.formeIncomplete?.message).toMatch(/forme incomplète/)
  })

  it('nouvelle saisie (nouvelleSaisie) : un texte libre est refusé, motif « forme incomplète » à l’appui', () => {
    const ordonnance = parLeJuge('Ordonnance du 02/09/2026', { ...AU, nouvelleSaisie: true })
    expect(ordonnance).toMatchObject({ autorise: false, cause: 'reference_invalide', fondement: 'L. 1965 art. 29-14', formeIncomplete: null })
    expect(ordonnance.motif).toMatch(/saisie en texte libre \(« Ordonnance du 02\/09\/2026 »\) : forme incomplète/)
    expect(ordonnance.motif).toMatch(/refusée pour une nouvelle saisie/)
    expect(ordonnance.motif).toContain("forme exigée : juridiction, date et n° de l'ordonnance")
    const decision = parAg('AG du 12/03/2026, résolution 8', { nouvelleSaisie: true })
    expect(decision).toMatchObject({ autorise: false, cause: 'reference_invalide', fondement: 'L. 1965 art. 14-2-1, I' })
    expect(decision.motif).toMatch(/forme incomplète/)
    expect(decision.motif).toContain("forme attendue : date de l'assemblée et n° de la résolution")
    expect(parLeJuge(ORDONNANCE, { ...AU, nouvelleSaisie: true })).toMatchObject({ autorise: true, cause: 'admis' })
    expect(parLeJuge('  ', { ...AU, nouvelleSaisie: true })).toMatchObject({ autorise: false, cause: 'autorisation_manquante' })
  })

  it('valeur enregistrée lue par un calcul (aujourdhui: null) : forme contrôlée, date non comparée au jour, jamais d’erreur', () => {
    const lecture = { aujourdhui: null }
    expect(parLeJuge({ ...ORDONNANCE, date: '2027-01-15' }, lecture)).toMatchObject({ autorise: true, cause: 'admis', formeIncomplete: null })
    expect(parAg({ ...DECISION, dateAg: '2027-01-15' }, lecture)).toMatchObject({ autorise: true, cause: 'admis' })
    expect(parLeJuge({ ...ORDONNANCE, numero: '' }, lecture)).toMatchObject({ autorise: false, cause: 'reference_invalide' })
    expect(parLeJuge({ ...ORDONNANCE, date: '02/09/2026' }, lecture).motif).toContain("date de l'ordonnance au format AAAA-MM-JJ")
    expect(parLeJuge('Ordonnance du 02/09/2026', lecture)).toMatchObject({ autorise: true, formeIncomplete: { code: 'forme_incomplete' } })
  })

  it('lecture d’une valeur enregistrée : absente, complète, incomplète (texte ancien ou champ manquant), jamais rejetée', () => {
    expect(lireOrdonnanceJuge(null)).toEqual({ forme: 'absente' })
    expect(lireOrdonnanceJuge(' ')).toEqual({ forme: 'absente' })
    expect(lireOrdonnanceJuge({ juridiction: ' TJ de Lyon ', date: '2026-09-02', numero: ' RG 26/01234' })).toEqual({
      forme: 'complete',
      valeur: { juridiction: 'TJ de Lyon', date: '2026-09-02', numero: 'RG 26/01234' },
    })
    expect(lireOrdonnanceJuge('Ordonnance du 02/09/2026')).toEqual({
      forme: 'incomplete',
      texte: 'Ordonnance du 02/09/2026',
      manquants: ['juridiction', "date de l'ordonnance", "n° de l'ordonnance"],
    })
    expect(lireOrdonnanceJuge({ juridiction: 'TJ de Lyon', date: '2026-09-02' } as unknown as OrdonnanceJuge)).toEqual({
      forme: 'incomplete',
      texte: null,
      manquants: ["n° de l'ordonnance"],
    })
    expect(lireDecisionAffectationAg({ dateAg: '2026-03-12', numeroResolution: ' 8 ' })).toEqual({
      forme: 'complete',
      valeur: { dateAg: '2026-03-12', numeroResolution: '8' },
    })
    expect(lireDecisionAffectationAg('Résolution 12')).toMatchObject({ forme: 'incomplete', texte: 'Résolution 12' })
  })

  it('en-tête : rubrique « Décisions de Hugo du 03/11/2026 » avec J30 ; rubrique du 06/11/2026 : J42 confirme la déclinaison de l’AG', () => {
    const { texte: entete, item } = enTeteDuModule('fonds-travaux')
    const decisions = entete.slice(entete.indexOf('Décisions de Hugo du 03/11/2026'), entete.indexOf('🔵 Déduit du texte'))
    expect(decisions).toMatch(/J30/)
    expect(decisions).toMatch(/juridiction, date et n° de l'ordonnance/)
    expect(decisions).not.toMatch(/à confirmer/)
    expect(entete).not.toMatch(/déclinaison à confirmer/)
    const j42 = item('J42 :')
    expect(j42).toMatch(/date de l'AG \+ n° de la résolution, obligatoires/)
    expect(j42).toMatch(/texte libre est refusé pour toute nouvelle saisie/)
    expect(j42).toMatch(/comportement inchangé/)
    // J42 ne change aucun motif : la décision de l'AG garde « forme attendue », l'ordonnance « forme exigée ».
    expect(j42).toMatch(/mêmes motifs/)
    expect(j42).not.toMatch(/au lieu de « forme attendue »/)
    expect(decisions).toMatch(/forme incomplète/)
    expect(decisions).toMatch(/nouvelle saisie.*texte libre.*refusé/)
    const branchements = item('Branchements à faire (J30)')
    expect(branchements).toMatch(/fonds-travaux-lots\.ts et avis-appel\.ts.*signalent/)
    // Tous deux reçoivent la forme structurée (constat J30 de l'avis d'appel) et la contrôlent sans date du jour.
    expect(branchements).toMatch(/fonds-travaux-lots\.ts et avis-appel\.ts reçoivent la forme structurée.*`aujourdhui: null`/)
    expect(branchements).toMatch(/travaux-operations\.ts.*perd/)
    expect(branchements).not.toMatch(/passent encore la décision et l'ordonnance en texte libre \(signalé/)
  })
})

/**
 * J67, R58 (décision de Hugo du 17/11/2026) : l'art. 29-14, 2° ne fixe aucun montant ; l'ordonnance porte un montant
 * facultatif et son objet ; si un montant est écrit, aucun emploi ne le dépasse (bloquant).
 */
describe('J67, R58 — montant et objet de l’ordonnance de l’art. 29-14, 2°', () => {
  const ORDONNANCE: OrdonnanceJuge = { juridiction: 'TJ', date: '2026-09-02', numero: 'RG 26/01234', montantMaximumCentimes: 1_000_000 }
  const parLeJuge = (autorisationJuge: DecaissementFondsTravaux['autorisationJuge'], options: OptionsControleAffectation = {}, montantCentimes = 1_000_000) =>
    controlerAffectationFondsTravaux(decaissement({ objet: 'redressement_29_14', decisionAg: null, autorisationJuge, montantCentimes }), { aujourdhui: AUJOURDHUI, ...options })

  it('emploi dans le montant de l’ordonnance : admis ; au-delà : refusé, motif et montant à l’appui', () => {
    expect(parLeJuge(ORDONNANCE)).toMatchObject({ autorise: true, cause: 'admis' })
    const auDela = parLeJuge(ORDONNANCE, {}, 1_000_001)
    expect(auDela).toMatchObject({ autorise: false, cause: 'au_dela_de_l_ordonnance', fondement: 'L. 1965 art. 29-14' })
    expect(auDela.motif).toContain(`usage autorisé jusqu'à ${formatEurosCentimes(10_000)}`)
    expect(auDela.motif).toContain('J67, R58')
  })

  it('les emplois déjà faits sous la même ordonnance comptent ; sans montant écrit, rien ne change', () => {
    expect(parLeJuge(ORDONNANCE, { dejaEmployeSousOrdonnanceCentimes: 1 })).toMatchObject({ autorise: false, cause: 'au_dela_de_l_ordonnance' })
    expect(parLeJuge(ORDONNANCE, { dejaEmployeSousOrdonnanceCentimes: 0 }, 999_999)).toMatchObject({ autorise: true })
    expect(parLeJuge({ ...ORDONNANCE, montantMaximumCentimes: null }, { dejaEmployeSousOrdonnanceCentimes: 50_000_000 })).toMatchObject({ autorise: true })
    expect(() => parLeJuge(ORDONNANCE, { dejaEmployeSousOrdonnanceCentimes: -1 })).toThrow(/Montant invalide/)
  })

  it('objet de l’ordonnance connu (redressement, gestion courante, opérations nommées) ; montant ou objet mal saisi : refus', () => {
    for (const objet of ['redressement', 'gestion_courante', 'operations_nommees'] as const) expect(parLeJuge({ ...ORDONNANCE, objet })).toMatchObject({ autorise: true })
    expect(parLeJuge({ ...ORDONNANCE, objet: 'travaux' as never })).toMatchObject({ autorise: false, cause: 'reference_invalide' })
    for (const montantMaximumCentimes of [0, -5, 1.5]) expect(parLeJuge({ ...ORDONNANCE, montantMaximumCentimes })).toMatchObject({ autorise: false, cause: 'reference_invalide' })
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

  it('J67, R86 — avant le 01/01/2017 : aucun fonds de travaux légal', () => {
    const obligation = obligationFondsTravaux(immeuble({ nbLotsPrincipaux: 50, dateReception: '2000-01-01' }), '2016-12-31')
    expect(obligation).toMatchObject({ obligatoire: false, depuis: null, aConfirmer: false, regime: 'aucun_fonds', alertes: [] })
    expect(obligation.motif).toMatch(/aucun fonds de travaux légal/i)
    expect(obligation.fondements).toEqual([FONDEMENT_CREATION])
  })

  it('J67, R86 — avant l’entrée en vigueur applicable : l’ancien art. 14-2 (fonds cinq ans après la réception, sauf dispense)', () => {
    const ancien = obligationFondsTravaux(immeuble({ nbLotsPrincipaux: 50, dateReception: '2000-01-01', dispenseAncien14_2: 'aucune' }), '2023-06-01')
    expect(ancien).toMatchObject({ obligatoire: true, depuis: '2017-01-01', aConfirmer: false, regime: 'ancien_14_2' })
    expect(ancien.fondements).toEqual([ANCIEN_14_2, 'Loi n° 2021-1104 du 22 août 2021, art. 171, VI'])
    expect(ancien.motif).toMatch(/ancien art\. 14-2 \(fonds constitué 5 ans après la réception, cotisation d'au moins 5 % du budget prévisionnel\)/)
    // Dispense non renseignée : obligatoire sauf dispense, à confirmer.
    const sansDispenseConnue = obligationFondsTravaux(immeuble({ nbLotsPrincipaux: 50, dateReception: '2000-01-01' }), '2023-06-01')
    expect(sansDispenseConnue).toMatchObject({ obligatoire: true, depuis: '2017-01-01', aConfirmer: true })
    expect(sansDispenseConnue.motif).toMatch(/sauf dispense.*moins de dix lots.*diagnostic technique global/)
    // Cinq ans après la réception, le jour même ; la veille, pas encore.
    const recent = (date: string) => obligationFondsTravaux(immeuble({ nbLotsPrincipaux: 50, dateReception: '2019-03-01', dispenseAncien14_2: 'aucune' }), date)
    expect(recent('2024-03-01')).toMatchObject({ obligatoire: true, depuis: '2024-03-01', regime: 'ancien_14_2' })
    expect(recent('2024-02-29')).toMatchObject({ obligatoire: false, depuis: '2024-03-01', regime: 'ancien_14_2' })
    // Cinq ans atteints après l'entrée en vigueur : le nouveau régime (dix ans) donne la date.
    expect(obligationFondsTravaux(immeuble({ nbLotsPrincipaux: 50, dateReception: '2021-06-01', dispenseAncien14_2: 'aucune' }), '2024-06-01')).toMatchObject({
      obligatoire: false,
      depuis: '2031-06-01',
    })
  })

  it('J67, R86 — dispense de l’ancien art. 14-2 : aucun fonds avant l’entrée en vigueur, obligation ensuite (J4 : plus de dispense)', () => {
    for (const dispense of ['moins_de_dix_lots_unanimite', 'dtg_sans_besoin_de_travaux'] as const) {
      const petite = (date: string) => obligationFondsTravaux(immeuble({ nbLotsPrincipaux: 8, dateReception: '2000-01-01', dispenseAncien14_2: dispense }), date)
      expect(petite('2024-06-01')).toMatchObject({ obligatoire: false, depuis: '2025-01-01', regime: 'ancien_14_2', alertes: [] })
      expect(petite('2024-06-01').motif).toMatch(/dispense de l'ancien art\. 14-2/)
      expect(petite('2025-01-01')).toMatchObject({ obligatoire: true, depuis: '2025-01-01', regime: 'art_14_2_1' })
    }
  })

  it('J67, R86 — immeuble de cinq à dix ans à l’entrée en vigueur : le fonds existant reste ; cotisation obligatoire à dix ans ; alerte', () => {
    const obligation = obligationFondsTravaux(immeuble({ dateReception: '2017-03-01' }), AUJOURDHUI)
    expect(obligation).toMatchObject({ obligatoire: false, depuis: '2027-03-01', aConfirmer: false, regime: 'art_14_2_1' })
    expect(obligation.motif).not.toMatch(/sort transitoire/)
    expect(obligation.alertes).toMatchObject([{ code: 'immeuble_moins_de_dix_ans', fondement: 'L. 1965 art. 14-2-1, I et III' }])
    expect(obligation.alertes[0].message).toMatch(/reste au syndicat, tel quel.*ne sert qu'aux dépenses de l'art\. 14-2-1, I.*01\/03\/2027/)
    // Immeuble dispensé sous l'ancien régime : aucun fonds constitué, pas d'alerte.
    expect(obligationFondsTravaux(immeuble({ dateReception: '2017-03-01', dispenseAncien14_2: 'dtg_sans_besoin_de_travaux' }), AUJOURDHUI).alertes).toEqual([])
    // Plus de dix ans à l'entrée en vigueur : le fonds de l'ancien régime continue tel quel.
    expect(obligationFondsTravaux(immeuble(), AUJOURDHUI).motif).toMatch(/fonds constitué sous l'ancien art\. 14-2 continue tel quel/)
  })

  it('le jour même où l’obligation naît, elle joue', () => {
    expect(obligationFondsTravaux(immeuble({ dateReception: '2016-10-29' }), AUJOURDHUI)).toMatchObject({
      obligatoire: true,
      depuis: '2026-10-29',
    })
  })

  it('nombre de lots inconnu : obligatoire au plus tard le 01/01/2025 ; avant 2023, l’ancien art. 14-2 ; entre 2023 et 2025, à établir', () => {
    const certain = obligationFondsTravaux(immeuble({ nbLotsPrincipaux: null, dateReception: '2000-01-01' }), AUJOURDHUI)
    expect(certain).toMatchObject({ obligatoire: true, depuis: '2025-01-01', aConfirmer: true })
    expect(certain.motif).toMatch(/au plus tard/)
    // J67, R86 : avant le 01/01/2023, l'ancien art. 14-2 s'applique quel que soit le nombre de lots.
    expect(obligationFondsTravaux(immeuble({ nbLotsPrincipaux: null, dateReception: '2000-01-01' }), '2022-12-31')).toMatchObject({
      obligatoire: true,
      depuis: '2017-01-01',
      aConfirmer: true,
      regime: 'ancien_14_2',
    })
    const selonLesLots = obligationFondsTravaux(immeuble({ nbLotsPrincipaux: null, dateReception: '2000-01-01' }), '2024-06-01')
    expect(selonLesLots).toMatchObject({ obligatoire: null, aConfirmer: true, regime: null })
    expect(selonLesLots.motif).toMatch(/renseigner le nombre de lots/)
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
    expect(cotisationMinimaleFondsTravaux({ budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: null })).toEqual({
      minimumCentimes: 45_350,
      cinqPourcentBudgetCentimes: 45_350,
      deuxEtDemiPourcentPptCentimes: null,
      retenu: 'budget',
      aConfirmer: false,
      fondement: 'L. 1965 art. 14-2-1, I',
    })
  })

  it('plan pluriannuel non renseigné : seul le plancher de 5 % est calculé, à confirmer', () => {
    expect(cotisationMinimaleFondsTravaux({ budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: PPT_INCONNU })).toMatchObject({
      minimumCentimes: 45_350,
      deuxEtDemiPourcentPptCentimes: null,
      aConfirmer: true,
    })
  })

  it('« ne peut être inférieur » : arrondi au centime supérieur', () => {
    expect(cotisationMinimaleFondsTravaux({ budgetPrevisionnelCentimes: 1_001, totalTravauxPlanAdopteCentimes: 1_001 })).toMatchObject({
      cinqPourcentBudgetCentimes: 51,
      deuxEtDemiPourcentPptCentimes: 26,
      minimumCentimes: 51,
    })
  })

  it('avec un plan adopté : les deux planchers jouent, le plus élevé s’impose', () => {
    expect(cotisationMinimaleFondsTravaux({ budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: 3_000_000 })).toMatchObject({
      minimumCentimes: 75_000,
      retenu: 'ppt',
    })
    expect(cotisationMinimaleFondsTravaux({ budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: 1_000_000 })).toMatchObject({
      minimumCentimes: 45_350,
      deuxEtDemiPourcentPptCentimes: 25_000,
      retenu: 'budget',
    })
  })

  it('refuse un budget ou un montant de plan invalide', () => {
    expect(() => cotisationMinimaleFondsTravaux({ budgetPrevisionnelCentimes: -1, totalTravauxPlanAdopteCentimes: null })).toThrow(/centimes/)
    expect(() => cotisationMinimaleFondsTravaux({ budgetPrevisionnelCentimes: 10.5, totalTravauxPlanAdopteCentimes: null })).toThrow(/centimes/)
    expect(() => cotisationMinimaleFondsTravaux({ budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: -5 })).toThrow(/centimes/)
  })
})

describe('J4 — contrôle de la cotisation votée', () => {
  const assiette = { budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: null }

  it('au minimum : rien à signaler', () => {
    expect(controlerCotisationFondsTravaux({ cotisationAnnuelleCentimes: 45_350 }, assiette)).toEqual([])
  })

  it('plan non renseigné : le plancher de 2,5 % et les seuils de suspension restent à vérifier', () => {
    const inconnu = { budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: PPT_INCONNU }
    expect(controlerCotisationFondsTravaux({ cotisationAnnuelleCentimes: 45_350 }, inconnu)).toMatchObject([
      { code: 'plancher_ppt_a_verifier', aConfirmer: true },
    ])
    expect(
      controlerCotisationFondsTravaux(
        { cotisationAnnuelleCentimes: 0, suspension: { origine: 'ag', reference: 'AG du 12/03/2026, résolution 9', debut: '2026-03-12' }, soldeFondsCentimes: 1_000_000 },
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
        { cotisationAnnuelleCentimes: 0, suspension: { origine: 'ag', reference: 'AG du 12/03/2026, résolution 9', debut: '2026-03-12' }, soldeFondsCentimes: 1_000_000 },
        assiette,
      ),
    ).toEqual([])
  })

  it('suspension votée sous les seuils : la cotisation reste due (déduit, à confirmer)', () => {
    const suspension = { origine: 'ag' as const, reference: 'AG du 12/03/2026, résolution 9', debut: '2026-03-12' }
    expect(controlerCotisationFondsTravaux({ cotisationAnnuelleCentimes: 0, suspension, soldeFondsCentimes: BUDGET }, assiette)).toMatchObject([
      { code: 'suspension_hors_seuils', fondement: 'L. 1965 art. 14-2-1, II', aConfirmer: true },
    ])
    // Avec un plan adopté, il faut EN OUTRE dépasser la moitié de ses travaux.
    expect(
      controlerCotisationFondsTravaux(
        { cotisationAnnuelleCentimes: 0, suspension, soldeFondsCentimes: 1_000_000 },
        { budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: 3_000_000 },
      ),
    ).toMatchObject([{ code: 'suspension_hors_seuils' }])
    // Le fonds dépasse la moitié du plan mais pas le budget : les conditions sont cumulatives.
    expect(
      controlerCotisationFondsTravaux(
        { cotisationAnnuelleCentimes: 0, suspension, soldeFondsCentimes: 600_000 },
        { budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: 1_000_000 },
      ),
    ).toMatchObject([{ code: 'suspension_hors_seuils' }])
    expect(controlerCotisationFondsTravaux({ cotisationAnnuelleCentimes: 0, suspension }, assiette)).toMatchObject([
      { code: 'suspension_seuils_a_verifier', aConfirmer: true },
    ])
  })

  it('suspension par le juge (plan de sauvegarde, art. 29-14, 1°) : pas de condition de seuil', () => {
    expect(
      controlerCotisationFondsTravaux(
        { cotisationAnnuelleCentimes: 0, suspension: { origine: 'juge_29_14', reference: 'Ordonnance du 02/09/2026', debut: '2026-09-02' }, soldeFondsCentimes: 0 },
        assiette,
      ),
    ).toEqual([])
  })

  it('refuse une saisie invalide', () => {
    expect(() => controlerCotisationFondsTravaux({ cotisationAnnuelleCentimes: -1 }, assiette)).toThrow(/centimes/)
    expect(() =>
      controlerCotisationFondsTravaux({ cotisationAnnuelleCentimes: 0, suspension: { origine: 'ag', reference: ' ', debut: '2026-03-12' } }, assiette),
    ).toThrow(/suspension/i)
  })
})

describe('J67, R85 — cotisation minimale due sans vote (art. 14-2-1, I, al. 8 et 9)', () => {
  const assiette = { budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: null }

  it('sans montant voté : le minimum s’applique de plein droit ; avec un plan adopté, les deux planchers à la fois', () => {
    const due = cotisationAnnuelleDue(assiette, null)
    expect(due).toMatchObject({ cotisationCentimes: 45_350, origine: 'minimum_de_plein_droit', fondement: 'L. 1965 art. 14-2-1, I' })
    expect(due.motif).toMatch(/de plein droit, sans vote/)
    expect(cotisationAnnuelleDue({ budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: 3_000_000 }, null)).toMatchObject({
      cotisationCentimes: 75_000,
      minimum: { retenu: 'ppt' },
    })
  })

  it('montant voté au moins égal au minimum : le montant voté ; inférieur : le minimum reste dû', () => {
    expect(cotisationAnnuelleDue(assiette, 60_000)).toMatchObject({ cotisationCentimes: 60_000, origine: 'vote' })
    expect(cotisationAnnuelleDue(assiette, 45_350)).toMatchObject({ cotisationCentimes: 45_350, origine: 'vote' })
    const sous = cotisationAnnuelleDue(assiette, 40_000)
    expect(sous).toMatchObject({ cotisationCentimes: 45_350, origine: 'minimum_de_plein_droit' })
    expect(sous.motif).toMatch(/inférieur au minimum/)
    expect(() => cotisationAnnuelleDue(assiette, -1)).toThrow(/centimes/)
  })
})

describe('J67, R85 — suspension des cotisations : période, reprise, seuils du II à chaque exercice', () => {
  const assiette = { budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: null }
  const VOTEE = { origine: 'ag' as const, reference: 'AG du 12/03/2026, résolution 9', debut: '2026-03-12' }
  const ORDONNEE = { origine: 'juge_29_14' as const, reference: 'Ordonnance du 02/09/2026', debut: '2026-09-02' }
  const etat = (surcharge: Partial<Parameters<typeof etatSuspensionCotisationsFondsTravaux>[0]> = {}) =>
    etatSuspensionCotisationsFondsTravaux({ suspension: VOTEE, date: '2026-07-01', soldeFondsCentimes: 1_000_000, assiette, ...surcharge })

  it('votée pour une période : suspendue jusqu’à sa fin incluse ; ensuite, reprise des cotisations avec alerte', () => {
    const periode = { ...VOTEE, fin: '2026-12-31' }
    expect(etat({ suspension: periode })).toMatchObject({ suspendue: true, jusquAu: '2026-12-31', alerte: null, aConfirmer: false, fondement: 'L. 1965 art. 14-2-1, II' })
    expect(etat({ suspension: periode, date: '2026-12-31' }).suspendue).toBe(true)
    const apres = etat({ suspension: periode, date: '2027-01-01' })
    expect(apres).toMatchObject({ suspendue: false, alerte: { code: 'reprise_des_cotisations', fondement: 'L. 1965 art. 14-2-1, II' } })
    expect(apres.alerte?.message).toMatch(/période votée.*31\/12\/2026/)
  })

  it('votée sans période : jusqu’à l’AG annuelle suivante, exclue ; date de cette AG inconnue : suspendue, à confirmer', () => {
    expect(etat({ dateAgAnnuelleSuivante: '2027-03-15' })).toMatchObject({ suspendue: true, jusquAu: '2027-03-14', aConfirmer: false })
    const ag = etat({ dateAgAnnuelleSuivante: '2027-03-15', date: '2027-03-15' })
    expect(ag).toMatchObject({ suspendue: false, alerte: { code: 'reprise_des_cotisations' } })
    expect(ag.alerte?.message).toMatch(/assemblée générale annuelle du 15\/03\/2027/)
    const inconnue = etat()
    expect(inconnue).toMatchObject({ suspendue: true, jusquAu: null, aConfirmer: true })
    expect(inconnue.motif).toMatch(/date de l'assemblée générale annuelle suivante à renseigner/)
  })

  it('seuils du II contrôlés à chaque exercice : une condition n’est plus remplie, les cotisations reprennent (alerte)', () => {
    const sousLeBudget = etat({ soldeFondsCentimes: BUDGET })
    expect(sousLeBudget).toMatchObject({ suspendue: false, alerte: { code: 'reprise_des_cotisations', fondement: 'L. 1965 art. 14-2-1, II' } })
    expect(sousLeBudget.alerte?.message).toMatch(/n'excède plus/)
    // Avec un plan adopté : il faut en outre dépasser la moitié de ses travaux.
    expect(etat({ assiette: { budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: 3_000_000 } }).suspendue).toBe(false)
    expect(etat({ assiette: { budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: 1_000_000 } }).suspendue).toBe(true)
    // Solde ou plan inconnus : suspension gardée, seuils à vérifier.
    expect(etat({ soldeFondsCentimes: null })).toMatchObject({ suspendue: true, aConfirmer: true })
    expect(etat({ assiette: { budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: PPT_INCONNU } })).toMatchObject({ suspendue: true, aConfirmer: true })
  })

  it('ordonnée par le juge (plan de sauvegarde, art. 29-14, 1°) : sans condition de seuil ; sa période, sinon son terme à vérifier', () => {
    expect(etat({ suspension: ORDONNEE, date: '2026-10-01', soldeFondsCentimes: 0 })).toMatchObject({
      suspendue: true,
      jusquAu: null,
      aConfirmer: true,
      fondement: 'L. 1965 art. 29-14, 1°',
    })
    expect(etat({ suspension: { ...ORDONNEE, fin: '2027-09-01' }, date: '2027-09-01', soldeFondsCentimes: 0 })).toMatchObject({ suspendue: true, aConfirmer: false })
    expect(etat({ suspension: { ...ORDONNEE, fin: '2027-09-01' }, date: '2027-09-02', soldeFondsCentimes: 0 })).toMatchObject({
      suspendue: false,
      alerte: { code: 'reprise_des_cotisations', fondement: 'L. 1965 art. 29-14, 1°' },
    })
  })

  it('avant son début : pas encore suspendue, sans alerte ; saisie invalide refusée', () => {
    expect(etat({ date: '2026-03-11' })).toMatchObject({ suspendue: false, alerte: null })
    expect(() => etat({ suspension: { ...VOTEE, debut: '12/03/2026' } })).toThrow(/début.*AAAA-MM-JJ/)
    expect(() => etat({ suspension: { ...VOTEE, fin: '2026-01-01' } })).toThrow(/fin.*antérieure au début/)
    expect(() => etat({ suspension: { ...VOTEE, reference: ' ' } })).toThrow(/référence/)
    expect(() => etat({ dateAgAnnuelleSuivante: '2026-03-01' })).toThrow(/assemblée générale annuelle suivante/)
    expect(() => etat({ date: '01/07/2026' })).toThrow(/AAAA-MM-JJ/)
    expect(() => controlerCotisationFondsTravaux({ cotisationAnnuelleCentimes: 0, suspension: { ...VOTEE, debut: '' } }, assiette)).toThrow(/début/)
  })
})

describe('J4 — l’assemblée doit se prononcer sur la suspension (art. 14-2-1, II)', () => {
  it('sans plan : dès que le fonds excède le budget prévisionnel (strictement)', () => {
    const alerte = questionSuspensionFondsTravaux({ soldeFondsCentimes: BUDGET + 1, budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: null })
    expect(alerte).toMatchObject({ code: 'ag_doit_se_prononcer_suspension', fondement: 'L. 1965 art. 14-2-1, II' })
    expect(alerte?.message).toMatch(/se prononcer/)
    expect(alerte?.message).toMatch(/pas automatique/)
    expect(questionSuspensionFondsTravaux({ soldeFondsCentimes: BUDGET, budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: null })).toBeNull()
  })

  it('avec un plan adopté : il faut en outre dépasser la moitié de ses travaux', () => {
    const assiette = { budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: 3_000_000 }
    expect(questionSuspensionFondsTravaux({ ...assiette, soldeFondsCentimes: 1_500_000 })).toBeNull()
    expect(questionSuspensionFondsTravaux({ ...assiette, soldeFondsCentimes: 1_500_001 })?.code).toBe('ag_doit_se_prononcer_suspension')
    // Conditions cumulatives : plus de la moitié du plan ne suffit pas sans dépasser le budget.
    expect(
      questionSuspensionFondsTravaux({ budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: 1_000_000, soldeFondsCentimes: 600_000 }),
    ).toBeNull()
  })

  it('plan non renseigné : alerte dès le budget dépassé, marquée à confirmer', () => {
    const alerte = questionSuspensionFondsTravaux({
      budgetPrevisionnelCentimes: BUDGET,
      totalTravauxPlanAdopteCentimes: PPT_INCONNU,
      soldeFondsCentimes: BUDGET + 1,
    })
    expect(alerte).toMatchObject({ code: 'ag_doit_se_prononcer_suspension', aConfirmer: true })
    expect(alerte?.message).toMatch(/plan non renseigné/)
  })

  it('refuse un solde invalide', () => {
    expect(() => questionSuspensionFondsTravaux({ soldeFondsCentimes: 1.5, budgetPrevisionnelCentimes: BUDGET, totalTravauxPlanAdopteCentimes: null })).toThrow(/centimes/)
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

describe('J67, R84 à R86 — en-tête : décisions inscrites, questions fermées', () => {
  const { texte: entete } = enTeteDuModule('fonds-travaux')
  const decisions = entete.slice(entete.indexOf('Décisions de Hugo du 17/11/2026'), entete.indexOf('🔵 Déduit du texte'))
  const nonEtabli = entete.slice(entete.indexOf('🔴 Non établi'))

  it('R84 : assiette des 2,5 % = montant total des travaux de la partie du plan adoptée, toutes années ; entrée renommée', () => {
    expect(decisions).toMatch(/J67, R84 : .*montant total des travaux de la partie du plan adoptée.*toutes années confondues.*totalTravauxPlanAdopteCentimes/)
    expect(nonEtabli).not.toMatch(/assiette des 2,5 %/)
  })

  it('R85 : minimum sans vote ; suspension votée (art. 24) ou ordonnée (art. 29-14, 1°), période, reprise', () => {
    expect(decisions).toMatch(/J67, R85 : .*de plein droit.*art\. 24.*29-14, 1°.*reprise des cotisations/)
    expect(nonEtabli).not.toMatch(/durée et reprise d'une suspension/)
  })

  it('R86 : ancien art. 14-2 modélisé avant l’entrée en vigueur ; fonds continu ; alerte immeuble de moins de dix ans', () => {
    expect(decisions).toMatch(/J67, R86 : .*ancien art\. 14-2.*continue tel quel.*immeuble_moins_de_dix_ans/)
    expect(nonEtabli).not.toMatch(/régime antérieur/)
  })
})
