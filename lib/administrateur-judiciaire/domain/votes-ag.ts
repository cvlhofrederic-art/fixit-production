import { ecartJours, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { VoteAssemblee } from '@/lib/administrateur-judiciaire/domain/majorites-ag'

/**
 * Votes d'assemblée générale (cartographie Gestéam, tranche 31 : onglet Votes — feuille de présence, pouvoirs, comptage
 * en tantièmes et en nombre, « Déd. art. 22 »). Fonctions pures, sans écran.
 *
 * D2 — le votant est le COMPTE copropriétaire (la position sur ses lots), pas l'identité seule.
 *
 * Le droit appliqué :
 * - L. 1965 art. 22 al. 2 : le copropriétaire dont la quote-part excède la moitié voit ses voix réduites à la somme des
 *   voix des autres copropriétaires ;
 * - L. 1965 art. 22 al. 3 : un mandataire reçoit au plus trois délégations, sauf si ses voix et celles de ses mandants
 *   n'excèdent pas 10 % des voix du syndicat ;
 * - D. 1967 art. 9 : convocation notifiée au moins 21 jours avant la réunion, sauf urgence ; délai compté à partir du
 *   lendemain de la première présentation de la lettre recommandée (art. 64), jour de la réunion exclu : décompte
 *   confirmé par Hugo le 30/10/2026 (décision J5 : présentation au plus tard 22 jours avant la réunion).
 * Le calcul de la majorité reste dans majorites-ag.ts : ce module en prépare les entrées.
 */

export type EtatPresence = 'present' | 'represente' | 'correspondance' | 'visio' | 'absent'

export interface LignePresence {
  compteId: string
  tantiemes: number
  etat: EtatPresence
  /** Compte du mandataire, pour un copropriétaire représenté. */
  mandataire: string | null
}

export type Bulletin = 'pour' | 'contre' | 'abstention'

/** Voix de chaque compte après la réduction de l'art. 22 al. 2, et total des voix du syndicat. */
export function voixApresReduction(feuille: LignePresence[]): { voix: Record<string, number>; total: number; reduit: string | null } {
  const brut = feuille.reduce((s, l) => s + l.tantiemes, 0)
  const voix = Object.fromEntries(feuille.map((l) => [l.compteId, l.tantiemes]))
  const majoritaire = feuille.find((l) => l.tantiemes * 2 > brut)
  if (!majoritaire) return { voix, total: brut, reduit: null }
  voix[majoritaire.compteId] = brut - majoritaire.tantiemes
  return { voix, total: 2 * (brut - majoritaire.tantiemes), reduit: majoritaire.compteId }
}

export interface AnomaliePouvoir {
  code: 'mandataire_manquant' | 'mandataire_absent' | 'trop_de_delegations'
  mandataire: string | null
  delegations?: number
  pourcentVoix?: number
  message: string
}

/** Contrôle des délégations de vote (art. 22 al. 3). */
export function controlerPouvoirs(feuille: LignePresence[]): AnomaliePouvoir[] {
  const { voix, total } = voixApresReduction(feuille)
  const anomalies: AnomaliePouvoir[] = []
  const parMandataire = new Map<string, LignePresence[]>()
  for (const l of feuille.filter((x) => x.etat === 'represente')) {
    if (!l.mandataire) {
      anomalies.push({ code: 'mandataire_manquant', mandataire: null, message: `Compte ${l.compteId} représenté sans mandataire désigné.` })
      continue
    }
    parMandataire.set(l.mandataire, [...(parMandataire.get(l.mandataire) ?? []), l])
  }
  for (const [mandataire, mandants] of parMandataire) {
    const ligne = feuille.find((l) => l.compteId === mandataire)
    if (ligne && (ligne.etat === 'absent' || ligne.etat === 'represente'))
      anomalies.push({ code: 'mandataire_absent', mandataire, message: `Le mandataire ${mandataire} n'est pas présent à l'assemblée.` })
    if (mandants.length > 3) {
      const voixCumulees = (voix[mandataire] ?? 0) + mandants.reduce((s, m) => s + (voix[m.compteId] ?? 0), 0)
      const pourcentVoix = Math.round((voixCumulees / total) * 1000) / 10
      if (pourcentVoix > 10)
        anomalies.push({
          code: 'trop_de_delegations',
          mandataire,
          delegations: mandants.length,
          pourcentVoix,
          message: `${mandataire} : ${mandants.length} délégations pour ${pourcentVoix} % des voix (au plus 3, sauf sous 10 %, L. 1965 art. 22).`,
        })
    }
  }
  return anomalies
}

/** Délai de convocation (D. 1967 art. 9) : jours pleins entre le lendemain de la 1re présentation et la veille de la réunion. */
export function controlerConvocation({
  datePremierePresentation,
  dateAssemblee,
  urgence = false,
}: {
  datePremierePresentation: string | null
  dateAssemblee: string
  urgence?: boolean
}): { conforme: boolean | null; joursFrancs: number | null; message: string } {
  if (!estDateIsoValide(dateAssemblee)) throw new Error(`Date d'assemblée invalide (${dateAssemblee}) : AAAA-MM-JJ attendu.`)
  if (!datePremierePresentation)
    return { conforme: null, joursFrancs: null, message: 'Première présentation de la convocation inconnue : délai non vérifiable.' }
  const joursFrancs = ecartJours(datePremierePresentation, dateAssemblee) - 1
  if (joursFrancs >= 21) return { conforme: true, joursFrancs, message: `${joursFrancs} jours entre la convocation et la réunion (21 au moins).` }
  if (urgence) return { conforme: true, joursFrancs, message: `Délai réduit à ${joursFrancs} jours, admis pour urgence : à justifier.` }
  return { conforme: false, joursFrancs, message: `${joursFrancs} jours seulement : 21 jours au moins sont requis (D. 1967 art. 9).` }
}

/**
 * Dépouillement d'une résolution : voix (après réduction de l'art. 22) des comptes votants ; un votant sans bulletin est
 * défaillant (non compté). Renvoie l'entrée de calculerMajoriteAG.
 */
export function depouiller(feuille: LignePresence[], bulletins: Record<string, Bulletin>): VoteAssemblee {
  const { voix, total } = voixApresReduction(feuille)
  const parCompte = new Map(feuille.map((l) => [l.compteId, l]))
  const vote: VoteAssemblee = { voixTotales: total, membresTotaux: feuille.length, pour: 0, contre: 0, abstention: 0, membresPour: 0 }
  for (const [compteId, bulletin] of Object.entries(bulletins)) {
    const ligne = parCompte.get(compteId)
    if (!ligne) throw new Error(`Bulletin d'un compte absent de la feuille de présence : « ${compteId} ».`)
    if (ligne.etat === 'absent') throw new Error(`Le compte ${compteId} est absent : il ne peut pas voter.`)
    vote[bulletin] += voix[compteId]
    if (bulletin === 'pour') vote.membresPour = (vote.membresPour ?? 0) + 1
  }
  return vote
}
