import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  classementDeLImport,
  codeGedDuClassement,
  confirmerClassement,
  suggererClassement,
  type ClassementPiece,
} from '@/lib/administrateur-judiciaire/domain/classement-pieces-ged'
import { NATURE_VENTE_AMIABLE, piecesMutationSyndic, piecesRemiseAcquereur } from '@/lib/administrateur-judiciaire/domain/pieces-mutation-ged'
import {
  controlerPieces,
  DOCUMENTS_EXTRANET,
  documentsExtranetDuPublic,
  documentsObligatoiresSyndicat,
} from '@/lib/administrateur-judiciaire/domain/pieces-obligatoires-ged'
import {
  CODE_A_CONFIRMER_PREFIXE,
  CODE_GED_PREFIXE,
  candidatsDuDocument,
  type ReferenceTypeDocument,
} from '@/lib/administrateur-judiciaire/domain/typologie-documents'

/**
 * Classement d'une pièce importée (point 64 du bilan 2), sous la décision de Hugo du 03/11/2026 : « le classement
 * d'après le texte est une suggestion seulement ». Le texte rend une SUGGESTION (types candidats ordonnés, avec leurs
 * indices), jamais un type sûr ; seuls le gestionnaire (confirmerClassement) et l'import (classementDeLImport)
 * confirment un type ; un document dont le type n'est pas confirmé n'est jamais une pièce présente : « à vérifier ».
 *
 * Les scénarios difficiles des contrôles précédents sont gardés comme tests « jamais sûr » : resultat-64.json (tour 0),
 * resultat-64-tour2.json (tours 1 et 2), resultat-64-refonte.json (contrôle du contrat, de la règle stricte, puis ses
 * « restes », sondes b1 à b6 du dernier contrôle). La suggestion ne retient aucun type, le vrai type (s'il en a un) est
 * parmi les candidats — un sous-type d'ordonnance avant « Ordonnance (autres) », parce que ses mots l'évoquent — et
 * aucune pièce n'est comptée présente.
 */

const tribunal = (type: string): ReferenceTypeDocument => ({ categorie: 'Tribunal', type })
const DESIGNATION = tribunal('Ordonnance de désignation')
const PROLONGATION = tribunal('Ordonnance de prolongation de mission')
const FIN = tribunal('Ordonnance de fin de mission')
const TAXE = tribunal('Ordonnance de taxe')
const EXPROPRIATION = tribunal("Ordonnance d'expropriation")
const AUTRE: ReferenceTypeDocument = { categorie: 'Base', type: 'Ordonnance (autres)' }
const CONVOCATION: ReferenceTypeDocument = { categorie: 'Base', type: "Convocation d'assemblée" }
const PV: ReferenceTypeDocument = { categorie: 'Base', type: "Procès-verbal d'assemblée" }
const ETAT_DATE: ReferenceTypeDocument = { categorie: 'Copropriétaire', type: 'État daté' }
const DEMANDE_ETAT_DATE: ReferenceTypeDocument = { categorie: 'Étude notariale', type: 'Demande pré-état daté / état daté' }
const DEVIS: ReferenceTypeDocument = { categorie: 'Fournisseur', type: 'Devis fournisseur' }
const FACTURE: ReferenceTypeDocument = { categorie: 'Fournisseur', type: 'Facture/avoir fournisseur' }
const INJONCTION: ReferenceTypeDocument = { categorie: 'Mairie', type: 'Injonction de travaux' }
const REGLEMENT: ReferenceTypeDocument = { categorie: 'Étude notariale', type: 'Règlement de copropriété (règlement, modificatifs)' }
const AVIS_DE_MUTATION: ReferenceTypeDocument = { categorie: 'Étude notariale', type: 'Avis de mutation art. 20' }
const CADASTRE: ReferenceTypeDocument = { categorie: 'Base', type: 'Cadastre — relevé de propriété' }
const FACTURE_HONORAIRES: ReferenceTypeDocument = { categorie: 'Base', type: 'Facture/avoir honoraires' }
const DEVIS_PRE_ETAT_DATE: ReferenceTypeDocument = { categorie: 'Base', type: 'Devis pré-état daté' }
const PERIL: ReferenceTypeDocument = { categorie: 'Mairie', type: 'Arrêté de péril' }
const MISE_EN_DEMEURE: ReferenceTypeDocument = { categorie: 'Copropriétaire', type: 'Mise en demeure' }

const cle = (ref: ReferenceTypeDocument): string => `${ref.categorie}|${ref.type}`
const rang = (refs: readonly ReferenceTypeDocument[], ref: ReferenceTypeDocument): number => refs.findIndex((r) => cle(r) === cle(ref))
/** Sous-types que les mots d'une ordonnance évoquent : placés avant « Ordonnance (autres) ». */
const SOUS_TYPES_EVOQUES = new Set([DESIGNATION, PROLONGATION, FIN, TAXE, EXPROPRIATION].map(cle))
/** Indices d'une ordonnance sous l'en-tête TJ : mot-titre, tribunal, administrateur provisoire, RG. */
const INDICES_TJ = ['ordonnance', 'tribunal', 'administrateur provisoire', 'rg']

/** En-tête de juridiction sur ses propres lignes, comme le rend la couche texte d'un PDF. */
const TJ = 'TRIBUNAL JUDICIAIRE DE TOURS\nRG 26/01234\n'
const ENTETE = `TRIBUNAL JUDICIAIRE DE TOURS\nRG 26/01234\nORDONNANCE SUR REQUÊTE\n`
const TJ_PARIS = 'TRIBUNAL JUDICIAIRE DE PARIS\nRG 25/00012'
const AJ = 'SELARL AJ ASSOCIÉS — Maître Jeanne DUPONT, administrateur provisoire'
const AJ_PARIS = 'Maître Claire X\nAdministrateur judiciaire\n12 rue de la Paix 75002 Paris'
const CONVOQUEE = `Convocation à l'assemblée générale. Ordre du jour : 1. Approbation des comptes`
const CORPS_CONVOCATION = `CONVOCATION à l'assemblée générale. Ordre du jour : 1. Approbation des comptes`
const ETAT_DATE_CLAIR = `ÉTAT DATÉ\n(article 5 du décret du 17 mars 1967)\nLot n° 12 — cédant : M. A\nPremière partie : sommes dues par le cédant au syndicat : 1 200 €\nDeuxième partie : sommes dont le syndicat pourrait être débiteur : néant`
const PV_CLAIR = `PROCÈS-VERBAL DE L'ASSEMBLÉE GÉNÉRALE ORDINAIRE DU 12 JUIN 2026\nRésidence Les Tilleuls\nFeuille de présence signée : 12 copropriétaires présents ou représentés.\nRésolution n° 1 : approbation des comptes de l'exercice 2025 — adoptée à la majorité de l'article 24.`
const DEVIS_CLAIR = `DEVIS N° 2026-45\nRavalement de façade : 45 000 € HT, TVA 10 %\nValidité : 3 mois — Bon pour accord`
const NON_CLASSEE = 'Bonjour, voici le compte rendu de la réunion.'
/** Visa banal d'une ordonnance, qui fait du procès-verbal un candidat. */
const VISA_PV = `\nVu le procès-verbal de l'assemblée générale du 12 juin 2026 constatant qu'aucune résolution n'a été adoptée ;\n`
const PORTANT = `${TJ_PARIS}\nORDONNANCE PORTANT DÉSIGNATION D'UN ADMINISTRATEUR PROVISOIRE\nPAR CES MOTIFS,\nDésignons Maître Claire X en qualité d'administrateur provisoire du syndicat des copropriétaires de la Résidence Les Tilleuls pour une durée de douze mois`

const MUTATION = { entiteType: 'mutation', entiteId: 'm1' }
const COPROPRIETE = { entiteType: 'copropriete', entiteId: 'c1' }
const RESERVES = documentsObligatoiresSyndicat({ destinationTotaleAutreQueHabitation: false })
const EXTRANET_CS = documentsExtranetDuPublic('conseil_syndical', { destinationTotaleAutreQueHabitation: false, accesEnLigneEcarteParAg: false })
const LISTES_DE_PIECES = [
  RESERVES,
  DOCUMENTS_EXTRANET,
  piecesMutationSyndic(NATURE_VENTE_AMIABLE),
  piecesRemiseAcquereur({ mode: 'promesse', acquereurDejaCoproprietaire: false, lotAnnexe: false }),
]

const refsDe = (texte: string): ReferenceTypeDocument[] => suggererClassement(texte).candidats.map(({ ref }) => ref)

/** Document rangé dans la GED d'après son classement : code GED, code « à confirmer », sinon son nom de fichier. */
function documentRange(classement: ClassementPiece, entite: { entiteType: string; entiteId: string }, fichier: string) {
  return { id: fichier, ...entite, type: codeGedDuClassement(classement, entite.entiteType) ?? fichier, date: '2026-03-10' }
}

/** Pièces comptées présentes, sur les quatre listes, pour la pièce rangée d'après la suggestion de ce texte. */
function piecesPresentes(texte: string): string[] {
  const document = documentRange(suggererClassement(texte), COPROPRIETE, 'piece.pdf')
  return LISTES_DE_PIECES.flatMap((attendues) => controlerPieces([document], COPROPRIETE, attendues).presentes.map(({ cle }) => cle))
}

/**
 * Jamais sûr : suggestion de la source « texte », sans type retenu ; le vrai type, s'il en a un, parmi les candidats ;
 * un sous-type d'ordonnance, avant « Ordonnance (autres) » (ses mots l'évoquent).
 */
function jamaisSur(texte: string, vrai: ReferenceTypeDocument | null, evocation: Evocation = 'evoque'): void {
  const suggestion = suggererClassement(texte)
  expect(suggestion.source).toBe('texte')
  expect(suggestion).not.toHaveProperty('ref')
  expect(['suggestion', 'non_classe']).toContain(suggestion.statut)
  expect(suggestion.statut === 'non_classe').toBe(suggestion.candidats.length === 0)
  const refs = refsDe(texte)
  if (vrai) expect(refs).toContainEqual(vrai)
  if (vrai && evocation === 'evoque' && SOUS_TYPES_EVOQUES.has(cle(vrai))) expect(rang(refs, vrai)).toBeLessThan(rang(refs, AUTRE))
  expect(piecesPresentes(texte)).toEqual([])
}

/** La pièce `cle` n'est jamais présente : « à vérifier », distincte de « manquante ». */
function pieceAVerifier(texte: string, entite: { entiteType: string; entiteId: string }, attendues: Parameters<typeof controlerPieces>[2], cle: string): void {
  const controle = controlerPieces([documentRange(suggererClassement(texte), entite, 'piece.pdf')], entite, attendues)
  expect(controle.presentes.map((p) => p.cle)).not.toContain(cle)
  expect(controle.aVerifier).toContainEqual({ cle, documentIds: ['piece.pdf'] })
  expect(controle.manquantes.map((p) => p.cle)).not.toContain(cle)
}

/** `non_evoque` : aucun mot du texte n'évoque le sous-type vrai ; il n'est que parmi les candidats. */
type Evocation = 'evoque' | 'non_evoque'
type Cas = [nom: string, texte: string, vrai: ReferenceTypeDocument | null, evocation?: Evocation]

// ── La suggestion ───────────────────────────────────────────────────────────────────────────────────────────────

describe('suggestion d’après le texte : des candidats ordonnés avec leurs indices, jamais un type sûr', () => {
  it('source « texte », statut « suggestion », candidats avec leurs indices (mot-titre d’abord) ; aucun type retenu', () => {
    expect(suggererClassement(DEVIS_CLAIR)).toEqual({
      source: 'texte',
      statut: 'suggestion',
      candidats: [{ ref: DEVIS, indices: ['devis', 'ht', 'tva', 'validite'] }],
    })
  })

  it('ordonnance : tous ses sous-types — ceux que ses mots évoquent (avec leur mot), « Ordonnance (autres) », puis les autres', () => {
    expect(suggererClassement(`${TJ} ORDONNANCE. Désignons Maître Jeanne Dupont en qualité d'administrateur provisoire.`).candidats).toEqual([
      { ref: DESIGNATION, indices: [...INDICES_TJ, 'designons'] },
      { ref: AUTRE, indices: INDICES_TJ },
      { ref: PROLONGATION, indices: INDICES_TJ },
      { ref: FIN, indices: INDICES_TJ },
      { ref: TAXE, indices: INDICES_TJ },
      { ref: EXPROPRIATION, indices: INDICES_TJ },
    ])
    expect(refsDe(`${TJ} ORDONNANCE DE RÉFÉRÉ. PAR CES MOTIFS, Ordonnons la communication des pièces.`)).toEqual([AUTRE, DESIGNATION, PROLONGATION, FIN, TAXE, EXPROPRIATION])
  })

  it('ordre : position de la première occurrence du mot-titre ; sous-types évoqués : position de leur premier mot', () => {
    expect(refsDe(`Devis n° 88 accepté le 3 mars\nFACTURE n° 12 — Total HT 1 000 € — TVA 10 %`)).toEqual([DEVIS, FACTURE])
    expect(refsDe('FACTURE n° 12 — travaux selon devis n° 88 accepté — Total HT 1 000,00 € — TVA 10 % — Net à payer 1 100,00 €')).toEqual([FACTURE, DEVIS])
    expect(refsDe(`${TJ} ORDONNANCE DE TAXE. Maître Y, désignée administrateur provisoire…`)).toEqual([TAXE, DESIGNATION, AUTRE, PROLONGATION, FIN, EXPROPRIATION])
    expect(refsDe(`PROCÈS-VERBAL DE L'ASSEMBLÉE GÉNÉRALE. Résolution n° 4 : modification du règlement de copropriété,\nadoptée à la majorité des voix ; tantièmes des parties communes.`)).toEqual([PV, REGLEMENT])
  })

  it.each([
    ['Commettons Maître X', DESIGNATION],
    ['Nommons Maître X', DESIGNATION],
    ['Ordonnons la nomination de Maître X', DESIGNATION],
    ['Prolongeons la mission', PROLONGATION],
    ['Renouvelons la mission', PROLONGATION],
    ['Ordonnons le maintien de Maître X dans ses fonctions', PROLONGATION],
    ['Maître X est maintenue dans ses fonctions', PROLONGATION],
    ['Ordonnons la poursuite de la mission', PROLONGATION],
    ['Accordons un nouveau délai de six mois', PROLONGATION],
    ['Déchargeons Maître X', FIN],
    ['Constatons l’achèvement de la mission', FIN],
    ['Ordonnons la levée de la mission', FIN],
    ['Prononçons la clôture de la mission', FIN],
    ['Disons que la mission prendra fin le 30 juin', FIN],
    ['Fixons la rémunération de Maître X', TAXE],
    ['Fixons les émoluments de Maître X', TAXE],
    ['Prononçons l’expropriation des lots', EXPROPRIATION],
  ])('« %s » : évoque le sous-type, placé en tête', (decision, sousType) => {
    expect(refsDe(`${TJ} ORDONNANCE. ${decision}, administrateur provisoire.`)[0]).toEqual(sousType)
  })

  it.each([
    'pour une durée de douze mois renouvelable',
    'pour une mission prorogeable une fois',
    'pour 500 € hors taxes par mois',
    'à fin de communication des pièces',
    'et, à cette fin, de convoquer l’assemblée',
    'la société, maintenant dissoute,',
    'le contrat de maintenance de l’ascenseur',
  ])('« %s » : n’évoque aucun sous-type, « Ordonnance (autres) » en tête', (mots) => {
    expect(refsDe(`${TJ} ORDONNANCE. Disons que Maître X, administrateur provisoire, agira ${mots}.`)[0]).toEqual(AUTRE)
  })

  it('aucun candidat (moins de deux indices, ou mot-titre absent) : « non classé »', () => {
    expect(suggererClassement(NON_CLASSEE)).toEqual({ source: 'texte', statut: 'non_classe', candidats: [] })
    expect(suggererClassement('Facture').statut).toBe('non_classe')
    expect(suggererClassement('Montant HT et TVA').statut).toBe('non_classe')
    expect(suggererClassement('Pré-état daté — informations financières du cédant (article 5 du décret du 17 mars 1967)').statut).toBe('non_classe')
  })

  it('pièce du mandat sans son mot-titre dans le texte (une requête au tribunal) : pas d’ordonnance candidate', () => {
    expect(refsDe(`REQUÊTE — Tribunal judiciaire de Tours — RG 26/01234\nMaître X, administrateur provisoire, a l'honneur d'exposer…`)).toEqual([])
  })

  it('un indice ne compte que hors du mot-titre : « état descriptif de division » seul ne fait pas un règlement', () => {
    expect(refsDe('Les lots n° 3 et 4 figurent à l’état descriptif de division.')).toEqual([])
    expect(refsDe('Les lots n° 3 et 4 figurent à l’état descriptif de division (120/1000 tantièmes).')).toEqual([REGLEMENT])
  })

  it.each([
    ['« désigné par ordonnance du … »', 'Maître X, administrateur provisoire désigné par ordonnance du tribunal judiciaire de Tours (RG 26/01234)'],
    ['« (ordonnance du …) »', 'Maître X, administrateur provisoire (ordonnance du tribunal judiciaire de Tours du 2 mars 2025, RG 25/01234)'],
    ['« Ordonnance de prorogation du … »', 'Maître X, administrateur provisoire\nOrdonnance de prorogation du 2 mars 2026 (RG 25/01234)'],
    ['« Ordonnance de fin de mission du … »', 'Maître X, administrateur provisoire\nOrdonnance de fin de mission du 2 mars 2026 (RG 25/01234)'],
    ['« Ordonnance du tribunal … du … »', 'Maître X, administrateur provisoire\nOrdonnance du tribunal judiciaire de Tours du 2 mars 2025, RG 25/01234'],
    ['« en vertu d’une ordonnance »', 'Maître X, administrateur provisoire du syndicat en vertu d’une ordonnance du tribunal judiciaire de Tours, RG 25/01234'],
    ['« suivant ordonnance »', 'Maître X, agissant en qualité d’administrateur provisoire suivant ordonnance du tribunal judiciaire de Tours (RG 25/01234)'],
    ['« Réf. : ordonnance … », sans date', 'Réf. : ordonnance du tribunal judiciaire de Tours, RG 25/01234 — Maître X, administrateur provisoire'],
    ['« Ordonnance du tribunal … en date du 1er … »', 'Maître X, administrateur provisoire\nOrdonnance du tribunal de grande instance de Tours en date du 1er mars 2019'],
    // Restes du contrôle (sonde c5-regression) : désignée par sa juridiction et son siège, sans date.
    ['« (ordonnance du tribunal … , RG …) », sans date', 'Maître X, administrateur provisoire (ordonnance du tribunal judiciaire de Tours, RG 25/01234)'],
    ['« Ordonnance du tribunal …, RG … », sans date', 'Maître X, administrateur provisoire\nOrdonnance du tribunal judiciaire de Tours, RG 25/01234'],
    ['« Ordonnance de désignation du tribunal … (RG …) », sans date', 'Maître X, administrateur provisoire\nOrdonnance de désignation du tribunal judiciaire de Tours (RG 25/01234)'],
    ['« Ordonnance du Président du tribunal … », sans date', 'Maître X, administrateur provisoire\nOrdonnance du Président du tribunal judiciaire de Tours, RG 25/01234'],
    ['« Ordonnance de prorogation du tribunal … », sans date', 'Maître X, administrateur provisoire\nOrdonnance de prorogation du tribunal judiciaire de Tours, RG 25/01234'],
    ['« — Ordonnance du TJ de Tours — », sans date', 'SELARL AJ — Maître X, administrateur provisoire — Ordonnance du TJ de Tours — RG 25/01234'],
    ['« Ordonnance du juge des référés du tribunal … », sans date', 'Maître X, administrateur provisoire\nOrdonnance du juge des référés du tribunal judiciaire de Tours, RG 25/01234'],
    ['« Ordonnance du tribunal de grande instance de Tours », sans date ni RG', 'Maître X, administrateur provisoire\nOrdonnance du tribunal de grande instance de Tours'],
  ])('ligne de qualité de l’AJ %s : l’ordonnance citée reste candidate, après le vrai type', (_cas, qualite) => {
    const refs = refsDe(`${qualite}\n${CORPS_CONVOCATION}`)
    expect(refs[0]).toEqual(CONVOCATION)
    expect(new Set(refs.slice(1).map(cle))).toEqual(new Set([DESIGNATION, AUTRE, PROLONGATION, FIN, TAXE, EXPROPRIATION].map(cle)))
    expect(refs).toHaveLength(7)
    jamaisSur(`${qualite}\n${CORPS_CONVOCATION}`, CONVOCATION)
  })

  it('reste du contrôle : facture de l’AP sous « (ordonnance du TJ de Tours, RG …) », sans date : la facture en tête, l’ordonnance citée après', () => {
    const texte = `Maître X, administrateur provisoire (ordonnance du TJ de Tours, RG 25/01234)\nObjet : Facture n° 12 — Total HT 1 000 € — TVA 10 %`
    const refs = refsDe(texte)
    expect(refs[0]).toEqual(FACTURE)
    expect(refs).toHaveLength(7)
    jamaisSur(texte, FACTURE)
  })

  // Reste du contrôle (sondes m4-reste et m3-variantes) : lignes de qualité datées d'un mois abrégé, d'un « 1 er » de la
  // couche texte d'un PDF, d'un jour de la semaine ou d'une date chiffrée année d'abord ; ordonnance « sur requête » ;
  // magistrat autre que « président » ou « juge des référés » devant la juridiction. Le vrai type en tête, pas au 7e rang.
  it.each([
    ['« du 2 sept. 2025 », mois abrégé', 'Ordonnance de désignation du 2 sept. 2025'],
    ['« du 15 févr. 2026, RG … », mois abrégé', 'Ordonnance de désignation du 15 févr. 2026, RG 26/00045'],
    ['« du 1 er mars 2026 », couche texte d’un PDF où « er » est en exposant', 'Ordonnance de désignation du 1 er mars 2026'],
    ['« du 1er sept. 2025 »', 'Ordonnance du 1er sept. 2025'],
    ['« du lundi 2 mars 2026 », jour de la semaine', 'Ordonnance de désignation du lundi 2 mars 2026'],
    ['date chiffrée année d’abord', 'Ordonnance de désignation du 2026-03-02'],
    ['« Ordonnance sur requête du 2 mars 2026 »', 'Ordonnance sur requête du 2 mars 2026'],
    ['« du premier vice-président du TJ de Tours »', 'Ordonnance du premier vice-président du TJ de Tours, RG 25/01234'],
    ['« du vice-président du tribunal judiciaire de Tours »', 'Ordonnance du vice-président du tribunal judiciaire de Tours, RG 25/01234'],
    ['« du magistrat délégué par le président du TJ de Tours »', 'Ordonnance du magistrat délégué par le président du TJ de Tours'],
    ['« de la Présidente du tribunal judiciaire de Tours »', 'Ordonnance de la Présidente du tribunal judiciaire de Tours, RG 25/01234'],
    ['« de M. le Président du TJ de Tours »', 'Ordonnance de M. le Président du TJ de Tours, RG 25/01234'],
    ['« de désignation du juge délégué … »', 'Ordonnance de désignation du juge délégué par la première vice-présidente du TJ de Tours'],
  ])('reste du contrôle : ligne de qualité %s : l’ordonnance citée passe après la convocation', (_cas, qualite) => {
    const texte = `Maître X, administrateur provisoire\n${qualite}\n${CORPS_CONVOCATION}`
    const refs = refsDe(texte)
    expect(refs[0]).toEqual(CONVOCATION)
    expect(refs).toHaveLength(7)
    jamaisSur(texte, CONVOCATION)
  })

  it.each(['janv.', 'févr.', 'fév.', 'avr.', 'juil.', 'juill.', 'sept.', 'oct.', 'nov.', 'déc.'])(
    'reste du contrôle : « Ordonnance de prorogation du 2 %s 2025 », chaque mois abrégé est une date',
    (mois) => {
      const texte = `Maître X, administrateur provisoire\nOrdonnance de prorogation du 2 ${mois} 2025, RG 25/01234\n${CORPS_CONVOCATION}`
      expect(refsDe(texte)[0]).toEqual(CONVOCATION)
      jamaisSur(texte, CONVOCATION)
    },
  )

  it.each([
    ['« Ordonnance du 12 janv. 2026 »', 'Ordonnance du 12 janv. 2026'],
    ['« Ordonnance de référé du 4 déc. 2025 »', 'Ordonnance de référé du 4 déc. 2025'],
  ])('reste du contrôle : facture de l’AP sous %s : la facture en tête, l’ordonnance citée après', (_cas, qualite) => {
    const texte = `Maître X, administrateur provisoire\n${qualite}\nObjet : Facture n° 12 — Total HT 1 000 € — TVA 10 %`
    const refs = refsDe(texte)
    expect(refs[0]).toEqual(FACTURE)
    expect(refs).toHaveLength(7)
    jamaisSur(texte, FACTURE)
  })

  it.each([
    [
      '« ORDONNANCE DU PREMIER PRÉSIDENT » (cour d’appel)',
      `COUR D'APPEL D'ORLÉANS\nRG 26/00045\nORDONNANCE DU PREMIER PRÉSIDENT${VISA_PV}Statuant sur le recours contre l'ordonnance de taxe, taxons les honoraires de Maître X, administrateur provisoire, à 3 500 € HT.`,
      TAXE,
    ],
    ['« … DU PREMIER MANDAT »', `${TJ}ORDONNANCE DE PROROGATION DU PREMIER MANDAT${VISA_PV}Prorogeons la mission de Maître X, administrateur provisoire.`, PROLONGATION],
    [
      '« … DU 1ER ADMINISTRATEUR PROVISOIRE »',
      `${TJ}ORDONNANCE DE REMPLACEMENT DU 1ER ADMINISTRATEUR PROVISOIRE${VISA_PV}Désignons Maître Y, administrateur provisoire, en remplacement de Maître X.`,
      DESIGNATION,
    ],
    ['« … DU 2E ADMINISTRATEUR PROVISOIRE »', `${TJ}ORDONNANCE DE DÉSIGNATION DU 2E ADMINISTRATEUR PROVISOIRE${VISA_PV}Désignons Maître X, administrateur provisoire.`, DESIGNATION],
    [
      '« … DU 1 ER ADMINISTRATEUR PROVISOIRE » (couche texte d’un PDF)',
      `${TJ}ORDONNANCE DE REMPLACEMENT DU 1 ER ADMINISTRATEUR PROVISOIRE${VISA_PV}Désignons Maître Y, administrateur provisoire, en remplacement de Maître X.`,
      DESIGNATION,
    ],
    [
      '« ORDONNANCE DU JUGE DE L’EXPROPRIATION DU DÉPARTEMENT … »',
      `${TJ}ORDONNANCE DU JUGE DE L'EXPROPRIATION DU DÉPARTEMENT D'INDRE-ET-LOIRE${VISA_PV}Prononçons l'expropriation des parcelles, au profit de la commune.`,
      EXPROPRIATION,
    ],
  ])('reste du contrôle : titre %s, « du » suivi d’un ordinal n’est pas une date : l’ordonnance garde sa place, en tête', (_titre, texte, sousType) => {
    expect(refsDe(texte)[0]).toEqual(sousType)
    jamaisSur(texte, sousType)
  })

  it.each([
    ['« ORDONNANCE DE PROROGATION »', `ORDONNANCE DE PROROGATION\nProrogeons la mission de Maître X, administrateur provisoire ; Convocation de l'assemblée générale dans les six mois.`, PROLONGATION],
    ['« ORDONNANCE DE PROROGATION DE MANDAT »', `ORDONNANCE DE PROROGATION DE MANDAT${VISA_PV}Prorogeons la mission de Maître X, administrateur provisoire.`, PROLONGATION],
    ['« ORDONNANCE DE PROROGATION DU MANDAT »', `ORDONNANCE DE PROROGATION DU MANDAT${VISA_PV}Prorogeons la mission de Maître X, administrateur provisoire.`, PROLONGATION],
    ['« ORDONNANCE DE DÉSIGNATION DU SYNDIC JUDICIAIRE »', `ORDONNANCE DE DÉSIGNATION DU SYNDIC JUDICIAIRE${VISA_PV}Désignons Maître X en qualité de syndic judiciaire.`, DESIGNATION],
    [
      '« ORDONNANCE DE PROROGATION DU MANDAT DE L’ADMINISTRATEUR PROVISOIRE », qui fait convoquer l’assemblée',
      `ORDONNANCE DE PROROGATION DU MANDAT DE L'ADMINISTRATEUR PROVISOIRE\nPAR CES MOTIFS,\nProrogeons pour douze mois la mission de Maître X, administrateur provisoire, qui procédera à la convocation de l'assemblée générale, ordre du jour : désignation d'un syndic.`,
      PROLONGATION,
    ],
    ['« ORDONNANCE DU PRÉSIDENT DU TRIBUNAL JUDICIAIRE », sans siège', `ORDONNANCE DU PRÉSIDENT DU TRIBUNAL JUDICIAIRE${VISA_PV}Désignons Maître X, administrateur provisoire.`, DESIGNATION],
    ['« ORDONNANCE DU PRÉSIDENT DU TRIBUNAL DE GRANDE INSTANCE », sans siège', `ORDONNANCE DU PRÉSIDENT DU TRIBUNAL DE GRANDE INSTANCE${VISA_PV}Désignons Maître X, administrateur provisoire.`, DESIGNATION],
  ])('titre net %s (« du » devant un nom n’en fait pas une citation) : l’ordonnance garde sa place, en tête', (_titre, corps, sousType) => {
    expect(refsDe(`${TJ}${corps}`)[0]).toEqual(sousType)
    jamaisSur(`${TJ}${corps}`, sousType)
  })

  it.each([
    ['« Ordonnance du 2 mars 2026 »', `Ordonnance du 2 mars 2026\nDésignons Maître X, administrateur provisoire, qui adressera la convocation à l'assemblée générale.`, [CONVOCATION, DESIGNATION]],
    [
      '« ORDONNANCE DE TAXE DU 3 NOVEMBRE 2026 »',
      `ORDONNANCE DE TAXE DU 3 NOVEMBRE 2026\nTaxons les honoraires de Maître X, administrateur provisoire, à 4 000 € HT, au vu de la facture d'honoraires n° 12.`,
      [FACTURE_HONORAIRES, FACTURE, TAXE],
    ],
    ['« ORDONNANCE DE RÉFÉRÉ DU 3 NOVEMBRE 2026 »', `ORDONNANCE DE RÉFÉRÉ DU 3 NOVEMBRE 2026${VISA_PV}Ordonnons la communication des pièces.`, [PV, AUTRE]],
    ['« … DU PREMIER MARS 2026 »', `ORDONNANCE DE PROROGATION DU PREMIER MARS 2026${VISA_PV}Prorogeons la mission de Maître X, administrateur provisoire.`, [PV, PROLONGATION]],
    [
      '« ORDONNANCE DU PRÉSIDENT DU TRIBUNAL JUDICIAIRE DE TOURS », titrée par sa juridiction et son siège',
      `ORDONNANCE DU PRÉSIDENT DU TRIBUNAL JUDICIAIRE DE TOURS${VISA_PV}Désignons Maître X, administrateur provisoire.`,
      [PV, DESIGNATION],
    ],
    ['« ORDONNANCE DE DÉSIGNATION DU 2 SEPT. 2025 », mois abrégé', `ORDONNANCE DE DÉSIGNATION DU 2 SEPT. 2025${VISA_PV}Désignons Maître X, administrateur provisoire.`, [PV, DESIGNATION]],
    [
      '« ORDONNANCE DU VICE-PRÉSIDENT DU TRIBUNAL JUDICIAIRE DE TOURS »',
      `ORDONNANCE DU VICE-PRÉSIDENT DU TRIBUNAL JUDICIAIRE DE TOURS${VISA_PV}Désignons Maître X, administrateur provisoire.`,
      [PV, DESIGNATION],
    ],
  ])('🔵 limite : titrée par sa date ou sa juridiction (%s), l’ordonnance se lit comme une citation et passe après les autres', (_titre, corps, tete) => {
    expect(refsDe(`${TJ}${corps}`).slice(0, tete.length)).toEqual(tete)
    // Le vrai type, dernier de `tete` : le premier sous-type de l'ordonnance, derrière les autres candidats.
    jamaisSur(`${TJ}${corps}`, tete.at(-1) ?? null)
  })

  it.each([
    ['« Ordonnance de désignation, RG … »', 'Maître X, administrateur provisoire\nOrdonnance de désignation, RG 25/01234'],
    ['« Ordonnance RG … du … »', 'Maître X, administrateur provisoire\nOrdonnance RG 25/01234 du 2 mars 2025'],
    ['« Ordonnance de désignation : TJ Tours, 2 mars 2026, RG … »', 'Maître X, administrateur provisoire\nOrdonnance de désignation : TJ Tours, 2 mars 2026, RG 25/01234'],
    ['« Ordonnance du Président du tribunal judiciaire, RG … », sans siège', 'Maître X, administrateur provisoire\nOrdonnance du Président du tribunal judiciaire, RG 25/01234'],
    [
      'plus de deux mots d’objet avant « du »',
      'Maître X, administrateur provisoire\nOrdonnance de désignation d’un administrateur provisoire du tribunal judiciaire de Tours, RG 25/01234',
    ],
    ['« Ordonnance n° … du … », numéro avant « du »', 'Maître X, administrateur provisoire\nOrdonnance n° 26/00045 du 2 mars 2026'],
    ['« Ordonnance rendue le … », date sans « du »', 'Maître X, administrateur provisoire\nOrdonnance rendue le 2 mars 2026, RG 25/01234'],
    [
      'magistrat hors de la liste (« juge de la mise en état »)',
      'Maître X, administrateur provisoire\nOrdonnance du juge de la mise en état du tribunal judiciaire de Tours, RG 25/01234',
    ],
  ])('🔵 limite : ligne de qualité sans déterminant, ni date, ni siège (%s) : l’ordonnance en tête, le vrai type après ses six sous-types', (_cas, qualite) => {
    const texte = `${qualite}\n${CORPS_CONVOCATION}`
    expect(rang(refsDe(texte), CONVOCATION)).toBe(6)
    jamaisSur(texte, CONVOCATION)
  })
})

/** Documents clairs : sous l'ancien contrat, « sûrs ». Le bon type vient en tête de la suggestion, et rien n'est sûr. */
const DOCUMENTS_CLAIRS: Cas[] = [
  [
    'ordonnance de désignation au titre net',
    `TRIBUNAL JUDICIAIRE DE TOURS\nRG 26/01234\nORDONNANCE PORTANT DÉSIGNATION D'UN ADMINISTRATEUR PROVISOIRE\nVu la requête du syndicat des copropriétaires ;\nVu l'article 29-1 de la loi du 10 juillet 1965 ;\nPAR CES MOTIFS\nDésignons Maître Jeanne DUPONT, administrateur judiciaire, en qualité d'administrateur provisoire du syndicat des copropriétaires pour une durée de douze mois renouvelable.\nFait à Tours, le 2 mars 2026.`,
    DESIGNATION,
  ],
  [
    'ordonnance de prolongation au titre net',
    `${ENTETE.replace('SUR REQUÊTE', 'DE PROLONGATION DE MISSION')}Vu notre ordonnance du 3 mars 2025 ;\nPAR CES MOTIFS\nProrogeons pour douze mois la mission de Maître X, administrateur provisoire du syndicat.`,
    PROLONGATION,
  ],
  [
    'ordonnance de taxe au titre net',
    `TRIBUNAL JUDICIAIRE DE TOURS\nRG 26/01234\nORDONNANCE DE TAXE\nVu la requête de Maître Y, administrateur provisoire ;\nTaxons les honoraires de Maître Y, administrateur provisoire, à la somme de 4 000 € HT.`,
    TAXE,
  ],
  [
    'ordonnance de fin de mission au titre net',
    `TRIBUNAL JUDICIAIRE DE TOURS\nRG 26/01234\nORDONNANCE DE FIN DE MISSION\nPAR CES MOTIFS\nMettons fin à la mission de Maître Y, administrateur provisoire.`,
    FIN,
  ],
  [
    'ordonnance d’expropriation',
    `${TJ} ORDONNANCE D'EXPROPRIATION. PAR CES MOTIFS, Prononçons l'expropriation des lots n° 3 et 4 au profit de la commune de Tours.`,
    EXPROPRIATION,
  ],
  [
    'ordonnance de référé étrangère à la mission',
    `TRIBUNAL JUDICIAIRE DE TOURS\nORDONNANCE DE RÉFÉRÉ — RG 26/1 — PAR CES MOTIFS, Ordonnons la communication des pièces ; Laissons les dépens à la charge du demandeur.`,
    AUTRE,
  ],
  ['procès-verbal d’assemblée', PV_CLAIR, PV],
  [
    'convocation d’assemblée',
    `CONVOCATION À L'ASSEMBLÉE GÉNÉRALE ORDINAIRE\nMadame, Monsieur, vous êtes convoqué(e) à l'assemblée générale qui se tiendra le 12 juin 2026 à 18 heures.\nOrdre du jour : 1. Approbation des comptes ; 2. Budget prévisionnel.`,
    CONVOCATION,
  ],
  ['état daté', ETAT_DATE_CLAIR, ETAT_DATE],
  ['devis', DEVIS_CLAIR, DEVIS],
  ['facture', 'FACTURE n° 2026-14 — Total HT 1 000,00 € — TVA 10 % — Net à payer 1 100,00 €', FACTURE],
  ['demande d’état daté', "DEMANDE D'ÉTAT DATÉ (article 5 du décret du 17 mars 1967). Maître Y, notaire. Vente du lot 12.", DEMANDE_ETAT_DATE],
  [
    'ordonnance de prolongation, décision à forme nominale',
    `${ENTETE.replace('SUR REQUÊTE', 'DE PROROGATION')}PAR CES MOTIFS\nOrdonnons la prorogation de la mission de l'administrateur provisoire pour douze mois.`,
    PROLONGATION,
  ],
  [
    'ordonnance de taxe, « Fixons … les honoraires de l’administrateur provisoire »',
    `${ENTETE.replace('SUR REQUÊTE', 'DE TAXE')}PAR CES MOTIFS\nFixons à la somme de 4 000 € HT les honoraires de l'administrateur provisoire.`,
    TAXE,
  ],
  [
    'D1 « à fin de désignation » dans le titre',
    `${TJ_PARIS}\nORDONNANCE SUR REQUÊTE À FIN DE DÉSIGNATION D'UN ADMINISTRATEUR PROVISOIRE\nPAR CES MOTIFS,\nDésignons Maître Claire X en qualité d'administrateur provisoire du syndicat des copropriétaires de la Résidence Les Tilleuls pour une durée de douze mois.`,
    DESIGNATION,
  ],
  [
    'D2 « à cette fin »',
    `${PORTANT}, avec mission de prendre les mesures nécessaires au rétablissement du fonctionnement normal de la copropriété et, à cette fin, d'administrer le syndicat.`,
    DESIGNATION,
  ],
  ['D3 « immédiatement »', `${PORTANT} ; Disons qu'elle entrera immédiatement en fonctions.`, DESIGNATION],
  ['D4 « expertise »', `${PORTANT} ; Disons qu'elle pourra recourir à toute expertise utile.`, DESIGNATION],
  ['F2 « expert-comptable »', `${PORTANT} ; Disons qu'elle pourra se faire assister d'un expert-comptable.`, DESIGNATION],
  ['F3 « de façon immédiate »', `${PORTANT} ; Rappelons que la présente ordonnance est exécutoire de façon immédiate.`, DESIGNATION],
  ['F4 témoin sans mot parasite', `${PORTANT}.`, DESIGNATION],
  [
    'C10 désignation, visa « Requête présentée le … »',
    `TRIBUNAL JUDICIAIRE DE TOURS\nRG 26/01234\nORDONNANCE PORTANT DÉSIGNATION D'UN ADMINISTRATEUR PROVISOIRE\nRequête présentée le 12 février 2026 par le syndicat des copropriétaires.\nPAR CES MOTIFS\nDésignons Maître Jeanne DUPONT en qualité d'administrateur provisoire du syndicat des copropriétaires pour une durée de douze mois.`,
    DESIGNATION,
  ],
  [
    'H10 désignation sur requête, 3e personne, sans PAR CES MOTIFS',
    `${TJ_PARIS}\nORDONNANCE SUR REQUÊTE\nLe président du tribunal judiciaire,\nVu la requête présentée par M. A, copropriétaire,\nVu l'article 29-1 de la loi du 10 juillet 1965,\nDésigne Maître Claire X en qualité d'administrateur provisoire du syndicat des copropriétaires de la Résidence Les Tilleuls pour une durée de douze mois.`,
    DESIGNATION,
  ],
  [
    'H11 taxe des honoraires de l’AP',
    `${TJ_PARIS}\nORDONNANCE DE TAXE\nVu la requête de Maître Claire X, administrateur provisoire,\nPAR CES MOTIFS,\nTaxons à la somme de 6 000 € HT les honoraires de Maître Claire X, administrateur provisoire du syndicat des copropriétaires de la Résidence Les Tilleuls.`,
    TAXE,
  ],
  [
    'prorogation, « PAR CES MOTIFS : » puis la décision',
    `${TJ_PARIS}\nORDONNANCE DE PROROGATION\nPAR CES MOTIFS :\nProrogeons pour douze mois la mission de Maître Claire X, administrateur provisoire.`,
    PROLONGATION,
  ],
  [
    'prorogation, « PAR CES MOTIFS : » puis la décision sur la même ligne',
    `${TJ_PARIS}\nORDONNANCE DE PROROGATION\nPAR CES MOTIFS : Prorogeons pour douze mois la mission de Maître Claire X, administrateur provisoire.`,
    PROLONGATION,
  ],
  [
    'prorogation, « Statuant publiquement … : » puis la décision',
    `${TJ_PARIS}\nORDONNANCE DE PROROGATION\nPAR CES MOTIFS,\nStatuant publiquement, par ordonnance contradictoire et en premier ressort :\nProrogeons pour douze mois la mission de Maître Claire X, administrateur provisoire.`,
    PROLONGATION,
  ],
  [
    'prorogation, ligne du dispositif « Maître Claire X, administrateur judiciaire, »',
    `${TJ_PARIS}\nORDONNANCE DE PROROGATION\nPAR CES MOTIFS,\nProrogeons pour douze mois la mission de\nMaître Claire X, administrateur judiciaire,\nen qualité d'administrateur provisoire du syndicat des copropriétaires.`,
    PROLONGATION,
  ],
  [
    'prorogation, visa « Vu l’ordonnance … modifiée par ordonnance rectificative »',
    `${TJ_PARIS}\nORDONNANCE DE PROROGATION\nVu l'ordonnance du 3 mars 2025, modifiée par ordonnance rectificative du 12 mars 2025,\nPAR CES MOTIFS,\nProrogeons pour douze mois la mission de Maître Claire X, administrateur provisoire.`,
    PROLONGATION,
  ],
  [
    'prorogation de la mission de la SELARL, administrateur provisoire',
    `${TJ_PARIS}\nORDONNANCE DE PROROGATION\nPAR CES MOTIFS,\nProrogeons pour douze mois la mission de la SELARL AJ ASSOCIÉS, administrateur provisoire.`,
    PROLONGATION,
  ],
  [
    'prorogation de la mission de « la SELARL …, prise en la personne de Maître X, administrateur provisoire »',
    `${TJ_PARIS}\nORDONNANCE DE PROROGATION\nPAR CES MOTIFS,\nProrogeons pour douze mois la mission de la SELARL AJ ASSOCIÉS, prise en la personne de Maître Jeanne DUPONT, administrateur provisoire.`,
    PROLONGATION,
  ],
  [
    '« prise en qualité d’administrateur judiciaire, comme administrateur provisoire »',
    `${TJ_PARIS}\nORDONNANCE\nPAR CES MOTIFS,\nDésignons Maître Jeanne Dupont, prise en qualité d'administrateur judiciaire, comme administrateur provisoire du syndicat des copropriétaires.`,
    DESIGNATION,
  ],
  [
    '« Désignons Maître X, pour une durée de douze mois, en qualité d’administrateur provisoire »',
    `${TJ_PARIS}\nORDONNANCE\nPAR CES MOTIFS,\nDésignons Maître Jeanne Dupont, pour une durée de douze mois, en qualité d'administrateur provisoire du syndicat des copropriétaires.`,
    DESIGNATION,
  ],
  [
    'ordonnance de référé sous un en-tête de juridiction sur quatre lignes',
    `TRIBUNAL JUDICIAIRE DE PARIS\nService des référés\nChambre 1\nN° RG 26/00042 - N° Portalis 35L7-V-B7K-C1234\nORDONNANCE DE RÉFÉRÉ\nPAR CES MOTIFS,\nOrdonnons la communication des pièces ; Laissons les dépens à la charge du demandeur.`,
    AUTRE,
  ],
  [
    'procès-verbal sous une ligne « Résidence … »',
    `Résidence Les Tilleuls\nPROCÈS-VERBAL DE L'ASSEMBLÉE GÉNÉRALE ORDINAIRE DU 12 JUIN 2026\nFeuille de présence : 12 copropriétaires présents ou représentés.\nRésolution n° 1 : approbation des comptes, adoptée.`,
    PV,
  ],
  [
    'prorogation de la mission de « Maître X, administrateur judiciaire, désignée en qualité d’administrateur provisoire »',
    `${TJ_PARIS}\nORDONNANCE DE PROROGATION\nPAR CES MOTIFS,\nProrogeons pour douze mois la mission de Maître Jeanne DUPONT, administrateur judiciaire, désignée en qualité d'administrateur provisoire par ordonnance du 3 mars 2025.`,
    PROLONGATION,
  ],
  [
    'fin de mission sous un en-tête de juridiction, de référence et de date',
    `\nTRIBUNAL JUDICIAIRE DE PARIS\nRG 25/01234 — Minute n° 26/45\nParis, le 3 mars 2026\n\nORDONNANCE DE FIN DE MISSION\nPAR CES MOTIFS,\nMettons fin à la mission de Maître Claire X, administrateur provisoire.`,
    FIN,
  ],
  [
    'C3 procès-verbal, intertitre « Résolution n° 5 - Devis de ravalement »',
    `PROCÈS-VERBAL DE L'ASSEMBLÉE GÉNÉRALE ORDINAIRE DU 12 JUIN 2026\nFeuille de présence : 12 copropriétaires présents ou représentés.\nRésolution n° 5 - Devis de ravalement\nL'assemblée générale approuve le devis de l'entreprise Martin. Résolution adoptée.`,
    PV,
  ],
  [
    'C2 convocation, annexes « - Devis de l’entreprise Martin »',
    `CONVOCATION À L'ASSEMBLÉE GÉNÉRALE ORDINAIRE\nLes copropriétaires sont convoqués à l'assemblée générale qui se tiendra le 12 juin 2026 à 18 heures.\nOrdre du jour : 1. Approbation des comptes ; 2. Travaux de ravalement.\nDocuments joints :\n- Devis de l'entreprise Martin\n- Formulaire de vote par correspondance`,
    CONVOCATION,
  ],
  [
    'facture sous l’en-tête de son émetteur (raison sociale, adresse, date)',
    `SARL Plomberie Durand\n12 rue des Lilas 75011 Paris\nTours, le 3 mars 2026\nFACTURE N° F-2026-14\nTotal HT 1 000,00 € — TVA 10 % — Net à payer 1 100,00 €`,
    FACTURE,
  ],
  [
    'convocation suivie de « Madame, Monsieur, »',
    `CONVOCATION À L'ASSEMBLÉE GÉNÉRALE ORDINAIRE\nMadame, Monsieur,\nVous êtes convoqué(e) à l'assemblée générale qui se tiendra le 12 juin 2026 à 18 heures.\nOrdre du jour : 1. Approbation des comptes ; 2. Travaux de ravalement.`,
    CONVOCATION,
  ],
  [
    '« ÉTAT DATÉ : lot n° 12 »',
    `ÉTAT DATÉ : lot n° 12 — cédant : M. A\nÉtabli en application de l'article 5 du décret du 17 mars 1967\nPremière partie : sommes dues par le cédant au syndicat.`,
    ETAT_DATE,
  ],
]

describe('documents clairs : le bon type en tête de la suggestion, et pourtant jamais sûrs', () => {
  it.each(DOCUMENTS_CLAIRS)('%s', (_nom, texte, vrai) => {
    jamaisSur(texte, vrai)
    expect(refsDe(texte)[0]).toEqual(vrai)
  })
})

// ── Scénarios difficiles des tours précédents : jamais sûrs ───────────────────────────────────────────────────────

const TOUR_0: Cas[] = [
  [
    'R1 SELARL prise en la personne de…, puis « pourra solliciter la prorogation »',
    `${TJ} ORDONNANCE SUR REQUÊTE. PAR CES MOTIFS, Désignons la SELARL AJ ASSOCIÉS, prise en la personne de Maître Jeanne DUPONT, administrateur judiciaire, demeurant 12 rue Nationale 37000 TOURS, en qualité d'administrateur provisoire du syndicat des copropriétaires pour une durée de douze mois ; Disons que l'administrateur provisoire pourra solliciter la prorogation de sa mission.`,
    DESIGNATION,
  ],
  [
    'R1 motif : défaut de renouvellement du mandat du syndic',
    `${TJ} ORDONNANCE SUR REQUÊTE. Vu la requête aux fins de voir désigner un administrateur provisoire ; Attendu que l'assemblée générale n'a pas procédé au renouvellement du mandat du syndic ; Désignons Maître Jeanne Dupont en qualité d'administrateur provisoire du syndicat des copropriétaires pour une durée de douze mois.`,
    DESIGNATION,
  ],
  [
    'R1 motif : le mandat du syndic prend fin',
    `${TJ} ORDONNANCE. Attendu que le mandat du syndic prend fin le 30 juin 2025 sans qu'un nouveau syndic ait été désigné ; Désignons Maître Jeanne Dupont en qualité d'administrateur provisoire du syndicat.`,
    DESIGNATION,
  ],
  [
    'R1 « Le président désigne en qualité de… »',
    `${TJ} ORDONNANCE. Le président désigne en qualité d'administrateur provisoire du syndicat des copropriétaires Maître Jeanne Dupont pour une durée de douze mois.`,
    DESIGNATION,
  ],
  ['R1 « Désigne la SELAS… »', `${TJ} ORDONNANCE. Désigne la SELAS AJ Partenaires, prise en la personne de Maître Dupont, en qualité d'administrateur provisoire.`, DESIGNATION],
  [
    'R2 « Vu notre ordonnance… désignant » ; Prorogeons la mission',
    `${TJ} ORDONNANCE SUR REQUÊTE. Vu notre ordonnance du 3 mars 2025 désignant Maître X en qualité d'administrateur provisoire ; Vu la requête de l'administrateur provisoire ; Prorogeons la mission pour douze mois.`,
    PROLONGATION,
  ],
  [
    'R2 visa de plus de huit mots ; Prorogeons',
    `${TJ} ORDONNANCE. Vu l'ordonnance rendue le 3 mars 2025 par le président du tribunal judiciaire de Tours désignant Maître X en qualité d'administrateur provisoire ; Prorogeons la mission pour douze mois.`,
    PROLONGATION,
  ],
  [
    'R2 visas séparés par des virgules ; Prorogeons',
    `${TJ} ORDONNANCE. Vu notre ordonnance du 3 mars 2025 désignant Maître X en qualité d'administrateur provisoire, Vu la requête, Prorogeons la mission pour douze mois.`,
    PROLONGATION,
  ],
  [
    'R2 « Vu notre ordonnance… désignant » ; Taxons',
    `${TJ} ORDONNANCE. Vu notre ordonnance du 3 mars 2025 désignant Maître X en qualité d'administrateur provisoire ; Taxons les honoraires de l'administrateur provisoire à la somme de 4 000 €.`,
    TAXE,
  ],
  [
    'R2 « Vu notre ordonnance… désignant » ; Mettons fin',
    `${TJ} ORDONNANCE. Vu notre ordonnance du 3 mars 2025 désignant Maître X en qualité d'administrateur provisoire ; PAR CES MOTIFS, Mettons fin à la mission de l'administrateur provisoire.`,
    FIN,
  ],
  [
    'R2 requête qui demande la désignation',
    `REQUÊTE aux fins de désignation d'un administrateur provisoire — Tribunal judiciaire de Tours — À Monsieur le Président. Il vous plaira de rendre une ordonnance désignant Maître X en qualité d'administrateur provisoire.`,
    null,
  ],
  ['R3 pièce de l’AJ, ordonnance citée entre parenthèses', `Maître X, administrateur provisoire (ordonnance du tribunal judiciaire de Tours du 2 mars 2025, RG 25/01234)\n${CORPS_CONVOCATION}`, CONVOCATION],
  [
    'R3 « en vertu d’une ordonnance »',
    `Maître X, administrateur provisoire du syndicat en vertu d'une ordonnance du tribunal judiciaire de Tours, RG 25/01234\n${CORPS_CONVOCATION}`,
    CONVOCATION,
  ],
  [
    'R3 « suivant ordonnance »',
    `Maître X, agissant en qualité d'administrateur provisoire suivant ordonnance du tribunal judiciaire de Tours du 2 mars 2025 (RG 25/01234)\n${CORPS_CONVOCATION}`,
    CONVOCATION,
  ],
  [
    'R3 « fonctions auxquelles elle a été désignée par ordonnance »',
    `Maître X, administrateur provisoire, fonctions auxquelles elle a été désignée par ordonnance du tribunal judiciaire de Tours (RG 25/01234)\n${CORPS_CONVOCATION}`,
    CONVOCATION,
  ],
  ['R3 « Réf. : ordonnance… »', `Réf. : ordonnance du tribunal judiciaire de Tours, RG 25/01234 — Maître X, administrateur provisoire\n${CORPS_CONVOCATION}`, CONVOCATION],
  [
    'R3 « Ordonnance du… » sous l’en-tête du cabinet',
    `Maître X, administrateur provisoire\nOrdonnance du tribunal judiciaire de Tours du 2 mars 2025, RG 25/01234\n${CORPS_CONVOCATION}`,
    CONVOCATION,
  ],
  [
    'R3 lettre sans titre qui cite l’ordonnance',
    `Maître X, administrateur provisoire (ordonnance du tribunal judiciaire de Tours du 2 mars 2025, RG 25/01234)\nMadame, Monsieur, je vous prie de trouver ci-joint les pièces demandées.`,
    null,
  ],
  [
    'R4 titre « ÉTAT DATÉ », demande citée',
    `ÉTAT DATÉ (article 5 du décret du 17 mars 1967) — Date de la demande d'état daté : 3 mars 2026 — Notaire : Maître Y — Vente du lot 12 — 1re partie : sommes dues par le cédant au syndicat`,
    ETAT_DATE,
  ],
  [
    'R4 lettre d’envoi qui cite la demande, puis « ÉTAT DATÉ »',
    `Lettre : suite à votre demande d'état daté, veuillez trouver l'état daté ci-joint. Maître Y, notaire. ÉTAT DATÉ (article 5 du décret du 17 mars 1967) — première partie : sommes dues par le cédant — vente du lot 12`,
    ETAT_DATE,
  ],
  [
    'R4 sans titre : demande et état daté',
    `Madame, suite à votre demande d'état daté du 3 mars, nous vous adressons l'état daté du lot 12 (article 5 du décret du 17 mars 1967) : sommes dues par le cédant. Maître Y, notaire.`,
    ETAT_DATE,
  ],
  [
    'R5 convocation avec projets de résolution',
    `CONVOCATION À L'ASSEMBLÉE GÉNÉRALE ORDINAIRE — vous êtes convoqué(e) à l'assemblée générale qui se tiendra le 12 juin 2026. ORDRE DU JOUR ET PROJETS DE RÉSOLUTION : Résolution n° 1 — l'assemblée générale approuve les comptes (majorité des voix des copropriétaires présents ou représentés). Résolution n° 2 — l'assemblée générale adopte le budget prévisionnel. Pièces jointes : copie du procès-verbal de la précédente assemblée.`,
    CONVOCATION,
  ],
  [
    'R5 convocation sans titre',
    `Madame, Monsieur, vous êtes convoqué(e) à l'assemblée générale qui se tiendra le 12 juin 2026 ; ordre du jour : projet de résolution n° 1, l'assemblée générale adopte le budget (majorité des voix des copropriétaires présents ou représentés) ; la convocation et le procès-verbal de la précédente assemblée sont joints.`,
    CONVOCATION,
  ],
]

const TOUR_1: Cas[] = [
  [
    'reste 1, dispositif sur trois lignes (PDF)',
    `${ENTETE}Vu la requête du syndicat des copropriétaires ;\nPAR CES MOTIFS\nDésignons la SELARL AJ ASSOCIÉS, prise en la personne de Maître Jeanne DUPONT,\nadministrateur judiciaire, demeurant 12 rue Nationale 37000 TOURS, en qualité\nd'administrateur provisoire du syndicat des copropriétaires pour douze mois ;`,
    DESIGNATION,
  ],
  ['reste 1, « Désignons » seul en fin de ligne', `${ENTETE}PAR CES MOTIFS\nDésignons\nMaître Jeanne DUPONT en qualité d'administrateur provisoire.`, DESIGNATION],
  [
    'reste 1, prolongation, objet sur la ligne suivante',
    `${ENTETE}Vu notre ordonnance du 3 mars 2025 ;\nPAR CES MOTIFS\nProrogeons pour une durée de douze mois à compter du 3 mars 2026\nla mission de Maître X, administrateur provisoire du syndicat.`,
    PROLONGATION,
  ],
  [
    'reste 1, fin de mission, objet sur la ligne suivante',
    `${ENTETE}Vu le rapport de Maître X ;\nPAR CES MOTIFS\nMettons fin, à compter du 30 juin 2026,\nà la mission de Maître X, administrateur provisoire.`,
    FIN,
  ],
  ['reste 1, « Maître J. DUPONT »', `${TJ} ORDONNANCE. Désignons Maître J. DUPONT en qualité d'administrateur provisoire du syndicat des copropriétaires.`, DESIGNATION],
  [
    'reste 1, SELARL « prise en la personne de Maître J. Dupont »',
    `${TJ} ORDONNANCE SUR REQUÊTE. PAR CES MOTIFS, Désignons la SELARL AJ ASSOCIÉS, prise en la personne de Maître J. Dupont, en qualité d'administrateur provisoire du syndicat des copropriétaires.`,
    DESIGNATION,
  ],
  ['reste 1, « Maître J.-P. Dupont »', `${TJ} ORDONNANCE. Désignons Maître J.-P. Dupont en qualité d'administrateur provisoire.`, DESIGNATION],
  [
    'reste 1, « Maître A. Martin » après « PAR CES MOTIFS » en ligne',
    `${ENTETE}PAR CES MOTIFS\nDésignons Maître A. Martin, administrateur judiciaire, en qualité d'administrateur provisoire du syndicat des copropriétaires`,
    DESIGNATION,
  ],
  ['reste 1, « la S.E.L.A.R.L. »', `${TJ} ORDONNANCE. Désignons la S.E.L.A.R.L. AJ ASSOCIÉS en qualité d'administrateur provisoire.`, DESIGNATION],
  ['reste 1, « Mr. Jean Dupont »', `${TJ} ORDONNANCE. Désignons Mr. Jean Dupont en qualité d'administrateur provisoire du syndicat.`, DESIGNATION],
  ['reste 1, « 12 bd. Heurteloup »', `${TJ} ORDONNANCE. Désignons la SELARL AJ ASSOCIÉS, 12 bd. Heurteloup 37000 Tours, en qualité d'administrateur provisoire.`, DESIGNATION],
  [
    'reste 1, « Statuant publiquement…, Désigne »',
    `${TJ} ORDONNANCE. PAR CES MOTIFS, Statuant publiquement par ordonnance sur requête, Désigne Maître Jeanne Dupont en qualité d'administrateur provisoire.`,
    DESIGNATION,
  ],
  [
    'reste 1, « Le juge des référés, statuant…, Désigne »',
    `${TJ} ORDONNANCE DE RÉFÉRÉ. PAR CES MOTIFS, Le juge des référés, statuant publiquement, par ordonnance contradictoire et en premier ressort, Désigne Maître Jeanne Dupont en qualité d'administrateur provisoire.`,
    DESIGNATION,
  ],
  [
    'reste 1, « Le président…, statuant en la forme des référés, désigne »',
    `${TJ} ORDONNANCE. Le président du tribunal judiciaire de Tours, statuant en la forme des référés, désigne Maître Jeanne Dupont en qualité d'administrateur provisoire.`,
    DESIGNATION,
  ],
  [
    'reste 2, « Ordonnons la prorogation de la mission »',
    `${TJ} ORDONNANCE. Vu la requête de Maître X, administrateur provisoire ; Ordonnons la prorogation de la mission de l'administrateur provisoire pour douze mois.`,
    PROLONGATION,
  ],
  ['reste 2, « Accordons … une prorogation de sa mission »', `${TJ} ORDONNANCE. Accordons à Maître X, administrateur provisoire, une prorogation de sa mission pour six mois.`, PROLONGATION],
  [
    'reste 2, « Fixons à la somme de … les honoraires »',
    `${TJ} ORDONNANCE. Vu la requête de Maître X, administrateur provisoire, aux fins de taxe ; Fixons à la somme de 4 000 € HT les honoraires de l'administrateur provisoire.`,
    TAXE,
  ],
  [
    'reste 3, procès-verbal à initiale, résolution « DEVIS DE RAVALEMENT »',
    `Procès-verbal de l'assemblée générale ordinaire du 12 juin 2026\nRésidence Les Tilleuls, 12 rue Nationale, Tours\nRésolution n° 5 — DEVIS DE RAVALEMENT\nL'assemblée générale, après en avoir délibéré, approuve le devis de l'entreprise X d'un montant de 45 000 € HT, TVA 10 %.\nRésolution adoptée à la majorité des voix des copropriétaires présents ou représentés.`,
    PV,
  ],
  [
    'reste 3, même procès-verbal, titre en capitales',
    `PROCÈS-VERBAL DE L'ASSEMBLÉE GÉNÉRALE ORDINAIRE DU 12 JUIN 2026\nRésidence Les Tilleuls, 12 rue Nationale, Tours\nRésolution n° 5 — DEVIS DE RAVALEMENT\nL'assemblée générale, après en avoir délibéré, approuve le devis de l'entreprise X d'un montant de 45 000 € HT, TVA 10 %.\nRésolution adoptée à la majorité des voix des copropriétaires présents ou représentés.`,
    PV,
  ],
  [
    'reste 3, convocation à initiale, ordre du jour en capitales',
    `Convocation à l'assemblée générale ordinaire\nMadame, Monsieur, vous êtes convoqué(e) à l'assemblée générale qui se tiendra le 12 juin 2026.\nORDRE DU JOUR\n1. APPROBATION DES COMPTES\n2. DEVIS DE RAVALEMENT : entreprise X, 45 000 € HT, TVA 10 %`,
    CONVOCATION,
  ],
  [
    'reste 3, procès-verbal à initiale, rubrique « CONVOCATION : »',
    `Procès-verbal de l'assemblée générale du 12 juin 2026\nCONVOCATION : les copropriétaires ont été convoqués par lettre recommandée du 1er mai 2026.\nRésolution n° 1 : approbation des comptes, adoptée.`,
    PV,
  ],
  [
    'reste 4, « Ordonnance du … désignant … » au-dessus de la convocation de l’AJ',
    `Maître X, administrateur provisoire\nOrdonnance du tribunal judiciaire de Tours du 2 mars 2025 désignant Maître X en qualité d'administrateur provisoire (RG 25/01234)\n${CONVOQUEE}`,
    CONVOCATION,
  ],
  [
    'reste 4, ligne « SELARL … — ORDONNANCE … DÉSIGNANT … » au-dessus de la CONVOCATION',
    `SELARL AJ ASSOCIÉS — ORDONNANCE DU TRIBUNAL JUDICIAIRE DE TOURS DU 2 MARS 2025 DÉSIGNANT LA SELARL AJ ASSOCIÉS EN QUALITÉ D'ADMINISTRATEUR PROVISOIRE, RG 25/01234\nCONVOCATION à l'assemblée générale. Ordre du jour : 1. Approbation des comptes`,
    CONVOCATION,
  ],
  ['reste 4, « Ordonnance de prorogation du … »', `Maître X, administrateur provisoire\nOrdonnance de prorogation du 2 mars 2026 (RG 25/01234)\n${CONVOQUEE}`, CONVOCATION],
]

const RAPPORT = `${AJ}\nOrdonnance du 3 mars 2025 désignant la SELARL AJ ASSOCIÉS en qualité d'administrateur provisoire (RG 25/01234)\nRAPPORT DE L'ADMINISTRATEUR PROVISOIRE\nSituation comptable du syndicat au 31 décembre 2025.`
const ETAT_DATE_SOUS_LA_DEMANDE = `SELARL AJ ASSOCIÉS, administrateur provisoire du syndicat des copropriétaires Les Tilleuls\nDemande d'état daté n° 2026-012 du 3 mars 2026 — Maître Paul Durand, notaire à Tours\nÉTAT DATÉ\nétabli en application de l'article 5 du décret du 17 mars 1967 — vente du lot n° 12\nSommes dues par le cédant au syndicat : 1 200 €`

const TOUR_2: Cas[] = [
  [
    'reste 1, SELARL « inscrite en qualité d’administrateur judiciaire »',
    `${ENTETE}PAR CES MOTIFS\nDésignons la SELARL AJ ASSOCIÉS, inscrite en qualité d'administrateur judiciaire sur la liste nationale, prise en la personne de Maître Jeanne DUPONT, en qualité d'administrateur provisoire du syndicat des copropriétaires ;`,
    DESIGNATION,
  ],
  [
    'reste 1, « agissant en qualité d’associée, en qualité d’administrateur provisoire »',
    `${ENTETE}PAR CES MOTIFS\nDésignons la SELARL AJ ASSOCIÉS, prise en la personne de Maître Jeanne DUPONT, agissant en qualité d'associée, en qualité d'administrateur provisoire du syndicat des copropriétaires ;`,
    DESIGNATION,
  ],
  [
    'reste 1, « en qualité d’administrateur judiciaire, aux fonctions d’administrateur provisoire »',
    `${TJ} ORDONNANCE. Désignons Maître Jeanne Dupont, en qualité d'administrateur judiciaire, aux fonctions d'administrateur provisoire du syndicat des copropriétaires.`,
    DESIGNATION,
  ],
  [
    'reste 1, « pour administrer provisoirement »',
    `${TJ} ORDONNANCE. Désignons Maître Jeanne Dupont, en qualité d'administrateur judiciaire, pour administrer provisoirement le syndicat des copropriétaires.`,
    DESIGNATION,
  ],
  [
    'reste 2, « Fixons le montant des honoraires »',
    `${TJ} ORDONNANCE. Vu la requête de Maître X, administrateur provisoire, aux fins de taxe ; Fixons le montant des honoraires de l'administrateur provisoire à la somme de 4 000 € HT.`,
    TAXE,
  ],
  [
    'reste 2, « Fixons … le montant de la rémunération »',
    `${ENTETE}Vu la requête de Maître X, administrateur provisoire, aux fins de taxe ;\nPAR CES MOTIFS\nFixons à la somme de 4 000 € HT le montant de la rémunération de l'administrateur provisoire ;`,
    TAXE,
  ],
  [
    'reste 2, « Arrêtons le montant de la rémunération »',
    `${TJ} ORDONNANCE. Vu la requête de Maître X, administrateur provisoire ; Arrêtons le montant de la rémunération de l'administrateur provisoire à 4 000 € HT.`,
    TAXE,
  ],
  [
    'reste 2, « Accordons … un nouveau délai pour accomplir sa mission »',
    `${TJ} ORDONNANCE. Vu la requête de Maître X, administrateur provisoire ; Accordons à Maître X, administrateur provisoire, un nouveau délai de douze mois pour accomplir sa mission.`,
    PROLONGATION,
  ],
  [
    'reste 2, « Ordonnons la poursuite de la mission »',
    `${TJ} ORDONNANCE. Vu la requête de Maître X, administrateur provisoire ; Ordonnons la poursuite de la mission de l'administrateur provisoire pour une durée de douze mois.`,
    PROLONGATION,
  ],
  [
    'reste 2, « Ordonnons le maintien … dans ses fonctions »',
    `${TJ} ORDONNANCE. Vu la requête de Maître X, administrateur provisoire ; Ordonnons le maintien de Maître X dans ses fonctions d'administrateur provisoire pour une durée de douze mois.`,
    PROLONGATION,
  ],
  [
    'reste 2, « Statuant publiquement, Maintient … dans ses fonctions »',
    `${TJ} ORDONNANCE. PAR CES MOTIFS, Statuant publiquement, Maintient Maître X dans ses fonctions d'administrateur provisoire pour six mois.`,
    PROLONGATION,
  ],
  [
    'reste 2, « Constatons l’achèvement de la mission »',
    `${TJ} ORDONNANCE. Vu le rapport de Maître X, administrateur provisoire ; Constatons l'achèvement de la mission de Maître X, administrateur provisoire.`,
    FIN,
  ],
  [
    'reste 2, « Prononçons la clôture de la mission »',
    `${TJ} ORDONNANCE. Vu le rapport de Maître X, administrateur provisoire ; Prononçons la clôture de la mission de l'administrateur provisoire.`,
    FIN,
  ],
  [
    'reste 2, « Ordonnons la levée de la mission »',
    `${TJ} ORDONNANCE. Vu le rapport de Maître X, administrateur provisoire ; Ordonnons la levée de la mission d'administration provisoire confiée à Maître X.`,
    FIN,
  ],
  [
    'reste 2, « Accordons … décharge de sa mission »',
    `${TJ} ORDONNANCE. Vu le rapport de Maître X, administrateur provisoire ; Accordons à Maître X décharge de sa mission d'administrateur provisoire.`,
    FIN,
  ],
  [
    'reste 2, « Prononçons la décharge … de sa mission »',
    `${TJ} ORDONNANCE. Vu le rapport de Maître X, administrateur provisoire ; Prononçons la décharge de Maître X de sa mission d'administrateur provisoire.`,
    FIN,
  ],
  ['reste 2, « 12 Bvd. Heurteloup »', `${TJ} ORDONNANCE. Désignons la SELARL AJ ASSOCIÉS, 12 Bvd. Heurteloup 37000 Tours, en qualité d'administrateur provisoire.`, DESIGNATION],
  ['reste 2, « rue Ste. Catherine »', `${TJ} ORDONNANCE. Désignons la SELARL AJ ASSOCIÉS, 12 rue Ste. Catherine 37000 Tours, en qualité d'administrateur provisoire.`, DESIGNATION],
  ['reste 2, « Maître Jacq. Martin »', `${TJ} ORDONNANCE. Désignons Maître Jacq. Martin en qualité d'administrateur provisoire.`, DESIGNATION],
  [
    'reste 3, convocation à l’AG élective, « ma mission prend fin »',
    `${AJ}\nOrdonnance du président du tribunal judiciaire de Tours du 3 mars 2025 désignant la SELARL AJ ASSOCIÉS en qualité d'administrateur provisoire (RG 25/01234)\nConvocation à l'assemblée générale extraordinaire\nMadame, Monsieur,\nMa mission d'administrateur provisoire prend fin le 2 mars 2026. Vous êtes convoqué(e) à l'assemblée générale qui se tiendra le 12 février 2026 afin de désigner un syndic.\nOrdre du jour : 1. Désignation du syndic`,
    CONVOCATION,
  ],
  [
    'reste 3, convocation, « la SELARL … est désignée en qualité d’administrateur provisoire »',
    `Maître X, administrateur provisoire\nOrdonnance du tribunal judiciaire de Tours du 2 mars 2025 désignant Maître X en qualité d'administrateur provisoire (RG 25/01234)\nConvocation à l'assemblée générale\nMadame, Monsieur,\nPar ordonnance du 2 mars 2025, la SELARL AJ ASSOCIÉS est désignée en qualité d'administrateur provisoire du syndicat des copropriétaires. À ce titre, elle vous convoque à l'assemblée générale qui se tiendra le 12 juin 2026.\nOrdre du jour : 1. Désignation du syndic`,
    CONVOCATION,
  ],
  [
    'reste 3, lettre, « la mission … est prorogée »',
    `${AJ}\nOrdonnance de prorogation du 2 mars 2026 (RG 25/01234)\nMadame, Monsieur,\nJe vous informe que la mission de l'administrateur provisoire est prorogée jusqu'au 2 mars 2027.`,
    null,
  ],
  [
    'reste 3, lettre, « est nommée administrateur provisoire »',
    `SELARL AJ ASSOCIÉS\nOrdonnance du 2 mars 2025 désignant la SELARL AJ ASSOCIÉS en qualité d'administrateur provisoire (RG 25/01234)\nMadame, Monsieur,\nJe vous informe que la SELARL AJ ASSOCIÉS est nommée administrateur provisoire de votre copropriété ; vous trouverez ci-joint l'ordonnance.`,
    null,
  ],
  [
    'reste 3, convocation, ordre du jour « la mission … prend fin »',
    `Maître X, administrateur provisoire\nOrdonnance de prorogation du 2 mars 2026 (RG 25/01234)\nConvocation à l'assemblée générale qui se tiendra le 12 juin 2026\nOrdre du jour : 1. Approbation des comptes ; 2. Information : la mission de l'administrateur provisoire prend fin le 30 juin 2026`,
    CONVOCATION,
  ],
  ['reste 3, appel de fonds sous « Ordonnance de prorogation du … »', `${AJ}\nOrdonnance de prorogation du 2 mars 2026 (RG 25/01234)\nAPPEL DE FONDS — 2e trimestre 2026\nLot n° 12 : 450,00 € à régler avant le 1er avril 2026`, null],
  [
    'reste 3, appel de fonds sous « Ordonnance … désignant … »',
    `${AJ}\nOrdonnance du tribunal judiciaire de Tours du 3 mars 2025 désignant la SELARL AJ ASSOCIÉS en qualité d'administrateur provisoire (RG 25/01234)\nAppel de fonds du 2e trimestre 2026\nLot n° 12 : 450,00 € à régler avant le 1er avril 2026`,
    null,
  ],
  [
    'reste 3, circulaire sans formule d’appel',
    `${AJ}\nOrdonnance de prorogation du 2 mars 2026 (RG 25/01234)\nAux copropriétaires de la résidence Les Tilleuls\nObjet : poursuite de l'administration provisoire\nJe vous informe que je poursuis ma mission jusqu'au 2 mars 2027.`,
    null,
  ],
  ['reste 3, rapport de l’administrateur provisoire', RAPPORT, null],
  ['reste 4, état daté sous une ligne « Demande d’état daté n° … »', ETAT_DATE_SOUS_LA_DEMANDE, ETAT_DATE],
  [
    'reste 4, état daté complet en trois parties',
    `SELARL AJ ASSOCIÉS, administrateur provisoire du syndicat des copropriétaires Les Tilleuls\nDemande d'état daté n° 2026-012 du 3 mars 2026 — Maître Paul Durand, notaire à Tours\nÉTAT DATÉ\nétabli en application de l'article 5 du décret du 17 mars 1967\nLot n° 12 — cédant : M. A\nPremière partie : sommes dues par le cédant au syndicat\nDeuxième partie : sommes dont le syndicat pourrait être débiteur\nTroisième partie : sommes dues par l'acquéreur`,
    ETAT_DATE,
  ],
  ['reste 4, devis sous une ligne « Facture d’acompte… »', `SARL Martin\nFacture d'acompte de 30 % à la commande\nDEVIS N° 2026-45\nRavalement : 45 000 € HT, TVA 10 %, 49 500 € TTC`, DEVIS],
  [
    'reste 5, juge du contrôle des expertises : « Prorogeons le délai imparti à l’expert »',
    `${TJ} ORDONNANCE DU JUGE CHARGÉ DU CONTRÔLE DES EXPERTISES. Vu la demande de M. Yves Bernard, expert ; Prorogeons de trois mois le délai imparti à l'expert pour accomplir sa mission.`,
    AUTRE,
  ],
  [
    'reste 5, « Prorogeons … la mission confiée à M. Bernard, expert judiciaire »',
    `TRIBUNAL JUDICIAIRE DE TOURS\nRG 26/01234\nORDONNANCE\nPAR CES MOTIFS\nProrogeons jusqu'au 30 juin 2026 la mission confiée à M. Yves Bernard, expert judiciaire.`,
    AUTRE,
  ],
  [
    'reste 5, remplacement d’expert : « Mettons fin … ; Désignons … en qualité d’expert »',
    `${TJ} ORDONNANCE DE REMPLACEMENT D'EXPERT. PAR CES MOTIFS, Mettons fin à la mission de M. Yves Bernard, expert ; Désignons en remplacement M. Zoé Petit en qualité d'expert.`,
    AUTRE,
  ],
  [
    'reste 5, « Déchargeons M. Bernard de sa mission d’expert »',
    `${TJ} ORDONNANCE. Vu la demande de M. Yves Bernard, expert ; Déchargeons M. Yves Bernard de sa mission d'expert ; Désignons M. Zoé Petit en qualité d'expert.`,
    AUTRE,
  ],
  [
    'reste 5, titre « ORDONNANCE DE PROROGATION DE DÉLAI » (expert)',
    `${TJ} ORDONNANCE DE PROROGATION DE DÉLAI. Vu la demande de M. Yves Bernard, expert ; Prorogeons jusqu'au 30 juin 2026 le délai de dépôt du rapport de l'expert.`,
    AUTRE,
  ],
  ['reste 5, expertise : « Ordonnons une expertise ; Désignons M. Y en qualité d’expert »', `${TJ} ORDONNANCE DE RÉFÉRÉ. PAR CES MOTIFS, Ordonnons une expertise ; Désignons M. Y en qualité d'expert.`, AUTRE],
]

const VOISINS: Cas[] = [
  [
    '« aux fins de désignation d’un syndic » (injonction de convoquer)',
    `${TJ} ORDONNANCE. PAR CES MOTIFS, Disons que Maître X, administrateur provisoire, convoquera l'assemblée générale aux fins de désignation d'un syndic.`,
    AUTRE,
  ],
  [
    '« pourra solliciter la prorogation », seule mention du cycle ; « exercera les fonctions » n’évoque pas la désignation',
    `${TJ} ORDONNANCE. PAR CES MOTIFS, Disons que Maître X exercera les fonctions d'administrateur provisoire ; Disons qu'il pourra solliciter la prorogation de sa mission.`,
    DESIGNATION,
    'non_evoque',
  ],
  [
    '« hors taxes » ne nomme pas la taxe',
    `${TJ} ORDONNANCE. PAR CES MOTIFS, Ordonnons la poursuite de la mission de Maître X, administrateur provisoire, pour 500 € hors taxes par mois.`,
    PROLONGATION,
  ],
  [
    'honoraires de l’avocat',
    `${TJ} ORDONNANCE DE RÉFÉRÉ. PAR CES MOTIFS, Condamnons le syndicat des copropriétaires, représenté par son administrateur provisoire, à payer les honoraires de l'avocat.`,
    AUTRE,
  ],
  ['participe « DÉSIGNÉ » en capitales', `${TJ} ORDONNANCE. PAR CES MOTIFS, Maintenons Maître X, DÉSIGNÉ EN QUALITÉ D'ADMINISTRATEUR PROVISOIRE, dans ses fonctions.`, PROLONGATION],
  ['capitales sans accents : « DESIGNE » ambigu', `${TJ} ORDONNANCE. PAR CES MOTIFS, MAINTENONS MAITRE X, DESIGNE EN QUALITE D'ADMINISTRATEUR PROVISOIRE, DANS SES FONCTIONS.`, PROLONGATION],
  [
    '🔴 « Désignons … ; Fixons sa rémunération » : désignation et taxe',
    `${TJ} ORDONNANCE. PAR CES MOTIFS, Désignons Maître X en qualité d'administrateur provisoire ; Fixons sa rémunération à 500 € HT par mois.`,
    DESIGNATION,
  ],
  [
    'séquestre désigné, l’administrateur provisoire seulement cité',
    `${TJ} ORDONNANCE. PAR CES MOTIFS, Désignons Maître Y, 12 bd. Heurteloup 37000 Tours, en qualité de séquestre des fonds, l'administrateur provisoire restant en fonctions.`,
    AUTRE,
  ],
  [
    'remplacement d’administrateur : désignation et fin de mission',
    `${TJ} ORDONNANCE. PAR CES MOTIFS, Désignons Maître Y en qualité d'administrateur provisoire en remplacement de Maître X ; Mettons fin à la mission de Maître X.`,
    DESIGNATION,
  ],
  [
    '« susceptible de prorogation »',
    `${TJ} ORDONNANCE SUR REQUÊTE. Vu la requête tendant à la désignation d'un administrateur provisoire ; Désignons Maître Jeanne Dupont, administrateur judiciaire, 12 rue de la Paix 37000 Tours, en qualité d'administrateur provisoire pour une durée de douze mois, susceptible de prorogation.`,
    DESIGNATION,
  ],
  [
    '« Disons que la mission … prend fin »',
    `${TJ} ORDONNANCE. Vu l'ordonnance du 3 mars 2024 désignant Maître X en qualité d'administrateur provisoire ; Disons que la mission de l'administrateur provisoire prend fin le 30 juin 2026.`,
    FIN,
  ],
  [
    'titre seul, sans dispositif',
    `TRIBUNAL JUDICIAIRE DE TOURS\nRG 26/01234\nOrdonnance du 2 mars 2026 désignant un administrateur provisoire (art. 29-1) de la copropriété`,
    DESIGNATION,
  ],
  ['« Ordonnance exécutoire » après la décision', `${TJ} Le président DÉSIGNE Maître X en qualité d'administrateur provisoire. Ordonnance exécutoire.`, DESIGNATION],
  [
    'requête suivie de l’ordonnance',
    `REQUÊTE aux fins de désignation d'un administrateur provisoire — Tribunal judiciaire de Tours. Il vous plaira de désigner Maître X.\nORDONNANCE\nVu la requête qui précède, Désignons Maître X en qualité d'administrateur provisoire. RG 26/01234`,
    DESIGNATION,
  ],
  [
    'jugement dont l’en-tête cite l’« Ordonnance de clôture »',
    `TRIBUNAL JUDICIAIRE DE TOURS\nJUGEMENT DU 3 MARS 2026\nRG 25/01234\nOrdonnance de clôture du 12 janvier 2026\nPAR CES MOTIFS\nCondamne la société X à payer au syndicat des copropriétaires la somme de 12 000 €.`,
    null,
  ],
  [
    'vraie ordonnance avec une ligne « Convocation de l’assemblée générale »',
    `TRIBUNAL JUDICIAIRE DE TOURS\nRG 26/01234\nORDONNANCE DE PROROGATION\nPAR CES MOTIFS\nProrogeons la mission de Maître X, administrateur provisoire, pour douze mois ;\nConvocation de l'assemblée générale dans les six mois.`,
    PROLONGATION,
  ],
  ['mise en demeure d’un fournisseur (« Objet : »)', 'Objet : mise en demeure. Facture impayée de 1 200 € TTC. A défaut de règlement sous 8 jours…', null],
  ['« injonction » sans capitale', 'Mairie de Tours — injonction de réaliser les travaux de ravalement de la façade', INJONCTION],
  [
    'convocation dont l’ordre du jour porte « 3. MISE EN DEMEURE … »',
    `Convocation à l'assemblée générale ordinaire\nVous êtes convoqué(e) à l'assemblée générale qui se tiendra le 12 juin 2026.\nORDRE DU JOUR\n3. MISE EN DEMEURE DU COPROPRIÉTAIRE DU LOT N° 12 : charges de copropriété impayées`,
    CONVOCATION,
  ],
  ['🔴 pièce titrée « Pré-état daté »', 'Pré-état daté — informations financières du cédant (article 5 du décret du 17 mars 1967)', null],
]

const PV_DECISIONS_AP = `PROCÈS-VERBAL DES DÉCISIONS DE L'ADMINISTRATEUR PROVISOIRE\nRésidence Les Tilleuls\nLe 12 juin 2025, Maître X, administrateur provisoire désignée par ordonnance du 3 mars 2025, investie des pouvoirs de l'assemblée générale (loi du 10 juillet 1965, art. 29-1), a pris les décisions suivantes.\nRésolution n° 1 : approbation des comptes de l'exercice 2024. Décision : approuvée.`
const A1 = `Maître Y\nNotaire\n3 place du Marché 69002 Lyon\nObjet : Vente DUPONT / MARTIN — lot n° 12 — État daté\nMaître,\nJe vous remercie de bien vouloir m'adresser l'état daté prévu à l'article 5 du décret du 17 mars 1967, la signature de l'acte étant prévue le 15 décembre.\nVeuillez agréer, Maître, l'expression de mes salutations distinguées.`
const A2 = `M. Paul Z\n4 rue des Lilas 75011 Paris\nObjet : Procès-verbal de l'assemblée générale du 12 juin 2025\nMaître,\nJe conteste la résolution n° 5 adoptée lors de cette assemblée, dont le procès-verbal m'a été notifié le 20 juin.\nJe vous prie d'agréer mes salutations.`
const A3 = `SARL Plomberie Durand\nObjet : Facture n° F-2025-118 impayée\nMadame, Monsieur,\nSauf erreur de notre part, notre facture d'un montant de 1 200,00 € TTC reste impayée à ce jour. Nous vous remercions de procéder au règlement sous huitaine.`
const A5 = `Maître Y, notaire\nObjet : Règlement de copropriété — Résidence Les Tilleuls\nMaître,\nPourriez-vous nous adresser une copie du règlement de copropriété et de l'état descriptif de division, avec leurs modificatifs ?\nBien à vous.`
const A6 = `Maître Claire X, administrateur provisoire\nObjet : Avis de mutation du 3 mars 2025 — lot n° 12 — opposition (article 20)\nMaître,\nEn réponse à votre avis de mutation reçu le 4 mars, je forme opposition au versement des fonds en application de l'article 20 de la loi du 10 juillet 1965, pour la somme de 2 400 €.`

/** Premier contrôle du contrat (resultat-64-refonte.json, tour 0, défauts 1 à 7). */
const CONTRAT: Cas[] = [
  ['défaut 1, A1 notaire, « Objet : … — État daté », « bien vouloir m’adresser l’état daté »', A1, DEMANDE_ETAT_DATE],
  ['défaut 1, A2 copropriétaire, « Objet : Procès-verbal… »', A2, null],
  ['défaut 1, A3 fournisseur, « Objet : Facture… impayée »', A3, null],
  [
    'défaut 1, A4 copropriétaire, « Objet : Convocation… »',
    `Mme Anne W\nObjet : Convocation de la prochaine assemblée générale — demande d'inscription à l'ordre du jour\nMaître,\nEn application de l'article 10 du décret, je vous demande d'inscrire à l'ordre du jour la question suivante : remplacement de la porte du hall.`,
    null,
  ],
  ['défaut 1, A5 notaire, « Objet : Règlement de copropriété »', A5, null],
  ['défaut 1, A6 AJ, « Objet : Avis de mutation… — opposition »', A6, null],
  [
    'défaut 1, E1 phrase « Procès-verbal de… » au milieu d’une lettre',
    `Madame, Monsieur,\nJe fais suite à votre courrier du 2 juillet. Procès-verbal de l'assemblée générale du 12 juin 2025 : la résolution n° 3 a bien été adoptée, je vous en adresserai copie.\nCordialement.`,
    null,
  ],
  ['défaut 1, E2 « Objet : État daté lot 12 »', `Maître Y, notaire\nObjet : État daté lot 12, vente DUPONT\nMaître, merci de m'adresser l'état daté prévu par l'article 5 du décret du 17 mars 1967.`, DEMANDE_ETAT_DATE],
  [
    'défaut 2, B1 convocation à la réunion d’expertise',
    `CONVOCATION À LA RÉUNION D'EXPERTISE\nSinistre dégât des eaux du 3 février 2025 — Résidence Les Tilleuls\nMadame, Monsieur,\nLa réunion d'expertise contradictoire aura lieu le 12 mars 2025 à 10 heures sur place.`,
    null,
  ],
  [
    'défaut 2, B2 convocation du conseil syndical',
    `CONVOCATION\nRéunion du conseil syndical\nLa réunion du conseil syndical se tiendra le 3 mars 2025 à 18 heures.\nOrdre du jour : préparation du budget.`,
    null,
  ],
  [
    'défaut 2, E3 convocation à l’audience',
    `CONVOCATION À L'AUDIENCE\nTribunal judiciaire de Paris\nL'affaire sera appelée à l'audience qui se tiendra le 12 mars 2025 à 9 h 30.`,
    null,
  ],
  [
    'défaut 2, B3 procès-verbal de réception des travaux',
    `PROCÈS-VERBAL DE RÉCEPTION DES TRAVAUX\nMaître de l'ouvrage : syndicat des copropriétaires de la Résidence Les Tilleuls, représenté par Maître X, autorisée par l'assemblée générale du 12 juin 2024 (résolution n° 12).\nLe maître de l'ouvrage déclare prononcer la réception des travaux de ravalement sans réserve.`,
    null,
  ],
  [
    'défaut 2, B4 procès-verbal du conseil syndical',
    `PROCÈS-VERBAL DE LA RÉUNION DU CONSEIL SYNDICAL DU 3 MARS 2025\nPrésents : M. A, Mme B.\nPréparation de l'assemblée générale : le projet de résolution relatif au ravalement est adopté à l'unanimité des membres.`,
    null,
  ],
  ['défaut 2, B5 procès-verbal des décisions de l’administrateur provisoire', PV_DECISIONS_AP, null],
  [
    'défaut 2, E4 procès-verbal de signification',
    `PROCÈS-VERBAL DE SIGNIFICATION\nÀ la requête du syndicat des copropriétaires, j'ai signifié à M. Z, copropriétaire défaillant, le procès-verbal de l'assemblée générale du 12 juin 2025 (résolutions n° 1 à 14).`,
    null,
  ],
  [
    'défaut 2, B7 mise en demeure d’un entrepreneur (lot de marché)',
    `MISE EN DEMEURE\nMarché de travaux de ravalement — lot n° 2 (maçonnerie)\nMonsieur,\nLes travaux devaient être achevés le 30 juin. Nous vous mettons en demeure de les achever sous quinze jours.`,
    null,
  ],
  ['défaut 2, E5 devis d’un pré-état daté', `DEVIS — ÉTABLISSEMENT D'UN PRÉ-ÉTAT DATÉ\nLot n° 12\nMontant HT : 150,00 € — TVA 20 % : 30,00 € — Valable trois mois.`, DEVIS_PRE_ETAT_DATE],
  [
    'défaut 2, E6 relance de mise en demeure',
    `RELANCE — MISE EN DEMEURE\nMonsieur, malgré notre mise en demeure du 3 mars, les charges de copropriété restent impayées.`,
    null,
  ],
  [
    'défaut 3, C1 ordonnance rectificative de l’ordonnance de désignation',
    `${TJ_PARIS}\nORDONNANCE RECTIFICATIVE de l'ordonnance portant désignation d'un administrateur provisoire\nVu l'ordonnance du 12 janvier 2025,\nPAR CES MOTIFS,\nOrdonnons la rectification de l'erreur matérielle affectant l'ordonnance du 12 janvier 2025 ; Disons qu'il y a lieu de lire « Maître Claire X, administrateur provisoire » au lieu de « Maître Claire Y ».`,
    AUTRE,
  ],
  [
    'défaut 3, C3 ordonnance rejetant la requête en désignation',
    `${TJ_PARIS}\nORDONNANCE rejetant la requête aux fins de désignation d'un administrateur provisoire\nPAR CES MOTIFS,\nRejetons la requête ; Laissons les dépens à la charge du requérant.`,
    AUTRE,
  ],
  [
    'défaut 3, F1 ordonnance sur la demande de taxe, qui la rejette',
    `${TJ_PARIS}\nORDONNANCE SUR LA DEMANDE DE TAXE présentée par Maître X, administrateur provisoire\nPAR CES MOTIFS,\nRejetons la demande ; Laissons les dépens à la charge de la requérante.`,
    AUTRE,
  ],
  [
    'défaut 4, C4 constat (art. 145) : « Commettons tout commissaire de justice »',
    `${TJ_PARIS}\nORDONNANCE SUR REQUÊTE\nNous, président du tribunal judiciaire, vu la requête présentée par Maître X, administrateur provisoire du syndicat des copropriétaires,\nPAR CES MOTIFS,\nCommettons tout commissaire de justice territorialement compétent avec mission de se rendre au 12 rue des Lilas et d'y constater l'état des parties communes ; Disons que Maître X, administrateur provisoire, pourra requérir l'assistance de la force publique.`,
    AUTRE,
  ],
  [
    'défaut 4, E8 désignation d’un commissaire de justice à la requête de l’AP',
    `${TJ_PARIS}\nORDONNANCE SUR REQUÊTE\nVu la requête de Maître X, administrateur provisoire,\nPAR CES MOTIFS,\nDésignons Maître Z, commissaire de justice à Paris, avec mission de dresser l'inventaire des archives détenues par l'ancien syndic, à la requête de Maître X, administrateur provisoire.`,
    AUTRE,
  ],
  [
    'défaut 4, C10 désignation d’un technicien, consignation versée par l’AP',
    `${TJ_PARIS}\nORDONNANCE DE RÉFÉRÉ\nPAR CES MOTIFS,\nDésignons Monsieur Pierre T, architecte, en qualité de technicien, avec mission de décrire les désordres ; Disons que la consignation sera versée par Maître X, ès qualités d'administrateur provisoire du syndicat des copropriétaires.`,
    AUTRE,
  ],
  [
    'défaut 4, E7 taxe des honoraires d’un technicien, payés par l’AP',
    `${TJ_PARIS}\nORDONNANCE DE TAXE\nPAR CES MOTIFS,\nTaxons les frais et honoraires de M. T, technicien, à la somme de 3 000 € ; Disons qu'ils seront payés par Maître X, administrateur provisoire.`,
    AUTRE,
  ],
  [
    'défaut 4, technicien désigné avec mission de vérifier les comptes de l’AP',
    `${TJ_PARIS}\nORDONNANCE DE RÉFÉRÉ\nPAR CES MOTIFS,\nDésignons M. T, technicien, avec mission de vérifier les comptes de l'administrateur provisoire.`,
    AUTRE,
  ],
  [
    'défaut 5, C5 autorisation de représenter le syndicat dans une procédure d’expropriation',
    `${TJ_PARIS}\nORDONNANCE SUR REQUÊTE\nPAR CES MOTIFS,\nAutorisons Maître X, administrateur provisoire, à représenter le syndicat des copropriétaires dans la procédure d'expropriation engagée par la commune.`,
    AUTRE,
  ],
  [
    'défaut 6, C6 requête aux fins d’emprunt sous « Ordonnance de désignation du… »',
    `${AJ_PARIS}\nOrdonnance de désignation du 3 mars 2025 - RG 25/00012\nREQUÊTE AUX FINS D'AUTORISATION D'EMPRUNT\nÀ Monsieur le Président du tribunal judiciaire de Paris\nMaître X, administrateur provisoire du syndicat des copropriétaires, a l'honneur de vous exposer que des travaux urgents sont nécessaires.\nPAR CES MOTIFS,\nPlaise à Monsieur le Président d'autoriser Maître X, administrateur provisoire, à souscrire un emprunt de 50 000 €.`,
    null,
  ],
  [
    'défaut 6, E10 requête en rectification sous « Ordonnance de taxe du… »',
    `Maître Claire X, administrateur provisoire\nOrdonnance de taxe du 3 mars 2025 - RG 25/00012\nREQUÊTE EN RECTIFICATION\nPAR CES MOTIFS,\nPlaise à Monsieur le Président de rectifier l'erreur matérielle affectant le montant retenu pour Maître X, administrateur provisoire.`,
    null,
  ],
  [
    'défaut 6, C7 lettre en capitales sans accents : « DESIGNE » est un participe',
    `ORDONNANCE DE PROROGATION DU 2 MARS 2026 - RG 25/01234\nMAITRE JEAN X, ADMINISTRATEUR PROVISOIRE DESIGNE PAR ORDONNANCE DU 3 MARS 2025\nAux copropriétaires de la résidence Les Tilleuls\nObjet : poursuite de l'administration provisoire\nMadame, Monsieur, je vous informe que je poursuis ma mission jusqu'au 2 mars 2027.`,
    null,
  ],
  [
    'défaut 6, C7 variante sans formule d’appel : « PROROGE » en capitales',
    `ORDONNANCE DE PROROGATION DU 2 MARS 2026 - RG 25/01234\nMAITRE JEAN X, ADMINISTRATEUR PROVISOIRE\nMANDAT PROROGE JUSQU'AU 2 MARS 2027 POUR LA MISSION DE MAITRE JEAN X, ADMINISTRATEUR PROVISOIRE\nAux copropriétaires de la résidence Les Tilleuls`,
    null,
  ],
  [
    'défaut 6, C9 lettre qui cite le dispositif entre guillemets',
    `${AJ_PARIS}\nOrdonnance du 2 mars 2026 - RG 25/01234\nAux copropriétaires de la résidence Les Tilleuls\nMadame, Monsieur,\nJe vous informe que le président du tribunal a statué en ces termes : « PAR CES MOTIFS, Prorogeons la mission de Maître X, administrateur provisoire, pour une durée de douze mois. »\nJe reste à votre disposition.`,
    null,
  ],
  [
    'défaut 6, C9 variante sans formule d’appel',
    `${AJ_PARIS}\nOrdonnance du 2 mars 2026 - RG 25/01234\nAux copropriétaires de la résidence Les Tilleuls\nLe président du tribunal a statué en ces termes : « PAR CES MOTIFS, Prorogeons la mission de Maître X, administrateur provisoire, pour une durée de douze mois. »`,
    null,
  ],
  [
    'défaut 6, E11 lettre au notaire, « Objet : Ordonnance de prorogation… »',
    `Maître Claire X, administrateur judiciaire\nObjet : Ordonnance de prorogation du 2 mars 2026 - RG 25/01234\nMaître,\nJe vous adresse copie de l'ordonnance dont le dispositif est ainsi rédigé : PAR CES MOTIFS, Prorogeons la mission de Maître X, administrateur provisoire, pour douze mois.`,
    null,
  ],
  [
    'voisin, ligne « Concerne : … — État daté »',
    `Maître Y, notaire\nConcerne : Vente DUPONT — lot n° 12 — État daté\nMerci de m'adresser l'état daté prévu à l'article 5 du décret du 17 mars 1967.`,
    DEMANDE_ETAT_DATE,
  ],
  [
    'voisin, ligne « N/Réf. : … — Procès-verbal de l’assemblée générale… »',
    `M. Paul Z\nN/Réf. : 2026-012 — Procès-verbal de l'assemblée générale du 12 juin 2025\nJe conteste la résolution n° 5 adoptée lors de cette assemblée.`,
    null,
  ],
  [
    'voisin, corps d’une lettre : « Veuillez trouver ci-joint — Procès-verbal… »',
    `Madame, Monsieur,\nVeuillez trouver ci-joint — Procès-verbal de l'assemblée générale du 12 juin 2025 : résolutions adoptées.\nCordialement.`,
    null,
  ],
  [
    'voisin, titre « DE PROROGATION », dispositif qui rejette la requête',
    `${TJ_PARIS}\nORDONNANCE DE PROROGATION\nPAR CES MOTIFS,\nRejetons la requête aux fins de prorogation de la mission de l'administrateur provisoire.`,
    AUTRE,
  ],
  [
    'voisin, « Disons n’y avoir lieu à prorogation »',
    `${TJ_PARIS}\nORDONNANCE DE PROROGATION\nPAR CES MOTIFS,\nDisons n'y avoir lieu à prorogation de la mission de l'administrateur provisoire.`,
    AUTRE,
  ],
  [
    'voisin, « Taxons les honoraires de l’expert, à verser par l’administrateur provisoire »',
    `${TJ_PARIS}\nORDONNANCE DE TAXE\nPAR CES MOTIFS,\nTaxons les honoraires de l'expert, à verser par l'administrateur provisoire, à la somme de 2 000 €.`,
    AUTRE,
  ],
]

const H1 = `BORDEREAU DE REMISE DES ARCHIVES DU SYNDICAT\n(article 18-2 de la loi du 10 juillet 1965)\nAncien syndic : Cabinet Gestion Plus — Nouveau représentant : Maître Claire X\n- Règlement de copropriété et état descriptif de division, avec leurs modificatifs\n- Carnet d'entretien de l'immeuble\n- Contrats en cours (ascenseur, nettoyage)\nRemis le 3 mars 2026.`
const H2 = `Maître Y\nNotaire\n3 place du Marché 69002 Lyon\nObjet : Vente DUPONT / MARTIN — lot n° 12 —\nÉtat daté\nMaître,\nJe vous remercie de bien vouloir m'adresser l'état daté prévu à l'article 5 du décret du 17 mars 1967.\nVeuillez agréer, Maître, l'expression de mes salutations distinguées.`
const H3 = `M. Paul Z\n4 rue des Lilas 75011 Paris\nObjet :\nProcès-verbal de l'assemblée générale du 12 juin 2025\nMaître,\nJe conteste la résolution n° 5 adoptée lors de cette assemblée.`
const H4 = `Maître Claire X, administrateur provisoire\nVente DUPONT / MARTIN — lot n° 12 — Avis de mutation du 3 mars 2025\nMaître,\nEn réponse à votre avis de mutation reçu le 4 mars, je forme opposition au versement des fonds en application de l'article 20 de la loi du 10 juillet 1965, pour la somme de 2 400 €.`
const G1 = `SARL Plomberie Durand\nRELEVÉ DE COMPTE CLIENT AU 30 SEPTEMBRE 2026\nClient : Syndicat des copropriétaires Résidence Les Tilleuls\nFacture F-2025-118 du 12/03/2025 — 1 000,00 € HT — TVA 20 % — reste dû 1 200,00 €\nFacture F-2025-130 du 02/04/2025 — 500,00 € HT — TVA 20 % — reste dû 600,00 €\nTotal restant dû : 1 800,00 €`
const H7 = `${AJ_PARIS}\nOrdonnance de référé du 3 mars 2026 - RG 26/01234\nChers copropriétaires,\nLe juge des référés a statué ainsi : Condamnons la société Y à payer au syndicat la somme de 12 000 € ; Laissons les dépens à sa charge.\nJe vous tiendrai informés de la suite.`
const CITEE = 'Ordonnance du 2 mars 2026 - RG 25/01234'

/** Second contrôle du contrat (resultat-64-refonte.json, tour 1, « règle stricte », défauts 1 à 5). */
const REGLE_STRICTE: Cas[] = [
  ['défaut 1, H1 bordereau de remise des archives', H1, null],
  ['défaut 1, H2 « Objet : … — » coupé, « État daté » à la ligne', H2, DEMANDE_ETAT_DATE],
  ['défaut 1, H3 « Objet : » seul, « Procès-verbal… » à la ligne', H3, null],
  ['défaut 1, H4 ligne de référence « Vente … — Avis de mutation… »', H4, null],
  ['défaut 1, G1 relevé de compte fournisseur', G1, null],
  [
    'défaut 1, H6 bordereau numéroté « 1. Facture … »',
    `BORDEREAU DE PIÈCES COMMUNIQUÉES\n1. Facture n° F-2025-118 du 12 mars 2025 — 1 000,00 € HT, TVA 20 %\n2. Facture n° F-2025-130 du 2 avril 2025`,
    null,
  ],
  [
    'défaut 1, G4 attestation de paiement',
    `ATTESTATION DE PAIEMENT\nNous attestons avoir reçu du syndicat des copropriétaires le règlement suivant :\nFacture : n° F-2025-118 du 12 mars 2025 — 1 000,00 € HT — TVA 20 % — 1 200,00 € TTC\nRèglement par virement du 30 mars 2025.`,
    null,
  ],
  [
    'défaut 1, G9 courriel « Bonjour, » puis « Facture … »',
    `De : SARL Plomberie Durand\nÀ : Maître Claire X\nObjet : votre demande\nBonjour,\nFacture n° F-2025-118 envoyée par courrier le 12 mars : montant 1 000,00 € HT, TVA 20 %.\nCordialement`,
    null,
  ],
  [
    'défaut 1, G7 tableau de bord',
    `TABLEAU DE BORD DE LA MISSION\nRésidence Les Tilleuls — 2026\nProcès-verbal de l'assemblée générale du 12 juin 2026 : notifié le 20 juin, résolutions adoptées.\nComptes 2025 : approuvés.`,
    null,
  ],
  [
    'défaut 1, G2 ordre de service',
    `ORDRE DE SERVICE N° 1\nMarché de travaux : ravalement de la façade sur rue\nMaître d'ouvrage : syndicat des copropriétaires Résidence Les Tilleuls\nDevis n° 2026-45 du 3 mars 2026 accepté pour un montant de 45 000 € HT, TVA 10 %.\nLes travaux commenceront le 1er avril 2026.`,
    null,
  ],
  [
    'défaut 1, G5 bon de commande',
    `BON DE COMMANDE N° BC-2026-12\nFournisseur : Ascenseurs du Centre\nDevis de référence : n° 2026-45 — 3 200,00 € HT — TVA 20 %\nBon pour accord, le 3 mars 2026.`,
    null,
  ],
  [
    'défaut 1, G6 contrat d’entretien (annexe « Devis … »)',
    `CONTRAT D'ENTRETIEN DE L'ASCENSEUR\nEntre le syndicat des copropriétaires Résidence Les Tilleuls et la société Ascenseurs du Centre\nArticle 1 — Objet : entretien de l'ascenseur\nArticle 5 — Prix : 2 400 € HT par an, TVA 10 %\nAnnexe 1 — Devis n° 2026-45 du 3 mars 2026, valable trois mois`,
    null,
  ],
  [
    'défaut 1, G13 compte rendu de visite',
    `COMPTE RENDU DE VISITE DE L'IMMEUBLE\nRésidence Les Tilleuls — visite du 3 mars 2026\nArrêté de péril du 12 février 2026 notifié par la mairie : les travaux de confortement ne sont pas commencés.\nÉtat général : moyen.`,
    null,
  ],
  [
    'défaut 1, H5 « Cher Confrère, » puis « État daté du lot n° 12 : … »',
    `Maître Claire X\nAdministrateur provisoire\nCher Confrère,\nÉtat daté du lot n° 12 : vous le trouverez ci-joint, établi conformément à l'article 5 du décret du 17 mars 1967.\nBien à vous.`,
    null,
  ],
  [
    'défaut 1, G3 fiche synthétique',
    `FICHE SYNTHÉTIQUE DE LA COPROPRIÉTÉ\n(article 8-2 de la loi du 10 juillet 1965)\nIdentification : Résidence Les Tilleuls, 12 rue Nationale 37000 Tours\nNuméro d'immatriculation : AB1-234-567\nRèglement de copropriété et état descriptif de division publiés le 12 mars 1965\nNombre de lots : 45, dont 30 lots principaux ; tantièmes de parties communes : 10 000`,
    null,
  ],
  [
    'défaut 1, G10 opposition',
    `OPPOSITION AU VERSEMENT DES FONDS\n(article 20 de la loi du 10 juillet 1965)\nAvis de mutation du 3 mars 2025 reçu le 4 mars 2025 de Maître Y, notaire — vente du lot n° 12.\nLe syndic forme opposition pour la somme de 2 400 €.`,
    null,
  ],
  [
    'défaut 1, G12 bordereau à tirets « - Facture … »',
    `BORDEREAU DE COMMUNICATION DE PIÈCES\n- Facture n° F-2025-118 du 12 mars 2025 (1 000,00 € HT, TVA 20 %)\n- Facture n° F-2025-130 du 2 avril 2025`,
    null,
  ],
  [
    'défaut 1, G8 « Maître Y, » (formule d’appel) puis « État daté … »',
    `Maître Claire X\nAdministrateur provisoire\nMaître Y,\nÉtat daté du lot n° 12 établi le 3 mars 2026 : vous le trouverez ci-joint, conformément à l'article 5 du décret du 17 mars 1967.\nBien à vous.`,
    null,
  ],
  [
    'défaut 1, ligne d’émetteur qui porte « — Avis de mutation … »',
    `Maître Claire X, administrateur provisoire — Avis de mutation du 3 mars 2025 — lot n° 12\nMaître,\nEn réponse à votre avis de mutation reçu le 4 mars, je forme opposition au versement des fonds en application de l'article 20 de la loi du 10 juillet 1965.`,
    null,
  ],
  ['défaut 1, élément de liste en première ligne (« - Facture … »)', `- Facture n° F-2025-118 du 12 mars 2025 (1 000,00 € HT, TVA 20 %)\n- Facture n° F-2025-130 du 2 avril 2025`, null],
  [
    'défaut 1, courrier dont l’objet n’a pas d’étiquette (« Facture n° … impayée »)',
    `SARL Plomberie Durand\nFacture n° F-2025-118 impayée\nMadame, Monsieur,\nSauf erreur de notre part, notre facture d'un montant de 1 200,00 € TTC reste impayée à ce jour.`,
    null,
  ],
  [
    'défaut 1, courrier dont l’objet n’a pas d’étiquette (« Règlement de copropriété — … »)',
    `Maître Y, notaire\nRèglement de copropriété — Résidence Les Tilleuls\nMaître,\nPourriez-vous nous adresser une copie du règlement de copropriété et de l'état descriptif de division, avec leurs modificatifs ?`,
    null,
  ],
  [
    'défaut 1, courrier dont l’objet n’a pas d’étiquette (« Avis de mutation du … — opposition »)',
    `Maître Claire X, administrateur provisoire\nAvis de mutation du 3 mars 2025 — lot n° 12 — opposition (article 20)\nMaître,\nEn réponse à votre avis de mutation reçu le 4 mars, je forme opposition au versement des fonds en application de l'article 20 de la loi du 10 juillet 1965.`,
    null,
  ],
  [
    'défaut 1, convocation sous l’en-tête du cabinet qui cite l’ordonnance',
    `Maître X, administrateur provisoire désigné par ordonnance du 2 mars 2025 (RG 25/01234)\nCabinet AJ Associés\n12 rue Nationale 37000 Tours\nTél. 02 47 00 00 00\nCONVOCATION À L'ASSEMBLÉE GÉNÉRALE ORDINAIRE\nVous êtes convoqué(e) à l'assemblée générale qui se tiendra le 12 juin 2026. Ordre du jour : approbation des comptes.`,
    CONVOCATION,
  ],
  [
    'défaut 2, L3 sans formule d’appel, guillemets droits',
    `${AJ_PARIS}\n${CITEE}\nAux copropriétaires de la résidence Les Tilleuls\nLe président du tribunal a statué en ces termes : "PAR CES MOTIFS, Prorogeons la mission de Maître X, administrateur provisoire, pour une durée de douze mois."`,
    null,
  ],
  [
    'défaut 2, L4 sans formule d’appel, guillemets anglais',
    `${AJ_PARIS}\n${CITEE}\nAux copropriétaires de la résidence Les Tilleuls\nLe président du tribunal a statué en ces termes : “PAR CES MOTIFS, Prorogeons la mission de Maître X, administrateur provisoire, pour une durée de douze mois.”`,
    null,
  ],
  [
    'défaut 2, L1 « Chers copropriétaires, », dispositif sans guillemets',
    `${AJ_PARIS}\n${CITEE}\nAux copropriétaires de la résidence Les Tilleuls\nChers copropriétaires,\nPar ordonnance du 2 mars 2026, le président du tribunal judiciaire a statué en ces termes : PAR CES MOTIFS, Prorogeons la mission de Maître Claire X, administrateur provisoire, pour une durée de douze mois.\nJe reste à votre disposition.`,
    null,
  ],
  [
    'défaut 2, L5 lettre au juge « Monsieur le Président, »',
    `${AJ_PARIS}\nOrdonnance de désignation du 3 mars 2025 - RG 25/01234\nMonsieur le Président du tribunal judiciaire de Paris\nMonsieur le Président,\nPar ordonnance du 3 mars 2025, vous avez statué ainsi : Désignons Maître Claire X en qualité d'administrateur provisoire du syndicat des copropriétaires de la Résidence Les Tilleuls pour une durée de douze mois.\nJe vous prie de trouver ci-joint mon rapport d'étape.`,
    null,
  ],
  [
    'défaut 2, L6 « Mesdames et Messieurs les copropriétaires, », fin de mission',
    `${AJ_PARIS}\nOrdonnance de fin de mission du 2 mars 2026 - RG 25/01234\nMesdames et Messieurs les copropriétaires,\nLe président du tribunal judiciaire a rendu le 2 mars 2026 une ordonnance ainsi rédigée : Mettons fin à la mission de Maître Claire X, administrateur provisoire, à compter du 31 mars 2026.\nLe nouveau syndic élu prendra ses fonctions le 1er avril.`,
    null,
  ],
  [
    'défaut 2, L7 courriel « Bonjour, », taxe',
    `De : Maître Claire X\nÀ : conseil syndical\nObjet : honoraires\nOrdonnance de taxe du 2 mars 2026 - RG 25/01234\nBonjour,\nPour information, le juge a statué : Taxons les honoraires de Maître Claire X, administrateur provisoire, à la somme de 4 000 € HT.\nBien cordialement`,
    null,
  ],
  [
    'défaut 2, L8 rapport de mission, section « 1. Ordonnance de désignation »',
    `RAPPORT DE MISSION DE L'ADMINISTRATEUR PROVISOIRE\nSyndicat des copropriétaires de la Résidence Les Tilleuls — Tribunal judiciaire de Paris — RG 25/01234\n1. Ordonnance de désignation\nPar ordonnance du 3 mars 2025, le président a statué en ces termes : “Désignons Maître Claire X en qualité d'administrateur provisoire du syndicat des copropriétaires pour une durée de douze mois.”\n2. Situation comptable\nLe solde bancaire s'élève à 12 000 €.`,
    null,
  ],
  [
    'défaut 2, L9 notification de l’ordonnance aux copropriétaires',
    `NOTIFICATION DE L'ORDONNANCE DE DÉSIGNATION\nOrdonnance du 3 mars 2025 — Tribunal judiciaire de Paris — RG 25/01234\nChers copropriétaires,\nEn application du décret du 17 mars 1967, je vous notifie l'ordonnance dont le dispositif est le suivant : Désignons Maître Claire X en qualité d'administrateur provisoire du syndicat des copropriétaires pour une durée de douze mois.`,
    null,
  ],
  [
    'défaut 2, H8 note au dossier (« Dispositif : Prorogeons… »)',
    `NOTE AU DOSSIER\nRésidence Les Tilleuls — RG 25/01234\nOrdonnance du 3 mars 2026 reçue ce jour.\nDispositif : Prorogeons la mission de Maître Claire X, administrateur provisoire, pour une durée de douze mois.\nÀ faire : informer le conseil syndical.`,
    null,
  ],
  ['défaut 2, H7 lettre qui cite une ordonnance de référé', H7, null],
  [
    'défaut 2, voisin : titre « Ordonnance du… », « en ces termes : » puis PAR CES MOTIFS à la ligne',
    `${CITEE}\nLe président du tribunal a statué en ces termes :\nPAR CES MOTIFS,\nProrogeons la mission de Maître X, administrateur provisoire, pour une durée de douze mois.`,
    null,
  ],
  [
    'défaut 2, voisin : titre « Ordonnance du… », dispositif entre guillemets droits',
    `${CITEE}\nLe président a statué : "PAR CES MOTIFS, Prorogeons la mission de Maître X, administrateur provisoire."`,
    null,
  ],
  ['défaut 2, voisin : « ORDONNANCE DE TAXE », « Dispositif : Taxons… »', `ORDONNANCE DE TAXE\nDispositif : Taxons les honoraires de Maître X, administrateur provisoire, à 4 000 € HT.`, null],
  [
    'défaut 2, voisin : destinataire « Aux copropriétaires… » avant PAR CES MOTIFS',
    `Ordonnance de fin de mission du 2 mars 2026\nAux copropriétaires de la résidence Les Tilleuls\nPAR CES MOTIFS,\nMettons fin à la mission de Maître X, administrateur provisoire.`,
    null,
  ],
  ['défaut 2, voisin : « Bonjour, » avant PAR CES MOTIFS', `Ordonnance de prorogation du 2 mars 2026\nBonjour,\nPAR CES MOTIFS,\nProrogeons la mission de Maître X, administrateur provisoire.`, null],
  [
    'défaut 2, voisin : extrait recopié sous l’en-tête du cabinet',
    `Maître Claire X\nOrdonnance de taxe du 2 mars 2026\nPAR CES MOTIFS,\nTaxons les honoraires de Maître Claire X, administrateur provisoire, à la somme de 4 000 € HT.`,
    null,
  ],
  [
    'défaut 2, voisin : « SELARL … » puis « ORDONNANCE DE PROROGATION » et son dispositif',
    `SELARL AJ ASSOCIÉS\nORDONNANCE DE PROROGATION\nPAR CES MOTIFS,\nProrogeons pour douze mois la mission de Maître Claire X, administrateur provisoire.`,
    null,
  ],
  [
    'défaut 3, X1 taxe des honoraires de l’expert désigné à la requête de l’AP',
    `${TJ_PARIS}\nORDONNANCE DE TAXE\nPAR CES MOTIFS,\nTaxons les honoraires de l'expert désigné à la requête de Maître X, administrateur provisoire, à la somme de 3 000 €.`,
    AUTRE,
  ],
  [
    'défaut 3, X4 taxe des frais du commissaire de justice mandaté par l’AP',
    `${TJ_PARIS}\nORDONNANCE DE TAXE\nPAR CES MOTIFS,\nTaxons les frais de Maître Z, commissaire de justice mandaté par Maître X, administrateur provisoire, à la somme de 800 €.`,
    AUTRE,
  ],
  [
    'défaut 3, X2 prorogation de la mission de l’expert commis à la demande de l’AP',
    `${TJ_PARIS}\nORDONNANCE\nPAR CES MOTIFS,\nProrogeons de six mois la mission de l'expert commis à la demande de Maître X, administrateur provisoire.`,
    AUTRE,
  ],
  [
    'défaut 3, X8 prorogation du mandat du séquestre désigné à la requête de l’AP',
    `${TJ_PARIS}\nORDONNANCE\nPAR CES MOTIFS,\nProrogeons pour six mois le mandat du séquestre désigné à la requête de Maître X, administrateur provisoire.`,
    AUTRE,
  ],
  [
    'défaut 3, X3 fin de la mission de l’expert désigné à la requête de l’AP',
    `${TJ_PARIS}\nORDONNANCE DE REMPLACEMENT D'EXPERT\nPAR CES MOTIFS,\nMettons fin à la mission de l'expert désigné à la requête de Maître X, administrateur provisoire.`,
    AUTRE,
  ],
  [
    'défaut 3, X7 fin de la mission du technicien désigné par l’AP',
    `${TJ_PARIS}\nORDONNANCE\nPAR CES MOTIFS,\nMettons fin à la mission de M. T, technicien désigné par Maître X, administrateur provisoire.`,
    AUTRE,
  ],
  [
    'défaut 3, X5 expertise : l’AP partie « prise en qualité d’administrateur provisoire »',
    `${TJ_PARIS}\nORDONNANCE DE RÉFÉRÉ\nPAR CES MOTIFS,\nOrdonnons une expertise ; Désignons M. Pierre T, architecte, avec mission de convoquer les parties, dont Maître X prise en qualité d'administrateur provisoire du syndicat des copropriétaires, et de décrire les désordres affectant la toiture.`,
    AUTRE,
  ],
  [
    'défaut 3, X6 expertise : « agissant en qualité d’administrateur provisoire »',
    `${TJ_PARIS}\nORDONNANCE DE RÉFÉRÉ\nEntre le syndicat des copropriétaires de la Résidence Les Tilleuls, représenté par Maître X, et la société Y\nPAR CES MOTIFS,\nDésignons en qualité d'expert M. Pierre T, avec mission d'entendre les parties, notamment Maître X agissant en qualité d'administrateur provisoire, et de décrire les désordres.`,
    AUTRE,
  ],
  [
    'défaut 3, voisin : « Désignons M. Y en qualité d’expert pour assister Maître X en qualité d’administrateur provisoire »',
    `${TJ_PARIS}\nORDONNANCE DE RÉFÉRÉ\nPAR CES MOTIFS,\nDésignons M. Y en qualité d'expert pour assister Maître X en qualité d'administrateur provisoire.`,
    AUTRE,
  ],
  [
    'défaut 3, voisin : « Désignons M. Y, lequel entendra Maître X agissant en qualité d’administrateur provisoire »',
    `${TJ_PARIS}\nORDONNANCE DE RÉFÉRÉ\nPAR CES MOTIFS,\nDésignons M. Y, architecte, lequel entendra Maître X agissant en qualité d'administrateur provisoire.`,
    AUTRE,
  ],
  [
    'défaut 3, voisin : « Désignons M. Y, architecte, afin d’entendre Maître X prise en qualité d’administrateur provisoire »',
    `${TJ_PARIS}\nORDONNANCE DE RÉFÉRÉ\nPAR CES MOTIFS,\nDésignons M. Y, architecte, afin d'entendre Maître X prise en qualité d'administrateur provisoire.`,
    AUTRE,
  ],
  [
    'défaut 3, voisin : « Prorogeons la mission de Maître Z, commissaire de justice, désigné à la requête de Maître X »',
    `${TJ_PARIS}\nORDONNANCE\nPAR CES MOTIFS,\nProrogeons de trois mois la mission de Maître Z, commissaire de justice, désigné à la requête de Maître X, administrateur provisoire.`,
    AUTRE,
  ],
  [
    'défaut 3, voisin : « Taxons les honoraires de Maître Z, notaire, à la charge de Maître X, administrateur provisoire »',
    `${TJ_PARIS}\nORDONNANCE DE TAXE\nPAR CES MOTIFS,\nTaxons les honoraires de Maître Z, notaire, à la charge de Maître X, administrateur provisoire, à la somme de 900 €.`,
    AUTRE,
  ],
  [
    'défaut 4, R1 rectificative, nouvelle rédaction sans guillemets',
    `${TJ_PARIS}\nORDONNANCE RECTIFICATIVE\nPAR CES MOTIFS,\nOrdonnons la rectification de l'ordonnance du 12 janvier 2025 ; Disons que son dispositif est désormais rédigé comme suit : Désignons Maître Claire X en qualité d'administrateur provisoire du syndicat des copropriétaires pour une durée de douze mois.`,
    AUTRE,
  ],
  [
    'défaut 4, R2 rectificative, nouvelle rédaction entre guillemets droits',
    `${TJ_PARIS}\nORDONNANCE RECTIFICATIVE D'ERREUR MATÉRIELLE\nPAR CES MOTIFS,\nDisons qu'il y a lieu de lire : "Désignons Maître Claire X en qualité d'administrateur provisoire" au lieu de "Désignons Maître Claire Y en qualité d'administrateur provisoire".`,
    AUTRE,
  ],
  [
    'défaut 4, R3 « Rectifions… ; Disons qu’il convient de lire : Désignons… »',
    `${TJ_PARIS}\nORDONNANCE\nVu l'ordonnance du 12 janvier 2025 entachée d'une erreur matérielle,\nPAR CES MOTIFS,\nRectifions l'erreur matérielle ; Disons qu'il convient de lire : Désignons Maître Claire X en qualité d'administrateur provisoire.`,
    AUTRE,
  ],
  [
    'défaut 4, la nouvelle rédaction suit un « ; », à la ligne',
    `${TJ_PARIS}\nORDONNANCE RECTIFICATIVE D'ERREUR MATÉRIELLE\nPAR CES MOTIFS,\nDisons que le dispositif de l'ordonnance du 12 janvier 2025 est rectifié comme suit ;\nDésignons Maître Claire X en qualité d'administrateur provisoire du syndicat des copropriétaires.`,
    AUTRE,
  ],
  [
    'défaut 4, rectificative d’une ordonnance de référé',
    `${TJ_PARIS}\nORDONNANCE RECTIFICATIVE\nPAR CES MOTIFS,\nRectifions l'erreur matérielle affectant l'ordonnance de référé du 3 mars 2026 ; Disons qu'il y a lieu de lire « 12 000 € » au lieu de « 1 200 € ».`,
    AUTRE,
  ],
  [
    'en-tête : ligne « TRIBUNAL … — ORDONNANCE DE RÉFÉRÉ — … » d’un seul tenant',
    `TRIBUNAL JUDICIAIRE DE TOURS — ORDONNANCE DE RÉFÉRÉ — RG 26/1 — PAR CES MOTIFS, Ordonnons la communication des pièces.`,
    AUTRE,
  ],
  ['en-tête : ligne « SARL Martin — DEVIS N° … »', `SARL Martin — DEVIS N° 2026-45\nRavalement : 45 000 € HT, TVA 10 % — Bon pour accord`, DEVIS],
]

const EXPROPRIATION_PARCELLES = `TRIBUNAL JUDICIAIRE DE TOURS\nJuge de l'expropriation\nRG 26/00456\nORDONNANCE PORTANT TRANSFERT DE PROPRIÉTÉ\nPAR CES MOTIFS,\nDéclarons expropriés, au profit de la commune de Tours, les biens cadastrés section AB n° 123, d'une contenance de 5 a 20 ca, et section AB n° 124, figurant au relevé de propriété annexé.`
const EXPROPRIATION_LOTS = `TRIBUNAL JUDICIAIRE DE TOURS\nJuge de l'expropriation\nORDONNANCE D'EXPROPRIATION\nPAR CES MOTIFS,\nDéclarons expropriés au profit de la commune les lots n° 3 et 4 de l'état descriptif de division, avec les 120/1000 tantièmes des parties communes attachés, tels qu'ils résultent du règlement de copropriété du 2 mai 1972.`
const MODIFICATIF_AP = `MODIFICATIF AU RÈGLEMENT DE COPROPRIÉTÉ ET À L'ÉTAT DESCRIPTIF DE DIVISION\nRésidence Les Tilleuls\nDécidé par Maître X, administrateur provisoire désignée par ordonnance du tribunal judiciaire de Tours (RG 25/01234)…\nArticle 1 : les tantièmes de parties communes du lot n° 12 sont portés à 120/10000.`

/** Pièces du mandat évaluées chacune pour elle-même : une ordonnance, un règlement et un cadastre candidats ensemble. */
const PIECES_DU_MANDAT: Cas[] = [
  ['ordonnance d’expropriation qui désigne ses parcelles cadastrées', EXPROPRIATION_PARCELLES, EXPROPRIATION],
  ['même ordonnance : le cadastre aussi candidat', EXPROPRIATION_PARCELLES, CADASTRE],
  ['ordonnance d’expropriation de lots (EDD, tantièmes, règlement)', EXPROPRIATION_LOTS, EXPROPRIATION],
  ['même ordonnance : le règlement aussi candidat', EXPROPRIATION_LOTS, REGLEMENT],
  [
    'désignation qui vise le règlement, l’EDD, les parties communes et les tantièmes, sans RG',
    `TRIBUNAL JUDICIAIRE DE TOURS\nORDONNANCE\nPAR CES MOTIFS,\nDésignons Maître X en qualité d'administrateur provisoire, avec mission de faire respecter le règlement de copropriété et l'état descriptif de division, notamment la répartition des tantièmes de parties communes.`,
    DESIGNATION,
  ],
  ['modificatif établi par l’AP qui cite son ordonnance : le règlement candidat', MODIFICATIF_AP, REGLEMENT],
]

const E3_TOUR_3 = `Maître Paul NOTAIRE\nÉtat daté — lot n° 12\nNous vous remercions de bien vouloir nous adresser l'état daté prévu par l'article 5 du décret du 17 mars 1967 en vue de la vente de M. A, cédant.`

/** Lettres du notaire qui demandent l'état daté : la demande candidate (à côté de l'état daté que l'objet nomme). */
const DEMANDES_ETAT_DATE: Cas[] = [
  ['E3 du tour 3, « bien vouloir nous adresser l’état daté »', E3_TOUR_3, DEMANDE_ETAT_DATE],
  ['« Objet : demande d’un état daté »', `Maître Paul Y, notaire\nObjet : demande d'un état daté — vente du lot n° 12\nNous vous prions de nous adresser l'état daté (article 5 du décret du 17 mars 1967).`, DEMANDE_ETAT_DATE],
  ['« DEMANDE DE DÉLIVRANCE D’UN ÉTAT DATÉ »', `DEMANDE DE DÉLIVRANCE D'UN ÉTAT DATÉ\nMaître Paul Y, notaire à Tours — vente du lot n° 12 (article 5 du décret du 17 mars 1967).`, DEMANDE_ETAT_DATE],
  ['« demande de l’état daté »', `Maître Paul Y, notaire — demande de l'état daté du lot n° 12, vente A / B.`, DEMANDE_ETAT_DATE],
  ['« me faire parvenir l’état daté »', `Maître Paul Y, notaire\nJe vous saurais gré de me faire parvenir l'état daté du lot n° 12 (vente A / B).`, DEMANDE_ETAT_DATE],
]

const TJ_PORTALIS = 'TRIBUNAL JUDICIAIRE DE PARIS\nN° RG 26/01234 - N° Portalis 35L7-W-B7K-CX\n'
const TJ_RG = 'TRIBUNAL JUDICIAIRE DE PARIS\nN° RG 26/01234\n'
const AJ_CABINET = 'SELARL AJ ASSOCIÉS\nAdministrateurs judiciaires\n12 rue de la Paix\n75002 Paris\n'
const AJ_LETTRE = 'SELARL AJ ASSOCIÉS\n12 rue de la Paix\n75002 Paris\nParis, le 3 mars 2026\n'
const PV_ORDINAIRE = `PROCÈS-VERBAL DE L'ASSEMBLÉE GÉNÉRALE ORDINAIRE DU 12 JUIN 2026\nFeuille de présence : 12 copropriétaires présents ou représentés.\nRésolution n° 1 adoptée.`
const FACTURE_SIRET = `SIRET 123 456 789 00012\nFACTURE N° F-2026-14\nTotal HT 1 000,00 € — TVA 10 % — Net à payer 1 100,00 €`
const DESIGNE_AP = `Désignons Maître Jeanne DUPONT en qualité d'administrateur provisoire du syndicat des copropriétaires`
const F1_HONORAIRES = `${AJ_CABINET}FACTURE D'HONORAIRES N° 2026-118\nMission d'administration provisoire du syndicat des copropriétaires\nHonoraires HT 2 500,00 € — TVA 20 % 500,00 € — Total TTC 3 000,00 €`

/** Dernier contrôle de la refonte (resultat-64-refonte.json, « restes ») : sondes ctrl64-contrat-t3/b1 à b6. */
const RESTES_REFONTE: Cas[] = [
  // b1 — ordonnances : expéditions, tiers commis ou taxés, injonction de faire
  ['O1 expédition « EXTRAIT DES MINUTES »', `EXTRAIT DES MINUTES DU GREFFE DU TRIBUNAL JUDICIAIRE DE PARIS\nRÉPUBLIQUE FRANÇAISE\nAU NOM DU PEUPLE FRANÇAIS\n${TJ_PORTALIS}ORDONNANCE PORTANT DÉSIGNATION D'UN ADMINISTRATEUR PROVISOIRE\nPAR CES MOTIFS,\n${DESIGNE_AP} pour une durée de douze mois.`, DESIGNATION],
  ['O2 « COPIE EXÉCUTOIRE » en tête', `COPIE EXÉCUTOIRE\n${TJ_PORTALIS}ORDONNANCE PORTANT DÉSIGNATION D'UN ADMINISTRATEUR PROVISOIRE\nPAR CES MOTIFS,\n${DESIGNE_AP} pour une durée de douze mois.`, DESIGNATION],
  ['O3 « Le Président » sous le tribunal', `${TJ_PORTALIS}Le Président\nORDONNANCE SUR REQUÊTE\nPAR CES MOTIFS,\n${DESIGNE_AP} pour une durée de douze mois.`, DESIGNATION],
  [
    'O4 « Commettons » un commissaire de justice « en présence de Maître X, désignée en qualité d’AP »',
    `${TJ_PORTALIS}ORDONNANCE SUR REQUÊTE\nVu la requête présentée par Maître Jeanne DUPONT, administrateur provisoire,\nPAR CES MOTIFS,\nAutorisons la requérante à faire pénétrer dans le local technique situé au sous-sol de l'immeuble ;\nCommettons Maître Paul MARTIN, commissaire de justice, à l'effet de se rendre sur les lieux en présence de Maître Jeanne DUPONT, désignée en qualité d'administrateur provisoire du syndicat des copropriétaires, et d'y dresser procès-verbal de ses constatations.`,
    AUTRE,
  ],
  [
    'O5 séquestre « des fonds détenus au nom de Maître X, désignée en qualité d’AP »',
    `${TJ_PORTALIS}ORDONNANCE DE RÉFÉRÉ\nPAR CES MOTIFS,\nOrdonnons la consignation des fonds ;\nDésignons la CARPA de Paris séquestre des fonds détenus au nom de Maître Jeanne DUPONT, désignée en qualité d'administrateur provisoire du syndicat des copropriétaires.`,
    AUTRE,
  ],
  [
    'O6 taxe de l’expert « au titre des frais de l’administration provisoire »',
    `${TJ_PORTALIS}ORDONNANCE DE TAXE\nPAR CES MOTIFS,\nTaxons à la somme de 3 600 € TTC les honoraires de M. Pierre T, expert, qui seront prélevés sur les fonds du syndicat des copropriétaires au titre des frais de l'administration provisoire.`,
    AUTRE,
  ],
  ['O7 « Déchargeons Maître X de sa mission d’AP »', `${TJ_PORTALIS}ORDONNANCE DE FIN DE MISSION\nPAR CES MOTIFS,\nDéchargeons Maître Jeanne DUPONT de sa mission d'administrateur provisoire du syndicat des copropriétaires.`, FIN],
  ['O8 « Mettons fin à la mission d’AP de Maître X »', `${TJ_PORTALIS}ORDONNANCE\nPAR CES MOTIFS,\nMettons fin à la mission d'administrateur provisoire de Maître Jeanne DUPONT à compter du 1er juillet 2026.`, FIN],
  ['O9 « Prorogeons la mission d’AP de Maître X »', `${TJ_PORTALIS}ORDONNANCE DE PROROGATION\nPAR CES MOTIFS,\nProrogeons pour une durée de douze mois la mission d'administrateur provisoire de Maître Jeanne DUPONT.`, PROLONGATION],
  ['O10 « Nommons Maître X administrateur provisoire »', `${TJ_PORTALIS}ORDONNANCE PORTANT DÉSIGNATION D'UN ADMINISTRATEUR PROVISOIRE\nPAR CES MOTIFS,\nNommons Maître Jeanne DUPONT administrateur provisoire du syndicat des copropriétaires pour une durée de douze mois.`, DESIGNATION],
  [
    'O11 expert désigné « en présence de Maître X, désignée en qualité d’AP »',
    `${TJ_PORTALIS}ORDONNANCE DE RÉFÉRÉ\nPAR CES MOTIFS,\nDésignons M. Pierre T, architecte DPLG, expert inscrit sur la liste de la cour d'appel de Paris, à l'effet d'examiner les désordres en présence de Maître Jeanne DUPONT, désignée en qualité d'administrateur provisoire.`,
    AUTRE,
  ],
  [
    'O12 émoluments du commissaire de justice « au titre des frais de l’AP »',
    `${TJ_PORTALIS}ORDONNANCE DE TAXE\nPAR CES MOTIFS,\nTaxons les émoluments de Maître Paul MARTIN, commissaire de justice, à la somme de 450 €, dus au titre des frais de l'administrateur provisoire.`,
    AUTRE,
  ],
  [
    'O13 délai de l’expert prorogé « compte tenu des fonctions de l’AP »',
    `${TJ_PORTALIS}ORDONNANCE\nPAR CES MOTIFS,\nProrogeons de quatre mois le délai imparti à M. Pierre T, expert, pour déposer son rapport, compte tenu des fonctions de l'administrateur provisoire.`,
    AUTRE,
  ],
  [
    'O14 injonction de faire judiciaire (travaux)',
    `${TJ_PORTALIS}INJONCTION DE FAIRE\nOrdonnance portant injonction de faire\nVu la requête présentée par le syndicat des copropriétaires, représenté par Maître Jeanne DUPONT, administrateur provisoire,\nEnjoignons à la société BATI-SUD d'achever les travaux de réfection de la toiture dans un délai de deux mois.`,
    AUTRE,
  ],
  [
    'O15 « Désignons Maître Y en remplacement de Maître X, en qualité d’AP »',
    `${TJ_PORTALIS}ORDONNANCE DE REMPLACEMENT\nPAR CES MOTIFS,\nDésignons Maître Paul DURAND en remplacement de Maître Jeanne DUPONT, en qualité d'administrateur provisoire du syndicat des copropriétaires.`,
    DESIGNATION,
  ],
  ['O16 administrateur provisoire d’une société (hors copropriété)', `TRIBUNAL DE COMMERCE DE PARIS\nORDONNANCE\nPAR CES MOTIFS,\nDésignons Maître Jeanne DUPONT en qualité d'administrateur provisoire de la SCI LES TILLEULS.`, null],
  [
    'O17 « Commettons » un commissaire de justice, « désignée comme administrateur provisoire » citée',
    `${TJ_PORTALIS}ORDONNANCE SUR REQUÊTE\nPAR CES MOTIFS,\nCommettons Maître Paul MARTIN, commissaire de justice, à l'effet de signifier la présente ordonnance à tous les copropriétaires et à Maître Jeanne DUPONT, désignée comme administrateur provisoire.`,
    AUTRE,
  ],
  // b2 — factures, assemblées, état daté, mise en demeure, arrêtés, devis, injonctions
  ['F1 facture d’honoraires de l’AJ', F1_HONORAIRES, FACTURE_HONORAIRES],
  ['F2 facture pro forma', `SARL Plomberie Durand\n12 rue des Lilas 75011 Paris\nFACTURE PRO FORMA N° PF-2026-07\nRemplacement de la colonne d'eau\nTotal HT 8 000,00 € — TVA 10 % — Net à payer 8 800,00 €\nValable 30 jours`, null],
  ['F3 facture d’honoraires de l’ancien syndic', `CABINET GESTIMMO\nSyndic de copropriété\nFACTURE N° 2026-55\nHonoraires de gestion courante — 1er trimestre 2026\nTotal HT 1 200,00 € — TVA 20 % — TTC 1 440,00 €`, null],
  ['P1 procès-verbal sous l’identification du syndicat', `Syndicat des copropriétaires de la Résidence Les Tilleuls\n12 rue des Lilas 75011 Paris\nPROCÈS-VERBAL DE L'ASSEMBLÉE GÉNÉRALE ORDINAIRE DU 12 JUIN 2026\nFeuille de présence : 12 copropriétaires présents ou représentés.\nRésolution n° 1 : approbation des comptes. Résolution adoptée.`, PV],
  [
    'P2 convocation sous l’adresse du destinataire',
    `CABINET GESTIMMO\n3 avenue Foch 75016 Paris\nMadame Jeanne MARTIN\n8 rue des Lilas\n75011 Paris\nParis, le 12 mai 2026\nCONVOCATION À L'ASSEMBLÉE GÉNÉRALE ORDINAIRE\nMadame,\nVous êtes convoquée à l'assemblée générale qui se tiendra le 12 juin 2026. Ordre du jour : approbation des comptes.`,
    CONVOCATION,
  ],
  ['P3 convocation sous « Lettre recommandée avec accusé de réception »', `${AJ_CABINET}Lettre recommandée avec accusé de réception\nCONVOCATION À L'ASSEMBLÉE GÉNÉRALE\nMadame, Monsieur,\nVous êtes convoqués à l'assemblée générale qui se tiendra le 12 juin 2026. Ordre du jour : élection du syndic.`, CONVOCATION],
  ['P4 procès-verbal, « DU 12 JUIN 2026 » à la ligne', `PROCÈS-VERBAL DE L'ASSEMBLÉE GÉNÉRALE ORDINAIRE\nDU 12 JUIN 2026\nFeuille de présence : 12 copropriétaires présents ou représentés.\nRésolution n° 1 : approbation des comptes. Résolution adoptée.`, PV],
  ['P5 annulation de la convocation', `${AJ_CABINET}Convocation à l'assemblée générale du 12 juin 2026 — ANNULATION\nL'assemblée générale qui devait se tenir le 12 juin 2026 n'aura pas lieu. Une nouvelle convocation vous sera adressée.`, null],
  ['P6 procès-verbal, « Le 12 juin 2026 à 18 heures »', `PROCÈS-VERBAL DE L'ASSEMBLÉE GÉNÉRALE\nLe 12 juin 2026 à 18 heures, les copropriétaires se sont réunis en assemblée générale.\nFeuille de présence annexée. Résolution n° 1 adoptée.`, PV],
  ['E1 état daté sous l’en-tête du syndic', `CABINET GESTIMMO\nÉTAT DATÉ\nArticle 5 du décret du 17 mars 1967\nLot n° 12 — Cédant : M. A\nPremière partie : sommes dues par le cédant.`, ETAT_DATE],
  ['E2 demande d’état daté sous l’en-tête du notaire', `Maître Paul NOTAIRE\nNotaire associé\n4 place du Marché 37000 Tours\nDEMANDE D'ÉTAT DATÉ\nVente : M. A à M. B — lot n° 12\nArticle 5 du décret du 17 mars 1967.`, DEMANDE_ETAT_DATE],
  ['E3 « État daté » en tête d’un courrier du notaire, sans formule d’appel', E3_TOUR_3, DEMANDE_ETAT_DATE],
  ['M1 mise en demeure du fournisseur de chauffage', `Énergie Services SAS\nMISE EN DEMEURE DE PAYER LES CHARGES DE CHAUFFAGE COLLECTIF\nÀ défaut de règlement des factures impayées sous huit jours, nous suspendrons la fourniture.`, null],
  [
    'M2 mise en demeure adressée à l’AP par un copropriétaire',
    `M. Paul A\nMise en demeure du copropriétaire à l'administrateur provisoire de produire les justificatifs des charges\nJe vous mets en demeure de me communiquer les sommes dues et les justificatifs sous huit jours.`,
    null,
  ],
  [
    'A1 arrêté de mainlevée de péril',
    `MAIRIE DE TOURS\nARRÊTÉ DE MAINLEVÉE DE PÉRIL N° 2026-14\nLe maire de Tours,\nConsidérant que les travaux prescrits ont été réalisés,\nArrête : la mainlevée de l'arrêté de péril du 3 mars 2025 est prononcée.`,
    null,
  ],
  [
    'A2 arrêté de mise en sécurité',
    `VILLE DE MARSEILLE\nDirection de la prévention et de la gestion des risques\nARRÊTÉ N° 2026_01234_VDM\nARRÊTÉ DE MISE EN SÉCURITÉ – PROCÉDURE URGENTE\nLe maire de Marseille,\nArrête : l'immeuble est interdit d'habiter.`,
    PERIL,
  ],
  ['D1 devis du cabinet pour l’état daté', `${AJ_CABINET}DEVIS — ÉTABLISSEMENT DE L'ÉTAT DATÉ\nHonoraires : 380,00 € HT — TVA 20 % — 456,00 € TTC\nValable 30 jours`, null],
  ['D2 « Devis de prestations : état daté »', `${AJ_CABINET}Devis de prestations : état daté. Honoraires 380,00 € HT, TVA 20 %, bon pour accord.`, null],
  [
    'I1 injonction de payer',
    `TRIBUNAL JUDICIAIRE DE PARIS\nINJONCTION DE PAYER\nOrdonnance portant injonction de payer\nEnjoignons à M. A de payer au syndicat des copropriétaires la somme de 2 400 € au titre des charges impayées ; travaux.`,
    null,
  ],
  [
    'I2 « INJONCTION » du syndicat à une entreprise',
    `INJONCTION\nLe syndicat des copropriétaires, représenté par Maître X, administrateur provisoire, enjoint à l'entreprise BATI-SUD de reprendre les travaux de façade.`,
    null,
  ],
  // b3 — décisions qui n'accordent pas la mesure, tiers
  [
    'R1 « Rejette la demande de prorogation de la mission de Maître X, AP »',
    `${TJ_RG}ORDONNANCE STATUANT SUR UNE DEMANDE DE PROROGATION\nPAR CES MOTIFS,\nRejette la demande de prorogation de la mission de Maître Jeanne DUPONT, administrateur provisoire du syndicat des copropriétaires ;\nLaisse les dépens à la charge du syndicat.`,
    PROLONGATION,
  ],
  [
    'R2 « Déclarons irrecevable la requête en prorogation »',
    `${TJ_RG}ORDONNANCE SUR REQUÊTE EN PROROGATION DE MISSION\nPAR CES MOTIFS,\nDéclarons irrecevable la requête en prorogation de la mission de Maître Jeanne DUPONT, administrateur provisoire.`,
    PROLONGATION,
  ],
  [
    'R3 « Déclarons irrecevable l’action en désignation »',
    `${TJ_RG}ORDONNANCE DE DÉSIGNATION\nPAR CES MOTIFS,\nDéclarons irrecevable l'action en désignation de Maître Jeanne DUPONT en qualité d'administrateur provisoire.`,
    DESIGNATION,
  ],
  [
    'R4 « Annulons l’ordonnance de taxe »',
    `${TJ_RG}ORDONNANCE DE TAXE\nPAR CES MOTIFS,\nAnnulons l'ordonnance de taxe du 3 mars 2026 portant sur les honoraires de Maître Jeanne DUPONT, administrateur provisoire.`,
    TAXE,
  ],
  [
    'R5 « Déclarons mal fondée la demande de fin de mission »',
    `${TJ_RG}ORDONNANCE DE FIN DE MISSION\nPAR CES MOTIFS,\nDéclarons mal fondée la demande de fin de mission de Maître Jeanne DUPONT, administrateur provisoire.`,
    FIN,
  ],
  [
    'R6 « Sursoyons à statuer sur la prorogation »',
    `${TJ_RG}ORDONNANCE DE PROROGATION\nPAR CES MOTIFS,\nSursoyons à statuer sur la prorogation de la mission de Maître Jeanne DUPONT, administrateur provisoire, jusqu'au dépôt du rapport.`,
    PROLONGATION,
  ],
  [
    'R7 « Renvoyons l’examen de la demande de prorogation »',
    `${TJ_RG}ORDONNANCE DE PROROGATION\nPAR CES MOTIFS,\nRenvoyons à l'audience du 3 juin 2026 l'examen de la demande de prorogation de la mission de Maître Jeanne DUPONT, administrateur provisoire.`,
    PROLONGATION,
  ],
  ['R8 fin de la mission de l’expert « dans le cadre de la mission de l’AP »', `${TJ_RG}ORDONNANCE\nPAR CES MOTIFS,\nMettons fin à la mission de M. Pierre T, expert, désigné dans le cadre de la mission de l'administrateur provisoire.`, AUTRE],
  [
    'R9 expert « au contradictoire de Maître X, désignée en qualité d’AP »',
    `${TJ_RG}ORDONNANCE DE RÉFÉRÉ\nPAR CES MOTIFS,\nDésignons M. Pierre T, architecte, expert près la cour d'appel de Paris, à l'effet de visiter l'immeuble au contradictoire de Maître Jeanne DUPONT, désignée en qualité d'administrateur provisoire.`,
    AUTRE,
  ],
  [
    'R10 « Commet Maître Z, commissaire de justice, … en présence de Maître X, nommée en qualité d’AP »',
    `${TJ_RG}ORDONNANCE SUR REQUÊTE\nPAR CES MOTIFS,\nAutorise la requérante à pénétrer dans les parties communes ;\nCommet Maître Paul MARTIN, commissaire de justice, à l'effet de dresser constat en présence de Maître Jeanne DUPONT, nommée en qualité d'administrateur provisoire.`,
    AUTRE,
  ],
  [
    'R11 mandataire ad hoc, l’AP conservant ses fonctions',
    `${TJ_RG}ORDONNANCE\nPAR CES MOTIFS,\nDésignons Maître Jeanne DUPONT, administrateur judiciaire, mandataire ad hoc du syndicat des copropriétaires, l'administrateur provisoire précédemment désigné conservant ses fonctions.`,
    AUTRE,
  ],
  [
    'R12 syndic désigné à l’issue de la mission de l’AP',
    `${TJ_RG}ORDONNANCE\nPAR CES MOTIFS,\nDésignons le cabinet GESTIMMO en qualité de syndic à l'issue de la mission de Maître Jeanne DUPONT, intervenue comme administrateur provisoire.`,
    AUTRE,
  ],
  // b4 — expropriation, en-têtes
  [
    'X1 « ORDONNANCE PORTANT TRANSFERT DE PROPRIÉTÉ », 3e personne',
    `TRIBUNAL JUDICIAIRE DE PARIS\nJuge de l'expropriation\nN° RG 26/00456\nORDONNANCE PORTANT TRANSFERT DE PROPRIÉTÉ\nPAR CES MOTIFS,\nDéclare expropriés, au profit de la commune de Paris, les biens et droits immobiliers figurant à l'état parcellaire annexé ;\nDit que la présente ordonnance sera notifiée aux expropriés.`,
    EXPROPRIATION,
  ],
  [
    'X2 « Ordonnons le transfert de propriété … des lots expropriés »',
    `TRIBUNAL JUDICIAIRE DE PARIS\nN° RG 26/00456\nORDONNANCE\nPAR CES MOTIFS,\nOrdonnons le transfert de propriété au profit de la commune de Paris des lots expropriés figurant à l'état parcellaire.`,
    EXPROPRIATION,
  ],
  ['H1 procès-verbal sous « GESTIMMO Syndic de copropriété »', `GESTIMMO\nSyndic de copropriété\n${PV_ORDINAIRE}`, PV],
  ['H2 procès-verbal sous « Copropriété Les Tilleuls »', `Copropriété Les Tilleuls\n${PV_ORDINAIRE}`, PV],
  ['H3 procès-verbal sous « Page 1/12 »', `Page 1/12\n${PV_ORDINAIRE}`, PV],
  ['H4 facture sous « SIRET … »', `Plomberie Durand\n${FACTURE_SIRET}`, FACTURE],
  ['H5 facture sous « SAS Plomberie Durand »', `SAS Plomberie Durand\n${FACTURE_SIRET}`, FACTURE],
  ['H6 « ORDONNANCE DU PREMIER PRÉSIDENT » de la cour d’appel', `COUR D'APPEL DE PARIS\nPôle 1 - Chambre 2\nORDONNANCE DU PREMIER PRÉSIDENT\nPAR CES MOTIFS,\n${DESIGNE_AP}.`, DESIGNATION],
  [
    'H7 « Madame, Monsieur, » puis le titre de la convocation',
    `Madame, Monsieur,\nCONVOCATION À L'ASSEMBLÉE GÉNÉRALE ORDINAIRE\nVous êtes convoqués à l'assemblée générale qui se tiendra le 12 juin 2026. Ordre du jour : approbation des comptes.`,
    CONVOCATION,
  ],
  ['H8 état daté sous « Syndicat des copropriétaires … »', `Syndicat des copropriétaires Résidence Les Tilleuls\nÉTAT DATÉ\nArticle 5 du décret du 17 mars 1967\nLot n° 12 — Cédant : M. A\nPremière partie : sommes dues par le cédant.`, ETAT_DATE],
  ['H9 « Le Président du tribunal judiciaire de Paris, » avant le titre', `TRIBUNAL JUDICIAIRE DE PARIS\nLe Président du tribunal judiciaire de Paris,\nORDONNANCE SUR REQUÊTE\nPAR CES MOTIFS,\n${DESIGNE_AP}.`, DESIGNATION],
  ['H10 « Nous, … vice-présidente » sous le titre', `TRIBUNAL JUDICIAIRE DE PARIS\nORDONNANCE SUR REQUÊTE\nNous, Jeanne Y, vice-présidente, statuant par délégation du président,\nPAR CES MOTIFS,\n${DESIGNE_AP}.`, DESIGNATION],
  // b5 — courriers dont la formule d'appel nomme le destinataire, courriels
  [
    'L1 réponse au notaire, « Maître Dupont, »',
    `${AJ_LETTRE}État daté — lot n° 12 — vente A / B\nMaître Dupont,\nEn réponse à votre demande, nous vous adressons ci-joint l'état daté prévu par l'article 5 du décret du 17 mars 1967, le cédant restant redevable de 340 €.`,
    null,
  ],
  ['L2 contestation de facture, « Monsieur Durand, »', `${AJ_LETTRE}Facture n° F-2026-14 du 3 février 2026\nMonsieur Durand,\nNous contestons votre facture d'un montant de 1 000 € HT, TVA 10 %, les travaux n'ayant pas été réalisés.`, null],
  [
    'L3 lettre au copropriétaire, « Madame Martin, »',
    `${AJ_LETTRE}Mise en demeure — charges de copropriété impayées\nMadame Martin,\nÀ défaut de règlement des sommes dues sous huit jours, le syndicat engagera une procédure.`,
    MISE_EN_DEMEURE,
  ],
  [
    'L4 transmission du procès-verbal, « Madame Martin, »',
    `${AJ_LETTRE}Procès-verbal de l'assemblée générale du 12 février 2026\nMadame Martin,\nVous trouverez ci-joint le procès-verbal de l'assemblée générale ; la résolution n° 3 a été adoptée.`,
    PV,
  ],
  [
    'L5 relance de la demande d’état daté, « Cher Monsieur, »',
    `Maître Paul NOTAIRE\nDEMANDE D'ÉTAT DATÉ — 2E RELANCE\nCher Monsieur,\nSauf erreur, nous n'avons pas reçu l'état daté demandé le 3 février pour la vente du lot 12 (article 5 du décret du 17 mars 1967).`,
    DEMANDE_ETAT_DATE,
  ],
  ['L6 courriel transféré « TR: Convocation … »', `TR: Convocation à l'assemblée générale du 12 juin 2026\nBonjour,\nJe vous transfère la convocation : l'assemblée générale se tiendra le 12 juin 2026, ordre du jour joint.`, null],
  [
    'L7 courriel « De : … Envoyé : … Objet : Convocation… »',
    `De : Jeanne Dupont\nEnvoyé : mardi 3 mars 2026 10:12\nÀ : Paul Martin\nObjet : Convocation à l'assemblée générale\nBonjour, l'assemblée générale se tiendra le 12 juin 2026, ordre du jour joint.`,
    null,
  ],
  [
    'L8 accusé de réception de la convocation',
    `Convocation à l'assemblée générale du 12 juin 2026 — accusé de réception\nJe soussigné M. A, copropriétaire, reconnais avoir reçu la convocation à l'assemblée générale.`,
    null,
  ],
  // b6 — projets, désignation à la 3e personne
  ['S1 procès-verbal « — PROJET SOUMIS À RELECTURE »', `PROCÈS-VERBAL DE L'ASSEMBLÉE GÉNÉRALE DU 12 JUIN 2026 — PROJET SOUMIS À RELECTURE\nRésolution n° 1 : approbation des comptes. Résolution adoptée.`, PV],
  ['S2 état daté « — PROJET NON SIGNÉ »', `ÉTAT DATÉ — PROJET NON SIGNÉ\nArticle 5 du décret du 17 mars 1967\nLot n° 12 — Cédant : M. A`, ETAT_DATE],
  [
    'S3 convocation au titre en minuscules',
    `Convocation à l'assemblée générale ordinaire du 12 juin 2026\nMadame, Monsieur,\nVous êtes convoqués à l'assemblée générale qui se tiendra le 12 juin 2026. Ordre du jour : approbation des comptes.`,
    CONVOCATION,
  ],
  ['S4 « Nomme Maître X » à la 3e personne', `TRIBUNAL JUDICIAIRE DE PARIS\nORDONNANCE DE DÉSIGNATION\nPAR CES MOTIFS,\nNomme Maître Jeanne DUPONT en qualité d'administrateur provisoire du syndicat des copropriétaires.`, DESIGNATION],
  ['S5 « Nomme », sans PAR CES MOTIFS', `TRIBUNAL JUDICIAIRE DE PARIS\nORDONNANCE DE DÉSIGNATION\nVu la requête,\nNomme Maître Jeanne DUPONT en qualité d'administrateur provisoire du syndicat des copropriétaires.`, DESIGNATION],
]

describe.each([
  ['tour 0 (resultat-64.json)', TOUR_0],
  ['tour 1 (resultat-64-tour2.json)', TOUR_1],
  ['tour 2 (resultat-64-tour2.json)', TOUR_2],
  ['cas voisins des tours 0 à 2', VOISINS],
  ['contrôle du contrat, défauts 1 à 7 (resultat-64-refonte.json)', CONTRAT],
  ['contrôle de la règle stricte, défauts 1 à 4 (resultat-64-refonte.json)', REGLE_STRICTE],
  ['restes du dernier contrôle, sondes b1 à b6 (resultat-64-refonte.json)', RESTES_REFONTE],
  ['pièces du mandat ensemble (ordonnance, règlement, cadastre)', PIECES_DU_MANDAT],
  ['lettres du notaire qui demandent l’état daté', DEMANDES_ETAT_DATE],
])('scénarios difficiles, %s : jamais sûrs, le vrai type parmi les candidats, aucune pièce présente', (_origine, cas) => {
  it.each(cas)('%s', (_nom, texte, vrai, evocation) => jamaisSur(texte, vrai, evocation))
})

describe('types précis à même mot-titre : en tête, le type générique ensuite', () => {
  it('facture d’honoraires de l’AJ : « Facture/avoir honoraires », puis la facture fournisseur', () => {
    expect(refsDe(F1_HONORAIRES)).toEqual([FACTURE_HONORAIRES, FACTURE])
  })

  it('devis d’un pré-état daté : « Devis pré-état daté », puis le devis fournisseur ; jamais l’état daté', () => {
    expect(refsDe(`DEVIS — ÉTABLISSEMENT D'UN PRÉ-ÉTAT DATÉ\nLot n° 12\nMontant HT : 150,00 € — TVA 20 % : 30,00 € — Valable trois mois.`)).toEqual([DEVIS_PRE_ETAT_DATE, DEVIS])
  })
})

// ── La confirmation : seules sources sûres ────────────────────────────────────────────────────────────────────────

describe('confirmation par le gestionnaire', () => {
  const suggestion = suggererClassement(ETAT_DATE_CLAIR)
  const confirme = (ref: ReferenceTypeDocument, horsCandidats: boolean) => ({ source: 'gestionnaire', ref, controle: 'referentiel', horsCandidats })

  it('type choisi parmi les candidats : source « gestionnaire », ce type retenu, rien de signalé', () => {
    expect(confirmerClassement(suggestion, ETAT_DATE)).toEqual(confirme(ETAT_DATE, false))
  })

  it('libellés saisis sans casse ni accents : le libellé canonique du référentiel est retenu', () => {
    expect(confirmerClassement(suggestion, { categorie: 'coproprietaire', type: 'ETAT DATE' })).toEqual(confirme(ETAT_DATE, false))
  })

  it('type du référentiel hors des candidats : accepté, et signalé', () => {
    const certificat: ReferenceTypeDocument = { categorie: 'Étude notariale', type: 'Certificat article 20-2' }
    expect(confirmerClassement(suggestion, certificat)).toEqual(confirme(certificat, true))
    expect(confirmerClassement(suggererClassement(NON_CLASSEE), DEVIS)).toEqual(confirme(DEVIS, true))
  })

  it('type libre (catégorie non relevée, ou hors du relevé de Copropriétaire) : accepté, hors candidats, sa marque `controle` gardée', () => {
    expect(confirmerClassement(suggestion, { categorie: 'Copropriétaire', type: 'Facture pro forma' })).toEqual({
      source: 'gestionnaire',
      ref: { categorie: 'Copropriétaire', type: 'Facture pro forma' },
      controle: 'type_hors_releve',
      horsCandidats: true,
    })
    expect(confirmerClassement(suggererClassement(DEVIS_CLAIR), { categorie: 'Fournisseur', type: 'Facture' })).toMatchObject({
      controle: 'categorie_non_relevee',
      horsCandidats: true,
    })
    expect(confirmerClassement(suggererClassement(DEVIS_CLAIR), { categorie: 'Fournisseur', type: 'facture/avoir fournisseur' })).toEqual(confirme(FACTURE, true))
  })

  it('sous-type d’ordonnance : le gestionnaire choisit parmi les sous-types candidats', () => {
    const ordonnance = suggererClassement(TOUR_0[0][1])
    expect(ordonnance.candidats.map(({ ref }) => ref)).toEqual([DESIGNATION, PROLONGATION, AUTRE, FIN, TAXE, EXPROPRIATION])
    expect(confirmerClassement(ordonnance, DESIGNATION)).toEqual(confirme(DESIGNATION, false))
  })

  it('document déjà rangé « à confirmer » : la confirmation part de ses candidats stockés, sans la suggestion en mémoire', () => {
    const range = documentRange(suggestion, MUTATION, 'etat-date.pdf')
    expect(range.type.startsWith(CODE_A_CONFIRMER_PREFIXE)).toBe(true)
    const classement = confirmerClassement(candidatsDuDocument(range), ETAT_DATE)
    expect(classement).toEqual(confirme(ETAT_DATE, false))
    expect(codeGedDuClassement(classement, MUTATION.entiteType)).toBe(`${CODE_GED_PREFIXE}Copropriétaire|État daté`)
    expect(confirmerClassement(candidatsDuDocument(range), DEMANDE_ETAT_DATE)).toEqual(confirme(DEMANDE_ETAT_DATE, true))
  })

  it('reclassement d’un document confirmé (ou d’un libellé libre) : aucun candidat stocké, le type choisi est signalé hors candidats', () => {
    const importe = documentRange(classementDeLImport(DEVIS), COPROPRIETE, 'devis.pdf')
    expect(candidatsDuDocument(importe)).toEqual([])
    expect(confirmerClassement(candidatsDuDocument(importe), FACTURE)).toEqual(confirme(FACTURE, true))
    expect(confirmerClassement(candidatsDuDocument({ entiteType: 'copropriete', type: 'scan-0001.pdf' }), DEVIS)).toEqual(confirme(DEVIS, true))
  })

  it('type hors du référentiel : refusé (catégorie inconnue, type vide, type absent d’une catégorie relevée)', () => {
    expect(() => confirmerClassement(suggestion, { categorie: 'Notaire', type: 'État daté' })).toThrow(/catégorie/i)
    expect(() => confirmerClassement(suggestion, { categorie: 'Base', type: '  ' })).toThrow(/type/i)
    expect(() => confirmerClassement(suggestion, { categorie: 'Mairie', type: 'Permis de construire' })).toThrow(/Mairie/)
  })
})

describe('catégorie d’origine fournie à l’import (Gestéam)', () => {
  const importe = (ref: ReferenceTypeDocument) => ({ source: 'import', ref, controle: 'referentiel', horsCandidats: false })

  it('source « import » : le type d’origine, lu dans le référentiel relevé (libellé canonique)', () => {
    expect(classementDeLImport({ categorie: 'etude notariale', type: 'avis de mutation ART. 20' })).toEqual(importe(AVIS_DE_MUTATION))
    expect(classementDeLImport({ categorie: 'Tribunal', type: 'requete au tribunal' })).toEqual(importe({ categorie: 'Tribunal', type: 'Requête au tribunal' }))
    expect(classementDeLImport({ categorie: 'Fournisseur', type: 'Facture/avoir fournisseur' })).toEqual(importe(FACTURE))
  })

  it('libellé hors du référentiel : refusé', () => {
    expect(() => classementDeLImport({ categorie: 'Syndicat', type: 'État daté' })).toThrow(/Syndicat/)
    expect(() => classementDeLImport({ categorie: 'Mairie', type: 'Permis de construire' })).toThrow(/Mairie/)
  })

  it('🔴 type libre, accepté du référentiel mais absent du relevé : refusé à l’import (à suggérer, puis à confirmer)', () => {
    expect(() => classementDeLImport({ categorie: 'Fournisseur', type: 'Facture' })).toThrow(/hors du relevé Gestéam.*catégorie non relevée/)
    expect(() => classementDeLImport({ categorie: 'Propriétaire', type: 'n importe quoi' })).toThrow(/catégorie non relevée/)
    expect(() => classementDeLImport({ categorie: 'Copropriétaire', type: 'N importe quoi' })).toThrow(/type absent du relevé/)
    expect(() => classementDeLImport({ categorie: 'Copropriétaire', type: 'Facture pro forma' })).toThrow(/à confirmer par le gestionnaire/)
  })
})

// ── Les pièces : un type non confirmé n'est jamais présent ───────────────────────────────────────────────────────

describe('pièces : un type non confirmé n’est jamais présent, il est « à vérifier », distinct de « manquante »', () => {
  const PIECES_MUTATION = piecesMutationSyndic(NATURE_VENTE_AMIABLE)

  it('état daté clair (un seul candidat) : « à vérifier », ni présent ni manquant ; confirmé par le gestionnaire : présent', () => {
    const suggestion = suggererClassement(ETAT_DATE_CLAIR)
    const avant = controlerPieces([documentRange(suggestion, MUTATION, 'etat-date.pdf')], MUTATION, PIECES_MUTATION)
    expect(avant.presentes).toEqual([])
    expect(avant.aVerifier).toEqual([{ cle: 'etat_date', documentIds: ['etat-date.pdf'] }])
    expect(avant.manquantes.map((p) => p.cle)).not.toContain('etat_date')
    const apres = controlerPieces([documentRange(confirmerClassement(suggestion, ETAT_DATE), MUTATION, 'etat-date.pdf')], MUTATION, PIECES_MUTATION)
    expect(apres.presentes).toEqual([{ cle: 'etat_date', documentId: 'etat-date.pdf', date: '2026-03-10' }])
    expect(apres.aVerifier).toEqual([])
  })

  it('procès-verbal clair : registre des procès-verbaux « à vérifier » ; importé de Gestéam avec son type : présent', () => {
    pieceAVerifier(PV_CLAIR, COPROPRIETE, RESERVES, 'registre_pv')
    const importe = classementDeLImport({ categorie: 'Base', type: "Procès-verbal d'assemblée" })
    const controle = controlerPieces([documentRange(importe, COPROPRIETE, 'pv.pdf')], COPROPRIETE, RESERVES)
    expect(controle.presentes.map((p) => p.cle)).toEqual(['registre_pv'])
    expect(controle.aVerifier).toEqual([])
  })

  it('type confirmé hors des candidats : la pièce de ce type est présente, les candidats ne comptent plus', () => {
    const confirme = confirmerClassement(suggererClassement(ETAT_DATE_CLAIR), { categorie: 'Étude notariale', type: 'Certificat article 20-2' })
    const controle = controlerPieces([documentRange(confirme, MUTATION, 'certificat.pdf')], MUTATION, PIECES_MUTATION)
    expect(controle.presentes.map((p) => p.cle)).toEqual(['certificat_art20_ii'])
    expect(controle.aVerifier).toEqual([])
    expect(controle.manquantes.map((p) => p.cle)).toContain('etat_date')
  })

  it('deux candidats : les deux pièces « à vérifier » ; un document confirmé l’emporte sur un document à vérifier', () => {
    const etat = `ÉTAT DATÉ (article 5 du décret du 17 mars 1967) — Date de la demande d'état daté : 3 mars 2026 — Notaire : Maître Y — Vente du lot 12 — 1re partie : sommes dues par le cédant au syndicat`
    expect(refsDe(etat)).toEqual([ETAT_DATE, DEMANDE_ETAT_DATE])
    const douteux = documentRange(suggererClassement(etat), MUTATION, 'douteux.pdf')
    expect(controlerPieces([douteux], MUTATION, PIECES_MUTATION).aVerifier).toEqual([
      { cle: 'demande_etat_date', documentIds: ['douteux.pdf'] },
      { cle: 'etat_date', documentIds: ['douteux.pdf'] },
    ])
    const sur = documentRange(confirmerClassement(suggererClassement(ETAT_DATE_CLAIR), ETAT_DATE), MUTATION, 'sur.pdf')
    const controle = controlerPieces([sur, douteux], MUTATION, PIECES_MUTATION)
    expect(controle.presentes).toEqual([{ cle: 'etat_date', documentId: 'sur.pdf', date: '2026-03-10' }])
    expect(controle.aVerifier).toEqual([{ cle: 'demande_etat_date', documentIds: ['douteux.pdf'] }])
  })

  it('lettres du notaire qui demandent l’état daté : la demande et l’état daté « à vérifier », jamais présents', () => {
    for (const lettre of [A1, H2, E3_TOUR_3]) {
      pieceAVerifier(lettre, MUTATION, PIECES_MUTATION, 'demande_etat_date')
      pieceAVerifier(lettre, MUTATION, PIECES_MUTATION, 'etat_date')
    }
    for (const [, demande] of DEMANDES_ETAT_DATE) pieceAVerifier(demande, MUTATION, PIECES_MUTATION, 'demande_etat_date')
  })

  it('pièces du mandat ensemble : le règlement « à vérifier » sous une ordonnance ou un modificatif de l’AP, jamais manquant', () => {
    const remise = piecesRemiseAcquereur({ mode: 'promesse', acquereurDejaCoproprietaire: false, lotAnnexe: false })
    for (const texte of [MODIFICATIF_AP, EXPROPRIATION_LOTS]) {
      pieceAVerifier(texte, COPROPRIETE, RESERVES, 'reglement_copropriete')
      pieceAVerifier(texte, COPROPRIETE, remise, '1b')
    }
    pieceAVerifier(EXPROPRIATION_LOTS, COPROPRIETE, EXTRANET_CS, 'assignations_decisions')
    pieceAVerifier(EXPROPRIATION_PARCELLES, COPROPRIETE, EXTRANET_CS, 'assignations_decisions')
  })

  it('courriers qui évoquent une pièce : elle est « à vérifier », jamais présente', () => {
    pieceAVerifier(A1, MUTATION, PIECES_MUTATION, 'etat_date')
    pieceAVerifier(H2, MUTATION, PIECES_MUTATION, 'etat_date')
    pieceAVerifier(H4, MUTATION, PIECES_MUTATION, 'avis_mutation')
    pieceAVerifier(A2, COPROPRIETE, RESERVES, 'registre_pv')
    pieceAVerifier(H3, COPROPRIETE, RESERVES, 'registre_pv')
    pieceAVerifier(PV_DECISIONS_AP, COPROPRIETE, RESERVES, 'registre_pv')
    pieceAVerifier(A5, COPROPRIETE, RESERVES, 'reglement_copropriete')
    pieceAVerifier(H1, COPROPRIETE, RESERVES, 'reglement_copropriete')
    pieceAVerifier(A3, COPROPRIETE, RESERVES, 'pieces_justificatives')
    pieceAVerifier(G1, COPROPRIETE, RESERVES, 'pieces_justificatives')
    pieceAVerifier(ETAT_DATE_SOUS_LA_DEMANDE, MUTATION, PIECES_MUTATION, 'etat_date')
  })

  it('pièce de l’AJ qui cite son ordonnance : « assignations et décisions » de l’extranet à vérifier, jamais présente', () => {
    pieceAVerifier(`Maître X, administrateur provisoire\nOrdonnance de prorogation du 2 mars 2026 (RG 25/01234)\n${CONVOQUEE}`, COPROPRIETE, EXTRANET_CS, 'assignations_decisions')
    pieceAVerifier(H7, COPROPRIETE, EXTRANET_CS, 'assignations_decisions')
  })

  it('codeGedDuClassement : code « à confirmer » pour toute suggestion, code GED pour un type confirmé, rien pour une pièce non classée', () => {
    expect(codeGedDuClassement(suggererClassement(DEVIS_CLAIR), 'copropriete')).toBe(`${CODE_A_CONFIRMER_PREFIXE}Fournisseur|Devis fournisseur`)
    expect(codeGedDuClassement(suggererClassement(RAPPORT), 'mandat')).toBe(
      `${CODE_A_CONFIRMER_PREFIXE}Tribunal|Ordonnance de désignation;Base|Ordonnance (autres);Tribunal|Ordonnance de prolongation de mission;Tribunal|Ordonnance de fin de mission;Tribunal|Ordonnance de taxe;Tribunal|Ordonnance d'expropriation`,
    )
    expect(codeGedDuClassement(confirmerClassement(suggererClassement(DEVIS_CLAIR), DEVIS), 'copropriete')).toBe(`${CODE_GED_PREFIXE}Fournisseur|Devis fournisseur`)
    expect(codeGedDuClassement(classementDeLImport(DEVIS), 'copropriete')).toBe(`${CODE_GED_PREFIXE}Fournisseur|Devis fournisseur`)
    expect(codeGedDuClassement(suggererClassement(NON_CLASSEE), 'copropriete')).toBeNull()
    expect(() => codeGedDuClassement(classementDeLImport(DEVIS), 'reprise')).toThrow(/reprise/)
  })
})

describe('en-tête de classement-pieces-ged.ts', () => {
  const SOURCE = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'classement-pieces-ged.ts'), 'utf8').replace(
    /\s*\n\s*\*\s*/g,
    ' ',
  )

  it('la décision de Hugo du 03/11/2026 est citée telle quelle, avec ses trois conséquences', () => {
    expect(SOURCE).toContain("décision de Hugo du 03/11/2026 : « le classement d'après le texte est une suggestion seulement »")
    expect(SOURCE).toMatch(/1\. le classement d'après le texte \(suggererClassement\) ne rend JAMAIS un type sûr/)
    expect(SOURCE).toMatch(/2\. un type n'est confirmé que par une source explicite/)
    expect(SOURCE).toMatch(/3\. un document dont le type n'est pas confirmé ne compte JAMAIS comme pièce présente/)
  })

  it('les règles qui décidaient d’un « sûr » d’après le texte ont disparu, comme le gagnant unique de classerDocument', () => {
    expect(SOURCE).not.toMatch(/RÈGLE STRICTE DU TITRE|DISPOSITIF d'une ordonnance|SOUS-TYPE NOMMÉ|VERBES_DU_JUGE|confirmeParLeTitre/)
    expect(SOURCE).not.toMatch(/import \{ classerDocument/)
  })

  it('🔵 limites dites : l’ordre ne présélectionne rien ; source et `horsCandidats` ne survivent pas au code rangé', () => {
    expect(SOURCE).toMatch(/🔵[^🟢🔴]*un écran ne présélectionne pas le premier candidat/u)
    expect(SOURCE).toMatch(/🔵[^🟢🔴]*une ordonnance titrée par sa date[^🟢🔴]*« ORDONNANCE DE TAXE DU 3 NOVEMBRE 2026 »[^🟢🔴]*passe aussi après les autres/u)
    expect(SOURCE).toMatch(/🔵[^🟢🔴]*la source et `horsCandidats` ne lui survivent pas, à porter par l'écran ou la table \(côté Frédéric\)/u)
  })

  it('🔵 la règle d’ordre des candidats et ses limites sont dites', () => {
    expect(SOURCE).toMatch(/🔵[^🟢🔴]*ORDRE des candidats[^🟢🔴]*1\. [^🟢🔴]*2\. une ordonnance seulement citée passe après tous les autres candidats[^🟢🔴]*3\. /u)
    expect(SOURCE).toMatch(/🔵[^🟢🔴]*désignée par sa date[^🟢🔴]*un jour[^🟢🔴]*suivi d'un mois en toutes lettres ou abrégé[^🟢🔴]*ou une date chiffrée/u)
    expect(SOURCE).toMatch(/🔵[^🟢🔴]*« 1 er » de la couche texte d'un PDF où « er » est en exposant/u)
    expect(SOURCE).toMatch(/🔵[^🟢🔴]*désignée par sa juridiction et son siège, datée ou non/u)
    expect(SOURCE).toMatch(/🔵[^🟢🔴]*le magistrat qui la rend[^🟢🔴]*« du premier vice-président »[^🟢🔴]*« du magistrat délégué par le président »/u)
    expect(SOURCE).toMatch(/🔵[^🟢🔴]*« du » devant un nom n'est ni une date ni un siège[^🟢🔴]*« DU PREMIER PRÉSIDENT »/u)
    expect(SOURCE).toMatch(/🔵[^🟢🔴]*Limites de l'ordre[^🟢🔴]*« ORDONNANCE DU PRÉSIDENT DU TRIBUNAL JUDICIAIRE DE TOURS »/u)
    expect(SOURCE).toMatch(/🔵[^🟢🔴]*Limites de l'ordre[^🟢🔴]*sans déterminant, ni date, ni siège[^🟢🔴]*après ses six sous-types/u)
    expect(SOURCE).toMatch(/🔵[^🟢🔴]*Limites de l'ordre[^🟢🔴]*« Ordonnance n° 26\/00045 du 2 mars 2026 »[^🟢🔴]*« Ordonnance rendue le 2 mars 2026 »/u)
    expect(SOURCE).toMatch(/🔵[^🟢🔴]*Limites de l'ordre[^🟢🔴]*un magistrat hors de la liste \(« Ordonnance du juge de la mise en état/u)
  })

  it('🔴 le format de l’export des documents Gestéam n’est pas relevé : question pour Hugo', () => {
    expect(SOURCE).toMatch(/🔴[^🟢🔵]*« L'export des documents Gestéam porte-t-il la catégorie et le type de chaque pièce/u)
  })
})
