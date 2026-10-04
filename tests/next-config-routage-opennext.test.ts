/**
 * Règles de next.config.ts (rewrites et redirects) rejouées comme en production (OpenNext sur Cloudflare).
 *
 * OpenNext ne compile la destination d'une règle que si la source a capturé au moins un paramètre
 * (handleRewrites, appelé aussi par handleRedirects, dans @opennextjs/aws core/routing/matcher.js). Avec
 * « :path* » vide, la destination reste littérale : /servicos/ répondait « 308 Location: /pt/servicos/:path* »,
 * puis 404. `next start` ne reproduit pas ce défaut. Chaque règle « /:path* » doit donc être précédée d'une
 * règle exacte pour sa racine ; ce test le vérifie sur toutes les règles réelles, présentes et à venir.
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import configurationNext from '@/next.config'

// Même bibliothèque (et même version) que le routeur d'OpenNext : résolue depuis son fichier de routage.
const requireOpenNext = createRequire(createRequire(import.meta.url).resolve('@opennextjs/aws/core/routing/matcher.js'))
const { compile, match } = requireOpenNext('path-to-regexp') as typeof import('path-to-regexp')

type Regle = { source: string; destination: string }
type Genre = 'réécriture' | 'redirection'
type RegleRacine = { genre: Genre; regle: Regle; racineSource: string; racineDestination: string; resolue: string | null }

const RACINE_DEPOT = process.cwd()
const PARAMETRE_FINAL = /\/:path\*\/?$/

async function reecritures(): Promise<Regle[][]> {
  const regles = await configurationNext.rewrites?.()
  if (!regles || Array.isArray(regles)) throw new Error('rewrites() doit renvoyer { beforeFiles, afterFiles, fallback }')
  // OpenNext évalue chaque phase séparément : une règle exacte ne protège que les règles de sa propre phase.
  return [regles.beforeFiles ?? [], regles.afterFiles ?? [], regles.fallback ?? []]
}

async function redirections(): Promise<Regle[]> {
  const regles = await configurationNext.redirects?.()
  if (!regles) throw new Error('redirects() doit renvoyer une liste')
  return regles
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

/**
 * Règles finissant par « /:path* », avec la résolution de leur racine. Le site est en trailingSlash : OpenNext
 * (comme Next) ajoute la barre finale avant d'évaluer les règles, la racine arrive donc toujours avec sa barre.
 */
function reglesRacine(regles: Regle[], genre: Genre): RegleRacine[] {
  return regles
    .filter((regle) => PARAMETRE_FINAL.test(regle.source))
    .map((regle) => {
      const racineSource = `${regle.source.replace(PARAMETRE_FINAL, '')}/`
      const racineDestination = regle.destination.replace(PARAMETRE_FINAL, '')
      return { genre, regle, racineSource, racineDestination, resolue: resoudre(regles, racineSource) }
    })
}

async function toutesLesReglesRacine(): Promise<RegleRacine[]> {
  const phases = await reecritures()
  return [
    ...phases.flatMap((phase) => reglesRacine(phase, 'réécriture')),
    ...reglesRacine(await redirections(), 'redirection'),
  ]
}

function pageExiste(chemin: string): boolean {
  return ['page.tsx', 'page.ts', 'page.jsx', 'page.js'].some((fichier) => existsSync(join(RACINE_DEPOT, 'app', chemin, fichier)))
}

const decrire = ({ genre, racineSource, resolue }: RegleRacine) => `${genre} ${racineSource} → ${resolue}`

describe('racine des règles « /:path* » sous OpenNext', () => {
  it('suppose un site en trailingSlash', () => {
    expect(configurationNext.trailingSlash).toBe(true)
  })

  it('contrôle des règles des deux genres', async () => {
    const genres = (await toutesLesReglesRacine()).map(({ genre }) => genre)
    expect(genres).toContain('réécriture')
    expect(genres).toContain('redirection')
  })

  it('aucune redirection ne renvoie un Location littéral', async () => {
    // L'en-tête Location est public : le littéral est un défaut même quand la destination n'a pas de page racine.
    const fautives = (await toutesLesReglesRacine()).filter(
      ({ genre, resolue }) => genre === 'redirection' && (resolue === null || resolue.includes(':')),
    )
    expect(fautives.map(decrire)).toEqual([])
  })

  it('la racine mène à la page racine de la destination quand elle existe', async () => {
    const fautives = (await toutesLesReglesRacine()).filter(
      ({ racineDestination, resolue }) => pageExiste(racineDestination) && resolue?.replace(/\/$/, '') !== racineDestination,
    )
    expect(fautives.map(decrire)).toEqual([])
  })

  it.each([
    // Pertes constatées en production le 4 octobre 2026 : la page racine de la destination existe.
    ['/servicos/', '/pt/servicos/'],
    ['/urgencia/', '/pt/urgencia/'],
    ['/cidade/', '/pt/cidade/'],
    ['/perto-de-mim/', '/pt/perto-de-mim/'],
    ['/precos/', '/pt/precos/'],
    // Destination sans page racine : même réponse que `next start` (404 propre), sans littéral dans l'URL.
    ['/profissional/', '/pt/profissional/'],
    ['/artisan/', '/fr/artisan/'],
    ['/pt/marches/', '/pt/mercados/'],
  ])('%s redirige vers %s', async (chemin, attendu) => {
    expect(resoudre(await redirections(), chemin)).toBe(attendu)
  })

  it('garde les règles exactes placées avant la règle générique', async () => {
    const regles = await redirections()
    expect(resoudre(regles, '/pt/marches/publier/')).toBe('/pt/mercados/publicar/')
    expect(resoudre(regles, '/pt/marches/gerer/')).toBe('/pt/mercados/gerir/')
  })
})

describe('barre finale des redirections « /:path* »', () => {
  // Sans barre finale dans la destination, chaque ancienne URL coûte un saut 308 de plus :
  // /servicos/canalizador-porto/ → /pt/servicos/canalizador-porto → /pt/servicos/canalizador-porto/.
  it('les sous-chemins arrivent en un seul saut, barre finale comprise', async () => {
    const regles = await redirections()
    const fautives = reglesRacine(regles, 'redirection')
      .map(({ racineSource, racineDestination }) => ({
        chemin: `${racineSource}sous/chemin/`,
        attendu: `${racineDestination}/sous/chemin/`,
        resolue: resoudre(regles, `${racineSource}sous/chemin/`),
      }))
      .filter(({ attendu, resolue }) => resolue !== attendu)
    expect(fautives).toEqual([])
  })

  it.each([
    ['/servicos/canalizador-porto/', '/pt/servicos/canalizador-porto/'],
    ['/urgencia/eletricista-urgente-porto/', '/pt/urgencia/eletricista-urgente-porto/'],
    ['/artisan/dashboard/', '/fr/artisan/dashboard/'],
    // Dernier segment en forme de fichier : la requête arrive sans barre finale, la règle doit encore s'appliquer.
    ['/profissional/joao.silva', '/pt/profissional/joao.silva/'],
  ])('%s redirige vers %s', async (chemin, attendu) => {
    expect(resoudre(await redirections(), chemin)).toBe(attendu)
  })
})
