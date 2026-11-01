import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { regimeDepuisFondement } from '@/lib/administrateur-judiciaire/domain/fondements'

/**
 * Fiche mandat — volet « Administration judiciaire » (cartographie Gestéam, tranche 25) et répartition D1. Fonctions
 * pures, dates ISO (AAAA-MM-JJ), sans écran.
 *
 * Gestéam — bouton « Admin. judiciaire » de la fiche mandat : Tribunal · Président · Mission · Ouverture · Associé 1 ·
 * Associé 2 · Référence ; « Autres » : Ordonnance de carence — Date, Référence (seul champ propre à la carence, art. 47).
 *
 * D1 (27/10/2026) — trois entités : la fiche « mandat » de Gestéam mêle le SYNDICAT (identifiants, conseil syndical,
 * exercices, clés…) et la MISSION judiciaire ; VitFix range chaque champ d'un seul côté.
 */

export interface OrdonnanceCarence {
  date: string
  reference: string | null
}

export interface SaisieVoletJudiciaire {
  tribunal: string
  /** Magistrat qui a rendu l'ordonnance. */
  president: string
  /** Texte de la mission (Gestéam y saisit l'article de loi). */
  mission: string
  dateOuverture: string
  /** Un ou deux administrateurs judiciaires (Associé 1, Associé 2). */
  administrateurs: string[]
  /** Numéro de dossier interne du cabinet. */
  reference: string
  ordonnanceCarence: OrdonnanceCarence | null
}

export type VoletJudiciaire = SaisieVoletJudiciaire

const nettoyer = (texte: string) => texte.replace(/\s+/g, ' ').trim()

/**
 * Crée le volet judiciaire d'un mandat. Refuse une saisie invalide ; signale (sans refuser) une ordonnance de carence
 * hors art. 47, ou son absence pour un mandat art. 47.
 */
export function creerVoletJudiciaire(
  saisie: SaisieVoletJudiciaire,
  { fondement, dateOrdonnance }: { fondement: string; dateOrdonnance: string },
): { volet: VoletJudiciaire; avertissements: string[] } {
  const tribunal = nettoyer(saisie.tribunal)
  if (!tribunal) throw new Error('Tribunal manquant.')
  const administrateurs = saisie.administrateurs.map(nettoyer).filter(Boolean)
  if (administrateurs.length === 0) throw new Error('Au moins un administrateur judiciaire est requis.')
  if (administrateurs.length > 2) throw new Error('Deux administrateurs au plus (Associé 1, Associé 2).')
  if (!estDateIsoValide(saisie.dateOuverture)) throw new Error(`Date d'ouverture invalide (${saisie.dateOuverture}) : AAAA-MM-JJ attendu.`)
  if (estDateIsoValide(dateOrdonnance) && saisie.dateOuverture < dateOrdonnance)
    throw new Error(`Ouverture (${saisie.dateOuverture}) antérieure à l'ordonnance de désignation (${dateOrdonnance}).`)
  if (saisie.ordonnanceCarence && !estDateIsoValide(saisie.ordonnanceCarence.date))
    throw new Error(`Date de l'ordonnance de carence invalide (${saisie.ordonnanceCarence.date}) : AAAA-MM-JJ attendu.`)

  const avertissements: string[] = []
  const art47 = regimeDepuisFondement(fondement) === 'ap47'
  if (saisie.ordonnanceCarence && !art47)
    avertissements.push("Ordonnance de carence saisie alors que le mandat n'est pas fondé sur l'art. 47 : vérifier le fondement.")
  if (!saisie.ordonnanceCarence && art47) avertissements.push('Mandat art. 47 : renseigner la date de l’ordonnance de carence.')

  return {
    volet: {
      ...saisie,
      tribunal,
      president: nettoyer(saisie.president),
      mission: nettoyer(saisie.mission),
      administrateurs,
      reference: nettoyer(saisie.reference),
    },
    avertissements,
  }
}

/** D1 — rangement des champs de la fiche mandat Gestéam (onglet Informations, volet AJ, « Autres »). */
export const REPARTITION_FICHE_MANDAT_GESTEAM = {
  syndicat: [
    'Syndicat',
    'Type',
    'Nb de lots',
    'Total pondéré',
    'Usage des locaux',
    'N°',
    'SIRET',
    'ICS',
    'URSSAF',
    'Taxe salaire',
    'Caisse retraite',
    'Immatriculation',
    'Conseil syndical',
    'Assemblées',
    'Clés de répartition',
    'Exercices',
    'No de mutuelle',
    'No de prévoyance',
    'TIP — Code créancier',
    'No ANAH',
    'No TVA Intracom',
  ],
  mandat: [
    'Tribunal',
    'Président',
    'Mission',
    'Ouverture',
    'Associé 1',
    'Associé 2',
    'Référence',
    'Ordonnance de carence',
    'Honoraires',
  ],
} as const
