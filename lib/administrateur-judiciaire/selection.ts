'use client'

import { creerStore } from '@/lib/administrateur-judiciaire/store'

/**
 * Dossier sélectionné (copropriété et copropriétaire), partagé entre les écrans, la palette de commandes et Fixy.
 * Non persisté.
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
