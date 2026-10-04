/**
 * Réécritures /fr et /pt de la succursale Administrateur Judiciaire (next.config.ts).
 *
 * En production (OpenNext sur Cloudflare), une règle « :path* » dont le paramètre est vide n'est pas compilée :
 * la destination reste littéralement « /administrateur-judiciaire/:path* » et la page répond 404. `next start`
 * ne reproduit pas ce défaut. On rejoue donc ici la résolution d'OpenNext (première règle dont la source
 * correspond ; destination compilée seulement si la source a capturé des paramètres) sur les règles réelles.
 */
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import configurationNext from '@/next.config'

// Même bibliothèque (et même version) que le routeur d'OpenNext : résolue depuis son fichier de routage.
const requireOpenNext = createRequire(createRequire(import.meta.url).resolve('@opennextjs/aws/core/routing/matcher.js'))
const { compile, match } = requireOpenNext('path-to-regexp') as typeof import('path-to-regexp')

type Regle = { source: string; destination: string }

async function reglesAvantFichiers(): Promise<Regle[]> {
  const reecritures = await configurationNext.rewrites?.()
  if (!reecritures || Array.isArray(reecritures)) throw new Error('rewrites() doit renvoyer { beforeFiles }')
  return reecritures.beforeFiles ?? []
}

/** Résolution d'une URL comme le fait handleRewrites d'OpenNext (core/routing/matcher.js). */
function resoudre(regles: Regle[], chemin: string): string | null {
  for (const regle of regles) {
    const correspondance = match(regle.source)(chemin)
    if (!correspondance) continue
    const parametres = correspondance.params as Record<string, unknown>
    return Object.keys(parametres).length > 0 ? compile(regle.destination)(parametres) : regle.destination
  }
  return null
}

describe('réécritures de la racine de la succursale', () => {
  it.each([
    '/fr/administrateur-judiciaire/',
    '/fr/administrateur-judiciaire',
    '/pt/administrateur-judiciaire/',
    '/pt/administrateur-judiciaire',
  ])('%s est servie par la page de la succursale', async (chemin) => {
    // Le site est en trailingSlash : la destination peut porter ou non la barre finale.
    expect(resoudre(await reglesAvantFichiers(), chemin)?.replace(/\/$/, '')).toBe('/administrateur-judiciaire')
  })

  it('ne laisse aucun paramètre non compilé dans la destination', async () => {
    const regles = await reglesAvantFichiers()
    for (const chemin of ['/fr/administrateur-judiciaire/', '/pt/administrateur-judiciaire/']) {
      expect(resoudre(regles, chemin)).not.toContain(':')
    }
  })

  it('garde la règle générique pour les sous-chemins', async () => {
    expect(resoudre(await reglesAvantFichiers(), '/fr/administrateur-judiciaire/inconnu/')).toBe(
      '/administrateur-judiciaire/inconnu',
    )
  })
})
