// Copie ES module de lib/security/safe-fs-path.ts pour les scripts CLI (scripts/**/*.mjs) : même
// code, mêmes tests (tests/lib/safe-fs-path.test.ts fait tourner la suite sur les deux copies).
// Toute modification se reporte dans les deux fichiers.
import path from 'node:path'

/**
 * Résout `input` par rapport à `root` et exige que le résultat reste dans `root` (la racine
 * elle-même ou un chemin strictement en dessous) ; lève une erreur explicite sinon.
 * Lot 7 du brief Aikido du 28/10/2026, issue 9.
 * @param {string} root dossier autorisé (relatif au dossier courant ou absolu)
 * @param {string} input chemin demandé (relatif à `root`, ou absolu)
 * @returns {string} chemin absolu normalisé, à l'intérieur de `root`
 */
export function resolveInside(root, input) {
  const base = path.resolve(root)
  const target = path.resolve(base, input)
  // La racine d'un système de fichiers (« / », « C:\ ») se termine déjà par le séparateur
  const prefix = base.endsWith(path.sep) ? base : base + path.sep
  if (target !== base && !target.startsWith(prefix)) {
    throw new Error('Chemin hors du dossier autorisé')
  }
  return target
}
