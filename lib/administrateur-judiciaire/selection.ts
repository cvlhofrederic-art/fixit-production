'use client'

import { useCoproParCode, type CoproprieteAffichee } from '@/lib/administrateur-judiciaire/db/hooks'
import { creerStore } from '@/lib/administrateur-judiciaire/store'

/**
 * Dossier sélectionné (copropriété et copropriétaire), partagé entre les écrans, la palette de commandes, Fixy et le
 * sélecteur du haut de page. Non persisté : le Shell pose la copropriété par défaut et mémorise le choix.
 */
export interface EtatSelectionDossier {
  code: string | null
  coproprietaireId: string | null
  choisirCopro: (code: string | null) => void
  choisirPersonne: (coproprietaireId: string | null) => void
}

export const useSelectionDossier = creerStore<EtatSelectionDossier>()((set) => ({
  code: null,
  coproprietaireId: null,
  choisirCopro: (code) =>
    set({
      code,
    }),
  choisirPersonne: (coproprietaireId) =>
    set({
      coproprietaireId,
    }),
}))

/** Code de la copropriété sélectionnée, ou `defaut` (valeur initiale des écrans). */
export const codeCoproSelectionne = (defaut: string): string => useSelectionDossier.getState().code || defaut

/**
 * Code de la copropriété sélectionnée, lu de façon réactive (l'écran suit chaque changement, sans remontage) ;
 * `defaut` tant qu'aucune n'est choisie (écran rendu seul), null sans défaut.
 */
export function useCodeCoproCourant(defaut: string): string
export function useCodeCoproCourant(defaut?: string | null): string | null
export function useCodeCoproCourant(defaut?: string | null): string | null {
  return useSelectionDossier((etat) => etat.code) || defaut || null
}

/**
 * Copropriété sélectionnée (lecture réactive, voir useCodeCoproCourant), résolue par useCoproParCode : sans sélection
 * ni défaut, la première copropriété de démonstration en mode démo, COPRO_VIDE en mode réel.
 */
export function useCoproCourante(defaut?: string | null): CoproprieteAffichee {
  return useCoproParCode(useCodeCoproCourant(defaut))
}
