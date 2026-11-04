// ── Contrat des écrans du portail copropriétaire ──────────────────────────────
//
// Chaque écran (components/coproprietaire-dashboard/ecrans/*.tsx) reçoit ces props du shell
// (app/(commun)/coproprietaire/dashboard/page.tsx) et ne lit rien d'autre : ni Supabase, ni localStorage
// pour des données (seulement des préférences d'affichage, via les clés ci-dessous).

import type { ChoixVote, DemandeCopro, EspaceCopro, MessageDemande, PrioriteIntervention } from '@/lib/coproprietaire/types'
import type { EcranCopro, LangueCopro, TextesCopro } from '@/lib/coproprietaire/textes'

/** Signalement saisi dans le portail et transmis à l'Administrateur judiciaire par la liaison. */
export interface SaisieSignalementLiaison {
  type: string
  description: string
  priorite: PrioriteIntervention
  partieCommune: boolean
  zone: string
}

/**
 * Actions du portail relié à l'Administrateur judiciaire (vue super admin, source 'aj') : au lieu d'être simulées,
 * elles arrivent dans l'AJ ouvert dans le même navigateur (lib/liaison-copro-aj). Absentes ailleurs.
 */
export interface ActionsLiaisonAj {
  deposerDemande: (saisie: SaisieSignalementLiaison) => DemandeCopro
  /** null si la demande n'existe plus. */
  envoyerMessage: (demandeId: string, texte: string) => MessageDemande | null
  /** null si la résolution n'est pas une résolution de l'AJ. */
  voter: (resolutionId: string, choix: ChoixVote) => { choix: ChoixVote; enregistreLe: string } | null
}

export interface PropsEcran {
  espace: EspaceCopro
  t: TextesCopro
  langue: LangueCopro
  /** Jeton de session pour les actions ; null en démonstration (les actions sont alors simulées localement). */
  jeton: string | null
  /** Ouvre un autre écran ; `cible` permet d'ouvrir directement un élément (ex. une demande) ou le formulaire. */
  allerA: (ecran: EcranCopro, cible?: string) => void
  /** Élément à ouvrir à l'arrivée sur l'écran (id de demande, 'nouvelle' pour le formulaire…). */
  cible?: string
  /** Recharge l'espace après une action (message, vote, signalement). */
  rafraichir: () => Promise<void>
  /** Date du dernier chargement réussi. */
  miseAJourLe: Date
  /** Jour courant de l'espace (démonstration de l'AJ : sa date figée) ; absent : maintenant. */
  aujourdhui?: Date
  /** Actions reliées à l'Administrateur judiciaire (source 'aj') ; absentes ailleurs. */
  liaisonAj?: ActionsLiaisonAj
}

/** Préférences d'affichage conservées dans le navigateur (jamais des données servies). */
export const CLES_PREFERENCES = {
  annoncesLues: 'fixit_copro_pref_annonces_lues',
  accordAssistant: 'fixit_copro_pref_accord_assistant',
  ongletDemandes: 'fixit_copro_pref_onglet_demandes',
} as const
