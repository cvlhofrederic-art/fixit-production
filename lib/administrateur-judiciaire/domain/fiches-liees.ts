import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { DOSSIER } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Rattachement générique d'une fiche et listes de « fiches liées » (point 47 du bilan 2). Fonctions pures, dates ISO,
 * sans écran ni table : les champs de rattachement des tables (courriers, documents, étapes, éléments à facturer) et
 * l'affichage sur les fiches 360 viendront avec l'accord de Frédéric.
 *
 * Gestéam — 🟢 tranche 39 § Patron commun des onglets secondaires : sur les fiches client, identité, entreprise, lot,
 * travaux et contrat, les onglets Demandes, Courriers, Documents et Contrats sont des listes filtrées des fiches liées :
 * filtre de statut, période Du / au, colonnes Date · Immeuble ou Émetteur · Objet ou Titre, bouton Ajouter qui crée la
 * fiche pré-rattachée. 🟢 Tranche 17 § 3 : le référentiel DOSSIER (15 types) est l'axe de classement transversal des
 * demandes, étapes, mémos, analytiques et mouvements ; tranche 42 : les documents se filtrent aussi par dossier.
 * 🟢 Tranche 41 : le résumé d'un gros mandat a fait planter Gestéam ; VitFix rend donc chaque liste par page.
 *
 * Un rattachement vise un dossier (type de DOSSIER : Sinistre, Contentieux, Mandat de syndic pour la fiche 360 du
 * mandat…) ou une fiche porteuse (copropriété, identité, entreprise). Une fiche peut avoir plusieurs rattachements.
 * 🔵 Ordre par défaut : la plus récente d'abord ; à date égale, par identifiant (ordre stable d'une page à l'autre).
 */

export const FICHES_PORTEUSES = ['Copropriété', 'Identité', 'Entreprise'] as const
export const TYPES_RATTACHEMENT = [...FICHES_PORTEUSES, ...DOSSIER] as const
export type TypeRattachement = (typeof TYPES_RATTACHEMENT)[number]

export interface Rattachement {
  type: TypeRattachement
  id: string
}

export function creerRattachement(type: TypeRattachement, id: string): Rattachement {
  if (!(TYPES_RATTACHEMENT as readonly string[]).includes(type)) throw new Error(`Type de rattachement inconnu : « ${type} ».`)
  const brut = id.trim()
  if (!brut) throw new Error(`Rattachement « ${type} » : identifiant attendu.`)
  return { type, id: brut }
}

/** Même type et même identifiant (partagé avec etapes-dossier.ts, point 48). */
export const memeRattachement = (a: Rattachement, b: Rattachement): boolean => a.type === b.type && a.id === b.id

/** Rattachements d'un courrier, tirés de ses champs actuels (copropriété, mandat, personne, entreprise). */
export function rattachementsDuCourrier(courrier: {
  coproprieteId: string | null
  mandatId: string | null
  personneId: string | null
  entrepriseId: string | null
}): Rattachement[] {
  const champs: [TypeRattachement, string | null][] = [
    ['Copropriété', courrier.coproprieteId],
    ['Mandat de syndic', courrier.mandatId],
    ['Identité', courrier.personneId],
    ['Entreprise', courrier.entrepriseId],
  ]
  return champs.filter((c): c is [TypeRattachement, string] => Boolean(c[1]?.trim())).map(([type, id]) => creerRattachement(type, id))
}

/**
 * Rattachement des pièces enregistrées (DocumentLocal.entiteType, valeurs écrites aujourd'hui) : l'ordonnance d'un
 * mandat (« mandat ») ; le journal des pièces de reprise d'une copropriété (« reprise », dépôts et retraits). Un autre
 * type n'est rattaché à rien.
 */
const RATTACHEMENT_PAR_ENTITE_DOCUMENT: ReadonlyMap<string, TypeRattachement> = new Map([
  ['mandat', 'Mandat de syndic'],
  ['reprise', 'Copropriété'],
])

export function rattachementsDuDocument(document: { entiteType: string; entiteId: string }): Rattachement[] {
  const type = RATTACHEMENT_PAR_ENTITE_DOCUMENT.get(document.entiteType)
  return type && document.entiteId.trim() ? [creerRattachement(type, document.entiteId)] : []
}

export interface FicheLiee {
  id: string
  /** Date de la fiche (AAAA-MM-JJ) : celle de la colonne Date. */
  date: string
  statut: string | null
  rattachements: Rattachement[]
}

/** Taille d'une page par défaut, et plafond : une liste de fiches liées n'est jamais chargée en entier à l'écran. */
export const TAILLE_PAGE_FICHES_LIEES = 50
export const TAILLE_MAX_FICHES_LIEES = 200

export interface OptionsFichesLiees {
  /** Statuts retenus (filtre de l'onglet) ; absent : tous. */
  statuts?: readonly string[]
  /** Période Du / au, bornes incluses. */
  du?: string
  au?: string
  /** 'recent' (par défaut) ou 'ancien' d'abord. */
  ordre?: 'recent' | 'ancien'
  /** Page demandée, à partir de 1. */
  page?: number
  taille?: number
}

export interface PageFichesLiees<F> {
  lignes: F[]
  total: number
  page: number
  pages: number
  taille: number
}

function verifierOptions({ du, au, page = 1, taille = TAILLE_PAGE_FICHES_LIEES }: OptionsFichesLiees): void {
  for (const borne of [du, au])
    if (borne !== undefined && !estDateIsoValide(borne)) throw new Error(`Date de période invalide (${borne}) : AAAA-MM-JJ attendu.`)
  if (du !== undefined && au !== undefined && au < du) throw new Error(`Période invalide : du ${du} au ${au}.`)
  if (!Number.isInteger(page) || page < 1) throw new Error(`Page invalide (${page}) : entier à partir de 1 attendu.`)
  if (!Number.isInteger(taille) || taille < 1 || taille > TAILLE_MAX_FICHES_LIEES)
    throw new Error(`Taille de page invalide (${taille}) : entier de 1 à ${TAILLE_MAX_FICHES_LIEES} attendu.`)
}

/** Fiches liées à la cible : filtrées (statut, période), triées, puis paginées. La liste reçue n'est pas modifiée. */
export function fichesLiees<F extends FicheLiee>(fiches: readonly F[], cible: Rattachement, options: OptionsFichesLiees = {}): PageFichesLiees<F> {
  verifierOptions(options)
  const { statuts, du, au, ordre = 'recent', page = 1, taille = TAILLE_PAGE_FICHES_LIEES } = options
  const sens = ordre === 'recent' ? -1 : 1
  const retenues = fiches
    .filter(
      (f) =>
        f.rattachements.some((r) => memeRattachement(r, cible)) &&
        (statuts === undefined || (f.statut !== null && statuts.includes(f.statut))) &&
        (du === undefined || f.date >= du) &&
        (au === undefined || f.date <= au),
    )
    .sort((a, b) => sens * a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  return {
    lignes: retenues.slice((page - 1) * taille, page * taille),
    total: retenues.length,
    page,
    pages: Math.max(1, Math.ceil(retenues.length / taille)),
    taille,
  }
}
