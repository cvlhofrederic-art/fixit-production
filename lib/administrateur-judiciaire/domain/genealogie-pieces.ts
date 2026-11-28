import { dateIsoVersFr, dateVersIso, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { ficheLieeDepuisDemande, type Demande } from '@/lib/administrateur-judiciaire/domain/demandes'
import { etapesEnFichesLiees, type EtapeDossier, type FicheEtape } from '@/lib/administrateur-judiciaire/domain/etapes-dossier'
import {
  memeRattachement,
  rattachementsDuCourrier,
  rattachementsDuDocument,
  TAILLE_MAX_FICHES_LIEES,
  type FicheLiee,
  type Rattachement,
} from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import type { ElementAFacturer } from '@/lib/administrateur-judiciaire/domain/honoraires-facturation'
import { elementCommeFicheLiee, type FicheElementHonoraires } from '@/lib/administrateur-judiciaire/domain/honoraires-sinistre'

/**
 * Flux : généalogie des pièces d'un dossier (point 52 du bilan 2). Fonctions pures, dates AAAA-MM-JJ, sans écran ni
 * table : l'arbre « Historique des flux » (Accès → Flux) est l'écran de Frédéric, et les champs à ajouter aux tables
 * (origine et suite d'un document, rattachement d'un courrier ou d'un document à un dossier) relèvent de son accord.
 * Le rattachement est celui du point 47 (fiches-liees.ts, lu sans modification).
 *
 * Gestéam (cartographie, tranches lues) :
 * 🟢 Tranche 42 § Accès → Flux (fiche sinistre) : écran « Historique des flux », un ARBRE des pièces rattachées à la
 *   fiche, chaque nœud « Nature - date - tiers - objet - statut » : Sinistre (En cours) → Courrier (déclaration, Archivé)
 *   → Document (copie du courrier, À traiter) ; sous le sinistre aussi : Document (constat, À traiter) et « Honoraires
 *   lignes » (À facturer). Boutons -option-, Nom ?, Contracter / Déployer, Haut, Bas, Annuler, Afficher.
 * 🟢 Tranche 42 § Barre d'outils, Documents : fiche document avec Origine (Courrier / Demande + date), Pièce d'origine,
 *   Suite (Courrier / Demande + date), Corbeille, Suivi, Relance, Traité le, Responsable, Suivi par.
 * 🟢 Tranche 43 § 1 (fiche contentieux) : Contentieux → Étape automatique « Copie au CS pour info » (date 00/00/00,
 *   jamais réalisée), Courrier « Mise en demeure » (Archivé) → Document (copie, retour postérieur, statut « Terminé »), et
 *   deux natures d'« Honoraires lignes » (frais d'envoi générés par le courrier, forfait « mise en demeure ») placées
 *   sous le CONTENTIEUX, pas sous le courrier qui les a générées.
 * 🟢 Tranche 41 : le Flux est une consultation contextuelle de la fiche courante (Ctrl+U) ; le résumé d'un gros mandat,
 *   calculé en entier, a fait tomber le poste Gestéam : l'arbre rendu est donc plafonné.
 * 🟢 Tranche 20 § 4 : statuts du courrier (Préparation · A Suivre · Terminé · Non terminé · Terminé/Archivé · Archivé).
 * 🟢 Tranche 38 § Réglage du suivi : bloc Documents « À voir · Relance · À traiter · Jusque ».
 * 🟢 Tranche 39 : les onglets Demandes, Courriers, Documents des fiches sont des listes de fiches liées (point 47).
 * 🟢 Règle 5 (04_LOT3_NOTIFICATION_DELAIS, 06_PIEGES) : Courrier ≠ Document, deux entités autonomes ; un document a un
 *   courrier en Origine et un autre en Suite ; deux champs « Statut » ne se fusionnent jamais. Chaque nœud garde donc
 *   le statut de sa propre fiche.
 * 🔵 Déduits :
 * - la filiation d'une pièce vient de la fiche document : son Origine est son PARENT (la copie du courrier est enfant du
 *   courrier, T42), sa Suite est son ENFANT ; le reste (étapes, honoraires, constat) se range sous le dossier par son
 *   rattachement, puisque les honoraires générés par un courrier restent sous le contentieux (T43) ;
 * - une pièce rattachée au dossier dont le parent ne l'est pas (courrier d'un autre dossier) se range sous le dossier,
 *   avec un avertissement « hors dossier » ; une pièce non rattachée entre dans l'arbre par son parent ;
 * - le Flux est un arbre : un seul parent par pièce. Un document n'a de parent que par son Origine (une seule : une
 *   Suite est un courrier ou une demande, jamais un document) ; seuls un courrier ou une demande en Suite de plusieurs
 *   documents ont plusieurs parents. Le parent le plus proche du dossier l'emporte (rattaché au dossier, puis enfant
 *   d'une pièce rattachée, etc.), puis le plus ancien (date, puis nature et identifiant) ; les autres sont signalés.
 *   Une pièce que les liens relient au dossier entre donc dans son Flux quelles que soient les autres pièces passées
 *   (une même réponse à deux sinistres figure dans les deux Flux) ; seule la coupe d'un cycle peut l'en écarter, avec
 *   un avertissement ;
 * - un cycle (A né de B, B né de A, ou une pièce née d'elle-même) est coupé au lien de la pièce la plus ancienne, qui
 *   ne peut descendre d'une pièce plus récente ; il est signalé et se lit du parent vers l'enfant, depuis cette pièce ;
 * - un lien reçu deux fois (même parent, même enfant, même source) n'est traité et signalé qu'une fois. Les copies
 *   d'une même pièce (l'appelant peut réunir les pièces de la copropriété, sans dossier, et celles du dossier) n'en font
 *   qu'une, avec les rattachements de toutes : elle entre dans l'arbre si l'une est rattachée au dossier, et la pièce
 *   rendue porte ce rattachement. Des copies identiques par ailleurs (champ par champ) sont réunies sans avertissement ;
 *   si elles diffèrent (date, statut, objet…), la première reçue est gardée et un seul doublon est signalé par pièce,
 *   avec les champs qui diffèrent ;
 * - orphelin : pièce dont le parent déclaré est introuvable (non passé, supprimé) ; elle reste sous le dossier si elle y
 *   est rattachée. Suite introuvable : signalée sur le document ; document introuvable qui a pour Origine une pièce de
 *   l'arbre : signalé sur cette pièce ;
 * - chronologie : un enfant daté avant son parent reste sous lui, avec un avertissement (la copie vue en T43 est
 *   postérieure à son courrier) ;
 * - les anomalies sont des avertissements, jamais bloquants ; seules sont rendues celles qui touchent une pièce de
 *   l'arbre (l'appelant peut passer toutes les pièces d'une copropriété) ;
 * - ordre des frères : par nature (Étape, Courrier, Document, Demande, Honoraires lignes : ordre vu en T42 et T43 ; place
 *   de la Demande non observée), puis date croissante, puis identifiant (stable d'un affichage à l'autre) ;
 * - date d'un courrier : sa date de dépôt, à défaut sa date de création ; d'un document : sa date de création ; d'une
 *   étape : sa création pour le tri, sa réalisation pour l'affichage (T43 : « 00/00/00 » pour l'étape jamais réalisée ;
 *   VitFix omet la date plutôt que d'afficher des zéros). Une Suite datée avant l'Origine, ou une même fiche à la fois
 *   Origine et Suite, est refusée à la saisie ;
 * - libellé d'un nœud : « Nature - date - tiers - objet - statut », parties vides omises ; le tiers est un nom passé par
 *   l'appelant (le domaine n'a que des identifiants) ; l'objet est celui du courrier ou de la demande, le nom du
 *   document, le titre de l'étape, le tarif de l'élément d'honoraires ;
 * - plafond : TAILLE_MAX_FICHES_LIEES pièces au plus (celui des fiches liées), coupées dans l'ordre d'affichage ; le
 *   total compte toutes les pièces de l'arbre et `tronque` signale la coupe. Contracter / Déployer : l'écran passe les
 *   clés des pièces repliées (cleDePiece), dont les descendants ne sont pas rendus en lignes.
 *
 * 🔴 Non établi (aucune fiche document ouverte en saisie, aucune Suite observée) — questions :
 * 1. Hugo : « Pièce d'origine » désigne-t-elle la fiche (courrier, demande) dont « Origine » donne la nature et la
 *    date, ou un autre DOCUMENT (celui dont ce document est la copie) ? Elle est conservée ici, sans effet sur l'arbre.
 * 2. Hugo : la date d'Origine ou de Suite est-elle celle de la fiche liée, ou une date propre (réception, réponse) ? Et
 *    l'Origine peut-elle se saisir sans fiche liée (nature et date seules) ? Les deux cas sont acceptés ici.
 * 3. Hugo : la Suite d'un document apparaît-elle dans le Flux comme enfant du document ? Seule la filiation
 *    courrier → copie a été vue.
 * 4. Hugo : l'ordre des nœuds frères suit-il la nature puis la date (proposé), ou l'ordre de création ? Les boutons Haut
 *    et Bas réordonnent-ils l'arbre (ordre enregistré) ou déplacent-ils seulement la sélection ?
 * 5. Frédéric : le statut d'un document (« À traiter », « Terminé » vus dans le Flux) devient-il un champ de
 *    DocumentLocal, ou vient-il de la GED (point 64) ? En attendant, l'appelant le passe (null par défaut).
 * 6. Hugo : un document peut-il avoir plusieurs origines (pièce jointe à deux courriers) ou plusieurs suites ? La fiche
 *    ne montre qu'un champ de chaque, et un seul de chaque est porté ici. Un même courrier, une même demande peuvent-ils
 *    être la Suite de plusieurs documents ? Ils sont alors rangés sous un seul parent par Flux, les autres signalés.
 * 7. Hugo : quelle est la liste complète des statuts d'un document ? Seuls « À traiter » et « Terminé » (libellé
 *    tronqué) ont été vus, la liste n'a pas été ouverte ; le statut reste ici une chaîne libre.
 * 8. Hugo : les lignes d'honoraires générées par un courrier (T43) restent-elles toujours sous le dossier, jamais sous le
 *    courrier ? Aucun lien honoraires → courrier n'est tiré ici.
 *
 * Le droit (relevé sur Légifrance le 03/11/2026, versions en vigueur) :
 * - 🟢 L. 1965 art. 18, I : le syndic est chargé d'assurer la conservation des archives relatives au syndicat ;
 * - 🟢 D. 1967 art. 33 : le syndic détient les archives du syndicat, dont les conventions, pièces, correspondances,
 *   plans, registres, documents et décisions de justice relatifs à l'immeuble et au syndicat ; leur conservation et
 *   leur gestion sont comprises dans sa mission ordinaire. 🟢 Art. 33-1 (lu en recherche plein texte) : au changement
 *   de syndic, les pièces transmises sont accompagnées d'un bordereau récapitulatif, copie au conseil syndical ;
 * - 🟢 L. 1965 art. 29-1, I, al. 2 : le président du tribunal confie à l'administrateur provisoire « tous les pouvoirs du
 *   syndic », dont le mandat cesse de plein droit ; 🟢 D. 1967 art. 62-6 : l'ancien syndic est tenu envers
 *   l'administrateur provisoire des obligations de L. 1965 art. 18-2, dont la remise, dans le mois, de l'ensemble des
 *   documents et archives du syndicat ; 🟢 D. 1967 art. 47 (administrateur provisoire d'un syndicat dépourvu de syndic,
 *   autre cas) : il est chargé de se faire remettre l'ensemble des documents et archives du syndicat. 🔵 Aucun texte ne
 *   dit en toutes lettres que l'administrateur provisoire conserve les archives : c'est déduit des pouvoirs du syndic
 *   qu'il reçoit et des archives qui lui sont remises. Le module n'en dépend pas ;
 * - aucun texte (loi n° 65-557 et décret n° 67-223, recherche plein texte : origine, généalogie, traçabilité,
 *   historique) ne régit l'origine ou la suite d'une pièce, ni l'arbre du Flux : c'est une règle de GESTION. 🔵 Elle
 *   sert la gestion des archives que ces articles confient au syndic, et par lui à l'administrateur provisoire, sans
 *   en être une exigence.
 *
 * Branchement à faire avec Frédéric (schema.ts non modifié) : sur DocumentLocal, un champ facultatif non indexé
 * `origineSuite?: OrigineSuitePiece` (et le statut, question 5) ; sur Courrier et DocumentLocal, les rattachements aux
 * dossiers (point 47), passés ici en `dossiers` en attendant ; corriger alors le commentaire de Courrier (schema.ts),
 * qui annonce origine et suite sans champ. L'écran Accès → Flux appelle construireArbreFlux avec les pièces converties
 * (courrierEnPieceFlux, documentEnPieceFlux, etapesEnPiecesFlux, honorairesEnPieceFlux, demandeEnPieceFlux) et les
 * liens de liensDesDocuments, qui prend les DocumentLocal tels quels (un document sans `origineSuite` ne fait aucun
 * lien), puis affiche lignesDuFlux et libellePieceFlux.
 */

// ─── Origine et suite d'une pièce (fiche document) ───────────────────────────────────────

/** Nature d'une Origine ou d'une Suite (🟢 T42 : « Courrier / Demande + date »). */
export const NATURES_ORIGINE_SUITE = ['Courrier', 'Demande'] as const
export type NatureOrigineSuite = (typeof NATURES_ORIGINE_SUITE)[number]
const NATURES_ORIGINE_SUITE_CONNUES: ReadonlySet<string> = new Set(NATURES_ORIGINE_SUITE)

export interface LienPiece {
  nature: NatureOrigineSuite
  /** Fiche liée ; null : nature et date seules (question 2). */
  id: string | null
  /** AAAA-MM-JJ ; null : non connue. */
  date: string | null
}

/** Origine et suite d'une pièce : le type que Frédéric portera sur DocumentLocal. */
export interface OrigineSuitePiece {
  origine: LienPiece | null
  /** 🔴 Sens à confirmer (question 1) : conservée, sans effet sur l'arbre. */
  pieceOrigineId: string | null
  suite: LienPiece | null
}

export interface SaisieLienPiece {
  nature: NatureOrigineSuite
  id?: string | null
  date?: string | null
}

export interface SaisieOrigineSuite {
  origine?: SaisieLienPiece | null
  pieceOrigineId?: string | null
  suite?: SaisieLienPiece | null
}

const texteOuNull = (valeur: string | null | undefined): string | null => {
  const texte = (valeur ?? '').trim()
  return texte === '' ? null : texte
}

function creerLienPiece(libelle: string, saisie: SaisieLienPiece | null | undefined): LienPiece | null {
  if (!saisie) return null
  if (!NATURES_ORIGINE_SUITE_CONNUES.has(saisie.nature))
    throw new Error(`${libelle} : nature « ${saisie.nature} » inconnue (Courrier ou Demande attendu).`)
  const date = saisie.date ?? null
  if (date !== null && !estDateIsoValide(date)) throw new Error(`${libelle} : date invalide (${date}) : AAAA-MM-JJ attendu.`)
  return { nature: saisie.nature, id: texteOuNull(saisie.id), date }
}

/** Origine et suite contrôlées : natures, dates, une même fiche ne peut être à la fois l'Origine et la Suite. */
export function creerOrigineSuite(saisie: SaisieOrigineSuite): OrigineSuitePiece {
  const origine = creerLienPiece('Origine', saisie.origine)
  const suite = creerLienPiece('Suite', saisie.suite)
  if (origine?.id && suite?.id && origine.nature === suite.nature && origine.id === suite.id)
    throw new Error(`${origine.nature} ${origine.id} : une même fiche ne peut être à la fois l'origine et la suite.`)
  if (origine?.date && suite?.date && suite.date < origine.date)
    throw new Error(`Suite datée du ${suite.date}, avant l'origine du ${origine.date}.`)
  return { origine, pieceOrigineId: texteOuNull(saisie.pieceOrigineId), suite }
}

// ─── Pièces et liens du Flux ───────────────────────────────────────────────────────────────

/** Natures des nœuds sous le dossier, dans l'ordre d'affichage des frères (🔵, voir l'en-tête). */
export const NATURES_PIECE_FLUX = ['Étape', 'Courrier', 'Document', 'Demande', 'Honoraires lignes'] as const
export type NaturePieceFlux = (typeof NATURES_PIECE_FLUX)[number]
const RANG_NATURE: ReadonlyMap<string, number> = new Map(NATURES_PIECE_FLUX.map((n, rang) => [n, rang]))

export interface ReferencePiece {
  nature: NaturePieceFlux
  id: string
}

/** Clé d'une pièce, « nature:identifiant » : un identifiant n'est unique que dans sa table. Sert aux pièces repliées. */
export const cleDePiece = (r: ReferencePiece): string => `${r.nature}:${r.id}`

/** Pièce du Flux : une fiche liée (point 47 : date, statut, rattachements), sa nature et ce qu'en affiche le libellé. */
export type PieceFlux = FicheLiee & {
  nature: NaturePieceFlux
  /** Objet, nom, titre ou tarif affiché ; absent ou null : omis du libellé. */
  objet?: string | null
  /** Nom du tiers affiché, passé par l'appelant ; absent ou null : omis. */
  tiers?: string | null
  /** Date affichée quand ce n'est pas `date` (étape : sa réalisation, null tant qu'elle n'est pas faite) ; absente : `date`. */
  dateAffichee?: string | null
}

/** Une fiche liée déjà convertie comme pièce du Flux ; ses champs sont conservés. */
export function enPieceFlux<F extends FicheLiee>(nature: NaturePieceFlux, fiche: F): F & { nature: NaturePieceFlux } {
  return { ...fiche, nature }
}

function dateDeCreation(libelle: string, valeur: unknown): string {
  const date = dateVersIso(valeur)
  if (date === null) throw new Error(`${libelle} : date de création invalide.`)
  return date
}

export interface OptionsPieceFlux {
  /** Dossiers de la pièce (point 47), passés en attendant le champ de table. */
  dossiers?: readonly Rattachement[]
  /** Nom du tiers affiché (destinataire, émetteur, entreprise). */
  tiers?: string | null
}

/** Champs d'un courrier lus pour le Flux (structure de Courrier, schema.ts). */
export interface CourrierPourFlux {
  id: string
  statut: string
  objet: string
  dateDepot: string | null
  /** Horodatage ISO posé par le repository. */
  createdAt: string
  coproprieteId: string | null
  mandatId: string | null
  personneId: string | null
  entrepriseId: string | null
}

/** Courrier en pièce du Flux : date de dépôt, à défaut de création ; dossiers passés puis rattachements de ses champs. */
export function courrierEnPieceFlux(courrier: CourrierPourFlux, options: OptionsPieceFlux = {}): PieceFlux {
  const date = estDateIsoValide(courrier.dateDepot) ? courrier.dateDepot : dateDeCreation(`Courrier ${courrier.id}`, new Date(courrier.createdAt))
  return {
    id: courrier.id,
    nature: 'Courrier',
    date,
    statut: courrier.statut,
    objet: courrier.objet,
    tiers: texteOuNull(options.tiers),
    rattachements: [...(options.dossiers ?? []), ...rattachementsDuCourrier(courrier)],
  }
}

/** Champs d'un document lus pour le Flux (structure de DocumentLocal, schema.ts). */
export interface DocumentPourFlux {
  id: string
  entiteType: string
  entiteId: string
  nom: string
  dateCreation: Date
}

export interface OptionsDocumentFlux extends OptionsPieceFlux {
  /** Question 5 : pas de statut sur DocumentLocal aujourd'hui. */
  statut?: string | null
}

export function documentEnPieceFlux(document: DocumentPourFlux, options: OptionsDocumentFlux = {}): PieceFlux {
  return {
    id: document.id,
    nature: 'Document',
    date: dateDeCreation(`Document ${document.id}`, document.dateCreation),
    statut: options.statut ?? null,
    objet: document.nom,
    tiers: texteOuNull(options.tiers),
    rattachements: [...(options.dossiers ?? []), ...rattachementsDuDocument(document)],
  }
}

/** Étapes en pièces du Flux (etapesEnFichesLiees : statut au jour donné) ; date affichée : la réalisation (T43). */
export function etapesEnPiecesFlux(etapes: readonly EtapeDossier[], aujourdhui: string): (FicheEtape & PieceFlux)[] {
  return etapesEnFichesLiees(etapes, aujourdhui).map((fiche, rang) => ({
    ...fiche,
    nature: 'Étape',
    objet: fiche.titre,
    tiers: null,
    dateAffichee: etapes[rang].faitLe,
  }))
}

/** Élément d'honoraires en pièce du Flux (elementCommeFicheLiee : sa fiche de dossier d'abord) ; objet : le tarif. */
export function honorairesEnPieceFlux(element: ElementAFacturer): FicheElementHonoraires & PieceFlux {
  return { ...elementCommeFicheLiee(element), nature: 'Honoraires lignes', objet: element.tarif, tiers: null }
}

/** Demande en pièce du Flux (ficheLieeDepuisDemande : copropriété, entreprise, mandat, dossier). */
export function demandeEnPieceFlux(demande: Demande, options: Pick<OptionsPieceFlux, 'tiers'> = {}): PieceFlux {
  return { ...ficheLieeDepuisDemande(demande), nature: 'Demande', objet: demande.objet, tiers: texteOuNull(options.tiers) }
}

/** Libellé d'un nœud, « Nature - date - tiers - objet - statut » (🟢 T42) : date en JJ/MM/AAAA, parties vides omises. */
export function libellePieceFlux(piece: PieceFlux): string {
  const date = piece.dateAffichee === undefined ? piece.date : piece.dateAffichee
  return [piece.nature, date === null ? null : dateIsoVersFr(date), piece.tiers, piece.objet, piece.statut]
    .map(texteOuNull)
    .filter((partie): partie is string => partie !== null)
    .join(' - ')
}

export type SourceFiliation = 'origine' | 'suite'

/** Lien parent → enfant déclaré sur une fiche document. */
export interface LienFiliation {
  parent: ReferencePiece
  enfant: ReferencePiece
  source: SourceFiliation
}

/** Fiche document lue pour les liens : DocumentLocal tel quel, `origineSuite` absent ou null tant qu'elle n'est pas saisie. */
export interface DocumentAvecOrigineSuite {
  id: string
  origineSuite?: OrigineSuitePiece | null
}

/**
 * Liens tirés de l'Origine (parent du document) et de la Suite (enfant du document) ; un document sans origine ni suite,
 * ou un lien sans fiche, est ignoré.
 */
export function liensDesDocuments(documents: readonly DocumentAvecOrigineSuite[]): LienFiliation[] {
  const liens: LienFiliation[] = []
  for (const { id, origineSuite } of documents) {
    const document: ReferencePiece = { nature: 'Document', id }
    const origine = origineSuite?.origine
    const suite = origineSuite?.suite
    if (origine?.id) liens.push({ parent: { nature: origine.nature, id: origine.id }, enfant: document, source: 'origine' })
    if (suite?.id) liens.push({ parent: document, enfant: { nature: suite.nature, id: suite.id }, source: 'suite' })
  }
  return liens
}

// ─── Arbre ───────────────────────────────────────────────────────────────────────────────────

export const NATURES_ANOMALIE_FLUX = [
  'doublon',
  'orphelin',
  'enfant_introuvable',
  'plusieurs_parents',
  'cycle',
  'hors_dossier',
  'chronologie',
] as const
export type NatureAnomalieFlux = (typeof NATURES_ANOMALIE_FLUX)[number]

/**
 * Avertissement, jamais bloquant. `piece` est la pièce concernée ; `autre` : le parent introuvable (orphelin), l'enfant
 * introuvable (la Suite d'un document, ou le document qui a la pièce pour Origine), le parent écarté (plusieurs
 * parents), le parent dont le lien est coupé (cycle), le parent hors dossier, le parent plus récent que la pièce
 * (chronologie).
 */
export interface AnomalieFlux {
  nature: NatureAnomalieFlux
  piece: ReferencePiece
  autre: ReferencePiece | null
  message: string
}

export interface NoeudFlux<P extends PieceFlux> {
  piece: P
  /** 1 sous le dossier. */
  profondeur: number
  enfants: NoeudFlux<P>[]
}

export interface ArbreFlux<P extends PieceFlux> {
  racine: Rattachement
  enfants: NoeudFlux<P>[]
  /** Pièces de l'arbre, y compris celles que le plafond n'a pas rendues. */
  total: number
  /** Vrai si le plafond a coupé l'arbre. */
  tronque: boolean
  anomalies: AnomalieFlux[]
}

export interface OptionsArbreFlux {
  /** Pièces rendues au plus, de 1 à TAILLE_MAX_FICHES_LIEES (par défaut ce maximum, 🟢 T41). */
  plafond?: number
}

const libelleDe = (r: ReferencePiece): string => `${r.nature} ${r.id}`
const refDe = (p: PieceFlux): ReferencePiece => ({ nature: p.nature, id: p.id })

function comparerPieces(a: PieceFlux, b: PieceFlux): number {
  return (RANG_NATURE.get(a.nature) ?? 0) - (RANG_NATURE.get(b.nature) ?? 0) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
}

/** Plus ancienne d'abord (date, puis nature et identifiant) : sert au choix d'un parent et à la coupe d'un cycle. */
function comparerAnciennete(a: PieceFlux, b: PieceFlux): number {
  return a.date.localeCompare(b.date) || cleDePiece(a).localeCompare(cleDePiece(b))
}

function verifierPlafond(plafond: number): void {
  if (!Number.isInteger(plafond) || plafond < 1 || plafond > TAILLE_MAX_FICHES_LIEES)
    throw new Error(`Plafond invalide (${plafond}) : entier de 1 à ${TAILLE_MAX_FICHES_LIEES} attendu.`)
}

function verifierDates(piece: PieceFlux): void {
  if (!estDateIsoValide(piece.date)) throw new Error(`${libelleDe(piece)} : date invalide (${piece.date}) : AAAA-MM-JJ attendu.`)
  const { dateAffichee } = piece
  if (dateAffichee !== undefined && dateAffichee !== null && !estDateIsoValide(dateAffichee))
    throw new Error(`${libelleDe(piece)} : date affichée invalide (${dateAffichee}) : AAAA-MM-JJ attendu.`)
}

/** Champs de deux objets, réunis dans l'ordre de leur apparition, avec la valeur de chacun ; un champ absent vaut undefined. */
function champsDesDeux(a: object, b: object): { champ: string; gauche: unknown; droite: unknown }[] {
  const champsA = new Map(Object.entries(a))
  const champsB = new Map(Object.entries(b))
  return [...new Set([...champsA.keys(), ...champsB.keys()])].map((champ) => ({ champ, gauche: champsA.get(champ), droite: champsB.get(champ) }))
}

/** Même valeur, en profondeur : objets et tableaux champ par champ, dates par leur instant. */
function memesValeurs(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b) || (Array.isArray(a) && Array.isArray(b) && a.length !== b.length)) return false
  return champsDesDeux(a, b).every(({ gauche, droite }) => memesValeurs(gauche, droite))
}

/** Champs, rattachements mis à part, où une copie d'une pièce diffère de la première reçue. */
function champsQuiDifferent(premiere: PieceFlux, copie: PieceFlux): string[] {
  return champsDesDeux(premiere, copie)
    .filter(({ champ, gauche, droite }) => champ !== 'rattachements' && !memesValeurs(gauche, droite))
    .map(({ champ }) => champ)
}

/** Copies reçues d'une même pièce : la première, les rattachements de toutes (sans répétition), les champs qui diffèrent. */
interface CopiesDUnePiece<P extends PieceFlux> {
  premiere: P
  rattachements: Rattachement[]
  differences: Set<string>
}

function ajouterRattachements(cible: Rattachement[], ajouts: readonly Rattachement[]): void {
  for (const ajout of ajouts) if (!cible.some((r) => memeRattachement(r, ajout))) cible.push(ajout)
}

/** Copies de chaque pièce par clé, dans l'ordre de leur première réception. */
function reunirCopies<P extends PieceFlux>(pieces: readonly P[]): Map<string, CopiesDUnePiece<P>> {
  const copies = new Map<string, CopiesDUnePiece<P>>()
  for (const piece of pieces) {
    verifierDates(piece)
    const cle = cleDePiece(piece)
    const reunies = copies.get(cle)
    if (reunies === undefined) {
      copies.set(cle, { premiere: piece, rattachements: [...piece.rattachements], differences: new Set() })
      continue
    }
    ajouterRattachements(reunies.rattachements, piece.rattachements)
    for (const champ of champsQuiDifferent(reunies.premiere, piece)) reunies.differences.add(champ)
  }
  return copies
}

interface IndexDesPieces<P extends PieceFlux> {
  index: Map<string, P>
  /** Clés des pièces rattachées au dossier, par l'une au moins de leurs copies. */
  rattachees: Set<string>
}

/**
 * Pièces par clé : les copies d'une pièce n'en font qu'une, la première reçue, avec les rattachements de toutes ; des
 * copies qui diffèrent par ailleurs sont signalées une fois, avec les champs qui diffèrent. Les pièces reçues ne sont
 * pas modifiées.
 */
function indexerPieces<P extends PieceFlux>(pieces: readonly P[], racine: Rattachement, anomalies: AnomalieFlux[]): IndexDesPieces<P> {
  const index = new Map<string, P>()
  const rattachees = new Set<string>()
  for (const [cle, { premiere, rattachements, differences }] of reunirCopies(pieces)) {
    index.set(cle, rattachements.length === premiere.rattachements.length ? premiere : { ...premiere, rattachements })
    if (rattachements.some((r) => memeRattachement(r, racine))) rattachees.add(cle)
    if (differences.size > 0)
      anomalies.push({
        nature: 'doublon',
        piece: refDe(premiere),
        autre: null,
        message: `${libelleDe(premiere)} : copies qui diffèrent (${[...differences].sort((a, b) => a.localeCompare(b)).join(', ')}) ; la première reçue est gardée, avec les rattachements de toutes.`,
      })
  }
  return { index, rattachees }
}

const cleDeLien = (l: LienFiliation): string => `${cleDePiece(l.parent)} > ${cleDePiece(l.enfant)} > ${l.source}`

/** Liens distincts (même parent, même enfant, même source : un seul), dans l'ordre de leurs clés, indépendant de l'ordre reçu. */
function liensDistincts(liens: readonly LienFiliation[]): LienFiliation[] {
  return [...new Map(liens.map((lien) => [cleDeLien(lien), lien]))].sort(([a], [b]) => a.localeCompare(b)).map(([, lien]) => lien)
}

/** Message d'un enfant introuvable, dans le sens de la filiation : la Suite du document, ou le document né de la pièce. */
function messageEnfantIntrouvable({ parent, enfant, source }: LienFiliation): string {
  if (source === 'origine') return `${libelleDe(parent)} : ${libelleDe(enfant)}, qui l'a pour origine, introuvable.`
  return `${libelleDe(parent)} : suite ${libelleDe(enfant)} introuvable.`
}

/** Anomalie d'un lien qui ne peut pas entrer dans l'arbre, ou null s'il est utilisable. */
function anomalieDuLien(lien: LienFiliation, index: ReadonlyMap<string, PieceFlux>): AnomalieFlux | null {
  const { parent, enfant } = lien
  if (cleDePiece(parent) === cleDePiece(enfant))
    return { nature: 'cycle', piece: enfant, autre: parent, message: `${libelleDe(enfant)} se déclare née d'elle-même : lien ignoré.` }
  if (!index.has(cleDePiece(enfant))) return { nature: 'enfant_introuvable', piece: parent, autre: enfant, message: messageEnfantIntrouvable(lien) }
  if (!index.has(cleDePiece(parent)))
    return { nature: 'orphelin', piece: enfant, autre: parent, message: `${libelleDe(enfant)} : parent ${libelleDe(parent)} introuvable.` }
  return null
}

/** Lien dont les deux pièces sont connues. */
interface LienUtilisable {
  lien: LienFiliation
  cleParent: string
  cleEnfant: string
  parent: PieceFlux
}

/** Liens utilisables ; les autres (introuvables, orphelins, pièce née d'elle-même) sont signalés une fois chacun. */
function liensUtilisables(liens: readonly LienFiliation[], index: ReadonlyMap<string, PieceFlux>, anomalies: AnomalieFlux[]): LienUtilisable[] {
  const utilisables: LienUtilisable[] = []
  for (const lien of liensDistincts(liens)) {
    const anomalie = anomalieDuLien(lien, index)
    const parent = index.get(cleDePiece(lien.parent))
    if (anomalie) anomalies.push(anomalie)
    else if (parent) utilisables.push({ lien, cleParent: cleDePiece(lien.parent), cleEnfant: cleDePiece(lien.enfant), parent })
  }
  return utilisables
}

/**
 * Distance au dossier de chaque pièce que les liens y relient : 0 pour une pièce rattachée, n + 1 pour l'enfant d'une
 * pièce à distance n (parcours en largeur ; une pièce que rien ne relie au dossier n'a pas de distance).
 */
function distancesAuDossier(rattachees: ReadonlySet<string>, liens: readonly LienUtilisable[]): Map<string, number> {
  const enfantsDe = new Map<string, string[]>()
  for (const { cleParent, cleEnfant } of liens) {
    const enfants = enfantsDe.get(cleParent)
    if (enfants) enfants.push(cleEnfant)
    else enfantsDe.set(cleParent, [cleEnfant])
  }
  const distances = new Map<string, number>([...rattachees].map((cle) => [cle, 0]))
  const file = [...rattachees]
  // la file s'allonge pendant le parcours : chaque pièce atteinte y entre une fois
  for (const cle of file) {
    const distance = (distances.get(cle) ?? 0) + 1
    for (const enfant of enfantsDe.get(cle) ?? []) {
      if (distances.has(enfant)) continue
      distances.set(enfant, distance)
      file.push(enfant)
    }
  }
  return distances
}

/**
 * Un parent au plus par enfant (clé enfant → clé parent) : le plus proche du dossier, puis le plus ancien ; à égalité,
 * les clés (ordre total, indépendant de l'ordre reçu). Les autres parents sont signalés.
 */
function choisirParents(
  liens: readonly LienFiliation[],
  index: ReadonlyMap<string, PieceFlux>,
  rattachees: ReadonlySet<string>,
  anomalies: AnomalieFlux[],
): Map<string, string> {
  const utilisables = liensUtilisables(liens, index, anomalies)
  const distances = distancesAuDossier(rattachees, utilisables)
  const distance = (l: LienUtilisable) => distances.get(l.cleParent) ?? Number.MAX_SAFE_INTEGER
  const parents = new Map<string, string>()
  const ordonnes = [...utilisables].sort((a, b) => distance(a) - distance(b) || comparerAnciennete(a.parent, b.parent) || a.cleEnfant.localeCompare(b.cleEnfant))
  for (const { lien, cleParent, cleEnfant } of ordonnes) {
    const retenu = parents.get(cleEnfant)
    if (retenu === undefined) parents.set(cleEnfant, cleParent)
    else if (retenu !== cleParent)
      anomalies.push({
        nature: 'plusieurs_parents',
        piece: lien.enfant,
        autre: lien.parent,
        message: `${libelleDe(lien.enfant)} : second parent ${libelleDe(lien.parent)} écarté.`,
      })
  }
  return parents
}

/**
 * Coupe un cycle (clés de l'enfant vers le parent) au lien de sa pièce la plus ancienne. Le message le lit dans le sens
 * de la filiation, du parent vers l'enfant, depuis la pièce coupée.
 */
function couperCycle(membres: readonly string[], index: ReadonlyMap<string, PieceFlux>, parents: Map<string, string>, anomalies: AnomalieFlux[]): void {
  const filiation = [...membres]
    .reverse()
    .map((cle) => index.get(cle))
    .filter((p): p is PieceFlux => p !== undefined)
  const [coupee] = [...filiation].sort(comparerAnciennete)
  const debut = filiation.indexOf(coupee)
  const lecture = [...filiation.slice(debut), ...filiation.slice(0, debut)]
  const parent = index.get(parents.get(cleDePiece(coupee)) ?? '')
  parents.delete(cleDePiece(coupee))
  anomalies.push({
    nature: 'cycle',
    piece: refDe(coupee),
    autre: parent ? refDe(parent) : null,
    message: `Cycle ${lecture.map(libelleDe).join(' → ')} : lien de ${libelleDe(coupee)}, la plus ancienne, coupé.`,
  })
}

/** Chaque enfant a un parent au plus : on remonte les chaînes, et tout retour sur la chaîne en cours est un cycle. */
function couperCycles(index: ReadonlyMap<string, PieceFlux>, parents: Map<string, string>, anomalies: AnomalieFlux[]): void {
  const vues = new Set<string>()
  for (const depart of [...parents.keys()].sort((a, b) => a.localeCompare(b))) {
    const chemin: string[] = []
    const enCours = new Set<string>()
    let cle: string | undefined = depart
    while (cle !== undefined && !vues.has(cle) && !enCours.has(cle)) {
      enCours.add(cle)
      chemin.push(cle)
      cle = parents.get(cle)
    }
    if (cle !== undefined && enCours.has(cle)) couperCycle(chemin.slice(chemin.indexOf(cle)), index, parents, anomalies)
    for (const c of chemin) vues.add(c)
  }
}

/** Une pièce est dans l'arbre si elle, ou l'un de ses ancêtres, est rattachée au dossier. */
function dansLArbre(cle: string, parents: ReadonlyMap<string, string>, rattachees: ReadonlySet<string>): boolean {
  let courant: string | undefined = cle
  while (courant !== undefined) {
    if (rattachees.has(courant)) return true
    courant = parents.get(courant)
  }
  return false
}

const RACINE = ''

/** Clé du nœud sous lequel ranger la pièce : son parent s'il est dans l'arbre, sinon le dossier (avec un avertissement). */
function placeDeLaPiece(piece: PieceFlux, parent: PieceFlux | undefined, membres: ReadonlySet<string>, anomalies: AnomalieFlux[]): string {
  if (parent === undefined) return RACINE
  if (!membres.has(cleDePiece(parent))) {
    anomalies.push({
      nature: 'hors_dossier',
      piece: refDe(piece),
      autre: refDe(parent),
      message: `${libelleDe(piece)} : parent ${libelleDe(parent)} hors du dossier ; rangée sous le dossier.`,
    })
    return RACINE
  }
  if (piece.date < parent.date)
    anomalies.push({
      nature: 'chronologie',
      piece: refDe(piece),
      autre: refDe(parent),
      message: `${libelleDe(piece)} : pièce du ${dateIsoVersFr(piece.date)}, antérieure à son parent ${libelleDe(parent)} du ${dateIsoVersFr(parent.date)}.`,
    })
  return cleDePiece(parent)
}

/** Enfants de chaque nœud (clé du parent, RACINE pour le dossier), dans l'ordre reçu. */
function rangerPieces<P extends PieceFlux>(
  index: ReadonlyMap<string, P>,
  parents: ReadonlyMap<string, string>,
  membres: ReadonlySet<string>,
  anomalies: AnomalieFlux[],
): Map<string, P[]> {
  const enfantsPar = new Map<string, P[]>()
  for (const [cle, piece] of index) {
    if (!membres.has(cle)) continue
    const place = placeDeLaPiece(piece, index.get(parents.get(cle) ?? RACINE), membres, anomalies)
    const freres = enfantsPar.get(place)
    if (freres) freres.push(piece)
    else enfantsPar.set(place, [piece])
  }
  return enfantsPar
}

function construireNoeuds<P extends PieceFlux>(cleParent: string, profondeur: number, enfantsPar: ReadonlyMap<string, P[]>): NoeudFlux<P>[] {
  return [...(enfantsPar.get(cleParent) ?? [])]
    .sort(comparerPieces)
    .map((piece) => ({ piece, profondeur, enfants: construireNoeuds(cleDePiece(piece), profondeur + 1, enfantsPar) }))
}

/** Garde les premiers nœuds dans l'ordre d'affichage (parcours en profondeur), dans la limite du budget. */
function tronquer<P extends PieceFlux>(noeuds: readonly NoeudFlux<P>[], budget: { reste: number }): NoeudFlux<P>[] {
  const gardes: NoeudFlux<P>[] = []
  for (const noeud of noeuds) {
    if (budget.reste === 0) break
    budget.reste -= 1
    gardes.push({ ...noeud, enfants: tronquer(noeud.enfants, budget) })
  }
  return gardes
}

/**
 * Arbre « Historique des flux » d'un dossier (sinistre, contentieux…) : les pièces rattachées au dossier et leurs
 * descendants, chacune sous son parent (Origine / Suite) le plus proche du dossier, avec son statut ; copies d'une même
 * pièce réunies ; copies qui diffèrent, orphelins, cycles, parents multiples et chronologie signalés, une fois chacun ;
 * plafonné (🟢 T41). Les listes reçues ne sont pas modifiées.
 */
export function construireArbreFlux<P extends PieceFlux>(
  racine: Rattachement,
  pieces: readonly P[],
  liens: readonly LienFiliation[] = [],
  options: OptionsArbreFlux = {},
): ArbreFlux<P> {
  const { plafond = TAILLE_MAX_FICHES_LIEES } = options
  verifierPlafond(plafond)
  const anomalies: AnomalieFlux[] = []
  const { index, rattachees } = indexerPieces(pieces, racine, anomalies)
  const parents = choisirParents(liens, index, rattachees, anomalies)
  couperCycles(index, parents, anomalies)
  const membres = new Set([...index.keys()].filter((cle) => dansLArbre(cle, parents, rattachees)))
  const enfants = construireNoeuds(RACINE, 1, rangerPieces(index, parents, membres, anomalies))
  const tronque = membres.size > plafond
  const touche = (r: ReferencePiece | null) => r !== null && membres.has(cleDePiece(r))
  return {
    racine,
    enfants: tronque ? tronquer(enfants, { reste: plafond }) : enfants,
    total: membres.size,
    tronque,
    anomalies: anomalies.filter((a) => touche(a.piece) || touche(a.autre)),
  }
}

export interface LigneFlux<P extends PieceFlux> {
  piece: P
  profondeur: number
  /** cleDePiece de la pièce : à passer dans les pièces repliées. */
  cle: string
  /** Vrai si la pièce a des enfants dans l'arbre rendu : elle se replie (Contracter) ou se déplie (Déployer). */
  aEnfants: boolean
}

/** Lignes de l'arbre dans l'ordre d'affichage (parcours en profondeur) ; une pièce repliée cache ses descendants. */
export function lignesDuFlux<P extends PieceFlux>(arbre: ArbreFlux<P>, replies: ReadonlySet<string> = new Set()): LigneFlux<P>[] {
  const lignes: LigneFlux<P>[] = []
  const parcourir = (noeuds: readonly NoeudFlux<P>[]) => {
    for (const { piece, profondeur, enfants } of noeuds) {
      const cle = cleDePiece(piece)
      lignes.push({ piece, profondeur, cle, aEnfants: enfants.length > 0 })
      if (!replies.has(cle)) parcourir(enfants)
    }
  }
  parcourir(arbre.enfants)
  return lignes
}
