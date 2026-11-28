import { describe, expect, it } from 'vitest'
import {
  DELAI_RECOURS_ORDONNANCE_MOIS,
  DROIT_FIXE_AP_HT_CENTIMES,
  SEUIL_LOTS_REMUNERATION_PAR_LE_JUGE,
  TYPES_ORDONNANCE_REMUNERATION,
  couvertureAu,
  delaiDeRecours,
  droitsTaxes,
  etatOrdonnance,
  verifierNombreDeLots,
} from '@/lib/administrateur-judiciaire/domain/ordonnances-remuneration'
import { AP_120_LOTS, finDeMission, ordonnance } from './donnees-ordonnances-remuneration'
import { enTeteDuModule } from './en-tete-module'

/**
 * J67, R3 et R4 (décision du 17/11/2026) — ordonnances de rémunération de l'administrateur : hors le droit fixe
 * de 1 500 € HT (art. 29-1, moins de 500 lots), il n'est payé qu'en vertu des ordonnances du juge (D. 1967 art. 61-1-5 ;
 * C. com. R. 814-27 et R. 814-28) ; l'ordonnance de fin de mission n'est exécutoire qu'après le mois de recours, sans
 * recours pendant, et seulement si sa notification indique le recours (CPC art. 714 ; Cass. 2e civ., 3/03/2016).
 */

describe('ordonnances de rémunération — référentiel', () => {
  it('trois types, le droit fixe de 1 500 € HT, le seuil de 500 lots et le délai de recours d’un mois', () => {
    expect(TYPES_ORDONNANCE_REMUNERATION).toEqual(['acompte', 'provision', 'fin_de_mission'])
    expect(DROIT_FIXE_AP_HT_CENTIMES).toBe(150_000)
    expect(SEUIL_LOTS_REMUNERATION_PAR_LE_JUGE).toBe(500)
    expect(DELAI_RECOURS_ORDONNANCE_MOIS).toBe(1)
  })

  it('le nombre de lots est un entier strictement positif', () => {
    expect(() => verifierNombreDeLots(0)).toThrow(/lots/i)
    expect(() => verifierNombreDeLots(12.5)).toThrow(/lots/i)
    expect(() => verifierNombreDeLots(Number.NaN)).toThrow(/lots/i)
    expect(() => verifierNombreDeLots(120)).not.toThrow()
  })

  it('en-tête : les textes lus et la décision J67 (R3, R4) sont cités', () => {
    const { texte } = enTeteDuModule('ordonnances-remuneration')
    for (const reference of ['J67, R3', 'J67, R4', 'D. 1967 art. 61-1-5', 'C. com. R. 814-27', 'R. 814-28', 'CPC art. 714', 'CPC art. 641', 'CPC art. 642', 'n° 15-12.129'])
      expect(texte).toContain(reference)
  })
})

describe('ordonnances de rémunération — délai de recours (CPC art. 714, 641 et 642)', () => {
  it('un mois à compter de la notification, même quantième, à minuit ; exécutoire le lendemain', () => {
    const delai = delaiDeRecours('2026-03-10')
    expect(delai).toMatchObject({ finDuDelai: '2026-04-10', executableLe: '2026-04-11', reporte: false })
    expect(delai.justification).toMatch(/notification du 10\/03\/2026/)
    expect(delai.justification).toMatch(/CPC art\. 714/)
    expect(delai.justification).toMatch(/10\/04\/2026 à minuit/)
    expect(delai.justification).toMatch(/CPC art\. 641, al\. 2/)
    expect(delai.justification).toMatch(/suspensifs d'exécution \(CPC art\. 714, al\. 3\)/)
    expect(delai.justification).toMatch(/exécutoire à partir du 11\/04\/2026/)
    expect(delai.justification).not.toMatch(/642/)
  })

  it('sans quantième identique, le dernier jour du mois ; un samedi, prorogé au lundi (CPC art. 642)', () => {
    const delai = delaiDeRecours('2026-01-30')
    expect(delai).toMatchObject({ finDuDelai: '2026-03-02', executableLe: '2026-03-03', reporte: true })
    expect(delai.justification).toMatch(/28\/02\/2026/)
    expect(delai.justification).toMatch(/CPC art\. 642/)
  })

  it('un jour férié (lundi de Pâques 2026) proroge aussi le délai', () => {
    expect(delaiDeRecours('2026-03-06')).toMatchObject({ finDuDelai: '2026-04-07', executableLe: '2026-04-08', reporte: true })
  })

  it('refuse une date de notification invalide', () => {
    expect(() => delaiDeRecours('10/03/2026')).toThrow(/date/i)
  })
})

describe('ordonnances de rémunération — état à une date', () => {
  it('acompte ou provision : utilisable dès sa notification (J67, R3), pas avant', () => {
    expect(etatOrdonnance(ordonnance(), '2026-03-10')).toMatchObject({ executable: true, montants: { emolumentsHtCentimes: 300_000, fraisHtCentimes: 20_000 } })
    expect(etatOrdonnance(ordonnance({ type: 'provision' }), '2026-03-10').executable).toBe(true)
    const avant = etatOrdonnance(ordonnance(), '2026-03-09')
    expect(avant.executable).toBe(false)
    expect(avant.justification).toMatch(/non notifiée au 09\/03\/2026/)
    expect(etatOrdonnance(ordonnance({ dateNotification: null }), '2026-12-31').executable).toBe(false)
  })

  it('fin de mission : refusée pendant le mois de recours, avec le calcul du délai', () => {
    const etat = etatOrdonnance(finDeMission(), '2026-04-10')
    expect(etat.executable).toBe(false)
    expect(etat.justification).toMatch(/délai de recours en cours/)
    expect(etat.justification).toMatch(/exécutoire à partir du 11\/04\/2026/)
  })

  it('fin de mission : exécutoire après le délai, sans recours enregistré, avec le conseil du certificat de non-recours', () => {
    const etat = etatOrdonnance(finDeMission(), '2026-04-11')
    expect(etat).toMatchObject({ executable: true, montants: { emolumentsHtCentimes: 600_000, fraisHtCentimes: 40_000 } })
    expect(etat.avertissement).toMatch(/certificat de non-recours/)
    expect(etat.avertissement).toMatch(/tout intéressé.*CPC art\. 714, al\. 1/)
    expect(etatOrdonnance(ordonnance(), '2026-04-11').avertissement).toBeNull()
  })

  it('fin de mission : refusée si la notification n’indique pas le recours (le délai ne court pas)', () => {
    const etat = etatOrdonnance(finDeMission({ mentionDuRecours: false }), '2027-01-15')
    expect(etat.executable).toBe(false)
    expect(etat.justification).toMatch(/sans la mention de la voie de recours/)
    expect(etat.justification).toMatch(/Cass\. 2e civ\., 3 mars 2016, n° 15-12\.129/)
  })

  it('fin de mission : refusée tant qu’un recours est pendant ; décidé, les montants de la décision remplacent ceux de l’ordonnance', () => {
    const recours = { formeLe: '2026-04-02', decision: null }
    const pendant = etatOrdonnance(finDeMission({ recours }), '2026-09-01')
    expect(pendant.executable).toBe(false)
    expect(pendant.justification).toMatch(/recours formé le 02\/04\/2026.*pendant.*suspensif/i)
    const decision = { date: '2026-10-01', emolumentsHtCentimes: 500_000, fraisHtCentimes: 30_000 }
    const decidee = finDeMission({ recours: { ...recours, decision } })
    expect(etatOrdonnance(decidee, '2026-09-30').executable).toBe(false)
    expect(etatOrdonnance(decidee, '2026-10-01')).toMatchObject({
      executable: true,
      montants: { emolumentsHtCentimes: 500_000, fraisHtCentimes: 30_000 },
      avertissement: null,
    })
  })

  it('fin de mission : un recours formé hors délai n’est pas suspensif de plein droit ; refus gardé par prudence, avec un fondement juste', () => {
    // Notifiée le 10/03/2026 avec la mention du recours : délai expiré le 10/04/2026 ; recours du 15/06/2026.
    const tardif = finDeMission({ recours: { formeLe: '2026-06-15', decision: null } })
    expect(etatOrdonnance(tardif, '2026-05-01').executable).toBe(true)
    const pendant = etatOrdonnance(tardif, '2026-07-01')
    expect(pendant.executable).toBe(false)
    expect(pendant.justification).toBe(
      "Ordonnance de fin de mission du 02/03/2026 : recours formé hors délai le 15/06/2026 (délai expiré le 10/04/2026) : il n'est " +
        "pas suspensif de plein droit (CPC art. 714, al. 3) ; refus gardé par prudence tant qu'il est pendant (J67, R3).",
    )
    // Formé le dernier jour du délai, il est dans le délai ; sans la mention du recours, le délai ne court pas.
    expect(etatOrdonnance(finDeMission({ recours: { formeLe: '2026-04-10', decision: null } }), '2026-07-01').justification).toMatch(
      /recours formé le 10\/04\/2026, pendant, suspensif d'exécution \(CPC art\. 714, al\. 3\)\.$/,
    )
    const sansMention = finDeMission({ mentionDuRecours: false, recours: { formeLe: '2026-06-15', decision: null } })
    expect(etatOrdonnance(sansMention, '2026-07-01').justification).toMatch(/recours formé le 15\/06\/2026, pendant, suspensif d'exécution/)
  })

  it('refuse une ordonnance invalide : type, montants, dates dans le désordre, identifiant vide', () => {
    expect(() => etatOrdonnance(ordonnance({ type: 'taxe' as never }), '2026-04-01')).toThrow(/type/i)
    expect(() => etatOrdonnance(ordonnance({ emolumentsHtCentimes: 1.5 }), '2026-04-01')).toThrow(/montant/i)
    expect(() => etatOrdonnance(ordonnance({ fraisHtCentimes: -1 }), '2026-04-01')).toThrow(/montant/i)
    expect(() => etatOrdonnance(ordonnance({ dateNotification: '2026-03-01' }), '2026-04-01')).toThrow(/notification/i)
    expect(() => etatOrdonnance(ordonnance({ recours: { formeLe: '2026-03-01', decision: null } }), '2026-04-01')).toThrow(/recours/i)
    const decisionAvant = { formeLe: '2026-04-02', decision: { date: '2026-04-01', emolumentsHtCentimes: 0, fraisHtCentimes: 0 } }
    expect(() => etatOrdonnance(ordonnance({ recours: decisionAvant }), '2026-04-01')).toThrow(/décision/i)
    expect(() => etatOrdonnance(ordonnance({ id: ' ' }), '2026-04-01')).toThrow(/identifiant/i)
    expect(() => etatOrdonnance(ordonnance(), '01/04/2026')).toThrow(/date/i)
  })
})

describe('ordonnances de rémunération — ce qu’elles couvrent à une date (J67, R3)', () => {
  it('AP art. 29-1 de moins de 500 lots, sans ordonnance : le seul droit fixe de 1 500 € HT', () => {
    expect(couvertureAu('mandat-2026', AP_120_LOTS, [], '2026-04-01')).toMatchObject({
      emolumentsHtCentimes: 150_000,
      fraisHtCentimes: 0,
      droitFixeHtCentimes: 150_000,
      ordonnanceIds: [],
    })
  })

  it('500 lots et plus, ou un autre régime : aucun droit fixe (arrêté du 8 octobre 2015, art. 3 ; C. com. R. 814-27)', () => {
    for (const mandat of [{ regime: 'ap291', nbLots: 500 }, { regime: 'sj', nbLots: 40 }, { regime: 'ap47', nbLots: 40 }, { regime: null, nbLots: 40 }] as const)
      expect(couvertureAu('mandat-2026', mandat, [], '2026-04-01')).toMatchObject({ emolumentsHtCentimes: 0, droitFixeHtCentimes: 0 })
    expect(() => couvertureAu('mandat-2026', { regime: 'ap291', nbLots: 0 }, [], '2026-04-01')).toThrow(/lots/i)
  })

  it('droit fixe et acomptes notifiés s’ajoutent ; une ordonnance non encore notifiée ne compte pas', () => {
    const ordonnances = [ordonnance(), ordonnance({ id: 'ord-2', dateNotification: '2026-05-04', emolumentsHtCentimes: 100_000, fraisHtCentimes: 0 })]
    const couverture = couvertureAu('mandat-2026', AP_120_LOTS, ordonnances, '2026-04-01')
    expect(couverture).toMatchObject({ emolumentsHtCentimes: 450_000, fraisHtCentimes: 20_000, ordonnanceIds: ['ord-1'] })
    expect(couverture.etats.map((e) => [e.ordonnanceId, e.executable])).toEqual([
      ['ord-1', true],
      ['ord-2', false],
    ])
  })

  it('la fin de mission exécutoire arrête toute la rémunération : elle remplace droit fixe et acomptes (🔵)', () => {
    const ordonnances = [ordonnance(), finDeMission()]
    expect(couvertureAu('mandat-2026', AP_120_LOTS, ordonnances, '2026-04-11')).toMatchObject({
      emolumentsHtCentimes: 600_000,
      fraisHtCentimes: 40_000,
      droitFixeHtCentimes: 0,
      ordonnanceIds: ['ord-fin'],
    })
    expect(couvertureAu('mandat-2026', AP_120_LOTS, ordonnances, '2026-04-10')).toMatchObject({
      emolumentsHtCentimes: 450_000,
      ordonnanceIds: ['ord-1'],
    })
  })

  it('refuse une ordonnance d’un autre mandat, deux ordonnances de même identifiant, deux fins de mission', () => {
    expect(() => couvertureAu('mandat-2026', AP_120_LOTS, [ordonnance({ mandatId: 'autre' })], '2026-04-01')).toThrow(/autre mandat/i)
    expect(() => couvertureAu('mandat-2026', AP_120_LOTS, [ordonnance(), ordonnance()], '2026-04-01')).toThrow(/deux fois/i)
    expect(() => couvertureAu('mandat-2026', AP_120_LOTS, [finDeMission(), finDeMission({ id: 'ord-fin-2' })], '2026-04-01')).toThrow(
      /fin de mission/i,
    )
  })
})

describe('ordonnances de rémunération — montants taxés (J67, R4)', () => {
  it('toutes les ordonnances rendues, notifiées ou non ; la décision sur le recours remplace leurs montants', () => {
    const decision = { date: '2026-10-01', emolumentsHtCentimes: 250_000, fraisHtCentimes: 10_000 }
    const ordonnances = [ordonnance({ recours: { formeLe: '2026-03-20', decision } }), ordonnance({ id: 'ord-2', dateNotification: null })]
    expect(droitsTaxes('mandat-2026', AP_120_LOTS, ordonnances)).toEqual({
      emolumentsHtCentimes: 150_000 + 250_000 + 300_000,
      fraisHtCentimes: 10_000 + 20_000,
      droitFixeHtCentimes: 150_000,
      ordonnanceIds: ['ord-1', 'ord-2'],
    })
  })

  it('avec une ordonnance de fin de mission, même sous recours : son montant seul', () => {
    const ordonnances = [ordonnance(), finDeMission({ recours: { formeLe: '2026-04-02', decision: null } })]
    expect(droitsTaxes('mandat-2026', AP_120_LOTS, ordonnances)).toEqual({
      emolumentsHtCentimes: 600_000,
      fraisHtCentimes: 40_000,
      droitFixeHtCentimes: 0,
      ordonnanceIds: ['ord-fin'],
    })
  })
})
