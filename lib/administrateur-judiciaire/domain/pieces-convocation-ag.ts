/**
 * Pièces à notifier avec la convocation d'une assemblée générale et formulaire de vote par correspondance : référentiel
 * et contrôle (décision de Hugo du 17/11/2026, J67, R25). Fonctions pures, sans écran ni table : écran : Frédéric ;
 * enregistrement des pièces jointes : à brancher. Le gabarit de convocation (gabarits-courrier.ts, convocation_ag_vpc)
 * renvoie à ce module.
 *
 * Le droit — D. 1967 art. 11, version du 25/12/2025 (décret n° 2025-1292, art. 6), lu sur Légifrance le 17/11/2026
 * (R25), liste des alinéas relue le 18/11/2026 : « Sont notifiés au plus tard en même temps que l'ordre du jour » : I,
 * quatorze pièces « pour la validité de la décision » ; II, dix pièces « pour l'information des copropriétaires ».
 * D. 1967 art. 9 : le formulaire de vote par correspondance est joint à la convocation ; art. 9 bis : il est reçu au
 * plus tard trois jours francs avant la réunion. Arrêté du 2 juillet 2020, art. 1 : le formulaire suit le modèle annexé.
 *
 * J67, R25 : pour chaque question inscrite, une pièce du I qui la concerne et qui manque donne une alerte forte (la
 * décision risque l'annulation) ; une pièce du II, un simple avertissement ; le formulaire absent est signalé.
 *
 * Pièces d'une question (J67, R25 : référentiel « par type de question ») : celles du type de la question
 * (PIECES_PAR_TYPE_QUESTION), pour les seuls cas que l'art. 11 nomme lui-même, puis celles que l'appelant désigne en plus
 * d'après le cas du texte (champ « cas », null quand l'alinéa n'en écrit pas ; par exemple I, 9° pour une question née du
 * rapport de l'administrateur provisoire). Chaque question porte un type, « autre » quand l'art. 11 ne nomme pas son
 * cas : le contrôle ne dépend pas de la mémoire du gestionnaire. 🔵 Choix : aucune pièce n'est déduite du libellé de la
 * question ; les libellés résument chaque alinéa, ils n'en sont pas la lettre ; formulaire absent : avertissement, R25
 * ne fixant pas sa gravité.
 *
 * 🔴 Rubriques du formulaire (modèle annexé à l'arrêté du 2 juillet 2020, publié en image au JO du 03/07/2020) : non
 * lues ; à coder comme mentions obligatoires après leur lecture par Hugo (J67, R25).
 */

export const PARTIES_ART_11 = ['validite', 'information'] as const
export type PartieArt11 = (typeof PARTIES_ART_11)[number]

export interface PieceArt11 {
  partie: PartieArt11
  /** Alinéa de l'art. 11, tel que le texte le numérote. */
  numero: string
  piece: string
  /** Quand la pièce est due, selon le texte ; null : l'alinéa n'écrit pas de condition. */
  cas: string | null
}

const validite = (n: number, piece: string, cas: string | null = null): PieceArt11 => ({ partie: 'validite', numero: `I, ${n}°`, piece, cas })
const information = (n: number, piece: string, cas: string | null = null): PieceArt11 => ({ partie: 'information', numero: `II, ${n}°`, piece, cas })

export const PIECES_ART_11 = {
  'I-1': validite(1, "État financier du syndicat et compte de gestion général, avec le comparatif de l'exercice précédent approuvé", "lorsque l'assemblée est appelée à approuver les comptes"),
  'I-2': validite(2, 'Projet du budget, avec le comparatif du dernier budget prévisionnel voté', "lorsque l'assemblée est appelée à voter le budget prévisionnel"),
  'I-3': validite(
    3,
    "Conditions essentielles du contrat ou, en cas d'appel à la concurrence, des contrats proposés (prêt au nom du syndicat : L. 1965 art. 26-4, 26-7 et 26-12)",
    "lorsque l'assemblée est appelée à approuver un contrat, un devis ou un marché",
  ),
  'I-4': validite(4, "Projet ou projets de contrat du syndic, avec la fiche d'information (L. 1965 art. 18-1 A, I, al. 3)", "lorsque l'assemblée est appelée à désigner le représentant légal du syndicat"),
  'I-5': validite(5, "Projet de convention, ou convention, de l'art. 39 de la loi"),
  'I-6': validite(
    6,
    "Projet de règlement de copropriété, d'état descriptif de division ou d'état de répartition des charges, ou de leur modification",
    "lorsque l'assemblée est appelée, suivant le cas, à établir ou à modifier ces actes",
  ),
  'I-7': validite(
    7,
    'Projet de résolution',
    "lorsque l'assemblée est appelée à statuer sur l'une des questions des art. 14-1, 18-1 A, 24, II, 25, 25-2-1, 26, 30, 35, 37 et 39 de la loi (alinéas précisés par le texte)",
  ),
  'I-8': validite(8, 'Projet de résolution autorisant le syndic à introduire une demande en justice', "s'il y a lieu"),
  'I-9': validite(
    9,
    "Conclusions du rapport de l'administrateur provisoire (L. 1965 art. 29-1)",
    "lorsque l'assemblée est appelée à statuer sur une question dont la mention à l'ordre du jour résulte de ces conclusions",
  ),
  'I-10': validite(10, 'Conclusions du rapport du mandataire ad hoc (L. 1965 art. 29-1 B)', "lorsqu'il en a été désigné un par le président du tribunal judiciaire"),
  'I-11': validite(
    11,
    "Projets de résolution mentionnant la saisie immobilière d'un lot, le montant de la mise à prix et celui des sommes estimées définitivement perdues",
    "lorsque l'assemblée générale est appelée à autoriser le syndic à poursuivre la saisie immobilière d'un lot",
  ),
  'I-12': validite(12, "Projets des conventions et avis du conseil syndical de l'art. 41-6, al. 3 de la loi, ou projet de délégation (al. 2)"),
  'I-13': validite(13, "Rapport de l'art. 41-1, al. 3 de la loi"),
  'I-14': validite(
    14,
    "Analyse des solutions éventuelles n'affectant pas les parties privatives (L. 1965 art. 9, II)",
    "lorsque l'assemblée générale est appelée à se prononcer sur des travaux d'intérêt collectif sur parties privatives",
  ),
  'II-1': information(1, 'Annexes au budget prévisionnel'),
  'II-2': information(2, 'État détaillé des sommes perçues par le syndic au titre de sa rémunération'),
  'II-3': information(3, 'Avis du conseil syndical (L. 1965 art. 21, al. 2)', 'lorsque sa consultation est obligatoire'),
  'II-4': information(4, "Compte rendu de l'exécution de la mission du conseil syndical (D. 1967 art. 22, al. 2 ; L. 1965 art. 41-6, al. 3)"),
  'II-5': information(5, "Projet d'état individuel de répartition des comptes de chaque copropriétaire", "en vue de l'approbation des comptes par l'assemblée générale"),
  'II-6': information(6, 'État actualisé des lots délaissés (L. 1965 art. 24-6, al. 2)'),
  'II-7': information(7, "Compte rendu de la dernière réunion du conseil des résidents, avec l'avis émis (L. 1965 art. 41-7, al. 4)"),
  'II-8': information(8, 'Descriptif détaillé des travaux (L. 1965 art. 25-2, al. 1 ; art. 25-2-1, al. 2)'),
  'II-9': information(
    9,
    "Présentation générale des principales caractéristiques du recours à l'emprunt collectif",
    "lorsque la question de la souscription d'un tel emprunt est inscrite à l'ordre du jour de l'assemblée générale",
  ),
  'II-10': information(10, "Rapport du dernier alinéa de l'art. 21-5 de la loi"),
} as const satisfies Record<string, PieceArt11>

export type CodePieceArt11 = keyof typeof PIECES_ART_11
export const CODES_PIECES_ART_11 = Object.keys(PIECES_ART_11) as CodePieceArt11[]

/**
 * Pièces de chaque type de question (J67, R25) : seulement les cas que l'art. 11 nomme lui-même, par le « cas » de la
 * pièce ou par son objet (annexes au budget, II, 1°). Désignation du syndic et des membres du conseil syndical : L. 1965
 * art. 25, c, article cité au I, 7° (projet de résolution). « autre » : aucun cas nommé, aucune pièce par défaut.
 */
export const PIECES_PAR_TYPE_QUESTION = {
  approbation_comptes: { libelle: 'Approbation des comptes', pieces: ['I-1', 'II-5'] },
  budget: { libelle: 'Vote du budget prévisionnel', pieces: ['I-2', 'II-1'] },
  contrat_devis_marche: { libelle: "Approbation d'un contrat, d'un devis ou d'un marché (travaux votés sur devis compris)", pieces: ['I-3'] },
  mandat_syndic: { libelle: 'Désignation du syndic (L. 1965 art. 25, c)', pieces: ['I-4', 'I-7'] },
  mandat_cs: { libelle: 'Désignation des membres du conseil syndical (L. 1965 art. 25, c)', pieces: ['I-7'] },
  actes_copropriete: {
    libelle: "Établissement ou modification du règlement de copropriété, de l'état descriptif de division ou de l'état de répartition des charges",
    pieces: ['I-6'],
  },
  demande_en_justice: { libelle: 'Autorisation donnée au syndic d’introduire une demande en justice', pieces: ['I-8'] },
  saisie_immobiliere: { libelle: "Autorisation de poursuivre la saisie immobilière d'un lot", pieces: ['I-11'] },
  travaux_parties_privatives: { libelle: "Travaux d'intérêt collectif sur parties privatives", pieces: ['I-14'] },
  emprunt_collectif: { libelle: "Souscription d'un emprunt collectif", pieces: ['II-9'] },
  autre: { libelle: "Autre question (cas non nommé par l'art. 11)", pieces: [] },
} as const satisfies Record<string, { libelle: string; pieces: readonly CodePieceArt11[] }>

export type TypeQuestionArt11 = keyof typeof PIECES_PAR_TYPE_QUESTION
export const TYPES_QUESTION_ART_11 = Object.keys(PIECES_PAR_TYPE_QUESTION) as TypeQuestionArt11[]

/** Une question de l'ordre du jour, son type, les pièces désignées en plus et celles jointes à la convocation. */
export interface QuestionConvocation {
  id: string
  libelle: string
  /** Ses pièces viennent de PIECES_PAR_TYPE_QUESTION ; « autre » quand l'art. 11 ne nomme pas son cas. */
  type: TypeQuestionArt11
  /** Pièces en plus de celles du type, d'après le cas du texte (I, 7°, 9° ou 10° ; II, 3°…) ; absent : aucune. */
  piecesAttendues?: readonly CodePieceArt11[]
  piecesJointes: readonly CodePieceArt11[]
}

export interface AnomaliePiecesConvocation {
  code: 'piece_validite_manquante' | 'piece_information_manquante' | 'formulaire_vote_absent'
  gravite: 'alerte_forte' | 'avertissement'
  /** null : anomalie de la convocation entière (formulaire). */
  questionId: string | null
  message: string
  fondement: string
}

const minusculeInitiale = (texte: string): string => texte.charAt(0).toLowerCase() + texte.slice(1)

function verifierCodes(codes: readonly string[], question: string): void {
  for (const code of codes)
    if (!Object.hasOwn(PIECES_ART_11, code)) throw new Error(`Question « ${question} » : pièce « ${code} » inconnue (référentiel de l'art. 11 attendu).`)
}

function verifierQuestions(questions: readonly QuestionConvocation[]): void {
  const vus = new Set<string>()
  for (const question of questions) {
    if (!question.id?.trim()) throw new Error('Question de la convocation sans identifiant.')
    if (!question.libelle?.trim()) throw new Error(`Question « ${question.id} » sans libellé.`)
    if (vus.has(question.id)) throw new Error(`Question « ${question.id} » en double dans la convocation.`)
    vus.add(question.id)
    if (!Object.hasOwn(PIECES_PAR_TYPE_QUESTION, question.type))
      throw new Error(
        `Question « ${question.id} » : type de question « ${String(question.type)} » inconnu (${TYPES_QUESTION_ART_11.join(', ')} attendu ; « autre » si l'art. 11 ne nomme pas son cas).`,
      )
    verifierCodes(question.piecesAttendues ?? [], question.id)
    verifierCodes(question.piecesJointes, question.id)
  }
}

/** Pièces attendues : celles du type, puis celles désignées en plus, sans doublon (J67, R25). */
const piecesAttenduesDe = (question: QuestionConvocation): CodePieceArt11[] => [
  ...new Set<CodePieceArt11>([...PIECES_PAR_TYPE_QUESTION[question.type].pieces, ...(question.piecesAttendues ?? [])]),
]

const SUITE_PAR_PARTIE: Record<PartieArt11, { code: AnomaliePiecesConvocation['code']; gravite: AnomaliePiecesConvocation['gravite']; pourquoi: string }> = {
  validite: {
    code: 'piece_validite_manquante',
    gravite: 'alerte_forte',
    pourquoi: "pour la validité de la décision : la décision risque l'annulation",
  },
  information: { code: 'piece_information_manquante', gravite: 'avertissement', pourquoi: "pour l'information des copropriétaires" },
}

function anomaliesDeLaQuestion(question: QuestionConvocation): AnomaliePiecesConvocation[] {
  const jointes = new Set<string>(question.piecesJointes)
  return piecesAttenduesDe(question)
    .filter((code) => !jointes.has(code))
    .map((code) => {
      const { partie, numero, piece } = PIECES_ART_11[code]
      const { code: codeAnomalie, gravite, pourquoi } = SUITE_PAR_PARTIE[partie]
      return {
        code: codeAnomalie,
        gravite,
        questionId: question.id,
        message: `Question « ${question.libelle.trim()} » : pièce manquante (${minusculeInitiale(piece)}) ; elle se notifie au plus tard avec l'ordre du jour ${pourquoi}.`,
        fondement: `D. 1967 art. 11, ${numero}`,
      }
    })
}

/**
 * Contrôle d'une convocation (J67, R25) : pour chaque question, les pièces attendues (celles de son type, puis celles
 * désignées en plus) qui ne sont pas jointes (I : alerte forte ; II : avertissement), puis le formulaire de vote par
 * correspondance (D. 1967 art. 9). Refus : question sans identifiant ou sans libellé, identifiant en double, type de
 * question inconnu ou absent, code de pièce inconnu. Liste vide : rien à signaler.
 */
export function controlerPiecesConvocation({
  questions,
  formulaireVoteJoint,
}: {
  questions: readonly QuestionConvocation[]
  formulaireVoteJoint: boolean
}): AnomaliePiecesConvocation[] {
  verifierQuestions(questions)
  const anomalies = questions.flatMap(anomaliesDeLaQuestion)
  if (!formulaireVoteJoint)
    anomalies.push({
      code: 'formulaire_vote_absent',
      gravite: 'avertissement',
      questionId: null,
      message:
        'Formulaire de vote par correspondance non joint : il est joint à la convocation ; il doit être reçu au plus tard trois jours francs avant la réunion.',
      fondement: 'D. 1967 art. 9 et 9 bis',
    })
  return anomalies
}
