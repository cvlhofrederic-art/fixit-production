import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  finDuSuspens,
  type ArreteRapprochement,
  type ElementRapprochement,
  type TypePieceRapprochee,
} from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'

/**
 * Statut « Rapproché » propagé depuis les arrêtés de rapprochement bancaire (point 38 du bilan 2 ; utilitaire PARTAGÉ :
 * le point 16 l'appelle pour les encaissements, avec le type « encaissement »). Fonction pure, montants en CENTIMES
 * ENTIERS, dates ISO, sans écran ni table.
 *
 * Gestéam — tranche 36 § Règlements : le statut du règlement suit le rapprochement (« Rapproché ») ; tranche 43 § 2 :
 * liste des encaissements d'« un jour ouvré » (sa date n'est pas située par rapport aux arrêtés), tous au statut
 * « Rapproché » ; tranche 29 (Banque, lister les rapprochements) : un arrêté par compte 512 environ tous les dix jours,
 * un seul « En cours », les précédents « Clôturé » ; tranche 43 § 10 : statuts Demandé · À régler · Enregistré ·
 * Rapproché · Annulé.
 *
 * Le lien entre un élément d'arrêté et ses pièces est porté par l'élément (ElementRapprochement.pieces) : une ligne du
 * relevé pour un virement groupé porte tous ses règlements, une remise de chèques ses encaissements.
 *
 * 🟢 Lu sur le texte : aucun des textes lus (loi n° 65-557, décret n° 67-223, décret n° 2005-240, arrêté du 14 mars
 *    2005) ne fixe de statut de rapprochement ; pour l'administrateur judiciaire, la grille de contrôle de l'arrêté du
 *    16 août 1999 (annexe, II) vise la périodicité des rapprochements et le dernier état de rapprochement, visé par le
 *    professionnel. Le statut est donc une règle de GESTION.
 * 🔵 Déduit :
 * - un élément rapproché qui porte des pièces exige sa date d'opération et sa date de rapprochement (règle de suspensA,
 *   finDuSuspens) ; à une date donnée, seuls comptent les pointages faits ce jour-là au plus tard ;
 * - un même élément repris d'arrêté en arrêté (suspens reporté) ne donne qu'un rapprochement : le plus ancien ; entre
 *   la ligne du relevé et l'écriture du 512 qui portent la même pièce, le pointage le plus ancien est retenu (à égalité,
 *   la ligne du relevé) ;
 * - contrôles par élément : sens (un règlement sort, un encaissement entre), pièces connues, même compte bancaire que
 *   l'arrêté si la pièce le porte, somme des pièces égale au montant de l'élément (aucune compensation : arrêté du
 *   14 mars 2005, art. 9) ; deux éléments distincts d'un même côté ne pointent jamais la même pièce ;
 * - toute pièce impliquée dans une anomalie garde son état : rien ne change sans bruit ; une pièce pointée qui n'est ni
 *   « avant » ni « rapproché » (demandée, annulée…) est signalée et laissée telle quelle.
 * 🔴 Non établi : statut « Rapproché » au pointage ou à la clôture de l'arrêté — à confirmer par Hugo. Les sources ne
 *    tranchent pas : la tranche 36 dit seulement que le statut suit le rapprochement, et le jour observé en tranche
 *    43 § 2 peut précéder la dernière clôture. Retenu ici comme hypothèse de travail : au POINTAGE (les arrêtés
 *    « En cours » comptent comme les « Clôturé » ; une déclôture suivie d'un dépointage rend à la pièce son statut
 *    d'avant).
 */

export interface RapprochementPiece {
  arreteId: string
  banqueId: string
  elementId: string
  cote: ElementRapprochement['cote']
  mode: 'auto' | 'manuel'
  /** Jour du pointage (AAAA-MM-JJ). */
  rapprocheLe: string
}

export type CodeAnomalieLienRapprochement =
  | 'piece_inconnue'
  | 'pointee_deux_fois'
  | 'montant_different'
  | 'sens_incoherent'
  | 'autre_compte'
  | 'statut_incompatible'

export interface AnomalieLienRapprochement {
  code: CodeAnomalieLienRapprochement
  arreteId: string
  elementId: string
  /** Pièce en cause ; null pour une anomalie de l'élément entier (sens, montant). */
  pieceId: string | null
  message: string
}

/** Pièce dont le statut suit le rapprochement : règlement (point 38) ou encaissement (point 16). */
export interface PieceARapprocher<S extends string = string> {
  id: string
  statut: S
  /** Montant de la pièce, positif, en centimes. */
  montantCentimes: number
  /** Compte bancaire de la pièce ; présent, il doit être celui de l'arrêté. */
  banqueId?: string
  rapprochement?: RapprochementPiece | null
}

export interface RegleRapprochement<S extends string> {
  type: TypePieceRapprochee
  /** Statut posé par le pointage (« Rapproché »). */
  rapproche: S
  /** Statut de la pièce payée et non pointée (« Enregistré »), rendu au dépointage. */
  avant: S
  /** Pointages pris en compte jusqu'à ce jour inclus ; absent : tous. */
  aLaDate?: string
}

export type PieceRapprochement<P> = P & { rapprochement: RapprochementPiece | null }

const SENS_PAR_TYPE: Record<TypePieceRapprochee, { signe: 1 | -1; regle: string }> = {
  reglement: { signe: -1, regle: 'un règlement est une sortie (montant négatif)' },
  encaissement: { signe: 1, regle: 'un encaissement est une entrée (montant positif)' },
}

/** Élément rapproché retenu, avec les pièces du type cherché. */
interface Pointage {
  arrete: ArreteRapprochement
  element: ElementRapprochement
  ids: string[]
  rapprochement: RapprochementPiece
}

function pointageDe(arrete: ArreteRapprochement, element: ElementRapprochement, type: TypePieceRapprochee): Pointage | null {
  const ids = (element.pieces ?? []).filter((p) => p.type === type).map((p) => p.id)
  if (element.rapproche === false || ids.length === 0) return null
  if (element.date === undefined || !estDateIsoValide(element.date))
    throw new Error(`Élément « ${element.id} » sans date d'opération valide (AAAA-MM-JJ attendu) : ses pièces ne peuvent pas être rapprochées.`)
  const rapprocheLe = finDuSuspens({ ...element, date: element.date })
  if (rapprocheLe === null) return null
  const rapprochement: RapprochementPiece = {
    arreteId: arrete.id,
    banqueId: arrete.banqueId,
    elementId: element.id,
    cote: element.cote,
    mode: element.rapproche,
    rapprocheLe,
  }
  return { arrete, element, ids, rapprochement }
}

/** Pointages retenus : un par élément (compte bancaire + identifiant), le plus ancien, au plus tard à la date. */
function pointagesRetenus(arretes: ArreteRapprochement[], type: TypePieceRapprochee, aLaDate: string | undefined): Pointage[] {
  const parElement = new Map<string, Pointage>()
  for (const arrete of arretes)
    for (const element of arrete.elements) {
      const pointage = pointageDe(arrete, element, type)
      if (!pointage || (aLaDate !== undefined && pointage.rapprochement.rapprocheLe > aLaDate)) continue
      const cle = `${arrete.banqueId}|${element.id}`
      const deja = parElement.get(cle)
      if (!deja || pointage.rapprochement.rapprocheLe < deja.rapprochement.rapprocheLe) parElement.set(cle, pointage)
    }
  return [...parElement.values()]
}

const anomalie = (
  { arrete, element }: Pointage,
  code: CodeAnomalieLienRapprochement,
  pieceId: string | null,
  message: string,
): AnomalieLienRapprochement => ({ code, arreteId: arrete.id, elementId: element.id, pieceId, message })

/** Anomalies d'une pièce portée par l'élément : inconnue, ou d'un autre compte bancaire que l'arrêté. */
function anomaliePiece(pointage: Pointage, id: string, piece: PieceARapprocher | undefined): AnomalieLienRapprochement | null {
  const libelle = `Élément « ${pointage.element.id} » de l'arrêté « ${pointage.arrete.id} »`
  if (!piece) return anomalie(pointage, 'piece_inconnue', id, `${libelle} : pièce « ${id} » inconnue.`)
  if (piece.banqueId !== undefined && piece.banqueId !== pointage.arrete.banqueId)
    return anomalie(
      pointage,
      'autre_compte',
      id,
      `${libelle} : la pièce « ${id} » est sur le compte « ${piece.banqueId} », l'arrêté sur « ${pointage.arrete.banqueId} ».`,
    )
  return null
}

/** Anomalies d'un élément : sens, pièces, puis somme des pièces (seulement si toutes sont connues). */
function anomaliesElement(pointage: Pointage, index: ReadonlyMap<string, PieceARapprocher>, type: TypePieceRapprochee): AnomalieLienRapprochement[] {
  const { element, ids } = pointage
  const anomalies: AnomalieLienRapprochement[] = []
  const sens = SENS_PAR_TYPE[type]
  if (Math.sign(element.montantCentimes) !== sens.signe)
    anomalies.push(anomalie(pointage, 'sens_incoherent', null, `Élément « ${element.id} » (${element.montantCentimes} centimes) : ${sens.regle}.`))
  for (const id of ids) {
    const trouvee = anomaliePiece(pointage, id, index.get(id))
    if (trouvee) anomalies.push(trouvee)
  }
  if (ids.every((id) => index.has(id))) {
    const somme = ids.reduce((s, id) => s + (index.get(id)?.montantCentimes ?? 0), 0)
    if (somme !== Math.abs(element.montantCentimes))
      anomalies.push(
        anomalie(pointage, 'montant_different', null, `Élément « ${element.id} » : ${Math.abs(element.montantCentimes)} centimes, ses pièces ${somme} centimes.`),
      )
  }
  return anomalies
}

/** Deux éléments distincts d'un même côté qui pointent la même pièce : une anomalie par pointage en trop. */
function pointagesEnDouble(pointages: Pointage[]): AnomalieLienRapprochement[] {
  const premier = new Map<string, Pointage>()
  const anomalies: AnomalieLienRapprochement[] = []
  for (const pointage of pointages)
    for (const id of pointage.ids) {
      const cle = `${pointage.element.cote}|${id}`
      const deja = premier.get(cle)
      if (!deja) premier.set(cle, pointage)
      else
        anomalies.push(
          anomalie(pointage, 'pointee_deux_fois', id, `Pièce « ${id} » pointée deux fois côté ${pointage.element.cote} (« ${deja.element.id} » et « ${pointage.element.id} »).`),
        )
    }
  return anomalies
}

/** Le pointage le plus ancien ; à égalité, la ligne du relevé avant l'écriture. */
const plusAncien = (a: RapprochementPiece, b: RapprochementPiece): RapprochementPiece => {
  if (a.rapprocheLe !== b.rapprocheLe) return a.rapprocheLe < b.rapprocheLe ? a : b
  return b.cote === 'banque' && a.cote !== 'banque' ? b : a
}

/** Rapprochement retenu par pièce, hors pièces bloquées par une anomalie. */
function rapprochementsValides(pointages: Pointage[], bloquees: ReadonlySet<string>, elementsEnAnomalie: ReadonlySet<Pointage>): Map<string, RapprochementPiece> {
  const parPiece = new Map<string, RapprochementPiece>()
  for (const pointage of pointages) {
    if (elementsEnAnomalie.has(pointage)) continue
    for (const id of pointage.ids) {
      if (bloquees.has(id)) continue
      const deja = parPiece.get(id)
      parPiece.set(id, deja ? plusAncien(deja, pointage.rapprochement) : pointage.rapprochement)
    }
  }
  return parPiece
}

function verifierRegle<S extends string>(pieces: PieceARapprocher<S>[], regle: RegleRapprochement<S>): void {
  if (regle.rapproche === regle.avant) throw new Error('Statuts « avant » et « rapproché » distincts attendus.')
  if (regle.aLaDate !== undefined && !estDateIsoValide(regle.aLaDate))
    throw new Error(`Date invalide (${regle.aLaDate}) : AAAA-MM-JJ attendu.`)
  const vus = new Set<string>()
  for (const p of pieces) {
    if (vus.has(p.id)) throw new Error(`Pièce en double : « ${p.id} ».`)
    vus.add(p.id)
  }
}

/** Anomalies des éléments et des doubles pointages ; pièces bloquées et éléments écartés. */
function controlerPointages(
  pointages: Pointage[],
  index: ReadonlyMap<string, PieceARapprocher>,
  type: TypePieceRapprochee,
): { anomalies: AnomalieLienRapprochement[]; bloquees: Set<string>; elementsEnAnomalie: Set<Pointage> } {
  const anomalies: AnomalieLienRapprochement[] = []
  const bloquees = new Set<string>()
  const elementsEnAnomalie = new Set<Pointage>()
  for (const pointage of pointages) {
    const trouvees = anomaliesElement(pointage, index, type)
    if (trouvees.length === 0) continue
    anomalies.push(...trouvees)
    elementsEnAnomalie.add(pointage)
    pointage.ids.forEach((id) => bloquees.add(id))
  }
  for (const double of pointagesEnDouble(pointages)) {
    anomalies.push(double)
    if (double.pieceId !== null) bloquees.add(double.pieceId)
  }
  return { anomalies, bloquees, elementsEnAnomalie }
}

/** Nouvel état d'une pièce non bloquée ; l'anomalie « statut_incompatible » le cas échéant. */
function etatPiece<P extends PieceARapprocher>(
  piece: P,
  rapprochement: RapprochementPiece | undefined,
  regle: RegleRapprochement<P['statut']>,
): { piece: PieceRapprochement<P>; anomalie: AnomalieLienRapprochement | null } {
  if (!rapprochement) {
    const statut = piece.statut === regle.rapproche ? regle.avant : piece.statut
    return { piece: { ...piece, statut, rapprochement: null }, anomalie: null }
  }
  if (piece.statut === regle.avant || piece.statut === regle.rapproche)
    return { piece: { ...piece, statut: regle.rapproche, rapprochement }, anomalie: null }
  return {
    piece: { ...piece, rapprochement: piece.rapprochement ?? null },
    anomalie: {
      code: 'statut_incompatible',
      arreteId: rapprochement.arreteId,
      elementId: rapprochement.elementId,
      pieceId: piece.id,
      message: `Pièce « ${piece.id} » pointée alors qu'elle est « ${piece.statut} » : seule une pièce « ${regle.avant} » se rapproche.`,
    },
  }
}

/**
 * Propage le statut « rapproché » depuis les arrêtés : une pièce « avant » pointée passe « rapproché » avec la trace de
 * son rapprochement ; une pièce « rapproché » qui n'est plus pointée revient « avant » ; les autres sont inchangées
 * (rapprochement à null). Les pièces impliquées dans une anomalie gardent leur état. Pure, idempotente ; l'ordre des
 * pièces est conservé. Les pièces passées doivent être toutes celles que les arrêtés peuvent pointer (sinon « pièce
 * inconnue »).
 */
export function propagerStatutRapproche<P extends PieceARapprocher>(
  pieces: P[],
  arretes: ArreteRapprochement[],
  regle: RegleRapprochement<P['statut']>,
): { pieces: PieceRapprochement<P>[]; anomalies: AnomalieLienRapprochement[] } {
  verifierRegle(pieces, regle)
  const index: ReadonlyMap<string, PieceARapprocher> = new Map(pieces.map((p) => [p.id, p]))
  const pointages = pointagesRetenus(arretes, regle.type, regle.aLaDate)
  const { anomalies, bloquees, elementsEnAnomalie } = controlerPointages(pointages, index, regle.type)
  const parPiece = rapprochementsValides(pointages, bloquees, elementsEnAnomalie)
  const resultat = pieces.map((piece): PieceRapprochement<P> => {
    if (bloquees.has(piece.id)) return { ...piece, rapprochement: piece.rapprochement ?? null }
    const etat = etatPiece(piece, parPiece.get(piece.id), regle)
    if (etat.anomalie) anomalies.push(etat.anomalie)
    return etat.piece
  })
  return { pieces: resultat, anomalies }
}
