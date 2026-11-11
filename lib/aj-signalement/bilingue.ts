// ── Textes bilingues (FR / PT) écrits clé par clé ─────────────────────────────
//
// Chaque libellé porte côte à côte sa version française et sa version portugaise ({ fr, pt }) : une traduction ne
// peut pas manquer (le type l'exige) et les dictionnaires ne répètent pas deux fois le même arbre de clés.
// parLangue() en tire le jeu de textes complet de chaque langue, dans l'ordre des clés de la table.

import type { LangueSignalementQr } from '@/lib/aj-signalement/types'

/** Une valeur dans chaque langue de la page publique. */
export type Bilingue<T> = Readonly<Record<LangueSignalementQr, T>>

/** Dictionnaire écrit clé par clé : chaque clé porte sa valeur française et sa valeur portugaise. */
export type TableBilingue<T> = { readonly [K in keyof T]: Bilingue<T[K]> }

/** Jeu de textes d'une langue : la valeur de cette langue pour chaque clé, dans l'ordre de la table. */
function textesDeLaLangue<T>(table: TableBilingue<T>, langue: LangueSignalementQr): T {
  const entrees = Object.entries(table) as Array<[string, Bilingue<unknown>]>
  return Object.fromEntries(entrees.map(([cle, valeur]) => [cle, valeur[langue]])) as T
}

/** Les deux jeux de textes (FR et PT) d'une table bilingue. */
export function parLangue<T>(table: TableBilingue<T>): Record<LangueSignalementQr, T> {
  return { fr: textesDeLaLangue(table, 'fr'), pt: textesDeLaLangue(table, 'pt') }
}
