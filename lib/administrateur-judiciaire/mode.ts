/**
 * Mode de fonctionnement de la succursale : démonstration (date figée, jeu de données de démo)
 * ou données réelles (date du jour, base locale vide au départ).
 *
 * Les constantes sont évaluées au chargement du module, comme dans la maquette : l'application
 * n'est chargée que dans le navigateur (next/dynamic ssr:false) et un changement de mode
 * recharge toujours la page, donc ces valeurs restent fixes pendant toute la session.
 */
export type Mode = 'demo' | 'reel'

export const CLE_STOCKAGE_MODE = 'vitfix.aj.mode'

/** Date figée de la démonstration. */
export const DATE_DEMO_ISO = '2026-06-04'

export function lireModeStocke(): Mode {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(CLE_STOCKAGE_MODE) === 'reel') return 'reel'
  } catch {
    // localStorage inaccessible (navigation privée, stockage bloqué) : on reste en démonstration.
  }
  return 'demo'
}

export function enregistrerMode(mode: Mode): void {
  try {
    localStorage.setItem(CLE_STOCKAGE_MODE, mode)
  } catch {
    // localStorage inaccessible : le mode ne sera pas conservé au rechargement.
  }
}

/** Date locale au format AAAA-MM-JJ (sans contrôle de validité). */
export const dateLocaleIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const MODE_ACTIF: Mode = lireModeStocke()

/**
 * Jour courant (AAAA-MM-JJ) pour un mode donné : date figée en démonstration, jour local de `maintenant` sinon.
 * Fonction pure : la date système est injectée, jamais lue ici.
 */
export const calculerDateDuJourIso = (mode: Mode, maintenant: Date): string =>
  mode === 'demo' ? DATE_DEMO_ISO : dateLocaleIso(maintenant)

/** Jour courant de l'application (AAAA-MM-JJ) : date figée en démonstration, date réelle sinon. */
export const DATE_DU_JOUR_ISO: string = calculerDateDuJourIso(MODE_ACTIF, new Date())

/** Jour courant à minuit UTC (une chaîne AAAA-MM-JJ est interprétée en UTC). */
export const AUJOURDHUI: Date = new Date(DATE_DU_JOUR_ISO)

export const AUJOURDHUI_ISO: string = AUJOURDHUI.toISOString().slice(0, 10)
