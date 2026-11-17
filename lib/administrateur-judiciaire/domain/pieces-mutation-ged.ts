import type { PieceAttendue, PresencePiece } from '@/lib/administrateur-judiciaire/domain/pieces-obligatoires-ged'
import { modelesDe, type ModeleTypeDocument } from '@/lib/administrateur-judiciaire/domain/typologie-documents'

/**
 * Pièces d'une mutation, contrôlables sur les documents classés par la GED (point 64 du bilan 2) : pièces du dossier
 * côté syndic, et documents à remettre à l'acquéreur. Liste seule : aucun état daté n'est calculé ici (aucun module
 * d'état daté n'existe ; tout futur module suivra le D. 1967 art. 5 dans sa version du D. 2025-1292). Fonctions pures.
 *
 * Le droit — 🟢 relu sur Légifrance (version en vigueur au 29/10/2026) :
 * - D. 1967 art. 4 : « tout acte conventionnel » réalisant ou constatant le transfert de propriété d'un lot ou la
 *   constitution d'un droit réel ; art. 5 (mod. D. 2025-1292, en vigueur depuis le 25/12/2025) : « avant
 *   l'établissement de l'un des actes mentionnés à l'article 4 », état daté en trois parties adressé au notaire, à sa
 *   demande ou à celle du copropriétaire qui transfère ses droits ; art. 5-1 : contenu de l'opposition ; art. 6 :
 *   notification au syndic de tout transfert ou constitution de droit, par les parties, le notaire ou l'avocat qui a
 *   obtenu la décision judiciaire, « indépendamment de l'avis de mutation » de l'art. 20 ;
 * - L. 1965 art. 20 (mod. loi 2024-322) : I, « lors de la mutation à titre onéreux d'un lot », certificat du syndic de
 *   moins d'un mois (vendeur libre de toute obligation), à défaut avis de mutation du notaire, puis opposition
 *   éventuelle du syndic dans les quinze jours ; II, « préalablement à l'établissement de l'acte authentique de vente
 *   d'un lot ou d'une fraction de lot », notification du candidat acquéreur par le notaire, certificat du syndic dans le
 *   mois (le bilan marquait l'art. 20 en 🔴 : relu, il passe en 🟢) ;
 * - CCH art. L. 721-2 (mod. loi 2021-1104, en vigueur depuis le 01/01/2024) : I, vente d'un lot d'un immeuble à usage
 *   total ou partiel d'habitation ; II, remise sur promesse (1° a à c, 2° a à d, 3° à 7°) et exceptions ; III, acte sans
 *   promesse (1°, 2° c, 3° à 7°, et « les quatre derniers alinéas du II ») ; IV, vente publique (1° à 7°, et « les
 *   vingtième et avant-dernier alinéas du II ») ;
 * - CCH art. L. 721-3 : si les documents et informations du 1° et du 2° (promesse) ou du 1° et du 2° c (acte sans
 *   promesse) ne sont pas remis ou joints, le délai de rétractation ou de réflexion ne court qu'à compter du lendemain de
 *   leur communication (délai non calculé ici) ; les 3° à 7° ne reportent pas ce délai ;
 * - L. 1965 art. 14-3, al. 2 (mod. ord. 2019-1101, en vigueur depuis le 01/06/2020) : charges et produits du syndicat
 *   « enregistrés dès leur engagement juridique », règle de TOUS les syndicats ; art. 41-8 : petites copropriétés (au
 *   plus cinq lots à usage de logements, de bureaux ou de commerces, ou budget prévisionnel moyen inférieur à
 *   15 000 €) ; art. 41-10 : « par dérogation à l'article 14-3 », pas de comptabilité en partie double.
 * 🟢 Gestéam : tranche 43 § 19 (types de l'étude notariale et du copropriétaire : demande pré-état daté / état daté,
 * avis de mutation art. 20, certificat article 20-2, procuration main-levée hypothèque, notification de vente) ; tranche
 * 23 § 1.1 (deux types de mutation : « Mutation à titre onéreux » · « Constitution de droit réel ») ; tranche 23 § 1.3
 * (état daté de Gestéam aligné sur les trois parties du D. 1967 art. 5).
 * 🔵 Déduit :
 * - « Certificat article 20-2 » (Gestéam) lu comme le certificat de l'art. 20, II ; aucun type Gestéam pour le
 *   certificat de l'art. 20, I : pièce non contrôlable ;
 * - « Notification de vente » (notaire, copropriétaire) et « Notification de vente article 6 » (avocat) lues comme la
 *   notification du D. 1967 art. 6 ;
 * - pièces du syndic selon la nature de la mutation (NatureMutation, trois critères pris dans les textes, que les deux
 *   types Gestéam ne suffisent pas à fixer : une « Mutation à titre onéreux » peut être une vente amiable, un échange ou
 *   une adjudication) : certificat de l'art. 20, II « requise » seulement pour une vente par acte authentique ; pièces
 *   de l'art. 20, I seulement pour une mutation à titre onéreux ; état daté « requise » pour un acte conventionnel de
 *   l'art. 4 (l'art. 5 y renvoie), « éventuelle » sinon (succession, décision de justice) ; notification de l'art. 6
 *   « requise » pour toute mutation ; un dossier de mutation ouvert suppose la demande d'état daté, qui reste
 *   « éventuelle » dans la GED (le cédant peut la faire hors GED) ;
 * - alinéas du L. 721-2 II comptés sur Légifrance : 20e = exception du lot annexe, 21e (avant-dernier) = définition du
 *   lot annexe ; la vente publique ne reprend donc pas l'exception de l'acquéreur déjà copropriétaire ;
 * - l'exception du 2° (2° b et c non exigés) est rédigée dans le 2° lui-même : les trois cadres de vente la reprennent
 *   (son champ est 🔴, ci-dessous) ;
 * - informations financières (2°) et notice d'information (4°) : pas des types de document, pièces non contrôlables.
 * 🔴 Non établi :
 * - renvoi non harmonisé : CCH L. 721-2 II 2° écarte les b et c « lorsque le syndicat de copropriétaires relève du
 *   deuxième alinéa de l'article 14-3 » ; cet alinéa ne désigne plus aucune catégorie de syndicat depuis l'ord.
 *   2019-1101 (dispense de partie double passée à l'art. 41-10, champ fixé par l'art. 41-8). Le drapeau
 *   `syndicatArt14_3Alinea2` reste faux par défaut. Question pour Frédéric ou Hugo : « L'exception de CCH L. 721-2 II 2°
 *   (2° b et c non exigés), qui renvoie au 2e alinéa de l'art. 14-3 devenu sans objet, vise-t-elle les petites
 *   copropriétés de l'art. 41-8 (dispense de l'art. 41-10) ? » ;
 * - « Une constitution ou une cession de droit réel consentie à titre onéreux (usufruit, nue-propriété) est-elle une
 *   "mutation à titre onéreux d'un lot" (L. 1965 art. 20, I) ou une "vente d'une fraction de lot" (art. 20, II) ? » —
 *   question pour Frédéric ou Hugo ; l'appelant renseigne NatureMutation en attendant ;
 * - « procuration main-levée hypothèque » : pièce de la pratique Gestéam, sans texte relu (certitude GESTEAM) ;
 * - contenu des informations financières et de la notice (arrêtés prévus par L. 721-2) : non relus.
 */

const mutation = (
  cle: string,
  libelle: string,
  modeles: readonly ModeleTypeDocument[],
  fondement: string,
  presence: PresencePiece,
): PieceAttendue => ({ cle, libelle, modeles, fondement, certitude: 'TEXTE', presence })

/** Nature de la mutation, au sens des textes qui fixent les pièces du syndic (🔵 trois critères). */
export interface NatureMutation {
  /** D. 1967 art. 4 : acte conventionnel (vente, échange, donation, constitution d'un droit réel) ; faux : succession, décision de justice. */
  acteConventionnel: boolean
  /** L. 1965 art. 20, I : « mutation à titre onéreux d'un lot » (vente, échange, adjudication). */
  titreOnereux: boolean
  /** L. 1965 art. 20, II : « acte authentique de vente d'un lot ou d'une fraction de lot ». */
  venteParActeAuthentique: boolean
}

/** Vente amiable d'un lot par acte authentique : le cas où toutes les pièces du syndic sont attendues. */
export const NATURE_VENTE_AMIABLE: Readonly<NatureMutation> = { acteConventionnel: true, titreOnereux: true, venteParActeAuthentique: true }

interface PieceMutation {
  piece: PieceAttendue
  /** Pièce attendue pour cette nature de mutation. */
  attendue: (nature: NatureMutation) => boolean
  /** Présence selon la nature ; absent : celle de la pièce. */
  presence?: (nature: NatureMutation) => PresencePiece
}

const TOUTE_MUTATION = (): boolean => true
const A_TITRE_ONEREUX = (nature: NatureMutation): boolean => nature.titreOnereux

/** Pièces du dossier de mutation côté syndic, dans l'ordre de la procédure. */
const PIECES_MUTATION_SYNDIC: readonly PieceMutation[] = [
  {
    piece: mutation(
      'demande_etat_date',
      "Demande d'état daté du notaire",
      modelesDe('Étude notariale', ['Demande pré-état daté / état daté']),
      'D. 1967 art. 5, al. 1 (à la demande du notaire ou du cédant)',
      'eventuelle',
    ),
    attendue: TOUTE_MUTATION,
  },
  {
    piece: mutation(
      'etat_date',
      'État daté en trois parties',
      modelesDe('Copropriétaire', ['État daté', 'État daté mutation']),
      "D. 1967 art. 5 (mod. D. 2025-1292), avant un acte de l'art. 4",
      'requise',
    ),
    attendue: TOUTE_MUTATION,
    presence: (nature) => (nature.acteConventionnel ? 'requise' : 'eventuelle'),
  },
  {
    piece: mutation(
      'certificat_art20_i',
      "Certificat du syndic de moins d'un mois : vendeur libre de toute obligation",
      [],
      'L. 1965 art. 20, I',
      'eventuelle',
    ),
    attendue: A_TITRE_ONEREUX,
  },
  {
    piece: mutation(
      'avis_mutation',
      'Avis de mutation du notaire (à défaut de certificat)',
      [...modelesDe('Étude notariale', ['Avis de mutation art. 20']), ...modelesDe("Cabinet d'avocat", ['Avis de mutation art. 20'])],
      'L. 1965 art. 20, I',
      'eventuelle',
    ),
    attendue: A_TITRE_ONEREUX,
  },
  {
    piece: mutation(
      'opposition_art20',
      'Opposition du syndic au versement des fonds',
      modelesDe('Huissier de justice', ["Opposition article 20 (acte d'huissier)"]),
      'L. 1965 art. 20, I ; D. 1967 art. 5-1',
      'eventuelle',
    ),
    attendue: A_TITRE_ONEREUX,
  },
  {
    piece: mutation(
      'certificat_art20_ii',
      'Certificat du syndic sur le candidat acquéreur, dans le mois de la notification',
      modelesDe('Étude notariale', ['Certificat article 20-2']),
      'L. 1965 art. 20, II',
      'requise',
    ),
    attendue: (nature) => nature.venteParActeAuthentique,
  },
  {
    piece: mutation(
      'notification_art6',
      'Notification du transfert de propriété au syndic',
      [
        ...modelesDe('Étude notariale', ['Notification de vente']),
        ...modelesDe("Cabinet d'avocat", ['Notification de vente article 6']),
        ...modelesDe('Copropriétaire', ['Notification de vente']),
      ],
      'D. 1967 art. 6',
      'requise',
    ),
    attendue: TOUTE_MUTATION,
  },
  {
    piece: {
      cle: 'procuration_mainlevee',
      libelle: "Procuration de mainlevée d'hypothèque",
      modeles: modelesDe('Étude notariale', ['Procuration main-levée hypothèque']),
      fondement: null,
      certitude: 'GESTEAM',
      presence: 'eventuelle',
    },
    attendue: TOUTE_MUTATION,
  },
]

/** Pièces du dossier de mutation côté syndic pour cette nature de mutation, dans l'ordre de la procédure. */
export function piecesMutationSyndic(nature: NatureMutation): PieceAttendue[] {
  if (nature.venteParActeAuthentique && !nature.titreOnereux)
    throw new Error('Nature de mutation incohérente : une vente (L. 1965 art. 20, II) est une mutation à titre onéreux.')
  return PIECES_MUTATION_SYNDIC.filter((p) => p.attendue(nature)).map((p) => ({
    ...p.piece,
    presence: p.presence ? p.presence(nature) : p.piece.presence,
  }))
}

/** Cadre de la vente (CCH art. L. 721-2, II, III et IV). */
export type ModeVente = 'promesse' | 'acte_sans_promesse' | 'vente_publique'

export interface CirconstancesVente {
  mode: ModeVente
  acquereurDejaCoproprietaire: boolean
  /** Lot annexe : stationnement, cave, grenier, débarras, placard, remise, garage, cellier (L. 721-2, II). */
  lotAnnexe: boolean
  /**
   * 🔴 Syndicat qui « relève du deuxième alinéa de l'article 14-3 » (CCH L. 721-2, II, 2°) : renvoi non harmonisé, cet
   * alinéa ne désignant plus aucune catégorie de syndicat (voir l'en-tête). À ne cocher qu'après la réponse de Frédéric
   * ou Hugo ; absent : faux, les 2° b et c restent exigés.
   */
  syndicatArt14_3Alinea2?: boolean
  /** L. 721-2, I : immeuble à usage total ou partiel d'habitation ; `false` → aucune pièce. Absent : à usage d'habitation. */
  usageHabitation?: boolean
}

const remise = (
  cle: string,
  libelle: string,
  modeles: readonly ModeleTypeDocument[],
  numero: string,
  presence: PresencePiece = 'requise',
): PieceAttendue => ({ cle, libelle, modeles, fondement: `CCH art. L. 721-2, II, ${numero}`, certitude: 'TEXTE', presence })

/** Documents et informations du L. 721-2, II, dans l'ordre du texte. */
export const PIECES_REMISE_ACQUEREUR: readonly PieceAttendue[] = [
  remise('1a', 'Fiche synthétique de la copropriété', modelesDe('Base', ['Fiche synthétique', 'Fiche synthétique de la copropriété']), '1°, a)'),
  remise(
    '1b',
    'Règlement de copropriété, état descriptif de division et actes modificatifs publiés',
    modelesDe('Étude notariale', ['Règlement de copropriété (règlement, modificatifs)']),
    '1°, b)',
  ),
  remise(
    '1c',
    'Procès-verbaux des assemblées générales des trois dernières années',
    modelesDe('Base', ["Procès-verbal d'assemblée", "Procès-verbal d'assemblée signé"]),
    '1°, c)',
  ),
  remise('2a', 'Charges courantes et hors budget payées par le vendeur sur les deux exercices précédents', [], '2°, a)'),
  remise('2b', "Sommes susceptibles d'être dues au syndicat par l'acquéreur", [], '2°, b)'),
  remise('2c', 'État global des impayés de charges et de la dette envers les fournisseurs', [], '2°, c)'),
  remise('2d', 'Part du fonds de travaux rattachée au lot et dernière cotisation versée', [], '2°, d)', 'eventuelle'),
  remise('3', "Carnet d'entretien de l'immeuble", modelesDe('Base', ["Carnet d'entretien"]), '3°'),
  remise('4', "Notice d'information sur les droits et obligations des copropriétaires", [], '4°'),
  remise('5', 'Conclusions du diagnostic technique global', modelesDe('Base', ['Diagnostic technique global']), '5°', 'eventuelle'),
  remise('6', 'Plan pluriannuel de travaux adopté', modelesDe('Base', ['Plan pluriannuel de travaux (PPT)']), '6°', 'eventuelle'),
  remise(
    '7',
    'Projet de plan pluriannuel de travaux, à défaut de plan adopté',
    modelesDe('Base', ['Projet de plan pluriannuel de travaux (PPPT)']),
    '7°',
    'eventuelle',
  ),
]

const TOUTES = PIECES_REMISE_ACQUEREUR.map((p) => p.cle)
const CARNET_ET_TRAVAUX = ['3', '4', '5', '6', '7']

/** Pièces visées par chaque cadre de vente (II, III, IV). */
const PERIMETRE_PAR_MODE: Readonly<Record<ModeVente, readonly string[]>> = {
  promesse: TOUTES,
  acte_sans_promesse: ['1a', '1b', '1c', '2c', ...CARNET_ET_TRAVAUX],
  vente_publique: TOUTES,
}

interface Exception {
  applicable: (c: CirconstancesVente) => boolean
  modes: readonly ModeVente[]
  nonExigees: readonly string[]
}

/** Exceptions du II et leur reprise par le III (« quatre derniers alinéas ») et le IV (« vingtième et avant-dernier »). */
const EXCEPTIONS: readonly Exception[] = [
  {
    applicable: (c) => c.acquereurDejaCoproprietaire,
    modes: ['promesse', 'acte_sans_promesse'],
    nonExigees: ['1a', '1b', '1c', ...CARNET_ET_TRAVAUX],
  },
  { applicable: (c) => c.lotAnnexe, modes: ['promesse', 'acte_sans_promesse', 'vente_publique'], nonExigees: ['1c', ...CARNET_ET_TRAVAUX] },
  { applicable: (c) => c.syndicatArt14_3Alinea2 === true, modes: ['promesse', 'acte_sans_promesse', 'vente_publique'], nonExigees: ['2b', '2c'] },
]

/** Documents et informations à remettre à l'acquéreur (ou à joindre à l'acte, ou à annexer au cahier des charges). */
export function piecesRemiseAcquereur(circonstances: CirconstancesVente): PieceAttendue[] {
  if (circonstances.usageHabitation === false) return []
  const exclues = new Set<string>()
  for (const exception of EXCEPTIONS)
    if (exception.modes.includes(circonstances.mode) && exception.applicable(circonstances)) exception.nonExigees.forEach((cle) => exclues.add(cle))
  const perimetre = new Set(PERIMETRE_PAR_MODE[circonstances.mode])
  return PIECES_REMISE_ACQUEREUR.filter((p) => perimetre.has(p.cle) && !exclues.has(p.cle))
}
