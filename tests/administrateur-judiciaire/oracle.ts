/**
 * Rejeu des fixtures « oracle » : chaque cas a été exécuté sur la maquette d'origine (résultat attendu),
 * puis est rejoué ici sur la fonction portée. La maquette fait foi : un écart signale une erreur de portage.
 */
import { expect, it } from 'vitest'

export interface CasOracle {
  id: string
  fn: string
  args: unknown[]
  sortie: 'valeur' | 'getTime' | 'erreur'
  attendu: unknown
}

type Fonction = (...args: unknown[]) => unknown

/** Recrée les valeurs spéciales des arguments : {"$date":[…]} → Date locale, {"$undefined":true} → undefined. */
export function revivre(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(revivre)
  if (valeur && typeof valeur === 'object') {
    const objet = valeur as Record<string, unknown>
    if ('$date' in objet) return new Date(...(objet.$date as [number, number, number]))
    if ('$undefined' in objet) return undefined
    return Object.fromEntries(Object.entries(objet).map(([k, v]) => [k, revivre(v)]))
  }
  return valeur
}

/** Normalise comme la sérialisation JSON de l'oracle (undefined → null, Date → chaîne ISO…). */
function commeJson(valeur: unknown): unknown {
  return valeur === undefined ? null : JSON.parse(JSON.stringify(valeur, (_k, v: unknown) => (v === undefined ? null : v)) ?? 'null')
}

export function executerCas(module: Record<string, unknown>, c: CasOracle): unknown {
  const fonction = module[c.fn]
  if (typeof fonction !== 'function') throw new Error(`Fonction portée introuvable : ${c.fn}`)
  const args = revivre(c.args) as unknown[]
  if (c.sortie === 'erreur') {
    try {
      ;(fonction as Fonction)(...args)
      return '__PAS_D_ERREUR__'
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }
  const resultat = (fonction as Fonction)(...args)
  if (c.sortie === 'getTime') return resultat instanceof Date ? resultat.getTime() : commeJson(resultat)
  return commeJson(resultat)
}

/** Déclare un test vitest par cas de la fixture. */
export function rejouerOracle(module: Record<string, unknown>, cas: CasOracle[]): void {
  for (const c of cas) {
    it(`${c.id} — ${c.fn}`, () => {
      expect(executerCas(module, c)).toEqual(c.attendu)
    })
  }
}
