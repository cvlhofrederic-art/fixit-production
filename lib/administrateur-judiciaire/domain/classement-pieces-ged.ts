import { normaliserTexteLibre } from '@/lib/administrateur-judiciaire/domain/texte'
import {
  codeTypeDocument,
  codeTypesAConfirmer,
  correspondAuModele,
  creerReferenceTypeDocument,
  type ControleTypeDocument,
  type ReferenceTypeDocument,
} from '@/lib/administrateur-judiciaire/domain/typologie-documents'

/**
 * Classement d'une pièce importée dans la typologie GED (point 64 du bilan 2). Règles LOCALES, sans IA ; fonctions
 * pures. Indépendant de classerDocument (import-documents-mandat.ts, inchangé) : son gagnant unique écartait des
 * candidats (une ordonnance d'expropriation qui désigne ses parcelles n'y était qu'un cadastre).
 *
 * La décision — décision de Hugo du 03/11/2026 : « le classement d'après le texte est une suggestion seulement ». Sept
 * tours de règles qui décidaient d'un type « sûr » d'après le texte n'avaient pas convergé : chaque tour trouvait de
 * nouveaux « sûrs » faux. D'où le contrat :
 * 1. le classement d'après le texte (suggererClassement) ne rend JAMAIS un type sûr : il rend une SUGGESTION, la liste
 *    ordonnée des types candidats avec leurs indices (pour une ordonnance, ses sous-types candidats) ; aucun candidat :
 *    « non classé » ;
 * 2. un type n'est confirmé que par une source explicite, que le résultat porte (`source`) : le gestionnaire
 *    (confirmerClassement : un type du référentiel, parmi les candidats ou hors d'eux, ce qui est signalé) ou la
 *    catégorie d'origine fournie à l'import (classementDeLImport) ; le texte (`texte`) ne confirme rien ;
 * 3. un document dont le type n'est pas confirmé ne compte JAMAIS comme pièce présente : codeGedDuClassement donne à
 *    toute suggestion le code « à confirmer » de typologie-documents.ts, qui n'est la référence d'aucun type ; les
 *    contrôles de pièces (controlerPieces, piecesRepriseCouvertesParGed) rangent « à vérifier », distincte de
 *    « manquante », la pièce que l'un de ses candidats couvrirait ; la conservation le dit « à confirmer ».
 *
 * Gestéam — 🟢 tranche 43 § 19 : « le classement des pièces suit le rôle du tiers », chaque rôle avec son vocabulaire ;
 * 🟢 tranche 22 § 6.2 : « le cycle judiciaire est porté par la catégorie Tribunal » (requête → ordonnance de
 * désignation → notification → prolongation → taxe → fin de mission → rapport de mission) ; types visés relevés en
 * tranches 22 § 6 et 43 § 19.
 * 🔵 Déduit :
 * - proposition VitFix de la cartographie (tranche 43 § 19, « Apports VitFix », non observée dans Gestéam) : « reprendre
 *   ce référentiel { roleTiers, type } pour classer les pièces importées » ; les motifs de reconnaissance sont VitFix
 *   (Gestéam classe à la main) ;
 * - CANDIDAT : type dont le mot-titre figure dans le texte avec au moins un de SES indices, trouvé hors de ce mot-titre ;
 *   chaque type est évalué pour lui-même (ordonnance, règlement et cadastre peuvent être candidats ensemble) ; une
 *   ordonnance propose TOUS ses sous-types (le texte ne tranche pas entre eux) ;
 * - ORDRE des candidats, qui ne rend rien sûr (un écran ne présélectionne pas le premier candidat) ; aucun comptage
 *   d'indices :
 *   1. chaque type à la position de la première occurrence de son mot-titre ; à mot-titre égal, le type le plus précis
 *      d'abord (facture d'honoraires, devis de pré-état daté) ;
 *   2. une ordonnance seulement citée passe après tous les autres candidats. C'est la ligne de qualité de
 *      l'administrateur provisoire, au-dessus de sa lettre, de sa convocation ou de sa facture. Citée :
 *      - derrière un déterminant ou une préposition (« par ordonnance », « l'ordonnance », « suivant ordonnance »,
 *        « Réf. : ordonnance ») ;
 *      - désignée par sa date, introduite par « du » ou « en date du » juste après le mot, après son objet (au plus deux
 *        mots, chacun introduit par « de », « du », « d' » ou « sur » : « de prorogation », « de référé », « sur
 *        requête ») ou après son tribunal. La date est un jour (« 2 », « 1er », « 1 er » de la couche texte d'un PDF où
 *        « er » est en exposant, « premier »), précédé ou non du jour de la semaine, suivi d'un mois en toutes lettres ou
 *        abrégé (« 2 mars », « 2 sept. », « 15 févr. », « 10 juill. »), ou une date chiffrée, jour ou année d'abord
 *        (« 02/03/2026 ») : « Ordonnance de prorogation du 2 mars 2026 », « … en date du 1er mars 2019 » ;
 *      - désignée par sa juridiction et son siège, datée ou non (« Ordonnance du tribunal judiciaire de Tours, RG … »,
 *        « (ordonnance du TJ de Tours, RG …) »), derrière le magistrat qui la rend ou non : « du président », « de la
 *        présidente », « de M. le président », « du vice-président », « du premier vice-président », « du juge des
 *        référés », « du magistrat délégué par le président » (« Ordonnance du premier vice-président du TJ de Tours »).
 *      « du » devant un nom n'est ni une date ni un siège (« ORDONNANCE DE DÉSIGNATION DU SYNDIC JUDICIAIRE », « DU
 *      PRÉSIDENT DU TRIBUNAL JUDICIAIRE », « DU PREMIER PRÉSIDENT », « DU 2E ADMINISTRATEUR », « DU 1 ER
 *      ADMINISTRATEUR ») ;
 *   3. pour une ordonnance, ses sous-types : ceux que ses mots évoquent (dans l'ordre de leur premier mot), puis
 *      « Ordonnance (autres) », puis les autres.
 *   Limites de l'ordre (le vrai type reste candidat, rien ne devient sûr) :
 *   - une ordonnance titrée par sa date (« Ordonnance du 2 mars 2026 », « ORDONNANCE DE TAXE DU 3 NOVEMBRE 2026 »,
 *     « ORDONNANCE DE DÉSIGNATION DU 2 SEPT. 2025 ») ou par sa juridiction et son siège (« ORDONNANCE DU PRÉSIDENT DU
 *     TRIBUNAL JUDICIAIRE DE TOURS », « ORDONNANCE DU VICE-PRÉSIDENT DU TRIBUNAL JUDICIAIRE DE TOURS ») se lit comme une
 *     citation et passe aussi après les autres ;
 *   - une ligne de qualité qui nomme l'ordonnance sans déterminant, ni date, ni siège dans les formes du point 2 la
 *     place à sa position, en tête : le vrai type de la pièce vient après ses six sous-types. Ainsi : rien de daté ni de
 *     juridiction derrière « du » (« Ordonnance de désignation, RG 25/01234 », « Ordonnance de désignation : TJ Tours,
 *     2 mars 2026 »), un numéro avant « du » (« Ordonnance RG 25/01234 du 2 mars 2025 », « Ordonnance n° 26/00045 du 2
 *     mars 2026 »), une date sans « du » (« Ordonnance rendue le 2 mars 2026 »), un magistrat hors de la liste
 *     (« Ordonnance du juge de la mise en état du tribunal judiciaire de Tours »), une juridiction sans siège
 *     (« Ordonnance du Président du tribunal judiciaire »), plus de deux mots d'objet avant « du » (« Ordonnance de
 *     désignation d'un administrateur provisoire du tribunal judiciaire de Tours ») ;
 * - facture et devis rangés sous Fournisseur (types génériques, tiers inconnu à l'import) ; mise en demeure : seul type
 *   relevé, Copropriétaire › Mise en demeure, proposé aussi pour celle d'un fournisseur (le gestionnaire tranche) ;
 * - demande d'état daté (« demande d'état daté », « demande de délivrance d'un état daté », « bien vouloir m'adresser
 *   l'état daté ») : type « Demande pré-état daté / état daté » de l'étude notariale ; ces expressions ne font pas de
 *   l'état daté un candidat ; « arrêté de mise en sécurité » reconnu comme « Arrêté de péril », libellé Gestéam ;
 * - gestionnaire : un type libre (catégorie non relevée, hors du relevé de Copropriétaire) est accepté et signalé
 *   (`controle`, `horsCandidats`) ; import : catégorie et type d'origine sont des libellés Gestéam, lus dans le
 *   référentiel relevé lui-même (referentiel-types-document.ts, sans table de passage) ;
 * - le code GED rangé dans DocumentLocal.type ne garde que la catégorie et le type (`controle` s'en recalcule) : la
 *   source et `horsCandidats` ne lui survivent pas, à porter par l'écran ou la table (côté Frédéric) ; une confirmation
 *   ultérieure part des candidats du document rangé (candidatsDuDocument).
 * 🔴 Non établi :
 * - « L'export des documents Gestéam porte-t-il la catégorie et le type de chaque pièce, sous les libellés du
 *   référentiel relevé ? » — format de l'export non relevé, question pour Hugo ; en attendant, classementDeLImport
 *   refuse tout libellé hors du relevé, type libre compris (la pièce reste à suggérer, puis à confirmer) ;
 * - voir typologie-documents.ts (classement de l'ordonnance d'un mandat, à confirmer par Hugo) ;
 * - « Dans quel type Gestéam est rangé le pré-état daté lui-même (document du syndic remis avant la promesse) ? » —
 *   question pour Hugo : une pièce titrée « Pré-état daté » n'est proposée ni comme état daté ni comme demande.
 */

// ── Résultat ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface TypeCandidat {
  ref: ReferenceTypeDocument
  /** Indices relevés dans le texte normalisé, mot-titre d'abord. */
  indices: string[]
}

/** Classement d'après le texte : une suggestion, jamais un type sûr. */
export interface SuggestionClassement {
  source: 'texte'
  /** `suggestion` : au moins un candidat ; `non_classe` : aucun. */
  statut: 'suggestion' | 'non_classe'
  /** Types candidats dans l'ordre de la pièce ; pour une ordonnance, tous ses sous-types, les sous-types évoqués d'abord. */
  candidats: TypeCandidat[]
}

/** Type confirmé par une source explicite. */
export interface ClassementConfirme {
  source: 'gestionnaire' | 'import'
  ref: ReferenceTypeDocument
  /** Contrôle du référentiel ; hors de `referentiel` (type libre), accepté du seul gestionnaire et signalé. */
  controle: ControleTypeDocument
  /** Gestionnaire : type choisi hors des candidats, signalé ; toujours faux pour l'import. */
  horsCandidats: boolean
}

export type ClassementPiece = SuggestionClassement | ClassementConfirme

/** Catégorie et type saisis ou importés : libellés du référentiel (casse, accents et élision tolérés). */
export interface LibellesType {
  categorie: string
  type: string
}

// ── Indices ──────────────────────────────────────────────────────────────────────────────────────────────────────

interface TypeGed {
  /** Type proposé ; `ordonnance` : tous les sous-types d'ordonnance. */
  ref: ReferenceTypeDocument | 'ordonnance'
  /** Mot-titre obligatoire du candidat. */
  titre: RegExp
  /** Au moins un, trouvé hors du mot-titre, rend le type candidat. */
  indices: readonly RegExp[]
  /** Occurrences (motif global) effacées avant de chercher le mot-titre : « demande d'état daté » n'est pas un état daté. */
  horsTitre?: RegExp
  /** Occurrences seulement citées du mot-titre (motif global) : elles rendent le type candidat sans le placer. */
  citation?: RegExp
}

const MAIRIE = /\bmaire\b|\bmairie\b/
const HT = /\bht\b/
const TVA = /\btva\b/
const ASSEMBLEE_GENERALE = /\bassemblee generale\b/
const VOTE = /\badoptee?s?\b|\brejetee?s?\b|\babstention|\bvote(?:nt)? (?:pour|contre)\b/
const PRESENCE = /\bfeuille de presence\b|\bpresents (?:ou|et) representes\b/
const ARTICLE_5 = /\barticle 5\b|\bart 5\b/
const DECRET_1967 = /\bdecret du 17 mars 1967\b/
const ETAT_DATE = String.raw`(?:pre )?etat date\b`
const DEMANDE_ETAT_DATE = String.raw`\bdemande (?:de (?:delivrance )?)?(?:(?:d|du|l|un|d un|de l) )?${ETAT_DATE}`
const REQUETE_ETAT_DATE = String.raw`\b(?:m|me|nous) (?:adresser|transmettre|communiquer|faire parvenir|delivrer)(?: (?:l|un|le|votre|d un))? ${ETAT_DATE}`
/** Ordonnance citée derrière un déterminant ou une préposition : « par ordonnance », « l'ordonnance », « Réf. : ordonnance ». */
const ORDONNANCE_REFERENCEE = /\b(?:par|suivant|une|d une|notre|votre|l|ref) ordonnance\b/
/** Mois en toutes lettres ou abrégé (« janv. », « févr. », « fév. », « avr. », « juil. », « juill. », « sept. », « déc. »). */
const MOIS = String.raw`(?:janv(?:ier)?|fevr?(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let|l)?|aout|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|dec(?:embre)?)`
/** Jour : « 2 », « 1er », « 1 er » (couche texte d'un PDF, « er » en exposant), « premier » ; jour de la semaine admis devant. */
const JOUR = String.raw`(?:(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) )?(?:1 ?er|premier|\d{1,2})`
/** Date : un jour suivi d'un mois (« 2 mars », « 1 er mars », « 2 sept. ») ou une date chiffrée, jour ou année d'abord. */
const DATE = String.raw`(?:${JOUR} ${MOIS}|\d{1,2} \d{1,2} \d{2,4}|\d{4} \d{1,2} \d{1,2})\b`
/** Objet de l'ordonnance, au plus deux mots introduits par « de », « du », « d' » ou « sur » : « de prorogation », « sur requête ». */
const OBJET = String.raw`(?: (?:d\w*|sur) \w+){0,2}`
/**
 * Ordonnance désignée par sa date, derrière son objet ou sa juridiction : « Ordonnance de prorogation du 2 mars 2026 »,
 * « ordonnance du tribunal judiciaire du 1er mars 2025 ». « du » devant un nom n'est pas une date, ordinal compris
 * (« DU PREMIER PRÉSIDENT », « DU 2E ADMINISTRATEUR », « DU 1 ER ADMINISTRATEUR »).
 */
const ORDONNANCE_DATEE = new RegExp(String.raw`\bordonnance${OBJET}(?: du tribunal(?: \w+){1,5}?)?(?: en date)? du ${DATE}`)
/** Président de la juridiction : « président(e) », « vice-président(e) », « premier (première) vice-président(e) ». */
const PRESIDENT = String.raw`(?:(?:premier|premiere) vice |vice )?presidente?`
/**
 * Magistrat qui rend l'ordonnance, devant sa juridiction : « du président », « de la présidente », « de M. le président »,
 * « du premier vice-président », « du juge des référés », « du magistrat délégué par le président ».
 */
const MAGISTRAT = String.raw`(?:du|de la|de (?:m|mme|monsieur|madame) (?:le|la)) (?:${PRESIDENT}|juge des referes|(?:juge|magistrat) deleguee?(?: par (?:le|la|m le|mme la) ${PRESIDENT})?) du`
/** Juridiction suivie de son siège (« tribunal judiciaire de Tours », « TJ de Tours ») ; « de grande instance » n'en est pas un. */
const JURIDICTION_ET_SIEGE = String.raw`(?:tribunal(?: judiciaire| de grande instance| d instance| de commerce| de proximite)?|tj|tgi) (?:de|d) (?!grande\b|instance\b|commerce\b|proximite\b)\w+`
/**
 * Ordonnance désignée par sa juridiction et son siège, datée ou non, derrière le magistrat qui la rend ou non :
 * « Ordonnance du tribunal judiciaire de Tours, RG … », « (ordonnance du TJ de Tours, RG …) », « Ordonnance de
 * désignation du tribunal judiciaire de Tours (RG …) », « Ordonnance du premier vice-président du TJ de Tours ».
 */
const ORDONNANCE_DE_JURIDICTION = new RegExp(String.raw`\bordonnance${OBJET} (?:${MAGISTRAT}|du) ${JURIDICTION_ET_SIEGE}`)

/** 🔵 Motifs VitFix, limités à des types relevés ; appliqués au texte normalisé (minuscules, sans accents ni ponctuation). */
const TYPES_GED: readonly TypeGed[] = [
  {
    ref: 'ordonnance',
    titre: /\bordonnance\b/,
    indices: [/\btribunal\b/, /\badministrat\w* provisoire\b|\bsyndic judiciaire\b/, /\brg\b/, /\bjuge\b/],
    citation: new RegExp(`${ORDONNANCE_REFERENCEE.source}|${ORDONNANCE_DATEE.source}|${ORDONNANCE_DE_JURIDICTION.source}`, 'g'),
  },
  {
    ref: { categorie: 'Étude notariale', type: 'Règlement de copropriété (règlement, modificatifs)' },
    titre: /\breglement de copropriete\b|\betat descriptif de division\b/,
    indices: [/\betat descriptif de division\b/, /\btantiemes\b|\bmilliemes\b|\b\d{3,5} ?emes\b/, /\bparties communes\b/],
  },
  {
    ref: { categorie: 'Base', type: 'Cadastre — relevé de propriété' },
    titre: /\bcadastr\w*|\breleve de propriete\b|\bmatrice\b/,
    indices: [/\bsection [a-z]{1,2} n\b/, /\bcontenance\b/, /\breleve de propriete\b/],
  },
  {
    ref: { categorie: 'Étude notariale', type: 'Demande pré-état daté / état daté' },
    titre: new RegExp(`${DEMANDE_ETAT_DATE}|${REQUETE_ETAT_DATE}`),
    indices: [/\bnotaire\b|\bmaitre\b|\betude\b/, ARTICLE_5, DECRET_1967, /\bvente\b|\bcession\b|\bmutation\b|\bcedant\b/],
  },
  {
    ref: { categorie: 'Copropriétaire', type: 'État daté' },
    titre: /\betat date\b/,
    horsTitre: new RegExp(String.raw`${DEMANDE_ETAT_DATE}|${REQUETE_ETAT_DATE}|\bpre etat date\b`, 'g'),
    indices: [ARTICLE_5, DECRET_1967, /\bcedant\b/, /\b(?:premiere|deuxieme|troisieme) partie\b/],
  },
  {
    ref: { categorie: 'Étude notariale', type: 'Avis de mutation art. 20' },
    titre: /\bavis de (?:la )?mutation\b/,
    indices: [/\barticle 20\b|\bart 20\b/, /\bnotaire\b|\bmaitre\b/, /\bvente\b|\bcession\b/, /\bloi du 10 juillet 1965\b/],
  },
  { ref: { categorie: 'Mairie', type: 'Arrêté de péril' }, titre: /\bperil\b|\bmise en securite\b/, indices: [/\barrete\b/, MAIRIE] },
  { ref: { categorie: 'Mairie', type: 'Injonction de travaux' }, titre: /\binjonction\b(?! de payer)/, indices: [/\btravaux\b/, MAIRIE, /\bravalement\b|\bfacade\b/] },
  {
    ref: { categorie: 'Copropriétaire', type: 'Mise en demeure' },
    titre: /\bmise en demeure\b/,
    indices: [/\bimpaye/, /\ba defaut de (?:reglement|paiement)\b/, /\bsommes dues\b/],
  },
  { ref: { categorie: 'Base', type: "Procès-verbal d'assemblée" }, titre: /\bproces verbal\b/, indices: [ASSEMBLEE_GENERALE, /\bresolution\b/, VOTE, PRESENCE] },
  {
    ref: { categorie: 'Base', type: "Convocation d'assemblée" },
    titre: /\bconvocation\b/,
    indices: [ASSEMBLEE_GENERALE, /\bordre du jour\b/, /\bconvoque\w*|\bconvie\w*|\bse tiendra\b|\baura lieu\b/],
  },
  { ref: { categorie: 'Base', type: 'Facture/avoir honoraires' }, titre: /\bfacture\b/, indices: [/\bhonoraires\b/] },
  { ref: { categorie: 'Fournisseur', type: 'Facture/avoir fournisseur' }, titre: /\bfacture\b/, indices: [HT, TVA, /\bnet a payer\b|\bttc\b/] },
  { ref: { categorie: 'Base', type: 'Devis pré-état daté' }, titre: /\bdevis\b/, indices: [new RegExp(String.raw`\b${ETAT_DATE}`)] },
  { ref: { categorie: 'Fournisseur', type: 'Devis fournisseur' }, titre: /\bdevis\b/, indices: [HT, TVA, /\bbon pour accord\b|\bvalidite\b|\bvalable\b/] },
]

const AUTRES: ReferenceTypeDocument = { categorie: 'Base', type: 'Ordonnance (autres)' }
const auTribunal = (type: string): ReferenceTypeDocument => ({ categorie: 'Tribunal', type })

/** 🔵 Mots qui évoquent chaque sous-type d'ordonnance (texte normalisé) : ils l'ordonnent, sans le rendre sûr. */
const SOUS_TYPES_ORDONNANCE: readonly { ref: ReferenceTypeDocument; evoque: RegExp }[] = [
  { ref: auTribunal('Ordonnance de désignation'), evoque: /\b(?:design|nomm|nomination|commet)\w*/ },
  {
    ref: auTribunal('Ordonnance de prolongation de mission'),
    evoque: /\b(?:prorog|prolong)(?!eable)\w*|\brenouvel(?!able)\w*|\bmaint(?:ien|enons|ient|enue?)\b|\bpoursuite de (?:la |sa )?mission\b|\bnouveau delai\b/,
  },
  {
    ref: auTribunal('Ordonnance de fin de mission'),
    evoque: /\bfin de (?:la |sa )?mission\b|\b(?:met|mettons|mettant|mis|prend|prendra) fin\b|\bdecharg\w*|\bachevement\b|\b(?:cloture|levee) de (?:la |sa )?mission\b/,
  },
  { ref: auTribunal('Ordonnance de taxe'), evoque: /\btax(?:e|ee|ons|ation)?\b|\bhonoraires\b|\bremuneration\b|\bemoluments\b/ },
  { ref: auTribunal("Ordonnance d'expropriation"), evoque: /\bexpropri\w*/ },
]

/** Candidats d'un même mot-titre, à sa position dans la pièce. */
interface Groupe {
  position: number
  candidats: TypeCandidat[]
}

const enOrdre = (groupes: readonly Groupe[]): TypeCandidat[] =>
  [...groupes].sort((a, b) => a.position - b.position).flatMap(({ candidats }) => candidats)

const effacer = (texte: string, motif: RegExp): string => texte.replaceAll(motif, (occurrence) => ' '.repeat(occurrence.length))

/**
 * Tous les sous-types d'une ordonnance : ceux que ses mots évoquent, dans l'ordre de leur premier mot, puis « Ordonnance
 * (autres) », puis les autres sous-types (le texte ne tranche pas : le gestionnaire choisit).
 */
function sousTypesCandidats(normalise: string, indices: readonly string[]): TypeCandidat[] {
  const lus = SOUS_TYPES_ORDONNANCE.map(({ ref, evoque }) => ({ ref, mot: evoque.exec(normalise) }))
  const evoques = lus.flatMap(({ ref, mot }) => (mot ? [{ position: mot.index, candidats: [{ ref: { ...ref }, indices: [...indices, mot[0]] }] }] : []))
  const autres = lus.filter(({ mot }) => !mot).map(({ ref }) => ({ ref: { ...ref }, indices: [...indices] }))
  return [...enOrdre(evoques), { ref: { ...AUTRES }, indices: [...indices] }, ...autres]
}

/**
 * Candidats du type (contrat de l'en-tête : mot-titre et au moins un indice trouvé hors de lui), placés au mot-titre ;
 * hors de ses citations quand le type en a (seulement cité : après tous les candidats placés).
 */
function groupeTypeGed(type: TypeGed, normalise: string): Groupe[] {
  const recherche = type.horsTitre ? effacer(normalise, type.horsTitre) : normalise
  const titre = type.titre.exec(recherche)
  if (!titre) return []
  const ailleurs = normalise.slice(0, titre.index) + ' '.repeat(titre[0].length) + normalise.slice(titre.index + titre[0].length)
  const trouves = type.indices.flatMap((motif) => motif.exec(ailleurs)?.[0] ?? [])
  if (trouves.length === 0) return []
  const indices = [titre[0], ...trouves]
  const candidats = type.ref === 'ordonnance' ? sousTypesCandidats(normalise, indices) : [{ ref: { ...type.ref }, indices }]
  const place = type.citation ? type.titre.exec(effacer(recherche, type.citation))?.index : titre.index
  return [{ position: place ?? recherche.length, candidats }]
}

/** Suggestion d'après le texte (contrat de l'en-tête, point 1) : types candidats ordonnés, jamais un type sûr. */
export function suggererClassement(texteImporte: string): SuggestionClassement {
  const normalise = normaliserTexteLibre(texteImporte)
  const candidats = enOrdre(TYPES_GED.flatMap((type) => groupeTypeGed(type, normalise)))
  return { source: 'texte', statut: candidats.length > 0 ? 'suggestion' : 'non_classe', candidats }
}

// ── Sources explicites ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * Confirmation par le gestionnaire (point 2), à partir de la suggestion en mémoire ou des candidats d'un document déjà
 * rangé (candidatsDuDocument) : un type du référentiel ; hors des candidats, ou type libre, accepté et signalé.
 */
export function confirmerClassement(candidats: SuggestionClassement | readonly ReferenceTypeDocument[], choix: LibellesType): ClassementConfirme {
  const { controle, ...ref } = creerReferenceTypeDocument(choix.categorie, choix.type)
  const refs = 'candidats' in candidats ? candidats.candidats.map((candidat) => candidat.ref) : candidats
  return { source: 'gestionnaire', ref, controle, horsCandidats: !refs.some((candidat) => correspondAuModele(ref, candidat)) }
}

/** Catégorie et type d'origine fournis à l'import (Gestéam, point 2), lus dans le référentiel ; refusés hors du relevé. */
export function classementDeLImport(origine: LibellesType): ClassementConfirme {
  const { controle, ...ref } = creerReferenceTypeDocument(origine.categorie, origine.type)
  if (controle !== 'referentiel') {
    const motif = controle === 'categorie_non_relevee' ? 'catégorie non relevée' : 'type absent du relevé'
    throw new Error(`Libellé importé hors du relevé Gestéam : « ${ref.categorie} › ${ref.type} » (${motif}) ; à confirmer par le gestionnaire.`)
  }
  return { source: 'import', ref, controle, horsCandidats: false }
}

/**
 * Code à ranger dans DocumentLocal.type (point 3) : code GED pour un type confirmé ; code « à confirmer » (ses
 * candidats) pour une suggestion, qui ne couvre ainsi aucune pièce et la rend « à vérifier » ; null pour une pièce non
 * classée.
 */
export function codeGedDuClassement(classement: ClassementPiece, entiteType: string): string | null {
  if (classement.source !== 'texte') return codeTypeDocument(classement.ref, entiteType)
  if (classement.candidats.length === 0) return null
  return codeTypesAConfirmer(classement.candidats.map(({ ref }) => ref), entiteType)
}
