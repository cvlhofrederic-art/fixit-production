import { describe, expect, it } from 'vitest'
import { marquerAppelees, suivreEcheances, type EcheanceAppelSuivie } from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import { creerCompteCoproprietaire, creerPosition } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { creerPieceTraitement } from '@/lib/administrateur-judiciaire/domain/journal-traitements'
import {
  postesAppeles,
  postesDesComptes,
  soldesDesComptes,
  type DonneesPostes,
  type ImputationEcrite,
} from '@/lib/administrateur-judiciaire/domain/postes-comptes'
import { avisDAppel, creerCleRepartition, traitementAppelDeFonds, type EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'

/**
 * Postes des comptes copropriétaires relus de l'échéancier appelé et des encaissements (domain/postes-comptes.ts),
 * fonctions pures : dû recoupé avec l'écriture de l'appel, réglé tiré des lignes d'imputation des encaissements non
 * annulés, soldes par compte. Données fictives : lots 1 et 2 (600 et 400 millièmes), comptes cA et cB.
 */

const SEGMENT = 'TILL'
const cle = creerCleRepartition({
  id: 'cle-1',
  coproprieteId: 'C1',
  code: '001',
  libelle: 'Charges communes générales',
  lots: [
    { lotId: 'lot-1', tantiemes: 600 },
    { lotId: 'lot-2', tantiemes: 400 },
  ],
})
const comptes = [
  creerCompteCoproprietaire({ id: 'cA', coproprieteId: 'C1', serie: '1', libelle: 'Copropriétaire A (fictif)' }),
  creerCompteCoproprietaire({ id: 'cB', coproprieteId: 'C1', serie: '2', libelle: 'Copropriétaire B (fictif)' }),
]
const position = (id: string, lotId: string, compteId: string) =>
  creerPosition({ id, identiteId: `i-${id}`, lotId, compteId, qualite: 'Copropriétaire', part: { numerateur: 1, denominateur: 1 }, statut: 'En place', dateEntree: '2020-01-01', dateSortie: null })
const positions = [position('pA', 'lot-1', 'cA'), position('pB', 'lot-2', 'cB')]

const echeance = (id: string, exigibilite: string, montantCentimes: number, nature: EcheanceAppel['nature'] = 'budget'): EcheanceAppel => ({
  id,
  coproprieteId: 'C1',
  cleId: cle.id,
  exigibilite,
  libelle: `Appel ${id}`,
  montantCentimes,
  nature,
})

const EXERCICES = [{ nom: '2026', ouverture: '2026-01-01', cloture: '2026-12-31' }]

/** Écrit l'appel des échéances données (une pièce) et rend l'échéancier après, avec la pièce. */
function appeler(echeancier: EcheanceAppelSuivie[], ids: string[], numero: number) {
  const aAppeler = echeancier.filter((e) => ids.includes(e.id))
  const avis = avisDAppel({ echeances: aAppeler, cles: [cle], positions, comptes })
  const traitement = traitementAppelDeFonds(avis, { id: `appel-${numero}`, date: aAppeler[0].exigibilite, segmentSyndicat: SEGMENT, comptes })
  const piece = creerPieceTraitement({ traitement, numero, coproprieteId: 'C1', segmentSyndicat: SEGMENT, mandatId: 'M1', parametres: [] })
  return { echeancier: marquerAppelees(echeancier, traitement, avis, { exercices: EXERCICES }), piece }
}

const imputation = (lignes: ImputationEcrite['lignes'], resteAImputerCentimes = 0): ImputationEcrite => ({
  lignes,
  resteAImputerCentimes,
  designationsIgnorees: [],
  designationPartielleRefusee: false,
  imputerSurAVenir: false,
  sousComptes450: null,
})

/** Deux appels écrits : T1 (1 000,00 €, 01/01/2026) puis T2 (500,00 €) et fonds de travaux (100,00 €) au 01/04/2026. */
function donnees(encaissements: DonneesPostes['encaissements'] = []): DonneesPostes {
  const suivies = suivreEcheances([echeance('T1', '2026-01-01', 100_000), echeance('T2', '2026-04-01', 50_000), echeance('FT', '2026-04-01', 10_000, 'fonds_travaux')])
  const premier = appeler(suivies, ['T1'], 1)
  const second = appeler(premier.echeancier, ['T2', 'FT'], 2)
  return { echeances: second.echeancier, cles: [cle], positions, comptes, pieces: [premier.piece, second.piece], encaissements }
}

describe('postes des appels écrits', () => {
  it('un poste par échéance appelée et par lot, au compte redevable, recoupé avec chaque pièce d’appel', () => {
    const postes = postesAppeles(donnees())
    expect(postes.map((p) => [p.id, p.compteId, p.typeAppel, p.montantCentimes, p.regleCentimes])).toEqual([
      ['T1:lot-1', 'cA', 'Budget', 60_000, 0],
      ['FT:lot-1', 'cA', 'Fonds travaux', 6_000, 0],
      ['T2:lot-1', 'cA', 'Budget', 30_000, 0],
      ['T1:lot-2', 'cB', 'Budget', 40_000, 0],
      ['FT:lot-2', 'cB', 'Fonds travaux', 4_000, 0],
      ['T2:lot-2', 'cB', 'Budget', 20_000, 0],
    ])
  })

  it('aucune échéance appelée : aucun poste ; une échéance « Prévu » n’en a pas', () => {
    const d = donnees()
    const prevues = suivreEcheances([echeance('T1', '2026-01-01', 100_000)])
    expect(postesAppeles({ ...d, echeances: prevues, pieces: [] })).toEqual([])
    expect(postesDesComptes({ ...d, echeances: prevues, pieces: [] })).toEqual([])
  })

  it('refus : pièce d’appel absente, écart avec l’écriture, lot sans compte à l’exigibilité', () => {
    const d = donnees()
    expect(() => postesAppeles({ ...d, pieces: d.pieces.slice(0, 1) })).toThrow(/Appel appel-2 : pièce introuvable/)
    const autreCle = creerCleRepartition({ ...cle, lots: [{ lotId: 'lot-1', tantiemes: 700 }, { lotId: 'lot-2', tantiemes: 300 }] })
    expect(() => postesAppeles({ ...d, cles: [autreCle] })).toThrow(/série 00001 : la répartition relue \(70000 centimes\) ne correspond pas à l'écriture de l'appel n° 1 \(60000 centimes\)/)
    expect(() => postesAppeles({ ...d, positions: positions.slice(0, 1) })).toThrow(/anomalie\(s\) — lot_sans_compte \(échéance « T1 », lot lot-2\)/)
    expect(() => postesAppeles({ ...d, cles: [] })).toThrow(/cle_inconnue \(échéance « T1 »\)/)
  })

  it('positions échangées entre deux comptes après l’appel : même total, autre redevable, écart vu compte par compte', () => {
    const d = donnees()
    const echangees = [position('pA', 'lot-1', 'cB'), position('pB', 'lot-2', 'cA')]
    expect(() => postesAppeles({ ...d, positions: echangees })).toThrow(/ne correspond pas à l'écriture de l'appel n° 1/)
  })
})

describe('réglé : lignes d’imputation des encaissements non annulés', () => {
  const annulation = { le: '2026-02-10', motif: 'Chèque impayé', piece: 'AVIS-1', traitementId: 'annulation-1', dateComptable: '2026-02-10', mention: '' }

  it('somme des lignes par poste ; un encaissement annulé ne compte plus', () => {
    const postes = postesDesComptes(
      donnees([
        { id: 'e1', compteId: 'cA', imputation: imputation([{ posteId: 'T1:lot-1', montantCentimes: 25_000 }]) },
        { id: 'e2', compteId: 'cA', imputation: imputation([{ posteId: 'T1:lot-1', montantCentimes: 35_000 }, { posteId: 'T2:lot-1', montantCentimes: 5_000 }]) },
        { id: 'e3', compteId: 'cB', annulation, imputation: imputation([{ posteId: 'T1:lot-2', montantCentimes: 40_000 }]) },
      ]),
    )
    expect(postes.map((p) => [p.id, p.regleCentimes])).toEqual([
      ['T1:lot-1', 60_000],
      ['FT:lot-1', 0],
      ['T2:lot-1', 5_000],
      ['T1:lot-2', 0],
      ['FT:lot-2', 0],
      ['T2:lot-2', 0],
    ])
  })

  it('refus : ligne d’un poste inconnu, d’un autre compte, réglé au-delà du dû', () => {
    const ligne = (posteId: string, montantCentimes: number) => imputation([{ posteId, montantCentimes }])
    expect(() => postesDesComptes(donnees([{ id: 'e1', compteId: 'cA', imputation: ligne('T9:lot-1', 100) }]))).toThrow(/Encaissement e1 : poste imputé « T9:lot-1 » introuvable/)
    expect(() => postesDesComptes(donnees([{ id: 'e1', compteId: 'cA', imputation: ligne('T1:lot-2', 100) }]))).toThrow(/poste imputé « T1:lot-2 » d'un autre compte \(cB\)/)
    expect(() => postesDesComptes(donnees([{ id: 'e1', compteId: 'cA', imputation: ligne('T1:lot-1', 60_001) }]))).toThrow(/Poste T1:lot-1 : réglé de 60001 centimes pour 60000 centimes appelés/)
  })

  it('appel annulé : ses postes sont écartés ; réglé, il est refusé (le règlement serait perdu sans bruit)', () => {
    const d = donnees()
    const annulee = d.echeances.map((e): EcheanceAppelSuivie => (e.id === 'T1' ? { ...e, statut: 'Annulé', annulationTraitementId: 'annulation-appel-1' } : e))
    expect(postesDesComptes({ ...d, echeances: annulee }).map((p) => p.id)).toEqual(['FT:lot-1', 'T2:lot-1', 'FT:lot-2', 'T2:lot-2'])
    const regle = { ...d, echeances: annulee, encaissements: [{ id: 'e1', compteId: 'cA', imputation: imputation([{ posteId: 'T1:lot-1', montantCentimes: 100 }]) }] }
    expect(() => postesDesComptes(regle)).toThrow(/annulé alors que le poste est réglé/)
  })
})

describe('soldes des comptes', () => {
  const encaissements: DonneesPostes['encaissements'] = [
    { id: 'e1', compteId: 'cA', imputation: imputation([{ posteId: 'T1:lot-1', montantCentimes: 60_000 }], 1_500) },
    { id: 'e2', compteId: 'cB', imputation: imputation([{ posteId: 'T1:lot-2', montantCentimes: 10_000 }]) },
  ]

  it('appelé, réglé, reste dû, crédit « à imputer » et solde, dans l’ordre des séries', () => {
    const d = donnees(encaissements)
    expect(soldesDesComptes(postesDesComptes(d), d)).toEqual([
      { compteId: 'cA', appeleCentimes: 96_000, regleCentimes: 60_000, resteDuCentimes: 36_000, creditAImputerCentimes: 1_500, soldeCentimes: 34_500 },
      { compteId: 'cB', appeleCentimes: 64_000, regleCentimes: 10_000, resteDuCentimes: 54_000, creditAImputerCentimes: 0, soldeCentimes: 54_000 },
    ])
  })

  it('solde antérieur d’un avis : sans les échéances de cet avis', () => {
    const d = donnees(encaissements)
    expect(soldesDesComptes(postesDesComptes(d), d, { horsAppels: ['T2', 'FT'] }).map((s) => [s.compteId, s.soldeCentimes])).toEqual([
      ['cA', -1_500],
      ['cB', 30_000],
    ])
  })

  it('compte sans poste mais avec un crédit « à imputer » : il a un solde ; sans rien : aucun', () => {
    const d = donnees()
    const prevues = suivreEcheances([echeance('T1', '2026-01-01', 100_000)])
    const sansAppel = { ...d, echeances: prevues, pieces: [], encaissements: [{ id: 'e1', compteId: 'cB', imputation: imputation([], 2_000) }] }
    expect(soldesDesComptes(postesDesComptes(sansAppel), sansAppel)).toEqual([
      { compteId: 'cB', appeleCentimes: 0, regleCentimes: 0, resteDuCentimes: 0, creditAImputerCentimes: 2_000, soldeCentimes: -2_000 },
    ])
  })
})
