import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DELAI_PREAVIS_SEPA_JOURS,
  contenuAvisAppel,
  echeancesPrelevementDepuisAvis,
  preparerDiffusionAvis,
  type ContenuAvisAppel,
  type ContenuAvisCompte,
  type DiffusionAvisCompte,
  type MandatPrelevement,
  type OptionsContenuAvis,
  type OptionsDiffusionAvis,
  type ReglementCompte,
} from '@/lib/administrateur-judiciaire/domain/avis-appel'
import { controlerContexteFusion, controlerFormeEnvoi, gabaritCourrier } from '@/lib/administrateur-judiciaire/domain/gabarits-courrier'
import {
  creerAdresseDatee,
  creerCompteCoproprietaire,
  creerIdentite,
  creerPosition,
  type Position,
} from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { genererPain008, preparerLotPrelevements } from '@/lib/administrateur-judiciaire/domain/prelevements-sepa'
import { avisDAppel, creerCleRepartition, type EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import { creerOperationTravaux, echeancesTravaux, emploisFondsTravauxDesTranches } from '@/lib/administrateur-judiciaire/domain/travaux-operations'
import { creerCommunicationAdresseElectronique, creerDemandeVoiePostale } from '@/lib/administrateur-judiciaire/domain/voie-notification'

/**
 * Contenu de l'avis d'appel, adaptateur vers le prélèvement SEPA et préparation de la diffusion (point 17 du bilan 2 ;
 * Gestéam, tranche 30 § Appels copropriétaires et § Échéancier, tranche 43 § 8 et § 22).
 * Droit relu sur Légifrance le 29/10/2026 : L. 1965 art. 14-1, 14-2-1, 18 II, 29-1 ; D. 1967 art. 10, 35-2, 62-9, 64-2,
 * 64-4, 64-9, 65. Règl. (UE) n° 260/2012 (EUR-Lex) ; recueil EPC SDD Core 2025 (PT-04.02, DS-01).
 * Pré-notification SEPA (14 jours), séquence FRST, caducité du mandat (36 mois) : recueil EPC SDD Core 2025, règles du
 * schéma et non textes de loi. Données fictives : aucun copropriétaire réel, IBAN de test publiés, ICS d'exemple.
 */

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
  creerCompteCoproprietaire({ id: 'cpt-A', coproprieteId: 'copro-1', serie: '1', libelle: 'Copropriétaire A' }),
  creerCompteCoproprietaire({ id: 'cpt-B', coproprieteId: 'copro-1', serie: '2', libelle: 'Copropriétaire B' }),
]
const position = (id: string, lotId: string, compteId: string, identiteId = `i-${compteId}`): Position =>
  creerPosition({ id, identiteId, lotId, compteId, qualite: 'Copropriétaire', part: { numerateur: 1, denominateur: 1 }, statut: 'En place', dateEntree: '2020-01-01', dateSortie: null })
const positions = [position('p1', 'lot-1', 'cpt-A'), position('p2', 'lot-2', 'cpt-B')]

const echeances: EcheanceAppel[] = [
  { id: 'B-2027-001-1', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2027-01-01', libelle: 'Budget 2027 — provision 1/4', montantCentimes: 100_000, nature: 'budget' },
  { id: 'FT-2027-1', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2027-01-01', libelle: 'Fonds de travaux 2027 — appel n° 1', montantCentimes: 5_000, nature: 'fonds_travaux' },
  { id: '00042-T1', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2027-01-01', libelle: 'Ravalement — appel n° 1 (30 %)', montantCentimes: 30_000, nature: 'travaux' },
]
const avis = avisDAppel({ echeances, cles: [cle], positions, comptes, soldesAnterieurs: { 'cpt-A': 10_000, 'cpt-B': -5_000 } })

const IBAN_DEBITEUR = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_SYNDICAT = 'FR14 2004 1010 0505 0001 3M02 606'
const ICS = 'FR12ZZZ123456'

const mandat = (surcharge: Partial<MandatPrelevement> = {}): MandatPrelevement => ({
  rum: 'RUM-TILL-00001',
  dateSignature: '2024-03-01',
  debiteur: 'Copropriétaire A',
  debiteurIdentiteId: 'i-cpt-A',
  iban: IBAN_DEBITEUR,
  bic: 'AGRIFRPP',
  dernierPrelevementLe: '2026-10-05',
  natures: { budget: true, autres: false },
  maxiCentimes: null,
  ...surcharge,
})
const reglements = (mandatA: MandatPrelevement | null = mandat()): ReglementCompte[] => [
  { compteId: 'cpt-A', mode: 'Prélèvement', mandat: mandatA },
  { compteId: 'cpt-B', mode: 'Virement' },
]
const options = (surcharge: Partial<OptionsContenuAvis> = {}): OptionsContenuAvis => ({
  cles: [cle],
  comptes,
  segmentSyndicat: 'TILL',
  syndicat: { nom: 'SDC Les Tilleuls (fictif)', adresse: '12 rue des Tilleuls, 13001 Marseille' },
  ibanSyndicat: IBAN_SYNDICAT,
  ics: ICS,
  dateEmission: '2026-12-15',
  reglements: reglements(),
  datePrelevement: '2027-01-05',
  ...surcharge,
})
const compteDe = (contenu: { parCompte: ContenuAvisCompte[] }, compteId: string): ContenuAvisCompte => {
  const trouve = contenu.parCompte.find((c) => c.compteId === compteId)
  if (!trouve) throw new Error(`compte ${compteId} absent`)
  return trouve
}
const codes = (compte: ContenuAvisCompte) => compte.anomalies.map((a) => a.code)
const bloquantsDe = (compte: ContenuAvisCompte) => compte.anomalies.filter((x) => x.gravite === 'bloquant').map((x) => x.code)
const cheques: ReglementCompte[] = [
  { compteId: 'cpt-A', mode: 'Chèque' },
  { compteId: 'cpt-B', mode: 'Chèque' },
]

const adresse = (id: string) =>
  creerAdresseDatee({ id, lignes: ['1 rue Fictive'], codePostal: '13001', ville: 'Marseille', pays: 'France', usage: null, du: '2020-01-01', au: null, communiqueeLe: null })
const identites = [
  creerIdentite({ id: 'i-cpt-A', nature: 'physique', civilite: 'Madame', nom: 'Copropriétaire A', prenom: 'Fictive', telecoms: [], adresses: [adresse('adr-A')] }),
  creerIdentite({ id: 'i-cpt-B', nature: 'physique', civilite: 'Monsieur', nom: 'Copropriétaire B', prenom: 'Fictif', telecoms: [], adresses: [adresse('adr-B')] }),
  creerIdentite({ id: 'i-cpt-B2', nature: 'physique', civilite: 'Madame', nom: 'Indivisaire B2', prenom: 'Fictive', telecoms: [], adresses: [] }),
]
const socle = {
  'copropriete.nom': 'Les Tilleuls (fictif)',
  'copropriete.adresse': '12 rue des Tilleuls, 13001 Marseille',
  'mandat.fondement': 'L. 1965 art. 29-1',
  'mandat.tribunal': 'TJ de Marseille',
  'mandat.ordonnance': '2026-03-02',
  'mandat.rg': '26/01234',
}
const diffusion = (surcharge: Partial<OptionsDiffusionAvis> = {}): OptionsDiffusionAvis => ({
  date: '2026-12-15',
  coproprieteId: 'copro-1',
  mandatId: 'mandat-1',
  socle,
  modeles: { electronique: { id: 'mod-email', formeEnvoi: 'Email direct' }, postal: { id: 'mod-postal', formeEnvoi: 'Normal' } },
  identites,
  positions,
  demandesVoiePostale: [],
  communications: [creerCommunicationAdresseElectronique({ identiteId: 'i-cpt-A', adresse: 'a@exemple.invalid', communiqueeLe: '2026-01-10' })],
  ...surcharge,
})
/** Diffusion à la date d'émission (par défaut) : entrée obligatoire de l'adaptateur vers le prélèvement. */
const diffuse = (contenu: ContenuAvisAppel, surcharge: Partial<OptionsDiffusionAvis> = {}) =>
  preparerDiffusionAvis(contenu, diffusion({ date: contenu.dateEmission, ...surcharge }))

describe('contenu de l’avis — totaux, lignes et date limite', () => {
  it('reprend les totaux de l’avis : provisions + travaux + souscription = total appelé ; solde antérieur et total à payer signés', () => {
    const contenu = contenuAvisAppel(avis, options())
    const a = compteDe(contenu, 'cpt-A')
    expect(a).toMatchObject({
      numeroCompte: 'TILL.45000.00001.0',
      libelleCompte: 'Copropriétaire A',
      dateEmission: '2026-12-15',
      provisionsCentimes: 40_000,
      travauxCentimes: 12_000,
      souscriptionFondsTravauxCentimes: 2_000,
      totalAppeleCentimes: 54_000,
      soldeAnterieurCentimes: 10_000,
      totalAPayerCentimes: 64_000,
    })
    const b = compteDe(contenu, 'cpt-B')
    expect([b.totalAppeleCentimes, b.soldeAnterieurCentimes, b.totalAPayerCentimes]).toEqual([81_000, -5_000, 76_000])
    for (const c of contenu.parCompte)
      expect(c.provisionsCentimes + c.travauxCentimes + c.souscriptionFondsTravauxCentimes).toBe(c.totalAppeleCentimes)
  })

  it('grille Gestéam « Type · Libellé · Budget · Copro. · Clé · Quote-part » : une ligne par échéance et lot', () => {
    const a = compteDe(contenuAvisAppel(avis, options()), 'cpt-A')
    expect(a.lignes[0]).toEqual({
      echeanceId: 'B-2027-001-1',
      nature: 'budget',
      typeAppel: 'Budget',
      libelle: 'Budget 2027 — provision 1/4',
      exigibilite: '2027-01-01',
      lotId: 'lot-1',
      cle: '001',
      baseCentimes: 100_000,
      quotePartCentimes: 40_000,
      tantiemes: { lot: 400, total: 1000 },
    })
    expect(a.lignes.map((l) => l.typeAppel)).toEqual(['Budget', 'Fonds travaux', 'Travaux'])
    expect(a.parExigibilite).toEqual([{ exigibilite: '2027-01-01', montantCentimes: 54_000 }])
  })

  it('refuse un avis qui porte des anomalies, comme l’écriture de l’appel', () => {
    const enAnomalie = avisDAppel({ echeances, cles: [cle], positions: [positions[0]], comptes })
    expect(() => contenuAvisAppel(enAnomalie, options())).toThrow(/anomalie/i)
  })

  it('« À régler avant le » : exigibilité, plus un délai de gestion facultatif, jamais avant l’exigibilité', () => {
    expect(compteDe(contenuAvisAppel(avis, options()), 'cpt-A').aReglerAvantLe).toBe('2027-01-01')
    expect(compteDe(contenuAvisAppel(avis, options({ delaiReglementJours: 10 })), 'cpt-A').aReglerAvantLe).toBe('2027-01-11')
    expect(() => contenuAvisAppel(avis, options({ delaiReglementJours: -1 }))).toThrow(/délai/i)
    expect(() => contenuAvisAppel(avis, options({ dateEmission: '15/12/2026' }))).toThrow(/AAAA-MM-JJ/)
  })

  it('plusieurs exigibilités sur un même avis : la plus tardive fixe la date limite, information signalée', () => {
    const deux = avisDAppel({
      echeances: [echeances[0], { ...echeances[2], exigibilite: '2027-03-01' }],
      cles: [cle],
      positions,
      comptes,
    })
    const a = compteDe(contenuAvisAppel(deux, options({ reglements: [{ compteId: 'cpt-A', mode: 'Chèque' }, { compteId: 'cpt-B', mode: 'Chèque' }] })), 'cpt-A')
    expect(a.aReglerAvantLe).toBe('2027-03-01')
    expect(a.parExigibilite).toEqual([
      { exigibilite: '2027-01-01', montantCentimes: 40_000 },
      { exigibilite: '2027-03-01', montantCentimes: 12_000 },
    ])
    expect(a.anomalies).toContainEqual(expect.objectContaining({ code: 'exigibilites_multiples', gravite: 'information' }))
  })

  it('avis émis le jour de l’exigibilité ou après : avertissement (D. 1967 art. 35-2 : avis préalable)', () => {
    const tardif = compteDe(contenuAvisAppel(avis, options({ dateEmission: '2027-01-01', reglements: cheques })), 'cpt-A')
    expect(tardif.anomalies).toContainEqual(expect.objectContaining({ code: 'emis_apres_exigibilite', gravite: 'avertissement', fondement: 'D. 1967 art. 35-2' }))
    const apres = compteDe(contenuAvisAppel(avis, options({ dateEmission: '2027-01-02', reglements: cheques })), 'cpt-A')
    expect(apres.anomalies).toContainEqual(expect.objectContaining({ code: 'emis_apres_exigibilite', gravite: 'avertissement' }))
    expect(codes(compteDe(contenuAvisAppel(avis, options()), 'cpt-A'))).not.toContain('emis_apres_exigibilite')
  })

  it('avis émis avant le 25/12/2025 : régime antérieur signalé', () => {
    const ancien = avisDAppel({ echeances: echeances.map((e) => ({ ...e, exigibilite: '2026-01-01' })), cles: [cle], positions, comptes })
    const contenu = contenuAvisAppel(ancien, options({ dateEmission: '2025-12-10', datePrelevement: '2026-01-05' }))
    expect(contenu.anomalies).toContainEqual(expect.objectContaining({ code: 'regime_anterieur', gravite: 'avertissement' }))
  })
})

describe('emploi du fonds de travaux — information ventilée par compte', () => {
  const emploi = { echeanceId: '00042-T1', plafondCentimes: 10_000, affectation: { objet: 'travaux_hors_ppt' as const, decisionAg: 'Résolution 8 (AG du 12/03/2026)' } }

  it('ventilé sur la clé de la dépense au centime près, sans entrer dans le total appelé', () => {
    const contenu = contenuAvisAppel(avis, options({ emploisFonds: [emploi] }))
    const a = compteDe(contenu, 'cpt-A')
    const b = compteDe(contenu, 'cpt-B')
    expect(a.emploiFondsTravaux).toEqual([{ echeanceId: '00042-T1', lotId: 'lot-1', cle: '001', centimes: 4_000 }])
    expect([a.emploiFondsTravauxCentimes, b.emploiFondsTravauxCentimes]).toEqual([4_000, 6_000])
    expect(a.totalAppeleCentimes).toBe(54_000)
    expect(contenu.anomalies.filter((x) => x.gravite === 'bloquant')).toEqual([])
  })

  it('affectation refusée par le contrôle J4 : anomalie bloquante, avec motif et fondement', () => {
    const contenu = contenuAvisAppel(avis, options({ emploisFonds: [{ ...emploi, affectation: { objet: 'charges_courantes' } }] }))
    expect(contenu.anomalies).toContainEqual(expect.objectContaining({ code: 'emploi_fonds_non_autorise', gravite: 'bloquant', fondement: 'L. 1965 art. 14-2-1, I' }))
    const sansDecision = contenuAvisAppel(avis, options({ emploisFonds: [{ ...emploi, affectation: { objet: 'travaux_hors_ppt' } }] }))
    expect(sansDecision.anomalies.map((x) => x.code)).toContain('emploi_fonds_non_autorise')
  })

  it('refuse un emploi sur une échéance qui n’est pas de travaux, inconnue ou en double', () => {
    expect(() => contenuAvisAppel(avis, options({ emploisFonds: [{ ...emploi, echeanceId: 'B-2027-001-1' }] }))).toThrow(/travaux/i)
    expect(() => contenuAvisAppel(avis, options({ emploisFonds: [{ ...emploi, echeanceId: 'X' }] }))).toThrow(/inconnue|absente/i)
    expect(() => contenuAvisAppel(avis, options({ emploisFonds: [emploi, emploi] }))).toThrow(/double/i)
  })

  it('emploi supérieur au solde du fonds : bloquant ; sous le montant bloqué du cabinet : alerte de gestion sans fondement', () => {
    expect(contenuAvisAppel(avis, options({ emploisFonds: [emploi], soldeFondsCentimes: 9_999 })).anomalies).toContainEqual(
      expect.objectContaining({ code: 'emploi_superieur_au_fonds', gravite: 'bloquant' }),
    )
    const alerte = contenuAvisAppel(avis, options({ emploisFonds: [emploi], soldeFondsCentimes: 50_000, reglagesFonds: { montantBloqueCentimes: 45_000 } }))
    expect(alerte.anomalies).toContainEqual(expect.objectContaining({ code: 'sous_montant_bloque', gravite: 'avertissement', fondement: null }))
  })

  it('plafonds par tranche d’une opération : part du fonds × taux, même arrondi que les appels', () => {
    const operation = creerOperationTravaux({
      numero: '00042',
      coproprieteId: 'copro-1',
      libelle: 'Ravalement',
      cleId: 'cle-001',
      decision: { date: '2026-03-12', resolution: 'Résolution 8' },
      budgetTtcCentimes: 101_000,
      financementFondsTravauxCentimes: 1_000,
      affectationFonds: { objet: 'travaux_hors_ppt' },
      tranches: [
        { date: '2027-01-01', tauxPct: 33.33 },
        { date: '2027-04-01', tauxPct: 33.33 },
        { date: '2027-07-01', tauxPct: 33.34 },
      ],
    })
    const emplois = emploisFondsTravauxDesTranches(operation)
    expect(emplois.map((e) => [e.echeanceId, e.plafondCentimes])).toEqual([
      ['00042-T1', 333],
      ['00042-T2', 333],
      ['00042-T3', 334],
    ])
    expect(emplois[0].affectation).toEqual({ objet: 'travaux_hors_ppt', decisionAg: 'Résolution 8 (AG du 12/03/2026)', autorisationJuge: null })
    expect(echeancesTravaux(operation).map((e) => e.montantCentimes)).toEqual([33_330, 33_330, 33_340])
    expect(emploisFondsTravauxDesTranches({ ...operation, financementFondsTravauxCentimes: 0, montantAAppelerCentimes: 101_000 })).toEqual([])
    const avisTravaux = avisDAppel({ echeances: echeancesTravaux(operation), cles: [cle], positions, comptes })
    const contenu = contenuAvisAppel(avisTravaux, options({ emploisFonds: emplois, reglements: [{ compteId: 'cpt-A', mode: 'Chèque' }, { compteId: 'cpt-B', mode: 'Chèque' }] }))
    expect(contenu.parCompte.reduce((s, c) => s + c.emploiFondsTravauxCentimes, 0)).toBe(1_000)
  })
})

describe('règlement — prélèvement, virement, chèque', () => {
  it('prélèvement : montant pré-notifié = natures couvertes par le mandat, sans le solde antérieur ; reste hors prélèvement', () => {
    const a = compteDe(contenuAvisAppel(avis, options()), 'cpt-A')
    expect(a.modeReglement).toBe('Prélèvement')
    expect(a.instructions).toMatchObject({ mode: 'Prélèvement', date: '2027-01-05', montantCentimes: 40_000, resteHorsPrelevementCentimes: 24_000, rum: 'RUM-TILL-00001', ics: ICS })
    const tout = compteDe(contenuAvisAppel(avis, options({ reglements: reglements(mandat({ natures: { budget: true, autres: true } })) })), 'cpt-A')
    expect(tout.instructions).toMatchObject({ montantCentimes: 54_000, resteHorsPrelevementCentimes: 10_000 })
    const plafonne = compteDe(contenuAvisAppel(avis, options({ reglements: reglements(mandat({ maxiCentimes: 30_000 })) })), 'cpt-A')
    expect(plafonne.instructions).toMatchObject({ montantCentimes: 30_000 })
  })

  it('compte créditeur : rien n’est prélevé au-delà du total à payer', () => {
    const crediteur = avisDAppel({ echeances, cles: [cle], positions, comptes, soldesAnterieurs: { 'cpt-A': -60_000 } })
    const a = compteDe(contenuAvisAppel(crediteur, options()), 'cpt-A')
    expect(a.totalAPayerCentimes).toBe(-6_000)
    expect(a.instructions).toMatchObject({ montantCentimes: 0, resteHorsPrelevementCentimes: -6_000 })
  })

  it('aucune nature appelée couverte par le mandat : avertissement', () => {
    const travauxSeuls = avisDAppel({ echeances: [echeances[2]], cles: [cle], positions, comptes })
    const a = compteDe(contenuAvisAppel(travauxSeuls, options()), 'cpt-A')
    expect(a.instructions).toMatchObject({ montantCentimes: 0 })
    expect(a.anomalies).toContainEqual(expect.objectContaining({ code: 'nature_non_couverte', gravite: 'avertissement' }))
  })

  it(`pré-notification : ${DELAI_PREAVIS_SEPA_JOURS} jours calendaires au moins entre l’émission et le débit, sauf délai convenu dans le mandat`, () => {
    expect(codes(compteDe(contenuAvisAppel(avis, options({ dateEmission: '2026-12-22' })), 'cpt-A'))).not.toContain('preavis_insuffisant')
    const court = compteDe(contenuAvisAppel(avis, options({ dateEmission: '2026-12-23' })), 'cpt-A')
    expect(court.anomalies).toContainEqual(expect.objectContaining({ code: 'preavis_insuffisant', gravite: 'bloquant' }))
    const convenu = compteDe(contenuAvisAppel(avis, options({ dateEmission: '2026-12-28', reglements: reglements(mandat({ delaiPreavisJours: 5 })) })), 'cpt-A')
    expect(codes(convenu)).not.toContain('preavis_insuffisant')
  })

  it('bloque : mandat absent, révoqué, signé après l’émission, inutilisé depuis 36 mois, incomplet ; ICS invalide ; date absente ; débit avant l’exigibilité', () => {
    const bloquants = (o: Partial<OptionsContenuAvis>) =>
      compteDe(contenuAvisAppel(avis, options(o)), 'cpt-A').anomalies.filter((x) => x.gravite === 'bloquant').map((x) => x.code)
    expect(bloquants({ reglements: reglements(null) })).toEqual(['mandat_absent'])
    expect(bloquants({ reglements: reglements(mandat({ revoqueLe: '2026-12-20' })) })).toEqual(['mandat_revoque'])
    expect(bloquants({ reglements: reglements(mandat({ revoqueLe: '2027-02-01' })) })).toEqual([])
    expect(bloquants({ reglements: reglements(mandat({ dateSignature: '2026-12-16', dernierPrelevementLe: null })) })).toEqual(['mandat_non_signe'])
    expect(bloquants({ reglements: reglements(mandat({ dernierPrelevementLe: '2024-01-05' })) })).toEqual(['mandat_caduc'])
    expect(bloquants({ reglements: reglements(mandat({ dernierPrelevementLe: '2024-01-06' })) })).toEqual([])
    expect(bloquants({ reglements: reglements(mandat({ iban: 'FR76 3000 6000 0112 3456 7890 188' })) })).toEqual(['mandat_incomplet'])
    expect(bloquants({ reglements: reglements(mandat({ rum: ' ' })) })).toEqual(['mandat_incomplet'])
    expect(bloquants({ ics: 'FR12ZZZ12345' })).toEqual(['ics_invalide'])
    expect(bloquants({ ics: null })).toEqual(['ics_invalide'])
    expect(bloquants({ datePrelevement: null })).toEqual(['date_prelevement_absente'])
    expect(bloquants({ datePrelevement: '2026-12-31' })).toEqual(['avant_exigibilite'])
    expect(compteDe(contenuAvisAppel(avis, options({ reglements: reglements(null) })), 'cpt-A').instructions).toBeNull()
  })

  it('virement : IBAN du compte courant du syndicat, référence = n° de compte 450 ; IBAN absent ou invalide : bloquant', () => {
    const b = compteDe(contenuAvisAppel(avis, options()), 'cpt-B')
    expect(b.instructions).toEqual({ mode: 'Virement', beneficiaire: 'SDC Les Tilleuls (fictif)', iban: 'FR1420041010050500013M02606', reference: 'TILL.45000.00002.0' })
    for (const ibanSyndicat of [null, 'FR14 2004 1010 0505 0001 3M02 605']) {
      const sans = compteDe(contenuAvisAppel(avis, options({ ibanSyndicat })), 'cpt-B')
      expect(sans.instructions).toBeNull()
      expect(sans.anomalies).toContainEqual(expect.objectContaining({ code: 'iban_syndicat_invalide', gravite: 'bloquant' }))
    }
  })

  it('chèque, TIP, espèces, « Pas de règlement », compte sans règlement', () => {
    const avec = (mode: ReglementCompte['mode']) =>
      compteDe(contenuAvisAppel(avis, options({ reglements: [{ compteId: 'cpt-A', mode }, { compteId: 'cpt-B', mode: 'Virement' }] })), 'cpt-A')
    expect(avec('Chèque').instructions).toEqual({ mode: 'Chèque', ordre: 'SDC Les Tilleuls (fictif)', adresseEnvoi: '12 rue des Tilleuls, 13001 Marseille', reference: 'TILL.45000.00001.0' })
    expect(codes(avec('TIP'))).toContain('mode_non_pris_en_charge')
    expect(codes(avec('Espèces'))).toContain('mode_non_pris_en_charge')
    expect(avec('Pas de règlement').anomalies).toContainEqual(expect.objectContaining({ code: 'reglement_attendu', gravite: 'avertissement' }))
    const sans = compteDe(contenuAvisAppel(avis, options({ reglements: [{ compteId: 'cpt-B', mode: 'Virement' }] })), 'cpt-A')
    expect(sans.modeReglement).toBeNull()
    expect(sans.anomalies).toContainEqual(expect.objectContaining({ code: 'reglement_absent', gravite: 'bloquant' }))
    expect(() => contenuAvisAppel(avis, options({ reglements: [...reglements(), { compteId: 'cpt-A', mode: 'Chèque' }] }))).toThrow(/double/i)
  })

  it('cotisations au fonds de travaux appelées : information de virement vers le compte séparé (L. 1965 art. 18, II)', () => {
    expect(contenuAvisAppel(avis, options()).anomalies).toContainEqual(
      expect.objectContaining({ code: 'cotisation_a_virer', gravite: 'information', fondement: 'L. 1965 art. 18, II' }),
    )
  })
})

describe('mentions de l’avis', () => {
  it('toujours : faculté de voie postale (D. 1967 art. 64-2) et rappel de l’art. 10 (questions à l’ordre du jour)', () => {
    const a = compteDe(contenuAvisAppel(avis, options()), 'cpt-A')
    const voie = a.mentions.find((m) => m.cle === 'voie_postale')
    expect(voie?.fondement).toBe('D. 1967 art. 64-2, 64-4')
    expect(voie?.texte).toMatch(/au syndic/)
    const odj = a.mentions.find((m) => m.cle === 'ordre_du_jour')
    expect(odj?.fondement).toBe('D. 1967 art. 10')
    expect(odj?.texte).toMatch(/inscrites à l'ordre du jour d'une assemblée générale/)
    const ap = compteDe(contenuAvisAppel(avis, options({ administrateurProvisoire: true })), 'cpt-A').mentions.find((m) => m.cle === 'voie_postale')
    expect(ap?.fondement).toBe('D. 1967 art. 64-2, 64-4, 64-9')
    expect(ap?.texte).toMatch(/administrateur provisoire/)
  })

  it('souscription au fonds : sommes acquises au syndicat ; prélèvement : mention de pré-notification (montant, date, RUM, ICS)', () => {
    const a = compteDe(contenuAvisAppel(avis, options()), 'cpt-A')
    expect(a.mentions.map((m) => m.cle)).toEqual(['voie_postale', 'ordre_du_jour', 'fonds_travaux', 'prenotification'])
    expect(a.mentions.find((m) => m.cle === 'fonds_travaux')?.fondement).toBe('L. 1965 art. 14-2-1, III')
    const pre = a.mentions.find((m) => m.cle === 'prenotification')
    expect(pre?.texte).toMatch(/400,00/)
    expect(pre?.texte).toMatch(/05\/01\/2027/)
    expect(pre?.texte).toMatch(/RUM-TILL-00001/)
    expect(pre?.texte).toMatch(/FR12ZZZ123456/)
    expect(pre?.fondement).toMatch(/EPC/)
    const sansFonds = avisDAppel({ echeances: [echeances[0]], cles: [cle], positions, comptes })
    expect(compteDe(contenuAvisAppel(sansFonds, options()), 'cpt-B').mentions.map((m) => m.cle)).toEqual(['voie_postale', 'ordre_du_jour'])
  })
})

describe('adaptateur avis → échéances de prélèvement', () => {
  const creancier = { nom: 'SDC Les Tilleuls (fictif)', ics: ICS, iban: IBAN_SYNDICAT, bic: 'PSSTFRPP' }

  it('chaîne complète : avis → EcheancePrelevement → lot → pain.008 (n° 450 lu par le débiteur, date de l’avis)', () => {
    const contenu = contenuAvisAppel(avis, options())
    const { echeances: aPrelever, ecartees } = echeancesPrelevementDepuisAvis(contenu, { prefixeId: 'AV-2027-01', diffusions: diffuse(contenu) })
    expect(aPrelever).toEqual([
      {
        id: 'AV-2027-01-00001',
        compteCoproprietaire: 'TILL.45000.00001.0',
        debiteur: 'Copropriétaire A',
        iban: IBAN_DEBITEUR,
        bic: 'AGRIFRPP',
        rum: 'RUM-TILL-00001',
        dateSignatureMandat: '2024-03-01',
        sequence: 'RCUR',
        montantEcheanceCentimes: 40_000,
        soldeDuCentimes: 64_000,
        contentieux: false,
      },
    ])
    expect(ecartees).toEqual([{ compteId: 'cpt-B', motif: 'mode_reglement', codes: [] }])
    const lot = preparerLotPrelevements(aPrelever)
    expect(lot.totalCentimes).toBe(40_000)
    const xml = genererPain008(lot, creancier, { messageId: 'AV-2027-01', dateCreation: '2026-12-15T10:00:00', dateEcheance: contenu.datePrelevement as string })
    expect(xml).toContain('<Ustrd>TILL.45000.00001.0</Ustrd>')
    expect(xml).toContain('<ReqdColltnDt>2027-01-05</ReqdColltnDt>')
    expect(xml).toContain('<InstdAmt Ccy="EUR">400.00</InstdAmt>')
    expect(xml).toContain('<SeqTp>RCUR</SeqTp>')
  })

  it('premier prélèvement du mandat : séquence FRST', () => {
    const contenu = contenuAvisAppel(avis, options({ reglements: reglements(mandat({ dernierPrelevementLe: null })) }))
    expect(echeancesPrelevementDepuisAvis(contenu, { prefixeId: 'AV', diffusions: diffuse(contenu) }).echeances[0].sequence).toBe('FRST')
  })

  it('jamais plus que le montant pré-notifié ; solde dû et contentieux fournis par l’appelant', () => {
    const contenu = contenuAvisAppel(avis, options())
    const [e] = echeancesPrelevementDepuisAvis(contenu, { prefixeId: 'AV', diffusions: diffuse(contenu), soldesDus: { 'cpt-A': 25_000 }, comptesEnContentieux: new Set(['cpt-A']) }).echeances
    expect([e.montantEcheanceCentimes, e.soldeDuCentimes, e.contentieux]).toEqual([40_000, 25_000, true])
    expect(preparerLotPrelevements([e]).exclues).toEqual([{ id: 'AV-00001', motif: 'contentieux' }])
    expect(preparerLotPrelevements([e], { exclureContentieux: false }).retenues[0].montantCentimes).toBe(25_000)
    expect(() => echeancesPrelevementDepuisAvis(contenu, { prefixeId: 'AV', diffusions: diffuse(contenu), soldesDus: { 'cpt-A': 1.5 } })).toThrow(/solde/i)
  })

  it('écarte un compte au contenu bloqué (avec ses codes) ou sans montant à prélever', () => {
    const bloque = contenuAvisAppel(avis, options({ dateEmission: '2026-12-23' }))
    expect(echeancesPrelevementDepuisAvis(bloque, { prefixeId: 'AV', diffusions: diffuse(bloque) }).ecartees).toContainEqual({ compteId: 'cpt-A', motif: 'contenu_bloque', codes: ['preavis_insuffisant'] })
    const sansMandat = contenuAvisAppel(avis, options({ reglements: reglements(null) }))
    expect(echeancesPrelevementDepuisAvis(sansMandat, { prefixeId: 'AV', diffusions: diffuse(sansMandat) }).ecartees).toContainEqual({ compteId: 'cpt-A', motif: 'contenu_bloque', codes: ['mandat_absent'] })
    const travauxSeuls = contenuAvisAppel(avisDAppel({ echeances: [echeances[2]], cles: [cle], positions, comptes }), options())
    expect(echeancesPrelevementDepuisAvis(travauxSeuls, { prefixeId: 'AV', diffusions: diffuse(travauxSeuls) }).ecartees).toContainEqual({ compteId: 'cpt-A', motif: 'montant_nul', codes: ['nature_non_couverte'] })
    const emploiRefuse = contenuAvisAppel(avis, options({ emploisFonds: [{ echeanceId: '00042-T1', plafondCentimes: 10_000, affectation: { objet: 'charges_courantes' } }] }))
    expect(echeancesPrelevementDepuisAvis(emploiRefuse, { prefixeId: 'AV', diffusions: diffuse(emploiRefuse) }).ecartees).toContainEqual({ compteId: 'cpt-A', motif: 'contenu_bloque', codes: ['emploi_fonds_non_autorise'] })
  })

  it('identifiant de bout en bout limité à 35 caractères (format ISO 20022 XML : Règl. 260/2012, annexe, point 1 b))', () => {
    const contenu = contenuAvisAppel(avis, options())
    expect(() => echeancesPrelevementDepuisAvis(contenu, { prefixeId: 'X'.repeat(30), diffusions: diffuse(contenu) })).toThrow(/35/)
    expect(() => echeancesPrelevementDepuisAvis(contenu, { prefixeId: 'X'.repeat(30), diffusions: diffuse(contenu) })).toThrow(/annexe, point 1 b\)/)
  })
})

describe('retours de relecture du point 17 — prélèvement et pré-notification', () => {
  it('le lot ne prélève que le compte dont le détenteur a reçu l’avis à temps : diffusion tardive, sans adresse ou absente, écartée', () => {
    const contenu = contenuAvisAppel(avis, options())
    expect(echeancesPrelevementDepuisAvis(contenu, { prefixeId: 'AV', diffusions: diffuse(contenu) }).echeances.map((e) => e.id)).toEqual(['AV-00001'])
    const tard = echeancesPrelevementDepuisAvis(contenu, { prefixeId: 'AV', diffusions: preparerDiffusionAvis(contenu, diffusion({ date: '2026-12-23' })) })
    expect(tard.echeances).toEqual([])
    expect(tard.ecartees).toContainEqual({ compteId: 'cpt-A', motif: 'prenotification_absente', codes: ['preavis_insuffisant'] })
    expect(preparerLotPrelevements(tard.echeances).totalCentimes).toBe(0)
    const sansAdresse = identites.map((i) => (i.id === 'i-cpt-A' ? { ...i, adresses: [] } : i))
    const nonEnvoye = echeancesPrelevementDepuisAvis(contenu, { prefixeId: 'AV', diffusions: diffuse(contenu, { identites: sansAdresse, communications: [] }) })
    expect(nonEnvoye.echeances).toEqual([])
    expect(nonEnvoye.ecartees).toContainEqual(expect.objectContaining({ compteId: 'cpt-A', motif: 'prenotification_absente', codes: expect.arrayContaining(['sans_adresse']) }))
    expect(echeancesPrelevementDepuisAvis(contenu, { prefixeId: 'AV', diffusions: [] }).ecartees).toContainEqual({ compteId: 'cpt-A', motif: 'prenotification_absente', codes: [] })
  })

  it('pré-notification adressée au détenteur du compte débité, même s’il n’est pas copropriétaire (recueil EPC, PT-04.02)', () => {
    const tiers = creerIdentite({ id: 'i-tiers', nature: 'physique', civilite: 'Madame', nom: 'Tiers payeur', prenom: 'Fictive', telecoms: [], adresses: [adresse('adr-T')] })
    const contenu = contenuAvisAppel(avis, options({ reglements: reglements(mandat({ debiteur: 'Tiers payeur (fictif)', debiteurIdentiteId: 'i-tiers' })) }))
    const sorties = diffuse(contenu, { identites: [...identites, tiers] })
    const pourA = sorties.filter((s) => s.compteId === 'cpt-A')
    expect(pourA.map((s) => [s.identiteId, s.prenotification])).toEqual([
      ['i-cpt-A', false],
      ['i-tiers', true],
    ])
    expect(pourA[1].courrier).toMatchObject({ personneId: 'i-tiers', statut: 'Préparation' })
    expect(sorties.find((s) => s.compteId === 'cpt-B')?.prenotification).toBe(false)
    const lot = echeancesPrelevementDepuisAvis(contenu, { prefixeId: 'AV', diffusions: sorties })
    expect(lot.echeances.map((e) => e.debiteur)).toEqual(['Tiers payeur (fictif)'])
  })

  it('rien à prélever (compte créditeur, travaux seuls sous un mandat Budget) : les contrôles du débit ne bloquent pas l’avis de l’art. 35-2', () => {
    const crediteur = contenuAvisAppel(avisDAppel({ echeances, cles: [cle], positions, comptes, soldesAnterieurs: { 'cpt-A': -100_000 } }), options({ dateEmission: '2026-12-23' }))
    const a = compteDe(crediteur, 'cpt-A')
    expect(a.instructions).toMatchObject({ mode: 'Prélèvement', montantCentimes: 0 })
    expect(bloquantsDe(a)).toEqual([])
    expect(codes(a)).not.toContain('preavis_insuffisant')
    expect(diffuse(crediteur)[0].courrier).not.toBeNull()
    expect(echeancesPrelevementDepuisAvis(crediteur, { prefixeId: 'AV', diffusions: diffuse(crediteur) }).ecartees).toContainEqual({ compteId: 'cpt-A', motif: 'montant_nul', codes: [] })
    const travauxSeuls = avisDAppel({ echeances: [echeances[2]], cles: [cle], positions, comptes })
    const sansDate = compteDe(contenuAvisAppel(travauxSeuls, options({ datePrelevement: null, ics: null })), 'cpt-A')
    expect(bloquantsDe(sansDate)).toEqual([])
    expect(sansDate.instructions).toMatchObject({ montantCentimes: 0, date: null, horsPrelevement: { mode: 'Virement', reference: 'TILL.45000.00001.0' } })
    const revoque = compteDe(contenuAvisAppel(travauxSeuls, options({ dateEmission: '2026-12-23', reglements: reglements(mandat({ revoqueLe: '2026-12-20' })) })), 'cpt-A')
    expect(bloquantsDe(revoque)).toEqual([])
    expect(revoque.anomalies).toContainEqual(expect.objectContaining({ code: 'mandat_revoque', gravite: 'avertissement' }))
    expect(codes(revoque)).not.toContain('preavis_insuffisant')
  })

  it('prélèvement partiel : la lettre donne le reste à payer et comment le régler (virement, à défaut chèque)', () => {
    const contenu = contenuAvisAppel(avis, options())
    const a = compteDe(contenu, 'cpt-A')
    expect(a.instructions).toMatchObject({ resteHorsPrelevementCentimes: 24_000, horsPrelevement: { mode: 'Virement', iban: 'FR1420041010050500013M02606', reference: 'TILL.45000.00001.0' } })
    expect(a.mentions.find((m) => m.cle === 'prenotification')?.texte).toMatch(/Reste à régler hors prélèvement : 240,00.*virement.*FR1420041010050500013M02606/)
    const [d] = diffuse(contenu)
    expect(d.valeursFusion['reglement.instructions']).toMatch(/Prélèvement SEPA de 400,00.*Reste à régler hors prélèvement : 240,00.*virement.*FR1420041010050500013M02606.*TILL\.45000\.00001\.0/)
    expect(d.valeursFusion['prelevement.resteCentimes']).toBe(24_000)
    expect(d.valeursFusion['mention.prenotification']).toBe(a.mentions.find((m) => m.cle === 'prenotification')?.texte)
    expect(d.valeursFusion['mention.fondsTravaux']).toBe(a.mentions.find((m) => m.cle === 'fonds_travaux')?.texte)
    expect(controlerContexteFusion('avis_appel_fonds', d.valeursFusion)).toMatchObject({ complet: true, inconnus: [] })
    const sansIban = compteDe(contenuAvisAppel(avis, options({ ibanSyndicat: null })), 'cpt-A')
    expect(sansIban.instructions).toMatchObject({ horsPrelevement: { mode: 'Chèque', ordre: 'SDC Les Tilleuls (fictif)', reference: 'TILL.45000.00001.0' } })
  })

  it('compte en contentieux : l’avis n’annonce aucun prélèvement, donne les instructions de virement, et le lot l’écarte', () => {
    const contenu = contenuAvisAppel(avis, options({ comptesEnContentieux: new Set(['cpt-A']) }))
    const a = compteDe(contenu, 'cpt-A')
    expect(a.modeReglement).toBe('Virement')
    expect(a.instructions).toMatchObject({ mode: 'Virement', reference: 'TILL.45000.00001.0' })
    expect(a.mentions.map((m) => m.cle)).not.toContain('prenotification')
    expect(a.anomalies).toContainEqual(expect.objectContaining({ code: 'prelevement_suspendu', gravite: 'avertissement' }))
    expect(diffuse(contenu)[0].valeursFusion).not.toHaveProperty('prelevement.date')
    const lot = echeancesPrelevementDepuisAvis(contenu, { prefixeId: 'AV', diffusions: diffuse(contenu) })
    expect(lot.echeances).toEqual([])
    expect(lot.ecartees).toContainEqual({ compteId: 'cpt-A', motif: 'contentieux', codes: ['prelevement_suspendu'] })
  })

  it('fondements des anomalies de mandat : nom du débiteur (recueil EPC, DS-01) ; antériorité de la signature déduite du consentement', () => {
    const anomalieDe = (m: MandatPrelevement, code: string) =>
      compteDe(contenuAvisAppel(avis, options({ reglements: reglements(m) })), 'cpt-A').anomalies.find((x) => x.code === code)
    expect(anomalieDe(mandat({ debiteur: ' ' }), 'mandat_incomplet')?.fondement).toMatch(/DS-01/)
    const nonSigne = anomalieDe(mandat({ dateSignature: '2026-12-16', dernierPrelevementLe: null }), 'mandat_non_signe')
    expect(nonSigne?.fondement).toMatch(/art\. 5, § 3, a\) ii\)/)
    expect(nonSigne?.fondement).toMatch(/L\. 133-6/)
    expect(nonSigne?.fondement).toMatch(/déduite/)
  })
})

describe('retours de relecture du point 17 — contenu, mentions et diffusion', () => {
  const cle2 = creerCleRepartition({
    id: 'cle-002',
    coproprieteId: 'copro-1',
    code: '002',
    libelle: 'Ascenseur (fictif)',
    lots: [
      { lotId: 'lot-1', tantiemes: 1 },
      { lotId: 'lot-2', tantiemes: 999 },
    ],
  })
  const ascenseur = (id: string, exigibilite: string): EcheanceAppel => ({ ...echeances[2], id, cleId: 'cle-002', libelle: `Ascenseur — ${id}`, montantCentimes: 400, exigibilite })

  it('quote-part arrondie à zéro : ni exigibilité fantôme, ni date limite repoussée, ni fausse alerte d’émission tardive', () => {
    const avec = avisDAppel({ echeances: [echeances[0], ascenseur('ASC-0', '2026-12-10'), ascenseur('ASC-1', '2027-03-01')], cles: [cle, cle2], positions, comptes })
    const contenu = contenuAvisAppel(avec, options({ cles: [cle, cle2], reglements: cheques }))
    const a = compteDe(contenu, 'cpt-A')
    expect(a.lignes.map((l) => l.echeanceId)).toEqual(['B-2027-001-1'])
    expect(a.parExigibilite).toEqual([{ exigibilite: '2027-01-01', montantCentimes: 40_000 }])
    expect(a.aReglerAvantLe).toBe('2027-01-01')
    expect(codes(a)).not.toContain('exigibilites_multiples')
    expect(codes(a)).not.toContain('emis_apres_exigibilite')
    expect(codes(compteDe(contenu, 'cpt-B'))).toContain('emis_apres_exigibilite')
    expect(diffuse(contenu)[0].courrier?.objet).toMatch(/à régler avant le 01\/01\/2027/)
  })

  it('compte sans aucun fonds appelé (quotes-parts nulles) : signalé, pas d’avis à diffuser, sans blocage de fusion', () => {
    const contenu = contenuAvisAppel(avisDAppel({ echeances: [ascenseur('ASC-1', '2027-01-01')], cles: [cle, cle2], positions, comptes }), options({ cles: [cle, cle2], reglements: cheques }))
    const a = compteDe(contenu, 'cpt-A')
    expect(a.lignes).toEqual([])
    expect(a.parExigibilite).toEqual([])
    expect(a.anomalies).toContainEqual(expect.objectContaining({ code: 'sans_appel', gravite: 'information' }))
    const [d] = diffuse(contenu)
    expect(d).toMatchObject({ compteId: 'cpt-A', courrier: null })
    expect(d.anomalies.map((x) => x.code)).toEqual(['sans_appel'])
  })

  it('mention du fonds de travaux : L. 1965 art. 14-2-1, III, recopié tel quel et entre guillemets', () => {
    const a = compteDe(contenuAvisAppel(avis, options()), 'cpt-A')
    expect(a.mentions.find((m) => m.cle === 'fonds_travaux')?.texte).toBe(
      'Article 14-2-1, III, de la loi n° 65-557 du 10 juillet 1965 : « Les sommes versées au titre du fonds de travaux sont attachées aux lots et entrent définitivement, dès leur versement, dans le patrimoine du syndicat des copropriétaires. ' +
        "Elles ne donnent pas lieu à un remboursement par le syndicat des copropriétaires à l'occasion de la cession d'un lot. " +
        "L'acquéreur peut consentir à verser au vendeur un montant équivalent à ces sommes en sus du prix de vente du lot. »",
    )
  })

  it('administrateur provisoire : l’appel consécutif à sa décision accompagne la copie de celle-ci (D. 1967 art. 62-9)', () => {
    const decisions = [{ echeanceId: '00042-T1', decision: 'Décision n° 3 du 02/10/2026 (fictive)' }]
    const contenu = contenuAvisAppel(avis, options({ administrateurProvisoire: true, decisionsAdministrateur: decisions }))
    const a = compteDe(contenu, 'cpt-A')
    const mention = a.mentions.find((m) => m.cle === 'decision_administrateur')
    expect(mention?.fondement).toBe('D. 1967 art. 62-9')
    expect(mention?.texte).toMatch(/Décision n° 3 du 02\/10\/2026 \(fictive\)/)
    expect(a.anomalies).toContainEqual(expect.objectContaining({ code: 'decision_a_joindre', gravite: 'avertissement', fondement: 'D. 1967 art. 62-9' }))
    const [d] = diffuse(contenu)
    expect(d.valeursFusion['mention.decisionAdministrateur']).toBe(mention?.texte)
    expect(controlerContexteFusion('avis_appel_fonds', d.valeursFusion)).toMatchObject({ complet: true, inconnus: [] })
    expect(gabaritCourrier('avis_appel_fonds').fondements).toContain('D. 1967 art. 62-9')
    expect(compteDe(contenuAvisAppel(avis, options({ administrateurProvisoire: true })), 'cpt-A').mentions.map((m) => m.cle)).not.toContain('decision_administrateur')
    expect(() => contenuAvisAppel(avis, options({ decisionsAdministrateur: decisions }))).toThrow(/administrateur provisoire/)
    expect(() => contenuAvisAppel(avis, options({ administrateurProvisoire: true, decisionsAdministrateur: [{ echeanceId: 'X', decision: 'D' }] }))).toThrow(/absente/)
    expect(() => contenuAvisAppel(avis, options({ administrateurProvisoire: true, decisionsAdministrateur: [{ echeanceId: '00042-T1', decision: ' ' }] }))).toThrow(/référence/)
  })

  it('adresse communiquée pour les avis (art. 35-2) préférée à celle des notifications (art. 65), qui n’en tient lieu qu’à défaut', () => {
    const contenu = contenuAvisAppel(avis, options())
    const pourAvis = [
      creerCommunicationAdresseElectronique({ identiteId: 'i-cpt-A', adresse: 'avis-a@exemple.invalid', communiqueeLe: '2026-02-01' }),
      creerCommunicationAdresseElectronique({ identiteId: 'i-cpt-B', adresse: 'avis-b@exemple.invalid', communiqueeLe: '2026-02-01' }),
    ]
    const [a, b] = diffuse(contenu, { communicationsAvis: pourAvis })
    expect(a).toMatchObject({ canal: 'electronique', adresseElectronique: 'avis-a@exemple.invalid' })
    expect(b).toMatchObject({ canal: 'electronique', adresseElectronique: 'avis-b@exemple.invalid' })
    expect(diffuse(contenu)[0]).toMatchObject({ canal: 'electronique', adresseElectronique: 'a@exemple.invalid' })
  })

  it('en-tête : art. 62-9, 64-9 et 29-1 lus ; 🔴 réduit à l’administrateur de l’art. 47 ; art. 65 → art. 35-2 déclaré 🔵 ; ISO 20022 à l’annexe, point 1 b)', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'avis-appel.ts'), 'utf8')
    const entete = source.slice(0, source.indexOf('*/'))
    expect(entete).toMatch(/D\. 1967 art\. 62-9/)
    expect(entete).toMatch(/art\. 64-9/)
    expect(entete).toMatch(/L\. 1965 art\. 29-1, I, al\. 2/)
    expect(entete).not.toMatch(/29-1 non relu/)
    expect(entete).toMatch(/administrateur provisoire de l'art\. 47/)
    expect(entete).toMatch(/art\. 65/)
    expect(entete).toMatch(/annexe, point 1 b\)/)
    expect(entete).not.toMatch(/point 3 a\) : le créancier fournit type de prélèvement, IBAN du\s+\*?\s*payeur, RUM, date de signature du mandat, montant, identifiant créancier ; format ISO 20022/)
  })
})

describe('préparation de la diffusion par le circuit Courrier', () => {
  it('voie électronique à l’adresse communiquée (D. 1967 art. 35-2), sinon lettre simple ; courrier en préparation, forme copiée du modèle', () => {
    const [a, b] = preparerDiffusionAvis(contenuAvisAppel(avis, options()), diffusion())
    expect(a).toMatchObject({ compteId: 'cpt-A', identiteId: 'i-cpt-A', canal: 'electronique', formeEnvoi: 'Email direct', adresseElectronique: 'a@exemple.invalid', anomalies: [] })
    expect(a.courrier).toMatchObject({ modeleId: 'mod-email', formeEnvoi: 'Email direct', statut: 'Préparation', coproprieteId: 'copro-1', mandatId: 'mandat-1', personneId: 'i-cpt-A' })
    expect(a.courrier?.objet).toBe("Avis d'appel de fonds — compte TILL.45000.00001.0 — à régler avant le 01/01/2027")
    expect(b).toMatchObject({ compteId: 'cpt-B', identiteId: 'i-cpt-B', canal: 'postal', formeEnvoi: 'Normal', adresseElectronique: null })
    expect(b.adressePostale?.id).toBe('adr-B')
    expect(b.courrier?.modeleId).toBe('mod-postal')
  })

  it('les valeurs de fusion remplissent le gabarit « avis_appel_fonds » ; la forme libre ne bloque aucun envoi', () => {
    const [a, b] = preparerDiffusionAvis(contenuAvisAppel(avis, options()), diffusion())
    expect(controlerContexteFusion('avis_appel_fonds', a.valeursFusion)).toMatchObject({ complet: true, inconnus: [] })
    expect(a.valeursFusion).toMatchObject({
      'compte.numero': 'TILL.45000.00001.0',
      'appel.totalAPayerCentimes': 64_000,
      'reglement.mode': 'Prélèvement',
      'prelevement.date': '2027-01-05',
      'prelevement.montantCentimes': 40_000,
      'creancier.ics': ICS,
    })
    expect(b.valeursFusion['appel.soldeAnterieurCentimes']).toBe(-5_000)
    expect(b.valeursFusion).not.toHaveProperty('prelevement.date')
    expect(controlerContexteFusion('avis_appel_fonds', b.valeursFusion).complet).toBe(true)
    expect(controlerFormeEnvoi('avis_appel_fonds', 'Email direct', { voie: 'electronique' })).toEqual([])
    expect(controlerFormeEnvoi('avis_appel_fonds', 'Normal', { voie: 'postale' })).toEqual([])
  })

  it('demande de voie postale en vigueur : lettre simple, même avec une adresse électronique communiquée', () => {
    const demande = creerDemandeVoiePostale({ identiteId: 'i-cpt-A', recueLe: '2026-11-01', origine: 'courrier' })
    const [a] = preparerDiffusionAvis(contenuAvisAppel(avis, options()), diffusion({ demandesVoiePostale: [demande] }))
    expect(a).toMatchObject({ canal: 'postal', formeEnvoi: 'Normal' })
  })

  it('indivision : un courrier par identité du compte ; sans adresse postale pour la lettre simple : bloquant, pas de courrier', () => {
    const indivision = [...positions, position('p3', 'lot-2', 'cpt-B', 'i-cpt-B2')]
    const sorties = preparerDiffusionAvis(contenuAvisAppel(avis, options()), diffusion({ positions: indivision }))
    const b = sorties.filter((s) => s.compteId === 'cpt-B')
    expect(b.map((s) => s.identiteId)).toEqual(['i-cpt-B', 'i-cpt-B2'])
    expect(b[1].courrier).toBeNull()
    expect(b[1].anomalies).toContainEqual(expect.objectContaining({ code: 'sans_adresse', gravite: 'bloquant' }))
  })

  it('aucun destinataire en place, ou contenu bloqué : pas de courrier', () => {
    const sansB = preparerDiffusionAvis(contenuAvisAppel(avis, options()), diffusion({ positions: [positions[0]] })).find((s) => s.compteId === 'cpt-B')
    expect(sansB).toMatchObject({ identiteId: null, courrier: null })
    expect(sansB?.anomalies).toContainEqual(expect.objectContaining({ code: 'sans_destinataire', gravite: 'bloquant' }))
    const [a] = preparerDiffusionAvis(contenuAvisAppel(avis, options({ dateEmission: '2026-12-23' })), diffusion({ date: '2026-12-23' }))
    expect(a.courrier).toBeNull()
    expect(a.anomalies).toContainEqual(expect.objectContaining({ code: 'contenu_bloque', gravite: 'bloquant' }))
  })

  it('diffusion après l’émission : la pré-notification se recompte depuis la diffusion ; diffusion avant l’émission refusée', () => {
    const contenu = contenuAvisAppel(avis, options())
    const [aJ] = preparerDiffusionAvis(contenu, diffusion({ date: '2026-12-22' }))
    expect(aJ.anomalies.map((x) => x.code)).not.toContain('preavis_insuffisant')
    expect(aJ.courrier).not.toBeNull()
    const [aTard, bTard] = preparerDiffusionAvis(contenu, diffusion({ date: '2026-12-23' }))
    expect(aTard.courrier).toBeNull()
    expect(aTard.anomalies).toContainEqual(expect.objectContaining({ code: 'preavis_insuffisant', gravite: 'bloquant' }))
    expect(bTard.anomalies.map((x) => x.code)).not.toContain('preavis_insuffisant')
    expect(bTard.courrier).not.toBeNull()
    expect(() => preparerDiffusionAvis(contenu, diffusion({ date: '2026-12-14' }))).toThrow(/émission/)
  })

  it('diffusion le jour de l’exigibilité ou après (D. 1967 art. 35-2 : avis préalable) : avertissement, courrier préparé', () => {
    const contenu = contenuAvisAppel(avis, options({ reglements: [{ compteId: 'cpt-A', mode: 'Chèque' }, { compteId: 'cpt-B', mode: 'Chèque' }] }))
    const [a] = preparerDiffusionAvis(contenu, diffusion({ date: '2027-01-01' }))
    expect(a.anomalies).toContainEqual(expect.objectContaining({ code: 'diffuse_apres_exigibilite', gravite: 'avertissement' }))
    expect(a.courrier).not.toBeNull()
    expect(preparerDiffusionAvis(contenu, diffusion())[0].anomalies.map((x) => x.code)).not.toContain('diffuse_apres_exigibilite')
  })

  it('socle incomplet : fusion incomplète, bloquant', () => {
    const [a] = preparerDiffusionAvis(contenuAvisAppel(avis, options()), diffusion({ socle: { ...socle, 'mandat.rg': undefined } }))
    expect(a.courrier).toBeNull()
    expect(a.anomalies).toContainEqual(expect.objectContaining({ code: 'fusion_incomplete', gravite: 'bloquant' }))
  })
})

describe('contrôle du point 17 — l’avis n’annonce que le débit que le lot présentera', () => {
  const lotDe = (contenu: ContenuAvisAppel, diffusions: DiffusionAvisCompte[]) => echeancesPrelevementDepuisAvis(contenu, { prefixeId: 'AV', diffusions })
  const tiersSansAdresse = creerIdentite({ id: 'i-tiers', nature: 'physique', civilite: 'Madame', nom: 'Tiers payeur', prenom: 'Fictive', telecoms: [], adresses: [] })
  const tiersAvecAdresse = creerIdentite({ id: 'i-tiers', nature: 'physique', civilite: 'Madame', nom: 'Tiers payeur', prenom: 'Fictive', telecoms: [], adresses: [adresse('adr-T')] })
  const mandatDuTiers = mandat({ debiteur: 'Tiers payeur (fictif)', debiteurIdentiteId: 'i-tiers' })

  it('détenteur du compte non rattaché à une identité : comme en contentieux, l’avis n’annonce aucun débit et donne le règlement hors prélèvement ; le lot l’écarte', () => {
    const contenu = contenuAvisAppel(avis, options({ reglements: reglements(mandat({ debiteurIdentiteId: null })) }))
    const a = compteDe(contenu, 'cpt-A')
    expect(a.modeReglement).toBe('Virement')
    expect(a.instructions).toEqual({ mode: 'Virement', beneficiaire: 'SDC Les Tilleuls (fictif)', iban: 'FR1420041010050500013M02606', reference: 'TILL.45000.00001.0' })
    expect(a.mentions.map((m) => m.cle)).not.toContain('prenotification')
    expect(a.anomalies).toContainEqual(expect.objectContaining({ code: 'prenotification_sans_detenteur', gravite: 'avertissement' }))
    expect(bloquantsDe(a)).toEqual([])
    const [d] = diffuse(contenu)
    expect(d.courrier).not.toBeNull()
    expect(d.valeursFusion['mention.prenotification']).toBeNull()
    expect(d.valeursFusion).not.toHaveProperty('prelevement.montantCentimes')
    expect(d.valeursFusion['reglement.instructions']).toMatch(/^Par virement à SDC Les Tilleuls \(fictif\)/)
    const lot = lotDe(contenu, diffuse(contenu))
    expect(lot.echeances).toEqual([])
    expect(lot.ecartees).toContainEqual({ compteId: 'cpt-A', motif: 'prenotification_absente', codes: ['prenotification_sans_detenteur'] })
    const revoqueSansIban = compteDe(
      contenuAvisAppel(avis, options({ ibanSyndicat: null, reglements: reglements(mandat({ debiteurIdentiteId: null, revoqueLe: '2026-12-01' })) })),
      'cpt-A',
    )
    expect(revoqueSansIban.instructions).toMatchObject({ mode: 'Chèque', reference: 'TILL.45000.00001.0' })
    expect(bloquantsDe(revoqueSansIban)).toEqual([])
    expect(revoqueSansIban.anomalies).toContainEqual(expect.objectContaining({ code: 'mandat_revoque', gravite: 'avertissement' }))
  })

  it('détenteur sans courrier possible à la diffusion (tiers ou indivisaire sans adresse) : les autres courriers du compte partent sans le débit ; le lot écarte le compte', () => {
    const contenu = contenuAvisAppel(avis, options({ reglements: reglements(mandatDuTiers) }))
    const sorties = diffuse(contenu, { identites: [...identites, tiersSansAdresse] })
    const [pourA, pourTiers] = sorties.filter((s) => s.compteId === 'cpt-A')
    expect(pourTiers).toMatchObject({ identiteId: 'i-tiers', prenotification: true, courrier: null })
    expect(pourTiers.anomalies).toContainEqual(expect.objectContaining({ code: 'sans_adresse', gravite: 'bloquant' }))
    expect(pourA).toMatchObject({ identiteId: 'i-cpt-A', prenotification: false })
    expect(pourA.courrier).not.toBeNull()
    expect(pourA.anomalies).toContainEqual(expect.objectContaining({ code: 'prenotification_impossible', gravite: 'avertissement' }))
    expect(pourA.valeursFusion['reglement.mode']).toBe('Virement')
    expect(pourA.valeursFusion['reglement.instructions']).toMatch(/^Par virement à SDC Les Tilleuls \(fictif\)/)
    expect(pourA.valeursFusion['mention.prenotification']).toBeNull()
    expect(pourA.valeursFusion).not.toHaveProperty('prelevement.montantCentimes')
    expect(controlerContexteFusion('avis_appel_fonds', pourA.valeursFusion)).toMatchObject({ complet: true, inconnus: [] })
    const lot = lotDe(contenu, sorties)
    expect(lot.echeances).toEqual([])
    expect(lot.ecartees).toContainEqual(expect.objectContaining({ compteId: 'cpt-A', motif: 'prenotification_absente', codes: expect.arrayContaining(['sans_adresse']) }))

    const indivision = [...positions, position('p3', 'lot-1', 'cpt-A', 'i-cpt-B2')]
    const indivisaire = contenuAvisAppel(avis, options({ reglements: reglements(mandat({ debiteur: 'Indivisaire B2', debiteurIdentiteId: 'i-cpt-B2' })) }))
    const [x, y] = diffuse(indivisaire, { positions: indivision }).filter((s) => s.compteId === 'cpt-A')
    expect([x.identiteId, x.prenotification, x.courrier === null, x.valeursFusion['mention.prenotification']]).toEqual(['i-cpt-A', false, false, null])
    expect([y.identiteId, y.prenotification, y.courrier]).toEqual(['i-cpt-B2', true, null])

    const atteint = diffuse(contenu, { identites: [...identites, tiersAvecAdresse] }).filter((s) => s.compteId === 'cpt-A')
    expect(atteint.map((s) => [s.courrier === null, s.valeursFusion['prelevement.montantCentimes']])).toEqual([
      [false, 40_000],
      [false, 40_000],
    ])
    const tard = preparerDiffusionAvis(contenu, diffusion({ date: '2026-12-23', identites: [...identites, tiersAvecAdresse] })).filter((s) => s.compteId === 'cpt-A')
    expect(tard.map((s) => s.courrier)).toEqual([null, null])
  })

  it('l’adaptateur n’accepte comme pré-notification que la diffusion de CE contenu : même avis, même montant, même date, même mandat et détenteur', () => {
    const c1 = contenuAvisAppel(avis, options())
    const d1 = diffuse(c1)
    const autreDebit = { compteId: 'cpt-A', motif: 'prenotification_absente', codes: ['prenotification_autre_debit'] }
    expect(lotDe(c1, d1).echeances.map((e) => e.montantEcheanceCentimes)).toEqual([40_000])

    const elargi = contenuAvisAppel(avis, options({ reglements: reglements(mandat({ natures: { budget: true, autres: true } })) }))
    expect(lotDe(elargi, d1).echeances).toEqual([])
    expect(lotDe(elargi, d1).ecartees).toContainEqual(autreDebit)
    expect(lotDe(elargi, [...d1, ...diffuse(elargi)]).echeances.map((e) => e.montantEcheanceCentimes)).toEqual([54_000])

    const avance = contenuAvisAppel(avis, options({ datePrelevement: '2027-01-02' }))
    expect(lotDe(avance, d1).ecartees).toContainEqual(autreDebit)
    expect(lotDe(avance, diffuse(avance)).echeances).toHaveLength(1)

    const avisT2 = avisDAppel({ echeances: [{ ...echeances[0], id: 'B-2027-001-2', exigibilite: '2027-04-01', libelle: 'Budget 2027 — provision 2/4' }], cles: [cle], positions, comptes })
    const t2 = contenuAvisAppel(avisT2, options({ dateEmission: '2027-03-10', datePrelevement: '2027-04-05' }))
    expect(lotDe(t2, d1).ecartees).toContainEqual(autreDebit)
    expect(lotDe(t2, diffuse(t2)).echeances).toHaveLength(1)

    const nouveauMandat = contenuAvisAppel(avis, options({ reglements: reglements(mandat({ rum: 'RUM-TILL-00002' })) }))
    expect(lotDe(nouveauMandat, d1).ecartees).toContainEqual(autreDebit)
    const autreDetenteur = contenuAvisAppel(avis, options({ reglements: reglements(mandatDuTiers) }))
    expect(lotDe(autreDetenteur, d1).ecartees).toContainEqual(autreDebit)
    expect(lotDe(autreDetenteur, diffuse(autreDetenteur, { identites: [...identites, tiersAvecAdresse] })).echeances).toHaveLength(1)
  })

  it('compte créditeur en prélèvement sans mandat : rien n’est prélevé, « mandat_absent » à régulariser et l’avis de l’art. 35-2 part, comme sous un mandat vide', () => {
    const crediteur = avisDAppel({ echeances, cles: [cle], positions, comptes, soldesAnterieurs: { 'cpt-A': -100_000 } })
    const sansMandat = contenuAvisAppel(crediteur, options({ reglements: reglements(null) }))
    const a = compteDe(sansMandat, 'cpt-A')
    expect(a.totalAPayerCentimes).toBe(-46_000)
    expect(bloquantsDe(a)).toEqual([])
    expect(a.anomalies).toContainEqual(expect.objectContaining({ code: 'mandat_absent', gravite: 'avertissement' }))
    expect(a.instructions).toMatchObject({ mode: 'Prélèvement', montantCentimes: 0, resteHorsPrelevementCentimes: -46_000, rum: null, mandat: null })
    expect(a.mentions.map((m) => m.cle)).not.toContain('prenotification')
    const [d] = diffuse(sansMandat)
    expect(d.courrier).not.toBeNull()
    expect(d.valeursFusion['reglement.instructions']).toBe('Aucun prélèvement sur cet avis.')

    const vide = contenuAvisAppel(crediteur, options({ reglements: reglements(mandat({ rum: ' ', iban: 'X', debiteur: ' ', dateSignature: 'x' })) }))
    const v = compteDe(vide, 'cpt-A')
    expect(bloquantsDe(v)).toEqual([])
    expect(v.anomalies).toContainEqual(expect.objectContaining({ code: 'mandat_incomplet', gravite: 'avertissement' }))
    const [dv] = diffuse(vide)
    expect(dv.courrier).not.toBeNull()
    expect(dv.valeursFusion['reglement.instructions']).toBe('Aucun prélèvement sur cet avis.')

    for (const contenu of [sansMandat, vide]) expect(lotDe(contenu, diffuse(contenu)).ecartees).toContainEqual({ compteId: 'cpt-A', motif: 'montant_nul', codes: [] })
    expect(bloquantsDe(compteDe(contenuAvisAppel(avis, options({ reglements: reglements(null) })), 'cpt-A'))).toEqual(['mandat_absent'])
  })
})
