'use client'

import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/*
 * File des écritures de l'écran « Banque et recouvrement », partagée par l'import du relevé (ImportRelevePanel.tsx), les
 * imputations de « Lignes de relevé » et les étapes de recouvrement (TresorerieModule.tsx). Déplacée telle quelle de
 * TresorerieModule.tsx. Correctifs de défauts hérités de la maquette : écritures concurrentes de l'écran.
 * - Les imputations d'encaissement (manuelles ou de la boucle d'import) et les étapes de recouvrement lisent le solde
 *   ou le dossier dans l'état puis écrivent une valeur absolue : lancées ensemble, la dernière écrasait l'autre
 *   (encaissement absent du solde alors que sa contrepartie 450 existe). Elles passent désormais par une file unique,
 *   chacune démarrant à la fin de la précédente (sans écriture en cours, démarrage immédiat, comme avant).
 * - Une imputation dont l'encaissement a été imputé entre-temps (select changé deux fois de suite, ou ligne imputée à
 *   la main pendant que la boucle d'import allait l'imputer) n'écrit rien : plus de double contrepartie 450.
 * La file est au niveau du module : la boucle d'import continue si l'écran est quitté puis rouvert.
 */
let derniereEcritureTresorerie: Promise<unknown> = Promise.resolve()

/** Exécute l'écriture à la suite des précédentes (qu'elles aient réussi ou échoué). */
export function enFileEcrituresTresorerie<T>(executer: () => Promise<T>): Promise<T> {
  const execution = derniereEcritureTresorerie.then(executer)
  derniereEcritureTresorerie = execution.catch(() => {
    // L'échec est remonté à l'appelant par `execution` ; la file passe à l'écriture suivante.
  })
  return execution
}

/** Vrai si une contrepartie 450-* du journal cite déjà cette écriture de banque (« … relevé <id> »), dans l'état à jour. */
const encaissementDejaImpute = (ecritureId: string): boolean =>
  useDonneesStore
    .getState()
    .ecritures.some(
      (ecriture) =>
        ecriture.compte.startsWith('450-') && (ecriture.libelle.match(/relevé (\S+)$/) || [])[1] === ecritureId,
    )

/**
 * Impute l'encaissement à son tour dans la file des écritures de l'écran. Renvoie false, sans rien écrire, si
 * l'encaissement a été imputé entre-temps.
 */
export const imputerEnFile = (ecritureId: string, coproprietaireId: string): Promise<boolean> =>
  enFileEcrituresTresorerie(async () => {
    if (encaissementDejaImpute(ecritureId)) return false
    await useDonneesStore.getState().imputerEncaissement(ecritureId, coproprietaireId, AUJOURDHUI_ISO)
    return true
  })
