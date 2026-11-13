// @vitest-environment node
/**
 * Réécritures beforeFiles de next.config.ts rejouées par les DEUX moteurs, chacun avec ses propres fonctions.
 *
 * - `next start` et `next dev` (CI E2E, poste) : server/lib/router-utils/resolve-routes.js parcourt TOUTES les règles
 *   beforeFiles, dans l'ordre, et teste chacune sur le chemin DÉJÀ RÉÉCRIT par les précédentes. Elles sont construites
 *   par buildCustomRoute('before_files_rewrite') (router-utils/filesystem.js), qui ne pose pas « check: true » : le
 *   disque n'est consulté qu'après la dernière. Correspondance insensible à la casse, barre finale facultative.
 * - OpenNext (production Cloudflare) : handleRewrites (@opennextjs/aws core/routing/matcher.js) n'applique que la
 *   PREMIÈRE règle dont la regex du routes-manifest correspond (sensible à la casse).
 *
 * Défaut gardé (PR 2) : placées en FIN de beforeFiles, les règles du chemin d'un cabinet (« /:identifiant(…)/connexion »…)
 * captaient sous next start le chemin INTERNE produit par une règle de langue : /fr/aj-signalement/connexion/ →
 * /aj-signalement/connexion → /cabinet/aj-signalement/connexion, identifiant réservé, 404. De même
 * /<langue>/tracking/connexion/, /<langue>/auth/invitation/… La production (première règle seulement) servait la bonne
 * page : seule la CI E2E voyait le défaut. Le middleware n'y peut rien : il ne voit que le chemin d'origine.
 *
 * Contrat, pour chaque page de app/ (à son adresse publique, chaque segment dynamique valant aussi chaque mot d'un
 * chemin de cabinet) et pour la grille /<langue>/<premier segment>/<mot de cabinet>/ :
 *   1. un chemin qui n'est pas une adresse de cabinet reconnue par le middleware (sur le chemin d'ORIGINE) est servi,
 *      dans chaque moteur, comme si les règles de cabinet n'existaient pas : jamais par /cabinet/… ;
 *   2. les deux moteurs servent la même page ;
 *   3. une adresse de cabinet reconnue par le middleware est servie par sa page interne dans les deux moteurs ;
 *   4. en production (première règle), la place des règles de cabinet dans la liste est sans effet.
 */
import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import configurationNext from '@/next.config'
import {
  IDENTIFIANTS_RESERVES_QR, SEGMENTS_CABINET_QR, cheminEspaceCabinetQr, cheminPublicCabinetQr,
} from '@/lib/aj-signalement/chemin-cabinet'

type Regle = { source: string; destination: string; has?: unknown[]; missing?: unknown[] }
type Parametres = Record<string, string | string[]>
type RouteDeNext = Regle & { match: (chemin: string) => Parametres | false; check?: boolean }
type Servir = (chemin: string) => string

const requireDepot = createRequire(import.meta.url)
// Next : les fonctions mêmes de `next start` et `next dev`.
const { buildCustomRoute: routeDeNext } = requireDepot('next/dist/server/lib/router-utils/filesystem') as {
  buildCustomRoute: (type: 'before_files_rewrite', regle: Regle) => RouteDeNext
}
const { prepareDestination } = requireDepot('next/dist/shared/lib/router/utils/prepare-destination') as {
  prepareDestination: (options: {
    appendParamsToQuery: boolean; destination: string; params: Parametres; query: Record<string, string>
  }) => { parsedDestination: { pathname: string } }
}
// OpenNext : regex du routes-manifest (construite comme au build) et path-to-regexp de son propre routeur.
const { buildCustomRoute: routeDuManifeste } = requireDepot('next/dist/lib/build-custom-route') as {
  buildCustomRoute: (type: 'rewrite', regle: Regle) => { regex: string }
}
const requireOpenNext = createRequire(requireDepot.resolve('@opennextjs/aws/core/routing/matcher.js'))
const { compile, match } = requireOpenNext('path-to-regexp') as typeof import('path-to-regexp')

const sansBarreFinale = (chemin: string): string => chemin.replace(/(.)\/$/, '$1')

async function reglesAvantFichiers(): Promise<Regle[]> {
  const reecritures = await configurationNext.rewrites?.()
  if (!reecritures || Array.isArray(reecritures)) throw new Error('rewrites() doit renvoyer { beforeFiles, afterFiles, fallback }')
  const regles = (reecritures.beforeFiles ?? []) as Regle[]
  // Aucune règle conditionnelle (has / missing) aujourd'hui : en ajouter une demande d'étendre ce rejeu.
  for (const regle of regles) {
    if (regle.has?.length || regle.missing?.length) throw new Error(`règle conditionnelle non rejouée : ${regle.source}`)
  }
  return regles
}

const estRegleDeCabinet = (regle: Regle): boolean => regle.destination.startsWith('/cabinet/')

/** next start / next dev : toutes les règles, chacune sur le chemin déjà réécrit (resolve-routes.js, handleRoute). */
function servirParNext(regles: readonly Regle[]): Servir {
  const routes = regles.map((regle) => routeDeNext('before_files_rewrite', regle))
  return (chemin) => {
    let courant = chemin
    for (const route of routes) {
      const parametres = route.match(courant)
      if (!parametres) continue
      courant = prepareDestination({ appendParamsToQuery: true, destination: route.destination, params: parametres, query: {} })
        .parsedDestination.pathname
    }
    return sansBarreFinale(courant)
  }
}

/** OpenNext : la première règle dont la regex du manifeste correspond ; destination compilée si la source a capturé. */
function servirParOpenNext(regles: readonly Regle[]): Servir {
  const routes = regles.map((regle) => ({ regle, regex: new RegExp(routeDuManifeste('rewrite', regle).regex) }))
  return (chemin) => {
    const trouvee = routes.find(({ regex }) => regex.test(chemin))
    if (!trouvee) return sansBarreFinale(chemin)
    const correspondance = match(trouvee.regle.source)(chemin)
    const parametres = (correspondance ? correspondance.params : {}) as Record<string, unknown>
    const destination = Object.keys(parametres).length > 0 ? compile(trouvee.regle.destination)(parametres) : trouvee.regle.destination
    return sansBarreFinale(destination)
  }
}

// ── Chemins rejoués ──

const LANGUES = ['fr', 'pt', 'en', 'nl', 'es']
const JETON = '0123456789abcdef0123456789abcdef'
/** Ce qui suit l'identifiant dans un chemin de cabinet (« signalement » exige son jeton). */
const MOTS_CABINET = SEGMENTS_CABINET_QR.map((mot) => (mot === 'signalement' ? `signalement/${JETON}` : mot))
/** Valeurs données aux segments dynamiques d'une page : une valeur neutre, chaque mot d'un chemin de cabinet, un jeton. */
const VALEURS_DYNAMIQUES = ['exemple', ...SEGMENTS_CABINET_QR, JETON]

const APP = join(process.cwd(), 'app')
const estGroupe = (nom: string): boolean => nom.startsWith('(') && nom.endsWith(')')
/** Dossiers privés (_x) et emplacements parallèles (@x) : jamais un segment d'URL. */
const estHorsUrl = (nom: string): boolean => nom.startsWith('_') || nom.startsWith('@')
const estDynamique = (nom: string): boolean => nom.startsWith('[')

/** Routes de toutes les pages de app/ en segments d'URL (groupes de routes omis, segments dynamiques conservés). */
function routesDesPages(dossier = APP, segments: string[] = []): string[][] {
  const entrees = readdirSync(dossier, { withFileTypes: true })
  const routes = entrees.some((e) => e.isFile() && /^page\.(tsx|ts|jsx|js)$/.test(e.name)) ? [segments] : []
  for (const e of entrees) {
    if (!e.isDirectory() || estHorsUrl(e.name)) continue
    routes.push(...routesDesPages(join(dossier, e.name), estGroupe(e.name) ? segments : [...segments, e.name]))
  }
  return routes
}

const enChemin = (segments: readonly string[]): string => (segments.length ? `/${segments.join('/')}/` : '/')

/**
 * Adresses publiques d'une page, telles qu'elles arrivent aux réécritures : une page de langue à son chemin ; une page
 * commune (app/(commun)/…) sous chaque langue (le middleware préfixe tout le reste) ; /admin/… aussi sans langue (le
 * middleware le laisse passer). Chaque segment dynamique prend tour à tour chaque valeur de VALEURS_DYNAMIQUES.
 */
function adressesDeLaPage(route: readonly string[]): string[] {
  const formes = LANGUES.includes(route[0]) ? [route] : [
    ...LANGUES.map((langue) => [langue, ...route]),
    ...(route[0] === 'admin' ? [route] : []),
  ]
  if (!route.some(estDynamique)) return formes.map(enChemin)
  return formes.flatMap((forme) => VALEURS_DYNAMIQUES.flatMap((valeur) => {
    const avec = forme.map((segment) => (estDynamique(segment) ? valeur : segment))
    // Attrape-tout facultatif ([[...x]]) : aussi vide.
    const vide = forme.some((segment) => segment.startsWith('[[')) ? [forme.filter((segment) => !segment.startsWith('[['))] : []
    return [avec, ...vide].map(enChemin)
  }))
}

/**
 * Sources des règles hors cabinet, paramètres remplacés (« :locale(en|nl|es) » par chacune de ses langues, un autre
 * paramètre par chaque valeur de VALEURS_DYNAMIQUES, « :x* » aussi vide) : adresses servies sans page à leur nom
 * (/pt/contacto/ → /contact).
 */
function adressesDesSources(regles: readonly Regle[]): string[] {
  return regles.filter((regle) => !estRegleDeCabinet(regle)).flatMap(({ source }) => adressesDeLaSource(source))
}

/** Valeurs d'un segment de source : littéral tel quel, alternatives, valeurs dynamiques (et vide pour « :x* »). */
function valeursDuSegment(segment: string): string[] {
  const alternatives = /^:\w+\(([a-z|]+)\)$/.exec(segment)
  if (alternatives) return alternatives[1].split('|')
  if (/^:\w+\*$/.test(segment)) return ['', ...VALEURS_DYNAMIQUES]
  return segment.startsWith(':') ? VALEURS_DYNAMIQUES : [segment]
}

function adressesDeLaSource(source: string): string[] {
  const prolonger = (chemins: string[][], segment: string): string[][] =>
    chemins.flatMap((debut) => valeursDuSegment(segment).map((valeur) => [...debut, valeur]))
  return source.split('/').filter(Boolean).reduce(prolonger, [[]]).map((segments) => enChemin(segments.filter(Boolean)))
}

/** Premiers segments littéraux : dossiers de app/ (groupes traversés) et de chaque langue, noms réservés, destinations. */
function premiersSegments(regles: readonly Regle[]): string[] {
  const dossiers = (dossier: string): string[] => existsSync(dossier)
    ? readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
      if (!e.isDirectory() || estHorsUrl(e.name) || estDynamique(e.name)) return []
      return estGroupe(e.name) ? dossiers(join(dossier, e.name)) : [e.name]
    })
    : []
  const destinations = regles.map(({ destination }) => destination.split('/')[1]).filter((s) => s && !s.startsWith(':'))
  return [...new Set([
    ...dossiers(APP), ...LANGUES.flatMap((langue) => dossiers(join(APP, langue))), ...IDENTIFIANTS_RESERVES_QR, ...destinations,
  ])].filter((segment) => !LANGUES.includes(segment))
}

/** Grille /<langue>/<premier segment>/<mot de cabinet>/ (chemins inexistants compris), mot aussi en capitales (Next ignore la casse). */
const grille = (premiers: readonly string[]): string[] => LANGUES.flatMap((langue) => premiers.flatMap((premier) =>
  MOTS_CABINET.flatMap((mot) => [`/${langue}/${premier}/${mot}/`, `/${langue}/${premier}/${mot.toUpperCase()}/`])))

/** Adresse de cabinet que le middleware laisse passer sans langue vers les réécritures (chemin d'ORIGINE). */
function estAdresseDeCabinet(chemin: string): boolean {
  if (cheminPublicCabinetQr(chemin)) return true
  const espace = cheminEspaceCabinetQr(chemin)
  // « /<id>/ » seul : redirigé par le middleware (307 vers /<id>/suivi/), jamais réécrit.
  return espace !== null && espace.page !== 'accueil'
}

interface Rejeu {
  regles: Regle[]
  next: Servir
  openNext: Servir
  nextSansCabinet: Servir
  openNextSansCabinet: Servir
  /** Chemins qui atteignent les réécritures (pages, sources des règles, grille) hors adresses de cabinet. */
  chemins: string[]
  /** Adresses des pages de app/ et des sources des règles hors cabinet. */
  pages: string[]
}

let rejeuEnCache: Rejeu | undefined
async function rejeu(): Promise<Rejeu> {
  if (rejeuEnCache) return rejeuEnCache
  const regles = await reglesAvantFichiers()
  const sansCabinet = regles.filter((regle) => !estRegleDeCabinet(regle))
  const pages = [...new Set([...routesDesPages().flatMap(adressesDeLaPage), ...adressesDesSources(regles)])]
  const chemins = [...new Set([...pages, ...grille(premiersSegments(regles))])].filter((chemin) => !estAdresseDeCabinet(chemin))
  rejeuEnCache = {
    regles, chemins, pages,
    next: servirParNext(regles),
    openNext: servirParOpenNext(regles),
    nextSansCabinet: servirParNext(sansCabinet),
    openNextSansCabinet: servirParOpenNext(sansCabinet),
  }
  return rejeuEnCache
}

/** Liste lisible (40 premiers écarts et leur nombre) : un toEqual([]) qui échoue reste lisible. */
const ecarts = (lignes: string[]): string[] => (lignes.length > 40 ? [...lignes.slice(0, 40), `… ${lignes.length} écarts`] : lignes)

describe('réécritures beforeFiles : next start (CI E2E) et OpenNext (production) servent la même page', () => {
  it('le rejeu couvre les pages de app/ et la grille des mots de cabinet (sinon il ne garderait rien)', async () => {
    const { regles, chemins, pages } = await rejeu()
    // 11 depuis la PR 3, lot 6 : paire exacte de la désinscription (/<id>/desinscription/), page interne rangée dans
    // app/(sans-coquille)/cabinet/[identifiant]/desinscription/ (mise en page racine propre, même adresse interne).
    expect(regles.filter(estRegleDeCabinet)).toHaveLength(11)
    expect(pages.length).toBeGreaterThan(300)
    for (const attendu of [
      '/fr/aj-signalement/connexion/', '/pt/aj-signalement/connexion/', '/fr/tracking/connexion/', '/es/signalement/invitation/',
      '/fr/auth/login/', '/fr/contact/', '/pt/contacto/', '/fr/blog/exemple/', '/admin/login/',
      // Nouveau segment (lot 6) : chemins internes d'une règle de langue, page interne sous chaque langue.
      '/fr/tracking/desinscription/', '/pt/auth/desinscription/', '/fr/cabinet/exemple/desinscription/',
    ]) expect(chemins, attendu).toContain(attendu)
    for (const attendu of ['/fr/auth/suivi/', '/pt/coproprietaire/confirmation-adresse/', `/nl/tracking/signalement/${JETON}/`]) {
      expect(chemins, attendu).toContain(attendu)
    }
  })

  it('Next enchaîne bien les règles beforeFiles : aucune n’a « check: true » (le disque n’est lu qu’après la dernière)', async () => {
    const { regles } = await rejeu()
    expect(regles.map((regle) => routeDeNext('before_files_rewrite', regle)).filter((route) => route.check)).toEqual([])
  })

  it.each(['fr', 'pt'])('/%s/aj-signalement/connexion/ est servie par la connexion de l’espace (#669) dans les deux moteurs', async (langue) => {
    const { next, openNext } = await rejeu()
    for (const chemin of [`/${langue}/aj-signalement/connexion/`, `/${langue}/aj-signalement/connexion`]) {
      expect(next(chemin), `next start : ${chemin}`).toBe('/aj-signalement/connexion')
      expect(openNext(chemin), `OpenNext : ${chemin}`).toBe('/aj-signalement/connexion')
    }
  })

  it('aucune page de app/ ni source d’une règle, à aucune adresse ni dans aucune langue, n’est captée par une règle de cabinet (chaque moteur)', async () => {
    const { pages, next, openNext, nextSansCabinet, openNextSansCabinet } = await rejeu()
    const fautives = pages.filter((chemin) => !estAdresseDeCabinet(chemin)).flatMap((chemin) => [
      ...(next(chemin) === nextSansCabinet(chemin) ? [] : [`next start : ${chemin} → ${next(chemin)} au lieu de ${nextSansCabinet(chemin)}`]),
      ...(openNext(chemin) === openNextSansCabinet(chemin) ? [] : [`OpenNext : ${chemin} → ${openNext(chemin)} au lieu de ${openNextSansCabinet(chemin)}`]),
    ])
    expect(ecarts(fautives)).toEqual([])
  })

  it('aucun chemin interne produit par une règle de langue n’atteint /cabinet/ (grille, chaque moteur)', async () => {
    const { chemins, next, openNext, nextSansCabinet, openNextSansCabinet } = await rejeu()
    const fautives = chemins.flatMap((chemin) => [
      ...(next(chemin) === nextSansCabinet(chemin) && !next(chemin).startsWith('/cabinet/') ? [] : [`next start : ${chemin} → ${next(chemin)}`]),
      ...(openNext(chemin) === openNextSansCabinet(chemin) && !openNext(chemin).startsWith('/cabinet/') ? [] : [`OpenNext : ${chemin} → ${openNext(chemin)}`]),
    ])
    expect(ecarts(fautives)).toEqual([])
  })

  it('les deux moteurs servent la même page pour chaque chemin rejoué (casse du site : minuscules)', async () => {
    const { chemins, next, openNext } = await rejeu()
    // Hors racines des règles « :path* » (/fr/auth/ : OpenNext rend la destination littérale « /auth/:path* », sans page) :
    // défaut distinct, gardé par tests/next-config-routage-opennext.test.ts.
    const fautives = chemins
      .filter((chemin) => chemin === chemin.toLowerCase() && !openNext(chemin).includes(':'))
      .filter((chemin) => next(chemin) !== openNext(chemin))
      .map((chemin) => `${chemin} : next start ${next(chemin)}, OpenNext ${openNext(chemin)}`)
    expect(ecarts(fautives)).toEqual([])
  })

  it('identifiant réservé : jamais l’espace d’un cabinet, ni sans langue (le middleware le renvoie vers sa langue) ni sous une langue', async () => {
    const { next, openNext } = await rejeu()
    const espace = IDENTIFIANTS_RESERVES_QR.flatMap((identifiant) => ['connexion', 'suivi'].map((mot) => `/${identifiant}/${mot}/`))
    const fautives = espace.flatMap((chemin) => [
      ...(cheminEspaceCabinetQr(chemin) ? [`middleware : ${chemin} pris pour l’espace d’un cabinet`] : []),
      ...LANGUES.map((langue) => `/${langue}${chemin}`)
        .filter((avecLangue) => next(avecLangue).startsWith('/cabinet/') || openNext(avecLangue).startsWith('/cabinet/'))
        .map((avecLangue) => `${avecLangue} → next start ${next(avecLangue)}, OpenNext ${openNext(avecLangue)}`),
    ])
    expect(ecarts(fautives)).toEqual([])
  })

  it('une adresse de cabinet reconnue par le middleware est servie par sa page interne dans les deux moteurs', async () => {
    const { next, openNext } = await rejeu()
    // Motif FIGÉ des pages publiques (règle 1 de chemin-cabinet.ts, PR 1 en production) : tout identifiant du motif, même
    // réservé, comme aujourd'hui ; espace du cabinet : identifiant valable seulement (le middleware filtre).
    const adresses = ['cabinet-exemple', 'abc', ...IDENTIFIANTS_RESERVES_QR]
      .flatMap((identifiant) => MOTS_CABINET.flatMap((mot) => [`/${identifiant}/${mot}/`, `/${identifiant}/${mot}`]))
      .filter(estAdresseDeCabinet)
    expect(adresses).toContain('/cabinet-exemple/connexion/')
    expect(adresses).toContain(`/cabinet-exemple/signalement/${JETON}/`)
    expect(adresses).toContain('/cabinet-exemple/desinscription/')
    expect(adresses).toContain('/cabinet-exemple/desinscription')
    const fautives = adresses.flatMap((chemin) => {
      const attendu = `/cabinet${sansBarreFinale(chemin)}`
      return [next(chemin), openNext(chemin)].some((servi) => servi !== attendu)
        ? [`${chemin} : next start ${next(chemin)}, OpenNext ${openNext(chemin)}, attendu ${attendu}`] : []
    })
    expect(ecarts(fautives)).toEqual([])
  })

  it('production : la place des règles de cabinet dans beforeFiles ne change aucune page servie par OpenNext', async () => {
    const { regles, chemins, openNext } = await rejeu()
    const enFin = servirParOpenNext([...regles.filter((r) => !estRegleDeCabinet(r)), ...regles.filter(estRegleDeCabinet)])
    const adresses = MOTS_CABINET.map((mot) => `/cabinet-exemple/${mot}/`)
    const fautives = [...chemins, ...adresses].filter((chemin) => openNext(chemin) !== enFin(chemin))
      .map((chemin) => `${chemin} : ${openNext(chemin)} au lieu de ${enFin(chemin)}`)
    expect(ecarts(fautives)).toEqual([])
  })
})
