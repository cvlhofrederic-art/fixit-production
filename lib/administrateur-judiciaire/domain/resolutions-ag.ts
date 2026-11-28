import { calculerMajoriteAG, MAJORITES_AG, type TypeMajorite, type VoteAssemblee } from '@/lib/administrateur-judiciaire/domain/majorites-ag'
import type { Bulletin, LignePresence } from '@/lib/administrateur-judiciaire/domain/votes-ag'

/**
 * Résolutions d'assemblée générale : majorité requise, premier et second vote, résultat, amendement, report (point 22
 * du bilan 2 ; cartographie Gestéam, tranche 31 : onglet Votes — Pour, Contre, Abstention, Défaillant ; Majorité par
 * résolution ; boutons Amendement et Reportée). Fonctions pures, sans écran ni table : la résolution stockée (table
 * Resolution de Dexie) attend l'accord de Frédéric.
 *
 * Le droit — 🟢 textes relus sur Légifrance le 29/10/2026 :
 * - pas de quorum en copropriété ; art. 24 : majorité des voix exprimées (abstentions exclues) ; art. 25 : majorité des
 *   voix de tous les copropriétaires ; art. 26 : majorité des membres représentant au moins les deux tiers des voix ;
 *   unanimité : toutes les voix (art. 26, dernier al.) ;
 * - art. 25-1, al. 1 : projet ayant recueilli au moins le tiers des voix de tous les copropriétaires → la même assemblée
 *   se prononce par un second vote immédiat à la majorité de l'art. 24 ; al. 2 (loi n° 2024-322) : sous le tiers, une
 *   nouvelle assemblée, si elle est convoquée dans un délai de trois mois sur un projet identique, peut statuer à la
 *   majorité de l'art. 24, SEULEMENT pour les travaux du f de l'art. 25 (économies d'énergie, réduction des gaz à effet de
 *   serre) ;
 * - art. 26-1 : projet approuvé par au moins la moitié des membres PRÉSENTS, REPRÉSENTÉS OU AYANT VOTÉ PAR
 *   CORRESPONDANCE, représentant au moins le tiers des voix de tous les copropriétaires → second vote immédiat à la
 *   majorité des voix de tous les copropriétaires (art. 25) ; D. 1967 art. 19-1 : pas d'art. 25-1 après ce second vote ;
 * - art. 17-1 A, al. 2 : sur une résolution amendée en cours d'assemblée, le votant par correspondance qui avait voté
 *   pour est assimilé à un défaillant ;
 * - D. 1967 art. 17 : le procès-verbal porte, sous chaque question, le résultat du vote, et les noms et voix des
 *   opposants, des abstentionnistes et des votants assimilés défaillants.
 *
 * 🔵 Déduit : un amendement reste dans la question inscrite et le projet notifié (D. 1967 art. 13 et 11 I 7°) — VitFix
 * n'en contrôle pas le contenu ; les votes « contre » et « abstention » par correspondance restent tels sur une
 * résolution amendée ; le votant par correspondance assimilé défaillant ne compte plus parmi les membres « ayant voté par
 * correspondance » de l'art. 26-1 pour cette résolution.
 * ⚪ Report d'une question : aucun texte ; seul le bouton « Reportée » a été vu dans Gestéam (tranche 31), son effet ne
 * l'a pas été ; le motif du report est un choix de VitFix.
 * 🔴 Non modélisés : la mise en concurrence (D. 1967 art. 19 : second vote après un vote sur chaque candidature) ; le
 * contenu d'un amendement. 🔴 À corriger dans majorites-ag.ts (calculateur affiché à l'écran, textes de la maquette et
 * oracle figés) : sa passerelle de l'art. 25-1 annonce une nouvelle assemblée sous le tiers pour toute décision, et celle
 * de l'art. 26-1 compte la moitié sur tous les membres. Ce module applique le texte en vigueur ; la correction de l'écran
 * attend l'accord de Frédéric.
 */

export const ETATS_RESOLUTION = ['a_voter', 'second_vote', 'adoptee', 'rejetee', 'reportee'] as const
export type EtatResolution = (typeof ETATS_RESOLUTION)[number]

export const LIBELLES_ETATS_RESOLUTION: Record<EtatResolution, string> = {
  a_voter: 'à voter',
  second_vote: 'second vote à tenir',
  adoptee: 'adoptée',
  rejetee: 'rejetée',
  reportee: 'reportée',
}

export interface SaisieResolution {
  id: string
  agId: string
  numero: number
  intitule: string
  /** Majorité requise (Gestéam : « Majorité : Art. … »). */
  majorite: TypeMajorite
  /** Travaux du f de l'art. 25 (économies d'énergie, gaz à effet de serre) : ouvre l'al. 2 de l'art. 25-1. */
  travauxArt25f?: boolean
}

export interface VoteResolution {
  vote: VoteAssemblee
  majorite: TypeMajorite
  adopte: boolean
  detail: string
}

export type SuiteResolution =
  | { code: 'second_vote_immediat'; majorite: 'art24' | 'art25'; fondement: string }
  | { code: 'nouvelle_ag_trois_mois'; majorite: 'art24'; fondement: string }

export interface Resolution extends SaisieResolution {
  etat: EtatResolution
  amendee: boolean
  texteAmende: string | null
  premierVote: VoteResolution | null
  secondVote: VoteResolution | null
  /** Ce que le premier vote ouvre : second vote immédiat, ou nouvelle assemblée (art. 25-1, al. 2). */
  suite: SuiteResolution | null
  motifReport: string | null
}

export function creerResolution(saisie: SaisieResolution): Resolution {
  if (!Number.isInteger(saisie.numero) || saisie.numero < 1)
    throw new Error(`Numéro de résolution invalide (${saisie.numero}) : entier ≥ 1 attendu.`)
  if (!saisie.intitule.trim()) throw new Error('Intitulé de résolution attendu.')
  if (!Object.hasOwn(MAJORITES_AG, saisie.majorite)) throw new Error(`Majorité inconnue : « ${saisie.majorite} ».`)
  return {
    ...saisie,
    intitule: saisie.intitule.replace(/\s+/g, ' ').trim(),
    etat: 'a_voter',
    amendee: false,
    texteAmende: null,
    premierVote: null,
    secondVote: null,
    suite: null,
    motifReport: null,
  }
}

const voterA = (vote: VoteAssemblee, majorite: TypeMajorite): VoteResolution => {
  const resultat = calculerMajoriteAG(vote, majorite)
  return { vote, majorite, adopte: resultat.adopte, detail: resultat.detail }
}

/**
 * Membres présents, représentés, en visioconférence ou ayant voté par correspondance (base de la moitié du 26-1), moins
 * les comptes `exclus` (votants par correspondance assimilés défaillants sur une résolution amendée).
 */
export function membresVotants(feuille: LignePresence[], exclus: readonly string[] = []): number {
  return feuille.filter((l) => l.etat !== 'absent' && !exclus.includes(l.compteId)).length
}

/** Ce qu'ouvre un premier vote manqué (art. 25-1, 26-1), ou null. */
function suiteDuPremierVote(resolution: Resolution, vote: VoteAssemblee, votants: number | undefined): SuiteResolution | null {
  const tiers = vote.pour * 3 >= vote.voixTotales
  if (resolution.majorite === 'art25') {
    if (tiers) return { code: 'second_vote_immediat', majorite: 'art24', fondement: 'L. 1965 art. 25-1, al. 1' }
    return resolution.travauxArt25f ? { code: 'nouvelle_ag_trois_mois', majorite: 'art24', fondement: 'L. 1965 art. 25-1, al. 2' } : null
  }
  if (resolution.majorite === 'art26' && tiers) {
    const pour = vote.membresPour ?? 0
    // Les votants font partie des membres : la moitié atteinte sur tous les membres l'est aussi sur les votants.
    if (pour * 2 >= vote.membresTotaux) return { code: 'second_vote_immediat', majorite: 'art25', fondement: 'L. 1965 art. 26-1' }
    if (votants === undefined)
      throw new Error(
        `Résolution ${resolution.numero} : nombre de membres présents, représentés ou ayant voté par correspondance requis pour l'art. 26-1 (tiers des voix atteint).`,
      )
    return pour * 2 >= votants ? { code: 'second_vote_immediat', majorite: 'art25', fondement: 'L. 1965 art. 26-1' } : null
  }
  return null
}

const exigerEtat = (resolution: Resolution, action: string): void => {
  if (resolution.etat !== 'a_voter')
    throw new Error(`Résolution ${resolution.numero} : ${action} impossible, elle est ${LIBELLES_ETATS_RESOLUTION[resolution.etat]} (seule une résolution à voter le permet).`)
}

/**
 * Premier vote : adoptée à la majorité requise ; sinon second vote immédiat (art. 25-1, 26-1) ou rejet, avec, pour les
 * travaux de l'art. 25 f sous le tiers, la nouvelle assemblée de l'art. 25-1 al. 2. `membresVotants` : base de la moitié
 * du 26-1, exigée quand le tiers des voix est atteint sans la moitié de tous les membres. Renvoie une copie.
 */
export function voterResolution(resolution: Resolution, vote: VoteAssemblee, options: { membresVotants?: number } = {}): Resolution {
  exigerEtat(resolution, 'le vote')
  const votants = options.membresVotants
  if (votants !== undefined && (!Number.isInteger(votants) || votants < (vote.membresPour ?? 0) || votants > vote.membresTotaux))
    throw new Error(
      `Résolution ${resolution.numero} : nombre de membres votants invalide (${votants}) : entier entre les membres pour (${vote.membresPour ?? 0}) et les membres du syndicat (${vote.membresTotaux}).`,
    )
  const premierVote = voterA(vote, resolution.majorite)
  if (premierVote.adopte) return { ...resolution, etat: 'adoptee', premierVote, suite: null }
  const suite = suiteDuPremierVote(resolution, vote, votants)
  return { ...resolution, etat: suite?.code === 'second_vote_immediat' ? 'second_vote' : 'rejetee', premierVote, suite }
}

/** Second vote immédiat, à la majorité qu'ouvre le premier vote ; adoptée ou rejetée, sans autre passerelle. */
export function voterSecondVote(resolution: Resolution, vote: VoteAssemblee): Resolution {
  if (resolution.etat !== 'second_vote' || resolution.suite?.code !== 'second_vote_immediat')
    throw new Error(
      `Résolution ${resolution.numero} : aucun second vote à tenir (elle est ${LIBELLES_ETATS_RESOLUTION[resolution.etat]}).`,
    )
  const secondVote = voterA(vote, resolution.suite.majorite)
  return { ...resolution, etat: secondVote.adopte ? 'adoptee' : 'rejetee', secondVote, suite: null }
}

/** Amendement en séance, avant le vote ; le texte amendé est conservé. Renvoie une copie. */
export function amenderResolution(resolution: Resolution, texteAmende: string): Resolution {
  exigerEtat(resolution, "l'amendement")
  if (!texteAmende.trim()) throw new Error(`Résolution ${resolution.numero} : texte amendé attendu.`)
  return { ...resolution, amendee: true, texteAmende: texteAmende.trim() }
}

/**
 * Bulletins d'une résolution amendée : le « pour » d'un votant par correspondance est retiré (assimilé défaillant, art.
 * 17-1 A al. 2), les autres bulletins restent. Renvoie les bulletins (entrée de votes-ag.depouiller) et les comptes
 * assimilés défaillants (à exclure de membresVotants et à nommer au PV, D. 1967 art. 17).
 */
export function bulletinsApresAmendement(
  feuille: LignePresence[],
  bulletins: Record<string, Bulletin>,
): { bulletins: Record<string, Bulletin>; defaillantsAssimiles: string[] } {
  const parCorrespondance = new Set(feuille.filter((l) => l.etat === 'correspondance').map((l) => l.compteId))
  const defaillantsAssimiles = Object.entries(bulletins)
    .filter(([compteId, b]) => b === 'pour' && parCorrespondance.has(compteId))
    .map(([compteId]) => compteId)
  return {
    bulletins: Object.fromEntries(Object.entries(bulletins).filter(([compteId]) => !defaillantsAssimiles.includes(compteId))),
    defaillantsAssimiles,
  }
}

/** Report de la question (⚪ aucun texte), avec son motif. Renvoie une copie. */
export function reporterResolution(resolution: Resolution, motif: string): Resolution {
  exigerEtat(resolution, 'le report')
  return { ...resolution, etat: 'reportee', motifReport: motif.trim() || null }
}
