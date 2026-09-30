'use client'

import { useMemo } from 'react'
import { useDonneesLocales } from '@/lib/administrateur-judiciaire/db/hooks'
import {
  construireIndexRecherche,
  type EntreeIndexRecherche,
} from '@/lib/administrateur-judiciaire/domain/recherche'

/**
 * Index de la recherche globale (palette de commandes, Fixy) construit sur les données de la base locale ;
 * vide pendant le chargement ou en cas d'erreur.
 */
export function useIndexRecherche(): EntreeIndexRecherche[] {
  const { loading, erreur, copros, coproprietaires, lots, prestataires } = useDonneesLocales()
  // Mémorisé sur les seules données lues par l'index : résultat identique au recalcul par rendu de la maquette.
  return useMemo(
    () =>
      loading || erreur
        ? []
        : construireIndexRecherche({
            copros,
            coproprietaires,
            lots,
            prestataires,
          }),
    [loading, erreur, copros, coproprietaires, lots, prestataires],
  )
}
