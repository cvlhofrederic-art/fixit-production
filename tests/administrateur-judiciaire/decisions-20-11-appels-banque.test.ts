import { describe, expect, it } from 'vitest'
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
  PERIMETRE_FONDS_DETENUS_PAR_DEFAUT,
  RUBRIQUES_FONDS_DETENUS,
  creerPerimetreFondsDetenus,
  fondsDetenusA,
  rubriqueDuCompte,
  type CompteFondsDetenus,
  type DonneesFondsDetenus,
} from '@/lib/administrateur-judiciaire/domain/fonds-detenus'
import { creerCompteCoproprietaire, creerPosition } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { postesDepuisAvis } from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import { creerOrdreVirement, genererPain001, type LigneVirement } from '@/lib/administrateur-judiciaire/domain/ordres-banque'
import { genererPain008, preparerLotPrelevements } from '@/lib/administrateur-judiciaire/domain/prelevements-sepa'
import { avisDAppel, creerCleRepartition, traitementAppelDeFonds, type EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import { annulerTraitement, creerTraitement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import {
  MENTION_NON_VALIDE_PAR_LA_BANQUE,
  controlerValidationBanque,
  creerFicheValidationBanque,
  type FicheValidationBanque,
  type SaisieFicheValidationBanque,
} from '@/lib/administrateur-judiciaire/domain/validation-banque'
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
