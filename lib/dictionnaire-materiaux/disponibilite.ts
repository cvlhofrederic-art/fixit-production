// Pays pour lesquels un dictionnaire existe. Fichier sans aucune donnée : la barre latérale du
// tableau de bord l'importe pour savoir si le module s'affiche, sans charger le catalogue.
// Garde : tests/dictionnaire-materiaux/donnees.test.ts (même liste que le registre de `index.ts`).

import type { Pays } from './types'

/** Identifiant du module dans le tableau de bord pro (clé `?p=`). */
export const ID_MODULE_DICTIONNAIRE = 'dictionnaire_materiaux'

export const PAYS_AVEC_DICTIONNAIRE: readonly Pays[] = ['PT']

/**
 * Modules du tableau de bord dont la présence dépend de la langue (leur contenu est propre à un pays). Absents de la
 * liste des modules d'une langue, ils n'y sont pas affichés, mais leurs réglages enregistrés (allumé ou éteint, place)
 * sont gardés pour la langue où ils existent.
 */
export const MODULES_SELON_LE_PAYS: ReadonlySet<string> = new Set([ID_MODULE_DICTIONNAIRE])

export function dictionnaireDisponible(pays: Pays): boolean {
  return PAYS_AVEC_DICTIONNAIRE.includes(pays)
}

/** Pays du dictionnaire pour une langue d'interface : même règle que l'estimation des matériaux. */
export function paysDeLaLangue(langue: string): Pays {
  return langue === 'pt' ? 'PT' : 'FR'
}
