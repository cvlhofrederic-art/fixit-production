import './fuseau-paris'
import { describe, expect, it } from 'vitest'
import { creerDossierContentieux, type SaisieContentieux } from '@/lib/administrateur-judiciaire/domain/contentieux'
import { calculerDecompte, genererEcheancier, suivreEcheancier } from '@/lib/administrateur-judiciaire/domain/decompte-contentieux'
import { creerExercice, type SaisieExercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import { creerSinistre, type SaisieSinistre } from '@/lib/administrateur-judiciaire/domain/sinistres'
import {
  DELAIS_SUIVI_CONTENTIEUX,
  depuisContentieux,
  depuisExercices,
  depuisSinistres,
  FAMILLES_SUIVI,
  LIBELLES_FAMILLES_SUIVI,
  LIBELLES_NATURES_SUIVI,
  NATURES_SUIVI,
  reglageParDefaut,
  selectionnerAFaire,
  type ElementAFaire,
} from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'

/**
 * Suivi « à faire » — familles ajoutées (point 54 du bilan 2 ; cartographie Gestéam, tranche 38 § Réglage, tranche 43 § 9).
 * - Contentieux : « Commandement depuis n », « Non réglés depuis n », « Soldés » ; plus l'échéancier du débiteur impayé.
 *   Les délais n sont des réglages de GESTION du cabinet, pas des délais légaux.
 * - Sinistres : « Indemnités différées » non réglées.
 * - Exercices : exercice passé qui n'est pas « Réparti » (en rouge dans la liste Gestéam) ; « Non géré » écarté (🔵 déduit).
 * - Relances « non réglé », « soldé, à clore » et échéancier impayé : dossiers de recouvrement seulement.
 */

const AUJOURDHUI = '2026-10-29'
const ids = (elements: ElementAFaire[]): string[] => elements.map((e) => e.id)

const saisieContentieux = (surcharge: Partial<SaisieContentieux> = {}): SaisieContentieux => ({
  coproprieteId: 'copro-1',
  type: 'Recouvrement de charges/loyer',
  phase: 'Ouverture',
  particularite: 'Contentieux sans échéancier',
  dateOuverture: '2026-03-02',
  dateCloture: null,
  objet: 'Charges impayées',
  montantDemandeCentimes: 450_000,
  intervenants: {
    huissier: { nom: null, reference: null, transmisLe: null },
    avocat: { nom: null, reference: null, transmisLe: null },
    expert: { nom: null, reference: null, transmisLe: null },
  },
  jalons: {},
  ...surcharge,
})

const contentieux = (surcharge: Partial<SaisieContentieux> = {}) => creerDossierContentieux(saisieContentieux(surcharge))

describe('familles et natures ajoutées', () => {
  it('contentieux et exercices deviennent des familles ; les sinistres suivent l’indemnité différée', () => {
    expect(FAMILLES_SUIVI).toContain('contentieux')
    expect(FAMILLES_SUIVI).toContain('exercices')
    expect(NATURES_SUIVI.contentieux).toEqual(['suite_commandement', 'echeancier_impaye', 'non_regle', 'a_clore'])
    expect(NATURES_SUIVI.sinistres).toEqual(['a_declarer', 'prescription', 'indemnite_differee'])
    expect(NATURES_SUIVI.exercices).toEqual(['repartition_en_retard'])
    expect(LIBELLES_FAMILLES_SUIVI.contentieux).toBe('Contentieux')
    expect(LIBELLES_FAMILLES_SUIVI.exercices).toBe('Exercices')
    for (const nature of [...NATURES_SUIVI.contentieux, ...NATURES_SUIVI.exercices, 'indemnite_differee'] as const)
      expect(LIBELLES_NATURES_SUIVI[nature]).toBeTruthy()
  })

  it('le réglage par défaut suit aussi les nouvelles familles', () => {
    const reglage = reglageParDefaut('u1')
    expect(reglage.familles.contentieux?.actif).toBe(true)
    expect(reglage.familles.exercices?.actif).toBe(true)
  })

  it('les délais par défaut du contentieux sont des réglages de gestion, modifiables', () => {
    expect(DELAIS_SUIVI_CONTENTIEUX).toEqual({ joursApresCommandement: 30, joursSansReglement: 60 })
  })
})

describe('source — contentieux', () => {
  it('excédent (solde négatif du décompte) : soldé, à clore, sans interrompre les autres dossiers', () => {
    const { soldeDuCentimes } = calculerDecompte({
      montantDemandeCentimes: 100_000,
      demandeArreteeLe: '2026-04-01',
      jugement: null,
      reglements: [{ id: 'R1', date: '2026-09-10', montantCentimes: 120_000 }],
      chequesADispositionCentimes: 0,
      chequesPromisCentimes: 0,
    })
    expect(soldeDuCentimes).toBe(-20_000)
    const elements = depuisContentieux(
      [
        { id: 'OK', mandatId: 'M1', libelle: 'Lot 3', dossier: contentieux() },
        { id: 'C1', mandatId: 'M1', libelle: 'Lot 12', dossier: contentieux(), dernierReglementLe: '2026-09-10', soldeDuCentimes },
      ],
      AUJOURDHUI,
    )
    expect(ids(elements)).toEqual(['contentieux:OK:non_regle', 'contentieux:C1:a_clore'])
    expect(elements[1].libelle).toMatch(/^Lot 12 — soldé \(excédent de 200,00\s€ à imputer sur le compte\), à clore$/)
  })

  it('hors recouvrement (contestation d’assemblée, garantie décennale) : ni relance ni clôture', () => {
    const contestation = contentieux({ type: 'Contestation d\'assemblée', montantDemandeCentimes: 0, jalons: { assignation: '2026-04-01' } })
    const decennale = contentieux({ type: 'Garantie décennale', montantDemandeCentimes: 5_000_000 })
    expect(
      depuisContentieux(
        [
          { id: 'K1', mandatId: 'M1', libelle: 'Contestation AG', dossier: contestation },
          { id: 'K2', mandatId: 'M1', libelle: 'Décennale', dossier: decennale },
        ],
        AUJOURDHUI,
      ),
    ).toEqual([])
  })

  it('recouvrement sans montant demandé ni solde : solde inconnu, ni relance ni clôture', () => {
    expect(depuisContentieux([{ id: 'K3', mandatId: 'M1', libelle: 'x', dossier: contentieux({ montantDemandeCentimes: 0 }) }], AUJOURDHUI)).toEqual([])
  })

  it('échéancier en cours et respecté : pas de relance « non réglé »', () => {
    const echeances = genererEcheancier({ nombre: 4, tousLes: 3, unite: 'mois', premiereLe: '2026-08-15', montantCentimes: 100_000 })
    const echeancier = suivreEcheancier(echeances, [{ id: 'R1', date: '2026-08-14', montantCentimes: 100_000 }], AUJOURDHUI)
    expect(echeancier.respecte).toBe(true)
    expect(
      depuisContentieux(
        [{ id: 'K4', mandatId: 'M1', libelle: 'x', dossier: contentieux(), dernierReglementLe: '2026-08-14', soldeDuCentimes: 350_000, echeancier }],
        AUJOURDHUI,
      ),
    ).toEqual([])
  })

  it('commandement puis dossier soldé : à clore seulement, pas de suite au commandement', () => {
    const dossier = contentieux({ jalons: { commandement: '2026-09-15' } })
    expect(
      ids(depuisContentieux([{ id: 'K5', mandatId: 'M1', libelle: 'x', dossier, dernierReglementLe: '2026-10-12', soldeDuCentimes: 0 }], AUJOURDHUI)),
    ).toEqual(['contentieux:K5:a_clore'])
  })

  it('un dernier règlement daté après aujourd’hui est ignoré : la relance part de l’ouverture', () => {
    const [element] = depuisContentieux(
      [{ id: 'K6', mandatId: 'M1', libelle: 'x', dossier: contentieux(), dernierReglementLe: '2027-01-15', soldeDuCentimes: 10 }],
      AUJOURDHUI,
    )
    expect(element).toMatchObject({ nature: 'non_regle', date: '2026-05-01', libelle: 'x — aucun règlement depuis le 02/03/2026' })
  })

  it('commandement : suite à donner n jours après, tant que le dossier est ouvert', () => {
    const dossier = contentieux({ jalons: { commandement: '2026-09-15' } })
    expect(depuisContentieux([{ id: 'C1', mandatId: 'M1', libelle: 'Lot 12', dossier }], AUJOURDHUI)).toContainEqual({
      id: 'contentieux:C1:suite_commandement',
      famille: 'contentieux',
      nature: 'suite_commandement',
      libelle: 'Lot 12 — suite au commandement du 15/09/2026',
      date: '2026-10-15',
      mandatId: 'M1',
      objetId: 'C1',
      assigneId: null,
      aConfirmer: false,
    })
    const reglage = { joursApresCommandement: 8, joursSansReglement: 60 }
    expect(
      depuisContentieux([{ id: 'C1', mandatId: 'M1', libelle: 'x', dossier }], AUJOURDHUI, reglage).find((e) => e.nature === 'suite_commandement')?.date,
    ).toBe('2026-09-23')
  })

  it('dossier clos : rien', () => {
    const clos = contentieux({ jalons: { commandement: '2026-09-15' }, dateCloture: '2026-10-01' })
    expect(depuisContentieux([{ id: 'C2', mandatId: 'M1', libelle: 'x', dossier: clos }], AUJOURDHUI)).toEqual([])
  })

  it('non réglé : n jours après le dernier règlement, ou après l’ouverture faute de règlement', () => {
    const dossier = contentieux()
    const [sansReglement] = depuisContentieux([{ id: 'C3', mandatId: 'M1', libelle: 'x', dossier }], AUJOURDHUI)
    expect(sansReglement).toMatchObject({ id: 'contentieux:C3:non_regle', date: '2026-05-01' })
    const [apresReglement] = depuisContentieux(
      [{ id: 'C3', mandatId: 'M1', libelle: 'x', dossier, dernierReglementLe: '2026-09-10', soldeDuCentimes: 120_000 }],
      AUJOURDHUI,
    )
    expect(apresReglement).toMatchObject({ nature: 'non_regle', date: '2026-11-09' })
  })

  it('soldé mais non clos : à clore, sans relance « non réglé »', () => {
    const dossier = contentieux()
    const elements = depuisContentieux(
      [{ id: 'C4', mandatId: 'M1', libelle: 'x', dossier, dernierReglementLe: '2026-10-12', soldeDuCentimes: 0 }],
      AUJOURDHUI,
    )
    expect(elements).toMatchObject([{ id: 'contentieux:C4:a_clore', nature: 'a_clore', date: '2026-10-12' }])
  })

  it('échéancier du débiteur impayé : à la première échéance échue non soldée', () => {
    const echeancier = suivreEcheancier(
      [
        { rang: 1, date: '2026-07-05', montantCentimes: 50_000 },
        { rang: 2, date: '2026-08-05', montantCentimes: 50_000 },
        { rang: 3, date: '2026-09-05', montantCentimes: 50_000 },
        { rang: 4, date: '2026-11-05', montantCentimes: 50_000 },
      ],
      [{ id: 'R1', date: '2026-07-04', montantCentimes: 70_000 }],
      AUJOURDHUI,
    )
    const dossier = contentieux({ particularite: 'Contentieux avec échéancier' })
    const elements = depuisContentieux([{ id: 'C5', mandatId: 'M1', libelle: 'x', dossier, echeancier }], AUJOURDHUI)
    expect(elements.find((e) => e.nature === 'echeancier_impaye')).toMatchObject({ id: 'contentieux:C5:echeancier_impaye', date: '2026-08-05' })
    const respecte = suivreEcheancier([{ rang: 1, date: '2026-07-05', montantCentimes: 50_000 }], [{ id: 'R1', date: '2026-07-04', montantCentimes: 50_000 }], AUJOURDHUI)
    expect(ids(depuisContentieux([{ id: 'C6', mandatId: 'M1', libelle: 'x', dossier, echeancier: respecte }], AUJOURDHUI))).not.toContain(
      'contentieux:C6:echeancier_impaye',
    )
  })

  it('refuse des délais ou des dates invalides', () => {
    const dossier = contentieux()
    expect(() => depuisContentieux([{ id: 'C7', mandatId: 'M1', libelle: 'x', dossier }], '29/10/2026')).toThrow(/AAAA-MM-JJ/)
    expect(() =>
      depuisContentieux([{ id: 'C7', mandatId: 'M1', libelle: 'x', dossier }], AUJOURDHUI, { joursApresCommandement: -1, joursSansReglement: 60 }),
    ).toThrow(/délai/i)
    expect(() =>
      depuisContentieux([{ id: 'C7', mandatId: 'M1', libelle: 'x', dossier, dernierReglementLe: '2026-02-30' }], AUJOURDHUI),
    ).toThrow(/règlement/i)
    expect(() =>
      depuisContentieux([{ id: 'C7', mandatId: 'M1', libelle: 'x', dossier, soldeDuCentimes: 2.5 }], AUJOURDHUI),
    ).toThrow(/centimes/)
  })
})

const saisieSinistre = (surcharge: Partial<SaisieSinistre> = {}): SaisieSinistre => ({
  coproprieteId: 'copro-1',
  type: 'Dégât des eaux',
  phase: null,
  dateSurvenance: '2026-06-20',
  dateConnaissance: null,
  dateDeclaration: '2026-06-22',
  dateExpertise: '2026-07-10',
  dateRapport: '2026-08-01',
  dateReglement: '2026-09-01',
  dateCloture: null,
  partiesCommunesLesees: true,
  partiesCommunesResponsables: false,
  origine: 'Fuite',
  lieu: 'Cage B',
  dommages: 'Plafond',
  assurance: { compagnie: null, courtier: null, contrat: null, numeroSinistre: null },
  indemniteImmediateCentimes: 300_000,
  indemniteImmediateReglee: true,
  indemniteDiffereeCentimes: 120_000,
  indemniteDiffereeReglee: false,
  causesSupprimees: true,
  reparationsFaites: true,
  ...surcharge,
})

describe('source — sinistres : indemnité différée', () => {
  it('non réglée : à réclamer depuis le règlement de l’indemnité immédiate ; libellé selon les réparations', () => {
    const fiche = creerSinistre(saisieSinistre())
    const element = depuisSinistres([{ id: 'S1', mandatId: 'M1', libelle: 'Dégât des eaux', fiche }]).find((e) => e.nature === 'indemnite_differee')
    expect(element).toMatchObject({
      id: 'sinistres:S1:indemnite_differee',
      date: '2026-09-01',
      libelle: 'Dégât des eaux — indemnité différée à réclamer (réparations faites)',
      aConfirmer: false,
    })
    const aFaire = creerSinistre(saisieSinistre({ reparationsFaites: false }))
    expect(depuisSinistres([{ id: 'S2', mandatId: 'M1', libelle: 'x', fiche: aFaire }]).find((e) => e.nature === 'indemnite_differee')?.libelle).toBe(
      'x — indemnité différée en attente des réparations',
    )
  })

  it('réglée, nulle ou sinistre clos : rien', () => {
    const reglee = creerSinistre(saisieSinistre({ indemniteDiffereeReglee: true }))
    const nulle = creerSinistre(saisieSinistre({ indemniteDiffereeCentimes: 0 }))
    const clos = creerSinistre(saisieSinistre({ dateCloture: '2026-10-01' }))
    for (const fiche of [reglee, nulle, clos])
      expect(depuisSinistres([{ id: 'S', mandatId: 'M1', libelle: 'x', fiche }]).filter((e) => e.nature === 'indemnite_differee')).toEqual([])
  })

  it('sans règlement daté : depuis le rapport, la déclaration, puis la survenance', () => {
    const date = (surcharge: Partial<SaisieSinistre>) =>
      depuisSinistres([{ id: 'S3', mandatId: 'M1', libelle: 'x', fiche: creerSinistre(saisieSinistre({ dateReglement: null, indemniteImmediateReglee: false, ...surcharge })) }]).find(
        (e) => e.nature === 'indemnite_differee',
      )?.date
    expect(date({})).toBe('2026-08-01')
    expect(date({ dateRapport: null })).toBe('2026-06-22')
    expect(date({ dateRapport: null, dateExpertise: null, dateDeclaration: null })).toBe('2026-06-20')
  })
})

const saisieExercice = (surcharge: Partial<SaisieExercice> = {}): SaisieExercice => ({
  coproprieteId: 'copro-1',
  nom: '2025',
  ouverture: '2025-01-01',
  cloture: '2025-12-31',
  statut: 'Voté',
  statutIrc: 'Non déclaré',
  agId: 'AG-2025',
  resolutions: { budget: '4', complement: null, honoraires: null, travaux: null },
  ...surcharge,
})

describe('source — exercices', () => {
  it('exercice clos ni réparti ni hors gestion : répartition en retard, dès le lendemain de la clôture', () => {
    const exercice = creerExercice(saisieExercice())
    expect(depuisExercices([{ mandatId: 'M1', exercice }], AUJOURDHUI)).toEqual([
      {
        id: 'exercices:copro-1:2025:repartition_en_retard',
        famille: 'exercices',
        nature: 'repartition_en_retard',
        libelle: 'Exercice 2025 clos le 31/12/2025, statut « Voté » : répartition en retard',
        date: '2026-01-01',
        mandatId: 'M1',
        objetId: 'copro-1:2025',
        assigneId: null,
        aConfirmer: false,
      },
    ])
  })

  it('réparti, non géré, ou pas encore clos : rien', () => {
    for (const exercice of [
      creerExercice(saisieExercice({ statut: 'Réparti' })),
      creerExercice(saisieExercice({ statut: 'Non géré' })),
      creerExercice(saisieExercice({ nom: '2026', ouverture: '2026-01-01', cloture: '2026-12-31' })),
      creerExercice(saisieExercice({ nom: 'jour', ouverture: '2026-01-01', cloture: AUJOURDHUI })),
    ])
      expect(depuisExercices([{ mandatId: 'M1', exercice }], AUJOURDHUI)).toEqual([])
  })

  it('refuse une date de référence invalide', () => {
    expect(() => depuisExercices([], '2026-02-30')).toThrow(/AAAA-MM-JJ/)
  })

  it('clé : l’identifiant de l’enregistrement s’il est fourni ; sans identifiant, un nom est exigé', () => {
    const sansNom = creerExercice(saisieExercice({ nom: ' ' }))
    expect(ids(depuisExercices([{ id: 'ex-24', mandatId: 'M1', exercice: sansNom }, { id: 'ex-25', mandatId: 'M1', exercice: sansNom }], AUJOURDHUI))).toEqual([
      'exercices:ex-24:repartition_en_retard',
      'exercices:ex-25:repartition_en_retard',
    ])
    expect(() => depuisExercices([{ mandatId: 'M1', exercice: sansNom }], AUJOURDHUI)).toThrow(/identifiant ni nom/)
  })
})

describe('sélection', () => {
  it('les nouvelles familles passent par le réglage comme les autres', () => {
    const elements = [
      ...depuisContentieux([{ id: 'C1', mandatId: 'M1', libelle: 'x', dossier: contentieux({ jalons: { commandement: '2026-09-15' } }) }], AUJOURDHUI),
      ...depuisExercices([{ mandatId: 'M1', exercice: creerExercice(saisieExercice()) }], AUJOURDHUI),
    ]
    const reglage = reglageParDefaut('u1')
    const affectations = [{ mandatId: 'M1', cabinetId: null, responsableId: 'u1', comptableId: null, assistantId: null }]
    expect(ids(selectionnerAFaire(elements, reglage, affectations, AUJOURDHUI))).toEqual([
      'exercices:copro-1:2025:repartition_en_retard',
      'contentieux:C1:non_regle',
      'contentieux:C1:suite_commandement',
    ])
    reglage.familles.exercices!.actif = false
    expect(ids(selectionnerAFaire(elements, reglage, affectations, AUJOURDHUI))).not.toContain('exercices:copro-1:2025:repartition_en_retard')
  })
})
