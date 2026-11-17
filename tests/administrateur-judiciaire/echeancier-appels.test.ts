import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  annulerAppelees,
  annulerAvantAppel,
  echeancesAAppeler,
  fixerRegroupement,
  fixerRelancable,
  marquerAppelees,
  marquerEnvoyees,
  mettreEnAttente,
  postesARelancer,
  postesImputables,
  reprendreEcheance,
  suivreEcheances,
  type EcheanceAppelSuivie,
} from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import { creerCompteCoproprietaire, creerPosition } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { postesDepuisAvis, type PosteDette } from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import { avisDAppel, creerCleRepartition, traitementAppelDeFonds, type EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import { annulerTraitement, creerTraitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Échéancier des appels : statut, traitement, date d'envoi, relançable, regroupement (point 16 du bilan 2 ; Gestéam,
 * tranche 30 § Échéancier des appels — fiche : Statut, Traitement, Suivi « Envoyé le · Relançable · Regroupement (n) » ;
 * montants négatifs = régularisations ; tranche 43 § 23 : statuts Appelé · Prévu · Annulé · En attente, montants
 * négatifs = annulations). Les producteurs
 * d'échéances (budget, travaux, fonds de travaux) restent intacts : le suivi s'ajoute à part (suivreEcheances).
 */

const SEGMENT = 'TILL'
const cle = creerCleRepartition({
  id: 'cle-001',
  coproprieteId: 'copro-1',
  code: '001',
  libelle: 'Charges communes générales',
  lots: [
    { lotId: 'lot-1', tantiemes: 400 },
    { lotId: 'lot-2', tantiemes: 600 },
  ],
})
const comptes = [
  creerCompteCoproprietaire({ id: 'cpt-A', coproprieteId: 'copro-1', serie: '1', libelle: 'A' }),
  creerCompteCoproprietaire({ id: 'cpt-B', coproprieteId: 'copro-1', serie: '2', libelle: 'B' }),
]
const position = (id: string, lotId: string, compteId: string) =>
  creerPosition({ id, identiteId: `i-${id}`, lotId, compteId, qualite: 'Copropriétaire', part: { numerateur: 1, denominateur: 1 }, statut: 'En place', dateEntree: '2020-01-01', dateSortie: null })
const positions = [position('p1', 'lot-1', 'cpt-A'), position('p2', 'lot-2', 'cpt-B')]

const ECHEANCES: EcheanceAppel[] = [
  { id: 'B-2026-1', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-01-01', libelle: 'Budget 2026 — provision 1/4', montantCentimes: 100_000, nature: 'budget' },
  { id: 'FT-2026-1', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-01-01', libelle: 'Fonds de travaux 2026 — appel n° 1', montantCentimes: 5_000, nature: 'fonds_travaux' },
  { id: 'B-2026-2', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-04-01', libelle: 'Budget 2026 — provision 2/4', montantCentimes: 100_000, nature: 'budget' },
  { id: '00042-T1', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-05-01', libelle: 'Ravalement — appel n° 1', montantCentimes: 30_000, nature: 'travaux' },
]

/** Tranche de travaux entièrement financée par le fonds de travaux : échéance à 0 c, aucune ligne écrite. */
const TRANCHE_FINANCEE: EcheanceAppel = {
  id: '00043-T1',
  coproprieteId: 'copro-1',
  cleId: 'cle-001',
  exigibilite: '2026-01-01',
  libelle: 'Toiture — appel n° 1 (100 %)',
  montantCentimes: 0,
  nature: 'travaux',
  compteContrepartie: '70200',
}

const suivies = () => suivreEcheances(ECHEANCES)

/** Appel réel : avis, écriture « Appel de fonds » (repartition-appels.ts), puis suivi des échéances appelées. */
function appeler(echeances: EcheanceAppelSuivie[], id: string) {
  const avis = avisDAppel({ echeances, cles: [cle], positions, comptes })
  const traitement = traitementAppelDeFonds(avis, { id, date: '2025-12-20', segmentSyndicat: SEGMENT, comptes })
  return { avis, traitement, echeances: marquerAppelees(echeances, traitement, avis) }
}

describe('suivi des échéances d’appel', () => {
  it('pose le suivi par défaut (Prévu, relançable) sans toucher aux échéances des producteurs', () => {
    const [premiere] = suivies()
    expect(premiere).toEqual({
      ...ECHEANCES[0],
      statut: 'Prévu',
      traitementId: null,
      annulationTraitementId: null,
      motifAttente: null,
      regroupement: null,
      relancable: true,
      envoyeLe: null,
      echeancesDeLAppel: [],
    })
    expect(ECHEANCES[0]).not.toHaveProperty('statut')
    expect(suivreEcheances(ECHEANCES, { relancable: false }).every((e) => e.relancable === false)).toBe(true)
  })

  it('refuse un identifiant en double, une date invalide, un montant négatif, une échéance déjà suivie', () => {
    expect(() => suivreEcheances([ECHEANCES[0], ECHEANCES[0]])).toThrow(/en double/)
    expect(() => suivreEcheances([{ ...ECHEANCES[0], exigibilite: '01/01/2026' }])).toThrow(/AAAA-MM-JJ/)
    expect(() => suivreEcheances([{ ...ECHEANCES[0], montantCentimes: -100_000 }])).toThrow(/écriture contraire/)
    expect(() => suivreEcheances([{ ...ECHEANCES[0], montantCentimes: -100_000 }])).toThrow(
      /une régularisation négative \(Gestéam « REGUL CH\. », « SOLDE AU »\) passe par la répartition des charges \(point 25\)/,
    )
    expect(() => suivreEcheances([{ ...ECHEANCES[0], montantCentimes: 10.5 }])).toThrow(/centimes entiers/)
    expect(() => suivreEcheances(suivies())).toThrow(/déjà suivie/)
  })
})

describe('statuts avant l’appel : Prévu, En attente, Annulé', () => {
  it('mise en attente avec motif, reprise, annulation sans écriture', () => {
    const [b1] = suivies()
    const attente = mettreEnAttente(b1, '  Délai de contestation de l’assemblée  ')
    expect(attente).toMatchObject({ statut: 'En attente', motifAttente: 'Délai de contestation de l’assemblée' })
    expect(reprendreEcheance(attente)).toMatchObject({ statut: 'Prévu', motifAttente: null })
    expect(annulerAvantAppel(b1)).toMatchObject({ statut: 'Annulé', traitementId: null, annulationTraitementId: null })
    expect(annulerAvantAppel(attente)).toMatchObject({ statut: 'Annulé', motifAttente: 'Délai de contestation de l’assemblée' })
    expect(b1.statut).toBe('Prévu')
  })

  it('refuse une mise en attente sans motif, et toute transition hors du cycle', () => {
    const [b1, ft1] = suivies()
    expect(() => mettreEnAttente(b1, '   ')).toThrow(/motif/)
    expect(() => reprendreEcheance(b1)).toThrow(/« Prévu » → « Prévu »/)
    const [appelee] = appeler([ft1], 't-appel-1').echeances
    expect(() => reprendreEcheance(appelee)).toThrow(/« Appelé » → « Prévu »/)
    expect(() => mettreEnAttente(appelee, 'motif')).toThrow(/« Appelé » → « En attente »/)
    expect(() => annulerAvantAppel(appelee)).toThrow(/écriture contraire/)
    const annulee = annulerAvantAppel(b1)
    expect(() => reprendreEcheance(annulee)).toThrow(/« Annulé » → « Prévu »/)
    expect(() => annulerAvantAppel(annulee)).toThrow(/« Annulé » → « Annulé »/)
  })
})

describe('échéances à appeler, puis appelées par un traitement « Appel de fonds »', () => {
  it('ne retient que les échéances « Prévu » exigibles au plus tard à l’horizon, par exigibilité puis identifiant', () => {
    const [b1, ft1, b2, t1] = suivies()
    const liste = [t1, b2, mettreEnAttente(ft1, 'Décision à confirmer'), b1, annulerAvantAppel({ ...b1, id: 'B-2026-X' })]
    expect(echeancesAAppeler(liste, { jusquAu: '2026-04-01' }).map((e) => e.id)).toEqual(['B-2026-1', 'B-2026-2'])
    expect(echeancesAAppeler([b2, ft1, b1], { jusquAu: '2026-01-01' }).map((e) => e.id)).toEqual(['B-2026-1', 'FT-2026-1'])
    expect(() => echeancesAAppeler(liste, { jusquAu: '2026-13-01' })).toThrow(/AAAA-MM-JJ/)
  })

  it('l’appel écrit passe les échéances « Appelé » avec son traitement ; l’avis se bâtit sur la liste suivie', () => {
    const [b1, ft1, b2] = suivies()
    const aAppeler = echeancesAAppeler([b1, ft1, b2], { jusquAu: '2026-01-01' })
    const { traitement, echeances } = appeler(aAppeler, 't-appel-1')
    expect(echeances.map((e) => [e.id, e.statut, e.traitementId])).toEqual([
      ['B-2026-1', 'Appelé', 't-appel-1'],
      ['FT-2026-1', 'Appelé', 't-appel-1'],
    ])
    expect(echeances[0]).toEqual({ ...b1, statut: 'Appelé', traitementId: 't-appel-1', echeancesDeLAppel: ['B-2026-1', 'FT-2026-1'] })
    expect(traitement.mouvements.filter((m) => m.sens === 'credit').reduce((s, m) => s + m.montantCentimes, 0)).toBe(105_000)
  })

  it('refuse un autre traitement, une liste sans les échéances de l’avis, une échéance non « Prévu », plusieurs syndicats', () => {
    const [b1, ft1] = suivies()
    const { traitement, avis } = appeler([b1, ft1], 't-appel-1')
    const encaissement = creerTraitement({
      id: 't-enc',
      famille: 'Encaissement',
      date: '2026-01-10',
      mouvements: [
        { compte: 'TILL.51200.00000.0', sens: 'debit', montantCentimes: 105_000 },
        { compte: 'TILL.45000.00001.0', sens: 'credit', montantCentimes: 105_000 },
      ],
    })
    expect(() => marquerAppelees([b1, ft1], encaissement, avis)).toThrow(/« Appel de fonds »/)
    expect(() => marquerAppelees([b1], traitement, avis)).toThrow(/Appel t-appel-1 : échéance\(s\) FT-2026-1 de l'avis absente\(s\) de la liste ; passer la liste complète/)
    expect(() => marquerAppelees([], traitement, avis)).toThrow(/B-2026-1, FT-2026-1 de l'avis absente\(s\)/)
    expect(() => marquerAppelees([b1, ft1], traitement, { ...avis, echeances: [] })).toThrow(/aucune échéance dans l'avis/)
    expect(() => marquerAppelees([b1, b1], traitement, avis)).toThrow(/en double/)
    expect(() => marquerAppelees([b1, mettreEnAttente(ft1, 'motif')], traitement, avis)).toThrow(/la reprendre/)
    const autreAppel = traitementAppelDeFonds(avis, { id: 't-appel-2', date: '2025-12-20', segmentSyndicat: SEGMENT, comptes })
    expect(() => marquerAppelees(marquerAppelees([b1, ft1], traitement, avis), autreAppel, avis)).toThrow(/« Appelé » → « Appelé »/)
    expect(() => marquerAppelees([b1, { ...ft1, coproprieteId: 'copro-2' }], traitement, avis)).toThrow(/plusieurs syndicats/)
    expect(() => marquerAppelees([b1, annulerAvantAppel(ft1)], traitement, avis)).toThrow(/« Annulé » → « Appelé »/)
  })

  it('refuse des échéances de même total qui ne sont pas celles de l’avis de l’appel (provisions égales d’un autre trimestre)', () => {
    const [b1, , b2] = suivies()
    const { traitement, avis } = appeler([b1], 't-appel-1')
    expect(b2.montantCentimes).toBe(b1.montantCentimes)
    expect(() => marquerAppelees([b2], traitement, avis)).toThrow(/Appel t-appel-1 : échéance\(s\) B-2026-1 de l'avis absente\(s\) de la liste/)
    expect(() => marquerAppelees([{ ...b1, montantCentimes: 99_999 }], traitement, avis)).toThrow(/B-2026-1 : 99999 centimes, l'avis porte 100000/)
  })

  it('travaille sur la liste complète des échéances suivies : seules celles de l’avis passent « Appelé », avec la composition de l’appel', () => {
    const [b1, ft1, b2, t1] = suivies()
    const avis = avisDAppel({ echeances: [b1, ft1], cles: [cle], positions, comptes })
    const traitement = traitementAppelDeFonds(avis, { id: 't-appel-1', date: '2025-12-20', segmentSyndicat: SEGMENT, comptes })
    const resultat = marquerAppelees([t1, b1, b2, ft1], traitement, avis)
    expect(resultat.map((e) => [e.id, e.statut, e.traitementId, e.echeancesDeLAppel])).toEqual([
      ['00042-T1', 'Prévu', null, []],
      ['B-2026-1', 'Appelé', 't-appel-1', ['B-2026-1', 'FT-2026-1']],
      ['B-2026-2', 'Prévu', null, []],
      ['FT-2026-1', 'Appelé', 't-appel-1', ['B-2026-1', 'FT-2026-1']],
    ])
    expect(resultat[0]).toBe(t1)
    expect(resultat[2]).toBe(b2)
  })

  it('un traitement n’appelle qu’un lot : il ne marque pas ensuite l’avis de même forme d’un autre trimestre (débits et crédits identiques)', () => {
    const [b1, , b2] = suivies()
    const avis1 = avisDAppel({ echeances: [b1], cles: [cle], positions, comptes })
    const avis2 = avisDAppel({ echeances: [b2], cles: [cle], positions, comptes })
    const t1 = traitementAppelDeFonds(avis1, { id: 't-appel-1', date: '2025-12-20', segmentSyndicat: SEGMENT, comptes })
    const liste = marquerAppelees([b1, b2], t1, avis1)
    expect(liste.map((e) => [e.id, e.statut, e.traitementId])).toEqual([
      ['B-2026-1', 'Appelé', 't-appel-1'],
      ['B-2026-2', 'Prévu', null],
    ])
    expect(() => marquerAppelees(liste, t1, avis2)).toThrow(
      /Appel t-appel-1 : il a déjà appelé B-2026-1 ; un traitement n'appelle qu'un lot d'échéances \(celles de son avis\), une seule fois/,
    )
    expect(() => marquerAppelees(annulerAppelees(liste, annulerTraitement(t1, { id: 't-annul-1', date: '2026-01-15' }), postesDepuisAvis(avis1)), t1, avis2)).toThrow(
      /il a déjà appelé B-2026-1/,
    )
    // Liste incomplète au marquage (sans B-2026-1) : invisible à ce moment, la composition retenue le signale ensuite.
    const [b2MarqueSeul] = marquerAppelees([b2], t1, avis2)
    const marquees = [liste[0], b2MarqueSeul]
    const postes = [...postesDepuisAvis(avis1), ...postesDepuisAvis(avis2)]
    expect(() => postesImputables(postes, marquees)).toThrow(/Appel t-appel-1 : échéances marquées sur deux avis \(B-2026-1 \| B-2026-2\)/)
    expect(() => postesARelancer(postes, marquees, { le: '2026-06-01' })).toThrow(/deux avis/)
    expect(() => annulerAppelees(marquees, annulerTraitement(t1, { id: 't-annul-1', date: '2026-01-15' }), postes)).toThrow(/deux avis/)
  })

  it('refuse une échéance appelée qui ne retient pas la composition de son appel', () => {
    const [b1] = suivies()
    const sansComposition: EcheanceAppelSuivie = { ...b1, statut: 'Appelé', traitementId: 't-appel-1' }
    expect(() => postesImputables([], [sansComposition])).toThrow(/Échéance « B-2026-1 » appelée par t-appel-1 sans la composition de son appel/)
  })

  it('refuse un avis qui n’est pas celui du traitement : autre compte de contrepartie, autres débits des comptes 450', () => {
    const [, ft1] = suivies()
    const avisFonds = avisDAppel({ echeances: [ft1], cles: [cle], positions, comptes })
    const enBudget = { ...ft1, nature: 'budget' as const, compteContrepartie: '70100' }
    const ecritEnBudget = traitementAppelDeFonds(avisDAppel({ echeances: [enBudget], cles: [cle], positions, comptes }), {
      id: 't-autre',
      date: '2025-12-20',
      segmentSyndicat: SEGMENT,
      comptes,
    })
    expect(() => marquerAppelees([ft1], ecritEnBudget, avisFonds)).toThrow(/Appel t-autre : contrepartie 10500 : 0 centimes crédités, l'avis en appelle 5000/)
    const unSeulCompte = [position('p1', 'lot-1', 'cpt-A'), position('p2', 'lot-2', 'cpt-A')]
    const autreRepartition = traitementAppelDeFonds(avisDAppel({ echeances: [ft1], cles: [cle], positions: unSeulCompte, comptes }), {
      id: 't-autre',
      date: '2025-12-20',
      segmentSyndicat: SEGMENT,
      comptes,
    })
    expect(() => marquerAppelees([ft1], autreRepartition, avisFonds)).toThrow(/Appel t-autre : débits des comptes 450 \(5000\) autres que ceux de l'avis \(2000, 3000\)/)
  })

  it('une échéance à 0 c (tranche entièrement financée par le fonds de travaux) s’appelle avec les autres sans bloquer l’écriture ; seule, elle attend', () => {
    const [b1] = suivies()
    const [t0] = suivreEcheances([TRANCHE_FINANCEE])
    const aAppeler = echeancesAAppeler([b1, t0], { jusquAu: '2026-01-31' })
    expect(aAppeler.map((e) => e.id)).toEqual(['00043-T1', 'B-2026-1'])
    const { traitement, echeances } = appeler(aAppeler, 't-appel-1')
    expect(echeances.map((e) => [e.id, e.statut, e.traitementId])).toEqual([
      ['00043-T1', 'Appelé', 't-appel-1'],
      ['B-2026-1', 'Appelé', 't-appel-1'],
    ])
    expect(traitement.mouvements.map((m) => m.compte)).not.toContain('TILL.70200.00000.0')
    expect(echeancesAAppeler([t0], { jusquAu: '2026-01-31' })).toEqual([])
  })
})

describe('annulation d’un appel : écriture contraire (arrêté du 14 mars 2005, art. 5), jamais d’échéance négative', () => {
  it('toutes les échéances du traitement annulé passent « Annulé » ; les autres sont inchangées', () => {
    const [b1, ft1, b2] = suivies()
    const { traitement, echeances: appelees } = appeler([b1, ft1], 't-appel-1')
    const annulation = annulerTraitement(traitement, { id: 't-annul-1', date: '2026-01-15' })
    const postes = postesDepuisAvis(avisDAppel({ echeances: appelees, cles: [cle], positions, comptes }))
    const resultat = annulerAppelees([...appelees, b2], annulation, postes)
    expect(resultat.map((e) => [e.id, e.statut, e.traitementId, e.annulationTraitementId])).toEqual([
      ['B-2026-1', 'Annulé', 't-appel-1', 't-annul-1'],
      ['FT-2026-1', 'Annulé', 't-appel-1', 't-annul-1'],
      ['B-2026-2', 'Prévu', null, null],
    ])
    expect(resultat[2]).toBe(b2)
    expect(resultat.every((e) => e.montantCentimes >= 0)).toBe(true)
  })

  it('refuse une autre famille, une annulation sans appel, une partie seulement de l’appel, un poste déjà réglé, une double annulation', () => {
    const [b1, ft1, b2] = suivies()
    const { traitement, echeances: appelees } = appeler([b1, ft1], 't-appel-1')
    const annulation = annulerTraitement(traitement, { id: 't-annul-1', date: '2026-01-15' })
    const postes = postesDepuisAvis(avisDAppel({ echeances: appelees, cles: [cle], positions, comptes }))
    const encaissement = creerTraitement({
      id: 't-enc',
      famille: 'Encaissement',
      date: '2026-01-10',
      mouvements: [
        { compte: 'TILL.51200.00000.0', sens: 'debit', montantCentimes: 1_000 },
        { compte: 'TILL.45000.00001.0', sens: 'credit', montantCentimes: 1_000 },
      ],
    })
    expect(() => annulerAppelees(appelees, annulerTraitement(encaissement, { id: 't-x', date: '2026-01-15' }), postes)).toThrow(/« Annulation d'appel de fonds »/)
    const sansAppel = creerTraitement({ ...annulation, mouvements: annulation.mouvements, annule: undefined })
    expect(() => annulerAppelees(appelees, sansAppel, postes)).toThrow(/aucun appel/)
    expect(() => annulerAppelees([appelees[0]], annulation, postes)).toThrow(/échéance\(s\) FT-2026-1 de l'appel t-appel-1 absente\(s\) de la liste/)
    expect(() => annulerAppelees([b2], annulation, postes)).toThrow(/aucune échéance de l'appel t-appel-1/)
    const regle = postes.map((p): PosteDette => (p.id === 'B-2026-1:lot-1' ? { ...p, regleCentimes: 10_000 } : p))
    expect(() => annulerAppelees(appelees, annulation, regle)).toThrow(/B-2026-1:lot-1.*réglé/)
    const annulees = annulerAppelees(appelees, annulation, postes)
    expect(() => annulerAppelees(annulees, annulation, postes)).toThrow(/déjà annulée par t-annul-1/)
  })

  it('exige toute la composition de l’appel, l’échéance à 0 c comprise : elle ne reste jamais « Appelé » d’un appel annulé', () => {
    const [b1, , b2] = suivies()
    const [t0] = suivreEcheances([TRANCHE_FINANCEE])
    const { traitement, avis, echeances: appelees } = appeler(echeancesAAppeler([b1, t0], { jusquAu: '2026-01-31' }), 't-appel-1')
    const annulation = annulerTraitement(traitement, { id: 't-annul-1', date: '2026-01-15' })
    const postes = postesDepuisAvis(avis)
    const sansTranche = [...appelees.filter((e) => e.id !== '00043-T1'), b2]
    expect(() => annulerAppelees(sansTranche, annulation, postes)).toThrow(
      /Annulation t-annul-1 : échéance\(s\) 00043-T1 de l'appel t-appel-1 absente\(s\) de la liste ; .*une échéance à 0 centime n'apparaît pas dans l'écriture/,
    )
    expect(annulerAppelees([...appelees, b2], annulation, postes).map((e) => [e.id, e.statut, e.annulationTraitementId])).toEqual([
      ['00043-T1', 'Annulé', 't-annul-1'],
      ['B-2026-1', 'Annulé', 't-annul-1'],
      ['B-2026-2', 'Prévu', null],
    ])
  })
})

describe('suivi de l’appel : envoyé le, relançable, regroupement', () => {
  it('date d’envoi : échéance appelée seulement, une seule date, idempotente', () => {
    const [b1, ft1, b2] = suivies()
    const { echeances: appelees } = appeler([b1, ft1], 't-appel-1')
    const envoyees = marquerEnvoyees(appelees, { ids: ['B-2026-1'], le: '2025-12-22' })
    expect(envoyees.map((e) => e.envoyeLe)).toEqual(['2025-12-22', null])
    expect(marquerEnvoyees(envoyees, { ids: ['B-2026-1'], le: '2025-12-22' })).toEqual(envoyees)
    expect(() => marquerEnvoyees(envoyees, { ids: ['B-2026-1'], le: '2025-12-23' })).toThrow(/déjà envoyée le 2025-12-22/)
    expect(() => marquerEnvoyees([b2], { ids: ['B-2026-2'], le: '2025-12-22' })).toThrow(/« Prévu »/)
    expect(() => marquerEnvoyees(appelees, { ids: ['inconnue'], le: '2025-12-22' })).toThrow(/inconnue/)
    expect(() => marquerEnvoyees(appelees, { ids: ['B-2026-1', 'B-2026-1'], le: '2025-12-22' })).toThrow(/en double/)
    expect(() => marquerEnvoyees(appelees, { ids: ['B-2026-1'], le: '22/12/2025' })).toThrow(/AAAA-MM-JJ/)
  })

  it('regroupement : entier ≥ 1 ou aucun ; relançable : oui ou non ; une échéance annulée ne se modifie plus', () => {
    const [b1] = suivies()
    expect(fixerRegroupement(b1, 3).regroupement).toBe(3)
    expect(fixerRegroupement(fixerRegroupement(b1, 3), null).regroupement).toBeNull()
    expect(() => fixerRegroupement(b1, 0)).toThrow(/entier ≥ 1/)
    expect(() => fixerRegroupement(b1, 1.5)).toThrow(/entier ≥ 1/)
    expect(fixerRelancable(b1, false).relancable).toBe(false)
    const annulee = annulerAvantAppel(b1)
    expect(() => fixerRegroupement(annulee, 2)).toThrow(/annulée/)
    expect(() => fixerRelancable(annulee, false)).toThrow(/annulée/)
  })
})

describe('postes de terme selon le statut de leur échéance', () => {
  const sansAppel: PosteDette = {
    id: 'reprise-A',
    compteId: 'cpt-A',
    appelId: null,
    typeAppel: null,
    libelle: 'Reprise de solde',
    exigibilite: '2025-10-01',
    montantCentimes: 7_000,
    regleCentimes: 0,
    contentieux: false,
  }

  function scenario() {
    const [b1, ft1, b2, t1] = suivies()
    const premier = appeler([b1, ft1], 't-appel-1')
    const second = appeler([b2], 't-appel-2')
    const postes = [
      ...postesDepuisAvis(premier.avis),
      ...postesDepuisAvis(avisDAppel({ echeances: second.echeances, cles: [cle], positions, comptes })),
      sansAppel,
    ]
    const annulation = annulerTraitement(premier.traitement, { id: 't-annul-1', date: '2026-01-15' })
    const echeances = [...annulerAppelees(premier.echeances, annulation, postes), ...second.echeances, t1]
    return { postes, echeances }
  }

  it('postes imputables : ceux des échéances appelées et les dettes sans appel ; jamais ceux d’un appel annulé', () => {
    const { postes, echeances } = scenario()
    expect(postesImputables(postes, echeances).map((p) => p.id)).toEqual(['B-2026-2:lot-1', 'B-2026-2:lot-2', 'reprise-A'])
  })

  it('refuse un poste dont l’échéance est inconnue, pas appelée, ou annulée alors qu’il est réglé', () => {
    const { postes, echeances } = scenario()
    const poste = postes[0]
    expect(() => postesImputables([{ ...poste, appelId: 'X' }], echeances)).toThrow(/inconnue/)
    expect(() => postesImputables([{ ...poste, appelId: '00042-T1' }], echeances)).toThrow(/pas appelée/)
    expect(() => postesImputables([{ ...poste, regleCentimes: 1_000 }], echeances)).toThrow(/annulé.*réglé/)
  })

  it('postes à relancer : échus (exigibles avant le jour de la relance), non soldés, d’un appel émis et relançable', () => {
    const { postes, echeances } = scenario()
    const nonRelancable = echeances.map((e) => (e.id === 'B-2026-2' ? fixerRelancable(e, false) : e))
    const [b2lot1, b2lot2] = postes.filter((p) => p.appelId === 'B-2026-2')
    const candidats: PosteDette[] = [
      ...postes,
      { ...b2lot1, id: 'ctx', contentieux: true },
      { ...b2lot1, id: 'solde', regleCentimes: b2lot1.montantCentimes },
      { ...b2lot1, id: 'du-jour', exigibilite: '2026-04-15' },
      { ...b2lot1, id: 'orphelin', appelId: 'X' },
      { ...b2lot1, id: 'non-emis', appelId: '00042-T1', exigibilite: '2026-04-01' },
    ]
    expect(postesARelancer(candidats, echeances, { le: '2026-04-15' })).toEqual({
      relancables: [b2lot1, b2lot2, sansAppel],
      ecartes: [
        { posteId: 'B-2026-1:lot-1', motif: 'appel_annule' },
        { posteId: 'FT-2026-1:lot-1', motif: 'appel_annule' },
        { posteId: 'B-2026-1:lot-2', motif: 'appel_annule' },
        { posteId: 'FT-2026-1:lot-2', motif: 'appel_annule' },
        { posteId: 'ctx', motif: 'contentieux' },
        { posteId: 'orphelin', motif: 'echeance_inconnue' },
        { posteId: 'non-emis', motif: 'appel_non_emis' },
      ],
    })
    const sansRelance = postesARelancer(postes, nonRelancable, { le: '2026-04-15' })
    expect(sansRelance.relancables).toEqual([sansAppel])
    expect(sansRelance.ecartes.filter((e) => e.motif === 'non_relancable').map((e) => e.posteId)).toEqual(['B-2026-2:lot-1', 'B-2026-2:lot-2'])
    expect(() => postesARelancer(postes, echeances, { le: '15/04/2026' })).toThrow(/AAAA-MM-JJ/)
  })
})

describe('en-tête du module', () => {
  const SOURCE = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'echeancier-appels.ts'), 'utf8')
  const EN_TETE = SOURCE.slice(0, SOURCE.indexOf('*/')).replaceAll(/\s*\n\s*\*\s*/g, ' ')

  it('D. 2005-240 art. 3 cité mot pour mot : ce sont les sommes qui sont « enregistrées à la date d’exigibilité »', () => {
    expect(EN_TETE).toContain(
      "« sommes reçues ou à recevoir de chaque copropriétaire en vertu de l'obligation leur incombant, enregistrées à la date d'exigibilité »",
    )
    expect(EN_TETE).not.toContain('« enregistrés à la date')
  })

  it('montants négatifs de Gestéam : régularisations (tranche 30) ou annulations (tranche 43 § 23) ; la régularisation renvoyée au point 25', () => {
    expect(EN_TETE).toMatch(/tranche 30 § Échéancier des appels.*« REGUL CH\. … », « SOLDE AU … », montants négatifs = régularisations/)
    expect(EN_TETE).toMatch(/tranche 43 § 23 \(cotisations au fonds de travaux\).*montants négatifs = annulations/)
    expect(EN_TETE).toMatch(/🔴 Non établi.*"REGUL CH\.", "SOLDE AU".*répartition des charges \(point 25\)/)
    expect(EN_TETE).toMatch(/Non repris :.*régularisation.*\(point 25\)/)
  })

  it('le traitement ne porte pas l’identifiant des échéances : origine R8 non posée, liste complète, question 🔴 du débit 450 par échéance', () => {
    expect(EN_TETE).toMatch(/LigneMouvement\.origine \{ type: 'appel', appelId, typeAppel \}.*traitementAppelDeFonds ne la pose pas/)
    expect(EN_TETE).toMatch(/LISTE COMPLÈTE des échéances suivies/)
    expect(EN_TETE).toMatch(
      /🔴 Non établi.*« Faut-il, dans l'écriture de l'appel, un débit 450 par compte ET par échéance, portant son origine R8.*repartition-appels\.traitementAppelDeFonds.*»/,
    )
  })
})
