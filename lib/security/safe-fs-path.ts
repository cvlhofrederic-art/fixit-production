/**
 * Confinement d'un chemin de fichier dans un dossier racine (lot 7 du brief Aikido du 28/10/2026,
 * issue 9 : inclusion de fichier par une lecture dont le chemin dépend d'une entrée externe).
 *
 * `resolveInside(root, input)` résout `input` par rapport à `root` (path.resolve : « . » et « .. »
 * sont réduits, un chemin absolu remplace la racine), puis exige que le résultat soit la racine
 * elle-même ou un chemin strictement en dessous. Le séparateur de la plateforme est ajouté à la
 * racine avant la comparaison, sinon « data2 » passerait pour un enfant de « data ». Toute sortie
 * du dossier lève une erreur explicite : l'appelant n'a jamais à nettoyer l'entrée lui-même.
 *
 * Limite connue : les liens symboliques ne sont pas suivis (pas de realpath), la garantie porte
 * sur le chemin, pas sur ce vers quoi il pointe.
 *
 * Copie ES module pour les scripts CLI : scripts/lib/safe-fs-path.mjs (même code, mêmes tests).
 */
import path from 'node:path'

export function resolveInside(root: string, input: string): string {
  const base = path.resolve(root)
  const target = path.resolve(base, input)
  // La racine d'un système de fichiers (« / », « C:\ ») se termine déjà par le séparateur
  const prefix = base.endsWith(path.sep) ? base : base + path.sep
  if (target !== base && !target.startsWith(prefix)) {
    throw new Error('Chemin hors du dossier autorisé')
  }
  return target
}
