/**
 * Accès sûrs au stockage du navigateur (localStorage, sessionStorage).
 *
 * Un navigateur qui bloque les données du site (réglage Chrome « bloquer les cookies et données de site »,
 * navigation privée stricte sur iOS, iframe sandboxée, certaines webviews) lève une SecurityError à la simple
 * lecture de `window.localStorage` : Sentry VITFIX-PRODUCTION-T, G et S (« Failed to read the 'localStorage'
 * property from 'Window' », « The operation is insecure »). Un stockage plein ou en lecture seule fait échouer
 * `setItem` (QuotaExceededError). Ces fonctions ne lèvent jamais ; la disponibilité est sondée une fois par type
 * (écriture puis suppression d'une clé de test) et mise en cache pour la page.
 */
export type TypeStockage = 'local' | 'session'

const CLE_SONDE = '__vitfix_sonde_stockage__'
const disponibilite: Partial<Record<TypeStockage, boolean>> = {}

function stockage(type: TypeStockage): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    const s = type === 'local' ? window.localStorage : window.sessionStorage
    return s ?? null
  } catch {
    // La lecture de la propriété elle-même lève quand le stockage du site est bloqué.
    return null
  }
}

/** true si le stockage est lisible ET inscriptible ; résultat mis en cache par type. */
export function isStorageAvailable(type: TypeStockage = 'local'): boolean {
  const connu = disponibilite[type]
  if (connu !== undefined) return connu
  let dispo = false
  try {
    const s = stockage(type)
    if (s) {
      s.setItem(CLE_SONDE, '1')
      s.removeItem(CLE_SONDE)
      dispo = true
    }
  } catch {
    dispo = false
  }
  disponibilite[type] = dispo
  return dispo
}

/** Valeur de la clé, ou null (absente, stockage bloqué ou illisible). Ne lève jamais. */
export function safeGet(cle: string, type: TypeStockage = 'local'): string | null {
  try {
    return stockage(type)?.getItem(cle) ?? null
  } catch {
    return null
  }
}

/** Écrit la clé ; false si le stockage est bloqué, plein ou en lecture seule. Ne lève jamais. */
export function safeSet(cle: string, valeur: string, type: TypeStockage = 'local'): boolean {
  try {
    const s = stockage(type)
    if (!s) return false
    s.setItem(cle, valeur)
    return true
  } catch {
    return false
  }
}

/** Supprime la clé ; false si le stockage est bloqué. Ne lève jamais. */
export function safeRemove(cle: string, type: TypeStockage = 'local'): boolean {
  try {
    const s = stockage(type)
    if (!s) return false
    s.removeItem(cle)
    return true
  } catch {
    return false
  }
}

/** Tests : oublie le résultat des sondes de disponibilité. */
export function reinitialiserSondesStockage(): void {
  delete disponibilite.local
  delete disponibilite.session
}
