import { describe, expect, it } from 'vitest'
import { creerReglagesComptesCabinet } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import { ajouterJours, avancerAuJourOuvrable } from '@/lib/administrateur-judiciaire/domain/dates'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import * as moduleFonds from '@/lib/administrateur-judiciaire/domain/fonds-detenus'
import {
  CATEGORIES_MISSION_PAR_DEFAUT,
  PERIMETRE_FONDS_DETENUS_PAR_DEFAUT,
  annexeSoldeBancaireEtSuspens,
  controlerCouvertureA,
  creerCategoriesMission,
  creerPerimetreFondsDetenus,
  echeancesFondsDetenusDeLAnnee,
  fondsDetenusA,
  maximumInterneFondsDetenus,
  prochainesEcheancesFondsDetenus,
  rubriqueDuCompte,
  type CompteFondsDetenus,
  type DonneesFondsDetenus,
  type MandatFondsDetenus,
} from '@/lib/administrateur-judiciaire/domain/fonds-detenus'
import { creerTraitement, type FamilleTraitement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import { enTeteDuModule } from './en-tete-module'

/**
 * Fonds détenus pour autrui à une date (point 72 du bilan Gestéam, remplacé : note du 17/11/2026, § 4.2). Solde comptable
 * de chaque compte financier des mandats, ventilé par mandat, compte, nature, établissement et catégorie de mission ;
 * dates de référence (31/12, 30/06, fins de trimestre) ; couverture par mandat (C. com. R. 814-37). Données fictives.
 */

const IBAN_A = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_B = 'FR14 2004 1010 0505 0001 3M02 606'
const IBAN_C = 'FR76 3000 4000 0312 3456 7890 143'

const t = (id: string, famille: FamilleTraitement, date: string, lignes: [string, 'debit' | 'credit', number][]): Traitement =>
  creerTraitement({ id, famille, date, mouvements: lignes.map(([compte, sens, montantCentimes]) => ({ compte, sens, montantCentimes })) })

/** Encaissement d'un copropriétaire : débit du 512, crédit du 450. */
const entree = (id: string, date: string, compte512: string, montant: number): Traitement =>
  t(id, 'Encaissement', date, [
    [compte512, 'debit', montant],
    [`${compte512.slice(0, 4)}.45000.00001.0`, 'credit', montant],
  ])

/** Règlement d'un fournisseur : débit du 401, crédit du 512. */
const sortie = (id: string, date: string, compte512: string, montant: number): Traitement =>
  t(id, 'Règlement de factures', date, [
    [`${compte512.slice(0, 4)}.40100.FOURN.0`, 'debit', montant],
    [compte512, 'credit', montant],
  ])

const compte = (surcharge: Partial<CompteFondsDetenus> & Pick<CompteFondsDetenus, 'banqueId' | 'compte512'>): CompteFondsDetenus => ({
  nature: 'courant',
  iban: null,
  etablissement: 'Banque Exemple',
  ...surcharge,
})

// TILL : administration provisoire (art. 29-1), comptes à la Caisse des dépôts (J37).
const TILL_CDC = 'TILL.51210.00000.0'
const TILL_FT = 'TILL.51220.00000.0'
// ACAC : syndic désigné en justice (art. 46), comptes en banque au nom du syndicat.
const ACAC_COURANT = 'ACAC.51200.00000.0'
const ACAC_FT = 'ACAC.51201.00000.0'

const mandatTill = (surcharge: Partial<MandatFondsDetenus> = {}): MandatFondsDetenus => ({
  mandatId: 'm-till',
  coproprieteId: 'copro-tilleuls',
  segmentSyndicat: 'TILL',
  fondement: 'Administration provisoire (art. 29-1)',
  modeComptes: 'caisse_depots',
  comptes: [
    compte({ banqueId: 'b-till-cdc', compte512: TILL_CDC, nature: 'caisse_depots', etablissement: null }),
    compte({ banqueId: 'b-till-ft', compte512: TILL_FT, nature: 'fonds_travaux', etablissement: 'Caisse des dépôts et consignations' }),
  ],
  ...surcharge,
})

const mandatAcac = (surcharge: Partial<MandatFondsDetenus> = {}): MandatFondsDetenus => ({
  mandatId: 'm-acac',
  coproprieteId: 'copro-acacias',
  segmentSyndicat: 'ACAC',
  fondement: 'Syndic judiciaire (art. 46)',
  comptes: [
    compte({ banqueId: 'b-acac-courant', compte512: ACAC_COURANT, iban: IBAN_A }),
    compte({ banqueId: 'b-acac-ft', compte512: ACAC_FT, nature: 'fonds_travaux', iban: IBAN_B, etablissement: '  banque   EXEMPLE ' }),
  ],
  ...surcharge,
})

const traitementsTill = [
  entree('till-1', '2026-03-01', TILL_CDC, 1_000_000),
  entree('till-2', '2026-04-01', TILL_FT, 300_000),
  sortie('till-3', '2026-06-15', TILL_CDC, 200_000),
  entree('till-4', '2027-01-05', TILL_CDC, 50_000),
]
const traitementsAcac = [
  entree('acac-1', '2026-02-01', ACAC_COURANT, 500_000),
  entree('acac-2', '2026-05-01', ACAC_FT, 100_000),
  sortie('acac-3', '2026-12-31', ACAC_COURANT, 120_000),
]

const donnees = (surcharge: Partial<DonneesFondsDetenus> = {}): DonneesFondsDetenus => ({
  reglagesComptes: creerReglagesComptesCabinet({}),
  mandats: [mandatTill(), mandatAcac()],
  comptabilites: [
    { coproprieteId: 'copro-tilleuls', traitements: traitementsTill },
    { coproprieteId: 'copro-acacias', traitements: traitementsAcac },
  ],
  ...surcharge,
})

describe('fonds détenus à une date — soldes', () => {
  it('solde comptable de chaque compte : débits moins crédits des écritures datées au plus tard ce jour, ce jour compris', () => {
    const fonds = fondsDetenusA('2026-12-31', donnees())
    expect(fonds.comptes.map((l) => [l.mandatId, l.banqueId, l.soldeCentimes])).toEqual([
      ['m-till', 'b-till-cdc', 800_000],
      ['m-till', 'b-till-ft', 300_000],
      ['m-acac', 'b-acac-courant', 380_000],
      ['m-acac', 'b-acac-ft', 100_000],
    ])
    expect(fondsDetenusA('2026-06-14', donnees()).comptes.map((l) => l.soldeCentimes)).toEqual([1_000_000, 300_000, 500_000, 100_000])
    expect(fondsDetenusA('2026-01-31', donnees()).totalCentimes).toBe(0)
  })

  it('ventile par mandat, par nature, par établissement, par catégorie de mission, et totalise', () => {
    const fonds = fondsDetenusA('2026-12-31', donnees())
    expect(fonds.date).toBe('2026-12-31')
    expect(fonds.totalCentimes).toBe(1_580_000)
    expect(fonds.mandats.map((m) => [m.mandatId, m.categorie, m.fondsDetenusCentimes, m.soldeNetCentimes, m.nombreComptes, m.complet])).toEqual([
      ['m-till', 'ap291', 1_100_000, 1_100_000, 2, true],
      ['m-acac', 'sj', 480_000, 480_000, 2, true],
    ])
    expect(fonds.parNature.map((g) => [g.cle, g.fondsDetenusCentimes, g.nombreComptes])).toEqual([
      ['courant', 380_000, 1],
      ['fonds_travaux', 400_000, 2],
      ['caisse_depots', 800_000, 1],
    ])
    expect(fonds.parCategorie.map((g) => [g.cle, g.libelle, g.fondsDetenusCentimes])).toEqual([
      ['sj', "Syndic désigné en justice (carence de l'assemblée)", 480_000],
      ['ap291', 'Administrateur provisoire · copropriété en difficulté', 1_100_000],
    ])
    expect(fonds.parRubrique.map((g) => [g.cle, g.inclus, g.fondsDetenusCentimes])).toEqual([
      ['caisse_depots', true, 800_000],
      ['au_nom_du_syndicat', true, 380_000],
      ['fonds_travaux', true, 400_000],
      ['autres_comptes', true, 0],
      // Décision du 20/11/2026 (partie C, F98) : la ligne « fonds placés », vide ici.
      ['fonds_places', true, 0],
    ])
    const somme = (valeurs: number[]) => valeurs.reduce((s, v) => s + v, 0)
    for (const ventilation of [fonds.parNature, fonds.parEtablissement, fonds.parCategorie])
      expect(somme(ventilation.map((g) => g.fondsDetenusCentimes))).toBe(fonds.totalCentimes)
    expect(somme(fonds.mandats.map((m) => m.fondsDetenusCentimes)) + fonds.nonVentileCentimes).toBe(fonds.totalCentimes)
  })

  it('par établissement : un compte à la Caisse des dépôts sans établissement saisi y est rangé ; casse et espaces ne séparent pas un établissement', () => {
    const fonds = fondsDetenusA('2026-12-31', donnees())
    expect(fonds.parEtablissement.map((g) => [g.libelle, g.fondsDetenusCentimes, g.nombreComptes])).toEqual([
      ['Banque Exemple', 480_000, 2],
      ['Caisse des dépôts et consignations', 1_100_000, 2],
    ])
    expect(fonds.comptes[0].etablissement).toBe('Caisse des dépôts et consignations')
    expect(fonds.anomalies).toEqual([])
  })

  it('établissement non renseigné (hors Caisse des dépôts) : rangé à part et signalé, la ventilation par établissement le demandant', () => {
    const acac = mandatAcac()
    const fonds = fondsDetenusA(
      '2026-12-31',
      donnees({ mandats: [mandatTill(), { ...acac, comptes: [{ ...acac.comptes[0], etablissement: '  ' }, acac.comptes[1]] }] }),
    )
    expect(fonds.parEtablissement.map((g) => [g.cle, g.fondsDetenusCentimes])).toEqual([
      ['banque exemple', 100_000],
      ['caisse des depots et consignations', 1_100_000],
      ['non_renseigne', 380_000],
    ])
    expect(fonds.anomalies.map((a) => [a.code, a.gravite, a.mandatIds, a.banqueId])).toEqual([
      ['etablissement_non_renseigne', 'alerte', ['m-acac'], 'b-acac-courant'],
    ])
    expect(fonds.anomalies[0].fondement).toBe('C. com. R. 814-30')
  })

  it('filtre de mandats : seuls les mandats demandés ; un mandat inconnu est refusé', () => {
    const fonds = fondsDetenusA('2026-12-31', donnees(), { mandatIds: ['m-acac'] })
    expect(fonds.mandats.map((m) => m.mandatId)).toEqual(['m-acac'])
    expect(fonds.totalCentimes).toBe(480_000)
    expect(() => fondsDetenusA('2026-12-31', donnees(), { mandatIds: ['m-inconnu'] })).toThrow(/m-inconnu/)
  })

  it('ne modifie pas les données reçues', () => {
    const saisie = donnees()
    const avant = JSON.stringify(saisie)
    fondsDetenusA('2026-12-31', saisie, { perimetre: creerPerimetreFondsDetenus({ fonds_travaux: false }) })
    controlerCouvertureA('2026-12-31', saisie)
    maximumInterneFondsDetenus('2026-01-01', '2026-12-31', saisie)
    expect(JSON.stringify(saisie)).toBe(avant)
  })
})

describe('fonds détenus — périmètre (réglage du cabinet ; J67, R90 : tout inclus par défaut)', () => {
  it('rubrique de chaque nature : fonds de travaux d’abord (compte séparé, compte repris qui le tenait, placement réservé au fonds), Caisse des dépôts, compte au nom du syndicat, autres', () => {
    expect(rubriqueDuCompte({ nature: 'fonds_travaux' })).toBe('fonds_travaux')
    expect(rubriqueDuCompte({ nature: 'repris_ancien_gestionnaire', tenaitFondsTravaux: true })).toBe('fonds_travaux')
    // J71 : un placement au nom du syndicat réservé au fonds tient le fonds.
    expect(rubriqueDuCompte({ nature: 'placement', reserveAuFondsTravaux: true })).toBe('fonds_travaux')
    expect(rubriqueDuCompte({ nature: 'repris_ancien_gestionnaire' })).toBe('autres_comptes')
    expect(rubriqueDuCompte({ nature: 'caisse_depots' })).toBe('caisse_depots')
    expect(rubriqueDuCompte({ nature: 'courant' })).toBe('au_nom_du_syndicat')
    for (const nature of ['avance_travaux', 'placement', 'sous_compte_centralisateur'] as const)
      expect(rubriqueDuCompte({ nature })).toBe('autres_comptes')
  })

  it('par défaut, tout est inclus (valeur prudente), et le résultat dit que ce n’est qu’un réglage, pas une règle légale', () => {
    expect(PERIMETRE_FONDS_DETENUS_PAR_DEFAUT).toEqual({
      caisse_depots: true,
      au_nom_du_syndicat: true,
      fonds_travaux: true,
      autres_comptes: true,
      fonds_places: true,
    })
    const fonds = fondsDetenusA('2026-12-31', donnees())
    expect(fonds.perimetre).toEqual(PERIMETRE_FONDS_DETENUS_PAR_DEFAUT)
    expect(fonds.perimetreParDefaut).toBe(true)
    expect(fonds.avertissement).toMatch(/réglage du cabinet/)
    expect(fonds.avertissement).toMatch(/R\. 814-21/)
    expect(fonds.avertissement).not.toMatch(/obligatoire|imposé par la loi/)
  })

  it('une rubrique exclue sort des totaux et passe hors périmètre ; les comptes restent listés, marqués non inclus', () => {
    const perimetre = creerPerimetreFondsDetenus({ fonds_travaux: false })
    const fonds = fondsDetenusA('2026-12-31', donnees(), { perimetre })
    expect(fonds.perimetreParDefaut).toBe(false)
    expect(fonds.totalCentimes).toBe(1_180_000)
    expect(fonds.horsPerimetreCentimes).toBe(400_000)
    expect(fonds.comptes.map((l) => [l.banqueId, l.inclus])).toEqual([
      ['b-till-cdc', true],
      ['b-till-ft', false],
      ['b-acac-courant', true],
      ['b-acac-ft', false],
    ])
    expect(fonds.mandats.map((m) => [m.mandatId, m.fondsDetenusCentimes, m.horsPerimetreCentimes, m.soldeNetCentimes])).toEqual([
      ['m-till', 800_000, 300_000, 1_100_000],
      ['m-acac', 380_000, 100_000, 480_000],
    ])
    expect(fonds.parNature.map((g) => g.cle)).toEqual(['courant', 'caisse_depots'])
    expect(fonds.parRubrique.find((g) => g.cle === 'fonds_travaux')).toMatchObject({ inclus: false, fondsDetenusCentimes: 400_000 })
  })

  it('réglage invalide refusé : valeur non booléenne ou rubrique inconnue', () => {
    expect(() => creerPerimetreFondsDetenus({ fonds_travaux: 'non' as unknown as boolean })).toThrow(/fonds_travaux/)
    expect(() => creerPerimetreFondsDetenus({ especes: true } as unknown as Record<string, boolean>)).toThrow(/especes/)
    expect(creerPerimetreFondsDetenus({})).toEqual(PERIMETRE_FONDS_DETENUS_PAR_DEFAUT)
  })
})

describe('fonds détenus — couverture par mandat (C. com. R. 814-37)', () => {
  const PINS_SC = 'PINS.51205.00000.0'
  const CHEN_SC = 'CHEN.51205.00000.0'
  const OLIV_FT = 'OLIV.51220.00000.0'
  const centralisateur = (mandatId: string, segment: string, comptes: CompteFondsDetenus[]): MandatFondsDetenus => ({
    mandatId,
    coproprieteId: `copro-${segment.toLowerCase()}`,
    segmentSyndicat: segment,
    fondement: 'Administrateur provisoire (art. 47)',
    comptes,
  })
  const donneesCentralisateur = (): DonneesFondsDetenus => ({
    reglagesComptes: creerReglagesComptesCabinet({ modeParDefaut: 'centralisateur_cabinet' }),
    mandats: [
      centralisateur('m-pins', 'PINS', [compte({ banqueId: 'b-pins', compte512: PINS_SC, nature: 'sous_compte_centralisateur' })]),
      centralisateur('m-chen', 'CHEN', [compte({ banqueId: 'b-chen', compte512: CHEN_SC, nature: 'sous_compte_centralisateur' })]),
      centralisateur('m-oliv', 'OLIV', [compte({ banqueId: 'b-oliv-ft', compte512: OLIV_FT, nature: 'fonds_travaux' })]),
    ],
    comptabilites: [
      { coproprieteId: 'copro-pins', traitements: [entree('p1', '2026-10-01', PINS_SC, 100_000), sortie('p2', '2026-10-02', PINS_SC, 150_000)] },
      { coproprieteId: 'copro-chen', traitements: [entree('c1', '2026-10-01', CHEN_SC, 200_000)] },
      { coproprieteId: 'copro-oliv', traitements: [entree('o1', '2026-10-01', OLIV_FT, 70_000)] },
    ],
  })

  it('sous-compte du centralisateur négatif : servi par un autre mandat (bloquant) ; mandat au solde négatif (bloquant)', () => {
    const anomalies = controlerCouvertureA('2026-12-31', donneesCentralisateur())
    expect(anomalies.map((a) => [a.code, a.gravite, a.mandatIds, a.banqueId, a.fondement])).toEqual([
      ['ventilation_absente', 'bloquant', ['m-oliv'], null, 'C. com. R. 814-37'],
      ['servi_par_un_autre_mandat', 'bloquant', ['m-pins'], 'b-pins', 'C. com. R. 814-37'],
      ['mandat_solde_negatif', 'bloquant', ['m-pins'], null, 'C. com. R. 814-37'],
    ])
    expect(anomalies[1].message).toContain(`solde de ${formatEurosCentimes(-500)} au 31/12/2026`)
  })

  it('un solde négatif ne vient jamais en déduction des fonds des autres comptes : totaux sur les soldes positifs, négatifs à part', () => {
    const fonds = fondsDetenusA('2026-12-31', donneesCentralisateur())
    expect(fonds.comptes.map((l) => [l.banqueId, l.soldeCentimes, l.mutualise])).toEqual([
      ['b-pins', -50_000, true],
      ['b-chen', 200_000, true],
      ['b-oliv-ft', 70_000, null],
    ])
    expect(fonds.totalCentimes).toBe(270_000)
    expect(fonds.soldesNegatifsCentimes).toBe(-50_000)
    expect(fonds.mandats.map((m) => [m.mandatId, m.fondsDetenusCentimes, m.soldeNetCentimes, m.complet])).toEqual([
      ['m-pins', 0, -50_000, true],
      ['m-chen', 200_000, 200_000, true],
      ['m-oliv', 70_000, 70_000, false],
    ])
    expect(fonds.parEtablissement.map((g) => g.fondsDetenusCentimes)).toEqual([270_000])
  })

  it('mandat tenu en compte centralisateur sans sous-compte : ventilation absente, rien n’est inventé, mandat incomplet', () => {
    const fonds = fondsDetenusA('2026-12-31', donneesCentralisateur())
    const anomalie = fonds.anomalies.find((a) => a.code === 'ventilation_absente')
    expect(anomalie?.message).toMatch(/sous-compte/)
    expect(anomalie?.message).toMatch(/non calculée/)
    expect(fonds.comptes.filter((l) => l.mandatId === 'm-oliv').map((l) => l.nature)).toEqual(['fonds_travaux'])
  })

  it('compte propre négatif (découvert) : alerte sur le compte, même si le mandat reste positif par ses autres comptes', () => {
    const traitements = [...traitementsAcac, sortie('acac-4', '2026-12-31', ACAC_COURANT, 400_000)]
    const fonds = fondsDetenusA('2026-12-31', donnees({ comptabilites: [{ coproprieteId: 'copro-tilleuls', traitements: traitementsTill }, { coproprieteId: 'copro-acacias', traitements }] }))
    expect(fonds.anomalies.map((a) => [a.code, a.gravite, a.mandatIds, a.banqueId])).toEqual([
      ['compte_solde_negatif', 'alerte', ['m-acac'], 'b-acac-courant'],
    ])
    expect(fonds.mandats.find((m) => m.mandatId === 'm-acac')).toMatchObject({ fondsDetenusCentimes: 100_000, soldeNetCentimes: 80_000 })
    expect(fonds.soldesNegatifsCentimes).toBe(-20_000)
  })

  it('compte sans IBAN (hors sous-compte du centralisateur) au solde négatif : partage non établi, couverture non vérifiable, jamais un simple découvert', () => {
    // Le compte à la Caisse des dépôts des Tilleuls n'a pas d'IBAN : rien ne dit s'il est propre au mandat ou s'il est le
    // compte global de l'administrateur (note, R. 814-40 et règle 512.5). Le mandat reste positif grâce au fonds de travaux.
    const traitements = [entree('till-a', '2026-04-01', TILL_FT, 300_000), sortie('till-b', '2026-06-15', TILL_CDC, 200_000)]
    const fonds = fondsDetenusA(
      '2026-12-31',
      donnees({ comptabilites: [{ coproprieteId: 'copro-tilleuls', traitements }, { coproprieteId: 'copro-acacias', traitements: traitementsAcac }] }),
    )
    expect(fonds.comptes.map((l) => [l.banqueId, l.mutualise])).toEqual([
      ['b-till-cdc', null],
      ['b-till-ft', null],
      ['b-acac-courant', false],
      ['b-acac-ft', false],
    ])
    expect(fonds.anomalies.map((a) => [a.code, a.gravite, a.mandatIds, a.banqueId, a.fondement])).toEqual([
      ['couverture_non_verifiable', 'bloquant', ['m-till'], 'b-till-cdc', 'C. com. R. 814-37'],
    ])
    expect(fonds.anomalies[0].message).toContain(`solde de ${formatEurosCentimes(-2000)} au 31/12/2026`)
    expect(fonds.anomalies[0].message).toMatch(/IBAN/)
    expect(fonds.anomalies[0].message).not.toMatch(/découvert\)/)
    expect(controlerCouvertureA('2026-12-31', donnees({ comptabilites: [{ coproprieteId: 'copro-tilleuls', traitements }, { coproprieteId: 'copro-acacias', traitements: traitementsAcac }] })).map((a) => a.code)).toEqual([
      'couverture_non_verifiable',
    ])
  })

  it('mandat incomplet au solde net négatif : le solde ne porte que sur ses comptes ventilés, sans prétendre savoir qui l’a couvert', () => {
    const ancien: MandatFondsDetenus = { ...mandatAcac(), mandatId: 'm-acac-ancien', comptes: [compte({ banqueId: 'b-acac-courant', compte512: ACAC_COURANT, iban: IBAN_A })] }
    const traitements = [...traitementsAcac, sortie('acac-5', '2026-12-31', ACAC_FT, 150_000)]
    const fonds = fondsDetenusA(
      '2026-12-31',
      donnees({ mandats: [mandatTill(), mandatAcac(), ancien], comptabilites: [{ coproprieteId: 'copro-tilleuls', traitements: traitementsTill }, { coproprieteId: 'copro-acacias', traitements }] }),
    )
    const negatif = fonds.anomalies.find((a) => a.code === 'mandat_solde_negatif')
    expect(negatif).toMatchObject({ gravite: 'bloquant', mandatIds: ['m-acac'] })
    expect(negatif?.message).toMatch(/comptes ventilés/)
    expect(negatif?.message).toMatch(/non ventilés n'est pas connu/)
    expect(negatif?.message).not.toMatch(/d'autres fonds/)
  })

  it('même IBAN sous deux mandats : compte mutualisé, ventilé par les 512 de chaque mandat ; négatif, il est servi par l’autre', () => {
    const X = 'XAVI.51200.00000.0'
    const Y = 'YVES.51200.00000.0'
    const fonds = fondsDetenusA('2026-12-31', {
      reglagesComptes: creerReglagesComptesCabinet({}),
      mandats: [
        { mandatId: 'm-x', coproprieteId: 'copro-x', segmentSyndicat: 'XAVI', fondement: 'art. 29-1', comptes: [compte({ banqueId: 'b-x', compte512: X, nature: 'caisse_depots', iban: IBAN_C })] },
        { mandatId: 'm-y', coproprieteId: 'copro-y', segmentSyndicat: 'YVES', fondement: 'art. 29-1', comptes: [compte({ banqueId: 'b-y', compte512: Y, nature: 'caisse_depots', iban: IBAN_C.replaceAll(' ', '') })] },
      ],
      comptabilites: [
        { coproprieteId: 'copro-x', traitements: [sortie('x1', '2026-11-01', X, 10_000)] },
        { coproprieteId: 'copro-y', traitements: [entree('y1', '2026-11-01', Y, 90_000)] },
      ],
    })
    expect(fonds.comptes.map((l) => [l.banqueId, l.mutualise])).toEqual([
      ['b-x', true],
      ['b-y', true],
    ])
    expect(fonds.anomalies.map((a) => [a.code, a.mandatIds])).toEqual([
      ['servi_par_un_autre_mandat', ['m-x']],
      ['mandat_solde_negatif', ['m-x']],
    ])
  })

  it('même compte 512 d’un syndicat déclaré sous deux mandats : solde attribué à aucun (non ventilé), signalé, les deux mandats incomplets', () => {
    const ancien: MandatFondsDetenus = { ...mandatAcac(), mandatId: 'm-acac-ancien', comptes: [compte({ banqueId: 'b-acac-courant', compte512: ACAC_COURANT, iban: IBAN_A })] }
    const fonds = fondsDetenusA('2026-12-31', donnees({ mandats: [mandatTill(), mandatAcac(), ancien] }))
    const partage = fonds.comptes.filter((l) => l.compte512 === ACAC_COURANT)
    expect(partage.map((l) => [l.mandatId, l.mandatIds, l.categorie, l.soldeCentimes])).toEqual([[null, ['m-acac', 'm-acac-ancien'], null, 380_000]])
    expect(fonds.nonVentileCentimes).toBe(380_000)
    expect(fonds.totalCentimes).toBe(1_580_000)
    expect(fonds.mandats.map((m) => [m.mandatId, m.fondsDetenusCentimes, m.complet])).toEqual([
      ['m-till', 1_100_000, true],
      ['m-acac', 100_000, false],
      ['m-acac-ancien', 0, false],
    ])
    expect(fonds.parCategorie.map((g) => [g.cle, g.fondsDetenusCentimes])).toEqual([
      ['sj', 100_000],
      ['ap291', 1_100_000],
      ['non_ventile', 380_000],
    ])
    expect(fonds.anomalies.map((a) => [a.code, a.gravite, a.mandatIds, a.banqueId])).toEqual([
      ['compte_partage_entre_mandats', 'bloquant', ['m-acac', 'm-acac-ancien'], 'b-acac-courant'],
    ])
  })

  it('le filtre de mandats ne fait pas d’un compte partagé un compte propre ; la comptabilité d’un mandat écarté n’est pas exigée', () => {
    const ancien: MandatFondsDetenus = { ...mandatAcac(), mandatId: 'm-acac-ancien', comptes: [compte({ banqueId: 'b-acac-courant', compte512: ACAC_COURANT, iban: IBAN_A })] }
    const fonds = fondsDetenusA('2026-12-31', donnees({ mandats: [mandatTill(), mandatAcac(), ancien] }), { mandatIds: ['m-acac'] })
    expect(fonds.comptes.map((l) => [l.banqueId, l.mandatId, l.mandatIds])).toEqual([
      ['b-acac-courant', null, ['m-acac', 'm-acac-ancien']],
      ['b-acac-ft', 'm-acac', ['m-acac']],
    ])
    expect(fonds.mandats.map((m) => [m.mandatId, m.complet])).toEqual([['m-acac', false]])
    const sansTill = donnees({ comptabilites: [{ coproprieteId: 'copro-acacias', traitements: traitementsAcac }] })
    expect(fondsDetenusA('2026-12-31', sansTill, { mandatIds: ['m-acac'] }).totalCentimes).toBe(480_000)
  })

  it('mandat sans aucun compte : signalé, incomplet', () => {
    const fonds = fondsDetenusA('2026-12-31', donnees({ mandats: [mandatTill({ comptes: [] })] }))
    expect(fonds.mandats[0]).toMatchObject({ complet: false, nombreComptes: 0, fondsDetenusCentimes: 0 })
    expect(fonds.anomalies.map((a) => [a.code, a.gravite])).toEqual([['aucun_compte', 'alerte']])
  })

  it('la couverture porte sur tous les comptes du mandat, même hors périmètre', () => {
    const perimetre = creerPerimetreFondsDetenus({ autres_comptes: false })
    const fonds = fondsDetenusA('2026-12-31', donneesCentralisateur(), { perimetre })
    expect(fonds.totalCentimes).toBe(70_000)
    expect(fonds.anomalies.map((a) => a.code)).toEqual(['ventilation_absente', 'servi_par_un_autre_mandat', 'mandat_solde_negatif'])
  })

  it('catégorie de mission tirée du fondement du mandat ; fondement non reconnu (mandat ad hoc…) rangé à part', () => {
    const fonds = fondsDetenusA('2026-12-31', donnees({ mandats: [mandatTill({ fondement: 'Mandat ad hoc' }), mandatAcac({ fondement: 'Administrateur provisoire (art. 47)' })] }))
    expect(fonds.mandats.map((m) => m.categorie)).toEqual(['non_reconnue', 'ap47'])
    expect(fonds.parCategorie.map((g) => [g.cle, g.libelle])).toEqual([
      ['ap47', 'Administrateur provisoire · syndicat dépourvu de syndic'],
      ['non_reconnue', 'Fondement non reconnu (mandat ad hoc ou autre)'],
    ])
  })
})

describe('J67, R91 — catégories de mission (C. com. R. 814-30) : réglage du cabinet, le régime du mandat par défaut', () => {
  const regroupees = () =>
    creerCategoriesMission([
      { cle: 'administration_provisoire', libelle: 'Administration provisoire (art. 29-1 et art. 47)', regimes: ['ap291', 'ap47'] },
      { cle: 'syndic_judiciaire', libelle: 'Syndic désigné en justice', regimes: ['sj'] },
    ])

  it('par défaut : une catégorie par régime du mandat (art. 46, art. 47, art. 29-1)', () => {
    expect(CATEGORIES_MISSION_PAR_DEFAUT.map((c) => [c.cle, c.regimes])).toEqual([
      ['sj', ['sj']],
      ['ap47', ['ap47']],
      ['ap291', ['ap291']],
    ])
    expect(fondsDetenusA('2026-12-31', donnees(), { categoriesMission: CATEGORIES_MISSION_PAR_DEFAUT })).toEqual(fondsDetenusA('2026-12-31', donnees()))
  })

  it('le cabinet regroupe les régimes à sa façon : catégories des mandats et totaux suivent sa liste, dans son ordre', () => {
    const fonds = fondsDetenusA('2026-12-31', donnees(), { categoriesMission: regroupees() })
    expect(fonds.mandats.map((m) => [m.mandatId, m.categorie])).toEqual([
      ['m-till', 'administration_provisoire'],
      ['m-acac', 'syndic_judiciaire'],
    ])
    expect(fonds.comptes.map((l) => l.categorie)).toEqual(['administration_provisoire', 'administration_provisoire', 'syndic_judiciaire', 'syndic_judiciaire'])
    expect(fonds.parCategorie.map((g) => [g.cle, g.libelle, g.fondsDetenusCentimes])).toEqual([
      ['administration_provisoire', 'Administration provisoire (art. 29-1 et art. 47)', 1_100_000],
      ['syndic_judiciaire', 'Syndic désigné en justice', 480_000],
    ])
  })

  it('régime reconnu absent de la liste du cabinet : « hors catégories » ; fondement non reconnu : « non reconnue » ; après ses catégories', () => {
    const categoriesMission = creerCategoriesMission([{ cle: 'sj', libelle: 'Syndic désigné en justice', regimes: ['sj'] }])
    const fonds = fondsDetenusA('2026-12-31', donnees(), { categoriesMission })
    expect(fonds.mandats.map((m) => m.categorie)).toEqual(['hors_categories', 'sj'])
    expect(fonds.parCategorie.map((g) => [g.cle, g.libelle, g.fondsDetenusCentimes])).toEqual([
      ['sj', 'Syndic désigné en justice', 480_000],
      ['hors_categories', 'Régime hors des catégories du cabinet', 1_100_000],
    ])
    // Un mandat ad hoc reste « non reconnue », rangée après les régimes hors catégories.
    const avecAdHoc = donnees({ mandats: [mandatTill({ fondement: 'Mandat ad hoc' }), mandatAcac()] })
    const seuleAp = creerCategoriesMission([{ cle: 'ap', libelle: 'Administration provisoire', regimes: ['ap291'] }])
    expect(fondsDetenusA('2026-12-31', avecAdHoc, { categoriesMission: seuleAp }).parCategorie.map((g) => g.cle)).toEqual(['hors_categories', 'non_reconnue'])
  })

  it('réglage refusé : liste vide, clé vide, en double ou réservée, libellé vide, régime inconnu, absent ou rangé deux fois', () => {
    const une = { cle: 'ap', libelle: 'Administration provisoire', regimes: ['ap291' as const] }
    expect(() => creerCategoriesMission([])).toThrow(/au moins une catégorie/)
    expect(() => creerCategoriesMission([{ ...une, cle: ' ' }])).toThrow(/clé/)
    expect(() => creerCategoriesMission([une, { ...une, regimes: ['sj'] }])).toThrow(/« ap » en double/)
    for (const cle of ['hors_categories', 'non_reconnue', 'non_ventile']) expect(() => creerCategoriesMission([{ ...une, cle }])).toThrow(/réservée/)
    expect(() => creerCategoriesMission([{ ...une, libelle: '' }])).toThrow(/libellé/)
    expect(() => creerCategoriesMission([{ ...une, regimes: ['art99' as never] }])).toThrow(/art99/)
    expect(() => creerCategoriesMission([{ ...une, regimes: [] }])).toThrow(/aucun régime/)
    expect(() => creerCategoriesMission([une, { cle: 'autre', libelle: 'Autre', regimes: ['ap291'] }])).toThrow(/ap291.*deux catégories/)
  })
})

describe('J67, R92 — fonds détenus : solde comptable, avec en annexe le solde bancaire et les suspens de rapprochement', () => {
  /** b-acac-courant au 31/12/2026 : solde comptable 380 000 ; la sortie du 31/12 (− 120 000) n'est pas encore au relevé. */
  const releve = (soldeBanqueCentimes: number) => ({
    banqueId: 'b-acac-courant',
    soldeBanqueCentimes,
    elements: [
      { id: 'compta-acac-3', cote: 'compta' as const, montantCentimes: -120_000, rapproche: false as const, date: '2026-12-31' },
      { id: 'compta-acac-1', cote: 'compta' as const, montantCentimes: 500_000, rapproche: 'auto' as const, date: '2026-02-01', rapprocheLe: '2026-02-03' },
      { id: 'banque-2027', cote: 'banque' as const, montantCentimes: 9_999, rapproche: false as const, date: '2027-01-02' },
    ],
  })

  it('écart expliqué par les suspens : aucune anomalie ; les fonds détenus restent le solde comptable', () => {
    const fonds = fondsDetenusA('2026-12-31', donnees())
    const annexe = annexeSoldeBancaireEtSuspens(fonds, [releve(500_000)])
    expect(annexe.date).toBe('2026-12-31')
    expect(annexe.lignes.map((l) => [l.mandatId, l.banqueId, l.soldeComptableCentimes, l.soldeBancaireCentimes, l.ecartNonExpliqueCentimes])).toEqual([
      ['m-till', 'b-till-cdc', 800_000, null, null],
      ['m-till', 'b-till-ft', 300_000, null, null],
      ['m-acac', 'b-acac-courant', 380_000, 500_000, 0],
      ['m-acac', 'b-acac-ft', 100_000, null, null],
    ])
    const courant = annexe.lignes[2]
    expect(courant.suspens?.compta.map((e) => e.id)).toEqual(['compta-acac-3'])
    expect(courant.suspens?.totalComptaCentimes).toBe(-120_000)
    expect(courant.suspens?.banque).toEqual([])
    expect(annexe.anomalies).toEqual([])
    expect(fonds.totalCentimes).toBe(1_580_000)
  })

  it('écart que les suspens n’expliquent pas : signalé, sans bloquer', () => {
    const annexe = annexeSoldeBancaireEtSuspens(fondsDetenusA('2026-12-31', donnees()), [releve(510_000)])
    expect(annexe.lignes[2].ecartNonExpliqueCentimes).toBe(10_000)
    expect(annexe.anomalies.map((a) => [a.code, a.gravite, a.mandatIds, a.banqueId])).toEqual([['ecart_banque_non_explique', 'alerte', ['m-acac'], 'b-acac-courant']])
    expect(annexe.anomalies[0].message).toContain(formatEurosCentimes(100))
    expect(annexe.anomalies[0].message).toMatch(/rapprochement/)
  })

  it('relevé d’un compte inconnu, fourni deux fois, ou solde non entier : refusé', () => {
    const fonds = fondsDetenusA('2026-12-31', donnees())
    expect(() => annexeSoldeBancaireEtSuspens(fonds, [{ ...releve(500_000), banqueId: 'b-inconnu' }])).toThrow(/b-inconnu/)
    expect(() => annexeSoldeBancaireEtSuspens(fonds, [releve(500_000), releve(500_000)])).toThrow(/deux fois/)
    expect(() => annexeSoldeBancaireEtSuspens(fonds, [releve(500_000.5)])).toThrow(/centimes/)
  })
})

describe('fonds détenus — données refusées', () => {
  it('date invalide', () => {
    expect(() => fondsDetenusA('2026-02-30', donnees())).toThrow(/AAAA-MM-JJ/)
    expect(() => controlerCouvertureA('31/12/2026', donnees())).toThrow(/AAAA-MM-JJ/)
  })

  it('compte hors 512 du syndicat, ou d’un autre syndicat (D1)', () => {
    const hors512 = mandatTill({ comptes: [compte({ banqueId: 'b', compte512: 'TILL.53000.00000.0', nature: 'caisse_depots' })] })
    expect(() => fondsDetenusA('2026-12-31', donnees({ mandats: [hors512] }))).toThrow(/512/)
    const autre = mandatTill({ comptes: [compte({ banqueId: 'b', compte512: ACAC_COURANT, nature: 'caisse_depots' })] })
    expect(() => fondsDetenusA('2026-12-31', donnees({ mandats: [autre] }))).toThrow(/TILL/)
  })

  it('comptabilité du syndicat absente ou en double, mandat en double, compte en double dans un mandat', () => {
    expect(() => fondsDetenusA('2026-12-31', donnees({ comptabilites: [{ coproprieteId: 'copro-tilleuls', traitements: traitementsTill }] }))).toThrow(
      /copro-acacias/,
    )
    const doubleCompta = donnees()
    expect(() => fondsDetenusA('2026-12-31', { ...doubleCompta, comptabilites: [...doubleCompta.comptabilites, doubleCompta.comptabilites[0]] })).toThrow(
      /copro-tilleuls/,
    )
    expect(() => fondsDetenusA('2026-12-31', donnees({ mandats: [mandatTill(), mandatTill()] }))).toThrow(/m-till/)
    const till = mandatTill()
    expect(() => fondsDetenusA('2026-12-31', donnees({ mandats: [{ ...till, comptes: [till.comptes[0], till.comptes[0]] }] }))).toThrow(/b-till-cdc|51210/)
  })

  it('un même compte décrit différemment par deux mandats est refusé : la première description ne l’emporte pas en silence', () => {
    const ancien = (c: CompteFondsDetenus): MandatFondsDetenus => ({ ...mandatAcac(), mandatId: 'm-acac-ancien', comptes: [c] })
    const avec = (c: CompteFondsDetenus) => donnees({ mandats: [mandatTill(), mandatAcac(), ancien(c)] })
    expect(() => fondsDetenusA('2026-12-31', avec(compte({ banqueId: 'b-acac-courant', compte512: ACAC_COURANT, iban: IBAN_A, nature: 'caisse_depots' })))).toThrow(
      /ACAC\.51200\.00000\.0.*nature/,
    )
    expect(() => fondsDetenusA('2026-12-31', avec(compte({ banqueId: 'b-autre', compte512: ACAC_COURANT, iban: IBAN_A })))).toThrow(/identifiant/)
    expect(() => fondsDetenusA('2026-12-31', avec(compte({ banqueId: 'b-acac-courant', compte512: ACAC_COURANT, iban: IBAN_C })))).toThrow(/IBAN/)
    expect(() => fondsDetenusA('2026-12-31', avec(compte({ banqueId: 'b-acac-courant', compte512: ACAC_COURANT, iban: IBAN_A, etablissement: 'Autre banque' })))).toThrow(
      /établissement/,
    )
    expect(() => fondsDetenusA('2026-12-31', avec(compte({ banqueId: 'b-acac-courant', compte512: 'ACAC.51209.00000.0', iban: IBAN_A })))).toThrow(
      /b-acac-courant.*deux comptes 512/,
    )
    // Même description, à la casse et aux espaces près : accepté (compte partagé, non ventilé).
    expect(fondsDetenusA('2026-12-31', avec(compte({ banqueId: 'b-acac-courant', compte512: ACAC_COURANT, iban: IBAN_A.replaceAll(' ', ''), etablissement: 'BANQUE exemple' }))).nonVentileCentimes).toBe(380_000)
  })

  it('nature inconnue, mention « tenait le fonds de travaux » hors compte repris, segment invalide, mode de tenue inconnu', () => {
    const nature = mandatTill({ comptes: [compte({ banqueId: 'b', compte512: TILL_CDC, nature: 'especes' as never })] })
    expect(() => fondsDetenusA('2026-12-31', donnees({ mandats: [nature] }))).toThrow(/especes/)
    const mention = mandatTill({ comptes: [compte({ banqueId: 'b', compte512: TILL_CDC, nature: 'courant', tenaitFondsTravaux: true })] })
    expect(() => fondsDetenusA('2026-12-31', donnees({ mandats: [mention] }))).toThrow(/repris/)
    // J71 : « réservé au fonds de travaux » ne se porte que sur un compte de placement.
    const reserve = mandatTill({ comptes: [compte({ banqueId: 'b', compte512: TILL_CDC, nature: 'courant', reserveAuFondsTravaux: true })] })
    expect(() => fondsDetenusA('2026-12-31', donnees({ mandats: [reserve] }))).toThrow(/Mandat m-till, compte b : seul un compte de placement/)
    expect(() => fondsDetenusA('2026-12-31', donnees({ mandats: [mandatTill({ segmentSyndicat: 'TIL' })] }))).toThrow(/segment/i)
    expect(() => fondsDetenusA('2026-12-31', donnees({ mandats: [mandatTill({ modeComptes: 'coffre' as never })] }))).toThrow(/coffre/)
  })
})

describe('fonds détenus — dates de référence et échéances', () => {
  it('une année : fins de trimestre (envoi sous quinze jours), 30/06 et 31/12 (commissaire aux comptes), 31/12 (caisse de garantie)', () => {
    expect(echeancesFondsDetenusDeLAnnee(2026).map((e) => [e.date, e.objet, e.dateLimite, e.fondement])).toEqual([
      ['2026-03-31', 'etat_trimestriel', '2026-04-15', 'C. com. R. 814-34 ; R. 814-35'],
      ['2026-06-30', 'arrete_comptabilite_speciale', '2026-09-14', 'C. com. R. 814-29 ; R. 814-30'],
      ['2026-06-30', 'etat_trimestriel', '2026-07-15', 'C. com. R. 814-34 ; R. 814-35'],
      ['2026-09-30', 'etat_trimestriel', '2026-10-15', 'C. com. R. 814-34 ; R. 814-35'],
      ['2026-12-31', 'cotisation_caisse_garantie', null, 'C. com. R. 814-21'],
      ['2026-12-31', 'arrete_comptabilite_speciale', '2027-03-14', 'C. com. R. 814-29 ; R. 814-30'],
      ['2026-12-31', 'etat_trimestriel', '2027-01-15', 'C. com. R. 814-34 ; R. 814-35'],
    ])
  })

  it('date limite = dernier jour pour agir : « dans les quinze jours suivant » la fin du trimestre → le quinzième ; « avant le 15 mars » → le 14', () => {
    const annee = echeancesFondsDetenusDeLAnnee(2026)
    const attestation = (date: string) => annee.find((e) => e.date === date && e.objet === 'arrete_comptabilite_speciale')
    expect(attestation('2026-06-30')).toMatchObject({ dateLimite: '2026-09-14', echeance: '2026-09-14' })
    expect(attestation('2026-06-30')?.acteAttendu).toMatch(/avant le 15\/09\/2026/)
    expect(attestation('2026-12-31')?.acteAttendu).toMatch(/avant le 15\/03\/2027/)
    // Années bissextiles : les dates de référence ne bougent pas, l'horizon de douze mois depuis un 29 février s'arrête au 28.
    expect(echeancesFondsDetenusDeLAnnee(2028).map((e) => [e.date, e.dateLimite])).toEqual(
      echeancesFondsDetenusDeLAnnee(2026).map((e) => [e.date.replace('2026', '2028'), e.dateLimite?.replace('2027', '2029').replace('2026', '2028') ?? null]),
    )
    expect(prochainesEcheancesFondsDetenus('2028-02-29').map((e) => [e.date, e.objet])).toEqual([
      ['2027-12-31', 'arrete_comptabilite_speciale'],
      ['2028-03-31', 'etat_trimestriel'],
      ['2028-06-30', 'etat_trimestriel'],
      ['2028-06-30', 'arrete_comptabilite_speciale'],
      ['2028-09-30', 'etat_trimestriel'],
      ['2028-12-31', 'cotisation_caisse_garantie'],
      ['2028-12-31', 'etat_trimestriel'],
      ['2028-12-31', 'arrete_comptabilite_speciale'],
    ])
    expect(prochainesEcheancesFondsDetenus('2027-03-15', { jusquAu: '2027-03-31' }).map((e) => e.objet)).toEqual(['etat_trimestriel'])
  })

  it('J67, R93 — date limite un samedi, un dimanche ou un jour férié : aucun report ; alerte, envoi au plus tard le dernier jour ouvré précédent', () => {
    const annee = echeancesFondsDetenusDeLAnnee(2026)
    // Attestation de l'arrêté du 31/12/2026 : « avant le 15 mars » → le 14/03/2027, un dimanche.
    const attestation = annee.find((e) => e.date === '2026-12-31' && e.objet === 'arrete_comptabilite_speciale')
    expect(attestation).toMatchObject({ dateLimite: '2027-03-14', echeance: '2027-03-14', dernierJourOuvre: '2027-03-12' })
    expect(attestation?.alerteJourNonOuvre).toMatch(/14\/03\/2027.*jour non ouvré.*sans report \(J63\).*au plus tard le dernier jour ouvré précédent, le 12\/03\/2027/)
    // Un jour ouvré : rien à signaler ; sans date limite (cotisation) : rien non plus.
    expect(annee.find((e) => e.date === '2026-03-31')).toMatchObject({ dateLimite: '2026-04-15', dernierJourOuvre: null, alerteJourNonOuvre: null })
    expect(annee.find((e) => e.objet === 'cotisation_caisse_garantie')).toMatchObject({ dernierJourOuvre: null, alerteJourNonOuvre: null })
    // État du trimestre clos le 31/12/2027 : le 15/01/2028 est un samedi.
    expect(echeancesFondsDetenusDeLAnnee(2027).find((e) => e.date === '2027-12-31' && e.objet === 'etat_trimestriel')).toMatchObject({
      dateLimite: '2028-01-15',
      dernierJourOuvre: '2028-01-14',
    })
    expect(prochainesEcheancesFondsDetenus('2027-03-01', { jusquAu: '2027-03-31' }).find((e) => e.objet === 'arrete_comptabilite_speciale')?.dernierJourOuvre).toBe('2027-03-12')
    // Dernier jour ouvrable au plus tard le jour donné : jours fériés compris (lundi de Pâques 2026 : le 06/04).
    expect(avancerAuJourOuvrable('2026-04-06')).toBe('2026-04-03')
    expect(avancerAuJourOuvrable('2026-04-07')).toBe('2026-04-07')
    expect(avancerAuJourOuvrable('2026-12-26', { alsaceMoselle: true })).toBe('2026-12-24')
  })

  it('les dates limites sont déduites (décompte, rattachement à l’arrêté) ; la cotisation n’en a pas (⚪ aucune trouvée)', () => {
    const annee = echeancesFondsDetenusDeLAnnee(2026)
    expect(annee.find((e) => e.objet === 'cotisation_caisse_garantie')).toMatchObject({ dateLimite: null, acteAttendu: null, dateLimiteDeduite: null })
    expect(annee.filter((e) => e.dateLimite !== null).every((e) => e.dateLimiteDeduite === true)).toBe(true)
    expect(annee.find((e) => e.objet === 'cotisation_caisse_garantie')?.libelle).toMatch(/31\/12\/2026.*cotisation 2027/)
    expect(annee.find((e) => e.date === '2026-12-31' && e.objet === 'arrete_comptabilite_speciale')?.acteAttendu).toMatch(/commissaire aux comptes/)
    expect(annee.find((e) => e.date === '2026-03-31')?.acteAttendu).toMatch(/greffe.*procureur/)
  })

  it('prochaines échéances : celles dont l’échéance (date limite, sinon date) n’est pas passée, sur douze mois, triées par échéance', () => {
    expect(prochainesEcheancesFondsDetenus('2026-11-17').map((e) => [e.date, e.objet, e.echeance])).toEqual([
      ['2026-12-31', 'cotisation_caisse_garantie', '2026-12-31'],
      ['2026-12-31', 'etat_trimestriel', '2027-01-15'],
      ['2026-12-31', 'arrete_comptabilite_speciale', '2027-03-14'],
      ['2027-03-31', 'etat_trimestriel', '2027-04-15'],
      ['2027-06-30', 'etat_trimestriel', '2027-07-15'],
      ['2027-06-30', 'arrete_comptabilite_speciale', '2027-09-14'],
      ['2027-09-30', 'etat_trimestriel', '2027-10-15'],
    ])
  })

  it('une échéance de l’année précédente encore ouverte est listée ; l’horizon se règle ; bornes contrôlées', () => {
    expect(prochainesEcheancesFondsDetenus('2027-01-15', { jusquAu: '2027-03-31' }).map((e) => [e.date, e.objet])).toEqual([
      ['2026-12-31', 'etat_trimestriel'],
      ['2026-12-31', 'arrete_comptabilite_speciale'],
      ['2027-03-31', 'etat_trimestriel'],
    ])
    expect(() => prochainesEcheancesFondsDetenus('2027-13-01')).toThrow(/AAAA-MM-JJ/)
    expect(() => prochainesEcheancesFondsDetenus('2027-02-01', { jusquAu: '2027-01-01' })).toThrow(/2027-01-01/)
    expect(() => echeancesFondsDetenusDeLAnnee(2026.5)).toThrow(/2026.5/)
  })
})

describe('fonds détenus — maximum sur une période (indicateur interne seulement)', () => {
  it('maximum des fonds détenus en fin de journée sur la période, et premier jour où il est atteint', () => {
    const indicateur = maximumInterneFondsDetenus('2026-01-01', '2026-12-31', donnees())
    expect(indicateur).toMatchObject({ nature: 'indicateur_interne', du: '2026-01-01', au: '2026-12-31', maximumCentimes: 1_900_000, atteintLe: '2026-05-01' })
    expect(indicateur.libelle).toMatch(/indicateur interne, sans valeur réglementaire/)
    expect(indicateur.libelle).not.toMatch(/pointe|garantie|obligat/i)
  })

  it('compte les soldes antérieurs à la période ; suit le périmètre ; ignore les écritures postérieures', () => {
    expect(maximumInterneFondsDetenus('2026-06-01', '2026-06-30', donnees())).toMatchObject({ maximumCentimes: 1_900_000, atteintLe: '2026-06-01' })
    const sansFondsTravaux = creerPerimetreFondsDetenus({ fonds_travaux: false })
    expect(maximumInterneFondsDetenus('2026-01-01', '2026-12-31', donnees(), { perimetre: sansFondsTravaux })).toMatchObject({
      maximumCentimes: 1_500_000,
      atteintLe: '2026-03-01',
    })
    expect(maximumInterneFondsDetenus('2027-01-01', '2027-01-31', donnees())).toMatchObject({ maximumCentimes: 1_630_000, atteintLe: '2027-01-05' })
    // L'entrée du 01/05 porterait le total à 1 900 000 : hors période, elle n'est pas lue ; celle du dernier jour l'est.
    expect(maximumInterneFondsDetenus('2026-01-01', '2026-04-30', donnees())).toMatchObject({ maximumCentimes: 1_800_000, atteintLe: '2026-04-01' })
    expect(maximumInterneFondsDetenus('2026-01-01', '2026-05-01', donnees())).toMatchObject({ maximumCentimes: 1_900_000, atteintLe: '2026-05-01' })
  })

  it('le maximum est le plus haut des totaux de fin de journée que donne le calcul à une date, jour par jour', () => {
    const perimetre = creerPerimetreFondsDetenus({ fonds_travaux: false })
    const d = donnees({ comptabilites: [{ coproprieteId: 'copro-tilleuls', traitements: traitementsTill }, { coproprieteId: 'copro-acacias', traitements: [...traitementsAcac, sortie('acac-6', '2026-03-10', ACAC_COURANT, 700_000)] }] })
    let attendu = { centimes: -1, le: '' }
    for (let jour = '2026-01-01'; jour <= '2026-12-31'; jour = ajouterJours(jour, 1)) {
      const total = fondsDetenusA(jour, d, { perimetre }).totalCentimes
      if (total > attendu.centimes) attendu = { centimes: total, le: jour }
    }
    expect(maximumInterneFondsDetenus('2026-01-01', '2026-12-31', d, { perimetre })).toMatchObject({ maximumCentimes: attendu.centimes, atteintLe: attendu.le })
  })

  it('période invalide refusée', () => {
    expect(() => maximumInterneFondsDetenus('2026-12-31', '2026-01-01', donnees())).toThrow(/2026-12-31/)
    expect(() => maximumInterneFondsDetenus('2026-01-01', '2026-02-30', donnees())).toThrow(/AAAA-MM-JJ/)
  })
})

describe('fonds détenus — en-tête et vocabulaire', () => {
  const { texte } = enTeteDuModule('fonds-detenus')

  it('cite la note du point 72, les articles lus, D-BANQUE, et porte ses marques', () => {
    for (const attendu of [
      'NOTE-POINT-72-POINTE-DE-GARANTIE.md',
      'R. 814-21',
      'R. 814-29',
      'R. 814-30',
      'R. 814-34',
      'R. 814-35',
      'R. 814-37',
      '1033.4',
      '1033.5',
      'D-BANQUE',
      'J37',
      '🔵',
      '🔴',
      '⚪',
    ])
      expect(texte).toContain(attendu)
  })

  it('J67, R90 à R93 : décisions inscrites ; leurs questions ne sont plus en 🔴', () => {
    const decisions = texte.slice(texte.indexOf('Décisions de Hugo du 17/11/2026'), texte.indexOf('🔵 Déduit'))
    const nonEtabli = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(decisions).toMatch(/J67, R90 : .*tout inclus.*J65/)
    expect(decisions).toMatch(/J67, R91 : .*réglage du cabinet.*creerCategoriesMission/)
    expect(decisions).toMatch(/J67, R92 : .*solde comptable.*annexeSoldeBancaireEtSuspens/)
    expect(decisions).toMatch(/J67, R93 : .*aucun report.*dernier jour ouvré/)
    expect(nonEtabli).not.toMatch(/ce que comprennent les « fonds non distribués »/)
    expect(nonEtabli).not.toMatch(/ce que sont les « catégories de mission »/)
    expect(nonEtabli).not.toMatch(/solde comptable ou solde en banque/)
    expect(nonEtabli).not.toMatch(/son report n'est pas établi/)
  })

  it('ne présente jamais un calcul de « pointe » : aucune fonction ni constante ainsi nommée', () => {
    expect(Object.keys(moduleFonds).filter((nom) => /pointe/i.test(nom))).toEqual([])
    expect(texte).toMatch(/loi Hoguet/)
  })
})
