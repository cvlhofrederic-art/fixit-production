import { ajouterMois } from '@/lib/administrateur-judiciaire/domain/dates'
import { verifierDateDocument, verifierDateGed, type DocumentGed } from '@/lib/administrateur-judiciaire/domain/pieces-obligatoires-ged'
import { TYPES_GENERIQUES_DOCUMENT, type CategorieDocument } from '@/lib/administrateur-judiciaire/domain/referentiel-types-document'
import {
  candidatsDuDocument,
  categorieCanonique,
  correspondAuModele,
  creerReferenceTypeDocument,
  memeLibelle,
  modelesDe,
  referenceDuDocument,
  referencesDuLibelle,
  rognerLibelle,
  type ModeleTypeDocument,
  type ReferenceTypeDocument,
} from '@/lib/administrateur-judiciaire/domain/typologie-documents'

/**
 * Durées de conservation des documents de la GED (point 64 du bilan 2). Fonctions pures, dates ISO. Aucune fonction de
 * purge : une échéance de conservation n'autorise aucune suppression.
 *
 * Le droit — 🟢 relu sur Légifrance (version en vigueur au 29/10/2026) :
 * - D. 2005-240 art. 6, al. 1 : les pièces justificatives, « documents de base de toute écriture comptable », sont des
 *   originaux datés, conservés par le syndic « pendant dix ans, sauf dispositions expresses contraires » ; al. 2 : au
 *   changement de syndic, documents comptables et originaux des pièces justificatives passent au successeur ;
 * - D. 1967 art. 33, dernier alinéa, et L. 1965 art. 18 I : conservation et gestion des archives comprises dans la
 *   mission ordinaire du syndic ;
 * - recherche plein texte de la loi de 1965 et du décret de 1967 (« conserv », « dix ans », « archives »,
 *   « registre ») : AUCUNE autre durée de conservation pour les archives du syndicat (RC/EDD, registre des PV, contrats,
 *   correspondances, décisions de justice) ;
 * - les fenêtres « trois dernières assemblées », « trois dernières années », « deux exercices », « en cours de
 *   validité » (D. 2019-502, CCH L. 721-2) disent ce qui est mis à disposition ou remis : ce ne sont pas des durées de
 *   conservation (🔵 déduit) ;
 * - D. 1967 art. 64-5 et 64-8 : le prestataire de lettre recommandée électronique conserve les preuves de dépôt et de
 *   transmission et l'historique « pendant une durée minimale d'un an » ; obligation du prestataire, pas du syndic
 *   (🔵 déduit : pour garder la preuve plus longtemps, le cabinet l'archive lui-même dans la GED).
 * 🔵 Déduit : types GED retenus comme pièces justificatives comptables (MODELES_PIECES_JUSTIFICATIVES) ; une règle du
 * cabinet plus courte que les dix ans du texte est signalée, pas refusée (« sauf dispositions expresses contraires » :
 * aucune disposition contraire trouvée, aucune inventée) ; une règle par type l'emporte sur une règle par catégorie ;
 * deux règles de même précision et d'effets différents ne sont jamais départagées en silence (statut
 * « regles_en_conflit ») et verifierReglesConservation refuse deux règles de même cible ; une règle visant un type sans
 * catégorie porte un type générique ou un type propre relevé (libellé canonique) : un type libre, accepté seulement
 * dans une catégorie non relevée, exige sa catégorie (une faute de frappe ne donne pas une règle muette) ; un document
 * dont le type n'est pas confirmé (code « à confirmer », suggestion d'après le texte, classement-pieces-ged.ts) est
 * « a_confirmer », distinct de « non_classe » (sans aucun type candidat) : aucune règle du cabinet ne lui est appliquée,
 * la durée du texte de chaque candidat est seulement rappelée.
 * 🔴 Non établi — AUCUNE durée par défaut : réglage du cabinet, comme D-BANQUE. Questions pour Frédéric ou Hugo :
 * - « Le délai de conservation de 10 ans des pièces justificatives court-il, pour le cabinet, à partir de la date de la
 *   pièce, de la clôture de l'exercice ou de l'approbation des comptes ? » ;
 * - « Le cabinet applique-t-il une durée interne pour les autres archives (RC/EDD, registre des PV, contrats,
 *   correspondances, pièces de la mission judiciaire), ou VitFix doit-il afficher "durée non fixée par le texte" ? » ;
 * - « Quels types GED sont des pièces justificatives comptables au sens du D. 2005-240 art. 6 ? ».
 */

export interface DureeConservationTexte {
  dureeMois: number
  fondement: string
  reserve: string
  /** 🔴 Non fixé par le texte. */
  pointDepart: null
}

export const CONSERVATION_PIECES_JUSTIFICATIVES: DureeConservationTexte = {
  dureeMois: 120,
  fondement: 'D. 2005-240 art. 6, al. 1',
  reserve: 'sauf dispositions expresses contraires',
  pointDepart: null,
}

/** 🔵 Types GED retenus comme pièces justificatives comptables. */
export const MODELES_PIECES_JUSTIFICATIVES: readonly ModeleTypeDocument[] = [
  ...modelesDe(null, ['Facture/avoir fournisseur', 'Avis de virement']),
  ...modelesDe('Base', ['Facture/avoir honoraires', 'Relevé bancaire', 'Chèque', 'Verso chèque encaissé']),
  ...modelesDe('Copropriétaire', ['Chèque encaissé']),
]

/** Durée fixée par un texte relu pour ce type ; null : aucune durée dans les textes relus. */
export function dureeConservationDuTexte(ref: ReferenceTypeDocument): DureeConservationTexte | null {
  return MODELES_PIECES_JUSTIFICATIVES.some((m) => correspondAuModele(ref, m)) ? CONSERVATION_PIECES_JUSTIFICATIVES : null
}

export type PointDepartConservation = 'date_document' | 'cloture_exercice' | 'fin_mandat'

/** Cible d'une règle : un type (catégorie null = toute catégorie), ou toute une catégorie (type null). */
export interface CibleConservation {
  categorie: CategorieDocument | null
  type: string | null
}

export interface RegleConservation {
  cible: CibleConservation
  dureeMois: number
  pointDepart: PointDepartConservation
  fondement: string | null
}

export interface SaisieRegleConservation {
  categorie?: string | null
  type?: string | null
  dureeMois: number
  pointDepart: PointDepartConservation
  fondement?: string | null
}

/** Libellé canonique d'un type visé sans catégorie : type générique ou type propre relevé ; erreur sinon. */
function typeCanoniqueSansCategorie(type: string): string {
  const canonique = TYPES_GENERIQUES_DOCUMENT.find((t) => memeLibelle(t, type)) ?? referencesDuLibelle(type)[0]?.type
  if (!canonique)
    throw new Error(`« ${type} » n'est ni un type générique ni un type propre relevé : préciser la catégorie de la règle de conservation.`)
  return canonique
}

function cibleDeLaSaisie(saisie: SaisieRegleConservation): CibleConservation {
  const categorieSaisie = rognerLibelle(saisie.categorie ?? '') || null
  const typeSaisi = rognerLibelle(saisie.type ?? '') || null
  if (!categorieSaisie && !typeSaisi) throw new Error('Une règle de conservation vise une catégorie ou un type de document.')
  if (categorieSaisie && typeSaisi) {
    const ref = creerReferenceTypeDocument(categorieSaisie, typeSaisi)
    return { categorie: ref.categorie, type: ref.type }
  }
  if (typeSaisi) return { categorie: null, type: typeCanoniqueSansCategorie(typeSaisi) }
  const categorie = categorieCanonique(categorieSaisie ?? '')
  if (!categorie) throw new Error(`Catégorie de document inconnue : « ${categorieSaisie} ».`)
  return { categorie, type: null }
}

/** Règle de conservation du cabinet, contrôlée (libellés canoniques, durée en mois entiers positifs). */
export function creerRegleConservation(saisie: SaisieRegleConservation): RegleConservation {
  const cible = cibleDeLaSaisie(saisie)
  if (!Number.isInteger(saisie.dureeMois) || saisie.dureeMois <= 0)
    throw new Error(`Durée de conservation invalide : ${saisie.dureeMois} (mois entiers, au moins 1).`)
  return { cible, dureeMois: saisie.dureeMois, pointDepart: saisie.pointDepart, fondement: saisie.fondement?.trim() || null }
}

function cibleCorrespond(cible: CibleConservation, ref: ReferenceTypeDocument): boolean {
  if (cible.categorie !== null && cible.categorie !== ref.categorie) return false
  return cible.type === null || memeLibelle(cible.type, ref.type)
}

/** Précision d'une cible : catégorie et type (3), type seul (2), catégorie seule (1). */
function precision(cible: CibleConservation): number {
  return (cible.type === null ? 0 : 2) + (cible.categorie === null ? 0 : 1)
}

/** Règles qui s'appliquent au type, de la plus grande précision trouvée (plusieurs si elles visent la même cible). */
function reglesLesPlusPrecises(ref: ReferenceTypeDocument, regles: readonly RegleConservation[]): RegleConservation[] {
  let retenues: RegleConservation[] = []
  for (const regle of regles) {
    if (!cibleCorrespond(regle.cible, ref)) continue
    const ecart = retenues.length === 0 ? 1 : precision(regle.cible) - precision(retenues[0].cible)
    if (ecart > 0) retenues = [regle]
    else if (ecart === 0) retenues.push(regle)
  }
  return retenues
}

const memeEffet = (a: RegleConservation, b: RegleConservation): boolean => a.dureeMois === b.dureeMois && a.pointDepart === b.pointDepart

const memeCible = (a: CibleConservation, b: CibleConservation): boolean =>
  a.categorie === b.categorie && (a.type === null || b.type === null ? a.type === b.type : memeLibelle(a.type, b.type))

const libelleCible = (cible: CibleConservation): string => [cible.categorie, cible.type].filter((v) => v !== null).join(' › ')

/** Jeu de règles du cabinet : une seule règle par cible ; erreur explicite sinon. */
export function verifierReglesConservation(regles: readonly RegleConservation[]): void {
  regles.forEach((regle, rang) => {
    if (regles.slice(0, rang).some((autre) => memeCible(autre.cible, regle.cible)))
      throw new Error(`Deux règles de conservation visent la même cible (« ${libelleCible(regle.cible)} ») : une seule règle par cible.`)
  })
}

/** Dates fournies par l'appelant (fiche mandat, exercice) ; null ou absente : point de départ inconnu. */
export interface ContexteConservation {
  clotureExercice?: string | null
  finMandat?: string | null
}

/** Type candidat d'un document à confirmer, avec la durée que le texte fixerait pour lui (null : aucune). */
export interface CandidatConservation {
  ref: ReferenceTypeDocument
  texte: DureeConservationTexte | null
}

export type EcheanceConservation =
  | { statut: 'non_classe' }
  | { statut: 'a_confirmer'; candidats: CandidatConservation[] }
  | { statut: 'non_reglee'; texte: DureeConservationTexte | null }
  | { statut: 'regles_en_conflit'; regles: RegleConservation[]; texte: DureeConservationTexte | null }
  | { statut: 'point_depart_absent'; regle: RegleConservation; texte: DureeConservationTexte | null }
  | { statut: 'reglee'; dateFin: string; regle: RegleConservation; texte: DureeConservationTexte | null; inferieureAuTexte: boolean }

const DEPART: Readonly<Record<PointDepartConservation, (document: DocumentGed, contexte: ContexteConservation) => string | null>> = {
  date_document: (document) => document.date,
  cloture_exercice: (_document, contexte) => contexte.clotureExercice ?? null,
  fin_mandat: (_document, contexte) => contexte.finMandat ?? null,
}

/** Document sans référence GED : « à confirmer » s'il a des types candidats, sinon non classé. */
function sansReference(document: DocumentGed): EcheanceConservation {
  const candidats = candidatsDuDocument(document)
  if (candidats.length === 0) return { statut: 'non_classe' }
  return { statut: 'a_confirmer', candidats: candidats.map((ref) => ({ ref, texte: dureeConservationDuTexte(ref) })) }
}

/** Fin de conservation d'un document selon les règles du cabinet ; la durée du texte est rappelée, jamais appliquée seule. */
export function echeanceConservation(
  document: DocumentGed,
  regles: readonly RegleConservation[],
  contexte: ContexteConservation = {},
): EcheanceConservation {
  verifierDateDocument(document)
  verifierDateGed(contexte.clotureExercice, "clôture de l'exercice")
  verifierDateGed(contexte.finMandat, 'fin du mandat')
  const ref = referenceDuDocument(document)
  if (!ref) return sansReference(document)
  const texte = dureeConservationDuTexte(ref)
  const retenues = reglesLesPlusPrecises(ref, regles)
  if (retenues.length === 0) return { statut: 'non_reglee', texte }
  const regle = retenues[0]
  if (retenues.some((autre) => !memeEffet(autre, regle))) return { statut: 'regles_en_conflit', regles: retenues, texte }
  const depart = DEPART[regle.pointDepart](document, contexte)
  if (!depart) return { statut: 'point_depart_absent', regle, texte }
  return {
    statut: 'reglee',
    dateFin: ajouterMois(depart, regle.dureeMois),
    regle,
    texte,
    inferieureAuTexte: texte !== null && regle.dureeMois < texte.dureeMois,
  }
}
