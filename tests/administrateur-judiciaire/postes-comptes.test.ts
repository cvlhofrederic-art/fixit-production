import { describe, expect, it } from 'vitest'
import { marquerAppelees, suivreEcheances, type EcheanceAppelSuivie } from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import { creerCompteCoproprietaire, creerPosition } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { imputerEncaissement, mouvementsEncaissementImpute } from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import { creerPieceTraitement } from '@/lib/administrateur-judiciaire/domain/journal-traitements'
import {
  imputationDOrigine,
  lignesEcrites,
  postesDeLImputation,
  postesDesComptes,
  soldesDesComptes,
  type DonneesPostes,
  type ImputationEcrite,
} from '@/lib/administrateur-judiciaire/domain/postes-comptes'
import {
  avisDAppel,
  creerCleRepartition,
  traitementAppelDeFonds,
  type EcheanceAppel,
  type SousComptes450,
} from '@/lib/administrateur-judiciaire/domain/repartition-appels'

/**
 * Postes des comptes copropriétaires relus de l'échéancier appelé et des encaissements (domain/postes-comptes.ts),
 * fonctions pures : dû recoupé avec l'écriture de l'appel, compte 450 débité par l'appel porté par chaque poste, réglé
 * tiré des lignes d'imputation des encaissements non annulés, écarts limités aux comptes touchés, soldes par compte.
 * Données fictives : lots 1 et 2 (600 et 400 millièmes), comptes cA et cB.
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
const REGLAGE_450: SousComptes450 = { decision: 'AG du 10/03/2026, résolution 9 (fictive)', planBudget: '45010' }

/** Écrit l'appel des échéances données (une pièce) et rend l'échéancier après, avec la pièce. */
function appeler(echeancier: EcheanceAppelSuivie[], ids: string[], numero: number, sousComptes450: SousComptes450 | null = null) {
  const aAppeler = echeancier.filter((e) => ids.includes(e.id))
  const avis = avisDAppel({ echeances: aAppeler, cles: [cle], positions, comptes })
  const traitement = traitementAppelDeFonds(avis, { id: `appel-${numero}`, date: aAppeler[0].exigibilite, segmentSyndicat: SEGMENT, comptes, sousComptes450 })
  const piece = creerPieceTraitement({ traitement, numero, coproprieteId: 'C1', segmentSyndicat: SEGMENT, mandatId: 'M1', parametres: [] })
  return { echeancier: marquerAppelees(echeancier, traitement, avis, { exercices: EXERCICES }), piece }
}

type LigneSaisie = { posteId: string; montantCentimes: number }
/** Ligne écrite d'un poste « <échéance>:<lot> » des essais : son appel, son type (FT : fonds de travaux) et le 45000. */
const ligneEcrite = ({ posteId, montantCentimes }: LigneSaisie): ImputationEcrite['lignes'][number] => {
  const appelId = posteId.split(':')[0]
  return { posteId, montantCentimes, appelId, typeAppel: appelId === 'FT' ? 'Fonds travaux' : 'Budget', planCompte: '45000' }
}

const imputation = (lignes: LigneSaisie[], resteAImputerCentimes = 0): ImputationEcrite => ({
  lignes: lignes.map(ligneEcrite),
  resteAImputerCentimes,
  designationsIgnorees: [],
  designationPartielleRefusee: false,
  imputerSurAVenir: false,
})

type EncaissementLu = DonneesPostes['encaissements'][number]
const encaissement = (id: string, compteId: string, lignes: LigneSaisie[], surcharge: Partial<EncaissementLu> = {}): EncaissementLu => ({
  id,
  compteId,
  traitementId: `encaissement-${id}`,
  imputation: imputation(lignes),
  ...surcharge,
})

/**
 * Deux appels écrits : T1 (1 000,00 €, 01/01/2026) puis T2 (500,00 €) et fonds de travaux (100,00 €) au 01/04/2026 ; le
 * second, au choix, avec les sous-comptes du 450.
 */
function donnees(encaissements: DonneesPostes['encaissements'] = [], sousComptesDuSecond: SousComptes450 | null = null): DonneesPostes {
  const suivies = suivreEcheances([echeance('T1', '2026-01-01', 100_000), echeance('T2', '2026-04-01', 50_000), echeance('FT', '2026-04-01', 10_000, 'fonds_travaux')])
  const premier = appeler(suivies, ['T1'], 1)
  const second = appeler(premier.echeancier, ['T2', 'FT'], 2, sousComptesDuSecond)
  return { echeances: second.echeancier, cles: [cle], positions, comptes, pieces: [premier.piece, second.piece], encaissements }
}

const enEcart = (d: DonneesPostes) => postesDesComptes(d).ecarts.map((e) => [e.compteId, e.serie])
const comptesRendus = (d: DonneesPostes) => [...new Set(postesDesComptes(d).postes.map((p) => p.compteId))]

describe('postes des appels écrits', () => {
  it('un poste par échéance appelée et par lot, au compte redevable, avec le compte 450 que l’appel a débité ; aucun écart', () => {
    const { postes, ecarts } = postesDesComptes(donnees())
    expect(ecarts).toEqual([])
    expect(postes.map((p) => [p.id, p.compteId, p.typeAppel, p.montantCentimes, p.regleCentimes, p.planCompte])).toEqual([
      ['T1:lot-1', 'cA', 'Budget', 60_000, 0, '45000'],
      ['FT:lot-1', 'cA', 'Fonds travaux', 6_000, 0, '45000'],
      ['T2:lot-1', 'cA', 'Budget', 30_000, 0, '45000'],
      ['T1:lot-2', 'cB', 'Budget', 40_000, 0, '45000'],
      ['FT:lot-2', 'cB', 'Fonds travaux', 4_000, 0, '45000'],
      ['T2:lot-2', 'cB', 'Budget', 20_000, 0, '45000'],
    ])
  })

  it('sous-comptes du 450 créés entre deux appels : le budget du second appel au 450-1, le reste et le premier appel au 45000', () => {
    const { postes, ecarts } = postesDesComptes(donnees([], REGLAGE_450))
    expect(ecarts).toEqual([])
    expect(postes.filter((p) => p.compteId === 'cA').map((p) => [p.id, p.planCompte])).toEqual([
      ['T1:lot-1', '45000'],
      ['FT:lot-1', '45000'],
      ['T2:lot-1', '45010'],
    ])
  })

  it('aucune échéance appelée : aucun poste ; une échéance « Prévu » n’en a pas', () => {
    const prevues = suivreEcheances([echeance('T1', '2026-01-01', 100_000)])
    expect(postesDesComptes({ ...donnees(), echeances: prevues, pieces: [] })).toEqual({ postes: [], ecarts: [] })
  })
})

describe('écarts avec l’écriture de l’appel : limités aux comptes touchés', () => {
  it('lot sans compte à l’exigibilité : seul le compte que l’appel a débité est en écart, avec l’anomalie, le lot et l’échéance', () => {
    const d = { ...donnees(), positions: positions.slice(0, 1) }
    const { ecarts } = postesDesComptes(d)
    expect(enEcart(d)).toEqual([
      ['cB', '00002'],
      ['cB', '00002'],
    ])
    expect(ecarts[0].message).toBe(
      "Compte copropriétaire de série 00002, appel n° 1 (échéance « T1 ») : 40000 centimes écrits au compte, 0 centime relu (aucun lot) ; clé de répartition ou positions modifiées depuis l'appel. Anomalies de la répartition relue : lot_sans_compte (échéance « T1 », lot lot-2). Séries en écart sur cet appel : 00002. Les postes de ce compte ne sont pas rendus et ses encaissements sont refusés tant que l'écart n'est pas levé.",
    )
    expect(ecarts[1].message).toMatch(/appel n° 2 \(échéances « FT », « T2 »\) : 24000 centimes écrits au compte, 0 centime relu/)
    expect(comptesRendus(d)).toEqual(['cA'])
  })

  it('clé modifiée : chaque compte dont la part change, pour chaque appel, avec le lot et l’échéance relus', () => {
    const autreCle = creerCleRepartition({ ...cle, lots: [{ lotId: 'lot-1', tantiemes: 700 }, { lotId: 'lot-2', tantiemes: 300 }] })
    const d = { ...donnees(), cles: [autreCle] }
    expect(enEcart(d)).toEqual([
      ['cA', '00001'],
      ['cB', '00002'],
      ['cA', '00001'],
      ['cB', '00002'],
    ])
    expect(postesDesComptes(d).ecarts[0].message).toMatch(
      /série 00001, appel n° 1 \(échéance « T1 »\) : 60000 centimes écrits au compte, 70000 centimes relus \(échéance « T1 », lot lot-1 : 70000\).*Séries en écart sur cet appel : 00001, 00002\./,
    )
    expect(postesDesComptes(d).postes).toEqual([])
  })

  it('positions échangées entre deux comptes après l’appel : même total, autre redevable, écart vu compte par compte', () => {
    const d = { ...donnees(), positions: [position('pA', 'lot-1', 'cB'), position('pB', 'lot-2', 'cA')] }
    expect(enEcart(d)).toEqual([
      ['cA', '00001'],
      ['cB', '00002'],
      ['cA', '00001'],
      ['cB', '00002'],
    ])
  })

  it('clé disparue, pièce d’appel absente : les comptes de cet appel sont en écart et aucun de leurs postes n’est rendu', () => {
    const d = donnees()
    const sansCle = { ...d, cles: [] }
    expect(postesDesComptes(sansCle).ecarts[0].message).toMatch(/Anomalies de la répartition relue : cle_inconnue \(échéance « T1 »\)/)
    expect(comptesRendus(sansCle)).toEqual([])
    const sansPiece = { ...d, pieces: d.pieces.slice(0, 1) }
    expect(enEcart(sansPiece)).toEqual([
      ['cA', '00001'],
      ['cB', '00002'],
    ])
    expect(postesDesComptes(sansPiece).ecarts[0].message).toMatch(/série 00001, appel appel-2 \(échéances « FT », « T2 »\) : pièce introuvable au journal des traitements du syndicat/)
    expect(comptesRendus(sansPiece)).toEqual([])
  })

  it('sous-comptes du 450 : le partage budget / reste relu doit être celui de l’écriture, même à total égal (aucune compensation)', () => {
    const d = donnees([], REGLAGE_450)
    // Le fonds de travaux requalifié en budget après l'appel : même total par compte, autre partage entre le 450-1 et le 45000.
    const requalifiee = { ...d, echeances: d.echeances.map((e): EcheanceAppelSuivie => (e.id === 'FT' ? { ...e, nature: 'budget' } : e)) }
    expect(enEcart(requalifiee)).toEqual([
      ['cA', '00001'],
      ['cB', '00002'],
    ])
    expect(postesDesComptes(requalifiee).ecarts[0].message).toMatch(
      /série 00001, appel n° 2 .* : 36000 centimes écrits au compte \(dont 30000 au sous-compte 45010 du budget\), 36000 centimes relus \(dont 36000 du budget ;/,
    )
  })

  it('série débitée par l’appel qui n’est plus celle d’aucun compte : écart sans compte', () => {
    const d = donnees()
    const sansB = { ...d, comptes: comptes.slice(0, 1), positions: positions.slice(0, 1) }
    expect(enEcart(sansB)).toEqual([
      [null, '00002'],
      [null, '00002'],
    ])
    expect(comptesRendus(sansB)).toEqual(['cA'])
  })
})

describe('réglé : lignes d’imputation des encaissements non annulés', () => {
  const annulation = { le: '2026-02-10', motif: 'Chèque impayé', piece: 'AVIS-1', traitementId: 'annulation-1', dateComptable: '2026-02-10', mention: '' }

  it('somme des lignes par poste ; un encaissement annulé ne compte plus', () => {
    const { postes, ecarts } = postesDesComptes(
      donnees([
        encaissement('e1', 'cA', [{ posteId: 'T1:lot-1', montantCentimes: 25_000 }]),
        encaissement('e2', 'cA', [{ posteId: 'T1:lot-1', montantCentimes: 35_000 }, { posteId: 'T2:lot-1', montantCentimes: 5_000 }]),
        encaissement('e3', 'cB', [{ posteId: 'T1:lot-2', montantCentimes: 40_000 }], { annulation }),
      ]),
    )
    expect(ecarts).toEqual([])
    expect(postes.map((p) => [p.id, p.regleCentimes])).toEqual([
      ['T1:lot-1', 60_000],
      ['FT:lot-1', 0],
      ['T2:lot-1', 5_000],
      ['T1:lot-2', 0],
      ['FT:lot-2', 0],
      ['T2:lot-2', 0],
    ])
  })

  it('ligne d’un poste inconnu, d’un autre compte, réglé au-delà du dû : le compte de l’encaissement est en écart, pas les autres', () => {
    const cas = (posteId: string, montantCentimes: number) => donnees([encaissement('e1', 'cA', [{ posteId, montantCentimes }])])
    for (const [d, motif] of [
      [cas('T9:lot-1', 100), /Encaissement e1 : poste imputé « T9:lot-1 » introuvable/],
      [cas('T1:lot-2', 100), /Encaissement e1 du compte cA : poste imputé « T1:lot-2 » d'un autre compte \(cB\)/],
      [cas('T1:lot-1', 60_001), /Poste T1:lot-1 : réglé de 60001 centimes pour 60000 centimes appelés/],
    ] as const) {
      const { ecarts } = postesDesComptes(d)
      expect(ecarts.map((e) => [e.compteId, e.serie])).toEqual([['cA', '00001']])
      expect(ecarts[0].message).toMatch(motif)
      expect(comptesRendus(d)).toEqual(['cB'])
    }
  })

  it('pièce d’un encaissement annulée hors du circuit des encaissements : son compte est en écart', () => {
    const d = donnees([encaissement('e1', 'cB', [{ posteId: 'T1:lot-2', montantCentimes: 40_000 }])])
    const pieceEncaissement = creerPieceTraitement({
      traitement: { id: 'encaissement-e1', famille: 'Encaissement', date: '2026-02-01', mouvements: [] },
      numero: 3,
      coproprieteId: 'C1',
      segmentSyndicat: SEGMENT,
      mandatId: 'M1',
      parametres: [],
    })
    const annulee = { ...d, pieces: [...d.pieces, { ...pieceEncaissement, statut: 'Annulé' as const, annuleePar: 'annulation-generique' }] }
    const { ecarts } = postesDesComptes(annulee)
    expect(ecarts.map((e) => [e.compteId, e.serie])).toEqual([['cB', '00002']])
    expect(ecarts[0].message).toMatch(/Encaissement e1 : sa pièce n° 3 a été annulée hors du circuit des encaissements/)
    expect(comptesRendus(annulee)).toEqual(['cA'])
    // La même pièce, non annulée : aucun écart.
    expect(postesDesComptes({ ...d, pieces: [...d.pieces, pieceEncaissement] }).ecarts).toEqual([])
  })

  it('appel annulé : ses postes sont écartés ; réglé, son compte est en écart (le règlement serait perdu sans bruit)', () => {
    const d = donnees()
    const annulee = d.echeances.map((e): EcheanceAppelSuivie => (e.id === 'T1' ? { ...e, statut: 'Annulé', annulationTraitementId: 'annulation-appel-1' } : e))
    expect(postesDesComptes({ ...d, echeances: annulee }).ecarts).toEqual([])
    expect(postesDesComptes({ ...d, echeances: annulee }).postes.map((p) => p.id)).toEqual(['FT:lot-1', 'T2:lot-1', 'FT:lot-2', 'T2:lot-2'])
    const regle = { ...d, echeances: annulee, encaissements: [encaissement('e1', 'cA', [{ posteId: 'T1:lot-1', montantCentimes: 100 }])] }
    expect(enEcart(regle)).toEqual([['cA', '00001']])
    expect(postesDesComptes(regle).ecarts[0].message).toMatch(/annulé alors que le poste est réglé/)
    expect(comptesRendus(regle)).toEqual(['cB'])
  })

  it('décision du 24/11/2026 (question 6) — encaissement réimputé : le réglé se lit sur l’imputation courante ; pièce de reclassement absente ou annulée : son compte est en écart', () => {
    // Imputation d'origine : 400,00 € sur le T1 ; réimputée depuis : 300,00 € sur le T1 et 100,00 € sur le T2.
    const origine = imputation([{ posteId: 'T1:lot-2', montantCentimes: 40_000 }])
    const courante = imputation([{ posteId: 'T1:lot-2', montantCentimes: 30_000 }, { posteId: 'T2:lot-2', montantCentimes: 10_000 }])
    const reimputation = {
      traitementId: 'reclassement-1',
      le: '2026-05-10',
      cause: { type: 'encaissement-en-retard' as const, encaissementIds: ['e0'], traitementId: 'encaissement-e0', date: '2026-01-20' },
      avant: origine,
      mouvements: [],
      mention: 'Réimputation dans l’ordre des dates (fictive)',
    }
    const reimpute = { ...encaissement('e1', 'cB', []), imputation: courante, reimputations: [reimputation] }
    expect(imputationDOrigine(reimpute)).toBe(origine)
    expect(imputationDOrigine(encaissement('e2', 'cB', [{ posteId: 'T1:lot-2', montantCentimes: 100 }])).lignes).toMatchObject([{ posteId: 'T1:lot-2', montantCentimes: 100 }])
    const d = donnees([reimpute])
    const reclassement = creerPieceTraitement({
      traitement: { id: 'reclassement-1', famille: 'Correction de mouvements', date: '2026-05-10', mouvements: [] },
      numero: 4,
      coproprieteId: 'C1',
      segmentSyndicat: SEGMENT,
      mandatId: 'M1',
      parametres: [],
    })
    const avecLaPiece = postesDesComptes({ ...d, pieces: [...d.pieces, reclassement] })
    expect(avecLaPiece.ecarts).toEqual([])
    expect(avecLaPiece.postes.filter((p) => p.compteId === 'cB').map((p) => [p.id, p.regleCentimes])).toEqual([
      ['T1:lot-2', 30_000],
      ['FT:lot-2', 0],
      ['T2:lot-2', 10_000],
    ])
    // Pièce de reclassement absente du journal du syndicat.
    expect(enEcart(d)).toEqual([['cB', '00002']])
    expect(postesDesComptes(d).ecarts[0].message).toMatch(/Encaissement e1 : sa pièce de reclassement reclassement-1 est introuvable au journal des traitements du syndicat/)
    expect(comptesRendus(d)).toEqual(['cA'])
    // Pièce de reclassement annulée hors du circuit des encaissements.
    const annulee = { ...d, pieces: [...d.pieces, { ...reclassement, statut: 'Annulé' as const }] }
    expect(enEcart(annulee)).toEqual([['cB', '00002']])
    expect(postesDesComptes(annulee).ecarts[0].message).toMatch(/Encaissement e1 : sa pièce de reclassement n° 4 a été annulée hors du circuit des encaissements/)
    // Un encaissement annulé ne compte plus : sa pièce de reclassement n'est plus regardée.
    const annulation = { le: '2026-06-01', motif: 'Chèque impayé', piece: 'AVIS-2', traitementId: 'annulation-2', dateComptable: '2026-06-01', mention: '' }
    expect(postesDesComptes(donnees([{ ...reimpute, annulation }])).ecarts).toEqual([])
  })
})

describe('soldes des comptes', () => {
  const encaissements: DonneesPostes['encaissements'] = [
    { ...encaissement('e1', 'cA', []), imputation: imputation([{ posteId: 'T1:lot-1', montantCentimes: 60_000 }], 1_500) },
    encaissement('e2', 'cB', [{ posteId: 'T1:lot-2', montantCentimes: 10_000 }]),
  ]

  it('appelé, réglé, reste dû, crédit « à imputer » et solde, dans l’ordre des séries', () => {
    const d = donnees(encaissements)
    expect(soldesDesComptes(postesDesComptes(d).postes, d)).toEqual([
      { compteId: 'cA', appeleCentimes: 96_000, regleCentimes: 60_000, resteDuCentimes: 36_000, creditAImputerCentimes: 1_500, soldeCentimes: 34_500 },
      { compteId: 'cB', appeleCentimes: 64_000, regleCentimes: 10_000, resteDuCentimes: 54_000, creditAImputerCentimes: 0, soldeCentimes: 54_000 },
    ])
  })

  it('solde antérieur d’un avis : sans les échéances de cet avis', () => {
    const d = donnees(encaissements)
    expect(soldesDesComptes(postesDesComptes(d).postes, d, { horsAppels: ['T2', 'FT'] }).map((s) => [s.compteId, s.soldeCentimes])).toEqual([
      ['cA', -1_500],
      ['cB', 30_000],
    ])
  })

  it('compte en écart : aucun solde rendu (son crédit « à imputer » seul serait faux)', () => {
    const d = { ...donnees(encaissements), positions: positions.slice(1) }
    const { postes, ecarts } = postesDesComptes(d)
    expect(soldesDesComptes(postes, d, { comptesEnEcart: new Set(ecarts.map((e) => e.compteId)) }).map((s) => s.compteId)).toEqual(['cB'])
  })

  it('compte sans poste mais avec un crédit « à imputer » : il a un solde ; sans rien : aucun', () => {
    const prevues = suivreEcheances([echeance('T1', '2026-01-01', 100_000)])
    const sansAppel = { ...donnees(), echeances: prevues, pieces: [], encaissements: [{ ...encaissement('e1', 'cB', []), imputation: imputation([], 2_000) }] }
    expect(soldesDesComptes(postesDesComptes(sansAppel).postes, sansAppel)).toEqual([
      { compteId: 'cB', appeleCentimes: 0, regleCentimes: 0, resteDuCentimes: 0, creditAImputerCentimes: 2_000, soldeCentimes: -2_000 },
    ])
  })
})

describe('écriture de l’encaissement : chaque poste crédité au compte que son appel a débité', () => {
  const payer = (d: DonneesPostes) => {
    const encaisse = { id: 'e9', compteId: 'cA', date: '2026-04-15', montantCentimes: 96_000 }
    return { encaisse, resultat: imputerEncaissement(encaisse, postesDesComptes(d).postes) }
  }
  const comptes450 = { compteBanque: 'TILL.51200.00000.0', compteCoproprietaire: 'TILL.45000.00001.0' }
  const compteDuPlan = (planCode: string) => `TILL.${planCode}.00001.0`

  it('ancien appel au 45000, budget du nouvel appel au 450-1, fonds de travaux au 45000 : aucun réglage unique, aucune compensation', () => {
    const { encaisse, resultat } = payer(donnees([], REGLAGE_450))
    const mouvements = mouvementsEncaissementImpute({ encaissement: encaisse, resultat, ...comptes450, compteDuPlan })
    expect(mouvements.map((m) => [m.compte, m.sens, m.montantCentimes, m.origine?.type === 'appel' ? m.origine.appelId : null])).toEqual([
      ['TILL.51200.00000.0', 'debit', 96_000, null],
      ['TILL.45000.00001.0', 'credit', 60_000, 'T1'],
      ['TILL.45000.00001.0', 'credit', 6_000, 'FT'],
      ['TILL.45010.00001.0', 'credit', 30_000, 'T2'],
    ])
    // Le compte porté par le poste l'emporte sur un réglage passé à l'écriture.
    const avecReglage = mouvementsEncaissementImpute({ encaissement: encaisse, resultat, ...comptes450, compteBudget: 'TILL.45099.00001.0', compteDuPlan })
    expect(avecReglage.map((m) => m.compte)).toEqual(mouvements.map((m) => m.compte))
  })

  it('refus : poste qui porte son compte sans le numéro de ce compte ; code de plan qui n’est pas un 450', () => {
    const { encaisse, resultat } = payer(donnees())
    expect(() => mouvementsEncaissementImpute({ encaissement: encaisse, resultat, ...comptes450 })).toThrow(/Poste T1:lot-1 : il porte le compte débité par son appel \(45000\)/)
    const postes = postesDesComptes(donnees()).postes.map((p) => ({ ...p, planCompte: '51200' }))
    expect(() => imputerEncaissement(encaisse, postes)).toThrow(/Poste T1:lot-1 : compte débité par l'appel « 51200 », code de plan 450xx attendu/)
  })
})

describe('lignes gardées sur l’encaissement : de quoi passer son écriture contraire sans relire les postes', () => {
  it('chaque ligne garde l’appel d’origine et le compte 450 de son poste ; poste absent refusé', () => {
    const { postes } = postesDesComptes(donnees([], REGLAGE_450))
    const lignes = [{ posteId: 'T1:lot-1', montantCentimes: 100 }, { posteId: 'FT:lot-1', montantCentimes: 200 }, { posteId: 'T2:lot-1', montantCentimes: 300 }]
    expect(lignesEcrites(lignes, postes)).toEqual([
      { posteId: 'T1:lot-1', montantCentimes: 100, appelId: 'T1', typeAppel: 'Budget', planCompte: '45000' },
      { posteId: 'FT:lot-1', montantCentimes: 200, appelId: 'FT', typeAppel: 'Fonds travaux', planCompte: '45000' },
      { posteId: 'T2:lot-1', montantCentimes: 300, appelId: 'T2', typeAppel: 'Budget', planCompte: '45010' },
    ])
    expect(() => lignesEcrites([{ posteId: 'T9:lot-1', montantCentimes: 1 }], postes)).toThrow(/Poste imputé introuvable \(id=T9:lot-1\)/)
    // Un poste sans compte relu de son appel (dette sans appel) : le 45000.
    expect(lignesEcrites([{ posteId: 'reprise', montantCentimes: 1 }], [{ id: 'reprise', compteId: 'cA', appelId: null, typeAppel: null, libelle: 'Reprise', exigibilite: '2026-01-01', montantCentimes: 1, regleCentimes: 0, contentieux: false }])[0]).toMatchObject({
      appelId: null,
      typeAppel: null,
      planCompte: '45000',
    })
  })

  it('postes de l’annulation : un par poste imputé, réglé de la part imputée, avec son appel et son compte ; lignes incohérentes refusées', () => {
    const lignes = [{ posteId: 'T1:lot-1', montantCentimes: 100 }, { posteId: 'T2:lot-1', montantCentimes: 300 }, { posteId: 'T1:lot-1', montantCentimes: 50 }].map(ligneEcrite)
    const ecrit = { id: 'e1', compteId: 'cA', date: '2026-04-15', imputation: { ...imputation([]), lignes } }
    expect(postesDeLImputation(ecrit).map((p) => [p.id, p.compteId, p.appelId, p.typeAppel, p.planCompte, p.montantCentimes, p.regleCentimes, p.exigibilite])).toEqual([
      ['T1:lot-1', 'cA', 'T1', 'Budget', '45000', 150, 150, '2026-04-15'],
      ['T2:lot-1', 'cA', 'T2', 'Budget', '45000', 300, 300, '2026-04-15'],
    ])
    expect(postesDeLImputation({ ...ecrit, imputation: imputation([]) })).toEqual([])
    const incoherentes = [...lignes, { ...lignes[0], planCompte: '45010' }]
    expect(() => postesDeLImputation({ ...ecrit, imputation: { ...imputation([]), lignes: incoherentes } })).toThrow(/Encaissement e1 : lignes du poste « T1:lot-1 » incohérentes/)
  })
})
