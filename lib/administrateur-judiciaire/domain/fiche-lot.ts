import type { Tantiemes } from '@/lib/administrateur-judiciaire/domain/format'

/**
 * Fiche d'un lot sur le modèle de la fiche lot de Gestéam (tranche 37 § Lots, tranche 39 § Lot) : N°, Réf., Groupe,
 * Type, cases Principal et Hors règlement ; situation (bâtiment, escalier, étage, porte, interphone, boîte aux
 * lettres) ; copropriétaire, ancien copropriétaire, « Acquis le » ; occupation ; grille Clé · Tant. · Total ;
 * caractéristiques (surface, Carrez, pièces, DPE) ; charges annuelles, fonds de travaux non remboursable, échéance
 * PNO ; équipements du lot (nature, famille, emploi) ; documents (date, émetteur, titre).
 * Hors champ volontaire : onglet Description orienté location et vente (annonce, standing, candidats), gérance (mandat
 * de gérance, bail), taxes.
 */

export interface TantiemesCleLot extends Tantiemes {
  cle: string
}

export interface EquipementLot {
  nom: string
  famille: string
  emploi: 'Privatif' | 'Collectif'
}

export interface DocumentLot {
  date: string
  emetteur: string
  titre: string
}

export interface FicheLot {
  numero: string
  reference: string
  groupe: string
  principal: boolean
  horsReglement: boolean
  batiment: string
  escalier: string
  etage: string
  porte: string
  interphone: string
  boiteAuxLettres: string
  acquisLe: string | null
  ancienCoproprietaire: string
  occupeDepuis: string | null
  tantiemes: TantiemesCleLot[]
  surfaceM2: number | null
  carrezM2: number | null
  pieces: number | null
  chambres: number | null
  dpe: string
  dpeAnnee: number | null
  chargesAnnuellesEuros: number | null
  cotisationFondsTravauxEuros: number | null
  /** Part du fonds de travaux attachée au lot (L. 1965 art. 14-2-1, III), en euros ; null : non calculée. */
  fondsTravauxAttacheEuros: number | null
  echeancePno: string | null
  equipements: EquipementLot[]
  documents: DocumentLot[]
}

/** Quote-part d'un lot dans une clé, en pourcentage à deux décimales (« 4,12 % ») ; « — » sans total. */
export function quotePartPourcent({ numerateur, denominateur }: Tantiemes): string {
  if (!denominateur || denominateur <= 0 || numerateur < 0) return '—'
  const pourcent = Math.round((numerateur * 10000) / denominateur) / 100
  return `${pourcent.toFixed(2).replace('.', ',')} %`
}

/** Fiche neuve, sans données propres. */
export function nouvelleFicheLot(propre: Partial<FicheLot> = {}): FicheLot {
  return {
    numero: '',
    reference: '',
    groupe: '',
    principal: true,
    horsReglement: false,
    batiment: '',
    escalier: '',
    etage: '',
    porte: '',
    interphone: '',
    boiteAuxLettres: '',
    acquisLe: null,
    ancienCoproprietaire: '',
    occupeDepuis: null,
    tantiemes: [],
    surfaceM2: null,
    carrezM2: null,
    pieces: null,
    chambres: null,
    dpe: '',
    dpeAnnee: null,
    chargesAnnuellesEuros: null,
    cotisationFondsTravauxEuros: null,
    fondsTravauxAttacheEuros: null,
    echeancePno: null,
    equipements: [],
    documents: [],
    ...propre,
  }
}
