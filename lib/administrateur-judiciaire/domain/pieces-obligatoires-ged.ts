import { ajouterMois, composerDateIso, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { TYPES_DOCUMENT_PAR_CATEGORIE } from '@/lib/administrateur-judiciaire/domain/referentiel-types-document'
import type { ClePieceReprise } from '@/lib/administrateur-judiciaire/domain/reprise'
import {
  candidatsDuDocument,
  correspondAuModele,
  modelesDe,
  referenceDuDocument,
  type ModeleTypeDocument,
  type ReferenceTypeDocument,
} from '@/lib/administrateur-judiciaire/domain/typologie-documents'

/**
 * Documents obligatoires du syndicat et liste minimale de l'extranet, contrôlés sur les documents classés par la GED
 * (point 64 du bilan 2). Fonctions pures, dates ISO ; aucune donnée personnelle : la liste des copropriétaires, le
 * compte individuel et les avis d'appel sont nommés comme TYPES, jamais lus.
 *
 * Le droit — 🟢 relu sur Légifrance (version en vigueur au 29/10/2026) :
 * - D. 1967 art. 33, al. 1 (mod. D. 2020-834) : le syndic détient les archives du syndicat, « notamment une expédition
 *   ou une copie des actes énumérés aux articles 1er à 3 » (règlement de copropriété, état de répartition, état
 *   descriptif de division), les registres des procès-verbaux et leurs annexes, les documents comptables, le carnet
 *   d'entretien et, le cas échéant, les diagnostics techniques ; dernier alinéa : la conservation et la gestion des
 *   archives sont comprises dans la mission ordinaire du syndic (aussi L. 1965 art. 18 I, mod. loi 2024-322) ;
 * - D. 1967 art. 17 (registre des procès-verbaux, feuille de présence annexée ; registre électronique possible),
 *   art. 21-1, 42-5 et 42-9 (procès-verbaux versés ou annexés au registre), art. 62-8 (décisions de l'administrateur
 *   provisoire mentionnées, à leur date, sur le registre de l'art. 17) ;
 * - D. 1967 art. 32 (mod. D. 2025-1292) : liste de tous les copropriétaires, tenue à jour ;
 * - L. 1965 art. 18 I, 7e alinéa : carnet d'entretien ; art. 8-2 : fiche synthétique mise à jour chaque année, sauf
 *   pour les syndics d'immeubles « à destination totale autre que d'habitation » ;
 * - L. 1965 art. 18-1 et D. 1967 art. 9-1 : pièces justificatives des charges ; D. 2005-240 art. 12 : annexes
 *   comptables conservées avec la copie du procès-verbal d'approbation des comptes, en classement particulier ;
 * - extranet : L. 1965 art. 18 I, avant-dernier alinéa : accès en ligne sécurisé proposé par le syndic professionnel,
 *   « sauf décision contraire de l'assemblée générale prise à la majorité de l'article 25 de la présente loi », et
 *   différencié selon la nature des documents ; D. 1967 art. 33-1-1 (téléchargeables et imprimables, actualisés au moins
 *   une fois par an) ; D. 2019-502 art. 1 (9 documents, tous les copropriétaires ; 2° : la dernière fiche synthétique
 *   « réalisée par le syndic en application de l'article 8-2 »), art. 2 (4 documents, le copropriétaire pour son lot ;
 *   4° : avis d'appel de fonds « sur les trois dernières années »), art. 3 (5 documents, le conseil syndical ; 3° :
 *   assignations en justice « délivrées au nom du syndicat des copropriétaires » et décisions de justice dont les délais
 *   de recours n'ont pas expiré), art. 4 I (avis d'appel de fonds : seulement ceux transmis à compter du 1er juillet
 *   2020) ;
 * - D. 1967 art. 33-1 : bordereau récapitulatif des archives transmises au changement de syndic (pas l'extranet).
 * 🟢 Gestéam : types relevés en tranches 22 § 6 et 43 § 19 (referentiel-types-document.ts).
 * 🔵 Déduit :
 * - correspondance de chaque pièce avec les types Gestéam (`modeles`) ; une pièce sans type Gestéam est « non
 *   contrôlable » (liste des copropriétaires, registre des décisions de l'administrateur provisoire, annexes
 *   comptables, informations de l'extranet par lot), jamais « manquante » ;
 * - pièces « éventuelles » : diagnostics (« le cas échéant »), relevés de comptes séparés, part du fonds de travaux,
 *   assignations et décisions de justice (aucune procédure en cours possible) ;
 * - assignations : seul le type « Assignation au nom du syndicat » (Base) couvre la pièce ; les types « Assignation »
 *   de l'huissier et de l'avocat ne disent pas si le syndicat est demandeur ou défendeur ;
 * - extranet : la fiche synthétique sort de la liste quand l'art. 8-2 ne s'applique pas, comme des documents
 *   obligatoires ; accès en ligne écarté par l'AG : aucune pièce due AU TITRE DE L'EXTRANET (les archives restent dues,
 *   D. 1967 art. 33) ;
 * - avis d'appel de fonds : « trois dernières années » lues comme 36 mois glissants avant la date de référence (borne
 *   exclue, date de référence incluse) ; un avis transmis après la date de référence n'est pas encore « adressé » ;
 * - une pièce est présente si AU MOINS un document de l'entité porte l'un de ses types, confirmé (code GED : le
 *   gestionnaire ou l'import, classement-pieces-ged.ts) ; le plus récent est cité ; un document dont le type n'est pas
 *   confirmé (suggestion d'après le texte, code « à confirmer » de typologie-documents.ts) ne la rend jamais présente :
 *   si l'un de ses types candidats la couvre, elle est « à vérifier », distincte de « manquante » ;
 * - TYPES_GED_PAR_PIECE_REPRISE adosse la reprise (reprise.ts, lu sans modification) aux types GED : couverture
 *   indicative, le journal de reprise reste la seule source de piecesRepriseRecues ; même règle que controlerPieces :
 *   une pièce de reprise qu'un type candidat seul couvrirait est « à vérifier », jamais couverte ;
 * - les fenêtres « trois dernières AG », « trois dernières années », « en cours de validité » disent ce qui est mis
 *   à disposition ; ce ne sont pas des durées de conservation (voir conservation-documents-ged.ts).
 * 🔴 Non établi :
 * - « L'administrateur judiciaire nommé administrateur provisoire doit-il tenir l'extranet du décret 2019-502 pour la
 *   copropriété administrée ? » (la loi vise le « syndic professionnel » ; l'administrateur provisoire reçoit « tous les
 *   pouvoirs du syndic », L. 1965 art. 29-1) — question pour Frédéric ou Hugo ;
 * - registre des décisions de l'administrateur provisoire (D. 1967 art. 62-8) : le type « Procès-Verbal de prise de
 *   décisions par l'AJ » (tranche 18) le couvrirait, mais sa catégorie n'est relevée ni en tranche 22 ni en tranche 43
 *   (question pour Hugo, voir typologie-documents.ts) : pièce non contrôlable en attendant ;
 * - contenu des pièces (carnet d'entretien, fiche synthétique, diagnostics) : textes d'application non relus ; seule la
 *   PRÉSENCE est contrôlée.
 */

/** Document vu par la GED ; l'appelant convertit DocumentLocal (dateCreation → date ISO). */
export interface DocumentGed {
  id: string
  entiteType: string
  entiteId: string
  /** DocumentLocal.type : code GED, valeur héritée ou libellé libre. */
  type: string
  date: string
}

export interface EntiteGed {
  entiteType: string
  entiteId: string
}

/** `TEXTE` : obligation lue sur Légifrance ; `GESTEAM` : pièce de la pratique Gestéam, sans texte relu. */
export type CertitudePiece = 'TEXTE' | 'GESTEAM'

/** `requise` : toujours attendue ; `eventuelle` : attendue selon les circonstances (« le cas échéant », alternative). */
export type PresencePiece = 'requise' | 'eventuelle'

export interface PieceAttendue {
  cle: string
  libelle: string
  /** Types GED qui couvrent la pièce (🔵) ; vide : pièce non contrôlable par la GED. */
  modeles: readonly ModeleTypeDocument[]
  fondement: string | null
  certitude: CertitudePiece
  presence: PresencePiece
}

export interface PiecePresente {
  cle: string
  documentId: string
  date: string
}

/** Pièce qu'aucun document de type confirmé ne couvre, mais qu'un document « à confirmer » pourrait couvrir (un candidat). */
export interface PieceAVerifier {
  cle: string
  documentIds: string[]
}

export interface ControlePieces {
  presentes: PiecePresente[]
  /** Ni présentes ni manquantes : un document à confirmer pourrait les couvrir. */
  aVerifier: PieceAVerifier[]
  manquantes: PieceAttendue[]
  eventuellesAbsentes: PieceAttendue[]
  nonControlables: PieceAttendue[]
}

const PV_AG = modelesDe('Base', ["Procès-verbal d'assemblée", "Procès-verbal d'assemblée signé"])
const FICHE_SYNTHETIQUE = modelesDe('Base', ['Fiche synthétique', 'Fiche synthétique de la copropriété'])
const CARNET = modelesDe('Base', ["Carnet d'entretien"])
const REGLEMENT = modelesDe('Étude notariale', ['Règlement de copropriété (règlement, modificatifs)'])
const CONTRATS = modelesDe(null, ['Contrat, avenant entreprise'])
const DIAGNOSTICS_PARTIES_COMMUNES = modelesDe('Base', [
  'Diagnostic amiante partie commune',
  'Diagnostic de performance énergétique parties communes',
  'Audit de performances énergétiques des parties communes',
  'Diagnostic plomb (CREP)',
  "Diagnostic plomb dans l'eau",
  'Diagnostic termites',
  'Diagnostic technique global',
])

const piece = (
  cle: string,
  libelle: string,
  modeles: readonly ModeleTypeDocument[],
  fondement: string,
  presence: PresencePiece = 'requise',
): PieceAttendue => ({ cle, libelle, modeles, fondement, certitude: 'TEXTE', presence })

/** Archives et registres que le syndic (et l'administrateur provisoire, L. 1965 art. 29-1) détient pour le syndicat. */
export const DOCUMENTS_OBLIGATOIRES_SYNDICAT: readonly PieceAttendue[] = [
  piece(
    'reglement_copropriete',
    'Règlement de copropriété, état de répartition des charges, état descriptif de division et actes modificatifs',
    REGLEMENT,
    'D. 1967 art. 33, al. 1 (actes des art. 1er à 3)',
  ),
  piece('registre_pv', "Registre des procès-verbaux d'assemblée générale et pièces annexes (feuille de présence)", [
    ...PV_AG,
    ...modelesDe('Base', ['Feuille de présence']),
  ], 'D. 1967 art. 17, al. 6 à 8 ; art. 33, al. 1'),
  piece(
    'registre_decisions_ap',
    "Décisions de l'administrateur provisoire mentionnées, à leur date, sur le registre de l'art. 17",
    [],
    'D. 1967 art. 62-8',
  ),
  piece('liste_coproprietaires', 'Liste de tous les copropriétaires, de leurs lots et des titulaires de droits', [], 'D. 1967 art. 32'),
  piece('carnet_entretien', "Carnet d'entretien de l'immeuble", CARNET, 'L. 1965 art. 18 I, 7e alinéa ; D. 1967 art. 33, al. 1'),
  piece('fiche_synthetique', 'Fiche synthétique de la copropriété, mise à jour chaque année', FICHE_SYNTHETIQUE, 'L. 1965 art. 8-2'),
  piece(
    'pieces_justificatives',
    "Pièces justificatives des charges (factures, contrats de fourniture et d'exploitation)",
    modelesDe(null, ['Facture/avoir fournisseur', 'Contrat, avenant entreprise']),
    'L. 1965 art. 18-1 ; D. 1967 art. 9-1 ; D. 2005-240 art. 6',
  ),
  piece(
    'annexes_comptables',
    "Annexes comptables (art. 8 à 10 du D. 2005-240), conservées avec la copie du procès-verbal d'approbation des comptes",
    [],
    'D. 2005-240 art. 12',
  ),
  piece('diagnostics_techniques', 'Diagnostics techniques', DIAGNOSTICS_PARTIES_COMMUNES, 'D. 1967 art. 33, al. 1', 'eventuelle'),
]

/** L. 1965 art. 8-2, dernier alinéa : pas de fiche synthétique pour un immeuble à destination totale autre que d'habitation. */
function sansFicheSynthetiqueHorsHabitation<T extends PieceAttendue>(
  pieces: readonly T[],
  immeuble: { destinationTotaleAutreQueHabitation: boolean },
): T[] {
  return pieces.filter((p) => !(immeuble.destinationTotaleAutreQueHabitation && p.cle === 'fiche_synthetique'))
}

/** Documents obligatoires ; sans fiche synthétique pour un immeuble à destination totale autre que d'habitation. */
export function documentsObligatoiresSyndicat(immeuble: { destinationTotaleAutreQueHabitation: boolean }): PieceAttendue[] {
  return sansFicheSynthetiqueHorsHabitation(DOCUMENTS_OBLIGATOIRES_SYNDICAT, immeuble)
}

/** Trois publics exclusifs de l'extranet (D. 2019-502 art. 1, 2 et 3). */
export type PublicExtranet = 'coproprietaires' | 'coproprietaire_du_lot' | 'conseil_syndical'

export interface PieceExtranet extends PieceAttendue {
  public: PublicExtranet
}

const extranet = (
  publicVise: PublicExtranet,
  cle: string,
  libelle: string,
  modeles: readonly ModeleTypeDocument[],
  fondement: string,
  presence: PresencePiece = 'requise',
): PieceExtranet => ({ ...piece(cle, libelle, modeles, fondement, presence), public: publicVise })

/**
 * Liste minimale des documents de l'espace en ligne sécurisé (D. 2019-502, mod. D. 2020-1229), sans condition : liste
 * brute. L'accès en ligne est dû « sauf décision contraire de l'assemblée générale prise à la majorité de l'article 25 »
 * (L. 1965 art. 18 I) ; pour un contrôle, documentsExtranetDuPublic applique cette dispense et l'art. 8-2.
 */
export const DOCUMENTS_EXTRANET: readonly PieceExtranet[] = [
  extranet('coproprietaires', 'reglement_copropriete', 'Règlement de copropriété, état descriptif de division et actes modificatifs publiés', REGLEMENT, 'D. 2019-502 art. 1, 1°'),
  extranet('coproprietaires', 'fiche_synthetique', 'Dernière fiche synthétique de la copropriété', FICHE_SYNTHETIQUE, 'D. 2019-502 art. 1, 2°'),
  extranet('coproprietaires', 'carnet_entretien', "Carnet d'entretien de l'immeuble", CARNET, 'D. 2019-502 art. 1, 3°'),
  extranet(
    'coproprietaires',
    'diagnostics_parties_communes',
    'Diagnostics techniques des parties communes en cours de validité',
    DIAGNOSTICS_PARTIES_COMMUNES,
    'D. 2019-502 art. 1, 4°',
    'eventuelle',
  ),
  extranet('coproprietaires', 'contrats_assurance', "Contrats d'assurance de l'immeuble en cours de validité", modelesDe('Base', ["Police d'assurance"]), 'D. 2019-502 art. 1, 5°'),
  extranet('coproprietaires', 'contrats_marches', 'Contrats et marchés en cours, hors contrats de travail des préposés', CONTRATS, 'D. 2019-502 art. 1, 6°'),
  extranet('coproprietaires', 'contrats_entretien', "Contrats d'entretien et de maintenance des équipements communs en cours", CONTRATS, 'D. 2019-502 art. 1, 7°'),
  extranet(
    'coproprietaires',
    'pv_trois_dernieres_ag',
    'Procès-verbaux des trois dernières assemblées annuelles des comptes et devis de travaux approuvés',
    PV_AG,
    'D. 2019-502 art. 1, 8°',
  ),
  extranet('coproprietaires', 'contrat_syndic', 'Contrat de syndic en cours', modelesDe('Base', ['Contrat de syndic']), 'D. 2019-502 art. 1, 9°'),
  extranet(
    'coproprietaire_du_lot',
    'compte_individuel',
    'Compte individuel arrêté après approbation des comptes',
    modelesDe('Copropriétaire', ['Extrait de compte']),
    'D. 2019-502 art. 2, 1°',
  ),
  extranet('coproprietaire_du_lot', 'charges_payees', 'Charges courantes et hors budget payées sur les deux derniers exercices clos', [], 'D. 2019-502 art. 2, 2°'),
  extranet('coproprietaire_du_lot', 'part_fonds_travaux', 'Part du fonds de travaux rattachée au lot', [], 'D. 2019-502 art. 2, 3°', 'eventuelle'),
  extranet(
    'coproprietaire_du_lot',
    'avis_appel_fonds',
    "Avis d'appel de fonds des trois dernières années (transmis à compter du 1er juillet 2020)",
    modelesDe('Copropriétaire', ['Appel de fonds']),
    'D. 2019-502 art. 2, 4° et art. 4 I',
  ),
  extranet(
    'conseil_syndical',
    'balances_generales',
    "Balances générales et relevé général des charges et produits de l'exercice échu",
    modelesDe('Base', ['Balance comparée']),
    'D. 2019-502 art. 3, 1°',
  ),
  extranet('conseil_syndical', 'releves_bancaires', 'Relevés périodiques des comptes bancaires séparés', modelesDe('Base', ['Relevé bancaire']), 'D. 2019-502 art. 3, 2°', 'eventuelle'),
  extranet(
    'conseil_syndical',
    'assignations_decisions',
    "Assignations en justice délivrées au nom du syndicat relatives aux procédures en cours et décisions de justice dont les délais de recours n'ont pas expiré",
    [
      ...modelesDe('Base', ['Assignation au nom du syndicat', 'Ordonnance (autres)']),
      ...modelesDe("Cabinet d'avocat", ['Jugement']),
      ...modelesDe('Tribunal', ['Jugement']),
    ],
    'D. 2019-502 art. 3, 3°',
    'eventuelle',
  ),
  extranet('conseil_syndical', 'liste_coproprietaires', 'Liste de tous les copropriétaires (D. 1967 art. 32)', [], 'D. 2019-502 art. 3, 4°'),
  extranet(
    'conseil_syndical',
    'attestations_syndic',
    'Carte professionnelle, attestation de responsabilité civile professionnelle et de garantie financière du syndic',
    modelesDe('Base', [
      'Carte professionnelle',
      'Attestation assurance civile professionnelle',
      'Attestation de garantie financière',
      'Attestation garantie financière',
    ]),
    'D. 2019-502 art. 3, 5°',
  ),
]

/** Circonstances de la copropriété qui retirent des pièces de l'extranet. */
export interface ContexteExtranet {
  /** L. 1965 art. 8-2, dernier alinéa : aucune fiche synthétique, donc pas de 2° de l'art. 1 du D. 2019-502. */
  destinationTotaleAutreQueHabitation: boolean
  /** L. 1965 art. 18 I : accès en ligne écarté par l'AG à la majorité de l'art. 25 ; aucune pièce due au titre de l'extranet. */
  accesEnLigneEcarteParAg: boolean
}

/** Pièces de l'extranet dues à ce public, compte tenu de la dispense votée par l'AG et de l'art. 8-2. */
export function documentsExtranetDuPublic(publicVise: PublicExtranet, contexte: ContexteExtranet): PieceExtranet[] {
  if (contexte.accesEnLigneEcarteParAg) return []
  return sansFicheSynthetiqueHorsHabitation(
    DOCUMENTS_EXTRANET.filter((p) => p.public === publicVise),
    contexte,
  )
}

/** Date ISO valide, ou absente (null / undefined) ; erreur explicite sinon. */
export function verifierDateGed(valeur: string | null | undefined, origine: string): void {
  if (valeur != null && !estDateIsoValide(valeur)) throw new Error(`Date invalide (${origine}) : « ${valeur} » (attendu AAAA-MM-JJ).`)
}

/** Date du document obligatoire et valide. */
export function verifierDateDocument(document: DocumentGed): void {
  if (!document.date) throw new Error(`Date absente du document « ${document.id} ».`)
  verifierDateGed(document.date, `document « ${document.id} »`)
}

/** Fenêtre des avis d'appel de fonds de l'extranet, en mois (« sur les trois dernières années », 🔵 36 mois glissants). */
export const FENETRE_AVIS_APPEL_EXTRANET_MOIS = 36

/**
 * Un avis d'appel de fonds relève de l'extranet à la date de référence s'il a été transmis à compter du 1er juillet 2020
 * (D. 2019-502 art. 4 I) ET « sur les trois dernières années » (art. 2, 4°) : après la date de référence moins 36 mois,
 * au plus tard à la date de référence (🔵).
 */
export function avisAppelDansExtranet(dateTransmission: string, dateReference: string): boolean {
  if (!dateTransmission) throw new Error("Date de transmission de l'avis d'appel de fonds absente.")
  if (!dateReference) throw new Error("Date de référence absente (avis d'appel de fonds de l'extranet).")
  verifierDateGed(dateTransmission, "transmission de l'avis d'appel de fonds")
  verifierDateGed(dateReference, "date de référence de l'extranet")
  if (dateTransmission < composerDateIso(2020, 7, 1) || dateTransmission > dateReference) return false
  return dateTransmission > ajouterMois(dateReference, -FENETRE_AVIS_APPEL_EXTRANET_MOIS)
}

interface DocumentReference {
  document: DocumentGed
  ref: ReferenceTypeDocument
}

/** Documents de l'entité : types confirmés, et types candidats des documents « à confirmer » ; dates vérifiées. */
interface DocumentsDeLEntite {
  references: DocumentReference[]
  candidats: DocumentReference[]
}

function documentsDeLEntite(documents: readonly DocumentGed[], entite: EntiteGed): DocumentsDeLEntite {
  const lus: DocumentsDeLEntite = { references: [], candidats: [] }
  for (const document of documents) {
    if (document.entiteType !== entite.entiteType || document.entiteId !== entite.entiteId) continue
    verifierDateDocument(document)
    const ref = referenceDuDocument(document)
    if (ref) lus.references.push({ document, ref })
    for (const candidat of candidatsDuDocument(document)) lus.candidats.push({ document, ref: candidat })
  }
  return lus
}

const couvre = (ref: ReferenceTypeDocument, modeles: readonly ModeleTypeDocument[]): boolean => modeles.some((m) => correspondAuModele(ref, m))

function plusRecentCouvrant(references: readonly DocumentReference[], modeles: readonly ModeleTypeDocument[]): DocumentGed | null {
  let retenu: DocumentGed | null = null
  for (const { document, ref } of references) if (couvre(ref, modeles) && (!retenu || document.date > retenu.date)) retenu = document
  return retenu
}

/** Pièce sans document de type confirmé : « à vérifier » si un candidat d'un document à confirmer la couvre, sinon absente. */
function rangerPieceAbsente(controle: ControlePieces, attendue: PieceAttendue, candidats: readonly DocumentReference[]): void {
  const documentIds = [...new Set(candidats.filter(({ ref }) => couvre(ref, attendue.modeles)).map(({ document }) => document.id))]
  if (documentIds.length > 0) controle.aVerifier.push({ cle: attendue.cle, documentIds })
  else if (attendue.presence === 'eventuelle') controle.eventuellesAbsentes.push(attendue)
  else controle.manquantes.push(attendue)
}

/**
 * Pièces attendues présentes, à vérifier, manquantes, éventuelles absentes ou non contrôlables, pour une entité. Seul un
 * document de type confirmé (code GED) rend une pièce présente ; un document « à confirmer » (toute suggestion d'après
 * le texte) la rend au plus « à vérifier ».
 */
export function controlerPieces(documents: readonly DocumentGed[], entite: EntiteGed, attendues: readonly PieceAttendue[]): ControlePieces {
  const { references, candidats } = documentsDeLEntite(documents, entite)
  const controle: ControlePieces = { presentes: [], aVerifier: [], manquantes: [], eventuellesAbsentes: [], nonControlables: [] }
  for (const attendue of attendues) {
    const document = attendue.modeles.length > 0 ? plusRecentCouvrant(references, attendue.modeles) : null
    if (attendue.modeles.length === 0) controle.nonControlables.push(attendue)
    else if (document) controle.presentes.push({ cle: attendue.cle, documentId: document.id, date: document.date })
    else rangerPieceAbsente(controle, attendue, candidats)
  }
  return controle
}

/** 🔵 Types GED qui couvrent chaque pièce de reprise (reprise.ts) ; « clés » et « compteurs » n'ont pas de type. */
export const TYPES_GED_PAR_PIECE_REPRISE: Readonly<Partial<Record<ClePieceReprise, readonly ModeleTypeDocument[]>>> = {
  tresorerie: modelesDe('Base', ['Relevé bancaire', 'RIB syndicat des copropriétaires']),
  archives: modelesDe('Base', ['Bordereaux de remise de pièces ancien syndic']),
  comptes: [...modelesDe('Base', ['État des soldes des copropriétaires', 'Balance comparée']), ...modelesDe('Interne', ['Grand livre'])],
  registre_pv: [...PV_AG, ...modelesDe('Base', ['Feuille de présence'])],
  reglement: REGLEMENT,
  contrats: [...CONTRATS, ...modelesDe('Base', ["Police d'assurance"])],
  carnet: [...CARNET, ...FICHE_SYNTHETIQUE, ...DIAGNOSTICS_PARTIES_COMMUNES],
  sinistres: [
    ...modelesDe('Copropriétaire', ['Déclaration de sinistre']),
    ...modelesDe("Compagnie d'assurance", ['Déclaration de sinistre']),
    ...modelesDe('Base', ['Assignation au nom du syndicat']),
  ],
  personnel: modelesDe("Gardien/Employé d'immeuble", TYPES_DOCUMENT_PAR_CATEGORIE["Gardien/Employé d'immeuble"].typesPropres),
  immatriculation: modelesDe('Base', ['Attestation de mise à jour au registre des copropriétés', 'Données transmises au registre des copropriétés']),
}

/** Couverture indicative de la reprise : pièces couvertes (type confirmé), ou seulement à vérifier (type candidat). */
export interface CouvertureReprise {
  couvertes: Set<ClePieceReprise>
  aVerifier: Set<ClePieceReprise>
}

/**
 * Pièces de reprise couvertes par au moins un document de type confirmé de l'entité (la copropriété) ; à vérifier, celles
 * qu'un seul type candidat d'un document « à confirmer » couvrirait. Lecture seule de reprise.ts : le journal de reprise
 * (entité « reprise ») n'est ni lu ni modifié ici.
 */
export function piecesRepriseCouvertesParGed(documents: readonly DocumentGed[], entite: EntiteGed): CouvertureReprise {
  const { references, candidats } = documentsDeLEntite(documents, entite)
  const couverture: CouvertureReprise = { couvertes: new Set(), aVerifier: new Set() }
  for (const [cle, modeles] of Object.entries(TYPES_GED_PAR_PIECE_REPRISE) as [ClePieceReprise, readonly ModeleTypeDocument[]][]) {
    if (references.some(({ ref }) => couvre(ref, modeles))) couverture.couvertes.add(cle)
    else if (candidats.some(({ ref }) => couvre(ref, modeles))) couverture.aVerifier.add(cle)
  }
  return couverture
}
