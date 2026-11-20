import { describe, expect, it } from 'vitest'
import {
  centimesDepuisSaisie,
  datePrelevementProposee,
  exigibilitesAAppeler,
  indicateursAppels,
  vueAvisAppel,
  vueDroitsLots,
  type CompteAppel,
  type ContexteAppel,
  type DonneesAppels,
} from '@/components/administrateur-judiciaire/modules/finances/appels/appels-vue'
import type { MandatPrelevement } from '@/lib/administrateur-judiciaire/domain/avis-appel'
import { suivreEcheances, type EcheanceAppelSuivie } from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import { creerCompteCoproprietaire, creerIdentite, creerPosition, type Position } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { creerCleRepartition, type EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'

/**
 * Vue de l'écran « Appels de fonds » en données réelles (plan des écrans, § 5.7) : calculs purs sur les tables D2 lues
 * (lots, positions, identités, comptes copropriétaires, clés, échéances, exercices), par les fonctions du domaine
 * (avisDAppel, traitementAppelDeFonds, contenuAvisAppel, echeancesPrelevementDepuisAvis, preparerLotPrelevements).
 * Syndicat, lots et personnes fictifs ; IBAN : exemples déjà utilisés par les tests du dépôt.
 */

const IBAN_DEBITEUR = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_FAUX = 'FR76 3000 6000 0112 3456 7890 188'
const IBAN_SYNDICAT = 'FR14 2004 1010 0505 0001 3M02 606'
const ICS = 'FR12ZZZ123456'

const lots = [
  { id: 'L1', numero: '1', tantiemes: { numerateur: 450, denominateur: 1000 } },
  { id: 'L2', numero: '2', tantiemes: { numerateur: 350, denominateur: 1000 } },
  { id: 'L3', numero: '3', tantiemes: { numerateur: 200, denominateur: 1000 } },
]

const compte = (id: string, serie: string, libelle: string): CompteAppel => creerCompteCoproprietaire({ id, coproprieteId: 'C1', serie, libelle })
const comptes: CompteAppel[] = [compte('c1', '1', 'Indivision A (fictive)'), compte('c2', '2', 'Copropriétaire B (fictif)'), compte('c3', '3', 'Acquéreur C (fictif)')]

const identite = (id: string, nom: string) => creerIdentite({ id, nature: 'physique', civilite: '', nom, prenom: null, telecoms: [] })
const identites = [
  identite('i1', 'Personne A1'),
  identite('i2', 'Personne A2'),
  identite('i3', 'Personne B'),
  identite('i4', 'Personne C'),
  identite('i5', 'Usufruitier D'),
  identite('i6', 'Nu-propriétaire E'),
]

const pos = (p: Omit<Position, 'statut' | 'dateSortie' | 'natureMutation'> & { dateSortie?: string }): Position =>
  creerPosition({ ...p, statut: p.dateSortie ? 'Sorti' : 'En place', dateSortie: p.dateSortie ?? null })
const UN = { numerateur: 1, denominateur: 1 }
const DEMI = { numerateur: 1, denominateur: 2 }
/** Lot 1 en indivision (compte c1), lot 2 vendu le 01/04/2027 (c2 → c3), lot 3 démembré (compte c2). */
const positions: Position[] = [
  pos({ id: 'p1', identiteId: 'i1', lotId: 'L1', compteId: 'c1', qualite: 'Indivisaire', part: DEMI, dateEntree: '2019-06-01' }),
  pos({ id: 'p2', identiteId: 'i2', lotId: 'L1', compteId: 'c1', qualite: 'Indivisaire', part: DEMI, dateEntree: '2019-06-01' }),
  pos({ id: 'p3', identiteId: 'i3', lotId: 'L2', compteId: 'c2', qualite: 'Copropriétaire', part: UN, dateEntree: '2012-01-01', dateSortie: '2027-04-01' }),
  pos({ id: 'p4', identiteId: 'i4', lotId: 'L2', compteId: 'c3', qualite: 'Copropriétaire', part: UN, dateEntree: '2027-04-01' }),
  pos({ id: 'p5', identiteId: 'i5', lotId: 'L3', compteId: 'c2', qualite: 'Usufruitier', part: UN, dateEntree: '2018-01-01' }),
  pos({ id: 'p6', identiteId: 'i6', lotId: 'L3', compteId: 'c2', qualite: 'Nu propriétaire', part: UN, dateEntree: '2018-01-01' }),
]

const cleGenerale = creerCleRepartition({
  id: 'k1',
  coproprieteId: 'C1',
  code: '001',
  libelle: 'Charges communes générales',
  lots: lots.map((l) => ({ lotId: l.id, tantiemes: l.tantiemes.numerateur })),
})

const ech = (e: Omit<EcheanceAppel, 'coproprieteId'>): EcheanceAppel => ({ coproprieteId: 'C1', ...e })
const echeances: EcheanceAppelSuivie[] = suivreEcheances([
  ech({ id: 'A-20270101-001-1', cleId: 'k1', exigibilite: '2027-01-01', libelle: 'Provisions T1 2027', montantCentimes: 100_001, nature: 'budget' }),
  ech({ id: 'A-20270401-001-1', cleId: 'k1', exigibilite: '2027-04-01', libelle: 'Provisions T2 2027', montantCentimes: 60_000, nature: 'budget' }),
  ech({ id: 'A-20270401-001-2', cleId: 'k1', exigibilite: '2027-04-01', libelle: 'Fonds de travaux T2 2027', montantCentimes: 3_000, nature: 'fonds_travaux' }),
])

const donnees = (surcharge: Partial<DonneesAppels> = {}): DonneesAppels => ({
  lots,
  positions,
  identites,
  comptes,
  cles: [cleGenerale],
  echeances,
  exercices: [{ nom: '2027', ouverture: '2027-01-01', cloture: '2027-12-31' }],
  banques: [{ nature: 'courant', iban: IBAN_SYNDICAT, actif: true }],
  comptesEnContentieux: new Set(),
  ...surcharge,
})

const contexte = (surcharge: Partial<ContexteAppel> = {}): ContexteAppel => ({
  jusquAu: '2027-01-01',
  dateEmission: '2026-12-01',
  datePrelevement: '2027-01-05',
  segmentSyndicat: 'ACAC',
  syndicat: { nom: 'Syndicat des copropriétaires Résidence des Acacias (fictif)', adresse: '1 rue de l’Exemple, 75000 Paris' },
  ics: ICS,
  administrateurProvisoire: null,
  sousComptes450: null,
  ...surcharge,
})

const totalLignes = (vue: ReturnType<typeof vueAvisAppel>, echeanceId: string) =>
  vue.avis?.parCompte.flatMap((c) => c.lignes).filter((l) => l.echeanceId === echeanceId).reduce((s, l) => s + l.centimes, 0)

describe('appel à émettre : échéances retenues', () => {
  it('une option par exigibilité « Prévu », dans l’ordre ; les échéances exigibles jusqu’à la date choisie', () => {
    expect(exigibilitesAAppeler(echeances)).toEqual(['2027-01-01', '2027-04-01'])
    const appelees = echeances.map((e, i) => (i === 0 ? { ...e, statut: 'Appelé' as const, traitementId: 't', echeancesDeLAppel: [e.id] } : e))
    expect(exigibilitesAAppeler(appelees)).toEqual(['2027-04-01'])
    expect(vueAvisAppel(donnees(), contexte({ jusquAu: '2027-04-01' })).echeances.map((e) => e.id)).toEqual([
      'A-20270101-001-1',
      'A-20270401-001-1',
      'A-20270401-001-2',
    ])
  })
})

describe('quotes-parts : aucun centime perdu', () => {
  it('la somme des quotes-parts de chaque échéance égale son montant (plus forts restes)', () => {
    const vue = vueAvisAppel(donnees(), contexte())
    expect(vue.erreur).toBeNull()
    expect(totalLignes(vue, 'A-20270101-001-1')).toBe(100_001)
    const lot1 = vue.avis?.parCompte.find((c) => c.compteId === 'c1')?.lignes
    expect(lot1).toEqual([{ echeanceId: 'A-20270101-001-1', lotId: 'L1', cle: '001', centimes: 45_001 }])
  })
})

describe('indivision et démembrement : un seul compte', () => {
  it('lot 1 (deux indivisaires) au compte c1, lot 3 (usufruit et nue-propriété) au compte c2 ; droits complets', () => {
    const vue = vueAvisAppel(donnees(), contexte())
    expect(vue.avis?.parCompte.map((c) => [c.compteId, c.lignes.map((l) => l.lotId)])).toEqual([
      ['c1', ['L1']],
      ['c2', ['L2', 'L3']],
    ])
    const droits = vueDroitsLots(donnees(), '2027-01-01')
    expect(droits.map((d) => [d.numero, d.anomalie])).toEqual([
      ['1', null],
      ['2', null],
      ['3', null],
    ])
    expect(droits[0].enPlace.map((p) => `${p.nom} — ${p.qualite} ${p.part} · compte ${p.serie}`)).toEqual([
      'Personne A1 — Indivisaire 1/2 · compte 00001',
      'Personne A2 — Indivisaire 1/2 · compte 00001',
    ])
    expect(droits[2].enPlace.map((p) => p.qualite)).toEqual(['Usufruitier', 'Nu propriétaire'])
  })
})

describe('vente le jour de l’exigibilité : appel au vendeur', () => {
  it('lot 2 vendu le 01/04/2027 : les échéances exigibles ce jour vont au compte du vendeur (D. 1967 art. 6-2)', () => {
    const vue = vueAvisAppel(donnees(), contexte({ jusquAu: '2027-04-01', dateEmission: '2027-03-15', datePrelevement: '2027-04-05' }))
    const lignesLot2 = vue.avis?.parCompte.flatMap((c) => c.lignes.filter((l) => l.lotId === 'L2').map((l) => [c.compteId, l.echeanceId]))
    expect(lignesLot2).toEqual([
      ['c2', 'A-20270101-001-1'],
      ['c2', 'A-20270401-001-1'],
      ['c2', 'A-20270401-001-2'],
    ])
    const droits = vueDroitsLots(donnees(), '2027-04-01')
    expect(droits[1]).toMatchObject({ numero: '2', venteCeJour: true })
    expect(droits[1].enPlace.map((p) => p.nom)).toEqual(['Personne C'])
    expect(vueDroitsLots(donnees(), '2027-04-02')[1].venteCeJour).toBe(false)
  })
})

describe('anomalies : écriture bloquée', () => {
  it('lot sans compte : anomalie lisible, ni écriture ni contenu d’avis', () => {
    const vue = vueAvisAppel(donnees({ positions: positions.filter((p) => p.lotId !== 'L3') }), contexte())
    expect(vue.anomalies).toEqual(['Lot 3 : aucun compte copropriétaire en place au 01/01/2027 (« Provisions T1 2027 »).'])
    expect(vue.ecriture).toBeNull()
    expect(vue.contenu).toBeNull()
    expect(vue.blocage).toMatch(/1 anomalie/)
    expect(vueDroitsLots(donnees({ positions: positions.filter((p) => p.lotId !== 'L3') }), '2027-01-01')[2].anomalie).toBe('Lot sans propriétaire en place.')
  })

  it('clé inconnue : anomalie lisible, écriture bloquée', () => {
    const inconnue = suivreEcheances([ech({ id: 'A-20270101-009-1', cleId: 'k-disparue', exigibilite: '2027-01-01', libelle: 'Ascenseur T1 2027', montantCentimes: 12_000, nature: 'budget' })])
    const vue = vueAvisAppel(donnees({ echeances: inconnue }), contexte())
    expect(vue.anomalies).toEqual(['« Ascenseur T1 2027 » : clé de répartition inconnue (k-disparue).'])
    expect(vue.ecriture).toBeNull()
    expect(vue.blocage).not.toBeNull()
  })

  it('comptes multiples sur un lot (deux fiches reprises) : anomalie lisible', () => {
    const doublon = [...positions, pos({ id: 'p7', identiteId: 'i4', lotId: 'L1', compteId: 'c3', qualite: 'Indivisaire', part: DEMI, dateEntree: '2019-06-01' })]
    expect(vueAvisAppel(donnees({ positions: doublon }), contexte()).anomalies).toEqual([
      'Lot 1 : plusieurs comptes pour les droits de propriété au 01/01/2027 (« Provisions T1 2027 ») : une dette = un compte (D2).',
    ])
  })

  it('exercice absent : la date comptable est refusée, écriture bloquée', () => {
    const vue = vueAvisAppel(donnees({ exercices: [] }), contexte())
    expect(vue.ecriture).not.toBeNull()
    expect(vue.controleDate.map((a) => a.code)).toEqual(['exigibilite_hors_exercice'])
    expect(vue.blocage).toMatch(/exercice/)
    expect(vue.exerciceManquant).toBe('2027-01-01')
  })
})

describe('écriture de l’appel', () => {
  it('équilibrée : débits des comptes 450 du syndicat, crédit 70100 ; datée de l’exigibilité', () => {
    const vue = vueAvisAppel(donnees(), contexte())
    expect(vue.blocage).toBeNull()
    expect(vue.dateComptable).toBe('2027-01-01')
    const mouvements = vue.ecriture?.mouvements.map((m) => [m.compte, m.sens, m.montantCentimes])
    expect(mouvements).toEqual([
      ['ACAC.45000.00001.0', 'debit', 45_001],
      ['ACAC.45000.00002.0', 'debit', 55_000],
      ['ACAC.70100.00000.0', 'credit', 100_001],
    ])
    expect(vue.equilibre).toEqual({ debitCentimes: 100_001, creditCentimes: 100_001, equilibree: true })
  })

  it('sous-comptes du 450 créés par l’AG : le budget au 450-1, le fonds de travaux au 45000 (J67, R104)', () => {
    const vue = vueAvisAppel(
      donnees(),
      contexte({ jusquAu: '2027-04-01', dateEmission: '2027-03-15', datePrelevement: '2027-04-05', sousComptes450: { decision: 'AG du 10/06/2026, résolution 12 (fictive)', planBudget: '45010' } }),
    )
    const debitsC1 = vue.ecriture?.mouvements.filter((m) => m.sens === 'debit' && m.compte.includes('.00001.')).map((m) => [m.compte, m.montantCentimes])
    expect(debitsC1).toEqual([
      ['ACAC.45010.00001.0', 72_001],
      ['ACAC.45000.00001.0', 1_350],
    ])
    expect(vue.equilibre?.equilibree).toBe(true)
    expect(vue.ecriture?.mouvements.filter((m) => m.sens === 'credit').map((m) => [m.compte, m.montantCentimes])).toEqual([
      ['ACAC.70100.00000.0', 160_001],
      ['ACAC.10500.00000.0', 3_000],
    ])
  })
})

const mandat = (surcharge: Partial<MandatPrelevement> = {}): MandatPrelevement => ({
  rum: 'RUM-ACAC-00001',
  dateSignature: '2024-03-01',
  debiteur: 'Personne A1',
  debiteurIdentiteId: 'i1',
  iban: IBAN_DEBITEUR,
  bic: 'EXEMFRPP',
  dernierPrelevementLe: '2026-10-05',
  natures: { budget: true, autres: true },
  maxiCentimes: null,
  ...surcharge,
})
const avecPrelevement = (c: CompteAppel, m: MandatPrelevement | null): CompteAppel => ({ ...c, reglement: { mode: 'Prélèvement', mandat: m } })
const ligneDe = (vue: ReturnType<typeof vueAvisAppel>, compteId: string) => vue.prelevements?.lignes.find((l) => l.compteId === compteId)

describe('prélèvements SEPA : lot affiché, fichier jamais transmis', () => {
  it('IBAN invalide et RUM absente : exclus avec leur motif', () => {
    const vue = vueAvisAppel(
      donnees({ comptes: [avecPrelevement(comptes[0], mandat({ iban: IBAN_FAUX })), avecPrelevement(comptes[1], mandat({ rum: ' ', debiteur: 'Personne B', debiteurIdentiteId: 'i3' })), comptes[2]] }),
      contexte(),
    )
    expect(ligneDe(vue, 'c1')).toMatchObject({ etat: 'exclu', motif: 'IBAN du mandat invalide' })
    expect(ligneDe(vue, 'c2')).toMatchObject({ etat: 'exclu', motif: 'RUM absente' })
    expect(vue.prelevements?.lot.retenues).toEqual([])
  })

  it('compte en contentieux : exclu, prélèvement suspendu', () => {
    const vue = vueAvisAppel(donnees({ comptes: [avecPrelevement(comptes[0], mandat()), comptes[1], comptes[2]], comptesEnContentieux: new Set(['c1']) }), contexte())
    expect(ligneDe(vue, 'c1')).toMatchObject({ etat: 'exclu', motif: 'Compte en contentieux : prélèvement suspendu' })
  })

  it('préavis de 14 jours : un débit trop proche de l’émission est exclu ; à temps, il attend la diffusion de l’avis', () => {
    const d = donnees({ comptes: [avecPrelevement(comptes[0], mandat()), comptes[1], comptes[2]] })
    const tropTot = ligneDe(vueAvisAppel(d, contexte({ dateEmission: '2026-12-25', datePrelevement: '2027-01-05' })), 'c1')
    expect(tropTot?.etat).toBe('exclu')
    expect(tropTot?.motif).toMatch(/14 jours calendaires/)
    const aTemps = ligneDe(vueAvisAppel(d, contexte({ dateEmission: '2026-12-01', datePrelevement: '2027-01-05' })), 'c1')
    expect(aTemps).toMatchObject({ etat: 'attente_diffusion', montantCentimes: 45_001 })
  })

  it('comptes sans prélèvement : hors du lot ; date de prélèvement proposée = exigibilité, au plus tôt 14 jours après l’émission', () => {
    const vue = vueAvisAppel(donnees(), contexte())
    expect(vue.prelevements?.lignes).toEqual([])
    expect(datePrelevementProposee(['2027-01-01'], '2026-12-01')).toBe('2027-01-01')
    expect(datePrelevementProposee(['2027-01-01'], '2026-12-25')).toBe('2027-01-08')
  })
})

describe('montant saisi', () => {
  it('euros au centime près, espaces et virgule admis ; sinon null', () => {
    expect(centimesDepuisSaisie('1 000,01')).toBe(100_001)
    expect(centimesDepuisSaisie('1 250')).toBe(125_000)
    expect(centimesDepuisSaisie(' 12.5 ')).toBe(1_250)
    expect(centimesDepuisSaisie('0,07')).toBe(7)
    for (const illisible of ['', '12,345', '-5', 'abc', '1,2,3']) expect(centimesDepuisSaisie(illisible)).toBeNull()
  })
})

describe('indicateurs de l’écran', () => {
  it('à appeler, appelé, prochaine exigibilité, comptes copropriétaires', () => {
    const appelee = { ...echeances[0], statut: 'Appelé' as const, traitementId: 't', echeancesDeLAppel: [echeances[0].id] }
    expect(indicateursAppels([appelee, echeances[1], echeances[2]], comptes)).toEqual({
      aAppelerNombre: 2,
      aAppelerCentimes: 63_000,
      appeleCentimes: 100_001,
      prochaineExigibilite: '2027-04-01',
      comptes: 3,
    })
    expect(indicateursAppels([], []).prochaineExigibilite).toBeNull()
  })
})
