import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { FamilleTraitement, Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'

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
 */

/** Deux cycles de statut, chacun en deux étapes, dans l'ordre. */
export const CYCLES_PIECE = {
  comptable: ['Enregistré', 'Imputé'],
  document: ['Produit', 'Émis'],
} as const
export type CyclePiece = keyof typeof CYCLES_PIECE
export type StatutPiece = (typeof CYCLES_PIECE)[CyclePiece][number]

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

/** Fait avancer le statut d'une étape dans le cycle de la pièce ; renvoie une nouvelle pièce. */
export function changerStatutPiece(piece: PieceTraitement, nouveau: StatutPiece): PieceTraitement {
  const cycle: readonly StatutPiece[] = CYCLES_PIECE[cycleDeFamille(piece.famille)]
  const rangNouveau = cycle.indexOf(nouveau)
  if (rangNouveau < 0) throw new Error(`Statut « ${nouveau} » hors du cycle de la famille « ${piece.famille} ».`)
  if (rangNouveau !== cycle.indexOf(piece.statut) + 1)
    throw new Error(`Changement de statut refusé : « ${piece.statut} » → « ${nouveau} » (une étape en avant seulement).`)
  return { ...piece, statut: nouveau }
}
