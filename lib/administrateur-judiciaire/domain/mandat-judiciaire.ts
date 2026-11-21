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
 *
 * Recommandations validées le 17/11/2026 (J67 ; L. 1965 art. 29-1, I et C. com. art. L. 811-1 lus sur Légifrance
 * le 17/11/2026), champs tirés de l'ordonnance (enregistrement : à brancher ; écran : Frédéric) :
 * - J67, R73 : quand l'ordonnance nomme deux administrateurs judiciaires, les textes lus ne disent pas s'ils agissent
 *   ensemble ou chacun seul : c'est l'ordonnance qui décide (modeExercice). Deux administrateurs sans mode saisi : un
 *   avertissement « mode d'exercice à vérifier dans l'ordonnance » ; le contrôle de l'OS (envoi-ordre-service.ts) exige
 *   l'accord des deux quand ils agissent ensemble ;
 * - J67, R69 : le juge peut aussi confier à l'administrateur provisoire les pouvoirs du conseil syndical (L. 1965 art.
 *   29-1, I, al. 2 ; portée exacte à confirmer), dès la désignation ou plus tard, la mission pouvant être modifiée à tout
 *   moment (al. 3) : pouvoirsConseilSyndicalConfiesLe, date de l'ordonnance qui les confie (même nom que dans le contrôle
 *   de l'OS, CadreMandatOs) ; une décision du conseil syndical prise après elle sort de ses pouvoirs
 *   (envoi-ordre-service.ts).
 */

/** Mode d'exercice de deux administrateurs judiciaires désignés, fixé par l'ordonnance (J67, R73). */
export const MODES_EXERCICE_ADMINISTRATEURS = ['ensemble', 'chacun_seul'] as const
export type ModeExerciceAdministrateurs = (typeof MODES_EXERCICE_ADMINISTRATEURS)[number]

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
  /** Deux administrateurs : ils agissent ensemble, ou chacun seul (ordonnance) ; absent ou null : non saisi (J67, R73). */
  modeExercice?: ModeExerciceAdministrateurs | null
  /**
   * Date de l'ordonnance qui confie à l'administrateur provisoire les pouvoirs du conseil syndical (L. 1965 art. 29-1, I,
   * al. 2 et 3) : celle de la désignation, ou d'une ordonnance plus tardive ; absent ou null : non confiés (J67, R69).
   */
  pouvoirsConseilSyndicalConfiesLe?: string | null
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
  const confiesLe = saisie.pouvoirsConseilSyndicalConfiesLe ?? null
  if (confiesLe !== null && !estDateIsoValide(confiesLe))
    throw new Error(`Date de l'ordonnance qui confie les pouvoirs du conseil syndical invalide (${confiesLe}) : AAAA-MM-JJ attendu.`)
  if (confiesLe !== null && estDateIsoValide(dateOrdonnance) && confiesLe < dateOrdonnance)
    throw new Error(`Pouvoirs du conseil syndical confiés le ${confiesLe}, avant l'ordonnance de désignation (${dateOrdonnance}).`)
  const modeExercice = saisie.modeExercice ?? null
  if (modeExercice !== null && !(MODES_EXERCICE_ADMINISTRATEURS as readonly string[]).includes(modeExercice))
    throw new Error(`Mode d'exercice inconnu : « ${modeExercice} » (ensemble ou chacun_seul).`)

  const avertissements: string[] = []
  const art47 = regimeDepuisFondement(fondement) === 'ap47'
  if (saisie.ordonnanceCarence && !art47)
    avertissements.push("Ordonnance de carence saisie alors que le mandat n'est pas fondé sur l'art. 47 : vérifier le fondement.")
  if (!saisie.ordonnanceCarence && art47) avertissements.push('Mandat art. 47 : renseigner la date de l’ordonnance de carence.')
  if (administrateurs.length === 2 && modeExercice === null)
    avertissements.push(
      "Deux administrateurs judiciaires désignés : mode d'exercice à vérifier dans l'ordonnance (ensemble, ou chacun seul) et à saisir (J67, R73).",
    )

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
