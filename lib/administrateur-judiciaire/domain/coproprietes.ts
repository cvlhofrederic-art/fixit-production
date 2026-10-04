import { dateIsoVersFr, dateVersIso } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Tantiemes } from '@/lib/administrateur-judiciaire/domain/format'

/**
 * Vue « copropriété » des écrans : fusion d'une copropriété et de son mandat tels qu'enregistrés dans la base locale.
 * Les interfaces « …Enregistre(e) » décrivent les seuls champs que le domaine lit ; les entités de la base
 * (lib/administrateur-judiciaire/db) doivent les satisfaire.
 */

/** Copropriété enregistrée dans la base locale (champs lus par le domaine). */
export interface CoproprieteEnregistree {
  id: string
  code: string
  nom: string
  adresse: string
  nbLots: number
  budget: number
  depense: number
  impayes: number
  fondsTravaux: number
  /** Horodatage ISO de création (repository). */
  createdAt: string
}

/** Mandat enregistré dans la base locale (dates en objets Date locaux ; champs absents remplacés par défaut). */
export interface MandatEnregistre {
  id: string
  fondement?: string
  motif?: string
  tribunal?: string
  rg?: string
  ordonnance?: Date | null
  dureeMois?: number
  echeance?: Date | null
  statut?: string
  pill?: string
  notifOrdonnance?: string
}

/** Lot enregistré dans la base locale. */
export interface LotEnregistre {
  id: string
  coproprieteId: string
  numero: string
  tantiemes?: Tantiemes | null
}

/** Copropriétaire enregistré dans la base locale (solde négatif = dette). */
export interface CoproprietaireEnregistre {
  id: string
  lotId: string
  nom: string
  tel?: string
  mail?: string
  solde: number
  statut: string
}

/**
 * Vue copropriété non formatée : ordonnance et échéance sont des Date, ou retombent sur `createdAt`
 * (chaîne ISO) quand il n'y a pas de mandat.
 */
export interface CoproprieteVue {
  id: string
  mandatId: string
  code: string
  nom: string
  adresse: string
  lots: number
  budget: number
  depense: number
  impayes: number
  fondsTravaux: number
  fondement: string
  motif: string
  tribunal: string
  rg: string
  ordonnance: Date | string
  dureeMois: number
  echeance: Date | string
  statut: string
  pill: string
  notifOrdonnance: string
}

/** Vue copropriété dont les dates sont formatées « JJ/MM/AAAA » (chaîne vide si ce ne sont pas des Date). */
export type CoproprieteVueFormatee = Omit<CoproprieteVue, 'ordonnance' | 'echeance'> & {
  ordonnance: string
  echeance: string
}

/**
 * Fusionne une copropriété et son mandat. Sans mandat : pill « navy », durée 0, chaînes vides, et ordonnance /
 * échéance = createdAt (chaîne ISO, qui s'affichera ensuite comme une date vide).
 */
export function fusionnerCoproMandat(
  copro: CoproprieteEnregistree,
  mandat?: MandatEnregistre | null,
): CoproprieteVue {
  return {
    id: copro.id,
    mandatId: mandat?.id || '',
    code: copro.code,
    nom: copro.nom,
    adresse: copro.adresse,
    lots: copro.nbLots,
    budget: copro.budget,
    depense: copro.depense,
    impayes: copro.impayes,
    fondsTravaux: copro.fondsTravaux,
    fondement: mandat?.fondement || '',
    motif: mandat?.motif || '',
    tribunal: mandat?.tribunal || '',
    rg: mandat?.rg || '',
    ordonnance: mandat?.ordonnance || copro.createdAt,
    dureeMois: mandat?.dureeMois || 0,
    echeance: mandat?.echeance || copro.createdAt,
    statut: mandat?.statut || '',
    pill: mandat?.pill || 'navy',
    notifOrdonnance: mandat?.notifOrdonnance || '',
  }
}

/**
 * Code court d'une copropriété : initiales des mots hors articles (de, des, du, la, le, les, d', l'), 3 lettres au plus ;
 * à défaut les deux premières lettres. Les codes peuvent entrer en collision (entre elles et avec la démonstration).
 */
export function genererCodeCopro(nom: string): string {
  return (
    nom
      .split(/\s+/)
      .filter((mot) => mot && !/^(de|des|du|la|le|les|d'|l')$/i.test(mot))
      .map((mot) => mot[0]?.toUpperCase() || '')
      .join('') || nom.slice(0, 2).toUpperCase()
  ).slice(0, 3)
}

/** Date locale → « JJ/MM/AAAA » ; chaîne vide pour toute autre valeur. */
export const dateVersFrOuVide = (valeur: unknown): string => {
  const iso = dateVersIso(valeur ?? null)
  return iso ? dateIsoVersFr(iso) : ''
}

/** Formate l'ordonnance et l'échéance d'une vue copropriété. */
export function formaterDatesCoproVue<V extends { ordonnance: unknown; echeance: unknown }>(
  vue: V,
): Omit<V, 'ordonnance' | 'echeance'> & { ordonnance: string; echeance: string } {
  return {
    ...vue,
    ordonnance: dateVersFrOuVide(vue.ordonnance),
    echeance: dateVersFrOuVide(vue.echeance),
  }
}

/** Vue affichée quand la base ne contient aucune copropriété. */
export const COPRO_VIDE: CoproprieteVueFormatee = {
  id: '',
  mandatId: '',
  code: '',
  nom: 'Aucune copropriété enregistrée',
  adresse: '',
  lots: 0,
  budget: 0,
  depense: 0,
  impayes: 0,
  fondsTravaux: 0,
  fondement: '',
  motif: '',
  tribunal: '',
  rg: '',
  ordonnance: '',
  dureeMois: 0,
  echeance: '',
  statut: '',
  pill: 'navy',
  notifOrdonnance: '',
}
