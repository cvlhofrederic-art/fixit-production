/**
 * Règles de next.config.ts (rewrites et redirects) rejouées comme en production (OpenNext sur Cloudflare).
 *
 * OpenNext ne compile la destination d'une règle que si la source a capturé au moins un paramètre
 * (handleRewrites, appelé aussi par handleRedirects, dans @opennextjs/aws core/routing/matcher.js). Avec
 * « :path* » vide, la destination reste littérale : /servicos/ répondait « 308 Location: /pt/servicos/:path* »,
 * puis 404. `next start` ne reproduit pas ce défaut. Chaque règle « /:path* » doit donc être précédée d'une
 * règle exacte pour sa racine ; ce test le vérifie sur toutes les règles réelles, présentes et à venir.
 *
 * Ordre en production : redirections → middleware (préfixe de locale forcé) → réécritures beforeFiles → pages.
 * Les gardes génériques ci-dessous vérifient aussi qu'une redirection aboutit sur une page, qu'elle ne masque
 * ni une réécriture ni une page publiée.
 */
import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import configurationNext from '@/next.config'
import { getAllFrPageCombos, getAllFrUrgencyCombos } from '@/lib/data/fr-seo-pages-data'
import { getAllPtSitemapUrls } from '@/lib/sitemap-pt-pages'

// Même bibliothèque (et même version) que le routeur d'OpenNext : résolue depuis son fichier de routage.
const requireOpenNext = createRequire(createRequire(import.meta.url).resolve('@opennextjs/aws/core/routing/matcher.js'))
const { compile, match } = requireOpenNext('path-to-regexp') as typeof import('path-to-regexp')

type Regle = { source: string; destination: string; has?: unknown[]; missing?: unknown[] }
type Genre = 'réécriture' | 'redirection'
type RegleRacine = { genre: Genre; regle: Regle; racineSource: string; racineDestination: string; resolue: string | null }

const RACINE_DEPOT = process.cwd()
const PARAMETRE_FINAL = /\/:path\*\/?$/
const FICHIERS_PAGE = ['page.tsx', 'page.ts', 'page.jsx', 'page.js']

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
    // Aucune règle conditionnelle (has / missing) aujourd'hui : en ajouter une demande d'étendre ce rejeu.
    if (regle.has?.length || regle.missing?.length) throw new Error(`règle conditionnelle non rejouée : ${regle.source}`)
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
  return FICHIERS_PAGE.some((fichier) => existsSync(join(RACINE_DEPOT, 'app', chemin, fichier)))
}

/** Une page de app/ sert-elle ce chemin, segments dynamiques [param] compris ? (pas de groupe ni de catch-all dans app/) */
function routeExiste(chemin: string): boolean {
  const parcourir = (dossier: string, segments: string[]): boolean => {
    if (!segments.length) return FICHIERS_PAGE.some((fichier) => existsSync(join(dossier, fichier)))
    const [tete, ...suite] = segments
    if (existsSync(join(dossier, tete)) && parcourir(join(dossier, tete), suite)) return true
    const dynamiques = existsSync(dossier) ? readdirSync(dossier).filter((nom) => nom.startsWith('[')) : []
    return dynamiques.some((nom) => parcourir(join(dossier, nom), suite))
  }
  return parcourir(join(RACINE_DEPOT, 'app'), chemin.split('/').filter(Boolean))
}

const decrire = ({ genre, racineSource, resolue }: RegleRacine) => `${genre} ${racineSource} → ${resolue}`
const sansBarreFinale = (chemin: string | null | undefined) => chemin?.replace(/\/$/, '')

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
      ({ racineDestination, resolue }) => pageExiste(racineDestination) && sansBarreFinale(resolue) !== racineDestination,
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
    // Destination sans page racine : page parente la plus proche, en un seul saut.
    ['/profissional/', '/pt/pesquisar/'],
    ['/artisan/', '/fr/recherche/'],
    ['/pt/marches/', '/pt/mercados/publicar/'],
  ])('%s redirige vers %s', async (chemin, attendu) => {
    expect(resoudre(await redirections(), chemin)).toBe(attendu)
    expect(routeExiste(attendu)).toBe(true)
  })

  it.each([
    // Racines de locale sans page (seulement [id] ou des sous-pages) : 404 en production jusqu'ici.
    ['/pt/profissional/', '/pt/pesquisar/'],
    ['/fr/artisan/', '/fr/recherche/'],
    ['/pt/mercados/', '/pt/mercados/publicar/'],
    ['/fr/marches/', '/fr/marches/publier/'],
  ])('racine sans page %s redirige vers %s', async (chemin, attendu) => {
    expect(resoudre(await redirections(), chemin)).toBe(attendu)
    expect(routeExiste(attendu)).toBe(true)
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

describe('aboutissement des redirections', () => {
  it('toute redirection sans paramètre aboutit sur une page, en un seul saut', async () => {
    const regles = await redirections()
    const [avantFichiers] = await reecritures()
    const fautives = regles
      .filter(({ destination }) => destination.startsWith('/') && !destination.includes(':'))
      .flatMap(({ source, destination }) => {
        const enchainee = resoudre(regles, destination)
        if (enchainee !== null) return [`${source} → ${destination} → ${enchainee} (deux sauts)`]
        const servie = resoudre(avantFichiers, destination) ?? destination
        return routeExiste(servie) ? [] : [`${source} → ${destination} (aucune page)`]
      })
    expect(fautives).toEqual([])
  })

  it("/pt/reserver/ mène à la recherche (aucune page /pt/reservar/ n'a jamais existé)", async () => {
    expect(resoudre(await redirections(), '/pt/reserver/')).toBe('/pt/pesquisar/')
  })

  it('les sources sont écrites telles que le chemin arrive : encodé', async () => {
    // « /mês/ » ne se déclenchait jamais : navigateurs et robots envoient /m%C3%AAs/, comparé tel quel à la regex.
    const nonAscii = (await redirections()).map(({ source }) => source).filter((source) => /[^\x20-\x7e]/.test(source))
    expect(nonAscii).toEqual([])
    expect(resoudre(await redirections(), '/m%C3%AAs/')).toBe('/pt/')
  })
})

describe('redirections et réécritures beforeFiles', () => {
  // Les redirections passent avant les réécritures (OpenNext comme Next) : une redirection qui capte la source
  // d'une réécriture la rend inopérante. /pt/artisan/dashboard/ partait ainsi vers la fiche /pt/profissional/dashboard/.
  it("aucune redirection ne capte la source exacte d'une réécriture", async () => {
    const [avantFichiers] = await reecritures()
    const regles = await redirections()
    const masquees = avantFichiers
      .map(({ source }) => source)
      .filter((source) => !source.includes(':') && source.endsWith('/'))
      .filter((source) => resoudre(regles, source) !== null)
    expect(masquees).toEqual([])
  })

  it('le tableau de bord artisan PT est servi, les anciennes fiches /pt/artisan/ restent redirigées', async () => {
    const [avantFichiers] = await reecritures()
    const regles = await redirections()
    expect(resoudre(regles, '/pt/artisan/dashboard/')).toBeNull()
    expect(sansBarreFinale(resoudre(avantFichiers, '/pt/artisan/dashboard/'))).toBe('/artisan/dashboard')
    expect(resoudre(regles, '/pt/artisan/joao-silva/')).toBe('/pt/profissional/joao-silva/')
    expect(resoudre(regles, '/pt/artisan/dashboard-joao/')).toBe('/pt/profissional/dashboard-joao/')
  })
})

describe('pages publiées jamais masquées par une redirection', () => {
  // /fr/services/debouchage-canalisation-<ville>/ (19 pages du sitemap) et /pt/perto-de-mim/picheleiro/ étaient
  // redirigées alors que la page existe, est générée et figure au sitemap.
  it("aucune URL programmatique (sitemap PT, services et urgences FR) n'est captée", async () => {
    const regles = await redirections()
    const urls = [
      ...getAllPtSitemapUrls('').map(({ url }) => url),
      ...getAllFrPageCombos().map(({ slug }) => `/fr/services/${slug}/`),
      ...getAllFrUrgencyCombos().map(({ slug }) => `/fr/urgence/${slug}/`),
    ]
    expect(urls.length).toBeGreaterThan(1000)
    expect(urls.filter((url) => resoudre(regles, url) !== null)).toEqual([])
  })
})

describe('pages partagées servies sous /fr', () => {
  // Le middleware préfixe toute URL par la locale : sans réécriture, la page RGPD « Mes données »
  // (app/confidentialite/mes-donnees) répondait 404 pour un visiteur français.
  it.each(['/fr/confidentialite/mes-donnees/', '/fr/confidentialite/mes-donnees'])('%s est servie par la page « Mes données »', async (chemin) => {
    const [avantFichiers] = await reecritures()
    expect(pageExiste('/confidentialite/mes-donnees')).toBe(true)
    expect(sansBarreFinale(resoudre(avantFichiers, chemin))).toBe('/confidentialite/mes-donnees')
  })

  it('laisse /fr/confidentialite/ sur la politique de confidentialité', async () => {
    const [avantFichiers] = await reecritures()
    expect(sansBarreFinale(resoudre(avantFichiers, '/fr/confidentialite/'))).toBe('/confidentialite')
  })
})
