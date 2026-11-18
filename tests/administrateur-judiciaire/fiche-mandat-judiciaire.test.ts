import { describe, expect, it } from 'vitest'
import {
  MODES_EXERCICE_ADMINISTRATEURS,
  REPARTITION_FICHE_MANDAT_GESTEAM,
  creerVoletJudiciaire,
  type SaisieVoletJudiciaire,
} from '@/lib/administrateur-judiciaire/domain/mandat-judiciaire'

/**
 * Fiche mandat — volet « Administration judiciaire » de Gestéam (tranche 25) et décision D1.
 * - Champs : tribunal, président (magistrat), mission, ouverture, un ou deux administrateurs, référence interne ;
 *   ordonnance de carence (date, référence), propre à l'art. 47.
 * - D1 : la fiche « mandat » de Gestéam mêle des données du SYNDICAT (SIRET, immatriculation, conseil syndical…) et
 *   de la MISSION ; VitFix les répartit entre Copropriété et Mandat.
 */

const saisie = (surcharge: Partial<SaisieVoletJudiciaire> = {}): SaisieVoletJudiciaire => ({
  tribunal: '  Tribunal judiciaire de Marseille ',
  president: 'Président (fictif)',
  mission: 'Administration provisoire — art. 29-1',
  dateOuverture: '2026-03-02',
  administrateurs: ['Associé A'],
  reference: 'AJ-2026-014',
  ordonnanceCarence: null,
  ...surcharge,
})

const contexte = { fondement: 'Administration provisoire (art. 29-1)', dateOrdonnance: '2026-02-26' }

describe('fiche mandat — volet administration judiciaire', () => {
  it('crée le volet, textes nettoyés, sans avertissement', () => {
    expect(creerVoletJudiciaire(saisie(), contexte)).toEqual({
      volet: { ...saisie(), tribunal: 'Tribunal judiciaire de Marseille' },
      avertissements: [],
    })
  })

  it('exige un ou deux administrateurs, un tribunal, une date d’ouverture valide', () => {
    expect(() => creerVoletJudiciaire(saisie({ administrateurs: [] }), contexte)).toThrow(/administrateur/i)
    expect(() => creerVoletJudiciaire(saisie({ administrateurs: ['A', 'B', 'C'] }), contexte)).toThrow(/deux/i)
    expect(() => creerVoletJudiciaire(saisie({ tribunal: ' ' }), contexte)).toThrow(/tribunal/i)
    expect(() => creerVoletJudiciaire(saisie({ dateOuverture: '02/03/2026' }), contexte)).toThrow(/date/i)
  })

  it('refuse une ouverture antérieure à l’ordonnance de désignation', () => {
    expect(() => creerVoletJudiciaire(saisie({ dateOuverture: '2026-02-20' }), contexte)).toThrow(/ordonnance/i)
  })

  it('signale une ordonnance de carence hors art. 47, sans la refuser', () => {
    const resultat = creerVoletJudiciaire(saisie({ ordonnanceCarence: { date: '2026-01-15', reference: 'OC-1' } }), contexte)
    expect(resultat.avertissements).toEqual([expect.stringMatching(/art\. 47/)])
  })

  it('art. 47 : pas d’avertissement pour la carence, mais un s’il en manque la date', () => {
    const art47 = { fondement: 'Administrateur provisoire (art. 47)', dateOrdonnance: '2026-02-26' }
    expect(creerVoletJudiciaire(saisie({ ordonnanceCarence: { date: '2026-01-15', reference: 'OC-1' } }), art47).avertissements).toEqual([])
    expect(creerVoletJudiciaire(saisie(), art47).avertissements).toEqual([expect.stringMatching(/carence/i)])
  })

  it('refuse une date de carence invalide', () => {
    expect(() => creerVoletJudiciaire(saisie({ ordonnanceCarence: { date: '15/01/2026', reference: null } }), contexte)).toThrow(/date/i)
  })
})

describe('D1 — répartition de la fiche mandat Gestéam entre syndicat et mandat', () => {
  it('les identifiants et la vie du syndicat vont à la copropriété', () => {
    expect(REPARTITION_FICHE_MANDAT_GESTEAM.syndicat).toEqual(
      expect.arrayContaining(['SIRET', 'ICS', 'Immatriculation', 'Conseil syndical', 'Nb de lots', 'Exercices', 'Clés de répartition']),
    )
  })

  it('le volet administration judiciaire et la carence vont au mandat', () => {
    expect(REPARTITION_FICHE_MANDAT_GESTEAM.mandat).toEqual(
      expect.arrayContaining(['Tribunal', 'Président', 'Mission', 'Ouverture', 'Associé 1', 'Associé 2', 'Référence', 'Ordonnance de carence']),
    )
  })

  it('aucun champ n’est attribué aux deux', () => {
    const communs = REPARTITION_FICHE_MANDAT_GESTEAM.syndicat.filter((c) => (REPARTITION_FICHE_MANDAT_GESTEAM.mandat as readonly string[]).includes(c))
    expect(communs).toEqual([])
  })
})

describe('J67, R69 et R73 — mode d’exercice des deux administrateurs et pouvoirs du conseil syndical confiés', () => {
  it('R73 : deux administrateurs sans mode d’exercice saisi : avertissement « à vérifier dans l’ordonnance » ; ensemble ou chacun seul : aucun', () => {
    const deux = saisie({ administrateurs: ['Associé A', 'Associé B'] })
    expect(creerVoletJudiciaire(deux, contexte).avertissements).toEqual([expect.stringMatching(/mode d'exercice à vérifier dans l'ordonnance/)])
    for (const modeExercice of MODES_EXERCICE_ADMINISTRATEURS)
      expect(creerVoletJudiciaire({ ...deux, modeExercice }, contexte)).toMatchObject({ volet: { modeExercice }, avertissements: [] })
    expect(creerVoletJudiciaire(saisie({ modeExercice: null }), contexte).avertissements).toEqual([])
    // @ts-expect-error — mode hors MODES_EXERCICE_ADMINISTRATEURS
    expect(() => creerVoletJudiciaire({ ...deux, modeExercice: 'alterne' }, contexte)).toThrow(/mode d'exercice/i)
  })

  it('R69 : le volet porte la date de l’ordonnance qui confie les pouvoirs du conseil syndical à l’administrateur provisoire', () => {
    // ordonnance plus tardive que la désignation (L. 1965 art. 29-1, I, al. 3 : mission modifiable à tout moment)
    const plusTard = creerVoletJudiciaire(saisie({ pouvoirsConseilSyndicalConfiesLe: '2026-06-01' }), contexte).volet
    expect(plusTard.pouvoirsConseilSyndicalConfiesLe).toBe('2026-06-01')
    expect(creerVoletJudiciaire(saisie(), contexte).volet.pouvoirsConseilSyndicalConfiesLe).toBeUndefined()
    expect(() => creerVoletJudiciaire(saisie({ pouvoirsConseilSyndicalConfiesLe: '01/06/2026' }), contexte)).toThrow(/AAAA-MM-JJ/)
    expect(() => creerVoletJudiciaire(saisie({ pouvoirsConseilSyndicalConfiesLe: '2000-01-01' }), contexte)).toThrow(/avant l'ordonnance de désignation/)
  })
})
