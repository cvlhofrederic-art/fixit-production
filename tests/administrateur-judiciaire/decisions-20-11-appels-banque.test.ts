import { describe, expect, it } from 'vitest'
import {
  NATURE_COURRIER_PRELEVEMENT_ANNULE,
  contenuAvisAppel,
  controlerModeReglementNouveauCompte,
  creerReglageTip,
  echeancesPrelevementDepuisAvis,
  prelevementsAnnulesParContentieux,
  preparerDiffusionAvis,
  type ContenuAvisCompte,
  type MandatPrelevement,
  type OptionsContenuAvis,
  type OptionsDiffusionAvis,
} from '@/lib/administrateur-judiciaire/domain/avis-appel'
import { creerReglagesComptesCabinet } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import {
  TRACE_APPEL_SANS_ECRITURE,
  annulerAppelees,
  annulerEcheanceAppelee,
  echeancesAAppeler,
  marquerAppeleeSansEcriture,
  marquerAppelees,
  mettreEnAttente,
  postesARelancer,
  postesImputables,
  repriseLigneNegativeGesteam,
  suivreEcheances,
  type EcheanceAppelSuivie,
} from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import {
  SIGNAL_FONDS_TRAVAUX_HORS_COMPTE_DU_FONDS,
  annulerEncaissement,
  enregistrerEncaissement,
  enregistrerRecette,
  partsFondsTravauxAVirer,
  rapprocherEncaissements,
  rattacherRemise,
  traitementEncaissements,
  type EncaissementEnregistre,
  type JournalEncaissement,
} from '@/lib/administrateur-judiciaire/domain/encaissements-pieces'
import { creerExercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import {
  PERIMETRE_FONDS_DETENUS_PAR_DEFAUT,
  RUBRIQUES_FONDS_DETENUS,
  creerPerimetreFondsDetenus,
  fondsDetenusA,
  rubriqueDuCompte,
  type CompteFondsDetenus,
  type DonneesFondsDetenus,
} from '@/lib/administrateur-judiciaire/domain/fonds-detenus'
import { controlerContexteFusion } from '@/lib/administrateur-judiciaire/domain/gabarits-courrier'
import {
  creerAdresseDatee,
  creerCompteCoproprietaire,
  creerIdentite,
  creerPosition,
} from '@/lib/administrateur-judiciaire/domain/identites-positions'
import {
  desimputerEncaissement,
  imputerEncaissement,
  imputerEncaissements,
  postesDepuisAvis,
  type PosteDette,
} from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import { creerOrdreVirement, creerRemiseCheques, genererPain001, type LigneVirement } from '@/lib/administrateur-judiciaire/domain/ordres-banque'
import { genererPain008, preparerLotPrelevements } from '@/lib/administrateur-judiciaire/domain/prelevements-sepa'
import type { ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'
import {
  DELAI_EXIGIBILITE_OBSERVE_GESTEAM_JOURS,
  MENTION_DELAI_EXIGIBILITE_PROPOSE,
  justificationExigibilite,
  parametresRepartition,
  propositionExigibiliteSolde,
  type ExigibiliteDecidee,
  type ExigibiliteSolde,
} from '@/lib/administrateur-judiciaire/domain/regularisation-charges'
import { avisDAppel, creerCleRepartition, traitementAppelDeFonds, type EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import { annulerTraitement, creerTraitement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import {
  MENTION_NON_VALIDE_PAR_LA_BANQUE,
  controlerValidationBanque,
  creerFicheValidationBanque,
  type FicheValidationBanque,
  type SaisieFicheValidationBanque,
} from '@/lib/administrateur-judiciaire/domain/validation-banque'
import { borneArreteDesComptes } from '@/lib/administrateur-judiciaire/domain/verrou-saisie'
import {
  alimentationsDuFonds,
  creerVirementInterne,
  emettreLotVirementsInternes,
  type CompteVirementInterne,
  type VirementInterne,
} from '@/lib/administrateur-judiciaire/domain/virement-interne'
import { creerCommunicationAdresseElectronique } from '@/lib/administrateur-judiciaire/domain/voie-notification'
import { enTeteDuModule } from './en-tete-module'

/**
 * Décisions du 20/11/2026 (partie C), thème « appels-banque » : F98, F99, F103 à F108, F110 à F112, F114, F116, F118,
 * F119, F126 et F127. Chaque bloc teste la règle décidée ; les données sont fictives.
 */

// ─── F98, F99 : fonds détenus ────────────────────────────────────────────────────────────────

const ligne = (compte: string, sens: 'debit' | 'credit', montantCentimes: number) => ({ compte, sens, montantCentimes })

const entree = (id: string, date: string, compte: string, montant: number): Traitement =>
  creerTraitement({ id, famille: 'Encaissement', date, mouvements: [ligne(compte, 'debit', montant), ligne('PLAC.45000.00001.0', 'credit', montant)] })

const sortie = (id: string, date: string, compte: string, montant: number): Traitement =>
  creerTraitement({ id, famille: 'Règlement de factures', date, mouvements: [ligne('PLAC.40100.FOURN.0', 'debit', montant), ligne(compte, 'credit', montant)] })

const PLAC_COURANT = 'PLAC.51200.00000.0'
const PLAC_TERME = 'PLAC.50100.00000.0'
const PLAC_AUTRE = 'PLAC.50200.00000.0'

const compte = (surcharge: Partial<CompteFondsDetenus> & Pick<CompteFondsDetenus, 'banqueId' | 'compte512'>): CompteFondsDetenus => ({
  nature: 'courant',
  iban: null,
  etablissement: 'Banque Exemple',
  ...surcharge,
})

const donneesPlacement = (comptes: CompteFondsDetenus[], traitements: Traitement[]): DonneesFondsDetenus => ({
  reglagesComptes: creerReglagesComptesCabinet({}),
  mandats: [{ mandatId: 'm-plac', coproprieteId: 'copro-plac', segmentSyndicat: 'PLAC', fondement: 'Syndic judiciaire (art. 46)', comptes }],
  comptabilites: [{ coproprieteId: 'copro-plac', traitements }],
})

const comptesPlacement = [
  compte({ banqueId: 'b-courant', compte512: PLAC_COURANT, iban: 'FR76 3000 6000 0112 3456 7890 189' }),
  compte({ banqueId: 'b-terme', compte512: PLAC_TERME, nature: 'placement' }),
  compte({ banqueId: 'b-autre', compte512: PLAC_AUTRE, nature: 'placement' }),
]
const traitementsPlacement = [
  entree('e-1', '2026-03-01', PLAC_COURANT, 500_000),
  entree('e-2', '2026-03-02', PLAC_TERME, 200_000),
  entree('e-3', '2026-03-03', PLAC_AUTRE, 50_000),
]

describe('F98 — comptes de placement de classe 50 : comptés à part, « fonds placés », inclus par défaut', () => {
  it('une rubrique « fonds placés » à part, incluse par défaut', () => {
    expect(RUBRIQUES_FONDS_DETENUS.fonds_places.libelle).toMatch(/^Fonds placés/)
    expect(RUBRIQUES_FONDS_DETENUS.fonds_places.libelle).toMatch(/501 « Compte à terme ».*502 « Autre compte »/)
    expect(PERIMETRE_FONDS_DETENUS_PAR_DEFAUT.fonds_places).toBe(true)
    expect(rubriqueDuCompte({ nature: 'placement', compte512: PLAC_TERME })).toBe('fonds_places')
    expect(rubriqueDuCompte({ nature: 'placement', compte512: 'PLAC.51203.00000.0' })).toBe('autres_comptes')
  })

  it('les soldes des 501 et 502 entrent dans le total, sur la ligne « fonds placés »', () => {
    const fonds = fondsDetenusA('2026-12-31', donneesPlacement(comptesPlacement, traitementsPlacement))
    expect(fonds.totalCentimes).toBe(750_000)
    expect(fonds.comptes.map((l) => [l.banqueId, l.rubrique, l.soldeCentimes])).toEqual([
      ['b-courant', 'au_nom_du_syndicat', 500_000],
      ['b-terme', 'fonds_places', 200_000],
      ['b-autre', 'fonds_places', 50_000],
    ])
    expect(fonds.parRubrique.find((r) => r.cle === 'fonds_places')).toMatchObject({ inclus: true, fondsDetenusCentimes: 250_000, nombreComptes: 2 })
    expect(fonds.perimetreParDefaut).toBe(true)
  })

  it('le cabinet peut exclure les fonds placés : ils passent hors périmètre, toujours listés', () => {
    const perimetre = creerPerimetreFondsDetenus({ fonds_places: false })
    const fonds = fondsDetenusA('2026-12-31', donneesPlacement(comptesPlacement, traitementsPlacement), { perimetre })
    expect(fonds.totalCentimes).toBe(500_000)
    expect(fonds.horsPerimetreCentimes).toBe(250_000)
    expect(fonds.perimetreParDefaut).toBe(false)
    expect(fonds.comptes.filter((l) => !l.inclus).map((l) => l.banqueId)).toEqual(['b-terme', 'b-autre'])
  })

  it('un compte de classe 50 est un placement, du même syndicat ; un autre code de classe 5 reste refusé', () => {
    const lire = (c: CompteFondsDetenus) => () => fondsDetenusA('2026-12-31', donneesPlacement([c], []))
    expect(lire(compte({ banqueId: 'b-x', compte512: PLAC_TERME, nature: 'courant' }))).toThrow(/classe 50.*placement/)
    expect(lire(compte({ banqueId: 'b-x', compte512: 'AUTR.50100.00000.0', nature: 'placement' }))).toThrow(/autre syndicat/)
    expect(lire(compte({ banqueId: 'b-x', compte512: 'PLAC.53000.00000.0', nature: 'placement' }))).toThrow(/50/)
  })

  it('en-tête : la décision F98 remplace la marque 🔴 ; le fondement R. 814-30 est cité', () => {
    const { texte, item } = enTeteDuModule('fonds-detenus')
    expect(texte.slice(texte.indexOf('🔴 Non établi'))).not.toMatch(/classe 50 : non lus/)
    expect(item('- Décision du 20/11/2026 (partie C, F98)')).toMatch(/fonds placés.*inclus par défaut.*R\. 814-30/)
  })
})

describe('F99 — total sur les seuls soldes positifs, découverts à part et signalés (aucun changement de calcul)', () => {
  it('un découvert ne vient pas en déduction : il est totalisé à part et signalé', () => {
    const fonds = fondsDetenusA(
      '2026-12-31',
      donneesPlacement(comptesPlacement, [...traitementsPlacement, sortie('s-1', '2026-04-01', PLAC_AUTRE, 80_000)]),
    )
    expect(fonds.totalCentimes).toBe(700_000)
    expect(fonds.soldesNegatifsCentimes).toBe(-30_000)
    expect(fonds.anomalies.map((a) => a.code)).toContain('couverture_non_verifiable')
  })

  it('en-tête : la décision F99 remplace la marque « à confirmer »', () => {
    const { texte, item } = enTeteDuModule('fonds-detenus')
    expect(texte.slice(texte.indexOf('🔴 Non établi'))).not.toMatch(/totaux sur les seuls soldes positifs/)
    expect(item('- Décision du 20/11/2026 (partie C, F99)')).toMatch(/soldes positifs.*découverts.*à part.*R\. 814-37/)
  })
})

// ─── F103 : fiche « validation banque » par compte bancaire du syndicat ─────────────────────

describe('F103 — fichiers SEPA : fiche « validation banque » par compte ; sans elle, mention « non validé par la banque »', () => {
  const virement: LigneVirement = {
    reglementId: 'reg-1',
    beneficiaire: 'Plomberie (fictive)',
    iban: 'FR76 3000 6000 0112 3456 7890 189',
    bic: 'AGRIFRPP',
    montantCentimes: 52_800,
    libelle: 'Facture F-2026-118',
  }
  const ordre = creerOrdreVirement({
    id: 'o-1',
    numero: 'VIR-2026-0011',
    date: '2026-10-27',
    coproprieteId: 'copro-tilleuls',
    banqueId: 'b-courant',
    traitementId: 't-reg-7',
    lignes: [virement],
  })
  const debiteur = { nom: 'SDC Les Tilleuls (fictif)', iban: 'FR14 2004 1010 0505 0001 3M02 606', bic: 'PSSTFRPP' }
  const options = { messageId: 'VIR-2026-0011', dateCreation: '2026-10-27T09:00:00', dateExecution: '2026-10-28' }
  const fiche = (surcharge: Partial<SaisieFicheValidationBanque> = {}) =>
    creerFicheValidationBanque({
      banqueId: 'b-courant',
      dateTest: '2026-11-05',
      formatsAcceptes: ['pain.001.001.03', 'pain.008.001.02'],
      icsVerifie: 'FR12ZZZ123456',
      longueurMaxReferences: 35,
      delaisRemise: 'J-1 ouvré pour un virement, J-2 ouvrés pour un prélèvement',
      ...surcharge,
    })

  it('sans fiche, le fichier de virement porte la mention, en commentaire XML qui ne change pas le message', () => {
    const xml = genererPain001(ordre, debiteur, options)
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<!-- non validé par la banque :/)
    expect(xml).toContain(MENTION_NON_VALIDE_PAR_LA_BANQUE)
    expect(xml).toMatch(/aucune fiche « validation banque »/)
    expect(xml).toContain('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"')
  })

  it('avec une fiche du compte qui accepte ce format : aucune mention', () => {
    const xml = genererPain001(ordre, debiteur, { ...options, validationBanque: fiche() })
    expect(xml).not.toContain(MENTION_NON_VALIDE_PAR_LA_BANQUE)
  })

  it('fiche d’un autre compte, format non accepté (variante), référence trop longue : mention avec le motif', () => {
    const controle = (f: FicheValidationBanque, references: string[] = ['reg-1']) =>
      controlerValidationBanque(f, { banqueId: 'b-courant', format: 'pain.001.001.03', references })
    expect(controle(fiche({ banqueId: 'b-fonds' }))).toMatchObject({ valide: false, motifs: [expect.stringMatching(/autre compte/)] })
    expect(controle(fiche({ formatsAcceptes: ['pain.001.001.09'] })).motifs[0]).toMatch(/pain\.001\.001\.09.*pain\.001\.001\.03/)
    expect(controle(fiche({ longueurMaxReferences: 5 }), ['reg-123456']).motifs[0]).toMatch(/reg-123456.*5 caractères/)
    expect(controle(fiche())).toEqual({ valide: true, mention: null, motifs: [] })
  })

  it('prélèvement : l’ICS du créancier doit être celui que la banque a vérifié', () => {
    const lot = preparerLotPrelevements([
      {
        id: 'AV-2027-01-00012',
        compteCoproprietaire: 'TILL.45000.00012.0',
        debiteur: 'Copropriétaire A',
        iban: 'FR76 3000 6000 0112 3456 7890 189',
        bic: 'AGRIFRPP',
        rum: 'RUM-TILL-00012',
        dateSignatureMandat: '2024-03-01',
        sequence: 'RCUR',
        montantEcheanceCentimes: 30_000,
        soldeDuCentimes: 45_000,
        contentieux: false,
      },
    ])
    const creancier = { nom: 'SDC Les Tilleuls (fictif)', ics: 'FR12ZZZ123456', iban: 'FR14 2004 1010 0505 0001 3M02 606', bic: 'PSSTFRPP' }
    const opt = { messageId: 'AV-2027-01', dateCreation: '2026-12-15T10:00:00', dateEcheance: '2027-01-02' }
    expect(genererPain008(lot, creancier, opt)).toContain(MENTION_NON_VALIDE_PAR_LA_BANQUE)
    expect(genererPain008(lot, creancier, { ...opt, validationBanque: fiche() })).not.toContain(MENTION_NON_VALIDE_PAR_LA_BANQUE)
    const autreIcs = genererPain008(lot, creancier, { ...opt, validationBanque: fiche({ icsVerifie: 'FR99ZZZ999999' }) })
    expect(autreIcs).toMatch(/non validé par la banque : ICS FR12ZZZ123456 non vérifié par la banque/)
    expect(genererPain008(lot, creancier, { ...opt, validationBanque: fiche({ icsVerifie: null }) })).toMatch(/ICS FR12ZZZ123456 non vérifié/)
  })

  it('la fiche se contrôle : date du test, au moins un format, longueur entière positive, ICS valide', () => {
    expect(() => fiche({ dateTest: '2026-13-01' })).toThrow(/date du test/i)
    expect(() => fiche({ formatsAcceptes: [' '] })).toThrow(/format/)
    expect(() => fiche({ longueurMaxReferences: 0 })).toThrow(/longueur/)
    expect(() => fiche({ icsVerifie: 'FR1' })).toThrow(/ICS/)
    expect(() => fiche({ banqueId: ' ' })).toThrow(/compte bancaire/)
    expect(fiche({ formatsAcceptes: [' PAIN.001.001.03 '], delaisRemise: '  ' })).toMatchObject({ formatsAcceptes: ['pain.001.001.03'], delaisRemise: null })
  })

  it('en-têtes : la décision F103 remplace les marques 🔴 des fichiers', () => {
    for (const nom of ['ordres-banque', 'prelevements-sepa']) {
      const { texte } = enTeteDuModule(nom)
      expect(texte).not.toContain('🔴 À valider avec la banque du syndicat avant tout dépôt')
      expect(texte).toMatch(/Décision du 20\/11\/2026 \(partie C, F103\).*validation banque.*non validé par la banque/)
    }
    expect(enTeteDuModule('avis-appel').texte).toMatch(/Décision du 20\/11\/2026 \(partie C, F103\)/)
  })
})

// ─── F104 à F108 : échéancier des appels ─────────────────────────────────────────────────────

const SEGMENT = 'TILL'
const cleGenerale = creerCleRepartition({
  id: 'cle-001',
  coproprieteId: 'copro-1',
  code: '001',
  libelle: 'Charges communes générales',
  lots: [
    { lotId: 'lot-1', tantiemes: 400 },
    { lotId: 'lot-2', tantiemes: 600 },
  ],
})
const comptesCopro = [
  creerCompteCoproprietaire({ id: 'cpt-A', coproprieteId: 'copro-1', serie: '1', libelle: 'A' }),
  creerCompteCoproprietaire({ id: 'cpt-B', coproprieteId: 'copro-1', serie: '2', libelle: 'B' }),
]
const position = (id: string, lotId: string, compteId: string) =>
  creerPosition({ id, identiteId: `i-${id}`, lotId, compteId, qualite: 'Copropriétaire', part: { numerateur: 1, denominateur: 1 }, statut: 'En place', dateEntree: '2020-01-01', dateSortie: null })
const positionsCopro = [position('p1', 'lot-1', 'cpt-A'), position('p2', 'lot-2', 'cpt-B')]
const EXERCICES = [{ nom: '2026', ouverture: '2026-01-01', cloture: '2026-12-31' }]
const B1: EcheanceAppel = { id: 'B-2026-1', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-01-01', libelle: 'Budget 2026 — provision 1/4', montantCentimes: 100_000, nature: 'budget' }
const FT1: EcheanceAppel = { id: 'FT-2026-1', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-01-01', libelle: 'Fonds de travaux 2026 — appel n° 1', montantCentimes: 5_000, nature: 'fonds_travaux' }
const T0: EcheanceAppel = {
  id: '00043-T2',
  coproprieteId: 'copro-1',
  cleId: 'cle-001',
  exigibilite: '2026-01-01',
  libelle: 'Toiture — appel n° 2 (financé par le fonds)',
  montantCentimes: 0,
  nature: 'travaux',
  compteContrepartie: '70200',
}

function appelerTout(echeances: EcheanceAppelSuivie[], id = 't-appel-1') {
  const avis = avisDAppel({ echeances, cles: [cleGenerale], positions: positionsCopro, comptes: comptesCopro })
  const appel = traitementAppelDeFonds(avis, { id, date: '2026-01-01', segmentSyndicat: SEGMENT, comptes: comptesCopro })
  return { avis, appel, postes: postesDepuisAvis(avis), echeances: marquerAppelees(echeances, appel, avis, { exercices: EXERCICES }) }
}

describe('F104 — annuler une seule échéance appelée, non réglée, par une écriture contraire de ses seules lignes', () => {
  const contexte = () => {
    const { avis, appel, postes, echeances } = appelerTout(suivreEcheances([B1, FT1]))
    return {
      echeances,
      options: {
        echeanceId: 'FT-2026-1',
        appel,
        avis,
        postes,
        annulation: { id: 't-annul-ft', date: '2026-02-10', motif: 'Cotisation votée à tort pour 2026' },
        segmentSyndicat: SEGMENT,
        comptes: comptesCopro,
      },
    }
  }

  it('contre-passe le compte de provision de l’appel et le 450 de chaque compte, pour la seule échéance, datée du jour de l’annulation', () => {
    const { echeances, options } = contexte()
    const { traitement, echeances: apres } = annulerEcheanceAppelee(echeances, options)
    expect(traitement).toMatchObject({ id: 't-annul-ft', famille: "Annulation d'appel de fonds", date: '2026-02-10', annule: 't-appel-1' })
    expect(traitement?.mouvements.map((m) => [m.compte, m.sens, m.montantCentimes])).toEqual([
      ['TILL.10500.00000.0', 'debit', 5_000],
      ['TILL.45000.00001.0', 'credit', 2_000],
      ['TILL.45000.00002.0', 'credit', 3_000],
    ])
    expect(apres.map((e) => [e.id, e.statut, e.annulationTraitementId, e.motifAnnulation ?? null])).toEqual([
      ['B-2026-1', 'Appelé', null, null],
      ['FT-2026-1', 'Annulé', 't-annul-ft', 'Cotisation votée à tort pour 2026'],
    ])
  })

  it('budget au 450-1 si l’AG l’a créé : la contre-passation crédite le même sous-compte que l’appel', () => {
    const sousComptes450 = { decision: 'AG du 12/05/2025, résolution 9 (fictive)', planBudget: '45010' }
    const avis = avisDAppel({ echeances: suivreEcheances([B1, FT1]), cles: [cleGenerale], positions: positionsCopro, comptes: comptesCopro })
    const appel = traitementAppelDeFonds(avis, { id: 't-appel-1', date: '2026-01-01', segmentSyndicat: SEGMENT, comptes: comptesCopro, sousComptes450 })
    const echeances = marquerAppelees(suivreEcheances([B1, FT1]), appel, avis, { exercices: EXERCICES })
    const { traitement } = annulerEcheanceAppelee(echeances, { ...contexte().options, echeanceId: 'B-2026-1', appel, avis, sousComptes450 })
    expect(traitement?.mouvements.map((m) => [m.compte, m.sens, m.montantCentimes])).toEqual([
      ['TILL.70100.00000.0', 'debit', 100_000],
      ['TILL.45010.00001.0', 'credit', 40_000],
      ['TILL.45010.00002.0', 'credit', 60_000],
    ])
  })

  it('refuse une échéance réglée, même en partie, ou en contentieux ; un motif vide ; une date antérieure à l’appel', () => {
    const { echeances, options } = contexte()
    const regle = options.postes.map((p) => (p.id === 'FT-2026-1:lot-2' ? { ...p, regleCentimes: 1 } : p))
    expect(() => annulerEcheanceAppelee(echeances, { ...options, postes: regle })).toThrow(/FT-2026-1:lot-2.*réglé.*même en partie/)
    const ctx = options.postes.map((p) => (p.id === 'FT-2026-1:lot-1' ? { ...p, contentieux: true } : p))
    expect(() => annulerEcheanceAppelee(echeances, { ...options, postes: ctx })).toThrow(/FT-2026-1:lot-1.*contentieux/)
    expect(() => annulerEcheanceAppelee(echeances, { ...options, annulation: { ...options.annulation, motif: '  ' } })).toThrow(/motif/)
    expect(() => annulerEcheanceAppelee(echeances, { ...options, annulation: { ...options.annulation, date: '2025-12-31' } })).toThrow(/antérieure/)
    expect(() => annulerEcheanceAppelee(echeances, { ...options, postes: [] })).toThrow(/postes de l'échéance/)
  })

  it('refuse une échéance non appelée, déjà annulée, ou un avis qui n’est pas celui de l’appel', () => {
    const { echeances, options } = contexte()
    const { echeances: apres } = annulerEcheanceAppelee(echeances, options)
    expect(() => annulerEcheanceAppelee(apres, options)).toThrow(/déjà annulée/)
    expect(() => annulerEcheanceAppelee(suivreEcheances([B1, FT1]), options)).toThrow(/Prévu/)
    const autreAvis = avisDAppel({ echeances: suivreEcheances([B1]), cles: [cleGenerale], positions: positionsCopro, comptes: comptesCopro })
    expect(() => annulerEcheanceAppelee(echeances, { ...options, avis: autreAvis })).toThrow(/avis/)
  })

  it('les autres échéances gardent leur appel ; l’écriture contraire de tout l’appel est ensuite refusée', () => {
    const { echeances, options } = contexte()
    const { echeances: apres } = annulerEcheanceAppelee(echeances, options)
    const toutLAppel = annulerTraitement(options.appel, { id: 't-annul-tout', date: '2026-02-11' })
    expect(() => annulerAppelees(apres, toutLAppel, options.postes)).toThrow(/annulée seule.*une à une/)
    expect(postesImputables(options.postes, apres).map((p) => p.id)).toEqual(['B-2026-1:lot-1', 'B-2026-1:lot-2'])
  })

  it('une échéance à 0 € s’annule seule sans écriture : elle n’a aucune ligne', () => {
    const { avis, appel, postes, echeances } = appelerTout(suivreEcheances([B1, T0]))
    const { traitement, echeances: apres } = annulerEcheanceAppelee(echeances, { ...contexte().options, echeanceId: '00043-T2', appel, avis, postes })
    expect(traitement).toBeNull()
    expect(apres.find((e) => e.id === '00043-T2')).toMatchObject({ statut: 'Annulé', annulationTraitementId: null })
  })
})

describe('F105 — appel réglé en partie : l’annulation reste refusée aujourd’hui', () => {
  it('le refus le dit, et renvoie à la désimputation à venir', () => {
    const { appel, postes, echeances } = appelerTout(suivreEcheances([B1, FT1]))
    const annulation = annulerTraitement(appel, { id: 't-annul-1', date: '2026-01-15' })
    const regle = postes.map((p) => (p.id === 'B-2026-1:lot-1' ? { ...p, regleCentimes: 10_000 } : p))
    expect(() => annulerAppelees(echeances, annulation, regle)).toThrow(/B-2026-1:lot-1.*réglé.*refusée.*F105/)
  })
})

describe('F106 — contentieux : exclu de la relance ordinaire par défaut, inclusion à la main avec un motif', () => {
  const scenario = () => {
    const { postes, echeances } = appelerTout(suivreEcheances([B1, FT1]))
    return { echeances, postes: postes.map((p) => (p.id === 'B-2026-1:lot-1' ? { ...p, contentieux: true } : p)) }
  }

  it('par défaut, le poste en contentieux est écarté ; les autres postes du même copropriétaire restent relancés', () => {
    const { postes, echeances } = scenario()
    const relance = postesARelancer(postes, echeances, { le: '2026-02-01' })
    expect(relance.ecartes).toEqual([{ posteId: 'B-2026-1:lot-1', motif: 'contentieux' }])
    expect(relance.relancables.map((p) => p.id)).toEqual(['FT-2026-1:lot-1', 'B-2026-1:lot-2', 'FT-2026-1:lot-2'])
    expect(relance.inclusContentieux).toBeUndefined()
  })

  it('inclusion à la main : le poste est relancé, son motif est gardé', () => {
    const { postes, echeances } = scenario()
    const relance = postesARelancer(postes, echeances, {
      le: '2026-02-01',
      inclusionsContentieux: [{ posteId: 'B-2026-1:lot-1', motif: '  Accord du copropriétaire pour une relance amiable ' }],
    })
    expect(relance.ecartes).toEqual([])
    expect(relance.relancables.map((p) => p.id)).toContain('B-2026-1:lot-1')
    expect(relance.inclusContentieux).toEqual([{ posteId: 'B-2026-1:lot-1', motif: 'Accord du copropriétaire pour une relance amiable' }])
  })

  it('refuse une inclusion sans motif, d’un poste inconnu ou hors contentieux, ou en double', () => {
    const { postes, echeances } = scenario()
    const relancer = (inclusionsContentieux: { posteId: string; motif: string }[]) => () =>
      postesARelancer(postes, echeances, { le: '2026-02-01', inclusionsContentieux })
    expect(relancer([{ posteId: 'B-2026-1:lot-1', motif: ' ' }])).toThrow(/motif/)
    expect(relancer([{ posteId: 'X', motif: 'm' }])).toThrow(/inconnu/)
    expect(relancer([{ posteId: 'B-2026-1:lot-2', motif: 'm' }])).toThrow(/pas en contentieux/)
    expect(relancer([{ posteId: 'B-2026-1:lot-1', motif: 'm' }, { posteId: 'B-2026-1:lot-1', motif: 'n' }])).toThrow(/double/)
  })
})

describe('F107 — aucune échéance négative ; à la reprise, « REGUL CH. » et « SOLDE AU » deviennent un solde repris du compte', () => {
  it('une ligne négative de régularisation devient un solde repris du compte, avec son exercice', () => {
    expect(repriseLigneNegativeGesteam({ compteId: 'cpt-A', exercice: '2025', date: '2026-03-15', libelle: ' REGUL CH. 2025 ', montantCentimes: -12_345 })).toEqual({
      type: 'solde_repris',
      compteId: 'cpt-A',
      exercice: '2025',
      date: '2026-03-15',
      libelle: 'REGUL CH. 2025',
      montantCentimes: -12_345,
      motif: expect.stringMatching(/jamais une échéance négative.*F107/),
    })
    expect(repriseLigneNegativeGesteam({ compteId: 'cpt-B', exercice: '2025', date: '2025-12-31', libelle: 'Solde au 31/12/2025', montantCentimes: -500 }).type).toBe('solde_repris')
  })

  it('refuse une ligne positive (une échéance), un autre libellé négatif, un compte ou un exercice manquants', () => {
    const ligne = { compteId: 'cpt-A', exercice: '2025', date: '2026-03-15', libelle: 'REGUL CH. 2025', montantCentimes: -100 }
    expect(() => repriseLigneNegativeGesteam({ ...ligne, montantCentimes: 100 })).toThrow(/négative/)
    expect(() => repriseLigneNegativeGesteam({ ...ligne, libelle: 'APPEL DE FONDS' })).toThrow(/REGUL CH\..*SOLDE AU/)
    expect(() => repriseLigneNegativeGesteam({ ...ligne, compteId: ' ' })).toThrow(/compte/)
    expect(() => repriseLigneNegativeGesteam({ ...ligne, exercice: '' })).toThrow(/exercice/)
    expect(() => suivreEcheances([{ ...B1, montantCentimes: -100 }])).toThrow(/repriseLigneNegativeGesteam/)
  })
})

describe('F108 — échéance à 0 € appelée seule : « Appelé » sans écriture, si l’emploi du fonds est autorisé', () => {
  it('echeancesAAppeler la retient seule si l’emploi du fonds qui la finance est autorisé', () => {
    const [t0] = suivreEcheances([T0])
    expect(echeancesAAppeler([t0], { jusquAu: '2026-01-31' })).toEqual([])
    expect(echeancesAAppeler([t0], { jusquAu: '2026-01-31', emploisFondsAutorises: new Set(['00043-T2']) })).toEqual([t0])
  })

  it('passe « Appelé » sans traitement, avec la trace « échéance à 0 €, financée par le fonds de travaux »', () => {
    const [t0, b1] = suivreEcheances([T0, B1])
    const apres = marquerAppeleeSansEcriture([t0, b1], { ids: ['00043-T2'], le: '2026-01-02', emploisFondsAutorises: new Set(['00043-T2']) })
    expect(apres[0]).toMatchObject({
      statut: 'Appelé',
      traitementId: null,
      echeancesDeLAppel: ['00043-T2'],
      appelSansEcriture: { le: '2026-01-02', trace: TRACE_APPEL_SANS_ECRITURE },
    })
    expect(TRACE_APPEL_SANS_ECRITURE).toBe('échéance à 0 €, financée par le fonds de travaux')
    expect(apres[1]).toBe(b1)
  })

  it('refuse une échéance dont le total n’est pas exactement 0, un emploi non autorisé, une échéance pas « Prévu »', () => {
    const [t0, b1] = suivreEcheances([T0, B1])
    const autorises = new Set(['00043-T2', 'B-2026-1'])
    expect(() => marquerAppeleeSansEcriture([t0, b1], { ids: ['B-2026-1'], le: '2026-01-02', emploisFondsAutorises: autorises })).toThrow(/exactement 0/)
    expect(() => marquerAppeleeSansEcriture([t0], { ids: ['00043-T2'], le: '2026-01-02', emploisFondsAutorises: new Set() })).toThrow(/autorisé/)
    const attente = mettreEnAttente(t0, 'Décision attendue')
    expect(() => marquerAppeleeSansEcriture([attente], { ids: ['00043-T2'], le: '2026-01-02', emploisFondsAutorises: autorises })).toThrow(/Appelé/)
  })
})

describe('F104 à F108 — en-tête de l’échéancier : les décisions remplacent les marques 🔴', () => {
  it('chaque décision est citée ; ses questions ne sont plus en 🔴', () => {
    const { texte, item } = enTeteDuModule('echeancier-appels')
    const ouvert = texte.slice(texte.indexOf('🔴 Non établi'))
    for (const question of [/annuler une seule échéance/, /crédit "à imputer"/, /Un poste en contentieux reste-t-il/, /"REGUL CH\.", "SOLDE AU"/, /0 centime appelée seule/])
      expect(ouvert).not.toMatch(question)
    expect(item('- Décision du 20/11/2026 (partie C, F104)')).toMatch(/écriture contraire.*450.*motif.*arrêté du 14\/03\/2005, art\. 5/)
    expect(item('- Décision du 20/11/2026 (partie C, F105)')).toMatch(/refus.*désimputation/)
    expect(item('- Décision du 20/11/2026 (partie C, F106)')).toMatch(/exclu par défaut.*motif/)
    expect(item('- Décision du 20/11/2026 (partie C, F107)')).toMatch(/solde repris.*exercice/)
    expect(item('- Décision du 20/11/2026 (partie C, F108)')).toMatch(/« Appelé » sans écriture.*autorisé/)
  })
})

// ─── F110 à F112 : encaissements ─────────────────────────────────────────────────────────────

const JOURNAL_COURANT: JournalEncaissement = { code: 'BA', banqueId: 'b-courant', compteEncaissement: 'TILL.51200.00000.0' }
const JOUR_ENC = '2026-01-12'
const posteEnc = (id: string, compteId: string, montantCentimes: number, typeAppel: 'Budget' | 'Fonds travaux' = 'Budget'): PosteDette => ({
  id,
  compteId,
  appelId: id.split(':')[0],
  typeAppel,
  libelle: typeAppel === 'Budget' ? 'Appel de provisions' : 'Cotisation au fonds de travaux',
  exigibilite: '2026-01-01',
  montantCentimes,
  regleCentimes: 0,
  contentieux: false,
})
const POSTES_ENC = [
  posteEnc('B1:lot-1', 'cpt-A', 40_000),
  posteEnc('FT1:lot-1', 'cpt-A', 2_000, 'Fonds travaux'),
  posteEnc('B1:lot-2', 'cpt-B', 60_000),
  posteEnc('FT1:lot-2', 'cpt-B', 3_000, 'Fonds travaux'),
]
interface OptionsRecu {
  mode?: 'Virement' | 'Chèque'
  numero?: string
  date?: string
  journal?: JournalEncaissement
}
const recu = (id: string, compteId: string, montantCentimes: number, { mode = 'Virement', numero = `VIR-${id}`, date = JOUR_ENC, journal = JOURNAL_COURANT }: OptionsRecu = {}): EncaissementEnregistre =>
  enregistrerEncaissement({ id, compteId, date, montantCentimes }, { journal, segmentSyndicat: SEGMENT, piece: { mode, numero } })

/** Écrit des encaissements imputés en un traitement (par défaut un fichier de virements reçus). */
function ecrireEncaissements(
  encaissements: EncaissementEnregistre[],
  { famille = 'Fichier Virement reçus', remises = [] }: { famille?: 'Fichier Virement reçus' | 'Encaissement'; remises?: ReturnType<typeof creerRemiseCheques>[] } = {},
) {
  const { resultats, postes } = imputerEncaissements(encaissements, POSTES_ENC)
  const ecrit = traitementEncaissements(
    { encaissements: encaissements.map((encaissement, i) => ({ encaissement, resultat: resultats[i] })), remises },
    { id: 't-enc-1', date: JOUR_ENC, famille, segmentSyndicat: SEGMENT, comptes: comptesCopro },
  )
  return { ...ecrit, resultats, postes }
}

const REJET = { id: 't-ann-1', date: '2026-01-20', motif: 'Virement retourné : compte clos', piece: 'AVIS-BQ-0001' }

describe('F110 — chèque impayé ou virement retourné : l’encaissement passe « Annulé » par une écriture contraire, son imputation est défaite', () => {
  const lot = () => ecrireEncaissements([recu('E1', 'cpt-A', 42_000), recu('E2', 'cpt-B', 63_000)])
  const contexteDe = (l: ReturnType<typeof lot>, rang = 0) => ({
    ecriture: l.traitement,
    resultat: l.resultats[rang],
    postes: l.postes,
    comptes: comptesCopro,
    segmentSyndicat: SEGMENT,
  })
  const annuler = (l: ReturnType<typeof lot>, surcharge: Partial<typeof REJET> = {}, rang = 0) =>
    annulerEncaissement(l.encaissements[rang], contexteDe(l, rang), { ...REJET, ...surcharge })

  it('un encaissement d’un fichier de virements s’annule seul : ses seules lignes contre-passées (débit du 450, crédit du 512), « Annulation d’encaissement », au jour du débit, avec motif et pièce', () => {
    const { traitement, encaissement } = annuler(lot())
    expect(traitement).toMatchObject({ id: 't-ann-1', famille: "Annulation d'encaissement", date: '2026-01-20', annule: 't-enc-1' })
    expect(traitement.mouvements.map((m) => [m.sens, m.compte, m.montantCentimes, m.origine?.type === 'appel' ? m.origine.appelId : null])).toEqual([
      ['credit', 'TILL.51200.00000.0', 42_000, null],
      ['debit', 'TILL.45000.00001.0', 40_000, 'B1'],
      ['debit', 'TILL.45000.00001.0', 2_000, 'FT1'],
    ])
    expect(encaissement).toMatchObject({ id: 'E1', statut: 'Annulé', impute: true, traitementId: 't-enc-1' })
    expect(encaissement.annulation).toEqual({
      le: '2026-01-20',
      motif: 'Virement retourné : compte clos',
      piece: 'AVIS-BQ-0001',
      traitementId: 't-ann-1',
      dateComptable: '2026-01-20',
      mention: 'pièce « AVIS-BQ-0001 » du 20/01/2026',
    })
  })

  it('frais bancaires du rejet : jamais dans l’écriture contraire, qui porte le seul montant de l’encaissement', () => {
    const { traitement } = annuler(lot())
    const debits = traitement.mouvements.filter((m) => m.sens === 'debit').reduce((s, m) => s + m.montantCentimes, 0)
    expect(debits).toBe(42_000)
    expect(traitement.mouvements.every((m) => /\.(45000|51200)\./.test(m.compte))).toBe(true)
  })

  it('l’imputation est défaite : les postes payés redeviennent dus, à leur exigibilité d’origine ; ceux de l’autre encaissement ne bougent pas', () => {
    const l = lot()
    expect(l.postes.map((p) => [p.id, p.regleCentimes])).toEqual([
      ['B1:lot-1', 40_000],
      ['FT1:lot-1', 2_000],
      ['B1:lot-2', 60_000],
      ['FT1:lot-2', 3_000],
    ])
    const { postes } = annuler(l)
    expect(postes.map((p) => [p.id, p.regleCentimes, p.exigibilite])).toEqual([
      ['B1:lot-1', 0, '2026-01-01'],
      ['FT1:lot-1', 0, '2026-01-01'],
      ['B1:lot-2', 60_000, '2026-01-01'],
      ['FT1:lot-2', 3_000, '2026-01-01'],
    ])
    expect(desimputerEncaissement(l.resultats[0], l.postes)).toEqual(postes)
  })

  it('un chèque d’une remise s’annule seul : la remise et l’autre chèque restent écrits', () => {
    const remise = creerRemiseCheques({
      id: 'rem-1',
      numero: 'REM-1',
      date: JOUR_ENC,
      coproprieteId: 'copro-1',
      banqueId: 'b-courant',
      traitementId: 't-enc-1',
      lignes: [
        { encaissementId: 'C1', numeroCheque: '0000001', montantCentimes: 42_000, tireur: 'Tireur fictif' },
        { encaissementId: 'C2', numeroCheque: '0000002', montantCentimes: 63_000, tireur: 'Tireur fictif' },
      ],
    })
    const cheques = rattacherRemise(
      [
        recu('C1', 'cpt-A', 42_000, { mode: 'Chèque', numero: '0000001', date: '2026-01-10' }),
        recu('C2', 'cpt-B', 63_000, { mode: 'Chèque', numero: '0000002', date: '2026-01-10' }),
      ],
      remise,
    )
    const l = ecrireEncaissements(cheques, { famille: 'Encaissement', remises: [remise] })
    const { traitement, encaissement, postes } = annuler(l, { motif: 'Chèque impayé : provision insuffisante' }, 1)
    expect(traitement.mouvements.map((m) => [m.sens, m.montantCentimes])).toEqual([
      ['credit', 63_000],
      ['debit', 60_000],
      ['debit', 3_000],
    ])
    expect(encaissement).toMatchObject({ id: 'C2', statut: 'Annulé', piece: { remiseId: 'rem-1' } })
    expect(postes.filter((p) => p.compteId === 'cpt-A').map((p) => p.regleCentimes)).toEqual([40_000, 2_000])
  })

  it('période close : écriture au premier jour ouvert, date d’origine et pièce au libellé (J67, R123)', () => {
    const l = lot()
    const verrou = [borneArreteDesComptes({ nom: 'Exercice fictif', cloture: '2026-01-31' })]
    const { traitement, encaissement } = annulerEncaissement(l.encaissements[0], { ...contexteDe(l), verrou }, REJET)
    expect(traitement.date).toBe('2026-02-01')
    expect(encaissement.annulation).toMatchObject({ le: '2026-01-20', dateComptable: '2026-02-01', mention: 'pièce « AVIS-BQ-0001 » du 20/01/2026' })
  })

  it('refus : déjà annulé, pas encore écrit, sans motif ni pièce, débit antérieur à l’encaissement, écriture ou résultat d’un autre encaissement', () => {
    const l = lot()
    const { encaissement } = annuler(l)
    const contexte = contexteDe(l)
    expect(() => annulerEncaissement(encaissement, contexte, { ...REJET, id: 't-ann-2' })).toThrow(/déjà annulé le 2026-01-20/)
    expect(() => annulerEncaissement(recu('E1', 'cpt-A', 42_000), contexte, REJET)).toThrow(/écrire d'abord/)
    expect(() => annuler(l, { motif: ' ' })).toThrow(/motif/)
    expect(() => annuler(l, { piece: '' })).toThrow(/pièce/)
    expect(() => annuler(l, { date: '2026-01-11' })).toThrow(/antérieur/)
    expect(() => annuler(l, { date: '20/01/2026' })).toThrow(/AAAA-MM-JJ/)
    expect(() => annuler(l, { id: 't-enc-1' })).toThrow(/propre identifiant/)
    expect(() => annulerEncaissement(l.encaissements[0], { ...contexte, resultat: l.resultats[1] }, REJET)).toThrow(/ne correspond pas/)
    const autreEcriture = creerTraitement({
      id: 't-enc-1',
      famille: 'Encaissement',
      date: JOUR_ENC,
      mouvements: [ligne('TILL.51200.00000.0', 'debit', 1), ligne('TILL.45000.00001.0', 'credit', 1)],
    })
    expect(() => annulerEncaissement(l.encaissements[0], { ...contexte, ecriture: autreEcriture }, REJET)).toThrow(/introuvable/)
    expect(() => annulerEncaissement(l.encaissements[0], { ...contexte, postes: POSTES_ENC }, REJET)).toThrow(/réglé/)
  })

  it('un encaissement annulé ne se réécrit pas ; au rapprochement, il reste « Annulé » (à une date antérieure à l’annulation : le statut propagé)', () => {
    const l = lot()
    const { encaissement } = annuler(l)
    expect(() =>
      traitementEncaissements(
        { encaissements: [{ encaissement, resultat: l.resultats[0] }] },
        { id: 't-enc-2', date: JOUR_ENC, segmentSyndicat: SEGMENT, comptes: comptesCopro },
      ),
    ).toThrow(/déjà écrit/)
    const arrete: ArreteRapprochement = {
      id: 'a-1',
      banqueId: 'b-courant',
      dateArrete: '2026-01-31',
      soldeBanqueCentimes: 0,
      soldeComptaCentimes: 0,
      statut: 'En cours',
      elements: [
        { id: 'rel-1', cote: 'banque', montantCentimes: 42_000, rapproche: 'manuel', date: JOUR_ENC, rapprocheLe: '2026-01-15', pieces: [{ type: 'encaissement', id: 'E1' }] },
      ],
    }
    const { entrees, anomalies } = rapprocherEncaissements([encaissement], [arrete])
    expect(anomalies).toEqual([])
    expect(entrees[0]).toMatchObject({ statut: 'Annulé', rapprochement: { elementId: 'rel-1' } })
    expect(rapprocherEncaissements([encaissement], [arrete], { aLaDate: '2026-01-16' }).entrees[0].statut).toBe('Rapproché')
    expect(rapprocherEncaissements([encaissement], []).entrees[0].statut).toBe('Annulé')
  })
})

describe('F111 — date de l’encaissement : celle de l’opération (de la remise pour un chèque) ; la date de valeur, gardée, ne sert qu’au rapprochement', () => {
  const avecValeur = (id: string, montantCentimes: number, dateValeur: string) =>
    enregistrerEncaissement(
      { id, compteId: 'cpt-A', date: JOUR_ENC, montantCentimes },
      { journal: JOURNAL_COURANT, segmentSyndicat: SEGMENT, piece: { mode: 'Virement' }, dateValeur },
    )

  it('la date de valeur est gardée quand le relevé la donne, contrôlée ; absente, rien n’est ajouté', () => {
    const e = avecValeur('E1', 42_000, '2026-01-13')
    expect(e.dateValeur).toBe('2026-01-13')
    expect(e.date).toBe(JOUR_ENC)
    expect(recu('E2', 'cpt-A', 1_000)).not.toHaveProperty('dateValeur')
    expect(() => avecValeur('E3', 1_000, '13/01/2026')).toThrow(/date de valeur/i)
    const recette = enregistrerRecette(
      {
        id: 'R1',
        date: JOUR_ENC,
        dateValeur: '2026-01-14',
        montantCentimes: 10_000,
        planCode: '71300',
        libelle: 'Indemnité fictive',
        piece: { mode: 'Virement' },
        journal: JOURNAL_COURANT,
      },
      { segmentSyndicat: SEGMENT },
    )
    expect(recette.dateValeur).toBe('2026-01-14')
  })

  it('jamais pour l’imputation ni pour le jour du traitement : seule la date de l’opération compte', () => {
    const e = avecValeur('E1', 5_000, '2026-01-13')
    const aVenir = { ...posteEnc('B2:lot-1', 'cpt-A', 5_000), exigibilite: '2026-01-13' }
    expect(imputerEncaissement(e, [aVenir]).resteAImputerCentimes).toBe(5_000)
    const resultat = imputerEncaissement(e, POSTES_ENC)
    const options = { id: 't-enc-1', segmentSyndicat: SEGMENT, comptes: comptesCopro }
    expect(traitementEncaissements({ encaissements: [{ encaissement: e, resultat }] }, { ...options, date: JOUR_ENC }).traitement.date).toBe(JOUR_ENC)
    expect(() => traitementEncaissements({ encaissements: [{ encaissement: e, resultat }] }, { ...options, date: '2026-01-13' })).toThrow(/jour par jour/)
  })
})

const COMPTE_COURANT: CompteVirementInterne = {
  banqueId: 'b-courant',
  coproprieteId: 'copro-1',
  nature: 'courant',
  iban: 'FR76 3000 6000 0112 3456 7890 189',
  bic: 'AGRIFRPP',
  compte512: 'TILL.51200.00000.0',
  actif: true,
}
const COMPTE_FONDS: CompteVirementInterne = {
  ...COMPTE_COURANT,
  banqueId: 'b-fonds',
  nature: 'fonds_travaux',
  iban: 'FR14 2004 1010 0505 0001 3M02 606',
  bic: 'PSSTFRPP',
  compte512: 'TILL.51210.00000.0',
}
const COMPTE_AVANCE: CompteVirementInterne = { ...COMPTE_COURANT, banqueId: 'b-avance', nature: 'avance_travaux', iban: 'FR37 1027 8060 0000 0204 2010 154', compte512: 'TILL.51230.00000.0' }

/** Virement interne vers le compte du fonds (du compte courant par défaut), émis le jour donné (null : non émis). */
function versLeFonds(id: string, montantCentimes: number, emisLe: string | null, source = COMPTE_COURANT): VirementInterne {
  const v = creerVirementInterne(
    {
      id,
      numero: `BAB-${id}`,
      date: emisLe ?? '2026-01-15',
      coproprieteId: 'copro-1',
      mandatId: 'm-1',
      traitementId: `t-${id}`,
      rang: 1,
      nombreOrdresDuLot: 1,
      source,
      destination: COMPTE_FONDS,
      montantCentimes,
      libelle: 'Cotisations au fonds de travaux',
    },
    { segmentSyndicat: SEGMENT },
  )
  return emisLe === null ? v : emettreLotVirementsInternes([v], { dateEmission: emisLe, journal: [], virementsConnus: [] })[0]
}

describe('F112 — part du fonds de travaux reçue hors du compte du fonds : signalée, jamais bloquée, « à virer » jusqu’au virement interne', () => {
  const lot = () => ecrireEncaissements([recu('E1', 'cpt-A', 42_000), recu('E2', 'cpt-B', 63_000)])
  const entrees = (l: ReturnType<typeof lot>) => l.encaissements.map((encaissement, i) => ({ encaissement, resultat: l.resultats[i] }))
  const comptesBancaires = [COMPTE_COURANT, COMPTE_FONDS, COMPTE_AVANCE]

  it('l’encaissement s’écrit (pas de blocage) ; la part imputée sur des postes du fonds est signalée, à virer sans délai', () => {
    const parts = partsFondsTravauxAVirer(entrees(lot()), { comptesBancaires, virements: [], aLaDate: '2026-01-12', delaiAlerteJours: 10 })
    expect(SIGNAL_FONDS_TRAVAUX_HORS_COMPTE_DU_FONDS).toBe('part fonds de travaux reçue sur le compte courant : à virer sans délai au compte du fonds')
    expect(parts).toEqual([
      expect.objectContaining({
        encaissementId: 'E1',
        compteId: 'cpt-A',
        banqueId: 'b-courant',
        date: JOUR_ENC,
        partFondsCentimes: 2_000,
        vireCentimes: 0,
        resteAVirerCentimes: 2_000,
        aVirerAuPlusTardLe: '2026-01-22',
        alerte: false,
      }),
      expect.objectContaining({ encaissementId: 'E2', compteId: 'cpt-B', partFondsCentimes: 3_000, resteAVirerCentimes: 3_000 }),
    ])
    expect(parts[0].message).toContain(SIGNAL_FONDS_TRAVAUX_HORS_COMPTE_DU_FONDS)
    expect(parts[0].fondement).toBe('L. 1965 art. 18, II, al. 4')
  })

  it('soldée par les virements internes émis du compte qui l’a reçue vers le compte du fonds, la plus ancienne d’abord', () => {
    const l = lot()
    const parts = partsFondsTravauxAVirer(entrees(l), { comptesBancaires, virements: [versLeFonds('v1', 4_000, '2026-01-15')], aLaDate: '2026-01-16', delaiAlerteJours: 10 })
    expect(parts.map((p) => [p.encaissementId, p.vireCentimes, p.resteAVirerCentimes])).toEqual([
      ['E1', 2_000, 0],
      ['E2', 2_000, 1_000],
    ])
    const toutVire = partsFondsTravauxAVirer(entrees(l), {
      comptesBancaires,
      virements: [versLeFonds('v1', 4_000, '2026-01-15'), versLeFonds('v2', 5_000, '2026-01-16')],
      aLaDate: '2026-01-30',
      delaiAlerteJours: 10,
    })
    expect(toutVire.map((p) => [p.resteAVirerCentimes, p.alerte])).toEqual([
      [0, false],
      [0, false],
    ])
  })

  it('ne soldent rien : un virement non émis, rejeté, antérieur à l’encaissement ou parti d’un autre compte', () => {
    const emis = versLeFonds('v1', 5_000, '2026-01-15')
    const rejete: VirementInterne = { ...emis, rejet: { le: '2026-01-17', motif: 'Rejet fictif', traitementId: 't-rej' } }
    const virements = [versLeFonds('v0', 5_000, null), rejete, versLeFonds('v2', 5_000, '2026-01-11'), versLeFonds('v3', 5_000, '2026-01-15', COMPTE_AVANCE)]
    expect(alimentationsDuFonds(virements).map((v) => v.id)).toEqual(['v2', 'v3'])
    const parts = partsFondsTravauxAVirer(entrees(lot()), { comptesBancaires, virements, aLaDate: '2026-01-20', delaiAlerteJours: 10 })
    expect(parts.map((p) => p.resteAVirerCentimes)).toEqual([2_000, 3_000])
  })

  it('alerte passé le délai réglé par le cabinet ; sans délai réglé, aucune alerte ni date limite', () => {
    const l = lot()
    const a = (aLaDate: string, delaiAlerteJours: number | null) => partsFondsTravauxAVirer(entrees(l), { comptesBancaires, virements: [], aLaDate, delaiAlerteJours })[0]
    expect(a('2026-01-22', 10)).toMatchObject({ alerte: false })
    expect(a('2026-01-23', 10)).toMatchObject({ alerte: true, aVirerAuPlusTardLe: '2026-01-22' })
    expect(a('2026-01-23', 10).message).toMatch(/délai du cabinet.*22\/01\/2026/)
    expect(a('2026-03-01', null)).toMatchObject({ alerte: false, aVirerAuPlusTardLe: null })
    expect(() => a('2026-01-23', -1)).toThrow(/délai/i)
    expect(() => a('2026-01-23', 1.5)).toThrow(/délai/i)
    expect(() => a('23/01/2026', 10)).toThrow(/AAAA-MM-JJ/)
  })

  it('rien à signaler : encaissement reçu sur le compte du fonds, part du fonds nulle, encaissement annulé ; compte bancaire inconnu refusé', () => {
    const journalFonds: JournalEncaissement = { code: 'FT', banqueId: 'b-fonds', compteEncaissement: 'TILL.51210.00000.0' }
    const surLeFonds = ecrireEncaissements([recu('E1', 'cpt-A', 42_000, { journal: journalFonds })])
    expect(partsFondsTravauxAVirer(entrees(surLeFonds), { comptesBancaires, virements: [], aLaDate: '2026-01-12', delaiAlerteJours: 10 })).toEqual([])
    const budgetDesigne = enregistrerEncaissement(
      { id: 'E1', compteId: 'cpt-A', date: JOUR_ENC, montantCentimes: 40_000, postesDesignes: ['B1:lot-1'] },
      { journal: JOURNAL_COURANT, segmentSyndicat: SEGMENT, piece: { mode: 'Virement' } },
    )
    const sansFonds = ecrireEncaissements([budgetDesigne])
    expect(partsFondsTravauxAVirer(entrees(sansFonds), { comptesBancaires, virements: [], aLaDate: '2026-01-12', delaiAlerteJours: 10 })).toEqual([])
    const l = lot()
    const contexte = { ecriture: l.traitement, resultat: l.resultats[0], postes: l.postes, comptes: comptesCopro, segmentSyndicat: SEGMENT }
    const annule = annulerEncaissement(l.encaissements[0], contexte, REJET).encaissement
    const avecAnnule = [{ encaissement: annule, resultat: l.resultats[0] }, entrees(l)[1]]
    expect(partsFondsTravauxAVirer(avecAnnule, { comptesBancaires, virements: [], aLaDate: '2026-01-21', delaiAlerteJours: 10 }).map((p) => p.encaissementId)).toEqual(['E2'])
    expect(() => partsFondsTravauxAVirer(entrees(l), { comptesBancaires: [COMPTE_FONDS], virements: [], aLaDate: '2026-01-12', delaiAlerteJours: 10 })).toThrow(
      /b-courant.*inconnu/,
    )
  })
})

describe('F110 à F112 — en-têtes : les décisions remplacent les marques 🔴', () => {
  it('encaissements-pieces : décisions F110, F111, F112 citées ; leurs questions ne sont plus en 🔴', () => {
    const { texte, item } = enTeteDuModule('encaissements-pieces')
    const ouvert = texte.slice(texte.indexOf('🔴 Non établi'))
    for (const question of [/Chèque impayé ou virement reçu retourné/, /Date de prise en compte d'un encaissement/, /contrôle laissé au point 39/]) expect(ouvert).not.toMatch(question)
    expect(ouvert).toMatch(/Fichier carte bancaire/)
    expect(item('- Décision du 20/11/2026 (partie C, F110)')).toMatch(
      /« Annulé ».*écriture contraire.*450.*512.*débit.*motif et pièce.*défaite.*exigibilité d'origine.*seul.*frais bancaires/,
    )
    expect(item('- Décision du 20/11/2026 (partie C, F111)')).toMatch(/date de l'opération.*remise.*date de valeur.*rapprochement.*jamais pour l'imputation/)
    expect(item('- Décision du 20/11/2026 (partie C, F112)')).toMatch(/ne bloque pas.*à virer sans délai au compte du fonds.*virement interne.*délai réglé par le cabinet/)
  })

  it('virement-interne : la décision F112 est citée (alimentationsDuFonds)', () => {
    const { item } = enTeteDuModule('virement-interne')
    expect(item('- Décision du 20/11/2026 (partie C, F112)')).toMatch(/alimentationsDuFonds.*à virer/)
  })
})

// ─── F114, F116, F118 : avis d'appel ─────────────────────────────────────────────────────────

/** Échéance du budget exigible après l'entrée en vigueur de la voie électronique (D. 1967 art. 35-2, 25/12/2025). */
const B_AVIS: EcheanceAppel = { ...B1, id: 'B-2027-1', exigibilite: '2027-01-01', libelle: 'Budget 2027 — provision 1/4' }
const IBAN_SYNDICAT_AVIS = 'FR14 2004 1010 0505 0001 3M02 606'
const ICS_AVIS = 'FR12ZZZ123456'
const mandatAvis: MandatPrelevement = {
  rum: 'RUM-TILL-00001',
  dateSignature: '2024-03-01',
  debiteur: 'Copropriétaire A',
  debiteurIdentiteId: 'i-p1',
  iban: 'FR76 3000 6000 0112 3456 7890 189',
  bic: 'AGRIFRPP',
  dernierPrelevementLe: '2026-10-05',
  natures: { budget: true, autres: false },
  maxiCentimes: null,
}
const avisBudget = () => avisDAppel({ echeances: [B_AVIS], cles: [cleGenerale], positions: positionsCopro, comptes: comptesCopro })
const optionsAvis = (surcharge: Partial<OptionsContenuAvis> = {}): OptionsContenuAvis => ({
  cles: [cleGenerale],
  comptes: comptesCopro,
  segmentSyndicat: SEGMENT,
  syndicat: { nom: 'SDC fictif', adresse: '1 rue Fictive, 13001 Marseille' },
  ibanSyndicat: IBAN_SYNDICAT_AVIS,
  ics: ICS_AVIS,
  dateEmission: '2026-12-15',
  reglements: [
    { compteId: 'cpt-A', mode: 'Prélèvement', mandat: mandatAvis },
    { compteId: 'cpt-B', mode: 'Virement' },
  ],
  datePrelevement: '2027-01-05',
  ...surcharge,
})
const adresseFictive = (id: string) =>
  creerAdresseDatee({ id, lignes: ['1 rue Fictive'], codePostal: '13001', ville: 'Marseille', pays: 'France', usage: null, du: '2020-01-01', au: null, communiqueeLe: null })
const diffusionAvis = (surcharge: Partial<OptionsDiffusionAvis> = {}): OptionsDiffusionAvis => ({
  date: '2026-12-15',
  coproprieteId: 'copro-1',
  mandatId: 'm-1',
  socle: {
    'copropriete.nom': 'SDC fictif',
    'copropriete.adresse': '1 rue Fictive, 13001 Marseille',
    'mandat.fondement': 'L. 1965 art. 29-1',
    'mandat.tribunal': 'TJ fictif',
    'mandat.ordonnance': '2025-03-02',
    'mandat.rg': '25/00001',
  },
  modeles: { electronique: { id: 'mod-email', formeEnvoi: 'Email direct' }, postal: { id: 'mod-postal', formeEnvoi: 'Normal' } },
  identites: [
    creerIdentite({ id: 'i-p1', nature: 'physique', civilite: 'Madame', nom: 'Copropriétaire A', prenom: 'Fictive', telecoms: [], adresses: [adresseFictive('adr-1')] }),
    creerIdentite({ id: 'i-p2', nature: 'physique', civilite: 'Monsieur', nom: 'Copropriétaire B', prenom: 'Fictif', telecoms: [], adresses: [adresseFictive('adr-2')] }),
  ],
  positions: positionsCopro,
  demandesVoiePostale: [],
  communications: [creerCommunicationAdresseElectronique({ identiteId: 'i-p1', adresse: 'a@exemple.invalid', communiqueeLe: '2026-01-10' })],
  ...surcharge,
})
const compteAvis = (contenu: { parCompte: ContenuAvisCompte[] }, compteId: string): ContenuAvisCompte => {
  const trouve = contenu.parCompte.find((c) => c.compteId === compteId)
  if (!trouve) throw new Error(`compte ${compteId} absent`)
  return trouve
}

describe('F114 — « À régler avant le » = l’exigibilité ; un délai de courtoisie du cabinet ne la change jamais', () => {
  it('sans délai (0 par défaut) : « à régler avant le » la date d’exigibilité', () => {
    const a = compteAvis(contenuAvisAppel(avisBudget(), optionsAvis()), 'cpt-A')
    expect(a).toMatchObject({ aReglerAvantLe: '2027-01-01', delaiCourtoisieJours: 0, libelleDateLimite: 'à régler avant le 01/01/2027', mentionDelaiCourtoisie: null })
  })

  it('avec un délai : « exigible le … ; à régler au plus tard le … », le délai affiché comme un réglage du cabinet ; l’exigibilité ne bouge pas', () => {
    const a = compteAvis(contenuAvisAppel(avisBudget(), optionsAvis({ delaiReglementJours: 10 })), 'cpt-A')
    expect(a.libelleDateLimite).toBe('exigible le 01/01/2027 ; à régler au plus tard le 11/01/2027')
    expect(a).toMatchObject({ aReglerAvantLe: '2027-01-11', delaiCourtoisieJours: 10, parExigibilite: [{ exigibilite: '2027-01-01', montantCentimes: 40_000 }] })
    expect(a.lignes.map((l) => l.exigibilite)).toEqual(['2027-01-01'])
    expect(a.mentionDelaiCourtoisie).toMatch(/^Délai de courtoisie de 10 jours, réglage du cabinet : il ne change pas l'exigibilité/)
  })

  it('le libellé passe dans le courrier (objet, champ de fusion « appel.dateLimite » du gabarit)', () => {
    const contenu = contenuAvisAppel(avisBudget(), optionsAvis({ delaiReglementJours: 10 }))
    const [a] = preparerDiffusionAvis(contenu, diffusionAvis())
    expect(a.courrier?.objet).toBe("Avis d'appel de fonds — compte TILL.45000.00001.0 — exigible le 01/01/2027 ; à régler au plus tard le 11/01/2027")
    expect(a.valeursFusion['appel.dateLimite']).toBe('exigible le 01/01/2027 ; à régler au plus tard le 11/01/2027')
    expect(controlerContexteFusion('avis_appel_fonds', a.valeursFusion)).toMatchObject({ complet: true, inconnus: [] })
    const [sansDelai] = preparerDiffusionAvis(contenuAvisAppel(avisBudget(), optionsAvis()), diffusionAvis())
    expect(sansDelai.courrier?.objet).toBe("Avis d'appel de fonds — compte TILL.45000.00001.0 — à régler avant le 01/01/2027")
  })
})

describe('F116 — contentieux ouvert après l’avis : le prélèvement annoncé n’aura pas lieu, un courrier simple le dit', () => {
  const scenario = (comptesEnContentieux: ReadonlySet<string>, optionsContenu: Partial<OptionsContenuAvis> = {}) => {
    const contenu = contenuAvisAppel(avisBudget(), optionsAvis(optionsContenu))
    const diffusions = preparerDiffusionAvis(contenu, diffusionAvis())
    const { echeances } = echeancesPrelevementDepuisAvis(contenu, { prefixeId: 'AV-2027-01', diffusions, comptesEnContentieux })
    const lot = preparerLotPrelevements(echeances)
    return { contenu, diffusions, echeances, lot }
  }

  it('le lot écarte le compte passé en contentieux après l’avis : courrier simple (ou courriel à l’adresse des avis) « n’aura pas lieu ; merci de régler par virement »', () => {
    const { contenu, diffusions, echeances, lot } = scenario(new Set(['cpt-A']))
    expect(lot.exclues).toEqual([{ id: 'AV-2027-01-00001', motif: 'contentieux' }])
    const courriers = prelevementsAnnulesParContentieux(contenu, { echeances, lot, diffusions })
    expect(courriers).toHaveLength(1)
    expect(courriers[0]).toMatchObject({
      compteId: 'cpt-A',
      identiteId: 'i-p1',
      montantCentimes: 40_000,
      date: '2027-01-05',
      canal: 'electronique',
      adresseElectronique: 'a@exemple.invalid',
      nature: NATURE_COURRIER_PRELEVEMENT_ANNULE,
    })
    expect(courriers[0].message).toMatch(
      /^Le prélèvement SEPA de 400,00.*annoncé pour le 05\/01\/2027 \(mandat RUM-TILL-00001\) par l'avis du 15\/12\/2026 n'aura pas lieu ; merci de régler 400,00.* par virement à SDC fictif, IBAN FR1420041010050500013M02606, en indiquant la référence TILL\.45000\.00001\.0\.$/,
    )
    expect(NATURE_COURRIER_PRELEVEMENT_ANNULE).toMatch(/pas un acte du contentieux, qui garde ses propres pièces/)
  })

  it('aucun courrier : compte prélevé, ou déjà en contentieux à l’émission (l’avis n’a annoncé aucun débit)', () => {
    const normal = scenario(new Set())
    expect(prelevementsAnnulesParContentieux(normal.contenu, normal)).toEqual([])
    const des = scenario(new Set(['cpt-A']), { comptesEnContentieux: new Set(['cpt-A']) })
    expect(des.lot.exclues).toEqual([])
    expect(prelevementsAnnulesParContentieux(des.contenu, des)).toEqual([])
  })

  it('refuse un lot qui écarte une échéance absente des échéances passées', () => {
    const { contenu, diffusions, lot } = scenario(new Set(['cpt-A']))
    expect(() => prelevementsAnnulesParContentieux(contenu, { echeances: [], lot, diffusions })).toThrow(/AV-2027-01-00001.*absente/)
  })
})

describe('F118 — TIP : sans TIP reçu récemment, refusé pour un nouveau compte et remplacé par le virement ; sinon gabarit de la banque', () => {
  const avecTip = (reglageTip: OptionsContenuAvis['reglageTip']) =>
    compteAvis(
      contenuAvisAppel(
        avisBudget(),
        optionsAvis({
          reglageTip,
          reglements: [
            { compteId: 'cpt-A', mode: 'TIP' },
            { compteId: 'cpt-B', mode: 'Virement' },
          ],
        }),
      ),
      'cpt-A',
    )

  it('aucun TIP reçu récemment : l’ancien compte passe au virement sur l’avis, avec un avertissement', () => {
    const a = avecTip(creerReglageTip({ tipRecuRecemment: false }))
    expect(a.modeReglement).toBe('Virement')
    expect(a.instructions).toEqual({ mode: 'Virement', beneficiaire: 'SDC fictif', iban: 'FR1420041010050500013M02606', reference: 'TILL.45000.00001.0' })
    const avertissement = a.anomalies.filter((x) => x.code === 'tip_abandonne')
    expect(avertissement).toEqual([expect.objectContaining({ gravite: 'avertissement' })])
    expect(avertissement[0].message).toMatch(/aucun TIP reçu récemment.*partie C, F118.*passer le compte au virement/)
    expect(a.anomalies.map((x) => x.code)).not.toContain('mode_non_pris_en_charge')
  })

  it('aucun TIP reçu récemment : le mode « TIP » est refusé pour un nouveau compte ; les autres modes passent', () => {
    const sansTip = creerReglageTip({ tipRecuRecemment: false })
    expect(() => controlerModeReglementNouveauCompte('TIP', sansTip)).toThrow(/« TIP » refusé pour un nouveau compte.*F118/)
    expect(() => controlerModeReglementNouveauCompte('Virement', sansTip)).not.toThrow()
    const avecGabarit = creerReglageTip({ tipRecuRecemment: true, gabaritInstructions: 'Instructions TIP fictives de la banque.' })
    expect(() => controlerModeReglementNouveauCompte('TIP', avecGabarit)).not.toThrow()
  })

  it('TIP encore reçus : l’avis porte le gabarit d’instructions fourni par la banque, avec la référence du compte', () => {
    const reglage = creerReglageTip({ tipRecuRecemment: true, gabaritInstructions: ' Signez le TIP joint et renvoyez-le à la banque (texte fictif). ' })
    const a = avecTip(reglage)
    expect(a.instructions).toEqual({ mode: 'TIP', texte: 'Signez le TIP joint et renvoyez-le à la banque (texte fictif).', reference: 'TILL.45000.00001.0' })
    expect(a.anomalies.map((x) => x.code)).not.toContain('mode_non_pris_en_charge')
    const contenu = contenuAvisAppel(
      avisBudget(),
      optionsAvis({
        reglageTip: reglage,
        reglements: [
          { compteId: 'cpt-A', mode: 'TIP' },
          { compteId: 'cpt-B', mode: 'Virement' },
        ],
      }),
    )
    const [diffusion] = preparerDiffusionAvis(contenu, diffusionAvis())
    expect(diffusion.valeursFusion['reglement.instructions']).toBe('Par TIP : Signez le TIP joint et renvoyez-le à la banque (texte fictif). Référence : TILL.45000.00001.0.')
    expect(() => creerReglageTip({ tipRecuRecemment: true })).toThrow(/gabarit.*banque/)
    expect(() => creerReglageTip({ tipRecuRecemment: true, gabaritInstructions: '  ' })).toThrow(/gabarit.*banque/)
    expect(() => creerReglageTip({ tipRecuRecemment: false, gabaritInstructions: 'Texte' })).toThrow(/aucun TIP/)
  })

  it('réglage du cabinet absent : la question reste ouverte, le TIP reste signalé sans instructions', () => {
    expect(avecTip(null).anomalies.find((x) => x.code === 'mode_non_pris_en_charge')?.message).toMatch(/réglage TIP du cabinet à renseigner.*F118/)
    expect(() => controlerModeReglementNouveauCompte('TIP', null)).not.toThrow()
  })
})

describe('F114, F116, F118 — en-tête de l’avis : les décisions remplacent les marques 🔴', () => {
  it('chaque décision est citée ; ses questions ne sont plus en 🔴', () => {
    const { texte, item } = enTeteDuModule('avis-appel')
    const ouvert = texte.slice(texte.indexOf('🔴 Non établi'))
    for (const question of [/"À régler avant le" : la date d'exigibilité seule/, /Contentieux ouvert entre l'avis et le débit/, /TIP : signalé, sans instructions/])
      expect(ouvert).not.toMatch(question)
    expect(item('- Décision du 20/11/2026 (partie C, F114)')).toMatch(/exigibilité.*délai 0.*réglage du cabinet.*ne change jamais l'exigibilité.*« exigible le … ; à régler au plus tard le … »/)
    expect(item('- Décision du 20/11/2026 (partie C, F116)')).toMatch(/contentieux après l'avis.*courrier simple.*n'aura pas lieu ; merci de régler par virement.*pas un acte du contentieux/)
    expect(item('- Décision du 20/11/2026 (partie C, F118)')).toMatch(/aucun TIP.*refusé pour les nouveaux comptes.*virement.*avertissement.*gabarit d'instructions TIP fourni par la banque/)
  })
})

// ─── F119 : exigibilité du solde de régularisation ───────────────────────────────────────────

describe('F119 — solde de régularisation : 15 jours seulement proposés (« usage observé chez Gestéam, aucun texte ») ; la date fixée par l’AG ou l’administrateur provisoire vaut', () => {
  const exerciceRepartition = creerExercice({
    coproprieteId: 'copro-1',
    nom: '2025',
    ouverture: '2025-01-01',
    cloture: '2025-12-31',
    statut: 'Voté',
    statutIrc: 'Non déclaré',
    agId: 'ag-2024',
    resolutions: { budget: 'R4', complement: null, honoraires: null, travaux: null },
  })
  const parametres = (exigibilite: ExigibiliteSolde, exigibiliteDecidee?: ExigibiliteDecidee | null) =>
    parametresRepartition({ exercice: exerciceRepartition, dateEffet: '2026-02-01', mandatCode: 'TILL', exigibilite, exigibiliteDecidee })
  const parAg: ExigibiliteDecidee = { date: '2026-03-15', source: { origine: 'assemblee', agId: 'ag-2025', resolutionId: 'R9' } }
  const parAp: ExigibiliteDecidee = { date: '2026-03-20', source: { origine: 'administrateur', reference: 'décision fictive n° 3' } }

  it('sans date décidée : le délai reste à remplir ; 15 jours sont proposés, avec la mention, jamais appliqués d’office', () => {
    expect(MENTION_DELAI_EXIGIBILITE_PROPOSE).toBe('usage observé chez Gestéam, aucun texte')
    expect(DELAI_EXIGIBILITE_OBSERVE_GESTEAM_JOURS).toBe(15)
    expect(propositionExigibiliteSolde(null)).toEqual({
      origine: 'usage_gesteam',
      aRemplir: true,
      exigibilite: { delaiJours: 15 },
      mention: 'usage observé chez Gestéam, aucun texte',
    })
    expect(parametres({ delaiJours: 30 })).toMatchObject({ exigibilite: '2026-03-03', delaiExigibiliteJours: 30 })
  })

  it('date fixée par l’assemblée, ou par l’administrateur provisoire qui en a les pouvoirs : c’est elle qui vaut', () => {
    expect(propositionExigibiliteSolde(parAg)).toEqual({
      origine: 'decision',
      aRemplir: false,
      exigibilite: { date: '2026-03-15' },
      mention: "date fixée par l'assemblée générale (assemblée ag-2025, résolution R9) : c'est elle qui vaut",
    })
    expect(propositionExigibiliteSolde(parAp).mention).toBe(
      "date fixée par l'administrateur provisoire qui en a les pouvoirs (décision fictive n° 3) : c'est elle qui vaut",
    )
    expect(() => parametres({ delaiJours: 15 }, parAg)).toThrow(/fixée au 15\/03\/2026 par l'assemblée générale.*c'est elle qui vaut/)
    expect(() => parametres({ date: '2026-03-16' }, parAg)).toThrow(/c'est elle qui vaut/)
    const p = parametres({ date: '2026-03-15' }, parAg)
    expect(p).toMatchObject({ exigibilite: '2026-03-15', delaiExigibiliteJours: null })
    expect(justificationExigibilite(p)).toMatch(
      /^Solde exigible le 15\/03\/2026 : date fixée par l'assemblée générale \(assemblée ag-2025, résolution R9\), 42 jour\(s\) après la date de passage du 01\/02\/2026 — aucun texte/,
    )
    expect(justificationExigibilite(parametres({ date: '2026-03-15' }))).toMatch(/date fixée par le gestionnaire/)
    expect(() => propositionExigibiliteSolde({ ...parAp, date: '20/03/2026' })).toThrow(/AAAA-MM-JJ/)
  })

  it('en-tête : la décision F119 remplace la question 🔴', () => {
    const { texte, item } = enTeteDuModule('regularisation-charges')
    const ouvert = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(ouvert).not.toMatch(/Faut-il proposer quinze jours après la date de passage/)
    expect(item('- Décision du 20/11/2026 (partie C, F119)')).toMatch(
      /pas une règle.*reste à remplir.*15 jours.*« usage observé chez Gestéam, aucun texte ».*assemblée.*administrateur provisoire.*c'est elle qui vaut/,
    )
  })
})
