import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  NATURES_SOMME_EXIGIBLE,
  PARAMETRES_ALERTE_29_1_A,
  alerteMandataireAdHoc,
  type EntreeAlerteMandataireAdHoc,
  type ExerciceAlerte,
  type SommeExigible,
} from '@/lib/administrateur-judiciaire/domain/alerte-mandataire-ad-hoc'
import { creerDecisionAnnuelle } from '@/lib/administrateur-judiciaire/domain/decisions-annuelles-ag'
import { creerExercice, type SaisieExercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'

/**
 * Alerte de l'art. 29-1 A de la loi du 10 juillet 1965 (décision J7 du 30/10/2026). Textes relus sur Légifrance le
 * 30/10/2026 :
 * - L. 1965 art. 29-1 A (version du 11/04/2024), al. 1 : « Lorsqu'à la clôture des comptes les impayés atteignent 25 % des
 *   sommes exigibles en vertu des articles 14-1 et 14-2-1 ou en l'absence de vote de l'assemblée générale sur
 *   l'approbation des comptes depuis au moins deux ans », le syndic informe le conseil syndical et saisit le juge d'une
 *   demande de mandataire ad hoc ; 15 % au-delà de deux cents lots ; al. 2 : saisine ouverte à d'autres en l'absence
 *   d'action du syndic dans le mois de la clôture, en l'absence de syndic ou faute de vote depuis deux ans ;
 * - D. 1967 art. 61-2 : les sommes devenues exigibles dans le mois précédant la clôture ne sont pas impayées ; art. 61-4 :
 *   état des impayés avant répartition à la date de la clôture adressé sans délai à chaque membre du conseil syndical ;
 * - L. 1965 art. 29-1, I, al. 2 et II, al. 2 : l'administrateur provisoire reçoit tous les pouvoirs du syndic ; frais de
 *   l'administration provisoire imputables au syndic qui n'a pas saisi le juge dans les conditions de l'art. 29-1 A.
 */

const exercice = (nom: string, surcharge: Partial<SaisieExercice> = {}) =>
  creerExercice({
    coproprieteId: 'copro-1',
    nom,
    ouverture: `${nom}-01-01`,
    cloture: `${nom}-12-31`,
    statut: 'Voté',
    statutIrc: 'Non déclaré',
    agId: null,
    resolutions: { budget: null, complement: null, honoraires: null, travaux: null },
    ...surcharge,
  })

const somme = (exigibleLe: string, montantCentimes: number, impayeCentimes: number, nature: SommeExigible['nature'] = 'provision_budget') => ({
  nature,
  exigibleLe,
  montantCentimes,
  impayeCentimes,
})

/** Quatre provisions trimestrielles de 10 000 € (exercice 2025) ; impayés répartis pour faire `total`. */
const provisions2025 = (total: number): SommeExigible[] => [
  somme('2025-01-01', 1_000_000, Math.min(total, 250_000)),
  somme('2025-04-01', 1_000_000, Math.min(Math.max(total - 250_000, 0), 250_000)),
  somme('2025-07-01', 1_000_000, Math.min(Math.max(total - 500_000, 0), 250_000)),
  somme('2025-10-01', 1_000_000, Math.max(total - 750_000, 0)),
]

const E2024 = exercice('2024')
const E2025 = exercice('2025')

const ex = (id: string, exo = E2025, sommes: SommeExigible[] | null = provisions2025(0)): ExerciceAlerte => ({ id, exercice: exo, sommes })

const entree = (surcharge: Partial<EntreeAlerteMandataireAdHoc> = {}): EntreeAlerteMandataireAdHoc => ({
  coproprieteId: 'copro-1',
  nombreLots: 40,
  exercices: [ex('ex-2025')],
  votes: [{ date: '2025-06-12', etat: 'adoptee' }],
  ...surcharge,
})

const DATE = '2026-03-01'

describe('paramètres', () => {
  it('seuils et durées du texte, en paramètres', () => {
    expect(PARAMETRES_ALERTE_29_1_A).toEqual({
      seuilPourcent: 25,
      seuilGrandeCoproprietePourcent: 15,
      lotsGrandeCopropriete: 200,
      sansVoteMois: 24,
      delaiSyndicMois: 1,
      moisNonImpayesAvantCloture: 1,
    })
    expect(NATURES_SOMME_EXIGIBLE).toEqual(['provision_budget', 'travaux_hors_budget', 'cotisation_fonds_travaux', 'autre'])
  })

  it('un paramètre modifié change le calcul ; un paramètre invalide est refusé', () => {
    const a = alerteMandataireAdHoc(entree(), DATE, { ...PARAMETRES_ALERTE_29_1_A, sansVoteMois: 6 })
    expect(a.comptes).toMatchObject({ etat: 'atteint', atteintLe: '2025-12-12' })
    expect(() => alerteMandataireAdHoc(entree(), DATE, { ...PARAMETRES_ALERTE_29_1_A, sansVoteMois: 1.5 })).toThrow(/sansVoteMois/)
    expect(() => alerteMandataireAdHoc(entree(), DATE, { ...PARAMETRES_ALERTE_29_1_A, seuilPourcent: 0 })).toThrow(/seuilPourcent/)
    expect(() => alerteMandataireAdHoc(entree(), DATE, { ...PARAMETRES_ALERTE_29_1_A, seuilPourcent: 101 })).toThrow(/seuilPourcent/)
  })
})

describe('critère des impayés à la clôture (art. 29-1 A, al. 1 ; D. 1967 art. 61-2)', () => {
  it('« atteignent 25 % » : égal ou supérieur, calcul en centimes sans arrondi', () => {
    const atteint = alerteMandataireAdHoc(entree({ exercices: [ex('ex-2025', E2025, provisions2025(1_000_000))] }), DATE)
    expect(atteint.impayes).toMatchObject({
      etat: 'atteint',
      exerciceId: 'ex-2025',
      cloture: '2025-12-31',
      seuilPourcent: 25,
      exigiblesCentimes: 4_000_000,
      impayesCentimes: 1_000_000,
      ecartesCentimes: 0,
      arrieresCentimes: 0,
    })
    expect(atteint.impayes.message).toMatch(/clôture du 31\/12\/2025.*25 % \(seuil 25 %\)/)
    const juste = alerteMandataireAdHoc(entree({ exercices: [ex('ex-2025', E2025, provisions2025(999_999))] }), DATE)
    expect(juste.impayes.etat).toBe('non_atteint')
    expect(juste.impayes.message).toMatch(/24 % \(seuil 25 %\)/)
  })

  it('plus de deux cents lots : 15 % ; deux cents lots exactement : 25 %', () => {
    const sommes = provisions2025(600_000)
    expect(alerteMandataireAdHoc(entree({ nombreLots: 201, exercices: [ex('ex-2025', E2025, sommes)] }), DATE).impayes).toMatchObject({
      etat: 'atteint',
      seuilPourcent: 15,
    })
    expect(alerteMandataireAdHoc(entree({ nombreLots: 200, exercices: [ex('ex-2025', E2025, sommes)] }), DATE).impayes).toMatchObject({
      etat: 'non_atteint',
      seuilPourcent: 25,
    })
  })

  it('sommes devenues exigibles dans le mois précédant la clôture : exigibles, mais pas impayées (D. 1967 art. 61-2)', () => {
    const sommes = [
      ...provisions2025(1_000_000),
      somme('2025-11-30', 100_000, 100_000),
      somme('2025-12-01', 200_000, 200_000),
      somme('2025-12-31', 300_000, 300_000, 'cotisation_fonds_travaux'),
    ]
    const a = alerteMandataireAdHoc(entree({ exercices: [ex('ex-2025', E2025, sommes)] }), DATE)
    expect(a.impayes).toMatchObject({ exigiblesCentimes: 4_600_000, impayesCentimes: 1_100_000, ecartesCentimes: 500_000, etat: 'non_atteint' })
    expect(a.impayes.message).toMatch(/hors .* devenus exigibles dans le mois précédant la clôture/)
  })

  it('sommes des art. 14-1 (I : provisions ; II : travaux hors budget) et 14-2-1 ; une autre somme, ou exigible après la clôture, ne compte pas', () => {
    const sommes = [
      ...provisions2025(900_000),
      somme('2025-10-01', 400_000, 100_000, 'cotisation_fonds_travaux'),
      somme('2025-09-15', 5_000_000, 5_000_000, 'travaux_hors_budget'),
      somme('2025-06-01', 300_000, 300_000, 'autre'),
      somme('2026-01-01', 1_000_000, 1_000_000),
    ]
    const a = alerteMandataireAdHoc(entree({ exercices: [ex('ex-2025', E2025, sommes)] }), DATE)
    expect(a.impayes).toMatchObject({ exigiblesCentimes: 9_400_000, impayesCentimes: 6_000_000, etat: 'atteint' })
    expect(a.impayes.message).toMatch(/63 % \(seuil 25 %\)/)
    expect(a.declenchee).toBe(true)
  })

  it('appels de travaux hors budget seuls (L. 1965 art. 14-1, II) : critère établi ; une autre somme seule : non établi', () => {
    const travaux = [somme('2025-03-01', 5_000_000, 2_000_000, 'travaux_hors_budget')]
    const a = alerteMandataireAdHoc(entree({ exercices: [ex('ex-2025', E2025, travaux)] }), DATE)
    expect(a.impayes).toMatchObject({ etat: 'atteint', exigiblesCentimes: 5_000_000, impayesCentimes: 2_000_000 })
    expect(a.impayes.message).toMatch(/40 % \(seuil 25 %\)/)
    const autre = [somme('2025-03-01', 5_000_000, 2_000_000, 'autre')]
    expect(alerteMandataireAdHoc(entree({ exercices: [ex('ex-2025', E2025, autre)] }), DATE).impayes.etat).toBe('non_etabli')
  })

  it('J67, R31 — arriérés des exercices antérieurs : comptés dans les impayés, hors des sommes exigibles de l’exercice ; plus « à confirmer », montant gardé dans le message', () => {
    const sommes = [...provisions2025(600_000), somme('2024-10-01', 1_000_000, 400_000)]
    const a = alerteMandataireAdHoc(entree({ exercices: [ex('ex-2025', E2025, sommes)] }), DATE)
    expect(a.impayes).toMatchObject({ exigiblesCentimes: 4_000_000, impayesCentimes: 1_000_000, arrieresCentimes: 400_000, etat: 'atteint' })
    expect(a.impayes.message).toMatch(/dont 4\s000,00\s€ d'arriérés des exercices antérieurs/)
    expect(a.impayes.message).not.toMatch(/à confirmer/)
    expect(a.aConfirmer).toBe(false)
    expect(alerteMandataireAdHoc(entree({ exercices: [ex('ex-2025', E2025, provisions2025(1_000_000))] }), DATE).aConfirmer).toBe(false)
    // Le mandat de justice sans texte reste à confirmer, arriérés ou non.
    expect(alerteMandataireAdHoc(entree({ regime: 'ap291', exercices: [ex('ex-2025', E2025, sommes)] }), DATE).aConfirmer).toBe(true)
  })

  it('dernier exercice clos avant la date : chaque clôture renouvelle le constat ; le jour de la clôture, l’exercice n’est pas clos', () => {
    const exercices = [ex('ex-2024', E2024, [somme('2024-01-01', 1_000_000, 900_000)]), ex('ex-2025', E2025, provisions2025(100_000))]
    expect(alerteMandataireAdHoc(entree({ exercices }), DATE).impayes).toMatchObject({ exerciceId: 'ex-2025', etat: 'non_atteint' })
    expect(alerteMandataireAdHoc(entree({ exercices }), '2025-12-31').impayes).toMatchObject({ exerciceId: 'ex-2024', etat: 'atteint' })
  })

  it('non établi : aucun exercice clos, sommes non saisies, ou aucune somme exigible au cours de l’exercice', () => {
    expect(alerteMandataireAdHoc(entree({ exercices: [] }), DATE).impayes).toMatchObject({ etat: 'non_etabli', exerciceId: null })
    expect(alerteMandataireAdHoc(entree({ exercices: [ex('ex-2025', E2025, null)] }), DATE).impayes).toMatchObject({
      etat: 'non_etabli',
      exerciceId: 'ex-2025',
    })
    const vide = alerteMandataireAdHoc(entree({ exercices: [ex('ex-2025', E2025, [somme('2024-04-01', 100_000, 100_000)])] }), DATE)
    expect(vide.impayes.etat).toBe('non_etabli')
    expect(vide.impayes.message).toMatch(/aucune somme exigible/)
  })
})

describe('critère des comptes : absence de vote sur leur approbation depuis au moins deux ans', () => {
  it('atteint au même quantième deux ans après le dernier vote', () => {
    const e = entree({ votes: [{ date: '2024-06-15', etat: 'adoptee' }] })
    expect(alerteMandataireAdHoc(e, '2026-06-14').comptes).toMatchObject({ etat: 'non_atteint', dernierVoteLe: '2024-06-15', atteintLe: '2026-06-15' })
    expect(alerteMandataireAdHoc(e, '2026-06-15').comptes).toMatchObject({ etat: 'atteint', atteintLe: '2026-06-15' })
    expect(alerteMandataireAdHoc(entree({ votes: [{ date: '2024-02-29', etat: 'rejetee' }] }), DATE).comptes.atteintLe).toBe('2026-02-28')
  })

  it('un vote de rejet est un vote ; à voter, second vote à tenir ou reportée : non', () => {
    const votes = [
      { date: '2023-06-10', etat: 'adoptee' },
      { date: '2024-06-10', etat: 'rejetee' },
      { date: '2025-06-10', etat: 'reportee' },
      { date: '2025-07-10', etat: 'second_vote' },
      { date: '2025-08-10', etat: 'a_voter' },
    ] as const
    expect(alerteMandataireAdHoc(entree({ votes }), '2026-07-01').comptes).toMatchObject({ etat: 'atteint', dernierVoteLe: '2024-06-10' })
  })

  it('décision d’approbation adoptée par l’assemblée : un vote ; décision de l’administrateur provisoire : pas un vote de l’assemblée', () => {
    const base = { coproprieteId: 'copro-1', type: 'approbation_comptes', exerciceId: 'ex-2024' } as const
    const parAg = creerDecisionAnnuelle({ ...base, id: 'd1', date: '2025-05-20', source: { origine: 'assemblee', agId: 'ag', resolutionId: 'r' } })
    const parAp = creerDecisionAnnuelle({ ...base, id: 'd2', date: '2025-09-01', source: { origine: 'administrateur', reference: 'reg-12' } })
    const budget = creerDecisionAnnuelle({ ...base, id: 'd3', type: 'budget', date: '2025-10-01', montantCentimes: 100, source: parAg.source })
    expect(alerteMandataireAdHoc(entree({ votes: [], decisions: [parAg, parAp, budget] }), DATE).comptes).toMatchObject({
      dernierVoteLe: '2025-05-20',
      atteintLe: '2027-05-20',
    })
  })

  it('un vote postérieur à la date de référence est ignoré ; aucun vote connu : non établi', () => {
    const votes = [
      { date: '2023-06-10', etat: 'adoptee' },
      { date: '2026-06-10', etat: 'adoptee' },
    ] as const
    expect(alerteMandataireAdHoc(entree({ votes }), '2025-07-01').comptes).toMatchObject({ etat: 'atteint', dernierVoteLe: '2023-06-10' })
    const inconnu = alerteMandataireAdHoc(entree({ votes: [] }), DATE).comptes
    expect(inconnu).toMatchObject({ etat: 'non_etabli', dernierVoteLe: null, atteintLe: null })
    expect(inconnu.message).toMatch(/saisir la date de la dernière assemblée/)
  })
})

describe('décision du 20/11/2026 (partie C, F35) : aucun vote connu sur l’approbation des comptes', () => {
  const TACHE =
    "saisir la date de la dernière assemblée qui s'est prononcée sur les comptes (procès-verbaux à obtenir de l'ancien syndic, qui doit remettre les archives : L. 1965 art. 18-2 ; D. 1967 art. 62-6)."

  it('on ne sait rien : « non établi » gardé, avec la tâche de saisie', () => {
    const { comptes, declenchee, aConfirmer } = alerteMandataireAdHoc(entree({ votes: [] }), DATE)
    expect(comptes).toMatchObject({ etat: 'non_etabli', dernierVoteLe: null, atteintLe: null, pointDeDepart: null, aConfirmer: false, tacheDernierVote: TACHE })
    expect(comptes.message).toBe(
      "Aucun vote de l'assemblée sur l'approbation des comptes n'est connu : saisir la date de la dernière assemblée qui s'est prononcée (adoption ou rejet).",
    )
    expect({ declenchee, aConfirmer }).toEqual({ declenchee: false, aConfirmer: false })
  })

  it('mission commencée depuis moins de deux ans : « non établi », tâche de saisie, date où le critère sera atteint, à confirmer', () => {
    const { comptes, declenchee } = alerteMandataireAdHoc(entree({ votes: [], debutMissionLe: '2024-06-15' }), '2026-06-14')
    expect(comptes).toMatchObject({ etat: 'non_etabli', atteintLe: null, pointDeDepart: null, aConfirmer: false, tacheDernierVote: TACHE })
    expect(comptes.message).toBe(
      "Aucun vote de l'assemblée sur l'approbation des comptes n'est connu : saisir la date de la dernière assemblée qui s'est prononcée (adoption ou rejet). Faute de vote enregistré depuis le début de la mission le 15/06/2024, 24 mois sans vote seront atteints, à confirmer, le 15/06/2026.",
    )
    expect(declenchee).toBe(false)
  })

  it('cabinet en mission depuis au moins deux ans sans vote enregistré : « atteint, à confirmer », depuis le début de la mission', () => {
    const e = entree({ votes: [], exercices: [ex('ex-2025', E2025, provisions2025(0))], debutMissionLe: '2024-06-15' })
    const alerte = alerteMandataireAdHoc(e, '2026-06-15')
    expect(alerte.comptes).toMatchObject({
      etat: 'atteint',
      dernierVoteLe: null,
      atteintLe: '2026-06-15',
      pointDeDepart: 'debut_mission',
      aConfirmer: true,
      tacheDernierVote: TACHE,
      traite: false,
    })
    expect(alerte.comptes.message).toBe(
      "Aucun vote de l'assemblée sur l'approbation des comptes enregistré depuis le début de la mission le 15/06/2024 : 24 mois sans vote atteints le 15/06/2026, à confirmer (date de la dernière assemblée qui s'est prononcée sur les comptes à saisir).",
    )
    expect(alerte).toMatchObject({
      declenchee: true,
      declencheeLe: '2026-06-15',
      aTraiterLe: '2026-06-15',
      saisineParDautresLe: '2026-06-15',
      aConfirmer: true,
      message: alerte.comptes.message,
    })
    const couverte = alerteMandataireAdHoc({ ...e, saisineLe: '2026-06-20' }, '2026-07-01')
    expect(couverte).toMatchObject({ saisineFaite: true, aTraiterLe: null, comptes: expect.objectContaining({ traite: true }) })
  })

  it('un vote connu, même antérieur à la mission : la règle du dernier vote s’applique, sans tâche ni réserve', () => {
    const { comptes, aConfirmer } = alerteMandataireAdHoc(entree({ votes: [{ date: '2023-06-10', etat: 'adoptee' }], debutMissionLe: '2025-01-01' }), DATE)
    expect(comptes).toMatchObject({ etat: 'atteint', dernierVoteLe: '2023-06-10', atteintLe: '2025-06-10', pointDeDepart: 'dernier_vote', aConfirmer: false, tacheDernierVote: null })
    expect(aConfirmer).toBe(false)
    const recent = alerteMandataireAdHoc(entree({ debutMissionLe: '2020-01-01' }), DATE).comptes
    expect(recent).toMatchObject({ etat: 'non_atteint', pointDeDepart: 'dernier_vote', aConfirmer: false, tacheDernierVote: null })
  })

  it('administrateur provisoire de l’art. 29-1 : l’approbation par l’administrateur est dite, le critère reste sur les votes de l’assemblée (J67, R30)', () => {
    const decisionAp = creerDecisionAnnuelle({
      id: 'd-ap',
      coproprieteId: 'copro-1',
      type: 'approbation_comptes',
      exerciceId: 'ex-2024',
      date: '2025-09-01',
      source: { origine: 'administrateur', reference: 'reg-12' },
    })
    const { comptes } = alerteMandataireAdHoc(entree({ regime: 'ap291', votes: [], decisions: [decisionAp], debutMissionLe: '2024-01-10' }), DATE)
    expect(comptes).toMatchObject({ etat: 'atteint', atteintLe: '2026-01-10', pointDeDepart: 'debut_mission', aConfirmer: true, approuvesParAdministrateurLe: '2025-09-01' })
    expect(comptes.message).toBe(
      "Comptes approuvés par l'administrateur provisoire le 01/09/2025 (décision de l'administrateur, pas un vote de l'assemblée) ; aucun vote de l'assemblée sur l'approbation des comptes enregistré depuis le début de la mission le 10/01/2024, à confirmer (date de la dernière assemblée qui s'est prononcée sur les comptes à saisir).",
    )
  })

  it('impayés atteints aussi : l’alerte reste ferme, seul le critère des comptes est « atteint, à confirmer »', () => {
    const e = entree({ votes: [], exercices: [ex('ex-2025', E2025, provisions2025(1_000_000))], debutMissionLe: '2024-01-15' })
    const alerte = alerteMandataireAdHoc(e, DATE)
    expect(alerte.impayes.etat).toBe('atteint')
    expect(alerte.comptes).toMatchObject({ etat: 'atteint', pointDeDepart: 'debut_mission', aConfirmer: true })
    expect(alerte).toMatchObject({ declenchee: true, aConfirmer: false })
    // La réserve du cadre de l'administrateur provisoire (J67, R30) reste.
    expect(alerteMandataireAdHoc({ ...e, regime: 'ap47' }, DATE).aConfirmer).toBe(true)
  })

  it('refuse une date de début de mission invalide', () => {
    expect(() => alerteMandataireAdHoc(entree({ debutMissionLe: '2024-02-30' }), DATE)).toThrow(/début de la mission.*AAAA-MM-JJ/)
  })

  it('début de la mission d’une année improbable (9999, 2525, 0026) : « non établi », la date fautive est citée, ni alerte ni erreur interne', () => {
    // Depuis 9999, deux ans tombaient en l'an 10001 (« Date ISO invalide ») ; depuis 0026, l'alerte se déclenchait.
    for (const [debutMissionLe, citee] of [
      ['9999-06-15', '15/06/9999'],
      ['2525-06-15', '15/06/2525'],
      ['0026-06-15', '15/06/0026'],
    ] as const) {
      const { comptes, declenchee, aConfirmer } = alerteMandataireAdHoc(entree({ votes: [], debutMissionLe }), DATE)
      expect(comptes, debutMissionLe).toMatchObject({
        etat: 'non_etabli',
        dernierVoteLe: null,
        atteintLe: null,
        pointDeDepart: null,
        aConfirmer: false,
        tacheDernierVote: TACHE,
      })
      expect(comptes.message).toBe(
        `Aucun vote de l'assemblée sur l'approbation des comptes n'est connu : saisir la date de la dernière assemblée qui s'est prononcée (adoption ou rejet). Début de la mission daté du ${citee} : année improbable (faute de frappe ?). Pas de repère : corriger la date.`,
      )
      expect({ declenchee, aConfirmer }).toEqual({ declenchee: false, aConfirmer: false })
    }
    // Un vote connu garde la règle du dernier vote, quel que soit le début de la mission.
    const avecVote = alerteMandataireAdHoc(entree({ votes: [{ date: '2023-06-10', etat: 'adoptee' }], debutMissionLe: '0026-06-15' }), DATE)
    expect(avecVote.comptes).toMatchObject({ etat: 'atteint', dernierVoteLe: '2023-06-10', pointDeDepart: 'dernier_vote' })
    // Bornes : 1900 et 2100 restent plausibles.
    expect(alerteMandataireAdHoc(entree({ votes: [], debutMissionLe: '1900-01-01' }), DATE).comptes).toMatchObject({
      etat: 'atteint',
      atteintLe: '1902-01-01',
      pointDeDepart: 'debut_mission',
    })
    expect(alerteMandataireAdHoc(entree({ votes: [], debutMissionLe: '2100-01-01' }), DATE).comptes.message).toMatch(
      /seront atteints, à confirmer, le 01\/01\/2102\.$/,
    )
  })
})

describe('alerte', () => {
  it('déclenchée par les impayés : à la clôture ; saisine par d’autres au lendemain du délai d’un mois laissé au syndic', () => {
    const a = alerteMandataireAdHoc(entree({ exercices: [ex('ex-2025', E2025, provisions2025(1_000_000))] }), DATE)
    expect(a).toMatchObject({
      coproprieteId: 'copro-1',
      date: DATE,
      declenchee: true,
      declencheeLe: '2025-12-31',
      saisineFaite: false,
      saisineParDautresLe: '2026-02-01',
      aConfirmer: false,
    })
    expect(a.message).toBe(a.impayes.message)
    expect(a.conduite).toMatch(/informer le conseil syndical.*état des impayés avant répartition.*mandataire ad hoc/)
    expect(a.fondement).toBe('L. 1965 art. 29-1 A, al. 1 et dernier alinéa ; D. 1967 art. 61-2 à 61-5')
  })

  it('conduite du syndic : copie de la requête au représentant de l’État, au maire et au président de l’EPCI (art. 29-1 A, dernier alinéa ; D. 1967 art. 61-5)', () => {
    for (const regime of [null, 'sj'] as const) {
      const a = alerteMandataireAdHoc(entree({ regime, exercices: [ex('ex-2025', E2025, provisions2025(1_000_000))] }), DATE)
      expect(a.conduite).toContain(
        "adresser une copie de la requête au représentant de l'État dans le département, au maire de la commune où est implanté l'immeuble et au président de l'EPCI compétent en matière d'habitat",
      )
      expect(a.fondement).toMatch(/L\. 1965 art\. 29-1 A, al\. 1 et dernier alinéa ; D\. 1967 art\. 61-2 à 61-5/)
    }
  })

  it('déclenchée par les seuls comptes : l’état des impayés avant répartition accompagne aussi l’information du conseil syndical (D. 1967 art. 61-4)', () => {
    const a = alerteMandataireAdHoc(entree({ votes: [{ date: '2023-06-10', etat: 'adoptee' }] }), DATE)
    expect(a.declenchee).toBe(true)
    expect(a.impayes.etat).toBe('non_atteint')
    expect(a.conduite).toContain(
      "informer le conseil syndical en adressant sans délai à chacun de ses membres l'état des impayés avant répartition à la date de la clôture de l'exercice comptable",
    )
    expect(a.conduite).not.toMatch(/pour les impayés/)
  })

  it('déclenchée par les comptes : saisine par d’autres dès les deux ans ; deux critères : le plus tôt', () => {
    const comptes = alerteMandataireAdHoc(entree({ votes: [{ date: '2023-06-10', etat: 'adoptee' }] }), DATE)
    expect(comptes).toMatchObject({ declenchee: true, declencheeLe: '2025-06-10', saisineParDautresLe: '2025-06-10' })
    expect(comptes.message).toBe(comptes.comptes.message)
    const deux = alerteMandataireAdHoc(
      entree({ votes: [{ date: '2023-06-10', etat: 'adoptee' }], exercices: [ex('ex-2025', E2025, provisions2025(1_000_000))] }),
      DATE,
    )
    expect(deux).toMatchObject({ declencheeLe: '2025-06-10', saisineParDautresLe: '2025-06-10' })
    expect(deux.message).toBe(`${deux.impayes.message} ${deux.comptes.message}`)
  })

  it('non déclenchée : rien à saisir', () => {
    expect(alerteMandataireAdHoc(entree(), DATE)).toMatchObject({
      declenchee: false,
      declencheeLe: null,
      saisineFaite: false,
      saisineParDautresLe: null,
      message: '',
    })
  })

  it('requête au juge enregistrée à la date du déclenchement ou après : alerte traitée', () => {
    const e = (saisineLe: string | null) => entree({ saisineLe, exercices: [ex('ex-2025', E2025, provisions2025(1_000_000))] })
    expect(alerteMandataireAdHoc(e('2025-12-31'), DATE).saisineFaite).toBe(true)
    expect(alerteMandataireAdHoc(e('2026-01-20'), DATE).saisineFaite).toBe(true)
    expect(alerteMandataireAdHoc(e('2025-11-02'), DATE).saisineFaite).toBe(false)
    expect(alerteMandataireAdHoc(e('2026-04-01'), DATE).saisineFaite).toBe(false)
    expect(alerteMandataireAdHoc(e(null), DATE).saisineFaite).toBe(false)
  })

  describe('requête critère par critère : une requête ancienne ne couvre pas un déclenchement postérieur', () => {
    const E2027 = exercice('2027')
    /** Quatre provisions trimestrielles de 10 000 € en 2027, dont 20 000 € impayés (50 %). */
    const provisions2027: SommeExigible[] = [
      somme('2027-01-01', 1_000_000, 1_000_000),
      somme('2027-04-01', 1_000_000, 1_000_000),
      somme('2027-07-01', 1_000_000, 0),
      somme('2027-10-01', 1_000_000, 0),
    ]
    const e = (saisineLe: string | null, votes: EntreeAlerteMandataireAdHoc['votes'] = [{ date: '2023-06-15', etat: 'adoptee' }]) =>
      entree({ votes, exercices: [ex('ex-2027', E2027, provisions2027)], saisineLe })

    it('requête faite pour les comptes en 2025, impayés à la clôture 2027 : ce déclenchement reste à traiter', () => {
      const a = alerteMandataireAdHoc(e('2025-07-01'), '2028-02-15')
      expect(a.comptes).toMatchObject({ etat: 'atteint', atteintLe: '2025-06-15', traite: true })
      expect(a.impayes).toMatchObject({ etat: 'atteint', cloture: '2027-12-31', traite: false })
      expect(a).toMatchObject({ declenchee: true, declencheeLe: '2025-06-15', saisineFaite: false, aTraiterLe: '2027-12-31' })
    })

    it('requête postérieure aux deux déclenchements : alerte traitée, rien à traiter', () => {
      const a = alerteMandataireAdHoc(e('2028-01-10'), '2028-02-15')
      expect([a.impayes.traite, a.comptes.traite]).toEqual([true, true])
      expect(a).toMatchObject({ saisineFaite: true, aTraiterLe: null })
    })

    it('sans critère des comptes atteint, la même requête ne traite pas les impayés de la clôture suivante', () => {
      const a = alerteMandataireAdHoc(e('2025-07-01', [{ date: '2027-06-15', etat: 'adoptee' }]), '2028-02-15')
      expect(a.comptes).toMatchObject({ etat: 'non_atteint', traite: false })
      expect(a).toMatchObject({ saisineFaite: false, aTraiterLe: '2027-12-31' })
    })

    it('sans requête : rien n’est traité, le plus tôt des critères atteints est à traiter', () => {
      const a = alerteMandataireAdHoc(e(null), '2028-02-15')
      expect([a.impayes.traite, a.comptes.traite]).toEqual([false, false])
      expect(a).toMatchObject({ saisineFaite: false, aTraiterLe: '2025-06-15' })
    })
  })

  describe('saisine par les personnes de l’al. 2', () => {
    const e = (saisineLe: string | null, regime: EntreeAlerteMandataireAdHoc['regime'] = null) =>
      entree({ saisineLe, regime, exercices: [ex('ex-2025', E2025, provisions2025(1_000_000))] })

    it('au titre des impayés : fermée si le syndic a saisi le juge dans le mois de la clôture (« En l’absence d’action du syndic dans un délai d’un mois »)', () => {
      for (const saisineLe of ['2025-12-31', '2026-01-20', '2026-01-31'])
        expect(alerteMandataireAdHoc(e(saisineLe), DATE)).toMatchObject({ saisineFaite: true, saisineParDautresLe: null })
      expect(alerteMandataireAdHoc(e('2026-01-20', 'sj'), DATE).saisineParDautresLe).toBeNull()
    })

    it('au titre des impayés : ouverte au lendemain du mois si le syndic n’a pas agi dans ce mois, ou si sa requête n’est pas connue à la date', () => {
      expect(alerteMandataireAdHoc(e('2026-02-15'), DATE)).toMatchObject({ saisineFaite: true, saisineParDautresLe: '2026-02-01' })
      expect(alerteMandataireAdHoc(e(null), DATE).saisineParDautresLe).toBe('2026-02-01')
      expect(alerteMandataireAdHoc(e('2025-11-02'), DATE).saisineParDautresLe).toBe('2026-02-01')
      expect(alerteMandataireAdHoc(e('2026-01-20'), '2026-01-10').saisineParDautresLe).toBe('2026-02-01')
    })

    it('au titre des comptes : ouverte dès les deux ans, même si le syndic a agi', () => {
      const a = alerteMandataireAdHoc(
        entree({ saisineLe: '2026-01-20', votes: [{ date: '2023-06-10', etat: 'adoptee' }], exercices: [ex('ex-2025', E2025, provisions2025(1_000_000))] }),
        DATE,
      )
      expect(a).toMatchObject({ saisineFaite: true, saisineParDautresLe: '2025-06-10' })
    })
  })

  describe('copie de la requête au représentant de l’État, au maire et au président de l’EPCI (art. 29-1 A, dernier alinéa ; D. 1967 art. 61-5)', () => {
    const e = (saisineLe: string | null, copieRequeteAdresseeLe: string | null = null) =>
      entree({ saisineLe, copieRequeteAdresseeLe, exercices: [ex('ex-2025', E2025, provisions2025(1_000_000))] })

    it('requête enregistrée, copie non adressée : l’alerte est traitée, la copie reste due dès la requête', () => {
      expect(alerteMandataireAdHoc(e('2026-01-20'), DATE)).toMatchObject({ saisineFaite: true, copieRequeteDueLe: '2026-01-20' })
    })

    it('copie adressée au plus tard à la date de référence : plus rien de dû ; sans requête connue à la date : rien', () => {
      expect(alerteMandataireAdHoc(e('2026-01-20', '2026-01-22'), DATE).copieRequeteDueLe).toBeNull()
      expect(alerteMandataireAdHoc(e('2026-01-20', '2026-03-05'), DATE).copieRequeteDueLe).toBe('2026-01-20')
      expect(alerteMandataireAdHoc(e(null), DATE).copieRequeteDueLe).toBeNull()
      expect(alerteMandataireAdHoc(e('2026-04-01'), DATE).copieRequeteDueLe).toBeNull()
    })

    it('refuse une copie sans requête, antérieure à la requête, ou une date invalide', () => {
      expect(() => alerteMandataireAdHoc(e(null, '2026-01-22'), DATE)).toThrow(/sans requête/)
      expect(() => alerteMandataireAdHoc(e('2026-01-20', '2026-01-19'), DATE)).toThrow(/avant la requête/)
      expect(() => alerteMandataireAdHoc(e('2026-01-20', '2026-01-32'), DATE)).toThrow(/AAAA-MM-JJ/)
    })
  })
})

describe('mandat de justice', () => {
  const declenchee = (regime: EntreeAlerteMandataireAdHoc['regime']) =>
    alerteMandataireAdHoc(entree({ regime, exercices: [ex('ex-2025', E2025, provisions2025(1_000_000))] }), DATE)

  it('syndic désigné par le président du tribunal judiciaire : il est le syndic, l’obligation lui incombe', () => {
    const a = declenchee('sj')
    expect(a).toMatchObject({ aConfirmer: false, saisineParDautresLe: '2026-02-01' })
    expect(a.conduite).toMatch(/syndic désigné par le président du tribunal judiciaire/i)
    expect(a.fondement).toMatch(/D\. 1967 art\. 46/)
  })

  it('syndic et syndic désigné : le régime et le cadre « obligation du syndic » sont dans le résultat', () => {
    expect(declenchee(null)).toMatchObject({ regime: null, cadre: 'obligation_du_syndic' })
    expect(declenchee('sj')).toMatchObject({ regime: 'sj', cadre: 'obligation_du_syndic' })
  })

  it('administrateur provisoire de l’art. 29-1 (J67, R30) : constat à porter au compte rendu au juge, ni requête ni copie ; à confirmer', () => {
    const a = declenchee('ap291')
    expect(a).toMatchObject({ regime: 'ap291', cadre: 'compte_rendu_au_juge', aConfirmer: true, saisineParDautresLe: '2025-12-31' })
    expect(a.conduite).toBe(
      "Administrateur provisoire de l'art. 29-1 : pas d'alerte de l'art. 29-1 A à faire, ni requête au juge ni copie de la requête ; reporter le constat dans le prochain compte rendu au juge (D. 1967 art. 62-11) ; si le conseil syndical garde ses pouvoirs, lui adresser l'état des impayés avant répartition (D. 1967 art. 61-4). Le constat peut servir à l'imputation au syndic de tout ou partie des frais de l'administration provisoire, s'il n'a pas saisi le juge dans les conditions de l'art. 29-1 A (art. 29-1, II, al. 2). Lecture déduite des textes, à confirmer (J67, R30).",
    )
    expect(a.fondement).toBe('L. 1965 art. 29-1 A ; art. 29-1, I, al. 2 et II, al. 2 ; D. 1967 art. 61-4 et 62-11')
  })

  it('administrateur provisoire de l’art. 47 (J67, R30) : à signaler au juge, requête possible après consultation du conseil syndical ; à confirmer', () => {
    const a = declenchee('ap47')
    expect(a).toMatchObject({ regime: 'ap47', cadre: 'signalement_au_juge', aConfirmer: true, saisineParDautresLe: '2025-12-31' })
    expect(a.conduite).toMatch(/^Administrateur provisoire d'un syndicat dépourvu de syndic : pas d'obligation écrite ; seuil atteint : à signaler au juge/)
    expect(a.conduite).toContain("requête possible au président du tribunal judiciaire pour la désignation d'un administrateur provisoire de l'art. 29-1, après consultation du conseil syndical (D. 1967 art. 62-2)")
    expect(a.conduite).toMatch(/En l'absence de syndic, le juge peut être saisi par .*, dès la clôture\./)
    expect(a.fondement).toBe('L. 1965 art. 29-1 A, al. 2 ; D. 1967 art. 47 et 62-2')
  })

  it('administrateur provisoire sans les pouvoirs du syndic : aucune copie de requête due, même si une requête est enregistrée', () => {
    for (const regime of ['ap291', 'ap47'] as const)
      expect(alerteMandataireAdHoc(entree({ regime, saisineLe: '2026-01-20', exercices: [ex('ex-2025', E2025, provisions2025(1_000_000))] }), DATE).copieRequeteDueLe).toBeNull()
    expect(alerteMandataireAdHoc(entree({ regime: 'sj', saisineLe: '2026-01-20' }), DATE).copieRequeteDueLe).toBe('2026-01-20')
  })

  it('administrateur provisoire de l’art. 47 investi par l’ordonnance des pouvoirs du syndic (J67, R30) : l’obligation du syndic s’applique', () => {
    const a = alerteMandataireAdHoc(
      entree({ regime: 'ap47', ordonnanceConferePouvoirsDuSyndic: true, exercices: [ex('ex-2025', E2025, provisions2025(1_000_000))] }),
      DATE,
    )
    expect(a).toMatchObject({ regime: 'ap47', cadre: 'obligation_du_syndic', aConfirmer: false, saisineParDautresLe: '2025-12-31' })
    expect(a.conduite).toMatch(/investi par l'ordonnance des pouvoirs du syndic : il doit informer le conseil syndical.*copie de la requête/)
    expect(a.fondement).toBe('L. 1965 art. 29-1 A, al. 1 et dernier alinéa ; D. 1967 art. 61-2 à 61-5 ; D. 1967 art. 47')
    expect(() => alerteMandataireAdHoc(entree({ regime: 'ap291', ordonnanceConferePouvoirsDuSyndic: true }), DATE)).toThrow(/art\. 47/)
  })

  /** Approbation des comptes par décision de l'administrateur provisoire, après le dernier vote du 10/06/2023. */
  const decisionAp = creerDecisionAnnuelle({
    id: 'd-ap',
    coproprieteId: 'copro-1',
    type: 'approbation_comptes',
    exerciceId: 'ex-2024',
    date: '2025-09-01',
    source: { origine: 'administrateur', reference: 'reg-12' },
  })

  it('comptes approuvés par l’administrateur provisoire après le dernier vote (J67, R30) : affiché au lieu de « sans vote depuis deux ans »', () => {
    const ancien = alerteMandataireAdHoc(entree({ regime: 'ap291', votes: [{ date: '2023-06-10', etat: 'adoptee' }], decisions: [decisionAp] }), DATE)
    expect(ancien.comptes).toMatchObject({ etat: 'atteint', approuvesParAdministrateurLe: '2025-09-01' })
    expect(ancien.comptes.message).toBe(
      "Comptes approuvés par l'administrateur provisoire le 01/09/2025 (décision de l'administrateur, pas un vote de l'assemblée) ; dernier vote de l'assemblée sur l'approbation des comptes le 10/06/2023.",
    )
    const sansVote = alerteMandataireAdHoc(entree({ regime: 'ap291', votes: [], decisions: [decisionAp] }), DATE).comptes
    expect(sansVote).toMatchObject({ etat: 'non_etabli', approuvesParAdministrateurLe: '2025-09-01' })
    expect(sansVote.message).toMatch(/^Comptes approuvés par l'administrateur provisoire le 01\/09\/2025 .*; aucun vote de l'assemblée.*saisir la date/)
    const avantLeVote = alerteMandataireAdHoc(entree({ votes: [{ date: '2025-10-01', etat: 'adoptee' }], decisions: [decisionAp] }), DATE).comptes
    expect(avantLeVote.message).toMatch(/^Dernier vote de l'assemblée/)
    expect(alerteMandataireAdHoc(entree(), DATE).comptes.approuvesParAdministrateurLe).toBeNull()
  })

  it('relecture : hors administration provisoire de l’art. 29-1, une décision d’administrateur ne masque pas le délai atteint (J67, R30 : L3-35 vise l’art. 29-1)', () => {
    const ATTEINT = "Aucun vote de l'assemblée sur l'approbation des comptes depuis le 10/06/2023 : 24 mois sans vote atteints le 10/06/2025."
    for (const regime of [null, 'sj', 'ap47'] as const) {
      const { comptes } = alerteMandataireAdHoc(entree({ regime, votes: [{ date: '2023-06-10', etat: 'adoptee' }], decisions: [decisionAp] }), DATE)
      expect(comptes).toMatchObject({ etat: 'atteint', atteintLe: '2025-06-10', approuvesParAdministrateurLe: '2025-09-01', message: ATTEINT })
    }
    const { comptes } = alerteMandataireAdHoc(entree({ votes: [], decisions: [decisionAp] }), DATE)
    expect(comptes.message).toMatch(/^Aucun vote de l'assemblée sur l'approbation des comptes n'est connu/)
  })
})

describe('J67, R32 — nombre de lots : tous les lots, caves et parkings compris (L. 1965 art. 1, I)', () => {
  const lots = (nombre: number, coproprieteId = 'copro-1') => Array.from({ length: nombre }, (_, i) => ({ id: `lot-${i + 1}`, coproprieteId }))
  const sommes = [ex('ex-2025', E2025, provisions2025(600_000))]

  it('sans liste des lots, ou liste vide (pas encore chargée) : le nombre saisi seul, aucun écart ni faux seuil', () => {
    expect(alerteMandataireAdHoc(entree(), DATE)).toMatchObject({ lotsDeLaListe: null, ecartLots: null })
    expect(alerteMandataireAdHoc(entree({ lots: null }), DATE)).toMatchObject({ lotsDeLaListe: null, ecartLots: null })
    expect(alerteMandataireAdHoc(entree({ nombreLots: 250, lots: [] }), DATE)).toMatchObject({ lotsDeLaListe: null, ecartLots: null })
  })

  it('liste conforme au nombre saisi : comptée, aucun écart ; un lot cité deux fois compte une fois', () => {
    expect(alerteMandataireAdHoc(entree({ lots: lots(40) }), DATE)).toMatchObject({ lotsDeLaListe: 40, ecartLots: null })
    expect(alerteMandataireAdHoc(entree({ lots: [...lots(40), { id: 'lot-1', coproprieteId: 'copro-1' }] }), DATE).lotsDeLaListe).toBe(40)
  })

  it('écart avec la liste : signalé ; le nombre saisi reste celui du seuil ; le seuil de la liste est dit s’il diffère', () => {
    const a = alerteMandataireAdHoc(entree({ nombreLots: 180, lots: lots(205), exercices: sommes }), DATE)
    expect(a.impayes).toMatchObject({ seuilPourcent: 25, etat: 'non_atteint' })
    expect(a.lotsDeLaListe).toBe(205)
    expect(a.ecartLots).toMatch(/Nombre de lots saisi : 180 ; liste des lots du syndicat : 205/)
    expect(a.ecartLots).toMatch(/caves et parkings compris \(L\. 1965 art\. 1, I, et art\. 29-1 A, al\. 1 ; J67, R32\)/)
    expect(a.ecartLots).toMatch(/Avec la liste, le seuil serait de 15 % \(plus de 200 lots\)/)
    const memeSeuil = alerteMandataireAdHoc(entree({ nombreLots: 38, lots: lots(40) }), DATE).ecartLots
    expect(memeSeuil).toMatch(/saisi : 38 ; liste des lots du syndicat : 40/)
    expect(memeSeuil).not.toMatch(/seuil serait/)
  })

  it('un lot d’un autre syndicat : refusé', () => {
    expect(() => alerteMandataireAdHoc(entree({ lots: [...lots(39), { id: 'lot-x', coproprieteId: 'copro-2' }] }), DATE)).toThrow(/autre syndicat/)
  })
})

describe('contrôles', () => {
  it('refuse une date, un nombre de lots, une somme ou un vote invalides', () => {
    expect(() => alerteMandataireAdHoc(entree(), '2026-02-30')).toThrow(/AAAA-MM-JJ/)
    expect(() => alerteMandataireAdHoc(entree({ nombreLots: 0 }), DATE)).toThrow(/lots/)
    expect(() => alerteMandataireAdHoc(entree({ nombreLots: 12.5 }), DATE)).toThrow(/lots/)
    expect(() => alerteMandataireAdHoc(entree({ coproprieteId: ' ' }), DATE)).toThrow(/syndicat/)
    const avec = (s: SommeExigible) => entree({ exercices: [ex('ex-2025', E2025, [s])] })
    expect(() => alerteMandataireAdHoc(avec(somme('2025-02-30', 100, 0)), DATE)).toThrow(/AAAA-MM-JJ/)
    expect(() => alerteMandataireAdHoc(avec(somme('2025-02-01', 100.5, 0)), DATE)).toThrow(/centimes/)
    expect(() => alerteMandataireAdHoc(avec(somme('2025-02-01', 100, 101)), DATE)).toThrow(/impayé/)
    expect(() => alerteMandataireAdHoc(avec(somme('2025-02-01', 100, -1)), DATE)).toThrow(/impayé/)
    expect(() => alerteMandataireAdHoc(avec({ ...somme('2025-02-01', 100, 0), nature: 'travaux' as never }), DATE)).toThrow(/nature/)
    expect(() => alerteMandataireAdHoc(entree({ votes: [{ date: '2025-13-01', etat: 'adoptee' }] }), DATE)).toThrow(/AAAA-MM-JJ/)
    expect(() => alerteMandataireAdHoc(entree({ votes: [{ date: '2025-06-01', etat: 'vote' as never }] }), DATE)).toThrow(/état/)
    expect(() => alerteMandataireAdHoc(entree({ saisineLe: '2026-01-32' }), DATE)).toThrow(/AAAA-MM-JJ/)
  })

  it('un seul syndicat : exercice ou décision d’un autre syndicat refusés', () => {
    expect(() => alerteMandataireAdHoc(entree({ exercices: [ex('ex-x', exercice('2025', { coproprieteId: 'copro-2' }))] }), DATE)).toThrow(
      /autre syndicat/,
    )
    const autre = creerDecisionAnnuelle({
      id: 'd9',
      coproprieteId: 'copro-2',
      type: 'approbation_comptes',
      date: '2025-05-20',
      exerciceId: 'ex',
      source: { origine: 'assemblee', agId: 'ag', resolutionId: 'r' },
    })
    expect(() => alerteMandataireAdHoc(entree({ decisions: [autre] }), DATE)).toThrow(/autre syndicat/)
    expect(() => alerteMandataireAdHoc(entree({ exercices: [ex(' ')] }), DATE)).toThrow(/identifiant/)
  })
})

describe('en-tête du module', () => {
  const SOURCE = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'alerte-mandataire-ad-hoc.ts'), 'utf8')
  const EN_TETE = SOURCE.slice(0, SOURCE.indexOf('*/')).replaceAll(/\s*\n\s*\*\s*/g, ' ')

  it('textes relus et déduits marqués ; le dernier point non établi est tranché (décision du 20/11/2026, partie C, F35)', () => {
    for (const marqueur of ['🟢', '🔵']) expect(EN_TETE).toContain(marqueur)
    expect(EN_TETE).not.toContain('🔴')
    expect(EN_TETE).not.toMatch(/depuis quand compter les deux ans \?/)
    expect(EN_TETE).toMatch(
      /Décision du 20\/11\/2026 \(partie C, F35\) : .*« non établi ».*« saisir la date de la dernière assemblée qui s'est prononcée sur les comptes ».*au moins deux ans.*« atteint, à confirmer ».*début de la mission/,
    )
    expect(EN_TETE).toContain(
      "« Lorsqu'à la clôture des comptes les impayés atteignent 25 % des sommes exigibles en vertu des articles 14-1 et 14-2-1 ou en l'absence de vote de l'assemblée générale sur l'approbation des comptes depuis au moins deux ans »",
    )
    expect(EN_TETE).toMatch(/D\. 1967 art\. 61-2/)
  })

  it('administrateurs provisoires (J67, R30) : la question quitte les points non établis ; décision citée, aConfirmer gardé', () => {
    const nonEtabli = EN_TETE.slice(EN_TETE.indexOf('🔴 Non établi'))
    expect(nonEtabli).not.toMatch(/administrateur provisoire de l'art\. 29-1 : il a reçu tous les pouvoirs du syndic/)
    expect(nonEtabli).not.toMatch(/administrateur provisoire de l'art\. 47 \(syndicat dépourvu de syndic\)/)
    expect(EN_TETE).toMatch(/Décision J67, R30 \(17\/11\/2026 ;.*aConfirmer gardé.*\(D\. 1967 art\. 62-11\).*\(D\. 1967 art\. 62-2\)/)
  })

  it('administrateur provisoire de l’art. 29-1 : tout ou partie des pouvoirs de l’assemblée selon l’ordonnance, pas tous (art. 29-1, I)', () => {
    expect(EN_TETE).not.toMatch(/investi de tous les pouvoirs de l'assemblée/)
    expect(EN_TETE).toMatch(/s'il a reçu de l'ordonnance le pouvoir d'approuver les comptes/)
    expect(EN_TETE).toContain("« tout ou partie des pouvoirs de l'assemblée générale des copropriétaires »")
    expect(EN_TETE).toMatch(/hors a et b de l'art\. 26/)
  })

  it('travaux hors budget : art. 14-1, II, et non l’art. 14-2, devenu le plan pluriannuel de travaux', () => {
    expect(EN_TETE).not.toMatch(/dépenses hors budget de l'art\. 14-2/)
    expect(EN_TETE).toContain(
      "« Ne sont pas comprises dans le budget prévisionnel les dépenses du syndicat pour travaux, dont la liste est fixée par décret en Conseil d'Etat. Les sommes afférentes à ces dépenses sont exigibles selon les modalités votées par l'assemblée générale. »",
    )
    expect(EN_TETE).toMatch(/travaux hors budget \(II\)/)
  })

  it('saisine par d’autres au titre des impayés : seulement sans action du syndic dans le mois', () => {
    expect(EN_TETE).toMatch(/sauf si le syndic a saisi le juge dans ce mois/)
  })

  it('une requête ancienne ne couvre pas un déclenchement postérieur (critère par critère)', () => {
    expect(EN_TETE).toMatch(/critère par critère/)
    expect(EN_TETE).not.toMatch(/le jour du déclenchement ou après, et au plus tard à la date de référence, traite l'alerte/)
  })

  it('aucune date ISO écrite en dur', () => {
    expect(SOURCE).not.toMatch(/['`"]\d{4}-\d{2}-\d{2}['`"]/)
  })

  it('J67, R31 et R32 : période des sommes exigibles et définition des lots tranchées, retirées du 🔴', () => {
    const nonEtabli = EN_TETE.slice(EN_TETE.indexOf('🔴 Non établi'))
    expect(nonEtabli).not.toMatch(/période des sommes exigibles/)
    expect(nonEtabli).not.toMatch(/ou les seuls lots principaux/)
    expect(EN_TETE).toMatch(/J67, R31 : .*arriérés des exercices antérieurs compris/)
    expect(EN_TETE).toMatch(/J67, R32 : tous les lots de l'état descriptif de division, lots secondaires compris \(caves, parkings\)/)
    expect(SOURCE).not.toMatch(/🔴 assiette à confirmer/)
  })
})
