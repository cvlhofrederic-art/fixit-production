// Chemins de l'outillage SEO PT : racine du dépôt, dossier de sortie et résolveur confiné des fichiers lus
// (lot 7 du brief Aikido du 28/10/2026, issue 9). Module sans shebang, importé par pt-audit/index.mjs,
// pt-tests.mjs et les tests (tests/seo/pt-audit-chemins.test.ts).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveInside } from '../../../lib/safe-fs-path.mjs'

/** Racine du dépôt (ce fichier est dans scripts/seo/pt-audit/lib/). */
export const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

/** Dossier de sortie des rapports : seulement écrit par les scripts ; peut être hors du dépôt (ex. --out /tmp/seo). */
export const dossierSortie = (p) => (path.isAbsolute(p) ? p : path.join(RACINE, p))

/** Chemin refusé par fabriquerAbsolu : le CLI n'affiche que son message, sans pile d'appels. */
export class ErreurChemin extends Error {
  constructor(message) {
    super(message)
    this.name = 'ErreurChemin'
  }
}

/**
 * Résolveur des fichiers lus par pt-audit et pt-tests. Un chemin relatif l'est à la racine du dépôt ;
 * relatif ou absolu, il n'est accepté que dans le dépôt ou dans le dossier de sortie `out` (où pt-audit
 * écrit le JSON que pt-tests relit avec --audit, par exemple --out /tmp/seo pour les deux scripts) :
 * un CSV téléchargé ailleurs se copie dans data/seo/. Tout autre chemin (remontée « .. », autre dossier
 * absolu, préfixe trompeur) lève une ErreurChemin qui nomme l'option, le chemin et les dossiers autorisés.
 * @param {string} out dossier de sortie (--out), relatif à la racine du dépôt ou absolu
 * @returns {(p: string, option?: string) => string} chemin absolu normalisé du fichier
 */
export function fabriquerAbsolu(out) {
  const dossiers = [RACINE, dossierSortie(out)]
  const confiner = (dossier, chemin) => {
    try {
      return resolveInside(dossier, chemin)
    } catch {
      return null // hors de ce dossier : le suivant est essayé, puis ErreurChemin si aucun ne convient
    }
  }
  return (p, option = 'fichier') => {
    const chemin = path.resolve(RACINE, p)
    for (const dossier of dossiers) {
      const confine = confiner(dossier, chemin)
      if (confine) return confine
    }
    throw new ErreurChemin(option + ' : « ' + p + ' » est hors des dossiers autorisés (' + dossiers.join(' ou ') + '). Copiez le fichier dans data/seo/ du dépôt, ou passez le --out qui le contient.')
  }
}
