import { describe, expect, it } from 'vitest'
import { ANNEE_PLANCHER, ANNEES_A_VENIR_MAX, plausibiliteDate } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  JALONS_ACCOMPLIS,
  controlerChronologieContentieux,
  controlerPlausibiliteDatesContentieux,
  creerDossierContentieux,
  type SaisieContentieux,
} from '@/lib/administrateur-judiciaire/domain/contentieux'
import {
  controlerChronologieSinistre,
  controlerPlausibiliteDatesSinistre,
  creerSinistre,
  type SaisieSinistre,
} from '@/lib/administrateur-judiciaire/domain/sinistres'

/**
 * Plausibilité des dates d'un dossier (cartographie Gestéam, tranche 42) : Gestéam accepte un jugement daté dans deux ans
 * et une mise en demeure en 2525 (fautes de frappe). VitFix contrôle déjà l'ORDRE des jalons ; il contrôle ici leur
 * PLAUSIBILITÉ par rapport à la date du jour :
 * - un fait accompli (mise en demeure, jugement, déclaration, clôture…) n'est jamais daté après aujourd'hui ;
 * - une date que l'on fixe à l'avance (audience, référé, rendez-vous d'expertise) peut être future, mais pas de plus de
 *   ANNEES_A_VENIR_MAX ans ;
 * - une année antérieure à ANNEE_PLANCHER est une faute de frappe.
 * Ce sont des ANOMALIES signalées, jamais des refus : la saisie reste acceptée.
 */

const AUJOURDHUI = '2026-10-27'

describe('dates — plausibilité d’une date', () => {
  it('accepte une date passée ou du jour, quel que soit le type de date', () => {
    expect(plausibiliteDate('2026-10-27', AUJOURDHUI, { futurAdmis: false })).toBeNull()
    expect(plausibiliteDate('2019-03-01', AUJOURDHUI, { futurAdmis: false })).toBeNull()
    expect(plausibiliteDate('2019-03-01', AUJOURDHUI, { futurAdmis: true })).toBeNull()
  })

  it('refuse le lendemain pour un fait accompli, l’accepte pour une date fixée à l’avance', () => {
    expect(plausibiliteDate('2026-10-28', AUJOURDHUI, { futurAdmis: false })).toBe('future')
    expect(plausibiliteDate('2026-10-28', AUJOURDHUI, { futurAdmis: true })).toBeNull()
  })

  it(`borne une date à venir à ${ANNEES_A_VENIR_MAX} ans, jour compris`, () => {
    expect(ANNEES_A_VENIR_MAX).toBe(3)
    expect(plausibiliteDate('2029-10-27', AUJOURDHUI, { futurAdmis: true })).toBeNull()
    expect(plausibiliteDate('2029-10-28', AUJOURDHUI, { futurAdmis: true })).toBe('trop_lointaine')
    expect(plausibiliteDate('2525-10-18', AUJOURDHUI, { futurAdmis: true })).toBe('trop_lointaine')
  })

  it(`signale une année antérieure à ${ANNEE_PLANCHER} comme une faute de frappe, même pour un fait accompli`, () => {
    expect(ANNEE_PLANCHER).toBe(1900)
    expect(plausibiliteDate('1900-01-01', AUJOURDHUI, { futurAdmis: false })).toBeNull()
    expect(plausibiliteDate('1899-12-31', AUJOURDHUI, { futurAdmis: false })).toBe('annee_improbable')
    expect(plausibiliteDate('0202-05-10', AUJOURDHUI, { futurAdmis: true })).toBe('annee_improbable')
  })

  it('refuse une date ou une date du jour qui ne sont pas des dates ISO valides', () => {
    expect(() => plausibiliteDate('12/03/2026', AUJOURDHUI, { futurAdmis: false })).toThrow(/date/i)
    expect(() => plausibiliteDate('2026-03-12', '27/10/2026', { futurAdmis: false })).toThrow(/aujourd/i)
  })
})

const saisieContentieux = (surcharge: Partial<SaisieContentieux> = {}): SaisieContentieux => ({
  coproprieteId: 'copro-1',
  type: 'Recouvrement de charges/loyer',
  phase: 'Procédure Judiciaire',
  particularite: 'Contentieux sans échéancier',
  dateOuverture: '2023-04-12',
  dateCloture: null,
  objet: 'Charges impayées',
  montantDemandeCentimes: 100_000,
  intervenants: {
    huissier: { nom: null, reference: null, transmisLe: null },
    avocat: { nom: null, reference: null, transmisLe: null },
    expert: { nom: null, reference: null, transmisLe: null },
  },
  jalons: {},
  ...surcharge,
})

const contentieux = (surcharge: Partial<SaisieContentieux> = {}) => creerDossierContentieux(saisieContentieux(surcharge))

describe('contentieux — plausibilité des dates', () => {
  it('range parmi les faits accomplis tous les jalons sauf l’audience et le référé', () => {
    expect([...JALONS_ACCOMPLIS].sort()).toEqual(
      ['assignation', 'commandement', 'jugement', 'miseEnDemeure', 'ordonnance', 'signification'].sort(),
    )
  })

  it('aucune anomalie pour un dossier daté dans le passé, audience à venir comprise', () => {
    const dossier = contentieux({
      jalons: { miseEnDemeure: '2023-04-12', assignation: '2024-01-10', audience: '2027-02-04' },
      intervenants: { ...saisieContentieux().intervenants, avocat: { nom: null, reference: null, transmisLe: '2023-06-01' } },
    })
    expect(controlerPlausibiliteDatesContentieux(dossier, AUJOURDHUI)).toEqual([])
  })

  it('signale un jugement daté après aujourd’hui (cas Gestéam : jugement saisi en 2028)', () => {
    const anomalies = controlerPlausibiliteDatesContentieux(contentieux({ jalons: { jugement: '2028-08-26' } }), AUJOURDHUI)
    expect(anomalies).toEqual([{ champ: 'jugement', nature: 'future', message: "Jugement daté du 26/08/2028, après aujourd'hui." }])
  })

  it('signale une mise en demeure en 2525 (faute de frappe) et une audience à plus de trois ans', () => {
    const anomalies = controlerPlausibiliteDatesContentieux(
      contentieux({ jalons: { miseEnDemeure: '2525-10-18', audience: '2031-01-15' } }),
      AUJOURDHUI,
    )
    expect(anomalies.map((a) => [a.champ, a.nature])).toEqual([
      ['miseEnDemeure', 'future'],
      ['audience', 'trop_lointaine'],
    ])
  })

  it('contrôle aussi l’ouverture, la clôture et les transmissions aux intervenants', () => {
    const anomalies = controlerPlausibiliteDatesContentieux(
      contentieux({
        dateOuverture: '2027-01-05',
        dateCloture: '1026-12-31',
        intervenants: {
          ...saisieContentieux().intervenants,
          huissier: { nom: null, reference: null, transmisLe: '2026-11-02' },
        },
      }),
      AUJOURDHUI,
    )
    expect(anomalies.map((a) => [a.champ, a.nature])).toEqual([
      ['dateOuverture', 'future'],
      ['dateCloture', 'annee_improbable'],
      ['huissier', 'future'],
    ])
  })

  it('donne un message lisible pour chaque nature d’anomalie', () => {
    const anomalies = controlerPlausibiliteDatesContentieux(
      contentieux({ dateCloture: '1026-12-31', jalons: { refere: '2032-03-01' } }),
      AUJOURDHUI,
    )
    expect(anomalies.map((a) => a.message)).toEqual([
      'Clôture datée du 31/12/1026 : année improbable (faute de frappe ?).',
      'Référé daté du 01/03/2032 : plus de 3 ans à venir, date improbable.',
    ])
  })

  it('refuse une date du jour invalide', () => {
    expect(() => controlerPlausibiliteDatesContentieux(contentieux(), '2026-13-01')).toThrow(/aujourd/i)
  })
})

const saisieSinistre = (surcharge: Partial<SaisieSinistre> = {}): SaisieSinistre => ({
  coproprieteId: 'copro-1',
  type: 'Dégât des eaux',
  phase: null,
  dateSurvenance: '2026-10-08',
  dateConnaissance: null,
  dateDeclaration: null,
  dateExpertise: null,
  dateRapport: null,
  dateReglement: null,
  dateCloture: null,
  partiesCommunesLesees: true,
  partiesCommunesResponsables: true,
  origine: '',
  lieu: '',
  dommages: '',
  assurance: { compagnie: null, courtier: null, contrat: null, numeroSinistre: null },
  indemniteImmediateCentimes: 0,
  indemniteImmediateReglee: false,
  indemniteDiffereeCentimes: 0,
  indemniteDiffereeReglee: false,
  causesSupprimees: false,
  reparationsFaites: false,
  ...surcharge,
})

const sinistre = (surcharge: Partial<SaisieSinistre> = {}) => creerSinistre(saisieSinistre(surcharge))

describe('sinistres — plausibilité des dates', () => {
  it('aucune anomalie pour un sinistre passé avec un rendez-vous d’expertise à venir', () => {
    const fiche = sinistre({ dateDeclaration: '2026-10-19', dateExpertise: '2026-11-15' })
    expect(controlerPlausibiliteDatesSinistre(fiche, AUJOURDHUI)).toEqual([])
  })

  it('signale une survenance, une déclaration, un rapport, un règlement ou une clôture datés après aujourd’hui', () => {
    const fiche = sinistre({
      dateSurvenance: '2026-10-30',
      dateDeclaration: '2026-11-02',
      dateRapport: '2026-12-01',
      dateReglement: '2027-01-10',
      dateCloture: '2027-02-01',
    })
    expect(controlerPlausibiliteDatesSinistre(fiche, AUJOURDHUI).map((a) => [a.champ, a.nature])).toEqual([
      ['dateSurvenance', 'future'],
      ['dateDeclaration', 'future'],
      ['dateRapport', 'future'],
      ['dateReglement', 'future'],
      ['dateCloture', 'future'],
    ])
  })

  it('contrôle la connaissance quand elle est saisie, pas quand elle est recopiée de la survenance', () => {
    expect(
      controlerPlausibiliteDatesSinistre(sinistre({ dateConnaissance: '2026-11-03' }), AUJOURDHUI).map((a) => a.champ),
    ).toEqual(['dateConnaissance'])
    const fautive = sinistre({ dateSurvenance: '1026-10-08' })
    expect(controlerPlausibiliteDatesSinistre(fautive, AUJOURDHUI).map((a) => [a.champ, a.nature])).toEqual([
      ['dateSurvenance', 'annee_improbable'],
    ])
  })

  it('signale une expertise fixée à plus de trois ans', () => {
    const fiche = sinistre({ dateConnaissance: '2026-10-09', dateExpertise: '2626-11-15' })
    expect(controlerPlausibiliteDatesSinistre(fiche, AUJOURDHUI)).toEqual([
      { champ: 'dateExpertise', nature: 'trop_lointaine', message: 'Expertise datée du 15/11/2626 : plus de 3 ans à venir, date improbable.' },
    ])
  })

  it('affiche l’année sur quatre chiffres pour que la faute de frappe se voie (« 0026 », pas « 26 »)', () => {
    expect(controlerPlausibiliteDatesSinistre(sinistre({ dateSurvenance: '0026-10-08' }), AUJOURDHUI)[0].message).toBe(
      'Survenance datée du 08/10/0026 : année improbable (faute de frappe ?).',
    )
  })
})

describe('chronologie — connaissance du sinistre et accord des messages', () => {
  it('signale une connaissance antérieure à la survenance, et une déclaration antérieure à la connaissance', () => {
    expect(controlerChronologieSinistre(sinistre({ dateConnaissance: '1926-10-09' })).map((a) => a.champ)).toEqual([
      'dateConnaissance',
    ])
    expect(
      controlerChronologieSinistre(sinistre({ dateConnaissance: '2026-10-15', dateDeclaration: '2026-10-12' })).map((a) => a.champ),
    ).toEqual(['dateDeclaration'])
  })

  it('accorde les messages au genre du libellé (« Rapport daté », « Jugement daté »)', () => {
    const rapport = controlerChronologieSinistre(sinistre({ dateExpertise: '2026-10-20', dateRapport: '2026-10-15' }))
    expect(rapport[0].message).toBe('Rapport daté avant une étape qui doit la précéder.')
    const jugement = controlerChronologieContentieux(contentieux({ jalons: { audience: '2026-06-05', jugement: '2026-05-01' } }))
    expect(jugement[0].message).toBe('Jugement daté avant : audience.')
  })
})
