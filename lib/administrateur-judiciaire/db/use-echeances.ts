'use client'

import { useMemo } from 'react'
import { useCoproprietes } from '@/lib/administrateur-judiciaire/db/hooks'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import {
  calculerEcheancesCopropriete,
  filtrerObligationsEnCours,
  listerEcheancesPortefeuille,
  resultatEcheancesVide,
  type EcheancePortefeuille,
  type ResultatEcheancesMandat,
} from '@/lib/administrateur-judiciaire/domain/echeances-mandat'

/** Échéances légales calculées par le moteur de délais à partir des mandats de la base locale. */

/**
 * Échéances légales du mandat d'une copropriété (par code) : état « chargement », « indisponible » (erreur de la base),
 * « introuvable » (copropriété absente) ou résultat du moteur.
 */
export function useEcheancesMandat(code: string): ResultatEcheancesMandat<CoproprieteVue> {
  const { copros, loading, erreur } = useCoproprietes()
  // Mémorisé sur les données lues : résultat identique au recalcul par rendu de la maquette.
  return useMemo(
    () =>
      loading
        ? resultatEcheancesVide<CoproprieteVue>('chargement')
        : erreur
          ? resultatEcheancesVide<CoproprieteVue>('indisponible')
          : calculerEcheancesCopropriete(copros.find((copro) => copro.code === code)),
    [copros, loading, erreur, code],
  )
}

export interface ResultatEcheancesPortefeuille {
  loading: boolean
  erreur: string | null
  items: EcheancePortefeuille<CoproprieteVue>[]
}

/** Toutes les échéances légales du portefeuille, triées par date retenue (liste vide pendant le chargement ou en erreur). */
export function useEcheancesPortefeuille(): ResultatEcheancesPortefeuille {
  const { copros, loading, erreur } = useCoproprietes()
  return {
    loading,
    erreur: erreur ?? null,
    items: loading || erreur ? [] : listerEcheancesPortefeuille(copros),
  }
}

/** Obligations non accomplies du portefeuille (écran Obligations & échéances). */
export function useObligationsPortefeuille(): ResultatEcheancesPortefeuille {
  const { loading, erreur, items } = useEcheancesPortefeuille()
  return {
    loading,
    erreur,
    items: filtrerObligationsEnCours(items),
  }
}
