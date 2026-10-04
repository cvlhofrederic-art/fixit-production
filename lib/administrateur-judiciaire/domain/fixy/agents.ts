import type { EtapeRecouvrement } from '@/lib/administrateur-judiciaire/domain/recouvrement'

/**
 * Agents de Fixy et actions qu'ils proposent. Les actions sont communes à la veille, à la compréhension des demandes
 * et à l'analyse des courriels ; elles ne sont exécutées qu'après un clic (voir useFixy).
 */

/** Agents qui signent les réponses, les rappels et les courriels (« Léa » avec accent : clé exacte de la maquette). */
export type AgentFixy = 'Fixy' | 'Max' | 'Léa' | 'Alfredo' | 'Tempo'

/** Couleur de l'étiquette (Pill) de chaque agent ; les écrans retombent sur « navy » pour un agent inconnu. */
export const COULEUR_PILL_PAR_AGENT: Record<AgentFixy, string> = {
  Fixy: 'gold',
  Max: 'navy',
  Léa: 'sage',
  Alfredo: 'amber',
  Tempo: 'rust',
}

/** Exemples de demandes proposés sous le champ « Demande à Fixy ». */
export const EXEMPLES_DEMANDES_FIXY: string[] = [
  'solde de Garnier',
  'état des comptes des Tilleuls',
  'échéances de Villa Montaigne',
  "qui doit de l'argent",
  'fuite au Clos des Vignes',
  'article 19-2',
  'passe Benali en mise en demeure',
]

interface ActionFixyCommune {
  /** Identifiant stable (« nav:route:code », « acte:cle:code », « rec:id:etape »…) : sert à marquer l'action faite. */
  id: string
  label: string
  /** Effet annoncé (infobulle du bouton, texte du toast après exécution). */
  effet: string
  /** true = l'action écrit dans la base locale (bouton doré, un clic vaut confirmation). */
  ecrit: boolean
}

/** Ouvre un écran ; `code` et `coproprietaireId` sélectionnent le dossier avant la navigation. */
export interface ActionNaviguerFixy extends ActionFixyCommune {
  type: 'naviguer'
  params: {
    route: string
    code?: string
    coproprietaireId?: string
  }
}

/** Ouvre le cockpit sur un modèle d'acte (clé du modèle) pour une copropriété. */
export interface ActionOuvrirActeFixy extends ActionFixyCommune {
  type: 'ouvrirActe'
  params: {
    cle: string
    code: string
  }
}

/** Enregistre une étape du dossier de recouvrement d'un copropriétaire. */
export interface ActionAvancerRecouvrementFixy extends ActionFixyCommune {
  type: 'avancerRecouvrement'
  params: {
    coproprietaireId: string
    etape: EtapeRecouvrement
  }
}

export type ActionFixy = ActionNaviguerFixy | ActionOuvrirActeFixy | ActionAvancerRecouvrementFixy
