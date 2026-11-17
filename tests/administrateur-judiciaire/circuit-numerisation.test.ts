import { describe, expect, it } from 'vitest'
import {
  CERTITUDES_STATUT,
  REFERENTIEL_STATUTS_OCR,
  STATUTS_OCR,
  anomaliesPiece,
  associerPiece,
  comparerPieceEtFacture,
  corrigerLecture,
  deposerPiece,
  detecterDoublons,
  extrairePiece,
  identifierPiece,
  nePasAssocier,
  piecesAReprendre,
  proposerFacturesCandidates,
  remettreAScanner,
  reporterPiece,
  reprendrePiece,
  signalerErreur,
  traduirePiece,
  transitionsPermises,
  type ChampsLecture,
  type FactureSaisieAssociable,
  type PieceNumerisee,
} from '@/lib/administrateur-judiciaire/domain/circuit-numerisation'
import { lireFacture, proposerImputation } from '@/lib/administrateur-judiciaire/domain/imputation-facture'
import { enTeteDuModule } from './en-tete-module'

/**
 * Point 41 du bilan 2 : circuit de numérisation des factures (Gestéam 5.4.23, tranche 43 § 20, critère « Statut OCR »).
 * Partie métier seulement : aucun moteur OCR, aucun écran, aucune table. Données fictives, sans nom réel.
 */

const J1 = '2026-11-02'
const J2 = '2026-11-03'
const J3 = '2026-11-04'

interface Champs {
  fournisseur?: string
  siret?: string | null
  numero?: string | null
  date?: string | null
  ttc?: string
}

/** Texte d'une facture fictive ; un champ à null est omis du texte. */
const texteFacture = ({ fournisseur = 'ENTREPRISE ALPHA ASCENSEURS', siret = '111 222 333 00044', numero = 'A-2026-0042', date = '05/10/2026', ttc = '300,00' }: Champs = {}) =>
  [
    fournisseur,
    siret && `SIRET ${siret}`,
    numero && `Facture n° ${numero}`,
    date && `Date : ${date}`,
    'Dépannage ascenseur, cabine bloquée',
    'Total HT 250,00',
    'TVA 20 % 50,00',
    `Total TTC ${ttc}`,
  ]
    .filter(Boolean)
    .join('\n')

const deposee = (id = 'P1', coproprieteId: string | null = 'CP1') =>
  deposerPiece({ id, corbeille: 'corbeille-gestionnaire-1', nomFichier: `${id}.pdf`, le: J1, coproprieteId })

const extraite = (id = 'P1', champs: Champs = {}) =>
  extrairePiece(deposee(id), { texteLu: { texte: texteFacture(champs), origine: 'couche_texte_pdf' }, le: J1 })

const identifiee = (id = 'P1', champs: Champs = {}) => identifierPiece(extraite(id, champs), { le: J2 })

const facture = (surcharge: Partial<FactureSaisieAssociable> = {}): FactureSaisieAssociable => ({
  id: 'F1',
  coproprieteId: 'CP1',
  prestataireId: 'PR1',
  fournisseur: 'Entreprise Alpha Ascenseurs',
  siret: '11122233300044',
  numero: 'A-2026-0042',
  date: '2026-10-05',
  ttcCentimes: 30_000,
  ...surcharge,
})

/** Pièce associée à la facture donnée ; le motif couvre un écart éventuel entre les champs lus et la facture. */
const associee = (id: string, factureId: string, champs: Champs = {}) =>
  associerPiece(identifiee(id, champs), { facture: facture({ id: factureId }), pieces: [], le: J3, motif: 'Association de test' })

describe('référentiel des statuts OCR (🟢 tranche 43 § 20 : huit valeurs relevées)', () => {
  it('huit statuts, dans l’ordre de Gestéam', () => {
    expect(STATUTS_OCR).toEqual(['En erreur', 'À scanner', 'Extrait', 'Identifié', 'Traduit', 'Non associé', 'Associé', 'Reporté'])
  })

  it('chaque statut a son libellé, un sens, une certitude, des suivants pris dans la liste ; seul « Associé » est final', () => {
    expect(Object.keys(REFERENTIEL_STATUTS_OCR).sort()).toEqual([...STATUTS_OCR].sort())
    for (const statut of STATUTS_OCR) {
      const definition = REFERENTIEL_STATUTS_OCR[statut]
      expect(definition.libelle).toBe(statut)
      expect(definition.sens.length).toBeGreaterThan(20)
      expect(CERTITUDES_STATUT).toContain(definition.certitude)
      for (const suivant of definition.suivants) expect(STATUTS_OCR).toContain(suivant)
      expect(definition.final).toBe(definition.suivants.length === 0)
    }
    expect(STATUTS_OCR.filter((s) => REFERENTIEL_STATUTS_OCR[s].final)).toEqual(['Associé'])
  })

  it('certitude du sens : « Associé » relevé, « À scanner » non établi, les autres déduits', () => {
    const certitudes = Object.fromEntries(STATUTS_OCR.map((s) => [s, REFERENTIEL_STATUTS_OCR[s].certitude]))
    expect(certitudes).toEqual({
      'En erreur': 'deduit',
      'À scanner': 'non_etabli',
      Extrait: 'deduit',
      Identifié: 'deduit',
      Traduit: 'deduit',
      'Non associé': 'deduit',
      Associé: 'releve',
      Reporté: 'deduit',
    })
  })

  it('en-tête : sources, droit lu et hors périmètre', () => {
    const { texte } = enTeteDuModule('circuit-numerisation')
    expect(texte).toContain('tranche 43 § 20')
    expect(texte).toContain('CGI, annexe II, art. 242 nonies A, I, 7°')
    expect(texte).toContain('lus sur Légifrance le 17/11/2026')
    expect(texte).toMatch(/Hors périmètre : moteur OCR \(prestataire à choisir/)
    expect(texte).toContain('écrans (Frédéric)')
  })
})

describe('dépôt et lecture du texte (« À scanner » → « Extrait » ou « En erreur »)', () => {
  it('une pièce déposée est « À scanner », sans lecture, avec son premier changement daté', () => {
    const piece = deposee()
    expect(piece).toMatchObject({ statut: 'À scanner', lecture: null, factureId: null, report: null, coproprieteId: 'CP1' })
    expect(piece.historique).toEqual([{ statut: 'À scanner', statutAncien: null, le: J1, motif: null }])
  })

  it('refuse un dépôt sans identifiant, sans corbeille, sans fichier ou à une date invalide', () => {
    const base = { id: 'P1', corbeille: 'c', nomFichier: 'f.pdf', le: J1 }
    expect(() => deposerPiece({ ...base, id: '  ' })).toThrow(/identifiant attendu/)
    expect(() => deposerPiece({ ...base, corbeille: '' })).toThrow(/corbeille de numérisation attendue/)
    expect(() => deposerPiece({ ...base, nomFichier: '' })).toThrow(/nom du fichier attendu/)
    expect(() => deposerPiece({ ...base, le: '2026-02-30' })).toThrow(/date « 2026-02-30 » invalide/)
  })

  it('« Extrait » : le texte passe par lireFacture ; l’origine et l’outil sont notés, sans dépendance à un moteur', () => {
    const texte = texteFacture()
    const piece = extrairePiece(deposee(), { texteLu: { texte, origine: 'moteur_ocr', outil: ' outil de test ' }, le: J1 })
    expect(piece.statut).toBe('Extrait')
    expect(piece.lecture).toEqual(lireFacture(texte))
    expect(piece.lecture).toMatchObject({ siret: '11122233300044', numero: 'A-2026-0042', date: '2026-10-05', ttcCentimes: 30_000 })
    expect(piece.origineTexte).toEqual({ origine: 'moteur_ocr', outil: 'outil de test' })
  })

  it('un texte vide mène à « En erreur », avec un motif ; une origine inconnue est refusée', () => {
    const piece = extrairePiece(deposee(), { texteLu: { texte: ' \n ', origine: 'couche_texte_pdf' }, le: J1 })
    expect(piece).toMatchObject({ statut: 'En erreur', lecture: null })
    expect(piece.historique.at(-1)?.motif).toMatch(/Texte lu vide/)
    const origine = 'scanner_x' as never
    expect(() => extrairePiece(deposee(), { texteLu: { texte: 'x', origine }, le: J1 })).toThrow(/origine du texte « scanner_x » inconnue/)
  })

  it('une pièce déjà lue ne se relit pas : la lecture part de « À scanner » seulement', () => {
    expect(() => extrairePiece(identifiee(), { texteLu: { texte: texteFacture(), origine: 'couche_texte_pdf' }, le: J3 })).toThrow(
      /Pièce P1 « Identifié » : la lecture du texte se fait depuis « À scanner » seulement/,
    )
  })

  it('une transition refusée nomme les statuts permis', () => {
    expect(() => nePasAssocier(extraite(), { motif: 'x', le: J2 })).toThrow(
      /passage de « Extrait » à « Non associé » refusé \(statuts permis : « Identifié », « En erreur », « Reporté »\)/,
    )
  })
})

describe('erreur et nouvelle lecture', () => {
  it('« En erreur » à la main exige un motif et écarte la lecture ; retour en « À scanner », puis nouvelle lecture', () => {
    expect(() => signalerErreur(extraite(), { motif: ' ', le: J2 })).toThrow(/motif de l'erreur attendu/)
    const enErreur = signalerErreur(extraite(), { motif: 'Pièce illisible', le: J2 })
    expect(enErreur).toMatchObject({ statut: 'En erreur', lecture: null, origineTexte: null })
    const relue = extrairePiece(remettreAScanner(enErreur, { le: J2 }), { texteLu: { texte: texteFacture(), origine: 'moteur_ocr' }, le: J3 })
    expect(relue.statut).toBe('Extrait')
    expect(relue.historique.map((e) => e.statut)).toEqual(['À scanner', 'Extrait', 'En erreur', 'À scanner', 'Extrait'])
  })

  it('une pièce identifiée ne passe pas « En erreur » ; « À scanner » ne revient que depuis « En erreur »', () => {
    expect(() => signalerErreur(identifiee(), { motif: 'x', le: J3 })).toThrow(/« Identifié » à « En erreur » refusé/)
    expect(() => remettreAScanner(extraite(), { le: J2 })).toThrow(/« Extrait » à « À scanner » refusé/)
  })
})

describe('identification (controlerFacture) et correction de la lecture', () => {
  it('une facture complète est « Identifié » ; un total incohérent reste à vérifier sans bloquer', () => {
    const piece = identifierPiece(extraite('P1', { ttc: '310,00' }), { le: J2 })
    expect(piece.statut).toBe('Identifié')
    expect(anomaliesPiece(piece)).toMatchObject({ bloquantes: [], aVerifier: [{ code: 'total_incoherent' }] })
  })

  it('numéro, date ou montant TTC absents : identification refusée, chaque absence nommée', () => {
    expect(() => identifierPiece(extraite('P1', { numero: null, date: null }), { le: J2 })).toThrow(
      /identification refusée\. Numéro de facture introuvable\. Date de facture introuvable\. Corriger la lecture/,
    )
  })

  it('SIRET absent : à vérifier si le fournisseur est lu ; bloquant si ni fournisseur ni SIRET', () => {
    const sansSiret = extraite('P1', { siret: null })
    expect(anomaliesPiece(sansSiret)).toMatchObject({ bloquantes: [], aVerifier: [{ code: 'siret_manquant' }] })
    const anonyme = corrigerLecture(sansSiret, { champs: { fournisseur: null }, le: J2 })
    expect(anomaliesPiece(anonyme).bloquantes).toEqual([{ code: 'siret_manquant', message: 'Ni fournisseur ni SIRET lus.' }])
    expect(() => identifierPiece(anonyme, { le: J2 })).toThrow(/Ni fournisseur ni SIRET lus/)
  })

  it('« Identifié » exige une lecture : refusé depuis « À scanner »', () => {
    expect(() => identifierPiece(deposee(), { le: J1 })).toThrow(/« À scanner » à « Identifié » refusé/)
  })

  it('la correction ramène en « Extrait », efface la traduction, et l’historique nomme les champs corrigés', () => {
    const traduite = traduirePiece(identifiee(), { imputation: proposerImputation(lireFacture(texteFacture()), ['Charges générales']), le: J2 })
    const corrigee = corrigerLecture(traduite, { champs: { numero: ' A-2026-0043 ', ttcCentimes: 31_000 }, le: J3 })
    expect(corrigee).toMatchObject({ statut: 'Extrait', imputation: null })
    expect(corrigee.lecture).toMatchObject({ numero: 'A-2026-0043', ttcCentimes: 31_000, siret: '11122233300044' })
    expect(corrigee.historique.at(-1)).toEqual({ statut: 'Extrait', statutAncien: 'Traduit', le: J3, motif: 'Lecture corrigée : numéro, montant TTC.' })
    expect(identifierPiece(corrigee, { le: J3 }).statut).toBe('Identifié')
  })

  it.each<[ChampsLecture, RegExp]>([
    [{ siret: '1112223330004' }, /« SIRET » refusée \(14 chiffres attendus\)/],
    [{ date: '05/10/2026' }, /« date » refusée \(date AAAA-MM-JJ attendue\)/],
    [{ ttcCentimes: 300.5 }, /« montant TTC » refusée \(centimes entiers positifs attendus\)/],
    [{ htCentimes: -1 }, /« montant HT » refusée \(centimes entiers positifs attendus\)/],
    [{ tauxTva: -5 }, /« taux de TVA » refusée \(pourcentage positif attendu\)/],
    [{ numero: 42 } as never, /« numéro » refusée \(texte attendu\)/],
    [{ texte: 'autre' } as never, /champ « texte » inconnu ou non corrigeable/],
    [{}, /aucun champ à corriger/],
  ])('correction refusée : %o', (champs, message) => {
    expect(() => corrigerLecture(extraite(), { champs, le: J2 })).toThrow(message)
  })

  it('pas de correction après l’association ni avant la lecture', () => {
    expect(() => corrigerLecture(associee('P1', 'F1'), { champs: { numero: 'X' }, le: J3 })).toThrow(/« Associé » : correction de la lecture refusée/)
    expect(() => corrigerLecture(deposee(), { champs: { numero: 'X' }, le: J1 })).toThrow(/« À scanner » : correction de la lecture refusée/)
  })
})

describe('traduction en proposition d’écriture (« Traduit »)', () => {
  it('le compte proposé par proposerImputation est gardé sur la pièce', () => {
    const imputation = proposerImputation(lireFacture(texteFacture()), ['Charges générales', 'Ascenseur'])
    const piece = traduirePiece(identifiee(), { imputation, le: J2 })
    expect(piece).toMatchObject({ statut: 'Traduit', imputation: { comptePlan: '61500', cleRepartition: 'Ascenseur' } })
  })

  it('une proposition « à compléter » (aucun compte) est refusée ; « Traduit » exige « Identifié »', () => {
    const aCompleter = proposerImputation(lireFacture('SOCIETE GAMMA\nPrestation diverse\nTotal TTC 10,00'), [])
    expect(aCompleter.comptePlan).toBeNull()
    expect(() => traduirePiece(identifiee(), { imputation: aCompleter, le: J2 })).toThrow(/aucun compte de charge retenu/)
    expect(() => traduirePiece(extraite(), { imputation: { ...aCompleter, comptePlan: '61500' }, le: J2 })).toThrow(/« Extrait » à « Traduit » refusé/)
  })
})

describe('factures saisies candidates : liste triée et expliquée, jamais d’association d’office', () => {
  const factures = [
    facture({ id: 'F3', numero: 'B-77', ttcCentimes: 12_000, date: '2026-09-01' }),
    facture({ id: 'F1' }),
    facture({ id: 'F2', fournisseur: 'Société Beta Nettoyage', siret: '99988877700011', numero: 'N-5', ttcCentimes: 45_000 }),
    facture({ id: 'F4', coproprieteId: 'CP2' }),
    facture({ id: 'F5', siret: null, fournisseur: 'Alpha Ascenseurs', numero: 'A2026/0042', date: null }),
  ]

  it('tri : le plus de critères concordants, puis le moins de discordants ; la date seule ne suffit pas', () => {
    const candidates = proposerFacturesCandidates(identifiee(), { factures, pieces: [] })
    expect(candidates.map((c) => [c.factureId, c.concordants, c.discordants])).toEqual([
      ['F1', 4, 0],
      ['F5', 3, 0],
      ['F3', 1, 3],
    ])
  })

  it('chaque critère est expliqué ; le nom suffit quand le SIRET manque ; le numéro se compare sans séparateurs', () => {
    const [f1, f5, f3] = proposerFacturesCandidates(identifiee(), { factures, pieces: [] })
    expect(f1.explication).toMatch(/^Fournisseur : concorde \(même SIRET\) · Numéro : concorde \(n° A-2026-0042\) · Montant TTC : concorde \(300,00\s€\) · Date : concorde \(05\/10\/2026\)$/)
    expect(f5.criteres.map((c) => c.resultat)).toEqual(['concorde', 'concorde', 'concorde', 'inconnu'])
    expect(f5.criteres[0].detail).toBe('même nom, SIRET non comparé')
    expect(f3.explication).toMatch(/Numéro : diffère \(n° A-2026-0042 lu, n° B-77 saisi\)/)
    expect(f3.explication).toMatch(/Montant TTC : diffère \(300,00\s€ lu, 120,00\s€ saisi\)/)
    expect(f3.explication).toContain("Date : diffère (05/10/2026 lue, 01/09/2026 saisie (34 jours d'écart))")
  })

  it('une facture déjà liée à une autre pièce reste listée, signalée comme doublon probable', () => {
    const autre = associee('P9', 'F1')
    const [f1] = proposerFacturesCandidates(identifiee(), { factures, pieces: [autre] })
    expect(f1).toMatchObject({ factureId: 'F1', dejaLieeA: 'P9' })
    expect(f1.explication).toMatch(/déjà liée à la pièce P9 : doublon probable, association refusée$/)
  })

  it('sans copropriété sur la pièce, les factures de toutes les copropriétés sont comparées', () => {
    const piece = identifierPiece(
      extrairePiece(deposee('P2', null), { texteLu: { texte: texteFacture(), origine: 'couche_texte_pdf' }, le: J1 }),
      { le: J2 },
    )
    expect(proposerFacturesCandidates(piece, { factures, pieces: [] }).map((c) => c.factureId)).toContain('F4')
  })

  it('refuse une pièce non lue et une facture en double dans la liste', () => {
    expect(() => proposerFacturesCandidates(deposee(), { factures, pieces: [] })).toThrow(/texte pas encore lu/)
    expect(() => proposerFacturesCandidates(identifiee(), { factures: [facture(), facture()], pieces: [] })).toThrow(/Facture saisie en double/)
  })
})

describe('association à une facture saisie', () => {
  it('« Identifié » → « Associé » : la facture est notée, l’historique daté', () => {
    const piece = associerPiece(identifiee(), { facture: facture(), pieces: [], le: J3 })
    expect(piece).toMatchObject({ statut: 'Associé', factureId: 'F1' })
    expect(piece.historique.at(-1)).toEqual({ statut: 'Associé', statutAncien: 'Identifié', le: J3, motif: null })
    expect(transitionsPermises(piece)).toEqual([])
  })

  it('depuis « Traduit » et depuis « Non associé » aussi ; pas depuis « Extrait »', () => {
    const imputation = proposerImputation(lireFacture(texteFacture()), ['Charges générales'])
    expect(associerPiece(traduirePiece(identifiee(), { imputation, le: J2 }), { facture: facture(), pieces: [], le: J3 }).statut).toBe('Associé')
    const nonAssociee = nePasAssocier(identifiee(), { motif: 'Facture pas encore saisie', le: J2 })
    expect(associerPiece(nonAssociee, { facture: facture(), pieces: [], le: J3 })).toMatchObject({ statut: 'Associé', motifNonAssociation: null })
    expect(() => associerPiece(extraite(), { facture: facture(), pieces: [], le: J2 })).toThrow(/« Extrait » à « Associé » refusé/)
  })

  it('refuse d’associer une pièce déjà associée', () => {
    expect(() => associerPiece(associee('P1', 'F1'), { facture: facture({ id: 'F2' }), pieces: [], le: J3 })).toThrow(
      /Pièce P1 déjà associée à la facture F1 : une pièce ne s'associe qu'une fois/,
    )
  })

  it('refuse une facture déjà liée à une autre pièce', () => {
    const autre = associee('P2', 'F1', { numero: 'A-2026-0099' })
    expect(() => associerPiece(identifiee(), { facture: facture(), pieces: [autre], le: J3 })).toThrow(
      /Facture F1 déjà liée à la pièce P2 : une facture saisie ne reçoit qu'une pièce/,
    )
  })

  it('refuse un doublon : autre pièce associée, même fournisseur, même numéro (séparateurs mis à part)', () => {
    const autre = associee('P2', 'F7', { numero: 'A/2026/0042' })
    expect(() => associerPiece(identifiee(), { facture: facture(), pieces: [autre], le: J3 })).toThrow(
      /Doublon : la pièce P2 \(même fournisseur, même numéro A-2026-0042\) est déjà associée à la facture F7/,
    )
  })

  it('refuse une facture d’une autre copropriété', () => {
    expect(() => associerPiece(identifiee(), { facture: facture({ coproprieteId: 'CP2' }), pieces: [], le: J3 })).toThrow(
      /la facture F1 relève d'une autre copropriété/,
    )
  })

  it('un critère discordant exige un motif ; un critère inconnu, non', () => {
    const ecart = facture({ ttcCentimes: 30_100 })
    expect(() => associerPiece(identifiee(), { facture: ecart, pieces: [], le: J3 })).toThrow(
      /avec écart \(Montant TTC : 300,00\s€ lu, 301,00\s€ saisi\) : motif attendu/,
    )
    const avecMotif = associerPiece(identifiee(), { facture: ecart, pieces: [], le: J3, motif: 'Frais de port ajoutés à la saisie' })
    expect(avecMotif.historique.at(-1)?.motif).toBe('Frais de port ajoutés à la saisie')
    expect(associerPiece(identifiee(), { facture: facture({ date: null }), pieces: [], le: J3 }).statut).toBe('Associé')
  })

  it('comparerPieceEtFacture donne les quatre critères dans l’ordre', () => {
    expect(comparerPieceEtFacture(identifiee(), facture({ siret: '99988877700011' })).map((c) => [c.critere, c.resultat])).toEqual([
      ['fournisseur', 'differe'],
      ['numero', 'concorde'],
      ['montant_ttc', 'concorde'],
      ['date', 'concorde'],
    ])
  })
})

describe('non-association (motif obligatoire)', () => {
  it('« Non associé » garde le motif ; sans motif, refus', () => {
    const piece = nePasAssocier(identifiee(), { motif: '  Facture  pas encore saisie ', le: J2 })
    expect(piece).toMatchObject({ statut: 'Non associé', motifNonAssociation: 'Facture pas encore saisie', factureId: null })
    expect(() => nePasAssocier(identifiee(), { motif: '', le: J2 })).toThrow(/motif de la non-association attendu/)
  })
})

describe('report et reprise', () => {
  it('report avec date de reprise : la reprise ramène au statut d’avant le report', () => {
    const reportee = reporterPiece(identifiee(), { le: J2, dateReprise: J3 })
    expect(reportee).toMatchObject({ statut: 'Reporté', report: { le: J2, dateReprise: J3, motif: null, statutAvantReport: 'Identifié' } })
    expect(reportee.historique.at(-1)?.motif).toBe('Reprise prévue le 04/11/2026.')
    expect(transitionsPermises(reportee)).toEqual(['Identifié'])
    const reprise = reprendrePiece(reportee, { le: J2 })
    expect(reprise).toMatchObject({ statut: 'Identifié', report: null })
    expect(reprise.historique.at(-1)).toEqual({ statut: 'Identifié', statutAncien: 'Reporté', le: J2, motif: 'Reprise après report.' })
  })

  it('report avec un motif seul, depuis « À scanner » ; reprise en « À scanner »', () => {
    const reportee = reporterPiece(deposee(), { le: J1, motif: 'Attente du duplicata' })
    expect(reportee.report).toEqual({ le: J1, dateReprise: null, motif: 'Attente du duplicata', statutAvantReport: 'À scanner' })
    expect(reprendrePiece(reportee, { le: J2 }).statut).toBe('À scanner')
  })

  it('refus : ni date ni motif, date de reprise pas après le report, pièce associée ou déjà reportée', () => {
    expect(() => reporterPiece(identifiee(), { le: J2 })).toThrow(/date de reprise ou motif attendu/)
    expect(() => reporterPiece(identifiee(), { le: J2, dateReprise: J2 })).toThrow(/date de reprise « 2026-11-03 » refusée/)
    expect(() => reporterPiece(identifiee(), { le: J2, dateReprise: '2026-13-01', motif: 'x' })).toThrow(/date de reprise « 2026-13-01 » refusée/)
    expect(() => reporterPiece(associee('P1', 'F1'), { le: J3, motif: 'x' })).toThrow(/« Associé » est un statut final/)
    const reportee = reporterPiece(identifiee(), { le: J2, motif: 'x' })
    expect(() => reporterPiece(reportee, { le: J2, motif: 'y' })).toThrow(/Pièce P1 reportée : la reprendre d'abord \(retour en « Identifié »\)/)
  })

  it('une pièce reportée ne change pas avant sa reprise', () => {
    const reportee = reporterPiece(extraite(), { le: J2, motif: 'Attente du fournisseur' })
    expect(transitionsPermises(reportee)).toEqual(['Extrait'])
    expect(() => identifierPiece(reportee, { le: J2 })).toThrow(/Pièce P1 reportée : la reprendre d'abord \(retour en « Extrait »\)/)
    expect(() => corrigerLecture(reportee, { champs: { numero: 'X' }, le: J2 })).toThrow(/« Reporté » : correction de la lecture refusée/)
    expect(identifierPiece(reprendrePiece(reportee, { le: J3 }), { le: J3 }).statut).toBe('Identifié')
  })

  it('reprise refusée pour une pièce non reportée ; report sans données : incohérence signalée', () => {
    expect(() => reprendrePiece(identifiee(), { le: J2 })).toThrow(/seule une pièce reportée se reprend/)
    const incoherente: PieceNumerisee = { ...reporterPiece(identifiee(), { le: J2, motif: 'x' }), report: null }
    expect(() => reprendrePiece(incoherente, { le: J2 })).toThrow(/reportée sans report enregistré/)
  })

  it('pièces à reprendre au jour donné : date atteinte, de la plus ancienne à la plus récente ; sans date, jamais', () => {
    const pieces = [
      reporterPiece(identifiee('P1'), { le: J2, dateReprise: '2026-11-20' }),
      reporterPiece(identifiee('P2'), { le: J2, dateReprise: J3 }),
      reporterPiece(identifiee('P3'), { le: J2, motif: 'En attente' }),
      reporterPiece(identifiee('P4'), { le: J2, dateReprise: '2026-12-01' }),
    ]
    expect(piecesAReprendre(pieces, '2026-11-20').map((p) => p.id)).toEqual(['P2', 'P1'])
    expect(() => piecesAReprendre(pieces, '20/11/2026')).toThrow(/invalide/)
  })
})

describe('dates des changements', () => {
  it('un changement ne se date pas avant le précédent ; une date invalide est refusée', () => {
    expect(() => identifierPiece(extraite(), { le: '2026-11-01' })).toThrow(/changement daté du 01\/11\/2026, avant le changement précédent \(02\/11\/2026\)/)
    expect(() => identifierPiece(extraite(), { le: '2026-11-31' })).toThrow(/date « 2026-11-31 » invalide/)
  })
})

describe('doublons : même fournisseur et même numéro', () => {
  it('regroupe les pièces de la même facture, numéro comparé sans séparateurs ni casse', () => {
    const pieces = [extraite('P1'), extraite('P2', { numero: 'a2026-0042' }), extraite('P3', { numero: 'A-2026-0050' }), deposee('P4')]
    expect(detecterDoublons(pieces)).toEqual([
      {
        numero: 'A-2026-0042',
        pieceIds: ['P1', 'P2'],
        message: 'Doublon probable : pièces P1, P2, même fournisseur et même numéro (A-2026-0042). Une seule peut être associée.',
      },
    ])
  })

  it('même numéro chez deux fournisseurs : pas de doublon ; sans numéro lu : ignorée', () => {
    const pieces = [
      extraite('P1'),
      extraite('P2', { fournisseur: 'SOCIETE BETA NETTOYAGE', siret: '999 888 777 00011' }),
      extraite('P3', { numero: null }),
      extraite('P4', { numero: null }),
    ]
    expect(detecterDoublons(pieces)).toEqual([])
  })
})
