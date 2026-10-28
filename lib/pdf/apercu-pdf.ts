/**
 * Ouverture d'un PDF généré dans le navigateur : aperçu dans un nouvel onglet, ou téléchargement par lien.
 *
 * Lot 6 de l'analyse Sentry du 28/10/2026 (issue Y, « TypeError: Failed to fetch () ») : sur l'aperçu d'un devis
 * BTP, `window.open(url, '_blank')` était remplacé par un script injecté (extension) qui faisait un `fetch()` de
 * l'URL blob ; l'appel rejetait sans que rien ne l'attrape et l'utilisateur ne voyait rien. Un bloqueur de fenêtres
 * fait aussi rendre `null` à `window.open` sans erreur : l'aperçu n'apparaissait pas.
 *
 * Ici : `window.open` sous try/catch ; fenêtre absente, exception, ou valeur de retour qui rejette (window.open
 * remplacé par une fonction asynchrone) → téléchargement par un lien `<a download>` créé et cliqué par le code.
 * Dans tous les cas l'utilisateur obtient son document, et l'URL blob est révoquée après usage.
 */

/** Téléchargement par un lien `<a download>` cliqué par le code. */
export function telechargerParLien(url: string, nomFichier: string): void {
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomFichier
  document.body.appendChild(lien)
  lien.click()
  document.body.removeChild(lien)
}

/** Révocation de l'URL blob : 60 s après un aperçu (le temps que l'onglet charge le PDF), 5 s après un téléchargement. */
export const DELAI_REVOCATION_APERCU_MS = 60_000
export const DELAI_REVOCATION_TELECHARGEMENT_MS = 5_000

export type ResultatApercu = 'apercu' | 'telechargement'

function estThenable(valeur: unknown): valeur is PromiseLike<unknown> {
  return typeof valeur === 'object' && valeur !== null && typeof (valeur as { then?: unknown }).then === 'function'
}

/**
 * Ouvre `fichier` dans un nouvel onglet, ou le télécharge si l'aperçu est impossible. Ne lève jamais.
 * `revoquer` (par défaut `URL.revokeObjectURL`) est appelé après le délai adapté au mode utilisé.
 */
export function ouvrirApercuOuTelecharger(
  fichier: Blob,
  nomFichier: string,
  options: { revoquer?: (url: string) => void; ouvrir?: (url: string) => unknown } = {},
): ResultatApercu {
  const revoquer = options.revoquer ?? ((url: string) => URL.revokeObjectURL(url))
  const ouvrir = options.ouvrir ?? ((url: string) => window.open(url, '_blank'))
  const url = URL.createObjectURL(fichier)

  const replierSurTelechargement = (raison: unknown): ResultatApercu => {
    console.warn('[apercu-pdf] aperçu impossible, téléchargement à la place :', raison instanceof Error ? raison.message : raison)
    try {
      telechargerParLien(url, nomFichier)
    } catch (erreur) {
      console.error('[apercu-pdf] téléchargement impossible :', erreur)
    }
    setTimeout(() => revoquer(url), DELAI_REVOCATION_TELECHARGEMENT_MS)
    return 'telechargement'
  }

  let fenetre: unknown
  try {
    fenetre = ouvrir(url)
  } catch (erreur) {
    return replierSurTelechargement(erreur)
  }
  if (!fenetre) return replierSurTelechargement('fenêtre bloquée (window.open a rendu null)')

  if (estThenable(fenetre)) {
    // window.open remplacé par une fonction asynchrone (extension) : un rejet ne doit pas rester non géré.
    void Promise.resolve(fenetre).then(
      () => undefined,
      (erreur: unknown) => { replierSurTelechargement(erreur) },
    )
  }
  setTimeout(() => revoquer(url), DELAI_REVOCATION_APERCU_MS)
  return 'apercu'
}
