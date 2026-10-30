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
 * Alerte de l'art. 29-1 A de la loi du 10 juillet 1965 (décision J7 de Hugo du 30/10/2026). Textes relus sur Légifrance le
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
    expect(NATURES_SOMME_EXIGIBLE).toEqual(['provision_budget', 'cotisation_fonds_travaux', 'autre'])
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

  it('sommes des art. 14-1 et 14-2-1 seulement ; une somme exigible après la clôture ne compte pas', () => {
    const sommes = [
      ...provisions2025(900_000),
      somme('2025-10-01', 400_000, 100_000, 'cotisation_fonds_travaux'),
      somme('2025-09-15', 5_000_000, 5_000_000, 'autre'),
      somme('2026-01-01', 1_000_000, 1_000_000),
    ]
    expect(alerteMandataireAdHoc(entree({ exercices: [ex('ex-2025', E2025, sommes)] }), DATE).impayes).toMatchObject({
      exigiblesCentimes: 4_400_000,
      impayesCentimes: 1_000_000,
      etat: 'non_atteint',
    })
  })

  it('🔴 arriérés des exercices antérieurs : comptés dans les impayés, hors des sommes exigibles de l’exercice ; alerte à confirmer', () => {
    const sommes = [...provisions2025(600_000), somme('2024-10-01', 1_000_000, 400_000)]
    const a = alerteMandataireAdHoc(entree({ exercices: [ex('ex-2025', E2025, sommes)] }), DATE)
    expect(a.impayes).toMatchObject({ exigiblesCentimes: 4_000_000, impayesCentimes: 1_000_000, arrieresCentimes: 400_000, etat: 'atteint' })
    expect(a.impayes.message).toMatch(/arriérés des exercices antérieurs/)
    expect(a.aConfirmer).toBe(true)
    expect(alerteMandataireAdHoc(entree({ exercices: [ex('ex-2025', E2025, provisions2025(1_000_000))] }), DATE).aConfirmer).toBe(false)
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
    expect(a.fondement).toMatch(/L\. 1965 art\. 29-1 A, al\. 1 ; D\. 1967 art\. 61-2 à 61-4/)
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

  it('🔴 administrateur provisoire de l’art. 29-1 : constat établi, obligation non établie ; frais imputables au syndic défaillant', () => {
    const a = declenchee('ap291')
    expect(a.aConfirmer).toBe(true)
    expect(a.saisineParDautresLe).toBe('2025-12-31')
    expect(a.conduite).toMatch(/tous les pouvoirs du syndic/)
    expect(a.conduite).toMatch(/aucun texte relu ne dit si/)
    expect(a.conduite).toMatch(/frais de l'administration provisoire/)
    expect(a.fondement).toMatch(/art\. 29-1, I, al\. 2 et II, al\. 2/)
  })

  it('🔴 administrateur provisoire de l’art. 47 : sans syndic, saisine ouverte à d’autres dès la clôture ; obligation non établie', () => {
    const a = declenchee('ap47')
    expect(a.aConfirmer).toBe(true)
    expect(a.saisineParDautresLe).toBe('2025-12-31')
    expect(a.conduite).toMatch(/en l'absence de syndic/)
    expect(a.fondement).toMatch(/D\. 1967 art\. 47/)
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

  it('textes relus, déduits et points non établis marqués', () => {
    for (const marqueur of ['🟢', '🔵', '🔴']) expect(EN_TETE).toContain(marqueur)
    expect(EN_TETE).toContain(
      "« Lorsqu'à la clôture des comptes les impayés atteignent 25 % des sommes exigibles en vertu des articles 14-1 et 14-2-1 ou en l'absence de vote de l'assemblée générale sur l'approbation des comptes depuis au moins deux ans »",
    )
    expect(EN_TETE).toMatch(/D\. 1967 art\. 61-2/)
    expect(EN_TETE).toMatch(/🔴 Non établi.*administrateur provisoire de l'art\. 29-1/)
  })

  it('aucune date ISO écrite en dur', () => {
    expect(SOURCE).not.toMatch(/['`"]\d{4}-\d{2}-\d{2}['`"]/)
  })
})
