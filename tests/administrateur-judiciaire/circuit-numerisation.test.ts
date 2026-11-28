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
  rattacherPiece,
  remettreAScanner,
  reporterPiece,
  reprendrePiece,
  signalerErreur,
  traduirePiece,
  transitionsPermises,
  type ChampsLecture,
  type FactureSaisieAssociable,
  type PieceNumerisee,
  type ResultatCritere,
} from '@/lib/administrateur-judiciaire/domain/circuit-numerisation'
import { identifierPrestataire } from '@/lib/administrateur-judiciaire/domain/facture-contrat'
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

/** Le gestionnaire confirme le nom lu en première ligne (correction sans changement de valeur). */
const confirmee = (piece: PieceNumerisee) => corrigerLecture(piece, { champs: { fournisseur: piece.lecture?.fournisseur ?? null }, le: J1 })

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

const imputationTest = () => proposerImputation(lireFacture(texteFacture()), ['Charges générales'])

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

  it('certitude du sens : « Associé » relevé (sans « fin du circuit », qui est un choix du module), « À scanner » non établi, les autres déduits', () => {
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
    expect(REFERENTIEL_STATUTS_OCR.Associé.sens).toBe('Pièce associée à une facture saisie.')
  })

  it('« En erreur » reste possible jusqu’à l’association (relevé : « ou non associée, reportée, en erreur »)', () => {
    for (const statut of ['À scanner', 'Extrait', 'Identifié', 'Traduit', 'Non associé'] as const)
      expect(REFERENTIEL_STATUTS_OCR[statut].suivants).toContain('En erreur')
    expect(REFERENTIEL_STATUTS_OCR.Associé.suivants).not.toContain('En erreur')
  })

  it('un statut inconnu est refusé', () => {
    const inconnu = { id: 'P1', statut: 'Archivé' as never, report: null }
    expect(() => transitionsPermises(inconnu)).toThrow(/Pièce P1 : statut OCR « Archivé » inconnu/)
  })

  it('en-tête : sources, droit lu, règle du fournisseur partagée et hors périmètre', () => {
    const { texte, item } = enTeteDuModule('circuit-numerisation')
    expect(texte).toContain('tranche 43 § 20')
    expect(texte).toContain('CGI, annexe II, art. 242 nonies A, I, 7°')
    expect(texte).toContain('lus sur Légifrance le 17/11/2026')
    expect(texte).toContain('identifierPrestataire')
    expect(texte).toMatch(/Hors périmètre : moteur OCR \(prestataire à choisir/)
    expect(texte).toContain('écrans (Frédéric)')
    expect(item('⚪ tranches 33, 37 et 39')).toContain('« OCR-RAD »')
    expect(item('Référent métier : sens de « À scanner »')).toContain('« OCR-RAD »')
  })
})

describe('dépôt et lecture du texte (« À scanner » → « Extrait » ou « En erreur »)', () => {
  it('une pièce déposée est « À scanner », sans lecture, avec son premier changement daté', () => {
    const piece = deposee()
    expect(piece).toMatchObject({ statut: 'À scanner', lecture: null, factureId: null, report: null, coproprieteId: 'CP1', fournisseurConfirme: false })
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

  it('« En erreur » aussi depuis « Identifié », « Traduit » et « Non associé » : motif obligatoire, lecture écartée', () => {
    const depart = [
      identifiee(),
      traduirePiece(identifiee(), { imputation: imputationTest(), le: J2 }),
      nePasAssocier(identifiee(), { motif: 'Aucune facture saisie', le: J2 }),
    ]
    for (const piece of depart) {
      expect(() => signalerErreur(piece, { motif: '', le: J3 })).toThrow(/motif de l'erreur attendu/)
      const enErreur = signalerErreur(piece, { motif: 'C’est un devis, pas une facture', le: J3 })
      expect(enErreur).toMatchObject({ statut: 'En erreur', lecture: null, imputation: null, motifNonAssociation: null, fournisseurConfirme: false })
      expect(enErreur.historique.at(-1)).toEqual({ statut: 'En erreur', statutAncien: piece.statut, le: J3, motif: 'C’est un devis, pas une facture' })
    }
  })

  it('« En erreur » refusé après l’association ; « À scanner » ne revient que depuis « En erreur »', () => {
    expect(() => signalerErreur(associee('P1', 'F1'), { motif: 'x', le: J3 })).toThrow(/« Associé » est un statut final/)
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

  it('SIRET lu : le nom de la première ligne n’a pas à être confirmé', () => {
    expect(extraite().fournisseurConfirme).toBe(false)
    expect(anomaliesPiece(extraite()).bloquantes).toEqual([])
  })

  it('sans SIRET lu, la première ligne n’est qu’une proposition (« Page 1/2 ») : identification refusée tant que le fournisseur n’est pas confirmé', () => {
    const texte = 'Page 1/2\nFacture n° 5\nDate : 05/10/2026\nTotal TTC 10,00'
    const piece = extrairePiece(deposee(), { texteLu: { texte, origine: 'moteur_ocr' }, le: J1 })
    expect(piece).toMatchObject({ lecture: { fournisseur: 'Page 1/2', siret: null }, fournisseurConfirme: false })
    expect(anomaliesPiece(piece).bloquantes.map((a) => a.code)).toEqual(['fournisseur_non_confirme'])
    expect(() => identifierPiece(piece, { le: J2 })).toThrow(/le fournisseur « Page 1\/2 » \(première ligne du texte\) n'est pas confirmé/)
    const corrigee = corrigerLecture(piece, { champs: { fournisseur: 'Société Gamma' }, le: J2 })
    expect(corrigee).toMatchObject({ fournisseurConfirme: true, lecture: { fournisseur: 'Société Gamma' } })
    expect(identifierPiece(corrigee, { le: J2 }).statut).toBe('Identifié')
  })

  it('SIRET absent : un fournisseur confirmé suffit, le SIRET reste à vérifier ; ni fournisseur ni SIRET : bloquant', () => {
    const sansSiret = extraite('P1', { siret: null })
    expect(anomaliesPiece(sansSiret).bloquantes.map((a) => a.code)).toEqual(['fournisseur_non_confirme'])
    const avecConfirmation = confirmee(sansSiret)
    expect(avecConfirmation).toMatchObject({ statut: 'Extrait', fournisseurConfirme: true })
    expect(avecConfirmation.historique.at(-1)?.motif).toBe('Fournisseur confirmé.')
    expect(anomaliesPiece(avecConfirmation)).toMatchObject({ bloquantes: [], aVerifier: [{ code: 'siret_manquant' }] })
    const anonyme = corrigerLecture(avecConfirmation, { champs: { fournisseur: null }, le: J2 })
    expect(anonyme.fournisseurConfirme).toBe(false)
    expect(anomaliesPiece(anonyme).bloquantes).toEqual([{ code: 'siret_manquant', message: 'Ni fournisseur ni SIRET lus.' }])
    expect(() => identifierPiece(anonyme, { le: J2 })).toThrow(/Ni fournisseur ni SIRET lus/)
  })

  it('« Identifié » exige une lecture : refusé depuis « À scanner »', () => {
    expect(() => identifierPiece(deposee(), { le: J1 })).toThrow(/« À scanner » à « Identifié » refusé/)
  })

  it('la correction ramène en « Extrait », efface la traduction, et l’historique nomme les champs corrigés', () => {
    const traduite = traduirePiece(identifiee(), { imputation: imputationTest(), le: J2 })
    const corrigee = corrigerLecture(traduite, { champs: { numero: ' A-2026-0043 ', ttcCentimes: 31_000 }, le: J3 })
    expect(corrigee).toMatchObject({ statut: 'Extrait', imputation: null })
    expect(corrigee.lecture).toMatchObject({ numero: 'A-2026-0043', ttcCentimes: 31_000, siret: '11122233300044' })
    expect(corrigee.historique.at(-1)).toEqual({ statut: 'Extrait', statutAncien: 'Traduit', le: J3, motif: 'Lecture corrigée : numéro, montant TTC.' })
    expect(identifierPiece(corrigee, { le: J3 }).statut).toBe('Identifié')
  })

  it('corrections acceptées : SIRET (espaces retirés), date et taux de TVA', () => {
    const piece = extraite('P1', { siret: null, date: null })
    const corrigee = corrigerLecture(piece, { champs: { siret: '111 222 333 00044', date: '2026-10-06', tauxTva: 10 }, le: J2 })
    expect(corrigee.lecture).toMatchObject({ siret: '11122233300044', date: '2026-10-06', tauxTva: 10 })
    expect(corrigee.historique.at(-1)?.motif).toBe('Lecture corrigée : SIRET, date, taux de TVA.')
  })

  it('un champ inchangé est ignoré ; si rien ne change, la correction est refusée', () => {
    expect(() => corrigerLecture(identifiee(), { champs: { numero: 'A-2026-0042' }, le: J3 })).toThrow(/Pièce P1 : aucun changement/)
    const corrigee = corrigerLecture(identifiee(), { champs: { numero: 'A-2026-0042', ttcCentimes: 31_000 }, le: J3 })
    expect(corrigee.historique.at(-1)?.motif).toBe('Lecture corrigée : montant TTC.')
    const dejaConfirmee = confirmee(extraite('P1', { siret: null }))
    expect(() => confirmee(dejaConfirmee)).toThrow(/aucun changement/)
  })

  it('correction depuis « Non associé » : retour en « Extrait », motif de non-association effacé', () => {
    const nonAssociee = nePasAssocier(identifiee(), { motif: 'Facture pas encore saisie', le: J2 })
    expect(corrigerLecture(nonAssociee, { champs: { ttcCentimes: 31_000 }, le: J3 })).toMatchObject({ statut: 'Extrait', motifNonAssociation: null })
  })

  it.each<[ChampsLecture, RegExp]>([
    [{ siret: '1112223330004' }, /« SIRET » refusée \(14 chiffres attendus\)/],
    [{ date: '05/10/2026' }, /« date » refusée \(date AAAA-MM-JJ attendue\)/],
    [{ ttcCentimes: 300.5 }, /« montant TTC » refusée \(centimes entiers attendus/],
    [{ htCentimes: '250' } as never, /« montant HT » refusée \(centimes entiers attendus/],
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

describe('avoirs : montants négatifs', () => {
  const texteAvoir = 'ENTREPRISE ALPHA ASCENSEURS\nSIRET 111 222 333 00044\nAvoir n° AV-1\nDate : 05/10/2026\nTotal TTC -50,00'

  it('lireFacture perd le signe : l’avoir est signalé ; corrigé en négatif, il s’associe sans écart à l’avoir saisi', () => {
    const piece = extrairePiece(deposee(), { texteLu: { texte: texteAvoir, origine: 'couche_texte_pdf' }, le: J1 })
    expect(piece.lecture).toMatchObject({ ttcCentimes: 5_000, numero: null })
    const { bloquantes, aVerifier } = anomaliesPiece(piece)
    expect(bloquantes.map((a) => a.code)).toEqual(['numero_manquant'])
    expect(aVerifier.find((a) => a.code === 'avoir_montant_positif')?.message).toMatch(/un avoir se passe en négatif/)
    const corrigee = corrigerLecture(piece, { champs: { numero: 'AV-1', ttcCentimes: -5_000 }, le: J2 })
    expect(corrigee.lecture?.ttcCentimes).toBe(-5_000)
    expect(anomaliesPiece(corrigee).aVerifier.map((a) => a.code)).not.toContain('avoir_montant_positif')
    const prete = identifierPiece(corrigee, { le: J2 })
    const avoir = facture({ id: 'F30', numero: 'AV-1', ttcCentimes: -5_000 })
    expect(comparerPieceEtFacture(prete, avoir).find((c) => c.critere === 'montant_ttc')?.resultat).toBe('concorde')
    expect(associerPiece(prete, { facture: avoir, pieces: [], le: J3 })).toMatchObject({ statut: 'Associé', factureId: 'F30' })
  })
})

describe('traduction en proposition d’écriture (« Traduit »)', () => {
  it('le compte proposé par proposerImputation est gardé sur la pièce, et noté dans l’historique', () => {
    const imputation = proposerImputation(lireFacture(texteFacture()), ['Charges générales', 'Ascenseur'])
    const piece = traduirePiece(identifiee(), { imputation, le: J2 })
    expect(piece).toMatchObject({ statut: 'Traduit', imputation: { comptePlan: '61500', cleRepartition: 'Ascenseur' } })
    expect(piece.historique.at(-1)?.motif).toBe('Compte 61500 retenu.')
  })

  it('une proposition « à compléter » (aucun compte) est refusée ; « Traduit » refusé depuis « Extrait »', () => {
    const aCompleter = proposerImputation(lireFacture('SOCIETE GAMMA\nPrestation diverse\nTotal TTC 10,00'), [])
    expect(aCompleter.comptePlan).toBeNull()
    expect(() => traduirePiece(identifiee(), { imputation: aCompleter, le: J2 })).toThrow(/aucun compte de charge retenu/)
    expect(() => traduirePiece(extraite(), { imputation: { ...aCompleter, comptePlan: '61500' }, le: J2 })).toThrow(/« Extrait » à « Traduit » refusé/)
  })

  it('compte vide (espaces) ou hors de la classe 6 (compte fournisseur) : refusé', () => {
    expect(() => traduirePiece(identifiee(), { imputation: { ...imputationTest(), comptePlan: '   ' }, le: J2 })).toThrow(/aucun compte de charge retenu/)
    expect(() => traduirePiece(identifiee(), { imputation: { ...imputationTest(), comptePlan: '40100' }, le: J2 })).toThrow(
      /compte « 40100 » : compte de charge de classe 6 attendu/,
    )
  })

  it('changer de compte : « Traduit » → « Traduit », daté ; la même proposition est refusée', () => {
    const traduite = traduirePiece(identifiee(), { imputation: imputationTest(), le: J2 })
    const autre = traduirePiece(traduite, { imputation: { ...imputationTest(), comptePlan: '61400' }, le: J3 })
    expect(autre).toMatchObject({ statut: 'Traduit', imputation: { comptePlan: '61400' } })
    expect(autre.historique.at(-1)).toEqual({ statut: 'Traduit', statutAncien: 'Traduit', le: J3, motif: 'Compte changé : 61500 → 61400.' })
    expect(() => traduirePiece(autre, { imputation: { ...imputationTest(), comptePlan: '61400' }, le: J3 })).toThrow(/traduction inchangée/)
    const autreCle = traduirePiece(autre, { imputation: { ...imputationTest(), comptePlan: '61400', cleRepartition: 'Ascenseur' }, le: J3 })
    expect(autreCle.historique.at(-1)?.motif).toBe("Proposition d'écriture modifiée (compte 61400).")
  })

  it('depuis « Non associé » aussi : le motif de non-association est effacé', () => {
    const nonAssociee = nePasAssocier(identifiee(), { motif: 'Facture pas encore saisie', le: J2 })
    expect(traduirePiece(nonAssociee, { imputation: imputationTest(), le: J3 })).toMatchObject({ statut: 'Traduit', motifNonAssociation: null })
  })
})

describe('fournisseur : même règle que facture-contrat.ts (identifierPrestataire)', () => {
  const cas: [string, Champs, Partial<FactureSaisieAssociable>, ResultatCritere][] = [
    ['forme juridique mise à part : même nom', { fournisseur: 'ALPHA SAS', siret: null }, { fournisseur: 'SAS Alpha', siret: null }, 'concorde'],
    ['nom approché : jamais le même fournisseur', { fournisseur: 'ALPHA', siret: null }, { fournisseur: 'Alpha Plomberie', siret: null }, 'differe'],
    ['même SIREN, autre établissement : même entreprise', {}, { siret: '11122233300051' }, 'concorde'],
    ['noms différents, sans SIRET', { fournisseur: 'ALPHA', siret: null }, { fournisseur: 'Beta', siret: null }, 'differe'],
    ['même nom mais SIREN contradictoires', { fournisseur: 'ALPHA' }, { fournisseur: 'Alpha', siret: '99988877700011' }, 'differe'],
  ]

  it.each(cas)('%s', (_, lu, saisi, attendu) => {
    const piece = extraite('P1', lu)
    const saisie = facture(saisi)
    const [fournisseur] = comparerPieceEtFacture(piece, saisie)
    expect(fournisseur).toMatchObject({ critere: 'fournisseur', resultat: attendu })
    const { identification } = identifierPrestataire(lireFacture(texteFacture(lu)), [{ id: 'PR', nom: saisie.fournisseur, siret: saisie.siret }])
    expect(identification !== null).toBe(attendu === 'concorde')
  })

  it('ni SIRET ni nom à comparer : « inconnu »', () => {
    const anonyme = corrigerLecture(extraite('P1', { siret: null }), { champs: { fournisseur: null }, le: J2 })
    expect(comparerPieceEtFacture(anonyme, facture({ siret: null }))[0]).toEqual({ critere: 'fournisseur', resultat: 'inconnu', detail: 'ni SIRET ni nom à comparer' })
  })

  it('noms différents sans SIRET : motif exigé à l’association', () => {
    const piece = identifierPiece(confirmee(extraite('P1', { fournisseur: 'ALPHA', siret: null })), { le: J2 })
    expect(() => associerPiece(piece, { facture: facture({ fournisseur: 'Beta', siret: null }), pieces: [], le: J3 })).toThrow(
      /avec écart \(Fournisseur : « ALPHA » lu, « Beta » saisi\) : motif attendu/,
    )
  })
})

describe('factures saisies candidates : liste triée et expliquée, jamais d’association d’office', () => {
  const factures = [
    facture({ id: 'F3', numero: 'B-77', ttcCentimes: 12_000, date: '2026-09-01' }),
    facture({ id: 'F1' }),
    facture({ id: 'F2', fournisseur: 'Société Beta Nettoyage', siret: '99988877700011', numero: 'N-5', ttcCentimes: 45_000 }),
    facture({ id: 'F4', coproprieteId: 'CP2' }),
    facture({ id: 'F5', siret: null, fournisseur: 'SAS Entreprise Alpha Ascenseurs', numero: 'A/2026/0042', date: null }),
  ]

  it('tri : le plus de critères concordants, puis le moins de discordants ; la date seule ne suffit pas', () => {
    const candidates = proposerFacturesCandidates(identifiee(), { factures, pieces: [] })
    expect(candidates.map((c) => [c.factureId, c.concordants, c.discordants, c.associable])).toEqual([
      ['F1', 4, 0, true],
      ['F4', 4, 0, false],
      ['F5', 3, 0, true],
      ['F3', 1, 3, true],
    ])
  })

  it('chaque critère est expliqué ; le nom suffit quand le SIRET manque ; le numéro se compare sans tenir compte du séparateur', () => {
    const [f1, , f5, f3] = proposerFacturesCandidates(identifiee(), { factures, pieces: [] })
    expect(f1.explication).toMatch(/^Fournisseur : concorde \(même SIRET\) · Numéro : concorde \(n° A-2026-0042\) · Montant TTC : concorde \(300,00\s€\) · Date : concorde \(05\/10\/2026\)$/)
    expect(f1).toMatchObject({ associable: true, motifAttendu: false, doublons: [], autreCopropriete: false, dejaLieeA: null })
    expect(f5.criteres.map((c) => c.resultat)).toEqual(['concorde', 'concorde', 'concorde', 'inconnu'])
    expect(f5.criteres[0].detail).toBe('même nom, SIRET non comparé ; nom lu en première ligne, non confirmé')
    expect(f5.criteres[3].detail).toBe('date non saisie')
    expect(f3.explication).toMatch(/Numéro : diffère \(n° A-2026-0042 lu, n° B-77 saisi\)/)
    expect(f3.explication).toMatch(/Montant TTC : diffère \(300,00\s€ lu, 120,00\s€ saisi\)/)
    expect(f3.explication).toContain("Date : diffère (05/10/2026 lue, 01/09/2026 saisie (34 jours d'écart))")
    expect(f3.motifAttendu).toBe(true)
  })

  it('écart d’un seul jour : « 1 jour d’écart »', () => {
    const date = comparerPieceEtFacture(identifiee(), facture({ date: '2026-10-06' }))[3]
    expect(date.detail).toBe("05/10/2026 lue, 06/10/2026 saisie (1 jour d'écart)")
  })

  it('pièce « Extrait » sans numéro ni montant TTC lus : critères « inconnu » ; une facture qui ne concorde que sur la date est écartée', () => {
    const piece = extraite('P1', { numero: null, ttc: '' })
    const autre = facture({ id: 'F2', fournisseur: 'Société Beta Nettoyage', siret: '99988877700011', numero: 'N-5' })
    const candidates = proposerFacturesCandidates(piece, { factures: [facture(), autre], pieces: [] })
    expect(candidates.map((c) => [c.factureId, c.criteres.map((k) => k.resultat)])).toEqual([['F1', ['concorde', 'inconnu', 'inconnu', 'concorde']]])
    expect(candidates[0].criteres.map((k) => k.detail).slice(1, 3)).toEqual(['numéro non lu', 'montant TTC non lu'])
  })

  it('une facture déjà liée à une autre pièce reste listée, signalée, non associable', () => {
    const autre = associee('P9', 'F1')
    const [f1] = proposerFacturesCandidates(identifiee(), { factures, pieces: [autre] })
    expect(f1).toMatchObject({ factureId: 'F1', dejaLieeA: 'P9', associable: false })
    expect(f1.explication).toMatch(/déjà liée à la pièce P9 : association refusée$/)
  })

  it('doublon : une autre pièce associée porte la même facture ; signalé comme l’association le refusera', () => {
    const q2 = associee('Q2', 'F9')
    const [f1] = proposerFacturesCandidates(identifiee(), { factures: [facture()], pieces: [q2] })
    expect(f1).toMatchObject({ factureId: 'F1', concordants: 4, dejaLieeA: null, doublons: [{ pieceId: 'Q2', niveau: 'certain' }], associable: false })
    expect(f1.explication).toContain('doublon de la pièce Q2 (même SIRET, même numéro), associée à la facture F9 : association refusée')
    expect(() => associerPiece(identifiee(), { facture: facture(), pieces: [q2], le: J3, motif: 'x' })).toThrow(/Doublon : la pièce Q2/)
  })

  it('doublon probable : la candidate reste associable, avec un motif attendu, comme le décidera l’association', () => {
    const q1 = associee('Q1', 'F10', { numero: '1-12' })
    const q2 = identifiee('Q2', { numero: '11-2' })
    const [f11] = proposerFacturesCandidates(q2, { factures: [facture({ id: 'F11', numero: '11-2' })], pieces: [q1] })
    expect(f11).toMatchObject({ discordants: 0, doublons: [{ pieceId: 'Q1', niveau: 'probable' }], associable: true, motifAttendu: true })
    expect(f11.explication).toMatch(/doublon probable de la pièce Q1 \(même SIRET, numéros aux mêmes caractères, découpés autrement\), associée à la facture F10 : motif attendu$/)
    expect(() => associerPiece(q2, { facture: facture({ id: 'F11', numero: '11-2' }), pieces: [q1], le: J3 })).toThrow(/motif attendu/)
  })

  it('numéro et date absents des deux côtés : « ni lu ni saisi »', () => {
    const piece = extraite('P1', { numero: null, date: null })
    const [, numero, , date] = comparerPieceEtFacture(piece, facture({ numero: null, date: null }))
    expect([numero.detail, date.detail]).toEqual(['numéro ni lu ni saisi', 'date ni lue ni saisie'])
  })

  it('sans copropriété sur la pièce, les factures de toutes les copropriétés sont comparées', () => {
    const piece = identifierPiece(
      extrairePiece(deposee('P2', null), { texteLu: { texte: texteFacture(), origine: 'couche_texte_pdf' }, le: J1 }),
      { le: J2 },
    )
    const f4 = proposerFacturesCandidates(piece, { factures, pieces: [] }).find((c) => c.factureId === 'F4')
    expect(f4).toMatchObject({ autreCopropriete: false, associable: true })
  })

  it('refuse une pièce non lue et une facture en double dans la liste', () => {
    expect(() => proposerFacturesCandidates(deposee(), { factures, pieces: [] })).toThrow(/texte pas encore lu/)
    expect(() => proposerFacturesCandidates(identifiee(), { factures: [facture(), facture()], pieces: [] })).toThrow(/Facture saisie en double/)
  })
})

describe('copropriété de la pièce : rattachement avant l’association', () => {
  it('facture saisie sur une autre copropriété : signalée parmi les candidates, association refusée ; rattachement daté, puis association', () => {
    const piece = identifiee()
    const f20 = facture({ id: 'F20', coproprieteId: 'CP2' })
    const [candidate] = proposerFacturesCandidates(piece, { factures: [f20], pieces: [] })
    expect(candidate).toMatchObject({ factureId: 'F20', autreCopropriete: true, associable: false })
    expect(candidate.explication).toContain("autre copropriété (CP2) : rattacher d'abord la pièce, association refusée")
    expect(() => associerPiece(piece, { facture: f20, pieces: [], le: J3, motif: 'x' })).toThrow(/la facture F20 relève d'une autre copropriété \(CP2\)/)
    expect(() => rattacherPiece(piece, { coproprieteId: 'CP2', motif: ' ', le: J3 })).toThrow(/motif du rattachement attendu/)
    const rattachee = rattacherPiece(piece, { coproprieteId: 'CP2', motif: 'Pièce classée par erreur', le: J3 })
    expect(rattachee).toMatchObject({ statut: 'Identifié', coproprieteId: 'CP2' })
    expect(rattachee.historique.at(-1)).toEqual({
      statut: 'Identifié',
      statutAncien: 'Identifié',
      le: J3,
      motif: 'Rattachement : copropriété CP1 → CP2. Pièce classée par erreur',
    })
    expect(associerPiece(rattachee, { facture: f20, pieces: [], le: J3 }).statut).toBe('Associé')
  })

  it('autre copropriété sans fournisseur et numéro concordants : non listée', () => {
    expect(proposerFacturesCandidates(identifiee(), { factures: [facture({ id: 'F21', coproprieteId: 'CP2', numero: 'Z-1' })], pieces: [] })).toEqual([])
  })

  it('rattachement refusé : même copropriété, pièce associée ou reportée', () => {
    expect(() => rattacherPiece(identifiee(), { coproprieteId: 'CP1', motif: 'x', le: J3 })).toThrow(/déjà rattachée à la copropriété CP1/)
    expect(() => rattacherPiece(deposee('P2', null), { coproprieteId: ' ', motif: 'x', le: J3 })).toThrow(/Pièce P2 : déjà sans copropriété/)
    expect(() => rattacherPiece(associee('P1', 'F1'), { coproprieteId: 'CP2', motif: 'x', le: J3 })).toThrow(/« Associé » : rattachement refusé/)
    const reportee = reporterPiece(identifiee(), { le: J2, motif: 'Attente' })
    expect(() => rattacherPiece(reportee, { coproprieteId: 'CP2', motif: 'x', le: J3 })).toThrow(/« Reporté » : rattachement refusé/)
  })

  it('pièce sans copropriété : elle prend celle de la facture à l’association', () => {
    const piece = identifierPiece(
      extrairePiece(deposee('P2', null), { texteLu: { texte: texteFacture(), origine: 'couche_texte_pdf' }, le: J1 }),
      { le: J2 },
    )
    const liee = associerPiece(piece, { facture: facture({ coproprieteId: 'CP2' }), pieces: [], le: J3 })
    expect(liee).toMatchObject({ statut: 'Associé', coproprieteId: 'CP2' })
    expect(liee.historique.at(-1)?.motif).toBe('Copropriété reprise de la facture : CP2.')
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
    expect(associerPiece(traduirePiece(identifiee(), { imputation: imputationTest(), le: J2 }), { facture: facture(), pieces: [], le: J3 }).statut).toBe('Associé')
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

  it('refuse un doublon certain : autre pièce associée, même SIRET, même numéro (au séparateur près), même avec un motif', () => {
    const autre = associee('P2', 'F7', { numero: 'A/2026/0042' })
    expect(() => associerPiece(identifiee(), { facture: facture(), pieces: [autre], le: J3, motif: 'x' })).toThrow(
      /Doublon : la pièce P2 \(même SIRET, même numéro A-2026-0042\) est déjà associée à la facture F7/,
    )
  })

  it('numéros aux mêmes caractères découpés autrement (« 1-12 », « 11-2 ») : deux numéros différents ; doublon probable, motif exigé, jamais refusé', () => {
    const f10 = facture({ id: 'F10', numero: '1-12', date: '2026-01-05', ttcCentimes: 10_000 })
    const q1 = associerPiece(identifiee('Q1', { numero: '1-12', date: '05/01/2026', ttc: '100,00' }), { facture: f10, pieces: [], le: J3 })
    const q2 = identifiee('Q2', { numero: '11-2', date: '02/11/2026', ttc: '250,00' })
    expect(comparerPieceEtFacture(q2, f10)[1]).toEqual({
      critere: 'numero',
      resultat: 'differe',
      detail: 'n° 11-2 lu, n° 1-12 saisi : mêmes caractères, découpage différent',
    })
    const f11 = facture({ id: 'F11', numero: '11-2', date: '2026-11-02', ttcCentimes: 25_000 })
    expect(() => associerPiece(q2, { facture: f11, pieces: [q1], le: J3 })).toThrow(
      /avec doublon probable de la pièce Q1 \(même SIRET, numéros aux mêmes caractères, découpés autrement\), déjà associée à la facture F10 : motif attendu/,
    )
    const liee = associerPiece(q2, { facture: f11, pieces: [q1], le: J3, motif: 'Deux factures distinctes (séries différentes)' })
    expect(liee).toMatchObject({ statut: 'Associé', factureId: 'F11' })
  })

  it('fournisseur rapproché par le nom seul (pas de SIRET d’un côté) : doublon probable, motif exigé ; noms seulement voisins : aucun doublon', () => {
    const pa = associerPiece(identifiee('PA', { fournisseur: 'ALPHA', numero: '15' }), {
      facture: facture({ id: 'FA', fournisseur: 'Alpha', numero: '15' }),
      pieces: [],
      le: J3,
    })
    const pb = identifierPiece(confirmee(extraite('PB', { fournisseur: 'ALPHA', siret: null, numero: '15' })), { le: J2 })
    const fb = facture({ id: 'FB', fournisseur: 'Alpha', siret: null, numero: '15' })
    expect(() => associerPiece(pb, { facture: fb, pieces: [pa], le: J3 })).toThrow(
      /doublon probable de la pièce PA \(même nom de fournisseur, SIRET non comparé, même numéro\)/,
    )
    expect(associerPiece(pb, { facture: fb, pieces: [pa], le: J3, motif: 'Deux fournisseurs homonymes' }).statut).toBe('Associé')
    const pc = identifierPiece(confirmee(extraite('PC', { fournisseur: 'ALPHA PLOMBERIE', siret: null, numero: '15' })), { le: J2 })
    const fc = facture({ id: 'FC', fournisseur: 'Alpha Plomberie', siret: null, numero: '15' })
    expect(associerPiece(pc, { facture: fc, pieces: [pa], le: J3 })).toMatchObject({ statut: 'Associé', factureId: 'FC' })
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

  it('une date saisie invalide n’est pas une date absente : écart, motif exigé', () => {
    const invalide = facture({ date: '2026-02-31' })
    expect(comparerPieceEtFacture(identifiee(), invalide)[3]).toEqual({ critere: 'date', resultat: 'differe', detail: 'date saisie « 2026-02-31 » invalide' })
    expect(() => associerPiece(identifiee(), { facture: invalide, pieces: [], le: J3 })).toThrow(/Date : date saisie « 2026-02-31 » invalide\) : motif attendu/)
    const liee = associerPiece(identifiee(), { facture: invalide, pieces: [], le: J3, motif: 'Date à corriger sur la facture saisie' })
    expect(liee.historique.at(-1)?.motif).toBe('Date à corriger sur la facture saisie')
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

describe('doublons : paires de pièces qui portent la même facture', () => {
  it('même SIRET et même numéro (casse et séparateur mis à part) : doublon certain', () => {
    const pieces = [extraite('P1'), extraite('P2', { numero: 'a/2026/0042' }), extraite('P3', { numero: 'A-2026-0050' }), deposee('P4')]
    expect(detecterDoublons(pieces)).toEqual([
      {
        pieceIds: ['P1', 'P2'],
        niveau: 'certain',
        numeros: ['A-2026-0042', 'a/2026/0042'],
        message: 'Doublon : pièces P1 et P2, même SIRET, même numéro (A-2026-0042 / a/2026/0042). Une seule peut être associée.',
      },
    ])
  })

  it('le résultat ne dépend pas de l’ordre des pièces, et deux SIRET différents ne sont jamais réunis', () => {
    const p1 = extraite('P1', { fournisseur: 'ALPHA', siret: '111 222 333 00044', numero: 'X-9' })
    const p2 = extraite('P2', { fournisseur: 'ALPHA', siret: '999 888 777 00011', numero: 'X-9' })
    const p3 = extraite('P3', { fournisseur: 'ALPHA', siret: null, numero: 'X-9' })
    const attendu = [
      ['P1', 'P3', 'probable'],
      ['P2', 'P3', 'probable'],
    ]
    for (const ordre of [
      [p1, p2, p3],
      [p3, p1, p2],
      [p2, p3, p1],
    ])
      expect(detecterDoublons(ordre).map((d) => [...d.pieceIds, d.niveau])).toEqual(attendu)
  })

  it('« 1-12 » et « 11-2 » chez le même fournisseur : doublon probable seulement', () => {
    const [doublon] = detecterDoublons([extraite('Q1', { numero: '1-12' }), extraite('Q2', { numero: '11-2' })])
    expect(doublon).toMatchObject({ pieceIds: ['Q1', 'Q2'], niveau: 'probable', numeros: ['1-12', '11-2'] })
    expect(doublon.message).toBe(
      "Doublon probable : pièces Q1 et Q2, même SIRET, numéros aux mêmes caractères, découpés autrement (1-12 / 11-2). À vérifier : associer l'une après l'autre demandera un motif.",
    )
  })

  it('en-tête « FACTURE » pris pour le fournisseur, sans SIRET : doublon probable, jamais certain', () => {
    const pieces = [extraite('PA', { fournisseur: 'FACTURE', siret: null, numero: '12' }), extraite('PB', { fournisseur: 'FACTURE', siret: null, numero: '12' })]
    expect(detecterDoublons(pieces).map((d) => d.niveau)).toEqual(['probable'])
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
