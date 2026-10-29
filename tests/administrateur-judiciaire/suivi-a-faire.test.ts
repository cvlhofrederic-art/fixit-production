import './fuseau-paris'
import { describe, expect, it } from 'vitest'
import { factureEnRetard, type FacturationContrat } from '@/lib/administrateur-judiciaire/domain/contrats-facturation'
import type { EcheanceCalculee } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import type { Etape } from '@/lib/administrateur-judiciaire/domain/etapes'
import type { FicheEquipement } from '@/lib/administrateur-judiciaire/domain/equipements'
import type { Diagnostic } from '@/lib/administrateur-judiciaire/domain/immeuble-juridique'
import { creerSinistre, reperesDelaisSinistre, type SaisieSinistre } from '@/lib/administrateur-judiciaire/domain/sinistres'
import {
  balanceAgee,
  copierReglage,
  depuisAssemblees,
  depuisContrats,
  depuisDiagnostics,
  depuisEcheancesLegales,
  depuisEquipements,
  depuisEtapes,
  depuisFactures,
  depuisOperationsTravaux,
  depuisSinistres,
  depuisTaches,
  FAMILLES_SUIVI,
  limiteHorizon,
  NATURES_SUIVI,
  planSemaine,
  portefeuille,
  reglageParDefaut,
  selectionnerAFaire,
  type AffectationMandat,
  type DossierOuvert,
  type ElementAFaire,
  type ReglageSuivi,
} from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'
import { creerOperationTravaux, type SaisieOperationTravaux } from '@/lib/administrateur-judiciaire/domain/travaux-operations'
import { controlerConvocation } from '@/lib/administrateur-judiciaire/domain/votes-ag'

/**
 * Suivi « à faire » transversal (cartographie Gestéam, tranche 38 : Suivi par collaborateur, onglets Suivi et Réglage ;
 * Suivi des éléments en cours).
 * - Chaque module fournit ses éléments datés ; le collaborateur règle, famille par famille, ce qu’il suit, son
 *   périmètre (son portefeuille ou tout le cabinet) et son horizon (« Maintenant », n jours, semaines ou mois).
 * - Le portefeuille : les mandats où il est responsable, comptable ou assistant ; un élément qui lui est désigné le suit
 *   hors portefeuille.
 * - La semaine : « Avant », puis lundi … vendredi ; un élément du week-end revient au vendredi qui précède.
 * - Balance âgée des dossiers ouverts par collaborateur (rôle sur le mandat ou responsable de la fiche), en quatre
 *   tranches selon la périodicité (30 jours, mois, trimestre, année), sous-total par cabinet et total général.
 * - Les sources reprennent les règles existantes sans les recalculer ; un repère juridique non confirmé est signalé.
 */

const AUJOURDHUI = '2026-10-27' // mardi

const affectations: AffectationMandat[] = [
  { mandatId: 'M1', cabinetId: 'C1', responsableId: 'u1', comptableId: 'u3', assistantId: null },
  { mandatId: 'M2', cabinetId: 'C1', responsableId: 'u2', comptableId: 'u3', assistantId: 'u5' },
  { mandatId: 'M3', cabinetId: 'C2', responsableId: 'u4', comptableId: null, assistantId: null },
]

const element = (surcharge: Partial<ElementAFaire> = {}): ElementAFaire => ({
  id: 'e1',
  famille: 'contrats',
  nature: 'limite_resiliation',
  libelle: 'Contrat d’entretien',
  date: AUJOURDHUI,
  mandatId: 'M1',
  objetId: 'c1',
  assigneId: null,
  aConfirmer: false,
  ...surcharge,
})

const ids = (elements: ElementAFaire[]): string[] => elements.map((e) => e.id)

describe('portefeuille et réglage du suivi', () => {
  it('le portefeuille réunit les mandats où le collaborateur tient un rôle, ou seulement les rôles demandés', () => {
    expect([...portefeuille('u3', affectations)].sort()).toEqual(['M1', 'M2'])
    expect([...portefeuille('u3', affectations, ['responsable'])]).toEqual([])
    expect([...portefeuille('u5', affectations, ['assistant'])]).toEqual(['M2'])
    expect([...portefeuille('inconnu', affectations)]).toEqual([])
  })

  it('réglage par défaut : toutes les familles suivies, mon portefeuille, horizon « Maintenant », toutes les natures', () => {
    const reglage = reglageParDefaut('u1')
    expect(reglage.collaborateurId).toBe('u1')
    expect(Object.keys(reglage.familles).sort()).toEqual([...FAMILLES_SUIVI].sort())
    expect(reglage.familles.contrats).toEqual({ actif: true, perimetre: 'portefeuille', horizon: { unite: 'maintenant' }, natures: null })
    expect(NATURES_SUIVI.contrats).toEqual(['limite_resiliation', 'mise_en_concurrence', 'facture_attendue'])
  })

  it('copier / coller : le réglage passe à un autre collaborateur sans partager ses objets', () => {
    const reglage = reglageParDefaut('u1')
    const copie = copierReglage(reglage, 'u2')
    expect(copie.collaborateurId).toBe('u2')
    expect(copie.familles).toEqual(reglage.familles)
    copie.familles.contrats!.actif = false
    copie.familles.travaux!.horizon = { nombre: 3, unite: 'mois' }
    expect(reglage.familles.contrats!.actif).toBe(true)
    expect(reglage.familles.travaux!.horizon).toEqual({ unite: 'maintenant' })
  })

  it('horizon : maintenant, n jours, n semaines, n mois (borné à la fin du mois) ; refuse un nombre invalide', () => {
    expect(limiteHorizon(AUJOURDHUI, { unite: 'maintenant' })).toBe('2026-10-27')
    expect(limiteHorizon(AUJOURDHUI, { nombre: 10, unite: 'jours' })).toBe('2026-11-06')
    expect(limiteHorizon(AUJOURDHUI, { nombre: 2, unite: 'semaines' })).toBe('2026-11-10')
    expect(limiteHorizon(AUJOURDHUI, { nombre: 1, unite: 'mois' })).toBe('2026-11-27')
    expect(limiteHorizon('2026-10-31', { nombre: 4, unite: 'mois' })).toBe('2027-02-28')
    expect(() => limiteHorizon(AUJOURDHUI, { nombre: -1, unite: 'jours' })).toThrow(/horizon/i)
    expect(() => limiteHorizon(AUJOURDHUI, { nombre: 1.5, unite: 'mois' })).toThrow(/horizon/i)
  })
})

describe('sélection « à faire »', () => {
  const elements = [
    element({ id: 'a', date: '2026-10-28' }),
    element({ id: 'b', date: '2026-10-20' }),
    element({ id: 'c', date: '2026-10-27' }),
    element({ id: 'd', date: '2026-10-01', mandatId: 'M2' }),
    element({ id: 'e', date: '2026-10-02', mandatId: 'M2', assigneId: 'u1' }),
    element({ id: 'f', date: '2026-10-03', mandatId: null }),
  ]

  const avecFamille = (familles: ReglageSuivi['familles']): ReglageSuivi => ({ collaborateurId: 'u1', familles })

  it('garde ce qui est dû d’ici l’horizon, dans mon portefeuille ou qui m’est désigné, trié par date', () => {
    expect(ids(selectionnerAFaire(elements, reglageParDefaut('u1'), affectations, AUJOURDHUI))).toEqual(['e', 'b', 'c'])
  })

  it('périmètre « cabinet » : tout le cabinet, y compris ce qui n’est rattaché à aucun mandat', () => {
    const reglage = avecFamille({ contrats: { actif: true, perimetre: 'cabinet', horizon: { unite: 'maintenant' }, natures: null } })
    expect(ids(selectionnerAFaire(elements, reglage, affectations, AUJOURDHUI))).toEqual(['d', 'e', 'f', 'b', 'c'])
  })

  it('horizon de la famille, horizon propre à une nature, natures choisies ; famille non suivie ou absente : rien', () => {
    const base = { actif: true, perimetre: 'portefeuille' as const, natures: null }
    const unJour = avecFamille({ contrats: { ...base, horizon: { nombre: 1, unite: 'jours' } } })
    expect(ids(selectionnerAFaire(elements, unJour, affectations, AUJOURDHUI))).toEqual(['e', 'b', 'c', 'a'])
    const parNature = avecFamille({
      contrats: { ...base, horizon: { unite: 'maintenant' }, horizonsParNature: { limite_resiliation: { nombre: 1, unite: 'jours' } } },
    })
    expect(ids(selectionnerAFaire(elements, parNature, affectations, AUJOURDHUI))).toEqual(['e', 'b', 'c', 'a'])
    const autreNature = avecFamille({ contrats: { ...base, horizon: { unite: 'maintenant' }, natures: ['mise_en_concurrence'] } })
    expect(selectionnerAFaire(elements, autreNature, affectations, AUJOURDHUI)).toEqual([])
    const inactive = avecFamille({ contrats: { ...base, actif: false, horizon: { unite: 'maintenant' } } })
    expect(selectionnerAFaire(elements, inactive, affectations, AUJOURDHUI)).toEqual([])
    expect(selectionnerAFaire(elements, avecFamille({}), affectations, AUJOURDHUI)).toEqual([])
  })

  it('un même élément n’apparaît qu’une fois ; refuse une date de référence invalide', () => {
    const doublons = [element({ id: 'x' }), element({ id: 'x' })]
    expect(ids(selectionnerAFaire(doublons, reglageParDefaut('u1'), affectations, AUJOURDHUI))).toEqual(['x'])
    expect(() => selectionnerAFaire(elements, reglageParDefaut('u1'), affectations, '27/10/2026')).toThrow(/date/i)
  })
})

describe('semaine du suivi', () => {
  it('range « Avant », puis du lundi au vendredi ; le week-end revient au vendredi qui précède', () => {
    const plan = planSemaine(
      [
        element({ id: 'x1', date: '2026-10-20' }),
        element({ id: 'x2', date: '2026-10-26' }),
        element({ id: 'x3', date: '2026-10-27' }),
        element({ id: 'x4', date: '2026-10-31' }),
        element({ id: 'x5', date: '2026-11-01' }),
        element({ id: 'x6', date: '2026-11-02' }),
        element({ id: 'x7', date: '2026-10-25' }),
      ],
      AUJOURDHUI,
    )
    expect(plan.lundi).toBe('2026-10-26')
    expect(ids(plan.avant)).toEqual(['x1', 'x7'])
    expect(plan.jours.map((j) => j.date)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'])
    expect(plan.jours.map((j) => ids(j.elements))).toEqual([['x2'], ['x3'], [], [], ['x4', 'x5']])
  })

  it('sélection puis semaine : un élément du samedi ou du dimanche se traite dès le vendredi, pas avant', () => {
    const weekEnd = [element({ id: 'ven', date: '2026-10-30' }), element({ id: 'sam', date: '2026-10-31' }), element({ id: 'dim', date: '2026-11-01' })]
    const vendredi = selectionnerAFaire(weekEnd, reglageParDefaut('u1'), affectations, '2026-10-30')
    expect(ids(planSemaine(vendredi, '2026-10-30').jours[4].elements)).toEqual(['ven', 'sam', 'dim'])
    expect(selectionnerAFaire(weekEnd, reglageParDefaut('u1'), affectations, '2026-10-29')).toEqual([])
  })

  it('la semaine se choisit par n’importe lequel de ses jours, week-end compris', () => {
    expect(planSemaine([], '2026-11-01').lundi).toBe('2026-10-26')
    expect(planSemaine([], '2026-10-26').lundi).toBe('2026-10-26')
    expect(planSemaine([], '2026-11-02').lundi).toBe('2026-11-02')
    expect(() => planSemaine([], '2026-13-01')).toThrow(/date/i)
  })
})

const echeance = (surcharge: Partial<EcheanceCalculee> = {}): EcheanceCalculee => ({
  regleId: 'convocation-ag-sj',
  libelle: 'Convocation de l’assemblée générale',
  nature: 'obligation',
  fondements: ['L. 1965 art. 47'],
  certitude: 'TEXTE',
  statut: 'CALCULEE',
  depart: { evenement: 'ordonnance', libelle: 'le prononcé de l’ordonnance', date: '2026-06-01', parDefaut: false },
  delaiLibelle: '',
  dateLegale: '2026-11-15',
  dateProrogee: null,
  dateRetenue: '2026-11-15',
  note: '',
  aVerifier: [],
  accomplie: false,
  ...surcharge,
})

describe('sources — échéances du mandat et assemblées', () => {
  it('reprend les échéances calculées et non accomplies ; une règle à confirmer ou de source secondaire est signalée', () => {
    const elements = depuisEcheancesLegales(
      [
        { mandatId: 'M1', echeance: echeance() },
        { mandatId: 'M1', echeance: echeance({ regleId: 'faite', accomplie: true }) },
        { mandatId: 'M1', echeance: echeance({ regleId: 'sans-date', statut: 'DELAI_A_SAISIR', dateRetenue: null }) },
        {
          mandatId: 'M2',
          echeance: echeance({ regleId: 'fenetre-close', nature: 'fenetre_tiers', certitude: 'A_CONFIRMER', dateRetenue: '2026-10-01' }),
        },
        { mandatId: 'M2', echeance: echeance({ regleId: 'secondaire', certitude: 'SOURCE_SECONDAIRE' }) },
      ],
      AUJOURDHUI,
    )
    expect(elements).toEqual([
      {
        id: 'mandat:M1:convocation-ag-sj',
        famille: 'mandat',
        nature: 'echeance_legale',
        libelle: 'Convocation de l’assemblée générale',
        date: '2026-11-15',
        mandatId: 'M1',
        objetId: 'convocation-ag-sj',
        assigneId: null,
        aConfirmer: false,
      },
      expect.objectContaining({ id: 'mandat:M2:secondaire', aConfirmer: true }),
    ])
  })

  it('assemblée en projet : dernier jour pour présenter la convocation (21 jours francs, à confirmer) ; convoquée : PV à signer', () => {
    const elements = depuisAssemblees([
      { id: 'AG1', mandatId: 'M1', libelle: 'AG du 15/12/2026', date: '2026-12-15', statut: 'Projet' },
      { id: 'AG2', mandatId: 'M2', libelle: 'AG du 20/10/2026', date: '2026-10-20', statut: 'Convoquée' },
      { id: 'AG3', mandatId: 'M2', libelle: 'AG du 01/09/2026', date: '2026-09-01', statut: 'Notifiée' },
    ])
    expect(elements).toEqual([
      {
        id: 'assemblees:AG1:convocation_a_presenter',
        famille: 'assemblees',
        nature: 'convocation_a_presenter',
        libelle: 'AG du 15/12/2026',
        date: '2026-11-23',
        mandatId: 'M1',
        objetId: 'AG1',
        assigneId: null,
        aConfirmer: true,
      },
      expect.objectContaining({ id: 'assemblees:AG2:pv_a_signer', nature: 'pv_a_signer', date: '2026-10-20', aConfirmer: false }),
    ])
    expect(controlerConvocation({ datePremierePresentation: '2026-11-23', dateAssemblee: '2026-12-15' }).conforme).toBe(true)
    expect(controlerConvocation({ datePremierePresentation: '2026-11-24', dateAssemblee: '2026-12-15' }).conforme).toBe(false)
    expect(() => depuisAssemblees([{ id: 'AG4', mandatId: 'M1', libelle: 'AG', date: '15/12/2026', statut: 'Projet' }])).toThrow(/date/i)
  })
})

const etape = (surcharge: Partial<Etape> = {}): Etape => ({
  id: 'E1',
  titre: 'Relancer l’ancien syndic',
  etapeType: null,
  demandeurId: 'u1',
  realisateurId: 'u2',
  validateurId: null,
  limite: '2026-10-30',
  alerteSecurite: null,
  faitLe: null,
  valideeLe: null,
  validationSansObjet: false,
  compteRendu: '',
  ...surcharge,
})

const saisieTravaux = (surcharge: Partial<SaisieOperationTravaux> = {}): SaisieOperationTravaux => ({
  numero: '00042',
  coproprieteId: 'copro-1',
  libelle: 'Ravalement',
  cleId: '001',
  decision: { date: '2026-06-30', resolution: '12' },
  budgetTtcCentimes: 1_000_000,
  financementFondsTravauxCentimes: 0,
  tranches: [
    { date: '2026-11-02', tauxPct: 50 },
    { date: '2027-01-04', tauxPct: 50 },
  ],
  ...surcharge,
})

describe('sources — étapes, tâches, travaux', () => {
  it('étape à faire : à sa date la plus proche (alerte ou limite), pour son réalisateur ; à valider : pour son validateur', () => {
    const elements = depuisEtapes(
      [
        { mandatId: 'M1', etape: etape() },
        { mandatId: 'M1', etape: etape({ id: 'E2', faitLe: '2026-10-20', validateurId: 'u1' }) },
        { mandatId: 'M1', etape: etape({ id: 'E3', limite: '2026-11-15', alerteSecurite: '2026-10-29' }) },
        { mandatId: 'M1', etape: etape({ id: 'E4', limite: null }) },
        { mandatId: 'M1', etape: etape({ id: 'E5', faitLe: '2026-10-20' }) },
      ],
      AUJOURDHUI,
    )
    expect(elements).toEqual([
      {
        id: 'etapes:E1:a_faire',
        famille: 'etapes',
        nature: 'a_faire',
        libelle: 'Relancer l’ancien syndic',
        date: '2026-10-30',
        mandatId: 'M1',
        objetId: 'E1',
        assigneId: 'u2',
        aConfirmer: false,
      },
      expect.objectContaining({ id: 'etapes:E2:a_valider', nature: 'a_valider', date: '2026-10-20', assigneId: 'u1' }),
      expect.objectContaining({ id: 'etapes:E3:a_faire', date: '2026-10-29', assigneId: 'u2' }),
    ])
  })

  it('tâche : à sa date due (date locale ou AAAA-MM-JJ), pour la personne désignée', () => {
    expect(
      depuisTaches([
        { id: 'T1', libelle: 'Relancer le notaire', due: new Date(2026, 9, 28), assigneId: 'u2', mandatId: 'M1' },
        { id: 'T2', libelle: 'Classer le dossier', due: '2026-10-30', assigneId: null },
      ]),
    ).toEqual([
      {
        id: 'taches:T1',
        famille: 'taches',
        nature: 'tache',
        libelle: 'Relancer le notaire',
        date: '2026-10-28',
        mandatId: 'M1',
        objetId: 'T1',
        assigneId: 'u2',
        aConfirmer: false,
      },
      expect.objectContaining({ id: 'taches:T2', date: '2026-10-30', mandatId: null, assigneId: null }),
    ])
    expect(() => depuisTaches([{ id: 'T3', libelle: 'x', due: new Date(Number.NaN), assigneId: null }])).toThrow(/date/i)
  })

  it('travaux votés : chaque appel pas encore lancé, à son exigibilité ; travaux non votés : rien', () => {
    const votes = creerOperationTravaux(saisieTravaux())
    const nonVotes = creerOperationTravaux(saisieTravaux({ numero: '00043', decision: null }))
    expect(
      depuisOperationsTravaux([
        { mandatId: 'M1', operation: votes, appelees: ['00042-T1'] },
        { mandatId: 'M1', operation: nonVotes, appelees: [] },
      ]),
    ).toEqual([
      {
        id: 'travaux:copro-1:00042-T2',
        famille: 'travaux',
        nature: 'fonds_a_appeler',
        libelle: 'Ravalement — appel n° 2 (50 %)',
        date: '2027-01-04',
        mandatId: 'M1',
        objetId: 'copro-1:00042',
        assigneId: null,
        aConfirmer: false,
      },
    ])
  })

  it('travaux : deux syndicats peuvent avoir le même n° d’opération, leurs appels restent distincts', () => {
    const ici = creerOperationTravaux(saisieTravaux())
    const ailleurs = creerOperationTravaux(saisieTravaux({ coproprieteId: 'copro-2' }))
    const appels = depuisOperationsTravaux([
      { mandatId: 'M1', operation: ici, appelees: [] },
      { mandatId: 'M2', operation: ailleurs, appelees: [] },
    ])
    const reglage: ReglageSuivi = {
      collaborateurId: 'u3',
      familles: { travaux: { actif: true, perimetre: 'portefeuille', horizon: { nombre: 1, unite: 'mois' }, natures: null } },
    }
    expect(ids(selectionnerAFaire(appels, reglage, affectations, AUJOURDHUI))).toEqual(['travaux:copro-1:00042-T1', 'travaux:copro-2:00042-T1'])
  })

  it('travaux dont la part du fonds attend son ordonnance : un élément qui dit ce qui bloque, sans interrompre les autres', () => {
    const enRegle = creerOperationTravaux(saisieTravaux())
    const enAttente = creerOperationTravaux(
      saisieTravaux({ numero: '00043', financementFondsTravauxCentimes: 200_000, affectationFonds: { objet: 'redressement_29_14' } }),
    )
    const elements = depuisOperationsTravaux([
      { mandatId: 'M1', operation: enRegle, appelees: [] },
      { mandatId: 'M2', operation: enAttente, appelees: ['00043-T1'] },
    ])
    expect(ids(elements)).toEqual(['travaux:copro-1:00042-T1', 'travaux:copro-1:00042-T2', 'travaux:copro-1:00043:affectation_fonds'])
    expect(elements[2]).toMatchObject({ date: '2027-01-04', mandatId: 'M2', objetId: 'copro-1:00043' })
    expect(elements[2].libelle).toMatch(/appels bloqués : .*ordonnance du juge/)
    expect(depuisOperationsTravaux([{ mandatId: 'M2', operation: enAttente, appelees: ['00043-T1', '00043-T2'] }])).toEqual([])
  })
})

const facturation = (surcharge: Partial<FacturationContrat> = {}): FacturationContrat => ({
  dateEffet: '2025-01-01',
  dureeMois: 12,
  tacite: true,
  preavisMois: 3,
  prixOrigineTtcCentimes: null,
  prixDernierTtcCentimes: null,
  montantAlerteCentimes: null,
  indice: null,
  periodiciteFacturesMois: 3,
  derniereFacture: '2026-07-01',
  retardFactureJours: 10,
  codification: null,
  ...surcharge,
})

describe('sources — contrats et factures', () => {
  it('contrat en cours à tacite reconduction : limite de résiliation (terme moins préavis) et facture attendue', () => {
    const elements = depuisContrats([{ id: 'c1', mandatId: 'M1', libelle: 'Entretien ascenseur', facturation: facturation() }], AUJOURDHUI)
    expect(elements).toEqual([
      {
        id: 'contrats:c1:limite_resiliation',
        famille: 'contrats',
        nature: 'limite_resiliation',
        libelle: 'Entretien ascenseur',
        date: '2026-10-01',
        mandatId: 'M1',
        objetId: 'c1',
        assigneId: null,
        aConfirmer: false,
      },
      expect.objectContaining({ id: 'contrats:c1:facture_attendue', nature: 'facture_attendue', date: '2026-10-12' }),
    ])
  })

  it('facture attendue : au premier jour de retard au-delà de la tolérance du contrat', () => {
    expect(factureEnRetard(facturation(), '2026-10-12')!.enRetard).toBe(true)
    expect(factureEnRetard(facturation(), '2026-10-11')!.enRetard).toBe(false)
  })

  it('mise en concurrence : à l’ouverture de la fenêtre, tant qu’elle n’est pas close', () => {
    const ouverte = { id: 'c2', mandatId: 'M1', libelle: 'Nettoyage', concurrenceDu: '2026-11-01', concurrenceAu: '2026-12-31' }
    expect(depuisContrats([ouverte], AUJOURDHUI)).toEqual([
      expect.objectContaining({ id: 'contrats:c2:mise_en_concurrence', nature: 'mise_en_concurrence', date: '2026-11-01' }),
    ])
    expect(depuisContrats([{ ...ouverte, concurrenceAu: '2026-10-26' }], AUJOURDHUI)).toEqual([])
  })

  it('contrat résilié ou plus géré : rien ; sans tacite reconduction ni factures périodiques : rien', () => {
    expect(depuisContrats([{ id: 'c3', mandatId: 'M1', libelle: 'x', statut: 'Résilié', facturation: facturation() }], AUJOURDHUI)).toEqual([])
    expect(depuisContrats([{ id: 'c4', mandatId: 'M1', libelle: 'x', statut: 'Plus géré', facturation: facturation() }], AUJOURDHUI)).toEqual([])
    expect(
      depuisContrats([{ id: 'c5', mandatId: 'M1', libelle: 'x', facturation: facturation({ tacite: false, periodiciteFacturesMois: null }) }], AUJOURDHUI),
    ).toEqual([])
    expect(() => depuisContrats([], '27/10/2026')).toThrow(/date/i)
  })

  it('facture fournisseur : règlement à l’échéance tant qu’il reste dû', () => {
    const facture = { id: 'F1', mandatId: 'M1', libelle: 'Facture ascenseur', dateFacture: '2026-10-01', joursEcheance: 30, totalTtcCentimes: 120_000, acomptesCentimes: 0 }
    expect(depuisFactures([facture, { ...facture, id: 'F2', acomptesCentimes: 120_000 }], AUJOURDHUI)).toEqual([
      {
        id: 'factures:F1',
        famille: 'factures',
        nature: 'reglement',
        libelle: 'Facture ascenseur',
        date: '2026-10-31',
        mandatId: 'M1',
        objetId: 'F1',
        assigneId: null,
        aConfirmer: false,
      },
    ])
  })
})

const saisieSinistre = (surcharge: Partial<SaisieSinistre> = {}): SaisieSinistre => ({
  coproprieteId: 'copro-1',
  type: 'Dégât des eaux',
  phase: null,
  dateSurvenance: '2026-10-20',
  dateConnaissance: null,
  dateDeclaration: null,
  dateExpertise: null,
  dateRapport: null,
  dateReglement: null,
  dateCloture: null,
  partiesCommunesLesees: true,
  partiesCommunesResponsables: false,
  origine: 'Fuite sur colonne d’eau froide',
  lieu: 'Cage B',
  dommages: 'Plafond du palier',
  assurance: { compagnie: null, courtier: null, contrat: null, numeroSinistre: null },
  indemniteImmediateCentimes: 0,
  indemniteImmediateReglee: false,
  indemniteDiffereeCentimes: 0,
  indemniteDiffereeReglee: false,
  causesSupprimees: false,
  reparationsFaites: false,
  ...surcharge,
})

const equipement = (surcharge: Partial<FicheEquipement> = {}): FicheEquipement => ({
  nature: 'Porte de garage',
  famille: 'Accès',
  garantie: { debut: '2025-11-15', dureeMois: 12 },
  entretien: { periodiciteMois: 6, dernier: '2026-05-10' },
  remplacement: { miseEnService: '2006-01-01', periodiciteMois: 240 },
  ...surcharge,
})

describe('sources — sinistres, équipements, diagnostics', () => {
  it('sinistre non déclaré : repère de déclaration ; en cours : prescription — deux repères à confirmer', () => {
    const fiche = creerSinistre(saisieSinistre())
    const reperes = reperesDelaisSinistre(fiche)
    expect(depuisSinistres([{ id: 'S1', mandatId: 'M1', libelle: 'Dégât des eaux', fiche }])).toEqual([
      {
        id: 'sinistres:S1:a_declarer',
        famille: 'sinistres',
        nature: 'a_declarer',
        libelle: 'Dégât des eaux',
        date: reperes.declarationAuPlusTard,
        mandatId: 'M1',
        objetId: 'S1',
        assigneId: null,
        aConfirmer: true,
      },
      expect.objectContaining({ id: 'sinistres:S1:prescription', nature: 'prescription', date: reperes.prescription, aConfirmer: true }),
    ])
    const declare = creerSinistre(saisieSinistre({ dateDeclaration: '2026-10-21' }))
    expect(ids(depuisSinistres([{ id: 'S2', mandatId: 'M1', libelle: 'x', fiche: declare }]))).toEqual(['sinistres:S2:prescription'])
    const clos = creerSinistre(saisieSinistre({ dateDeclaration: '2026-10-21', dateCloture: '2026-10-25' }))
    expect(depuisSinistres([{ id: 'S3', mandatId: 'M1', libelle: 'x', fiche: clos }])).toEqual([])
  })

  it('équipement : remplacement et révision, même dépassés ; fin de garantie seulement si elle est à venir', () => {
    expect(depuisEquipements([{ id: 'EQ1', mandatId: 'M1', libelle: 'Porte de garage', fiche: equipement() }], AUJOURDHUI)).toEqual([
      {
        id: 'equipements:EQ1:a_remplacer',
        famille: 'equipements',
        nature: 'a_remplacer',
        libelle: 'Porte de garage',
        date: '2026-01-01',
        mandatId: 'M1',
        objetId: 'EQ1',
        assigneId: null,
        aConfirmer: false,
      },
      expect.objectContaining({ id: 'equipements:EQ1:a_reviser', date: '2026-11-10' }),
      expect.objectContaining({ id: 'equipements:EQ1:fin_garantie', date: '2026-11-15' }),
    ])
    const garantieEchue = equipement({ garantie: { debut: '2024-01-01', dureeMois: 12 }, entretien: null, remplacement: null })
    expect(depuisEquipements([{ id: 'EQ2', mandatId: 'M1', libelle: 'x', fiche: garantieEchue }], AUJOURDHUI)).toEqual([])
  })

  it('diagnostic : à renouveler à la fin de sa validité, même dépassée ; sans validité : rien', () => {
    expect(
      depuisDiagnostics(
        [
          {
            mandatId: 'M1',
            immeubleId: 'I1',
            diagnostics: [
              { famille: 'amiante_pc', typeDocument: 'Dossier technique amiante', date: '2023-05-30', validite: '2026-12-01' },
              { famille: 'plomb', typeDocument: 'CREP', date: '2020-01-10', validite: null },
              { famille: 'plomb', typeDocument: 'Diagnostic plomb', date: '2015-01-10', validite: '2025-01-10' },
            ],
          },
        ],
        AUJOURDHUI,
      ),
    ).toEqual([
      {
        id: 'diagnostics:M1:I1:plomb:Diagnostic plomb',
        famille: 'diagnostics',
        nature: 'a_renouveler',
        libelle: 'Diagnostic plomb',
        date: '2025-01-10',
        mandatId: 'M1',
        objetId: 'I1',
        assigneId: null,
        aConfirmer: false,
      },
      expect.objectContaining({ id: 'diagnostics:M1:I1:amiante_pc:Dossier technique amiante', date: '2026-12-01' }),
    ])
  })

  it('diagnostics : deux immeubles d’un même mandat gardent chacun leur échéance', () => {
    const dta = (validite: string): Diagnostic[] => [{ famille: 'amiante_pc', typeDocument: 'DTA', date: '2023-05-30', validite }]
    const elements = depuisDiagnostics(
      [
        { mandatId: 'M1', immeubleId: 'I1', diagnostics: dta('2026-10-01') },
        { mandatId: 'M1', immeubleId: 'I2', diagnostics: dta('2026-12-01') },
      ],
      AUJOURDHUI,
    )
    const reglage: ReglageSuivi = {
      collaborateurId: 'u1',
      familles: { diagnostics: { actif: true, perimetre: 'portefeuille', horizon: { nombre: 3, unite: 'mois' }, natures: null } },
    }
    expect(ids(selectionnerAFaire(elements, reglage, affectations, AUJOURDHUI))).toEqual([
      'diagnostics:M1:I1:amiante_pc:DTA',
      'diagnostics:M1:I2:amiante_pc:DTA',
    ])
  })
})

const dossier = (id: string, mandatId: string | null, ouvertLe: string, surcharge: Partial<DossierOuvert> = {}): DossierOuvert => ({
  id,
  mandatId,
  ouvertLe,
  closLe: null,
  responsableFicheId: null,
  ...surcharge,
})

describe('balance âgée des dossiers ouverts', () => {
  const dossiers = [
    dossier('D1', 'M1', '2026-10-10'),
    dossier('D2', 'M1', '2026-09-27'),
    dossier('D3', 'M1', '2026-08-26'),
    dossier('D4', 'M1', '2025-01-01'),
    dossier('D5', 'M1', '2026-05-01', { closLe: '2026-06-01' }),
    dossier('D6', 'M1', '2026-11-01'),
    dossier('D7', 'M2', '2026-10-01', { closLe: '2026-10-28' }),
    dossier('D8', 'M3', '2026-10-01'),
  ]

  it('par responsable du mandat, en tranches mensuelles ; « tous » compte aussi les dossiers clos ; un dossier ouvert après la date est ignoré', () => {
    expect(balanceAgee(dossiers, affectations, { rattachement: 'responsable', periodicite: 'mensuelle', dateReference: AUJOURDHUI })).toEqual({
      libellesTranches: ['< 1 mois', 'de 1 à 2 mois', 'de 2 à 3 mois', '> 3 mois'],
      lignes: [
        { cabinetId: 'C1', collaborateurId: 'u1', tous: 5, enCours: 4, tranches: [1, 1, 1, 1] },
        { cabinetId: 'C1', collaborateurId: 'u2', tous: 1, enCours: 1, tranches: [1, 0, 0, 0] },
        { cabinetId: 'C2', collaborateurId: 'u4', tous: 1, enCours: 1, tranches: [1, 0, 0, 0] },
      ],
      sousTotaux: [
        { cabinetId: 'C1', tous: 6, enCours: 5, tranches: [2, 1, 1, 1] },
        { cabinetId: 'C2', tous: 1, enCours: 1, tranches: [1, 0, 0, 0] },
      ],
      total: { tous: 7, enCours: 6, tranches: [3, 1, 1, 1] },
    })
  })

  it('autres rattachements : comptable du mandat, responsable de la fiche ; sans titulaire : ligne non affectée, en dernier', () => {
    const parComptable = balanceAgee(dossiers, affectations, { rattachement: 'comptable', periodicite: 'mensuelle', dateReference: AUJOURDHUI })
    expect(parComptable.lignes.map((l) => [l.cabinetId, l.collaborateurId, l.tous, l.enCours])).toEqual([
      ['C1', 'u3', 6, 5],
      ['C2', null, 1, 1],
    ])
    const fiches = [
      dossier('F1', 'M1', '2026-10-10', { responsableFicheId: 'u9' }),
      dossier('F2', 'M9', '2026-10-10', { responsableFicheId: 'u9' }),
      dossier('F3', 'M1', '2026-10-10'),
    ]
    const parFiche = balanceAgee(fiches, affectations, { rattachement: 'responsable_fiche', periodicite: 'mensuelle', dateReference: AUJOURDHUI })
    expect(parFiche.lignes.map((l) => [l.cabinetId, l.collaborateurId, l.enCours])).toEqual([
      ['C1', 'u9', 1],
      ['C1', null, 1],
      [null, 'u9', 1],
    ])
  })

  it('périodicités : sur 30 jours, au trimestre, à l’année', () => {
    const tranches = (periodicite: 'trente_jours' | 'trimestre' | 'annee', dates: string[]) =>
      balanceAgee(
        dates.map((d, i) => dossier(`P${i}`, 'M1', d)),
        affectations,
        { rattachement: 'responsable', periodicite, dateReference: AUJOURDHUI },
      )
    const trente = tranches('trente_jours', ['2026-09-27', '2026-09-28', '2026-07-29'])
    expect(trente.total.tranches).toEqual([1, 1, 0, 1])
    expect(trente.libellesTranches).toEqual(['< 30 jours', 'de 30 à 60 jours', 'de 60 à 90 jours', '> 90 jours'])
    expect(tranches('trimestre', ['2026-07-27', '2026-07-28']).total.tranches).toEqual([1, 1, 0, 0])
    expect(tranches('annee', ['2025-10-27', '2023-01-01', '2026-01-01']).total.tranches).toEqual([1, 1, 0, 1])
  })

  it('choix des cabinets ; refuse des dates invalides ou une clôture avant l’ouverture', () => {
    const c2 = balanceAgee(dossiers, affectations, { rattachement: 'responsable', periodicite: 'mensuelle', dateReference: AUJOURDHUI, cabinets: ['C2'] })
    expect(c2.lignes.map((l) => l.collaborateurId)).toEqual(['u4'])
    expect(c2.total).toEqual({ tous: 1, enCours: 1, tranches: [1, 0, 0, 0] })
    expect(() => balanceAgee(dossiers, affectations, { rattachement: 'responsable', periodicite: 'mensuelle', dateReference: '2026-02-30' })).toThrow(/date/i)
    expect(() =>
      balanceAgee([dossier('X', 'M1', '2026-10-10', { closLe: '2026-10-01' })], affectations, {
        rattachement: 'responsable',
        periodicite: 'mensuelle',
        dateReference: AUJOURDHUI,
      }),
    ).toThrow(/clôture/i)
  })
})
