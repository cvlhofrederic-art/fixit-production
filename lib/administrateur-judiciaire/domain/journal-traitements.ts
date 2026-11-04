import { dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  annulerTraitement,
  type FamilleTraitement,
  type OptionsTraitement,
  type Traitement,
} from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Journal des traitements (cartographie Gestéam, tranche 29) et décision D1. Fonctions pures, sans écran.
 *
 * D1 (Hugo Carvalho, 27/10/2026) — trois entités : Immeuble (le bâtiment), Copropriété (le SYNDICAT), Mandat
 * judiciaire. Les comptes appartiennent au syndicat : le premier segment du numéro de compte est celui du syndicat, et
 * les comptes survivent au changement de mandataire. Chaque pièce garde le mandat qui l'a produite, pour la reddition
 * des comptes de chaque mission.
 *
 * Gestéam — « Liste des fiches Traitement » : Date · N° (séquence unique du cabinet, ≈ 120 000) · Pièce · Nb (lignes)
 * · Statut ; fiche : famille, traitement type, collaborateur, source, immeuble, mandat, paramètres (4 lignes Date ·
 * Alpha · Entier long · Réel). Statuts vus : Enregistré, Imputé (opérations comptables) ; Produit, Émis (documents :
 * appels de fonds, règlements). 🔵 Le partage des familles entre les deux cycles est DÉDUIT des listes observées.
 *
 * Statut « Annulé » (point 25 du bilan 2) — 🟢 tranche 43 § 6 : la liste des répartitions de charges porte les statuts
 * Enregistré · Annulé · Imputé (« Annulé » absent de la tranche 29) ; une répartition « se rejoue (annulation puis
 * nouvelle répartition) tant qu'elle n'est pas imputée ». D'où annulerPiece : seule une pièce « Enregistré » s'annule ;
 * l'annulation est une écriture contraire (annulerTraitement, R6 ; arrêté du 14 mars 2005, art. 5 : « Une écriture
 * erronée est annulée par une écriture contraire »), journalisée à son tour comme une pièce (numéro de la séquence du
 * cabinet, même syndicat, mandat qui annule) ; la pièce d'origine passe à « Annulé », garde l'identifiant de son
 * annulation (annuleePar) et ne bouge plus. annulerTraitement, qui ne lit aucun statut, reste inchangé pour ses
 * appelants (encaissements, règlements, appels).
 * 🔵 Déduit : « Annulé » est hors des deux cycles (aucun changement de statut ne l'atteint ni n'en sort) ; une pièce
 * imputée, ou de cycle document (Produit, Émis : appels de fonds, règlements, qui ont leur propre circuit d'annulation,
 * echeancier-appels.ts et reglements-fournisseurs.ts), ne s'annule pas par ici ; l'annulation a son propre identifiant,
 * ni vide ni celui de la pièce annulée (sinon elle renverrait à elle-même, comme le refuse
 * reglements-fournisseurs.rejeterVirement) ; elle n'est jamais datée avant la pièce qu'elle annule : l'« écriture
 * contraire » de l'arrêté art. 5 annule une écriture passée, d'où l'on déduit qu'elle ne la précède pas (même lecture
 * que rejeterVirement, qui ramène la contre-passation à la date de l'écriture d'origine ; ici la date est choisie par
 * l'appelant, elle est donc refusée plutôt que déplacée).
 *
 * Date comptable et date d'effet (point 25) — 🟢 tranche 43 § 6 et § 7 : la répartition de charges est datée du DERNIER
 * JOUR DE L'EXERCICE (date comptable), sa « date de passage des écritures (le jour du traitement) » est en ligne 3 des
 * paramètres, la fiche d'un mouvement montre « date comptable · Effet ». Seule famille vue avec deux dates ; la fiche
 * d'une ANNULATION de répartition n'a jamais été ouverte (§ 6 ne clique que sur une ligne « Imputé »).
 * 🔵 Déduit : (1) toute voie d'annulation de la pièce d'une répartition, annulerPiece comprise, garde la date comptable de
 * la pièce : ni avant (ci-dessus), ni après, car les comptes sont « arrêtés à la date de clôture » (décret n° 2005-240
 * art. 5) et une écriture contraire datée de l'exercice suivant laisserait à l'exercice clos la répartition annulée EN
 * PLUS de la répartition relancée ; (2) le jour de l'annulation, que cette date comptable ne dit plus, est la DATE
 * D'EFFET de l'annulation, obligatoire, portée par l'unique ligne de paramètres de la pièce d'annulation (choix VitFix,
 * calqué sur la ligne 3 de la répartition, sans son entier 1 au sens non établi), jamais antérieure à la date d'effet de
 * la répartition annulée (on n'annule pas un traitement avant de l'avoir passé) ; (3) les autres pièces sont datées du
 * jour du traitement : leur annulation ne porte ni date d'effet distincte (refusée) ni paramètre. dateEffetPiece relit la
 * date d'effet de toute pièce.
 * 🔴 Non établi (Hugo ou Frédéric) : « Dans Gestéam, une pièce imputée d'une autre famille que la répartition de charges
 * (encaissement, saisie de factures) s'annule-t-elle encore ? » (seule la répartition a été vue au statut « Annulé ») ;
 * « Une répartition « Enregistré » a-t-elle déjà passé ses écritures au grand livre, ou ses mouvements attendent-ils
 * l'imputation (l'annulation serait alors un simple abandon) ? » VitFix contre-passe dans tous les cas (arrêté art. 5) ;
 * « Dans Gestéam, la fiche d'une « Annulation répartition de charges » porte-t-elle des paramètres, et lesquels (le jour
 * de l'annulation ?) ; quelle date comptable porte-t-elle ? » (VitFix : la clôture, et le jour de l'annulation en
 * ligne 1).
 */

/** Deux cycles de statut, chacun en deux étapes, dans l'ordre. */
export const CYCLES_PIECE = {
  comptable: ['Enregistré', 'Imputé'],
  document: ['Produit', 'Émis'],
} as const
export type CyclePiece = keyof typeof CYCLES_PIECE

/** Statut d'une pièce annulée avant imputation (tranche 43 § 6), hors des deux cycles. */
export const STATUT_PIECE_ANNULEE = 'Annulé'
export type StatutPiece = (typeof CYCLES_PIECE)[CyclePiece][number] | typeof STATUT_PIECE_ANNULEE

/** Familles dont la pièce produit des documents à émettre (appels, ordres de règlement) — 🔵 déduit. */
const FAMILLES_DOCUMENT: ReadonlySet<string> = new Set(['Appel de fonds', 'Règlement de factures'])

export const cycleDeFamille = (famille: FamilleTraitement): CyclePiece => (FAMILLES_DOCUMENT.has(famille) ? 'document' : 'comptable')

/** Ligne de paramètres d'un traitement (Gestéam : Date · Alpha · Entier long · Réel). */
export interface ParametreTraitement {
  date: string | null
  alpha: string | null
  entier: number | null
  reel: number | null
}

export interface PieceTraitement {
  id: string
  /** Séquence unique du cabinet. */
  numero: number
  famille: FamilleTraitement
  date: string
  /** D1 : le syndicat propriétaire des comptes mouvementés. */
  coproprieteId: string
  /** D1 : le mandat (la mission) qui a produit la pièce. */
  mandatId: string
  nbLignes: number
  statut: StatutPiece
  parametres: ParametreTraitement[]
  traitement: Traitement
  /** Identifiant du traitement d'annulation, pour une pièce « Annulé » (annulerPiece). */
  annuleePar?: string
}

/** D1 — segment comptable du syndicat (1er segment du numéro de compte) : 4 caractères majuscules, complété par des 0. */
export function segmentComptableSyndicat(code: string): string {
  const brut = code
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (!brut) throw new Error('Code du syndicat vide : segment comptable impossible.')
  if (brut.length > 4) throw new Error(`Code du syndicat « ${code} » : 4 caractères au plus pour le segment comptable.`)
  return brut.padEnd(4, '0')
}

/** Segment non encore attribué, observé sur les contreparties de journaux. */
const SEGMENT_EN_ATTENTE = '____'

export function creerPieceTraitement({
  traitement,
  numero,
  coproprieteId,
  segmentSyndicat,
  mandatId,
  parametres,
}: {
  traitement: Traitement
  numero: number
  coproprieteId: string
  segmentSyndicat: string
  mandatId: string
  parametres: ParametreTraitement[]
}): PieceTraitement {
  if (!coproprieteId.trim()) throw new Error('Pièce sans syndicat : D1 rattache chaque pièce à sa copropriété.')
  if (!mandatId.trim()) throw new Error('Pièce sans mandat : D1 garde le mandat qui a produit chaque pièce.')
  if (!Number.isInteger(numero) || numero < 1) throw new Error(`Numéro de pièce invalide (${numero}) : entier positif attendu.`)
  if (parametres.length > 4) throw new Error('Un traitement porte au plus quatre lignes de paramètres.')
  for (const p of parametres)
    if (p.date !== null && !estDateIsoValide(p.date)) throw new Error(`Date de paramètre invalide (${p.date}) : AAAA-MM-JJ attendu.`)
  for (const mouvement of traitement.mouvements) {
    const segment = mouvement.compte.split('.')[0]
    if (mouvement.compte.includes('.') && segment !== SEGMENT_EN_ATTENTE && segment !== segmentSyndicat)
      throw new Error(`Compte ${mouvement.compte} d'un autre syndicat que ${segmentSyndicat} : une pièce ne mouvemente qu'un syndicat (D1).`)
  }
  return {
    id: traitement.id,
    numero,
    famille: traitement.famille,
    date: traitement.date,
    coproprieteId,
    mandatId,
    nbLignes: traitement.mouvements.length,
    statut: CYCLES_PIECE[cycleDeFamille(traitement.famille)][0],
    parametres,
    traitement,
  }
}

/** Numéro de la prochaine pièce : séquence unique du cabinet. */
export const numeroPieceSuivant = (pieces: Pick<PieceTraitement, 'numero'>[]): number =>
  pieces.reduce((max, p) => Math.max(max, p.numero), 0) + 1

/**
 * Fait avancer le statut d'une étape dans le cycle de la pièce ; renvoie une nouvelle pièce. Une pièce annulée ne change
 * plus de statut ; l'annulation passe par annulerPiece (écriture contraire), jamais par un changement de statut.
 */
export function changerStatutPiece(piece: PieceTraitement, nouveau: StatutPiece): PieceTraitement {
  if (piece.statut === STATUT_PIECE_ANNULEE)
    throw new Error(`Pièce n° ${piece.numero} annulée : aucun changement de statut (statut « ${STATUT_PIECE_ANNULEE} » définitif).`)
  if (nouveau === STATUT_PIECE_ANNULEE)
    throw new Error(`Pièce n° ${piece.numero} : l'annulation passe par une écriture contraire (annulerPiece), pas par un changement de statut.`)
  const cycle: readonly StatutPiece[] = CYCLES_PIECE[cycleDeFamille(piece.famille)]
  const rangNouveau = cycle.indexOf(nouveau)
  if (rangNouveau < 0) throw new Error(`Statut « ${nouveau} » hors du cycle de la famille « ${piece.famille} ».`)
  if (rangNouveau !== cycle.indexOf(piece.statut) + 1)
    throw new Error(`Changement de statut refusé : « ${piece.statut} » → « ${nouveau} » (une étape en avant seulement).`)
  return { ...piece, statut: nouveau }
}

/**
 * Familles à date comptable imposée (point 25) : rang de la ligne de paramètres qui porte la date d'effet, jour du
 * traitement. 🟢 Répartition : datée de la clôture, date de passage en ligne 3 (tranche 43 § 6 et § 7). 🔵 Annulation de
 * répartition : datée elle aussi de la clôture, le jour de l'annulation en ligne 1 (choix VitFix, fiche jamais ouverte).
 */
const RANG_DATE_EFFET: ReadonlyMap<FamilleTraitement, number> = new Map<FamilleTraitement, number>([
  ['Répartition de charges', 2],
  ['Annulation répartition de charges', 0],
])

/**
 * Date d'effet d'une pièce (jour du traitement) : sa date, sauf pour une famille à date comptable imposée, dont la date
 * d'effet est dans les paramètres (refus si la ligne n'en porte pas).
 */
export function dateEffetPiece(piece: Pick<PieceTraitement, 'numero' | 'famille' | 'date' | 'parametres'>): string {
  const rang = RANG_DATE_EFFET.get(piece.famille)
  if (rang === undefined) return piece.date
  const dateEffet = piece.parametres[rang]?.date
  if (!dateEffet)
    throw new Error(`Pièce n° ${piece.numero} (« ${piece.famille} ») sans date d'effet en ligne ${rang + 1} des paramètres.`)
  return dateEffet
}

export interface OptionsAnnulationPiece extends OptionsTraitement {
  /** Identifiant du traitement d'annulation. */
  id: string
  /**
   * Date comptable de l'écriture contraire (le verrou de saisie la contrôle) ; pour une pièce à date comptable imposée
   * (répartition), celle de la pièce, rien d'autre.
   */
  date: string
  /**
   * Date d'effet de l'annulation (jour du traitement d'annulation) : obligatoire pour une pièce à date comptable imposée
   * (répartition), portée par la ligne 1 des paramètres de la pièce d'annulation ; refusée pour une autre pièce.
   */
  dateEffet?: string
  /** Numéro de la pièce d'annulation (séquence du cabinet : numeroPieceSuivant). */
  numero: number
  /** D1 : segment comptable du syndicat de la pièce annulée. */
  segmentSyndicat: string
  /** D1 : mandat qui annule ; par défaut celui de la pièce annulée. */
  mandatId?: string
}

/** Pièce d'annulation : son propre numéro, son propre identifiant, une date qui ne précède pas la pièce annulée. */
function verifierEnTeteAnnulation(piece: PieceTraitement, { id, date, numero }: Pick<OptionsAnnulationPiece, 'id' | 'date' | 'numero'>): void {
  if (numero === piece.numero) throw new Error(`Pièce d'annulation : numéro ${numero} déjà pris par la pièce annulée.`)
  if (!id.trim()) throw new Error("Pièce d'annulation : identifiant du traitement d'annulation attendu.")
  if (id === piece.id || id === piece.traitement.id)
    throw new Error(`Pièce d'annulation : l'annulation a son propre identifiant, distinct de celui de la pièce n° ${piece.numero} (${id}).`)
  if (!estDateIsoValide(date)) throw new Error(`Date de l'annulation invalide (« ${date} ») : AAAA-MM-JJ attendu.`)
  if (date < piece.date)
    throw new Error(
      `Annulation datée du ${dateIsoVersFr(date)}, antérieure à la pièce n° ${piece.numero} du ${dateIsoVersFr(piece.date)} : l'écriture contraire annule une écriture passée, elle ne la précède pas.`,
    )
}

/**
 * Paramètres de la pièce d'annulation. Pièce à date comptable imposée (répartition) : l'écriture contraire garde la date
 * comptable de la pièce (après : refusée, décret n° 2005-240 art. 5) et porte, en ligne 1, sa date d'effet, obligatoire,
 * jamais antérieure à celle de la pièce annulée. Autre pièce : datée du jour du traitement, aucun paramètre, aucune date
 * d'effet distincte.
 */
function parametresAnnulation(piece: PieceTraitement, { date, dateEffet }: Pick<OptionsAnnulationPiece, 'date' | 'dateEffet'>): ParametreTraitement[] {
  const objet = `Annulation de la pièce n° ${piece.numero} (« ${piece.famille} »)`
  if (!RANG_DATE_EFFET.has(piece.famille)) {
    if (dateEffet !== undefined)
      throw new Error(`${objet} : datée du jour du traitement, pas de date d'effet distincte (réservée à une pièce à date comptable imposée).`)
    return []
  }
  if (date > piece.date)
    throw new Error(
      `${objet} datée du ${dateIsoVersFr(date)}, postérieure à sa date comptable, la clôture du ${dateIsoVersFr(piece.date)} : les comptes sont arrêtés à la date de clôture (décret n° 2005-240 art. 5), l'écriture contraire garde cette date, sinon l'exercice clos garderait la répartition annulée et la répartition relancée ; le jour de l'annulation est sa date d'effet (dateEffet).`,
    )
  if (dateEffet === undefined) throw new Error(`${objet} : date d'effet attendue (jour de l'annulation, que la date comptable de clôture ne dit pas).`)
  if (!estDateIsoValide(dateEffet)) throw new Error(`${objet} : date d'effet invalide (« ${dateEffet} ») : AAAA-MM-JJ attendu.`)
  const effetPiece = dateEffetPiece(piece)
  if (dateEffet < effetPiece)
    throw new Error(
      `${objet} : date d'effet du ${dateIsoVersFr(dateEffet)}, antérieure à celle de la pièce annulée (${dateIsoVersFr(effetPiece)}) : on n'annule pas un traitement avant de l'avoir passé.`,
    )
  return [{ date: dateEffet, alpha: null, entier: null, reel: null }]
}

/**
 * Annule une pièce « Enregistré » (tranche 43 § 6) : renvoie la pièce au statut « Annulé » (annuleePar renseigné) et la
 * pièce d'annulation, écriture contraire datée `date` (annulerTraitement : famille d'annulation observée, verrou de saisie
 * contrôlé sur cette date). Refuse une pièce imputée (« annulable tant qu'elle n'est pas imputée »), déjà annulée, ou de
 * cycle document, un numéro ou un identifiant d'annulation égal à celui de la pièce, un identifiant vide et une date
 * antérieure à la pièce. Pièce à date comptable imposée (répartition) : la date est celle de la pièce, la date d'effet
 * (jour de l'annulation) obligatoire (parametresAnnulation). Fonction pure : la pièce reçue n'est pas modifiée.
 */
export function annulerPiece(
  piece: PieceTraitement,
  { id, date, dateEffet, numero, segmentSyndicat, mandatId = piece.mandatId, verrou }: OptionsAnnulationPiece,
): { piece: PieceTraitement; annulation: PieceTraitement } {
  if (piece.statut === STATUT_PIECE_ANNULEE) throw new Error(`Pièce n° ${piece.numero} déjà annulée.`)
  if (piece.statut !== CYCLES_PIECE.comptable[0])
    throw new Error(
      `Pièce n° ${piece.numero} au statut « ${piece.statut} » : seule une pièce « ${CYCLES_PIECE.comptable[0]} » s'annule (une pièce imputée ne s'annule plus ; une pièce de document suit son propre circuit d'annulation).`,
    )
  verifierEnTeteAnnulation(piece, { id, date, numero })
  const parametres = parametresAnnulation(piece, { date, dateEffet })
  const traitement = annulerTraitement(piece.traitement, { id, date, verrou })
  const annulation = creerPieceTraitement({ traitement, numero, coproprieteId: piece.coproprieteId, segmentSyndicat, mandatId, parametres })
  return { piece: { ...piece, statut: STATUT_PIECE_ANNULEE, annuleePar: traitement.id }, annulation }
}
