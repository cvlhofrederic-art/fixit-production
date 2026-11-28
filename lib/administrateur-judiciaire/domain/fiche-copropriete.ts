import { ajouterMois, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'

/**
 * Fiche d'une copropriété sur le modèle de la fiche Mandat de Gestéam (relevé du 29/10/2026, structure seulement) :
 * N°, type, mandant, statut « En gestion », date d'effet ; onglet Informations : syndicat, nombre de lots (habitation,
 * commerce), stationnements, usage des locaux, SIRET, immatriculation, ICS ; conseil syndical (élu le, pour N mois,
 * fin) ; assemblées (« Accepte les AG en visio », « Soumis Art. 22 ») ; clés de répartition (clé principale) ;
 * exercices (assemblée, budget, statut) ; honoraires au forfait (visites, CS, AGO) ; équipe de l'immeuble ;
 * avertissement ; notes. L'ordonnance, le fondement et les montants restent portés par Mandat et Copropriete.
 * Hors champ volontaire : caisse de retraite, taxe sur les salaires (personnel du syndicat, point n° 42 du bilan).
 */

export interface MembreEquipe {
  role: 'Responsable' | 'Comptable' | 'Assistant(e)' | 'Gestionnaire'
  collaborateur: string
}

export interface CleFiche {
  code: string
  libelle: string
  /** Total de la clé (« 10 000 ») ou « relevés » pour une clé de compteur. */
  tantiemes: string
  principale: boolean
}

export interface ExerciceFiche {
  annee: number
  /** Date de l'assemblée qui a voté le budget ; null : pas encore tenue. */
  assemblee: string | null
  budgetEuros: number
  statut: 'Préparé' | 'Voté' | 'Approuvé'
}

export interface FicheCopropriete {
  numeroMandat: string
  /** Type de mandat (« Syndic judiciaire (art. 46) »…) ; vide : la fiche affiche le fondement du mandat. */
  typeMandat: string
  mandant: string
  statutGestion: 'En gestion' | 'Sorti'
  dateEffet: string | null
  immatriculation: string
  siret: string
  /** Identifiant créancier SEPA, pour les prélèvements. */
  ics: string
  employeur: boolean
  lots: { habitation: number; commerce: number; stationnements: number; usage: string }
  equipe: MembreEquipe[]
  cles: CleFiche[]
  exercices: ExerciceFiche[]
  conseilSyndical: { eluLe: string | null; dureeMois: number }
  agVisio: boolean
  soumisArt22: boolean
  /** Seuil d'alerte de trésorerie, en euros ; null : aucune alerte. */
  alerteTresorerieEuros: number | null
  forfait: { visites: number; heuresAgo: number; heuresCs: number }
  notes: string
  avertissement: string | null
}

/** Fin du mandat du conseil syndical (élu le `eluLe`, pour `dureeMois` mois) ; null si la date manque ou est invalide. */
export function finConseilSyndical({ eluLe, dureeMois }: FicheCopropriete['conseilSyndical']): string | null {
  if (!eluLe || !estDateIsoValide(eluLe) || !Number.isInteger(dureeMois) || dureeMois <= 0) return null
  return ajouterMois(eluLe, dureeMois)
}

/** Fiche neuve, sans données propres. */
export function nouvelleFicheCopropriete(propre: Partial<FicheCopropriete> = {}): FicheCopropriete {
  return {
    numeroMandat: '',
    typeMandat: '',
    mandant: 'Syndicat des copropriétaires',
    statutGestion: 'En gestion',
    dateEffet: null,
    immatriculation: '',
    siret: '',
    ics: '',
    employeur: false,
    lots: { habitation: 0, commerce: 0, stationnements: 0, usage: '' },
    equipe: [],
    cles: [],
    exercices: [],
    conseilSyndical: { eluLe: null, dureeMois: 12 },
    agVisio: false,
    soumisArt22: false,
    alerteTresorerieEuros: null,
    forfait: { visites: 0, heuresAgo: 0, heuresCs: 0 },
    notes: '',
    avertissement: null,
    ...propre,
  }
}
