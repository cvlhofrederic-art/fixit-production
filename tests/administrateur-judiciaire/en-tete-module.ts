import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Ramène les retours à la ligne d'un commentaire à une espace : une phrase coupée se lit d'un tenant. */
const aplatir = (texte: string): string => texte.replaceAll(/\n \*\s+/g, ' ')

/**
 * En-tête (premier commentaire) d'un module de lib/administrateur-judiciaire/domain, pour vérifier les textes cités et
 * la rédaction des questions ouvertes. `item` rend un point de liste, de son début donné au point suivant ou à la ligne
 * « * » vide suivante.
 */
export function enTeteDuModule(module: string): { texte: string; item: (debut: string) => string } {
  const chemin = join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', `${module}.ts`)
  const source = readFileSync(chemin, 'utf8').replaceAll('\r\n', '\n')
  const enTete = source.slice(0, source.indexOf('\n */'))
  const item = (debut: string): string => {
    const i = enTete.indexOf(debut)
    if (i < 0) throw new Error(`En-tête de ${module} : « ${debut} » introuvable.`)
    const bornes = ['\n * - ', '\n *\n'].map((borne) => enTete.indexOf(borne, i + debut.length)).filter((j) => j >= 0)
    return aplatir(enTete.slice(i, Math.min(enTete.length, ...bornes)))
  }
  return { texte: aplatir(enTete), item }
}
