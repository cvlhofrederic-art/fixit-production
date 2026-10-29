import { JOURS_PRESENTATION_AVANT_REUNION } from '@/lib/administrateur-judiciaire/domain/carence-assemblee'
import { ajouterJours, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { appliquerDelai } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import type { TypeMajorite, VoteAssemblee } from '@/lib/administrateur-judiciaire/domain/majorites-ag'
import {
  creerResolution,
  membresVotants,
  voterResolution,
  voterSecondVote,
  type Resolution,
} from '@/lib/administrateur-judiciaire/domain/resolutions-ag'
import { DELAI_CONTESTATION_AG_ART42 } from '@/lib/administrateur-judiciaire/domain/statut-assemblee'
import { depouiller, type Bulletin, type EtatPresence, type LignePresence } from '@/lib/administrateur-judiciaire/domain/votes-ag'

/**
 * Fiche d'une assemblée générale sur le modèle de la fiche assemblée de Gestéam (tranche 31) : nature, n°, statut ;
 * date, horaires, lieu, visioconférence, vote par correspondance, clé de la feuille de présence ; convocation ;
 * ordre du jour avec la majorité de chaque résolution ; comptage des présences ; bureau ; pouvoirs ; décisions de
 * l'exercice ; procès-verbal signé et notifié ; notes et équipe.
 * Aucun calcul propre : les résultats viennent de resolutions-ag (majorité, second vote des art. 25-1 et 26-1) et de
 * votes-ag (dépouillement après la réduction de l'art. 22, pouvoirs) ; l'échéance de contestation applique la règle de
 * finDelaiContestationAg (L. 1965 art. 42 al. 2, J1 : lendemain de la première présentation, même quantième deux mois
 * plus tard, sans report) ; la date limite de présentation de la convocation reprend JOURS_PRESENTATION_AVANT_REUNION
 * (D. 1967 art. 9, 🔴 décompte à confirmer, comme dans carence-assemblee).
 */

export const NATURES_ASSEMBLEE = ['Annuelle', 'Spéciale', 'Judiciaire'] as const
export const STATUTS_FICHE_ASSEMBLEE = ['Projet', 'Convoquée', 'Tenue', 'PV signé', 'Notifiée'] as const

export interface ResolutionFiche {
  numero: number
  intitule: string
  majorite: TypeMajorite
  travauxArt25f?: boolean
  /** Bulletins par compte ; null : résolution pas encore votée. */
  bulletins: Record<string, Bulletin> | null
  /** Bulletins du second vote immédiat (art. 25-1, 26-1) ; absents : mêmes bulletins qu'au premier vote. */
  bulletinsSecondVote?: Record<string, Bulletin>
}

export interface FicheAssemblee {
  id: string
  coproCode: string
  numero: string
  nature: (typeof NATURES_ASSEMBLEE)[number]
  statut: (typeof STATUTS_FICHE_ASSEMBLEE)[number]
  date: string
  heureDebut: string
  heureFin: string
  lieu: string
  visio: boolean
  voteCorrespondance: boolean
  clePresence: string
  convocationEnvoyeeLe: string | null
  convocationPresenteeLe: string | null
  feuille: LignePresence[]
  /** Nom affiché de chaque compte de la feuille. */
  noms: Record<string, string>
  resolutions: ResolutionFiche[]
  bureau: { president: string; scrutateurs: string[]; secretaire: string }
  decisions: {
    exerciceApprouve: number | null
    budgetAnnee: number | null
    budgetVoteEuros: number | null
    mandatCsMois: number | null
    seuilConsultationCsEuros: number | null
  }
  pvSigneLe: string | null
  /** Première présentation de la notification du PV (lettre recommandée). */
  pvPresenteLe: string | null
  notes: string
  responsable: string
  assistant: string
}

export interface ResultatResolutionFiche {
  resolution: Resolution
  vote: VoteAssemblee | null
  libelle: string
}

const verifierDate = (date: string) => {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
}

function libelleResultat(resolution: Resolution): string {
  if (resolution.etat === 'a_voter') return 'À voter'
  if (resolution.etat === 'reportee') return 'Reportée'
  if (resolution.etat === 'second_vote') return 'Second vote à tenir'
  const auSecond = resolution.secondVote ? ` au second vote (${resolution.premierVote?.majorite === 'art26' ? 'art. 26-1' : 'art. 25-1'})` : ''
  if (resolution.etat === 'adoptee') return `Adoptée${auSecond}`
  if (resolution.suite?.code === 'nouvelle_ag_trois_mois') return 'Rejetée : nouvelle AG possible sous trois mois (art. 25-1, al. 2)'
  return `Rejetée${auSecond}`
}

/** Résultat de chaque résolution : dépouillement de la feuille, majorité requise, second vote immédiat s'il est ouvert. */
export function resultatsResolutions(fiche: Pick<FicheAssemblee, 'id' | 'feuille' | 'resolutions'>): ResultatResolutionFiche[] {
  const votants = membresVotants(fiche.feuille)
  return fiche.resolutions.map((saisie) => {
    let resolution = creerResolution({
      id: `${fiche.id}:${saisie.numero}`,
      agId: fiche.id,
      numero: saisie.numero,
      intitule: saisie.intitule,
      majorite: saisie.majorite,
      travauxArt25f: saisie.travauxArt25f,
    })
    if (!saisie.bulletins) return { resolution, vote: null, libelle: libelleResultat(resolution) }
    const vote = depouiller(fiche.feuille, saisie.bulletins)
    resolution = voterResolution(resolution, vote, { membresVotants: votants })
    if (resolution.etat === 'second_vote')
      resolution = voterSecondVote(resolution, depouiller(fiche.feuille, saisie.bulletinsSecondVote ?? saisie.bulletins))
    return { resolution, vote, libelle: libelleResultat(resolution) }
  })
}

export type ComptagePresence = Record<EtatPresence, { nombre: number; tantiemes: number }>

/** Comptage de la feuille de présence par situation, en nombre de comptes et en tantièmes (avant réduction). */
export function comptagePresence(feuille: readonly LignePresence[]): ComptagePresence {
  const comptage: ComptagePresence = {
    present: { nombre: 0, tantiemes: 0 },
    represente: { nombre: 0, tantiemes: 0 },
    correspondance: { nombre: 0, tantiemes: 0 },
    visio: { nombre: 0, tantiemes: 0 },
    absent: { nombre: 0, tantiemes: 0 },
  }
  for (const ligne of feuille) {
    comptage[ligne.etat].nombre += 1
    comptage[ligne.etat].tantiemes += ligne.tantiemes
  }
  return comptage
}

/** Dernier jour de première présentation de la convocation pour tenir le délai (D. 1967 art. 9 ; 🔴 décompte à confirmer). */
export function limitePresentationConvocation(dateAssemblee: string): string {
  verifierDate(dateAssemblee)
  return ajouterJours(dateAssemblee, -JOURS_PRESENTATION_AVANT_REUNION)
}

/**
 * Échéance de contestation (L. 1965 art. 42 al. 2) depuis la première présentation de la notification du PV : même
 * règle que finDelaiContestationAg (J1), sans report au jour ouvrable.
 */
export function echeanceContestation(premierePresentation: string): { pointDeDepart: string; echeance: string } {
  verifierDate(premierePresentation)
  const pointDeDepart = ajouterJours(premierePresentation, 1)
  return { pointDeDepart, echeance: appliquerDelai(pointDeDepart, DELAI_CONTESTATION_AG_ART42.delai) }
}
