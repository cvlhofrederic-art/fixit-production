/**
 * Règles de next.config.ts (rewrites et redirects) rejouées comme en production (OpenNext sur Cloudflare).
 *
 * OpenNext ne compile la destination d'une règle que si la source a capturé au moins un paramètre
 * (handleRewrites, appelé aussi par handleRedirects, dans @opennextjs/aws core/routing/matcher.js). Avec
 * « :path* » vide, la destination reste littérale : /servicos/ répondait « 308 Location: /pt/servicos/:path* »,
 * puis 404. `next start` ne reproduit pas ce défaut. Chaque redirection « /:path* » doit donc être précédée d'une
 * règle exacte pour sa racine (l'en-tête Location est public). Pour une réécriture, le test ne l'exige que si la
 * destination a une page racine ou un segment dynamique ; sinon la racine littérale répond 404, comme sous next start.
 *
 * Ordre en production : redirections → middleware (préfixe de locale forcé) → réécritures beforeFiles → pages.
 * Les gardes génériques ci-dessous vérifient aussi qu'une redirection aboutit sur une page, qu'elle ne masque
 * ni une réécriture ni une page publiée, et que chaque page racine de app/ est servie sous /fr/.
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
type Phase = 'redirect' | 'rewrite'

// Regex du routes-manifest, construite comme au build par Next : OpenNext la teste telle quelle, sans drapeau i.
const { buildCustomRoute } = createRequire(import.meta.url)('next/dist/lib/build-custom-route') as {
  buildCustomRoute: (phase: Phase, regle: Regle, cheminsReserves?: string[]) => { regex: string }
}
const PHASES = new WeakMap<Regle, Phase>()
const REGEX_MANIFESTE = new WeakMap<Regle, RegExp>()
function regexDuManifeste(regle: Regle): RegExp {
  let regex = REGEX_MANIFESTE.get(regle)
  if (!regex) {
    const phase = PHASES.get(regle) ?? 'rewrite'
    regex = new RegExp(buildCustomRoute(phase, regle, phase === 'redirect' ? ['/_next'] : undefined).regex)
    REGEX_MANIFESTE.set(regle, regex)
  }
  return regex
}
type Genre = 'réécriture' | 'redirection'
type RegleRacine = { genre: Genre; regle: Regle; racineSource: string; racineDestination: string; resolue: string | null }

const RACINE_DEPOT = process.cwd()
const PARAMETRE_FINAL = /\/:path\*\/?$/
const FICHIERS_PAGE = ['page.tsx', 'page.ts', 'page.jsx', 'page.js']

async function reecritures(): Promise<Regle[][]> {
  const regles = await configurationNext.rewrites?.()
  if (!regles || Array.isArray(regles)) throw new Error('rewrites() doit renvoyer { beforeFiles, afterFiles, fallback }')
  // OpenNext évalue chaque phase séparément : une règle exacte ne protège que les règles de sa propre phase.
  const phases = [regles.beforeFiles ?? [], regles.afterFiles ?? [], regles.fallback ?? []]
  phases.flat().forEach((regle) => PHASES.set(regle, 'rewrite'))
  return phases
}

async function redirections(): Promise<Regle[]> {
  const regles: Regle[] | undefined = await configurationNext.redirects?.()
  if (!regles) throw new Error('redirects() doit renvoyer une liste')
  regles.forEach((regle) => PHASES.set(regle, 'redirect'))
  return regles
}

/**
 * Résolution d'une URL comme le fait handleRewrites d'OpenNext (core/routing/matcher.js, appelé aussi pour les
 * redirections) : la règle est choisie par la regex du routes-manifest, sensible à la casse ; ses paramètres sont
 * extraits par match() de path-to-regexp, insensible à la casse ; sans paramètre, la destination part telle quelle.
 * La requête (?…) n'entre pas dans la comparaison.
 */
function resoudre(regles: Regle[], chemin: string): string | null {
  const [cheminSeul] = chemin.split('?')
  for (const regle of regles) {
    // Aucune règle conditionnelle (has / missing) aujourd'hui : en ajouter une demande d'étendre ce rejeu.
    if (regle.has?.length || regle.missing?.length) throw new Error(`règle conditionnelle non rejouée : ${regle.source}`)
    if (!regexDuManifeste(regle).test(cheminSeul)) continue
    const correspondance = match(regle.source)(cheminSeul)
    const parametres = (correspondance ? correspondance.params : {}) as Record<string, unknown>
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

function segmentDynamique(chemin: string): boolean {
  const dossier = join(RACINE_DEPOT, 'app', chemin)
  return existsSync(dossier) && readdirSync(dossier).some((nom) => nom.startsWith('['))
}

/** Routes de toutes les pages de app/, segments dynamiques conservés (« /rfq/repondre/[token] »). */
function routesDesPages(dossier = join(RACINE_DEPOT, 'app'), prefixe = ''): string[] {
  const routes = FICHIERS_PAGE.some((fichier) => existsSync(join(dossier, fichier))) ? [prefixe || '/'] : []
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (entree.isDirectory()) routes.push(...routesDesPages(join(dossier, entree.name), `${prefixe}/${entree.name}`))
  }
  return routes
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

  it('aucune racine de réécriture ne tombe en littéral sur une route dynamique', async () => {
    // /fr/tracking/ → « /tracking/:path* » était servi en 200 indexable par app/tracking/[token] (jeton « :path* »).
    const fautives = (await toutesLesReglesRacine()).filter(
      ({ genre, racineDestination, resolue }) => genre === 'réécriture' && !!resolue?.includes(':') && segmentDynamique(racineDestination),
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
        const servie = resoudre(avantFichiers, destination) ?? destination.split('?')[0]
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

  it.each(['/pt/artisan/DASHBOARD/', '/pt/artisan/Dashboard/'])("%s ne part jamais avec un Location littéral", async (chemin) => {
    // OpenNext choisit la règle par la regex du manifeste (sensible à la casse) puis extrait « :slug » sans casse.
    expect(resoudre(await redirections(), chemin) ?? '').not.toContain(':')
  })

  it("ramène vers le tableau de bord les navigateurs qui ont gardé en cache l'ancien 308 vers la fiche", async () => {
    // Le 308 /pt/artisan/dashboard/ → /pt/profissional/dashboard/ partait sans Cache-Control : les navigateurs le
    // gardent indéfiniment. Retour temporaire (jamais mis en cache), avec une requête qui évite l'entrée en cache.
    const regles = await redirections()
    expect(resoudre(regles, '/pt/profissional/dashboard/')).toBe('/pt/artisan/dashboard/?retour=1')
    expect(regles.find(({ source }) => source === '/pt/profissional/dashboard/')).toMatchObject({ permanent: false })
    const [avantFichiers] = await reecritures()
    expect(resoudre(regles, '/pt/artisan/dashboard/?retour=1')).toBeNull()
    expect(sansBarreFinale(resoudre(avantFichiers, '/pt/artisan/dashboard/?retour=1'))).toBe('/artisan/dashboard')
  })
})

describe('anciennes cibles cassées gardées en cache par les navigateurs', () => {
  // Les 308 corrigés partaient sans Cache-Control : un navigateur qui les a suivis retourne directement sur l'ancienne
  // cible. Le littéral « :path* » arrive tel quel (puis avec la barre finale ajoutée par la redirection de barre finale).
  it('chaque ancienne cible littérale « …/:path*/ » mène là où mène la racine', async () => {
    const regles = await redirections()
    const fautives = reglesRacine(regles, 'redirection')
      .map(({ regle, racineSource }) => ({
        litteral: regle.destination.replace(/\/?$/, '/'),
        attendu: resoudre(regles, racineSource),
      }))
      .map(({ litteral, attendu }) => ({ litteral, attendu, obtenu: resoudre(regles, litteral) }))
      .filter(({ attendu, obtenu }) => obtenu !== attendu)
    expect(fautives).toEqual([])
  })

  it('/pt/reservar/ (ancienne cible de /pt/reserver/, jamais créée) mène à la recherche', async () => {
    expect(resoudre(await redirections(), '/pt/reservar/')).toBe('/pt/pesquisar/')
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

describe('pages partagées servies sous /fr et /pt', () => {
  // Le middleware préfixe toute URL par la locale : une page placée à la racine de app/ n'est joignable que par
  // une réécriture /fr/… (et /pt/…). Sans elle, la page RGPD, le parrainage et la réponse fournisseur étaient en 404.
  const EXCEPTIONS: Record<string, string> = {
    '/': "app/page.tsx sert de composant aux pages d'accueil de locale ; « / » est redirigé par le middleware",
    '/simulateur': 'remplacée par /fr/simulateur-devis/ ; ouverture ou suppression à décider',
  }
  const HORS_PERIMETRE = /^\/(fr|pt|en|es|nl|api|admin|coproprietaire|syndic)(\/|$)/ // locales, API, admin sans locale, zones dormantes

  it('toute page racine de app/ est servie sous /fr/', async () => {
    const [avantFichiers] = await reecritures()
    const injoignables = routesDesPages()
      .filter((route) => !HORS_PERIMETRE.test(route) && !(route in EXCEPTIONS))
      .filter((route) => {
        const exemple = route.replace(/\[[^\]]+\]/g, 'exemple')
        return sansBarreFinale(resoudre(avantFichiers, `/fr${exemple}/`)) !== exemple
      })
    expect(injoignables).toEqual([])
  })

  it.each(['/fr/confidentialite/mes-donnees/', '/fr/confidentialite/mes-donnees'])('%s est servie par la page « Mes données »', async (chemin) => {
    const [avantFichiers] = await reecritures()
    expect(pageExiste('/confidentialite/mes-donnees')).toBe(true)
    expect(sansBarreFinale(resoudre(avantFichiers, chemin))).toBe('/confidentialite/mes-donnees')
  })

  it('laisse /fr/confidentialite/ sur la politique de confidentialité', async () => {
    const [avantFichiers] = await reecritures()
    expect(sansBarreFinale(resoudre(avantFichiers, '/fr/confidentialite/'))).toBe('/confidentialite')
  })

  it.each(['/fr/rejoindre/', '/fr/rejoindre', '/pt/rejoindre/', '/pt/rejoindre'])('%s est servie par la page de parrainage', async (chemin) => {
    // Lien des e-mails de parrainage : ${SITE_URL}/rejoindre?ref=CODE (lib/email-referral.ts).
    const [avantFichiers] = await reecritures()
    expect(sansBarreFinale(resoudre(avantFichiers, chemin))).toBe('/rejoindre')
  })

  it.each(['/fr/rfq/repondre/abc123/', '/pt/rfq/repondre/abc123/'])('%s est servie par la page de réponse fournisseur', async (chemin) => {
    // Lien de l'e-mail d'appel d'offres BTP : ${BASE_URL}/rfq/repondre/<jeton> (lib/email-rfq.ts).
    const [avantFichiers] = await reecritures()
    expect(sansBarreFinale(resoudre(avantFichiers, chemin))).toBe('/rfq/repondre/abc123')
    expect(routeExiste('/rfq/repondre/abc123')).toBe(true)
  })

  it('le suivi par jeton est servi, sa racine sans jeton ne reçoit plus le littéral', async () => {
    const [avantFichiers] = await reecritures()
    expect(sansBarreFinale(resoudre(avantFichiers, '/fr/tracking/abc123/'))).toBe('/tracking/abc123')
    expect(resoudre(avantFichiers, '/pt/tracking/abc123/')?.replace(/\/$/, '')).toBe('/tracking/abc123')
    expect(resoudre(avantFichiers, '/fr/tracking/') ?? '').not.toContain(':')
    expect(resoudre(avantFichiers, '/pt/tracking/') ?? '').not.toContain(':')
  })

  it.each([
    ['en', '/rejoindre/', '/rejoindre'],
    ['nl', '/rejoindre/', '/rejoindre'],
    ['es', '/rejoindre/', '/rejoindre'],
    ['en', '/rfq/repondre/abc123/', '/rfq/repondre/abc123'],
    ['es', '/rfq/repondre/abc123/', '/rfq/repondre/abc123'],
    ['en', '/tracking/abc123/', '/tracking/abc123'],
    ['nl', '/tracking/abc123/', '/tracking/abc123'],
  ])('lien e-mail suivi en locale %s : %s est servi par %s', async (locale, chemin, page) => {
    // Le middleware préfixe un lien sans locale par la locale du cookie ou de l'Accept-Language, en/nl/es compris.
    const [avantFichiers] = await reecritures()
    expect(sansBarreFinale(resoudre(avantFichiers, `/${locale}${chemin}`))).toBe(page)
  })

  it('le lien « Avis » du Footer FR mène à une page', () => {
    expect(routeExiste('/fr/avis')).toBe(true)
  })
})
