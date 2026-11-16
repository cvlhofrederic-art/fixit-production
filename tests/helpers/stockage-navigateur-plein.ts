// tests/helpers/stockage-navigateur-plein.ts — stockage du navigateur plein, pour les tests sous jsdom.
//
// jsdom range setItem sur Storage.prototype : un espion posé là s'applique à localStorage (affecter
// localStorage.setItem créerait une clé « setItem »). Annulé par vi.restoreAllMocks().

import { vi } from 'vitest'

/** Taille occupée (clés et valeurs, en caractères) d'un stockage, comme la comptent les navigateurs. */
export function tailleStockage(s: Storage): number {
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const cle = s.key(i) ?? ''
    total += cle.length + (s.getItem(cle) ?? '').length
  }
  return total
}

/**
 * Stockage plein à partir de maintenant : toute écriture qui l'agrandirait lève QuotaExceededError (règle des
 * navigateurs) ; la lecture et les réécritures qui ne l'agrandissent pas marchent encore.
 */
export function remplirLeStockage(): void {
  const ecrire = Storage.prototype.setItem
  const quota = tailleStockage(localStorage)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, cle: string, valeur: string) {
    const ancienne = this.getItem(cle)
    const apres = tailleStockage(this) - (ancienne === null ? 0 : cle.length + ancienne.length) + cle.length + String(valeur).length
    if (apres > quota) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    ecrire.call(this, cle, valeur)
  })
}
